// sprite-motion.ts - Animations des combattants en code, à partir de leur image fixe (MAE-30)
//
// Un combattant a une pose de fond (attente, genou à terre, K.O....) et, par-dessus, au plus un geste passager
// (attaque, sort, coup reçu...). À un instant donné, l'animation rend une pose : celle du corps (sprite-frames.ts)
// et un déplacement du sprite entier, tout en pixels de sprite entiers. Toute image change sur une grille commune
// de douze images par seconde, comme un pixel art dessiné. Sans DOM et sans horloge propre : l'heure est donnée par
// l'appelant, et les durées viennent de CONFIG.timing (divisées par ?vitesse=X en mode test). Les animations ne
// lisent jamais l'horloge du combat : elles ne la ralentissent pas, et continuent quand le mode Attente l'arrête.
// Les héros ont des poses dessinées (MAE-94) : à genoux en danger, au sol au K.O., flanche puis à genoux pendant la
// chute, à genoux pendant la réanimation. La pose désigne alors l'image à afficher (drawn).

import { CONFIG } from "../config.ts";
import type { DrawnPoseName } from "../data/game-data.ts";
import { REST_BODY, type BodyPose } from "./sprite-frames.ts";

// Pose de fond : tenue jusqu'à la suivante
export type BaseName =
  | "idle"      // attente : le haut du corps respire
  | "acting"    // héros qui agit, avancé : penché vers l'ennemi
  | "critical"  // héros en danger : à genoux (pose dessinée, MAE-94), respiration lente
  | "ko"        // héros à terre : au sol (pose dessinée, MAE-94), dernière pose tenue
  | "defeated"  // ennemi vaincu mais pas mort (le Dragon) : affaissé
  | "gone";     // ennemi mort : plus rien à dessiner

// Geste passager, joué une fois par-dessus la pose de fond
export type GestureName =
  | "attack"    // héros : élan en arrière, puis penché vers l'ennemi
  | "strike"    // ennemi : bond vers les héros, puis retour
  | "cast"      // Souffle : le haut du corps se lève, penché en arrière
  | "hit"       // coup reçu : recul, penché en arrière, tremblement
  | "fall"      // héros : flanche, puis tombe à genoux (avant la pose ko), en poses dessinées
  | "revive"    // héros ranimé : à genoux, avant de se relever, en pose dessinée
  | "victory"   // héros : quatre sauts
  | "slump"     // ennemi vaincu : s'affaisse (avant la pose defeated)
  | "rise"      // ennemi épargné : se relève
  | "dissolve"  // ennemi tué : disparaît par le haut, par rangées entières (avant la pose gone)
  | "unravel"; // l'écho de Maelor vaincu : passe en or, puis s'efface par le haut, rangée par rangée (MAE-95)

// Durées des gestes, en millisecondes : un extrait de CONFIG.timing
export interface MotionTimings {
  step: number; blink: number; cast: number; hit: number; fall: number;
  victoryHop: number; defeatedPose: number; death: number; unravel: number;
}

// Squelette animé d'un personnage, en pixels de sprite
export interface MotionRig {
  height: number;                       // hauteur du PNG
  waist: number;                        // première rangée du bas du corps (FrameRig)
  breath: { period: number; phase: number }; // respiration : période en secondes, et décalage (0 à 1)
  drawn?: readonly DrawnPoseName[];     // poses dessinées disponibles (MAE-94)
}

// Pose à un instant. dx vers l'adversaire, dy vers le haut, en pixels de sprite entiers
export interface MotionPose extends BodyPose {
  dx: number;
  dy: number;
  drawn: DrawnPoseName | null; // pose dessinée à afficher à la place de l'image debout (MAE-94)
}

export type PosePart = Partial<Omit<MotionPose, "drawn">>;

// Un geste dure un nombre entier d'images de la grille commune
interface Gesture {
  duration(timings: MotionTimings): number;
  frames?(timings: MotionTimings): number; // nombre d'images imposé, à la place de celui de la durée
  // Le geste remplace la pose de fond (transitions : chute, relevé...) ; sinon il s'y ajoute
  replaces: boolean;
  // Pose de l'image `frame` (de 0 à count - 1) d'un geste de `count` images
  pose(frame: number, count: number, rig: MotionRig): PosePart;
}

// À genoux (MAE-94) : respiration plus lente que l'attente (période × 1,5), d'un pixel, sur la taille de l'image à genoux
const KNEEL_BREATH = { period: 1.5, depth: 1 };

// Poses dessinées (MAE-94) : celle d'une pose de fond, et la suite d'images d'une transition. Un héros en danger,
// déjà à genoux, ne flanche pas avant de tomber (décision de Wesley du 09/11/2026). Elles ont remplacé les poses
// provisoires de MAE-30 (affaissement, silhouette sombre) : un personnage sans ces images reste dans sa pose de repos.
const DRAWN_BASE: Partial<Record<BaseName, DrawnPoseName>> = { critical: "kneel", ko: "down" };
function drawnSequence(name: GestureName, from: BaseName): DrawnPoseName[] | null {
  switch (name) {
    case "fall": return from === "critical" ? ["kneel"] : ["stagger", "kneel"];
    case "revive": return ["kneel"];
    default: return null;
  }
}

export const FRAMES_PER_SECOND = 12;
export const FRAME_MS = 1000 / FRAMES_PER_SECOND;

// Numéro de l'image de la grille commune à un instant (un instant pile sur une marque peut, par arrondi, tomber
// sur l'image d'avant : sans effet, performance.now() n'y tombe jamais)
export const frameAt = (nowMs: number) => Math.floor((nowMs * FRAMES_PER_SECOND) / 1000);

// Première image d'un geste ou d'un effet lancé à cet instant : la prochaine marque de la grille. Il dure ainsi un
// nombre entier d'images, et au moins sa durée, même lancé entre deux images (fx-layer.ts s'en sert aussi, MAE-95)
export const startFrame = (nowMs: number) => Math.ceil((nowMs * FRAMES_PER_SECOND) / 1000);

// Nombre d'images de la grille d'un geste : au moins sa durée
export function frameCount(durationMs: number) {
  return Math.max(1, Math.ceil((durationMs * FRAMES_PER_SECOND) / 1000));
}

// Suite d'images réparties sur le geste. Chaque image est montrée au moins une fois tant que le geste compte au
// moins autant d'images de la grille (vrai à vitesse normale, testé) ; en ?vitesse=X, des images sautent.
function sequence<T>(images: readonly T[], frame: number, count: number): T {
  return images[Math.min(images.length - 1, Math.floor((frame * images.length) / count))];
}

// Rangées dont s'affaisse un ennemi vaincu (part de sa hauteur, CONFIG) : prises dans ses jambes, sans les retirer toutes
function sinkOf(rig: MotionRig) {
  const sink = Math.round(rig.height * CONFIG.scene.battle.defeatedSink);
  return Math.min(sink, Math.max(0, rig.height - rig.waist - 1));
}

// Images des gestes faits d'une suite fixe ; null pour ceux qui se calculent image par image (victoire, disparition)
// ou qui ne sont faits que de poses dessinées (chute, réanimation)
export function gestureImages(name: GestureName, rig: MotionRig): PosePart[] | null {
  switch (name) {
    case "attack": return [{ dx: -2, lean: -1 }, { lean: 2 }, { lean: 1 }]; // élan, penché vers l'ennemi, avancé
    case "strike": return [{ lean: 1 }, { dx: 3, dy: 1, lean: 2 }, { dx: 5, lean: 3 }, { dx: 2, lean: 1 }];
    case "cast": return [{ lift: 1 }, { lift: 2, lean: -1 }, { lift: 1 }];
    case "hit": return [{ dx: -2, lean: -2 }, { dx: 1, lean: -1 }, { dx: -1, lean: -1 }];
    case "slump": return [1, 2, 3].map((k) => ({ fold: Math.round((sinkOf(rig) * k) / 3), lean: k }));
    case "rise": return [2, 1].map((k) => ({ fold: Math.round((sinkOf(rig) * k) / 3), lean: k }));
    case "fall":
    case "revive":
    case "victory":
    case "dissolve":
    case "unravel": return null;
  }
}

function fromImages(name: GestureName): Gesture["pose"] {
  return (frame, count, rig) => sequence(gestureImages(name, rig) ?? [{}], frame, count);
}

const GESTURES: Record<GestureName, Gesture> = {
  attack: { duration: (t) => t.step, replaces: false, pose: fromImages("attack") },
  strike: { duration: (t) => t.blink, replaces: false, pose: fromImages("strike") },
  cast: { duration: (t) => t.cast, replaces: false, pose: fromImages("cast") },
  hit: { duration: (t) => t.hit, replaces: false, pose: fromImages("hit") },
  fall: { duration: (t) => t.fall, replaces: true, pose: fromImages("fall") },
  revive: { duration: (t) => t.fall, replaces: true, pose: fromImages("revive") },
  slump: { duration: (t) => t.defeatedPose, replaces: true, pose: fromImages("slump") },
  rise: { duration: (t) => t.defeatedPose, replaces: true, pose: fromImages("rise") },
  // Quatre sauts d'un nombre entier d'images chacun : chacun repart du sol
  victory: {
    duration: (t) => t.victoryHop * 4, replaces: false,
    frames: (t) => 4 * frameCount(t.victoryHop),
    pose: (frame, count) => {
      const hop = count / 4;
      return { dy: Math.round(CONFIG.scene.battle.victoryHop * Math.sin((Math.PI * (frame % hop)) / hop)) };
    },
  },
  // L'écho se défait en lumière (MAE-95) : le premier quart, il passe en or (couleurs : côté scène), puis ses rangées
  // s'effacent depuis le haut jusqu'à la dernière ; chacune lâche des pixels dorés (battle-fx.ts, lightRise)
  unravel: {
    duration: (t) => t.unravel, replaces: true,
    pose: (frame, count, rig) => ({ clipTop: unravelCleared(frame, count, rig.height) }),
  },
  dissolve: {
    duration: (t) => t.death, replaces: true,
    // Comme l'ancienne disparition : la teinte d'abord (couleurs, côté scène), puis le haut s'efface jusqu'à la dernière rangée
    pose: (frame, count, rig) => {
      const p = (frame + 1) / count;
      return { clipTop: p <= 0.3 ? 0 : Math.round((rig.height * (p - 0.3)) / 0.7) };
    },
  },
};

// Rangées effacées depuis le haut à l'image `frame` du geste unravel (de 0 à count - 1) : aucune le premier quart,
// puis jusqu'à toutes à la dernière image. Partagé avec les pixels dorés qui en partent (battle-fx.ts, lightRise)
export function unravelCleared(frame: number, count: number, height: number) {
  const p = (frame + 1) / count;
  return p <= UNRAVEL_GILD ? 0 : Math.min(height, Math.round((height * (p - UNRAVEL_GILD)) / (1 - UNRAVEL_GILD)));
}
const UNRAVEL_GILD = 0.25; // part du geste où l'écho passe en or avant de s'effacer

// La respiration : un pixel de plus pour le haut du corps, une partie de la période, sur la grille commune
function breathing(rig: MotionRig, nowMs: number, period: number) {
  const seconds = frameAt(nowMs) / FRAMES_PER_SECOND;
  return Math.sin((seconds / period + rig.breath.phase) * Math.PI * 2) > 0.15 ? 1 : 0;
}

// breathe false : mouvement réduit, ou pendant un geste (la respiration s'arrête le temps du geste).
// À genoux et au sol, l'image dessinée porte la pose : seule la respiration à genoux s'y ajoute (MAE-94)
function basePose(name: BaseName, rig: MotionRig, nowMs: number, breathe: boolean): PosePart {
  switch (name) {
    case "idle": return { lift: breathe ? breathing(rig, nowMs, rig.breath.period) : 0 };
    case "acting": return { lean: 1 };
    case "critical": return { lift: breathe ? KNEEL_BREATH.depth * breathing(rig, nowMs, rig.breath.period * KNEEL_BREATH.period) : 0 };
    case "ko": return {};
    case "defeated": return { fold: sinkOf(rig), lean: 3 };
    case "gone": return { clipTop: rig.height };
  }
}

function toPose(part: PosePart): MotionPose {
  return { ...REST_BODY, dx: 0, dy: 0, ...part, drawn: null };
}

// Ajoute un geste à la pose de fond : déplacements additionnés, rangées retirées au plus grand
function addTo(base: PosePart, gesture: PosePart): PosePart {
  return {
    dx: (base.dx ?? 0) + (gesture.dx ?? 0),
    dy: (base.dy ?? 0) + (gesture.dy ?? 0),
    lift: (base.lift ?? 0) + (gesture.lift ?? 0),
    lean: (base.lean ?? 0) + (gesture.lean ?? 0),
    fold: Math.max(base.fold ?? 0, gesture.fold ?? 0),
    clipTop: Math.max(base.clipTop ?? 0, gesture.clipTop ?? 0),
  };
}

export interface SpriteMotion {
  readonly base: BaseName;
  setBase(name: BaseName): void;                 // nouvelle pose de fond ; le geste en cours continue jusqu'à sa fin
  // Lance un geste ; il remplace celui en cours. Avant setBase pour une transition (fall puis ko) : il part de la pose d'avant
  play(name: GestureName, nowMs: number): void;
  busy(nowMs: number): boolean;                  // un geste est en cours
  poseAt(nowMs: number, moving: boolean): MotionPose; // moving false : mouvement réduit, pose de fond seule et immobile
}

export function createMotion(rig: MotionRig, timings: () => MotionTimings, initial: BaseName = "idle"): SpriteMotion {
  let base: BaseName = initial;
  let gesture: { name: GestureName; from: BaseName; start: number; count: number } | null = null;

  const running = (nowMs: number) => gesture !== null && frameAt(nowMs) < gesture.start + gesture.count;
  const has = (name: DrawnPoseName) => rig.drawn?.includes(name) ?? false;

  // Pose dessinée d'une pose de fond, si le personnage l'a (MAE-94)
  function drawnBase(name: BaseName) {
    const drawn = DRAWN_BASE[name];
    return drawn && has(drawn) ? drawn : null;
  }

  // Images dessinées d'une transition, seulement si le personnage les a toutes : sinon, sa pose de repos
  function drawnGesture(name: GestureName, from: BaseName) {
    const images = drawnSequence(name, from);
    return images && images.every(has) ? images : null;
  }

  return {
    get base() { return base; },
    // Le geste en cours continue : une chute (fall) se joue jusqu'au bout, puis la pose ko prend le relais
    setBase(name) { base = name; },
    play(name, nowMs) {
      // Départ à la prochaine image de la grille, pour un nombre entier d'images : la fin tombe aussi sur la grille,
      // et le geste dure au moins sa durée, même lancé entre deux images. Avant le départ, sa première image est montrée.
      const def = GESTURES[name];
      const count = def.frames ? def.frames(timings()) : frameCount(def.duration(timings()));
      gesture = { name, from: base, start: startFrame(nowMs), count };
    },
    busy: running,
    poseAt(nowMs, moving) {
      const baseDrawn = drawnBase(base);
      if (!moving || !gesture || !running(nowMs)) {
        return { ...toPose(basePose(base, rig, nowMs, moving)), drawn: baseDrawn };
      }
      const def = GESTURES[gesture.name];
      const frame = Math.max(0, frameAt(nowMs) - gesture.start);
      // Transition dessinée : ses images réparties sur le geste, chacune telle quelle
      const images = drawnGesture(gesture.name, gesture.from);
      if (images) return { ...toPose({}), drawn: sequence(images, frame, gesture.count) };
      const part = def.pose(frame, gesture.count, rig);
      if (def.replaces) return toPose(part);
      // Geste ajouté (coup reçu...) : sur la pose de fond, dessinée ou non
      return { ...toPose(addTo(basePose(base, rig, nowMs, false), part)), drawn: baseDrawn };
    },
  };
}
