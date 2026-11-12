/*
 * smart_parking_final — gate controller (multi-file project)
 * ==========================================================
 * Tabs:
 *   Config.h   — pins, constants, names
 *   (this)     — shared globals, HTTP helpers, setup(), loop()
 *   hardware   — LCD, servos, HC-SR04, RC522 helpers
 *   gate       — the gate flow (code window, entry/exit, slot reports)
 *   inspector  — Card Inspector (dump / write encrypted sectors, no gate action)
 *   wifi       — WiFi setup portal (AP + web page at 192.168.4.1, saved to flash)
 *
 * On boot: if a WiFi was saved, it connects and runs the gate. Otherwise (or if
 * it can't connect) it opens the setup portal: join the "Fati Parking" hotspot
 * on your PC/phone and browse to 192.168.4.1 to pick your WiFi.
 *
 * Libraries: MFRC522, LiquidCrystal_I2C, ESP32Servo (WiFi/WebServer/Preferences/HTTPClient built in).
 * Upload with RC522 unplugged, then plug it back (P5 strapping -> flash read err).
 */
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>
#include "Config.h"

// ---- shared globals (visible to every tab) ----
MFRC522 reader(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(LCD_ADDR, 16, 2);
Servo servo1, servo2;
Preferences prefs;
WebServer server(80);

String staSSID = "", staPASS = "";
bool configMode = false;
bool offline = false;          // 'offline' serial command -> run the gate with no WiFi
bool savedOffline = false;     // offline is remembered in flash until 'online' / 'connect'
bool readerReady = false;      // RC522 initialised?
String pendSSID = "", pendPASS = "";   // staged by the ssid/pass serial commands
int waterDry = 0;              // water sensor dry reading, measured at boot
bool raining = false;          // water sensor says rain -> only the covered Place 1
bool slot1Occ = false, slot2Occ = false;   // last HC-SR04 readings
// Card Inspector job from the backend (in the /api/slots reply). While armed, the next
// tap is ONLY inspected: no /api/access, no servo, nothing in the app.
bool inspectArmed = false;
String inspectOp = "", inspectKey = "", inspectNewKey = "", inspectData = "";
int inspectSector = -1;
String allowedCards = "";      // UIDs the admin set up (name + balance), saved in flash for OFFLINE mode
unsigned long lastCardsSync = 0;
unsigned long lastSlots = 0, lastPing = 0, lastStatus = 0, lastWifiTry = 0;

// ================= HTTP helpers =================
String httpPost(const String& path, const String& body, bool verbose) {
  if (WiFi.status() != WL_CONNECTED) { if (verbose) Serial.printf("[HTTP] POST %s  SKIPPED (no WiFi)\n", path.c_str()); return ""; }
  HTTPClient http; http.setConnectTimeout(3000); http.setTimeout(4000);
  http.begin(String(BACKEND) + path);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  String r = (code > 0) ? http.getString() : "";
  if (verbose) Serial.printf("[HTTP] POST %s -> %d  %s\n", path.c_str(), code, r.substring(0, 140).c_str());
  http.end();
  return r;
}
String httpGet(const String& path, bool verbose) {
  if (WiFi.status() != WL_CONNECTED) { if (verbose) Serial.printf("[HTTP] GET %s  SKIPPED (no WiFi)\n", path.c_str()); return ""; }
  HTTPClient http; http.setConnectTimeout(3000); http.setTimeout(4000);
  http.begin(String(BACKEND) + path);
  int code = http.GET();
  String r = (code > 0) ? http.getString() : "";
  if (verbose) Serial.printf("[HTTP] GET %s -> %d  %s\n", path.c_str(), code, r.substring(0, 140).c_str());
  http.end();
  return r;
}
String jsonString(const String& j, const char* key) {
  String pat = String("\"") + key + "\":\"";
  int i = j.indexOf(pat); if (i < 0) return "";
  i += pat.length(); int e = j.indexOf('"', i); if (e < 0) return "";
  return j.substring(i, e);
}
double jsonNumber(const String& j, const char* key) {
  String pat = String("\"") + key + "\":";
  int i = j.indexOf(pat); if (i < 0) return 0;
  i += pat.length(); while (i < (int)j.length() && j[i] == ' ') i++;
  int e = i; while (e < (int)j.length() && (isdigit(j[e]) || j[e] == '-' || j[e] == '.')) e++;
  return j.substring(i, e).toDouble();
}

// ================= setup / loop =================
void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println();
  Serial.println(F("=== Smart Parking — gate controller ==="));
  Serial.println(F("Type 'help' for serial commands. Type 'offline' any time to run with NO WiFi."));
  randomSeed(micros());

  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.init(); lcd.backlight();
  initHardware();                 // servos to closed, sensor pins
  lcdShow("Smart Parking", "Starting...");

  loadCreds();                    // WiFi + the saved mode, from flash (NVS)
  loadAllowedCards();             // last known approved cards (used when OFFLINE)
  if (savedOffline) {             // 'offline' was chosen before: stay offline, no WiFi at all
    enterOffline(false);
    return;
  }
  if (staSSID.length() && connectSTA()) {
    initReader();
    String h = httpGet("/api/health", true);
    Serial.println(h.length() ? "Backend REACHABLE." : "Backend NOT reachable (no internet?) -> type 'offline' to run without it.");
    syncAllowedCards();           // refresh the offline copy of the approved cards
    lastCardsSync = millis();
    closeBarriers();              // WiFi is up: re-assert closed in case the radio start knocked them
    idleScreen();
    Serial.println("Ready (ONLINE). Tap a card.");
  } else if (offline) {           // 'offline' typed while it was trying to join
    return;
  } else {
    startConfigPortal();          // no/!connect -> setup page at 192.168.4.1
    closeBarriers();
  }
}

void loop() {
  handleSerial();                       // always listen for typed commands

  if (offline) {                        // run the gate locally, no backend
    if (reader.PICC_IsNewCardPresent() && reader.PICC_ReadCardSerial()) {
      String uid = uidStr();
      Serial.printf("[CARD] %s\n", uid.c_str());
      handleCardOffline(uid);
      reader.PICC_HaltA();
      return;
    }
    if (millis() - lastSlots >= SLOT_REPORT_MS) { lastSlots = millis(); reportSlots(false); }   // print only, no HTTP
    return;
  }

  if (configMode) { server.handleClient(); return; }

  if (WiFi.status() != WL_CONNECTED && millis() - lastWifiTry > 5000) {
    lastWifiTry = millis();
    WiFi.begin(staSSID.c_str(), staPASS.c_str());
  }

  if (reader.PICC_IsNewCardPresent() && reader.PICC_ReadCardSerial()) {
    String uid = uidStr();
    Serial.printf("[CARD] %s\n", uid.c_str());
    if (inspectArmed) doInspect(uid);   // Card Inspector: read/write sectors only, no gate action
    else handleCard(uid);
    reader.PICC_HaltA();
    reader.PCD_StopCrypto1();
    return;
  }

  unsigned long now = millis();
  if (now - lastStatus >= 3000) {
    lastStatus = now;
    if (WiFi.status() == WL_CONNECTED)
      Serial.printf("[wifi] connected  IP=%s  RSSI=%d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    else
      Serial.printf("[wifi] DOWN (reconnecting to '%s')\n", staSSID.c_str());
  }
  if (now - lastSlots >= SLOT_REPORT_MS) { lastSlots = now; reportSlots(true); }
  if (now - lastPing  >= PING_MS)  { lastPing = now; httpPost("/api/ping", pingBody(), false); }
  if (now - lastCardsSync >= CARDS_SYNC_MS) { lastCardsSync = now; syncAllowedCards(); }
}
