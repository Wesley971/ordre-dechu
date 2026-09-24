// config.js - Constantes de gameplay et durées (chargé en premier)

const CONFIG = {
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
    defendMultiplier: 0.5,   // dégâts subis en Défense
    weakMultiplier:   2,     // faiblesse élémentaire
    resistMultiplier: 0.5,   // résistance élémentaire
  },
  run: {
    successChance: 0.6,
  },
  revivePct:   0.25, // part des PV rendus par Vie et Queue de Phénix
  criticalPct: 0.25, // sous cette part des PV, un héros est en danger (PV dorés, héros à genoux)

  // XP totale requise pour chaque niveau (index 0 = niveau 1)
  xpTable: [0, 30, 80, 160, 280, 450, 700, 1000, 1400, 2000],

  startingItems: { potion: 5, ether: 2, phoenix: 2 },

  // Durées en millisecondes. Celles marquées (CSS) doivent suivre l'animation du même nom dans style.css
  timing: {
    typewriter:    22,   // délai entre deux lettres des dialogues
    message:       1000, // bandeau d'annonce (nom du sort, fuite...)
    introMessage:  900,  // « Des ennemis surgissent ! »
    escapeMessage: 500,  // « Le groupe prend la fuite ! »
    step:          220,  // pas en avant d'un héros qui agit
    effect:        750,  // pause pour lire les chiffres de dégâts
    flash:         600,  // éclair du début de combat (CSS encounter-flash)
    appear:        1200, // apparition des ennemis (CSS enemy-appear, délai compris)
    blink:         450,  // clignotement d'un ennemi qui agit (CSS enemy-blink)
    cast:          350,  // lueur d'incantation (CSS cast-glow)
    hit:           400,  // tremblement d'un coup reçu (CSS shake)
    spellFx:       700,  // effet de sort (CSS fx-*)
    popup:         1200, // chiffre de dégâts (CSS popup-bounce)
    death:         700,  // disparition d'un ennemi (CSS enemy-dissolve)
    flee:          700,  // sortie de scène du groupe (CSS .fleeing)
  },
};
