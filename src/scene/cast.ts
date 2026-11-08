// cast.ts - Distribution de la scène peinte : les acteurs d'un chapitre, leur place sur la peinture et leurs lueurs
// (MAE-29). Données seules, communes au combat (battle-stage.ts) et à l'aperçu (dev/scene-preview.ts). La respiration
// est dans l'image animée de chaque combattant (src/ui/sprite-motion.ts, MAE-30).

import { ENEMIES, HEROES, type EnemyId, type SpriteRig } from "../data/game-data.ts";
import type { Decor, ImagePoint } from "../data/decors.ts";
import { HERO_CANVAS } from "../ui/stage.ts";
import type { ActorDef } from "./actors.ts";
import type { GroupExtent } from "./framing.ts";

const GOLD_LIGHT = "#f0c95a";  // lumière d'Elwen, palette des personnages
const CORVIN_FLAME = "#8fb8e0"; // lanterne de Corvin, palette des personnages

// Elwen et Corvin portent une lueur
const HALOS: Record<string, ActorDef["halo"]> = {
  elwen:  { color: GOLD_LIGHT, at: [0.82, 0.5], size: 1.6 },
  corvin: { color: CORVIN_FLAME, at: [0.83, 0.4], size: 1.1 },
};

// Ce qu'il faut d'un combattant pour le poser sur la peinture et l'animer
export interface CastMember { id: string; image: string; side: "hero" | "enemy"; rig: SpriteRig; height: number }

// Un membre de la distribution d'après la fiche d'un héros ou d'un ennemi (identifiant d'ennemi comme createEnemies)
export function heroMember(id: string): CastMember {
  const def = HEROES.find((hero) => hero.id === id);
  if (!def) throw new Error(`Scène peinte : aucun héros ${id}`);
  return { id, image: def.image, side: "hero", rig: def.rig, height: HERO_CANVAS.h };
}
export function enemyMember(key: EnemyId, index: number): CastMember {
  const def = ENEMIES[key];
  return { id: `${key}-${index}`, image: def.image, side: "enemy", rig: def.rig, height: def.canvasHeight };
}

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

// Les acteurs d'une distribution, images déjà chargées (preloadImages) et images animées prêtes (frames, par identifiant)
export function actorDefs(
  decor: Decor, members: CastMember[], images: Map<string, HTMLImageElement>, frames: Map<string, ActorDef["frame"]>,
): ActorDef[] {
  let enemies = 0;
  return members.map((member) => {
    const place = placeOf(decor, member, member.side === "enemy" ? enemies++ : 0);
    const image = imageOf(images, member);
    const frame = frames.get(member.id);
    if (!frame) throw new Error(`Scène peinte : image animée absente : ${member.id}`);
    return { id: member.id, src: member.image, width: image.width, height: image.height, frame, place, halo: HALOS[member.id] };
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
