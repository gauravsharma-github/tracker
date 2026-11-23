// Dashboard: every exam / project as a tile, most recently updated first.
(function (TI) {
  TI.screens = TI.screens || {};
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  const catOf = (id) => TI.config.projectCategories.find((c) => c.id === id) || TI.config.projectCategories[3];
  const SORTS = [{ id: 'recent', label: 'Recent' }, { id: 'progress', label: 'Progress' }, { id: 'name', label: 'Name' }];

  function projectFacts(p) {
    const st = TI.stats; const today = U.today();
    const prog = st.projectProgress(state, p.id);
    const subjects = sel.subjects(p.id);
    const sids = new Set(subjects.map((s) => s.id));
    return {
      prog, ratio: st.projectRatio(state, p.id),
      total: st.projectTime(state, p.id),
      today: st.projectDay(state, p.id, today),
      updated: st.lastActivity(state, p.id),
      streak: st.streaks(state, { type: 'project', id: p.id }).current,
      cards: U.sum(subjects, (s) => st.dueCards(state, s.id).length),
      topicsDue: U.sum(subjects, (s) => st.dueTopics(state, s.id).length),
      subjects: subjects.length,
      files: state.attachments.filter((a) => sids.has(a.subjectId)).length,
      days: [...Array(14)].map((_, i) => st.projectDay(state, p.id, U.addDaysKey(today, i - 13))),
    };
  }

  function tile(p, f, isActive) {
    const cat = catOf(p.category); const max = Math.max(...f.days, 1);
    return `<div class="pj-tile ${isActive ? 'is-active' : ''}" style="--c:${p.color}" data-act="ov-open" data-id="${p.id}" tabindex="0" role="button" aria-label="Open ${U.esc(p.name)}">
      <div class="pj-top"><span class="pj-cat">${U.icon(cat.icon, 'xs')}${cat.label}</span>${isActive ? '<span class="badge blue">Current</span>' : ''}<span class="grow"></span>
        <button class="icon-btn sm muted" data-act="ov-menu" data-id="${p.id}" aria-label="More for ${U.esc(p.name)}">${U.icon('more_vert')}</button></div>
      <div class="pj-main">${TI.ui.ring(f.ratio, p.color, { size: 76, stroke: 7, label: `<span style="font-size:14px">${U.pctInt(f.ratio)}</span>` })}
        <div class="grow" style="min-width:0"><div class="pj-name">${U.esc(p.name)}</div><div class="small muted">${f.updated ? `Updated ${U.timeAgo(f.updated).toLowerCase()}` : 'Not started'}</div></div></div>
      <div class="pj-stats">
        <div><b>${f.prog.done}<span class="faint">/${f.prog.leaves}</span></b><span>Mastered</span></div>
        <div><b>${U.fmtDur(f.total, { noDays: true })}</b><span>Total time</span></div>
        <div><b>${U.fmtDur(f.today, { noDays: true })}</b><span>Today</span></div>
      </div>
      <div class="pj-spark" title="Study time, last 14 days">${f.days.map((v, i) => `<i style="height:${Math.max(6, (v / max) * 100)}%;${v ? '' : 'opacity:.35'}" title="${U.fmtDay(U.addDaysKey(U.today(), i - 13))} · ${U.fmtDur(v)}"></i>`).join('')}</div>
      <div class="pj-foot">
        <span title="Current streak">${U.icon('local_fire_department', 'fill xs')}${U.plural(f.streak, 'day')}</span>
        <span>${U.icon('menu_book', 'xs')}${U.plural(f.subjects, 'subject')}</span>
        ${f.cards ? `<span class="hot">${U.icon('style', 'xs')}${f.cards} cards due</span>` : ''}
        ${f.topicsDue ? `<span class="hot">${U.icon('event', 'xs')}${U.plural(f.topicsDue, 'topic')} due</span>` : ''}
        ${f.files ? `<span>${U.icon('attach_file', 'xs')}${U.plural(f.files, 'file')}</span>` : ''}
      </div>
    </div>`;
  }

  const screen = {
    title: 'Dashboard',
    render(ctx) {
      const all = sel.projects(true);
      if (!all.length) return TI.screens.project.welcome();
      const current = sel.activeProject();
      const open = all.filter((p) => !p.archived); const archived = all.filter((p) => p.archived);
      const facts = new Map(all.map((p) => [p.id, projectFacts(p)]));
      const sort = SORTS.some((s) => s.id === state.ui.ovSort) ? state.ui.ovSort : 'recent';
      const order = (list) => list.slice().sort((a, b) => {
        const fa = facts.get(a.id); const fb = facts.get(b.id);
        if (sort === 'progress') return fb.ratio - fa.ratio || fb.updated - fa.updated;
        if (sort === 'name') return a.name.localeCompare(b.name);
        return fb.updated - fa.updated;
      });
      const today = U.today();
      const week = U.sum([...Array(7)].map((_, i) => U.addDaysKey(today, -i)), (d) => TI.stats.allDay(state, d));
      const topics = open.reduce((acc, p) => { const f = facts.get(p.id); acc.done += f.prog.done; acc.all += f.prog.leaves; return acc; }, { done: 0, all: 0 });
      const due = U.sum(open, (p) => facts.get(p.id).cards + facts.get(p.id).topicsDue);
      const streak = TI.stats.streaks(state, { type: 'all' });
      return `<div class="page-head"><div><h1>Dashboard</h1><div class="sub">${U.plural(open.length, 'project')}${archived.length ? ` · ${archived.length} archived` : ''}</div></div>
          <div class="actions">${TI.ui.seg(SORTS, sort, 'ov-sort', 'alt')}<button class="btn primary desktop-only" data-act="nav" data-to="/templates">${U.icon('add')}Add project</button></div></div>
        <div class="kpis ov-kpis">
          ${TI.ui.kpi('today', 'Today', U.fmtDur(TI.stats.allDay(state, today), { noDays: true }), `Goal ${U.fmtMin(state.settings.dailyGoalMin)}`, '#E0AD3C')}
          ${TI.ui.kpi('date_range', 'Last 7 days', U.fmtDur(week, { noDays: true }), `${U.fmtDur(week / 7, { noDays: true })} a day`, '#25AE97')}
          ${TI.ui.kpi('local_fire_department', 'Streak', U.plural(streak.current, 'day'), `Best ${streak.best}`, '#F06A3A')}
          ${TI.ui.kpi('military_tech', 'Topics mastered', `${topics.done}/${topics.all}`, 'All 5 stages done', '#405FFF')}
          ${TI.ui.kpi('notifications_active', 'Due now', String(due), 'Cards and topics', '#C74FFA')}
        </div>
        ${TI.heatmap.render('all', { weeks: ctx.desktop ? 53 : 20, title: 'Progress Heatmap · all projects' })}
        <div class="pj-grid">${order(open).map((p) => tile(p, facts.get(p.id), current && current.id === p.id)).join('')}
          <button class="pj-tile pj-add" data-act="nav" data-to="/templates">${U.icon('add_circle')}<b>Add exam / project</b><span>From 1000+ templates, AI or a friend's file</span></button>
        </div>
        ${archived.length ? `<details class="ov-archived"><summary>Archived (${archived.length})</summary><div class="card flat proj-list">${order(archived).map((p) => `<div class="proj-row" style="--c:${p.color}">${TI.ui.ring(facts.get(p.id).ratio, p.color, { size: 40, stroke: 4, labelSize: 10 })}<div class="grow" style="min-width:0"><b class="ellipsis" style="display:block">${U.esc(p.name)}</b><div class="small muted">Updated ${U.timeAgo(facts.get(p.id).updated).toLowerCase()}</div></div><button class="icon-btn muted" data-act="ov-menu" data-id="${p.id}" aria-label="More">${U.icon('more_vert')}</button></div>`).join('')}</div></details>` : ''}`;
    },
    actions: {
      'ov-open': (el) => { actions.setActiveProject(el.dataset.id); TI.router.go('/project'); },
      'ov-menu': (el) => TI.screens.projects.actions['proj-menu'](el),
      'ov-sort': (el) => actions.setUi({ ovSort: el.dataset.v }),
    },
  };
  TI.screens.home = screen;
})(window.TI);
