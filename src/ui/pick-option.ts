// pick-option.ts - Petit menu de choix : écran titre, choix des dialogues

import { Input } from "../input/input.ts";
import { Sfx } from "../audio/sfx.ts";

// Options verticales avec le curseur main : flèches, Valider, survol ou clic.
// preselect: false → aucune option désignée au départ, il faut d'abord bouger la main.
// Renvoie une promesse résolue avec l'index de l'option choisie.
export function pickOption(items: HTMLElement[], { preselect = true }: { preselect?: boolean } = {}) {
  let cursor = preselect ? 0 : -1;
  const highlight = () => items.forEach((item, i) => item.classList.toggle("selected", i === cursor));
  const listeners = new AbortController();
  highlight();

  return new Promise<number>(resolve => {
    const choose = (index: number) => {
      Input.pop();
      listeners.abort();
      Sfx.play("confirm");
      resolve(index);
    };

    items.forEach((item, i) => {
      item.addEventListener("mouseenter", () => { cursor = i; highlight(); }, { signal: listeners.signal });
      item.addEventListener("click", event => {
        event.stopPropagation(); // le clic ne doit pas aussi « valider » la fenêtre qui contient le menu
        choose(i);
      }, { signal: listeners.signal });
    });

    Input.push(action => {
      if (action === "up" || action === "down") {
        const delta = action === "up" ? -1 : 1;
        cursor = cursor < 0 ? (delta < 0 ? items.length - 1 : 0) : (cursor + delta + items.length) % items.length;
        Sfx.play("cursor");
        highlight();
      }
      if (action === "confirm" && cursor >= 0) choose(cursor);
    });
  });
}
