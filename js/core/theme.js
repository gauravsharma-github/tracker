// Dark / light / system theme.
(function (TI) {
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function resolved(pref) { return pref === 'system' ? (mq && mq.matches ? 'light' : 'dark') : pref || 'dark'; }
  function apply(pref) {
    const t = resolved(pref);
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#F2F3F7' : '#080B12');
    return t;
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (TI.store.state.settings.theme === 'system') apply('system'); });
  TI.theme = { apply, resolved, current: () => resolved(TI.store.state.settings.theme) };
})(window.TI);
