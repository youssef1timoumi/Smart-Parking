// ============================================================================
//  card_dump_test.ino  —  STANDALONE: dump ALL MIFARE Classic sectors on a tap.
//  READ-ONLY (no writes) — safe, can't brick a card. Prints to Serial @115200.
//
//  Use this to SEE what's on the card: which sectors open with the default key
//  (FF FF FF FF FF FF) and which are PROTECTED with a different key.
//
//  Wiring: RC522  SS=GPIO5  RST=GPIO22  SCK=18  MISO=19  MOSI=23  VCC=3V3  GND
//  Library: MFRC522 (GithubCommunity).
// ============================================================================
#include <SPI.h>
#include <MFRC522.h>

#define RC522_SS   5
#define RC522_RST  22
MFRC522 rfid(RC522_SS, RC522_RST);
MFRC522::MIFARE_Key keyA;   // the key we try on every sector

void setup() {
  Serial.begin(115200);
  delay(200);
  SPI.begin();
  rfid.PCD_Init();
  delay(50);
  for (byte i = 0; i < 6; i++) keyA.keyByte[i] = 0xFF;   // default MIFARE key
  byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.printf("\n=== card_dump_test: MIFARE sector dump ===  (RC522 version 0x%02X)\n", v);
  Serial.println("Tap a MIFARE Classic 1K card to see all 16 sectors.\n");
}

void dumpSector(byte sector) {
  byte trailer = sector * 4 + 3;
  MFRC522::StatusCode st = (MFRC522::StatusCode)
      rfid.PCD_Authenticate(MFRC522::PICC_CMD_MF_AUTH_KEY_A, trailer, &keyA, &(rfid.uid));
  Serial.printf("Sector %2d  ", sector);
  if (st != MFRC522::STATUS_OK) {
    Serial.print("[PROTECTED] default key rejected (");
    Serial.print(rfid.GetStatusCodeName(st));
    Serial.println(")");
    return;   // a different key guards this sector
  }
  Serial.println("[open with default key]");
  for (byte b = 0; b < 4; b++) {
    byte addr = sector * 4 + b;
    byte buf[18]; byte size = sizeof(buf);
    MFRC522::StatusCode rs = (MFRC522::StatusCode) rfid.MIFARE_Read(addr, buf, &size);
    Serial.printf("   blk %2d: ", addr);
    if (rs != MFRC522::STATUS_OK) { Serial.print("read err ("); Serial.print(rfid.GetStatusCodeName(rs)); Serial.println(")"); continue; }
    for (byte i = 0; i < 16; i++) { if (buf[i] < 0x10) Serial.print('0'); Serial.print(buf[i], HEX); Serial.print(' '); }
    Serial.print(" | ");
    for (byte i = 0; i < 16; i++) { char c = buf[i]; Serial.print((c >= 32 && c < 127) ? c : '.'); }
    if (b == 3) Serial.print("   <- trailer (KeyA | access | KeyB)");
    Serial.println();
  }
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) { if (i) uid += ':'; if (rfid.uid.uidByte[i] < 0x10) uid += '0'; uid += String(rfid.uid.uidByte[i], HEX); }
  uid.toUpperCase();
  MFRC522::PICC_Type t = rfid.PICC_GetType(rfid.uid.sak);
  Serial.printf("================  CARD %s  (", uid.c_str());
  Serial.print(rfid.PICC_GetTypeName(t));
  Serial.println(")  ================");

  if (t == MFRC522::PICC_TYPE_MIFARE_1K) {
    for (byte s = 0; s < 16; s++) dumpSector(s);
  } else {
    Serial.println("Not a MIFARE Classic 1K — sector dump skipped.");
  }
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  Serial.println("================  end  ================\n");
  delay(1500);
}
