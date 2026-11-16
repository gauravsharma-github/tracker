// Alarm, reminder and ambient focus sounds, all synthesised with Web Audio (no audio files).
(function (TI) {
  let ctx = null;
  let ambient = null; // { id, nodes: [], gain }

  function ac() {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, { type = 'sine', vol = 0.3, attack = 0.01 } = {}) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime + start);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
  }

  const ALARMS = {
    bell: (v) => { [0, 1.1, 2.2].forEach((t) => { tone(880, t, 1.6, { vol: 0.35 * v }); tone(1760, t, 0.9, { vol: 0.12 * v }); tone(2640, t, 0.5, { vol: 0.05 * v }); }); },
    chime: (v) => { [[659.3, 0], [784, 0.25], [987.8, 0.5], [1318.5, 0.75]].forEach(([f, t]) => tone(f, t, 1.4, { vol: 0.28 * v })); },
    digital: (v) => { for (let i = 0; i < 3; i++) { [0, 0.16].forEach((d) => tone(1046.5, i * 0.7 + d, 0.11, { type: 'square', vol: 0.1 * v, attack: 0.003 })); } },
    soft: (v) => { tone(740, 0, 0.6, { vol: 0.18 * v }); tone(988, 0.18, 0.8, { vol: 0.14 * v }); },
  };

  function noiseBuffer(c, kind) {
    const len = c.sampleRate * 4; const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
    let last = 0; let b0 = 0; let b1 = 0; let b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else if (kind === 'pink') { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 0.9; } else d[i] = w * 0.5;
    }
    return buf;
  }

  function startAmbient(id, vol = 0.45) {
    stopAmbient();
    if (!id || id === 'off') return;
    const c = ac(); if (!c) return;
    const gain = c.createGain(); gain.gain.value = vol * 0.6; gain.connect(c.destination);
    const nodes = [];
    const loop = (kind) => { const s = c.createBufferSource(); s.buffer = noiseBuffer(c, kind); s.loop = true; nodes.push(s); return s; };
    if (id === 'white') { const s = loop('white'); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 9000; s.connect(f).connect(gain); s.start(); nodes.push(f); }
    if (id === 'brown') { const s = loop('brown'); s.connect(gain); s.start(); }
    if (id === 'rain') {
      const s = loop('pink'); const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000; s.connect(hp).connect(lp).connect(gain); s.start(); nodes.push(hp, lp);
    }
    if (id === 'waves') {
      const s = loop('brown'); const g2 = c.createGain(); g2.gain.value = 0.5;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.09; const lfoG = c.createGain(); lfoG.gain.value = 0.45;
      lfo.connect(lfoG).connect(g2.gain); s.connect(g2).connect(gain); s.start(); lfo.start(); nodes.push(g2, lfo, lfoG);
    }
    if (id === 'tick') {
      const iv = setInterval(() => { tone(2000, 0, 0.03, { type: 'square', vol: 0.05 * vol, attack: 0.001 }); }, 1000);
      nodes.push({ stop: () => clearInterval(iv), disconnect: () => {} });
    }
    ambient = { id, nodes, gain };
  }
  function stopAmbient() {
    if (!ambient) return;
    ambient.nodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) { /* ignore */ } try { n.disconnect && n.disconnect(); } catch (e) { /* ignore */ } });
    try { ambient.gain.disconnect(); } catch (e) { /* ignore */ }
    ambient = null;
  }
  function setAmbientVolume(v) { if (ambient && ambient.gain) ambient.gain.gain.value = v * 0.6; }

  TI.sound = {
    alarm(id, vol = 0.8) { ac(); (ALARMS[id] || ALARMS.bell)(vol); },
    reminder() { ALARMS.soft(0.6); },
    tap() { tone(1200, 0, 0.05, { vol: 0.04, attack: 0.002 }); },
    startAmbient, stopAmbient, setAmbientVolume,
    get ambientId() { return ambient ? ambient.id : 'off'; },
    unlock() { ac(); },
  };
})(window.TI);
