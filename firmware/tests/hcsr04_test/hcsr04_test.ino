/*
 * hcsr04_test.ino — the two parking-slot ultrasonic sensors
 * ---------------------------------------------------------
 * Reads both HC-SR04 and prints the distance (cm) + FREE/OCCUPIED for each slot.
 * Standalone, to prove the sensors + dividers before folding them into the firmware.
 *
 * Wiring (your board's labels):
 *   HC-SR04 #1 (Slot 1): VCC->5V  GND->common GND  Trig->P26  Echo->(divider)->P25
 *   HC-SR04 #2 (Slot 2): VCC->5V  GND->common GND  Trig->P33  Echo->(divider)->P32
 *   Echo MUST go through a 1k/2k divider (5V -> 3.3V). Trig goes direct.
 *
 * A car closer than OCCUPIED_CM counts as parked (tune to your model).
 */

const int S1_TRIG = 26, S1_ECHO = 25;   // Slot 1
const int S2_TRIG = 33, S2_ECHO = 32;   // Slot 2
const float OCCUPIED_CM = 8.0;          // nearer than this = occupied

long readCm(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);  delayMicroseconds(3);
  digitalWrite(trigPin, HIGH); delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long dur = pulseIn(echoPin, HIGH, 30000);   // timeout ~5 m
  if (dur == 0) return -1;                    // no echo
  return dur / 58;                            // microseconds -> cm
}

void printSlot(const char* name, long cm) {
  Serial.print(name);
  if (cm < 0) { Serial.print(": --   (no echo)"); return; }
  Serial.print(": ");
  Serial.print(cm);
  Serial.print(" cm  ");
  Serial.print(cm <= OCCUPIED_CM ? "[OCCUPIED]" : "[FREE]");
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println(F("=== HC-SR04 two-slot test ==="));
  pinMode(S1_TRIG, OUTPUT); pinMode(S1_ECHO, INPUT);
  pinMode(S2_TRIG, OUTPUT); pinMode(S2_ECHO, INPUT);
  Serial.println(F("Wave your hand in front of a sensor to see it change."));
}

void loop() {
  long c1 = readCm(S1_TRIG, S1_ECHO);
  delay(60);                                  // let the echo settle between sensors
  long c2 = readCm(S2_TRIG, S2_ECHO);

  printSlot("Slot 1", c1);
  Serial.print("   |   ");
  printSlot("Slot 2", c2);
  Serial.println();

  delay(300);
}
