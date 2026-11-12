# Spécification API - Smart Parking (ESP32 & Web Mobile)

Toutes les réponses de l'API sont envoyées en **JSON compact**, sans indentation ni saut de ligne (`\r`, `\n`), directement interprétable par le firmware ESP32. Les valeurs booléennes sont sérialisées sous la forme stricte `"allow":true`.
Toutes les devises sont en Dinars Tunisiens (DT).
Les configurations globales tarifaires sont gérées dans `config.json`.
Les cartes enregistrées et l'historique sont conservés dans `data/cartes.json` et `data/historique.json`.
L'espace d'administration web a été remplacé par des outils d'administration en ligne de commande dans `outils/`.

---

## 1. Routes Appareil (ESP32)

Toutes les requêtes de l'ESP32 doivent fournir le jeton d'authentification matériel dans l'en-tête :
```http
X-Device-Token: <DEVICE_TOKEN>
```
Le serveur exige impérativement la variable d'environnement `DEVICE_TOKEN` au démarrage.

---

### 1.1. Contrôle d'accès RFID (Entrée / Sortie)

**POST** `/api/access`

Cette route gère le passage d'une carte RFID sur la borne ESP32. Elle traite automatiquement l'entrée ou la sortie selon l'état actuel de la carte dans le parking.

#### Corps envoyé (JSON) :
```json
{"device":"esp32-gate-1","uid":"ABONNE1"}
```

#### Ordre d'évaluation à l'ENTRÉE :
1. **Carte inconnue** : non trouvée dans `data/cartes.json` -> Refus immédiat.
2. **Carte bloquée** : `bloquee === true` -> Refus immédiat.
3. **Carte déjà présente** : traitée automatiquement comme une **SORTIE**.
4. **Solde abonné** : si type `ABONNE` et solde $\le$ 0 -> Refus "Solde insuffisant" (aucun test de solde pour un visiteur).
5. **Attribution de place** :
   - S'il pleut : seule la **Place 1** (couverte) est proposée.
   - Sans pluie : la **Place 2** est attribuée en priorité, puis la **Place 1**.
6. **Parking plein** : si aucune place éligible n'est disponible -> Refus "Parking complet", ou "Parking complet (pluie)" lorsque c'est la pluie qui bloque l'accès à la Place 2.
7. **Création de session** : la session démarre dès ce scan physique. Génération d'un code à 6 chiffres, valable 5 minutes, à usage unique.

#### Réponses ENTRÉE :
- **Succès (HTTP 200)** :
```json
{"ok":true,"allow":true,"action":"ENTRY","owner":"Yassine Mansour","balance":10,"place":"Place 2","code":"805385","typeClient":"ABONNE","price":0,"durationSec":0,"message":"Bienvenue"}
```
- **Refus métier (HTTP 200)** :
```json
{"ok":false,"allow":false,"action":"ENTRY","owner":"","balance":0,"message":"Carte inconnue","place":null,"code":null,"typeClient":null,"price":0,"durationSec":0}
```

#### Réponses SORTIE :
Lorsqu'une carte déjà stationnée se présente à la borne :
- **Abonné** : Débit automatique de son solde au tarif abonné (`tarifAbonne` par minute).
- **Visiteur** : Calcul du montant dû (`durée en minutes * tarifAbonne * coefVisiteur`). Simulation du paiement.
- Libération instantanée de la place de stationnement pour les autres véhicules.
- La session passe au statut `"terminee"` et reste consultable par le client pendant 10 minutes.
- Archivage dans `data/historique.json`.
- Ouverture de la barrière pendant 5 secondes.

```json
{"ok":true,"allow":true,"action":"EXIT","owner":"Visiteur #1","balance":0,"place":"Place 1","code":null,"typeClient":"VISITEUR","price":0.03,"durationSec":1,"message":"Paiement : 0.03 DT"}
```

---

### 1.2. Données des capteurs et météo

**POST** `/api/capteurs`

Met à jour l'état physique des capteurs ultrasons/infrarouges et du détecteur d'humidité/pluie.

#### Corps envoyé (JSON) :
```json
{"device":"esp32-gate-1","p1":false,"p2":true,"pluie":true}
```

#### Débruitage de la pluie :
- La pluie est **confirmée** après 3 secondes d'humidité continue.
- La pluie est **terminée** après 30 secondes de sec continu.
- **Règle de protection** : Un véhicule déjà stationné en Place 2 n'est jamais chassé ou expulsé par le début de la pluie.

---

### 1.3. Heartbeat et état matériel

**POST** `/api/ping`

Permet à l'ESP32 de maintenir la surveillance en ligne du matériel.

#### Corps envoyé (JSON) :
```json
{"device":"esp32-gate-1","ip":"192.168.1.50","rssi":-60,"uptimeMs":120000,"lcd":"Pret"}
```

#### Réponse (HTTP 200) :
```json
{"ok":true,"device":"esp32-gate-1"}
```

---

## 2. Routes Client Web Mobile

### 2.1. État public du parking

**GET** `/api/etat`

Fournit l'état en temps réel pour l'écran d'accueil et le plan SVG interactif.

- `"capteurs"` : vaut `"ok"` si le serveur a reçu un `POST /api/capteurs` ou un `POST /api/ping` valide depuis moins de 15 secondes (configurable via la variable `DELAI_APPAREIL_SEC`), sinon `"attente"`. Au démarrage du serveur, vaut `"attente"`.

#### Réponse (JSON) :
```json
{"tarif":1,"tarifAbonne":1,"tarifVisiteur":1.5,"pluie":false,"barriere":"fermee","capteurs":"ok","etatParking":[{"nom":"Place 1","etat":"libre","disponible":true,"raison":null},{"nom":"Place 2","etat":"libre","disponible":true,"raison":null}],"materiel":{"enLigne":true,"dernierContact":"2026-10-27T18:45:00.000Z","secondesDepuisContact":2,"barriereOuverte":false,"pluie":false,"servo":{"etat":"ferme","angle":0},"rfid":{"pret":true,"modele":"RC522"}}}
```

---

### 2.2. Connexion par code temporaire

**POST** `/api/login`

Permet au conducteur de lier son smartphone à la session déjà démarrée à la borne.

#### Corps envoyé (JSON) :
```json
{"code":"805385"}
```

#### Réponses :
- **Abonné (HTTP 200)** :
```json
{"nom":"Yassine Mansour","solde":10,"sessionId":"a1b2c3d4e5f6..."}
```
- **Visiteur (HTTP 403)** :
```json
{"code":"visiteur_sans_application","erreur":"Carte visiteur : pas d'application, paiement à la sortie"}
```
- **Code expiré / Invalide (HTTP 401)** :
```json
{"code":"code_expire","erreur":"Ce code a expiré ou est invalide."}
```

---

### 2.3. Consultation de la session

**GET** `/api/session`

En-tête requis : `X-Session-Id: <sessionId>`

#### Cas 1 : Session en cours
```json
{"statut":"active","entree":"2026-10-27T18:30:00.000Z","solde":10,"tarif":1,"tempsRestant":600,"tempsRestantSec":600,"finEstimee":"2026-10-27T18:40:00.000Z","place":"Place 2","pluie":false,"etatParking":[{"nom":"Place 1","etat":"libre"},{"nom":"Place 2","etat":"occupée"}]}
```

#### Cas 2 : Session terminée après sortie par carte (disponible pendant 10 minutes)
```json
{"statut":"terminee","entree":"2026-10-27T18:30:00.000Z","sortie":"2026-10-27T18:35:00.000Z","duree":300,"prix":5,"soldeFinal":5,"place":"Place 2","typeClient":"ABONNE"}
```
Après 10 minutes, la session est supprimée et renvoie HTTP 401 (`session_absente`).

---

### 2.4. Recharge de solde (Abonné)

**POST** `/api/recharge`

En-tête requis : `X-Session-Id: <sessionId>`

#### Corps envoyé (JSON) :
```json
{"montant":10}
```

#### Réponse (HTTP 200) :
```json
{"solde":20}
```

---

### 2.5. Sortie (Désactivée)

**POST** `/api/sortie`

Cette route a été supprimée. La sortie se fait exclusivement par passage de la carte RFID sur la borne.
Cette route renvoie désormais systématiquement **HTTP 404** :
```json
{"code":"route_introuvable","erreur":"Route API introuvable."}
```

---

## 3. Outils Terminal d'Administration (`outils/`)

L'administration s'effectue via les scripts Node.js natifs suivants (exigeant la variable d'environnement `DEVICE_TOKEN`) :

1. **`node outils/cartes.js`**
   - `lister` : Affiche sous forme de tableau toutes les cartes (UID, nom, type, solde, état de blocage).
   - `ajouter <UID> <NOM> [TYPE: ABONNE|VISITEUR] [SOLDE]` : Crée une nouvelle carte RFID.
   - `recharger <UID> <MONTANT>` : Crédite le solde d'une carte.
   - `bloquer <UID> [oui|non]` : Bloque ou débloque une carte RFID.

2. **`node outils/historique.js`**
   - Affiche le registre complet des entrées/sorties avec UID, nom, type, place, horodatages, durée et prix facturé.

3. **`node outils/simuler.js`**
   - `pluie on|off` : Déclenche ou arrête la pluie.
   - `place <1|2> <libre|occupee>` : Simule l'état d'un capteur de place.
   - `carte <UID>` : Simule la présentation d'une carte à la borne d'entrée/sortie.
