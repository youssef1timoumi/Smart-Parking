// CardReader — RC522 (MFRC522) over SPI. UID reads + low-level access for the
// Card Inspector (sector dump / solde read-write).
#pragma once
#include <Arduino.h>
#include <MFRC522.h>

class CardReader {
public:
  CardReader(uint8_t ssPin, uint8_t rstPin, unsigned long repeatIgnoreMs);

  // Call once in setup(). Returns false if the RC522 doesn't answer (check wiring).
  bool begin();

  // Call every loop(). Returns true when a NEW card is presented; UID in `uid`
  // (uppercase hex, e.g. "DE:AD:BE:EF") and card type in `type`.
  bool poll(String& uid, String& type);

  // ---- low-level, for the inspector (card stays active until releaseCard) ----
  MFRC522* raw();            // the underlying driver (null before begin)
  bool selectCard();         // select a present card and keep it active
  void releaseCard();        // halt + stop crypto
  String uidString();        // UID of the currently selected card ("AA:BB:..")

private:
  uint8_t _ssPin, _rstPin;
  unsigned long _repeatIgnoreMs;
  String _lastUid;
  unsigned long _lastReadAt = 0;
};
