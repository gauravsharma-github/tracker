// Sheets (bottom sheet on phone, centered panel on desktop), dialogs, menus and toasts.
(function (TI) {
  const U = TI.util;
  const root = () => document.getElementById('overlays');
  const stack = [];

  function trapEsc(e) {
    if (e.key !== 'Escape' || !stack.length) return;
    const top = stack[stack.length - 1];
    if (top && top.dismissible !== false) { e.preventDefault(); top.close(); }
  }
  document.addEventListener('keydown', trapEsc);

  function openSheet({ title = '', html = '', footer = '', onMount, onClose, size = '', className = '', dismissible = true, noHead = false } = {}) {
    const scrim = document.createElement('div'); scrim.className = 'scrim';
    const el = document.createElement('div');
    el.className = `sheet ${size ? 'size-' + size : ''} ${className}`;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="grab"></div>
      ${noHead ? '' : `<div class="sheet-head"><h2>${U.esc(title)}</h2><button class="icon-btn muted" data-close aria-label="Close">${U.icon('close')}</button></div>`}
      <div class="sheet-body">${html}</div>
      ${footer ? `<div class="sheet-foot">${footer}</div>` : ''}`;
    root().append(scrim, el);
    requestAnimationFrame(() => { scrim.classList.add('in'); el.classList.add('in'); });
    let closed = false;
    const api = {
      el, dismissible,
      body: el.querySelector('.sheet-body'),
      foot: el.querySelector('.sheet-foot'),
      setBody(h) { api.body.innerHTML = h; },
      setTitle(t) { const h = el.querySelector('.sheet-head h2'); if (h) h.textContent = t; },
      close(result) {
        if (closed) return; closed = true;
        scrim.classList.remove('in'); el.classList.remove('in');
        const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        setTimeout(() => { scrim.remove(); el.remove(); }, 260);
        if (onClose) onClose(result);
      },
    };
    stack.push(api);
    if (dismissible) scrim.addEventListener('click', () => api.close());
    el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) api.close(); });
    if (onMount) onMount(api);
    setTimeout(() => { const f = el.querySelector('[autofocus]'); if (f) { f.focus(); if (f.select && f.value) f.select(); } }, 60);
    return api;
  }

  function dialog({ title, message = '', html = '', buttons = [], onMount }) {
    return new Promise((resolve) => {
      const scrim = document.createElement('div'); scrim.className = 'scrim top';
      const el = document.createElement('div'); el.className = 'dialog'; el.setAttribute('role', 'alertdialog');
      el.innerHTML = `<h2>${U.esc(title)}</h2>${message ? `<p>${message}</p>` : ''}${html}
        <div class="btns">${buttons.map((b, i) => `<button class="btn ${b.kind || ''}" data-i="${i}">${U.esc(b.label)}</button>`).join('')}</div>`;
      root().append(scrim, el);
      requestAnimationFrame(() => { scrim.classList.add('in'); el.classList.add('in'); });
      const api = { el, dismissible: true, close: (v) => done(v) };
      stack.push(api);
      let finished = false;
      function done(v) {
        if (finished) return; finished = true;
        const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        scrim.classList.remove('in'); el.classList.remove('in');
        setTimeout(() => { scrim.remove(); el.remove(); }, 220);
        resolve(v);
      }
      scrim.addEventListener('click', () => done(null));
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) done(buttons[+b.dataset.i].value(el)); });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') { const p = buttons.find((b) => b.primary); if (p) { e.preventDefault(); done(p.value(el)); } }
      });
      if (onMount) onMount(el);
      setTimeout(() => { const f = el.querySelector('input,textarea,select') || el.querySelector('.btn.primary,.btn.danger'); if (f) { f.focus(); if (f.select) f.select(); } }, 60);
    });
  }

  const confirmDialog = (title, message, okLabel = 'Delete', kind = 'danger') => dialog({
    title, message: U.esc(message),
    buttons: [{ label: 'Cancel', kind: 'ghost', value: () => false }, { label: okLabel, kind, primary: true, value: () => true }],
  }).then((v) => !!v);

  const promptDialog = ({ title, label = '', value = '', placeholder = '', ok = 'Save', multiline = false, hint = '', type = 'text' }) => dialog({
    title,
    html: `<div class="field">${label ? `<label>${U.esc(label)}</label>` : ''}
      ${multiline ? `<textarea class="textarea" rows="5" placeholder="${U.esc(placeholder)}">${U.esc(value)}</textarea>` : `<input class="input" type="${type}" value="${U.esc(value)}" placeholder="${U.esc(placeholder)}" />`}
      ${hint ? `<div class="hint">${hint}</div>` : ''}</div>`,
    buttons: [{ label: 'Cancel', kind: 'ghost', value: () => null }, { label: ok, kind: 'primary', primary: true, value: (el) => el.querySelector('input,textarea').value }],
  });

  // Context menu anchored to an element (or at a point)
  let openMenuEl = null;
  function closeMenu() { if (openMenuEl) { const m = openMenuEl; openMenuEl = null; m.classList.remove('in'); setTimeout(() => m.remove(), 120); } }
  function openMenu(anchor, items, { align = 'right' } = {}) {
    closeMenu();
    const m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu');
    m.innerHTML = items.map((it, i) => {
      if (it.sep) return '<div class="sep"></div>';
      if (it.heading) return `<div class="label">${U.esc(it.heading)}</div>`;
      return `<button role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''} ${it.on ? 'on' : ''}" ${it.dot ? `style="--c:${it.dot}"` : ''}>
        ${it.dot ? '<span class="dot"></span>' : U.icon(it.icon || 'chevron_right')}<span class="grow ellipsis">${U.esc(it.label)}</span>${it.trail ? `<span class="faint small">${it.trail}</span>` : ''}${it.on ? U.icon('check', 'sm') : ''}</button>`;
    }).join('');
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
    const mw = m.offsetWidth; const mh = m.offsetHeight;
    let left = align === 'left' ? r.left : r.right - mw;
    left = U.clamp(left, 8, window.innerWidth - mw - 8);
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
    m.style.left = left + 'px'; m.style.top = top + 'px';
    m.style.transformOrigin = align === 'left' ? 'top left' : 'top right';
    requestAnimationFrame(() => m.classList.add('in'));
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      const it = items[+b.dataset.i]; closeMenu(); if (it.onClick) it.onClick();
    });
    openMenuEl = m;
    setTimeout(() => {
      const off = (e) => { if (!m.contains(e.target)) { closeMenu(); document.removeEventListener('mousedown', off, true); document.removeEventListener('keydown', esc, true); } };
      const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); document.removeEventListener('mousedown', off, true); document.removeEventListener('keydown', esc, true); } };
      document.addEventListener('mousedown', off, true);
      document.addEventListener('keydown', esc, true);
    }, 0);
    return m;
  }
  window.addEventListener('resize', closeMenu);
  window.addEventListener('scroll', closeMenu, true);

  function toast(msg, { icon = 'info', action = null, duration = 3200 } = {}) {
    const wrap = document.getElementById('toasts');
    const t = document.createElement('div'); t.className = 'toast';
    t.innerHTML = `${U.icon(icon)}<span>${U.esc(msg)}</span>${action ? `<button>${U.esc(action.label)}</button>` : ''}`;
    wrap.appendChild(t);
    while (wrap.children.length > 3) wrap.firstChild.remove();
    requestAnimationFrame(() => t.classList.add('in'));
    const kill = () => { t.classList.remove('in'); setTimeout(() => t.remove(), 220); };
    if (action) t.querySelector('button').onclick = () => { action.fn(); kill(); };
    setTimeout(kill, duration);
  }

  // Close every open sheet/dialog (used when the route changes, e.g. the browser Back button)
  function closeAll() { stack.slice().forEach((s) => s.close(null)); }

  TI.ui = Object.assign(TI.ui || {}, { openSheet, dialog, confirmDialog, promptDialog, openMenu, closeMenu, closeAll, toast, overlayOpen: () => stack.length > 0 });
})(window.TI);
