class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.buffers = {};
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.ctx = new AudioContext();
      this.enabled = true;
      this.loadAudioFiles();
    }
  }

  async loadAudioFiles() {
    if (!this.ctx) return;
    const files = {
      shot: './assets/audio/laserSmall_000.ogg',
      shotgun: './assets/audio/laserLarge_000.ogg',
      explosion: './assets/audio/explosionCrunch_000.ogg',
      hit: './assets/audio/impactMetal_000.ogg',
      kill: './assets/audio/impactMetal_heavy_000.ogg'
    };

    for (const [key, url] of Object.entries(files)) {
      try {
        const res = await fetch(url);
        const arrayBuf = await res.arrayBuffer();
        const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
        this.buffers[key] = audioBuf;
      } catch (e) {
        // Fallback to synth if audio load fails
      }
    }
  }

  playBuffer(key, volume = 1.0) {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    const buf = this.buffers[key];
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      src.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(0);
      return;
    }
    // Fallback synth
    this.synthFallback(key);
  }

  synthFallback(type) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    if (type === 'shot') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'explosion') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'hit') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  }

  shot(weaponId) {
    const key = weaponId === 'shotgun' || weaponId === 'needle' ? 'shotgun' : 'shot';
    this.playBuffer(key, 0.4);
  }

  hit(isHeadshot) {
    this.playBuffer('hit', isHeadshot ? 0.6 : 0.4);
  }

  kill() {
    this.playBuffer('kill', 0.7);
  }

  explosion() {
    this.playBuffer('explosion', 0.8);
  }

  ui() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  roundEnd(won) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    if (won) {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.15);
      osc.frequency.setValueAtTime(659.25, now + 0.3);
    } else {
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.setValueAtTime(250, now + 0.15);
      osc.frequency.setValueAtTime(200, now + 0.3);
    }
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.6);
    osc.start(now);
    osc.stop(now + 0.6);
  }
}

export const audio = new SoundEngine();
