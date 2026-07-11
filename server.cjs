const fs = require('fs');
const http = require('http');
const path = require('path');

const root = __dirname;
const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
const port = Number(process.env.PORT || 8080);

const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

const server = http.createServer((request, response) => {
  let urlPath = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.normalize(path.join(root, urlPath));
  if (filePath !== root && !filePath.startsWith(rootWithSeparator)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {'Content-Type': types[path.extname(filePath)] || 'application/octet-stream'});
    response.end(content);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Moi Dengi is running at http://127.0.0.1:${port}`);
});
