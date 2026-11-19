// Google Sheet connection UI: connect / disconnect sheets, sync status text and indicators.
(function (TI) {
  const U = TI.util;
  const api = () => TI.api;

  function describe(st) {
    if (!st) return { icon: 'cloud_off', cls: '', text: 'Not connected' };
    const ago = st.lastSync ? U.timeAgo(st.lastSync).toLowerCase() : 'not yet';
    switch (st.state) {
      case 'syncing': return { icon: 'cloud_sync', cls: 'busy', text: 'Syncing…' };
      case 'pending': return { icon: 'cloud_upload', cls: 'busy', text: `${U.plural(st.pending || 1, 'change')} waiting to sync` };
      case 'offline': return { icon: 'cloud_off', cls: 'warn', text: `Offline${st.pending ? ` · ${st.pending} waiting` : ''}`, detail: 'Changes are saved here and sync when you are back online.' };
      case 'error': return { icon: 'sync_problem', cls: 'err', text: `Can't reach your sheet${st.pending ? ` · ${st.pending} waiting` : ''}`, detail: `${st.error || 'Sync failed'} Retrying automatically; your changes are safe in this browser.` };
      case 'synced': return { icon: 'cloud_done', cls: 'ok', text: `Synced ${ago === 'just now' ? 'just now' : ago}` };
      default: return { icon: 'cloud', cls: '', text: st.lastSync ? `Last synced ${ago}` : 'Connected' };
    }
  }

  // Small pill used in the sidebar and phone header
  function indicator(compact = false) {
    if (api().mode() !== 'sheets') return '';
    const d = describe(api().syncStatus());
    const tip = d.detail ? `${d.text}. ${d.detail}` : d.text;
    if (compact) return `<button class="icon-btn sync-dot ${d.cls}" data-act="nav" data-to="/settings" title="${U.esc(tip)}" aria-label="Sync status: ${U.esc(d.text)}" data-sync-indicator="compact">${U.icon(d.icon)}</button>`;
    return `<button class="sync-pill ${d.cls}" data-act="nav" data-to="/settings" title="${U.esc(tip)}" data-sync-indicator="full">${U.icon(d.icon)}<span class="ellipsis">${U.esc(d.text)}</span></button>`;
  }

  // Update indicators in place (no full re-render)
  function paint() {
    const st = api().syncStatus(); const d = describe(st);
    document.querySelectorAll('[data-sync-indicator]').forEach((el) => {
      el.className = el.dataset.syncIndicator === 'compact' ? `icon-btn sync-dot ${d.cls}` : `sync-pill ${d.cls}`;
      el.title = d.detail ? `${d.text}. ${d.detail}` : d.text;
      el.innerHTML = el.dataset.syncIndicator === 'compact' ? U.icon(d.icon) : `${U.icon(d.icon)}<span class="ellipsis">${U.esc(d.text)}</span>`;
    });
    document.querySelectorAll('[data-sync-status]').forEach((el) => { el.innerHTML = `${U.icon(d.icon)}<span>${U.esc(d.text)}${d.detail ? ` – ${U.esc(d.detail)}` : ''}</span>`; el.className = `sync-line ${d.cls}`; });
  }

  // ---------- Connect ----------
  function connectSheet() {
    let tested = null; let creds = null; let choice = null;
    const local = TI.backends.local.snapshot();
    const localCounts = { projects: local.projects.length, sessions: local.sessions.length };
    const draw = () => `
      <ol class="steps small">
        <li>Set up your sheet once with the guide (<a href="backend/SETUP.md" target="_blank" rel="noopener">backend/SETUP.md</a>, about 10 minutes).</li>
        <li>In the sheet, open <b>TrackIt › Connection details</b>.</li>
        <li>Paste the web app URL and secret key here. On another device you can paste a <b>connection code</b> instead.</li>
      </ol>
      <div class="field"><label>Web app URL</label><input class="input" id="cx-url" placeholder="https://script.google.com/macros/s/…/exec" value="${U.esc(creds ? creds.url : '')}" autocomplete="off" spellcheck="false" /></div>
      <div class="field"><label>Secret key</label><input class="input" id="cx-key" type="password" placeholder="40-character key from the sheet" value="${U.esc(creds ? creds.token : '')}" autocomplete="off" spellcheck="false" /></div>
      <details class="cx-code"><summary class="small">I have a connection code</summary>
        <div class="field" style="margin-top:8px"><textarea class="textarea mono" id="cx-code" rows="3" placeholder="TRACKIT1:…"></textarea></div></details>
      <div id="cx-result">${tested ? resultHtml() : ''}</div>`;
    const resultHtml = () => {
      const c = tested.counts || {}; const has = (c.projects || 0) > 0;
      if (!choice) choice = has ? 'remote' : 'empty';
      const opt = (id, title, sub, danger) => `<label class="cx-opt ${choice === id ? 'on' : ''} ${danger ? 'danger' : ''}"><input type="radio" name="cx-choice" value="${id}" ${choice === id ? 'checked' : ''} /><span><b>${title}</b><span>${sub}</span></span></label>`;
      return `<div class="cx-ok">${U.icon('check_circle', 'fill')}<div><b>Found “${U.esc(tested.sheetName || 'your sheet')}”</b>${creds && creds.gh ? `<div class="small muted">Also sets up attachments from ${U.esc(creds.gh.owner)}/${U.esc(creds.gh.repo)}</div>` : ''}<div class="small muted">${has ? `${U.plural(c.projects, 'project')}, ${U.plural(c.sessions || 0, 'session')}, ${U.plural(c.cards || 0, 'card')}` : 'The sheet is empty'}</div></div></div>
        <div class="cx-opts">${has
          ? opt('remote', 'Use the data in my sheet', 'Recommended. What is in this browser now is replaced by the sheet.') + opt('upload', 'Replace the sheet with this browser’s data', `Overwrites the sheet with ${U.plural(localCounts.projects, 'project')} from this browser.`, true)
          : opt('empty', 'Start fresh', 'Begin with an empty TrackIt. Good if this browser only has the demo data.') + opt('upload', 'Upload this browser’s data', `Copies ${U.plural(localCounts.projects, 'project')} and ${U.plural(localCounts.sessions, 'session')} into the sheet.`)}</div>`;
    };
    TI.ui.openSheet({
      title: 'Connect your Google Sheet', html: draw(),
      footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-act="${tested ? 'connect' : 'test'}" id="cx-go">${tested ? 'Connect' : 'Check connection'}</button>`,
      onMount(a) {
        const $ = (q) => a.el.querySelector(q);
        const go = $('#cx-go');
        const readCreds = () => {
          const code = ($('#cx-code') || {}).value || '';
          if (code.trim()) { const d = api().decodeCode(code); if (!d) throw new Error('That connection code is not valid.'); return d; }
          return { url: $('#cx-url').value.trim(), token: $('#cx-key').value.trim() };
        };
        const setBusy = (b, label) => { go.disabled = b; go.textContent = label; };
        a.el.addEventListener('change', (e) => { if (e.target.name === 'cx-choice') { choice = e.target.value; a.el.querySelectorAll('.cx-opt').forEach((l) => l.classList.toggle('on', l.querySelector('input').checked)); } });
        a.el.addEventListener('input', (e) => { if (tested && ['cx-url', 'cx-key', 'cx-code'].includes(e.target.id)) { tested = null; choice = null; $('#cx-result').innerHTML = ''; go.dataset.act = 'test'; go.textContent = 'Check connection'; } });
        TI.forms.onAct(a, {
          async test() {
            let c; try { c = readCreds(); } catch (e) { TI.ui.toast(e.message, { icon: 'error' }); return; }
            setBusy(true, 'Checking…');
            try {
              tested = await api().testConnection(c.url, c.token); creds = c;
              $('#cx-url').value = c.url; $('#cx-key').value = c.token;
              $('#cx-result').innerHTML = resultHtml();
              go.dataset.act = 'connect'; setBusy(false, 'Connect');
            } catch (e) {
              setBusy(false, 'Check connection');
              $('#cx-result').innerHTML = `<div class="cx-err">${U.icon('error')}<span>${U.esc(e.message)}</span></div>`;
            }
          },
          async connect() {
            if (!tested || !creds) return;
            if (choice === 'upload' && (tested.counts.projects || 0) > 0 && !(await TI.ui.confirmDialog('Overwrite your sheet?', 'Everything currently in the sheet will be replaced by this browser’s data.', 'Overwrite', 'danger'))) return;
            setBusy(true, choice === 'upload' ? 'Uploading…' : 'Connecting…');
            try {
              await api().connect({ url: creds.url, token: creds.token, initial: choice });
              if (creds.gh && TI.github) TI.github.save(creds.gh);
              await TI.store.actions.reload();
              a.close(); TI.router.go('/settings', { replace: true });
              TI.ui.toast('Connected – your data now lives in your Google Sheet', { icon: 'cloud_done', duration: 4500 });
            } catch (e) {
              setBusy(false, 'Connect');
              $('#cx-result').insertAdjacentHTML('beforeend', `<div class="cx-err">${U.icon('error')}<span>${U.esc(e.message)}</span></div>`);
            }
          },
        });
      },
    });
  }

  async function disconnect() {
    const st = api().syncStatus();
    const ok = await TI.ui.confirmDialog('Disconnect the Google Sheet?', `TrackIt goes back to storing data only in this browser. A copy of your current data stays here, and the sheet keeps everything.${st && st.pending ? ` ${st.pending} unsynced change(s) will be sent first if possible.` : ''}`, 'Disconnect', 'danger');
    if (!ok) return;
    await api().disconnect({ keepCopy: true });
    await TI.store.actions.reload();
    TI.ui.toast('Disconnected. Data is now stored in this browser only.', { icon: 'cloud_off' });
  }

  async function copyCode() {
    const ok = await U.copy(api().connectionCode());
    TI.ui.toast(ok ? 'Connection code copied – paste it on your other device. Keep it private.' : 'Could not copy', { icon: ok ? 'content_copy' : 'error', duration: 5000 });
  }

  async function syncNow() {
    try { await api().syncNow(); TI.ui.toast('Up to date', { icon: 'cloud_done' }); } catch (e) { TI.ui.toast(e.message, { icon: 'sync_problem', duration: 5000 }); }
  }

  TI.sync = { describe, indicator, paint, connectSheet, disconnect, copyCode, syncNow };
})(window.TI);
