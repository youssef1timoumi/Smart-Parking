/*
 * rc522_test.ino — standalone RC522 wiring test for the ESP32
 * ------------------------------------------------------------
 * NOT part of the main project. Just proves the reader is wired right
 * and reads card UIDs, before we touch the real firmware.
 *
 * Library: "MFRC522" by GithubCommunity (same one the project uses).
 *          Arduino IDE → Tools → Manage Libraries → search "MFRC522".
 *
 * Pins (match the project's config.h):
 *   RC522 3.3V -> ESP32 3V3   (NEVER 5V)
 *   RC522 GND  -> ESP32 GND
 *   RC522 SDA  -> ESP32 GPIO5   (SS)
 *   RC522 SCK  -> ESP32 GPIO18
 *   RC522 MOSI -> ESP32 GPIO23
 *   RC522 MISO -> ESP32 GPIO19
 *   RC522 RST  -> ESP32 GPIO22
 *   RC522 IRQ  -> not connected
 *
 * Upload at 115200. Open Serial Monitor at 115200.
 */

#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN   5
#define RST_PIN  22

MFRC522 reader(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println(F("=== RC522 wiring test ==="));

  SPI.begin();            // ESP32 default SPI: SCK=18, MISO=19, MOSI=23
  reader.PCD_Init();
  delay(50);

  // Read the reader's firmware version. This is the key diagnostic:
  //   0x91 or 0x92  -> reader is alive and wired correctly  ✅
  //   0x00 or 0xFF  -> wiring/power problem (check 3.3V, GND, SS/RST, SPI) ❌
  byte v = reader.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print(F("Reader firmware version: 0x"));
  Serial.println(v, HEX);
  if (v == 0x00 || v == 0xFF) {
    Serial.println(F(">> BAD: reader not responding. Check 3.3V power, GND,"));
    Serial.println(F("   and the SDA(5)/SCK(18)/MOSI(23)/MISO(19)/RST(22) wires."));
  } else {
    Serial.println(F(">> OK: reader detected. Tap a card..."));
  }
  Serial.println();
}

void loop() {
  // Nothing new in front of the reader? keep looping.
  if (!reader.PICC_IsNewCardPresent()) return;
  if (!reader.PICC_ReadCardSerial()) return;

  // Print the UID as hex, e.g. "UID: 95 AA 3D B0"
  Serial.print(F("UID:"));
  for (byte i = 0; i < reader.uid.size; i++) {
    Serial.print(reader.uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(reader.uid.uidByte[i], HEX);
  }
  Serial.print(F("   Type: "));
  Serial.println(reader.PICC_GetTypeName(reader.PICC_GetType(reader.uid.sak)));

  reader.PICC_HaltA();     // stop talking to this card so the next tap is fresh
  delay(800);
}
