// sprite-motion.test.ts - Animations des combattants en code (MAE-30) : pixels entiers, grille de 12 images/s,
// chaque image montrée, poses tenues, vitesse
import { describe, expect, it } from "vitest";
import { CONFIG } from "../config.ts";
import {
  createMotion, FRAME_MS, frameCount, gestureImages, type BaseName, type GestureName, type MotionPose, type MotionRig, type MotionTimings,
} from "../ui/sprite-motion.ts";
import { REST_BODY } from "../ui/sprite-frames.ts";

const rig: MotionRig = { height: 66, waist: 36, kneel: 9, breath: { period: 2.8, phase: 0 } };
const timings = (): MotionTimings => CONFIG.timing;
const GESTURES: GestureName[] = ["attack", "strike", "cast", "hit", "fall", "revive", "victory", "slump", "rise", "dissolve"];
const DURATIONS: Record<GestureName, keyof MotionTimings> = {
  attack: "step", strike: "blink", cast: "cast", hit: "hit", fall: "fall", revive: "fall",
  victory: "victoryHop", slump: "defeatedPose", rise: "defeatedPose", dissolve: "death",
};
const NUMBERS = ["dx", "dy", "lift", "lean", "fold", "clipTop"] as const; // as const : des clés de MotionPose, pas de simples chaînes

const durationOf = (name: GestureName, t: MotionTimings = CONFIG.timing) => t[DURATIONS[name]] * (name === "victory" ? 4 : 1);
// Images d'un geste : la victoire en compte un nombre entier par saut
const framesOf = (name: GestureName) => (name === "victory" ? 4 * frameCount(CONFIG.timing.victoryHop) : frameCount(durationOf(name)));
const frameOf = (ms: number) => Math.floor((ms * 12) / 1000);
const shapeOf = (pose: MotionPose) => JSON.stringify({ ...pose, drawn: null });

describe("gestes", () => {
  it.each(GESTURES)("%s : pixels entiers, changements sur la grille de 12 images/s, puis retour à la pose de fond", (name) => {
    const motion = createMotion(rig, timings);
    motion.play(name, 1000);
    const end = 1000 + framesOf(name) * FRAME_MS;
    let previous = shapeOf(motion.poseAt(1000, true));
    for (let t = 1001; t < end + 2 * FRAME_MS; t += 1) {
      const pose = motion.poseAt(t, true);
      for (const key of NUMBERS) expect(Number.isInteger(pose[key])).toBe(true);
      const shape = shapeOf(pose);
      if (shape !== previous) expect(frameOf(t)).not.toBe(frameOf(t - 1)); // une nouvelle image de la grille commence
      previous = shape;
    }
    expect(motion.busy(end - 1)).toBe(true);
    expect(motion.busy(end + 1)).toBe(false);
  });

  // Chaque image d'un geste est montrée à vitesse normale : une image plus courte que la grille ne disparaît pas
  const FIXED: [GestureName, BaseName][] = [
    ["attack", "idle"], ["strike", "idle"], ["cast", "idle"], ["hit", "idle"], ["fall", "idle"], ["fall", "critical"],
    ["revive", "ko"], ["slump", "idle"], ["rise", "defeated"],
  ];
  it.each(FIXED)("%s (depuis %s) : chaque image est montrée à vitesse normale", (name, from) => {
    const images = gestureImages(name, rig, from) ?? [];
    expect(images.length).toBeGreaterThan(0);
    for (const start of [1000, 1040]) { // lancé sur une marque de la grille, et entre deux
      const motion = createMotion(rig, timings, from);
      motion.play(name, start);
      const seen = new Set<string>();
      for (let t = start; motion.busy(t); t += 1) seen.add(shapeOf(motion.poseAt(t, true)));
      for (const image of images) expect(seen).toContain(JSON.stringify({ ...REST_BODY, dx: 0, dy: 0, ...image, drawn: null }));
    }
  });

  it("la victoire fait quatre sauts, chacun reparti du sol", () => {
    const motion = createMotion(rig, timings);
    motion.play("victory", 0);
    const heights: number[] = [];
    for (let k = 0; motion.busy(Math.ceil(k * FRAME_MS)); k++) heights.push(motion.poseAt(Math.ceil(k * FRAME_MS), true).dy);
    const hop = frameCount(CONFIG.timing.victoryHop);
    expect(heights).toHaveLength(4 * hop);
    for (let i = 0; i < 4; i++) {
      expect(heights[i * hop]).toBe(0);
      expect(Math.max(...heights.slice(i * hop, (i + 1) * hop))).toBe(CONFIG.scene.battle.victoryHop);
    }
  });

  it("les durées suivent CONFIG.timing, donc ?vitesse=X, et un geste lancé entre deux images dure toute sa durée", () => {
    for (const t of [CONFIG.timing, { ...CONFIG.timing, step: CONFIG.timing.step / 4, hit: CONFIG.timing.hit / 4 }]) {
      for (const name of ["attack", "hit"] as const) { // as const : des noms de GestureName
        const motion = createMotion(rig, () => t);
        motion.play(name, 1040);
        expect(motion.poseAt(1040, true)).not.toEqual(motion.poseAt(5000, true)); // déjà visible au lancement
        expect(motion.busy(1040 + durationOf(name, t) - 1)).toBe(true);
        expect(motion.busy(1040 + durationOf(name, t) + 2 * FRAME_MS)).toBe(false);
      }
    }
  });
});

describe("K.O. et réanimation", () => {
  it("la chute passe par les genoux, puis la pose couchée reste tenue", () => {
    const motion = createMotion(rig, timings);
    motion.play("fall", 0);
    motion.setBase("ko");
    expect(motion.poseAt(0, true)).toMatchObject({ lying: false, fold: 0, lift: -1 });
    expect(motion.poseAt(CONFIG.timing.fall * 0.5, true).fold).toBe(rig.kneel);
    for (const t of [CONFIG.timing.fall + FRAME_MS, 5000, 60000]) expect(motion.poseAt(t, true).lying).toBe(true);
  });

  it("un héros déjà à genoux ne se relève pas pour tomber", () => {
    const motion = createMotion(rig, timings, "critical");
    motion.play("fall", 0);
    motion.setBase("ko");
    for (let t = 0; motion.busy(t); t += 10) expect(motion.poseAt(t, true).fold).toBe(rig.kneel);
  });

  it("une réanimation ramène à l'attente", () => {
    const motion = createMotion(rig, timings, "ko");
    motion.play("revive", 0);
    motion.setBase("idle");
    expect(motion.poseAt(0, true)).toMatchObject({ lying: false, fold: rig.kneel });
    expect(motion.poseAt(CONFIG.timing.fall + FRAME_MS, true)).toMatchObject({ lying: false, fold: 0, lean: 0 });
  });

  it("un coup reçu à genoux garde le genou à terre", () => {
    const motion = createMotion(rig, timings, "critical");
    motion.play("hit", 0);
    expect(motion.poseAt(10, true).fold).toBe(rig.kneel);
  });
});

describe("mouvement réduit", () => {
  it("ni geste ni respiration : la pose de fond, immobile", () => {
    const motion = createMotion(rig, timings);
    motion.play("attack", 0);
    for (let t = 0; t < 4000; t += 50) expect(motion.poseAt(t, false)).toMatchObject({ dx: 0, lift: 0, lean: 0 });
  });

  it("le K.O. passe directement à la pose couchée", () => {
    const motion = createMotion(rig, timings);
    motion.play("fall", 0);
    motion.setBase("ko");
    expect(motion.poseAt(0, false).lying).toBe(true);
  });
});

describe("images dessinées à la place du code (MAE-94)", () => {
  it("la chute dessinée montre ses images dans l'ordre, puis la pose ko sa dernière image", () => {
    const motion = createMotion({ ...rig, drawn: { fall: 3, ko: 2 } }, timings);
    motion.play("fall", 0);
    motion.setBase("ko");
    const seen: (number | undefined)[] = [];
    for (let t = 0; motion.busy(t); t += 10) {
      const index = motion.poseAt(t, true).drawn?.index;
      if (seen.at(-1) !== index) seen.push(index);
    }
    expect(seen).toEqual([0, 1, 2]);
    expect(motion.poseAt(CONFIG.timing.fall + 2 * FRAME_MS, true).drawn).toEqual({ name: "ko", index: 1 });
    expect(createMotion(rig, timings).poseAt(0, true).drawn).toBeNull();
  });
});
