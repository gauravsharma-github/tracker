// Settings: account & backup (mocked), appearance, timer, sounds, goals, reminders, flip clock, data.
(function (TI) {
  const U = TI.util;
  const { state, sel, actions } = TI.store;
  const LIMITS = { focusMin: [5, 180, 5], shortMin: [1, 30, 1], longMin: [5, 60, 5], longEvery: [2, 8, 1], dailyGoalMin: [15, 720, 15] };
  let busy = '';

  const stepper = (k, fmt = (v) => v) => `<div class="stepper"><button data-act="step" data-k="${k}" data-d="-1" aria-label="Decrease">${U.icon('remove', 'sm')}</button><span class="v">${fmt(state.settings[k])}</span><button data-act="step" data-k="${k}" data-d="1" aria-label="Increase">${U.icon('add', 'sm')}</button></div>`;
  const toggle = (k, on = !!state.settings[k]) => `<label class="switch"><input type="checkbox" data-change="toggle" data-k="${k}" ${on ? 'checked' : ''} /><span></span></label>`;

  function timerRows() {
    const st = state.settings;
    return `<div class="set-row">${U.icon('nest_clock_farsight_analog')}<div class="txt"><div class="ttl">Focus length</div></div>${stepper('focusMin', (v) => v + ' min')}</div>
      <div class="set-row">${U.icon('coffee')}<div class="txt"><div class="ttl">Short break</div></div>${stepper('shortMin', (v) => v + ' min')}</div>
      <div class="set-row">${U.icon('weekend')}<div class="txt"><div class="ttl">Long break</div></div>${stepper('longMin', (v) => v + ' min')}</div>
      <div class="set-row">${U.icon('repeat')}<div class="txt"><div class="ttl">Long break after</div><div class="sub">Number of focus sessions</div></div>${stepper('longEvery', (v) => v + ' ×')}</div>
      <div class="set-row">${U.icon('play_circle')}<div class="txt"><div class="ttl">Auto-start breaks</div></div>${toggle('autoBreaks')}</div>
      <div class="set-row">${U.icon('restart_alt')}<div class="txt"><div class="ttl">Auto-start next focus</div></div>${toggle('autoFocus')}</div>
      <div class="set-row">${U.icon('alarm')}<div class="txt"><div class="ttl">Alarm sound</div><div class="sub">Plays when a session or break ends</div></div>
        <select class="select" style="width:auto;min-height:38px" data-change="alarm">${TI.config.alarmSounds.map((a) => `<option value="${a.id}" ${st.alarm === a.id ? 'selected' : ''}>${a.label}</option>`).join('')}</select>
        <button class="icon-btn sm" data-act="test-alarm" aria-label="Play alarm">${U.icon('play_arrow', 'fill')}</button></div>
      <div class="set-row">${U.icon('volume_up')}<div class="txt"><div class="ttl">Alarm volume</div></div><input type="range" min="0" max="1" step="0.05" value="${st.alarmVolume}" data-change="alarmVolume" style="max-width:180px" /></div>`;
  }

  function timerSheet() {
    TI.ui.openSheet({
      title: 'Timer settings', html: `<div class="set-group" style="background:transparent;padding:0">${timerRows()}</div>`,
      onMount(a) {
        const redraw = () => { a.setBody(`<div class="set-group" style="background:transparent;padding:0">${timerRows()}</div>`); };
        TI.forms.onAct(a, { step(t) { step(t); redraw(); }, 'test-alarm'() { TI.sound.alarm(state.settings.alarm, state.settings.alarmVolume); } });
        a.el.addEventListener('change', (e) => { change(e.target); redraw(); });
      },
    });
  }

  function step(t) {
    const k = t.dataset.k; const [min, max, inc] = LIMITS[k];
    actions.updateSettings({ [k]: U.clamp((state.settings[k] || 0) + inc * +t.dataset.d, min, max) });
  }
  function change(el) {
    const k = el.dataset.change;
    if (!k) return;
    if (k === 'toggle') { actions.updateSettings({ [el.dataset.k]: el.checked }); if (el.dataset.k === 'reminderOn' && el.checked) askNotify(); return; }
    if (k === 'alarm') { actions.updateSettings({ alarm: el.value }); TI.sound.alarm(el.value, state.settings.alarmVolume); return; }
    if (k === 'alarmVolume' || k === 'ambientVolume') { actions.updateSettings({ [k]: +el.value }); if (k === 'ambientVolume') TI.sound.setAmbientVolume(+el.value); return; }
    if (k === 'reminderTime') { actions.updateSettings({ reminderTime: el.value }); return; }
    if (k === 'aiProfile') { actions.updateSettings({ aiProfile: el.value.trim() }); TI.ui.toast('Saved', { icon: 'check' }); return; }
    if (k === 'ambient') {
      const a = TI.config.ambientSounds.find((x) => x.id === el.value);
      if (a && a.pro && !sel.isPro()) { el.value = state.settings.ambient; TI.screens.pro.open('sounds'); return; }
      actions.updateSettings({ ambient: el.value });
    }
  }
  function askNotify() { try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(() => TI.store.bump()); } catch (e) { /* ignore */ } }

  function sheetsRows() {
    if (TI.api.mode() !== 'sheets') {
      return `<div class="set-row">${U.icon('table_chart')}<div class="txt"><div class="ttl">Google Sheet backend</div><div class="sub">Keep your data in your own Google Sheet and use TrackIt on every device. Free, private to your Google account.</div></div><button class="btn sm primary" data-act="sheet-connect">Connect</button></div>
        <div class="set-row">${U.icon('info')}<div class="txt"><div class="sub">Right now everything is stored only in this browser. Export a backup below if you clear browser data.</div></div></div>`;
    }
    const c = TI.api.connection() || {}; const d = TI.sync.describe(TI.api.syncStatus());
    return `<div class="set-row">${U.icon('table_chart')}<div class="txt"><div class="ttl">Connected to your Google Sheet</div><div class="sync-line ${d.cls}" data-sync-status>${U.icon(d.icon)}<span>${U.esc(d.text)}${d.detail ? ` – ${U.esc(d.detail)}` : ''}</span></div></div><button class="btn sm" data-act="sheet-sync">${U.icon('sync')}Sync now</button></div>
      ${c.sheetUrl ? `<div class="set-row click" data-act="sheet-open">${U.icon('open_in_new')}<div class="txt"><div class="ttl">Open the sheet</div><div class="sub">See or analyse your raw data in Google Sheets</div></div></div>` : ''}
      <div class="set-row click" data-act="sheet-code">${U.icon('devices')}<div class="txt"><div class="ttl">Connect another device</div><div class="sub">Copy a connection code and paste it on your phone or another browser</div></div></div>
      <div class="set-row click" data-act="sheet-link">${U.icon('bookmark_add')}<div class="txt"><div class="ttl">Copy setup link</div><div class="sub">Bookmark it. If this browser ever forgets the connection, open the bookmark to reconnect the sheet and GitHub in one click. Keep it private.</div></div></div>
      <div class="set-row">${U.icon('link')}<div class="txt"><div class="sub ellipsis" title="${U.esc(c.url || '')}">${U.esc(c.url || '')}</div></div><button class="btn sm ghost" data-act="sheet-disconnect">Disconnect</button></div>`;
  }

  // ?focus=github scrolls to the attachments section once per navigation
  let focused = false;
  TI.router.onChange(() => { focused = false; });

  let aiForce = false;
  function aiStatusHtml(st) {
    if (st.configured) return `${U.icon('check_circle', 'fill')}<div class="txt"><div class="ttl">AI ready <span class="chip-mini">Gemini</span></div><div class="sub">Model ${U.esc(st.model || '')} · runs through your sheet, so the key never leaves it</div></div><button class="btn sm ghost" data-act="ai-check">Check</button>`;
    return `${U.icon('auto_awesome')}<div class="txt"><div class="ttl">Set up AI (free)</div><div class="sub">${U.esc(TI.aiui.setupHelp(st))}${st.error && !st.oldScript ? ` (${U.esc(st.error)})` : ''}</div></div><button class="btn sm" data-act="ai-check">Check again</button>`;
  }
  function aiRows() {
    const st = state.settings; const c = TI.ai.cfg();
    return `<div class="set-row" id="ai-status">${U.icon('hourglass_top')}<div class="txt"><div class="ttl">AI (Google Gemini)</div><div class="sub">Checking…</div></div></div>
      <div class="set-row">${U.icon('badge')}<div class="txt"><div class="ttl">About you</div><div class="sub">Helps the AI pitch questions and judge answers at the right level</div>
        <textarea class="textarea" rows="2" data-change="aiProfile" style="margin-top:8px" placeholder="e.g. Solutions architect, 13 years in CRM (Salesforce, Pega). Preparing for senior roles at product companies.">${U.esc(st.aiProfile || '')}</textarea></div></div>
      <div class="set-row">${U.icon('signal_cellular_alt')}<div class="txt"><div class="ttl">Question level</div></div>${TI.ui.seg(Object.keys(TI.ai.LEVEL_NAMES).map((k) => ({ id: k, label: TI.ai.LEVEL_NAMES[k] })), c.level, 'ai-level', 'alt')}</div>
      <div class="set-row">${U.icon('format_list_numbered')}<div class="txt"><div class="ttl">Questions per topic</div></div>${TI.ui.seg([5, 8, 10, 15].map((k) => ({ id: String(k), label: String(k) })), String(c.count), 'ai-count', 'alt')}</div>
      <div class="set-row">${U.icon('auto_awesome')}<div class="txt"><div class="ttl">Prepare interview questions automatically</div><div class="sub">When you tick Revision 2, the topic's interview cards are written in the background (using its PDF notes if any)</div></div>${toggle('aiAuto', st.aiAuto !== false)}</div>
      <div class="set-row">${U.icon('volume_up')}<div class="txt"><div class="ttl">Interviewer speaks out loud</div><div class="sub">Uses your browser's voice in mock interviews</div></div>${toggle('aiVoice')}</div>
      <div class="set-row">${U.icon('info')}<div class="txt"><div class="sub">On Gemini's free tier Google may use prompts to improve its products, so avoid putting confidential client details in notes you send to the AI.</div></div></div>`;
  }

  function githubRows() {
    const GH = TI.github; const A = TI.attach;
    const files = state.attachments; const total = files.reduce((n, a) => n + (a.size || 0), 0);
    const pdfs = files.filter((a) => a.kind === 'pdf').length; const audio = files.length - pdfs;
    const oldScript = TI.api.mode() === 'sheets' && TI.api.backendVersion() < 2
      ? `<div class="set-row">${U.icon('warning')}<div class="txt"><div class="ttl">Update your sheet script</div><div class="sub">Attachments need backend/Code.gs version 2 – see backend/SETUP.md › Updating.</div></div></div>` : '';
    if (!GH.configured()) {
      return `<div class="set-row">${U.icon('attach_file')}<div class="txt"><div class="ttl">PDF notes &amp; audio</div><div class="sub">Attach PDFs (up to 25 MB) and recordings (up to about 1 hour) to any subject, unit or topic. Files are kept in your own private GitHub repository – free, nothing to pay.</div></div><button class="btn sm primary" data-act="gh-setup">Set up</button></div>
        ${files.length ? `<div class="set-row">${U.icon('info')}<div class="txt"><div class="sub">${U.plural(files.length, 'file')} attached. Connect the same repository on this device to open them${TI.api.mode() === 'sheets' ? ' (or paste a connection code from a device where it is set up)' : ''}.</div></div></div>` : ''}${oldScript}`;
    }
    const c = GH.cfg(); const pct = Math.min(100, (total / GH.LIMITS.repoSoft) * 100);
    return `<div class="set-row">${U.icon('lock', 'fill')}<div class="txt"><div class="ttl">${U.esc(c.owner)}/${U.esc(c.repo)} <span class="chip-mini">Private</span></div><div class="sub">${files.length ? `${U.plural(pdfs, 'PDF')} · ${U.plural(audio, 'recording')} · ${A.fmtSize(total)}` : 'No files yet'} · branch ${U.esc(c.branch || 'main')}</div>
        ${files.length ? `<div class="meter" title="${A.fmtSize(total)} of about 1 GB (GitHub's recommended repository size)"><i style="width:${Math.max(pct, 1)}%" class="${pct > 80 ? 'hot' : ''}"></i></div><div class="sub">${pct < 0.1 ? 'Under 0.1' : pct.toFixed(pct < 10 ? 1 : 0)}% of the ~1 GB GitHub recommends per repo${pct > 80 ? ' – start a second repo soon' : ''}</div>` : ''}</div></div>
      <div class="set-row click" data-act="gh-open">${U.icon('open_in_new')}<div class="txt"><div class="ttl">Open the repository</div><div class="sub">Browse or download your files on GitHub</div></div></div>
      <div class="set-row click" data-act="gh-setup">${U.icon('key')}<div class="txt"><div class="ttl">Change token or repository</div><div class="sub">Tokens expire – if uploads say the token was rejected, paste a new one here</div></div></div>
      <div class="set-row">${U.icon('info')}<div class="txt"><div class="sub">The token is stored only in this browser${TI.api.mode() === 'sheets' ? ' and in connection codes you copy' : ''}.</div></div><button class="btn sm ghost" data-act="gh-disconnect">Disconnect</button></div>${oldScript}`;
  }

  const screen = {
    title: 'Settings',
    mount(root, ctx) {
      // AI status is fetched from the sheet script
      const ai = root.querySelector('#ai-status');
      if (ai) TI.ai.status(aiForce).then((st) => { aiForce = false; if (ai.isConnected) ai.innerHTML = aiStatusHtml(st); });
      if ((ctx.query.focus === 'github' || ctx.query.focus === 'ai') && !focused) {
        focused = true;
        const el = root.querySelector(ctx.query.focus === 'ai' ? '#set-ai' : '#set-gh');
        if (el) { setTimeout(() => { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); }, 60); }
      }
    },
    render(ctx) {
      const st = state.settings; const acc = state.account; const pro = sel.isPro(); const sheets = TI.api.mode() === 'sheets';
      const notif = 'Notification' in window ? Notification.permission : 'unsupported';
      return `<div class="page-head"><div><h1>Settings</h1></div></div>
        <div class="settings-grid">
          <div>
            ${TI.api.mode() === 'sheets' ? '' : `<div class="pro-banner ${pro ? 'is-pro' : ''}" data-act="nav" data-to="/pro">
              <span class="crown-bubble">${U.icon('crown', 'fill')}</span>
              <div class="grow"><b>${pro ? `${TI.config.pro.name} · ${acc.plan === 'lifetime' ? 'Lifetime' : 'Yearly'}` : `Upgrade to ${TI.config.pro.name}`}</b><span>${pro ? 'Thank you for supporting TrackIt!' : 'Unlimited projects, all sounds, wallpapers and cloud backup'}</span></div>${U.icon('chevron_right')}
            </div>`}
            <div class="set-group-title">Sync &amp; backup</div>
            <div class="set-group">${sheetsRows()}</div>
            <div class="set-group-title">AI</div>
            <div class="set-group" id="set-ai">${aiRows()}</div>
            <div class="set-group-title">Attachments (GitHub)</div>
            <div class="set-group" id="set-gh">${githubRows()}</div>
            <div class="set-group-title">Appearance</div>
            <div class="set-group">
              <div class="set-row">${U.icon('contrast')}<div class="txt"><div class="ttl">Theme</div></div>${TI.ui.seg([{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }, { id: 'system', label: 'System' }], st.theme, 'set-theme', 'alt')}</div>
              <div class="set-row">${U.icon('schedule')}<div class="txt"><div class="ttl">Time format</div></div>${TI.ui.seg([{ id: '12', label: '12-hour' }, { id: '24', label: '24-hour' }], st.h12 ? '12' : '24', 'set-h12', 'alt')}</div>
              <div class="set-row">${U.icon('date_range')}<div class="txt"><div class="ttl">Week starts on</div></div>${TI.ui.seg([{ id: '1', label: 'Monday' }, { id: '0', label: 'Sunday' }], String(st.weekStart), 'set-week', 'alt')}</div>
            </div>
            <div class="set-group-title">Focus timer</div>
            <div class="set-group">${timerRows()}</div>
          </div>
          <div>
            <div class="set-group-title">Goals &amp; reminders</div>
            <div class="set-group">
              <div class="set-row">${U.icon('flag')}<div class="txt"><div class="ttl">Daily study goal</div><div class="sub">Shown on the dashboard and focus page</div></div>${stepper('dailyGoalMin', (v) => U.fmtMin(v))}</div>
              <div class="set-row">${U.icon('notifications')}<div class="txt"><div class="ttl">Daily reminder</div><div class="sub">A nudge if you haven't studied yet</div></div>${toggle('reminderOn')}</div>
              ${st.reminderOn ? `<div class="set-row">${U.icon('alarm_on')}<div class="txt"><div class="ttl">Reminder time</div></div><input class="input" type="time" value="${st.reminderTime}" data-change="reminderTime" style="width:auto;min-height:38px" /></div>` : ''}
              <div class="set-row">${U.icon('music_note')}<div class="txt"><div class="ttl">Subtle reminder sound</div></div>${toggle('reminderSound')}<button class="icon-btn sm" data-act="test-reminder" aria-label="Test reminder">${U.icon('play_arrow', 'fill')}</button></div>
              <div class="set-row">${U.icon('notifications_active')}<div class="txt"><div class="ttl">Browser notifications</div><div class="sub">${notif === 'granted' ? 'Allowed' : notif === 'denied' ? 'Blocked in browser settings' : notif === 'unsupported' ? 'Not supported in this browser' : 'Not allowed yet'} · reminders work while TrackIt is open</div></div>${notif === 'default' ? '<button class="btn sm" data-act="ask-notify">Allow</button>' : ''}</div>
            </div>
            <div class="set-group-title">Focus sounds</div>
            <div class="set-group">
              <div class="set-row">${U.icon('graphic_eq')}<div class="txt"><div class="ttl">Ambient sound</div><div class="sub">Plays during focus sessions</div></div>
                <select class="select" style="width:auto;min-height:38px" data-change="ambient">${TI.config.ambientSounds.map((a) => `<option value="${a.id}" ${st.ambient === a.id ? 'selected' : ''}>${a.label}${a.pro && !pro ? ' 👑' : ''}</option>`).join('')}</select></div>
              <div class="set-row">${U.icon('volume_down')}<div class="txt"><div class="ttl">Ambient volume</div></div><input type="range" min="0" max="1" step="0.05" value="${st.ambientVolume}" data-change="ambientVolume" style="max-width:180px" /></div>
            </div>
            <div class="set-group-title">Flip clock</div>
            <div class="set-group" style="padding:14px 16px">
              <div class="wp-grid">${TI.wallpapers.map((w) => `<button class="wp ${st.wallpaper === w.id ? 'on' : ''}" style="background:${w.css}" data-act="set-wallpaper" data-id="${w.id}" data-lock="${w.pro && !pro ? 1 : ''}"><span>${w.label}</span>${w.pro && !pro ? `<i>${U.icon('crown', 'fill xs')}</i>` : ''}</button>`).join('')}</div>
              <div class="field-label" style="margin:14px 0 8px">Clock colour</div>${TI.ui.colorPicker(st.clockColor, 'set-clockcolor', TI.config.clockColors)}
            </div>
            <div class="set-group-title">Data</div>
            <div class="set-group">
              <div class="set-row click" data-act="export">${U.icon('download')}<div class="txt"><div class="ttl">Export backup</div><div class="sub">Everything as a JSON file</div></div></div>
              <div class="set-row click" data-act="import">${U.icon('upload')}<div class="txt"><div class="ttl">Import backup</div><div class="sub">${sheets ? 'Replaces the data in your Google Sheet' : 'Replaces the data in this browser'}</div></div></div>
              <div class="set-row click" data-act="export-csv">${U.icon('table_view')}<div class="txt"><div class="ttl">Export study sessions (CSV)</div><div class="sub">Open in Excel or Google Sheets</div></div></div>
              ${sheets ? '' : `<div class="set-row click" data-act="reset-demo">${U.icon('restart_alt')}<div class="txt"><div class="ttl">Reset demo data</div><div class="sub">Start over with the sample projects</div></div></div>`}
              <div class="set-row click" data-act="clear-all">${U.icon('delete_forever', '')}<div class="txt"><div class="ttl" style="color:var(--danger)">Delete all data</div><div class="sub">${sheets ? 'Empties your Google Sheet too' : 'Start with an empty app'}</div></div></div>
              <div class="set-row">${U.icon('database')}<div class="txt"><div class="ttl">${sheets ? 'Offline copy in this browser' : 'Stored in this browser'}</div><div class="sub">${(TI.storage.bytesUsed() / 1024).toFixed(0)} KB${TI.storage.available ? '' : ' · storage unavailable – data resets on reload'}</div></div></div>
            </div>
            <div class="set-group-title">About</div>
            <div class="set-group">
              <div class="set-row">${U.icon('info')}<div class="txt"><div class="ttl">${U.esc(TI.config.appName)} – ${U.esc(TI.config.tagline)}</div><div class="sub">Version ${TI.config.version}</div></div></div>
              <div class="set-row click" data-act="shortcuts">${U.icon('keyboard')}<div class="txt"><div class="ttl">Keyboard shortcuts</div></div></div>
              <div class="set-row click" data-act="privacy">${U.icon('shield')}<div class="txt"><div class="ttl">Privacy policy</div></div></div>
            </div>
          </div>
        </div>`;
    },
    changes: { '*': (el) => change(el) },
    actions: {
      step,
      'set-theme': (el) => { actions.updateSettings({ theme: el.dataset.v }); TI.theme.apply(el.dataset.v); },
      'set-h12': (el) => actions.updateSettings({ h12: el.dataset.v === '12' }),
      'set-week': (el) => actions.updateSettings({ weekStart: +el.dataset.v }),
      'test-alarm': () => TI.sound.alarm(state.settings.alarm, state.settings.alarmVolume),
      'test-reminder': () => TI.reminders.test(),
      'ask-notify': () => askNotify(),
      'set-wallpaper': (el) => { if (el.dataset.lock) return TI.screens.pro.open('wallpapers'); actions.updateSettings({ wallpaper: el.dataset.id }); },
      'set-clockcolor': (el) => actions.updateSettings({ clockColor: el.dataset.color }),
      'sign-in': async (el) => { busy = el.dataset.p; TI.store.bump(); await actions.signIn(el.dataset.p); busy = ''; TI.store.bump(); TI.ui.toast('Signed in · backup is on', { icon: 'cloud_done' }); },
      'sign-out': async () => { await actions.signOut(); },
      'sheet-connect': () => TI.sync.connectSheet(),
      'sheet-sync': () => TI.sync.syncNow(),
      'sheet-open': () => { const c = TI.api.connection(); if (c && c.sheetUrl) window.open(c.sheetUrl, '_blank', 'noopener'); },
      'sheet-code': () => TI.sync.copyCode(),
      'sheet-link': () => TI.sync.copySetupLink(),
      'sheet-disconnect': () => TI.sync.disconnect(),
      'gh-setup': () => TI.attach.setupGithub(),
      'ai-check': () => { aiForce = true; TI.store.bump(); },
      'ai-level': (el) => actions.updateSettings({ aiLevel: el.dataset.v }),
      'ai-count': (el) => actions.updateSettings({ aiCount: +el.dataset.v }),
      'gh-disconnect': () => TI.attach.disconnectGithub(),
      'gh-open': () => { const c = TI.github.cfg(); if (c) window.open(`https://github.com/${c.owner}/${c.repo}`, '_blank', 'noopener'); },
      backup: async () => { busy = 'backup'; TI.store.bump(); await actions.backupNow(); busy = ''; TI.store.bump(); TI.ui.toast('Backed up', { icon: 'cloud_done' }); },
      export: () => actions.exportBackup(),
      import: async () => {
        const f = await U.pickFile(); if (!f) return;
        try { const json = JSON.parse(await U.readFile(f)); if (!(await TI.ui.confirmDialog('Import this backup?', TI.api.mode() === 'sheets' ? 'Everything in your Google Sheet will be replaced by the backup.' : 'Data in this browser will be replaced by the backup.', 'Import', 'primary'))) return; await actions.importBackup(json); TI.ui.toast('Backup imported', { icon: 'check_circle' }); } catch (e) { TI.ui.toast(e.message || 'Not a valid backup file', { icon: 'error' }); }
      },
      'export-csv': () => {
        const rows = [['Date', 'Start', 'Minutes', 'Project', 'Subject', 'Topic', 'Mode']];
        state.sessions.slice().sort((a, b) => a.start - b.start).forEach((s) => { const p = sel.project(s.projectId); const sj = sel.subject(s.subjectId); const n = s.nodeId ? sel.node(s.nodeId) : null; rows.push([U.dayKey(s.start), U.fmtTime(s.start, false), Math.round(s.duration / 60), p ? p.name : '', sj ? sj.name : '', n ? n.title : '', s.manual ? 'manual' : s.mode]); });
        U.download(`trackit-sessions-${U.today()}.csv`, rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
      },
      'reset-demo': async () => { if (await TI.ui.confirmDialog('Reset demo data?', 'Your current data in this browser will be replaced with the sample projects.', 'Reset', 'danger')) { await actions.resetDemo(); TI.router.go('/'); TI.ui.toast('Demo data restored', { icon: 'restart_alt' }); } },
      'clear-all': async () => { if (await TI.ui.confirmDialog('Delete all data?', `All projects, sessions, flashcards and notes ${TI.api.mode() === 'sheets' ? 'in your Google Sheet and this browser' : 'in this browser'} will be deleted. Export a backup first if you want to keep them.`, 'Delete everything', 'danger')) { try { await actions.clearAll(); TI.router.go('/'); } catch (e) { TI.ui.toast(e.message, { icon: 'error' }); } } },
      shortcuts: () => TI.ui.dialog({ title: 'Keyboard shortcuts', html: `<div class="list small">${[['Space', 'Start / pause timer'], ['S', 'Stop timer and save'], ['F', 'Full-screen flip clock'], ['N', 'New subject'], ['G then D / T / S / C / I', 'Go to Dashboard / Timer / Schedule / Cards / Insights'], ['1 – 4', 'Grade a flashcard'], ['Esc', 'Close dialog']].map(([k, v]) => `<div class="list-item"><span class="grow">${v}</span><kbd>${k}</kbd></div>`).join('')}</div>`, buttons: [{ label: 'Close', kind: 'primary', primary: true, value: () => true }] }),
      privacy: () => TI.ui.dialog({ title: 'Privacy', message: 'Your data stays in this browser, or in your own Google Sheet if you connect one. Nothing is sent anywhere else. Add your privacy policy link in js/config.js.', buttons: [{ label: 'OK', kind: 'primary', primary: true, value: () => true }] }),
    },
    timerSheet,
  };
  TI.screens.settings = screen;
})(window.TI);
