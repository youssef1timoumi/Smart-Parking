// =============================================================================
// TEST D'INTÉGRATION COMPLET DU SYSTÈME SMART PARKING
// =============================================================================

const { spawnSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

// -----------------------------------------------------------------------------
// TEST PRÉALABLE : Démarrage sans DEVICE_TOKEN -> Le serveur doit refuser
// -----------------------------------------------------------------------------
const testSansToken = spawnSync(process.execPath, ["server.js"], {
  env: { ...process.env, DEVICE_TOKEN: "" },
  encoding: "utf8",
});

const demarrageSansTokenRefuse = testSansToken.status !== 0 &&
  (testSansToken.stderr.includes("DEVICE_TOKEN") || testSansToken.stdout.includes("DEVICE_TOKEN"));

console.log("===============================================================================");
console.log("TEST PRÉALABLE : DÉMARRAGE SANS JETON");
console.log(`Démarrage sans DEVICE_TOKEN refusé : ${demarrageSansTokenRefuse ? "OUI (Code != 0)" : "NON"}`);
console.log("===============================================================================\n");

// Configuration de l'environnement pour les tests du serveur
process.env.DEVICE_TOKEN = "SECRET_TOKEN_ESP32_VALIDE_TEST_2026";
process.env.ESP32_DEVICE_ID = "esp32-gate-1";
process.env.PORT = "3000";
process.env.DELAI_APPAREIL_SEC = "2"; // 2 secondes pour tester le timeout de contact

const TOKEN = process.env.DEVICE_TOKEN;
const DEVICE = process.env.ESP32_DEVICE_ID;

// Démarrer le serveur
require("./server.js");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requete(chemin, methode, corps = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = corps ? JSON.stringify(corps) : "";
    const req = http.request(`http://localhost:3000${chemin}`, {
      method: methode,
      headers: {
        "Content-Type": "application/json",
        ...(corps ? { "Content-Length": Buffer.byteLength(data) } : {}),
        ...headers,
      },
    }, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(raw);
        } catch (e) {
          json = null;
        }
        resolve({
          status: res.statusCode,
          data: json !== null ? json : raw,
          raw,
        });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const CARTES_INITIALES = [
  { uid: "ABONNE1", nom: "Yassine Mansour", type: "ABONNE", solde: 10.0, bloquee: false },
  { uid: "ABONNE2", nom: "Sarra Ben Ali", type: "ABONNE", solde: 10.0, bloquee: false },
  { uid: "ABONNE3", nom: "Karim Trabelsi", type: "ABONNE", solde: 10.0, bloquee: false },
  { uid: "VISITEUR1", nom: "Visiteur #1", type: "VISITEUR", solde: 0.0, bloquee: false },
  { uid: "VISITEUR2", nom: "Visiteur #2", type: "VISITEUR", solde: 0.0, bloquee: false },
];

function resetCartes() {
  fs.writeFileSync(path.join(__dirname, "data", "cartes.json"), JSON.stringify(CARTES_INITIALES, null, 2), "utf8");
}

async function executerTests() {
  await sleep(1000); // Laisser le serveur démarrer
  resetCartes();

  const resultats = [];
  function valider(testNom, condition, detail = "") {
    resultats.push({ testNom, reussite: Boolean(condition), detail });
    console.log(`${condition ? "✅ SUCCÈS" : "❌ ÉCHEC"} : ${testNom}`);
    if (detail) console.log(`   └─ ${detail}`);
  }

  // 1. Démarrage sans DEVICE_TOKEN
  valider(
    "Démarrage sans DEVICE_TOKEN -> le serveur refuse",
    demarrageSansTokenRefuse,
    `Sortie stderr : ${testSansToken.stderr.trim().split("\n")[0]}`
  );

  // 2. Surveillance ESP32 : Au démarrage -> "attente", après POST /api/capteurs -> "ok", après timeout -> "attente"
  const etatDemarrage = await requete("/api/etat", "GET");
  const attenteAuDepart = etatDemarrage.data.capteurs === "attente";

  // Envoi signal capteur
  await requete("/api/capteurs", "POST", { device: DEVICE, p1: false, p2: false, pluie: false }, { "X-Device-Token": TOKEN });
  const etatApresCapteurs = await requete("/api/etat", "GET");
  const okApresCapteurs = etatApresCapteurs.data.capteurs === "ok";

  // Attente du délai (DELAI_APPAREIL_SEC = 2s -> attente 2.3s)
  await sleep(2300);
  const etatApresTimeout = await requete("/api/etat", "GET");
  const attenteApresTimeout = etatApresTimeout.data.capteurs === "attente";

  valider(
    "Surveillance ESP32 : sans ping ni capteurs pendant le délai -> 'attente', après POST /api/capteurs -> 'ok'",
    attenteAuDepart && okApresCapteurs && attenteApresTimeout,
    `Au départ: "${etatDemarrage.data.capteurs}", Après capteurs: "${etatApresCapteurs.data.capteurs}", Après timeout 2s: "${etatApresTimeout.data.capteurs}"`
  );

  // Réactiver le contact ESP32 pour les tests suivants
  await requete("/api/ping", "POST", { device: DEVICE, ip: "192.168.1.50", rssi: -60, uptimeMs: 12000, lcd: "Pret" }, { "X-Device-Token": TOKEN });

  // 3. Compact JSON sur POST /api/access (aucun saut de ligne, allow:true)
  const accesBrut = await requete("/api/access", "POST", { device: DEVICE, uid: "ABONNE1" }, { "X-Device-Token": TOKEN });
  const sansSautDeLigne = !accesBrut.raw.includes("\n") && !accesBrut.raw.includes("\r");
  const contientAllowTrue = accesBrut.raw.includes('"allow":true');

  valider(
    "Une réponse de POST /api/access ne contient aucun saut de ligne (JSON compact)",
    sansSautDeLigne && contientAllowTrue,
    `Longueur raw: ${accesBrut.raw.length} octets, sans CRLF: ${sansSautDeLigne}, contient "allow":true: ${contientAllowTrue}`
  );

  const codeAbonne1 = accesBrut.data.code;

  // 4. Login et Session active ("statut": "active")
  const resLogin = await requete("/api/login", "POST", { code: codeAbonne1 });
  const sessionIdAbonne1 = resLogin.data.sessionId;
  const sessionActive = await requete("/api/session", "GET", null, { "X-Session-Id": sessionIdAbonne1 });

  valider(
    "Session active -> GET /api/session renvoie statut 'active'",
    sessionActive.status === 200 && sessionActive.data.statut === "active",
    `statut: "${sessionActive.data.statut}", place: "${sessionActive.data.place}", solde: ${sessionActive.data.solde} DT`
  );

  // 5. POST /api/sortie renvoie 404
  const resSortie404 = await requete("/api/sortie", "POST", {}, { "X-Session-Id": sessionIdAbonne1 });
  valider(
    "POST /api/sortie renvoie 404 (la sortie se fait uniquement par la carte)",
    resSortie404.status === 404,
    `Status reçu: HTTP ${resSortie404.status}`
  );

  // 6. Sortie par carte -> GET /api/session renvoie statut "terminee" avec prix et solde
  await sleep(1000); // 1 seconde de stationnement
  const resSortieCarte = await requete("/api/access", "POST", { device: DEVICE, uid: "ABONNE1" }, { "X-Device-Token": TOKEN });
  const sessionTerminee = await requete("/api/session", "GET", null, { "X-Session-Id": sessionIdAbonne1 });

  valider(
    "Sortie par carte -> GET /api/session renvoie statut 'terminee' avec prix et solde",
    resSortieCarte.data.action === "EXIT" &&
    sessionTerminee.status === 200 &&
    sessionTerminee.data.statut === "terminee" &&
    typeof sessionTerminee.data.prix === "number" &&
    typeof sessionTerminee.data.soldeFinal === "number" &&
    Boolean(sessionTerminee.data.entree) &&
    Boolean(sessionTerminee.data.sortie) &&
    typeof sessionTerminee.data.duree === "number" &&
    Boolean(sessionTerminee.data.place) &&
    sessionTerminee.data.typeClient === "ABONNE",
    `statut: "${sessionTerminee.data.statut}", duree: ${sessionTerminee.data.duree}s, prix: ${sessionTerminee.data.prix} DT, soldeFinal: ${sessionTerminee.data.soldeFinal} DT`
  );

  // 7. Non-régression : carte bloquée et solde insuffisant
  const cartesFichier = JSON.parse(fs.readFileSync("data/cartes.json", "utf8"));
  cartesFichier.find(c => c.uid === "ABONNE3").bloquee = true;
  cartesFichier.find(c => c.uid === "ABONNE2").solde = 0.0;
  fs.writeFileSync("data/cartes.json", JSON.stringify(cartesFichier, null, 2), "utf8");

  const resBloquee = await requete("/api/access", "POST", { device: DEVICE, uid: "ABONNE3" }, { "X-Device-Token": TOKEN });
  const resSoldeNul = await requete("/api/access", "POST", { device: DEVICE, uid: "ABONNE2" }, { "X-Device-Token": TOKEN });

  valider(
    "Régression : Carte bloquée et solde insuffisant refusés",
    resBloquee.data.allow === false && resBloquee.data.message === "Carte bloquée" &&
    resSoldeNul.data.allow === false && resSoldeNul.data.message === "Solde insuffisant",
    `Bloquée: "${resBloquee.data.message}", Solde nul: "${resSoldeNul.data.message}"`
  );

  // 8. Non-régression : Visiteur bloqué sur /api/login
  resetCartes();
  const resEntreeVisiteur = await requete("/api/access", "POST", { device: DEVICE, uid: "VISITEUR1" }, { "X-Device-Token": TOKEN });
  const loginVisiteur = await requete("/api/login", "POST", { code: resEntreeVisiteur.data.code });

  valider(
    "Régression : Code visiteur rejeté à la connexion avec message explicite",
    loginVisiteur.status === 403 && loginVisiteur.data.erreur === "Carte visiteur : pas d'application, paiement à la sortie",
    `HTTP ${loginVisiteur.status}: "${loginVisiteur.data.erreur}"`
  );

  // Libérer le visiteur
  await requete("/api/access", "POST", { device: DEVICE, uid: "VISITEUR1" }, { "X-Device-Token": TOKEN });

  // 9. Non-régression : Pluie et attribution place
  console.log("   [Débruitage pluie] Activation humidité continue (attente 3.2s)...");
  await requete("/api/capteurs", "POST", { device: DEVICE, pluie: true }, { "X-Device-Token": TOKEN });
  await sleep(3200);

  const resPluieP1 = await requete("/api/access", "POST", { device: DEVICE, uid: "ABONNE1" }, { "X-Device-Token": TOKEN });
  const resPluiePlein = await requete("/api/access", "POST", { device: DEVICE, uid: "ABONNE2" }, { "X-Device-Token": TOKEN });

  valider(
    "Régression : Pluie active -> Place 1 attribuée, puis parking plein (pluie)",
    resPluieP1.data.place === "Place 1" && resPluiePlein.data.message === "Parking complet (pluie)",
    `1er véhicule: "${resPluieP1.data.place}", 2nd véhicule: "${resPluiePlein.data.message}"`
  );

  // Libérer ABONNE1 et couper la pluie
  await requete("/api/access", "POST", { device: DEVICE, uid: "ABONNE1" }, { "X-Device-Token": TOKEN });
  await requete("/api/capteurs", "POST", { device: DEVICE, pluie: false }, { "X-Device-Token": TOKEN });

  resetCartes();

  console.log("\n===============================================================================");
  const nbSucces = resultats.filter(r => r.reussite).length;
  console.log(`RÉSUMÉ FINAL : ${nbSucces} / ${resultats.length} TESTS RÉUSSIS`);
  console.log("===============================================================================\n");

  process.exit(nbSucces === resultats.length ? 0 : 1);
}

executerTests().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});
