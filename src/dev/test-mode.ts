// test-mode.ts - Mode test, en local seulement : départ à un chapitre (?chapitre=N), jeu accéléré (?vitesse=X),
// pouvoir du Cœur déjà choisi (?pouvoir=pris ou refuse), combats gagnés ou perdus d'office (?combat=gagne ou perdu), scène peinte seule
// (?scene=lisiere), décor peint imposé à tous les chapitres (?decor=lisiere, MAE-95), rendu DOM forcé (?rendu=dom), compteur d'images/s pendant le jeu (?compteur=1) et aperçu des
// animations des combattants (?animations=1, MAE-30)
// Le site en ligne sert le même build que `npm run preview` : le mode se décide donc au nom d'hôte, à l'exécution.

import { CONFIG } from "../config.ts";
import { DECORS, isDecorId, type DecorId } from "../data/decors.ts";
import { CHAPTERS, type PowerState } from "../data/game-data.ts";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
// Adresses privées du réseau local : le test sur un téléphone en Wi-Fi (MAE-28). Le site en ligne n'en fait jamais partie.
const PRIVATE_NETWORK = /^(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;
const MAX_SPEED = 10;

// Le départ au chapitre choisi lui-même (XP, Couronnes) est dans game-flow.ts (startAtChapter), hors du DOM.
// startChapter : index du chapitre de départ (le numéro du titre moins un), null hors mode test
// power : pouvoir du Cœur posé au départ de la partie, null hors mode test
// winBattles : chaque ennemi tombe à 0 PV dès le début du combat, pour jouer la suite sans combattre
// loseBattles : chaque héros tombe à 0 PV dès le début du combat, pour atteindre l'écran de défaite
// scene : décor à afficher seul, à la place du jeu (MAE-28), null hors mode test
// sceneQuality : niveau de qualité de cette scène (?qualite=1, 2 ou 3), undefined pour le réglage par défaut
// decor : décor peint imposé à chaque chapitre, même sans décor déclaré (MAE-95) : voir les effets dans la scène peinte
// domOnly : les chapitres avec décor s'affichent quand même en DOM (MAE-29), pour comparer deux versions du jeu
// counter : compteur d'images/s à l'écran pendant les chapitres joués dans la scène peinte (MAE-29)
// animations : aperçu des animations des combattants, à la place du jeu (MAE-30)
// active : au moins un paramètre de test valide, vitesse comprise ; la sauvegarde n'est alors ni lue ni écrite (MAE-11)
export const TestMode: {
  active: boolean; startChapter: number | null; power: PowerState | null; winBattles: boolean; loseBattles: boolean;
  scene: DecorId | null; sceneQuality: 1 | 2 | 3 | undefined; decor: DecorId | null; domOnly: boolean; counter: boolean; animations: boolean;
} = {
  active: false, startChapter: null, power: null, winBattles: false, loseBattles: false, scene: null, sceneQuality: undefined, decor: null, domOnly: false, counter: false, animations: false,
};
const POWER_PARAM: Record<string, PowerState> = { pris: "taken", refuse: "refused" };

// Appelé une fois au démarrage (main.ts). Sans paramètre ou hors local, ne change rien.
export function setupTestMode() {
  if (!LOCAL_HOSTS.includes(location.hostname) && !PRIVATE_NETWORK.test(location.hostname)) return;

  const params = new URLSearchParams(location.search);
  const chapter = readParam(params, "chapitre", 1, CHAPTERS.length, true);
  const speed = readParam(params, "vitesse", 1, MAX_SPEED, false);
  const power = readPower(params);
  const battleOutcome = readBattleOutcome(params);
  const scene = readDecor(params, "scene");
  const decor = readDecor(params, "decor");
  const domOnly = readFlag(params, "rendu", "dom");
  const counter = readFlag(params, "compteur", "1");
  const animations = readFlag(params, "animations", "1");
  if (chapter === null && speed === null && power === null && battleOutcome === null && scene === null && decor === null && !domOnly && !counter && !animations) return;

  TestMode.active = true;
  if (chapter !== null) TestMode.startChapter = chapter - 1;
  TestMode.power = power;
  TestMode.winBattles = battleOutcome === "gagne";
  TestMode.loseBattles = battleOutcome === "perdu";
  TestMode.scene = scene;
  TestMode.decor = decor;
  TestMode.domOnly = domOnly;
  TestMode.counter = counter;
  TestMode.animations = animations;
  if (scene !== null) TestMode.sceneQuality = readSceneQuality(params);
  if (speed !== null && speed !== 1) applySpeed(speed);
  document.title = `[Test] ${document.title}`;
}

function readSceneQuality(params: URLSearchParams): 1 | 2 | 3 | undefined {
  const value = readParam(params, "qualite", 1, 3, true);
  return value === 1 || value === 2 || value === 3 ? value : undefined;
}

// Identifiant de décor d'un paramètre (scene, decor), ou null s'il est absent ou invalide (signalé dans la console)
function readDecor(params: URLSearchParams, name: string): DecorId | null {
  const raw = params.get(name);
  if (raw === null) return null;
  if (isDecorId(raw)) return raw;
  console.warn(`Mode test : « ${name}=${raw} » ignoré (attendu : ${Object.keys(DECORS).join(", ")})`);
  return null;
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

function readBattleOutcome(params: URLSearchParams) {
  const raw = params.get("combat");
  if (raw === null) return null;
  if (raw === "gagne" || raw === "perdu") return raw;
  console.warn(`Mode test : « combat=${raw} » ignoré (attendu : gagne ou perdu)`);
  return null;
}

// Paramètre à une seule valeur admise : vrai si elle est donnée, faux sinon (signalé dans la console)
function readFlag(params: URLSearchParams, name: string, expected: string) {
  const raw = params.get(name);
  if (raw === null) return false;
  if (raw === expected) return true;
  console.warn(`Mode test : « ${name}=${raw} » ignoré (attendu : ${expected})`);
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
