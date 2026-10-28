// view.ts - Affichage : scène de combat, fenêtres, menus, animations

import { CONFIG } from "../config.ts";
import { ATTACK, GameState, HEROES } from "../data/game-data.ts";
import type { Ability, Chapter } from "../data/game-data.ts";
import type { Hero } from "../party/heroes.ts";
import { Sfx, type SoundName } from "../audio/sfx.ts";
import { Battle, isAlive, wait } from "../battle/battle.ts";
import type { BattleState, Combatant, Effect, Enemy } from "../battle/battle.ts";
import { Menu } from "../battle/battle-menu.ts";
import type { CommandLevel, ListLevel, MenuController } from "../battle/battle-menu.ts";

// Élément de la page, qui doit exister : son absence est une erreur de structure de index.html
export function $(selector: string, root: ParentNode = document) {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Élément introuvable : ${selector}`);
  return element;
}

// Positions (en % de la zone) selon le nombre d'ennemis, et des héros en diagonale
const FORMATIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[65, 30], [38, 70]],
  3: [[72, 22], [34, 50], [72, 80]],
};
const HERO_SLOTS: [number, number][] = [[78, 28], [50, 52], [22, 76]];

// Toile commune des sprites de héros, en pixels de sprite (affichée ×3 sur ordinateur, ×1 sur mobile)
const HERO_CANVAS = { w: 47, h: 66 };

// Éléments d'un combattant, absents tant que la scène n'est pas construite
function spriteEl(c: Combatant)   { return document.querySelector<HTMLElement>(`[data-sprite="${c.id}"]`); }
function rowEl(c: Combatant)      { return document.querySelector<HTMLElement>(`[data-row="${c.id}"]`); }
function listItemEl(c: Combatant) { return document.querySelector<HTMLElement>(`[data-item="${c.id}"]`); }

// Sprite d'un combattant présent sur la scène
function sceneSprite(c: Combatant) { return $(`[data-sprite="${c.id}"]`); }

export function showScreen(name: "intro" | "game") {
  $("#intro-screen").hidden = name !== "intro";
  $("#game").hidden = name !== "game";
}

export function setSceneTint(chapter: Chapter) {
  $("#battle-scene").style.setProperty("--scene-tint", chapter.tint || "transparent");
}

// — Construction de la scène —

function createSprite(c: Combatant, [x, y]: [number, number]) {
  const sprite = document.createElement("div");
  sprite.className = `sprite ${c.side}${c.boss ? " boss" : ""}`;
  sprite.dataset.sprite = c.id;
  sprite.style.left = x + "%";
  sprite.style.top = y + "%";
  sprite.innerHTML = `<div class="sprite-body"><img class="sprite-img" src="${c.image}" alt="${c.name}">${embersHtml(c)}</div>`;
  sprite.addEventListener("click", () => Menu.clickTarget(c));
  if (c.side === "hero") {
    // Un héros déjà K.O. quand la scène est construite est posé à terre, sans rejouer sa chute
    if (!isAlive(c)) sprite.classList.add("ko", "fallen");
    const img = sprite.querySelector<HTMLImageElement>(".sprite-img");
    if (img) measureKoLift(sprite, img);
  }
  return sprite;
}

// Couché, le héros pivote autour de ses pieds, tête vers les ennemis : sa colonne opaque la plus à droite devient
// son point le plus bas. --ko-lift (en pixels de sprite) le remonte de ce qu'il faut pour que ce point touche la ligne de sol.
function measureKoLift(sprite: HTMLElement, img: HTMLImageElement) {
  const measure = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx || !canvas.width) return;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let x = canvas.width - 1; x >= 0; x--) {
      for (let y = 0; y < canvas.height; y++) {
        if (data[(y * canvas.width + x) * 4 + 3]) {
          sprite.style.setProperty("--ko-lift", String(x + 1 - canvas.width / 2));
          return;
        }
      }
    }
  };
  if (img.complete) measure();
  else img.addEventListener("load", measure, { once: true });
}

// Braises qui montent des bords enflammés d'un héros (Elwen), décalées dans le temps
function embersHtml(c: Combatant) {
  const embers = HEROES.find(def => def.id === c.id)?.embers || [];
  return embers.map(([x, y], i) => {
    const left = (x / HERO_CANVAS.w) * 100, top = (y / HERO_CANVAS.h) * 100;
    return `<span class="ember" style="left: ${left}%; top: ${top}%; animation-delay: ${-i * 0.37}s"></span>`;
  }).join("");
}

// Scène sans combat : le groupe seul, entre deux affrontements
export function renderIdleScene(party: Hero[]) {
  $("#enemy-area").replaceChildren();
  $("#enemy-list").replaceChildren();
  $("#hero-area").replaceChildren(...party.map((hero, i) => createSprite(hero, HERO_SLOTS[i])));
  renderPartyWindow(party);
  renderMenu(Menu);
}

export function renderBattle(state: BattleState) {
  renderIdleScene(state.heroes);
  const slots = FORMATIONS[state.enemies.length];
  $("#enemy-area").replaceChildren(...state.enemies.map((enemy, i) => createSprite(enemy, slots[i])));
  renderEnemyList(state.enemies);
  updateBattleUI();
}

function renderPartyWindow(party: Hero[]) {
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

function renderEnemyList(enemies: Enemy[]) {
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

export function updateBattleUI() {
  for (const hero of GameState.party) {
    const alive = isAlive(hero);
    const flags = {
      ko: !alive,
      critical: alive && hero.hp / hero.maxHp < CONFIG.criticalPct,
      active: Menu.hero === hero,
      ready: hero.state === "ready",
      defending: hero.defending,
    };
    const sprite = spriteEl(hero), row = rowEl(hero);
    for (const [flag, on] of Object.entries(flags)) {
      if (sprite) sprite.classList.toggle(flag, on);
      if (row) row.classList.toggle(flag, on);
    }
    // relevé : son prochain K.O. rejouera la chute
    if (sprite && alive) sprite.classList.remove("fallen");
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
    const title = top.kind === "spell" ? `${hero.command} <span>PS ${hero.mp}/${hero.maxMp}</span>` : "Objets";
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
    $("#target-hint").hidden = false;
  }

  updateBattleUI();
}

// — Messages et animations —

function showBanner(text: string) {
  const banner = $("#battle-banner");
  banner.innerHTML = text;
  banner.hidden = false;
}

function hideBanner() {
  $("#battle-banner").hidden = true;
}

export async function showMessage(text: string, duration = CONFIG.timing.message) {
  showBanner(text);
  await wait(duration);
  hideBanner();
}

// Ajoute une classe le temps d'une animation
async function pulse(el: HTMLElement | null, className: string, duration: number) {
  if (!el) return wait(duration);
  el.classList.remove(className);
  void el.offsetWidth; // force le navigateur à rejouer l'animation
  el.classList.add(className);
  await wait(duration);
  el.classList.remove(className);
}

export async function playBattleIntro(state: BattleState) {
  Sfx.play("encounter");
  document.querySelectorAll<HTMLElement>(".sprite.enemy").forEach(el => pulse(el, "appear", CONFIG.timing.appear));
  await pulse($("#flash"), "on", CONFIG.timing.flash);
  const boss = state.enemies.find(e => e.boss);
  await showMessage(boss ? `${boss.name} se dresse devant le groupe !` : "Des ennemis surgissent !", CONFIG.timing.introMessage);
}

export async function animateActorStart(actor: Combatant, ability: Ability) {
  const sprite = sceneSprite(actor);
  if (ability !== ATTACK) showBanner(ability.name);
  if (actor.side === "hero") {
    sprite.classList.add("acting");
    await wait(CONFIG.timing.step);
  } else {
    await pulse(sprite, "blink", CONFIG.timing.blink);
  }
  if (ability.kind !== "physical") await pulse(sprite, "casting", CONFIG.timing.cast);
}

export async function animateActorEnd(actor: Combatant) {
  hideBanner();
  const sprite = spriteEl(actor);
  if (sprite) sprite.classList.remove("acting");
  await wait(CONFIG.timing.step / 2);
}

function effectVisual(ability: Ability) {
  if (ability.element) return ability.element;
  if (ability.kind === "physical") return "slash";
  return "heal";
}

function effectSound(effect: Effect, ability: Ability): SoundName {
  if (effect.type === "miss") return "miss";
  if (effect.type === "none") return "error";
  if (effect.type === "mp")   return "item";
  if (effect.type === "heal" || effect.type === "revive") return "heal";
  if (ability.element) return ability.element;
  if (ability.kind !== "physical") return "magic";
  return effect.crit ? "crit" : "hit";
}

function popupText(effect: Effect) {
  switch (effect.type) {
    case "miss": return "Raté";
    case "none": return "Sans effet";
    case "mp":   return effect.amount + " PS";
    default:     return String(effect.amount);
  }
}

function spawnPopup(sprite: HTMLElement, text: string, className: string) {
  const popup = document.createElement("span");
  popup.className = "popup " + className;
  popup.textContent = text;
  sprite.appendChild(popup);
  setTimeout(() => popup.remove(), CONFIG.timing.popup);
}

function spawnFx(sprite: HTMLElement, visual: string) {
  const fx = document.createElement("div");
  fx.className = "fx fx-" + visual;
  sprite.appendChild(fx);
  setTimeout(() => fx.remove(), CONFIG.timing.spellFx);
}

export function showEffect(target: Combatant, effect: Effect, ability: Ability) {
  const sprite = spriteEl(target);
  if (!sprite) return;

  spawnFx(sprite, effectVisual(ability));
  Sfx.play(effectSound(effect, ability));
  const classes = [effect.type, effect.crit && "crit", effect.weak && "weak"].filter(Boolean).join(" ");
  spawnPopup(sprite, popupText(effect), classes);

  if (effect.type === "damage") pulse(sprite, "damaged", CONFIG.timing.hit);
  if (effect.crit) pulse($("#battle-scene"), "quake", CONFIG.timing.hit);
}

export function showDefend(hero: Hero) {
  Sfx.play("defend");
  const sprite = spriteEl(hero);
  if (sprite) spawnPopup(sprite, "Défense", "info");
}

export async function killEnemies(enemies: Enemy[]) {
  Sfx.play("enemyDie");
  enemies.forEach(enemy => sceneSprite(enemy).classList.add("dying"));
  await wait(CONFIG.timing.death);
  enemies.forEach(enemy => sceneSprite(enemy).classList.add("dead"));
}

export async function animateEscape() {
  Sfx.play("run");
  await showMessage("Le groupe prend la fuite !", CONFIG.timing.escapeMessage);
  document.querySelectorAll(".sprite.hero").forEach(el => el.classList.add("fleeing"));
  await wait(CONFIG.timing.flee);
}

export function victoryPose(party: Hero[]) {
  party.filter(isAlive).forEach(hero => sceneSprite(hero).classList.add("victory"));
}

// — Sort du Dragon —

// Vaincu mais pas mort : il reste à terre
export function showDefeated(enemy: Enemy) {
  sceneSprite(enemy).classList.add("defeated");
}

// Épargner : il se relève, apaisé
export async function animateSpare(enemy: Enemy) {
  const sprite = sceneSprite(enemy);
  sprite.classList.remove("defeated");
  Sfx.play("heal");
  await pulse(sprite, "casting", CONFIG.timing.cast);
}

// Achever : le héros s'avance et porte le coup de grâce
export async function animateFinishingBlow(hero: Hero, enemy: Enemy) {
  const heroSprite = sceneSprite(hero);
  heroSprite.classList.add("acting");
  await wait(CONFIG.timing.step);
  spawnFx(sceneSprite(enemy), "slash");
  Sfx.play("crit");
  pulse($("#battle-scene"), "quake", CONFIG.timing.hit);
  await killEnemies([enemy]);
  heroSprite.classList.remove("acting");
  await wait(CONFIG.timing.step);
}
