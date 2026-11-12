/*
 * Config.h — all the pins, constants and names in one place.
 * Edit here; the other tabs (smart_parking_final, hardware, gate, wifi) use these.
 */
#pragma once

// ---- Backend ----
#define BACKEND    "http://smartreiner.duckdns.org"   // plain http for the device
#define DEVICE_ID  "esp32-gate-1"

// ---- WiFi setup portal (shown when there's no saved WiFi, or it can't connect) ----
#define AP_SSID    "Fati Parking"
#define AP_PASS    "smartparking123"
#define WIFI_TIMEOUT_MS 15000     // how long to try joining before falling back to the portal

// ---- RC522 (RFID) ----
#define SS_PIN     5
#define RST_PIN    22

// ---- LCD 16x2 I2C ----
#define I2C_SDA    21
#define I2C_SCL    17
#define LCD_ADDR   0x27

// ---- Servos (calibrated barrier angles) ----
#define SERVO1_PIN 27
#define S1_CLOSED  30
#define S1_OPEN    95     // GUESS after the arm was re-seated (same ~65 deg travel) — confirm on the board
#define SERVO2_PIN 16
#define S2_CLOSED  85
#define S2_OPEN    0
#define BARRIER_HOLD_MS 4000

// ---- HC-SR04 slot sensors ----
#define S1_TRIG    26
#define S1_ECHO    25
#define S2_TRIG    33
#define S2_ECHO    32
#define OCCUPIED_CM 8.0

// ---- Water / rain sensor (analog) : S->P34, +->3V3, -->GND ----
// Dry level is measured at boot (keep the comb DRY when powering on).
// Rain = reading >= dry + WATER_WET_DELTA; it clears below dry + WATER_DRY_DELTA.
// When it rains only the covered Place 1 is offered (Place 2 is outdoor).
#define WATER_PIN       34
#define WATER_WET_DELTA 150
#define WATER_DRY_DELTA 100

// ---- Timing ----
#define CODE_WINDOW_SEC 20        // 5 s shown + 15 s grace for the code
#define SLOT_REPORT_MS  1500
#define PING_MS         5000
#define CARDS_SYNC_MS   30000     // refresh the offline list of approved cards
