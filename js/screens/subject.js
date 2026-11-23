// Subject page: stats, focus timer, the multi-level syllabus, sessions, links to cards and notes.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;

  function sessionsCard(s) {
    const today = U.today();
    const list = state.sessions.filter((x) => x.subjectId === s.id).sort((a, b) => b.start - a.start).slice(0, 8);
    return `<div class="card">
      <div class="card-head"><h3>Recent sessions</h3><div class="actions"><button class="btn sm ghost" data-act="log-time" data-id="${s.id}">${U.icon('more_time')}Log time</button></div></div>
      ${list.length ? `<div class="list">${list.map((x) => {
        const node = x.nodeId ? sel.node(x.nodeId) : null; const d = U.dayKey(x.start);
        return `<div class="list-item"><span class="lead">${U.icon(x.manual ? 'edit_calendar' : x.mode === 'stopwatch' ? 'timer' : 'nest_clock_farsight_analog')}</span>
          <div class="txt"><div class="ttl">${node ? U.esc(node.title) : 'Whole subject'}</div><div class="sub">${d === today ? 'Today' : U.fmtDay(d)}, ${U.fmtTime(x.start, state.settings.h12)}${x.manual ? ' · logged manually' : ''}</div></div>
          <span class="trail">${U.fmtDur(x.duration, { short: true })}</span>
          <button class="icon-btn sm muted" data-act="del-session" data-id="${x.id}" aria-label="Delete session">${U.icon('close')}</button></div>`;
      }).join('')}</div>` : '<div class="small muted">No sessions yet. Press play to start your first focus session.</div>'}
    </div>`;
  }

  const screen = {
    title: 'Subject',
    render(ctx) {
      const s = sel.subject(ctx.params[0]);
      if (!s) return TI.ui.empty('search_off', 'Subject not found', 'It may have been deleted.', '<button class="btn primary" data-act="nav" data-to="/">Go to dashboard</button>');
      const st = TI.stats; const today = U.today();
      const r = st.subjectRatio(state, s.id);
      const cards = sel.cards(s.id); const due = st.dueCards(state, s.id).length;
      const notes = sel.notes(s.id).length;
      const p = sel.project(s.projectId);
      return `<div class="subject-page" style="--c:${s.color}">
        <div class="topbar">
          <button class="icon-btn" data-act="back" aria-label="Back">${U.icon('arrow_back')}</button>
          <div class="grow" style="min-width:0"><div class="row" style="gap:6px;min-width:0"><h1 class="title-tint ellipsis">${U.esc(s.name)}</h1><span class="row-ics lg">${TI.attach.iconsHtml(s.id, null)}</span></div>${p ? `<div class="tiny faint desktop-only">${U.esc(p.name)}</div>` : ''}</div>
          <div class="actions">
            <button class="icon-btn" data-act="nav" data-to="/share?subject=${s.id}" title="Share progress" aria-label="Share progress">${U.icon('share')}</button>
            <button class="icon-btn" data-act="subject-menu" data-id="${s.id}" aria-label="More">${U.icon('more_vert')}</button>
          </div>
        </div>
        <div class="datestrip-plain">${TI.ui.dateStrip({ count: ctx.desktop ? 18 : 14, fn: (d) => st.subjectDay(state, s.id, d), color: s.color, act: 'subject-day' })}</div>
        <div class="subject-grid">
          <div class="subject-col">
            <div class="card stat-card" style="--c:${s.color}">
              <div class="name">${U.esc(s.name)}</div>
              <div class="bar-row">${TI.ui.bar(r, s.color, 'thick')}<span class="pct">${U.pctInt(r)}</span></div>
              <div class="stat-tiles">
                <div class="stat-tile"><div class="l">Spent Today</div><div class="v">${U.fmtDur(st.subjectDay(state, s.id, today))}</div></div>
                <div class="stat-tile"><div class="l">Spent Total</div><div class="v">${U.fmtDur(st.subjectTime(state, s.id))}</div></div>
                <div class="stat-tile"><div class="l">Mastered</div><div class="v">${st.partsDone(state, s.id)}</div></div>
              </div>
            </div>
            ${TI.timerCard.render({ subjectId: s.id })}
            <div class="quick-links">
              <button class="ql" data-act="nav" data-to="/cards/${s.id}">${U.icon('style')}<span class="grow"><b>Flashcards</b><span>${cards.length ? `${due} due · ${cards.length} total` : 'Add cards to revise'}</span></span>${due ? `<span class="badge hot">${due}</span>` : U.icon('chevron_right', 'faint')}</button>
              <button class="ql" data-act="nav" data-to="/notes/${s.id}">${U.icon('sticky_note_2')}<span class="grow"><b>Notes</b><span>${notes ? U.plural(notes, 'note') : 'Write your first note'}</span></span>${U.icon('chevron_right', 'faint')}</button>
            </div>
          </div>
          <div class="subject-col">
            <div class="card">
              <div class="card-head"><h3>Syllabus</h3><span class="small muted">${st.partsDone(state, s.id)} mastered</span>
                <div class="actions"><button class="icon-btn sm muted" data-act="expand-all" data-id="${s.id}" title="Expand all" aria-label="Expand all">${U.icon('unfold_more')}</button><button class="icon-btn sm muted" data-act="collapse-all" data-id="${s.id}" title="Collapse all" aria-label="Collapse all">${U.icon('unfold_less')}</button></div></div>
              ${TI.tree.render(s.id, { showPlay: true })}
            </div>
            ${sessionsCard(s)}
          </div>
        </div>
      </div>`;
    },
    actions: {
      'subject-day': (el) => {
        const s = sel.subject(TI.router.current.params[0]); if (!s) return;
        const day = el.dataset.day;
        const list = state.sessions.filter((x) => x.subjectId === s.id && U.dayKey(x.start) === day);
        TI.ui.toast(`${U.fmtDay(day)}: ${U.fmtDur(U.sum(list, (x) => x.duration))} on ${s.name}`, { icon: 'calendar_today', action: { label: 'Details', fn: () => TI.forms.dayDetails(day, s.projectId) } });
      },
      'log-time': (el) => TI.forms.logTimeForm({ subjectId: el.dataset.id }),
      'del-session': async (el) => { if (await TI.ui.confirmDialog('Delete this session?', 'The time will be removed from your stats.')) actions.deleteSession(el.dataset.id); },
      'expand-all': (el) => {
        const map = { ...state.ui.expandedNodes };
        state.nodes.filter((n) => n.subjectId === el.dataset.id).forEach((n) => { if (TI.stats.children(state, n.subjectId, n.id).length) map[n.id] = 1; });
        actions.setUi({ expandedNodes: map });
      },
      'collapse-all': (el) => {
        const map = { ...state.ui.expandedNodes };
        state.nodes.filter((n) => n.subjectId === el.dataset.id).forEach((n) => { delete map[n.id]; });
        actions.setUi({ expandedNodes: map });
      },
    },
  };

  TI.screens.subject = screen;
})(window.TI);
