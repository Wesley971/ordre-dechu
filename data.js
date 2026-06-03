const ennemis = [
  { name: "Gobelin",   hp: 10, maxHp: 10, image: "images/gobelin.png"   },
  { name: "Squelette", hp: 15, maxHp: 15, image: "images/squelette.png" },
  { name: "Ogre",      hp: 20, maxHp: 20, image: "images/ogre.png"      },
  { name: "Dragon",    hp: 30, maxHp: 30, image: "images/dragon.png"    },
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
