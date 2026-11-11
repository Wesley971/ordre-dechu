// tints.test.ts - Teintes des combattants, définies une seule fois (MAE-31), sans DOM
import { describe, expect, it } from "vitest";
import palette from "../../docs/character-palette.md?raw";
import { FX_COLORS } from "../ui/battle-fx.ts";
import { applyTints, LUMA, paintedTint, tintVariables, TINTS, type Tint } from "../ui/tints.ts";

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
    expect(posed.get("--tint-foe-hit")).toBe(TINTS.foeHit.filter); // foeHit : en minuscules à tirets
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
    // Un filtre de teinte se reconnaît à sa fonction sepia ; la couleur de la mort n'existe que pour elle (l'or et la
    // rouille du coup reçu sont des couleurs de la palette, écrites aussi dans battle-fx.ts et le Design System)
    for (const [path, text] of Object.entries(SOURCES)) {
      if (path === "../ui/tints.ts") continue;
      expect(text, path).not.toMatch(/sepia\(/);
      expect(text, path).not.toContain(TINTS.death.color);
    }
  });

  it("le filtre sans effet d'une teinte a les mêmes fonctions, dans le même ordre : l'animation passe par des paliers", () => {
    for (const tint of Object.values<Tint>(TINTS)) {
      if (tint.rest) expect(functions(tint.rest)).toEqual(functions(tint.filter));
    }
  });

  it("l'or des teintes est l'or vif de la palette des personnages, et le coup reçu prend la teinte de la rouille des ennemis", () => {
    expect(TINTS.hit.color).toBe(FX_COLORS.rust);
    expect(palette).toContain(`\`${TINTS.hit.color}\``);
    expect(palette).toContain(`\`${TINTS.gold.color}\``);
  });

  it("dans la scène peinte, une teinte mêle sa couleur sans la recouvrir, avec un éclat d'au moins 1", () => {
    for (const tint of Object.values<Tint>(TINTS)) {
      expect(tint.mix).toBeGreaterThan(0);
      expect(tint.mix).toBeLessThan(1);
      if (tint.brightness !== undefined) expect(tint.brightness).toBeGreaterThanOrEqual(1);
    }
  });

  // Un filtre CSS de teinte, calculé comme le fait Edge : en sRGB, chaque fonction bornée de 0 à 1 (formules de Filter
  // Effects ; mesuré dans Edge le 11/11/2026 sur les 81 couleurs des héros, écart d'au plus 2 sur 255 pour la braise)
  const sepia = (a: number) => [[0.393 + 0.607 * (1 - a), 0.769 - 0.769 * (1 - a), 0.189 - 0.189 * (1 - a)], [0.349 - 0.349 * (1 - a), 0.686 + 0.314 * (1 - a), 0.168 - 0.168 * (1 - a)], [0.272 - 0.272 * (1 - a), 0.534 - 0.534 * (1 - a), 0.131 + 0.869 * (1 - a)]];
  const saturate = (s: number) => [[0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s], [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s], [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]];
  const hueRotate = (degrees: number) => {
    const a = (degrees * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return [[0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
      [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
      [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072]];
  };
  const bounded = (c: number[]) => c.map((v) => Math.max(0, Math.min(1, v)));
  const apply = (m: number[][], c: number[]) => bounded(m.map((row) => row[0] * c[0] + row[1] * c[1] + row[2] * c[2]));
  // brightness, sepia, saturate et hue-rotate, dans l'ordre du filtre ; toute autre fonction fait échouer le test
  function cssFilter(filter: string, rgb: number[]): number[] {
    let c = rgb;
    for (const [, name, value] of filter.matchAll(/([a-z-]+)\(([-\d.]+)(?:deg)?\)/g)) {
      const v = Number(value);
      if (name === "brightness") c = bounded(c.map((x) => x * v));
      else if (name === "sepia") c = apply(sepia(v), c);
      else if (name === "saturate") c = apply(saturate(v), c);
      else if (name === "hue-rotate") c = apply(hueRotate(v), c);
      else throw new Error(`fonction de filtre non calculée : ${name}`);
    }
    return c;
  }
  const PALETTE = [...new Set([...palette.matchAll(/#[0-9a-f]{6}/gi)].map((match) => match[0].toLowerCase()))];
  const luma = (c: number[]) => c.reduce((sum, v, k) => sum + v * LUMA[k], 0);

  // Le coup reçu (MAE-98, décisions de Wesley du 11/11/2026) : la braise pour un héros, l'éclair parchemin pour un ennemi.
  // Seuils : au-dessus de l'écart moyen calculé ici sur toute la palette (braise 6 à 7 sur 255 ; parchemin 23,7, ses
  // réglages ayant été choisis sur les 130 couleurs des ennemis, où l'écart mesuré dans Edge est de 13)
  it.each([
    { name: "hit", label: "braise sombre, sur un héros", tint: TINTS.hit as Tint, limit: 12 },
    { name: "foeHit", label: "éclair parchemin, sur un ennemi", tint: TINTS.foeHit as Tint, limit: 25 },
  ])("coup reçu, $label : sa forme peinte suit son filtre CSS sur les couleurs de la palette, sans assombrir le clair", ({ tint, limit }) => { // as Tint : lues comme des teintes quelconques
    expect(PALETTE.length).toBeGreaterThan(30);
    let total = 0;
    for (const hex of PALETTE) {
      const rgb = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
      const dom = cssFilter(tint.filter, rgb), painted = paintedTint(rgb, tint);
      total += Math.hypot(...dom.map((v, k) => (v - painted[k]) * 255));
      // Un pixel clair reste clair : sa luminosité ne baisse pas de plus d'un dixième sous celle du rendu DOM
      expect(luma(painted), hex).toBeGreaterThan(luma(dom) - 0.1);
    }
    expect(total / PALETTE.length).toBeLessThan(limit);
  });

  it("coup reçu franc en scène DOM : aucune image de combattant n'a de transition de filtre, sauf l'ennemi vaincu qui se grise, puis épargné", () => {
    // Décisions de Wesley du 11/11/2026 (MAE-98) : une transition sur l'image d'un ennemi (0,6 s) étalait son éclair, plus
    // long qu'un coup reçu (0,4 s) ; elle ne reste qu'à l'ennemi vaincu qui se grise, et à l'épargné qui retrouve ses
    // couleurs en se relevant (sparing, posée par la scène DOM le temps du geste) ; le mouvement réduit la leur retire
    const transitions = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selector, body]) => /\.sprite\b/.test(selector) && /transition:(?!\s*none)/.test(body))
      .map(([, selector]) => selector.trim().split("\n").pop()?.trim());
    expect(transitions).toEqual([".sprite.enemy.defeated .sprite-img", ".sprite.enemy.sparing .sprite-img"]);
    expect(css).toMatch(/\.sprite\.enemy\.defeated \.sprite-img,\s*\.sprite\.enemy\.sparing \.sprite-img\s*\{ transition: none; \}/);
    // La scène DOM pose sparing avant de retirer defeated : la transition vaut pour le retour des couleurs
    expect(source("../ui/stage.ts")).toMatch(/void pulse\(a\.element, "sparing", CONFIG\.timing\.defeatedPose\);\s*a\.element\.classList\.remove\("defeated"\);/);
  });

  it("coup reçu : la braise (rouille) pour un héros, l'éclair parchemin pour un ennemi, dans les deux scènes", () => {
    expect(TINTS.foeHit.color).toBe(FX_COLORS.parchment);
    expect(TINTS.foeHit.filter).not.toBe(TINTS.hit.filter);
    expect(css).toContain(".sprite.enemy.damaged .sprite-img { filter: var(--tint-foe-hit); }");
    expect(source("../scene/battle-stage.ts")).toContain('target.side === "hero" ? HERO_HIT : FOE_HIT');
  });

  it("le shader des sprites de la scène peinte a la formule de paintedTint", () => {
    const actors = source("../scene/actors.ts");
    expect(actors).toContain("uniform float uTintGain;");
    expect(actors).toContain(`vec3( ${LUMA.join(", ")} ) ) * uTintGain * hue`);
    expect(source("../scene/battle-stage.ts")).toContain("s.tintGain = tint.gain ?? 0;");
  });
});
