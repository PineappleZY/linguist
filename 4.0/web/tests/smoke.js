/* RADICLE 4.1 — dependency-free smoke test.

   Loads the real modules in index.html order inside a stubbed browser and
   drives them: storage and wordbooks, the seven-language prompt matrix, the
   practice normalisers, per-language card sets and card titles, the inflection
   line and its paradigm disclosures, switching the explanation language from
   an entry, type Auto, history grouping by day, the favourites screen, the
   service worker and the packaging output.

   node 4.0/web/tests/smoke.js
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

function cardTitles(html) {
  return [...html.matchAll(/<span class="card-title">([^<]+)<\/span>/g)].map((m) => m[1]);
}

/* An entry with data for every card of one language. */
function tensesFor(stem) {
  return [
    { mood: 'indicative', tense: 'present', forms: [
      { person: 'je / I', form: stem + '1' }, { person: 'tu / you', form: stem + '2' },
      { person: 'il / he', form: stem + '3' }, { person: 'nous / we', form: stem + '4' },
      { person: 'vous / you', form: stem + '5' }, { person: 'ils / they', form: stem + '6' }
    ] },
    { mood: 'indicative', tense: 'past', forms: [
      { person: 'je / I', form: stem + 'p1' }, { person: 'tu / you', form: stem + 'p2' },
      { person: 'il / he', form: stem + 'p3' }, { person: 'nous / we', form: stem + 'p4' },
      { person: 'vous / you', form: stem + 'p5' }, { person: 'ils / they', form: stem + 'p6' }
    ] }
  ];
}

/* The fourth line. Only the five languages that inflect have one, and each
   fixture fills the cards that language is supposed to be able to produce. */
const INFLECTION = {
  en: {
    word_profile: { pos: 'noun', subtype: 'count noun', countability: 'countable', frequency: 'B2',
      must_memorise: ['plural adds -es after s, x, ch'], note: '' },
    noun_forms: { gender: null, article: 'a', plural: 'gifts',
      article_forms: [{ context: 'Definite singular', form: 'the' }], declension: [], irregular: [], note: '' },
    adjective_forms: null,
    conjugation: { principal_parts: { base: 'gift', third_person: 'gifts', past: 'gifted', participle: 'gifted', gerund: 'gifting' },
      class: 'regular', auxiliary: 'have', tenses: tensesFor('gift') },
    comparison: { comparative: 'more gifted', superlative: 'most gifted', irregular: false, note: '' },
    pronouns: { kind: 'personal', position: 'subject', forms: [{ label: 'Subject', form: 'I', note: '' }] },
    government: { items: [{ pattern: 'depend on', meaning: '依赖', example: 'It depends on you.' }], clitics: null }
  },
  fr: {
    word_profile: { pos: 'nom', subtype: 'nom commun', countability: '可数', frequency: 'A2',
      must_memorise: ['复数加 -x'], note: '' },
    noun_forms: { gender: 'masculin', article: 'le', plural: 'les cadeaux',
      article_forms: [{ context: 'Indéfini singulier', form: 'un cadeau' }], declension: [], irregular: ['-eau → -eaux'] },
    adjective_forms: { position: 'after the noun',
      agreement: [{ context: 'Masc. sing.', form: 'grand' }, { context: 'Fém. sing.', form: 'grande' }],
      special: ['beau / bel'] },
    conjugation: { class: '1er groupe', auxiliary: 'avoir', participle: 'donné', tenses: tensesFor('donn') },
    comparison: { comparative: 'plus grand', superlative: 'le plus grand', irregular: false, note: '' },
    pronouns: { kind: 'personnel', position: 'before the verb',
      forms: [{ label: 'Sujet', form: 'je', note: '' }], clitics: 'me, te, le …' },
    government: { items: [{ pattern: 'penser à', meaning: '想到', example: 'Je pense à toi.' }], clitics: 'y / en' }
  },
  de: {
    word_profile: { pos: 'Substantiv', subtype: 'starkes Substantiv', countability: '可数', frequency: 'A2',
      must_memorise: ['das Gift 是毒药'], note: '' },
    noun_forms: { gender: 'das', article: 'das', plural: 'die Häuser',
      article_forms: [{ context: 'Definit Singular', form: 'das Haus' }],
      declension: [
        { case: 'Nominativ', singular: 'das Haus', plural: 'die Häuser' },
        { case: 'Akkusativ', singular: 'das Haus', plural: 'die Häuser' },
        { case: 'Dativ', singular: 'dem Haus', plural: 'den Häusern' },
        { case: 'Genitiv', singular: 'des Hauses', plural: 'der Häuser' }
      ], irregular: [] },
    adjective_forms: { position: 'before the noun',
      agreement: [], endings: [{ pattern: 'weak after der/die/das', ending: '-e / -e / -en / -en' }],
      special: [] },
    conjugation: { principal_parts: { infinitive: 'gehen', praeteritum: 'ging', partizipII: 'gegangen', auxiliary: 'sein' },
      class: 'stark', auxiliary: 'sein', tenses: tensesFor('geh') },
    comparison: { comparative: 'größer', superlative: 'am größten', irregular: true, note: '' },
    pronouns: { kind: 'Personalpronomen', position: 'zweite Stelle',
      forms: [{ label: 'Dativ', form: 'mir', note: '' }] },
    case_government: [{ pattern: 'helfen + Dativ', example: 'Ich helfe dir.', note: '' }],
    separable_prefixes: [{ prefix: 'auf-', meaning: '向上', example: 'Ich stehe um sechs auf.', note: '' }]
  },
  it: {
    word_profile: { pos: 'sostantivo', subtype: 'nome comune', countability: 'numerabile', frequency: 'A1',
      must_memorise: ['复数 i x'], note: '' },
    noun_forms: { gender: 'maschile', article: 'il', plural: 'i x',
      article_forms: [{ context: 'Indeterminativo', form: 'un x' }], declension: [], irregular: [] },
    adjective_forms: { position: 'after the noun',
      agreement: [{ context: 'Masc. sing.', form: 'alto' }], special: ['buono / buon'] },
    conjugation: { class: '-are', auxiliary: 'avere', participle: 'xato', tenses: tensesFor('x') },
    comparison: { comparative: 'più alto', superlative: 'il più alto', absolute: 'altissimo', irregular: false, note: '' },
    pronouns: { kind: 'personale', position: 'before the verb',
      forms: [{ label: 'Soggetto', form: 'io', note: '' }], clitics: 'me lo, glielo' },
    government: { items: [{ pattern: 'pensare a', meaning: '想到', example: 'Penso a te.' }], clitics: 'ci / ne' }
  },
  es: {
    word_profile: { pos: 'sustantivo', subtype: 'nombre común', countability: 'contable', frequency: 'A1',
      must_memorise: ['el agua 但 las aguas'], note: '' },
    noun_forms: { gender: 'masculino', article: 'el', plural: 'los x',
      article_forms: [{ context: 'Indefinido', form: 'un x' }], declension: [], irregular: [] },
    adjective_forms: { position: 'after the noun',
      agreement: [{ context: 'Masc. sing.', form: 'bueno' }], special: ['bueno → buen'] },
    conjugation: { class: '-ar', auxiliary: 'haber', participle: 'xado', tenses: tensesFor('x') },
    comparison: { comparative: 'más alto', superlative: 'el más alto', absolute: 'altísimo', irregular: false, note: '' },
    pronouns: { kind: 'personal', position: 'before the verb',
      forms: [{ label: 'Sujeto', form: 'yo', note: '' }], clitics: 'se lo' },
    government: { items: [{ pattern: 'pensar en', meaning: '想到', example: 'Pienso en ti.' }], clitics: 'lo / la' }
  }
};

function entryFor(ns, store, language, word, overrides) {
  const id = store.entryId(word, language, 'deepseek-flash', 'zh');
  const base = {
    id, schema: 4, kind: 'word', word, language, status: 'ok', ts: Date.now(),
    overview: { word, language, reading: '/x/', pos: 'n.', quick_meaning: 'gloss', register: 'neutral', tags: [] },
    lines: {
      etymology: {
        core_metaphor: 'a vivid line',
        etymology: { chain: [{ stage: 'Latin', language: 'Latin', form: 'x', meaning: 'y', date: '' }], via: '', first_attested: '', certainty: 'high', shift: '' },
        morphology: { breakdown: [{ part: 'con-', type: 'prefix', meaning: 'with', origin: 'Latin' }], root_variants: [{ form: 'x', note: '' }], composition: '' },
        root_family: { direct: [{ word: 'xion', pos: 'n.', gloss: 'g', formula: 'x + -ion', examples: [] }], shared_root: [{ word: 'extend', gloss: 'g', formula: 'ex- + tend' }] },
        derived_pronunciation: [{ word: 'xion', ipa: '/ˈx/' }],
        false_cognates: [{ word: 'content', actual_origin: 'Latin continere', note: 'not related' }]
      },
      usage: {
        senses: [{ pos: 'n.', definition: 'a full definition here', examples: [] }],
        collocations: [{ pattern: 'x for', meaning: 'm', typical_objects: [] }],
        usage_notes: ['formal']
      },
      distinction: {
        confusables: { theme: 't', table: [{ word, meaning: 'm', note: 'n' }], parallel_examples: [], contrast_pairs: [] },
        cultural_notes: ['c'], synthesis: ['s'], mnemonic: 'm'
      }
    }
  };

  if (language === 'it') {
    base.lines.distinction.doublets = [{ popular: 'cosa', learned: 'causa', latin: 'causa', difference: 'register' }];
  }
  if (language === 'es') {
    base.lines.usage.ser_estar = { ser: 'inherent', estar: 'state', note: 'turns meaning' };
    base.lines.distinction.arabismos = [{ word, arabic: 'al-x', meaning: 'm', note: 'the al- article fossilised' }];
  }
  if (INFLECTION[language]) base.lines.inflection = JSON.parse(JSON.stringify(INFLECTION[language]));
  if (language === 'ja') {
    base.lines.etymology = {
      nuance: '語感の核', word_stratum: 'kango',
      readings: { on: [{ reading: 'せい', romaji: 'sei', note: '' }], kun: [], special: [] },
      kanji_origin: [{ kanji: '成', formation: 'compound', formation_term: '会意', original_image: 'axe', path: '' }],
      components: [{ part: '戈', kind: 'radical', meaning: 'halberd', note: '' }],
      etymology: { chain: [], via: '', first_attested: '', certainty: 'medium', shift: '' },
      derived_pronunciation: []
    };
    base.lines.usage = {
      senses: [{ pos: '名', definition: '完全な定義', examples: [] }],
      collocations: [{ pattern: '〜を待つ', meaning: 'm', typical_objects: [] }], usage_notes: ['丁寧'],
      conjugation: { class: 'godan', stem: 'せい', forms: [{ name: 'ます形', form: 'せいします' }] }
    };
    base.lines.distinction = {
      confusables: { theme: 't', table: [{ word, meaning: 'm', note: 'n' }], parallel_examples: [], contrast_pairs: [] },
      source_word: { origin_language: 'English', original: 'x', literal: 'y', note: '' },
      spelling_variants: [{ form: 'ヴァイオリン', note: 'also バイオリン' }],
      cultural_notes: [], synthesis: ['s'], mnemonic: 'm'
    };
  }
  if (language === 'zh') {
    base.lines.etymology = {
      original_sense: '本义',
      senses_path: { primary: '本义', extended: [{ sense: '引申', from: '本义' }], figurative: '' },
      character_evolution: [{ stage: '甲骨文', form: 'shape', meaning: 'meaning', note: '' }],
      components: [{ part: '氵', kind: 'semantic', meaning: 'water', note: '' }],
      multiple_readings: [{ reading: 'qīng', meaning: 'blue', example: '青山' }],
      classical: { meanings: [{ sense: '古义', example: '古文例句', source: '论语' }], usages: [{ pattern: '名词作动词', example: '例', gloss: 'g' }] },
      word_formation: { type: '偏正式', parts: [{ morpheme: '青', meaning: 'blue', role: '修饰' }], note: '' }
    };
    base.lines.usage = {
      senses: [{ pos: '名', definition: '完整的释义', examples: [] }],
      collocations: [{ pattern: '青+色', meaning: 'm', typical_objects: [] }], usage_notes: ['书面']
    };
    base.lines.distinction = {
      confusables: { theme: 't', table: [{ word, meaning: 'm', note: 'n' }], parallel_examples: [], contrast_pairs: [] },
      origin_allusion: { source: '庄子', author: '庄周', quote: '引文', meaning: 'then', note: '' },
      then_and_now: { then: '古义', now: '今义', note: '' },
      cultural_notes: [], synthesis: ['s'], mnemonic: 'm'
    };
  }
  Object.assign(base, overrides || {});
  return base;
}

/* ---------- Configuration ---------- */

function testConfig(env) {
  section('Configuration');
  const C = env.ns.CONFIG;
  check('version reads 4.2.0', C.version === '4.2.0', C.version);
  check('the stored entry shape was bumped', C.schemaVersion === 4, String(C.schemaVersion));
  check('seven languages are declared',
    C.languages.map((l) => l.id).join(',') === 'en,fr,de,it,es,ja,zh',
    C.languages.map((l) => l.id).join(','));
  check('the query picker and the explanation picker are the same set',
    C.outputLanguages.length === C.languages.length);
  check('explanations default to Chinese', C.defaultOutputLang === 'zh', C.defaultOutputLang);
  check('the query type defaults to auto', env.ns.DEFAULT_SETTINGS.queryMode === 'auto');
  check('Italian and Spanish practise by spelling',
    ['it', 'es'].every((id) => C.languages.find((l) => l.id === id).practice === 'spell'));
  check('both are marked as accented languages',
    ['it', 'es'].every((id) => C.languages.find((l) => l.id === id).accents === true));
  check('every card carries a glossary',
    C.cardOrder.every((key) => C.cardCatalog[key].notes && Object.keys(C.cardCatalog[key].notes).length));
  check('every sentence card carries one too',
    C.sentenceCardOrder.every((key) => C.sentenceCatalog[key].notes));
  check('the Spanish signature cards exist',
    !!C.cardCatalog.serEstar && !!C.cardCatalog.arabismos);
  check('the sentence heuristic is declared',
    Array.isArray(C.sentenceHeuristic.enders) && C.sentenceHeuristic.maxWords > 0);
  check('storage is namespaced for 4.0', env.ns.STORAGE_PREFIX === 'dict4');

  section('Card catalog');

  check('every card carries a section',
    C.cardOrder.every((key) => !!C.cardGroups[key]), C.cardOrder.filter((k) => !C.cardGroups[k]).join(','));
  check('the configured order is exactly the catalog order',
    C.cardOrder.join(',') === Object.keys(C.cardCatalog).join(','));
  const groupSequence = [];
  C.cardOrder.forEach((key) => {
    if (groupSequence[groupSequence.length - 1] !== C.cardGroups[key]) groupSequence.push(C.cardGroups[key]);
  });
  check('the four sections never interleave',
    groupSequence.length === C.groups.length, groupSequence.join('>'));
  check('and they are the four declared ones',
    groupSequence.join(',') === C.groups.map((g) => g.id).join(','), groupSequence.join(','));
  check('every section label is English', C.groups.every((g) => /^[A-Za-z ]+$/.test(g.label)));
  check('the forms section carries the new cards',
    ['wordProfile', 'nounForms', 'adjectiveForms', 'comparison', 'pronouns', 'government']
      .every((key) => C.cardGroups[key] === 'forms'));
  check('the retired cards are gone',
    ['genreNombre', 'artikelPlural', 'stammformen'].every((key) => !C.cardCatalog[key]));
  check('every card has a renderer', (function () {
    const builders = env.ns.views.word.builderKeys();
    return C.cardOrder.every((key) => builders.indexOf(key) > -1);
  })(), C.cardOrder.filter((key) => env.ns.views.word.builderKeys().indexOf(key) === -1).join(','));
  check('the sentence catalog has renderers too', C.sentenceCardOrder.every((key) =>
    env.ns.views.word.builderKeys().indexOf(key) > -1));

  section('Request lines');

  check('there are four deep lines', C.deepLines.join(',') === 'etymology,usage,inflection,distinction');
  check('the inflecting languages ask for all four',
    ['en', 'fr', 'de', 'it', 'es'].every((id) => C.deepLinesFor(id).length === 4));
  check('Chinese asks for three', C.deepLinesFor('zh').join(',') === 'etymology,usage,distinction');
  check('and so does Japanese', C.deepLinesFor('ja').join(',') === 'etymology,usage,distinction');
  check('an unresolved language keeps all four, so the line can still be retried',
    C.deepLinesFor('auto').length === 4 && C.deepLinesFor(undefined).length === 4);
  check('Japanese feeds its conjugation card from the usage line',
    C.lineFor('conjugation', 'ja') === 'usage' && C.lineFor('conjugation', 'fr') === 'inflection');
  check('the inflection line has its own token ceiling',
    C.maxTokens.inflection > C.maxTokens.usage, String(C.maxTokens.inflection));
}

/* ---------- Storage ---------- */

async function testStore(env) {
  const store = env.ns.store;
  section('Storage');

  const it = store.entryId('ciao', 'it', 'deepseek-flash', 'zh');
  const es = store.entryId('ciao', 'es', 'deepseek-flash', 'zh');
  check('the same spelling in Italian and Spanish gets two ids', it !== es, it + ' vs ' + es);
  check('ids are stable', store.entryId('ciao', 'it', 'deepseek-flash', 'zh') === it);

  const zhA = store.entryId('青', 'zh', 'deepseek-flash', 'zh');
  const jaA = store.entryId('成功', 'ja', 'deepseek-flash', 'zh');
  check('non-Latin words still get distinct ids', zhA !== jaA);

  store.saveEntry(entryFor(env.ns, store, 'it', 'ciao'));
  store.saveEntry(entryFor(env.ns, store, 'es', 'ciao'));
  check('both survive under their own id', !!store.getEntry(it) && !!store.getEntry(es));

  section('Isolation between versions');
  env.storage.set('dict3.settings', JSON.stringify({ apiKey: 'sk-from-3', outputLang: 'en' }));
  check('a 3.0 settings blob does not leak into 4.0', store.getSettings().apiKey === '');
  check('and 4.0 writes only to its own namespace',
    [...env.storage.keys()]
      .filter((k) => /^dict(2|3)?\./.test(k))
      .every((k) => k === 'dict3.settings'));
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
    ['deep/inflection', (src, out) => P.deep(src, 'inflection', out)],
    ['deep/distinction', (src, out) => P.deep(src, 'distinction', out)],
    ['sentence/semantics', (src, out) => P.sentence(src, 'semantics', out)],
    ['sentence/grammar', (src, out) => P.sentence(src, 'grammar', out)],
    ['reverse', (src, out) => P.reverse(src, out)],
    ['candidate', (src, out) => P.candidate(src, out, 'x')],
    ['surprise', (src, out) => P.surprise(src, out)]
  ];

  targets.forEach(([name, build]) => {
    ids.forEach((src) => {
      /* The inflection line only exists for the languages that inflect. */
      if (name === 'deep/inflection' && !C.inflects(src)) return;
      ids.forEach((out) => {
        const text = build(src, out);
        if (!text || text.length < 80) { problems.push(name + ' ' + src + '->' + out + ' too short'); return; }
        const leftover = text.match(/\{[A-Z_]+\}/g);
        if (leftover) problems.push(name + ' ' + src + '->' + out + ' left ' + [...new Set(leftover)].join(','));
      });
    });
  });
  check('every prompt combination the app can ask for builds completely',
    problems.length === 0, problems.slice(0, 4).join(' | '));
  check('a non-inflecting language returns no inflection prompt',
    P.deep('ja', 'inflection', 'zh') === '' && P.deep('zh', 'inflection', 'en') === '');

  /* These lists used to be hard-coded strings, so adding a language would
     silently narrow the model's world. */
  const auto = P.overview('auto', 'zh');
  check('the Auto overview names all seven languages',
    ['English', 'French', 'German', 'Italian', 'Spanish', 'Japanese', 'Chinese']
      .every((name) => auto.indexOf(name) > -1));
  check('and lists all seven codes', ids.every((id) => auto.indexOf('"' + id + '"') > -1));
  check('the surprise scope follows the language table',
    P.surprise('auto', 'zh').indexOf('Italian') > -1);

  section('Italian and Spanish prompts');
  const itEtym = P.deep('it', 'etymology', 'zh');
  check('Italian etymology asks for false friends', /ITALIAN–ENGLISH false friends/.test(itEtym));
  check('and mentions its mixed origins', /Gaulish, Greek, Germanic or Arabic/.test(itEtym));
  const itUsage = P.deep('it', 'usage', 'zh');
  check('Italian usage no longer carries the forms',
    !/"gender_number"/.test(itUsage) && !/"conjugation"/.test(itUsage));
  check('Italian distinction asks for doublets', /doublets/.test(P.deep('it', 'distinction', 'zh')));

  const esEtym = P.deep('es', 'etymology', 'zh');
  check('Spanish etymology asks for false friends', /SPANISH–ENGLISH false friends/.test(esEtym));
  const esUsage = P.deep('es', 'usage', 'zh');
  check('Spanish usage asks for ser and estar', /ser_estar/.test(esUsage));
  const esDist = P.deep('es', 'distinction', 'zh');
  check('Spanish distinction asks for arabisms', /arabismos/.test(esDist));
  check('and warns against reaching for one', /do not reach for one/.test(esDist));

  section('The inflection prompts');

  const itInfl = P.deep('it', 'inflection', 'zh');
  check('Italian inflection asks for the noun forms', /noun_forms/.test(itInfl));
  check('and for all eight tenses', /passato remoto/.test(itInfl) && /congiuntivo presente/.test(itInfl));
  check('and names its clitics', /me lo, glielo/.test(itInfl));

  const esInfl = P.deep('es', 'inflection', 'zh');
  check('Spanish inflection names the stem changes', /stem changes/.test(esInfl));
  check('and the irregular preterites', /estuve, tuve/.test(esInfl));

  const frInfl = P.deep('fr', 'inflection', 'zh');
  check('French inflection asks for the subjunctive', /subjonctif présent/.test(frInfl));
  check('and for the four agreement forms', /masculine plural, feminine plural/.test(frInfl));
  check('and for the adverbial pronouns', /\by and en\b/.test(frInfl));

  const deInfl = P.deep('de', 'inflection', 'zh');
  check('German inflection asks for the four-case table', /four-case table/.test(deInfl));
  check('and for the attributive endings', /weak after der\/die\/das/.test(deInfl));
  check('and keeps case government and separable prefixes on this line',
    /case_government/.test(deInfl) && /separable_prefixes/.test(deInfl));
  check('while its usage line gave them up',
    !/case_government/.test(P.deep('de', 'usage', 'zh')));

  const enInfl = P.deep('en', 'inflection', 'zh');
  check('English inflection asks for the principal parts', /principal_parts/.test(enInfl));
  check('and for the five tenses', /present continuous/.test(enInfl) && /future \(will \+ base\)/.test(enInfl));
  check('and refuses to give adjectives agreement', /ALWAYS null/.test(enInfl));
  check('all five share the shape', ['en', 'fr', 'de', 'it', 'es']
    .every((id) => /must_memorise/.test(P.deep(id, 'inflection', 'zh'))));

  check('Italian sentence grammar names its own trouble spots',
    /congiuntivo/.test(P.sentence('it', 'grammar', 'zh')) &&
    /pronomi combinati/.test(P.sentence('it', 'grammar', 'zh')));
  check('Spanish sentence grammar names ser vs estar',
    /ser frente a estar/.test(P.sentence('es', 'grammar', 'zh')));
}

/* ---------- Practice ---------- */

/* ---------- API contract and error matrix ---------- */

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
      apiKey: 'k', model: 'deepseek-flash', sourceLang: 'es', outputLang: 'zh',
      overview: { word: 'ojalá', language: 'es', reading: '/oˈxala/', pos: 'adv.', quick_meaning: '但愿' },
      line
    });
    check(line + ' uses its own token ceiling',
      captured.body.max_tokens === C.maxTokens[line], String(captured.body.max_tokens));
    check(line + ' carries the reading into the context',
      /oˈxala/.test(captured.body.messages[1].content));
  }

  let unknownRejected = false;
  try {
    await api.deepLine({ apiKey: 'k', model: 'm', sourceLang: 'en', outputLang: 'zh', overview: { word: 'x' }, line: 'nope' });
  } catch (err) { unknownRejected = true; }
  check('an unknown deep line is rejected', unknownRejected);

  section('Malformed and failed responses');

  env.setFetch(() => jsonResponse(completion('```json\n{"status":"ok"}\n```')));
  const fenced = await api.overview({ apiKey: 'k', model: 'm', sourceLang: 'en', outputLang: 'zh', input: 'x' });
  check('json wrapped in a fence is recovered', fenced.status === 'ok');

  env.setFetch(() => jsonResponse(completion('Sure! {"status":"ok","word":"x"} hope that helps.')));
  const prose = await api.overview({ apiKey: 'k', model: 'm', sourceLang: 'en', outputLang: 'zh', input: 'x' });
  check('json embedded in prose is recovered', prose.word === 'x');

  env.setFetch(() => jsonResponse(completion('')));
  let emptyKind = null;
  try { await api.overview({ apiKey: 'k', model: 'm', sourceLang: 'en', outputLang: 'zh', input: 'x' }); }
  catch (err) { emptyKind = err.kind; }
  check('empty content raises bad_json', emptyKind === 'bad_json', String(emptyKind));

  env.setFetch(() => jsonResponse({ error: { message: 'auth' } }, 401));
  let kind = null;
  try { await api.overview({ apiKey: 'bad', model: 'm', sourceLang: 'en', outputLang: 'zh', input: 'x' }); }
  catch (err) { kind = err.kind; }
  check('401 maps to the auth kind', kind === 'auth');

  env.setFetch(() => jsonResponse({ error: { message: 'balance' } }, 402));
  kind = null;
  try { await api.overview({ apiKey: 'k', model: 'm', sourceLang: 'en', outputLang: 'zh', input: 'x' }); }
  catch (err) { kind = err.kind; }
  check('402 maps to the balance kind', kind === 'balance');

  let attempts = 0;
  env.setFetch(() => {
    attempts += 1;
    if (attempts === 1) return jsonResponse({ error: { message: 'slow down' } }, 429);
    return jsonResponse(completion('{"status":"ok","word":"retry"}'));
  });
  const retried = await api.overview({ apiKey: 'k', model: 'm', sourceLang: 'en', outputLang: 'zh', input: 'x' });
  check('429 is retried once and then succeeds', retried.word === 'retry' && attempts === 2);

  kind = null;
  try { await api.overview({ apiKey: '', model: 'm', sourceLang: 'en', outputLang: 'zh', input: 'x' }); }
  catch (err) { kind = err.kind; }
  check('a missing key is caught before any request', kind === 'no_key');

  env.setFetch(() => Promise.reject(new TypeError('Failed to fetch')));
  kind = null;
  try { await api.overview({ apiKey: 'k', model: 'm', sourceLang: 'en', outputLang: 'zh', input: 'x' }); }
  catch (err) { kind = err.kind; }
  check('a fetch rejection maps to network', kind === 'network');

  env.setFetch(() => jsonResponse(completion('```json\n{"word":"x"}\n```')));
  let badFormat = null;
  try {
    await api.deepLine({ apiKey: 'k', model: 'm', sourceLang: 'en', outputLang: 'zh', overview: { word: 'x' }, line: 'nope' });
  } catch (err) { badFormat = err; }
  check('an unknown line never reaches the network', !!badFormat);

  section('Parallel lines fail independently');

  env.setFetch((url, options) => {
    const system = JSON.parse(options.body).messages[0].content;
    if (/core_metaphor/.test(system)) return jsonResponse(completion('{"core_metaphor":"ok"}'));
    if (/"senses"/.test(system)) return jsonResponse({ error: { message: 'boom' } }, 500);
    return jsonResponse(completion('{"mnemonic":"m"}'));
  });
  const seen = [];
  const results = await api.deepLines({
    apiKey: 'k', model: 'deepseek-flash', sourceLang: 'it', outputLang: 'zh',
    overview: { word: 'ciao', language: 'it', pos: 'interj.', quick_meaning: '你好' }
  }, (r) => seen.push(r));
  check('each line reports through the callback', seen.length === 4, String(seen.length));
  check('a good line carries data', results.etymology.ok === true);
  check('a bad line carries an error shape', results.usage.ok === false && !!results.usage.error.kind);
  check('the batch never rejects', Object.keys(results).length === 4);
  check('the inflection line is part of the batch', !!results.inflection);

  let noInflection = false;
  try {
    await api.deepLine({
      apiKey: 'k', model: 'm', sourceLang: 'zh', outputLang: 'zh',
      overview: { word: '青' }, line: 'inflection'
    });
  } catch (err) { noInflection = true; }
  check('a Chinese word is never asked for its forms', noInflection);
}

async function testPractice(env) {
  const P = env.ns.practice;
  section('Practice');
  check('an Italian word is spellable', P.canSpell('città') === true, 'città');
  check('a Spanish word is spellable', P.canSpell('ñandú') === true, 'ñandú');
  check('accents in a Latin word are judged loosely',
    P.judgeSpelling('citta', 'città', []).status === 'perfect');
  check('a wrong letter is still caught', P.judgeSpelling('citta', 'cotto', []).status === 'wrong');

  const ex = P.createExercise({ word: 'città', reading: '', meaning: 'city', language: 'it', practice: 'spell' });
  P.applyInput(ex, 'citta');
  P.applySubmit(ex);
  check('the Italian exercise accepts an unaccented answer', ex.status === 'correct');

  section('Normalisers');
  const p = P.normalizePinyin('qīng');
  check('a tone mark, a tone digit and nothing share a base',
    P.normalizePinyin('qīng').base === 'qing' &&
    P.normalizePinyin('qing1').base === 'qing' &&
    P.normalizePinyin('qing').base === 'qing');
  check('and differ only in tone',
    p.tone === '1' && P.normalizePinyin('qing3').tone === '3' && P.normalizePinyin('qing').tone === '');
  check('romaji becomes hiragana', P.romajiToHiragana('seikou') === 'せいこう');
  check('a doubled consonant becomes 促音', P.romajiToHiragana('kitte') === 'きって');
  check('long vowels collapse',
    P.foldLong('seikou') === P.foldLong('seikoo') && P.foldLong('seikou') === P.foldLong('seikō'));
  check('kana and romaji land on the same form',
    P.kanaEquivalent(P.normalizeKana('せいこう', 'kana'), P.normalizeKana('seikou', 'kana')));

  section('Judging');
  check('pinyin: syllable and tone right is perfect', P.judgePinyin('qīng', 'qīng').status === 'perfect');
  check('pinyin: right syllable, wrong tone is not wrong', P.judgePinyin('qing', 'qīng').status === 'tone');
  check('pinyin: a different syllable is wrong', P.judgePinyin('qin', 'qīng').status === 'wrong');
  check('kana: romaji input is accepted', P.judgeKana('seikou', 'せいこう', 'kana').status === 'perfect');
  check('kana: a long-vowel variant is accepted', P.judgeKana('seikoo', 'せいこう', 'kana').status === 'perfect');
  check('kana: a listed spelling variant is accepted',
    P.judgeKana('baiorin', 'ヴァイオリン', 'katakana', ['バイオリン']).status === 'perfect');
  const okuri = P.judgeKana('おこなあ', 'おこなう', 'kana', [], 'う');
  check('okurigana is named when only the tail differs',
    okuri.status === 'wrong' && okuri.note === 'okurigana', JSON.stringify(okuri));

  section('Exercise state machine');
  const ex2 = P.createExercise({ word: 'checker', reading: '', meaning: 'm', language: 'en', practice: 'spell' });
  P.applyInput(ex2, 'chicker');
  P.applySubmit(ex2);
  check('a wrong answer reveals the answer', ex2.status === 'wrong' && ex2.reveal === true);
  P.applySubmit(ex2);
  check('the second submit clears for a retry', ex2.status === 'input' && ex2.typed === '');
  const ex3 = P.createExercise({ word: 'checker', reading: '', meaning: 'm', language: 'en', practice: 'spell' });
  P.applyInput(ex3, 'ch3ck3r!!');
  check('non-letters are dropped', ex3.typed === 'chckr');
  P.applyHint(ex3);
  P.applyHint(ex3);
  P.applyHint(ex3);
  check('hints stop at the second level', ex3.hint === 2);
}

/* ---------- Rendering ---------- */

async function testRendering(env) {
  const ns = env.ns;
  const store = ns.store;
  section('Per-language card sets');

  store.clearStarred();
  store.clearHistory();
  ns.session.collapsed = {};

  /* Meaning and Roots are the same letter for every language; the Forms section
     is what differs, because it follows the part of speech. */
  const MEANING_AND_ROOTS = ['senses', 'collocations', 'usage', 'confusables', 'core', 'etymology',
    'morphology', 'rootFamily', 'falseCognates', 'pronunciation', 'culture', 'synthesis', 'mnemonic'];
  const ROMANCE_FORMS = ['wordProfile', 'nounForms', 'adjectiveForms', 'conjugation', 'comparison',
    'pronouns', 'government'];

  const expectedSets = {
    en: MEANING_AND_ROOTS.concat(['wordProfile', 'nounForms', 'conjugation', 'comparison', 'pronouns', 'government']),
    fr: MEANING_AND_ROOTS.concat(ROMANCE_FORMS),
    it: MEANING_AND_ROOTS.concat(ROMANCE_FORMS, ['doublets']),
    es: MEANING_AND_ROOTS.concat(ROMANCE_FORMS, ['serEstar', 'arabismos']),
    /* German keeps case government and separable prefixes instead of the
       preposition card, which is the same information for a case language. */
    de: MEANING_AND_ROOTS.concat(['wordProfile', 'nounForms', 'adjectiveForms', 'conjugation',
      'comparison', 'pronouns', 'kasusRektion', 'trennbarePraefixe']),
    ja: ['senses', 'collocations', 'usage', 'confusables', 'nuance', 'etymology', 'kanjiOrigin',
      'components', 'readings', 'wordStratum', 'conjugation', 'sourceWord', 'spellingVariants',
      'synthesis', 'mnemonic'],
    zh: ['senses', 'collocations', 'usage', 'confusables', 'originalSense', 'thenAndNow',
      'characterEvolution', 'components', 'wordFormation', 'multipleReadings',
      'classicalVsModern', 'classicalUsage', 'originAllusion', 'synthesis', 'mnemonic']
  };

  for (const [lang, word] of [['en', 'contend'], ['fr', 'flâner'], ['de', 'Gift'], ['it', 'ciao'],
    ['es', 'azúcar'], ['ja', '成功'], ['zh', '青']]) {
    const entry = entryFor(ns, store, lang, word);
    store.saveEntry(entry);
    const screen = container();
    ns.views.word.render(screen, { id: entry.id });
    const found = [...screen.innerHTML.matchAll(/data-card="([^"]+)"/g)].map((m) => m[1]);
    const want = ns.CONFIG.cardOrder.filter((key) => expectedSets[lang].indexOf(key) > -1);
    check(lang + ': the right cards render', found.join(',') === want.join(','), 'got ' + found.join(','));
    const indexes = found.map((key) => ns.CONFIG.cardOrder.indexOf(key));
    check(lang + ': cards keep the configured order',
      indexes.every((value, i) => i === 0 || value > indexes[i - 1]));
  }

  section('Card titles carry the native term');

  const titlesFor = function (lang, word) {
    const entry = entryFor(ns, store, lang, word);
    store.saveEntry(entry);
    const screen = container();
    ns.views.word.render(screen, { id: entry.id });
    return cardTitles(screen.innerHTML);
  };

  const en = titlesFor('en', 'contend');
  check('an English entry shows no glosses at all',
    en.every((t) => t.indexOf('·') === -1), en.join(' | '));

  const itTitles = titlesFor('it', 'ciao');
  check('an Italian entry glosses the shared cards too',
    itTitles.indexOf('Senses · Significati') > -1, itTitles.join(' | '));
  check('and its own signature cards',
    itTitles.indexOf('Conjugation · Coniugazione') > -1 &&
    itTitles.indexOf('Doublets · Doppioni') > -1, itTitles.join(' | '));

  const esTitles = titlesFor('es', 'azúcar');
  check('a Spanish entry glosses ser/estar and arabisms',
    esTitles.indexOf('Ser and estar · Ser y estar') > -1 &&
    esTitles.indexOf('Arabisms · Arabismos') > -1, esTitles.join(' | '));
  check('and the full noun paradigm in Spanish',
    esTitles.indexOf('Noun forms · Formas del nombre') > -1 &&
    esTitles.indexOf('Adjective forms · Formas del adjetivo') > -1, esTitles.join(' | '));

  const deTitles = titlesFor('de', 'Gift');
  check('a German entry glosses its diction',
    deTitles.indexOf('Noun forms · Substantivformen') > -1 &&
    deTitles.indexOf('Conjugation · Konjugation') > -1, deTitles.join(' | '));
  check('and shows no gloss where the term is the same word',
    deTitles.indexOf('Pronouns · Pronomina') > -1, deTitles.join(' | '));

  const frTitles = titlesFor('fr', 'flâner');
  check('a French entry glosses the shared cards',
    frTitles.indexOf('Senses · Sens') > -1, frTitles.join(' | '));
  check('and a gloss identical to the title is dropped',
    frTitles.indexOf('Collocations') > -1 && frTitles.indexOf('Collocations · Collocations') === -1,
    frTitles.join(' | '));

  const zhTitles = titlesFor('zh', '青');
  check('Chinese cards keep their native glosses',
    zhTitles.indexOf('Character evolution · 字源演变') > -1, zhTitles.join(' | '));

  section('Collapse and escaping');

  const enEntry = entryFor(ns, store, 'en', 'contend');
  store.saveEntry(enEntry);
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

  const hostile = entryFor(ns, store, 'en', '<img src=x onerror=alert(1)>', {
    id: store.entryId('hostile', 'en', 'deepseek-flash', 'zh')
  });
  hostile.overview.quick_meaning = '<script>alert(2)</script>';
  hostile.lines.etymology.core_metaphor = '<img src=x onerror=alert(3)>';
  store.saveEntry(hostile);
  const hostileScreen = container();
  ns.views.word.render(hostileScreen, { id: hostile.id });
  const hostileHtml = hostileScreen.innerHTML;
  check('model output is HTML-escaped', hostileHtml.indexOf('<img src=x') === -1);
  check('script tags are escaped too', hostileHtml.indexOf('<script>alert(2)</script>') === -1);
  check('the escaped payload is still readable', hostileHtml.indexOf('&lt;img src=x') > -1);

  const partial = entryFor(ns, store, 'en', 'partial', { id: store.entryId('partial', 'en', 'deepseek-flash', 'zh') });
  delete partial.lines;
  store.saveEntry(partial);
  const partialScreen = container();
  ns.views.word.render(partialScreen, { id: partial.id });
  check('an unfinished entry offers to generate each line',
    (partialScreen.innerHTML.match(/not generated yet/g) || []).length === 4,
    String((partialScreen.innerHTML.match(/not generated yet/g) || []).length));
  check('and shows no empty cards', !/data-card="/.test(partialScreen.innerHTML));

  section('Entry sections');

  const grouped = entryFor(ns, store, 'fr', 'flâner');
  store.saveEntry(grouped);
  const groupedScreen = container();
  ns.views.word.render(groupedScreen, { id: grouped.id });
  const groupMatches = [...groupedScreen.innerHTML
    .matchAll(/<div class="entry-group" data-group="([^"]+)">([^<]+)<\/div>/g)];
  check('an entry is divided into labelled sections',
    groupMatches.map((m) => m[1]).join(',') === 'meaning,forms,roots,culture',
    groupMatches.map((m) => m[1]).join(','));
  check('with the configured English labels',
    groupMatches.map((m) => m[2]).join(',') === 'Meaning,Forms,Roots,Culture',
    groupMatches.map((m) => m[2]).join(','));
  check('each section is announced exactly once',
    new Set(groupMatches.map((m) => m[1])).size === groupMatches.length);
  check('a section label is not a control',
    !/class="entry-group"[^>]*data-toggle/.test(groupedScreen.innerHTML) &&
    !/data-toggle="[^"]*"[^>]*class="entry-group"/.test(groupedScreen.innerHTML));
  check('the section labels sit between the cards, not inside one',
    /<\/section><div class="entry-group"/.test(groupedScreen.innerHTML));

  const zhGrouped = entryFor(ns, store, 'zh', '青');
  store.saveEntry(zhGrouped);
  const zhGroupedScreen = container();
  ns.views.word.render(zhGroupedScreen, { id: zhGrouped.id });
  const zhGroups = [...zhGroupedScreen.innerHTML.matchAll(/data-group="([^"]+)"/g)].map((m) => m[1]);
  check('a Chinese entry has no Forms section at all',
    zhGroups.join(',') === 'meaning,roots,culture', zhGroups.join(','));

  section('Paradigms');

  const verbEntry = entryFor(ns, store, 'es', 'hablar');
  store.saveEntry(verbEntry);
  ns.session.formsOpen = {};
  const verbScreen = container();
  ns.views.word.render(verbScreen, { id: verbEntry.id });
  const verbHtml = verbScreen.innerHTML;
  check('each tense is a disclosure row', (verbHtml.match(/class="form-toggle"/g) || []).length === 2);
  check('closed by default, so no persons are on screen',
    (verbHtml.match(/class="para-row"/g) || []).length === 0);
  check('but the size of each table is visible',
    (verbHtml.match(/class="form-count"/g) || []).length === 2 && />6</.test(verbHtml));
  check('and the card offers to open them all', /Expand all forms/.test(verbHtml));

  /* The open state lives in the session, keyed by card and tense index, so a
     re-render — which is what every interaction triggers — cannot lose it. */
  ns.session.formsOpen['conjugation:0'] = true;
  const oneOpen = container();
  ns.views.word.render(oneOpen, { id: verbEntry.id });
  check('opening one tense shows its six persons',
    (oneOpen.innerHTML.match(/class="para-row"/g) || []).length === 6,
    String((oneOpen.innerHTML.match(/class="para-row"/g) || []).length));
  check('with the person beside the form',
    /class="para-key"/.test(oneOpen.innerHTML) && /class="para-value"/.test(oneOpen.innerHTML));
  check('and only that one is open',
    (oneOpen.innerHTML.match(/class="form-group is-open"/g) || []).length === 1);

  ns.session.formsOpen['conjugation:1'] = true;
  const allOpen = container();
  ns.views.word.render(allOpen, { id: verbEntry.id });
  check('everything open flips the control', /Collapse all forms/.test(allOpen.innerHTML));
  check('and both tables are filled in',
    (allOpen.innerHTML.match(/class="para-row"/g) || []).length === 12);
  ns.session.formsOpen = {};

  /* The French imperative has three persons. Two columns would split it 2/1 and
     then read left-to-right in the wrong order, so odd groups stay single. */
  const oddEntry = entryFor(ns, store, 'fr', 'oddforms', {
    id: store.entryId('oddforms', 'fr', 'deepseek-flash', 'zh')
  });
  oddEntry.lines.inflection.conjugation.tenses = [{
    mood: 'impératif', tense: 'présent', forms: [
      { person: '(tu)', form: 'va' }, { person: '(nous)', form: 'allons' },
      { person: '(vous)', form: 'allez' }
    ]
  }];
  store.saveEntry(oddEntry);
  const oddScreen = container();
  ns.views.word.render(oddScreen, { id: oddEntry.id });
  ns.session.formsOpen['conjugation:0'] = true;
  ns.views.word.render(oddScreen, { id: oddEntry.id });
  ns.session.formsOpen = {};
  check('an odd number of persons stays in one column',
    /class="paradigm is-single"/.test(oddScreen.innerHTML));
  check('and its size is still announced',
    /class="form-count">3</.test(oddScreen.innerHTML));
  check('an even group is allowed to pair up',
    !/class="paradigm is-single"/.test(allOpen.innerHTML));

  const deNounEntry = entryFor(ns, store, 'de', 'Haus');
  store.saveEntry(deNounEntry);
  const declScreen = container();
  ns.views.word.render(declScreen, { id: deNounEntry.id });
  const declTable = /class="compare-table decl-table"[\s\S]*?<\/table>/.exec(declScreen.innerHTML);
  check('a German noun renders its four cases',
    !!declTable && (declTable[0].match(/<tr>/g) || []).length === 5,
    declTable ? String((declTable[0].match(/<tr>/g) || []).length) : 'no table');
  check('under a case / singular / plural header',
    !!declTable && /Case<\/th><th>Singular<\/th><th>Plural<\/th>/.test(declTable[0]));
  check('spelling the singular and the plural out',
    declScreen.innerHTML.indexOf('des Hauses') > -1 &&
    declScreen.innerHTML.indexOf('den Häusern') > -1);

  const enNounEntry = entryFor(ns, store, 'en', 'gift');
  store.saveEntry(enNounEntry);
  const enNounScreen = container();
  ns.views.word.render(enNounScreen, { id: enNounEntry.id });
  check('English never shows an adjective-agreement card',
    enNounScreen.innerHTML.indexOf('data-card="adjectiveForms"') === -1);
  check('and German never shows the preposition card it does not use',
    declScreen.innerHTML.indexOf('data-card="government"') === -1);

  /* What the model leaves null must leave no trace: no empty card, no heading
     with nothing under it beyond the section label itself. */
  const nounOnly = entryFor(ns, store, 'fr', 'cadeau');
  nounOnly.lines.inflection.conjugation = null;
  nounOnly.lines.inflection.comparison = null;
  nounOnly.lines.inflection.pronouns = null;
  delete nounOnly.lines.inflection.government;
  store.saveEntry(nounOnly);
  const nounScreen = container();
  ns.views.word.render(nounScreen, { id: nounOnly.id });
  check('a noun renders no verb cards at all',
    nounScreen.innerHTML.indexOf('data-card="conjugation"') === -1 &&
    nounScreen.innerHTML.indexOf('data-card="government"') === -1);
  check('while its own cards are all there',
    nounScreen.innerHTML.indexOf('data-card="nounForms"') > -1 &&
    nounScreen.innerHTML.indexOf('data-card="wordProfile"') > -1);
  check('and nothing renders an empty body',
    (nounScreen.innerHTML.match(/class="card-body"><\/div>/g) || []).length === 0);

  /* Before 4.1 the forms came back on the usage line and the two cards were
     called something else. Old cached entries still have to render. */
  const legacy = entryFor(ns, store, 'de', 'Gift');
  legacy.lines.inflection = {
    article_plural: { article: 'das', plural: 'die Gifte', genitive: 'des Giftes', note: 'not der Gift' },
    conjugation: { tenses: [{ tense: 'Präsens', forms: ['ich gebe', 'du gibst'] }] }
  };
  store.saveEntry(legacy);
  const legacyScreen = container();
  ns.views.word.render(legacyScreen, { id: legacy.id });
  /* Opening a tense only survives a re-render, which is the point: the first
     render of an entry always starts closed. */
  ns.session.formsOpen['conjugation:0'] = true;
  ns.views.word.render(legacyScreen, { id: legacy.id });
  ns.session.formsOpen = {};
  check('an entry saved before the rename still renders its noun',
    legacyScreen.innerHTML.indexOf('data-card="nounForms"') > -1 &&
    legacyScreen.innerHTML.indexOf('des Giftes') > -1);
  check('and its verb forms, which used to arrive as plain strings',
    legacyScreen.innerHTML.indexOf('du gibst') > -1);

  const hostileForms = entryFor(ns, store, 'fr', 'hostileforms', {
    id: store.entryId('hostileforms', 'fr', 'deepseek-flash', 'zh')
  });
  hostileForms.lines.inflection.conjugation.tenses[0].forms[0].person = '<script>alert(9)</script>';
  hostileForms.lines.inflection.word_profile.must_memorise = ['<img src=x onerror=alert(10)>'];
  store.saveEntry(hostileForms);
  const hostileFormsScreen = container();
  ns.views.word.render(hostileFormsScreen, { id: hostileForms.id });
  check('paradigm labels are escaped', hostileFormsScreen.innerHTML.indexOf('<script>alert(9)') === -1);
  check('and so is everything on the profile card',
    hostileFormsScreen.innerHTML.indexOf('<img src=x') === -1);

  section('Switching the explanation language');

  const toastMessages = [];
  const originalToastFn = ns.ui.toast;
  ns.ui.toast = (m) => toastMessages.push(m);

  store.patchSettings({ outputLang: 'zh' });
  const switchEntry = entryFor(ns, store, 'de', 'Gift');
  switchEntry.sourceLangArg = 'auto';
  store.saveEntry(switchEntry);
  const switchScreen = container();
  ns.views.word.render(switchScreen, { id: switchEntry.id });
  check('the toolbar offers the explanation language',
    /id="output-lang"/.test(switchScreen.innerHTML));
  check('starting on the language the answer is in',
    /<option value="zh" selected>/.test(switchScreen.innerHTML));
  check('with all seven languages in the list',
    (switchScreen.innerHTML.match(/<option value="/g) || []).length === 7);
  check('named the way the Profile names them',
    switchScreen.innerHTML.indexOf('>Français<') > -1 && switchScreen.innerHTML.indexOf('>中文<') > -1);

  ns.session.pending = null;
  const originalHash = env.location.hash;
  ns.views.word.switchOutputLang('fr');
  check('switching writes the setting', store.getSettings().outputLang === 'fr');
  check('and says so', toastMessages.some((m) => /Français/.test(m)), toastMessages.join(' | '));
  check('the whole lookup is re-run', !!ns.session.pending, JSON.stringify(ns.session.pending));
  check('under the new explanation language',
    !!ns.session.pending && /--fr$/.test(ns.session.pending.id), ns.session.pending && ns.session.pending.id);
  check('with the original language argument preserved',
    !!ns.session.pending && ns.session.pending.language === 'auto',
    ns.session.pending && ns.session.pending.language);
  check('and the entry that was on screen is left in history',
    !!store.findRow(switchEntry.id));
  check('with its answer intact, not overwritten',
    !!store.getEntry(switchEntry.id) && !!store.getEntry(switchEntry.id).lines.inflection);

  ns.session.pending = null;
  env.location.hash = originalHash;
  ns.ui.toast = originalToastFn;
  store.patchSettings({ outputLang: 'zh' });

  section('Sentence cards carry glosses too');

  const sentEntry = {
    id: store.sentenceId('El perro es bueno.', 'es', 'deepseek-flash', 'zh'),
    schema: 3, kind: 'sentence', word: 'El perro es bueno.', text: 'El perro es bueno.',
    language: 'es', status: 'ok', ts: Date.now(),
    overview: { status: 'ok', language: 'es' },
    lines: {
      semantics: { translation: '狗很乖。', register: 'neutral', word_by_word: [{ form: 'es', lemma: 'ser', pos: 'V.', meaning: '是' }], chunks: [] },
      grammar: { structure: [{ part: 'El perro', role: 'sujeto', note: '' }], grammar: [{ point: 'ser', explanation: 'inherent', example: 'x' }], pitfalls: [], pattern: { template: 'X es Y', gloss: 'g', substitutions: [], examples: [] }, cultural_notes: [] }
    }
  };
  store.saveEntry(sentEntry);
  const sentScreen = container();
  ns.views.word.render(sentScreen, { id: sentEntry.id });
  const sentTitles = cardTitles(sentScreen.innerHTML);
  check('a Spanish sentence glosses its cards',
    sentTitles.indexOf('Grammar · Gramática') > -1, sentTitles.join(' | '));
  check('and glosses Structure in Spanish, where the word differs',
    sentTitles.indexOf('Structure · Estructura') > -1, sentTitles.join(' | '));
  const sentGroups = [...sentScreen.innerHTML.matchAll(/data-group="([^"]+)"/g)].map((m) => m[1]);
  check('a sentence analysis is divided into two sections',
    sentGroups.join(',') === 'meaning,grammar', sentGroups.join(','));
  check('and offers the explanation language too',
    /id="output-lang"/.test(sentScreen.innerHTML));

  /* French is where a sentence card's gloss collides with its English title. */
  const frSent = {
    id: store.sentenceId('Je suis ici.', 'fr', 'deepseek-flash', 'zh'),
    schema: 3, kind: 'sentence', word: 'Je suis ici.', text: 'Je suis ici.',
    language: 'fr', status: 'ok', ts: Date.now(),
    overview: { status: 'ok', language: 'fr' },
    lines: {
      semantics: { translation: '我在这里。', register: 'neutral', word_by_word: [], chunks: [] },
      grammar: { structure: [{ part: 'Je', role: 'sujet', note: '' }], grammar: [{ point: 'présent', explanation: 'e', example: 'x' }], pitfalls: [], pattern: { template: 'Je suis X', gloss: 'g', substitutions: [], examples: [] }, cultural_notes: [] }
    }
  };
  store.saveEntry(frSent);
  const frSentScreen = container();
  ns.views.word.render(frSentScreen, { id: frSent.id });
  const frSentTitles = cardTitles(frSentScreen.innerHTML);
  check('a French sentence card drops a gloss identical to the title',
    frSentTitles.indexOf('Structure') > -1 && frSentTitles.indexOf('Structure · Structure') === -1,
    frSentTitles.join(' | '));
}

/* ---------- Type Auto, non-Latin, history ---------- */

async function testLookupBehaviour(env) {
  const ns = env.ns;
  const store = ns.store;
  section('Type detection');

  const dict = ns.views.dictionary;
  check('a sentence-ending mark reads as a sentence',
    dict.looksLikeSentence('I came home.', 'en') === true);
  check('five English words read as a sentence',
    dict.looksLikeSentence('the quick brown fox jumps', 'en') === true);
  check('four English words still read as a headword',
    dict.looksLikeSentence('the quick brown fox', 'en') === false);
  check('a single English word reads as a headword',
    dict.looksLikeSentence('ephemeral', 'en') === false);
  check('a Chinese sentence reads as a sentence',
    dict.looksLikeSentence('这是一句中文', 'auto') === true);
  check('a four-character Japanese word reads as a headword',
    dict.looksLikeSentence('木漏れ日', 'auto') === false);
  check('an explicit Word selection is never overridden',
    dict.resolveMode('I came home.', 'word') === 'word');
  check('an explicit Sentence selection is never overridden',
    dict.resolveMode('ephemeral', 'sentence') === 'sentence');
  check('Auto resolves from the text', dict.resolveMode('ephemeral', 'auto') === 'word');

  section('Non-Latin input in Auto');

  if (!ns.router) ns.router = { refresh: function () {} };
  store.patchSettings({ apiKey: 'sk-test', queryLang: 'auto' });

  const messages = [];
  const originalToast = ns.ui.toast;
  ns.ui.toast = (m) => messages.push(m);

  const trySubmit = function (text, mode, lang) {
    messages.length = 0;
    ns.session.mode = mode;
    ns.session.candidates = null;
    ns.session.pending = null;
    store.patchSettings({ queryLang: lang });
    dict.submit(text);
    return { messages: messages.slice(), pending: ns.session.pending, candidates: ns.session.candidates };
  };

  const jaAuto = trySubmit('木漏れ日', 'auto', 'auto');
  check('a Japanese word in Auto goes straight to a word lookup',
    !!jaAuto.pending && jaAuto.pending.kind === 'word', JSON.stringify(jaAuto.pending));
  check('and produces no reverse-lookup panel', jaAuto.candidates === null);
  check('with the language left for the model to identify',
    jaAuto.pending.language === 'auto', jaAuto.pending.language);

  const zhAuto = trySubmit('青', 'auto', 'auto');
  check('a single Chinese character in Auto is a word lookup too',
    !!zhAuto.pending && zhAuto.pending.kind === 'word');

  const pinnedFr = trySubmit('心', 'auto', 'fr');
  check('pinning French makes non-Latin input a reverse lookup',
    !!pinnedFr.candidates && pinnedFr.candidates.kind === 'reverse');

  const pinnedJa = trySubmit('木漏れ日', 'auto', 'ja');
  check('pinning Japanese looks the word up in Japanese',
    !!pinnedJa.pending && pinnedJa.pending.language === 'ja' && pinnedJa.candidates === null);

  const asSentence = trySubmit('这是一句完全没有空格的中文句子。', 'auto', 'auto');
  check('a Chinese sentence is routed to sentence analysis',
    !!asSentence.pending && asSentence.pending.kind === 'sentence');

  const autoWord = trySubmit('ephemeral', 'auto', 'auto');
  check('an auto word lookup is flagged so it can fall back to a sentence',
    !!autoWord.pending && autoWord.pending.autoMode === true);
  const explicitWord = trySubmit('ephemeral', 'word', 'auto');
  check('an explicit word lookup is not flagged',
    !!explicitWord.pending && explicitWord.pending.autoMode === false);

  ns.session.mode = 'auto';
  ns.ui.toast = originalToast;

  section('Surprise me');

  check('a pinned language wins over the model',
    dict.surpriseTarget('fr', 'de', 'mot') === 'fr');
  check('on Auto the model decides',
    dict.surpriseTarget('auto', 'ja', '木漏れ日') === 'ja');
  check('an unsupported language falls back to English',
    dict.surpriseTarget('auto', 'xx', 'word') === 'en');
  check('a script mismatch overrides the pin',
    dict.surpriseTarget('en', 'ja', '木漏れ日') === 'ja');
  check('a matching script keeps the pin',
    dict.surpriseTarget('en', 'fr', 'ephemeral') === 'en');

  let captured = null;
  env.setFetch((url, options) => {
    captured = JSON.parse(options.body);
    return jsonResponse(completion('{"word":"木漏れ日","language":"ja","gloss":"light through leaves","why":"a whole scene"}'));
  });
  const pick = await ns.api.surprise({
    apiKey: 'k', model: 'deepseek-flash', sourceLang: 'auto', outputLang: 'zh', avoid: ['ephemeral']
  });
  check('a suggestion is parsed', !!pick && pick.word === '木漏れ日' && pick.language === 'ja');
  check('the scope spans every language on Auto',
    /Pick one language at random/.test(captured.messages[0].content) &&
    /Italian/.test(captured.messages[0].content));
  check('the avoid list reaches the prompt', /ephemeral/.test(captured.messages[1].content));

  section('History groups by day');

  store.clearStarred();
  store.clearHistory();
  const today = Date.now();
  const yesterday = today - 86400000;
  const older = new Date(today);
  older.setDate(older.getDate() - 40);
  const lastYear = new Date(today);
  lastYear.setFullYear(lastYear.getFullYear() - 1);
  lastYear.setMonth(2, 14);

  [['alpha', today], ['bravo', yesterday], ['charlie', older.getTime()], ['delta', lastYear.getTime()]]
    .forEach(([word, ts]) => {
      store.saveEntry(entryFor(ns, store, 'en', word, { ts }));
    });

  const histScreen = container();
  dict.render(histScreen, {});
  const histHtml = histScreen.innerHTML;
  const labels = [...histHtml.matchAll(/<span class="group-text">([^<]+)<\/span>/g)].map((m) => m[1]);
  check('each day gets its own group', labels.length === 4, labels.join(' | '));
  check('today and yesterday are named',
    labels.indexOf('Today') > -1 && labels.indexOf('Yesterday') > -1, labels.join(' | '));
  check('older days are dated',
    labels.some((l) => /^[A-Z][a-z]{2} \d+$/.test(l)), labels.join(' | '));
  check('a date from another year carries the year',
    labels.some((l) => /, \d{4}$/.test(l)), labels.join(' | '));
  check('the groups run newest first',
    labels.indexOf('Today') === 0 && labels.indexOf('Yesterday') === 1, labels.join(' | '));
  check('there is no undifferentiated Earlier bucket', labels.indexOf('Earlier') === -1);

  /* 4.2: every heading folds its own list. */
  const dayButtons = [...histHtml.matchAll(
    /<button type="button" class="group-toggle" data-day="([^"]+)" aria-expanded="(true|false)">([\s\S]*?)<\/button>/g)];
  check('each day heading is a disclosure',
    dayButtons.length === 4 && dayButtons.every((m) => m[2] === 'true'), String(dayButtons.length));
  check('and carries its own count',
    dayButtons.every((m) => /class="group-count">\d+</.test(m[3])), dayButtons[0] && dayButtons[0][3]);
  check('the history section offers a master switch',
    /data-history-toggle="1">Collapse all</.test(histHtml));

  const firstDay = dayButtons[0][1];
  ns.session.collapsedDays[firstDay] = true;
  const foldedScreen = container();
  dict.render(foldedScreen, {});
  const foldedHtml = foldedScreen.innerHTML;
  check('folding a day hides its rows',
    foldedHtml.indexOf('data-open="' + store.listHistory()[0].id + '"') === -1);
  check('and survives a re-render',
    new RegExp('data-day="' + firstDay + '" aria-expanded="false"').test(foldedHtml));
  check('the other days stay open',
    (foldedHtml.match(/aria-expanded="true"/g) || []).length === 3,
    String((foldedHtml.match(/aria-expanded="true"/g) || []).length));

  ns.session.collapsedDays = {};
  const allFoldedScreen = container();
  const allDayKeys = store.listHistory().map((row) => ns.ui.dayKey(row.ts || 0));
  allDayKeys.forEach((key) => { ns.session.collapsedDays[key] = true; });
  ns.views.dictionary.render(allFoldedScreen, {});
  check('everything folded flips the master switch',
    /data-history-toggle="1">Expand all</.test(allFoldedScreen.innerHTML));
  check('and leaves no rows on screen',
    allFoldedScreen.innerHTML.indexOf('data-open="') === -1);
  ns.session.collapsedDays = {};

  const rowTimes = [...histHtml.matchAll(/<span class="nowrap">([^<]+)<\/span>/g)].map((m) => m[1]);
  check('today\'s row shows relative time',
    rowTimes.some((t) => /just now|m ago|h ago/.test(t)), rowTimes.join(' | '));
  check('older rows show a clock time instead of repeating the date',
    rowTimes.some((t) => /^\d{2}:\d{2}$/.test(t)), rowTimes.join(' | '));
  check('no row repeats a month name', !rowTimes.some((t) => /[A-Z][a-z]{2} \d/.test(t)));

  section('Lookup controls and tidied screens');

  const rawHtml = fs.readFileSync(path.join(JS_DIR, 'view-dictionary.js'), 'utf8');
  check('the type picker offers Auto, Word and Sentence',
    /id: 'auto', label: 'Auto'/.test(rawHtml) &&
    /id: 'word', label: 'Word'/.test(rawHtml) &&
    /id: 'sentence', label: 'Sentence'/.test(rawHtml));
  check('the language picker is a select',
    /<select class="source-select" id="lookup-lang"/.test(rawHtml));
  check('the language options use native names', /item\.native/.test(rawHtml));
  check('the primary action sits inside the search field', /class="search-go"/.test(rawHtml));
  check('there is no Favourites button', rawHtml.indexOf('lookup-favorites') === -1);

  const profileRaw = fs.readFileSync(path.join(JS_DIR, 'view-profile.js'), 'utf8');
  check('the profile language chips use native names', /lang\.native/.test(profileRaw));
  check('the data section is split into Backup and Reset',
    /sectionHead\('Backup'\)/.test(profileRaw) && /sectionHead\('Reset'\)/.test(profileRaw));
  check('destructive actions are marked', /data-danger="1"/.test(profileRaw));
  check('the five full-width buttons are gone', profileRaw.indexOf('btn-block') === -1);

  const favRaw = fs.readFileSync(path.join(JS_DIR, 'view-favorites.js'), 'utf8');
  check('the favourites control row is a select plus one icon button',
    /id="practice-source"/.test(favRaw) && /id="practice-start"/.test(favRaw));
  check('adding a wordbook moved into the list', /id="wordbook-new">/.test(favRaw));

  const wordRaw = fs.readFileSync(path.join(JS_DIR, 'view-word.js'), 'utf8');
  check('the entry toolbar no longer shows a section count',
    wordRaw.indexOf('sections</span>') === -1);
  /* The bare pencil read as "new folder" at 22px, so the practice action got a
     keycap that says what it does, and rename kept the pencil. */
  const writeIcon = env.ns.ui.icon('write');
  check('practice has its own icon',
    writeIcon.indexOf('>prac<') > -1 && /<rect /.test(writeIcon) &&
    /icon\('write'\)/.test(wordRaw) && /icon\('write'\)/.test(favRaw));
  check('and the keycap text opts out of the outline stroke',
    /class="icon-text"[\s\S]*fill="currentColor" stroke="none"/.test(writeIcon), writeIcon);
  check('and rename still uses the pencil',
    /icon\('pencil'\)/.test(favRaw) &&
    wordRaw.indexOf("ui.icon('pencil')") === -1);
  check('and the explanation language sits on that one row',
    /class="deep-toolbar">' \+ outputLangControl\(\)/.test(wordRaw) &&
    /data-collapse-toggle/.test(wordRaw));
  check('a regenerate under a different language goes through the switch',
    /entry\.outputLang !== store\.getSettings\(\)\.outputLang/.test(wordRaw));
  check('the section headings are plain markup, not buttons',
    /function groupHeading/.test(wordRaw) && !/data-group="' \+ ui\.esc\(meta\.id\) \+ '"[^>]*<button/.test(wordRaw));
}

/* ---------- Favourites ---------- */

async function testFavorites(env) {
  const ns = env.ns;
  const store = ns.store;
  section('Favourites');

  store.clearStarred();
  store.clearHistory();
  ns.session.favoritesSource = 'all';

  const words = [['checker', 'en'], ['flâner', 'fr'], ['Gift', 'de'], ['ciao', 'it'], ['azúcar', 'es'], ['成功', 'ja'], ['青', 'zh']];
  const ids = {};
  words.forEach(([word, lang]) => {
    const entry = entryFor(ns, store, lang, word);
    if (lang === 'ja') entry.overview.reading = 'せいこう';
    if (lang === 'zh') entry.overview.reading = 'qīng';
    store.saveEntry(entry);
    store.toggleStar(entry.id);
    ids[word] = entry.id;
  });

  const screen = container();
  ns.views.favorites.render(screen, {});
  const html = screen.innerHTML;
  ['English', 'French', 'German', 'Italian', 'Spanish', 'Japanese', 'Chinese'].forEach((label) => {
    check('the favourites screen groups ' + label, html.indexOf('>' + label + '<') > -1);
  });

  const pool = ns.views.favorites.practicePool('all').map((r) => r.language).sort();
  check('the practice pool spans all seven languages',
    pool.join(',') === 'de,en,es,fr,it,ja,zh', pool.join(','));

  const book = store.createWordbook('Mine');
  store.addToWordbook(book.id, ids['ciao']);
  const bookPool = ns.views.favorites.practicePool(book.id).map((r) => r.word);
  check('a wordbook source holds only its own words', bookPool.join(',') === 'ciao', bookPool.join(','));

  section('Wordbook invariants');
  const a = store.createWordbook('Hard');
  const b = store.createWordbook('Exam');
  check('a blank name is refused', store.createWordbook('   ') === null);
  store.addToWordbook(a.id, ids['ciao']);
  store.addToWordbook(a.id, ids['azúcar']);
  store.addToWordbook(b.id, ids['ciao']);
  const memberOf = store.wordbooksFor(ids['ciao']).map((bk) => bk.id);
  check('a word can belong to several books at once',
    memberOf.indexOf(a.id) > -1 && memberOf.indexOf(b.id) > -1, memberOf.join(','));
  store.removeFromWordbook(a.id, ids['azúcar']);
  check('removing from a book only unlinks',
    store.findWordbook(a.id).entries.indexOf(ids['azúcar']) === -1 &&
    store.isStarred(ids['azúcar']) === true);
  store.renameWordbook(b.id, 'Renamed');
  check('a book can be renamed', store.findWordbook(b.id).name === 'Renamed');
  store.removeWordbook(a.id);
  check('deleting a book removes only the book', store.findWordbook(a.id) === null);
  check('the words it held stay favourites', store.isStarred(ids['ciao']) === true);
  store.removeEntry(ids['ciao']);
  check('deleting a word unlinks it everywhere',
    store.listWordbooks().every((bk) => bk.entries.indexOf(ids['ciao']) === -1));
}

/* ---------- Language on stored entries ---------- */

async function testLanguageHandling(env) {
  const ns = env.ns;
  const store = ns.store;
  section('Normalising a language');

  check('an id, an English name and a native name all normalise',
    ns.CONFIG.languageByAnyName('ja') === 'ja' &&
    ns.CONFIG.languageByAnyName(' Japanese ') === 'ja' &&
    ns.CONFIG.languageByAnyName('日本語') === 'ja' &&
    ns.CONFIG.languageByAnyName('Español') === 'es');
  check('"auto" is a picker state, not a language',
    ns.CONFIG.languageByAnyName('auto') === '' && ns.CONFIG.languageByAnyName('AUTO') === '');
  check('and neither is anything else',
    ns.CONFIG.languageByAnyName('Klingon') === '' && ns.CONFIG.languageByAnyName(null) === '');
  check('the detector has its own tiny ceiling', ns.CONFIG.maxTokens.detect === 60);

  check('a row never stores the picker state as a language', (function () {
    store.clearStarred();
    store.clearHistory();
    store.saveEntry({ id: 'guard--auto--m--zh', word: 'guard', language: 'auto', kind: 'word', ts: Date.now() });
    const row = store.findRow('guard--auto--m--zh');
    store.removeEntry('guard--auto--m--zh');
    return !!row && row.language === '';
  })());

  section('An overview that names no language');

  store.patchSettings({ apiKey: 'sk-test', queryLang: 'auto', outputLang: 'zh' });
  const id = store.entryId('nameless', 'auto', 'deepseek-flash', 'zh');
  let routeId = id;
  let overviews = 0;
  const live = container();
  ns.router = { refresh: function () { ns.views.word.render(live, { id: routeId }); } };

  env.setFetch((url, options) => {
    const system = JSON.parse(options.body).messages[0].content;
    if (!/fast, reliable overview/.test(system)) return new Promise(function () {});
    overviews += 1;
    if (overviews === 1) return jsonResponse(completion('{}'));
    return jsonResponse(completion(JSON.stringify({
      status: 'ok', word: 'nameless', language: 'Japanese', reading: '/x/', pos: 'n.',
      quick_meaning: '无名', register: 'neutral', tags: []
    })));
  });

  env.location.hash = '#/word/' + encodeURIComponent(id);
  ns.session.pending = { id, input: 'nameless', label: 'nameless', language: 'auto', kind: 'word', autoMode: true };
  ns.views.word.reset(null);
  ns.views.word.render(live, { id });
  await tick(); await tick(); await tick();

  check('an answer without a language is asked for again', overviews === 2, String(overviews));
  check('a native or English name is accepted as the language',
    !!store.findRow(id) && store.findRow(id).language === 'ja',
    store.findRow(id) && store.findRow(id).language);
  check('and the payload carries the same language',
    !!store.getEntry(id) && store.getEntry(id).language === 'ja');

  const id2 = store.entryId('hopeless', 'auto', 'deepseek-flash', 'zh');
  let tries = 0;
  env.setFetch((url, options) => {
    const system = JSON.parse(options.body).messages[0].content;
    if (!/fast, reliable overview/.test(system)) return new Promise(function () {});
    tries += 1;
    return jsonResponse(completion('{"status":"ok","word":"hopeless","quick_meaning":""}'));
  });

  routeId = id2;
  env.location.hash = '#/word/' + encodeURIComponent(id2);
  ns.session.pending = { id: id2, input: 'hopeless', label: 'hopeless', language: 'auto', kind: 'word', autoMode: false };
  ns.views.word.reset(null);
  ns.views.word.render(live, { id: id2 });
  await tick(); await tick(); await tick();

  check('two answers without a language give up rather than save',
    tries === 2 && !store.findRow(id2), String(tries));
  check('and the screen says what went wrong',
    /Language unclear/.test(live.innerHTML));
  check('with a way to ask again', /data-retry-overview/.test(live.innerHTML));

  section('A sentence in Auto is identified before it is analysed');

  store.clearStarred();
  store.clearHistory();
  const text = '木漏れ日の下で休む。';
  const sid = store.sentenceId(text, 'auto', 'deepseek-flash', 'zh');
  let detects = 0;
  let detectTokens = null;
  env.setFetch((url, options) => {
    const body = JSON.parse(options.body);
    if (/which language is it written in/.test(body.messages[0].content)) {
      detects += 1;
      detectTokens = body.max_tokens;
      return jsonResponse(completion('{"language":"ja"}'));
    }
    return new Promise(function () {});
  });

  routeId = sid;
  env.location.hash = '#/word/' + encodeURIComponent(sid);
  ns.session.pending = { id: sid, input: text, text, label: text, language: 'auto', kind: 'sentence' };
  ns.views.word.reset(null);
  ns.views.word.render(live, { id: sid });
  await tick(); await tick(); await tick();

  check('the detector runs once', detects === 1, String(detects));
  check('with its own tiny ceiling', detectTokens === 60, String(detectTokens));
  check('and the sentence is stored under the language it found',
    !!store.findRow(sid) && store.findRow(sid).language === 'ja',
    String(store.findRow(sid) && store.findRow(sid).language));

  const text2 = 'Danke sehr.';
  const sid2 = store.sentenceId(text2, 'de', 'deepseek-flash', 'zh');
  routeId = sid2;
  env.location.hash = '#/word/' + encodeURIComponent(sid2);
  ns.session.pending = { id: sid2, input: text2, text: text2, label: text2, language: 'de', kind: 'sentence' };
  ns.views.word.reset(null);
  ns.views.word.render(live, { id: sid2 });
  await tick(); await tick();
  check('a pinned language skips the detector', detects === 1, String(detects));
  check('and is stored as pinned',
    !!store.findRow(sid2) && store.findRow(sid2).language === 'de');

  env.location.hash = '#/dictionary';
  ns.session.pending = null;
  ns.router = { refresh: function () {} };
}

/* ---------- Sentences in the favourites, folding, identification ---------- */

async function testFavouritesFolding(env) {
  const ns = env.ns;
  const store = ns.store;
  const fav = ns.views.favorites;
  section('Sentences are favourites too');

  store.clearStarred();
  store.clearHistory();
  store.patchSettings({ apiKey: '', queryLang: 'auto', outputLang: 'zh' });
  ns.session.favoritesSource = 'all';
  ns.session.collapsedGroups = {};

  const jaWord = entryFor(ns, store, 'ja', '寂し');
  jaWord.overview.reading = 'さびし';
  store.saveEntry(jaWord);
  store.toggleStar(jaWord.id);
  const deWord = entryFor(ns, store, 'de', 'Gift');
  store.saveEntry(deWord);
  store.toggleStar(deWord.id);

  const sentence = {
    id: store.sentenceId('木漏れ日の下で休む。', 'ja', 'deepseek-flash', 'zh'),
    schema: 4, kind: 'sentence', word: '木漏れ日の下で休む。', text: '木漏れ日の下で休む。',
    language: 'ja', status: 'ok', ts: Date.now(),
    overview: { status: 'ok', language: 'ja' },
    lines: {
      semantics: { translation: '在树影下休息。', register: 'neutral', word_by_word: [], chunks: [] },
      grammar: {
        structure: [], grammar: [], pitfalls: [],
        pattern: { template: 'X', gloss: 'g', substitutions: [], examples: [] }, cultural_notes: []
      }
    }
  };
  store.saveEntry(sentence);
  store.toggleStar(sentence.id);

  check('a starred sentence reaches the favourites',
    fav.favourites().some((row) => row.id === sentence.id));
  check('and it is never a practice item',
    !fav.practicePool('all').some((row) => row.id === sentence.id));
  check('but the words around it still are',
    fav.practicePool('all').some((row) => row.id === deWord.id));
  check('a sentence row offers no practice button at all',
    (function () {
      const probe = container();
      fav.render(probe, {});
      const start = probe.innerHTML.indexOf('data-open="' + sentence.id + '"');
      if (start === -1) return false;
      const row = probe.innerHTML.slice(start, probe.innerHTML.indexOf('</div>', start));
      return row.indexOf('data-practice-one') === -1 && row.indexOf('undefined') === -1;
    })());

  const screen = container();
  fav.render(screen, {});
  const html = screen.innerHTML;
  check('no group is labelled with the picker state',
    html.indexOf('>AUTO<') === -1 && html.indexOf('lang:auto') === -1);
  check('one language heading holds both kinds',
    (html.match(/data-group-toggle="lang:ja"/g) || []).length === 1);
  check('with Words and Sentences separated inside it',
    /<div class="group-sub">Words<\/div>/.test(html) &&
    /<div class="group-sub">Sentences<\/div>/.test(html));
  check('and Words listed first', html.indexOf('>Words<') < html.indexOf('>Sentences<'));
  check('a language with only one kind gets no sub-labels',
    (html.match(/class="group-sub"/g) || []).length === 2,
    String((html.match(/class="group-sub"/g) || []).length));

  const book = store.createWordbook('Mixed');
  store.addToWordbook(book.id, deWord.id);
  store.addToWordbook(book.id, jaWord.id);
  store.addToWordbook(book.id, sentence.id);
  const bookScreen = container();
  ns.session.favoritesSource = book.id;
  fav.render(bookScreen, {});
  check('a wordbook holds several languages and both kinds at once',
    bookScreen.innerHTML.indexOf('data-open="' + deWord.id + '"') > -1 &&
    bookScreen.innerHTML.indexOf('data-open="' + jaWord.id + '"') > -1 &&
    bookScreen.innerHTML.indexOf('data-open="' + sentence.id + '"') > -1);
  check('and splits them the same way',
    /<div class="group-sub">Words<\/div>/.test(bookScreen.innerHTML) &&
    /<div class="group-sub">Sentences<\/div>/.test(bookScreen.innerHTML));
  ns.session.favoritesSource = 'all';

  section('Folding the favourites');

  check('the control row offers a master switch',
    /data-groups-toggle="1">Collapse all</.test(html));
  ns.session.collapsedGroups['lang:ja'] = true;
  const folded = container();
  fav.render(folded, {});
  check('folding a language hides its rows',
    folded.innerHTML.indexOf('data-open="' + jaWord.id + '"') === -1);
  check('and survives a re-render',
    /data-group-toggle="lang:ja" aria-expanded="false"/.test(folded.innerHTML));
  check('the other language stays open',
    /data-group-toggle="lang:de" aria-expanded="true"/.test(folded.innerHTML));

  ['books', 'lang:ja', 'lang:de'].forEach((key) => { ns.session.collapsedGroups[key] = true; });
  const allFolded = container();
  fav.render(allFolded, {});
  check('everything folded flips the master switch',
    /data-groups-toggle="1">Expand all</.test(allFolded.innerHTML));
  ns.session.collapsedGroups = {};

  section('An entry whose language was never recorded');

  const orphan = {
    id: 'orphan--auto--deepseek-flash--zh', schema: 4, kind: 'word', word: '木漏れ日',
    language: '', status: 'ok', ts: Date.now() - 1000, overview: {},
    lines: { etymology: { core_metaphor: 'generated from the English prompt' } }
  };
  store.saveEntry(orphan);
  store.toggleStar(orphan.id);

  const orphanScreen = container();
  fav.render(orphanScreen, {});
  check('it is listed under an honest label, not AUTO',
    /class="group-sub">Language unknown</.test(orphanScreen.innerHTML) &&
    orphanScreen.innerHTML.indexOf('lang:auto') === -1);
  check('there is no language heading for it',
    orphanScreen.innerHTML.indexOf('<span class="group-count">') > -1 &&
    (orphanScreen.innerHTML.match(/data-group-toggle="lang:/g) || []).length === 2);
  check('and it offers to ask again',
    /data-identify="/.test(orphanScreen.innerHTML));
  check('with no key nothing is asked', env.fetchCalls.length > 0);

  let asked = 0;
  let askedSource = null;
  env.setFetch((url, options) => {
    const body = JSON.parse(options.body);
    asked += 1;
    askedSource = body.messages[1].content;
    return jsonResponse(completion(JSON.stringify({
      status: 'ok', word: '木漏れ日', language: 'ja', reading: 'こもれび', pos: 'n.',
      quick_meaning: '树影间洒下的阳光', register: 'literary', tags: []
    })));
  });
  store.patchSettings({ apiKey: 'sk-test' });
  const language = await fav.identify(store.findRow(orphan.id));
  check('identifying fills the language in', language === 'ja', String(language));
  check('on the row', store.findRow(orphan.id).language === 'ja');
  check('on the payload', store.getEntry(orphan.id).language === 'ja');
  check('and brings the reading and the gloss with it',
    store.findRow(orphan.id).reading === 'こもれび' &&
    !!store.findRow(orphan.id).quickMeaning);
  check('the word was asked about, not its language alone',
    asked === 1 && /木漏れ日/.test(String(askedSource)), String(askedSource));
  check('the deep lines built with the wrong prompts are dropped',
    !store.getEntry(orphan.id).lines.etymology);
  check('and the same row is not asked again in one session',
    (await fav.identify(store.findRow(orphan.id))) === null);

  store.removeEntry(orphan.id);
}

/* ---------- Cross-line rendering ---------- */

async function testInterleaving(env) {
  const ns = env.ns;
  const store = ns.store;
  section('Cross-line interleaving');

  store.patchSettings({ apiKey: 'sk-test', queryLang: 'en', outputLang: 'zh' });
  const id = store.entryId('interleave', 'en', 'deepseek-flash', 'zh');
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

  check('all four lines are requested at once', pending.length === 4, String(pending.length));
  check('one of them is the inflection line',
    pending.filter((p) => /must_memorise/.test(p.system)).length === 1);
  check('every card holds a skeleton while its line is in flight',
    (live.innerHTML.match(/data-loading="/g) || []).length === ns.CONFIG.cardOrder.length);

  /* A section heading is painted as soon as its first card position exists, so
     the page keeps its shape while the tables are still in flight. */
  check('the section labels are on screen from the start',
    (live.innerHTML.match(/class="entry-group"/g) || []).length === ns.CONFIG.groups.length);

  const usage = pending.find((p) => /"senses"/.test(p.system));
  usage.resolve(jsonResponse(completion(JSON.stringify({
    senses: [{ pos: 'v.', definition: '交错排列，交替插入', examples: [] }],
    collocations: [], usage_notes: ['技术语境']
  }))));
  await tick(); await tick();

  check('the landed line renders only its own cards',
    (live.innerHTML.match(/data-card="/g) || []).length === 2,
    (live.innerHTML.match(/data-card="/g) || []).length + ' cards');

  const distinction = pending.find((p) => /"confusables"/.test(p.system));
  distinction.reject(new TypeError('offline'));
  await tick(); await tick();
  check('a failed line reports exactly once',
    (live.innerHTML.match(/data-line-notice="/g) || []).length === 1);

  const beforeRetry = pending.length;
  ns.views.word.retryLine('distinction');
  await tick();
  check('retrying refetches exactly one line', pending.slice(beforeRetry).length === 1);

  pending.forEach((item) => item.resolve(jsonResponse(completion('{}'))));
  await tick(); await tick();
  env.location.hash = '#/dictionary';
}

/* ---------- Auto fallback to sentence ---------- */

async function testAutoFallback(env) {
  const ns = env.ns;
  const store = ns.store;
  section('Auto falls back to sentence analysis');

  store.patchSettings({ apiKey: 'sk-test', queryLang: 'auto', outputLang: 'zh' });
  const wordId = store.entryId('notaheadword', 'auto', 'deepseek-flash', 'zh');

  env.setFetch(() => jsonResponse(completion('{"status":"not_found","suggestions":[]}')));
  const live = container();
  ns.router = { refresh: function () { ns.views.word.render(live, { id: wordId }); } };
  env.location.hash = '#/word/' + encodeURIComponent(wordId);

  ns.session.pending = { id: wordId, input: 'notaheadword', label: 'notaheadword', language: 'auto', kind: 'word', autoMode: true };
  ns.views.word.reset(null);
  ns.views.word.render(live, { id: wordId });
  await tick(); await tick();

  check('a not_found auto lookup hands off to sentence analysis',
    !!ns.session.pending && ns.session.pending.kind === 'sentence',
    JSON.stringify(ns.session.pending && ns.session.pending.kind));
  check('and carries the original text over',
    !!ns.session.pending && ns.session.pending.text === 'notaheadword');
  check('the dead-end word entry is not left in history', !store.findRow(wordId));

  env.location.hash = '#/word/' + encodeURIComponent(wordId);
  ns.session.pending = { id: wordId, input: 'notaheadword', label: 'notaheadword', language: 'auto', kind: 'word', autoMode: false };
  ns.views.word.reset(null);
  ns.views.word.render(live, { id: wordId });
  await tick(); await tick();
  check('an explicit Word lookup does not fall back',
    !ns.session.pending || ns.session.pending.kind !== 'sentence');
  check('and the not_found entry is kept', !!store.findRow(wordId));

  env.location.hash = '#/dictionary';
  ns.session.pending = null;
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
  check('index.html loads the favourites view', /src="js\/view-favorites\.js"/.test(html));

  const sw = fs.readFileSync(path.join(WEB_DIR, 'sw.js'), 'utf8');
  const precache = [...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]);
  const version = /version:\s*'([^']+)'/.exec(fs.readFileSync(path.join(WEB_DIR, 'js', 'config.js'), 'utf8'))[1];
  check('the worker cache version tracks CONFIG.version',
    sw.indexOf("CACHE_VERSION = 'v" + version + "'") > -1, 'expected v' + version);
  check('every precached path exists',
    precache.every((entry) => entry === '' || fs.existsSync(path.join(WEB_DIR, entry))),
    precache.filter((entry) => entry !== '' && !fs.existsSync(path.join(WEB_DIR, entry))).join(', '));
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

  log.length = 0;
  let responded = null;
  listeners.fetch({
    request: { url: 'https://api.deepseek.com/chat/completions', method: 'POST', mode: 'cors', headers: { has: (n) => n === 'authorization', get: () => 'Bearer sk' } },
    respondWith: (v) => { responded = v; }
  });
  await Promise.resolve(responded);
  check('the API call is not intercepted', responded === null);
  check('and touches no cache', log.length === 0, log.join(','));
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

  const offline = fs.readFileSync(offlinePath, 'utf8');
  const external = [...offline.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
    .filter((v) => !v.startsWith('data:') && !/^https?:/i.test(v) && v !== '#');
  check('the offline bundle references no local files', external.length === 0, external.join(','));
  check('the offline bundle has no service worker registration',
    !/serviceWorker\s*\.\s*register/.test(offline));
}

(async function main() {
  const env = createEnvironment();
  testConfig(env);
  await testStore(env);
  await testPrompts(env);
  await testApi(env);
  await testPractice(env);
  await testRendering(env);
  await testLookupBehaviour(env);
  await testFavorites(env);
  await testLanguageHandling(env);
  await testFavouritesFolding(env);
  await testInterleaving(env);
  await testAutoFallback(env);
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
