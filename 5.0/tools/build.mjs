/* Radicle — packaging.
 *
 * The web/ folder stays a zero-build, directly runnable static site. This
 * script only packages it for distribution:
 *
 *   dist/site/              deployable PWA folder (allowlist: no tests, no docs)
 *   dist/radicle-offline.html   single self-contained file for offline hand-off
 *
 * Every product of this script is verified in-process; a failed assertion
 * exits non-zero rather than shipping a broken artefact.
 *
 *   node tools/build.mjs
 */

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const DIST = path.join(ROOT, 'dist');
const SITE = path.join(DIST, 'site');
/* The offline hand-off file is named after the shipping version so a folder of
   them is self-describing: radicle_3.0.0.html. */
function offlinePath(version) {
  return path.join(DIST, 'radicle_' + version + '.html');
}

/* The version lives in one place, config.js, and is read rather than repeated. */
function readVersion() {
  const source = readFileSync(path.join(WEB, 'js', 'config.js'), 'utf8');
  const match = /version:\s*'([^']+)'/.exec(source);
  if (!match) throw new Error('could not read CONFIG.version from web/js/config.js');
  return match[1];
}

const failures = [];

function check(label, condition, detail) {
  if (condition) {
    console.log('  ok   ' + label);
  } else {
    failures.push(label + (detail ? ' — ' + detail : ''));
    console.log('  FAIL ' + label + (detail ? ' — ' + detail : ''));
  }
}

/* ---------- HTML parsing (only ever fed our own markup) ---------- */

function stylesheetHrefs(html) {
  return [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)].map((m) => m[1]);
}

function scriptSrcs(html) {
  return [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
}

/* Keeps inlined code from prematurely closing its own container. */
function guardForInline(code, tag) {
  return code.replace(new RegExp('</' + tag, 'gi'), '<\\/' + tag);
}

async function listFiles(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const relative = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) found.push(...await listFiles(path.join(dir, entry.name), relative));
    else found.push(relative);
  }
  return found.sort();
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

/* ---------- dist/site ---------- */

/* Explicit allowlist: anything not named here is never published. */
const SITE_ALLOWLIST = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'assets',
  'js',
  'icons'
];

async function buildSite() {
  console.log('\ndist/site');
  await rm(SITE, { recursive: true, force: true });
  await mkdir(SITE, { recursive: true });

  for (const entry of SITE_ALLOWLIST) {
    const from = path.join(WEB, entry);
    const to = path.join(SITE, entry);
    await cp(from, to, { recursive: true });
  }

  const published = await listFiles(SITE);

  check('publishes index.html', published.includes('index.html'));
  check('publishes the service worker', published.includes('sw.js'));
  check('publishes the manifest', published.includes('manifest.webmanifest'));
  check('publishes no test code', !published.some((f) => f.includes('tests/')));
  check('publishes no markdown', !published.some((f) => f.endsWith('.md')));
  check('publishes js/pwa.js for the hosted build', published.includes('js/pwa.js'));
  check('publishes every icon referenced by the manifest',
    ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png', 'icons/apple-touch-icon-180.png']
      .every((icon) => published.includes(icon)), published.filter((f) => f.startsWith('icons/')).join(', '));

  const html = await readFile(path.join(SITE, 'index.html'), 'utf8');
  const referenced = [...stylesheetHrefs(html), ...scriptSrcs(html)];
  check('every asset index.html references is present',
    referenced.every((asset) => published.includes(asset)),
    referenced.filter((asset) => !published.includes(asset)).join(', '));

  return published;
}

/* ---------- offline single file ---------- */

async function buildOffline(version) {
  const OFFLINE = offlinePath(version);
  console.log('\n' + path.relative(ROOT, OFFLINE));

  let html = await readFile(path.join(WEB, 'index.html'), 'utf8');
  const cssFiles = stylesheetHrefs(html);
  const jsFiles = scriptSrcs(html);

  const cssText = [];
  for (const href of cssFiles) {
    cssText.push(await readFile(path.join(WEB, href), 'utf8'));
  }
  const jsText = [];
  for (const src of jsFiles) {
    jsText.push(await readFile(path.join(WEB, src), 'utf8'));
  }

  /* Inline stylesheets. */
  for (const href of cssFiles) {
    const css = await readFile(path.join(WEB, href), 'utf8');
    html = html.replace(
      new RegExp('<link[^>]+rel="stylesheet"[^>]+href="' + href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>'),
      '<style>\n' + guardForInline(css, 'style') + '\n</style>'
    );
  }

  /* Inline scripts, dropping the service worker bootstrap entirely: file:// has
     no secure context, so registration could only fail. */
  let droppedPwa = 0;
  for (const src of jsFiles) {
    const tag = new RegExp('<script[^>]+src="' + src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*></script>');
    if (path.basename(src) === 'pwa.js') {
      html = html.replace(tag, '');
      droppedPwa += 1;
      continue;
    }
    const code = await readFile(path.join(WEB, src), 'utf8');
    html = html.replace(tag, '<script>\n' + guardForInline(code, 'script') + '\n</script>');
  }

  /* Strip references that only resolve next to the hosted site. */
  html = html.replace(/<link[^>]+rel="manifest"[^>]*>\s*/g, '');
  html = html.replace(/<link[^>]+rel="apple-touch-icon"[^>]*>\s*/g, '');
  html = html.replace(/<meta[^>]+name="apple-mobile-web-app-[^"]*"[^>]*>\s*/g, '');
  html = html.replace(/<meta[^>]+name="mobile-web-app-capable"[^>]*>\s*/g, '');
  html = html.replace(
    /<title>Radicle<\/title>/,
    '<title>Radicle</title>\n<!-- Offline single-file build. Open by double-clicking; no service worker, no install prompt. -->'
  );

  await mkdir(DIST, { recursive: true });
  await writeFile(OFFLINE, html, 'utf8');

  /* The offline build is only trustworthy if it truly stands alone. Only the
     markup counts: the modules are inlined, so scanning the inlined source as
     well would flag any string in it that happens to look like an attribute —
     `href="' + ui.esc(hash) + '"` in the tab bar, for instance. */
  const markup = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const external = [...markup.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((value) => !value.startsWith('data:') && !/^https?:/i.test(value) && value !== '#');
  check('offline build references no local files', external.length === 0, external.join(', '));

  check('offline build dropped the service worker bootstrap', droppedPwa === 1 && !/js\/pwa\.js/.test(html));
  check('offline build never calls serviceWorker.register', !/serviceWorker\s*\.\s*register/.test(html));

  let lastIndex = -1;
  let ordered = true;
  for (let i = 0; i < jsText.length; i += 1) {
    const name = path.basename(jsFiles[i]);
    if (name === 'pwa.js') continue;
    const index = html.indexOf(guardForInline(jsText[i], 'script'));
    if (index === -1 || index < lastIndex) ordered = false;
    lastIndex = index;
  }
  check('every module is inlined in original load order', ordered);
  check('both stylesheets are inlined',
    cssText.every((css) => html.includes(guardForInline(css, 'style'))));

  const scripts = [...html.matchAll(/<script\b/g)].length;
  check('offline build has exactly one script block per module',
    scripts === jsFiles.length - 1, 'got ' + scripts);

  const size = Buffer.byteLength(html, 'utf8');
  console.log('  note offline bundle is ' + (size / 1024).toFixed(1) + ' KB');
}

async function main() {
  if (!await exists(WEB)) {
    console.error('web/ not found at ' + WEB);
    process.exit(1);
  }

  const version = readVersion();
  console.log('packaging Radicle ' + version);
  await buildSite();
  await buildOffline(version);

  console.log('');
  if (failures.length) {
    console.error(failures.length + ' check(s) failed:');
    failures.forEach((item) => console.error('  - ' + item));
    process.exit(1);
  }
  console.log('build ok');
}

main().catch((err) => {
  console.error('build error:', err);
  process.exit(1);
});
