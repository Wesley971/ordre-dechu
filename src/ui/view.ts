// view.ts - Affichage : écrans, fenêtres du bas, menus, bandeau, chiffres et effets
//
// Les combattants eux-mêmes (sprites, poses, animations) sont la « scène » : stage.ts en DOM, src/scene/battle-stage.ts
// en 2,5D (MAE-29). Ce fichier ne joue aucun son : les sons sont dans dom-view.ts, les menus et le dialogue.

import { CONFIG } from "../config.ts";
import { ELEMENT_NAMES, GameState, HEROES } from "../data/game-data.ts";
import type { Ability, Chapter } from "../data/game-data.ts";
import type { Hero } from "../party/heroes.ts";
import type { SoundName } from "../audio/sfx.ts";
import { Battle, isAlive } from "../battle/battle.ts";
import type { Combatant, Effect, Enemy } from "../battle/battle.ts";
import { Menu } from "./battle-menu.ts";
import type { CommandLevel, ListLevel, MenuController } from "./battle-menu.ts";

// Élément de la page, qui doit exister : son absence est une erreur de structure de index.html
export function $(selector: string, root: ParentNode = document) {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Élément introuvable : ${selector}`);
  return element;
}

export const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Ajoute une classe le temps d'une animation
export async function pulse(el: HTMLElement | null, className: string, duration: number) {
  if (!el) return wait(duration);
  el.classList.remove(className);
  void el.offsetWidth; // force le navigateur à rejouer l'animation
  el.classList.add(className);
  await wait(duration);
  el.classList.remove(className);
}

// Éléments d'un combattant, absents tant que la scène n'est pas construite.
// [data-sprite] est le sprite DOM, ou l'ancre posée sur le sprite de la scène peinte.
export function spriteEl(c: Combatant)   { return document.querySelector<HTMLElement>(`[data-sprite="${c.id}"]`); }
function rowEl(c: Combatant)             { return document.querySelector<HTMLElement>(`[data-row="${c.id}"]`); }

export function showScreen(name: "intro" | "game") {
  $("#intro-screen").hidden = name !== "intro";
  $("#game").hidden = name !== "game";
  document.body.classList.toggle("in-game", name === "game");
}

export function setSceneTint(chapter: Chapter) {
  $("#battle-scene").style.setProperty("--scene-tint", chapter.tint || "transparent");
}

// — Le groupe —

export function renderPartyWindow(party: Hero[]) {
  const rows = party.map(hero => {
    const row = document.createElement("div");
    row.className = "od-hero";
    row.dataset.row = hero.id;
    row.innerHTML = `
      <div class="od-hero-head"><span class="od-hero-name">${hero.name}</span><span class="od-turn"></span></div>
      <span class="od-bar" role="img"><i class="od-trail"></i><i class="od-fill"></i></span>
      <span class="od-mp-line" aria-hidden="true"><i></i></span>
      <div class="od-hero-values"><span class="od-hp"><b></b> <small></small></span><span class="od-mp"></span></div>`;
    row.addEventListener("click", () => Menu.clickTarget(hero));
    return row;
  });
  $("#party-rows").replaceChildren(...rows);
  updateBattleUI();
}

// Remplit une barre de vie ; le trait clair (od-trail) suit la barre avec du retard, par une transition de style.css
function setBar(bar: HTMLElement, percent: number, label: string) {
  $(".od-fill", bar).style.width = percent + "%";
  $(".od-trail", bar).style.width = percent + "%";
  bar.setAttribute("aria-label", label);
}

// Écrit un texte seulement s'il change : la jauge passe ici à chaque image
function setText(element: HTMLElement, text: string) {
  if (element.textContent !== text) element.textContent = text;
}

// Le boss du combat en cours, dont la barre s'affiche en bas au centre (planche G4)
let shownBoss: Enemy | null = null;
export function setBossPanel(boss: Enemy | null) {
  shownBoss = boss;
  if (boss) $("#boss-panel .od-boss-name").textContent = boss.name;
}

// La jauge ne s'affiche que pendant un combat
let battleRunning = false;
export function setBattleRunning(running: boolean) { battleRunning = running; }

// À droite du nom : « tombé », « prêt », ou la jauge en pourcentage
function turnLabel(hero: Hero) {
  const accord = HEROES.find(def => def.id === hero.id)?.feminine ? "e" : "";
  if (!isAlive(hero)) return "tombé" + accord;
  if (!battleRunning) return "";
  return hero.state === "ready" ? "prêt" + accord : `${Math.round(hero.atb)} %`;
}

// — Mise à jour —

// Pose d'un héros d'après l'état du combat : classes des sprites DOM et des lignes du groupe, poses de la scène peinte
export function heroFlags(hero: Hero) {
  const alive = isAlive(hero);
  return {
    ko: !alive,
    critical: alive && hero.hp / hero.maxHp < CONFIG.criticalPct,
    active: Menu.hero === hero,
    ready: hero.state === "ready",
    defending: hero.defending,
  };
}

// Prévenu après chaque mise à jour : la scène peinte y relit les poses (dom-view.ts)
let onUpdated: (() => void) | null = null;
export function onBattleUiUpdated(listener: (() => void) | null) { onUpdated = listener; }

export function updateBattleUI() {
  for (const hero of GameState.party) {
    const flags = heroFlags(hero);
    const sprite = spriteEl(hero), row = rowEl(hero);
    for (const [flag, on] of Object.entries(flags)) {
      if (sprite) sprite.classList.toggle(flag, on);
      if (row) row.classList.toggle(flag, on);
    }
    // relevé : sa prochaine extinction rejouera la chute
    if (sprite && !flags.ko) sprite.classList.remove("fallen");
    if (row) {
      setBar($(".od-bar", row), (hero.hp / hero.maxHp) * 100, flags.ko ? `${hero.name} est à terre` : `${hero.hp} PV sur ${hero.maxHp}`);
      $(".od-mp-line > i", row).style.width = (hero.mp / hero.maxMp) * 100 + "%";
      $(".od-hp b", row).textContent = String(hero.hp);
      $(".od-hp small", row).textContent = "/ " + hero.maxHp;
      $(".od-mp", row).textContent = hero.mp + " PS";
      setText($(".od-turn", row), turnLabel(hero));
    }
  }

  for (const enemy of Battle.enemies) {
    const foe = spriteEl(enemy)?.querySelector<HTMLElement>(".od-foe");
    if (!foe) continue;
    foe.hidden = !isAlive(enemy);
    const percent = (enemy.hp / enemy.maxHp) * 100;
    setBar($(".od-bar", foe), percent, `${enemy.name}, ${Math.round(percent)} % de vie`);
  }

  const bossPanel = $("#boss-panel");
  bossPanel.hidden = !shownBoss || !isAlive(shownBoss);
  if (shownBoss) {
    const percent = (shownBoss.hp / shownBoss.maxHp) * 100;
    setBar($(".od-bar", bossPanel), percent, `${shownBoss.name}, ${Math.round(percent)} % de vie`);
  }
  onUpdated?.();
}

export function updateAtbUI(heroes: Hero[]) {
  for (const hero of heroes) {
    const row = rowEl(hero);
    if (row) setText($(".od-turn", row), turnLabel(hero));
  }
}

// — Menus —

function menuList(level: CommandLevel | ListLevel, depth: number, active: boolean) {
  const ul = document.createElement("ul");
  ul.className = "menu" + (active ? "" : " inactive");
  level.entries.forEach((entry, i) => {
    const li = document.createElement("li");
    li.className = "menu-item" + (entry.disabled ? " disabled" : "") + (i === level.cursor ? " selected" : "");
    const element = entry.element ? `<span class="menu-element">· ${entry.element}</span>` : "";
    li.innerHTML = `<span>${entry.label}</span>${element}${entry.detail ? `<span class="detail">${entry.detail}</span>` : ""}`;
    li.addEventListener("click", () => Menu.clickEntry(depth, i));
    li.addEventListener("mouseenter", () => Menu.hoverEntry(depth, i));
    ul.appendChild(li);
  });
  return ul;
}

function backLink() {
  const back = document.createElement("div");
  back.className = "menu-back";
  back.textContent = "◀\uFE0E Retour"; // \uFE0E : le triangle en texte, pas en emoji sur iPhone
  back.addEventListener("click", () => Menu.back());
  return back;
}

// Survol à la souris : on déplace seulement le curseur, sans reconstruire le menu
// (remplacer l'élément sous le pointeur ferait perdre le clic qui suit)
export function updateMenuCursor(menu: MenuController, depth: number) {
  const level = menu.stack[depth];
  if (level.type === "target") return;
  const container = level.type === "list" ? $("#list-window") : $("#command-window");
  container.querySelectorAll(".menu-item").forEach((li, i) => li.classList.toggle("selected", i === level.cursor));
}

export function renderMenu(menu: MenuController) {
  const commandWindow = $("#command-window");
  const listWindow = $("#list-window");
  document.querySelectorAll(".targeted").forEach(el => el.classList.remove("targeted", "all"));
  $("#target-hint").hidden = true;

  const hero = menu.hero;
  $("#action-window").hidden = !hero;
  $("#action-window").setAttribute("aria-label", hero ? `Commandes de ${hero.name}` : "Commandes");
  commandWindow.hidden = !hero;
  listWindow.hidden = true;
  const top = menu.level;
  const [root] = menu.stack;
  if (!hero || !top || root.type !== "command") return updateBattleUI();

  commandWindow.replaceChildren();
  commandWindow.insertAdjacentHTML("beforeend", `<div class="window-title">${hero.name}</div>`);
  commandWindow.appendChild(menuList(root, 0, top === root));

  if (top.type === "list") {
    const title = top.kind === "spell" ? hero.command : "Besace";
    listWindow.replaceChildren();
    listWindow.insertAdjacentHTML("beforeend", `<div class="window-title">${hero.name} · ${title}</div>`);
    listWindow.appendChild(menuList(top, menu.stack.length - 1, true));
    listWindow.appendChild(backLink());
    listWindow.hidden = false;
  }

  if (top.type === "target") {
    const targets = menu.targetsOf(top);
    const chosen = top.all ? targets : [targets[top.cursor]];
    for (const c of chosen.filter(Boolean)) {
      for (const el of [spriteEl(c), rowEl(c)]) {
        if (el) el.classList.add("targeted", ...(top.all ? ["all"] : []));
      }
    }
    commandWindow.hidden = true;
    // Nom, élément, coût et aide de la capacité ou de l'objet choisi : au toucher, la liste se ferme aussitôt (MAE-74, planche G2)
    const { ability } = top;
    $("#target-title").textContent = `${hero.name} · Choisir une cible`;
    const facts = [
      "element" in ability && ability.element ? ELEMENT_NAMES[ability.element] : "",
      "mp" in ability && ability.mp ? `${ability.mp} PS` : "",
    ].filter(Boolean).map(fact => ` · ${fact}`).join("");
    const help = ability.desc
      ? `<div class="target-name">${ability.name}<span class="menu-element">${facts}</span></div><div class="target-desc">${ability.desc}</div>`
      : "";
    $("#target-help").innerHTML = help;
    $("#target-help").hidden = !help;
    $("#target-hint").hidden = false;
  }

  updateBattleUI();
}

// — Bandeau —

export function showBanner(text: string) {
  const banner = $("#battle-banner");
  banner.innerHTML = text;
  banner.hidden = false;
}

export function hideBanner() {
  $("#battle-banner").hidden = true;
}

export async function showMessage(text: string, duration = CONFIG.timing.message) {
  showBanner(text);
  await wait(duration);
  hideBanner();
}

// — Chiffres et effets, posés sur l'ancre d'un combattant —

export function effectVisual(ability: Ability) {
  if (ability.element) return ability.element;
  if (ability.kind === "physical") return "slash";
  return "heal";
}

export function effectSound(effect: Effect, ability: Ability): SoundName {
  if (effect.type === "miss") return "miss";
  if (effect.type === "none") return "error";
  if (effect.type === "mp")   return "item";
  if (effect.type === "heal" || effect.type === "revive") return "heal";
  if (ability.element) return ability.element;
  if (ability.kind !== "physical") return "magic";
  return effect.crit ? "crit" : "hit";
}

export function popupText(effect: Effect) {
  switch (effect.type) {
    case "miss": return "Raté";
    case "none": return "Sans effet";
    case "mp":   return effect.amount + " PS";
    case "heal":
    case "revive": return "+" + effect.amount; // planche G3 : un soin porte toujours le « + »
    default:     return String(effect.amount);
  }
}

export function popupClasses(effect: Effect) {
  return [effect.type, effect.crit && "crit", effect.weak && "weak"].filter(Boolean).join(" ");
}

export function spawnPopup(anchor: HTMLElement, text: string, className: string) {
  const popup = document.createElement("span");
  popup.className = "popup " + className;
  popup.textContent = text;
  // Planche G3 : une faiblesse se dit toujours aussi par le mot, au-dessus du chiffre
  if (popup.classList.contains("weak")) popup.insertAdjacentHTML("afterbegin", `<span class="popup-word">Faiblesse</span>`);
  anchor.appendChild(popup);
  setTimeout(() => popup.remove(), CONFIG.timing.popup);
}

export function spawnFx(anchor: HTMLElement, visual: string) {
  const fx = document.createElement("div");
  fx.className = "fx fx-" + visual;
  anchor.appendChild(fx);
  setTimeout(() => fx.remove(), CONFIG.timing.spellFx);
}
