// Spaced repetition (SM-2 style). Pure functions so the backend can reuse them.
// Card fields: { ease, interval (days), reps, lapses, due (ms), state: 'new'|'learning'|'review' }
(function (TI) {
  const MIN = 60 * 1000;
  const DAY = 24 * 60 * MIN;
  const GRADES = [
    { id: 'again', label: 'Again', key: '1', color: '#ED5B6C' },
    { id: 'hard', label: 'Hard', key: '2', color: '#E0AD3C' },
    { id: 'good', label: 'Good', key: '3', color: '#25AE97' },
    { id: 'easy', label: 'Easy', key: '4', color: '#405FFF' },
  ];

  function newCard() {
    return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: Date.now(), state: 'new' };
  }

  // Returns the updated scheduling fields (does not mutate)
  function schedule(card, grade, now = Date.now()) {
    let { ease = 2.5, interval = 0, reps = 0, lapses = 0 } = card;
    let due; let state;
    if (grade === 'again') {
      lapses += card.state === 'review' ? 1 : 0;
      reps = 0; interval = 0; ease = Math.max(1.3, ease - 0.2);
      due = now + 10 * MIN; state = 'learning';
    } else {
      if (grade === 'hard') {
        interval = reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
        ease = Math.max(1.3, ease - 0.15);
      } else if (grade === 'good') {
        interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(Math.max(interval, 1) * ease);
      } else if (grade === 'easy') {
        interval = reps === 0 ? 4 : Math.round(Math.max(interval, 1) * ease * 1.3);
        ease = ease + 0.15;
      }
      reps += 1; state = 'review';
      // due at the start of that day (+4h) so "due today" is predictable
      const d = new Date(now); d.setHours(4, 0, 0, 0);
      due = d.getTime() + interval * DAY;
    }
    return { ease: Math.round(ease * 100) / 100, interval, reps, lapses, due, state };
  }

  function preview(card, now = Date.now()) {
    return GRADES.map((g) => {
      const s = schedule(card, g.id, now);
      const label = g.id === 'again' ? '10m' : s.interval < 30 ? `${s.interval}d` : s.interval < 365 ? `${Math.round(s.interval / 30)}mo` : `${Math.round(s.interval / 365)}y`;
      return { ...g, label2: label };
    });
  }

  const isDue = (card, at = Date.now()) => card.due <= TI.util.endOfDay(new Date(at)).getTime();

  TI.srs = { GRADES, newCard, schedule, preview, isDue, DAY };
})(window.TI);
