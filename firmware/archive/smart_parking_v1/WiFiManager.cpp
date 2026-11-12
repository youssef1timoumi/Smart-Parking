#include "WiFiManager.h"
#include <WiFi.h>

WiFiManager::WiFiManager(const char* ssid, const char* password, unsigned long retryIntervalMs)
  : _ssid(ssid), _password(password), _retryIntervalMs(retryIntervalMs) {}

void WiFiManager::begin(unsigned long timeoutMs) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  Serial.printf("[WiFi] Connecting to \"%s\"", _ssid);
  WiFi.begin(_ssid, _password);
  _lastAttempt = millis();

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < timeoutMs) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();

  if (isConnected()) {
    _wasConnected = true;
    printStatus();
  } else {
    Serial.println("[WiFi] Not connected yet — will keep retrying in the background.");
  }
}

void WiFiManager::handle() {
  bool connected = isConnected();

  if (connected && !_wasConnected) {
    Serial.println("[WiFi] Reconnected.");
    printStatus();
  } else if (!connected && _wasConnected) {
    Serial.println("[WiFi] Connection lost.");
  }
  _wasConnected = connected;

  if (!connected && millis() - _lastAttempt >= _retryIntervalMs) {
    _lastAttempt = millis();
    Serial.printf("[WiFi] Retrying \"%s\"...\n", _ssid);
    WiFi.disconnect();
    WiFi.begin(_ssid, _password);
  }
}

bool WiFiManager::isConnected() const {
  return WiFi.status() == WL_CONNECTED;
}

void WiFiManager::printStatus() {
  Serial.printf("[WiFi] Connected. IP=%s  RSSI=%d dBm\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());
}
