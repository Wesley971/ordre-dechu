// animation-preview.ts - Aperçu des animations des combattants, en mode test (?animations=1, MAE-30)
//
// Chaque personnage joue chacune de ses animations en boucle, dans sa case : un pixel de sprite fait un nombre entier
// de pixels réels (?zoom=1 à 4 ; 2 par défaut sur ordinateur, 1 sur téléphone ; ?zoom=3 : l'échelle d'un grand écran). Les teintes du
// coup reçu, de la mort et de l'or sont celles des scènes (tints.ts) ; l'éclair et la lueur du Souffle les imitent. Les héros tombent, sont à genoux ou au sol dans
// leurs poses dessinées (MAE-94), comme dans les scènes.
// Les effets spéciaux (MAE-95) ont leur case : la Nuée de cendre du Dragon vise un héros posé dans la même case, et
// l'écho de Maelor se défait en lumière, et l'or quitte Maelor vers le Dragon posé dans sa case (ou, sans Dragon, son
// éclat doré seul).
// Les effets des capacités (MAE-31) ont leur section : chaque capacité qui a son effet en pixels le joue en boucle sur
// ce qu'elle vise (un ennemi, deux, un héros ou le groupe, en images fixes). Les capacités des ennemis (MAE-98) visent un
// héros, ou les trois pour une capacité sur tout le groupe.
// Le sang doré (MAE-98) a sa section : le coup reçu de Maelor et d'Elwen avec leurs éclats, réglés par des curseurs
// (nombre, taille, durée, luminosité). La teinte du coup reçu y est montrée sous ses deux formes : le filtre CSS de la
// scène DOM, et la couleur de la scène peinte, imitée sur une copie de la toile (painted).
// Une case « Mouvement réduit » simule le réglage du système (MAE-58), effets spéciaux et effets des capacités compris. ?vitesse=X accélère les animations, comme en jeu
// (pas les pauses entre deux tours de boucle). Le pas en avant d'un héros qui agit est fait par la scène : pas ici.

import { CONFIG } from "../config.ts";
import { ATTACK, ENEMIES, ENEMY_SKILLS, HEROES, ITEMS, SPELLS, type Ability, type AbilityEffect, type EnemyDef, type GoldBlood, type SpriteRig } from "../data/game-data.ts";
import { createAnimatedSprite, type AnimatedSprite } from "../ui/animated-sprite.ts";
import { isReducedMotion, overrideReducedMotion } from "../ui/reduced-motion.ts";
import { opaqueRuns, type OpaqueRuns } from "../ui/sprite-frames.ts";
import { BLOOD_LIMITS, BOLT_HEIGHT } from "../ui/battle-fx.ts";
import { createFxLayer } from "../ui/fx-layer.ts";
import { embersHtml, HERO_CANVAS, playAbilityFx, playAshCloud, playGoldBlood, playGoldStream, playLightRise } from "../ui/stage.ts";
import { paintedTint, TINTS, type Tint } from "../ui/tints.ts";

// blood : le héros dont la case joue le sang doré, et son réglage, modifié en direct par les curseurs ; embers :
// l'identifiant du héros dont la case montre les braises (Elwen)
interface Character { name: string; url: string; rig: SpriteRig; height: number; facing: 1 | -1; boss: boolean; mouth?: { x: number; y: number }; vanish?: "light"; gold?: boolean; blood?: { id: string; setting: GoldBlood }; embers?: string }

// Un scénario joue une animation, puis attend, en boucle ; color : filtre CSS à poser pendant ms millisecondes ;
// paintIn : la même chose sous la forme de la scène peinte d'une teinte ; ash : lance la Nuée de cendre vers le héros
// de la case (seulement dans la case qui en a un) ; light : les pixels dorés de l'écho qui se défait ; gold : l'or qui
// quitte Maelor ; blood : les éclats du sang doré (seulement dans les cases qui ont leurs effets)
interface Cell { sprite: AnimatedSprite; color(filter: string, ms: number): void; paintIn(tint: Tint, ms: number): void; ash(): void; light(): void; gold(): void; blood(): void }

// La forme d'une teinte dans la scène peinte, appliquée aux pixels d'une image : la formule du shader des sprites
// (paintedTint, tints.ts). Une imitation pour l'aperçu, sans le décor ni sa lumière
function painted(image: ImageData, tint: Tint): ImageData {
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const [r, g, b] = paintedTint([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255], tint);
    data[i] = Math.round(r * 255);
    data[i + 1] = Math.round(g * 255);
    data[i + 2] = Math.round(b * 255);
  }
  return image;
}
type Scenario = (cell: Cell) => Promise<void>;

const MARGIN = 8; // marge de la case autour de la toile, en pixels de sprite (pas en avant, bond, saut)
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const PAUSE = 1200;

// Couleurs des scènes : coup reçu, mort et or viennent de tints.ts, comme dans les scènes ; l'éclair de l'ennemi qui
// agit et la lueur du Souffle imitent style.css
const HIT_TINT = TINTS.hit.filter;
const FLASH = "brightness(2.6)";
const DEATH_TINT = `${TINTS.death.filter} brightness(0.9)`; // l'éclat du mouvement réduit de style.css (.sprite.dying)
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
const GOLD = TINTS.gold.filter;
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
// Sang doré (MAE-98) : le coup reçu, avec les éclats du sang, lancés comme en combat (stage.ts, hit) ; la teinte sous sa
// forme de la scène DOM (filtre CSS) ou de la scène peinte
const bloodScenario = (tint: Tint, scene: "dom" | "peinte"): Scenario => async ({ sprite, color, paintIn, blood }) => {
  blood();
  sprite.play("hit");
  if (scene === "dom") color(tint.filter, CONFIG.timing.hit);
  else paintIn(tint, CONFIG.timing.hit);
  await wait(CONFIG.timing.hit + PAUSE);
};
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

// Segments opaques de chaque rangée d'une image chargée (vide si elle ne l'est pas encore)
function imageRows(image: HTMLImageElement): OpaqueRuns[] {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context || !canvas.width) return [];
  context.drawImage(image, 0, 0);
  return opaqueRuns(context.getImageData(0, 0, canvas.width, canvas.height));
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
  // Les braises d'Elwen, sur son PNG au repos, comme sur son sprite en combat (style.css, .ember)
  if (character.embers) {
    png.style.setProperty("--px", String(px));
    png.innerHTML = embersHtml({ id: character.embers });
    if (!effects) box.append(png);
  }
  const fx = effects ? createFxLayer(box, () => px) : null; // seulement dans les cases des effets spéciaux
  const ash = () => { if (fx && target && character.mouth) playAshCloud(fx, png, character.mouth, [aimed]); };
  const light = () => { if (fx) playLightRise(fx, png, sprite); };
  // Le Dragon de la case est une image fixe, debout : l'or se pose sur ses pixels opaques (en combat, sur son image affichée)
  const gold = () => { if (fx) playGoldStream(fx, { element: png, rows: sprite.shownRows() }, target ? { element: aimed, rows: imageRows(aimed) } : null); };
  // Le coup vient de la droite, comme sur un héros en combat (blowFacing) ; la couche porte le même nom qu'en combat
  const blood = () => { if (fx && character.blood) playGoldBlood(fx, { id: character.blood.id, element: png, rows: sprite.shownRows() }, character.blood.setting, -1); };
  let colorTimer = 0;
  const color = (filter: string, ms: number) => {
    tint = filter;
    paint();
    clearTimeout(colorTimer);
    colorTimer = window.setTimeout(() => { tint = ""; paint(); }, ms);
  };
  // La forme de la scène peinte d'une teinte (MAE-98) : sa toile recopiée image par image, recolorée par painted
  // (même formule que le shader de la scène peinte), à la place du sprite pendant ms millisecondes
  const copy = document.createElement("canvas");
  copy.className = "sprite-canvas";
  let paintedUntil = 0;
  const paintIn = (look: Tint, ms: number) => {
    const running = paintedUntil > performance.now();
    paintedUntil = performance.now() + ms;
    if (running) return;
    const step = () => {
      if (performance.now() >= paintedUntil) { copy.remove(); sprite.canvas.style.visibility = ""; return; }
      copy.width = sprite.canvas.width;
      copy.height = sprite.canvas.height;
      copy.style.cssText = sprite.canvas.style.cssText;
      copy.style.visibility = "";
      const context = copy.getContext("2d");
      if (context) {
        context.drawImage(sprite.canvas, 0, 0);
        context.putImageData(painted(context.getImageData(0, 0, copy.width, copy.height), look), 0, 0);
      }
      if (!copy.isConnected) sprite.canvas.after(copy); // à la place du sprite : sous les braises et la couche des effets, comme lui
      sprite.canvas.style.visibility = "hidden";
      requestAnimationFrame(step);
    };
    step();
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
    for (;;) await scenario({ sprite, color, paintIn, ash, light, gold, blood });
  }).catch((error: unknown) => { caption.textContent = `${label} : ${String(error)}`; });
  return { figure, sprite };
}

// — Effets des capacités (MAE-31) —
// Ce que vise une capacité de héros dans sa case, en images fixes : un ennemi, deux pour une capacité sur tous les
// ennemis, un héros pour un soin, le groupe pour un soin de groupe, un héros au sol pour une réanimation. Sans taille
// donnée (la pose au sol), celle de son image
interface Dummy { id: string; side: "hero" | "enemy"; url: string; width?: number; height?: number }
const HEADROOM = BOLT_HEIGHT; // place au-dessus des cibles, en pixels de sprite : l'éclair de Tocsin y tombe de toute sa hauteur, comme sur un ennemi seul en combat
const DUMMY_GAP = 12;         // écart entre deux cibles

const heroDummy = (index: number): Dummy => ({ id: HEROES[index].id, side: "hero", url: HEROES[index].image, width: HERO_CANVAS.w, height: HERO_CANVAS.h });
const enemyDummy = (def: EnemyDef, id: string): Dummy => ({ id, side: "enemy", url: def.image, width: def.canvasWidth, height: def.canvasHeight });
// Un héros éteint, dans sa pose dessinée au sol (MAE-94), comme en combat ; debout s'il n'en a pas
const downDummy = (index: number): Dummy => {
  const down = HEROES[index].rig.poses?.down;
  return down ? { id: HEROES[index].id, side: "hero", url: down.image } : heroDummy(index);
};

function abilityDummies(ability: Ability): Dummy[] {
  switch (ability.target) {
    case "all-foes": return [enemyDummy(ENEMIES.sankri, "sankri-0"), enemyDummy(ENEMIES.gautik, "gautik-1")];
    case "ally": return [heroDummy(0)];
    case "ko-ally": return [downDummy(0)];
    case "all-allies": return HEROES.map((_, index) => heroDummy(index));
    default: return [enemyDummy(ENEMIES.sankri, "sankri-0")];
  }
}

// Ce que vise une capacité d'ennemi : un héros, ou les trois pour une capacité sur tout le groupe (pour un ennemi,
// "foe" désigne un héros)
const enemyAbilityDummies = (ability: Ability): Dummy[] => (ability.target === "all-foes" ? HEROES.map((_, index) => heroDummy(index)) : [heroDummy(0)]);

// Une case qui joue l'effet d'une capacité en boucle sur ses cibles, comme en combat (stage.ts, playAbilityFx). Le
// sens du coup vient du camp de la première cible, comme en combat (blowFacing) : vers la gauche sur un héros
function buildAbilityCell(label: string, effect: AbilityEffect, dummies: Dummy[], px: number) {
  const facing = dummies[0]?.side === "hero" ? -1 : 1;
  const figure = document.createElement("figure");
  figure.className = "anim-cell";
  const box = document.createElement("div");
  box.className = "anim-box";
  const caption = document.createElement("figcaption");
  caption.textContent = label;
  figure.append(box, caption);
  const images = dummies.map((dummy) => {
    const image = document.createElement("img");
    image.src = dummy.url;
    image.className = "anim-target anim-dummy";
    box.appendChild(image);
    return image;
  });
  const fx = createFxLayer(box, () => px);
  // ready : la case a sa taille (images chargées), pour la caler ensuite sur un pixel réel (snap)
  const ready = Promise.all(images.map((image) => image.decode())).then(() => {
    // La taille de chaque cible : celle donnée, sinon celle de son image, une fois chargée
    const sizes = images.map((image, i) => ({ width: dummies[i].width ?? image.naturalWidth, height: dummies[i].height ?? image.naturalHeight }));
    const tallest = Math.max(...sizes.map(({ height }) => height));
    const width = sizes.reduce((sum, size) => sum + size.width, 0) + DUMMY_GAP * (sizes.length - 1) + 2 * MARGIN;
    Object.assign(box.style, { width: `${width * px}px`, height: `${(HEADROOM + tallest + MARGIN) * px}px` });
    let left = MARGIN;
    images.forEach((image, i) => {
      // Les pieds au même niveau, comme les combattants d'une scène
      Object.assign(image.style, {
        width: `${sizes[i].width * px}px`, height: `${sizes[i].height * px}px`, left: `${left * px}px`, top: `${(HEADROOM + tallest - sizes[i].height) * px}px`,
      });
      left += sizes[i].width + DUMMY_GAP;
    });
    return images.map((image, i) => ({ id: dummies[i].id, element: image, rows: imageRows(image) }));
  });
  void ready.then(async (targets) => {
    for (;;) {
      playAbilityFx(fx, effect, targets, facing);
      await wait(CONFIG.timing.abilityFx + PAUSE);
    }
  }).catch((error: unknown) => { caption.textContent = `${label} : ${String(error)}`; });
  return { figure, ready };
}

// Les curseurs du sang doré d'un héros (MAE-98) : ils changent son réglage en direct, et affichent ses valeurs en clair
// et telles qu'elles s'écrivent dans sa fiche
function bloodControls(name: string, setting: GoldBlood) {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = name;
  const code = document.createElement("code");
  const showCode = () => { code.textContent = `goldBlood: { count: ${setting.count}, size: ${setting.size}, frames: ${setting.frames}, bright: ${setting.bright} },`; };
  fieldset.append(legend);
  const slider = (label: string, [min, max]: readonly [number, number], step: number, read: () => number, write: (value: number) => void, shown: (value: number) => string) => {
    const caption = document.createElement("span");
    caption.textContent = label;
    const input = document.createElement("input");
    Object.assign(input, { type: "range", min: String(min), max: String(max), step: String(step), value: String(read()) });
    const output = document.createElement("output");
    output.textContent = shown(read());
    input.addEventListener("input", () => {
      write(Number(input.value));
      output.textContent = shown(read());
      showCode();
    });
    fieldset.append(caption, input, output);
  };
  slider("Éclats", BLOOD_LIMITS.count, 1, () => setting.count, (value) => { setting.count = value; }, (value) => `${value}`);
  slider("Taille", BLOOD_LIMITS.size, 1, () => setting.size, (value) => { setting.size = value; }, (value) => `${value} px de sprite`);
  slider("Durée", BLOOD_LIMITS.frames, 1, () => setting.frames, (value) => { setting.frames = value; }, (value) => `${value} images (${Math.round((value * 1000) / 12)} ms à vitesse normale)`);
  slider("Luminosité", [0, 100], 5, () => Math.round(setting.bright * 100), (value) => { setting.bright = value / 100; }, (value) => `${value} % d'or vif`);
  showCode();
  fieldset.append(code);
  return fieldset;
}

const STYLE = `
  #animation-preview { position: fixed; inset: 0; z-index: 1000; overflow: auto; background: #0d1117; color: #d8d2c4;
    font: 14px/1.4 system-ui, sans-serif; padding: 16px; }
  #animation-preview h1 { font-size: 18px; margin: 0 0 4px; }
  #animation-preview h2 { font-size: 15px; margin: 20px 0 6px; }
  #animation-preview h3 { font-size: 13px; margin: 12px 0 4px; color: #a9a294; }
  #animation-preview p { margin: 0 0 8px; max-width: 70ch; color: #a9a294; }
  #animation-preview .anim-row { display: flex; flex-wrap: wrap; gap: 8px; }
  #animation-preview .anim-cell { margin: 0; }
  #animation-preview .anim-box { position: relative; background: #1b232c; border-bottom: 2px solid #3a4652; overflow: hidden; }
  #animation-preview .sprite-canvas, #animation-preview .anim-target { position: absolute; image-rendering: pixelated; }
  #animation-preview .anim-target { opacity: 0.6; }
  #animation-preview .anim-dummy { opacity: 1; }
  #animation-preview .anim-png { position: absolute; pointer-events: none; }
  #animation-preview .anim-warning { color: #f1e4c3; border-left: 3px solid #c9a84c; padding-left: 8px; }
  #animation-preview.reduced .ember { display: none; }
  #animation-preview fieldset { display: inline-grid; grid-template-columns: auto 160px auto; gap: 2px 8px; align-items: center;
    border: 1px solid #3a4652; margin: 0 8px 8px 0; padding: 6px 10px; }
  #animation-preview fieldset code { grid-column: 1 / -1; font-size: 12px; color: #f1e4c3; user-select: all; }
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
    Les couleurs imitent celles du combat. Les mêmes images servent aux deux scènes, DOM et peinte.
    En bas de la page : l'effet de chaque capacité qui a son effet en pixels, joué en boucle sur ce qu'elle vise.</p>
    <label><input type="checkbox" id="anim-reduced"> Mouvement réduit (simulé)</label>`;
  document.head.appendChild(style);
  document.body.appendChild(page);
  page.querySelector<HTMLInputElement>("#anim-reduced")?.addEventListener("change", (event) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    overrideReducedMotion(event.target.checked ? true : null);
    page.classList.toggle("reduced", event.target.checked); // les braises d'Elwen : comme le @media de style.css
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
  // Effets des capacités (MAE-31) : une case par capacité qui a son effet en pixels, et l'entaille reçue par un héros
  const fxTitle = document.createElement("h2");
  fxTitle.textContent = "Effets des capacités";
  const fxRow = document.createElement("div");
  fxRow.className = "anim-row";
  const cells: Promise<unknown>[] = [];
  const addCell = (cell: ReturnType<typeof buildAbilityCell>) => { fxRow.appendChild(cell.figure); cells.push(cell.ready); };
  for (const ability of [ATTACK, ...Object.values<Ability>(SPELLS), ...Object.values<Ability>(ITEMS)]) {
    if (ability.effect) addCell(buildAbilityCell(ability.name, ability.effect, abilityDummies(ability), px));
  }
  // Un ennemi qui frappe : la même entaille, sur un héros, depuis la droite
  if (ATTACK.effect) addCell(buildAbilityCell(`${ATTACK.name}, reçu par un héros`, ATTACK.effect, [heroDummy(0)], px));
  // Les capacités des ennemis (MAE-98), sur les héros, avec le nom de l'ennemi qui la lance
  for (const [id, ability] of Object.entries<Ability>(ENEMY_SKILLS)) {
    const caster = Object.values<EnemyDef>(ENEMIES).find((enemy) => enemy.skills?.some(({ skill }) => skill === id) || enemy.pattern?.some((action) => action === id));
    if (ability.effect) addCell(buildAbilityCell(caster ? `${ability.name} (${caster.name})` : ability.name, ability.effect, enemyAbilityDummies(ability), px));
  }
  page.append(fxTitle, fxRow);

  // Sang doré (MAE-98) : en tête, le risque noté par Wesley ; puis les curseurs de Maelor et d'Elwen, et leur coup reçu
  // dans chaque scène
  const bloodTitle = document.createElement("h2");
  bloodTitle.textContent = "Sang doré (MAE-98)";
  const bloodText = document.createElement("div");
  bloodText.innerHTML = `<p class="anim-warning">À surveiller (noté par Wesley) : les braises d'Elwen sont déjà en or vif #f0c95a,
    la même couleur que les éclats de son sang.</p>
    <p>Chaque case joue le coup reçu, avec sa teinte et les éclats du sang. Les curseurs règlent
    tout de suite les éclats de toutes les cases du héros ; rien n'est enregistré, un rechargement remet les valeurs de
    sa fiche. Les valeurs à recopier dans la fiche (goldBlood, game-data.ts) s'affichent sous les curseurs. Sur téléphone,
    un pixel de sprite fait un pixel CSS : ?zoom=1 en donne l'idée sur ordinateur.</p>
    <p>La teinte du coup reçu a deux formes : le filtre CSS de la scène DOM, et la couleur de la scène peinte (la
    luminosité de chaque pixel prend la teinte de la rouille). La seconde rangée imite la scène peinte, sans le décor.</p>`;
  const controls = document.createElement("div");
  const bloodCells = document.createElement("div");
  const bleeding = HEROES.flatMap((hero) => (hero.goldBlood ? [{ hero, setting: { ...hero.goldBlood } }] : []));
  for (const { hero, setting } of bleeding) controls.appendChild(bloodControls(hero.name, setting));
  for (const [scene, heading] of [["dom", "Scène DOM : le filtre CSS"], ["peinte", "Scène peinte : la couleur (imitée)"]] as const) { // as const : les deux scènes, de type "dom" | "peinte"
    const subtitle = document.createElement("h3");
    subtitle.textContent = heading;
    const row = document.createElement("div");
    row.className = "anim-row";
    for (const { hero, setting } of bleeding) {
      const character: Character = {
        name: hero.name, url: hero.image, rig: hero.rig, height: HERO_CANVAS.h, facing: 1, boss: false,
        blood: { id: hero.id, setting }, embers: hero.embers ? hero.id : undefined,
      };
      const cell = buildCell(character, `${hero.name} · Coup reçu · ${scene}`, bloodScenario(TINTS.hit, scene), px, undefined, true);
      row.appendChild(cell.figure);
      sprites.push(cell.sprite);
    }
    bloodCells.append(subtitle, row);
  }
  page.append(bloodTitle, bloodText, controls, bloodCells);

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
  // Une fois toutes les cases à leur taille (images chargées, celles des effets comprises), puis à chaque changement
  void Promise.allSettled([...sprites.map((sprite) => sprite.ready), ...cells]).then(() => requestAnimationFrame(snap));
}
