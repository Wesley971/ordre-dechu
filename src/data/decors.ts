// decors.ts - Décors peints en 2,5D (MAE-28) : images, relief, places des personnages et ambiance de chaque lieu
// Données seules, sans Three.js : ce fichier est chargé avec le jeu, même quand aucune scène n'est affichée.

export type DecorId = "lisiere";

// Un point de la peinture, en pixels de l'image (colonne 0 à gauche, ligne 0 en haut)
export interface ImagePoint { col: number; row: number }

// Plan animé posé sur le relief : même taille que `wide`, transparent ailleurs
export interface SwayingLayer { file: string; amplitude: number; rise: [number, number] }

// Forêt des côtés, pour les écrans plus larges que la peinture. Rectangle en pixels de l'image.
export interface DecorSides {
  width: number; top: number; bottom: number;
  far:    { left: string; right: string; depth: number };
  glints: { left: string; right: string; depth: number };
  near:   { left: string; right: string; depth: number };
  corners?: {
    left:  { file: string; width: number; height: number };
    right: { file: string; width: number; height: number };
    depth: number; amplitude: number; rise: [number, number];
  };
}

export interface Decor {
  image: {
    width: number; height: number; // la peinture elle-même
    extend: number;                // prolongement de `wide` à gauche et à droite de la peinture, en pixels
    wide: string;                  // peinture et prolongements
    depthMap: string;              // carte de profondeur de `wide` : 0 = proche, 255 = loin
    foreground?: SwayingLayer;     // feuillages qui se balancent
    glints?: string;               // lucioles et fleurs peintes, qui luisent
  };
  // Profondeur en mètres d'un point de la carte : near + span × valeur ^ power
  relief: { near: number; span: number; power: number };
  // Pieds des personnages sur la peinture. En pixels de l'image et non en mètres : ils restent au même
  // endroit de la peinture quelle que soit la distance de la caméra, donc aussi en portrait.
  places: { heroes: ImagePoint[]; enemies: ImagePoint[] };
  sides?: DecorSides;
  atmosphere: {
    colors: { background: string; mist: string; moonlight: string; firefly: string; edgeShadow: string; edgeMist: string };
    fog: [number, number];                // distances de début et de fin du brouillard, en mètres
    // Brume sur le relief. row, spread : ligne de la peinture où elle est la plus dense, et son étendue en lignes.
    // from : valeur de la carte de profondeur à partir de laquelle elle apparaît (ce qui est plus proche reste net).
    // below : nombre de lignes sous `row` où elle s'éteint sur le sol.
    mist: { opacity: number; row: number; spread: number; from: number; below: number };
    shafts: { opacity: number; breath: number }; // rayons de lune : opacité et amplitude de leur respiration
    fireflies: number;                    // nombre de lucioles (le Souffle rendu visible, docs/lore.md)
  };
}

const LISIERE_DIR = "images/backdrops/lisiere";
// Les côtés ont été découpés pour un cadrage de 740 lignes, à partir de la ligne 440 de background.png :
// on les ramène à la hauteur de cette peinture, à la même taille d'écran (labo, essai 8).
const lisiereSide = (oldPixels: number) => (oldPixels * 768) / 740;

export const DECORS: Record<DecorId, Decor> = {
  lisiere: {
    image: {
      width: 1376, height: 768, extend: 600,
      wide: `${LISIERE_DIR}/wide.png`,
      depthMap: `${LISIERE_DIR}/depth.png`,
      foreground: { file: `${LISIERE_DIR}/foreground.png`, amplitude: 0.0016, rise: [0, 0.27] },
      glints: `${LISIERE_DIR}/glints.png`,
    },
    relief: { near: 9, span: 62, power: 1.4 },
    // Elwen, Corvin, Maelor, puis les deux Sankri : sur la clairière, de part et d'autre du sentier
    places: {
      heroes:  [{ col: 368.3, row: 631.66 }, { col: 482.14, row: 568.66 }, { col: 568.22, row: 656.75 }],
      enemies: [{ col: 858.99, row: 572.84 }, { col: 1013.45, row: 646.54 }],
    },
    sides: {
      width: lisiereSide(760), top: lisiereSide(240 - 440), bottom: lisiereSide(1400 - 440),
      far:    { left: `${LISIERE_DIR}/side-far-left.png`,    right: `${LISIERE_DIR}/side-far-right.png`,    depth: 34 },
      glints: { left: `${LISIERE_DIR}/side-glints-left.png`, right: `${LISIERE_DIR}/side-glints-right.png`, depth: 21 },
      near:   { left: `${LISIERE_DIR}/side-near-left.png`,   right: `${LISIERE_DIR}/side-near-right.png`,   depth: 19 },
      corners: {
        left:  { file: `${LISIERE_DIR}/corner-left.png`,  width: 290, height: 360 },
        right: { file: `${LISIERE_DIR}/corner-right.png`, width: 350, height: 310 },
        depth: 14, amplitude: 0.012, rise: [0.15, 1],
      },
    },
    atmosphere: {
      colors: {
        background: "#071820", mist: "#5d8496", moonlight: "#bfe7e9", firefly: "#8fd8ff",
        edgeShadow: "#010b10", edgeMist: "#123845",
      },
      fog: [70, 220],
      mist: { opacity: 0.38, row: 470, spread: 170, from: 0.7, below: 120 },
      shafts: { opacity: 0.09, breath: 0.05 },
      fireflies: 46,
    },
  },
};

export function isDecorId(value: string): value is DecorId {
  return Object.hasOwn(DECORS, value);
}
