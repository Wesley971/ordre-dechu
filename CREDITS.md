# Crédits

Chaque image, police ou son du jeu est listé ici, avec son origine.

## Images générées par IA

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

Conditions d'utilisation de Google ([policies.google.com/terms](https://policies.google.com/terms), lues le 27/10/2026) :
- Google ne revendique pas la propriété du contenu généré.
- Il est interdit de faire passer un contenu généré par IA pour un travail fait à la main : d'où cette mention.
- Il est interdit d'utiliser ce contenu pour entraîner une IA.

### Fond, ennemis et aperçu

| Image | Origine |
|---|---|
| `public/images/background.png` | Générée avec ChatGPT (OpenAI) |
| `public/images/goblin.png`, `skeleton.png`, `ogre.png`, `dragon.png` | Générées avec ChatGPT (OpenAI) |
| `public/images/preview.png` | Générée avec ChatGPT (OpenAI) |

D'après l'audit du 11/10/2026, ces images ont été générées environ un an plus tôt. Les ennemis et le dragon seront remplacés (MAE-26).

## À compléter

| Fichier | Origine |
|---|---|
| `public/images/cursor.ico`, `cursor-hand.ico` | À compléter |
| `public/images/hand.svg` | À compléter |
| `public/images/shield.svg` | À compléter |

## Polices

| Police | Usage | Source |
|---|---|---|
| [Cinzel Decorative](https://fonts.google.com/specimen/Cinzel+Decorative) | Logo | Google Fonts, SIL Open Font License 1.1 |
| [DotGothic16](https://fonts.google.com/specimen/DotGothic16) | Tout le reste | Google Fonts, SIL Open Font License 1.1 |

Licence confirmée par les fichiers `OFL.txt` du dépôt officiel `google/fonts` (`ofl/cinzeldecorative` et `ofl/dotgothic16`).

## Sons

Les bruitages sont synthétisés par le code (Web Audio API, `src/audio/sfx.ts`) : aucun fichier son.
