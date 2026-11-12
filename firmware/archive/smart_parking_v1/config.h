// ============================================================
//  config.h — the ONE place to edit for your setup
// ============================================================
#pragma once

// ---- WiFi (2.4 GHz only — the ESP32 cannot join 5 GHz networks) ----
// OFFLINE DEMO: set these to your laptop's Mobile Hotspot name + password
// (Windows: Settings > Mobile hotspot > Edit; pick the 2.4 GHz band there).
#define WIFI_SSID      "YOUR_WIFI_SSID"
#define WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"

// ---- Backend (pick ONE, no trailing slash) ----
// A) VPS / the website (ESP32 needs internet on the WiFi above). Plain http on
//    purpose: nginx serves /api/ over http for the ESP32; you open the dashboard at
//    https://smartreiner.duckdns.org/home
#define BACKEND_URL    "http://smartreiner.duckdns.org"
// B) OFFLINE DEMO via laptop hotspot (run `npm start` on the laptop, hotspot on):
// #define BACKEND_URL    "http://192.168.137.1:3000"
// C) Same-WiFi PC (run `npm start`, find the IP with `ipconfig`):
// #define BACKEND_URL    "http://192.168.100.55:3000"

// Identifies this controller in backend logs / dashboard.
#define DEVICE_ID      "esp32-gate-1"

// ---- RC522 pins (SPI uses ESP32 defaults: SCK=18, MISO=19, MOSI=23) ----
#define RC522_SS_PIN   5
#define RC522_RST_PIN  22
#define CARD_REPEAT_IGNORE_MS   3000   // same card ignored for this long

// ---- MIFARE solde on the card (Card Inspector) ----
// The balance is written into a protected sector of the MIFARE Classic card and
// mirrored on the server. Sector 0 is reserved, so we use sector 1, block 4.
#define CARD_SOLDE_SECTOR  1
#define CARD_SOLDE_BLOCK   4            // = sector 1, block 0 (absolute block address 4)
// Secret 6-byte key that protects the solde sector (Key A & Key B). Change for your own.
#define CARD_KEY_BYTES     { 0x53, 0x50, 0x41, 0x52, 0x4B, 0x31 }   // "SPARK1"
#define INSPECT_POLL_MS    1500         // how often to ask the server if an inspect is armed

// ---- HC-SR04 slot sensors (powered at 5V; Echo via a divider -> 3.3V) ----
#define SENSORS_ENABLED  1          // set 0 if no sensors wired
#define S1_TRIG_PIN  26             // Slot 1 (covered)
#define S1_ECHO_PIN  25
#define S2_TRIG_PIN  33             // Slot 2 (outdoor)  — Trig on P33 (away from flash pin P12)
#define S2_ECHO_PIN  32
#define SLOT_OCCUPIED_CM   8.0      // closer than this = a car is in the slot (tune for your model)
#define SLOT_REPORT_MS     1500     // how often to measure + report slot occupancy

// ---- I2C LCD (16x2 with I2C backpack: GND / VCC / SDA / SCL) ----
// Set to 0 to compile without the LiquidCrystal_I2C library (no LCD wired yet).
#define LCD_ENABLED    1
// NOTE: the usual I2C pins are SDA=21, SCL=22, but GPIO22 is taken by RC522 RST,
// so the LCD uses custom I2C pins below. SCL is on P17 (not P4) because P4 sits next
// to the boot pin P0 — a slip there breaks flashing. P17 has no boot pin beside it.
#define LCD_SDA_PIN    21
#define LCD_SCL_PIN    17
#define LCD_ADDR       0x27    // most backpacks are 0x27; some are 0x3F (run an I2C scanner if blank)
#define LCD_COLS       16
#define LCD_ROWS       2
#define LCD_WELCOME_MS 5000    // show the name for this long, then show the credit

// LCD wording (ASCII only — the HD44780 can't show accents; names are accent-folded).
#define LCD_TXT_IDLE1    "Smart Parking"
#define LCD_TXT_IDLE2    "Scan your card"
#define LCD_TXT_WELCOME  "Welcome"
#define LCD_TXT_BYE      "Goodbye"
#define LCD_TXT_CREDIT   "Credit:"
#define LCD_TXT_CODE     "App code:"   // entry: the 6-digit code to type into the mobile app
#define LCD_TXT_DENIED   "Denied:"
#define LCD_TXT_NONAME   "No name"     // shown when the card has no owner set

// ---- Timing ----
#define PING_INTERVAL_MS        5000   // how often to ping the backend
#define WIFI_RETRY_INTERVAL_MS  5000   // wait between reconnect attempts
#define HTTP_TIMEOUT_MS         4000
