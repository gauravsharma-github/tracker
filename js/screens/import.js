// Opens a template share link (#/import?t=…): preview and import it as a new project.
(function (TI) {
  const U = TI.util;
  const { state, sel } = TI.store;
  let job = { key: null, status: 'idle', tree: null, name: '', error: '' };

  function load(payload) {
    job = { key: payload, status: 'loading', tree: null, name: '', error: '' };
    TI.shareTpl.unpack(payload)
      .then((text) => {
        const u = TI.outline.unwrap(TI.outline.parse(text));
        if (!u.subjects.length) throw new Error('The link has no subjects in it.');
        Object.assign(job, { status: 'ready', tree: u.subjects, name: u.name || 'Shared template', sources: u.sources || [] });
      })
      .catch((e) => Object.assign(job, { status: 'error', error: e.message || 'This link could not be read.' }))
      .finally(() => TI.store.bump());
  }

  function tree(nodes, depth) {
    return nodes.map((n) => `<div class="tp-node d${Math.min(depth, 3)}">${depth === 0 ? U.icon('folder', 'xs') : depth === 1 ? U.icon('chevron_right', 'xs') : '<span class="tp-dot"></span>'}<span>${U.esc(n.title)}</span>${n.done ? U.icon('check', 'xs') : ''}</div>${n.children.length ? tree(n.children, depth + 1) : ''}`).join('');
  }

  const screen = {
    title: 'Import template',
    render(ctx) {
      const t = ctx.query.t;
      const head = `<div class="topbar"><button class="icon-btn" data-act="nav" data-to="/" aria-label="Close">${U.icon('close')}</button><h1 class="grow">Import template</h1></div>`;
      if (!t) return head + TI.ui.empty('link_off', 'No template in this link', 'Ask your friend to share the link again, or the .json file.');
      if (job.key !== t) load(t);
      if (job.status === 'loading') return head + `<div class="boot">Opening the template…</div>`;
      if (job.status === 'error') return head + TI.ui.empty('error', 'Could not open this template', U.esc(job.error), '<button class="btn primary" data-act="nav" data-to="/templates">Go to templates</button>');
      const c = TI.outline.count(job.tree);
      const done = (() => { let n = 0; const w = (a) => a.forEach((x) => { if (x.done) n++; w(x.children); }); w(job.tree); return n; })();
      const limit = !sel.canAddProject();
      return `${head}
        <div class="tpl-preview-grid">
          <div class="card tpl-hero" style="--g1:#264AFF;--g2:#5A74FF">
            <div class="tpl-hero-band"><span class="tt-ic">${U.icon('group')}</span><span>Shared with you</span></div>
            <h2>${U.esc(job.name)}</h2>
            <div class="tpl-stats"><div><b>${c.top}</b><span>Subjects</span></div><div><b>${c.units}</b><span>Units</span></div><div><b>${c.leaves}</b><span>Topics</span></div></div>
            ${done ? `<div class="small muted" style="margin-top:10px">${U.icon('task_alt', 'xs')} Includes ${U.plural(done, 'completed topic')}</div>` : ''}
            <div class="field" style="margin-top:16px"><label>Project name</label><input class="input" id="imp-name" value="${U.esc(job.name)}" /></div>
            <div class="field"><label>Type</label><select class="select" id="imp-cat">${TI.config.projectCategories.map((x) => `<option value="${x.id}" ${x.id === 'custom' ? 'selected' : ''}>${x.label}</option>`).join('')}</select></div>
            <button class="btn primary block lg" data-act="imp-go">${U.icon(limit ? 'crown' : 'download')}${limit ? 'Upgrade to import' : 'Import & start tracking'}</button>
          </div>
          <div class="card"><div class="card-head"><h3>What's inside</h3></div><div class="tp-tree">${tree(job.tree, 0)}</div></div>
        </div>`;
    },
    actions: {
      'imp-go': () => {
        if (job.status !== 'ready') return;
        const name = (document.getElementById('imp-name') || {}).value || job.name;
        const cat = (document.getElementById('imp-cat') || {}).value || 'custom';
        const tree = job.tree; const sources = job.sources;
        job = { key: null, status: 'idle' };
        TI.screens.templates.createFrom(name.trim() || 'Shared template', cat, tree, null, sources);
      },
    },
  };
  TI.screens.import = screen;
})(window.TI);
