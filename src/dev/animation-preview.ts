// animation-preview.ts - Aperçu des animations des combattants, en mode test (?animations=1, MAE-30)
//
// Chaque personnage joue chacune de ses animations en boucle, dans sa case : un pixel de sprite fait un nombre entier
// de pixels réels (?zoom=1 à 4 ; 2 par défaut sur ordinateur, 1 sur téléphone ; ?zoom=3 : l'échelle d'un grand écran). Les couleurs
// (teinte du coup reçu, éclair, mort) imitent celles des scènes. Les héros tombent, sont à genoux ou au sol dans
// leurs poses dessinées (MAE-94), comme dans les scènes.
// Les effets spéciaux (MAE-95) ont leur case : la Nuée de cendre du Dragon vise un héros posé dans la même case, et
// l'écho de Maelor se défait en lumière, et l'or quitte Maelor vers le Dragon posé dans sa case (ou, sans Dragon, son
// éclat doré seul).
// Une case « Mouvement réduit » simule le réglage du système (MAE-58), effets spéciaux compris. ?vitesse=X accélère les animations, comme en jeu
// (pas les pauses entre deux tours de boucle). Le pas en avant d'un héros qui agit est fait par la scène : pas ici.

import { CONFIG } from "../config.ts";
import { ENEMIES, HEROES, type EnemyDef, type SpriteRig } from "../data/game-data.ts";
import { createAnimatedSprite, isReducedMotion, overrideReducedMotion, type AnimatedSprite } from "../ui/animated-sprite.ts";
import { createFxLayer } from "../ui/fx-layer.ts";
import { HERO_CANVAS, playAshCloud, playGoldStream, playLightRise } from "../ui/stage.ts";

interface Character { name: string; url: string; rig: SpriteRig; height: number; facing: 1 | -1; boss: boolean; mouth?: { x: number; y: number }; vanish?: "light"; gold?: boolean }

// Un scénario joue une animation, puis attend, en boucle ; color : filtre CSS à poser pendant ms millisecondes ;
// ash : lance la Nuée de cendre vers le héros de la case (seulement dans la case qui en a un) ; light : les pixels
// dorés de l'écho qui se défait ; gold : l'or qui quitte Maelor (seulement dans les cases qui ont leurs effets)
interface Cell { sprite: AnimatedSprite; color(filter: string, ms: number): void; ash(): void; light(): void; gold(): void }
type Scenario = (cell: Cell) => Promise<void>;

const MARGIN = 8; // marge de la case autour de la toile, en pixels de sprite (pas en avant, bond, saut)
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const PAUSE = 1200;

// Couleurs des scènes (style.css) : coup reçu, éclair de l'ennemi qui agit, mort
const HIT_TINT = "brightness(1.8) sepia(0.6) hue-rotate(-30deg)";
const FLASH = "brightness(2.6)";
const DEATH_TINT = "sepia(1) saturate(6) hue-rotate(250deg) brightness(0.9)";
const GLOW = "drop-shadow(0 0 4px #f0c95a)";

const HERO_SCENARIOS: [string, Scenario][] = [
  ["Attente", () => wait(PAUSE)],
  ["Attaque", async ({ sprite }) => {
    sprite.play("attack");
    sprite.setBase("acting");
    await wait(CONFIG.timing.step + CONFIG.timing.effect);
    sprite.setBase("idle");
    await wait(PAUSE);
  }],
  ["Sort", async ({ sprite, color }) => {
    sprite.play("cast");
    color(GLOW, CONFIG.timing.cast);
    await wait(CONFIG.timing.cast + PAUSE);
  }],
  ["Dégâts", async ({ sprite, color }) => {
    sprite.play("hit");
    color(HIT_TINT, CONFIG.timing.hit);
    await wait(CONFIG.timing.hit + PAUSE);
  }],
  ["En danger", async ({ sprite, color }) => {
    sprite.setBase("critical");
    await wait(PAUSE);
    sprite.play("hit");
    color(HIT_TINT, CONFIG.timing.hit);
    await wait(CONFIG.timing.hit + PAUSE);
  }],
  ["K.O. et réanimation", async ({ sprite }) => {
    sprite.play("fall");
    sprite.setBase("ko");
    await wait(CONFIG.timing.fall + 2 * PAUSE);
    sprite.play("revive");
    sprite.setBase("idle");
    await wait(CONFIG.timing.fall + PAUSE);
  }],
  ["K.O. en danger", async ({ sprite }) => {
    sprite.setBase("critical");
    await wait(PAUSE);
    sprite.play("fall");
    sprite.setBase("ko");
    await wait(CONFIG.timing.fall + 2 * PAUSE);
    sprite.play("revive");
    sprite.setBase("idle");
    await wait(CONFIG.timing.fall + PAUSE);
  }],
  ["Victoire", async ({ sprite }) => {
    sprite.play("victory");
    await wait(CONFIG.timing.victoryHop * 4 + PAUSE);
  }],
];

const ENEMY_SCENARIOS: [string, Scenario][] = [
  ["Attente", () => wait(PAUSE)],
  ["Attaque", async ({ sprite, color }) => {
    sprite.play("strike");
    color(FLASH, CONFIG.timing.blink / 4); // l'éclair court : « il agit » (décision du 08/11/2026)
    await wait(CONFIG.timing.blink + PAUSE);
  }],
  ["Sort", async ({ sprite, color }) => {
    sprite.play("cast");
    color(GLOW, CONFIG.timing.cast);
    await wait(CONFIG.timing.cast + PAUSE);
  }],
  ["Dégâts", async ({ sprite, color }) => {
    sprite.play("hit");
    color(HIT_TINT, CONFIG.timing.hit);
    await wait(CONFIG.timing.hit + PAUSE);
  }],
  ["Mort", async ({ sprite, color }) => {
    sprite.play("dissolve");
    sprite.setBase("gone");
    color(DEATH_TINT, CONFIG.timing.death);
    await wait(CONFIG.timing.death + PAUSE);
    sprite.setBase("idle");
    await wait(PAUSE);
  }],
];

// Nuée de cendre (MAE-95) : l'éclair et le bond, puis le sort ; le nuage part au début du sort, comme en combat
const ASH_SCENARIO: [string, Scenario] = ["Nuée de cendre", async ({ sprite, color, ash }) => {
  sprite.play("strike");
  color(FLASH, CONFIG.timing.blink / 4);
  await wait(CONFIG.timing.blink);
  ash();
  sprite.play("cast");
  color(GLOW, CONFIG.timing.cast);
  await wait(CONFIG.timing.ashCloud + PAUSE);
}];
// L'écho se défait en lumière (MAE-95) : en or, ses rangées s'effacent en lâchant des pixels dorés ; avec le mouvement
// réduit, en or, puis il disparaît d'un coup (comme en combat, stage.ts)
const GOLD = "brightness(1.45) sepia(1) saturate(2.2) hue-rotate(-8deg)"; // CSS echo-unravel
const LIGHT_SCENARIO: [string, Scenario] = ["Se défait en lumière", async ({ sprite, color, light }) => {
  color(GOLD, CONFIG.timing.unravel);
  if (!isReducedMotion()) {
    sprite.play("unravel");
    sprite.setBase("gone");
    light();
  }
  await wait(CONFIG.timing.unravel);
  sprite.setBase("gone");
  await wait(PAUSE);
  sprite.setBase("idle");
  await wait(PAUSE);
}];
// L'or quitte Maelor (MAE-95) : vers le Dragon posé à sa droite ; sans Dragon à l'écran, ou avec le mouvement réduit,
// l'éclat doré seul, sur place (comme en combat, stage.ts, playGoldStream)
const GOLD_SCENARIO = (label: string): [string, Scenario] => [label, async ({ color, gold }) => {
  gold();
  color(GOLD, CONFIG.timing.gild);
  await wait(CONFIG.timing.powerReturn + PAUSE);
}];
const GOLD_TO_DRAGON = GOLD_SCENARIO("L'or le quitte");
const GOLD_ALONE = GOLD_SCENARIO("L'or le quitte, sans Dragon");
// Écart entre le personnage et ce qu'il vise dans la case, en pixels de sprite
const TARGET_GAP = 23;

const SPARE_SCENARIO: [string, Scenario] = ["Vaincu, puis épargné", async ({ sprite, color }) => {
  sprite.play("slump");
  sprite.setBase("defeated");
  color("grayscale(0.5) brightness(0.55)", CONFIG.timing.defeatedPose + 2 * PAUSE);
  await wait(CONFIG.timing.defeatedPose + 2 * PAUSE);
  sprite.play("rise");
  sprite.setBase("idle");
  color(GLOW, CONFIG.timing.cast);
  await wait(CONFIG.timing.defeatedPose + PAUSE);
}];

function characters(): Character[] {
  return [
    ...HEROES.map((hero) => ({ name: hero.name, url: hero.image, rig: hero.rig, height: HERO_CANVAS.h, facing: 1 as const, boss: false, gold: hero.id === "maelor" })), // as const : le sens du regard, de type 1 | -1
    ...Object.values<EnemyDef>(ENEMIES).map((enemy) => ({
      name: enemy.name, url: enemy.image, rig: enemy.rig, height: enemy.canvasHeight, facing: -1 as const, boss: enemy.spareable === true, // as const : idem
      mouth: enemy.mouth, vanish: enemy.vanish,
    })),
  ];
}

// Pixels CSS par pixel de sprite : un nombre entier de pixels réels
function cssPixel() {
  const ratio = window.devicePixelRatio || 1;
  const raw = Number(new URLSearchParams(location.search).get("zoom"));
  const zoom = Number.isInteger(raw) && raw >= 1 && raw <= 4 ? raw : window.innerWidth > 640 ? 2 : 1;
  return Math.max(1, Math.round(zoom * ratio)) / ratio;
}

// Ce que vise un effet dans la case, fixe : un héros à gauche du Dragon (Nuée de cendre), le Dragon à droite de Maelor (or)
interface Target { url: string; width: number; height: number; side: "left" | "right" }

// target : la case le montre aussi ; effects : la case a une couche d'effets
function buildCell(character: Character, label: string, scenario: Scenario, px: number, target?: Target, effects = !!target) {
  const figure = document.createElement("figure");
  figure.className = "anim-cell";
  const box = document.createElement("div");
  box.className = "anim-box";
  const caption = document.createElement("figcaption");
  caption.textContent = label;
  figure.append(box, caption);

  // Filtre du canvas : la teinte passagère du scénario
  let tint = "";
  const paint = () => { sprite.canvas.style.filter = tint; };
  const sprite = createAnimatedSprite({
    url: character.url, rig: character.rig, height: character.height, facing: character.facing,
    onPose(pose) {
      sprite.canvas.style.translate = `${pose.dx * character.facing * px}px ${-pose.dy * px}px`;
    },
  });
  box.appendChild(sprite.canvas);
  const space = target ? target.width + TARGET_GAP : 0;
  const before = target?.side === "left" ? space : 0; // place à gauche du personnage
  // Ce que vise l'effet, fixe, et le rectangle exact du PNG du personnage : les effets partent de lui (stage.ts)
  const aimed = document.createElement("img");
  const png = document.createElement("div");
  png.className = "anim-png";
  if (target) {
    aimed.src = target.url;
    aimed.className = "anim-target";
    Object.assign(aimed.style, { width: `${target.width * px}px`, height: `${target.height * px}px` });
    box.append(aimed);
  }
  if (effects) box.append(png);
  const fx = effects ? createFxLayer(box, () => px) : null; // seulement dans les cases des effets spéciaux
  const ash = () => { if (fx && target && character.mouth) playAshCloud(fx, png, character.mouth, [aimed]); };
  const light = () => { if (fx) playLightRise(fx, png, sprite); };
  const gold = () => { if (fx) playGoldStream(fx, png, target ? aimed : null); };
  let colorTimer = 0;
  const color = (filter: string, ms: number) => {
    tint = filter;
    paint();
    clearTimeout(colorTimer);
    colorTimer = window.setTimeout(() => { tint = ""; paint(); }, ms);
  };

  void sprite.ready.then(async () => {
    const { layout } = sprite;
    const height = Math.max(layout.height, (target?.height ?? 0) + MARGIN);
    Object.assign(box.style, { width: `${(layout.width + 2 * MARGIN + space) * px}px`, height: `${(height + MARGIN) * px}px` });
    Object.assign(sprite.canvas.style, {
      width: `${layout.width * px}px`, height: `${layout.height * px}px`, left: `${(MARGIN + before) * px}px`, top: `${(MARGIN + height - layout.height) * px}px`,
    });
    // Le PNG au repos dans la toile : (originX, originY), le bas sur la dernière rangée ; ce qui est visé a les pieds au même niveau
    Object.assign(png.style, {
      left: `${(MARGIN + before + layout.originX) * px}px`, top: `${(MARGIN + height - layout.height + layout.originY) * px}px`,
      width: `${(layout.width - 2 * layout.originX) * px}px`, height: `${(layout.height - layout.originY) * px}px`,
    });
    if (target) {
      const left = target.side === "left" ? MARGIN : MARGIN + layout.width + TARGET_GAP;
      Object.assign(aimed.style, { left: `${left * px}px`, top: `${(MARGIN + height - target.height) * px}px` });
    }
    for (;;) await scenario({ sprite, color, ash, light, gold });
  }).catch((error: unknown) => { caption.textContent = `${label} : ${String(error)}`; });
  return { figure, sprite };
}

const STYLE = `
  #animation-preview { position: fixed; inset: 0; z-index: 1000; overflow: auto; background: #0d1117; color: #d8d2c4;
    font: 14px/1.4 system-ui, sans-serif; padding: 16px; }
  #animation-preview h1 { font-size: 18px; margin: 0 0 4px; }
  #animation-preview h2 { font-size: 15px; margin: 20px 0 6px; }
  #animation-preview p { margin: 0 0 8px; max-width: 70ch; color: #a9a294; }
  #animation-preview .anim-row { display: flex; flex-wrap: wrap; gap: 8px; }
  #animation-preview .anim-cell { margin: 0; }
  #animation-preview .anim-box { position: relative; background: #1b232c; border-bottom: 2px solid #3a4652; overflow: hidden; }
  #animation-preview .sprite-canvas, #animation-preview .anim-target { position: absolute; image-rendering: pixelated; }
  #animation-preview .anim-target { opacity: 0.6; }
  #animation-preview .anim-png { position: absolute; pointer-events: none; }
  #animation-preview figcaption { font-size: 12px; color: #a9a294; padding-top: 2px; }
`;

export function openAnimationPreview() {
  const style = document.createElement("style");
  style.textContent = STYLE;
  const page = document.createElement("div");
  page.id = "animation-preview";
  page.innerHTML = `<h1>Animations des combattants (MAE-30)</h1>
    <p>Chaque case joue une animation en boucle. ?zoom=1 à 4 change la taille (3 : celle d'un grand écran), ?vitesse=X la vitesse des animations.
    Le pas en avant du héros qui attaque est fait par la scène du combat : il n'apparaît pas ici.
    Les couleurs imitent celles du combat. Les mêmes images servent aux deux scènes, DOM et peinte.</p>
    <label><input type="checkbox" id="anim-reduced"> Mouvement réduit (simulé)</label>`;
  document.head.appendChild(style);
  document.body.appendChild(page);
  page.querySelector<HTMLInputElement>("#anim-reduced")?.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement) overrideReducedMotion(event.target.checked ? true : null);
  });

  const px = cssPixel();
  const sprites: AnimatedSprite[] = [];
  for (const character of characters()) {
    const title = document.createElement("h2");
    title.textContent = character.name;
    const row = document.createElement("div");
    row.className = "anim-row";
    const scenarios = character.facing > 0 ? [...HERO_SCENARIOS, ...(character.gold ? [GOLD_TO_DRAGON, GOLD_ALONE] : [])]
      : [...ENEMY_SCENARIOS, ...(character.mouth ? [ASH_SCENARIO] : []), ...(character.vanish ? [LIGHT_SCENARIO] : []), ...(character.boss ? [SPARE_SCENARIO] : [])];
    for (const [label, scenario] of scenarios) {
      const dragon = Object.values<EnemyDef>(ENEMIES).find((enemy) => enemy.mouth);
      const target: Target | undefined =
        scenario === ASH_SCENARIO[1] ? { url: HEROES[0].image, width: HERO_CANVAS.w, height: HERO_CANVAS.h, side: "left" }
        : scenario === GOLD_TO_DRAGON[1] && dragon ? { url: dragon.image, width: dragon.canvasWidth, height: dragon.canvasHeight, side: "right" }
        : undefined;
      const effects = !!target || scenario === LIGHT_SCENARIO[1] || scenario === GOLD_ALONE[1];
      const cell = buildCell(character, label, scenario, px, target, effects);
      row.appendChild(cell.figure);
      sprites.push(cell.sprite);
    }
    page.append(title, row);
  }
  // Chaque case commence sur un pixel réel : sinon le pixel art afficherait des rangées irrégulières (comme stage.ts)
  const snap = () => {
    const ratio = window.devicePixelRatio || 1;
    for (const box of page.querySelectorAll<HTMLElement>(".anim-box")) {
      box.style.translate = "";
      const { left, top } = box.getBoundingClientRect();
      box.style.translate = `${Math.round(left * ratio) / ratio - left}px ${Math.round(top * ratio) / ratio - top}px`;
    }
  };
  window.addEventListener("resize", snap);
  let pending = false;
  page.addEventListener("scroll", () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; snap(); });
  });
  // Une fois toutes les cases à leur taille (images chargées), puis à chaque changement
  void Promise.allSettled(sprites.map((sprite) => sprite.ready)).then(() => requestAnimationFrame(snap));
}
