// main.ts - Point d'entrée : mode test, affichage DOM, puis la partie commence à l'écran titre

import { SaveGame } from "./data/save-game.ts";
import { startGame } from "./story/game-flow.ts";
import { createDomView } from "./ui/dom-view.ts";
import { setupTestMode, TestMode } from "./dev/test-mode.ts";

document.addEventListener("DOMContentLoaded", () => {
  setupTestMode(); // local seulement : ?chapitre=N et ?vitesse=X (voir CLAUDE.md)
  SaveGame.enabled = !TestMode.active; // en mode test, la sauvegarde du navigateur n'est ni lue ni écrite (MAE-11)

  // Scène peinte seule, à la place du jeu. Import à la demande : Three.js ne se charge que dans ce cas (MAE-28)
  const previewedDecor = TestMode.scene;
  if (previewedDecor !== null) {
    void import("./dev/scene-preview.ts").then(({ openScenePreview }) => openScenePreview(previewedDecor, TestMode.sceneQuality)).catch(console.error);
    return;
  }

  // En mode test (local), la scène peinte expose ses mesures au bot ; ?rendu=dom la désactive, ?compteur=1 affiche les images/s
  const view = createDomView({ domOnly: TestMode.domOnly, counter: TestMode.counter, expose: TestMode.active });
  startGame(view, { startChapter: TestMode.startChapter, power: TestMode.power, winBattles: TestMode.winBattles });
});
