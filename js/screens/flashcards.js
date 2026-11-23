// Flashcards: decks per subject (spaced repetition), card list, add / bulk import.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  const revealed = new Set();

  function deckTile(s) {
    const st = TI.stats; const cards = sel.cards(s.id); const due = st.dueCards(state, s.id).length;
    return `<div class="deck-tile" style="--c:${s.color}">
      <div class="row" style="align-items:flex-start"><div class="grow"><div class="deck-name">${U.esc(s.name)}</div><div class="small muted">${U.plural(cards.length, 'card')} · ${st.reviewedToday(state, s.id)} revised today</div></div>
      ${TI.ui.ring(cards.length ? due / cards.length : 0, s.color, { size: 56, stroke: 5, label: `<b style="font-size:16px">${due}</b>` })}</div>
      <div class="row" style="margin-top:14px"><button class="btn sm soft-tint grow" data-act="nav" data-to="/study/${s.id}" ${due ? '' : 'disabled'}>${due ? `Study ${due}` : 'Nothing due'}</button><button class="btn sm" data-act="nav" data-to="/cards/${s.id}">Open</button></div>
    </div>`;
  }

  function overview(ctx) {
    const p = sel.activeProject();
    if (!p) return TI.ui.empty('style', 'No project yet', 'Create an exam or project first.');
    const subjects = sel.subjects(p.id);
    const due = U.sum(subjects, (s) => TI.stats.dueCards(state, s.id).length);
    const total = U.sum(subjects, (s) => sel.cards(s.id).length);
    const revised = U.sum(subjects, (s) => TI.stats.reviewedToday(state, s.id));
    return `<div class="page-head"><div><h1>Flashcards</h1><div class="sub">${U.esc(p.name)} · spaced repetition</div></div>
        <div class="actions"><button class="btn primary" data-act="nav" data-to="/study/all" ${due ? '' : 'disabled'}>${U.icon('play_arrow', 'fill')}Study all due (${due})</button></div></div>
      <div class="kpis kpis-3">
        ${TI.ui.kpi('event_upcoming', 'Due today', String(due), 'Across all subjects', '#ED5B6C')}
        ${TI.ui.kpi('task_alt', 'Revised today', String(revised), 'Cards reviewed', '#25AE97')}
        ${TI.ui.kpi('style', 'Total cards', String(total), `${subjects.filter((s) => sel.cards(s.id).length).length} decks`, '#405FFF')}
      </div>
      <div class="deck-grid">${subjects.map(deckTile).join('') || TI.ui.empty('menu_book', 'No subjects', 'Add a subject to create its deck.')}</div>
      <div class="card tip-card" style="margin-top:16px"><div class="row">${U.icon('auto_awesome', 'faint')}<div class="small muted grow">Bulk-import cards made by ChatGPT or Gemini: open a deck → <b>Add Cards</b> → <b>Bulk import</b>.</div></div></div>`;
  }

  // Interview cards linked to a topic show its name
  function topicTag(c) {
    const n = c.nodeId && sel.node(c.nodeId); if (!n) return '';
    return `<span class="fc-topic ellipsis" title="${U.esc(TI.stats.pathOf(state, n.id).map((x) => x.title).join(' › '))}">${U.icon('school', 'xs')}${U.esc(n.title)}</span>`;
  }
  function topicSelect(subjectId, cur) {
    const leaves = TI.stats.leaves(state, subjectId);
    if (!leaves.length) return '';
    return `<div class="field"><label>Topic (for its interview test)</label><select class="input" id="c-topic-node"><option value="">No topic – whole subject</option>${leaves.map(({ node, path }) => `<option value="${node.id}" ${cur === node.id ? 'selected' : ''}>${U.esc([...path, node.title].join(' › '))}</option>`).join('')}</select></div>`;
  }

  function cardItem(c, s) {
    const show = revealed.has(c.id);
    const label = c.state === 'new' && c.reps === 0 ? 'New' : U.relDue(c.due);
    return `<div class="fc-item" style="--c:${s.color}">
      <div class="row"><span class="fc-when">${U.icon(c.state === 'new' && c.reps === 0 ? 'fiber_new' : 'schedule')}${label}</span>${topicTag(c)}<div class="grow"></div>
        <button class="icon-btn sm muted" data-act="card-menu" data-id="${c.id}" aria-label="Card options">${U.icon('more_vert')}</button></div>
      <div class="fc-front">${U.esc(c.front)}</div>
      <button class="fc-back ${show ? 'shown' : ''}" data-act="card-reveal" data-id="${c.id}" title="${show ? 'Hide' : 'Show'} answer">${show ? U.esc(c.back) : '*******'}</button>
    </div>`;
  }

  function deck(ctx) {
    const s = sel.subject(ctx.params[0]);
    if (!s) return TI.ui.empty('search_off', 'Deck not found');
    const st = TI.stats; const cards = sel.cards(s.id); const due = st.dueCards(state, s.id).length; const revised = st.reviewedToday(state, s.id);
    const q = (state.ui.cardQuery || '').toLowerCase();
    const list = q ? cards.filter((c) => (c.front + ' ' + c.back).toLowerCase().includes(q)) : cards;
    return `<div class="deck-page" style="--c:${s.color}">
      <div class="topbar"><button class="icon-btn" data-act="back" aria-label="Back">${U.icon('arrow_back')}</button><h1 class="title-tint grow ellipsis">${U.esc(s.name)}</h1>
        <div class="actions"><button class="icon-btn" data-act="cards-export" data-id="${s.id}" title="Export cards" aria-label="Export cards">${U.icon('download')}</button></div></div>
      <div class="deck-grid-2">
        <div>
          <div class="card deck-summary">
            <div class="deck-name">${U.esc(s.name)}</div><div class="small muted">Memorize using: spaced repetition</div>
            <div style="margin-top:18px;font-weight:500">Cards available for today</div>
            <div class="deck-ring">${TI.ui.ring(cards.length ? Math.max(due ? 0.04 : 0, due / Math.max(cards.length, 1)) : 0, s.color, { size: 124, stroke: 10, label: `<span style="font-size:34px;font-weight:700">${due}</span>` })}</div>
            <div class="deck-chips"><div>${U.icon('calendar_month', 'sm')} <b>${due}</b><span>Due Today</span></div><div class="dim">${U.icon('event_available', 'sm')} <b>${revised}</b><span>Revised</span></div></div>
            <button class="btn soft-tint block lg" data-act="nav" data-to="/study/${s.id}" ${cards.length ? '' : 'disabled'}>${due ? 'Study Cards' : cards.length ? 'Study ahead' : 'Add cards to study'}</button>
          </div>
        </div>
        <div>
          <div class="row between" style="margin:4px 0 12px"><h3 style="font-size:17px;font-weight:500">Cards in subject (${cards.length})</h3>
            ${cards.length > 4 ? `<div class="input-icon" style="width:min(260px,50%)">${U.icon('search')}<input class="input" style="min-height:36px;padding-top:6px;padding-bottom:6px" placeholder="Search cards" value="${U.esc(state.ui.cardQuery || '')}" data-input="card-search" /></div>` : ''}</div>
          ${list.length ? `<div class="fc-list">${list.map((c) => cardItem(c, s)).join('')}</div>` : cards.length ? TI.ui.empty('search_off', 'No matching cards') : TI.ui.empty('style', 'No cards yet', 'Add question-and-answer cards. TrackIt schedules reviews so you see each card just before you would forget it.', `<button class="btn soft-tint" data-act="cards-add" data-id="${s.id}">${U.icon('add')}Add Cards</button>`)}
        </div>
      </div>
      <button class="fab" data-act="cards-add" data-id="${s.id}">${U.icon('add')}Add Cards</button>
    </div>`;
  }

  function addSheet(subjectId, tab = 'single', editCard = null, presetNode = null) {
    const s = sel.subject(subjectId); if (!s) return;
    let mode = editCard ? 'single' : tab;
    let topic = editCard ? editCard.nodeId || '' : presetNode || '';
    const topicNode = () => (topic && sel.node(topic)) || null;
    let added = 0;
    const draw = () => {
      if (mode === 'single') {
        return `${editCard ? '' : TI.ui.seg([{ id: 'single', label: 'Single card' }, { id: 'bulk', label: 'Bulk import' }], mode, 'tab', 'alt')}
          <div class="field" style="margin-top:14px"><label>Front (question)</label><textarea class="textarea" id="c-front" rows="3" autofocus placeholder="e.g. What is the SI unit of force?">${U.esc(editCard ? editCard.front : '')}</textarea></div>
          <div class="field"><label>Back (answer)</label><textarea class="textarea" id="c-back" rows="3" placeholder="e.g. Newton (N)">${U.esc(editCard ? editCard.back : '')}</textarea></div>
          ${topicSelect(subjectId, topic)}
          ${added ? `<div class="small" style="color:var(--success)">${U.icon('check_circle', 'xs')} ${U.plural(added, 'card')} added</div>` : ''}`;
      }
      return `${TI.ui.seg([{ id: 'single', label: 'Single card' }, { id: 'bulk', label: 'Bulk import' }], mode, 'tab', 'alt')}
        <div class="ai-steps">
          <div class="ai-step"><span class="n">1</span><div class="grow"><b>Ask an AI app for cards</b><div class="small muted">Copy this prompt into ChatGPT, Gemini or Claude.</div>
            <div class="row" style="margin-top:8px"><input class="input" id="c-topic" value="${U.esc(topicNode() ? `${s.name}: ${topicNode().title} – interview questions` : s.name)}" style="min-height:38px" /><button class="btn sm" data-act="copy-prompt">${U.icon('content_copy')}Copy prompt</button></div></div></div>
          <div class="ai-step"><span class="n">2</span><div class="grow"><b>Paste the result</b><div class="small muted">One card per line as <code>question :: answer</code>. Tabs, “Q: / A:” pairs, CSV and JSON also work.</div></div></div>
        </div>
        ${topicSelect(subjectId, topic)}
        <textarea class="textarea mono" id="c-bulk" rows="9" placeholder="What is the capital of Australia? :: Canberra&#10;Largest planet? :: Jupiter"></textarea>
        <div class="small muted" id="c-preview" style="margin-top:8px">Paste cards to see a preview.</div>`;
    };
    const api = TI.ui.openSheet({
      title: editCard ? 'Edit card' : topicNode() ? `Interview cards · ${topicNode().title}` : `Add cards · ${s.name}`, html: draw(),
      footer: editCard ? '<button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-act="save">Save</button>' : '<button class="btn ghost" data-close>Done</button><button class="btn primary" data-act="save">Add</button>',
      onMount(a) {
        const wire = () => {
          const bulk = a.el.querySelector('#c-bulk');
          if (bulk) bulk.addEventListener('input', () => { const n = TI.outline.parseCards(bulk.value).length; a.el.querySelector('#c-preview').innerHTML = n ? `${U.icon('check_circle', 'xs')} <b>${U.plural(n, 'card')}</b> ready to import` : 'No cards recognised yet.'; });
          const tsel = a.el.querySelector('#c-topic-node'); if (tsel) tsel.addEventListener('change', () => { topic = tsel.value; });
          const front = a.el.querySelector('#c-front');
          if (front) setTimeout(() => front.focus(), 30);
          a.el.querySelectorAll('#c-front,#c-back').forEach((t) => t.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); a.el.querySelector('[data-act="save"]').click(); } }));
        };
        wire();
        TI.forms.onAct(a, {
          tab(t) { mode = t.dataset.v; a.setBody(draw()); a.el.querySelector('[data-act="save"]').textContent = mode === 'bulk' ? 'Import' : 'Add'; wire(); },
          async 'copy-prompt'() { const ok = await U.copy(TI.outline.aiCardsPrompt(a.el.querySelector('#c-topic').value)); TI.ui.toast(ok ? 'Prompt copied – paste it into your AI app' : 'Could not copy', { icon: ok ? 'content_copy' : 'error' }); },
          save() {
            if (mode === 'bulk') {
              const cards = TI.outline.parseCards(a.el.querySelector('#c-bulk').value);
              if (!cards.length) { TI.ui.toast('No cards recognised', { icon: 'error' }); return; }
              actions.addCards(subjectId, cards.map((c) => ({ ...c, nodeId: topic || null }))); TI.ui.toast(`Imported ${U.plural(cards.length, 'card')}`, { icon: 'check_circle' }); a.close(); return;
            }
            const f = a.el.querySelector('#c-front').value.trim(); const b = a.el.querySelector('#c-back').value.trim();
            if (!f || !b) { (f ? a.el.querySelector('#c-back') : a.el.querySelector('#c-front')).focus(); return; }
            if (editCard) { actions.updateCard(editCard.id, { front: f, back: b, nodeId: topic || null }); a.close(); return; }
            actions.addCards(subjectId, [{ front: f, back: b, nodeId: topic || null }]); added++;
            a.setBody(draw()); wire();
          },
        });
      },
    });
    return api;
  }

  const handlers = {
    'card-reveal': (el) => { const id = el.dataset.id; if (revealed.has(id)) revealed.delete(id); else revealed.add(id); TI.store.bump(); },
    'cards-add': (el) => addSheet(el.dataset.id),
    'card-menu': (el) => {
      const c = state.cards.find((x) => x.id === el.dataset.id); if (!c) return;
      TI.ui.openMenu(el, [
        { icon: 'edit', label: 'Edit', onClick: () => addSheet(c.subjectId, 'single', c) },
        { icon: 'restart_alt', label: 'Reset progress', onClick: () => { actions.resetCard(c.id); TI.ui.toast('Card is new again', { icon: 'restart_alt' }); } },
        { sep: true },
        { icon: 'delete', label: 'Delete', danger: true, onClick: async () => { if (await TI.ui.confirmDialog('Delete this card?', c.front)) actions.deleteCard(c.id); } },
      ]);
    },
    'cards-export': (el) => {
      const s = sel.subject(el.dataset.id); const cards = sel.cards(el.dataset.id);
      if (!cards.length) return TI.ui.toast('No cards to export', { icon: 'info' });
      U.download(`${U.slug(s.name)}-flashcards.txt`, cards.map((c) => `${c.front.replace(/\n/g, ' ')} :: ${c.back.replace(/\n/g, ' ')}`).join('\n'), 'text/plain');
    },
  };

  TI.screens.cards = {
    title: 'Flashcards',
    render(ctx) { return ctx.params[0] ? deck(ctx) : overview(ctx); },
    actions: handlers,
    inputs: { 'card-search': (el) => { actions.setUi({ cardQuery: el.value }); } },
    addSheet,
  };
})(window.TI);
