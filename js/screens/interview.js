// AI mock interview for one topic: the interviewer asks questions one at a time (with follow-ups), you answer by
// typing or speaking, then you get a scored report and Pass / Shaky / Fail for the topic's interview test.
(function (TI) {
  TI.screens = TI.screens || {};
  const U = TI.util;
  const { state, sel } = TI.store;
  let sess = null;
  let rec = null; // speech recognition

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rerender = () => TI.app.render(true);

  function newSession(nodeId) {
    const c = TI.ai.cfg();
    sess = { nodeId, msgs: [], main: 0, len: c.interviewLen, phase: 'intro', report: null, err: '', draft: '', listening: false, recorded: false, added: false };
  }

  function speak(text) {
    if (!TI.ai.cfg().voice || !window.speechSynthesis) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.02; speechSynthesis.speak(u); } catch (e) { /* ignore */ }
  }
  function stopVoice() { try { if (rec) rec.stop(); } catch (e) { /* ignore */ } try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* ignore */ } }

  async function ask() {
    const n = sel.node(sess.nodeId); if (!n) return;
    sess.phase = 'thinking'; sess.err = ''; rerender();
    try {
      const t = await TI.ai.interviewTurn(n, sess.msgs, sess.len);
      if (!sess || sess.nodeId !== n.id) return;
      sess.msgs.push({ role: 'ai', text: t.say, kind: t.kind, main: t.main });
      if (t.kind === 'question') sess.main = Math.max(sess.main + 1, Math.min(t.main || 0, sess.len));
      speak(t.say);
      if (t.kind === 'closing') { await score(); return; }
      sess.phase = 'chat'; rerender();
    } catch (e) { sess.phase = 'error'; sess.err = TI.ai.friendly(e); sess.retry = 'ask'; rerender(); }
  }

  async function score() {
    const n = sel.node(sess.nodeId); if (!n) return;
    stopVoice();
    if (!sess.msgs.some((m) => m.role === 'me')) { sess.phase = 'chat'; rerender(); TI.ui.toast('Answer at least one question first', { icon: 'info' }); return; }
    sess.phase = 'scoring'; sess.err = ''; rerender();
    try {
      const rep = await TI.ai.evaluate(n, sess.msgs);
      if (!sess || sess.nodeId !== n.id) return;
      sess.report = rep; sess.phase = 'report';
      TI.ai.reportNote(n, rep, sess.msgs);
      rerender();
    } catch (e) { sess.phase = 'error'; sess.err = TI.ai.friendly(e); sess.retry = 'score'; rerender(); }
  }

  function send(text) {
    const t = String(text || '').trim(); if (!t || sess.phase !== 'chat') return;
    stopVoice();
    sess.msgs.push({ role: 'me', text: t }); sess.draft = '';
    ask();
  }

  // ---------- render ----------
  function bubble(m, i) {
    if (m.role === 'ai') return `<div class="iv-msg ai">${m.kind === 'followup' ? '<div class="iv-kind">Follow-up</div>' : ''}${U.esc(m.text).replace(/\n/g, '<br>')}</div>`;
    return `<div class="iv-msg me" data-i="${i}">${U.esc(m.text).replace(/\n/g, '<br>')}</div>`;
  }

  function reportHtml(n) {
    const r = sess.report; const ST = TI.stages;
    const V = { pass: ['Pass', 'verified', 'var(--success)'], shaky: ['Shaky', 'help', 'var(--warning)'], fail: ['Fail', 'replay', 'var(--danger)'] };
    const atTest = ST.stageOf(n) === 3;
    const weak = r.questions.filter((q) => q.score <= 6).length;
    const list = (title, arr, ic) => (arr.length ? `<div class="iv-sec"><h4>${U.icon(ic)}${title}</h4><ul>${arr.map((x) => `<li>${U.esc(x)}</li>`).join('')}</ul></div>` : '');
    const opt = (k, sub) => `<button class="test-opt ${k} ${r.verdict === k ? 'suggested' : ''}" data-act="iv-record" data-r="${k}">${U.icon(V[k][1])}<b>${V[k][0]}</b><span>${sub}</span>${r.verdict === k ? '<em>AI verdict</em>' : ''}</button>`;
    return `<div class="iv-report">
      <div class="iv-score" style="--v:${V[r.verdict][2]}">
        ${TI.ui.ring(r.score / 100, V[r.verdict][2], { size: 96, stroke: 8, label: String(r.score) })}
        <div><div class="iv-verdict">${U.icon(V[r.verdict][1])}${V[r.verdict][0]}</div><p>${U.esc(r.summary)}</p><div class="tiny faint">${U.icon('sticky_note_2', 'xs')} Report saved to this topic's notes</div></div>
      </div>
      ${sess.recorded ? `<div class="cx-ok" style="margin:14px 0">${U.icon('check_circle')}<div><b>Recorded.</b> <span class="muted">${U.esc(sess.recorded)}</span></div></div>`
        : atTest ? `<div class="small muted" style="margin:16px 0 8px">Record the interview test result</div><div class="test-res">${opt('pass', `Re-practice in ${ST.GAP[3]} days`)}${opt('shaky', `Test again in ${ST.SHAKY_DAYS} days`)}${opt('fail', 'Back to Revision 2')}</div>`
        : `<p class="small muted" style="margin-top:14px">${ST.stageOf(n) < 3 ? 'This topic is not at the interview-test stage yet, so nothing is recorded – it was good practice.' : 'This topic is past the interview test, so nothing is recorded.'}</p>`}
      <div class="iv-cols">${list('Strengths', r.strengths, 'thumb_up')}${list('Gaps', r.gaps, 'report')}</div>
      ${list('Revise next', r.studyNext, 'menu_book')}
      <h4 class="iv-qh">Question by question</h4>
      ${r.questions.map((q, i) => `<details class="iv-q" ${q.score <= 6 ? 'open' : ''}><summary><span class="iv-qs ${q.score >= 8 ? 'good' : q.score >= 5 ? 'mid' : 'low'}">${q.score}/10</span><span class="grow">${i + 1}. ${U.esc(q.q)}</span></summary>
        <p>${U.esc(q.feedback)}</p><div class="iv-ideal"><b>Ideal answer</b><div>${U.esc(q.ideal).replace(/\n/g, '<br>')}</div></div></details>`).join('')}
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:18px">
        ${weak && !sess.added ? `<button class="btn" data-act="iv-addweak">${U.icon('style')}Add ${U.plural(weak, 'weak question')} as cards</button>` : sess.added ? `<span class="small muted">${U.icon('check', 'xs')} Added to this topic's cards</span>` : ''}
        <button class="btn ghost" data-act="iv-again">${U.icon('replay')}Interview again</button>
        <button class="btn ghost" data-act="iv-close">Done</button>
      </div>
    </div>`;
  }

  const screen = {
    title: 'Mock interview',
    fullscreen: true,
    static: true,
    render(ctx) {
      const n = sel.node(ctx.params[0]);
      if (!n) return `<div class="iv"><div class="iv-bar"><button class="icon-btn" data-act="iv-close" aria-label="Close">${U.icon('close')}</button><b>Mock interview</b></div>${TI.ui.empty('search_off', 'Topic not found', 'It may have been deleted, or this device has not synced yet.')}</div>`;
      if (!sess || sess.nodeId !== n.id) newSession(n.id);
      const s = sel.subject(n.subjectId); const c = TI.ai.cfg();
      const path = TI.stats.pathOf(state, n.id).map((x) => x.title).join(' › ');
      const cards = TI.ai.topicCards(n).length;
      const busy = sess.phase === 'thinking' || sess.phase === 'scoring';
      const prog = sess.phase === 'report' ? 'Report' : sess.phase === 'intro' ? `${sess.len} questions` : `Question ${Math.max(1, Math.min(sess.main, sess.len))} of ${sess.len}`;
      let body;
      if (sess.phase === 'intro') {
        body = `<div class="iv-intro card">
          <div class="iv-ic">${U.icon('record_voice_over')}</div>
          <h2>Mock interview · ${U.esc(n.title)}</h2>
          <p class="muted">${sess.len} questions at <b>${TI.ai.LEVEL_NAMES[c.level]}</b> level${cards ? `, drawn from this topic's ${U.plural(cards, 'interview card')}` : ''}. The interviewer asks follow-ups when an answer is thin, then scores you and suggests Pass, Shaky or Fail.</p>
          <ul class="small muted iv-tips"><li>Answer the way you would out loud – full sentences, examples, trade-offs.</li>${SR ? '<li>Tap the microphone to speak your answer instead of typing.</li>' : ''}<li>Stuck? Say “I don't know” – it's better practice than guessing.</li></ul>
          <div class="row" style="gap:10px;justify-content:center;flex-wrap:wrap">
            <div class="seg" role="group" aria-label="Number of questions">${[3, 5, 8].map((k) => `<button class="${sess.len === k ? 'on' : ''}" data-act="iv-len" data-v="${k}">${k} questions</button>`).join('')}</div>
            <button class="btn primary lg" data-act="iv-start">${U.icon('play_arrow')}Start interview</button>
          </div>
        </div>`;
      } else if (sess.phase === 'report') {
        body = reportHtml(n);
      } else {
        body = `<div class="iv-chat" id="iv-chat">${sess.msgs.map(bubble).join('')}
          ${busy ? `<div class="iv-msg ai typing"><span></span><span></span><span></span>${sess.phase === 'scoring' ? '<em>Scoring your interview…</em>' : ''}</div>` : ''}
          ${sess.phase === 'error' ? `<div class="cx-err">${U.icon('error')}<span>${U.esc(sess.err)} <button class="btn sm" data-act="iv-retry">Try again</button></span></div>` : ''}
        </div>`;
      }
      const composer = sess.phase === 'chat' || sess.phase === 'thinking' || sess.phase === 'error' ? `<div class="iv-compose">
          <textarea class="textarea" id="iv-draft" data-input="iv-draft" rows="3" placeholder="${sess.listening ? 'Listening… speak your answer' : 'Type your answer… (Ctrl + Enter to send)'}" ${sess.phase !== 'chat' ? 'disabled' : ''}>${U.esc(sess.draft)}</textarea>
          <div class="iv-compose-acts">
            ${SR ? `<button class="icon-btn ${sess.listening ? 'rec' : ''}" data-act="iv-mic" title="${sess.listening ? 'Stop listening' : 'Speak your answer'}" aria-label="Speak your answer" ${sess.phase !== 'chat' ? 'disabled' : ''}>${U.icon(sess.listening ? 'stop_circle' : 'mic')}</button>` : ''}
            <button class="btn sm ghost" data-act="iv-idk" ${sess.phase !== 'chat' ? 'disabled' : ''}>I don't know</button>
            <div class="grow"></div>
            <button class="btn primary" data-act="iv-send" ${sess.phase !== 'chat' ? 'disabled' : ''}>${U.icon('send')}Send</button>
          </div></div>` : '';
      return `<div class="iv" style="--c:${s ? s.color : 'var(--primary)'}">
        <div class="iv-bar">
          <button class="icon-btn" data-act="iv-close" aria-label="Close">${U.icon('close')}</button>
          <div class="grow" style="min-width:0"><div class="ellipsis iv-title">Mock interview · ${U.esc(n.title)}</div><div class="ellipsis tiny faint">${U.esc(path)} · ${prog}</div></div>
          <button class="icon-btn ${c.voice ? 'on' : ''}" data-act="iv-voice" title="${c.voice ? 'Interviewer voice on' : 'Interviewer voice off'}" aria-label="Interviewer voice">${U.icon(c.voice ? 'volume_up' : 'volume_off')}</button>
          ${sess.phase === 'chat' || sess.phase === 'thinking' ? `<button class="btn sm" data-act="iv-end" ${busy ? 'disabled' : ''}>${U.icon('flag')}<span class="desktop-only">End and score</span></button>` : ''}
        </div>
        <div class="iv-body">${body}</div>
        ${composer}
      </div>`;
    },
    mount(root) {
      const chat = root.querySelector('#iv-chat'); if (chat) chat.scrollTop = chat.scrollHeight;
      const ta = root.querySelector('#iv-draft');
      if (ta && !ta.disabled) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(ta.value); } }); }
      return () => {};
    },
    inputs: { 'iv-draft': (el) => { if (sess) sess.draft = el.value; } },
    actions: {
      'iv-close': () => { const n = sess && sel.node(sess.nodeId); stopVoice(); const done = !sess || sess.phase === 'intro' || sess.phase === 'report'; const go = () => { sess = null; TI.router.go(n ? `/subject/${n.subjectId}` : '/project', { replace: true }); }; if (done) go(); else TI.ui.confirmDialog('Leave the interview?', 'Your answers so far will be lost. Use “End and score” to get a report instead.', 'Leave').then((ok) => ok && go()); },
      'iv-len': (el) => { sess.len = +el.dataset.v; actions().updateSettings({ aiInterviewLen: sess.len }); rerender(); },
      'iv-start': async () => {
        const st = await TI.ai.status();
        if (!st.configured) { TI.ui.dialog({ title: 'AI is not set up yet', html: `<p>${U.esc(st.noSheet ? 'Connect your Google Sheet first (Settings › Google Sheet backend). AI runs through your sheet so your key stays private.' : st.oldScript ? 'Update your sheet script to version 4 (backend/SETUP.md › Updating) and deploy a new version.' : 'In your Google Sheet open TrackIt › Set Gemini API key, then deploy a new version. Details in Settings › AI.')}</p>`, buttons: [{ label: 'OK', kind: 'primary', primary: true, value: () => true }] }); return; }
        ask();
      },
      'iv-send': () => send(sess.draft),
      'iv-idk': () => send("I don't know."),
      'iv-end': () => { if (sess.phase === 'chat') score(); },
      'iv-retry': () => (sess.retry === 'score' ? score() : ask()),
      'iv-voice': () => { actions().updateSettings({ aiVoice: !TI.ai.cfg().voice }); if (!TI.ai.cfg().voice) stopVoice(); rerender(); },
      'iv-mic': () => {
        if (!SR) return;
        if (sess.listening) { try { rec && rec.stop(); } catch (e) { /* ignore */ } return; }
        try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* ignore */ }
        rec = new SR(); rec.lang = navigator.language || 'en-IN'; rec.continuous = true; rec.interimResults = true;
        const base = sess.draft ? sess.draft.replace(/\s*$/, ' ') : '';
        rec.onresult = (e) => { let txt = ''; for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript; sess.draft = base + txt; const ta = document.getElementById('iv-draft'); if (ta) ta.value = sess.draft; };
        rec.onend = () => { sess.listening = false; rerender(); };
        rec.onerror = (e) => { sess.listening = false; if (e.error !== 'aborted' && e.error !== 'no-speech') TI.ui.toast(`Microphone: ${e.error}`, { icon: 'mic_off' }); rerender(); };
        sess.listening = true; rec.start(); rerender();
      },
      'iv-record': (el) => {
        const n = sel.node(sess.nodeId); if (!n) return;
        const res = el.dataset.r; const ST = TI.stages;
        TI.tree.recordTest(n.id, res, false);
        sess.recorded = res === 'pass' ? `Interview test passed · Re-practice due in ${ST.GAP[3]} days` : res === 'shaky' ? `Shaky · interview test again in ${ST.SHAKY_DAYS} days` : 'Fail · back to Revision 2, due tomorrow';
        rerender();
      },
      'iv-addweak': () => {
        const n = sel.node(sess.nodeId); if (!n) return;
        const weak = sess.report.questions.filter((q) => q.score <= 6 && q.ideal);
        const have = new Set(TI.ai.topicCards(n).map((c) => c.front.trim().toLowerCase()));
        const list = weak.filter((q) => !have.has(q.q.trim().toLowerCase())).map((q) => ({ front: q.q, back: q.ideal }));
        if (list.length) TI.ai.saveQuestions(n, list);
        sess.added = true; rerender();
        TI.ui.toast(list.length ? `${U.plural(list.length, 'card')} added to “${n.title}”` : 'Those questions are already in your cards', { icon: 'style' });
      },
      'iv-again': () => { const id = sess.nodeId; newSession(id); rerender(); },
    },
  };
  const actions = () => TI.store.actions;

  TI.screens.interview = screen;
})(window.TI);
