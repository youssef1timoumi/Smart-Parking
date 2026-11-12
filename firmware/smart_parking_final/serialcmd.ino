/*
 * serialcmd — type commands in the Serial Monitor (115200, line ending "Newline").
 *   help                 list commands
 *   scan                 list nearby WiFi networks
 *   ssid <name>          set the WiFi name  (spaces/apostrophes OK)
 *   pass <password>      set the WiFi password
 *   connect              save ssid+pass and connect (restarts)
 *   status               show the mode, WiFi and backend
 *   offline              run the gate WITHOUT WiFi (tap = entry/exit). Remembered after a reboot.
 *   online               leave offline and reconnect the saved WiFi (restarts)
 *   portal               open the WiFi setup page (hotspot "Fati Parking", 192.168.4.1)
 *   close                put both barriers back to closed
 *   clear                erase the saved WiFi (restarts into setup)
 */

void printHelp() {
  Serial.println(F("--- commands ---"));
  Serial.println(F("  scan                list WiFi networks"));
  Serial.println(F("  ssid <name>         set WiFi name (spaces ok)"));
  Serial.println(F("  pass <password>     set WiFi password"));
  Serial.println(F("  connect             save + connect"));
  Serial.println(F("  status              mode / WiFi / backend"));
  Serial.println(F("  offline             run the gate with NO WiFi (stays offline after reboot)"));
  Serial.println(F("  online              back online with the saved WiFi"));
  Serial.println(F("  portal              WiFi setup page (hotspot Fati Parking)"));
  Serial.println(F("  close               both barriers to closed"));
  Serial.println(F("  clear               erase saved WiFi"));
  Serial.println(F("----------------"));
}

void handleSerial() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  if (!line.length()) return;

  int sp = line.indexOf(' ');
  String cmd = (sp < 0) ? line : line.substring(0, sp);
  String arg = (sp < 0) ? ""   : line.substring(sp + 1);
  cmd.toLowerCase();

  if (cmd == "help") {
    printHelp();
  } else if (cmd == "scan") {
    Serial.println("[scan] scanning...");
    int n = WiFi.scanNetworks();
    if (n <= 0) Serial.println("[scan] no networks found.");
    for (int i = 0; i < n; i++)
      Serial.printf("  %2d) %-28s  %4d dBm  %s\n", i + 1, WiFi.SSID(i).c_str(), WiFi.RSSI(i),
                    WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "open" : "lock");
  } else if (cmd == "ssid") {
    pendSSID = arg;
    Serial.printf("[cfg] ssid set to '%s'\n", pendSSID.c_str());
  } else if (cmd == "pass") {
    pendPASS = arg;
    Serial.printf("[cfg] pass set (%d chars)\n", pendPASS.length());
  } else if (cmd == "connect") {
    if (!pendSSID.length()) { Serial.println("[cfg] set the name first:  ssid <name>"); return; }
    saveCreds(pendSSID, pendPASS);
    Serial.printf("[cfg] saved '%s'. restarting to connect...\n", pendSSID.c_str());
    delay(800); ESP.restart();
  } else if (cmd == "offline") {
    enterOffline(true);
  } else if (cmd == "online") {
    saveOfflineFlag(false);
    if (!staSSID.length()) { Serial.println("[online] no WiFi saved yet -> opening the setup portal."); offline = false; startConfigPortal(); return; }
    Serial.printf("[online] restarting to join '%s'...\n", staSSID.c_str());
    delay(500); ESP.restart();
  } else if (cmd == "portal") {
    saveOfflineFlag(false);
    offline = false;
    if (configMode) { Serial.println("[portal] already open."); return; }
    startConfigPortal();
  } else if (cmd == "close") {
    closeBarriers();
  } else if (cmd == "status") {
    Serial.printf("[status] mode=%s  saved ssid='%s'  wifi=%s",
                  offline ? "OFFLINE" : (configMode ? "SETUP PORTAL" : "ONLINE"), staSSID.c_str(),
                  WiFi.status() == WL_CONNECTED ? "connected" : "not connected");
    if (WiFi.status() == WL_CONNECTED) Serial.printf("  ip=%s rssi=%d", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    Serial.println();
    if (!offline && WiFi.status() == WL_CONNECTED)
      Serial.println(httpGet("/api/health", false).length() ? "[status] backend reachable" : "[status] backend NOT reachable");
  } else if (cmd == "clear") {
    prefs.begin("wifi", false); prefs.clear(); prefs.end();
    Serial.println("[cfg] saved WiFi erased. restarting into setup...");
    delay(500); ESP.restart();
  } else {
    Serial.printf("[?] unknown '%s'  (type help)\n", cmd.c_str());
  }
}

// Switch to offline: drop WiFi (no AP, no reconnects), keep the gate running locally.
// save=true remembers it in flash so a reboot comes straight back offline.
void enterOffline(bool save) {
  if (configMode) { server.stop(); configMode = false; }
  WiFi.softAPdisconnect(true);
  WiFi.setAutoReconnect(false);
  WiFi.disconnect();
  WiFi.mode(WIFI_STA);                 // radio stays usable for 'scan', but joins nothing
  offline = true;
  if (save) saveOfflineFlag(true);
  if (!readerReady) initReader();
  closeBarriers();
  idleScreen();
  Serial.println("[offline] gate running with NO WiFi. Tap a card (tap = entry, next tap = exit).");
  Serial.println("[offline] back online: 'online' (saved WiFi) or 'ssid'/'pass'/'connect' or 'portal'.");
}
