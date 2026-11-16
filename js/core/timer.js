// Pomodoro / stopwatch engine. One timer for the whole app; survives page reloads.
// Completed focus time is saved as a study session (store.actions.logSession).
(function (TI) {
  const U = TI.util;
  const KEY = 'timer';
  const changeFns = new Set();
  const tickFns = new Set();
  const settings = () => TI.store.state.settings;
  const lenOf = (phase) => {
    const st = settings();
    return Math.round((phase === 'focus' ? st.focusMin : phase === 'short' ? st.shortMin : st.longMin) * 60);
  };
  const fresh = (keep = {}) => ({ mode: 'pomodoro', phase: 'focus', status: 'idle', subjectId: null, nodeId: null, cycle: 1, phaseLen: 0, startedAt: 0, acc: 0, phaseStartedAt: 0, ...keep });

  let s = Object.assign(fresh(), TI.storage.get(KEY, {}));
  const save = () => TI.storage.set(KEY, s);
  const changed = () => { save(); changeFns.forEach((f) => f(s)); };

  function elapsed() { return s.acc + (s.status === 'running' ? (Date.now() - s.startedAt) / 1000 : 0); }
  function phaseLen() { return s.status === 'idle' ? lenOf(s.phase) : s.phaseLen || lenOf(s.phase); }
  function remaining() { return phaseLen() - elapsed(); }

  function ambientOn() { const st = settings(); if (s.phase === 'focus' && st.ambient && st.ambient !== 'off') TI.sound.startAmbient(st.ambient, st.ambientVolume); }
  function ambientOff() { TI.sound.stopAmbient(); }

  function askNotify() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { /* ignore */ } }
  function notify(title, body) {
    try { if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: 'assets/logo.svg', silent: true }); } catch (e) { /* ignore */ }
  }

  function logFocus(sec, manualEnd) {
    if (!s.subjectId || sec < 60) return null;
    const subj = TI.store.sel.subject(s.subjectId);
    if (!subj) return null;
    const start = s.phaseStartedAt || (Date.now() - sec * 1000);
    const sess = TI.store.actions.logSession({ subjectId: s.subjectId, nodeId: s.nodeId, start, duration: sec, mode: s.mode });
    if (sess && TI.ui && TI.ui.toast) TI.ui.toast(`${manualEnd ? 'Saved' : 'Session complete'} · ${U.fmtDur(sec, { short: true })} of ${subj.name}`, { icon: 'check_circle' });
    return sess;
  }

  const api = {
    get state() { return s; },
    elapsed, remaining, phaseLen,
    isActive() { return s.status !== 'idle'; },
    onChange(fn) { changeFns.add(fn); return () => changeFns.delete(fn); },
    onTick(fn) { tickFns.add(fn); return () => tickFns.delete(fn); },

    setTarget(subjectId, nodeId = null) {
      if (s.status !== 'idle' && s.subjectId && subjectId !== s.subjectId) return false;
      if (s.subjectId === subjectId && s.nodeId === nodeId) return true;
      s.subjectId = subjectId; s.nodeId = nodeId; changed(); return true;
    },
    setMode(mode) { if (s.status !== 'idle') return; s.mode = mode; s.phase = 'focus'; changed(); },
    start(subjectId, nodeId) {
      if (subjectId && !api.setTarget(subjectId, nodeId === undefined ? s.nodeId : nodeId)) return false;
      if (!s.subjectId) return false;
      TI.sound.unlock(); askNotify();
      if (s.status === 'running') return true;
      if (s.status === 'idle') { s.phaseLen = s.mode === 'pomodoro' ? lenOf(s.phase) : 0; s.acc = 0; s.phaseStartedAt = Date.now(); }
      s.startedAt = Date.now(); s.status = 'running';
      ambientOn(); changed(); return true;
    },
    pause() { if (s.status !== 'running') return; s.acc = elapsed(); s.status = 'paused'; ambientOff(); changed(); },
    toggle(subjectId, nodeId) { if (s.status === 'running') api.pause(); else api.start(subjectId, nodeId); },
    // Stop and save the focus time so far
    stop() {
      const sec = Math.floor(elapsed());
      if (s.phase === 'focus' && s.status !== 'idle') logFocus(s.mode === 'pomodoro' ? Math.min(sec, phaseLen()) : sec, true);
      ambientOff();
      s = fresh({ mode: s.mode, subjectId: s.subjectId, nodeId: s.nodeId, cycle: s.phase === 'focus' ? s.cycle : s.cycle });
      changed();
    },
    // Throw away the running phase without saving
    discard() { ambientOff(); s = fresh({ mode: s.mode, subjectId: s.subjectId, nodeId: s.nodeId, cycle: s.cycle }); changed(); },
    skip() {
      if (s.mode !== 'pomodoro') return api.stop();
      if (s.phase === 'focus' && s.status !== 'idle') logFocus(Math.floor(Math.min(elapsed(), phaseLen())), true);
      advance(false);
    },
    reset() { ambientOff(); s = fresh(); changed(); },
    // For the UI
    view() {
      const st = settings(); const len = phaseLen(); const el = elapsed();
      const pomo = s.mode === 'pomodoro';
      const rem = Math.max(0, len - el);
      return {
        s, pomo, len, elapsed: el, remaining: rem,
        big: pomo ? U.fmtClock(rem) : U.fmtClock(el),
        small: pomo ? U.fmtClock(el) : `Goal ${U.fmtMin(st.focusMin)}`,
        frac: pomo ? (len ? rem / len : 1) : ((el % 3600) / 3600) || (s.status === 'idle' ? 1 : 0),
        phaseLabel: !pomo ? 'stopwatch' : s.phase === 'focus' ? 'focus mode' : s.phase === 'short' ? 'short break' : 'long break',
        running: s.status === 'running', paused: s.status === 'paused', idle: s.status === 'idle',
      };
    },
  };

  function advance(fromComplete) {
    const st = settings();
    let next;
    if (s.phase === 'focus') { next = s.cycle % st.longEvery === 0 ? 'long' : 'short'; s.cycle += 1; } else next = 'focus';
    const auto = next === 'focus' ? st.autoFocus : st.autoBreaks;
    ambientOff();
    s = fresh({ mode: s.mode, subjectId: s.subjectId, nodeId: s.nodeId, cycle: s.cycle, phase: next });
    if (fromComplete && auto) { s.phaseLen = lenOf(next); s.phaseStartedAt = Date.now(); s.startedAt = Date.now(); s.status = 'running'; ambientOn(); }
    changed();
  }

  function complete() {
    const st = settings(); const wasFocus = s.phase === 'focus';
    if (wasFocus) logFocus(phaseLen(), false);
    TI.sound.alarm(st.alarm, st.alarmVolume);
    notify(wasFocus ? 'Focus session complete' : 'Break is over', wasFocus ? 'Time for a break.' : 'Ready for the next focus session?');
    if (TI.ui && TI.ui.toast && !wasFocus) TI.ui.toast('Break is over – ready to focus?', { icon: 'alarm' });
    advance(true);
  }

  let lastTitle = '';
  setInterval(() => {
    if (!TI.store.state.ready) return;
    if (s.status === 'running' && s.mode === 'pomodoro' && remaining() <= 0) complete();
    if (s.status === 'running') {
      const v = api.view();
      const t = `${v.pomo ? U.fmtClock(v.remaining, false) : U.fmtClock(v.elapsed, false)} · ${v.phaseLabel} – ${TI.config.appName}`;
      if (t !== lastTitle) { document.title = t; lastTitle = t; }
    } else if (lastTitle) { document.title = `${TI.config.appName} – ${TI.config.tagline}`; lastTitle = ''; }
    tickFns.forEach((f) => f());
  }, 250);

  TI.timer = api;
})(window.TI);
