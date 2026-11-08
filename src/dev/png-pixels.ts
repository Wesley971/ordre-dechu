// png-pixels.ts - Lit les pixels d'un PNG sous Node, sans DOM ni dépendance, pour les tests des animations (MAE-30)
//
// Seule la forme des sprites du jeu est prise en charge : RGBA 8 bits, sans entrelacement. Autre chose lève une
// erreur, plutôt qu'une image fausse. Le PNG arrive en data URL (import Vite « ?inline »).

import type { PixelImage } from "../ui/sprite-frames.ts";

function bytesOf(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function inflate(data: Uint8Array<ArrayBuffer>) {
  // Le flux d'un PNG est au format zlib : « deflate » pour DecompressionStream
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export async function decodePng(dataUrl: string): Promise<PixelImage> {
  const bytes = bytesOf(dataUrl);
  const view = new DataView(bytes.buffer);
  let offset = 8; // signature
  let width = 0, height = 0;
  const chunks: Uint8Array[] = [];
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      const [depth, color, , , interlace] = body.subarray(8, 13);
      if (depth !== 8 || color !== 6 || interlace !== 0) throw new Error("PNG non pris en charge : RGBA 8 bits sans entrelacement seulement");
    } else if (type === "IDAT") {
      chunks.push(body);
    }
    offset += 12 + length;
  }
  const compressed = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  chunks.reduce((at, chunk) => { compressed.set(chunk, at); return at + chunk.length; }, 0);
  const raw = await inflate(compressed);
  const stride = width * 4;
  const data = new Uint8ClampedArray(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const value = raw[y * (stride + 1) + 1 + i];
      const left = i >= 4 ? data[y * stride + i - 4] : 0;
      const up = y > 0 ? data[(y - 1) * stride + i] : 0;
      const upLeft = y > 0 && i >= 4 ? data[(y - 1) * stride + i - 4] : 0;
      const predicted = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      if (predicted === undefined) throw new Error(`PNG : filtre inconnu ${filter}`);
      data[y * stride + i] = (value + predicted) & 0xff;
    }
  }
  return { width, height, data };
}
