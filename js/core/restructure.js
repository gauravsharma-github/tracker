// Re-organising the syllabus: move a topic/unit anywhere (any subject, any project), turn a subject into a unit
// inside another subject, or turn a unit/topic into a subject. Everything attached (stages, quizzes, cards, notes,
// files, study time, schedule blocks) follows. Each change is one transaction that can be undone right after.
(function (TI) {
  const U = TI.util;
  const { state, sel } = TI.store;
  const api = TI.api;
  const fail = (e) => { console.error(e); TI.ui && TI.ui.toast(`Couldn't save: ${e.message}`, { icon: 'error' }); };

  // ---------- transaction: remembers old values so it can be reversed ----------
  function tx() {
    const patched = new Map(); // "coll|id" -> { coll, rec, old: {k: v} }
    const created = []; const removed = [];
    return {
      patch(coll, rec, p) {
        const key = `${coll}|${rec.id}`; let e = patched.get(key);
        if (!e) { e = { coll, rec, old: {} }; patched.set(key, e); }
        Object.keys(p).forEach((k) => { if (!(k in e.old)) e.old[k] = rec[k] === undefined ? null : rec[k]; });
        Object.assign(rec, p);
      },
      create(coll, item) { state[coll].push(item); created.push({ coll, item }); },
      remove(coll, rec) { state[coll] = state[coll].filter((x) => x.id !== rec.id); removed.push({ coll, item: { ...rec } }); },
      // send to the backend: patches grouped per collection
      commit() {
        const by = {};
        patched.forEach(({ coll, rec, old }) => { (by[coll] = by[coll] || []).push({ id: rec.id, ...Object.fromEntries(Object.keys(old).map((k) => [k, rec[k] === undefined ? null : rec[k]])) }); });
        const cr = {}; created.forEach(({ coll, item }) => { (cr[coll] = cr[coll] || []).push(item); });
        Object.keys(cr).forEach((c) => api.createMany(c, cr[c]).catch(fail));
        Object.keys(by).forEach((c) => api.updateMany(c, by[c].filter((p) => !created.some((x) => x.item.id === p.id))).catch(fail));
        const rm = {}; removed.forEach(({ coll, item }) => { (rm[coll] = rm[coll] || []).push(item.id); });
        Object.keys(rm).forEach((c) => api.remove(c, rm[c]).catch(fail));
        TI.store.bump();
        return { undo: () => undo(patched, created, removed) };
      },
    };
  }
  function undo(patched, created, removed) {
    const ups = {};
    patched.forEach(({ coll, rec, old }) => {
      const live = state[coll].find((x) => x.id === rec.id) || rec;
      Object.assign(live, old);
      if (!created.some((c) => c.item.id === rec.id) && !removed.some((r) => r.item.id === rec.id)) (ups[coll] = ups[coll] || []).push({ id: rec.id, ...old });
    });
    const rmIds = {};
    created.forEach(({ coll, item }) => { state[coll] = state[coll].filter((x) => x.id !== item.id); (rmIds[coll] = rmIds[coll] || []).push(item.id); });
    const back = {};
    removed.forEach(({ coll, item }) => { if (!state[coll].some((x) => x.id === item.id)) { const it = { ...item }; patched.forEach((e) => { if (e.coll === coll && e.rec.id === it.id) Object.assign(it, e.old); }); state[coll].push(it); (back[coll] = back[coll] || []).push(it); } });
    Object.keys(back).forEach((c) => api.createMany(c, back[c]).catch(fail));
    Object.keys(ups).forEach((c) => api.updateMany(c, ups[c]).catch(fail));
    Object.keys(rmIds).forEach((c) => api.remove(c, rmIds[c]).catch(fail));
    TI.store.bump();
  }

  // ---------- helpers ----------
  const kidsOf = (subjectId, parentId) => state.nodes.filter((n) => n.subjectId === subjectId && (n.parentId || null) === (parentId || null)).sort((a, b) => (a.order || 0) - (b.order || 0));
  function subtree(id) { const out = [id]; for (let i = 0; i < out.length; i++) state.nodes.forEach((n) => { if (n.parentId === out[i]) out.push(n.id); }); return out; }
  // Put `items` (already in the list or not) at position `index` among `siblings`, renumbering orders 1..n
  function place(t, coll, siblings, items, index) {
    const ids = new Set(items.map((x) => x.id)); const rest = siblings.filter((x) => !ids.has(x.id));
    const at = index == null || index < 0 || index > rest.length ? rest.length : index;
    const all = [...rest.slice(0, at), ...items, ...rest.slice(at)];
    all.forEach((x, i) => { if (x.order !== i + 1) t.patch(coll, x, { order: i + 1 }); });
  }
  // Re-point everything attached to these nodes / this subject to a new subject (and project)
  function repoint(t, { nodeIds, fromSubjectId = null, toSubjectId, toProjectId, subjectLevelNodeId }) {
    const set = new Set(nodeIds);
    const hit = (x) => set.has(x.nodeId) || (fromSubjectId && x.subjectId === fromSubjectId);
    const nodePatch = (x) => (fromSubjectId && x.subjectId === fromSubjectId && !x.nodeId && subjectLevelNodeId ? { nodeId: subjectLevelNodeId } : {});
    state.sessions.filter(hit).forEach((x) => t.patch('sessions', x, { subjectId: toSubjectId, projectId: toProjectId, ...nodePatch(x) }));
    state.notes.filter(hit).forEach((x) => t.patch('notes', x, { subjectId: toSubjectId, ...nodePatch(x) }));
    (state.attachments || []).filter(hit).forEach((x) => t.patch('attachments', x, { subjectId: toSubjectId, projectId: toProjectId, ...nodePatch(x) }));
    (state.blocks || []).filter(hit).forEach((x) => t.patch('blocks', x, { subjectId: toSubjectId, ...nodePatch(x) }));
    const cardIds = new Set();
    state.cards.filter(hit).forEach((x) => { cardIds.add(x.id); t.patch('cards', x, { subjectId: toSubjectId }); });
    (state.reviews || []).filter((r) => cardIds.has(r.cardId)).forEach((x) => t.patch('reviews', x, { subjectId: toSubjectId }));
    (state.stages || []).filter((x) => set.has(x.nodeId)).forEach((x) => t.patch('stages', x, { subjectId: toSubjectId, projectId: toProjectId }));
    (state.mcqs || []).filter((x) => set.has(x.nodeId)).forEach((x) => t.patch('mcqs', x, { subjectId: toSubjectId }));
    (state.quizzes || []).filter((x) => set.has(x.nodeId)).forEach((x) => t.patch('quizzes', x, { subjectId: toSubjectId, projectId: toProjectId }));
  }
  const touch = (t, pid) => { const p = sel.project(pid); if (p) t.patch('projects', p, { updatedAt: Date.now() }); };

  // What a move carries (for the confirmation line)
  function summary({ nodeId, subjectId }) {
    const ids = new Set(nodeId ? subtree(nodeId) : state.nodes.filter((n) => n.subjectId === subjectId).map((n) => n.id));
    const hit = (x) => ids.has(x.nodeId) || (subjectId && x.subjectId === subjectId);
    const leaves = [...ids].filter((id) => !state.nodes.some((n) => n.parentId === id)).length;
    const secs = state.sessions.filter(hit).reduce((s, x) => s + (x.duration || 0), 0);
    const parts = [U.plural(leaves, 'topic')];
    const c = (arr, w) => { const k = (arr || []).filter(hit).length; if (k) parts.push(U.plural(k, w)); };
    c(state.notes, 'note'); c(state.cards, 'card'); c(state.attachments, 'file');
    const q = (state.mcqs || []).filter((x) => ids.has(x.nodeId)).length; if (q) parts.push(U.plural(q, 'quiz question'));
    if (secs >= 60) parts.push(`${U.fmtDur ? U.fmtDur(secs) : Math.round(secs / 60) + ' min'} of study time`);
    return parts.join(', ');
  }

  // ---------- 1. move a topic / unit (with everything under it) ----------
  // to: { subjectId, parentId|null, index }
  function moveNode(nodeId, to) {
    const n = sel.node(nodeId); const dest = sel.subject(to.subjectId); if (!n || !dest) return null;
    const ids = subtree(nodeId);
    if (to.parentId && ids.includes(to.parentId)) throw new Error("A topic can't go inside itself.");
    const from = sel.subject(n.subjectId); const t = tx();
    const crossing = n.subjectId !== dest.id;
    const oldParent = n.parentId || null;
    t.patch('nodes', n, { parentId: to.parentId || null, subjectId: dest.id });
    if (crossing) {
      ids.slice(1).forEach((id) => t.patch('nodes', sel.node(id), { subjectId: dest.id }));
      repoint(t, { nodeIds: ids, toSubjectId: dest.id, toProjectId: dest.projectId });
    }
    place(t, 'nodes', kidsOf(dest.id, to.parentId || null), [n], to.index);
    if (crossing || oldParent !== (to.parentId || null)) kidsOf(from.id, oldParent).forEach((x, i) => { if (x.order !== i + 1) t.patch('nodes', x, { order: i + 1 }); });
    touch(t, dest.projectId); if (from.projectId !== dest.projectId) touch(t, from.projectId);
    return t.commit();
  }

  // ---------- 2. subject → unit inside another subject ----------
  // to: { subjectId, parentId|null, index } – or { newSubject: { projectId, name, index } }
  function subjectToNode(subjectId, to) {
    const s = sel.subject(subjectId); if (!s) return null;
    const t = tx();
    let dest = to.subjectId ? sel.subject(to.subjectId) : null;
    if (!dest && to.newSubject) {
      dest = { id: U.uid('s_'), projectId: to.newSubject.projectId, name: (to.newSubject.name || 'New subject').trim(), color: s.color, order: 0, createdAt: Date.now() };
      t.create('subjects', dest);
      place(t, 'subjects', state.subjects.filter((x) => x.projectId === dest.projectId).sort((a, b) => (a.order || 0) - (b.order || 0)), [dest], to.newSubject.index);
    }
    if (!dest || dest.id === s.id) return null;
    const unit = { id: U.uid('n_'), subjectId: dest.id, parentId: (to.subjectId && to.parentId) || null, title: s.name, done: false, doneAt: null, stage: 0, stageDue: null, order: 0, due: null, createdAt: Date.now() };
    t.create('nodes', unit);
    place(t, 'nodes', kidsOf(dest.id, unit.parentId), [unit], to.subjectId ? to.index : null);
    const ids = state.nodes.filter((x) => x.subjectId === s.id).map((x) => x.id);
    state.nodes.filter((x) => x.subjectId === s.id).forEach((x) => t.patch('nodes', x, { subjectId: dest.id, ...(x.parentId ? {} : { parentId: unit.id }) }));
    repoint(t, { nodeIds: ids, fromSubjectId: s.id, toSubjectId: dest.id, toProjectId: dest.projectId, subjectLevelNodeId: unit.id });
    t.remove('subjects', s);
    state.subjects.filter((x) => x.projectId === s.projectId).sort((a, b) => (a.order || 0) - (b.order || 0)).forEach((x, i) => { if (x.order !== i + 1) t.patch('subjects', x, { order: i + 1 }); });
    if (state.ui && state.ui.expandedNodes) state.ui.expandedNodes[unit.id] = true;
    touch(t, dest.projectId); if (s.projectId !== dest.projectId) touch(t, s.projectId);
    const r = t.commit(); r.unitId = unit.id; r.subjectId = dest.id; return r;
  }

  // ---------- 3. unit / topic → subject ----------
  // to: { projectId, index }
  function nodeToSubject(nodeId, to) {
    const n = sel.node(nodeId); if (!n) return null;
    const from = sel.subject(n.subjectId); const pid = to.projectId || from.projectId;
    const t = tx(); const ids = subtree(nodeId);
    const used = new Set(state.subjects.filter((x) => x.projectId === pid).map((x) => x.color));
    const color = TI.config.palette.find((c) => !used.has(c)) || TI.config.palette[state.subjects.length % TI.config.palette.length];
    const s = { id: U.uid('s_'), projectId: pid, name: n.title, color, order: 0, createdAt: Date.now() };
    t.create('subjects', s);
    place(t, 'subjects', state.subjects.filter((x) => x.projectId === pid).sort((a, b) => (a.order || 0) - (b.order || 0)), [s], to.index);
    const kids = kidsOf(n.subjectId, n.id); const oldParent = n.parentId || null;
    if (kids.length) {
      // a unit: its children become the subject's top level; the unit itself goes, its own notes/files become subject-level
      ids.slice(1).forEach((id) => { const x = sel.node(id); t.patch('nodes', x, { subjectId: s.id, ...(x.parentId === n.id ? { parentId: null } : {}) }); });
      repoint(t, { nodeIds: ids, toSubjectId: s.id, toProjectId: pid });
      const own = (x) => x.nodeId === n.id;
      ['sessions', 'notes', 'attachments', 'blocks'].forEach((c) => (state[c] || []).filter(own).forEach((x) => t.patch(c, x, { nodeId: null })));
      state.cards.filter(own).forEach((x) => t.patch('cards', x, { nodeId: null }));
      t.remove('nodes', n);
    } else {
      // a single topic: the subject gets one topic of the same name, keeping its stages, quizzes, cards and files
      t.patch('nodes', n, { subjectId: s.id, parentId: null, order: 1 });
      repoint(t, { nodeIds: ids, toSubjectId: s.id, toProjectId: pid });
    }
    kidsOf(from.id, oldParent).forEach((x, i) => { if (x.order !== i + 1) t.patch('nodes', x, { order: i + 1 }); });
    touch(t, pid); if (from.projectId !== pid) touch(t, from.projectId);
    const r = t.commit(); r.subjectId = s.id; return r;
  }

  // ---------- quick shortcuts ----------
  function outdent(nodeId) { // one level up, right after its old parent
    const n = sel.node(nodeId); if (!n || !n.parentId) return null;
    const p = sel.node(n.parentId); const sibs = kidsOf(p.subjectId, p.parentId || null);
    return moveNode(nodeId, { subjectId: n.subjectId, parentId: p.parentId || null, index: sibs.findIndex((x) => x.id === p.id) + 1 });
  }
  function prevUnit(nodeId) { // the unit just above it on the same level (must already have topics)
    const n = sel.node(nodeId); if (!n) return null;
    const sibs = kidsOf(n.subjectId, n.parentId || null); const i = sibs.findIndex((x) => x.id === n.id);
    const prev = i > 0 ? sibs[i - 1] : null;
    return prev && kidsOf(prev.subjectId, prev.id).length ? prev : null;
  }
  function indent(nodeId) { const n = sel.node(nodeId); const u = prevUnit(nodeId); if (!n || !u) return null; return moveNode(nodeId, { subjectId: n.subjectId, parentId: u.id, index: null }); }

  TI.restructure = { moveNode, subjectToNode, nodeToSubject, outdent, indent, prevUnit, subtree, kidsOf, summary };
})(window.TI);
