const WIFI_SSID = "ff15";
const WIFI_PASSWORD = "123456788";
const APP_URL = "http://192.168.137.1:3000";
const TAILLE = 29;

function echapperWifi(valeur) {
  return valeur.replace(/[\\;,:\"]/g, "\\$&");
}

function multiplierGf(a, b) {
  let resultat = 0;
  for (let i = 0; i < 8; i += 1) {
    if (b & 1) resultat ^= a;
    const haut = a & 0x80;
    a = (a << 1) & 0xff;
    if (haut) a ^= 0x1d;
    b >>>= 1;
  }
  return resultat;
}

function calculerEcc(donnees, degre) {
  const diviseur = new Array(degre).fill(0);
  diviseur[degre - 1] = 1;
  let racine = 1;
  for (let i = 0; i < degre; i += 1) {
    for (let j = 0; j < degre; j += 1) {
      diviseur[j] = multiplierGf(diviseur[j], racine);
      if (j + 1 < degre) diviseur[j] ^= diviseur[j + 1];
    }
    racine = multiplierGf(racine, 2);
  }
  const reste = new Array(degre).fill(0);
  donnees.forEach((octet) => {
    const facteur = octet ^ reste.shift();
    reste.push(0);
    for (let i = 0; i < degre; i += 1) {
      reste[i] ^= multiplierGf(diviseur[i], facteur);
    }
  });
  return reste;
}

function creerQr(texte) {
  const octets = Array.from(new TextEncoder().encode(texte));
  if (octets.length > 53) throw new Error("Texte trop long pour ce QR code.");

  const bits = [];
  function ajouterBits(valeur, longueur) {
    for (let i = longueur - 1; i >= 0; i -= 1) bits.push((valeur >>> i) & 1);
  }
  ajouterBits(4, 4);
  ajouterBits(octets.length, 8);
  octets.forEach((octet) => ajouterBits(octet, 8));
  const capacite = 55 * 8;
  for (let i = 0; i < Math.min(4, capacite - bits.length); i += 1) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const donnees = [];
  for (let i = 0; i < bits.length; i += 8) {
    donnees.push(bits.slice(i, i + 8).reduce((a, bit) => (a << 1) | bit, 0));
  }
  for (let pad = 0; donnees.length < 55; pad += 1) donnees.push(pad % 2 ? 0x11 : 0xec);
  const mots = donnees.concat(calculerEcc(donnees, 15));
  const grille = Array.from({ length: TAILLE }, () => new Array(TAILLE).fill(false));
  const fixe = Array.from({ length: TAILLE }, () => new Array(TAILLE).fill(false));

  function poserFixe(x, y, noir) {
    if (x >= 0 && y >= 0 && x < TAILLE && y < TAILLE) {
      grille[y][x] = noir;
      fixe[y][x] = true;
    }
  }

  function motifTrouve(cx, cy) {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        const dans = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const bord = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const centre = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        poserFixe(x, y, dans && (bord || centre));
      }
    }
  }

  motifTrouve(3, 3);
  motifTrouve(TAILLE - 4, 3);
  motifTrouve(3, TAILLE - 4);
  for (let i = 8; i < TAILLE - 8; i += 1) {
    poserFixe(i, 6, i % 2 === 0);
    poserFixe(6, i, i % 2 === 0);
  }
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      poserFixe(22 + dx, 22 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  for (let i = 0; i <= 5; i += 1) poserFixe(8, i, false);
  poserFixe(8, 7, false);
  poserFixe(8, 8, false);
  poserFixe(7, 8, false);
  for (let i = 9; i < 15; i += 1) poserFixe(14 - i, 8, false);
  for (let i = 0; i < 8; i += 1) poserFixe(TAILLE - 1 - i, 8, false);
  for (let i = 8; i < 15; i += 1) poserFixe(8, TAILLE - 15 + i, false);
  poserFixe(8, TAILLE - 8, true);

  let bitIndex = 0;
  let versHaut = true;
  for (let droite = TAILLE - 1; droite >= 1; droite -= 2) {
    if (droite === 6) droite = 5;
    for (let vertical = 0; vertical < TAILLE; vertical += 1) {
      const y = versHaut ? TAILLE - 1 - vertical : vertical;
      for (let cote = 0; cote < 2; cote += 1) {
        const x = droite - cote;
        if (fixe[y][x]) continue;
        let noir = bitIndex < mots.length * 8
          && ((mots[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
        bitIndex += 1;
        if ((x + y) % 2 === 0) noir = !noir;
        grille[y][x] = noir;
      }
    }
    versHaut = !versHaut;
  }

  const donneesFormat = (1 << 3);
  let resteFormat = donneesFormat << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if ((resteFormat >>> i) & 1) resteFormat ^= 0x537 << (i - 10);
  }
  const format = ((donneesFormat << 10) | resteFormat) ^ 0x5412;
  function bitFormat(i) {
    return ((format >>> i) & 1) !== 0;
  }
  for (let i = 0; i <= 5; i += 1) grille[i][8] = bitFormat(i);
  grille[7][8] = bitFormat(6);
  grille[8][8] = bitFormat(7);
  grille[8][7] = bitFormat(8);
  for (let i = 9; i < 15; i += 1) grille[8][14 - i] = bitFormat(i);
  for (let i = 0; i < 8; i += 1) grille[8][TAILLE - 1 - i] = bitFormat(i);
  for (let i = 8; i < 15; i += 1) grille[TAILLE - 15 + i][8] = bitFormat(i);
  grille[TAILLE - 8][8] = true;
  return grille;
}

function afficherQr(canvas, texte) {
  try {
    const grille = creerQr(texte);
    const calme = 4;
    const module = 10;
    const dimension = (TAILLE + calme * 2) * module;
    canvas.width = dimension;
    canvas.height = dimension;
    const contexte = canvas.getContext("2d");
    contexte.fillStyle = "#fff";
    contexte.fillRect(0, 0, dimension, dimension);
    contexte.fillStyle = "#14231d";
    grille.forEach((ligne, y) => ligne.forEach((noir, x) => {
      if (noir) contexte.fillRect((x + calme) * module, (y + calme) * module, module, module);
    }));
  } catch (erreur) {
    const message = document.querySelector("#qr-error");
    message.textContent = erreur.message;
    message.hidden = false;
  }
}

const texteWifi = `WIFI:T:WPA;S:${echapperWifi(WIFI_SSID)};P:${echapperWifi(WIFI_PASSWORD)};;`;
document.querySelector("#wifi-name").textContent = WIFI_SSID;
document.querySelector("#application-url").textContent = APP_URL;
afficherQr(document.querySelector("#wifi-qr"), texteWifi);
afficherQr(document.querySelector("#app-qr"), APP_URL);
