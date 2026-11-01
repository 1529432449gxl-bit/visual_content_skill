#!/usr/bin/env node
// 零依赖静态服务器：浏览器禁止 file:// 下的 ES module 导入，预览用它。
//   node scripts/serve.mjs [目录=skill 根目录] [--port 5173]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.md': 'text/plain; charset=utf-8' };

export function serve(root, port = 5173) {
  root = resolve(root);
  const server = createServer(async (req, res) => {
    try {
      let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
      let file = join(root, p);
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
    } catch { res.writeHead(404).end('not found'); }
  });
  return new Promise(ok => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const pi = args.indexOf('--port'); const port = pi >= 0 ? +args.splice(pi, 2)[1] : 5173;
  const root = args[0] || resolve(dirname(fileURLToPath(import.meta.url)), '..');
  serve(root, port).then(s => console.log(`预览：http://127.0.0.1:${s.address().port}/   （根目录 ${resolve(root)}，Ctrl+C 退出）`));
}
