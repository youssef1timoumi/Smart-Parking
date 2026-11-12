/*
 * full_behavior_test.ino — the demo behavior (RC522 + LCD + water + 2 servos)
 * ---------------------------------------------------------------------------
 * Tap a card -> print UID on Serial, show it on the LCD, and open a barrier
 * for 5 seconds, then auto-close. Taps ALTERNATE:
 *   odd  tap = ENTRY -> LCD "Welcome" -> Servo 1 (P27) opens 180, hold 5s, close 115
 *   even tap = EXIT  -> LCD "Goodbye" -> Servo 2 (P16) opens 0,   hold 5s, close 85
 * The water sensor is printed on the Serial Monitor while idle (not on the LCD).
 *
 * Libraries: MFRC522, LiquidCrystal_I2C, ESP32Servo.
 *
 * Wiring (your board's labels):
 *   RC522: SDA->P5 SCK->P18 MOSI->P23 MISO->P19 RST->P22 3.3V->3V3 GND->GND
 *   LCD:   GND->GND VCC->3V3 SDA->P21 SCL->P17
 *   Water: S->P34 +->3V3 -->GND
 *   Servo 1 (entry): orange->P27  red->BB3 5V  brown->BB3 GND
 *   Servo 2 (exit) : orange->P16  red->BB3 5V  brown->BB3 GND
 *
 * Upload with RC522 unplugged, then plug it back (flash-read-err rule).
 */

#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>

// ---- RC522 ----
#define SS_PIN   5
#define RST_PIN  22
MFRC522 reader(SS_PIN, RST_PIN);

// ---- LCD ----
#define I2C_SDA   21
#define I2C_SCL   17
#define LCD_ADDR  0x27
LiquidCrystal_I2C lcd(LCD_ADDR, 16, 2);

// ---- Water sensor ----
const int WATER_PIN = 34;
int dryBaseline = 0;
unsigned long lastWater = 0;

// ---- Servos (calibrated angles) ----
const int SERVO1_PIN = 27;              // entry barrier
const int S1_CLOSED = 108, S1_OPEN = 180;   // closed lowered 115 -> 108 so the arm sits fully down
const int SERVO2_PIN = 16;              // exit barrier
const int S2_CLOSED = 85,  S2_OPEN = 0;
const int HOLD_MS = 5000;               // stay open 5 seconds
Servo servo1, servo2;

unsigned long tapCount = 0;

const char* waterState(int raw) {
  if      (raw < dryBaseline + 150) return "DRY ";
  else if (raw < 1800)              return "DAMP";
  else                              return "WET ";
}

void idleScreen() {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Smart Parking");
  lcd.setCursor(0, 1); lcd.print("Scan your card");
}

// Sweep a servo smoothly from one angle to another (handles either direction).
void sweepTo(Servo& s, int from, int to) {
  int step = (to >= from) ? 2 : -2;
  for (int a = from; (step > 0) ? (a <= to) : (a >= to); a += step) { s.write(a); delay(15); }
  s.write(to);
}

// Open a barrier, hold 5 s, close it.
void cycleBarrier(Servo& s, int closedDeg, int openDeg, const char* name) {
  Serial.printf("   %s: opening\n", name);
  sweepTo(s, closedDeg, openDeg);
  delay(HOLD_MS);
  Serial.printf("   %s: closing\n", name);
  sweepTo(s, openDeg, closedDeg);
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println(F("=== Smart Parking — full behavior test ==="));

  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("Smart Parking");
  lcd.setCursor(0, 1); lcd.print("Starting...");

  analogReadResolution(12);
  long sum = 0;
  for (int i = 0; i < 20; i++) { sum += analogRead(WATER_PIN); delay(10); }
  dryBaseline = sum / 20;
  Serial.print(F("Water dry baseline: ")); Serial.println(dryBaseline);

  SPI.begin();
  reader.PCD_Init();
  delay(50);
  byte v = reader.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print(F("RC522 version: 0x")); Serial.println(v, HEX);
  Serial.println((v == 0x00 || v == 0xFF) ? F(">> RC522 BAD.") : F(">> RC522 OK."));

  // Start both barriers closed.
  servo1.setPeriodHertz(50);
  servo2.setPeriodHertz(50);
  servo1.attach(SERVO1_PIN, 500, 2400);
  servo2.attach(SERVO2_PIN, 500, 2400);
  servo1.write(S1_CLOSED);
  servo2.write(S2_CLOSED);

  delay(700);
  idleScreen();
  Serial.println(F("Ready. Tap a card."));
}

void loop() {
  // 1) Card tapped?
  if (reader.PICC_IsNewCardPresent() && reader.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i = 0; i < reader.uid.size; i++) {
      if (reader.uid.uidByte[i] < 0x10) uid += "0";
      uid += String(reader.uid.uidByte[i], HEX);
      if (i + 1 < reader.uid.size) uid += " ";
    }
    uid.toUpperCase();

    bool entry = (tapCount % 2 == 0);
    Serial.print(F("UID: ")); Serial.print(uid);
    Serial.println(entry ? F("   -> WELCOME (entry)") : F("   -> GOODBYE (exit)"));

    lcd.clear();
    lcd.setCursor(0, 0); lcd.print(entry ? "Welcome" : "Goodbye");
    lcd.setCursor(0, 1); lcd.print(uid.substring(0, 16));

    if (entry) cycleBarrier(servo1, S1_CLOSED, S1_OPEN, "Servo1/P27 entry");
    else       cycleBarrier(servo2, S2_CLOSED, S2_OPEN, "Servo2/P16 exit");
    tapCount++;

    reader.PICC_HaltA();
    idleScreen();
    return;
  }

  // 2) Idle: print the water reading on Serial every 500 ms.
  if (millis() - lastWater >= 500) {
    lastWater = millis();
    int raw = analogRead(WATER_PIN);
    Serial.printf("water = %4d  %s\n", raw, waterState(raw));
  }
}
