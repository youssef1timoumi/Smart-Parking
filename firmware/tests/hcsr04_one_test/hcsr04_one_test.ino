/*
 * hcsr04_one_test.ino — ONE HC-SR04 (Slot 1) on the ESP32
 * -------------------------------------------------------
 * Proves a single ultrasonic sensor + its Echo divider before doing both.
 * Prints the distance (cm) and FREE / OCCUPIED continuously.
 *
 * Wiring (your board's labels):
 *   HC-SR04 VCC  -> 5V rail
 *   HC-SR04 GND  -> common GND rail
 *   HC-SR04 Trig -> P26            (direct)
 *   HC-SR04 Echo -> 1k/2k divider -> P25   (NEVER straight to the ESP32)
 */

const int TRIG_PIN = 26;        // Slot 1 Trig  (P26)
const int ECHO_PIN = 25;        // Slot 1 Echo  (P25, via divider)
const float OCCUPIED_CM = 8.0;  // nearer than this = a car is parked

long readCm() {
  digitalWrite(TRIG_PIN, LOW);  delayMicroseconds(3);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long dur = pulseIn(ECHO_PIN, HIGH, 30000);   // timeout ~5 m
  if (dur == 0) return -1;                     // no echo back
  return dur / 58;                             // microseconds -> cm
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println(F("=== HC-SR04 single-sensor test (Slot 1) ==="));
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.println(F("Wave your hand in front of the sensor..."));
}

void loop() {
  long cm = readCm();
  if (cm < 0) {
    Serial.println(F("Slot 1: --   (no echo)  -> check 5V, GND, Trig/Echo + divider"));
  } else {
    Serial.print(F("Slot 1: "));
    Serial.print(cm);
    Serial.print(F(" cm  "));
    Serial.println(cm <= OCCUPIED_CM ? F("[OCCUPIED]") : F("[FREE]"));
  }
  delay(300);
}
