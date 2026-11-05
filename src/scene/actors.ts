// actors.ts - Personnages en pixel art posés sur la peinture, avec ombres de contact (MAE-28)
//
// Chaque sprite est dans une scène à part (spriteScene), dessinée APRÈS le flou : le flou ne peut pas le
// toucher, quelle que soit la fenêtre. Il est mis à l'échelle de sa profondeur, pour qu'un de ses pixels
// fasse exactement k pixels écran. Pas d'éclairage ni de brouillard : ses couleurs restent celles du PNG.

import {
  AdditiveBlending, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type PerspectiveCamera,
} from "three";
import { CONFIG } from "../config.ts";
import type { ImagePoint } from "../data/decors.ts";
import { depthOf, type Framing, type GroupExtent } from "./framing.ts";
import { context2d, loadImage, pixelTexture, radialTexture, type ResourceBin } from "./materials.ts";

export interface ActorDef {
  id: string;
  src: string;
  place: ImagePoint;
  // Respiration : le haut du corps (au-dessus de `cut`, de 0 en bas à 1 en haut) monte d'un pixel net
  breath: { cut: number; period: number; phase: number };
  // Lueur tenue en main (lanterne, Souffle). at : position sur le sprite, de 0 à 1
  halo?: { color: string; at: [number, number]; size: number };
}

export interface ActorBox { id: string; file: string; left: number; top: number; right: number; bottom: number; texels: number }

export interface ActorsView {
  extent: GroupExtent;
  // surfacePoint : point du relief peint sous les pieds (colonne et ligne de la peinture)
  layout(framing: Framing, surfacePoint: (place: ImagePoint) => Vector3): void;
  rescale(): void; // après un déplacement de la caméra
  update(t: number, moving: boolean): void;
  focusRange(): { min: number; max: number } | null; // bande de l'écran occupée, de 0 (bas) à 1 (haut)
  boxes(deviceWidth: number, deviceHeight: number): ActorBox[];
}

const SHADOW_ORDER = 50; // au-dessus du décor peint, sans test de profondeur : le relief la couperait
// Taille des ombres à l'écran, validée dans le labo
const SHADOW_BOOST = 1.2;
const HALO_OPACITY = 0.35;

export async function buildActors(
  defs: ActorDef[], parent: Group, spriteParent: Group, camera: PerspectiveCamera, bin: ResourceBin,
): Promise<ActorsView> {
  const pixel = CONFIG.scene.spritePixel;
  const pitch = CONFIG.scene.camera.pitch;
  const softShadow = bin.add(radialTexture(64, 1.4));
  const contactShadow = bin.add(radialTexture(64, 0.8));
  const haloMask = bin.add(radialTexture(64, 2.2));
  const images = await Promise.all(defs.map((def) => loadImage(def.src)));
  let cameraDistance = 1;

  const views = defs.map((def, index) => {
    const image = images[index];
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height + 1; // rangée vide en haut : la place de la respiration
    context2d(canvas).drawImage(image, 0, 1);

    const breath = { value: 0 };
    const material = bin.add(new MeshBasicMaterial({ map: bin.add(pixelTexture(canvas)), alphaTest: 0.5, fog: false }));
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uBreath = breath;
      shader.uniforms.uCut = { value: def.breath.cut };
      shader.uniforms.uTexel = { value: 1 / canvas.height };
      shader.fragmentShader = "uniform float uBreath;\nuniform float uCut;\nuniform float uTexel;\n" + shader.fragmentShader.replace(
        "#include <map_fragment>",
        `vec2 breathUv = vMapUv;
        if ( breathUv.y > uCut ) breathUv.y -= uBreath * uTexel;
        diffuseColor *= texture2D( map, breathUv );`,
      );
    };
    material.customProgramCacheKey = () => "game-sprite-breath";

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

    const frame = new Group();
    frame.rotation.x = -pitch;
    root.add(frame);
    let haloMaterial: MeshBasicMaterial | null = null;
    if (def.halo) {
      haloMaterial = bin.add(new MeshBasicMaterial({
        color: def.halo.color, alphaMap: haloMask, transparent: true, opacity: HALO_OPACITY,
        blending: AdditiveBlending, depthWrite: false, depthTest: false, fog: false,
      }));
      const halo = new Mesh(bin.add(new PlaneGeometry(def.halo.size, def.halo.size)), haloMaterial);
      halo.position.set((def.halo.at[0] - 0.5) * width, def.halo.at[1] * height, -0.06);
      halo.renderOrder = SHADOW_ORDER;
      frame.add(halo);
    }
    parent.add(root);
    return { def, root, frame, sprite, blob, contact, breath, haloMaterial, width, height };
  });

  const rescale = () => {
    for (const view of views) {
      const scale = depthOf(camera, view.sprite.position) / cameraDistance;
      view.sprite.scale.setScalar(scale);
      view.frame.scale.setScalar(scale);
      const shadow = scale * SHADOW_BOOST;
      view.blob.scale.set(view.width * 0.75 * shadow, Math.min(0.9, view.width * 0.4) * shadow, 1);
      view.contact.scale.set(view.width * 0.42 * shadow, Math.min(0.35, view.width * 0.16) * shadow, 1);
    }
  };

  const point = new Vector3();
  return {
    extent: defs.map((def, index) => ({ col: def.place.col, spriteWidth: images[index].width })),
    // Les pieds sont sur le relief : le sprite suit le sol peint quand la caméra bouge, au lieu d'y glisser
    layout(framing, surfacePoint) {
      cameraDistance = framing.cameraDistance;
      for (const view of views) {
        const feet = surfacePoint(view.def.place);
        view.root.position.copy(feet);
        view.sprite.position.copy(feet);
      }
      rescale();
    },
    rescale,
    update(t, moving) {
      views.forEach((view, i) => {
        const { period, phase } = view.def.breath;
        view.breath.value = moving && Math.sin((t / period + phase) * Math.PI * 2) > 0.15 ? 1 : 0;
        if (view.haloMaterial) view.haloMaterial.opacity = HALO_OPACITY * (1 + 0.12 * Math.sin(t * 1.3 + i * 1.7));
      });
    },
    focusRange() {
      if (views.length === 0) return null;
      let min = Infinity;
      let max = -Infinity;
      for (const view of views) {
        for (const y of [0, view.height * view.sprite.scale.y]) {
          point.set(view.root.position.x, view.root.position.y + y, view.root.position.z).project(camera);
          min = Math.min(min, (point.y + 1) / 2);
          max = Math.max(max, (point.y + 1) / 2);
        }
      }
      return { min, max };
    },
    boxes(deviceWidth, deviceHeight) {
      const corner = new Vector3();
      return views.map((view) => {
        view.sprite.updateMatrixWorld();
        const toScreen = (x: number, y: number) => {
          corner.set(x, y, 0).applyMatrix4(view.sprite.matrixWorld).project(camera);
          return [((corner.x + 1) / 2) * deviceWidth, ((1 - corner.y) / 2) * deviceHeight];
        };
        const [left, top] = toScreen(-view.width / 2, view.height);
        const [right, bottom] = toScreen(view.width / 2, 0);
        return { id: view.def.id, file: view.def.src, left, top, right, bottom, texels: Math.round(view.width / pixel) };
      });
    },
  };
}
