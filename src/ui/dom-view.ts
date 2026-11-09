// dom-view.ts - L'affichage du jeu : l'implémentation de GameView (src/game-view.ts) sur la page index.html
//
// Assemble les fenêtres et menus (view.ts), le dialogue (dialog.ts), le menu de combat (battle-menu.ts), les bruitages,
// la musique, les contrôles et la scène (stage.ts) : les combattants en DOM, ou dans la scène peinte en 2,5D quand le
// chapitre déclare un décor (MAE-29, src/scene/battle-stage.ts), ou que le mode test en impose un (?decor=, MAE-95).
// C'est le seul endroit qui relie la logique à la page.
// Les sons sont joués ici, au même rang quelle que soit la scène.

import { CONFIG } from "../config.ts";
import { ATTACK, GameState, type Chapter } from "../data/game-data.ts";
import { DECORS, type DecorId } from "../data/decors.ts";
import type { GameView } from "../game-view.ts";
import type { Hero } from "../party/heroes.ts";
import { Sfx } from "../audio/sfx.ts";
import { Music } from "../audio/music.ts";
import { Dialog } from "./dialog.ts";
import { Menu } from "./battle-menu.ts";
import { pickOption } from "./pick-option.ts";
import { createDomStage, embersHtml, overlayHtml, type Stage } from "./stage.ts";
import {
  $, wait, pulse, showScreen, setSceneTint, renderPartyWindow, renderMenu, updateBattleUI, updateAtbUI, setBattleRunning, setBossPanel,
  onBattleUiUpdated, heroFlags, showBanner, hideBanner, showMessage, effectVisual, effectSound, popupText, popupClasses, spawnPopup, spawnFx,
} from "./view.ts";

// Options du mode test (src/dev/test-mode.ts), toutes neutres hors mode test
export interface DomViewOptions {
  decor?: DecorId;   // ?decor=lisiere : ce décor peint pour chaque chapitre, même sans décor déclaré (mode test, MAE-95)
  domOnly?: boolean; // ?rendu=dom : les chapitres avec décor s'affichent quand même en DOM
  counter?: boolean; // ?compteur=1 : images/s à l'écran dans la scène peinte
  expose?: boolean;  // la scène peinte expose ses mesures au bot (window.battleStage)
}

// Branche les contrôles de la page, une fois, puis rend la vue
export function createDomView(options: DomViewOptions = {}): GameView {
  wirePage();
  const domStage = createDomStage();
  let stage: Stage = domStage;
  let painted: { stage: Stage; decorId: DecorId } | null = null;
  let paintedUnavailable = false; // WebGL absent ou chargement raté : affichage DOM pour toute la session
  onBattleUiUpdated(() => stage.refresh());

  function releasePainted() {
    if (!painted) return;
    painted.stage.dispose();
    painted = null;
    stage = domStage; // jamais une scène libérée entre les mains de la vue, même le temps d'un chargement
  }

  // La scène du chapitre : peinte s'il déclare un décor, ou si le mode test en impose un (?decor=, MAE-95), et que
  // la scène se charge ; DOM sinon (MAE-29). Three.js et le décor ne se chargent qu'ici, au début d'un tel chapitre.
  async function selectStage(chapter: Chapter): Promise<Stage> {
    const decorId = options.decor ?? chapter.decor;
    const wantPainted = decorId !== undefined && !options.domOnly && !paintedUnavailable;
    if (wantPainted && painted?.decorId === decorId) return painted.stage;
    releasePainted();
    if (wantPainted) {
      try {
        const { createBattleStage } = await import("../scene/battle-stage.ts");
        const created = await createBattleStage(DECORS[decorId], {
          flagsOf: heroFlags, onPick: (c) => Menu.clickTarget(c), onHover: (c, entering) => Menu.hoverTarget(c, entering), anchorHtml: (c) => embersHtml(c) + overlayHtml(c),
          counter: options.counter, expose: options.expose,
        });
        painted = { stage: created, decorId };
        domStage.dispose(); // plus de sprites DOM derrière la scène peinte
        return created;
      } catch (error) {
        console.warn("Scène peinte indisponible, affichage DOM pour cette partie :", error);
        paintedUnavailable = true;
      }
    }
    return domStage;
  }

  // Pendant les dialogues d'histoire, le groupe se cache (MAE-89) ; il revient au combat, à la victoire (récompenses,
  // montée de niveau, planche G6) et à la défaite. Un chapitre s'ouvre toujours sur un dialogue d'histoire.
  // Titre de la victoire en cours : le dialogue qui le porte est celui des récompenses (il peut ne pas venir, s'il n'y a rien à gagner)
  let rewardsTitle: string | null = null;
  function storyDialog(on: boolean) {
    document.body.classList.toggle("story-dialog", on);
  }

  // Retour à l'écran titre : la mémoire graphique est rendue entre deux parties
  function leaveBattleScreen() {
    storyDialog(false);
    releasePainted();
    stage = domStage;
    showScreen("intro");
  }

  // Interface au repos : lignes du groupe, menu fermé
  function renderHud(party: Hero[]) {
    setBossPanel(null);
    renderPartyWindow(party);
    renderMenu(Menu);
  }

  return {
    // — Écrans et histoire —

    async showTitle({ startLabel, canRetry, canContinue }) {
      // Après une défaite, les choix se posent dans la bande, sur la scène éteinte (planche G7) :
      // l'écran de jeu reste affiché, et la scène n'est libérée qu'une fois le choix fait
      const defeat = canRetry;
      document.body.classList.toggle("defeat-choice", defeat);
      if (defeat) $("#intro-screen").hidden = false;
      else leaveBattleScreen();
      $("#start-btn").textContent = startLabel;
      $("#retry-btn").hidden = !canRetry;
      $("#continue-btn").hidden = !canContinue;
      const buttons = [...document.querySelectorAll<HTMLElement>(".title-option")].filter(button => !button.hidden);
      const chosen = buttons[await pickOption(buttons)];
      if (defeat) {
        document.body.classList.remove("defeat-choice", "game-over");
        $("#dialog").hidden = true;
        hideBanner();
        leaveBattleScreen();
      }
      if (chosen.id === "retry-btn") return "retry";
      if (chosen.id === "continue-btn") return "continue";
      return "start";
    },

    async showChapter(chapter, party) {
      Dialog.reset();
      hideBanner();
      setSceneTint(chapter);
      stage = await selectStage(chapter);
      await stage.showIdle(party, chapter);
      renderHud(party);
      storyDialog(true);
      showScreen("game");
    },

    music(id) {
      if (id === null) Music.stop();
      else Music.play(id);
    },

    async tell(telling) {
      storyDialog(rewardsTitle === null || telling.title !== rewardsTitle);
      rewardsTitle = null;
      await Dialog.show(telling);
      hideBanner(); // l'annonce de la victoire reste le temps des récompenses
    },
    ask(question) {
      storyDialog(true);
      return Dialog.choose(question);
    },
    refresh: updateBattleUI,

    celebrate(party, title) {
      Sfx.play("victory");
      storyDialog(false);
      rewardsTitle = title;
      stage.victory(party);
      showBanner(title, "result");
    },

    async showDefeat(telling) {
      Sfx.play("gameOver");
      storyDialog(false);
      document.body.classList.add("game-over");
      // Le mot « Défaite » est dans le bandeau, pas répété dans la bande (planche G7) ; game-over reste jusqu'au choix (showTitle)
      showBanner(telling.title ?? "", "danger");
      await Dialog.show({ pages: telling.pages }, { hold: true });
    },

    // Épargner : il se relève, apaisé
    async animateSpare(enemy) {
      Sfx.play("heal");
      await stage.spare(enemy);
    },

    // Achever : le héros s'avance et porte le coup de grâce
    async animateFinishingBlow(hero, enemy) {
      await stage.actionStart(hero, ATTACK);
      const anchor = stage.anchor(enemy);
      if (anchor) spawnFx(anchor, "slash");
      Sfx.play("crit");
      stage.quake();
      Sfx.play("enemyDie");
      await stage.kill([enemy]);
      stage.stepBack(hero);
      await wait(CONFIG.timing.step);
    },

    animatePowerReturn() { Sfx.play("memory"); }, // l'animation viendra avec MAE-95

    // — Combat —

    frames(callback) {
      let running = true;
      let last = performance.now();
      const loop = (now: number) => {
        if (!running) return;
        callback(now - last);
        last = now;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      return () => {
        running = false;
        setBattleRunning(false); // la fin du combat : plus de jauge dans le groupe
        updateBattleUI();
      };
    },

    async startBattle(state) {
      Dialog.reset(); // la bande garde la scène en cours : le combat en commence une autre
      storyDialog(false);
      await stage.showIdle(state.heroes, state.chapter ?? GameState.currentChapter);
      renderHud(state.heroes);
      stage.showBattle(state);
      setBattleRunning(true);
      setBossPanel(state.enemies.find(enemy => enemy.boss) ?? null);
      updateBattleUI();

      Sfx.play("encounter");
      stage.appear();
      await pulse($("#flash"), "on", CONFIG.timing.flash);
      const boss = state.enemies.find(e => e.boss);
      const message = state.chapter?.introMessage ?? (boss ? `${boss.name} se dresse devant le groupe !` : "Des ennemis surgissent !");
      await showMessage(message, CONFIG.timing.introMessage);
    },

    heroReady() {
      Sfx.play("ready");
      updateBattleUI();
    },

    requestOrder: (context) => Menu.request(context),
    refreshGauges: updateAtbUI,
    message: (text) => showMessage(text),

    showDefend(hero) {
      Sfx.play("defend");
      const anchor = stage.anchor(hero);
      if (anchor) spawnPopup(anchor, "Garde", "info");
    },

    async actionStart(actor, ability) {
      if (ability !== ATTACK) showBanner(ability.name);
      await stage.actionStart(actor, ability);
    },

    async showEffects(hits, ability) {
      for (const { target, effect } of hits) {
        const anchor = stage.anchor(target);
        if (!anchor) continue;
        spawnFx(anchor, effectVisual(ability));
        Sfx.play(effectSound(effect, ability));
        spawnPopup(anchor, popupText(effect), popupClasses(effect));
        stage.hit(target, effect);
        if (effect.crit) stage.quake();
      }
      updateBattleUI();
      await wait(CONFIG.timing.effect); // le temps de lire les chiffres
    },

    async actionEnd(actor) {
      hideBanner();
      stage.stepBack(actor);
      await wait(CONFIG.timing.step / 2);
    },

    showDefeated: (enemy) => stage.defeated(enemy),

    async killEnemies(enemies) {
      Sfx.play("enemyDie");
      await stage.kill(enemies);
    },

    async animateEscape() {
      Sfx.play("run");
      await showMessage("Le groupe se replie !", CONFIG.timing.escapeMessage);
      await stage.flee();
    },
  };
}

function wirePage() {
  Dialog.wire();
  $("#target-hint").addEventListener("click", () => Menu.back());

  const soundButton = $("#sound-btn");
  const syncSound = () => soundButton.classList.toggle("off", !Sfx.enabled);
  soundButton.addEventListener("click", () => { Sfx.toggle(); Music.syncSound(); syncSound(); });
  syncSound();

  // La musique ne peut démarrer qu'après une première interaction (règle des navigateurs)
  const unlockMusic = () => Music.unlock();
  for (const type of ["pointerdown", "keydown"]) document.addEventListener(type, unlockMusic, { capture: true, once: true });
}
