// API relative, textes bilingues et navigation sans rechargement.
const API_BASE = "/api";
const CLE_SESSION = "smart-parking-session";
const textes = {
  fr: {
    connected:"Parking connecté",homeEyebrow:"PARKING INTELLIGENT",homeTitle:"Votre place, en toute simplicité.",homeIntro:"Un stationnement fluide, sécurisé et sans attente.",haveCode:"J'ai mon code →",liveEyebrow:"EN TEMPS RÉEL",parkingState:"État du parking",live:"En direct",placeOne:"Place 1",placeTwo:"Place 2",covered:"Couverte",openAir:"Extérieure",rain:"Pluie",currentRate:"Tarif actuel",perMinute:"DT / min",simple:"SIMPLE & RAPIDE",howTitle:"Comment ça marche",seeSteps:"Voir les étapes →",guideEyebrow:"VOTRE PARCOURS",guideIntro:"Quatre étapes pour stationner sereinement.",step1Title:"Présentez votre carte",step1Text:"Approchez votre carte du lecteur à l'entrée.",step2Title:"Saisissez votre code",step2Text:"Entrez le code à six chiffres affiché sur l'écran de la barrière avant la fin du compte à rebours (20 s).",step3Title:"Garez-vous",step3Text:"Rejoignez la place attribuée et suivez votre solde en direct.",step4Title:"Terminez votre session",step4Text:"Repassez votre carte à la sortie : la barrière s'ouvre et votre reçu s'affiche ici.",viewRules:"Consulter les tarifs et règles",clearRules:"SIMPLE ET TRANSPARENT",ratesTitle:"Tarifs et règles",ratesIntro:"Les informations utiles avant de prendre la route.",oneCardTitle:"Une carte par personne",oneCardText:"Chaque conducteur utilise sa propre carte pour accéder au parking.",lostCardTitle:"Carte perdue ?",lostCardText:"Contactez le gérant sur place pour bloquer la carte et protéger votre solde.",backHome:"Retour à l'accueil",back:"Retour",secureAccess:"ACCÈS SÉCURISÉ",enterCode:"Entrez votre code",codeIntro:"Saisissez les six chiffres affichés après le passage de votre carte.",temporaryCode:"Code temporaire",codeExpiry:"Saisissez-le avant la fin du compte à rebours de la barrière",continue:"Continuer →",needHelp:"Besoin d'aide ?",ready:"TOUT EST PRÊT",welcome:"Bienvenue",welcomeIntro:"Votre carte est reconnue. Vous pouvez accéder au parking.",balance:"Solde disponible",availableCredit:"Crédit disponible",access:"Accéder →",liveSession:"EN COURS",sessionTitle:"Votre session",sessionIntro:"Votre solde et votre temps restant sont actualisés en direct.",lowBalance:"Solde faible : rechargez bientôt votre crédit.",remainingTime:"TEMPS RESTANT ESTIMÉ",entryTime:"Heure d'entrée",creditRemaining:"Crédit restant",recharge:"＋ Recharger mon solde",endSession:"Terminer mon stationnement",credit:"CRÉDIT PARKING",rechargeTitle:"Recharger mon solde",rechargeIntro:"Choisissez le montant à ajouter à votre crédit.",amount:"Montant",sessionComplete:"SESSION TERMINÉE",thankYou:"Merci",finishIntro:"Voici le récapitulatif de votre stationnement.",receipt:"REÇU DE STATIONNEMENT",entryDate:"Date d'entrée",exitDate:"Date de sortie",duration:"Durée",priceDebited:"Prix débité",finalBalance:"Solde final",connectionIssue:"CONNEXION",offlineText:"Vérifiez votre connexion Internet et réessayez.",retry:"Réessayer",navHome:"Accueil",navSession:"Session",navHelp:"Aide",free:"Libre",occupied:"Occupée",yes:"Oui",no:"Non",invalidCode:"Le code doit contenir exactement 6 chiffres.",expiredCode:"Code expiré : la barrière est passée en stationnement sans application, paiement à la sortie.",visitorNoApp:"Carte visiteur : pas d'application, paiement à la sortie",    network:"Serveur injoignable. Vérifiez votre connexion Internet.",error:"Une erreur est survenue.",cancelCode:"Annuler",timeRemaining:"Temps restant :",codeExpiredTitle:"Temps écoulé",codeExpiredMessage:"Le temps de saisie est écoulé. Votre stationnement continue sans application : vous payez à la sortie en repassant votre carte.",returnHome:"Retour à l'accueil"
  },
  en: {
    connected:"Parking connected",homeEyebrow:"SMART PARKING",homeTitle:"Parking, made simple.",homeIntro:"A smooth, secure parking experience, without the wait.",haveCode:"I have my code →",liveEyebrow:"REAL-TIME",parkingState:"Parking status",live:"Live",placeOne:"Space 1",placeTwo:"Space 2",covered:"Covered",openAir:"Open air",rain:"Rain",currentRate:"Current rate",perMinute:"DT / min",simple:"SIMPLE & QUICK",howTitle:"How it works",seeSteps:"View the steps →",guideEyebrow:"YOUR JOURNEY",guideIntro:"Four easy steps to park with peace of mind.",step1Title:"Tap your card",step1Text:"Present your card to the reader at the entrance.",step2Title:"Enter your code",step2Text:"Enter the six-digit code shown on the gate screen before its countdown ends (20 s).",step3Title:"Park your car",step3Text:"Go to your assigned space and follow your balance live.",step4Title:"End your session",step4Text:"Tap your card again at the exit: the barrier opens and your receipt appears here.",viewRules:"View rates and rules",clearRules:"SIMPLE AND CLEAR",ratesTitle:"Rates and rules",ratesIntro:"Useful information before you park.",oneCardTitle:"One card per person",oneCardText:"Each driver uses their own card to access the parking.",lostCardTitle:"Lost your card?",lostCardText:"Contact the on-site manager to block the card and protect your balance.",backHome:"Back to home",back:"Back",secureAccess:"SECURE ACCESS",enterCode:"Enter your code",codeIntro:"Enter the six digits shown after tapping your card.",temporaryCode:"Temporary code",codeExpiry:"Enter it before the gate screen countdown ends",continue:"Continue →",needHelp:"Need help?",ready:"YOU'RE ALL SET",welcome:"Welcome",welcomeIntro:"Your card is recognized. You can enter the parking.",balance:"Available balance",availableCredit:"Available credit",access:"Enter parking →",liveSession:"IN PROGRESS",sessionTitle:"Your session",sessionIntro:"Your balance and remaining time update live.",lowBalance:"Low balance: top up your credit soon.",remainingTime:"ESTIMATED TIME LEFT",entryTime:"Entry time",creditRemaining:"Credit remaining",recharge:"＋ Top up balance",endSession:"End parking session",credit:"PARKING CREDIT",rechargeTitle:"Top up your balance",rechargeIntro:"Choose the amount to add to your credit.",amount:"Amount",sessionComplete:"SESSION COMPLETE",thankYou:"Thank you",finishIntro:"Here is your parking summary.",receipt:"PARKING RECEIPT",entryDate:"Entry date",exitDate:"Exit date",duration:"Duration",priceDebited:"Amount charged",finalBalance:"Final balance",connectionIssue:"CONNECTION",offlineText:"Check your internet connection and try again.",retry:"Try again",navHome:"Home",navSession:"Session",navHelp:"Help",free:"Free",occupied:"Occupied",yes:"Yes",no:"No",invalidCode:"The code must contain exactly 6 digits.",expiredCode:"Code expired: the gate switched to no-app parking, you pay at the exit.",visitorNoApp:"Visitor card: no application, payment at exit",    network:"Server unreachable. Check your internet connection.",error:"Something went wrong.",cancelCode:"Cancel",timeRemaining:"Time remaining:",codeExpiredTitle:"Time expired",codeExpiredMessage:"The time to enter the code has run out. Your parking continues without the app: you pay at the exit when you tap your card again.",returnHome:"Back to home"
  }
};
Object.assign(textes.fr, {
  homeTitle: "Trouvez votre place", freeSpaces: "Places libres", yours: "Ma place",
  availableSpaces: "Places disponibles", sensorsUltrasonic: "Capteurs ultrasons",
  rainBannerText: "Pluie : seule la place couverte est ouverte",
  unavailableRain: "Indisponible (pluie)",
  ratesBlockTitle: "Tarifs", withAppLabel: "avec l'application",
  subscriberRateLabel: "Abonné", visitorRateLabel: "Visiteur",
  planTitle: "Plan du parking", planDescription: "Vue de dessus des deux places, la première couverte.",
  codeIntro: "Saisissez les six chiffres affichés sur l'écran du parking.",
  lowBalance: "Il vous reste moins de deux minutes de stationnement.",
  timeExpired: "Votre crédit est épuisé. Rechargez ou terminez votre stationnement.",
  rechargeNow: "Recharger", exitNow: "Terminer",
  attemptsLeft: "Code invalide. Il vous reste {n} essai(s).",
  loginLocked: "Trop de codes incorrects. Réessayez dans {n} minute(s).",
  hourUnit: "h", minuteUnit: "min", secondUnit: "s",
  sensorDetected: "Véhicule détecté par le capteur ultrason !",
  sensorWaiting: "En attente du véhicule (capteur ultrason HC-SR04)…",
  waitingSensors: "En attente des capteurs",
  liveMap: "En direct",
  offlineMap: "Hors ligne",
  barrierOpen: "Ouverte",
  barrierClosed: "Fermée",
  barrierLabel: "Barrière",
  rainDetected: "Pluie détectée",
  dryWeather: "Temps sec",
  yourPlaceLabel: "Votre place",
  tapToSkip: "Touchez pour continuer",
  exitInstruction: "Pour sortir, tapez votre carte sur le lecteur",
  estimatedBalance: "Solde estimé",
  balanceExhausted: "Solde épuisé : sortez maintenant",
  sessionExpiredNotice: "Session terminée ou expirée",
  assignedPlaceLabel: "Place",
  currentBalance: "Solde actuel estimé",
  topUpAmount: "Ajouter au solde",
  rechargeAmount: "Montant à ajouter",
  newBalance: "Nouveau solde estimé",
  paymentSimulation: "Simulation de paiement : aucun paiement réel n'est effectué.",
  confirmRecharge: "Confirmer la recharge"
});
Object.assign(textes.en, {
  homeTitle: "Find your parking spot", freeSpaces: "Free spaces", yours: "My spot",
  availableSpaces: "Available spaces", sensorsUltrasonic: "Ultrasonic sensors",
  rainBannerText: "Rain: only the covered space is open",
  unavailableRain: "Unavailable (rain)",
  ratesBlockTitle: "Rates", withAppLabel: "with the app",
  subscriberRateLabel: "Subscriber", visitorRateLabel: "Visitor",
  planTitle: "Parking map", planDescription: "Top-down view of both spaces; the first space is covered.",
  codeIntro: "Enter the six digits shown on the parking screen.",
  lowBalance: "You have less than two minutes of parking credit left.",
  timeExpired: "Your credit has run out. Top up or end your parking session.",
  rechargeNow: "Top up", exitNow: "Finish",
  attemptsLeft: "Invalid code. {n} attempt(s) remaining.",
  loginLocked: "Too many incorrect codes. Try again in {n} minute(s).",
  hourUnit: "h", minuteUnit: "min", secondUnit: "s",
  sensorDetected: "Vehicle detected by ultrasonic sensor!",
  sensorWaiting: "Waiting for vehicle (HC-SR04 ultrasonic sensor)…",
  waitingSensors: "Waiting for sensors",
  liveMap: "Live",
  offlineMap: "Offline",
  barrierOpen: "Open",
  barrierClosed: "Closed",
  barrierLabel: "Barrier",
  rainDetected: "Rain detected",
  dryWeather: "Dry weather",
  yourPlaceLabel: "Your spot",
  tapToSkip: "Tap to continue",
  exitInstruction: "To exit, tap your card on the reader",
  estimatedBalance: "Estimated balance",
  balanceExhausted: "Balance exhausted: exit now",
  sessionExpiredNotice: "Session ended or expired",
  assignedPlaceLabel: "Spot",
  currentBalance: "Estimated current balance",
  topUpAmount: "Add to balance",
  rechargeAmount: "Amount to add",
  newBalance: "Estimated new balance",
  paymentSimulation: "Payment simulation: no real payment will be processed.",
  inactivityTitle: "Session inactive",
  inactivityWarning: "Session inactive. Logging out in",
  secondsUnit: "seconds...",
  stayConnected: "Stay connected",
  receiptAutoHome: "Returning to the home screen in {n}s...",
  confirmRecharge: "Confirm top-up"
});
Object.assign(textes.fr, {
  inactivityTitle: "Session inactive",
  inactivityWarning: "Session inactive. Déconnexion dans",
  secondsUnit: "secondes...",
  stayConnected: "Rester connecté",
  receiptAutoHome: "Retour automatique à l'accueil dans {n}s..."
});
// Tariffs, planned stay and "Quit parking".
Object.assign(textes.fr, {
  ratePlanned: "App · durée choisie", rateFree: "App · temps libre", rateNoApp: "Sans application",
  perHour: "DT / h", perBlock: "DT / {n} min",
  ratesExplain: "Indiquez combien de temps vous restez pour payer moins. Au-delà de la durée choisie, le tarif libre s'applique.",
  demoNote: "Mode démo : le temps est accéléré ×{n} (1 h facturée en {s}).",
  planEyebrow: "VOTRE STATIONNEMENT", planChoiceTitle: "Combien de temps restez-vous ?",
  planChoiceIntro: "Choisissez une durée pour payer moins. Vous pouvez partir avant ; au-delà, le tarif libre s'applique.",
  planFree: "Temps libre", planFreeHint: "Sans limite · {r} DT / h", planEstimate: "≈ {c} DT max",
  planConfirm: "Valider →", planPick: "Choisissez une durée.",
  planLabelPlanned: "Durée choisie : {d} · {r} DT/h", planLabelFree: "Temps libre · {r} DT/h",
  planLabelOver: "Dépassement · {r} DT/h", planReceipt: "Formule",
  costSoFar: "Coût actuel", timeLeftPlanned: "TEMPS RESTANT (DURÉE CHOISIE)", timeLeftFree: "AUTONOMIE DU SOLDE",
  planEnding: "Votre durée choisie se termine bientôt. Ensuite, le tarif libre s'applique.",
  planOvertime: "Durée choisie dépassée : le tarif libre s'applique maintenant.",
  quitParking: "Quitter le parking", quitConfirm: "Appuyez encore pour confirmer la sortie",
  quitDone: "Sortie enregistrée : la barrière de sortie s'ouvre.",
  quitGateOffline: "Sortie enregistrée. La barrière est hors ligne : présentez-vous au gérant.",
  exitInstruction: "Pour sortir : tapez votre carte sur le lecteur, ou touchez « Quitter le parking ».",
  step4Text: "Repassez votre carte à la sortie ou touchez « Quitter le parking » : la barrière s'ouvre et votre reçu s'affiche."
});
Object.assign(textes.en, {
  ratePlanned: "App · planned stay", rateFree: "App · free time", rateNoApp: "Without the app",
  perHour: "DT / h", perBlock: "DT / {n} min",
  ratesExplain: "Say how long you'll stay to pay less. After the planned time, the free-time rate applies.",
  demoNote: "Demo mode: time runs ×{n} faster (1 h billed in {s}).",
  planEyebrow: "YOUR STAY", planChoiceTitle: "How long are you staying?",
  planChoiceIntro: "Pick a duration to pay less. You can leave earlier; after it, the free-time rate applies.",
  planFree: "Free time", planFreeHint: "No limit · {r} DT / h", planEstimate: "≈ {c} DT max",
  planConfirm: "Confirm →", planPick: "Pick a duration.",
  planLabelPlanned: "Planned: {d} · {r} DT/h", planLabelFree: "Free time · {r} DT/h",
  planLabelOver: "Overtime · {r} DT/h", planReceipt: "Plan",
  costSoFar: "Cost so far", timeLeftPlanned: "TIME LEFT (PLANNED)", timeLeftFree: "BALANCE LASTS",
  planEnding: "Your planned time ends soon. After it, the free-time rate applies.",
  planOvertime: "Planned time exceeded: the free-time rate applies now.",
  quitParking: "Quit parking", quitConfirm: "Tap again to confirm you're leaving",
  quitDone: "Exit recorded: the exit barrier is opening.",
  quitGateOffline: "Exit recorded. The gate is offline: please see the manager.",
  exitInstruction: "To exit: tap your card on the reader, or tap “Quit parking”.",
  step4Text: "Tap your card at the exit or tap “Quit parking”: the barrier opens and your receipt appears."
});

const pages = Array.from(document.querySelectorAll(".page"));
const codeInput = document.querySelector("#code");
const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#login-button");
const connectionAlert = document.querySelector("#connection-alert");
let langue = localStorage.getItem("smart-parking-lang") || "fr";
let client = "";
let carteLue = false;
let codeValide = false;
let sessionActive = false;
let sessionCloturee = false;
let sessionTimer = null;
let codeTimer = null;
let codeExpireA = 0;
let codeExpiryRedirectTimer = null;
let soldeReference = 0;
let soldeMaximum = 0;
let instantReference = 0;
let tarifMinute = 0;
let tempsRestantReference = 0;
let coutReference = 0;          // what the stay has cost at instantReference (server)
let sessionId = "";
let entreeSession = null;
let dernieresDonneesSession = null;
let etatAccueil = null;
let dernierContactEtat = Date.now();
let livePollingTimer = null;
let actionEnEchec = null;
let minuteurErreur = null;
let sessionSyncTimer = null;
let pageCourante = null;
let inactivityTimer = null;
let inactivityCountdownTimer = null;
let inactivityDeadline = 0;
let receiptTimer = null;
let receiptCountdownTimer = null;
let receiptDeadline = 0;
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;
const INACTIVITY_WARNING_MS = 15 * 1000;
const RECEIPT_TIMEOUT_MS = 30 * 1000;

function t(cle) {
  return textes[langue][cle] || textes.fr[cle] || cle;
}

function traduire() {
  document.documentElement.lang = langue;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const cle = element.dataset.i18n;
    element.textContent = t(cle);
  });
  document.querySelectorAll(".lang-button").forEach((bouton) => {
    bouton.classList.toggle("is-active", bouton.dataset.lang === langue);
    bouton.setAttribute("aria-pressed", String(bouton.dataset.lang === langue));
  });
  document.querySelector(".language-switch").setAttribute("aria-label", langue === "fr" ? "Langue" : "Language");
  document.querySelector("#offline-title").textContent = langue === "fr" ? "ESP32 injoignable" : "ESP32 unreachable";
  actualiserRecapRecharge();
  if (etatAccueil) afficherEtatParking(etatAccueil);
  if (dernieresDonneesSession) afficherPlanSession(dernieresDonneesSession);
  mettreAJourParcours(dernieresDonneesSession, etatAccueil ? etatAccueil.etatParking : []);
}

function dt(montant) {
  return `${new Intl.NumberFormat(langue === "fr" ? "fr-FR" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(montant)} DT`;
}

function nombreDt(montant) {
  return new Intl.NumberFormat(langue === "fr" ? "fr-FR" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(montant);
}

function duree(secondes) {
  const total = Math.max(0, Math.floor(secondes));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${String(m).padStart(2, "0")} min ${String(s).padStart(2, "0")} s`;
}

function formaterTempsRestant(secondes) {
  const total = Math.max(0, Math.floor(secondes));
  const heures = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const reste = total % 60;
  return `${heures} ${t("hourUnit")} ${minutes} ${t("minuteUnit")} ${String(reste).padStart(2, "0")} ${t("secondUnit")}`;
}

function soldeSessionEstime() {
  const ecoule = Math.max(0, (Date.now() - instantReference) / 60000);
  return Math.max(0, soldeReference - ecoule * tarifMinute);
}

function actualiserRecapRecharge(soldeCourant = soldeSessionEstime()) {
  const montantSelectionne = Number(new FormData(document.querySelector("#recharge-form")).get("montant")) || 0;
  const soldeEl = document.querySelector("#recharge-current-balance");
  const montantEl = document.querySelector("#recharge-amount-preview");
  const nouveauSoldeEl = document.querySelector("#recharge-new-balance");
  const boutonMontant = document.querySelector("#selected-amount");
  if (soldeEl) soldeEl.textContent = dt(soldeCourant);
  if (montantEl) montantEl.textContent = dt(montantSelectionne);
  if (nouveauSoldeEl) nouveauSoldeEl.textContent = dt(soldeCourant + montantSelectionne);
  if (boutonMontant) boutonMontant.textContent = `${montantSelectionne} DT`;
}

function sauvegarder(etat, extra = {}) {
  try {
    localStorage.setItem(CLE_SESSION, JSON.stringify({ etat, nom: client, sessionId, ...extra }));
  } catch (erreur) {
    console.warn("Session locale indisponible :", erreur);
  }
}

function supprimerSauvegarde() {
  localStorage.removeItem(CLE_SESSION);
}

function afficherPage(id) {
  const changementPage = pageCourante !== id;
  pages.forEach((page) => {
    const actif = page.id === `page-${id}`;
    page.hidden = !actif;
    page.classList.toggle("page-active", actif);
  });
  pageCourante = id;
  document.querySelectorAll(".nav-item").forEach((bouton) => {
    bouton.classList.toggle("is-active", bouton.dataset.pageLink === id || (id === "rates" && bouton.dataset.pageLink === "help"));
  });
  if (changementPage) {
    if (id === "finish") demarrerCompteRecu();
    else arreterCompteRecu();
    actualiserSurveillanceInactivite();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function arreterSurveillanceInactivite() {
  clearTimeout(inactivityTimer);
  clearInterval(inactivityCountdownTimer);
  inactivityTimer = null;
  inactivityCountdownTimer = null;
  inactivityDeadline = 0;
  document.querySelector("#session-idle-modal").hidden = true;
}

function deconnecterApresInactivite() {
  arreterSurveillanceInactivite();
  retournerAccueilNeutre();
}

function actualiserCompteAReboursInactivite() {
  const secondes = Math.max(0, Math.ceil((inactivityDeadline - Date.now()) / 1000));
  document.querySelector("#session-idle-countdown").textContent = String(secondes);
  if (secondes === 0) deconnecterApresInactivite();
}

function afficherAvertissementInactivite() {
  if (!sessionActive || sessionCloturee) return;
  inactivityDeadline = Date.now() + INACTIVITY_WARNING_MS;
  const modal = document.querySelector("#session-idle-modal");
  modal.hidden = false;
  document.querySelector("#stay-connected").focus();
  actualiserCompteAReboursInactivite();
  inactivityCountdownTimer = setInterval(actualiserCompteAReboursInactivite, 1000);
  inactivityTimer = setTimeout(deconnecterApresInactivite, INACTIVITY_WARNING_MS);
}

function programmerInactivite() {
  clearTimeout(inactivityTimer);
  inactivityTimer = null;
  if (!sessionActive || sessionCloturee || pageCourante === "finish") return;
  inactivityTimer = setTimeout(afficherAvertissementInactivite, INACTIVITY_TIMEOUT_MS);
}

function actualiserSurveillanceInactivite() {
  if (!sessionActive || sessionCloturee || pageCourante === "finish") {
    arreterSurveillanceInactivite();
    return;
  }
  if (document.querySelector("#session-idle-modal").hidden) programmerInactivite();
}

function enregistrerActiviteUtilisateur() {
  if (!sessionActive || sessionCloturee || pageCourante === "finish") return;
  if (!document.querySelector("#session-idle-modal").hidden) return;
  programmerInactivite();
}

function resterConnecte() {
  arreterSurveillanceInactivite();
  programmerInactivite();
}

function arreterCompteRecu() {
  clearTimeout(receiptTimer);
  clearInterval(receiptCountdownTimer);
  receiptTimer = null;
  receiptCountdownTimer = null;
  receiptDeadline = 0;
}

function actualiserCompteRecu() {
  if (!receiptDeadline) return;
  const secondes = Math.max(0, Math.ceil((receiptDeadline - Date.now()) / 1000));
  document.querySelector("#finish-home-countdown").textContent =
    t("receiptAutoHome").replace("{n}", String(secondes));
  if (secondes === 0) retournerAccueilNeutre();
}

function demarrerCompteRecu() {
  arreterCompteRecu();
  receiptDeadline = Date.now() + RECEIPT_TIMEOUT_MS;
  actualiserCompteRecu();
  receiptCountdownTimer = setInterval(actualiserCompteRecu, 1000);
  receiptTimer = setTimeout(retournerAccueilNeutre, RECEIPT_TIMEOUT_MS);
}

function reinitialiserSessionLocale() {
  arreterSurveillanceInactivite();
  arreterCompteRecu();
  clearInterval(sessionTimer);
  clearInterval(sessionSyncTimer);
  clearTimeout(minuteurBienvenue);
  sessionTimer = null;
  sessionSyncTimer = null;
  minuteurBienvenue = null;
  sessionActive = false;
  sessionCloturee = false;
  carteLue = false;
  codeValide = false;
  client = "";
  sessionId = "";
  soldeReference = 0;
  soldeMaximum = 0;
  instantReference = 0;
  tarifMinute = 0;
  tempsRestantReference = 0;
  entreeSession = null;
  dernieresDonneesSession = null;
  supprimerSauvegarde();
  reinitialiserSaisieCode();
  [
    "#customer-name",
    "#welcome-balance",
    "#welcome-place",
    "#session-balance",
    "#entry-time",
    "#time-remaining",
    "#finish-name",
    "#finish-place",
    "#finish-entry-date",
    "#finish-exit-date",
    "#finish-duration",
    "#finish-price",
    "#finish-balance"
  ].forEach((selecteur) => {
    const element = document.querySelector(selecteur);
    if (element) element.textContent = "—";
  });
}

function retournerAccueilNeutre() {
  reinitialiserSessionLocale();
  afficherPage("home");
  chargerEtatAccueil();
  mettreAJourParcours(null, etatAccueil ? etatAccueil.etatParking : []);
}

window.addEventListener("click", enregistrerActiviteUtilisateur);
window.addEventListener("scroll", enregistrerActiviteUtilisateur, { passive: true });
window.addEventListener("touchstart", enregistrerActiviteUtilisateur, { passive: true });
window.addEventListener("keydown", enregistrerActiviteUtilisateur);

function erreurElement(id, message, estInfo = false) {
  const selecteur = id.startsWith("#") ? id : `#${id}`;
  let element = document.querySelector(selecteur);
  if (!element && !id.endsWith("-error")) {
    element = document.querySelector(`${selecteur}-error`);
  }
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  if (estInfo) {
    element.classList.remove("error-message");
    element.classList.add("info-message");
  } else {
    element.classList.remove("info-message");
    element.classList.add("error-message");
  }
}

async function api(route, options = {}) {
  let reponse;
  try {
    reponse = await fetch(`/api${route}`, {
      ...options,
      signal: AbortSignal.timeout(3000),
      cache: "no-store",                 // never reuse an old answer (e.g. a previous session's 410)
      headers: {
        "Content-Type": "application/json",
        ...(sessionId && ["/session", "/recharge", "/session/plan", "/sortie"].includes(route)
          ? { "X-Session-Id": sessionId }
          : {}),
        ...options.headers,
      },
    });
  } catch (erreur) {
    if (erreur.name === "AbortError" || erreur.name === "TimeoutError" || erreur.name === "TypeError") {
      throw Object.assign(new Error(t("network")), { reseau: true });
    }
    throw erreur;
  }
  const donnees = await reponse.json();
  if (!reponse.ok) {
    throw Object.assign(new Error(donnees.erreur || t("error")), { statut: reponse.status, ...donnees });
  }
  connectionAlert.hidden = true;
  clearTimeout(minuteurErreur);
  minuteurErreur = null;
  return donnees;
}

function planifierRetry() {
  clearTimeout(minuteurErreur);
  minuteurErreur = setTimeout(async () => {
    if (!actionEnEchec) return;
    await executerActionEchec();
    if (document.querySelector("#page-offline").hidden) return;
    if (actionEnEchec) planifierRetry();
  }, 3000);
}

async function executerActionEchec() {
  const action = actionEnEchec;
  if (!action) return;
  actionEnEchec = null;
  await action();
  if (!actionEnEchec && !document.querySelector("#page-offline").hidden) {
    afficherPage("home");
  }
}

function traiterErreur(erreur, id) {
  if (id === "code" && erreur.code === "code_expire") {
    afficherExpirationCode();
    return;
  }
  if (erreur.code === "session_terminee") {
    afficherFinEtCloturer(erreur);
    return;
  }
  if (erreur.reseau) {
    clearInterval(sessionSyncTimer);
    sessionSyncTimer = null;
    actionEnEchec = () => relancerDepuisPage(id);
    afficherPage("offline");
    planifierRetry();
    return;
  }
  const estVisiteurSansApp = erreur.code === "visiteur_sans_application";
  const traductionsErreur = {
    code_invalide: erreur.tentativesRestantes
      ? t("attemptsLeft").replace("{n}", String(erreur.tentativesRestantes))
      : (langue === "fr" ? "Code invalide ou déjà utilisé. Vérifiez les chiffres affichés." : "Invalid or already used code. Check the displayed digits."),
    code_expire: t("expiredCode"),
    login_bloque: t("loginLocked").replace("{n}", String(Math.max(1, Math.ceil((erreur.blocageSecondes || 60) / 60)))),
    carte_bloquee: langue === "fr" ? "Cette carte est bloquée. Contactez le gérant." : "This card is blocked. Contact the manager.",
    solde_insuffisant: langue === "fr" ? "Solde insuffisant. Contactez le gérant pour recharger." : "Insufficient balance. Contact the manager to top up.",
    parking_plein: langue === "fr" ? "Le parking est complet. Aucune place n'est disponible." : "The parking is full. No spaces are available.",
    visiteur_sans_application: t("visitorNoApp") || (langue === "fr"
      ? "Carte visiteur : pas d'application, paiement à la sortie"
      : "Visitor card: no application, payment at exit")
  };
  const cibleId = id.endsWith("-error") ? id : `${id}-error`;
  erreurElement(cibleId, traductionsErreur[erreur.code] || erreur.message, false);
}

async function relancerDepuisPage(id) {
  if (id === "home") {
    await chargerEtatAccueil();
    if (actionEnEchec === null) afficherPage("home");
  }
  else if (id === "code") await envoyerCode();
  else if (id === "welcome") await demarrerSession();
  else if (id === "session") await actualiserSession();
  else if (id === "recharge") await recharger();
  else if (id === "finish") afficherPage("finish");
}

async function chargerEtatAccueil() {
  try {
    const etat = await api("/etat");
    etatAccueil = etat;
    dernierContactEtat = Date.now();
    afficherEtatParking(etat);
  } catch (erreur) {
    dernierContactEtat = 0;
    mettreAJourPlan(document.querySelector("#home-plan"), [], "", { capteurs: "erreur", barriere: "fermee", pluie: false });
    const homeFreeCount = document.querySelector("#home-free-count");
    if (homeFreeCount) homeFreeCount.textContent = "—";
    const homeRain = document.querySelector("#home-rain");
    if (homeRain) homeRain.textContent = "—";
    remplirTarifs(null);
    const homeRainBanner = document.querySelector("#home-rain-banner");
    if (homeRainBanner) homeRainBanner.hidden = true;
    if (erreur.reseau) {
      actionEnEchec = chargerEtatAccueil;
      afficherPage("offline");
      planifierRetry();
    } else {
      console.error("Impossible de charger l'état du parking :", erreur);
    }
  }
}

function mettreAJourParcours(session, places) {
  const elStep1 = document.querySelector("#step-1");
  const elStep2 = document.querySelector("#step-2");
  const elStep3 = document.querySelector("#step-3");
  const elStep4 = document.querySelector("#step-4");
  const elSensorMsg = document.querySelector("#step3-sensor-msg");

  if (!elStep1 || !elStep2 || !elStep3 || !elStep4) return;

  const sessionData = session || dernieresDonneesSession;
  const placesData = (Array.isArray(places) && places.length > 0)
    ? places
    : (sessionData && Array.isArray(sessionData.etatParking) && sessionData.etatParking.length > 0)
      ? sessionData.etatParking
      : (etatAccueil && Array.isArray(etatAccueil.etatParking))
        ? etatAccueil.etatParking
        : [];

  // Étape 1 (Carte) : Statut 'completed' dès qu'une carte est lue/associée
  const aCarte = Boolean(client || sessionId || sessionCloturee || carteLue);
  elStep1.dataset.step = aCarte ? "completed" : "active";

  // Étape 2 (Code) : Statut 'completed' dès que le code est validé et la session active
  const aCodeValide = Boolean(sessionCloturee || (sessionId && (sessionActive || (sessionData && sessionData.entree))));
  if (aCodeValide) {
    elStep2.dataset.step = "completed";
  } else if (aCarte) {
    elStep2.dataset.step = "active";
  } else {
    elStep2.dataset.step = "pending";
  }

  // Étape 3 (HC-SR04) : Passe à 'completed' dès que les capteurs indiquent que la place attribuée est occupée
  const placeAttribuee = sessionData && typeof sessionData.place === "string" ? sessionData.place : "";
  const placeInfo = placesData.find((p) => placeAttribuee && placeAttribuee.startsWith(p.nom));
  const estOccupee = placeInfo ? (placeInfo.etat === "occupée" || placeInfo.etat === "occupied") : false;

  if (sessionCloturee) {
    elStep3.dataset.step = "completed";
    if (elSensorMsg) elSensorMsg.textContent = t("sensorDetected");
  } else if (aCodeValide) {
    if (estOccupee) {
      elStep3.dataset.step = "completed";
      if (elSensorMsg) elSensorMsg.textContent = t("sensorDetected");
    } else {
      elStep3.dataset.step = "active";
      if (elSensorMsg) {
        elSensorMsg.textContent = placeAttribuee
          ? (langue === "fr" ? `En attente du véhicule sur ${placeAttribuee} (capteur HC-SR04)…` : `Waiting for vehicle on ${placeAttribuee} (HC-SR04 sensor)…`)
          : t("sensorWaiting");
      }
    }
  } else {
    elStep3.dataset.step = "pending";
    if (elSensorMsg) elSensorMsg.textContent = t("sensorWaiting");
  }

  // Étape 4 (Fin) : Active pendant le stationnement, 'completed' quand la session est clôturée
  if (sessionCloturee) {
    elStep4.dataset.step = "completed";
  } else if (aCodeValide) {
    elStep4.dataset.step = "active";
  } else {
    elStep4.dataset.step = "pending";
  }
}


function actualiserCartesPlaces(places, placeAttribuee = "") {
  [
    { nom: "Place 1", capteur: "HC-SR04", cardId: "#card-place-1", badgeId: "#p1-badge", telId: "#p1-telemetry-text" },
    { nom: "Place 2", capteur: "HC-SR04", cardId: "#card-place-2", badgeId: "#p2-badge", telId: "#p2-telemetry-text" }
  ].forEach((spot) => {
    const cardEl = document.querySelector(spot.cardId);
    const badgeEl = document.querySelector(spot.badgeId);
    const telEl = document.querySelector(spot.telId);
    if (!cardEl) return;

    const data = places.find((p) => p.nom === spot.nom);
    const estMaPlace = Boolean(placeAttribuee && placeAttribuee.startsWith(spot.nom));
    const estOccupee = data && data.etat !== "libre";
    const estBloqueePluie = spot.nom === "Place 2" && !estMaPlace && !estOccupee && data && data.disponible === false && (data.raison === "pluie" || (etatAccueil && etatAccueil.pluie));

    const state = estMaPlace ? "yours" : estBloqueePluie ? "rain-disabled" : estOccupee ? "occupied" : "free";
    cardEl.dataset.state = state;

    if (badgeEl) {
      badgeEl.textContent = state === "yours" ? t("yours") : state === "rain-disabled" ? t("unavailableRain") : state === "occupied" ? t("occupied") : t("free");
    }

    if (telEl) {
      const capteur = spot.capteur;
      const texteEtat = state === "yours" ? t("yours") : state === "rain-disabled" ? t("unavailableRain") : state === "occupied" ? t("occupied") : t("free");
      telEl.textContent = `${capteur} : ${texteEtat}`;
    }
  });
}

function afficherEtatParking(donnees) {
  const places = donnees.etatParking || [];
  const placeAttribuee = dernieresDonneesSession && typeof dernieresDonneesSession.place === "string"
    ? dernieresDonneesSession.place
    : "";

  mettreAJourPlan(document.querySelector("#home-plan"), places, placeAttribuee, donnees);
  actualiserCartesPlaces(places, placeAttribuee);

  // a) La tuile "Places disponibles" compte seulement les places avec disponible = true
  const freeCount = places.filter((place) => place.disponible === true).length;
  const elFreeCount = document.querySelector("#home-free-count");
  if (elFreeCount) elFreeCount.textContent = String(freeCount);

  // b) Si pluie est vrai, affiche en haut de l'accueil un bandeau "Pluie : seule la place couverte est ouverte" (FR et EN). Il disparaît quand il ne pleut plus.
  const rainBanner = document.querySelector("#home-rain-banner");
  if (rainBanner) {
    rainBanner.hidden = !donnees.pluie;
  }

  // Alerte capteurs ESP32 si muet > 15s (statut "attente")
  const alerteConnexion = document.querySelector("#connection-alert");
  if (alerteConnexion) {
    if (donnees.capteurs === "attente" || (donnees.materiel && donnees.materiel.enLigne === false)) {
      alerteConnexion.textContent = t("waitingSensors");
      alerteConnexion.hidden = false;
    } else {
      alerteConnexion.hidden = true;
    }
  }

  const weatherIcon = document.querySelector("#home-weather-icon");
  const rainSub = document.querySelector("#home-rain-sub");
  const rainMain = document.querySelector("#home-rain");

  if (donnees.pluie) {
    if (weatherIcon) weatherIcon.textContent = "🌧️";
    if (rainMain) rainMain.textContent = langue === "fr" ? "Pluie active" : "Rain detected";
    if (rainSub) rainSub.textContent = langue === "fr" ? "Conditions : Pluie détectée / Sol humide" : "Conditions: Rain / Wet surface";
  } else {
    if (weatherIcon) weatherIcon.textContent = "☀️";
    if (rainMain) rainMain.textContent = langue === "fr" ? "Temps sec" : "Dry weather";
    if (rainSub) rainSub.textContent = langue === "fr" ? "Conditions : Temps sec / Opérationnel" : "Conditions: Dry weather / Optimal";
  }

  // c) Tarifs (the backend's one table, also on the dashboard), always shown.
  remplirTarifs(donnees.tarifs);

  mettreAJourParcours(dernieresDonneesSession, places);
}

// Fills every [data-tarif] (home, rates page, duration picker) from /api/etat "tarifs".
// The "-X% avec l'application" badge = planned app rate vs no-app.
function remplirTarifs(tarifs) {
  const ok = tarifs && Number.isFinite(tarifs.planifie);
  const set = (cle, texte) => document.querySelectorAll(`[data-tarif="${cle}"]`).forEach((el) => { el.textContent = texte; });
  set("planifie", ok ? nombreDt(tarifs.planifie) : "—");
  set("libre", ok ? nombreDt(tarifs.libre) : "—");
  set("sansApp", ok ? nombreDt(tarifs.sansApp.prix) : "—");
  set("sansAppBloc", t("perBlock").replace("{n}", ok ? String(tarifs.sansApp.minutes) : "30"));
  document.querySelectorAll('[data-tarif="demo"]').forEach((el) => {
    el.hidden = !(ok && tarifs.demo);
    if (ok && tarifs.demo) {
      const s = Math.round(3600 / tarifs.echelle);
      el.textContent = t("demoNote").replace("{n}", String(tarifs.echelle)).replace("{s}", s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);
    }
  });
  const elBadge = document.querySelector("#rates-discount-badge");
  const elDiscountVal = document.querySelector("#rates-discount-value");
  if (elBadge && elDiscountVal) {
    elBadge.hidden = !(ok && tarifs.remisePlanifie > 0);
    elDiscountVal.textContent = ok ? `-${tarifs.remisePlanifie}%` : "";
  }
}

function mettreAJourPlan(plan, places, placeAttribuee = "", donneesGlobales = null) {
  if (!plan) return;
  const isSession = plan.id === "session-plan";
  const pfx = isSession ? "s-" : "";
  const bpfx = isSession ? "sbadge-" : "badge-";

  // Mise à jour de chaque place
  plan.querySelectorAll(".parking-spot").forEach((spot) => {
    const nom = spot.dataset.place;
    const donneesPlace = places.find((place) => place.nom === nom);
    const estMaPlace = Boolean(placeAttribuee && placeAttribuee.startsWith(nom));
    const estOccupee = donneesPlace && donneesPlace.etat !== "libre";
    const estBloqueePluie = nom === "Place 2" && !estMaPlace && !estOccupee && donneesPlace && donneesPlace.disponible === false && (donneesPlace.raison === "pluie" || (donneesGlobales && donneesGlobales.pluie));

    const etat = estMaPlace ? "yours" : estBloqueePluie ? "rain-disabled" : estOccupee ? "occupied" : "free";
    spot.dataset.state = etat;
    const bayStateEl = spot.querySelector(".bay-state");
    if (bayStateEl) bayStateEl.textContent = estBloqueePluie ? t("unavailableRain") : t(etat);

    // Diodes LED des capteurs
    if (nom === "Place 1") {
      const ledL = document.querySelector("#" + pfx + "led-p1-l");
      const ledR = document.querySelector("#" + pfx + "led-p1-r");
      const couleur = etat === "occupied" ? "#ef4444" : etat === "yours" ? "#ffc94c" : "#56d79b";
      if (ledL) ledL.setAttribute("fill", couleur);
      if (ledR) ledR.setAttribute("fill", couleur);
    } else if (nom === "Place 2") {
      const led2 = document.querySelector("#" + pfx + "led-p2");
      const couleur = estBloqueePluie ? "#64748b" : etat === "occupied" ? "#ef4444" : etat === "yours" ? "#ffc94c" : "#56d79b";
      if (led2) led2.setAttribute("fill", couleur);
    }
  });

  if (!donneesGlobales) return;

  // 1. Barrière physique SG90 (bras pivotant et pastille)
  const barriereOuverte = donneesGlobales.barriere === "ouverte" || (donneesGlobales.materiel && donneesGlobales.materiel.barriereOuverte);
  const barrierArmGroup = document.querySelector(isSession ? "#s-barrier-arm-group" : "#barrier-arm-group");
  const ledBarrier = document.querySelector(isSession ? "#s-led-barrier" : "#led-barrier");
  const badgeBarrierDot = document.querySelector("#" + bpfx + "barrier .plan-badge-dot");
  const badgeBarrierText = document.querySelector("#" + bpfx + "barrier-text");

  if (barrierArmGroup) {
    barrierArmGroup.style.transform = barriereOuverte ? "rotate(-90deg)" : "rotate(0deg)";
  }
  if (ledBarrier) {
    ledBarrier.setAttribute("fill", barriereOuverte ? "#56d79b" : "#ef4444");
  }
  if (badgeBarrierDot) {
    badgeBarrierDot.className = "plan-badge-dot " + (barriereOuverte ? "plan-badge-dot--green" : "plan-badge-dot--red");
  }
  if (badgeBarrierText) {
    badgeBarrierText.textContent = t("barrierLabel") + " : " + (barriereOuverte ? t("barrierOpen") : t("barrierClosed"));
  }

  // 2. Pluie et gouttes d'eau animées sur la Place 2 découverte
  const estPluie = Boolean(donneesGlobales.pluie);
  const rainOverlay = document.querySelector(isSession ? "#s-rain-overlay-p2" : "#rain-overlay-p2");
  const badgeRainIcon = document.querySelector("#" + bpfx + "rain-icon");
  const badgeRainText = document.querySelector("#" + bpfx + "rain-text");

  if (rainOverlay) {
    rainOverlay.style.display = estPluie ? "block" : "none";
  }
  if (badgeRainIcon) {
    badgeRainIcon.textContent = estPluie ? "🌧️" : "☀️";
  }
  if (badgeRainText) {
    badgeRainText.textContent = estPluie ? t("rainDetected") : t("dryWeather");
  }

  // 3. Pastille d'état globale du plan
  const badgeMapDot = document.querySelector("#" + bpfx + "map-status .plan-badge-dot");
  const badgeMapText = document.querySelector("#" + bpfx + "map-text");
  const delaiHorsLigne = Date.now() - dernierContactEtat > 6000;

  if (badgeMapDot && badgeMapText) {
    if (delaiHorsLigne) {
      badgeMapDot.className = "plan-badge-dot plan-badge-dot--red";
      badgeMapText.textContent = t("offlineMap");
    } else if (donneesGlobales.capteurs === "attente") {
      badgeMapDot.className = "plan-badge-dot plan-badge-dot--yellow";
      badgeMapText.textContent = t("waitingSensors");
    } else {
      badgeMapDot.className = "plan-badge-dot plan-badge-dot--green is-pulsing";
      badgeMapText.textContent = t("liveMap");
    }
  }
}

function afficherPlanSession(donnees) {
  const place = typeof donnees.place === "string" ? donnees.place : "";
  document.querySelector("#assigned-place").textContent = place || "—";
  mettreAJourPlan(document.querySelector("#session-plan"), donnees.etatParking || [], place, donnees);
  actualiserCartesPlaces(donnees.etatParking || [], place);
}

function commencerCompteCode() {
  carteLue = true;
  clearInterval(codeTimer);
  clearTimeout(codeExpiryRedirectTimer);
  codeExpiryRedirectTimer = null;
  document.querySelector("#code-expiry-modal").hidden = true;
  codeExpireA = Date.now() + dureeFenetreCode();
  codeInput.disabled = false;
  codeInput.value = "";
  const errEl = document.querySelector("#code-error");
  if (errEl) {
    errEl.hidden = true;
    errEl.textContent = "";
    errEl.classList.remove("info-message");
    errEl.classList.add("error-message");
  }
  afficherPage("code");
  actualiserCompteCode();
  codeTimer = setInterval(actualiserCompteCode, 1000);
  setTimeout(() => codeInput.focus(), 50);
  mettreAJourParcours(dernieresDonneesSession, etatAccueil ? etatAccueil.etatParking : []);
}

// Code window = the gate's LCD countdown (sent by /api/etat), + 5 s for the phone's network.
function dureeFenetreCode() {
  const sec = etatAccueil && Number.isFinite(etatAccueil.fenetreCodeSec) ? etatAccueil.fenetreCodeSec : 20;
  return (sec + 5) * 1000;
}

function actualiserCompteCode() {
  const reste = Math.max(0, codeExpireA - Date.now());
  const countdownEl = document.querySelector("#code-countdown");
  const secondes = Math.ceil(reste / 1000);
  if (countdownEl) {
    countdownEl.textContent =
      `${String(Math.floor(secondes / 60)).padStart(2, "0")}:${String(secondes % 60).padStart(2, "0")}`;
  }
  const progression = document.querySelector("#code-progress");
  const piste = document.querySelector(".code-progress-track");
  if (progression) progression.style.width = `${Math.max(0, Math.min(100, (reste / dureeFenetreCode()) * 100))}%`;
  if (piste) { piste.setAttribute("aria-valuemax", String(Math.round(dureeFenetreCode() / 1000))); piste.setAttribute("aria-valuenow", String(secondes)); }
  document.querySelector("#page-code").classList.toggle("code-expiring", secondes <= 60);
  if (reste <= 0) {
    afficherExpirationCode();
    return;
  }
  // Le téléphone ne bloque jamais la saisie : le champ reste toujours actif
  codeInput.disabled = false;
  if (loginButton) loginButton.disabled = false;
}

function reinitialiserSaisieCode() {
  clearInterval(codeTimer);
  codeTimer = null;
  clearTimeout(codeExpiryRedirectTimer);
  codeExpiryRedirectTimer = null;
  codeExpireA = 0;
  codeInput.value = "";
  codeInput.disabled = false;
  const fenetreSec = Math.round(dureeFenetreCode() / 1000);
  document.querySelector("#code-countdown").textContent = `00:${String(fenetreSec).padStart(2, "0")}`;
  document.querySelector("#code-progress").style.width = "100%";
  document.querySelector(".code-progress-track").setAttribute("aria-valuenow", String(fenetreSec));
  document.querySelector("#page-code").classList.remove("code-expiring");
  document.querySelector("#code-expiry-modal").hidden = true;
  const error = document.querySelector("#code-error");
  error.hidden = true;
  error.textContent = "";
}

function afficherExpirationCode() {
  if (codeExpireA === 0) return;
  reinitialiserSaisieCode();
  afficherPage("code");
  const modal = document.querySelector("#code-expiry-modal");
  modal.hidden = false;
  document.querySelector("#code-expiry-home").focus();
  codeExpiryRedirectTimer = setTimeout(retourAccueilApresCode, 5000);
}

function retourAccueilApresCode() {
  reinitialiserSaisieCode();
  afficherPage("home");
  chargerEtatAccueil();
}

function majCompteSession() {
  const maintenant = Date.now();
  const ecoule = (maintenant - instantReference) / 1000;
  const solde = Math.max(0, soldeReference - (ecoule / 60) * tarifMinute);
  const secondesRestantes = Math.max(0, tempsRestantReference - Math.floor((maintenant - instantReference) / 1000));
  const pourcentage = soldeMaximum > 0 ? Math.max(0, Math.min(100, (solde / soldeMaximum) * 100)) : 0;
  document.querySelector("#session-balance").textContent = dt(solde);
  document.querySelector("#session-cost").textContent = dt(coutReference + (ecoule / 60) * tarifMinute);
  document.querySelector("#time-remaining").textContent = formaterTempsRestant(secondesRestantes);
  const alerte = document.querySelector("#low-balance-alert");
  const plan = dernieresDonneesSession && dernieresDonneesSession.plan;
  const planifie = Boolean(plan && plan.minutes);
  const soldeEpuise = solde <= 0 || (!planifie && secondesRestantes === 0);
  const depassement = planifie && (dernieresDonneesSession.depassement || secondesRestantes === 0);
  alerte.hidden = !soldeEpuise && !depassement && secondesRestantes > 120;
  document.querySelector("#low-balance-message").textContent = soldeEpuise
    ? t("balanceExhausted")
    : depassement ? t("planOvertime") : planifie ? t("planEnding") : t("lowBalance");
  const exitBtn = document.querySelector("#low-balance-exit");
  if (exitBtn) exitBtn.hidden = true;
  document.querySelector("#open-recharge").classList.toggle("is-urgent", soldeEpuise || secondesRestantes <= 120);
  document.querySelector("#balance-progress").style.width = `${pourcentage}%`;
  document.querySelector("#balance-percent").textContent = `${Math.round(pourcentage)}%`;
  document.querySelector(".progress-track").setAttribute("aria-valuenow", String(Math.round(pourcentage)));
  actualiserRecapRecharge(solde);
  sauvegarder("session", { solde: soldeReference, instant: instantReference });
}

function afficherSession(donnees) {
  dernieresDonneesSession = donnees;
  carteLue = true;
  codeValide = true;
  sessionActive = true;
  sessionCloturee = false;
  soldeReference = donnees.solde;
  soldeMaximum = Math.max(soldeMaximum, donnees.solde);
  instantReference = Date.now();
  tarifMinute = donnees.tarif;
  tempsRestantReference = Number.isFinite(donnees.tempsRestantSec)
    ? donnees.tempsRestantSec
    : Number.isFinite(donnees.tempsRestant)
      ? donnees.tempsRestant
      : (donnees.solde / donnees.tarif) * 60;
  coutReference = Number.isFinite(donnees.coutActuel) ? donnees.coutActuel : 0;
  entreeSession = new Date(donnees.entree);
  document.querySelector("#entry-time").textContent = entreeSession.toLocaleTimeString(langue === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  document.querySelector("#session-plan-label").textContent = libellePlan(donnees.plan, donnees.depassement, donnees.tarifHeure);
  const planifie = Boolean(donnees.plan && donnees.plan.minutes);
  const labelTemps = document.querySelector("#time-remaining-label");
  labelTemps.dataset.i18n = planifie ? "timeLeftPlanned" : "timeLeftFree";
  labelTemps.textContent = t(labelTemps.dataset.i18n);
  afficherPlanSession(donnees);
  mettreAJourParcours(donnees, donnees.etatParking || (etatAccueil ? etatAccueil.etatParking : []));
  clearInterval(sessionTimer);
  majCompteSession();
  sessionTimer = setInterval(majCompteSession, 1000);
}

function afficherFinEtCloturer(donnees) {
  clearInterval(sessionTimer);
  sessionTimer = null;
  clearInterval(sessionSyncTimer);
  sessionSyncTimer = null;
  arreterSurveillanceInactivite();
  sessionActive = false;
  sessionCloturee = true;
  supprimerSauvegarde();
  sessionId = "";
  afficherFin(donnees);
  afficherPage("finish");
  mettreAJourParcours(donnees, etatAccueil ? etatAccueil.etatParking : []);
}

function gererSessionInvalide() {
  clearInterval(sessionSyncTimer);
  sessionSyncTimer = null;
  clearInterval(sessionTimer);
  sessionTimer = null;
  sessionActive = false;
  supprimerSauvegarde();
  sessionId = "";
  commencerCompteCode();
  erreurElement("code-error", t("sessionExpiredNotice"), false);
}

async function actualiserSession() {
  const sessionDemandee = sessionId;
  try {
    const donnees = await api("/session");
    if (!sessionDemandee || sessionId !== sessionDemandee) return;
    if (donnees.statut === "terminee") {
      afficherFinEtCloturer(donnees);
      return;
    }
    if (!donnees.plan) {               // duration not chosen yet -> the picker first
      afficherChoixPlan(donnees);
      return;
    }
    afficherSession(donnees);
    afficherPage("session");
    clearInterval(sessionSyncTimer);
    sessionSyncTimer = setInterval(resynchroniserSession, 2000);
  } catch (erreur) {
    if (!sessionDemandee || sessionId !== sessionDemandee) return;
    if (erreur.statut === 401 || erreur.statut === 404 || erreur.code === "session_absente") {
      gererSessionInvalide();
    } else {
      traiterErreur(erreur, "session");
    }
  }
}

async function resynchroniserSession() {
  if (!sessionId) return;
  const sessionDemandee = sessionId;
  try {
    const donnees = await api("/session");
    if (sessionId !== sessionDemandee) return;
    if (donnees.statut === "terminee") {
      afficherFinEtCloturer(donnees);
      return;
    }
    if (!donnees.plan) return;         // still on the duration picker
    afficherSession(donnees);
  } catch (erreur) {
    if (sessionId !== sessionDemandee) return;
    if (erreur.statut === 401 || erreur.statut === 404 || erreur.code === "session_absente") {
      gererSessionInvalide();
    } else {
      traiterErreur(erreur, "session");
    }
  }
}

// ---- Planned stay / free time (chosen once, right after the code) ----
function libelleDuree(minutes) {
  return minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`;
}
function libellePlan(plan, depassement, tarifHeure) {
  if (!plan) return "—";
  const r = nombreDt(tarifHeure || 0);
  if (!plan.minutes) return t("planLabelFree").replace("{r}", r);
  if (depassement) return t("planLabelOver").replace("{r}", r);
  return t("planLabelPlanned").replace("{d}", libelleDuree(plan.minutes)).replace("{r}", r);
}
function afficherChoixPlan(donnees) {
  dernieresDonneesSession = donnees;
  const tarifs = donnees.tarifs || (etatAccueil && etatAccueil.tarifs);
  remplirTarifs(tarifs);
  const zone = document.querySelector("#plan-options");
  zone.querySelectorAll(".amount-option").forEach((el) => el.remove());
  const options = (tarifs ? tarifs.durees : [30, 60, 120, 180]).map((m) => ({
    valeur: String(m), titre: libelleDuree(m),
    detail: tarifs ? t("planEstimate").replace("{c}", nombreDt((m / 60) * tarifs.planifie)) : "",
  }));
  options.push({ valeur: "libre", titre: t("planFree"),
                 detail: tarifs ? t("planFreeHint").replace("{r}", nombreDt(tarifs.libre)) : "" });
  options.forEach((o, i) => {
    const label = document.createElement("label");
    label.className = "amount-option" + (o.valeur === "libre" ? " plan-free-option" : "");
    label.innerHTML = `<input type="radio" name="duree" value="${o.valeur}"${i === 1 ? " checked" : ""}>`
      + `<span class="amount-card"><strong></strong><small></small></span>`;
    label.querySelector("strong").textContent = o.titre;
    label.querySelector("small").textContent = o.detail;
    zone.appendChild(label);
  });
  const err = document.querySelector("#plan-error");
  err.hidden = true;
  afficherPage("plan");
}
async function choisirPlan() {
  const valeur = new FormData(document.querySelector("#plan-form")).get("duree");
  if (!valeur) { erreurElement("plan-error", t("planPick"), false); return; }
  const bouton = document.querySelector("#plan-button");
  bouton.disabled = true;
  try {
    const donnees = await api("/session/plan", { method: "POST",
      body: JSON.stringify({ minutes: valeur === "libre" ? null : Number(valeur) }) });
    afficherSession(donnees);
    afficherPage("session");
    clearInterval(sessionSyncTimer);
    sessionSyncTimer = setInterval(resynchroniserSession, 2000);
  } catch (erreur) {
    if (erreur.code === "plan_deja_choisi") { await actualiserSession(); return; }
    if (erreur.statut === 401 || erreur.code === "session_absente") { gererSessionInvalide(); return; }
    traiterErreur(erreur, "plan");
  } finally {
    bouton.disabled = false;
  }
}

// ---- "Quit parking": same as tapping the card at the exit (2 taps to confirm) ----
let quitArmeJusqua = 0;
async function quitterParking() {
  const bouton = document.querySelector("#quit-parking");
  if (Date.now() > quitArmeJusqua) {           // 1st tap: ask to confirm
    quitArmeJusqua = Date.now() + 4000;
    bouton.textContent = t("quitConfirm");
    bouton.classList.add("is-confirming");
    setTimeout(() => {
      if (Date.now() >= quitArmeJusqua) { bouton.textContent = t("quitParking"); bouton.classList.remove("is-confirming"); }
    }, 4100);
    return;
  }
  quitArmeJusqua = 0;
  bouton.disabled = true;
  try {
    const recu = await api("/sortie", { method: "POST", body: "{}" });
    afficherFinEtCloturer(recu);
    erreurElement("finish-gate-note", t(recu.barriere === "hors_ligne" ? "quitGateOffline" : "quitDone"), true);
  } catch (erreur) {
    if (erreur.code === "visite_absente") { await actualiserSession(); return; }
    traiterErreur(erreur, "session");
  } finally {
    bouton.disabled = false;
    bouton.textContent = t("quitParking");
    bouton.classList.remove("is-confirming");
  }
}

let minuteurBienvenue = null;

function passerBienvenueVersSession() {
  if (minuteurBienvenue) {
    clearTimeout(minuteurBienvenue);
    minuteurBienvenue = null;
  }
  demarrerSession();
}

function afficherEcranBienvenue(donnees) {
  client = donnees.nom;
  sessionId = donnees.sessionId;
  carteLue = true;
  codeValide = true;

  const nomEl = document.querySelector("#customer-name");
  if (nomEl) nomEl.textContent = donnees.nom;

  const soldeEl = document.querySelector("#welcome-balance");
  if (soldeEl) soldeEl.textContent = dt(donnees.solde);

  const placeEl = document.querySelector("#welcome-place");
  if (placeEl) placeEl.textContent = donnees.place || "Place 1 couverte";

  sauvegarder("welcome", { solde: donnees.solde, place: donnees.place });
  clearInterval(codeTimer);
  afficherPage("welcome");
  mettreAJourParcours({ nom: client, sessionId }, etatAccueil ? etatAccueil.etatParking : []);

  // Détection prefers-reduced-motion : 1s si reduced-motion, sinon 2.5s (2500 ms)
  const reductionMouvement = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const delai = reductionMouvement ? 1000 : 2500;

  if (minuteurBienvenue) clearTimeout(minuteurBienvenue);
  minuteurBienvenue = setTimeout(passerBienvenueVersSession, delai);

  // Un toucher sur l'écran Bienvenue passe tout de suite
  const pageWelcome = document.querySelector("#page-welcome");
  if (pageWelcome) {
    pageWelcome.onclick = () => {
      passerBienvenueVersSession();
    };
  }
}

async function demarrerSession() {
  try {
    await actualiserSession();
  } catch (erreur) {
    traiterErreur(erreur, "welcome");
  }
}

async function envoyerCode() {
  const code = codeInput.value.trim();
  if (!/^\d{6}$/.test(code)) {
    erreurElement("code-error", t("invalidCode"), false);
    codeInput.value = "";
    setTimeout(() => codeInput.focus(), 50);
    return;
  }
  // Ne pas bloquer la saisie par un minuteur local : seule la réponse du serveur décide
  if (loginButton) loginButton.disabled = true;
  try {
    const resultat = await api("/login", { method: "POST", body: JSON.stringify({ code }) });
    let place = resultat.place;
    sessionId = resultat.sessionId;

    // Si le serveur ne renvoie pas la place dans /api/login, on la récupère via /api/session
    if (!place && sessionId) {
      try {
        const donneesSession = await api("/session");
        if (donneesSession && donneesSession.place) {
          place = donneesSession.place;
          dernieresDonneesSession = donneesSession;
        }
      } catch (e) {
        // En cas d'échec ponctuel
      }
    }

    reinitialiserSaisieCode();
    afficherEcranBienvenue({
      nom: resultat.nom,
      solde: resultat.solde,
      place: place || "Place 1 couverte",
      sessionId: resultat.sessionId
    });
  } catch (erreur) {
    traiterErreur(erreur, "code");
    if (erreur.code !== "code_expire") {
      codeInput.value = "";
      setTimeout(() => codeInput.focus(), 50);
    }
  } finally {
    if (loginButton) loginButton.disabled = false;
  }
}

async function recharger() {
  try {
    const montant = Number(new FormData(document.querySelector("#recharge-form")).get("montant"));
    const resultat = await api("/recharge", { method: "POST", body: JSON.stringify({ montant }) });
    soldeReference = resultat.solde;
    soldeMaximum = resultat.solde;
    instantReference = Date.now();
    tempsRestantReference = Math.floor((resultat.solde / tarifMinute) * 60);
    majCompteSession();
    afficherPage("session");
  } catch (erreur) {
    traiterErreur(erreur, "recharge");
  }
}

function afficherFin(sortie) {
  const maintenant = new Date();
  const formatDate = (date) => date.toLocaleString(langue === "fr" ? "fr-FR" : "en-GB");
  const nomEl = document.querySelector("#finish-name");
  if (nomEl) nomEl.textContent = client || sortie.nom || "";
  const placeEl = document.querySelector("#finish-place");
  if (placeEl) placeEl.textContent = sortie.place || (dernieresDonneesSession && dernieresDonneesSession.place) || "—";
  const entryDateEl = document.querySelector("#finish-entry-date");
  if (entryDateEl) entryDateEl.textContent = sortie.entree ? formatDate(new Date(sortie.entree)) : entreeSession ? formatDate(entreeSession) : "—";
  const exitDateEl = document.querySelector("#finish-exit-date");
  if (exitDateEl) exitDateEl.textContent = sortie.sortie ? formatDate(new Date(sortie.sortie)) : formatDate(maintenant);
  const receiptDateEl = document.querySelector("#receipt-date");
  if (receiptDateEl) receiptDateEl.textContent = sortie.sortie ? formatDate(new Date(sortie.sortie)) : formatDate(maintenant);
  const durationEl = document.querySelector("#finish-duration");
  if (durationEl) durationEl.textContent = duree(sortie.duree);
  const priceEl = document.querySelector("#finish-price");
  if (priceEl) priceEl.textContent = dt(sortie.prix);
  const balanceEl = document.querySelector("#finish-balance");
  if (balanceEl) balanceEl.textContent = dt(sortie.soldeFinal);
  const planEl = document.querySelector("#finish-plan");
  const plan = sortie.plan || (dernieresDonneesSession && dernieresDonneesSession.plan);
  if (planEl) planEl.textContent = !plan ? "—" : plan.minutes ? `${t("ratePlanned")} (${libelleDuree(plan.minutes)})` : t("rateFree");
  const note = document.querySelector("#finish-gate-note");
  if (note) note.hidden = true;     // set again by "Quit parking" right after
}

document.querySelectorAll("[data-page-link]").forEach((bouton) => {
  bouton.addEventListener("click", () => {
    const id = bouton.dataset.pageLink;
    if (id === "code") commencerCompteCode();
    else if (id === "home") {
      if (sessionCloturee || pageCourante === "finish") retournerAccueilNeutre();
      else retourAccueilApresCode();
    }
    else if (id === "help") {
      afficherPage("help");
      chargerEtatAccueil();
      mettreAJourParcours(dernieresDonneesSession, etatAccueil ? etatAccueil.etatParking : []);
    }
    else if (id === "session") {
      const sauvegarde = JSON.parse(localStorage.getItem(CLE_SESSION) || "null");
      if (sauvegarde && sauvegarde.etat === "session" && sauvegarde.sessionId) {
        sessionId = sauvegarde.sessionId;
        actualiserSession().catch((erreur) => traiterErreur(erreur, "session"));
      }
      else if (sauvegarde && sauvegarde.etat === "welcome") afficherPage("welcome");
      else commencerCompteCode();
    } else afficherPage(id);
  });
});

document.querySelector("#have-code").addEventListener("click", commencerCompteCode);
document.querySelector("#plan-form").addEventListener("submit", (event) => { event.preventDefault(); choisirPlan(); });
document.querySelector("#quit-parking").addEventListener("click", quitterParking);
document.querySelector("#cancel-code").addEventListener("click", retourAccueilApresCode);
document.querySelector("#code-expiry-home").addEventListener("click", retourAccueilApresCode);
document.querySelector("#stay-connected").addEventListener("click", resterConnecte);
loginForm.addEventListener("submit", (event) => { event.preventDefault(); envoyerCode(); });
codeInput.addEventListener("input", () => {
  const chiffres = codeInput.value.replace(/\D/g, "").slice(0, 6);
  if (codeInput.value !== chiffres) {
    codeInput.value = chiffres;
  }
  if (chiffres.length === 6) {
    envoyerCode();
  }
});
const startSessionBtn = document.querySelector("#start-session");
if (startSessionBtn) startSessionBtn.addEventListener("click", demarrerSession);
document.querySelector("#open-recharge").addEventListener("click", () => {
  actualiserRecapRecharge();
  afficherPage("recharge");
});
document.querySelector("#low-balance-recharge").addEventListener("click", () => afficherPage("recharge"));
document.querySelector("#back-to-session").addEventListener("click", () => afficherPage("session"));
document.querySelector("#new-session").addEventListener("click", () => {
  retournerAccueilNeutre();
});
document.querySelector("#retry-button").addEventListener("click", async () => {
  if (!actionEnEchec) return afficherPage("home");
  clearTimeout(minuteurErreur);
  minuteurErreur = null;
  await executerActionEchec();
});
document.querySelector("#recharge-form").addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelector("#pay-button").disabled = true;
  recharger().finally(() => { document.querySelector("#pay-button").disabled = false; });
});
document.querySelector("#recharge-form").addEventListener("change", (event) => {
  if (event.target.name === "montant") actualiserRecapRecharge();
});
document.querySelectorAll(".lang-button").forEach((bouton) => {
  bouton.addEventListener("click", () => {
    langue = bouton.dataset.lang;
    localStorage.setItem("smart-parking-lang", langue);
    traduire();
    actualiserCompteRecu();
    chargerEtatAccueil();
    if (dernieresDonneesSession) {
      afficherPlanSession(dernieresDonneesSession);
      majCompteSession();
    }
  });
});

// Gestion du splash screen affiché une fois par session
function gererSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;

  const fermerSplash = () => {
    splash.classList.add('hidden');
    splash.style.pointerEvents = 'none';
    sessionStorage.setItem('splashShown', 'true');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 300);
  };

  if (sessionStorage.getItem('splashShown')) {
    // Splash déjà affiché, masquer immédiatement
    splash.classList.add('hidden');
    splash.style.display = 'none';
    splash.style.pointerEvents = 'none';
    return;
  }

  // Affiche le splash
  splash.classList.remove('hidden');
  splash.style.display = 'flex';
  splash.style.pointerEvents = 'auto';

  // Permet de le fermer en touchant l'écran
  splash.addEventListener('click', fermerSplash, { once: true });

  // Masque automatiquement après 1.5s
  setTimeout(fermerSplash, 1500);

  // Délai de sécurité de 2 secondes au cas où
  setTimeout(fermerSplash, 2000);
}

async function restaurer() {
  traduire();
  // Démarre le splash avant tout le reste
  gererSplash();
  // Délai de sécurité global : garantit la disparition du splash après 2 secondes
  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash && !splash.classList.contains('hidden')) {
      splash.classList.add('hidden');
      splash.style.display = 'none';
      splash.style.pointerEvents = 'none';
    }
  }, 2000);
  // Le reste de la logique de restauration
  // -------------------------------------------------
  // NOTE: le reste du code original est conservé inchangé

  traduire();
  await chargerEtatAccueil();
  let sauvegarde;
  try {
    sauvegarde = JSON.parse(localStorage.getItem(CLE_SESSION) || "null");
  } catch {
    supprimerSauvegarde();
    return;
  }
  if (!sauvegarde || !sauvegarde.nom) {
    mettreAJourParcours(null, etatAccueil ? etatAccueil.etatParking : []);
    return;
  }
  client = sauvegarde.nom;
  sessionId = sauvegarde.sessionId || "";
  document.querySelector("#customer-name").textContent = client;
  if (sauvegarde.etat === "welcome") {
    carteLue = true;
    codeValide = true;
    afficherEcranBienvenue({
      nom: client,
      solde: sauvegarde.solde,
      place: sauvegarde.place || "Place 1 couverte",
      sessionId: sessionId
    });
  } else if (sauvegarde.etat === "session") {
    carteLue = true;
    codeValide = true;
    sessionActive = true;
    if (!sessionId) {
      supprimerSauvegarde();
      return;
    }
    try {
      await actualiserSession();
    } catch (erreur) {
      if (erreur.code === "session_absente") supprimerSauvegarde();
      else traiterErreur(erreur, "session");
    }
  }
  mettreAJourParcours(dernieresDonneesSession, etatAccueil ? etatAccueil.etatParking : []);
}

restaurer();
// Rafraîchissement en direct toutes les 2 secondes
clearInterval(livePollingTimer);
livePollingTimer = setInterval(async () => {
  try {
    const donnees = await api("/etat");
    etatAccueil = donnees;
    dernierContactEtat = Date.now();
    afficherEtatParking(donnees);
    if (dernieresDonneesSession) {
      mettreAJourPlan(document.querySelector("#session-plan"), donnees.etatParking || [], dernieresDonneesSession.place || "", donnees);
    }
  } catch (e) {
    if (Date.now() - dernierContactEtat > 6000) {
      mettreAJourPlan(document.querySelector("#home-plan"), [], "", null);
      mettreAJourPlan(document.querySelector("#session-plan"), [], "", null);
    }
  }
}, 2000);
