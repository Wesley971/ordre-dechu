let player = {
  hp: 20,
  maxHp: 20,
  xp: 0,
  level: 1,}

let ennemiActuel = ennemis[0];

function startGame() {
  document.getElementById("intro-screen").style.display = "none";
  document.getElementById("game").style.display = "block";
  document.body.classList.remove("lock-scroll");

  updateStory(
    "Maelor s’aventure dans les terres brumeuses du Val Ténébreux, guidé par les murmures d’un serment oublié.<br><br>" +
    "Il est le dernier descendant d’un ordre jadis puissant : <strong>L’Ordre Déchu</strong>. Trente années plus tôt, ses membres furent accusés de sorcellerie noire et exécutés sans procès. Leurs cendres dispersées, leur nom effacé des livres... sauf d’un.<br><br>" +
    "Aujourd’hui, quelque chose rôde dans les bois. Les morts se lèvent. Le sang ancien appelle.<br><br>" +
    "Maelor n’est pas là pour sauver le royaume.<br>Il est là pour réclamer ce qui lui revient.");

  document.getElementById("continue-button").style.display = "block";
}

function launchGameplay() {
  document.getElementById("continue-button").style.display = "none";
  document.body.classList.add("game-started");
  updateStory("Une créature surgit de l’ombre... prépare-toi à combattre !");
}

function calcPlayerAttack(gameState) {
  const damage = Math.floor(Math.random() * 3) + 1;
  const newEnemyHp = Math.max(0, gameState.enemy.hp - damage);
  return { damage, newEnemyHp };
}

function calcHeal(gameState) {
  const healAmount = Math.floor(Math.random() * 5) + 2;
  const newPlayerHp = Math.min(gameState.player.maxHp, gameState.player.hp + healAmount);
  return { healAmount, newPlayerHp };
}

function calcRun() {
  return { success: Math.random() < 0.5 };
}

function fight() {
  if (player.hp <= 0 || ennemis.length === 0) return;

  const { damage: damagePlayer, newEnemyHp } = calcPlayerAttack({ player, enemy: ennemiActuel });
  ennemiActuel.hp = newEnemyHp;
  document.getElementById("enemy").classList.add("hit");
  setTimeout(() => {
    document.getElementById("enemy").classList.remove("hit");
  }, 400);

  updateEnnemiUI();

  updateStory(`Tu attaques le ${ennemiActuel.name} ! Tu lui fais ${damagePlayer} dégâts ! Il lui reste ${ennemiActuel.hp} HP. <br>`);

  if (ennemiActuel.hp <= 0) {
  ennemis.shift();

  let texte = `Tu as vaincu le monstre ! `;

  if (gainXp(5)) {
    texte += `<br>🆙 Tu es passé niveau ${player.level} !`;
  }

  updatePlayerUI();

  if (ennemis.length > 0) {
    ennemiActuel = ennemis[0];
    updateEnnemiUI();
    texte += `<br>Un ${ennemiActuel.name} approche...`;
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
  if (player.hp <= 0 || ennemis.length === 0) return;

  const { healAmount, newPlayerHp } = calcHeal({ player });
  player.hp = newPlayerHp;

  updatePlayerUI();

  updateStory(
    `💖 Tu récupères ${healAmount} HP. Tu as maintenant ${player.hp} HP.`);

  enemyCounterAttack();
}

function run() {
  if (player.hp <= 0 || ennemis.length === 0) return;

  const { success } = calcRun();
  if (success) {
    updateStory(
      "Maelor a fui. Mais l’Ordre Déchu l’attend toujours… Souhaites-tu affronter à nouveau ton destin ?");
    finDePartie();
  } else {
    updateStory( "Tu n'as pas réussi à fuir le combat !");

    enemyCounterAttack();
  }
}

function enemyCounterAttack() {
  setTimeout(() => {
    let damageMonster = Math.floor(Math.random() * 4);
    player.hp -= damageMonster;
    document.getElementById("player").classList.add("hit");
    setTimeout(() => {
      document.getElementById("player").classList.remove("hit");
    }, 400);

    if (player.hp < 0) player.hp = 0;

    updatePlayerUI();

    if (player.hp <= 0) {
      updateStory(`Le ${ennemiActuel.name} t'attaque et te fait ${damageMonster} dégâts !<br>💀 Tu es mort !`);
      finDePartie();
    } else {
      updateStory(`Le ${ennemiActuel.name} t'attaque ! Il te fait ${damageMonster} dégâts ! Il te reste ${player.hp} HP.`);
    }
  }, 800);
}
