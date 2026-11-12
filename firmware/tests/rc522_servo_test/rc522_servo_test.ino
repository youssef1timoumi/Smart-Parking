/*
 * rc522_servo_test.ino — combined test: RC522 + two SG90 servos
 * -------------------------------------------------------------
 * NOT part of the main project. Proves the reader AND the two barrier
 * servos are wired right and work together (SPI + PWM at the same time).
 *
 * Behaviour: tap a card -> print its UID -> a barrier opens for 2 s, then
 * closes. Taps ALTERNATE between the two servos (tap 1 = entry/P27,
 * tap 2 = exit/P14, ...) so each tap moves only ONE servo = kinder to the
 * 5V supply, and two taps test both servos.
 *
 * Libraries (install both via Manage Libraries):
 *   - "MFRC522" by GithubCommunity
 *   - "ESP32Servo" by Kevin Harrington / John K. Bennett
 *
 * Wiring (your board's labels):
 *   RC522: SDA->P5  SCK->P18  MOSI->P23  MISO->P19  RST->P22  3.3V->3V3  GND->GND
 *   Servo 1 (entry): orange->P27 , red->BB3 5V , brown->BB3 GND
 *   Servo 2 (exit) : orange->P16 , red->BB3 5V , brown->BB3 GND
 *   Common ground everywhere. Upload at 115200 (no pins 0/1 used).
 */

#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>

// ---- RC522 ----
#define SS_PIN   5
#define RST_PIN  22
MFRC522 reader(SS_PIN, RST_PIN);

// ---- Servos ----
const int SERVO1_PIN = 27;   // entry barrier (P27)
const int SERVO2_PIN = 16;   // exit  barrier (P16)  — moved off P14 (P14 sits next to the
                             // flash-voltage strapping pin P12, which caused a boot-loop)
const int CLOSED_DEG = 0;
const int OPEN_DEG   = 90;
Servo servo1, servo2;

unsigned long tapCount = 0;

void moveBarrier(Servo& s, const char* name) {
  Serial.printf("   %s: opening\n", name);
  for (int a = CLOSED_DEG; a <= OPEN_DEG; a += 2) { s.write(a); delay(15); }
  delay(2000);                                  // stay open 2 s
  Serial.printf("   %s: closing\n", name);
  for (int a = OPEN_DEG; a >= CLOSED_DEG; a -= 2) { s.write(a); delay(15); }
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println(F("=== RC522 + 2 servos combined test ==="));

  // RC522
  SPI.begin();                       // SCK=18, MISO=19, MOSI=23 (ESP32 default)
  reader.PCD_Init();
  delay(50);
  byte v = reader.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print(F("RC522 firmware version: 0x"));
  Serial.println(v, HEX);
  if (v == 0x00 || v == 0xFF)
    Serial.println(F(">> BAD: reader not responding (check 3.3V, GND, SDA/RST/SPI)."));
  else
    Serial.println(F(">> RC522 OK."));

  // Servos
  servo1.setPeriodHertz(50);
  servo2.setPeriodHertz(50);
  servo1.attach(SERVO1_PIN, 500, 2400);
  servo2.attach(SERVO2_PIN, 500, 2400);
  servo1.write(CLOSED_DEG);
  servo2.write(CLOSED_DEG);

  Serial.println(F("Ready. Tap a card to open a barrier..."));
  Serial.println();
}

void loop() {
  if (!reader.PICC_IsNewCardPresent()) return;
  if (!reader.PICC_ReadCardSerial()) return;

  Serial.print(F("UID:"));
  for (byte i = 0; i < reader.uid.size; i++) {
    Serial.print(reader.uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(reader.uid.uidByte[i], HEX);
  }
  Serial.print(F("   Type: "));
  Serial.println(reader.PICC_GetTypeName(reader.PICC_GetType(reader.uid.sak)));

  // Alternate which barrier moves (one servo per tap).
  if (tapCount % 2 == 0) moveBarrier(servo1, "Servo 1 / P27 (entry)");
  else                   moveBarrier(servo2, "Servo 2 / P16 (exit)");
  tapCount++;

  reader.PICC_HaltA();
  delay(400);
}
