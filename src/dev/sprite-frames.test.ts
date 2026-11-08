// sprite-frames.test.ts - Images des poses, composées à partir des PNG (MAE-30) : chaque pixel affiché est un pixel du PNG
import { describe, expect, it } from "vitest";
import { composeFrame, frameLayout, leanShift, REST_BODY, type BodyPose, type FrameRig, type PixelImage } from "../ui/sprite-frames.ts";
import { createMotion, FRAME_MS, type MotionRig } from "../ui/sprite-motion.ts";
import { CONFIG } from "../config.ts";
import { ENEMIES, HEROES, type EnemyDef, type SpriteRig } from "../data/game-data.ts";
import { decodePng } from "./png-pixels.ts";
import maelor from "../../public/images/maelor.png?inline";
import corvin from "../../public/images/corvin.png?inline";
import elwen from "../../public/images/elwen.png?inline";
import echo from "../../public/images/maelor-echo.png?inline";
import sankri from "../../public/images/sankri.png?inline";
import hesium from "../../public/images/hesium.png?inline";
import gautik from "../../public/images/gautik.png?inline";
import painkush from "../../public/images/painkush.png?inline";
import vahn from "../../public/images/vahn.png?inline";

// Image de test : chaque pixel a une couleur unique, qui dit d'où il vient (rouge : colonne, vert : rangée)
function grid(width: number, height: number): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set([x + 1, y + 1, 7, 255], (y * width + x) * 4);
  }
  return { width, height, data };
}

// Ce qui est dessiné en (x, y) de la toile : [colonne, rangée] du PNG d'origine, ou null si transparent
function sourceAt(frame: PixelImage, x: number, y: number): [number, number] | null {
  const i = (y * frame.width + x) * 4;
  return frame.data[i + 3] ? [frame.data[i] - 1, frame.data[i + 1] - 1] : null;
}

const pose = (part: Partial<BodyPose>): BodyPose => ({ ...REST_BODY, ...part });

describe("composition des poses sur une image de test", () => {
  const source = grid(6, 10);
  const layout = frameLayout(6, 10);
  const rig: FrameRig = { waist: 6, facing: 1 };

  it("au repos, l'image est recopiée telle quelle, pieds sur la dernière rangée de la toile", () => {
    const frame = composeFrame(source, rig, REST_BODY, layout);
    expect(layout.originY + source.height).toBe(layout.height);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 6; x++) expect(sourceAt(frame, layout.originX + x, layout.originY + y)).toEqual([x, y]);
    }
  });

  it("haut du corps levé d'un pixel : la rangée de la taille se répète, le bas ne bouge pas", () => {
    const frame = composeFrame(source, rig, pose({ lift: 1 }), layout);
    const at = (x: number, y: number) => sourceAt(frame, layout.originX + x, layout.originY + y);
    expect(at(0, -1)).toEqual([0, 0]);
    expect(at(2, 4)).toEqual([2, 5]);
    expect(at(2, 5)).toEqual([2, 5]); // l'écart, comblé par la dernière rangée du haut
    expect(at(2, 6)).toEqual([2, 6]);
  });

  it("penché en escalier : décalages entiers, nuls à la taille, lean à la première rangée, dans le sens du regard", () => {
    // Taille à 6, penché de 3 : 3 × (6 - rangée) / 6, arrondi en s'éloignant de zéro (2,5 → 3, 1,5 → 2, 0,5 → 1)
    const expected = [3, 3, 2, 2, 1, 1, 0, 0, 0, 0];
    expect(Array.from({ length: 6 }, (_, row) => leanShift(row, 6, 3))).toEqual(expected.slice(0, 6));
    for (const facing of [1, -1] as const) { // as const : les deux sens du regard, du type de FrameRig.facing
      const frame = composeFrame(source, { waist: 6, facing }, pose({ lean: 3 }), layout);
      for (let row = 0; row < 10; row++) {
        expect(sourceAt(frame, layout.originX + 2 + facing * expected[row], layout.originY + row)).toEqual([2, row]);
      }
    }
  });

  it("jambes repliées : les rangées sous la taille disparaissent et le haut descend d'autant", () => {
    const frame = composeFrame(source, rig, pose({ fold: 2 }), layout);
    const at = (y: number) => sourceAt(frame, layout.originX + 1, layout.originY + y);
    expect(at(0)).toBeNull();
    expect(at(1)).toBeNull();
    expect(at(2)).toEqual([1, 0]);
    expect(at(7)).toEqual([1, 5]);
    expect(at(8)).toEqual([1, 8]);
    expect(at(9)).toEqual([1, 9]);
  });

  it("disparition : les rangées du haut sont retirées, rangée entière par rangée entière", () => {
    const frame = composeFrame(source, rig, pose({ clipTop: 3 }), layout);
    for (let x = 0; x < 6; x++) {
      expect(sourceAt(frame, layout.originX + x, layout.originY + 2)).toBeNull();
      expect(sourceAt(frame, layout.originX + x, layout.originY + 3)).toEqual([x, 3]);
    }
  });

  it("haut du corps affaissé : il descend et passe devant le haut des jambes, les pieds ne bougent pas", () => {
    const frame = composeFrame(source, rig, pose({ lift: -2 }), layout);
    const at = (y: number) => sourceAt(frame, layout.originX + 1, layout.originY + y);
    expect(at(0)).toBeNull();
    expect(at(1)).toBeNull();
    expect(at(2)).toEqual([1, 0]);
    expect(at(7)).toEqual([1, 5]); // la taille recouvre la rangée 7 des jambes
    expect(at(8)).toEqual([1, 8]);
    expect(at(9)).toEqual([1, 9]);
  });
});

// Les vrais sprites : héros (regard à droite) et ennemis (regard à gauche)
const SPRITES: [string, string, 1 | -1][] = [
  ["maelor", maelor, 1], ["corvin", corvin, 1], ["elwen", elwen, 1], ["maelor-echo", echo, -1], ["sankri", sankri, -1],
  ["hesium", hesium, -1], ["gautik", gautik, -1], ["painkush", painkush, -1], ["vahn", vahn, -1],
];

// Squelette de chaque sprite, tel que les données du jeu le déclarent (MAE-30)
function rigOf(name: string): SpriteRig {
  const image = `images/${name}.png`;
  const def = HEROES.find((hero) => hero.image === image) ?? Object.values<EnemyDef>(ENEMIES).find((enemy) => enemy.image === image);
  if (!def) throw new Error(`Aucun personnage pour ${image}`);
  return def.rig;
}

const POSES: Partial<BodyPose>[] = [
  {}, { lift: 1 }, { lift: 2, lean: -1 }, { lift: -1, lean: 2 }, { lean: 5 }, { lean: -2 }, { fold: 6, lean: 1 },
  { fold: 6, lean: 5 }, { clipTop: 20 }, { lift: -3, lean: 2 },
];

function colors(image: PixelImage) {
  const set = new Set<number>();
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i + 3]) set.add(((image.data[i] * 256 + image.data[i + 1]) * 256 + image.data[i + 2]) * 256 + image.data[i + 3]);
  }
  return set;
}

const opaque = (image: PixelImage) => image.data.filter((_, i) => i % 4 === 3 && image.data[i] > 0).length;

describe("les 9 sprites du jeu, dans chaque pose : aucun pixel inventé", () => {
  it.each(SPRITES)("%s", async (name, url, facing) => {
    const source = await decodePng(url);
    const palette = colors(source);
    const layout = frameLayout(source.width, source.height);
    const rig: FrameRig = { waist: rigOf(name).waist, facing };
    for (const part of POSES) {
      const frame = composeFrame(source, rig, pose(part), layout);
      for (const color of colors(frame)) expect(palette.has(color)).toBe(true);
      // Au repos, l'image garde tous ses pixels : rien n'est perdu au bord de la toile
      if (Object.keys(part).length === 0) expect(opaque(frame)).toBe(opaque(source));
    }
  });
});

// Ce que chaque camp joue : poses de fond et gestes
const HERO_MOTIONS = { bases: ["idle", "acting", "critical", "ko"], gestures: ["attack", "cast", "hit", "fall", "revive", "victory"] } as const; // as const : des noms de BaseName et GestureName
const ENEMY_MOTIONS = { bases: ["idle", "defeated", "gone"], gestures: ["strike", "cast", "hit", "slump", "rise", "dissolve"] } as const; // as const : idem

describe("les 9 sprites du jeu, dans toutes leurs animations : rien ne sort de la toile", () => {
  it.each(SPRITES)("%s", async (name, url, facing) => {
    const source = await decodePng(url);
    const layout = frameLayout(source.width, source.height);
    // La même image sur une toile bien plus grande : tout pixel coupé au bord de la vraie toile y apparaîtrait
    const wide = { width: layout.width + 60, height: layout.height + 60, originX: layout.originX + 30, originY: layout.originY + 30 };
    const data = rigOf(name);
    const frameRig: FrameRig = { waist: data.waist, facing };
    const rig: MotionRig = { height: source.height, waist: data.waist, breath: { period: data.breath, phase: data.phase } };
    const { bases, gestures } = facing > 0 ? HERO_MOTIONS : ENEMY_MOTIONS;
    for (const base of bases) {
      for (const gesture of gestures) {
        const motion = createMotion(rig, () => CONFIG.timing, base);
        motion.play(gesture, 0);
        // Le geste, puis la pose de fond seule pendant plus d'une respiration (genou à terre compris)
        for (let k = 0, t = 0; t < 6000; k++, t = Math.ceil(k * FRAME_MS)) { // millisecondes entières : aucune image sautée
          const body = motion.poseAt(t, true);
          expect(opaque(composeFrame(source, frameRig, body, layout))).toBe(opaque(composeFrame(source, frameRig, body, wide)));
        }
      }
    }
  }, 30_000); // jusqu'à 3 s pour le Dragon sur ce PC : la limite de 5 s de Vitest céderait sous charge (CI, bot en parallèle)
});

// Hauteur de la silhouette : de la première à la dernière rangée qui a un pixel opaque
function silhouetteHeight(image: PixelImage) {
  let top = -1, bottom = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (!image.data[(y * image.width + x) * 4 + 3]) continue;
      if (top < 0) top = y;
      bottom = y;
    }
  }
  return { top, bottom, height: bottom - top + 1 };
}

describe("genou à terre et héros éteint (décisions du 08/11/2026) : la silhouette garde sa taille", () => {
  it.each(SPRITES.filter(([, , facing]) => facing > 0))("%s", async (name, url, facing) => {
    const source = await decodePng(url);
    const layout = frameLayout(source.width, source.height);
    const data = rigOf(name);
    const rig: MotionRig = { height: source.height, waist: data.waist, breath: { period: data.breath, phase: data.phase } };
    const rest = silhouetteHeight(composeFrame(source, { waist: data.waist, facing }, REST_BODY, layout));
    // Poses de fond, et gestes qui y mènent ou en reviennent (chute, réanimation)
    const cases = [["critical", null], ["ko", null], ["idle", "fall"], ["critical", "fall"], ["ko", "revive"]] as const; // as const : BaseName et GestureName
    for (const [base, gesture] of cases) {
      const motion = createMotion(rig, () => CONFIG.timing, base);
      if (gesture) motion.play(gesture, 0);
      for (let t = 0; t < 6000; t += 10) {
        const shape = silhouetteHeight(composeFrame(source, { waist: data.waist, facing }, motion.poseAt(t, true), layout));
        expect(shape.bottom).toBe(rest.bottom); // les pieds ne bougent pas
        expect(rest.height - shape.height).toBeLessThanOrEqual(3); // quelques pixels de moins, pas un personnage rétréci
      }
    }
  });
});

describe("squelettes des données (MAE-30)", () => {
  it.each(SPRITES)("%s : taille dans le sprite", async (name, url) => {
    const source = await decodePng(url);
    const rig = rigOf(name);
    expect(rig.waist).toBeGreaterThan(0);
    expect(rig.waist).toBeLessThan(source.height);
    expect(rig.breath).toBeGreaterThan(0);
  });
});
