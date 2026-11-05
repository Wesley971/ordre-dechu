# Crédits

Chaque image, police, musique ou son du jeu est listé ici, avec son origine et ce qui autorise son usage, y compris commercial (diffusion payante sur itch.io ou Steam). Audit complet du 03/11/2026 (MAE-27) : chaque fichier de `public/` et chaque ressource chargée depuis Internet figure ci-dessous.

## Résumé

| Fichier ou ressource | Origine | Usage commercial |
|---|---|---|
| `public/images/maelor.png`, `corvin.png`, `elwen.png` | Générées avec Gemini (Google), puis retravaillées | Autorisé par les conditions de Google |
| `public/images/sankri.png`, `hesium.png`, `gautik.png`, `painkush.png`, `vahn.png` | Générées avec Gemini (Google), puis réduites | Autorisé par les conditions de Google |
| `public/images/maelor-echo.png` | Dérivée de `maelor.png` par un script | Comme `maelor.png` |
| `public/images/background.png`, `preview.png` | Générées avec ChatGPT (OpenAI) | Autorisé par les conditions d'OpenAI |
| `public/images/cursor.ico`, `cursor-hand.ico` | Générés avec ChatGPT (OpenAI) | Autorisé par les conditions d'OpenAI |
| `public/images/backdrops/lisiere/` (12 images) | Générée avec Gemini (Google), retravaillée ; côtés tirés de `background.png` (ChatGPT, OpenAI) | Autorisé par les conditions de Google et d'OpenAI |
| Three.js (bibliothèque, chargée pour la scène peinte) | Three.js authors | Autorisé par la licence MIT |
| `public/images/hand.svg`, `shield.svg` | Créés pour le jeu | Oui, propriété du projet |
| Polices Cinzel Decorative et DotGothic16 (Google Fonts) | Tiers | Autorisé par la SIL Open Font License 1.1 |
| `public/audio/*.mp3` (9 musiques) | Otto Halmén, HitCtrl, Matthew Pablo, Yubatake, Tausdei, Kevin MacLeod | Autorisé par les licences CC-BY 3.0 et CC BY 4.0 |
| Sons | Synthétisés par le code | Oui, propriété du projet |

## Images générées par IA

Ces images ne sont pas faites à la main : elles ont été générées par une IA, puis, pour certaines, retravaillées. Les conditions de Google et d'OpenAI interdisent de faire passer un contenu généré par IA pour un travail humain : d'où cette mention.

Les images générées par IA peuvent ne pas être protégées par le droit d'auteur. Le jeu n'en aurait alors pas l'exclusivité : d'autres pourraient obtenir ou réutiliser des images semblables. Ce point n'est pas tranché ici ; ce n'est pas un avis juridique.

### Conditions des outils

**Gemini (Google)** : Conditions d'utilisation de Google ([policies.google.com/terms](https://policies.google.com/terms), en vigueur le 30/07/2026, relues le 03/11/2026 ; première lecture le 27/10/2026) :
- Google ne revendique pas la propriété du contenu généré.
- Aucune restriction d'usage commercial n'y figure.
- Il est interdit de faire passer un contenu généré par IA pour un travail fait à la main.
- Il est interdit d'utiliser ce contenu pour développer ou entraîner une IA.

**ChatGPT (OpenAI)** : Conditions d'utilisation pour l'Europe ([openai.com/policies/eu-terms-of-use](https://openai.com/policies/eu-terms-of-use/), mises à jour le 16/01/2026, lues le 03/11/2026) :
- L'utilisateur possède les données de sortie ; OpenAI lui cède tous ses droits sur elles.
- L'usage commercial est prévu (annexe « Utilisation commerciale des Services »).
- Il est interdit de déclarer qu'une donnée de sortie a été générée par un humain.
- Les données de sortie peuvent ne pas être uniques : d'autres utilisateurs peuvent obtenir des images semblables.

### Héros

| Image | Personnage | Origine |
|---|---|---|
| `public/images/maelor.png` | Maelor | Référence `maelor-base-ia-v3.jpg` |
| `public/images/corvin.png` | Corvin | Corps : référence `corvin-base-ia-v3.jpg` ; tête : référence `corvin-base-ia-v1.jpg` |
| `public/images/elwen.png` | Elwen | Référence `elwen-base-ia-v3.jpg` |

**Images des héros générées avec Gemini (Google) puis retravaillées.** Les héros ont été générés avec Gemini, réduits en pixel art par un script, puis retouchés pixel par pixel sur mes choix.

- Les références sont de grandes images générées avec Gemini à partir des fiches des personnages. Elles sont gardées hors du dépôt, dans le labo du projet.
- Un script les a réduites en pixel art : 47 × 66 pixels, fond transparent, palette limitée, contour d'un pixel.
- Les retouches, choisies une à une, sont appliquées pixel par pixel par ce même script : yeux, peau, marque du front, pointes des cheveux, mains de Corvin.
- Corvin a la tête de sa première version, greffée sur le corps de la seconde.

### Ennemis

| Image | Personnage | Origine |
|---|---|---|
| `public/images/sankri.png` | Sankri | Référence `sankri-base-ia-v1.jpg` |
| `public/images/hesium.png` | Hésium | Référence `hesium-base-ia-v1.jpg` |
| `public/images/gautik.png` | Gau-Tik | Référence `gautik-base-ia-v1.jpg` |
| `public/images/painkush.png` | Painkush | Référence `painkush-base-ia-v1.jpg` |
| `public/images/vahn.png` | Vahn | Référence `vahn-base-ia-v1.jpg` |

**Images des ennemis générées avec Gemini (Google) puis réduites.** Les ennemis ont été générés avec Gemini à partir de leurs fiches (`docs/enemy-sheets.md`), puis réduits en pixel art par un script, comme les héros.

- Les références sont gardées hors du dépôt, dans le labo du projet ; elles ont été validées le 28/10/2026.
- Le script les a réduites en pixel art : fond transparent, palette limitée, contour d'un pixel, tournées vers la gauche. Seules la peau et les cheveux des Hésiums ont été ramenés vers la palette des personnages.
- Aucune retouche pixel par pixel : les sprites ont été validés tels quels le 02/11/2026.
- Aucun sprite CraftPix n'a été montré à l'IA.

### Écho de Maelor

| Image | Personnage | Origine |
|---|---|---|
| `public/images/maelor-echo.png` | Écho de Maelor | Dérivé de `public/images/maelor.png` |

**Écho de Maelor dérivé du sprite de Maelor, sans nouvelle génération.** Le sprite de Maelor du jeu a été mis en miroir et teinté d'or pâle par un script, à la même taille (MAE-70).

- Aucune nouvelle image n'a été générée : l'écho reprend l'origine du sprite de Maelor (voir Héros).
- Le script et la planche de validation sont gardés hors du dépôt, dans le labo du projet ; l'intensité de l'or a été choisie par Wesley le 02/11/2026.

### Fond et aperçu

| Image | Origine |
|---|---|
| `public/images/background.png` | Générée avec ChatGPT (OpenAI) |
| `public/images/preview.png` | Générée avec ChatGPT (OpenAI) ; image d'aperçu des réseaux sociaux (`og:image` dans `index.html`) |

D'après l'audit du 11/10/2026, ces images ont été générées environ un an plus tôt.

### Décor de la Lisière

Générée par Wesley avec Gemini (Google) le 03/11/2026, puis préparée par un script gardé hors du dépôt, dans le labo du projet (`tools/prepare-lisiere.mjs` et `tools/prepare-lisiere-2.mjs`), avec l'image d'origine.

| Image | Contenu | Origine |
|---|---|---|
| `public/images/backdrops/lisiere/wide.png` | La peinture et ses prolongements | Générée avec Gemini (Google) : couleurs et luminosité ramenées à celles de `background.png`, grain ajouté par le code. Prolongements repris de `background.png` (ChatGPT, OpenAI) |
| `foreground.png`, `glints.png` | Fougères qui se balancent, lucioles et fleurs qui luisent | Découpées dans la même image (Gemini) |
| `depth.png` | Carte de profondeur | Calculée par le script, d'après les troncs relevés à la main sur la peinture |
| `side-far-*.png`, `side-near-*.png`, `side-glints-*.png`, `corner-*.png` | Forêt des côtés des écrans larges, fougères des coins | Découpées dans `background.png` (ChatGPT, OpenAI) par un script : morceaux retournés, étirés ou assombris |

Conditions de Google et d'OpenAI : voir « Conditions des outils » plus haut.

### Curseurs

| Image | Usage | Origine |
|---|---|---|
| `public/images/cursor.ico` | Curseur par défaut | Généré avec ChatGPT (OpenAI) |
| `public/images/cursor-hand.ico` | Curseur sur ce qui se clique | Généré avec ChatGPT (OpenAI) |

Générés par Wesley avec ChatGPT en 2025, ajoutés au dépôt le 03/05/2025 (commit `cade374`) ; `cursor.ico` s'appelait alors `cursor-rpg.ico`.

## Créé pour le jeu

| Fichier | Usage | Origine |
|---|---|---|
| `public/images/hand.svg` | Main de sélection des menus et du ciblage | Dessinée pour le jeu |
| `public/images/shield.svg` | Bouclier de la Garde | Dessiné pour le jeu |

Ces deux images sont écrites à la main en SVG, pixel par pixel (un rectangle d'un pixel par point), dans les tons sombres et dorés de l'interface (`#1a0f06`, `#f1e4c3`, `#c9a84c`, `#8b6914`). Preuve : elles apparaissent dans le dépôt avec le commit `d43075b` du 24/09/2026 (« add ATB battle system with unified dark-gold UI », un seul curseur en forme de main), sans source externe.

## Polices

| Police | Usage | Source |
|---|---|---|
| [Cinzel Decorative](https://fonts.google.com/specimen/Cinzel+Decorative) | Logo | Google Fonts, SIL Open Font License 1.1 |
| [DotGothic16](https://fonts.google.com/specimen/DotGothic16) | Tout le reste | Google Fonts, SIL Open Font License 1.1 |

Licence confirmée par les fichiers `OFL.txt` du dépôt officiel `google/fonts` (`ofl/cinzeldecorative` et `ofl/dotgothic16`). La SIL Open Font License autorise l'usage commercial ; seule la vente de la police seule est interdite. Les polices sont chargées depuis Google Fonts (`src/styles/design-system.css`).

## Sons

Les bruitages sont synthétisés par le code (Web Audio API, `src/audio/sfx.ts`) : aucun fichier son.

## Musique

Musiques choisies par Wesley le 03/11/2026 (MAE-12). Licence de chaque piste relue sur sa page officielle le 03/11/2026, au moment du téléchargement. Les licences CC-BY 3.0 et CC BY 4.0 autorisent l'usage commercial, à condition de créditer l'auteur, de donner le lien de la licence et d'indiquer les changements.

| Fichier | Lieu | Titre | Auteur | Licence | Source |
|---|---|---|---|---|---|
| `public/audio/title-death-is-just-another-path.mp3` | Écran titre, prologue, épilogue | Death Is Just Another Path | Otto Halmén | [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [opengameart.org/content/death-is-just-another-path](https://opengameart.org/content/death-is-just-another-path) |
| `public/audio/ch1-the-secret-within-the-woods.mp3` | Chapitre I, La Lisière | RPG - The Secret Within the Woods | HitCtrl | [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [opengameart.org/content/rpg-the-secret-within-the-woods](https://opengameart.org/content/rpg-the-secret-within-the-woods) |
| `public/audio/ch2-past-the-edge.mp3` | Chapitre II, Le Champ des Échos | Past the Edge | Kevin MacLeod | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | [incompetech.com, ISRC USUAN1400026](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400026) |
| `public/audio/ch3-spiritwatcher.mp3` | Chapitre III, Le Pont de Pierre-Noire | Spiritwatcher | Matthew Pablo | [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) | [opengameart.org/content/spiritwatcher](https://opengameart.org/content/spiritwatcher) |
| `public/audio/ch4-elegy.mp3` | Chapitre IV, Le Cœur d'Aure-Hin, et combat contre l'écho | Elegy Dm | Yubatake | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [opengameart.org/content/elegy-dm](https://opengameart.org/content/elegy-dm) |
| `public/audio/ch5-just-dust-remains.mp3` | Chapitre V, La Pierre Nue | Just Dust Remains | Tausdei | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [opengameart.org/content/just-dust-remains](https://opengameart.org/content/just-dust-remains) |
| `public/audio/ch6-ossuary-5-rest.mp3` | Chapitre VI, Le Puits des Anciens | Ossuary 5 - Rest | Kevin MacLeod | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | [incompetech.com, ISRC USUAN1500047](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500047) |
| `public/audio/dragon-lost-time.mp3` | Chapitre VII, L'Antre du Dragon, et combat contre le Dragon | Lost Time | Kevin MacLeod | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | [incompetech.com, ISRC USUAN1500032](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500032) |
| `public/audio/battle-unholy-knight.mp3` | Combats ordinaires | Unholy Knight | Kevin MacLeod | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | [incompetech.com, ISRC USUAN1700052](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1700052) |

### Attributions

- « Death Is Just Another Path » par Otto Halmén, licence CC-BY 3.0, sur OpenGameArt.org.
- « RPG - The Secret Within the Woods » par HitCtrl, licence CC-BY 3.0, sur OpenGameArt.org.
- « Spiritwatcher » par Matthew Pablo (http://www.matthewpablo.com), licence CC-BY 3.0, sur OpenGameArt.org.
- « Elegy Dm » par Yubatake, sur OpenGameArt.org, licence CC-BY 4.0. Consigne de l'auteur : « Please just mention my username and this site. »
- « Just Dust Remains » par Tausdei, licence CC-BY 4.0, sur OpenGameArt.org.
- Kevin MacLeod, attribution exacte donnée sur la page de chaque piste :
  - "Past the Edge" Kevin MacLeod (incompetech.com)<br>Licensed under Creative Commons: By Attribution 4.0 License<br>http://creativecommons.org/licenses/by/4.0/
  - "Ossuary 5 - Rest" Kevin MacLeod (incompetech.com)<br>Licensed under Creative Commons: By Attribution 4.0 License<br>http://creativecommons.org/licenses/by/4.0/
  - "Lost Time" Kevin MacLeod (incompetech.com)<br>Licensed under Creative Commons: By Attribution 4.0 License<br>http://creativecommons.org/licenses/by/4.0/
  - "Unholy Knight" Kevin MacLeod (incompetech.com)<br>Licensed under Creative Commons: By Attribution 4.0 License<br>http://creativecommons.org/licenses/by/4.0/

### Changements apportés

- Toutes les pistes : converties en MP3 96 kbps stéréo 44,1 kHz avec ffmpeg, métadonnées et pochette retirées. Fichiers d'origine : MP3 (Death Is Just Another Path, Past the Edge, Spiritwatcher, Just Dust Remains, Ossuary 5 - Rest, Lost Time, Unholy Knight) ou OGG (RPG - The Secret Within the Woods ; Elegy Dm, rééchantillonné de 48 kHz à 44,1 kHz).
- Aucun montage : le jeu boucle chaque piste en relançant le morceau en fondu enchaîné peu avant sa fin, sans modifier le fichier.

## Bibliothèques

[Three.js](https://threejs.org/) (dépendance `three`), scène peinte en 2,5D : licence MIT, Copyright © 2010-2026 three.js authors. Elle autorise l'usage commercial à condition de garder sa mention de copyright : le build retire les commentaires du code, le texte complet est donc publié avec le jeu dans `public/licenses/three-license.txt`. Ce code n'est chargé que pour la scène (MAE-28).

[Vitest](https://vitest.dev/) 5.1.0 (dépendance de développement `vitest`), tests des règles du combat : licence MIT, vérifiée le 05/11/2026 sur le paquet installé. Il ajoute 20 paquets au dépôt, 19 sous licence MIT et `expect-type` sous licence Apache-2.0. Aucun de ces paquets n'est publié avec le jeu : ils ne servent qu'à lancer `npm test` (MAE-22).

## Modèles 3D

Aucun pour l'instant. Chacun sera crédité ici par le ticket qui l'ajoute, avec son auteur, son lien et sa licence. Règle du dépôt : licence autorisant l'usage commercial ; musique en CC0 ou CC-BY uniquement, aucune licence NC.
