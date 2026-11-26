// Boot, routing → screens, rendering, event delegation and keyboard shortcuts.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  const $app = document.getElementById('app');
  const $view = document.getElementById('view');
  const $side = document.getElementById('sidebar');
  const $tabs = document.getElementById('bottomnav');
  let current = null; let unmount = null; let lastKey = ''; let queued = false;

  const go = (to) => TI.router.go(to);
  const screenFor = (r) => TI.screens[r.name] || TI.screens.home;
  const ctx = () => { const r = TI.router.current; return { route: r, params: r.params, query: r.query, desktop: TI.layout.isDesktop(), wide: TI.layout.isWide() }; };

  function render(force = false) {
    queued = false;
    if (!state.ready) return;
    const c = ctx(); const scr = screenFor(c.route);
    // Screens marked static (the PDF/audio viewer) keep their DOM while data changes in the background
    if (!force && scr.static && current === scr && c.route.path + '?' + JSON.stringify(c.query) === lastKey) return;
    const ae = document.activeElement; let focusKey = null; let s0 = 0; let s1 = 0;
    if (ae && ae.dataset && ae.dataset.input && $view.contains(ae)) { focusKey = ae.dataset.input; s0 = ae.selectionStart; s1 = ae.selectionEnd; }
    const routeKey = c.route.path + '?' + JSON.stringify(c.query);
    if (unmount) { try { unmount(); } catch (e) { console.error(e); } unmount = null; }
    TI.theme.apply(state.settings.theme);
    $app.classList.toggle('fullscreen', !!scr.fullscreen);
    $app.classList.toggle('no-nav', !!(scr.fullscreen || scr.hideNav));
    $app.dataset.screen = c.route.name;
    let html;
    try { html = scr.render(c); } catch (e) {
      console.error(e);
      html = TI.ui.empty('error', 'Something went wrong', U.esc(e.message), '<button class="btn primary" data-act="nav" data-to="/">Go to dashboard</button>');
    }
    $view.innerHTML = html;
    if (!scr.fullscreen) {
      $side.innerHTML = TI.sidebar.render(c.route);
      $tabs.innerHTML = TI.sidebar.renderTabs(c.route);
    }
    current = scr;
    if (scr.mount) { try { const u = scr.mount($view, c); if (typeof u === 'function') unmount = u; } catch (e) { console.error(e); } }
    if (focusKey) { const el = $view.querySelector(`[data-input="${focusKey}"]`); if (el) { el.focus(); try { el.setSelectionRange(s0, s1); } catch (e) { /* ignore */ } } }
    if (routeKey !== lastKey) { if (lastKey.split('?')[0] !== routeKey.split('?')[0]) window.scrollTo(0, 0); lastKey = routeKey; }
    TI.timerCard.tick();
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => render(false)); } };

  // ---------------- Global actions ----------------
  function subjectMenu(el, id) {
    const s = sel.subject(id); if (!s) return;
    const onPage = TI.router.current.name === 'subject';
    TI.ui.openMenu(el, [
      ...(onPage ? [] : [{ icon: 'open_in_new', label: 'Open subject', onClick: () => go('/subject/' + s.id) }]),
      { icon: 'edit', label: 'Edit name & colour', onClick: () => TI.forms.subjectForm(s) },
      { icon: 'playlist_add', label: 'Add units / topics', onClick: () => TI.forms.topicForm(s.id, null) },
      { icon: 'more_time', label: 'Log time manually', onClick: () => TI.forms.logTimeForm({ subjectId: s.id }) },
      { icon: 'attach_file', label: 'Attach PDF / audio to subject', onClick: () => TI.attach.pick(s.id, null) },
      { icon: 'quiz', label: 'Quiz questions spreadsheet (CSV)', onClick: () => TI.mcq.csvSheet({ subjectId: s.id }) },
      ...(TI.attach.countOn(s.id, null) ? [{ icon: 'folder_open', label: `Subject attachments (${TI.attach.countOn(s.id, null)})`, onClick: () => TI.attach.manage(s.id, null) }] : []),
      { icon: 'sticky_note_2', label: 'Add subject note', onClick: () => TI.screens.notes.edit(null, { subjectId: s.id, nodeId: null }) },
      { icon: 'event', label: 'Plan a study block', onClick: () => TI.screens.schedule.blockForm(null, { subjectId: s.id }) },
      { icon: 'style', label: 'Flashcards', onClick: () => go('/cards/' + s.id) },
      { icon: 'sticky_note_2', label: 'Notes', onClick: () => go('/notes/' + s.id) },
      { icon: 'ios_share', label: 'Share progress', onClick: () => go('/share?subject=' + s.id) },
      { sep: true },
      { icon: 'arrow_upward', label: 'Move up', onClick: () => actions.moveSubject(s.id, -1) },
      { icon: 'arrow_downward', label: 'Move down', onClick: () => actions.moveSubject(s.id, 1) },
      { sep: true },
      { icon: 'delete', label: 'Delete subject', danger: true, onClick: async () => {
        const files = state.attachments.filter((a) => a.subjectId === s.id).length;
        if (!(await TI.ui.confirmDialog(`Delete ${s.name}?`, `Its topics, study sessions, flashcards and notes${files ? ` and ${U.plural(files, 'attached file')} (also deleted from GitHub)` : ''} will be deleted. This cannot be undone.`))) return;
        if (TI.timer.state.subjectId === s.id) TI.timer.reset();
        actions.deleteSubject(s.id); if (onPage) go('/project');
      } },
    ]);
  }

  function playSubject(id) {
    const s = sel.subject(id); if (!s) return;
    const t = TI.timer;
    if (t.isActive() && t.state.subjectId !== s.id) {
      const o = sel.subject(t.state.subjectId);
      TI.ui.toast(`Timer is running for ${o ? o.name : 'another subject'}`, { icon: 'timer', action: { label: 'Open', fn: () => go('/subject/' + t.state.subjectId) } });
      return;
    }
    if (!t.isActive()) { t.setTarget(s.id, t.state.subjectId === s.id ? t.state.nodeId : null); t.start(); }
    go('/subject/' + s.id);
  }

  function openClock(subjectId) {
    try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* ignore */ }
    go('/clock' + (subjectId ? '/' + subjectId : ''));
  }

  const globalActions = {
    nav: (el) => go(el.dataset.to),
    back: (el) => TI.router.back((el && el.dataset.fallback) || (['subject', 'notes', 'study', 'flashcards'].includes(TI.router.current.name) ? '/project' : '/')),
    'project-menu': (el) => TI.forms.projectMenu(el),
    'new-project': () => TI.forms.projectForm(),
    'new-subject': () => TI.forms.subjectForm(),
    'subject-expand': (el) => actions.toggleUiFlag('expandedSubjects', el.dataset.id),
    'subject-menu': (el) => subjectMenu(el, el.dataset.id),
    'subject-play': (el) => playSubject(el.dataset.id),
    'timer-toggle': (el) => {
      const t = TI.timer; const sid = el.dataset.subject || t.state.subjectId;
      if (!sid && !t.isActive()) { TI.forms.subjectPicker({ projectId: (sel.activeProject() || {}).id, onPick: (id) => { t.start(id, null); go('/subject/' + id); } }); return; }
      if (t.isActive()) t.toggle(); else t.start(sid);
    },
    'timer-stop': () => TI.timer.stop(),
    'timer-skip': () => TI.timer.skip(),
    'timer-mode': (el) => { if (TI.timer.isActive()) { TI.ui.toast('Stop the timer to switch modes', { icon: 'info' }); return; } TI.timer.setMode(el.dataset.v); },
    'timer-topic': (el) => {
      const sid = el.dataset.subject;
      TI.forms.topicPicker({ subjectId: sid, current: TI.timer.state.subjectId === sid ? TI.timer.state.nodeId : null, onPick: (nid) => { if (!TI.timer.setTarget(sid, nid)) TI.ui.toast('Stop the running timer first', { icon: 'timer' }); } });
    },
    'timer-settings': () => TI.screens.settings.timerSheet(),
    'ambient-menu': (el) => TI.timerCard.ambientMenu(el),
    'clock-open': (el) => openClock(el.dataset.subject || TI.timer.state.subjectId),
    'theme-toggle': () => { const next = TI.theme.current() === 'dark' ? 'light' : 'dark'; actions.updateSettings({ theme: next }); TI.theme.apply(next); },
    'note-open': (el) => TI.screens.notes.edit(el.dataset.id),
    'share-options': (el) => TI.shareTpl.openOptions(el.dataset.id),
    'boot-retry': () => location.reload(),
    'boot-offline': async () => { await TI.api.disconnect({ keepCopy: false }); location.reload(); },
  };

  function findHandler(act) {
    return (current && current.actions && current.actions[act]) || TI.tree.handlers[act] || TI.attach.handlers[act] || TI.heatmap.handlers[act] || TI.sources.handlers[act] || (TI.screens.cards.actions[act]) || globalActions[act];
  }

  $app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !$app.contains(el) || el.disabled) return;
    if (e.target.closest('a[href]') && e.target.closest('a[href]') !== el && el.contains(e.target.closest('a[href]'))) return;
    const h = findHandler(el.dataset.act);
    if (h) { e.preventDefault(); h(el, e); }
  });
  $app.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act][tabindex]')) { e.preventDefault(); e.target.click(); }
  });
  $app.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.input; if (!k || !current || !current.inputs) return;
    const h = current.inputs[k]; if (h) h(e.target, e);
  });
  $app.addEventListener('change', (e) => {
    const k = e.target.dataset && e.target.dataset.change; if (!k || !current || !current.changes) return;
    const h = current.changes[k] || current.changes['*']; if (h) h(e.target, e);
  });

  // ---------------- Keyboard shortcuts ----------------
  let gPending = 0;
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) return;
    if (TI.ui.overlayOpen()) return;
    if (current && current.keys && current.keys(e)) { e.preventDefault(); return; }
    const k = e.key.toLowerCase();
    if (gPending && Date.now() - gPending < 1200) {
      gPending = 0;
      const map = { d: '/', t: '/focus', s: '/schedule', c: '/cards', i: '/insights', n: '/notes', p: '/projects' };
      if (map[k]) { e.preventDefault(); go(map[k]); }
      return;
    }
    if (k === 'g') { gPending = Date.now(); return; }
    if (e.key === ' ' && (TI.timer.state.subjectId || TI.timer.isActive())) {
      if (e.target.closest && e.target.closest('button')) return;
      e.preventDefault(); if (TI.timer.isActive()) TI.timer.toggle(); else TI.timer.start(); return;
    }
    if (k === 's' && TI.timer.isActive()) { e.preventDefault(); TI.timer.stop(); return; }
    if (k === 'f' && TI.router.current.name !== 'clock') { e.preventDefault(); openClock(TI.timer.state.subjectId); return; }
    if (k === 'n' && sel.activeProject()) { e.preventDefault(); TI.forms.subjectForm(); }
  });

  // ---------------- Boot ----------------
  async function boot() {
    $view.innerHTML = '<div class="boot">Loading…</div>';
    TI.api.onSyncStatus(() => TI.sync.paint());
    const linked = await TI.sync.fromSetupLink();
    try { await actions.boot(); } catch (e) {
      console.error(e);
      const sheets = TI.api.mode() === 'sheets';
      $view.innerHTML = TI.ui.empty(sheets ? 'cloud_off' : 'error', sheets ? 'Could not reach your Google Sheet' : 'Could not load your data', U.esc(e.message),
        sheets ? '<div class="row" style="justify-content:center"><button class="btn primary" data-act="boot-retry">Try again</button><button class="btn ghost" data-act="boot-offline">Disconnect and use this browser</button></div>' : '');
      return;
    }
    TI.theme.apply(state.settings.theme);
    if (TI.timer.state.subjectId && !sel.subject(TI.timer.state.subjectId)) TI.timer.reset();
    TI.store.subscribe(schedule);
    TI.timer.onChange(schedule);
    TI.timer.onTick(TI.timerCard.tick);
    TI.layout.onChange(schedule);
    TI.router.onChange(() => { TI.ui.closeMenu(); TI.ui.closeAll(); render(true); });
    render();
    setTimeout(() => TI.reminders.check(), 1500);
    if (linked) TI.ui.toast(linked, { icon: 'cloud_done', duration: 4500 });
    // Ask Chrome to keep this site's data (it can still be wiped by "clear on exit" settings)
    try { if (navigator.storage && navigator.storage.persist && TI.api.mode() === 'sheets') navigator.storage.persist(); } catch (e) { /* ignore */ }
  }
  boot();
  TI.app = { render, go };
})(window.TI);
