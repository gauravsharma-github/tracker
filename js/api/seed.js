// Demo data so every screen has something to show. Generated relative to "today"
// with a seeded random generator, so it looks the same on every fresh start.
(function (TI) {
  const U = TI.util;

  function defaultSettings() {
    const t = TI.config.timerDefaults;
    return {
      theme: 'dark',
      focusMin: t.focusMin, shortMin: t.shortMin, longMin: t.longMin, longEvery: t.longEvery,
      autoBreaks: false, autoFocus: false,
      alarm: 'bell', alarmVolume: 0.8,
      ambient: 'off', ambientVolume: 0.45,
      reminderOn: true, reminderTime: '19:00', reminderSound: true,
      dailyGoalMin: 180,
      wallpaper: 'meadow', clockColor: '#C9A54C', clockSeconds: true,
      h12: true, weekStart: 1,
      activeProjectId: null,
      onboarded: true,
    };
  }

  const PROJECTS = [
    {
      key: 'ssc', name: 'SSC CGL', category: 'exam', color: '#405FFF', templateId: 'ssc-cgl', weight: 1,
      subjects: [
        { color: '#C74FFA', outline: `Quantitative Aptitude
  Number System
    [x] Divisibility rules
    HCF and LCM
    Simplification
    Surds and Indices
  Algebra
    [x] Linear equations
    [x] Algebraic identities
    Polynomials
    Quadratic equations
  Geometry
    Lines and angles
    Triangles
    Circles
    Quadrilaterals
  Trigonometry
    Trigonometric ratios
    Identities
    Heights and distances
  Mensuration
    [x] 2D figures
    3D figures
    Surface area and volume
  Statistics
    Mean, median, mode
    Data interpretation` },
        { color: '#488AFF', outline: `General Intelligence and Reasoning
  Analogies
    [x] Number analogy
    Letter analogy
    Figure analogy
  Classification
    Odd one out
    Word classification
  Coding-Decoding
    Letter coding
    Number coding
  Series
    Number series
    Alphabet series
  Blood Relations
  Syllogism
  Direction Sense
  Puzzles` },
        { color: '#8D6E63', outline: `English Comprehension
  Grammar
    Tenses
    Articles
    Subject-verb agreement
    Prepositions
  Vocabulary
    Synonyms and antonyms
    One-word substitution
    Idioms and phrases
  Reading Comprehension
  Cloze Test
  Error Spotting` },
        { color: '#F06A3A', outline: `General Awareness
  History
    Ancient India
    Medieval India
    Modern India
  Geography
    Physical geography
    Indian geography
  Polity
    Constitution
    Parliament
  Economics
  General Science
    Physics
    Chemistry
    Biology
  Current Affairs` },
      ],
    },
    {
      key: 'cbse', name: 'Class 10 · CBSE', category: 'exam', color: '#25AE97', templateId: 'cbse-10', weight: 0.55,
      subjects: [
        { color: '#405FFF', outline: `English
  First Flight
    [x] A Letter to God
    [x] Nelson Mandela
    Two Stories about Flying
    From the Diary of Anne Frank
  Footprints Without Feet
    [x] A Triumph of Surgery
    The Thief's Story
  Grammar
  Writing Skills` },
        { color: '#25AE97', outline: `Mathematics
  NCERT - Mathematics
    Chapter 1: Number Systems
      [x] Decimal
      Real Number
    [x] Chapter 2: Polynomials
    Chapter 3: Coordinate Geometry
    Chapter 4: Quadratic Equations
    Chapter 5: Arithmetic Progressions
    Chapter 6: Triangles` },
        { color: '#488AFF', outline: `Science
  Chemical Reactions and Equations
    [x] Balancing equations
    Types of reactions
  Acids, Bases and Salts
  Metals and Non-metals
  Life Processes
    [x] Nutrition
    Respiration
    Transportation
  Light
  Electricity` },
        { color: '#C74FFA', outline: `Social Science
  [x] History
  [x] Geography
  [x] Political Science
  [x] Economics` },
      ],
    },
    {
      key: 'dsa', name: 'DSA Roadmap', category: 'programming', color: '#ED5B6C', templateId: 'dsa', weight: 0.3,
      subjects: [
        { color: '#E0AD3C', outline: `Linear Structures
  [x] Arrays
  [x] Strings
  Linked Lists
  Stacks and Queues
  Hashing` },
        { color: '#64B7D4', outline: `Trees and Graphs
  Binary Trees
  Binary Search Trees
  Heaps
  BFS and DFS
  Shortest Paths` },
        { color: '#CB697E', outline: `Databases
  Postgres
  MongoDB
  Redis
  MySQL` },
      ],
    },
  ];

  const CARDS = {
    ssc: {
      3: [
        ['Who founded the Maurya Empire?', 'Chandragupta Maurya (c. 321 BCE)'],
        ['Which article of the Constitution abolishes untouchability?', 'Article 17'],
        ['What is the SI unit of electric current?', 'Ampere'],
        ['Largest freshwater lake in India?', 'Wular Lake (Jammu and Kashmir)'],
        ['Who was the first Governor-General of independent India?', 'Lord Mountbatten'],
        ['Which gas is most abundant in Earth\'s atmosphere?', 'Nitrogen (about 78%)'],
        ['The Battle of Plassey was fought in which year?', '1757'],
        ['Fundamental Duties were added by which amendment?', '42nd Amendment, 1976'],
      ],
      2: [
        ['Ubiquitous', 'Present everywhere'],
        ['Ephemeral', 'Lasting a very short time'],
        ['Antonym of "benevolent"', 'Malevolent'],
        ['One word: a person who loves books', 'Bibliophile'],
        ['Idiom: "to bite the bullet"', 'To face a difficult situation bravely'],
        ['Cacophony', 'A harsh, unpleasant mixture of sounds'],
      ],
      0: [
        ['(a + b)² = ?', 'a² + 2ab + b²'],
        ['Sum of interior angles of an n-sided polygon', '(n − 2) × 180°'],
        ['sin²θ + cos²θ = ?', '1'],
        ['Volume of a cone', '⅓ πr²h'],
        ['HCF × LCM of two numbers = ?', 'Product of the two numbers'],
      ],
    },
    cbse: {
      2: [
        ['As per the kinetic theory, the kinetic energy of molecules is directly proportional to…', 'Absolute temperature'],
        ['What is the chemical formula of baking soda?', 'NaHCO₃ (sodium hydrogen carbonate)'],
        ['Which mirror is used as a rear-view mirror?', 'Convex mirror'],
        ['SI unit of electric resistance?', 'Ohm (Ω)'],
        ['Site of photosynthesis in a plant cell?', 'Chloroplast'],
      ],
    },
  };

  const NOTES = {
    ssc: [
      [3, 'Important dates 📅', 'Battle of Plassey – 1757\nBattle of Buxar – 1764\nRevolt of 1857\nPartition of Bengal – 1905\nJallianwala Bagh – 1919\nDandi March – 1930'],
      [0, 'Formulas to revise 🧮', 'Profit % = (Profit / CP) × 100\nSI = PRT / 100\nCI = P(1 + R/100)^T − P\nSpeed = Distance / Time'],
      [1, 'Serious notes 😟', 'Always draw the family tree for blood relation questions.'],
      [2, 'Resources', 'https://www.ssc.gov.in/\n\nhttps://dictionary.cambridge.org/\n\nRead one editorial daily for RC practice.'],
      [3, 'Important 🤔', 'Current affairs: last 6 months before the exam'],
      [0, 'Shortcut tricks', 'Divisibility by 11: difference of sums of alternate digits is 0 or a multiple of 11.'],
    ],
    dsa: [
      [2, 'Postgres 🐘', 'PostgreSQL, often referred to as Postgres, is a powerful, open-source object-relational database system. It is known for its robustness, scalability, and SQL compliance.'],
      [2, 'Serious Notes 😟', ''],
      [2, 'MongoDB 🍏', 'MongoDB is a popular document-oriented NoSQL database. Here are some resources for learning more about MongoDB:'],
      [2, 'Redis 🍒', 'Redis is an in-memory key-value store known for its performance and flexibility.'],
      [2, 'Important 🤔', 'For Interviews 💁‍♂️'],
      [2, 'Resources', 'https://docs.mongodb.com/\n\nhttps://redis.io/documentation\n\nhttps://www.postgresql.org/docs/'],
    ],
    cbse: [
      [1, 'Chapter 1 doubts', 'Ask sir about the proof of irrationality of √2.'],
    ],
  };

  function create() {
    const r = U.rng(20241207);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const now = Date.now();
    const db = { projects: [], subjects: [], nodes: [], sessions: [], cards: [], reviews: [], notes: [], blocks: [], settings: defaultSettings(), account: { signedIn: false, name: '', email: '', pro: false, plan: null, lastBackup: null } };
    const leavesBySubject = {};
    const subjectByKey = {};

    PROJECTS.forEach((P, pi) => {
      const project = { id: 'p_' + P.key, name: P.name, category: P.category, color: P.color, templateId: P.templateId, order: pi, createdAt: now - (60 - pi * 10) * 86400000, archived: false };
      db.projects.push(project);
      subjectByKey[P.key] = [];
      P.subjects.forEach((S, si) => {
        const tree = TI.outline.parse(S.outline)[0];
        const subject = { id: `s_${P.key}_${si}`, projectId: project.id, name: tree.title, color: S.color, order: si, createdAt: project.createdAt };
        db.subjects.push(subject);
        subjectByKey[P.key].push(subject);
        leavesBySubject[subject.id] = [];
        const add = (nodes, parentId) => nodes.forEach((n, i) => {
          const node = { id: U.uid('n_'), subjectId: subject.id, parentId, title: n.title, done: false, doneAt: null, order: i, due: null, createdAt: project.createdAt };
          db.nodes.push(node);
          if (n.children.length) {
            add(n.children, node.id);
          } else {
            if (n.done) { node.done = true; node.doneAt = now - Math.floor(r() * 30) * 86400000 - Math.floor(r() * 50000000); }
            leavesBySubject[subject.id].push(node);
          }
        });
        add(tree.children, null);
      });
    });

    // A few due dates on open topics in the active project
    const openSsc = db.nodes.filter((n) => n.subjectId.startsWith('s_ssc') && !n.done && leavesBySubject[n.subjectId].includes(n));
    [0, 3, 7, 11].forEach((i, k) => { if (openSsc[i]) openSsc[i].due = U.addDaysKey(U.today(), [-1, 0, 2, 5][k]); });

    // Study sessions over the past ~7 weeks
    PROJECTS.forEach((P) => {
      const subs = subjectByKey[P.key];
      for (let d = 48; d >= 0; d--) {
        const prob = P.weight * (d < 14 ? 0.92 : 0.7);
        if (r() > prob) continue;
        const count = d === 0 ? 2 : 1 + Math.floor(r() * (P.weight > 0.9 ? 4 : 2));
        let hour = 6 + Math.floor(r() * 4);
        for (let k = 0; k < count; k++) {
          const s = pick(subs);
          const leaves = leavesBySubject[s.id];
          const mins = pick([25, 25, 25, 30, 40, 45, 50, 60, 15]);
          const start = U.startOfDay(U.addDays(new Date(), -d)); start.setHours(hour, Math.floor(r() * 50), 0, 0);
          if (start.getTime() + mins * 60000 > now) continue;
          db.sessions.push({ id: U.uid('t_'), projectId: s.projectId, subjectId: s.id, nodeId: leaves.length && r() < 0.6 ? pick(leaves).id : null, start: start.getTime(), duration: mins * 60, mode: r() < 0.85 ? 'pomodoro' : 'stopwatch', manual: false });
          hour += 1 + Math.floor(r() * 4);
          if (hour > 22) break;
        }
      }
    });

    // Flashcards
    Object.entries(CARDS).forEach(([pk, bySubject]) => {
      Object.entries(bySubject).forEach(([si, list]) => {
        const subject = subjectByKey[pk][Number(si)];
        list.forEach(([front, back], i) => {
          const c = { id: U.uid('c_'), subjectId: subject.id, front, back, createdAt: now - (20 - i) * 86400000, ...TI.srs.newCard() };
          const roll = (i * 37 + Number(si) * 11) % 10;
          if (roll < 4) { c.state = 'review'; c.reps = 2; c.interval = 3; c.due = now - 3600000; } else if (roll < 8) { c.state = 'review'; c.reps = 2 + (roll % 3); c.interval = 3 + roll; c.due = U.startOfDay().getTime() + (1 + (roll % 6)) * 86400000 + 4 * 3600000; } else { c.due = now; }
          db.cards.push(c);
        });
      });
    });
    // two reviews already done today
    db.cards.filter((c) => c.subjectId === 's_ssc_3').slice(0, 1).forEach((c) => db.reviews.push({ id: U.uid('r_'), cardId: c.id, subjectId: c.subjectId, grade: 'good', at: now - 2 * 3600000 }));
    db.cards.filter((c) => c.subjectId === 's_cbse_2').slice(0, 1).forEach((c) => db.reviews.push({ id: U.uid('r_'), cardId: c.id, subjectId: c.subjectId, grade: 'good', at: now - 3 * 3600000 }));

    // Notes
    Object.entries(NOTES).forEach(([pk, list]) => {
      list.forEach(([si, title, body], i) => {
        const subject = subjectByKey[pk][si];
        const at = now - (i + 1) * 86400000 * 3;
        db.notes.push({ id: U.uid('m_'), subjectId: subject.id, nodeId: null, title, body, pinned: i === 0, createdAt: at, updatedAt: at });
      });
    });

    // Schedule blocks
    const [q, g, e, ga] = subjectByKey.ssc;
    const today = U.today();
    const tomorrow = U.addDaysKey(today, 1);
    db.blocks.push(
      { id: U.uid('b_'), date: today, start: '07:00', end: '08:00', subjectId: q.id, nodeId: null, title: 'Algebra practice set', repeat: 'none', doneDates: [], createdAt: now },
      { id: U.uid('b_'), date: today, start: '08:30', end: '09:00', subjectId: ga.id, nodeId: null, title: 'Current affairs reading', repeat: 'daily', doneDates: [], createdAt: now },
      { id: U.uid('b_'), date: today, start: '18:00', end: '19:30', subjectId: g.id, nodeId: null, title: 'Reasoning mock test', repeat: 'none', doneDates: [], createdAt: now },
      { id: U.uid('b_'), date: today, start: '21:00', end: '21:45', subjectId: e.id, nodeId: null, title: 'Vocabulary flashcards', repeat: 'weekdays', doneDates: [], createdAt: now },
      { id: U.uid('b_'), date: tomorrow, start: '06:30', end: '07:30', subjectId: q.id, nodeId: null, title: 'Geometry: triangles', repeat: 'none', doneDates: [], createdAt: now },
      { id: U.uid('b_'), date: tomorrow, start: '17:00', end: '18:00', subjectId: e.id, nodeId: null, title: 'Grammar – tenses', repeat: 'none', doneDates: [], createdAt: now },
    );
    // mark morning block done if it is in the past
    if (new Date().getHours() >= 8) db.blocks[0].doneDates.push(today);

    db.settings.activeProjectId = 'p_ssc';
    return db;
  }

  TI.seed = { create, defaultSettings };
})(window.TI);
