// relief.ts - La peinture montée en relief, ses côtés et le fondu des bords (MAE-28)

import {
  Color, Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping, ShaderMaterial,
  type Group, type Material, type PerspectiveCamera, type Texture,
} from "three";
import { CONFIG } from "../config.ts";
import type { Decor } from "../data/decors.ts";
import { pointAtDepth, type Framing } from "./framing.ts";
import {
  computedTexture, glintMaterial, loadDepthMap, loadPainting, swayingMaterial, tileableNoise, type ResourceBin,
} from "./materials.ts";

// Un sommet tous les 10 pixels environ de l'image, assez fin pour suivre la carte de profondeur
const RELIEF_SEGMENTS = { x: 258, y: 77 };
// Ordre de dessin : relief, côtés, lueurs, brume (2), rayons (3), lucioles (4), fondu, feuillages, ombres (50)
const ORDER = { relief: -20, sideFar: -16, sideGlints: -14, sideNear: -12, glints: -10, edgeFade: 25, foreground: 30, edgeFadeFitted: 35, corners: 40 };
// Part de la peinture qui se fond dans la brume en haut et en bas, quand elle ne remplit pas la hauteur.
// Assez pour qu'aucun bord ne se voie, assez peu pour garder la lune (voile léger sur son haut) et les pieds nets.
const FITTED_FADE = { top: 0.09, bottom: 0.1 };

export interface ReliefView {
  layout(framing: Framing, canvasSize: { width: number; height: number }): void;
  // Bord de la peinture à l'écran (en coordonnées -1 à 1), pour alléger la brume au-delà
  edge(): number;
}

function fullPlane(material: Material, order: number, parent: Group) {
  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  mesh.renderOrder = order;
  mesh.frustumCulled = false; // placé en coordonnées d'écran ou déformé : sa boîte englobante ne dit rien
  parent.add(mesh);
  return mesh;
}

// Fondu vers l'ombre et la brume, en plein écran.
// - Sur les côtés : seulement au-delà de la peinture, comme dans le labo.
// - En haut et en bas, quand la peinture ne remplit pas la hauteur : opaque dès le bord de l'image, pour que
//   rien d'autre ne se voie, avec une brume qui bouge lentement et s'éteint vers l'ombre au bord de l'écran.
function edgeFadeMaterial(decor: Decor, noise: Texture, time: { value: number }) {
  const { edgeShadow, edgeMist } = decor.atmosphere.colors;
  return new ShaderMaterial({
    uniforms: {
      uEdge: { value: 0.5 },
      uShadow: { value: new Color(edgeShadow) },
      uMist: { value: new Color(edgeMist) },
      uFitted: { value: 0 },
      uTop: { value: 1 },
      uTopInner: { value: 1 },
      uBottom: { value: -1 },
      uBottomInner: { value: -1 },
      uAspect: { value: 1 },
      uNoise: { value: noise },
      uTime: time,
    },
    vertexShader: "varying vec2 vNdc; void main() { vNdc = position.xy * 2.0; gl_Position = vec4( position.xy * 2.0, 0.0, 1.0 ); }",
    fragmentShader: /* glsl */ `
      uniform float uEdge; uniform vec3 uShadow; uniform vec3 uMist; uniform float uFitted; uniform float uTop;
      uniform float uTopInner; uniform float uBottom; uniform float uBottomInner; uniform float uAspect;
      uniform sampler2D uNoise; uniform float uTime; varying vec2 vNdc;
      void main() {
        float x = abs( vNdc.x );
        float start = uEdge + 0.55 * ( 1.0 - uEdge );
        float side = smoothstep( start, 1.0, x ) * step( uEdge, x );
        float sideMist = exp( -pow( ( vNdc.y + 0.15 ) * 1.6, 2.0 ) );
        vec3 sideColor = mix( uShadow, uMist, 0.55 * sideMist );

        float above = clamp( ( vNdc.y - uTopInner ) / ( uTop - uTopInner ), 0.0, 1.0 );
        float below = clamp( ( uBottomInner - vNdc.y ) / ( uBottomInner - uBottom ), 0.0, 1.0 );
        float band = uFitted * smoothstep( 0.0, 1.0, max( above, below ) );
        float away = max( vNdc.y - uTop, uBottom - vNdc.y ); // distance au bord de l'image, hors de l'image
        vec2 noiseUv = vec2( vNdc.x * uAspect, vNdc.y ) * 0.45;
        float noise = texture2D( uNoise, noiseUv + vec2( uTime * 0.006, uTime * 0.002 ) ).r
                    * texture2D( uNoise, noiseUv * 1.7 - vec2( uTime * 0.004, 0.0 ) ).r;
        vec3 bandColor = mix( uShadow, uMist, clamp( 1.1 * noise + 0.08, 0.0, 1.0 ) * exp( -max( away, 0.0 ) * 3.0 ) );

        gl_FragColor = vec4( mix( sideColor, bandColor, band ), max( 0.92 * side, band ) );
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

export async function buildRelief(
  decor: Decor, parent: Group, camera: PerspectiveCamera, bin: ResourceBin, time: { value: number },
): Promise<ReliefView> {
  const { image, relief, sides } = decor;
  const texture = (url: string) => loadPainting(url, bin);
  const [wide, sampleDepth, foreground, glints, sideTextures, cornerTextures] = await Promise.all([
    texture(image.wide),
    loadDepthMap(image.depthMap),
    image.foreground ? texture(image.foreground.file) : null,
    image.glints ? texture(image.glints) : null,
    sides ? Promise.all([sides.far, sides.glints, sides.near].flatMap((s) => [texture(s.left), texture(s.right)])) : null,
    sides?.corners ? Promise.all([texture(sides.corners.left.file), texture(sides.corners.right.file)]) : null,
  ]);

  // Le relief : un maillage dont chaque sommet est posé sur le rayon de la caméra au repos qui passe par son
  // pixel, à la profondeur donnée par la carte. Vu de la caméra au repos, on retrouve la peinture exacte ;
  // le volume n'apparaît que si la caméra se déplace. Pas d'éclairage ni de vraie 3D (MAE-1).
  const geometry = bin.add(new PlaneGeometry(1, 1, RELIEF_SEGMENTS.x, RELIEF_SEGMENTS.y));
  const addOnRelief = (material: Material, order: number) => {
    const mesh = new Mesh(geometry, bin.add(material));
    mesh.renderOrder = order;
    mesh.frustumCulled = false;
    parent.add(mesh);
  };
  addOnRelief(new MeshBasicMaterial({ map: wide }), ORDER.relief);
  // Feuillages et lueurs sont posés sur les mêmes sommets : ils ne se décollent pas de l'image
  if (glints) addOnRelief(glintMaterial(glints, time), ORDER.glints);
  if (foreground && image.foreground) {
    addOnRelief(swayingMaterial(foreground, time, image.foreground.amplitude, image.foreground.rise), ORDER.foreground);
  }

  const noiseData = tileableNoise(256, 3, 4, 31);
  const noise = bin.add(computedTexture(256, (data) => {
    for (let i = 0; i < noiseData.length; i++) {
      const value = Math.round(noiseData[i] * 255);
      data.data.set([value, value, value, 255], i * 4);
    }
  }, false));
  noise.wrapS = noise.wrapT = RepeatWrapping;
  const fade = bin.add(edgeFadeMaterial(decor, noise, time));
  const fadePlane = fullPlane(fade, ORDER.edgeFade, parent);
  bin.add(fadePlane.geometry);

  // Forêt des côtés : plans plats à différentes profondeurs, opaques au centre, fondus vers l'extérieur
  const sidePlanes: { mesh: Mesh; left: number; right: number; depth: number }[] = [];
  if (sides && sideTextures) {
    const plain = (map: Texture) => bin.add(new MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
    const [farLeft, farRight, glintsLeft, glintsRight, nearLeft, nearRight] = sideTextures;
    const add = (material: Material, order: number, isLeft: boolean, depth: number) => {
      const mesh = fullPlane(material, order, parent);
      bin.add(mesh.geometry);
      sidePlanes.push({ mesh, left: isLeft ? -sides.width : image.width, right: isLeft ? 0 : image.width + sides.width, depth });
    };
    add(plain(farLeft), ORDER.sideFar, true, sides.far.depth);
    add(plain(farRight), ORDER.sideFar, false, sides.far.depth);
    add(bin.add(glintMaterial(glintsLeft, time)), ORDER.sideGlints, true, sides.glints.depth);
    add(bin.add(glintMaterial(glintsRight, time)), ORDER.sideGlints, false, sides.glints.depth);
    add(plain(nearLeft), ORDER.sideNear, true, sides.near.depth);
    add(plain(nearRight), ORDER.sideNear, false, sides.near.depth);
  }

  // Fougères sombres des coins de l'écran
  const corners: { mesh: Mesh; width: number; height: number; isLeft: boolean }[] = [];
  if (sides?.corners && cornerTextures) {
    const { left, right, amplitude, rise } = sides.corners;
    [{ map: cornerTextures[0], size: left, isLeft: true }, { map: cornerTextures[1], size: right, isLeft: false }].forEach(({ map, size, isLeft }) => {
      const material = bin.add(swayingMaterial(map, time, amplitude, rise));
      material.fog = false;
      const mesh = fullPlane(material, ORDER.corners, parent);
      bin.add(mesh.geometry);
      corners.push({ mesh, width: size.width, height: size.height, isLeft });
    });
  }

  const pitch = CONFIG.scene.camera.pitch;
  // Plan face à la caméra, qui couvre exactement ce rectangle de l'écran à cette profondeur
  const placeOnScreen = (mesh: Mesh, left: number, right: number, top: number, bottom: number, depth: number) => {
    const topLeft = pointAtDepth(camera, left, top, depth);
    mesh.scale.set(
      topLeft.distanceTo(pointAtDepth(camera, right, top, depth)),
      topLeft.distanceTo(pointAtDepth(camera, left, bottom, depth)),
      1,
    );
    mesh.position.copy(pointAtDepth(camera, (left + right) / 2, (top + bottom) / 2, depth));
    mesh.rotation.set(-pitch, 0, 0);
  };

  let edge = 0.5;

  return {
    edge: () => edge,
    // Toujours appelé avec la caméra au repos : c'est depuis elle que la peinture est projetée
    layout(framing, canvasSize) {
      const position = geometry.getAttribute("position");
      const uv = geometry.getAttribute("uv");
      for (let i = 0; i < position.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        const depth = relief.near + relief.span * sampleDepth(u, v) ** relief.power;
        const point = pointAtDepth(
          camera, framing.colToNdc(-image.extend + u * (image.width + 2 * image.extend)), framing.rowToNdc((1 - v) * image.height), depth,
        );
        position.setXYZ(i, point.x, point.y, point.z);
      }
      position.needsUpdate = true;
      geometry.computeBoundingSphere();

      if (sides) {
        for (const plane of sidePlanes) {
          placeOnScreen(
            plane.mesh, framing.colToNdc(plane.left), framing.colToNdc(plane.right),
            framing.rowToNdc(sides.top), framing.rowToNdc(sides.bottom), plane.depth,
          );
        }
      }

      edge = Math.min(Math.abs(framing.colToNdc(0)), Math.abs(framing.colToNdc(image.width)));
      const top = framing.rowToNdc(0);
      const bottom = framing.rowToNdc(image.height);
      const uniforms = fade.uniforms;
      uniforms.uEdge.value = edge;
      uniforms.uFitted.value = framing.fitted ? 1 : 0;
      uniforms.uTop.value = top;
      uniforms.uTopInner.value = top - (top - bottom) * FITTED_FADE.top;
      uniforms.uBottom.value = bottom;
      uniforms.uBottomInner.value = bottom + (top - bottom) * FITTED_FADE.bottom;
      uniforms.uAspect.value = canvasSize.width / canvasSize.height;
      // Peinture rétrécie : le fondu passe devant les feuillages peints, sinon ils s'arrêteraient net au bas de l'image
      fadePlane.renderOrder = framing.fitted ? ORDER.edgeFadeFitted : ORDER.edgeFade;

      // Fougères des coins : à l'étroit, elles flotteraient dans la brume sous la peinture
      for (const corner of corners) {
        corner.mesh.visible = !framing.fitted;
        if (framing.fitted) continue;
        let heightPx = 0.3 * canvasSize.height;
        let widthPx = (heightPx * corner.width) / corner.height;
        if (widthPx > 0.13 * canvasSize.width) {
          widthPx = 0.13 * canvasSize.width;
          heightPx = (widthPx * corner.height) / corner.width;
        }
        const out = 0.02; // déborde légèrement de l'écran : aucun bord visible
        const inner = -1 + (2 * widthPx) / canvasSize.width;
        const [left, right] = corner.isLeft ? [-1 - out, inner] : [-inner, 1 + out];
        placeOnScreen(corner.mesh, left, right, -1 + (2 * heightPx) / canvasSize.height, -1 - out, sides?.corners?.depth ?? 7);
      }
    },
  };
}
