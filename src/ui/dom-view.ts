// dom-view.ts - L'affichage du jeu : l'implémentation de GameView (src/game-view.ts) sur la page index.html
//
// Assemble les fenêtres et menus (view.ts), le dialogue (dialog.ts), le menu de combat (battle-menu.ts), les bruitages,
// la musique, les contrôles et la scène (stage.ts) : les combattants et leurs animations. C'est le seul endroit qui
// relie la logique à la page. Les sons sont joués ici, au même rang quelle que soit la scène.

import { CONFIG } from "../config.ts";
import { ATTACK, GameState } from "../data/game-data.ts";
import type { GameView } from "../game-view.ts";
import type { Hero } from "../party/heroes.ts";
import { Input } from "../input/input.ts";
import { Sfx } from "../audio/sfx.ts";
import { Music } from "../audio/music.ts";
import { Dialog } from "./dialog.ts";
import { Menu } from "./battle-menu.ts";
import { pickOption } from "./pick-option.ts";
import { createDomStage, type Stage } from "./stage.ts";
import {
  $, wait, pulse, showScreen, setSceneTint, renderPartyWindow, renderEnemyList, renderMenu, updateBattleUI, updateAtbUI,
  onBattleUiUpdated, showBanner, hideBanner, showMessage, effectVisual, effectSound, popupText, popupClasses, spawnPopup, spawnFx,
} from "./view.ts";

// Branche les contrôles de la page, une fois, puis rend la vue
export function createDomView(): GameView {
  wirePage();
  const stage: Stage = createDomStage();
  onBattleUiUpdated(() => stage.refresh());

  // Fenêtres du bas au repos : liste des ennemis vide, lignes du groupe, menu fermé
  function renderHud(party: Hero[]) {
    $("#enemy-list").replaceChildren();
    renderPartyWindow(party);
    renderMenu(Menu);
  }

  return {
    // — Écrans et histoire —

    async showTitle({ startLabel, canRetry, canContinue }) {
      showScreen("intro");
      $("#start-btn").textContent = startLabel;
      $("#retry-btn").hidden = !canRetry;
      $("#continue-btn").hidden = !canContinue;
      const buttons = [...document.querySelectorAll<HTMLElement>(".title-option")].filter(button => !button.hidden);
      const chosen = buttons[await pickOption(buttons)];
      if (chosen.id === "retry-btn") return "retry";
      if (chosen.id === "continue-btn") return "continue";
      return "start";
    },

    async showChapter(chapter, party) {
      setSceneTint(chapter);
      await stage.showIdle(party, chapter);
      renderHud(party);
      showScreen("game");
    },

    music(id) {
      if (id === null) Music.stop();
      else Music.play(id);
    },

    tell: (telling) => Dialog.show(telling),
    ask: (question) => Dialog.choose(question),
    refresh: updateBattleUI,

    celebrate(party) {
      Sfx.play("victory");
      stage.victory(party);
    },

    async showDefeat(telling) {
      Sfx.play("gameOver");
      document.body.classList.add("game-over");
      await Dialog.show(telling);
      document.body.classList.remove("game-over");
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

    animatePowerReturn() { Sfx.play("memory"); }, // l'animation viendra avec MAE-30

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
      return () => { running = false; };
    },

    async startBattle(state) {
      await stage.showIdle(state.heroes, state.chapter ?? GameState.currentChapter);
      renderHud(state.heroes);
      stage.showBattle(state);
      renderEnemyList(state.enemies);
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
  // Un clic dans la fenêtre de dialogue vaut « Valider », sauf pendant un choix (il faut cliquer une option)
  $("#dialog").addEventListener("click", () => {
    if ($("#dialog-choices").hidden) Input.emit("confirm");
  });
  $("#target-hint").addEventListener("click", () => Menu.back());

  const soundButton = $("#sound-btn");
  const syncSound = () => soundButton.classList.toggle("off", !Sfx.enabled);
  soundButton.addEventListener("click", () => { Sfx.toggle(); Music.syncSound(); syncSound(); });
  syncSound();

  // La musique ne peut démarrer qu'après une première interaction (règle des navigateurs)
  const unlockMusic = () => Music.unlock();
  for (const type of ["pointerdown", "keydown"]) document.addEventListener(type, unlockMusic, { capture: true, once: true });
}
