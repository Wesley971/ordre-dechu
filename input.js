// input.js - Clavier et manette traduits en actions : up, down, left, right, confirm, cancel
// Chaque écran empile son gestionnaire ; seul celui du dessus reçoit les actions.

const Input = {
  handlers: [],
  push(handler) { this.handlers.push(handler); },
  pop() { this.handlers.pop(); },
  emit(action) {
    const handler = this.handlers[this.handlers.length - 1];
    if (handler) handler(action);
  },
};

const KEYS = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  Enter: "confirm", " ": "confirm", z: "confirm", Z: "confirm",
  Escape: "cancel", Backspace: "cancel", x: "cancel", X: "cancel",
};

document.addEventListener("keydown", event => {
  const action = KEYS[event.key];
  if (!action) return;
  event.preventDefault();
  const isDirection = !["confirm", "cancel"].includes(action);
  if (event.repeat && !isDirection) return; // seules les flèches se répètent quand on reste appuyé
  Input.emit(action);
});

// — Manette (API Gamepad, disposition standard : Xbox 360, etc.) —

const PAD_BUTTONS = { 12: "up", 13: "down", 14: "left", 15: "right", 0: "confirm", 1: "cancel" };
const PAD_REPEAT = { delay: 350, interval: 110 };
const padState = {}; // action → instant de la prochaine répétition (ou null si relâché)

function readPad(pad) {
  const pressed = new Set();
  for (const [index, action] of Object.entries(PAD_BUTTONS)) {
    if (pad.buttons[index] && pad.buttons[index].pressed) pressed.add(action);
  }
  const [x = 0, y = 0] = pad.axes;
  if (y < -0.5) pressed.add("up");
  if (y > 0.5)  pressed.add("down");
  if (x < -0.5) pressed.add("left");
  if (x > 0.5)  pressed.add("right");
  return pressed;
}

function pollGamepads(now) {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const pressed = new Set(pads.flatMap(pad => [...readPad(pad)]));

  for (const action of ["up", "down", "left", "right", "confirm", "cancel"]) {
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
