// data.js - Données du jeu : héros, sorts, objets, ennemis, histoire, état de la partie

// Réplique d'un personnage dans un dialogue
const say = (name, text) => `<span class="speaker">${name} :</span> ${text}`;

// Fragment de mémoire révélé par le blason de Maelor : une page à part, avec son propre son
const memory = html => ({ html: `<span class="memory">${html}</span>`, sfx: "memory" });

// — Héros —
// stats : valeurs au niveau 1 · growth : gain à chaque niveau · spells : sorts appris par niveau

const HEROES = [
  {
    id: "maelor", name: "Maelor", job: "Chevalier déchu", image: "images/maelor.png",
    command: "Techniques",
    stats:  { maxHp: 160, maxMp: 18, atk: 18, def: 10, mag: 6,  res: 6,  spd: 9  },
    growth: { maxHp: 22,  maxMp: 2,  atk: 3,  def: 2,  mag: 1,  res: 1,  spd: 1  },
    spells: { 1: ["fallenBlade"], 3: ["whirlwind"] },
  },
  {
    id: "lyra", name: "Lyra", job: "Mage noire", image: "images/lyra.svg",
    command: "Magie noire",
    stats:  { maxHp: 95,  maxMp: 40, atk: 8,  def: 5,  mag: 18, res: 12, spd: 11 },
    growth: { maxHp: 12,  maxMp: 6,  atk: 1,  def: 1,  mag: 3,  res: 2,  spd: 1  },
    spells: { 1: ["fire", "ice"], 2: ["thunder"], 4: ["blaze"] },
  },
  {
    id: "elwen", name: "Elwen", job: "Mage blanche", image: "images/elwen.svg",
    command: "Magie blanche",
    stats:  { maxHp: 110, maxMp: 44, atk: 9,  def: 6,  mag: 15, res: 14, spd: 10 },
    growth: { maxHp: 15,  maxMp: 6,  atk: 1,  def: 1,  mag: 2,  res: 2,  spd: 1  },
    spells: { 1: ["cure"], 3: ["life"], 4: ["curePlus"] },
  },
];

// — Capacités —
// kind   : "physical" | "magic" | "heal" | "mp" | "revive" | "run"
// target : "foe" | "all-foes" | "ally" | "all-allies" | "ko-ally" | "none"

const ATTACK = { name: "Attaque", kind: "physical", power: 1, target: "foe" };
const RUN    = { name: "Fuite",   kind: "run", target: "none" };

const SPELLS = {
  fallenBlade: { name: "Lame Déchue", mp: 6,  kind: "physical", power: 2, pierce: true, target: "foe",
                 desc: "Frappe double qui ignore la défense." },
  whirlwind:   { name: "Tourbillon",  mp: 10, kind: "physical", power: 1.2, target: "all-foes",
                 desc: "Balaie tous les ennemis." },
  fire:        { name: "Feu",         mp: 4,  kind: "magic", power: 28, element: "fire",    target: "foe",
                 desc: "Flammes sur un ennemi." },
  ice:         { name: "Glace",       mp: 4,  kind: "magic", power: 28, element: "ice",     target: "foe",
                 desc: "Givre sur un ennemi." },
  thunder:     { name: "Foudre",      mp: 5,  kind: "magic", power: 34, element: "thunder", target: "foe",
                 desc: "Éclair sur un ennemi." },
  blaze:       { name: "Brasier",     mp: 12, kind: "magic", power: 30, element: "fire",    target: "all-foes",
                 desc: "Flammes sur tous les ennemis." },
  cure:        { name: "Soin",        mp: 5,  kind: "heal", power: 40, target: "ally",
                 desc: "Rend des PV. Brûle les créatures d'os." },
  curePlus:    { name: "Soin+",       mp: 14, kind: "heal", power: 30, target: "all-allies",
                 desc: "Rend des PV à tout le groupe." },
  life:        { name: "Vie",         mp: 12, kind: "revive", target: "ko-ally",
                 desc: "Ranime un allié K.O." },
};

const ITEMS = {
  potion:  { name: "Potion",          kind: "heal",   amount: 100, target: "ally",    desc: "Rend 100 PV." },
  ether:   { name: "Éther",           kind: "mp",     amount: 30,  target: "ally",    desc: "Rend 30 PM." },
  phoenix: { name: "Queue de Phénix", kind: "revive",              target: "ko-ally", desc: "Ranime un allié K.O." },
};

const ENEMY_SKILLS = {
  crush:      { name: "Écrasement",     kind: "physical", power: 1.6, target: "foe" },
  fireBreath: { name: "Souffle ardent", kind: "magic", power: 34, element: "fire", target: "all-foes" },
};

// — Ennemis —
// elements : "weak" | "resist" | "absorb" · skills : capacités tirées au hasard
// pattern  : suite d'actions jouées en boucle · rage : nouveau pattern sous un seuil de PV
// spareable : vaincu, il reste à terre et le joueur choisit de l'épargner ou de l'achever (DRAGON_FATE)

const ENEMIES = {
  goblin: {
    name: "Gobelin", image: "images/goblin.png",
    maxHp: 70, atk: 14, def: 4, mag: 0, res: 4, spd: 12,
    xp: 18, gil: 25, drop: { item: "potion", chance: 0.4 },
  },
  skeleton: {
    name: "Squelette", image: "images/skeleton.png",
    maxHp: 110, atk: 17, def: 8, mag: 0, res: 6, spd: 8,
    undead: true, elements: { fire: "weak" },
    xp: 26, gil: 40, drop: { item: "ether", chance: 0.25 },
  },
  ogre: {
    name: "Ogre", image: "images/ogre.png",
    maxHp: 260, atk: 24, def: 10, mag: 0, res: 4, spd: 6,
    elements: { thunder: "weak" },
    skills: [{ skill: "crush", chance: 0.3 }],
    xp: 55, gil: 90, drop: { item: "potion", chance: 0.6 },
  },
  dragon: {
    name: "Dragon", image: "images/dragon.png", boss: true, spareable: true,
    maxHp: 1800, atk: 30, def: 14, mag: 26, res: 12, spd: 10,
    elements: { ice: "weak", fire: "absorb" },
    pattern: ["attack", "attack", "fireBreath"],
    rage: { threshold: 0.5, pattern: ["fireBreath", "attack"], message: "Le Dragon entre en fureur !" },
    xp: 300, gil: 1000, drop: { item: "phoenix", chance: 1 },
  },
};

// — Histoire —
// Chaque page de dialogue est un bloc de texte (HTML simple autorisé).
// Le monde ne connaît l'Ordre que sous le nom d'« Ordre Déchu » ; son vrai nom n'apparaît que dans
// les fragments du blason, de plus en plus lisible, et ne se complète que si le Dragon est épargné.

const PROLOGUE = [
  "Dans ces terres, on se bat depuis si longtemps que plus personne ne sait pourquoi. L'origine des guerres s'est effacée des mémoires, puis des livres. Il ne reste que les guerres.<br><br>" +
  "Il y a trente ans, un ordre de chevaliers fut accusé de sorcellerie et exécuté sans procès. Son nom disparut avec lui. Le monde ne l'appelle plus que <strong>l'Ordre Déchu</strong>.",

  "Maelor porte au cou un blason aux armes de cet ordre, transmis dans sa famille depuis deux générations. Pour son grand-père comme pour son père, ce n'était qu'un souvenir de métal terni.<br><br>" +
  "Chez Maelor, le blason s'est éveillé. Il est né avec une affinité pour les dragons, un don rare distribué au hasard des naissances, comme d'autres naissent gauchers. Près de certains lieux, le blason se réchauffe et lui montre des souvenirs qui ne sont pas les siens.",

  "Personne n'a appelé Maelor dans le Val Ténébreux. Il n'y cherche ni trésor ni vengeance. Il cherche un sens : pourquoi l'Ordre est tombé, pourquoi on se bat encore, pourquoi le monde oublie tout sans que personne s'en soucie.<br><br>" +
  "Sa colère n'a pas de visage. Elle vise l'indifférence.<br><br>" +
  say("Maelor", "Je ne suis pas celui qu'on attendait. Personne ne m'a choisi. J'ai choisi de venir."),

  "Il ne marche pas seul.<br><br>" +
  "<strong>Lyra</strong>, mage noire au regard de braise. Son maître n'a jamais pratiqué la magie noire. Un village effrayé l'a brûlé sur une rumeur, sans procès. Puis la foule s'est dispersée, et plus personne ne se souvient de rien.<br><br>" +
  "Elle a gardé de lui un chapeau, et une colère qui n'a personne à frapper. Elle en veut à un monde qui juge vite, détruit vite, et oublie plus vite encore.",

  "<strong>Elwen</strong>, mage blanche. Son temple enseignait que la guérison se mérite, et qu'on ne la donne pas aux condamnés. Elle en a soigné quand même, ceux qu'on avait abandonnés. On l'a chassée.<br><br>" +
  "Qui peut juger avec certitude, dans un monde qui a oublié jusqu'à l'origine de ses propres guerres ? Elwen croit que chaque vie peut être sauvée. Même celle qu'on a déjà jugée perdue.",
];

const CHAPTERS = [
  {
    title: "I · La Lisière",
    tint: "rgba(8, 18, 40, 0.30)",
    story: [
      "Aux abords du Val, les arbres se referment comme des doigts. Des rires aigus éclatent entre les troncs.<br><br>" +
      say("Lyra", "Des gobelins. Ils ont senti ta bourse, Maelor."),
    ],
    enemies: ["goblin", "goblin"],
  },
  {
    title: "II · Le Cimetière des Parjures",
    tint: "rgba(20, 40, 50, 0.45)",
    story: [
      "Au-delà des bois s'étend un cimetière sans croix. C'est ici qu'on a jeté les corps de l'Ordre, dans une fosse sans nom.<br><br>" +
      "Contre la poitrine de Maelor, le blason se met à brûler.",

      memory(
        "Des chevaliers à genoux dans la boue, les mains liées. On arrache leur bannière : un dragon d'argent sur fond noir.<br>" +
        "Une voix crie « sorcellerie ». D'autres reprennent le mot sans savoir d'où il vient.<br>" +
        "Un chevalier lève les yeux vers le ciel vide : « Ils ne viendront pas. Plus maintenant. »<br><br>" +
        "Le nom qu'on efface ce jour-là tremble sur le blason : <strong>R····r D······s</strong>."),

      "Un raclement tire Maelor du souvenir. Entre les tombes, des silhouettes creusent.<br><br>" +
      "Des Squelettes. Rien à voir avec les morts qu'ils dépouillent : c'est une race à part, qui récolte l'os humain comme d'autres coupent du bois, parce qu'il se taille bien et tient longtemps.<br><br>" +
      say("Elwen", "Ces os craignent le feu. Et la lumière d'un soin les brûle plus sûrement qu'une lame."),
    ],
    enemies: ["skeleton", "goblin", "skeleton"],
  },
  {
    title: "III · Le Pont de Pierre-Noire",
    tint: "rgba(30, 20, 50, 0.40)",
    story: [
      "Un pont de pierre enjambe un gouffre sans fond. En son milieu, une silhouette massive barre le passage, une massue sur l'épaule.<br><br>" +
      say("Lyra", "Un ogre. Rien qu'un bon coup de foudre ne puisse calmer."),
    ],
    enemies: ["goblin", "ogre", "skeleton"],
  },
  {
    title: "IV · La Source Sacrée",
    tint: "rgba(20, 60, 70, 0.30)",
    rest: true,
    story: [
      { html: "Au cœur d'une clairière, une source brille d'une lueur pâle. Ses eaux referment les plaies et rendent l'éclat aux esprits las.<br><br>" +
              "<em>Les PV et les PM du groupe sont entièrement restaurés.</em>", sfx: "heal" },

      "Sur les pierres du bassin, des empreintes de griffes côtoient des empreintes de mains, gravées ensemble dans la roche.<br><br>" +
      "Le blason se réchauffe.",

      memory(
        "Un dragon boit à la source. Un chevalier sans armure pose la main sur ses écailles.<br>" +
        "Ils ne se parlent pas avec des mots. L'homme sent ce que sent la bête, la bête sait ce que pense l'homme. Comment ? Le souvenir ne le dit pas.<br>" +
        "« Nous ne les commandons pas. Nous marchons à côté d'eux, pour que les hommes et les dragons ne s'oublient jamais. »<br><br>" +
        "Sur le blason, le nom se précise : <strong>Ré·r·r Dra··n·s</strong>."),

      say("Maelor", "Ils ne domptaient pas les dragons. Ils marchaient avec eux.") + "<br>" +
      say("Lyra", "Alors pourquoi tout le monde raconte l'inverse ?"),
    ],
  },
  {
    title: "V · L'Antre du Dragon",
    tint: "rgba(70, 12, 5, 0.45)",
    boss: true,
    canRun: false,
    story: [
      "La grotte exhale une chaleur de forge. Sur un lit d'ossements et de blasons brisés repose la bête qui, dit-on, a dévoré l'Ordre. Au village, on la dit folle.<br><br>" +
      "À l'écart des débris, un seul blason est intact. Usé, poli, comme si on l'avait tenu chaque jour pendant trente ans. Le blason de Maelor s'embrase.",

      memory(
        "Le même dragon, plus jeune. Un chevalier dort contre son flanc, ce blason intact sur la poitrine. Ils sont amis.<br>" +
        "Puis des torches, des cris, une flèche. Le chevalier ne se relève pas. Personne ne sait plus qui a tiré le premier.<br>" +
        "Depuis, le dragon croit tous les hommes hostiles, et les hommes le croient fou. Il a gardé le blason de son ami. Il attend quelqu'un qui se souvienne.<br><br>" +
        "Le nom, presque entier : <strong>Rédr·r Draku·is</strong>."),

      "Le Dragon ouvre les yeux. Il ne voit que des humains armés dans son antre, comme il y a trente ans.<br><br>" +
      say("Maelor", "Il n'est pas fou. Il croit qu'on vient le tuer.") + "<br>" +
      say("Elwen", "Son souffle est de feu. Garde tes flammes, Lyra. La glace, peut-être..."),
    ],
    enemies: ["dragon"],
  },
];

// — Fin : le sort du Dragon —
// question : affichée avec les deux options · scene : juste après le choix · ending : épilogue

const DRAGON_FATE = {
  question:
    "Le Dragon s'effondre sur les ossements. Il ne se relève pas. Son souffle n'est plus qu'une braise.<br><br>" +
    "Il regarde Maelor, sans haine. Maelor lève son arme.",

  // Vraie fin : le lien est restauré, le nom se complète
  spare: {
    label: "Épargner",
    scene: [
      "Maelor baisse son arme. Il pose la main sur le museau brûlant du Dragon, comme le chevalier du souvenir.<br><br>" +
      "La bête ne mord pas. Elle ferme les yeux.",

      memory(
        "Tout revient d'un coup, cette fois sans trou. Les passages gardés à deux, les noms transmis de l'un à l'autre, la promesse de ne jamais s'oublier.<br>" +
        "Ce que l'Ordre était venu faire, Maelor vient de le refaire.<br><br>" +
        "Le nom, enfin entier : <strong>Rédror Drakunis</strong>."),

      "Le Dragon se relève. Du bout du museau, il pousse vers Maelor le blason qu'il gardait depuis trente ans.<br><br>" +
      say("Maelor", "On ne l'oubliera plus. Toi non plus.") + "<br>" +
      say("Elwen", "Chaque vie peut être sauvée. Même celle-là."),
    ],
    ending: [
      "Le Dragon quitte son antre pour la première fois depuis trente ans. Au-dessus du Val Ténébreux, les villageois lèvent les yeux vers ses ailes et, pour une fois, ne s'enfuient pas.<br><br>" +
      "Il vole au-dessus du groupe, comme un allié veille sur les siens.",

      "Maelor porte désormais deux blasons : le sien, et celui du chevalier que le Dragon lui a confié. Le second n'est plus un souvenir. C'est une promesse à tenir.<br><br>" +
      "Il était venu chercher un sens. Il repart avec une tâche : que les hommes et les dragons ne s'oublient plus.",

      "Le monde parle encore de l'Ordre Déchu. Maelor, lui, connaît son vrai nom, et ce qu'il était venu faire.<br><br>" +
      "<strong>— FIN —</strong>",
    ],
  },

  // Fausse fin : « Victoire ! » en façade, le nom reste incomplet, rien n'est réparé
  kill: {
    label: "Achever",
    scene: [
      "Le Dragon s'éteint sans un cri.<br><br>" +
      "Contre la poitrine de Maelor, le blason devient froid. Les souvenirs se taisent, inachevés.<br><br>" +
      say("Maelor", "On a gagné... Alors pourquoi ai-je l'impression d'avoir perdu quelque chose ?"),
    ],
    ending: [
      "Parmi les cendres de la bête, Maelor ramasse le blason intact. Ce n'est plus qu'un morceau de métal. Il ne dit rien.",

      "Au village, on sonne les cloches : la bête folle est morte. Pour la première fois depuis trente ans, le ciel du Val Ténébreux est vide.<br><br>" +
      "Le monde parle toujours de l'Ordre Déchu. Son vrai nom reste effacé, et personne ne le cherche.",

      "Maelor avait choisi de venir. Il ne sait plus pourquoi.<br><br>" +
      "<strong>— FIN —</strong>",
    ],
  },
};

const GAME_OVER = [
  "Le Val Ténébreux referme ses brumes sur le groupe.<br><br>" +
  "L'Ordre Déchu retombe dans l'oubli... pour cette fois.",
];

// — État de la partie —

const GameState = {
  party: [],
  inventory: {},
  gil: 0,
  chapterIndex: 0,
  dragonSpared: null, // choix final : true (Épargner), false (Achever), null tant qu'il n'est pas fait
  checkpoint: null, // copie de l'état au début du chapitre, pour « Réessayer »
  get currentChapter() { return CHAPTERS[this.chapterIndex]; },

  reset() {
    this.party = HEROES.map(createHero);
    this.inventory = { ...CONFIG.startingItems };
    this.gil = 0;
    this.chapterIndex = 0;
    this.dragonSpared = null;
    this.checkpoint = null;
  },

  saveCheckpoint() {
    const { party, inventory, gil, chapterIndex, dragonSpared } = this;
    this.checkpoint = JSON.stringify({ party, inventory, gil, chapterIndex, dragonSpared });
  },

  loadCheckpoint() {
    Object.assign(this, JSON.parse(this.checkpoint));
  },
};
