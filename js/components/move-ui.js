// "Move to…" picker: choose a project, a destination (a subject, a unit, a new subject, or "as a subject") and the
// exact position, then move with Undo right after.
(function (TI) {
  const U = TI.util;
  const { state, sel } = TI.store;
  const R = TI.restructure;

  const hasKids = (n) => state.nodes.some((x) => x.parentId === n.id);
  function containers(sid, excluded) { // the subject's units (nodes that have children), depth-first with level
    const out = [];
    const walk = (parentId, depth) => R.kidsOf(sid, parentId).forEach((n) => { if (excluded.has(n.id) || !hasKids(n)) return; out.push({ n, depth }); walk(n.id, depth + 1); });
    walk(null, 1); return out;
  }

  // what: { nodeId } | { subjectId }
  function moveSheet(what) {
    const node = what.nodeId ? sel.node(what.nodeId) : null; const subj = what.subjectId ? sel.subject(what.subjectId) : null;
    if (!node && !subj) return;
    const home = sel.subject(node ? node.subjectId : subj.id);
    const excluded = new Set(node ? R.subtree(node.id) : []);
    const name = node ? node.title : subj.name;
    let pid = home.projectId;
    // destination: 'S:<sid>' (top of a subject) · 'N:<nodeId>' (inside a unit) · 'ASSUBJ' (node → subject) · 'NEWSUBJ' (subject → unit in a new subject)
    let dest = node ? `${node.parentId ? 'N:' + node.parentId : 'S:' + node.subjectId}` : '';
    let pos = 'end';

    const projects = () => state.projects.filter((p) => !p.archived || p.id === pid);
    function siblingsFor(d) {
      if (d === 'ASSUBJ' || d === 'NEWSUBJ') return sel.subjects(pid).filter((s) => !subj || s.id !== subj.id).map((s) => ({ id: s.id, title: s.name }));
      if (!d) return [];
      const [k, id] = d.split(':'); const sid = k === 'S' ? id : sel.node(id).subjectId;
      return R.kidsOf(sid, k === 'S' ? null : id).filter((x) => !node || x.id !== node.id).map((x) => ({ id: x.id, title: x.title }));
    }
    function destList() {
      let h = '';
      if (node) h += `<label class="mv-opt special"><input type="radio" name="mv-d" value="ASSUBJ" ${dest === 'ASSUBJ' ? 'checked' : ''}/>${U.icon('folder_special')}<span><b>Make it a subject</b><small>${hasKids(node) ? 'Its topics become the subject\'s topics' : 'A subject with this one topic – stages, quizzes and cards stay'}</small></span></label>`;
      else h += `<label class="mv-opt special"><input type="radio" name="mv-d" value="NEWSUBJ" ${dest === 'NEWSUBJ' ? 'checked' : ''}/>${U.icon('create_new_folder')}<span><b>Into a new subject…</b><small>Creates the subject, with “${U.esc(name)}” inside it</small></span></label>
        ${dest === 'NEWSUBJ' ? `<div class="mv-new"><input class="input" id="mv-newname" placeholder="New subject name" value="${U.esc(lastNew)}" /></div>` : ''}`;
      sel.subjects(pid).filter((s) => !subj || s.id !== subj.id).forEach((s) => {
        h += `<label class="mv-opt" style="--c:${s.color}"><input type="radio" name="mv-d" value="S:${s.id}" ${dest === 'S:' + s.id ? 'checked' : ''}/><span class="mv-dot"></span><span><b>${U.esc(s.name)}</b><small>${node && node.subjectId === s.id && !node.parentId ? 'top level – where it is now' : 'top level of the subject'}</small></span></label>`;
        containers(s.id, excluded).forEach(({ n, depth }) => {
          h += `<label class="mv-opt sub" style="--c:${s.color};padding-left:${12 + depth * 18}px"><input type="radio" name="mv-d" value="N:${n.id}" ${dest === 'N:' + n.id ? 'checked' : ''}/>${U.icon('subdirectory_arrow_right')}<span>${U.esc(n.title)}${node && node.parentId === n.id ? ' <small>· where it is now</small>' : ''}</span></label>`;
        });
      });
      return h || '<div class="muted small">This project has no subjects yet.</div>';
    }
    function posSelect() {
      const sibs = siblingsFor(dest);
      const what2 = dest === 'ASSUBJ' || dest === 'NEWSUBJ' ? 'subjects' : 'items here';
      return `<select class="input" id="mv-pos" ${dest ? '' : 'disabled'}>
        <option value="end" ${pos === 'end' ? 'selected' : ''}>At the end${sibs.length ? '' : ` (no other ${what2})`}</option>
        ${sibs.length ? `<option value="0" ${pos === '0' ? 'selected' : ''}>At the start</option>` : ''}
        ${sibs.map((x, i) => `<option value="${i + 1}" ${pos === String(i + 1) ? 'selected' : ''}>After “${U.esc(U.truncate(x.title, 60))}”</option>`).join('')}
      </select>`;
    }
    let lastNew = '';

    TI.ui.openSheet({
      title: `Move “${U.truncate(name, 40)}”`, size: 'lg',
      html: `<div class="small muted" style="margin:-4px 0 12px">${U.esc(R.summary(what))} – everything moves with it.</div>
        <div class="field-row">
          <div class="field"><label>Project</label><select class="input" id="mv-proj">${projects().map((p) => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${U.esc(p.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Position</label><div id="mv-posw">${posSelect()}</div></div>
        </div>
        <div class="field"><label>Move to</label><div class="mv-list" id="mv-list">${destList()}</div></div>
        <div id="mv-err"></div>`,
      footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-act="go">${U.icon('drive_file_move')}Move</button>`,
      onMount(a) {
        const $ = (q) => a.el.querySelector(q);
        const paint = () => { $('#mv-list').innerHTML = destList(); $('#mv-posw').innerHTML = posSelect(); };
        $('#mv-proj').addEventListener('change', (e) => { pid = e.target.value; dest = ''; pos = 'end'; paint(); });
        a.el.addEventListener('change', (e) => {
          if (e.target.name === 'mv-d') { dest = e.target.value; pos = 'end'; paint(); if (dest === 'NEWSUBJ') setTimeout(() => $('#mv-newname') && $('#mv-newname').focus(), 30); }
          if (e.target.id === 'mv-pos') pos = e.target.value;
        });
        a.el.addEventListener('input', (e) => { if (e.target.id === 'mv-newname') lastNew = e.target.value; });
        TI.forms.onAct(a, {
          go() {
            const err = (m) => { $('#mv-err').innerHTML = `<div class="cx-err">${U.icon('error')}<span>${U.esc(m)}</span></div>`; };
            if (!dest) return err('Choose where to move it.');
            const index = pos === 'end' ? null : +pos;
            let r; let msg; let goTo = null;
            try {
              if (node) {
                if (dest === 'ASSUBJ') { r = R.nodeToSubject(node.id, { projectId: pid, index }); msg = `“${name}” is now a subject`; goTo = r && r.subjectId; }
                else {
                  const [k, id] = dest.split(':'); const sid = k === 'S' ? id : sel.node(id).subjectId;
                  r = R.moveNode(node.id, { subjectId: sid, parentId: k === 'S' ? null : id, index });
                  const ds = sel.subject(sid); msg = `Moved “${name}” to ${ds ? ds.name : 'the subject'}${k === 'N' ? ` › ${sel.node(id).title}` : ''}`;
                }
              } else if (dest === 'NEWSUBJ') {
                const nm = (lastNew || '').trim(); if (!nm) return err('Name the new subject.');
                r = R.subjectToNode(subj.id, { newSubject: { projectId: pid, name: nm, index } }); msg = `“${name}” is now a unit in the new subject ${nm}`; goTo = r && r.subjectId;
              } else {
                const [k, id] = dest.split(':'); const sid = k === 'S' ? id : sel.node(id).subjectId;
                r = R.subjectToNode(subj.id, { subjectId: sid, parentId: k === 'S' ? null : id, index }); const ds = sel.subject(sid);
                msg = `“${name}” is now a unit in ${ds ? ds.name : 'the subject'}`; goTo = sid;
              }
            } catch (e) { return err(e.message); }
            if (!r) return err('Nothing was moved.');
            a.close();
            const leftPage = subj && TI.router.current.name === 'subject' && TI.router.current.params[0] === subj.id;
            if (goTo && (leftPage || (node && dest === 'ASSUBJ' && TI.router.current.name === 'subject'))) TI.router.go(`/subject/${goTo}`, { replace: leftPage });
            if (pid !== home.projectId) { /* stay in the current project; the moved item is in the other one */ msg += ` (${(sel.project(pid) || {}).name || 'other project'})`; }
            TI.ui.toast(msg, { icon: 'drive_file_move', duration: 7000, action: { label: 'Undo', fn: () => { r.undo(); if (leftPage) TI.router.go(`/subject/${subj.id}`, { replace: true }); TI.ui.toast('Move undone', { icon: 'undo' }); } } });
          },
        });
      },
    });
  }

  // Shortcut results share the same Undo toast
  function shortcut(r, msg) {
    if (!r) return;
    TI.ui.toast(msg, { icon: 'drive_file_move', duration: 6000, action: { label: 'Undo', fn: () => { r.undo(); TI.ui.toast('Move undone', { icon: 'undo' }); } } });
  }

  TI.moveui = { moveSheet, shortcut };
})(window.TI);
