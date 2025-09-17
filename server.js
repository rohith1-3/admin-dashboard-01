// Simple static file server for local testing (no dependencies)
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'public');
const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  if (filePath.includes('..')) { res.writeHead(403); return res.end('Forbidden'); }
  const abs = path.join(root, filePath);
  fs.readFile(abs, (err, data) => {
    if (err) {
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(abs)] || 'application/octet-stream' });
    res.end(data);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running at http://localhost:${port}`));

