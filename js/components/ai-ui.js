// AI windows: generate interview questions for a topic, plus the "AI not set up" helper.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;

  function setupHelp(st) {
    if (st.noSheet) return 'AI runs through your Google Sheet so your key stays private. Connect the sheet first: Settings › Google Sheet backend.';
    if (st.oldScript) return 'Your sheet script is too old for AI. Update backend/Code.gs to version 4 (backend/SETUP.md › Updating) and deploy a new version.';
    return 'In your Google Sheet open TrackIt › Set Gemini API key (free key from aistudio.google.com/apikey), then Deploy › Manage deployments › ✏️ › New version. Details: Settings › AI.';
  }
  async function ensureReady(onClaude) {
    const st = await TI.ai.status(true);
    if (st.configured) return true;
    TI.ui.dialog({ title: 'AI is not set up yet', html: `<p>${U.esc(setupHelp(st))}</p>${onClaude ? '<p class="muted">Or use your Claude chat for this one – copy a prompt, paste the answer back.</p>' : ''}`,
      buttons: [{ label: 'Open Settings', value: () => { TI.router.go('/settings?focus=ai'); return true; } }, ...(onClaude ? [{ label: 'Do it in Claude', value: () => { setTimeout(onClaude, 50); return true; } }] : []), { label: 'OK', kind: 'primary', primary: true, value: () => true }] });
    return false;
  }

  // Generate → review → save interview questions for a topic
  function questionsSheet(nodeId, { then } = {}) {
    const n = sel.node(nodeId); if (!n) return;
    const c = TI.ai.cfg(); const pdfs = TI.ai.pdfsOf(n); const have = TI.ai.topicCards(n).length;
    let level = c.level; let count = c.count; let results = null; let busy = false;
    const canPdf = pdfs.length > 0 && TI.github.configured();
    const html = `
      <p class="muted" style="margin-top:0">Questions an interviewer would ask on <b>${U.esc(n.title)}</b>, each with a model answer. They're saved as this topic's interview cards${have ? ` (it has ${have} already – new ones won't repeat them)` : ''}.</p>
      <div class="field-row">
        <div class="field"><label>Level</label><div class="seg" id="aq-level">${Object.keys(TI.ai.LEVEL_NAMES).map((k) => `<button data-v="${k}" class="${k === level ? 'on' : ''}">${TI.ai.LEVEL_NAMES[k]}</button>`).join('')}</div></div>
        <div class="field"><label>How many</label><div class="seg" id="aq-count">${[5, 8, 10, 15].map((k) => `<button data-v="${k}" class="${k === count ? 'on' : ''}">${k}</button>`).join('')}</div></div>
      </div>
      ${pdfs.length ? `<label class="check-row"><input type="checkbox" id="aq-pdf" ${canPdf ? 'checked' : 'disabled'} /> <span>Use my PDF notes (${U.plural(pdfs.length, 'file')})${canPdf ? '' : ' – connect GitHub in Settings to use them'}</span></label>` : ''}
      <div class="field"><label>Anything to focus on? (optional)</label><input class="input" id="aq-extra" placeholder="e.g. governor limits, real project scenarios, Salesforce architect interviews" /></div>
      <div id="aq-status" class="small muted"></div>
      <div id="aq-results"></div>`;
    TI.ui.openSheet({
      title: `Interview questions · ${n.title}`, html, size: 'lg',
      footer: `<button class="btn ghost" data-close>Close</button><button class="btn primary" data-act="go" id="aq-go">${U.icon('auto_awesome')}Generate</button>`,
      onMount(a) {
        const $ = (q) => a.el.querySelector(q);
        const segs = (id, set) => $(id).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $(id).querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); set(b.dataset.v); });
        segs('#aq-level', (v) => { level = v; }); segs('#aq-count', (v) => { count = +v; });
        const go = $('#aq-go');
        const paint = () => {
          if (!results) return;
          const on = results.filter((r) => r.on).length;
          $('#aq-results').innerHTML = `<div class="aq-list">${results.map((r, i) => `<label class="aq-item ${r.on ? '' : 'off'}"><input type="checkbox" data-i="${i}" ${r.on ? 'checked' : ''} /><div><div class="aq-q">${U.esc(r.front)}</div><div class="aq-a">${U.esc(r.back).replace(/\n/g, '<br>')}</div></div></label>`).join('')}</div>`;
          go.dataset.act = 'save'; go.innerHTML = `${U.icon('save')}Save ${U.plural(on, 'card')}`; go.disabled = !on;
          a.el.querySelector('.sheet-foot') && !a.el.querySelector('[data-act="again"]') && go.insertAdjacentHTML('beforebegin', `<button class="btn ghost" data-act="again">${U.icon('refresh')}Regenerate</button>`);
        };
        $('#aq-results').addEventListener('change', (e) => { const cb = e.target.closest('input[data-i]'); if (!cb) return; results[+cb.dataset.i].on = cb.checked; paint(); });
        const run = async () => {
          if (busy) return;
          if (!(await ensureReady(() => { a.close(); claudeQuestionsSheet(n.id, { count, level, extra: $('#aq-extra').value.trim(), then }); }))) return;
          busy = true; go.disabled = true; go.innerHTML = `${U.icon('hourglass_top')}Generating…`; $('#aq-results').innerHTML = '';
          const note = (t) => { $('#aq-status').textContent = t; };
          try {
            const list = await TI.ai.generateQuestions(n, { count, level, usePdf: !!($('#aq-pdf') && $('#aq-pdf').checked), extra: $('#aq-extra').value.trim(), onNote: note });
            results = list.map((r) => ({ ...r, on: true })); note(`${U.plural(list.length, 'question')} – untick any you don't want, then save.`);
            if (level !== c.level) actions.updateSettings({ aiLevel: level });
          } catch (e) {
            note(''); $('#aq-results').innerHTML = `<div class="cx-err">${U.icon('error')}<span>${U.esc(TI.ai.friendly(e))}</span></div>
              <button class="btn claude-btn" data-act="claude" style="margin-top:10px">${U.icon('auto_awesome')}Do it in Claude instead</button>`;
            go.dataset.act = 'go'; go.innerHTML = `${U.icon('auto_awesome')}Try again`;
          } finally { busy = false; go.disabled = false; paint(); }
        };
        TI.forms.onAct(a, {
          go: run,
          again: () => { results = null; run(); },
          claude: () => { a.close(); claudeQuestionsSheet(n.id, { count, level, extra: $('#aq-extra').value.trim(), then }); },
          save() {
            const list = (results || []).filter((r) => r.on); if (!list.length) return;
            TI.ai.saveQuestions(n, list); a.close();
            TI.ui.toast(`${U.plural(list.length, 'interview card')} saved to “${n.title}”`, { icon: 'style', action: { label: 'View', fn: () => TI.router.go(`/cards/${n.subjectId}`) } });
            if (then) then();
          },
        });
      },
    });
  }

  // ---------- Do it in Claude instead ----------
  const CLAUDE_URL = 'https://claude.ai/new';
  async function downloadPdf(a) {
    try {
      const blob = await TI.github.download(a); const url = URL.createObjectURL(blob);
      const el = document.createElement('a'); el.href = url; el.download = a.name || 'notes.pdf'; document.body.appendChild(el); el.click(); el.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { TI.ui.toast(`Couldn't download ${a.name}: ${e.message}`, { icon: 'error' }); }
  }
  // Shared "copy prompt → open Claude" steps
  function claudeSteps(prompt, { pdfs = [], tip = '' } = {}) {
    return `<ol class="cl-steps">
      <li><div class="cl-h">Copy the prompt</div><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="copy">${U.icon('content_copy')}Copy prompt</button><details class="cl-peek"><summary class="small muted">See it</summary><textarea class="textarea mono" rows="6" readonly>${U.esc(prompt)}</textarea></details></div></li>
      <li><div class="cl-h">Paste it into Claude</div><div class="row" style="gap:8px;flex-wrap:wrap"><a class="btn" href="${CLAUDE_URL}" target="_blank" rel="noopener">${U.icon('open_in_new')}Open Claude</a><span class="small muted">${tip || 'A new chat, any model.'}</span></div>
        ${pdfs.length ? `<div class="small muted" style="margin-top:8px">Want Claude to use your PDF notes? Download and attach them in Claude:</div><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px">${pdfs.map((a, i) => `<button class="btn sm ghost" data-act="pdf" data-i="${i}">${U.icon('download')}${U.esc(a.name)}</button>`).join('')}</div>` : ''}</li>
      <li><div class="cl-h">Paste Claude's reply here</div><textarea class="textarea" id="cl-reply" rows="5" placeholder="Paste Claude's whole reply – TrackIt finds the JSON block in it"></textarea><div id="cl-err"></div></li>
    </ol>`;
  }
  const copyPrompt = async (prompt) => { const ok = await U.copy(prompt); TI.ui.toast(ok ? 'Prompt copied – paste it into Claude' : 'Could not copy – use “See it” and copy by hand', { icon: ok ? 'content_copy' : 'error' }); };

  function claudeQuestionsSheet(nodeId, opts = {}) {
    const n = sel.node(nodeId); if (!n) return;
    const prompt = TI.ai.claudeQuestionsPrompt(n, opts); const pdfs = TI.github.configured() ? TI.ai.pdfsOf(n) : [];
    let results = null;
    TI.ui.openSheet({
      title: `Interview questions in Claude · ${n.title}`, size: 'lg',
      html: `<p class="muted" style="margin-top:0">Use your Claude chat to write the questions, then bring them back here. Nothing extra to pay with your Claude plan.</p>${claudeSteps(prompt, { pdfs })}<div id="cl-results"></div>`,
      footer: `<button class="btn ghost" data-close>Close</button><button class="btn primary" data-act="read" id="cl-go">${U.icon('input')}Read reply</button>`,
      onMount(a) {
        const $ = (q) => a.el.querySelector(q); const go = $('#cl-go');
        const paint = () => {
          if (!results) return;
          const on = results.filter((r) => r.on).length;
          $('#cl-results').innerHTML = `<div class="aq-list">${results.map((r, i) => `<label class="aq-item ${r.on ? '' : 'off'}"><input type="checkbox" data-i="${i}" ${r.on ? 'checked' : ''} /><div><div class="aq-q">${U.esc(r.front)}</div><div class="aq-a">${U.esc(r.back).replace(/\n/g, '<br>')}</div></div></label>`).join('')}</div>`;
          go.dataset.act = 'save'; go.innerHTML = `${U.icon('save')}Save ${U.plural(on, 'card')}`; go.disabled = !on;
        };
        $('#cl-results').addEventListener('change', (e) => { const cb = e.target.closest('input[data-i]'); if (!cb) return; results[+cb.dataset.i].on = cb.checked; paint(); });
        $('#cl-reply').addEventListener('input', () => { if (results) { results = null; $('#cl-results').innerHTML = ''; go.dataset.act = 'read'; go.innerHTML = `${U.icon('input')}Read reply`; go.disabled = false; } });
        TI.forms.onAct(a, {
          copy: () => copyPrompt(prompt),
          pdf: (el) => downloadPdf(pdfs[+el.dataset.i]),
          read() {
            $('#cl-err').innerHTML = '';
            try { results = TI.ai.parseClaudeQuestions($('#cl-reply').value).map((r) => ({ ...r, on: true })); paint(); $('#cl-results').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
            catch (e) { $('#cl-err').innerHTML = `<div class="cx-err" style="margin-top:8px">${U.icon('error')}<span>${U.esc(e.message)}</span></div>`; }
          },
          save() {
            const list = (results || []).filter((r) => r.on); if (!list.length) return;
            TI.ai.saveQuestions(n, list); a.close();
            TI.ui.toast(`${U.plural(list.length, 'interview card')} saved to “${n.title}”`, { icon: 'style', action: { label: 'View', fn: () => TI.router.go(`/cards/${n.subjectId}`) } });
            if (opts.then) opts.then();
          },
        });
      },
    });
  }

  async function mockInterview(nodeId) {
    if (!(await ensureReady(() => TI.router.go(`/interview/${nodeId}?claude=1`)))) return;
    TI.router.go(`/interview/${nodeId}`);
  }

  TI.aiui = { questionsSheet, mockInterview, ensureReady, setupHelp, claudeQuestionsSheet, claudeSteps, copyPrompt, downloadPdf };
})(window.TI);
