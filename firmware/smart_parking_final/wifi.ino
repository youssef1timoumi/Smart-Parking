/*
 * wifi — WiFi provisioning.
 *   loadCreds/saveCreds : remember the WiFi + online/offline mode in flash (NVS, "wifi").
 *   connectSTA          : join the saved WiFi (STA only, so the internet works).
 *   startConfigPortal   : no/failed WiFi -> AP "Fati Parking" + a setup page at
 *                         192.168.4.1 where you pick your network and type the
 *                         password. On save it stores it and restarts.
 */

void loadCreds() {
  prefs.begin("wifi", true);                 // read-only
  staSSID = prefs.getString("ssid", "");
  staPASS = prefs.getString("pass", "");
  savedOffline = prefs.getBool("offline", false);
  prefs.end();
  Serial.printf("[wifi] saved SSID: '%s'   saved mode: %s\n", staSSID.c_str(), savedOffline ? "OFFLINE" : "online");
}

// Remember online/offline across reboots.
void saveOfflineFlag(bool off) {
  prefs.begin("wifi", false);
  prefs.putBool("offline", off);
  prefs.end();
  savedOffline = off;
}

void saveCreds(const String& s, const String& p) {
  prefs.begin("wifi", false);                // read/write
  prefs.putString("ssid", s);
  prefs.putString("pass", p);
  prefs.putBool("offline", false);           // a new network = we want to go online
  prefs.end();
  Serial.printf("[wifi] saved new SSID: '%s'\n", s.c_str());
}

bool connectSTA() {
  WiFi.mode(WIFI_STA);                        // STA only -> keeps the device's internet working
  WiFi.begin(staSSID.c_str(), staPASS.c_str());
  lcdShow("Connecting WiFi", staSSID.c_str());
  Serial.printf("[wifi] joining '%s'  (type 'offline' to skip) ", staSSID.c_str());
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < WIFI_TIMEOUT_MS) {
    delay(300); Serial.print(".");
    handleSerial();                           // 'offline' works even while joining
    if (offline) { Serial.println(); return false; }
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] OK  IP=%s  RSSI=%d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    return true;
  }
  Serial.println("[wifi] FAILED to join.");
  return false;
}

String scanNetworksOptions() {
  int n = WiFi.scanNetworks();
  String o = "";
  for (int i = 0; i < n && i < 15; i++) {
    o += "<option value='" + WiFi.SSID(i) + "'>" + WiFi.SSID(i) + "  (" + String(WiFi.RSSI(i)) + " dBm)</option>";
  }
  if (n <= 0) o = "<option value=''>(no networks found — type it below)</option>";
  return o;
}

void handleRoot() {
  String html =
    "<!doctype html><html><head><meta charset=utf-8>"
    "<meta name=viewport content='width=device-width,initial-scale=1'>"
    "<title>Smart Parking setup</title><style>"
    "body{font-family:system-ui,sans-serif;max-width:430px;margin:24px auto;padding:0 16px;color:#16233a}"
    "h2{color:#0e1b2e}label{font-size:14px;color:#51607a;margin-top:10px;display:block}"
    "input,select,button{width:100%;padding:11px;margin:5px 0;font-size:16px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px}"
    "button{background:#3b7dff;color:#fff;border:0;font-weight:600;margin-top:14px}"
    ".cur{color:#51607a;font-size:13px;margin-top:16px}</style></head><body>"
    "<h2>Smart Parking — WiFi setup</h2>"
    "<form method=POST action=/save>"
    "<label>Pick a network</label><select name=ssid>" + scanNetworksOptions() + "</select>"
    "<label>…or type the name</label><input name=ssid2 placeholder='(optional) network name'>"
    "<label>Password</label><input name=pass type=password placeholder='WiFi password'>"
    "<button type=submit>Save &amp; connect</button></form>"
    "<p class=cur>Currently saved: " + (staSSID.length() ? staSSID : String("(none)")) + "</p>"
    "</body></html>";
  server.send(200, "text/html", html);
}

void handleSave() {
  String s = server.arg("ssid");
  String s2 = server.arg("ssid2"); if (s2.length()) s = s2;    // typed name wins
  String p = server.arg("pass");
  if (!s.length()) { server.send(200, "text/html", "<p>SSID is required. <a href='/'>back</a></p>"); return; }
  saveCreds(s, p);
  server.send(200, "text/html",
    "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'>"
    "<body style='font-family:sans-serif;max-width:430px;margin:40px auto;padding:0 16px'>"
    "<h3>Saved.</h3><p>The device will restart and connect to <b>" + s + "</b>.</p>"
    "<p>You can close this page.</p></body>");
  delay(1200);
  ESP.restart();
}

void startConfigPortal() {
  configMode = true;
  WiFi.mode(WIFI_AP_STA);                     // AP for the page + STA so scanning works
  WiFi.softAP(AP_SSID, AP_PASS);
  IPAddress ip = WiFi.softAPIP();
  Serial.println();
  Serial.println("================ WiFi SETUP MODE ================");
  Serial.printf("1) Join the hotspot '%s'  (password '%s')\n", AP_SSID, AP_PASS);
  Serial.printf("2) Open http://%s in a browser\n", ip.toString().c_str());
  Serial.println("3) Pick your WiFi, type the password, Save.");
  Serial.println("-- OR just type here:  ssid <name> / pass <pw> / connect");
  Serial.println("-- OR type:  offline   (run the gate with no WiFi, remembered until 'online')");
  Serial.println("=================================================");
  lcdShow("AP: Fati Parking", ("web " + ip.toString()).c_str());

  server.on("/", handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.onNotFound(handleRoot);              // any URL -> the setup page
  server.begin();
}
