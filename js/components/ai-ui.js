// AI windows: generate interview questions for a topic, plus the "AI not set up" helper.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;

  function setupHelp(st) {
    if (st.noSheet) return 'AI runs through your Google Sheet so your key stays private. Connect the sheet first: Settings › Google Sheet backend.';
    if (st.oldScript) return 'Your sheet script is too old for AI. Update backend/Code.gs to version 4 (backend/SETUP.md › Updating) and deploy a new version.';
    return 'In your Google Sheet open TrackIt › Set Gemini API key (free key from aistudio.google.com/apikey), then Deploy › Manage deployments › ✏️ › New version. Details: Settings › AI.';
  }
  async function ensureReady() {
    const st = await TI.ai.status(true);
    if (st.configured) return true;
    TI.ui.dialog({ title: 'AI is not set up yet', html: `<p>${U.esc(setupHelp(st))}</p>`, buttons: [{ label: 'Open Settings', value: () => { TI.router.go('/settings?focus=ai'); return true; } }, { label: 'OK', kind: 'primary', primary: true, value: () => true }] });
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
          if (!(await ensureReady())) return;
          busy = true; go.disabled = true; go.innerHTML = `${U.icon('hourglass_top')}Generating…`; $('#aq-results').innerHTML = '';
          const note = (t) => { $('#aq-status').textContent = t; };
          try {
            const list = await TI.ai.generateQuestions(n, { count, level, usePdf: !!($('#aq-pdf') && $('#aq-pdf').checked), extra: $('#aq-extra').value.trim(), onNote: note });
            results = list.map((r) => ({ ...r, on: true })); note(`${U.plural(list.length, 'question')} – untick any you don't want, then save.`);
            if (level !== c.level) actions.updateSettings({ aiLevel: level });
          } catch (e) {
            note(''); $('#aq-results').innerHTML = `<div class="cx-err">${U.icon('error')}<span>${U.esc(TI.ai.friendly(e))}</span></div>`;
            go.dataset.act = 'go'; go.innerHTML = `${U.icon('auto_awesome')}Try again`;
          } finally { busy = false; go.disabled = false; paint(); }
        };
        TI.forms.onAct(a, {
          go: run,
          again: () => { results = null; run(); },
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

  async function mockInterview(nodeId) {
    if (!(await ensureReady())) return;
    TI.router.go(`/interview/${nodeId}`);
  }

  TI.aiui = { questionsSheet, mockInterview, ensureReady, setupHelp };
})(window.TI);
