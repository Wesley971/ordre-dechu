// battle-stage.ts - La scène peinte en 2,5D comme scène de combat (MAE-29) : l'implémentation de Stage (src/ui/stage.ts)
//
// Le canvas couvre tout l'écran, derrière l'interface ; la peinture est cadrée dans le rectangle de #battle-scene,
// au-dessus des fenêtres du bas (zone de cadrage, framing.ts). Sur chaque combattant, une « ancre » DOM suit son
// sprite à l'écran : elle reçoit les chiffres, la marque ▼ de ciblage et le bouclier (dom-view.ts, style.css), elle
// porte les mêmes classes d'état que les sprites DOM, et un toucher dessus vise le combattant.
// Les combattants s'animent comme dans la scène DOM, avec les mêmes images (src/ui/animated-sprite.ts, MAE-30) :
// chaque pixel vient du PNG, chaque déplacement se fait par pixels de sprite entiers (actors.ts). Ici, les couleurs
// (teinte, éclat, gris, opacité, lueur) et les glissements (pas en avant, repli).
// Mouvement réduit : la scène ne se redessine que sur demande, chaque geste prend directement sa pose finale.

import { Color } from "three";
import { CONFIG } from "../config.ts";
import type { Decor } from "../data/decors.ts";
import type { Hero } from "../party/heroes.ts";
import { isAlive, type Combatant } from "../battle/battle.ts";
import { createAnimatedSprite, type AnimatedSprite } from "../ui/animated-sprite.ts";
import { isReducedMotion } from "../ui/reduced-motion.ts";
import type { BaseName } from "../ui/sprite-motion.ts";
import { createFxLayer } from "../ui/fx-layer.ts";
import { blowFacing, enemyPhase, facingOf, goldBloodOf, playAbilityFx, playAshCloud, playGoldBlood, playGoldStream, playLightRise, showPose, type Stage } from "../ui/stage.ts";
import { followHero } from "../ui/hero-pose.ts";
import { TINTS, type Tint } from "../ui/tints.ts";
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
// Teintes du coup reçu, de la mort et de l'or (l'écho qui se défait, l'éclat de Maelor) : définies avec leur filtre
// CSS de la scène DOM dans src/ui/tints.ts, une seule fois (MAE-31)
const DAMAGE_TINT = new Color(TINTS.hit.color);
const HIT: Tint = TINTS.hit; // la teinte du coup reçu, lue comme une teinte quelconque : gain est facultatif (MAE-98)
const DEATH_TINT = new Color(TINTS.death.color);
const GOLD_TINT = new Color(TINTS.gold.color);
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
  brightness: number; gray: number; tintMix: number; tintGain: number; tint: Color; opacity: number; glow: number;
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
  // Couche des effets (MAE-95, MAE-31), sur la couche des ancres ; un pixel de sprite comme les sprites peints
  const fx = createFxLayer(layer, () => { const info = stage.measure(); return info.spritePixel / info.ratio; });

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
      combatant: c, x: 0, brightness: 1, gray: 0, tintMix: 0, tintGain: 0, tint: new Color("#ffffff"), opacity: 1, glow: 0,
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
    const moving = !isReducedMotion();
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
      const { pose } = actor;
      pose.offsetX = Math.round(s.x) + motion.dx * facingOf(s.combatant);
      pose.anchorX = Math.round(s.x); // l'ancre suit le glissement, pas le recul ni le saut (comme .sprite en DOM)
      pose.offsetY = motion.dy;
      const shadow = sprite.shadow(); // l'ombre suit le héros au sol (MAE-94)
      pose.shadowShift = shadow.shift; // vers la droite de l'écran, comme le canvas (jamais retourné)
      pose.shadowStretch = shadow.stretch;
      pose.brightness = s.brightness;
      pose.gray = s.gray;
      pose.tint.copy(s.tint);
      pose.tintMix = s.tintMix;
      pose.tintGain = s.tintGain;
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
    // Devant l'interface, en haut à droite : posé dans la scène, derrière l'interface, il était caché par la plaque du
    // groupe (MAE-31). Sur téléphone, sous le bandeau du groupe (--party-height) ; sur ordinateur, sous le bouton du son
    // (#sound-btn : 12 px du haut et 44 px de haut, soit 56 px)
    const element = overlay("Mesure en cours…", { position: "fixed", right: "8px", top: "calc(var(--party-height, 56px) + 8px)" });
    document.body.appendChild(element);
    const stopMeasure = startCounter(() => stage.measure(), element);
    stopCounter = () => { stopMeasure(); element.remove(); };
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

    // Les ancres passent déjà devant la couche des effets (style.css) : les chiffres y restent
    popupAnchor: (c) => anchors.get(c.id) ?? null,

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
        const caster = anchors.get(actor.id);
        if (ability.visual === "ash" && actor.side === "enemy" && actor.mouth && caster) {
          const heroes = [...states.values()].filter((h) => h.combatant.side === "hero" && h.visible && isAlive(h.combatant));
          playAshCloud(fx, caster, actor.mouth, heroes.flatMap((h) => anchors.get(h.combatant.id) ?? []));
        }
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

    impact(effect, targets) {
      const shown = targets.flatMap((combatant) => {
        const element = anchors.get(combatant.id), sprite = spriteOf(combatant);
        return element && sprite && states.get(combatant.id)?.visible ? [{ id: combatant.id, element, rows: sprite.shownRows() }] : [];
      });
      playAbilityFx(fx, effect, shown, blowFacing(targets));
    },

    hit(target, effect) {
      if (effect.type !== "damage") return;
      const s = stateOf(target);
      const blood = goldBloodOf(target), element = anchors.get(target.id), sprite = spriteOf(target);
      if (blood && element && sprite && s.visible) playGoldBlood(fx, { id: target.id, element, rows: sprite.shownRows() }, blood, blowFacing([target]));
      pulse(anchors.get(target.id) ?? null, "damaged", CONFIG.timing.hit);
      spriteOf(target)?.play("hit"); // recul, penché, tremblement : dans l'image animée
      animate(`${target.id}:hit`, CONFIG.timing.hit, (p) => {
        s.tint.copy(DAMAGE_TINT);
        s.tintGain = HIT.gain ?? 0;
        s.tintMix = p < 1 ? TINTS.hit.mix : 0;
        s.brightness = p < 1 ? TINTS.hit.brightness : 1;
      }, () => { s.tintMix = 0; s.tintGain = 0; s.brightness = 1; });
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
      const reduced = isReducedMotion();
      const light = enemies.some((enemy) => enemy.vanish === "light");
      for (const enemy of enemies) {
        const s = stateOf(enemy);
        const sprite = spriteOf(enemy);
        if (enemy.vanish === "light") {
          // L'écho se défait en lumière (MAE-95) : il passe en or le premier quart, puis ses rangées s'effacent (image
          // animée) en lâchant des pixels dorés. Mouvement réduit : en or, puis il disparaît d'un coup
          setClass(enemy, "unraveling", true);
          animate(enemy.id, CONFIG.timing.unravel, (p) => {
            const toward = Math.min(1, Math.floor((p / 0.25) * 3) / 3); // trois paliers, comme CSS echo-unravel steps(3)
            s.tint.copy(GOLD_TINT);
            s.tintGain = 0;
            s.tintMix = TINTS.gold.mix * toward;
            s.brightness = 1 + (TINTS.gold.brightness - 1) * toward;
          });
          const anchor = anchors.get(enemy.id);
          if (!reduced && sprite) {
            sprite.play("unravel");
            sprite.setBase("gone");
            if (anchor) playLightRise(fx, anchor, sprite);
          }
          continue;
        }
        setClass(enemy, "dying", true);
        sprite?.play("dissolve"); // les rangées s'effacent depuis le haut : dans l'image animée
        sprite?.setBase("gone");
        animate(enemy.id, CONFIG.timing.death, (p) => {
          const toward = Math.min(1, p / 0.3);
          s.tint.copy(DEATH_TINT);
          s.tintGain = 0;
          s.tintMix = TINTS.death.mix * toward;
          const fade = p <= 0.3 ? 0 : (p - 0.3) / 0.7;
          s.brightness = 1.3 - 0.7 * fade;
          s.opacity = 1 - fade;
        });
      }
      await wait(light ? Math.max(CONFIG.timing.death, CONFIG.timing.unravel) : CONFIG.timing.death);
      for (const enemy of enemies) {
        const s = stateOf(enemy);
        spriteOf(enemy)?.setBase("gone");
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

    powerReturn(hero) {
      const anchor = anchors.get(hero.id);
      if (!anchor || !states.has(hero.id)) return;
      const dragon = [...states.values()].find((e) => e.combatant.side === "enemy" && e.visible);
      const dragonAnchor = dragon ? anchors.get(dragon.combatant.id) : undefined;
      const dragonSprite = dragon ? spriteOf(dragon.combatant) : null;
      const heroRows = spriteOf(hero)?.shownRows() ?? [];
      playGoldStream(fx, { element: anchor, rows: heroRows }, dragonAnchor && dragonSprite ? { element: dragonAnchor, rows: dragonSprite.shownRows() } : null);
      // Éclat doré (comme CSS hero-gild) : l'or monte puis retombe. Mouvement réduit : les transitions sautent à leur
      // fin, l'éclat serait invisible ; il est donc tenu fixe le temps de sa durée
      const s = stateOf(hero);
      if (isReducedMotion()) {
        s.tint.copy(GOLD_TINT);
        s.tintGain = 0;
        s.tintMix = TINTS.gold.mix;
        s.brightness = TINTS.gold.brightness;
        stage.requestRedraw();
        void wait(CONFIG.timing.gild).then(() => { s.tintMix = 0; s.brightness = 1; stage.requestRedraw(); });
        return;
      }
      animate(`${hero.id}:gild`, CONFIG.timing.gild, (p) => {
        // Paliers de CSS hero-gild (steps(4, jump-none) sur chaque moitié) : 0, 1/3, 2/3, 1, puis retour
        const half = (q: number) => Math.min(1, Math.floor(q * 4) / 3);
        const level = p < 0.5 ? half(p * 2) : 1 - half((p - 0.5) * 2);
        s.tint.copy(GOLD_TINT);
        s.tintGain = 0;
        s.tintMix = TINTS.gold.mix * level;
        s.brightness = 1 + (TINTS.gold.brightness - 1) * level;
      }, () => { s.tintMix = 0; s.brightness = 1; });
    },

    measure: () => stage.measure(),

    dispose() {
      fx.dispose();
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
