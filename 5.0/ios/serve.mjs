/* Radicle 5.0 — open it on a phone.
 *
 * Serves the iOS build over the local network so an iPhone (or anything else
 * on the same Wi-Fi) can open it in Safari, with the address printed twice:
 * once to read and once as a QR code to scan with the camera.
 *
 *   node ios/serve.mjs                       # dist/ios-site, port 5173
 *   node ios/serve.mjs --port 8080
 *   node ios/serve.mjs --dir web             # the unbuilt source, for comparing
 *   node ios/serve.mjs --verbose             # log every asset, not just pages
 *
 * No dependencies, and nothing is uploaded anywhere: the phone fetches the
 * files straight from this machine over your own network. */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { encode, toTerminal } from './qrcode.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8'
};

/* ---------- arguments ---------- */

function parseArgs(argv) {
  const options = { port: 5173, dir: 'dist/ios-site', qr: true, verbose: false, open: false, host: '0.0.0.0' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--port' || arg === '-p') options.port = Number(argv[++i]);
    else if (arg === '--dir' || arg === '-d') options.dir = argv[++i];
    else if (arg === '--no-qr') options.qr = false;
    else if (arg === '--verbose' || arg === '-v') options.verbose = true;
    else if (arg === '--open') options.open = true;
    else if (arg === '--host') options.host = argv[++i];
    else if (arg === '--help' || arg === '-h') options.help = true;
    else {
      console.error('unknown option: ' + arg);
      options.help = true;
    }
  }
  return options;
}

const USAGE = `
Radicle 5.0 — local server for phones

  node ios/serve.mjs [options]

  -p, --port <n>    port to listen on                     (default 5173)
  -d, --dir <path>  folder to serve, relative to 5.0/     (default dist/ios-site)
      --host <ip>   interface to bind                     (default 0.0.0.0)
      --no-qr       skip the QR code
  -v, --verbose     log every request, not just page loads
      --open        also open the address in this machine's browser
  -h, --help        this text
`;

const options = parseArgs(process.argv.slice(2));

/* ---------- addresses ---------- */

/* Best guess at the address a phone on the same Wi-Fi can reach, plus every
   other candidate, because on a machine with a VPN or a virtual adapter the
   right answer is not always the first one. Virtual ranges and the
   198.18.0.0/15 block that proxy tools hand out for fake DNS answers are
   listed but never recommended. */
function privateRank(address) {
  if (/^192\.168\./.test(address)) return 0;
  if (/^10\./.test(address)) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) return 2;
  return 3;
}

function addresses() {
  const found = [];
  const interfaces = networkInterfaces();
  for (const [name, list] of Object.entries(interfaces || {})) {
    for (const entry of list || []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      const suspect = entry.address.startsWith('169.254.') ||
        /^198\.1[89]\./.test(entry.address) ||
        /(virtual|vmware|vethernet|hyper-v|bluetooth|loopback|tap|tun|zerotier|tailscale)/i.test(name);
      found.push({ name, address: entry.address, rank: privateRank(entry.address) + (suspect ? 10 : 0) });
    }
  }
  return found.sort((a, b) => a.rank - b.rank);
}

/* ---------- static files ---------- */

const listen = { port: 5173, root: ROOT };

function header(value) {
  return String(value || '').replace(/[\r\n]/g, ' ');
}

async function resolveTarget(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded.replace(/^\/+/, '');
  const target = path.resolve(listen.root, relative);
  if (target !== listen.root && !target.startsWith(listen.root + path.sep)) return null;
  return target;
}

async function serveFile(target) {
  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      const index = path.join(target, 'index.html');
      const indexInfo = await stat(index).catch(() => null);
      if (!indexInfo || !indexInfo.isFile()) return null;
      return { body: await readFile(index), size: indexInfo.size, type: MIME['.html'], file: index };
    }
    if (!info.isFile()) return null;
    return {
      body: await readFile(target),
      size: info.size,
      type: MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      file: target
    };
  } catch {
    return null;
  }
}

/* A request with no file extension is a route, not an asset: the app is a hash
   router, so anything path-like has to fall back to the shell rather than 404. */
function looksLikeRoute(urlPath) {
  return !path.extname(urlPath.split('?')[0]);
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
    res.end('method not allowed\n');
    return;
  }

  const urlPath = (req.url || '/').split('#')[0];
  let target = await resolveTarget(urlPath);
  let result = target ? await serveFile(target) : null;

  /* A path that exists but has nothing to send (a folder with no index.html)
     is a 404, not a route: only paths that are absent can be the shell. */
  const present = !result && target ? await stat(target).then(() => true).catch(() => false) : false;
  if (!result && !present && looksLikeRoute(urlPath)) {
    target = path.join(listen.root, 'index.html');
    result = await serveFile(target);
  }

  if (!result) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('not found: ' + header(urlPath) + '\n');
    log(req, 404, urlPath, true);
    return;
  }

  const headers = {
    'Content-Type': result.type,
    'Content-Length': result.size,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') res.end();
  else res.end(result.body);
  log(req, 200, urlPath, false, Date.now() - started);
});

function log(req, status, urlPath, always, ms) {
  if (!always && !options.verbose && !looksLikeRoute(urlPath)) return;
  const remote = header(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const time = new Date().toTimeString().slice(0, 8);
  const timing = ms === undefined ? '' : ' ' + ms + 'ms';
  console.log('  ' + time + '  ' + status + '  ' + remote + '  ' + header(urlPath) + timing);
}

/* ---------- start ---------- */

if (options.help) {
  console.log(USAGE);
  process.exit(0);
}

if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
  console.error('bad port: ' + options.port);
  process.exit(1);
}

listen.root = path.resolve(ROOT, options.dir);
const rootInfo = await stat(listen.root).catch(() => null);
if (!rootInfo || !rootInfo.isDirectory()) {
  console.error('no such folder: ' + listen.root);
  if (options.dir === 'dist/ios-site') {
    console.error('build it first:  node ios/build-ios.mjs');
  }
  process.exit(1);
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('port ' + options.port + ' is already in use — pick another with --port.');
  } else {
    console.error('server error: ' + err.message);
  }
  process.exit(1);
});

server.listen(options.port, options.host, () => {
  const candidates = addresses();
  const best = candidates[0];
  const shown = best ? 'http://' + best.address + ':' + options.port + '/' : null;

  console.log('');
  console.log('  Radicle 5.0 — serving ' + path.relative(ROOT, listen.root).split(path.sep).join('/'));
  console.log('  on this machine:  http://localhost:' + options.port + '/');

  if (candidates.length) {
    console.log('');
    console.log('  open this on the phone:');
    for (const candidate of candidates) {
      const url = 'http://' + candidate.address + ':' + options.port + '/';
      const mark = candidate === best ? '  <-' : '';
      console.log('    ' + url.padEnd(34) + candidate.name + mark);
    }
  } else {
    console.log('');
    console.log('  no network address found — this machine looks offline.');
  }

  if (shown && options.qr) {
    console.log('');
    try {
      console.log('  scan this with the iPhone camera:');
      console.log('');
      for (const line of toTerminal(encode(shown))) console.log('  ' + line);
    } catch (err) {
      console.log('  (no QR code: ' + err.message + ')');
    }
  }

  if (shown) {
    console.log('  ' + shown);
  }

  console.log('');
  console.log('  the phone must be on the same Wi-Fi as this machine.');
  console.log('  if nothing loads, Windows Firewall is the usual reason — once, as administrator:');
  console.log('    New-NetFirewallRule -DisplayName "Radicle 5.0 LAN (TCP ' + options.port + ')" \\');
  console.log('      -Direction Inbound -Action Allow -Protocol TCP -LocalPort ' + options.port + ' -Profile Private');
  console.log('  over plain http the app works, but Safari will not cache it for offline use');
  console.log('  and cannot offer an install prompt; "add to home screen" still gives a full-screen app.');
  console.log('  Ctrl+C stops the server.');
  console.log('');

  if (options.open && shown) {
    /* Opening a browser is the one thing here that needs a shell; it is only
       ever the local address, and only when asked for. */
    import('node:child_process').then(({ spawn }) => {
      spawn('cmd', ['/c', 'start', '', shown], { detached: true, stdio: 'ignore' }).unref();
    });
  }
});

process.on('SIGINT', () => {
  console.log('\n  stopped\n');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500);
});
