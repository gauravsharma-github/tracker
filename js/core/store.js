// App state, selectors and actions. Actions update state immediately (optimistic UI),
// then persist through TI.api. Screens read state and call actions; nothing else writes.
(function (TI) {
  const U = TI.util;
  const api = TI.api;

  const state = {
    ready: false, rev: 0,
    projects: [], subjects: [], nodes: [], sessions: [], cards: [], reviews: [], notes: [], blocks: [],
    settings: {}, account: {},
    ui: Object.assign({ expandedSubjects: {}, expandedNodes: {}, dashFilter: 'all', notesFilter: 'all', notesQuery: '', insightsRange: 'week', insightsScope: 'project', shareOpts: null }, TI.storage.get('ui', {})),
  };

  const listeners = new Set();
  let queued = false;
  function bump() {
    state.rev++;
    if (queued) return; queued = true;
    Promise.resolve().then(() => { queued = false; listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } }); });
  }
  const saveUi = U.debounce(() => TI.storage.set('ui', state.ui), 150);
  const fail = (e) => { console.error(e); TI.ui && TI.ui.toast && TI.ui.toast('Could not save. Please try again.', { icon: 'error' }); };
  const nextOrder = (arr) => (arr.length ? Math.max(...arr.map((x) => x.order || 0)) + 1 : 0);

  // ---------------- Selectors ----------------
  const sel = {
    activeProject() {
      const ps = state.projects.filter((p) => !p.archived);
      return ps.find((p) => p.id === state.settings.activeProjectId) || ps[0] || null;
    },
    projects(includeArchived = false) { return state.projects.filter((p) => includeArchived || !p.archived).sort((a, b) => a.order - b.order); },
    project(id) { return state.projects.find((p) => p.id === id) || null; },
    subjects(pid) { return state.subjects.filter((s) => s.projectId === pid).sort((a, b) => a.order - b.order); },
    subject(id) { return state.subjects.find((s) => s.id === id) || null; },
    node(id) { return state.nodes.find((n) => n.id === id) || null; },
    cards(sid) { return state.cards.filter((c) => c.subjectId === sid).sort((a, b) => a.due - b.due); },
    notes(sid) { return state.notes.filter((n) => !sid || n.subjectId === sid).sort((a, b) => (b.pinned - a.pinned) || b.updatedAt - a.updatedAt); },
    sessionsOn(day, pid) { return state.sessions.filter((s) => U.dayKey(s.start) === day && (!pid || s.projectId === pid)).sort((a, b) => a.start - b.start); },
    blocksOn(day) {
      const wd = U.parseDay(day).getDay();
      return state.blocks.filter((b) => {
        if ((b.skipDates || []).includes(day)) return false;
        if (b.repeat === 'none' || !b.repeat) return b.date === day;
        if (b.date > day) return false;
        if (b.until && b.until < day) return false;
        if (b.repeat === 'daily') return true;
        if (b.repeat === 'weekdays') return wd >= 1 && wd <= 5;
        if (b.repeat === 'weekly') return U.parseDay(b.date).getDay() === wd;
        return false;
      }).sort((a, b) => a.start.localeCompare(b.start));
    },
    // Your own Google Sheet backend unlocks everything (it's your personal copy)
    isPro() { return !!state.account.pro || api.mode() === 'sheets'; },
    canAddProject() { return sel.isPro() || state.projects.filter((p) => !p.archived).length < TI.config.limits.projects; },
    canAddSubject(pid) { return sel.isPro() || sel.subjects(pid).length < TI.config.limits.subjectsPerProject; },
  };

  // ---------------- Actions ----------------
  const actions = {
    async boot() {
      api.onRemoteData((d) => { Object.assign(state, d); bump(); });
      const d = await api.loadAll();
      Object.assign(state, d, { ready: true });
      bump();
    },
    // Reload everything from the current backend (after connecting / disconnecting a Google Sheet)
    async reload() {
      const d = await api.loadAll();
      ['projects', 'subjects', 'nodes', 'sessions', 'cards', 'reviews', 'notes', 'blocks'].forEach((c) => { state[c] = []; });
      Object.assign(state, d, { ready: true });
      if (TI.timer && TI.timer.state.subjectId && !sel.subject(TI.timer.state.subjectId)) TI.timer.reset();
      bump();
    },
    setUi(patch) { Object.assign(state.ui, patch); saveUi(); bump(); },
    toggleUiFlag(group, id) {
      const g = { ...(state.ui[group] || {}) };
      if (g[id]) delete g[id]; else g[id] = 1;
      state.ui[group] = g; saveUi(); bump();
    },

    // ---- Settings ----
    updateSettings(patch) {
      Object.assign(state.settings, patch); bump();
      return api.updateSettings(patch).catch(fail);
    },
    setActiveProject(id) { return actions.updateSettings({ activeProjectId: id }); },

    // ---- Projects ----
    addProject({ name, category = 'custom', color = TI.config.palette[0], templateId = null }) {
      const p = { id: U.uid('p_'), name: name.trim() || 'Untitled', category, color, templateId, order: nextOrder(state.projects), createdAt: Date.now(), archived: false };
      state.projects.push(p); bump(); api.create('projects', p).catch(fail);
      return p;
    },
    updateProject(id, patch) {
      const p = sel.project(id); if (!p) return;
      Object.assign(p, patch); bump(); api.update('projects', id, patch).catch(fail);
    },
    deleteProject(id) {
      const sids = new Set(state.subjects.filter((s) => s.projectId === id).map((s) => s.id));
      const drop = (coll, f) => { const ids = state[coll].filter(f).map((x) => x.id); state[coll] = state[coll].filter((x) => !f(x)); if (ids.length) api.remove(coll, ids).catch(fail); };
      drop('nodes', (n) => sids.has(n.subjectId));
      drop('cards', (c) => sids.has(c.subjectId));
      drop('reviews', (r) => sids.has(r.subjectId));
      drop('notes', (n) => sids.has(n.subjectId));
      drop('blocks', (b) => sids.has(b.subjectId));
      drop('sessions', (s) => s.projectId === id);
      drop('subjects', (s) => s.projectId === id);
      drop('projects', (p) => p.id === id);
      if (state.settings.activeProjectId === id) { const next = sel.projects()[0]; actions.updateSettings({ activeProjectId: next ? next.id : null }); }
      bump();
    },
    // Create a project + subjects + nested topics from a parsed outline
    importProject({ name, category = 'custom', color, tree, templateId = null }) {
      const pal = TI.config.palette;
      const p = actions.addProject({ name, category, color: color || pal[Math.floor(Math.random() * 6)], templateId });
      const offset = Math.floor(Math.random() * pal.length);
      tree.forEach((s, i) => {
        const subj = actions.addSubject({ projectId: p.id, name: s.title, color: pal[(offset + i * 3) % pal.length] }, true);
        actions.addNodes(subj.id, null, s.children, true);
      });
      actions.setActiveProject(p.id);
      return p;
    },

    // ---- Subjects ----
    addSubject({ projectId, name, color }, force = false) {
      if (!force && !sel.canAddSubject(projectId)) return null;
      const s = { id: U.uid('s_'), projectId, name: name.trim() || 'Untitled subject', color: color || TI.config.palette[state.subjects.length % TI.config.palette.length], order: nextOrder(sel.subjects(projectId)), createdAt: Date.now() };
      state.subjects.push(s); bump(); api.create('subjects', s).catch(fail);
      return s;
    },
    updateSubject(id, patch) { const s = sel.subject(id); if (!s) return; Object.assign(s, patch); bump(); api.update('subjects', id, patch).catch(fail); },
    moveSubject(id, dir) {
      const s = sel.subject(id); if (!s) return;
      const list = sel.subjects(s.projectId); const i = list.indexOf(s); const j = i + dir;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      list.forEach((x, k) => { x.order = k; });
      bump(); api.updateMany('subjects', list.map((x) => ({ id: x.id, order: x.order }))).catch(fail);
    },
    deleteSubject(id) {
      const drop = (coll, f) => { const ids = state[coll].filter(f).map((x) => x.id); state[coll] = state[coll].filter((x) => !f(x)); if (ids.length) api.remove(coll, ids).catch(fail); };
      drop('nodes', (n) => n.subjectId === id);
      drop('cards', (c) => c.subjectId === id);
      drop('reviews', (r) => r.subjectId === id);
      drop('notes', (n) => n.subjectId === id);
      drop('blocks', (b) => b.subjectId === id);
      drop('sessions', (s) => s.subjectId === id);
      drop('subjects', (s) => s.id === id);
      bump();
    },

    // ---- Syllabus nodes ----
    // items: [{ title, done?, children? }] or strings
    addNodes(subjectId, parentId, items, silent = false) {
      const created = [];
      const add = (list, pid, fresh = false) => {
        let order = fresh ? 0 : nextOrder(TI.stats.children(state, subjectId, pid));
        list.forEach((it) => {
          const t = typeof it === 'string' ? { title: it, children: [] } : it;
          if (!t.title || !t.title.trim()) return;
          const n = { id: U.uid('n_'), subjectId, parentId: pid || null, title: t.title.trim(), done: !!t.done && !(t.children && t.children.length), doneAt: t.done ? Date.now() : null, order: order++, due: null, createdAt: Date.now() };
          state.nodes.push(n); created.push(n);
          if (t.children && t.children.length) add(t.children, n.id, true);
        });
      };
      add(items, parentId);
      bump();
      if (created.length) api.createMany('nodes', created).catch(fail);
      if (!silent && parentId) { state.ui.expandedNodes = { ...state.ui.expandedNodes, [parentId]: 1 }; saveUi(); }
      return created;
    },
    updateNode(id, patch) { const n = sel.node(id); if (!n) return; Object.assign(n, patch); bump(); api.update('nodes', id, patch).catch(fail); },
    toggleNode(id) {
      const n = sel.node(id); if (!n) return;
      const desc = TI.stats.descendants(state, id);
      const leaves = desc.length ? desc.filter((d) => !TI.stats.children(state, d.subjectId, d.id).length) : [n];
      const allDone = leaves.every((l) => l.done);
      const now = Date.now();
      const patches = leaves.map((l) => { l.done = !allDone; l.doneAt = allDone ? null : now; return { id: l.id, done: l.done, doneAt: l.doneAt }; });
      bump(); api.updateMany('nodes', patches).catch(fail);
      return !allDone;
    },
    moveNode(id, dir) {
      const n = sel.node(id); if (!n) return;
      const list = TI.stats.children(state, n.subjectId, n.parentId).slice(); const i = list.indexOf(n); const j = i + dir;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      list.forEach((x, k) => { x.order = k; });
      bump(); api.updateMany('nodes', list.map((x) => ({ id: x.id, order: x.order }))).catch(fail);
    },
    deleteNode(id) {
      const ids = [id, ...TI.stats.descendants(state, id).map((d) => d.id)];
      const set = new Set(ids);
      state.nodes = state.nodes.filter((n) => !set.has(n.id));
      state.sessions.forEach((s) => { if (set.has(s.nodeId)) s.nodeId = null; });
      state.notes.forEach((m) => { if (set.has(m.nodeId)) m.nodeId = null; });
      bump(); api.remove('nodes', ids).catch(fail);
    },

    // ---- Sessions ----
    logSession({ subjectId, nodeId = null, start, duration, mode = 'pomodoro', manual = false }) {
      const subj = sel.subject(subjectId); if (!subj || duration < 1) return null;
      const s = { id: U.uid('t_'), projectId: subj.projectId, subjectId, nodeId, start, duration: Math.round(duration), mode, manual };
      state.sessions.push(s); bump(); api.create('sessions', s).catch(fail);
      return s;
    },
    updateSession(id, patch) { const s = state.sessions.find((x) => x.id === id); if (!s) return; Object.assign(s, patch); bump(); api.update('sessions', id, patch).catch(fail); },
    deleteSession(id) { state.sessions = state.sessions.filter((s) => s.id !== id); bump(); api.remove('sessions', id).catch(fail); },

    // ---- Flashcards ----
    addCards(subjectId, list) {
      const now = Date.now();
      const cards = list.map((c, i) => ({ id: U.uid('c_'), subjectId, front: c.front.trim(), back: c.back.trim(), createdAt: now + i, ...TI.srs.newCard() }));
      state.cards.push(...cards); bump(); api.createMany('cards', cards).catch(fail);
      return cards;
    },
    updateCard(id, patch) { const c = state.cards.find((x) => x.id === id); if (!c) return; Object.assign(c, patch); bump(); api.update('cards', id, patch).catch(fail); },
    deleteCard(id) { state.cards = state.cards.filter((c) => c.id !== id); bump(); api.remove('cards', id).catch(fail); },
    resetCard(id) { actions.updateCard(id, TI.srs.newCard()); },
    reviewCard(id, grade) {
      const c = state.cards.find((x) => x.id === id); if (!c) return null;
      const patch = TI.srs.schedule(c, grade);
      Object.assign(c, patch, { lastReviewed: Date.now() });
      const r = { id: U.uid('r_'), cardId: id, subjectId: c.subjectId, grade, at: Date.now() };
      state.reviews.push(r);
      bump();
      api.update('cards', id, { ...patch, lastReviewed: c.lastReviewed }).catch(fail);
      api.create('reviews', r).catch(fail);
      return c;
    },

    // ---- Notes ----
    addNote({ subjectId, nodeId = null, title = '', body = '' }) {
      const now = Date.now();
      const n = { id: U.uid('m_'), subjectId, nodeId, title, body, pinned: false, createdAt: now, updatedAt: now };
      state.notes.push(n); bump(); api.create('notes', n).catch(fail);
      return n;
    },
    updateNote(id, patch) { const n = state.notes.find((x) => x.id === id); if (!n) return; Object.assign(n, patch, { updatedAt: Date.now() }); bump(); api.update('notes', id, { ...patch, updatedAt: n.updatedAt }).catch(fail); },
    deleteNote(id) { state.notes = state.notes.filter((n) => n.id !== id); bump(); api.remove('notes', id).catch(fail); },

    // ---- Schedule ----
    addBlock(b) {
      const blk = { id: U.uid('b_'), repeat: 'none', doneDates: [], skipDates: [], nodeId: null, title: '', createdAt: Date.now(), ...b };
      state.blocks.push(blk); bump(); api.create('blocks', blk).catch(fail);
      return blk;
    },
    updateBlock(id, patch) { const b = state.blocks.find((x) => x.id === id); if (!b) return; Object.assign(b, patch); bump(); api.update('blocks', id, patch).catch(fail); },
    deleteBlock(id, onlyDay = null) {
      const b = state.blocks.find((x) => x.id === id); if (!b) return;
      if (onlyDay && b.repeat && b.repeat !== 'none') { actions.updateBlock(id, { skipDates: [...(b.skipDates || []), onlyDay] }); return; }
      state.blocks = state.blocks.filter((x) => x.id !== id); bump(); api.remove('blocks', id).catch(fail);
    },
    toggleBlockDone(id, day) {
      const b = state.blocks.find((x) => x.id === id); if (!b) return;
      const set = new Set(b.doneDates || []);
      if (set.has(day)) set.delete(day); else set.add(day);
      actions.updateBlock(id, { doneDates: [...set] });
    },

    // ---- Account / data (mocked backend calls) ----
    async signIn(provider) { state.account = await api.signIn(provider); bump(); },
    async signOut() { state.account = await api.signOut(); bump(); },
    async backupNow() { state.account.lastBackup = await api.backupNow(); bump(); },
    async purchasePro(plan) { state.account = await api.purchasePro(plan); bump(); },
    async restorePurchase() { state.account = await api.restorePurchase(); bump(); return state.account.pro; },
    async cancelPro() { state.account = await api.cancelProForTesting(); bump(); },
    async exportBackup() { const json = await api.exportAll(); U.download(`trackit-backup-${U.today()}.json`, JSON.stringify(json, null, 2)); },
    async importBackup(json) { const d = await api.importAll(json); Object.assign(state, d); bump(); },
    async resetDemo() { const d = await api.resetDemo(); Object.assign(state, d); TI.timer && TI.timer.reset(); bump(); },
    async clearAll() { const d = await api.clearAll(); Object.assign(state, d); TI.timer && TI.timer.reset(); bump(); },
  };

  TI.store = { state, sel, actions, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, bump };
})(window.TI);
