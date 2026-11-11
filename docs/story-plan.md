# L'Ordre Déchu · Plan du récit

Comment l'histoire arrive au joueur : ce qu'il apprend, à quel moment, par quel moyen, et ce qui reste caché. Étude MAE-103, direction validée par Wesley le 11/11/2026.

- La bible (`docs/lore.md`) dit ce qui est vrai dans ce monde. Ce plan dit dans quel ordre et par quels moyens le joueur le découvre. En cas de désaccord, la bible l'emporte.
- Ce document dévoile tout, comme la bible : les secrets et les quatre fins. La chronique publique (`docs/historique.md`) n'en reprend rien.
- Les citations du jeu viennent de `src/data/game-data.ts` et, pour l'écran des récompenses, de `src/story/game-flow.ts`, tels qu'ils étaient le 11/11/2026.
- Les fiches des personnages citées ici sont tenues hors du dépôt, dans le projet claude.ai « RPG » (`fiches-personnages.md`, MAE-55) ; une copie est dans le labo, `ordre-dechu-lab/references/fiches-personnages.md`.
- Ce plan n'écrit aucun texte final. Le détail de chaque scène (répliques, nombre de pages) se relit avec Wesley au moment de réécrire le chapitre.

Deux repères reviennent dans tout le document :

- **Statut.** Trois niveaux, d'après MAE-103 :
  - « Validé » : dans la liste des points retenus par Wesley le 11/11/2026, ou tranché ensuite par lui (ses décisions du même jour sur les points « À valider ») ;
  - « Sommaire » : dans le sommaire que Wesley a validé le 11/11/2026 comme direction, sans être dans cette liste ; le détail reste à relire ;
  - « À valider » : proposition de Claude, pas encore tranchée.
- **Horizon.** « Aujourd'hui » : faisable avec l'enchaînement actuel des chapitres (pages, choix, haltes). « Avec l'exploration » : attend les dioramas à parcourir (MAE-13).

## 1. Ce qui ne bouge pas

Décision de Wesley du 11/11/2026 :

- les sept lieux, dans leur ordre : la Lisière, le Champ des Échos, le Pont de Pierre-Noire, le Cœur d'Aure-Hin, la Pierre Nue, le Puits des Anciens, l'Antre du Dragon ;
- les quatre fins et leurs chemins (`docs/lore.md`, « Les fins ») ;
- la révélation au Cœur d'Aure-Hin, dans son ordre : une révélation, une épreuve, un choix.

Tout le reste est ouvert. Chaque changement de la bible est une proposition, que Wesley valide.

## 2. Le constat

### 2.1 Ce que le jeu raconte aujourd'hui

| Étape | Pages | Ce que le joueur apprend | Moyen |
|---|---|---|---|
| Prologue | 6 | Le monde se bat sans savoir pourquoi. Le Souffle. L'Ordre exécuté sans procès il y a trente ans. Le blason, le grand-père chevalier, les cheveux de cendre et l'affinité de Maelor. Tout le passé de Corvin. Le temple d'Elwen. | Narrateur |
| I · La Lisière | 1 | Les Sankri défendent la forêt. | Une réplique de Corvin, puis le combat |
| II · Le Champ des Échos | 4, puis 4 après la trêve | Les Hésiums ne sont pas des monstres. Un Tyrdrak est tombé avec les chevaliers de l'Ordre. Quelque chose, en Maelor, réveille les os. | Dialogue, premier fragment, trêve |
| III · Le Pont de Pierre-Noire | 1, puis 1 | Les Gau-Tik gardent ce qui est de l'autre côté, et attendaient quelqu'un. | Dialogue, combat, reddition |
| IV · Le Cœur d'Aure-Hin | 7, puis 2, puis le choix | Elwen est une immortelle. Maelor a le sang doré d'un peuple oublié. Le Souffle respire. Le pouvoir est offert. | Monologue d'Elwen, combat contre l'écho, choix |
| V · La Pierre Nue | 2 | Les Painkush gardent leur terre. | Dialogue, combat |
| VI · Le Puits des Anciens | 4 | L'Ordre marchait avec les Tyrdrak. | Repos, deuxième fragment |
| VII · L'Antre du Dragon | 3 | Le Dragon avait un ami dans l'Ordre. Il n'est pas fou. | Troisième fragment, combat, choix |
| Fins | selon le chemin | Le nom de l'Ordre, celui de Vahn, le cycle du Souffle (vraie fin). | Scène, fragment, épilogue |

Entre deux chapitres, il n'y a rien : la dernière page d'un chapitre mène au titre du suivant. Les chapitres I, III et V tiennent en une ou deux pages avant le combat. Le seul repos est le Puits (VI).

### 2.2 Ce qui marche, à garder

- **Le nom sur le blason**, de plus en plus lisible d'un fragment à l'autre (« R····r D······s » au chapitre II), et entier seulement si le Dragon est épargné.
- **Le chapitre II** : la rumeur, le fragment, le combat qui s'arrête, l'alliance. C'est le modèle du reste.
- **Les regards qui en disent plus que les mots** : « Elwen détourne les yeux, sans un mot. » (II), le Gau-Tik dont le regard s'arrête sur les cheveux de Maelor (III).
- **L'écho de Maelor** : « Ce n'est pas un ennemi, Maelor. C'est un choix qui a pris corps. »
- **Les conseils de combat portés par les personnages** : la foudre contre les Gau-Tik, « Ni feu ni foudre n'y feront rien. Il faudra tenir. » devant le Painkush, la glace contre le Dragon.
- **Le sang doré** (MAE-98) : un indice que personne ne commente. Il doit le rester.
- **Les quatre fins**, et le blason froid des deux fins où le Dragon meurt.

### 2.3 Manques et maladresses

#### Dit trop tôt

- **L'héritage de Maelor.** Le prologue donne le grand-père chevalier, les cheveux de cendre et l'affinité pour les dragons, « un don qu'il croit tenu du hasard, comme d'autres naissent gauchers ». Le narrateur annonce ainsi que ce n'est pas un hasard, trois chapitres avant la révélation du Cœur (« Mon affinité avec les dragons... ce n'était pas un hasard. »).
- **Le passé de Corvin.** Toute l'histoire de son maître est racontée par le narrateur à la cinquième page du prologue, avant que le joueur ait vu Corvin. Elle n'est plus jamais évoquée dans le jeu.
- **L'histoire d'Elwen.** Le temple qui l'a chassée est raconté de la même façon, à la sixième page.

#### Dit trop tard

- **Le but du voyage.** La bible dit qu'une rumeur du village parle d'une bête folle, et que Maelor part pour comprendre. Le prologue donne la destination et le motif : « Personne n'a appelé Maelor dans le Val Ténébreux. », il y cherche un sens. Il ne dit rien de la bête. Elle apparaît pour la première fois au chapitre IV, au détour d'une réplique de Corvin (« Même la bête du Val. »). Pendant trois chapitres, le joueur ne sait pas ce qui attend le groupe au bout du Val.
- **Le village.** Il n'existe que par ouï-dire : « Au village, on dit que les squelettes déterrent les morts pour les manger. » (II), « Au village, on la dit folle. » (VII), puis les cloches de deux fins.

#### Dit trop explicitement

- **Le Cœur d'Aure-Hin.** Trois révélations se suivent (la nature d'Elwen, le sang de Maelor, le Souffle qui respire), toutes par Elwen, en quatre pages. Avant ce chapitre, personne n'a demandé qui est Elwen ni ce qu'est Maelor. La seule question qui y touche, celle de Maelor au pont (« Pourquoi nous laissent-ils passer ? »), est refermée d'une phrase. La réponse arrive sans que le joueur l'ait attendue.
- **Le fragment de l'antre.** Le souvenir tire lui-même la conclusion : « Depuis, le Tyrdrak croit tous les hommes hostiles, et les hommes le croient fou. » puis « Il attend quelqu'un qui l'aide à se souvenir. » Un souvenir ne peut pas savoir ce qui s'est passé depuis. Et ces deux phrases donnent au joueur la réponse du choix final avant qu'il combatte.
- **Les Sankri.** Corvin explique tout avant que le joueur ait rien vu : « Des Sankri. Ils ne prennent que le Souffle des arbres mourants, et ils défendent les vivants. »

#### Jamais dit, ou jamais montré

- **La rencontre des trois.** La fiche de Corvin dit qu'il est rencontré en route, celle d'Elwen qu'elle cherchait Maelor et savait qui il était. Le jeu commence avec le groupe déjà formé. La réplique d'Elwen au Cœur, « Je cherchais l'un des tiens depuis longtemps. », ne s'appuie donc sur aucune scène.
- **Les Sankri qui redeviennent arbres** à leur mort (bible).
- **Les mues des Tyrdrak**, qui servaient à forger les armes et les armures de l'Ordre (bible).
- **Les autres immortels**, nombreux, discrets et moins investis qu'Elwen (bible).
- **La faille d'Elwen** : elle plie la règle de non-intervention. Le jeu n'en garde qu'une phrase, « Je ne devrais pas vous le dire. »
- **La colère de Maelor.** Le prologue l'annonce (« Sa colère n'a pas de visage. Elle vise l'indifférence. »), aucune scène ne la joue.
- **L'alliance des Hésiums.** « Les Hésiums sont désormais vos alliés. », puis plus rien.
- **La marque de Corvin** (la feuille de lumière sur son front) : aucun texte du jeu n'en parle. La bible la laisse ouverte, ce qui n'empêche pas de la montrer.
- **Les Couronnes.** Le groupe en gagne 420 avant le Dragon (50 à la Lisière, 80 au Champ des Échos, 180 au pont, 110 à la Pierre Nue, d'après `ENEMIES`). Rien ne permet de les dépenser.

#### Ce qui contredit le thème ou le monde

- **Les morts sans poids.** Le thème du jeu est qu'il n'y a pas de grand méchant et que chaque peuple a ses raisons. Elwen le dit devant le Painkush : « Ce n'est pas une bête. Il garde sa terre, comme nous garderions la nôtre. » Puis le Painkush meurt, comme les Sankri, sans une ligne après le combat. Le choix final (épargner ou achever) n'est préparé par rien de ce que le groupe a fait avant.
- **Le butin.** Après la trêve du chapitre II et la reddition du chapitre III, l'écran des récompenses dit « Le groupe ramasse » des Couronnes (`formatRewards`, `src/story/game-flow.ts`) : sur des alliés, puis sur des gardiens à genoux. Les Sankri, des bêtes, portent 25 Couronnes chacun, alors que la réécriture du chapitre I leur a retiré leur bourse (`docs/lore.md`, « Textes du jeu : état »).
- **Le repli.** Aux chapitres III et V, le repli reste permis (`canRun`). S'il réussit, le groupe passe quand même au chapitre suivant : il traverse le pont que deux Gau-Tik barraient, sans la scène de la reddition et sans le regard sur les cheveux de Maelor.
- **Trente ans.** La vraie fin dit : « Vahn quitte son antre pour la première fois depuis trente ans. » La fausse fin dit : « Pour la première fois depuis trente ans, le ciel du Val Ténébreux est vide. » La première phrase suppose un Dragon qui n'est jamais sorti, la seconde un Dragon qu'on voyait dans le ciel. La bible parle d'une bête qui « ravage le Val » : selon la rumeur seulement, ou en vrai ? Tranché par Wesley le 11/11/2026 : le Dragon n'est jamais sorti (voir 5.10).

## 3. Les principes

1. **Une question, un indice, puis la réponse.** Chaque révélation est précédée d'une chose vue qui intrigue, puis d'une chose qui confirme. La réponse arrive quand le joueur la cherche déjà.
2. **Montrer avant de dire.** Ce qui peut se jouer dans une scène n'est pas raconté par le narrateur. Le passé d'un personnage est dit par lui, à quelqu'un, pour une raison.
3. **Le narrateur ne sait rien de plus que le groupe.** Il décrit ce qu'on voit. Un fragment de mémoire montre un moment, sans le commenter.
4. **Chaque chapitre respire.** Il suit quatre temps : l'arrivée, le combat, la suite du combat, la halte. Aucun combat ne s'enchaîne sur le titre du chapitre suivant.
5. **Chaque combat finit à sa façon**, et cette suite prépare le choix final :

| Chapitre | Fin du combat | Statut |
|---|---|---|
| I · Lisière | Les Sankri meurent et redeviennent arbres. C'est la seule mise à mort du voyage. | Sommaire |
| II · Champ des Échos | Trêve et alliance. | Dans le jeu |
| III · Pont | Reddition : les Gau-Tik s'écartent. | Dans le jeu |
| IV · Cœur | L'écho se défait en lumière. | Dans le jeu |
| V · Pierre Nue | Le Painkush reconnaît l'armure de Maelor et laisse passer. | Validé |
| VII · Antre | Le joueur décide. | Dans le jeu |

Le groupe tue une fois, au début, sans savoir. Tout le reste du voyage lui apprend qu'il y avait autre chose à faire. Devant le Dragon, le joueur a déjà vu les deux issues.

6. **Le chemin obligatoire suffit.** Tout ce qu'il faut pour comprendre les fins se trouve dans les scènes que tout joueur voit. Les conversations au choix approfondissent, elles ne portent aucune révélation clé.
7. **Les éclats du sang doré ne sont jamais commentés**, par personne, à aucun moment (règle de MAE-98, `CLAUDE.md`). Au Cœur, Elwen dit que le sang de Maelor est doré, comme aujourd'hui ; aucun texte ne relie cette phrase aux éclats du combat. Le joueur fait le lien seul.

## 4. Les outils du récit

| Outil | État | Usage |
|---|---|---|
| Pages de dialogue | Dans le jeu | Arrivée dans un lieu, suite d'un combat |
| Fragments de mémoire | Dans le jeu (II, VI, VII, fins) | L'histoire de l'Ordre, par le blason |
| Choix | Dans le jeu (IV, VII) | Le pouvoir, le sort du Dragon ; demain, le menu des haltes |
| Indices visuels | Dans le jeu (sang doré, couleurs vives d'Elwen, yeux du Dragon) | Ce qu'on voit sans qu'on l'explique |
| Fin de combat sans mort | Dans le jeu (trêve, reddition) | Chapitres II, III, et V demain |
| Halte | À créer. Validé | La respiration entre deux combats |
| Marchand | À créer (MAE-9). Validé pour la v1 | L'usage des Couronnes |
| Exploration | À créer (MAE-13) | Parcourir chaque lieu |

### La halte

Les haltes sont validées par Wesley (11/11/2026). Leur menu est celui du sommaire ; la scène obligatoire d'arrivée est une précision de Claude, à valider. Une halte est un arrêt du groupe entre deux combats. Elle a trois temps :

1. **Une scène obligatoire**, courte, qui se joue à l'arrivée. Elle porte ce que tout joueur doit savoir.
2. **Un menu**, où le joueur choisit dans l'ordre qu'il veut : parler à un compagnon, parler à quelqu'un du lieu, voir le marchand s'il y en a un, reprendre la route. Les conversations sont au choix.
3. **Le départ**, quand le joueur le décide.

- **Aujourd'hui** : la halte se fait avec les pages et les choix qui existent. Le Puits des Anciens en est déjà une, sans menu. Il lui manque l'écran du marchand.
- **Avec l'exploration** : la halte devient un coin du diorama. Le joueur marche vers le feu, vers le marchand, vers celui à qui il veut parler.
- **À décider avec l'équilibrage (MAE-39)** : ce qu'une halte rend en PV et en PS. Aujourd'hui, seul le Puits restaure le groupe.

## 5. Le voyage, étape par étape

### 5.1 Prologue

Statut : sommaire.

**Rôle.** Poser le monde en moins de trente secondes, et laisser les personnages au jeu (MAE-37).

**Ce que le joueur apprend.** Ce monde se bat et oublie. Il y a trente ans, un ordre de chevaliers a été accusé de sorcellerie et exécuté sans procès ; on ne l'appelle plus que « l'Ordre Déchu ». Maelor porte un blason de cet ordre, qui lui vient de son grand-père, et ce blason s'est éveillé.

**Ce qui reste caché.** Tout le reste.

**Où va ce qui sort du prologue.**

| Contenu actuel | Nouvelle place |
|---|---|
| Le Souffle, en une phrase | Reste au prologue (critère de MAE-37) |
| Le grand-père, chevalier survivant | Reste, en une phrase |
| Les cheveux de cendre, l'affinité pour les dragons | Retirés du texte. Les cheveux se voient ; l'affinité se montre au Puits et dans l'antre |
| « Personne ne m'a choisi. J'ai choisi de venir. » | Le village, quand Maelor prend la route |
| La colère de Maelor contre l'indifférence | Le Puits, devant l'immortel |
| Corvin, « veilleur au regard de nuit » | Le village |
| Le maître de Corvin | Le feu des Hésiums, raconté par Corvin |
| La lanterne du maître | Le village (on la voit), puis le feu des Hésiums |
| Le temple d'Elwen | Le village, montré : elle soigne celui qu'on a laissé |
| « Elwen croit que chaque vie peut être sauvée. » | La Lisière, après le combat, par ses actes |

**Horizon.** Aujourd'hui.

### 5.2 Le village

Validé par Wesley le 11/11/2026 : le village devient un vrai lieu, avec sa peinture, et la rencontre des trois s'y joue. Il se place avant le chapitre I et ne change pas la numérotation des sept lieux.

**Rôle.** Donner au voyage son but, former le groupe sous les yeux du joueur, et montrer ceux qui jugent sans savoir.

**Ce que le joueur apprend.**
- Le but : une bête, dans le Val, dont tout le village parle et que personne ne peut dire avoir vue.
- Pourquoi chacun part. Maelor veut comprendre, et son blason se réchauffe du côté du Val. Corvin cherche pourquoi le Souffle faiblit. Elwen décide de les suivre, sans dire pourquoi.
- Comment le monde regarde ces trois-là : on évite le Veilleur et sa lanterne, on se détourne des couleurs d'Elwen.

**Par quel moyen.**
- Maelor arrive seul. Le narrateur montre le village, sa cloche, sa peur.
- Corvin est déjà là, étranger lui aussi. Il interroge les gens sur ce qu'ils oublient ; on lui répond à peine. C'est lui qui remarque le blason.
- Elwen soigne, à l'écart, un homme que le village a laissé à sa porte. C'est l'histoire de son temple, jouée au lieu d'être racontée.
- Elle regarde les cheveux de Maelor un instant de trop. C'est le premier d'une série : le Gau-Tik fera le même geste au chapitre III.
- Le marchand du village, un humain, n'existe que par la bande de dialogue (validé). C'est le premier point de vente.

**Ce qui reste caché.** Ce qu'est Elwen. Ce qu'est Maelor. Le passé de Corvin : le mot « sorcellerie », murmuré sur son passage, le fige, et rien ne dit pourquoi.

**Déroulé.** Une scène d'arrivée, puis une halte (parler à Corvin, parler à Elwen, voir le marchand, prendre la route). Pas de combat.

**Point de vigilance.** Le village s'ajoute avant le premier combat. La scène obligatoire doit rester courte : le joueur doit se battre dans les cinq premières minutes.

**Horizon.**
- Aujourd'hui : la scène, la halte, le marchand.
- Avec l'exploration : parcourir la place, aller vers chacun.

**À valider.**
- Le nom du village. Les noms que les humains donnent aux lieux sont en français simple (la Lisière, la Pierre Nue, le Puits des Anciens). Pistes : « le Seuil », « les Trois-Cloches ». Le nom entre d'abord dans `docs/lexique.md`.
- Le village est le dernier avant le Val, et Maelor n'en est pas : il y arrive en étranger, comme les deux autres. La bible dit seulement « une rumeur au village ».
- La fiche de Corvin dit « rencontré en route » : elle devient « rencontré au village ».

### 5.3 Chapitre I · La Lisière

Statut : sommaire.

**Rôle.** Le premier combat, et la seule mise à mort du voyage.

**Ce que le joueur apprend.** Ce qui attaque le groupe ne lui veut rien : il défend sa forêt. Et se battre a un prix.

**Par quel moyen.**
- L'arrivée garde l'échange qui existe : « Nous ne faisons que passer. » « Ils ne le savent pas. »
- Corvin en dit moins avant le combat. Ce qu'il sait des Sankri (ils ne prennent que le Souffle des arbres mourants) vient après, quand c'est trop tard pour s'en servir.
- La suite du combat est nouvelle : les Sankri tombés prennent racine et redeviennent arbres (bible). Personne ne commente. Elwen reste auprès d'eux un instant.
- Premier indice visuel : quand Maelor ou Elwen est touché, quelques éclats d'or. Personne n'en parle.

**Ce qui reste caché.** Tout. Le chapitre pose une faute, pas une information.

**Déroulé.** Arrivée, combat, suite. Pas de halte : le groupe marche vers le Champ des Échos.

**Horizon.**
- Aujourd'hui : la page de suite, jouée après une victoire (le jeu sait déjà jouer des pages après un combat gagné). Si le groupe se replie, les Sankri vivent et la page ne se joue pas.
- Avec l'exploration : des Sankri qu'on peut contourner (MAE-35). Après la première mort, éviter un combat prend un sens. Comment finissent ces rencontres, sans défaire le principe d'une seule mise à mort, reste à décider dans MAE-35.

**Validé par Wesley le 11/11/2026.** Les Sankri laissent de la Sève au lieu de Couronnes (voir 8). Détail à relire : le groupe la prend sur les arbres qu'ils sont redevenus.

### 5.4 Chapitre II · Le Champ des Échos

Statut : la halte au feu et le colporteur sont validés ; le récit de Corvin au feu vient du sommaire.

**Rôle.** Le premier fragment, la première trêve, et la première vraie halte.

**Ce que le joueur apprend.**
- L'Ordre n'était pas ce qu'on en dit : ses chevaliers ont été mis à genoux, les mains liées, et derrière eux gisait un Tyrdrak, une aile encore ouverte au-dessus d'eux.
- Les Hésiums ne sont pas des « squelettes » : ils ont gardé ces morts-là quand personne n'est venu.
- Quelque chose, en Maelor, réveille les os : « Celui-ci se souvient de quelque chose, en toi. »
- Le passé de Corvin, par lui-même.

**Par quel moyen.**
- Le chapitre reste tel qu'il est jusqu'à la trêve. Deux indices y sont déjà : « Quand Maelor et Elwen s'en approchent, le sol s'éclaire. » et « Elwen détourne les yeux, sans un mot. »
- La phrase « Ce soir-là, le groupe partage le feu des Hésiums, et personne ne juge personne. » devient une halte jouée : le feu des Hésiums.
- Scène obligatoire de la halte : Corvin raconte son maître. Il vient de répéter une rumeur du village sur les Hésiums ; c'est une rumeur de ce genre qui a brûlé son maître, et il le comprend devant eux. Le contenu est celui du prologue actuel, dans sa voix.
- Le colporteur hésium entre ici (voir 7).

**Ce qui reste caché.** Pourquoi Elwen a détourné les yeux. Ce que les os reconnaissent en Maelor. Pourquoi les autres Tyrdrak ne sont pas venus (« Les autres Tyrdrak ne viendront pas. Plus maintenant. »).

**Déroulé.** Arrivée, fragment, combat, trêve, halte au feu : parler à Elwen, parler à l'ancien des Hésiums, voir le colporteur, reprendre la route.

**Horizon.**
- Aujourd'hui : la halte et le colporteur.
- Avec l'exploration : le tertre comme lieu du fragment (MAE-36), le feu comme coin du diorama.

### 5.5 Chapitre III · Le Pont de Pierre-Noire

Statut : sommaire.

**Rôle.** Poser la question à laquelle le Cœur répondra.

**Ce que le joueur apprend.** Quelqu'un garde ce qui se trouve après le pont. Ces gardiens attendaient Maelor. Et Elwen le savait : « Ils gardent ce qui se trouve de l'autre côté. »

**Par quel moyen.**
- L'arrivée et la reddition restent : le regard sur les cheveux, puis « Parce qu'ils ont vu ce qu'ils attendaient. »
- Les Gau-Tik ne parlent pas. Leur silence fait partie d'eux.
- Halte courte, nouvelle, sur l'autre rive, sans marchand. Corvin demande à Elwen comment elle savait. Elle ne répond pas encore. Le joueur entre au chapitre IV avec cette question.

**Ce qui reste caché.** Ce que les Gau-Tik ont vu. Ce qu'ils gardent. La Pierre-Noire reste seulement suggérée (« lisse et tiède, sans un joint »).

**Déroulé.** Arrivée, combat, reddition, halte courte.

**Horizon.**
- Aujourd'hui : la halte. Le repli devient impossible sur ce chapitre, comme au II et au IV.
- Avec l'exploration : les chaînes arrachées et l'autre rive à parcourir, une rencontre évitable (MAE-38, MAE-35).

### 5.6 Chapitre IV · Le Cœur d'Aure-Hin

Statut : sommaire.

**Rôle.** La révélation, l'épreuve, le choix. Leur ordre ne bouge pas.

**Ce que le joueur apprend.** Elwen est née du Souffle. Maelor descend d'un peuple à longue vie que le monde a oublié. Le Souffle respire : le monde oublie parce qu'il se retire.

**Par quel moyen.**
- La révélation est resserrée. Elwen répond à la question que Corvin a posée sur l'autre rive, au lieu d'exposer.
- Chaque réponse s'accroche à une chose que les personnages ont vue : le sol du Champ des Échos qui s'éclaire, le regard des Gau-Tik, la lumière du Cœur qui cherche Maelor.
- Les deux répliques qui portent la scène restent : « Qu'est-ce qui m'arrive ? » « Rien qui ne soit déjà en toi. »
- L'écho, le combat et le choix ne changent pas.
- Halte courte, nouvelle, après le choix, sans marchand. Les deux compagnons réagissent à ce que Maelor a fait : ce qu'ils disent dépend du pouvoir pris ou refusé.

**Ce qui reste caché.** Le reste du cycle : « Le reste, je n'ai pas le droit de le dire. » Le lien entre Elwen et le Dragon. Ce qui a rompu l'alliance des hommes et des Tyrdrak.

**Déroulé.** Arrivée, révélation, combat, choix, halte courte.

**Horizon.** Aujourd'hui. Le jeu sait déjà changer un texte selon le pouvoir (la question posée devant le Dragon).

**Validé par Wesley le 11/11/2026.** Au Cœur, la marque de lumière sur le front de Corvin s'éclaire elle aussi, et personne ne le relève : un indice discret, sans réponse, sur son mystère. La bible laisse cette marque ouverte, et la scène ne tranche rien.

### 5.7 Chapitre V · La Pierre Nue

Validé par Wesley le 11/11/2026 : les Painkush forgeaient pour l'Ordre ; le Painkush reconnaît l'armure de Maelor et ne meurt plus.

**Rôle.** Rendre à Maelor la part de l'Ordre dans son héritage, et finir un combat par le respect.

**Ce que le joueur apprend.**
- L'armure de Maelor est une vraie armure de l'Ordre.
- Elle a été forgée ici, par les Painkush, dans les mues des Tyrdrak. L'Ordre n'avait pas que les Tyrdrak pour alliés.
- La première trace des Tyrdrak que Maelor peut toucher est sur lui : son armure, faite de leurs mues (validé par Wesley le 11/11/2026). Le Dragon n'est jamais sorti de son antre : il n'y a aucune écaille en chemin.

**Par quel moyen.**
- L'arrivée reste : les murs « trop droits pour être l'œuvre du hasard », et « On dit qu'ils forgent un métal que rien ne raye. »
- Le combat est une épreuve, comme Corvin l'annonce : « Il faudra tenir. »
- La suite est nouvelle. Le Painkush cesse le combat. Il regarde l'armure, pas l'homme. Il parle peu, et il dit « Tyrdrak », comme l'ancien des Hésiums au chapitre II : ceux qui ont connu l'Ordre parlent comme lui, quand les humains disent « dragon ».
- Il ouvre le passage. La cité reste fermée.

**Ce qui reste caché.** Pourquoi l'Ordre est tombé. Ce que les Painkush en savent.

**Déroulé.** Arrivée, combat, reconnaissance. Pas de halte : le Puits suit.

**Horizon.**
- Aujourd'hui : la fin sans mort, avec le mécanisme de la reddition ou celui de la trêve (à choisir dans le ticket). Le repli devient impossible sur ce chapitre.
- Avec l'exploration : la plaine et le pied des murs à parcourir.
- Après la v1 : la forge des Painkush est la place naturelle de l'équipement (MAE-8).

### 5.8 Chapitre VI · Le Puits des Anciens

Validé par Wesley le 11/11/2026 : un immortel vit au Puits. Il a des couleurs vives, comme tout immortel. Ce qu'il dit et ce qu'il a fait viennent du sommaire.

**Rôle.** La grande halte avant le Dragon : le repos, le dernier marchand, le deuxième fragment, et la colère de Maelor.

**Ce que le joueur apprend.**
- L'Ordre ne domptait pas les Tyrdrak : « Ils ne domptaient pas les dragons. Ils marchaient avec eux. »
- Elwen n'est pas la seule de son espèce, et les autres ont regardé l'Ordre tomber sans rien faire.
- Elwen, elle, intervient. Sa présence auprès de Maelor est déjà une faute aux yeux des siens.

**Par quel moyen.**
- Le repos, le fragment et la question de Corvin restent : « Alors pourquoi tout le monde raconte l'inverse ? »
- La scène nouvelle répond à cette question par un visage. Près du puits vit un immortel. Il connaît Elwen. Il savait pour l'Ordre, et il n'a rien fait : ceux de son espèce regardent.
- La colère de Maelor, qui visait l'indifférence, a enfin quelqu'un devant elle. Elle ne peut pas le frapper. Ce qu'il fait de cette colère, il le décidera dans l'antre.
- L'immortel dit une phrase sur la bête et sur Elwen, pas davantage. Le lien entre Elwen et Vahn s'épaissit sans se résoudre (la bible le garde comme un mystère).
- Le colporteur hésium retrouve le groupe ici : c'est le dernier point de vente.

**Ce qui reste caché.** Le cycle entier, que le joueur ne comprend que dans la vraie fin : l'immortel ne l'explique pas. Le nom du Dragon. Ce qui lie Elwen à lui.

**Déroulé.** Arrivée et repos, scène de l'immortel, fragment, puis le menu : parler à Corvin, parler à Elwen, voir le colporteur, entrer dans l'antre.

**Horizon.**
- Aujourd'hui : la scène, le menu, le marchand.
- Avec l'exploration : la margelle comme lieu du fragment (MAE-36), l'immortel à l'écart.

**Validé par Wesley le 11/11/2026.** La fiche des personnages disait qu'à l'écran, Elwen est la seule touche de couleur vive. Elle change : l'immortel du Puits garde des couleurs vives. La fiche est tenue hors du dépôt (projet claude.ai « RPG ») ; sa mise à jour est notée dans le ticket de l'immortel.

### 5.9 Chapitre VII · L'Antre du Dragon

Statut : sommaire.

**Rôle.** Laisser le joueur comprendre seul, puis choisir.

**Ce que le joueur apprend.** La bête avait un ami dans l'Ordre, et garde son blason depuis trente ans. Elle n'attaque pas par folie.

**Par quel moyen.**
- La première page reste. La phrase « Au village, on la dit folle. » pèse davantage quand le joueur a vu le village.
- Le fragment garde ce que le souvenir montre : le Tyrdrak plus jeune, le chevalier endormi contre lui, les torches, la flèche, « Personne ne sait plus qui a tiré le premier. »
- Les phrases qui concluent à la place du joueur en sortent. Ce qu'elles disaient, le décor le dit déjà : le blason usé « comme si on l'avait tenu chaque jour pendant trente ans », les signes gravés « comme pour ne pas oublier ».
- La réplique de Maelor reste (la bible la garde) : « Il n'est pas fou. Il croit qu'on vient le tuer. »
- L'affinité de Maelor se joue ici : il sent ce que sent le Dragon, comme le chevalier du Puits (« L'homme sent ce que sent le Tyrdrak, le Tyrdrak sait ce que pense l'homme. »). C'est son héritage, vécu au lieu d'être expliqué.

**Ce qui reste caché.** Le nom de Vahn, jusqu'à la fin où la mémoire revient. Le cycle entier, jusqu'à la vraie fin.

**Déroulé.** Arrivée, fragment, combat, choix, fin. Rien ne change dans les choix.

**Horizon.** Aujourd'hui.

### 5.10 Les fins

Elles ne changent pas. Le village montré au début leur donne ce qui leur manquait :

- les cloches de la troisième fin et de la fausse fin (« Au village, on sonne les cloches ») sonnent dans un lieu que le joueur connaît ;
- dans la vraie fin, « les villageois lèvent les yeux vers ses ailes et, pour une fois, ne s'enfuient pas » : ce sont ceux qu'il a entendus au départ.

**Validé par Wesley le 11/11/2026.** Le Dragon n'est jamais sorti de son antre depuis trente ans, comme le disent les fins. Personne au village ne l'a vu, et la rumeur d'une bête qui ravage le Val ne repose sur rien : c'est le thème du jeu. La phrase de la fausse fin sur le ciel vide, relevée en 2.3, est donc à réécrire.

## 6. Les cinq révélations

Pour chacune : la question, les indices dans l'ordre, la réponse. Les indices marqués « jeu » existent aujourd'hui.

### L'Ordre

| Étape | Ce qui est donné | Moyen |
|---|---|---|
| Prologue | La version du monde : des sorciers, exécutés. Le nom effacé. | Narrateur (jeu) |
| Village | Ce qu'on en dit encore, trente ans après. | Scène |
| II | Des chevaliers à genoux, un Tyrdrak qui gît derrière eux. Le nom, à peine lisible. | Fragment (jeu) |
| V | Leur armure venait des Painkush et des mues des Tyrdrak. | Suite du combat |
| VI | Ils marchaient avec les Tyrdrak. Le nom se précise. | Fragment (jeu) |
| VII | L'amitié d'un chevalier et d'un Tyrdrak, et la flèche. Le nom, presque entier. | Fragment (jeu) |
| Dragon épargné | Le nom entier (vraie fin et fin rédemption). Dans la vraie fin, ce que l'Ordre était venu faire. | Fragment (jeu) |

Ce qui reste flou, volontairement : ce qui a déclenché la rupture (bible).

### Le Dragon

| Étape | Ce qui est donné | Moyen |
|---|---|---|
| Village | Une bête folle, que personne n'a vue. | Scène |
| II | Les Tyrdrak mouraient aux côtés des hommes. Les autres ne sont pas venus. | Fragment (jeu) |
| IV | « Même la bête du Val. » | Réplique (jeu) |
| V | L'armure de Maelor est faite de mues de Tyrdrak. | Suite du combat |
| VI | Des empreintes de griffes et de mains, gravées ensemble. | Texte du lieu (jeu) |
| VII | Le blason gardé, les signes gravés, la cendre. | Texte du lieu et fragment (jeu) |
| Dragon épargné | Son nom. | Scène (jeu) |

### Corvin

| Étape | Ce qui est donné | Moyen |
|---|---|---|
| Village | On évite le Veilleur. Le mot « sorcellerie » le fige. | Scène |
| II | Il répète une rumeur sur les Hésiums, puis voit qu'elle était fausse. | Dialogue (jeu) |
| II, halte | Son maître, brûlé par un village pris de terreur. | Corvin lui-même |
| IV | Sa question trouve une réponse : le Souffle respire. | Dialogue (jeu) |
| IV | Sa marque s'éclaire au Cœur. | Indice visuel (validé) |

Ce qui reste ouvert : sa marque, et son appartenance possible au peuple à longue vie (bible).

### Elwen

| Étape | Ce qui est donné | Moyen |
|---|---|---|
| Village | Elle soigne celui qu'on a laissé. On se détourne de ses couleurs. Elle regarde les cheveux de Maelor. | Scène |
| I et après | Des éclats d'or quand elle est touchée. | Indice visuel (jeu) |
| II | Le sol s'éclaire à son approche. Elle détourne les yeux devant le tertre. | Texte (jeu) |
| III | Elle sait ce que gardent les Gau-Tik. | Dialogue (jeu) |
| III, halte | Corvin lui demande comment. | Scène |
| IV | Elle est née du Souffle. | Révélation (jeu) |
| VI | Les siens n'interviennent pas ; elle, si. | Scène de l'immortel |

Ce qui reste caché : son lien avec Vahn (bible), et tout ce qu'elle n'a pas le droit de dire.

### Maelor

| Étape | Ce qui est donné | Moyen |
|---|---|---|
| Prologue | Un blason qui s'est éveillé. | Narrateur (jeu) |
| Village | Elwen regarde ses cheveux. | Scène |
| I et après | Des éclats d'or quand il est touché. | Indice visuel (jeu) |
| II | Les os se souviennent de quelque chose, en lui. | Dialogue (jeu) |
| III | Les Gau-Tik l'attendaient. | Reddition (jeu) |
| IV | Son sang est doré ; il descend d'un peuple oublié. | Révélation (jeu) |
| V | Son armure est celle de l'Ordre. | Suite du combat |
| VII | Il sent ce que sent le Dragon. | Scène |

### Le cycle du Souffle

Il n'est pas une des cinq révélations, mais il les relie. Le joueur en reçoit une part au Cœur (le Souffle respire), une autre au Puits (les immortels savent et n'interviennent pas), et le sens entier seulement dans la vraie fin (bible).

## 7. Les personnages rencontrés

| Personnage | Où | Ce qu'il apporte | À l'écran | Statut |
|---|---|---|---|---|
| Le marchand du village | Village | Le premier point de vente. La voix du village : la rumeur, la peur. | Bande de dialogue seule | Validé |
| L'ancien des Hésiums | II | Il existe déjà (« Le plus âgé des Hésiums »). La mémoire des os, l'alliance. | Sprite de l'Hésium, déjà dans le jeu | Dans le jeu |
| Le colporteur hésium | II et VI | Le marchand du voyage. Par lui, l'alliance des Hésiums a une suite. | Un sprite, variante de l'Hésium | Validé |
| Le Painkush | V | Il reconnaît l'armure : l'Ordre avait des alliés parmi les peuples. | Sprite du Painkush, déjà dans le jeu | Validé |
| L'immortel du Puits | VI | L'indifférence, avec un visage. La faille d'Elwen. | Un sprite, aux couleurs vives | Validé |
| Les Gau-Tik | III | Rien de nouveau : ils se taisent. | Déjà dans le jeu | Dans le jeu |

Non retenue par Wesley le 11/11/2026 : la crieuse, une vieille villageoise qui aurait crié « sorcellerie » il y a trente ans sans plus savoir pourquoi.

Coût pour la v1 : deux sprites (le colporteur, l'immortel) et une peinture (le village).

### Le colporteur hésium

- Après l'alliance, un Hésium décide de suivre le groupe : les os de ses morts ont reconnu Maelor.
- Il vend au feu des Hésiums (II), puis au Puits (VI).
- Entre les deux, il n'est pas là. La lumière du Souffle frappe les Hésiums comme un coup (« La lumière les frappe : ils portent les mains à leur masque, comme sous un coup. ») : il ne peut pas traverser le Cœur d'Aure-Hin, et passe par d'autres chemins. Le joueur doit donc prévoir ses achats pour trois chapitres.
- À valider : son nom (lexique d'abord) ; par où il passe, à décider avec la carte du monde (question ouverte de la bible).

### L'immortel du Puits

- Il vit près du puits, à l'écart, comme la bible le dit de certains immortels.
- Il n'est pas un ennemi et ne se combat pas.
- Il ne révèle pas le cycle.
- À valider : son nom, dans la langue des immortels (lexique d'abord) ; sa fiche et ses couleurs, d'après `docs/character-palette.md`.

## 8. Les marchands et les Couronnes

### Les points de vente

Validé par Wesley le 11/11/2026 : le marchand entre en v1, avec les trois objets qui existent (Sève, Encens, Larme dorée). L'équipement reste après la v1 (MAE-8).

| Halte | Marchand | Avant |
|---|---|---|
| Le village | Le marchand du village (humain, bande de dialogue) | La Lisière et le Champ des Échos |
| Le feu des Hésiums (II) | Le colporteur hésium | Le pont, le Cœur, la Pierre Nue |
| Le Puits des Anciens (VI) | Le colporteur hésium | Le Dragon |

Validé par Wesley le 11/11/2026 : le marchand du village n'a qu'une seule Larme dorée. Le reste de ce que vend chacun se décide dans le ticket du marchand. Piste à valider : cette larme est chère, et le marchand ignore sa nature. La bible dit que ce sont des larmes d'immortels ; le joueur le comprendra après le Cœur.

### D'où viennent les Couronnes

Validé par Wesley le 11/11/2026 : une bourse de départ, des dons après la trêve et la reddition, et plus de butin pris sur des alliés.

| Moment | Aujourd'hui | Demain |
|---|---|---|
| Départ | 0 Couronne | Une bourse de départ |
| I · Sankri | 50, en butin | De la Sève, sans Couronnes (validé) |
| II · trêve | 80, en butin | Un don des Hésiums |
| III · reddition | 180, en butin | Un don des Gau-Tik, dont la nature reste à décider |
| IV · écho | Rien, et une Larme dorée | Inchangé |
| V · Painkush | 110, en butin | À valider : un don du Painkush, comme après une reddition |
| VII · Dragon achevé | 1000, en butin | Inchangé : le butin reste là où le joueur choisit de tuer |

Le mot « ramasse » ne reste donc que là où le groupe a tué.

### Ce qui revient à l'équilibrage (MAE-39)

- Le montant de la bourse de départ et de chaque don.
- Les prix.
- Le stock de départ : 5 Sèves, 2 Encens et 2 Larmes dorées aujourd'hui (`CONFIG.startingItems`). Avec un marchand dès le village, ce stock peut baisser.
- Ce qu'une halte rend en PV et en PS.

## 9. Le rythme et la durée

### L'enchaînement

```
Prologue (2 pages)
Le village            scène · halte · marchand
I   La Lisière        arrivée · combat · suite
II  Champ des Échos   arrivée · fragment · combat · trêve · halte · marchand
III Le pont           arrivée · combat · reddition · halte courte
IV  Le Cœur           arrivée · révélation · combat · choix · halte courte
V   La Pierre Nue     arrivée · combat · reconnaissance
VI  Le Puits          repos · immortel · fragment · halte · marchand
VII L'antre           arrivée · fragment · combat · choix
Fin
```

- Six combats, comme aujourd'hui. Les rencontres évitables viendront avec l'exploration (MAE-35).
- Cinq haltes : deux longues avec marchand et rencontre (le feu des Hésiums, le Puits), une au départ (le village), deux courtes (l'autre rive, l'après-Cœur).
- Jamais deux combats sans une scène entre eux.
- Les deux endroits où le texte risque d'être long : le village, avant le premier combat, et le Cœur. Ils sont à surveiller à l'écriture.

### La durée

Wesley vise une partie de 30 à 45 minutes (décision du 11/11/2026, MAE-39). Le budget ci-dessous est une cible d'écriture, pas une mesure : rien de ce plan n'a encore été joué.

| Étape | Cible |
|---|---|
| Prologue et village | 5 à 6 min |
| I | 3 à 4 min |
| II et sa halte | 6 à 7 min |
| III et sa halte | 4 à 5 min |
| IV et sa halte | 6 à 7 min |
| V | 4 min |
| VI | 5 à 6 min |
| VII et la fin | 6 à 7 min |
| Total | 39 à 46 min |

Ce budget dépasse la cible d'une minute en haut, et n'approche pas les 30 minutes en bas. Un joueur qui passe toutes les conversations au choix sera plus bas. S'il faut raccourcir, ce sont d'abord les deux haltes courtes. La mesure se fait dans MAE-39.

## 10. Ce que les décors doivent prévoir

Le même décor sert au combat, à la halte et, plus tard, à l'exploration.

| Lieu | Ticket | À prévoir |
|---|---|---|
| Le village | MAE-111 | Une place de nuit avec sa cloche, la porte du marchand, la route qui part vers la Lisière. La place des trois héros, sans ennemi. |
| I · Lisière | Fait (MAE-2) | Rien. Plus tard : les deux arbres que deviennent les Sankri. |
| II · Champ des Échos | MAE-3 | Un coin de feu près du tertre, avec la place du colporteur. |
| III · Pont | MAE-4 | L'autre rive, où le groupe s'arrête. |
| IV · Cœur | MAE-77 | Rien de plus. |
| V · Pierre Nue | MAE-78 | Les murs taillés et une porte de forge, fermée. |
| VI · Puits | MAE-5 | Autour du puits, la place de l'immortel et celle du colporteur. |
| VII · Antre | MAE-6 | Rien de plus. |

## 11. Changements de la bible

### Validés par Wesley le 11/11/2026

| Changement | Où il entre dans la bible |
|---|---|
| Le village est un lieu montré, avant la Lisière. | « Le voyage » |
| Les trois héros se rencontrent au village. | « Le voyage » |
| Le voyage a des haltes. | « Le voyage » |
| Les Painkush forgeaient pour l'Ordre les mues des Tyrdrak. | « L'Ordre », « Les peuples » |
| Le Painkush de la Pierre Nue reconnaît l'armure de Maelor et ne meurt pas. | « Les peuples » |
| Un Hésium, colporteur, suit le groupe après l'alliance. | « Les peuples » |
| Un immortel vit au Puits des Anciens. Il a des couleurs vives. | « Les immortels » |
| Les Couronnes viennent d'une bourse de départ et de dons ; plus de butin pris sur des alliés. | « Le voyage » |
| Le marchand du village est un humain. Il n'a qu'une seule Larme dorée. | « Le voyage » |
| Le Dragon n'est pas sorti de son antre depuis trente ans ; la rumeur qui le dit ravager le Val ne repose sur rien. | « Les Tyrdrak et Vahn » |
| Au chapitre V, la trace des Tyrdrak est l'armure de Maelor, faite de mues. Aucune écaille du Dragon en chemin. | « Le voyage » |
| La marque de Corvin s'éclaire au Cœur d'Aure-Hin : un indice discret, sans réponse. | « Les héros » |
| Les Sankri laissent de la Sève au lieu de Couronnes. | « Les peuples » |
| Elwen n'est plus la seule touche de couleur vive à l'écran : l'immortel du Puits garde des couleurs vives. | « Les immortels », et la fiche des personnages (hors dépôt) |

### À valider

Wesley tranchera ces points au moment de réécrire chaque chapitre, dans les tickets concernés (décision du 11/11/2026).

| Changement | D'où il vient |
|---|---|
| Le village est le dernier avant le Val, et Maelor n'en est pas. | 5.2 |
| Corvin est rencontré au village, et non « en route ». | Fiche de Corvin |
| Le nom du village, celui du colporteur, celui de l'immortel. | Lexique |
| Le Painkush fait un don au groupe, comme les Hésiums et les Gau-Tik. | 8 |
| Chaque halte s'ouvre sur une scène obligatoire, avant son menu. | 4 |
| Par où passe le colporteur entre le Champ des Échos et le Puits. | 7, et la carte du monde |

## 12. Repères pour les tickets

Ce que le plan touche dans le code, pour découper le travail. Rien n'est décidé ici.

- **Les suites de combat** existent déjà dans les données d'un chapitre : la trêve (`truce`), la reddition (`surrender`), les pages après une victoire (`afterVictory`).
- **La halte** est une nouvelle sorte d'étape dans `CHAPTERS`. Le chapitre de repos (`rest`) en est le point de départ. Son menu utilise le choix qui existe (`view.ask`).
- **Le village** ajoute une étape avant le chapitre I. L'ordre des étapes change : `SAVE_VERSION` augmente, et le paramètre `chapitre=N` du mode test est à revoir.
- **Le marchand** est un nouvel écran. Il lui faut une maquette validée (epic MAE-15) et une méthode du contrat `GameView`, dans la vue DOM et dans la vue muette.
- **Les dons** changent le texte des récompenses (`formatRewards`) et les données des ennemis (`gil`).
- **Le repli** est à interdire aux chapitres III et V (`canRun`).
- **Les textes selon le pouvoir**, pour la halte d'après le Cœur, suivent le modèle de `DRAGON_FATE`.

## 13. Tickets

Créés le 11/11/2026, sur le feu vert de Wesley. Chaque ticket reprend ses décisions et ses points « À valider ».

### Avant l'écriture

| Ticket | Titre | Rôle |
|---|---|---|
| MAE-113 | Étoffer le lore des peuples et des personnages | Demandé par Wesley, hors des treize tickets du plan. À faire avant l'écriture des chapitres : pour chaque peuple et chaque personnage, la rumeur, la vérité et un secret à révéler. Les tickets d'écriture ci-dessous en dépendent. |

### Les tickets du plan

| Ticket | Titre | Sections du plan | Dépend de |
|---|---|---|---|
| MAE-106 | Dessiner la maquette de la halte et du marchand | 4, 8 | |
| MAE-107 | Créer la halte : un arrêt du groupe entre deux combats | 4, 9, 12 | MAE-106 |
| MAE-108 | Coder l'écran du marchand et l'achat des trois objets | 8 | MAE-106, MAE-107 |
| MAE-109 | Remplacer le butin par une bourse de départ et des dons | 8 | |
| MAE-110 | Écrire le village : la rumeur, la rencontre des trois, le marchand | 5.2 | MAE-107, MAE-113 |
| MAE-111 | Créer le décor peint du village | 5.2, 10 | |
| MAE-112 | Écrire les haltes de route : le feu des Hésiums, l'autre rive, l'après-Cœur | 5.4, 5.5, 5.6 | MAE-107, MAE-113 |
| MAE-114 | Créer le colporteur hésium : fiche, sprite, nom, scènes | 7, 8 | MAE-107, MAE-113 |
| MAE-115 | Faire reconnaître l'armure de Maelor par le Painkush, sans le tuer | 5.7 | MAE-113 |
| MAE-116 | Créer l'immortel du Puits : fiche, sprite, nom, scène | 5.8, 7 | MAE-107, MAE-113 |
| MAE-117 | Resserrer la révélation du Cœur d'Aure-Hin | 5.6 | MAE-113 |
| MAE-118 | Réécrire le fragment de l'antre et accorder les fins sur les trente ans | 5.9, 5.10 | MAE-113 |
| MAE-119 | Interdire le repli devant les Gau-Tik et le Painkush | 2.3 | |

### Les tickets qui existaient, complétés par le plan

| Ticket | Objet | Ce que le plan y ajoute |
|---|---|---|
| MAE-37 | Réduire le prologue à 1 ou 2 écrans, distiller le reste en jeu | Le contenu du prologue et la nouvelle place de ce qui en sort (5.1). Dépend de MAE-110 et de MAE-112. |
| MAE-38 | Étoffer les chapitres I et III | La suite du combat de la Lisière (5.3) ; la halte de l'autre rive (5.5). |
| MAE-39 | Équilibrer la difficulté pour une partie de 30 à 45 minutes | Bourse, dons, prix, stock de départ, repos des haltes, budget de durée (8, 9). |
| MAE-35 | Placer les combats d'histoire et les rencontres optionnelles sur la carte | Une seule mise à mort : comment finissent les rencontres évitables (3, 5.3). |
| MAE-9 | Marchand entre les chapitres | Epic du marchand : MAE-108 et MAE-109 pour la v1. |
| MAE-3 | Décor du Champ des Échos | Un coin de feu près du tertre, la place du colporteur (10). |
| MAE-4 | Décor du Pont de Pierre-Noire | L'autre rive, où le groupe s'arrête (10). |
| MAE-78 | Décor de la Pierre Nue | Les murs et une porte de forge, fermée (10). |
| MAE-5 | Décor du Puits des Anciens | La place de l'immortel et celle du colporteur (10). |

### À la fin

| Ticket | Titre | Rôle |
|---|---|---|
| MAE-105 | Relire tous les textes du jeu terminé à la lumière du plan du récit | Demandé par Wesley, hors des treize tickets du plan. Le contrôle d'ensemble, une fois tous les chapitres réécrits. |
