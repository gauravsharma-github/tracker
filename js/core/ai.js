// AI features (Google Gemini through your Google Sheet's script – the API key never reaches the browser).
//  1. Interview questions for a topic → saved as that topic's interview flashcards (stage 4)
//  2. Mock interviewer → scored report → Pass / Shaky / Fail for the interview test
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  const LEVELS = {
    moderate: 'moderate – clear fundamentals and common real-world use, the level most interviews ask',
    senior: 'senior – depth, trade-offs, edge cases and production experience',
    architect: 'architect – system design, scalability, governance, trade-offs between approaches',
  };
  const LEVEL_NAMES = { moderate: 'Moderate', senior: 'Senior', architect: 'Architect' };
  const MAX_PDF_BYTES = 15 * 1024 * 1024; // Gemini accepts about 20 MB per request

  const cfg = () => ({
    profile: state.settings.aiProfile || '',
    level: state.settings.aiLevel || 'moderate',
    count: state.settings.aiCount || 8,
    auto: state.settings.aiAuto !== false,
    interviewLen: state.settings.aiInterviewLen || 5,
    voice: !!state.settings.aiVoice,
  });

  // ---------- status ----------
  let statusCache = null; let statusAt = 0;
  async function status(force = false) {
    if (TI.api.mode() !== 'sheets') return { configured: false, noSheet: true };
    if (!force && statusCache && Date.now() - statusAt < 10 * 60 * 1000) return statusCache;
    try { statusCache = await TI.api.aiStatus(); } catch (e) { statusCache = { configured: false, error: e.message, oldScript: /Unknown operation/i.test(e.message) }; }
    statusAt = Date.now();
    return statusCache;
  }
  const knownReady = () => !!(statusCache && statusCache.configured);

  function friendly(e) {
    const m = (e && e.message) || String(e);
    if (e && e.code === 'no_sheet') return m;
    if (e && e.code === 'no_key') return 'AI is not set up yet: in your Google Sheet open TrackIt › Set Gemini API key.';
    if (e && e.code === 'busy') return 'Gemini is very busy right now (high demand) – every model TrackIt tried was busy. Try again in a few minutes, or do it in Claude instead.';
    if (e && e.code === 'rate_limit') return 'The free Gemini limits are used up for now on every model TrackIt tried. Wait a minute (or until tomorrow for the daily limit), or do it in Claude instead.';
    if (e && e.code === 'bad_key') return 'Gemini rejected the API key. Set it again in your sheet: TrackIt › Set Gemini API key.';
    if (e && e.code === 'bad_model') return 'That Gemini model is not available. In your sheet choose TrackIt › Choose AI model and leave it empty for the default.';
    if (/Unknown operation/i.test(m)) return 'Your sheet script is too old for AI. Update backend/Code.gs to version 4 (see backend/SETUP.md) and deploy a new version.';
    if (/abort/i.test(m)) return 'The AI took too long to answer. Try again.';
    return m;
  }

  // ---------- low-level call ----------
  async function call({ system, contents, json = true, temperature = 0.7, maxTokens = 8192 }) {
    const r = await TI.api.ai({ system, contents, json, temperature, maxTokens });
    statusCache = { ...(statusCache || {}), configured: true, model: r.model }; statusAt = Date.now();
    if (!json) return r.text;
    return parseJson(r.text);
  }
  function parseJson(t) {
    let s = String(t || '').trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i); // a fenced block anywhere (Claude often adds a sentence around it)
    if (fence) s = fence[1].trim();
    s = s.replace(/[\u201c\u201d]/g, (q) => (/^\s*[{[]/.test(s) ? '"' : q)); // smart quotes from some copy/paste paths
    try { return JSON.parse(s); } catch (e) { /* fall through */ }
    const a = s.indexOf('{'); const b = s.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { /* ignore */ } }
    throw new Error('The AI answer could not be read. Try again.');
  }

  // ---------- context ----------
  function context(n) {
    const s = sel.subject(n.subjectId); const p = s && sel.project(s.projectId);
    const path = TI.stats.pathOf(state, n.id).map((x) => x.title);
    const c = cfg();
    return [
      p ? `Course / goal: ${p.name}` : '',
      s ? `Subject: ${s.name}` : '',
      `Topic: ${path.join(' › ')}`,
      c.profile ? `About the candidate: ${c.profile}` : '',
    ].filter(Boolean).join('\n');
  }
  const topicCards = (n) => state.cards.filter((c) => c.nodeId === n.id);
  const pdfsOf = (n) => (state.attachments || []).filter((a) => a.nodeId === n.id && a.kind === 'pdf');

  async function blobToBase64(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer()); let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  async function pdfParts(n, onNote) {
    const parts = []; let total = 0;
    for (const a of pdfsOf(n)) {
      if (total + (a.size || 0) > MAX_PDF_BYTES) { onNote && onNote(`Skipped ${a.name} (too large to send to the AI)`); continue; }
      if (!TI.github.configured()) break;
      try {
        onNote && onNote(`Reading ${a.name}…`);
        const blob = await TI.github.download(a); total += blob.size;
        parts.push({ inline_data: { mime_type: 'application/pdf', data: await blobToBase64(blob) } });
      } catch (e) { onNote && onNote(`Could not read ${a.name}: ${e.message}`); }
    }
    return parts;
  }

  // ---------- 1. interview questions ----------
  function questionsPrompt(n, { count = cfg().count, level = cfg().level, extra = '' } = {}) {
    const existing = topicCards(n).map((c) => c.front);
    const system = `[task:questions]
You are a senior interviewer at a product company preparing interview questions so a candidate can practise one topic until they are interview-ready.
Write exactly ${count} questions on the topic below, at this level: ${LEVELS[level] || LEVELS.moderate}.
Rules:
- Each question is short and easy to say out loud (one or two sentences). No multi-part essays.
- Mix types: concepts, real-world scenarios, hands-on / "how would you" questions${level === 'architect' ? ', and design questions' : ''}.
- Stay strictly on this topic; don't drift into neighbouring topics.
- The answer is what a strong candidate would say: accurate, specific, 2–6 short sentences or bullet points (use "- " bullets), with a concrete example where it helps.
- Don't repeat or closely rephrase questions the candidate already has.
Return JSON only: {"questions":[{"q":"question","a":"model answer","type":"concept|scenario|hands-on|design"}]}`;
    const user = `${context(n)}${existing.length ? `\n\nQuestions the candidate already has (don't repeat):\n${existing.map((q) => `- ${q}`).join('\n')}` : ''}${extra ? `\n\nExtra instructions from the candidate: ${extra}` : ''}`;
    return { system, user };
  }
  const toQuestions = (j) => (Array.isArray(j) ? j : j.questions || []).map((x) => ({ front: String(x.q || x.question || '').trim(), back: String(x.a || x.answer || '').trim(), type: x.type || '' })).filter((x) => x.front && x.back);

  async function generateQuestions(n, { count = cfg().count, level = cfg().level, usePdf = false, extra = '', onNote } = {}) {
    const { system, user } = questionsPrompt(n, { count, level, extra });
    const parts = [];
    if (usePdf) {
      const pdf = await pdfParts(n, onNote);
      if (pdf.length) { parts.push(...pdf); parts.push({ text: 'The attached PDF(s) are the candidate\'s own study notes for this topic. Base the questions on what they cover, and fill obvious gaps an interviewer would still ask about.' }); }
    }
    parts.push({ text: user });
    onNote && onNote('Writing questions…');
    const j = await call({ system, contents: [{ role: 'user', parts }], temperature: 0.8 });
    const list = toQuestions(j);
    if (!list.length) throw new Error('The AI returned no questions. Try again.');
    return list;
  }
  function saveQuestions(n, list) {
    actions.addCards(n.subjectId, list.map((x) => ({ front: x.front, back: x.back, nodeId: n.id })));
  }

  // Runs in the background when a topic finishes Revision 2 (stage 4 = interview test is next).
  // If Gemini is busy or the free limit is hit, the topic is queued and retried later (also after a reload).
  const autoBusy = new Set();
  const PENDING = 'ai.pending';
  const pending = () => { const v = TI.storage.get(PENDING); return Array.isArray(v) ? v : []; };
  const setPending = (a) => TI.storage.set(PENDING, [...new Set(a)]);
  let retryTimer = null; let retryDelay = 0;
  function scheduleRetry() {
    clearTimeout(retryTimer); if (!pending().length) { retryDelay = 0; return; }
    retryDelay = Math.min(60, retryDelay ? retryDelay * 2 : 3); // minutes: 3, 6, 12 … up to an hour
    retryTimer = setTimeout(retryPending, retryDelay * 60000);
  }
  async function retryPending() {
    const ids = pending(); if (!ids.length) return;
    for (const id of ids) { const ok = await autoFill(id, { quiet: true }); if (ok === 'later') break; }
    scheduleRetry();
  }
  async function autoFill(nodeId, { quiet = false } = {}) {
    const n = sel.node(nodeId); const c = cfg();
    const drop = () => setPending(pending().filter((x) => x !== nodeId));
    if (!n || !c.auto || TI.stages.stageOf(n) !== 3) { drop(); return 'skip'; }
    if (autoBusy.has(nodeId) || TI.api.mode() !== 'sheets') return 'skip';
    if (topicCards(n).length >= Math.min(5, c.count)) { drop(); return 'skip'; }
    const st = await status(!knownReady()); if (!st.configured) return 'skip'; // re-check: the key may have been added since
    autoBusy.add(nodeId);
    try {
      const list = await generateQuestions(n, { usePdf: pdfsOf(n).length > 0 && TI.github.configured() });
      if (!sel.node(nodeId)) return 'skip';
      saveQuestions(n, list); drop();
      TI.ui.toast(`${U.plural(list.length, 'interview question')} ready for “${n.title}”`, { icon: 'auto_awesome', duration: 5000, action: { label: 'View', fn: () => TI.router.go(`/cards/${n.subjectId}`) } });
      return 'ok';
    } catch (e) {
      if (e && (e.code === 'busy' || e.code === 'rate_limit' || /timed out|abort/i.test(e.message))) {
        setPending([...pending(), nodeId]);
        if (!quiet) TI.ui.toast(`Gemini is busy, so the interview questions for “${n.title}” will be retried automatically in a few minutes.`, { icon: 'schedule', duration: 8000, action: { label: 'Do it in Claude', fn: () => TI.aiui.claudeQuestionsSheet(nodeId) } });
        scheduleRetry();
        return 'later';
      }
      drop();
      TI.ui.toast(`Couldn't prepare interview questions for “${n.title}”: ${friendly(e)}`, { icon: 'error', duration: 8000, action: { label: 'Do it in Claude', fn: () => TI.aiui.claudeQuestionsSheet(nodeId) } });
      return 'error';
    } finally { autoBusy.delete(nodeId); }
  }
  // Pick up anything left waiting from an earlier visit
  setTimeout(() => { if (pending().length) retryPending(); }, 15000);

  // ---------- 2. mock interviewer ----------
  function interviewerSystem(n, len) {
    const bank = topicCards(n).map((c, i) => `${i + 1}. Q: ${c.front}\n   Expected: ${c.back.replace(/\n+/g, ' ')}`).join('\n');
    return `[task:interview]
You are a friendly but rigorous interviewer at a product company running a mock technical interview on ONE topic.
${context(n)}
Level: ${LEVELS[cfg().level] || LEVELS.moderate}
How to run it:
- Ask ${len} main questions, one at a time. Keep each question short and natural, as said out loud.
- ${bank ? 'Use the question bank below as your main source (rephrase, don\'t read verbatim) and add your own if needed.' : 'Write your own questions; mix concepts, scenarios and hands-on questions.'}
- If an answer is vague, incomplete or wrong, ask ONE short follow-up that probes deeper before moving on. Follow-ups don't count as main questions.
- Don't teach or reveal answers during the interview. At most a brief neutral acknowledgement ("Okay.", "Got it.") before the next question.
- If the candidate says they don't know, acknowledge it and move on.
- After the last main question has been answered, close politely (kind "closing") without giving a score.
Reply with JSON only: {"say":"what you say","kind":"question|followup|closing","main":<number of main questions asked so far including this one>}
${bank ? `\nQuestion bank:\n${bank}` : ''}`;
  }
  const toContents = (msgs) => msgs.map((m) => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.role === 'ai' ? JSON.stringify({ say: m.text, kind: m.kind, main: m.main }) : m.text }] }));

  async function interviewTurn(n, msgs, len) {
    const contents = toContents(msgs);
    if (!contents.length || contents[0].role !== 'user') contents.unshift({ role: 'user', parts: [{ text: 'I am ready. Please start the interview.' }] });
    const j = await call({ system: interviewerSystem(n, len), contents, temperature: 0.6, maxTokens: 2048 });
    const say = String(j.say || j.message || '').trim();
    if (!say) throw new Error('The interviewer had nothing to say. Try again.');
    return { say, kind: ['question', 'followup', 'closing'].includes(j.kind) ? j.kind : 'question', main: Number(j.main) || 0 };
  }

  const RUBRIC = `Scoring: give each main question 0–10 (follow-up answers count towards their question). Overall score 0–100.
Verdict: "pass" = interview-ready (about 75+ and no serious misconception); "shaky" = mostly right but gaps or vague answers (about 50–74); "fail" = major gaps or wrong concepts (below about 50). Unanswered questions score 0.
For each main question give what was good or missing in one or two sentences, and a concise ideal answer (2–5 short sentences or "- " bullets).`;
  const REPORT_SHAPE = '{"score":0-100,"verdict":"pass|shaky|fail","summary":"two sentences","strengths":["…"],"gaps":["…"],"questions":[{"q":"question","score":0-10,"feedback":"…","ideal":"…"}],"studyNext":["specific thing to revise"]}';

  async function evaluate(n, msgs) {
    const transcript = msgs.map((m) => `${m.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${m.text}`).join('\n');
    const system = `[task:evaluate]
You are the interviewer. Score this mock interview on one topic, honestly and specifically, like a hiring panel would.
${context(n)}
Level: ${LEVELS[cfg().level] || LEVELS.moderate}
${RUBRIC}
Return JSON only: ${REPORT_SHAPE}`;
    const j = await call({ system, contents: [{ role: 'user', parts: [{ text: `Transcript:\n${transcript}` }] }], temperature: 0.2 });
    return normReport(j);
  }
  function normReport(j) {
    if (!j || typeof j !== 'object' || (j.score == null && !j.verdict)) throw new Error('That doesn\'t look like the interview report. Copy the whole JSON block Claude gave at the end.');
    const score = Math.max(0, Math.min(100, Math.round(Number(j.score) || 0)));
    let verdict = ['pass', 'shaky', 'fail'].includes(j.verdict) ? j.verdict : score >= 75 ? 'pass' : score >= 50 ? 'shaky' : 'fail';
    if (verdict === 'pass' && score < 65) verdict = 'shaky';
    if (verdict === 'fail' && score >= 75) verdict = 'shaky';
    return {
      score, verdict, summary: String(j.summary || ''),
      strengths: (j.strengths || []).map(String).slice(0, 6), gaps: (j.gaps || []).map(String).slice(0, 6), studyNext: (j.studyNext || []).map(String).slice(0, 6),
      questions: (j.questions || []).map((q) => ({ q: String(q.q || ''), score: Math.max(0, Math.min(10, Number(q.score) || 0)), feedback: String(q.feedback || ''), ideal: String(q.ideal || '') })).filter((q) => q.q),
    };
  }

  function reportNote(n, rep, msgs, via = '') {
    const V = { pass: 'Pass', shaky: 'Shaky', fail: 'Fail' }[rep.verdict];
    const lines = [
      `Score ${rep.score}/100 · ${V}`, '', rep.summary, '',
      rep.strengths.length ? 'Strengths:\n' + rep.strengths.map((x) => `- ${x}`).join('\n') : '',
      rep.gaps.length ? '\nGaps:\n' + rep.gaps.map((x) => `- ${x}`).join('\n') : '',
      rep.studyNext.length ? '\nRevise next:\n' + rep.studyNext.map((x) => `- ${x}`).join('\n') : '',
      '\nQuestions:', ...rep.questions.map((q, i) => `\n${i + 1}. ${q.q} (${q.score}/10)\n${q.feedback}\nIdeal: ${q.ideal}`),
      msgs.length ? '\n— Transcript —' : '', ...msgs.map((m) => `${m.role === 'ai' ? 'Interviewer' : 'Me'}: ${m.text}`),
    ];
    actions.addNote({ subjectId: n.subjectId, nodeId: n.id, title: `Mock interview${via ? ` (${via})` : ''} · ${U.fmtDate(new Date())} · ${rep.score}/100 (${V})`, body: lines.filter((x) => x !== '').join('\n') });
  }

  // ---------- "Do it in Claude instead" (copy a prompt into your Claude chat, paste the answer back) ----------
  function claudeQuestionsPrompt(n, opts = {}) {
    const { system, user } = questionsPrompt(n, opts);
    const pdfs = pdfsOf(n);
    return `${system.replace('[task:questions]\n', '')}

${user}
${pdfs.length ? `\nIf I've attached PDF notes (${pdfs.map((a) => a.name).join(', ')}), base the questions on what they cover and fill obvious gaps an interviewer would still ask about.\n` : ''}
Reply with only the JSON in one \`\`\`json code block – no other text – so I can paste it into my study app.`;
  }
  function claudeInterviewPrompt(n, len = cfg().interviewLen, sofar = []) {
    const bank = topicCards(n).map((c, i) => `${i + 1}. ${c.front}\n   Expected: ${c.back.replace(/\n+/g, ' ')}`).join('\n');
    return `Run a mock technical interview with me on ONE topic, like a friendly but rigorous interviewer at a product company.
${context(n)}
Level: ${LEVELS[cfg().level] || LEVELS.moderate}

How to run it:
- Ask ${len} main questions, ONE per message, and wait for my answer each time. Keep questions short and natural, as said out loud.
- ${bank ? 'Use the question bank below as your main source (rephrase, don\'t read verbatim); add your own if needed.' : 'Write your own questions; mix concepts, real-world scenarios and hands-on questions.'}
- If an answer is vague, incomplete or wrong, ask ONE short follow-up before moving on (follow-ups don't count as main questions).
- Don't teach or reveal answers during the interview – at most "Okay." or "Got it." before the next question. If I say I don't know, move on.
- After my answer to question ${len} (or if I type END), stop and give me the report.

The report: first two or three friendly sentences, then the result as ONE \`\`\`json code block in exactly this shape (I'll paste it into my study app):
${REPORT_SHAPE}
${RUBRIC}
${bank ? `\nQuestion bank:\n${bank}\n` : ''}${sofar.length ? `\nWe already started; here is the interview so far (count these questions):\n${sofar.map((m) => `${m.role === 'ai' ? 'Interviewer' : 'Me'}: ${m.text}`).join('\n')}\n\nContinue from here with the next question.` : '\nStart now with question 1.'}`;
  }
  const NOJSON = "Couldn't find the JSON block in that. Copy Claude's whole reply (it should contain a ```json block) and paste it here.";
  const parseClaudeJson = (text) => { try { return parseJson(text); } catch (e) { throw new Error(NOJSON); } };
  function parseClaudeQuestions(text) { const list = toQuestions(parseClaudeJson(text)); if (!list.length) throw new Error('No questions found. Copy Claude\'s whole reply (the JSON block) and paste it here.'); return list; }
  function parseClaudeReport(text) { return normReport(parseClaudeJson(text)); }

  TI.ai = { claudeQuestionsPrompt, claudeInterviewPrompt, parseClaudeQuestions, parseClaudeReport, LEVELS, LEVEL_NAMES, cfg, status, knownReady, friendly, call, generateQuestions, saveQuestions, autoFill, interviewTurn, evaluate, reportNote, topicCards, pdfsOf };
})(window.TI);
