/* =============================================================================
 * SMART PARKING - FIRMWARE ESP32 (Scénario v2)
 * =============================================================================
 * Périphériques pris en charge :
 * - Lecteur RFID MFRC522 (SPI) : Détection des cartes Abonné / Visiteur
 * - Écran LCD I2C (16x2, adresse 0x27) : Affichage dynamique des instructions
 * - Servomoteur SG90 (PWM) : Contrôle automatique de la barrière levante
 * - Capteur Ultrason HC-SR04 (Place 1) : Détection de présence
 * - Capteur Infrarouge KY-032 (Place 2) : Détection de présence
 * - Capteur de Pluie / Humidité : Détection de précipitations
 *
 * Protocole de communication avec le serveur Node.js (API REST JSON) :
 * - POST /api/access   : Contrôle d'accès RFID (Entrée / Sortie)
 * - POST /api/capteurs : Télémétrie en temps réel (places P1, P2 et pluie)
 * - POST /api/ping     : Heartbeat périodique pour la surveillance de l'état
 * =============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>

// =============================================================================
// 1. CONFIGURATION RÉSEAU ET SERVEUR
// =============================================================================
const char* WIFI_SSID     = "SmartParking_WiFi";    // Nom du réseau Wi-Fi
const char* WIFI_PASSWORD = "SmartParkingPassword"; // Mot de passe Wi-Fi

// Adresse et port du serveur Node.js central
const char* SERVER_HOST   = "192.168.1.100";
const int   SERVER_PORT   = 3000;

// Identifiant matériel de la borne et jeton secret (doit correspondre à DEVICE_TOKEN)
const char* DEVICE_ID     = "esp32-gate-1";
const char* DEVICE_TOKEN  = "SECRET_TOKEN_ESP32_VALIDE_TEST_2026";

// =============================================================================
// 2. ASSIGNATION DES BROCHES MATÉRIELLES (PINOUT ESP32)
// =============================================================================

// RFID-RC522 (Interface SPI standard VSPI)
#define PIN_RC522_SS      5   // SDA / CS
#define PIN_RC522_RST     22  // RST
#define PIN_RC522_SCK     18  // SCK
#define PIN_RC522_MISO    19  // MISO
#define PIN_RC522_MOSI    23  // MOSI

// Servomoteur Barrière SG90
#define PIN_SERVO_BARRIER 13  // Commande PWM du servomoteur

// Capteur Place 1 : Ultrason HC-SR04
#define PIN_TRIG_P1       12  // Trigger
#define PIN_ECHO_P1       14  // Echo

// Capteur Place 2 : Infrarouge KY-032 (Détection d'obstacle)
#define PIN_KY032_P2      27  // Sortie numérique (LOW = obstacle / occupée)

// Capteur d'Humidité / Pluie
#define PIN_RAIN_SENSOR   34  // Entrée analogique/numérique (LOW = présence d'eau)

// Écran LCD 1602 I2C : SDA = GPIO 21, SCL = GPIO 22 (par défaut sur ESP32)
#define LCD_I2C_ADDR      0x27
#define LCD_COLUMNS       16
#define LCD_ROWS          2

// =============================================================================
// 3. INSTANCIATION DES OBJETS ET VARIABLES GLOBALES
// =============================================================================
MFRC522 rfid(PIN_RC522_SS, PIN_RC522_RST);
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLUMNS, LCD_ROWS);
Servo barrierServo;

// Positions angulaires de la barrière
const int ANGLE_BARRIERE_FERMEE = 0;   // Barrière baissée (fermée)
const int ANGLE_BARRIERE_OUVERTE = 90; // Barrière levée (ouverte)

// Minuteurs non-bloquants
unsigned long dernierEnvoiCapteurs = 0;
const unsigned long INTERVALLE_CAPTEURS_MS = 1500; // Envoi capteurs toutes les 1.5s

unsigned long dernierEnvoiPing = 0;
const unsigned long INTERVALLE_PING_MS = 8000;     // Heartbeat toutes les 8s

unsigned long dernierScanCarte = 0;
const unsigned long ANTI_REBOND_CARTE_MS = 2500;  // Empêche la double lecture rapide

bool wifiConnecte = false;

// =============================================================================
// 4. FONCTIONS UTILITAIRES LCD & AFFICHAGE
// =============================================================================

/**
 * Affiche deux lignes de texte sur le LCD 16x2 avec centrage automatique.
 */
void afficherLcd(const String& ligne1, const String& ligne2 = "") {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(ligne1.substring(0, LCD_COLUMNS));
  if (ligne2.length() > 0) {
    lcd.setCursor(0, 1);
    lcd.print(ligne2.substring(0, LCD_COLUMNS));
  }
}

/**
 * Écran d'attente par défaut lorsque le parking est prêt.
 */
void afficherEcranAccueil() {
  if (WiFi.status() == WL_CONNECTED) {
    afficherLcd(" SMART PARKING  ", "Scanner la carte");
  } else {
    afficherLcd("    No WiFi     ", "Connexion en crs");
  }
}

// =============================================================================
// 5. GESTION DU SERVOMOTEUR DE LA BARRIÈRE
// =============================================================================

/**
 * Actionne l'ouverture de la barrière, attend pendant la durée spécifiée,
 * puis referme automatiquement la barrière.
 */
void cycleBarriere(unsigned long dureeOuvertureMs = 5000) {
  barrierServo.write(ANGLE_BARRIERE_OUVERTE);
  delay(dureeOuvertureMs);
  barrierServo.write(ANGLE_BARRIERE_FERMEE);
}

// =============================================================================
// 6. GESTION DE LA CONNECTIVITÉ WI-FI
// =============================================================================

void verifierConnexionWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiConnecte) {
      wifiConnecte = true;
      Serial.println("[WIFI] Connecté ! IP: " + WiFi.localIP().toString());
      afficherEcranAccueil();
    }
  } else {
    if (wifiConnecte || millis() < 3000) {
      wifiConnecte = false;
      Serial.println("[WIFI] Connexion perdue. Tentative de reconnexion...");
      afficherLcd("    No WiFi     ", "Barrier Fermee  ");
      barrierServo.write(ANGLE_BARRIERE_FERMEE);
    }
    WiFi.reconnect();
  }
}

// =============================================================================
// 7. LECTURE DES CAPTEURS PHYSIQUES
// =============================================================================

/**
 * Lit la distance en centimètres via le capteur ultrason HC-SR04 (Place 1).
 * Si distance < 30 cm, la place est considérée comme occupée.
 */
bool lireOccupationPlace1() {
  digitalWrite(PIN_TRIG_P1, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG_P1, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG_P1, LOW);

  long dureeEcho = pulseIn(PIN_ECHO_P1, HIGH, 30000); // Timeout 30ms (~5m max)
  if (dureeEcho == 0) {
    return false; // Pas d'obstacle ou hors portée
  }
  float distanceCm = (dureeEcho * 0.0343) / 2.0;
  return (distanceCm > 0.5 && distanceCm < 30.0);
}

/**
 * Lit la présence d'un véhicule sur la Place 2 via le capteur KY-032.
 * Sortie LOW = présence détectée (obstacle).
 */
bool lireOccupationPlace2() {
  int etat = digitalRead(PIN_KY032_P2);
  return (etat == LOW);
}

/**
 * Lit le capteur d'eau/pluie.
 * Si le signal analogique est inférieur au seuil ou si l'entrée est LOW = pluie.
 */
bool lireCapteurPluie() {
  int val = analogRead(PIN_RAIN_SENSOR);
  // Pour un capteur de pluie analogique : seuil bas = forte conductivité due à l'eau
  return (val < 2000);
}

// =============================================================================
// 8. TÉLÉMÉTRIE MATÉRIELLE : POST /api/capteurs & POST /api/ping
// =============================================================================

void envoyerTelemetrieCapteurs() {
  if (WiFi.status() != WL_CONNECTED) return;

  bool p1Occupee = lireOccupationPlace1();
  bool p2Occupee = lireOccupationPlace2();
  bool pluieDetectee = lireCapteurPluie();

  HTTPClient http;
  String url = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/api/capteurs";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);

  StaticJsonDocument<256> doc;
  doc["device"] = DEVICE_ID;
  doc["p1"]     = p1Occupee;
  doc["p2"]     = p2Occupee;
  doc["pluie"]  = pluieDetectee;

  String corpsJson;
  serializeJson(doc, corpsJson);

  int codeReponse = http.POST(corpsJson);
  if (codeReponse > 0) {
    // Télémétrie reçue avec succès par le serveur
  } else {
    Serial.printf("[HTTP] Échec POST /api/capteurs : %s\n", http.errorToString(codeReponse).c_str());
  }
  http.end();
}

void envoyerHeartbeatPing() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/api/ping";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);

  StaticJsonDocument<256> doc;
  doc["device"]   = DEVICE_ID;
  doc["ip"]       = WiFi.localIP().toString();
  doc["rssi"]     = WiFi.RSSI();
  doc["uptimeMs"] = millis();
  doc["lcd"]      = "Pret";

  String corpsJson;
  serializeJson(doc, corpsJson);

  http.POST(corpsJson);
  http.end();
}

// =============================================================================
// 9. CONTRÔLE D'ACCÈS RFID : POST /api/access (ENTRÉE ET SORTIE)
// =============================================================================

/**
 * Traite la carte RFID scannée :
 * 1. Envoi au serveur Node.js via POST /api/access
 * 2. Gestion entrée : affichage Bienvenue / Place / Code, ouverture barrière
 * 3. Gestion sortie : affichage montant visiteur ou au revoir abonné, ouverture barrière
 * 4. Gestion refus : affichage explicite de la raison (Carte inconnue, bloquée, etc.)
 */
void traiterBadgeRFID(const String& uid) {
  if (WiFi.status() != WL_CONNECTED) {
    afficherLcd("Erreur Reseau", "No WiFi Connexion");
    delay(2000);
    afficherEcranAccueil();
    return;
  }

  afficherLcd("Verification...", "Carte: " + uid);

  HTTPClient http;
  String url = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/api/access";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);

  StaticJsonDocument<256> requeteDoc;
  requeteDoc["device"] = DEVICE_ID;
  requeteDoc["uid"]    = uid;

  String corpsJson;
  serializeJson(requeteDoc, corpsJson);

  int httpCode = http.POST(corpsJson);

  if (httpCode == HTTP_CODE_OK || httpCode == 200) {
    String reponse = http.getString();
    StaticJsonDocument<512> reponseDoc;
    DeserializationError erreur = deserializeJson(reponseDoc, reponse);

    if (erreur) {
      Serial.println("[JSON] Erreur de parsing : " + String(erreur.c_str()));
      afficherLcd("Erreur Donnees", "Format invalide");
      delay(2000);
      http.end();
      afficherEcranAccueil();
      return;
    }

    bool allow        = reponseDoc["allow"] | false;
    const char* action = reponseDoc["action"] | "ENTRY";
    const char* owner  = reponseDoc["owner"]  | "";
    const char* msg    = reponseDoc["message"] | "";
    const char* place  = reponseDoc["place"]  | "";
    const char* code   = reponseDoc["code"]   | "";
    const char* type   = reponseDoc["typeClient"] | "ABONNE";
    float price        = reponseDoc["price"]  | 0.0;

    // -------------------------------------------------------------------------
    // CAS A : ACCÈS REFUSÉ (ENTRÉE OU CARTE INVALIDE)
    // -------------------------------------------------------------------------
    if (!allow) {
      Serial.printf("[ACCÈS] Refusé pour UID %s : %s\n", uid.c_str(), msg);
      afficherLcd("Acces Refuse !", String(msg));
      delay(3000);
    }
    // -------------------------------------------------------------------------
    // CAS B : ENTRÉE AUTORISÉE (Abonné ou Visiteur)
    // -------------------------------------------------------------------------
    else if (String(action) == "ENTRY") {
      Serial.printf("[ACCÈS] Entrée accordée à %s sur %s. Code: %s\n", owner, place, code);

      // 1. Affichage de bienvenue avec Nom, Place et Code temporaire
      // Ligne 1 : "Bvn: [Nom]"
      // Ligne 2 : "Pl:[Place] C:[Code]"
      String nomCourt = String(owner);
      if (nomCourt.length() > 10) nomCourt = nomCourt.substring(0, 10);

      String lignePlaceCode = "";
      if (strlen(place) > 0) {
        String numPlace = String(place);
        numPlace.replace("Place ", "P");
        numPlace.replace(" couverte", "");
        lignePlaceCode += numPlace + " ";
      }
      if (strlen(code) > 0) {
        lignePlaceCode += "Code:" + String(code);
      }

      afficherLcd("Bvn " + nomCourt, lignePlaceCode);

      // 2. Actionne le servomoteur de la barrière (ouverte 5s)
      cycleBarriere(5000);
    }
    // -------------------------------------------------------------------------
    // CAS C : SORTIE TRAITÉE (Abonné ou Visiteur)
    // -------------------------------------------------------------------------
    else if (String(action) == "EXIT") {
      Serial.printf("[ACCÈS] Sortie pour %s. Type: %s, Prix: %.2f DT\n", owner, type, price);

      if (String(type) == "VISITEUR") {
        // Pour le visiteur : Affichage "A payer [Montant] DT" pendant 3 secondes
        char bufferPrix[16];
        snprintf(bufferPrix, sizeof(bufferPrix), "%.2f DT", price);
        afficherLcd("A payer :", String(bufferPrix));
        delay(3000); // Simulation du paiement à la sortie

        afficherLcd("Paiement Valide", "Bonne route !");
      } else {
        // Pour l'abonné : Débit direct automatique
        afficherLcd("Au revoir !", String(owner));
        delay(1500);
      }

      // Ouvre la barrière pendant 5 secondes puis referme
      cycleBarriere(5000);
    }
  } else {
    Serial.printf("[HTTP] Échec de la requête /api/access : %d\n", httpCode);
    afficherLcd("Erreur Serveur", "Code HTTP: " + String(httpCode));
    delay(2000);
  }

  http.end();
  afficherEcranAccueil();
}

// =============================================================================
// 10. SETUP & INITIALISATION
// =============================================================================

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n--- Démarrage Smart Parking ESP32 ---");

  // Initialisation de l'écran LCD I2C
  Wire.begin();
  lcd.init();
  lcd.backlight();
  afficherLcd(" SMART PARKING  ", "Initialisation..");

  // Initialisation du Servomoteur SG90
  ESP32PWM::allocateTimer(0);
  barrierServo.setPeriodHertz(50); // 50 Hz pour SG90
  barrierServo.attach(PIN_SERVO_BARRIER, 500, 2400);
  barrierServo.write(ANGLE_BARRIERE_FERMEE); // Barrière fermée par sécurité

  // Configuration des broches capteurs
  pinMode(PIN_TRIG_P1, OUTPUT);
  pinMode(PIN_ECHO_P1, INPUT);
  pinMode(PIN_KY032_P2, INPUT);
  pinMode(PIN_RAIN_SENSOR, INPUT);

  // Initialisation du bus SPI et du lecteur RFID-RC522
  SPI.begin(PIN_RC522_SCK, PIN_RC522_MISO, PIN_RC522_MOSI, PIN_RC522_SS);
  rfid.PCD_Init();
  delay(100);
  Serial.println("[RFID] RC522 initialisé.");

  // Connexion Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  afficherLcd("Connexion WiFi..", WIFI_SSID);

  int tentatives = 0;
  while (WiFi.status() != WL_CONNECTED && tentatives < 15) {
    delay(500);
    Serial.print(".");
    tentatives++;
  }
  Serial.println();

  verifierConnexionWiFi();
  afficherEcranAccueil();
}

// =============================================================================
// 11. BOUCLE PRINCIPALE (LOOP)
// =============================================================================

void loop() {
  unsigned long tempsActuel = millis();

  // 1. Surveillance et maintien de la connectivité Wi-Fi
  verifierConnexionWiFi();

  // 2. Détection et lecture d'un badge RFID présenté à la borne
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    if (tempsActuel - dernierScanCarte > ANTI_REBOND_CARTE_MS) {
      dernierScanCarte = tempsActuel;

      // Conversion de l'UID en chaîne hexadécimale majuscule compacte
      String uidStr = "";
      for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10) uidStr += "0";
        uidStr += String(rfid.uid.uidByte[i], HEX);
      }
      uidStr.toUpperCase();
      Serial.println("\n[RFID] Badge détecté, UID : " + uidStr);

      traiterBadgeRFID(uidStr);
    }
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  // 3. Envoi périodique de l'état des capteurs (Places 1 & 2, Détecteur de pluie)
  if (tempsActuel - dernierEnvoiCapteurs >= INTERVALLE_CAPTEURS_MS) {
    dernierEnvoiCapteurs = tempsActuel;
    envoyerTelemetrieCapteurs();
  }

  // 4. Heartbeat périodique vers le serveur (Garantit "capteurs: ok" dans /api/etat)
  if (tempsActuel - dernierEnvoiPing >= INTERVALLE_PING_MS) {
    dernierEnvoiPing = tempsActuel;
    envoyerHeartbeatPing();
  }
}
