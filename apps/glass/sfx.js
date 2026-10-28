// Synthesized UI sounds (Web Audio, no files). Browsers only allow audio after a user gesture,
// so SFX.unlock() is called from the first tap/click; until then every sound is a silent no-op.
window.SFX = (() => {
  let ctx = null, master = null, muted = false;

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = .5; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  const ok = () => ctx && ctx.state === 'running' && !muted;

  function tone(freq, dur, { type = 'sine', gain = .2, at = 0, slide = 0 } = {}) {
    if (!ok()) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + .005);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
  }

  function noise(dur, { gain = .25, at = 0, from = 4000, to = 400, q = .7 } = {}) {
    if (!ok()) return;
    const t = ctx.currentTime + at, len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f).connect(g).connect(master); src.start(t);
  }

  return {
    unlock,
    get ready() { return ok(); },
    set muted(v) { muted = v; },
    tap: () => tone(1800, .05, { type: 'square', gain: .05 }),
    key: () => tone(2200 + Math.random() * 900, .025, { type: 'square', gain: .025 }),
    tick: () => tone(1200, .04, { type: 'triangle', gain: .08 }),
    beep: () => tone(880, .12, { type: 'sine', gain: .12 }),
    denied: () => { tone(160, .35, { type: 'sawtooth', gain: .18 }); tone(110, .35, { type: 'square', gain: .1, at: .02 }); },
    granted: () => [660, 880, 1320].forEach((f, i) => tone(f, .25, { gain: .12, at: i * .09 })),
    whoosh: () => noise(.35, { gain: .3, from: 600, to: 5000, q: 1.2 }),
    static: (dur = .7) => noise(dur, { gain: .22, from: 3000, to: 2500, q: .2 }),
    hum: () => { tone(55, 1.6, { type: 'sawtooth', gain: .12, slide: 55 }); tone(110, 1.6, { type: 'sine', gain: .08, slide: 220 }); },
    banner: () => { tone(988, .1, { gain: .1 }); tone(1319, .18, { gain: .1, at: .1 }); },
  };
})();
