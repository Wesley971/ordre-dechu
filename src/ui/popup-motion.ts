// popup-motion.ts - Le mouvement des chiffres du combat (MAE-99), sans DOM
//
// Chaque chiffre monte au-dessus de sa cible puis s'efface (style.css, popup-rise). Ce module calcule ce qui dépend
// de la scène : le glissement de côté d'un « Raté », la pile des chiffres d'une même cible et le recadrage d'un
// chiffre dans l'écran. view.ts (spawnPopup) les pose en variables CSS.

import type { Combatant } from "../battle/battle.ts";

export const MISS_DRIFT = 12;  // glissement d'un « Raté », en pixels CSS
export const POPUP_STACK = 3;  // chiffres vivants au plus sur une même cible : au-delà, le plus ancien part
export const POPUP_GAP = 2;    // écart entre deux chiffres empilés, en pixels CSS
export const SCREEN_EDGE = 4;  // marge gardée entre un chiffre et le bord de l'écran, en pixels CSS

// Le « Raté » glisse dans le sens du coup, qui vient du camp d'en face : les héros sont à gauche, les ennemis à droite.
// Un héros évite un coup venu de la droite : son chiffre glisse vers la gauche (-1) ; celui d'un ennemi, vers la droite
export function blowDirection(side: Combatant["side"]): -1 | 1 {
  return side === "hero" ? -1 : 1;
}

// Le glissement d'un chiffre, en pixels CSS : seul un « Raté » glisse
export function popupDrift(side: Combatant["side"], miss: boolean): number {
  return miss ? blowDirection(side) * MISS_DRIFT : 0;
}

// La pile d'une cible (décision de Wesley du 11/11/2026 : ses chiffres ne se recouvrent plus). heights : la hauteur
// affichée de chaque chiffre vivant, du plus récent au plus ancien. Rend de combien chacun est remonté : le plus récent
// reste à sa place, chaque plus ancien passe au-dessus de ceux qui sont nés après lui. Tous montent au même rythme et
// sont placés par leur bas : un plus ancien, parti plus tôt, est toujours au moins aussi haut dans sa montée
export function stackOffsets(heights: readonly number[], gap = POPUP_GAP): number[] {
  let lift = 0;
  return heights.map((height) => {
    const at = lift;
    lift += height + gap;
    return at;
  });
}

// Le décalage horizontal qui garde un chiffre ([left, right], glissement compris) entre min et max. Plus large que
// la place : calé à gauche
export function nudgeInto(left: number, right: number, min: number, max: number): number {
  if (right - left > max - min || left < min) return min - left;
  if (right > max) return max - right;
  return 0;
}
