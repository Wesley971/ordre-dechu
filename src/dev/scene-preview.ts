// scene-preview.ts - Page de contrôle de la scène peinte, en mode test (?scene=lisiere, MAE-28)
// Chargée à la demande depuis main.ts : c'est elle, et elle seule, qui fait charger Three.js.
// Touche P : la caméra oscille et révèle le relief. ?verif=1 : sans compteur, mesures pour le bot (data-verif, window.scenePreview).

import { CHAPTERS, HEROES } from "../data/game-data.ts";
import { DECORS, type Decor, type DecorId } from "../data/decors.ts";
import { preloadImages, type ActorsView } from "../scene/actors.ts";
import { actorDefs, castExtent, enemyMember, heroMember, type CastMember } from "../scene/cast.ts";
import { createAnimatedSprite } from "../ui/animated-sprite.ts";
import { enemyPhase } from "../ui/stage.ts";
import { createPaintedStage, type PaintedStage, type SceneQuality } from "../scene/painted-stage.ts";
import { overlay, startCounter } from "./fps-counter.ts";

// Les personnages du combat du chapitre, comme la scène de combat les posera (MAE-29)
function castOf(decor: Decor): CastMember[] {
  const chapter = CHAPTERS.find((candidate) => candidate.decor === decor.id);
  const enemies = chapter && !chapter.rest ? chapter.enemies : [];
  return [
    ...HEROES.map((hero) => heroMember(hero.id)),
    ...enemies.map((key, i) => enemyMember(key, i)),
  ];
}

export async function openScenePreview(decorId: DecorId, quality?: SceneQuality) {
  const verify = new URLSearchParams(location.search).has("verif");
  const page = document.createElement("div");
  Object.assign(page.style, { position: "fixed", inset: "0", zIndex: "1000", background: "#000", overflow: "hidden" });
  document.body.appendChild(page);

  const decor = DECORS[decorId];
  const chapter = CHAPTERS.find((candidate) => candidate.decor === decorId);
  const members = castOf(decor);
  let stage: PaintedStage;
  let cast: ReturnType<typeof actorDefs>;
  let actors: ActorsView | null = null;
  try {
    stage = createPaintedStage(page, quality);
    const painted = stage;
    // Chaque personnage respire comme en combat (image animée, MAE-30) ; au repos avec le mouvement réduit, que
    // l'outil de netteté du labo exige pour la capture de ?verif=1
    let enemies = 0;
    const sprites = members.map((member) => createAnimatedSprite({
      url: member.image, rig: member.rig, height: member.height, facing: member.side === "hero" ? 1 : -1,
      phase: member.side === "enemy" ? enemyPhase(enemies++) : 0,
      onPose: () => { actors?.get(member.id)?.redrawn(); painted.requestRedraw(); },
    }));
    const [, images] = await Promise.all([
      stage.setDecor(decor), preloadImages(members.map((member) => member.image)), ...sprites.map((sprite) => sprite.ready),
    ]);
    const frames = new Map(members.map((member, i) => [member.id, { canvas: sprites[i].canvas, layout: sprites[i].layout }]));
    cast = actorDefs(decor, members, images, frames);
    actors = stage.setCast(cast, castExtent(decor, members, images));
  } catch (error) {
    console.error(error);
    page.appendChild(overlay(`La scène n'a pas pu s'afficher.\n${String(error)}`, { left: "12px", top: "12px" }));
    return;
  }

  let parallax = false;
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "p" || event.repeat) return;
    parallax = !parallax;
    stage.setParallax(parallax);
  });

  if (verify) {
    document.body.dataset.verif = JSON.stringify(stage.measure());
    // Accès du bot, en local seulement : aucun code du jeu ne s'en sert
    Object.assign(window, { scenePreview: { stage, decor, cast } });
    return;
  }
  const counter = overlay("Mesure en cours…", { left: "8px", top: "8px" });
  page.appendChild(counter);
  page.appendChild(overlay(chapter?.title ?? decorId, { right: "8px", top: "8px" }));
  startCounter(() => stage.measure(), counter);
}
