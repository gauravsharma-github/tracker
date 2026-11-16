// SVG charts (no library): stacked bars, area line, heatmap and month calendar.
(function (TI) {
  const U = TI.util;

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = 10 ** Math.floor(Math.log10(v)); const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }

  // series: [{ name, color, values: [seconds per label] }]
  function barChart({ labels, series, height = 210, width = 720, fmtLabel = (l) => l, highlight = -1 }) {
    const n = labels.length; const padL = 40; const padB = 26; const padT = 10; const padR = 6;
    const plotW = width - padL - padR; const plotH = height - padT - padB;
    const totals = labels.map((_, i) => U.sum(series, (s) => s.values[i] || 0));
    const peakH = Math.max(...totals, 600) / 3600;
    const stepH = [0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100].find((x) => x * 4 >= peakH) || Math.ceil(peakH / 4);
    const maxH = stepH * 4;
    const max = maxH * 3600;
    const fmtH = (v) => (v === 0 ? '0' : v < 1 ? `${Math.round(v * 60)}m` : `${+v.toFixed(2)}h`);
    const step = plotW / n; const bw = Math.max(4, Math.min(34, step * 0.62));
    const every = Math.ceil(n / 14);
    let svg = `<svg class="chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img">`;
    svg += '<g class="grid">';
    for (let g = 0; g <= 4; g++) {
      const y = padT + plotH - (plotH * g) / 4; const val = (maxH * g) / 4;
      svg += `<line x1="${padL}" x2="${width - padR}" y1="${y}" y2="${y}" ${g ? 'stroke-dasharray="3 4"' : ''}/>`;
      svg += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end">${fmtH(val)}</text>`;
    }
    svg += '</g>';
    labels.forEach((l, i) => {
      const x = padL + step * i + (step - bw) / 2; let y = padT + plotH;
      series.forEach((s) => {
        const v = s.values[i] || 0; if (!v) return;
        const h = Math.max(1.5, (v / max) * plotH); y -= h;
        svg += `<rect class="bar-rect" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${s.color}" ${highlight >= 0 && i !== highlight ? 'opacity=".55"' : ''}><title>${U.esc(fmtLabel(l))} · ${U.esc(s.name)}: ${U.fmtDur(v)}</title></rect>`;
      });
      if (!totals[i]) svg += `<rect x="${x.toFixed(1)}" y="${padT + plotH - 2}" width="${bw.toFixed(1)}" height="2" rx="1" fill="var(--track)"/>`;
      if (i % every === 0 || i === n - 1) svg += `<text x="${(padL + step * i + step / 2).toFixed(1)}" y="${height - 6}" text-anchor="middle" ${i === highlight ? 'style="fill:var(--text);font-weight:600"' : ''}>${U.esc(fmtLabel(l, i))}</text>`;
    });
    return svg + '</svg>';
  }

  function areaChart({ labels, values, color = 'var(--primary)', height = 170, width = 720, fmt = (v) => U.pctInt(v), fmtLabel = (l) => l }) {
    const n = values.length; const padL = 40; const padB = 26; const padT = 12; const padR = 8;
    const plotW = width - padL - padR; const plotH = height - padT - padB;
    const max = Math.max(niceMax(Math.max(...values, 0.01) * 1.1), 0.1);
    const X = (i) => padL + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));
    const Y = (v) => padT + plotH - (v / max) * plotH;
    const pts = values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const gid = 'g' + Math.random().toString(36).slice(2, 7);
    const every = Math.ceil(n / 8);
    let svg = `<svg class="chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><g class="grid">`;
    for (let g = 0; g <= 4; g++) { const y = padT + plotH - (plotH * g) / 4; svg += `<line x1="${padL}" x2="${width - padR}" y1="${y}" y2="${y}" ${g ? 'stroke-dasharray="3 4"' : ''}/><text x="${padL - 8}" y="${y + 4}" text-anchor="end">${fmt((max * g) / 4)}</text>`; }
    svg += '</g>';
    svg += `<polygon points="${X(0)},${padT + plotH} ${pts} ${X(n - 1)},${padT + plotH}" fill="url(#${gid})"/>`;
    svg += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    svg += `<circle cx="${X(n - 1)}" cy="${Y(values[n - 1])}" r="4.5" fill="${color}" stroke="var(--surface)" stroke-width="2"/>`;
    labels.forEach((l, i) => { if (i % every === 0 || i === n - 1) svg += `<text x="${X(i)}" y="${height - 6}" text-anchor="middle">${U.esc(fmtLabel(l))}</text>`; });
    return svg + '</svg>';
  }

  // GitHub-style heatmap of study minutes
  function heatmap({ fn, weeks = 22, weekStart = 1 }) {
    const today = U.startOfDay();
    const offset = (today.getDay() - weekStart + 7) % 7;
    const start = U.addDays(today, -(weeks - 1) * 7 - offset);
    const cells = [];
    for (let i = 0; i < weeks * 7; i++) {
      const d = U.addDays(start, i); const k = U.dayKey(d);
      if (d > today) { cells.push('<div class="cell future"></div>'); continue; }
      const sec = fn(k); const m = sec / 60;
      const l = m === 0 ? '' : m < 30 ? 'l1' : m < 90 ? 'l2' : m < 180 ? 'l3' : 'l4';
      cells.push(`<div class="cell ${l} ${k === U.today() ? 'today' : ''}" title="${U.fmtDay(k)} · ${U.fmtDur(sec)}"></div>`);
    }
    return `<div class="heatmap">${cells.join('')}</div>
      <div class="row small faint" style="justify-content:flex-end;gap:6px;margin-top:8px">Less <span class="heatmap" style="grid-template-rows:1fr;display:inline-grid"><span class="cell"></span><span class="cell l1"></span><span class="cell l2"></span><span class="cell l3"></span><span class="cell l4"></span></span> More</div>`;
  }

  function monthGrid({ year, month, fn, weekStart = 1, act = 'cal-day' }) {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() - weekStart + 7) % 7;
    const start = U.addDays(first, -offset);
    const wds = [...Array(7)].map((_, i) => U.WD[(i + weekStart) % 7].slice(0, 2));
    let html = `<div class="month">${wds.map((w) => `<div class="wd">${w}</div>`).join('')}`;
    for (let i = 0; i < 42; i++) {
      const d = U.addDays(start, i); const k = U.dayKey(d);
      if (i >= 35 && d.getMonth() !== month) break;
      const sec = d > new Date() ? 0 : fn(k); const m = sec / 60;
      const l = m === 0 ? '' : m < 30 ? 'l1' : m < 90 ? 'l2' : m < 180 ? 'l3' : 'l4';
      html += `<button class="mday ${l} ${d.getMonth() !== month ? 'out' : ''} ${k === U.today() ? 'today' : ''}" data-act="${act}" data-day="${k}" title="${U.fmtDay(k)} · ${U.fmtDur(sec)}"><span>${d.getDate()}</span><span class="mt">${sec ? U.fmtHM(sec) : ''}</span></button>`;
    }
    return html + '</div>';
  }

  TI.charts = { barChart, areaChart, heatmap, monthGrid, niceMax };
})(window.TI);
