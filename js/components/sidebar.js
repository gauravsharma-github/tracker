// Desktop sidebar (≥1024px) and phone bottom tabs.
(function (TI) {
  const U = TI.util;
  const { state, sel } = TI.store;

  const NAV = [
    { to: '/', name: 'home', icon: 'space_dashboard', label: 'Dashboard' },
    { to: '/focus', name: 'focus', icon: 'timer', label: 'Focus timer' },
    { to: '/schedule', name: 'schedule', icon: 'calendar_month', label: 'Schedule' },
    { to: '/cards', name: 'cards', icon: 'style', label: 'Flashcards' },
    { to: '/notes', name: 'notes', icon: 'sticky_note_2', label: 'Notes' },
    { to: '/insights', name: 'insights', icon: 'insights', label: 'Insights' },
    { to: '/templates', name: 'templates', icon: 'library_add', label: 'Templates' },
    { to: '/share', name: 'share', icon: 'ios_share', label: 'Share progress' },
  ];

  function miniTimer() {
    const t = TI.timer; if (!t.isActive()) return '';
    const s = sel.subject(t.state.subjectId); const v = t.view();
    return `<div class="mini-timer" data-mini-timer style="--c:${s ? s.color : 'var(--primary)'}">
      <button class="mt-main" data-act="nav" data-to="/subject/${t.state.subjectId}">
        <span class="mt-dot ${v.running ? 'pulse' : ''}"></span>
        <span class="grow ellipsis"><span class="mt-sub ellipsis">${U.esc(s ? s.name : '')}</span><span class="mt-phase" data-t="phase">${v.phaseLabel}</span></span>
        <span class="mt-time tabular" data-t="mini">${v.pomo ? U.fmtClock(v.remaining, false) : U.fmtClock(v.elapsed, false)}</span>
      </button>
      <button class="icon-btn sm" data-act="timer-toggle" aria-label="${v.running ? 'Pause' : 'Resume'}">${U.icon(v.running ? 'pause' : 'play_arrow', 'fill')}</button>
      <button class="icon-btn sm" data-act="timer-stop" aria-label="Stop and save">${U.icon('stop', 'fill')}</button>
    </div>`;
  }

  function render(route) {
    const p = sel.activeProject();
    const subjects = p ? sel.subjects(p.id) : [];
    const due = p ? U.sum(subjects, (s) => TI.stats.dueCards(state, s.id).length) : 0;
    const blocksLeft = sel.blocksOn(U.today()).filter((b) => !(b.doneDates || []).includes(U.today())).length;
    const counts = { cards: due, schedule: blocksLeft, notes: p ? state.notes.filter((n) => subjects.some((s) => s.id === n.subjectId)).length : 0 };
    const active = route.name === 'subject' ? '' : route.name;
    const theme = TI.theme.current();
    return `<div class="sb-top">${TI.ui.logo(30)}<span class="sb-brand">${U.esc(TI.config.appName)}</span>${sel.isPro() ? '<span class="pro-tag">PRO</span>' : ''}</div>
      ${p ? `<button class="sb-project" data-act="project-menu" style="--c:${p.color}" aria-haspopup="menu">
        ${TI.ui.ring(TI.stats.projectRatio(state, p.id), '#fff', { size: 34, stroke: 3.5, label: '', })}
        <span class="grow" style="min-width:0;text-align:left"><span class="sb-pname ellipsis">${U.esc(p.name)}</span><span class="sb-psub">${U.pct(TI.stats.projectRatio(state, p.id), 1)} complete</span></span>${U.icon('unfold_more')}</button>`
        : '<button class="sb-project" data-act="new-project" style="--c:var(--primary)">' + U.icon('add') + '<span class="grow" style="text-align:left">Add exam / project</span></button>'}
      <nav class="sb-nav">${NAV.map((n) => `<button class="sb-link ${active === n.name || (n.name === 'cards' && active === 'study') ? 'on' : ''}" data-act="nav" data-to="${n.to}">${U.icon(n.icon)}<span class="grow">${n.label}</span>${n.name === 'focus' && TI.timer.isActive() ? '<span class="live-dot"></span>' : counts[n.name] ? `<span class="badge ${n.name === 'cards' ? 'hot' : ''}">${counts[n.name]}</span>` : ''}</button>`).join('')}</nav>
      <div class="sb-section"><span>Subjects</span><button class="icon-btn sm muted" data-act="new-subject" title="Add subject" aria-label="Add subject">${U.icon('add')}</button></div>
      <div class="sb-subjects">${subjects.map((s) => `<button class="sb-subj ${route.name === 'subject' && route.params[0] === s.id ? 'on' : ''}" data-act="nav" data-to="/subject/${s.id}" style="--c:${s.color}">
        <span class="sb-dot"></span><span class="grow ellipsis">${U.esc(s.name)}</span><span class="faint tiny tabular">${U.pctInt(TI.stats.subjectRatio(state, s.id))}</span></button>`).join('') || '<div class="faint small" style="padding:6px 12px">No subjects yet</div>'}</div>
      <div class="sb-bottom">
        ${miniTimer()}
        ${TI.sync.indicator()}
        <button class="sb-link ${active === 'settings' ? 'on' : ''}" data-act="nav" data-to="/settings">${U.icon('settings')}<span class="grow">Settings</span></button>
        ${sel.isPro() ? '' : `<button class="sb-link pro" data-act="nav" data-to="/pro">${U.icon('crown', 'fill')}<span class="grow">Go Pro</span></button>`}
        <button class="sb-link" data-act="theme-toggle">${U.icon(theme === 'dark' ? 'light_mode' : 'dark_mode')}<span class="grow">${theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>
      </div>`;
  }

  function renderTabs(route) {
    const t = TI.timer;
    const due = (() => { const p = sel.activeProject(); return p ? U.sum(sel.subjects(p.id), (s) => TI.stats.dueCards(state, s.id).length) : 0; })();
    const tab = (to, name, icon, label, extra = '') => `<button class="${route.name === name ? 'on' : ''}" data-act="nav" data-to="${to}">${U.icon(icon)}<span>${label}</span>${extra}</button>`;
    return `${tab('/', 'home', 'home', 'Home')}${tab('/schedule', 'schedule', 'calendar_month', 'Schedule')}
      <button class="tab-timer ${t.state.status === 'running' ? 'running' : ''} ${route.name === 'focus' ? 'on' : ''}" data-act="nav" data-to="/focus"><span class="bubble">${U.icon(t.state.status === 'running' ? 'graphic_eq' : 'timer', 'fill')}</span><span>Timer</span></button>
      ${tab('/cards', 'cards', 'style', 'Cards', due ? `<span class="badge hot tab-badge">${due}</span>` : '')}${tab('/insights', 'insights', 'insights', 'Insights')}`;
  }

  TI.sidebar = { render, renderTabs, miniTimer };
})(window.TI);
