// tints.ts - Teintes passagères des combattants, définies une seule fois (MAE-31), sans DOM
//
// Une teinte existe sous deux formes, écrites côte à côte ici et nulle part ailleurs :
// - le filtre CSS des sprites de la scène DOM et de l'aperçu des animations. style.css le lit dans une variable
//   --tint-<nom>, posée sur la scène par applyTints (comme --scene-px, stage.ts) ;
// - son équivalent dans la scène peinte, qui n'a pas de filtre CSS : une couleur mêlée au sprite (color), la part de
//   cette couleur (mix) et l'éclat du sprite teinté (brightness, 1 : inchangé).
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
  // Le coup reçu
  hit: { filter: "brightness(1.8) sepia(0.6) hue-rotate(-30deg)", color: "#ff8c3c", mix: 0.45, brightness: 1.4 },
} satisfies Record<string, Tint>;

// Teintes candidates du coup reçu (MAE-98), montrées côte à côte avec les éclats du sang doré dans l'aperçu
// (?animations=1), pour que Wesley choisisse au moment du dosage : l'orange actuel et deux teintes de la palette des
// personnages. Hors de TINTS : chaque teinte de TINTS devient une variable CSS, que style.css doit lire. La teinte
// choisie remplacera TINTS.hit, et cette liste sera retirée
export const HIT_CANDIDATES: readonly { label: string; tint: Tint }[] = [
  { label: "Orange actuel", tint: TINTS.hit },
  // Un éclair pâle, le parchemin, cœur clair des effets : en DOM, le sprite très éclairci, à peine doré (sepia 0,3) ;
  // dans la scène peinte, éclairci puis mêlé à moitié de parchemin
  { label: "Éclair parchemin", tint: { filter: "brightness(1.9) sepia(0.3) saturate(0.8)", color: FX_COLORS.parchment, mix: 0.5, brightness: 1.5 } },
  // Un rougeoiement, la braise sombre des ennemis et du feu du Dragon : en DOM, le sprite passe au rouge brun saturé, un
  // peu éclairci ; dans la scène peinte, mêlé à 45 % de braise sombre, qui assombrit ses pixels clairs (l'éclat de 1,15
  // n'éclaircit que les sombres). Les deux formes diffèrent plus que pour les autres teintes : l'aperçu montre les deux
  { label: "Braise sombre", tint: { filter: "brightness(1.15) sepia(1) saturate(3) hue-rotate(-25deg)", color: FX_COLORS.ember, mix: 0.45, brightness: 1.15 } },
];

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
