// player.js - Création des héros, XP, montées de niveau

function createHero(def) {
  const hero = {
    id: def.id, name: def.name, job: def.job, image: def.image, command: def.command,
    side: "hero", level: 1, xp: 0, spells: [],
    atb: 0, state: "charging", defending: false,
  };
  Object.assign(hero, statsAtLevel(def, 1));
  hero.hp = hero.maxHp;
  hero.mp = hero.maxMp;
  hero.spells = spellsLearnedBetween(def, 0, 1);
  return hero;
}

function heroDef(hero) {
  return HEROES.find(def => def.id === hero.id);
}

function statsAtLevel(def, level) {
  const stats = {};
  for (const [stat, base] of Object.entries(def.stats)) {
    stats[stat] = base + def.growth[stat] * (level - 1);
  }
  return stats;
}

// Sorts appris entre deux niveaux (fromLevel exclu, toLevel inclus)
function spellsLearnedBetween(def, fromLevel, toLevel) {
  const learned = [];
  for (let lvl = fromLevel + 1; lvl <= toLevel; lvl++) {
    learned.push(...(def.spells[lvl] || []));
  }
  return learned;
}

function levelForXp(xp) {
  const { xpTable } = CONFIG;
  let level = 1;
  while (level < xpTable.length && xp >= xpTable[level]) level++;
  return level;
}

// Ajoute de l'XP ; renvoie { level, learned } si le héros monte de niveau, sinon null
function gainXp(hero, xp) {
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

// Récompenses de fin de combat : XP pour chaque héros debout, Gils et objets pour le groupe
function grantRewards(enemies) {
  const xp  = enemies.reduce((sum, e) => sum + e.xp, 0);
  const gil = enemies.reduce((sum, e) => sum + e.gil, 0);
  GameState.gil += gil;

  const drops = [];
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

// Source sacrée : PV/PM au maximum, les K.O. se relèvent
function restoreParty() {
  for (const hero of GameState.party) {
    hero.hp = hero.maxHp;
    hero.mp = hero.maxMp;
    hero.state = "charging";
  }
}
