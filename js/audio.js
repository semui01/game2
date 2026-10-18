// Synthesised sound effects (no audio files) and German speech.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.on = true;
  }

  // Browsers only allow audio after a user gesture, so this runs on the first touch.
  unlock() {
    if (!this.ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch {
        return;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  tone(freq, dur, { type = 'sine', gain = 0.12, at = 0, to = null } = {}) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, { gain = 0.08, at = 0, freq = 1800 } = {}) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + at;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  // Each tile added to the chain plays one step higher.
  select(i) {
    this.tone(523 * 2 ** ((i * 2) / 12), 0.09, { type: 'triangle', gain: 0.1 });
  }

  valid(n) {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    for (let i = 0; i < Math.min(n, notes.length); i++) this.tone(notes[i], 0.16, { type: 'triangle', gain: 0.09, at: i * 0.06 });
  }

  pop(i = 0) {
    this.tone(880 + i * 60, 0.07, { type: 'sine', gain: 0.07, to: 220 });
  }

  invalid() {
    this.tone(220, 0.14, { type: 'square', gain: 0.05 });
    this.tone(175, 0.2, { type: 'square', gain: 0.05, at: 0.11 });
  }

  blast() {
    this.noise(0.45, { gain: 0.12, freq: 900 });
    this.tone(160, 0.35, { type: 'sawtooth', gain: 0.05, to: 60 });
  }

  special() {
    this.tone(784, 0.12, { type: 'triangle', gain: 0.08 });
    this.tone(1175, 0.2, { type: 'triangle', gain: 0.08, at: 0.08 });
  }

  win() {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', gain: 0.1, at: i * 0.12 }));
  }

  lose() {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, { type: 'sine', gain: 0.1, at: i * 0.18 }));
  }
}

let voice = null;
function germanVoice() {
  if (voice) return voice;
  const voices = globalThis.speechSynthesis?.getVoices?.() || [];
  voice = voices.find(v => v.lang === 'de-DE') || voices.find(v => v.lang?.startsWith('de')) || null;
  return voice;
}

export const canSpeak = () => typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance !== 'undefined';

export function speak(text) {
  if (!canSpeak()) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    u.rate = 0.92;
    const v = germanVoice();
    if (v) u.voice = v;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    // Speech is a nice extra; the game works without it.
  }
}
