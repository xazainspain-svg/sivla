import { BAND_COUNT, BandSmoother, KickDetector, bandsFromFFT } from './bands';
import { TRACKS } from './tracks';

export type AudioMode = 'idle' | 'demo' | 'track';

export interface AudioFrame {
  bands: Float32Array;
  /** Segundos desde el último golpe de bombo (grande si no hay). */
  kickAge: number;
  /** Intensidad del último golpe 0–1. */
  kickAmt: number;
  active: boolean;
}

/**
 * Motor de audio: reproduce un tema autorizado (si lo hay) o un beat sintético de demostración,
 * y expone 8 bandas de frecuencia y detección de bombo. Nunca arranca solo: `start()` requiere un gesto.
 */
export class AudioEngine {
  mode: AudioMode = 'idle';
  trackLabel = '';
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private data = new Uint8Array(512);
  private raw = new Float32Array(BAND_COUNT);
  private smoother = new BandSmoother();
  private kick = new KickDetector();
  private kickAge = 99;
  private kickAmt = 0;
  private clock = 0;
  private volume = 0.7;
  private el: HTMLAudioElement | null = null;
  private timer = 0;
  private step = 0;
  private nextTime = 0;

  get playing(): boolean { return this.mode !== 'idle'; }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  async start(): Promise<AudioMode> {
    if (this.playing) return this.mode;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = this.ctx ?? new Ctx();
    await this.ctx.resume();
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.6;
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      this.master.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    this.master.gain.value = this.volume;
    this.smoother.reset();
    this.kickAge = 99;
    if (TRACKS.length > 0 && (await this.startTrack(TRACKS[0].src, `${TRACKS[0].title} · ${TRACKS[0].artist}`))) return this.mode;
    this.startDemo();
    return this.mode;
  }

  stop(): void {
    this.el?.pause();
    this.el = null;
    window.clearInterval(this.timer);
    this.mode = 'idle';
    this.smoother.reset();
  }

  private async startTrack(src: string, label: string): Promise<boolean> {
    try {
      const el = new Audio(src);
      el.loop = true;
      el.preload = 'auto';
      const source = this.ctx!.createMediaElementSource(el);
      source.connect(this.master!);
      await el.play();
      this.el = el;
      this.mode = 'track';
      this.trackLabel = label;
      return true;
    } catch {
      return false;
    }
  }

  /** Beat sintético original: bombo, hats, bajo y pad. 96 BPM, semicorcheas. */
  private startDemo(): void {
    this.mode = 'demo';
    this.trackLabel = 'Beat sintético de demostración';
    this.step = 0;
    this.nextTime = this.ctx!.currentTime + 0.05;
    const sp = 60 / 96 / 4;
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      const ctx = this.ctx!;
      while (this.nextTime < ctx.currentTime + 0.15) {
        const s = this.step % 16;
        if (s === 0 || s === 6 || s === 10) this.kickDrum(this.nextTime);
        if (s % 2 === 1) this.hat(this.nextTime, 0.06);
        if (s === 4 || s === 12) this.hat(this.nextTime, 0.1);
        if (s === 0 || s === 10) this.bass(this.nextTime, s === 0 ? 55 : 82.4);
        if (s === 0) this.pad(this.nextTime);
        this.nextTime += sp;
        this.step++;
      }
    }, 25);
  }

  private env(g: GainNode, t: number, a: number, v: number, r: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
  }
  private kickDrum(t: number): void {
    const c = this.ctx!, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    this.env(g, t, 0.003, 0.95, 0.4);
    o.connect(g); g.connect(this.master!); o.start(t); o.stop(t + 0.5);
  }
  private hat(t: number, v: number): void {
    const c = this.ctx!, n = c.sampleRate * 0.05, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'highpass'; f.frequency.value = 7000; g.gain.value = v;
    s.buffer = b; s.connect(f); f.connect(g); g.connect(this.master!); s.start(t);
  }
  private bass(t: number, f: number): void {
    const c = this.ctx!, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o.type = 'sine'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f;
    fl.type = 'lowpass'; fl.frequency.value = 260;
    this.env(g, t, 0.01, 0.34, 0.5);
    o.connect(g); o2.connect(fl); fl.connect(g); g.connect(this.master!);
    o.start(t); o2.start(t); o.stop(t + 0.6); o2.stop(t + 0.6);
  }
  private pad(t: number): void {
    const c = this.ctx!;
    [220, 261.63, 329.63].forEach((f) => [-6, 6].forEach((det) => {
      const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      fl.type = 'lowpass'; fl.frequency.value = 1400;
      this.env(g, t, 0.4, 0.03, 1.6);
      o.connect(fl); fl.connect(g); g.connect(this.master!); o.start(t); o.stop(t + 2.4);
    }));
  }

  /** Llamar una vez por fotograma. */
  update(dt: number): AudioFrame {
    this.clock += dt;
    if (!this.playing || !this.analyser || !this.ctx) {
      this.smoother.update(this.raw.fill(0), dt);
      this.kickAge += dt;
      return { bands: this.smoother.value, kickAge: this.kickAge, kickAmt: this.kickAmt, active: false };
    }
    this.analyser.getByteFrequencyData(this.data);
    bandsFromFFT(this.data, this.ctx.sampleRate, this.analyser.fftSize, this.raw);
    if (this.kick.detect(this.raw, this.clock, dt)) {
      this.kickAge = 0;
      this.kickAmt = Math.min(1, (this.raw[0] + this.raw[1]) / 1.4);
    } else this.kickAge += dt;
    this.smoother.update(this.raw, dt);
    return { bands: this.smoother.value, kickAge: this.kickAge, kickAmt: this.kickAmt, active: true };
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}
