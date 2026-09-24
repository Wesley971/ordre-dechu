// sfx.js - Bruitages 8-bit générés avec la Web Audio API (aucun fichier son)

const Sfx = {
  ctx: null,
  enabled: true,

  init() {
    try { this.enabled = localStorage.getItem("mini-rpg-sound") !== "off"; } catch {}
  },

  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem("mini-rpg-sound", this.enabled ? "on" : "off"); } catch {}
    return this.enabled;
  },

  audio() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },

  // Une note : fréquence (Hz), durée (s), forme d'onde, volume, décalage (s), glissando vers slideTo (Hz)
  tone(freq, duration, { type = "square", volume = 0.05, delay = 0, slideTo } = {}) {
    const ctx = this.audio();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  },

  // Bruit blanc filtré : coups, explosions
  noise(duration, { volume = 0.12, delay = 0, cutoff = 2000 } = {}) {
    const ctx = this.audio();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start);
  },

  arpeggio(notes, step, options) {
    notes.forEach((freq, i) => this.tone(freq, step * 1.6, { ...options, delay: i * step }));
  },

  play(name) {
    if (!this.enabled) return;
    const sound = SOUNDS[name];
    if (sound) sound(this);
  },
};

const SOUNDS = {
  cursor:    s => s.tone(1320, 0.04, { volume: 0.03 }),
  confirm:   s => { s.tone(990, 0.05, { volume: 0.04 }); s.tone(1480, 0.07, { volume: 0.04, delay: 0.05 }); },
  cancel:    s => s.tone(660, 0.08, { volume: 0.04, slideTo: 330 }),
  error:     s => s.tone(140, 0.15, { type: "sawtooth", volume: 0.05 }),
  ready:     s => s.tone(1760, 0.05, { type: "triangle", volume: 0.05 }),
  hit:       s => s.noise(0.12, { cutoff: 1800 }),
  crit:      s => { s.noise(0.25, { volume: 0.2, cutoff: 3000 }); s.tone(110, 0.25, { volume: 0.08 }); },
  miss:      s => s.tone(500, 0.1, { type: "triangle", volume: 0.04, slideTo: 900 }),
  fire:      s => s.noise(0.45, { volume: 0.16, cutoff: 900 }),
  ice:       s => s.arpeggio([2093, 2637, 3136, 2637], 0.04, { type: "triangle", volume: 0.03 }),
  thunder:   s => { s.noise(0.3, { volume: 0.2, cutoff: 6000 }); s.tone(80, 0.3, { type: "sawtooth", volume: 0.06 }); },
  magic:     s => s.tone(300, 0.3, { type: "sine", volume: 0.06, slideTo: 1200 }),
  heal:      s => s.arpeggio([523, 659, 784, 1047], 0.07, { type: "triangle", volume: 0.05 }),
  item:      s => s.arpeggio([784, 1047], 0.06, { type: "triangle", volume: 0.05 }),
  defend:    s => s.tone(440, 0.12, { type: "triangle", volume: 0.05, slideTo: 880 }),
  enemyDie:  s => { s.tone(700, 0.45, { volume: 0.05, slideTo: 60 }); s.noise(0.4, { volume: 0.06, cutoff: 700 }); },
  run:       s => s.arpeggio([880, 740, 587, 440], 0.05, { volume: 0.04 }),
  encounter: s => { s.tone(220, 0.5, { type: "sawtooth", volume: 0.05, slideTo: 880 }); s.noise(0.5, { volume: 0.05, cutoff: 1200 }); },
  levelUp:   s => s.arpeggio([523, 659, 784, 1047, 1319], 0.06, { volume: 0.04 }),
  victory:   s => {
    // Petite fanfare originale : arpège montant puis accord tenu
    s.arpeggio([392, 523, 659, 784], 0.1, { volume: 0.045 });
    [1047, 784, 659].forEach(f => s.tone(f, 0.9, { volume: 0.03, delay: 0.45 }));
  },
  gameOver:  s => s.arpeggio([330, 294, 262, 247, 196], 0.28, { type: "triangle", volume: 0.06 }),
};

Sfx.init();
