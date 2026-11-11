// popup-motion.ts - Le mouvement des chiffres du combat (MAE-99), sans DOM
//
// Chaque chiffre monte au-dessus de sa cible puis s'efface (style.css, popup-rise). Ce module calcule ce qui dépend
// de la scène : le sens du léger glissement de côté d'un « Raté ». view.ts (spawnPopup) le pose en variable CSS.

import type { Combatant } from "../battle/battle.ts";

// Le « Raté » glisse dans le sens du coup, qui vient du camp d'en face : les héros sont à gauche, les ennemis à droite.
// Un héros évite un coup venu de la droite : son chiffre glisse vers la gauche (-1) ; celui d'un ennemi, vers la droite
export function blowDirection(side: Combatant["side"]): -1 | 1 {
  return side === "hero" ? -1 : 1;
}
