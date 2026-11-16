// Schedule: day view of planned study blocks (with repeats), linked to subjects and the timer.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  const HOUR = 60; // px per hour
  let day = null;

  function layout(blocks) {
    // assign columns to overlapping blocks
    const items = blocks.map((b) => ({ b, s: U.hmToMin(b.start), e: Math.max(U.hmToMin(b.end), U.hmToMin(b.start) + 15) }));
    const groups = []; let cur = []; let end = -1;
    items.forEach((it) => { if (it.s >= end && cur.length) { groups.push(cur); cur = []; } cur.push(it); end = Math.max(end, it.e); });
    if (cur.length) groups.push(cur);
    groups.forEach((g) => {
      const cols = [];
      g.forEach((it) => { let c = cols.findIndex((ce) => ce <= it.s); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = it.e; it.col = c; });
      g.forEach((it) => { it.cols = cols.length; });
    });
    return items;
  }

  function blockForm(existing = null, preset = {}) {
    const p = sel.activeProject();
    const subjects = p ? sel.subjects(p.id) : [];
    if (!subjects.length) return TI.ui.toast('Add a subject first', { icon: 'info' });
    let sid = existing ? existing.subjectId : preset.subjectId || subjects[0].id;
    const startDefault = preset.start || U.minToHm(Math.min(23 * 60, Math.ceil((new Date().getHours() * 60 + new Date().getMinutes()) / 30) * 30));
    const endDefault = preset.end || U.minToHm(Math.min(23 * 60 + 59, U.hmToMin(startDefault) + 60));
    const topicOptions = (id, cur) => ['<option value="">Whole subject</option>', ...TI.stats.leaves(state, id).map((l) => `<option value="${l.node.id}" ${l.node.id === cur ? 'selected' : ''}>${U.esc([...l.path, l.node.title].join(' › '))}</option>`)].join('');
    const v = existing || { title: '', date: preset.date || day || U.today(), start: startDefault, end: endDefault, repeat: 'none', nodeId: null };
    TI.ui.openSheet({
      title: existing ? 'Edit study block' : 'Plan a study block',
      html: `<div class="field"><label>What will you study?</label><input class="input" id="b-title" placeholder="e.g. Algebra practice set" value="${U.esc(v.title)}" maxlength="80" autofocus /></div>
        <div class="field-row"><div class="field"><label>Subject</label><select class="select" id="b-subject">${subjects.map((s) => `<option value="${s.id}" ${s.id === sid ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Topic</label><select class="select" id="b-topic">${topicOptions(sid, v.nodeId)}</select></div></div>
        <div class="field"><label>Date</label><input class="input" type="date" id="b-date" value="${v.date}" /></div>
        <div class="field-row"><div class="field"><label>Start</label><input class="input" type="time" id="b-start" value="${v.start}" /></div><div class="field"><label>End</label><input class="input" type="time" id="b-end" value="${v.end}" /></div></div>
        <div class="chips" style="margin:-4px 0 14px">${[30, 45, 60, 90, 120].map((m) => `<button class="chip" data-act="len" data-m="${m}">${U.fmtMin(m)}</button>`).join('')}</div>
        <div class="field"><label>Repeat</label>${TI.ui.seg([{ id: 'none', label: 'Once' }, { id: 'daily', label: 'Daily' }, { id: 'weekdays', label: 'Weekdays' }, { id: 'weekly', label: 'Weekly' }], v.repeat || 'none', 'rep')}</div>`,
      footer: '<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-act="save">Save</button>',
      onMount(a) {
        const $ = (q) => a.el.querySelector(q);
        let repeat = v.repeat || 'none';
        $('#b-subject').addEventListener('change', (e) => { sid = e.target.value; $('#b-topic').innerHTML = topicOptions(sid, null); });
        TI.forms.onAct(a, {
          rep(t) { repeat = t.dataset.v; a.el.querySelectorAll('[data-act="rep"]').forEach((b) => b.classList.toggle('on', b.dataset.v === repeat)); },
          len(t) { $('#b-end').value = U.minToHm(Math.min(23 * 60 + 59, U.hmToMin($('#b-start').value) + +t.dataset.m)); },
          save() {
            const start = $('#b-start').value; const end = $('#b-end').value;
            if (!start || !end || U.hmToMin(end) <= U.hmToMin(start)) { TI.ui.toast('End time must be after start time', { icon: 'error' }); return; }
            const data = { title: $('#b-title').value.trim(), subjectId: sid, nodeId: $('#b-topic').value || null, date: $('#b-date').value || U.today(), start, end, repeat };
            if (existing) actions.updateBlock(existing.id, data); else actions.addBlock(data);
            day = data.date; a.close();
          },
        });
      },
    });
  }

  function blockSheet(id, d) {
    const b = state.blocks.find((x) => x.id === id); if (!b) return;
    const s = sel.subject(b.subjectId); const node = b.nodeId ? sel.node(b.nodeId) : null;
    const done = (b.doneDates || []).includes(d);
    const rep = { none: 'Does not repeat', daily: 'Every day', weekdays: 'Every weekday', weekly: `Every ${U.WD[U.parseDay(b.date).getDay()]}` }[b.repeat || 'none'];
    TI.ui.openSheet({
      title: b.title || (s ? s.name : 'Study block'),
      html: `<div class="list">
        <div class="list-item" style="--c:${s ? s.color : ''}"><span class="lead">${U.icon('menu_book')}</span><div class="txt"><div class="ttl">${U.esc(s ? s.name : 'Deleted subject')}</div><div class="sub">${node ? U.esc(node.title) : 'Whole subject'}</div></div></div>
        <div class="list-item"><span class="lead">${U.icon('schedule')}</span><div class="txt"><div class="ttl">${U.fmtDay(d)} · ${U.fmtHmLabel(b.start, state.settings.h12)} – ${U.fmtHmLabel(b.end, state.settings.h12)}</div><div class="sub">${U.fmtMin(U.hmToMin(b.end) - U.hmToMin(b.start))} · ${rep}</div></div></div></div>
        <div class="row wrap" style="margin-top:16px">
          ${s ? `<button class="btn tint" style="--c:${s.color}" data-act="focus">${U.icon('play_arrow', 'fill')}Start focus</button>` : ''}
          <button class="btn" data-act="done">${U.icon(done ? 'undo' : 'task_alt')}${done ? 'Mark not done' : 'Mark done'}</button>
          <button class="btn ghost" data-act="edit">${U.icon('edit')}Edit</button>
          <button class="btn danger" data-act="del">${U.icon('delete')}Delete</button></div>`,
      onMount(a) {
        TI.forms.onAct(a, {
          focus() { a.close(); if (TI.timer.isActive() && TI.timer.state.subjectId !== b.subjectId) { TI.ui.toast('Stop the running timer first', { icon: 'timer' }); return; } TI.timer.setTarget(b.subjectId, b.nodeId); TI.timer.start(); TI.router.go('/subject/' + b.subjectId); },
          done() { actions.toggleBlockDone(b.id, d); a.close(); },
          edit() { a.close(); blockForm(b); },
          async del() {
            if (b.repeat && b.repeat !== 'none') {
              const v = await TI.ui.dialog({ title: 'Delete repeating block', message: 'Delete only this day, or every occurrence?', buttons: [{ label: 'Cancel', kind: 'ghost', value: () => null }, { label: 'This day', value: () => 'one' }, { label: 'All', kind: 'danger', primary: true, value: () => 'all' }] });
              if (!v) return; actions.deleteBlock(b.id, v === 'one' ? d : null);
            } else if (await TI.ui.confirmDialog('Delete this block?', b.title || '')) actions.deleteBlock(b.id); else return;
            a.close();
          },
        });
      },
    });
  }

  const screen = {
    title: 'Schedule',
    render(ctx) {
      if (!day) day = U.today();
      const st = state.settings;
      const p = sel.activeProject();
      const sids = new Set(p ? sel.subjects(p.id).map((s) => s.id) : []);
      const blocks = sel.blocksOn(day).filter((b) => sids.has(b.subjectId));
      const d = U.parseDay(day);
      const ws = (d.getDay() - st.weekStart + 7) % 7;
      const week = [...Array(7)].map((_, i) => U.dayKey(U.addDays(d, i - ws)));
      const isToday = day === U.today();
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const planned = U.sum(blocks, (b) => U.hmToMin(b.end) - U.hmToMin(b.start));
      const doneCount = blocks.filter((b) => (b.doneDates || []).includes(day)).length;
      const studied = p ? TI.stats.projectDay(state, p.id, day) : 0;
      const items = layout(blocks);

      return `<div class="page-head"><div><h1>Schedule</h1><div class="sub">${U.fmtDay(day)}${!isToday ? '' : ' · ' + U.WD[d.getDay()] + ', ' + U.fmtDate(d)}</div></div>
          <div class="actions"><button class="icon-btn" data-act="sch-prev" aria-label="Previous day">${U.icon('chevron_left')}</button><button class="btn sm" data-act="sch-today" ${isToday ? 'disabled' : ''}>Today</button><button class="icon-btn" data-act="sch-next" aria-label="Next day">${U.icon('chevron_right')}</button>
          <button class="btn primary desktop-only" data-act="sch-add">${U.icon('add')}Add block</button></div></div>
        <div class="weekstrip">${week.map((k) => { const kd = U.parseDay(k); const n = sel.blocksOn(k).filter((b) => sids.has(b.subjectId)).length; return `<button class="wday ${k === day ? 'on' : ''} ${k === U.today() ? 'today' : ''}" data-act="sch-day" data-day="${k}"><span>${U.WD[kd.getDay()]}</span><b>${kd.getDate()}</b><i>${'•'.repeat(Math.min(n, 4)) || '&nbsp;'}</i></button>`; }).join('')}</div>
        <div class="sched-grid">
          <div class="card flat timeline-wrap"><div class="timeline" style="height:${24 * HOUR}px" data-act="sch-slot">
            ${[...Array(24)].map((_, h) => `<div class="hour" style="top:${h * HOUR}px"><span>${h === 0 ? '' : U.fmtHmLabel(U.minToHm(h * 60), st.h12)}</span></div>`).join('')}
            ${items.map((it) => {
              const b = it.b; const s = sel.subject(b.subjectId); const done = (b.doneDates || []).includes(day);
              const top = (it.s / 60) * HOUR; const h = Math.max(22, ((it.e - it.s) / 60) * HOUR - 3);
              const w = 100 / it.cols;
              return `<button class="blk ${done ? 'done' : ''} ${h < 40 ? 'tiny-blk' : ''}" style="--c:${s ? s.color : '#888'};top:${top}px;height:${h}px;left:calc(56px + (100% - 64px) * ${(it.col * w) / 100});width:calc((100% - 64px) * ${w / 100} - 4px)" data-act="sch-block" data-id="${b.id}">
                <b class="ellipsis">${done ? U.icon('check_circle', 'fill xs') : ''}${U.esc(b.title || (s ? s.name : ''))}</b><span class="ellipsis">${U.fmtHmLabel(b.start, st.h12)} – ${U.fmtHmLabel(b.end, st.h12)}${s && b.title ? ' · ' + U.esc(s.name) : ''}${b.repeat && b.repeat !== 'none' ? ' · ' + U.icon('repeat', 'xs') : ''}</span></button>`;
            }).join('')}
            ${isToday ? `<div class="now-line" style="top:${(nowMin / 60) * HOUR}px"></div>` : ''}
          </div></div>
          <aside class="sched-aside">
            <div class="kpis">${TI.ui.kpi('event_note', 'Planned', U.fmtMin(planned), U.plural(blocks.length, 'block'), '#405FFF')}${TI.ui.kpi('schedule', 'Studied', U.fmtDur(studied, { noDays: true }), `${doneCount}/${blocks.length} blocks done`, '#25AE97')}</div>
            <div class="card" style="margin-top:14px"><div class="card-head"><h3>Plan for ${U.fmtDay(day).toLowerCase() === 'today' ? 'today' : U.fmtDay(day)}</h3></div>
              ${blocks.length ? `<div class="list">${blocks.map((b) => { const s = sel.subject(b.subjectId); const done = (b.doneDates || []).includes(day); return `<div class="list-item" style="--c:${s ? s.color : ''}"><button class="check-btn ${done ? 'done' : ''}" data-act="sch-toggle" data-id="${b.id}" aria-label="Mark done">${U.icon('check')}</button><div class="txt click" data-act="sch-block" data-id="${b.id}" style="cursor:pointer"><div class="ttl" style="${done ? 'text-decoration:line-through;opacity:.6' : ''}">${U.esc(b.title || (s ? s.name : ''))}</div><div class="sub">${U.fmtHmLabel(b.start, st.h12)} · ${U.fmtMin(U.hmToMin(b.end) - U.hmToMin(b.start))} · ${U.esc(s ? s.name : '')}</div></div></div>`; }).join('')}</div>`
                : `<div class="small muted">Nothing planned. Click a time slot or “Add block”.</div>`}
              <button class="btn outline block" style="margin-top:12px" data-act="sch-add">${U.icon('add')}Add block</button></div>
          </aside>
        </div>
        <button class="fab phone-only" data-act="sch-add">${U.icon('add')}Add block</button>`;
    },
    mount(root) {
      const wrap = root.querySelector('.timeline-wrap'); if (!wrap) return;
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const target = day === U.today() ? Math.max(0, (nowMin / 60 - 1.5) * HOUR) : 6.5 * HOUR;
      if (screen._scrolledFor !== day) { wrap.scrollTop = target; screen._scrolledFor = day; } else if (screen._lastScroll != null) wrap.scrollTop = screen._lastScroll;
      wrap.addEventListener('scroll', () => { screen._lastScroll = wrap.scrollTop; }, { passive: true });
    },
    actions: {
      'sch-prev': () => { day = U.addDaysKey(day, -1); TI.store.bump(); },
      'sch-next': () => { day = U.addDaysKey(day, 1); TI.store.bump(); },
      'sch-today': () => { day = U.today(); TI.store.bump(); },
      'sch-day': (el) => { day = el.dataset.day; TI.store.bump(); },
      'sch-add': () => blockForm(null, { date: day }),
      'sch-block': (el) => blockSheet(el.dataset.id, day),
      'sch-toggle': (el) => actions.toggleBlockDone(el.dataset.id, day),
      'sch-slot': (el, e) => {
        const r = el.getBoundingClientRect(); const y = e.clientY - r.top;
        const start = Math.floor((y / HOUR) * 2) * 30;
        blockForm(null, { date: day, start: U.minToHm(start), end: U.minToHm(Math.min(start + 60, 23 * 60 + 59)) });
      },
    },
    blockForm,
  };
  TI.screens.schedule = screen;
})(window.TI);
