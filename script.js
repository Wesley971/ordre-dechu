// var (pas let) pour être accessible depuis data.js et ui.js
var counterAttackTimeout = null;

// — FSM : transition de phase ——————————————————————————————————————————
// Centralise toutes les mutations de visibilité. Le CSS [data-phase] prend le relais.

function setPhase(name) {
  GameState.phase = name;
  document.body.dataset.phase = name;

  // Nettoie les inline styles résiduels pour que le CSS [data-phase] prime
  ["game", "intro-screen", "choices", "continue-button"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "";
  });
  const charRow = document.querySelector(".char-row");
  if (charRow) charRow.style.display = "";
}

// — Écrans ————————————————————————————————————————————————————————————

function startGame() {
  setPhase("lore");
  updateStory(
    "Maelor s'aventure dans les terres brumeuses du Val Ténébreux, guidé par les murmures d'un serment oublié.<br><br>" +
    "Il est le dernier descendant d'un ordre jadis puissant : <strong>L'Ordre Déchu</strong>. Trente années plus tôt, ses membres furent accusés de sorcellerie noire et exécutés sans procès. Leurs cendres dispersées, leur nom effacé des livres... sauf d'un.<br><br>" +
    "Aujourd'hui, quelque chose rôde dans les bois. Les morts se lèvent. Le sang ancien appelle.<br><br>" +
    "Maelor n'est pas là pour sauver le royaume.<br>Il est là pour réclamer ce qui lui revient.");
}

function launchGameplay() {
  setPhase("combat");
  updateStory("Une créature surgit de l'ombre... prépare-toi à combattre !");
}

// — Journal de combat —————————————————————————————————————————————————

function addLogEntry(entry) {
  GameState.log = [...GameState.log, entry].slice(-5);
  updateLog();
}

// — Logique pure ——————————————————————————————————————————————————————

function calcPlayerAttack(gameState) {
  const { damageMin, damageMax } = CONFIG.player;
  const damage = Math.floor(Math.random() * (damageMax - damageMin + 1)) + damageMin;
  const newEnemyHp = Math.max(0, gameState.enemy.hp - damage);
  return { damage, newEnemyHp };
}

function calcHeal(gameState) {
  const { healMin, healMax } = CONFIG.player;
  const healAmount = Math.floor(Math.random() * (healMax - healMin + 1)) + healMin;
  const newPlayerHp = Math.min(gameState.player.maxHp, gameState.player.hp + healAmount);
  return { healAmount, newPlayerHp };
}

function calcRun() {
  return { success: Math.random() < CONFIG.run.successChance };
}

// — Actions (DOM + état) ——————————————————————————————————————————————

function fight() {
  if (GameState.phase !== "combat") return;

  const { player, currentEnemy: enemy } = GameState;
  if (player.hp <= 0 || !enemy) return;

  const { damage, newEnemyHp } = calcPlayerAttack({ player, enemy });
  enemy.hp = newEnemyHp;

  document.getElementById("enemy").classList.add("hit");
  setTimeout(() => document.getElementById("enemy").classList.remove("hit"), 400);

  updateEnnemiUI();
  updateStory(`Tu attaques le ${enemy.name} ! Tu lui fais ${damage} dégâts ! Il lui reste ${enemy.hp} HP. <br>`);

  if (enemy.hp <= 0) {
    addLogEntry({ actor: "player", action: "attack", value: damage, result: "kill",
      message: `Tu tues le ${enemy.name} (+${enemy.xpReward} XP)` });

    GameState.currentEnemyIndex++;
    let texte = `Tu as vaincu le monstre ! `;

    if (gainXp(enemy.xpReward)) {
      texte += `<br>🆙 Tu es passé niveau ${GameState.player.level} !`;
      addLogEntry({ actor: "player", action: "levelup", value: GameState.player.level, result: "levelup",
        message: `Niveau ${GameState.player.level} atteint !` });
    }

    updatePlayerUI();

    if (GameState.currentEnemy) {
      updateEnnemiUI();
      texte += `<br>Un ${GameState.currentEnemy.name} approche...`;
    } else {
      texte += "<br><br>🎉 Tu as vaincu tous les monstres ! Victoire !";
      finDePartie();
    }

    updateStory(texte);
    return;
  }

  addLogEntry({ actor: "player", action: "attack", value: damage, result: "hit",
    message: `Tu frappes le ${enemy.name} pour ${damage} dégâts` });

  enemyCounterAttack();
}

function heal() {
  if (GameState.phase !== "combat") return;

  const { player } = GameState;
  if (player.hp <= 0 || !GameState.currentEnemy) return;

  const { healAmount, newPlayerHp } = calcHeal({ player });
  GameState.player.hp = newPlayerHp;

  updatePlayerUI();
  updateStory(`💖 Tu récupères ${healAmount} HP. Tu as maintenant ${GameState.player.hp} HP.`);

  addLogEntry({ actor: "player", action: "heal", value: healAmount, result: "healed",
    message: `Tu te soignes de ${healAmount} HP` });

  enemyCounterAttack();
}

function run() {
  if (GameState.phase !== "combat") return;

  const { player } = GameState;
  if (player.hp <= 0 || !GameState.currentEnemy) return;

  const { success } = calcRun();
  if (success) {
    addLogEntry({ actor: "player", action: "run", value: 0, result: "escaped",
      message: "Maelor prend la fuite" });
    updateStory("Maelor a fui. Mais l'Ordre Déchu l'attend toujours… Souhaites-tu affronter à nouveau ton destin ?");
    finDePartie();
  } else {
    updateStory("Tu n'as pas réussi à fuir le combat !");
    enemyCounterAttack();
  }
}

function enemyCounterAttack() {
  // Passe en phase "animating" : CSS désactive les boutons pendant le délai
  setPhase("animating");

  counterAttackTimeout = setTimeout(() => {
    counterAttackTimeout = null;

    const { player, currentEnemy: enemy } = GameState;
    const damage = Math.floor(Math.random() * (enemy.attack + 1));
    GameState.player.hp = Math.max(0, player.hp - damage);

    document.getElementById("player").classList.add("hit");
    setTimeout(() => document.getElementById("player").classList.remove("hit"), 400);

    updatePlayerUI();

    if (GameState.player.hp <= 0) {
      addLogEntry({ actor: "enemy", action: "attack", value: damage, result: "kill",
        message: `${enemy.name} te terrasse pour ${damage} dégâts` });
      updateStory(`Le ${enemy.name} t'attaque et te fait ${damage} dégâts !<br>💀 Tu es mort !`);
      finDePartie();
    } else {
      setPhase("combat"); // Réactive les boutons
      addLogEntry({ actor: "enemy", action: "attack", value: damage, result: "hit",
        message: `${enemy.name} te frappe pour ${damage} dégâts` });
      updateStory(`Le ${enemy.name} t'attaque ! Il te fait ${damage} dégâts ! Il te reste ${GameState.player.hp} HP.`);
    }
  }, 800);
}

// — Initialisation ————————————————————————————————————————————————————

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("launch-btn").addEventListener("click", launchGameplay);
  document.getElementById("fight-btn").addEventListener("click", fight);
  document.getElementById("heal-btn").addEventListener("click", heal);
  document.getElementById("run-btn").addEventListener("click", run);
});
