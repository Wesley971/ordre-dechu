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
  const requests: { context: OrderContext; cancelled: boolean }[] = [];
  view.frames = callback => {
    frame = callback;
    return () => { frame = null; };
  };
  view.requestOrder = context => {
    const request = { context, cancelled: false };
    requests.push(request);
    return { order: new Promise(() => {}), cancel() { request.cancelled = true; } };
  };

  void runBattle(view, CHAPTER);
  await vi.waitFor(() => expect(frame).not.toBeNull());

  const tick = (elapsedMs = FRAME_MS) => {
    if (!frame) throw new Error("l'horloge du combat est arrêtée");
    frame(elapsedMs);
  };
  const [maelor, corvin] = Battle.heroes;
  return { tick, requests, maelor, corvin };
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
  // Maelor est prêt, son menu est ouvert : la jauge de Corvin sert de témoin
  async function withOpenMenu() {
    const battle = await startBattle();
    battle.maelor.atb = 99.9;
    battle.tick();
    const before = battle.corvin.atb;
    return { ...battle, context: battle.requests[0].context, before };
  }

  it("Attente : le temps court au menu principal", async () => {
    const { tick, corvin, before } = await withOpenMenu();
    tick();
    expect(corvin.atb).toBeGreaterThan(before);
  });

  it("Attente : le temps se fige dans un sous-menu, puis repart à la sortie", async () => {
    const { tick, corvin, context, before } = await withOpenMenu();
    context.onBrowse(true);
    tick();
    tick();
    expect(corvin.atb).toBe(before);
    context.onBrowse(false);
    tick();
    expect(corvin.atb).toBeCloseTo(before + gain(corvin.spd, FRAME_MS / 1000));
  });

  it("Actif : le temps continue dans un sous-menu", async () => {
    CONFIG.atb.mode = "active";
    const { tick, corvin, context, before } = await withOpenMenu();
    context.onBrowse(true);
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
