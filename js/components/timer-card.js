// The focus timer card (arc dial like the app) and its live per-second updates.
(function (TI) {
  const U = TI.util;
  const { state, sel } = TI.store;
  const CX = 150; const CY = 150; const R = 124;
  const L = R * 1.5 * Math.PI;
  const pt = (deg) => { const a = (deg * Math.PI) / 180; return [CX + R * Math.cos(a), CY + R * Math.sin(a)]; };

  function arcPath() { const [x1, y1] = pt(135); const [x2, y2] = pt(45); return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 1 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`; }

  function targetLabel(subjectId, nodeId) {
    if (!nodeId) return 'Whole subject';
    const path = TI.stats.pathOf(state, nodeId);
    return path.length ? path.map((n) => n.title).join(' › ') : 'Whole subject';
  }

  function render({ subjectId }) {
    const t = TI.timer; const ts = t.state;
    const s = sel.subject(subjectId);
    if (!s) return '';
    // Timer is busy with another subject
    if (t.isActive() && ts.subjectId && ts.subjectId !== subjectId) {
      const other = sel.subject(ts.subjectId);
      const v = t.view();
      return `<div class="card timer-card" style="--c:${other ? other.color : 'var(--primary)'}" data-timer-card="${subjectId}">
        <div class="row"><span class="ms fill" style="color:var(--c)">timer</span><div class="grow"><div style="font-weight:600">Timer running for ${U.esc(other ? other.name : 'another subject')}</div>
        <div class="small muted"><span data-t="phase">${v.phaseLabel}</span> · <span data-t="big" class="tabular">${v.big}</span></div></div></div>
        <div class="row" style="margin-top:14px"><button class="btn sm" data-act="nav" data-to="/subject/${ts.subjectId}">Open timer</button><button class="btn sm ghost" data-act="timer-stop">Stop &amp; save</button></div></div>`;
    }
    const v = t.view();
    const st = state.settings;
    const ambientOn = st.ambient && st.ambient !== 'off';
    const [kx, ky] = pt(135 + 270 * v.frac);
    return `<div class="card timer-card" style="--c:${s.color}" data-timer-card="${subjectId}">
      <div class="timer-top">
        <span class="cycle" title="Pomodoro ${ts.cycle}">${v.pomo ? ts.cycle : U.icon('timer', 'xs')}</span>
        <div class="actions">
          <button class="icon-btn sm" data-act="clock-open" data-subject="${s.id}" title="Full-screen flip clock (F)" aria-label="Full-screen clock">${U.icon('fullscreen')}</button>
          <button class="icon-btn sm ${ambientOn ? 'on' : ''}" data-act="ambient-menu" title="Focus sounds" aria-label="Focus sounds">${U.icon('music_note', ambientOn ? 'fill' : '')}</button>
          <button class="icon-btn sm" data-act="timer-settings" title="Timer settings" aria-label="Timer settings">${U.icon('settings')}</button>
        </div>
      </div>
      <div class="timer-dial">
        <svg viewBox="0 4 300 262" aria-hidden="true">
          <path class="arc-track" d="${arcPath()}" fill="none" stroke-width="16" stroke-linecap="round"/>
          <path class="arc-val" data-t="arc" d="${arcPath()}" fill="none" stroke-width="16" stroke-linecap="round" stroke-dasharray="${L.toFixed(2)}" stroke-dashoffset="${(L * (1 - v.frac)).toFixed(2)}" ${v.frac <= 0.001 ? 'opacity="0"' : ''}/>
          <circle class="knob" data-t="knob" cx="${kx.toFixed(2)}" cy="${ky.toFixed(2)}" r="11"/>
        </svg>
        <div class="timer-center">
          <div class="phase" data-t="phase">${v.phaseLabel}</div>
          <div class="big" data-t="big">${v.big}</div>
          <div class="smallt" data-t="small">${v.small}</div>
        </div>
      </div>
      <div class="timer-controls">
        <button class="ctrl-btn ${v.idle ? 'ghosted' : ''}" data-act="timer-stop" title="Stop and save" aria-label="Stop and save">${U.icon('stop', 'fill')}</button>
        <button class="big-play" data-act="timer-toggle" data-subject="${s.id}" title="${v.running ? 'Pause' : 'Start'} (Space)" aria-label="${v.running ? 'Pause' : 'Start'}">${U.icon(v.running ? 'pause' : 'play_arrow')}</button>
        <button class="ctrl-btn ${v.idle && !(v.pomo && ts.phase !== 'focus') ? 'ghosted' : ''}" data-act="timer-skip" title="${v.pomo ? 'Skip to next' : 'Stop'}" aria-label="Skip">${U.icon('skip_next', 'fill')}</button>
      </div>
      <div class="mode-switch">${TI.ui.seg([{ id: 'pomodoro', label: 'Pomodoro' }, { id: 'stopwatch', label: 'Stopwatch' }], ts.mode, 'timer-mode', 'alt')}</div>
      <button class="timer-target" data-act="timer-topic" data-subject="${s.id}"><span class="dot"></span><span class="grow ellipsis"><span class="muted">Studying:</span> ${U.esc(targetLabel(s.id, ts.subjectId === s.id ? ts.nodeId : null))}</span>${U.icon('expand_more', 'sm')}</button>
      ${v.pomo ? `<div class="timer-note">${st.focusMin}m focus · ${st.shortMin}m break · long break every ${st.longEvery}</div>` : '<div class="timer-note">Counts up until you stop. Time is saved when you press stop.</div>'}
    </div>`;
  }

  function tick() {
    const els = document.querySelectorAll('[data-timer-card], [data-mini-timer]');
    if (!els.length) return;
    const v = TI.timer.view();
    els.forEach((el) => {
      const set = (k, val) => { const n = el.querySelector(`[data-t="${k}"]`); if (n && n.textContent !== val) n.textContent = val; };
      set('big', v.big); set('small', v.small); set('phase', v.phaseLabel);
      const arc = el.querySelector('[data-t="arc"]');
      if (arc) { arc.setAttribute('stroke-dashoffset', (L * (1 - v.frac)).toFixed(2)); arc.setAttribute('opacity', v.frac <= 0.001 ? '0' : '1'); }
      const knob = el.querySelector('[data-t="knob"]');
      if (knob) { const [x, y] = pt(135 + 270 * v.frac); knob.setAttribute('cx', x.toFixed(2)); knob.setAttribute('cy', y.toFixed(2)); }
      const mini = el.querySelector('[data-t="mini"]');
      if (mini) { const txt = v.pomo ? U.fmtClock(v.remaining, false) : U.fmtClock(v.elapsed, false); if (mini.textContent !== txt) mini.textContent = txt; }
    });
  }

  function ambientMenu(anchor) {
    const st = state.settings; const pro = sel.isPro();
    TI.ui.openMenu(anchor, [{ heading: 'Focus sounds' }, ...TI.config.ambientSounds.map((a) => ({
      icon: a.icon, label: a.label, on: (st.ambient || 'off') === a.id, trail: a.pro && !pro ? '👑' : '',
      onClick: () => {
        if (a.pro && !pro) return TI.screens.pro.open('sounds');
        TI.store.actions.updateSettings({ ambient: a.id });
        if (TI.timer.state.status === 'running' && TI.timer.state.phase === 'focus') TI.sound.startAmbient(a.id, st.ambientVolume);
        else if (a.id !== 'off') { TI.sound.startAmbient(a.id, st.ambientVolume); setTimeout(() => { if (TI.timer.state.status !== 'running') TI.sound.stopAmbient(); }, 2500); } else TI.sound.stopAmbient();
      },
    }))]);
  }

  TI.timerCard = { render, tick, ambientMenu, targetLabel };
})(window.TI);
