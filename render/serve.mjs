// Tiny static file server for the scene page. Used by the capture script.
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.bin': 'application/octet-stream', '.wav': 'audio/wav' };

export function serve(port = 0) {
  const server = http.createServer((req, res) => {
    const p = normalize(decodeURIComponent(req.url.split('?')[0]));
    const file = join(ROOT, p === '/' ? '/scene/index.html' : p);
    try {
      const st = statSync(file);
      if (!st.isFile()) throw new Error('dir');
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      createReadStream(file).pipe(res);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}
if (process.argv[1] && process.argv[1].endsWith('serve.mjs')) serve(8123).then(({ port }) => console.log('http://127.0.0.1:' + port + '/'));
