// API + project documentation (EN/FR), served at /docs and as JSON at /api/docs.
// When you add a route in server.js, add an entry here. Routes missing from this list
// are flagged as "undocumented" on the /home/docs page automatically.

const BASE_URL = 'https://smartreiner.duckdns.org';

const intro = {
  en: 'Smart Parking backend: Express + SQLite, the single source of truth. The card holds only its '
    + 'UID; owner, balance (solde) and status live in the DB keyed by UID. The ESP32 posts a tapped '
    + 'UID to /api/access and obeys the allow/deny reply (tap in = entry, next tap = exit, billed). '
    + 'All responses are JSON with an "ok" field. Read endpoints are open; the write endpoints '
    + '(register/edit/recharge/block) need an admin login via /api/login (send the token as '
    + '"Authorization: Bearer <token>"). CORS is open so a frontend dev can call the API from localhost.',
  fr: 'Backend Smart Parking : Express + SQLite, la source de vérité unique. La carte ne contient que '
    + 'son UID ; propriétaire, solde et statut vivent dans la base, indexés par UID. L\'ESP32 envoie '
    + 'l\'UID lu à /api/access et obéit à la réponse autoriser/refuser (1re lecture = entrée, lecture '
    + 'suivante = sortie, facturée). Réponses JSON avec un champ "ok". Les routes de lecture sont '
    + 'ouvertes ; les routes d\'écriture (inscrire/modifier/recharger/bloquer) exigent une connexion '
    + 'admin via /api/login (token envoyé en « Authorization: Bearer <token> »). CORS est ouvert.',
};

const endpoints = [
  {
    method: 'GET',
    path: '/api/health',
    caller: { en: 'Browser / monitoring', fr: 'Navigateur / supervision' },
    summary: { en: 'Check that the backend is up.', fr: 'Vérifie que le backend fonctionne.' },
    response: { ok: true, startedAt: '2026-10-03T19:16:58.602Z', now: '2026-10-03T19:17:29.035Z' },
  },
  {
    method: 'GET',
    path: '/api/status',
    caller: { en: 'Frontend (polls every 2 s)', fr: 'Frontend (toutes les 2 s)' },
    summary: {
      en: 'Dashboard data: known devices (online = pinged in the last 15 s) and the 10 most recent card reads, newest first.',
      fr: 'Données du tableau de bord : appareils connus (online = ping dans les 15 dernières s) et les 10 dernières lectures de badge, la plus récente en premier.',
    },
    response: {
      ok: true,
      startedAt: '2026-10-03T19:16:58.602Z',
      now: '2026-10-03T19:17:29.035Z',
      devices: [{ device_id: 'esp32-gate-1', ip: '192.168.100.85', rssi: -45, uptime_ms: 225776, last_seen: '2026-10-02T22:09:04.649Z', ping_count: 45, online: false }],
      cardReads: [{ id: 8, uid: '95:AA:3D:B0', card_type: 'MIFARE 1KB', device_id: 'esp32-gate-1', read_at: '2026-10-02T22:08:56.560Z' }],
    },
  },
  {
    method: 'POST',
    path: '/api/ping',
    caller: { en: 'ESP32 (every 5 s)', fr: 'ESP32 (toutes les 5 s)' },
    summary: {
      en: 'Device heartbeat. Creates or updates the device row. All fields optional; ip defaults to the request IP.',
      fr: 'Battement de cœur de l\'appareil. Crée ou met à jour l\'appareil. Tous les champs sont optionnels ; ip vaut par défaut l\'IP de la requête.',
    },
    body: { device: 'esp32-gate-1', ip: '192.168.100.85', rssi: -45, uptimeMs: 225776 },
    response: { ok: true, serverTime: '2026-10-03T19:17:29.035Z' },
  },
  {
    method: 'POST',
    path: '/api/card',
    caller: { en: 'ESP32 (on card tap)', fr: 'ESP32 (lecture d\'un badge)' },
    summary: {
      en: 'Log-only card read (Task 2, kept for compatibility). The ESP32 now uses /api/access instead.',
      fr: 'Lecture de badge en journal seul (Tâche 2, gardée par compatibilité). L\'ESP32 utilise désormais /api/access.',
    },
    body: { device: 'esp32-gate-1', uid: '95:AA:3D:B0', type: 'MIFARE 1KB' },
    response: { ok: true, uid: '95:AA:3D:B0', receivedAt: '2026-10-03T19:17:29.035Z' },
    errors: [{ status: 400, body: { ok: false, error: 'uid invalide' } }],
  },
  {
    method: 'POST',
    path: '/api/access',
    caller: { en: 'ESP32 (on card tap)', fr: 'ESP32 (lecture d\'un badge)' },
    summary: {
      en: 'Decision endpoint. Logs the read, then decides: unknown / blocked cards are denied; any active '
        + 'card taps in (ENTRY) or, if already inside, taps out (EXIT). On ENTRY the reply carries a 6-digit '
        + '"code" to show on the LCD. On EXIT it returns how long they stayed and the no-app cost '
        + '(durationSec, cost) — billed by duration, the balance is not touched. No login (device endpoint).',
      fr: 'Route de décision. Enregistre la lecture puis décide : carte inconnue / bloquée refusée ; toute carte '
        + 'active entre (ENTRY) ou, si déjà à l\'intérieur, sort (EXIT). À l\'entrée la réponse porte un « code » à '
        + '6 chiffres à afficher sur l\'écran. À la sortie elle renvoie la durée et le coût sans-app (durationSec, '
        + 'cost) — facturé à la durée, le solde n\'est pas touché. Sans connexion (route appareil).',
    },
    body: { device: 'esp32-gate-1', uid: '95:AA:3D:B0', type: 'MIFARE 1KB' },
    response: { ok: true, allow: true, uid: '95:AA:3D:B0', owner: 'Ahmed Ben Salah', action: 'ENTRY', code: '482915', message: 'Bienvenue Ahmed Ben Salah — Code 482915' },
    errors: [
      { status: 400, body: { ok: false, allow: false, error: 'uid invalide' } },
      { status: 200, body: { ok: true, allow: false, uid: '04:5A:77:1D', owner: null, message: 'Carte inconnue' } },
    ],
  },
  {
    method: 'POST',
    path: '/api/slots',
    caller: { en: 'ESP32 (HC-SR04 sensors)', fr: 'ESP32 (capteurs HC-SR04)' },
    summary: {
      en: 'Reports slot occupancy from the ultrasonic sensors. No login (device endpoint). The '
        + 'backend tracks when each slot became occupied (for the elapsed timer).',
      fr: 'Signale l\'occupation des places via les capteurs ultrason. Sans connexion (appareil). Le '
        + 'backend retient depuis quand chaque place est occupée (pour le chrono).',
    },
    body: { device: 'esp32-gate-1', slots: [{ id: 1, occupied: true }, { id: 2, occupied: false }] },
    response: { ok: true },
  },
  {
    method: 'GET',
    path: '/api/state',
    caller: { en: 'Frontend (dashboard)', fr: 'Frontend (tableau de bord)' },
    summary: {
      en: 'Live model state: the 2 slots (covered flag, occupied, since) from the sensors, the current '
        + 'rate, and the last gate decision. rain/barrier are null until Task 5 wires the water sensor + servo.',
      fr: 'État du modèle en direct : les 2 places (couverte, occupée, depuis) via les capteurs, le tarif '
        + 'actuel et la dernière décision. rain/barrier sont null tant que la Tâche 5 (eau + servo) n\'est pas faite.',
    },
    response: {
      ok: true,
      slots: [
        { id: 1, covered: true, occupied: true, since: '2026-10-23T12:00:00.000Z' },
        { id: 2, covered: false, occupied: false, since: null },
      ],
      rain: null, barrier: null, rate: 1.5,
      lastDecision: { message: 'Bienvenue Ahmed — Entrée', at: '2026-10-23T12:00:00.000Z' },
    },
  },
  {
    method: 'POST',
    path: '/api/inspect/arm',
    caller: { en: 'Admin (Card Inspector)', fr: 'Admin (Inspecteur de carte)' },
    summary: {
      en: 'Arm the gate\'s next card tap for inspection only (login required; no entry/exit, no servo, nothing in the app; '
        + 'expires after 60 s). {op:"read"} dumps the 16 sectors; {op:"read", sector, code} also unlocks + decrypts that sector; '
        + '{op:"write", sector:1-15, text (max 48 bytes), code?} encrypts the text into the sector, locks it with a key derived '
        + 'from a NEW decryption code (shown once in /api/inspect "result.newCode"). code = the sector\'s current code if it is '
        + 'already protected. {cancel:true} disarms.',
      fr: 'Arme le prochain passage de carte pour une inspection seulement (connexion requise ; ni entrée/sortie, ni servo, '
        + 'rien dans l\'app ; expire après 60 s). {op:"read"} lit les 16 secteurs ; {op:"read", sector, code} déverrouille et '
        + 'déchiffre ce secteur ; {op:"write", sector:1-15, text (48 octets max), code?} chiffre le texte dans le secteur et le '
        + 'verrouille avec une clé dérivée d\'un NOUVEAU code de déchiffrement (affiché une fois dans /api/inspect '
        + '« result.newCode »). code = le code actuel du secteur s\'il est déjà protégé. {cancel:true} annule.',
    },
    body: { op: 'write', sector: 2, text: 'Abonnement mensuel', code: '' },
    response: { ok: true, armed: true, op: 'write', sector: 2 },
  },
  {
    method: 'GET',
    path: '/api/inspect-poll',
    caller: { en: 'ESP32', fr: 'ESP32' },
    summary: { en: 'The armed inspection job, if any (the ESP32 also gets it as "inspect" in its /api/slots reply).',
               fr: 'Le travail d\'inspection armé, s\'il y en a un (l\'ESP32 le reçoit aussi dans « inspect » de sa réponse /api/slots).' },
    response: { ok: true, armed: true, inspect: { op: 'write', sector: 2, key: 'FFFFFFFFFFFF', newKey: 'A19798A6C8CF', data: '62D61F21…(96 hex)' } },
  },
  {
    method: 'POST',
    path: '/api/card-scan',
    caller: { en: 'ESP32 (Card Inspector)', fr: 'ESP32 (Inspecteur)' },
    summary: {
      en: 'The ESP32 posts the sector dump of the inspected card and the write result. On a successful write the server '
        + 'stores the ciphertext + a hash of the decryption code (never the code). Disarms the inspection.',
      fr: 'L\'ESP32 envoie le dump des secteurs de la carte inspectée et le résultat de l\'écriture. Après une écriture réussie, '
        + 'le serveur garde le chiffré + un hachage du code de déchiffrement (jamais le code). Désarme l\'inspection.',
    },
    body: { device: 'esp32-gate-1', uid: '0B:69:AC:8E', type: 'MIFARE 1KB', op: 'write', sector: 2, wrote: true, keyChanged: true, error: '', sectors: [{ s: 2, prot: false, blocks: ['62D61F21…', '…', '…', '…'] }] },
    response: { ok: true },
  },
  {
    method: 'GET',
    path: '/api/inspect',
    caller: { en: 'Admin page (Card Inspector)', fr: 'Page admin (Inspecteur)' },
    summary: { en: 'Inspector state: armed job, latest dump, the card\'s protected sectors and the last result. The decryption '
                 + 'code (result.newCode) and decrypted text (result.text) are only sent with an admin token.',
               fr: 'État de l\'inspecteur : travail armé, dernier dump, secteurs protégés de la carte et dernier résultat. Le code '
                 + '(result.newCode) et le texte déchiffré (result.text) ne sont envoyés qu\'avec un jeton admin.' },
    response: { ok: true, armed: false, op: null, sector: null, until: null, lastCardScan: { uid: '0B:69:AC:8E', sectors: [], at: '2026-10-30T12:00:00.000Z' },
                secrets: [{ sector: 2, length: 18 }], result: { op: 'write', sector: 2, ok: true, newCode: 'K7Q2-M9XD', keyChanged: true } },
  },
  {
    method: 'GET',
    path: '/api/cards/:uid/secrets',
    caller: { en: 'Admin page (Cards & Clients)', fr: 'Page admin (Cartes & Clients)' },
    summary: { en: 'The card\'s protected sectors (sector, length, date) — never the values. Login required.',
               fr: 'Les secteurs protégés de la carte (secteur, taille, date) — jamais les valeurs. Connexion requise.' },
    response: { ok: true, secrets: [{ uid: '0B:69:AC:8E', sector: 2, length: 18, written_at: '2026-10-30T12:00:00.000Z' }] },
  },
  {
    method: 'POST',
    path: '/api/cards/:uid/secrets/:sector/reveal',
    caller: { en: 'Admin page (Cards & Clients)', fr: 'Page admin (Cartes & Clients)' },
    summary: { en: 'View a protected sector WITHOUT the card: the decryption code decrypts the stored copy. 5 wrong codes = 5 min lock.',
               fr: 'Voir un secteur protégé SANS la carte : le code de déchiffrement déchiffre la copie stockée. 5 codes faux = 5 min de blocage.' },
    body: { code: 'K7Q2-M9XD' },
    response: { ok: true, sector: 2, writtenAt: '2026-10-30T12:00:00.000Z', text: 'Abonnement mensuel' },
    errors: [{ status: 403, body: { ok: false, error: 'Code de déchiffrement incorrect.' } }],
  },
  {
    method: 'GET',
    path: '/api/cards',
    caller: { en: 'Admin page', fr: 'Page admin' },
    summary: {
      en: 'Every card: registered cards (owner, balance, status) plus any UID that was scanned but not '
        + 'registered yet (status "UNREGISTERED"). Read-only, open. Newest unregistered scans come first.',
      fr: 'Toutes les cartes : cartes inscrites (propriétaire, solde, statut) plus tout UID scanné mais pas '
        + 'encore inscrit (statut « UNREGISTERED »). Lecture seule, ouverte. Scans non inscrits récents en premier.',
    },
    response: [
      { uid: '04:5A:77:1D', owner: null, balance: 0, status: 'UNREGISTERED', active: false, blocked: false, registered: false, last_seen: '2026-10-11T19:38:50.952Z', reads: 3 },
      { uid: '95:AA:3D:B0', owner: 'Ahmed Ben Salah', balance: 12.5, status: 'ACTIVE', active: true, blocked: false, registered: true, updated_at: '2026-10-11T19:40:00.000Z' },
    ],
  },
  {
    method: 'GET',
    path: '/api/stays',
    caller: { en: 'Admin page (journal)', fr: 'Page admin (journal)' },
    summary: {
      en: 'Parking journal, newest first: visits (result "entry" while inside, "exit" when billed) and refused '
        + 'taps (result "denied"). Read-only, open.',
      fr: 'Journal du parking, le plus récent en premier : passages (résultat « entry » tant que présent, « exit » '
        + 'une fois facturé) et refus (résultat « denied »). Lecture seule, ouverte.',
    },
    response: [
      { result: 'exit', owner: 'Sarra Trabelsi', uid: '1C:44:9F:02', entry: '2026-10-11T19:13:00.000Z', exit: '2026-10-11T20:26:00.000Z', duration: 4380, price: 1.83, reason: null },
      { result: 'denied', owner: null, uid: '04:5A:77:1D', entry: '2026-10-11T18:40:00.000Z', exit: null, duration: 0, price: null, reason: 'Carte inconnue' },
    ],
  },
  {
    method: 'POST',
    path: '/api/login',
    caller: { en: 'Admin page', fr: 'Page admin' },
    summary: {
      en: 'Two logins share this route. Admin: {username,password} -> a 12 h bearer token for the write endpoints. '
        + 'Mobile cardholder: {code} (the 6-digit code shown after a card tap) -> {nom, solde, sessionId}; the app '
        + 'then sends sessionId as "X-Session-Id". Codes expire after 2 min; 5 bad codes locks the IP for 5 min.',
      fr: 'Deux connexions partagent cette route. Admin : {username,password} -> un token bearer 12 h pour les routes '
        + 'd\'écriture. Titulaire mobile : {code} (le code à 6 chiffres affiché après un tap) -> {nom, solde, sessionId} ; '
        + 'l\'app envoie ensuite sessionId en « X-Session-Id ». Les codes expirent après 2 min ; 5 codes faux bloquent l\'IP 5 min.',
    },
    body: { username: 'reiner', password: '••••••••' },
    response: { ok: true, token: '…', username: 'reiner' },
    errors: [
      { status: 401, body: { ok: false, error: 'Identifiants invalides.' } },
      { status: 401, body: { code: 'code_invalide', erreur: 'Code refusé.', tentativesRestantes: 4 } },
      { status: 429, body: { code: 'login_bloque', erreur: 'Trop de codes incorrects.', blocageSecondes: 300 } },
    ],
  },
  {
    method: 'GET',
    path: '/api/me',
    caller: { en: 'Admin page', fr: 'Page admin' },
    summary: { en: 'Who am I? Confirms the token is still valid (login required).', fr: 'Qui suis-je ? Confirme que le token est encore valide (connexion requise).' },
    response: { ok: true, username: 'reiner' },
  },
  {
    method: 'POST',
    path: '/api/logout',
    caller: { en: 'Admin page', fr: 'Page admin' },
    summary: { en: 'Revoke the current token (login required).', fr: 'Révoque le token courant (connexion requise).' },
    response: { ok: true },
  },
  {
    method: 'POST',
    path: '/api/cards',
    caller: { en: 'Admin page', fr: 'Page admin' },
    summary: {
      en: 'Register a new card (login required). Enforces one active card per owner. Optional opening balance.',
      fr: 'Inscrit une nouvelle carte (connexion requise). Une seule carte active par propriétaire. Solde initial optionnel.',
    },
    body: { uid: '95:AA:3D:B0', owner: 'Ahmed Ben Salah', balance: 10 },
    response: { ok: true, card: { uid: '95:AA:3D:B0', owner: 'Ahmed Ben Salah', balance: 10, status: 'ACTIVE', active: true, blocked: false, registered: true } },
    errors: [{ status: 200, body: { ok: false, error: 'Cette carte est déjà inscrite.' } }],
  },
  {
    method: 'POST',
    path: '/api/cards/:uid',
    caller: { en: 'Admin page', fr: 'Page admin' },
    summary: {
      en: 'Edit a card (login required): set owner, solde (balance, absolute) and/or status '
        + '(ACTIVE/BLOCKED/EXPIRED). Creates the row if the UID had only been scanned.',
      fr: 'Modifie une carte (connexion requise) : définit propriétaire, solde (absolu) et/ou statut '
        + '(ACTIVE/BLOCKED/EXPIRED). Crée la ligne si l\'UID n\'avait été que scanné.',
    },
    body: { owner: 'Ahmed Ben Salah', balance: 20, status: 'ACTIVE' },
    response: { ok: true, card: { uid: '95:AA:3D:B0', owner: 'Ahmed Ben Salah', balance: 20, status: 'ACTIVE', active: true, blocked: false, registered: true } },
    errors: [{ status: 200, body: { ok: false, error: 'Solde invalide.' } }],
  },
  {
    method: 'POST',
    path: '/api/cards/:uid/recharge',
    caller: { en: 'Admin page', fr: 'Page admin' },
    summary: { en: 'Add credit to a card (login required).', fr: 'Ajoute du crédit à une carte (connexion requise).' },
    body: { amount: 10 },
    response: { ok: true, balance: 22.5 },
    errors: [{ status: 200, body: { ok: false, error: 'Montant invalide.' } }],
  },
  {
    method: 'POST',
    path: '/api/cards/:uid/block',
    caller: { en: 'Admin page', fr: 'Page admin' },
    summary: { en: 'Block a card (login required). It is then denied at the gate.', fr: 'Bloque une carte (connexion requise). Elle est ensuite refusée à la barrière.' },
    response: { ok: true, card: { uid: '95:AA:3D:B0', owner: 'Ahmed Ben Salah', balance: 20, status: 'BLOCKED', active: false, blocked: true, registered: true } },
  },
  {
    method: 'GET',
    path: '/api/etat',
    caller: { en: 'Mobile app (/app)', fr: 'App mobile (/app)' },
    summary: {
      en: 'Public parking state for the phone home screen: per-minute rate, the two slots (libre/occupée) '
        + 'and sensor status. No session needed.',
      fr: 'État public du parking pour l\'écran d\'accueil mobile : tarif par minute, les deux places '
        + '(libre/occupée) et l\'état des capteurs. Sans session.',
    },
    response: { tarif: 0.03, pluie: false, etatParking: [{ nom: 'Place 1', etat: 'libre' }, { nom: 'Place 2', etat: 'occupée' }], barriere: 'fermee', capteurs: 'ok' },
  },
  {
    method: 'GET',
    path: '/api/session',
    caller: { en: 'Mobile app (/app)', fr: 'App mobile (/app)' },
    summary: {
      en: 'Live session for a logged-in cardholder (send the sessionId as "X-Session-Id"): entry time, balance, '
        + 'per-minute rate and estimated time left. 410 with a receipt once the session is ended.',
      fr: 'Session en direct d\'un titulaire connecté (sessionId en « X-Session-Id ») : heure d\'entrée, solde, '
        + 'tarif par minute et temps restant estimé. 410 avec un reçu une fois la session terminée.',
    },
    response: { entree: '2026-10-24T12:00:00.000Z', solde: 12.5, tarif: 0.03, tempsRestantSec: 25000, tempsRestant: 25000, finEstimee: '2026-10-24T18:56:40.000Z', place: 'Place 1 couverte', pluie: false, etatParking: [], barriere: 'fermee', capteurs: 'ok' },
    errors: [
      { status: 401, body: { code: 'session_absente', erreur: 'Session absente.' } },
      { status: 410, body: { code: 'session_terminee', duree: 3600, prix: 1.5, soldeFinal: 11, entree: '…', sortie: '…' } },
    ],
  },
  {
    method: 'POST',
    path: '/api/recharge',
    caller: { en: 'Mobile app (/app)', fr: 'App mobile (/app)' },
    summary: {
      en: 'Top up the logged-in card (send "X-Session-Id"). Amount must be 5, 10 or 20 DT.',
      fr: 'Recharge la carte connectée (en-tête « X-Session-Id »). Montant 5, 10 ou 20 DT.',
    },
    body: { montant: 10 },
    response: { solde: 22.5 },
    errors: [
      { status: 400, body: { code: 'montant_invalide', erreur: 'Montant invalide.' } },
      { status: 401, body: { code: 'session_absente', erreur: 'Session absente.' } },
    ],
  },
  {
    method: 'POST',
    path: '/api/sortie',
    caller: { en: 'Mobile app (/app)', fr: 'App mobile (/app)' },
    summary: {
      en: '"Quit parking" from the phone (send "X-Session-Id"). Same as tapping the card at the exit: closes '
        + 'the visit and bills it with the app tariff (planned / free time), then the ESP32 opens the exit '
        + 'barrier on its next /api/slots report (dropped after 30 s if the gate is offline). Returns the receipt.',
      fr: '« Quitter le parking » depuis le mobile (en-tête « X-Session-Id »). Comme une sortie à la barrière : '
        + 'clôture et facture le passage au tarif app (durée choisie / temps libre), puis l\'ESP32 ouvre la '
        + 'barrière de sortie à son prochain /api/slots (abandonné après 30 s si la barrière est hors ligne). Renvoie le reçu.',
    },
    response: { barriere: 'ouverture', duree: 3600, prix: 1, soldeFinal: 11, entree: '2026-10-24T12:00:00.000Z', sortie: '2026-10-24T13:00:00.000Z', gate: false },
    errors: [
      { status: 401, body: { code: 'session_absente', erreur: 'Session absente.' } },
      { status: 409, body: { code: 'visite_absente', erreur: 'Aucun stationnement en cours.' } },
    ],
  },
  {
    method: 'GET',
    path: '/api/gate/cards',
    caller: { en: 'ESP32 gate', fr: 'ESP32 (barrière)' },
    summary: {
      en: 'The cards the gate may let in (ACTIVE, with a name and a balance > 0), as one comma-separated string. '
        + 'The ESP32 saves it in flash so OFFLINE mode also refuses every other card ("Unknown card").',
      fr: 'Les cartes autorisées à entrer (ACTIVE, avec un nom et un solde > 0), en une chaîne séparée par des virgules. '
        + 'L\'ESP32 la garde en mémoire pour que le mode HORS LIGNE refuse aussi les autres cartes (« Unknown card »).',
    },
    response: { ok: true, count: 2, uids: '0B:69:AC:8E,95:AA:3D:B0' },
  },
  {
    method: 'POST',
    path: '/api/session/plan',
    caller: { en: 'Mobile app (/app)', fr: 'App mobile (/app)' },
    summary: {
      en: 'Choose how long you will stay (send "X-Session-Id"), once per stay. {minutes: 30|60|120|180} = planned '
        + 'stay at the cheaper planned rate (overtime at the free rate); {minutes: null} = free time at the higher rate.',
      fr: 'Choisir la durée du stationnement (en-tête « X-Session-Id »), une fois par passage. {minutes: 30|60|120|180} '
        + '= durée choisie au tarif réduit (dépassement au tarif libre) ; {minutes: null} = temps libre, tarif plus élevé.',
    },
    body: { minutes: 60 },
    response: { plan: { minutes: 60 }, coutActuel: 0.12, solde: 9.88, tarifHeure: 1, tempsRestantSec: 3400, depassement: false },
    errors: [
      { status: 400, body: { code: 'duree_invalide', erreur: 'Durée invalide.' } },
      { status: 409, body: { code: 'plan_deja_choisi', erreur: 'Durée déjà choisie.' } },
    ],
  },
  {
    method: 'GET',
    path: '/api/gate-status',
    caller: { en: 'ESP32 (gate)', fr: 'ESP32 (barrière)' },
    summary: {
      en: 'The ESP32 polls this during the 20 s code window after an entry: has the 6-digit code been '
        + '"used" (claimed)? claimed=true -> app mode; else after the window -> no-app paid parking.',
      fr: 'L\'ESP32 l\'interroge pendant la fenêtre de 20 s après une entrée : le code à 6 chiffres a-t-il '
        + 'été « utilisé » (claimed) ? claimed=true -> mode app ; sinon après la fenêtre -> parking payant sans app.',
    },
    response: { ok: true, found: true, claimed: false, owner: 'Ahmed', expired: false },
  },
  {
    method: 'POST',
    path: '/api/gate/claim',
    caller: { en: 'Dashboard (Gate page)', fr: 'Dashboard (page Barrière)' },
    summary: {
      en: 'Marks a code as "used" — simulates the mobile-app login manually from the dashboard, '
        + 'so the whole flow can be tested without the app.',
      fr: 'Marque un code comme « utilisé » — simule la connexion à l\'app mobile manuellement depuis le '
        + 'dashboard, pour tester tout le flux sans l\'app.',
    },
    body: { code: '482915' },
    response: { ok: true, claimed: true, owner: 'Ahmed' },
    errors: [{ status: 404, body: { ok: false, error: 'Code introuvable ou expiré.' } }],
  },
  {
    method: 'GET',
    path: '/api/gate',
    caller: { en: 'Dashboard (Gate page)', fr: 'Dashboard (page Barrière)' },
    summary: {
      en: 'Live gate state: cars currently inside (code, claimed/app, elapsed time, running no-app cost) '
        + 'and the last few exits (duration + cost). No-app billing is perBlock TND every blockSec seconds.',
      fr: 'État de la barrière en direct : voitures à l\'intérieur (code, claimed/app, temps écoulé, coût sans-app '
        + 'en cours) et les dernières sorties (durée + coût). Tarif sans-app : perBlock TND par blockSec secondes.',
    },
    response: {
      ok: true, demo: true, blockSec: 30, perBlock: 1,
      active: [{ uid: '95:AA:3D:B0', owner: 'Ahmed', enteredAt: '2026-10-27T12:00:00.000Z', code: '482915', claimed: false, mode: 'noapp', elapsedSec: 95, runningCost: 4 }],
      recent: [{ uid: '1C:44:9F:02', owner: 'Sarra', entry: '…', exit: '…', durationSec: 320, cost: 11 }],
    },
  },
  {
    method: 'GET',
    path: '/api/gate-session',
    caller: { en: 'Mobile page (/home/mobile.html)', fr: 'Page mobile (/home/mobile.html)' },
    summary: {
      en: 'The driver enters their 6-digit code; this is the live view of their own car: elapsed time, '
        + 'running cost, and slot occupancy. found=false once they have left.',
      fr: 'Le conducteur saisit son code à 6 chiffres ; vue en direct de sa propre voiture : temps écoulé, '
        + 'coût en cours et occupation des places. found=false une fois sorti.',
    },
    response: { ok: true, found: true, owner: 'Ahmed', claimed: true, enteredAt: '2026-10-27T12:00:00.000Z', elapsedSec: 95, runningCost: 4, parked: true, slots: [{ id: 1, occupied: true }, { id: 2, occupied: false }] },
  },
  {
    method: 'GET',
    path: '/api/docs',
    caller: { en: 'This page', fr: 'Cette page' },
    summary: { en: 'This documentation as JSON.', fr: 'Cette documentation au format JSON.' },
  },
  {
    method: 'GET',
    path: '/',
    caller: { en: 'Browser', fr: 'Navigateur' },
    summary: { en: 'Redirects to the web pages at /home.', fr: 'Redirige vers les pages web sur /home.' },
  },
];

const frontend = {
  en: [
    'All web pages live in frontend/ and are served at /home (index.html -> /home, docs.html -> /home/docs). The backend itself only has routes.',
    'Use relative URLs like fetch(\'/api/status\') when the page is served by the backend.',
    'Developing on your own dev server (Vite, etc.)? Call the full URL: ' + BASE_URL + '/api/status. CORS allows it.',
    'Run locally instead: cd backend && npm install && npm start, then open http://localhost:3000/home.',
    'Current page: frontend/index.html, a status page that polls /api/status every 2 s.',
  ],
  fr: [
    'Toutes les pages web sont dans frontend/ et servies sur /home (index.html -> /home, docs.html -> /home/docs). Le backend ne contient que des routes.',
    'Utilisez des URL relatives comme fetch(\'/api/status\') quand la page est servie par le backend.',
    'Vous développez avec votre propre serveur (Vite, etc.) ? Appelez l\'URL complète : ' + BASE_URL + '/api/status. CORS l\'autorise.',
    'Ou lancez en local : cd backend && npm install && npm start, puis ouvrez http://localhost:3000/home.',
    'Page actuelle : frontend/index.html, une page d\'état qui interroge /api/status toutes les 2 s.',
  ],
};

// Routes registered on the Express app (Express 4 router internals).
function listRoutes(app) {
  return app._router.stack
    .filter((l) => l.route)
    .flatMap((l) => Object.keys(l.route.methods).map((m) => ({ method: m.toUpperCase(), path: l.route.path })));
}

function buildDocs(app) {
  const documented = new Set(endpoints.map((e) => `${e.method} ${e.path}`));
  const undocumented = listRoutes(app).filter((r) => !documented.has(`${r.method} ${r.path}`));
  return { baseUrl: BASE_URL, intro, endpoints, frontend, undocumented };
}

module.exports = { buildDocs };
