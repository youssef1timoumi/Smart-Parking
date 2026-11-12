/*
 * rc522_lcd_water_servo_test.ino — cumulative test #4
 * ---------------------------------------------------
 * RC522 + 16x2 I2C LCD + analog water sensor + TWO SG90 servos.
 * Everything already wired stays put; this adds the two barriers.
 *
 *   Idle screen:  line1 "Scan your card"   line2 "Water:<state> <value>"
 *   Tap a card :  shows UID, then a barrier opens 1.5 s and closes.
 *                 Taps ALTERNATE: tap1 = entry (P27), tap2 = exit (P16), ...
 *                 (one servo per tap = kinder to the 5V supply)
 *
 * Libraries: MFRC522, LiquidCrystal_I2C, ESP32Servo.
 *
 * Wiring (your board's labels):
 *   RC522 (unchanged): SDA->P5  SCK->P18  MOSI->P23  MISO->P19  RST->P22  3.3V->3V3  GND->GND
 *   LCD   (unchanged): GND->GND  VCC->3V3  SDA->P21  SCL->P17
 *   Water (unchanged): S->P34   +->3V3   -->GND
 *   Servo 1 (entry):   orange->P27  red->BB3 5V  brown->BB3 GND
 *   Servo 2 (exit) :   orange->P16  red->BB3 5V  brown->BB3 GND   (P16, NOT P14!)
 *
 * Upload with RC522 unplugged (the P5 strapping pin), then plug it back.
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

// ---- Servos ----
const int SERVO1_PIN = 27;   // entry barrier (P27)
const int SERVO2_PIN = 16;   // exit  barrier (P16)
const int CLOSED_DEG = 0;
const int OPEN_DEG   = 90;
Servo servo1, servo2;
unsigned long tapCount = 0;

const char* waterState(int raw) {
  if      (raw < dryBaseline + 150) return "DRY ";
  else if (raw < 1800)              return "DAMP";
  else                              return "WET ";
}

void showIdle(int raw) {
  lcd.setCursor(0, 0); lcd.print("Scan your card  ");
  char line[17];
  snprintf(line, sizeof(line), "Water:%-4s %4d", waterState(raw), raw);
  lcd.setCursor(0, 1); lcd.print(line);
}

void moveBarrier(Servo& s, const char* name) {
  Serial.printf("   %s: opening\n", name);
  for (int a = CLOSED_DEG; a <= OPEN_DEG; a += 2) { s.write(a); delay(15); }
  delay(1500);
  Serial.printf("   %s: closing\n", name);
  for (int a = OPEN_DEG; a >= CLOSED_DEG; a -= 2) { s.write(a); delay(15); }
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println(F("=== RC522 + LCD + Water + 2 Servos test ==="));

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

  servo1.setPeriodHertz(50);
  servo2.setPeriodHertz(50);
  servo1.attach(SERVO1_PIN, 500, 2400);
  servo2.attach(SERVO2_PIN, 500, 2400);
  servo1.write(CLOSED_DEG);
  servo2.write(CLOSED_DEG);

  delay(600);
  showIdle(analogRead(WATER_PIN));
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
    Serial.println(entry ? F("   -> ENTRY") : F("   -> EXIT"));

    lcd.clear();
    lcd.setCursor(0, 0); lcd.print(entry ? "Entry barrier" : "Exit barrier");
    lcd.setCursor(0, 1); lcd.print(uid.substring(0, 16));

    moveBarrier(entry ? servo1 : servo2, entry ? "Servo1/P27 entry" : "Servo2/P16 exit");
    tapCount++;

    reader.PICC_HaltA();
    showIdle(analogRead(WATER_PIN));
    return;
  }

  // 2) Refresh water every 500 ms.
  if (millis() - lastWater >= 500) {
    lastWater = millis();
    int raw = analogRead(WATER_PIN);
    Serial.printf("water = %4d  %s\n", raw, waterState(raw));
    showIdle(raw);
  }
}
