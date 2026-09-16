// A minimal local development server, written using only Node.js's
// built-in `http` module - no Express, no dependencies, no npm install
// needed. Its only job is to serve the files in this folder over HTTP,
// which is required because index.html loads js/app.js as an ES module,
// and browsers refuse to load modules from a file:// URL (see CLAUDE.md).

const http = require('http');
const fs = require('fs');
const path = require('path');

// The folder this script itself lives in - i.e. the project root - used
// as the base directory to serve files from.
const root = __dirname;

// Maps file extensions to the MIME type the browser needs to see in the
// Content-Type header to handle the response correctly (e.g. without this,
// .js files might not be recognized as executable modules).
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

http
  .createServer((req, res) => {
    // req.url includes any query string (e.g. "/?foo=bar"); split it off
    // since we only care about the path. decodeURIComponent turns things
    // like %20 back into normal characters (e.g. spaces).
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    // Requesting the site root should serve index.html, same as any
    // normal web server's default behavior.
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
    // Turn the URL path into an actual file path on disk.
    const filePath = path.join(root, urlPath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // Most commonly: the requested file doesn't exist. Respond with a
        // plain 404 and a little debug info rather than crashing.
        res.writeHead(404);
        res.end('not found: ' + filePath + ' (' + err.code + ')');
        return;
      }
      // Look up the right Content-Type from the file's extension, falling
      // back to a generic binary type for anything not in our list.
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      res.end(data);
    });
  })
  .listen(8123, () => console.log('Final Countdown running at http://localhost:8123'));
