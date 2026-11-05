// battle-damage.test.ts - Règles des dégâts et des critiques (MAE-22)
//
// Tirages d'une attaque physique, dans l'ordre : raté, critique, variation. Une attaque magique : variation seule.
// Une variation de 0,5 laisse la valeur exacte. Les multiplicateurs viennent de CONFIG : un réglage d'équilibrage
// ne casse pas ces tests, seule une règle cassée le fait.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIG } from "../config.ts";
import { ATTACK, ENEMY_SKILLS, GameState, SPELLS } from "../data/game-data.ts";
import { computeEffect } from "../battle/battle.ts";
import { makeEnemy, makeHero, scriptRandom } from "./test-helpers.ts";

const HIT = 0.99;       // au-dessus des seuils de raté et de critique
const NEUTRAL = 0.5;    // variation nulle

// Maelor au niveau 1 : Force 18, soit 36 points de base pour Frapper
const maelor = () => makeHero("maelor");
// Corvin au niveau 1 : Souffle 18, soit 36 points de plus que la puissance du souffle
const corvin = () => makeHero("corvin");
const sankri = () => makeEnemy("sankri"); // Défense 4, Résistance 4

function expectDamage(effect: ReturnType<typeof computeEffect>, amount: number) {
  expect(effect).toMatchObject({ type: "damage", amount });
}

beforeEach(() => { GameState.reset(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("dégâts physiques", () => {
  it("valent deux fois la Force, multipliés par la puissance, moins la Défense", () => {
    scriptRandom(HIT, HIT, NEUTRAL);
    expectDamage(computeEffect(maelor(), ATTACK, sankri()), 36 - 4);
  });

  it("suivent la puissance de la capacité", () => {
    scriptRandom(HIT, HIT, NEUTRAL);
    expectDamage(computeEffect(maelor(), SPELLS.whirlwind, sankri()), Math.round(36 * SPELLS.whirlwind.power - 4));
  });

  it("ignorent la Défense quand la capacité la perce", () => {
    scriptRandom(HIT, HIT, NEUTRAL);
    expectDamage(computeEffect(maelor(), SPELLS.fallenBlade, makeEnemy("sankri", { def: 30 })), 36 * 2);
  });

  it("sont réduits par la Garde de la cible", () => {
    scriptRandom(HIT, HIT, NEUTRAL);
    const target = sankri();
    target.defending = true;
    expectDamage(computeEffect(maelor(), ATTACK, target), Math.round(32 * CONFIG.damage.defendMultiplier));
  });

  it("varient de la marge prévue autour de la valeur de base", () => {
    const { variance } = CONFIG.damage;
    scriptRandom(HIT, HIT, 0);
    expectDamage(computeEffect(maelor(), ATTACK, sankri()), Math.round(36 * (1 - variance) - 4));
    vi.restoreAllMocks();
    scriptRandom(HIT, HIT, 1); // Math.random n'atteint jamais 1 : c'est la limite haute
    expectDamage(computeEffect(maelor(), ATTACK, sankri()), Math.round(36 * (1 + variance) - 4));
  });

  it("valent au moins 1, même contre une Défense écrasante", () => {
    scriptRandom(HIT, HIT, NEUTRAL);
    expectDamage(computeEffect(maelor(), ATTACK, makeEnemy("sankri", { def: 999 })), 1);
  });

  it("peuvent rater : juste sous le seuil oui, au seuil non, et sans autre tirage", () => {
    const { missChance } = CONFIG.damage;
    scriptRandom(missChance - 0.001);
    expect(computeEffect(maelor(), ATTACK, sankri())).toEqual({ type: "miss" });
    vi.restoreAllMocks();
    scriptRandom(missChance, HIT, NEUTRAL);
    expect(computeEffect(maelor(), ATTACK, sankri()).type).toBe("damage");
  });

  it("gagnent le bonus du pouvoir du Cœur pour un héros, pas pour un ennemi", () => {
    GameState.power = "taken";
    scriptRandom(HIT, HIT, NEUTRAL);
    expectDamage(computeEffect(maelor(), ATTACK, sankri()), Math.round(32 * CONFIG.power.bonus));
    vi.restoreAllMocks();
    scriptRandom(HIT, HIT, NEUTRAL);
    const atk = makeEnemy("sankri").atk;
    expectDamage(computeEffect(makeEnemy("sankri"), ATTACK, maelor()), atk * 2 - maelor().def);
  });
});

describe("coups critiques", () => {
  it("se déclenchent juste sous le seuil, pas au seuil", () => {
    const { critChance } = CONFIG.damage;
    scriptRandom(HIT, critChance - 0.001, NEUTRAL);
    expect(computeEffect(maelor(), ATTACK, sankri())).toMatchObject({ crit: true });
    vi.restoreAllMocks();
    scriptRandom(HIT, critChance, NEUTRAL);
    expect(computeEffect(maelor(), ATTACK, sankri())).toMatchObject({ crit: false });
  });

  it("multiplient les dégâts après la Défense", () => {
    scriptRandom(HIT, 0, NEUTRAL);
    expectDamage(computeEffect(maelor(), ATTACK, sankri()), 32 * CONFIG.damage.critMultiplier);
  });

  it("se cumulent avec la Garde", () => {
    scriptRandom(HIT, 0, NEUTRAL);
    const target = sankri();
    target.defending = true;
    const { critMultiplier, defendMultiplier } = CONFIG.damage;
    expectDamage(computeEffect(maelor(), ATTACK, target), Math.round(32 * critMultiplier * defendMultiplier));
  });

  it("n'existent pas en magie : un seul tirage, aucun critique", () => {
    scriptRandom(NEUTRAL);
    const effect = computeEffect(corvin(), SPELLS.fire, sankri());
    expect(effect.crit).toBeUndefined();
    expect(effect.type).toBe("damage");
  });
});

describe("dégâts magiques", () => {
  // Mèche : puissance 28 + Souffle 18 × 2 = 64, moins la Résistance 4 du Sankri
  const BASE = 64 - 4;

  it("valent la puissance plus deux fois le Souffle, moins la Résistance", () => {
    scriptRandom(NEUTRAL);
    expect(computeEffect(corvin(), SPELLS.fire, sankri())).toEqual({ type: "damage", amount: BASE, weak: false });
  });

  it("sont multipliés sur une faiblesse, et le signalent", () => {
    scriptRandom(NEUTRAL);
    const target = makeEnemy("sankri", { elements: { fire: "weak" } });
    expect(computeEffect(corvin(), SPELLS.fire, target)).toEqual({ type: "damage", amount: BASE * CONFIG.damage.weakMultiplier, weak: true });
  });

  it("sont réduits sur une résistance", () => {
    scriptRandom(NEUTRAL);
    const target = makeEnemy("sankri", { elements: { fire: "resist" } });
    expect(computeEffect(corvin(), SPELLS.fire, target)).toEqual({ type: "damage", amount: BASE * CONFIG.damage.resistMultiplier, weak: false });
  });

  it("soignent la cible qui absorbe l'élément", () => {
    scriptRandom(NEUTRAL);
    const target = makeEnemy("sankri", { elements: { fire: "absorb" } });
    expect(computeEffect(corvin(), SPELLS.fire, target)).toEqual({ type: "heal", amount: BASE, absorbed: true });
  });

  it("n'appliquent que l'affinité de leur élément", () => {
    scriptRandom(NEUTRAL);
    const target = makeEnemy("sankri", { elements: { ice: "weak" } });
    expect(computeEffect(corvin(), SPELLS.fire, target)).toMatchObject({ amount: BASE, weak: false });
  });

  it("ignorent la Garde", () => {
    scriptRandom(NEUTRAL);
    const target = sankri();
    target.defending = true;
    expectDamage(computeEffect(corvin(), SPELLS.fire, target), BASE);
  });

  it("valent au moins 1, même contre une Résistance écrasante", () => {
    scriptRandom(NEUTRAL);
    expectDamage(computeEffect(corvin(), SPELLS.fire, makeEnemy("sankri", { res: 999 })), 1);
  });

  it("gagnent le bonus du pouvoir du Cœur, qui ne profite jamais à l'absorption", () => {
    GameState.power = "taken";
    scriptRandom(NEUTRAL);
    expectDamage(computeEffect(corvin(), SPELLS.fire, sankri()), Math.round(BASE * CONFIG.power.bonus));
    vi.restoreAllMocks();
    scriptRandom(NEUTRAL);
    const absorbing = makeEnemy("sankri", { elements: { fire: "absorb" } });
    expect(computeEffect(corvin(), SPELLS.fire, absorbing)).toEqual({ type: "heal", amount: BASE, absorbed: true });
  });

  it("frappent aussi quand un ennemi lance un souffle", () => {
    scriptRandom(NEUTRAL);
    // Nuée de cendre du Dragon : puissance 34 + Souffle 26 × 2 = 86, moins la Résistance 6 de Maelor
    expectDamage(computeEffect(makeEnemy("vahn"), ENEMY_SKILLS.ashCloud, maelor()), 86 - 6);
  });
});
