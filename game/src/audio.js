// All sound is synthesised in the browser with WebAudio — no audio files.
// Engine hum, two-tone police sirens, gunshots, a lazy bass line and UI blips.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.bassStep = 0;
    this.bassTimer = null;
    this.started = false;
  }

  // Must be called from a user gesture (the Start button).
  start() {
    if (this.started) return;
    this.started = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);

    // Engine: two detuned saws through a lowpass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 55.5;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter);
    osc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    osc2.start();
    this.engineOsc2 = osc2;

    // Siren: a sine that hops between two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 740;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    let high = false;
    this.sirenTimer = setInterval(() => {
      if (!this.ctx) return;
      high = !high;
      this.sirenOsc.frequency.setTargetAtTime(high ? 960 : 700, this.ctx.currentTime, 0.05);
    }, 420);

    // Bass line: a slow A-minor groove, one note per beat.
    const notes = [55, 0, 65.4, 0, 55, 0, 82.4, 73.4, 55, 0, 65.4, 0, 49, 0, 58.3, 0];
    this.bassTimer = setInterval(() => {
      if (!this.ctx || this.muted) { this.bassStep = (this.bassStep + 1) % notes.length; return; }
      const f = notes[this.bassStep];
      this.bassStep = (this.bassStep + 1) % notes.length;
      if (!f) return;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const gn = this.ctx.createGain();
      gn.gain.setValueAtTime(0.16, this.ctx.currentTime);
      gn.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.42);
      o.connect(gn); gn.connect(this.master);
      o.start();
      o.stop(this.ctx.currentTime + 0.45);
    }, 300);
  }

  setEngine(speedNorm, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const base = driving ? 58 + speedNorm * 130 : 42;
    this.engineOsc.frequency.setTargetAtTime(base, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(base * 1.005 + 1.2, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(320 + speedNorm * 900, t, 0.1);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + speedNorm * 0.05 : 0.012, t, 0.12);
  }

  setSiren(on) {
    if (!this.ctx || !this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0.0, this.ctx.currentTime, 0.2);
  }

  gunshot() {
    if (!this.ctx) return;
    const dur = 0.16;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 2400;
    const gn = this.ctx.createGain();
    gn.gain.value = 0.5;
    src.connect(flt); flt.connect(gn); gn.connect(this.master);
    src.start();
  }

  punch() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.09);
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    o.connect(gn); gn.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + 0.11);
  }

  blip(freq = 880) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);
    o.connect(gn); gn.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + 0.15);
  }

  cash() {
    this.blip(1320);
    setTimeout(() => this.blip(1760), 90);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }
}
