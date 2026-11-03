// test-mode.ts - Mode test, en local seulement : départ à un chapitre (?chapitre=N), jeu accéléré (?vitesse=X)
// pouvoir du Cœur déjà choisi (?pouvoir=pris ou refuse) et combats gagnés d'office (?combat=gagne)
// Le site en ligne sert le même build que `npm run preview` : le mode se décide donc au nom d'hôte, à l'exécution.

import { CONFIG } from "../config.ts";
import { CHAPTERS, ENEMIES, GameState, type PowerState } from "../data/game-data.ts";
import { gainXp } from "../party/heroes.ts";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const MAX_SPEED = 10;

// startChapter : index du chapitre de départ (le numéro du titre moins un), null hors mode test
// power : pouvoir du Cœur posé au départ de la partie, null hors mode test
// winBattles : chaque ennemi tombe à 0 PV dès le début du combat, pour jouer la suite sans combattre
export const TestMode: { startChapter: number | null; power: PowerState | null; winBattles: boolean } = {
  startChapter: null, power: null, winBattles: false,
};
const POWER_PARAM: Record<string, PowerState> = { pris: "taken", refuse: "refused" };

// Appelé une fois au démarrage (main.ts). Sans paramètre ou hors local, ne change rien.
export function setupTestMode() {
  if (!LOCAL_HOSTS.includes(location.hostname)) return;

  const params = new URLSearchParams(location.search);
  const chapter = readParam(params, "chapitre", 1, CHAPTERS.length, true);
  const speed = readParam(params, "vitesse", 1, MAX_SPEED, false);
  const power = readPower(params);
  const winBattles = readWinBattles(params);
  if (chapter === null && speed === null && power === null && !winBattles) return;

  if (chapter !== null) TestMode.startChapter = chapter - 1;
  TestMode.power = power;
  TestMode.winBattles = winBattles;
  if (speed !== null && speed !== 1) applySpeed(speed);
  document.title = `[Test] ${document.title}`;
}

// Valeur numérique d'un paramètre, ou null s'il est absent ou invalide (signalé dans la console)
function readParam(params: URLSearchParams, name: string, min: number, max: number, integer: boolean) {
  const raw = params.get(name);
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    console.warn(`Mode test : « ${name}=${raw} » ignoré (attendu : ${integer ? "entier " : ""}de ${min} à ${max})`);
    return null;
  }
  return value;
}

function readPower(params: URLSearchParams): PowerState | null {
  const raw = params.get("pouvoir");
  if (raw === null) return null;
  if (Object.hasOwn(POWER_PARAM, raw)) return POWER_PARAM[raw];
  console.warn(`Mode test : « pouvoir=${raw} » ignoré (attendu : pris ou refuse)`);
  return null;
}

function readWinBattles(params: URLSearchParams) {
  const raw = params.get("combat");
  if (raw === null) return false;
  if (raw === "gagne") return true;
  console.warn(`Mode test : « combat=${raw} » ignoré (attendu : gagne)`);
  return false;
}

// Durées JS divisées, jauges ATB plus rapides, et animations CSS lues à la même vitesse pour rester synchronisées
function applySpeed(speed: number) {
  const timing: Record<string, number> = CONFIG.timing;
  for (const [key, ms] of Object.entries(timing)) timing[key] = ms / speed;
  CONFIG.atb.fillRate *= speed;

  // Chaque animation ou transition CSS est accélérée dès son apparition, délai compris
  const speedUpAnimations = () => {
    for (const animation of document.getAnimations()) {
      if (animation.playbackRate !== speed) animation.playbackRate = speed;
    }
    requestAnimationFrame(speedUpAnimations);
  };
  requestAnimationFrame(speedUpAnimations);
}

// Nouvelle partie au chapitre choisi : groupe nourri de l'XP et des Couronnes de tous les combats précédents,
// PV et PS pleins, objets de départ seulement (les objets trouvés sont aléatoires)
export function prepareTestStart(chapterIndex: number) {
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
