// battle-menu.ts - Menus de combat et sélection des cibles, côté affichage (MAE-21)
//
// La logique demande un ordre pour un héros prêt (GameView.requestOrder) ; ce menu l'obtient du joueur et
// le rend par la promesse de la demande. Il lit l'état du combat pour proposer les bonnes entrées, sans jamais
// le modifier : réserver un objet, mettre l'action en file ou passer la main reste l'affaire de la logique.

import { ATTACK, RUN, SPELLS, ITEMS, ELEMENT_NAMES, GameState } from "../data/game-data.ts";
import type { Ability, ItemId } from "../data/game-data.ts";
import type { Hero } from "../party/heroes.ts";
import type { HeroOrder, OrderContext, OrderRequest } from "../game-view.ts";
import { Input, type Action } from "../input/input.ts";
import { Sfx } from "../audio/sfx.ts";
import { isAlive, groupOf, targetCandidates, type Combatant } from "../battle/battle.ts";
import { renderMenu, updateMenuCursor, listColumns } from "./view.ts";

// Le menu est une pile de niveaux : commande → liste (souffle / objets) → cible

export interface MenuEntry {
  label: string;
  detail?: string;
  help?: string;
  disabled?: boolean;
  select?: () => void; // absent pour « Besace vide »
}

export interface CommandLevel { type: "command"; cursor: number; entries: MenuEntry[] }
export interface ListLevel    { type: "list"; kind: "spell" | "item"; cursor: number; entries: MenuEntry[] }
export interface TargetLevel {
  type: "target";
  ability: Ability;
  itemId: ItemId | null;
  cursor: number;
  all?: boolean;              // toute une équipe à la fois
  relation?: "foe" | "ally";  // camp visé, pour une cible unique
}
export type MenuLevel = CommandLevel | ListLevel | TargetLevel;

function commandEntries(hero: Hero): MenuEntry[] {
  return [
    { label: "Frapper",    select: () => Menu.chooseTarget(ATTACK) },
    { label: hero.command, select: () => Menu.openList("spell"), disabled: hero.spells.length === 0 },
    { label: "Besace",     select: () => Menu.openList("item") },
    { label: "Garde",      select: () => Menu.finish({ kind: "defend" }) },
    { label: "Repli",      select: () => Menu.confirmAction(RUN, []) },
  ];
}

function spellEntries(hero: Hero): MenuEntry[] {
  return hero.spells.map(id => {
    const spell = SPELLS[id];
    // L'élément s'affiche entre le nom et le coût (« Tocsin · Foudre · 5 PS »)
    const element = "element" in spell && spell.element ? `${ELEMENT_NAMES[spell.element]} · ` : "";
    return {
      label: spell.name, detail: `${element}${spell.mp} PS`, help: spell.desc,
      disabled: hero.mp < spell.mp || targetCandidates(hero, spell.target).length === 0,
      select: () => Menu.chooseTarget(spell),
    };
  });
}

function itemEntries(hero: Hero): MenuEntry[] {
  // Object.entries perd le type des clés : ce sont bien des identifiants d'objets
  const entries = (Object.entries(GameState.inventory) as [ItemId, number][])
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => {
      const item = ITEMS[id];
      return {
        label: item.name, detail: `×${quantity}`, help: item.desc,
        disabled: targetCandidates(hero, item.target).length === 0,
        select: () => Menu.chooseTarget(item, id),
      };
    });
  return entries.length ? entries : [{ label: "Besace vide", disabled: true }];
}

// Une cible unique peut changer de camp (soigner un ennemi, frapper un allié...)
const canSwitchSide = (ability: Ability) => ability.target === "foe" || ability.target === "ally";

export interface MenuController {
  hero: Hero | null; // héros dont le menu est ouvert
  stack: MenuLevel[];
  context: OrderContext | null;                  // la demande en cours
  settle: ((order: HeroOrder | null) => void) | null;
  readonly level: MenuLevel | undefined;
  request(context: OrderContext): OrderRequest;
  finish(order: HeroOrder | null): void;
  syncDepth(): void;
  render(): void;
  openList(kind: "spell" | "item"): void;
  chooseTarget(ability: Ability, itemId?: ItemId | null): void;
  targetsOf(level: TargetLevel): Combatant[];
  confirmAction(ability: Ability, targets: Combatant[], itemId?: ItemId | null): void;
  back(): void;
  handle(action: Action): void;
  select(index: number): void;
  handleTarget(level: TargetLevel, action: Action): void;
  switchSide(level: TargetLevel, relation: "foe" | "ally"): void;
  clickEntry(depth: number, index: number): void;
  hoverEntry(depth: number, index: number): void;
  clickTarget(combatant: Combatant): void;
}

export const Menu: MenuController = {
  hero: null,
  stack: [],
  context: null,
  settle: null,

  get level() { return this.stack[this.stack.length - 1]; },

  // Ouvre le menu du héros ; la promesse rendue se résout avec son ordre, ou null si la logique annule
  request(context) {
    if (this.settle) this.finish(null); // une demande encore ouverte ne doit jamais rester sans réponse
    const order = new Promise<HeroOrder | null>(resolve => { this.settle = resolve; });
    this.context = context;
    this.hero = context.hero;
    Input.push(action => this.handle(action));
    this.stack = [{ type: "command", cursor: 0, entries: commandEntries(context.hero) }];
    this.render();
    return { order, cancel: () => { if (this.context === context) this.finish(null); } };
  },

  // Ferme le menu et rend l'ordre, une seule fois par demande
  finish(order) {
    const settle = this.settle;
    if (!settle) return;
    this.settle = null;
    this.context = null;
    this.hero = null;
    this.stack = [];
    Input.pop();
    this.render();
    settle(order);
  },

  // Dit à la logique si le joueur est dans un sous-menu (le temps se fige en mode « wait »)
  syncDepth() {
    this.context?.onBrowse(this.stack.length > 1);
  },

  render() {
    renderMenu(this);
  },

  openList(kind) {
    if (!this.hero) return;
    const entries = kind === "spell" ? spellEntries(this.hero) : itemEntries(this.hero);
    this.stack.push({ type: "list", kind, cursor: 0, entries });
    this.syncDepth();
    this.render();
  },

  chooseTarget(ability, itemId = null) {
    const level: TargetLevel = { type: "target", ability, itemId, cursor: 0 };
    if (ability.target.startsWith("all-")) {
      level.all = true;
    } else {
      level.relation = ability.target === "foe" ? "foe" : "ally";
      level.cursor = defaultTargetIndex(ability, this.targetsOf(level));
    }
    this.stack.push(level);
    this.syncDepth();
    this.render();
  },

  // Cibles possibles du niveau "target", recalculées à chaque fois (un ennemi peut mourir pendant le choix)
  targetsOf(level) {
    if (!this.hero) return [];
    if (level.all || level.ability.target === "ko-ally" || !level.relation) return targetCandidates(this.hero, level.ability.target);
    return groupOf(this.hero, level.relation).filter(isAlive);
  },

  confirmAction(ability, targets, itemId = null) {
    this.finish({ kind: "ability", ability, targets, itemId });
  },

  back() {
    if (this.stack.length > 1) {
      this.stack.pop();
      Sfx.play("cancel");
      this.syncDepth();
      this.render();
    } else if (this.context?.canPass()) {
      // Comme dans FF : Annuler au menu principal passe la main au héros prêt suivant
      Sfx.play("cursor");
      this.finish({ kind: "pass" });
    }
  },

  handle(action) {
    const level = this.level;
    if (!level) return;
    if (level.type === "target") return this.handleTarget(level, action);

    const count = level.entries.length;
    const columns = level.type === "list" ? listColumns() : 1;
    const move = (delta: number) => {
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
    const level = this.level;
    if (!level || level.type === "target") return;
    const entry = level.entries[index];
    if (!entry || entry.disabled) return Sfx.play("error");
    Sfx.play("confirm");
    entry.select?.();
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
        this.switchSide(level, action === "left" ? "ally" : "foe"); // groupe à gauche, ennemis à droite
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
    level.cursor = defaultTargetIndex(level.ability, targets);
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
function defaultTargetIndex(ability: Ability, targets: Combatant[]) {
  const healing = ability.kind === "heal" && targets.every(t => t.side === "hero");
  if (!healing) return 0;
  let best = 0;
  targets.forEach((t, i) => {
    if (t.hp / t.maxHp < targets[best].hp / targets[best].maxHp) best = i;
  });
  return best;
}
