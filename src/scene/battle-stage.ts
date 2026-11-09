// battle-stage.ts - La scène peinte en 2,5D comme scène de combat (MAE-29) : l'implémentation de Stage (src/ui/stage.ts)
//
// Le canvas couvre tout l'écran, derrière l'interface ; la peinture est cadrée dans le rectangle de #battle-scene,
// au-dessus des fenêtres du bas (zone de cadrage, framing.ts). Sur chaque combattant, une « ancre » DOM suit son
// sprite à l'écran : elle reçoit les chiffres, effets, main de ciblage et bouclier (dom-view.ts, style.css), elle
// porte les mêmes classes d'état que les sprites DOM, et un toucher dessus vise le combattant.
// Les combattants s'animent comme dans la scène DOM, avec les mêmes images (src/ui/animated-sprite.ts, MAE-30) :
// chaque pixel vient du PNG, chaque déplacement se fait par pixels de sprite entiers (actors.ts). Ici, les couleurs
// (teinte, éclat, gris, opacité, lueur) et les glissements (pas en avant, repli).
// Mouvement réduit : la scène ne se redessine que sur demande, chaque geste prend directement sa pose finale.

import { Color } from "three";
import { CONFIG } from "../config.ts";
import type { Decor } from "../data/decors.ts";
import type { Hero } from "../party/heroes.ts";
import type { Combatant } from "../battle/battle.ts";
import { createAnimatedSprite, type AnimatedSprite } from "../ui/animated-sprite.ts";
import { shadeColor, type BaseName } from "../ui/sprite-motion.ts";
import { enemyPhase, facingOf, showPose, type Stage } from "../ui/stage.ts";
import { followHero } from "../ui/hero-pose.ts";
import { preloadImages, type ActorDef, type ActorsView } from "./actors.ts";
import { actorDefs, castExtent, enemyMember, heroMember, type CastMember } from "./cast.ts";
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
const DEFEATED_BRIGHTNESS = 0.55;          // vaincu mais pas mort : grayscale(0.5) brightness(0.55) des sprites DOM
const DEFEATED_GRAY = 0.5;

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const easeIn = (p: number) => p * p;
const easeOut = (p: number) => 1 - (1 - p) * (1 - p);
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p));

// État d'un combattant dans la scène : ses couleurs et sa place ; la pose du corps vient de son image animée
interface ActorState {
  combatant: Combatant;
  x: number;                         // place, en pixels de sprite (pas en avant, repli) ; arrondie à l'affichage
  brightness: number; gray: number; tintMix: number; tint: Color; opacity: number; glow: number;
  visible: boolean;
  acting: boolean;                   // en plein pas en avant : refresh() ne le rappelle pas à sa place
  away: boolean;                     // sorti de scène (repli) : refresh() ne le ramène pas
  celebrating: boolean;              // victoire : debout, même en danger (followHero, MAE-94)
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
  const sprites = new Map<string, AnimatedSprite>(); // images animées, gardées d'une distribution à l'autre
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

  // — Images animées (MAE-30) : une par membre de la distribution, prêtes avant de poser les acteurs —

  // Les sprites gardés reprennent leur pose de départ (comme la scène DOM, qui les recrée) ; ceux qui ne jouent plus sont libérés
  async function prepareSprites(list: CastMember[], initial: (member: CastMember) => BaseName) {
    for (const [id, sprite] of sprites) {
      const member = list.find((candidate) => candidate.id === id);
      if (member) { sprite.setBase(initial(member)); continue; }
      sprite.dispose();
      sprites.delete(id);
    }
    const enemies = list.filter((member) => member.side === "enemy");
    const created = list.filter((member) => !sprites.has(member.id)).map((member) => {
      const sprite = createAnimatedSprite({
        url: member.image, rig: member.rig, height: member.height, facing: member.side === "hero" ? 1 : -1,
        phase: member.side === "enemy" ? enemyPhase(enemies.indexOf(member)) : 0, // le rang de l'ennemi, comme en DOM
        initial: initial(member),
        // La pose a changé : la texture repart vers la carte graphique, et la scène se redessine (mouvement réduit compris)
        onPose: () => {
          actors?.get(member.id)?.redrawn();
          const anchor = anchors.get(member.id);
          if (anchor) showPose(anchor, sprite);
          stage.requestRedraw();
        },
      });
      sprites.set(member.id, sprite);
      return sprite.ready;
    });
    await Promise.all(created);
  }

  function framesOf(): Map<string, ActorDef["frame"]> {
    return new Map([...sprites].map(([id, sprite]) => [id, { canvas: sprite.canvas, layout: sprite.layout }]));
  }

  const spriteOf = (c: Combatant) => sprites.get(c.id) ?? null;

  // — Poses : composées à chaque image à partir des états, des tweens de couleur et des images animées —

  function stateOf(c: Combatant) {
    const state = states.get(c.id);
    if (!state) throw new Error(`Scène peinte : ${c.name} n'est pas en scène`);
    return state;
  }

  function freshState(c: Combatant): ActorState {
    return {
      combatant: c, x: 0, brightness: 1, gray: 0, tintMix: 0, tint: new Color("#ffffff"), opacity: 1, glow: 0,
      visible: true, acting: false, away: false, celebrating: false,
    };
  }

  function animate(id: string, duration: number, step: (progress: number) => void, onEnd?: () => void) {
    tweens.push({ id, start: null, duration, step, onEnd });
    stage.requestRedraw();
  }

  function cancelTweens(id: string) {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].id === id) tweens.splice(i, 1);
  }

  // Glisse un combattant jusqu'à x (pixels de sprite) ; l'affichage l'arrondit au pixel de sprite (actors.ts)
  function slideTo(s: ActorState, target: number, duration: number, ease: (p: number) => number) {
    const id = `${s.combatant.id}:slide`;
    cancelTweens(id);
    const from = s.x;
    if (from === target) return;
    animate(id, duration, (p) => { s.x = from + (target - from) * ease(p); });
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
      const sprite = sprites.get(actor.id);
      if (!s || !sprite) continue;
      const motion = sprite.pose();
      const shade = shadeColor(motion.shade); // héros éteint : gris et assombri, une couleur (MAE-30)
      const { pose } = actor;
      pose.offsetX = Math.round(s.x) + motion.dx * facingOf(s.combatant);
      pose.anchorX = Math.round(s.x); // l'ancre suit le glissement, pas le recul ni le saut (comme .sprite en DOM)
      pose.offsetY = motion.dy;
      const shadow = sprite.shadow(); // l'ombre suit le héros au sol (MAE-94)
      pose.shadowShift = shadow.shift; // vers la droite de l'écran, comme le canvas (jamais retourné)
      pose.shadowStretch = shadow.stretch;
      pose.brightness = s.brightness * shade.brightness;
      pose.gray = Math.max(s.gray, shade.gray);
      pose.tint.copy(s.tint);
      pose.tintMix = s.tintMix;
      pose.opacity = s.opacity;
      pose.glow = s.glow;
      pose.visible = s.visible;
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
      const sprite = sprites.get(c.id);
      if (sprite) showPose(anchor, sprite); // la pose et l'image affichées : braises, contour du survol (MAE-94)
    }
  }

  function placeAnchors() {
    const info = stage.measure();
    const px = info.spritePixel / info.ratio;
    container.style.setProperty("--scene-px", String(px)); // la secousse (CSS scene-shake) en pixels de sprite
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

  // Le membre de la distribution d'un combattant en scène
  function memberOf(c: Combatant): CastMember {
    return c.side === "hero" ? heroMember(c.id) : { id: c.id, image: c.image, side: "enemy", rig: c.rig, height: c.canvasHeight };
  }

  function setCast(list: Combatant[]) {
    const kept = new Map(states);
    states.clear();
    for (const c of list) states.set(c.id, kept.get(c.id) ?? freshState(c));
    actors = stage.setCast(actorDefs(decor, list.map(memberOf), images, framesOf()), extent);
    buildAnchors();
    refresh();
  }

  function restingX(hero: Hero) {
    return options.flagsOf(hero).active ? poses.activeStep : 0;
  }

  // Poses des héros d'après l'état : éteint, en danger, avancé quand son menu est ouvert
  function refresh() {
    for (const s of states.values()) {
      const c = s.combatant;
      const sprite = spriteOf(c);
      if (c.side !== "hero" || !sprite) continue;
      const flags = options.flagsOf(c);
      if (flags.ko) s.acting = false;
      followHero(sprite, flags, s.acting, s.celebrating);
      // Un héros éteint ne bouge plus, comme dans la scène DOM
      if (!s.acting && !s.away && !flags.ko) slideTo(s, restingX(c), CONFIG.timing.slide, easeOut);
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
      members = [...party.map((hero) => heroMember(hero.id)), ...enemies.map((key, i) => enemyMember(key, i))];
      // Un héros déjà éteint ou en danger quand la scène se construit prend directement sa pose, sans rejouer sa chute
      const initial = (member: CastMember): BaseName => {
        const hero = party.find((candidate) => candidate.id === member.id);
        if (!hero) return "idle";
        const flags = options.flagsOf(hero);
        return flags.ko ? "ko" : flags.critical ? "critical" : "idle";
      };
      [images] = await Promise.all([preloadImages(members.map((member) => member.image)), prepareSprites(members, initial)]);
      extent = castExtent(decor, members, images);
      // Un nouveau chapitre : le groupe sorti de scène (repli) revient directement à sa place
      for (const s of states.values()) {
        cancelTweens(`${s.combatant.id}:slide`);
        s.away = false;
        s.celebrating = false; // la victoire du combat d'avant est finie (comme la scène DOM, qui recrée ses héros)
        s.x = 0;
      }
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
      const sprite = spriteOf(actor);
      if (actor.side === "hero") {
        setClass(actor, "acting", true);
        s.acting = true;
        sprite?.play("attack");
        sprite?.setBase("acting");
        slideTo(s, poses.actingStep, CONFIG.timing.step, easeOut);
        await wait(CONFIG.timing.step);
      } else {
        // L'éclair court dit « il agit », le bond vers les héros fait le geste (décision de Wesley du 08/11/2026)
        setClass(actor, "blink", true);
        sprite?.play("strike");
        animate(actor.id, CONFIG.timing.blink, (p) => { s.brightness = p < 0.25 ? 2.6 : 1; },
          () => { s.brightness = 1; setClass(actor, "blink", false); });
        await wait(CONFIG.timing.blink);
      }
      if (ability.kind !== "physical") {
        setClass(actor, "casting", true);
        sprite?.play("cast");
        animate(actor.id, CONFIG.timing.cast, (p) => { s.glow = Math.sin(Math.PI * p); },
          () => { s.glow = 0; setClass(actor, "casting", false); });
        await wait(CONFIG.timing.cast);
      }
    },

    stepBack(actor) {
      if (actor.side !== "hero" || !states.has(actor.id)) return;
      setClass(actor, "acting", false);
      const s = stateOf(actor);
      s.acting = false;
      const sprite = spriteOf(actor);
      if (sprite) followHero(sprite, options.flagsOf(actor), false, s.celebrating);
      slideTo(s, restingX(actor), CONFIG.timing.slide, easeOut);
    },

    hit(target, effect) {
      if (effect.type !== "damage") return;
      const s = stateOf(target);
      pulse(anchors.get(target.id) ?? null, "damaged", CONFIG.timing.hit);
      spriteOf(target)?.play("hit"); // recul, penché, tremblement : dans l'image animée
      animate(`${target.id}:hit`, CONFIG.timing.hit, (p) => {
        s.tint.copy(DAMAGE_TINT);
        s.tintMix = p < 1 ? 0.45 : 0;
        s.brightness = p < 1 ? 1.4 : 1;
      }, () => { s.tintMix = 0; s.brightness = 1; });
    },

    quake() {
      pulse(container, "quake", CONFIG.timing.hit);
    },

    defeated(enemy) {
      const s = stateOf(enemy);
      setClass(enemy, "defeated", true);
      const sprite = spriteOf(enemy);
      sprite?.play("slump");
      sprite?.setBase("defeated");
      animate(enemy.id, CONFIG.timing.defeatedPose, (p) => {
        const q = easeInOut(p);
        s.gray = DEFEATED_GRAY * q;
        s.brightness = 1 - (1 - DEFEATED_BRIGHTNESS) * q;
      });
    },

    async kill(enemies) {
      for (const enemy of enemies) {
        const s = stateOf(enemy);
        setClass(enemy, "dying", true);
        const sprite = spriteOf(enemy);
        sprite?.play("dissolve"); // les rangées s'effacent depuis le haut : dans l'image animée
        sprite?.setBase("gone");
        animate(enemy.id, CONFIG.timing.death, (p) => {
          const toward = Math.min(1, p / 0.3);
          s.tint.copy(DEATH_TINT);
          s.tintMix = 0.7 * toward;
          const fade = p <= 0.3 ? 0 : (p - 0.3) / 0.7;
          s.brightness = 1.3 - 0.7 * fade;
          s.opacity = 1 - fade;
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
      const distance = Math.ceil(info.deviceWidth / Math.max(1, info.spritePixel)); // toute la largeur de l'écran : hors champ à coup sûr
      for (const s of states.values()) {
        if (s.combatant.side !== "hero") continue;
        setClass(s.combatant, "fleeing", true);
        s.away = true;
        slideTo(s, s.x - distance, CONFIG.timing.fleeSlide, easeIn);
      }
      await wait(CONFIG.timing.flee);
    },

    victory(party) {
      for (const hero of party) {
        if (!states.has(hero.id) || options.flagsOf(hero).ko) continue;
        setClass(hero, "victory", true);
        stateOf(hero).celebrating = true;
        const sprite = spriteOf(hero);
        if (!sprite) continue;
        followHero(sprite, options.flagsOf(hero), false, true); // en danger, il passe debout pour sauter
        sprite.play("victory");
      }
    },

    async spare(enemy) {
      const s = stateOf(enemy);
      setClass(enemy, "defeated", false);
      const sprite = spriteOf(enemy);
      sprite?.play("rise");
      sprite?.setBase("idle");
      const start = { gray: s.gray, brightness: s.brightness };
      animate(enemy.id, CONFIG.timing.defeatedPose, (p) => {
        const q = easeInOut(p);
        s.gray = start.gray * (1 - q);
        s.brightness = start.brightness + (1 - start.brightness) * q;
      });
      setClass(enemy, "casting", true);
      animate(`${enemy.id}:glow`, CONFIG.timing.cast, (p) => { s.glow = Math.sin(Math.PI * p); },
        () => { s.glow = 0; setClass(enemy, "casting", false); });
      await wait(CONFIG.timing.cast);
    },

    measure: () => stage.measure(),

    dispose() {
      stopCounter?.();
      for (const sprite of sprites.values()) sprite.dispose();
      sprites.clear();
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
