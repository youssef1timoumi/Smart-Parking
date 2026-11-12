// WiFiManager — auto-connect on boot + auto-reconnect when the link drops.
// (Our own small module; not the third-party "WiFiManager" library.)
#pragma once
#include <Arduino.h>

class WiFiManager {
public:
  WiFiManager(const char* ssid, const char* password, unsigned long retryIntervalMs);

  // Call once in setup(). Blocks up to timeoutMs waiting for the first connection.
  void begin(unsigned long timeoutMs = 15000);

  // Call every loop(). Non-blocking; reconnects if the connection dropped.
  void handle();

  bool isConnected() const;

private:
  const char* _ssid;
  const char* _password;
  unsigned long _retryIntervalMs;
  unsigned long _lastAttempt = 0;
  bool _wasConnected = false;

  void printStatus();
};
