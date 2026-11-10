import { defineConfig } from "vitest/config";

// Le jeu est publié sur GitHub Pages sous https://wesley971.github.io/ordre-dechu/
export default defineConfig({
  base: "/ordre-dechu/",
  // Les tests lisent la feuille de style comme du texte (style.css?raw) pour la comparer au code (teintes, MAE-31) :
  // sans ce réglage, Vitest remplace tout fichier CSS par une chaîne vide
  test: { css: true },
});
