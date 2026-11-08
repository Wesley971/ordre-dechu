// battle.ts - Moteur de combat : calculs (logique pure) et boucle ATB
//
// Le moteur ne connaît pas l'affichage : il reçoit une vue (GameView, src/game-view.ts) qui dessine, anime et
// demande ses ordres au joueur. Aucun DOM, aucun son, aucune horloge du navigateur ici : la vue fournit les images.

import { CONFIG } from "../config.ts";
import { ATTACK, ENEMY_SKILLS, ENEMIES, GameState } from "../data/game-data.ts";
import type {
  Ability, BattleChapter, ElementName, EnemyAction, EnemyDef, EnemyId, HealAbility, ItemId,
  MagicAbility, PhysicalAbility, TargetType,
} from "../data/game-data.ts";
import type { Hero } from "../party/heroes.ts";
import { noView, type GameView, type HeroOrder, type OrderRequest } from "../game-view.ts";

// charging : la jauge se remplit · ready : héros en attente d'un ordre · queued : action en file · ko : à terre
export type CombatState = "charging" | "ready" | "queued" | "ko";

export interface Enemy extends EnemyDef {
  id: string;
  side: "enemy";
  hp: number;
  mp: number;
  maxMp: number;
  atb: number;
  state: CombatState;
  defending: boolean;
  turns: number;
  enraged: boolean;
}

export type Combatant = Hero | Enemy;

// Résultat d'une action sur une cible ; crit et weak ne concernent que les dégâts
export type Effect = { crit?: boolean; weak?: boolean } & (
  | { type: "miss" }
  | { type: "damage"; amount: number }
  | { type: "heal"; amount: number; absorbed?: boolean }
  | { type: "mp"; amount: number }
  | { type: "revive"; amount: number }
  | { type: "none" }
);

export interface QueuedAction {
  actor: Combatant;
  ability: Ability;
  targets: Combatant[];
  itemId?: ItemId | null;
}

export type BattleResult = "victory" | "defeat" | "escape" | "truce";

const randomItem = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];
export const isAlive    = (combatant: Combatant) => combatant.hp > 0;

// ±variance autour d'une valeur
function vary(value: number) {
  const v = CONFIG.damage.variance;
  return value * (1 - v + Math.random() * 2 * v);
}

// — Logique pure —

function elementMultiplier(target: Combatant, element: ElementName | undefined) {
  const affinity = element && target.elements && target.elements[element];
  if (affinity === "weak")   return CONFIG.damage.weakMultiplier;
  if (affinity === "resist") return CONFIG.damage.resistMultiplier;
  if (affinity === "absorb") return -1;
  return 1;
}

// Pouvoir du Cœur pris : les héros frappent et soignent plus fort (objets exclus, quantité fixe)
const powerBonus = (actor: Combatant) => actor.side === "hero" && GameState.power === "taken" ? CONFIG.power.bonus : 1;

function calcPhysical(attacker: Combatant, target: Combatant, ability: PhysicalAbility): Effect {
  const { missChance, critChance, critMultiplier, defendMultiplier } = CONFIG.damage;
  if (Math.random() < missChance) return { type: "miss" };

  const crit = Math.random() < critChance;
  let damage = (vary(attacker.atk * 2 * ability.power) - (ability.pierce ? 0 : target.def)) * powerBonus(attacker);
  if (crit) damage *= critMultiplier;
  if (target.defending) damage *= defendMultiplier;
  return { type: "damage", amount: Math.max(1, Math.round(damage)), crit };
}

function calcMagic(caster: Combatant, target: Combatant, ability: MagicAbility): Effect {
  const multiplier = elementMultiplier(target, ability.element);
  const base = Math.max(1, vary(ability.power + caster.mag * 2) - target.res);
  const amount = Math.round(base * Math.abs(multiplier));
  if (multiplier < 0) return { type: "heal", amount, absorbed: true }; // pas de bonus : il soignerait l'ennemi
  return { type: "damage", amount: Math.round(amount * powerBonus(caster)), weak: multiplier > 1 };
}

function calcHeal(caster: Combatant, target: Combatant, ability: HealAbility): Effect {
  if (!isAlive(target)) return { type: "none" };
  // Objet : quantité fixe · souffle : puissance + Souffle du lanceur
  const amount = "amount" in ability ? ability.amount : Math.round(vary(ability.power + caster.mag * 2) * powerBonus(caster));
  return { type: "heal", amount };
}

function calcRevive(target: Combatant): Effect {
  if (isAlive(target)) return { type: "none" };
  return { type: "revive", amount: Math.max(1, Math.round(target.maxHp * CONFIG.revivePct)) };
}

export function computeEffect(actor: Combatant, ability: Ability, target: Combatant): Effect {
  switch (ability.kind) {
    case "physical": return calcPhysical(actor, target, ability);
    case "magic":    return calcMagic(actor, target, ability);
    case "heal":     return calcHeal(actor, target, ability);
    case "mp":       return isAlive(target) ? { type: "mp", amount: ability.amount } : { type: "none" };
    case "revive":   return calcRevive(target);
    default:         return { type: "none" };
  }
}

function applyEffect(target: Combatant, effect: Effect) {
  switch (effect.type) {
    case "damage": target.hp = Math.max(0, target.hp - effect.amount); break;
    case "heal":   target.hp = Math.min(target.maxHp, target.hp + effect.amount); break;
    case "mp":     target.mp = Math.min(target.maxMp, target.mp + effect.amount); break;
    case "revive":
      target.hp = effect.amount;
      target.atb = 0;
      target.state = "charging";
      break;
  }
}

// — Ennemis —

function createEnemies(keys: EnemyId[]): Enemy[] {
  const total: Record<string, number> = {}, seen: Record<string, number> = {};
  keys.forEach(key => total[key] = (total[key] || 0) + 1);

  return keys.map((key, i) => {
    seen[key] = (seen[key] || 0) + 1;
    const template = ENEMIES[key];
    const suffix = total[key] > 1 ? " " + "ABCDEF"[seen[key] - 1] : "";
    return {
      ...template, id: `${key}-${i}`, name: template.name + suffix, side: "enemy",
      hp: template.maxHp, mp: 0, maxMp: 0,
      atb: 0, state: "charging", defending: false, turns: 0, enraged: false,
    };
  });
}

function chooseEnemyAction(enemy: Enemy): QueuedAction {
  const pattern = enemy.enraged ? enemy.rage?.pattern : enemy.pattern;
  let choice: EnemyAction = "attack";

  if (pattern) {
    choice = pattern[enemy.turns % pattern.length];
  } else {
    const skill = (enemy.skills || []).find(s => Math.random() < s.chance);
    if (skill) choice = skill.skill;
  }
  enemy.turns++;

  const ability = choice === "attack" ? ATTACK : ENEMY_SKILLS[choice];
  return { actor: enemy, ability, targets: pickTargets(enemy, ability.target) };
}

// — Ciblage —

// relation "foe" : le camp adverse de actor · "ally" : son propre camp
export function groupOf(actor: Combatant, relation: "foe" | "ally"): Combatant[] {
  const heroSide = (actor.side === "hero") === (relation === "ally");
  return heroSide ? Battle.heroes : Battle.enemies;
}

export function targetCandidates(actor: Combatant, targetType: TargetType) {
  if (targetType === "ko-ally") return groupOf(actor, "ally").filter(c => !isAlive(c));
  const relation = targetType.includes("foe") ? "foe" : "ally";
  return groupOf(actor, relation).filter(isAlive);
}

function pickTargets(actor: Combatant, targetType: TargetType) {
  const candidates = targetCandidates(actor, targetType);
  if (targetType.startsWith("all-")) return candidates;
  return candidates.length ? [randomItem(candidates)] : [];
}

// Si la cible est tombée entre le choix et l'action, on vise un autre membre du même camp
function retarget(actor: Combatant, ability: Ability, chosen: Combatant[]) {
  if (ability.target.startsWith("all-")) return targetCandidates(actor, ability.target);
  if (ability.target === "ko-ally") return chosen;

  const alive = chosen.filter(isAlive);
  if (alive.length) return alive;

  const side = chosen[0] && chosen[0].side;
  const pool = (side === "enemy" ? Battle.enemies : Battle.heroes).filter(isAlive);
  return pool.length ? [randomItem(pool)] : [];
}

// — Boucle de combat (ATB) —

export interface BattleState {
  heroes: Hero[];
  enemies: Enemy[];
  chapter: BattleChapter | null;
  readyQueue: Hero[];           // héros dont la jauge est pleine, en attente d'un ordre
  actionQueue: QueuedAction[];  // actions choisies, exécutées une par une
  busy: boolean;                // une action est en cours d'animation
  actionsDone: number;          // actions jouées depuis le début du combat (trêve)
  over: boolean;
  order: { hero: Hero; request: OrderRequest } | null; // demande d'ordre en cours auprès de la vue
  resolve: (result: BattleResult) => void;
}

export const Battle: BattleState = {
  heroes: [], enemies: [], chapter: null,
  readyQueue: [],
  actionQueue: [],
  busy: false,
  actionsDone: 0,
  over: false,
  order: null,
  resolve: () => {}, // remplacé par runBattle
};

// La vue du combat en cours, posée par runBattle
let view: GameView = noView();

function allCombatants(): Combatant[] {
  return [...Battle.heroes, ...Battle.enemies];
}

export interface BattleOptions {
  winBattles?: boolean; // mode test (?combat=gagne) : les ennemis tombent d'office, la suite se joue normalement
  loseBattles?: boolean; // mode test (?combat=perdu) : les héros tombent d'office, pour atteindre la défaite
}

// Joue un combat complet ; renvoie "victory", "defeat", "escape" ou "truce"
export async function runBattle(gameView: GameView, chapter: BattleChapter, { winBattles = false, loseBattles = false }: BattleOptions = {}) {
  view = gameView;
  Object.assign(Battle, {
    heroes: GameState.party, enemies: createEnemies(chapter.enemies), chapter,
    readyQueue: [], actionQueue: [], busy: true, actionsDone: 0, over: false, order: null,
  });
  const ended = new Promise<BattleResult>(resolve => Battle.resolve = resolve);

  for (const c of allCombatants()) {
    c.atb = isAlive(c) ? Math.random() * CONFIG.atb.startMax : 0;
    c.state = isAlive(c) ? "charging" : "ko";
    c.defending = false;
  }

  await view.startBattle(Battle);
  if (winBattles) {
    for (const enemy of Battle.enemies) enemy.hp = 0;
    await handleKnockouts(Battle.enemies);
    checkBattleEnd();
  }
  if (loseBattles) {
    for (const hero of Battle.heroes) hero.hp = 0;
    await handleKnockouts(Battle.heroes);
    checkBattleEnd();
  }
  Battle.busy = false;
  const stopFrames = view.frames(battleLoop);

  const result = await ended;
  stopFrames();
  return result;
}

// Une image : le temps écoulé est plafonné, pour qu'un onglet resté en arrière-plan ne rattrape pas d'un coup
function battleLoop(elapsedMs: number) {
  if (Battle.over) return;
  const dt = Math.min(elapsedMs / 1000, 0.1);

  if (!isTimeFrozen()) fillGauges(dt);
  // Relu après les jauges : un héros devenu prêt à cette image ouvre son menu, et la file attend son choix
  if (!isTimeFrozen() && Battle.actionQueue.length > 0) runNextAction();
  view.refreshGauges(Battle.heroes);
}

// Le temps du combat (jauges et actions en file) s'arrête pendant une action, et en mode « wait » (MAE-91) tant
// qu'un héros a son menu ouvert : menu principal, sous-menu ou ciblage. Avec plusieurs héros prêts, le menu du
// suivant s'ouvre dès le choix du précédent : le temps ne reprend qu'une fois tous les ordres donnés.
// L'action déjà en cours d'animation va jusqu'au bout.
function isTimeFrozen() {
  return Battle.busy || (CONFIG.atb.mode === "wait" && Battle.order !== null);
}

function fillGauges(dt: number) {
  for (const c of allCombatants()) {
    if (!isAlive(c) || c.state !== "charging") continue;
    c.atb = Math.min(100, c.atb + (c.spd + 20) * CONFIG.atb.fillRate * dt);
    if (c.atb < 100) continue;

    c.state = "ready";
    if (c.side === "hero") heroReady(c);
    else enemyReady(c);
  }
}

function heroReady(hero: Hero) {
  hero.defending = false;
  Battle.readyQueue.push(hero);
  view.heroReady(hero);
  offerOrder();
}

function enemyReady(enemy: Enemy) {
  enemy.state = "queued";
  Battle.actionQueue.push(chooseEnemyAction(enemy));
}

function removeFromReadyQueue(hero: Hero) {
  Battle.readyQueue = Battle.readyQueue.filter(h => h !== hero);
}

// — Ordres du joueur —

// Demande à la vue l'ordre du premier héros prêt, s'il n'y a pas déjà une demande en cours
function offerOrder() {
  if (Battle.order || Battle.over) return;
  const hero = Battle.readyQueue[0];
  if (!hero) return;

  const request = view.requestOrder({
    hero,
    canPass: () => Battle.readyQueue.length > 1,
  });
  Battle.order = { hero, request };
  void request.order.then(order => {
    if (Battle.order?.request !== request) return; // annulée entre-temps
    Battle.order = null;
    // Le combat a pu se finir, ou le héros tomber, entre le choix et son arrivée ici
    if (order && !Battle.over && hero.state === "ready") applyOrder(hero, order);
    offerOrder();
  });
}

// Annule la demande en cours : la vue ferme son menu, l'ordre éventuel est ignoré
function cancelOrder() {
  const pending = Battle.order;
  if (!pending) return;
  Battle.order = null;
  pending.request.cancel();
}

function applyOrder(hero: Hero, order: HeroOrder) {
  switch (order.kind) {
    case "ability": queueHeroAction(hero, order.ability, order.targets, order.itemId); break;
    case "defend":  defend(hero); break;
    case "pass":
      // Comme dans FF : Annuler au menu principal passe la main au héros prêt suivant
      if (Battle.readyQueue.length > 1) {
        const first = Battle.readyQueue.shift();
        if (first) Battle.readyQueue.push(first);
      }
      break;
  }
}

function queueHeroAction(hero: Hero, ability: Ability, targets: Combatant[], itemId: ItemId | null = null) {
  removeFromReadyQueue(hero);
  hero.state = "queued";
  if (itemId) GameState.inventory[itemId]--;  // réservé dès le choix, rendu si l'action n'a pas lieu
  Battle.actionQueue.push({ actor: hero, ability, targets, itemId });
  view.refresh();
}

function defend(hero: Hero) {
  removeFromReadyQueue(hero);
  hero.defending = true;
  hero.atb = 0;
  hero.state = "charging";
  view.showDefend(hero);
  view.refresh();
}

// — Exécution des actions —

async function runNextAction() {
  const action = Battle.actionQueue.shift();
  if (!action) return;
  Battle.busy = true;
  const { actor, ability } = action;

  if (isAlive(actor)) {
    if (ability.kind === "run") await attemptRun();
    else await performAbility(action);
    if (isAlive(actor)) {
      actor.atb = 0;
      actor.state = "charging";
    }
  } else if (action.itemId) {
    GameState.inventory[action.itemId]++;
  }

  Battle.actionsDone++;
  checkBattleEnd();
  Battle.busy = false;
}

async function performAbility({ actor, ability, targets: chosen }: QueuedAction) {
  const targets = retarget(actor, ability, chosen);
  if (ability.mp) actor.mp = Math.max(0, actor.mp - ability.mp);

  await view.actionStart(actor, ability);

  const hits = targets.map(target => {
    const effect = computeEffect(actor, ability, target);
    applyEffect(target, effect);
    return { target, effect };
  });
  await view.showEffects(hits, ability);

  await handleKnockouts(targets);
  await checkRage(targets);
  await view.actionEnd(actor);
}

async function handleKnockouts(targets: Combatant[]) {
  const fallen = targets.filter(t => !isAlive(t) && t.state !== "ko");
  for (const c of fallen) {
    c.state = "ko";
    c.atb = 0;
    c.defending = false;
    if (c.side === "hero") {
      removeFromReadyQueue(c);
      if (Battle.order?.hero === c) {
        cancelOrder();
        offerOrder();
      }
    }
  }

  // Un ennemi « spareable » (le Dragon) reste à terre : c'est le joueur qui décidera de son sort.
  // Pendant un combat à trêve ou à reddition, aucun ennemi ne meurt : il reste à genoux.
  const staysDown = (enemy: Enemy) =>
    enemy.spareable || Battle.chapter?.truce !== undefined || Battle.chapter?.surrender !== undefined;
  const fallenEnemies = fallen.filter(c => c.side === "enemy");
  for (const enemy of fallenEnemies.filter(staysDown)) view.showDefeated(enemy);
  const deadEnemies = fallenEnemies.filter(c => !staysDown(c));
  if (deadEnemies.length) await view.killEnemies(deadEnemies);
  view.refresh();
}

async function checkRage(targets: Combatant[]) {
  for (const enemy of targets) {
    if (!enemy.rage || enemy.enraged || !isAlive(enemy)) continue;
    if (enemy.hp / enemy.maxHp > enemy.rage.threshold) continue;
    enemy.enraged = true;
    enemy.turns = 0;
    await view.message(enemy.rage.message);
  }
}

async function attemptRun() {
  if (Battle.chapter?.canRun === false) {
    await view.message("Repli impossible !");
    return;
  }
  if (Math.random() < CONFIG.run.successChance) {
    await view.animateEscape();
    endBattle("escape");
  } else {
    await view.message("Le repli a échoué !");
  }
}

// La défaite passe avant la trêve : une trêve ne masque jamais un game over
function checkBattleEnd() {
  if (Battle.over) return;
  if (!Battle.heroes.some(isAlive))       endBattle("defeat");
  else if (isTruceReached())              endBattle("truce");
  else if (!Battle.enemies.some(isAlive)) endBattle("victory");
}

function isTruceReached() {
  const truce = Battle.chapter?.truce;
  if (!truce) return false;
  return Battle.actionsDone >= truce.afterActions || Battle.enemies.some(enemy => !isAlive(enemy));
}

function endBattle(result: BattleResult) {
  Battle.over = true;
  Battle.readyQueue = [];
  // Les objets réservés par des actions qui n'auront pas lieu reviennent dans l'inventaire
  for (const action of Battle.actionQueue) {
    if (action.itemId) GameState.inventory[action.itemId]++;
  }
  Battle.actionQueue = [];
  for (const hero of Battle.heroes) {
    hero.defending = false;
    if (isAlive(hero)) hero.state = "charging";
  }
  view.refreshGauges(Battle.heroes);
  cancelOrder();
  Battle.resolve(result);
}
