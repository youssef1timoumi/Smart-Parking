/*
 * rc522_lcd_test.ino — combined test: RC522 (SPI) + 16x2 I2C LCD
 * -------------------------------------------------------------
 * NOT part of the main project. RC522 stays on the SAME pins as before.
 * Tap a card -> UID prints on Serial AND shows on the LCD.
 *
 * Libraries:
 *   - "MFRC522" by GithubCommunity
 *   - "LiquidCrystal_I2C" (Frank de Brabander / marcoschwartz — the lcd.init()/backlight() one)
 *
 * Wiring (your board's labels):
 *   RC522 (UNCHANGED): SDA->P5  SCK->P18  MOSI->P23  MISO->P19  RST->P22  3.3V->3V3  GND->GND
 *   LCD (4 wires):     GND->GND  VCC->3V3  SDA->P21  SCL->P17
 *
 * NOTE: the LCD's SCL is on P17 (not the usual P22) because RC522 already uses P22.
 *       That's why we call Wire.begin(21, 17) explicitly below.
 *
 * Upload with peripherals UNPLUGGED, then plug them back to the same pins.
 */

#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ---- RC522 (unchanged) ----
#define SS_PIN   5
#define RST_PIN  22
MFRC522 reader(SS_PIN, RST_PIN);

// ---- LCD on custom I2C pins ----
#define I2C_SDA   21
#define I2C_SCL   17
#define LCD_ADDR  0x27          // try 0x3F if the screen stays blank
LiquidCrystal_I2C lcd(LCD_ADDR, 16, 2);

void idleScreen() {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Smart Parking");
  lcd.setCursor(0, 1); lcd.print("Scan your card");
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println(F("=== RC522 + LCD test ==="));

  // I2C must start on OUR pins before the LCD (SCL=17, not the default 22)
  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.init();
  lcd.backlight();
  idleScreen();

  SPI.begin();                  // RC522 SPI: SCK=18, MISO=19, MOSI=23
  reader.PCD_Init();
  delay(50);
  byte v = reader.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print(F("RC522 version: 0x"));
  Serial.println(v, HEX);
  if (v == 0x00 || v == 0xFF) Serial.println(F(">> RC522 BAD (check wiring)."));
  else                        Serial.println(F(">> RC522 OK. Tap a card..."));
  Serial.println(F("(If the LCD is blank: adjust the blue contrast pot, or try addr 0x3F.)"));
}

void loop() {
  if (!reader.PICC_IsNewCardPresent()) return;
  if (!reader.PICC_ReadCardSerial()) return;

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
  delay(2000);
  idleScreen();

  reader.PICC_HaltA();
  delay(400);
}
