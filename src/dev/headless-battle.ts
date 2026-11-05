// headless-battle.ts - Contrôle : un combat complet de chaque chapitre, sans navigateur, avec la vue muette (MAE-21)
//
// Lancement : npm run check:battle [-- <graine>] (Node 24 exécute le TypeScript directement : imports en .ts,
// syntaxe effaçable, voir tsconfig.json). Aucune API propre à Node ici, pour rester dans la vérification des types
// du projet : les arguments se lisent sur globalThis, une vérification ratée lève une erreur (Node sort en code 1).
//
// Ce que ça prouve : la logique (battle.ts, heroes.ts, game-data.ts) tourne sans DOM, et une partie peut être
// menée par un programme à travers GameView. Les invariants vérifiés sont ceux du moteur, pas l'équilibrage.

import { CONFIG } from "../config.ts";
import { ATTACK, CHAPTERS, GameState, SPELLS, ITEMS } from "../data/game-data.ts";
import type { Ability, BattleChapter, ItemId, SpellId } from "../data/game-data.ts";
import type { Hero } from "../party/heroes.ts";
import { Battle, runBattle, targetCandidates, isAlive, type Combatant } from "../battle/battle.ts";
import { startAtChapter } from "../story/game-flow.ts";
import type { HeroOrder, OrderContext } from "../game-view.ts";
import { createSilentView, type SilentStrategy } from "./silent-view.ts";

const MAX_FRAMES = 60 * 60 * 10; // dix minutes de combat virtuel : au-delà, le combat ne se termine pas

// — Graine : la même partie se rejoue à l'identique —

// Les arguments de la ligne de commande, lus sans les types de Node : argv est présent sous Node, absent ailleurs
const argv = (globalThis as { process?: { argv?: string[] } }).process?.argv ?? [];
const seed = Number(argv[2] ?? 2026) >>> 0;

// mulberry32 : petit générateur déterministe, largement suffisant pour rejouer une partie
function seededRandom(initial: number) {
  let state = initial;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = seededRandom(seed);

// — Stratégie : un joueur raisonnable, sans hasard propre —

const weakest = (list: Combatant[]) => list.reduce((best, c) => (c.hp < best.hp ? c : best));
const ratio = (c: Combatant) => c.hp / c.maxHp;
const spell = (hero: Hero, id: SpellId) => hero.spells.includes(id) && hero.mp >= SPELLS[id].mp ? SPELLS[id] : null;
const item = (id: ItemId) => (GameState.inventory[id] > 0 ? ITEMS[id] : null);

function order(ability: Ability, targets: Combatant[], itemId: ItemId | null = null): HeroOrder {
  return { kind: "ability", ability, targets, itemId };
}

function heroOrder({ hero }: OrderContext): HeroOrder {
  const foes = targetCandidates(hero, "foe");
  const allies = targetCandidates(hero, "ally");
  const fallen = targetCandidates(hero, "ko-ally");
  const wounded = allies.filter(ally => ratio(ally) < 0.5);
  if (foes.length === 0) return { kind: "defend" };

  // Ranimer d'abord : Liéver, sinon une Larme dorée
  if (fallen.length) {
    const life = spell(hero, "life");
    if (life) return order(life, [fallen[0]]);
    const phoenix = item("phoenix");
    if (phoenix) return order(phoenix, [fallen[0]], "phoenix");
  }
  // Soigner : Aurésor si deux blessés, Nios sinon, Sève en dernier recours
  if (wounded.length) {
    const curePlus = wounded.length >= 2 ? spell(hero, "curePlus") : null;
    if (curePlus) return order(curePlus, allies);
    const cure = spell(hero, "cure");
    if (cure) return order(cure, [weakest(wounded)]);
    const potion = item("potion");
    if (potion && ratio(weakest(wounded)) < 0.3) return order(potion, [weakest(wounded)], "potion");
  }
  // Sans Souffle : un Encens, sinon la garde quand on est blessé
  if (hero.spells.length && hero.mp < 5) {
    const ether = item("ether");
    if (ether) return order(ether, [hero], "ether");
  }
  if (ratio(hero) < 0.25 && !item("potion")) return { kind: "defend" };

  // Attaquer : la faiblesse de l'ennemi, sinon la meilleure technique, sinon Frapper
  const target = weakest(foes);
  const weakTo = (element: "fire" | "ice" | "thunder") => target.elements?.[element] === "weak";
  const absorbs = (element: "fire" | "ice" | "thunder") => target.elements?.[element] === "absorb";
  const thunder = spell(hero, "thunder"), ice = spell(hero, "ice"), fire = spell(hero, "fire"), blaze = spell(hero, "blaze");
  if (thunder && weakTo("thunder")) return order(thunder, [target]);
  if (ice && weakTo("ice")) return order(ice, [target]);
  if (blaze && foes.length >= 2 && !absorbs("fire")) return order(blaze, foes);
  if (fire && !absorbs("fire") && hero.mp >= 12) return order(fire, [target]);
  const whirlwind = spell(hero, "whirlwind"), fallenBlade = spell(hero, "fallenBlade");
  if (whirlwind && foes.length >= 2) return order(whirlwind, foes);
  if (fallenBlade && target.hp > 60) return order(fallenBlade, [target]);
  return order(ATTACK, [target]);
}

const strategy: SilentStrategy = {
  order: heroOrder,
  choose: (question) => question.options[0].id, // sans objet pendant un combat : aucune question n'y est posée
};

// — Contrôles —

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(`Contrôle raté : ${message}`);
}

function checkState(chapter: BattleChapter, actions: number) {
  for (const hero of GameState.party) {
    check(hero.hp >= 0 && hero.hp <= hero.maxHp, `${hero.name} : PV ${hero.hp}/${hero.maxHp}`);
    check(hero.mp >= 0 && hero.mp <= hero.maxMp, `${hero.name} : PS ${hero.mp}/${hero.maxMp}`);
  }
  for (const enemy of Battle.enemies) check(enemy.hp >= 0, `${enemy.name} : PV ${enemy.hp}`);
  for (const [id, quantity] of Object.entries(GameState.inventory)) check(quantity >= 0, `inventaire ${id} = ${quantity}`);
  check(actions > 0, `${chapter.title} : aucune action jouée`);
  check(Battle.over && Battle.order === null && Battle.actionQueue.length === 0, `${chapter.title} : le combat n'est pas proprement terminé`);
}

async function playChapter(index: number, chapter: BattleChapter) {
  GameState.reset();
  startAtChapter(index);
  const view = createSilentView(strategy);
  const started = Date.now();
  let frames = 0;
  const guard = setInterval(() => {
    if (view.frameCount > MAX_FRAMES) throw new Error(`${chapter.title} : combat sans fin après ${MAX_FRAMES} images`);
  }, 200);

  try {
    const result = await runBattle(view, chapter);
    frames = view.frameCount;
    checkState(chapter, Battle.actionsDone);
    // L'horloge doit être arrêtée : plus aucune image après la fin
    await new Promise(resolve => setTimeout(resolve, 20));
    check(view.frameCount === frames, `${chapter.title} : l'horloge tourne encore après le combat`);

    const party = GameState.party.map(hero => `${hero.name} ${hero.hp}/${hero.maxHp} PV, ${hero.mp} PS${isAlive(hero) ? "" : " (éteint)"}`).join(" · ");
    const seconds = (frames * (1000 / 60) / 1000).toFixed(0);
    console.log(`${chapter.title.padEnd(32)} ${result.padEnd(8)} ${String(Battle.actionsDone).padStart(3)} actions  ${seconds.padStart(3)} s de combat  ${Date.now() - started} ms réels`);
    console.log(`  ${party}`);
    return result;
  } finally {
    clearInterval(guard);
  }
}

async function main() {
  console.log(`Combats sans affichage, graine ${seed}, mode ATB « ${CONFIG.atb.mode} »`);
  const results: string[] = [];
  for (const [index, chapter] of CHAPTERS.entries()) {
    if (chapter.rest) continue;
    results.push(await playChapter(index, chapter));
  }
  check(results.some(result => result === "victory"), "aucune victoire sur l'ensemble des chapitres");
  console.log("Tous les combats se sont joués jusqu'au bout sans DOM.");
}

await main();
