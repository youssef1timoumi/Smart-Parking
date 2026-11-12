# Smart Parking — wiring guide (ESP32 maquette)

A step-by-step for wiring the components onto the 3D parking board. Pins come straight
from `firmware/smart_parking_final/Config.h` — if you change a pin there, change it here too.

> **Final pin map:** RC522 SS 5 / SCK 18 / MOSI 23 / MISO 19 / RST 22 · LCD SDA 21 / SCL 17 · HC-SR04 #1 Trig 26 / Echo 25, #2 Trig 33 / Echo 32 · Servo 1 (entry) **27** · Servo 2 (exit) **16** · Water sensor **34** (analog, powered from 3V3).

> This covers the **Smart Parking (ESP32)** only. The vibration/temperature monitoring
> Arduinos connect over **WiFi**, so there are **no wires** between them and this board.

---

## ⚠️ Read this first — 4 rules that saved/killed our boards

1. **RC522 is 3.3 V ONLY.** Its VCC goes to the ESP32 **3V3** pin. 5 V will destroy it.
2. **HC-SR04 Echo needs a voltage divider** (5 V → 3.3 V) before it touches the ESP32.
   Trig can go straight to the ESP32. One divider **per sensor** (so two total).
3. **Disconnect peripherals before uploading code**, and upload at **115200**. Leaving
   sensors/LCD plugged in during a flash gives "flash read err" boot loops.
4. **Don't invent new pins.** Avoid GPIO 0, 2, 12, 15 (boot/flash pins). Use the pins in
   the table below — they're already tested.

---

## Power rails (set these up on the breadboard first)

- **3V3 rail** — from the ESP32 `3V3` pin → powers **RC522** and the **LCD**.
- **5V rail** — from the ESP32 `5V`/`VIN` pin (present when powered by USB) → powers the
  **HC-SR04** sensors (and the servo, see note).
- **GND rail** — from any ESP32 `GND`. **Everything shares this same ground.**

---

## Pin table (ESP32)

| Component | Wire | → ESP32 pin |
|---|---|---|
| **RC522** (RFID, at the entry gate) | SDA / SS | **5** |
| | SCK | **18** |
| | MOSI | **23** |
| | MISO | **19** |
| | RST | **22** |
| | 3.3V | **3V3** ⚠️ not 5V |
| | GND | GND |
| | IRQ | *(leave unconnected)* |
| **HC-SR04 #1** — Slot 1 (covered) | Trig | **26** |
| | Echo | **25** *(via divider)* |
| | VCC / GND | 5V / GND |
| **HC-SR04 #2** — Slot 2 (outdoor) | Trig | **33** |
| | Echo | **32** *(via divider)* |
| | VCC / GND | 5V / GND |
| **LCD 16×2 I2C** (address 0x27) | SDA | **21** |
| | SCL | **17** |
| | VCC | **3V3** |
| | GND | GND |
| **Servo SG90** (barrier) — *optional, code later* | Signal | **27** |
| | VCC (red) | 5V *(see note)* |
| | GND (brown) | GND |

---

## The HC-SR04 voltage divider (do this twice, once per sensor)

Echo is 5 V and the ESP32 is 3.3 V, so drop it with two resistors:

```
HC-SR04 Echo ──[ 1 kΩ ]──┬──► ESP32 Echo pin (25 or 32)
                         │
                       [ 2 kΩ ]
                         │
                        GND
```

That gives 5 V × 2k/(1k+2k) = **3.3 V** at the ESP32 pin. (Trig does **not** need this.)

---

## Step-by-step

1. **Power rails** — run 3V3, 5V, and GND from the ESP32 to three breadboard rails.
2. **RC522** — wire the 6 SPI/power lines above. Double-check VCC is on **3V3**. Mount it
   flat at the **entry gate** of the board (that's where cards get tapped).
3. **HC-SR04 #1** — Trig→26, VCC→5V, GND→GND. Build a divider and feed Echo→25. Point the
   sensor **down/across Slot 1** (the covered spot) so a parked car sits within ~8 cm.
4. **HC-SR04 #2** — same, Trig→33, Echo→32 via its own divider. Aim it at **Slot 2**.
5. **LCD** — SDA→21, SCL→17, VCC→3V3, GND→GND. Place it where it's readable from the front.
   If it stays **blank**, change `LCD_ADDR` to `0x3F` in config.h (some backpacks use that).
6. **Servo (optional)** — signal→27, GND→common GND, VCC→5V. *The firmware doesn't drive the
   barrier yet, so this is just for later — wiring it now is fine.*

---

## Before you power on — checklist

- [ ] RC522 VCC is on **3V3**, not 5V.
- [ ] Both Echo lines go through a **divider** (never straight to the ESP32).
- [ ] All grounds share **one** common GND rail.
- [ ] No wire on GPIO **0 / 2 / 12 / 15**.
- [ ] For uploading: pins are easy to unplug, Arduino IDE upload speed = **115200**.

## First test

Power the ESP32 by USB and open the Serial Monitor at **115200**. You should see it join
`Smart Park` WiFi and print the board boot lines. Tap a card → `[CARD] UID=...`. Put your
hand in front of a sensor → the slot flips to occupied on the dashboard
(`https://smartreiner.duckdns.org/home`).

> Servo barrier, and powering the servo from a **separate 5 V** supply (common GND) to avoid
> brown-outs, come with the barrier code later — don't block on it now.
