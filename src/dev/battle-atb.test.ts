// battle-atb.test.ts - Jauge ATB, modes Attente et Actif, rejeu à l'identique (MAE-22)
//
// Passe par runBattle et la vue muette : le test tient l'horloge (frames) et la demande d'ordre (requestOrder).
// Le combat n'a pas besoin de se terminer pour ces tests : sa promesse reste en attente, sans aucune minuterie.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIG } from "../config.ts";
import { ATTACK, GameState, type BattleChapter } from "../data/game-data.ts";
import { Battle, runBattle, targetCandidates } from "../battle/battle.ts";
import type { HeroOrder, OrderContext } from "../game-view.ts";
import { createSilentView } from "./silent-view.ts";
import { seedRandom } from "./test-helpers.ts";

const CHAPTER: BattleChapter = { title: "Test", tint: "", story: [], music: "battle", enemies: ["sankri"] };
const NO_STRATEGY = {
  order(): HeroOrder { throw new Error("aucun ordre attendu"); },
  choose(): never { throw new Error("aucune question attendue"); },
};

const FRAME_MS = 50;

// Combat lancé, horloge et demandes d'ordre aux mains du test. Toutes les jauges partent de 0.
async function startBattle() {
  vi.spyOn(Math, "random").mockReturnValue(0);
  GameState.reset();

  const view = createSilentView(NO_STRATEGY);
  let frame: ((elapsedMs: number) => void) | null = null;
  const requests: { context: OrderContext; cancelled: boolean; answer: (order: HeroOrder) => Promise<void> }[] = [];
  view.frames = callback => {
    frame = callback;
    return () => { frame = null; };
  };
  // Une demande reste ouverte tant que le test ne répond pas ; answer donne l'ordre, puis laisse la logique le recevoir
  view.requestOrder = context => {
    let settle: (order: HeroOrder) => void = () => {};
    const order = new Promise<HeroOrder>(resolve => { settle = resolve; });
    const request = {
      context, cancelled: false,
      answer: async (chosen: HeroOrder) => { settle(chosen); await order; await Promise.resolve(); },
    };
    requests.push(request);
    return { order, cancel() { request.cancelled = true; } };
  };

  void runBattle(view, CHAPTER);
  await vi.waitFor(() => expect(frame).not.toBeNull());

  const tick = (elapsedMs = FRAME_MS) => {
    if (!frame) throw new Error("l'horloge du combat est arrêtée");
    frame(elapsedMs);
  };
  const [maelor, corvin, elwen] = Battle.heroes;
  const [enemy] = Battle.enemies;
  return { tick, requests, maelor, corvin, elwen, enemy };
}

const gain = (spd: number, seconds: number) => (spd + 20) * CONFIG.atb.fillRate * seconds;

const initialMode = CONFIG.atb.mode;
beforeEach(() => { CONFIG.atb.mode = "wait"; });
afterEach(() => {
  CONFIG.atb.mode = initialMode;
  vi.restoreAllMocks();
});

describe("remplissage de la jauge", () => {
  it("suit (vitesse + 20) × fillRate par seconde", async () => {
    const { tick, maelor, corvin } = await startBattle();
    tick();
    expect(maelor.atb).toBeCloseTo(gain(maelor.spd, FRAME_MS / 1000));
    expect(corvin.atb).toBeCloseTo(gain(corvin.spd, FRAME_MS / 1000));
  });

  it("monte plus vite pour le combattant le plus rapide", async () => {
    const { tick, maelor, corvin } = await startBattle();
    expect(corvin.spd).toBeGreaterThan(maelor.spd);
    tick();
    expect(corvin.atb).toBeGreaterThan(maelor.atb);
  });

  it("s'accumule d'une image à l'autre", async () => {
    const { tick, maelor } = await startBattle();
    tick();
    tick();
    tick();
    expect(maelor.atb).toBeCloseTo(gain(maelor.spd, 3 * FRAME_MS / 1000));
  });

  it("plafonne le temps d'une image à 0,1 s : un onglet en arrière-plan ne rattrape pas d'un coup", async () => {
    const { tick, maelor } = await startBattle();
    tick(5000);
    expect(maelor.atb).toBeCloseTo(gain(maelor.spd, 0.1));
  });

  it("rend le héros prêt à 100, sans dépasser, et lui demande un ordre", async () => {
    const { tick, requests, maelor } = await startBattle();
    maelor.atb = 99.9;
    expect(requests).toHaveLength(0);
    tick();
    expect(maelor.atb).toBe(100);
    expect(maelor.state).toBe("ready");
    expect(requests.map(request => request.context.hero)).toEqual([maelor]);
  });

  it("laisse le héros en charge tant que la jauge n'est pas à 100", async () => {
    const { tick, requests, maelor } = await startBattle();
    maelor.atb = 99 - gain(maelor.spd, FRAME_MS / 1000);
    tick();
    expect(maelor.atb).toBeCloseTo(99);
    expect(maelor.state).toBe("charging");
    expect(requests).toHaveLength(0);
  });

  it("ne bouge plus une fois le héros prêt", async () => {
    const { tick, maelor } = await startBattle();
    maelor.atb = 99.9;
    tick();
    tick();
    expect(maelor.atb).toBe(100);
    expect(Battle.readyQueue).toEqual([maelor]);
  });

  it("ne bouge pas pour un héros à terre", async () => {
    const { tick, maelor } = await startBattle();
    maelor.hp = 0;
    tick();
    expect(maelor.atb).toBe(0);
  });
});

describe("modes de temps", () => {
  const DEFEND: HeroOrder = { kind: "defend" };
  const PASS: HeroOrder = { kind: "pass" };

  // Maelor est prêt, son menu est ouvert : la jauge de Corvin sert de témoin
  async function withOpenMenu() {
    const battle = await startBattle();
    battle.maelor.atb = 99.9;
    battle.tick();
    const before = battle.corvin.atb;
    return { ...battle, before };
  }

  // Le menu s'ouvre et se ferme dans la vue, sans que la logique sache s'il s'agit du menu principal, d'un sous-menu
  // ou d'un ciblage : le temps tient à la seule demande d'ordre, ouverte jusqu'au choix
  it("Attente : les jauges s'arrêtent tant que le menu est ouvert", async () => {
    const { tick, corvin, enemy, before } = await withOpenMenu();
    const enemyBefore = enemy.atb;
    tick();
    tick();
    expect(corvin.atb).toBe(before);
    expect(enemy.atb).toBe(enemyBefore);
  });

  it("Attente : le temps reprend dès que l'ordre est donné", async () => {
    const { tick, requests, corvin, before } = await withOpenMenu();
    await requests[0].answer(DEFEND);
    tick();
    expect(corvin.atb).toBeCloseTo(before + gain(corvin.spd, FRAME_MS / 1000));
  });

  it("Attente : une action ennemie déjà en file attend le choix, puis part", async () => {
    const { tick, requests, maelor, enemy } = await startBattle();
    maelor.atb = 99.9;
    enemy.atb = 99.9;
    tick(); // les deux jauges sont pleines à la même image : le menu de Maelor s'ouvre, l'action de l'ennemi entre en file
    expect(requests).toHaveLength(1);
    expect(Battle.actionQueue.map(action => action.actor)).toEqual([enemy]);
    tick();
    tick();
    expect(Battle.busy).toBe(false);
    expect(Battle.actionQueue).toHaveLength(1);
    await requests[0].answer(DEFEND);
    tick();
    expect(Battle.busy).toBe(true); // l'action de l'ennemi se joue
    expect(Battle.actionQueue).toHaveLength(0);
  });

  it("Attente : avec deux héros prêts, le temps reste arrêté jusqu'au second choix", async () => {
    const { tick, requests, maelor, corvin, elwen } = await startBattle();
    maelor.atb = 99.9;
    corvin.atb = 99.9;
    tick();
    const witness = elwen.atb;
    await requests[0].answer(DEFEND);
    expect(requests.map(request => request.context.hero)).toEqual([maelor, corvin]);
    tick();
    expect(elwen.atb).toBe(witness);
    expect(maelor.atb).toBe(0); // en Garde, sa jauge repart de zéro, mais pas encore
    await requests[1].answer(DEFEND);
    tick();
    expect(elwen.atb).toBeCloseTo(witness + gain(elwen.spd, FRAME_MS / 1000));
  });

  it("Attente : passer la main au héros suivant garde le temps arrêté", async () => {
    const { tick, requests, maelor, corvin, elwen } = await startBattle();
    maelor.atb = 99.9;
    corvin.atb = 99.9;
    tick();
    const witness = elwen.atb;
    await requests[0].answer(PASS);
    expect(requests.map(request => request.context.hero)).toEqual([maelor, corvin]);
    tick();
    expect(elwen.atb).toBe(witness);
  });

  it("Actif : le temps continue menu ouvert, et l'action ennemie en file part", async () => {
    CONFIG.atb.mode = "active";
    const { tick, requests, maelor, corvin, enemy } = await startBattle();
    maelor.atb = 99.9;
    enemy.atb = 99.9;
    tick();
    expect(requests).toHaveLength(1);
    expect(Battle.busy).toBe(true); // l'ennemi agit pendant que le menu de Maelor est ouvert
    const before = corvin.atb;
    await vi.waitFor(() => expect(Battle.busy).toBe(false));
    tick();
    expect(corvin.atb).toBeCloseTo(before + gain(corvin.spd, FRAME_MS / 1000));
  });
});

describe("rejeu", () => {
  // Combat complet, à la vraie boucle de la vue muette : chaque héros frappe le premier ennemi debout
  async function playWithSeed(seed: number) {
    seedRandom(seed);
    GameState.reset();
    const view = createSilentView({
      order: ({ hero }) => ({ kind: "ability", ability: ATTACK, targets: targetCandidates(hero, "foe").slice(0, 1), itemId: null }),
      choose: question => question.options[0].id,
    });
    const result = await runBattle(view, CHAPTER);
    vi.restoreAllMocks();
    return { result, log: view.log, party: GameState.party.map(hero => [hero.hp, hero.mp, hero.atb]) };
  }

  it("la même graine rejoue exactement le même combat", async () => {
    const first = await playWithSeed(2026);
    const second = await playWithSeed(2026);
    expect(first.result).toBe("victory");
    expect(second).toEqual(first);
  });

  it("une autre graine donne un autre combat", async () => {
    const first = await playWithSeed(2026);
    const other = await playWithSeed(7);
    expect(other.log).not.toEqual(first.log);
  });
});
