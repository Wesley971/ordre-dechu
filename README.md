# 🧙‍♂️ Mini RPG - Projet JavaScript

Bienvenue dans mon **mini RPG** développé en pur **HTML / CSS / JavaScript**, dans l'esprit des **Final Fantasy à l'ancienne** (jauges ATB, menus de commande, magie et objets), habillé aux couleurs sombres et dorées de *L'Ordre Déchu*.
Ce projet est né d'une passion pour les jeux vidéo et d'une volonté d'apprendre par la pratique, sans framework ni moteur de jeu.

Il met en scène *Maelor*, qui porte le blason d'un ordre de chevaliers effacé des mémoires, accompagné de *Lyra* la mage noire et d'*Elwen* la mage blanche, dans une aventure sombre en cinq chapitres. Personne ne l'a choisi : il a choisi de venir.

## 🎮 Fonctionnalités actuelles

* **Groupe de 3 héros** aux rôles distincts : Maelor (chevalier déchu), Lyra (mage noire), Elwen (mage blanche)
* **Combat ATB** (Active Time Battle) : chaque combattant a une jauge qui se remplit selon sa vitesse ; les ennemis n'attendent pas
* Mode **Attente** : le temps se fige quand tu fouilles dans les menus Magie / Objet (réglable dans `config.js`)
* Menu de commandes façon FF : **Attaque**, **Techniques / Magie**, **Objet**, **Défense**, **Fuite**
* **Magie et PM** : Feu, Glace, Foudre, Brasier, Soin, Soin+, Vie, et les techniques de Maelor (Lame Déchue, Tourbillon)
* **Faiblesses élémentaires** : le Squelette craint le feu, l'Ogre la foudre, le Dragon la glace… et il **absorbe** le feu
* Les soins **brûlent les créatures d'os** (vise un Squelette avec Soin ou une Potion)
* **Objets** partagés : Potion, Éther, Queue de Phénix
* Coups critiques, attaques ratées, **K.O.** et réanimation
* **Boss** avec phase de fureur sous 50 % de PV
* **Écran de victoire** : XP, Gils, objets trouvés, montées de niveau, nouveaux sorts appris
* Chiffres de dégâts rebondissants, effets de sorts, héros qui s'avancent pour agir
* Dialogues avec **texte qui s'écrit lettre par lettre**
* **Fragments de mémoire** : le blason de Maelor révèle, chapitre après chapitre, le passé de l'Ordre et son lien avec les dragons
* **Choix final** : une fois le Dragon vaincu, l'épargner ou l'achever mène à deux fins différentes
* **Bruitages 8-bit** générés en direct avec la Web Audio API (aucun fichier son), bouton pour couper le son
* Jouable au **clavier**, à la **souris / au doigt**, et à la **manette** (API Gamepad : Xbox, PlayStation…)
* **Défaite** avec possibilité de réessayer le chapitre en cours
* Toutes les valeurs de gameplay centralisées dans `config.js` et `data.js`

## 🕹️ Commandes

| Action | Clavier | Manette | Souris / tactile |
|---|---|---|---|
| Se déplacer dans les menus | Flèches | Croix directionnelle / stick gauche | Survol |
| Valider | Entrée, Espace, Z | A | Clic |
| Revenir | Échap, Retour arrière, X | B | « ◀ Retour » |
| Changer de héros prêt | Échap sur le menu principal | B | — |
| Changer de camp en visant | ← ennemis · → alliés | Croix directionnelle | Clic sur la cible |

## 🗂️ Architecture des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure HTML du jeu, IDs utilisés par le JS |
| `design-system.css` | Design System : tokens CSS (couleurs, typographie, espacements) et styles de base |
| `style.css` | Mise en page, fenêtres, sprites, animations |
| `config.js` | Constantes de gameplay (vitesse ATB, dégâts, XP par niveau) et toutes les durées — chargé en premier |
| `player.js` | Création des héros, XP, montées de niveau, récompenses |
| `data.js` | Héros, sorts, objets, ennemis, chapitres, textes + objet `GameState` |
| `sfx.js` | Bruitages 8-bit (Web Audio API) |
| `input.js` | Clavier et manette traduits en actions (`up`, `confirm`, `cancel`…) |
| `battle.js` | Moteur de combat : calculs purs (dégâts, soins, ciblage) et boucle ATB |
| `menu.js` | Petit menu de choix (titre, dialogues), menus de commande et sélection des cibles |
| `ui.js` | Affichage DOM : scène, fenêtres, chiffres de dégâts, animations |
| `dialog.js` | Fenêtre de dialogue avec effet machine à écrire, et questions à choix |
| `script.js` | Déroulement de la partie : titre, chapitres, victoire, défaite |

## 🛠️ Technologies utilisées

* HTML (structure du jeu)
* CSS (style, ambiance RPG, animations)
* JavaScript (logique de combat, DOM, interactivité, narration)

## 🚀 Lancer le jeu

1. Clone ou télécharge ce dépôt
2. Ouvre le fichier `index.html` dans ton navigateur
3. Choisis « Nouvelle partie » et profite de l'expérience !

```bash
git clone https://github.com/Wesley971/Mini-RPG.git
```

Ou teste directement la démo ici :
🔗 [https://wesley971.github.io/Mini-RPG/](https://wesley971.github.io/Mini-RPG/)

## 🔧 Conventions du code

Le code a d'abord été refactorisé en 5 chantiers (extraction de fonctions, état centralisé, logique pure séparée du DOM, `addEventListener` au lieu des `onclick`, constantes dans `config.js`). Ces principes sont restés et s'appliquent partout :

| Règle | Exemple |
|---|---|
| **Identifiants en anglais**, textes affichés et commentaires en français | `SPELLS.fire` s'affiche « Feu », `ENEMIES.goblin` s'affiche « Gobelin » |
| **Logique pure séparée du DOM** | `calcPhysical`, `calcMagic`, `calcHeal` (battle.js) ne touchent jamais à la page ; `ui.js` affiche |
| **Un objet par module qui garde un état**, nommé en PascalCase | `GameState`, `Battle`, `Menu`, `Dialog`, `Input`, `Sfx` |
| **Réglages dans `config.js`, contenu dans `data.js`** | `CONFIG.timing.death`, `CONFIG.damage.critChance`, `ENEMIES.dragon` |
| **Couleurs de l'interface via les tokens** (seuls les effets de sorts et les ombres ont leurs propres valeurs) | `var(--gold-bright)`, `var(--state-heal)` |
| **Fichiers et images en kebab-case anglais** ; l'image d'un héros porte son id | `images/maelor.png`, `images/lyra.svg` |

## 🎨 Design System

Tout le jeu (écran titre, combat, dialogues) repose sur un seul Design System, défini dans `design-system.css` :

* **Polices** : [Cinzel Decorative](https://fonts.google.com/specimen/Cinzel+Decorative) pour le logo uniquement, [DotGothic16](https://fonts.google.com/specimen/DotGothic16) pour tout le reste
* **Palette** : noirs profonds, ors vieillis et texte parchemin ; des couleurs d'état réservées au combat (PV, PM, soins, faiblesses, K.O.)
* **Une seule fenêtre** : `.window` (fond sombre dégradé, liseré or, coins à 2 px) sert pour l'écran titre, la scène, les menus, les dialogues et le bouton son
* **Un seul curseur** : la main dorée `images/hand.svg` désigne l'option ou la cible choisie, partout
* **Tokens CSS** : couleurs, typographie, espacements, curseurs de souris exposés comme variables `--var`
* **Composants** : `.window`, `.window-title`, `.menu` / `.menu-item`, `.sprite`, `.party-row`, `.popup`

## 🎯 Objectif pédagogique

Ce projet m'a permis de progresser concrètement en :

* Logique JavaScript (fonctions, conditions, timers...)
* Structuration d'un mini jeu sans framework
* Expérience utilisateur interactive et fluide
* Création de contenu narratif intégré au gameplay

## ✨ À venir (Roadmap)

* Marchand entre les chapitres pour dépenser les Gils (potions, équipement)
* Équipement (armes, armures) et statuts (poison, sommeil…)
* Sauvegarde dans le navigateur
* Musiques d'ambiance
* Carte d'exploration avec rencontres aléatoires

## 🤝 Contribuer

Ce projet est un **exercice d'apprentissage personnel**, mais si tu veux contribuer, proposer des idées ou t'en inspirer, n'hésite pas !

Merci de ton passage, et bonne aventure dans les terres du Val Ténébreux ⚔️
