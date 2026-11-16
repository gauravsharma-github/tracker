// Small render helpers that return HTML strings.
(function (TI) {
  const U = TI.util;

  function ring(ratio, color, { size = 64, stroke = 6, label, labelSize } = {}) {
    const r = (size - stroke) / 2; const c = 2 * Math.PI * r;
    const v = U.clamp(ratio || 0, 0, 1);
    const lbl = label == null ? U.pctInt(v) : label;
    return `<div class="ring" style="width:${size}px;height:${size}px;--c:${color}">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" />
        <circle class="ring-val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
          stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - v)).toFixed(2)}" ${v === 0 ? 'opacity="0"' : ''}/>
      </svg>
      <div class="ring-label" ${labelSize ? `style="font-size:${labelSize}px"` : ''}>${lbl}</div>
    </div>`;
  }

  const bar = (ratio, color, cls = '') => `<div class="bar ${cls}" style="--c:${color}"><i style="width:${(U.clamp(ratio || 0, 0, 1) * 100).toFixed(1)}%"></i></div>`;
  const barRow = (ratio, color, dp = 1) => `<div class="bar-row">${bar(ratio, color)}<span class="pct">${U.pct(ratio, dp)}</span></div>`;

  // Strip of recent days, newest on the right (as in the app). Older days clip off on narrow screens.
  function dateStrip({ count = 14, fn, selected = U.today(), color, act = 'pick-day' }) {
    const today = U.today(); const days = [];
    for (let i = count - 1; i >= 0; i--) days.push(U.addDaysKey(today, -i));
    return `<div class="datestrip" ${color ? `style="--c:${color}"` : ''}>${days.map((k) => {
      const d = U.parseDay(k); const sec = fn(k);
      return `<button class="day ${k === today ? 'on' : ''} ${k === selected && k !== today ? 'sel' : ''} ${sec ? 'has' : ''}" data-act="${act}" data-day="${k}" title="${U.fmtDay(k)} · ${U.fmtDur(sec)}">
        <span class="m">${U.MONTHS[d.getMonth()]}</span><span class="d">${d.getDate()}</span><span class="t">${U.fmtHM(sec)}</span></button>`;
    }).join('')}</div>`;
  }

  const seg = (options, value, act, cls = '') => `<div class="seg ${cls}" role="tablist">${options.map((o) => `<button role="tab" class="${o.id === value ? 'on' : ''}" data-act="${act}" data-v="${o.id}">${o.label}</button>`).join('')}</div>`;

  const empty = (icon, title, sub = '', btn = '') => `<div class="empty">${U.icon(icon)}<h3>${U.esc(title)}</h3>${sub ? `<p>${sub}</p>` : ''}${btn}</div>`;

  const kpi = (icon, label, value, sub = '', color) => `<div class="kpi" ${color ? `style="--c:${color}"` : ''}><div class="ic">${U.icon(icon)}</div><div class="grow"><div class="l">${label}</div><div class="v">${value}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div></div>`;

  const colorPicker = (value, act = 'pick-color', colors = TI.config.palette) => `<div class="colors">${colors.map((c) => `<button type="button" class="color-dot ${c.toLowerCase() === String(value).toLowerCase() ? 'on' : ''}" style="--c:${c}" data-act="${act}" data-color="${c}" aria-label="Color ${c}"></button>`).join('')}</div>`;

  const crown = () => U.icon('crown', 'fill crown sm');
  const logo = (size = 32) => `<img src="assets/logo.svg" width="${size}" height="${size}" alt="" style="border-radius:${Math.round(size * 0.25)}px" />`;

  const subjectLabel = (s) => (s ? `<span class="row" style="gap:6px;--c:${s.color}"><span class="chip-dot" style="width:8px;height:8px;border-radius:50%;background:${s.color};flex:none"></span>${U.esc(s.name)}</span>` : '');

  TI.ui = Object.assign(TI.ui || {}, { ring, bar, barRow, dateStrip, seg, empty, kpi, colorPicker, crown, logo, subjectLabel });
})(window.TI);
