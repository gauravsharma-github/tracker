// Attachments on subjects, units and topics: PDF notes and audio, stored in your GitHub repo.
// Also the small note / PDF / audio indicators shown next to every subject and topic name.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  const GH = () => TI.github;
  const fmtSize = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(b >= 10 * 1024 * 1024 ? 0 : 1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const fmtLen = (sec) => (sec ? (sec >= 3600 ? `${Math.floor(sec / 3600)}:${U.pad(Math.floor((sec % 3600) / 60))}:${U.pad(Math.floor(sec % 60))}` : `${Math.floor(sec / 60)}:${U.pad(Math.floor(sec % 60))}`) : '');

  function targetInfo(subjectId, nodeId) {
    const s = sel.subject(subjectId); const p = s ? sel.project(s.projectId) : null;
    const path = nodeId ? TI.stats.pathOf(state, nodeId) : [];
    return { s, p, path, title: nodeId ? (path[path.length - 1] || {}).title || '' : s ? s.name : '', crumbs: [s ? s.name : '', ...path.map((n) => n.title)].filter(Boolean) };
  }

  // ---------- Indicators next to names ----------
  function iconsHtml(subjectId, nodeId = null) {
    const notes = sel.notesOn(subjectId, nodeId).length;
    const pdfs = sel.attachmentsOn(subjectId, nodeId, 'pdf').length;
    const audio = sel.attachmentsOn(subjectId, nodeId, 'audio').length;
    const ds = `data-subject="${subjectId}" data-node="${nodeId || ''}"`;
    const b = (act, icon, n, label, extra = '') => `<button class="row-ic ${extra}" data-act="${act}" ${ds} ${extra ? `data-kind="${extra}"` : ''} title="${label}" aria-label="${label}">${U.icon(icon, 'fill')}${n > 1 ? `<i>${n}</i>` : ''}</button>`;
    return `${notes ? b('open-notes', 'sticky_note_2', notes, `${U.plural(notes, 'note')} – open`) : ''}${pdfs ? b('open-files', 'picture_as_pdf', pdfs, `${U.plural(pdfs, 'PDF')} – open`, 'pdf') : ''}${audio ? b('open-files', 'headphones', audio, `${U.plural(audio, 'recording')} – play`, 'audio') : ''}`;
  }

  // ---------- Open ----------
  function viewerUrl(id) { return `${location.href.split('#')[0]}#/view/${id}`; }
  // (no 'noopener' feature: with it window.open returns null and we could not detect a blocked pop-up)
  function openViewer(id) { const w = window.open(viewerUrl(id), '_blank'); if (w) { try { w.opener = null; } catch (e) { /* ignore */ } } else TI.router.go('/view/' + id); }

  function openNotes(anchor, subjectId, nodeId) {
    const list = sel.notesOn(subjectId, nodeId);
    if (list.length === 1) { TI.screens.notes.edit(list[0].id); return; }
    const t = targetInfo(subjectId, nodeId);
    TI.ui.openMenu(anchor, [{ heading: `Notes · ${U.truncate(t.title, 30)}` },
      ...list.map((n) => ({ icon: n.pinned ? 'push_pin' : 'sticky_note_2', label: n.title || U.truncate(n.body, 40) || 'Untitled', trail: U.fmtDate(n.updatedAt), onClick: () => TI.screens.notes.edit(n.id) })),
      { sep: true },
      { icon: 'add', label: 'New note here', onClick: () => TI.screens.notes.edit(null, { subjectId, nodeId, title: '' }) },
      { icon: 'view_agenda', label: 'Show on Notes page', onClick: () => TI.router.go(`/notes/${subjectId}${nodeId ? `?node=${nodeId}` : ''}`) },
    ]);
  }

  function openFiles(anchor, subjectId, nodeId, kind) {
    const list = sel.attachmentsOn(subjectId, nodeId, kind);
    if (list.length === 1) { openViewer(list[0].id); return; }
    TI.ui.openMenu(anchor, [{ heading: kind === 'pdf' ? 'PDF notes' : 'Audio' },
      ...list.map((a) => ({ icon: kind === 'pdf' ? 'picture_as_pdf' : 'headphones', label: a.name, trail: a.kind === 'audio' && a.duration ? fmtLen(a.duration) : fmtSize(a.size), onClick: () => openViewer(a.id) })),
      { sep: true },
      { icon: 'attach_file', label: 'Manage attachments', onClick: () => manage(subjectId, nodeId) },
    ]);
  }

  // ---------- Preconditions ----------
  async function ready() {
    if (TI.api.mode() === 'sheets' && TI.api.backendVersion() < 2) {
      // The saved version may be stale (script updated since the last pull): ask the sheet again first
      let err = '';
      try { await TI.api.syncNow(); } catch (e) { err = e.message; }
      if (TI.api.backendVersion() < 2) {
        const c = TI.api.connection() || {};
        await TI.ui.dialog({
          title: err ? 'Could not check your sheet script' : 'Your sheet still runs the old script',
          html: err ? `<p>${U.esc(err)}</p><p>Attachments need version 2 of backend/Code.gs. Try again when the sheet is reachable.</p>`
            : `<p>TrackIt just asked your web app and it answered <b>version ${TI.api.backendVersion()}</b>. Attachments need version 2. This usually means the new code was saved but not deployed:</p>
              <ol class="steps small">
                <li>In Apps Script check that <code>Code.gs</code> starts with <code>var BACKEND_VERSION = 2;</code> near the top, and press <b>Save</b>.</li>
                <li><b>Deploy › Manage deployments</b> → select your existing web app → <b>✏️ Edit</b> → <b>Version: New version</b> → <b>Deploy</b>. (Saving alone doesn't change what the web app serves.)</li>
                <li>If you used <b>New deployment</b> instead, it has a different URL. Either edit the old deployment as above, or reconnect TrackIt with the new URL.</li>
              </ol>
              <p class="tiny faint">TrackIt is connected to: <span class="mono" style="word-break:break-all">${U.esc(c.url || '')}</span></p>`,
          buttons: [{ label: 'OK', kind: 'primary', primary: true, value: () => true }],
        });
        return false;
      }
    }
    if (!GH().configured()) {
      const go = await TI.ui.confirmDialog('Connect your GitHub repo first', 'Attachments are stored in a private GitHub repository you own. Set it up once in Settings › Attachments (about 5 minutes).', 'Set up now', 'primary');
      if (go) { TI.router.go('/settings?focus=github'); setTimeout(setupGithub, 250); }
      return false;
    }
    return true;
  }

  // ---------- Upload ----------
  function audioDuration(file) {
    return new Promise((resolve) => {
      const a = document.createElement('audio'); const url = URL.createObjectURL(file); let done = false;
      const finish = (v) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(v && isFinite(v) ? Math.round(v) : null); };
      a.preload = 'metadata'; a.onloadedmetadata = () => finish(a.duration); a.onerror = () => finish(null); setTimeout(() => finish(null), 5000);
      a.src = url;
    });
  }

  async function pick(subjectId, nodeId = null) {
    if (!(await ready())) return;
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true;
    input.accept = '.pdf,application/pdf,audio/*,.m4a,.aac,.mp3,.wav,.ogg,.opus,.webm,.flac,.caf,.aiff,.amr';
    input.style.display = 'none'; document.body.appendChild(input); // Safari needs it in the page
    input.onchange = () => { const list = Array.from(input.files || []); input.remove(); if (list.length) uploadFiles(subjectId, nodeId, list); };
    setTimeout(() => input.remove(), 10 * 60 * 1000);
    input.click();
  }

  async function uploadFiles(subjectId, nodeId, files) {
    const t = targetInfo(subjectId, nodeId); if (!t.s) return;
    const L = GH().LIMITS; const c = GH().cfg();
    const jobs = files.map((f) => {
      const kind = GH().kindOf(f); const mime = GH().mimeOf(f.name, f.type);
      let error = '';
      if (!kind) error = 'Only PDF and audio files can be attached.';
      else if (kind === 'pdf' && f.size > L.pdf) error = `PDF is ${fmtSize(f.size)} – the limit is 25 MB.`;
      else if (kind === 'audio' && f.size > L.audio) error = `Audio is ${fmtSize(f.size)} – GitHub's limit is about 95 MB. Export it at a lower quality (e.g. Voice Memos › Compressed).`;
      const warn = kind === 'audio' && !GH().playable(mime) ? `This browser may not play .${GH().extOf(f.name)} files.` : '';
      return { f, kind, mime, error, warn, status: error ? 'error' : 'waiting', progress: 0 };
    });
    const draw = () => `<div class="up-list">${jobs.map((j, i) => `<div class="up-row ${j.status}">
        ${U.icon(j.kind === 'pdf' ? 'picture_as_pdf' : j.kind === 'audio' ? 'headphones' : 'block')}
        <div class="grow" style="min-width:0"><div class="ellipsis"><b>${U.esc(j.f.name)}</b></div>
          <div class="small muted">${fmtSize(j.f.size)}${j.status === 'uploading' ? ` · uploading ${Math.round(j.progress * 100)}%` : j.status === 'done' ? ' · attached' : j.status === 'waiting' ? ' · waiting' : ''}${j.warn ? ` · ${U.esc(j.warn)}` : ''}</div>
          ${j.status === 'uploading' ? `<div class="bar thin" style="margin-top:6px"><i style="width:${(j.progress * 100).toFixed(0)}%"></i></div>` : ''}
          ${j.error ? `<div class="small" style="color:var(--danger);margin-top:2px">${U.esc(j.error)}</div>` : ''}</div>
        ${j.status === 'done' ? U.icon('check_circle', 'fill ok-ic') : j.status === 'failed' ? `<button class="btn sm" data-act="retry" data-i="${i}">Retry</button>` : ''}
      </div>`).join('')}</div>
      <div class="small faint" style="margin-top:12px">Saved to <b>${U.esc(GH().repoName())}</b> as <code>${U.esc(t.p ? t.p.name : '')} / ${U.esc(t.crumbs.join(' / '))}</code></div>`;
    let running = false;
    const api = TI.ui.openSheet({
      title: `Attach to “${U.truncate(t.title, 34)}”`, html: draw(), dismissible: true,
      footer: '<button class="btn primary" data-close>Done</button>',
      onMount(a) { TI.forms.onAct(a, { retry(el) { const j = jobs[+el.dataset.i]; j.status = 'waiting'; j.error = ''; run(); } }); },
    });
    const paint = () => { if (api.body) api.setBody(draw()); };
    async function run() {
      if (running) return; running = true;
      for (const j of jobs) {
        if (j.status !== 'waiting') continue;
        j.status = 'uploading'; j.progress = 0; paint();
        try {
          const taken = state.attachments.map((x) => x.path).concat(jobs.filter((x) => x.path).map((x) => x.path));
          j.path = GH().pathFor({ projectName: t.p ? t.p.name : 'TrackIt', subjectName: t.s.name, nodePath: t.path.map((n) => n.title), kind: j.kind, ext: GH().extOf(j.f.name) || (j.kind === 'pdf' ? 'pdf' : 'm4a'), taken });
          const duration = j.kind === 'audio' ? await audioDuration(j.f) : null;
          let last = 0;
          const r = await GH().upload(j.f, j.path, { onProgress: (p) => { j.progress = p; if (p - last > 0.02 || p === 1) { last = p; paint(); } } });
          actions.addAttachment({ projectId: t.s.projectId, subjectId, nodeId: nodeId || null, kind: j.kind, name: j.f.name, path: r.path, repo: `${c.owner}/${c.repo}`, branch: c.branch || null, sha: r.sha, size: j.f.size, mime: j.mime, duration });
          j.status = 'done';
        } catch (e) { j.status = 'failed'; j.error = e.message; }
        paint();
      }
      running = false;
      const ok = jobs.filter((x) => x.status === 'done').length;
      if (ok && jobs.every((x) => x.status === 'done' || x.status === 'error')) { TI.ui.toast(`${U.plural(ok, 'file')} attached`, { icon: 'attach_file' }); setTimeout(() => api.close(), 700); }
    }
    run();
  }

  // ---------- Manage ----------
  function manage(subjectId, nodeId = null) {
    const t = targetInfo(subjectId, nodeId);
    const draw = () => {
      const pdfs = sel.attachmentsOn(subjectId, nodeId, 'pdf'); const audio = sel.attachmentsOn(subjectId, nodeId, 'audio');
      const row = (a) => `<div class="list-item att-row">
        <span class="lead" style="--c:${a.kind === 'pdf' ? '#E75B5C' : '#405FFF'}">${U.icon(a.kind === 'pdf' ? 'picture_as_pdf' : 'headphones', 'fill')}</span>
        <div class="txt click" data-act="open" data-id="${a.id}" style="cursor:pointer"><div class="ttl">${U.esc(a.name)}</div><div class="sub">${fmtSize(a.size)}${a.duration ? ` · ${fmtLen(a.duration)}` : ''} · ${U.fmtDate(a.createdAt, { year: true })}</div></div>
        <button class="icon-btn sm" data-act="open" data-id="${a.id}" title="Open in a new tab" aria-label="Open">${U.icon('open_in_new')}</button>
        <button class="icon-btn sm muted" data-act="rename" data-id="${a.id}" title="Rename" aria-label="Rename">${U.icon('edit')}</button>
        <button class="icon-btn sm muted" data-act="del" data-id="${a.id}" title="Delete" aria-label="Delete">${U.icon('delete')}</button></div>`;
      return `<div class="small muted" style="margin-bottom:10px">${U.esc(t.crumbs.join(' › '))}</div>
        <div class="drop-zone" data-act="add">${U.icon('upload_file')}<div><b>Add PDF or audio</b><span>Click to choose, or drop files here · PDF up to 25 MB · audio up to about 1 hour (95 MB)</span></div></div>
        ${pdfs.length ? `<div class="set-group-title" style="margin-top:16px">PDF notes (${pdfs.length})</div><div class="list">${pdfs.map(row).join('')}</div>` : ''}
        ${audio.length ? `<div class="set-group-title" style="margin-top:16px">Audio (${audio.length})</div><div class="list">${audio.map(row).join('')}</div>` : ''}
        ${!pdfs.length && !audio.length ? '<div class="tree-empty">Nothing attached yet.</div>' : ''}`;
    };
    const unsub = TI.store.subscribe(() => { if (api.body) api.setBody(draw()); });
    const api = TI.ui.openSheet({
      title: `Attachments · ${U.truncate(t.title, 30)}`, html: draw(), size: 'lg', onClose: () => unsub(),
      onMount(a) {
        a.el.addEventListener('dragover', (e) => { e.preventDefault(); a.el.classList.add('dragging'); });
        a.el.addEventListener('dragleave', (e) => { if (e.target === a.el) a.el.classList.remove('dragging'); });
        a.el.addEventListener('drop', async (e) => { e.preventDefault(); a.el.classList.remove('dragging'); const files = Array.from(e.dataTransfer.files || []); if (files.length && (await ready())) uploadFiles(subjectId, nodeId, files); });
        TI.forms.onAct(a, {
          add() { pick(subjectId, nodeId); },
          open(el) { openViewer(el.dataset.id); },
          async rename(el) { const at = sel.attachment(el.dataset.id); const v = await TI.ui.promptDialog({ title: 'Rename', label: 'Name shown in TrackIt (the file in GitHub keeps its name)', value: at.name }); if (v && v.trim()) actions.updateAttachment(at.id, { name: v.trim() }); },
          async del(el) { await removeAttachment(el.dataset.id); },
        });
      },
    });
  }

  async function removeAttachment(id) {
    const at = sel.attachment(id); if (!at) return;
    if (!(await TI.ui.confirmDialog(`Delete “${at.name}”?`, 'It is removed from TrackIt and deleted from your GitHub repository.'))) return;
    try { if (GH().configured()) await GH().remove(at); actions.deleteAttachment(id); TI.ui.toast('Attachment deleted', { icon: 'delete' }); } catch (e) {
      if (await TI.ui.confirmDialog('Could not delete the file on GitHub', `${e.message} Remove it from TrackIt anyway? (The file stays in the repo.)`, 'Remove from TrackIt', 'danger')) actions.deleteAttachment(id);
    }
  }

  const countOn = (subjectId, nodeId) => sel.attachmentsOn(subjectId, nodeId).length;

  // ---------- GitHub repository set-up (Settings › Attachments) ----------
  function setupGithub() {
    const cur = GH().cfg() || {};
    let tested = null;
    const html = `
      <ol class="steps small">
        <li>On GitHub create a <b>private</b> repository, e.g. <code>trackit-files</code> (tick <i>Add a README</i>). Private repositories are free.</li>
        <li>Create a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">fine-grained token</a>: <i>Repository access › Only select repositories</i> → that repo, <i>Permissions › Contents › Read and write</i>. Pick an expiry you are happy with (you can renew it later).</li>
        <li>Paste the details below. The token is saved only in this browser.</li>
      </ol>
      <div class="field-row">
        <div class="field"><label>Owner (your GitHub username)</label><input class="input" id="gh-owner" value="${U.esc(cur.owner || '')}" placeholder="gaurav" autocomplete="off" spellcheck="false" /></div>
        <div class="field"><label>Repository</label><input class="input" id="gh-repo" value="${U.esc(cur.repo || '')}" placeholder="trackit-files or full URL" autocomplete="off" spellcheck="false" /></div>
      </div>
      <div class="field"><label>Access token</label><input class="input" id="gh-token" type="password" value="${U.esc(cur.token || '')}" placeholder="github_pat_…" autocomplete="off" spellcheck="false" /></div>
      <details class="cx-code"><summary class="small">Advanced</summary>
        <div class="field" style="margin-top:8px"><label>Branch (optional)</label><input class="input" id="gh-branch" value="${U.esc(cur.branch && cur.branch !== 'main' ? cur.branch : '')}" placeholder="default branch" autocomplete="off" spellcheck="false" /></div></details>
      <div id="gh-result"></div>`;
    TI.ui.openSheet({
      title: 'Attachments · GitHub repository', html,
      footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-act="test" id="gh-go">Check repository</button>`,
      onMount(a) {
        const $ = (q) => a.el.querySelector(q);
        const go = $('#gh-go');
        const read = () => {
          let owner = $('#gh-owner').value.trim().replace(/^@/, ''); let repo = $('#gh-repo').value.trim();
          const m = repo.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i) || (repo.includes('/') && !/\s/.test(repo) ? [null, ...repo.split('/')] : null);
          if (m) { owner = m[1]; repo = m[2]; }
          repo = repo.replace(/\.git$/i, '');
          return { owner, repo, token: $('#gh-token').value.trim(), branch: $('#gh-branch').value.trim() };
        };
        const reset = () => { if (!tested) return; tested = null; $('#gh-result').innerHTML = ''; go.dataset.act = 'test'; go.textContent = 'Check repository'; };
        a.el.addEventListener('input', reset);
        TI.forms.onAct(a, {
          async test() {
            const c = read();
            go.disabled = true; go.textContent = 'Checking…';
            try {
              const r = await GH().test({ ...c, apiBase: cur.apiBase });
              $('#gh-owner').value = c.owner; $('#gh-repo').value = c.repo;
              if (!r.private) {
                $('#gh-result').innerHTML = `<div class="cx-err">${U.icon('public')}<span><b>${U.esc(r.fullName)} is public.</b> Anyone could see your files. Make it private on GitHub (Settings › General › Danger zone › Change visibility) and check again.</span></div>`;
                go.disabled = false; go.textContent = 'Check again'; return;
              }
              tested = { ...c, branch: r.branch, empty: r.empty, apiBase: cur.apiBase };
              $('#gh-result').innerHTML = `<div class="cx-ok">${U.icon('lock', 'fill')}<div><b>Private repository ${U.esc(r.fullName)}</b><div class="small muted">Branch ${U.esc(r.branch)}${r.empty ? ' · empty – the first upload creates it' : ''} · token can write ✓</div></div></div>`;
              go.dataset.act = 'save'; go.disabled = false; go.textContent = 'Save';
            } catch (e) {
              go.disabled = false; go.textContent = 'Check repository';
              $('#gh-result').innerHTML = `<div class="cx-err">${U.icon('error')}<span>${U.esc(e.message)}</span></div>`;
            }
          },
          save() {
            if (!tested) return;
            const c = { owner: tested.owner, repo: tested.repo, token: tested.token, branch: tested.branch, empty: tested.empty };
            if (tested.apiBase) c.apiBase = tested.apiBase;
            GH().save(c); a.close(); TI.store.bump();
            TI.ui.toast(TI.api.mode() === 'sheets' ? 'Attachments ready. New connection codes include these settings.' : 'Attachments ready – attach PDFs and audio from any subject or topic menu', { icon: 'cloud_done', duration: 4500 });
          },
        });
      },
    });
  }

  async function disconnectGithub() {
    if (!(await TI.ui.confirmDialog('Disconnect GitHub on this device?', 'The token is removed from this browser. Your files stay in the repository and stay attached in TrackIt; connect again to open them.', 'Disconnect', 'danger'))) return;
    GH().clear(); TI.store.bump();
    TI.ui.toast('GitHub disconnected on this device', { icon: 'link_off' });
  }

  // Global click handlers (wired in main.js)
  const handlers = {
    'open-notes': (el) => openNotes(el, el.dataset.subject, el.dataset.node || null),
    'open-files': (el) => openFiles(el, el.dataset.subject, el.dataset.node || null, el.dataset.kind),
    'attach-pick': (el) => pick(el.dataset.subject, el.dataset.node || null),
    'attach-manage': (el) => manage(el.dataset.subject, el.dataset.node || null),
  };

  TI.attach = { iconsHtml, openViewer, viewerUrl, openNotes, openFiles, pick, uploadFiles, manage, removeAttachment, countOn, handlers, fmtSize, fmtLen, targetInfo, setupGithub, disconnectGithub, ready };
})(window.TI);
