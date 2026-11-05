// framing.ts - Cadrage de la scène : taille des sprites, distance de la caméra et place de la peinture à l'écran (MAE-28)
//
// Deux règles à tenir ensemble :
// - un pixel de sprite fait un nombre entier k de pixels écran, sinon le pixel art se déforme ;
// - les 5 personnages tiennent dans la largeur, même sur un téléphone en portrait.
// Écran assez large : k suit la hauteur et la peinture remplit toute la hauteur.
// Écran étroit : k suit la largeur, et la peinture rétrécit dans la même proportion que les sprites pour
// garder leur taille relative. Elle ne remplit plus la hauteur : la brume et l'ombre comblent le haut et le bas.

import { MathUtils, Vector3, type PerspectiveCamera } from "three";
import { CONFIG } from "../config.ts";
import type { Decor } from "../data/decors.ts";

export interface ScreenSize { cssWidth: number; cssHeight: number; ratio: number }
// Chaque personnage : colonne de ses pieds sur la peinture et largeur de son sprite. Vide si la scène est sans personnage.
export type GroupExtent = { col: number; spriteWidth: number }[];

export interface Framing {
  spritePixel: number;    // k : pixels écran réels par pixel de sprite
  cameraDistance: number; // à cette profondeur, un pixel de sprite fait exactement k pixels écran
  fitted: boolean;        // true : la largeur limite k, la peinture ne remplit plus la hauteur
  colToNdc(col: number): number;
  rowToNdc(row: number): number;
}

export function computeFraming(size: ScreenSize, decor: Decor, group: GroupExtent): Framing {
  const { screenHeightInSpritePixels: screenRows, groupMarginInSpritePixels: margin, spritePixel: worldPixel, camera } = CONFIG.scene;
  const { width, height } = decor.image;
  const deviceWidth = size.cssWidth * size.ratio;
  const deviceHeight = size.cssHeight * size.ratio;

  let spritePixel = Math.max(2, Math.round(deviceHeight / screenRows));
  let imageHeight = deviceHeight;
  let centerCol = width / 2;
  let fitted = false;

  if (group.length > 0) {
    // Les sprites sont centrés sur leur place : ils débordent de la moitié de leur largeur de chaque côté
    const imagePixelsPerSpritePixel = height / screenRows;
    const left = Math.min(...group.map((actor) => actor.col - (actor.spriteWidth / 2) * imagePixelsPerSpritePixel));
    const right = Math.max(...group.map((actor) => actor.col + (actor.spriteWidth / 2) * imagePixelsPerSpritePixel));
    const groupWidth = (right - left) / imagePixelsPerSpritePixel + 2 * margin;
    const widthLimit = Math.floor(deviceWidth / groupWidth);
    if (widthLimit < spritePixel) {
      spritePixel = Math.max(1, widthLimit);
      imageHeight = Math.min(deviceHeight, screenRows * spritePixel);
      centerCol = (left + right) / 2;
      fitted = true;
    }
  }

  return {
    spritePixel,
    cameraDistance: (deviceHeight * worldPixel) / (spritePixel * 2 * Math.tan(MathUtils.degToRad(camera.fov / 2))),
    fitted,
    colToNdc: (col) => (col - centerCol) * (imageHeight / height) * (2 / deviceWidth),
    rowToNdc: (row) => (0.5 - row / height) * 2 * (imageHeight / deviceHeight),
  };
}

// Point du monde, à une profondeur donnée, qui s'affiche en (x, y) à l'écran : c'est ce qui fait que la
// peinture montée en relief reste identique à elle-même vue depuis la caméra au repos
export function pointAtDepth(camera: PerspectiveCamera, ndcX: number, ndcY: number, depth: number): Vector3 {
  const forward = camera.getWorldDirection(new Vector3());
  const ray = new Vector3(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
  return camera.position.clone().addScaledVector(ray, depth / ray.dot(forward));
}

// Profondeur (le long de l'axe de la caméra) d'un point du monde
export function depthOf(camera: PerspectiveCamera, point: Vector3): number {
  const forward = camera.getWorldDirection(new Vector3());
  return new Vector3().subVectors(point, camera.position).dot(forward);
}
