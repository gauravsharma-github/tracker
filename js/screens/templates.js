// "Add Exam/Project": template library, preview + import, AI outline import, shared templates, blank.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  const catOf = (id) => TI.config.projectCategories.find((c) => c.id === id) || TI.config.projectCategories[3];
  const parsed = {};
  const treeOf = (t) => (parsed[t.id] = parsed[t.id] || TI.outline.parse(t.outline));

  function previewTree(tree, max = 400) {
    let n = 0;
    const walk = (arr, depth) => arr.map((x) => { if (n++ > max) return ''; return `<div class="tp-node d${Math.min(depth, 3)}">${depth === 0 ? U.icon('folder', 'xs') : depth === 1 ? U.icon('chevron_right', 'xs') : '<span class="tp-dot"></span>'}<span>${U.esc(x.title)}</span></div>${x.children.length ? walk(x.children, depth + 1) : ''}`; }).join('');
    return `<div class="tp-tree">${walk(tree, 0)}</div>`;
  }

  function checkLimit() { if (!sel.canAddProject()) { TI.screens.pro.open('projects'); return false; } return true; }

  function createFrom(name, category, tree, templateId = null) {
    if (!checkLimit()) return;
    if (!tree.length) { TI.ui.toast('Nothing to import', { icon: 'error' }); return; }
    const p = actions.importProject({ name, category, tree, templateId });
    const c = TI.outline.count(tree);
    TI.ui.toast(`${p.name} added · ${c.top} subjects, ${c.leaves} topics`, { icon: 'check_circle', duration: 4000 });
    TI.router.go('/project');
  }

  function aiSheet(mode = 'ai') {
    let tree = [];
    const shared = mode === 'shared';
    TI.ui.openSheet({
      title: shared ? 'Import a shared template' : 'Generate a template with AI', size: 'lg',
      html: `${shared ? `<div class="row wrap" style="margin-bottom:12px"><p class="muted small grow" style="min-width:220px">Open the <b>.json file</b> a friend shared, or paste the JSON code (an indented outline works too). Share links open TrackIt directly.</p><button class="btn sm" data-act="file">${U.icon('upload_file')}Open .json file</button></div>` : `<div class="ai-steps">
          <div class="ai-step"><span class="n">1</span><div class="grow"><b>Name your exam or project</b>
            <div class="row" style="margin-top:8px"><input class="input" id="ai-name" placeholder="e.g. AWS Solutions Architect, MBBS 2nd year" style="min-height:40px" /><button class="btn sm" data-act="copy">${U.icon('content_copy')}Copy prompt</button></div>
            <div class="small muted" style="margin-top:6px">Paste the prompt into ChatGPT, Gemini or Claude.</div></div></div>
          <div class="ai-step"><span class="n">2</span><div class="grow"><b>Paste the answer below</b><div class="small muted">Indented lists, Markdown bullets, numbered lists, headings or JSON all work.</div></div></div></div>`}
        <textarea class="textarea mono" id="ai-text" rows="9" placeholder="Physics\n  Kinematics\n    Motion in a straight line\n  Laws of Motion\nChemistry\n  Atomic Structure"></textarea>
        <div id="ai-preview" class="ai-preview"><div class="small muted">The preview appears here.</div></div>
        <div class="field-row" style="margin-top:12px"><div class="field"><label>Project name</label><input class="input" id="ai-pname" placeholder="Project name" /></div>
        <div class="field"><label>Type</label><select class="select" id="ai-cat">${TI.config.projectCategories.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}</select></div></div>`,
      footer: '<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-act="create" disabled>Create project</button>',
      onMount(a) {
        const $ = (q) => a.el.querySelector(q);
        const ta = $('#ai-text');
        const update = () => {
          let txt = ta.value; let name = null; let cat = null;
          try { const j = JSON.parse(txt.trim()); if (j && j.trackitTemplate) { name = j.name; cat = j.category; txt = j.outline; } } catch (e) { /* not a share code */ }
          tree = TI.outline.parse(txt);
          if (name && !$('#ai-pname').value) $('#ai-pname').value = name;
          if (cat) $('#ai-cat').value = cat;
          const u = TI.outline.unwrap(tree); const wrapped = !!u.name;
          const shown = u.subjects;
          if (wrapped && !$('#ai-pname').value) $('#ai-pname').value = u.name;
          const c = TI.outline.count(shown);
          $('#ai-preview').innerHTML = tree.length ? `<div class="row small" style="margin-bottom:8px">${U.icon('check_circle', 'xs')}${wrapped ? `<b>${U.esc(tree[0].title)}</b> ·` : ''} <b>${U.plural(c.top, 'subject')}</b> · ${U.plural(c.units, 'unit')} · ${U.plural(c.leaves, 'topic')}</div>${previewTree(shown, 120)}` : '<div class="small muted">Nothing recognised yet.</div>';
          $('[data-act="create"]').disabled = !tree.length;
        };
        ta.addEventListener('input', update);
        const nm = $('#ai-name'); if (nm) nm.addEventListener('input', () => { $('#ai-pname').value = nm.value; });
        setTimeout(() => (nm || ta).focus(), 60);
        TI.forms.onAct(a, {
          async copy() { const ok = await U.copy(TI.outline.aiPrompt($('#ai-name').value.trim())); TI.ui.toast(ok ? 'Prompt copied' : 'Could not copy', { icon: ok ? 'content_copy' : 'error' }); },
          create() {
            // A single top-level item (e.g. the exam name) wrapping the subjects is unwrapped
            const u = TI.outline.unwrap(tree);
            const name = $('#ai-pname').value.trim() || u.name || 'My project';
            a.close(); createFrom(name, $('#ai-cat').value, u.subjects);
          },
          async file() {
            const f = await U.pickFile('.json,application/json,.txt,text/plain'); if (!f) return;
            try { ta.value = await U.readFile(f); update(); } catch (e) { TI.ui.toast('Could not read that file', { icon: 'error' }); }
          },
        });
      },
    });
  }

  function list(ctx) {
    const q = (state.ui.tplQuery || '').toLowerCase();
    const cat = state.ui.tplCat || '';
    let items = TI.templates.filter((t) => (!cat || t.cat === cat) && (!q || (t.name + ' ' + t.desc + ' ' + t.outline).toLowerCase().includes(q)));
    if (q) items.sort((a, b) => (b.name.toLowerCase().includes(q) - a.name.toLowerCase().includes(q)));
    const tiles = TI.config.projectCategories.filter((c) => c.id !== 'custom');
    return `<div class="topbar"><button class="icon-btn" data-act="back" aria-label="Back">${U.icon('arrow_back')}</button><h1 class="grow">Add Exam/Project</h1></div>
      <div class="input-icon tpl-search">${U.icon('search')}<input class="input" placeholder="Search for exams, subjects or projects" value="${U.esc(state.ui.tplQuery || '')}" data-input="tpl-search" /></div>
      <div class="tpl-tiles">
        ${tiles.map((c) => `<button class="tpl-tile ${cat === c.id ? 'on' : ''}" style="--g1:${c.grad[0]};--g2:${c.grad[1]}" data-act="tpl-cat" data-v="${c.id}"><span class="tt-ic">${U.icon(c.icon, 'sm')}</span><span>${c.label}</span></button>`).join('')}
        <button class="tpl-tile" style="--g1:#1F9E86;--g2:#3CC2A8" data-act="tpl-ai"><span class="tt-ic">${U.icon('auto_awesome', 'sm')}</span><span>AI generator</span></button>
        <button class="tpl-tile" style="--g1:#3A3F4E;--g2:#555B6E" data-act="tpl-shared"><span class="tt-ic">${U.icon('group', 'sm')}</span><span>From a friend</span></button>
        <button class="tpl-tile" style="--g1:#2A2E3A;--g2:#3B4050" data-act="new-project"><span class="tt-ic">${U.icon('add', 'sm')}</span><span>Blank</span></button>
      </div>
      ${cat ? `<div class="row small muted" style="margin:4px 0 6px">Showing ${catOf(cat).label} templates <button class="btn sm ghost" data-act="tpl-cat" data-v="${cat}">Clear</button></div>` : ''}
      <div class="tpl-list">${items.map((t) => { const c = catOf(t.cat); const n = TI.outline.count(treeOf(t)); return `<button class="tpl-row" data-act="nav" data-to="/templates/${t.id}" style="--c:${c.grad[0]}">
          <span class="color-sq"></span><span class="grow" style="min-width:0"><span class="tpl-name">${U.esc(t.name)}</span><span class="tpl-desc">${U.esc(t.desc)}</span></span><span class="tpl-count desktop-only">${n.top} subjects · ${n.leaves} topics</span>${U.icon('chevron_right', 'faint')}</button>`; }).join('')}
        ${items.length ? '' : TI.ui.empty('search_off', 'No template found', 'Generate one with AI in under a minute.', '<button class="btn primary" data-act="tpl-ai">Use AI generator</button>')}</div>
      <div class="card tip-card" style="margin-top:18px"><div class="row">${U.icon('auto_awesome', 'faint')}<div class="grow small muted">The real app ships with 1000+ templates; this demo includes ${TI.templates.length}. Any syllabus can be generated with ChatGPT or Gemini and pasted in.</div><button class="btn sm" data-act="tpl-ai">Try it</button></div></div>`;
  }

  function preview(ctx) {
    const t = TI.templates.find((x) => x.id === ctx.params[0]);
    if (!t) return TI.ui.empty('search_off', 'Template not found');
    const tree = treeOf(t); const c = TI.outline.count(tree); const cat = catOf(t.cat);
    const exists = state.projects.some((p) => p.templateId === t.id);
    return `<div class="topbar"><button class="icon-btn" data-act="back" aria-label="Back">${U.icon('arrow_back')}</button><h1 class="grow ellipsis">${U.esc(t.name)}</h1></div>
      <div class="tpl-preview-grid">
        <div class="card tpl-hero" style="--g1:${cat.grad[0]};--g2:${cat.grad[1]}">
          <div class="tpl-hero-band"><span class="tt-ic">${U.icon(cat.icon)}</span><span>${cat.label}</span></div>
          <h2>${U.esc(t.name)}</h2><p class="muted">${U.esc(t.desc)}</p>
          <div class="tpl-stats"><div><b>${c.top}</b><span>Subjects</span></div><div><b>${c.units}</b><span>Units</span></div><div><b>${c.leaves}</b><span>Topics</span></div></div>
          <div class="field" style="margin-top:16px"><label>Project name</label><input class="input" id="tpl-name" value="${U.esc(t.name)}" /></div>
          <button class="btn primary block lg" data-act="tpl-import" data-id="${t.id}">${U.icon('download')}Import & start tracking</button>
          ${exists ? '<div class="small muted center" style="margin-top:8px">You already imported this once – importing again creates a copy.</div>' : ''}
          <button class="btn ghost block" style="margin-top:8px" data-act="tpl-copy" data-id="${t.id}">${U.icon('content_copy')}Copy outline</button>
        </div>
        <div class="card"><div class="card-head"><h3>What's inside</h3></div>${previewTree(tree)}</div>
      </div>`;
  }

  const screen = {
    title: 'Templates',
    render(ctx) { return ctx.params[0] ? preview(ctx) : list(ctx); },
    mount(root, ctx) { if (ctx.query.ai && !screen._aiShown) { screen._aiShown = true; setTimeout(() => aiSheet('ai'), 50); } if (!ctx.query.ai) screen._aiShown = false; },
    actions: {
      'tpl-cat': (el) => actions.setUi({ tplCat: state.ui.tplCat === el.dataset.v ? '' : el.dataset.v }),
      'tpl-ai': () => aiSheet('ai'),
      'tpl-shared': () => aiSheet('shared'),
      'tpl-import': (el) => { const t = TI.templates.find((x) => x.id === el.dataset.id); const name = (document.getElementById('tpl-name') || {}).value || t.name; createFrom(name.trim() || t.name, t.cat, treeOf(t), t.id); },
      'tpl-copy': async (el) => { const t = TI.templates.find((x) => x.id === el.dataset.id); const ok = await U.copy(TI.outline.toText(treeOf(t))); TI.ui.toast(ok ? 'Outline copied' : 'Could not copy', { icon: 'content_copy' }); },
    },
    inputs: { 'tpl-search': (el) => actions.setUi({ tplQuery: el.value }) },
    aiSheet,
    createFrom,
  };
  TI.screens.templates = screen;
})(window.TI);
