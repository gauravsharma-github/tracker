// Development only: pretends to be the deployed Apps Script web app so you can test syncing locally.
// Like the real thing: POST /exec answers with a 302 redirect to an echo URL (CORS: *), and
// OPTIONS (CORS preflight) is not supported – which is why TrackIt sends text/plain.
// Run: node backend/dev/server.js   (data is in memory and resets when you stop it)
const http = require('http'); const { makeEnv } = require('./gas');
const st = {}; const env = makeEnv(st); const token = env.ctx.setup();
const pending = {}; let n = 0; let down = false;
const port = +process.env.PORT || 8787;
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__token') { res.end(token); return; }
  if (url.pathname === '/__down') { down = url.searchParams.get('v') === '1'; res.end('down=' + down); return; }
  if (url.pathname === '/__dump') { const d = JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify({ token, op: 'bootstrap' }) } }).getContent()); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(d.data)); return; }
  if (down) { req.socket.destroy(); return; }
  if (req.method === 'OPTIONS') { res.writeHead(405); res.end(); return; }
  if (url.pathname === '/macros/s/TEST/exec' && req.method === 'POST') {
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
      const out = env.ctx.doPost({ postData: { contents: body, type: req.headers['content-type'] } });
      const id = 'r' + ++n; pending[id] = out;
      res.writeHead(302, { Location: `/macros/echo?user_content_key=${id}`, 'Access-Control-Allow-Origin': '*' }); res.end();
    }); return;
  }
  if (url.pathname === '/macros/echo') {
    const out = pending[url.searchParams.get('user_content_key')];
    res.writeHead(out ? 200 : 404, { 'Content-Type': out ? out.mime : 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end(out ? out.getContent() : 'not found'); return;
  }
  res.writeHead(404); res.end('nope');
}).listen(port, () => console.log(`Fake Apps Script running.\n  URL: http://localhost:${port}/macros/s/TEST/exec\n  Secret key: ${token}\n  Data: http://localhost:${port}/__dump`));
