// fx-layer.ts - La couche des effets du combat (effets spéciaux, MAE-95 ; effets des capacités, MAE-31) : un canvas posé sur la scène, en pixels de sprite
//
// Chaque scène a sa couche, posée sur l'élément qui couvre ses combattants (DOM : #battle-scene ; scène peinte :
// #actor-layer). Le canvas compte un pixel par pixel de sprite, et s'affiche agrandi de la taille d'un pixel de sprite
// de la scène (un nombre entier de pixels réels), sans lissage (image-rendering: pixelated, style.css). Sa grille est
// calée sur celle du sprite d'où part l'effet : chaque pixel d'effet tombe pile sur un pixel de ce sprite.
// Les effets (battle-fx.ts) y sont dessinés sur la grille commune de douze images par seconde (sprite-motion.ts), par
// leur propre boucle : ils ne lisent pas l'horloge du combat et n'attendent rien. Sans effet en cours, le canvas est
// retiré de la page et la boucle s'arrête.

import type { FxBox, FxPlan } from "./battle-fx.ts";
import { frameAt, startFrame } from "./sprite-motion.ts";

export interface FxLayer {
  // Prépare un effet : sans effet en cours, la grille de la couche se cale sur `grid` (le sprite d'où part l'effet),
  // dont le coin tombe sur un pixel de la couche. Rend la mesure des éléments de la page, en pixels de la couche
  // (bords arrondis vers l'extérieur)
  measure(grid: Element): (element: Element) => FxBox;
  // Lance un effet, juste après measure(), au même instant : il se place dans la géométrie qu'elle a fixée.
  // seed : une graine propre à ce lancement (jamais Math.random, battle-fx.ts). name : le nom de l'effet, écrit sur
  // le canvas tant qu'il joue (data-fx, les noms des effets en cours) : les contrôles en navigateur et le bot du labo
  // le lisent, le jeu ne s'en sert pas
  play(make: (seed: number) => FxPlan, name: string): void;
  dispose(): void; // arrête les effets et retire le canvas
}

interface Rect { left: number; top: number; width: number; height: number }

// Place et taille du canvas, en pixels CSS par rapport à l'hôte, et en pixels de sprite pour son contenu
export interface LayerGeometry {
  origin: { left: number; top: number }; // coin du canvas, en pixels CSS de l'écran
  offset: { left: number; top: number }; // le même coin, par rapport à l'hôte (style left, top)
  columns: number; rows: number;         // taille du canvas, en pixels de sprite
  px: number;                            // taille d'un pixel de sprite, en pixels CSS
}

// Sans DOM, testé (src/dev/battle-fx.test.ts). Le coin du canvas est sur un pixel réel, à un nombre entier de pixels de
// sprite du coin de `grid` (lui-même sur un pixel réel), et au plus un pixel de sprite au-dessus et à gauche de l'hôte :
// le canvas couvre tout l'hôte, et le dépasse de moins d'un pixel de sprite (coupé par #battle-scene en DOM ; dans la
// scène peinte, #actor-layer couvre l'écran, et ce qui dépasse sort de l'écran). px : arrondi à un nombre entier de pixels réels (au moins un).
export function layerGeometry(host: Rect, grid: { left: number; top: number }, ratio: number, pixelSize: number): LayerGeometry {
  const real = Math.max(1, Math.round((pixelSize || 1) * ratio)); // pixels réels par pixel de sprite
  const px = real / ratio;
  const snap = (value: number) => Math.round(value * ratio) / ratio;
  // Coin de la grille ramené juste au-dessus et à gauche de l'hôte, par pas entiers d'un pixel de sprite
  const before = (corner: number, edge: number) => {
    const start = snap(corner);
    return snap(start - Math.ceil((start - edge) / px - 1e-6) * px);
  };
  const origin = { left: before(grid.left, host.left), top: before(grid.top, host.top) };
  return {
    origin,
    offset: { left: origin.left - host.left, top: origin.top - host.top },
    columns: Math.ceil((host.left + host.width - origin.left) / px),
    rows: Math.ceil((host.top + host.height - origin.top) / px),
    px,
  };
}

// pixelSize : taille d'un pixel de sprite de la scène, en pixels CSS
export function createFxLayer(host: HTMLElement, pixelSize: () => number): FxLayer {
  const canvas = document.createElement("canvas");
  canvas.className = "fx-layer";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d");
  let running: { plan: FxPlan; start: number; name: string }[] = [];
  let loop = 0;
  let plays = 0;
  let drawn = "";
  let geometry: LayerGeometry | null = null;

  // Mesure la couche sur la scène et la grille d'un sprite ; gardée telle quelle tant qu'un effet est en cours,
  // pour que tous ses pixels restent à leur place
  function layout(grid: Element): LayerGeometry {
    if (geometry && canvas.isConnected) return geometry;
    const rect = host.getBoundingClientRect();
    const corner = grid.getBoundingClientRect();
    const g = layerGeometry(rect, corner, window.devicePixelRatio || 1, pixelSize());
    canvas.width = g.columns;
    canvas.height = g.rows;
    canvas.style.left = `${g.offset.left}px`;
    canvas.style.top = `${g.offset.top}px`;
    canvas.style.width = `${g.columns * g.px}px`;
    canvas.style.height = `${g.rows * g.px}px`;
    geometry = g;
    return g;
  }

  function close() {
    cancelAnimationFrame(loop);
    loop = 0;
    running = [];
    geometry = null;
    delete canvas.dataset.fx; // plus aucun effet : le canvas ne garde pas le nom du dernier
    canvas.remove();
  }

  const showNames = () => { canvas.dataset.fx = running.map(({ name }) => name).join(" "); };

  function tick(nowMs: number) {
    const frame = frameAt(nowMs);
    const before = running.length;
    running = running.filter(({ plan, start }) => frame - start < plan.count);
    if (running.length === 0) { close(); return; }
    if (running.length !== before) showNames();
    // Redessin seulement quand une image de la grille change ; avant son départ, un effet montre sa première image
    const key = running.map(({ start }) => Math.max(0, frame - start)).join(",");
    if (key !== drawn && context) {
      drawn = key;
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const { plan, start } of running) {
        for (const { x, y, color } of plan.frame(Math.max(0, frame - start))) {
          context.fillStyle = color;
          context.fillRect(x, y, 1, 1);
        }
      }
    }
    loop = requestAnimationFrame(tick);
  }

  return {
    measure(grid) {
      const { origin, px } = layout(grid);
      // Un écart de moins d'un millième de pixel de sprite est un arrondi de la page, pas un pixel de plus
      const floor = (value: number) => Math.floor(value + 1e-3), ceil = (value: number) => Math.ceil(value - 1e-3);
      return (element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: floor((rect.left - origin.left) / px), top: floor((rect.top - origin.top) / px),
          right: ceil((rect.right - origin.left) / px), bottom: ceil((rect.bottom - origin.top) / px),
        };
      };
    },
    play(make, name) {
      if (!geometry) return; // measure() n'a pas été appelée : rien à placer
      if (!canvas.isConnected) {
        host.appendChild(canvas);
        drawn = "";
      }
      running.push({ plan: make(++plays), start: startFrame(performance.now()), name });
      showNames();
      if (!loop) loop = requestAnimationFrame(tick);
    },
    dispose: close,
  };
}
