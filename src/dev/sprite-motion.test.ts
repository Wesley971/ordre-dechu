// sprite-motion.test.ts - Animations des combattants en code (MAE-30) : pixels entiers, grille de 12 images/s,
// chaque image montrée, poses tenues, vitesse
import { describe, expect, it } from "vitest";
import { CONFIG } from "../config.ts";
import {
  createMotion, FRAME_MS, frameCount, gestureImages, unravelCleared, type BaseName, type GestureName, type MotionPose, type MotionRig, type MotionTimings,
} from "../ui/sprite-motion.ts";
import { REST_BODY } from "../ui/sprite-frames.ts";

const rig: MotionRig = { height: 66, waist: 36, breath: { period: 2.8, phase: 0 } };
const timings = (): MotionTimings => CONFIG.timing;
const GESTURES: GestureName[] = ["attack", "strike", "cast", "hit", "fall", "revive", "victory", "slump", "rise", "dissolve", "unravel"];
const DURATIONS: Record<GestureName, keyof MotionTimings> = {
  attack: "step", strike: "blink", cast: "cast", hit: "hit", fall: "fall", revive: "fall",
  victory: "victoryHop", slump: "defeatedPose", rise: "defeatedPose", dissolve: "death", unravel: "unravel",
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
    ["attack", "idle"], ["strike", "idle"], ["cast", "idle"], ["hit", "idle"], ["slump", "idle"], ["rise", "defeated"],
  ];
  it.each(FIXED)("%s (depuis %s) : chaque image est montrée à vitesse normale", (name, from) => {
    const images = gestureImages(name, rig) ?? [];
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

describe("l'écho se défait en lumière (MAE-95)", () => {
  it("le premier quart, il reste entier ; puis ses rangées s'effacent depuis le haut, sans revenir, jusqu'à la dernière", () => {
    const count = frameCount(CONFIG.timing.unravel);
    let previous = 0;
    for (let frame = 0; frame < count; frame++) {
      const cleared = unravelCleared(frame, count, 66);
      if ((frame + 1) / count <= 0.25) expect(cleared).toBe(0);
      expect(cleared).toBeGreaterThanOrEqual(previous);
      previous = cleared;
    }
    expect(unravelCleared(count - 1, count, 66)).toBe(66);
  });

  it("le geste efface les mêmes rangées que celles d'où partent les pixels dorés, puis l'écho reste effacé (pose gone)", () => {
    const motion = createMotion(rig, timings);
    motion.play("unravel", 1000);
    motion.setBase("gone");
    const count = frameCount(CONFIG.timing.unravel);
    const start = Math.ceil((1000 * 12) / 1000);
    for (let frame = 0; frame < count; frame++) {
      const t = (start + frame) * FRAME_MS + 1;
      expect(motion.poseAt(t, true).clipTop).toBe(unravelCleared(frame, count, rig.height));
    }
    expect(motion.poseAt((start + count + 1) * FRAME_MS, true).clipTop).toBe(rig.height);
  });
});

describe("mouvement réduit", () => {
  it("ni geste ni respiration : la pose de fond, immobile", () => {
    const motion = createMotion(rig, timings);
    motion.play("attack", 0);
    for (let t = 0; t < 4000; t += 50) expect(motion.poseAt(t, false)).toMatchObject({ dx: 0, lift: 0, lean: 0 });
  });
});

describe("poses dessinées à la place du code (MAE-94)", () => {
  const drawnRig: MotionRig = { ...rig, drawn: ["stagger", "kneel", "down"] };

  // Poses dessinées montrées pendant le geste, dans l'ordre, sans répétition
  function drawnDuring(motion: ReturnType<typeof createMotion>, start: number) {
    const seen: (string | null)[] = [];
    for (let t = start; motion.busy(t); t += 1) {
      const { drawn } = motion.poseAt(t, true);
      if (seen.at(-1) !== drawn) seen.push(drawn);
    }
    return seen;
  }

  it.each([0, 1040])("la chute (lancée à %i ms) : flanche puis à genoux, chacune montrée, puis au sol tenu, sans s'éteindre", (start) => {
    const motion = createMotion(drawnRig, timings);
    motion.play("fall", start);
    motion.setBase("ko");
    expect(drawnDuring(motion, start)).toEqual(["stagger", "kneel"]);
    for (const t of [start + CONFIG.timing.fall + FRAME_MS, 60000]) {
      expect(motion.poseAt(t, true)).toEqual({ ...REST_BODY, dx: 0, dy: 0, drawn: "down" });
    }
  });

  it("un héros en danger, déjà à genoux, ne flanche pas avant de tomber", () => {
    const motion = createMotion(drawnRig, timings, "critical");
    motion.play("fall", 0);
    motion.setBase("ko");
    expect(drawnDuring(motion, 0)).toEqual(["kneel"]);
  });

  it("en danger : à genoux, avec une respiration lente d'un pixel", () => {
    const motion = createMotion(drawnRig, timings, "critical");
    const lifts = new Set<number>();
    for (let t = 0; t < 20000; t += 10) {
      const pose = motion.poseAt(t, true);
      expect(pose).toMatchObject({ drawn: "kneel", lean: 0, fold: 0 });
      lifts.add(pose.lift);
    }
    expect([...lifts].sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it("un coup reçu à genoux garde l'image à genoux, avec le recul", () => {
    const motion = createMotion(drawnRig, timings, "critical");
    motion.play("hit", 0);
    expect(motion.poseAt(10, true)).toMatchObject({ drawn: "kneel", dx: -2 });
  });

  it("la réanimation passe par la pose à genoux, puis revient à l'attente debout", () => {
    const motion = createMotion(drawnRig, timings, "ko");
    motion.play("revive", 0);
    motion.setBase("idle");
    expect(drawnDuring(motion, 0)).toEqual(["kneel"]);
    expect(motion.poseAt(CONFIG.timing.fall + FRAME_MS, true).drawn).toBeNull();
  });

  it("mouvement réduit : la pose de fond dessinée directement, immobile", () => {
    const motion = createMotion(drawnRig, timings);
    motion.play("fall", 0);
    motion.setBase("ko");
    expect(motion.poseAt(0, false)).toEqual({ ...REST_BODY, dx: 0, dy: 0, drawn: "down" });
    const critical = createMotion(drawnRig, timings, "critical");
    for (let t = 0; t < 8000; t += 50) expect(critical.poseAt(t, false)).toMatchObject({ drawn: "kneel", lift: 0 });
  });

  it("sans toutes les images d'une transition, ou sans poses dessinées, le personnage reste dans sa pose de repos", () => {
    const partial = createMotion({ ...rig, drawn: ["kneel", "down"] }, timings);
    partial.play("fall", 0);
    partial.setBase("ko");
    expect(partial.poseAt(0, true)).toEqual({ ...REST_BODY, dx: 0, dy: 0, drawn: null });
    expect(partial.poseAt(CONFIG.timing.fall + FRAME_MS, true).drawn).toBe("down");
    const plain = createMotion(rig, timings, "critical");
    expect(plain.poseAt(0, false)).toEqual({ ...REST_BODY, dx: 0, dy: 0, drawn: null });
  });
});
