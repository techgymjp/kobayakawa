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
    startCrowd();
  }

  // 兵士たちの「ワー」という鬨の声（ノイズ＋声のフォルマント）
  let crowd = null;
  function startCrowd() {
    const out = ac.createGain(); out.gain.value = 0; out.connect(master);
    const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const nf = ac.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 800; nf.Q.value = 0.8;
    const ng = ac.createGain(); ng.gain.value = 0.5;
    n.connect(nf); nf.connect(ng); ng.connect(out); n.start();
    // 「アー」の母音（第1・第2フォルマント）
    const f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 760; f1.Q.value = 4;
    const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1180; f2.Q.value = 5;
    const vg = ac.createGain(); vg.gain.value = 1.6;
    f1.connect(vg); f2.connect(vg); vg.connect(out);
    const voices = [];
    for (let i = 0; i < 12; i++) {
      const base = 130 + Math.random() * 190;
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = base;
      const lfo = ac.createOscillator(); lfo.frequency.value = 3 + Math.random() * 4;
      const lg = ac.createGain(); lg.gain.value = base * 0.03;
      lfo.connect(lg); lg.connect(o.frequency);
      const g = ac.createGain(); g.gain.value = 0;
      o.connect(g); g.connect(f1); g.connect(f2);
      o.start(); lfo.start();
      voices.push({ o, g, base });
    }
    crowd = { out, nf, voices, level: 0, boost: 0, last: 0 };
  }
  // level: 0（静か）〜1（危機）
  function setCrowd(level) {
    if (!crowd) return;
    const t = ac.currentTime;
    if (t - crowd.last < 0.15) return;
    const dt = Math.min(0.5, t - crowd.last);
    crowd.last = t;
    crowd.boost = Math.max(0, crowd.boost - dt * 0.35);
    const L = Math.min(1, Math.max(level, crowd.boost));
    crowd.level = L;
    const gain = level <= 0 && crowd.boost <= 0 ? 0 : 0.025 + Math.pow(L, 1.3) * 0.6;
    crowd.out.gain.setTargetAtTime(gain, t, 0.35);
    crowd.nf.frequency.setTargetAtTime(700 + L * 700, t, 0.4);
    for (const v of crowd.voices) {
      // 声がばらばらに上がったり途切れたり。危機ほど多く、高く叫ぶ
      if (Math.random() < 0.25 + L * 0.4) {
        const on = Math.random() < 0.35 + L * 0.6;
        v.g.gain.setTargetAtTime(on ? (0.05 + Math.random() * 0.1) : 0.005, t, 0.15 + Math.random() * 0.3);
      }
      v.o.frequency.setTargetAtTime(v.base * (1 + L * 0.35) * (0.94 + Math.random() * 0.12), t, 0.3);
    }
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
    crowd: setCrowd,
    // 一時的に「ワーッ」と沸き上がる
    swell(amt) { if (crowd) { crowd.boost = Math.max(crowd.boost, amt); crowd.last = 0; } },
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
    // 法螺貝「ブォ〜、ブォ〜、ブォオオ〜〜」 vol: 音量, pan: -1(左)〜1(右), pitch: 音高倍率
    horn(vol = 0.3, pan = 0, pitch = 1, calls = [0.55, 0.55, 1.7]) {
      if (!ac) return;
      const out = ac.createGain(); out.gain.value = vol;
      let dest = out;
      if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p); p.connect(master); }
      else out.connect(master);
      // 遠くの法螺貝ほどこもらせる
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500 + vol * 1400; lp.Q.value = 3;
      lp.connect(dest);
      let t = ac.currentTime + 0.05;
      const f0 = 118 * pitch;
      for (const dur of calls) {
        const end = t + dur;
        const o1 = ac.createOscillator(); o1.type = 'sawtooth';
        const o2 = ac.createOscillator(); o2.type = 'square';
        for (const o of [o1, o2]) {
          o.frequency.setValueAtTime(f0 * 0.8, t);
          o.frequency.exponentialRampToValueAtTime(f0, t + 0.18); // しゃくり上げ
          o.frequency.setValueAtTime(f0, end - 0.25);
          o.frequency.exponentialRampToValueAtTime(f0 * 0.86, end); // 息切れで下がる
        }
        o2.detune.value = 1200 + 6; // 1オクターブ上を少し混ぜる
        const lfo = ac.createOscillator(); lfo.frequency.value = 5.5;
        const lg = ac.createGain(); lg.gain.value = f0 * 0.012;
        lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
        g.gain.setValueAtTime(0.5, end - 0.2);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        const g2 = ac.createGain(); g2.gain.value = 0.25;
        o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp);
        // 息の音
        const n = ac.createBufferSource(); n.buffer = noiseBuf;
        const nf = ac.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = f0 * 4; nf.Q.value = 2;
        const ng = ac.createGain();
        ng.gain.setValueAtTime(0.0001, t);
        ng.gain.exponentialRampToValueAtTime(0.12, t + 0.06);
        ng.gain.exponentialRampToValueAtTime(0.0001, end);
        n.connect(nf); nf.connect(ng); ng.connect(lp);
        o1.start(t); o2.start(t); lfo.start(t); n.start(t);
        o1.stop(end + 0.05); o2.stop(end + 0.05); lfo.stop(end + 0.05); n.stop(end + 0.05);
        t = end + 0.22;
      }
    },
    fanfare() {
      [0, 0.25, 0.5, 0.9].forEach((w, i) => tone([392, 440, 523, 659][i], 0.5, 0.15, 'triangle', 1, w));
    },
    dirge() { [0, 0.6, 1.2].forEach((w, i) => tone([220, 196, 147][i], 0.9, 0.18, 'triangle', 1, w)); },
  };
})();
