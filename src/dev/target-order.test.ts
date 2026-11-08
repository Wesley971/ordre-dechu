// target-order.test.ts - Ciblage dans l'ordre de l'écran et clic direct sur un ennemi (MAE-89)
import { describe, expect, it } from "vitest";
import { canStrike, screenOrder, stepAlong, STRIKE_GUARD_MS, type StrikeQuery } from "../ui/target-order.ts";

describe("ordre de l'écran", () => {
  it("classe de gauche à droite, quel que soit l'ordre des données", () => {
    // Les héros sont placés en escalier : Maelor au milieu, Corvin à gauche, Elwen à droite
    const line = screenOrder([
      { item: "maelor", x: 612, y: 550 },
      { item: "corvin", x: 497, y: 609 },
      { item: "elwen", x: 689, y: 658 },
    ]);
    expect(line).toEqual(["corvin", "maelor", "elwen"]);
  });

  it("départage deux sprites à la même hauteur de colonne par leur hauteur", () => {
    expect(screenOrder([{ item: "bas", x: 100, y: 300 }, { item: "haut", x: 100, y: 200 }])).toEqual(["haut", "bas"]);
  });

  it("ne modifie pas la liste reçue", () => {
    const placed = [{ item: "b", x: 2, y: 0 }, { item: "a", x: 1, y: 0 }];
    screenOrder(placed);
    expect(placed.map(p => p.item)).toEqual(["b", "a"]);
  });
});

describe("cible voisine", () => {
  const line = ["corvin", "maelor", "elwen", "sankri-1", "sankri-2"];

  it("passe à gauche ou à droite, y compris d'un camp à l'autre", () => {
    expect(stepAlong(line, "maelor", 1)).toBe("elwen");
    expect(stepAlong(line, "maelor", -1)).toBe("corvin");
    expect(stepAlong(line, "elwen", 1)).toBe("sankri-1");
    expect(stepAlong(line, "sankri-1", -1)).toBe("elwen");
  });

  it("s'arrête aux deux bouts, sans revenir à l'autre bout", () => {
    expect(stepAlong(line, "corvin", -1)).toBeNull();
    expect(stepAlong(line, "sankri-2", 1)).toBeNull();
  });

  it("ne bouge pas si la cible actuelle n'est pas sur la ligne", () => {
    expect(stepAlong(line, "vahn", 1)).toBeNull();
  });
});

describe("clic direct sur un ennemi", () => {
  const ready: StrikeQuery = { atRoot: true, attackEnabled: true, isCandidate: true, pointerLayout: true, sinceOpenMs: 1000 };

  it("frappe depuis le menu principal, sur ordinateur", () => {
    expect(canStrike(ready)).toBe(true);
  });

  it("ne fait rien dans un sous-menu, sur un allié ou un ennemi à terre, ni sur téléphone", () => {
    expect(canStrike({ ...ready, atRoot: false })).toBe(false);
    expect(canStrike({ ...ready, isCandidate: false })).toBe(false);
    expect(canStrike({ ...ready, attackEnabled: false })).toBe(false);
    expect(canStrike({ ...ready, pointerLayout: false })).toBe(false);
  });

  it("ignore le second clic d'un double clic, juste après l'ouverture du menu", () => {
    expect(canStrike({ ...ready, sinceOpenMs: STRIKE_GUARD_MS - 1 })).toBe(false);
    expect(canStrike({ ...ready, sinceOpenMs: STRIKE_GUARD_MS })).toBe(true);
  });
});
