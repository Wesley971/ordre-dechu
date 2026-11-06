// eslint.config.js - Règles recommandées, plus celles du CLAUDE.md qu'un outil peut vérifier (MAE-23)
// Le contrôle du « as justifié en commentaire » reste à la relecture : aucune règle standard ne le couvre.

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const SEPARATION = "Logique et affichage séparés (MAE-21) : passer par GameView, src/game-view.ts.";

export default defineConfig(
  { ignores: ["dist/**"] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  {
    // La logique ne touche ni au DOM ni à Three.js, et n'importe de l'affichage que des types
    files: ["src/battle/**", "src/story/**", "src/party/**", "src/data/**"],
    rules: {
      "no-restricted-globals": ["error",
        { name: "document", message: SEPARATION },
        { name: "window", message: SEPARATION },
      ],
      "@typescript-eslint/no-restricted-imports": ["error", {
        patterns: [
          { group: ["three", "three/*"], message: SEPARATION },
          { group: ["**/ui/**", "**/audio/**", "**/scene/**", "**/dev/**"], message: SEPARATION, allowTypeImports: true },
        ],
      }],
      // La règle d'import ne voit pas un import() dynamique
      "no-restricted-syntax": ["error", { selector: "ImportExpression", message: SEPARATION }],
    },
  },
);
