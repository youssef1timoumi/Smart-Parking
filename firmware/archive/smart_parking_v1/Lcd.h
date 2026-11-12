// Lcd — thin wrapper around a 16x2 I2C LCD (HD44780 + PCF8574 backpack).
// Disabled cleanly (compiles without the LiquidCrystal_I2C library) when
// LCD_ENABLED is 0 in config.h.
#pragma once
#include <Arduino.h>

class Lcd {
public:
  bool begin();                               // true if the LCD answers on I2C
  bool connected();                           // live I2C probe (false if disabled/absent)
  void idle();                                // default "Scan your card" screen
  void show(const String& l1, const String& l2 = "");  // two lines, truncated to fit
};
