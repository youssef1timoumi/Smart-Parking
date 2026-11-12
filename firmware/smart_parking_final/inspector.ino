/*
 * inspector — Card Inspector (dashboard "Scan a card" / "Write to a sector").
 *   The backend arms a job; the /api/slots reply carries it as "inspect":{...}.
 *   While armed, the next tap is ONLY inspected: no /api/access, no servo, no app.
 *   op "read"  : dump all 16 sectors with the factory key; `key` unlocks `sector`.
 *   op "write" : auth `sector` with `key`, write `data` (3 blocks, already encrypted
 *                by the server) and set the sector's key A/B to `newKey`.
 *   The result + dump go to POST /api/card-scan. Sector 0 is never written, and the
 *   access bits are always the standard FF 07 80 so a sector can't be bricked.
 */

void updateInspectJob(const String& r) {
  bool armed = r.indexOf("\"inspect\":{") >= 0;
  if (armed) {
    inspectOp = jsonString(r, "op");
    inspectSector = (int)jsonNumber(r, "sector");
    inspectKey = jsonString(r, "key");
    inspectNewKey = jsonString(r, "newKey");
    inspectData = jsonString(r, "data");
  }
  if (armed != inspectArmed) {
    inspectArmed = armed;
    if (armed) {
      Serial.printf("[inspect] armed: %s%s -> tap a card\n", inspectOp.c_str(),
                    inspectOp == "write" ? (" sector " + String(inspectSector)).c_str() : "");
      lcdShow("Card Inspector", inspectOp == "write" ? "Tap card: write" : "Tap card: read");
    } else {
      idleScreen();
    }
  }
}

static bool hexToBytes(const String& h, byte* out, int n) {
  if ((int)h.length() < n * 2) return false;
  for (int i = 0; i < n; i++) out[i] = (byte)strtol(h.substring(i * 2, i * 2 + 2).c_str(), nullptr, 16);
  return true;
}
static void keyFromHex(const String& h, MFRC522::MIFARE_Key& k) {
  if (!hexToBytes(h, k.keyByte, 6)) for (byte i = 0; i < 6; i++) k.keyByte[i] = 0xFF;   // factory key
}
static bool authSector(byte sector, MFRC522::MIFARE_Key& k) {
  return reader.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, sector * 4 + 3, &k, &reader.uid)
         == MFRC522::STATUS_OK;
}
// A failed auth puts the card to sleep: wake + select it again before the next sector.
static void reselectCard() {
  reader.PCD_StopCrypto1();
  byte atqa[2]; byte sz = sizeof(atqa);
  reader.PICC_WakeupA(atqa, &sz);
  reader.PICC_Select(&reader.uid, 0);
}

void doInspect(const String& uid) {
  MFRC522::PICC_Type t = reader.PICC_GetType(reader.uid.sak);
  String type = reader.PICC_GetTypeName(t);
  bool classic = (t == MFRC522::PICC_TYPE_MIFARE_1K);
  bool isWrite = (inspectOp == "write") && inspectSector >= 1 && inspectSector <= 15;
  bool wrote = false, keyChanged = false;
  String error = "";
  Serial.printf("[inspect] %s %s  op=%s sector=%d\n", uid.c_str(), type.c_str(), inspectOp.c_str(), inspectSector);
  lcdShow("Reading card...", "keep it still");

  MFRC522::MIFARE_Key defKey, jobKey, newKey;
  keyFromHex("", defKey);
  keyFromHex(inspectKey, jobKey);
  keyFromHex(inspectNewKey, newKey);

  // ---- write (encrypted data + new sector key) ----
  if (!classic) error = "not_mifare_1k";
  else if (isWrite) {
    byte data[48];
    if (!hexToBytes(inspectData, data, 48)) error = "bad_data";
    else if (!authSector(inspectSector, jobKey)) { error = "auth_failed"; reselectCard(); }
    else {
      wrote = true;
      for (byte b = 0; b < 3; b++)
        if (reader.MIFARE_Write(inspectSector * 4 + b, data + 16 * b, 16) != MFRC522::STATUS_OK) { wrote = false; break; }
      if (!wrote) error = "write_failed";
      else {
        byte tr[16];
        for (byte i = 0; i < 6; i++) { tr[i] = newKey.keyByte[i]; tr[10 + i] = newKey.keyByte[i]; }
        tr[6] = 0xFF; tr[7] = 0x07; tr[8] = 0x80; tr[9] = 0x69;     // standard access bits (never brick)
        keyChanged = reader.MIFARE_Write(inspectSector * 4 + 3, tr, 16) == MFRC522::STATUS_OK;
      }
    }
  }

  // ---- dump all 16 sectors ----
  String sectors = "[";
  if (classic) {
    for (byte s = 0; s < 16; s++) {
      if (s) sectors += ',';
      MFRC522::MIFARE_Key* k = &defKey;
      if ((int)s == inspectSector && inspectKey.length() && !isWrite) k = &jobKey;     // unlock with the code's key
      if ((int)s == inspectSector && isWrite) k = keyChanged ? &newKey : &jobKey;
      if (!authSector(s, *k)) {
        reselectCard();
        sectors += "{\"s\":" + String(s) + ",\"prot\":true,\"blocks\":[]}";
        continue;
      }
      sectors += "{\"s\":" + String(s) + ",\"prot\":false,\"blocks\":[";
      for (byte b = 0; b < 4; b++) {
        if (b) sectors += ',';
        byte buf[18]; byte size = sizeof(buf);
        if (reader.MIFARE_Read(s * 4 + b, buf, &size) != MFRC522::STATUS_OK) { sectors += "\"\""; continue; }
        String hex = "";
        for (byte i = 0; i < 16; i++) { if (buf[i] < 0x10) hex += '0'; hex += String(buf[i], HEX); }
        hex.toUpperCase();
        sectors += "\"" + hex + "\"";
      }
      sectors += "]}";
    }
  }
  sectors += "]";

  String body = String("{\"device\":\"") + DEVICE_ID + "\",\"uid\":\"" + uid + "\",\"type\":\"" + type +
                "\",\"op\":\"" + inspectOp + "\",\"sector\":" + inspectSector +
                ",\"wrote\":" + (wrote ? "true" : "false") + ",\"keyChanged\":" + (keyChanged ? "true" : "false") +
                ",\"error\":\"" + error + "\",\"sectors\":" + sectors + "}";
  httpPost("/api/card-scan", body, true);

  if (error.length()) lcdShow(isWrite ? "Write failed" : "Card read", error == "auth_failed" ? "Wrong code/key" : error.c_str());
  else if (isWrite) { char l1[17]; snprintf(l1, sizeof(l1), "Sector %d saved", inspectSector); lcdShow(l1, "Code: dashboard"); }
  else lcdShow("Card read", "See dashboard");
  Serial.printf("[inspect] done  wrote=%d keyChanged=%d error=%s\n", wrote, keyChanged, error.c_str());
  inspectArmed = false;                 // one tap = one inspection (the server disarms too)
  delay(2500);
  idleScreen();
}
