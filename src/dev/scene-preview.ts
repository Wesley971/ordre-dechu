// scene-preview.ts - Page de contrôle de la scène peinte, en mode test (?scene=lisiere, MAE-28)
// Chargée à la demande depuis main.ts : c'est elle, et elle seule, qui fait charger Three.js.
// Touche P : la caméra oscille et révèle le relief. ?verif=1 : sans compteur, mesures pour le bot (data-verif, window.scenePreview).

import { CHAPTERS } from "../data/game-data.ts";
import { DECORS, type Decor, type DecorId } from "../data/decors.ts";
import type { ActorDef } from "../scene/actors.ts";
import { createPaintedStage, type PaintedStage, type SceneQuality } from "../scene/painted-stage.ts";

const GOLD_LIGHT = "#f0c95a";  // lumière d'Elwen, palette des personnages
const CORVIN_FLAME = "#8fb8e0"; // lanterne de Corvin, palette des personnages
const MEASURE_SECONDS = 10;

// Les personnages du combat du chapitre, en attendant le branchement du combat (MAE-29)
function castOf(decor: Decor): ActorDef[] {
  const { heroes, enemies } = decor.places;
  return [
    { id: "elwen", src: "images/elwen.png", place: heroes[0], breath: { cut: 0.5, period: 3.4, phase: 0.55 }, halo: { color: GOLD_LIGHT, at: [0.82, 0.5], size: 1.6 } },
    { id: "corvin", src: "images/corvin.png", place: heroes[1], breath: { cut: 0.45, period: 3.1, phase: 0.2 }, halo: { color: CORVIN_FLAME, at: [0.83, 0.4], size: 1.1 } },
    { id: "maelor", src: "images/maelor.png", place: heroes[2], breath: { cut: 0.45, period: 2.8, phase: 0 } },
    { id: "sankri-1", src: "images/sankri.png", place: enemies[0], breath: { cut: 0.45, period: 3.8, phase: 0.35 } },
    { id: "sankri-2", src: "images/sankri.png", place: enemies[1], breath: { cut: 0.45, period: 4.1, phase: 0.8 } },
  ];
}

function overlay(text: string, position: Partial<CSSStyleDeclaration>) {
  const element = document.createElement("div");
  element.textContent = text;
  Object.assign(element.style, {
    position: "absolute", padding: "6px 10px", background: "rgba(21, 14, 7, 0.82)", color: "#e8d9b5",
    font: "13px/1.4 monospace", whiteSpace: "pre-line", pointerEvents: "none",
  }, position);
  return element;
}

// Compteur à l'écran : sur un téléphone, il n'y a pas de console pour lire les chiffres
function startCounter(stage: PaintedStage, element: HTMLElement) {
  const perSecond: number[] = [];
  let frames = 0;
  let secondStart = performance.now();
  const tick = (now: number) => {
    frames++;
    if (now - secondStart >= 1000) {
      perSecond.push((frames * 1000) / (now - secondStart));
      if (perSecond.length > MEASURE_SECONDS) perSecond.shift();
      frames = 0;
      secondStart = now;
      const info = stage.measure();
      const decorSize = info.decorScale < 1 ? `peinture à ${Math.round(info.decorScale * 100)} %` : "peinture pleine résolution";
      const qualityLine = `Qualité ${info.quality} : ${info.samples > 0 ? "anticrénelage" : "sans anticrénelage"}, ${decorSize}`;
      const size = `${info.deviceWidth}×${info.deviceHeight}, densité ${info.ratio}, pixel de sprite ${info.spritePixel}\n${qualityLine}`;
      if (info.reducedMotion) {
        element.textContent = `Mouvement réduit : image fixe, mesure sans objet\n${size}`;
      } else {
        const average = Math.round(perSecond.reduce((sum, value) => sum + value, 0) / perSecond.length);
        const lowest = Math.round(Math.min(...perSecond));
        const state = perSecond.length < MEASURE_SECONDS ? `mesure en cours (${perSecond.length}/${MEASURE_SECONDS} s)` : `sur ${MEASURE_SECONDS} s`;
        element.textContent = `${average} images/s, minimum ${lowest}, ${state}\n${size}`;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export async function openScenePreview(decorId: DecorId, quality?: SceneQuality) {
  const verify = new URLSearchParams(location.search).has("verif");
  const page = document.createElement("div");
  Object.assign(page.style, { position: "fixed", inset: "0", zIndex: "1000", background: "#000", overflow: "hidden" });
  document.body.appendChild(page);

  const decor = DECORS[decorId];
  const chapter = CHAPTERS.find((candidate) => candidate.decor === decorId);
  let stage: PaintedStage;
  try {
    stage = createPaintedStage(page, quality);
    await stage.setDecor(decor, castOf(decor));
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
    Object.assign(window, { scenePreview: { stage, decor, cast: castOf(decor) } });
    return;
  }
  const counter = overlay("Mesure en cours…", { left: "8px", top: "8px" });
  page.appendChild(counter);
  page.appendChild(overlay(chapter?.title ?? decorId, { right: "8px", top: "8px" }));
  startCounter(stage, counter);
}
