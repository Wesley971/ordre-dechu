# L'Ordre Déchu : règles du dépôt

RPG au tour par tour (combat ATB) en TypeScript strict, modules ES, build Vite, publié sur GitHub Pages.

## Suivi
- Tickets dans YouTrack, projet **MAE**.
- Parcours d'un ticket : /task-flow au début, /lead-review puis /git-commit avant chaque commit.
- Statuts : Open → In Progress → To Verify → Done.
- Done seulement quand le code est sur `main`, le déploiement GitHub Pages réussi et la vérification sur le site en ligne faite.
- Le passage en Done se fait uniquement sur le « oui » de Wesley.

## Méthode
Règle de Wesley du 03/11/2026, pour tous les tickets :
- Avant la fusion, ce sont les tests automatiques de Claude (bot, comparaisons mot pour mot, débordements) qui vérifient. Wesley valide sur le rapport de Claude et l'avis de claude.ai ; il ne joue plus lui-même avant chaque fusion.
- Après la mise en ligne, des testeurs humains jouent sur le site, à vitesse normale. Un problème qu'ils trouvent devient un nouveau ticket.
- Un ticket passe en Done après la fusion, le déploiement et le contrôle en ligne de Claude, comme avant.

## Tickets
- Format des nouveaux tickets, et d'un ticket existant quand on l'ouvre avec /task-flow. Pas de réécriture en masse.
- Champs : Type, State, Priority, Assignee.
- Titre : un verbe à l'impératif suivi de l'objet concret, compréhensible sans jargon.
- Description, dans cet ordre (Contexte, Décisions et Hors périmètre si besoin) :
  - `Version : vX` en tête
  - `## Objectif`
  - `## Contexte`
  - `## Décisions du JJ/MM/AAAA`
  - `## Critères d'acceptation` (cases à cocher)
  - `## Hors périmètre`

## Branches
- Branche principale : `main`.
- Une branche par ticket, `type/description` depuis `main` (ex. `refactor/vite-es-modules`), puis PR vers `main`.
- Rien ne se commite directement sur `main`.

## Commandes
| Commande | Rôle |
|---|---|
| `npm install` | Installer les dépendances |
| `npm run dev` | Serveur de développement : `http://localhost:5173/ordre-dechu/` |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Servir `dist/` comme sur GitHub Pages |
| `npm run lint` | Vérifier le code avec ESLint (règles recommandées et règles de ce fichier, `eslint.config.js`, MAE-23) |
| `npm run typecheck` | Vérifier les types (`tsc --noEmit`, TypeScript 7) |
| `npm test` | Lancer les tests Vitest des règles du combat (dégâts, critiques, jauge ATB), une fois, sans mode surveillance (MAE-22) |
| `npm run check:battle` | Jouer un combat complet de chaque chapitre sous Node, sans navigateur, avec la vue muette (MAE-21) ; `-- <graine>` pour rejouer la même partie |

Mode test (MAE-68), en local seulement (`npm run dev` ou `npm run preview`), inerte sur le site en ligne :
```
http://localhost:5173/ordre-dechu/?chapitre=4&vitesse=4
```
- `chapitre=N` (1 à 7, numéro du titre) : « Nouvelle partie » démarre au chapitre N, sans prologue. Chaque héros a l'XP de tous les combats précédents, ses PV et PS pleins, et les objets de départ (sans les objets trouvés, ni la Larme dorée de l'écho) ; le groupe a les Couronnes de ces combats.
- `vitesse=X` (1 à 10) : durées, jauges ATB et animations CSS X fois plus rapides ; chaque page de dialogue attend toujours la validation. La vitesse du mode test sert au bot : en vitesse 4, l'ennemi agit plus vite qu'un humain ne peut réagir. L'équilibrage devant le Dragon se valide par des testeurs humains à vitesse normale, après la mise en ligne, pas seulement par le bot (décisions du 03/11/2026, voir « Méthode »).
- `pouvoir=pris` ou `pouvoir=refuse` (MAE-72) : la partie démarre avec le pouvoir du Cœur d'Aure-Hin déjà pris ou refusé, pour atteindre les quatre fins avec `chapitre=7` sans rejouer le choix du chapitre IV.
- `combat=gagne` (MAE-72) : dans chaque combat, l'ennemi tombe à 0 PV dès le début ; la suite se joue normalement (récompenses, choix face au Dragon, scènes, épilogues). Pour jouer les fins sans combattre, avec `chapitre=7`.
- `combat=perdu` (MAE-87) : dans chaque combat, les héros tombent à 0 PV dès le début, pour atteindre l'écran de défaite sans jouer.
- `scene=lisiere` (MAE-28) : affiche le décor seul, à la place du jeu, avec un compteur d'images/s à l'écran et les personnages du chapitre. Touche P : la caméra oscille pour montrer le relief. `qualite=1`, `2` ou `3` en plus : niveau de qualité du décor (`CONFIG.scene.qualityLevels`, 2 par défaut partout), affiché dans le compteur ; les sprites restent à pleine résolution. `verif=1` en plus : sans compteur, mesures pour le bot (`data-verif` sur `body`, `window.scenePreview`), à comparer aux PNG avec `tools/check-sprite-sharpness.mjs` du labo.
- `rendu=dom` (MAE-29) : les chapitres qui ont un décor s'affichent quand même en DOM, comme avant la scène peinte. Pour comparer deux versions du jeu avec le bot du labo.
- `compteur=1` (MAE-29) : compteur d'images/s à l'écran pendant les chapitres joués dans la scène peinte, pour mesurer sur un téléphone avec le HUD. En mode test, la scène peinte expose aussi ses mesures au bot (`window.battleStage.measure()`).
- Test sur un téléphone en Wi-Fi : `npm run preview -- --host`, puis ouvrir sur le téléphone l'adresse `Network` affichée, suivie de `?scene=lisiere`. Le mode test accepte aussi les adresses privées du réseau local (`192.168.*`, `10.*`, `172.16-31.*`). Fermer le serveur après le test.
- Les paramètres se combinent ou s'utilisent seuls. Le titre de l'onglet commence alors par « [Test] ». Une valeur invalide est ignorée, avec un avertissement dans la console.
- En mode test, la sauvegarde du navigateur (MAE-11) n'est ni lue ni écrite, et « Continuer » est masqué. Pour tester la reprise, placer une sauvegarde (clé `ordre-dechu-save`) puis ouvrir le jeu sans paramètre.
- Tests automatisés dans un navigateur invisible (headless) : toujours lancé sans le son (`--mute-audio`), pour que le jeu ne s'entende pas pendant les tests (décision de Wesley du 02/11/2026).

Les tests sont dans `src/dev/*.test.ts`, sous Node, sans DOM : hasard par `vi.spyOn` sur `Math.random` (`src/dev/test-helpers.ts`), combat par la vue muette.

Scène peinte en combat (MAE-29) : un chapitre qui déclare un décor (`decor` dans `CHAPTERS`, le chapitre I aujourd'hui) se joue dans la scène peinte en 2,5D ; les autres gardent le rendu DOM. Three.js et le décor se chargent au début de ce chapitre (`GameView.showChapter` est asynchrone), et si WebGL manque ou si le chargement échoue, le jeu se replie sur le DOM pour la partie. La scène couvre tout l'écran derrière l'interface DOM (menus, jauges, HUD, dialogue), la peinture est cadrée dans le rectangle de `#battle-scene`, au-dessus des fenêtres du bas. Sur chaque combattant, une ancre DOM (`.actor-anchor[data-sprite]`) suit le sprite : chiffres, effets, main de ciblage, bouclier et toucher de ciblage passent par elle. La partie « scène » de l'affichage est le contrat `Stage` (`src/ui/stage.ts`), avec deux versions : DOM (`stage.ts`) et peinte (`src/scene/battle-stage.ts`) ; `dom-view.ts` choisit par chapitre et joue les sons au même rang pour les deux. L'interface sera redessinée pour la scène dans MAE-50 ; les vraies animations et les effets des capacités viendront avec MAE-30 et MAE-31.

Vérification automatique (MAE-23) : `.github/workflows/ci.yml` lance lint, types, tests, `check:battle` (graine 2026) et build à chaque push et à chaque pull request ; `deploy.yml` lance les mêmes contrôles avant le build, et une erreur bloque la publication.

Vérification obligatoire : un ruleset de GitHub (n° 26702526, Settings > Rules > Rulesets) refuse toute fusion et tout push sur `main` dont le contrôle `verify` de `ci.yml` n'est pas vert, sans exception, y compris pour Wesley. Renommer le job oblige à changer aussi le ruleset. Pour le retirer : `gh api -X DELETE repos/Wesley971/ordre-dechu/rulesets/26702526`.

Version de Node : `.nvmrc` est la seule source, lue par `ci.yml` et `deploy.yml`, et le PC de Wesley a la même. Changer de version de Node se décide avec Wesley.

Deux TypeScript côte à côte : typescript-eslint ne prend pas encore en charge TypeScript 7, qui n'a pas d'API programmatique. D'après la recommandation de Microsoft, le paquet `typescript` est un alias de TypeScript 6, qui ne sert qu'au lint, et `@typescript/native` un alias de TypeScript 7, qui fournit `tsc` : le jeu est vérifié en TypeScript 7. Retirer ces alias quand typescript-eslint prendra en charge TypeScript 7.

Le jeu ne s'ouvre pas en `file://` : toujours passer par `npm run dev` ou `npm run preview`.

## Environnements
- Local : `npm run dev`, puis `npm run preview` pour vérifier le build.
- Production : `https://wesley971.github.io/ordre-dechu/`, publié par `.github/workflows/deploy.yml` à chaque push sur `main` (source Pages : « GitHub Actions »).

## Convention de noms
- Fichiers en minuscules avec tirets (kebab-case), en anglais, sans accents ni espaces.
- Code regroupé par domaine sous `src/` : `battle/`, `story/`, `party/`, `data/` (la logique : règles, état, histoire), `ui/` (l'affichage DOM : fenêtres, dialogue, menus de combat, scène DOM ; `dom-view.ts` implémente le contrat), `audio/`, `input/`, `styles/`, `scene/` (scène peinte en 2,5D et son branchement sur le combat, seul domaine à importer Three.js, jamais depuis le code de démarrage : toujours par `import()`), `dev/` (outils de test en local, dont la vue muette `silent-view.ts`, `headless-battle.ts` et les tests Vitest). Le contrat entre logique et affichage est `src/game-view.ts` ; celui entre l'affichage et sa scène est `src/ui/stage.ts`.
- Images dans `public/images/`, référencées en `images/...` dans le code et en `/images/...` dans le CSS.
- Musiques dans `public/audio/` (MP3 96 kbps stéréo), référencées en `audio/...` dans le code (`MUSIC`, `src/data/game-data.ts`).
- Identifiants en anglais ; textes affichés et commentaires en français.

## Modules
- Chaque fichier importe explicitement ce qu'il utilise, sans variable globale partagée.
- Aucun code exécuté au chargement d'un module ne doit appeler un autre module : les modules s'importent en boucle (combat, menu, affichage), et un tel appel tomberait sur une valeur pas encore initialisée. Le code de démarrage va dans `src/main.ts`.
- TypeScript strict : pas de `any`, pas de `!` (assertion non nulle), chaque `as` justifié en commentaire.
- Logique et affichage séparés (MAE-21) : `src/battle/`, `src/story/`, `src/party/` et `src/data/` ne touchent ni au DOM ni à Three.js (aucun `document`, aucun `three`, vérifiable par recherche) et n'importent rien de `ui/`, `audio/`, `scene/` ni `dev/` (sauf des types, par `import type`). La logique reçoit son affichage en paramètre (`startGame`, `runBattle`) et ne lui parle que par l'interface `GameView` de `src/game-view.ts`. L'affichage lit l'état (`GameState`, `Battle`) pour dessiner, mais ne le modifie pas : il rend les décisions du joueur (ordres de combat, choix) par des promesses. Sons et musiques sont du côté de l'affichage. Toute nouvelle sortie visuelle ou sonore passe par une méthode du contrat, implémentée dans `ui/dom-view.ts` et dans `dev/silent-view.ts`.

## Sauvegarde
- La partie est sauvegardée dans le navigateur au début de chaque chapitre (MAE-11, `src/data/save-game.ts`) ; une fin l'efface.
- Changer la forme du point de reprise (`Checkpoint`) ou l'ordre des chapitres oblige à augmenter `SAVE_VERSION` (`src/data/game-data.ts`) : une sauvegarde d'une autre version est ignorée, au lieu de reprendre au mauvais chapitre.

## Histoire
- Tout texte d'histoire du jeu (prologue, chapitres, fragments de mémoire, répliques, choix et fins) respecte la bible de l'univers : `docs/lore.md` (décisions du 02/11/2026, MAE-66).
- Les mots inventés du monde (lieux, peuples, capacités) suivent le lexique : `docs/lexique.md` (MAE-75). Un nouveau mot s'y ajoute d'abord, avec son sens.

## Interface et design
- Tout écran ou élément d'interface se code d'après une maquette validée dans le ticket de design correspondant (epic MAE-15).
- Toute image de personnage (héros ou ennemi) suit la palette des personnages : `docs/character-palette.md`. L'interface, elle, suit le Design System v3.

## Assets
- Tout asset (image, sprite, police, son, musique) doit avoir une licence autorisant l'usage commercial. Musique en CC0 ou CC-BY ; aucune licence NC.
- Chaque asset est crédité dans `CREDITS.md`.
- Les images de décor générées avec Gemini sont autorisées, et créditées « générée avec Gemini » dans `CREDITS.md` (conditions de Google vérifiées le 03/11/2026 : `https://policies.google.com/terms` et `https://policies.google.com/terms/generative-ai`).
- Licence CraftPix §3.1 : aucun sprite CraftPix ne passe dans un outil d'IA, même comme référence, pour s'en inspirer ou pour une recoloration. Aucun sprite CraftPix n'entre dans le jeu (décision du 28/10/2026, MAE-26).

## Labo
- Le prototypage se fait hors du dépôt, dans `ProjetDEV/Projets/ordre-dechu-lab`.
