// Breakpoints shared by CSS (css/desktop.css) and renderers.
(function (TI) {
  const DESKTOP = 1024; const WIDE = 1280;
  const mqD = window.matchMedia(`(min-width: ${DESKTOP}px)`);
  const mqW = window.matchMedia(`(min-width: ${WIDE}px)`);
  const fns = new Set();
  const fire = () => fns.forEach((f) => f());
  [mqD, mqW].forEach((m) => (m.addEventListener ? m.addEventListener('change', fire) : m.addListener(fire)));
  TI.layout = {
    DESKTOP, WIDE,
    isDesktop: () => mqD.matches,
    isWide: () => mqW.matches,
    onChange(fn) { fns.add(fn); return () => fns.delete(fn); },
  };
})(window.TI);
