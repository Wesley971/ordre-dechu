// script.js - Déroulement de la partie : titre, histoire, combats, fin

// — Écran titre —

let titleActive = false;
let titleIndex = 0;

function titleOptions() {
  return [...document.querySelectorAll(".title-option")].filter(button => !button.hidden);
}

function highlightTitleOption() {
  titleOptions().forEach((button, i) => button.classList.toggle("selected", i === titleIndex));
}

function titleHandler(action) {
  const options = titleOptions();
  if (action === "up" || action === "down") {
    titleIndex = (titleIndex + (action === "up" ? -1 : 1) + options.length) % options.length;
    Sfx.play("cursor");
    highlightTitleOption();
  }
  if (action === "confirm") options[titleIndex].click();
}

// Survol à la souris : la main suit le pointeur, comme dans les menus de combat
function hoverTitleOption(button) {
  if (!titleActive) return;
  titleIndex = titleOptions().indexOf(button);
  highlightTitleOption();
}

function backToTitle({ startLabel, canRetry = false }) {
  showScreen("intro");
  $("#start-btn").textContent = startLabel;
  $("#retry-btn").hidden = !canRetry;
  titleIndex = 0;
  highlightTitleOption();
  titleActive = true;
  Input.push(titleHandler);
}

// Renvoie false si l'écran titre n'est déjà plus actif (double clic...)
function leaveTitle() {
  if (!titleActive) return false;
  titleActive = false;
  Input.pop();
  Sfx.play("confirm");
  return true;
}

// — Partie —

async function newGame() {
  if (!leaveTitle()) return;
  GameState.reset();
  setSceneTint(CHAPTERS[0]);
  renderIdleScene(GameState.party);
  showScreen("game");

  await Dialog.show({ title: "Prologue", pages: PROLOGUE });
  await playChapters();
}

async function retryChapter() {
  if (!leaveTitle()) return;
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
      await Dialog.show({ title: chapter.title, pages: [{ html: chapter.story[0], sfx: "heal" }, ...chapter.story.slice(1)] });
      GameState.chapterIndex++;
      continue;
    }

    await Dialog.show({ title: chapter.title, pages: chapter.story });
    const result = await runBattle(chapter);

    if (result === "defeat") return gameOver();
    if (result === "victory") await celebrateVictory();
    else await Dialog.show({ pages: ["Le groupe s'enfonce dans les brumes... sans le moindre butin."] });

    GameState.chapterIndex++;
  }

  await Dialog.show({ title: "Épilogue", pages: ENDING });
  backToTitle({ startLabel: "Rejouer" });
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
  $("#start-btn").addEventListener("click", newGame);
  $("#retry-btn").addEventListener("click", retryChapter);
  for (const button of document.querySelectorAll(".title-option")) {
    button.addEventListener("mouseenter", () => hoverTitleOption(button));
  }
  $("#dialog").addEventListener("click", () => Input.emit("confirm"));
  $("#target-hint").addEventListener("click", () => Menu.back());

  const soundButton = $("#sound-btn");
  const syncSound = () => soundButton.classList.toggle("off", !Sfx.enabled);
  soundButton.addEventListener("click", () => { Sfx.toggle(); syncSound(); });
  syncSound();

  backToTitle({ startLabel: "Nouvelle partie" });
});
