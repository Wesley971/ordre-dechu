function startGame() {
  document.getElementById("intro-screen").style.display = "none";
  document.getElementById("game").style.display = "block";
  document.body.classList.remove("lock-scroll");

  updateStory(
    "Maelor s'aventure dans les terres brumeuses du Val Ténébreux, guidé par les murmures d'un serment oublié.<br><br>" +
    "Il est le dernier descendant d'un ordre jadis puissant : <strong>L'Ordre Déchu</strong>. Trente années plus tôt, ses membres furent accusés de sorcellerie noire et exécutés sans procès. Leurs cendres dispersées, leur nom effacé des livres... sauf d'un.<br><br>" +
    "Aujourd'hui, quelque chose rôde dans les bois. Les morts se lèvent. Le sang ancien appelle.<br><br>" +
    "Maelor n'est pas là pour sauver le royaume.<br>Il est là pour réclamer ce qui lui revient.");

  document.getElementById("continue-button").style.display = "block";
}

function launchGameplay() {
  document.getElementById("continue-button").style.display = "none";
  document.body.classList.add("game-started");
  updateStory("Une créature surgit de l'ombre... prépare-toi à combattre !");
}

// — Logique pure —

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

// — Actions (DOM + état) —

function fight() {
  const { player, currentEnemy: enemy, enemies } = GameState;
  if (player.hp <= 0 || enemies.length === 0) return;

  const { damage, newEnemyHp } = calcPlayerAttack({ player, enemy });
  enemy.hp = newEnemyHp;

  document.getElementById("enemy").classList.add("hit");
  setTimeout(() => document.getElementById("enemy").classList.remove("hit"), 400);

  updateEnnemiUI();
  updateStory(`Tu attaques le ${enemy.name} ! Tu lui fais ${damage} dégâts ! Il lui reste ${enemy.hp} HP. <br>`);

  if (enemy.hp <= 0) {
    GameState.currentEnemyIndex++;
    let texte = `Tu as vaincu le monstre ! `;

    if (gainXp(enemy.xpReward)) {
      texte += `<br>🆙 Tu es passé niveau ${GameState.player.level} !`;
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

  enemyCounterAttack();
}

function heal() {
  const { player, enemies } = GameState;
  if (player.hp <= 0 || enemies.length === 0) return;

  const { healAmount, newPlayerHp } = calcHeal({ player });
  GameState.player.hp = newPlayerHp;

  updatePlayerUI();
  updateStory(`💖 Tu récupères ${healAmount} HP. Tu as maintenant ${GameState.player.hp} HP.`);

  enemyCounterAttack();
}

function run() {
  const { player, enemies } = GameState;
  if (player.hp <= 0 || enemies.length === 0) return;

  const { success } = calcRun();
  if (success) {
    updateStory("Maelor a fui. Mais l'Ordre Déchu l'attend toujours… Souhaites-tu affronter à nouveau ton destin ?");
    finDePartie();
  } else {
    updateStory("Tu n'as pas réussi à fuir le combat !");
    enemyCounterAttack();
  }
}

function enemyCounterAttack() {
  setTimeout(() => {
    const { player, currentEnemy: enemy } = GameState;
    const damage = Math.floor(Math.random() * (GameState.currentEnemy.attack + 1));
    GameState.player.hp = Math.max(0, player.hp - damage);

    document.getElementById("player").classList.add("hit");
    setTimeout(() => document.getElementById("player").classList.remove("hit"), 400);

    updatePlayerUI();

    if (GameState.player.hp <= 0) {
      updateStory(`Le ${enemy.name} t'attaque et te fait ${damage} dégâts !<br>💀 Tu es mort !`);
      finDePartie();
    } else {
      updateStory(`Le ${enemy.name} t'attaque ! Il te fait ${damage} dégâts ! Il te reste ${GameState.player.hp} HP.`);
    }
  }, 800);
}

// — Initialisation —

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("launch-btn").addEventListener("click", launchGameplay);
  document.getElementById("fight-btn").addEventListener("click", fight);
  document.getElementById("heal-btn").addEventListener("click", heal);
  document.getElementById("run-btn").addEventListener("click", run);
});
