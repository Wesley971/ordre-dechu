// animated-sprite.ts - Un combattant animé : son image dans un canvas, redessinée quand sa pose change (MAE-30)
//
// Le canvas a la taille de la toile de la pose (sprite-frames.ts, frameLayout), en pixels de sprite : chaque scène
// l'agrandit d'un nombre entier de pixels réels, sans lissage (DOM : image-rendering: pixelated ; scène peinte :
// texture au plus proche). Une seule boucle requestAnimationFrame sert tous les sprites ; elle ne redessine un
// sprite que quand sa pose change (au plus douze fois par seconde, sprite-motion.ts) et s'arrête sans sprite.
// Mouvement réduit (MAE-58) : la pose de fond seule, immobile. Les images dessinées (MAE-94) se brancheront ici :
// sprite-motion.ts sait déjà les désigner (MotionPose.drawn).

import { CONFIG } from "../config.ts";
import type { SpriteRig } from "../data/game-data.ts";
import { composeFrame, frameLayout, type FrameLayout, type FrameRig, type PixelImage } from "./sprite-frames.ts";
import { createMotion, shadeColor, type BaseName, type GestureName, type MotionPose, type SpriteMotion } from "./sprite-motion.ts";

export interface AnimatedSpriteOptions {
  url: string;                 // PNG du personnage
  height: number;              // sa hauteur, en pixels de sprite (HERO_CANVAS, ENEMIES.canvasHeight)
  rig: SpriteRig;
  facing: 1 | -1;              // 1 : regarde vers la droite (héros), -1 : vers la gauche (ennemis)
  phase?: number;              // décalage de respiration en plus de celui du squelette (rang de l'ennemi)
  initial?: BaseName;
  onPose?(pose: MotionPose): void; // la pose vient de changer : la scène place le sprite (dx, dy)
}

export interface AnimatedSprite {
  readonly canvas: HTMLCanvasElement;
  readonly layout: FrameLayout;   // où le PNG au repos est posé dans le canvas (originX, originY)
  readonly ready: Promise<void>;  // images chargées et première pose dessinée
  readonly base: BaseName;
  pose(): MotionPose;             // dernière pose dessinée
  setBase(name: BaseName): void;
  play(name: GestureName): void;  // avant setBase pour une transition (fall puis ko, sprite-motion.ts)
  dispose(): void;
}

// Filtre CSS du héros éteint (MotionPose.shade) : gris et assombri, une couleur, sans flou ; vide s'il est allumé
export function shadeFilter(shade: number) {
  if (shade <= 0) return "";
  const { gray, brightness } = shadeColor(shade);
  return `grayscale(${gray}) brightness(${brightness})`;
}

// — Boucle commune —

interface Running { tick(nowMs: number, moving: boolean): void }
const running = new Set<Running>();
let loop = 0;
const reducedMotion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
let reducedOverride: boolean | null = null;

// Aperçu des animations (mode test) : simule le réglage « mouvement réduit » ; null rend la main au système
export function overrideReducedMotion(reduced: boolean | null) {
  reducedOverride = reduced;
}

function frame(nowMs: number) {
  const moving = !(reducedOverride ?? reducedMotion?.matches ?? false);
  for (const sprite of running) sprite.tick(nowMs, moving);
  loop = running.size > 0 ? requestAnimationFrame(frame) : 0;
}

function start(sprite: Running) {
  running.add(sprite);
  if (!loop) loop = requestAnimationFrame(frame);
}

// — Images —

function loadPixels(url: string): Promise<PixelImage> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) { reject(new Error("Animation : canvas 2D indisponible")); return; }
      context.drawImage(image, 0, 0);
      const { width, height, data } = context.getImageData(0, 0, canvas.width, canvas.height);
      resolve({ width, height, data });
    };
    image.onerror = () => reject(new Error(`Animation : image introuvable : ${url}`));
    image.src = url;
  });
}

const samePose = (a: MotionPose, b: MotionPose) =>
  a.dx === b.dx && a.dy === b.dy && a.lift === b.lift && a.lean === b.lean && a.fold === b.fold && a.clipTop === b.clipTop
  && a.shade === b.shade && a.drawn?.name === b.drawn?.name && a.drawn?.index === b.drawn?.index;

export function createAnimatedSprite(options: AnimatedSpriteOptions): AnimatedSprite {
  const canvas = document.createElement("canvas");
  canvas.className = "sprite-canvas";
  canvas.width = canvas.height = 1; // vide jusqu'au chargement (ready), pas la taille par défaut d'un canvas
  const { rig } = options;
  const frameRig: FrameRig = { waist: rig.waist, facing: options.facing };
  let layout = frameLayout(1, 1);
  let source: PixelImage | null = null;
  let context: CanvasRenderingContext2D | null = null;
  let buffer: ImageData | null = null;
  let current: MotionPose | null = null;
  let disposed = false;

  const motion: SpriteMotion = createMotion(
    { height: options.height, waist: rig.waist, breath: { period: rig.breath, phase: rig.phase + (options.phase ?? 0) } },
    () => CONFIG.timing, options.initial,
  );

  function draw(pose: MotionPose) {
    if (!source || !context || !buffer) return;
    composeFrame(source, frameRig, pose, layout, buffer.data);
    context.putImageData(buffer, 0, 0);
    current = pose;
    options.onPose?.(pose);
  }

  const sprite: Running = {
    tick(nowMs, moving) {
      const pose = motion.poseAt(nowMs, moving);
      if (!current || !samePose(pose, current)) draw(pose);
    },
  };

  const ready = (async () => {
    const png = await loadPixels(options.url);
    if (disposed) return;
    source = png;
    layout = frameLayout(png.width, png.height);
    canvas.width = layout.width;
    canvas.height = layout.height;
    context = canvas.getContext("2d");
    if (!context) throw new Error("Animation : canvas 2D indisponible");
    buffer = context.createImageData(layout.width, layout.height);
    sprite.tick(performance.now(), !(reducedOverride ?? reducedMotion?.matches ?? false));
    start(sprite);
  })();

  return {
    canvas,
    get layout() { return layout; },
    ready,
    get base() { return motion.base; },
    pose: () => current ?? motion.poseAt(performance.now(), false),
    setBase: (name) => motion.setBase(name),
    play: (name) => motion.play(name, performance.now()),
    dispose() {
      disposed = true;
      running.delete(sprite);
    },
  };
}
