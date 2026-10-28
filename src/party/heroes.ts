// heroes.ts - Création des héros, XP, montées de niveau

import { CONFIG } from "../config.ts";
import { HEROES, SPELLS, ITEMS, GameState } from "../data/game-data.ts";
import type { HeroDef, SpellId, Stats, StatName } from "../data/game-data.ts";
import { isAlive } from "../battle/battle.ts";
import type { CombatState, Enemy } from "../battle/battle.ts";

export interface Hero extends Stats {
  id: string;
  name: string;
  job: string;
  image: string;
  command: string;
  side: "hero";
  level: number;
  xp: number;
  spells: SpellId[];
  atb: number;
  state: CombatState;
  defending: boolean;
  hp: number;
  mp: number;
  // Propres aux ennemis : un héros ne les a jamais, ce qui permet de les lire sur n'importe quel combattant
  boss?: never;
  undead?: never;
  elements?: never;
  rage?: never;
  spareable?: never;
}

// Une entrée par statistique : TypeScript signale celle qui manquerait si Stats change
const STAT_NAMES = Object.values({
  maxHp: "maxHp", maxMp: "maxMp", atk: "atk", def: "def", mag: "mag", res: "res", spd: "spd",
} satisfies { [K in StatName]: K });

export function createHero(def: HeroDef): Hero {
  const stats = statsAtLevel(def, 1);
  return {
    id: def.id, name: def.name, job: def.job, image: def.image, command: def.command,
    side: "hero", level: 1, xp: 0, spells: spellsLearnedBetween(def, 0, 1),
    atb: 0, state: "charging", defending: false,
    ...stats,
    hp: stats.maxHp,
    mp: stats.maxMp,
  };
}

function heroDef(hero: Hero): HeroDef {
  const def = HEROES.find(def => def.id === hero.id);
  if (!def) throw new Error(`Héros inconnu : ${hero.id}`);
  return def;
}

function statsAtLevel(def: HeroDef, level: number): Stats {
  const stats = { ...def.stats };
  for (const stat of STAT_NAMES) {
    stats[stat] = def.stats[stat] + def.growth[stat] * (level - 1);
  }
  return stats;
}

// Souffles appris entre deux niveaux (fromLevel exclu, toLevel inclus)
function spellsLearnedBetween(def: HeroDef, fromLevel: number, toLevel: number) {
  const learned: SpellId[] = [];
  for (let lvl = fromLevel + 1; lvl <= toLevel; lvl++) {
    learned.push(...(def.spells[lvl] || []));
  }
  return learned;
}

function levelForXp(xp: number) {
  const { xpTable } = CONFIG;
  let level = 1;
  while (level < xpTable.length && xp >= xpTable[level]) level++;
  return level;
}

// Ajoute de l'XP ; renvoie { level, learned } si le héros monte de niveau, sinon null
function gainXp(hero: Hero, xp: number) {
  hero.xp += xp;
  const newLevel = levelForXp(hero.xp);
  if (newLevel <= hero.level) return null;

  const def = heroDef(hero);
  const before = { maxHp: hero.maxHp, maxMp: hero.maxMp };
  const learned = spellsLearnedBetween(def, hero.level, newLevel);

  Object.assign(hero, statsAtLevel(def, newLevel));
  hero.hp += hero.maxHp - before.maxHp;
  hero.mp += hero.maxMp - before.maxMp;
  hero.level = newLevel;
  hero.spells.push(...learned);

  return { level: newLevel, learned: learned.map(id => SPELLS[id].name) };
}

// Récompenses de fin de combat : XP pour chaque héros debout, Couronnes et objets pour le groupe
export function grantRewards(enemies: Enemy[]) {
  const xp  = enemies.reduce((sum, e) => sum + e.xp, 0);
  const gil = enemies.reduce((sum, e) => sum + e.gil, 0);
  GameState.gil += gil;

  const drops: string[] = [];
  for (const enemy of enemies) {
    if (enemy.drop && Math.random() < enemy.drop.chance) {
      GameState.inventory[enemy.drop.item] = (GameState.inventory[enemy.drop.item] || 0) + 1;
      drops.push(ITEMS[enemy.drop.item].name);
    }
  }

  const levelUps = [];
  for (const hero of GameState.party.filter(isAlive)) {
    const result = gainXp(hero, xp);
    if (result) levelUps.push({ hero, ...result });
  }

  return { xp, gil, drops, levelUps };
}
export type Rewards = ReturnType<typeof grantRewards>;

// Puits des Anciens : PV/PS au maximum, les K.O. se relèvent
export function restoreParty() {
  for (const hero of GameState.party) {
    hero.hp = hero.maxHp;
    hero.mp = hero.maxMp;
    hero.state = "charging";
  }
}
