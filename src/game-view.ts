// game-view.ts - Contrat entre la logique du jeu et son affichage (MAE-21)
//
// La logique (combat, histoire, état de la partie) ne connaît que cette interface : elle lui demande d'afficher,
// d'animer, de jouer la musique et de poser les questions au joueur. L'affichage, lui, lit librement l'état
// (GameState, Battle) pour dessiner, mais ne modifie jamais la logique : il lui rend des décisions.
// Deux implémentations : le DOM (src/ui/dom-view.ts), qui affiche la scène peinte en 2,5D quand le chapitre a un
// décor (MAE-29, src/scene/battle-stage.ts), et une vue muette pour les tests (src/dev/silent-view.ts).

import type { Ability, Chapter, ItemId, MusicId, Page } from "./data/game-data.ts";
import type { Hero } from "./party/heroes.ts";
import type { BattleState, Combatant, Effect, Enemy } from "./battle/battle.ts";

// — Écran titre, histoire —

export interface TitleOptions {
  startLabel: string;   // « Nouvelle partie » ou « Rejouer »
  canRetry: boolean;    // « Réessayer le combat », après une défaite
  canContinue: boolean; // « Continuer », quand une sauvegarde valide existe
}
export type TitleChoice = "start" | "retry" | "continue";

// Pages de dialogue à lire l'une après l'autre
export interface Telling { title?: string; pages: Page[] }

// Question posée au joueur ; la réponse est l'identifiant de l'option choisie
export interface Question<T extends string> {
  title?: string;
  text: string;
  options: { id: T; label: string }[];
}

// — Combat —

// Ordre donné à un héros prêt
export type HeroOrder =
  | { kind: "ability"; ability: Ability; targets: Combatant[]; itemId: ItemId | null } // frapper, souffle, objet, repli
  | { kind: "defend" }
  | { kind: "pass" }; // Annuler au menu principal : la main passe au héros prêt suivant

export interface OrderContext {
  hero: Hero;
  canPass(): boolean;                   // un autre héros attend aussi un ordre
}

// Une demande d'ordre en cours. order se résout avec l'ordre du joueur, ou null si la logique l'annule
// (le héros tombe, le combat se termine) : cancel() la résout avec null.
export interface OrderRequest {
  order: Promise<HeroOrder | null>;
  cancel(): void;
}

// Effet d'une action sur une de ses cibles
export interface Hit { target: Combatant; effect: Effect }

export interface GameView {
  // — Écrans et histoire —
  showTitle(options: TitleOptions): Promise<TitleChoice>;
  // Scène au repos : le groupe seul, dans le lieu du chapitre. Se résout quand la scène est prête à être vue
  // (la scène peinte charge son décor ici, MAE-29) : l'histoire ne commence qu'ensuite
  showChapter(chapter: Chapter, party: Hero[]): Promise<void>;
  music(id: MusicId | null): void;                      // null : silence
  tell(telling: Telling): Promise<void>;
  ask<T extends string>(question: Question<T>): Promise<T>;
  refresh(): void;                                      // PV, PS, états changés hors animation
  celebrate(party: Hero[], title: string): void;        // pose de victoire, fanfare et annonce (« Victoire ! », « Alliance »)
  showDefeat(telling: Telling): Promise<void>;          // la scène s'éteint, puis les pages de la défaite
  animateSpare(enemy: Enemy): Promise<void>;            // un ennemi à terre se relève, apaisé
  animateFinishingBlow(hero: Hero, enemy: Enemy): Promise<void>;
  animatePowerReturn(hero: Hero): void;                 // l'or quitte Maelor, vers le Dragon (MAE-95), avec un son ; non attendu

  // — Combat —
  // Horloge du combat : callback est appelé à chaque image avec le temps écoulé depuis la précédente, en millisecondes
  // (pour la première : depuis l'appel à frames). Renvoie la fonction d'arrêt.
  frames(callback: (elapsedMs: number) => void): () => void;
  startBattle(state: BattleState): Promise<void>;       // construit la scène et joue l'entrée en combat
  heroReady(hero: Hero): void;                          // sa jauge est pleine
  requestOrder(context: OrderContext): OrderRequest;    // ouvre le menu du héros
  refreshGauges(heroes: Hero[]): void;                  // à chaque image
  message(text: string): Promise<void>;                 // bandeau le temps de le lire
  showDefend(hero: Hero): void;
  actionStart(actor: Combatant, ability: Ability): Promise<void>;
  showEffects(hits: Hit[], ability: Ability): Promise<void>; // chiffres et effets, puis la pause pour les lire
  actionEnd(actor: Combatant): Promise<void>;
  showDefeated(enemy: Enemy): void;                     // vaincu mais pas mort : il reste à terre
  killEnemies(enemies: Enemy[]): Promise<void>;
  animateEscape(): Promise<void>;
}

// Vue de départ de la logique, avant qu'une vraie vue lui soit donnée : tout appel est une erreur de programmation
export function noView(): GameView {
  // Un Proxy vide tient lieu de GameView : chaque accès lève une erreur, aucune méthode n'est jamais appelée dessus
  return new Proxy({} as GameView, {
    get(_target, name) { throw new Error(`Aucune vue pour ${String(name)} : la logique n'a pas reçu d'affichage`); },
  });
}
