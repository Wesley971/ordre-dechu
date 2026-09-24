// ui.js - Affichage : scène de combat, fenêtres, menus, animations

const $ = selector => document.querySelector(selector);

// Positions (en % de la zone) selon le nombre d'ennemis, et des héros en diagonale
const FORMATIONS = {
  1: [[50, 50]],
  2: [[35, 30], [62, 70]],
  3: [[28, 22], [66, 50], [28, 80]],
};
const HERO_SLOTS = [[26, 34], [48, 57], [70, 80]];

function spriteEl(c)   { return $(`[data-sprite="${c.id}"]`); }
function rowEl(c)      { return $(`[data-row="${c.id}"]`); }
function listItemEl(c) { return $(`[data-item="${c.id}"]`); }

function showScreen(name) {
  $("#intro-screen").hidden = name !== "intro";
  $("#game").hidden = name !== "game";
}

function setSceneTint(chapter) {
  $("#battle-scene").style.setProperty("--scene-tint", chapter.tint || "transparent");
}

// — Construction de la scène —

function createSprite(c, [x, y]) {
  const sprite = document.createElement("div");
  sprite.className = `sprite ${c.side}${c.boss ? " boss" : ""}`;
  sprite.dataset.sprite = c.id;
  sprite.style.left = x + "%";
  sprite.style.top = y + "%";
  sprite.innerHTML = `<div class="sprite-body"><img class="sprite-img" src="${c.image}" alt="${c.name}"></div>`;
  sprite.addEventListener("click", () => Menu.clickTarget(c));
  return sprite;
}

// Scène sans combat : le groupe seul, entre deux affrontements
function renderIdleScene(party) {
  $("#enemy-area").replaceChildren();
  $("#enemy-list").replaceChildren();
  $("#hero-area").replaceChildren(...party.map((hero, i) => createSprite(hero, HERO_SLOTS[i])));
  renderPartyWindow(party);
  renderMenu(Menu);
}

function renderBattle(state) {
  renderIdleScene(state.heroes);
  const slots = FORMATIONS[state.enemies.length];
  $("#enemy-area").replaceChildren(...state.enemies.map((enemy, i) => createSprite(enemy, slots[i])));
  renderEnemyList(state.enemies);
  updateBattleUI();
}

function renderPartyWindow(party) {
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

function renderEnemyList(enemies) {
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

function updateBattleUI() {
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
    if (row) {
      row.querySelector(".p-hp b").textContent = hero.hp;
      row.querySelector(".p-hp small").textContent = "/" + hero.maxHp;
      row.querySelector(".p-mp").textContent = hero.mp;
    }
  }

  for (const enemy of Battle.enemies) {
    const item = listItemEl(enemy);
    if (!item) continue;
    item.hidden = !isAlive(enemy);
    item.querySelector(".e-hp-fill").style.width = (enemy.hp / enemy.maxHp) * 100 + "%";
  }
}

function updateAtbUI(heroes) {
  for (const hero of heroes) {
    const row = rowEl(hero);
    if (!row) continue;
    const fill = row.querySelector(".atb-fill");
    fill.style.width = hero.atb + "%";
    fill.classList.toggle("full", isAlive(hero) && hero.state !== "charging");
  }
}

// — Menus —

// Même seuil que le @media de style.css
function listColumns() {
  return window.matchMedia("(max-width: 640px)").matches ? 1 : 2;
}

function menuList(level, depth, active) {
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
function updateMenuCursor(menu, depth) {
  const level = menu.stack[depth];
  const container = level.type === "list" ? $("#list-window") : $("#command-window");
  container.querySelectorAll(".menu-item").forEach((li, i) => li.classList.toggle("selected", i === level.cursor));
  if (level.type === "list") {
    const entry = level.entries[level.cursor];
    container.querySelector(".list-help").innerHTML = (entry && entry.help) || "&nbsp;";
  }
}

function renderMenu(menu) {
  const commandWindow = $("#command-window");
  const listWindow = $("#list-window");
  document.querySelectorAll(".targeted").forEach(el => el.classList.remove("targeted", "all"));
  $("#target-hint").hidden = true;

  const hero = menu.hero;
  commandWindow.hidden = !hero;
  $("#enemy-list").hidden = !!hero;
  listWindow.hidden = true;
  if (!hero) return updateBattleUI();

  const top = menu.level;
  const [root] = menu.stack;
  commandWindow.replaceChildren();
  commandWindow.insertAdjacentHTML("beforeend", `<div class="window-title">${hero.name}</div>`);
  commandWindow.appendChild(menuList(root, 0, top === root));
  if (top !== root) commandWindow.appendChild(backLink());

  if (top.type === "list") {
    const entry = top.entries[top.cursor];
    const title = top.kind === "spell" ? `${hero.command} <span>PM ${hero.mp}/${hero.maxMp}</span>` : "Objets";
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

function showBanner(text) {
  const banner = $("#battle-banner");
  banner.innerHTML = text;
  banner.hidden = false;
}

function hideBanner() {
  $("#battle-banner").hidden = true;
}

async function showMessage(text, duration = CONFIG.timing.message) {
  showBanner(text);
  await wait(duration);
  hideBanner();
}

// Ajoute une classe le temps d'une animation
async function pulse(el, className, duration) {
  if (!el) return wait(duration);
  el.classList.remove(className);
  void el.offsetWidth; // force le navigateur à rejouer l'animation
  el.classList.add(className);
  await wait(duration);
  el.classList.remove(className);
}

async function playBattleIntro(state) {
  Sfx.play("encounter");
  document.querySelectorAll(".sprite.enemy").forEach(el => pulse(el, "appear", CONFIG.timing.appear));
  await pulse($("#flash"), "on", CONFIG.timing.flash);
  const boss = state.enemies.find(e => e.boss);
  await showMessage(boss ? `${boss.name} se dresse devant le groupe !` : "Des ennemis surgissent !", CONFIG.timing.introMessage);
}

async function animateActorStart(actor, ability) {
  const sprite = spriteEl(actor);
  if (ability !== ATTACK) showBanner(ability.name);
  if (actor.side === "hero") {
    sprite.classList.add("acting");
    await wait(CONFIG.timing.step);
  } else {
    await pulse(sprite, "blink", CONFIG.timing.blink);
  }
  if (ability.kind !== "physical") await pulse(sprite, "casting", CONFIG.timing.cast);
}

async function animateActorEnd(actor) {
  hideBanner();
  const sprite = spriteEl(actor);
  if (sprite) sprite.classList.remove("acting");
  await wait(CONFIG.timing.step / 2);
}

function effectVisual(ability) {
  if (ability.element) return ability.element;
  if (ability.kind === "physical") return "slash";
  return "heal";
}

function effectSound(effect, ability) {
  if (effect.type === "miss") return "miss";
  if (effect.type === "none") return "error";
  if (effect.type === "mp")   return "item";
  if (effect.type === "heal" || effect.type === "revive") return "heal";
  if (ability.element) return ability.element;
  if (ability.kind !== "physical") return "magic";
  return effect.crit ? "crit" : "hit";
}

function popupText(effect) {
  switch (effect.type) {
    case "miss": return "Raté";
    case "none": return "Sans effet";
    case "mp":   return effect.amount + " PM";
    default:     return String(effect.amount);
  }
}

function spawnPopup(sprite, text, className) {
  const popup = document.createElement("span");
  popup.className = "popup " + className;
  popup.textContent = text;
  sprite.appendChild(popup);
  setTimeout(() => popup.remove(), CONFIG.timing.popup);
}

function showEffect(target, effect, ability) {
  const sprite = spriteEl(target);
  if (!sprite) return;

  const fx = document.createElement("div");
  fx.className = "fx fx-" + effectVisual(ability);
  sprite.appendChild(fx);
  setTimeout(() => fx.remove(), CONFIG.timing.spellFx);

  Sfx.play(effectSound(effect, ability));
  const classes = [effect.type, effect.crit && "crit", effect.weak && "weak"].filter(Boolean).join(" ");
  spawnPopup(sprite, popupText(effect), classes);

  if (effect.type === "damage") pulse(sprite, "damaged", CONFIG.timing.hit);
  if (effect.crit) pulse($("#battle-scene"), "quake", CONFIG.timing.hit);
}

function showDefend(hero) {
  Sfx.play("defend");
  const sprite = spriteEl(hero);
  if (sprite) spawnPopup(sprite, "Défense", "info");
}

async function killEnemies(enemies) {
  Sfx.play("enemyDie");
  enemies.forEach(enemy => spriteEl(enemy).classList.add("dying"));
  await wait(CONFIG.timing.death);
  enemies.forEach(enemy => spriteEl(enemy).classList.add("dead"));
}

async function animateEscape() {
  Sfx.play("run");
  await showMessage("Le groupe prend la fuite !", CONFIG.timing.escapeMessage);
  document.querySelectorAll(".sprite.hero").forEach(el => el.classList.add("fleeing"));
  await wait(CONFIG.timing.flee);
}

function victoryPose(party) {
  party.filter(isAlive).forEach(hero => spriteEl(hero).classList.add("victory"));
}
