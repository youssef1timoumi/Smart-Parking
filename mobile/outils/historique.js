const fs = require("fs");
const path = require("path");

const FICHIER_HISTORIQUE = path.join(__dirname, "..", "data", "historique.json");

function chargerHistorique() {
  try {
    return JSON.parse(fs.readFileSync(FICHIER_HISTORIQUE, "utf8"));
  } catch (e) {
    return [];
  }
}

const historique = chargerHistorique();

console.log(`\n=== HISTORIQUE DU PARKING (${historique.length} entrées/sorties) ===`);
if (historique.length === 0) {
  console.log("Aucune transaction enregistrée pour le moment.\n");
} else {
  console.table(historique.map((h, i) => ({
    "#": i + 1,
    UID: h.uid,
    Nom: h.nom,
    Type: h.type,
    Place: h.place,
    Entrée: h.entree ? new Date(h.entree).toLocaleTimeString("fr-FR") : "-",
    Sortie: h.sortie ? new Date(h.sortie).toLocaleTimeString("fr-FR") : "-",
    "Durée (s)": h.dureeSec || 0,
    "Prix (DT)": h.prix || 0,
  })));
}
