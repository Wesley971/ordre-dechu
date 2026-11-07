// framing.test.ts - Cadrage de la scène peinte (MAE-28, MAE-29) : pixel de sprite entier, zone de cadrage, fondus
import { describe, expect, it } from "vitest";
import { CONFIG } from "../config.ts";
import { DECORS } from "../data/decors.ts";
import { computeFraming, type GroupExtent } from "../scene/framing.ts";

const decor = DECORS.lisiere;
const { height } = decor.image;
// Les cinq personnages de la Lisière : héros de 47 pixels, Sankri de 77
const group: GroupExtent = [
  ...Object.values(decor.places.heroes).map((place) => ({ col: place.col, spriteWidth: 47 })),
  ...decor.places.enemies.map((place) => ({ col: place.col, spriteWidth: 77 })),
];
const rows = CONFIG.scene.screenHeightInSpritePixels;

describe("téléphone en portrait : scène entre le groupe et le panneau (MAE-87)", () => {
  const placed: GroupExtent = [
    ...Object.values(decor.places.heroes).map((place) => ({ col: place.col, row: place.row, spriteWidth: 47 })),
    ...decor.places.enemies.map((place) => ({ col: place.col, row: place.row, spriteWidth: 77 })),
  ];

  it.each([[414, 715], [390, 844], [375, 667]])("en %i × %i, deux pixels réels par pixel de sprite, et tout le monde à l'écran", (cssWidth, cssHeight) => {
    const ratio = 2;
    const framing = computeFraming({ cssWidth, cssHeight, ratio }, decor, placed, { top: 124 * ratio, height: (cssHeight - 124 - 272) * ratio });
    expect(framing.spritePixel).toBe(2);
    for (const actor of placed) {
      const x = ((1 + framing.colToNdc(actor.col)) / 2) * cssWidth * ratio;
      const half = (actor.spriteWidth / 2) * framing.spritePixel;
      expect(x - half).toBeGreaterThanOrEqual(0);
      expect(x + half).toBeLessThanOrEqual(cssWidth * ratio);
    }
  });
});

describe("dégagement de la bande et des plaques (MAE-87)", () => {
  const placed: GroupExtent = [
    ...Object.values(decor.places.heroes).map((place) => ({ col: place.col, row: place.row, spriteWidth: 47 })),
    ...decor.places.enemies.map((place) => ({ col: place.col, row: place.row, spriteWidth: 77 })),
  ];
  const size = { cssWidth: 1280, cssHeight: 720, ratio: 1 };
  const clear = { top: 0, height: 720, clearBottom: 184, clearLeft: 384 };
  const screenY = (ndc: number) => (1 - ndc) * 360;
  const screenX = (ndc: number) => (1 + ndc) * 640;

  it("garde les pieds au-dessus de la bande et les sprites à droite des plaques, sans changer leur taille", () => {
    const framing = computeFraming(size, decor, placed, clear);
    expect(framing.spritePixel).toBe(computeFraming(size, decor, placed).spritePixel);
    for (const actor of placed) expect(screenY(framing.rowToNdc(actor.row ?? 0))).toBeLessThanOrEqual(720 - 184 + 0.5);
    const left = Math.min(...placed.map((actor) => screenX(framing.colToNdc(actor.col)) - (actor.spriteWidth / 2) * framing.spritePixel));
    expect(left).toBeGreaterThanOrEqual(384 - 0.5);
  });

  // La bande suit la hauteur de l'écran : --band-height, plus 8 px de marge (--scene-clear-bottom, style.css)
  it.each([
    [3440, 1267, 1, 312.08],
    [1920, 1080, 1, 267.2],
    [1600, 900, 1, 224],
    [1536, 864, 1.25, 215.36],
    [1280, 720, 1, 184],
  ])("en %i × %i à %d, les pieds restent au-dessus de la bande, sans changer la taille des sprites", (cssWidth, cssHeight, ratio, clearCss) => {
    const screen = { cssWidth, cssHeight, ratio };
    const deviceHeight = cssHeight * ratio;
    const area = { top: 0, height: deviceHeight, clearBottom: clearCss * ratio, clearLeft: 384 * ratio };
    const framing = computeFraming(screen, decor, placed, area);
    expect(framing.spritePixel).toBe(computeFraming(screen, decor, placed).spritePixel);
    for (const actor of placed) {
      const feet = ((1 - framing.rowToNdc(actor.row ?? 0)) / 2) * deviceHeight;
      expect(feet).toBeLessThanOrEqual(deviceHeight - clearCss * ratio + 0.5);
    }
  });

  it("ne bouge rien quand il y a déjà la place", () => {
    const big = { cssWidth: 3440, cssHeight: 1600, ratio: 1 };
    const moved = computeFraming(big, decor, placed, { top: 0, height: 1600, clearBottom: 184, clearLeft: 384 });
    const still = computeFraming(big, decor, placed, { top: 0, height: 1600 });
    expect(moved.rowToNdc(500)).toBeCloseTo(still.rowToNdc(500));
    expect(moved.colToNdc(500)).toBeCloseTo(still.colToNdc(500));
  });
});

describe("cadrage sans zone : tout le canvas", () => {
  it("prend un pixel de sprite entier d'après la hauteur et remplit la hauteur", () => {
    const framing = computeFraming({ cssWidth: 1600, cssHeight: 900, ratio: 1 }, decor, group);
    expect(framing.spritePixel).toBe(Math.round(900 / rows));
    expect(framing.fitted).toBe(false);
    expect(framing.rowToNdc(0)).toBeCloseTo(1, 6);
    expect(framing.rowToNdc(height)).toBeCloseTo(-1, 6);
    expect(framing.fadeTop).toBe(false);
    expect(framing.fadeBottom).toBe(false);
    expect(framing.safeBottomNdc).toBeCloseTo(-1, 6);
  });

  it("sur un écran étroit, la largeur limite le pixel et la peinture ne remplit plus la hauteur", () => {
    const framing = computeFraming({ cssWidth: 390, cssHeight: 844, ratio: 3 }, decor, group);
    expect(framing.fitted).toBe(true);
    expect(framing.spritePixel).toBeGreaterThanOrEqual(1);
    expect(framing.rowToNdc(0)).toBeLessThan(1);
    expect(framing.rowToNdc(height)).toBeGreaterThan(-1);
    expect(framing.fadeTop).toBe(true);
    expect(framing.fadeBottom).toBe(true);
    // Centrée verticalement
    expect(framing.rowToNdc(0) + framing.rowToNdc(height)).toBeCloseTo(0, 6);
  });
});

describe("cadrage dans une zone : au-dessus des fenêtres du bas (MAE-29)", () => {
  // Écran de 1267 lignes, fenêtres du bas sur 208 pixels : la zone va du haut à 1059
  const size = { cssWidth: 3440, cssHeight: 1267, ratio: 1 };
  const safe = { top: 0, height: 1059 };

  it("le pixel de sprite suit la hauteur de la zone, pas celle du canvas", () => {
    const framing = computeFraming(size, decor, group, safe);
    expect(framing.spritePixel).toBe(Math.round(1059 / rows));
    expect(framing.fitted).toBe(false);
  });

  it("la peinture touche le haut du canvas et s'arrête au bas de la zone", () => {
    const framing = computeFraming(size, decor, group, safe);
    expect(framing.rowToNdc(0)).toBeCloseTo(1, 6);
    expect(framing.rowToNdc(height)).toBeCloseTo(1 - (2 * 1059) / 1267, 6);
    expect(framing.safeBottomNdc).toBeCloseTo(1 - (2 * 1059) / 1267, 6);
    expect(framing.fadeTop).toBe(false);
    expect(framing.fadeBottom).toBe(true);
  });

  it("la distance de la caméra dépend du canvas entier : la projection ne change pas avec la zone", () => {
    const whole = computeFraming(size, decor, group);
    const zoned = computeFraming(size, decor, group, { top: 0, height: 1267 });
    expect(zoned.cameraDistance).toBeCloseTo(whole.cameraDistance, 9);
    expect(zoned.spritePixel).toBe(whole.spritePixel);
  });

  it("une zone décalée du haut (écran de téléphone en paysage) centre la peinture dans la zone", () => {
    // Zone en pixels réels : 80 pixels du haut, 440 de haut, sur un canvas de 780 (390 CSS à densité 2)
    const framing = computeFraming({ cssWidth: 844, cssHeight: 390, ratio: 2 }, decor, group, { top: 80, height: 440 });
    const center = (framing.rowToNdc(0) + framing.rowToNdc(height)) / 2;
    expect(center).toBeCloseTo(1 - (2 * (80 + 220)) / 780, 6);
    expect(framing.fadeTop).toBe(true);
    expect(framing.fadeBottom).toBe(true);
    expect(framing.spritePixel).toBeGreaterThanOrEqual(2); // jamais sous 2 pixels réels
  });
});
