// Share progress: a card with progress, time and a daily bar chart, exported as a PNG.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  const COLORS = ['#D8AF52', '#6BAD77', '#CB9833', '#664FD6', '#CB697E', '#5E9FEA', '#64B7D4', '#86AD36', '#E75B5C', '#DC7660', '#405FFF', '#25AE97'];

  function opts() {
    const o = Object.assign({ scope: 'project', theme: 'dark', color: '#CB697E', days: 12 }, state.ui.shareOpts || {});
    const q = TI.router.current.query;
    if (q.subject && sel.subject(q.subject) && o._q !== q.subject) { o.scope = q.subject; o.color = sel.subject(q.subject).color; o._q = q.subject; state.ui.shareOpts = o; }
    return o;
  }

  function data(o) {
    const p = sel.activeProject(); const today = U.today();
    const s = o.scope !== 'project' ? sel.subject(o.scope) : null;
    const st = TI.stats;
    const name = s ? s.name : p ? p.name : 'TrackIt';
    const ratio = s ? st.subjectRatio(state, s.id) : p ? st.projectRatio(state, p.id) : 0;
    const fn = s ? (d) => st.subjectDay(state, s.id, d) : (d) => (p ? st.projectDay(state, p.id, d) : 0);
    const total = s ? st.subjectTime(state, s.id) : p ? st.projectTime(state, p.id) : 0;
    const prog = s ? st.subjectProgress(state, s.id) : p ? st.projectProgress(state, p.id) : { done: 0, leaves: 0 };
    const days = [...Array(o.days)].map((_, i) => U.addDaysKey(today, i - o.days + 1));
    return { name, ratio, today: fn(today), total, parts: `${prog.done}/${prog.leaves}`, days, values: days.map(fn) };
  }

  function cardHtml(o) {
    const d = data(o); const max = Math.max(...d.values, 1);
    return `<div class="share-frame" style="--fc:${o.color}">
      <div class="share-card ${o.theme}">
        <div class="sc-name">${U.esc(d.name)}</div>
        <div class="bar-row">${TI.ui.bar(d.ratio, o.color, 'thick')}<span class="pct" style="color:${o.color};font-size:14px">${U.pctInt(d.ratio)}</span></div>
        <div class="stat-tiles" style="--c:${o.color}">
          <div class="stat-tile"><div class="l">Spent Today</div><div class="v">${U.fmtDur(d.today)}</div></div>
          <div class="stat-tile"><div class="l">Spent Total</div><div class="v">${U.fmtDur(d.total)}</div></div>
          <div class="stat-tile"><div class="l">Parts Done</div><div class="v">${d.parts}</div></div>
        </div>
        <div class="sc-chart">${d.values.map((v, i) => `<div class="sc-col" title="${U.fmtDay(d.days[i])} · ${U.fmtDur(v)}"><i style="height:${Math.max(3, (v / max) * 100)}%;background:${U.rgba(o.color, 0.45)}"></i></div>`).join('')}</div>
      </div>
      <div class="sc-brand">${TI.ui.logo(34)}<div><b>${U.esc(TI.config.appName)}</b><span>${U.pad(new Date().getDate())}/${U.pad(new Date().getMonth() + 1)}/${new Date().getFullYear()}</span></div></div>
    </div>`;
  }

  // Canvas version of the same card (1080 × 1350) for download / sharing
  function rr(ctx, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  async function render(o) {
    const d = data(o);
    const W = 1080; const H = 1350; const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    try { await document.fonts.load('600 40px Inter'); } catch (e) { /* ignore */ }
    const dark = o.theme === 'dark';
    const bg = dark ? '#171B25' : '#FFFFFF'; const ink = dark ? '#FFFFFA' : '#0E1220'; const tile = dark ? U.mix('#1F2430', o.color, 0.09) : U.mix('#F1F2F6', o.color, 0.1); const track = dark ? '#343740' : '#DDE0E8';
    x.fillStyle = o.color; x.fillRect(0, 0, W, H);
    const pad = 54; const cw = W - pad * 2; const ch = H - 230;
    rr(x, pad, pad, cw, ch, 48); x.fillStyle = bg; x.fill();
    const L = pad + 56; let y = pad + 110;
    x.fillStyle = ink; x.font = '600 56px Inter, sans-serif'; x.textBaseline = 'alphabetic';
    let name = d.name; while (x.measureText(name).width > cw - 112 && name.length > 4) name = name.slice(0, -2); if (name !== d.name) name += '…';
    x.fillText(name, L, y);
    y += 56; const bw = cw - 112 - 120;
    rr(x, L, y, bw, 22, 11); x.fillStyle = track; x.fill();
    if (d.ratio > 0) { rr(x, L, y, Math.max(22, bw * d.ratio), 22, 11); x.fillStyle = o.color; x.fill(); }
    x.fillStyle = o.color; x.font = '600 40px Inter, sans-serif'; x.textAlign = 'right'; x.fillText(U.pctInt(d.ratio), L + cw - 112, y + 20); x.textAlign = 'left';
    y += 70; const tw = (cw - 112 - 40) / 3;
    [['Spent Today', U.fmtDur(d.today)], ['Spent Total', U.fmtDur(d.total)], ['Parts Done', d.parts]].forEach(([l, v], i) => {
      const tx = L + i * (tw + 20); rr(x, tx, y, tw, 150, 28); x.fillStyle = tile; x.fill();
      x.fillStyle = o.color; x.font = '500 30px Inter, sans-serif'; x.fillText(l, tx + 28, y + 56);
      x.fillStyle = ink; x.font = '500 44px Inter, sans-serif'; x.fillText(v, tx + 28, y + 114);
    });
    // chart
    const cy = y + 200; const chH = pad + ch - 60 - cy; const n = d.values.length; const step = (cw - 112) / n; const barW = step * 0.58;
    const max = Math.max(...d.values, 1);
    d.values.forEach((v, i) => {
      const h = Math.max(8, (v / max) * chH); const bx = L + i * step + (step - barW) / 2;
      rr(x, bx, cy + chH - h, barW, h, 10); x.fillStyle = U.rgba(o.color, 0.45); x.fill();
    });
    // brand (logo drawn in code so the canvas stays exportable when opened from disk)
    const by = H - 150; const lx = W - pad - 380; const ls = 84;
    const g = x.createLinearGradient(lx, by, lx + ls, by + ls); g.addColorStop(0, '#5A74FF'); g.addColorStop(1, '#3550F0');
    rr(x, lx, by, ls, ls, 21); x.fillStyle = g; x.fill();
    x.beginPath(); x.arc(lx + ls / 2, by + ls / 2, ls * 0.25, Math.PI * 0.75, Math.PI * 0.25); x.strokeStyle = '#fff'; x.lineWidth = ls * 0.11; x.lineCap = 'round'; x.stroke();
    x.fillStyle = '#FFFFFF'; x.font = '700 46px Inter, sans-serif'; x.fillText(TI.config.appName, W - pad - 280, by + 40);
    x.font = '600 32px Inter, sans-serif'; x.fillStyle = 'rgba(255,255,255,.85)';
    x.fillText(`${U.pad(new Date().getDate())}/${U.pad(new Date().getMonth() + 1)}/${new Date().getFullYear()}`, W - pad - 280, by + 84);
    return c;
  }
  const toBlob = (c) => new Promise((r) => c.toBlob(r, 'image/png'));

  const screen = {
    title: 'Share',
    render(ctx) {
      const p = sel.activeProject();
      if (!p) return TI.ui.empty('ios_share', 'Nothing to share yet', 'Create a project and study a little first.');
      const o = opts(); const subjects = sel.subjects(p.id); const pro = sel.isPro();
      return `<div class="topbar"><button class="icon-btn" data-act="back" aria-label="Back">${U.icon('arrow_back')}</button><h1 class="grow">Share Progress</h1>
          <div class="actions"><span class="desktop-only">${TI.ui.seg([{ id: 'progress', label: 'Progress' }, { id: 'template', label: 'Template' }], 'progress', 'share-tab', 'alt')}</span><button class="icon-btn" data-act="share-native" aria-label="Share">${U.icon('share')}</button></div></div>
        <div class="share-grid">
          <div class="share-preview">${cardHtml(o)}</div>
          <div class="share-opts">
            <div class="set-group">
              <div class="set-row"><div class="txt"><div class="ttl">Category</div></div>
                <select class="select" style="width:auto;max-width:60%;min-height:38px" data-change="share-scope"><option value="project" ${o.scope === 'project' ? 'selected' : ''}>${U.esc(p.name)} (all)</option>${subjects.map((s) => `<option value="${s.id}" ${o.scope === s.id ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}</select></div>
              <div class="set-row"><div class="txt"><div class="ttl">Theme</div></div>${TI.ui.seg([{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }], o.theme, 'share-theme', 'alt')}</div>
              <div class="set-row"><div class="txt"><div class="ttl">Days in chart</div></div>${TI.ui.seg([{ id: '7', label: '7' }, { id: '12', label: '12' }, { id: '30', label: '30' }], String(o.days), 'share-days', 'alt')}</div>
              <div class="set-row" style="flex-direction:column;align-items:flex-start"><div class="ttl">Colors ${pro ? '' : `<span class="small faint">· more with Pro ${TI.ui.crown()}</span>`}</div>
                <div class="colors">${COLORS.map((c, i) => `<button class="color-dot ${c === o.color ? 'on' : ''}" style="--c:${c};${!pro && i >= 6 ? 'opacity:.4' : ''}" data-act="share-color" data-color="${c}" data-lock="${!pro && i >= 6 ? 1 : ''}" aria-label="Colour ${c}"></button>`).join('')}</div></div>
            </div>
            <div class="row wrap"><button class="btn primary grow" data-act="share-download">${U.icon('download')}Download image</button><button class="btn grow" data-act="share-copy">${U.icon('content_copy')}Copy image</button></div>
            <p class="small faint" style="margin-top:12px">Post it to your study group, Instagram story or WhatsApp status to stay accountable.</p>
          </div>
        </div>`;
    },
    actions: {
      'share-tab': (el) => { if (el.dataset.v === 'template') TI.router.go('/share-template/' + ((sel.activeProject() || {}).id || ''), { replace: true }); },
      'share-theme': (el) => actions.setUi({ shareOpts: { ...opts(), theme: el.dataset.v } }),
      'share-days': (el) => actions.setUi({ shareOpts: { ...opts(), days: +el.dataset.v } }),
      'share-color': (el) => { if (el.dataset.lock) return TI.screens.pro.open('share'); actions.setUi({ shareOpts: { ...opts(), color: el.dataset.color } }); },
      'share-download': async () => { const c = await render(opts()); const b = await toBlob(c); U.download(`trackit-progress-${U.today()}.png`, b, 'image/png'); },
      'share-copy': async () => {
        try { const c = await render(opts()); const b = await toBlob(c); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); TI.ui.toast('Image copied', { icon: 'content_copy' }); } catch (e) { TI.ui.toast('Copying images is not supported here – use Download', { icon: 'info' }); }
      },
      'share-native': async () => {
        try {
          const c = await render(opts()); const b = await toBlob(c); const f = new File([b], 'trackit-progress.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'My study progress', text: `Tracking my progress with ${TI.config.appName}` });
          else { U.download('trackit-progress.png', b, 'image/png'); TI.ui.toast('Saved the image – share it from your downloads', { icon: 'download' }); }
        } catch (e) { /* cancelled */ }
      },
    },
    changes: { 'share-scope': (el) => { const s = sel.subject(el.value); actions.setUi({ shareOpts: { ...opts(), scope: el.value, color: s ? s.color : opts().color } }); } },
    renderCanvas: render,
  };
  TI.screens.share = screen;
})(window.TI);
