// Attachment viewer (opens in its own tab): PDF in the browser's PDF viewer, audio in a player
// with speed control, skip buttons and "continue where you left off".
(function (TI) {
  const U = TI.util;
  const { sel, actions } = TI.store;
  const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
  let objectUrl = null;

  const screen = {
    title: 'Attachment',
    fullscreen: true,
    static: true, // don't re-render while a PDF / audio is open (background sync would reset it)
    render(ctx) {
      const a = sel.attachment(ctx.params[0]);
      if (!a) {
        return `<div class="viewer"><div class="viewer-bar"><button class="icon-btn" data-act="viewer-close" aria-label="Close">${U.icon('close')}</button><b class="grow">Attachment</b></div>
          ${TI.ui.empty('search_off', 'Attachment not found', 'It may have been deleted, or this device has not synced yet.', '<button class="btn primary" data-act="nav" data-to="/">Open TrackIt</button>')}</div>`;
      }
      const t = TI.attach.targetInfo(a.subjectId, a.nodeId);
      const color = t.s ? t.s.color : 'var(--primary)';
      return `<div class="viewer ${a.kind}" style="--c:${color}">
        <div class="viewer-bar">
          <button class="icon-btn" data-act="viewer-close" aria-label="Close">${U.icon('close')}</button>
          <span class="viewer-ic">${U.icon(a.kind === 'pdf' ? 'picture_as_pdf' : 'headphones', 'fill')}</span>
          <div class="grow" style="min-width:0"><div class="ellipsis viewer-name">${U.esc(a.name)}</div><div class="ellipsis tiny faint">${U.esc([t.p ? t.p.name : '', ...t.crumbs].filter(Boolean).join(' › '))}</div></div>
          <button class="btn sm ghost" data-act="viewer-download" disabled id="vw-dl">${U.icon('download')}<span class="desktop-only">Download</span></button>
          ${a.kind === 'pdf' ? `<button class="btn sm ghost" data-act="viewer-raw" disabled id="vw-raw">${U.icon('open_in_full')}<span class="desktop-only">Full screen</span></button>` : ''}
          <a class="btn sm ghost" href="${U.esc(TI.github.webUrl(a))}" target="_blank" rel="noopener" title="Open in GitHub">${U.icon('code')}<span class="desktop-only">GitHub</span></a>
        </div>
        <div class="viewer-body" id="vw-body"><div class="viewer-loading"><div class="spinner"></div><div id="vw-progress">Loading from GitHub…</div><div class="tiny faint">${TI.attach.fmtSize(a.size)}</div></div></div>
      </div>`;
    },
    mount(root, ctx) {
      const a = sel.attachment(ctx.params[0]); if (!a) return;
      document.title = `${a.name} – ${TI.config.appName}`;
      const body = root.querySelector('#vw-body');
      let alive = true; let saveTimer = null; let audio = null;
      const setProgress = (p) => { const el = root.querySelector('#vw-progress'); if (el) el.textContent = `Loading from GitHub… ${Math.round(p * 100)}%`; };
      TI.github.download(a, { onProgress: setProgress }).then((blob) => {
        if (!alive) return;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(blob);
        root.querySelectorAll('#vw-dl,#vw-raw').forEach((b) => { b.disabled = false; });
        if (a.kind === 'pdf') {
          const touch = window.matchMedia('(pointer: coarse)').matches;
          body.innerHTML = `<iframe class="pdf-frame" src="${objectUrl}#view=FitH" title="${U.esc(a.name)}"></iframe>
            ${touch ? `<div class="pdf-fallback"><button class="btn primary" data-act="viewer-raw">${U.icon('open_in_full')}Open PDF</button><span class="tiny faint">If the PDF doesn't show here, open it full screen or download it.</span></div>` : ''}`;
          return;
        }
        const pos = TI.storage.get('apos.' + a.id, 0);
        const rate = TI.storage.get('arate', 1);
        body.innerHTML = `<div class="player card">
          <div class="player-art">${U.icon('graphic_eq')}</div>
          <div class="player-title">${U.esc(a.name)}</div>
          <div class="small muted">${U.esc(TI.attach.targetInfo(a.subjectId, a.nodeId).crumbs.join(' › '))}</div>
          <audio controls preload="metadata" src="${objectUrl}" id="vw-audio"></audio>
          <div class="player-ctrls">
            <button class="ctrl-btn" data-act="viewer-skip" data-s="-10" title="Back 10 s" aria-label="Back 10 seconds">${U.icon('replay_10')}</button>
            <button class="big-play" data-act="viewer-play" aria-label="Play or pause">${U.icon('play_arrow')}</button>
            <button class="ctrl-btn" data-act="viewer-skip" data-s="30" title="Forward 30 s" aria-label="Forward 30 seconds">${U.icon('forward_30')}</button>
          </div>
          <div class="chips speed-chips">${SPEEDS.map((s) => `<button class="chip ${s === rate ? 'on' : ''}" data-act="viewer-speed" data-s="${s}">${s}×</button>`).join('')}</div>
          ${pos > 5 ? `<div class="small muted" id="vw-resume">Continuing from ${TI.attach.fmtLen(pos)} · <a href="#" data-act="viewer-restart">start over</a></div>` : ''}
          <div class="tiny faint" style="margin-top:8px"><kbd>Space</kbd> play / pause · <kbd>←</kbd> <kbd>→</kbd> 5 s</div>
        </div>`;
        audio = body.querySelector('#vw-audio');
        audio.playbackRate = rate;
        audio.addEventListener('loadedmetadata', () => {
          if (pos > 5 && pos < audio.duration - 5) audio.currentTime = pos;
          if (!a.duration && isFinite(audio.duration)) actions.updateAttachment(a.id, { duration: Math.round(audio.duration) });
        });
        const icon = () => { const b = body.querySelector('[data-act="viewer-play"]'); if (b) b.innerHTML = U.icon(audio.paused ? 'play_arrow' : 'pause'); };
        audio.addEventListener('play', icon); audio.addEventListener('pause', () => { icon(); TI.storage.set('apos.' + a.id, audio.currentTime); });
        audio.addEventListener('ended', () => TI.storage.set('apos.' + a.id, 0));
        audio.addEventListener('error', () => { body.insertAdjacentHTML('afterbegin', `<div class="cx-err" style="max-width:560px;margin:0 auto 12px">${U.icon('error')}<span>This browser can't play .${U.esc(TI.github.extOf(a.name))} audio. Download it and open it in a media player, or export it as M4A/MP3.</span></div>`); });
        saveTimer = setInterval(() => { if (audio && !audio.paused) TI.storage.set('apos.' + a.id, audio.currentTime); }, 3000);
        screen._audio = audio;
      }).catch((e) => {
        if (!alive) return;
        const notSetUp = !TI.github.configured();
        body.innerHTML = TI.ui.empty(notSetUp ? 'link_off' : 'error', notSetUp ? 'Connect GitHub on this device' : 'Could not load the file', U.esc(notSetUp ? 'This browser does not have your GitHub repo and token yet. Add them in Settings › Attachments, or connect this device with a connection code.' : e.message),
          notSetUp ? '<button class="btn primary" data-act="nav" data-to="/settings?focus=github">Open settings</button>' : '<button class="btn primary" data-act="viewer-retry">Try again</button>');
      });
      const onKey = (e) => {
        if (!audio || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
        if (e.key === ' ') { e.preventDefault(); if (audio.paused) audio.play(); else audio.pause(); }
        if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - 5); }
        if (e.key === 'ArrowRight') { audio.currentTime = Math.min(audio.duration || 1e9, audio.currentTime + 5); }
      };
      document.addEventListener('keydown', onKey);
      return () => { alive = false; clearInterval(saveTimer); if (audio) { TI.storage.set('apos.' + a.id, audio.currentTime); audio.pause(); } document.removeEventListener('keydown', onKey); screen._audio = null; };
    },
    keys() { return !!screen._audio; },
    actions: {
      'viewer-close': () => { window.close(); setTimeout(() => TI.router.back('/'), 150); },
      'viewer-download': () => { const a = sel.attachment(TI.router.current.params[0]); if (a && objectUrl) { const l = document.createElement('a'); l.href = objectUrl; l.download = a.name; document.body.appendChild(l); l.click(); l.remove(); } },
      'viewer-raw': () => { if (objectUrl) window.open(objectUrl, '_blank'); },
      'viewer-retry': () => TI.app.render(true),
      'viewer-play': () => { const au = screen._audio; if (au) { if (au.paused) au.play(); else au.pause(); } },
      'viewer-skip': (el) => { const au = screen._audio; if (au) au.currentTime = U.clamp(au.currentTime + +el.dataset.s, 0, au.duration || 1e9); },
      'viewer-speed': (el) => { const au = screen._audio; const s = +el.dataset.s; if (au) au.playbackRate = s; TI.storage.set('arate', s); document.querySelectorAll('.speed-chips .chip').forEach((c) => c.classList.toggle('on', +c.dataset.s === s)); },
      'viewer-restart': () => { const au = screen._audio; if (au) { au.currentTime = 0; au.play(); } const r = document.getElementById('vw-resume'); if (r) r.remove(); },
    },
  };
  TI.screens.view = screen;
})(window.TI);
