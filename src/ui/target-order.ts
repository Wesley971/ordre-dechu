// target-order.ts - Règles du ciblage à la souris, au clavier et à la manette (MAE-89), sans DOM : testées sous Node
//
// Le menu (battle-menu.ts) mesure la place des combattants à l'écran et lui demande quoi faire ; ces fonctions ne
// lisent ni la page ni l'état du combat.

// Un combattant et le centre de son sprite à l'écran
export interface Placed<T> { item: T; x: number; y: number }

// De gauche à droite à l'écran ; à égalité, du haut vers le bas
export function screenOrder<T>(placed: Placed<T>[]): T[] {
  return [...placed].sort((a, b) => a.x - b.x || a.y - b.y).map(p => p.item);
}

// La cible voisine sur la ligne, dans le sens demandé (-1 : à gauche, 1 : à droite) ; null au bout de la ligne,
// sans revenir à l'autre bout, ou si la cible actuelle n'est pas sur la ligne
export function stepAlong<T>(line: T[], current: T, delta: -1 | 1): T | null {
  const index = line.indexOf(current);
  if (index < 0) return null;
  return line[index + delta] ?? null;
}

// Clic sur un combattant hors ciblage : seul un clic sur un ennemi, au menu principal, frappe (décision 3 du 07/11/2026)
export interface StrikeQuery {
  atRoot: boolean;          // le menu principal est ouvert, sans sous-menu
  attackEnabled: boolean;   // « Frapper » est disponible pour le héros
  isCandidate: boolean;     // le combattant cliqué est une cible possible de « Frapper » (un ennemi debout)
  pointerLayout: boolean;   // affichage d'ordinateur : sur téléphone, le toucher ne frappe pas (planches P1 à P6)
  sinceOpenMs: number;      // temps écoulé depuis l'ouverture du menu de ce héros
}

// En dessous, le clic est le second d'un double clic qui a déjà donné l'ordre du héros précédent
export const STRIKE_GUARD_MS = 250;

export function canStrike(query: StrikeQuery): boolean {
  return query.atRoot && query.attackEnabled && query.isCandidate && query.pointerLayout && query.sinceOpenMs >= STRIKE_GUARD_MS;
}
