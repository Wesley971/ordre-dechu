// battle-fx.test.ts - Effets spéciaux du combat en pixel art (MAE-95), sans DOM
import { describe, expect, it } from "vitest";
import palette from "../../docs/character-palette.md?raw";
import { along, between, FX_COLORS, pick, seeded } from "../ui/battle-fx.ts";
import { layerGeometry } from "../ui/fx-layer.ts";

describe("moteur des effets", () => {
  it("chaque couleur des effets vient de la palette des personnages", () => {
    for (const color of Object.values(FX_COLORS)) expect(palette).toContain(`\`${color}\``);
  });

  it("le générateur à graine rend toujours la même suite, de 0 à 1, différente d'une graine à l'autre", () => {
    const draw = (seed: number) => { const random = seeded(seed); return Array.from({ length: 50 }, random); };
    expect(draw(7)).toEqual(draw(7));
    expect(draw(7)).not.toEqual(draw(8));
    for (const value of draw(3)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("between et pick restent dans leurs bornes et leurs couleurs", () => {
    const random = seeded(1);
    const weighted = [[FX_COLORS.ash, 3], [FX_COLORS.ember, 1]] as const; // as const : des paires (couleur, poids), pas un tableau mêlé
    for (let i = 0; i < 200; i++) {
      const n = between(random, 2, 5);
      expect(Number.isInteger(n) && n >= 2 && n <= 5).toBe(true);
      expect([FX_COLORS.ash, FX_COLORS.ember]).toContain(pick(random, weighted));
    }
  });

  it("un trajet part du départ, arrive à l'arrivée, en pixels entiers, et monte au milieu de l'arc", () => {
    const from = { x: 10, y: 40 }, to = { x: 60, y: 40 };
    expect(along(from, to, 0, 8)).toEqual(from);
    expect(along(from, to, 1, 8)).toEqual(to);
    expect(along(from, to, 0.5, 8)).toEqual({ x: 35, y: 32 });
    for (let p = 0; p <= 1; p += 0.07) {
      const { x, y } = along(from, to, p, 8);
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
    }
  });
});

describe("couche des effets : netteté", () => {
  const near = (value: number) => Math.abs(value - Math.round(value)) < 1e-9;
  // Écran de 1600 × 900 (ordinateur), et 390 × 844 à la densité d'un iPhone 11 (2) ou d'un écran à 125 %
  const cases = [
    { ratio: 1, pixelSize: 3, host: { left: 0, top: 0, width: 1600, height: 900 }, grid: { left: 803, top: 412 } },
    { ratio: 2, pixelSize: 1.5, host: { left: 0, top: 0, width: 390, height: 844 }, grid: { left: 100.5, top: 341 } },
    { ratio: 1.25, pixelSize: 2.4, host: { left: 12.8, top: 0, width: 1200, height: 700 }, grid: { left: 50.4, top: 33.6 } },
    { ratio: 2, pixelSize: 1, host: { left: 0, top: 120, width: 390, height: 600 }, grid: { left: 33, top: 410.5 } },
  ];

  it.each(cases)("densité $ratio : canvas sur un pixel réel, agrandi d'un nombre entier de pixels réels, calé sur le sprite, couvrant la scène", ({ ratio, pixelSize, host, grid }) => {
    const g = layerGeometry(host, grid, ratio, pixelSize);
    expect(near(g.px * ratio)).toBe(true);                       // un pixel de sprite : un nombre entier de pixels réels
    expect(near(g.origin.left * ratio) && near(g.origin.top * ratio)).toBe(true); // coin sur un pixel réel
    expect(near((grid.left - g.origin.left) / g.px) && near((grid.top - g.origin.top) / g.px)).toBe(true); // grille du sprite
    expect(g.origin.left).toBeLessThanOrEqual(host.left + 1e-9);
    expect(g.origin.left).toBeGreaterThan(host.left - g.px);
    expect(g.origin.top).toBeLessThanOrEqual(host.top + 1e-9);
    expect(g.origin.top).toBeGreaterThan(host.top - g.px);
    expect(g.origin.left + g.columns * g.px).toBeGreaterThanOrEqual(host.left + host.width - 1e-9);
    expect(g.origin.top + g.rows * g.px).toBeGreaterThanOrEqual(host.top + host.height - 1e-9);
    expect(g.offset).toEqual({ left: g.origin.left - host.left, top: g.origin.top - host.top });
  });

  it("une taille de pixel qui n'est pas un nombre entier de pixels réels est arrondie, jamais sous un pixel réel", () => {
    const host = { left: 0, top: 0, width: 100, height: 100 };
    expect(layerGeometry(host, { left: 0, top: 0 }, 2, 1.3).px).toBe(1.5);
    expect(layerGeometry(host, { left: 0, top: 0 }, 2, 0).px).toBe(1); // inconnue : 1 pixel CSS
    expect(layerGeometry(host, { left: 0, top: 0 }, 2, 0.1).px).toBe(0.5);
  });
});
