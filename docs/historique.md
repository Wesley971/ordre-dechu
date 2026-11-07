# Chronique de L'Ordre Déchu

Comment mon jeu est né, et ce qu'il est devenu. Première ligne de code le 12 avril 2025, dernière mise à jour de cette page le 7 novembre 2026.

Les captures viennent de l'historique Git : je suis revenu à chaque étape, j'ai lancé le jeu, j'ai pris la photo. Elles sont dans `docs/historique/`. Le jeu est jouable ici : https://wesley971.github.io/ordre-dechu/

Cette page ne dévoile ni les fins ni les secrets de l'univers. Les passages repliés (« Page scellée ») les donnent pour qui veut savoir.

---

## Les grands jalons

### 1. Un héros, un gobelin (12 avril 2025)
![Premier commit](historique/01-accueil.webp)

**Avant :** rien. **Après :** une page, un bouton « Attaquer » et un gobelin à 10 points de vie. Le premier commit plante dès le premier clic (une constante qu'on modifie), et je le corrige dans la foulée.
**Pourquoi :** je voulais comprendre comment un jeu tient debout. Mon héros était seul, et il ressemblait beaucoup à Geralt.

### 2. Tous les monstres, un seul héros (16 avril 2025)
![Ennemis en tableau](historique/02-combat.webp)

**Avant :** un seul ennemi, écrit en dur. **Après :** un tableau d'ennemis : gobelin, squelette, ogre, dragon, avec des points de vie de plus en plus hauts. Un bouton pour se soigner.
**Pourquoi :** un combat contre un seul monstre ne fait pas une aventure. Il fallait une suite.

### 3. Un héros et un ennemi à l'écran (20 avril 2025)
![Interface héros et ennemi](historique/03-combat.webp)

**Avant :** du texte qui défile. **Après :** le héros et l'ennemi apparaissent face à face.
**Pourquoi :** on comprend un combat quand on le voit.

### 4. Des polices et des animations (2 mai 2025)
![Polices et animations de combat](historique/04-combat.webp)

**Avant :** une page nue. **Après :** des polices choisies, des animations de coups, une image d'aperçu pour les réseaux sociaux.
**Pourquoi :** pour que ça ressemble à un jeu, pas à un exercice.

### 5. Un écran de départ et une fin (4 mai 2025)
![Écran de départ](historique/05-depart.webp)

**Avant :** on tombait directement dans le combat, sans fin possible. **Après :** un écran d'introduction, un début d'histoire, une fin de partie et un bouton pour rejouer.
**Pourquoi :** une histoire a un début et une fin.

### 6. De l'expérience et des niveaux (7 mai 2025)
![XP et niveau](historique/06-combat.webp)

**Avant :** le héros ne changeait jamais. **Après :** chaque victoire donne de l'XP, et le héros monte de niveau.
**Pourquoi :** donner envie de continuer. Dans les jours qui suivent, je range le code en plusieurs fichiers (`data.js`, `player.js`, `ui.js`).

### 7. Le Design System (3 juin 2026)
![Design System, écran de départ](historique/07-depart.webp)
![Design System, combat](historique/07-combat.webp)

**Avant :** une page qui marche, sans identité. **Après :** une identité visuelle : sombre, brune et dorée. Le code est aussi remis en ordre (état du jeu encapsulé, logique séparée de l'affichage, réglages centralisés), en cinq chantiers.
**Pourquoi :** un an plus tard, je reprends le projet avec une vraie méthode. Je voulais un univers qui se reconnaisse au premier coup d'œil.

### 8. Le journal de combat (4 juin 2026)
![Journal de combat](historique/08-combat.webp)

**Avant :** une seule ligne de texte à la fois. **Après :** un journal qui garde la trace de ce qui se passe, une machine à états pour le jeu, et des images 85 % plus légères. Je règle aussi des soucis d'affichage sur certains navigateurs en mode sombre.
**Pourquoi :** lisible, rapide, et pareil partout.

### 9. Le dernier état de l'ancien jeu (juin 2026)
![Dernier état de juin 2026](historique/09-combat.webp)

C'est l'ancien jeu à son meilleur : un héros seul, mais propre, rapide, soigné. C'est aussi là qu'il s'arrête.

### 10. Le vrai RPG (24 septembre 2026)
![Écran titre](historique/10-titre.webp)
![Dialogue](historique/10-dialogue.webp)
![Combat ATB à trois héros](historique/10-combat.webp)

**Avant :** un héros seul contre des monstres, au tour par tour. **Après :** trois héros, un combat en temps réel à la Final Fantasy (jauges ATB), une histoire réécrite autour de l'Ordre et des dragons, et un premier choix : épargner ou achever.
**Pourquoi :** c'est né chez ma sœur. J'ai demandé à une IA : « fais un vrai RPG pour voir ». Ce que j'ai vu m'a donné envie d'en faire un vrai.

### 11. Vite et TypeScript (26 octobre 2026)
![Écran titre](historique/11-titre.webp)
![Menu de combat](historique/11-menu.webp)
![Combat](historique/11-combat.webp)

**Avant :** des scripts chargés un par un, un projet qui s'appelle encore comme un exercice. **Après :** le projet s'appelle `ordre-dechu`, il est construit avec Vite, découpé en modules par domaine, et écrit en TypeScript strict, avec un contrôle des types à chaque mise en ligne.
**Pourquoi :** un jeu qui grossit doit pouvoir se modifier sans rien casser.

### 12. Des héros en pixel art, et Corvin (28 octobre 2026)
![Écran titre](historique/12-titre.webp)
![Dialogue](historique/12-dialogue.webp)
![Combat](historique/12-combat.webp)

**Avant :** des images de héros qui ne me ressemblaient pas. **Après :** trois héros recréés en pixel art. Lyra devient Corvin, un Veilleur à la lanterne.
**Pourquoi :** je voulais que les personnages soient à moi, pas des images trouvées.

### 13. Le Souffle, et les héros à gauche (28 octobre 2026)
![Écran titre](historique/13-titre.webp)
![Menu de combat](historique/13-menu.webp)
![Combat](historique/13-combat.webp)

**Avant :** de la magie, des PM, des potions. **Après :** le Souffle, l'énergie qui traverse tout. Les PM deviennent des PS, les potions des baumes. Les héros reviennent à gauche, face aux ennemis, comme dans ma toute première version. J'écris aussi la fiche de chaque personnage et sa palette de couleurs.
**Pourquoi :** une magie qui explique tout n'explique rien. Je voulais un monde avec ses propres règles.

### 14. Mes propres ennemis (2 novembre 2026)
![Écran titre](historique/14-titre.webp)
![Menu de combat](historique/14-menu.webp)
![Combat](historique/14-combat.webp)

**Avant :** des gobelins et des squelettes comme dans tous les jeux. **Après :** des peuples inventés, chacun avec sa fiche et ses raisons : les Sankri, les Hésiums, les Gau-Tik, les Painkush, et Vahn des Tyrdrak. De nouveaux chapitres, la trêve avec les Hésiums, l'écho doré de Maelor, un mode de test local pour avancer plus vite.
**Pourquoi :** aucun ennemi n'est méchant pour rien. Pas de grand méchant : chacun a ses raisons. J'ai écrit les fiches, une IA a dessiné à partir d'elles.

### 15. La bible, le Cœur d'Aure-Hin et les langues (3 novembre 2026)
![Écran titre](historique/15-titre.webp)
![Dialogue du chapitre IV](historique/15-dialogue.webp)
![Combat du chapitre IV](historique/15-combat.webp)

**Avant :** une histoire qui se contredisait parfois d'un chapitre à l'autre. **Après :** une bible de l'univers qui fait foi, un nouveau chapitre (le Cœur d'Aure-Hin) avec un choix qui change la suite, plusieurs fins, des noms de capacités tirés d'un lexique, et la prise en compte du mouvement réduit.
**Pourquoi :** une histoire tient quand on sait ce qui est vrai dans le monde. Les mots du monde sont fabriqués à partir du français, donc ils sonnent familiers et étrangers.

<details>
<summary>Page scellée : la méthode des mots</summary>

Les mots du monde sont des mots français à l'envers, mélangés à des mots qui existent. Quelques exemples :

- Rédror : « ordre » à l'envers.
- Tyr : « rite » à l'envers. Tyrdrak : les dragons du rite.
- Maelor : les lettres de « morale ».
- Sankri : « sans cri ».
- Hésium : de « magnésium », le minéral des os.
- Aure-Hin : d'« ordinaire ». Le lieu le plus puissant du monde porte un nom qui veut dire banal.
- Nios : « soin » à l'envers. Liéver : « réveil » à l'envers. Édrag : « garde » à l'envers.

Le lexique complet est dans `docs/lexique.md`.
</details>

<details>
<summary>Page scellée : les quatre fins</summary>

Tout se joue au Cœur d'Aure-Hin : prendre ou refuser le pouvoir. Puis, face à Vahn : épargner ou achever.

- La vraie fin : refuser le pouvoir, puis épargner.
- La fin rédemption : prendre le pouvoir, le rendre, puis épargner.
- La troisième fin : prendre le pouvoir et le garder.
- La fausse fin : achever Vahn.

Le détail est dans `docs/lore.md`.
</details>

---

## Tous les changements, jour par jour

Chaque fusion (PR) de `main` ajoute une ligne en bas de la période en cours. Les numéros renvoient aux pull requests.

### 2025, les débuts du héros seul
- 12 avril : premier commit (gobelin, bouton d'attaque). Correction du bug de constante. Séparation des dégâts du joueur et du gobelin.
- 16 avril : tableau d'ennemis (gobelin, squelette, ogre, dragon), passage au nouvel ennemi après chaque victoire, bouton de soin.
- 20 avril : calcul des dégâts simplifié, héros et ennemi affichés dans l'interface.
- 21 avril : ménage dans le code.
- 2 mai : polices, animations de combat, image d'aperçu pour les réseaux, l'ennemi contre-attaque après le soin, boutons désactivés en fin de partie.
- 3 mai : README, curseurs personnalisés.
- 4 mai : écran d'introduction, fin de partie, bouton Rejouer.
- 7 mai : XP et niveau.
- 10 mai : `data.js`, données des ennemis séparées.
- 11 mai : `player.js` et `ui.js`, interface centralisée.

### Juin 2026, la reprise
- 3 juin : état du jeu encapsulé, logique pure séparée de l'affichage, gestionnaires et réglages centralisés (chantiers 2 à 5), dégâts ennemis aléatoires, Design System intégré, contre-attaque extraite en fonction.
- 4 juin : images allégées de 85 %, journal de combat, corrections d'affichage pour les navigateurs en mode sombre, README mis à jour. Fusion de la PR #1.

### Septembre 2026
- 24 septembre : combat ATB à trois héros avec une interface sombre et dorée, histoire réécrite autour de l'Ordre et des dragons, choix épargner ou achever, fragments de mémoire dans le README. Fusion de la PR #2.

### Octobre 2026
- 11 octobre : les exécutables sont ignorés dans les images.
- 26 octobre : projet renommé `ordre-dechu` (#3), Vite et modules ES par domaine (#4), TypeScript strict avec contrôle des types avant chaque mise en ligne (#5).
- 27 octobre : crédits des ressources, premiers héros en pixel art.
- 28 octobre : sprites des héros (#6), le Souffle remplace la magie et Lyra devient Corvin (#8), les héros repassent à gauche (#9), palette des personnages (#10), fiches des ennemis (#11), rejet du dragon CraftPix dans la fiche de Vahn (#12), décisions sur les bases d'ennemis (#13).

### Novembre 2026
- 2 novembre : sprites des nouveaux ennemis (#14), chapitre de la Pierre Nue gardé par un Painkush (#15), mode de test local (#16), sprites qui ne sortent plus de la scène sur les fenêtres basses (#17), bible de l'univers (#18), décisions de l'univers (#19), cycle du Souffle (#20), trêve avec les Hésiums au chapitre II (#21), réécriture de l'histoire (#22), écho de Maelor (#23). Les objets réservés sont rendus à la fin d'un combat.
- 3 novembre : choix du pouvoir et fins multiples (#24), chapitre IV, le Cœur d'Aure-Hin (#25), noms des commandes et capacités tirés du lore (#26), lexique du monde (#27), prise en compte du mouvement réduit (#28), crédits de chaque asset et de leur usage commercial (#29), chronique du projet et captures (#30), chapitre V qui part du Cœur d'Aure-Hin et README remis à jour (#31), une musique par lieu (#32), chronique rattrapée (#33), lucioles et lumières féeriques du décor dans la bible (#34), sauvegarde de la partie dans le navigateur, avec « Continuer » à l'écran titre (#35), direction visuelle des décors dans la bible et images de décor Gemini autorisées (#36). L'écho de Maelor disparaît quand on le bat, l'aide de la capacité s'affiche pendant le choix de la cible, les récompenses à zéro sont masquées.
- 4 novembre : moteur de la scène peinte en 2,5D, pas encore branché sur le jeu, à voir en mode test avec `?scene=lisiere` (#37).
- 5 novembre : décor peint de la Lisière terminé, avec brume sur le relief, sprites qui restent sur le sol quand la caméra bouge et côtés sans doublon, toujours à voir en mode test (#38). Logique du jeu séparée de l'affichage derrière une interface unique, combat jouable sous Node sans navigateur, toile des héros déclarée une seule fois, rien ne change pour les joueurs (#39). Tests Vitest des dégâts, des critiques et de la jauge ATB, lancés par `npm test`, et README remis à jour (#40).
- 6 novembre : lint, types, tests, combats sans navigateur et build vérifiés à chaque pull request et avant chaque publication, Node 26 fixé dans `.nvmrc`, rien ne change pour les joueurs (#41). Vérification obligatoire avant toute fusion sur `main` (#43). Le chapitre I se joue dans la scène peinte en 2,5D, l'interface restant par-dessus, avec repli sur l'affichage DOM sans WebGL (#44).
- 7 novembre : nouvelle interface du combat d'après les maquettes : plaques d'ombre au lieu des fenêtres brunes, polices du jeu hébergées avec lui, marque ▼ au-dessus du héros qui joue, barre du boss, victoire et défaite dans une bande d'ombre en bas, téléphone en portrait avec le groupe en haut et le menu en bas, et zone de jeu 16:9 sur les écrans très larges (#45).

---

## Pour continuer cette page

À chaque fusion dans `main`, ajouter une ligne dans la période en cours de « Tous les changements ». À chaque grand tournant, ajouter un jalon (avant, après, pourquoi) avec sa capture dans `docs/historique/`.
