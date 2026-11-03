// game-flow.ts - Déroulement de la partie : titre, histoire, combats, fin

import { CHAPTERS, PROLOGUE, POWER_CHOICE, DRAGON_FATE, ENDINGS, GAME_OVER, GameState, endingOf } from "../data/game-data.ts";
import type { FateId, Page, PowerChoiceId } from "../data/game-data.ts";
import { grantRewards, restoreParty, type Rewards } from "../party/heroes.ts";
import { Battle, runBattle, isAlive, type Enemy } from "../battle/battle.ts";
import { pickOption } from "../battle/battle-menu.ts";
import { Sfx } from "../audio/sfx.ts";
import { Dialog } from "./dialog.ts";
import { TestMode, prepareTestStart } from "../dev/test-mode.ts";
import {
  $, showScreen, setSceneTint, renderIdleScene, updateBattleUI, victoryPose,
  animateSpare, animateFinishingBlow,
} from "../ui/view.ts";

// — Écran titre —

export async function backToTitle({ startLabel, canRetry = false }: { startLabel: string; canRetry?: boolean }) {
  showScreen("intro");
  $("#start-btn").textContent = startLabel;
  $("#retry-btn").hidden = !canRetry;

  const options = [...document.querySelectorAll<HTMLElement>(".title-option")].filter(button => !button.hidden);
  const chosen = options[await pickOption(options)];
  if (chosen.id === "retry-btn") retryChapter();
  else newGame();
}

// — Partie —

async function newGame() {
  GameState.reset();
  // Mode test (local) : départ direct au chapitre choisi, sans prologue, et pouvoir du Cœur déjà choisi
  const testStart = TestMode.startChapter;
  if (testStart !== null) prepareTestStart(testStart);
  if (TestMode.power !== null) GameState.power = TestMode.power;
  setSceneTint(GameState.currentChapter);
  renderIdleScene(GameState.party);
  showScreen("game");

  if (testStart === null) await Dialog.show({ title: "Prologue", pages: PROLOGUE });
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
    else if (result === "truce") await makeTruce(chapter.truce?.story ?? []);
    else if (spareable) await decideDragonFate(spareable);
    else {
      // Reddition (chapitre III) : les vaincus, à genoux, laissent passer le groupe
      if (chapter.surrender) await Dialog.show({ pages: chapter.surrender });
      // Cœur d'Aure-Hin (chapitre IV) : l'écho s'est défait en lumière, le pouvoir est offert
      if (chapter.afterVictory) await Dialog.show({ pages: chapter.afterVictory });
      if (chapter.powerChoice) await choosePower();
      await celebrateVictory();
    }

    GameState.chapterIndex++;
  }

  const ending = ENDINGS[endingOf(GameState.power, GameState.dragonSpared)];
  await Dialog.show({ title: "Épilogue", pages: ending.epilogue });
  backToTitle({ startLabel: "Rejouer" });
}

// Cœur d'Aure-Hin : prendre le pouvoir (bonus de combat, la vraie fin se ferme) ou le refuser
async function choosePower() {
  standUpParty();
  const choice = await Dialog.choose({
    text: POWER_CHOICE.question,
    options: (["take", "refuse"] satisfies PowerChoiceId[]).map(id => ({ id, label: POWER_CHOICE[id].label })),
  });
  GameState.power = choice === "take" ? "taken" : "refused";
  await Dialog.show({ pages: POWER_CHOICE[choice].scene });
}

// Le Dragon est à terre. Pouvoir pris : le rendre (puis Épargner · Achever) ou le garder (Achever seul).
// Sinon : Épargner · Achever. La fin qui suit se déduit des deux choix (endingOf).
async function decideDragonFate(dragon: Enemy) {
  standUpParty();

  let text = DRAGON_FATE.question;
  if (GameState.power === "taken") {
    const kept = await chooseFate(DRAGON_FATE.powerQuestion, ["return", "keep"]) === "keep";
    GameState.power = kept ? "kept" : "returned";
    if (!kept) Sfx.play("memory"); // l'or quitte Maelor (animation : MAE-30)
    text = kept ? DRAGON_FATE.kept : DRAGON_FATE.returned;
  }
  const choice = await chooseFate(text, GameState.power === "kept" ? ["kill"] : ["spare", "kill"]);
  GameState.dragonSpared = choice === "spare";
  const ending = ENDINGS[endingOf(GameState.power, GameState.dragonSpared)];

  if (GameState.dragonSpared) {
    await animateSpare(dragon);
    await Dialog.show({ pages: ending.scene });
  } else {
    const maelor = GameState.party.find(hero => hero.id === "maelor");
    if (!maelor) throw new Error("Maelor est absent du groupe");
    await animateFinishingBlow(maelor, dragon);
    await Dialog.show({ pages: ending.scene });
    await celebrateVictory();
  }
}

function chooseFate(text: string, ids: FateId[]) {
  return Dialog.choose({ text, options: ids.map(id => ({ id, label: DRAGON_FATE.labels[id] })) });
}

// Trêve (chapitre II) : chacun se relève, la scène se joue, puis les récompenses comme une victoire
async function makeTruce(story: Page[]) {
  standUpParty();
  for (const enemy of Battle.enemies.filter(enemy => !isAlive(enemy))) await animateSpare(enemy);
  await Dialog.show({ pages: story });
  await celebrateVictory("Alliance");
}

// Le combat est fini : les héros éteints se relèvent (à 1 PV) pour la scène qui suit
function standUpParty() {
  for (const hero of GameState.party.filter(hero => !isAlive(hero))) {
    hero.hp = 1;
    hero.state = "charging";
  }
  updateBattleUI();
}

async function celebrateVictory(title = "Victoire !") {
  Sfx.play("victory");
  victoryPose(GameState.party);
  const rewards = grantRewards(Battle.enemies);
  updateBattleUI();
  const pages = formatRewards(rewards);
  if (pages.length) await Dialog.show({ title, pages });
}

// Une récompense qui vaut 0 (XP, Couronnes) ne s'affiche pas
function formatRewards({ xp, gil, drops, levelUps }: Rewards) {
  const loot: string[] = [];
  if (xp > 0) loot.push(`Chaque héros debout gagne <strong>${xp} XP</strong>.`);
  if (gil > 0) loot.push(`Le groupe ramasse <strong>${gil} Couronnes</strong> (total : ${GameState.gil}).`);
  if (drops.length) loot.push(`Ajouté à la besace : <strong>${drops.join(", ")}</strong>`);
  const pages: Page[] = loot.length ? [loot.join("<br>")] : [];

  if (levelUps.length) {
    const lines = levelUps.map(({ hero, level, learned }) =>
      `<strong>${hero.name}</strong> passe au niveau ${level} !` +
      learned.map(spell => `<br>${hero.name} apprend <strong>${spell.name}</strong> !<br>${spell.desc}`).join(""));
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
