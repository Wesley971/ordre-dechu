const ennemis = [
  { name: "Gobelin",  hp: 10, maxHp: 10, image: "images/gobelin.png",  attack: 4,  xpReward: 5  },
  { name: "Loup",     hp: 15, maxHp: 15, image: "images/loup.png",     attack: 5,  xpReward: 8  },
  { name: "Sorcière", hp: 20, maxHp: 20, image: "images/sorciere.png", attack: 6,  xpReward: 12 },
  { name: "Dragon",   hp: 30, maxHp: 30, image: "images/dragon.png",   attack: 8,  xpReward: 20 },
];

const GameState = {
  player: { hp: 20, maxHp: 20, xp: 0, level: 1 },
  enemies: ennemis.map(e => ({ ...e })),
  currentEnemyIndex: 0,
  get currentEnemy() { return this.enemies[this.currentEnemyIndex]; },

  reset() {
    this.player = { hp: 20, maxHp: 20, xp: 0, level: 1 };
    this.enemies = ennemis.map(e => ({ ...e }));
    this.currentEnemyIndex = 0;
  }
};
