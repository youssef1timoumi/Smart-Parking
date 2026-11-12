// Smart Parking RFID — ESP32 controller
// Task 1: WiFi auto-connect + periodic ping to the backend.
// Task 2: read MIFARE card UID via RC522.
// Task 3: on each tap, ask the backend to decide (/api/access) and obey allow/deny.
//         The backend is the source of truth; the card only carries its UID.
// Task 5 (LCD slice): show Welcome/Goodbye + name on a tap, then the credit after 5 s.
// Edit WiFi / backend / pin / LCD settings in config.h.

#include <WiFi.h>
#include <HTTPClient.h>
#include "config.h"
#include "WiFiManager.h"
#include "CardReader.h"
#include "Lcd.h"

WiFiManager wifi(WIFI_SSID, WIFI_PASSWORD, WIFI_RETRY_INTERVAL_MS);
CardReader reader(RC522_SS_PIN, RC522_RST_PIN, CARD_REPEAT_IGNORE_MS);
Lcd lcd;
unsigned long lastPing = 0;
unsigned long lastSlotReport = 0;

// Non-blocking "show the credit (or the mobile-app code) 5 s after the welcome" scheduler.
bool creditPending = false;
unsigned long creditAt = 0;
String creditLine;   // second-screen line: "Credit:" value on EXIT
String codeLine;     // on ENTRY: the 6-digit code the driver types into the mobile app ("" = none)

// ---- Card Inspector state (solde on a protected MIFARE sector) ----
MFRC522::MIFARE_Key cardKey;        // our secret key for the solde sector
MFRC522::MIFARE_Key defKey;         // factory default FF FF FF FF FF FF
bool inspectArmed = false;          // admin asked to inspect the next card
long inspectSetSolde = -1;          // cents to write on the card (-1 = just read)
unsigned long lastInspectPoll = 0;

// POST a JSON body to BACKEND_URL + path. Returns the response body ("" on failure).
String postJson(const char* path, const String& body) {
  HTTPClient http;
  String url = String(BACKEND_URL) + path;
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");

  String reply = "";
  int code = http.POST(body);
  if (code > 0) {
    reply = http.getString();
    Serial.printf("[HTTP] POST %s -> %d  %s\n", url.c_str(), code, reply.c_str());
  } else {
    Serial.printf("[HTTP] POST %s failed: %s\n", url.c_str(), http.errorToString(code).c_str());
  }
  http.end();
  return reply;
}

// HTTP GET BACKEND_URL + path. Returns the body ("" on failure).
String httpGet(const char* path) {
  HTTPClient http;
  http.begin(String(BACKEND_URL) + path);
  http.setTimeout(HTTP_TIMEOUT_MS);
  String reply = "";
  int code = http.GET();
  if (code > 0) reply = http.getString();
  http.end();
  return reply;
}

// Minimal JSON readers (flat objects only, which is all /api/access returns).
String jsonString(const String& json, const char* key) {
  String needle = String("\"") + key + "\":\"";
  int i = json.indexOf(needle);
  if (i < 0) return "";
  i += needle.length();
  int j = json.indexOf('"', i);
  return j < 0 ? "" : json.substring(i, j);
}
// Reads "key": <number>  (returns "" if absent/null).
String jsonNumber(const String& json, const char* key) {
  String needle = String("\"") + key + "\":";
  int i = json.indexOf(needle);
  if (i < 0) return "";
  i += needle.length();
  while (i < (int)json.length() && json[i] == ' ') i++;
  int s = i;
  while (i < (int)json.length()) {
    char c = json[i];
    if ((c >= '0' && c <= '9') || c == '.' || c == '-') i++; else break;
  }
  return i > s ? json.substring(s, i) : "";
}

#if SENSORS_ENABLED
// One HC-SR04 reading in cm; -1 on timeout (nothing in range).
float readDistanceCm(int trig, int echo) {
  digitalWrite(trig, LOW);  delayMicroseconds(3);
  digitalWrite(trig, HIGH); delayMicroseconds(10);
  digitalWrite(trig, LOW);
  unsigned long us = pulseIn(echo, HIGH, 25000UL);
  return us == 0 ? -1.0 : (us * 0.0343) / 2.0;
}
// Median of 3 quick readings (HC-SR04 can be jumpy).
float slotDistanceCm(int trig, int echo) {
  float a = readDistanceCm(trig, echo); delay(30);
  float b = readDistanceCm(trig, echo); delay(30);
  float c = readDistanceCm(trig, echo);
  return a + b + c - max(a, max(b, c)) - min(a, min(b, c));
}
bool slotOccupied(int trig, int echo) {
  float d = slotDistanceCm(trig, echo);
  return (d > 0 && d < SLOT_OCCUPIED_CM);
}
// Measure both slots and report occupancy to the backend.
void reportSlots() {
  bool s1 = slotOccupied(S1_TRIG_PIN, S1_ECHO_PIN);
  bool s2 = slotOccupied(S2_TRIG_PIN, S2_ECHO_PIN);
  Serial.printf("[SLOTS] Slot1=%s  Slot2=%s\n", s1 ? "CAR" : "free", s2 ? "CAR" : "free");
  postJson("/api/slots", String("{\"device\":\"") + DEVICE_ID +
           "\",\"slots\":[{\"id\":1,\"occupied\":" + (s1 ? "true" : "false") +
           "},{\"id\":2,\"occupied\":" + (s2 ? "true" : "false") + "}]}");
}
#endif

/* ======================================================================
   CARD INSPECTOR — dump sectors + read/write the solde on a protected sector.
   Only writes DATA blocks (and, on a fresh card, the sector key) — never other
   sectors' trailers, to avoid bricking.
   ====================================================================== */
bool authSector(byte sector, MFRC522::MIFARE_Key* k) {
  MFRC522* r = reader.raw();
  return r->PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, sector * 4 + 3, k, &(r->uid))
         == MFRC522::STATUS_OK;
}

// Balance in cents from the solde block. -1 = can't read (locked by unknown key).
long readSoldeCents() {
  MFRC522* r = reader.raw();
  bool ok = authSector(CARD_SOLDE_SECTOR, &cardKey);
  if (!ok) ok = authSector(CARD_SOLDE_SECTOR, &defKey);
  if (!ok) return -1;
  byte buf[18]; byte size = sizeof(buf);
  if (r->MIFARE_Read(CARD_SOLDE_BLOCK, buf, &size) != MFRC522::STATUS_OK) return -1;
  if (buf[4] != 'S' || buf[5] != 'O' || buf[6] != 'L' || buf[7] != 'D') return 0;  // not set yet
  return ((long)buf[0] << 24) | ((long)buf[1] << 16) | ((long)buf[2] << 8) | (long)buf[3];
}

// Write the balance and (on a fresh card) lock the sector with our secret key.
bool writeSoldeCents(long cents) {
  MFRC522* r = reader.raw();
  bool viaCustom = authSector(CARD_SOLDE_SECTOR, &cardKey);
  bool viaDefault = viaCustom ? false : authSector(CARD_SOLDE_SECTOR, &defKey);
  if (!viaCustom && !viaDefault) return false;            // locked by an unknown key
  byte data[16] = {0};
  data[0] = (cents >> 24) & 0xFF; data[1] = (cents >> 16) & 0xFF;
  data[2] = (cents >> 8) & 0xFF;  data[3] = cents & 0xFF;
  data[4] = 'S'; data[5] = 'O'; data[6] = 'L'; data[7] = 'D';
  if (r->MIFARE_Write(CARD_SOLDE_BLOCK, data, 16) != MFRC522::STATUS_OK) return false;
  if (viaDefault) {   // provision our key on this sector's trailer (keep standard access bits)
    byte tr[16];
    for (byte i = 0; i < 6; i++) tr[i] = cardKey.keyByte[i];       // Key A
    tr[6] = 0xFF; tr[7] = 0x07; tr[8] = 0x80; tr[9] = 0x69;        // transport access bits
    for (byte i = 0; i < 6; i++) tr[10 + i] = cardKey.keyByte[i];  // Key B
    r->MIFARE_Write(CARD_SOLDE_SECTOR * 4 + 3, tr, 16);            // non-fatal if it fails
  }
  return true;
}

// JSON dump of all 16 sectors (protected ones have empty blocks).
String dumpSectorsJson() {
  MFRC522* r = reader.raw();
  String out = "[";
  for (byte s = 0; s < 16; s++) {
    if (s) out += ',';
    bool ok = authSector(s, &cardKey);
    if (!ok) ok = authSector(s, &defKey);
    if (!ok) { out += "{\"s\":" + String(s) + ",\"prot\":true,\"blocks\":[]}"; continue; }
    out += "{\"s\":" + String(s) + ",\"prot\":false,\"blocks\":[";
    for (byte b = 0; b < 4; b++) {
      if (b) out += ',';
      byte buf[18]; byte size = sizeof(buf);
      if (r->MIFARE_Read(s * 4 + b, buf, &size) != MFRC522::STATUS_OK) { out += "\"\""; continue; }
      String hex = "";
      for (byte i = 0; i < 16; i++) { if (buf[i] < 0x10) hex += '0'; hex += String(buf[i], HEX); }
      hex.toUpperCase();
      out += "\"" + hex + "\"";
    }
    out += "]}";
  }
  out += "]";
  return out;
}

// Ask the backend whether an inspect is armed (and any solde to write).
void pollInspect() {
  String r = httpGet("/api/inspect-poll");
  if (r.length() == 0) return;
  inspectArmed = r.indexOf("\"armed\":true") >= 0;
  String ss = inspectArmed ? jsonNumber(r, "setSolde") : "";
  inspectSetSolde = ss.length() ? ss.toInt() : -1;
}

// Called when an inspect is armed: read the card fully (and write solde if asked).
void doInspect() {
  if (!reader.selectCard()) return;   // wait until a card is on the reader
  String uid = reader.uidString();
  MFRC522* r = reader.raw();
  MFRC522::PICC_Type t = r->PICC_GetType(r->uid.sak);
  bool classic = (t == MFRC522::PICC_TYPE_MIFARE_1K);

  bool wrote = false;
  if (classic && inspectSetSolde >= 0) wrote = writeSoldeCents(inspectSetSolde);
  long cents = classic ? readSoldeCents() : -1;
  String sectors = classic ? dumpSectorsJson() : "[]";
  reader.releaseCard();

  String type = String(r->PICC_GetTypeName(t));
  Serial.printf("[INSPECT] %s  solde=%ld cents  wrote=%d\n", uid.c_str(), cents, wrote);
  postJson("/api/card-scan", String("{\"device\":\"") + DEVICE_ID + "\",\"uid\":\"" + uid +
           "\",\"type\":\"" + type + "\",\"cardSolde\":" + cents +
           ",\"wrote\":" + (wrote ? "true" : "false") + ",\"sectors\":" + sectors + "}");

  if (classic) {
    char buf[20]; snprintf(buf, sizeof(buf), "%.2f DT", cents < 0 ? 0.0 : cents / 100.0);
    lcd.show(wrote ? "Solde ecrit" : "Carte lue", cents < 0 ? "(protegee)" : buf);
  } else {
    lcd.show("Carte lue", "non MIFARE 1K");
  }
  inspectArmed = false;
  inspectSetSolde = -1;
}

void pingBackend() {
  postJson("/api/ping", String("{\"device\":\"") + DEVICE_ID +
                        "\",\"ip\":\"" + WiFi.localIP().toString() +
                        "\",\"rssi\":" + WiFi.RSSI() +
                        ",\"uptimeMs\":" + millis() +
                        ",\"lcd\":" + (lcd.connected() ? "true" : "false") + "}");
}

String formatCredit(const String& balanceStr) {
  char buf[20];
  snprintf(buf, sizeof(buf), "%.2f DT", balanceStr.toFloat());
  return String(buf);
}

// Send the tapped UID to the backend and act on the allow/deny reply.
void requestAccess(const String& uid, const String& type) {
  creditPending = false;  // a new tap cancels a queued credit screen
  String reply = postJson("/api/access", String("{\"device\":\"") + DEVICE_ID +
                          "\",\"uid\":\"" + uid + "\",\"type\":\"" + type + "\"}");
  if (reply.length() == 0) {
    Serial.println("[ACCESS] no reply from backend");
    lcd.show("Backend error", "Try again");
    return;
  }

  bool allow = reply.indexOf("\"allow\":true") >= 0;
  String owner = jsonString(reply, "owner");
  String message = jsonString(reply, "message");
  String action = jsonString(reply, "action");         // ENTRY | EXIT (when allowed)
  String balance = jsonNumber(reply, "balance");
  String code = jsonString(reply, "code");              // 6-digit login code for the mobile app (ENTRY only)

  if (allow) {
    String name = owner.length() ? owner : String(LCD_TXT_NONAME);
    const char* head = (action == "EXIT") ? LCD_TXT_BYE : LCD_TXT_WELCOME;
    Serial.printf("[ACCESS] ALLOW (%s) : %s\n", action.c_str(), message.c_str());
    if (code.length()) {
      // Show the code big on the serial monitor so the driver can type it into the app.
      Serial.println("========================================");
      Serial.printf ("   CODE APPLI MOBILE : %s\n", code.c_str());
      Serial.printf ("   Ouvrez %s/app et entrez ce code\n", BACKEND_URL);
      Serial.println("========================================");
    }
    lcd.show(head, name);                               // phase 1: Welcome/Goodbye + name
    codeLine = code;                                    // phase 2 shows the code on ENTRY...
    creditLine = balance.length() ? formatCredit(balance) : "";   // ...or the credit on EXIT
    creditPending = true;                               // phase 2 in LCD_WELCOME_MS
    creditAt = millis() + LCD_WELCOME_MS;
    // TODO (rest of Task 5): open the servo barrier, update the 4-digit display.
  } else {
    Serial.printf("[ACCESS] DENY : %s\n", message.c_str());
    lcd.show(LCD_TXT_DENIED, message);                  // show the refusal reason
    // TODO (rest of Task 5): keep the barrier closed.
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== Smart Parking ESP32 — boot ===");
  lcd.begin();
  reader.begin();
  for (byte i = 0; i < 6; i++) defKey.keyByte[i] = 0xFF;
  { byte ck[] = CARD_KEY_BYTES; for (byte i = 0; i < 6; i++) cardKey.keyByte[i] = ck[i]; }
#if SENSORS_ENABLED
  pinMode(S1_TRIG_PIN, OUTPUT); pinMode(S1_ECHO_PIN, INPUT);
  pinMode(S2_TRIG_PIN, OUTPUT); pinMode(S2_ECHO_PIN, INPUT);
  digitalWrite(S1_TRIG_PIN, LOW); digitalWrite(S2_TRIG_PIN, LOW);
#endif
  wifi.begin();
}

void loop() {
  wifi.handle();

  // Ask the backend if the admin armed a card inspection.
  if (wifi.isConnected() && millis() - lastInspectPoll >= INSPECT_POLL_MS) {
    lastInspectPoll = millis();
    pollInspect();
  }

  if (inspectArmed) {
    // Inspector mode: read the whole card (and write solde if asked), no gate decision.
    doInspect();
  } else {
    String uid, type;
    if (reader.poll(uid, type)) {
      Serial.printf("[CARD] UID=%s  type=%s\n", uid.c_str(), type.c_str());
      if (wifi.isConnected()) {
        requestAccess(uid, type);
      } else {
        Serial.println("[CARD] WiFi down — not sent.");
        lcd.show("No WiFi", "Try again");
      }
    }
  }

  // Non-blocking switch from the welcome screen to the second screen:
  // the mobile-app code on entry, otherwise the remaining credit.
  if (creditPending && (long)(millis() - creditAt) >= 0) {
    creditPending = false;
    if (codeLine.length()) lcd.show(LCD_TXT_CODE, codeLine);
    else lcd.show(LCD_TXT_CREDIT, creditLine.length() ? creditLine : "--");
  }

  if (wifi.isConnected() && millis() - lastPing >= PING_INTERVAL_MS) {
    lastPing = millis();
    pingBackend();
  }

#if SENSORS_ENABLED
  if (wifi.isConnected() && millis() - lastSlotReport >= SLOT_REPORT_MS) {
    lastSlotReport = millis();
    reportSlots();
  }
#endif

  delay(10);
}
