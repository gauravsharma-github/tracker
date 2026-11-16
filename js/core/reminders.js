// Daily study reminder and schedule-block reminders. They fire only while the page is open;
// real push notifications need the backend (see README).
(function (TI) {
  const U = TI.util;
  const fired = new Set(TI.storage.get('fired', []));
  const remember = (k) => { fired.add(k); TI.storage.set('fired', [...fired].slice(-200)); };

  function show(title, body, icon = 'notifications_active') {
    const st = TI.store.state.settings;
    if (st.reminderSound) TI.sound.reminder();
    if (TI.ui && TI.ui.toast) TI.ui.toast(`${title}${body ? ' · ' + body : ''}`, { icon, duration: 6000 });
    try { if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: 'assets/logo.svg', silent: true }); } catch (e) { /* ignore */ }
  }

  function check() {
    const { state, sel } = TI.store;
    if (!state.ready) return;
    const st = state.settings; const now = new Date(); const day = U.today();
    const mins = now.getHours() * 60 + now.getMinutes();
    if (st.reminderOn && st.reminderTime) {
      const k = `daily:${day}`;
      const t = U.hmToMin(st.reminderTime);
      if (!fired.has(k) && mins >= t && mins < t + 2) {
        remember(k);
        const studied = TI.stats.allDay(state, day);
        show('Time to study', studied ? `${U.fmtDur(studied, { short: true })} done today – keep going` : 'Start a focus session to keep your streak');
      }
    }
    sel.blocksOn(day).forEach((b) => {
      const k = `block:${b.id}:${day}`;
      const t = U.hmToMin(b.start);
      if (!fired.has(k) && mins >= t - 5 && mins <= t && !(b.doneDates || []).includes(day)) {
        remember(k);
        const s = sel.subject(b.subjectId);
        show(`Up next at ${U.fmtHmLabel(b.start, st.h12)}`, `${b.title || (s ? s.name : 'Study block')}`, 'event');
      }
    });
  }
  setInterval(check, 20000);
  TI.reminders = { check, test: () => show('Time to study', 'This is how reminders look') };
})(window.TI);
