# 🧙‍♂️ Mini RPG - Projet JavaScript

Bienvenue dans mon **mini jeu RPG textuel** développé en pur **HTML / CSS / JavaScript**.
Ce projet est né d'une passion pour les jeux vidéo et d'une volonté d'apprendre par la pratique, sans framework ni moteur de jeu.

Il met en scène *Maelor*, dernier héritier d’un ordre oublié, dans une aventure sombre et progressive.

## 🎮 Fonctionnalités actuelles

* Intro narrative immersive
* Système de combat tour par tour avec riposte ennemie
* Animation d’impact sur les attaques
* Ennemis enchaînés avec changement de nom, image et HP
* Barres de vie visuelles et dynamiques (joueur et ennemis)
* Bouton de soin avec logique de contre-attaque
* Bouton de fuite avec chance d’échec ou de réussite, et bouton “Rejouer” généré dynamiquement
* Dégâts ennemis variables basés sur leur statistique `attack` propre
* Config gameplay centralisée (HP de départ, soins, dégâts, XP par niveau) dans `config.js`
* Reset complet de la partie sans rechargement de page

## 🗂️ Architecture des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure HTML du jeu, IDs utilisés par le JS |
| `style.css` | Mise en page, composants visuels, animations |
| `colors_and_type.css` | Design System : variables CSS (couleurs, espacements, typographie) |
| `config.js` | Constantes gameplay (HP, dégâts, soins, XP) — chargé en premier |
| `data.js` | Données ennemis + objet `GameState` (état global de la partie) |
| `script.js` | Logique de jeu, fonctions d'action (fight, heal, run) |
| `ui.js` | Fonctions d'affichage DOM (barres de vie, texte narratif, fin de partie) |
| `player.js` | Gestion de l'XP et des montées de niveau |

## 🛠️ Technologies utilisées

* HTML (structure du jeu)
* CSS (style, ambiance RPG, animations)
* JavaScript (logique de combat, DOM, interactivité, narration)

## 🚀 Lancer le jeu

1. Clone ou télécharge ce dépôt
2. Ouvre le fichier `index.html` dans ton navigateur
3. Clique sur "Commencer l'aventure" et profite de l’expérience !

```bash
git clone https://github.com/Wesley971/Mini-RPG.git
```

Ou teste directement la démo ici :
🔗 [https://wesley971.github.io/Mini-RPG/](https://wesley971.github.io/Mini-RPG/)

## 🔧 Refactorisation

Le code a fait l'objet d'une refactorisation en 5 chantiers pour améliorer sa lisibilité et sa maintenabilité :

| Chantier | Description |
|---|---|
| **1 — enemyCounterAttack()** | Extraction du bloc de contre-attaque dupliqué dans une fonction réutilisable |
| **2 — GameState** | Encapsulation de l'état global (`player`, `ennemiActuel`) dans un objet unique avec méthode `reset()` |
| **3 — Logique pure / DOM** | Séparation des calculs (`calcPlayerAttack`, `calcHeal`, `calcRun`) des effets de bord DOM |
| **4 — Handlers & config** | Suppression des `onclick` inline, migration vers `addEventListener`, remplacement des nombres magiques |
| **5 — config.js** | Centralisation de toutes les constantes gameplay dans un fichier dédié |

## 🎨 Design System

Le style du jeu repose sur un Design System dédié défini dans `colors_and_type.css` :

* **Polices** : [Cinzel Decorative](https://fonts.google.com/specimen/Cinzel+Decorative) (titres) et [Crimson Text](https://fonts.google.com/specimen/Crimson+Text) (corps de texte)
* **Palette** : tons noirs profonds, ors vieillis, rouge sang — inspirée de l'univers *The Witcher*
* **Tokens CSS** : couleurs, espacements, rayons, ombres et typographie exposés comme variables `--var`
* **Composants** : `.char-card`, `.stat-row`, `.bar-wrap`, `.intro-card`, `.story-box`, `.divider`

## 🎯 Objectif pédagogique

Ce projet m’a permis de progresser concrètement en :

* Logique JavaScript (fonctions, conditions, timers...)
* Structuration d’un mini jeu sans framework
* Expérience utilisateur interactive et fluide
* Création de contenu narratif intégré au gameplay

## ✨ À venir (Roadmap)

* Système de niveaux et d’XP
* Attaques spéciales avec cooldown
* Journal de combat
* Sons et musiques d’ambiance
* Inventaire (potions, équipements)

## 🤝 Contribuer

Ce projet est un **exercice d’apprentissage personnel**, mais si tu veux contribuer, proposer des idées ou t’en inspirer, n’hésite pas !

Merci de ton passage, et bonne aventure dans les terres du Val Ténébreux ⚔️
