// =============================================================================
// SMART PARKING - BACKEND NODE.JS NATIF (SANS DÉPENDANCES EXTERNES)
// =============================================================================

// Vérification impérative du jeton d'authentification matériel de l'ESP32
const JETON_APPAREIL = process.env.DEVICE_TOKEN;
if (!JETON_APPAREIL || !JETON_APPAREIL.trim()) {
  console.error("ERREUR FATALE : La variable d'environnement DEVICE_TOKEN est obligatoire.");
  console.error("Veuillez définir DEVICE_TOKEN avant de lancer le serveur (ex: $env:DEVICE_TOKEN=\"...\").");
  process.exit(1);
}

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const port = Number(process.env.PORT) || 3000;
const dossierPublic = path.join(__dirname, "public");
const dossierDonnees = path.join(__dirname, "data");
const fichierCartes = path.join(dossierDonnees, "cartes.json");
const fichierHistorique = path.join(dossierDonnees, "historique.json");
const fichierConfig = path.join(__dirname, "config.json");

// Identifiant d'appareil ESP32 attendu
const ESP32_DEVICE_ID = process.env.ESP32_DEVICE_ID || "esp32-gate-1";

// Durée de validité du code d'accès généré (5 minutes)
const DUREE_VALIDITE_CODE_MS = 5 * 60 * 1000;

// Durée de rétention d'une session terminée consultable par le client (10 minutes)
const DUREE_SESSION_TERMINEE_MS = 10 * 60 * 1000;

// Constantes
const MAX_SESSIONS = 2; // Le parking comporte 2 places

// Types MIME pour les fichiers statiques de public/
const typesMime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

// =============================================================================
// GESTION DE LA CONFIGURATION (config.json)
// =============================================================================

function lireConfig() {
  try {
    const contenu = fs.readFileSync(fichierConfig, "utf8");
    const json = JSON.parse(contenu);
    return {
      tarifAbonne: Number.isFinite(json.tarifAbonne) ? json.tarifAbonne : 1.0,
      coefVisiteur: Number.isFinite(json.coefVisiteur) ? json.coefVisiteur : 1.5,
    };
  } catch (err) {
    return { tarifAbonne: 1.0, coefVisiteur: 1.5 };
  }
}

// =============================================================================
// PERSISTANCE ATOMIQUE ET CHARGEMENT DES DONNÉES
// =============================================================================

function normaliserUid(uid) {
  if (typeof uid !== "string") return "";
  return uid.trim().toUpperCase().replace(/[\s:]/g, "");
}

function arrondirMontant(montant) {
  return Math.round((montant + Number.EPSILON) * 100) / 100;
}

function ecrireFichierAtomiquement(fichier, donnees) {
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  const temporaire = `${fichier}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaire, `${JSON.stringify(donnees, null, 2)}\n`, "utf8");
  fs.renameSync(temporaire, fichier);
}

function chargerCartes() {
  try {
    const contenu = fs.readFileSync(fichierCartes, "utf8");
    const liste = JSON.parse(contenu);
    if (!Array.isArray(liste)) return new Map();
    const map = new Map();
    for (const carte of liste) {
      if (carte && carte.uid) {
        const uid = normaliserUid(carte.uid);
        map.set(uid, {
          uid,
          nom: carte.nom || "Utilisateur",
          type: carte.type === "VISITEUR" ? "VISITEUR" : "ABONNE",
          solde: Number.isFinite(carte.solde) ? carte.solde : 0.0,
          bloquee: Boolean(carte.bloquee),
        });
      }
    }
    return map;
  } catch (err) {
    return new Map();
  }
}

function rechargerCartesDepuisFichier() {
  const nouvellesCartes = chargerCartes();
  cartes.clear();
  for (const [k, v] of nouvellesCartes) {
    cartes.set(k, v);
  }
}

function sauvegarderCartes() {
  ecrireFichierAtomiquement(fichierCartes, Array.from(cartes.values()));
}

function chargerHistorique() {
  try {
    const contenu = fs.readFileSync(fichierHistorique, "utf8");
    const liste = JSON.parse(contenu);
    if (!Array.isArray(liste)) return [];
    return liste.slice(-50);
  } catch (err) {
    return [];
  }
}

function sauvegarderHistorique() {
  ecrireFichierAtomiquement(fichierHistorique, historique.slice(-50));
}

// État stocké en mémoire
const cartes = chargerCartes();
const historique = chargerHistorique();
const sessions = new Map();         // JetonSession -> Session
const codesTemporaires = new Map();  // Code (6 chiffres) -> Session

// État des capteurs physiques matériels
let capteurPlace1Occupee = false;
let capteurPlace2Occupee = false;

// Surveillance du contact matériel ESP32
let dernierContactAppareilMs = null; // null au démarrage
let dernierPingIso = null;

// Barrière physique simulée (ouverte 5s lors d'une entrée/sortie)
let barriereSimulee = "fermee";
let barriereTimer = null;

function actionnerBarriere() {
  clearTimeout(barriereTimer);
  barriereSimulee = "ouverte";
  barriereTimer = setTimeout(() => {
    barriereSimulee = "fermee";
  }, 5000);
}

// =============================================================================
// GESTION DE LA PLUIE ET DÉBRUITAGE
// - Confirmée après 3 s d'humidité continue
// - Terminée après 30 s de temps sec continu
// =============================================================================

let pluieBrute = false;
let pluieConfirmee = false;
let debutHumiditeContinue = null;
let debutSecContinu = null;

function actualiserEtatPluie() {
  const maintenant = Date.now();
  if (pluieBrute) {
    debutSecContinu = null;
    if (debutHumiditeContinue === null) {
      debutHumiditeContinue = maintenant;
    }
    if (!pluieConfirmee && maintenant - debutHumiditeContinue >= 3000) {
      pluieConfirmee = true;
    }
  } else {
    debutHumiditeContinue = null;
    if (debutSecContinu === null) {
      debutSecContinu = maintenant;
    }
    if (pluieConfirmee && maintenant - debutSecContinu >= 30000) {
      pluieConfirmee = false;
    }
  }
  return pluieConfirmee;
}

function signalHumidite(estHumide) {
  const maintenant = Date.now();
  pluieBrute = Boolean(estHumide);
  if (pluieBrute) {
    debutSecContinu = null;
    if (debutHumiditeContinue === null) {
      debutHumiditeContinue = maintenant;
    }
  } else {
    debutHumiditeContinue = null;
    if (debutSecContinu === null) {
      debutSecContinu = maintenant;
    }
  }
  return actualiserEtatPluie();
}

// Intervalle de fond pour débruiter continuellement la pluie
const timerPluie = setInterval(actualiserEtatPluie, 500);
timerPluie.unref();

// =============================================================================
// ATTRIBUTION DES PLACES
// Règle :
// - S'il pleut : seule la Place 1 (couverte) est disponible ;
// - Sinon (temps sec) : Place 2 d'abord, puis Place 1 si Place 2 occupée.
// - Une voiture déjà garée en Place 2 n'est jamais chassée par la pluie.
// =============================================================================

function determinerPlaces() {
  actualiserEtatPluie();
  const placesOccupees = new Set();
  const maintenant = Date.now();

  // Nettoyage des codes temporaires expirés
  for (const [code, session] of codesTemporaires) {
    if (session.expireA <= maintenant) {
      codesTemporaires.delete(code);
    }
  }

  // Seules les sessions encore actives occupent les places de stationnement
  for (const session of sessions.values()) {
    if (session.statut === "active" && session.place) {
      placesOccupees.add(session.place);
    }
  }

  // Capteurs physiques de l'ESP32 s'ils détectent un obstacle
  if (capteurPlace1Occupee) placesOccupees.add("Place 1");
  if (capteurPlace2Occupee) placesOccupees.add("Place 2");

  const p1Occupee = placesOccupees.has("Place 1");
  const p2Occupee = placesOccupees.has("Place 2");

  // Disponibilité pour un nouvel arrivant :
  const p1Disponible = !p1Occupee;
  const p2Disponible = !p2Occupee && !pluieConfirmee;

  return {
    placesOccupees,
    place1: {
      nom: "Place 1",
      etat: p1Occupee ? "occupée" : "libre",
      disponible: p1Disponible,
      raison: p1Occupee ? "occupee" : null,
    },
    place2: {
      nom: "Place 2",
      etat: p2Occupee ? "occupée" : "libre",
      disponible: p2Disponible,
      raison: p2Occupee ? "occupee" : pluieConfirmee ? "pluie" : null,
    },
  };
}

function choisirPlacePourEntree() {
  const { place1, place2 } = determinerPlaces();

  if (pluieConfirmee) {
    // S'il pleut, seule la Place 1 peut être attribuée
    if (place1.disponible) return { place: "Place 1", codeErreur: null };
    return { place: null, codeErreur: "Parking complet (pluie)" };
  }

  // Temps sec : Place 2 d'abord, puis Place 1
  if (place2.disponible) return { place: "Place 2", codeErreur: null };
  if (place1.disponible) return { place: "Place 1", codeErreur: null };

  return { place: null, codeErreur: "Parking complet" };
}

// =============================================================================
// CALCUL DU PRIX ET DES FACTURES
// =============================================================================

function calculerTarifs() {
  const cfg = lireConfig();
  const tarifAbonne = cfg.tarifAbonne;
  const tarifVisiteur = tarifAbonne * cfg.coefVisiteur;
  return { tarifAbonne, tarifVisiteur, coefVisiteur: cfg.coefVisiteur };
}

function calculerFacture(session, maintenant = Date.now()) {
  const dureeMs = Math.max(0, maintenant - (session.entree || maintenant));
  const dureeSec = Math.floor(dureeMs / 1000);
  const dureeMinutes = dureeMs / 60000;
  const { tarifAbonne, tarifVisiteur } = calculerTarifs();

  const tarifMinute = session.typeClient === "VISITEUR" ? tarifVisiteur : tarifAbonne;
  const prixCalcule = arrondirMontant(dureeMinutes * tarifMinute);

  return {
    dureeSec,
    dureeMinutes,
    prixCalculé: prixCalcule,
    tarifMinute,
  };
}

// =============================================================================
// SÉCURITÉ : VÉRIFICATION DU JETON APPAREIL ESP32
// =============================================================================

function verifierJetonAppareil(req) {
  const secret = process.env.DEVICE_TOKEN;
  const recu = req.headers["x-device-token"];
  if (!secret || typeof recu !== "string") {
    return false;
  }
  const attendu = Buffer.from(secret, "utf8");
  const fourni = Buffer.from(recu, "utf8");
  return attendu.length === fourni.length && crypto.timingSafeEqual(attendu, fourni);
}

// Helpers de réponse HTTP : JSON compact sans indentation ni saut de ligne
function repondreJson(res, statut, donnees) {
  res.writeHead(statut, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  // JSON compact strictly sans retours à la ligne pour le firmware ESP32
  res.end(JSON.stringify(donnees));
}

function lireJson(req) {
  return new Promise((resolve, reject) => {
    let corps = "";
    req.on("data", (morceau) => {
      corps += morceau;
      if (Buffer.byteLength(corps, "utf8") > 16384) {
        reject(new Error("Corps de requête trop volumineux."));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(corps || "{}"));
      } catch (err) {
        reject(new Error("JSON invalide."));
      }
    });
    req.on("error", reject);
  });
}

// =============================================================================
// LOGIQUE PRINCIPALE DE L'API REST
// =============================================================================

async function traiterApi(req, url) {
  let corps = {};
  if (req.method === "POST") {
    try {
      corps = await lireJson(req);
    } catch (e) {
      return { statut: 400, donnees: { ok: false, erreur: e.message } };
    }
  }

  // ---------------------------------------------------------------------------
  // 1. ROUTE CLIENT : GET /api/etat
  // Surveillance ESP32 : "capteurs" vaut "ok" si contact < DELAI_APPAREIL_SEC
  // ---------------------------------------------------------------------------
  if (req.method === "GET" && url === "/api/etat") {
    const { tarifAbonne, tarifVisiteur } = calculerTarifs();
    const { place1, place2 } = determinerPlaces();

    const delaiAppareilSec = Number(process.env.DELAI_APPAREIL_SEC) || 15;
    const maintenant = Date.now();
    const capteursOk = dernierContactAppareilMs !== null && (maintenant - dernierContactAppareilMs < delaiAppareilSec * 1000);
    const etatCapteurs = capteursOk ? "ok" : "attente";

    let secondesDepuisContact = null;
    if (dernierContactAppareilMs !== null) {
      secondesDepuisContact = Math.round((maintenant - dernierContactAppareilMs) / 1000);
    }

    return {
      statut: 200,
      donnees: {
        tarif: tarifAbonne,
        tarifAbonne,
        tarifVisiteur,
        pluie: pluieConfirmee,
        barriere: barriereSimulee,
        capteurs: etatCapteurs,
        etatParking: [
          {
            nom: place1.nom,
            etat: place1.etat,
            disponible: place1.disponible,
            raison: place1.raison,
          },
          {
            nom: place2.nom,
            etat: place2.etat,
            disponible: place2.disponible,
            raison: place2.raison,
          },
        ],
        materiel: {
          enLigne: capteursOk,
          dernierContact: dernierPingIso,
          secondesDepuisContact,
          barriereOuverte: barriereSimulee === "ouverte",
          pluie: pluieConfirmee,
          servo: {
            etat: barriereSimulee === "ouverte" ? "ouvert" : "ferme",
            angle: barriereSimulee === "ouverte" ? 90 : 0,
          },
          rfid: { pret: capteursOk, modele: "RC522" },
        },
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 2. ROUTE MATÉRIELLE : POST /api/capteurs (Débruitage Pluie & Capteurs)
  // ---------------------------------------------------------------------------
  if (req.method === "POST" && url === "/api/capteurs") {
    if (!verifierJetonAppareil(req)) {
      return { statut: 401, donnees: { ok: false, erreur: "Appareil non autorisé." } };
    }

    dernierContactAppareilMs = Date.now();
    dernierPingIso = new Date(dernierContactAppareilMs).toISOString();

    const { p1, p2, pluie } = corps;

    if (typeof pluie === "boolean") {
      signalHumidite(pluie);
    }
    if (typeof p1 === "boolean") {
      capteurPlace1Occupee = p1;
    }
    if (typeof p2 === "boolean") {
      capteurPlace2Occupee = p2;
    }

    return {
      statut: 200,
      donnees: {
        ok: true,
        pluieConfirmee,
        pluieBrute,
        barriere: barriereSimulee,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 3. ROUTE MATÉRIELLE / HEARTBEAT : POST /api/ping
  // Entrée attendue : { device, ip, rssi, uptimeMs, lcd }
  // ---------------------------------------------------------------------------
  if (req.method === "POST" && url === "/api/ping") {
    if (!verifierJetonAppareil(req)) {
      return { statut: 401, donnees: { ok: false, erreur: "Appareil non autorisé." } };
    }

    dernierContactAppareilMs = Date.now();
    dernierPingIso = new Date(dernierContactAppareilMs).toISOString();

    const deviceId = corps.device || ESP32_DEVICE_ID;
    return {
      statut: 200,
      donnees: {
        ok: true,
        device: deviceId,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 4. ROUTE APPAREIL : POST /api/access (Lecture RFID Entrée et Sortie)
  // ---------------------------------------------------------------------------
  if (req.method === "POST" && url === "/api/access") {
    if (!verifierJetonAppareil(req)) {
      return { statut: 401, donnees: { ok: false, erreur: "Appareil non autorisé." } };
    }

    rechargerCartesDepuisFichier(); // Synchroniser avec le fichier cartes.json

    const uid = normaliserUid(corps.uid);

    // a) Carte inconnue -> refus "Carte inconnue"
    const carte = cartes.get(uid);
    if (!carte) {
      return {
        statut: 200,
        donnees: {
          ok: false,
          allow: false,
          action: "ENTRY",
          owner: "",
          balance: 0,
          message: "Carte inconnue",
          place: null,
          code: null,
          typeClient: null,
          price: 0,
          durationSec: 0,
        },
      };
    }

    // b) Carte bloquée -> refus "Carte bloquée"
    if (carte.bloquee) {
      return {
        statut: 200,
        donnees: {
          ok: false,
          allow: false,
          action: "ENTRY",
          owner: carte.nom,
          balance: carte.solde,
          message: "Carte bloquée",
          place: null,
          code: null,
          typeClient: carte.type,
          price: 0,
          durationSec: 0,
        },
      };
    }

    // c) Carte déjà dans le parking (session active) -> TRAITER COMME UNE SORTIE
    let sessionActive = null;
    let jetonSessionActive = null;
    for (const [jeton, sess] of sessions) {
      if (sess.uid === uid && sess.statut === "active") {
        sessionActive = sess;
        jetonSessionActive = jeton;
        break;
      }
    }

    if (sessionActive) {
      const facture = calculerFacture(sessionActive);
      let soldeFinal = carte.solde;

      if (sessionActive.typeClient === "ABONNE") {
        carte.solde = arrondirMontant(carte.solde - facture.prixCalculé);
        sauvegarderCartes();
        soldeFinal = carte.solde;
      }

      const maintenant = Date.now();
      const dateEntreeIso = new Date(sessionActive.entree).toISOString();
      const dateSortieIso = new Date(maintenant).toISOString();

      // Enregistrement dans data/historique.json
      const entreeHisto = {
        uid: carte.uid,
        nom: carte.nom,
        type: carte.type,
        place: sessionActive.place,
        entree: dateEntreeIso,
        sortie: dateSortieIso,
        dureeSec: facture.dureeSec,
        prix: facture.prixCalculé,
      };
      historique.push(entreeHisto);
      sauvegarderHistorique();

      // Suppression du code temporaire s'il était encore valide
      if (sessionActive.code) {
        codesTemporaires.delete(sessionActive.code);
      }

      // Marquer la session comme "terminee" (consultable par le client pendant 10 minutes)
      sessionActive.statut = "terminee";
      sessionActive.entreeIso = dateEntreeIso;
      sessionActive.sortieIso = dateSortieIso;
      sessionActive.duree = facture.dureeSec;
      sessionActive.prix = facture.prixCalculé;
      sessionActive.soldeFinal = soldeFinal;
      sessionActive.expireSuppressionA = maintenant + DUREE_SESSION_TERMINEE_MS;

      // Nettoyage définitif de la session après 10 minutes
      setTimeout(() => {
        const sess = sessions.get(jetonSessionActive);
        if (sess && sess.statut === "terminee") {
          sessions.delete(jetonSessionActive);
        }
      }, DUREE_SESSION_TERMINEE_MS).unref();

      // Ouverture de la barrière pendant 5 secondes
      actionnerBarriere();

      return {
        statut: 200,
        donnees: {
          ok: true,
          allow: true,
          action: "EXIT",
          owner: carte.nom,
          balance: carte.solde,
          message: sessionActive.typeClient === "VISITEUR"
            ? `Paiement : ${facture.prixCalculé} DT`
            : "Sortie autorisée",
          place: sessionActive.place,
          code: null,
          typeClient: carte.type,
          price: facture.prixCalculé,
          durationSec: facture.dureeSec,
        },
      };
    }

    // ENTRÉE, dans cet ordre :
    // d) Abonné avec solde <= 0 -> refus "Solde insuffisant" (aucun test pour un visiteur)
    if (carte.type === "ABONNE" && carte.solde <= 0) {
      return {
        statut: 200,
        donnees: {
          ok: false,
          allow: false,
          action: "ENTRY",
          owner: carte.nom,
          balance: carte.solde,
          message: "Solde insuffisant",
          place: null,
          code: null,
          typeClient: carte.type,
          price: 0,
          durationSec: 0,
        },
      };
    }

    // e) & f) Places disponibles
    const { place, codeErreur } = choisirPlacePourEntree();
    if (!place) {
      return {
        statut: 200,
        donnees: {
          ok: false,
          allow: false,
          action: "ENTRY",
          owner: carte.nom,
          balance: carte.solde,
          message: codeErreur,
          place: null,
          code: null,
          typeClient: carte.type,
          price: 0,
          durationSec: 0,
        },
      };
    }

    // g) La session démarre ICI au passage de la carte.
    // Génère un code à 6 chiffres, valable 5 minutes, à usage unique.
    let code;
    do {
      code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    } while (codesTemporaires.has(code));

    const maintenant = Date.now();
    const jetonSession = crypto.randomBytes(32).toString("hex");
    const expireA = maintenant + DUREE_VALIDITE_CODE_MS;

    const nouvelleSession = {
      sessionId: jetonSession,
      uid: carte.uid,
      nom: carte.nom,
      typeClient: carte.type,
      solde: carte.solde,
      place,
      code,
      statut: "active",
      entree: maintenant,
      expireA,
    };

    sessions.set(jetonSession, nouvelleSession);
    codesTemporaires.set(code, nouvelleSession);

    actionnerBarriere();

    return {
      statut: 200,
      donnees: {
        ok: true,
        allow: true,
        action: "ENTRY",
        owner: carte.nom,
        balance: carte.solde,
        message: "Bienvenue",
        place,
        code,
        typeClient: carte.type,
        price: 0,
        durationSec: 0,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 5. ROUTE CLIENT : POST /api/login (Relie le téléphone à la session)
  // ---------------------------------------------------------------------------
  if (req.method === "POST" && url === "/api/login") {
    const code = typeof corps.code === "string" ? corps.code.trim() : "";
    if (!/^\d{6}$/.test(code)) {
      return {
        statut: 400,
        donnees: { code: "code_invalide", erreur: "Code à 6 chiffres invalide." },
      };
    }

    const session = codesTemporaires.get(code);
    const maintenant = Date.now();

    if (!session || session.expireA <= maintenant) {
      if (session) codesTemporaires.delete(code);
      return {
        statut: 401,
        donnees: { code: "code_expire", erreur: "Ce code a expiré ou est invalide." },
      };
    }

    // Carte visiteur : pas d'accès à l'application web
    if (session.typeClient === "VISITEUR") {
      codesTemporaires.delete(code);
      return {
        statut: 403,
        donnees: {
          code: "visiteur_sans_application",
          erreur: "Carte visiteur : pas d'application, paiement à la sortie",
        },
      };
    }

    // Abonné : code consommé à usage unique
    codesTemporaires.delete(code);

    return {
      statut: 200,
      donnees: {
        nom: session.nom,
        solde: session.solde,
        sessionId: session.sessionId,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 6. ROUTE CLIENT : GET /api/session
  // Session active ("statut": "active") ou terminée ("statut": "terminee") pendant 10 min
  // ---------------------------------------------------------------------------
  if (req.method === "GET" && url === "/api/session") {
    const jetonSession = req.headers["x-session-id"];
    const session = typeof jetonSession === "string" ? sessions.get(jetonSession) : null;

    if (!session) {
      return {
        statut: 401,
        donnees: { code: "session_absente", erreur: "Session introuvable." },
      };
    }

    // Cas 1 : Session terminée après passage RFID à la sortie (valable pendant 10 minutes)
    if (session.statut === "terminee") {
      if (session.expireSuppressionA && Date.now() > session.expireSuppressionA) {
        sessions.delete(jetonSession);
        return {
          statut: 401,
          donnees: { code: "session_absente", erreur: "Session introuvable." },
        };
      }
      return {
        statut: 200,
        donnees: {
          statut: "terminee",
          entree: session.entreeIso,
          sortie: session.sortieIso,
          duree: session.duree,
          prix: session.prix,
          soldeFinal: session.soldeFinal,
          place: session.place,
          typeClient: session.typeClient,
        },
      };
    }

    // Cas 2 : Session en cours
    const facture = calculerFacture(session);
    const { tarifAbonne } = calculerTarifs();
    const carte = cartes.get(session.uid);
    const soldeActuel = carte ? carte.solde : session.solde;
    const soldeRestant = Math.max(0, arrondirMontant(soldeActuel - facture.prixCalculé));
    const tempsRestantSec = Math.max(0, Math.floor((soldeRestant / tarifAbonne) * 60));

    return {
      statut: 200,
      donnees: {
        statut: "active",
        entree: new Date(session.entree).toISOString(),
        solde: soldeRestant,
        tarif: tarifAbonne,
        tempsRestant: tempsRestantSec,
        tempsRestantSec,
        finEstimee: new Date(Date.now() + tempsRestantSec * 1000).toISOString(),
        place: session.place === "Place 1" ? "Place 1 couverte" : "Place 2",
        pluie: pluieConfirmee,
        etatParking: [
          { nom: "Place 1", etat: session.place === "Place 1" ? "occupée" : "libre" },
          { nom: "Place 2", etat: session.place === "Place 2" ? "occupée" : "libre" },
        ],
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 7. ROUTE CLIENT : POST /api/recharge
  // ---------------------------------------------------------------------------
  if (req.method === "POST" && url === "/api/recharge") {
    const jetonSession = req.headers["x-session-id"];
    const session = typeof jetonSession === "string" ? sessions.get(jetonSession) : null;
    if (!session || session.statut !== "active") {
      return { statut: 401, donnees: { code: "session_absente", erreur: "Aucune session active." } };
    }

    const montant = Number(corps.montant);
    if (![5, 10, 20].includes(montant)) {
      return { statut: 400, donnees: { erreur: "Montant invalide (5, 10 ou 20 DT)." } };
    }

    const carte = cartes.get(session.uid);
    if (carte) {
      carte.solde = arrondirMontant(carte.solde + montant);
      sauvegarderCartes();
      session.solde = carte.solde;
    }

    return { statut: 200, donnees: { solde: session.solde } };
  }

  // ---------------------------------------------------------------------------
  // TOUTE AUTRE ROUTE (y compris POST /api/sortie supprimée et /api/admin/*) RENVOIE 404
  // ---------------------------------------------------------------------------
  return { statut: 404, donnees: { code: "route_introuvable", erreur: "Route API introuvable." } };
}

// =============================================================================
// SERVEUR DE FICHIERS STATIQUES (public/)
// =============================================================================

function servirFichier(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return repondreJson(res, 405, { erreur: "Méthode non autorisée." });
  }

  const cheminUrl = url === "/" ? "/index.html" : url;
  const nomFichier = path.basename(cheminUrl);
  const cheminFichier = path.join(dossierPublic, nomFichier);
  const extension = path.extname(nomFichier);

  if (cheminUrl !== `/${nomFichier}` || !typesMime[extension]) {
    return repondreJson(res, 404, { erreur: "Fichier introuvable." });
  }

  fs.readFile(cheminFichier, (err, contenu) => {
    if (err) {
      return repondreJson(res, 404, { erreur: "Fichier introuvable." });
    }
    res.writeHead(200, {
      "Content-Type": typesMime[extension],
      "Content-Length": contenu.length,
      "Cache-Control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : contenu);
  });
}

// =============================================================================
// INITIALISATION DU SERVEUR HTTP
// =============================================================================

const serveur = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (url.startsWith("/api/")) {
    traiterApi(req, url)
      .then((reponse) => repondreJson(res, reponse.statut, reponse.donnees))
      .catch((e) => {
        console.error("Erreur serveur interne :", e);
        if (!res.headersSent) {
          repondreJson(res, 500, { erreur: "Erreur serveur interne." });
        }
      });
    return;
  }
  servirFichier(req, res, url);
});

serveur.listen(port, "0.0.0.0", () => {
  console.log(`Smart Parking opérationnel sur le port ${port}.`);
  const adresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === "IPv4" && !iface.internal)
    .map((iface) => iface.address);
  console.log(`Adresses IPv4 : ${adresses.join(", ") || "aucune"}`);
  console.log(`Jeton ESP32 : configuré`);
  const cfg = lireConfig();
  console.log(`Tarif Abonné : ${cfg.tarifAbonne} DT/min | Visiteur : ${cfg.tarifAbonne * cfg.coefVisiteur} DT/min`);
});
