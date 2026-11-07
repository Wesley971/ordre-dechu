// game-flow.ts - Déroulement de la partie : titre, histoire, combats, fin
//
// Tout passe par la vue reçue dans startGame (GameView, src/game-view.ts) : aucun DOM, aucun son ici.

import {
  CHAPTERS, ELEMENT_NAMES, ENEMIES, PROLOGUE, POWER_CHOICE, DRAGON_FATE, ENDINGS, GAME_OVER, GameState, endingOf, isValidCheckpoint,
} from "../data/game-data.ts";
import type { FateId, Page, PowerChoiceId, PowerState } from "../data/game-data.ts";
import { SaveGame } from "../data/save-game.ts";
import { gainXp, grantRewards, restoreParty, type Rewards } from "../party/heroes.ts";
import { Battle, runBattle, isAlive, type Enemy } from "../battle/battle.ts";
import { noView, type GameView } from "../game-view.ts";

// Options du mode test (src/dev/test-mode.ts), toutes neutres hors mode test
export interface GameOptions {
  startChapter: number | null; // index du chapitre de départ, sans prologue
  power: PowerState | null;    // pouvoir du Cœur déjà choisi au départ
  winBattles: boolean;         // chaque combat est gagné d'office
  loseBattles: boolean;        // chaque combat est perdu d'office
}

let view: GameView = noView();
let options: GameOptions = { startChapter: null, power: null, winBattles: false, loseBattles: false };

// Point d'entrée : la partie commence à l'écran titre
export function startGame(gameView: GameView, gameOptions: GameOptions) {
  view = gameView;
  options = gameOptions;
  void backToTitle({ startLabel: "Nouvelle partie" });
}

// — Écran titre —

async function backToTitle({ startLabel, canRetry = false }: { startLabel: string; canRetry?: boolean }) {
  view.music("title"); // continue pendant le prologue ; reprend à l'épilogue et sur « Rejouer »
  // Sauvegarde du navigateur (MAE-11) : après une défaite, « Réessayer » reprend déjà au même point
  const saved = canRetry ? null : SaveGame.read();
  const choice = await view.showTitle({ startLabel, canRetry, canContinue: isValidCheckpoint(saved) });
  if (choice === "retry") void resumeChapter();
  else if (choice === "continue") {
    GameState.checkpoint = saved;
    void resumeChapter();
  }
  else void newGame();
}

// — Partie —

async function newGame() {
  GameState.reset();
  // Mode test (local) : départ direct au chapitre choisi, sans prologue, et pouvoir du Cœur déjà choisi
  const testStart = options.startChapter;
  if (testStart !== null) startAtChapter(testStart);
  if (options.power !== null) GameState.power = options.power;
  await view.showChapter(GameState.currentChapter, GameState.party);

  if (testStart === null) await view.tell({ title: "Prologue", pages: PROLOGUE });
  await playChapters();
}

// Nouvelle partie au chapitre choisi : groupe nourri de l'XP et des Couronnes de tous les combats précédents,
// PV et PS pleins, objets de départ seulement (les objets trouvés sont aléatoires). Mode test et vue muette.
export function startAtChapter(chapterIndex: number) {
  let xp = 0, gil = 0;
  for (const chapter of CHAPTERS.slice(0, chapterIndex)) {
    if (chapter.rest) continue;
    for (const key of chapter.enemies) {
      xp += ENEMIES[key].xp;
      gil += ENEMIES[key].gil;
    }
  }
  for (const hero of GameState.party) {
    gainXp(hero, xp);
    hero.hp = hero.maxHp;
    hero.mp = hero.maxMp;
  }
  GameState.gil += gil;
  GameState.chapterIndex = chapterIndex;
}

// « Réessayer le combat » et « Continuer » : reprise au début du chapitre du point de reprise
async function resumeChapter() {
  GameState.loadCheckpoint();
  await playChapters();
}

async function playChapters() {
  while (GameState.chapterIndex < CHAPTERS.length) {
    const chapter = GameState.currentChapter;
    GameState.saveCheckpoint();
    SaveGame.write(GameState.checkpoint); // une nouvelle partie ne remplace la sauvegarde qu'ici, au chapitre I
    await view.showChapter(chapter, GameState.party);
    view.music(chapter.music);

    if (chapter.rest) {
      restoreParty();
      view.refresh();
      await view.tell({ title: chapter.title, pages: chapter.story });
      GameState.chapterIndex++;
      continue;
    }

    await view.tell({ title: chapter.title, pages: chapter.story });
    view.music(chapter.battleMusic ?? "battle");
    const result = await runBattle(view, chapter, { winBattles: options.winBattles, loseBattles: options.loseBattles });

    if (result === "defeat") return gameOver();
    const spareable = Battle.enemies.find(enemy => enemy.spareable);
    // Après le combat, la musique du chapitre revient ; face au Dragon, Lost Time continue jusqu'au choix
    if (!spareable) view.music(chapter.music);
    if (result === "escape") await view.tell({ pages: ["Le groupe s'enfonce dans les brumes... sans le moindre butin."] });
    else if (result === "truce") await makeTruce(chapter.truce?.story ?? []);
    else if (spareable) await decideDragonFate(spareable);
    else {
      // Reddition (chapitre III) : les vaincus, à genoux, laissent passer le groupe
      if (chapter.surrender) await view.tell({ pages: chapter.surrender });
      // Cœur d'Aure-Hin (chapitre IV) : l'écho s'est défait en lumière, le pouvoir est offert
      if (chapter.afterVictory) await view.tell({ pages: chapter.afterVictory });
      if (chapter.powerChoice) await choosePower();
      await celebrateVictory();
    }

    GameState.chapterIndex++;
  }

  const ending = ENDINGS[endingOf(GameState.power, GameState.dragonSpared)];
  SaveGame.clear(); // la fin est atteinte : fermer pendant l'épilogue ne ramène pas au chapitre VII
  view.music("title");
  await view.tell({ title: "Épilogue", pages: ending.epilogue });
  void backToTitle({ startLabel: "Rejouer" });
}

// Cœur d'Aure-Hin : prendre le pouvoir (bonus de combat, la vraie fin se ferme) ou le refuser
async function choosePower() {
  standUpParty();
  const choice = await view.ask({
    text: POWER_CHOICE.question,
    options: (["take", "refuse"] satisfies PowerChoiceId[]).map(id => ({ id, label: POWER_CHOICE[id].label })),
  });
  GameState.power = choice === "take" ? "taken" : "refused";
  await view.tell({ pages: POWER_CHOICE[choice].scene });
}

// Le Dragon est à terre. Pouvoir pris : le rendre (puis Épargner · Achever) ou le garder (Achever seul).
// Sinon : Épargner · Achever. La fin qui suit se déduit des deux choix (endingOf).
async function decideDragonFate(dragon: Enemy) {
  standUpParty();
  const maelor = GameState.party.find(hero => hero.id === "maelor");
  if (!maelor) throw new Error("Maelor est absent du groupe");

  let text = DRAGON_FATE.question;
  if (GameState.power === "taken") {
    const kept = await chooseFate(DRAGON_FATE.powerQuestion, ["return", "keep"]) === "keep";
    GameState.power = kept ? "kept" : "returned";
    if (!kept) view.animatePowerReturn(maelor);
    text = kept ? DRAGON_FATE.kept : DRAGON_FATE.returned;
  }
  const choice = await chooseFate(text, GameState.power === "kept" ? ["kill"] : ["spare", "kill"]);
  GameState.dragonSpared = choice === "spare";
  const ending = ENDINGS[endingOf(GameState.power, GameState.dragonSpared)];
  view.music(null); // la scène de fin se joue en silence

  if (GameState.dragonSpared) {
    await view.animateSpare(dragon);
    await view.tell({ pages: ending.scene });
  } else {
    await view.animateFinishingBlow(maelor, dragon);
    await view.tell({ pages: ending.scene });
    await celebrateVictory();
  }
}

function chooseFate(text: string, ids: FateId[]) {
  return view.ask({ text, options: ids.map(id => ({ id, label: DRAGON_FATE.labels[id] })) });
}

// Trêve (chapitre II) : chacun se relève, la scène se joue, puis les récompenses comme une victoire
async function makeTruce(story: Page[]) {
  standUpParty();
  for (const enemy of Battle.enemies.filter(enemy => !isAlive(enemy))) await view.animateSpare(enemy);
  await view.tell({ pages: story });
  await celebrateVictory("Alliance");
}

// Le combat est fini : les héros éteints se relèvent (à 1 PV) pour la scène qui suit
function standUpParty() {
  for (const hero of GameState.party.filter(hero => !isAlive(hero))) {
    hero.hp = 1;
    hero.state = "charging";
  }
  view.refresh();
}

async function celebrateVictory(title = "Victoire !") {
  view.celebrate(GameState.party, title);
  const rewards = grantRewards(Battle.enemies);
  view.refresh();
  const pages = formatRewards(rewards);
  if (pages.length) await view.tell({ title, pages });
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
      learned.map(spell => {
        // Élément et coût après le nom, puis l'aide de la capacité (planche G6)
        const facts = [spell.element && ELEMENT_NAMES[spell.element], `${spell.mp} PS`].filter(Boolean).join(" · ");
        return `<br>${hero.name} apprend <strong>${spell.name}</strong> <span class="page-detail">· ${facts}</span><br><em>${spell.desc}</em>`;
      }).join(""));
    pages.push({
      html: lines.join("<br>"), sfx: "levelUp",
      levelUps: levelUps.map(({ hero, level }) => ({ heroId: hero.id, level })),
    });
  }
  return pages;
}

async function gameOver() {
  view.music(null); // défaite : seuls les bruitages
  await view.showDefeat({ title: "Défaite", pages: GAME_OVER });
  void backToTitle({ startLabel: "Nouvelle partie", canRetry: true });
}
