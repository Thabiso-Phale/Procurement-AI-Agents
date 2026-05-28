// ProcureAI — Local Server
// Serves the app AND proxies Claude API calls so the browser never hits CORS restrictions.
// Double-click "Start ProcureAI.bat" to launch. Keep this window open while using the app.

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const DIR  = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon'
};

const server = http.createServer(function(req, res) {

  // ── CORS headers for all responses ──────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── AI PROXY ENDPOINT  POST /api/chat ───────────────────────
  if (req.method === 'POST' && req.url === '/api/chat') {
    var body = '';
    req.on('data', function(chunk) { body += chunk.toString(); });
    req.on('end', function() {
      var parsed;
      try { parsed = JSON.parse(body); } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Invalid JSON in request body.' } }));
        return;
      }

      var apiKey  = parsed.apiKey  || '';
      var payload = parsed.payload || {};

      if (!apiKey) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'No API key provided.' } }));
        return;
      }

      var bodyStr = JSON.stringify(payload);
      var options = {
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers:  {
          'Content-Type':    'application/json',
          'Content-Length':  Buffer.byteLength(bodyStr),
          'x-api-key':       apiKey,
          'anthropic-version': '2023-06-01'
        }
      };

      var apiReq = https.request(options, function(apiRes) {
        var data = '';
        apiRes.on('data', function(chunk) { data += chunk; });
        apiRes.on('end', function() {
          res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
        });
      });

      apiReq.on('error', function(err) {
        console.error('  Anthropic API error:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Could not reach Anthropic: ' + err.message } }));
      });

      apiReq.write(bodyStr);
      apiReq.end();
    });
    return;
  }

  // ── STATIC FILE SERVER ───────────────────────────────────────
  var url  = req.url === '/' ? '/index.html' : req.url;
  var file = path.join(DIR, url.split('?')[0]);

  fs.readFile(file, function(err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found: ' + url);
      return;
    }
    var ext  = path.extname(file).toLowerCase();
    var type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', function() {
  console.log('');
  console.log('  ============================================');
  console.log('   ProcureAI is running!');
  console.log('   http://localhost:' + PORT);
  console.log('   Claude AI proxy: active');
  console.log('  ============================================');
  console.log('');
  console.log('  Keep this window open while using the app.');
  console.log('  Close it when you are done.');
  console.log('');
  // Auto-open browser on Windows only (not used in cloud deployment)
  if (process.platform === 'win32') exec('start http://localhost:' + PORT);
});

server.on('error', function(err) {
  if (err.code === 'EADDRINUSE') {
    console.log('');
    console.log('  Port 3000 is already in use.');
    console.log('  Open http://localhost:3000 in your browser.');
    console.log('');
  } else {
    console.error('  Server error:', err.message);
  }
});
