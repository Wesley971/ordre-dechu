// silent-view.ts - Vue muette : l'implémentation de GameView (src/game-view.ts) sans écran, pour les tests (MAE-21)
//
// Rien n'est dessiné ni joué : chaque animation se termine aussitôt, l'horloge avance d'un pas fixe à chaque
// tour de boucle, et les décisions du joueur viennent d'une stratégie fournie. Fonctionne sous Node comme dans
// un navigateur : aucun DOM ici. Tout ce que le jeu « affiche » est consigné dans `log`.

import type { Ability, Page } from "../data/game-data.ts";
import type { Combatant } from "../battle/battle.ts";
import type { GameView, HeroOrder, OrderContext, Question } from "../game-view.ts";

export interface SilentStrategy {
  // L'ordre d'un héros prêt. « pass » n'est suivi que si un autre héros attend aussi (sinon : Garde)
  order(context: OrderContext): HeroOrder;
  // La réponse à une question posée au joueur (pouvoir du Cœur, sort du Dragon)
  choose<T extends string>(question: Question<T>): T;
}

export interface SilentView extends GameView {
  log: string[];       // ce que le jeu aurait montré, une ligne par événement
  frameCount: number;  // images délivrées par l'horloge
}

const FRAME_MS = 1000 / 60;

// Tour de boucle suivant : setImmediate sous Node (les minuteries de Windows ont un grain de 15 ms, qui ferait
// durer un combat de 300 images 5 secondes), setTimeout(0) ailleurs. Lu sur globalThis : absent des types du DOM.
const nextTurn: (callback: () => void) => void =
  (globalThis as { setImmediate?: (callback: () => void) => void }).setImmediate ?? (callback => setTimeout(callback, 0));

const stripHtml = (html: string) => html.replace(/<br\s*\/?>/g, " / ").replace(/<[^>]+>/g, "").trim();
const pageText = (page: Page) => stripHtml(typeof page === "string" ? page : page.html);
const name = (c: Combatant) => c.name;

export function createSilentView(strategy: SilentStrategy, { frameMs = FRAME_MS } = {}): SilentView {
  const view: SilentView = {
    log: [],
    frameCount: 0,

    // — Écrans et histoire —

    async showTitle(options) {
      view.log.push(`titre : ${options.startLabel}${options.canRetry ? " · Réessayer" : ""}${options.canContinue ? " · Continuer" : ""}`);
      return "start";
    },
    showChapter(chapter) { view.log.push(`chapitre : ${chapter.title}`); },
    music(id) { view.log.push(`musique : ${id ?? "silence"}`); },
    async tell({ title, pages }) {
      if (title) view.log.push(`— ${title} —`);
      for (const page of pages) view.log.push(`page : ${pageText(page)}`);
    },
    async ask(question) {
      const answer = strategy.choose(question);
      view.log.push(`question : ${stripHtml(question.text)} → ${answer}`);
      return answer;
    },
    refresh() {},
    celebrate() { view.log.push("victoire : pose et fanfare"); },
    async showDefeat({ pages }) { for (const page of pages) view.log.push(`défaite : ${pageText(page)}`); },
    async animateSpare(enemy) { view.log.push(`${name(enemy)} se relève`); },
    async animateFinishingBlow(hero, enemy) { view.log.push(`${name(hero)} achève ${name(enemy)}`); },
    animatePowerReturn(hero) { view.log.push(`l'or quitte ${name(hero)}`); },

    // — Combat —

    frames(callback) {
      let running = true;
      const tick = () => {
        if (!running) return;
        view.frameCount++;
        callback(frameMs);
        nextTurn(tick); // une macrotâche par image : les promesses du combat s'intercalent
      };
      nextTurn(tick);
      return () => { running = false; };
    },
    async startBattle(state) {
      view.log.push(`combat : ${state.enemies.map(name).join(", ")}`);
    },
    heroReady(hero) { view.log.push(`${name(hero)} est prêt`); },
    requestOrder(context) {
      let settled = false;
      let settle: (order: HeroOrder | null) => void = () => {};
      const order = new Promise<HeroOrder | null>(resolve => { settle = resolve; });
      // La décision arrive avant l'image suivante, comme un joueur qui répondrait sans délai
      queueMicrotask(() => {
        if (settled) return;
        settled = true;
        let chosen = strategy.order(context);
        if (chosen.kind === "pass" && !context.canPass()) chosen = { kind: "defend" };
        view.log.push(`${name(context.hero)} : ${describeOrder(chosen)}`);
        settle(chosen);
      });
      return {
        order,
        cancel() {
          if (settled) return;
          settled = true;
          settle(null);
        },
      };
    },
    refreshGauges() {},
    async message(text) { view.log.push(`message : ${text}`); },
    showDefend(hero) { view.log.push(`${name(hero)} se met en garde`); },
    async actionStart(actor, ability) { view.log.push(`${name(actor)} → ${ability.name}`); },
    async showEffects(hits) {
      for (const { target, effect } of hits) {
        const amount = "amount" in effect ? ` ${effect.amount}` : "";
        const flags = `${effect.crit ? " critique" : ""}${effect.weak ? " faiblesse" : ""}`;
        view.log.push(`  ${name(target)} : ${effect.type}${amount}${flags}`);
      }
    },
    async actionEnd() {},
    showDefeated(enemy) { view.log.push(`${name(enemy)} est à terre`); },
    async killEnemies(enemies) { view.log.push(`${enemies.map(name).join(", ")} : mort`); },
    async animateEscape() { view.log.push("le groupe se replie"); },
  };
  return view;
}

function describeOrder(order: HeroOrder) {
  switch (order.kind) {
    case "ability": return `${abilityName(order.ability)} sur ${order.targets.map(name).join(", ") || "personne"}`;
    case "defend":  return "Garde";
    case "pass":    return "passe la main";
  }
}

const abilityName = (ability: Ability) => ability.name;
