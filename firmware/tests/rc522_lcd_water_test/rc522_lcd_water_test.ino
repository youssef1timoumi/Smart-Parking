/*
 * rc522_lcd_water_test.ino — cumulative test #3
 * ---------------------------------------------
 * RC522 (SPI) + 16x2 I2C LCD + analog water sensor, all together.
 * Builds on the last test; nothing already wired moves.
 *
 *   Idle screen:  line1 "Scan your card"      line2 "Water:<state> <value>"
 *   Tap a card :  shows the UID for 2 s, then back to idle.
 *
 * Libraries: MFRC522, LiquidCrystal_I2C.
 *
 * Wiring (your board's labels):
 *   RC522 (unchanged): SDA->P5  SCK->P18  MOSI->P23  MISO->P19  RST->P22  3.3V->3V3  GND->GND
 *   LCD   (unchanged): GND->GND  VCC->3V3  SDA->P21  SCL->P17
 *   Water sensor NEW : S->P34   +->3V3   -->GND
 *
 * Upload with RC522 unplugged (the P5 strapping pin), then plug it back.
 */

#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ---- RC522 ----
#define SS_PIN   5
#define RST_PIN  22
MFRC522 reader(SS_PIN, RST_PIN);

// ---- LCD ----
#define I2C_SDA   21
#define I2C_SCL   17
#define LCD_ADDR  0x27          // try 0x3F if blank
LiquidCrystal_I2C lcd(LCD_ADDR, 16, 2);

// ---- Water sensor ----
const int WATER_PIN = 34;       // S -> P34
int dryBaseline = 0;
unsigned long lastWater = 0;

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

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println(F("=== RC522 + LCD + Water test ==="));

  Wire.begin(I2C_SDA, I2C_SCL);       // LCD I2C on our pins (SCL=17)
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("Smart Parking");
  lcd.setCursor(0, 1); lcd.print("Starting...");

  analogReadResolution(12);           // ADC 0..4095
  long sum = 0;
  for (int i = 0; i < 20; i++) { sum += analogRead(WATER_PIN); delay(10); }
  dryBaseline = sum / 20;
  Serial.print(F("Water dry baseline: ")); Serial.println(dryBaseline);

  SPI.begin();
  reader.PCD_Init();
  delay(50);
  byte v = reader.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print(F("RC522 version: 0x")); Serial.println(v, HEX);
  Serial.println((v == 0x00 || v == 0xFF) ? F(">> RC522 BAD (check wiring).")
                                          : F(">> RC522 OK."));
  delay(600);
  showIdle(analogRead(WATER_PIN));
}

void loop() {
  // 1) Card tapped? show its UID for 2 s.
  if (reader.PICC_IsNewCardPresent() && reader.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i = 0; i < reader.uid.size; i++) {
      if (reader.uid.uidByte[i] < 0x10) uid += "0";
      uid += String(reader.uid.uidByte[i], HEX);
      if (i + 1 < reader.uid.size) uid += " ";
    }
    uid.toUpperCase();
    Serial.print(F("UID: ")); Serial.println(uid);

    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("Card UID:");
    lcd.setCursor(0, 1); lcd.print(uid.substring(0, 16));
    reader.PICC_HaltA();
    delay(2000);
    showIdle(analogRead(WATER_PIN));
    return;
  }

  // 2) Otherwise refresh the water reading every 500 ms.
  if (millis() - lastWater >= 500) {
    lastWater = millis();
    int raw = analogRead(WATER_PIN);
    Serial.printf("water = %4d  %s\n", raw, waterState(raw));
    showIdle(raw);
  }
}
