/*
 * gate — the parking gate flow + slot reporting.
 *   TAP (ENTRY) -> code on LCD + 20 s window (poll gate-status) -> entry barrier.
 *   TAP (EXIT)  -> duration + cost on LCD -> exit barrier.
 *   APP "Quit parking" -> the /api/slots reply carries "exit" -> same LCD + exit barrier.
 */

// ---------- approved cards (for OFFLINE mode) ----------
// Online, the gate downloads the UIDs that have a name + balance (/api/gate/cards)
// and keeps them in flash, so offline it can still refuse every other card.
void loadAllowedCards() {
  prefs.begin("cards", true);
  allowedCards = prefs.getString("list", "");
  prefs.end();
  Serial.printf("[cards] %d approved card(s) saved for offline mode\n", allowedCount());
}
void syncAllowedCards() {
  String r = httpGet("/api/gate/cards", false);
  if (r.indexOf("\"ok\":true") < 0) return;          // no answer: keep the saved list
  String list = jsonString(r, "uids");
  if (list == allowedCards) return;
  allowedCards = list;
  prefs.begin("cards", false);
  prefs.putString("list", allowedCards);
  prefs.end();
  Serial.printf("[cards] approved list updated: %d card(s)\n", allowedCount());
}
bool cardAllowed(const String& uid) {
  return allowedCards.length() && ("," + allowedCards + ",").indexOf("," + uid + ",") >= 0;
}
int allowedCount() {
  if (!allowedCards.length()) return 0;
  int n = 1;
  for (unsigned i = 0; i < allowedCards.length(); i++) if (allowedCards[i] == ',') n++;
  return n;
}

// Shows the code + countdown, polls the backend; true if the code was claimed in time.
bool runCodeWindow(const String& code) {
  char l1[17], l2[17];
  for (int t = CODE_WINDOW_SEC; t > 0; t--) {
    snprintf(l1, sizeof(l1), "Code: %s", code.c_str());
    snprintf(l2, sizeof(l2), "App login: %2ds", t);
    lcdShow(l1, l2);
    String s = httpGet("/api/gate-status?code=" + code, false);
    if (s.indexOf("\"claimed\":true") >= 0) return true;
    delay(1000);
  }
  return false;
}

void handleCard(const String& uid) {
  String body = String("{\"device\":\"") + DEVICE_ID + "\",\"uid\":\"" + uid + "\",\"type\":\"MIFARE 1KB\"}";
  String resp = httpPost("/api/access", body, true);
  if (resp.length() == 0) {
    Serial.println("[HTTP] no answer from the backend -> type 'offline' to run the gate without it.");
    lcdShow("Backend error", "try again"); delay(1500); idleScreen(); return;
  }

  bool allow = resp.indexOf("\"allow\":true") >= 0;
  String action = jsonString(resp, "action");
  String message = lcdAscii(jsonString(resp, "message"));

  if (!allow) {
    Serial.printf("[DENY] %s : %s\n", uid.c_str(), message.c_str());
    if (jsonString(resp, "reason") == "unknown") lcdShow("Unknown card", uid.c_str());   // no name / no balance / not registered
    else lcdShow("Denied", message.c_str());
    delay(2500); idleScreen(); return;           // no barrier moves
  }

  if (action == "ENTRY") {
    String code = jsonString(resp, "code");
    Serial.printf("[ENTRY] %s  code=%s\n", uid.c_str(), code.c_str());
    bool claimed = runCodeWindow(code);
    Serial.println(claimed ? "  -> app mode" : "  -> no-app paid");
    lcdShow(claimed ? "App connected" : "No-app parking", "Barrier opening");
    cycleBarrier(servo1, S1_CLOSED, S1_OPEN);
  } else {  // EXIT
    long durationSec = (long)jsonNumber(resp, "durationSec");
    double cost = jsonNumber(resp, "cost");
    Serial.printf("[EXIT] %s  %lds  cost=%.2f TND\n", uid.c_str(), durationSec, cost);
    char l1[17], l2[17];
    snprintf(l1, sizeof(l1), "Time: %s", durShort(durationSec).c_str());
    snprintf(l2, sizeof(l2), "Cost: %.2f TND", cost);
    lcdShow(l1, l2);
    cycleBarrier(servo2, S2_CLOSED, S2_OPEN);
    delay(2500);
  }
  idleScreen();
}

// OFFLINE mode: no backend. Tap alternates entry/exit; the code is generated locally.
void handleCardOffline(const String& uid) {
  static unsigned long taps = 0;
  // Only cards the admin set up (name + balance), from the list saved while online.
  if (!cardAllowed(uid)) {
    Serial.printf("[OFFLINE DENY] %s  unknown card (not in the saved list of %d cards)\n", uid.c_str(), allowedCount());
    lcdShow("Unknown card", uid.c_str());
    delay(2500); idleScreen(); return;         // no barrier, tap not counted
  }
  bool entry = (taps % 2 == 0);
  if (entry && raining && slot1Occ) {          // rain: only the covered Place 1 counts, and it's taken
    Serial.printf("[OFFLINE DENY] %s  rain + covered place taken\n", uid.c_str());
    lcdShow("Parking full", "Rain: 1 place");
    delay(2500); idleScreen(); return;         // tap not counted: next tap is still an entry
  }
  if (entry) {
    char code[7]; snprintf(code, sizeof(code), "%06ld", random(0, 1000000));
    Serial.printf("[OFFLINE ENTRY] %s  code=%s\n", uid.c_str(), code);
    char l1[17]; snprintf(l1, sizeof(l1), "Code: %s", code);
    lcdShow(l1, "Entry (offline)");
    cycleBarrier(servo1, S1_CLOSED, S1_OPEN);
  } else {
    Serial.printf("[OFFLINE EXIT] %s\n", uid.c_str());
    lcdShow("Goodbye", "Exit (offline)");
    cycleBarrier(servo2, S2_CLOSED, S2_OPEN);
  }
  taps++;
  idleScreen();
}

// Read both slot sensors + the rain sensor; online also sends them to the backend (dashboard + app).
void reportSlots(bool send) {
  long c1 = readCm(S1_TRIG, S1_ECHO), c2 = readCm(S2_TRIG, S2_ECHO);
  bool o1 = (c1 > 0 && c1 <= OCCUPIED_CM), o2 = (c2 > 0 && c2 <= OCCUPIED_CM);
  slot1Occ = o1; slot2Occ = o2;
  int water = readWater();
  Serial.printf("[slots] S1=%ld cm %s | S2=%ld cm %s | water=%d %s\n", c1, o1 ? "OCC" : "free", c2, o2 ? "OCC" : "free",
                water, raining ? "RAIN" : "dry");
  // cm = -1 means no echo (sensor not answering) -> the dashboard shows it as a fault.
  String body = String("{\"device\":\"") + DEVICE_ID +
                "\",\"slots\":[{\"id\":1,\"occupied\":" + (o1 ? "true" : "false") + ",\"cm\":" + String(c1) +
                "},{\"id\":2,\"occupied\":" + (o2 ? "true" : "false") + ",\"cm\":" + String(c2) + "}]" +
                ",\"rain\":" + (raining ? "true" : "false") + ",\"water\":" + String(water) + "}";
  if (!send) return;
  String r = httpPost("/api/slots", body, false);
  if (r.length()) updateInspectJob(r);
  // The driver pressed "Quit parking" in the app: the backend already billed the exit,
  // the gate just shows it and opens the exit barrier (no card tap needed).
  if (r.indexOf("\"exit\":{") >= 0) {
    long durationSec = (long)jsonNumber(r, "durationSec");
    double cost = jsonNumber(r, "cost");
    Serial.printf("[EXIT via app] %lds  cost=%.2f TND\n", durationSec, cost);
    char l1[17], l2[17];
    snprintf(l1, sizeof(l1), "Time: %s", durShort(durationSec).c_str());
    snprintf(l2, sizeof(l2), "Cost: %.2f TND", cost);
    lcdShow(l1, l2);
    cycleBarrier(servo2, S2_CLOSED, S2_OPEN);
    delay(2500);
    idleScreen();
  }
}
