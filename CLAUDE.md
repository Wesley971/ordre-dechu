# L'Ordre Déchu : règles du dépôt

RPG au tour par tour (combat ATB) en JavaScript, modules ES, build Vite, publié sur GitHub Pages.

## Suivi
- Tickets dans YouTrack, projet **MAE**.
- Parcours d'un ticket : /task-flow au début, /lead-review puis /git-commit avant chaque commit.
- Statuts : Ouvert → En cours → à vérifier (`To Verify`) → Terminé.
- Terminé seulement quand le code est sur `main`, le déploiement GitHub Pages réussi et la vérification sur le site en ligne faite.

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

Pas encore de lint ni de tests automatisés (MAE-23).
Le jeu ne s'ouvre pas en `file://` : toujours passer par `npm run dev` ou `npm run preview`.

## Environnements
- Local : `npm run dev`, puis `npm run preview` pour vérifier le build.
- Production : `https://wesley971.github.io/ordre-dechu/`, publié par `.github/workflows/deploy.yml` à chaque push sur `main` (source Pages : « GitHub Actions »).

## Convention de noms
- Fichiers en minuscules avec tirets (kebab-case), en anglais, sans accents ni espaces.
- Code regroupé par domaine sous `src/` : `battle/`, `story/`, `party/`, `data/`, `ui/`, `audio/`, `input/`, `styles/`.
- Images dans `public/images/`, référencées en `images/...` dans le JS et en `/images/...` dans le CSS.
- Identifiants en anglais ; textes affichés et commentaires en français.

## Modules
- Chaque fichier importe explicitement ce qu'il utilise, sans variable globale partagée.
- Aucun code exécuté au chargement d'un module ne doit appeler un autre module : les modules s'importent en boucle (combat, menu, affichage), et un tel appel tomberait sur une valeur pas encore initialisée. Le code de démarrage va dans `src/main.js`.

## Interface et design
- Tout écran ou élément d'interface se code d'après une maquette validée dans le ticket de design correspondant (epic MAE-15).

## Assets
- Tout asset (image, sprite, police, son, musique) doit avoir une licence autorisant l'usage commercial. Musique en CC0 ou CC-BY ; aucune licence NC.
- Chaque asset est crédité dans `CREDITS.md`.

## Labo
- Le prototypage se fait hors du dépôt, dans `ProjetDEV/Projets/ordre-dechu-lab`.
