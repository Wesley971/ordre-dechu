// main.ts - Point d'entrée : branche les contrôles de la page et lance l'écran titre

import { Input } from "./input/input.ts";
import { Sfx } from "./audio/sfx.ts";
import { Menu } from "./battle/battle-menu.ts";
import { backToTitle } from "./story/game-flow.ts";
import { $ } from "./ui/view.ts";

document.addEventListener("DOMContentLoaded", () => {
  // Un clic dans la fenêtre de dialogue vaut « Valider », sauf pendant un choix (il faut cliquer une option)
  $("#dialog").addEventListener("click", () => {
    if ($("#dialog-choices").hidden) Input.emit("confirm");
  });
  $("#target-hint").addEventListener("click", () => Menu.back());

  const soundButton = $("#sound-btn");
  const syncSound = () => soundButton.classList.toggle("off", !Sfx.enabled);
  soundButton.addEventListener("click", () => { Sfx.toggle(); syncSound(); });
  syncSound();

  backToTitle({ startLabel: "Nouvelle partie" });
});
