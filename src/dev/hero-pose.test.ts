// hero-pose.test.ts - Pose de fond d'un héros d'après l'état du combat (MAE-30, MAE-94)
import { describe, expect, it } from "vitest";
import { followHero, type PosedSprite } from "../ui/hero-pose.ts";
import type { BaseName } from "../ui/sprite-motion.ts";

// Faux sprite : il garde sa pose de fond et note les gestes lancés
function fakeSprite(base: BaseName) {
  const played: string[] = [];
  const sprite: PosedSprite = {
    get base() { return base; },
    play(name) { played.push(name); },
    setBase(name) { base = name; },
  };
  return { sprite, played };
}

const DANGER = { ko: false, critical: true };

describe("pose de fond d'un héros", () => {
  it("en danger : à genoux ; pour agir, debout", () => {
    const { sprite } = fakeSprite("idle");
    followHero(sprite, DANGER, false);
    expect(sprite.base).toBe("critical");
    followHero(sprite, DANGER, true);
    expect(sprite.base).toBe("acting");
  });

  it("victoire : un héros en danger passe debout, et y reste quand l'état est relu", () => {
    const { sprite } = fakeSprite("critical");
    followHero(sprite, DANGER, false, true);
    expect(sprite.base).toBe("idle");
    followHero(sprite, DANGER, false, true); // refresh après la victoire (montée de niveau...)
    expect(sprite.base).toBe("idle");
  });

  it("K.O. : la chute puis la pose au sol, une seule fois ; réveillé, la réanimation", () => {
    const { sprite, played } = fakeSprite("critical");
    followHero(sprite, { ko: true, critical: false }, false);
    followHero(sprite, { ko: true, critical: false }, false);
    expect(played).toEqual(["fall"]);
    expect(sprite.base).toBe("ko");
    followHero(sprite, { ko: false, critical: false }, false);
    expect(played).toEqual(["fall", "revive"]);
    expect(sprite.base).toBe("idle");
  });

  it("un héros à terre ne se relève pas pour la victoire", () => {
    const { sprite } = fakeSprite("ko");
    followHero(sprite, { ko: true, critical: false }, false, true);
    expect(sprite.base).toBe("ko");
  });
});
