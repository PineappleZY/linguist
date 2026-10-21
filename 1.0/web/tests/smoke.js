/* Radicle — dependency-free smoke test.
   Runs the storage and API layers in a stubbed browser environment so the
   request shape, JSON recovery, error matrix and history eviction can be
   verified without a real key or a browser.

   Usage:  node web/tests/smoke.js
*/

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS_DIR = path.join(__dirname, '..', 'js');

let passed = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log('  ok   ' + label);
  } else {
    failures.push(label + (detail ? ' — ' + detail : ''));
    console.log('  FAIL ' + label + (detail ? ' — ' + detail : ''));
  }
}

function section(title) {
  console.log('\n' + title);
}

/* ---------- Stubbed browser ---------- */

function createEnvironment() {
  const storage = new Map();
  const fetchCalls = [];
  let fetchImpl = () => {
    throw new Error('fetch stub not configured');
  };

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Promise,
    JSON,
    Date,
    Math,
    Object,
    Array,
    String,
    Number,
    Error,
    Blob: function Blob() {},
    AbortController,
    FileReader: function FileReader() {},
    URL: { createObjectURL: () => 'blob:stub', revokeObjectURL: () => {} }
  };

  const localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
  };

  const documentStub = {
    readyState: 'complete',
    documentElement: { setAttribute: () => {} },
    body: { setAttribute: () => {}, appendChild: () => {}, removeChild: () => {} },
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, click: () => {}, style: {} }),
    getElementById: () => null,
    addEventListener: () => {},
    querySelectorAll: () => []
  };

  const winListeners = {};

  const windowStub = {
    localStorage,
    document: documentStub,
    location: { hash: '#/dictionary', replace: () => {}, protocol: 'http:', hostname: 'localhost' },
    setTimeout,
    clearTimeout,
    navigator: {
      onLine: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      serviceWorker: { register: () => Promise.resolve() }
    },
    matchMedia: () => ({ matches: false }),
    addEventListener: (type, handler) => { winListeners[type] = handler; },
    fetch: (...args) => {
      fetchCalls.push(args);
      return fetchImpl(...args);
    }
  };

  sandbox.window = windowStub;
  sandbox.document = documentStub;
  sandbox.localStorage = localStorage;
  sandbox.navigator = windowStub.navigator;
  sandbox.location = windowStub.location;

  vm.createContext(sandbox);

  ['config.js', 'store.js', 'speech.js', 'ui.js', 'api.js', 'pwa.js',
    'view-dictionary.js', 'view-word.js', 'view-profile.js'].forEach((file) => {
    const code = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  });

  return {
    ns: sandbox.window.RADICLE,
    storage,
    fetchCalls,
    winListeners,
    setFetch(fn) { fetchImpl = fn; }
  };
}

function jsonResponse(body, status) {
  return Promise.resolve({
    ok: (status || 200) < 400,
    status: status || 200,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body))
  });
}

function completion(content) {
  return { choices: [{ message: { content }, finish_reason: 'stop' }] };
}

/* ---------- Storage ---------- */

async function testStore(env) {
  const store = env.ns.store;

  section('Storage');

  check('defaults come from config', store.getSettings().model === 'deepseek-flash');
  check('default output language is Chinese', store.getSettings().outputLang === 'zh');

  const id = store.entryId('Ephemeral', 'deepseek-flash', 'zh');
  check('entry id is stable and lower-cased', id === 'ephemeral--deepseek-flash--zh', id);
  check('entry id separates output languages',
    store.entryId('flâner', 'deepseek-flash', 'fr') !== store.entryId('flâner', 'deepseek-flash', 'en'));

  store.saveEntry({
    id,
    word: 'ephemeral',
    language: 'en',
    overview: { quick_meaning: 'Lasting very briefly.', pos: 'adj.' },
    deep: { senses: [] },
    ts: Date.now()
  });
  check('entry round-trips through storage', !!store.getEntry(id));
  check('history row carries the summary',
    store.listHistory()[0].quickMeaning === 'Lasting very briefly.');

  store.toggleStar(id);
  check('star toggles on', store.isStarred(id) === true);
  store.toggleStar(id);
  check('star toggles off', store.isStarred(id) === false);

  store.clearHistory();
  const keep = store.entryId('keeper', 'deepseek-flash', 'zh');
  store.saveEntry({ id: keep, word: 'keeper', overview: { quick_meaning: 'k' }, ts: Date.now() });
  store.toggleStar(keep);
  for (let i = 0; i < 520; i += 1) {
    const filler = 'w' + i;
    store.saveEntry({
      id: store.entryId(filler, 'deepseek-flash', 'zh'),
      word: filler,
      overview: { quick_meaning: 'f' },
      ts: Date.now() + i
    });
  }
  const rows = store.listHistory();
  check('history is capped at 500', rows.length === 500, 'got ' + rows.length);
  check('starred entry survived eviction', store.isStarred(keep) === true);

  const backup = store.exportAll();
  check('export carries a marked kind', /-backup$/.test(backup.kind), backup.kind);
  check('export omits the API key', !('apiKey' in backup.settings));
  const historyBefore = store.listHistory().length;
  store.clearHistory();
  const restored = store.importAll(JSON.parse(JSON.stringify(backup)));
  check('import restores entries', restored === historyBefore, restored + ' vs ' + historyBefore);
  check('import keeps stars', store.isStarred(keep) === true);

  let rejected = false;
  try {
    store.importAll({ kind: 'something-else', history: [] });
  } catch (err) {
    rejected = true;
  }
  check('import rejects foreign files', rejected);
}

/* ---------- Request shape ---------- */

async function testApiShape(env) {
  const api = env.ns.api;

  section('Request shape');

  let captured = null;
  env.setFetch((url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return jsonResponse(completion('{"status":"ok","word":"ephemeral"}'));
  });

  await api.overview({
    apiKey: 'sk-test',
    model: 'deepseek-flash',
    outputLang: 'zh',
    input: 'ephemeral'
  });

  check('posts to the chat completions endpoint',
    captured.url === 'https://api.deepseek.com/chat/completions', captured.url);
  check('sends a bearer token', captured.options.headers.Authorization === 'Bearer sk-test');
  check('requests json_object output', captured.body.response_format.type === 'json_object');
  check('disables thinking on the overview pass', captured.body.thinking.type === 'disabled');
  check('uses the selected model', captured.body.model === 'deepseek-flash');
  check('temperature is sent only when thinking is off',
    captured.body.temperature === 0.3 && captured.body.reasoning_effort === undefined);

  const system = captured.body.messages[0].content;
  check('system prompt asks for json', /json/i.test(system));
  check('system prompt is localised to Chinese', /Simplified Chinese/.test(system));
  check('user message carries the headword', captured.body.messages[1].content.indexOf('ephemeral') > -1);

  section('Deep pass');

  await api.deep({
    apiKey: 'sk-test',
    model: 'deepseek-v4-pro',
    outputLang: 'fr',
    thinking: true,
    overview: {
      word: 'flâner',
      language: 'fr',
      pos: 'v.',
      quick_meaning: 'errer sans but',
      register: 'literary'
    }
  });

  check('deep pass honours the thinking switch', captured.body.thinking.type === 'enabled');
  check('thinking mode sends reasoning_effort', captured.body.reasoning_effort === 'high');
  check('thinking mode omits temperature', captured.body.temperature === undefined);
  check('deep pass writes in French', /French/.test(captured.body.messages[0].content));
  check('deep pass receives the overview as context',
    captured.body.messages[1].content.indexOf('flâner') > -1);
}

/* ---------- Behaviour ---------- */

async function testApiBehaviour(env) {
  const api = env.ns.api;

  section('Behaviour');

  env.setFetch(() => jsonResponse(completion('```json\n{"status":"ok"}\n```')));
  const fenced = await api.overview({ apiKey: 'k', model: 'deepseek-flash', outputLang: 'en', input: 'x' });
  check('recovers json wrapped in a markdown fence', fenced.status === 'ok');

  env.setFetch(() => jsonResponse(completion('Sure! Here it is: {"status":"ok","word":"x"} Hope that helps.')));
  const prose = await api.overview({ apiKey: 'k', model: 'deepseek-flash', outputLang: 'en', input: 'x' });
  check('recovers json embedded in prose', prose.word === 'x');

  env.setFetch(() => jsonResponse(completion('')));
  let emptyKind = null;
  try {
    await api.overview({ apiKey: 'k', model: 'deepseek-flash', outputLang: 'en', input: 'x' });
  } catch (err) {
    emptyKind = err.kind;
  }
  check('empty content raises bad_json', emptyKind === 'bad_json', String(emptyKind));

  env.setFetch(() => jsonResponse({ error: { message: 'Authentication Fails' } }, 401));
  let authKind = null;
  try {
    await api.overview({ apiKey: 'bad', model: 'deepseek-flash', outputLang: 'en', input: 'x' });
  } catch (err) {
    authKind = err.kind;
  }
  check('401 maps to the auth kind', authKind === 'auth', String(authKind));

  env.setFetch(() => jsonResponse({ error: { message: 'Insufficient Balance' } }, 402));
  let balanceKind = null;
  try {
    await api.overview({ apiKey: 'k', model: 'deepseek-flash', outputLang: 'en', input: 'x' });
  } catch (err) {
    balanceKind = err.kind;
  }
  check('402 maps to the balance kind', balanceKind === 'balance', String(balanceKind));

  let attempts = 0;
  env.setFetch(() => {
    attempts += 1;
    if (attempts === 1) return jsonResponse({ error: { message: 'rate limited' } }, 429);
    return jsonResponse(completion('{"status":"ok","word":"retry"}'));
  });
  const retried = await api.overview({ apiKey: 'k', model: 'deepseek-flash', outputLang: 'en', input: 'x' });
  check('429 is retried once and then succeeds',
    retried.word === 'retry' && attempts === 2, 'attempts=' + attempts);

  env.setFetch(() => jsonResponse({ error: { message: 'rate limited' } }, 429));
  let limitedKind = null;
  try {
    await api.overview({ apiKey: 'k', model: 'deepseek-flash', outputLang: 'en', input: 'x' });
  } catch (err) {
    limitedKind = err.kind;
  }
  check('persistent 429 surfaces as rate_limit', limitedKind === 'rate_limit', String(limitedKind));

  let noKeyKind = null;
  try {
    await api.overview({ apiKey: '', model: 'deepseek-flash', outputLang: 'en', input: 'x' });
  } catch (err) {
    noKeyKind = err.kind;
  }
  check('missing key is caught before any request', noKeyKind === 'no_key', String(noKeyKind));

  env.setFetch(() => Promise.reject(new TypeError('Failed to fetch')));
  let networkKind = null;
  try {
    await api.overview({ apiKey: 'k', model: 'deepseek-flash', outputLang: 'en', input: 'x' });
  } catch (err) {
    networkKind = err.kind;
  }
  check('fetch rejection maps to network', networkKind === 'network', String(networkKind));

  env.setFetch(() => jsonResponse(completion('{"status":"ok","candidates":[{"word":"nostalgia"}]}')));
  const candidates = await api.candidates({ apiKey: 'k', model: 'deepseek-flash', outputLang: 'zh', input: '乡愁' });
  check('candidate lookup returns a list', candidates.candidates.length === 1);

  env.setFetch(() => jsonResponse(completion('ok')));
  const connection = await api.testConnection({ apiKey: 'k', model: 'deepseek-flash' });
  check('connection test reports success', connection.ok === true);
}

/* ---------- PWA assets ---------- */

const WEB_DIR = path.join(__dirname, '..');
const REPO_DIR = path.join(WEB_DIR, '..');

/* The published surface is an allowlist, so it is spelled out here rather than
   derived: adding a file to web/ without deciding to publish it must fail. */
const EXPECTED_SITE_FILES = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'assets/app.css',
  'assets/tokens.css',
  'js/api.js',
  'js/app.js',
  'js/config.js',
  'js/pwa.js',
  'js/speech.js',
  'js/store.js',
  'js/ui.js',
  'js/view-dictionary.js',
  'js/view-profile.js',
  'js/view-word.js',
  'icons/apple-touch-icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512-maskable.png',
  'icons/icon-512.png'
];

function testPwaAssets() {
  const fsx = require('fs');

  section('PWA assets');

  const manifestPath = path.join(WEB_DIR, 'manifest.webmanifest');
  check('manifest ships with the app', fsx.existsSync(manifestPath));

  let manifest = null;
  try {
    manifest = JSON.parse(fsx.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    check('manifest is valid JSON', false, err.message);
  }

  if (manifest) {
    check('manifest is valid JSON', true);
    ['name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color', 'lang']
      .forEach((field) => {
        check('manifest has ' + field, typeof manifest[field] === 'string' && manifest[field].length > 0);
      });
    check('manifest opens standalone', manifest.display === 'standalone');
    check('manifest start_url stays relative', manifest.start_url === './');

    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    check('manifest declares icons', icons.length >= 3);
    check('every icon file exists on disk', icons.every((icon) =>
      fsx.existsSync(path.join(WEB_DIR, icon.src))), icons.map((i) => i.src).join(', '));
    check('every icon declares a size and type',
      icons.every((icon) => /\d+x\d+/.test(icon.sizes || '') && icon.type === 'image/png'));
    check('exactly one maskable icon is declared',
      icons.filter((icon) => (icon.purpose || '') === 'maskable').length === 1);
    check('a 192 and a 512 icon are declared',
      icons.some((icon) => icon.sizes === '192x192') && icons.some((icon) => icon.sizes === '512x512'));
  }

  const html = fsx.readFileSync(path.join(WEB_DIR, 'index.html'), 'utf8');
  check('index.html links the manifest', /rel="manifest"[^>]*manifest\.webmanifest/.test(html));
  check('index.html links the apple touch icon', /rel="apple-touch-icon"/.test(html));
  check('index.html sets the iOS app title', /name="apple-mobile-web-app-title"[^>]*Radicle/.test(html));
  check('index.html loads the pwa module', /<script[^>]+src="js\/pwa\.js"/.test(html));

  const sw = fsx.readFileSync(path.join(WEB_DIR, 'sw.js'), 'utf8');
  const precache = [...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
  check('service worker precaches assets', precache.length > 10);
  check('every precached path exists on disk',
    precache.every((entry) => entry === '' || fsx.existsSync(path.join(WEB_DIR, entry))),
    precache.filter((entry) => entry !== '' && !fsx.existsSync(path.join(WEB_DIR, entry))).join(', '));
  check('every precached path is same-origin',
    !/['"]https?:\/\//.test(sw.split('PRECACHE')[1] || ''), 'precache list must not contain absolute URLs');
}

/* ---------- Service worker behaviour ---------- */

/* Loads sw.js in a stub scope so the caching rules can be driven directly.
   The security-critical assertion is that a request carrying an API key is
   never read from or written to Cache Storage. */
function createServiceWorkerHarness() {
  const log = [];
  const stores = new Map();
  const listeners = {};
  const ORIGIN = 'https://radicle.example';

  /* A real Cache Storage keys by resolved absolute URL, so './assets/app.css'
     and 'https://host/assets/app.css' are the same entry. Model that. */
  function keyOf(request) {
    const raw = typeof request === 'string' ? request : request.url;
    try {
      return new URL(raw, ORIGIN + '/').href;
    } catch (err) {
      return raw;
    }
  }

  function openStore(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      addAll(list) {
        list.forEach((entry) => {
          const key = keyOf(entry);
          log.push('write:' + key);
          store.set(key, { ok: true, clone: () => ({ ok: true }) });
        });
        return Promise.resolve();
      },
      put(request) {
        log.push('write:' + keyOf(request));
        store.set(keyOf(request), { ok: true });
        return Promise.resolve();
      },
      match(request) {
        log.push('read:' + keyOf(request));
        return Promise.resolve(store.get(keyOf(request)));
      }
    };
  }

  const caches = {
    open: (name) => Promise.resolve(openStore(name)),
    keys: () => Promise.resolve([...stores.keys()]),
    delete: (name) => { log.push('delete:' + name); return Promise.resolve(stores.delete(name)); },
    match: (request) => {
      log.push('read:' + keyOf(request));
      for (const store of stores.values()) {
        if (store.has(keyOf(request))) return Promise.resolve(store.get(keyOf(request)));
      }
      return Promise.resolve(undefined);
    }
  };

  const fetchLog = [];
  const scope = {
    console,
    Promise,
    URL,
    caches,
    fetch: (request) => {
      fetchLog.push(keyOf(request));
      return Promise.resolve({ ok: true, clone: () => ({ ok: true }) });
    },
    self: {
      location: { origin: ORIGIN },
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
      addEventListener: (type, handler) => { listeners[type] = handler; }
    }
  };
  scope.self.self = scope.self;

  vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(WEB_DIR, 'sw.js'), 'utf8'), scope, { filename: 'sw.js' });

  function makeRequest(url, options) {
    const opts = options || {};
    const headerMap = new Map(
      Object.entries(opts.headers || {}).map(([name, value]) => [name.toLowerCase(), value])
    );
    return {
      url,
      method: opts.method || 'GET',
      mode: opts.mode || 'cors',
      headers: {
        has: (name) => headerMap.has(String(name).toLowerCase()),
        get: (name) => headerMap.get(String(name).toLowerCase()) || null
      }
    };
  }

  /* Runs the fetch handler and reports how it responded. */
  function dispatch(request) {
    log.length = 0;
    fetchLog.length = 0;
    let responded = null;
    const event = {
      request,
      respondWith: (value) => { responded = value; }
    };
    listeners.fetch(event);
    return Promise.resolve(responded).then(() => ({
      handled: responded !== null,
      cacheOps: log.slice(),
      fetched: fetchLog.slice()
    }));
  }

  function install() {
    let work = null;
    listeners.install({ waitUntil: (value) => { work = value; } });
    return Promise.resolve(work).then(() => log.slice());
  }

  return { dispatch, install, makeRequest, log, stores };
}

async function testServiceWorker() {
  const sw = createServiceWorkerHarness();

  section('Service worker');

  const installLog = await sw.install();
  check('install precaches the shell', installLog.length > 10);
  check('install precaches index.html', installLog.includes('write:https://radicle.example/index.html'));

  const apiCall = await sw.dispatch(sw.makeRequest('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { authorization: 'Bearer sk-secret', 'content-type': 'application/json' }
  }));
  check('the API call is not intercepted', apiCall.handled === false);
  check('the API call touches no cache', apiCall.cacheOps.length === 0, apiCall.cacheOps.join(', '));

  const keyedGet = await sw.dispatch(sw.makeRequest('https://radicle.example/index.html', {
    headers: { authorization: 'Bearer sk-secret' }
  }));
  check('a same-origin request carrying a key is not intercepted', keyedGet.handled === false);
  check('a same-origin request carrying a key touches no cache',
    keyedGet.cacheOps.length === 0, keyedGet.cacheOps.join(', '));

  const crossOriginGet = await sw.dispatch(sw.makeRequest('https://api.deepseek.com/models'));
  check('a cross-origin GET is not intercepted', crossOriginGet.handled === false);
  check('a cross-origin GET touches no cache', crossOriginGet.cacheOps.length === 0);

  const write = await sw.dispatch(sw.makeRequest('https://radicle.example/#/dictionary'));
  check('a same-origin asset never reaches the API host', !write.fetched.some((url) => url.includes('deepseek')));

  const asset = await sw.dispatch(sw.makeRequest('https://radicle.example/assets/app.css'));
  check('a static asset is intercepted', asset.handled === true);
  check('a precached asset is served from cache without touching the network',
    asset.fetched.length === 0, asset.cacheOps.join(', '));

  const fresh = await sw.dispatch(sw.makeRequest('https://radicle.example/assets/new.css'));
  check('an uncached asset falls back to the network', fresh.fetched.length === 1);
  check('the network response is cached', fresh.cacheOps.includes('write:https://radicle.example/assets/new.css'));

  const navigation = await sw.dispatch(sw.makeRequest('https://radicle.example/', {
    mode: 'navigate',
    headers: { accept: 'text/html' }
  }));
  check('a navigation is served the app shell', navigation.handled === true);
  check('the app shell is served from cache',
    navigation.cacheOps.includes('read:https://radicle.example/index.html'), navigation.cacheOps.join(', '));

  const post = await sw.dispatch(sw.makeRequest('https://radicle.example/data', { method: 'POST' }));
  check('a same-origin POST is not intercepted', post.handled === false);
}

/* ---------- Distribution artefacts ---------- */

async function testInstallState(env) {
  const pwa = env.ns.pwa;

  section('Install state');

  check('pwa module is present', !!pwa);
  await pwa.init();
  check('registration succeeds on a local address', pwa.secureContext() === true);
  check('a plain browser reports manual installation', pwa.state() === 'manual');

  let prevented = false;
  env.winListeners.beforeinstallprompt({
    preventDefault: () => { prevented = true; },
    prompt: () => Promise.resolve(),
    userChoice: Promise.resolve({ outcome: 'accepted' })
  });
  check('the install prompt is suppressed until asked for', prevented === true);
  check('capturing the prompt switches state to prompt', pwa.state() === 'prompt');

  const outcome = await pwa.promptInstall();
  check('the deferred prompt resolves the user choice', outcome === 'accepted', String(outcome));
  check('the prompt is consumed after use', pwa.state() === 'manual');

  env.winListeners.appinstalled();
  check('appinstalled marks the app as installed', pwa.state() === 'installed');
}

/* The Profile row is the only place install state surfaces, so check that the
   rendered copy tracks the state rather than showing a dead button. */
function testInstallRowReflectsState(env) {
  const profile = createContainer();
  env.ns.views.profile.render(profile, {});
  check('an installed app shows the installed chip', /chip-good/.test(profile.innerHTML));
  check('an installed app shows no install button', !/id="install-app"/.test(profile.innerHTML));
}

async function testDistribution() {
  const fsx = require('fs');
  const { execFileSync } = require('child_process');

  section('Distribution');

  try {
    execFileSync(process.execPath, [path.join(REPO_DIR, 'tools', 'build.mjs')], { stdio: 'pipe' });
  } catch (err) {
    check('the packaging script succeeds', false, String(err.stdout || err.message).slice(0, 400));
    return;
  }
  check('the packaging script succeeds', true);

  const siteDir = path.join(REPO_DIR, 'dist', 'site');
  const published = [];
  (function walk(dir, prefix) {
    fsx.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const relative = prefix ? prefix + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), relative);
      else published.push(relative);
    });
  })(siteDir, '');
  published.sort();

  const expected = EXPECTED_SITE_FILES.slice().sort();
  check('the deploy folder matches the allowlist exactly',
    published.join('\n') === expected.join('\n'),
    'missing: ' + expected.filter((f) => !published.includes(f)).join(', ') +
    ' | unexpected: ' + published.filter((f) => !expected.includes(f)).join(', '));

  const offlinePath = path.join(REPO_DIR, 'dist', 'radicle-offline.html');
  check('the offline bundle exists', fsx.existsSync(offlinePath));

  const offline = fsx.readFileSync(offlinePath, 'utf8');
  const external = [...offline.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((value) => !value.startsWith('data:') && !/^https?:/i.test(value) && value !== '#');
  check('the offline bundle references no local files', external.length === 0, external.join(', '));
  check('the offline bundle embeds no service worker registration',
    !/serviceWorker\s*\.\s*register/.test(offline));
  check('the offline bundle embeds no manifest link', !/rel="manifest"/.test(offline));
  check('the offline bundle is genuinely one file', offline.length > 50000);

  const modules = ['config.js', 'store.js', 'speech.js', 'ui.js', 'api.js',
    'view-dictionary.js', 'view-word.js', 'view-profile.js', 'app.js'];
  const positions = modules.map((name) => {
    const source = fsx.readFileSync(path.join(WEB_DIR, 'js', name), 'utf8');
    return offline.indexOf(source.replace(/<\/script/gi, '<\\/script'));
  });
  check('every module is inlined', positions.every((index) => index > -1));
  check('modules keep their load order',
    positions.every((index, i) => i === 0 || index > positions[i - 1]));
  check('the offline bundle leaves pwa.js out',
    offline.indexOf('ns.pwa = {') === -1);
}

/* ---------- Entry point ---------- */

/* ---------- Render layer ---------- */

/* Minimal container: the views only need innerHTML plus query hooks that can
   report "nothing found", which is enough to capture what they render. */
function createContainer() {
  return {
    _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(value) { this._html = value; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

async function testRendering(env) {
  const ns = env.ns;
  const store = ns.store;

  section('Render layer');

  /* Segmented controls must serialise to markup, never to a DOM node. */
  const segmented = ns.ui.segmented(
    [{ id: 'all', label: 'All' }, { id: 'starred', label: 'Starred' }],
    'all',
    'history'
  );
  check('segmented control returns a markup string', typeof segmented === 'string');
  check('segmented control carries its group', /data-segmented="history"/.test(segmented));
  check('segmented control marks the active segment', /aria-pressed="true"/.test(segmented));

  /* Starred rows survive clearHistory by design, so clear both to reach the
     first-run empty state. */
  store.clearStarred();
  store.clearHistory();
  const dictionary = createContainer();
  ns.views.dictionary.render(dictionary, {});
  const dictHtml = dictionary.innerHTML;
  check('dictionary screen renders a search field', /id="lookup-input"/.test(dictHtml));
  check('dictionary screen renders the history filter', /data-segmented="history"/.test(dictHtml));
  check('dictionary screen shows the no-key guidance',
    /Add your DeepSeek API key to begin/.test(dictHtml));
  check('dictionary screen names the product', dictHtml.indexOf(ns.CONFIG.appName) > -1);
  check('no view leaks a raw DOM node into markup', dictHtml.indexOf('[object') === -1);

  /* With history present the list path must render instead of the empty state. */
  store.saveEntry({
    id: store.entryId('liminal', 'deepseek-flash', 'zh'),
    word: 'liminal',
    language: 'en',
    status: 'ok',
    ts: Date.now(),
    overview: { word: 'liminal', pos: 'adj.', quick_meaning: '阈限的' }
  });
  const dictionary2 = createContainer();
  ns.views.dictionary.render(dictionary2, {});
  const dictHtml2 = dictionary2.innerHTML;
  check('history list renders a row', /data-open="/.test(dictHtml2));
  check('history row shows the summary', /阈限的/.test(dictHtml2));
  check('history row exposes a star toggle', /data-star="/.test(dictHtml2));
  check('empty state is replaced once history exists',
    /Add your DeepSeek API key to begin/.test(dictHtml2) === false);

  /* A fully populated entry should produce all nine deep cards, in order. */
  const fullEntry = {
    id: store.entryId('ephemeral', 'deepseek-flash', 'zh'),
    word: 'ephemeral',
    language: 'en',
    status: 'ok',
    ts: Date.now(),
    starred: true,
    overview: { word: 'ephemeral', ipa: '/ɪˈfem(ə)rəl/', pos: 'adj.', quick_meaning: '短暂的', tags: ['time'], register: 'formal' },
    deep: {
      senses: [{ pos: 'adj.', definition: '持续极短时间的', examples: [{ text: 'ephemeral pleasures', translation: '短暂的欢愉' }] }],
      collocations: [{ phrase: 'ephemeral nature', meaning: '短暂的本质' }],
      usage_notes: ['多用于书面语'],
      etymology: { origin_chain: ['Greek ephemeros', 'Latin ephemerus', 'Modern English'], root_form: 'ephemeros', first_attested: 'c. 1570', story: '原义为期一天的。', certainty: 'high' },
      morphology: { prefixes: [{ form: 'epi-', meaning: 'on, upon', origin: 'Greek' }], roots: [{ form: 'hemer', meaning: 'day', origin: 'Greek' }], suffixes: [{ form: '-al', meaning: 'adjective', origin: 'Latin' }] },
      cognates: [{ word: 'éphémère', language: 'French', relation: 'same Greek root' }],
      cultural_notes: ['常用于谈名声与生命'],
      confusables: [{ word: 'evanescent', distinction: '强调消散的过程' }],
      mnemonic: 'epi + hemera：只在一天之上。'
    }
  };
  store.saveEntry(fullEntry);

  const wordScreen = createContainer();
  ns.views.word.render(wordScreen, { id: fullEntry.id });
  const wordHtml = wordScreen.innerHTML;
  ['Senses', 'Collocations', 'Usage', 'Etymology', 'Morphology', 'Cognates', 'Culture', 'Confusables', 'Mnemonic']
    .forEach((title) => {
      check('deep card renders: ' + title, wordHtml.indexOf('>' + title + '<') > -1);
    });
  check('entry header shows the headword', /ephemeral/.test(wordHtml));
  check('entry header shows the IPA', /ɪˈfem/.test(wordHtml));
  check('etymology chain renders as nodes', /class="etym-node"/.test(wordHtml));
  check('morphology groups render', /class="morph-label"/.test(wordHtml));
  check('entry markup is escaped', wordHtml.indexOf('[object') === -1);

  /* Sparse payloads must not emit empty shells. */
  const sparse = {
    id: store.entryId('sparse', 'deepseek-flash', 'zh'),
    word: 'sparse',
    language: 'en',
    status: 'ok',
    ts: Date.now(),
    overview: { word: 'sparse', quick_meaning: '稀少的' },
    deep: { senses: [], collocations: [], usage_notes: [], cognates: [], cultural_notes: [], confusables: [] }
  };
  store.saveEntry(sparse);
  const sparseScreen = createContainer();
  ns.views.word.render(sparseScreen, { id: sparse.id });
  const sparseHtml = sparseScreen.innerHTML;
  check('sparse entry renders no empty deep cards',
    ['Senses', 'Collocations', 'Usage', 'Etymology', 'Morphology', 'Cognates', 'Culture', 'Confusables', 'Mnemonic']
      .every((title) => sparseHtml.indexOf('>' + title + '<') === -1));
  check('sparse entry still shows the headword', /sparse/.test(sparseHtml));

  /* Injection attempt must be neutralised. */
  const hostile = {
    id: store.entryId('hostile', 'deepseek-flash', 'zh'),
    word: '<img src=x onerror=alert(1)>',
    language: 'en',
    status: 'ok',
    ts: Date.now(),
    overview: { word: '<img src=x onerror=alert(1)>', quick_meaning: '<script>alert(2)</script>' }
  };
  store.saveEntry(hostile);
  const hostileScreen = createContainer();
  ns.views.word.render(hostileScreen, { id: hostile.id });
  const hostileHtml = hostileScreen.innerHTML;
  check('model output is HTML-escaped', hostileHtml.indexOf('<img src=x') === -1);
  check('script tags from model output are escaped', hostileHtml.indexOf('<script>alert(2)</script>') === -1);
  check('escaped payload is still visible as text', hostileHtml.indexOf('&lt;img src=x') > -1);

  const profile = createContainer();
  ns.views.profile.render(profile, {});
  const profileHtml = profile.innerHTML;
  ['model', 'lang', 'theme'].forEach((group) => {
    check('profile renders the ' + group + ' control',
      profileHtml.indexOf('data-segmented="' + group + '"') > -1);
  });
  check('profile renders the API key field', /id="api-key"/.test(profileHtml));
  check('profile renders the thinking switch', /id="thinking-switch"/.test(profileHtml));
  check('profile states the key stays on device', /this browser only/.test(profileHtml));
  check('profile segmented controls appear exactly once each',
    countOccurrences(profileHtml, 'data-segmented="model"') === 1);
}

(async function main() {
  const env = createEnvironment();
  await testStore(env);
  await testApiShape(env);
  await testApiBehaviour(env);
  await testRendering(env);
  testPwaAssets();
  await testServiceWorker();
  await testInstallState(env);
  testInstallRowReflectsState(env);
  await testDistribution();

  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  if (failures.length) {
    failures.forEach((item) => console.log('  - ' + item));
    process.exitCode = 1;
  }
})().catch((err) => {
  console.error('Harness error:', err);
  process.exitCode = 1;
});
