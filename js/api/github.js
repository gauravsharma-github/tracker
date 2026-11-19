// File storage for attachments (PDF notes, audio) in YOUR GitHub repository, through the
// GitHub REST "contents" API. Use a PRIVATE repo: private repos are free, and nothing in it is
// visible to anyone else. The repo name and a fine-grained access token (Contents: read & write,
// that repo only) are saved in this browser only – never in the code.
//
// Limits (GitHub): up to 100 MB per file through this API; keep a repo under ~1 GB (5 GB at most).
// TrackIt caps PDFs at 25 MB and audio at 95 MB.
(function (TI) {
  const S = TI.storage;
  const U = TI.util;
  const KEY = 'gh';
  const MB = 1024 * 1024;
  const LIMITS = { pdf: 25 * MB, audio: 95 * MB, warnFile: 50 * MB, repoSoft: 1024 * MB, repoHard: 5 * 1024 * MB };
  const AUDIO_EXT = ['m4a', 'mp4', 'aac', 'mp3', 'wav', 'ogg', 'oga', 'opus', 'webm', 'flac', 'caf', 'aif', 'aiff', 'amr', 'wma', '3gp'];
  const MIME = { pdf: 'application/pdf', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm', flac: 'audio/flac', caf: 'audio/x-caf', aif: 'audio/aiff', aiff: 'audio/aiff', amr: 'audio/amr', wma: 'audio/x-ms-wma', '3gp': 'audio/3gpp' };

  const cfg = () => S.get(KEY);
  const configured = () => { const c = cfg(); return !!(c && c.owner && c.repo && c.token); };
  const extOf = (name) => { const m = String(name || '').match(/\.([a-z0-9]+)$/i); return m ? m[1].toLowerCase() : ''; };
  const mimeOf = (name, fallback) => MIME[extOf(name)] || fallback || 'application/octet-stream';
  function kindOf(file) {
    const e = extOf(file.name);
    if (e === 'pdf' || file.type === 'application/pdf') return 'pdf';
    if ((file.type || '').startsWith('audio/') || AUDIO_EXT.includes(e)) return 'audio';
    return null;
  }
  // Can this browser play the format? ('' = no)
  function playable(mime) { try { return document.createElement('audio').canPlayType(mime) !== ''; } catch (e) { return false; } }

  const apiBase = (c) => String((c && c.apiBase) || 'https://api.github.com').replace(/\/$/, '');
  const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');
  const repoOf = (c, att) => (att && att.repo) || `${c.owner}/${c.repo}`;
  const headers = (c, accept = 'application/vnd.github+json') => ({ Authorization: `Bearer ${c.token}`, Accept: accept });

  function explain(status, body, what) {
    const msg = (body && body.message) || '';
    if (status === 401) return 'GitHub rejected the token. It may be wrong or expired – create a new one and paste it in Settings › Attachments.';
    if (status === 403) return /rate limit/i.test(msg) ? 'GitHub rate limit reached. Try again in a few minutes.' : 'The token is not allowed to do this. Give it "Contents: Read and write" access to this repository.';
    if (status === 404) return what === 'file' ? 'The file is no longer in the repository.' : 'Repository not found. Check the owner and name, and that the token has access to it.';
    if (status === 409) return 'GitHub reported a conflict. Please try again.';
    if (status === 413) return 'The file is too big for GitHub (100 MB limit).';
    if (status === 422) return msg ? `GitHub could not accept it: ${msg}` : 'GitHub could not accept the file.';
    return msg || `GitHub returned an error (${status}).`;
  }

  async function req(c, method, path, { body, accept, what } = {}) {
    let res;
    try {
      res = await fetch(apiBase(c) + path, { method, headers: { ...headers(c, accept), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    } catch (e) { throw new Error(navigator.onLine === false ? 'You are offline.' : 'Could not reach GitHub. Check your connection.'); }
    if (!res.ok) { let j = null; try { j = await res.json(); } catch (e) { /* ignore */ } const err = new Error(explain(res.status, j, what)); err.status = res.status; throw err; }
    return res;
  }

  // Check owner/repo/token and return repo facts
  async function test(c) {
    if (!c.owner || !c.repo || !c.token) throw new Error('Enter the owner, repository and token.');
    const r = await (await req(c, 'GET', `/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`)).json();
    if (r.permissions && r.permissions.push === false) throw new Error('This token can read the repository but not write to it. Give it "Contents: Read and write".');
    const branch = c.branch || r.default_branch || 'main';
    let empty = false;
    try { await req(c, 'GET', `/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/branches/${encodeURIComponent(branch)}`); } catch (e) { if (e.status === 404) empty = true; else throw e; }
    return { fullName: r.full_name, private: !!r.private, branch, empty, sizeKB: r.size || 0, url: r.html_url };
  }

  function readBase64(file, onProgress) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total * 0.1); };
      fr.onerror = () => reject(new Error('Could not read the file.'));
      fr.onload = () => { const s = String(fr.result); resolve(s.slice(s.indexOf(',') + 1)); };
      fr.readAsDataURL(file);
    });
  }

  // PUT one file (XHR so we can show upload progress). Resolves { sha, path, size }.
  async function upload(file, path, { onProgress, message } = {}) {
    const c = cfg(); if (!configured()) throw new Error('Connect a GitHub repository first (Settings › Attachments).');
    const content = await readBase64(file, onProgress);
    const body = { message: message || `TrackIt: add ${path}`, content };
    if (c.branch && !c.empty) body.branch = c.branch;
    const url = `${apiBase(c)}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${encPath(path)}`;
    const send = () => new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('PUT', url);
      Object.entries(headers(c)).forEach(([k, v]) => x.setRequestHeader(k, v));
      x.setRequestHeader('Content-Type', 'application/json');
      x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(0.1 + (e.loaded / e.total) * 0.88); };
      x.onerror = () => reject(Object.assign(new Error(navigator.onLine === false ? 'You are offline.' : 'Upload failed – check your connection.'), { status: 0 }));
      x.onload = () => {
        let j = null; try { j = JSON.parse(x.responseText); } catch (e) { /* ignore */ }
        if (x.status >= 200 && x.status < 300 && j && j.content) resolve({ sha: j.content.sha, path: j.content.path, size: j.content.size || file.size });
        else reject(Object.assign(new Error(explain(x.status, j)), { status: x.status }));
      };
      x.send(JSON.stringify(body));
    });
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await send();
        if (c.empty) { c.empty = false; S.set(KEY, c); }
        if (onProgress) onProgress(1);
        return r;
      } catch (e) {
        if (e.status === 409 && attempt < 2) { await new Promise((ok) => setTimeout(ok, 1200)); continue; }
        throw e;
      }
    }
  }

  // Raw file → Blob (cached in the browser when possible)
  async function download(att, { onProgress } = {}) {
    const c = cfg(); if (!configured()) throw new Error('This device is not connected to your GitHub repository yet (Settings › Attachments).');
    const cacheKey = `https://trackit.local/gh/${repoOf(c, att)}/${att.path}?sha=${att.sha}`;
    let cache = null;
    try { if (window.caches && window.isSecureContext) { cache = await caches.open('trackit-files'); const hit = await cache.match(cacheKey); if (hit) return new Blob([await hit.arrayBuffer()], { type: att.mime }); } } catch (e) { cache = null; }
    const branch = att.branch || c.branch;
    const res = await req(c, 'GET', `/repos/${repoOf(c, att).split('/').map(encodeURIComponent).join('/')}/contents/${encPath(att.path)}${branch ? `?ref=${encodeURIComponent(branch)}` : ''}`, { accept: 'application/vnd.github.raw+json', what: 'file' });
    let buf;
    const total = +res.headers.get('content-length') || att.size || 0;
    if (res.body && res.body.getReader && onProgress) {
      const reader = res.body.getReader(); const parts = []; let got = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; if (total) onProgress(Math.min(1, got / total)); }
      buf = await new Blob(parts).arrayBuffer();
    } else buf = await res.arrayBuffer();
    if (cache) { try { await cache.put(cacheKey, new Response(buf, { headers: { 'Content-Type': att.mime } })); } catch (e) { /* storage full: ignore */ } }
    return new Blob([buf], { type: att.mime });
  }

  async function remove(att) {
    const c = cfg(); if (!configured()) throw new Error('Not connected to GitHub.');
    const repoPath = `/repos/${repoOf(c, att).split('/').map(encodeURIComponent).join('/')}/contents/${encPath(att.path)}`;
    const del = (sha) => req(c, 'DELETE', repoPath, { body: { message: `TrackIt: delete ${att.path}`, sha, ...(att.branch || c.branch ? { branch: att.branch || c.branch } : {}) }, what: 'file' });
    try { await del(att.sha); } catch (e) {
      if (e.status === 404) return; // already gone
      if (e.status === 409 || e.status === 422) {
        const cur = await (await req(c, 'GET', `${repoPath}${att.branch || c.branch ? `?ref=${encodeURIComponent(att.branch || c.branch)}` : ''}`, { what: 'file' })).json();
        await del(cur.sha); return;
      }
      throw e;
    }
    try { if (window.caches && window.isSecureContext) { const cache = await caches.open('trackit-files'); const keys = await cache.keys(); await Promise.all(keys.filter((k) => k.url.endsWith(`?sha=${att.sha}`)).map((k) => cache.delete(k))); } } catch (e) { /* ignore */ }
  }
  async function removeMany(list) { for (const a of list) { try { await remove(a); } catch (e) { console.warn('Could not delete', a.path, e); } } }

  // Readable, unique repo path: Project/Subject/Unit/Topic/Topic-notes-1.pdf
  const seg = (s) => String(s || 'untitled').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled';
  function pathFor({ projectName, subjectName, nodePath = [], kind, ext, taken = [] }) {
    const parts = [seg(projectName), seg(subjectName), ...nodePath.map(seg)];
    const target = parts[parts.length - 1];
    const label = kind === 'pdf' ? 'notes' : 'audio';
    // number per folder and kind, whatever the extension: Topic-audio-1.m4a, Topic-audio-2.aac
    const stem = (p) => p.toLowerCase().replace(/\.[a-z0-9]+$/, '');
    const used = new Set(taken.map(stem));
    for (let n = 1; n < 10000; n++) {
      const p = `${parts.join('/')}/${target}-${label}-${n}`;
      if (!used.has(stem(p + '.x'))) return `${p}.${ext}`;
    }
    return `${parts.join('/')}/${target}-${label}-${Date.now()}.${ext}`;
  }

  TI.github = {
    LIMITS, MB, cfg, configured, kindOf, mimeOf, extOf, playable,
    save(c) { S.set(KEY, c); }, clear() { S.remove(KEY); },
    test, upload, download, remove, removeMany, pathFor,
    repoName() { const c = cfg(); return c ? `${c.owner}/${c.repo}` : ''; },
    webUrl(att) { const c = cfg(); if (!c) return ''; return `https://github.com/${repoOf(c, att)}/blob/${encodeURIComponent(att.branch || c.branch || 'main')}/${encPath(att.path)}`; },
  };
})(window.TI);
