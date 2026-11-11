// tints.test.ts - Teintes des combattants, définies une seule fois (MAE-31), sans DOM
import { describe, expect, it } from "vitest";
import palette from "../../docs/character-palette.md?raw";
import { FX_COLORS } from "../ui/battle-fx.ts";
import { applyTints, HIT_CANDIDATES, tintVariables, TINTS, type Tint } from "../ui/tints.ts";

// Tout le code et les styles du jeu, lus comme du texte (vite.config.ts : test.css, sans quoi le CSS serait vide)
const SOURCES = import.meta.glob<string>("../**/*.{ts,css}", { query: "?raw", import: "default", eager: true });
const source = (path: string) => SOURCES[path] ?? "";
const css = source("../styles/style.css");

const functions = (filter: string) => [...filter.matchAll(/([a-z-]+)\(/g)].map((match) => match[1]);

describe("teintes des combattants", () => {
  it("les sources sont bien lues : la feuille de style et le code ne sont pas vides", () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(40);
    for (const text of Object.values(SOURCES)) expect(text.length).toBeGreaterThan(0);
    expect(css).toContain(".sprite.damaged");
  });

  it("chaque variable --tint-* lue par la feuille de style est posée, et chaque variable posée est lue", () => {
    const read = new Set([...css.matchAll(/var\((--tint-[a-z-]+)\)/g)].map((match) => match[1]));
    const set = new Set(tintVariables().map(([name]) => name));
    expect([...read].sort()).toEqual([...set].sort());
  });

  it("applyTints pose chaque variable avec son filtre", () => {
    const posed = new Map<string, string>();
    applyTints({ setProperty: (name, value) => { posed.set(name, value); } });
    expect(posed.get("--tint-gold")).toBe(TINTS.gold.filter);
    expect(posed.get("--tint-gold-rest")).toBe(TINTS.gold.rest);
    expect(posed.get("--tint-death")).toBe(TINTS.death.filter);
    expect(posed.get("--tint-hit")).toBe(TINTS.hit.filter);
    expect(posed.size).toBe(tintVariables().length);
  });

  it("la scène DOM pose les teintes, et la scène peinte et l'aperçu les lisent dans tints.ts", () => {
    // Sans cet appel, les filtres de style.css ne s'appliqueraient plus, sans aucune erreur
    expect(source("../ui/stage.ts")).toContain(`applyTints($("#battle-scene").style)`);
    expect(source("../scene/battle-stage.ts")).toContain("TINTS.");
    expect(source("./animation-preview.ts")).toContain("TINTS.");
  });

  it("aucun filtre de teinte et aucune couleur propre aux teintes n'est écrit ailleurs que dans tints.ts", () => {
    // Un filtre de teinte se reconnaît à sa fonction sepia ; les couleurs de la mort et du coup reçu n'existent que pour elles
    // (l'or des teintes est l'or vif de la palette, écrit aussi dans battle-fx.ts et le Design System)
    for (const [path, text] of Object.entries(SOURCES)) {
      if (path === "../ui/tints.ts") continue;
      expect(text, path).not.toMatch(/sepia\(/);
      expect(text, path).not.toContain(TINTS.death.color);
      expect(text, path).not.toContain(TINTS.hit.color);
    }
  });

  it("le filtre sans effet d'une teinte a les mêmes fonctions, dans le même ordre : l'animation passe par des paliers", () => {
    for (const tint of Object.values<Tint>(TINTS)) {
      if (tint.rest) expect(functions(tint.rest)).toEqual(functions(tint.filter));
    }
  });

  it("l'or des teintes est l'or vif de la palette des personnages", () => {
    expect(palette).toContain(`\`${TINTS.gold.color}\``);
  });

  it("dans la scène peinte, une teinte mêle sa couleur sans la recouvrir, avec un éclat d'au moins 1 (candidates du coup reçu comprises)", () => {
    for (const tint of [...Object.values<Tint>(TINTS), ...HIT_CANDIDATES.map((candidate) => candidate.tint)]) {
      expect(tint.mix).toBeGreaterThan(0);
      expect(tint.mix).toBeLessThan(1);
      if (tint.brightness !== undefined) expect(tint.brightness).toBeGreaterThanOrEqual(1);
    }
  });

  it("teintes candidates du coup reçu (MAE-98) : l'orange actuel d'abord, puis des couleurs de la palette des personnages", () => {
    expect(HIT_CANDIDATES[0].tint).toBe(TINTS.hit);
    expect(HIT_CANDIDATES.length).toBeGreaterThan(1);
    const colors: string[] = Object.values(FX_COLORS);
    for (const { tint } of HIT_CANDIDATES.slice(1)) {
      expect(colors).toContain(tint.color);
      expect(palette).toContain(`\`${tint.color}\``);
    }
  });
});
