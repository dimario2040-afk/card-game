/**
 * AudioManager.ts — Procedural sound effects via Web Audio API.
 *
 * Every sound is synthesised at runtime from oscillators, noise buffers,
 * and filter networks.  No external audio files are loaded.
 *
 * Usage:
 *   import { audioManager } from './AudioManager';
 *   audioManager.playCardFlip();
 *   audioManager.toggleMute();
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Create a small buffer filled with white noise (values in [-1, 1]). */
function makeNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * durationSec);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

/** Quick gain envelope: attack then exponential decay. */
function envelope(
  gain: GainNode,
  when: number,
  attackSec: number,
  peak: number,
  decaySec: number,
): void {
  gain.gain.setValueAtTime(0.001, when);
  gain.gain.linearRampToValueAtTime(peak, when + attackSec);
  gain.gain.exponentialRampToValueAtTime(0.001, when + attackSec + decaySec);
}

// ---------------------------------------------------------------------------
// AudioManager
// ---------------------------------------------------------------------------

class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private _muted = false;

  private constructor() {
    /* singleton — use getInstance() */
  }

  // ---- singleton access ---------------------------------------------------

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  // ---- mute ---------------------------------------------------------------

  get muted(): boolean {
    return this._muted;
  }

  set muted(v: boolean) {
    this._muted = v;
  }

  /** Toggle the muted flag.  Returns the **new** muted state. */
  toggleMute(): boolean {
    this._muted = !this._muted;
    return this._muted;
  }

  // ---- context management -------------------------------------------------

  /**
   * Ensure an active AudioContext exists.
   * Returns `null` when muted or when the browser doesn't support the API.
   */
  private ensureContext(): AudioContext | null {
    if (this._muted) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  // ---- sound effects ------------------------------------------------------

  /**
   * Card flip — short filtered noise burst.
   * Simulates the snap of a card being turned over.
   */
  playCardFlip(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.06;

    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, duration);

    const gain = ctx.createGain();
    envelope(gain, now, 0.002, 0.28, duration - 0.002);

    // Band-pass around 3 kHz gives the "card" character
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3000;
    bp.Q.value = 1.4;

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);
  }

  /**
   * Card play — ascending sine tone.
   * A gentle swoosh that signals a card entering the board.
   */
  playCardPlay(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.3;

    const osc = ctx.createOscillator();
    osc.type = 'sine';

    const gain = ctx.createGain();
    envelope(gain, now, 0.03, 0.14, duration - 0.03);

    // Pitch rises from ~300 → ~900 Hz
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + duration * 0.7);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Damage — low-frequency thud.
   * A short, percussive hit centred around 80–120 Hz.
   */
  playDamage(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.25;

    // Main thud oscillator
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + duration);

    const gain = ctx.createGain();
    envelope(gain, now, 0.004, 0.3, duration - 0.004);

    // Subtle noise layer for impact texture
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.06);

    const noiseLp = ctx.createBiquadFilter();
    noiseLp.type = 'lowpass';
    noiseLp.frequency.value = 400;

    const noiseGain = ctx.createGain();
    envelope(noiseGain, now, 0.001, 0.08, 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    noise.connect(noiseLp);
    noiseLp.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
    noise.start(now);
    noise.stop(now + 0.06);
  }

  /**
   * Critical hit — sharp impact + pseudo-reverb + low thud.
   * Combines a sawtooth burst, noise, and a feedback delay network for
   * a dramatic, powerful sound.
   */
  playCriticalHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.6;

    // --- impact (sawtooth burst) ---
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);

    const gain = ctx.createGain();
    envelope(gain, now, 0.003, 0.35, 0.25);

    // --- low thud (damage-like bottom) ---
    const thudOsc = ctx.createOscillator();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(90, now);
    thudOsc.frequency.exponentialRampToValueAtTime(25, now + duration);

    const thudGain = ctx.createGain();
    envelope(thudGain, now, 0.005, 0.28, duration - 0.005);

    // --- noise layer ---
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoiseBuffer(ctx, 0.12);

    const noiseHp = ctx.createBiquadFilter();
    noiseHp.type = 'highpass';
    noiseHp.frequency.value = 2000;

    const noiseGain = ctx.createGain();
    envelope(noiseGain, now, 0.001, 0.18, 0.1);

    // --- feedback delay (pseudo-reverb) ---
    const delay = ctx.createDelay(0.3);
    delay.delayTime.value = 0.1;

    const feedback = ctx.createGain();
    feedback.gain.value = 0.45;

    const wet = ctx.createGain();
    wet.gain.value = 0.4;

    // --- connect dry ---
    osc.connect(gain);
    thudOsc.connect(thudGain);
    noise.connect(noiseHp);
    noiseHp.connect(noiseGain);

    gain.connect(ctx.destination);
    thudGain.connect(ctx.destination);
    noiseGain.connect(ctx.destination);

    // --- connect reverb send ---
    gain.connect(wet);
    thudGain.connect(wet);
    noiseGain.connect(wet);

    wet.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    feedback.connect(ctx.destination);

    // --- schedule ---
    osc.start(now);
    osc.stop(now + 0.3);
    thudOsc.start(now);
    thudOsc.stop(now + duration);
    noise.start(now);
    noise.stop(now + 0.12);
  }

  /**
   * Ability chord — C-major triad (C4, E4, G4) with staggered entry.
   * Each voice enters with a slight delay for a "strum" feel.
   */
  playAbilityChord(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.7;

    // C4, E4, G4
    const freqs = [261.63, 329.63, 392.0];
    const perVoiceGain = 0.075;
    const stagger = 0.035;

    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      // Outer voices sine, middle triangle for harmonic warmth
      osc.type = i === 1 ? 'triangle' : 'sine';
      osc.frequency.value = freqs[i];

      const g = ctx.createGain();
      const t0 = now + i * stagger;

      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(perVoiceGain, t0 + 0.04);
      g.gain.linearRampToValueAtTime(perVoiceGain * 0.55, t0 + 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      osc.connect(g);
      g.connect(ctx.destination);

      osc.start(t0);
      osc.stop(t0 + duration);
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience singleton export
// ---------------------------------------------------------------------------

const audioManager = AudioManager.getInstance();

export { AudioManager, audioManager };
