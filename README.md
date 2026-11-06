# ⚔️ L'Ordre Déchu - Projet TypeScript

Bienvenue dans **L'Ordre Déchu**, mon RPG développé en pur **HTML / CSS / TypeScript**, dans l'esprit des **Final Fantasy à l'ancienne** (jauges ATB, menus de commande, Souffle et objets), habillé de couleurs sombres et dorées.
Ce projet est né d'une passion pour les jeux vidéo et d'une volonté d'apprendre par la pratique, sans framework ni moteur de jeu.

Il met en scène *Maelor*, qui porte le blason d'un ordre de chevaliers effacé des mémoires, accompagné de *Corvin* le veilleur et d'*Elwen* la Source, dans une aventure sombre en sept chapitres. Personne ne l'a choisi : il a choisi de venir.

## 🎮 Fonctionnalités actuelles

* **Groupe de 3 héros** aux rôles distincts : Maelor (chevalier déchu), Corvin (veilleur), Elwen (Source)
* **Combat ATB** (Active Time Battle) : chaque combattant a une jauge qui se remplit selon sa vitesse ; les ennemis n'attendent pas
* Mode **Attente** : le temps se fige quand tu fouilles dans les techniques ou la Besace (réglable dans `src/config.ts`)
* Menu de commandes façon FF : **Frapper**, **Gestes / Lanterne / Source** (les techniques de chaque héros), **Besace**, **Garde**, **Repli**
* **Techniques et PS** (points de Souffle) : les gestes de Maelor (Vordrak, Édrag), la lanterne de Corvin (Mèche, Nuit blanche, Tocsin, Soufre) et la Source d'Elwen (Nios, Aurésor, Liéver) ; l'élément s'affiche dans la liste
* **Faiblesses élémentaires** : le Gau-Tik craint la foudre, Vahn la glace… et il **absorbe** le feu
* **Besace** partagée : Sève, Encens, Larme dorée
* Coups critiques, attaques ratées, héros **éteints** et ranimés
* **Boss** avec phase de fureur sous 50 % de PV
* **Écran de victoire** : XP, Couronnes, objets trouvés, montées de niveau, nouveaux souffles appris
* Chiffres de dégâts rebondissants, effets de souffles, héros qui s'avancent pour agir
* Dialogues avec **texte qui s'écrit lettre par lettre**
* **Fragments de mémoire** : le blason de Maelor révèle, chapitre après chapitre, le passé de l'Ordre et son lien avec les dragons
* **Choix** : prendre ou refuser le pouvoir du Cœur d'Aure-Hin, puis épargner ou achever le Dragon vaincu ; quatre fins différentes
* **Bruitages 8-bit** générés en direct avec la Web Audio API, et **musiques d'ambiance** libres (une par lieu, CC-BY), bouton pour couper le son
* Jouable au **clavier**, à la **souris / au doigt**, et à la **manette** (API Gamepad : Xbox, PlayStation…)
* **Défaite** avec possibilité de réessayer le chapitre en cours
* Toutes les valeurs de gameplay centralisées dans `src/config.ts` et `src/data/game-data.ts`

## 🕹️ Commandes

| Action | Clavier | Manette | Souris / tactile |
|---|---|---|---|
| Se déplacer dans les menus | Flèches | Croix directionnelle / stick gauche | Survol |
| Valider | Entrée, Espace, Z | A | Clic |
| Revenir | Échap, Retour arrière, X | B | « ◀ Retour » |
| Changer de héros prêt | Échap sur le menu principal | B | — |
| Changer de camp en visant | ← ennemis · → alliés | Croix directionnelle | Clic sur la cible |

## 🗂️ Architecture des fichiers

Chaque fichier TypeScript est un module ES qui importe explicitement ce qu'il utilise. Les types sont déclarés à côté du code qui les produit.

| Fichier | Rôle |
|---|---|
| `index.html` | Structure HTML du jeu, IDs utilisés par le code |
| `src/main.ts` | Point d'entrée : mode test, affichage DOM, puis lancement de la partie |
| `src/game-view.ts` | Contrat entre la logique du jeu et son affichage (`GameView`) |
| `src/config.ts` | Constantes de gameplay (vitesse ATB, dégâts, XP par niveau) et toutes les durées |
| `src/data/game-data.ts` | Héros, souffles, objets, ennemis, chapitres, textes + objet `GameState` |
| `src/data/decors.ts` | Décors peints en 2,5D : images, relief, places des personnages et ambiance de chaque lieu |
| `src/scene/` | Scène peinte en 2,5D (Three.js), pas encore branchée sur le jeu : cadrage, relief, brume, lucioles, sprites nets |
| `src/dev/` | Outils de test en local : mode test, page de contrôle de la scène, vue muette, combats sans navigateur, tests Vitest |
| `src/party/heroes.ts` | Création des héros, XP, montées de niveau, récompenses |
| `src/battle/battle.ts` | Moteur de combat : calculs purs (dégâts, soins, ciblage) et boucle ATB |
| `src/story/game-flow.ts` | Déroulement de la partie : titre, chapitres, victoire, défaite |
| `src/ui/dom-view.ts` | Implémentation DOM du contrat : relie la logique à la page, aux sons et aux contrôles |
| `src/ui/view.ts` | Affichage DOM : scène, fenêtres, chiffres de dégâts, animations |
| `src/ui/battle-menu.ts` | Menus de commande et sélection des cibles ; rend l'ordre du joueur à la logique |
| `src/ui/dialog.ts` | Fenêtre de dialogue avec effet machine à écrire, et questions à choix |
| `src/ui/pick-option.ts` | Petit menu de choix (titre, dialogues) |
| `src/audio/sfx.ts` | Bruitages 8-bit (Web Audio API) |
| `src/audio/music.ts` | Musiques d'ambiance : une piste par lieu, boucle et fondus |
| `src/input/input.ts` | Clavier et manette traduits en actions (`up`, `confirm`, `cancel`…) |
| `src/styles/design-system.css` | Design System : tokens CSS (couleurs, typographie, espacements) et styles de base |
| `src/styles/style.css` | Mise en page, fenêtres, sprites, animations |
| `public/images/` | Images, copiées telles quelles dans le build |
| `public/audio/` | Musiques (MP3 96 kbps), chargées seulement quand elles servent |
| `public/licenses/` | Texte des licences à publier avec le jeu (Three.js) |
| `vite.config.ts` | Configuration de Vite (`base` de GitHub Pages) |
| `tsconfig.json` | Configuration de TypeScript (mode strict) |
| `eslint.config.js` | Règles d'ESLint, dont la séparation entre logique et affichage |
| `.nvmrc` | Version de Node, la même sur le PC et sur GitHub |
| `.github/workflows/ci.yml` | Lint, types, tests, combats sans navigateur et build à chaque push et à chaque pull request |
| `.github/workflows/deploy.yml` | Mêmes contrôles, build et publication sur GitHub Pages à chaque push sur `main` |

## 🛠️ Technologies utilisées

* HTML (structure du jeu)
* CSS (style, ambiance RPG, animations)
* TypeScript strict en modules ES (logique de combat, DOM, interactivité, narration)
* [Vite](https://vite.dev/) (serveur de développement et build)
* [Three.js](https://threejs.org/) (scène peinte en 2,5D, chargée seulement à la demande)
* [Vitest](https://vitest.dev/) (tests des règles du combat, outil de développement non publié avec le jeu)
* [ESLint](https://eslint.org/) et [typescript-eslint](https://typescript-eslint.io/) (vérification du code, outils de développement non publiés avec le jeu)

## 🚀 Lancer le jeu

Il faut [Node.js](https://nodejs.org/), dans la version indiquée par `.nvmrc`. Le jeu ne s'ouvre plus d'un double-clic sur `index.html` : les navigateurs bloquent les modules ES en `file://`.

```bash
git clone https://github.com/Wesley971/ordre-dechu.git
cd ordre-dechu
npm install
npm run dev
```

Puis ouvre l'adresse affichée (`http://localhost:5173/ordre-dechu/`) et choisis « Nouvelle partie ».

Pour tester la version de production : `npm run build`, puis `npm run preview`.

Pour vérifier le code : `npm run lint`. Pour vérifier les types : `npm run typecheck` (Vite compile le TypeScript sans le vérifier).

Pour lancer les tests des règles du combat : `npm test`. Pour jouer un combat de chaque chapitre sans navigateur : `npm run check:battle`.

Ou teste directement la démo ici :
🔗 [https://wesley971.github.io/ordre-dechu/](https://wesley971.github.io/ordre-dechu/)

## 🔧 Conventions du code

Le code a d'abord été refactorisé en 5 chantiers (extraction de fonctions, état centralisé, logique pure séparée du DOM, `addEventListener` au lieu des `onclick`, constantes dans `config.ts`). Ces principes sont restés et s'appliquent partout :

| Règle | Exemple |
|---|---|
| **Identifiants en anglais**, textes affichés et commentaires en français | `SPELLS.fire` s'affiche « Mèche », `ENEMIES.gautik` s'affiche « Gau-Tik » |
| **Logique séparée de l'affichage** | `battle.ts` et `game-flow.ts` ne connaissent que l'interface `GameView` ; `dom-view.ts` l'implémente sur la page |
| **Un objet par module qui garde un état**, nommé en PascalCase | `GameState`, `Battle`, `Menu`, `Dialog`, `Input`, `Sfx` |
| **Réglages dans `config.ts`, contenu dans `game-data.ts`** | `CONFIG.timing.death`, `CONFIG.damage.critChance`, `ENEMIES.vahn` |
| **Couleurs de l'interface via les tokens** (seuls les effets de souffles et les ombres ont leurs propres valeurs) | `var(--gold-bright)`, `var(--state-heal)` |
| **Fichiers et images en kebab-case anglais**, rangés par domaine sous `src/` ; l'image d'un héros porte son id | `src/ui/battle-menu.ts`, `images/maelor.png` |

## 🎨 Design System

Tout le jeu (écran titre, combat, dialogues) repose sur un seul Design System, défini dans `src/styles/design-system.css` :

* **Polices** : [Cinzel Decorative](https://fonts.google.com/specimen/Cinzel+Decorative) pour le logo uniquement, [DotGothic16](https://fonts.google.com/specimen/DotGothic16) pour tout le reste
* **Palette** : noirs profonds, ors vieillis et texte parchemin ; des couleurs d'état réservées au combat (PV, PS, soins, faiblesses, héros éteint)
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

* Marchand entre les chapitres pour dépenser les Couronnes (Sève, équipement)
* Équipement (armes, armures) et statuts (poison, sommeil…)
* Sauvegarde dans le navigateur
* Carte d'exploration avec combats placés et rencontres optionnelles

## 📚 Documentation

* [Chronique du projet](docs/historique.md)

## 📜 Crédits

L'origine de chaque image, police et son est listée dans [`CREDITS.md`](CREDITS.md). Les images des héros ont été générées avec Gemini (Google), réduites en pixel art par un script, puis retouchées pixel par pixel sur mes choix.

## 🤝 Contribuer

Ce projet est un **exercice d'apprentissage personnel**, mais si tu veux contribuer, proposer des idées ou t'en inspirer, n'hésite pas !

Merci de ton passage, et bonne aventure dans les terres du Val Ténébreux ⚔️
