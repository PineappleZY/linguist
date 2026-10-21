/* RADICLE 2.0 — dependency-free smoke test.

   Runs the storage, prompt, API, spell and render layers inside a stubbed
   browser environment, plus the service worker in a stubbed worker scope.
   No network, no key, no browser required.

   Usage:  node 2.0/web/tests/smoke.js
*/

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB_DIR = path.join(__dirname, '..');
/* The version folder that owns tools/ and dist/ for this build. */
const REPO_DIR = path.join(WEB_DIR, '..');
const JS_DIR = path.join(WEB_DIR, 'js');

/* Load order mirrors index.html. Prompt templates must exist before api.js
   reads them, and spell.js before the word view calls into it. */
const LOAD_ORDER = [
  'config.js', 'prompts.js', 'store.js', 'speech.js', 'ui.js', 'spell.js',
  'api.js', 'pwa.js', 'view-dictionary.js', 'view-word.js', 'view-profile.js'
];

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
  const winListeners = {};
  let fetchImpl = () => {
    throw new Error('fetch stub not configured');
  };

  const sandbox = {
    console, setTimeout, clearTimeout, Promise, JSON, Date, Math, Object, Array,
    String, Number, Error, AbortController, URL,
    Blob: function Blob() {},
    FileReader: function FileReader() {}
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
    body: { setAttribute: () => {}, appendChild: () => {}, removeChild: () => {}, classList: { add: () => {}, remove: () => {} } },
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, click: () => {}, style: {} }),
    getElementById: () => null,
    addEventListener: () => {},
    querySelectorAll: () => []
  };

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
  LOAD_ORDER.forEach((file) => {
    const code = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  });

  return {
    ns: sandbox.window.RADICLE,
    storage,
    fetchCalls,
    winListeners,
    location: windowStub.location,
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

/* Lets the view's internal promise chains settle before we inspect the DOM. */
function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function sampleEntry(ns, store, overrides) {
  const word = (overrides && overrides.word) || 'contend';
  const base = {
    id: store.entryId(word, 'deepseek-flash', 'zh'),
    schema: 2,
    word,
    language: 'en',
    status: 'ok',
    ts: Date.now(),
    overview: { word, language: 'en', ipa: '/kənˈtend/', pos: 'v.', quick_meaning: '争夺；主张', register: 'formal', tags: ['conflict'] },
    lines: {
      etymology: {
        core_metaphor: '一枚深植于拉丁语“拉紧、伸展”的张力印章。',
        etymology: {
          chain: [
            { stage: 'Latin', language: '拉丁语', form: 'tendere', meaning: '伸展，拉紧', date: '' },
            { stage: 'Latin', language: '拉丁语', form: 'contendere', meaning: '全力伸展', date: '' },
            { stage: 'Old French', language: '古法语', form: 'contendre', meaning: '', date: '12c' },
            { stage: 'Middle English', language: '中古英语', form: 'contend', meaning: '', date: '15c' }
          ],
          via: '古法语',
          first_attested: '15世纪进入中古英语',
          certainty: 'high',
          shift: '从“绷紧朝向”到“争夺”与“主张”。'
        },
        morphology: {
          breakdown: [
            { part: 'con-', type: 'prefix', form_note: 'com- 的变体', meaning: '完全', origin: 'Latin' },
            { part: 'tend', type: 'root', form_note: '过去分词 tentus', meaning: '伸展', origin: 'Latin tendere' }
          ],
          root_variants: [{ form: 'tend', note: '原形' }, { form: 'tent', note: '过去分词' }],
          composition: 'con- + tend → 把全部力量拉紧到一起'
        },
        root_family: {
          direct: [{ word: 'contention', pos: 'n.', gloss: '争论', formula: 'contend + -ion', examples: [{ text: 'a bone of contention', translation: '争端的起因' }] }],
          shared_root: [{ word: 'extend', gloss: '延伸', formula: 'ex-(向外) + tend(伸展)' }]
        },
        derived_pronunciation: [{ word: 'contention', ipa: '/kənˈtenʃn/' }],
        false_cognates: [{ word: 'content', actual_origin: 'Latin continere', note: '与 contend 无关' }]
      },
      usage: {
        senses: [{ pos: 'v.', definition: '争夺；竞争', examples: [{ text: 'Three candidates are contending for the post.', translation: '三名候选人在争夺这个职位。' }] }],
        collocations: [{ pattern: 'contend for', meaning: '争夺', typical_objects: ['a prize', 'a title'] }],
        usage_notes: ['多用于书面语']
      },
      distinction: {
        confusables: {
          theme: '表示“声称／主张”的一组动词',
          table: [{ word: 'contend', meaning: '主张', note: '在争论中坚决主张' }, { word: 'claim', meaning: '声称', note: '可能无证据' }],
          parallel_examples: [{ sentence: 'He contends that he is innocent.', note: '争论中主张' }],
          contrast_pairs: [{ a: 'contend with', a_meaning: '对付', b: 'contend for', b_meaning: '争夺' }]
        },
        cultural_notes: ['常用于谈名声与胜负'],
        synthesis: ['拉紧', '朝向目标', '在争论中拉紧'],
        mnemonic: 'con + tend：把力量拉紧到一起。'
      }
    }
  };
  Object.assign(base, overrides || {});
  return base;
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

  const entry = sampleEntry(env.ns, store, { word: 'ephemeral', id });
  store.saveEntry(entry);
  check('entry round-trips through storage', !!store.getEntry(id));
  check('deep lines survive the round trip',
    store.getEntry(id).lines.etymology.etymology.certainty === 'high');
  check('history row carries the summary', store.listHistory()[0].quickMeaning === '争夺；主张');

  store.toggleStar(id);
  check('star toggles on', store.isStarred(id) === true);
  store.toggleStar(id);
  check('star toggles off', store.isStarred(id) === false);

  store.clearStarred();
  store.clearHistory();
  const keep = store.entryId('keeper', 'deepseek-flash', 'zh');
  store.saveEntry(sampleEntry(env.ns, store, { word: 'keeper', id: keep }));
  store.toggleStar(keep);
  for (let i = 0; i < 520; i += 1) {
    const word = 'w' + i;
    store.saveEntry(sampleEntry(env.ns, store, { word, id: store.entryId(word, 'deepseek-flash', 'zh') }));
  }
  const rows = store.listHistory();
  check('history is capped at 500', rows.length === 500, 'got ' + rows.length);
  check('starred entry survived eviction', store.isStarred(keep) === true);

  const backup = store.exportAll();
  check('export carries a marked kind', /-backup$/.test(backup.kind), backup.kind);
  check('export omits the API key', !('apiKey' in backup.settings));
  const historyBefore = store.listHistory().length;
  store.clearStarred();
  store.clearHistory();
  const restored = store.importAll(JSON.parse(JSON.stringify(backup)));
  check('import restores entries', restored === historyBefore, restored + ' vs ' + historyBefore);
  check('import keeps stars', store.isStarred(keep) === true);

  let rejected = false;
  try { store.importAll({ kind: 'something-else', history: [] }); } catch (err) { rejected = true; }
  check('import rejects foreign files', rejected);
}

/* 2.0 must never touch 1.0's data, even when both are opened from the same
   origin and therefore share one localStorage bucket. */
async function testStorageIsolation(env) {
  section('Storage isolation from 1.0');

  const ns = env.ns;
  check('settings key is namespaced', ns.STORAGE.settings === 'dict2.settings', ns.STORAGE.settings);
  check('history key is namespaced', ns.STORAGE.history === 'dict2.history', ns.STORAGE.history);
  check('entry key prefix is namespaced', ns.STORAGE.entryPrefix === 'dict2.entry.', ns.STORAGE.entryPrefix);

  /* Seed a 1.0-shaped payload, then prove 2.0 ignores it entirely. */
  env.storage.set('dict.settings', JSON.stringify({ apiKey: 'sk-from-v1', outputLang: 'fr', model: 'deepseek-v4-pro' }));
  env.storage.set('dict.history', JSON.stringify([{ id: 'legacy', word: 'legacy', ts: 1 }]));
  check('a 1.0 settings blob does not leak into 2.0',
    ns.store.getSettings().apiKey === '', JSON.stringify(ns.store.getSettings().apiKey));
  check('a 1.0 history blob does not leak into 2.0',
    !ns.store.listHistory().some((row) => row.id === 'legacy'));

  ns.store.patchSettings({ outputLang: 'en' });
  const written = [...env.storage.keys()].filter((key) => key.startsWith('dict.') && !key.startsWith('dict2.'));
  check('2.0 writes only to its own namespace', written.length === 2, written.join(', '));
  check('the 1.0 settings blob is left untouched',
    JSON.parse(env.storage.get('dict.settings')).apiKey === 'sk-from-v1');
}

/* ---------- Prompts ---------- */

async function testPrompts(env) {
  const prompts = env.ns.prompts;

  section('Prompts');

  check('prompt library is exposed', !!prompts && typeof prompts.etymology === 'function');

  const overview = prompts.overview('zh');
  check('overview names the app', overview.indexOf(env.ns.CONFIG.appName) > -1);
  check('overview asks for json', /json/i.test(overview));
  check('overview localises to Chinese', /Simplified Chinese/.test(overview));

  const etymology = prompts.etymology('zh');
  check('etymology prompt asks for json', /json/i.test(etymology));
  check('etymology prompt covers the root family', /root_family/.test(etymology));
  check('etymology prompt caps the shared root list', /at most 12/.test(etymology));
  check('etymology prompt caps direct derivatives', /at most 6/.test(etymology));
  check('etymology prompt asks for false cognates', /false_cognates/.test(etymology));
  check('etymology prompt asks for root variants', /root_variants/.test(etymology));
  check('etymology prompt asks for a structured chain', /"chain"/.test(etymology));
  check('etymology prompt forbids invented etymology', /Never invent an etymology/.test(etymology));
  check('etymology prompt grades certainty', /certainty/.test(etymology));

  const usage = prompts.usage('fr');
  check('usage prompt localises to French', /French/.test(usage));
  check('usage prompt caps senses', /at most 4/.test(usage));
  check('usage prompt asks for typical objects', /typical_objects/.test(usage));

  const distinction = prompts.distinction('zh');
  check('distinction prompt asks for a table', /"table"/.test(distinction));
  check('distinction prompt asks for parallel examples', /parallel_examples/.test(distinction));
  check('distinction prompt asks for contrast pairs', /contrast_pairs/.test(distinction));
  check('distinction prompt requires the headword in the table', /HEADWORD ITSELF MUST BE THE FIRST ROW/.test(distinction));
  check('distinction prompt caps the table', /at most 8/.test(distinction));

  const candidate = prompts.candidate('en');
  check('candidate prompt asks for json', /json/i.test(candidate));

  /* 2.1 nudges, added after a real call showed these two fields coming back
     thinner than the reference analysis. */
  check('etymology prompt sets a floor for the semantic core',
    /Between 20 characters and 45 characters/.test(etymology));
  check('etymology prompt requires form_note when a variant exists',
    /form_note MUST be filled/.test(etymology));
  /* The floors are per-language, so assert against the Chinese variant. */
  const usageZh = prompts.usage('zh');
  check('usage prompt sets a floor for definitions',
    /between 15 characters and 60 characters/.test(usageZh));
  check('usage prompt widens the floor for non-Chinese output',
    /between 35 characters and 140 characters/.test(usage));
  check('usage prompt forbids a bare synonym list',
    /never a bare list of synonyms/.test(usageZh));
}

/* ---------- 2.1 configuration ---------- */

function testConfig(env) {
  section('2.1 configuration');

  const CONFIG = env.ns.CONFIG;
  check('version reads 2.1.0', CONFIG.version === '2.1.0', CONFIG.version);
  check('timeout tightened to the measured budget', CONFIG.api.timeoutMs === 60000,
    String(CONFIG.api.timeoutMs));
  check('token ceilings were left alone', CONFIG.maxTokens.etymology === 3200);
  check('cardOrder declares twelve cards', Array.isArray(CONFIG.cardOrder) && CONFIG.cardOrder.length === 12);
  check('cardOrder leads with meaning rather than roots',
    CONFIG.cardOrder.slice(0, 3).join(',') === 'senses,collocations,usage',
    CONFIG.cardOrder.join(','));
}

/* ---------- Request shape ---------- */

async function testApiShape(env) {
  const api = env.ns.api;
  const CONFIG = env.ns.CONFIG;

  section('Request shape');

  let captured = null;
  env.setFetch((url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return jsonResponse(completion('{"status":"ok","word":"contend"}'));
  });

  await api.overview({ apiKey: 'sk-test', model: 'deepseek-flash', outputLang: 'zh', input: 'contend' });
  check('posts to the chat completions endpoint',
    captured.url === 'https://api.deepseek.com/chat/completions', captured.url);
  check('sends a bearer token', captured.options.headers.Authorization === 'Bearer sk-test');
  check('requests json_object output', captured.body.response_format.type === 'json_object');
  check('thinking is always off', captured.body.thinking.type === 'disabled');
  check('temperature is sent when thinking is off', captured.body.temperature === 0.3);
  check('no reasoning_effort is sent', captured.body.reasoning_effort === undefined);
  check('overview uses its own token ceiling',
    captured.body.max_tokens === CONFIG.maxTokens.overview, String(captured.body.max_tokens));

  const lines = [
    { line: 'etymology', marker: /historical lexicographer and etymologist/ },
    { line: 'usage', marker: /MEANING and USE/ },
    { line: 'distinction', marker: /DISAMBIGUATION and MEMORY/ }
  ];

  for (const entry of lines) {
    captured = null;
    await api.deepLine({
      apiKey: 'sk-test',
      model: 'deepseek-flash',
      outputLang: 'zh',
      overview: { word: 'contend', language: 'en', pos: 'v.', quick_meaning: '争夺', register: 'formal' },
      line: entry.line
    });
    check(entry.line + ' line is routed to its own prompt', entry.marker.test(captured.body.messages[0].content));
    check(entry.line + ' line uses its own token ceiling',
      captured.body.max_tokens === CONFIG.maxTokens[entry.line],
      entry.line + '=' + captured.body.max_tokens);
    check(entry.line + ' line keeps thinking off', captured.body.thinking.type === 'disabled');
    check(entry.line + ' line receives the headword context',
      captured.body.messages[1].content.indexOf('contend') > -1);
  }

  let unknownRejected = false;
  try {
    await api.deepLine({ apiKey: 'k', model: 'm', outputLang: 'zh', overview: { word: 'x' }, line: 'nope' });
  } catch (err) { unknownRejected = true; }
  check('an unknown line is rejected', unknownRejected);
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
  try { await api.overview({ apiKey: 'k', model: 'm', outputLang: 'en', input: 'x' }); } catch (err) { emptyKind = err.kind; }
  check('empty content raises bad_json', emptyKind === 'bad_json', String(emptyKind));

  env.setFetch(() => jsonResponse({ error: { message: 'Authentication Fails' } }, 401));
  let authKind = null;
  try { await api.overview({ apiKey: 'bad', model: 'm', outputLang: 'en', input: 'x' }); } catch (err) { authKind = err.kind; }
  check('401 maps to the auth kind', authKind === 'auth', String(authKind));

  env.setFetch(() => jsonResponse({ error: { message: 'Insufficient Balance' } }, 402));
  let balanceKind = null;
  try { await api.overview({ apiKey: 'k', model: 'm', outputLang: 'en', input: 'x' }); } catch (err) { balanceKind = err.kind; }
  check('402 maps to the balance kind', balanceKind === 'balance', String(balanceKind));

  let attempts = 0;
  env.setFetch(() => {
    attempts += 1;
    if (attempts === 1) return jsonResponse({ error: { message: 'rate limited' } }, 429);
    return jsonResponse(completion('{"status":"ok","word":"retry"}'));
  });
  const retried = await api.overview({ apiKey: 'k', model: 'm', outputLang: 'en', input: 'x' });
  check('429 is retried once and then succeeds', retried.word === 'retry' && attempts === 2, 'attempts=' + attempts);

  let noKeyKind = null;
  try { await api.overview({ apiKey: '', model: 'm', outputLang: 'en', input: 'x' }); } catch (err) { noKeyKind = err.kind; }
  check('missing key is caught before any request', noKeyKind === 'no_key', String(noKeyKind));

  env.setFetch(() => Promise.reject(new TypeError('Failed to fetch')));
  let networkKind = null;
  try { await api.overview({ apiKey: 'k', model: 'm', outputLang: 'en', input: 'x' }); } catch (err) { networkKind = err.kind; }
  check('fetch rejection maps to network', networkKind === 'network', String(networkKind));

  env.setFetch(() => jsonResponse(completion('{"status":"ok","candidates":[{"word":"nostalgia"}]}')));
  const candidates = await api.candidates({ apiKey: 'k', model: 'm', outputLang: 'zh', input: '乡愁' });
  check('candidate lookup returns a list', candidates.candidates.length === 1);

  /* ---------- progressive deep lines ---------- */

  section('Parallel deep lines');

  const seen = [];
  env.setFetch((url, options) => {
    const system = JSON.parse(options.body).messages[0].content;
    if (/historical lexicographer and etymologist/.test(system)) {
      return jsonResponse(completion('{"core_metaphor":"张力印章"}'));
    }
    if (/MEANING and USE/.test(system)) {
      return jsonResponse({ error: { message: 'boom' } }, 500);
    }
    return jsonResponse(completion('{"mnemonic":"拉紧"}'));
  });

  const results = await api.deepLines({
    apiKey: 'k',
    model: 'deepseek-flash',
    outputLang: 'zh',
    overview: { word: 'contend', language: 'en', pos: 'v.', quick_meaning: '争夺', register: 'formal' }
  }, (result) => seen.push(result));

  check('every line is reported through the callback', seen.length === 3, 'got ' + seen.length);
  check('a successful line carries its data', results.etymology.ok === true &&
    results.etymology.data.core_metaphor === '张力印章');
  check('a failing line carries its error', results.usage.ok === false && results.usage.error.kind === 'server');
  check('a failing line does not block the others', results.distinction.ok === true);
  check('the batch itself never rejects', Object.keys(results).length === 3);
}

/* ---------- Spelling ---------- */

async function testSpell(env) {
  const spell = env.ns.spell;

  section('Spelling');

  check('a plain word is spellable', spell.canSpell('checker') === true);
  check('a French word is spellable', spell.canSpell('flâner') === true);
  check('a multi-word expression is not', spell.canSpell("coup d'état") === false);
  check('a hyphenated word is not', spell.canSpell('well-being') === false);
  check('an empty string is not', spell.canSpell('') === false);

  check('non-letters are dropped', spell.normalizeInput('ab3c!d', 10) === 'abcd');
  check('input is truncated to the answer length', spell.normalizeInput('abcdefg', 3) === 'abc');
  check('accents fold to their base letter', spell.fold('é') === 'e' && spell.fold('Â') === 'a');

  check('an exact match judges all true',
    spell.judge('checker', 'checker').every(Boolean));
  check('a wrong letter is judged false at its position',
    spell.judge('chicker', 'checker').filter(Boolean).length === 6);
  /* 'sucess' is missing one of the two c's, so everything after it shifts and
     must be judged wrong — a count-based comparison would wrongly pass it. */
  check('a repeated letter is judged positionally, not by count',
    spell.judge('sucess', 'success').join(',') === 'true,true,true,false,false,true,false',
    spell.judge('sucess', 'success').join(','));
  check('a short answer marks the rest false',
    spell.judge('check', 'checker').filter(Boolean).length === 5);
  check('an accented answer is accepted without accents',
    spell.judge('flaner', 'flâner').every(Boolean));
  check('a perfect answer is recognised', spell.isPerfect('checker', 'checker') === true);
  check('a short answer is not perfect', spell.isPerfect('check', 'checker') === false);

  /* state machine */
  const item = { word: 'checker', meaning: '检查者', pos: 'n.', language: 'en', entryId: 'e1', mode: 'single' };
  let ex = spell.createExercise(item);
  check('an exercise starts in the input state', ex.status === 'input' && ex.typed === '');
  check('the answer is normalised', ex.answer === 'checker');

  spell.applyInput(ex, 'checke');
  check('typing lands in the model', ex.typed === 'checke');

  spell.applySubmit(ex);
  check('a wrong answer moves to the wrong state', ex.status === 'wrong');
  check('a wrong answer reveals the spelling', ex.reveal === true);

  spell.applyInput(ex, 'checker');
  check('typing is ignored once the answer is revealed', ex.typed === 'checke');

  spell.applySubmit(ex);
  check('the second submit clears for a retry', ex.status === 'input' && ex.typed === '' && ex.reveal === false);

  spell.applyInput(ex, 'checker');
  spell.applySubmit(ex);
  check('a correct answer moves to the correct state', ex.status === 'correct');

  let ex2 = spell.createExercise(item);
  spell.applySubmit(ex2);
  check('submitting nothing does nothing', ex2.status === 'input');

  spell.applyHint(ex2);
  check('the first hint reveals the meaning', ex2.hint === 1);
  spell.applyHint(ex2);
  check('the second hint reveals the first letter', ex2.hint === 2);
  spell.applyHint(ex2);
  check('hints stop at the second level', ex2.hint === 2);

  const practice = spell.createExercise({ word: 'checker', meaning: 'm', mode: 'practice', progress: { total: 5, done: 2 } });
  check('practice mode is carried on the exercise', practice.practice === true);
  check('progress is carried on the exercise', practice.progress.done === 2 && practice.progress.total === 5);

  let advanced = false;
  const first = spell.createExercise({ word: 'checker', meaning: 'm', mode: 'practice' });
  spell.applyInput(first, 'checker');
  spell.applySubmit(first);
  if (first.status === 'correct') advanced = true;
  check('practice mode still resolves each word correctly', advanced);
}

/* ---------- Render layer ---------- */

async function testRendering(env) {
  const ns = env.ns;
  const store = ns.store;

  section('Render layer');

  store.clearStarred();
  store.clearHistory();
  ns.session.collapsed = {};

  const dictionary = createContainer();
  ns.views.dictionary.render(dictionary, {});
  const dictHtml = dictionary.innerHTML;
  check('dictionary screen renders a search field', /id="lookup-input"/.test(dictHtml));
  check('dictionary screen offers spelling practice', /id="lookup-practice"/.test(dictHtml));
  check('dictionary screen still renders the history filter', /data-segmented="history"/.test(dictHtml));
  check('no view leaks a raw DOM node into markup', dictHtml.indexOf('[object') === -1);

  const entry = sampleEntry(ns, store, { word: 'contend' });
  store.saveEntry(entry);

  const wordScreen = createContainer();
  ns.views.word.render(wordScreen, { id: entry.id });
  const wordHtml = wordScreen.innerHTML;

  const expectedOrder = ns.CONFIG.cardOrder;
  const actualOrder = [...wordHtml.matchAll(/data-card="([^"]+)"/g)].map((m) => m[1]);
  check('all twelve deep cards render', actualOrder.length === 12, 'got ' + actualOrder.length);
  check('cards render exactly in CONFIG.cardOrder',
    actualOrder.join(',') === expectedOrder.join(','), actualOrder.join(','));
  check('CONFIG.cardOrder covers every card definition',
    ns.views.word.cards.every((card) => expectedOrder.indexOf(card.key) > -1) &&
    expectedOrder.length === ns.views.word.cards.length);

  const titles = ['Semantic core', 'Etymology', 'Morphology', 'Root family', 'False cognates',
    'Senses', 'Collocations', 'Usage', 'Confusables', 'Culture', 'Synthesis', 'Mnemonic'];
  titles.forEach((title) => {
    check('card renders: ' + title, wordHtml.indexOf('>' + title + '<') > -1);
  });

  check('the etymology timeline renders nodes', /class="etym-node"/.test(wordHtml));
  check('the morphology formula renders parts', /class="morph-part"/.test(wordHtml));
  check('root variants render', /class="variant-list"/.test(wordHtml));
  check('the root family renders both groups',
    /Direct derivatives/.test(wordHtml) && /Shared root/.test(wordHtml));
  check('false cognates render', /Latin continere/.test(wordHtml));
  check('the comparison table renders', /class="compare-table"/.test(wordHtml));
  check('parallel examples render', /class="parallel-list"/.test(wordHtml));
  check('contrast pairs render', /class="vs"/.test(wordHtml));
  check('synthesis renders as a list', /class="synthesis-list"/.test(wordHtml));
  check('the mnemonic renders', /class="mnemonic"/.test(wordHtml));
  check('the spell entry point renders', /data-spell-entry/.test(wordHtml));
  check('entry markup stays escaped', wordHtml.indexOf('[object') === -1);

  /* Collapse */
  ns.session.collapsed = { etymology: true };
  const collapsedScreen = createContainer();
  ns.views.word.render(collapsedScreen, { id: entry.id });
  const collapsedHtml = collapsedScreen.innerHTML;
  check('a collapsed card carries the collapsed class',
    /data-card="etymology"[^>]*class="[^"]*is-collapsed/.test(collapsedHtml) ||
    /class="card deep-card is-collapsed[^"]*"[^>]*data-card="etymology"/.test(collapsedHtml));
  check('a collapsed card reports aria-expanded false',
    /data-toggle="etymology"[^>]*aria-expanded="false"/.test(collapsedHtml));
  check('other cards stay expanded', /data-toggle="senses"[^>]*aria-expanded="true"/.test(collapsedHtml));

  ns.session.collapsed = {};
  ns.views.word.cards.forEach((card) => { ns.session.collapsed[card.key] = true; });
  const allCollapsed = createContainer();
  ns.views.word.render(allCollapsed, { id: entry.id });
  check('the toolbar offers Expand all once everything is collapsed',
    /Expand all/.test(allCollapsed.innerHTML));

  ns.session.collapsed = {};

  /* An entry saved before its lines finished must offer to generate them. */
  const partial = sampleEntry(ns, store, { word: 'partial', id: store.entryId('partial', 'deepseek-flash', 'zh') });
  delete partial.lines;
  store.saveEntry(partial);
  const partialScreen = createContainer();
  ns.views.word.render(partialScreen, { id: partial.id });
  const partialHtml = partialScreen.innerHTML;
  check('an unfinished entry offers to generate each line',
    (partialHtml.match(/not generated yet/g) || []).length === 3,
    String((partialHtml.match(/not generated yet/g) || []).length));
  check('an unfinished entry shows no empty deep cards', !/data-card="/.test(partialHtml));

  /* Model output must never be injected as markup. */
  const hostile = sampleEntry(ns, store, { word: '<img src=x onerror=alert(1)>', id: store.entryId('hostile', 'deepseek-flash', 'zh') });
  hostile.overview.quick_meaning = '<script>alert(2)</script>';
  hostile.lines.etymology.core_metaphor = '<img src=x onerror=alert(3)>';
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
  check('profile offers clearing the app cache', /id="clear-cache"/.test(profileHtml));
}

/* ---------- PWA assets ---------- */

/* ---------- Cross-line interleaving ---------- */

/* The reading order now interleaves the three lines, so the rendering has to be
   driven by CONFIG.cardOrder rather than by whichever line happens to arrive.
   This drives a real lookup with manually released promises to inspect the
   page mid-flight. */
async function testInterleaving(env) {
  const ns = env.ns;
  const store = ns.store;

  section('Cross-line interleaving');

  /* A lookup needs a key before anything is requested. */
  store.patchSettings({ apiKey: 'sk-interleave-test' });

  const id = store.entryId('interleave', 'deepseek-flash', 'zh');
  const pending = [];

  env.setFetch((url, options) => {
    const system = JSON.parse(options.body).messages[0].content;
    if (/fast, reliable overview/.test(system)) {
      return jsonResponse(completion(JSON.stringify({
        status: 'ok', word: 'interleave', language: 'en', ipa: '/ˌɪntəˈliːv/',
        pos: 'v.', quick_meaning: '交错排列', register: 'formal', tags: []
      })));
    }
    return new Promise((resolve, reject) => { pending.push({ system, resolve, reject }); });
  });

  /* The view repaints through the router after every line settles. */
  const live = createContainer();
  ns.router = { refresh: function () { ns.views.word.render(live, { id }); } };
  env.location.hash = '#/word/' + encodeURIComponent(id);

  ns.session.pending = { id: id, input: 'interleave' };
  /* Force the "brand new lookup" path: the pending branch only runs when the
     view is currently showing a different entry. */
  ns.views.word.reset(null);
  ns.views.word.render(live, { id });
  await tick();
  await tick();

  check('all three lines are requested at once', pending.length === 3, 'got ' + pending.length);
  check('every card holds a skeleton while its line is in flight',
    (live.innerHTML.match(/data-loading="/g) || []).length === 12,
    String((live.innerHTML.match(/data-loading="/g) || []).length));
  check('no real card is rendered before any line lands', !/data-card="/.test(live.innerHTML));

  const usage = pending.find((item) => /MEANING and USE/.test(item.system));
  usage.resolve(jsonResponse(completion(JSON.stringify({
    senses: [{ pos: 'v.', definition: '交错排列，交替插入', examples: [{ text: 'The lines interleave.', translation: '线条相互交错。' }] }],
    collocations: [{ pattern: 'interleave with', meaning: '与……交错', typical_objects: ['each other'] }],
    usage_notes: ['多用于技术语境']
  }))));
  await tick();
  await tick();

  const afterUsage = live.innerHTML;
  check('the landed line renders in its own slots',
    (afterUsage.match(/data-card="/g) || []).length === 3,
    String((afterUsage.match(/data-card="/g) || []).length));
  check('the cards from other lines are still skeletons',
    (afterUsage.match(/data-loading="/g) || []).length === 9,
    String((afterUsage.match(/data-loading="/g) || []).length));

  const sensesAt = afterUsage.indexOf('data-card="senses"');
  const coreAt = afterUsage.indexOf('data-loading="core"');
  check('a landed card sits ahead of a pending one, per the configured order',
    sensesAt > -1 && coreAt > -1 && sensesAt < coreAt);

  const distinction = pending.find((item) => /DISAMBIGUATION and MEMORY/.test(item.system));
  distinction.reject(new TypeError('offline'));
  await tick();
  await tick();

  const afterFailure = live.innerHTML;
  check('a failed line reports exactly once', (afterFailure.match(/data-line-notice="/g) || []).length === 1,
    String((afterFailure.match(/data-line-notice="/g) || []).length));
  check('the report is attached to the failed line',
    /data-line-notice="distinction"/.test(afterFailure));
  check('the failed line\u2019s remaining cards are not rendered',
    !/data-loading="culture"/.test(afterFailure) && !/data-card="culture"/.test(afterFailure));
  check('the failed line offers a retry', /data-retry-line="distinction"/.test(afterFailure));
  check('the healthy line is untouched by the failure',
    /data-card="senses"/.test(afterFailure));

  /* Retry must refetch only the line that failed. */
  const beforeRetry = pending.length;
  ns.views.word.retryLine('distinction');
  await tick();
  const retryRequests = pending.slice(beforeRetry);
  check('retrying a line fires exactly one request',
    retryRequests.length === 1, 'got ' + retryRequests.length);
  check('and it is the failed line',
    retryRequests.length === 1 && /DISAMBIGUATION and MEMORY/.test(retryRequests[0].system));
  check('the other lines are not refetched',
    !retryRequests.some((item) => /historical lexicographer and etymologist/.test(item.system)) &&
    !retryRequests.some((item) => /MEANING and USE/.test(item.system)));

  /* Release everything still in flight. Each pending request holds a 60s abort
     timer, and leaving one armed would keep the process alive after the run. */
  pending.forEach((item) => item.resolve(jsonResponse(completion('{}'))));
  await tick();
  await tick();
  env.location.hash = '#/dictionary';
}

/* ---------- Practice pool ---------- */

async function testPracticePool(env) {
  const ns = env.ns;
  const store = ns.store;

  section('Practice pool follows the filter');

  store.clearStarred();
  store.clearHistory();

  const put = (word, starred, language) => {
    const id = store.entryId(word, 'deepseek-flash', 'zh');
    store.saveEntry({
      id, schema: 2, word, language: language || 'en', status: 'ok', ts: Date.now(),
      overview: { word, pos: 'n.', quick_meaning: '释义 ' + word }
    });
    if (starred) store.toggleStar(id);
  };
  put('checker', true);
  put('liminal', true);
  put('lonely', false);
  put("coup d'état", false, 'fr');   /* multi-word: never spellable */

  ns.session.filter = 'all';
  const allPool = ns.views.dictionary.practicePool().map((row) => row.word).sort();
  check('with All selected the pool holds every spellable word',
    allPool.join(',') === 'checker,liminal,lonely', allPool.join(','));
  check('multi-word expressions stay out of the pool', allPool.indexOf("coup d'état") === -1);

  ns.session.filter = 'starred';
  const starredPool = ns.views.dictionary.practicePool().map((row) => row.word).sort();
  check('with Starred selected the pool holds only starred words',
    starredPool.join(',') === 'checker,liminal', starredPool.join(','));

  const allScreen = createContainer();
  ns.session.filter = 'all';
  ns.views.dictionary.render(allScreen, {});
  check('the button names the All source', /Spelling practice · All/.test(allScreen.innerHTML));

  ns.session.filter = 'starred';
  const starredScreen = createContainer();
  ns.views.dictionary.render(starredScreen, {});
  check('the button names the Starred source', /Spelling practice · Starred/.test(starredScreen.innerHTML));

  /* Empty starred pool must say something specific, not the generic line. */
  const messages = [];
  const originalToast = ns.ui.toast;
  ns.ui.toast = function (message) { messages.push(message); };
  store.clearStarred();
  ns.views.dictionary.startPractice();
  check('an empty starred pool gets its own message',
    /star/i.test(messages[0] || ''), String(messages[0]));

  ns.session.filter = 'all';
  messages.length = 0;
  store.clearHistory();
  ns.views.dictionary.startPractice();
  check('an empty history gets the generic message',
    messages.length === 1 && !/star/i.test(messages[0]), String(messages[0]));
  ns.ui.toast = originalToast;
}

const EXPECTED_SITE_FILES = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'assets/app.css',
  'assets/tokens.css',
  'js/api.js',
  'js/app.js',
  'js/config.js',
  'js/prompts.js',
  'js/pwa.js',
  'js/speech.js',
  'js/spell.js',
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
  section('PWA assets');

  const manifestPath = path.join(WEB_DIR, 'manifest.webmanifest');
  check('manifest ships with the app', fs.existsSync(manifestPath));

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  check('manifest is valid JSON with the required fields',
    ['name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color', 'lang']
      .every((field) => typeof manifest[field] === 'string' && manifest[field].length > 0));
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  check('every manifest icon exists on disk',
    icons.every((icon) => fs.existsSync(path.join(WEB_DIR, icon.src))));

  const html = fs.readFileSync(path.join(WEB_DIR, 'index.html'), 'utf8');
  check('index.html loads the prompt library',
    /<script[^>]+src="js\/prompts\.js"/.test(html));
  check('index.html loads the spell module',
    /<script[^>]+src="js\/spell\.js"/.test(html));
  check('prompts load before api', html.indexOf('js/prompts.js') < html.indexOf('js/api.js'));
  check('spell loads before the views', html.indexOf('js/spell.js') < html.indexOf('js/view-word.js'));

  const sw = fs.readFileSync(path.join(WEB_DIR, 'sw.js'), 'utf8');
  const precache = [...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
  check('the service worker cache version was bumped for 2.1',
    /CACHE_VERSION = 'v2\.1'/.test(sw));
  check('every precached path exists on disk',
    precache.every((entry) => entry === '' || fs.existsSync(path.join(WEB_DIR, entry))),
    precache.filter((entry) => entry !== '' && !fs.existsSync(path.join(WEB_DIR, entry))).join(', '));
  check('the new modules are precached',
    precache.includes('js/prompts.js') && precache.includes('js/spell.js'));
}

/* ---------- Service worker behaviour ---------- */

function createServiceWorkerHarness() {
  const log = [];
  const stores = new Map();
  const listeners = {};
  const ORIGIN = 'https://radicle.example';

  /* A real Cache Storage keys by resolved absolute URL, so './assets/app.css'
     and 'https://host/assets/app.css' are the same entry. Model that. */
  function keyOf(request) {
    const raw = typeof request === 'string' ? request : request.url;
    try { return new URL(raw, ORIGIN + '/').href; } catch (err) { return raw; }
  }

  function openStore(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      addAll(list) {
        list.forEach((item) => {
          const key = keyOf(item);
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
    console, Promise, URL, caches,
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

  vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(WEB_DIR, 'sw.js'), 'utf8'), scope, { filename: 'sw.js' });

  function makeRequest(url, options) {
    const opts = options || {};
    const headerMap = new Map(Object.entries(opts.headers || {}).map(([n, v]) => [n.toLowerCase(), v]));
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

  function dispatch(request) {
    log.length = 0;
    fetchLog.length = 0;
    let responded = null;
    listeners.fetch({ request, respondWith: (value) => { responded = value; } });
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

  return { dispatch, install, makeRequest };
}

async function testServiceWorker() {
  const sw = createServiceWorkerHarness();

  section('Service worker');

  const installLog = await sw.install();
  check('install precaches the shell', installLog.length > 10);
  check('install precaches index.html',
    installLog.includes('write:https://radicle.example/index.html'));

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
  check('a same-origin request carrying a key touches no cache', keyedGet.cacheOps.length === 0);

  const crossOriginGet = await sw.dispatch(sw.makeRequest('https://api.deepseek.com/models'));
  check('a cross-origin GET is not intercepted', crossOriginGet.handled === false);

  const asset = await sw.dispatch(sw.makeRequest('https://radicle.example/assets/app.css'));
  check('a precached asset is served from cache without touching the network',
    asset.handled === true && asset.fetched.length === 0, asset.cacheOps.join(', '));

  const navigation = await sw.dispatch(sw.makeRequest('https://radicle.example/', {
    mode: 'navigate',
    headers: { accept: 'text/html' }
  }));
  check('the app shell is served from cache for navigations',
    navigation.cacheOps.includes('read:https://radicle.example/index.html'));

  const post = await sw.dispatch(sw.makeRequest('https://radicle.example/data', { method: 'POST' }));
  check('a same-origin POST is not intercepted', post.handled === false);
}

/* ---------- Install state ---------- */

async function testInstallState(env) {
  const pwa = env.ns.pwa;

  section('Install state');

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

  env.winListeners.appinstalled();
  check('appinstalled marks the app as installed', pwa.state() === 'installed');
}

/* ---------- Distribution ---------- */

async function testDistribution() {
  const { execFileSync } = require('child_process');

  section('Distribution');

  try {
    execFileSync(process.execPath, [path.join(REPO_DIR, 'tools', 'build.mjs')], { stdio: 'pipe' });
  } catch (err) {
    check('the packaging script succeeds', false, String(err.stdout || err.message).slice(0, 500));
    return;
  }
  check('the packaging script succeeds', true);

  const siteDir = path.join(REPO_DIR, 'dist', 'site');
  const published = [];
  (function walk(dir, prefix) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
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
  check('the offline bundle exists', fs.existsSync(offlinePath));

  const offline = fs.readFileSync(offlinePath, 'utf8');
  const external = [...offline.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((value) => !value.startsWith('data:') && !/^https?:/i.test(value) && value !== '#');
  check('the offline bundle references no local files', external.length === 0, external.join(', '));
  check('the offline bundle embeds no service worker registration',
    !/serviceWorker\s*\.\s*register/.test(offline));
  check('the offline bundle leaves pwa.js out', offline.indexOf('ns.pwa = {') === -1);
  check('the offline bundle keeps the prompt library', /ns\.prompts = \{/.test(offline));
  check('the offline bundle keeps the spell module', /ns\.spell = \{/.test(offline));

  const modules = ['config.js', 'prompts.js', 'store.js', 'speech.js', 'ui.js', 'spell.js',
    'api.js', 'view-dictionary.js', 'view-word.js', 'view-profile.js', 'app.js'];
  const positions = modules.map((name) => {
    const source = fs.readFileSync(path.join(WEB_DIR, 'js', name), 'utf8');
    return offline.indexOf(source.replace(/<\/script/gi, '<\\/script'));
  });
  check('every module is inlined', positions.every((index) => index > -1),
    modules.filter((name, i) => positions[i] === -1).join(', '));
  check('modules keep their load order', positions.every((index, i) => i === 0 || index > positions[i - 1]));
}

/* ---------- Entry point ---------- */

(async function main() {
  const env = createEnvironment();
  await testStore(env);
  await testStorageIsolation(env);
  await testPrompts(env);
  await testApiShape(env);
  await testApiBehaviour(env);
  await testSpell(env);
  await testRendering(env);
  await testInterleaving(env);
  await testPracticePool(env);
  testConfig(env);
  testPwaAssets();
  await testServiceWorker();
  await testInstallState(env);
  await testDistribution();

  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  if (failures.length) {
    failures.forEach((item) => console.log('  - ' + item));
  }
  /* Explicit exit: an aborted-but-unsettled request can leave a timer armed,
     and a test run must never linger for it. */
  process.exit(failures.length ? 1 : 0);
})().catch((err) => {
  console.error('Harness error:', err);
  process.exit(1);
});
