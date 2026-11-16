// TrackIt Pro upgrade screen (purchase is mocked until billing is connected).
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  let plan = 'lifetime';
  let busy = false;
  const REASONS = {
    projects: `The free plan includes ${TI.config.limits.projects} active projects.`,
    subjects: `The free plan includes ${TI.config.limits.subjectsPerProject} subjects per project.`,
    sounds: 'This focus sound is part of Pro.',
    wallpapers: 'This wallpaper is part of Pro.',
    share: 'More share-card colours come with Pro.',
  };

  const screen = {
    title: 'TrackIt Pro',
    render(ctx) {
      const cfg = TI.config.pro; const pro = sel.isPro();
      const reason = REASONS[ctx.query.from];
      return `<div class="topbar"><button class="icon-btn" data-act="back" aria-label="Back">${U.icon('arrow_back')}</button><div class="grow"></div></div>
        <div class="pro-page">
          <div class="pro-hero"><span class="crown-bubble big">${U.icon('crown', 'fill')}</span><h1>${U.esc(cfg.name)}</h1>
            <p class="muted">${pro ? 'You have every feature unlocked. Thank you!' : reason ? U.esc(reason) + ' Upgrade to remove every limit.' : 'Everything you need to finish your syllabus on time.'}</p></div>
          <div class="pro-perks">${cfg.perks.map(([i, t]) => `<div class="perk">${U.icon(i)}<span>${U.esc(t)}</span></div>`).join('')}</div>
          ${pro ? `<div class="card center"><div class="small muted">Plan</div><div style="font-size:20px;font-weight:600">${state.account.plan === 'lifetime' ? 'Lifetime' : 'Yearly'}</div>
              <button class="btn ghost sm" style="margin-top:12px" data-act="pro-cancel">Switch back to free (for testing)</button></div>`
            : `<div class="plans">${cfg.plans.map((p) => `<button class="plan ${plan === p.id ? 'on' : ''}" data-act="pro-plan" data-id="${p.id}">${p.best ? '<span class="plan-tag">Best value</span>' : ''}<span class="plan-l">${p.label}</span><span class="plan-p">${p.price}</span><span class="plan-s">${p.per} · ${p.note}</span></button>`).join('')}</div>
            <button class="btn primary lg block" data-act="pro-buy" ${busy ? 'disabled' : ''}>${busy ? 'Processing…' : `Continue · ${(cfg.plans.find((p) => p.id === plan) || cfg.plans[0]).price}`}</button>
            <button class="btn ghost block" style="margin-top:8px" data-act="pro-restore">Restore purchase</button>
            <p class="tiny faint center" style="margin-top:10px">Demo only – no payment is taken. Prices are placeholders in js/config.js.</p>`}
        </div>`;
    },
    actions: {
      'pro-plan': (el) => { plan = el.dataset.id; TI.store.bump(); },
      'pro-buy': async () => { busy = true; TI.store.bump(); await actions.purchasePro(plan); busy = false; TI.store.bump(); TI.ui.toast('Welcome to Pro! Everything is unlocked.', { icon: 'crown' }); },
      'pro-restore': async () => { const ok = await actions.restorePurchase(); TI.ui.toast(ok ? 'Purchase restored' : 'No previous purchase found', { icon: ok ? 'check_circle' : 'info' }); },
      'pro-cancel': () => actions.cancelPro(),
    },
    open(reason) { TI.router.go('/pro' + (reason ? `?from=${reason}` : '')); },
  };
  TI.screens.pro = screen;
})(window.TI);
