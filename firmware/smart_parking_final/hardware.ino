/*
 * hardware — LCD, servos, HC-SR04 sensors, RC522 helpers.
 * Uses the globals (reader, lcd, servo1/2) and the Config.h constants.
 */

// ---------- LCD ----------
void lcdShow(const char* l1, const char* l2) {
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(l1);
  lcd.setCursor(0, 1); lcd.print(l2);
}
void idleScreen() { lcdShow("Fati Parking", raining ? "Rain: 1 place" : "Scan your card"); }

// ---------- init ----------
void initHardware() {
  pinMode(S1_TRIG, OUTPUT); pinMode(S1_ECHO, INPUT);
  pinMode(S2_TRIG, OUTPUT); pinMode(S2_ECHO, INPUT);
  calibrateWater();
  servo1.setPeriodHertz(50); servo2.setPeriodHertz(50);
  servo1.attach(SERVO1_PIN, 500, 2400); servo2.attach(SERVO2_PIN, 500, 2400);
  closeBarriers();
}
// Both barriers to their closed angle and hold. Called at boot, after WiFi/setup
// is up (the radio start can sag the 5V and knock the arms), and on 'offline'.
void closeBarriers() {
  if (!servo1.attached()) servo1.attach(SERVO1_PIN, 500, 2400);
  if (!servo2.attached()) servo2.attach(SERVO2_PIN, 500, 2400);
  servo1.write(S1_CLOSED); servo2.write(S2_CLOSED);
  delay(700);                                        // give the arms time to get there
  Serial.printf("[servo] closed: S1(P%d)=%d  S2(P%d)=%d\n", SERVO1_PIN, S1_CLOSED, SERVO2_PIN, S2_CLOSED);
}
void initReader() {
  SPI.begin();
  reader.PCD_Init();
  byte v = reader.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.printf("RC522 version: 0x%02X %s\n", v, (v == 0 || v == 0xFF) ? "(BAD)" : "(ok)");
  readerReady = true;
}

// ---------- RFID uid ----------
String uidStr() {
  String s = "";
  for (byte i = 0; i < reader.uid.size; i++) {
    if (reader.uid.uidByte[i] < 0x10) s += "0";
    s += String(reader.uid.uidByte[i], HEX);
    if (i + 1 < reader.uid.size) s += ":";
  }
  s.toUpperCase();
  return s;
}

// ---------- servos ----------
void sweepTo(Servo& s, int from, int to) {
  int st = (to >= from) ? 2 : -2;
  for (int a = from; (st > 0) ? (a <= to) : (a >= to); a += st) { s.write(a); delay(15); }
  s.write(to);
}
void cycleBarrier(Servo& s, int closed, int open) {
  sweepTo(s, closed, open);
  delay(BARRIER_HOLD_MS);
  sweepTo(s, open, closed);
}

// ---------- ultrasonic ----------
long readCm(int trig, int echo) {
  digitalWrite(trig, LOW);  delayMicroseconds(3);
  digitalWrite(trig, HIGH); delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long dur = pulseIn(echo, HIGH, 30000);
  if (dur == 0) return -1;
  return dur / 58;
}

// ---------- water / rain ----------
void calibrateWater() {
  long sum = 0;
  for (int i = 0; i < 20; i++) { sum += analogRead(WATER_PIN); delay(10); }
  waterDry = sum / 20;
  Serial.printf("[water] dry baseline = %d  (rain at >= %d)\n", waterDry, waterDry + WATER_WET_DELTA);
}
// Reads the comb and updates 'raining' (with hysteresis so it doesn't flicker).
int readWater() {
  int raw = analogRead(WATER_PIN);
  bool was = raining;
  if (!raining && raw >= waterDry + WATER_WET_DELTA) raining = true;
  else if (raining && raw < waterDry + WATER_DRY_DELTA) raining = false;
  if (raining != was) idleScreen();          // LCD shows "Rain: 1 place" while it rains
  if (raining != was) Serial.printf("[water] %s (raw %d) -> %s\n", raining ? "RAIN" : "dry", raw,
                                    raining ? "only the covered Place 1 is available" : "both places available");
  return raw;
}

// ---------- health report (dashboard Hardware page) ----------
// Each ping says which parts answer: LCD on I2C, RC522 on SPI, servos' PWM attached.
bool lcdPresent() { Wire.beginTransmission(LCD_ADDR); return Wire.endTransmission() == 0; }
bool rfidPresent() {
  if (!readerReady) return false;
  byte v = reader.PCD_ReadRegister(MFRC522::VersionReg);
  return v != 0x00 && v != 0xFF;
}
String pingBody() {
  return String("{\"device\":\"") + DEVICE_ID + "\",\"ip\":\"" + WiFi.localIP().toString() +
         "\",\"rssi\":" + WiFi.RSSI() + ",\"uptimeMs\":" + millis() +
         ",\"lcd\":" + (lcdPresent() ? 1 : 0) + ",\"rfid\":" + (rfidPresent() ? 1 : 0) +
         ",\"servo1\":" + (servo1.attached() ? 1 : 0) + ",\"servo2\":" + (servo2.attached() ? 1 : 0) + "}";
}

// ---------- misc ----------
// The LCD has no accents: "Carte bloquée" -> "Carte bloquee".
String lcdAscii(String s) {
  const char* from[] = {"é","è","ê","à","â","ç","ô","î","û","ù","É","—"};
  const char* to[]   = {"e","e","e","a","a","c","o","i","u","u","E","-"};
  for (int i = 0; i < 12; i++) s.replace(from[i], to[i]);
  return s;
}
String durShort(long sec) {
  long m = sec / 60, s = sec % 60; char b[16];
  if (m > 0) snprintf(b, sizeof(b), "%ldm %02lds", m, s);
  else       snprintf(b, sizeof(b), "%lds", s);
  return String(b);
}
