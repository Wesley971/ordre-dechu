// view.ts - Affichage : écrans, fenêtres du bas, menus, bandeau, chiffres et effets
//
// Les combattants eux-mêmes (sprites, poses, animations) sont la « scène » : stage.ts en DOM, src/scene/battle-stage.ts
// en 2,5D (MAE-29). Ce fichier ne joue aucun son : les sons sont dans dom-view.ts, les menus et le dialogue.

import { CONFIG } from "../config.ts";
import { GameState } from "../data/game-data.ts";
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
function listItemEl(c: Combatant)        { return document.querySelector<HTMLElement>(`[data-item="${c.id}"]`); }

export function showScreen(name: "intro" | "game") {
  $("#intro-screen").hidden = name !== "intro";
  $("#game").hidden = name !== "game";
}

export function setSceneTint(chapter: Chapter) {
  $("#battle-scene").style.setProperty("--scene-tint", chapter.tint || "transparent");
}

// — Fenêtres du bas —

export function renderPartyWindow(party: Hero[]) {
  const rows = party.map(hero => {
    const row = document.createElement("div");
    row.className = "party-row";
    row.dataset.row = hero.id;
    row.innerHTML = `
      <span class="p-name">${hero.name}</span>
      <span class="p-hp"><b></b><small></small></span>
      <span class="p-mp"></span>
      <span class="p-atb"><span class="atb-fill"></span></span>`;
    row.addEventListener("click", () => Menu.clickTarget(hero));
    return row;
  });
  $("#party-rows").replaceChildren(...rows);
  updateBattleUI();
}

export function renderEnemyList(enemies: Enemy[]) {
  const items = enemies.map(enemy => {
    const li = document.createElement("li");
    li.dataset.item = enemy.id;
    li.innerHTML = `<span>${enemy.name}</span><span class="e-hp"><span class="e-hp-fill"></span></span>`;
    li.addEventListener("click", () => Menu.clickTarget(enemy));
    return li;
  });
  $("#enemy-list").replaceChildren(...items);
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
      $(".p-hp b", row).textContent = String(hero.hp);
      $(".p-hp small", row).textContent = "/" + hero.maxHp;
      $(".p-mp", row).textContent = String(hero.mp);
    }
  }

  for (const enemy of Battle.enemies) {
    const item = listItemEl(enemy);
    if (!item) continue;
    item.hidden = !isAlive(enemy);
    $(".e-hp-fill", item).style.width = (enemy.hp / enemy.maxHp) * 100 + "%";
  }
  onUpdated?.();
}

export function updateAtbUI(heroes: Hero[]) {
  for (const hero of heroes) {
    const row = rowEl(hero);
    if (!row) continue;
    const fill = $(".atb-fill", row);
    fill.style.width = hero.atb + "%";
    fill.classList.toggle("full", isAlive(hero) && hero.state !== "charging");
  }
}

// — Menus —

// Même seuil que le @media de style.css
export function listColumns() {
  return window.matchMedia("(max-width: 640px)").matches ? 1 : 2;
}

function menuList(level: CommandLevel | ListLevel, depth: number, active: boolean) {
  const ul = document.createElement("ul");
  ul.className = "menu" + (active ? "" : " inactive") + (level.type === "list" ? " menu-grid" : "");
  level.entries.forEach((entry, i) => {
    const li = document.createElement("li");
    li.className = "menu-item" + (entry.disabled ? " disabled" : "") + (i === level.cursor ? " selected" : "");
    li.innerHTML = `<span>${entry.label}</span>${entry.detail ? `<span class="detail">${entry.detail}</span>` : ""}`;
    li.addEventListener("click", () => Menu.clickEntry(depth, i));
    li.addEventListener("mouseenter", () => Menu.hoverEntry(depth, i));
    ul.appendChild(li);
  });
  return ul;
}

function backLink() {
  const back = document.createElement("div");
  back.className = "menu-back";
  back.textContent = "◀ Retour";
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
  if (level.type === "list") {
    const entry = level.entries[level.cursor];
    $(".list-help", container).innerHTML = (entry && entry.help) || "&nbsp;";
  }
}

export function renderMenu(menu: MenuController) {
  const commandWindow = $("#command-window");
  const listWindow = $("#list-window");
  document.querySelectorAll(".targeted").forEach(el => el.classList.remove("targeted", "all"));
  $("#target-hint").hidden = true;

  const hero = menu.hero;
  commandWindow.hidden = !hero;
  $("#enemy-list").hidden = !!hero;
  listWindow.hidden = true;
  const top = menu.level;
  const [root] = menu.stack;
  if (!hero || !top || root.type !== "command") return updateBattleUI();

  commandWindow.replaceChildren();
  commandWindow.insertAdjacentHTML("beforeend", `<div class="window-title">${hero.name}</div>`);
  commandWindow.appendChild(menuList(root, 0, top === root));
  if (top !== root) commandWindow.appendChild(backLink());

  if (top.type === "list") {
    const entry = top.entries[top.cursor];
    const title = top.kind === "spell" ? `${hero.command} <span>PS ${hero.mp}/${hero.maxMp}</span>` : "Besace";
    listWindow.replaceChildren();
    listWindow.insertAdjacentHTML("beforeend", `<div class="window-title">${title}</div>`);
    listWindow.appendChild(menuList(top, menu.stack.length - 1, true));
    listWindow.insertAdjacentHTML("beforeend", `<div class="list-help">${(entry && entry.help) || "&nbsp;"}</div>`);
    listWindow.appendChild(backLink());
    listWindow.hidden = false;
  }

  if (top.type === "target") {
    const targets = menu.targetsOf(top);
    const chosen = top.all ? targets : [targets[top.cursor]];
    for (const c of chosen.filter(Boolean)) {
      for (const el of [spriteEl(c), rowEl(c), listItemEl(c)]) {
        if (el) el.classList.add("targeted", ...(top.all ? ["all"] : []));
      }
    }
    // Pendant le ciblage, la liste des ennemis reste visible pour voir les noms
    $("#enemy-list").hidden = false;
    commandWindow.hidden = true;
    // Nom et aide de la capacité ou de l'objet choisi : au toucher, la liste se ferme aussitôt (MAE-74)
    const help = top.ability.desc ? `<strong>${top.ability.name}</strong> · ${top.ability.desc}` : "";
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
  anchor.appendChild(popup);
  setTimeout(() => popup.remove(), CONFIG.timing.popup);
}

export function spawnFx(anchor: HTMLElement, visual: string) {
  const fx = document.createElement("div");
  fx.className = "fx fx-" + visual;
  anchor.appendChild(fx);
  setTimeout(() => fx.remove(), CONFIG.timing.spellFx);
}
