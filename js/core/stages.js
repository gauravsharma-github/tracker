// Five-stage mastery for every topic (leaf node):
//   1 Learn → (+1 day) 2 Revision 1 → (+7) 3 Revision 2 → (+7) 4 Interview test → (+7) 5 Re-practice
// A topic is complete ("mastered") only after stage 5. Each stage is worth 20% of the topic.
// Node fields: stage (0–5), stageDue ('YYYY-MM-DD' for the next stage, null when none),
//              done/doneAt (= mastered, kept for older code and exports).
// History: collection `stages` { id, nodeId, subjectId, projectId, stage (1–5), result ('', pass, shaky, fail),
//          at, early, toStage, prevStage, prevDue, prevDone, prevDoneAt } – one row per tick, used for undo,
//          the stage history, the heatmap and the progress timeline.
(function (TI) {
  const U = TI.util;
  const N = 5;
  const NAMES = ['Learn', 'Revision 1', 'Revision 2', 'Interview test', 'Re-practice'];
  const SHORT = ['Learn', 'Rev 1', 'Rev 2', 'Test', 'Re-practice'];
  const GAP = [1, 7, 7, 7]; // days after finishing stage 1..4 until the next stage is due
  const SHAKY_DAYS = 3;     // interview test "shaky" → test again in 3 days
  const FAIL_DAYS = 1;      // "fail" → back to Revision 2, due tomorrow
  const SPREAD_PER_DAY = 5; // migrating already-ticked topics: Revision 1s spread at most 5 a day

  const stageOf = (n) => (n ? Math.max(0, Math.min(N, n.stage || 0)) : 0);

  // What happens when stage `k` (1–5) is completed today (result only for k = 4)
  function outcome(n, k, result = '') {
    const today = U.today();
    if (k === 4 && result === 'shaky') return { stage: 3, stageDue: U.addDaysKey(today, SHAKY_DAYS) };
    if (k === 4 && result === 'fail') return { stage: 2, stageDue: U.addDaysKey(today, FAIL_DAYS) };
    if (k >= N) return { stage: N, stageDue: null };
    return { stage: k, stageDue: U.addDaysKey(today, GAP[k - 1]) };
  }

  // 'over' | 'due' | 'later' | null for the next stage of a topic
  function dueState(n, today = U.today()) {
    const s = stageOf(n);
    if (s < 1 || s >= N || !n.stageDue) return null;
    return n.stageDue < today ? 'over' : n.stageDue === today ? 'due' : 'later';
  }
  const isDue = (n, today = U.today()) => { const d = dueState(n, today); return d === 'over' || d === 'due'; };
  const isEarly = (n) => dueState(n) === 'later';

  const logsOf = (state, nodeId) => (state.stages || []).filter((l) => l.nodeId === nodeId).sort((a, b) => a.at - b.at);

  // When was stage k (0-based index) last completed (for tooltips)
  function doneInfo(state, n) {
    const out = new Array(N).fill(null);
    logsOf(state, n.id).forEach((l) => {
      if (l.result === 'shaky' || l.result === 'fail') return;
      out[l.stage - 1] = l;
    });
    for (let i = stageOf(n); i < N; i++) out[i] = null; // a "fail" reset un-does later stages
    return out;
  }

  function tooltip(state, n, k /* 0-based */) {
    const s = stageOf(n); const name = NAMES[k];
    if (k < s) {
      const l = doneInfo(state, n)[k];
      return `${name} · done${l ? ' ' + U.fmtDate(l.at) : ''}${l && l.result === 'pass' ? ' · passed' : ''}${l && l.early ? ' (early)' : ''}`;
    }
    if (k === s) {
      if (!n.stageDue || s === 0) return `${name} · click when done`;
      const st = dueState(n);
      const when = st === 'over' ? `overdue since ${U.fmtDate(U.parseDay(n.stageDue))}` : st === 'due' ? 'due today' : `due ${U.fmtDate(U.parseDay(n.stageDue))}`;
      return `${name} · ${when} · click when done`;
    }
    return `${name} · after ${NAMES[k - 1]}`;
  }

  // 'today' / 'tomorrow' / 'on Mon, Nov 30' for sentences
  const when = (k) => { const t = U.today(); return k === t ? 'today' : k === U.addDaysKey(t, 1) ? 'tomorrow' : `on ${U.fmtDay(k)}`; };

  TI.stages = { when, N, NAMES, SHORT, GAP, SHAKY_DAYS, FAIL_DAYS, SPREAD_PER_DAY, stageOf, outcome, dueState, isDue, isEarly, logsOf, doneInfo, tooltip };
})(window.TI);
