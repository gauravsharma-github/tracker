// Project view: the active exam/project with date strip, completion, time spent and subject cards.
// (The all-projects Dashboard is js/screens/overview.js.)
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  TI.screens = TI.screens || {};

  function subjectCard(s, desktop) {
    const st = TI.stats;
    const r = st.subjectRatio(state, s.id);
    const open = !!state.ui.expandedSubjects[s.id];
    const dueTopics = st.dueTopics(state, s.id).length;
    const dueCards = st.dueCards(state, s.id).length;
    const running = TI.timer.isActive() && TI.timer.state.subjectId === s.id;
    return `<div class="subject-card" style="--c:${s.color}" data-subject="${s.id}">
      <div class="subject-head">
        ${TI.ui.ring(r, s.color, { size: desktop ? 68 : 64, stroke: 6 })}
        <div class="info" data-act="subject-expand" data-id="${s.id}">
          <div class="name"><span data-act="nav" data-to="/subject/${s.id}" class="name-link ellipsis">${U.esc(s.name)}</span><span class="row-ics">${TI.attach.iconsHtml(s.id, null)}</span></div>
          <div class="time">${U.fmtDur(st.subjectTime(state, s.id), { noDays: true })}</div>
          <span class="more">${open ? 'Hide Details' : 'See Details'} ${U.icon(open ? 'expand_less' : 'expand_more')}</span>
          ${dueTopics || dueCards ? `<div class="subject-meta">${dueTopics ? `<span class="tag warn">${U.icon('event')}${U.plural(dueTopics, 'topic')} due</span>` : ''}${dueCards ? `<span class="tag">${U.icon('style')}${dueCards} cards due</span>` : ''}</div>` : ''}
        </div>
        <button class="icon-btn muted" data-act="subject-menu" data-id="${s.id}" aria-label="More for ${U.esc(s.name)}">${U.icon('more_vert')}</button>
        <button class="play-btn ${running ? 'running' : ''}" data-act="subject-play" data-id="${s.id}" aria-label="Study ${U.esc(s.name)}">${U.icon(running ? 'graphic_eq' : 'play_arrow')}</button>
      </div>
      ${open ? `<div class="subject-body">${TI.tree.render(s.id, { showPlay: desktop })}</div>` : ''}
    </div>`;
  }

  function welcome() {
    return `<div class="welcome">
      ${TI.ui.logo(64)}
      <h1>Plan it. Study it. Track it.</h1>
      <p class="muted">Add your exam or project, break the syllabus into units and topics, then track every minute you study.</p>
      <div class="welcome-actions">
        <button class="btn primary lg" data-act="nav" data-to="/templates">${U.icon('library_add')}Browse 1000+ templates</button>
        <button class="btn lg" data-act="new-project">${U.icon('add')}Start from scratch</button>
        <button class="btn ghost lg" data-act="nav" data-to="/templates?ai=1">${U.icon('auto_awesome')}Import from ChatGPT / Gemini</button>
      </div>
      <div class="welcome-steps">
        <div><span class="ms">account_tree</span><b>Create projects</b><span>Subjects, units and topics with progress at every level.</span></div>
        <div><span class="ms">timer</span><b>Track sessions</b><span>Pomodoro or stopwatch, linked to the topic you study.</span></div>
        <div><span class="ms">insights</span><b>Review progress</b><span>Daily time, streaks, flashcards and weekly insights.</span></div>
      </div>
    </div>`;
  }

  function rightPanel(p, subjects) {
    const st = TI.stats; const today = U.today();
    const todaySec = st.projectDay(state, p.id, today);
    const goal = state.settings.dailyGoalMin * 60;
    const blocks = sel.blocksOn(today).filter((b) => subjects.some((s) => s.id === b.subjectId));
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const upcoming = blocks.filter((b) => U.hmToMin(b.end) > nowMin && !(b.doneDates || []).includes(today)).slice(0, 3);
    const decks = subjects.map((s) => ({ s, n: st.dueCards(state, s.id).length })).filter((d) => d.n);
    const notes = sel.notes().filter((n) => subjects.some((s) => s.id === n.subjectId)).slice(0, 3);
    const t = TI.timer;
    const last = state.sessions.filter((x) => x.projectId === p.id).sort((a, b) => b.start - a.start)[0];
    const resume = t.isActive() ? sel.subject(t.state.subjectId) : last ? sel.subject(last.subjectId) : subjects[0];
    return `<aside class="dash-aside">
      <div class="card today-card">
        <div class="row" style="gap:16px">${TI.ui.ring(goal ? todaySec / goal : 0, 'var(--primary)', { size: 76, stroke: 7, label: `<span style="font-size:13px">${U.pctInt(goal ? Math.min(1, todaySec / goal) : 0)}</span>` })}
          <div class="grow"><div class="stat-label" style="margin:0">Today</div><div style="font-size:24px;font-weight:600" class="tabular">${U.fmtDur(todaySec, { noDays: true })}</div><div class="small muted">Goal ${U.fmtMin(state.settings.dailyGoalMin)}</div></div></div>
        ${resume ? `<button class="btn ${t.isActive() ? 'tint' : 'primary'} block" style="margin-top:14px;--c:${resume.color}" data-act="${t.isActive() ? 'nav' : 'subject-play'}" data-to="/subject/${resume.id}" data-id="${resume.id}">${U.icon(t.isActive() ? 'graphic_eq' : 'play_arrow', 'fill')}${t.isActive() ? 'Back to timer' : `Focus on ${U.esc(U.truncate(resume.name, 22))}`}</button>` : ''}
      </div>
      <div class="card">
        <div class="card-head"><h3>Up next</h3><div class="actions"><button class="btn sm ghost" data-act="nav" data-to="/schedule">Schedule</button></div></div>
        ${upcoming.length ? `<div class="list">${upcoming.map((b) => { const s = sel.subject(b.subjectId); return `<div class="list-item click" data-act="nav" data-to="/schedule" style="--c:${s ? s.color : 'var(--primary)'}"><span class="lead">${U.icon('event')}</span><div class="txt"><div class="ttl">${U.esc(b.title || (s ? s.name : ''))}</div><div class="sub">${U.fmtHmLabel(b.start, state.settings.h12)} – ${U.fmtHmLabel(b.end, state.settings.h12)} · ${U.esc(s ? s.name : '')}</div></div></div>`; }).join('')}</div>`
          : `<div class="small muted">Nothing else planned today. <a href="#/schedule">Plan a block</a></div>`}
      </div>
      <div class="card">
        <div class="card-head"><h3>Flashcards due</h3><div class="actions"><button class="btn sm ghost" data-act="nav" data-to="/cards">All decks</button></div></div>
        ${decks.length ? `<div class="list">${decks.map((d) => `<div class="list-item click" data-act="nav" data-to="/study/${d.s.id}" style="--c:${d.s.color}"><span class="lead">${U.icon('style')}</span><div class="txt"><div class="ttl">${U.esc(d.s.name)}</div><div class="sub">${U.plural(d.n, 'card')} to review</div></div><span class="btn sm soft-tint" style="--c:${d.s.color}">Study</span></div>`).join('')}</div>`
          : '<div class="small muted">All caught up. 🎉</div>'}
      </div>
      ${notes.length ? `<div class="card"><div class="card-head"><h3>Recent notes</h3><div class="actions"><button class="btn sm ghost" data-act="nav" data-to="/notes">All notes</button></div></div>
        <div class="list">${notes.map((n) => { const s = sel.subject(n.subjectId); return `<div class="list-item click" data-act="note-open" data-id="${n.id}" style="--c:${s ? s.color : ''}"><span class="lead">${U.icon('sticky_note_2')}</span><div class="txt"><div class="ttl">${U.esc(n.title || U.truncate(n.body, 40) || 'Untitled')}</div><div class="sub">${U.esc(s ? s.name : '')} · ${U.timeAgo(n.updatedAt)}</div></div></div>`; }).join('')}</div></div>` : ''}
    </aside>`;
  }

  const screen = {
    title: 'Project',
    welcome,
    render(ctx) {
      // #/project/<id> opens that project
      if (ctx.params[0] && sel.project(ctx.params[0]) && state.settings.activeProjectId !== ctx.params[0]) setTimeout(() => actions.setActiveProject(ctx.params[0]), 0);
      const p = (ctx.params[0] && sel.project(ctx.params[0])) || sel.activeProject();
      if (!p) return welcome();
      const st = TI.stats;
      const subjects = sel.subjects(p.id);
      const due = subjects.filter((s) => st.isSubjectDue(state, s.id));
      const filter = state.ui.dashFilter === 'due' ? 'due' : 'all';
      const list = filter === 'due' ? due : subjects;
      const ratio = st.projectRatio(state, p.id);
      const total = st.projectTime(state, p.id);
      const today = U.today();
      const streak = st.streaks(state, { type: 'project', id: p.id });
      const dueCards = U.sum(subjects, (s) => st.dueCards(state, s.id).length);
      const goal = state.settings.dailyGoalMin * 60;
      const todaySec = st.projectDay(state, p.id, today);
      const canAdd = sel.canAddSubject(p.id);

      const head = `<div class="dash-head">
        <button class="project-pill" style="--c:${p.color}" data-act="project-menu" aria-haspopup="menu"><span class="ellipsis">${U.esc(p.name)}</span>${U.icon('expand_more')}</button>
        <div class="actions">
          <span class="phone-only">${TI.sync.indicator(true)}</span>
          <button class="icon-btn" data-act="calendar" title="Calendar" aria-label="Calendar">${U.icon('calendar_today')}</button>
          <button class="icon-btn phone-only" data-act="nav" data-to="/notes" aria-label="Notes">${U.icon('sticky_note_2')}</button>
          <button class="icon-btn phone-only" data-act="nav" data-to="/settings" aria-label="Settings">${U.icon('settings')}</button>
          <button class="icon-btn" data-act="share-options" data-id="${p.id}" title="Share" aria-label="Share">${U.icon('share')}</button>
        </div>
      </div>`;

      const filters = `<div class="dash-filters">
        <div><div class="stat-label">Filter</div>${TI.ui.seg([{ id: 'all', label: `All (${subjects.length})` }, { id: 'due', label: `Due (${due.length})` }], filter, 'dash-filter')}</div>
        <div class="grow"></div>
        <div class="phone-only"><div class="stat-label">Completed</div><span class="chip-stat tabular">${U.pct(ratio, 2)}</span></div>
        <div class="phone-only"><div class="stat-label">Time Spent</div><span class="chip-stat tabular">${U.fmtDur(total, { noDays: true })}</span></div>
      </div>`;

      const kpis = `<div class="kpis dash-kpis desktop-only">
        ${TI.ui.kpi('task_alt', 'Completed', U.pct(ratio, 2), `${st.projectProgress(state, p.id).done} of ${st.projectProgress(state, p.id).leaves} topics`, p.color)}
        ${TI.ui.kpi('schedule', 'Time spent', U.fmtDur(total, { noDays: true }), `${streak.activeDays} active days`, '#25AE97')}
        ${TI.ui.kpi('today', 'Today', U.fmtDur(todaySec, { noDays: true }), goal ? `${U.pctInt(Math.min(1, todaySec / goal))} of ${U.fmtMin(state.settings.dailyGoalMin)} goal` : '', '#E0AD3C')}
        ${TI.ui.kpi('local_fire_department', 'Streak', U.plural(streak.current, 'day'), `Best ${streak.best}`, '#F06A3A')}
        ${TI.ui.kpi('style', 'Cards due', String(dueCards), dueCards ? 'Review to keep them fresh' : 'All caught up', '#C74FFA')}
      </div>`;

      const cards = list.length ? list.map((s) => subjectCard(s, ctx.desktop)).join('')
        : filter === 'due' ? TI.ui.empty('event_available', 'Nothing due', 'No overdue topics or flashcards in this project.')
          : TI.ui.empty('menu_book', 'Add your first subject', 'Subjects hold units, chapters and topics. Their progress adds up to the project.');

      const addBtn = `<button class="add-subject-banner" data-act="new-subject">${U.icon('add_circle')}<span class="grow">Add New Subject</span>${canAdd ? '' : '<span class="crown-bubble">' + U.icon('crown', 'fill') + '</span>'}</button>`;

      return `<div class="dash ${ctx.wide ? 'with-aside' : ''}">
        <div class="dash-main">
          ${head}
          <div class="card datestrip-card">${TI.ui.dateStrip({ count: ctx.desktop ? 21 : 14, fn: (d) => st.projectDay(state, p.id, d), color: p.color })}</div>
          ${kpis}
          ${filters}
          <div class="subject-list">${cards}</div>
          ${addBtn}
        </div>
        ${ctx.wide ? rightPanel(p, subjects) : ''}
      </div>`;
    },
    actions: {
      'dash-filter': (el) => actions.setUi({ dashFilter: el.dataset.v }),
      'pick-day': (el) => TI.forms.dayDetails(el.dataset.day, (sel.activeProject() || {}).id),
      calendar: () => TI.forms.calendarSheet((sel.activeProject() || {}).id),
    },
  };

  TI.screens.project = screen;
})(window.TI);
