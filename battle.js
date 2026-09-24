// battle.js - Moteur de combat : calculs (logique pure) et boucle ATB

const wait       = ms => new Promise(resolve => setTimeout(resolve, ms));
const randomItem = list => list[Math.floor(Math.random() * list.length)];
const isAlive    = combatant => combatant.hp > 0;

// ±variance autour d'une valeur
function vary(value) {
  const v = CONFIG.damage.variance;
  return value * (1 - v + Math.random() * 2 * v);
}

// — Logique pure —

function elementMultiplier(target, element) {
  const affinity = element && target.elements && target.elements[element];
  if (affinity === "weak")   return CONFIG.damage.weakMultiplier;
  if (affinity === "resist") return CONFIG.damage.resistMultiplier;
  if (affinity === "absorb") return -1;
  return 1;
}

function calcPhysical(attacker, target, ability) {
  const { missChance, critChance, critMultiplier, defendMultiplier } = CONFIG.damage;
  if (Math.random() < missChance) return { type: "miss" };

  const crit = Math.random() < critChance;
  let damage = vary(attacker.atk * 2 * ability.power) - (ability.pierce ? 0 : target.def);
  if (crit) damage *= critMultiplier;
  if (target.defending) damage *= defendMultiplier;
  return { type: "damage", amount: Math.max(1, Math.round(damage)), crit };
}

function calcMagic(caster, target, ability) {
  const multiplier = elementMultiplier(target, ability.element);
  const base = Math.max(1, vary(ability.power + caster.mag * 2) - target.res);
  const amount = Math.round(base * Math.abs(multiplier));
  if (multiplier < 0) return { type: "heal", amount, absorbed: true };
  return { type: "damage", amount, weak: multiplier > 1 };
}

function calcHeal(caster, target, ability) {
  if (!isAlive(target)) return { type: "none" };
  const amount = ability.amount || Math.round(vary(ability.power + caster.mag * 2));
  // Les soins brûlent les créatures d'os (Squelettes)
  if (target.undead) return { type: "damage", amount, weak: true };
  return { type: "heal", amount };
}

function calcRevive(target) {
  if (isAlive(target)) return { type: "none" };
  return { type: "revive", amount: Math.max(1, Math.round(target.maxHp * CONFIG.revivePct)) };
}

function computeEffect(actor, ability, target) {
  switch (ability.kind) {
    case "physical": return calcPhysical(actor, target, ability);
    case "magic":    return calcMagic(actor, target, ability);
    case "heal":     return calcHeal(actor, target, ability);
    case "mp":       return isAlive(target) ? { type: "mp", amount: ability.amount } : { type: "none" };
    case "revive":   return calcRevive(target);
    default:         return { type: "none" };
  }
}

function applyEffect(target, effect) {
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

function createEnemies(keys) {
  const total = {}, seen = {};
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

function chooseEnemyAction(enemy) {
  const pattern = enemy.enraged ? enemy.rage.pattern : enemy.pattern;
  let choice = "attack";

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
function groupOf(actor, relation) {
  const heroSide = (actor.side === "hero") === (relation === "ally");
  return heroSide ? Battle.heroes : Battle.enemies;
}

function targetCandidates(actor, targetType) {
  if (targetType === "ko-ally") return groupOf(actor, "ally").filter(c => !isAlive(c));
  const relation = targetType.includes("foe") ? "foe" : "ally";
  return groupOf(actor, relation).filter(isAlive);
}

function pickTargets(actor, targetType) {
  const candidates = targetCandidates(actor, targetType);
  if (targetType.startsWith("all-")) return candidates;
  return candidates.length ? [randomItem(candidates)] : [];
}

// Si la cible est tombée entre le choix et l'action, on vise un autre membre du même camp
function retarget(actor, ability, chosen) {
  if (ability.target.startsWith("all-")) return targetCandidates(actor, ability.target);
  if (ability.target === "ko-ally") return chosen;

  const alive = chosen.filter(isAlive);
  if (alive.length) return alive;

  const side = chosen[0] && chosen[0].side;
  const pool = (side === "enemy" ? Battle.enemies : Battle.heroes).filter(isAlive);
  return pool.length ? [randomItem(pool)] : [];
}

// — Boucle de combat (ATB) —

const Battle = {
  heroes: [], enemies: [], chapter: null,
  readyQueue: [],  // héros dont la jauge est pleine, en attente d'un ordre
  actionQueue: [], // actions choisies, exécutées une par une
  busy: false,     // une action est en cours d'animation
  over: false,
  lastTime: 0,
  resolve: null,
};

function allCombatants() {
  return [...Battle.heroes, ...Battle.enemies];
}

// Joue un combat complet ; renvoie "victory", "defeat" ou "escape"
async function runBattle(chapter) {
  Object.assign(Battle, {
    heroes: GameState.party, enemies: createEnemies(chapter.enemies), chapter,
    readyQueue: [], actionQueue: [], busy: true, over: false,
  });
  const ended = new Promise(resolve => Battle.resolve = resolve);

  for (const c of allCombatants()) {
    c.atb = isAlive(c) ? Math.random() * CONFIG.atb.startMax : 0;
    c.state = isAlive(c) ? "charging" : "ko";
    c.defending = false;
  }

  renderBattle(Battle);
  await playBattleIntro(Battle);
  Menu.attach();
  Battle.busy = false;
  Battle.lastTime = performance.now();
  requestAnimationFrame(battleLoop);

  const result = await ended;
  Menu.detach();
  return result;
}

function battleLoop(now) {
  if (Battle.over) return;
  const dt = Math.min((now - Battle.lastTime) / 1000, 0.1);
  Battle.lastTime = now;

  if (!isTimeFrozen()) fillGauges(dt);
  if (!Battle.busy && Battle.actionQueue.length > 0) runNextAction();
  updateAtbUI(Battle.heroes);

  requestAnimationFrame(battleLoop);
}

function isTimeFrozen() {
  return Battle.busy || (CONFIG.atb.mode === "wait" && Menu.isInSubmenu());
}

function fillGauges(dt) {
  for (const c of allCombatants()) {
    if (!isAlive(c) || c.state !== "charging") continue;
    c.atb = Math.min(100, c.atb + (c.spd + 20) * CONFIG.atb.fillRate * dt);
    if (c.atb < 100) continue;

    c.state = "ready";
    if (c.side === "hero") heroReady(c);
    else enemyReady(c);
  }
}

function heroReady(hero) {
  hero.defending = false;
  Battle.readyQueue.push(hero);
  Sfx.play("ready");
  updateBattleUI();
  Menu.onHeroReady();
}

function enemyReady(enemy) {
  enemy.state = "queued";
  Battle.actionQueue.push(chooseEnemyAction(enemy));
}

function removeFromReadyQueue(hero) {
  Battle.readyQueue = Battle.readyQueue.filter(h => h !== hero);
}

// — Ordres du joueur —

function queueHeroAction(hero, ability, targets, itemId = null) {
  removeFromReadyQueue(hero);
  hero.state = "queued";
  if (itemId) GameState.inventory[itemId]--;  // réservé dès le choix, rendu si l'action n'a pas lieu
  Battle.actionQueue.push({ actor: hero, ability, targets, itemId });
  updateBattleUI();
}

function defend(hero) {
  removeFromReadyQueue(hero);
  hero.defending = true;
  hero.atb = 0;
  hero.state = "charging";
  showDefend(hero);
  updateBattleUI();
}

// — Exécution des actions —

async function runNextAction() {
  Battle.busy = true;
  const action = Battle.actionQueue.shift();
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

  checkBattleEnd();
  Battle.busy = false;
}

async function performAbility({ actor, ability, targets: chosen }) {
  const targets = retarget(actor, ability, chosen);
  if (ability.mp) actor.mp = Math.max(0, actor.mp - ability.mp);

  await animateActorStart(actor, ability);

  for (const target of targets) {
    const effect = computeEffect(actor, ability, target);
    applyEffect(target, effect);
    showEffect(target, effect, ability);
  }
  updateBattleUI();
  await wait(CONFIG.timing.effect);

  await handleKnockouts(targets);
  await checkRage(targets);
  await animateActorEnd(actor);
}

async function handleKnockouts(targets) {
  const fallen = targets.filter(t => !isAlive(t) && t.state !== "ko");
  for (const c of fallen) {
    c.state = "ko";
    c.atb = 0;
    c.defending = false;
    if (c.side === "hero") {
      removeFromReadyQueue(c);
      Menu.onHeroDown(c);
    }
  }

  // Un ennemi « spareable » (le Dragon) reste à terre : c'est le joueur qui décidera de son sort
  const fallenEnemies = fallen.filter(c => c.side === "enemy");
  fallenEnemies.filter(c => c.spareable).forEach(showDefeated);
  const deadEnemies = fallenEnemies.filter(c => !c.spareable);
  if (deadEnemies.length) await killEnemies(deadEnemies);
  updateBattleUI();
}

async function checkRage(targets) {
  for (const enemy of targets) {
    if (!enemy.rage || enemy.enraged || !isAlive(enemy)) continue;
    if (enemy.hp / enemy.maxHp > enemy.rage.threshold) continue;
    enemy.enraged = true;
    enemy.turns = 0;
    await showMessage(enemy.rage.message);
  }
}

async function attemptRun() {
  if (Battle.chapter.canRun === false) {
    await showMessage("Impossible de fuir !");
    return;
  }
  if (Math.random() < CONFIG.run.successChance) {
    await animateEscape();
    endBattle("escape");
  } else {
    await showMessage("La fuite a échoué !");
  }
}

function checkBattleEnd() {
  if (Battle.over) return;
  if (!Battle.enemies.some(isAlive))     endBattle("victory");
  else if (!Battle.heroes.some(isAlive)) endBattle("defeat");
}

function endBattle(result) {
  Battle.over = true;
  Battle.readyQueue = [];
  Battle.actionQueue = [];
  for (const hero of Battle.heroes) {
    hero.defending = false;
    if (isAlive(hero)) hero.state = "charging";
  }
  updateAtbUI(Battle.heroes);
  Menu.close();
  Battle.resolve(result);
}
