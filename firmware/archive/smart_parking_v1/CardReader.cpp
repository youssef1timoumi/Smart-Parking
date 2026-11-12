#include "CardReader.h"
#include <SPI.h>
#include <MFRC522.h>

static MFRC522* rfid = nullptr;

CardReader::CardReader(uint8_t ssPin, uint8_t rstPin, unsigned long repeatIgnoreMs)
  : _ssPin(ssPin), _rstPin(rstPin), _repeatIgnoreMs(repeatIgnoreMs) {}

bool CardReader::begin() {
  SPI.begin();  // ESP32 default VSPI: SCK=18, MISO=19, MOSI=23
  rfid = new MFRC522(_ssPin, _rstPin);
  rfid->PCD_Init();
  delay(50);

  byte v = rfid->PCD_ReadRegister(MFRC522::VersionReg);
  if (v == 0x00 || v == 0xFF) {
    Serial.printf("[RC522] NOT detected (version 0x%02X) — check wiring/3.3V.\n", v);
    return false;
  }
  Serial.printf("[RC522] Detected, firmware version 0x%02X. Waiting for cards...\n", v);
  return true;
}

bool CardReader::poll(String& uid, String& type) {
  if (!rfid) return false;
  if (!rfid->PICC_IsNewCardPresent() || !rfid->PICC_ReadCardSerial()) return false;

  uid = "";
  for (byte i = 0; i < rfid->uid.size; i++) {
    if (i) uid += ':';
    if (rfid->uid.uidByte[i] < 0x10) uid += '0';
    uid += String(rfid->uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  type = rfid->PICC_GetTypeName(rfid->PICC_GetType(rfid->uid.sak));

  rfid->PICC_HaltA();
  rfid->PCD_StopCrypto1();

  // Ignore the same card held on the reader / re-tapped too quickly.
  if (uid == _lastUid && millis() - _lastReadAt < _repeatIgnoreMs) {
    _lastReadAt = millis();
    return false;
  }
  _lastUid = uid;
  _lastReadAt = millis();
  return true;
}

MFRC522* CardReader::raw() { return rfid; }

bool CardReader::selectCard() {
  return rfid && rfid->PICC_IsNewCardPresent() && rfid->PICC_ReadCardSerial();
}

void CardReader::releaseCard() {
  if (rfid) { rfid->PICC_HaltA(); rfid->PCD_StopCrypto1(); }
}

String CardReader::uidString() {
  String uid = "";
  if (!rfid) return uid;
  for (byte i = 0; i < rfid->uid.size; i++) {
    if (i) uid += ':';
    if (rfid->uid.uidByte[i] < 0x10) uid += '0';
    uid += String(rfid->uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}
