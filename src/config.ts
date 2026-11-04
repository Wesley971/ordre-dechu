// config.ts - Constantes de gameplay et durées

export const CONFIG = {
  atb: {
    fillRate: 1.1,   // la jauge gagne (vitesse + 20) × fillRate points par seconde (pleine à 100)
    startMax: 60,    // remplissage aléatoire au début du combat (entre 0 et startMax)
    mode:     "wait" // "wait" : le temps s'arrête dans les sous-menus · "active" : il ne s'arrête jamais
  },
  damage: {
    variance:         0.125, // ±12,5 % d'aléa sur chaque coup
    critChance:       0.06,
    critMultiplier:   2,
    missChance:       0.05,
    defendMultiplier: 0.5,   // dégâts subis en Garde
    weakMultiplier:   2,     // faiblesse élémentaire
    resistMultiplier: 0.5,   // résistance élémentaire
  },
  run: {
    successChance: 0.6,
  },
  power: {
    bonus: 1.25, // dégâts et soins des héros tant que le pouvoir du Cœur est pris (MAE-72)
  },
  // Musiques (MAE-12) : en secondes, hors de timing pour ne pas être accélérées par le mode test
  music: {
    volume:          0.35, // volume général de la musique, sous les bruitages
    fadeSeconds:     1.5,  // fondu enchaîné entre deux pistes, et fondu de sortie
    loopFadeSeconds: 2,    // relais de boucle : la piste repart en fondu enchaîné, ce temps avant sa fin
    muteSeconds:     0.3,  // bouton son
  },
  // Scène peinte en 2,5D (MAE-28). Ce qui est propre à un lieu se règle dans son décor (src/data/decors.ts)
  scene: {
    spritePixel: 1 / 32,               // taille d'un pixel de sprite dans le monde, en mètres
    screenHeightInSpritePixels: 360,   // hauteur d'écran visée, en pixels de sprite : fixe la taille des personnages
    groupMarginInSpritePixels: 8,      // marge de chaque côté du groupe, quand la largeur de l'écran limite le cadrage
    camera: {
      fov:     28,   // focale serrée : peu de déformation, l'effet « maquette » du décor peint
      pitch:   0.36, // inclinaison vers le sol, en radians (20,6°) : on voit le sol sans perdre le haut de la forêt
      targetX: 0,
      targetY: 1,
      targetZ: 0.4,
    },
    tiltShift: {
      margin:  70,        // zone nette : des pieds aux têtes, plus cette marge, en pixels CSS
      slope:   1 / 160,   // le flou croît de cette quantité par pixel CSS au-delà de la zone nette
      maxStep: 1.6,       // intensité maximale : écart entre les 9 points du flou, en pixels CSS
    },
    maxPixelRatio: 3, // à la vraie densité d'un téléphone : un plafond plus bas ferait agrandir l'image, donc flouter les sprites
    // Niveaux de qualité du décor. Les sprites restent toujours à la pleine résolution de l'écran.
    // samples : anticrénelage du décor. decorScale : résolution de la peinture, sur écran étroit ou à forte densité
    // Défaut partout, ordinateur et téléphone (décision de Wesley du 04/11/2026, MAE-28) : sur iPhone 11, l'anticrénelage
    // divisait les images/s par deux (30 contre 60), sans différence visible. Le niveau 1 reste en réserve pour les téléphones plus anciens.
    defaultQuality: 2 as const, // as const : doit rester l'un des niveaux ci-dessous, pas un nombre quelconque
    qualityLevels: {
      1: { samples: 0, decorScale: 0.6 },
      2: { samples: 0, decorScale: 1 },
      3: { samples: 4, decorScale: 1 },
    },
    decorScaleBelowCssSide: 600, // écran étroit : son plus petit côté est sous cette taille, en pixels CSS
    decorScaleFromRatio:    2,   // forte densité : à partir de cette densité d'écran
  },

  revivePct:   0.25, // part des PV rendus par Liéver et la Larme dorée
  criticalPct: 0.25, // sous cette part des PV, un héros est en danger (PV dorés, héros à genoux)

  // XP totale requise pour chaque niveau (index 0 = niveau 1)
  xpTable: [0, 30, 80, 160, 280, 450, 700, 1000, 1400, 2000],

  startingItems: { potion: 5, ether: 2, phoenix: 2 },

  // Durées en millisecondes. Celles marquées (CSS) doivent suivre l'animation du même nom dans style.css
  timing: {
    typewriter:    22,   // délai entre deux lettres des dialogues
    message:       1000, // bandeau d'annonce (nom de la capacité, repli...)
    introMessage:  900,  // « Des ennemis surgissent ! »
    escapeMessage: 500,  // « Le groupe se replie ! »
    step:          220,  // pas en avant d'un héros qui agit (CSS hero-lunge)
    effect:        750,  // pause pour lire les chiffres de dégâts
    flash:         600,  // éclair du début de combat (CSS encounter-flash)
    appear:        1200, // apparition des ennemis (CSS enemy-appear, délai compris)
    blink:         450,  // clignotement d'un ennemi qui agit (CSS enemy-blink)
    cast:          350,  // lueur du Souffle (CSS cast-glow)
    hit:           400,  // tremblement d'un coup reçu (CSS shake, hero-recoil)
    spellFx:       700,  // effet de souffle (CSS fx-*)
    popup:         1200, // chiffre de dégâts (CSS popup-bounce)
    death:         700,  // disparition d'un ennemi (CSS enemy-dissolve)
    flee:          700,  // sortie de scène du groupe (CSS .fleeing)
  },
};
