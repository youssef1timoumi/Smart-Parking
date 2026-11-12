const http = require("http");

const TOKEN = process.env.DEVICE_TOKEN;
if (!TOKEN) {
  console.error("Erreur : la variable d'environnement DEVICE_TOKEN doit être définie.");
  process.exit(1);
}
const PORT = Number(process.env.PORT) || 3000;
const DEVICE = process.env.ESP32_DEVICE_ID || "esp32-gate-1";

function envoyerRequete(chemin, methode, corps) {
  return new Promise((resolve, reject) => {
    const donnees = JSON.stringify(corps || {});
    const req = http.request(`http://localhost:${PORT}${chemin}`, {
      method: methode,
      headers: {
        "Content-Type": "application/json",
        "X-Device-Token": TOKEN,
        "Content-Length": Buffer.byteLength(donnees),
      },
    }, (res) => {
      let raw = "";
      res.on("data", chunk => raw += chunk);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw || "{}") });
        } catch (e) {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on("error", reject);
    req.write(donnees);
    req.end();
  });
}

const args = process.argv.slice(2);
const commande = args[0] ? args[0].toLowerCase() : "";

function aide() {
  console.log(`
Usage : node outils/simuler.js <commande> [valeur]

Commandes :
  pluie <on|off>             Simule l'état de la pluie (humidite active/inactive)
  place <1|2> <libre|occupee>
                             Simule l'état physique du capteur sur Place 1 ou Place 2
  carte <UID>                Simule la présentation d'une carte RFID à l'entrée/sortie

Exemples :
  node outils/simuler.js pluie on
  node outils/simuler.js pluie off
  node outils/simuler.js place 1 occupee
  node outils/simuler.js place 1 libre
  node outils/simuler.js carte ABONNE1
  node outils/simuler.js carte VISITEUR1
`);
}

async function executer() {
  if (!commande || commande === "aide" || commande === "--help" || commande === "-h") {
    aide();
    return;
  }

  // 1. SIMULATION PLUIE
  if (commande === "pluie") {
    const etat = args[1] ? args[1].toLowerCase() : "";
    if (etat !== "on" && etat !== "off") {
      console.error("Précisez 'on' ou 'off'. Exemple : node outils/simuler.js pluie on");
      process.exit(1);
    }
    const estHumide = etat === "on";
    const res = await envoyerRequete("/api/capteurs", "POST", { device: DEVICE, pluie: estHumide });
    console.log(`\n[PLUIE] Détection envoyée : ${etat.toUpperCase()} (Réponse HTTP ${res.status})`);
    console.log("Détails serveur :", res.body);
    return;
  }

  // 2. SIMULATION PLACE (CAPTEUR HC-SR04 / KY-032)
  if (commande === "place") {
    const num = args[1];
    const etat = args[2] ? args[2].toLowerCase() : "";
    if ((num !== "1" && num !== "2") || (etat !== "libre" && etat !== "occupee")) {
      console.error("Format : node outils/simuler.js place <1|2> <libre|occupee>");
      process.exit(1);
    }
    const corps = { device: DEVICE };
    if (num === "1") corps.p1 = (etat === "occupee");
    if (num === "2") corps.p2 = (etat === "occupee");

    const res = await envoyerRequete("/api/capteurs", "POST", corps);
    console.log(`\n[CAPTEUR] Place ${num} définie sur : ${etat.toUpperCase()} (HTTP ${res.status})`);
    console.log("Détails serveur :", res.body);
    return;
  }

  // 3. SIMULATION CARTE RFID
  if (commande === "carte") {
    const uid = args[1];
    if (!uid) {
      console.error("Précisez l'UID. Exemple : node outils/simuler.js carte ABONNE1");
      process.exit(1);
    }
    const res = await envoyerRequete("/api/access", "POST", { device: DEVICE, uid });
    console.log(`\n[RFID SCAN] Carte passée : ${uid} (HTTP ${res.status})`);
    console.log("Résultat :");
    console.dir(res.body, { depth: null, colors: true });
    return;
  }

  console.error(`Commande inconnue : ${commande}`);
  aide();
  process.exit(1);
}

executer().catch((err) => {
  console.error("Erreur de connexion au serveur (assurez-vous que 'node server.js' tourne) :", err.message);
  process.exit(1);
});
