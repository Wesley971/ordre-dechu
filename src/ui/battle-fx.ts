// battle-fx.ts - Effets spéciaux du combat en pixel art (MAE-95), sans DOM
//
// Un effet est une suite d'images sur la grille commune de douze images par seconde (sprite-motion.ts) : à chaque
// image, une liste de pixels, chacun à une position entière et d'une couleur prise dans les fiches des personnages
// (docs/character-palette.md). La couche qui les affiche (fx-layer.ts) est en pixels de sprite, agrandie d'un nombre
// entier de pixels réels, comme les sprites : aucun lissage, aucun mouvement plus fin qu'un pixel de sprite.
// Le hasard vient d'un générateur à graine propre, jamais de Math.random : un seul tirage de plus décalerait ceux du
// combat, et le bot ne rejouerait plus la même partie (testé pour chaque effet, src/dev/battle-fx.test.ts).

import type { OpaqueRuns } from "./sprite-frames.ts";

// Couleurs des effets, toutes dans les fiches
export const FX_COLORS = {
  ash: "#45403a",       // cendre (palette commune ; nuage du Dragon, docs/enemy-sheets.md)
  ember: "#7a2a14",     // braise sombre (touche des ennemis ; braises du nuage)
  shadow: "#2a2018",    // brun d'ombre (palette commune ; bas de la rampe d'or de l'écho)
  oldGold: "#c9a84c",   // or ancien (héritage immortel)
  brightGold: "#f0c95a", // or vif (yeux de Maelor et de l'écho)
  parchment: "#f1e4c3", // parchemin (haut de la rampe d'or de l'écho)
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
// L'impact garde l'effet de feu des souffles (décision de Wesley du 09/11/2026 ; les effets sur les cibles : MAE-31).
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
