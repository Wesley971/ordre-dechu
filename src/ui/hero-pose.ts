// hero-pose.ts - Pose de fond d'un héros d'après l'état du combat, commune aux deux scènes (MAE-30, MAE-94)
// Sans DOM : testé sous Node (src/dev/hero-pose.test.ts).

import type { BaseName } from "./sprite-motion.ts";

// Ce que followHero demande au sprite animé (AnimatedSprite) : sa pose de fond, et de quoi la changer
export interface PosedSprite {
  readonly base: BaseName;
  play(name: "fall" | "revive"): void;
  setBase(name: BaseName): void;
}

// Une extinction joue la chute, un réveil la réanimation. acting : le héros agit, avancé.
// celebrating : victoire, un héros en danger passe debout pour la fêter (décision de Wesley du 09/11/2026, MAE-94)
export function followHero(
  sprite: PosedSprite, flags: { ko: boolean; critical: boolean }, acting: boolean, celebrating = false,
) {
  if (flags.ko) {
    if (sprite.base !== "ko") { sprite.play("fall"); sprite.setBase("ko"); }
    return;
  }
  const target: BaseName = acting ? "acting" : flags.critical && !celebrating ? "critical" : "idle";
  if (sprite.base === "ko") sprite.play("revive");
  if (sprite.base !== target) sprite.setBase(target);
}
