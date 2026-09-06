/**
 * Minimal static server for local development. The production build is just
 * these files served as-is, so there is nothing to compile.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const root = __dirname;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

http
  .createServer((req, res) => {
    const requestPath = decodeURIComponent(req.url.split('?')[0]);
    const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
    const filePath = path.resolve(root, relativePath);

    if (!filePath.startsWith(root + path.sep) && filePath !== root) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, {
        'Content-Type': types[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.woff2' ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      res.end(data);
    });
  })
  .listen(port, host, () => console.log(`KESTRA is live at http://${host}:${port}`));
