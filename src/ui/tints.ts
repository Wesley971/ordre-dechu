// tints.ts - Teintes passagères des combattants, définies une seule fois (MAE-31), sans DOM
//
// Une teinte existe sous deux formes, écrites côte à côte ici et nulle part ailleurs :
// - le filtre CSS des sprites de la scène DOM et de l'aperçu des animations. style.css le lit dans une variable
//   --tint-<nom>, posée sur la scène par applyTints (comme --scene-px, stage.ts) ;
// - son équivalent dans la scène peinte, qui n'a pas de filtre CSS : une couleur mêlée au sprite (color), la part de
//   cette couleur (mix) et l'éclat du sprite teinté (brightness, 1 : inchangé) ; avec gain (MAE-98, le coup reçu), la
//   luminosité du sprite prend la teinte de la couleur au lieu de la mêler telle quelle (formule : paintedTint).
// Les courbes des animations (montée, retombée, fondu de la mort) restent dans chaque scène et dans style.css.
// Ce module doit rester une feuille : les scènes et l'aperçu lisent TINTS dès leur chargement, donc il n'importe
// aucune scène ni view.ts (seulement battle-fx.ts, qui n'importe que des types).

import { FX_COLORS } from "./battle-fx.ts";

export interface Tint {
  filter: string;
  rest?: string;       // le même filtre sans effet, fonction pour fonction : départ et retour d'une animation CSS par paliers
  color: string;
  mix: number;
  brightness?: number; // absent : l'éclat suit la courbe de l'animation (la mort s'éclaire puis s'éteint)
  // Présent (MAE-98) : dans la scène peinte, au lieu de mêler color telle quelle, la luminosité de chaque pixel est
  // colorée de la teinte de color, multipliée par gain, puis mêlée à hauteur de mix (paintedTint). Un pixel clair reste
  // clair, comme sous un filtre CSS sepia
  gain?: number;
}

// La teinte telle que la scène peinte la pose sur un pixel, en sRGB de 0 à 1 : la formule du shader des sprites
// (src/scene/actors.ts), écrite ici sans DOM pour l'aperçu des animations, qui l'imite, et pour les tests, qui la
// comparent au filtre CSS. L'éclat multiplie le pixel en lumière linéaire ; puis, sans gain, color s'y mêle en lumière
// linéaire (comme Three.js) ; avec gain, sa luminosité (en sRGB, poids des filtres CSS) prend la teinte de color, et
// s'y mêle en sRGB
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp = (c: number) => Math.max(0, Math.min(1, c));
export const LUMA = [0.299, 0.587, 0.114] as const; // as const : trois poids fixes, rouge, vert, bleu
export function paintedTint(rgb: readonly number[], tint: Tint): number[] {
  const color = [1, 3, 5].map((at) => parseInt(tint.color.slice(at, at + 2), 16) / 255);
  const lit = rgb.map((c) => toLinear(c) * (tint.brightness ?? 1));
  if (tint.gain === undefined) return lit.map((c, k) => clamp(toSrgb(Math.min(1, c * (1 - tint.mix) + toLinear(color[k]) * tint.mix))));
  const gain = tint.gain;
  const shown = lit.map((c) => toSrgb(clamp(c)));
  const luma = shown.reduce((sum, c, k) => sum + c * LUMA[k], 0);
  const top = Math.max(...color);
  return shown.map((c, k) => clamp(c * (1 - tint.mix) + clamp((luma * gain * color[k]) / top) * tint.mix));
}

export const TINTS = {
  // L'or de l'héritage immortel : l'écho de Maelor qui se défait en lumière, l'éclat de Maelor quand l'or le quitte (MAE-95)
  gold: {
    filter: "brightness(1.45) sepia(1) saturate(2.2) hue-rotate(-8deg)",
    rest: "brightness(1) sepia(0) saturate(1) hue-rotate(0deg)",
    color: FX_COLORS.brightGold, mix: 0.6, brightness: 1.35,
  },
  // La mort d'un ennemi, qui se dissout
  death: { filter: "sepia(1) saturate(6) hue-rotate(250deg)", color: "#7a4fd6", mix: 0.7 },
  // Le coup reçu : un rougeoiement de braise (MAE-98, choisi par Wesley le 11/11/2026 entre l'ancien orange #ff8c3c et
  // deux teintes de la palette, tel qu'il rend en scène DOM, à côté des éclats du sang doré). En DOM, le sprite passe au
  // rouge brun saturé, un peu éclairci, chaque pixel gardant sa clarté. Dans la scène peinte, la même chose par la
  // luminosité colorée (gain, validé par Wesley le même jour) : mêler une couleur telle quelle assombrissait les pixels
  // clairs. La teinte de la palette la plus proche du filtre CSS est la rouille des ennemis, pas la braise sombre (trop
  // rouge) : mesuré dans Edge sur les 81 couleurs des héros, l'écart moyen au rendu DOM est de 6 sur 255 ; le test le
  // garde sous 12 sur 255 sur les couleurs de la palette, face à un calcul du filtre CSS (tints.test.ts)
  hit: { filter: "brightness(1.15) sepia(1) saturate(3) hue-rotate(-25deg)", color: FX_COLORS.rust, mix: 0.9, brightness: 1, gain: 2.3 },
} satisfies Record<string, Tint>;

// Variables CSS des teintes : --tint-<nom>, et --tint-<nom>-rest pour une teinte qui a son filtre sans effet
export function tintVariables(): [string, string][] {
  return Object.entries<Tint>(TINTS).flatMap(([name, tint]) => [
    [`--tint-${name}`, tint.filter] as [string, string], // as : une paire nom, valeur, pas un tableau de chaînes
    ...(tint.rest ? [[`--tint-${name}-rest`, tint.rest] as [string, string]] : []), // as : idem
  ]);
}

// Pose les teintes sur un élément (la scène DOM) : style.css les lit dans ses filtres et ses animations
export function applyTints(style: { setProperty(name: string, value: string): void }) {
  for (const [name, value] of tintVariables()) style.setProperty(name, value);
}
