// view.ts - Affichage : écrans, fenêtres du bas, menus, bandeau, chiffres
//
// Les combattants eux-mêmes (sprites, poses, animations) sont la « scène » : stage.ts en DOM, src/scene/battle-stage.ts
// en 2,5D (MAE-29). Ce fichier ne joue aucun son : les sons sont dans dom-view.ts, les menus et le dialogue.

import { CONFIG } from "../config.ts";
import { COMMAND_HELP, ELEMENT_NAMES, GameState, HEROES } from "../data/game-data.ts";
import type { Ability, Chapter } from "../data/game-data.ts";
import type { Hero } from "../party/heroes.ts";
import type { SoundName } from "../audio/sfx.ts";
import { Battle, isAlive } from "../battle/battle.ts";
import type { Combatant, Effect, Enemy } from "../battle/battle.ts";
import { Menu } from "./battle-menu.ts";
import type { CommandLevel, ListLevel, MenuController } from "./battle-menu.ts";
import { screenOrder } from "./target-order.ts";
import { nudgeInto, popupDrift, POPUP_STACK, SCREEN_EDGE, stackOffsets } from "./popup-motion.ts";
import { isReducedMotion } from "./reduced-motion.ts";

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

// Héros mis en avant pendant la page de dialogue qui annonce leur nouveau niveau (planche G6)
let levelUps: { heroId: string; level: number }[] = [];
export function setLevelUps(list: { heroId: string; level: number }[]) {
  if (list.length === 0 && levelUps.length === 0) return;
  levelUps = list;
  updateBattleUI();
}

// À droite du nom : « niveau N », « tombé », « prêt », ou la jauge en pourcentage
function turnLabel(hero: Hero) {
  const accord = HEROES.find(def => def.id === hero.id)?.feminine ? "e" : "";
  const levelUp = levelUps.find(entry => entry.heroId === hero.id);
  if (levelUp) return `niveau ${levelUp.level}`;
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
    if (row) {
      row.classList.toggle("leveled", levelUps.some(entry => entry.heroId === hero.id));
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

// Affichage d'ordinateur (plus de 640 px de large) : clic direct sur l'ennemi, survol, numéros des touches (MAE-89).
// Le téléphone garde son panneau et son toucher (planches P1 à P6)
export function isPointerLayout() {
  return window.matchMedia("(min-width: 641px)").matches;
}

// Centre du sprite d'un combattant à l'écran, pour le ciblage dans l'ordre de l'écran ; null s'il n'est pas affiché
export function screenCenter(c: Combatant) {
  const rect = spriteEl(c)?.getBoundingClientRect();
  if (!rect || rect.width === 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// interactive : false pour la copie inerte affichée pendant le ciblage (ni clic, ni survol, ni lecteur d'écran)
function menuList(level: CommandLevel | ListLevel, depth: number, active: boolean, interactive = true) {
  const ul = document.createElement("ul");
  ul.className = "menu" + (active ? "" : " inactive");
  level.entries.forEach((entry, i) => {
    const li = document.createElement("li");
    li.className = "menu-item" + (entry.disabled ? " disabled" : "") + (i === level.cursor ? " selected" : "");
    const element = entry.element ? `<span class="menu-element">· ${entry.element}</span>` : "";
    // Le numéro de la touche est un <kbd> devant le nom : le nom reste le premier <span> de l'entrée
    const key = i < 9 ? `<kbd class="menu-key">${i + 1}</kbd>` : "";
    li.innerHTML = `${key}<span>${entry.label}</span>${element}${entry.detail ? `<span class="detail">${entry.detail}</span>` : ""}`;
    if (interactive) {
      li.addEventListener("click", () => Menu.clickEntry(depth, i));
      li.addEventListener("mouseenter", () => Menu.hoverEntry(depth, i));
    }
    ul.appendChild(li);
  });
  return ul;
}

function backLink() {
  const back = document.createElement("div");
  back.className = "menu-back";
  back.innerHTML = `◀︎ Retour<kbd class="key-hint">Échap</kbd>`; // ︎ : le triangle en texte, pas en emoji sur iPhone
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
  renderHelp(menu);
}

// Élément et coût d'une capacité : « Glace », « 4 PS »
function abilityFacts(ability: Ability) {
  return [
    "element" in ability && ability.element ? ELEMENT_NAMES[ability.element] : "",
    "mp" in ability && ability.mp ? `${ability.mp} PS` : "",
  ].filter(Boolean);
}

// Rappel des touches, pendant les combats du chapitre I seulement (MAE-89). Deux versions : la longue, et une courte qui
// tient sur une ligne, montrée par style.css sur les écrans bas pour que la plaque ne monte pas sur les héros
function keysReminder(menu: MenuController) {
  const top = menu.level;
  if (!top) return "";
  const both = (long: string, short: string) => `<span class="keys-long">${long}</span><span class="keys-short">${short}</span>`;
  if (top.type === "command") {
    const keys = "<kbd>1–5</kbd> commandes · <kbd>← →</kbd> cible · <kbd>Échap</kbd> retour";
    return both(keys, keys);
  }
  if (top.type === "list") {
    const what = top.kind === "spell" ? "capacités" : "objets";
    const keys = top.entries.length > 1 ? `1–${Math.min(top.entries.length, 9)}` : "1";
    return both(`<kbd>${keys}</kbd> ${what} · <kbd>Entrée</kbd> valider · <kbd>Échap</kbd> retour`,
      `<kbd>${keys}</kbd> · <kbd>Entrée</kbd> valider · <kbd>Échap</kbd> retour`);
  }
  if (top.all) return both("<kbd>Entrée</kbd> valider · <kbd>Échap</kbd> retour", "<kbd>Entrée</kbd> valider · <kbd>Échap</kbd> retour");
  return top.relation === "ally"
    ? both("<kbd>← →</kbd> allié précédent ou suivant, de gauche à droite à l'écran", "<kbd>← →</kbd> allié, de gauche à droite")
    : both("<kbd>← →</kbd> ennemi précédent ou suivant, dans l'ordre de l'écran · clic pour lancer", "<kbd>← →</kbd> ennemi · clic pour lancer");
}

// L'aide à droite de la liste, dans la plaque du menu (planches N1 et N2) : l'entrée sous le curseur, ou la capacité qui
// attend sa cible ; sur téléphone, elle reste cachée par style.css
function renderHelp(menu: MenuController) {
  const panel = $("#battle-help");
  const top = menu.level;
  if (!menu.hero || !top) {
    panel.hidden = true;
    return;
  }
  let name: string, facts: string[], text: string;
  if (top.type === "target") {
    name = top.ability.name;
    facts = abilityFacts(top.ability);
    text = top.ability.desc ?? COMMAND_HELP[top.ability.name] ?? ""; // Frapper n'a pas de desc : l'aide de sa commande
  } else {
    const entry = top.entries[top.cursor];
    const cost = top.type === "list" && top.kind === "spell" ? entry?.detail : "";
    name = entry?.label ?? "";
    facts = [entry?.element ?? "", cost ?? ""].filter(Boolean);
    text = entry?.help ?? "";
  }
  $("#help-title").innerHTML = `<span class="help-name">${name}</span>` + facts.map(fact => `<span class="menu-element"> · ${fact}</span>`).join("");
  $("#help-text").textContent = text;
  const keys = GameState.chapterIndex === 0 ? keysReminder(menu) : "";
  $("#help-keys").innerHTML = keys;
  $("#help-keys").hidden = !keys;
  panel.hidden = false;
}

// Numéros 1, 2, 3 près des alliés visés un par un, dans l'ordre de l'écran : des repères, pas des touches (MAE-89)
function numberAllies(menu: MenuController, targets: Combatant[]) {
  document.querySelectorAll(".ally-number").forEach(el => el.remove());
  const top = menu.level;
  if (!top || top.type !== "target" || top.all || top.relation !== "ally" || !isPointerLayout()) return;
  const placed = targets.flatMap(c => {
    const center = screenCenter(c);
    return center ? [{ item: c, ...center }] : [];
  });
  screenOrder(placed).forEach((c, i) => {
    spriteEl(c)?.insertAdjacentHTML("beforeend", `<span class="ally-number" aria-hidden="true">${i + 1}</span>`);
  });
}

// Contour du survol (planche M1, piste A) : un fin trait clair de lune autour de la silhouette du sprite, sur les pixels
// transparents qui touchent un pixel visible. Dessiné une seule fois par image, dans une toile plus grande d'un pixel de
// chaque côté (un sprite peut toucher le bord de sa toile), puis posé en image sur le sprite ; null si l'image ne se lit
// pas (pas de contour, l'info « Clic : Frapper … » reste).
interface Outline { url: string; width: number; height: number } // toile de l'image, en pixels de sprite
const outlines = new Map<string, Promise<Outline | null>>();

function spriteOutline(src: string): Promise<Outline | null> {
  const known = outlines.get(src);
  if (known) return known;
  const drawn = new Promise<Outline | null>(resolve => {
    const img = new Image();
    img.addEventListener("error", () => resolve(null), { once: true });
    img.addEventListener("load", () => {
      const width = img.naturalWidth, height = img.naturalHeight;
      const source = document.createElement("canvas");
      source.width = width;
      source.height = height;
      const read = source.getContext("2d");
      const canvas = document.createElement("canvas");
      canvas.width = width + 2;
      canvas.height = height + 2;
      const draw = canvas.getContext("2d");
      if (!read || !draw || !width || !height) return resolve(null);
      read.drawImage(img, 0, 0);
      const { data } = read.getImageData(0, 0, width, height);
      const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * 4 + 3] > 0;
      draw.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--moonlight").trim() || "#bfe7e9";
      for (let y = -1; y <= height; y++) {
        for (let x = -1; x <= width; x++) {
          if (opaque(x, y)) continue;
          if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) draw.fillRect(x + 1, y + 1, 1, 1);
        }
      }
      resolve({ url: canvas.toDataURL(), width, height });
    }, { once: true });
    img.src = src;
  });
  outlines.set(src, drawn);
  return drawn;
}

// Le contour, posé sur le corps du sprite (DOM : il suit le pas en avant du héros) ou sur l'ancre de la scène peinte ;
// il attend la première lecture de l'image si besoin. Il suit l'image affichée : le PNG debout, ou la pose dessinée
// (à genoux, au sol, MAE-94), posée par stage.ts (showPose) avec sa place par rapport au PNG debout
function addPointerOutline(menu: MenuController, c: Combatant, el: HTMLElement) {
  el.classList.add("pointer-target");
  const image = el.dataset.poseImage ?? c.image;
  const at = { x: Number(el.dataset.poseX ?? 0), y: Number(el.dataset.poseY ?? 0) };
  void Promise.all([spriteOutline(c.image), spriteOutline(image)]).then(([standing, outline]) => {
    if (!standing || !outline || menu.hovered !== c || !el.classList.contains("pointer-target") || el.querySelector(".pointer-outline")) return;
    // En pourcentages du rectangle du PNG debout (l'élément), comme le sprite
    const { url, width, height } = outline;
    const w = standing.width, h = standing.height;
    const style = `left: ${((at.x - 1) / w) * 100}%; top: ${((at.y - 1) / h) * 100}%; width: ${((width + 2) / w) * 100}%; height: ${((height + 2) / h) * 100}%`;
    const host = el.querySelector<HTMLElement>(".sprite-body") ?? el;
    host.insertAdjacentHTML("beforeend", `<img class="pointer-outline" alt="" aria-hidden="true" src="${url}" style="${style}">`);
  });
}

// Sous la souris : contour clair de lune quand un clic agirait (frapper, ou valider la cible), et l'info
// « Clic : Frapper … » seulement quand le clic frappe (décisions 3 et 4 du 08/11/2026)
export function showPointer(menu: MenuController) {
  document.querySelectorAll(".pointer-target").forEach(el => el.classList.remove("pointer-target"));
  document.querySelectorAll(".pointer-outline, .strike-tip").forEach(el => el.remove());
  const c = menu.hovered;
  const el = c && spriteEl(c);
  const top = menu.level;
  if (!c || !el || !top || !isPointerLayout()) return;
  if (top.type === "target") {
    if (el.classList.contains("targeted")) addPointerOutline(menu, c, el);
    return;
  }
  if (!menu.canStrike(c, true)) return;
  addPointerOutline(menu, c, el);
  el.insertAdjacentHTML("beforeend", `<span class="strike-tip" aria-hidden="true">Clic : Frapper ${c.name}</span>`);
}

export function renderMenu(menu: MenuController) {
  const commandWindow = $("#command-window");
  const listWindow = $("#list-window");
  document.querySelectorAll(".targeted").forEach(el => el.classList.remove("targeted", "all"));
  $("#target-hint").hidden = true;

  const hero = menu.hero;
  $("#action-window").hidden = !hero;
  $("#action-window").setAttribute("aria-label", hero ? `Commandes de ${hero.name}` : "Commandes");
  $("#panel-ps").textContent = hero ? `${hero.mp} PS` : ""; // sur téléphone, les PS du héros qui joue (planche P1)
  commandWindow.hidden = !hero;
  listWindow.hidden = true;
  renderHelp(menu);
  numberAllies(menu, []);
  const top = menu.level;
  const [root] = menu.stack;
  if (!hero || !top || root.type !== "command") {
    showPointer(menu);
    return updateBattleUI();
  }

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
    // Sur ordinateur, la liste d'où vient la capacité reste à gauche, inerte, et l'aide à droite (planches N1 et N2)
    const from = menu.stack[menu.stack.length - 2];
    const copy = $("#target-list");
    copy.replaceChildren();
    if (from && from.type !== "target") {
      const title = from.type === "list" ? `${hero.name} · ${from.kind === "spell" ? hero.command : "Besace"}` : hero.name;
      copy.insertAdjacentHTML("beforeend", `<div class="window-title">${title}</div>`);
      const list = menuList(from, menu.stack.length - 2, false, false);
      list.classList.toggle("root-menu", from.type === "command"); // sur deux colonnes comme le menu principal, sur écran bas
      copy.appendChild(list);
    }
    // Nom, élément, coût et aide de la capacité ou de l'objet choisi : au toucher, la liste se ferme aussitôt (MAE-74, planche G2)
    const { ability } = top;
    $("#target-title").textContent = `${hero.name} · Choisir une cible`;
    const facts = abilityFacts(ability).map(fact => ` · ${fact}`).join("");
    const help = ability.desc
      ? `<div class="target-name">${ability.name}<span class="menu-element">${facts}</span></div><div class="target-desc">${ability.desc}</div>`
      : "";
    $("#target-help").innerHTML = help;
    $("#target-help").hidden = !help;
    $("#target-hint").hidden = false;
    numberAllies(menu, targets);
  }

  showPointer(menu);
  updateBattleUI();
}

// — Bandeau —

// « result » : annonce de fin de combat, plus bas, au-dessus de la bande de dialogue (planches G5 et G7)
export function showBanner(text: string, kind: "result" | "danger" | "" = "") {
  const banner = $("#battle-banner");
  banner.innerHTML = text;
  banner.classList.toggle("result", kind !== "");
  banner.classList.toggle("danger", kind === "danger");
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

// — Chiffres d'un combattant, là où la scène le dit (Stage.popupAnchor). Ses effets sont en pixels (fx-layer.ts) —

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

// Le chiffre monte au-dessus de sa cible puis s'efface (style.css, popup-rise, MAE-99). target : celui qui le reçoit,
// pour le sens du glissement d'un « Raté ». Le mouvement réduit, le glissement, la pile et le recadrage passent par un
// attribut et des variables, jamais par une classe : la classe du chiffre est relevée par le bot du labo, qui compare
// deux versions
export function spawnPopup(anchor: HTMLElement, text: string, className: string, target: Combatant) {
  const popup = document.createElement("span");
  popup.className = "popup " + className;
  popup.textContent = text;
  // Planche G3 : une faiblesse se dit toujours aussi par le mot, au-dessus du chiffre
  if (popup.classList.contains("weak")) popup.insertAdjacentHTML("afterbegin", `<span class="popup-word">Faiblesse</span>`);
  const drift = popupDrift(target.side, popup.classList.contains("miss"));
  popup.style.setProperty("--drift", `${drift}px`);
  if (isReducedMotion()) popup.dataset.still = ""; // apparaît et s'efface sans bouger
  anchor.appendChild(popup);
  setTimeout(() => popup.remove(), CONFIG.timing.popup);

  // La pile de la cible : ses chiffres encore vivants, du plus récent au plus ancien ; au-delà de POPUP_STACK, le plus
  // ancien part. Les hauteurs sont celles affichées, le zoom d'un critique compris
  const live = [...anchor.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains("popup")).reverse();
  for (const old of live.splice(POPUP_STACK)) old.remove();
  // Sur une pile, il attend invisible que les plus anciens aient glissé au-dessus de lui (style.css, data-waits) ; en
  // mouvement réduit, ils changent de place d'un coup : pas d'attente
  if (live.length > 1 && !isReducedMotion()) popup.dataset.waits = "";
  const offsets = stackOffsets(live.map((el) => el.getBoundingClientRect().height));
  live.forEach((el, i) => el.style.setProperty("--stack", `${offsets[i]}px`));

  // Dans l'écran, glissement compris : sur un écran de 390 px, un chiffre au bord déborderait. Il y naît déjà recadré :
  // sans transition le temps de poser --nudge (seule la pile glisse), rétablie après un calcul du style
  const { left, right } = popup.getBoundingClientRect();
  const nudge = nudgeInto(left + Math.min(0, drift), right + Math.max(0, drift), SCREEN_EDGE, document.documentElement.clientWidth - SCREEN_EDGE);
  if (nudge) {
    popup.style.transition = "none";
    popup.style.setProperty("--nudge", `${nudge}px`);
    void popup.offsetWidth;
    popup.style.transition = "";
  }
}
