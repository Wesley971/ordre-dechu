// test-helpers.ts - Hasard scripté et personnages de test, pour les tests Vitest du combat (MAE-22)

import { vi } from "vitest";
import { ENEMIES, HEROES } from "../data/game-data.ts";
import type { EnemyDef, EnemyId } from "../data/game-data.ts";
import { createHero, type Hero } from "../party/heroes.ts";
import type { Enemy } from "../battle/battle.ts";

// Math.random rend ces valeurs, dans l'ordre. Une valeur de trop demandée lève une erreur :
// un tirage ajouté ou déplacé dans le moteur fait donc échouer le test, au lieu de le fausser en silence.
export function scriptRandom(...values: number[]) {
  const queue = [...values];
  return vi.spyOn(Math, "random").mockImplementation(() => {
    const next = queue.shift();
    if (next === undefined) throw new Error("Math.random appelé plus souvent que prévu");
    return next;
  });
}

// Générateur à graine (mulberry32) : la même graine rend toujours la même suite
export function seedRandom(seed: number) {
  let state = seed >>> 0;
  return vi.spyOn(Math, "random").mockImplementation(() => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

export function makeHero(id: string, stats: Partial<Hero> = {}): Hero {
  const def = HEROES.find(hero => hero.id === id);
  if (!def) throw new Error(`Héros inconnu : ${id}`);
  return { ...createHero(def), ...stats };
}

export function makeEnemy(key: EnemyId, stats: Partial<EnemyDef> = {}): Enemy {
  const template: EnemyDef = ENEMIES[key];
  return {
    ...template, ...stats, id: `${key}-0`, side: "enemy",
    hp: template.maxHp, mp: 0, maxMp: 0, atb: 0, state: "charging", defending: false, turns: 0, enraged: false,
  };
}
