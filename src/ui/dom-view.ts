// dom-view.ts - L'affichage DOM du jeu : l'implémentation de GameView (src/game-view.ts) sur la page index.html
//
// Assemble la scène et les fenêtres (view.ts), le dialogue (dialog.ts), le menu de combat (battle-menu.ts),
// les bruitages, la musique et les contrôles. C'est le seul endroit qui relie la logique à la page.

import { CONFIG } from "../config.ts";
import type { GameView } from "../game-view.ts";
import { Input } from "../input/input.ts";
import { Sfx } from "../audio/sfx.ts";
import { Music } from "../audio/music.ts";
import { Dialog } from "./dialog.ts";
import { Menu } from "./battle-menu.ts";
import { pickOption } from "./pick-option.ts";
import {
  $, wait, showScreen, setSceneTint, renderIdleScene, renderBattle, playBattleIntro, updateBattleUI, updateAtbUI,
  showMessage, showDefend, animateActorStart, animateActorEnd, showEffect, showDefeated, killEnemies, animateEscape,
  victoryPose, animateSpare, animateFinishingBlow,
} from "./view.ts";

// Branche les contrôles de la page, une fois, puis rend la vue
export function createDomView(): GameView {
  wirePage();
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

    showChapter(chapter, party) {
      setSceneTint(chapter);
      renderIdleScene(party);
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
      victoryPose(party);
    },

    async showDefeat(telling) {
      Sfx.play("gameOver");
      document.body.classList.add("game-over");
      await Dialog.show(telling);
      document.body.classList.remove("game-over");
    },

    animateSpare,
    animateFinishingBlow,
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
      renderBattle(state);
      await playBattleIntro(state);
    },

    heroReady() {
      Sfx.play("ready");
      updateBattleUI();
    },

    requestOrder: (context) => Menu.request(context),
    refreshGauges: updateAtbUI,
    message: (text) => showMessage(text),
    showDefend,
    actionStart: animateActorStart,

    async showEffects(hits, ability) {
      for (const { target, effect } of hits) showEffect(target, effect, ability);
      updateBattleUI();
      await wait(CONFIG.timing.effect); // le temps de lire les chiffres
    },

    actionEnd: animateActorEnd,
    showDefeated,
    killEnemies,
    animateEscape,
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
