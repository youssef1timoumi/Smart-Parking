/*
 * water_sensor_test.ino — analog water / rain sensor on the ESP32
 * ---------------------------------------------------------------
 * NOT part of the main project. Reads the sensor's analog output and
 * prints a raw value (0..4095) + a DRY / DAMP / WET state.
 *
 * Wiring (3 pins: S, +, -):
 *   S  (signal) -> ESP32 P34   (analog-in, input-only pin)
 *   +  (VCC)    -> 3V3         (3.3V on purpose, so S stays within the ADC range)
 *   -  (GND)    -> GND
 *
 * Powered at 3V3 means the analog output never exceeds ~3.3V -> safe for the
 * ESP32 ADC, no divider needed.
 *
 * How to read it: DRY comb ~ a low number. Drip water across the comb and the
 * number jumps up. Watch the Serial values to pick your own threshold later.
 */

const int WATER_PIN = 34;      // S -> P34
int dryBaseline = 0;

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println(F("=== Water sensor test ==="));

  analogReadResolution(12);    // ESP32 ADC = 0..4095

  // Measure the dry baseline at startup (keep the comb dry for this).
  long sum = 0;
  for (int i = 0; i < 20; i++) { sum += analogRead(WATER_PIN); delay(10); }
  dryBaseline = sum / 20;
  Serial.print(F("Dry baseline: "));
  Serial.println(dryBaseline);
  Serial.println(F("Now drip water across the comb and watch the value rise..."));
  Serial.println();
}

void loop() {
  int raw = analogRead(WATER_PIN);

  const char* state;
  if      (raw < dryBaseline + 150) state = "DRY";
  else if (raw < 1800)              state = "DAMP";
  else                              state = "WET";

  Serial.printf("water = %4d   %s\n", raw, state);
  delay(500);
}
