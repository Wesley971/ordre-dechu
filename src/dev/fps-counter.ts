// fps-counter.ts - Compteur d'images/s à l'écran, pour la scène peinte (MAE-28, MAE-29)
// Sur un téléphone, il n'y a pas de console pour lire les chiffres. Mode test seulement.

import type { StageMeasure } from "../scene/painted-stage.ts";

const MEASURE_SECONDS = 10;

export function overlay(text: string, position: Partial<CSSStyleDeclaration>) {
  const element = document.createElement("div");
  element.textContent = text;
  Object.assign(element.style, {
    position: "absolute", padding: "6px 10px", background: "rgba(21, 14, 7, 0.82)", color: "#e8d9b5",
    font: "13px/1.4 monospace", whiteSpace: "pre-line", pointerEvents: "none", zIndex: "50",
  }, position);
  return element;
}

// Renvoie la fonction d'arrêt
export function startCounter(measure: () => StageMeasure, element: HTMLElement) {
  const perSecond: number[] = [];
  let frames = 0;
  let running = true;
  let secondStart = performance.now();
  const tick = (now: number) => {
    if (!running) return;
    frames++;
    if (now - secondStart >= 1000) {
      perSecond.push((frames * 1000) / (now - secondStart));
      if (perSecond.length > MEASURE_SECONDS) perSecond.shift();
      frames = 0;
      secondStart = now;
      const info = measure();
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
  return () => { running = false; };
}
