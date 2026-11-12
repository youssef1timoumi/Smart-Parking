/*
 * servo_test.ino — standalone test for two SG90 servos on the ESP32
 * -----------------------------------------------------------------
 * NOT part of the main project. Just proves the two barrier servos are
 * wired and powered correctly, before we add barrier code to the firmware.
 *
 * Library: "ESP32Servo" by Kevin Harrington / John K. Bennett.
 *          Arduino IDE -> Manage Libraries -> search "ESP32Servo".
 *          (The plain Arduino "Servo" library does NOT work on ESP32.)
 *
 * Wiring (each SG90):
 *   Brown  -> BB3 GND rail   (shared with the ESP32's common ground!)
 *   Red    -> BB3 5V rail    (ideally its OWN 5V supply, not the ESP32 5V)
 *   Orange -> ESP32 signal pin:  Servo 1 = P27 ,  Servo 2 = P14
 *
 * The test moves ONE servo at a time (gentler on the power supply) so you
 * can see each one work. If the board keeps resetting, the servos are
 * browning it out -> give BB3 its own 5V supply.
 */

#include <ESP32Servo.h>

const int SERVO1_PIN = 27;   // entry barrier  (your board: P27)
const int SERVO2_PIN = 14;   // exit barrier   (your board: P14)

const int CLOSED_DEG = 0;    // barrier down
const int OPEN_DEG   = 90;   // barrier up

Servo servo1;
Servo servo2;

void sweep(Servo& s, const char* name) {
  Serial.printf("[%s] close -> open\n", name);
  for (int a = CLOSED_DEG; a <= OPEN_DEG; a += 2) { s.write(a); delay(20); }
  delay(600);
  Serial.printf("[%s] open -> close\n", name);
  for (int a = OPEN_DEG; a >= CLOSED_DEG; a -= 2) { s.write(a); delay(20); }
  delay(600);
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println(F("=== Two-servo wiring test ==="));

  servo1.setPeriodHertz(50);          // standard 50 Hz servo frame
  servo2.setPeriodHertz(50);
  servo1.attach(SERVO1_PIN, 500, 2400);   // min/max pulse (us) for SG90
  servo2.attach(SERVO2_PIN, 500, 2400);

  servo1.write(CLOSED_DEG);
  servo2.write(CLOSED_DEG);
  Serial.println(F("Both set to CLOSED. Starting sweep..."));
  delay(800);
}

void loop() {
  sweep(servo1, "Servo 1 / P27");   // one at a time = kinder to the 5V supply
  sweep(servo2, "Servo 2 / P14");
  delay(800);
}
