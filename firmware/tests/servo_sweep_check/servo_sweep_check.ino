/*
 * servo_sweep_check.ino — "are the servos alive?" check
 * -----------------------------------------------------
 * A servo gives NO feedback, so software can't detect if it's wired/powered.
 * This just forces BIG full sweeps (0 <-> 180), one servo at a time, and tells
 * you on Serial which one to watch. If it doesn't move during its turn, that
 * servo has a power/ground/signal problem (not a code problem).
 *
 * Library: ESP32Servo.
 * Pins: Servo 1 = P27 , Servo 2 = P16
 */

#include <ESP32Servo.h>

const int SERVO1_PIN = 27;
const int SERVO2_PIN = 16;
Servo servo1, servo2;

void fullSweep(Servo& s, const char* name) {
  Serial.printf(">>> WATCH %s now — sweeping 0..180 three times\n", name);
  for (int rep = 0; rep < 3; rep++) {
    for (int a = 0; a <= 180; a += 3) { s.write(a); delay(12); }
    for (int a = 180; a >= 0; a -= 3) { s.write(a); delay(12); }
  }
  s.write(90);
  Serial.printf("    (%s done — did it move?)\n", name);
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println(F("=== Servo sweep check ==="));
  servo1.setPeriodHertz(50);
  servo2.setPeriodHertz(50);
  servo1.attach(SERVO1_PIN, 500, 2400);
  servo2.attach(SERVO2_PIN, 500, 2400);
  servo1.write(90);
  servo2.write(90);
  delay(800);
}

void loop() {
  fullSweep(servo1, "SERVO 1 (P27, entry)");
  delay(1000);
  fullSweep(servo2, "SERVO 2 (P16, exit)");
  delay(1500);
}
