// game-data.ts - Données du jeu : héros, souffles, objets, ennemis, histoire, état de la partie

import { CONFIG } from "../config.ts";
import { createHero, type Hero } from "../party/heroes.ts";
import type { CombatState } from "../battle/battle.ts";
import type { SoundName } from "../audio/sfx.ts";
import type { DecorId } from "./decors.ts";

// — Types —

// Page de dialogue : texte HTML, ou { html, sfx } pour jouer un son à l'ouverture de la page
export interface PageObject {
  html: string;
  sfx?: SoundName;
  levelUps?: { heroId: string; level: number }[]; // héros mis en avant dans le groupe pendant cette page
}
export type Page = string | PageObject;

export interface Stats {
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  mag: number;
  res: number;
  spd: number;
}
export type StatName = keyof Stats;

// Squelette d'un sprite pour ses animations en code (MAE-30, src/ui/sprite-motion.ts), en pixels de sprite.
// La taille sépare le haut du corps (qui respire, se penche, se lève) du bas (qui ne bouge pas ; un ennemi vaincu s'y affaisse).
export interface SpriteRig {
  waist: number;   // première rangée du bas du corps, depuis le haut du PNG
  breath: number;  // période de la respiration, en secondes
  phase: number;   // décalage de la respiration (0 à 1), pour que les personnages ne respirent pas ensemble
  poses?: Partial<Record<DrawnPoseName, DrawnPose>>; // poses dessinées : à genoux, au sol, flanche (MAE-94)
}

// Poses dessinées d'un héros (MAE-94) : flanche (pendant la chute), à genoux (en danger), au sol (K.O.)
export type DrawnPoseName = "stagger" | "kneel" | "down";

// Une pose dessinée : son PNG, centré sur le PNG debout, le bas sur la même rangée (il peut être plus large ou moins haut)
export interface DrawnPose {
  image: string;
  waist: number;   // première rangée du bas du corps dans cette image (respiration à genoux)
}

export interface HeroDef {
  id: string;
  name: string;
  job: string;
  image: string;
  command: string;
  stats: Stats;
  growth: Stats;
  spells: Record<number, SpellId[]>;
  embers?: [number, number][]; // points de départ des braises animées, en pixels de sprite (x, y)
  rig: SpriteRig;              // squelette des animations en code (MAE-30)
  feminine?: boolean;          // accord de « prêt » et « tombé » dans le groupe
}

export type ElementName = "fire" | "ice" | "thunder";
// Nom de l'élément affiché au joueur (liste des techniques)
export const ELEMENT_NAMES: Record<ElementName, string> = { fire: "Feu", ice: "Glace", thunder: "Foudre" };
export type Affinity = "weak" | "resist" | "absorb";
export type TargetType = "foe" | "all-foes" | "ally" | "all-allies" | "ko-ally" | "none";

interface AbilityBase {
  name: string;
  target: TargetType;
  mp?: number;
  element?: ElementName;
  desc?: string;
  visual?: "ash"; // effet spécial dessiné en plus de celui de l'élément (MAE-95) : la Nuée de cendre du Dragon
}
export interface PhysicalAbility extends AbilityBase { kind: "physical"; power: number; pierce?: boolean }
export interface MagicAbility    extends AbilityBase { kind: "magic"; power: number; element: ElementName }
export interface HealSpell       extends AbilityBase { kind: "heal"; power: number }
export interface HealItem        extends AbilityBase { kind: "heal"; amount: number }
export interface MpAbility       extends AbilityBase { kind: "mp"; amount: number }
export interface ReviveAbility   extends AbilityBase { kind: "revive" }
export interface RunAbility      extends AbilityBase { kind: "run" }
export type HealAbility = HealSpell | HealItem;
export type Ability = PhysicalAbility | MagicAbility | HealAbility | MpAbility | ReviveAbility | RunAbility;

type Spell = Ability & { mp: number; desc: string };
type Item = Ability & { desc: string };

// Réplique d'un personnage dans un dialogue
const say = (name: string, text: string) => `<span class="speaker">${name} :</span> ${text}`;

// Fragment de mémoire révélé par le blason de Maelor : une page à part, avec son propre son
const memory = (html: string): PageObject => ({ html: `<span class="memory">${html}</span>`, sfx: "memory" });

// — Héros —
// stats : valeurs au niveau 1 · growth : gain à chaque niveau · spells : souffles appris par niveau

// Poses dessinées d'un héros (MAE-94) : images/<id>-stagger.png, -kneel.png, -down.png, réduites dans le labo
// (tools/reduce-poses.mjs). waist : rangée de la taille dans chaque image, relevée à l'œil le 09/11/2026 sur les PNG
// agrandis et quadrillés : la ceinture, ou le haut des cuisses à genoux (la respiration et le recul d'un coup reçu
// déplacent ce qui est au-dessus) ; au sol, 0 (rien ne respire ni ne se penche)
function drawnPoses(id: string, waist: { stagger: number; kneel: number }): Record<DrawnPoseName, DrawnPose> {
  return {
    stagger: { image: `images/${id}-stagger.png`, waist: waist.stagger },
    kneel: { image: `images/${id}-kneel.png`, waist: waist.kneel },
    down: { image: `images/${id}-down.png`, waist: 0 },
  };
}

export const HEROES: HeroDef[] = [
  {
    id: "maelor", name: "Maelor", job: "Chevalier déchu", image: "images/maelor.png",
    rig: { waist: 36, breath: 2.8, phase: 0, poses: drawnPoses("maelor", { stagger: 38, kneel: 43 }) },
    command: "Gestes",
    stats:  { maxHp: 160, maxMp: 18, atk: 18, def: 10, mag: 6,  res: 6,  spd: 9  },
    growth: { maxHp: 22,  maxMp: 2,  atk: 3,  def: 2,  mag: 1,  res: 1,  spd: 1  },
    spells: { 1: ["fallenBlade"], 3: ["whirlwind"] },
  },
  {
    id: "corvin", name: "Corvin", job: "Veilleur", image: "images/corvin.png",
    rig: { waist: 36, breath: 3.1, phase: 0.2, poses: drawnPoses("corvin", { stagger: 37, kneel: 46 }) },
    command: "Lanterne",
    stats:  { maxHp: 95,  maxMp: 40, atk: 8,  def: 5,  mag: 18, res: 12, spd: 11 },
    growth: { maxHp: 12,  maxMp: 6,  atk: 1,  def: 1,  mag: 3,  res: 2,  spd: 1  },
    spells: { 1: ["fire", "ice"], 2: ["thunder"], 4: ["blaze"] },
  },
  {
    id: "elwen", name: "Elwen", job: "Source", image: "images/elwen.png",
    rig: { waist: 36, breath: 3.4, phase: 0.55, poses: drawnPoses("elwen", { stagger: 38, kneel: 47 }) },
    command: "Source",
    feminine: true,
    // bords enflammés du drapé
    embers: [[34, 41], [36, 46], [32, 55], [9, 42], [8, 47], [10, 52]],
    stats:  { maxHp: 110, maxMp: 44, atk: 9,  def: 6,  mag: 15, res: 14, spd: 10 },
    growth: { maxHp: 15,  maxMp: 6,  atk: 1,  def: 1,  mag: 2,  res: 2,  spd: 1  },
    spells: { 1: ["cure"], 3: ["life"], 4: ["curePlus"] },
  },
];

// — Capacités —
// kind   : "physical" | "magic" | "heal" | "mp" | "revive" | "run"
// target : "foe" | "all-foes" | "ally" | "all-allies" | "ko-ally" | "none"

export const ATTACK: PhysicalAbility = { name: "Frapper", kind: "physical", power: 1, target: "foe" };
export const RUN: RunAbility         = { name: "Repli",   kind: "run", target: "none" };

// Aide des commandes du menu de combat, dans la bande sur ordinateur (MAE-89), par nom de commande. Textes validés par
// Wesley le 08/11/2026. Règles : Garde (CONFIG.damage.defendMultiplier, coups physiques seulement), Repli
// (CONFIG.run.successChance, canRun), objet retiré au choix (battle.ts). Histoire : docs/lore.md (grand-père de Maelor,
// maître de Corvin) et les fiches de personnages (projet claude.ai « RPG », MAE-55 : la lanterne du maître, la lumière
// qu'Elwen fait naître dans ses mains)
export const COMMAND_HELP: Record<string, string> = {
  Frapper:  "Une attaque simple sur un ennemi, sans coût en PS.",
  Gestes:   "Les gestes de combat que son grand-père lui a appris. Ils coûtent des PS.",
  Lanterne: "Les énergies que canalise la lanterne de son maître. Elles coûtent des PS.",
  Source:   "La lumière qu'Elwen fait naître dans ses mains : soigner un allié ou tout le groupe, ranimer un allié éteint. Elle coûte des PS.",
  Besace:   "Les objets du groupe. Un objet utilisé est perdu.",
  Garde:    "Se protéger jusqu'à son prochain tour : les coups d'arme reçus font moitié moins mal.",
  Repli:    "Tenter de fuir le combat. Le repli peut échouer, et certains combats l'interdisent.",
};

export const SPELLS = {
  // Noms de la langue de l'Ordre (Maelor), des mots de métier des Veilleurs (Corvin), de la langue des immortels
  // (Elwen) : docs/lexique.md
  fallenBlade: { name: "Vordrak",      mp: 6,  kind: "physical", power: 2, pierce: true, target: "foe",
                 desc: "« Côte à côte » : frappe double qui ignore la défense." },
  whirlwind:   { name: "Édrag",        mp: 10, kind: "physical", power: 1.2, target: "all-foes",
                 desc: "« La garde » : balaie tous les ennemis." },
  fire:        { name: "Mèche",        mp: 4,  kind: "magic", power: 28, element: "fire",    target: "foe",
                 desc: "Flammes sur un ennemi." },
  ice:         { name: "Nuit blanche", mp: 4,  kind: "magic", power: 28, element: "ice",     target: "foe",
                 desc: "Givre sur un ennemi." },
  thunder:     { name: "Tocsin",       mp: 5,  kind: "magic", power: 34, element: "thunder", target: "foe",
                 desc: "Éclair sur un ennemi." },
  blaze:       { name: "Soufre",       mp: 12, kind: "magic", power: 30, element: "fire",    target: "all-foes",
                 desc: "Flammes sur tous les ennemis." },
  cure:        { name: "Nios",         mp: 5,  kind: "heal", power: 40, target: "ally",
                 desc: "« Soin » : rend des PV à un allié." },
  curePlus:    { name: "Aurésor",      mp: 14, kind: "heal", power: 30, target: "all-allies",
                 desc: "« Rosée d'or » : rend des PV à tout le groupe." },
  life:        { name: "Liéver",       mp: 12, kind: "revive", target: "ko-ally",
                 desc: "« Réveil » : ranime un allié éteint." },
} satisfies Record<string, Spell>;
export type SpellId = keyof typeof SPELLS;

export const ITEMS = {
  potion:  { name: "Sève",            kind: "heal",   amount: 100, target: "ally",    desc: "Rend 100 PV." },
  ether:   { name: "Encens",          kind: "mp",     amount: 30,  target: "ally",    desc: "Rend 30 PS." },
  phoenix: { name: "Larme dorée",     kind: "revive",              target: "ko-ally", desc: "Ranime un allié éteint." },
} satisfies Record<string, Item>;
export type ItemId = keyof typeof ITEMS;

export const ENEMY_SKILLS = {
  chains:     { name: "Chaînes",          kind: "physical", power: 1.6, target: "foe" }, // Gau-Tik
  pillar:     { name: "Pilier",           kind: "physical", power: 1.6, target: "foe" }, // Painkush, même effet
  ashCloud:   { name: "Nuée de cendre",   kind: "magic", power: 34, element: "fire", target: "all-foes", visual: "ash" },
  echoBlade:  { name: "Kardrov",          kind: "physical", power: 2, pierce: true, target: "foe" }, // Vordrak à l'envers : la technique de Maelor, en miroir
} satisfies Record<string, Ability>;
export type EnemySkillId = keyof typeof ENEMY_SKILLS;
export type EnemyAction = "attack" | EnemySkillId;

// — Ennemis —
// elements : "weak" | "resist" | "absorb" · skills : capacités tirées au hasard
// pattern  : suite d'actions jouées en boucle · rage : nouveau pattern sous un seuil de PV
// spareable : vaincu, il reste à terre et le joueur décide de son sort (DRAGON_FATE)

export interface EnemyDef {
  name: string;
  image: string;
  canvasWidth: number;  // largeur de la toile du PNG, en pixels de sprite (affichée ×3 sur ordinateur, ×1 sur mobile)
  canvasHeight: number; // hauteur de la toile du PNG, en pixels de sprite (sert à garder le sprite entier dans la scène)
  maxHp: number;
  atk: number;
  def: number;
  mag: number;
  res: number;
  spd: number;
  xp: number;
  gil: number;
  drop?: { item: ItemId; chance: number };
  elements?: Partial<Record<ElementName, Affinity>>;
  skills?: { skill: EnemySkillId; chance: number }[];
  pattern?: EnemyAction[];
  rage?: { threshold: number; pattern: EnemyAction[]; message: string };
  boss?: boolean;
  spareable?: boolean;
  rig: SpriteRig;       // squelette des animations en code (MAE-30)
  mouth?: { x: number; y: number }; // gueule, en pixels du PNG : d'où part la Nuée de cendre (MAE-95)
}

export const ENEMIES = {
  sankri: {
    name: "Sankri", image: "images/sankri.png", canvasWidth: 77, canvasHeight: 74,
    rig: { waist: 48, breath: 3.8, phase: 0 }, // sous la lance, qui suit le haut du corps
    maxHp: 70, atk: 14, def: 4, mag: 0, res: 4, spd: 12,
    xp: 18, gil: 25, drop: { item: "potion", chance: 0.4 },
  },
  hesium: {
    name: "Hésium", image: "images/hesium.png", canvasWidth: 57, canvasHeight: 68,
    rig: { waist: 37, breath: 4.1, phase: 0 },
    maxHp: 110, atk: 17, def: 8, mag: 0, res: 6, spd: 8,
    xp: 26, gil: 40, drop: { item: "ether", chance: 0.25 },
  },
  gautik: {
    name: "Gau-Tik", image: "images/gautik.png", canvasWidth: 43, canvasHeight: 78,
    rig: { waist: 43, breath: 3.5, phase: 0 },
    maxHp: 260, atk: 24, def: 10, mag: 0, res: 4, spd: 6,
    elements: { thunder: "weak" },
    skills: [{ skill: "chains", chance: 0.3 }],
    xp: 55, gil: 90, drop: { item: "potion", chance: 0.6 },
  },
  painkush: {
    name: "Painkush", image: "images/painkush.png", canvasWidth: 75, canvasHeight: 80,
    rig: { waist: 44, breath: 4.0, phase: 0 },
    maxHp: 320, atk: 26, def: 12, mag: 0, res: 5, spd: 7,
    skills: [{ skill: "pillar", chance: 0.35 }],
    xp: 70, gil: 110, drop: { item: "ether", chance: 0.5 },
  },
  // L'écho de Maelor (MAE-70) : une épreuve, pas une proie. Ni XP ni Couronnes ; il laisse une Larme dorée.
  maelorEcho: {
    name: "Écho de Maelor", image: "images/maelor-echo.png", canvasWidth: 47, canvasHeight: 66,
    rig: { waist: 36, breath: 2.8, phase: 0 },
    maxHp: 420, atk: 26, def: 14, mag: 0, res: 8, spd: 12,
    skills: [{ skill: "echoBlade", chance: 0.33 }],
    xp: 0, gil: 0, drop: { item: "phoenix", chance: 1 },
  },
  vahn: {
    name: "Le Dragon", image: "images/vahn.png", canvasWidth: 142, canvasHeight: 88, boss: true, spareable: true,
    rig: { waist: 48, breath: 4.4, phase: 0 },
    mouth: { x: 2, y: 25 }, // entre les mâchoires, au bout du museau (le Dragon regarde vers la gauche)
    maxHp: 1800, atk: 30, def: 14, mag: 26, res: 12, spd: 10,
    elements: { ice: "weak", fire: "absorb" },
    pattern: ["attack", "attack", "ashCloud"],
    rage: { threshold: 0.5, pattern: ["ashCloud", "attack"], message: "Le Dragon entre en fureur !" },
    xp: 300, gil: 1000, drop: { item: "phoenix", chance: 1 },
  },
} satisfies Record<string, EnemyDef>;
export type EnemyId = keyof typeof ENEMIES;

// — Histoire —
// Chaque page de dialogue est un bloc de texte (HTML simple autorisé).
// Le monde ne connaît l'Ordre que sous le nom d'« Ordre Déchu » ; son vrai nom n'apparaît que dans
// les fragments du blason, de plus en plus lisible, et ne se complète que si le Dragon est épargné.

export const PROLOGUE: Page[] = [
  "Dans ces terres, on se bat depuis si longtemps que plus personne ne sait pourquoi. L'origine des guerres s'est effacée des mémoires, puis des livres. Il ne reste que les guerres.<br><br>" +
  "Tout ce qui vit porte le Souffle, une énergie qui relie les arbres, les os et les êtres, et que seuls quelques-uns savent sentir.<br><br>" +
  "Il y a trente ans, un ordre de chevaliers fut accusé de sorcellerie et exécuté sans procès. Son nom disparut avec lui. Le monde ne l'appelle plus que <strong>l'Ordre Déchu</strong>.",

  "Maelor porte au cou un blason aux armes de cet ordre. Son grand-père était l'un de ses chevaliers, l'un des rares à survivre à la chute. Mais l'oubli l'a pris comme les autres, et le blason ne lui disait plus rien ; il l'a transmis au père de Maelor, qui n'a jamais su qu'en faire.<br><br>" +
  "Chez Maelor, le blason s'est éveillé. Il est né avec des cheveux couleur de cendre et une affinité pour les dragons, un don qu'il croit tenu du hasard, comme d'autres naissent gauchers. Près de certains lieux, le blason se réchauffe et lui montre des souvenirs qui ne sont pas les siens.",

  "Personne n'a appelé Maelor dans le Val Ténébreux. Il n'y cherche ni trésor ni vengeance. Il cherche un sens : pourquoi l'Ordre est tombé, pourquoi on se bat encore, pourquoi le monde oublie tout sans que personne s'en soucie.<br><br>" +
  "Sa colère n'a pas de visage. Elle vise l'indifférence.<br><br>" +
  say("Maelor", "Je ne suis pas celui qu'on attendait. Personne ne m'a choisi. J'ai choisi de venir."),

  "Il ne marche pas seul.<br><br>" +
  "<strong>Corvin</strong>, veilleur au regard de nuit. Il sent le Souffle faiblir sans savoir pourquoi ; le blason de Maelor est sa meilleure piste.",

  "Son maître mêlait le soufre au Souffle. Un soir, une impulsion a tout fait exploser, et le Souffle libéré a gagné le village voisin, troublant les regards. Quand le maître est sorti des décombres, couvert de soufre, les villageois n'ont pas vu un homme : ils ont vu un monstre. Fous de terreur, ils l'ont brûlé, sans procès. Puis le Souffle s'est dissipé, et plus personne ne se souvient de rien.<br><br>" +
  "Il a gardé de son maître sa lanterne, et une colère qui n'a personne à frapper. Il en veut à un monde qui juge vite, détruit vite, et oublie plus vite encore.",

  "<strong>Elwen</strong>, que l'on dit Source. Son temple enseignait que la guérison se mérite, et qu'on ne la donne pas aux condamnés. Elle en a soigné quand même, ceux qu'on avait abandonnés. On l'a chassée.<br><br>" +
  "Qui peut juger avec certitude, dans un monde qui a oublié jusqu'à l'origine de ses propres guerres ? Elwen croit que chaque vie peut être sauvée. Même celle qu'on a déjà jugée perdue.",
];

// Musiques d'ambiance (MAE-12) : fichiers de public/audio/, crédits dans CREDITS.md
export const MUSIC = {
  title:    "title-death-is-just-another-path.mp3", // écran titre, prologue, épilogue
  lisiere:  "ch1-the-secret-within-the-woods.mp3",
  echoes:   "ch2-past-the-edge.mp3",
  bridge:   "ch3-spiritwatcher.mp3",
  heart:    "ch4-elegy.mp3",                      // aussi pendant le combat contre l'écho
  bareRock: "ch5-just-dust-remains.mp3",
  well:     "ch6-ossuary-5-rest.mp3",
  dragon:   "dragon-lost-time.mp3",               // antre et combat contre le Dragon
  battle:   "battle-unholy-knight.mp3",           // combats ordinaires
} as const;
export type MusicId = keyof typeof MUSIC;

interface ChapterBase {
  title: string;
  tint: string;
  story: Page[];
  music: MusicId; // pendant les pages du chapitre, et après la victoire
  decor?: DecorId; // décor peint en 2,5D (MAE-28) ; les chapitres sans image prête n'en déclarent pas encore
}
// Chapitre de repos : PV et PS restaurés, pas de combat
export interface RestChapter extends ChapterBase {
  rest: true;
}
export interface BattleChapter extends ChapterBase {
  rest?: never;
  enemies: EnemyId[];
  boss?: boolean;
  canRun?: boolean;
  introMessage?: string; // message d'entrée propre au combat, à la place du message par défaut
  battleMusic?: MusicId; // musique du combat, « battle » par défaut
  // Trêve : le combat s'arrête après afterActions actions (héros et ennemis), ou dès qu'un ennemi tombe ;
  // aucun ennemi ne meurt, et story se joue avant les récompenses
  truce?: { afterActions: number; story: Page[] };
  // Reddition : les ennemis vaincus mettent un genou à terre au lieu de mourir ; surrender se joue avant « Victoire ! »
  surrender?: Page[];
  // Pages jouées après une victoire ordinaire (les ennemis meurent), avant le choix du pouvoir et les récompenses
  afterVictory?: Page[];
  // Choix du pouvoir du Cœur (POWER_CHOICE), posé après la victoire et la reddition, avant les récompenses
  powerChoice?: true;
}
export type Chapter = RestChapter | BattleChapter;

export const CHAPTERS: Chapter[] = [
  {
    title: "I · La Lisière",
    tint: "rgba(8, 18, 40, 0.30)",
    music: "lisiere",
    decor: "lisiere",
    story: [
      "Aux abords du Val, les arbres se referment comme des doigts. Puis certains bougent. Des silhouettes massives se détachent des troncs : une peau d'écorce, des veines de braise sous la mousse, une lance noircie au feu.<br><br>" +
      say("Corvin", "Des Sankri. Ils ne prennent que le Souffle des arbres mourants, et ils défendent les vivants. Pour eux, tout ce qui entre dans la Lisière est une menace.") + "<br>" +
      say("Maelor", "Nous ne faisons que passer.") + "<br>" +
      say("Elwen", "Ils ne le savent pas."),
    ],
    enemies: ["sankri", "sankri"],
  },
  {
    title: "II · Le Champ des Échos",
    tint: "rgba(20, 40, 50, 0.45)",
    music: "echoes",
    canRun: false, // se replier sauterait la trêve et l'alliance
    story: [
      "Au-delà des bois s'étend un champ de terre retournée, semé de pierres levées. Pas une croix, pas un nom : sur chaque tombe, des os taillés avec soin.<br><br>" +
      say("Corvin", "Au village, on dit que les squelettes déterrent les morts pour les manger.") + "<br>" +
      say("Elwen", "On dit beaucoup de choses, au village.") + "<br><br>" +
      "Contre la poitrine de Maelor, le blason se met à brûler.",

      memory(
        "Des chevaliers à genoux dans la boue, les mains liées. On arrache leur bannière : un dragon d'argent sur fond noir.<br>" +
        "Une voix crie « sorcellerie ». D'autres reprennent le mot sans savoir d'où il vient.<br>" +
        "Derrière eux, un Tyrdrak gît, immobile, une aile encore ouverte au-dessus des chevaliers.<br>" +
        "Un chevalier lève les yeux vers le ciel vide : « Les autres Tyrdrak ne viendront pas. Plus maintenant. »<br><br>" +
        "Le nom qu'on efface ce jour-là tremble sur le blason : <strong>R····r D······s</strong>."),

      "Maelor rouvre les yeux. La boue du souvenir, c'est cette terre. Au milieu du champ, un tertre plus haut que les autres.<br><br>" +
      "Quand Maelor et Elwen s'en approchent, le sol s'éclaire. Des échos de lumière dorée montent de la terre, d'une tombe à l'autre.",

      "Entre les pierres levées, des silhouettes se dressent : des os sculptés sur la peau, des masques taillés dans des crânes, une faux à la main. " +
      "La lumière les frappe : ils portent les mains à leur masque, comme sous un coup. Puis ils se tournent vers les étrangers qui l'ont réveillée.<br><br>" +
      say("Hésium", "Éloignez-vous de nos morts !"),
    ],
    enemies: ["hesium", "hesium"],
    introMessage: "Les Hésiums défendent leurs morts !",
    truce: {
      afterActions: 6,
      story: [
        "Corvin baisse sa lanterne et s'avance entre les deux camps, les mains ouvertes.<br><br>" +
        say("Corvin", "Arrêtez ! Je le sens aussi : le Souffle de vos morts se réveille. Nous ne le prenons pas. C'est lui qui nous reconnaît."),

        "Les faux s'abaissent. Le plus âgé des Hésiums pose la main sur le tertre, puis regarde longtemps Maelor.<br><br>" +
        say("Hésium", "Ses os n'avaient plus parlé depuis trente ans. Les os gardent un peu de la mémoire de ceux qu'ils portaient. Celui-ci se souvient de quelque chose, en toi."),

        say("Maelor", "Qui repose ici ?") + "<br>" +
        say("Hésium", "Un Tyrdrak. Il est tombé avec des hommes que personne n'est venu pleurer. Nous les avons gardés ensemble.") + "<br><br>" +
        "Elwen détourne les yeux, sans un mot.",

        "Ce soir-là, le groupe partage le feu des Hésiums, et personne ne juge personne.<br><br>" +
        say("Corvin", "On les appelle squelettes. Ils ont mieux gardé nos morts que nous.") + "<br><br>" +
        "<em>Les Hésiums sont désormais vos alliés.</em>",
      ],
    },
  },
  {
    title: "III · Le Pont de Pierre-Noire",
    tint: "rgba(30, 20, 50, 0.40)",
    music: "bridge",
    story: [
      "Un pont de pierre noire enjambe un gouffre sans fond. La pierre est lisse et tiède, sans un joint : aucun outil n'y a laissé de trace. Ses chaînes ont été arrachées. Au milieu, deux silhouettes immenses barrent le passage, les chaînes enroulées autour des bras, le visage caché derrière un voile que le vent ne soulève pas.<br><br>" +
      say("Corvin", "Des Gau-Tik. Je ne sens rien en eux, pas la moindre trace de Souffle.") + "<br>" +
      say("Elwen", "Ils gardent ce qui se trouve de l'autre côté. Ils ne nous laisseront pas passer sans se battre.") + "<br>" +
      say("Corvin", "Alors frappons fort. La foudre fait trembler jusqu'à la pierre."),
    ],
    enemies: ["gautik", "gautik"],
    introMessage: "Les Gau-Tik barrent le pont !",
    surrender: [
      "Les Gau-Tik mettent un genou à terre. Le plus grand relève la tête, et son regard s'arrête sur les cheveux de Maelor. Longtemps.<br><br>" +
      "Puis il se lève et s'écarte, et l'autre fait de même. Le passage est libre.<br><br>" +
      say("Maelor", "Pourquoi nous laissent-ils passer ?") + "<br>" +
      say("Elwen", "Parce qu'ils ont vu ce qu'ils attendaient."),
    ],
  },
  {
    title: "IV · Le Cœur d'Aure-Hin",
    tint: "rgba(70, 55, 10, 0.30)",
    music: "heart",
    battleMusic: "heart", // un duel solennel contre soi-même, pas un combat ordinaire (Wesley, 03/11/2026)
    canRun: false, // se replier sauterait le choix du pouvoir
    story: [
      "De l'autre côté du pont, le chemin descend entre deux parois de pierre noire, lisses comme le pont. Puis la roche s'ouvre sur une vallée ronde. L'air y vibre. Au milieu, une lumière dorée bat lentement, comme un cœur.<br><br>" +
      say("Corvin", "Je n'ai jamais senti autant de Souffle au même endroit. Comme si le monde entier respirait ici."),

      "Plus le groupe approche, plus la lumière s'avive. Elle ne touche pas Maelor : elle le cherche. Ses cheveux cendrés s'éclairent ; sous sa peau, ses veines brillent d'or.<br><br>" +
      say("Maelor", "Qu'est-ce qui m'arrive ?") + "<br>" +
      say("Elwen", "Rien qui ne soit déjà en toi."),

      "Elwen s'avance dans la lumière. Le rose de ses cheveux brûle plus fort que jamais ; le Souffle tourne autour d'elle comme autour d'une vieille amie.<br><br>" +
      say("Elwen", "Je ne devrais pas vous le dire. Ceux de mon espèce regardent, ils n'interviennent pas. Mais vous avez fait trop de chemin pour repartir sans savoir."),

      say("Elwen", "Je suis née du Souffle. Les hommes nous appellent les immortels, et nous croient morts depuis longtemps. Nous ne le sommes pas.") + "<br>" +
      say("Corvin", "C'est pour ça que tes soins ne ressemblent à aucun autre."),

      say("Elwen", "Et toi, Maelor, ton sang est doré. Tu descends d'un peuple qui vivait bien plus longtemps que les hommes, si proche du Souffle qu'il a été le premier à être oublié. Le monde ne sait plus qu'il a existé. Ta famille non plus.") + "<br>" +
      say("Maelor", "Mon affinité avec les dragons... ce n'était pas un hasard.") + "<br>" +
      say("Elwen", "Non. Je cherchais l'un des tiens depuis longtemps."),

      say("Corvin", "Et le Souffle ? Je le sens faiblir partout, depuis des années.") + "<br>" +
      say("Elwen", "Il respire, Corvin. Il s'emplit, puis il se retire. Nous sommes à la fin d'un très long souffle : le monde oublie parce que le Souffle s'en va.") + "<br>" +
      say("Elwen", "Le reste, je n'ai pas le droit de le dire."),

      "La lumière se resserre devant Maelor et prend une forme : la sienne. Même armure, même épée, même posture. Mais tout en lui est d'or, et il sourit d'un sourire que Maelor ne se connaît pas.<br><br>" +
      say("Écho de Maelor", "Voilà ce que tu pourrais être. Plus personne ne te fera tomber.") + "<br>" +
      say("Elwen", "Ce n'est pas un ennemi, Maelor. C'est un choix qui a pris corps."),
    ],
    enemies: ["maelorEcho"],
    introMessage: "L'écho de Maelor lève son épée !",
    // Vaincu, l'écho disparaît (il se défait en lumière) ; puis le pouvoir du Cœur est offert
    afterVictory: [
      "L'écho recule, mais ne tombe pas. Il se défait en lumière, et cette lumière reste là, devant Maelor, tiède, offerte : le pouvoir du Cœur.<br><br>" +
      say("Écho de Maelor", "Prends-moi. Plus jamais tu ne seras faible. Plus jamais tu n'oublieras."),

      say("Corvin", "Avec ça, on pourrait affronter n'importe quoi. Même la bête du Val.") + "<br>" +
      say("Elwen", "Ce que tu prends au Cœur, tu le prends au monde. Je ne peux pas choisir pour toi."),
    ],
    powerChoice: true,
  },
  {
    title: "V · La Pierre Nue",
    tint: "rgba(60, 40, 20, 0.35)",
    music: "bareRock",
    story: [
      "Le groupe quitte la vallée par l'autre versant. Derrière eux, la lumière du Cœur bat encore, de plus en plus lointaine. Puis les parois de pierre noire s'abaissent et s'ouvrent sur une plaine de roche grise, polie par le vent. Pas un arbre, pas une herbe. Au loin, des murs taillés d'un seul bloc barrent l'horizon, trop droits pour être l'œuvre du hasard.<br><br>" +
      say("Corvin", "La Pierre Nue. Les Painkush n'y laissent entrer personne. On dit qu'ils forgent un métal que rien ne raye."),

      "Au milieu du passage se tient une silhouette massive et cornue, un pilier de pierre sculpté posé sur l'épaule. Elle ne charge pas. Elle attend. Ses naseaux rougeoient.<br><br>" +
      say("Elwen", "Ce n'est pas une bête. Il garde sa terre, comme nous garderions la nôtre.") + "<br>" +
      say("Maelor", "Nous ne voulons rien lui prendre. Mais notre route passe de l'autre côté.") + "<br>" +
      say("Corvin", "Ni feu ni foudre n'y feront rien. Il faudra tenir."),
    ],
    enemies: ["painkush"],
    introMessage: "Un Painkush barre la route !",
  },
  {
    title: "VI · Le Puits des Anciens",
    tint: "rgba(20, 60, 70, 0.30)",
    music: "well",
    rest: true,
    story: [
      { html: "Au milieu de la roche nue, là où plus rien ne pousse, se dresse un vieux puits de pierre. Autour de la margelle, un peu d'herbe et un arbre tordu : un îlot de vie dans ce désert de pierre. Au fond, une eau brille d'une lueur pâle. Ses eaux referment les plaies et rendent l'éclat aux esprits las.<br><br>" +
              "<em>Les PV et les PS du groupe sont entièrement restaurés.</em>", sfx: "heal" },

      "Sur les pierres de la margelle, des empreintes de griffes côtoient des empreintes de mains, gravées ensemble dans la roche.<br><br>" +
      "Le blason se réchauffe.",

      memory(
        "Un Tyrdrak se penche sur le puits. Un chevalier sans armure pose la main sur ses écailles.<br>" +
        "Ils ne se parlent pas avec des mots. L'homme sent ce que sent le Tyrdrak, le Tyrdrak sait ce que pense l'homme. Comment ? Le souvenir ne le dit pas.<br>" +
        "« Nous ne les commandons pas. Nous marchons à côté d'eux, pour que les hommes et les Tyrdrak ne s'oublient jamais. »<br><br>" +
        "Sur le blason, le nom se précise : <strong>Ré·r·r Dra··n·s</strong>."),

      say("Maelor", "Ils ne domptaient pas les dragons. Ils marchaient avec eux.") + "<br>" +
      say("Corvin", "Alors pourquoi tout le monde raconte l'inverse ?"),
    ],
  },
  {
    title: "VII · L'Antre du Dragon",
    tint: "rgba(70, 12, 5, 0.45)",
    music: "dragon",
    battleMusic: "dragon", // Lost Time dès les pages de l'antre, jusqu'au combat
    boss: true,
    canRun: false,
    story: [
      "La grotte est tiède. Sous la cendre, des braises mourantes rougeoient encore, comme un feu qu'on n'a plus la force d'entretenir. Sur un lit d'ossements et de blasons brisés repose la bête qui, dit-on, a dévoré l'Ordre. Au village, on la dit folle.<br><br>" +
      "À l'écart des débris, un seul blason est intact. Usé, poli, comme si on l'avait tenu chaque jour pendant trente ans. Le blason de Maelor s'embrase.",

      memory(
        "Le même Tyrdrak, plus jeune. Un chevalier dort contre son flanc, ce blason intact sur la poitrine. Ils sont amis.<br>" +
        "Puis des torches, des cris, une flèche. Le chevalier ne se relève pas. Personne ne sait plus qui a tiré le premier.<br>" +
        "Depuis, le Tyrdrak croit tous les hommes hostiles, et les hommes le croient fou. Il a gardé le blason de son ami. Il attend quelqu'un qui l'aide à se souvenir.<br><br>" +
        "Le nom, presque entier : <strong>Rédr·r Drakun·s</strong>."),

      "Le Dragon ouvre les yeux. Ses écailles tombent par plaques ; sur celles qui restent, des signes gravés à la griffe, encore et encore, comme pour ne pas oublier. Il ne voit que des humains armés dans son antre, comme il y a trente ans.<br><br>" +
      say("Maelor", "Il n'est pas fou. Il croit qu'on vient le tuer.") + "<br>" +
      say("Elwen", "Son feu s'est éteint, il ne crache plus que de la cendre. Garde tes flammes, Corvin : elles le nourrissent. La glace, peut-être..."),
    ],
    enemies: ["vahn"],
  },
];

// — Le pouvoir du Cœur d'Aure-Hin —
// Choix posé après la victoire d'un chapitre marqué powerChoice (MAE-73 : chapitre IV) ; textes de MAE-71

// refused : refusé · taken : pris (bonus de combat) · returned : rendu face au Dragon · kept : gardé face au Dragon
export type PowerState = "refused" | "taken" | "returned" | "kept";
export type PowerChoiceId = "take" | "refuse";

export const POWER_CHOICE: { question: string } & Record<PowerChoiceId, { label: string; scene: Page[] }> = {
  question: "Maelor tend la main vers la lumière.",
  take: {
    label: "Prendre le pouvoir",
    scene: [
      "Maelor referme la main. La lumière entre en lui d'un coup, brûlante, et ne repart pas. Il ne s'est jamais senti aussi fort. Autour de lui, la vallée pâlit un peu.<br><br>" +
      say("Corvin", "Tu as l'air... différent.") + "<br><br>" +
      "Elwen ne dit rien. Elle détourne les yeux.<br><br>" +
      "<em>Le groupe est plus fort au combat.</em>",
    ],
  },
  refuse: {
    label: "Refuser",
    scene: [
      "Maelor laisse retomber sa main. La lumière hésite, puis retourne au Cœur, qui bat un peu plus fort.<br><br>" +
      say("Maelor", "Je ne suis pas venu prendre. Je suis venu comprendre.") + "<br><br>" +
      "Elwen sourit, pour la première fois depuis longtemps.",
    ],
  },
};

// — Fin : le sort du Dragon —
// Pouvoir refusé (ou jamais proposé) : question, puis Épargner · Achever.
// Pouvoir pris : powerQuestion, puis Rendre le pouvoir (returned, puis Épargner · Achever) ou Garder (kept, Achever seul).
// returned et kept s'affichent comme le texte de la question qui les suit.

export type FateId = "spare" | "kill" | "return" | "keep";

export const DRAGON_FATE: {
  labels: Record<FateId, string>;
  question: string;
  powerQuestion: string;
  returned: string;
  kept: string;
} = {
  labels: { spare: "Épargner", kill: "Achever", return: "Rendre le pouvoir", keep: "Garder le pouvoir" },

  question:
    "Le Dragon s'effondre sur les ossements. Il ne se relève pas. Son souffle n'est plus qu'une braise.<br><br>" +
    "Il regarde Maelor, sans haine. Maelor lève son arme.",

  powerQuestion:
    "Le Dragon s'effondre sur les ossements. Son souffle n'est plus qu'une braise. Il regarde Maelor, puis recule devant l'or qui brûle en lui : il reconnaît le Souffle du Cœur, arraché au monde.<br><br>" +
    say("Elwen", "Tu peux encore le rendre, Maelor."),

  returned:
    "Maelor ouvre les mains. L'or quitte son corps et se répand sur les ossements, sur les blasons brisés, sur les écailles du Dragon. Il ne demande rien en échange. Il se sent plus léger, et plus faible.<br><br>" +
    "Le Dragon cesse de reculer. Il regarde Maelor, sans haine.",

  // Vahn refuse la paix : seule l'option « Achever » reste
  kept:
    "Maelor serre le poing. L'or brûle plus fort. Le Dragon se redresse sur ses pattes tremblantes et rugit : il ne voit plus un ami de l'Ordre, il voit un voleur de Souffle.<br><br>" +
    say("Elwen", "Il ne veut plus de paix. Pas avec ça en toi."),
};

// — Les quatre fins —
// scene : juste après Épargner ou Achever · epilogue : écran « Épilogue », après le dernier chapitre.
// Le nom de Vahn n'apparaît qu'ici, quand la mémoire revient (le combat dit « Le Dragon »).

export type EndingId = "trueEnd" | "redemption" | "thirdEnd" | "falseEnd";

export const ENDINGS: Record<EndingId, { scene: Page[]; epilogue: Page[] }> = {
  // Vraie fin : pouvoir refusé, Dragon épargné. La mémoire revient aux deux, le nom se complète.
  trueEnd: {
    scene: [
      "Maelor baisse son arme. Il pose la main sur le museau tiède du Dragon, comme le chevalier du souvenir.<br><br>" +
      "La bête ne mord pas. Elle ferme les yeux.",

      memory(
        "Le blason s'embrase, et le Dragon tremble avec lui. Les souvenirs reviennent aux deux en même temps, sans trou : les passages gardés à deux, les noms transmis de l'un à l'autre, la promesse de ne jamais s'oublier. Sous ses écailles griffées, les signes qu'il gravait reprennent un sens.<br>" +
        "Ce que l'Ordre était venu faire, Maelor vient de le refaire.<br><br>" +
        "Le nom, enfin entier : <strong>Rédror Drakunis</strong>."),

      "Dans la tête de Maelor, un mot se forme, qui n'est pas le sien. Un nom que le Dragon avait perdu depuis trente ans : Vahn.<br><br>" +
      say("Maelor", "Vahn. Nous n'oublierons plus l'Ordre. Ni toi.") + "<br>" +
      say("Elwen", "Chaque vie peut être sauvée. Même celle-là."),

      "Du bout du museau, Vahn pousse vers Maelor le blason qu'il gardait depuis trente ans.",
    ],
    epilogue: [
      "Vahn quitte son antre pour la première fois depuis trente ans. Ses écailles ne tombent plus : sa mue s'achève enfin. Au-dessus du Val Ténébreux, les villageois lèvent les yeux vers ses ailes et, pour une fois, ne s'enfuient pas.",

      "Dans le Val, les couleurs reviennent, une à une. Corvin le sent avant les autres : le Souffle ne se retire plus. Il revient, lentement, comme une longue inspiration après une longue expiration.<br><br>" +
      say("Elwen", "Le monde respire. Il oublie, puis il se souvient. Cette fois, il avait besoin de quelqu'un pour l'aider à se souvenir."),

      "Maelor porte désormais deux blasons : le sien, et celui du chevalier que Vahn lui a confié. Il était venu chercher un sens. Il repart avec une tâche : garder la mémoire, pour que les hommes et les Tyrdrak ne s'oublient plus.",

      "Le monde parle encore de l'Ordre Déchu. Maelor, lui, connaît son vrai nom, et ce qu'il était venu faire.<br><br>" +
      "<strong>— FIN —</strong>",
    ],
  },

  // Fin rédemption : pouvoir pris puis rendu, Dragon épargné. La mémoire ne revient qu'en partie à Maelor.
  redemption: {
    scene: [
      "Maelor baisse son arme. Il pose la main sur le museau tiède du Dragon, comme le chevalier du souvenir.<br><br>" +
      "La bête hésite longtemps. Puis elle ferme les yeux.",

      memory(
        "Le blason se réchauffe, faiblement. Les souvenirs reviennent au Dragon : les passages gardés à deux, la promesse de ne jamais s'oublier. À Maelor, ils ne reviennent qu'en partie, comme à travers une vitre : l'or qu'il a pris, puis rendu, a laissé une trace.<br><br>" +
        "Le nom, enfin entier : <strong>Rédror Drakunis</strong>."),

      "Un nom se forme dans la tête de Maelor : Vahn.<br><br>" +
      say("Maelor", "Pardonne-moi, Vahn. J'ai failli devenir ce que tu crains.") + "<br>" +
      say("Elwen", "Tu l'as rendu. C'est ce qui compte."),
    ],
    epilogue: [
      "Vahn quitte son antre. Il vole au-dessus du Val, plus bas qu'il ne le voudrait : sa mue ne s'achève pas tout à fait.",

      "Le Souffle revient, plus lentement qu'il n'aurait dû. Corvin le sent, et ne dit rien.<br><br>" +
      say("Elwen", "Le Cœur se remettra. Il lui faudra du temps."),

      "Maelor garde la mémoire, comme l'Ordre avant lui. Mais certaines nuits, il se souvient de l'or dans ses veines, et de combien il était facile de le garder.<br><br>" +
      "<strong>— FIN —</strong>",
    ],
  },

  // Troisième fin : pouvoir gardé, Dragon achevé. Maelor est fort, mais seul.
  thirdEnd: {
    scene: [
      "Maelor achève le Dragon d'un seul coup. C'est facile. Trop facile.<br><br>" +
      "Contre sa poitrine, le blason ne se réchauffe pas. Il est froid depuis que l'or est en lui.",

      say("Maelor", "Personne ne pourra plus jamais me faire tomber.") + "<br><br>" +
      "Corvin et Elwen ne répondent pas.",
    ],
    epilogue: [
      "Parmi les cendres brille le blason intact. Maelor ne se baisse pas pour le ramasser.",

      "Au village, on sonne les cloches : la bête folle est morte, et c'est Maelor qui l'a tuée. On l'acclame. On le craint un peu.",

      "Corvin part le premier, sans un mot. Elwen reste un peu plus longtemps, puis s'en va à son tour. Le Souffle continue de faiblir ; l'or, en Maelor, ne faiblit pas.",

      "Maelor est plus fort que personne avant lui. Il est seul.<br><br>" +
      "<strong>— FIN —</strong>",
    ],
  },

  // Fausse fin : Dragon achevé, pouvoir refusé ou rendu. « Victoire ! » en façade, le nom reste incomplet.
  falseEnd: {
    scene: [
      "Le Dragon s'éteint sans un cri.<br><br>" +
      "Contre la poitrine de Maelor, le blason devient froid. Les souvenirs se taisent, inachevés.<br><br>" +
      say("Maelor", "On a gagné... Alors pourquoi ai-je l'impression d'avoir perdu quelque chose ?"),
    ],
    epilogue: [
      "Parmi les cendres de la bête, Maelor ramasse le blason intact. Ce n'est plus qu'un morceau de métal. Il ne dit rien.",

      "Au village, on sonne les cloches : la bête folle est morte. Pour la première fois depuis trente ans, le ciel du Val Ténébreux est vide.<br><br>" +
      "Le monde parle toujours de l'Ordre Déchu. Son vrai nom reste effacé, et personne ne le cherche.",

      "Maelor avait choisi de venir. Il ne sait plus pourquoi.<br><br>" +
      "<strong>— FIN —</strong>",
    ],
  },
};

// La fin découle des deux choix ; un Dragon jamais décidé (null) compte comme achevé, comme avant MAE-72
export function endingOf(power: PowerState | null, dragonSpared: boolean | null): EndingId {
  if (power === "kept") return "thirdEnd";
  if (!dragonSpared) return "falseEnd";
  return power === "returned" ? "redemption" : "trueEnd";
}

export const GAME_OVER: Page[] = [
  "<em>Le Val Ténébreux referme ses brumes sur le groupe.</em><br><br>" +
  "L'Ordre Déchu retombe dans l'oubli... pour cette fois.",
];

// — État de la partie —

// Format du point de reprise, aussi sauvegardé dans le navigateur (MAE-11, save-game.ts).
// À augmenter si sa forme ou l'ordre des chapitres change : une sauvegarde d'une autre version est ignorée.
const SAVE_VERSION = 1;

// Ce que garde le point de reprise
interface Checkpoint {
  party: Hero[];
  inventory: Record<ItemId, number>;
  gil: number;
  chapterIndex: number;
  power: PowerState | null;
  dragonSpared: boolean | null;
}

interface GameStateStore extends Checkpoint {
  checkpoint: string | null;
  readonly currentChapter: Chapter;
  reset(): void;
  saveCheckpoint(): void;
  loadCheckpoint(): void;
}

export const GameState: GameStateStore = {
  party: [],
  inventory: { potion: 0, ether: 0, phoenix: 0 },
  gil: 0,
  chapterIndex: 0,
  power: null, // pouvoir du Cœur : null tant qu'il n'est pas proposé (PowerState)
  dragonSpared: null, // choix final : true (Épargner), false (Achever), null tant qu'il n'est pas fait
  checkpoint: null, // copie de l'état au début du chapitre, pour « Réessayer »
  get currentChapter() { return CHAPTERS[this.chapterIndex]; },

  reset() {
    this.party = HEROES.map(createHero);
    this.inventory = { ...CONFIG.startingItems };
    this.gil = 0;
    this.chapterIndex = 0;
    this.power = null;
    this.dragonSpared = null;
    this.checkpoint = null;
  },

  saveCheckpoint() {
    const { party, inventory, gil, chapterIndex, power, dragonSpared } = this;
    this.checkpoint = JSON.stringify({ version: SAVE_VERSION, party, inventory, gil, chapterIndex, power, dragonSpared });
  },

  // Une copie absente, illisible ou d'une forme inattendue fait repartir la partie de zéro
  loadCheckpoint() {
    const saved = parseCheckpoint(this.checkpoint);
    if (saved) Object.assign(this, saved);
    else this.reset();
  },
};

// — Lecture du point de reprise —
// JSON.parse ne garantit rien sur la forme de la donnée : chaque champ est vérifié avant d'être repris.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isNumber = (value: unknown): value is number => typeof value === "number";
const isString = (value: unknown): value is string => typeof value === "string";
const isSpellId = (value: unknown): value is SpellId => isString(value) && Object.hasOwn(SPELLS, value);

// Une entrée par état : TypeScript signale celui qui manquerait si CombatState change
const COMBAT_STATES = Object.values({
  charging: "charging", ready: "ready", queued: "queued", ko: "ko",
} satisfies { [K in CombatState]: K });
const isCombatState = (value: unknown): value is CombatState => COMBAT_STATES.some(state => state === value);

const POWER_STATES = Object.values({
  refused: "refused", taken: "taken", returned: "returned", kept: "kept",
} satisfies { [K in PowerState]: K });
const isPowerState = (value: unknown): value is PowerState => POWER_STATES.some(state => state === value);

function parseHero(value: unknown): Hero | null {
  if (!isRecord(value)) return null;
  const {
    id, name, job, image, command, side, level, xp, spells, atb, state, defending,
    maxHp, maxMp, atk, def, mag, res, spd, hp, mp,
  } = value;

  const sheet = HEROES.find(hero => hero.id === id);
  if (!sheet) return null;
  if (!isString(name) || !isString(job) || !isString(image) || !isString(command)) return null;
  if (side !== "hero" || !isCombatState(state) || typeof defending !== "boolean") return null;
  if (!Array.isArray(spells) || !spells.every(isSpellId)) return null;
  if (!isNumber(level) || !isNumber(xp) || !isNumber(atb) || !isNumber(hp) || !isNumber(mp)) return null;
  if (!isNumber(maxHp) || !isNumber(maxMp) || !isNumber(atk) || !isNumber(def)) return null;
  if (!isNumber(mag) || !isNumber(res) || !isNumber(spd)) return null;

  // Nom, métier, image et commande viennent de la fiche du héros, pas de la sauvegarde :
  // une sauvegarde faite avant un renommage ou un nouveau portrait affiche ainsi les valeurs à jour
  return {
    id: sheet.id, name: sheet.name, job: sheet.job, image: sheet.image, command: sheet.command,
    side, level, xp, spells, atb, state, defending,
    maxHp, maxMp, atk, def, mag, res, spd, hp, mp,
  };
}

function parseInventory(value: unknown): Record<ItemId, number> | null {
  if (!isRecord(value)) return null;
  const { potion, ether, phoenix } = value;
  if (!isNumber(potion) || !isNumber(ether) || !isNumber(phoenix)) return null;
  return { potion, ether, phoenix };
}

// Vrai si le point de reprise se relit sans erreur : « Continuer » n'apparaît qu'à cette condition
export const isValidCheckpoint = (json: string | null) => parseCheckpoint(json) !== null;

function parseCheckpoint(json: string | null): Checkpoint | null {
  if (json === null) return null;
  let data: unknown;
  try { data = JSON.parse(json); } catch { return null; }
  if (!isRecord(data)) return null;

  const { version, party, inventory, gil, chapterIndex, power, dragonSpared } = data;
  if (version !== SAVE_VERSION) return null;
  if (!Array.isArray(party)) return null;
  const heroes = party.map(parseHero);
  if (heroes.length !== HEROES.length || !heroes.every(hero => hero !== null)) return null;

  const items = parseInventory(inventory);
  if (!items || !isNumber(gil)) return null;
  if (!isNumber(chapterIndex) || !Number.isInteger(chapterIndex) || chapterIndex < 0 || chapterIndex >= CHAPTERS.length) return null;
  if (power !== null && !isPowerState(power)) return null;
  if (dragonSpared !== null && typeof dragonSpared !== "boolean") return null;

  return { party: heroes, inventory: items, gil, chapterIndex, power, dragonSpared };
}
