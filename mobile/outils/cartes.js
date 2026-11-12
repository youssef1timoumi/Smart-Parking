const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const FICHIER_CARTES = path.join(__dirname, "..", "data", "cartes.json");

function normaliserUid(uid) {
  if (typeof uid !== "string") return "";
  return uid.trim().toUpperCase().replace(/[\s:]/g, "");
}

function chargerCartes() {
  try {
    return JSON.parse(fs.readFileSync(FICHIER_CARTES, "utf8"));
  } catch (e) {
    return [];
  }
}

function sauvegarderCartes(cartes) {
  fs.mkdirSync(path.dirname(FICHIER_CARTES), { recursive: true });
  fs.writeFileSync(FICHIER_CARTES, JSON.stringify(cartes, null, 2) + "\n", "utf8");
}

const args = process.argv.slice(2);
const commande = args[0] ? args[0].toLowerCase() : "";

function aide() {
  console.log(`
Usage : node outils/cartes.js <commande> [options]

Commandes disponibles :
  lister                     Affiche toutes les cartes enregistrées
  ajouter <uid> <nom> <type> [solde]
                             Ajoute une carte (type : ABONNE ou VISITEUR)
  recharger <uid> <montant>  Recharge le solde d'une carte (en DT)
  bloquer <uid> [true|false] Bloque ou débloque une carte

Exemples :
  node outils/cartes.js lister
  node outils/cartes.js ajouter ABONNE4 "Ali Gharbi" ABONNE 20
  node outils/cartes.js ajouter VISITEUR3 "Touriste" VISITEUR 0
  node outils/cartes.js recharger ABONNE1 15
  node outils/cartes.js bloquer ABONNE2 true
`);
}

if (!commande || commande === "aide" || commande === "--help" || commande === "-h") {
  aide();
  process.exit(0);
}

if (commande === "lister") {
  const cartes = chargerCartes();
  console.log(`\n=== CARTES ENREGISTRÉES (${cartes.length}) ===`);
  console.table(cartes);
  process.exit(0);
}

if (commande === "ajouter") {
  const uid = normaliserUid(args[1]);
  const nom = args[2];
  const type = (args[3] || "ABONNE").toUpperCase();
  const solde = Number(args[4]) || (type === "ABONNE" ? 10.0 : 0.0);

  if (!uid || !nom) {
    console.error("Erreur : UID et nom requis. Exemple : node outils/cartes.js ajouter ABONNE4 \"Mon Nom\" ABONNE 10");
    process.exit(1);
  }

  if (type !== "ABONNE" && type !== "VISITEUR") {
    console.error("Erreur : le type doit être 'ABONNE' ou 'VISITEUR'.");
    process.exit(1);
  }

  const cartes = chargerCartes();
  if (cartes.some(c => normaliserUid(c.uid) === uid)) {
    console.error(`Erreur : la carte avec l'UID ${uid} existe déjà.`);
    process.exit(1);
  }

  cartes.push({
    uid,
    nom,
    type,
    solde,
    bloquee: false,
  });

  sauvegarderCartes(cartes);
  console.log(`✓ Carte ${uid} (${nom} - ${type} - Solde: ${solde} DT) ajoutée avec succès.`);
  process.exit(0);
}

if (commande === "recharger") {
  const uid = normaliserUid(args[1]);
  const montant = Number(args[2]);

  if (!uid || Number.isNaN(montant) || montant <= 0) {
    console.error("Erreur : UID et montant positif requis. Exemple : node outils/cartes.js recharger ABONNE1 15");
    process.exit(1);
  }

  const cartes = chargerCartes();
  const carte = cartes.find(c => normaliserUid(c.uid) === uid);
  if (!carte) {
    console.error(`Erreur : carte ${uid} introuvable.`);
    process.exit(1);
  }

  carte.solde = Math.round((carte.solde + montant) * 100) / 100;
  sauvegarderCartes(cartes);
  console.log(`✓ Carte ${uid} rechargée de +${montant} DT. Nouveau solde : ${carte.solde} DT.`);
  process.exit(0);
}

if (commande === "bloquer") {
  const uid = normaliserUid(args[1]);
  const etatBloque = args[2] === undefined ? true : args[2] === "true" || args[2] === "1";

  if (!uid) {
    console.error("Erreur : UID requis. Exemple : node outils/cartes.js bloquer ABONNE1 true");
    process.exit(1);
  }

  const cartes = chargerCartes();
  const carte = cartes.find(c => normaliserUid(c.uid) === uid);
  if (!carte) {
    console.error(`Erreur : carte ${uid} introuvable.`);
    process.exit(1);
  }

  carte.bloquee = etatBloque;
  sauvegarderCartes(cartes);
  console.log(`✓ Carte ${uid} ${etatBloque ? "BLOQUÉE" : "DÉBLOQUÉE"}.`);
  process.exit(0);
}

console.error(`Commande inconnue : ${commande}`);
aide();
process.exit(1);
