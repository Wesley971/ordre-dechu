// battle-fx.ts - Effets du combat en pixel art, sans DOM : effets spéciaux (MAE-95) et effets des capacités (MAE-31)
//
// Un effet est une suite d'images sur la grille commune de douze images par seconde (sprite-motion.ts) : à chaque
// image, une liste de pixels, chacun à une position entière et d'une couleur prise dans les fiches des personnages
// (docs/character-palette.md). La couche qui les affiche (fx-layer.ts) est en pixels de sprite, agrandie d'un nombre
// entier de pixels réels, comme les sprites : aucun lissage, aucun mouvement plus fin qu'un pixel de sprite.
// Le hasard vient d'un générateur à graine propre, jamais de Math.random : un seul tirage de plus décalerait ceux du
// combat, et le bot ne rejouerait plus la même partie (testé pour chaque effet, src/dev/battle-fx.test.ts).

import type { Ability, AbilityEffect } from "../data/game-data.ts";
import type { OpaqueRuns } from "./sprite-frames.ts";

// Couleurs des effets, toutes dans les fiches
export const FX_COLORS = {
  ash: "#45403a",       // cendre (palette commune ; nuage du Dragon, docs/enemy-sheets.md)
  ember: "#7a2a14",     // braise sombre (touche des ennemis ; braises du nuage)
  shadow: "#2a2018",    // brun d'ombre (palette commune ; bas de la rampe d'or de l'écho)
  oldGold: "#c9a84c",   // or ancien (héritage immortel)
  brightGold: "#f0c95a", // or vif (yeux de Maelor et de l'écho)
  parchment: "#f1e4c3", // parchemin (haut de la rampe d'or de l'écho ; cœur clair des effets des capacités)
  paleAsh: "#c2b69f",   // cendré clair (cheveux de Maelor ; l'acier d'une lame qui passe)
  paleBlue: "#8fb8e0",  // flamme et sorts de Corvin : le feu de sa lanterne est bleu pâle
  nightBlue: "#141c2e", // bleu nuit de Corvin : ce que son feu laisse en s'éteignant
  wine: "#6e1626",      // rouge vin de Maelor : le liseré de ses gestes
  iron: "#3d3f42",      // fer (palette des ennemis ; chaînes des Gau-Tik, docs/enemy-sheets.md)
  rust: "#6b3a22",      // rouille (palette des ennemis ; chaînes des Gau-Tik)
  bone: "#8f8a7c",      // os gris (palette des ennemis) : l'arête claire des coups des ennemis (décision de Wesley du 11/11/2026)
} as const; // as const : les couleurs gardent leur valeur exacte, qui forme le type FxColor
export type FxColor = (typeof FX_COLORS)[keyof typeof FX_COLORS];

// Coordonnées en pixels de sprite de la couche : x vers la droite, y vers le bas
export interface FxPoint { x: number; y: number }
export interface FxBox { left: number; top: number; right: number; bottom: number } // right et bottom exclus
export interface FxPixel { x: number; y: number; color: FxColor }

// Un effet : count images de la grille, et les pixels de chacune (de 0 à count - 1)
export interface FxPlan {
  readonly count: number;
  frame(index: number): FxPixel[];
}

// Générateur à graine (mulberry32) : nombres de 0 (compris) à 1 (exclu), toujours la même suite pour la même graine
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Entier de min à max compris
export const between = (random: () => number, min: number, max: number) => min + Math.floor(random() * (max - min + 1));

// Couleur tirée selon des poids
export function pick(random: () => number, weighted: readonly (readonly [FxColor, number])[]): FxColor {
  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [color, weight] of weighted) {
    roll -= weight;
    if (roll < 0) return color;
  }
  return weighted[weighted.length - 1][0];
}

// Point d'un trajet de from à to à l'avancement p (0 à 1), sur un arc qui monte de `arc` pixels au milieu, arrondi au pixel
export function along(from: FxPoint, to: FxPoint, p: number, arc = 0): FxPoint {
  const q = Math.max(0, Math.min(1, p));
  return {
    x: Math.round(from.x + (to.x - from.x) * q),
    y: Math.round(from.y + (to.y - from.y) * q - arc * 4 * q * (1 - q)),
  };
}

// — Nuée de cendre du Dragon (MAE-95) —
// Le nuage part de la gueule vers chaque héros visé : des grains de cendre, d'ombre et quelques braises partent par
// vagues, traversent en arc, se posent sur le haut du corps des héros, y retombent d'un pixel toutes les deux images,
// puis s'éteignent un à un avant la fin. En vol, un grain laisse derrière lui une traînée de deux pixels d'ombre sur
// son trajet : à douze images par seconde, il franchit l'écran par grands sauts, et la traînée dit d'où il vient.
// Les grains se posent pour l'essentiel vers la fin du sort (CONFIG.timing.cast), quand l'impact frappe les héros.
// L'impact sur les héros touchés est l'effet de la capacité (cinder, MAE-98), lancé avec les chiffres.
const ASH_GRAINS: readonly (readonly [FxColor, number])[] = [[FX_COLORS.ash, 6], [FX_COLORS.shadow, 2], [FX_COLORS.ember, 2]];
export const ASH_GRAINS_PER_TARGET = 36;
export const ASH_VEIL_PER_TARGET = 48; // voile du mouvement réduit : un peu plus dense, puisqu'il ne bouge pas
const ASH_REACH = 0.7; // part haute du héros où se posent les grains
const ASH_TRAIL = [0.35, 0.7]; // traînée d'un grain en vol : ses positions d'il y a 0,35 et 0,7 image

// Point de la cible où se pose un grain : dans le haut du corps de son rectangle
function landing(random: () => number, box: FxBox): FxPoint {
  const bottom = Math.max(box.top, Math.round(box.top + (box.bottom - box.top) * ASH_REACH) - 1);
  return { x: between(random, box.left, box.right - 1), y: between(random, box.top, bottom) };
}

export function ashCloud(mouth: FxPoint, targets: readonly FxBox[], count: number, seed: number): FxPlan {
  const random = seeded(seed);
  const grains = targets.flatMap((box) => Array.from({ length: ASH_GRAINS_PER_TARGET }, () => {
    const start = Math.floor(random() * 0.15 * (count - 1)) / Math.max(1, count - 1); // départ, sur une image : la première vague part dès la première
    const flight = 0.2 + random() * 0.12;                 // trajet jusqu'au héros : posé entre 20 et 47 % de l'effet
    const end = Math.min(1, start + flight + 0.15 + random() * 0.4); // le grain s'éteint
    return {
      start, flight, end,
      from: { x: mouth.x + between(random, -1, 1), y: mouth.y + between(random, -1, 1) },
      to: landing(random, box),
      arc: between(random, -4, 10),
      wide: random() < 0.3,                               // un grain sur trois fait deux pixels de large
      color: pick(random, ASH_GRAINS),
    };
  }));
  return {
    count,
    frame(index) {
      const t = count <= 1 ? 1 : index / (count - 1);
      const pixels: FxPixel[] = [];
      for (const grain of grains) {
        if (t < grain.start || t >= grain.end) continue;
        const p = (t - grain.start) / grain.flight;
        const at = along(grain.from, grain.to, p, grain.arc);
        // Posé : il retombe d'un pixel toutes les deux images
        const fall = p > 1 ? Math.floor(((t - grain.start - grain.flight) * (count - 1)) / 2) : 0;
        if (p < 1) {
          for (const back of ASH_TRAIL) {
            const behind = along(grain.from, grain.to, p - back / (Math.max(1, count - 1) * grain.flight), grain.arc);
            pixels.push({ ...behind, color: FX_COLORS.shadow });
          }
        }
        pixels.push({ x: at.x, y: at.y + fall, color: grain.color });
        if (grain.wide) pixels.push({ x: at.x + 1, y: at.y + fall, color: grain.color });
      }
      return pixels;
    },
  };
}

// Mouvement réduit : un voile fixe sur le haut du corps des héros, le même à chaque image, montré tout l'effet
export function ashVeil(targets: readonly FxBox[], count: number, seed: number): FxPlan {
  const random = seeded(seed);
  const pixels: FxPixel[] = targets.flatMap((box) => Array.from({ length: ASH_VEIL_PER_TARGET }, () => ({ ...landing(random, box), color: pick(random, ASH_GRAINS) })));
  return { count, frame: () => pixels };
}

// — L'écho de Maelor se défait en lumière (MAE-95) —
// Pendant que ses rangées s'effacent depuis le haut (geste unravel, sprite-motion.ts), chaque rangée effacée lâche des
// pixels dorés, pris là où elle était opaque, qui montent d'un pixel par image en s'assombrissant (parchemin, or vif,
// or ancien), puis s'éteignent. Avant que les rangées s'effacent, quelques éclats d'or vif scintillent sur lui. Tout
// s'arrête avec le geste : la lumière ne reste pas (la lueur qui reste jusqu'au choix du pouvoir : MAE-97).
// Mouvement réduit : aucune particule, l'écho passe en or puis disparaît d'un coup (couleurs : côté scène).
const LIGHT_FADE: readonly FxColor[] = [FX_COLORS.parchment, FX_COLORS.brightGold, FX_COLORS.brightGold, FX_COLORS.oldGold, FX_COLORS.oldGold];
const LIGHT_PER_COLUMNS = 5; // une particule pour cinq pixels opaques d'une rangée (au moins une)
const SPARKS = 6;            // éclats par image avant l'effacement

// Nombre de pixels opaques d'une rangée, et l'un d'eux tiré au hasard (sa colonne), null si elle est vide
const opaqueCount = (runs: OpaqueRuns) => runs.reduce((sum, [left, right]) => sum + right - left, 0);
function opaqueColumn(random: () => number, runs: OpaqueRuns): number | null {
  let k = between(random, 0, opaqueCount(runs) - 1);
  for (const [left, right] of runs) {
    if (k < right - left) return left + k;
    k -= right - left;
  }
  return null;
}

// png : rectangle du PNG dans la couche ; rows : segments opaques de chaque rangée (opaqueRuns, sprite-frames.ts) ; cleared(frame) : rangées
// effacées depuis le haut à cette image du geste (unravelCleared, sprite-motion.ts)
export function lightRise(png: FxBox, rows: readonly OpaqueRuns[], cleared: (frame: number) => number, count: number, seed: number): FxPlan {
  const random = seeded(seed);
  const motes: { x: number; y: number; start: number; life: number; drift: number }[] = [];
  const sparks: FxPixel[][] = [];
  for (let frame = 0; frame < count; frame++) {
    const from = frame === 0 ? 0 : cleared(frame - 1), to = cleared(frame);
    for (let row = from; row < to; row++) {
      const runs = rows[row] ?? [];
      const opaque = opaqueCount(runs);
      if (opaque === 0) continue;
      for (let k = 0; k < Math.max(1, Math.round(opaque / LIGHT_PER_COLUMNS)); k++) {
        const x = opaqueColumn(random, runs);
        if (x !== null) motes.push({ x: png.left + x, y: png.top + row, start: frame, life: between(random, 3, LIGHT_FADE.length), drift: between(random, -1, 1) });
      }
    }
    // Avant l'effacement : des éclats sur les rangées encore là
    const lit: FxPixel[] = [];
    if (to === 0) {
      for (let k = 0; k < SPARKS; k++) {
        const row = between(random, 0, rows.length - 1), runs = rows[row] ?? [];
        const x = opaqueCount(runs) > 0 ? opaqueColumn(random, runs) : null;
        if (x !== null) lit.push({ x: png.left + x, y: png.top + row, color: FX_COLORS.brightGold });
      }
    }
    sparks.push(lit);
  }
  return {
    count,
    frame(index) {
      const pixels: FxPixel[] = [...(sparks[index] ?? [])];
      for (const mote of motes) {
        const age = index - mote.start;
        if (age < 0 || age >= mote.life) continue;
        pixels.push({ x: mote.x + mote.drift * Math.floor(age / 2), y: mote.y - age, color: LIGHT_FADE[Math.min(LIGHT_FADE.length - 1, Math.floor((age * LIGHT_FADE.length) / mote.life))] });
      }
      return pixels;
    },
  };
}

// — L'or quitte Maelor (MAE-95) —
// Quand Maelor rend le pouvoir devant le Dragon, des pixels d'or partent de sa poitrine par vagues, montent en arc et
// retombent sur les écailles du Dragon et sur le sol devant lui (les ossements) : « l'or quitte son corps et se répand
// sur les ossements, sur les blasons brisés, sur les écailles du Dragon ». Le Dragon, vaincu, est affaissé : l'or se
// pose sur les pixels de son image telle qu'elle est affichée (body), dans sa moitié basse, jamais dans le vide au-dessus
// de lui (contrôle à l'œil de Wesley du 09/11/2026). Posés, ils scintillent (or vif, or ancien)
// puis s'éteignent un à un. Maelor jette en même temps un éclat doré (couleurs : côté scène). Sans Dragon à l'écran,
// ou avec le mouvement réduit, l'éclat seul, sur place (décision de Wesley du 09/11/2026) : streamsGold.
const GOLD_MOTES = 44;
const GOLD_ON_SCALES = 0.6; // part de l'or qui se pose sur le Dragon ; le reste, sur le sol devant lui
const GOLD_LOW = 0.5;       // l'or se pose sous cette part de la hauteur de l'image du Dragon

// Un pixel opaque d'une image affichée (body : segments opaques de chaque rangée, par rapport au coin de son PNG, posé
// en box), tiré dans les rangées [from, to[ ; chaque pixel opaque a la même chance, jamais dans un trou entre les
// pattes. null si ces rangées sont vides
function opaquePoint(random: () => number, box: FxBox, body: readonly OpaqueRuns[], from: number, to: number): FxPoint | null {
  const rows: number[] = [];
  let total = 0;
  for (let row = Math.max(0, from); row < Math.min(body.length, to); row++) {
    const opaque = opaqueCount(body[row]);
    if (opaque > 0) { rows.push(row); total += opaque; }
  }
  if (total === 0) return null;
  let k = between(random, 0, total - 1);
  for (const row of rows) {
    for (const [left, right] of body[row]) {
      if (k < right - left) return { x: box.left + left + k, y: box.top + row };
      k -= right - left;
    }
  }
  return null;
}

// Où se pose l'or sur le Dragon : un pixel opaque de son image affichée, dans sa moitié basse, au-dessus de ses pieds
function onScales(random: () => number, dragon: FxBox, body: readonly OpaqueRuns[]): FxPoint | null {
  const height = dragon.bottom - dragon.top;
  return opaquePoint(random, dragon, body, Math.ceil(height * GOLD_LOW), height - 3);
}

// D'où part l'or : un pixel opaque de la poitrine de Maelor tel qu'il est affiché (debout, ou à genoux s'il a été
// relevé à 1 PV), la bande de 25 à 55 % de sa silhouette, du haut de sa tête au bas de ses pieds. Sans image (pas
// encore chargée), le même rectangle dans son PNG
function chest(random: () => number, hero: FxBox, body: readonly OpaqueRuns[]): FxPoint {
  const rows = body.flatMap((runs, row) => (runs.length > 0 ? [row] : []));
  if (rows.length > 0) {
    const top = rows[0], span = rows[rows.length - 1] - top;
    const point = opaquePoint(random, hero, body, top + Math.round(span * 0.25), top + Math.round(span * 0.55) + 1);
    if (point) return point;
  }
  const width = hero.right - hero.left, height = hero.bottom - hero.top;
  return { x: hero.left + between(random, Math.round(width * 0.3), Math.round(width * 0.7)), y: hero.top + between(random, Math.round(height * 0.25), Math.round(height * 0.55)) };
}

// L'or part-il vers le Dragon ? L'éclat doré de Maelor, lui, est toujours joué (par les scènes)
export function streamsGold(dragonOnScreen: boolean, reduced: boolean): boolean {
  return dragonOnScreen && !reduced;
}

// heroBody et body : segments opaques de chaque rangée de Maelor et du Dragon, tels qu'ils sont affichés
// (AnimatedSprite.shownRows), par rapport au coin de leur PNG (hero, dragon)
export function goldStream(hero: FxBox, heroBody: readonly OpaqueRuns[], dragon: FxBox, body: readonly OpaqueRuns[], count: number, seed: number): FxPlan {
  const random = seeded(seed);
  const motes = Array.from({ length: GOLD_MOTES }, (_, i) => {
    // Départ sur une image ; le premier grain part dès la première, avec l'éclat de Maelor
    const start = i === 0 ? 0 : Math.floor(random() * 0.4 * (count - 1)) / Math.max(1, count - 1);
    const flight = 0.25 + random() * 0.2;
    const scales = random() < GOLD_ON_SCALES ? onScales(random, dragon, body) : null;
    const to = scales ?? { x: between(random, dragon.left - 12, dragon.right - 1), y: dragon.bottom - between(random, 1, 3) }; // sol : les trois rangées de ses pieds
    return {
      start, flight, end: Math.min(1, start + flight + 0.15 + random() * 0.4),
      from: chest(random, hero, heroBody),
      to, arc: between(random, 10, 26), twinkle: between(random, 0, 1),
    };
  });
  return {
    count,
    frame(index) {
      const t = count <= 1 ? 1 : index / (count - 1);
      const pixels: FxPixel[] = [];
      for (const mote of motes) {
        if (t < mote.start || t >= mote.end) continue;
        const p = (t - mote.start) / mote.flight;
        const at = along(mote.from, mote.to, p, mote.arc);
        // En vol : or vif ou parchemin ; posé : il scintille, or vif et or ancien une image sur deux
        const color = p < 1 ? (mote.twinkle ? FX_COLORS.parchment : FX_COLORS.brightGold)
          : (index + mote.twinkle) % 2 === 0 ? FX_COLORS.brightGold : FX_COLORS.oldGold;
        pixels.push({ ...at, color });
      }
      return pixels;
    },
  };
}

// — Effets des capacités (MAE-31) —
// Chaque capacité a son effet, dessiné sur ses cibles au moment où elle les touche (`effect` dans les données,
// src/data/game-data.ts), le même dans les deux scènes. Les couleurs viennent de la palette des personnages
// seulement, sans orange ni vert (décision de Wesley du 10/11/2026).
// Un effet se pose sur la silhouette de la cible telle qu'elle est affichée (ses pixels opaques), dure au plus la
// pause de lecture des chiffres (CONFIG.timing.abilityFx), et n'est jamais attendu : il n'ajoute aucune attente au
// combat. Mouvement réduit : son image la plus fournie, fixe, le temps de l'effet (still).

// Une cible : le rectangle de son PNG dans la couche, et les segments opaques de chaque rangée de son image affichée
// (AnimatedSprite.shownRows), par rapport au coin de ce rectangle
export interface FxTarget { box: FxBox; rows: readonly OpaqueRuns[] }

export interface AbilityFxInput {
  targets: readonly FxTarget[];
  facing: 1 | -1; // sens du coup : 1 vers la droite (un héros frappe un ennemi), -1 vers la gauche
  count: number;
  seed: number;
}

// L'effet en pixels d'une capacité : le sien, sinon l'entaille pour un coup d'arme. Toutes les capacités du jeu
// déclarent le leur (game-data.ts) ; null : aucun effet (le Repli, qui ne touche personne)
export function abilityEffect(ability: Ability): AbilityEffect | null {
  return ability.effect ?? (ability.kind === "physical" ? "slash" : null);
}

// Ceux qu'une capacité touche : tous, sauf ceux qu'elle rate. Sur un « Raté », l'effet de la capacité ne joue pas
// (décision de Wesley du 10/11/2026) ; « Sans effet » le joue, comme avant
export function touched<T>(hits: readonly { target: T; effect: { type: string } }[]): T[] {
  return hits.filter(({ effect }) => effect.type !== "miss").map(({ target }) => target);
}

// Les effets sont écrits en huit pas : `clock` rend le pas, de 0 à 8, de l'image `index` d'un effet de `count` images.
// À vitesse normale l'effet a huit images (CONFIG.timing.abilityFx) : une image avance d'un peu plus d'un pas, et sa
// dernière image est son dernier pas. Plus court (mode test accéléré), il saute des pas, sans casser
const STEPS = 8;
const clock = (index: number, count: number) => (count <= 1 ? STEPS / 2 : (index * STEPS) / (count - 1));

// La silhouette d'une cible dans la couche : ses bornes, son centre, et un de ses pixels opaques tiré au hasard dans
// une bande de sa hauteur (from et to : parts de la hauteur, 0 en haut, 1 en bas). Sans image (pas encore chargée),
// le rectangle de son PNG
interface Shape {
  left: number; right: number; top: number; bottom: number; // bornes comprises
  width: number; height: number; cx: number; cy: number;
  point(random: () => number, from: number, to: number): FxPoint;
  // Le pixel opaque le plus proche du centre, sur la rangée à cette part de la hauteur (ou la rangée pleine la plus
  // proche) : là où frappe ce qui vise la cible, jamais dans un creux de sa silhouette
  anchor(part: number): FxPoint;
}

function shapeOf({ box, rows }: FxTarget): Shape {
  const filled = rows.flatMap((runs, row) => (runs.length > 0 ? [row] : []));
  let left = box.left, right = box.right - 1, top = box.top, bottom = box.bottom - 1;
  if (filled.length > 0) {
    top = box.top + filled[0];
    bottom = box.top + filled[filled.length - 1];
    left = box.left + Math.min(...filled.map((row) => rows[row][0][0]));
    right = box.left + Math.max(...filled.map((row) => rows[row][rows[row].length - 1][1])) - 1;
  }
  const width = right - left + 1, height = bottom - top + 1;
  const cx = Math.round((left + right) / 2), cy = Math.round((top + bottom) / 2);
  const rowAt = (part: number) => top + Math.round((height - 1) * Math.max(0, Math.min(1, part)));
  return {
    left, right, top, bottom, width, height, cx, cy,
    point(random, from, to) {
      const first = rowAt(from), last = Math.max(first, rowAt(to));
      const opaque = filled.length > 0 ? opaquePoint(random, box, rows, first - box.top, last - box.top + 1) : null;
      return opaque ?? { x: between(random, left, right), y: between(random, first, last) };
    },
    anchor(part) {
      const y = rowAt(part);
      if (filled.length === 0) return { x: cx, y };
      const row = filled.reduce((best, candidate) => (Math.abs(box.top + candidate - y) < Math.abs(box.top + best - y) ? candidate : best));
      let x = cx, gap = Infinity;
      for (const [from, to] of rows[row]) {
        const near = Math.max(box.left + from, Math.min(box.left + to - 1, cx));
        if (Math.abs(near - cx) < gap) { gap = Math.abs(near - cx); x = near; }
      }
      return { x, y: box.top + row };
    },
  };
}

// Mouvement réduit : l'image la plus fournie de l'effet, la même à chaque image, montrée tout l'effet
export function still(plan: FxPlan): FxPlan {
  let fullest: FxPixel[] = [];
  for (let index = 0; index < plan.count; index++) {
    const pixels = plan.frame(index);
    if (pixels.length > fullest.length) fullest = pixels;
  }
  return { count: plan.count, frame: () => fullest };
}

// Frapper, et tout coup d'arme sans effet à lui : une entaille en diagonale à travers la cible, tracée en trois
// images depuis le côté de celui qui frappe, parchemin sur une ombre de cendré clair ; elle tient deux images, puis
// s'efface pixel par pixel pendant que quelques éclats filent dans le sens du coup
export const SLASH_SPARKS = 5;

function slash({ targets, facing, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  const cuts = targets.map((target) => {
    const shape = shapeOf(target);
    const length = Math.max(10, Math.min(44, Math.round(Math.min(shape.width, shape.height) * 0.9)));
    const half = Math.floor(length / 2);
    return {
      from: { x: shape.cx - facing * half, y: shape.cy - half },
      length,
      fades: Array.from({ length }, random), // l'instant où chaque pixel s'efface, de 0 à 1
      sparks: Array.from({ length: SLASH_SPARKS }, () => ({ dx: facing * (1.5 + random() * 2), dy: 0.5 + random() * 2, start: 2.5 + random() * 2 })),
    };
  });
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const pixels: FxPixel[] = [];
      for (const cut of cuts) {
        const drawn = Math.min(cut.length, Math.ceil((cut.length * (step + 1)) / 3));
        const fresh = step <= 4;                      // tracée puis tenue : parchemin sur cendré clair
        const fade = fresh ? 0 : (step - 4) / (STEPS - 4);
        for (let i = 0; i < drawn; i++) {
          if (cut.fades[i] < fade) continue;
          const x = cut.from.x + facing * i, y = cut.from.y + i;
          pixels.push({ x, y, color: fresh ? FX_COLORS.parchment : FX_COLORS.paleAsh });
          if (fresh) pixels.push({ x, y: y + 1, color: FX_COLORS.paleAsh });
        }
        const end = { x: cut.from.x + facing * (cut.length - 1), y: cut.from.y + cut.length - 1 };
        for (const spark of cut.sparks) {
          const age = step - spark.start;
          if (age < 0 || age >= 3) continue;
          pixels.push({ x: end.x + Math.round(spark.dx * age), y: end.y - Math.round(spark.dy * age) + Math.round(age * age * 0.5), color: FX_COLORS.parchment });
        }
      }
      return pixels;
    },
  };
}

// Vordrak (Maelor) : « côte à côte », la frappe double. Deux entailles parallèles en diagonale, tracées ensemble en
// deux images depuis le côté de celui qui frappe, parchemin bordées dessous de rouge vin ; elles tiennent, puis
// s'effacent pixel par pixel en cendré clair, toujours bordées de rouge vin, pendant que des éclats filent au bout de
// chacune. Le rouge vin seul se perdrait dans la nuit : il reste le liseré d'un trait clair.
// Kardrov (l'écho de Maelor, MAE-98) : la même frappe, en miroir de haut en bas (les entailles montent), dans la rampe
// d'or de l'écho (docs/character-palette.md, section 8 ; décision de Wesley du 11/11/2026) : parchemin bordées d'or
// ancien, puis or ancien bordé de brun d'ombre en s'effaçant, et des éclats parchemin. Pas de rouge vin : il est à
// Maelor. Pas d'or vif non plus : les petits éclats d'or vif sur un héros touché sont l'indice de son sang (MAE-98,
// PR 2), que Kardrov ne doit pas brouiller. Le liseré reste sous le trait, comme une ombre portée. Un ennemi frappe
// depuis la droite : retournée de gauche à droite par le sens du coup, puis de haut en bas, l'entaille de Kardrov a à
// l'écran la même diagonale que Vordrak sur un ennemi, tracée dans l'autre sens (du bas vers le haut)
const TWIN_SPARKS = 3; // éclats au bout de chaque entaille

// Le tracé et les couleurs d'une frappe double : rise, les entailles montent au lieu de descendre ; fresh et edge, le
// trait et son liseré tant qu'il est frais ; faded et fadedEdge, en s'effaçant ; spark, les éclats
interface TwinStyle { rise: boolean; fresh: FxColor; edge: FxColor; faded: FxColor; fadedEdge: FxColor; spark: FxColor }
const VORDRAK: TwinStyle = { rise: false, fresh: FX_COLORS.parchment, edge: FX_COLORS.wine, faded: FX_COLORS.paleAsh, fadedEdge: FX_COLORS.wine, spark: FX_COLORS.parchment };
const KARDROV: TwinStyle = { rise: true, fresh: FX_COLORS.parchment, edge: FX_COLORS.oldGold, faded: FX_COLORS.oldGold, fadedEdge: FX_COLORS.shadow, spark: FX_COLORS.parchment };

function doubleCut({ targets, facing, count, seed }: AbilityFxInput, style: TwinStyle): FxPlan {
  const random = seeded(seed);
  const down = style.rise ? -1 : 1; // sens vertical du tracé
  const pairs = targets.map((target) => {
    const shape = shapeOf(target);
    const length = Math.max(10, Math.min(40, Math.round(Math.min(shape.width, shape.height) * 0.8)));
    const half = Math.floor(length / 2);
    const gap = Math.max(4, Math.round(length / 6)); // écart entre les deux entailles, le long de l'horizontale
    return {
      // Les deux départs, de part et d'autre du centre de la silhouette
      starts: [-1, 1].map((side): FxPoint => ({ x: shape.cx - facing * half + side * Math.ceil(gap / 2), y: shape.cy - down * half })),
      length,
      fades: Array.from({ length: 2 * length }, random), // l'instant où chaque pixel s'efface, de 0 à 1
      sparks: Array.from({ length: 2 * TWIN_SPARKS }, () => ({ dx: facing * (1.5 + random() * 2), dy: 0.5 + random() * 2, start: 2 + random() * 2 })),
    };
  });
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const pixels: FxPixel[] = [];
      for (const pair of pairs) {
        const drawn = Math.min(pair.length, Math.ceil((pair.length * (step + 1)) / 2));
        const fresh = step <= 4;
        const fade = fresh ? 0 : (step - 4) / (STEPS - 4);
        pair.starts.forEach((from, cut) => {
          for (let i = 0; i < drawn; i++) {
            if (pair.fades[cut * pair.length + i] < fade) continue;
            const x = from.x + facing * i, y = from.y + down * i;
            pixels.push({ x, y, color: fresh ? style.fresh : style.faded }, { x, y: y + 1, color: fresh ? style.edge : style.fadedEdge });
          }
          const end = { x: from.x + facing * (pair.length - 1), y: from.y + down * (pair.length - 1) };
          for (const spark of pair.sparks.slice(cut * TWIN_SPARKS, (cut + 1) * TWIN_SPARKS)) {
            const age = step - spark.start;
            if (age < 0 || age >= 3) continue;
            pixels.push({ x: end.x + Math.round(spark.dx * age), y: end.y - Math.round(spark.dy * age) + Math.round(age * age * 0.5), color: style.spark });
          }
        });
      }
      return pixels;
    },
  };
}

const twin = (input: AbilityFxInput) => doubleCut(input, VORDRAK);
const echo = (input: AbilityFxInput) => doubleCut(input, KARDROV);

// Édrag (Maelor) : « la garde », qui balaie tous les ennemis. Un seul grand arc de lame passe d'un ennemi à l'autre,
// dans le sens du coup, à hauteur de hanche, et bombe vers le haut sur toute sa longueur : sa tête, plus épaisse,
// parchemin ; derrière elle, un trait de deux pixels parchemin sur cendré clair. Des éclats partent de chaque ennemi
// quand la lame le traverse. L'arc entier tient, puis s'efface pixel par pixel en cendré clair, comme l'entaille. Deux
// ennemis l'un au-dessus de l'autre : la lame passe de l'un à l'autre à la verticale
const SWEEP_TRACE = 4;        // la lame met quatre pas à traverser
const SWEEP_SPARKS = 4;       // éclats par ennemi traversé
const SWEEP_LEVEL = 0.6;      // hauteur de la lame dans chaque silhouette (0 en haut, 1 en bas)

function sweep({ targets, facing, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  // Les cibles dans l'ordre où la lame les traverse
  const shapes = targets.map(shapeOf).sort((a, b) => facing * (a.cx - b.cx));
  const path: FxPoint[] = [];
  const passes: { at: number; center: FxPoint }[] = []; // où la lame traverse chaque cible : rang dans le trajet
  if (shapes.length > 0) {
    const first = shapes[0], last = shapes[shapes.length - 1];
    const level = (shape: Shape) => shape.top + Math.round((shape.height - 1) * SWEEP_LEVEL);
    const start = (facing > 0 ? first.left : first.right) - facing * 6;
    const end = (facing > 0 ? last.right : last.left) + facing * 6;
    const knots = [{ x: start, y: level(first) }, ...shapes.map((shape) => ({ x: shape.cx, y: level(shape) })), { x: end, y: level(last) }];
    const span = Math.max(1, Math.abs(end - start));
    const bulge = Math.max(3, Math.min(12, Math.round(span * 0.08)));
    let previous: FxPoint | null = null;
    for (let i = 0; i <= span; i++) {
      const x = start + facing * i;
      // Hauteur de base : entre les deux repères qui entourent x, puis l'arc qui bombe vers le haut
      const k = Math.max(0, knots.findIndex((knot, n) => n > 0 && facing * (knot.x - x) >= 0) - 1);
      const a = knots[k], b = knots[Math.min(knots.length - 1, k + 1)];
      const part = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      const q = i / span;
      const y = Math.round(a.y + (b.y - a.y) * part - bulge * 4 * q * (1 - q));
      // Pas de trou : d'une colonne à l'autre, la lame descend ou monte pixel par pixel
      if (previous) for (let fill = previous.y + Math.sign(y - previous.y); Math.abs(y - fill) > 0; fill += Math.sign(y - fill)) path.push({ x, y: fill });
      path.push({ x, y });
      previous = { x, y };
    }
    // Le point du trajet le plus proche de chaque cible, à sa hauteur : deux cibles de même colonne ont chacune le sien
    for (const shape of shapes) {
      const distance = (point: FxPoint) => Math.abs(point.x - shape.cx) + Math.abs(point.y - level(shape));
      const at = path.reduce((best, point, i) => (distance(point) < distance(path[best]) ? i : best), 0);
      passes.push({ at, center: path[at] });
    }
  }
  const fades = Array.from({ length: path.length }, random);
  const sparks = passes.map(() => Array.from({ length: SWEEP_SPARKS }, () => ({ dx: facing * (1 + random() * 2), dy: -2 + random() * 4 })));
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const pixels: FxPixel[] = [];
      const head = Math.min(path.length, Math.ceil((path.length * (step + 1)) / SWEEP_TRACE));
      const fresh = step <= SWEEP_TRACE + 1;
      const fade = fresh ? 0 : (step - SWEEP_TRACE - 1) / (STEPS - SWEEP_TRACE - 1);
      for (let i = 0; i < head; i++) {
        if (fades[i] < fade) continue;
        const { x, y } = path[i];
        if (!fresh) { pixels.push({ x, y, color: FX_COLORS.paleAsh }); continue; }
        pixels.push({ x, y: y - 1, color: FX_COLORS.parchment }, { x, y, color: FX_COLORS.parchment }, { x, y: y + 1, color: FX_COLORS.paleAsh });
        if (head < path.length && i >= head - 4) pixels.push({ x, y: y - 2, color: FX_COLORS.parchment }, { x, y: y + 2, color: FX_COLORS.paleAsh }); // la tête de la lame
      }
      passes.forEach((pass, n) => {
        // Le pas où la tête de la lame traverse cette cible
        const crossed = (pass.at * SWEEP_TRACE) / Math.max(1, path.length) - 1;
        const age = step - crossed;
        if (age < 0 || age >= 3) return;
        for (const spark of sparks[n]) pixels.push({ x: pass.center.x + Math.round(spark.dx * (age + 1)), y: pass.center.y + Math.round(spark.dy * (age + 1)) + Math.round(age * age * 0.5), color: FX_COLORS.parchment });
      });
      return pixels;
    },
  };
}

// Mèche (Corvin, feu) : « la mèche de la lanterne, qui allume tout ». Le feu prend aux pieds de la cible et monte le
// long de sa silhouette : chaque langue de flamme naît sur un de ses pixels, grandit puis retombe en montant d'un pixel
// par pas. Elle est bleu pâle, comme la lanterne : seul son pied est de parchemin, et sa pointe, qui vacille,
// s'éteint en bleu nuit. Le feu est éteint à la dernière image
const TONGUE_GROWTH = [0.6, 1, 1, 0.6, 0.3]; // hauteur d'une langue à chaque pas de sa vie, en part de sa pleine hauteur
const WICK_RISE = 4;                         // le feu met quatre pas à monter des pieds à la tête

function wick({ targets, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  const tongues = targets.flatMap((target) => {
    const shape = shapeOf(target);
    const total = Math.max(12, Math.min(140, Math.round((shape.width * shape.height) / 70)));
    return Array.from({ length: total }, (_, i) => {
      const start = i === 0 ? 0 : random() * WICK_RISE; // la première prend dès la première image
      const level = 1 - start / WICK_RISE;              // 1 : aux pieds, 0 : à la tête
      return {
        start, at: shape.point(random, level - 0.18, level + 0.12),
        // Aucune langue ne survit au dernier pas
        life: Math.min(between(random, 3, TONGUE_GROWTH.length), Math.floor(STEPS - start)),
        height: between(random, 5, 10), sway: between(random, -1, 1), wide: random() < 0.5,
      };
    });
  });
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const pixels: FxPixel[] = [];
      for (const tongue of tongues) {
        const age = Math.floor(step - tongue.start);
        if (step < tongue.start || age >= tongue.life) continue;
        const height = Math.max(3, Math.round(tongue.height * TONGUE_GROWTH[age]));
        for (let k = 0; k < height; k++) {
          const x = tongue.at.x + (k >= height / 2 ? tongue.sway : 0), y = tongue.at.y - age - k;
          pixels.push({ x, y, color: k === 0 ? FX_COLORS.parchment : k === height - 1 ? FX_COLORS.nightBlue : FX_COLORS.paleBlue });
          if (tongue.wide && k > 0 && k < height / 2) pixels.push({ x: x + 1, y, color: FX_COLORS.paleBlue });
        }
      }
      return pixels;
    },
  };
}

// Nuit blanche (Corvin, givre) : « la veille sans sommeil, et le blanc du givre ». Le givre descend sur la cible, de la
// tête aux pieds : chaque cristal se pose sur un de ses pixels dans un éclat de parchemin, y reste en bleu pâle (un
// sur trois en croix), scintille, puis se détache et tombe à la fin, où il n'en reste qu'un sur trois ; des flocons
// descendent autour d'elle
const FROST_FLAKES = 8;
const FROST_SETTLE = 4; // le givre met quatre pas à descendre de la tête aux pieds

function frost({ targets, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  const crystals = targets.flatMap((target) => {
    const shape = shapeOf(target);
    const total = Math.max(16, Math.min(280, Math.round((shape.width * shape.height) / 45)));
    return Array.from({ length: total }, (_, i) => {
      const start = i === 0 ? 0 : random() * FROST_SETTLE; // le premier cristal se pose dès la première image
      const level = start / FROST_SETTLE;
      // Le premier scintille au rythme de ceux qui restent jusqu'au bout
      return { start, at: shape.point(random, level - 0.15, level + 0.15), cross: random() < 0.3, twinkle: i === 0 ? 0 : between(random, 0, 2) };
    });
  });
  const flakes = targets.flatMap((target) => {
    const shape = shapeOf(target);
    return Array.from({ length: FROST_FLAKES }, () => ({
      x: between(random, shape.left - 4, shape.right + 4), y: shape.top - between(random, 4, 14),
      start: random() * 3, drift: between(random, -1, 1), bottom: shape.bottom,
    }));
  });
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const pixels: FxPixel[] = [];
      const fall = step > 6.5 ? Math.ceil((step - 6.5) * 2) : 0; // la fin : le givre se détache et tombe
      for (const crystal of crystals) {
        if (step < crystal.start || (step >= STEPS && crystal.twinkle !== 0)) continue; // au dernier pas, il n'en reste qu'un sur trois
        const age = Math.floor(step - crystal.start);
        const bright = age === 0 || (Math.floor(step) + crystal.twinkle) % 3 === 0;
        const { x } = crystal.at, y = crystal.at.y + fall;
        pixels.push({ x, y, color: bright ? FX_COLORS.parchment : FX_COLORS.paleBlue });
        if (crystal.cross && age >= 1 && fall === 0) {
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) pixels.push({ x: x + dx, y: y + dy, color: FX_COLORS.paleBlue });
        }
      }
      for (const flake of flakes) {
        if (step < flake.start) continue;
        const age = step - flake.start;
        const y = flake.y + Math.floor(age * 2);
        if (y > flake.bottom) continue;
        pixels.push({ x: flake.x + flake.drift * Math.floor(age / 3), y, color: FX_COLORS.parchment });
      }
      return pixels;
    },
  };
}

// Tocsin (Corvin, foudre) : « la cloche d'alarme des veilleurs ; la foudre tombe comme un coup de cloche ». Un éclair
// brisé tombe sur la cible, parchemin bordé de bleu pâle, et l'éclaire deux pas ; puis deux ondes s'élargissent
// autour du point touché, l'une après l'autre, comme un son de cloche, et s'éteignent en pointillé
export const BOLT_HEIGHT = 96; // l'éclair tombe d'aussi haut, au plus : du bord de la scène s'il est plus près
const BOLT_KNOT = 7;    // un coude tous les sept pixels environ
const RINGS = [1, 3];   // pas où naît chaque onde

function ring(center: FxPoint, radius: number, dotted: boolean, color: FxColor): FxPixel[] {
  const rx = Math.max(1, Math.round(radius)), ry = Math.max(1, Math.round(radius * 0.6));
  const seen = new Set<string>();
  const pixels: FxPixel[] = [];
  const points = Math.ceil(2 * Math.PI * rx);
  for (let k = 0; k < points; k++) {
    if (dotted && k % 2 === 1) continue;
    const angle = (2 * Math.PI * k) / points;
    const x = center.x + Math.round(Math.cos(angle) * rx), y = center.y + Math.round(Math.sin(angle) * ry);
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pixels.push({ x, y, color });
  }
  return pixels;
}

function bell({ targets, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  const strikes = targets.map((target) => {
    const shape = shapeOf(target);
    const at = shape.anchor(0.2); // un pixel de la cible, vers le haut de sa silhouette
    const height = Math.max(1, Math.min(BOLT_HEIGHT, at.y)); // jamais d'au-dessus de la scène
    // Coudes de l'éclair, à intervalles égaux du haut vers le point touché, où il arrive pile (le dernier coude est sur lui)
    const last = Math.ceil(height / BOLT_KNOT), span = height / last;
    const knots = Array.from({ length: last + 1 }, (_, k) => (k === last ? 0 : between(random, -6, 6)));
    const path = Array.from({ length: height + 1 }, (_, i): FxPoint => {
      const k = Math.min(last - 1, Math.floor(i / span)), part = Math.min(1, (i - k * span) / span);
      return { x: at.x + Math.round(knots[k] + (knots[k + 1] - knots[k]) * part), y: at.y - height + i };
    });
    return { at, path, lit: Array.from({ length: 14 }, () => shape.point(random, 0, 1)) };
  });
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const pixels: FxPixel[] = [];
      for (const strike of strikes) {
        if (step < 1) {
          for (const { x, y } of strike.path) {
            pixels.push({ x: x - 1, y, color: FX_COLORS.paleBlue }, { x, y, color: FX_COLORS.parchment }, { x: x + 1, y, color: FX_COLORS.parchment }, { x: x + 2, y, color: FX_COLORS.paleBlue });
          }
        } else if (step < 2) {
          for (const { x, y } of strike.path) pixels.push({ x, y, color: FX_COLORS.parchment }, { x: x + 1, y, color: FX_COLORS.paleBlue });
        } else if (step < 3) {
          strike.path.forEach(({ x, y }, i) => { if (i % 3 !== 0) pixels.push({ x, y, color: FX_COLORS.paleBlue }); });
        }
        if (step < 2) for (const point of strike.lit) pixels.push({ ...point, color: step < 1 ? FX_COLORS.parchment : FX_COLORS.paleBlue });
        for (const born of RINGS) {
          const age = step - born;
          if (age < 0 || age >= 4.5) continue;
          pixels.push(...ring(strike.at, 2 + age * 3, age >= 3, age < 1.5 ? FX_COLORS.parchment : FX_COLORS.paleBlue));
        }
      }
      return pixels;
    },
  };
}

// Soufre (Corvin, feu sur tous) : « le soufre mêlé au Souffle, l'explosion ». Sur chaque ennemi, l'un après l'autre :
// un cœur de parchemin éclate et grossit, cerné de bleu pâle, puis s'ouvre en un anneau qui s'élargit ; des éclats
// partent en étoile en laissant une traînée, retombent et s'éteignent en bleu nuit ; une fumée de cendre monte de sa
// silhouette. L'explosion est à la taille de l'ennemi : `unit`, un quatorzième de son petit côté, de 3 à 6 pixels
const SULFUR_SMOKE = 14;
// Le cœur de l'explosion à chaque pas, en `unit` : rayon du losange, et rayon en dessous duquel il est vide (un anneau)
const SULFUR_CORE = [{ radius: 1, hollow: 0 }, { radius: 2, hollow: 0 }, { radius: 2.7, hollow: 1.8 }, { radius: 3.3, hollow: 3 }];

function sulfur({ targets, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  const blasts = targets.map((target, rank) => {
    const shape = shapeOf(target);
    const unit = Math.max(3, Math.min(6, Math.round(Math.min(shape.width, shape.height) / 14)));
    const sparks = Math.max(14, Math.min(28, Math.round((shape.width + shape.height) / 4)));
    return {
      delay: rank * 0.75, // les ennemis sautent l'un après l'autre
      center: { x: shape.cx, y: shape.cy }, unit,
      sparks: Array.from({ length: sparks }, () => ({ angle: random() * 2 * Math.PI, speed: (unit / 3) * (2.5 + random() * 2.5), life: 3 + random() * 2.5 })),
      smoke: Array.from({ length: SULFUR_SMOKE }, () => ({ at: shape.point(random, 0, 0.6), start: 2.5 + random() * 3, life: between(random, 3, 4), drift: between(random, -1, 1) })),
    };
  });
  const sparkAt = (center: FxPoint, spark: { angle: number; speed: number }, age: number): FxPoint => ({
    x: center.x + Math.round(Math.cos(spark.angle) * spark.speed * age * 1.6),
    y: center.y + Math.round(Math.sin(spark.angle) * spark.speed * age * 1.3 + 0.12 * age * age),
  });
  return {
    count,
    frame(index) {
      const pixels: FxPixel[] = [];
      for (const blast of blasts) {
        // Un effet d'une seule image montre chaque explosion à son milieu, sans décalage
        const step = clock(index, count) - (count <= 1 ? 0 : blast.delay);
        if (step < 0) continue;
        const { center, unit } = blast;
        const phase = Math.floor(step);
        if (phase < SULFUR_CORE.length) {
          const radius = Math.round(SULFUR_CORE[phase].radius * unit), hollow = Math.round(SULFUR_CORE[phase].hollow * unit);
          const fading = phase === SULFUR_CORE.length - 1; // le dernier anneau s'éteint en pointillé
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const distance = Math.abs(dx) + Math.abs(dy);
              if (distance > radius || distance < hollow || (fading && (dx + dy) % 2 !== 0)) continue;
              pixels.push({ x: center.x + dx, y: center.y + dy, color: hollow === 0 && distance <= radius - unit ? FX_COLORS.parchment : FX_COLORS.paleBlue });
            }
          }
        }
        for (const spark of blast.sparks) {
          const age = step - 0.5;
          if (age < 0 || age >= spark.life) continue;
          // La traînée : où l'éclat était un tiers et deux tiers d'image plus tôt
          for (const back of [0.66, 0.33]) if (age >= back) pixels.push({ ...sparkAt(center, spark, age - back), color: FX_COLORS.paleBlue });
          pixels.push({ ...sparkAt(center, spark, age), color: age < 1.5 ? FX_COLORS.parchment : age < spark.life - 1 ? FX_COLORS.paleBlue : FX_COLORS.nightBlue });
        }
        for (const puff of blast.smoke) {
          const age = Math.floor(step - puff.start);
          if (step < puff.start || age >= puff.life) continue;
          const x = puff.at.x + (age >= 2 ? puff.drift : 0), y = puff.at.y - age, color = age < 2 ? FX_COLORS.ash : FX_COLORS.shadow;
          pixels.push({ x, y, color }, { x: x + 1, y, color });
        }
      }
      return pixels;
    },
  };
}

// Nios (Elwen, soin) : « soin ». Des grains d'or montent le long de l'allié : chacun naît sur un de ses pixels, dans une
// bande qui monte des pieds à la tête en quatre pas, puis monte de deux pixels par pas en passant du parchemin à l'or
// vif puis à l'or ancien, et s'éteint ; un grain sur trois laisse une traînée d'or ancien. Tout est éteint au dernier pas
const MEND_RISE = 4; // la bande où naissent les grains met quatre pas à monter des pieds à la tête
const GOLD_FADE: readonly FxColor[] = [FX_COLORS.parchment, FX_COLORS.brightGold, FX_COLORS.brightGold, FX_COLORS.oldGold, FX_COLORS.oldGold];

function mend({ targets, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  const grains = targets.flatMap((target) => {
    const shape = shapeOf(target);
    const total = Math.max(20, Math.min(200, Math.round((shape.width * shape.height) / 30)));
    return Array.from({ length: total }, (_, i) => {
      const start = i === 0 ? 0 : random() * MEND_RISE; // le premier naît dès la première image
      const level = 1 - start / MEND_RISE;               // 1 : aux pieds, 0 : à la tête
      return {
        start, at: shape.point(random, level - 0.15, level + 0.1),
        life: Math.min(between(random, 3, GOLD_FADE.length), Math.floor(STEPS - start)), // aucun ne survit au dernier pas
        trail: random() < 1 / 3,
      };
    });
  });
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const pixels: FxPixel[] = [];
      for (const grain of grains) {
        const age = Math.floor(step - grain.start);
        if (step < grain.start || age >= grain.life) continue;
        const x = grain.at.x, y = grain.at.y - 2 * age;
        pixels.push({ x, y, color: GOLD_FADE[Math.min(GOLD_FADE.length - 1, Math.floor((age * GOLD_FADE.length) / grain.life))] });
        if (grain.trail && age > 0) pixels.push({ x, y: y + 1, color: FX_COLORS.oldGold });
      }
      return pixels;
    },
  };
}

// Aurésor (Elwen, soin du groupe) : « rosée d'or ». Une rosée d'or tombe sur chaque allié : chaque goutte, or vif sous
// un reflet de parchemin, tombe de six pixels par pas, de 24 pixels de haut au plus (celles qui se posent tôt sont déjà
// en chute à la première image, comme une pluie qui entre dans le cadre), et se pose sur un pixel de la moitié haute
// de sa silhouette ; posée, elle brille un pas (un pixel de parchemin cerné d'une croix d'or vif), scintille en
// or vif, puis s'éteint en or ancien
const DEW_FALL = 6;  // pixels par pas
const DEW_GLINT = 3; // pas de vie d'une goutte posée

function dew({ targets, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  const drops = targets.flatMap((target) => {
    const shape = shapeOf(target);
    const total = Math.max(10, Math.min(60, Math.round((shape.width * shape.height) / 110)));
    return Array.from({ length: total }, (_, i) => {
      const at = shape.point(random, 0, 0.5);
      const fall = between(random, 2, 4);                         // pas de chute avant de se poser
      const landed = i === 0 ? 1 : 1 + random() * (STEPS - DEW_GLINT - 2); // le pas où elle se pose : la première, très tôt
      return { at, fall, landed, top: Math.min(at.y, Math.max(0, at.y - fall * DEW_FALL)) };
    });
  });
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const pixels: FxPixel[] = [];
      for (const drop of drops) {
        const before = drop.landed - step; // pas restant avant de se poser
        if (before > drop.fall) continue;
        if (before > 0) {
          // En chute : de son point de départ (jamais au-dessus de la scène) vers le pixel où elle se pose
          const y = Math.max(drop.top, drop.at.y - Math.round(before * DEW_FALL));
          pixels.push({ x: drop.at.x, y: y - 1, color: FX_COLORS.parchment }, { x: drop.at.x, y, color: FX_COLORS.brightGold });
          continue;
        }
        const age = -before;
        if (age >= DEW_GLINT) continue;
        const { x, y } = drop.at;
        if (age < 1) {
          pixels.push({ x, y, color: FX_COLORS.parchment });
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) pixels.push({ x: x + dx, y: y + dy, color: FX_COLORS.brightGold });
        } else pixels.push({ x, y, color: age < 2 ? FX_COLORS.brightGold : FX_COLORS.oldGold });
      }
      return pixels;
    },
  };
}

// Liéver (Elwen, ranime un allié) : « réveil ». Une colonne de lumière dorée se dresse sur l'allié éteint, de son corps
// jusqu'à 48 pixels au-dessus de lui (la hauteur d'un héros relevé) : elle naît mince, s'élargit jusqu'à 29 pixels au
// plus (le tiers d'un héros couché, centrée sur lui), tient, puis se resserre et s'éteint. Ses bords sont d'or ancien,
// son cœur un trait de parchemin, et l'intérieur un semis d'or vif qui scintille, assez clair pour qu'on voie l'allié à
// travers ; des grains de parchemin et d'or vif y montent
const WAKE_HEIGHT = 48;                     // la colonne monte jusqu'à cette hauteur au-dessus de lui, au plus
// Demi-largeur à chaque pas, en quarts de sa pleine demi-largeur. À huit images, le dernier pas (7) n'est pas montré :
// la dernière image est le pas 8, vide ; il sert à un effet plus long ou plus court (mode test)
const WAKE_WIDTH = [1, 2, 4, 4, 4, 4, 2, 1];
const WAKE_MOTES = 14;

function wake({ targets, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  const columns = targets.map((target) => {
    const shape = shapeOf(target);
    const half = Math.max(3, Math.min(14, Math.round(shape.width * 0.3)));
    const top = Math.min(shape.top, Math.max(0, shape.top - WAKE_HEIGHT)); // jamais d'au-dessus de la scène
    return {
      cx: shape.cx, top, bottom: shape.bottom, half,
      motes: Array.from({ length: WAKE_MOTES }, () => ({ dx: between(random, -half + 1, half - 1), y: between(random, shape.top, shape.bottom), start: random() * 4, speed: between(random, 2, 4) })),
    };
  });
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const phase = Math.min(WAKE_WIDTH.length - 1, Math.floor(step));
      const pixels: FxPixel[] = [];
      if (step >= STEPS) return pixels; // éteinte au dernier pas
      for (const column of columns) {
        const half = Math.max(1, Math.round((column.half * WAKE_WIDTH[phase]) / 4));
        for (let y = column.top; y <= column.bottom; y++) {
          pixels.push({ x: column.cx - half, y, color: FX_COLORS.oldGold }, { x: column.cx + half, y, color: FX_COLORS.oldGold });
          if (y % 2 === 0) pixels.push({ x: column.cx, y, color: FX_COLORS.parchment });
          for (let dx = -half + 1; dx < half; dx++) {
            if (dx !== 0 && (dx * 3 + y * 5 + phase * 7) % 9 === 0) pixels.push({ x: column.cx + dx, y, color: FX_COLORS.brightGold });
          }
        }
        for (const mote of column.motes) {
          const age = step - mote.start;
          if (age < 0 || Math.abs(mote.dx) >= half) continue;
          const y = mote.y - Math.round(age * mote.speed);
          if (y < column.top) continue;
          pixels.push({ x: column.cx + mote.dx, y, color: age < 2 ? FX_COLORS.parchment : FX_COLORS.brightGold });
        }
      }
      return pixels;
    },
  };
}

// Sève (objet, rend des PV) : des gouttes pâles tombent sur l'allié, parchemin sur un pied de cendré clair, se posent
// sur le haut de sa silhouette et y éclatent en deux gouttelettes de cendré clair qui glissent de part et d'autre ;
// puis quelques reflets de parchemin perlent sur lui et s'éteignent
const SAP_DROPS = 7;   // gouttes par allié
const SAP_FALL = 6;    // pixels par pas
const SAP_GLEAMS = 10; // reflets par allié

function sap({ targets, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  const allies = targets.map((target) => {
    const shape = shapeOf(target);
    return {
      drops: Array.from({ length: SAP_DROPS }, (_, i) => {
        const at = shape.point(random, 0, 0.35);
        const fall = between(random, 2, 3);
        return { at, fall, landed: i === 0 ? 1 : 1 + random() * 3, top: Math.min(at.y, Math.max(0, at.y - fall * SAP_FALL)) };
      }),
      gleams: Array.from({ length: SAP_GLEAMS }, () => ({ at: shape.point(random, 0.1, 0.9), start: 3 + random() * 2.5 })),
    };
  });
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const pixels: FxPixel[] = [];
      for (const ally of allies) {
        for (const drop of ally.drops) {
          const before = drop.landed - step;
          if (before > drop.fall) continue;
          const { x } = drop.at;
          if (before > 0) {
            const y = Math.max(drop.top + 2, drop.at.y - Math.round(before * SAP_FALL));
            pixels.push({ x, y: y - 2, color: FX_COLORS.parchment }, { x, y: y - 1, color: FX_COLORS.parchment }, { x, y, color: FX_COLORS.paleAsh });
            continue;
          }
          // Posée : elle éclate, puis ses deux gouttelettes glissent d'un pixel par pas, de part et d'autre
          const age = Math.floor(-before);
          if (age >= 3) continue;
          if (age === 0) pixels.push({ x, y: drop.at.y, color: FX_COLORS.parchment });
          pixels.push({ x: x - 1 - age, y: drop.at.y + age, color: FX_COLORS.paleAsh }, { x: x + 1 + age, y: drop.at.y + age, color: FX_COLORS.paleAsh });
        }
        for (const gleam of ally.gleams) {
          const age = step - gleam.start;
          if (age < 0 || age >= 2 || step >= STEPS) continue;
          pixels.push({ ...gleam.at, color: FX_COLORS.parchment });
        }
      }
      return pixels;
    },
  };
}

// Encens (objet, rend des PS) : des volutes de fumée montent des pieds de l'allié et l'enveloppent en ondulant : chaque
// volute est un filet de cendré clair qui s'allonge vers le haut en serpentant, la tête parchemin, la queue de cendre ;
// à la fin, elles se détachent, montent et s'éteignent
const INCENSE_STRANDS = 4;
const INCENSE_RISE = 7;   // pixels par pas de la tête d'une volute
const INCENSE_LENGTH = 22; // longueur d'une volute, au plus

function incense({ targets, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  const strands = targets.flatMap((target) => {
    const shape = shapeOf(target);
    return Array.from({ length: INCENSE_STRANDS }, (_, i) => ({
      // Pieds répartis sur la largeur de la silhouette, un peu au-delà de ses bords
      x: shape.left - 2 + Math.round(((i + 0.5) * (shape.width + 4)) / INCENSE_STRANDS) + between(random, -1, 1),
      base: shape.bottom - between(random, 0, 4),
      start: i === 0 ? 0 : random() * 1.5,
      amplitude: between(random, 2, 4),
      period: 5 + random() * 3,
      phase: random() * 2 * Math.PI,
    }));
  });
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const pixels: FxPixel[] = [];
      if (step >= STEPS) return pixels; // éteintes au dernier pas
      for (const strand of strands) {
        const age = step - strand.start;
        if (age < 0) continue;
        const head = strand.base - Math.round(age * INCENSE_RISE);
        // Sa queue quitte le sol dès qu'elle dépasse sa longueur (vers le pas 3) ; à partir du pas 5, elle raccourcit
        const length = Math.min(INCENSE_LENGTH, Math.round(age * INCENSE_RISE), step >= 5 ? Math.max(0, Math.round(INCENSE_LENGTH * (STEPS - step) / 3)) : INCENSE_LENGTH);
        for (let k = 0; k <= length; k++) {
          const y = head + k;
          if (y > strand.base) break;
          const x = strand.x + Math.round(strand.amplitude * Math.sin((y - strand.base) / strand.period + strand.phase));
          pixels.push({ x, y, color: k === 0 ? FX_COLORS.parchment : k > length * 0.65 ? FX_COLORS.ash : FX_COLORS.paleAsh });
        }
      }
      return pixels;
    },
  };
}

// Larme dorée (objet, ranime un allié) : une larme d'or tombe sur l'allié et éclate sur sa poitrine dans un éclair de
// parchemin ; des éclats d'or partent en étoile et retombent, et des paillettes d'or scintillent sur lui jusqu'à la fin
const TEAR_DROP = 3;     // la larme tombe pendant trois pas
const TEAR_HEIGHT = 40;  // et d'aussi haut, au plus
const TEAR_SPARKS = 12;
const TEAR_FLECKS = 16;

function tear({ targets, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  const allies = targets.map((target) => {
    const shape = shapeOf(target);
    const at = shape.anchor(0.4); // un pixel de sa silhouette, vers la poitrine (ou le milieu du corps couché)
    return {
      // D'où elle tombe : de façon que sa pointe, trois pixels au-dessus de son pied, parte du haut de la scène au plus
      at, top: Math.min(at.y, Math.max(3, at.y - TEAR_HEIGHT)),
      sparks: Array.from({ length: TEAR_SPARKS }, (_, i) => ({ angle: ((i + random() * 0.6) * 2 * Math.PI) / TEAR_SPARKS, speed: 2 + random() * 2 })),
      flecks: Array.from({ length: TEAR_FLECKS }, () => ({ at: shape.point(random, 0, 1), start: TEAR_DROP + 1 + random() * 3, twinkle: between(random, 0, 1) })),
    };
  });
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const pixels: FxPixel[] = [];
      if (step >= STEPS) return pixels; // éteinte au dernier pas
      for (const ally of allies) {
        const { at } = ally;
        if (step < TEAR_DROP) {
          // La larme : une pointe d'or vif, un corps d'or vif au reflet de parchemin, un pied d'or ancien. Sur un allié
          // collé au haut de la scène, ce qui dépasserait du haut n'est pas dessiné
          const y = Math.round(ally.top + ((at.y - ally.top) * step) / TEAR_DROP);
          const drop: FxPixel[] = [
            { x: at.x, y: y - 3, color: FX_COLORS.brightGold },
            { x: at.x, y: y - 2, color: FX_COLORS.parchment }, { x: at.x + 1, y: y - 2, color: FX_COLORS.brightGold },
            { x: at.x - 1, y: y - 1, color: FX_COLORS.brightGold }, { x: at.x, y: y - 1, color: FX_COLORS.brightGold }, { x: at.x + 1, y: y - 1, color: FX_COLORS.brightGold },
            { x: at.x, y, color: FX_COLORS.oldGold },
          ];
          pixels.push(...drop.filter((pixel) => pixel.y >= 0));
          continue;
        }
        const age = step - TEAR_DROP;
        if (age < 1) {
          for (let d = -2; d <= 2; d++) pixels.push({ x: at.x + d, y: at.y, color: FX_COLORS.parchment }, { x: at.x, y: at.y + d, color: FX_COLORS.parchment });
        }
        for (const spark of ally.sparks) {
          if (age >= 3.5) continue;
          pixels.push({
            x: at.x + Math.round(Math.cos(spark.angle) * spark.speed * (age + 1) * 1.5),
            y: at.y + Math.round(Math.sin(spark.angle) * spark.speed * (age + 1) + 0.6 * age * age),
            color: age < 1.5 ? FX_COLORS.brightGold : FX_COLORS.oldGold,
          });
        }
        for (const fleck of ally.flecks) {
          if (step < fleck.start) continue;
          pixels.push({ ...fleck.at, color: (Math.floor(step) + fleck.twinkle) % 2 === 0 ? FX_COLORS.brightGold : FX_COLORS.oldGold });
        }
      }
      return pixels;
    },
  };
}

// — Capacités ennemies (MAE-98) —
// Elles frappent les héros, depuis le côté des ennemis (facing -1 en combat). Chaînes et Pilier ont les couleurs des
// ennemis (docs/character-palette.md, section 7), avec l'os gris pour arête claire (décision de Wesley du 11/11/2026).

// Chaînes (Gau-Tik) : un coup de fouet horizontal. Une ligne de maillons, fer et rouille, aux arêtes d'os gris, part du
// côté de celui qui frappe et cingle le héros en travers, à hauteur de poitrine, en trois pas, en ondulant ; tendue, elle
// tient pendant que des éclats d'os gris jaillissent là où elle mord, puis retombe maillon par maillon, la tête d'abord :
// elle touche le sol aux pieds du héros, le reste la suit, sans jamais passer sous ses pieds, et tout s'éteint au
// dernier pas. Un maillon sur deux est vu à plat (un anneau creux de trois
// pixels de haut), l'autre par la tranche (une barre de rouille)
const CHAIN_LINK = 4;      // longueur d'un maillon, en pixels
const CHAIN_LEVEL = 0.35;  // hauteur du coup dans la silhouette (0 en haut, 1 en bas)
const CHAIN_REACH = 6;     // la chaîne déborde la silhouette de six pixels de chaque côté
const CHAIN_SPARKS = 4;    // éclats là où elle mord

function chains({ targets, facing, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  const whips = targets.map((target) => {
    const shape = shapeOf(target);
    const bite = shape.anchor(CHAIN_LEVEL);
    const start = (facing > 0 ? shape.left : shape.right) - facing * CHAIN_REACH; // du côté de celui qui frappe
    const length = shape.width + 2 * CHAIN_REACH;
    const links = Math.ceil(length / CHAIN_LINK);
    return {
      bite, start, length, links, floor: shape.bottom,
      delays: Array.from({ length: links }, () => random()), // retard de chute de chaque maillon, en demi-pas
      sparks: Array.from({ length: CHAIN_SPARKS }, () => ({ dx: facing * (0.5 + random() * 1.5), dy: 1 + random() * 1.5 })),
    };
  });
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const pixels: FxPixel[] = [];
      if (step >= STEPS) return pixels; // éteinte au dernier pas
      const wave = step < 3 ? 2 * (1 - step / 3) : 0; // l'onde du fouet, qui s'éteint quand la chaîne se tend
      for (const whip of whips) {
        const drawn = Math.min(whip.length, Math.ceil((whip.length * (step + 1)) / 3));
        for (let i = 0; i < drawn; i++) {
          const link = Math.floor(i / CHAIN_LINK), k = i % CHAIN_LINK;
          // Chute : la tête (le bout le plus loin) tombe la première, puis chaque maillon, jusqu'aux pieds
          const age = step - 4 - (whip.links - 1 - link) / whip.links - whip.delays[link] * 0.5;
          const drop = age > 0 ? Math.round(age * (4 + 6 * age)) : 0;
          // Le maillon fait trois rangées (de y - 1 à y + 1) : la dernière s'arrête sur la rangée des pieds
          const y = Math.min(whip.floor - 1, whip.bite.y + Math.round(wave * Math.sin(i / 2.5 - step * 2)) + drop);
          const x = whip.start + facing * i;
          if (link % 2 === 0) {
            if (k === 0 || k === CHAIN_LINK - 1) pixels.push({ x, y, color: FX_COLORS.iron });
            else pixels.push({ x, y: y - 1, color: FX_COLORS.bone }, { x, y: y + 1, color: FX_COLORS.iron });
          } else {
            pixels.push({ x, y, color: FX_COLORS.rust });
            if (k === 1) pixels.push({ x, y: y - 1, color: FX_COLORS.bone });
          }
        }
        for (const spark of whip.sparks) {
          const age = step - 2.5;
          if (age < 0 || age >= 3) continue;
          pixels.push({ x: whip.bite.x + Math.round(spark.dx * age * 2), y: whip.bite.y - Math.round(spark.dy * age) + Math.round(age * age * 0.5), color: FX_COLORS.bone });
        }
      }
      return pixels;
    },
  };
}

// Pilier (Painkush) : un écrasement vertical. Un bloc de pierre cendre, cannelé de fer comme leurs piliers sculptés,
// aux arêtes d'os gris, tombe d'en haut sur la tête du héros en accélérant ; il frappe au troisième pas, s'enfonce
// d'un pixel, puis se brise pixel par pixel, les éclats tombant en s'écartant, pendant que la poussière, cendre et os
// gris, jaillit à ses pieds et s'écarte des deux côtés en rasant le sol. Près du haut de la scène, le bloc part du
// bord, et rien n'est dessiné au-dessus
const PILLAR_FALL = 3;     // le bloc met trois pas à tomber
export const PILLAR_DROP = 36; // il tombe d'aussi haut, au plus : du bord de la scène s'il est plus près
const PILLAR_CROWN = 2;    // son pied se pose sur cette rangée de la silhouette : le sommet du crâne
const PILLAR_SHARD = 1.5;  // un éclat brisé tombe un pas et demi, puis disparaît
const PILLAR_DUST = 8;     // grains de poussière de chaque côté
const PILLAR_DUSTS: readonly (readonly [FxColor, number])[] = [[FX_COLORS.ash, 3], [FX_COLORS.bone, 2]];

function pillar({ targets, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  const blocks = targets.map((target) => {
    const shape = shapeOf(target);
    const width = Math.max(6, Math.min(12, Math.round(shape.width * 0.3)));
    const height = Math.round(width * 2.2);
    const left = shape.cx - Math.floor(width / 2);
    const landed = shape.top + PILLAR_CROWN - height + 1; // haut du bloc posé : son pied sur le sommet du crâne
    // Il part de PILLAR_DROP plus haut, ou du bord de la scène s'il est plus près. S'il ne tient pas sous le bord (un
    // héros collé au haut de la scène), il est déjà posé, coupé par le bord, et ne tombe pas
    const from = Math.max(Math.min(0, landed), landed - PILLAR_DROP);
    // Le bloc : un chapiteau d'os gris un pixel plus large, le côté gauche éclairé (os gris), le droit dans l'ombre (fer),
    // des cannelures de fer, un pied de fer. Chaque pixel se brise à son heure après l'impact, puis tombe en s'écartant
    const cells: { dx: number; dy: number; color: FxColor; breaks: number }[] = [];
    for (let dy = 0; dy < height; dy++) {
      for (let dx = dy === 0 ? -1 : 0; dx < (dy === 0 ? width + 1 : width); dx++) {
        const color = dy === 0 || dx === 0 ? FX_COLORS.bone
          : dx === width - 1 || dy === height - 1 || dx % 3 === 2 ? FX_COLORS.iron : FX_COLORS.ash;
        cells.push({ dx, dy, color, breaks: PILLAR_FALL + 1 + random() * (STEPS - PILLAR_FALL - 1 - PILLAR_SHARD - 0.1) }); // tous brisés et tombés avant le dernier pas
      }
    }
    const dust = [-1, 1].flatMap((side) => Array.from({ length: PILLAR_DUST }, () => ({
      side, speed: 1 + random() * 2, lift: between(random, 0, 2), life: 2.5 + random() * 2, color: pick(random, PILLAR_DUSTS),
    })));
    return { left, landed, from, width, cells, dust, cx: shape.cx, feet: shape.bottom };
  });
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const pixels: FxPixel[] = [];
      for (const block of blocks) {
        const p = Math.min(1, step / PILLAR_FALL);
        const top = step < PILLAR_FALL ? Math.round(block.from + (block.landed - block.from) * p * p) : block.landed + (step >= PILLAR_FALL + 1 ? 1 : 0);
        for (const cell of block.cells) {
          // Brisé : il tombe en s'écartant du milieu du bloc, et disparaît un pas et demi plus tard
          const age = step - cell.breaks;
          if (age >= PILLAR_SHARD) continue;
          const fall = age > 0 ? Math.round(age * (1 + 1.5 * age)) : 0;
          const drift = age > 0 ? Math.sign(cell.dx - (block.width - 1) / 2) * Math.round(age) : 0;
          const y = top + cell.dy + fall;
          if (y >= 0 && y <= block.feet) pixels.push({ x: block.left + cell.dx + drift, y, color: cell.color });
        }
        for (const grain of block.dust) {
          const age = step - PILLAR_FALL;
          if (age < 0 || age >= grain.life) continue;
          const x = block.cx + grain.side * (Math.ceil(block.width / 2) + Math.round(grain.speed * age * 1.5)), y = block.feet - grain.lift;
          pixels.push({ x, y, color: grain.color });
          if (age < 1) pixels.push({ x, y: y - 1, color: grain.color }); // la poussière jaillit, puis rase le sol
        }
      }
      return pixels;
    },
  };
}

// Impact de la Nuée de cendre (le Dragon, MAE-98) : la cendre venue de sa gueule (ashCloud, pendant le sort) prend sur
// les héros touchés. Des braises naissent sur le haut de leur silhouette, sur ses pixels opaques, dès la première
// image et jusqu'au deuxième pas, et rougeoient (environ une sur deux en croix cernée de brun d'ombre, les autres en un
// pixel posé sur son ombre) ; puis chacune s'éteint en cendre qui tombe en dérivant, et passe au brun d'ombre avant de
// disparaître, avant le dernier pas. Sobre, sans couleur claire
// (décision de Wesley du 11/11/2026) : braise sombre, cendre et brun d'ombre seulement, comme le feu du Dragon
// (docs/character-palette.md, section 7)
const CINDER_PER_TARGET = 20;
const CINDER_FIRST = 4;    // braises qui prennent dès la première image, sur chaque héros
const CINDER_REACH = 0.55; // part haute de la silhouette où les braises prennent

function cinder({ targets, count, seed }: AbilityFxInput): FxPlan {
  const random = seeded(seed);
  const grains = targets.flatMap((target) => {
    const shape = shapeOf(target);
    return Array.from({ length: CINDER_PER_TARGET }, (_, i) => ({
      at: shape.point(random, 0, CINDER_REACH),
      start: i < CINDER_FIRST ? 0 : random() * 2, // naît dans les deux premiers pas, quelques-unes dès le premier
      glow: 3 + random() * 2,     // rougeoie jusqu'à ce pas
      end: 6 + random() * 1.9,    // éteinte avant le dernier pas
      cross: random() < 0.5,
      drift: between(random, -1, 1),
    }));
  });
  return {
    count,
    frame(index) {
      const step = clock(index, count);
      const pixels: FxPixel[] = [];
      for (const grain of grains) {
        if (step < grain.start || step >= grain.end) continue;
        const { x, y } = grain.at;
        if (step < grain.glow) {
          if (grain.cross) {
            // Une croix de cinq pixels de braise, cernée de brun d'ombre aux coins : la braise, un peu plus claire que
            // l'armure rouge vin de Maelor et tirant vers le brun orangé, et le brun d'ombre plus sombre qu'elle, la
            // détachent de l'armure comme de la nuit
            for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pixels.push({ x: x + dx, y: y + dy, color: FX_COLORS.shadow });
            for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) pixels.push({ x: x + dx, y: y + dy, color: FX_COLORS.ember });
          } else {
            pixels.push({ x, y: y + 1, color: FX_COLORS.shadow }, { x, y, color: FX_COLORS.ember });
          }
          continue;
        }
        const age = step - grain.glow;
        pixels.push({ x: x + grain.drift * Math.floor(age / 2), y: y + Math.floor(age * 1.5), color: age < 1.5 ? FX_COLORS.ash : FX_COLORS.shadow });
      }
      return pixels;
    },
  };
}

// L'effet de chaque capacité. Ajouter une capacité : son nom dans AbilityEffect (game-data.ts), son dessin ici
const ABILITY_FX: Record<AbilityEffect, (input: AbilityFxInput) => FxPlan> = { slash, twin, sweep, wick, frost, bell, sulfur, mend, dew, wake, sap, incense, tear, chains, pillar, echo, cinder };

// Les images de l'effet d'une capacité sur ses cibles ; avec le mouvement réduit, son image la plus fournie, fixe
export function abilityFx(effect: AbilityEffect, input: AbilityFxInput, reduced: boolean): FxPlan {
  const plan = ABILITY_FX[effect](input);
  return reduced ? still(plan) : plan;
}
