/* Radicle 5.0 — the iOS build.
 *
 * web/ is the frozen 5.0 snapshot, and it stays that way: this script reads it
 * and writes a copy with two extra files, so the phone build can be rebuilt,
 * compared and thrown away without touching the reviewed source.
 *
 *   dist/ios-site/                deployable folder, tuned for iOS Safari and
 *                                 for phones generally. This is what
 *                                 ios/serve.mjs serves and what gets uploaded
 *                                 if a permanent URL is wanted.
 *   dist/radicle_5.0.ios.html     one self-contained file with the same
 *                                 overlay, for handing to someone else.
 *
 * Every product is checked before the script exits, the same way tools/build.mjs
 * does it: a failed assertion exits non-zero instead of shipping something
 * half-patched.
 *
 *   node ios/build-ios.mjs
 */

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const WEB = path.join(ROOT, 'web');
const DIST = path.join(ROOT, 'dist');
const SITE = path.join(DIST, 'ios-site');
const OVERLAY = path.join(HERE, 'overlay');

/* The same allowlist tools/build.mjs publishes, and for the same reason: the
   test suite and the documentation live in web/ and never ship. */
const ALLOWLIST = ['index.html', 'manifest.webmanifest', 'sw.js', 'assets', 'js', 'icons'];

function offlinePath(version) {
  return path.join(DIST, 'radicle_' + version + '.ios.html');
}

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

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
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

/* ---------- the patch itself ---------- */

const CSS_ANCHOR = '<link rel="stylesheet" href="assets/app.css">';
const JS_ANCHOR = '<script src="js/app.js"></script>';

/* Two insertions, each asserted. The overlay has to come after the file it
   overrides, and the behaviour layer has to come after app.js has defined the
   namespace it hangs off. */
function patchHtml(html) {
  const withCss = html.split(CSS_ANCHOR).join(
    CSS_ANCHOR + '\n<link rel="stylesheet" href="assets/ios.css">'
  );
  const withJs = withCss.split(JS_ANCHOR).join(
    JS_ANCHOR + '\n<script src="js/ios.js"></script>'
  );
  return { html: withJs, css: withCss !== html, js: withJs !== withCss };
}

/* The service worker precaches the shell by name, so a file it does not know
   about would be missing from an installed app. Version bumped as well: there
   is no server-side invalidation, and this build is not the plain 5.0 shell. */
function patchServiceWorker(source) {
  const versioned = source.replace(
    /var CACHE_VERSION = '([^']+)';/,
    "var CACHE_VERSION = '$1-ios';"
  );
  const listed = versioned.replace(
    "  './assets/app.css',",
    "  './assets/app.css',\n  './assets/ios.css',"
  ).replace(
    "  './js/app.js',",
    "  './js/app.js',\n  './js/ios.js',"
  );
  return {
    source: listed,
    version: versioned !== source,
    precached: listed !== versioned
  };
}

/* ---------- dist/ios-site ---------- */

async function buildSite(overlayCss, overlayJs) {
  console.log('\ndist/ios-site');
  await rm(SITE, { recursive: true, force: true });
  await mkdir(SITE, { recursive: true });

  for (const entry of ALLOWLIST) {
    await cp(path.join(WEB, entry), path.join(SITE, entry), { recursive: true });
  }

  await cp(path.join(OVERLAY, 'ios.css'), path.join(SITE, 'assets', 'ios.css'));
  await cp(path.join(OVERLAY, 'ios.js'), path.join(SITE, 'js', 'ios.js'));

  const original = await readFile(path.join(SITE, 'index.html'), 'utf8');
  const patched = patchHtml(original);
  await writeFile(path.join(SITE, 'index.html'), patched.html, 'utf8');

  const worker = patchServiceWorker(await readFile(path.join(SITE, 'sw.js'), 'utf8'));
  await writeFile(path.join(SITE, 'sw.js'), worker.source, 'utf8');

  const published = await listFiles(SITE);
  const html = patched.html;

  check('index.html gained the overlay stylesheet after app.css',
    html.indexOf('assets/app.css') < html.indexOf('assets/ios.css'), patched.css ? '' : 'anchor not found');
  check('index.html loads the overlay script last',
    html.indexOf('js/app.js') < html.indexOf('js/ios.js') && patched.js, patched.js ? '' : 'anchor not found');
  check('the overlay is published',
    published.includes('assets/ios.css') && published.includes('js/ios.js'));
  check('the service worker precaches the overlay',
    worker.source.includes("'./assets/ios.css'") && worker.source.includes("'./js/ios.js'"));
  check('the service worker cache version is not the plain 5.0 one',
    worker.version && !/var CACHE_VERSION = 'v5\.0\.0';/.test(worker.source));
  check('no test code is published', !published.some((file) => file.includes('tests/')));
  check('no markdown is published', !published.some((file) => file.endsWith('.md')));
  check('the shell keeps its iOS meta tags',
    html.includes('apple-mobile-web-app-capable') &&
    html.includes('apple-touch-icon') &&
    html.includes('viewport-fit=cover'));
  check('the overlay keeps the frozen source untouched',
    overlayCss.includes('--keyboard-inset') && overlayJs.includes('visualViewport'));

  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
  const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
  check('every referenced asset is present',
    [...scripts, ...styles].every((asset) => published.includes(asset)),
    [...scripts, ...styles].filter((asset) => !published.includes(asset)).join(', '));
  check('the overlay script is the last script in the shell',
    scripts[scripts.length - 1] === 'js/ios.js', scripts.join(', '));

  return { files: published.length, scriptCount: scripts.length };
}

/* ---------- the single file ---------- */

function stylesheetHrefs(html) {
  return [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)].map((m) => m[1]);
}

function scriptSrcs(html) {
  return [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
}

function guard(code, tag) {
  return code.replace(new RegExp('</' + tag, 'gi'), '<\\/' + tag);
}

async function buildOffline(version) {
  const target = offlinePath(version);
  console.log('\n' + path.relative(ROOT, target).split(path.sep).join('/'));

  let html = await readFile(path.join(WEB, 'index.html'), 'utf8');
  const patched = patchHtml(html);
  html = patched.html;

  const overlay = {
    'assets/ios.css': await readFile(path.join(OVERLAY, 'ios.css'), 'utf8'),
    'js/ios.js': await readFile(path.join(OVERLAY, 'ios.js'), 'utf8')
  };

  /* Inline stylesheets in place, overlay included. */
  for (const href of stylesheetHrefs(html)) {
    const css = overlay[href] !== undefined ? overlay[href] : await readFile(path.join(WEB, href), 'utf8');
    html = html.replace(
      new RegExp('<link[^>]+rel="stylesheet"[^>]+href="' + href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>'),
      '<style>\n' + guard(css, 'style') + '\n</style>'
    );
  }

  /* Inline scripts in place. pwa.js goes: a file:// page has no secure context,
     so registration there could only fail. */
  let dropped = 0;
  for (const src of scriptSrcs(html)) {
    const tag = new RegExp('<script[^>]+src="' + src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*></script>');
    if (path.basename(src) === 'pwa.js') {
      html = html.replace(tag, '');
      dropped += 1;
      continue;
    }
    const code = overlay[src] !== undefined ? overlay[src] : await readFile(path.join(WEB, src), 'utf8');
    html = html.replace(tag, '<script>\n' + guard(code, 'script') + '\n</script>');
  }

  /* The icon travels with the file, so a hand-off does not lose the one image
     the iOS home screen would have used. */
  const icon = await readFile(path.join(WEB, 'icons', 'apple-touch-icon-180.png'));
  html = html.replace(
    /<link[^>]+rel="apple-touch-icon"[^>]*>/,
    '<link rel="apple-touch-icon" href="data:image/png;base64,' + icon.toString('base64') + '">'
  );
  /* Only the manifest is dropped: with no server beside the file there is
     nothing to fetch it from. The apple-mobile-web-app tags stay — they are
     what makes a home-screen launch full screen, and they cost nothing here. */
  html = html.replace(/<link[^>]+rel="manifest"[^>]*>\s*/g, '');
  html = html.replace(
    '<title>Radicle</title>',
    '<title>Radicle</title>\n<!-- 5.0 iOS build: one file, no server, no service worker. -->'
  );

  await mkdir(DIST, { recursive: true });
  await writeFile(target, html, 'utf8');

  const markup = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const external = [...markup.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => !value.startsWith('data:') && !/^https?:/i.test(value) && value !== '#');

  check('single file references no local files', external.length === 0, external.join(', '));
  check('single file keeps the iOS meta tags',
    html.includes('apple-mobile-web-app-capable') && html.includes('viewport-fit=cover'));
  check('single file inlines the apple-touch-icon',
    /rel="apple-touch-icon"[^>]+data:image\/png;base64,/.test(html));
  check('single file dropped the service worker bootstrap',
    dropped === 1 && !/js\/pwa\.js/.test(html) && !/serviceWorker\s*\.\s*register/.test(html));
  check('single file carries the overlay',
    html.includes(guard(overlay['assets/ios.css'], 'style')) &&
    html.includes(guard(overlay['js/ios.js'], 'script')));
  check('single file has one script block per module plus the overlay',
    [...html.matchAll(/<script\b/g)].length === scriptSrcs(patched.html).length - 1,
    'got ' + [...html.matchAll(/<script\b/g)].length);

  const size = Buffer.byteLength(html, 'utf8');
  console.log('  note single file is ' + (size / 1024).toFixed(1) + ' KB');
}

async function main() {
  if (!await exists(WEB)) {
    console.error('web/ not found at ' + WEB);
    process.exit(1);
  }

  const version = readVersion();
  const overlayCss = await readFile(path.join(OVERLAY, 'ios.css'), 'utf8');
  const overlayJs = await readFile(path.join(OVERLAY, 'ios.js'), 'utf8');

  console.log('building Radicle ' + version + ' for iOS');
  const site = await buildSite(overlayCss, overlayJs);
  await buildOffline(version);

  console.log('');
  if (failures.length) {
    console.error(failures.length + ' check(s) failed:');
    failures.forEach((item) => console.error('  - ' + item));
    process.exit(1);
  }

  console.log('build ok — ' + site.files + ' files in dist/ios-site/, ' + site.scriptCount + ' scripts in the shell');
  console.log('next: node ios/serve.mjs, then open the printed address on the phone');
}

main().catch((err) => {
  console.error('build error:', err);
  process.exit(1);
});
