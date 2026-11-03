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
| `npm run typecheck` | Vérifier les types (`tsc --noEmit`), aussi lancé par le déploiement avant le build |

Mode test (MAE-68), en local seulement (`npm run dev` ou `npm run preview`), inerte sur le site en ligne :
```
http://localhost:5173/ordre-dechu/?chapitre=4&vitesse=4
```
- `chapitre=N` (1 à 7, numéro du titre) : « Nouvelle partie » démarre au chapitre N, sans prologue. Chaque héros a l'XP de tous les combats précédents, ses PV et PS pleins, et les objets de départ (sans les objets trouvés, ni la Larme dorée de l'écho) ; le groupe a les Couronnes de ces combats.
- `vitesse=X` (1 à 10) : durées, jauges ATB et animations CSS X fois plus rapides ; chaque page de dialogue attend toujours la validation. La vitesse du mode test sert au bot : en vitesse 4, l'ennemi agit plus vite qu'un humain ne peut réagir. L'équilibrage devant le Dragon se valide par des testeurs humains à vitesse normale, après la mise en ligne, pas seulement par le bot (décisions du 03/11/2026, voir « Méthode »).
- `pouvoir=pris` ou `pouvoir=refuse` (MAE-72) : la partie démarre avec le pouvoir du Cœur d'Aure-Hin déjà pris ou refusé, pour atteindre les quatre fins avec `chapitre=7` sans rejouer le choix du chapitre IV.
- `combat=gagne` (MAE-72) : dans chaque combat, l'ennemi tombe à 0 PV dès le début ; la suite se joue normalement (récompenses, choix face au Dragon, scènes, épilogues). Pour jouer les fins sans combattre, avec `chapitre=7`.
- Les paramètres se combinent ou s'utilisent seuls. Le titre de l'onglet commence alors par « [Test] ». Une valeur invalide est ignorée, avec un avertissement dans la console.
- En mode test, la sauvegarde du navigateur (MAE-11) n'est ni lue ni écrite, et « Continuer » est masqué. Pour tester la reprise, placer une sauvegarde (clé `ordre-dechu-save`) puis ouvrir le jeu sans paramètre.
- Tests automatisés dans un navigateur invisible (headless) : toujours lancé sans le son (`--mute-audio`), pour que le jeu ne s'entende pas pendant les tests (décision de Wesley du 02/11/2026).

Pas encore de lint ni de tests automatisés (MAE-23).
Le jeu ne s'ouvre pas en `file://` : toujours passer par `npm run dev` ou `npm run preview`.

## Environnements
- Local : `npm run dev`, puis `npm run preview` pour vérifier le build.
- Production : `https://wesley971.github.io/ordre-dechu/`, publié par `.github/workflows/deploy.yml` à chaque push sur `main` (source Pages : « GitHub Actions »).

## Convention de noms
- Fichiers en minuscules avec tirets (kebab-case), en anglais, sans accents ni espaces.
- Code regroupé par domaine sous `src/` : `battle/`, `story/`, `party/`, `data/`, `ui/`, `audio/`, `input/`, `styles/`, `dev/` (outils de test en local).
- Images dans `public/images/`, référencées en `images/...` dans le code et en `/images/...` dans le CSS.
- Musiques dans `public/audio/` (MP3 96 kbps stéréo), référencées en `audio/...` dans le code (`MUSIC`, `src/data/game-data.ts`).
- Identifiants en anglais ; textes affichés et commentaires en français.

## Modules
- Chaque fichier importe explicitement ce qu'il utilise, sans variable globale partagée.
- Aucun code exécuté au chargement d'un module ne doit appeler un autre module : les modules s'importent en boucle (combat, menu, affichage), et un tel appel tomberait sur une valeur pas encore initialisée. Le code de démarrage va dans `src/main.ts`.
- TypeScript strict : pas de `any`, pas de `!` (assertion non nulle), chaque `as` justifié en commentaire.

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
- Licence CraftPix §3.1 : aucun sprite CraftPix ne passe dans un outil d'IA, même comme référence, pour s'en inspirer ou pour une recoloration. Aucun sprite CraftPix n'entre dans le jeu (décision du 28/10/2026, MAE-26).

## Labo
- Le prototypage se fait hors du dépôt, dans `ProjetDEV/Projets/ordre-dechu-lab`.
