// popup-motion.test.ts - Le mouvement des chiffres du combat (MAE-99), sans DOM
import { describe, expect, it } from "vitest";
import css from "../styles/style.css?raw";
import { CONFIG } from "../config.ts";
import { blowDirection, MISS_DRIFT, nudgeInto, POPUP_STACK, popupDrift, SCREEN_EDGE, stackOffsets } from "../ui/popup-motion.ts";

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

  it("un « Raté » glisse dans le sens du coup : vers la gauche sur un héros, vers la droite sur un ennemi ; rien d'autre ne glisse", () => {
    expect(blowDirection("hero")).toBe(-1);
    expect(blowDirection("enemy")).toBe(1);
    expect(popupDrift("hero", true)).toBe(-MISS_DRIFT);
    expect(popupDrift("enemy", true)).toBe(MISS_DRIFT);
    expect(popupDrift("hero", false)).toBe(0);
    expect(popupDrift("enemy", false)).toBe(0);
    expect(rule(".popup")).toMatch(/--drift:\s*0px/); // la valeur par défaut, que spawnPopup remplace
  });

  it("pile d'une cible : le plus récent reste à sa place, chaque plus ancien passe au-dessus de ceux nés après lui", () => {
    expect(stackOffsets([])).toEqual([]);
    expect(stackOffsets([32])).toEqual([0]);
    // Un critique (zoomé, 59 px) vient de naître sous un dégât (32 px), lui-même sous une Garde (22 px)
    expect(stackOffsets([59, 32, 22], 2)).toEqual([0, 61, 95]);
    expect(POPUP_STACK).toBe(3);
  });

  it("pile d'une cible, une fois en place : deux chiffres empilés ne se recouvrent pas pendant leur montée", () => {
    // Placés par leur bas, ils montent au même rythme (rise × e(t), e croissante) ; le plus ancien, né `age` plus tôt,
    // est plus avancé dans sa montée. Son bas reste au-dessus du haut du plus récent. Le modèle ne couvre pas les
    // 0,12 s où le plus ancien glisse à sa place : en vrai combat, c'est tools/popup-check.mjs du labo qui le mesure
    const ease = (t: number) => 1 - (1 - Math.min(1, t)) ** 3;
    const rise = 40, [newer, older] = [32, 22], [, lift] = stackOffsets([newer, older]);
    for (const age of [0.05, 0.3, 0.8]) {
      for (let t = 0; t <= 1 - age; t += 0.05) {
        const newerTop = -newer - rise * ease(t);
        const olderBottom = -lift - rise * ease(t + age);
        expect(olderBottom).toBeLessThan(newerTop);
      }
    }
  });

  it("recadrage : un chiffre qui déborde revient dans l'écran, un chiffre trop large se cale à gauche", () => {
    expect(nudgeInto(10, 60, 4, 386)).toBe(0);
    expect(nudgeInto(-13, 34, 4, 386)).toBe(17);  // un « Raté » d'Elwen, au bord gauche, glissement compris
    expect(nudgeInto(350, 400, 4, 386)).toBe(-14);
    expect(nudgeInto(-10, 500, 4, 386)).toBe(14);
    expect(SCREEN_EDGE).toBeGreaterThan(0);
  });
});
