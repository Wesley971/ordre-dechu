// reduced-motion.test.ts - Le réglage « mouvement réduit », lu à un seul endroit (MAE-31), sans DOM
import { afterEach, describe, expect, it, vi } from "vitest";

// Un faux matchMedia : le réglage du système, que le test change à la main
function fakeSystem(matches: boolean) {
  const changes = new Set<() => void>();
  const query = {
    matches,
    addEventListener: (_type: string, listener: () => void) => { changes.add(listener); },
    removeEventListener: (_type: string, listener: () => void) => { changes.delete(listener); },
  };
  vi.stubGlobal("matchMedia", () => query);
  return { set(value: boolean) { query.matches = value; for (const listener of [...changes]) listener(); } };
}

// Le module lit matchMedia à son chargement : chaque test le recharge
const load = async () => { vi.resetModules(); return import("../ui/reduced-motion.ts"); };

afterEach(() => { vi.unstubAllGlobals(); });

describe("mouvement réduit", () => {
  it("sans matchMedia (Node), le mouvement n'est jamais réduit, et s'abonner ne casse rien", async () => {
    const motion = await load();
    expect(motion.isReducedMotion()).toBe(false);
    const stop = motion.onReducedMotionChange(() => {});
    stop();
  });

  it("suit le réglage du système", async () => {
    const system = fakeSystem(true);
    const motion = await load();
    expect(motion.isReducedMotion()).toBe(true);
    system.set(false);
    expect(motion.isReducedMotion()).toBe(false);
  });

  it("la simulation de l'aperçu l'emporte sur le système, et null lui rend la main", async () => {
    fakeSystem(false);
    const motion = await load();
    motion.overrideReducedMotion(true);
    expect(motion.isReducedMotion()).toBe(true);
    motion.overrideReducedMotion(null);
    expect(motion.isReducedMotion()).toBe(false);
  });

  it("prévient quand le réglage change, par le système ou par la simulation, jusqu'au désabonnement", async () => {
    const system = fakeSystem(false);
    const motion = await load();
    const seen: boolean[] = [];
    const stop = motion.onReducedMotionChange(() => seen.push(motion.isReducedMotion()));
    system.set(true);
    motion.overrideReducedMotion(false);
    motion.overrideReducedMotion(false); // rien ne change : pas d'appel
    expect(seen).toEqual([true, false]);
    stop();
    motion.overrideReducedMotion(true);
    expect(seen).toEqual([true, false]);
  });

  it("sous une simulation, un changement du système ne prévient personne : le réglage effectif n'a pas bougé", async () => {
    const system = fakeSystem(false);
    const motion = await load();
    motion.overrideReducedMotion(true);
    let calls = 0;
    motion.onReducedMotionChange(() => { calls++; });
    system.set(true);
    system.set(false);
    expect(calls).toBe(0);
    motion.overrideReducedMotion(null); // la main revient au système, qui ne réduit pas : le réglage change
    expect(calls).toBe(1);
  });

  it("un abonné arrivé après un changement n'est prévenu que des suivants", async () => {
    const system = fakeSystem(false);
    const motion = await load();
    system.set(true); // personne n'écoute encore
    let calls = 0;
    motion.onReducedMotionChange(() => { calls++; });
    system.set(false);
    expect(calls).toBe(1);
  });
});
