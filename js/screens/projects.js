// Manage exams / projects and their subjects: edit, reorder, archive, share as template, delete.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  const catOf = (id) => TI.config.projectCategories.find((c) => c.id === id) || TI.config.projectCategories[3];

  function projectRow(p) {
    const st = TI.stats; const active = sel.activeProject() && sel.activeProject().id === p.id;
    return `<div class="proj-row ${p.archived ? 'archived' : ''}" style="--c:${p.color}">
      ${TI.ui.ring(st.projectRatio(state, p.id), p.color, { size: 52, stroke: 5 })}
      <div class="grow" style="min-width:0"><div class="row" style="gap:8px"><b class="ellipsis">${U.esc(p.name)}</b>${active ? '<span class="badge blue">Active</span>' : ''}${p.archived ? '<span class="badge">Archived</span>' : ''}</div>
        <div class="small muted">${catOf(p.category).label} · ${U.plural(sel.subjects(p.id).length, 'subject')} · ${U.fmtDur(st.projectTime(state, p.id), { noDays: true })} studied</div></div>
      ${!active && !p.archived ? `<button class="btn sm" data-act="proj-open" data-id="${p.id}">Open</button>` : ''}
      <button class="icon-btn muted" data-act="proj-menu" data-id="${p.id}" aria-label="More">${U.icon('more_vert')}</button>
    </div>`;
  }

  const screen = {
    title: 'Projects',
    render(ctx) {
      const all = sel.projects(true);
      const active = sel.activeProject();
      const subjects = active ? sel.subjects(active.id) : [];
      const limit = TI.config.limits;
      return `<div class="topbar"><button class="icon-btn" data-act="back" aria-label="Back">${U.icon('arrow_back')}</button><h1 class="grow">Exams &amp; projects</h1>
          <div class="actions"><button class="btn primary sm" data-act="nav" data-to="/templates">${U.icon('add')}Add</button></div></div>
        <div class="proj-grid">
          <div>
            <div class="set-group-title">All projects ${sel.isPro() ? '' : `<span class="faint" style="text-transform:none;letter-spacing:0;font-weight:500">· ${all.filter((p) => !p.archived).length}/${limit.projects} on the free plan</span>`}</div>
            <div class="card flat proj-list">${all.map(projectRow).join('') || TI.ui.empty('folder_open', 'No projects yet')}</div>
          </div>
          ${active ? `<div>
            <div class="set-group-title">Subjects in ${U.esc(active.name)}</div>
            <div class="card flat proj-list">${subjects.map((s, i) => `<div class="proj-row" style="--c:${s.color}"><span class="color-sq" style="width:16px;height:16px;border-radius:5px"></span>
              <div class="grow" style="min-width:0"><b class="ellipsis" style="display:block">${U.esc(s.name)}</b><div class="small muted">${TI.stats.partsDone(state, s.id)} parts · ${U.fmtDur(TI.stats.subjectTime(state, s.id), { noDays: true })}</div></div>
              <button class="icon-btn sm muted" data-act="subj-up" data-id="${s.id}" ${i === 0 ? 'disabled style="opacity:.3"' : ''} aria-label="Move up">${U.icon('arrow_upward')}</button>
              <button class="icon-btn sm muted" data-act="subj-down" data-id="${s.id}" ${i === subjects.length - 1 ? 'disabled style="opacity:.3"' : ''} aria-label="Move down">${U.icon('arrow_downward')}</button>
              <button class="icon-btn sm muted" data-act="subject-menu" data-id="${s.id}" aria-label="More">${U.icon('more_vert')}</button></div>`).join('') || '<div class="tree-empty">No subjects yet.</div>'}
              <div style="padding:12px 16px"><button class="btn outline block" data-act="new-subject">${U.icon('add')}Add New Subject</button></div></div>
          </div>` : ''}
        </div>`;
    },
    actions: {
      'proj-open': (el) => { actions.setActiveProject(el.dataset.id); TI.router.go('/'); },
      'subj-up': (el) => actions.moveSubject(el.dataset.id, -1),
      'subj-down': (el) => actions.moveSubject(el.dataset.id, 1),
      'proj-menu': (el) => {
        const p = sel.project(el.dataset.id); if (!p) return;
        TI.ui.openMenu(el, [
          ...(p.archived ? [] : [{ icon: 'open_in_new', label: 'Open', onClick: () => { actions.setActiveProject(p.id); TI.router.go('/'); } }]),
          { icon: 'edit', label: 'Edit name, type & colour', onClick: () => TI.forms.projectForm(p) },
          { icon: 'file_copy', label: 'Share template (.json, code, link)', onClick: () => TI.router.go('/share-template/' + p.id) },
          { icon: 'insert_chart', label: 'Share progress', onClick: () => { actions.setActiveProject(p.id); TI.router.go('/share'); } },
          { icon: p.archived ? 'unarchive' : 'archive', label: p.archived ? 'Unarchive' : 'Archive', onClick: () => {
            if (p.archived && !sel.canAddProject()) return TI.screens.pro.open('projects');
            actions.updateProject(p.id, { archived: !p.archived });
            if (!p.archived && state.settings.activeProjectId === p.id) { const n = sel.projects()[0]; actions.setActiveProject(n ? n.id : null); }
          } },
          { sep: true },
          { icon: 'delete', label: 'Delete', danger: true, onClick: async () => { if (await TI.ui.confirmDialog(`Delete ${p.name}?`, 'All its subjects, topics, study sessions, flashcards and notes will be deleted. This cannot be undone.')) actions.deleteProject(p.id); } },
        ]);
      },
    },
  };
  TI.screens.projects = screen;
})(window.TI);
