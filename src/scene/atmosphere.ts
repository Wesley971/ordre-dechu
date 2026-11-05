// atmosphere.ts - Brume, rayons de lune et lucioles (MAE-28). Quantités et couleurs : décor de chaque lieu

import {
  AdditiveBlending, Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping, Vector2, Vector3,
  type Group, type PerspectiveCamera, type Texture,
} from "three";
import { CONFIG } from "../config.ts";
import type { Decor } from "../data/decors.ts";
import { depthOf, type Framing } from "./framing.ts";
import {
  computedTexture, context2d, pixelTexture, radialTexture, seededRandom, tileableNoise, type ResourceBin,
} from "./materials.ts";

const ORDER = { mist: 2, shafts: 3, fireflies: 4 };
// as const, ici et pour SHAFTS : tableaux à longueur fixe, chaque case est lue par sa position
const MIST_LAYERS = [
  { size: [70, 34], position: [0, 0.12, -6], opacity: 0.32, repeat: [3, 1.5], speed: [0.006, 0.002], seed: 21 },
  { size: [70, 34], position: [0, 0.3, -7], opacity: 0.22, repeat: [2.2, 1.1], speed: [-0.004, 0.0015], seed: 22 },
] as const;
const SHAFTS = [[-2.5, -2.5, 2.4, 0.38], [0.8, -3.5, 1.6, 0.34], [3.2, -1.5, 1.1, 0.4]] as const;
const SHAFT_RECEDE = 2.5;
// Clairière du combat : la plupart des lucioles restent autour, pour ne pas gêner la lecture des personnages
const CLEARING = { x: 0.3, z: 0.5, rx: 6.8, rz: 3.7, margin: -2.5 };

export interface AtmosphereView {
  layout(framing: Framing, imageEdge: number, drawingBuffer: Vector2): void;
  update(t: number): void;
}

export function buildAtmosphere(decor: Decor, parent: Group, camera: PerspectiveCamera, bin: ResourceBin): AtmosphereView {
  const { atmosphere } = decor;
  const { colors } = atmosphere;
  const uniformEdge = { value: 0.5 };
  const uniformResolution = { value: new Vector2(1, 1) };
  let cameraDistance = 1;

  // ─── Brume ───
  // Nappes posées au sol, dessinées par-dessus le relief sans test de profondeur : elles le traverseraient.
  // Elles s'allègent vers les côtés pour ne pas noyer la forêt, en commençant bien avant le bord de l'image :
  // commencée au bord, la transition dessinait une lisière verticale de brume sur les troncs sombres.
  const edgeMask = bin.add(computedTexture(128, (image) => {
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const alpha = Math.round(Math.min(1, Math.min(x, 127 - x) / 40) * Math.min(1, Math.min(y, 127 - y) / 40) * 255);
        image.data.set([alpha, alpha, alpha, 255], (y * 128 + x) * 4);
      }
    }
  }, false));
  const mistLayers: { texture: Texture; speed: Vector2 }[] = [];
  for (const layer of MIST_LAYERS) {
    const noise = tileableNoise(256, 3, 5, layer.seed);
    const texture = bin.add(computedTexture(256, (image) => {
      for (let i = 0; i < 256 * 256; i++) {
        image.data.set([255, 255, 255, Math.round(Math.max(0, (noise[i] - 0.32) / 0.68) ** 1.6 * 255)], i * 4);
      }
    }, false));
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(layer.repeat[0], layer.repeat[1]);
    const material = bin.add(new MeshBasicMaterial({
      color: colors.mist, map: texture, alphaMap: edgeMask, transparent: true,
      opacity: layer.opacity * atmosphere.mist, depthWrite: false, depthTest: false,
    }));
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uImageEdge = uniformEdge;
      shader.uniforms.uResolution = uniformResolution;
      shader.fragmentShader = "uniform float uImageEdge;\nuniform vec2 uResolution;\n" + shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `float sideX = abs( gl_FragCoord.x / uResolution.x * 2.0 - 1.0 );
        diffuseColor.a *= 1.0 - 0.75 * smoothstep( uImageEdge - 0.35, uImageEdge + 0.12, sideX );
        #include <opaque_fragment>`,
      );
    };
    material.customProgramCacheKey = () => "mist-sides";
    const plane = new Mesh(bin.add(new PlaneGeometry(layer.size[0], layer.size[1])), material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(layer.position[0], layer.position[1], layer.position[2]);
    plane.renderOrder = ORDER.mist;
    parent.add(plane);
    mistLayers.push({ texture, speed: new Vector2(layer.speed[0], layer.speed[1]) });
  }

  // ─── Rayons de lune ───
  const shaftMask = bin.add(computedTexture(64, (image) => {
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const alpha = Math.round(Math.sin((x / 63) * Math.PI) ** 2 * Math.sin((y / 63) * Math.PI) * 255);
        image.data.set([alpha, alpha, alpha, 255], (y * 64 + x) * 4);
      }
    }
  }, false));
  const shaftMeshes: Mesh[] = [];
  const shafts = SHAFTS.map(([x, z, width, tilt]) => {
    const material = bin.add(new MeshBasicMaterial({
      color: colors.moonlight, alphaMap: shaftMask, transparent: true, opacity: atmosphere.shafts.opacity,
      blending: AdditiveBlending, depthWrite: false, depthTest: false, fog: false,
    }));
    const shaft = new Mesh(bin.add(new PlaneGeometry(width, 18)), material);
    shaft.position.set(x, 8, z);
    shaft.rotation.z = -tilt;
    shaft.renderOrder = ORDER.shafts;
    parent.add(shaft);
    shaftMeshes.push(shaft);
    return material;
  });

  // ─── Lucioles : le Souffle rendu visible ───
  // Un point net de 4 × 4 pixels de sprite et un halo doux, qui dérivent lentement et palpitent
  const coreCanvas = document.createElement("canvas");
  coreCanvas.width = coreCanvas.height = 4;
  const core2d = context2d(coreCanvas);
  core2d.fillStyle = "#e8fbff";
  core2d.fillRect(1, 1, 2, 2);
  core2d.fillStyle = colors.firefly;
  core2d.fillRect(0, 1, 1, 2);
  core2d.fillRect(3, 1, 1, 2);
  core2d.fillRect(1, 0, 2, 1);
  core2d.fillRect(1, 3, 2, 1);
  const coreMaterial = bin.add(new MeshBasicMaterial({
    map: bin.add(pixelTexture(coreCanvas)), transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false,
  }));
  const glowMask = bin.add(radialTexture(64, 2));
  const coreGeometry = bin.add(new PlaneGeometry(4 * CONFIG.scene.spritePixel, 4 * CONFIG.scene.spritePixel));
  const glowGeometry = bin.add(new PlaneGeometry(0.42, 0.42));
  const pitch = CONFIG.scene.camera.pitch;
  const random = seededRandom(1103);
  const range = (min: number, max: number) => min + random() * (max - min);
  const inClearing = (x: number, z: number) =>
    Math.hypot((x - CLEARING.x) / (CLEARING.rx + CLEARING.margin), (z - CLEARING.z) / (CLEARING.rz + CLEARING.margin)) < 1;
  const fireflies = Array.from({ length: atmosphere.fireflies }, () => {
    let x = 0;
    let z = 0;
    do {
      x = range(-14, 14);
      z = range(-9, 5);
    } while (inClearing(x, z));
    const base = new Vector3(x, range(0.3, 2.6), z);
    const glowMaterial = bin.add(new MeshBasicMaterial({
      color: colors.firefly, alphaMap: glowMask, transparent: true, opacity: 0.32,
      blending: AdditiveBlending, depthWrite: false, fog: false,
    }));
    const core = new Mesh(coreGeometry, coreMaterial);
    const glow = new Mesh(glowGeometry, glowMaterial);
    core.rotation.x = glow.rotation.x = -pitch;
    core.renderOrder = glow.renderOrder = ORDER.fireflies;
    parent.add(core, glow);
    return { core, glow, glowMaterial, base, phase: range(0, Math.PI * 2), speed: range(0.15, 0.35) };
  });

  return {
    layout(framing, imageEdge, drawingBuffer) {
      cameraDistance = framing.cameraDistance;
      uniformEdge.value = imageEdge;
      uniformResolution.value.copy(drawingBuffer);
      // Rayons reculés vers la forêt peinte et agrandis d'autant : même image au repos, sans glisser sur la lune
      // quand la caméra bouge. Toujours avec la caméra au repos, comme le relief.
      shaftMeshes.forEach((shaft, i) => {
        const [x, z] = SHAFTS[i];
        shaft.position.set(x, 8, z).sub(camera.position).multiplyScalar(SHAFT_RECEDE).add(camera.position);
        shaft.scale.setScalar(SHAFT_RECEDE);
      });
    },
    update(t) {
      for (const layer of mistLayers) layer.texture.offset.set(layer.speed.x * t, layer.speed.y * t);
      shafts.forEach((material, i) => {
        material.opacity = atmosphere.shafts.opacity + atmosphere.shafts.breath * Math.sin(t * 0.25 + i * 2.1);
      });
      for (const firefly of fireflies) {
        const { core, glow, glowMaterial, base, phase, speed } = firefly;
        core.position.set(
          base.x + Math.sin(t * speed + phase) * 0.6,
          base.y + Math.sin(t * speed * 1.7 + phase * 2) * 0.25,
          base.z + Math.cos(t * speed * 0.8 + phase) * 0.4,
        );
        glow.position.copy(core.position);
        // Taille d'un pixel de sprite à l'écran, quelle que soit la profondeur
        core.scale.setScalar(depthOf(camera, core.position) / cameraDistance);
        const pulse = 0.55 + 0.45 * Math.sin(t * 1.9 + phase * 3) ** 2;
        glowMaterial.opacity = 0.32 * pulse;
        core.visible = pulse > 0.35;
      }
    },
  };
}
