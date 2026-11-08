// sprite-motion.ts - Animations des combattants en code, à partir de leur image fixe (MAE-30)
//
// Un combattant a une pose de fond (attente, genou à terre, K.O....) et, par-dessus, au plus un geste passager
// (attaque, sort, coup reçu...). À un instant donné, l'animation rend une pose : celle du corps (sprite-frames.ts)
// et un déplacement du sprite entier, tout en pixels de sprite entiers. Toute image change sur une grille commune
// de douze images par seconde, comme un pixel art dessiné. Sans DOM et sans horloge propre : l'heure est donnée par
// l'appelant, et les durées viennent de CONFIG.timing (divisées par ?vitesse=X en mode test). Les animations ne
// lisent jamais l'horloge du combat : elles ne la ralentissent pas, et continuent quand le mode Attente l'arrête.
// Une animation peut être remplacée par des images dessinées (MAE-94) : la pose désigne alors l'image à afficher.

import { CONFIG } from "../config.ts";
import { REST_BODY, type BodyPose } from "./sprite-frames.ts";

// Pose de fond : tenue jusqu'à la suivante
export type BaseName =
  | "idle"      // attente : le haut du corps respire
  | "acting"    // héros qui agit, avancé : penché vers l'ennemi
  | "critical"  // héros en danger : genou à terre, respiration lente
  | "ko"        // héros éteint : couché, dernière pose tenue
  | "defeated"  // ennemi vaincu mais pas mort (le Dragon) : affaissé
  | "gone";     // ennemi mort : plus rien à dessiner

// Geste passager, joué une fois par-dessus la pose de fond
export type GestureName =
  | "attack"    // héros : élan en arrière, puis penché vers l'ennemi
  | "strike"    // ennemi : bond vers les héros, puis retour
  | "cast"      // Souffle : le haut du corps se lève, penché en arrière
  | "hit"       // coup reçu : recul, penché en arrière, tremblement
  | "fall"      // héros : flanche, tombe à genoux, s'effondre (avant la pose ko)
  | "revive"    // héros ranimé : à genoux, puis debout
  | "victory"   // héros : quatre sauts
  | "slump"     // ennemi vaincu : s'affaisse (avant la pose defeated)
  | "rise"      // ennemi épargné : se relève
  | "dissolve"; // ennemi tué : disparaît par le haut, par rangées entières (avant la pose gone)

// Durées des gestes, en millisecondes : un extrait de CONFIG.timing
export interface MotionTimings {
  step: number; blink: number; cast: number; hit: number; fall: number;
  victoryHop: number; kneel: number; defeatedPose: number; death: number;
}

// Squelette animé d'un personnage, en pixels de sprite
export interface MotionRig {
  height: number;                       // hauteur du PNG
  waist: number;                        // première rangée du bas du corps (FrameRig)
  kneel: number;                        // rangées repliées à genoux
  breath: { period: number; phase: number }; // respiration : période en secondes, et décalage (0 à 1)
  drawn?: Partial<Record<BaseName | GestureName, number>>; // nombre d'images dessinées qui remplacent l'animation (MAE-94)
}

// Pose à un instant. dx vers l'adversaire, dy vers le haut, en pixels de sprite entiers
export interface MotionPose extends BodyPose {
  dx: number;
  dy: number;
  drawn: { name: BaseName | GestureName; index: number } | null; // image dessinée à afficher à la place
}

export type PosePart = Partial<Omit<MotionPose, "drawn">>;

// Un geste dure un nombre entier d'images de la grille commune
interface Gesture {
  duration(timings: MotionTimings): number;
  frames?(timings: MotionTimings): number; // nombre d'images imposé, à la place de celui de la durée
  // Le geste remplace la pose de fond (transitions : chute, relevé...) ; sinon il s'y ajoute
  replaces: boolean;
  // Pose de l'image `frame` (de 0 à count - 1) d'un geste de `count` images ; from : pose de fond quand il a été lancé
  pose(frame: number, count: number, rig: MotionRig, from: BaseName): PosePart;
}

export const FRAMES_PER_SECOND = 12;
export const FRAME_MS = 1000 / FRAMES_PER_SECOND;

// Numéro de l'image de la grille commune à un instant (un instant pile sur une marque peut, par arrondi, tomber
// sur l'image d'avant : sans effet, performance.now() n'y tombe jamais)
const frameAt = (nowMs: number) => Math.floor((nowMs * FRAMES_PER_SECOND) / 1000);

// Nombre d'images de la grille d'un geste : au moins sa durée
export function frameCount(durationMs: number) {
  return Math.max(1, Math.ceil((durationMs * FRAMES_PER_SECOND) / 1000));
}

// Suite d'images réparties sur le geste. Chaque image est montrée au moins une fois tant que le geste compte au
// moins autant d'images de la grille (vrai à vitesse normale, testé) ; en ?vitesse=X, des images sautent.
function sequence(images: PosePart[], frame: number, count: number) {
  return images[Math.min(images.length - 1, Math.floor((frame * images.length) / count))];
}

// Rangées dont s'affaisse un ennemi vaincu (part de sa hauteur, CONFIG) : prises dans ses jambes, sans les retirer toutes
function sinkOf(rig: MotionRig) {
  const sink = Math.round(rig.height * CONFIG.scene.battle.defeatedSink);
  return Math.min(sink, Math.max(0, rig.height - rig.waist - 1));
}

// Images des gestes faits d'une suite fixe ; null pour ceux qui se calculent image par image (victoire, disparition)
export function gestureImages(name: GestureName, rig: MotionRig, from: BaseName): PosePart[] | null {
  switch (name) {
    case "attack": return [{ dx: -2, lean: -1 }, { lean: 2 }, { lean: 1 }]; // élan, penché vers l'ennemi, avancé
    case "strike": return [{ lean: 1 }, { dx: 3, dy: 1, lean: 2 }, { dx: 5, lean: 3 }, { dx: 2, lean: 1 }];
    case "cast": return [{ lift: 1 }, { lift: 2, lean: -1 }, { lift: 1 }];
    case "hit": return [{ dx: -2, lean: -2 }, { dx: 1, lean: -1 }, { dx: -1, lean: -1 }];
    case "fall": {
      const kneeling = [{ fold: rig.kneel, lean: 2 }, { fold: rig.kneel, lean: 5 }]; // à genoux, s'effondre vers l'avant
      // Déjà à genoux (en danger) : il ne se relève pas pour flancher
      return from === "critical" ? kneeling : [{ lift: -1, lean: 2 }, ...kneeling];
    }
    case "revive": return [{ fold: rig.kneel, lean: 1 }, { fold: Math.round(rig.kneel / 2) }];
    case "slump": return [1, 2, 3].map((k) => ({ fold: Math.round((sinkOf(rig) * k) / 3), lean: k }));
    case "rise": return [2, 1].map((k) => ({ fold: Math.round((sinkOf(rig) * k) / 3), lean: k }));
    case "victory":
    case "dissolve": return null;
  }
}

function fromImages(name: GestureName): Gesture["pose"] {
  return (frame, count, rig, from) => sequence(gestureImages(name, rig, from) ?? [{}], frame, count);
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
  dissolve: {
    duration: (t) => t.death, replaces: true,
    // Comme l'ancienne disparition : la teinte d'abord (couleurs, côté scène), puis le haut s'efface jusqu'à la dernière rangée
    pose: (frame, count, rig) => {
      const p = (frame + 1) / count;
      return { clipTop: p <= 0.3 ? 0 : Math.round((rig.height * (p - 0.3)) / 0.7) };
    },
  },
};

// La respiration : un pixel de plus pour le haut du corps, une partie de la période, sur la grille commune
function breathing(rig: MotionRig, nowMs: number, period: number) {
  const seconds = frameAt(nowMs) / FRAMES_PER_SECOND;
  return Math.sin((seconds / period + rig.breath.phase) * Math.PI * 2) > 0.15 ? 1 : 0;
}

// breathe false : mouvement réduit, ou pendant un geste (la respiration s'arrête le temps du geste)
function basePose(name: BaseName, rig: MotionRig, nowMs: number, timings: MotionTimings, breathe: boolean): PosePart {
  switch (name) {
    case "idle": return { lift: breathe ? breathing(rig, nowMs, rig.breath.period) : 0 };
    case "acting": return { lean: 1 };
    case "critical": return { fold: rig.kneel, lean: 1, lift: breathe ? breathing(rig, nowMs, timings.kneel / 1000) : 0 };
    case "ko": return { lying: true };
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
    lying: base.lying ?? false,
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

  // Image dessinée qui remplace l'animation, s'il y en a (MAE-94) : réparties sur le geste, la dernière pour une pose de fond
  function drawnFor(name: BaseName | GestureName, frame: number, count: number) {
    const images = rig.drawn?.[name];
    if (!images) return null;
    return { name, index: Math.min(images - 1, Math.floor((frame * images) / count)) };
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
      gesture = { name, from: base, start: Math.ceil((nowMs * FRAMES_PER_SECOND) / 1000), count };
    },
    busy: running,
    poseAt(nowMs, moving) {
      const t = timings();
      if (!moving || !gesture || !running(nowMs)) {
        return { ...toPose(basePose(base, rig, nowMs, t, moving)), drawn: drawnFor(base, 1, 1) };
      }
      const def = GESTURES[gesture.name];
      const frame = Math.max(0, frameAt(nowMs) - gesture.start);
      const part = def.pose(frame, gesture.count, rig, gesture.from);
      const under = basePose(base, rig, nowMs, t, false);
      return { ...toPose(def.replaces ? part : addTo(under, part)), drawn: drawnFor(gesture.name, frame, gesture.count) };
    },
  };
}
