#include "Lcd.h"
#include "config.h"

#if LCD_ENABLED
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

static LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);

// Fold common UTF-8 Latin accents to ASCII and drop anything else non-ASCII,
// because the HD44780 character ROM can't display accented letters.
static String asciiFold(const String& in) {
  String out;
  out.reserve(in.length());
  for (size_t i = 0; i < in.length(); i++) {
    uint8_t c = (uint8_t)in[i];
    if (c < 0x80) { out += (char)c; continue; }
    if (c == 0xC3 && i + 1 < in.length()) {      // U+00C0..U+00FF (Latin-1 supplement)
      uint8_t n = (uint8_t)in[++i];
      char m = 0;
      if (n == 0xA9 || n == 0xA8 || n == 0xAA || n == 0xAB || n == 0x89 || n == 0x88) m = 'e'; // é è ê ë É È
      else if (n == 0xA0 || n == 0xA2 || n == 0xA4 || n == 0x80 || n == 0x82) m = 'a';         // à â ä À Â
      else if (n == 0xAE || n == 0xAF || n == 0xAC) m = 'i';                                   // î ï ì
      else if (n == 0xB4 || n == 0xB6 || n == 0xB2) m = 'o';                                   // ô ö ò
      else if (n == 0xB9 || n == 0xBB || n == 0xBC) m = 'u';                                   // ù û ü
      else if (n == 0xA7) m = 'c';                                                             // ç
      else m = ' ';
      out += m;
      continue;
    }
    // other multi-byte sequence: skip its continuation bytes
    if (c >= 0xC0) { while (i + 1 < in.length() && ((uint8_t)in[i + 1] & 0xC0) == 0x80) i++; }
  }
  return out;
}

static String fit(const String& s) {
  String a = asciiFold(s);
  return a.length() > LCD_COLS ? a.substring(0, LCD_COLS) : a;
}
#endif  // LCD_ENABLED

bool Lcd::begin() {
#if LCD_ENABLED
  // The LiquidCrystal_I2C library calls Wire.begin() with no arguments, which would
  // fall back to the default I2C pins (SDA=21, SCL=22) — and SCL=22 clashes with the
  // RC522 RST. setPins() makes that no-arg begin() use our custom pins instead.
  Wire.setPins(LCD_SDA_PIN, LCD_SCL_PIN);
  lcd.init();          // runs Wire.begin() internally, now on the pins we set above
  lcd.backlight();
  idle();
  bool ok = connected();
  Serial.printf("[LCD] %s on SDA=%d SCL=%d addr=0x%02X\n",
                ok ? "detected" : "NOT detected", LCD_SDA_PIN, LCD_SCL_PIN, LCD_ADDR);
  return ok;
#else
  return false;
#endif
}

bool Lcd::connected() {
#if LCD_ENABLED
  Wire.beginTransmission(LCD_ADDR);
  return Wire.endTransmission() == 0;   // 0 = the backpack ACKed its address
#else
  return false;
#endif
}

void Lcd::show(const String& l1, const String& l2) {
#if LCD_ENABLED
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(fit(l1));
  if (LCD_ROWS > 1) {
    lcd.setCursor(0, 1);
    lcd.print(fit(l2));
  }
#endif
}

void Lcd::idle() {
  show(LCD_TXT_IDLE1, LCD_TXT_IDLE2);
}
