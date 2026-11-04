// painted-stage.ts - La scène peinte en 2,5D (MAE-28) : caméra, flou, boucle de rendu, redimensionnement, mémoire
//
// Module autonome : il n'importe ni le combat ni l'histoire. Il reçoit un décor et des personnages, et les affiche
// dans un conteneur. Three.js n'est chargé qu'avec lui : l'importer à la demande, jamais depuis le code de démarrage.

import {
  Color, Fog, Group, HalfFloatType, PerspectiveCamera, Scene, Vector2, WebGLRenderTarget, WebGLRenderer,
  type IUniform,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Pass } from "three/addons/postprocessing/Pass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { CONFIG } from "../config.ts";
import type { Decor } from "../data/decors.ts";
import { buildActors, type ActorBox, type ActorDef, type ActorsView } from "./actors.ts";
import { buildAtmosphere, type AtmosphereView } from "./atmosphere.ts";
import { computeFraming, type Framing } from "./framing.ts";
import { ResourceBin } from "./materials.ts";
import { buildRelief, type ReliefView } from "./relief.ts";

const PARALLAX = { amplitude: 0.9, speed: 0.35 };

export type SceneQuality = keyof typeof CONFIG.scene.qualityLevels;

export interface StageMeasure {
  quality: SceneQuality;
  decorScale: number;
  samples: number;
  spritePixel: number;
  fitted: boolean;
  ratio: number;
  deviceWidth: number;
  deviceHeight: number;
  reducedMotion: boolean;
  boxes: ActorBox[];
  memory: { geometries: number; textures: number; programs: number };
  frame: { calls: number; triangles: number };
}

export interface PaintedStage {
  // Remplace le décor. Le précédent reste affiché pendant le chargement, puis sa mémoire graphique est libérée.
  setDecor(decor: Decor, actors: ActorDef[]): Promise<void>;
  // Oscillation de la caméra, qui révèle le relief. Outil de contrôle, sans effet en mouvement réduit.
  setParallax(on: boolean): void;
  measure(): StageMeasure;
  dispose(): void;
}

interface DecorView {
  decor: Decor;
  bin: ResourceBin;
  root: Group;
  spriteRoot: Group;
  relief: ReliefView;
  atmosphere: AtmosphereView;
  actors: ActorsView;
}

// Flou de profondeur (tilt-shift) en deux passes, mesuré en pixels CSS : même rendu quel que soit le rapport
// largeur/hauteur. La zone nette suit les personnages ; le flou croît doucement au-delà. C'est lui qui donne
// l'effet de maquette et fait oublier que le décor est une image à plat. La passe verticale pose aussi la vignette.
function tiltShiftShader(direction: "h" | "v") {
  const { slope, maxStep } = CONFIG.scene.tiltShift;
  const uniforms: Record<string, IUniform> = {
    tDiffuse: { value: null },
    cssSize: { value: new Vector2(1, 1) },
    focus: { value: 0.5 },
    bandPx: { value: 100 },
    slope: { value: slope },
    maxStep: { value: maxStep },
    vignette: { value: direction === "v" ? 1 : 0 },
  };
  return {
    name: `TiltShiftBand_${direction}`,
    uniforms,
    vertexShader: /* glsl */ "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }",
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform vec2 cssSize; uniform float focus; uniform float bandPx;
      uniform float slope; uniform float maxStep; uniform float vignette; varying vec2 vUv;
      void main() {
        float distancePx = max( 0.0, abs( vUv.y - focus ) * cssSize.y - bandPx );
        float stepPx = min( maxStep, distancePx * slope );
        vec2 stepUv = stepPx / cssSize * ${direction === "h" ? "vec2( 1.0, 0.0 )" : "vec2( 0.0, 1.0 )"};
        vec4 sum = texture2D( tDiffuse, vUv ) * 0.1633;
        sum += ( texture2D( tDiffuse, vUv - stepUv ) + texture2D( tDiffuse, vUv + stepUv ) ) * 0.1531;
        sum += ( texture2D( tDiffuse, vUv - 2.0 * stepUv ) + texture2D( tDiffuse, vUv + 2.0 * stepUv ) ) * 0.12245;
        sum += ( texture2D( tDiffuse, vUv - 3.0 * stepUv ) + texture2D( tDiffuse, vUv + 3.0 * stepUv ) ) * 0.0918;
        sum += ( texture2D( tDiffuse, vUv - 4.0 * stepUv ) + texture2D( tDiffuse, vUv + 4.0 * stepUv ) ) * 0.051;
        vec2 c = ( vUv - 0.5 ) * vec2( 1.0, 0.8 );
        sum.rgb *= mix( 1.0, 1.0 - smoothstep( 0.42, 0.78, length( c ) ) * 0.75, vignette );
        gl_FragColor = sum;
      }`,
  };
}

// Dessine les sprites par-dessus l'image floutée, avant la conversion finale des couleurs.
// Dans l'image courante, sans échanger les tampons : sinon la passe suivante lirait l'image sans sprites.
class SpriteOverlayPass extends Pass {
  private readonly spriteScene: Scene;
  private readonly camera: PerspectiveCamera;

  constructor(spriteScene: Scene, camera: PerspectiveCamera) {
    super();
    this.spriteScene = spriteScene;
    this.camera = camera;
    this.needsSwap = false;
  }

  render(renderer: WebGLRenderer, _writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget) {
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(readBuffer);
    renderer.clearDepth();
    renderer.render(this.spriteScene, this.camera);
    renderer.autoClear = autoClear;
  }
}

// Lève une erreur si WebGL est absent : il n'y a pas de décor de repli (décision de MAE-1)
// quality : niveau de CONFIG.scene.qualityLevels, fixé pour toute la vie de la scène (l'anticrénelage se choisit à la création)
export function createPaintedStage(container: HTMLElement, quality: SceneQuality = CONFIG.scene.defaultQuality): PaintedStage {
  const { camera: cameraConfig, maxPixelRatio, qualityLevels, decorScaleBelowCssSide, decorScaleFromRatio, tiltShift } = CONFIG.scene;
  const level = qualityLevels[quality];
  const pixelRatio = () => Math.min(window.devicePixelRatio, maxPixelRatio);

  const renderer = new WebGLRenderer({ antialias: false }); // anticrénelage porté par la cible du composer
  renderer.info.autoReset = false; // le composer dessine plusieurs fois par image : on compte l'image entière
  const canvas = renderer.domElement;
  canvas.style.position = "absolute"; // hors du flux : sa taille ne peut pas relancer le redimensionnement du conteneur
  canvas.style.inset = "0";
  container.appendChild(canvas);

  const scene = new Scene();
  const spriteScene = new Scene();
  // Focale serrée et caméra inclinée : voir CONFIG.scene.camera. La distance vient du cadrage (framing.ts).
  const camera = new PerspectiveCamera(cameraConfig.fov, 1, 0.5, 160);

  const composer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: level.samples }));
  const tiltH = new ShaderPass(tiltShiftShader("h"));
  const tiltV = new ShaderPass(tiltShiftShader("v"));
  const overlay = new SpriteOverlayPass(spriteScene, camera);
  const output = new OutputPass();
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(tiltH);
  composer.addPass(tiltV);
  composer.addPass(overlay);
  composer.addPass(output);
  let decorScale = 1;

  const time = { value: 0 };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const startTime = performance.now();
  let view: DecorView | null = null;
  let framing: Framing | null = null;
  let generation = 0; // numéro du dernier setDecor : un chargement dépassé ne s'installe pas
  let parallax = false;
  let drift = 0;
  let contextLost = false;
  let disposed = false;

  function placeCamera(distance: number, sideDrift: number) {
    const { pitch, targetX, targetY, targetZ } = cameraConfig;
    camera.position.set(targetX + sideDrift, targetY + Math.sin(pitch) * distance, targetZ + Math.cos(pitch) * distance);
    camera.lookAt(targetX + sideDrift, targetY, targetZ);
    camera.far = Math.max(160, distance + 100); // recul du portrait : le fond doit rester dans le champ
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function updateFocusBand(cssHeight: number) {
    const range = view?.actors.focusRange();
    if (!range) return;
    for (const pass of [tiltH, tiltV]) {
      pass.uniforms.focus.value = (range.min + range.max) / 2;
      pass.uniforms.bandPx.value = ((range.max - range.min) / 2) * cssHeight + tiltShift.margin;
    }
  }

  // Toute la mise en place dépend de la taille : recalculée au redimensionnement, à la rotation et au changement de décor.
  // Toujours avec la caméra au repos, même pendant l'oscillation : la peinture est projetée depuis elle.
  function layout() {
    const cssWidth = container.clientWidth;
    const cssHeight = container.clientHeight;
    if (cssWidth === 0 || cssHeight === 0) return; // conteneur masqué : on attendra sa prochaine taille
    const ratio = pixelRatio();
    renderer.setPixelRatio(ratio);
    renderer.setSize(cssWidth, cssHeight);
    const reducible = Math.min(cssWidth, cssHeight) < decorScaleBelowCssSide || ratio >= decorScaleFromRatio;
    decorScale = reducible ? level.decorScale : 1;
    // Peinture réduite : le composer ne garde que le décor et le flou, draw() termine l'image à pleine résolution
    const reduced = decorScale < 1;
    composer.renderToScreen = !reduced;
    overlay.enabled = !reduced;
    output.enabled = !reduced;
    composer.setPixelRatio(ratio * decorScale);
    composer.setSize(cssWidth, cssHeight);
    for (const pass of [tiltH, tiltV]) pass.uniforms.cssSize.value.set(cssWidth, cssHeight);
    camera.aspect = cssWidth / cssHeight;
    if (!view) return;

    framing = computeFraming({ cssWidth, cssHeight, ratio }, view.decor, view.actors.extent);
    placeCamera(framing.cameraDistance, 0);
    view.relief.layout(framing, { width: cssWidth, height: cssHeight });
    // La brume mesure sa position en pixels de l'image où elle est dessinée : ceux du décor, pas ceux de l'écran
    view.atmosphere.layout(framing, view.relief.edge(), new Vector2(composer.readBuffer.width, composer.readBuffer.height));
    view.actors.layout(framing);
    if (drift !== 0) {
      placeCamera(framing.cameraDistance, drift);
      view.actors.rescale();
    }
    updateFocusBand(cssHeight);
  }

  function animate(t: number, moving: boolean) {
    if (!view) return;
    time.value = t;
    view.actors.update(t, moving);
    view.atmosphere.update(t);
    const targetDrift = parallax && moving ? Math.sin(t * PARALLAX.speed) * PARALLAX.amplitude : 0;
    if (framing && Math.abs(targetDrift - drift) > 1e-4) {
      drift = targetDrift;
      placeCamera(framing.cameraDistance, drift);
      view.actors.rescale();
      updateFocusBand(container.clientHeight);
    }
  }

  function draw() {
    if (!view || contextLost) return;
    renderer.info.reset();
    composer.render();
    if (decorScale === 1) return;
    // Peinture réduite : agrandie à l'écran avec lissage, puis sprites par-dessus, directement à pleine résolution.
    // Le lissage ne touche que le décor : les pixels des sprites restent exacts.
    output.renderToScreen = true;
    output.render(renderer, composer.writeBuffer, composer.readBuffer, 0, false);
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(null);
    renderer.clearDepth();
    renderer.render(spriteScene, camera);
    renderer.autoClear = autoClear;
  }

  function loop() {
    animate((performance.now() - startTime) / 1000, true);
    draw();
  }

  // Mouvement réduit : une image fixe, redessinée seulement quand quelque chose change
  function drawStill() {
    animate(0, false);
    draw();
  }

  function applyMotionPreference() {
    if (!view || contextLost) {
      renderer.setAnimationLoop(null);
      return;
    }
    if (reducedMotion.matches) {
      renderer.setAnimationLoop(null);
      drawStill();
    } else {
      renderer.setAnimationLoop(loop);
    }
  }

  function refresh() {
    if (disposed) return;
    layout();
    // Sans attendre la prochaine image : changer la taille du canvas l'efface, on verrait un flash
    if (reducedMotion.matches) drawStill();
    else draw();
  }

  const resizeObserver = new ResizeObserver(refresh);
  resizeObserver.observe(container);
  window.addEventListener("resize", refresh); // la densité de l'écran peut changer sans que le conteneur change

  // Téléphone mis en veille, onglet en arrière-plan : le navigateur peut retirer la mémoire graphique.
  // Three.js recharge tout seul textures et programmes à la restauration, si la perte a été annulée (preventDefault).
  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    applyMotionPreference();
  };
  const onContextRestored = () => {
    contextLost = false;
    layout();
    applyMotionPreference();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  reducedMotion.addEventListener("change", applyMotionPreference);

  function removeView(old: DecorView) {
    scene.remove(old.root);
    spriteScene.remove(old.spriteRoot);
    old.bin.disposeAll();
  }

  layout();

  return {
    async setDecor(decor, actorDefs) {
      const token = ++generation;
      const bin = new ResourceBin();
      const root = new Group();
      const spriteRoot = new Group();
      let next: DecorView;
      try {
        const [relief, actors] = await Promise.all([
          buildRelief(decor, root, camera, bin, time),
          buildActors(actorDefs, root, spriteRoot, camera, bin),
        ]);
        const atmosphere = buildAtmosphere(decor, root, camera, bin);
        next = { decor, bin, root, spriteRoot, relief, atmosphere, actors };
      } catch (error) {
        bin.disposeAll(); // ce qui finit de charger ensuite est libéré aussitôt
        throw error;
      }
      if (token !== generation || disposed) {
        bin.disposeAll();
        return;
      }

      const old = view;
      view = next;
      if (old) removeView(old);
      scene.add(root);
      spriteScene.add(spriteRoot);
      const { colors, fog } = decor.atmosphere;
      scene.background = new Color(colors.background);
      scene.fog = new Fog(colors.background, fog[0], fog[1]);
      layout();
      applyMotionPreference();
    },

    setParallax(on) {
      parallax = on;
    },

    measure() {
      const ratio = renderer.getPixelRatio();
      const deviceWidth = container.clientWidth * ratio;
      const deviceHeight = container.clientHeight * ratio;
      const { memory, programs, render } = renderer.info;
      return {
        quality,
        decorScale,
        samples: level.samples,
        spritePixel: framing?.spritePixel ?? 0,
        fitted: framing?.fitted ?? false,
        ratio,
        deviceWidth,
        deviceHeight,
        reducedMotion: reducedMotion.matches,
        boxes: view?.actors.boxes(deviceWidth, deviceHeight) ?? [],
        memory: { geometries: memory.geometries, textures: memory.textures, programs: programs?.length ?? 0 },
        frame: { calls: render.calls, triangles: render.triangles },
      };
    },

    dispose() {
      disposed = true;
      generation++;
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      window.removeEventListener("resize", refresh);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      reducedMotion.removeEventListener("change", applyMotionPreference);
      if (view) removeView(view);
      view = null;
      tiltH.dispose();
      tiltV.dispose();
      output.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
