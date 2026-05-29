// ProcureAI — Local Server
// Serves the app AND proxies Claude API calls so the browser never hits CORS restrictions.
// Double-click "Start ProcureAI.bat" to launch. Keep this window open while using the app.

const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
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

// ── Beta rate limiter (applies only when using the hosted key) ──
// 30 AI requests per IP per 24 hours — enough for thorough beta testing.
var rateLimits  = {};
var RATE_LIMIT  = 30;
var RATE_WINDOW = 24 * 60 * 60 * 1000; // 24 h in ms

function checkRateLimit(ip) {
  var now = Date.now();
  if (!rateLimits[ip] || now > rateLimits[ip].resetAt) {
    rateLimits[ip] = { count: 0, resetAt: now + RATE_WINDOW };
  }
  if (rateLimits[ip].count >= RATE_LIMIT) return false;
  rateLimits[ip].count++;
  return true;
}

// Purge stale entries hourly to keep memory clean
setInterval(function() {
  var now = Date.now();
  Object.keys(rateLimits).forEach(function(ip) {
    if (now > rateLimits[ip].resetAt) delete rateLimits[ip];
  });
}, 60 * 60 * 1000);

// ── License key system ───────────────────────────────────────────
// Keys are HMAC-SHA256 derived — no database needed.
// Format: G-XXXXX-XXXXX-XXXXX-XXXXX (Grow) | T-XXXXX-XXXXX-XXXXX-XXXXX (Team)
var LICENSE_SECRET = (process.env.LICENSE_SECRET || 'dev-only-change-in-prod').trim();
var ADMIN_SECRET   = (process.env.ADMIN_SECRET   || 'admin-dev-password').trim();
var PLAN_CODES     = { grow: 'G', team: 'T' };
var CODE_PLANS     = { 'G': 'grow', 'T': 'team' };

function makeLicenseKey(email, plan) {
  var code = PLAN_CODES[(plan || '').toLowerCase()];
  if (!code) return null;
  var raw = crypto.createHmac('sha256', LICENSE_SECRET)
    .update(email.toLowerCase().trim() + ':' + plan.toLowerCase())
    .digest('hex').toUpperCase().slice(0, 20);
  return code + '-' + raw.match(/.{5}/g).slice(0, 4).join('-');
}

function checkLicenseKey(key, email) {
  if (!key || !email) return { valid: false };
  var k = (key || '').toUpperCase().replace(/\s/g, '');
  var planCode = k.charAt(0);
  var plan = CODE_PLANS[planCode];
  if (!plan) return { valid: false };
  var expected = makeLicenseKey(email, plan);
  if (expected && expected === k) return { valid: true, plan: plan, email: email.toLowerCase().trim() };
  return { valid: false };
}

// ── Admin panel HTML ─────────────────────────────────────────────
var ADMIN_HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ProcureAI — License Admin</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0F172A;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#F1F5F9;padding:16px}. card{background:#1E293B;border:1px solid #334155;border-radius:16px;padding:32px;width:100%;max-width:520px}.card{background:#1E293B;border:1px solid #334155;border-radius:16px;padding:32px;width:100%;max-width:520px}h1{font-size:18px;font-weight:700;margin-bottom:4px}.sub{font-size:13px;color:#64748B;margin-bottom:20px}label{display:block;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 5px}input,select{width:100%;padding:10px 12px;background:#0F172A;border:1px solid #334155;border-radius:8px;color:#F1F5F9;font-size:14px;outline:none}input:focus,select:focus{border-color:#3B82F6}select option{background:#1E293B}.btn{width:100%;padding:12px;background:#1D4ED8;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-top:16px}.btn:hover{background:#1E40AF}.result{margin-top:20px;padding:16px;background:#0F172A;border:1px solid #22C55E;border-radius:10px;display:none}.err-box{border-color:#EF4444}.tag{font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px}.key{font-family:monospace;font-size:20px;font-weight:700;color:#22C55E;letter-spacing:2px;margin:8px 0;word-break:break-all}.cbtn{padding:7px 14px;background:#1D4ED8;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;margin-top:6px}.meta{font-size:12px;color:#64748B;margin-top:8px}.hist{margin-top:24px;border-top:1px solid #334155;padding-top:16px;display:none}.hist h3{font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}.hi{padding:9px 12px;background:#0F172A;border-radius:8px;margin-bottom:5px;font-size:12px;display:flex;justify-content:space-between;align-items:center;gap:8px}.hk{font-family:monospace;color:#22C55E;font-size:13px;flex:1}.badge{padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase}.bg{background:#1D4ED8;color:#fff}.bt{background:#7C3AED;color:#fff}#lerr{color:#EF4444;font-size:12px;margin-top:8px;display:none}</style></head><body><div class="card"><div style="display:flex;align-items:center;gap:10px;margin-bottom:24px"><div style="width:36px;height:36px;background:#1D4ED8;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px">🛒</div><div><div style="font-size:16px;font-weight:700">ProcureAI</div><div style="font-size:12px;color:#64748B">License Admin</div></div></div><div id="p-login"><h1>Admin Access</h1><p class="sub">Enter your admin password to continue.</p><label>Password</label><input type="password" id="apw" placeholder="Admin password" onkeydown="if(event.key===\'Enter\')doLogin()"><div id="lerr">Incorrect password.</div><button class="btn" onclick="doLogin()">Login →</button></div><div id="p-keygen" style="display:none"><h1>Generate License Key</h1><p class="sub">Fill in customer details and generate a key to email them.</p><label>Customer Email</label><input type="email" id="kge" placeholder="customer@company.com"><label>Plan</label><select id="kgp"><option value="grow">Grow — $39 / month</option><option value="team">Team — $89 / month</option></select><button class="btn" onclick="doGen()">⚡ Generate Key</button><div class="result" id="kgr"><div class="tag">License Key</div><div class="key" id="kgk"></div><button class="cbtn" onclick="doCopy()">📋 Copy Key</button><div class="meta" id="kgm"></div></div><div class="hist" id="kgh"><h3>Session History</h3><div id="kghl"></div></div></div></div><script>var as="",sh=[];function doLogin(){var p=document.getElementById("apw").value;fetch("/admin/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret:p,email:"verify@check.com",plan:"grow"})}).then(function(r){return r.json()}).then(function(d){if(d.key){as=p;document.getElementById("p-login").style.display="none";document.getElementById("p-keygen").style.display="block"}else{document.getElementById("lerr").style.display="block"}}).catch(function(){document.getElementById("lerr").style.display="block"})}function doGen(){var e=document.getElementById("kge").value.trim(),pl=document.getElementById("kgp").value;if(!e||!e.includes("@")){alert("Enter a valid email.");return}fetch("/admin/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret:as,email:e,plan:pl})}).then(function(r){return r.json()}).then(function(d){if(d.key){var r=document.getElementById("kgr");r.style.display="block";document.getElementById("kgk").textContent=d.key;document.getElementById("kgm").innerHTML="📧 "+e+" &nbsp;·&nbsp; <span class=\'badge b"+(pl==="team"?"t":"g")+"\'>"+(pl==="team"?"TEAM":"GROW")+"</span>";sh.unshift({key:d.key,email:e,plan:pl});renderH()}})}function doCopy(){var k=document.getElementById("kgk").textContent;navigator.clipboard.writeText(k).then(function(){var b=document.querySelector(".cbtn");b.textContent="✅ Copied!";setTimeout(function(){b.textContent="📋 Copy Key"},2e3)})}function renderH(){var h=document.getElementById("kgh"),l=document.getElementById("kghl");if(!sh.length){h.style.display="none";return}h.style.display="block";l.innerHTML=sh.map(function(i){return\'<div class="hi"><span class="hk">\'+i.key+\'</span><span style="color:#94A3B8;font-size:11px">\'+i.email+\'</span><span class="badge b\'+(i.plan==="team"?"t":"g")+\'">\'+i.plan+\'</span></div>\'}).join("")}</script></body></html>';

const server = http.createServer(function(req, res) {

  // ── CORS headers for all responses ──────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── ADMIN PANEL  GET /admin ──────────────────────────────────
  if (req.method === 'GET' && req.url === '/admin') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(ADMIN_HTML);
    return;
  }

  // ── GENERATE LICENSE  POST /admin/generate ───────────────────
  if (req.method === 'POST' && req.url === '/admin/generate') {
    var body = '';
    req.on('data', function(chunk) { body += chunk.toString(); });
    req.on('end', function() {
      var parsed;
      try { parsed = JSON.parse(body); } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' })); return;
      }
      if (!parsed.secret || parsed.secret !== ADMIN_SECRET) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid credentials' })); return;
      }
      var key = makeLicenseKey(parsed.email, parsed.plan);
      if (!key) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid plan. Use: grow or team' })); return;
      }
      console.log('  [license] generated ' + parsed.plan + ' key for ' + parsed.email);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ key: key, email: parsed.email, plan: parsed.plan }));
    });
    return;
  }

  // ── VALIDATE LICENSE  POST /api/validate-license ─────────────
  if (req.method === 'POST' && req.url === '/api/validate-license') {
    var body = '';
    req.on('data', function(chunk) { body += chunk.toString(); });
    req.on('end', function() {
      var parsed;
      try { parsed = JSON.parse(body); } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: false, error: 'Invalid JSON' })); return;
      }
      var result = checkLicenseKey(parsed.key, parsed.email);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
    return;
  }

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

      var userKey   = (parsed.apiKey || '').trim();
      var hostedKey = (process.env.ANTHROPIC_API_KEY || '').trim();
      var usingHosted = !userKey && !!hostedKey;
      var apiKey    = userKey || hostedKey;

      if (!apiKey) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'No API key available. Add your Anthropic key in Settings to continue.' } }));
        return;
      }

      // Paid license holders bypass the rate limiter
      var licenseResult = checkLicenseKey(parsed.licenseKey, parsed.licenseEmail);
      var isPaidUser = licenseResult.valid && (licenseResult.plan === 'grow' || licenseResult.plan === 'team');

      // Rate-limit only requests that use the hosted beta key (free users)
      if (usingHosted && !isPaidUser) {
        var clientIP = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown')
                         .split(',')[0].trim();
        if (!checkRateLimit(clientIP)) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Daily AI limit reached (30 requests/day on beta access). Upgrade to Grow for unlimited AI, or add your own API key in Settings.' } }));
          return;
        }
        console.log('  [beta key] ' + clientIP + ' — request ' + rateLimits[clientIP].count + '/' + RATE_LIMIT);
      }
      if (usingHosted && isPaidUser) {
        console.log('  [paid ' + licenseResult.plan + '] ' + parsed.licenseEmail + ' — unlimited AI');
      }

      var payload = parsed.payload || {};
      var bodyStr = JSON.stringify(payload);
      var options = {
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers:  {
          'Content-Type':      'application/json',
          'Content-Length':    Buffer.byteLength(bodyStr),
          'x-api-key':         apiKey,
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
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('   Beta hosted key: active (30 req/IP/day free)');
  } else {
    console.log('   Beta hosted key: NOT SET (users need own key)');
  }
  if (process.env.LICENSE_SECRET && process.env.LICENSE_SECRET !== 'dev-only-change-in-prod') {
    console.log('   License system:  active (/admin for keygen)');
  } else {
    console.log('   License system:  DEV MODE (set LICENSE_SECRET + ADMIN_SECRET in prod)');
  }
  console.log('  ============================================');
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
