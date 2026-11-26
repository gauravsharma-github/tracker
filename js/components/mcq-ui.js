// Quiz question bank: add / edit / delete, paste many at once, CSV import & template (topic, subject or project).
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  const Q = TI.quiz;
  const L = (i) => String.fromCharCode(65 + i);
  const PASTE_EXAMPLE = `Q: Which number is divisible by 3?
A) 124
B) 123 *
C) 125
D) 128
Why: Digit sum 1+2+3 = 6, which is divisible by 3.

Q: Which number is divisible by 4?
A) 1022
B) 1026
C) 1024
D) 1030
Answer: C
Why: The last two digits, 24, are divisible by 4.`;

  function download(name, text, type = 'text/csv') {
    const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  const safeName = (s) => String(s || 'questions').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'questions';
  const leavesOf = (scope) => {
    if (scope.nodeId) return [sel.node(scope.nodeId)].filter(Boolean);
    const sids = scope.subjectId ? [scope.subjectId] : sel.subjects(scope.projectId).map((s) => s.id);
    return sids.flatMap((sid) => TI.stats.leaves(state, sid).map((x) => x.node));
  };
  function stats(m) {
    let asked = 0; let wrong = 0;
    (state.quizzes || []).forEach((a) => (a.answers || []).forEach((x) => { if (x.id === m.id) { asked++; if (!x.ok) wrong++; } }));
    return { asked, wrong };
  }

  // ---------- the topic's question bank ----------
  function bankSheet(nodeId) {
    const n = sel.node(nodeId); if (!n) return;
    const draw = () => {
      const list = Q.bank(state, n.id); const size = Q.sizeFor(state, n);
      const status = list.length >= Q.MIN_BANK ? `Quizzes use ${Math.min(size, list.length)} of these${list.length < size ? ` (aim for ${size}+ so every quiz is different)` : list.length < size * 2 ? ' – add more so each revision gets fresh questions' : ''}.` : `Add at least ${Q.MIN_BANK} to use quizzes for Learn, Revision 1 and Revision 2 (${Q.MIN_BANK - list.length} more).`;
      return `<div class="small muted" style="margin:-4px 0 12px">${U.plural(list.length, 'question')} · ${status} You need 80% to pass.</div>
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:14px">
          <button class="btn primary sm" data-act="add">${U.icon('add')}Add question</button>
          <button class="btn sm" data-act="paste">${U.icon('content_paste')}Paste many</button>
          <button class="btn sm ghost" data-act="csv">${U.icon('table_view')}Spreadsheet (CSV)</button>
        </div>
        ${list.length ? `<div class="mcq-list">${list.map((m, i) => { const st = stats(m); return `<div class="mcq-item">
          <div class="mcq-top"><b>${i + 1}. ${U.esc(m.q)}</b><div class="mcq-acts"><button class="icon-btn sm" data-act="edit" data-id="${m.id}" aria-label="Edit">${U.icon('edit')}</button><button class="icon-btn sm" data-act="del" data-id="${m.id}" aria-label="Delete">${U.icon('delete')}</button></div></div>
          <ol class="mcq-opts" type="A">${m.options.map((o, k) => `<li class="${k === m.correct ? 'ok' : ''}">${U.esc(o)}${k === m.correct ? ` ${U.icon('check', 'xs')}` : ''}</li>`).join('')}</ol>
          ${m.why ? `<div class="mcq-why">${U.esc(m.why)}</div>` : ''}
          ${st.asked ? `<div class="tiny faint">Asked ${st.asked}× · wrong ${st.wrong}×</div>` : ''}</div>`; }).join('')}</div>`
          : TI.ui.empty('quiz', 'No questions yet', 'Add them one by one, paste a batch from your notes or a practice test, or fill a spreadsheet.')}`;
    };
    let unsub = null;
    TI.ui.openSheet({
      title: `Quiz questions · ${n.title}`, size: 'lg', html: `<div id="mcq-bank">${draw()}</div>`,
      footer: '<button class="btn" data-close>Done</button>',
      onClose: () => { if (unsub) unsub(); },
      onMount(a) {
        const repaint = () => { const el = a.el.querySelector('#mcq-bank'); if (el) el.innerHTML = draw(); };
        unsub = TI.store.subscribe(repaint);
        TI.forms.onAct(a, {
          add: () => editor(n, null, repaint),
          edit: (el) => editor(n, state.mcqs.find((m) => m.id === el.dataset.id), repaint),
          async del(el) { if (await TI.ui.confirmDialog('Delete this question?', '', 'Delete')) { actions.deleteMcq(el.dataset.id); repaint(); } },
          paste: () => pasteSheet(n, repaint),
          csv: () => csvSheet({ nodeId: n.id }),
        });
      },
    });
  }

  function editor(n, m, done) {
    let opts = m ? m.options.slice() : ['', '', '', '']; let correct = m ? m.correct : -1;
    const optsHtml = () => opts.map((o, i) => `<div class="mcq-opt-row"><label class="mcq-radio ${i === correct ? 'on' : ''}" title="Right answer"><input type="radio" name="mcq-c" value="${i}" ${i === correct ? 'checked' : ''} />${L(i)}</label><input class="input" data-i="${i}" value="${U.esc(o)}" placeholder="Option ${L(i)}" />${opts.length > 2 ? `<button class="icon-btn sm" data-act="rm" data-i="${i}" aria-label="Remove option">${U.icon('close')}</button>` : ''}</div>`).join('');
    TI.ui.openSheet({
      title: m ? 'Edit question' : `New question · ${n.title}`,
      html: `<div class="field"><label>Question</label><textarea class="textarea" id="mcq-q" rows="3" placeholder="e.g. Which number is divisible by 3?">${U.esc(m ? m.q : '')}</textarea></div>
        <div class="field"><label>Options – tick the circle of the right answer</label><div id="mcq-opts">${optsHtml()}</div>
          <button class="btn sm ghost" data-act="more" id="mcq-more" ${opts.length >= 6 ? 'hidden' : ''}>${U.icon('add')}Add option</button></div>
        <div class="field"><label>Why (optional – shown after the quiz)</label><textarea class="textarea" id="mcq-why" rows="2">${U.esc(m ? m.why || '' : '')}</textarea></div>
        <div id="mcq-err"></div>`,
      footer: `<button class="btn ghost" data-close>Cancel</button>${m ? '' : '<button class="btn" data-act="saveadd">Save and add another</button>'}<button class="btn primary" data-act="save">Save</button>`,
      onMount(a) {
        const $ = (q) => a.el.querySelector(q);
        const sync = () => { a.el.querySelectorAll('#mcq-opts input.input').forEach((el) => { opts[+el.dataset.i] = el.value; }); const r = a.el.querySelector('input[name="mcq-c"]:checked'); correct = r ? +r.value : -1; };
        const paint = () => { $('#mcq-opts').innerHTML = optsHtml(); $('#mcq-more').hidden = opts.length >= 6; };
        $('#mcq-opts').addEventListener('change', (e) => { if (e.target.name === 'mcq-c') { sync(); paint(); } });
        const save = (again) => {
          sync(); const q = $('#mcq-q').value.trim(); const clean = opts.map((o) => o.trim());
          const filled = clean.map((o, i) => ({ o, i })).filter((x) => x.o);
          let err = '';
          if (!q) err = 'Write the question.'; else if (filled.length < 2) err = 'Add at least 2 options.'; else if (correct < 0 || !clean[correct]) err = 'Tick the circle next to the right answer.';
          if (err) { $('#mcq-err').innerHTML = `<div class="cx-err">${U.icon('error')}<span>${err}</span></div>`; return; }
          const options = filled.map((x) => x.o); const ci = filled.findIndex((x) => x.i === correct);
          const why = $('#mcq-why').value.trim();
          if (m) actions.updateMcq(m.id, { q, options, correct: ci, why }); else actions.addMcqs([{ nodeId: n.id, subjectId: n.subjectId, q, options, correct: ci, why }]);
          if (done) done();
          if (again) { opts = ['', '', '', '']; correct = -1; $('#mcq-q').value = ''; $('#mcq-why').value = ''; $('#mcq-err').innerHTML = ''; paint(); $('#mcq-q').focus(); TI.ui.toast('Saved', { icon: 'check' }); } else a.close();
        };
        TI.forms.onAct(a, {
          more: () => { sync(); if (opts.length < 6) { opts.push(''); paint(); } },
          rm: (el) => { sync(); const i = +el.dataset.i; opts.splice(i, 1); if (correct === i) correct = -1; else if (correct > i) correct--; paint(); },
          save: () => save(false), saveadd: () => save(true),
        });
      },
    });
  }

  function pasteSheet(n, done) {
    let parsed = null;
    TI.ui.openSheet({
      title: `Paste questions · ${n.title}`, size: 'lg',
      html: `<p class="small muted" style="margin-top:0">One question per block, separated by an empty line. Options start with A), B)… Mark the right one with <code>*</code> at the end, or add a line <code>Answer: B</code>. <code>Why:</code> is optional.</p>
        <textarea class="textarea mono" id="mcq-paste" rows="12" placeholder="${U.esc(PASTE_EXAMPLE)}"></textarea><div id="mcq-pres"></div>`,
      footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-act="check" id="mcq-go">Check</button>`,
      onMount(a) {
        const $ = (q) => a.el.querySelector(q); const go = $('#mcq-go');
        $('#mcq-paste').addEventListener('input', () => { parsed = null; go.dataset.act = 'check'; go.textContent = 'Check'; $('#mcq-pres').innerHTML = ''; });
        TI.forms.onAct(a, {
          check() {
            parsed = Q.parsePaste($('#mcq-paste').value);
            $('#mcq-pres').innerHTML = `${parsed.list.length ? `<div class="cx-ok" style="margin-top:10px">${U.icon('check_circle')}<div><b>${U.plural(parsed.list.length, 'question')} ready</b><div class="small muted">${parsed.list.slice(0, 3).map((x) => U.esc(x.q)).join(' · ')}${parsed.list.length > 3 ? ' …' : ''}</div></div></div>` : ''}
              ${parsed.errors.length ? `<div class="cx-err" style="margin-top:10px">${U.icon('error')}<span>${parsed.errors.slice(0, 6).map(U.esc).join('<br>')}${parsed.errors.length > 6 ? `<br>…and ${parsed.errors.length - 6} more` : ''}</span></div>` : ''}`;
            if (parsed.list.length) { go.dataset.act = 'save'; go.textContent = `Add ${U.plural(parsed.list.length, 'question')}`; }
          },
          save() {
            if (!parsed || !parsed.list.length) return;
            actions.addMcqs(parsed.list.map((x) => ({ ...x, nodeId: n.id, subjectId: n.subjectId })));
            a.close(); TI.ui.toast(`${U.plural(parsed.list.length, 'question')} added to “${n.title}”`, { icon: 'quiz' }); if (done) done();
          },
        });
      },
    });
  }

  // ---------- CSV for a topic, a subject or a whole project ----------
  function csvSheet(scope) {
    const leaves = leavesOf(scope);
    const label = scope.nodeId ? (sel.node(scope.nodeId) || {}).title : scope.subjectId ? (sel.subject(scope.subjectId) || {}).name : (sel.project(scope.projectId) || {}).name;
    const have = leaves.reduce((s, n) => s + Q.bank(state, n.id).length, 0);
    TI.ui.openSheet({
      title: `Quiz questions spreadsheet · ${label}`,
      html: `<ol class="cl-steps">
          <li><div class="cl-h">Download the template</div><p class="small muted" style="margin:0 0 8px">One row per question, with your ${U.plural(leaves.length, 'topic')} already filled in${have ? ` and the ${have} existing questions included` : ''}. Columns: Topic, Question, Option A–F, Correct (A–F), Explanation.</p><button class="btn" data-act="tpl">${U.icon('download')}Download CSV</button></li>
          <li><div class="cl-h">Fill it in Excel or Google Sheets</div><p class="small muted" style="margin:0">Copy a topic row for each extra question. Leave unused options empty. Keep the Topic text as it is.</p></li>
          <li><div class="cl-h">Import it</div><p class="small muted" style="margin:0 0 8px">Only new questions are added – rows that match an existing question exactly are skipped.</p><button class="btn primary" data-act="imp">${U.icon('upload_file')}Import CSV</button><div id="csv-res"></div></li>
        </ol>`,
      footer: '<button class="btn" data-close>Close</button>',
      onMount(a) {
        TI.forms.onAct(a, {
          tpl: () => download(`${safeName(label)}-quiz-questions.csv`, Q.csvTemplate(state, leaves)),
          imp() {
            const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,text/csv,text/plain';
            inp.onchange = async () => {
              const f = inp.files && inp.files[0]; if (!f) return;
              const res = Q.importCsv(state, await f.text(), leaves);
              const seen = new Set(state.mcqs.map((m) => `${m.nodeId}|${m.q.trim().toLowerCase()}`));
              const fresh = res.items.filter((x) => { const k = `${x.nodeId}|${x.q.trim().toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; });
              if (fresh.length) actions.addMcqs(fresh);
              const topics = new Set(fresh.map((x) => x.nodeId)).size;
              a.el.querySelector('#csv-res').innerHTML = `<div class="${fresh.length ? 'cx-ok' : 'cx-err'}" style="margin-top:10px">${U.icon(fresh.length ? 'check_circle' : 'info')}<div><b>${fresh.length ? `${U.plural(fresh.length, 'question')} added to ${U.plural(topics, 'topic')}` : 'No new questions found'}</b>${res.items.length - fresh.length ? `<div class="small muted">${res.items.length - fresh.length} already there – skipped</div>` : ''}${res.errors.length ? `<div class="small" style="margin-top:6px">${res.errors.slice(0, 8).map(U.esc).join('<br>')}${res.errors.length > 8 ? `<br>…and ${res.errors.length - 8} more` : ''}</div>` : ''}</div></div>`;
            };
            inp.click();
          },
        });
      },
    });
  }

  TI.mcq = { bankSheet, editor, pasteSheet, csvSheet, PASTE_EXAMPLE };
})(window.TI);
