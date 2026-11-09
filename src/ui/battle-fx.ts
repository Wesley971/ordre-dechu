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
