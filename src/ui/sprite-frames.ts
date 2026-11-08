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

export function frameLayout(width: number, height: number): FrameLayout {
  return { width: width + 2 * FRAME_MARGIN, height: height + FRAME_MARGIN, originX: FRAME_MARGIN, originY: FRAME_MARGIN };
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

function putRow(source: PixelImage, row: number, out: Uint8ClampedArray, layout: FrameLayout, destRow: number, shift: number) {
  for (let x = 0; x < source.width; x++) put(source, x, row, out, layout, layout.originX + x + shift, destRow);
}

// Compose l'image de la pose. out, s'il est donné, est réutilisé (layout.width × layout.height × 4 octets)
export function composeFrame(
  source: PixelImage, rig: FrameRig, pose: BodyPose, layout: FrameLayout = frameLayout(source.width, source.height),
  out: Uint8ClampedArray = new Uint8ClampedArray(layout.width * layout.height * 4),
): PixelImage {
  out.fill(0);
  const { height } = source;
  const waist = Math.max(0, Math.min(height, rig.waist));
  const fold = Math.max(0, Math.min(height - waist, Math.round(pose.fold)));
  const lift = Math.round(pose.lift);
  const lean = Math.round(pose.lean);
  const clipTop = Math.max(0, Math.round(pose.clipTop));
  // Bas du corps, sans les rangées repliées
  for (let row = Math.max(waist + fold, clipTop); row < height; row++) putRow(source, row, out, layout, layout.originY + row, 0);
  // Haut du corps levé : l'écart avec le bas se comble en répétant la dernière rangée du haut
  if (lift > 0 && waist > 0 && waist - 1 >= clipTop) {
    for (let k = 0; k < lift; k++) putRow(source, waist - 1, out, layout, layout.originY + waist + fold - lift + k, 0);
  }
  // Haut du corps, descendu des rangées repliées, levé ou affaissé, penché en escalier ; il passe devant le bas
  for (let row = clipTop; row < waist; row++) {
    putRow(source, row, out, layout, layout.originY + row + fold - lift, lean === 0 ? 0 : rig.facing * leanShift(row, waist, lean));
  }
  return { width: layout.width, height: layout.height, data: out };
}
