// battle-fx.test.ts - Effets spéciaux du combat en pixel art (MAE-95), sans DOM
import { describe, expect, it, vi } from "vitest";
import { CONFIG } from "../config.ts";
import palette from "../../docs/character-palette.md?raw";
import { along, ashCloud, ashVeil, between, FX_COLORS, goldStream, lightRise, pick, seeded, streamsGold, type FxBox, type FxPlan } from "../ui/battle-fx.ts";
import { composeFrame, frameLayout, opaqueRuns, REST_BODY, type BodyPose, type OpaqueRuns } from "../ui/sprite-frames.ts";
import { frameCount, unravelCleared } from "../ui/sprite-motion.ts";
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

describe("Nuée de cendre", () => {
  it("dure au plus le sort et la lecture des chiffres : finie avant l'action suivante", () => {
    expect(CONFIG.timing.ashCloud).toBeLessThanOrEqual(CONFIG.timing.cast + CONFIG.timing.effect);
  });

  const mouth = { x: 300, y: 120 };
  const heroes = [{ left: 40, top: 100, right: 87, bottom: 166 }, { left: 100, top: 80, right: 147, bottom: 146 }];
  const COUNT = 12;
  const colors: string[] = Object.values(FX_COLORS);
  const all = (plan: FxPlan) => Array.from({ length: plan.count }, (_, i) => plan.frame(i));

  it("ne tire jamais Math.random, et rend les mêmes images pour la même graine", () => {
    const spy = vi.spyOn(Math, "random");
    try {
      expect(all(ashCloud(mouth, heroes, COUNT, 4))).toEqual(all(ashCloud(mouth, heroes, COUNT, 4)));
      expect(all(ashVeil(heroes, COUNT, 4))).toEqual(all(ashVeil(heroes, COUNT, 4)));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("part de la gueule, en pixels entiers aux couleurs des fiches, et reste entre la gueule et les héros", () => {
    const frames = all(ashCloud(mouth, heroes, COUNT, 1));
    expect(frames).toHaveLength(COUNT);
    expect(frames[0].length).toBeGreaterThan(0);
    for (const { x, y } of frames[0]) {
      expect(Math.abs(x - mouth.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(y - mouth.y)).toBeLessThanOrEqual(1);
    }
    for (const pixel of frames.flat()) {
      expect(Number.isInteger(pixel.x) && Number.isInteger(pixel.y)).toBe(true);
      expect(colors).toContain(pixel.color);
      expect(pixel.x).toBeGreaterThanOrEqual(40);
      expect(pixel.x).toBeLessThanOrEqual(mouth.x + 2);
      expect(pixel.y).toBeGreaterThanOrEqual(80 - 11);   // arc de 10 pixels au plus au-dessus du trajet
      expect(pixel.y).toBeLessThanOrEqual(166 + COUNT);  // posé, il retombe d'un pixel toutes les deux images
    }
  });

  it("se pose sur chaque héros visé, puis s'éteint avant la fin", () => {
    const frames = all(ashCloud(mouth, heroes, COUNT, 2));
    const inside = (box: FxBox) => frames.some((frame) => frame.some(({ x, y }) => x >= box.left && x < box.right && y >= box.top && y < box.bottom));
    for (const box of heroes) expect(inside(box)).toBe(true);
    expect(frames[COUNT - 1].length).toBeLessThan(frames[Math.floor(COUNT / 2)].length);
  });

  it("mouvement réduit : un voile fixe sur le haut du corps des héros, le même à chaque image", () => {
    const frames = all(ashVeil(heroes, COUNT, 3));
    for (const frame of frames) expect(frame).toEqual(frames[0]);
    for (const { x, y, color } of frames[0]) {
      expect(colors).toContain(color);
      expect(heroes.some((box) => x >= box.left && x < box.right && y >= box.top && y < box.top + (box.bottom - box.top) * 0.7)).toBe(true);
    }
    for (const box of heroes) expect(frames[0].some(({ x }) => x >= box.left && x < box.right)).toBe(true);
  });
});

describe("l'écho se défait en lumière", () => {
  const png = { left: 200, top: 50, right: 247, bottom: 116 };
  // Une silhouette simple : rangées 5 à 60 opaques des colonnes 10 à 18 et 26 à 36, avec un trou entre les deux (les jambes)
  const rows: OpaqueRuns[] = Array.from({ length: 66 }, (_, y) => (y >= 5 && y <= 60 ? [[10, 18], [26, 36]] : []));
  const opaque = (x: number, y: number) => (rows[y - png.top] ?? []).some(([left, right]) => x >= png.left + left && x < png.left + right);
  const count = frameCount(CONFIG.timing.unravel);
  const cleared = (frame: number) => unravelCleared(frame, count, rows.length);
  const all = (plan: FxPlan) => Array.from({ length: plan.count }, (_, i) => plan.frame(i));
  const golds: string[] = [FX_COLORS.parchment, FX_COLORS.brightGold, FX_COLORS.oldGold];

  it("ne tire jamais Math.random, et rend les mêmes images pour la même graine", () => {
    const spy = vi.spyOn(Math, "random");
    try {
      expect(all(lightRise(png, rows, cleared, count, 5))).toEqual(all(lightRise(png, rows, cleared, count, 5)));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("pixels entiers et dorés, partis de la silhouette, qui montent sans jamais descendre sous elle", () => {
    const frames = all(lightRise(png, rows, cleared, count, 6));
    expect(frames).toHaveLength(count);
    for (const { x, y, color } of frames.flat()) {
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
      expect(golds).toContain(color);
      expect(x).toBeGreaterThanOrEqual(png.left + 10 - 2); // dérive d'un pixel toutes les deux images, cinq images au plus
      expect(x).toBeLessThan(png.left + 36 + 2);
      expect(y).toBeLessThanOrEqual(png.top + 60);
    }
  });

  it("chaque rangée effacée lâche de la lumière à l'image où elle disparaît, sur ses colonnes opaques", () => {
    const frames = all(lightRise(png, rows, cleared, count, 7));
    for (let frame = 1; frame < count; frame++) {
      const fresh = Array.from({ length: cleared(frame) - cleared(frame - 1) }, (_, k) => cleared(frame - 1) + k).filter((row) => rows[row].length > 0);
      for (const row of fresh) {
        const born = frames[frame].filter(({ y }) => y === png.top + row);
        expect(born.length).toBeGreaterThan(0);
        for (const { x, y } of born) expect(opaque(x, y)).toBe(true); // jamais dans le trou
      }
    }
    // Avant l'effacement, seulement quelques éclats d'or vif sur la silhouette
    for (let frame = 0; cleared(frame) === 0; frame++) {
      for (const { x, y, color } of frames[frame]) {
        expect(color).toBe(FX_COLORS.brightGold);
        expect(opaque(x, y)).toBe(true);
      }
    }
  });
});

describe("segments opaques d'une image", () => {
  it("relevés sur l'image composée, rapportés au coin du PNG : au repos les mêmes que le PNG, et la pose les déplace", () => {
    // 4 × 6, opaque partout sauf un trou en (1, 4) ; la taille à la rangée 3
    const source = { width: 4, height: 6, data: new Uint8ClampedArray(Array.from({ length: 24 }, (_, i) => [9, 9, 9, i === 17 ? 0 : 255]).flat()) };
    const rig = { waist: 3, facing: -1 as const }; // as const : le sens du regard, de type 1 | -1
    const layout = frameLayout(4, 6);
    const shown = (pose: BodyPose) => opaqueRuns(composeFrame(source, rig, pose, layout), layout.originX, layout.originY, 6);
    expect(shown(REST_BODY)).toEqual(opaqueRuns(source));
    // Affaissé d'une rangée (fold) : la rangée du haut se vide, le haut du corps descend, la rangée 3 disparaît
    const folded = shown({ ...REST_BODY, fold: 1 });
    expect(folded[0]).toEqual([]);
    expect(folded.slice(1, 4)).toEqual(opaqueRuns(source).slice(0, 3));
    expect(folded.slice(4)).toEqual(opaqueRuns(source).slice(4));
  });

  it("chaque rangée donne ses segments opaques exacts, trous compris, par rapport à une origine", () => {
    // 5 × 3 : rangée 0 « .##.# », rangée 1 vide, rangée 2 « ##### »
    const alpha = [0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1];
    const image = { width: 5, height: 3, data: new Uint8ClampedArray(alpha.flatMap((a) => [9, 9, 9, a ? 255 : 0])) };
    expect(opaqueRuns(image)).toEqual([[[1, 3], [4, 5]], [], [[0, 5]]]);
    expect(opaqueRuns(image, 1, 2, 2)).toEqual([[[-1, 4]], []]); // rangée 2, puis hors de l'image
  });
});

describe("l'or quitte Maelor", () => {
  const maelor = { left: 60, top: 90, right: 107, bottom: 156 };
  const dragon = { left: 260, top: 70, right: 402, bottom: 158 };
  // Le Dragon vaincu, affaissé : rien dans le haut de son image ; dans le bas, son corps, avec un trou entre ses pattes
  const slumped: OpaqueRuns[] = Array.from({ length: 88 }, (_, y) => (y < 34 ? [] : y < 85 ? [[30, 60], [75, 130]] : [[40, 55], [80, 120]]));
  // Maelor debout (silhouette pleine), puis à genoux, relevé à 1 PV : plus bas, avec un trou entre le bras et le corps
  const standing: OpaqueRuns[] = Array.from({ length: 66 }, () => [[10, 37]]);
  const kneeling: OpaqueRuns[] = Array.from({ length: 66 }, (_, y) => (y < 22 ? [] : [[8, 20], [24, 40]]));
  const ground = (y: number) => y >= dragon.bottom - 3 && y < dragon.bottom;
  // Sur un pixel opaque du bas de son image (moitié basse)
  const onBody = (body: OpaqueRuns[], x: number, y: number) =>
    y - dragon.top >= 44 && (body[y - dragon.top] ?? []).some(([left, right]) => x >= dragon.left + left && x < dragon.left + right);
  const count = frameCount(CONFIG.timing.powerReturn);
  const all = (plan: FxPlan) => Array.from({ length: plan.count }, (_, i) => plan.frame(i));
  const golds: string[] = [FX_COLORS.parchment, FX_COLORS.brightGold, FX_COLORS.oldGold];

  it("sans Dragon à l'écran, ou avec le mouvement réduit : l'éclat doré sur place, sans or qui part", () => {
    expect(streamsGold(false, false)).toBe(false);
    expect(streamsGold(false, true)).toBe(false);
    expect(streamsGold(true, true)).toBe(false);
    expect(streamsGold(true, false)).toBe(true);
  });

  it("ne tire jamais Math.random, et rend les mêmes images pour la même graine", () => {
    const spy = vi.spyOn(Math, "random");
    try {
      expect(all(goldStream(maelor, standing, dragon, slumped, count, 8))).toEqual(all(goldStream(maelor, standing, dragon, slumped, count, 8)));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("part de la poitrine de Maelor, en pixels entiers et dorés, et se pose sur le Dragon et le sol devant lui", () => {
    const frames = all(goldStream(maelor, standing, dragon, slumped, count, 9));
    expect(frames[0].length).toBeGreaterThan(0);
    for (const { x, y } of frames[0]) {
      expect(x >= maelor.left && x < maelor.right && y >= maelor.top && y < maelor.bottom).toBe(true);
    }
    for (const { x, y, color } of frames.flat()) {
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
      expect(golds).toContain(color);
      expect(x).toBeGreaterThanOrEqual(maelor.left);
      expect(x).toBeLessThan(dragon.right);
      expect(y).toBeLessThan(dragon.bottom);
    }
    // Sur la fin de l'effet, de l'or posé sur le Dragon et de l'or au sol
    const late = frames.slice(Math.ceil(0.86 * (count - 1))).flat();
    const onScales = late.filter(({ x, y }) => onBody(slumped, x, y) && y < dragon.bottom - 3);
    const onGround = late.filter(({ y }) => ground(y));
    expect(onScales.length).toBeGreaterThan(0);
    expect(onGround.length).toBeGreaterThan(0);
  });

  it("posé, l'or est sur le bas du Dragon affaissé, sur un de ses pixels, ou au sol devant lui : jamais dans le vide au-dessus", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const frames = all(goldStream(maelor, standing, dragon, slumped, count, seed));
      // Tout l'or est posé à 86 % de l'effet (départ avant 40 %, vol de 45 % au plus)
      for (let index = Math.ceil(0.86 * (count - 1)); index < count; index++) {
        for (const { x, y } of frames[index]) expect(onBody(slumped, x, y) || ground(y)).toBe(true);
      }
    }
  });

  it("l'or part d'un pixel opaque de la poitrine de Maelor tel qu'il est affiché, même à genoux", () => {
    for (const seed of [1, 2, 3]) {
      const plan = goldStream(maelor, kneeling, dragon, slumped, count, seed);
      const first = plan.frame(0);
      expect(first.length).toBeGreaterThan(0);
      for (const { x, y } of first) {
        const row = y - maelor.top;
        expect(row).toBeGreaterThanOrEqual(22 + Math.round(43 * 0.25)); // la poitrine de Maelor à genoux (rangées 22 à 65)
        expect(row).toBeLessThanOrEqual(22 + Math.round(43 * 0.55));
        expect(kneeling[row].some(([left, right]) => x >= maelor.left + left && x < maelor.left + right)).toBe(true);
      }
    }
  });

  it("si le bas de l'image du Dragon est vide, tout l'or se pose au sol devant lui", () => {
    const empty: OpaqueRuns[] = Array.from({ length: 88 }, () => []);
    const frames = all(goldStream(maelor, standing, dragon, empty, count, 6));
    for (let index = Math.ceil(0.86 * (count - 1)); index < count; index++) {
      for (const { y } of frames[index]) expect(ground(y)).toBe(true);
    }
  });
});
