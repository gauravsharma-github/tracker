// Full-screen flip clock with wallpapers (timer or time of day).
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  let cleanup = null;

  const digit = (d, i) => `<div class="fd" data-i="${i}"><div class="fd-upper"><span>${d}</span></div><div class="fd-lower"><span>${d}</span></div></div>`;

  function digits() {
    const st = state.settings; const mode = state.ui.clockMode || 'timer';
    if (mode === 'time') {
      const d = new Date(); let h = d.getHours(); if (st.h12) h = h % 12 || 12;
      return [U.pad(h), U.pad(d.getMinutes()), U.pad(d.getSeconds())];
    }
    const v = TI.timer.view();
    const sec = Math.round(v.pomo ? v.remaining : v.elapsed);
    return [U.pad(Math.floor(sec / 3600)), U.pad(Math.floor((sec % 3600) / 60)), U.pad(sec % 60)];
  }

  function caption() {
    if ((state.ui.clockMode || 'timer') === 'time') return U.fmtDay(U.today());
    const v = TI.timer.view(); const t = TI.timer.state;
    if (v.idle) return v.pomo ? `Ready · ${t.phase === 'focus' ? 'Focus' : t.phase === 'short' ? 'Short break' : 'Long break'} ${U.fmtMin(Math.round(v.len / 60))}` : 'Stopwatch ready';
    return v.pomo ? `${t.phase === 'focus' ? `Focus Time · Pomodoro ${t.cycle}` : t.phase === 'short' ? 'Short break' : 'Long break'}${v.paused ? ' · paused' : ''}` : `Stopwatch${v.paused ? ' · paused' : ''}`;
  }

  const screen = {
    title: 'Flip clock',
    fullscreen: true,
    render(ctx) {
      const st = state.settings;
      let sid = ctx.params[0] || TI.timer.state.subjectId;
      if (!sid || !sel.subject(sid)) {
        const p = sel.activeProject();
        const last = p && state.sessions.filter((x) => x.projectId === p.id).sort((a, b) => b.start - a.start)[0];
        sid = last ? last.subjectId : p && sel.subjects(p.id)[0] ? sel.subjects(p.id)[0].id : null;
      }
      const s = sid ? sel.subject(sid) : null;
      if (s && !TI.timer.isActive()) TI.timer.setTarget(s.id, TI.timer.state.subjectId === s.id ? TI.timer.state.nodeId : null);
      const wp = TI.wallpaper(st.wallpaper);
      const [h, m, sec] = digits();
      const showSec = st.clockSeconds !== false;
      const v = TI.timer.view();
      const lightWp = wp.id === 'paper';
      return `<div class="flip-page ${lightWp ? 'on-light' : ''}" style="background:${wp.css};--fc:${st.clockColor}">
        <div class="flip-top fade-ctrl">
          <button class="icon-btn" data-act="clock-exit" aria-label="Exit full screen">${U.icon('close')}</button>
          <div class="grow"></div>
          ${TI.ui.seg([{ id: 'timer', label: 'Timer' }, { id: 'time', label: 'Clock' }], state.ui.clockMode || 'timer', 'clock-mode', 'alt')}
        </div>
        <div class="flip-center">
          <div class="flip-subject">${U.esc(s ? s.name : '')}</div>
          <div class="flip-clock ${showSec ? '' : 'no-sec'}" data-flip>
            <div class="fd-group">${digit(h[0], 0)}${digit(h[1], 1)}</div><div class="fd-colon"><i></i><i></i></div>
            <div class="fd-group">${digit(m[0], 2)}${digit(m[1], 3)}</div>
            <div class="fd-colon sec"><i></i><i></i></div><div class="fd-group sec">${digit(sec[0], 4)}${digit(sec[1], 5)}</div>
          </div>
          <div class="flip-caption" data-flip-caption>${caption()}</div>
        </div>
        <div class="flip-controls fade-ctrl">
          ${s ? `<button class="ctrl-btn" data-act="timer-stop" title="Stop and save" aria-label="Stop and save" ${v.idle ? 'disabled style="opacity:.35"' : ''}>${U.icon('stop', 'fill')}</button>
          <button class="big-play" data-act="timer-toggle" data-subject="${s.id}" aria-label="${v.running ? 'Pause' : 'Start'}">${U.icon(v.running ? 'pause' : 'play_arrow')}</button>
          <button class="ctrl-btn" data-act="timer-skip" title="Skip" aria-label="Skip">${U.icon('skip_next', 'fill')}</button>` : '<div class="small" style="opacity:.8">Pick a subject on the Focus page to use the timer.</div>'}
          <span class="flip-sep"></span>
          <button class="ctrl-btn" data-act="clock-wallpaper" title="Wallpaper" aria-label="Wallpaper">${U.icon('wallpaper')}</button>
          <button class="ctrl-btn" data-act="clock-color" title="Clock colour" aria-label="Clock colour">${U.icon('palette')}</button>
          <button class="ctrl-btn" data-act="clock-seconds" title="${showSec ? 'Hide' : 'Show'} seconds" aria-label="Toggle seconds">${U.icon(showSec ? 'timer_10' : 'timer_off')}</button>
          <button class="ctrl-btn" data-act="ambient-menu" title="Focus sounds" aria-label="Focus sounds">${U.icon('music_note', st.ambient && st.ambient !== 'off' ? 'fill' : '')}</button>
        </div>
      </div>`;
    },
    mount(root) {
      const page = root.querySelector('.flip-page'); if (!page) return;
      let last = digits().join('');
      const flip = (el, from, to) => {
        el.querySelector('.fd-upper span').textContent = to;
        const ft = document.createElement('div'); ft.className = 'fd-flap-top'; ft.innerHTML = `<span>${from}</span>`;
        const fb = document.createElement('div'); fb.className = 'fd-flap-bottom'; fb.innerHTML = `<span>${to}</span>`;
        el.append(ft, fb);
        setTimeout(() => { el.querySelector('.fd-lower span').textContent = to; ft.remove(); fb.remove(); }, 560);
      };
      const tick = () => {
        const cur = digits().join('');
        if (cur !== last) {
          root.querySelectorAll('.fd').forEach((el) => { const i = +el.dataset.i; if (cur[i] !== last[i]) flip(el, last[i], cur[i]); });
          last = cur;
        }
        const c = root.querySelector('[data-flip-caption]'); const txt = caption(); if (c && c.textContent !== txt) c.textContent = txt;
      };
      const offTick = TI.timer.onTick(tick);
      let hideT;
      const wake = () => { page.classList.remove('idle'); clearTimeout(hideT); hideT = setTimeout(() => page.classList.add('idle'), 3000); };
      page.addEventListener('mousemove', wake); page.addEventListener('touchstart', wake, { passive: true }); wake();
      cleanup = () => { offTick(); clearTimeout(hideT); };
      return () => { cleanup && cleanup(); cleanup = null; if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); };
    },
    actions: {
      'clock-exit': () => { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); TI.router.back('/focus'); },
      'clock-mode': (el) => actions.setUi({ clockMode: el.dataset.v }),
      'clock-seconds': () => actions.updateSettings({ clockSeconds: state.settings.clockSeconds === false }),
      'clock-wallpaper': (el) => {
        const pro = sel.isPro();
        TI.ui.openMenu(el, [{ heading: 'Wallpaper' }, ...TI.wallpapers.map((w) => ({ label: w.label, dot: w.css, on: state.settings.wallpaper === w.id, trail: w.pro && !pro ? '👑' : '', onClick: () => { if (w.pro && !pro) return TI.screens.pro.open('wallpapers'); actions.updateSettings({ wallpaper: w.id }); } }))]);
      },
      'clock-color': (el) => {
        TI.ui.openMenu(el, [{ heading: 'Clock colour' }, ...TI.config.clockColors.map((c, i) => ({ label: ['Gold', 'Cocoa', 'Blue', 'Teal', 'Rose', 'Graphite', 'Ivory'][i] || c, dot: c, on: state.settings.clockColor === c, onClick: () => actions.updateSettings({ clockColor: c }) }))]);
      },
    },
  };

  TI.screens.clock = screen;
})(window.TI);
