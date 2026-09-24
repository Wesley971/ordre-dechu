// menu.js - Menus de commande du combat et sélection des cibles
// Le menu est une pile de niveaux : commande → liste (magie / objets) → cible

function commandEntries(hero) {
  return [
    { label: "Attaque",    select: () => Menu.chooseTarget(ATTACK) },
    { label: hero.command, select: () => Menu.openList("spell"), disabled: hero.spells.length === 0 },
    { label: "Objet",      select: () => Menu.openList("item") },
    { label: "Défense",    select: () => { defend(hero); Menu.done(); } },
    { label: "Fuite",      select: () => Menu.confirmAction(RUN, []) },
  ];
}

function spellEntries(hero) {
  return hero.spells.map(id => {
    const spell = SPELLS[id];
    return {
      label: spell.name, detail: `${spell.mp} PM`, help: spell.desc,
      disabled: hero.mp < spell.mp || targetCandidates(hero, spell.target).length === 0,
      select: () => Menu.chooseTarget(spell),
    };
  });
}

function itemEntries(hero) {
  const entries = Object.entries(GameState.inventory)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => {
      const item = ITEMS[id];
      return {
        label: item.name, detail: `×${quantity}`, help: item.desc,
        disabled: targetCandidates(hero, item.target).length === 0,
        select: () => Menu.chooseTarget(item, id),
      };
    });
  return entries.length ? entries : [{ label: "Aucun objet", disabled: true }];
}

// Une cible unique peut changer de camp (soigner un mort-vivant, frapper un allié...)
const canSwitchSide = ability => ability.target === "foe" || ability.target === "ally";

const Menu = {
  hero: null, // héros dont le menu est ouvert
  stack: [],

  get level() { return this.stack[this.stack.length - 1]; },
  isInSubmenu() { return this.stack.length > 1; },

  attach() { Input.push(action => this.handle(action)); },
  detach() { Input.pop(); this.close(); },

  onHeroReady() {
    if (!this.hero) this.openNext();
  },

  onHeroDown(hero) {
    if (this.hero === hero) this.done();
  },

  openNext() {
    const hero = Battle.readyQueue[0];
    if (!hero || Battle.over) return this.close();
    this.hero = hero;
    this.stack = [{ type: "command", cursor: 0, entries: commandEntries(hero) }];
    this.render();
  },

  close() {
    this.hero = null;
    this.stack = [];
    this.render();
  },

  done() {
    this.close();
    this.openNext();
  },

  render() {
    renderMenu(this);
  },

  openList(kind) {
    const entries = kind === "spell" ? spellEntries(this.hero) : itemEntries(this.hero);
    this.stack.push({ type: "list", kind, cursor: 0, entries });
    this.render();
  },

  chooseTarget(ability, itemId = null) {
    const level = { type: "target", ability, itemId, cursor: 0 };
    if (ability.target.startsWith("all-")) {
      level.all = true;
    } else {
      level.relation = ability.target === "foe" ? "foe" : "ally";
      level.cursor = defaultTargetIndex(this.hero, ability, this.targetsOf(level));
    }
    this.stack.push(level);
    this.render();
  },

  // Cibles possibles du niveau "target", recalculées à chaque fois (un ennemi peut mourir pendant le choix)
  targetsOf(level) {
    if (level.all || level.ability.target === "ko-ally") return targetCandidates(this.hero, level.ability.target);
    return groupOf(this.hero, level.relation).filter(isAlive);
  },

  confirmAction(ability, targets, itemId = null) {
    queueHeroAction(this.hero, ability, targets, itemId);
    this.done();
  },

  back() {
    if (this.stack.length > 1) {
      this.stack.pop();
      Sfx.play("cancel");
      this.render();
    } else if (Battle.readyQueue.length > 1) {
      // Comme dans FF : Annuler au menu principal passe la main au héros prêt suivant
      Battle.readyQueue.push(Battle.readyQueue.shift());
      Sfx.play("cursor");
      this.openNext();
    }
  },

  handle(action) {
    const level = this.level;
    if (!level) return;
    if (level.type === "target") return this.handleTarget(level, action);

    const count = level.entries.length;
    const columns = level.type === "list" ? listColumns() : 1;
    const move = delta => {
      level.cursor = (level.cursor + delta + count) % count;
      Sfx.play("cursor");
      this.render();
    };

    switch (action) {
      case "up":      move(-columns); break;
      case "down":    move(columns); break;
      case "left":    if (columns > 1) move(-1); break;
      case "right":   if (columns > 1) move(1); break;
      case "confirm": this.select(level.cursor); break;
      case "cancel":  this.back(); break;
    }
  },

  select(index) {
    const entry = this.level.entries[index];
    if (!entry || entry.disabled) return Sfx.play("error");
    Sfx.play("confirm");
    entry.select();
  },

  handleTarget(level, action) {
    const targets = this.targetsOf(level);
    if (targets.length === 0) return this.back();
    level.cursor = Math.min(level.cursor, targets.length - 1);

    switch (action) {
      case "up":
      case "down":
        if (level.all) return;
        level.cursor = (level.cursor + (action === "up" ? -1 : 1) + targets.length) % targets.length;
        Sfx.play("cursor");
        break;
      case "left":
      case "right":
        this.switchSide(level, action === "left" ? "foe" : "ally"); // ennemis à gauche, groupe à droite
        break;
      case "confirm":
        Sfx.play("confirm");
        this.confirmAction(level.ability, level.all ? targets : [targets[level.cursor]], level.itemId);
        return;
      case "cancel":
        return this.back();
    }
    this.render();
  },

  switchSide(level, relation) {
    if (level.all || !canSwitchSide(level.ability) || level.relation === relation) return;
    const previous = level.relation;
    level.relation = relation;
    const targets = this.targetsOf(level);
    if (targets.length === 0) {
      level.relation = previous;
      return;
    }
    level.cursor = defaultTargetIndex(this.hero, level.ability, targets);
    Sfx.play("cursor");
  },

  // — Souris / tactile —

  clickEntry(depth, index) {
    const level = this.stack[depth];
    if (!level || level !== this.level) return;
    level.cursor = index;
    this.select(index);
  },

  hoverEntry(depth, index) {
    const level = this.stack[depth];
    if (!level || level !== this.level || level.cursor === index) return;
    level.cursor = index;
    updateMenuCursor(this, depth);
  },

  clickTarget(combatant) {
    const level = this.level;
    if (!level || level.type !== "target") return;

    if (!level.all) {
      const relation = combatant.side === "hero" ? "ally" : "foe";
      if (relation !== level.relation) {
        if (!canSwitchSide(level.ability)) return;
        level.relation = relation;
      }
    }
    const index = this.targetsOf(level).indexOf(combatant);
    if (index < 0) return;
    level.cursor = index;
    this.handleTarget(level, "confirm");
  },
};

// Soins : on vise d'abord l'allié le plus blessé ; sinon le premier de la liste
function defaultTargetIndex(hero, ability, targets) {
  const healing = ability.kind === "heal" && targets.every(t => t.side === "hero");
  if (!healing) return 0;
  let best = 0;
  targets.forEach((t, i) => {
    if (t.hp / t.maxHp < targets[best].hp / targets[best].maxHp) best = i;
  });
  return best;
}
