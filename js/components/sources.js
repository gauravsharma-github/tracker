// Study sources of a project: named links (courses, videos, docs, books…) shown in the project view's side panel.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;

  // Recognise common study sites for an icon and a label
  const KINDS = [
    [/youtube\.com|youtu\.be/, 'smart_display', 'YouTube', '#FF4E45'],
    [/udemy\.com/, 'school', 'Udemy', '#A435F0'],
    [/coursera\.org/, 'school', 'Coursera', '#2A73CC'],
    [/trailhead\.salesforce\.com/, 'cloud', 'Trailhead', '#1B96FF'],
    [/salesforce\.com|force\.com/, 'cloud', 'Salesforce', '#1B96FF'],
    [/pega\.com|academy\.pega/, 'school', 'Pega', '#2E8BC0'],
    [/linkedin\.com\/learning/, 'school', 'LinkedIn Learning', '#0A66C2'],
    [/github\.com/, 'code', 'GitHub', '#9AA4B2'],
    [/docs\.google\.com|drive\.google\.com/, 'description', 'Google Drive', '#1FA463'],
    [/notion\.(so|site)/, 'description', 'Notion', '#9AA4B2'],
    [/medium\.com|substack\.com|dev\.to|hashnode/, 'article', 'Article', '#F4B400'],
    [/stackoverflow\.com/, 'forum', 'Stack Overflow', '#F48024'],
    [/\.pdf(\?|#|$)/i, 'picture_as_pdf', 'PDF', '#E75B5C'],
    [/amazon\.|goodreads\.com|books\.google/, 'menu_book', 'Book', '#F59E0B'],
  ];
  const kindOf = (url) => { const k = KINDS.find(([re]) => re.test(url)); return k ? { icon: k[1], label: k[2], color: k[3] } : { icon: 'link', label: '', color: 'var(--primary-2)' }; };
  const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const normUrl = (u) => { const t = String(u || '').trim(); if (!t) return ''; return /^[a-z][\w+.-]*:\/\//i.test(t) ? t : `https://${t}`; };
  const validUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) && x.hostname.includes('.'); } catch (e) { return false; } };
  // A readable default name from the URL ("udemy.com › course › apex-programming")
  function guessName(url) {
    try {
      const x = new URL(url); const host = x.hostname.replace(/^www\./, '');
      const k = kindOf(url);
      const parts = x.pathname.split('/').filter(Boolean).filter((p) => !/^(watch|course|learn|lecture|v|d|edit|view|en|en-us|in)$/i.test(p) && p.length < 80);
      const last = decodeURIComponent(parts[parts.length - 1] || '').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[-_+]+/g, ' ').trim();
      const nice = last && !/^[\w-]{20,}$/.test(last) ? last.replace(/\b\w/g, (c) => c.toUpperCase()) : '';
      return nice ? `${nice}${k.label ? ` (${k.label})` : ''}` : k.label || host;
    } catch (e) { return url; }
  }

  function panel(p) {
    const list = sel.sourcesOf(p.id);
    return `<div class="card src-card">
      <div class="card-head"><h3>Sources</h3><div class="actions"><button class="btn sm ghost" data-act="src-add" data-pid="${p.id}">${U.icon('add')}Add</button></div></div>
      ${list.length ? `<div class="src-list">${list.map((x) => { const k = kindOf(x.url); return `<div class="src-item" style="--k:${k.color}">
          <a class="src-link" href="${U.esc(x.url)}" target="_blank" rel="noopener noreferrer" title="${U.esc(x.url)}">
            <span class="src-ic">${U.icon(k.icon)}</span>
            <span class="src-txt"><span class="src-name">${U.esc(x.name)}</span><span class="src-host">${U.esc(x.note || hostOf(x.url))}</span></span>
            <span class="src-go">${U.icon('open_in_new')}</span>
          </a>
          <button class="icon-btn sm src-more" data-act="src-menu" data-id="${x.id}" aria-label="More for ${U.esc(x.name)}">${U.icon('more_vert')}</button>
        </div>`; }).join('')}</div>`
        : `<div class="small muted">Keep the courses, videos, docs and books you study from here – one click to open them.</div>
           <button class="btn sm soft-tint" style="margin-top:10px" data-act="src-add" data-pid="${p.id}">${U.icon('add_link')}Add a source</button>`}
    </div>`;
  }

  function editor(pid, src = null) {
    const p = sel.project(pid); if (!p) return;
    TI.ui.openSheet({
      title: src ? 'Edit source' : `Add source · ${p.name}`,
      html: `<div class="field"><label>Link</label><input class="input" id="src-url" value="${U.esc(src ? src.url : '')}" placeholder="https://www.udemy.com/course/…" autocomplete="off" spellcheck="false" inputmode="url" /></div>
        <div class="field"><label>Name</label><input class="input" id="src-name" value="${U.esc(src ? src.name : '')}" placeholder="e.g. Apex Programming – Udemy course" /></div>
        <div class="field"><label>Note (optional)</label><input class="input" id="src-note" value="${U.esc(src ? src.note || '' : '')}" placeholder="e.g. Sections 1–8 · official docs · chapter 4" /></div>
        <div id="src-err"></div>
        ${src ? '' : '<p class="tiny faint" style="margin:0">Tip: paste several links at once (separated by spaces) into Link to add them all.</p>'}`,
      footer: `${src ? '<button class="btn ghost danger" data-act="del">Delete</button>' : ''}<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-act="save">${src ? 'Save' : 'Add'}</button>`,
      onMount(a) {
        const $ = (q) => a.el.querySelector(q); let touched = !!src;
        $('#src-name').addEventListener('input', () => { touched = true; });
        $('#src-url').addEventListener('input', () => { const u = normUrl($('#src-url').value.trim().split(/\s+/)[0]); if (!touched && validUrl(u)) $('#src-name').value = guessName(u); });
        const err = (m) => { $('#src-err').innerHTML = m ? `<div class="cx-err">${U.icon('error')}<span>${U.esc(m)}</span></div>` : ''; };
        TI.forms.onAct(a, {
          save() {
            const raw = $('#src-url').value.trim(); const toks = raw.split(/[\s,]+/).filter(Boolean);
            // several links pasted together (separated by spaces or new lines) → one source each
            const urls = (toks.length > 1 && toks.every((t) => /^(https?:\/\/)?[^\s/]+\.[^\s]+/i.test(t)) ? toks : [raw]).map(normUrl).filter(Boolean);
            if (!urls.length) { err('Paste the link to the course, video, page or book.'); $('#src-url').focus(); return; }
            const bad = urls.find((u) => !validUrl(u)); if (bad) { err(`That doesn't look like a web link: ${bad}`); return; }
            const name = $('#src-name').value.trim(); const note = $('#src-note').value.trim();
            if (src) { actions.updateSource(src.id, { url: urls[0], name: name || guessName(urls[0]), note }); a.close(); TI.ui.toast('Source saved', { icon: 'check' }); return; }
            const items = urls.map((u, i) => ({ url: u, name: urls.length === 1 ? name || guessName(u) : guessName(u), note: urls.length === 1 ? note : '' }));
            actions.addSources(pid, items); a.close();
            TI.ui.toast(items.length > 1 ? `${items.length} sources added – rename them from their ⋮ menu` : 'Source added', { icon: 'add_link' });
          },
          async del() { if (await TI.ui.confirmDialog(`Delete “${src.name}”?`, 'Only the link is removed from TrackIt.', 'Delete')) { actions.deleteSource(src.id); a.close(); } },
        });
        setTimeout(() => $('#src-url').focus(), 80);
      },
    });
  }

  function menu(anchor, id) {
    const x = state.sources.find((s) => s.id === id); if (!x) return;
    const list = sel.sourcesOf(x.projectId); const i = list.indexOf(x);
    TI.ui.openMenu(anchor, [
      { icon: 'open_in_new', label: 'Open', onClick: () => window.open(x.url, '_blank', 'noopener') },
      { icon: 'content_copy', label: 'Copy link', onClick: async () => { const ok = await U.copy(x.url); TI.ui.toast(ok ? 'Link copied' : 'Could not copy', { icon: 'content_copy' }); } },
      { icon: 'edit', label: 'Edit', onClick: () => editor(x.projectId, x) },
      ...(i > 0 ? [{ icon: 'arrow_upward', label: 'Move up', onClick: () => actions.moveSource(id, -1) }] : []),
      ...(i < list.length - 1 ? [{ icon: 'arrow_downward', label: 'Move down', onClick: () => actions.moveSource(id, 1) }] : []),
      { sep: true },
      { icon: 'delete', label: 'Delete', danger: true, onClick: async () => { if (await TI.ui.confirmDialog(`Delete “${x.name}”?`, 'Only the link is removed from TrackIt.', 'Delete')) actions.deleteSource(id); } },
    ]);
  }

  const handlers = {
    'src-add': (el) => editor(el.dataset.pid || (sel.activeProject() || {}).id),
    'src-menu': (el) => menu(el, el.dataset.id),
  };

  TI.sources = { panel, editor, menu, handlers, kindOf, guessName };
})(window.TI);
