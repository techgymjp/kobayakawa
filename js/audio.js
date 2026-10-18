'use strict';
// 効果音（WebAudio で手続き生成）
const Sfx = (() => {
  let ac = null, master = null, muted = false, noiseBuf = null;
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function noise(dur, freq, q, vol, type = 'bandpass', when = 0) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  function tone(freq, dur, vol, type = 'sine', slide = 0, when = 0) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  let lastHit = 0;
  return {
    init,
    get muted() { return muted; },
    toggle() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    slash() { noise(0.12, 3200, 0.8, 0.35, 'highpass'); },
    thrust() { noise(0.16, 1400, 1.5, 0.35); tone(180, 0.1, 0.1, 'triangle', 0.5); },
    hit() {
      if (!ac || ac.currentTime - lastHit < 0.03) return; lastHit = ac.currentTime;
      noise(0.08, 900, 1, 0.45); tone(120, 0.08, 0.25, 'square', 0.4);
    },
    clang() { tone(1800, 0.25, 0.12, 'triangle', 0.9); tone(2600, 0.2, 0.08, 'sine'); },
    hurt() { tone(220, 0.18, 0.25, 'sawtooth', 0.4); noise(0.1, 600, 1, 0.3); },
    gun(vol = 0.5) { noise(0.35, 500, 0.6, vol, 'lowpass'); noise(0.05, 3000, 1, vol * 0.6); },
    kill() { tone(90, 0.35, 0.4, 'sine', 0.5); noise(0.2, 400, 1, 0.3, 'lowpass'); },
    gallop() { noise(0.05, 300, 2, 0.12, 'lowpass'); },
    drum(v = 0.5) { tone(70, 0.4, v, 'sine', 0.6); noise(0.08, 200, 1, v * 0.3, 'lowpass'); },
    horn() {
      if (!ac) return;
      const t = ac.currentTime;
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(150, t);
      o.frequency.linearRampToValueAtTime(220, t + 0.4);
      o.frequency.setValueAtTime(220, t + 1.4);
      o.frequency.linearRampToValueAtTime(180, t + 1.9);
      const lfo = ac.createOscillator(); lfo.frequency.value = 5;
      const lg = ac.createGain(); lg.gain.value = 4; lfo.connect(lg); lg.connect(o.frequency);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.3);
      g.gain.setValueAtTime(0.25, t + 1.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); lfo.start(t); o.stop(t + 2.2); lfo.stop(t + 2.2);
    },
    fanfare() {
      [0, 0.25, 0.5, 0.9].forEach((w, i) => tone([392, 440, 523, 659][i], 0.5, 0.15, 'triangle', 1, w));
    },
    dirge() { [0, 0.6, 1.2].forEach((w, i) => tone([220, 196, 147][i], 0.9, 0.18, 'triangle', 1, w)); },
  };
})();
