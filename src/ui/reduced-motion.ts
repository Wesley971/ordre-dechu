// reduced-motion.ts - Le réglage « mouvement réduit » (MAE-58), lu à un seul endroit (MAE-31)
//
// Tout le code qui anime passe par isReducedMotion() : les images animées, les deux scènes du combat, leurs effets
// spéciaux, la scène peinte et la bande de dialogue. La feuille de style, elle, garde ses blocs
// @media (prefers-reduced-motion) : ils suivent le réglage du système, pas la simulation de l'aperçu.
// Sans DOM : sous Node (tests, combat sans navigateur), matchMedia n'existe pas et le mouvement n'est jamais réduit.

const system = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
let simulated: boolean | null = null;
const listeners = new Set<() => void>();
let listening = false;
let known = false; // la valeur que les abonnés connaissent : ils ne sont prévenus que si elle change vraiment

// Mouvement réduit en ce moment : le réglage du système, ou celui que simule l'aperçu des animations (mode test)
export function isReducedMotion(): boolean {
  return simulated ?? system?.matches ?? false;
}

// Le système ou la simulation vient de bouger : les abonnés ne sont prévenus que si le réglage effectif a changé
// (sous une simulation, un changement du système ne change rien)
function changed() {
  const now = isReducedMotion();
  if (now === known) return;
  known = now;
  for (const listener of [...listeners]) listener();
}

// Aperçu des animations (mode test) : simule le réglage « mouvement réduit » ; null rend la main au système
export function overrideReducedMotion(reduced: boolean | null) {
  simulated = reduced;
  changed();
}

// Prévient quand le réglage effectif change, par le système ou par la simulation. Rend la fonction qui retire
// l'abonnement
export function onReducedMotionChange(listener: () => void): () => void {
  if (listeners.size === 0) known = isReducedMotion();
  listeners.add(listener);
  if (!listening && system) {
    system.addEventListener("change", changed);
    listening = true;
  }
  return () => { listeners.delete(listener); };
}
