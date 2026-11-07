// cast.ts - Distribution de la scène peinte : les acteurs d'un chapitre, leur place sur la peinture, leur respiration
// et leurs lueurs (MAE-29). Données seules, communes au combat (battle-stage.ts) et à l'aperçu (dev/scene-preview.ts).

import type { Decor, ImagePoint } from "../data/decors.ts";
import type { ActorDef } from "./actors.ts";
import type { GroupExtent } from "./framing.ts";

const GOLD_LIGHT = "#f0c95a";  // lumière d'Elwen, palette des personnages
const CORVIN_FLAME = "#8fb8e0"; // lanterne de Corvin, palette des personnages

interface Look {
  breath: ActorDef["breath"];
  halo?: ActorDef["halo"];
}

// Chaque héros respire à son rythme ; Elwen et Corvin portent une lueur
const HERO_LOOKS: Record<string, Look> = {
  elwen:  { breath: { cut: 0.5, period: 3.4, phase: 0.55 }, halo: { color: GOLD_LIGHT, at: [0.82, 0.5], size: 1.6 } },
  corvin: { breath: { cut: 0.45, period: 3.1, phase: 0.2 }, halo: { color: CORVIN_FLAME, at: [0.83, 0.4], size: 1.1 } },
  maelor: { breath: { cut: 0.45, period: 2.8, phase: 0 } },
};
const DEFAULT_LOOK: Look = { breath: { cut: 0.45, period: 3, phase: 0.3 } };
// Les ennemis, dans l'ordre du chapitre : décalés pour ne pas respirer ensemble
const ENEMY_BREATHS: ActorDef["breath"][] = [
  { cut: 0.45, period: 3.8, phase: 0.35 }, { cut: 0.45, period: 4.1, phase: 0.8 }, { cut: 0.45, period: 3.5, phase: 0.1 },
];

// Ce qu'il faut d'un combattant pour le poser sur la peinture
export interface CastMember { id: string; image: string; side: "hero" | "enemy" }

function placeOf(decor: Decor, member: CastMember, enemyIndex: number): ImagePoint {
  const place = member.side === "hero" ? decor.places.heroes[member.id] : decor.places.enemies[enemyIndex];
  if (!place) throw new Error(`Scène peinte : aucune place pour ${member.id} dans ce décor`);
  return place;
}

function imageOf(images: Map<string, HTMLImageElement>, member: CastMember) {
  const image = images.get(member.image);
  if (!image) throw new Error(`Scène peinte : image non chargée : ${member.image}`);
  return image;
}

// Les acteurs d'une distribution, images déjà chargées (preloadImages)
export function actorDefs(decor: Decor, members: CastMember[], images: Map<string, HTMLImageElement>): ActorDef[] {
  let enemies = 0;
  return members.map((member) => {
    const place = placeOf(decor, member, member.side === "enemy" ? enemies++ : 0);
    const look = member.side === "hero" ? HERO_LOOKS[member.id] ?? DEFAULT_LOOK : { breath: ENEMY_BREATHS[(enemies - 1) % ENEMY_BREATHS.length] };
    return { id: member.id, src: member.image, image: imageOf(images, member), place, breath: look.breath, halo: look.halo };
  });
}

// Étendue du groupe pour le cadrage : fixée pour tout le chapitre, qu'il y ait ou non des ennemis en scène
export function castExtent(decor: Decor, members: CastMember[], images: Map<string, HTMLImageElement>): GroupExtent {
  let enemies = 0;
  return members.map((member) => {
    const { col, row } = placeOf(decor, member, member.side === "enemy" ? enemies++ : 0);
    return { col, row, spriteWidth: imageOf(images, member).width };
  });
}
