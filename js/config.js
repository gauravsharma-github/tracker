// App-wide constants. Change the name, plans and limits here.
// TrackIt is an existing product by vinztech.app – put your own name and logo here before releasing publicly.
window.TI = window.TI || {};
(function (TI) {
  TI.config = {
    appName: 'TrackIt',
    tagline: 'Study Tracker & Timer',
    version: '1.0.0 (web UI)',
    storagePrefix: 'trackit.v1.',
    links: { privacy: '', terms: '', support: '' },

    // Subject / project colors (sampled from the app's share-card palette and screenshots)
    palette: [
      '#405FFF', '#488AFF', '#64B7D4', '#25AE97', '#6BAD77', '#86AD36',
      '#E0AD3C', '#CB9833', '#DC7660', '#F06A3A', '#E75B5C', '#ED5B6C',
      '#CB697E', '#C74FFA', '#664FD6', '#8D6E63',
    ],

    projectCategories: [
      { id: 'exam', label: 'Exam', icon: 'school', grad: ['#264AFF', '#5A74FF'] },
      { id: 'programming', label: 'Programming', icon: 'code', grad: ['#EA4457', '#F07281'] },
      { id: 'medical', label: 'Medical', icon: 'stethoscope', grad: ['#BF36F9', '#CF68FB'] },
      { id: 'custom', label: 'Custom', icon: 'folder', grad: ['#1F9E86', '#3CC2A8'] },
    ],

    // Pomodoro defaults (minutes). Users change these in Settings.
    timerDefaults: { focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4 },

    alarmSounds: [
      { id: 'bell', label: 'Bell' },
      { id: 'chime', label: 'Chime' },
      { id: 'digital', label: 'Digital' },
      { id: 'soft', label: 'Soft ping' },
    ],
    ambientSounds: [
      { id: 'off', label: 'Off', icon: 'volume_off' },
      { id: 'rain', label: 'Rain', icon: 'rainy' },
      { id: 'white', label: 'White noise', icon: 'graphic_eq', pro: true },
      { id: 'brown', label: 'Brown noise', icon: 'waves', pro: true },
      { id: 'waves', label: 'Ocean waves', icon: 'water', pro: true },
      { id: 'tick', label: 'Clock ticking', icon: 'avg_pace', pro: true },
    ],
    clockColors: ['#C9A54C', '#7A5A4F', '#405FFF', '#25AE97', '#CB697E', '#2B2F3A', '#F2F2EC'],

    // Free plan limits; Pro removes them. Prices are placeholders.
    limits: { projects: 3, subjectsPerProject: 8 },
    pro: {
      name: 'TrackIt Pro',
      plans: [
        { id: 'yearly', label: 'Yearly', price: '₹399', per: '/year', note: '₹33/month' },
        { id: 'lifetime', label: 'Lifetime', price: '₹799', per: 'one time', note: 'Best value', best: true },
      ],
      perks: [
        ['all_inclusive', 'Unlimited projects and subjects'],
        ['wallpaper', 'All flip-clock wallpapers and colours'],
        ['graphic_eq', 'Every ambient focus sound'],
        ['palette', 'All share-card themes'],
        ['cloud_sync', 'Cloud backup and sync across devices'],
        ['favorite', 'Support an indie developer'],
      ],
    },
  };
})(window.TI);
