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
// L'impact garde le halo de feu (décision de Wesley du 09/11/2026) jusqu'à son effet en pixels, dans MAE-98.
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

// L'effet en pixels d'une capacité : le sien, sinon l'entaille pour un coup d'arme. null : pas encore d'effet en
// pixels, la scène garde le halo de son élément ou du soin (les capacités d'Elwen et les objets jusqu'à la suite de
// MAE-31, l'impact de la Nuée de cendre jusqu'à MAE-98)
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
const BOLT_HEIGHT = 96; // l'éclair tombe d'aussi haut, au plus : du bord de la scène s'il est plus près
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

// L'effet de chaque capacité. Ajouter une capacité : son nom dans AbilityEffect (game-data.ts), son dessin ici
const ABILITY_FX: Record<AbilityEffect, (input: AbilityFxInput) => FxPlan> = { slash, wick, frost, bell, sulfur };

// Les images de l'effet d'une capacité sur ses cibles ; avec le mouvement réduit, son image la plus fournie, fixe
export function abilityFx(effect: AbilityEffect, input: AbilityFxInput, reduced: boolean): FxPlan {
  const plan = ABILITY_FX[effect](input);
  return reduced ? still(plan) : plan;
}
