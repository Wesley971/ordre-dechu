// battle-run.test.ts - Le Repli, permis seulement là où le chapitre le déclare (MAE-119)
//
// Ailleurs, un repli réussi sauterait la scène qui suit le combat (trêve, reddition, choix du pouvoir...) et mènerait
// quand même au chapitre suivant. Le combat passe par runBattle et la vue muette, l'horloge aux mains du test.

import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAPTERS, GameState, RUN, type BattleChapter } from "../data/game-data.ts";
import { Battle, runBattle, type BattleResult } from "../battle/battle.ts";
import type { HeroOrder } from "../game-view.ts";
import { createSilentView } from "./silent-view.ts";

const NO_QUESTION = {
  order(): HeroOrder { throw new Error("aucun ordre attendu hors de requestOrder"); },
  choose(): never { throw new Error("aucune question attendue"); },
};
const RETREAT: HeroOrder = { kind: "ability", ability: RUN, targets: [], itemId: null };

function battleChapter(numeral: string): BattleChapter {
  const chapter = CHAPTERS.find(c => c.title.startsWith(`${numeral} ·`));
  if (!chapter || chapter.rest) throw new Error(`pas de combat au chapitre ${numeral}`);
  return chapter;
}

// Maelor ordonne le Repli dès son premier tour ; Math.random à 0 : le tirage du repli réussirait à coup sûr
async function retreatIn(chapter: BattleChapter) {
  vi.spyOn(Math, "random").mockReturnValue(0);
  GameState.reset();
  const view = createSilentView(NO_QUESTION);
  let frame: ((elapsedMs: number) => void) | null = null;
  view.frames = callback => {
    frame = callback;
    return () => { frame = null; };
  };
  let asked = 0;
  view.requestOrder = () => {
    asked++;
    return { order: Promise.resolve(RETREAT), cancel() {} };
  };

  let result: BattleResult | null = null;
  void runBattle(view, chapter).then(r => { result = r; });
  await vi.waitFor(() => expect(frame).not.toBeNull());
  const tick = () => {
    if (!frame) throw new Error("l'horloge du combat est arrêtée");
    frame(50);
  };
  const [maelor] = Battle.heroes;
  maelor.atb = 99.9;
  tick(); // Maelor est prêt : son ordre de Repli entre en file
  await vi.waitFor(() => expect(asked).toBe(1));
  tick(); // l'action se joue
  await vi.waitFor(() => expect(Battle.busy).toBe(false));
  return { log: view.log, result: () => result };
}

afterEach(() => { vi.restoreAllMocks(); });

describe("Repli", () => {
  it("n'est permis qu'au chapitre I, de tous les chapitres de combat", () => {
    const allowed = Object.fromEntries(
      CHAPTERS.filter(chapter => !chapter.rest).map(chapter => [chapter.title.split(" ·")[0], chapter.canRun === true]),
    );
    expect(allowed).toEqual({ I: true, II: false, III: false, IV: false, V: false, VII: false });
  });

  it("est impossible devant les Gau-Tik, même avec un tirage qui aurait réussi", async () => {
    const { log, result } = await retreatIn(battleChapter("III"));
    expect(log).toContain("message : Repli impossible !");
    expect(log).not.toContain("le groupe se replie");
    expect(Battle.over).toBe(false);
    expect(result()).toBeNull();
  });

  it("réussit à la Lisière avec le même tirage", async () => {
    const { log, result } = await retreatIn(battleChapter("I"));
    expect(log).toContain("le groupe se replie");
    await vi.waitFor(() => expect(result()).toBe("escape"));
  });
});
