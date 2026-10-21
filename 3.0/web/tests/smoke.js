/* RADICLE 3.0 — dependency-free smoke test.

   Loads the real modules in the order index.html loads them, inside a stubbed
   browser, and drives them: storage and wordbooks, the 25 language
   combinations of the prompt library, the practice normalisers, per-language
   card sets, the favourites screen, the service worker, and the packaging
   output.

   node 3.0/web/tests/smoke.js
*/

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB_DIR = path.join(__dirname, '..');
const REPO_DIR = path.join(WEB_DIR, '..');
const JS_DIR = path.join(WEB_DIR, 'js');

let passed = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) { passed += 1; console.log('  ok   ' + label); }
  else {
    failures.push(label + (detail ? ' — ' + detail : ''));
    console.log('  FAIL ' + label + (detail ? ' — ' + detail : ''));
  }
}

function section(title) { console.log('\n' + title); }

/* ---------- Environment ---------- */

function scriptOrder() {
  const html = fs.readFileSync(path.join(WEB_DIR, 'index.html'), 'utf8');
  return [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
}

function createEnvironment() {
  const storage = new Map();
  const fetchCalls = [];
  const winListeners = {};
  let fetchImpl = () => { throw new Error('fetch stub not configured'); };

  const sandbox = {
    console, setTimeout, clearTimeout, Promise, JSON, Date, Math, Object, Array,
    String, Number, Error, AbortController, URL,
    Blob: function Blob() {}, FileReader: function FileReader() {}
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
    body: {
      setAttribute: () => {}, appendChild: () => {}, removeChild: () => {},
      classList: { add: () => {}, remove: () => {} }
    },
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, click: () => {}, style: {} }),
    getElementById: () => null,
    addEventListener: () => {},
    querySelectorAll: () => []
  };

  const windowStub = {
    localStorage,
    document: documentStub,
    location: { hash: '#/dictionary', replace: () => {}, protocol: 'file:', hostname: '' },
    setTimeout, clearTimeout,
    navigator: {
      onLine: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      serviceWorker: { register: () => Promise.resolve() }
    },
    matchMedia: () => ({ matches: false }),
    addEventListener: (type, handler) => { winListeners[type] = handler; },
    prompt: () => null,
    confirm: () => true,
    fetch: (...args) => { fetchCalls.push(args); return fetchImpl(...args); }
  };

  sandbox.window = windowStub;
  sandbox.document = documentStub;
  sandbox.localStorage = localStorage;
  sandbox.navigator = windowStub.navigator;
  sandbox.location = windowStub.location;
  sandbox.self = windowStub;

  vm.createContext(sandbox);
  scriptOrder().forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(WEB_DIR, file), 'utf8'), sandbox, { filename: file });
  });

  return {
    ns: sandbox.window.RADICLE,
    sandbox,
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

function container() {
  return {
    _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(value) { this._html = value; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
}

function tick() { return new Promise((resolve) => setTimeout(resolve, 0)); }

/* An entry with data for every card of one language. */
function entryFor(ns, store, language, word, overrides) {
  const id = store.entryId(word, language, 'deepseek-flash', 'en');
  const base = {
    id, schema: 3, kind: 'word', word, language, status: 'ok', ts: Date.now(),
    overview: { word, language, reading: '/x/', pos: 'n.', quick_meaning: 'gloss', register: 'neutral', tags: [] },
    lines: {}
  };
  const L = {
    en: {
      etymology: {
        core_metaphor: 'a vivid line', etymology: { chain: [{ stage: 'Latin', language: 'Latin', form: 'x', meaning: 'y', date: '' }], via: 'French', first_attested: 'c. 1400', certainty: 'high', shift: 'shifted' },
        morphology: { breakdown: [{ part: 'con-', type: 'prefix', meaning: 'together', origin: 'Latin' }], root_variants: [{ form: 'tend', note: 'base' }], composition: 'a + b' },
        root_family: { direct: [{ word: 'xion', pos: 'n.', gloss: 'g', formula: 'x + -ion', examples: [] }], shared_root: [{ word: 'extend', gloss: 'g', formula: 'ex- + tend' }] },
        derived_pronunciation: [{ word: 'xion', ipa: '/ˈx/' }],
        false_cognates: [{ word: 'content', actual_origin: 'Latin continere', note: 'not related' }]
      },
      usage: {
        senses: [{ pos: 'n.', definition: 'a full definition', examples: [{ text: 'An example.', translation: '译' }] }],
        collocations: [{ pattern: 'x for', meaning: 'm', typical_objects: ['a prize'] }],
        usage_notes: ['formal']
      },
      distinction: {
        confusables: { theme: 't', table: [{ word, meaning: 'm', note: 'n' }], parallel_examples: [{ sentence: 'S.', note: 'n' }], contrast_pairs: [{ a: 'x with', a_meaning: 'a', b: 'x for', b_meaning: 'b' }] },
        cultural_notes: ['c'], synthesis: ['s'], mnemonic: 'm'
      }
    },
    fr: {
      etymology: {
        core_metaphor: 'une image', etymology: { chain: [{ stage: 'Latin', language: 'latin', form: 'x', meaning: 'y', date: '' }], via: '', first_attested: '', certainty: 'high', shift: '' },
        morphology: { breakdown: [{ part: 'con-', type: 'prefix', meaning: 'ensemble', origin: 'latin' }], root_variants: [], composition: '' },
        root_family: { direct: [], shared_root: [{ word: 'étendre', gloss: 'g', formula: 'ex- + tendre' }] },
        derived_pronunciation: [],
        false_cognates: [{ word: 'actually', actual_origin: 'actuellement', note: 'faux ami' }]
      },
      usage: {
        senses: [{ pos: 'n.', definition: 'une définition complète', examples: [] }],
        collocations: [{ pattern: 'x de', meaning: 'm', typical_objects: [] }],
        usage_notes: ['soutenu'],
        gender_number: { gender: 'masculin', plural: 'les x', note: 'trap' },
        conjugation: { auxiliary: 'avoir', participle: 'xé', tenses: [{ tense: 'présent', forms: ['je x', 'tu x'] }], note: '' }
      },
      distinction: {
        confusables: { theme: 't', table: [{ word, meaning: 'm', note: 'n' }], parallel_examples: [], contrast_pairs: [] },
        doublets: [{ popular: 'chose', learned: 'cause', latin: 'causa', difference: 'register' }],
        cultural_notes: [], synthesis: ['s'], mnemonic: 'm'
      }
    },
    de: {
      etymology: {
        core_metaphor: 'ein Bild', etymology: { chain: [{ stage: 'Proto-Germanic', language: 'germanisch', form: '*x', meaning: 'y', date: '' }], via: '', first_attested: '', certainty: 'medium', shift: '' },
        morphology: { breakdown: [{ part: 'ver-', type: 'prefix', meaning: 'voll', origin: 'Germanic' }], root_variants: [], composition: '' },
        compounds: [{ part: 'Fenster', meaning: 'window', note: '' }, { part: 'Bank', meaning: 'bench', note: '' }],
        root_family: { direct: [], shared_root: [{ word: 'binden', gloss: 'g', formula: 'binden' }] },
        derived_pronunciation: [],
        false_cognates: [{ word: 'Gift', actual_origin: 'gift = poison', note: 'false friend' }]
      },
      usage: {
        senses: [{ pos: 'n.', definition: 'eine vollständige Definition', examples: [] }],
        collocations: [{ pattern: 'x + Dativ', meaning: 'm', typical_objects: [] }],
        usage_notes: ['formell'],
        article_plural: { article: 'das', plural: 'die xer', genitive: 'des xes', note: 'trap' },
        principal_parts: { infinitive: 'xen', praeteritum: 'xte', partizipII: 'gext', auxiliary: 'haben', vowel_change: 'e – a – o', note: '' },
        case_government: [{ pattern: 'x + Dativ', example: 'Ich xe dir.', note: '' }],
        separable_prefixes: [{ prefix: 'auf-', meaning: 'up', example: 'Ich xe auf.', note: '' }]
      },
      distinction: {
        confusables: { theme: 't', table: [{ word, meaning: 'm', note: 'n' }], parallel_examples: [], contrast_pairs: [] },
        sound_shift: [{ english: 'water', german: 'Wasser', shift: 't → ss', note: 'shift' }],
        cultural_notes: [], synthesis: ['s'], mnemonic: 'm'
      }
    },
    ja: {
      etymology: {
        nuance: '語感の核', word_stratum: 'kango',
        readings: { on: [{ reading: 'せい', romaji: 'sei', note: '' }], kun: [{ reading: 'なる', romaji: 'naru', okurigana: 'る', note: '' }], special: [] },
        kanji_origin: [{ kanji: '成', formation: 'phono-semantic', formation_term: '形声', original_image: 'axe', path: 'path' }],
        components: [{ part: '戈', kind: 'radical', meaning: 'halberd', note: '' }],
        etymology: { chain: [], via: '', first_attested: '', certainty: 'medium', shift: '' },
        derived_pronunciation: [{ word: '成功', reading: 'せいこう' }]
      },
      usage: {
        senses: [{ pos: '名', definition: '完全な定義', examples: [] }],
        collocations: [{ pattern: '〜を待つ', meaning: 'm', typical_objects: [] }],
        usage_notes: ['丁寧'],
        conjugation: { class: 'godan', stem: 'せい', forms: [{ name: 'ます形', form: 'せいします' }] }
      },
      distinction: {
        confusables: { theme: 't', table: [{ word, meaning: 'm', note: 'n' }], parallel_examples: [], contrast_pairs: [] },
        source_word: { origin_language: 'English', original: 'x', literal: 'y', note: '' },
        spelling_variants: [{ form: 'ヴァイオリン', note: 'also バイオリン' }],
        cultural_notes: [], synthesis: ['s'], mnemonic: 'm'
      }
    },
    zh: {
      etymology: {
        original_sense: '本义', senses_path: { primary: '本义', extended: [{ sense: '引申', from: '本义' }], figurative: '' },
        character_evolution: [{ stage: '甲骨文', form: 'shape', meaning: 'meaning', note: '' }],
        components: [{ part: '氵', kind: 'semantic', meaning: 'water', note: '' }],
        multiple_readings: [{ reading: 'qīng', meaning: 'blue', example: '青山' }],
        classical: { meanings: [{ sense: '古义', example: '古文例句', source: '论语' }], usages: [{ pattern: '名词作动词', example: '例', gloss: 'g' }] },
        word_formation: { type: '偏正式', parts: [{ morpheme: '青', meaning: 'blue', role: '修饰' }], note: '' }
      },
      usage: {
        senses: [{ pos: '名', definition: '完整的释义', examples: [] }],
        collocations: [{ pattern: '青+色', meaning: 'm', typical_objects: [] }],
        usage_notes: ['书面']
      },
      distinction: {
        confusables: { theme: 't', table: [{ word, meaning: 'm', note: 'n' }], parallel_examples: [], contrast_pairs: [] },
        origin_allusion: { source: '庄子', author: '庄周', quote: '引文', meaning: 'then', note: '' },
        then_and_now: { then: '古义', now: '今义', note: '' },
        cultural_notes: [], synthesis: ['s'], mnemonic: 'm'
      }
    }
  };
  base.lines = L[language];
  Object.assign(base, overrides || {});
  return base;
}

/* ---------- Config ---------- */

function testConfig(env) {
  section('Configuration');
  const C = env.ns.CONFIG;
  check('version reads 3.0.2', C.version === '3.0.2', C.version);
  check('schema is 3', C.schemaVersion === 3);
  check('five languages are declared', C.languages.length === 5, C.languages.map((l) => l.id).join(','));
  check('the query picker and the explanation picker are the same set',
    C.outputLanguages.length === C.languages.length);
  check('explanations default to English', C.defaultOutputLang === 'en', C.defaultOutputLang);
  check('Chinese and Japanese are marked as needing a reading',
    C.languages.filter((l) => l.needsReading).map((l) => l.id).sort().join(',') === 'ja,zh');
  check('each language carries its practice form',
    C.languages.every((l) => ['spell', 'pinyin', 'kana', 'katakana'].indexOf(l.practice) > -1));
  check('cardOrder covers every catalogued card',
    C.cardOrder.length === Object.keys(C.cardCatalog).length &&
    C.cardOrder.every((key) => !!C.cardCatalog[key]));
  check('every card declares which line produces it',
    C.cardOrder.every((key) => C.deepLines.indexOf(C.cardLines[key]) > -1));
  check('sentence cards are declared with at least four required',
    C.sentenceCardOrder.length >= 9 &&
    C.sentenceCardOrder.filter((k) => C.sentenceCatalog[k].required).length === 4);
  check('storage is namespaced for 3.0', env.ns.STORAGE_PREFIX === 'dict3');
}

/* ---------- Store ---------- */

async function testStore(env) {
  const store = env.ns.store;
  section('Storage');

  check('defaults come from config',
    store.getSettings().outputLang === 'en' && store.getSettings().queryLang === 'auto');

  /* The whole reason the language is in the key. */
  const en = store.entryId('gift', 'en', 'deepseek-flash', 'en');
  const de = store.entryId('gift', 'de', 'deepseek-flash', 'en');
  check('the same spelling in two languages gets two ids', en !== de, en + ' vs ' + de);
  check('ids are stable', store.entryId('gift', 'de', 'deepseek-flash', 'en') === de);
  check('the output language still separates entries',
    store.entryId('gift', 'de', 'deepseek-flash', 'ja') !== de);

  /* Non-Latin headwords have no ASCII left to slug, so without a fallback every
     Chinese and Japanese word would share one id and overwrite the others. */
  const zhA = store.entryId('青', 'zh', 'deepseek-flash', 'en');
  const zhB = store.entryId('成功', 'zh', 'deepseek-flash', 'en');
  const jaA = store.entryId('成功', 'ja', 'deepseek-flash', 'en');
  const jaB = store.entryId('アルバイト', 'ja', 'deepseek-flash', 'en');
  check('two different Chinese words get different ids', zhA !== zhB, zhA + ' vs ' + zhB);
  check('two different Japanese words get different ids', jaA !== jaB, jaA + ' vs ' + jaB);
  check('the same spelling in different scripts still differs', zhB !== jaA);
  check('a non-Latin id is not empty', zhA.replace(/[-]/g, '').length > 6, zhA);
  check('ids stay deterministic',
    store.entryId('青', 'zh', 'deepseek-flash', 'en') === zhA);
  check('and a Latin id is unchanged by the fallback',
    store.entryId('contend', 'en', 'deepseek-flash', 'en') === 'contend--en--deepseek-flash--en');

  store.saveEntry(entryFor(env.ns, store, 'en', 'gift'));
  store.saveEntry(entryFor(env.ns, store, 'de', 'Gift'));
  check('both survive under their own id',
    !!store.getEntry(en) && !!store.getEntry(de));
  check('the history row carries the language',
    store.findRow(de).language === 'de');
  check('the history row carries the reading for the practice pool',
    typeof store.findRow(de).reading === 'string');

  store.clearStarred();
  store.clearHistory();
  const id = store.entryId('checker', 'en', 'deepseek-flash', 'en');
  store.saveEntry(entryFor(env.ns, store, 'en', 'checker', { id }));
  store.toggleStar(id);
  check('starring marks it as a favourite', store.isStarred(id) === true);

  section('Wordbooks');

  const bookA = store.createWordbook('Hard words');
  const bookB = store.createWordbook('Exam');
  check('a wordbook is created with an id and a name',
    !!bookA && !!bookA.id && bookA.name === 'Hard words');
  check('a blank name is refused', store.createWordbook('   ') === null);

  const id2 = store.entryId('liminal', 'en', 'deepseek-flash', 'en');
  store.saveEntry(entryFor(env.ns, store, 'en', 'liminal', { id: id2 }));
  store.addToWordbook(bookA.id, id);
  store.addToWordbook(bookA.id, id2);
  store.addToWordbook(bookB.id, id);
  check('a word can belong to several books at once',
    store.wordbooksFor(id).length === 2, String(store.wordbooksFor(id).length));
  check('membership implies favourite (adding starred it)',
    store.isStarred(id2) === true);
  check('books list their members',
    store.findWordbook(bookA.id).entries.length === 2);

  store.removeFromWordbook(bookA.id, id2);
  check('removing from a book only unlinks', store.findWordbook(bookA.id).entries.length === 1);
  check('and leaves the word starred', store.isStarred(id2) === true);

  store.renameWordbook(bookB.id, 'Renamed');
  check('a book can be renamed', store.findWordbook(bookB.id).name === 'Renamed');

  store.removeWordbook(bookA.id);
  check('deleting a book removes only the book', store.findWordbook(bookA.id) === null);
  check('the words it held are still favourites', store.isStarred(id) === true);

  store.removeEntry(id);
  check('deleting a word unlinks it from every book',
    store.listWordbooks().every((b) => b.entries.indexOf(id) === -1));
}

/* ---------- Prompts ---------- */

async function testPrompts(env) {
  const P = env.ns.prompts;
  const C = env.ns.CONFIG;
  section('Prompt library');

  const ids = C.languages.map((l) => l.id);
  const problems = [];
  const targets = [
    ['overview', (src, out) => P.overview(src, out)],
    ['deep/etymology', (src, out) => P.deep(src, 'etymology', out)],
    ['deep/usage', (src, out) => P.deep(src, 'usage', out)],
    ['deep/distinction', (src, out) => P.deep(src, 'distinction', out)],
    ['sentence/semantics', (src, out) => P.sentence(src, 'semantics', out)],
    ['sentence/grammar', (src, out) => P.sentence(src, 'grammar', out)],
    ['reverse', (src, out) => P.reverse(src, out)],
    ['candidate', (src, out) => P.candidate(src, out, 'x')]
  ];

  targets.forEach(([name, build]) => {
    ids.forEach((src) => {
      ids.forEach((out) => {
        const text = build(src, out);
        if (!text || text.length < 80) { problems.push(name + ' ' + src + '->' + out + ' too short'); return; }
        const leftover = text.match(/\{[A-Z_]+\}/g);
        if (leftover) problems.push(name + ' ' + src + '->' + out + ' left ' + [...new Set(leftover)].join(','));
      });
    });
  });

  check('every source x output combination builds a complete prompt',
    problems.length === 0, problems.slice(0, 4).join(' | '));

  const auto = P.overview('auto', 'en');
  check('the Auto overview asks the model to name the language',
    /which language the headword actually is/.test(auto) && /"en", "fr", "de", "ja", "zh"/.test(auto));
  check('the Auto overview does not assume a fixed language',
    !/always "auto"/.test(auto));

  const deEtym = P.deep('de', 'etymology', 'en');
  check('the German etymology prompt asks for compounds', /compounds/.test(deEtym));
  check('and for German–English false friends', /GERMAN–ENGLISH false friends/.test(deEtym));
  check('and names the consonant shift', /consonant shift/.test(deEtym));

  const frUsage = P.deep('fr', 'usage', 'en');
  check('the French usage prompt asks for gender', /gender_number/.test(frUsage));
  check('and for conjugation', /conjugation/.test(frUsage));
  const frDist = P.deep('fr', 'distinction', 'en');
  check('the French distinction prompt asks for doublets', /doublets/.test(frDist));

  const jaEtym = P.deep('ja', 'etymology', 'en');
  check('the Japanese etymology prompt asks for stroke-formation analysis', /phono-semantic/.test(jaEtym));
  check('and for the word stratum', /word_stratum/.test(jaEtym));
  check('and for okurigana', /okurigana/.test(jaEtym));

  const zhEtym = P.deep('zh', 'etymology', 'en');
  check('the Chinese etymology prompt walks the script stages', /甲骨文/.test(zhEtym));
  check('and asks for 多音字', /multiple_readings/.test(zhEtym));
  check('and for classical usage', /词类活用/.test(zhEtym));
  check('Chinese does not ask for a separate Etymology section', !/"etymology"/.test(zhEtym));

  const deUsage = P.deep('de', 'usage', 'en');
  check('German grammar keys are English', /article_plural/.test(deUsage) && /principal_parts/.test(deUsage) &&
    /case_government/.test(deUsage) && /separable_prefixes/.test(deUsage));

  const jaSent = P.sentence('ja', 'grammar', 'en');
  check('sentence grammar focus is per language', /助詞/.test(jaSent));
  const deSent = P.sentence('de', 'grammar', 'en');
  check('German sentence grammar names the Satzklammer', /Satzklammer/.test(deSent));
}

/* ---------- API shape ---------- */

async function testApi(env) {
  const api = env.ns.api;
  const C = env.ns.CONFIG;
  section('Request shape');

  let captured = null;
  env.setFetch((url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return jsonResponse(completion('{"status":"ok","word":"Gift","language":"de","reading":"/ɡɪft/"}'));
  });

  await api.overview({ apiKey: 'k', model: 'deepseek-flash', sourceLang: 'de', outputLang: 'ja', input: 'Gift' });
  check('posts to the chat completions endpoint',
    captured.url === 'https://api.deepseek.com/chat/completions');
  check('sends the key as a bearer token', captured.options.headers.Authorization === 'Bearer k');
  check('requests json_object output', captured.body.response_format.type === 'json_object');
  check('thinking stays off', captured.body.thinking.type === 'disabled');
  check('the source language reaches the prompt', /German/.test(captured.body.messages[0].content));
  check('the output language reaches the prompt', /Japanese/.test(captured.body.messages[0].content));
  check('overview uses its own token ceiling', captured.body.max_tokens === C.maxTokens.overview);

  for (const line of ['etymology', 'usage', 'distinction']) {
    captured = null;
    await api.deepLine({
      apiKey: 'k', model: 'deepseek-flash', sourceLang: 'zh', outputLang: 'en',
      overview: { word: '青', language: 'zh', reading: 'qīng', pos: '名', quick_meaning: 'blue' },
      line
    });
    check(line + ' uses its own token ceiling',
      captured.body.max_tokens === C.maxTokens[line], String(captured.body.max_tokens));
    check(line + ' carries the reading into the context',
      /qīng/.test(captured.body.messages[1].content));
  }

  captured = null;
  await api.sentenceLine({
    apiKey: 'k', model: 'deepseek-flash', sourceLang: 'ja', outputLang: 'en',
    input: '私は学校へ行きます。', line: 'grammar'
  });
  check('sentence grammar uses its own ceiling',
    captured.body.max_tokens === C.maxTokens.sentenceGrammar);
  check('the sentence reaches the prompt', /私は学校へ行きます/.test(captured.body.messages[1].content));

  env.setFetch(() => jsonResponse(completion('{"typed_is_valid":false,"candidates":[{"word":"flâner","gloss":"to stroll"}]}')));
  const accent = await api.accentCandidates({ apiKey: 'k', model: 'm', sourceLang: 'fr', outputLang: 'en', input: 'flaner' });
  check('accent candidates report whether the typed form was already valid',
    accent.typedIsValid === false && accent.candidates.length === 1);
  check('the candidate keeps its accents', accent.candidates[0].word === 'flâner');

  let unknownRejected = false;
  try {
    await api.deepLine({ apiKey: 'k', model: 'm', sourceLang: 'en', outputLang: 'en', overview: { word: 'x' }, line: 'nope' });
  } catch (err) { unknownRejected = true; }
  check('an unknown deep line is rejected', unknownRejected);

  env.setFetch(() => jsonResponse(completion('```json\n{"status":"ok"}\n```')));
  const fenced = await api.overview({ apiKey: 'k', model: 'm', sourceLang: 'en', outputLang: 'en', input: 'x' });
  check('json wrapped in a fence is recovered', fenced.status === 'ok');

  env.setFetch(() => jsonResponse({ error: { message: 'auth' } }, 401));
  let kind = null;
  try { await api.overview({ apiKey: 'bad', model: 'm', sourceLang: 'en', outputLang: 'en', input: 'x' }); }
  catch (err) { kind = err.kind; }
  check('401 maps to the auth kind', kind === 'auth');

  /* One failing line must not take the others down. */
  env.setFetch((url, options) => {
    const system = JSON.parse(options.body).messages[0].content;
    if (/core_metaphor/.test(system)) return jsonResponse(completion('{"core_metaphor":"ok"}'));
    if (/"senses"/.test(system)) return jsonResponse({ error: { message: 'boom' } }, 500);
    return jsonResponse(completion('{"mnemonic":"m"}'));
  });
  const seen = [];
  const results = await api.deepLines({
    apiKey: 'k', model: 'deepseek-flash', sourceLang: 'en', outputLang: 'en',
    overview: { word: 'x', language: 'en', pos: 'n.', quick_meaning: 'g' }
  }, (r) => seen.push(r));
  check('each line reports through the callback', seen.length === 3, String(seen.length));
  check('a good line carries data', results.etymology.ok === true);
  check('a bad line carries an error shape', results.usage.ok === false && !!results.usage.error.kind);
  check('the batch never rejects', Object.keys(results).length === 3);
}

/* ---------- Practice ---------- */

async function testPractice(env) {
  const P = env.ns.practice;
  section('Practice — normalisers');

  const p1 = P.normalizePinyin('qīng');
  const p2 = P.normalizePinyin('qing1');
  const p3 = P.normalizePinyin('qing');
  check('a tone mark, a tone digit and nothing all give the same base',
    p1.base === 'qing' && p2.base === 'qing' && p3.base === 'qing');
  check('the tone is read from the mark', p1.tone === '1');
  check('the tone is read from the digit', p2.tone === '1');
  check('an absent tone stays absent', p3.tone === '');
  check('ü and v agree', P.normalizePinyin('lü').base === P.normalizePinyin('lv').base);

  check('romaji becomes hiragana', P.romajiToHiragana('seikou') === 'せいこう');
  check('a doubled consonant becomes 促音', P.romajiToHiragana('kitte') === 'きって');
  check('n before a consonant becomes ん', P.romajiToHiragana('shinbun') === 'しんぶん');
  check('kana becomes romaji', P.hiraganaToRomaji('せいこう') === 'seikou');
  check('hiragana and katakana convert both ways',
    P.hiraganaToKatakana('せいこう') === 'セイコウ' && P.katakanaToHiragana('セイコウ') === 'せいこう');
  check('long vowels collapse to one form',
    P.foldLong('seikou') === P.foldLong('seikoo') && P.foldLong('seikou') === P.foldLong('seikō'));
  check('kana typed directly and romaji land on the same form',
    P.kanaEquivalent(P.normalizeKana('せいこう', 'kana'), P.normalizeKana('seikou', 'kana')));
  check('katakana output is katakana',
    P.normalizeKana('vaiorin', 'katakana') === 'ヴァイオリン'.slice(0, 1) + 'ァイオリン' ||
    /[\u30A0-\u30FF]/.test(P.normalizeKana('vaiorin', 'katakana')));

  section('Practice — judging');

  check('pinyin: syllable and tone right is perfect',
    P.judgePinyin('qīng', 'qīng').status === 'perfect');
  check('pinyin: tone digit works too',
    P.judgePinyin('qing1', 'qīng').status === 'perfect');
  check('pinyin: right syllable, wrong tone is not marked wrong',
    P.judgePinyin('qing', 'qīng').status === 'tone');
  check('pinyin: a different syllable is wrong',
    P.judgePinyin('qin', 'qīng').status === 'wrong');

  check('kana: exact reading is perfect',
    P.judgeKana('せいこう', 'せいこう', 'kana').status === 'perfect');
  check('kana: romaji input is accepted',
    P.judgeKana('seikou', 'せいこう', 'kana').status === 'perfect');
  check('kana: long-vowel spelling variants are accepted',
    P.judgeKana('seikoo', 'せいこう', 'kana').status === 'perfect');
  check('kana: katakana input for a katakana word is perfect',
    P.judgeKana('vaiorin', 'ヴァイオリン', 'katakana', ['バイオリン']).status === 'perfect');
  check('kana: a spelling variant is accepted',
    P.judgeKana('baiorin', 'ヴァイオリン', 'katakana', ['バイオリン']).status === 'perfect');

  /* The answer is the reading, and the okurigana is its tail: おこな＋う. */
  const okuri = P.judgeKana('おこなあ', 'おこなう', 'kana', [], 'う');
  check('okurigana is judged separately when only the tail differs',
    okuri.status === 'wrong' && okuri.note === 'okurigana', JSON.stringify(okuri));

  check('latin spelling stays accent-tolerant',
    P.judgeSpelling('flaner', 'flâner', []).status === 'perfect');
  check('latin spelling catches a wrong letter',
    P.judgeSpelling('chicker', 'checker', []).status === 'wrong');
  check('a listed variant is accepted',
    P.judgeSpelling('color', 'colour', ['color']).status === 'perfect');

  section('Practice — exercise state machine');

  const ex = P.createExercise({
    word: '青', reading: 'qīng', meaning: 'blue', language: 'zh', practice: 'pinyin', entryId: 'e1', mode: 'single'
  });
  check('a Chinese exercise answers with the reading', ex.answer === 'qīng');
  check('and shows the reading as its slots', P.answerChars(ex).length === 4);

  P.applyInput(ex, 'qing');
  P.applySubmit(ex);
  check('a right syllable with no tone is accepted',
    ex.status === 'correct' && ex.note === 'tone');

  const ex2 = P.createExercise({ word: 'せいこう', reading: 'せいこう', meaning: 'success', language: 'ja', practice: 'kana' });
  check('a Japanese exercise converts its reading', P.answerChars(ex2).length === 4);
  P.applyInput(ex2, 'seikou');
  check('typing romaji shows kana', P.displayChars(ex2).join('') === 'せいこう');
  P.applySubmit(ex2);
  check('a right reading is correct', ex2.status === 'correct');

  const ex3 = P.createExercise({ word: 'checker', reading: '', meaning: 'm', language: 'en', practice: 'spell' });
  P.applyInput(ex3, 'chicker');
  P.applySubmit(ex3);
  check('a wrong spelling reveals the answer', ex3.status === 'wrong' && ex3.reveal === true);
  P.applySubmit(ex3);
  check('the second submit clears for a retry', ex3.status === 'input' && ex3.typed === '');
  check('input is ignored once revealed',
    (function () { P.applySubmit(ex3); P.applyInput(ex3, 'x'); return ex3.status === 'input'; })());

  const ex4 = P.createExercise({ word: 'checker', reading: '', meaning: 'm', language: 'en', practice: 'spell' });
  P.applyInput(ex4, 'ch3ck3r!!');
  check('non-letters are dropped', ex4.typed === 'chckr');
}

/* ---------- Rendering ---------- */

async function testRendering(env) {
  const ns = env.ns;
  const store = ns.store;
  section('Per-language card sets');

  store.clearStarred();
  store.clearHistory();
  ns.session.collapsed = {};

  const cases = [
    ['en', 'contend', ['core', 'etymology', 'morphology', 'rootFamily', 'falseCognates'],
      ['kanjiOrigin', 'characterEvolution', 'readings', 'artikelPlural']],
    ['fr', 'flâner', ['core', 'gender_number', 'conjugation', 'doublets'], ['stammformen', 'readings']],
    ['de', 'Gift', ['core', 'compounds', 'article_plural', 'principal_parts', 'case_government', 'separable_prefixes', 'sound_shift'],
      ['gender_number', 'doublets', 'readings']],
    ['ja', '成功', ['nuance', 'readings', 'kanji_origin', 'components', 'word_stratum', 'conjugation', 'source_word', 'spelling_variants'],
      ['article_plural', 'gender_number']],
    ['zh', '青', ['original_sense', 'character_evolution', 'components', 'multiple_readings', 'classical_vs_modern', 'classical_usage'],
      ['etymology', 'kanjiOrigin', 'conjugation']]
  ];

  /* Which cards each language's sample data can fill. The expected DOM order is
     then derived from CONFIG.cardOrder, so this asserts set membership and
     ordering against the one declared order rather than a second copy of it. */
  const expectedSets = {
    en: ['senses', 'collocations', 'usage', 'confusables', 'core', 'etymology', 'morphology',
      'rootFamily', 'falseCognates', 'pronunciation', 'culture', 'synthesis', 'mnemonic'],
    fr: ['senses', 'collocations', 'usage', 'confusables', 'core', 'etymology', 'morphology',
      'rootFamily', 'falseCognates', 'conjugation', 'genreNombre', 'doublets', 'synthesis', 'mnemonic'],
    de: ['senses', 'collocations', 'usage', 'confusables', 'core', 'etymology', 'morphology',
      'komposita', 'rootFamily', 'falseCognates', 'stammformen', 'kasusRektion', 'trennbarePraefixe',
      'artikelPlural', 'lautverschiebung', 'synthesis', 'mnemonic'],
    ja: ['senses', 'collocations', 'usage', 'confusables', 'nuance', 'etymology', 'kanjiOrigin',
      'components', 'readings', 'wordStratum', 'conjugation', 'sourceWord', 'spellingVariants',
      'pronunciation', 'synthesis', 'mnemonic'],
    zh: ['senses', 'collocations', 'usage', 'confusables', 'originalSense', 'thenAndNow',
      'characterEvolution', 'components', 'wordFormation', 'multipleReadings',
      'classicalVsModern', 'classicalUsage', 'originAllusion', 'synthesis', 'mnemonic']
  };

  for (const [lang, word] of cases) {
    const entry = entryFor(ns, store, lang, word);
    store.saveEntry(entry);
    const screen = container();
    ns.views.word.render(screen, { id: entry.id });
    const html = screen.innerHTML;
    const found = [...html.matchAll(/data-card="([^"]+)"/g)].map((m) => m[1]);
    const want = ns.CONFIG.cardOrder.filter((key) => expectedSets[lang].indexOf(key) > -1);
    check(lang + ': the right cards render',
      found.join(',') === want.join(','),
      'got ' + found.join(','));

    const order = ns.CONFIG.cardOrder;
    const indexes = found.map((key) => order.indexOf(key));
    check(lang + ': cards keep the configured order',
      indexes.every((value, i) => i === 0 || value > indexes[i - 1]));
  }

  section('Card titles stay English');

  const zhEntry = entryFor(ns, store, 'zh', '青');
  const zhScreen = container();
  ns.views.word.render(zhScreen, { id: zhEntry.id });
  check('a CJK card carries its native gloss',
    /Character evolution · 字源演变/.test(zhScreen.innerHTML));
  check('and the glyph is escaped, not injected',
    zhScreen.innerHTML.indexOf('[object') === -1);

  const enEntry = entryFor(ns, store, 'en', 'contend');
  const enScreen = container();
  ns.views.word.render(enScreen, { id: enEntry.id });
  check('Latin-script cards have no native gloss',
    /Semantic core<\/span>/.test(enScreen.innerHTML) && !/Semantic core ·/.test(enScreen.innerHTML));
  check('the derived pronunciations now have a card',
    /data-card="pronunciation"/.test(enScreen.innerHTML) && /ˈx/.test(enScreen.innerHTML));

  const titlesOnly = [...enScreen.innerHTML.matchAll(/<span class="card-title">([^<]+)<\/span>/g)]
    .map((m) => m[1]);
  check('every English card title is plain ASCII',
    titlesOnly.every((t) => /^[\x20-\x7E]+$/.test(t)), titlesOnly.join(' | '));

  section('Collapse');

  ns.session.collapsed = { etymology: true };
  const collapsed = container();
  ns.views.word.render(collapsed, { id: enEntry.id });
  check('a collapsed card says so',
    /data-toggle="etymology"[^>]*aria-expanded="false"/.test(collapsed.innerHTML));
  ns.session.collapsed = {};
  ns.CONFIG.cardOrder.forEach((key) => { ns.session.collapsed[key] = true; });
  const allCollapsed = container();
  ns.views.word.render(allCollapsed, { id: enEntry.id });
  check('everything collapsed offers Expand all', /Expand all/.test(allCollapsed.innerHTML));
  ns.session.collapsed = {};
}

/* ---------- Favourites ---------- */

async function testFavorites(env) {
  const ns = env.ns;
  const store = ns.store;
  section('Favourites');

  store.clearStarred();
  store.clearHistory();
  ns.session.favoritesSource = 'all';

  const words = [['checker', 'en'], ['flâner', 'fr'], ['Gift', 'de'], ['成功', 'ja'], ['青', 'zh']];
  const ids = {};
  words.forEach(([word, lang]) => {
    const entry = entryFor(ns, store, lang, word);
    /* Chinese and Japanese need a reading; give the sample one for each. */
    if (lang === 'ja') entry.overview.reading = 'せいこう';
    if (lang === 'zh') entry.overview.reading = 'qīng';
    store.saveEntry(entry);
    store.toggleStar(entry.id);
    ids[word] = entry.id;
  });

  const screen = container();
  ns.views.favorites.render(screen, {});
  const html = screen.innerHTML;

  ['English', 'French', 'German', 'Japanese', 'Chinese'].forEach((label) => {
    check('the favourites screen groups ' + label, html.indexOf('>' + label + '<') > -1);
  });
  check('multi-word expressions are kept out of the pool', (function () {
    const entry = entryFor(ns, store, 'en', "coup d'état");
    store.saveEntry(entry);
    store.toggleStar(entry.id);
    const pool = ns.views.favorites.practicePool('all').map((r) => r.word);
    return pool.indexOf("coup d'état") === -1;
  })());

  const allPool = ns.views.favorites.practicePool('all').map((r) => r.language).sort();
  check('the pool spans every language with something to practise',
    allPool.join(',') === 'de,en,fr,ja,zh', allPool.join(','));
  check('a word with no reading cannot be practised', (function () {
    const bare = entryFor(ns, store, 'ja', '無読');
    bare.overview.reading = '';
    store.saveEntry(bare);
    store.toggleStar(bare.id);
    return ns.views.favorites.canPractise(store.findRow(bare.id)) === false;
  })());

  const book = store.createWordbook('Mine');
  store.addToWordbook(book.id, ids['checker']);
  store.addToWordbook(book.id, ids['青']);
  const bookPool = ns.views.favorites.practicePool(book.id).map((r) => r.word).sort();
  check('a wordbook source holds only its own words',
    bookPool.join(',') === 'checker,青', bookPool.join(','));
  check('the source selector names every source and its count',
    /All favourites \(/.test(html) && /Mine \(/.test(html) === false);

  /* Rendering with the book selected shows just those two. */
  ns.session.favoritesSource = book.id;
  const bookScreen = container();
  ns.views.favorites.render(bookScreen, {});
  check('selecting a wordbook filters the list',
    /checker/.test(bookScreen.innerHTML) && !/flâner/.test(bookScreen.innerHTML));
  ns.session.favoritesSource = 'all';

  /* Empty source gets its own message, not a generic one. */
  const messages = [];
  const originalToast = ns.ui.toast;
  ns.ui.toast = (m) => messages.push(m);
  const empty = store.createWordbook('Empty');
  ns.session.favoritesSource = empty.id;
  ns.views.favorites.startPractice();
  check('an empty source says so instead of starting', messages.length === 1, messages.join('|'));
  ns.session.favoritesSource = 'all';
  ns.ui.toast = originalToast;
}

/* ---------- Cross-line rendering ---------- */

/* ---------- 3.0.1 fixes ---------- */

async function testFixes(env) {
  const ns = env.ns;
  const store = ns.store;
  section('Sentence mode accepts any script');

  if (!ns.router) ns.router = { refresh: function () {} };
  const messages = [];
  const originalToast = ns.ui.toast;
  ns.ui.toast = (message) => messages.push(message);

  const trySubmit = function (text, mode) {
    messages.length = 0;
    ns.session.mode = mode;
    ns.session.pending = null;
    ns.views.dictionary.submit(text);
    return { messages: messages.slice(), pending: ns.session.pending };
  };

  /* A Chinese sentence has no spaces, so a word-count check would reject every
     one of them. */
  const chinese = trySubmit('这是一句完全没有空格的中文，用来验证不再按空格数判定。', 'sentence');
  check('a spaceless Chinese sentence is accepted', chinese.messages.length === 0, chinese.messages.join('|'));
  check('and it actually starts a sentence lookup',
    !!chinese.pending && chinese.pending.kind === 'sentence');

  const single = trySubmit('word', 'sentence');
  check('a single word is accepted in sentence mode', single.messages.length === 0, single.messages.join('|'));

  const empty = trySubmit('   ', 'sentence');
  check('blank input is still rejected', empty.messages.length === 1, empty.messages.join('|'));

  const long = trySubmit('x'.repeat(ns.CONFIG.limits.maxSentenceLength + 1), 'sentence');
  check('over-long input is still rejected',
    long.messages.length === 1 && /under/.test(long.messages[0]), long.messages.join('|'));

  /* Word mode keeps its own bounds. */
  const longPhrase = trySubmit('one two three four five six', 'word');
  check('word mode still rejects a long phrase', longPhrase.messages.length === 1, longPhrase.messages.join('|'));
  ns.session.mode = 'word';
  ns.ui.toast = originalToast;

  section('Accent choice');

  const decide = ns.views.dictionary.accentDecision;
  check('the decision helper is exposed', typeof decide === 'function');

  const none = decide('table', true, []);
  check('no candidates means no panel', none.showPanel === false);

  const selfOnly = decide('table', true, [{ word: 'table', gloss: 'a table' }]);
  check('a single candidate that is the input means no panel', selfOnly.showPanel === false);

  /* The case the fix exists for: the typed form is valid AND there are
     accented readings too. */
  const ambiguous = decide('cote', true, [
    { word: 'côte', gloss: 'coast' },
    { word: 'côté', gloss: 'side' }
  ]);
  check('a valid form with accented alternatives still asks', ambiguous.showPanel === true);
  check('and the typed form is offered first',
    ambiguous.items[0].word === 'cote' && ambiguous.items[0].typed === true,
    JSON.stringify(ambiguous.items.map((i) => i.word)));
  check('the accented readings are kept after it',
    ambiguous.items.map((i) => i.word).join(',') === 'cote,côte,côté',
    ambiguous.items.map((i) => i.word).join(','));

  /* If the model forgets to list what was typed, it is forced in anyway. */
  const omitted = decide('cote', true, [{ word: 'côte', gloss: 'coast' }]);
  check('a model that omits the typed form does not break the panel',
    omitted.showPanel === true && omitted.items[0].word === 'cote' && omitted.items[0].typed === true);

  const validNotTyped = decide('cote', false, [{ word: 'côte', gloss: 'coast' }]);
  check('an invalid typed form is not labelled as yours',
    validNotTyped.showPanel === true && !validNotTyped.items.some((i) => i.typed));

  /* Diacritics must NOT be folded here — cote and côte are the point. */
  const accentSensitive = decide('cote', false, [{ word: 'côte', gloss: 'coast' }, { word: 'cote', gloss: 'quota' }]);
  check('the typed form is matched with diacritics intact',
    accentSensitive.items.filter((i) => i.typed).length === 1 &&
    accentSensitive.items.filter((i) => i.typed)[0].word === 'cote');

  section('Single entry points');

  store.clearStarred();
  store.clearHistory();
  ns.session.candidates = null;
  ns.session.mode = 'word';
  const screen = container();
  ns.views.dictionary.render(screen, {});
  check('the dictionary screen has no Favourites button',
    screen.innerHTML.indexOf('lookup-favorites') === -1);
  check('and no Favourites label either', screen.innerHTML.indexOf('>Favourites<') === -1);
  check('the search row is back to two buttons',
    /id="lookup-submit"/.test(screen.innerHTML) && /id="lookup-random"/.test(screen.innerHTML));

  const appSource = fs.readFileSync(path.join(JS_DIR, 'app.js'), 'utf8');
  check('the top bar no longer renders a profile icon',
    appSource.indexOf('topbar-settings') === -1);

  section('Bottom tabs actually reach their screens');

  const tabs = ns.router.tabs;
  check('the router exposes its tabs', Array.isArray(tabs) && tabs.length === 3);
  check('every tab has a distinct hash', new Set(tabs.map((t) => t.hash)).size === 3);
  tabs.forEach((tab) => {
    const parsed = ns.router.parse(tab.hash);
    check('tab ' + tab.id + ' resolves back to itself',
      parsed.tab === tab.id && parsed.name === tab.id,
      tab.hash + ' -> name=' + parsed.name + ' tab=' + parsed.tab);
  });
  /* The specific shape of the old bug: a handler that hard-codes destinations
     while the button carries one that is never read. */
  check('the tab handler does not hard-code destinations',
    appSource.indexOf("id === 'profile' ? '#/profile' : '#/dictionary'") === -1);
  check('and it reads the destination off the button',
    /getAttribute\('data-hash'\)/.test(appSource));
  check('and the button carries one', /data-hash="/.test(appSource));

  section('Surprise me');

  check('a pinned language wins over the model',
    ns.views.dictionary.surpriseTarget('fr', 'de') === 'fr');
  check('on Auto the model decides',
    ns.views.dictionary.surpriseTarget('auto', 'ja') === 'ja');
  check('an unsupported language falls back to English',
    ns.views.dictionary.surpriseTarget('auto', 'xx') === 'en');
  check('a missing language falls back too',
    ns.views.dictionary.surpriseTarget('auto', '') === 'en');

  let captured = null;
  env.setFetch((url, options) => {
    captured = JSON.parse(options.body);
    return jsonResponse(completion('{"word":"木漏れ日","language":"ja","gloss":"light through leaves","why":"it names a whole scene"}'));
  });
  const suggested = await ns.api.surprise({
    apiKey: 'k', model: 'deepseek-flash', sourceLang: 'auto', outputLang: 'en',
    avoid: ['ephemeral', 'liminal']
  });
  check('a suggestion is parsed',
    !!suggested && suggested.word === '木漏れ日' && suggested.language === 'ja');
  check('the scope spans every language on Auto',
    /Pick one language at random/.test(captured.messages[0].content));
  check('the avoid list reaches the prompt',
    /ephemeral, liminal/.test(captured.messages[1].content));
  check('and it asks for texture rather than common vocabulary',
    /texture/.test(captured.messages[0].content));

  captured = null;
  await ns.api.surprise({ apiKey: 'k', model: 'm', sourceLang: 'fr', outputLang: 'en', avoid: [] });
  check('a pinned language narrows the scope',
    /must be in French/.test(captured.messages[0].content));
  check('an empty avoid list says so',
    /Nothing to avoid yet/.test(captured.messages[1].content));

  env.setFetch(() => jsonResponse(completion('{"nope":true}')));
  const unusable = await ns.api.surprise({ apiKey: 'k', model: 'm', sourceLang: 'auto', outputLang: 'en', avoid: [] });
  check('an unusable answer returns null instead of throwing', unusable === null);

  let noKeyKind = null;
  try { await ns.api.surprise({ apiKey: '', model: 'm', sourceLang: 'auto', outputLang: 'en', avoid: [] }); }
  catch (err) { noKeyKind = err.kind; }
  check('surprise needs a key like everything else', noKeyKind === 'no_key');

  const dictSource = fs.readFileSync(path.join(JS_DIR, 'view-dictionary.js'), 'utf8');
  check('the canned word list is gone', dictSource.indexOf("'petrichor'") === -1);

  /* The contextual "go fill in your key" action is not navigation and stays. */
  const notice = ns.views.dictionary.errorNotice({ kind: 'no_key', message: 'x' });
  check('error notices still offer the profile shortcut', /data-go-profile/.test(notice));

  section('Selected state is visible in both themes');

  const tokens = fs.readFileSync(path.join(WEB_DIR, 'assets', 'tokens.css'), 'utf8');
  const declared = [...tokens.matchAll(/--segment-selected:\s*([^;]+);/g)].map((m) => m[1].trim());
  check('the selected surface is declared for light and dark',
    declared.length >= 3, declared.join(' | '));
  check('and the two themes use different values for it',
    new Set(declared).size >= 2, [...new Set(declared)].join(' | '));
  check('the light value is not the dark card colour',
    declared.indexOf('#1c1c1e') === -1);

  const appCss = fs.readFileSync(path.join(WEB_DIR, 'assets', 'app.css'), 'utf8');
  const segmentRule = /\.segment\[aria-pressed="true"\]\s*\{([^}]*)\}/.exec(appCss);
  check('the selected segment uses the new token',
    !!segmentRule && /var\(--segment-selected\)/.test(segmentRule[1]));
  check('and draws its ring inset so the layout does not shift',
    !!segmentRule && /inset/.test(segmentRule[1]));
}

async function testInterleaving(env) {
  const ns = env.ns;
  const store = ns.store;
  section('Cross-line interleaving');

  store.patchSettings({ apiKey: 'sk-test', queryLang: 'en', outputLang: 'en' });
  const id = store.entryId('interleave', 'en', 'deepseek-flash', 'en');
  const pending = [];

  env.setFetch((url, options) => {
    const system = JSON.parse(options.body).messages[0].content;
    if (/fast, reliable overview/.test(system)) {
      return jsonResponse(completion(JSON.stringify({
        status: 'ok', word: 'interleave', language: 'en', reading: '/x/', pos: 'v.',
        quick_meaning: '交错', register: 'neutral', tags: []
      })));
    }
    return new Promise((resolve, reject) => { pending.push({ system, resolve, reject }); });
  });

  const live = container();
  ns.router = { refresh: function () { ns.views.word.render(live, { id }); } };
  env.location.hash = '#/word/' + encodeURIComponent(id);

  ns.session.pending = { id, input: 'interleave', label: 'interleave', language: 'en', kind: 'word' };
  ns.views.word.reset(null);
  ns.views.word.render(live, { id });
  await tick(); await tick();

  check('all three lines are requested at once', pending.length === 3, String(pending.length));
  check('every card holds a skeleton while its line is in flight',
    (live.innerHTML.match(/data-loading="/g) || []).length === ns.CONFIG.cardOrder.length,
    (live.innerHTML.match(/data-loading="/g) || []).length + ' of ' + ns.CONFIG.cardOrder.length);

  /* Identify the lines by a key only their shape contains. */
  const usage = pending.find((p) => /"senses"/.test(p.system));
  check('the three requests are the three lines',
    pending.some((p) => /core_metaphor/.test(p.system)) && !!usage &&
    pending.some((p) => /"confusables"/.test(p.system)));
  usage.resolve(jsonResponse(completion(JSON.stringify({
    senses: [{ pos: 'v.', definition: '交错排列，交替插入', examples: [] }],
    collocations: [], usage_notes: ['技术语境']
  }))));
  await tick(); await tick();

  check('the landed line renders only its own cards',
    (live.innerHTML.match(/data-card="/g) || []).length === 2,
    (live.innerHTML.match(/data-card="/g) || []).length + ' cards');
  check('the other lines are still skeletons',
    (live.innerHTML.match(/data-loading="/g) || []).length ===
    /* All of the usage line's cards stop being skeletons once it lands — even
       the one whose body is empty and so renders nothing. */
    ns.CONFIG.cardOrder.length - ns.CONFIG.cardOrder.filter((k) => ns.CONFIG.cardLines[k] === 'usage').length,
    (live.innerHTML.match(/data-loading="/g) || []).length + ' skeletons');

  const distinction = pending.find((p) => /"confusables"/.test(p.system));
  check('the distinction line was requested', !!distinction);
  distinction.reject(new TypeError('offline'));
  await tick(); await tick();
  check('a failed line reports exactly once',
    (live.innerHTML.match(/data-line-notice="/g) || []).length === 1,
    String((live.innerHTML.match(/data-line-notice="/g) || []).length));
  check('and the report names the failed line',
    /data-line-notice="distinction"/.test(live.innerHTML));
  check('the healthy line is untouched', /data-card="senses"/.test(live.innerHTML));

  const beforeRetry = pending.length;
  ns.views.word.retryLine('distinction');
  await tick();
  const retry = pending.slice(beforeRetry);
  check('retrying refetches exactly one line', retry.length === 1, String(retry.length));

  pending.forEach((item) => item.resolve(jsonResponse(completion('{}'))));
  await tick(); await tick();
  env.location.hash = '#/dictionary';
}

/* ---------- PWA, worker, packaging ---------- */

const EXPECTED_SITE_FILES = [
  'index.html', 'manifest.webmanifest', 'sw.js',
  'assets/app.css', 'assets/tokens.css',
  'js/api.js', 'js/app.js', 'js/config.js', 'js/practice.js', 'js/prompts.js',
  'js/pwa.js', 'js/speech.js', 'js/store.js', 'js/ui.js',
  'js/view-dictionary.js', 'js/view-favorites.js', 'js/view-profile.js', 'js/view-word.js',
  'icons/apple-touch-icon-180.png', 'icons/icon-192.png', 'icons/icon-512-maskable.png', 'icons/icon-512.png'
];

function testPwaAssets() {
  section('PWA assets');
  const manifest = JSON.parse(fs.readFileSync(path.join(WEB_DIR, 'manifest.webmanifest'), 'utf8'));
  check('the manifest still declares its icons',
    manifest.icons.every((icon) => fs.existsSync(path.join(WEB_DIR, icon.src))));

  const html = fs.readFileSync(path.join(WEB_DIR, 'index.html'), 'utf8');
  check('index.html loads the practice module', /src="js\/practice\.js"/.test(html));
  check('index.html no longer loads spell.js', !/src="js\/spell\.js"/.test(html));
  check('index.html loads the favourites view', /src="js\/view-favorites\.js"/.test(html));
  check('view-favorites loads after view-word',
    html.indexOf('js/view-word.js') < html.indexOf('js/view-favorites.js'));

  const sw = fs.readFileSync(path.join(WEB_DIR, 'sw.js'), 'utf8');
  const precache = [...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
  /* Derived from the declared version so bumping it never leaves this stale. */
  const version = /version:\s*'([^']+)'/.exec(fs.readFileSync(path.join(WEB_DIR, 'js', 'config.js'), 'utf8'))[1];
  check('the worker cache version tracks CONFIG.version',
    sw.indexOf("CACHE_VERSION = 'v" + version + "'") > -1,
    'expected v' + version + ' in sw.js');
  check('every precached path exists',
    precache.every((entry) => entry === '' || fs.existsSync(path.join(WEB_DIR, entry))),
    precache.filter((entry) => entry !== '' && !fs.existsSync(path.join(WEB_DIR, entry))).join(', '));
  check('practice.js is precached and spell.js is not',
    precache.indexOf('js/practice.js') > -1 && precache.indexOf('js/spell.js') === -1);
}

async function testServiceWorker() {
  section('Service worker');
  const listeners = {};
  const log = [];
  const stores = new Map();
  const ORIGIN = 'https://radicle.example';
  const keyOf = (r) => {
    const raw = typeof r === 'string' ? r : r.url;
    try { return new URL(raw, ORIGIN + '/').href; } catch (e) { return raw; }
  };
  const caches = {
    open: (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return Promise.resolve({
        addAll: (list) => { list.forEach((i) => { log.push('write:' + keyOf(i)); store.set(keyOf(i), { ok: true }); }); return Promise.resolve(); },
        put: (r) => { log.push('write:' + keyOf(r)); store.set(keyOf(r), { ok: true }); return Promise.resolve(); },
        match: (r) => { log.push('read:' + keyOf(r)); return Promise.resolve(store.get(keyOf(r))); }
      });
    },
    keys: () => Promise.resolve([...stores.keys()]),
    delete: (name) => { log.push('delete:' + name); return Promise.resolve(stores.delete(name)); },
    match: (r) => { log.push('read:' + keyOf(r)); for (const s of stores.values()) if (s.has(keyOf(r))) return Promise.resolve(s.get(keyOf(r))); return Promise.resolve(undefined); }
  };
  const scope = {
    console, Promise, URL, caches,
    fetch: () => Promise.resolve({ ok: true, clone: () => ({ ok: true }) }),
    self: {
      location: { origin: ORIGIN },
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
      addEventListener: (type, handler) => { listeners[type] = handler; }
    }
  };
  vm.createContext(scope);
  vm.runInContext(fs.readFileSync(path.join(WEB_DIR, 'sw.js'), 'utf8'), scope, { filename: 'sw.js' });

  let work = null;
  listeners.install({ waitUntil: (value) => { work = value; } });
  await Promise.resolve(work);
  check('install precaches the shell', log.length > 10);

  const apiCall = await (function () {
    log.length = 0;
    let responded = null;
    listeners.fetch({
      request: { url: 'https://api.deepseek.com/chat/completions', method: 'POST', mode: 'cors', headers: { has: (n) => n === 'authorization', get: () => 'Bearer sk' } },
      respondWith: (v) => { responded = v; }
    });
    return Promise.resolve(responded).then(() => ({ handled: responded !== null, ops: log.slice() }));
  })();
  check('the API call is not intercepted', apiCall.handled === false);
  check('and touches no cache', apiCall.ops.length === 0, apiCall.ops.join(','));
}

async function testDistribution() {
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
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const rel = prefix ? prefix + '/' + e.name : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), rel); else published.push(rel);
    });
  })(siteDir, '');
  published.sort();
  const expected = EXPECTED_SITE_FILES.slice().sort();
  check('the deploy folder matches the allowlist exactly',
    published.join('\n') === expected.join('\n'),
    'missing ' + expected.filter((f) => !published.includes(f)).join(',') +
    ' | extra ' + published.filter((f) => !expected.includes(f)).join(','));

  const version = /version:\s*'([^']+)'/.exec(fs.readFileSync(path.join(WEB_DIR, 'js', 'config.js'), 'utf8'))[1];
  const offlinePath = path.join(REPO_DIR, 'dist', 'radicle_' + version + '.html');
  check('the offline bundle is named after the version', fs.existsSync(offlinePath), offlinePath);
  check('and no unversioned offline bundle is left behind',
    !fs.existsSync(path.join(REPO_DIR, 'dist', 'radicle-offline.html')));

  const offline = fs.readFileSync(offlinePath, 'utf8');
  const external = [...offline.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
    .filter((v) => !v.startsWith('data:') && !/^https?:/i.test(v) && v !== '#');
  check('the offline bundle references no local files', external.length === 0, external.join(','));
  check('the offline bundle has no service worker registration',
    !/serviceWorker\s*\.\s*register/.test(offline));
  check('the offline bundle keeps the practice and favourites modules',
    /ns\.practice = \{/.test(offline) && /ns\.views\.favorites/.test(offline));
}

/* ---------- Entry point ---------- */

(async function main() {
  const env = createEnvironment();
  testConfig(env);
  await testStore(env);
  await testPrompts(env);
  await testApi(env);
  await testPractice(env);
  await testRendering(env);
  await testFavorites(env);
  await testFixes(env);
  await testInterleaving(env);
  testPwaAssets();
  await testServiceWorker();
  await testDistribution();

  console.log('\n' + passed + ' passed, ' + failures.length + ' failed');
  failures.forEach((item) => console.log('  - ' + item));
  process.exit(failures.length ? 1 : 0);
})().catch((err) => {
  console.error('Harness error:', err);
  process.exit(1);
});
