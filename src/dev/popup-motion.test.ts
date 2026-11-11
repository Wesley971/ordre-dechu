// popup-motion.test.ts - Le mouvement des chiffres du combat (MAE-99), sans DOM
import { describe, expect, it } from "vitest";
import css from "../styles/style.css?raw";
import { CONFIG } from "../config.ts";
import { blowDirection } from "../ui/popup-motion.ts";

// Le bloc d'une règle @keyframes, lu dans la feuille de style
const keyframes = (name: string) => css.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
// Les déclarations d'une règle, par son sélecteur exact
const rule = (selector: string) => css.match(new RegExp(`\\n${selector.replace(/[.[\]]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("chiffres du combat", () => {
  it("la feuille de style est bien lue", () => {
    expect(css).toContain(".popup {");
    expect(keyframes("popup-rise")).not.toBe("");
    expect(keyframes("popup-fade")).not.toBe("");
  });

  it("l'animation des chiffres dure CONFIG.timing.popup, qui les retire quand elle finit ; 1,2 s au plus (décision de Wesley)", () => {
    expect(CONFIG.timing.popup).toBeLessThanOrEqual(1200); // la borne décidée, pour qui changerait la durée
    const durations = [...rule(".popup").matchAll(/animation:\s*popup-rise\s+([\d.]+)s/g)].map((match) => Number(match[1]) * 1000);
    expect(durations).toEqual([CONFIG.timing.popup]);
    // Le mouvement réduit ne change que le nom de l'animation : même durée
    expect(rule(".popup[data-still]")).toMatch(/animation-name:\s*popup-fade/);
    expect(rule(".popup[data-still]")).not.toMatch(/animation-duration|animation:/);
  });

  it("le chiffre ne bouge que par translate, scale et opacity ; en mouvement réduit, par opacity seulement", () => {
    const properties = (name: string) => new Set([...keyframes(name).matchAll(/([a-z-]+):/g)].map((match) => match[1]));
    expect([...properties("popup-rise")].sort()).toEqual(["opacity", "scale", "translate"]);
    expect([...properties("popup-fade")]).toEqual(["opacity"]);
  });

  it("l'ancien rebond a disparu, et le mouvement réduit n'est plus lu par un @media des chiffres", () => {
    expect(css).not.toContain("popup-bounce");
    expect(css).not.toMatch(/prefers-reduced-motion[^{]*\{\s*\.popup/);
  });

  it("un « Raté » glisse dans le sens du coup : vers la gauche sur un héros, vers la droite sur un ennemi", () => {
    expect(blowDirection("hero")).toBe(-1);
    expect(blowDirection("enemy")).toBe(1);
    expect(rule(".popup.miss")).toMatch(/--drift:\s*calc\(var\(--blow/);
  });
});
