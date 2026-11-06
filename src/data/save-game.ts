// save-game.ts - Sauvegarde de la partie dans le navigateur (MAE-11) : le point de reprise du début de chapitre
// (GameState.checkpoint, game-data.ts), gardé d'une visite à l'autre. Un seul emplacement.
// Stockage bloqué ou plein (navigation privée, réglages) : chaque accès est dans un try, le jeu reste jouable
// sans sauvegarde, comme pour le réglage du son (sfx.ts). En mode test, main.ts la désactive : rien n'est lu ni écrit.

const SAVE_KEY = "ordre-dechu-save";

export const SaveGame = {
  enabled: true,

  // Le point de reprise sauvegardé, ou null (aucun, stockage bloqué, sauvegarde désactivée). Sa forme se vérifie à la lecture.
  read(): string | null {
    if (!this.enabled) return null;
    try { return localStorage.getItem(SAVE_KEY); } catch { return null; }
  },

  write(checkpoint: string | null) {
    if (!this.enabled || checkpoint === null) return;
    try { localStorage.setItem(SAVE_KEY, checkpoint); } catch { /* stockage bloqué ou plein : le jeu continue sans sauvegarde */ }
  },

  // Une fin est atteinte : la partie est terminée, « Continuer » disparaît
  clear() {
    if (!this.enabled) return;
    try { localStorage.removeItem(SAVE_KEY); } catch { /* stockage bloqué : rien à effacer */ }
  },
};
