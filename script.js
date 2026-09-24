// script.js - Déroulement de la partie : titre, histoire, combats, fin

// — Écran titre —

async function backToTitle({ startLabel, canRetry = false }) {
  showScreen("intro");
  $("#start-btn").textContent = startLabel;
  $("#retry-btn").hidden = !canRetry;

  const options = [...document.querySelectorAll(".title-option")].filter(button => !button.hidden);
  const chosen = options[await pickOption(options)];
  if (chosen.id === "retry-btn") retryChapter();
  else newGame();
}

// — Partie —

async function newGame() {
  GameState.reset();
  setSceneTint(CHAPTERS[0]);
  renderIdleScene(GameState.party);
  showScreen("game");

  await Dialog.show({ title: "Prologue", pages: PROLOGUE });
  await playChapters();
}

async function retryChapter() {
  GameState.loadCheckpoint();
  showScreen("game");
  await playChapters();
}

async function playChapters() {
  while (GameState.chapterIndex < CHAPTERS.length) {
    const chapter = GameState.currentChapter;
    GameState.saveCheckpoint();
    setSceneTint(chapter);
    renderIdleScene(GameState.party);

    if (chapter.rest) {
      restoreParty();
      updateBattleUI();
      await Dialog.show({ title: chapter.title, pages: chapter.story });
      GameState.chapterIndex++;
      continue;
    }

    await Dialog.show({ title: chapter.title, pages: chapter.story });
    const result = await runBattle(chapter);

    if (result === "defeat") return gameOver();
    const spareable = Battle.enemies.find(enemy => enemy.spareable);
    if (result === "escape") await Dialog.show({ pages: ["Le groupe s'enfonce dans les brumes... sans le moindre butin."] });
    else if (spareable) await decideDragonFate(spareable);
    else await celebrateVictory();

    GameState.chapterIndex++;
  }

  const fate = GameState.dragonSpared ? DRAGON_FATE.spare : DRAGON_FATE.kill;
  await Dialog.show({ title: "Épilogue", pages: fate.ending });
  backToTitle({ startLabel: "Rejouer" });
}

// Le Dragon est à terre : Épargner (vraie fin) ou Achever (fausse fin, « Victoire ! » en façade)
async function decideDragonFate(dragon) {
  // Le combat est fini : les héros K.O. se relèvent (à 1 PV) pour la scène finale
  for (const hero of GameState.party.filter(hero => !isAlive(hero))) {
    hero.hp = 1;
    hero.state = "charging";
  }
  updateBattleUI();

  const choice = await Dialog.choose({
    text: DRAGON_FATE.question,
    options: ["spare", "kill"].map(id => ({ id, label: DRAGON_FATE[id].label })),
  });
  GameState.dragonSpared = choice === "spare";

  if (GameState.dragonSpared) {
    await animateSpare(dragon);
    await Dialog.show({ pages: DRAGON_FATE.spare.scene });
  } else {
    const maelor = GameState.party.find(hero => hero.id === "maelor");
    await animateFinishingBlow(maelor, dragon);
    await Dialog.show({ pages: DRAGON_FATE.kill.scene });
    await celebrateVictory();
  }
}

async function celebrateVictory() {
  Sfx.play("victory");
  victoryPose(GameState.party);
  const rewards = grantRewards(Battle.enemies);
  updateBattleUI();
  await Dialog.show({ title: "Victoire !", pages: formatRewards(rewards) });
}

function formatRewards({ xp, gil, drops, levelUps }) {
  let loot = `Chaque héros debout gagne <strong>${xp} XP</strong>.<br>Le groupe ramasse <strong>${gil} Gils</strong> (total : ${GameState.gil}).`;
  if (drops.length) loot += `<br>Objets trouvés : <strong>${drops.join(", ")}</strong>`;
  const pages = [loot];

  if (levelUps.length) {
    const lines = levelUps.map(({ hero, level, learned }) =>
      `<strong>${hero.name}</strong> passe au niveau ${level} !` +
      learned.map(spell => `<br>${hero.name} apprend <strong>${spell}</strong> !`).join(""));
    pages.push({ html: lines.join("<br>"), sfx: "levelUp" });
  }
  return pages;
}

async function gameOver() {
  Sfx.play("gameOver");
  document.body.classList.add("game-over");
  await Dialog.show({ title: "Défaite", pages: GAME_OVER });
  document.body.classList.remove("game-over");
  backToTitle({ startLabel: "Nouvelle partie", canRetry: true });
}

// — Initialisation —

document.addEventListener("DOMContentLoaded", () => {
  // Un clic dans la fenêtre de dialogue vaut « Valider », sauf pendant un choix (il faut cliquer une option)
  $("#dialog").addEventListener("click", () => {
    if ($("#dialog-choices").hidden) Input.emit("confirm");
  });
  $("#target-hint").addEventListener("click", () => Menu.back());

  const soundButton = $("#sound-btn");
  const syncSound = () => soundButton.classList.toggle("off", !Sfx.enabled);
  soundButton.addEventListener("click", () => { Sfx.toggle(); syncSound(); });
  syncSound();

  backToTitle({ startLabel: "Nouvelle partie" });
});
