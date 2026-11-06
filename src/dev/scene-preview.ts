// scene-preview.ts - Page de contrôle de la scène peinte, en mode test (?scene=lisiere, MAE-28)
// Chargée à la demande depuis main.ts : c'est elle, et elle seule, qui fait charger Three.js.
// Touche P : la caméra oscille et révèle le relief. ?verif=1 : sans compteur, mesures pour le bot (data-verif, window.scenePreview).

import { CHAPTERS, ENEMIES, HEROES } from "../data/game-data.ts";
import { DECORS, type Decor, type DecorId } from "../data/decors.ts";
import { preloadImages } from "../scene/actors.ts";
import { actorDefs, castExtent, type CastMember } from "../scene/cast.ts";
import { createPaintedStage, type PaintedStage, type SceneQuality } from "../scene/painted-stage.ts";
import { overlay, startCounter } from "./fps-counter.ts";

// Les personnages du combat du chapitre, comme la scène de combat les posera (MAE-29)
function castOf(decor: Decor): CastMember[] {
  const chapter = CHAPTERS.find((candidate) => candidate.decor === decor.id);
  const enemies = chapter && !chapter.rest ? chapter.enemies : [];
  return [
    ...HEROES.map((hero) => ({ id: hero.id, image: hero.image, side: "hero" as const })),
    ...enemies.map((key, i) => ({ id: `${key}-${i}`, image: ENEMIES[key].image, side: "enemy" as const })),
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
  try {
    stage = createPaintedStage(page, quality);
    const [, images] = await Promise.all([stage.setDecor(decor), preloadImages(members.map((member) => member.image))]);
    cast = actorDefs(decor, members, images);
    stage.setCast(cast, castExtent(decor, members, images));
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
