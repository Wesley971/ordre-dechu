// ui.js - Gère l'affichage des éléments du jeu

function updatePlayerUI() {
  const { hp, maxHp, xp, level } = GameState.player;
  const pct = (hp / maxHp) * 100;
  document.getElementById("player-hp-bar").style.width = pct + "%";
  document.getElementById("player-hp-text").innerText = `HP: ${hp}`;
  document.getElementById("player-xp-text").innerText = `XP : ${xp}`;
  document.getElementById("player-level-text").innerText = `Niveau : ${level}`;
}

function updateEnnemiUI() {
  const enemy = GameState.currentEnemy;
  const pct = (enemy.hp / enemy.maxHp) * 100;
  document.getElementById("enemy-hp-bar").style.width = pct + "%";
  document.getElementById("enemy-hp-text").innerText = `HP : ${enemy.hp}`;
  document.getElementById("enemy-name").innerText = enemy.name;
  document.getElementById("enemy-image").src = enemy.image;
}

function updateStory(text) {
  const story = document.getElementById("story");
  story.innerHTML = text;
  if (story) story.scrollTop = story.scrollHeight;
}

function updateLog() {
  const el = document.getElementById("combat-log");
  if (!el) return;

  el.innerHTML = GameState.log.slice().reverse().map(entry => {
    let color;
    if      (entry.action === "levelup")    color = "var(--xp-green)";
    else if (entry.actor  === "player")     color = "var(--gold-title)";
    else                                    color = "var(--hp-red)";

    return `<div class="log-entry" style="color:${color}">${entry.message}</div>`;
  }).join("");
}

function finDePartie() {
  document.querySelectorAll("#choices button").forEach(btn => {
    btn.disabled = true;
  });

  if (!document.querySelector(".replay-btn")) {
    const replayButton = document.createElement("button");
    replayButton.textContent = "🔁 Rejouer";
    replayButton.classList.add("replay-btn");
    replayButton.onclick = () => {
      GameState.reset();
      document.querySelectorAll("#choices button").forEach(btn => {
        btn.disabled = false;
      });
      document.querySelector(".replay-btn").remove();
      updatePlayerUI();
      updateEnnemiUI();
      updateLog();
      updateStory("Une nouvelle partie commence. Prépare-toi à combattre !");
    };
    document.getElementById("choices").appendChild(replayButton);
  }
}
