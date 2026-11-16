// Tiny procedural sound kit. No audio assets: every effect is synthesized so
// the game remains a self-contained static folder with no network requests.
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.34;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(freq, dur, type = 'sine', gain = 0.16, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  noise(dur, gain = 0.2, low = 500, high = 3200) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(high, t);
    bp.frequency.exponentialRampToValueAtTime(low, t + dur);
    bp.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  shot(kind = 'rifle', distance = 0) {
    const scale = Math.max(0.25, 1 - distance / 70);
    if (kind === 'shotgun') { this.noise(0.22, 0.5 * scale, 250, 1600); this.tone(95, 0.16, 'triangle', 0.28 * scale, -45); }
    else if (kind === 'needle') { this.noise(0.3, 0.42 * scale, 400, 5200); this.tone(1450, 0.2, 'sawtooth', 0.1 * scale, -1050); }
    else if (kind === 'smg') { this.noise(0.09, 0.3 * scale, 600, 3600); this.tone(170, 0.07, 'square', 0.08 * scale, -70); }
    else { this.noise(0.13, 0.36 * scale, 420, 2800); this.tone(130, 0.1, 'triangle', 0.13 * scale, -55); }
  }

  empty() { this.tone(1150, 0.045, 'square', 0.07); }
  reload() { this.tone(340, 0.06, 'square', 0.07); setTimeout(() => this.tone(520, 0.07, 'square', 0.08), 130); }
  swing() { this.noise(0.13, 0.18, 700, 2200); this.tone(280, 0.08, 'triangle', 0.1, -140); }
  // Hit confirmation is deliberately layered so a hit is audible even when
  // the marker is missed: body = double tick, head = bright two-note ding.
  hit(head = false) {
    this.tone(1900, 0.05, 'square', 0.1, -500);
    setTimeout(() => this.tone(1450, 0.045, 'square', 0.07, -350), 28);
    if (head) {
      this.tone(2520, 0.09, 'sine', 0.14);
      setTimeout(() => this.tone(3360, 0.11, 'sine', 0.11), 40);
    }
  }
  throwIt() { this.noise(0.14, 0.1, 700, 2600); this.tone(500, 0.07, 'triangle', 0.06, 260); }
  scopeClick() { this.tone(880, 0.03, 'square', 0.05); setTimeout(() => this.tone(1170, 0.03, 'square', 0.045), 35); }
  boom(distance = 0) {
    const scale = Math.max(0.2, 1 - distance / 55);
    this.noise(0.55, 0.62 * scale, 60, 900);
    this.tone(72, 0.5, 'sine', 0.5 * scale, -38);
    setTimeout(() => this.noise(0.28, 0.22 * scale, 200, 1400), 45);
  }
  kill() { this.tone(740, 0.09, 'triangle', 0.15, 280); setTimeout(() => this.tone(1180, 0.1, 'triangle', 0.12, 120), 65); }
  hurt() { this.tone(120, 0.13, 'sawtooth', 0.12, -45); this.noise(0.08, 0.08, 300, 900); }
  buy() { this.tone(660, 0.07, 'triangle', 0.12); setTimeout(() => this.tone(990, 0.09, 'triangle', 0.12), 70); }
  round(win) { this.tone(win ? 523 : 220, 0.16, 'triangle', 0.14); setTimeout(() => this.tone(win ? 784 : 165, 0.22, 'triangle', 0.13), 130); }
  captureTick() { this.tone(1250, 0.035, 'sine', 0.045); }
  match(win) { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.tone(win ? f : 880 - i * 110, 0.24, 'triangle', 0.13), i * 120)); }
}
