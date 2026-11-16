// Procedural and file-based sound kit.
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.buffers = new Map();
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

  loadBuffer(url) {
    if (this.buffers.has(url)) return this.buffers.get(url);
    const p = fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => this.ctx.decodeAudioData(data))
      .then((buf) => {
        this.buffers.set(url, buf);
        return buf;
      })
      .catch(() => {
        this.buffers.set(url, null);
        return null;
      });
    this.buffers.set(url, p);
    return p;
  }

  playFile(url, volume = 0.4, distance = 0, maxDist = 70) {
    if (!this.ctx) return false;
    const cached = this.buffers.get(url);
    if (!cached) {
      this.loadBuffer(url);
      return false;
    }
    if (cached instanceof Promise) {
      return false;
    }
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = cached;
    const g = this.ctx.createGain();
    const scale = Math.max(0.2, 1 - distance / maxDist);
    g.gain.setValueAtTime(volume * scale, t);
    src.connect(g).connect(this.master);
    src.start(t);
    return true;
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
    const isLarge = kind === 'needle' || kind === 'shotgun';
    const url = isLarge ? 'assets/audio/laserLarge_000.ogg' : 'assets/audio/laserSmall_000.ogg';
    const played = this.playFile(url, isLarge ? 0.55 : 0.45, distance, 70);
    if (!played) {
      const scale = Math.max(0.25, 1 - distance / 70);
      if (kind === 'shotgun') { this.noise(0.22, 0.5 * scale, 250, 1600); this.tone(95, 0.16, 'triangle', 0.28 * scale, -45); }
      else if (kind === 'needle') { this.noise(0.3, 0.42 * scale, 400, 5200); this.tone(1450, 0.2, 'sawtooth', 0.1 * scale, -1050); }
      else if (kind === 'smg') { this.noise(0.09, 0.3 * scale, 600, 3600); this.tone(170, 0.07, 'square', 0.08 * scale, -70); }
      else { this.noise(0.13, 0.36 * scale, 420, 2800); this.tone(130, 0.1, 'triangle', 0.13 * scale, -55); }
    }
  }

  empty() { this.tone(1150, 0.045, 'square', 0.07); }
  reload() { this.tone(340, 0.06, 'square', 0.07); setTimeout(() => this.tone(520, 0.07, 'square', 0.08), 130); }

  hit(head = false) {
    const played = this.playFile('assets/audio/impactMetal_000.ogg', 0.4, 0, 50);
    if (!played || head) {
      this.tone(1900, 0.05, 'square', 0.1, -500);
      setTimeout(() => this.tone(1450, 0.045, 'square', 0.07, -350), 28);
      if (head) {
        this.tone(2520, 0.09, 'sine', 0.14);
        setTimeout(() => this.tone(3360, 0.11, 'sine', 0.11), 40);
      }
    }
  }

  throwIt() { this.noise(0.14, 0.1, 700, 2600); this.tone(500, 0.07, 'triangle', 0.06, 260); }
  scopeClick() { this.tone(880, 0.03, 'square', 0.05); setTimeout(() => this.tone(1170, 0.03, 'square', 0.045), 35); }

  boom(distance = 0) {
    const p1 = this.playFile('assets/audio/explosionCrunch_000.ogg', 0.5, distance, 55);
    const p2 = this.playFile('assets/audio/lowFrequency_explosion_000.ogg', 0.5, distance, 55);
    if (!p1 && !p2) {
      const scale = Math.max(0.2, 1 - distance / 55);
      this.noise(0.55, 0.62 * scale, 60, 900);
      this.tone(72, 0.5, 'sine', 0.5 * scale, -38);
      setTimeout(() => this.noise(0.28, 0.22 * scale, 200, 1400), 45);
    }
  }

  kill() {
    const played = this.playFile('assets/audio/impactMetal_heavy_000.ogg', 0.5, 0, 60);
    if (!played) {
      this.tone(740, 0.09, 'triangle', 0.15, 280); setTimeout(() => this.tone(1180, 0.1, 'triangle', 0.12, 120), 65);
    }
  }

  hurt() { this.tone(120, 0.13, 'sawtooth', 0.12, -45); this.noise(0.08, 0.08, 300, 900); }
  buy() { this.tone(660, 0.07, 'triangle', 0.12); setTimeout(() => this.tone(990, 0.09, 'triangle', 0.12), 70); }
  round(win) { this.tone(win ? 523 : 220, 0.16, 'triangle', 0.14); setTimeout(() => this.tone(win ? 784 : 165, 0.22, 'triangle', 0.13), 130); }
  captureTick() { this.tone(1250, 0.035, 'sine', 0.045); }
  match(win) { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.tone(win ? f : 880 - i * 110, 0.24, 'triangle', 0.13), i * 120)); }
}
