// stage.ts - La partie « scène » de l'affichage : les combattants, leurs poses et leurs animations (MAE-29, MAE-30)
//
// Deux scènes implémentent ce contrat : celle-ci, en DOM (sprites sur l'image de fond), et la scène peinte en 2,5D
// (src/scene/battle-stage.ts), choisie par dom-view.ts quand le chapitre déclare un décor.
// Une scène ne joue aucun son et ne touche pas au HUD : dom-view.ts s'en charge, dans le même ordre pour les deux.
// Marque ▼ de ciblage et bouclier sont du DOM posé sur l'« ancre » du combattant : en DOM, le sprite lui-même ;
// dans la scène peinte, un élément qui suit le sprite à l'écran. Les chiffres de dégâts se posent là où la scène le
// dit (popupAnchor), devant la couche des effets : l'ancre dans la scène peinte, une couche à part en DOM (MAE-31).
// Les deux scènes affichent les mêmes images animées (animated-sprite.ts, MAE-30) : chaque pixel vient du PNG, et
// tout déplacement se fait par pixels de sprite entiers. Les couleurs (coup reçu, éclair, mort, or) sont appliquées par
// les classes de style.css ; les valeurs des teintes de l'or, de la mort et du coup reçu viennent de tints.ts, communes
// aux deux scènes (MAE-31).
// Les effets spéciaux (MAE-95) sont dessinés dans une couche à part (fx-layer.ts), la même dans les deux scènes.

import { CONFIG } from "../config.ts";
import { HEROES, type SpriteRig } from "../data/game-data.ts";
import type { Ability, AbilityEffect, Chapter, GoldBlood } from "../data/game-data.ts";
import type { Hero } from "../party/heroes.ts";
import { isAlive } from "../battle/battle.ts";
import type { BattleState, Combatant, Effect, Enemy } from "../battle/battle.ts";
import { Menu } from "./battle-menu.ts";
import { createAnimatedSprite, type AnimatedSprite } from "./animated-sprite.ts";
import { isReducedMotion } from "./reduced-motion.ts";
import { abilityFx, ashCloud, ashVeil, goldBlood, goldStream, lightRise, still, streamsGold } from "./battle-fx.ts";
import { createFxLayer, type FxLayer } from "./fx-layer.ts";
import type { OpaqueRuns } from "./sprite-frames.ts";
import { followHero } from "./hero-pose.ts";
import { frameCount, unravelCleared, type BaseName } from "./sprite-motion.ts";
import { applyTints } from "./tints.ts";
import { $, heroFlags, pulse, spriteEl, wait } from "./view.ts";

export interface Stage {
  showIdle(party: Hero[], chapter: Chapter): Promise<void>; // scène au repos : le groupe seul
  showBattle(state: BattleState): void;                      // les ennemis prennent place, pas encore visibles
  appear(): void;                                            // entrée en combat : les ennemis apparaissent
  refresh(): void;                                           // poses d'après l'état : éteint, en danger, actif, garde
  anchor(c: Combatant): HTMLElement | null;                  // élément DOM posé sur le combattant (marque ▼ de ciblage, bouclier)
  popupAnchor(c: Combatant): HTMLElement | null;             // où poser ses chiffres : devant la couche des effets (MAE-31)
  actionStart(actor: Combatant, ability: Ability): Promise<void>; // élan et pas en avant, ou bond et éclair, puis lueur du Souffle
  stepBack(actor: Combatant): void;                          // le héros reprend sa place
  impact(effect: AbilityEffect, targets: Combatant[]): void; // effet en pixels d'une capacité sur ceux qu'elle touche (MAE-31)
  hit(target: Combatant, effect: Effect): void;              // recul et teinte d'un coup reçu
  quake(): void;                                             // secousse de la scène (coup critique)
  defeated(enemy: Enemy): void;                              // vaincu mais pas mort : il reste à terre
  kill(enemies: Enemy[]): Promise<void>;
  flee(): Promise<void>;                                     // le groupe sort de scène
  victory(party: Hero[]): void;
  spare(enemy: Enemy): Promise<void>;                        // un ennemi à terre se relève, apaisé
  powerReturn(hero: Hero): void;                             // l'or quitte le héros vers l'ennemi à l'écran, ou un éclat doré (MAE-95)
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

// — Ce que les deux scènes partagent pour animer un combattant (MAE-30) —

// Squelette des animations : celui du héros dans HEROES, celui de l'ennemi dans sa fiche (copiée dans le combattant)
export function rigOf(c: Combatant): SpriteRig {
  if (c.side === "enemy") return c.rig;
  const def = HEROES.find(hero => hero.id === c.id);
  if (!def) throw new Error(`Animation : aucun héros ${c.id}`);
  return def.rig;
}

export const facingOf = (c: Combatant): 1 | -1 => (c.side === "hero" ? 1 : -1);
export const spriteHeight = (c: Combatant) => (c.side === "enemy" ? c.canvasHeight : HERO_CANVAS.h);

// Décalage de respiration d'un ennemi selon son rang : deux ennemis ne respirent pas ensemble
export const enemyPhase = (index: number) => (index * 0.37) % 1;

// Ce que l'affichage autour du sprite doit savoir de la pose dessinée (MAE-94), posé sur son élément (sprite DOM ou
// ancre de la scène peinte) : la pose dessinée affichée (data-pose : les braises d'Elwen s'y éteignent, style.css),
// l'image affichée (contour du survol, view.ts) et, pour le sprite DOM, l'ombre au sol (CSS, en pixels de sprite)
export function showPose(element: HTMLElement, sprite: AnimatedSprite) {
  element.dataset.pose = sprite.pose().drawn ?? "";
  const { shift, stretch } = sprite.shadow();
  element.style.setProperty("--shadow-shift", String(shift));
  element.style.setProperty("--shadow-stretch", String(stretch));
  const shown = sprite.shown();
  element.dataset.poseImage = shown.url;
  element.dataset.poseX = String(shown.x);
  element.dataset.poseY = String(shown.y);
}

// Pose de départ : un héros déjà éteint quand la scène se construit est posé éteint, sans rejouer sa chute
export function initialBase(c: Combatant): BaseName {
  if (c.side !== "hero") return "idle";
  const flags = heroFlags(c);
  return flags.ko ? "ko" : flags.critical ? "critical" : "idle";
}

// Nuée de cendre du Dragon (MAE-95), commune aux deux scènes : de sa gueule (`mouth`, en pixels de son PNG) vers le
// haut du corps des héros visés ; avec le mouvement réduit, un voile fixe sur eux. caster et targets : les éléments
// qui couvrent exactement leur PNG (DOM : .sprite-img ; scène peinte : l'ancre). Joué sans être attendu.
export function playAshCloud(fx: FxLayer, caster: Element, mouth: { x: number; y: number }, targets: Element[]) {
  const measure = fx.measure(caster);
  const from = measure(caster);
  const boxes = targets.map(measure);
  const count = frameCount(CONFIG.timing.ashCloud);
  const at = { x: from.left + mouth.x, y: from.top + mouth.y };
  const reduced = isReducedMotion();
  fx.play((seed) => (reduced ? ashVeil(boxes, count, seed) : ashCloud(at, boxes, count, seed)), "ash");
}

// L'écho de Maelor se défait en lumière (MAE-95), commun aux deux scènes : les pixels dorés qui partent des rangées
// effacées par le geste unravel de son image animée. png : l'élément qui couvre exactement son PNG. Sans mouvement
// réduit seulement (avec, l'écho passe en or puis disparaît d'un coup, sans particule). Joué sans être attendu.
export function playLightRise(fx: FxLayer, png: Element, sprite: AnimatedSprite) {
  const box = fx.measure(png)(png);
  const rows = sprite.rows();
  const count = frameCount(CONFIG.timing.unravel);
  fx.play((seed) => lightRise(box, rows, (frame) => unravelCleared(frame, count, rows.length), count, seed), "light");
}

// L'or quitte Maelor (MAE-95), commun aux deux scènes : de sa poitrine vers le Dragon (écailles et sol devant lui) s'il
// est à l'écran, sans mouvement réduit (streamsGold) ; sinon rien ici. Le héros jette son éclat doré dans tous les
// cas (couleurs : côté scène). Pour Maelor et le Dragon : element, l'élément qui couvre exactement leur PNG ; rows, leur
// image affichée (AnimatedSprite.shownRows), d'où part l'or et où il se pose. dragon null : pas de Dragon à l'écran.
interface Shown { element: Element; rows: OpaqueRuns[] }
export function playGoldStream(fx: FxLayer, hero: Shown, dragon: Shown | null) {
  if (!streamsGold(dragon !== null, isReducedMotion()) || !dragon) return; // !dragon : déjà dit par streamsGold, pour le type
  const measure = fx.measure(hero.element);
  const from = measure(hero.element), to = measure(dragon.element);
  fx.play((seed) => goldStream(from, hero.rows, to, dragon.rows, frameCount(CONFIG.timing.powerReturn), seed), "gold");
}

// L'effet d'une capacité sur ceux qu'elle touche (MAE-31), commun aux deux scènes : dessiné sur la silhouette de chaque
// cible telle qu'elle est affichée. element : l'élément qui couvre exactement son PNG ; rows : son image affichée
// (AnimatedSprite.shownRows). La grille de la couche se cale sur la première cible. Le coup vient du camp d'en face :
// vers la droite sur un ennemi, vers la gauche sur un héros (blowFacing). Avec le mouvement réduit, une image fixe.
// Joué sans être attendu : il dure au plus la pause de lecture des chiffres (CONFIG.timing.abilityFx). id : celui du
// combattant, pour le nom de l'effet écrit sur la couche (fx-layer.ts)
export interface ShownTarget extends Shown { id: string }
export const blowFacing = (targets: Combatant[]): 1 | -1 => (targets[0]?.side === "hero" ? -1 : 1);

export function playAbilityFx(fx: FxLayer, effect: AbilityEffect, targets: ShownTarget[], facing: 1 | -1) {
  if (targets.length === 0) return;
  const measure = fx.measure(targets[0].element);
  const boxes = targets.map(({ element, rows }) => ({ box: measure(element), rows }));
  const count = frameCount(CONFIG.timing.abilityFx);
  const reduced = isReducedMotion();
  const name = `${effect}:${targets.map(({ id }) => id).join(",")}`;
  fx.play((seed) => abilityFx(effect, { targets: boxes, facing, count, seed }, reduced), name);
}

// Sang doré (MAE-98), commun aux deux scènes : à chaque dégât reçu par Maelor ou Elwen, leurs éclats d'or (goldBlood,
// battle-fx.ts), dans le sens du coup ; rien pour un combattant sans goldBlood dans sa fiche (Corvin, tout ennemi,
// l'écho de Maelor compris). Les scènes le lancent depuis hit, donc jamais sur un « Raté ». Il dure au plus la pause
// de lecture des chiffres, comme l'effet d'une capacité (CONFIG.timing.abilityFx), et n'est jamais attendu. Avec le
// mouvement réduit, une image fixe. Son nom sur la couche : blood:<id> (fx-layer.ts)
export const goldBloodOf = (c: Combatant): GoldBlood | null => (c.side === "hero" ? HEROES.find((def) => def.id === c.id)?.goldBlood ?? null : null);

export function playGoldBlood(fx: FxLayer, target: ShownTarget, setting: GoldBlood, facing: 1 | -1) {
  const box = fx.measure(target.element)(target.element);
  const count = Math.min(setting.frames, frameCount(CONFIG.timing.abilityFx));
  const reduced = isReducedMotion();
  fx.play((seed) => {
    const plan = goldBlood({ box, rows: target.rows }, facing, setting, count, seed);
    return reduced ? still(plan) : plan;
  }, `blood:${target.id}`);
}

// Braises qui montent des bords enflammés d'un héros (Elwen), décalées dans le temps. Commun aux deux scènes et à
// l'aperçu des animations (?animations=1), qui ne connaît que l'identifiant du héros
export function embersHtml(c: Pick<Combatant, "id">) {
  const embers = HEROES.find(def => def.id === c.id)?.embers || [];
  return embers.map(([x, y], i) => {
    const left = (x / HERO_CANVAS.w) * 100, top = (y / HERO_CANVAS.h) * 100;
    return `<span class="ember" style="left: ${left}%; top: ${top}%; animation-delay: ${-i * 0.37}s"></span>`;
  }).join("");
}

// Ce qui se pose au-dessus d'un combattant, dans les deux scènes (maquette D2, MAE-87) : son nom et la marque ▼, montrés
// quand c'est son tour ; pour un ennemi ordinaire, son nom et sa petite barre de vie, tenue à jour par updateBattleUI
export function overlayHtml(c: Combatant) {
  const mark = `<span class="turn-mark" aria-hidden="true"><span>${c.name}</span><span class="turn-mark-arrow">▼</span></span>`;
  if (c.side === "hero") return mark;
  if (c.boss) return "";
  return `<div class="od-foe"><span class="od-foe-name">${c.name}</span><span class="od-bar" role="img"><i class="od-trail"></i><i class="od-fill"></i></span></div>`;
}

// Un pixel de sprite fait un nombre entier de pixels réels, avec la même règle que la scène peinte (framing.ts) :
// --scene-px, en pixels CSS, vaut donc k / devicePixelRatio
function syncPixelScale() {
  const ratio = window.devicePixelRatio || 1;
  const k = Math.max(1, Math.round((window.innerHeight * ratio) / CONFIG.scene.screenHeightInSpritePixels));
  $("#battle-scene").style.setProperty("--scene-px", String(k / ratio));
}

// Chaque sprite commence sur un pixel réel : sinon le pixel art afficherait des rangées irrégulières
function snapSprites() {
  const ratio = window.devicePixelRatio || 1;
  for (const sprite of document.querySelectorAll<HTMLElement>(".sprite")) {
    sprite.style.translate = "";
    const { left, top } = sprite.getBoundingClientRect();
    sprite.style.translate = `${Math.round(left * ratio) / ratio - left}px ${Math.round(top * ratio) / ratio - top}px`;
  }
}

// Un combattant de la scène DOM : son élément, son image animée, et sa place en pixels de sprite (pas en avant, repli)
interface DomActor {
  combatant: Combatant;
  element: HTMLElement;
  sprite: AnimatedSprite;
  x: number;
  acting: boolean;
  away: boolean;  // sorti de scène (repli) : refresh() ne le ramène pas
  celebrating: boolean; // victoire : debout, même en danger (followHero)
  slide: number; // requestAnimationFrame du glissement en cours, 0 sans glissement
}

// La scène DOM : les sprites dans #hero-area et #enemy-area ; les couleurs par les classes de style.css
export function createDomStage(): Stage {
  syncPixelScale();
  applyTints($("#battle-scene").style); // l'or, la mort, le coup reçu : les filtres de style.css (tints.ts)
  window.addEventListener("resize", () => { syncPixelScale(); snapSprites(); });
  const actors = new Map<string, DomActor>();
  // Couche des effets (MAE-95, MAE-31), sur toute la scène ; un pixel de sprite y vaut celui des sprites : --px, qui est
  // --scene-px sur ordinateur et 1 sur téléphone (style.css). Sans sprite en scène, --scene-px
  const scene = $("#battle-scene");
  const fx = createFxLayer(scene, () => {
    const sprite = scene.querySelector(".sprite");
    return parseFloat(sprite ? getComputedStyle(sprite).getPropertyValue("--px") : getComputedStyle(scene).getPropertyValue("--scene-px"));
  });
  const pngOf = (a: DomActor) => $(".sprite-img", a.element);
  // Les chiffres se posent devant la couche des effets (MAE-31) : dans une couche à part, au-dessus d'elle, sur une
  // boîte qui recouvre le sprite du combattant. Posés dans le sprite, ils passeraient derrière elle : chaque sprite a
  // son propre empilement (style.css, .popup-layer). La boîte recouvre .sprite-body, qui porte le glissement du
  // combattant (pas en avant, retour, repli ; pas le recul ni le saut) : elle le suit tant qu'elle porte un chiffre,
  // comme l'ancre de la scène peinte (décision de Wesley du 11/11/2026, MAE-99), par une boucle arrêtée sans chiffre
  const popupLayer = document.createElement("div");
  popupLayer.className = "popup-layer";
  scene.appendChild(popupLayer);
  const popupBoxes = new Map<string, HTMLElement>();
  let following = 0; // la boucle qui garde les boîtes sur leur combattant (0 : arrêtée)
  const bodyOf = (a: DomActor) => $(".sprite-body", a.element);

  // Le rectangle du combattant dans la scène, lu d'abord ; puis chaque boîte écrite, seulement si elle a bougé (lire
  // après avoir écrit forcerait un calcul de la page par boîte)
  function placeBoxes(list: [HTMLElement, DomActor][]) {
    const within = scene.getBoundingClientRect();
    const rects = list.map(([, actor]) => bodyOf(actor).getBoundingClientRect());
    list.forEach(([box], i) => {
      const rect = rects[i];
      const place = { left: `${rect.left - within.left}px`, top: `${rect.top - within.top}px`, width: `${rect.width}px`, height: `${rect.height}px` };
      for (const [name, value] of Object.entries(place)) if (box.style.getPropertyValue(name) !== value) box.style.setProperty(name, value);
    });
  }

  function follow() {
    following = 0;
    const carrying: [HTMLElement, DomActor][] = [];
    for (const [id, box] of popupBoxes) {
      const actor = actors.get(id);
      if (box.firstElementChild && actor) carrying.push([box, actor]);
    }
    placeBoxes(carrying);
    if (carrying.length) following = requestAnimationFrame(follow);
  }

  function actorOf(c: Combatant) {
    const actor = actors.get(c.id);
    if (!actor) throw new Error(`Scène DOM : ${c.name} n'est pas en scène`);
    return actor;
  }

  function createActor(c: Combatant, [x, y]: [number, number], phase: number): DomActor {
    const element = document.createElement("div");
    element.className = `sprite ${c.side}${c.boss ? " boss" : ""}`;
    element.dataset.sprite = c.id;
    element.style.left = x + "%";
    // Hauteur voulue ; style.css la borne pour que le sprite reste entier dans la scène (voir .sprite.hero, .sprite.enemy)
    element.style.setProperty("--slot-y", y + "%");
    // Pixel art : la taille à l'écran vient de la toile du PNG (voir .sprite.hero et .sprite.enemy dans style.css)
    const canvas = c.side === "enemy" ? { w: c.canvasWidth, h: c.canvasHeight } : HERO_CANVAS;
    element.style.setProperty("--canvas-w", String(canvas.w));
    element.style.setProperty("--canvas-h", String(canvas.h));
    element.innerHTML = `<div class="sprite-body"><div class="sprite-img" role="img" aria-label="${c.name}"></div>${embersHtml(c)}</div>${overlayHtml(c)}`;
    element.addEventListener("click", () => Menu.clickTarget(c));
    element.addEventListener("mouseenter", () => Menu.hoverTarget(c, true));
    element.addEventListener("mouseleave", () => Menu.hoverTarget(c, false));

    // L'image : le canvas déborde du rectangle du PNG (.sprite-img) de la marge de la toile, pour se pencher sans
    // déplacer l'ancre ; le recul et le bond (dx) déplacent aussi l'ombre, le saut (dy) non
    const holder = $(".sprite-img", element);
    const facing = facingOf(c);
    const sprite = createAnimatedSprite({
      url: c.image, rig: rigOf(c), height: spriteHeight(c), facing, phase, initial: initialBase(c),
      onPose(pose) {
        holder.style.setProperty("--pose-dx", String(pose.dx * facing));
        sprite.canvas.style.setProperty("--pose-dy", String(pose.dy));
        showPose(element, sprite);
      },
    });
    holder.appendChild(sprite.canvas);
    void sprite.ready.then(() => {
      const { layout } = sprite;
      for (const [name, value] of [["--frame-x", layout.originX], ["--frame-y", layout.originY], ["--frame-w", layout.width], ["--frame-h", layout.height]] as const) { // as const : paires nom, valeur
        sprite.canvas.style.setProperty(name, String(value));
      }
    }).catch(console.error);
    return { combatant: c, element, sprite, x: 0, acting: false, away: false, celebrating: false, slide: 0 };
  }

  // Glisse le sprite jusqu'à x (pixels de sprite), par pixels entiers ; d'un coup avec le mouvement réduit (MAE-58)
  function slideTo(actor: DomActor, target: number, duration: number, ease: (p: number) => number) {
    cancelAnimationFrame(actor.slide);
    actor.slide = 0;
    const from = actor.x;
    const place = (x: number) => { actor.x = x; actor.element.style.setProperty("--slide", String(Math.round(x))); };
    if (isReducedMotion() || duration <= 0 || from === target) { place(target); return; }
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      place(from + (target - from) * ease(p));
      actor.slide = p < 1 ? requestAnimationFrame(step) : 0;
    };
    actor.slide = requestAnimationFrame(step);
  }

  const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
  const easeIn = (p: number) => p * p;
  const restingX = (c: Combatant) => (c.side === "hero" && heroFlags(c).active ? CONFIG.scene.battle.activeStep : 0);

  function place(area: string, list: [Combatant, [number, number], number][]) {
    for (const actor of actors.values()) {
      if (actor.element.parentElement?.id !== area) continue;
      actor.sprite.dispose();
      cancelAnimationFrame(actor.slide);
      actors.delete(actor.combatant.id);
    }
    const created = list.map(([c, slot, phase]) => createActor(c, slot, phase));
    for (const actor of created) actors.set(actor.combatant.id, actor);
    $(`#${area}`).replaceChildren(...created.map(actor => actor.element));
    // Les boîtes à chiffres de ceux qui ont quitté la scène partent avec eux
    for (const [id, box] of popupBoxes) {
      if (actors.has(id)) continue;
      box.remove();
      popupBoxes.delete(id);
    }
  }

  function refresh() {
    for (const actor of actors.values()) {
      const c = actor.combatant;
      if (c.side !== "hero") continue;
      const flags = heroFlags(c);
      followHero(actor.sprite, flags, actor.acting, actor.celebrating);
      if (!actor.acting && !actor.away && !flags.ko) {
        const target = restingX(c);
        if (target !== actor.x) slideTo(actor, target, CONFIG.timing.slide, easeOut);
      }
    }
    snapSprites();
  }

  return {
    async showIdle(party) {
      place("enemy-area", []);
      place("hero-area", party.map((hero, i): [Combatant, [number, number], number] => [hero, HERO_SLOTS[i], 0]));
    },

    showBattle(state) {
      const slots = FORMATIONS[state.enemies.length];
      place("enemy-area", state.enemies.map((enemy, i): [Combatant, [number, number], number] => [enemy, slots[i], enemyPhase(i)]));
    },

    appear() {
      document.querySelectorAll<HTMLElement>(".sprite.enemy").forEach(el => pulse(el, "appear", CONFIG.timing.appear));
    },

    // Les classes d'état sont posées par updateBattleUI (view.ts) sur chaque [data-sprite] : reste la pose de chaque héros
    refresh,

    anchor: spriteEl,

    popupAnchor(c) {
      const actor = actors.get(c.id);
      if (!actor) return null;
      let box = popupBoxes.get(c.id);
      if (!box) {
        box = document.createElement("div");
        box.className = "popup-box";
        box.dataset.popupFor = c.id; // de qui sont ces chiffres : le sprite n'est plus leur parent
        popupLayer.appendChild(box);
        popupBoxes.set(c.id, box);
      }
      // Sur son combattant dès maintenant (le chiffre s'y place et s'y mesure, view.ts), puis à chaque image tant qu'il vit
      placeBoxes([[box, actor]]);
      if (!following) following = requestAnimationFrame(follow);
      return box;
    },

    async actionStart(actor, ability) {
      const a = actorOf(actor);
      if (actor.side === "hero") {
        a.acting = true;
        a.element.classList.add("acting");
        a.sprite.play("attack");
        a.sprite.setBase("acting");
        slideTo(a, CONFIG.scene.battle.actingStep, CONFIG.timing.step, easeOut);
        await wait(CONFIG.timing.step);
      } else {
        // L'éclair court dit « il agit », le bond vers les héros fait le geste (décision de Wesley du 08/11/2026)
        a.sprite.play("strike");
        await pulse(a.element, "blink", CONFIG.timing.blink);
      }
      if (ability.kind !== "physical") {
        if (ability.visual === "ash" && actor.side === "enemy" && actor.mouth) {
          const heroes = [...actors.values()].filter((h) => h.combatant.side === "hero" && isAlive(h.combatant));
          playAshCloud(fx, pngOf(a), actor.mouth, heroes.map(pngOf));
        }
        a.sprite.play("cast");
        await pulse(a.element, "casting", CONFIG.timing.cast);
      }
    },

    stepBack(actor) {
      const a = actors.get(actor.id);
      if (!a || actor.side !== "hero") return;
      a.acting = false;
      a.element.classList.remove("acting");
      followHero(a.sprite, heroFlags(actor), false, a.celebrating);
      slideTo(a, restingX(actor), CONFIG.timing.slide, easeOut);
    },

    impact(effect, targets) {
      // Seulement sur ceux qui sont à l'écran : ni mort (caché, mais son rectangle reste), ni sorti de scène
      const shown = targets.flatMap((combatant) => {
        const a = actors.get(combatant.id);
        return a && !a.away && !a.element.classList.contains("dead") ? [{ id: combatant.id, element: pngOf(a), rows: a.sprite.shownRows() }] : [];
      });
      playAbilityFx(fx, effect, shown, blowFacing(targets));
    },

    hit(target, effect) {
      if (effect.type !== "damage") return;
      const a = actors.get(target.id);
      const blood = goldBloodOf(target);
      if (a && blood && !a.away) playGoldBlood(fx, { id: target.id, element: pngOf(a), rows: a.sprite.shownRows() }, blood, blowFacing([target]));
      a?.sprite.play("hit");
      pulse(spriteEl(target), "damaged", CONFIG.timing.hit);
    },

    quake() {
      pulse($("#battle-scene"), "quake", CONFIG.timing.hit);
    },

    defeated(enemy) {
      const a = actorOf(enemy);
      a.sprite.play("slump");
      a.sprite.setBase("defeated");
      a.element.classList.add("defeated");
    },

    async kill(enemies) {
      const reduced = isReducedMotion();
      const light = enemies.filter((enemy) => enemy.vanish === "light");
      for (const enemy of enemies) {
        const a = actorOf(enemy);
        if (enemy.vanish === "light") {
          // L'écho se défait en lumière (MAE-95) ; avec le mouvement réduit, il passe en or, puis disparaît d'un coup
          a.element.classList.add("unraveling");
          if (reduced) continue;
          a.sprite.play("unravel");
          playLightRise(fx, pngOf(a), a.sprite);
        } else {
          a.sprite.play("dissolve");
          a.element.classList.add("dying");
        }
        a.sprite.setBase("gone");
      }
      await wait(light.length > 0 ? Math.max(CONFIG.timing.death, CONFIG.timing.unravel) : CONFIG.timing.death);
      for (const enemy of enemies) {
        const a = actorOf(enemy);
        a.sprite.setBase("gone");
        a.element.classList.add("dead");
      }
    },

    // Le groupe sort par la gauche, de toute la largeur de l'écran : hors champ à coup sûr
    async flee() {
      const px = parseFloat(getComputedStyle($("#battle-scene")).getPropertyValue("--scene-px")) || 1;
      const distance = Math.ceil(window.innerWidth / px);
      for (const a of actors.values()) {
        if (a.combatant.side !== "hero") continue;
        a.element.classList.add("fleeing");
        a.away = true;
        slideTo(a, -distance, CONFIG.timing.fleeSlide, easeIn);
      }
      await wait(CONFIG.timing.flee);
    },

    victory(party) {
      for (const hero of party.filter(isAlive)) {
        const a = actors.get(hero.id);
        if (!a) continue;
        a.element.classList.add("victory");
        a.celebrating = true;
        followHero(a.sprite, heroFlags(hero), false, true); // en danger, il passe debout pour sauter
        a.sprite.play("victory");
      }
    },

    async spare(enemy) {
      const a = actorOf(enemy);
      // Il retrouve ses couleurs lentement en se relevant (décision de Wesley du 11/11/2026, MAE-98) : sparing porte la
      // transition de son image le temps du geste (style.css), posée avant de retirer defeated ; jamais attendue
      void pulse(a.element, "sparing", CONFIG.timing.defeatedPose);
      a.element.classList.remove("defeated");
      a.sprite.play("rise");
      a.sprite.setBase("idle");
      await pulse(a.element, "casting", CONFIG.timing.cast);
    },

    powerReturn(hero) {
      const a = actors.get(hero.id);
      if (!a) return;
      const dragon = [...actors.values()].find((e) => e.combatant.side === "enemy" && !e.element.classList.contains("dead"));
      playGoldStream(fx, { element: pngOf(a), rows: a.sprite.shownRows() }, dragon ? { element: pngOf(dragon), rows: dragon.sprite.shownRows() } : null);
      void pulse(a.element, "gilded", CONFIG.timing.gild); // l'éclat n'est pas attendu
    },

    dispose() {
      fx.dispose();
      cancelAnimationFrame(following);
      following = 0;
      popupLayer.replaceChildren();
      popupBoxes.clear();
      for (const a of actors.values()) { a.sprite.dispose(); cancelAnimationFrame(a.slide); }
      actors.clear();
      $("#enemy-area").replaceChildren();
      $("#hero-area").replaceChildren();
    },
  };
}
