// main.ts - Point d'entrée : branche les contrôles de la page et lance l'écran titre

import { Input } from "./input/input.ts";
import { Sfx } from "./audio/sfx.ts";
import { Music } from "./audio/music.ts";
import { Menu } from "./battle/battle-menu.ts";
import { backToTitle } from "./story/game-flow.ts";
import { setupTestMode, TestMode } from "./dev/test-mode.ts";
import { $ } from "./ui/view.ts";

document.addEventListener("DOMContentLoaded", () => {
  setupTestMode(); // local seulement : ?chapitre=N et ?vitesse=X (voir CLAUDE.md)

  // Scène peinte seule, à la place du jeu. Import à la demande : Three.js ne se charge que dans ce cas (MAE-28)
  const previewedDecor = TestMode.scene;
  if (previewedDecor !== null) {
    void import("./dev/scene-preview.ts").then(({ openScenePreview }) => openScenePreview(previewedDecor, TestMode.sceneQuality)).catch(console.error);
    return;
  }

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

  backToTitle({ startLabel: "Nouvelle partie" });
});
