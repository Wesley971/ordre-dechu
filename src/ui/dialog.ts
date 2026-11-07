// dialog.ts - Bande de dialogue, de hauteur fixe (MAE-87) : les pages s'empilent dans la bande, la nouvelle apparaît en
// bas avec un fondu, et l'on peut remonter pour relire la scène en cours. #dialog-text ne contient que la page en cours.
// L'effet lettre par lettre et le journal de toute l'histoire sont à MAE-51.

import type { PageObject } from "../data/game-data.ts";
import type { Question, Telling } from "../game-view.ts";
import { Input } from "../input/input.ts";
import { Sfx } from "../audio/sfx.ts";
import { pickOption } from "./pick-option.ts";
import { $, setLevelUps } from "./view.ts";
// Une page est une chaîne HTML, ou { html, sfx } pour jouer un son à l'ouverture de la page

const MASK_HEIGHT = 24;  // hauteur du dégradé du haut de la bande, voir #dialog-scroll dans style.css
const SCROLL_STEP = 40;  // pixels par appui sur une flèche
const TAP_TOLERANCE = 8; // au-delà, un glissé du doigt n'est plus un toucher

const scroller = () => $("#dialog-scroll");
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const atBottom = (el: HTMLElement) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2;

function scrollToEnd(smooth: boolean) {
  const el = scroller();
  el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reducedMotion() ? "smooth" : "auto" });
}

// La page en cours tient-elle dans la bande, sous le dégradé ?
function pageFits() {
  return $("#dialog-text").offsetHeight <= scroller().clientHeight - MASK_HEIGHT;
}

// Montre la page en cours : entière si elle tient, sinon à partir de son début
function revealPage() {
  if (pageFits()) return scrollToEnd(true);
  const el = scroller();
  const pageTop = $("#dialog-text").offsetTop - el.offsetTop;
  el.scrollTop = pageTop > 0 ? pageTop - MASK_HEIGHT : 0;
}

interface DialogWindow {
  onConfirm: (() => void) | null; // réaction à « Valider » : lire la suite de la page, ou passer à la suivante
  wire(): void;
  reset(): void;
  open(title: string): void;
  close(): void;
  show(telling: Telling, options?: { hold?: boolean }): Promise<void>;
  choose<T extends string>(question: Question<T>): Promise<T>;
  type(html: string): void;
  readRest(): Promise<void>;
  waitForNext(): Promise<void>;
}

export const Dialog: DialogWindow = {
  onConfirm: null,

  // Branche la bande, une fois : défilement au clavier, et un toucher ou un clic valent « Valider », pas un glissé
  wire() {
    const scroll = scroller();
    scroll.addEventListener("scroll", () => scroll.classList.toggle("scrolled", scroll.scrollTop > 0));
    document.addEventListener("keydown", event => {
      if ($("#dialog").hidden || (event.key !== "PageUp" && event.key !== "PageDown")) return;
      event.preventDefault();
      scroll.scrollBy({ top: (event.key === "PageUp" ? -1 : 1) * scroll.clientHeight * 0.8 });
    });

    let start: { y: number; top: number } | null = null;
    const dialog = $("#dialog");
    dialog.addEventListener("pointerdown", event => { start = { y: event.clientY, top: scroll.scrollTop }; });
    dialog.addEventListener("click", event => {
      const moved = start !== null && (Math.abs(event.clientY - start.y) > TAP_TOLERANCE || Math.abs(scroll.scrollTop - start.top) > TAP_TOLERANCE);
      start = null;
      if (moved || !$("#dialog-choices").hidden || document.body.classList.contains("defeat-choice")) return;
      Input.emit("confirm");
    });
  },

  // Une nouvelle scène : la bande ne garde plus la précédente
  reset() {
    $("#dialog-history").replaceChildren();
    $("#dialog-text").innerHTML = "";
    scroller().scrollTop = 0;
  },

  open(title) {
    $("#dialog-title").innerHTML = title;
    $("#dialog-title").hidden = !title;
    $("#dialog").hidden = false;
    Input.push(action => {
      if (action === "confirm" && this.onConfirm) this.onConfirm();
      else if (action === "up" || action === "down") scroller().scrollBy({ top: action === "up" ? -SCROLL_STEP : SCROLL_STEP });
    });
  },

  close() {
    Input.pop();
    this.onConfirm = null;
    $("#dialog").hidden = true;
  },

  // hold : le texte reste à l'écran une fois validé (défaite : les choix s'affichent dessous, planche G7)
  async show({ title = "", pages }, { hold = false } = {}) {
    this.open(title);
    for (const page of pages) {
      const { html, sfx, levelUps = [] }: PageObject = typeof page === "string" ? { html: page } : page;
      if (sfx) Sfx.play(sfx);
      setLevelUps(levelUps);
      this.type(html);
      await this.readRest();
      await this.waitForNext();
    }
    setLevelUps([]);
    this.close();
    $("#dialog").hidden = !hold;
  },

  // Pose une question ; options : [{ id, label }] · renvoie l'id de l'option choisie
  async choose({ title = "", text, options }) {
    this.open(title);
    this.type(text);

    const list = $("#dialog-choices");
    const items = options.map(option => {
      const item = document.createElement("li");
      item.className = "menu-item";
      item.textContent = option.label;
      return item;
    });
    list.replaceChildren(...items);
    list.hidden = false; // sous le texte, hors de la partie qui défile : la bande garde sa hauteur
    revealPage();
    const index = await pickOption(items, { preselect: false }); // Valider seul ne peut pas choisir par accident
    list.hidden = true;

    this.close();
    return options[index].id;
  },

  // La page précédente rejoint l'historique, la nouvelle apparaît avec un fondu. Le fondu n'est qu'un effet visuel :
  // la page est là tout de suite, sans minuterie, pour qu'un appui ne puisse pas tomber entre deux états et sauter une page
  type(html) {
    const text = $("#dialog-text");
    if (text.innerHTML) {
      const past = document.createElement("div");
      past.className = "dialog-past";
      past.innerHTML = text.innerHTML;
      $("#dialog-history").appendChild(past);
    }
    text.innerHTML = html;
    text.classList.remove("appearing");
    void text.offsetWidth; // force le navigateur à rejouer le fondu
    text.classList.add("appearing");
    $("#dialog-next").hidden = true;
    $("#dialog-more").hidden = true;
    revealPage();
  },

  // Une page plus haute que la bande se lit par étapes : « Valider » la fait défiler, sans changer de page,
  // et défiler soi-même jusqu'au bas compte aussi
  readRest() {
    const el = scroller();
    if (pageFits() || atBottom(el)) return Promise.resolve();
    const more = $("#dialog-more");
    more.hidden = false;
    return new Promise(resolve => {
      const done = () => {
        el.removeEventListener("scroll", check);
        more.hidden = true;
        this.onConfirm = null;
        resolve();
      };
      const check = () => { if (atBottom(el)) done(); };
      el.addEventListener("scroll", check);
      this.onConfirm = () => {
        el.scrollTop += el.clientHeight - MASK_HEIGHT;
        check();
      };
    });
  },

  // Affiche ▼ et attend « Valider » pour passer à la suite. Défiler ne fait jamais avancer ; avancer ramène en bas
  waitForNext() {
    const next = $("#dialog-next");
    next.hidden = false;
    return new Promise(resolve => {
      this.onConfirm = () => {
        Sfx.play("cursor");
        next.hidden = true;
        this.onConfirm = null;
        resolve();
      };
    });
  },
};
