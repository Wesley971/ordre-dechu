// stage.ts - La partie « scène » de l'affichage : les combattants, leurs poses et leurs animations (MAE-29)
//
// Deux scènes implémentent ce contrat : celle-ci, en DOM (sprites en <img> sur l'image de fond), et la scène
// peinte en 2,5D (src/scene/battle-stage.ts), choisie par dom-view.ts quand le chapitre déclare un décor.
// Une scène ne joue aucun son et ne touche pas au HUD : dom-view.ts s'en charge, dans le même ordre pour les deux.
// Chiffres de dégâts, effets, main de ciblage et bouclier sont du DOM posé sur l'« ancre » du combattant :
// en DOM, le sprite lui-même ; dans la scène peinte, un élément qui suit le sprite à l'écran.

import { CONFIG } from "../config.ts";
import { HEROES } from "../data/game-data.ts";
import type { Ability, Chapter } from "../data/game-data.ts";
import type { Hero } from "../party/heroes.ts";
import { isAlive } from "../battle/battle.ts";
import type { BattleState, Combatant, Effect, Enemy } from "../battle/battle.ts";
import { Menu } from "./battle-menu.ts";
import { $, pulse, spriteEl, wait } from "./view.ts";

export interface Stage {
  showIdle(party: Hero[], chapter: Chapter): Promise<void>; // scène au repos : le groupe seul
  showBattle(state: BattleState): void;                      // les ennemis prennent place, pas encore visibles
  appear(): void;                                            // entrée en combat : les ennemis apparaissent
  refresh(): void;                                           // poses d'après l'état : éteint, en danger, actif, garde
  anchor(c: Combatant): HTMLElement | null;                  // élément DOM posé sur le combattant (chiffres, effets, main)
  actionStart(actor: Combatant, ability: Ability): Promise<void>; // pas en avant ou clignotement, puis lueur du Souffle
  stepBack(actor: Combatant): void;                          // le héros reprend sa place
  hit(target: Combatant, effect: Effect): void;              // recul et teinte d'un coup reçu
  quake(): void;                                             // secousse de la scène (coup critique)
  defeated(enemy: Enemy): void;                              // vaincu mais pas mort : il reste à terre
  kill(enemies: Enemy[]): Promise<void>;
  flee(): Promise<void>;                                     // le groupe sort de scène
  victory(party: Hero[]): void;
  spare(enemy: Enemy): Promise<void>;                        // un ennemi à terre se relève, apaisé
  dispose(): void;                                           // retire ses éléments de la page
}

// Positions (en % de la zone) selon le nombre d'ennemis, et des héros en diagonale
const FORMATIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[65, 30], [38, 70]],
  3: [[72, 22], [34, 50], [72, 80]],
};
const HERO_SLOTS: [number, number][] = [[78, 28], [50, 52], [22, 76]];

// Toile commune des sprites de héros, en pixels de sprite (affichée ×3 sur ordinateur, ×1 sur mobile).
// Seule déclaration : style.css la reçoit en variables --canvas-w et --canvas-h, comme pour les ennemis (MAE-21)
export const HERO_CANVAS = { w: 47, h: 66 };

// Sprite d'un combattant présent sur la scène
function sceneSprite(c: Combatant) { return $(`[data-sprite="${c.id}"]`); }

function createSprite(c: Combatant, [x, y]: [number, number]) {
  const sprite = document.createElement("div");
  sprite.className = `sprite ${c.side}${c.boss ? " boss" : ""}`;
  sprite.dataset.sprite = c.id;
  sprite.style.left = x + "%";
  // Hauteur voulue ; style.css la borne pour que le sprite reste entier dans la scène (voir .sprite.hero, .sprite.enemy)
  sprite.style.setProperty("--slot-y", y + "%");
  // Pixel art : la taille à l'écran vient de la toile du PNG (voir .sprite.hero et .sprite.enemy dans style.css)
  const canvas = c.side === "enemy" ? { w: c.canvasWidth, h: c.canvasHeight } : HERO_CANVAS;
  sprite.style.setProperty("--canvas-w", String(canvas.w));
  sprite.style.setProperty("--canvas-h", String(canvas.h));
  sprite.innerHTML = `<div class="sprite-body"><img class="sprite-img" src="${c.image}" alt="${c.name}">${embersHtml(c)}</div>`;
  sprite.addEventListener("click", () => Menu.clickTarget(c));
  if (c.side === "hero") {
    // Un héros déjà éteint quand la scène est construite est posé à terre, sans rejouer sa chute
    if (!isAlive(c)) sprite.classList.add("ko", "fallen");
    const img = sprite.querySelector<HTMLImageElement>(".sprite-img");
    if (img) measureKoLift(img).then(lift => { if (lift !== null) sprite.style.setProperty("--ko-lift", String(lift)); });
  }
  return sprite;
}

// Couché, le héros pivote autour de ses pieds, tête vers les ennemis : sa colonne opaque la plus à droite devient
// son point le plus bas. Renvoie, en pixels de sprite, ce qu'il faut le remonter pour que ce point touche la ligne
// de sol ; null si l'image ne se lit pas. Commun aux deux scènes.
export async function measureKoLift(img: HTMLImageElement): Promise<number | null> {
  if (!img.complete) await new Promise<void>(resolve => img.addEventListener("load", () => resolve(), { once: true }));
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.width) return null;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let x = canvas.width - 1; x >= 0; x--) {
    for (let y = 0; y < canvas.height; y++) {
      if (data[(y * canvas.width + x) * 4 + 3]) return x + 1 - canvas.width / 2;
    }
  }
  return null;
}

// Braises qui montent des bords enflammés d'un héros (Elwen), décalées dans le temps. Commun aux deux scènes.
export function embersHtml(c: Combatant) {
  const embers = HEROES.find(def => def.id === c.id)?.embers || [];
  return embers.map(([x, y], i) => {
    const left = (x / HERO_CANVAS.w) * 100, top = (y / HERO_CANVAS.h) * 100;
    return `<span class="ember" style="left: ${left}%; top: ${top}%; animation-delay: ${-i * 0.37}s"></span>`;
  }).join("");
}

// La scène DOM : les sprites dans #hero-area et #enemy-area, animés par les classes de style.css
export function createDomStage(): Stage {
  return {
    async showIdle(party) {
      $("#enemy-area").replaceChildren();
      $("#hero-area").replaceChildren(...party.map((hero, i) => createSprite(hero, HERO_SLOTS[i])));
    },

    showBattle(state) {
      const slots = FORMATIONS[state.enemies.length];
      $("#enemy-area").replaceChildren(...state.enemies.map((enemy, i) => createSprite(enemy, slots[i])));
    },

    appear() {
      document.querySelectorAll<HTMLElement>(".sprite.enemy").forEach(el => pulse(el, "appear", CONFIG.timing.appear));
    },

    // Les classes d'état sont posées par updateBattleUI (view.ts) sur chaque [data-sprite] : rien de plus ici
    refresh() {},

    anchor: spriteEl,

    async actionStart(actor, ability) {
      const sprite = sceneSprite(actor);
      if (actor.side === "hero") {
        sprite.classList.add("acting");
        await wait(CONFIG.timing.step);
      } else {
        await pulse(sprite, "blink", CONFIG.timing.blink);
      }
      if (ability.kind !== "physical") await pulse(sprite, "casting", CONFIG.timing.cast);
    },

    stepBack(actor) {
      spriteEl(actor)?.classList.remove("acting");
    },

    hit(target, effect) {
      if (effect.type === "damage") pulse(spriteEl(target), "damaged", CONFIG.timing.hit);
    },

    quake() {
      pulse($("#battle-scene"), "quake", CONFIG.timing.hit);
    },

    defeated(enemy) {
      sceneSprite(enemy).classList.add("defeated");
    },

    async kill(enemies) {
      enemies.forEach(enemy => sceneSprite(enemy).classList.add("dying"));
      await wait(CONFIG.timing.death);
      enemies.forEach(enemy => sceneSprite(enemy).classList.add("dead"));
    },

    async flee() {
      document.querySelectorAll(".sprite.hero").forEach(el => el.classList.add("fleeing"));
      await wait(CONFIG.timing.flee);
    },

    victory(party) {
      party.filter(isAlive).forEach(hero => sceneSprite(hero).classList.add("victory"));
    },

    async spare(enemy) {
      const sprite = sceneSprite(enemy);
      sprite.classList.remove("defeated");
      await pulse(sprite, "casting", CONFIG.timing.cast);
    },

    dispose() {
      $("#enemy-area").replaceChildren();
      $("#hero-area").replaceChildren();
    },
  };
}
