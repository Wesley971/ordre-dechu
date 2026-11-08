// actors.ts - Personnages en pixel art posés sur la peinture, avec ombres de contact (MAE-28), et leurs poses (MAE-29, MAE-30)
//
// Chaque sprite est dans une scène à part (spriteScene), dessinée APRÈS le flou : le flou ne peut pas le
// toucher, quelle que soit la fenêtre. Il est mis à l'échelle de sa profondeur, pour qu'un de ses pixels
// fasse exactement k pixels écran. Pas d'éclairage ni de brouillard : ses couleurs restent celles du PNG.
// Sa texture est l'image animée du combattant (src/ui/animated-sprite.ts, MAE-30), la même que dans la scène DOM :
// chaque pixel vient du PNG. La pose d'un acteur (décalage entier, teinte, lueur...) est un objet que la scène de
// combat modifie ; elle est appliquée à chaque image. Aucune rotation ni aucun étirement de l'image.

import {
  AdditiveBlending, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type CanvasTexture, type PerspectiveCamera,
} from "three";
import { CONFIG } from "../config.ts";
import type { ImagePoint } from "../data/decors.ts";
import type { FrameLayout } from "../ui/sprite-frames.ts";
import { depthOf, type Framing } from "./framing.ts";
import { loadImage, pixelTexture, radialTexture, type ResourceBin } from "./materials.ts";

export interface ActorDef {
  id: string;
  src: string;               // fichier du sprite, pour les mesures (tools/check-sprite-sharpness.mjs)
  width: number;             // taille du PNG, en pixels de sprite : le rectangle des ancres et des mesures
  height: number;
  // Image animée, déjà chargée : un canvas à la taille de la toile des poses, le PNG au repos posé en (originX,
  // originY), pieds sur la dernière rangée (sprite-frames.ts, frameLayout)
  frame: { canvas: HTMLCanvasElement; layout: FrameLayout };
  place: ImagePoint;
  // Lueur tenue en main (lanterne, Souffle). at : position sur le sprite, de 0 à 1
  halo?: { color: string; at: [number, number]; size: number };
}

// Pose d'un acteur. Décalages en pixels de sprite entiers ; x positif vers la droite de l'écran, y positif vers le haut.
export interface ActorPose {
  offsetX: number;
  offsetY: number;
  anchorX: number;    // décalage du rectangle des ancres et des mesures (glissement seul, sans recul ni saut)
  visible: boolean;
  brightness: number; // 1 : couleurs du PNG
  gray: number;       // 0 à 1 : part de gris
  tint: Color;        // couleur mêlée aux pixels, à hauteur de tintMix
  tintMix: number;
  opacity: number;
  glow: number;       // 0 à 1 : lueur du Souffle derrière le sprite
}

export interface Actor {
  readonly id: string;
  readonly width: number;   // pixels de sprite (PNG)
  readonly height: number;  // pixels de sprite (PNG)
  pose: ActorPose;          // modifiée librement par la scène de combat, appliquée à chaque image
  redrawn(): void;          // l'image animée vient de changer : la texture est renvoyée à la carte graphique
}

export interface ActorBox { id: string; file: string; left: number; top: number; right: number; bottom: number; texels: number }

export interface ActorsView {
  actors: Actor[];
  get(id: string): Actor | undefined;
  // surfacePoint : point du relief peint sous les pieds (colonne et ligne de la peinture)
  layout(framing: Framing, surfacePoint: (place: ImagePoint) => Vector3): void;
  rescale(): void; // après un déplacement de la caméra
  update(t: number, moving: boolean): void; // t en secondes ; moving false : mouvement réduit
  focusRange(): { min: number; max: number } | null; // bande de l'écran occupée, de 0 (bas) à 1 (haut)
  boxes(deviceWidth: number, deviceHeight: number): ActorBox[]; // rectangle du PNG, en pixels réels du canvas
}

const SHADOW_ORDER = 50; // au-dessus du décor peint, sans test de profondeur : le relief la couperait
// Taille des ombres à l'écran, validée dans le labo
const SHADOW_BOOST = 1.2;
const HALO_OPACITY = 0.35;
const GLOW_COLOR = "#f0c95a"; // or vif de la palette des personnages : la lueur du Souffle
const GLOW_OPACITY = 0.8;

export function defaultPose(): ActorPose {
  return { offsetX: 0, offsetY: 0, anchorX: 0, visible: true, brightness: 1, gray: 0, tint: new Color("#ffffff"), tintMix: 0, opacity: 1, glow: 0 };
}

export function preloadImages(urls: string[]): Promise<Map<string, HTMLImageElement>> {
  const unique = [...new Set(urls)];
  return Promise.all(unique.map(loadImage)).then((images) => new Map(unique.map((url, i) => [url, images[i]])));
}

export function buildActors(
  defs: ActorDef[], parent: Group, spriteParent: Group, camera: PerspectiveCamera, bin: ResourceBin,
): ActorsView {
  const pixel = CONFIG.scene.spritePixel;
  const pitch = CONFIG.scene.camera.pitch;
  const softShadow = bin.add(radialTexture(64, 1.4));
  const contactShadow = bin.add(radialTexture(64, 0.8));
  const haloMask = bin.add(radialTexture(64, 2.2));
  let cameraDistance = 1;

  const views = defs.map((def) => {
    const { layout } = def.frame;
    const pose = defaultPose();
    const uniforms = {
      uBrightness: { value: 1 },
      uGray: { value: 0 },
      uTint: { value: new Color("#ffffff") },
      uTintMix: { value: 0 },
      uOpacity: { value: 1 },
    };
    const texture: CanvasTexture = bin.add(pixelTexture(def.frame.canvas));
    // transparent : l'opacité de la pose se mêle au décor ; alphaTest garde les bords nets
    const material = bin.add(new MeshBasicMaterial({ map: texture, alphaTest: 0.5, transparent: true, fog: false }));
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = [
        "uniform float uBrightness; uniform float uGray; uniform vec3 uTint; uniform float uTintMix; uniform float uOpacity;",
        shader.fragmentShader
          .replace("#include <map_fragment>", /* glsl */ `
            vec4 spriteTexel = texture2D( map, vMapUv );
            float luma = dot( spriteTexel.rgb, vec3( 0.299, 0.587, 0.114 ) );
            spriteTexel.rgb = mix( spriteTexel.rgb, vec3( luma ), uGray ) * uBrightness;
            spriteTexel.rgb = mix( spriteTexel.rgb, uTint, uTintMix );
            diffuseColor *= spriteTexel;`)
          // Après le test d'opacité : une opacité de pose sous 0,5 effacerait tout le sprite sinon
          .replace("#include <alphatest_fragment>", "#include <alphatest_fragment>\n diffuseColor.a *= uOpacity;"),
      ].join("\n");
    };
    material.customProgramCacheKey = () => "game-sprite-frame";

    // Le plan a la taille de la toile des poses ; ses pieds (dernière rangée) à l'origine, centré comme le PNG
    // (marges égales à gauche et à droite)
    const width = def.width * pixel;
    const height = def.height * pixel;
    const geometry = bin.add(new PlaneGeometry(layout.width * pixel, layout.height * pixel));
    geometry.translate(0, (layout.height * pixel) / 2, 0); // origine aux pieds
    const sprite = new Mesh(geometry, material);
    sprite.rotation.x = -pitch; // face à la caméra : sans cela, le sprite serait écrasé en hauteur
    spriteParent.add(sprite);

    const root = new Group();
    const shadowGeometry = bin.add(new PlaneGeometry(1, 1));
    const addShadow = (color: string, alphaMap: typeof softShadow, opacity: number, y: number, order: number) => {
      const shadow = new Mesh(shadowGeometry, bin.add(new MeshBasicMaterial({
        color, alphaMap, transparent: true, opacity, depthWrite: false, depthTest: false,
      })));
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = y;
      shadow.renderOrder = order;
      root.add(shadow);
      return shadow;
    };
    const blob = addShadow("#02080b", softShadow, 0.75, 0.02, SHADOW_ORDER);
    // Ombre de contact : petite, dense, juste sous les pieds. C'est elle qui « pose » le personnage au sol.
    const contact = addShadow("#000608", contactShadow, 0.9, 0.025, SHADOW_ORDER);

    // Plans face à la caméra qui suivent le sprite : halo tenu en main, lueur du Souffle
    const frame = new Group();
    frame.rotation.x = -pitch;
    root.add(frame);
    const framePlane = (color: string, size: number, opacity: number, x: number, y: number) => {
      const planeMaterial = bin.add(new MeshBasicMaterial({
        color, alphaMap: haloMask, transparent: true, opacity,
        blending: AdditiveBlending, depthWrite: false, depthTest: false, fog: false,
      }));
      const plane = new Mesh(bin.add(new PlaneGeometry(size, size)), planeMaterial);
      plane.position.set(x, y, -0.06);
      plane.renderOrder = SHADOW_ORDER;
      frame.add(plane);
      return planeMaterial;
    };
    const haloMaterial = def.halo
      ? framePlane(def.halo.color, def.halo.size, HALO_OPACITY, (def.halo.at[0] - 0.5) * width, def.halo.at[1] * height)
      : null;
    const glowMaterial = framePlane(GLOW_COLOR, Math.max(width, height) * 1.5, 0, 0, height * 0.5);
    parent.add(root);

    const actor: Actor = { id: def.id, width: def.width, height: def.height, pose, redrawn: () => { texture.needsUpdate = true; } };
    return { def, actor, root, frame, sprite, blob, contact, uniforms, haloMaterial, glowMaterial, width, height, feet: new Vector3(), anchorShift: new Vector3() };
  });

  function applyPose(view: (typeof views)[number]) {
    const { pose } = view.actor;
    const scale = depthOf(camera, view.feet) / cameraDistance;
    // Pixels de sprite entiers : un pixel de sprite fait k pixels réels, le sprite reste sur la grille
    const worldX = Math.round(pose.offsetX) * pixel * scale;
    const worldY = Math.round(pose.offsetY) * pixel * scale;
    view.root.position.set(view.feet.x + worldX, view.feet.y, view.feet.z);
    view.sprite.position.set(view.feet.x + worldX, view.feet.y + worldY, view.feet.z);
    // Écart entre le sprite posé et le rectangle de son ancre, en coordonnées du monde (boxes)
    view.anchorShift.set((Math.round(pose.anchorX) * pixel * scale) - worldX, -worldY, 0);
    view.sprite.scale.setScalar(scale);
    view.frame.scale.setScalar(scale);
    const shadow = scale * SHADOW_BOOST;
    view.blob.scale.set(view.width * 0.75 * shadow, Math.min(0.9, view.width * 0.4) * shadow, 1);
    view.contact.scale.set(view.width * 0.42 * shadow, Math.min(0.35, view.width * 0.16) * shadow, 1);
    view.sprite.visible = view.root.visible = pose.visible;
    view.uniforms.uBrightness.value = pose.brightness;
    view.uniforms.uGray.value = pose.gray;
    view.uniforms.uTint.value.copy(pose.tint);
    view.uniforms.uTintMix.value = pose.tintMix;
    view.uniforms.uOpacity.value = pose.opacity;
    view.glowMaterial.opacity = GLOW_OPACITY * pose.glow;
  }

  const rescale = () => views.forEach(applyPose);

  const point = new Vector3();
  const actors = views.map((view) => view.actor);
  return {
    actors,
    get: (id) => actors.find((actor) => actor.id === id),
    // Les pieds sont sur le relief : le sprite suit le sol peint quand la caméra bouge, au lieu d'y glisser
    layout(framing, surfacePoint) {
      cameraDistance = framing.cameraDistance;
      for (const view of views) view.feet.copy(surfacePoint(view.def.place));
      rescale();
    },
    rescale,
    update(t, moving) {
      views.forEach((view, i) => {
        if (view.haloMaterial) view.haloMaterial.opacity = HALO_OPACITY * (moving ? 1 + 0.12 * Math.sin(t * 1.3 + i * 1.7) : 1);
        applyPose(view);
      });
    },
    focusRange() {
      const visible = views.filter((view) => view.actor.pose.visible);
      if (visible.length === 0) return null;
      let min = Infinity;
      let max = -Infinity;
      for (const view of visible) {
        for (const y of [0, view.height * view.sprite.scale.y]) {
          point.set(view.feet.x, view.feet.y + y, view.feet.z).project(camera);
          min = Math.min(min, (point.y + 1) / 2);
          max = Math.max(max, (point.y + 1) / 2);
        }
      }
      return { min, max };
    },
    // Boîte à l'écran du rectangle du PNG à la place de son ancre (glissement compris, sans recul ni saut), mis à
    // l'échelle : sans la marge de la toile. Les mesures de netteté se prennent au repos, où les deux se confondent.
    boxes(deviceWidth, deviceHeight) {
      const corner = new Vector3();
      return views.map((view) => {
        view.sprite.updateMatrixWorld();
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (const [x, y] of [[-view.width / 2, 0], [view.width / 2, 0], [-view.width / 2, view.height], [view.width / 2, view.height]]) {
          corner.set(x, y, 0).applyMatrix4(view.sprite.matrixWorld).add(view.anchorShift).project(camera);
          const screenX = ((corner.x + 1) / 2) * deviceWidth;
          const screenY = ((1 - corner.y) / 2) * deviceHeight;
          left = Math.min(left, screenX); right = Math.max(right, screenX);
          top = Math.min(top, screenY); bottom = Math.max(bottom, screenY);
        }
        return { id: view.def.id, file: view.def.src, left, top, right, bottom, texels: view.def.width };
      });
    },
  };
}
