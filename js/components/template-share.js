// Sharing a project's syllabus as a template: JSON in the TrackIt app's own format
// ({ "title": "Project", "child": [ { "title": "Subject", "child": [ ... ] } ] }),
// as a .json file, as copied JSON code, or as a link that opens the import screen.
(function (TI) {
  const U = TI.util;
  const { state, sel } = TI.store;

  // Build the template object for a project (progress optional)
  function projectJson(pid, { withProgress = false } = {}) {
    const p = sel.project(pid); if (!p) return null;
    const walk = (sid, parentId) => TI.stats.children(state, sid, parentId).map((n) => {
      const kids = walk(sid, n.id);
      const o = { title: n.title, child: kids };
      // progress: stage 1–5 of the five-stage ladder (done = mastered, for older apps)
      // quiz questions travel with the syllabus (templates and progress alike)
      if (!kids.length) { const qs = TI.quiz.bank(state, n.id); if (qs.length) o.mcqs = qs.map((m) => ({ q: m.q, options: m.options, correct: m.correct, ...(m.why ? { why: m.why } : {}) })); }
      if (withProgress && !kids.length && TI.stages.stageOf(n) > 0) { o.stage = TI.stages.stageOf(n); if (o.stage === TI.stages.N) o.done = true; }
      return o;
    });
    const out = { title: p.name, child: sel.subjects(pid).map((s) => ({ title: s.name, child: walk(s.id, null) })) };
    const src = sel.sourcesOf(pid); if (src.length) out.sources = src.map((x) => ({ name: x.name, url: x.url, ...(x.note ? { note: x.note } : {}) }));
    return out;
  }

  function counts(obj) {
    let topics = 0; let items = 0;
    const walk = (arr) => arr.forEach((n) => { items++; if (!n.child.length) topics++; walk(n.child); });
    obj.child.forEach((s) => walk(s.child));
    return { subjects: obj.child.length, items, topics };
  }

  const pretty = (obj) => JSON.stringify(obj, null, 2);
  const fileName = (obj) => `${U.slug(obj.title) || 'trackit-template'}.json`;

  // ---------- Compact links: deflate + base64url in the URL hash (no server needed) ----------
  function b64urlFromBytes(bytes) {
    let bin = ''; const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function bytesFromB64url(s) {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    const out = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
    return out;
  }
  async function pack(str) {
    const bytes = new TextEncoder().encode(str);
    if (window.CompressionStream) {
      try {
        const buf = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
        return 'z' + b64urlFromBytes(new Uint8Array(buf));
      } catch (e) { /* fall back to plain */ }
    }
    return 'j' + b64urlFromBytes(bytes);
  }
  async function unpack(payload) {
    const kind = payload[0]; const bytes = bytesFromB64url(payload.slice(1));
    if (kind === 'z') {
      if (!window.DecompressionStream) throw new Error('This browser cannot open compressed links. Ask for the .json file instead.');
      const buf = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
      return new TextDecoder().decode(buf);
    }
    if (kind === 'j') return new TextDecoder().decode(bytes);
    throw new Error('This link is not a TrackIt template link.');
  }
  const appBase = () => location.href.split('#')[0];
  async function makeLink(pid, opts) { return `${appBase()}#/import?t=${await pack(JSON.stringify(projectJson(pid, opts)))}`; }

  // ---------- Actions ----------
  async function shareFile(pid, opts) {
    const obj = projectJson(pid, opts); const name = fileName(obj); const text = pretty(obj);
    try {
      const f = new File([text], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [f] }) && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ files: [f], title: obj.title, text: `${obj.title} – TrackIt template` });
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    U.download(name, text, 'application/json');
    TI.ui.toast(`Saved ${name}`, { icon: 'download' });
  }

  async function copyJson(pid, opts) {
    const ok = await U.copy(pretty(projectJson(pid, opts)));
    TI.ui.toast(ok ? 'JSON code copied' : 'Could not copy', { icon: ok ? 'content_copy' : 'error' });
  }

  async function showLink(pid, opts) {
    const url = await makeLink(pid, opts);
    const local = location.protocol === 'file:';
    const canShare = !!navigator.share;
    TI.ui.openSheet({
      title: 'Share link',
      html: `<p class="small muted" style="margin-bottom:12px">Anyone who opens this link sees the template in TrackIt and can import it. The whole template is inside the link, so nothing is uploaded.</p>
        ${local ? `<div class="cx-err" style="margin:0 0 12px">${U.icon('info')}<span>You opened TrackIt from a file on this computer, so this link only works here. Links work for others once TrackIt is hosted (for example on GitHub Pages).</span></div>` : ''}
        <textarea class="textarea mono" rows="4" readonly id="sl-url">${U.esc(url)}</textarea>
        <div class="small faint" style="margin-top:6px">${(url.length / 1024).toFixed(1)} KB link${url.length > 8000 ? ' · long links may be cut by some chat apps – the .json file is safer' : ''}</div>`,
      footer: `<button class="btn ghost" data-act="open">${U.icon('open_in_new')}Open</button>${canShare ? `<button class="btn" data-act="share">${U.icon('share')}Share</button>` : ''}<button class="btn primary" data-act="copy">${U.icon('content_copy')}Copy link</button>`,
      onMount(a) {
        const ta = a.el.querySelector('#sl-url'); ta.addEventListener('focus', () => ta.select());
        TI.forms.onAct(a, {
          async copy() { const ok = await U.copy(url); TI.ui.toast(ok ? 'Link copied' : 'Could not copy', { icon: ok ? 'link' : 'error' }); },
          async share() { try { await navigator.share({ url, title: 'TrackIt template' }); } catch (e) { /* cancelled */ } },
          open() { window.open(url, '_blank', 'noopener'); },
        });
      },
    });
  }

  // The "Options" sheet behind every project's Share button (as in the app)
  function openOptions(pid) {
    const p = sel.project(pid) || sel.activeProject(); if (!p) return;
    TI.ui.openSheet({
      title: 'Options', className: 'options-sheet',
      html: `<div class="opt-rows">
        <button class="opt-row" data-act="progress">${U.icon('insert_chart', 'fill')}<span>Share Progress</span></button>
        <button class="opt-row" data-act="template">${U.icon('file_copy', 'fill')}<span>Share Template</span></button>
      </div>`,
      onMount(a) {
        TI.forms.onAct(a, {
          progress() { a.close(); TI.router.go('/share'); },
          template() { a.close(); TI.router.go('/share-template/' + p.id); },
        });
      },
    });
  }

  TI.shareTpl = { projectJson, counts, pretty, fileName, makeLink, unpack, shareFile, copyJson, showLink, openOptions };
})(window.TI);
