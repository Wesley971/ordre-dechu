// input.ts - Clavier et manette traduits en actions : up, down, left, right, confirm, cancel,
// et les touches 1 à 9 du clavier (pick-1 à pick-9 : choisir une entrée du menu de combat, MAE-89)
// Chaque écran empile son gestionnaire ; seul celui du dessus reçoit les actions.

export type Pick = "pick-1" | "pick-2" | "pick-3" | "pick-4" | "pick-5" | "pick-6" | "pick-7" | "pick-8" | "pick-9";
export type Action = "up" | "down" | "left" | "right" | "confirm" | "cancel" | Pick;

// Rang (à partir de 0) de l'entrée choisie par une touche 1 à 9, ou null pour une autre action
export function pickIndex(action: Action): number | null {
  return action.startsWith("pick-") ? Number(action.slice("pick-".length)) - 1 : null;
}

const DIRECTIONS: readonly Action[] = ["up", "down", "left", "right"];
type Handler = (action: Action) => void;

interface InputStack {
  handlers: Handler[];
  push(handler: Handler): void;
  pop(): void;
  emit(action: Action): void;
}

export const Input: InputStack = {
  handlers: [],
  push(handler) { this.handlers.push(handler); },
  pop() { this.handlers.pop(); },
  emit(action) {
    const handler = this.handlers[this.handlers.length - 1];
    if (handler) handler(action);
  },
};

const KEYS: Record<string, Action> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  Enter: "confirm", " ": "confirm", z: "confirm", Z: "confirm",
  Escape: "cancel", Backspace: "cancel", x: "cancel", X: "cancel",
  1: "pick-1", 2: "pick-2", 3: "pick-3", 4: "pick-4", 5: "pick-5", 6: "pick-6", 7: "pick-7", 8: "pick-8", 9: "pick-9",
};

document.addEventListener("keydown", event => {
  const action = KEYS[event.key];
  if (!action) return;
  if (pickIndex(action) !== null && (event.ctrlKey || event.metaKey || event.altKey)) return; // Ctrl+1 : un onglet du navigateur
  event.preventDefault();
  const isDirection = DIRECTIONS.includes(action);
  if (event.repeat && !isDirection) return; // seules les flèches se répètent quand on reste appuyé
  Input.emit(action);
});

// — Manette (API Gamepad, disposition standard : Xbox 360, etc.) —

const PAD_BUTTONS: Record<number, Action> = { 12: "up", 13: "down", 14: "left", 15: "right", 0: "confirm", 1: "cancel" };
const PAD_REPEAT = { delay: 350, interval: 110 };
const padState: Record<string, number | null> = {}; // action → instant de la prochaine répétition (ou null si relâché)

function readPad(pad: Gamepad) {
  const pressed = new Set<Action>();
  for (const [index, action] of Object.entries(PAD_BUTTONS)) {
    if (pad.buttons[Number(index)] && pad.buttons[Number(index)].pressed) pressed.add(action);
  }
  const [x = 0, y = 0] = pad.axes;
  if (y < -0.5) pressed.add("up");
  if (y > 0.5)  pressed.add("down");
  if (x < -0.5) pressed.add("left");
  if (x > 0.5)  pressed.add("right");
  return pressed;
}

function pollGamepads(now: number) {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(pad => pad !== null) : [];
  const pressed = new Set(pads.flatMap(pad => [...readPad(pad)]));

  for (const action of ["up", "down", "left", "right", "confirm", "cancel"] satisfies Action[]) {
    if (!pressed.has(action)) {
      padState[action] = null;
      continue;
    }
    const isDirection = action !== "confirm" && action !== "cancel";
    if (padState[action] == null) {
      Input.emit(action);
      padState[action] = isDirection ? now + PAD_REPEAT.delay : Infinity;
    } else if (now >= padState[action]) {
      Input.emit(action);
      padState[action] = now + PAD_REPEAT.interval;
    }
  }
  requestAnimationFrame(pollGamepads);
}

requestAnimationFrame(pollGamepads);
