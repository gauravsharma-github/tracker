// Derived numbers: syllabus progress, time per node/subject/day, streaks, due items.
// Pure functions over state, cached per state revision. Safe to port to the backend.
(function (TI) {
  const U = TI.util;
  let cache = { rev: -1, idx: null };

  function build(state) {
    const byId = new Map(); const childrenOf = new Map();
    const key = (sid, pid) => sid + '|' + (pid || 'root');
    state.nodes.forEach((n) => {
      byId.set(n.id, n);
      const k = key(n.subjectId, n.parentId);
      if (!childrenOf.has(k)) childrenOf.set(k, []);
      childrenOf.get(k).push(n);
    });
    childrenOf.forEach((arr) => arr.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt));

    const prog = new Map();
    const calc = (n) => {
      const kids = childrenOf.get(key(n.subjectId, n.id)) || [];
      let p;
      if (!kids.length) p = { leaves: 1, done: n.done ? 1 : 0 };
      else { p = { leaves: 0, done: 0 }; kids.forEach((c) => { const q = calc(c); p.leaves += q.leaves; p.done += q.done; }); }
      prog.set(n.id, p); return p;
    };
    const subjProg = new Map();
    state.subjects.forEach((s) => {
      const p = { leaves: 0, done: 0 };
      (childrenOf.get(key(s.id, null)) || []).forEach((n) => { const q = calc(n); p.leaves += q.leaves; p.done += q.done; });
      subjProg.set(s.id, p);
    });

    const timeByNode = new Map(); const timeBySubject = new Map(); const subjDay = new Map(); const projDay = new Map(); const allDay = new Map();
    const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
    const add2 = (m, k1, k2, v) => { if (!m.has(k1)) m.set(k1, new Map()); add(m.get(k1), k2, v); };
    state.sessions.forEach((s) => {
      const d = U.dayKey(s.start);
      add(timeBySubject, s.subjectId, s.duration);
      add2(subjDay, s.subjectId, d, s.duration);
      add2(projDay, s.projectId, d, s.duration);
      add(allDay, d, s.duration);
      let nid = s.nodeId; let guard = 0;
      while (nid && byId.has(nid) && guard++ < 50) { add(timeByNode, nid, s.duration); nid = byId.get(nid).parentId; }
    });

    return { key, byId, childrenOf, prog, subjProg, timeByNode, timeBySubject, subjDay, projDay, allDay };
  }

  function idx(state) {
    if (cache.rev !== state.rev || !cache.idx) cache = { rev: state.rev, idx: build(state) };
    return cache.idx;
  }

  const ratio = (p) => (p && p.leaves ? p.done / p.leaves : 0);

  const stats = {
    idx,
    children(state, subjectId, parentId) { const i = idx(state); return i.childrenOf.get(i.key(subjectId, parentId)) || []; },
    nodeProgress(state, id) { return idx(state).prog.get(id) || { leaves: 0, done: 0 }; },
    nodeRatio(state, id) { return ratio(stats.nodeProgress(state, id)); },
    subjectProgress(state, sid) { return idx(state).subjProg.get(sid) || { leaves: 0, done: 0 }; },
    subjectRatio(state, sid) { return ratio(stats.subjectProgress(state, sid)); },
    projectProgress(state, pid) {
      const p = { leaves: 0, done: 0 };
      state.subjects.filter((s) => s.projectId === pid).forEach((s) => { const q = stats.subjectProgress(state, s.id); p.leaves += q.leaves; p.done += q.done; });
      return p;
    },
    projectRatio(state, pid) { return ratio(stats.projectProgress(state, pid)); },
    nodeTime(state, id) { return idx(state).timeByNode.get(id) || 0; },
    subjectTime(state, sid) { return idx(state).timeBySubject.get(sid) || 0; },
    projectTime(state, pid) { return U.sum(state.subjects.filter((s) => s.projectId === pid), (s) => stats.subjectTime(state, s.id)); },
    subjectDay(state, sid, day) { const m = idx(state).subjDay.get(sid); return (m && m.get(day)) || 0; },
    projectDay(state, pid, day) { const m = idx(state).projDay.get(pid); return (m && m.get(day)) || 0; },
    allDay(state, day) { return idx(state).allDay.get(day) || 0; },
    dayFn(state, scope) {
      if (!scope || scope.type === 'all') return (d) => stats.allDay(state, d);
      if (scope.type === 'project') return (d) => stats.projectDay(state, scope.id, d);
      return (d) => stats.subjectDay(state, scope.id, d);
    },
    // Leaves done inside a subject
    partsDone(state, sid) { const p = stats.subjectProgress(state, sid); return `${p.done}/${p.leaves}`; },
    pathOf(state, nodeId) {
      const i = idx(state); const out = []; let n = i.byId.get(nodeId); let guard = 0;
      while (n && guard++ < 50) { out.unshift(n); n = n.parentId ? i.byId.get(n.parentId) : null; }
      return out;
    },
    leaves(state, sid) {
      const out = []; const walk = (pid, path) => stats.children(state, sid, pid).forEach((n) => {
        const kids = stats.children(state, sid, n.id);
        if (kids.length) walk(n.id, [...path, n.title]); else out.push({ node: n, path });
      });
      walk(null, []); return out;
    },
    descendants(state, nodeId) {
      const n = idx(state).byId.get(nodeId); if (!n) return [];
      const out = []; const walk = (pid) => stats.children(state, n.subjectId, pid).forEach((c) => { out.push(c); walk(c.id); });
      walk(nodeId); return out;
    },
    // Consecutive days with any study (for a scope)
    streaks(state, scope) {
      const f = stats.dayFn(state, scope);
      let cur = 0; let d = U.today();
      if (!f(d)) d = U.addDaysKey(d, -1);
      while (f(d) > 0) { cur++; d = U.addDaysKey(d, -1); }
      const days = new Set();
      const sess = scope && scope.type === 'project' ? state.sessions.filter((s) => s.projectId === scope.id) : scope && scope.type === 'subject' ? state.sessions.filter((s) => s.subjectId === scope.id) : state.sessions;
      sess.forEach((s) => days.add(U.dayKey(s.start)));
      const sorted = [...days].sort();
      let best = 0; let run = 0; let prev = null;
      sorted.forEach((k) => { run = prev && U.addDaysKey(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; });
      return { current: cur, best: Math.max(best, cur), activeDays: days.size };
    },
    dueCards(state, sid) { return state.cards.filter((c) => (!sid || c.subjectId === sid) && TI.srs.isDue(c)); },
    reviewedToday(state, sid) { const t0 = U.startOfDay().getTime(); return state.reviews.filter((r) => r.at >= t0 && (!sid || r.subjectId === sid)).length; },
    dueTopics(state, sid) {
      const today = U.today();
      return state.nodes.filter((n) => n.subjectId === sid && n.due && n.due <= today && stats.nodeRatio(state, n.id) < 1);
    },
    isSubjectDue(state, sid) { return stats.dueTopics(state, sid).length > 0 || stats.dueCards(state, sid).length > 0; },
    // Time per subject for a set of sessions
    bySubject(state, sessions) {
      const m = new Map(); sessions.forEach((s) => m.set(s.subjectId, (m.get(s.subjectId) || 0) + s.duration));
      return [...m.entries()].map(([sid, sec]) => ({ subject: state.subjects.find((x) => x.id === sid), sec })).filter((x) => x.subject).sort((a, b) => b.sec - a.sec);
    },
    // Topics completed per day (cumulative) for the progress timeline
    completionSeries(state, pid, days) {
      const sids = new Set(state.subjects.filter((s) => s.projectId === pid).map((s) => s.id));
      const leaves = state.nodes.filter((n) => sids.has(n.subjectId) && !(stats.children(state, n.subjectId, n.id).length));
      const total = leaves.length || 1;
      return days.map((d) => {
        const end = U.endOfDay(U.parseDay(d)).getTime();
        return leaves.filter((n) => n.done && (n.doneAt || 0) <= end).length / total;
      });
    },
  };

  TI.stats = stats;
})(window.TI);
