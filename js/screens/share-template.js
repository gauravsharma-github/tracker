// Share Template: preview a project's syllabus and share it as a .json file, JSON code or a link.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  const open = new Set();
  let withProgress = false;

  function tree(nodes, depth) {
    return nodes.map((n) => `<div class="tp-node d${Math.min(depth, 3)}">${depth === 1 ? U.icon('chevron_right', 'xs') : '<span class="tp-dot"></span>'}<span>${U.esc(n.title)}</span></div>${n.child.length ? tree(n.child, depth + 1) : ''}`).join('');
  }

  const screen = {
    title: 'Share Template',
    render(ctx) {
      const p = sel.project(ctx.params[0]) || sel.activeProject();
      if (!p) return TI.ui.empty('file_copy', 'No project to share', 'Create an exam or project first.', '<button class="btn primary" data-act="nav" data-to="/templates">Add exam / project</button>');
      const obj = TI.shareTpl.projectJson(p.id, { withProgress });
      const c = TI.shareTpl.counts(obj);
      const projects = sel.projects();
      return `<div class="topbar"><button class="icon-btn" data-act="back" aria-label="Back">${U.icon('arrow_back')}</button><h1 class="grow">Share Template</h1>
          <div class="actions desktop-only">${TI.ui.seg([{ id: 'progress', label: 'Progress' }, { id: 'template', label: 'Template' }], 'template', 'share-tab', 'alt')}</div></div>
        <div class="st-grid">
          <div class="card st-preview">
            <div class="st-head"><div class="grow" style="min-width:0"><h2 class="ellipsis">${U.esc(p.name)}</h2><div class="small muted">${U.plural(c.topics, 'topic')} · ${U.plural(c.subjects, 'subject')}</div></div>
              ${projects.length > 1 ? `<select class="select st-pick" data-change="st-project" aria-label="Project">${projects.map((x) => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select>` : ''}</div>
            <div class="st-list">${obj.child.length ? obj.child.map((s, i) => {
              const isOpen = open.has(p.id + ':' + i);
              return `<div class="st-subj">
                <button class="st-plus ${isOpen ? 'on' : ''}" data-act="st-toggle" data-key="${p.id}:${i}" aria-expanded="${isOpen}" aria-label="${isOpen ? 'Hide' : 'Show'} topics in ${U.esc(s.title)}">${U.icon(isOpen ? 'remove' : 'add')}</button>
                <div class="grow" style="min-width:0"><button class="st-title" data-act="st-toggle" data-key="${p.id}:${i}">${U.esc(s.title)}</button>
                  <div class="tiny faint">${U.plural(TI.shareTpl.counts({ child: [s] }).topics, 'topic')}</div>
                  ${isOpen ? `<div class="tp-tree st-tree">${s.child.length ? tree(s.child, 1) : '<div class="small faint">No topics yet</div>'}</div>` : ''}</div></div>`;
            }).join('') : '<div class="tree-empty">This project has no subjects yet.</div>'}</div>
          </div>
          <div class="st-actions">
            <button class="share-act" data-act="st-file" data-id="${p.id}">${U.icon('description', 'fill')}<span class="grow"><b>Share Template as File</b><span>Share your template as a .json file</span></span>${U.icon('chevron_right')}</button>
            <button class="share-act" data-act="st-copy" data-id="${p.id}">${U.icon('content_copy')}<span class="grow"><b>Copy JSON code</b><span>Copy the template's JSON code</span></span>${U.icon('chevron_right')}</button>
            <button class="share-act" data-act="st-link" data-id="${p.id}">${U.icon('link')}<span class="grow"><b>Get share link</b><span>Generate a link that opens this template in TrackIt</span></span>${U.icon('chevron_right')}</button>
            <label class="share-act toggle"><span class="ms">task_alt</span><span class="grow"><b>Include my progress</b><span>Completed topics stay ticked after import. Off = a clean template.</span></span>
              <span class="switch"><input type="checkbox" data-change="st-progress" ${withProgress ? 'checked' : ''} /><span></span></span></label>
            <p class="small faint">Friends import it under <b>Templates › From a friend</b> (file or JSON code), or just open the link. The file uses the same format as the TrackIt app.</p>
          </div>
        </div>`;
    },
    actions: {
      'st-toggle': (el) => { const k = el.dataset.key; if (open.has(k)) open.delete(k); else open.add(k); TI.store.bump(); },
      'st-file': (el) => TI.shareTpl.shareFile(el.dataset.id, { withProgress }),
      'st-copy': (el) => TI.shareTpl.copyJson(el.dataset.id, { withProgress }),
      'st-link': (el) => TI.shareTpl.showLink(el.dataset.id, { withProgress }),
      'share-tab': (el) => { if (el.dataset.v === 'progress') TI.router.go('/share', { replace: true }); },
    },
    changes: {
      'st-project': (el) => TI.router.go('/share-template/' + el.value, { replace: true }),
      'st-progress': (el) => { withProgress = el.checked; TI.store.bump(); },
    },
  };
  TI.screens['share-template'] = screen;
})(window.TI);
