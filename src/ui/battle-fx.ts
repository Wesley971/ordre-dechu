// battle-fx.ts - Effets spéciaux du combat en pixel art (MAE-95), sans DOM
//
// Un effet est une suite d'images sur la grille commune de douze images par seconde (sprite-motion.ts) : à chaque
// image, une liste de pixels, chacun à une position entière et d'une couleur prise dans les fiches des personnages
// (docs/character-palette.md). La couche qui les affiche (fx-layer.ts) est en pixels de sprite, agrandie d'un nombre
// entier de pixels réels, comme les sprites : aucun lissage, aucun mouvement plus fin qu'un pixel de sprite.
// Le hasard vient d'un générateur à graine propre, jamais de Math.random : un seul tirage de plus décalerait ceux du
// combat, et le bot ne rejouerait plus la même partie (testé pour chaque effet, src/dev/battle-fx.test.ts).

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
            const behind = along(grain.from, grain.to, p - back / (count * grain.flight), grain.arc);
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
