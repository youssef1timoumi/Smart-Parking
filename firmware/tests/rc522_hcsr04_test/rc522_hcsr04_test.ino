// ============================================================================
//  rc522_hcsr04_test.ino  —  STANDALONE hardware test (not the main project sketch)
//  Tests: RC522 RFID reader  +  two HC-SR04 ultrasonic sensors.
//  No WiFi / no backend — just prints to the Serial Monitor at 115200.
//
//  Wiring (mostly as you had it; only Sensor 2 Trig moved P27 -> P33, because
//  P27 is 2 holes from the flash pin P12 and was causing "flash read err"):
//    RC522   SS=GPIO5  RST=GPIO22  SCK=18  MISO=19  MOSI=23   VCC=3V3  GND
//    HC-SR04 #1 (Slot 1):  Trig=GPIO26  Echo=GPIO25  VCC=3V3  GND
//    HC-SR04 #2 (Slot 2):  Trig=GPIO33  Echo=GPIO32  VCC=3V3  GND
//  Keep P27, P14 and P12 EMPTY. (Sensors at 3.3V -> Echo is 3.3V, no resistors.)
//
//  Library needed: MFRC522 (GithubCommunity) — you already have it.
// ============================================================================

#include <SPI.h>
#include <MFRC522.h>

// ---- RC522 pins ----
#define RC522_SS   5
#define RC522_RST  22
MFRC522 rfid(RC522_SS, RC522_RST);

// ---- HC-SR04 pins (S2 Trig moved off P27 -> P33, away from flash pin P12) ----
#define S1_TRIG  26
#define S1_ECHO  25
#define S2_TRIG  33
#define S2_ECHO  32

// A slot counts as "occupied" when something is closer than this (tune for your model).
const float OCCUPIED_CM = 8.0;
// Max echo wait (~4 m). Keeps the loop snappy if nothing is in front.
const unsigned long ECHO_TIMEOUT_US = 25000;

unsigned long lastDistAt = 0;

// One HC-SR04 reading in cm. Returns -1 on timeout (nothing / too far).
float readDistanceCm(int trig, int echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(3);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  unsigned long us = pulseIn(echo, HIGH, ECHO_TIMEOUT_US);
  if (us == 0) return -1.0;            // no echo
  return (us * 0.0343) / 2.0;          // speed of sound -> distance
}

// Median of 3 quick readings (HC-SR04 can be jumpy).
float distanceCm(int trig, int echo) {
  float a = readDistanceCm(trig, echo); delay(40);
  float b = readDistanceCm(trig, echo); delay(40);
  float c = readDistanceCm(trig, echo);
  // simple median
  float hi = max(a, max(b, c));
  float lo = min(a, min(b, c));
  return a + b + c - hi - lo;
}

void printSlot(const char* name, float cm) {
  Serial.printf("  %s: ", name);
  if (cm < 0) Serial.print("-- (no echo)      ");
  else        Serial.printf("%6.1f cm  ", cm);
  bool occupied = (cm > 0 && cm < OCCUPIED_CM);
  Serial.println(occupied ? "[CAR PRESENT]" : "[free]");
}

void checkCard() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (i) uid += ':';
    if (rfid.uid.uidByte[i] < 0x10) uid += '0';
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  Serial.printf(">>> CARD  UID=%s  type=%s\n", uid.c_str(),
                rfid.PICC_GetTypeName(rfid.PICC_GetType(rfid.uid.sak)));
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== rc522_hcsr04_test: RC522 + 2x HC-SR04 ===");

  // RC522
  SPI.begin();                 // ESP32 VSPI: SCK=18, MISO=19, MOSI=23
  rfid.PCD_Init();
  delay(50);
  byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  if (v == 0x00 || v == 0xFF)
    Serial.printf("[RC522] NOT detected (version 0x%02X) — check wiring.\n", v);
  else
    Serial.printf("[RC522] detected, firmware 0x%02X.\n", v);

  // HC-SR04
  pinMode(S1_TRIG, OUTPUT); pinMode(S1_ECHO, INPUT);
  pinMode(S2_TRIG, OUTPUT); pinMode(S2_ECHO, INPUT);
  digitalWrite(S1_TRIG, LOW); digitalWrite(S2_TRIG, LOW);

  Serial.println("Tap a card any time. Distances print every ~1 s.\n");
}

void loop() {
  // Card taps are checked continuously (so a tap is never missed).
  checkCard();

  // Distances about once a second.
  if (millis() - lastDistAt >= 1000) {
    lastDistAt = millis();
    float d1 = distanceCm(S1_TRIG, S1_ECHO);
    float d2 = distanceCm(S2_TRIG, S2_ECHO);
    Serial.println("--- slots ---");
    printSlot("Slot 1", d1);
    printSlot("Slot 2", d2);
  }

  delay(10);
}
