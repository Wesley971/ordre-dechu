// battle-stage.ts - La scène peinte en 2,5D comme scène de combat (MAE-29) : l'implémentation de Stage (src/ui/stage.ts)
//
// Le canvas couvre tout l'écran, derrière l'interface ; la peinture est cadrée dans le rectangle de #battle-scene,
// au-dessus des fenêtres du bas (zone de cadrage, framing.ts). Sur chaque combattant, une « ancre » DOM suit son
// sprite à l'écran : elle reçoit les chiffres, effets, main de ciblage et bouclier (dom-view.ts, style.css), elle
// porte les mêmes classes d'état que les sprites DOM, et un toucher dessus vise le combattant.
// Les poses transposent simplement les animations CSS des sprites DOM (MAE-30 et MAE-31 feront le reste).
// Mouvement réduit : la scène ne se redessine que sur demande, chaque geste prend directement sa pose finale.

import { Color } from "three";
import { CONFIG } from "../config.ts";
import { ENEMIES } from "../data/game-data.ts";
import type { Decor } from "../data/decors.ts";
import type { Hero } from "../party/heroes.ts";
import type { Combatant } from "../battle/battle.ts";
import type { Stage } from "../ui/stage.ts";
import { preloadImages, type ActorsView } from "./actors.ts";
import { actorDefs, castExtent, type CastMember } from "./cast.ts";
import { createPaintedStage, type PaintedStage, type SceneQuality, type StageMeasure } from "./painted-stage.ts";

export interface HeroFlags { ko: boolean; critical: boolean; active: boolean; ready: boolean; defending: boolean }

export interface BattleStageOptions {
  quality?: SceneQuality;
  flagsOf(hero: Hero): HeroFlags;             // pose d'un héros d'après l'état (ui/view.ts, heroFlags)
  onPick(combatant: Combatant): void;         // clic ou toucher sur un combattant
  onHover?(combatant: Combatant, entering: boolean): void; // la souris entre sur un combattant ou le quitte (MAE-89)
  anchorHtml?(combatant: Combatant): string;  // contenu DOM de l'ancre (braises d'Elwen)
  counter?: boolean;                           // compteur d'images/s à l'écran (mode test)
  expose?: boolean;                            // window.battleStage pour les mesures du bot (mode test, local)
}

export interface BattleStage extends Stage {
  measure(): StageMeasure;
}

const BODY_CLASS = "scene-painted";
const DAMAGE_TINT = new Color("#ff8c3c");  // coup reçu : brightness(1.8) sepia(0.6) hue-rotate(-30deg) des sprites DOM
const DEATH_TINT = new Color("#7a4fd6");   // mort : sepia(1) saturate(6) hue-rotate(250deg)
const KO_BRIGHTNESS = 0.55;
const DEFEATED_GRAY = 0.5;

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const easeIn = (p: number) => p * p;
const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p));

// État d'un combattant dans la scène : la pose se compose de ces parts à chaque image
interface ActorState {
  combatant: Combatant;
  x: number; y: number;             // place au repos (pas en avant du héros actif, affaissement du vaincu)
  rotation: number; scaleY: number;
  lunge: number; jolt: number; recoil: number; hop: number; // gestes passagers, en pixels de sprite
  brightness: number; gray: number; tintMix: number; tint: Color; opacity: number; clipTop: number; glow: number;
  visible: boolean; breathing: boolean; kneeling: boolean;
  acting: boolean;                   // en plein pas en avant : refresh() ne le rappelle pas à sa place
  ko: boolean;                       // dernière pose connue, pour ne jouer la chute qu'une fois
}

interface Tween { id: string; start: number | null; duration: number; step(progress: number): void; onEnd?: () => void }

export async function createBattleStage(decor: Decor, options: BattleStageOptions): Promise<BattleStage> {
  const { battle: poses } = CONFIG.scene;
  const container = document.createElement("div");
  container.id = "painted-stage";
  container.style.background = decor.atmosphere.colors.background;
  const layer = document.createElement("div");
  layer.id = "actor-layer";
  document.body.classList.add(BODY_CLASS);
  document.body.append(container, layer);

  let stage: PaintedStage;
  try {
    stage = createPaintedStage(container, options.quality);
    await stage.setDecor(decor);
  } catch (error) {
    container.remove();
    layer.remove();
    document.body.classList.remove(BODY_CLASS);
    throw error;
  }

  const sceneBox = document.querySelector<HTMLElement>("#battle-scene");
  const anchors = new Map<string, HTMLElement>();
  const states = new Map<string, ActorState>();
  const tweens: Tween[] = [];
  let actors: ActorsView | null = null;
  let images = new Map<string, HTMLImageElement>();
  let members: CastMember[] = [];
  let extent: ReturnType<typeof castExtent> = [];
  let lastSafe = { top: -1, height: -1, clearBottom: 0, clearLeft: 0 };
  let stopCounter: (() => void) | null = null;

  // — Zone de cadrage : le rectangle de la scène, et la place à laisser libre pour la bande et les plaques (style.css) —

  function syncSafeArea() {
    if (!sceneBox) return;
    const rect = sceneBox.getBoundingClientRect();
    if (rect.height === 0) return; // écran de jeu masqué : on garde la dernière zone connue
    const style = getComputedStyle(sceneBox);
    const clearBottom = parseFloat(style.getPropertyValue("--scene-clear-bottom")) || 0;
    const clearLeft = parseFloat(style.getPropertyValue("--scene-clear-left")) || 0;
    if (rect.top === lastSafe.top && rect.height === lastSafe.height && clearBottom === lastSafe.clearBottom && clearLeft === lastSafe.clearLeft) return;
    lastSafe = { top: rect.top, height: rect.height, clearBottom, clearLeft };
    stage.setSafeArea(lastSafe);
  }
  const resizeObserver = new ResizeObserver(syncSafeArea);
  if (sceneBox) resizeObserver.observe(sceneBox);
  const game = document.querySelector("#game");
  if (game) resizeObserver.observe(game);
  window.addEventListener("resize", syncSafeArea);

  // — Poses : composées à chaque image à partir des états et des gestes en cours —

  function stateOf(c: Combatant) {
    const state = states.get(c.id);
    if (!state) throw new Error(`Scène peinte : ${c.name} n'est pas en scène`);
    return state;
  }
  const actorOf = (c: Combatant) => actors?.get(c.id) ?? null;

  function freshState(c: Combatant): ActorState {
    return {
      combatant: c, x: 0, y: 0, rotation: 0, scaleY: 1, lunge: 0, jolt: 0, recoil: 0, hop: 0,
      brightness: 1, gray: 0, tintMix: 0, tint: new Color("#ffffff"), opacity: 1, clipTop: 0, glow: 0,
      visible: true, breathing: true, kneeling: false, acting: false, ko: false,
    };
  }

  function animate(id: string, duration: number, step: (progress: number) => void, onEnd?: () => void) {
    tweens.push({ id, start: null, duration, step, onEnd });
    stage.requestRedraw();
  }

  function cancelTweens(id: string) {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].id === id) tweens.splice(i, 1);
  }

  function composePoses(t: number) {
    if (!actors) return;
    const moving = !stage.reducedMotion;
    const nowMs = t * 1000;
    for (const tween of [...tweens]) {
      if (tween.start === null) tween.start = nowMs;
      const progress = moving ? Math.min(1, (nowMs - tween.start) / tween.duration) : 1;
      tween.step(progress);
      if (progress >= 1) {
        const index = tweens.indexOf(tween);
        if (index >= 0) tweens.splice(index, 1);
        tween.onEnd?.();
      }
    }
    for (const actor of actors.actors) {
      const s = states.get(actor.id);
      if (!s) continue;
      // Genou à terre : tassé, et qui respire lentement quand le mouvement est permis
      const kneel = s.kneeling ? (moving ? 0.5 + 0.5 * Math.sin((nowMs / CONFIG.timing.kneel) * Math.PI * 2) : 0) : 0;
      const { pose } = actor;
      pose.offsetX = s.x + s.lunge + s.jolt + s.recoil;
      pose.offsetY = s.y + s.hop - (s.kneeling ? poses.kneelDip * (1 + 0.35 * kneel) : 0);
      pose.rotation = s.rotation;
      pose.scaleY = s.scaleY * (s.kneeling ? poses.kneelScale - 0.02 * kneel : 1);
      pose.brightness = s.brightness;
      pose.gray = s.gray;
      pose.tint.copy(s.tint);
      pose.tintMix = s.tintMix;
      pose.opacity = s.opacity;
      pose.clipTop = s.clipTop;
      pose.glow = s.glow;
      pose.visible = s.visible;
      pose.breathing = s.breathing;
    }
  }

  // — Ancres : un élément par combattant, qui suit la boîte du sprite à l'écran —

  function buildAnchors() {
    for (const anchor of anchors.values()) anchor.remove();
    anchors.clear();
    for (const s of states.values()) {
      const c = s.combatant;
      const anchor = document.createElement("div");
      anchor.className = `actor-anchor ${c.side}${c.boss ? " boss" : ""}`;
      anchor.dataset.sprite = c.id;
      anchor.innerHTML = options.anchorHtml?.(c) ?? "";
      anchor.addEventListener("click", () => options.onPick(c));
      anchor.addEventListener("mouseenter", () => options.onHover?.(c, true));
      anchor.addEventListener("mouseleave", () => options.onHover?.(c, false));
      layer.appendChild(anchor);
      anchors.set(c.id, anchor);
    }
  }

  function placeAnchors() {
    const info = stage.measure();
    const px = info.spritePixel / info.ratio;
    for (const box of info.boxes) {
      const anchor = anchors.get(box.id);
      const s = states.get(box.id);
      if (!anchor || !s) continue;
      anchor.hidden = !s.visible;
      anchor.style.left = `${box.left / info.ratio}px`;
      anchor.style.top = `${box.top / info.ratio}px`;
      anchor.style.width = `${(box.right - box.left) / info.ratio}px`;
      anchor.style.height = `${(box.bottom - box.top) / info.ratio}px`;
      anchor.style.setProperty("--px", String(px));
    }
  }

  stage.onFrame({
    poses(t) {
      syncSafeArea();
      composePoses(t);
    },
    placed: placeAnchors,
  });

  function setClass(c: Combatant, name: string, on: boolean) {
    anchors.get(c.id)?.classList.toggle(name, on);
  }

  // Ajoute une classe le temps d'une animation (la même mécanique que pulse() de ui/view.ts)
  function pulse(element: HTMLElement | null, className: string, duration: number) {
    if (!element) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), duration);
  }

  // — Distribution —

  function setCast(list: Combatant[]) {
    const kept = new Map(states);
    states.clear();
    for (const c of list) states.set(c.id, kept.get(c.id) ?? freshState(c));
    actors = stage.setCast(actorDefs(decor, list.map(toMember), images), extent);
    buildAnchors();
    refresh(true);
  }

  const toMember = (c: Combatant): CastMember => ({ id: c.id, image: c.image, side: c.side });

  function restingX(hero: Hero) {
    return options.flagsOf(hero).active ? poses.activeStep : 0;
  }

  // Poses des héros d'après l'état. atBuild : la scène vient d'être construite, un héros déjà éteint est posé à terre sans chute
  function refresh(atBuild = false) {
    for (const s of states.values()) {
      const c = s.combatant;
      if (c.side !== "hero") continue;
      const flags = options.flagsOf(c);
      const actor = actorOf(c);
      if (flags.ko && !s.ko) {
        s.ko = true;
        s.kneeling = false;
        s.breathing = false;
        s.gray = 1;
        s.brightness = KO_BRIGHTNESS;
        cancelTweens(c.id);
        s.lunge = s.jolt = s.recoil = s.hop = 0;
        s.acting = false;
        const lift = actor?.koLift ?? 0;
        const fall = (p: number) => { s.rotation = (-Math.PI / 2) * p; s.y = lift * p; };
        if (atBuild) fall(1);
        else animate(c.id, CONFIG.timing.fall, (p) => fall(easeIn(p)));
      } else if (!flags.ko && s.ko) {
        // Relevé : d'un coup, comme en DOM
        s.ko = false;
        s.rotation = 0;
        s.y = 0;
        s.gray = 0;
        s.brightness = 1;
        s.breathing = true;
      }
      if (!s.ko) {
        s.kneeling = flags.critical;
        const target = flags.active ? poses.activeStep : 0;
        if (s.x !== target && !s.acting) {
          const from = s.x;
          cancelTweens(`${c.id}:slide`);
          animate(`${c.id}:slide`, CONFIG.timing.slide, (p) => { s.x = from + (target - from) * easeOut(p); });
        }
      }
    }
    stage.requestRedraw();
  }

  if (options.counter) {
    const { overlay, startCounter } = await import("../dev/fps-counter.ts");
    const element = overlay("Mesure en cours…", { left: "8px", top: "8px" });
    container.appendChild(element);
    stopCounter = startCounter(() => stage.measure(), element);
  }

  const battleStage: BattleStage = {
    async showIdle(party, chapter) {
      // Les ennemis du chapitre, avant que le combat ne les crée (mêmes identifiants que createEnemies, battle.ts)
      const enemies = chapter.rest ? [] : chapter.enemies;
      members = [
        ...party.map(toMember),
        ...enemies.map((key, i) => ({ id: `${key}-${i}`, image: ENEMIES[key].image, side: "enemy" as const })),
      ];
      images = await preloadImages(members.map((member) => member.image));
      extent = castExtent(decor, members, images);
      setCast(party);
      container.classList.add("ready");
    },

    showBattle(state) {
      setCast([...state.heroes, ...state.enemies]);
      for (const enemy of state.enemies) stateOf(enemy).visible = false;
      stage.requestRedraw();
    },

    appear() {
      const delay = CONFIG.timing.appearDelay / CONFIG.timing.appear;
      for (const s of states.values()) {
        if (s.combatant.side !== "enemy") continue;
        setClass(s.combatant, "appear", true);
        animate(s.combatant.id, CONFIG.timing.appear, (p) => {
          const q = p <= delay ? 0 : easeOut((p - delay) / (1 - delay));
          s.visible = q > 0;
          s.opacity = q;
          s.brightness = 3 - 2 * q;
        }, () => { s.visible = true; s.opacity = 1; s.brightness = 1; setClass(s.combatant, "appear", false); });
      }
    },

    refresh: () => refresh(),

    anchor: (c) => anchors.get(c.id) ?? null,

    async actionStart(actor, ability) {
      const s = stateOf(actor);
      if (actor.side === "hero") {
        setClass(actor, "acting", true);
        s.acting = true;
        const from = s.x;
        cancelTweens(`${actor.id}:slide`);
        // Petit recul, puis le pas en avant (CSS hero-lunge et .acting)
        animate(actor.id, CONFIG.timing.step, (p) => {
          s.lunge = p < 0.4 ? -poses.lungeBack * (p / 0.4) : -poses.lungeBack * (1 - (p - 0.4) / 0.6);
          s.x = from + (poses.actingStep - from) * easeOut(p);
        }, () => { s.lunge = 0; s.x = poses.actingStep; });
        await wait(CONFIG.timing.step);
      } else {
        setClass(actor, "blink", true);
        animate(actor.id, CONFIG.timing.blink, (p) => {
          s.brightness = (p < 0.25 || (p >= 0.5 && p < 0.75)) ? 2.6 : 1;
        }, () => { s.brightness = 1; setClass(actor, "blink", false); });
        await wait(CONFIG.timing.blink);
      }
      if (ability.kind !== "physical") {
        setClass(actor, "casting", true);
        animate(actor.id, CONFIG.timing.cast, (p) => { s.glow = Math.sin(Math.PI * p); },
          () => { s.glow = 0; setClass(actor, "casting", false); });
        await wait(CONFIG.timing.cast);
      }
    },

    stepBack(actor) {
      if (actor.side !== "hero" || !states.has(actor.id)) return;
      setClass(actor, "acting", false);
      const s = stateOf(actor);
      s.lunge = 0;
      s.acting = false;
      const from = s.x;
      const target = restingX(actor);
      cancelTweens(`${actor.id}:slide`);
      animate(`${actor.id}:slide`, CONFIG.timing.slide, (p) => { s.x = from + (target - from) * easeOut(p); });
    },

    hit(target, effect) {
      if (effect.type !== "damage") return;
      const s = stateOf(target);
      pulse(anchors.get(target.id) ?? null, "damaged", CONFIG.timing.hit);
      const hero = target.side === "hero";
      animate(`${target.id}:hit`, CONFIG.timing.hit, (p) => {
        s.jolt = -poses.shake * Math.sin(2 * Math.PI * p);
        s.recoil = hero ? -poses.lungeBack * Math.sin(Math.PI * p) : 0;
        s.tint.copy(DAMAGE_TINT);
        s.tintMix = p < 1 ? 0.45 : 0;
        s.brightness = p < 1 ? 1.4 : 1;
      }, () => { s.jolt = 0; s.recoil = 0; s.tintMix = 0; s.brightness = s.ko ? KO_BRIGHTNESS : 1; });
    },

    quake() {
      pulse(container, "quake", CONFIG.timing.hit);
    },

    defeated(enemy) {
      const s = stateOf(enemy);
      setClass(enemy, "defeated", true);
      s.breathing = false;
      const height = actorOf(enemy)?.height ?? 0;
      animate(enemy.id, CONFIG.timing.defeatedPose, (p) => {
        const q = easeInOut(p);
        s.rotation = -(poses.defeatedTilt * Math.PI / 180) * q;
        s.y = -poses.defeatedSink * height * q;
        s.gray = DEFEATED_GRAY * q;
        s.brightness = 1 - (1 - KO_BRIGHTNESS) * q;
      });
    },

    async kill(enemies) {
      for (const enemy of enemies) {
        const s = stateOf(enemy);
        setClass(enemy, "dying", true);
        s.breathing = false;
        animate(enemy.id, CONFIG.timing.death, (p) => {
          const toward = Math.min(1, p / 0.3);
          s.tint.copy(DEATH_TINT);
          s.tintMix = 0.7 * toward;
          const fade = p <= 0.3 ? 0 : (p - 0.3) / 0.7;
          s.brightness = 1.3 - 0.7 * fade;
          s.opacity = 1 - fade;
          s.clipTop = fade;
        });
      }
      await wait(CONFIG.timing.death);
      for (const enemy of enemies) {
        const s = stateOf(enemy);
        s.visible = false;
        setClass(enemy, "dead", true);
      }
      stage.requestRedraw();
    },

    async flee() {
      const info = stage.measure();
      const distance = info.deviceWidth / Math.max(1, info.spritePixel); // toute la largeur de l'écran : hors champ à coup sûr
      for (const s of states.values()) {
        if (s.combatant.side !== "hero") continue;
        setClass(s.combatant, "fleeing", true);
        const from = s.x;
        cancelTweens(`${s.combatant.id}:slide`);
        animate(s.combatant.id, CONFIG.timing.fleeSlide, (p) => { s.x = from - distance * easeIn(p); });
      }
      await wait(CONFIG.timing.flee);
    },

    victory(party) {
      for (const hero of party) {
        const s = states.get(hero.id);
        if (!s || s.ko) continue;
        setClass(hero, "victory", true);
        animate(hero.id, CONFIG.timing.victoryHop * 4, (p) => {
          s.hop = poses.victoryHop * Math.sin(Math.PI * ((p * 4) % 1));
        }, () => { s.hop = 0; });
      }
    },

    async spare(enemy) {
      const s = stateOf(enemy);
      setClass(enemy, "defeated", false);
      const start = { rotation: s.rotation, y: s.y, gray: s.gray, brightness: s.brightness };
      animate(enemy.id, CONFIG.timing.defeatedPose, (p) => {
        const q = easeInOut(p);
        s.rotation = start.rotation * (1 - q);
        s.y = start.y * (1 - q);
        s.gray = start.gray * (1 - q);
        s.brightness = start.brightness + (1 - start.brightness) * q;
      }, () => { s.breathing = true; });
      setClass(enemy, "casting", true);
      animate(`${enemy.id}:glow`, CONFIG.timing.cast, (p) => { s.glow = Math.sin(Math.PI * p); },
        () => { s.glow = 0; setClass(enemy, "casting", false); });
      await wait(CONFIG.timing.cast);
    },

    measure: () => stage.measure(),

    dispose() {
      stopCounter?.();
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncSafeArea);
      stage.dispose();
      container.remove();
      layer.remove();
      document.body.classList.remove(BODY_CLASS);
      if (options.expose) Reflect.deleteProperty(window, "battleStage");
    },
  };

  if (options.expose) Object.assign(window, { battleStage }); // mesures du bot, en local seulement
  return battleStage;
}
