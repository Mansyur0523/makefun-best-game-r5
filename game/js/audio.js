// audio.js — every sound is synthesised with WebAudio: no audio files, no network.
// Short oscillator/noise blips for actions, and a slow ambient pad + plucked melody
// that keeps the reef at dusk humming underneath the fight.

/** Master volumes (0..1). Music stays quiet so effects cut through it. */
const MASTER_GAIN = 0.5;
const MUSIC_GAIN = 0.12;
const SFX_GAIN = 0.5;

/** Chord pad roots (Hz) for the ambient loop — A minor, F, C, G, dusk-warm. */
const PAD_CHORDS = [
  [110.0, 164.81, 220.0, 261.63],
  [87.31, 174.61, 220.0, 261.63],
  [130.81, 196.0, 261.63, 329.63],
  [98.0, 146.83, 196.0, 293.66],
];
/** Pentatonic pluck notes (Hz) the melody draws from. */
const PLUCK_NOTES = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];

/** Synthesised sound engine: lazy AudioContext, unlocked on the first gesture. */
export class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.muted = false;
    this.musicTimer = null;
    this.chordIndex = 0;
    this.noiseBuffer = null;
    this.started = false;
  }

  /** Create the context (call from a user gesture; safe to call twice). */
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = MASTER_GAIN;
      this.master.connect(this.context.destination);
      this.musicBus = this.context.createGain();
      this.musicBus.gain.value = MUSIC_GAIN;
      this.musicBus.connect(this.master);
      this.sfxBus = this.context.createGain();
      this.sfxBus.gain.value = SFX_GAIN;
      this.sfxBus.connect(this.master);
      const length = this.context.sampleRate;
      this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch (error) {
      this.context = null;
    }
  }

  /** True once a context exists and is running. */
  get ready() {
    return Boolean(this.context && this.context.state === 'running');
  }

  /** Toggle mute; returns the new muted state. */
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
    return this.muted;
  }

  /** One oscillator blip with an exponential decay envelope. */
  _tone({ type = 'sine', from = 440, to = null, duration = 0.15, volume = 0.5, when = 0, bus = null }) {
    if (!this.ready) return;
    const t0 = this.context.currentTime + when;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(bus || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** Filtered noise burst (splashes, explosions, the wave horn's breath). */
  _noise({ duration = 0.2, volume = 0.4, frequency = 1200, type = 'lowpass', when = 0 }) {
    if (!this.ready || !this.noiseBuffer) return;
    const t0 = this.context.currentTime + when;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    source.start(t0);
    source.stop(t0 + duration + 0.02);
  }

  /** Harpoon release: a short bright snap. */
  playShoot() {
    this._tone({ type: 'square', from: 920, to: 320, duration: 0.08, volume: 0.22 });
  }

  /** Scatter net: a soft whoosh of five pellets. */
  playScatter() {
    this._noise({ duration: 0.16, volume: 0.22, frequency: 2600, type: 'bandpass' });
    this._tone({ type: 'triangle', from: 420, to: 180, duration: 0.12, volume: 0.2 });
  }

  /** Ember lance: a hot, piercing zap. */
  playLance() {
    this._tone({ type: 'sawtooth', from: 1400, to: 240, duration: 0.18, volume: 0.25 });
    this._tone({ type: 'sine', from: 2100, to: 500, duration: 0.1, volume: 0.12 });
  }

  /** A hit lands: a dull thud, pitch varies with damage. */
  playHit(hard = false) {
    this._tone({ type: 'triangle', from: hard ? 300 : 220, to: 90, duration: 0.09, volume: hard ? 0.4 : 0.28 });
  }

  /** An enemy pops: wet burst + low thump. */
  playPop() {
    this._noise({ duration: 0.18, volume: 0.3, frequency: 900 });
    this._tone({ type: 'sine', from: 260, to: 50, duration: 0.16, volume: 0.35 });
  }

  /** A coin is picked up: a bright two-note chime, pitch climbs with the combo. */
  playCoin(combo = 0) {
    const step = Math.min(combo, 12);
    const base = 880 * Math.pow(1.059463, step);
    this._tone({ type: 'sine', from: base, duration: 0.09, volume: 0.22 });
    this._tone({ type: 'sine', from: base * 1.5, duration: 0.12, volume: 0.18, when: 0.05 });
  }

  /** The player is hurt: a low, ugly buzz. */
  playHurt() {
    this._tone({ type: 'sawtooth', from: 180, to: 60, duration: 0.25, volume: 0.4 });
    this._noise({ duration: 0.2, volume: 0.25, frequency: 500 });
  }

  /** Dash: a quick airy sweep. */
  playDash() {
    this._noise({ duration: 0.18, volume: 0.25, frequency: 1800, type: 'bandpass' });
    this._tone({ type: 'sine', from: 300, to: 700, duration: 0.12, volume: 0.12 });
  }

  /** Wave horn: a deep two-note call that opens every night. */
  playHorn() {
    this._tone({ type: 'sawtooth', from: 98, duration: 0.7, volume: 0.3 });
    this._tone({ type: 'sawtooth', from: 146.83, duration: 0.7, volume: 0.22, when: 0.02 });
    this._tone({ type: 'sawtooth', from: 196, duration: 0.9, volume: 0.2, when: 0.35 });
    this._noise({ duration: 0.8, volume: 0.08, frequency: 400 });
  }

  /** Boss roar: a low growl that bends downward. */
  playRoar() {
    this._tone({ type: 'sawtooth', from: 90, to: 38, duration: 0.9, volume: 0.5 });
    this._tone({ type: 'sawtooth', from: 135, to: 55, duration: 0.8, volume: 0.3, when: 0.05 });
    this._noise({ duration: 0.9, volume: 0.3, frequency: 300 });
  }

  /** Buying an upgrade: a satisfying coin-stack arpeggio. */
  playBuy() {
    this._tone({ type: 'sine', from: 523.25, duration: 0.1, volume: 0.25 });
    this._tone({ type: 'sine', from: 659.25, duration: 0.1, volume: 0.25, when: 0.07 });
    this._tone({ type: 'sine', from: 783.99, duration: 0.16, volume: 0.25, when: 0.14 });
  }

  /** A purchase that cannot be afforded: a flat buzz. */
  playDenied() {
    this._tone({ type: 'square', from: 160, to: 120, duration: 0.14, volume: 0.2 });
  }

  /** Wave cleared: a warm little fanfare. */
  playWaveClear() {
    const notes = [392.0, 523.25, 659.25, 783.99];
    notes.forEach((note, i) => {
      this._tone({ type: 'triangle', from: note, duration: 0.22, volume: 0.22, when: i * 0.09 });
    });
  }

  /** Victory: a rising, hopeful arpeggio. */
  playVictory() {
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((note, i) => {
      this._tone({ type: 'triangle', from: note, duration: 0.3, volume: 0.24, when: i * 0.11 });
    });
  }

  /** Defeat: a slow descending line. */
  playDefeat() {
    const notes = [392.0, 329.63, 261.63, 196.0, 130.81];
    notes.forEach((note, i) => {
      this._tone({ type: 'sine', from: note, duration: 0.4, volume: 0.22, when: i * 0.18 });
    });
  }

  /** One pad chord, held for several seconds, on the music bus. */
  _playPadChord(notes) {
    if (!this.ready) return;
    notes.forEach((freq) => {
      this._tone({ type: 'triangle', from: freq, duration: 5.5, volume: 0.06, bus: this.musicBus });
      this._tone({ type: 'sine', from: freq * 2, duration: 5.5, volume: 0.025, bus: this.musicBus });
    });
  }

  /** One sparse plucked melody note on the music bus. */
  _playPluck(freq) {
    this._tone({ type: 'sine', from: freq, duration: 1.1, volume: 0.07, bus: this.musicBus });
    this._tone({ type: 'sine', from: freq * 2, duration: 0.5, volume: 0.02, bus: this.musicBus });
  }

  /** Start the ambient loop: a pad chord every 6 s, a pluck every ~2 s. */
  startMusic() {
    if (this.started || !this.context) return;
    this.started = true;
    const tick = () => {
      if (!this.ready) return;
      this._playPadChord(PAD_CHORDS[this.chordIndex % PAD_CHORDS.length]);
      this.chordIndex += 1;
    };
    tick();
    this.musicTimer = window.setInterval(() => {
      tick();
      if (Math.random() < 0.75) {
        const note = PLUCK_NOTES[Math.floor(Math.random() * PLUCK_NOTES.length)];
        this._playPluck(note);
      }
    }, 6000);
  }

  /** Stop the ambient loop. */
  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.started = false;
  }
}
