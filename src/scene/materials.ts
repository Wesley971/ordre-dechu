// materials.ts - Ressources de la scène : chargement, textures calculées et matériaux animés (MAE-28)
//
// Tous les matériaux de la scène sont « sans éclairage » (MeshBasicMaterial) : la lumière de la nuit, la lune
// et les ombres sont déjà peintes dans l'image, et les couleurs de palette des sprites doivent rester exactes.
// La scène n'a donc aucune lumière Three.js, ni ombre calculée : ce serait du calcul sans effet à l'écran.

import {
  AdditiveBlending, CanvasTexture, MeshBasicMaterial, NearestFilter, SRGBColorSpace, TextureLoader, type Texture,
} from "three";

// Ce que la mémoire graphique garde tant qu'on ne le libère pas (géométries, matériaux, textures).
// Une fois fermée, tout ce qu'on y ajoute est libéré aussitôt : un chargement qui se termine après
// un changement de décor ne laisse donc rien derrière lui.
export class ResourceBin {
  private items: { dispose(): void }[] = [];
  private closed = false;

  add<T extends { dispose(): void }>(item: T): T {
    if (this.closed) item.dispose();
    else this.items.push(item);
    return item;
  }

  disposeAll() {
    this.closed = true;
    for (const item of this.items) item.dispose();
    this.items = [];
  }
}

// Hasard reproductible : les lucioles sont aux mêmes places à chaque chargement
export function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bruit fractal qui se répète sans couture : valeurs de 0 à 1
export function tileableNoise(size: number, cells: number, octaves: number, seed: number): Float32Array {
  const random = seededRandom(seed);
  const out = new Float32Array(size * size);
  let amplitude = 1;
  let total = 0;
  for (let octave = 0; octave < octaves; octave++) {
    const count = Math.max(1, Math.round(cells << octave));
    const grid = Array.from({ length: count * count }, () => random());
    const at = (x: number, y: number) => grid[((y + count) % count) * count + ((x + count) % count)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const gridX = (x / size) * count;
        const gridY = (y / size) * count;
        const x0 = Math.floor(gridX);
        const y0 = Math.floor(gridY);
        const sx = (gridX - x0) ** 2 * (3 - 2 * (gridX - x0));
        const sy = (gridY - y0) ** 2 * (3 - 2 * (gridY - y0));
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
        out[y * size + x] += (top + (bottom - top) * sy) * amplitude;
      }
    }
    total += amplitude;
    amplitude *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

export function context2d(canvas: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", options);
  if (!context) throw new Error("Scène peinte : canvas 2D indisponible");
  return context;
}

// Texture calculée dans un canvas. srgb : false pour une donnée (masque, bruit), pas une couleur
export function computedTexture(size: number, draw: (image: ImageData) => void, srgb = true): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = context2d(canvas);
  const image = context.createImageData(size, size);
  draw(image);
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  if (srgb) texture.colorSpace = SRGBColorSpace;
  return texture;
}

// Disque flou, lu comme masque d'opacité
export function radialTexture(size: number, falloff: number): CanvasTexture {
  return computedTexture(size, (image) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const distance = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
        const alpha = Math.round(Math.max(0, 1 - distance) ** falloff * 255);
        image.data.set([alpha, alpha, alpha, 255], (y * size + x) * 4);
      }
    }
  }, false);
}

// Pixel art : filtrage au plus proche et sans mipmaps, pour qu'aucun pixel ne se mélange à ses voisins
export function pixelTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Scène peinte : image introuvable : ${url}`));
    image.src = url;
  });
}

export async function loadPainting(url: string, bin: ResourceBin): Promise<Texture> {
  // En cas d'échec, Three.js rejette un simple événement : on le remplace par un message qui nomme le fichier
  const texture = bin.add(await new TextureLoader().loadAsync(url).catch(() => {
    throw new Error(`Scène peinte : image introuvable : ${url}`);
  }));
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8; // le sol est vu en biais : sans cela, il s'empâte au loin
  return texture;
}

// Lecture de la carte de profondeur (0 = proche, 1 = loin), une fois pour toutes au chargement
export async function loadDepthMap(url: string) {
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = context2d(canvas, { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, image.width, image.height);
  return (u: number, v: number) => {
    const x = Math.min(width - 1, Math.max(0, Math.round(u * (width - 1))));
    const y = Math.min(height - 1, Math.max(0, Math.round((1 - v) * (height - 1))));
    return data[(y * width + x) * 4] / 255;
  };
}

// Feuillage peint qui se balance : les UV ondulent horizontalement, davantage vers le haut du plan (`rise`)
export function swayingMaterial(map: Texture, time: { value: number }, amplitude: number, rise: [number, number]): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ map, transparent: true, depthWrite: false });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.fragmentShader = "uniform float uTime;\n" + shader.fragmentShader.replace(
      "#include <map_fragment>",
      `vec2 swayUv = vMapUv;
      float swayWeight = smoothstep( ${rise[0].toFixed(3)}, ${rise[1].toFixed(3)}, vMapUv.y );
      swayUv.x += ( sin( uTime * 1.1 + vMapUv.y * 9.0 + vMapUv.x * 7.0 ) + 0.5 * sin( uTime * 1.9 + vMapUv.x * 23.0 ) ) * ${amplitude.toFixed(5)} * swayWeight;
      diffuseColor *= texture2D( map, swayUv );`,
    );
  };
  material.customProgramCacheKey = () => `sway-${amplitude}-${rise.join("-")}`;
  return material;
}

// Lueurs peintes (fleurs, étincelles) : ajoutées en lumière, chacune palpite à son rythme
export function glintMaterial(map: Texture, time: { value: number }): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ map, transparent: true, blending: AdditiveBlending, depthWrite: false, depthTest: false, fog: false });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.fragmentShader = "uniform float uTime;\n" + shader.fragmentShader.replace(
      "#include <map_fragment>",
      `vec4 glowTexel = texture2D( map, vMapUv );
      vec2 cell = floor( vMapUv * vec2( 180.0, 270.0 ) );
      float h = fract( sin( dot( cell, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
      float twinkle = 0.5 + 0.5 * sin( uTime * ( 1.2 + h * 2.2 ) + h * 6.2831 );
      diffuseColor = vec4( glowTexel.rgb * ( 0.35 + 1.1 * twinkle * twinkle ), glowTexel.a );`,
    );
  };
  material.customProgramCacheKey = () => "painted-glow";
  return material;
}
