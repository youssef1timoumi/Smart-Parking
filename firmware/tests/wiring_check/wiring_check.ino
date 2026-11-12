/*
 * wiring_check — checks that every component of the final gate is WIRED and DETECTED.
 * ====================================================================================
 * It doesn't run the parking flow; it just asks each part "are you there?":
 *   1. LCD 16x2 I2C      -> scans the I2C bus (SDA 21 / SCL 17), expects 0x27
 *   2. RC522 RFID        -> reads its chip version over SPI (SS 5 / RST 22)
 *   3. HC-SR04 #1 slot 1 -> TRIG 26 / ECHO 25 : echo idle LOW + gets an echo back
 *   4. HC-SR04 #2 slot 2 -> TRIG 33 / ECHO 32 : same
 *   5. Servo 1 entry (27) and Servo 2 exit (16) -> attach + a small wiggle you WATCH
 *      (a hobby servo has no feedback wire, so the board can't "see" it — your eyes do)
 *
 * Same pins as smart_parking_final/Config.h. Serial Monitor 115200, line ending "Newline".
 *   r = run all checks again      t = tap test (show the next card's UID)
 *
 * Upload with the RC522 UNPLUGGED, then plug it back (P5 strapping -> flash read err).
 * Libraries: MFRC522, LiquidCrystal_I2C, ESP32Servo.
 */
#include <SPI.h>
#include <Wire.h>
#include <MFRC522.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>

// ---- pins (= smart_parking_final/Config.h) ----
#define SS_PIN      5
#define RST_PIN     22
#define I2C_SDA     21
#define I2C_SCL     17
#define LCD_ADDR    0x27
#define SERVO1_PIN  27
#define S1_CLOSED   30
#define SERVO2_PIN  16
#define S2_CLOSED   85
#define S1_TRIG     26
#define S1_ECHO     25
#define S2_TRIG     33
#define S2_ECHO     32

MFRC522 reader(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(LCD_ADDR, 16, 2);
Servo servo1, servo2;

enum Res { R_PASS, R_WARN, R_FAIL };
const char* resName(Res r) { return r == R_PASS ? "PASS" : (r == R_WARN ? "WARN" : "FAIL"); }
Res rLcd, rRfid, rUs1, rUs2, rSv1, rSv2;
bool lcdOk = false, rfidOk = false;

void line() { Serial.println(F("------------------------------------------------------------")); }

// ---------- 1. LCD (I2C) ----------
Res checkLcd() {
  Serial.println(F("[1] LCD 16x2 I2C   SDA=21  SCL=17  expected addr 0x27"));
  int found = 0; byte other = 0; bool at27 = false;
  for (byte a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      Serial.printf("    I2C device found at 0x%02X\n", a);
      found++;
      if (a == LCD_ADDR) at27 = true; else other = a;
    }
  }
  if (at27) {
    lcd.init(); lcd.backlight();
    lcd.clear(); lcd.setCursor(0, 0); lcd.print("Wiring check");
    lcd.setCursor(0, 1); lcd.print("LCD OK");
    lcdOk = true;
    Serial.println(F("    PASS  LCD answers at 0x27 (you should read 'Wiring check' on it)."));
    Serial.println(F("          Backlight on but no text? turn the blue contrast screw on the back."));
    return R_PASS;
  }
  lcdOk = false;
  if (found && ((other >= 0x20 && other <= 0x27) || (other >= 0x38 && other <= 0x3F))) {   // PCF8574 / PCF8574A ranges
    Serial.printf("    WARN  an LCD backpack answers at 0x%02X, not 0x27 -> set LCD_ADDR to 0x%02X in Config.h\n", other, other);
    return R_WARN;
  }
  Serial.println(F("    FAIL  nothing on the I2C bus."));
  Serial.println(F("          check: SDA->21, SCL->17 (not swapped), VCC->3V3/5V, GND common."));
  return R_FAIL;
}

// ---------- 2. RC522 (SPI) ----------
Res checkRfid() {
  Serial.println(F("[2] RC522 RFID     SS=5 SCK=18 MOSI=23 MISO=19 RST=22  VCC=3V3"));
  reader.PCD_Init();
  delay(50);
  byte v = reader.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.printf("    chip version register = 0x%02X\n", v);
  if (v == 0x00 || v == 0xFF) {
    rfidOk = false;
    Serial.println(F("    FAIL  the reader doesn't answer on SPI."));
    Serial.println(F("          0x00 = MISO(19) not connected / no power;  0xFF = SS(5) or MOSI(23) wrong, or RST(22) held low."));
    Serial.println(F("          check VCC is 3V3 (NOT 5V) and GND is common."));
    return R_FAIL;
  }
  rfidOk = true;
  if (v == 0x91 || v == 0x92) {
    Serial.printf("    PASS  genuine MFRC522 v%d.0 detected. Type 't' then tap a card to test reading.\n", v == 0x91 ? 1 : 2);
    return R_PASS;
  }
  Serial.println(F("    PASS  reader answers (clone chip, version not 0x91/0x92 — that's normal for many modules)."));
  Serial.println(F("          type 't' then tap a card to be sure it reads."));
  return R_PASS;
}

// ---------- 3/4. HC-SR04 ----------
long pingCm(int trig, int echo) {
  digitalWrite(trig, LOW);  delayMicroseconds(3);
  digitalWrite(trig, HIGH); delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long dur = pulseIn(echo, HIGH, 30000);      // ~5 m max
  return dur == 0 ? -1 : dur / 58;
}
Res checkUltrasonic(const char* name, int trig, int echo) {
  Serial.printf("[%s] HC-SR04        TRIG=%d  ECHO=%d\n", name, trig, echo);
  pinMode(trig, OUTPUT); pinMode(echo, INPUT);
  digitalWrite(trig, LOW); delay(5);
  if (digitalRead(echo) == HIGH) {
    Serial.println(F("    FAIL  ECHO pin is stuck HIGH before any ping."));
    Serial.println(F("          check: TRIG and ECHO swapped, or ECHO shorted to VCC."));
    return R_FAIL;
  }
  int got = 0; long last = -1;
  for (int i = 0; i < 5; i++) {
    long cm = pingCm(trig, echo);
    if (cm > 0) { got++; last = cm; }
    delay(60);
  }
  if (got == 0) {
    Serial.println(F("    FAIL  no echo at all (5 pings)."));
    Serial.println(F("          check: VCC/GND on the sensor, TRIG and ECHO pins (maybe swapped), the ECHO divider."));
    return R_FAIL;
  }
  if (got < 3) {
    Serial.printf("    WARN  only %d/5 pings answered (last %ld cm) — loose wire or nothing solid in front.\n", got, last);
    return R_WARN;
  }
  Serial.printf("    PASS  %d/5 echoes, distance %ld cm. Put your hand in front: it should drop.\n", got, last);
  return R_PASS;
}

// ---------- 5. Servos ----------
void wiggle(Servo& s, int closedAng, int dir) {
  for (int k = 0; k < 2; k++) {
    s.write(closedAng + dir * 25); delay(350);
    s.write(closedAng);            delay(350);
  }
}
Res checkServo(const char* name, Servo& s, int pin, int closedAng, int dir) {
  Serial.printf("[%s] Servo on GPIO%d (closed = %d deg)\n", name, pin, closedAng);
  if (!s.attached()) s.attach(pin, 500, 2400);
  if (!s.attached()) {
    Serial.println(F("    FAIL  the ESP32 couldn't attach a PWM channel to this pin (ESP32Servo)."));
    return R_FAIL;
  }
  s.write(closedAng); delay(300);
  Serial.println(F("    signal OK. WATCH THE ARM NOW: it should twitch 25 deg twice and come back."));
  wiggle(s, closedAng, dir);
  Serial.println(F("    -> moved?  yes = wired.  no = check signal wire, 5V (red), GND (brown) + common GND."));
  Serial.println(F("       jitters/resets the ESP32? = the 5V supply is too weak: power servos separately, common GND."));
  return R_WARN;   // the board can't confirm movement by itself
}

// ---------- run everything ----------
void runAll() {
  Serial.println();
  line();
  Serial.println(F("  SMART PARKING — WIRING CHECK"));
  line();
  rLcd  = checkLcd();                              line();
  rRfid = checkRfid();                             line();
  rUs1  = checkUltrasonic("3", S1_TRIG, S1_ECHO);  line();
  rUs2  = checkUltrasonic("4", S2_TRIG, S2_ECHO);  line();
  if (lcdOk) { lcd.clear(); lcd.print("Servo 1 moving"); }
  rSv1  = checkServo("5a", servo1, SERVO1_PIN, S1_CLOSED, +1);   // entry opens toward 180
  if (lcdOk) { lcd.clear(); lcd.print("Servo 2 moving"); }
  rSv2  = checkServo("5b", servo2, SERVO2_PIN, S2_CLOSED, -1);   // exit opens toward 0
  line();

  Serial.println(F("  SUMMARY"));
  Serial.printf("    LCD 0x27 ........... %s\n", resName(rLcd));
  Serial.printf("    RC522 RFID ......... %s\n", resName(rRfid));
  Serial.printf("    HC-SR04 slot 1 ..... %s\n", resName(rUs1));
  Serial.printf("    HC-SR04 slot 2 ..... %s\n", resName(rUs2));
  Serial.printf("    Servo 1 entry ...... %s\n", rSv1 == R_FAIL ? "FAIL" : "CHECK BY EYE (did it move?)");
  Serial.printf("    Servo 2 exit ....... %s\n", rSv2 == R_FAIL ? "FAIL" : "CHECK BY EYE (did it move?)");
  line();
  Serial.println(F("  r = run again    t = tap a card to test the reader"));

  if (lcdOk) {
    char l1[17], l2[17];
    snprintf(l1, sizeof(l1), "LCD%c RFID%c", 'v', rRfid == R_PASS ? 'v' : 'x');
    snprintf(l2, sizeof(l2), "US1%c US2%c", rUs1 == R_PASS ? 'v' : (rUs1 == R_WARN ? '?' : 'x'),
                                            rUs2 == R_PASS ? 'v' : (rUs2 == R_WARN ? '?' : 'x'));
    lcd.clear(); lcd.setCursor(0, 0); lcd.print(l1); lcd.setCursor(0, 1); lcd.print(l2);
  }
}

void tapTest() {
  if (!rfidOk) { Serial.println(F("[t] the RC522 failed its check — fix that first.")); return; }
  Serial.println(F("[t] tap a card on the reader (10 s)..."));
  if (lcdOk) { lcd.clear(); lcd.print("Tap a card..."); }
  unsigned long t0 = millis();
  while (millis() - t0 < 10000) {
    if (reader.PICC_IsNewCardPresent() && reader.PICC_ReadCardSerial()) {
      String uid = "";
      for (byte i = 0; i < reader.uid.size; i++) {
        if (reader.uid.uidByte[i] < 0x10) uid += "0";
        uid += String(reader.uid.uidByte[i], HEX);
        if (i + 1 < reader.uid.size) uid += ":";
      }
      uid.toUpperCase();
      Serial.printf("    PASS  card read: %s  (%s)\n", uid.c_str(),
                    reader.PICC_GetTypeName(reader.PICC_GetType(reader.uid.sak)));
      if (lcdOk) { lcd.clear(); lcd.print("Card OK"); lcd.setCursor(0, 1); lcd.print(uid.substring(0, 16)); }
      reader.PICC_HaltA();
      return;
    }
    delay(50);
  }
  Serial.println(F("    no card seen. Reader answered on SPI, so check the antenna side / try closer."));
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Wire.begin(I2C_SDA, I2C_SCL);
  SPI.begin();
  servo1.setPeriodHertz(50); servo2.setPeriodHertz(50);
  runAll();
}

void loop() {
  if (!Serial.available()) return;
  String cmd = Serial.readStringUntil('\n');
  cmd.trim(); cmd.toLowerCase();
  if (cmd == "r") runAll();
  else if (cmd == "t") tapTest();
  else if (cmd.length()) Serial.println(F("r = run again, t = tap test"));
}
