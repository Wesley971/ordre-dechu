// sprite-frames.ts - Image d'un combattant dans une pose, composée à partir de son PNG (MAE-30)
//
// Pixel art net : chaque pixel de l'image produite est un pixel du PNG, recopié tel quel. Une pose ne fait que
// déplacer des rangées entières d'un nombre entier de pixels, en retirer ou en répéter une. Aucun lissage, aucun
// agrandissement, aucune rotation (décisions de Wesley du 08/11/2026). Les couleurs (gris, assombri) sont posées par
// les scènes, pas ici. Sans DOM : testé sous Node (src/dev/sprite-frames.test.ts), et partagé par
// les deux scènes, qui affichent donc exactement les mêmes images.

// Pixels RGBA, rangée par rangée depuis le haut (la forme d'un ImageData)
export interface PixelImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

// Squelette d'un personnage : ce que la composition doit savoir de son image
export interface FrameRig {
  waist: number;    // première rangée (depuis le haut du PNG) du bas du corps ; au-dessus, le haut du corps
  facing: 1 | -1;   // sens du regard : 1 vers la droite de l'écran (héros), -1 vers la gauche (ennemis)
}

// Pose du corps, en pixels de sprite entiers. Sens « vers l'adversaire » : celui du regard (facing)
export interface BodyPose {
  lift: number;     // le haut du corps monte (positif) ou s'affaisse (négatif) ; un écart se comble en répétant la rangée de la taille
  lean: number;     // penché en escalier : la rangée du haut glisse de lean pixels vers l'adversaire, la taille ne bouge pas
  fold: number;     // jambes repliées : rangées retirées juste sous la taille, le haut du corps descend d'autant
  clipTop: number;  // rangées retirées depuis le haut du PNG (disparition)
}

export const REST_BODY: Readonly<BodyPose> = { lift: 0, lean: 0, fold: 0, clipTop: 0 };

// Toile de l'image produite : le PNG au repos y est posé en (originX, originY), pieds sur la dernière rangée.
// Une marge autour laisse la place de se pencher et de se lever sans sortir de la toile.
export interface FrameLayout {
  width: number;
  height: number;
  originX: number;
  originY: number;
}

export const FRAME_MARGIN = 6;

interface Size { readonly width: number; readonly height: number }
// Coin haut gauche d'une image dessinée (MAE-94) par rapport au PNG debout : centrée sur lui, le bas sur la même rangée
export interface Placement { x: number; y: number }
export const AT_REST: Readonly<Placement> = { x: 0, y: 0 };

export function drawnPlacement(standing: Size, image: Size): Placement {
  return { x: Math.floor((standing.width - image.width) / 2), y: standing.height - image.height };
}

// Toile commune au PNG debout et à ses images dessinées (others) : assez grande pour chacune, avec la marge.
// Elle reste centrée sur le PNG debout (même marge à gauche et à droite, même pour un écart de largeur impair) :
// la scène peinte centre son plan sur la toile (actors.ts)
export function frameLayout(width: number, height: number, others: readonly Size[] = []): FrameLayout {
  const placed = others.map((image) => ({ ...drawnPlacement({ width, height }, image), ...image }));
  const side = Math.max(0, ...placed.map((p) => Math.max(-p.x, p.x + p.width - width)));
  const minY = Math.min(0, ...placed.map((p) => p.y));
  return {
    width: width + 2 * (side + FRAME_MARGIN), height: height - minY + FRAME_MARGIN,
    originX: FRAME_MARGIN + side, originY: FRAME_MARGIN - minY,
  };
}

// Empreinte au sol d'une image (MAE-94) : colonnes occupées par ses `rows` rangées opaques les plus basses
// (right exclu), dans les coordonnées de l'image ; null si elle est vide. L'ombre de contact la suit.
export function footprint(image: PixelImage, rows = 3): Footprint | null {
  let left = image.width, right = 0, seen = 0;
  for (let y = image.height - 1; y >= 0 && seen < rows; y--) {
    let any = false;
    for (let x = 0; x < image.width; x++) {
      if (!image.data[(y * image.width + x) * 4 + 3]) continue;
      any = true;
      left = Math.min(left, x);
      right = Math.max(right, x + 1);
    }
    if (any) seen++;
  }
  return seen ? { left, right } : null;
}

// Colonnes occupées au sol (right exclu)
export type Footprint = { left: number; right: number };

// Ombre au sol d'une pose, par rapport à celle du repos : décalage du centre de l'empreinte (pixels de sprite) et
// rapport de largeur. rest et foot sont mesurées dans la même toile
export function footShadow(rest: Footprint | null, foot: Footprint | null) {
  if (!rest || !foot) return { shift: 0, stretch: 1 };
  return { shift: (foot.left + foot.right - rest.left - rest.right) / 2, stretch: (foot.right - foot.left) / (rest.right - rest.left) };
}

// Arrondi symétrique : -0,5 et 0,5 s'éloignent tous deux de zéro, pour que les deux sens du regard se correspondent
function roundAway(value: number) {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}

// Décalage d'une rangée du haut du corps, penché en escalier : 0 à la taille, lean à la première rangée
export function leanShift(row: number, waist: number, lean: number) {
  if (lean === 0 || waist <= 0) return 0;
  return roundAway((lean * (waist - row)) / waist);
}

// Recopie un pixel opaque, s'il tombe dans la toile ; un pixel transparent ne recouvre rien
function put(source: PixelImage, sx: number, sy: number, out: Uint8ClampedArray, layout: FrameLayout, dx: number, dy: number) {
  if (dx < 0 || dy < 0 || dx >= layout.width || dy >= layout.height) return;
  const from = (sy * source.width + sx) * 4;
  if (source.data[from + 3] === 0) return;
  const to = (dy * layout.width + dx) * 4;
  out[to] = source.data[from];
  out[to + 1] = source.data[from + 1];
  out[to + 2] = source.data[from + 2];
  out[to + 3] = source.data[from + 3];
}

// Compose l'image de la pose. out, s'il est donné, est réutilisé (layout.width × layout.height × 4 octets).
// at : où poser source par rapport au PNG debout (une image dessinée, drawnPlacement) ; rig.waist est alors sa taille à elle
export function composeFrame(
  source: PixelImage, rig: FrameRig, pose: BodyPose, layout: FrameLayout = frameLayout(source.width, source.height),
  out: Uint8ClampedArray = new Uint8ClampedArray(layout.width * layout.height * 4), at: Placement = AT_REST,
): PixelImage {
  out.fill(0);
  const left = layout.originX + at.x, top = layout.originY + at.y;
  const putRow = (row: number, destRow: number, shift: number) => {
    for (let x = 0; x < source.width; x++) put(source, x, row, out, layout, left + x + shift, top + destRow);
  };
  const { height } = source;
  const waist = Math.max(0, Math.min(height, rig.waist));
  const fold = Math.max(0, Math.min(height - waist, Math.round(pose.fold)));
  const lift = Math.round(pose.lift);
  const lean = Math.round(pose.lean);
  const clipTop = Math.max(0, Math.round(pose.clipTop));
  // Bas du corps, sans les rangées repliées
  for (let row = Math.max(waist + fold, clipTop); row < height; row++) putRow(row, row, 0);
  // Haut du corps levé : l'écart avec le bas se comble en répétant la dernière rangée du haut
  if (lift > 0 && waist > 0 && waist - 1 >= clipTop) {
    for (let k = 0; k < lift; k++) putRow(waist - 1, waist + fold - lift + k, 0);
  }
  // Haut du corps, descendu des rangées repliées, levé ou affaissé, penché en escalier ; il passe devant le bas
  for (let row = clipTop; row < waist; row++) {
    putRow(row, row + fold - lift, lean === 0 ? 0 : rig.facing * leanShift(row, waist, lean));
  }
  return { width: layout.width, height: layout.height, data: out };
}
