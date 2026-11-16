// Hash router: #/name/param1/param2 → { name, params, path }
(function (TI) {
  const fns = new Set();
  function parse() {
    const h = (location.hash || '#/').replace(/^#\/?/, '');
    const [path, query = ''] = h.split('?');
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    const q = {}; query.split('&').filter(Boolean).forEach((kv) => { const [k, v = ''] = kv.split('='); q[decodeURIComponent(k)] = decodeURIComponent(v); });
    return { name: parts[0] || 'home', params: parts.slice(1), query: q, path: '/' + parts.join('/') };
  }
  let depth = 0;
  const router = {
    current: parse(),
    go(path, { replace = false } = {}) {
      const target = '#' + (path.startsWith('/') ? path : '/' + path);
      if (location.hash === target) { router.current = parse(); fns.forEach((f) => f(router.current)); return; }
      if (replace) location.replace(target); else { depth++; location.hash = target; }
    },
    back(fallback = '/') { if (depth > 0) { depth--; history.back(); } else router.go(fallback, { replace: true }); },
    onChange(fn) { fns.add(fn); return () => fns.delete(fn); },
  };
  window.addEventListener('hashchange', () => { router.current = parse(); fns.forEach((f) => f(router.current)); });
  TI.router = router;
})(window.TI);
