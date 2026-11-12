# Outils d'Administration et de Simulation Terminal

Ces outils en Node.js pur (sans dépendance) permettent d'administrer les cartes, de consulter l'historique et de simuler les capteurs et passages matériels de l'ESP32 directement depuis le terminal.

Ils communiquent avec le serveur via l'en-tête `X-Device-Token` lu depuis la variable d'environnement `$env:DEVICE_TOKEN`.

---

## 1. Gestion des Cartes (`cartes.js`)

Permet de lister, d'ajouter, de recharger ou de bloquer des cartes d'abonnés ou de visiteurs dans `data/cartes.json`.

```bash
# Lister toutes les cartes enregistrées
node outils/cartes.js lister

# Ajouter un abonné (solde initial 10 DT par défaut)
node outils/cartes.js ajouter ABONNE4 "Ali Gharbi" ABONNE 20

# Ajouter un visiteur (solde 0 DT)
node outils/cartes.js ajouter VISITEUR3 "Touriste" VISITEUR 0

# Recharger le solde d'une carte (en DT)
node outils/cartes.js recharger ABONNE1 15

# Bloquer ou débloquer une carte
node outils/cartes.js bloquer ABONNE2 true
node outils/cartes.js bloquer ABONNE2 false
```

---

## 2. Historique des Passages (`historique.js`)

Affiche sous forme de tableau les dernières entrées et sorties enregistrées dans `data/historique.json`.

```bash
node outils/historique.js
```

---

## 3. Simulation Matérielle & Capteurs (`simuler.js`)

Simule en direct les requêtes envoyées par le microcontrôleur ESP32 :

```bash
# Simuler la pluie (débruitage : 3 s pour confirmer, 30 s de sec pour terminer)
node outils/simuler.js pluie on
node outils/simuler.js pluie off

# Simuler l'état physique des capteurs de stationnement
node outils/simuler.js place 1 occupee
node outils/simuler.js place 1 libre
node outils/simuler.js place 2 occupee
node outils/simuler.js place 2 libre

# Simuler le passage d'une carte RFID MIFARE sur la borne d'entrée / sortie
node outils/simuler.js carte ABONNE1
node outils/simuler.js carte VISITEUR1
```
