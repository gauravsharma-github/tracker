// Insights: time charts, subject split, completion timeline, consistency heatmap, best hours.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;

  const RANGES = [{ id: 'week', label: 'Week', days: 7 }, { id: 'month', label: 'Month', days: 30 }, { id: 'quarter', label: '3 months', days: 91 }];

  const screen = {
    title: 'Insights',
    render(ctx) {
      const p = sel.activeProject();
      const range = RANGES.find((r) => r.id === state.ui.insightsRange) || RANGES[0];
      const scopeAll = state.ui.insightsScope === 'all' || !p;
      const subjects = scopeAll ? state.subjects : sel.subjects(p.id);
      const sids = new Set(subjects.map((s) => s.id));
      const today = U.today();
      const days = [...Array(range.days)].map((_, i) => U.addDaysKey(today, i - range.days + 1));
      const from = U.startOfDay(U.parseDay(days[0])).getTime();
      const prevFrom = from - range.days * 86400000;
      const sess = state.sessions.filter((s) => sids.has(s.subjectId));
      const inRange = sess.filter((s) => s.start >= from);
      const prev = sess.filter((s) => s.start >= prevFrom && s.start < from);
      const total = U.sum(inRange, (s) => s.duration); const prevTotal = U.sum(prev, (s) => s.duration);
      const delta = prevTotal ? (total - prevTotal) / prevTotal : null;
      const activeDays = new Set(inRange.map((s) => U.dayKey(s.start))).size;
      const scope = scopeAll ? { type: 'all' } : { type: 'project', id: p.id };
      const streak = TI.stats.streaks(state, scope);
      const doneTopics = state.nodes.filter((n) => sids.has(n.subjectId) && n.done && (n.doneAt || 0) >= from).length;
      const reviews = state.reviews.filter((r) => sids.has(r.subjectId) && r.at >= from).length;

      // Chart buckets
      let labels; let series;
      const subjList = subjects.filter((s) => inRange.some((x) => x.subjectId === s.id));
      if (range.id === 'quarter') {
        const weeks = 13; labels = [...Array(weeks)].map((_, i) => U.addDaysKey(today, -7 * (weeks - 1 - i)));
        series = subjList.map((s) => ({ name: s.name, color: s.color, values: labels.map((end) => { const e = U.endOfDay(U.parseDay(end)).getTime(); const st0 = e - 7 * 86400000; return U.sum(inRange.filter((x) => x.subjectId === s.id && x.start > st0 && x.start <= e), (x) => x.duration); }) }));
      } else {
        labels = days;
        series = subjList.map((s) => ({ name: s.name, color: s.color, values: days.map((d) => TI.stats.subjectDay(state, s.id, d)) }));
      }
      const fmtLabel = (l) => { const d = U.parseDay(l); return range.id === 'week' ? U.WD[d.getDay()] : `${d.getDate()} ${U.MONTHS[d.getMonth()]}`; };
      const split = TI.stats.bySubject(state, inRange);

      // Best hours
      const hours = Array(24).fill(0); inRange.forEach((s) => { hours[new Date(s.start).getHours()] += s.duration; });
      const maxH = Math.max(...hours, 1); const bestHour = hours.indexOf(Math.max(...hours));
      const part = bestHour < 12 ? 'morning' : bestHour < 17 ? 'afternoon' : bestHour < 21 ? 'evening' : 'night';

      // Completion timeline (project scope only)
      const compDays = range.id === 'week' ? days : days.filter((_, i) => i % (range.id === 'month' ? 2 : 7) === 0 || i === days.length - 1);
      const comp = !scopeAll ? TI.stats.completionSeries(state, p.id, compDays) : null;

      const recent = inRange.slice().sort((a, b) => b.start - a.start).slice(0, 12);

      return `<div class="page-head"><div><h1>Insights</h1><div class="sub">${scopeAll ? 'All projects' : U.esc(p.name)}</div></div>
          <div class="actions">${p ? TI.ui.seg([{ id: 'project', label: 'This project' }, { id: 'all', label: 'All' }], scopeAll ? 'all' : 'project', 'ins-scope', 'alt') : ''}${TI.ui.seg(RANGES, range.id, 'ins-range')}</div></div>
        <div class="kpis ins-kpis">
          ${TI.ui.kpi('schedule', 'Time studied', U.fmtDur(total, { noDays: true }), delta == null ? `last ${range.days} days` : `${delta >= 0 ? '▲' : '▼'} ${U.pctInt(Math.abs(delta))} vs previous`, '#405FFF')}
          ${TI.ui.kpi('avg_time', 'Daily average', U.fmtDur(total / range.days, { noDays: true }), `${activeDays} of ${range.days} days active`, '#25AE97')}
          ${TI.ui.kpi('local_fire_department', 'Current streak', U.plural(streak.current, 'day'), `Best ${U.plural(streak.best, 'day')}`, '#F06A3A')}
          ${TI.ui.kpi('task_alt', 'Topics completed', String(doneTopics), `in the last ${range.days} days`, '#C74FFA')}
          ${TI.ui.kpi('style', 'Cards reviewed', String(reviews), 'spaced repetition', '#E0AD3C')}
          ${TI.ui.kpi('wb_sunny', 'Best time', total ? `${U.fmtHmLabel(U.minToHm(bestHour * 60), state.settings.h12)}` : '–', total ? `You focus most in the ${part}` : 'Study to find out', '#64B7D4')}
        </div>
        <div class="ins-grid">
          <div class="card ins-wide"><div class="card-head"><h3>Study time</h3><span class="small muted">${range.id === 'quarter' ? 'per week' : 'per day'}</span></div>
            ${total ? TI.charts.barChart({ labels, series, fmtLabel, highlight: labels.length - 1 }) : TI.ui.empty('bar_chart', 'No study time in this period', 'Start a focus session and it will show up here.')}
            ${series.length ? `<div class="legend">${series.map((s) => `<span style="--c:${s.color}"><i></i>${U.esc(s.name)}</span>`).join('')}</div>` : ''}</div>
          <div class="card"><div class="card-head"><h3>By subject</h3></div>
            ${split.length ? `<div class="hbars">${split.map((x) => `<div class="hbar"><div class="top"><span class="ellipsis">${U.esc(x.subject.name)}</span><span class="v">${U.fmtDur(x.sec, { noDays: true })} · ${U.pctInt(x.sec / total)}</span></div>${TI.ui.bar(x.sec / split[0].sec, x.subject.color)}</div>`).join('')}</div>` : '<div class="small muted">No data yet.</div>'}</div>
          <div class="card"><div class="card-head"><h3>Hours of the day</h3></div>
            <div class="hours">${hours.map((v, h) => `<div class="hcol" title="${U.fmtHmLabel(U.minToHm(h * 60), state.settings.h12)} · ${U.fmtDur(v)}"><i style="height:${Math.max(2, (v / maxH) * 100)}%;${h === bestHour && v ? 'background:var(--primary)' : ''}"></i></div>`).join('')}</div>
            <div class="hours-axis"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span></div></div>
          ${comp ? `<div class="card ins-wide"><div class="card-head"><h3>Syllabus completion</h3><span class="small muted">${U.pct(comp[comp.length - 1], 1)} now</span></div>
            ${TI.charts.areaChart({ labels: compDays, values: comp, color: p.color, fmt: (v) => `${+(v * 100).toFixed(1)}%`, fmtLabel: (l) => { const d = U.parseDay(l); return `${d.getDate()} ${U.MONTHS[d.getMonth()]}`; } })}</div>` : ''}
          <div class="card ins-full"><div class="card-head"><h3>Consistency</h3><span class="small muted">${streak.activeDays} active days in total</span></div>${TI.charts.heatmap({ fn: TI.stats.dayFn(state, scope), weeks: ctx.desktop ? 30 : 18, weekStart: state.settings.weekStart })}</div>
          <div class="card ins-full"><div class="card-head"><h3>Timeline</h3><div class="actions"><button class="btn sm ghost" data-act="ins-log">${U.icon('more_time')}Log time</button></div></div>
            ${recent.length ? `<div class="list">${recent.map((x) => { const s = sel.subject(x.subjectId); const n = x.nodeId ? sel.node(x.nodeId) : null; return `<div class="list-item click" data-act="ins-day" data-day="${U.dayKey(x.start)}" style="--c:${s ? s.color : ''}"><span class="lead">${U.icon(x.manual ? 'edit_calendar' : 'check_circle')}</span><div class="txt"><div class="ttl">${U.esc(s ? s.name : '')}${n ? ` <span class="muted">› ${U.esc(n.title)}</span>` : ''}</div><div class="sub">${U.fmtDay(U.dayKey(x.start))}, ${U.fmtTime(x.start, state.settings.h12)}</div></div><span class="trail">${U.fmtDur(x.duration, { short: true })}</span></div>`; }).join('')}</div>` : '<div class="small muted">No sessions in this period.</div>'}</div>
        </div>`;
    },
    actions: {
      'ins-range': (el) => actions.setUi({ insightsRange: el.dataset.v }),
      'ins-scope': (el) => actions.setUi({ insightsScope: el.dataset.v }),
      'ins-log': () => TI.forms.logTimeForm({}),
      'ins-day': (el) => TI.forms.dayDetails(el.dataset.day, state.ui.insightsScope === 'all' ? null : (sel.activeProject() || {}).id),
    },
  };
  TI.screens.insights = screen;
})(window.TI);
