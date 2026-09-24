// data.js - Données du jeu : héros, sorts, objets, ennemis, histoire, état de la partie

// Réplique d'un personnage dans un dialogue
const say = (name, text) => `<span class="speaker">${name} :</span> ${text}`;

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
                 desc: "Rend des PV. Blesse les morts-vivants." },
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
    name: "Dragon", image: "images/dragon.png", boss: true,
    maxHp: 1800, atk: 30, def: 14, mag: 26, res: 12, spd: 10,
    elements: { ice: "weak", fire: "absorb" },
    pattern: ["attack", "attack", "fireBreath"],
    rage: { threshold: 0.5, pattern: ["fireBreath", "attack"], message: "Le Dragon entre en fureur !" },
    xp: 300, gil: 1000, drop: { item: "phoenix", chance: 1 },
  },
};

// — Histoire —
// Chaque page de dialogue est un bloc de texte (HTML simple autorisé)

const PROLOGUE = [
  "Maelor s'aventure dans les terres brumeuses du Val Ténébreux, guidé par les murmures d'un serment oublié.<br><br>" +
  "Il est le dernier descendant d'un ordre jadis puissant : <strong>L'Ordre Déchu</strong>. Trente années plus tôt, ses membres furent accusés de sorcellerie noire et exécutés sans procès. Leurs cendres dispersées, leur nom effacé des livres... sauf d'un.",

  "Aujourd'hui, quelque chose rôde dans les bois. Les morts se lèvent. Le sang ancien appelle.<br><br>" +
  "Maelor n'est pas là pour sauver le royaume.<br>Il est là pour réclamer ce qui lui revient.",

  "Il ne marche pas seul.<br><br>" +
  "<strong>Lyra</strong>, mage noire au regard de braise. Son maître a brûlé sur le même bûcher que l'Ordre ; elle n'a gardé de lui qu'un chapeau et une colère.<br><br>" +
  "<strong>Elwen</strong>, mage blanche chassée du temple pour avoir soigné des condamnés. Elle croit encore que chaque vie peut être sauvée. Même celle de Maelor.",
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
      "Au-delà des bois s'étend un cimetière sans croix. C'est ici qu'on a jeté les corps de l'Ordre. La terre remue.<br><br>" +
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
      "Au cœur d'une clairière, une source brille d'une lueur pâle. Ses eaux referment les plaies et rendent l'éclat aux esprits las.<br><br>" +
      "<em>Les PV et les PM du groupe sont entièrement restaurés.</em>",
    ],
  },
  {
    title: "V · L'Antre du Dragon",
    tint: "rgba(70, 12, 5, 0.45)",
    boss: true,
    canRun: false,
    story: [
      "La grotte exhale une chaleur de forge. Sur un lit d'ossements et de blasons brisés repose la bête qui a dévoré l'Ordre.<br><br>" +
      say("Maelor", "Trente ans que j'attends ce jour.") + "<br>" +
      say("Elwen", "Son souffle est de feu. Garde tes flammes, Lyra. La glace, peut-être..."),
    ],
    enemies: ["dragon"],
  },
];

const ENDING = [
  "Le Dragon s'effondre dans un fracas de pierre. Sous ses écailles calcinées luit un blason terni : celui de l'Ordre.<br><br>" +
  "Maelor le ramasse. Il ne dit rien.",

  "Pour la première fois depuis trente ans, le Val Ténébreux est silencieux.<br><br>" +
  "L'Ordre Déchu n'est plus un nom effacé des livres.<br><br><strong>— FIN —</strong>",
];

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
  checkpoint: null, // copie de l'état au début du chapitre, pour « Réessayer »
  get currentChapter() { return CHAPTERS[this.chapterIndex]; },

  reset() {
    this.party = HEROES.map(createHero);
    this.inventory = { ...CONFIG.startingItems };
    this.gil = 0;
    this.chapterIndex = 0;
    this.checkpoint = null;
  },

  saveCheckpoint() {
    const { party, inventory, gil, chapterIndex } = this;
    this.checkpoint = JSON.stringify({ party, inventory, gil, chapterIndex });
  },

  loadCheckpoint() {
    Object.assign(this, JSON.parse(this.checkpoint));
  },
};
