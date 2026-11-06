// actors.ts - Personnages en pixel art posés sur la peinture, avec ombres de contact (MAE-28), et leurs poses (MAE-29)
//
// Chaque sprite est dans une scène à part (spriteScene), dessinée APRÈS le flou : le flou ne peut pas le
// toucher, quelle que soit la fenêtre. Il est mis à l'échelle de sa profondeur, pour qu'un de ses pixels
// fasse exactement k pixels écran. Pas d'éclairage ni de brouillard : ses couleurs restent celles du PNG.
// La pose d'un acteur (décalage, rotation, teinte, découpe...) est un objet que la scène de combat modifie,
// directement ou par une animation ; elle est appliquée à chaque image.

import {
  AdditiveBlending, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type PerspectiveCamera,
} from "three";
import { CONFIG } from "../config.ts";
import type { ImagePoint } from "../data/decors.ts";
import { depthOf, type Framing } from "./framing.ts";
import { context2d, loadImage, pixelTexture, radialTexture, type ResourceBin } from "./materials.ts";

export interface ActorDef {
  id: string;
  src: string;               // fichier du sprite, pour les mesures (tools/check-sprite-sharpness.mjs)
  image: HTMLImageElement;   // déjà chargée (preloadImages) : la construction est alors synchrone
  place: ImagePoint;
  // Respiration : le haut du corps (au-dessus de `cut`, de 0 en bas à 1 en haut) monte d'un pixel net
  breath: { cut: number; period: number; phase: number };
  // Lueur tenue en main (lanterne, Souffle). at : position sur le sprite, de 0 à 1
  halo?: { color: string; at: [number, number]; size: number };
}

// Pose d'un acteur. Décalages en pixels de sprite ; x positif vers la droite de l'écran, y positif vers le haut.
export interface ActorPose {
  offsetX: number;
  offsetY: number;
  rotation: number;   // radians, autour des pieds ; négatif : sens des aiguilles d'une montre
  scaleY: number;
  visible: boolean;
  breathing: boolean;
  brightness: number; // 1 : couleurs du PNG
  gray: number;       // 0 à 1 : part de gris
  tint: Color;        // couleur mêlée aux pixels, à hauteur de tintMix
  tintMix: number;
  opacity: number;
  clipTop: number;    // 0 à 1 : part du haut du sprite découpée (disparition)
  glow: number;       // 0 à 1 : lueur du Souffle derrière le sprite
}

export interface Actor {
  readonly id: string;
  readonly width: number;   // pixels de sprite
  readonly height: number;  // pixels de sprite, sans la rangée de respiration
  readonly koLift: number;  // couché (rotation d'un quart de tour), ce qu'il faut remonter pour toucher le sol, en pixels de sprite
  pose: ActorPose;          // modifiée librement par la scène de combat, appliquée à chaque image
}

export interface ActorBox { id: string; file: string; left: number; top: number; right: number; bottom: number; texels: number }

export interface ActorsView {
  actors: Actor[];
  get(id: string): Actor | undefined;
  // surfacePoint : point du relief peint sous les pieds (colonne et ligne de la peinture)
  layout(framing: Framing, surfacePoint: (place: ImagePoint) => Vector3): void;
  rescale(): void; // après un déplacement de la caméra
  update(t: number, moving: boolean): void; // t en secondes ; moving false : mouvement réduit, poses finales
  focusRange(): { min: number; max: number } | null; // bande de l'écran occupée, de 0 (bas) à 1 (haut)
  boxes(deviceWidth: number, deviceHeight: number): ActorBox[]; // en pixels réels du canvas
}

const SHADOW_ORDER = 50; // au-dessus du décor peint, sans test de profondeur : le relief la couperait
// Taille des ombres à l'écran, validée dans le labo
const SHADOW_BOOST = 1.2;
const HALO_OPACITY = 0.35;
const GLOW_COLOR = "#f0c95a"; // or vif de la palette des personnages : la lueur du Souffle
const GLOW_OPACITY = 0.8;

export function defaultPose(): ActorPose {
  return {
    offsetX: 0, offsetY: 0, rotation: 0, scaleY: 1, visible: true, breathing: true,
    brightness: 1, gray: 0, tint: new Color("#ffffff"), tintMix: 0, opacity: 1, clipTop: 0, glow: 0,
  };
}

export function preloadImages(urls: string[]): Promise<Map<string, HTMLImageElement>> {
  const unique = [...new Set(urls)];
  return Promise.all(unique.map(loadImage)).then((images) => new Map(unique.map((url, i) => [url, images[i]])));
}

// Colonne opaque la plus à droite, depuis le centre : couché tête vers la droite, c'est le point le plus bas
function measureKoLift(data: Uint8ClampedArray, width: number, height: number) {
  for (let x = width - 1; x >= 0; x--) {
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * 4 + 3]) return x + 1 - width / 2;
    }
  }
  return width / 2;
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
    const { image } = def;
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height + 1; // rangée vide en haut : la place de la respiration
    const context = context2d(canvas, { willReadFrequently: true });
    context.drawImage(image, 0, 1);
    const koLift = measureKoLift(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);

    const pose = defaultPose();
    const uniforms = {
      uBreath: { value: 0 },
      uCut: { value: def.breath.cut },
      uTexel: { value: 1 / canvas.height },
      uBrightness: { value: 1 },
      uGray: { value: 0 },
      uTint: { value: new Color("#ffffff") },
      uTintMix: { value: 0 },
      uOpacity: { value: 1 },
      uClipTop: { value: 0 },
    };
    // transparent : l'opacité de la pose se mêle au décor ; alphaTest garde les bords nets
    const material = bin.add(new MeshBasicMaterial({ map: bin.add(pixelTexture(canvas)), alphaTest: 0.5, transparent: true, fog: false }));
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = [
        "uniform float uBreath; uniform float uCut; uniform float uTexel; uniform float uBrightness; uniform float uGray;",
        "uniform vec3 uTint; uniform float uTintMix; uniform float uOpacity; uniform float uClipTop;",
        shader.fragmentShader
          .replace("#include <map_fragment>", /* glsl */ `
            if ( vMapUv.y > 1.0 - uClipTop ) discard;
            vec2 breathUv = vMapUv;
            if ( breathUv.y > uCut ) breathUv.y -= uBreath * uTexel;
            vec4 spriteTexel = texture2D( map, breathUv );
            float luma = dot( spriteTexel.rgb, vec3( 0.299, 0.587, 0.114 ) );
            spriteTexel.rgb = mix( spriteTexel.rgb, vec3( luma ), uGray ) * uBrightness;
            spriteTexel.rgb = mix( spriteTexel.rgb, uTint, uTintMix );
            diffuseColor *= spriteTexel;`)
          // Après le test d'opacité : une opacité de pose sous 0,5 effacerait tout le sprite sinon
          .replace("#include <alphatest_fragment>", "#include <alphatest_fragment>\n diffuseColor.a *= uOpacity;"),
      ].join("\n");
    };
    material.customProgramCacheKey = () => "game-sprite-pose";

    const width = canvas.width * pixel;
    const height = canvas.height * pixel;
    const geometry = bin.add(new PlaneGeometry(width, height));
    geometry.translate(0, height / 2, 0); // origine aux pieds
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

    const actor: Actor = { id: def.id, width: canvas.width, height: image.height, koLift, pose };
    return { def, actor, root, frame, sprite, blob, contact, uniforms, haloMaterial, glowMaterial, width, height, feet: new Vector3() };
  });

  function applyPose(view: (typeof views)[number]) {
    const { pose } = view.actor;
    const scale = depthOf(camera, view.feet) / cameraDistance;
    const worldX = pose.offsetX * pixel * scale;
    const worldY = pose.offsetY * pixel * scale;
    view.root.position.set(view.feet.x + worldX, view.feet.y, view.feet.z);
    view.sprite.position.set(view.feet.x + worldX, view.feet.y + worldY, view.feet.z);
    view.sprite.rotation.z = pose.rotation;
    view.sprite.scale.set(scale, scale * pose.scaleY, 1);
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
    view.uniforms.uClipTop.value = pose.clipTop;
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
        const { period, phase } = view.def.breath;
        const breathing = moving && view.actor.pose.breathing && Math.sin((t / period + phase) * Math.PI * 2) > 0.15;
        view.uniforms.uBreath.value = breathing ? 1 : 0;
        if (view.haloMaterial) view.haloMaterial.opacity = HALO_OPACITY * (1 + 0.12 * Math.sin(t * 1.3 + i * 1.7));
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
    // Boîte à l'écran du sprite tel qu'il est posé (décalé, tourné, mis à l'échelle)
    boxes(deviceWidth, deviceHeight) {
      const corner = new Vector3();
      return views.map((view) => {
        view.sprite.updateMatrixWorld();
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (const [x, y] of [[-view.width / 2, 0], [view.width / 2, 0], [-view.width / 2, view.height], [view.width / 2, view.height]]) {
          corner.set(x, y, 0).applyMatrix4(view.sprite.matrixWorld).project(camera);
          const screenX = ((corner.x + 1) / 2) * deviceWidth;
          const screenY = ((1 - corner.y) / 2) * deviceHeight;
          left = Math.min(left, screenX); right = Math.max(right, screenX);
          top = Math.min(top, screenY); bottom = Math.max(bottom, screenY);
        }
        return { id: view.def.id, file: view.def.src, left, top, right, bottom, texels: Math.round(view.width / pixel) };
      });
    },
  };
}
