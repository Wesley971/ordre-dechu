// music.ts - Musiques d'ambiance (MAE-12) : une piste par lieu, bouclée, avec fondus enchaînés
// Fichiers dans public/audio/ (MUSIC, game-data.ts), crédits dans CREDITS.md. Le son se coupe avec le même
// réglage que les bruitages (Sfx.enabled, clé ordre-dechu-sound) : il n'y a qu'un seul bouton son.

import { CONFIG } from "../config.ts";
import { MUSIC, type MusicId } from "../data/game-data.ts";
import { Sfx } from "./sfx.ts";

// Une lecture d'une piste : un élément <audio> passé par son propre gain, pour les fondus
interface Voice {
  audio: HTMLAudioElement;
  gain: GainNode;
  fading: boolean; // en train de s'éteindre : ne relance plus la boucle
}

interface MusicPlayer {
  wanted: MusicId | null;  // piste demandée par le jeu (null : silence)
  current: MusicId | null; // piste qui joue vraiment
  voices: Voice[];         // lectures en cours : une seule, deux pendant un fondu enchaîné
  master: GainNode | null; // volume général de la musique, à 0 quand le son est coupé
  unlocked: boolean;       // vrai après la première interaction du joueur (règle des navigateurs)
  unlock(): void;
  play(id: MusicId): void;
  stop(): void;
  syncSound(): void;
  start(id: MusicId): void;
  relay(voice: Voice): void;
  fadeOut(voice: Voice, seconds: number): void;
}

const source = (id: MusicId) => "audio/" + MUSIC[id];

export const Music: MusicPlayer = {
  wanted: null,
  current: null,
  voices: [],
  master: null,
  unlocked: false,

  // Première interaction (clic, toucher, touche) : la musique demandée peut enfin démarrer
  unlock() {
    if (this.unlocked) return;
    const ctx = Sfx.audio();
    if (!ctx) return;
    this.unlocked = true;
    this.master = ctx.createGain();
    this.master.gain.value = Sfx.enabled ? CONFIG.music.volume : 0;
    this.master.connect(ctx.destination);
    if (this.wanted) this.start(this.wanted);
  },

  // Demande une piste ; si c'est déjà elle, rien ne change (elle continue d'un lieu à l'autre)
  play(id) {
    this.wanted = id;
    if (this.unlocked && this.current !== id) this.start(id);
  },

  // Silence : la piste en cours s'éteint en fondu
  stop() {
    this.wanted = null;
    this.current = null;
    for (const voice of this.voices) this.fadeOut(voice, CONFIG.music.fadeSeconds);
  },

  // Bouton son : le volume général monte ou descend en fondu court, la lecture continue en silence
  syncSound() {
    const ctx = Sfx.ctx;
    if (!this.master || !ctx) return;
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(Sfx.enabled ? CONFIG.music.volume : 0, now + CONFIG.music.muteSeconds);
  },

  // Démarre une piste en fondu ; les lectures précédentes s'éteignent pendant ce temps
  start(id) {
    const ctx = Sfx.audio();
    if (!ctx || !this.master) return;
    for (const voice of this.voices) this.fadeOut(voice, CONFIG.music.fadeSeconds);
    this.current = id;

    const audio = new Audio(source(id));
    audio.preload = "auto";
    const gain = ctx.createGain();
    ctx.createMediaElementSource(audio).connect(gain).connect(this.master);
    const voice: Voice = { audio, gain, fading: false };
    this.voices.push(voice);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + CONFIG.music.fadeSeconds);
    // Boucle : peu avant la fin, une nouvelle lecture de la même piste prend le relais en fondu enchaîné
    audio.addEventListener("timeupdate", () => {
      if (audio.duration - audio.currentTime <= CONFIG.music.loopFadeSeconds) this.relay(voice);
    });
    audio.addEventListener("ended", () => this.relay(voice));
    audio.play().catch(() => {}); // refus du navigateur : la piste repartira au prochain changement
  },

  // Relais de boucle, une seule fois par lecture, et seulement si la piste est toujours demandée
  relay(voice) {
    if (voice.fading || this.current === null) return;
    const id = this.current;
    this.current = null; // force start() à relancer la même piste
    this.start(id);
  },

  // Fondu de sortie puis arrêt et retrait de la lecture
  fadeOut(voice, seconds) {
    const ctx = Sfx.ctx;
    if (!ctx || voice.fading) return;
    voice.fading = true;
    const now = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + seconds);
    setTimeout(() => {
      voice.audio.pause();
      voice.gain.disconnect();
      this.voices = this.voices.filter(v => v !== voice);
    }, seconds * 1000 + 100);
  },
};
