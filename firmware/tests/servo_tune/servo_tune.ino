/*
 * servo_tune.ino — interactive direction/angle finder for the two barriers
 * ------------------------------------------------------------------------
 * Move each servo by hand (from the Serial Monitor) to discover which way it
 * turns and the right open/closed angles. Then tell me the numbers and I'll
 * set them in the real firmware.
 *
 * Library: ESP32Servo.
 * Pins:  Servo 1 (entry) = P27 ,  Servo 2 (exit) = P16
 *
 * Open the Serial Monitor @ 115200, set line ending to "Newline", and type:
 *     1+      servo 1 up   5 deg
 *     1-      servo 1 down 5 deg
 *     2+      servo 2 up   5 deg
 *     2-      servo 2 down 5 deg
 *     1 90    servo 1 straight to 90 deg   (any 0..180)
 *     2 0     servo 2 straight to 0 deg
 *     ?       print both current angles
 */

#include <ESP32Servo.h>

const int SERVO1_PIN = 27;   // entry
const int SERVO2_PIN = 16;   // exit
const int STEP = 5;

Servo servo1, servo2;
int angle1 = 90;
int angle2 = 90;

void apply() {
  servo1.write(angle1);
  servo2.write(angle2);
  Serial.printf("Servo1(P27) = %3d deg   |   Servo2(P16) = %3d deg\n", angle1, angle2);
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println(F("=== Servo tuning ==="));
  Serial.println(F("Commands:  1+  1-  2+  2-   |   1 90   2 0   |   ?"));
  Serial.println(F("(set Serial Monitor line ending to \"Newline\")"));

  servo1.setPeriodHertz(50);
  servo2.setPeriodHertz(50);
  servo1.attach(SERVO1_PIN, 500, 2400);
  servo2.attach(SERVO2_PIN, 500, 2400);
  apply();
}

void loop() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  if (cmd.length() == 0) return;

  if (cmd == "?") { apply(); return; }

  char w = cmd.charAt(0);
  if (w != '1' && w != '2') { Serial.println(F("start with 1 or 2 (or ?)")); return; }

  int* ang = (w == '1') ? &angle1 : &angle2;
  String rest = cmd.substring(1);
  rest.trim();

  if      (rest == "+") *ang += STEP;
  else if (rest == "-") *ang -= STEP;
  else if (rest.length() && isDigit(rest.charAt(0))) *ang = rest.toInt();
  else { Serial.println(F("use + , - , or a number 0..180")); return; }

  *ang = constrain(*ang, 0, 180);
  apply();
}
