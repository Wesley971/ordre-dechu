// sprite-motion.test.ts - Animations des combattants en code (MAE-30) : pixels entiers, grille de 12 images/s,
// chaque image montrée, poses tenues, vitesse
import { describe, expect, it } from "vitest";
import { CONFIG } from "../config.ts";
import {
  createMotion, FRAME_MS, frameCount, gestureImages, SHADE, shadeColor, type BaseName, type GestureName, type MotionPose, type MotionRig, type MotionTimings,
} from "../ui/sprite-motion.ts";
import { REST_BODY } from "../ui/sprite-frames.ts";
import { shadeFilter } from "../ui/animated-sprite.ts";

const rig: MotionRig = { height: 66, waist: 36, breath: { period: 2.8, phase: 0 } };
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
      for (const image of images) expect(seen).toContain(JSON.stringify({ ...REST_BODY, dx: 0, dy: 0, shade: 0, ...image, drawn: null }));
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

describe("genou à terre (pose provisoire, décisions du 08/11/2026)", () => {
  it("affaissé et penché en avant, sans replier les jambes, avec une respiration plus ample et plus lente que l'attente", () => {
    const motion = createMotion(rig, timings, "critical");
    const lifts = new Set<number>();
    let changes = 0, previous = motion.poseAt(0, true).lift;
    for (let t = 0; t < 20000; t += 10) {
      const pose = motion.poseAt(t, true);
      expect(pose).toMatchObject({ fold: 0, lean: 2, shade: 0 });
      lifts.add(pose.lift);
      if (pose.lift !== previous) changes++;
      previous = pose.lift;
    }
    expect([...lifts].sort((a, b) => a - b)).toEqual([-3, -1]);
    const idle = createMotion(rig, timings);
    let idleChanges = 0, idlePrevious = idle.poseAt(0, true).lift;
    for (let t = 0; t < 20000; t += 10) {
      const lift = idle.poseAt(t, true).lift;
      if (lift !== idlePrevious) idleChanges++;
      idlePrevious = lift;
    }
    expect(changes).toBeLessThan(idleChanges);
  });

  it("un coup reçu garde l'affaissement", () => {
    const motion = createMotion(rig, timings, "critical");
    motion.play("hit", 0);
    expect(motion.poseAt(10, true).lift).toBe(-3);
  });
});

describe("K.O. et réanimation (pose provisoire, décisions du 08/11/2026)", () => {
  it("le héros s'affaisse, puis s'éteint, et la pose éteinte reste tenue", () => {
    const motion = createMotion(rig, timings);
    motion.play("fall", 0);
    motion.setBase("ko");
    expect(motion.poseAt(0, true)).toMatchObject({ lift: -1, shade: 0 });
    let shade = 0;
    for (let t = 0; motion.busy(t); t += 10) {
      const pose = motion.poseAt(t, true);
      expect(pose.shade).toBeGreaterThanOrEqual(shade); // il s'éteint sans se rallumer
      shade = pose.shade;
    }
    for (const t of [CONFIG.timing.fall + FRAME_MS, 5000, 60000]) {
      expect(motion.poseAt(t, true)).toMatchObject({ lift: -3, lean: 2, fold: 0, shade: 1 });
    }
  });

  it("un héros déjà affaissé (en danger) ne se redresse pas avant de s'éteindre", () => {
    const motion = createMotion(rig, timings, "critical");
    motion.play("fall", 0);
    motion.setBase("ko");
    for (let t = 0; motion.busy(t); t += 10) expect(motion.poseAt(t, true).lift).toBe(-3);
  });

  it("une réanimation le rallume et ramène à l'attente", () => {
    const motion = createMotion(rig, timings, "ko");
    motion.play("revive", 0);
    motion.setBase("idle");
    expect(motion.poseAt(0, true).shade).toBeLessThan(1);
    expect(motion.poseAt(CONFIG.timing.fall + FRAME_MS, true)).toMatchObject({ shade: 0, fold: 0, lean: 0 });
  });
});

describe("mouvement réduit", () => {
  it("ni geste ni respiration : la pose de fond, immobile", () => {
    const motion = createMotion(rig, timings);
    motion.play("attack", 0);
    for (let t = 0; t < 4000; t += 50) expect(motion.poseAt(t, false)).toMatchObject({ dx: 0, lift: 0, lean: 0 });
  });

  it("en danger : affaissé et immobile", () => {
    const motion = createMotion(rig, timings, "critical");
    for (let t = 0; t < 8000; t += 50) expect(motion.poseAt(t, false)).toMatchObject({ lift: -3, lean: 2, fold: 0, shade: 0 });
  });

  it("le K.O. passe directement à la pose éteinte", () => {
    const motion = createMotion(rig, timings);
    motion.play("fall", 0);
    motion.setBase("ko");
    expect(motion.poseAt(0, false)).toMatchObject({ lift: -3, shade: 1 });
  });
});

describe("couleur du héros éteint", () => {
  it("allumé : aucun filtre ; éteint : tout en gris, assombri presque jusqu'à l'ombre", () => {
    expect(shadeFilter(0)).toBe("");
    expect(shadeColor(1)).toEqual({ gray: 1, brightness: 1 - SHADE.darkness });
    expect(shadeFilter(1)).toBe(`grayscale(1) brightness(${1 - SHADE.darkness})`);
    expect(shadeColor(0.5).brightness).toBeGreaterThan(shadeColor(1).brightness);
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
