// Focus timer page: pick a subject (and topic) and run Pomodoro or stopwatch sessions.
(function (TI) {
  const U = TI.util;
  const { state, sel } = TI.store;

  function currentSubject(p) {
    const t = TI.timer.state;
    if (t.subjectId && sel.subject(t.subjectId) && (TI.timer.isActive() || sel.subject(t.subjectId).projectId === p.id)) return sel.subject(t.subjectId);
    const last = state.sessions.filter((x) => x.projectId === p.id).sort((a, b) => b.start - a.start)[0];
    return (last && sel.subject(last.subjectId)) || sel.subjects(p.id)[0] || null;
  }

  const screen = {
    title: 'Focus timer',
    render(ctx) {
      const p = sel.activeProject();
      if (!p) return TI.ui.empty('timer', 'No project yet', 'Create an exam or project to start timing your study.', '<button class="btn primary" data-act="nav" data-to="/templates">Add exam / project</button>');
      const subjects = sel.subjects(p.id);
      const s = currentSubject(p);
      if (!s) return `<div class="page-head"><h1>Focus timer</h1></div>${TI.ui.empty('menu_book', 'Add a subject first', 'Time is tracked per subject and topic.', '<button class="btn primary" data-act="new-subject">Add subject</button>')}`;
      if (!TI.timer.isActive() && TI.timer.state.subjectId !== s.id) TI.timer.setTarget(s.id, null);
      const today = U.today();
      const todays = sel.sessionsOn(today, p.id);
      const focusToday = U.sum(todays, (x) => x.duration);
      const pomos = todays.filter((x) => x.mode === 'pomodoro').length;
      const locked = TI.timer.isActive();
      return `<div class="page-head"><div><h1>Focus timer</h1><div class="sub">${U.esc(p.name)}</div></div>
          <div class="actions"><button class="btn sm" data-act="clock-open" data-subject="${s.id}">${U.icon('fullscreen')}Flip clock</button></div></div>
        <div class="focus-grid">
          <div>
            <div class="chips focus-subjects">${subjects.map((x) => `<button class="chip ${x.id === s.id ? 'on' : ''}" style="--c:${x.color};${locked && x.id !== s.id ? 'opacity:.45' : ''}" data-act="focus-subject" data-id="${x.id}" ${locked && x.id !== s.id ? 'disabled title="Stop the timer to switch subjects"' : ''}><span class="dot"></span>${U.esc(x.name)}</button>`).join('')}</div>
            ${TI.timerCard.render({ subjectId: s.id })}
          </div>
          <div>
            <div class="kpis">
              ${TI.ui.kpi('schedule', 'Focused today', U.fmtDur(focusToday, { noDays: true }), `Goal ${U.fmtMin(state.settings.dailyGoalMin)}`, '#405FFF')}
              ${TI.ui.kpi('nest_clock_farsight_analog', 'Pomodoros', String(pomos), `${state.settings.focusMin} min each`, '#25AE97')}
            </div>
            <div class="card" style="margin-top:14px">
              <div class="card-head"><h3>Today's sessions</h3><div class="actions"><button class="btn sm ghost" data-act="log-time-any">${U.icon('more_time')}Log time</button></div></div>
              ${todays.length ? `<div class="list">${todays.slice().reverse().map((x) => { const sj = sel.subject(x.subjectId); const n = x.nodeId ? sel.node(x.nodeId) : null; return `<div class="list-item" style="--c:${sj ? sj.color : ''}"><span class="lead">${U.icon('check_circle')}</span><div class="txt"><div class="ttl">${U.esc(sj ? sj.name : '')}</div><div class="sub">${U.fmtTime(x.start, state.settings.h12)}${n ? ' · ' + U.esc(n.title) : ''}</div></div><span class="trail">${U.fmtDur(x.duration, { short: true })}</span></div>`; }).join('')}</div>`
                : '<div class="small muted">No sessions yet today. A 25-minute Pomodoro is a great start.</div>'}
            </div>
            <div class="card tip-card" style="margin-top:14px">
              <div class="row">${U.icon('keyboard', 'faint')}<div class="small muted"><kbd>Space</kbd> start / pause · <kbd>S</kbd> stop &amp; save · <kbd>F</kbd> flip clock</div></div>
            </div>
          </div>
        </div>`;
    },
    actions: {
      'focus-subject': (el) => { if (!TI.timer.isActive()) { TI.timer.setTarget(el.dataset.id, null); TI.store.bump(); } },
      'log-time-any': () => TI.forms.logTimeForm({ subjectId: TI.timer.state.subjectId }),
    },
  };
  TI.screens.focus = screen;
})(window.TI);
