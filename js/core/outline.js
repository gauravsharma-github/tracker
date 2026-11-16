// Parses syllabus outlines and flashcard lists that people paste in (often from ChatGPT / Gemini).
// Outline input: indented text, Markdown bullets/numbers/headings, "[x]" checkboxes, or JSON.
// Output: [{ title, done, children: [...] }] where the top level is subjects.
(function (TI) {
  const TITLE_KEYS = ['title', 'name', 'subject', 'unit', 'chapter', 'topic', 'label', 'text'];
  const CHILD_KEYS = ['children', 'subjects', 'units', 'chapters', 'topics', 'subtopics', 'items', 'sections', 'modules', 'lessons'];

  function cleanText(s) {
    return s
      .replace(/\*\*|__|`/g, '')
      .replace(/^\s*[:\-–—]\s*/, '')
      .replace(/\s*:\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function fromJson(v) {
    const toNode = (x) => {
      if (x == null) return null;
      if (typeof x === 'string' || typeof x === 'number') return { title: cleanText(String(x)), done: false, children: [] };
      if (Array.isArray(x)) return null;
      const key = TITLE_KEYS.find((k) => typeof x[k] === 'string');
      const ck = CHILD_KEYS.find((k) => Array.isArray(x[k]));
      const title = key ? cleanText(x[key]) : '';
      const children = ck ? x[ck].map(toNode).filter(Boolean) : [];
      if (!title && children.length) return { title: 'Untitled', done: false, children };
      if (!title) return null;
      return { title, done: !!(x.done || x.completed), children };
    };
    if (Array.isArray(v)) return v.map(toNode).filter(Boolean);
    const ck = CHILD_KEYS.find((k) => Array.isArray(v[k]));
    if (ck) return v[ck].map(toNode).filter(Boolean);
    const n = toNode(v);
    return n ? [n] : [];
  }

  function fromLines(text) {
    const raw = text.replace(/\r/g, '').split('\n');
    const lines = [];
    let inFence = false;
    for (let line of raw) {
      if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
      line = line.replace(/\t/g, '    ');
      if (!line.trim()) continue;
      const h = line.match(/^\s*(#{1,6})\s+(.*)$/);
      if (h) { lines.push({ kind: 'h', h: h[1].length, text: h[2] }); continue; }
      const m = line.match(/^(\s*)(?:([-*+•●◦▪▸➤]|\d{1,3}[.)]|[a-zA-Z][.)](?=\s)|[ivxIVX]{1,4}[.)](?=\s))\s+)?(?:\[( |x|X)\]\s*)?(.*)$/);
      if (!m) continue;
      const indent = m[1].length; const marker = m[2]; const box = m[3]; let t = m[4];
      if (!t.trim()) continue;
      // Skip chatty preamble lines such as "Here is your syllabus:"
      if (!marker && indent === 0 && /^(sure|here|below|certainly|of course|this|i have|i've)\b/i.test(t.trim()) && t.length > 18) continue;
      lines.push({ kind: 'b', indent, marker: !!marker, done: box === 'x' || box === 'X', text: t });
    }
    // Heading levels → depth ranks; bullet indents → ranks
    const hLevels = [...new Set(lines.filter((l) => l.kind === 'h').map((l) => l.h))].sort((a, b) => a - b);
    const indents = [...new Set(lines.filter((l) => l.kind === 'b').map((l) => l.indent))].sort((a, b) => a - b);
    const items = [];
    let headDepth = -1;
    for (const l of lines) {
      let depth;
      if (l.kind === 'h') { depth = hLevels.indexOf(l.h); headDepth = depth; } else depth = headDepth + 1 + indents.indexOf(l.indent);
      const title = cleanText(l.text);
      if (title) items.push({ depth, title, done: !!l.done });
    }
    const roots = []; const stack = [];
    for (const it of items) {
      let d = Math.min(it.depth, stack.length);
      stack.length = d;
      const node = { title: it.title, done: it.done, children: [] };
      if (d === 0) roots.push(node); else stack[d - 1].children.push(node);
      stack[d] = node;
    }
    return roots;
  }

  function parse(text) {
    const t = String(text || '').trim();
    if (!t) return [];
    if (/^[[{]/.test(t)) {
      try { return fromJson(JSON.parse(t)); } catch (e) { /* fall back to lines */ }
    }
    const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced && /^[[{]/.test(fenced[1].trim())) { try { return fromJson(JSON.parse(fenced[1].trim())); } catch (e) { /* ignore */ } }
    return fromLines(t);
  }

  function count(tree) {
    let nodes = 0; let leaves = 0;
    const walk = (arr) => arr.forEach((n) => { nodes++; if (!n.children.length) leaves++; walk(n.children); });
    walk(tree);
    return { top: tree.length, nodes, leaves, units: tree.reduce((a, s) => a + s.children.length, 0) };
  }

  function toText(tree, depth = 0) {
    return tree.map((n) => '  '.repeat(depth) + n.title + (n.children.length ? '\n' + toText(n.children, depth + 1) : '')).join('\n');
  }

  // ---------- Flashcards ----------
  function parseCards(text) {
    const t = String(text || '').trim();
    if (!t) return [];
    const tryJson = (s) => {
      try {
        const v = JSON.parse(s); const arr = Array.isArray(v) ? v : v.cards || v.flashcards || [];
        return arr.map((c) => ({
          front: String(c.front ?? c.q ?? c.question ?? c.term ?? c.prompt ?? '').trim(),
          back: String(c.back ?? c.a ?? c.answer ?? c.definition ?? c.response ?? '').trim(),
        })).filter((c) => c.front && c.back);
      } catch (e) { return null; }
    };
    if (/^[[{]/.test(t)) { const r = tryJson(t); if (r) return r; }
    const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) { const r = tryJson(fenced[1].trim()); if (r && r.length) return r; }

    const lines = t.replace(/\r/g, '').split('\n');
    // Q:/A: blocks
    if (lines.some((l) => /^\s*(Q|Question)\s*[:.)-]/i.test(l))) {
      const out = []; let cur = null; let side = null;
      for (const l of lines) {
        const q = l.match(/^\s*(?:\d+[.)]\s*)?(?:Q|Question)\s*[:.)-]\s*(.*)$/i);
        const a = l.match(/^\s*(?:A|Answer|Ans)\s*[:.)-]\s*(.*)$/i);
        if (q) { if (cur && cur.front && cur.back) out.push(cur); cur = { front: q[1], back: '' }; side = 'front'; } else if (a && cur) { cur.back = a[1]; side = 'back'; } else if (cur && l.trim()) { cur[side] += '\n' + l.trim(); }
      }
      if (cur && cur.front && cur.back) out.push(cur);
      return out.map((c) => ({ front: c.front.trim(), back: c.back.trim() }));
    }
    const seps = ['::', '\t', ' | ', ' — ', ' – ', ' = ', ' - ', ';', ','];
    const sep = seps.find((s) => lines.filter((l) => l.includes(s)).length >= Math.max(1, Math.ceil(lines.filter((l) => l.trim()).length * 0.6)));
    if (!sep) return [];
    return lines.map((l) => {
      const clean = l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '');
      const i = clean.indexOf(sep); if (i < 0) return null;
      const unq = (s) => s.trim().replace(/^"(.*)"$/, '$1').replace(/\*\*/g, '');
      return { front: unq(clean.slice(0, i)), back: unq(clean.slice(i + sep.length)) };
    }).filter((c) => c && c.front && c.back);
  }

  const aiPrompt = (topic) => `Create a complete study syllabus for "${topic || '[exam or project name]'}".
Return ONLY an indented plain-text outline (2 spaces per level), no numbering, no extra text.
Level 1 = subjects, level 2 = units or chapters, level 3 = topics.
Example:
Physics
  Kinematics
    Motion in a straight line
    Projectile motion`;

  const aiCardsPrompt = (topic, n = 20) => `Make ${n} flashcards for studying "${topic || '[topic]'}".
Return ONLY one card per line in the format:
question :: answer
Keep answers short (one sentence).`;

  TI.outline = { parse, count, toText, parseCards, aiPrompt, aiCardsPrompt };
})(window.TI);
