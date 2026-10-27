/* LINGUIST 4.1 — dependency-free smoke test.

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
  let storageFails = false;

  const sandbox = {
    console, setTimeout, clearTimeout, Promise, JSON, Date, Math, Object, Array,
    String, Number, Error, AbortController, URL,
    /* Needed by the docx reader: typed arrays for the zip, TextDecoder for the
       XML, and the platform's raw-deflate stream. */
    Uint8Array, DataView, ArrayBuffer, TextDecoder, TextEncoder,
    ReadableStream, DecompressionStream, CompressionStream,
    Blob: function Blob() {}
  };

  /* A FileReader that answers with whatever a test has set. File mode reads a
     real File in the browser; here the only thing worth checking is what the
     app does with the text once it has it, so the reading itself is a stub. */
  let fileReaderText = '';
  let fileReaderBytes = new ArrayBuffer(0);
  sandbox.FileReader = function FileReader() {
    const reader = this;
    reader.readAsText = () => {
      setTimeout(() => {
        reader.result = fileReaderText;
        if (reader.onload) reader.onload();
      }, 0);
    };
    reader.readAsArrayBuffer = () => {
      setTimeout(() => {
        reader.result = fileReaderBytes;
        if (reader.onload) reader.onload();
      }, 0);
    };
  };

  const localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => {
      if (storageFails) throw new Error('QuotaExceededError');
      storage.set(key, String(value));
    },
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

  /* A browser's location.replace on a hash URL changes the hash without
     pushing a history entry — the entry page relies on that when it re-keys an
     entry after learning its language, so the stub has to behave. */
  const locationStub = { hash: '#/dictionary', protocol: 'file:', hostname: '' };
  locationStub.replace = (target) => { locationStub.hash = target; };

  const windowStub = {
    localStorage,
    document: documentStub,
    location: locationStub,
    setTimeout, clearTimeout,
    navigator: {
      onLine: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      serviceWorker: { register: () => Promise.resolve() }
    },
    matchMedia: () => ({ matches: false }),
    addEventListener: (type, handler) => { winListeners[type] = handler; },
    removeEventListener: () => {},
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
  /* Everything in index.html is loaded in order, except the vendored pdf.js:
     it is third-party browser code that expects a real window (URL, Blob,
     workers, and more), and nothing in this harness needs it to run. It is
     listed in index.html and asserted there; the PDF tests below drive
     extract.readPdf through a stub instead. */
  scriptOrder().filter((file) => !file.startsWith('vendor/')).forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(WEB_DIR, file), 'utf8'), sandbox, { filename: file });
  });

  /* The interface language defaults to Chinese for a real first run; the
     harness pins English so the copy assertions below stay readable, and one
     dedicated check covers the default itself. */
  sandbox.window.LINGUIST.store.patchSettings({ uiLang: 'en' });

  return {
    ns: sandbox.window.LINGUIST,
    storage,
    fetchCalls,
    winListeners,
    location: windowStub.location,
    setFetch(fn) { fetchImpl = fn; },
    /* Simulates a full quota: every write from here on throws. */
    setStorageFail(value) { storageFails = !!value; },
    /* What the next FileReader in the sandbox will hand back. */
    setFileText(value) { fileReaderText = String(value == null ? '' : value); },
    setFileBytes(value) { fileReaderBytes = value || new ArrayBuffer(0); },
    /* pdf.js is not loaded in this harness; a test that wants the PDF path
       installs a stub shaped like the real API. */
    setPdfLib(lib) { windowStub.pdfjsLib = lib || undefined; },
    /* The vm context itself, for the few checks that need to take a global away
       (does the app degrade when DecompressionStream is missing?). */
    sandbox
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
  const S = env.ns.strings;
  const locales = Object.keys(S);
  check('version reads 8.0.0', C.version === '8.0.0', C.version);
  check('the stored entry shape was bumped', C.schemaVersion === 10, String(C.schemaVersion));
  check('the product name is not translated', C.appName === 'Linguist', C.appName);
  check('and the name every interface language shows is the same string',
    locales.every((lang) => S[lang]['app.name'] === 'Linguist'),
    locales.map((lang) => S[lang]['app.name']).join(','));
  check('while the description follows the interface language',
    new Set(locales.map((lang) => S[lang]['app.description'])).size === locales.length,
    locales.map((lang) => S[lang]['app.description']).join(' | ').slice(0, 80));
  check('seven languages are declared',
    C.languages.map((l) => l.id).join(',') === 'en,fr,de,it,es,ja,zh',
    C.languages.map((l) => l.id).join(','));
  check('the pickers offer the five languages in use',
    C.queryLanguages.map((l) => l.id).join(',') === 'en,fr,de,ja,zh',
    C.queryLanguages.map((l) => l.id).join(','));
  check('and the explanation picker offers the same set',
    C.outputLanguages.map((l) => l.id).join(',') === C.queryLanguages.map((l) => l.id).join(','));
  check('retired languages stay in the table so old entries still resolve',
    C.languages.length === 7 && C.languages.filter((l) => l.retired).map((l) => l.id).join(',') === 'it,es');
  check('the per-language explanation defaults ship as the product describes',
    JSON.stringify(C.defaultOutputLangBySource) ===
    JSON.stringify({ en: 'en', fr: 'fr', de: 'de', ja: 'zh', zh: 'zh' }),
    JSON.stringify(C.defaultOutputLangBySource));
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
  /* 6.1: the two Spanish-only cards are gone. Spanish is retired, nothing can
     produce them any more, and they were sitting in every group's list. */
  check('the two Spanish-only cards are gone',
    !C.cardCatalog.serEstar && !C.cardCatalog.arabismos && C.cardOrder.length === 40,
    String(C.cardOrder.length));
  check('the sentence heuristic is declared',
    Array.isArray(C.sentenceHeuristic.enders) && C.sentenceHeuristic.maxWords > 0);
  check('storage is namespaced for 8.0', env.ns.STORAGE_PREFIX === 'dict8');
  check('and 7.x is offered for import, ahead of the older folders',
    env.ns.IMPORT_SOURCES.map((source) => source.prefix).join(',') === 'dict7,dict6,dict5,dict4,dict3',
    env.ns.IMPORT_SOURCES.map((source) => source.prefix).join(','));

  section('Card catalog');

  check('every card carries a section',
    C.cardOrder.every((key) => !!C.cardGroups[key]), C.cardOrder.filter((k) => !C.cardGroups[k]).join(','));
  check('the configured order is exactly the catalog order',
    C.cardOrder.join(',') === Object.keys(C.cardCatalog).join(','));

  /* The reading order is per language family, so contiguity is a property of
     each family's order rather than of the catalogue. */
  const familySequence = {};
  [['en', 'latin'], ['ja', 'ja'], ['zh', 'zh']].forEach(([lang, family]) => {
    const order = C.cardOrderFor(lang);
    check('the ' + family + ' reading order is a permutation of the catalogue',
      order.length === C.cardOrder.length && order.slice().sort().join(',') === C.cardOrder.slice().sort().join(','),
      String(order.length));
    const sequence = [];
    order.forEach((key) => {
      if (sequence[sequence.length - 1] !== C.cardGroups[key]) sequence.push(C.cardGroups[key]);
    });
    familySequence[family] = sequence;
    check('the ' + family + ' order never interleaves its sections',
      new Set(sequence).size === sequence.length, sequence.join('>'));
  });
  check('every language falls into a family with an order',
    ['en', 'fr', 'de', 'it', 'es', 'ja', 'zh', 'auto', undefined].every((lang) => C.cardOrderFor(lang).length === 40));
  check('the DNA block leads the Latin order',
    familySequence.latin[0] === 'dna', familySequence.latin.join('>'));
  check('and leads the CJK orders too',
    familySequence.ja[0] === 'dna' && familySequence.zh[0] === 'dna',
    familySequence.ja.join('>') + ' | ' + familySequence.zh.join('>'));
  check('the sections are the four declared ones',
    C.groups.map((g) => g.id).join(',') === 'dna,meaning,forms,context',
    C.groups.map((g) => g.id).join(','));
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
  /* 6.4: a random word may only come from a language the app still offers.
     Italian and Spanish are in the table for old entries, not for picking. */
  const surpriseScope = P.surprise('auto', 'zh');
  check('the surprise scope follows the selectable languages',
    ['English', 'French', 'German', 'Japanese', 'Chinese'].every((name) => surpriseScope.indexOf(name) > -1) &&
    surpriseScope.indexOf('Italian') === -1 && surpriseScope.indexOf('Spanish') === -1,
    surpriseScope.split('\n').filter((line) => line.indexOf('Pick one') > -1).join(''));

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
  /* Neither field is asked for any more: their cards are gone, and generating
     data nothing renders is just noise in the payload. */
  check('Spanish usage no longer asks for ser and estar', !/ser_estar/.test(esUsage));
  const esDist = P.deep('es', 'distinction', 'zh');
  check('Spanish distinction no longer asks for arabisms', !/arabismos/.test(esDist));
  check('while it still asks for the shared cultural fields',
    /cultural_notes/.test(esDist) && /mnemonic/.test(esDist));

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
    const reading = ns.CONFIG.cardOrderFor(lang);
    const want = reading.filter((key) => expectedSets[lang].indexOf(key) > -1);
    check(lang + ': the right cards render', found.join(',') === want.join(','), 'got ' + found.join(','));
    const indexes = found.map((key) => reading.indexOf(key));
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
  /* The two Spanish-only cards were removed in 6.1; the shared ones stay and
     keep their Spanish terms. */
  check('a Spanish entry keeps its shared glosses and has lost the retired cards',
    esTitles.indexOf('Senses · Acepciones') > -1 &&
    esTitles.every((t) => t.indexOf('Ser and estar') === -1 && t.indexOf('Arabisms') === -1),
    esTitles.join(' | '));
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
    groupMatches.map((m) => m[1]).join(',') === 'dna,meaning,forms,context',
    groupMatches.map((m) => m[1]).join(','));
  check('with the configured English labels',
    groupMatches.map((m) => m[2]).join(',') === 'Word DNA,Meaning,Forms,Context',
    groupMatches.map((m) => m[2]).join(','));
  check('each section is announced exactly once',
    new Set(groupMatches.map((m) => m[1])).size === groupMatches.length);
  check('a section label is not a control',
    !/class="entry-group"[^>]*data-toggle/.test(groupedScreen.innerHTML) &&
    !/data-toggle="[^"]*"[^>]*class="entry-group"/.test(groupedScreen.innerHTML));
  check('the section labels sit between the cards, not inside one',
    /<\/section><div class="entry-group"/.test(groupedScreen.innerHTML));

  /* The Word DNA cards read as one argument, so they share a container. */
  const dnaBlock = /<div class="dna-block">([\s\S]*?)<\/div><div class="entry-group"/.exec(groupedScreen.innerHTML);
  check('the Word DNA section is wrapped in one block', !!dnaBlock);
  if (dnaBlock) {
    const inside = [...dnaBlock[1].matchAll(/data-card="([^"]+)"/g)].map((m) => m[1]);
    check('holding exactly the DNA cards that rendered',
      inside.length > 0 && inside.every((key) => ns.CONFIG.cardGroups[key] === 'dna'), inside.join(','));
    check('and starting with the semantic core',
      inside[0] === 'core', inside.join(','));
  }
  check('only one Word DNA block per entry',
    (groupedScreen.innerHTML.match(/class="dna-block"/g) || []).length === 1,
    String((groupedScreen.innerHTML.match(/class="dna-block"/g) || []).length));
  check('and the DNA cards come before the definitions',
    groupedScreen.innerHTML.indexOf('data-card="core"') <
    groupedScreen.innerHTML.indexOf('data-card="senses"'));

  const zhGrouped = entryFor(ns, store, 'zh', '青');
  store.saveEntry(zhGrouped);
  const zhGroupedScreen = container();
  ns.views.word.render(zhGroupedScreen, { id: zhGrouped.id });
  const zhGroups = [...zhGroupedScreen.innerHTML.matchAll(/data-group="([^"]+)"/g)].map((m) => m[1]);
  check('a Chinese entry has no Forms section at all',
    zhGroups.join(',') === 'dna,meaning,context', zhGroups.join(','));
  check('and leads with 本义与引申 rather than a PIE chain',
    /data-card="originalSense"/.test(zhGroupedScreen.innerHTML) &&
    zhGroupedScreen.innerHTML.indexOf('data-card="originalSense"') <
    zhGroupedScreen.innerHTML.indexOf('data-card="senses"'));

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
    (verbHtml.match(/class="form-count"/g) || []).length === 2 && /form-count">6 forms</.test(verbHtml),
    (verbHtml.match(/class="form-count">[^<]*/g) || []).join(' | '));
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
    /class="form-count">3 forms</.test(oddScreen.innerHTML),
    (oddScreen.innerHTML.match(/class="form-count">[^<]*/g) || []).join(' | '));
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
    /data-picker="output-lang"/.test(switchScreen.innerHTML));
  check('showing the language the answer is actually in',
    /data-picker="output-lang"[\s\S]{0,220}class="picker-value">中文</.test(switchScreen.innerHTML),
    switchScreen.innerHTML.slice(0, 400));
  const outputSheet = ns.ui.sheetMarkup({
    value: 'zh',
    options: ns.CONFIG.outputLanguages.map((lang) => ({ id: lang.id, label: lang.native }))
  });
  check('the sheet lists the five languages in use, not the retired ones',
    (outputSheet.match(/data-sheet-option=/g) || []).length === 5 &&
    outputSheet.indexOf('Italiano') === -1 && outputSheet.indexOf('Español') === -1,
    outputSheet);
  check('and marks the current one',
    /class="sheet-option is-current"[\s\S]{0,160}中文/.test(outputSheet), outputSheet);
  check('named the way the Profile names them',
    outputSheet.indexOf('Français') > -1 && outputSheet.indexOf('中文') > -1);

  ns.session.pending = null;
  const originalHash = env.location.hash;
  ns.views.word.switchOutputLang('fr');
  /* Switching here is a statement about this entry only: the per-language
     default lives in Profile and must not be touched. */
  check('switching leaves the per-language default alone',
    store.getSettings().outputLangBySource.de === 'zh',
    JSON.stringify(store.getSettings().outputLangBySource));
  check('and says so in the language it is switching to',
    toastMessages.some((m) => /French/.test(m)), toastMessages.join(' | '));
  check('the whole lookup is re-run', !!ns.session.pending, JSON.stringify(ns.session.pending));
  check('under the new explanation language',
    !!ns.session.pending && /--fr$/.test(ns.session.pending.id), ns.session.pending && ns.session.pending.id);
  check('and the entry is pinned to it rather than re-derived',
    !!ns.session.pending && ns.session.pending.outputLang === 'fr' &&
    ns.session.pending.outputLangFixed === true, JSON.stringify(ns.session.pending));
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
    /data-picker="output-lang"/.test(sentScreen.innerHTML));

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

  /* 7.0 removes the hard ceiling: the pool decides the mix, and the caller
     decides whether the pick is a full entry or a discovery card. */
  check('a name from another language is preserved for the caller',
    dict.surpriseTarget('fr', 'de', 'mot') === 'de');
  check('on Auto the model decides',
    dict.surpriseTarget('auto', 'ja', '木漏れ日') === 'ja');
  check('an unsupported language is preserved for a discovery card',
    dict.surpriseTarget('auto', 'xx', 'word') === 'xx');
  check('and a retired language is preserved too',
    dict.surpriseTarget('auto', 'es', 'sobremesa') === 'es' &&
    dict.surpriseTarget('auto', 'it', 'ciao') === 'it');
  check('a script mismatch overrides the pin',
    dict.surpriseTarget('en', 'ja', '木漏れ日') === 'ja');
  check('a Latin word in another language keeps that language',
    dict.surpriseTarget('en', 'fr', 'ephemeral') === 'fr' &&
    dict.surpriseTarget('ja', 'en', 'hello') === 'en');
  check('an empty language keeps the pin',
    dict.surpriseTarget('en', '', 'ephemeral') === 'en');

  let captured = null;
  env.setFetch((url, options) => {
    captured = JSON.parse(options.body);
    return jsonResponse(completion('{"word":"木漏れ日","language":"ja","gloss":"light through leaves","why":"a whole scene"}'));
  });
  const pick = await ns.api.surprise({
    apiKey: 'k', model: 'deepseek-flash', sourceLang: 'auto', outputLang: 'zh', avoid: ['ephemeral']
  });
  check('a suggestion is parsed', !!pick && pick.word === '木漏れ日' && pick.language === 'ja');
  check('the scope spans every selectable language on Auto',
    /Pick one language at random/.test(captured.messages[0].content) &&
    /Japanese/.test(captured.messages[0].content) &&
    !/Italian/.test(captured.messages[0].content));
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
    rowTimes.some((t) => /^\d{1,2}:\d{2}(\s?[AP]M)?$/i.test(t)), rowTimes.join(' | '));
  check('no row repeats a month name', !rowTimes.some((t) => /[A-Z][a-z]{2} \d/.test(t)));

  section('Lookup controls and tidied screens');

  const rawHtml = fs.readFileSync(path.join(JS_DIR, 'view-dictionary.js'), 'utf8');
  check('the type picker offers Auto, Word and Sentence',
    /id: 'auto', label: ui\.t\('mode\.auto'\)/.test(rawHtml) &&
    /id: 'word', label: ui\.t\('mode\.word'\)/.test(rawHtml) &&
    /id: 'sentence', label: ui\.t\('mode\.sentence'\)/.test(rawHtml));
  check('the language picker is a picker, not a select',
    /id: 'lookup-lang'/.test(rawHtml) && !/<select/.test(rawHtml));
  check('the language options use native names', /item\.native/.test(rawHtml));
  check('and offer the languages still in use, plus Auto',
    /CONFIG\.queryLanguages\.map/.test(rawHtml) && /ui\.t\('mode\.auto'\)/.test(rawHtml));
  check('the primary action sits inside the search field', /class="search-go"/.test(rawHtml));
  check('there is no Favourites button', rawHtml.indexOf('lookup-favorites') === -1);

  const profileRaw = fs.readFileSync(path.join(JS_DIR, 'view-profile.js'), 'utf8');
  check('the profile language chips use native names', /lang\.native/.test(profileRaw));
  check('the explanation language is a table of five rows, one per source language',
    /CONFIG\.queryLanguages\.forEach/.test(profileRaw) && /out-lang-/.test(profileRaw));
  check('the data section is split into Backup and Reset',
    /sectionHead\(ui\.t\('profile\.section\.backup'\)\)/.test(profileRaw) &&
    /sectionHead\(ui\.t\('profile\.section\.reset'\)\)/.test(profileRaw));
  check('destructive actions are marked', /data-danger="1"/.test(profileRaw));
  check('the five full-width buttons are gone', profileRaw.indexOf('btn-block') === -1);

  const favRaw = fs.readFileSync(path.join(JS_DIR, 'view-favorites.js'), 'utf8');
  check('the favourites control row is a picker plus one icon button',
    /id: 'practice-source'/.test(favRaw) && /id="practice-start"/.test(favRaw) &&
    !/<select/.test(favRaw));
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
  ['English', 'French', 'German', 'Japanese', 'Chinese'].forEach((label) => {
    check('the favourites screen groups ' + label, html.indexOf('>' + label + '<') > -1);
  });
  /* Italian and Spanish are no longer offered, but entries already made in
     them keep working and say what they are. */
  ['Italian', 'Spanish'].forEach((label) => {
    check('and files ' + label + ' under retired',
      html.indexOf('>' + label + ' · retired<') > -1, label);
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
  /* The entry was opened under a provisional id built from the query argument;
     once the language is known it moves to its real key, which is what makes
     an Auto lookup and a pinned one the same entry. */
  const settled = store.entryId('nameless', 'ja', 'deepseek-flash', 'zh');
  check('the entry is re-keyed under the language it turned out to be',
    !!store.findRow(settled) && store.findRow(settled).language === 'ja',
    store.findRow(settled) && store.findRow(settled).language);
  check('and nothing is left behind under the provisional id', !store.findRow(id));
  check('and the payload carries the same language',
    !!store.getEntry(settled) && store.getEntry(settled).language === 'ja');

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
  const settledSentence = store.sentenceId(text, 'ja', 'deepseek-flash', 'zh');
  check('and the sentence moves to a key with the language it found',
    !!store.findRow(settledSentence) && store.findRow(settledSentence).language === 'ja',
    String(store.findRow(settledSentence) && store.findRow(settledSentence).language));
  check('with nothing left under the provisional key', !store.findRow(sid));

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

/* ---------- Entry identity, cancellation, import, quota ---------- */

async function testBatchOne(env) {
  const ns = env.ns;
  const store = ns.store;
  section('Two words that used to share an id');

  const pairs = [
    ['pâte', 'pète', 'fr'],
    ['Essen', 'essen', 'de'],
    ['cote', 'côté', 'fr'],
    ['Rat', 'rat', 'de']
  ];
  pairs.forEach(([a, b, lang]) => {
    check('“' + a + '” and “' + b + '” get different ids',
      store.entryId(a, lang, 'm', 'zh') !== store.entryId(b, lang, 'm', 'zh'),
      store.entryId(a, lang, 'm', 'zh') + ' vs ' + store.entryId(b, lang, 'm', 'zh'));
  });
  check('the id is stable for the same word',
    store.entryId('pâte', 'fr', 'm', 'zh') === store.entryId('pâte', 'fr', 'm', 'zh'));
  check('a composed and a decomposed accent are the same entry',
    store.entryId('café'.normalize('NFC'), 'fr', 'm', 'zh') ===
    store.entryId('cafe\u0301', 'fr', 'm', 'zh'));
  check('sentences that differ only in the tail get different ids',
    store.sentenceId('I think that it is a good idea', 'en', 'm', 'zh') !==
    store.sentenceId('I think that it is a bad idea', 'en', 'm', 'zh'));
  check('and the readable part is still readable',
    /^p_te--/.test(store.entryId('pâte', 'fr', 'm', 'zh')), store.entryId('pâte', 'fr', 'm', 'zh'));

  section('A late answer cannot land on another entry');

  store.clearStarred();
  store.clearHistory();
  ns.CONFIG.api.retryBackoffMs = 1;
  store.patchSettings({ apiKey: 'sk-test', queryLang: 'en', outputLang: 'zh' });

  const idA = store.entryId('alpha', 'en', 'deepseek-flash', 'zh');
  const idB = store.entryId('beta', 'en', 'deepseek-flash', 'zh');
  const pending = [];
  env.setFetch((url, options) => {
    const body = JSON.parse(options.body);
    if (/fast, reliable overview/.test(body.messages[0].content)) {
      const word = /alpha/.test(body.messages[1].content) ? 'alpha' : 'beta';
      return jsonResponse(completion(JSON.stringify({
        status: 'ok', word, language: 'en', reading: '/x/', pos: 'n.',
        quick_meaning: word, register: 'neutral', tags: []
      })));
    }
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    pending.push({ body, options, resolve, reject });
    return promise;
  });

  const screen = container();
  let routeId = idA;
  ns.router = { refresh: function () { ns.views.word.render(screen, { id: routeId }); } };

  env.location.hash = '#/word/' + encodeURIComponent(idA);
  ns.session.pending = { id: idA, input: 'alpha', label: 'alpha', language: 'en', kind: 'word' };
  ns.views.word.reset(null);
  ns.views.word.render(screen, { id: idA });
  await tick(); await tick();

  const aLines = pending.filter((p) => /alpha/.test(p.body.messages[1].content));
  check('A asks for its lines', aLines.length === 4, String(aLines.length));
  const aSignal = aLines[0].options.signal;
  check('with a signal it can be called off', !!aSignal && aSignal.aborted === false);
  const skeletonsForA = (screen.innerHTML.match(/data-loading="/g) || []).length;
  check('A paints skeletons while it waits', skeletonsForA === ns.CONFIG.cardOrder.length,
    String(skeletonsForA));

  /* Leave A for B mid-flight. */
  routeId = idB;
  env.location.hash = '#/word/' + encodeURIComponent(idB);
  ns.session.pending = { id: idB, input: 'beta', label: 'beta', language: 'en', kind: 'word' };
  ns.views.word.reset(null);
  ns.views.word.render(screen, { id: idB });
  await tick(); await tick();
  check('leaving cancels the requests that were still out', aSignal.aborted === true);

  /* A's answer arrives now, after the user has moved on. */
  const aUsage = aLines.find((p) => /"senses"/.test(p.body.messages[0].content));
  aUsage.resolve(jsonResponse(completion(JSON.stringify({
    senses: [{ pos: 'n.', definition: 'alpha 的释义', examples: [] }],
    collocations: [], usage_notes: []
  }))));
  await tick(); await tick();
  check('A keeps the answer it paid for',
    !!(store.getEntry(idA) && store.getEntry(idA).lines &&
      store.getEntry(idA).lines.usage), 'A payload');
  check('B is still waiting for its own lines, not A’s',
    (screen.innerHTML.match(/data-loading="/g) || []).length === ns.CONFIG.cardOrder.length,
    String((screen.innerHTML.match(/data-loading="/g) || []).length));
  check('and A’s answer is not rendered into B',
    screen.innerHTML.indexOf('alpha 的释义') === -1);

  /* A's other line fails after the switch: aborted, so it must not paint an
     error onto B either. */
  aLines.filter((p) => p !== aUsage)[0].reject(new TypeError('offline'));
  await tick(); await tick();
  check('a failure from the abandoned entry shows nothing on B',
    (screen.innerHTML.match(/data-line-notice="/g) || []).length === 0);

  env.location.hash = '#/dictionary';
  ns.router = { refresh: function () {} };
  ns.session.pending = null;

  section('Importing an older version');

  store.clearStarred();
  store.clearHistory();
  store.listWordbooks().forEach((book) => store.removeWordbook(book.id));

  /* dict4 shaped data: slug ids, one entry stored twice (once from Auto, once
     pinned), a wordbook referring to it, and a row missing `kind`. */
  const d4Auto = 'x16r0reo--auto--deepseek-flash--zh';
  const d4Pinned = 'komorebi--ja--deepseek-flash--zh';
  const payload = (word, language, meaning) => ({
    id: '', schema: 4, kind: 'word', word, language, status: 'ok', ts: 1000,
    model: 'deepseek-flash', outputLang: 'zh',
    overview: { status: 'ok', word, language, reading: 'こもれび', quick_meaning: meaning },
    lines: {}
  });
  env.storage.set('dict4.history', JSON.stringify([
    { id: d4Auto, word: '木漏れ日', language: 'ja', kind: 'word', quickMeaning: '树影', ts: 1000, starred: false },
    { id: d4Pinned, word: '木漏れ日', language: 'ja', kind: 'word', quickMeaning: '树影', ts: 2000, starred: true }
  ]));
  const pAuto = payload('木漏れ日', 'ja', '树影');
  pAuto.id = d4Auto;
  pAuto.ts = 1000;
  const pPinned = payload('木漏れ日', 'ja', '树影');
  pPinned.id = d4Pinned;
  pPinned.ts = 2000;
  env.storage.set('dict4.entry.' + d4Auto, JSON.stringify(pAuto));
  env.storage.set('dict4.entry.' + d4Pinned, JSON.stringify(pPinned));
  env.storage.set('dict4.wordbooks', JSON.stringify([
    { id: 'wb1', name: 'Imported', ts: 1, entries: [d4Auto, d4Pinned] }
  ]));
  env.storage.set('dict4.settings', JSON.stringify({ apiKey: 'sk-old', outputLang: 'en', model: 'deepseek-flash' }));

  check('the older version is detected', (store.importableSource() || {}).prefix === 'dict4');
  const imported = store.importFrom('dict4');
  check('both rows arrive', imported.entries === 2, String(imported.entries));
  check('and collapse into one entry, because they are the same word',
    store.listHistory().length === 1, JSON.stringify(store.listHistory().map((row) => row.id)));
  const merged = store.listHistory()[0];
  check('keeping the newer row and its star', merged.language === 'ja' && merged.starred === true);
  check('the wordbook comes across and points at the surviving id',
    (store.findWordbook('wb1') || {}).entries.join(',') === merged.id,
    JSON.stringify((store.findWordbook('wb1') || {}).entries));
  check('the payload comes across too', !!store.getEntry(merged.id));
  check('and the older version is left exactly as it was',
    !!env.storage.get('dict4.history') && !!env.storage.get('dict4.entry.' + d4Auto));
  check('the import source settings came back', (imported.settings || {}).outputLang === 'en');

  const again = store.importFrom('dict4');
  check('importing a second time changes nothing',
    again.entries === 2 && store.listHistory().length === 1, String(store.listHistory().length));

  section('Clearing stars keeps the entries');

  store.clearStarred();
  store.clearHistory();
  const kept = entryFor(ns, store, 'de', 'Gift');
  store.saveEntry(kept);
  store.toggleStar(kept.id);
  const book = store.createWordbook('Keepers');
  store.addToWordbook(book.id, kept.id);

  store.clearStarred();
  check('the entry payload survives', !!store.getEntry(kept.id));
  check('the history row survives', !!store.findRow(kept.id));
  check('the star is gone', store.findRow(kept.id).starred === false);
  check('and the wordbooks are emptied rather than left dangling',
    store.findWordbook(book.id).entries.length === 0);

  section('A backup round trip');

  store.clearStarred();
  store.clearHistory();
  store.listWordbooks().forEach((b) => store.removeWordbook(b.id));
  const word = entryFor(ns, store, 'ja', '成功');
  store.saveEntry(word);
  store.toggleStar(word.id);
  const sentence = {
    id: store.sentenceId('木漏れ日の下で休む。', 'ja', 'deepseek-flash', 'zh'),
    schema: 4, kind: 'sentence', word: '木漏れ日の下で休む。', text: '木漏れ日の下で休む。',
    language: 'ja', status: 'ok', ts: Date.now(), overview: { status: 'ok', language: 'ja' },
    lines: {}
  };
  store.saveEntry(sentence);
  const backupBook = store.createWordbook('Round trip');
  store.addToWordbook(backupBook.id, word.id);
  const dump = store.exportAll();
  check('the backup carries the wordbooks', Array.isArray(dump.wordbooks) && dump.wordbooks.length === 1);

  store.clearStarred();
  store.clearHistory();
  store.removeWordbook(backupBook.id);
  store.importAll(JSON.parse(JSON.stringify(dump)));
  const restoredSentence = store.findRow(sentence.id);
  check('the sentence comes back as a sentence',
    !!restoredSentence && restoredSentence.kind === 'sentence', JSON.stringify(restoredSentence));
  check('with its reading kept',
    store.findRow(word.id).reading === '/x/', JSON.stringify(store.findRow(word.id)));
  check('and the wordbook comes back too',
    (store.findWordbook(backupBook.id) || {}).entries.length === 1);

  section('When the browser will not write');

  store.clearStarred();
  store.clearHistory();
  store.patchSettings({ apiKey: 'sk-test', queryLang: 'en', outputLang: 'zh' });

  const idQ = store.entryId('quota', 'en', 'deepseek-flash', 'zh');
  env.setFetch((url, options) => {
    const body = JSON.parse(options.body);
    if (/fast, reliable overview/.test(body.messages[0].content)) {
      return jsonResponse(completion(JSON.stringify({
        status: 'ok', word: 'quota', language: 'en', reading: '/x/', pos: 'n.',
        quick_meaning: 'quota', register: 'neutral', tags: []
      })));
    }
    return new Promise(() => {});
  });

  const quotaScreen = container();
  ns.router = { refresh: function () { ns.views.word.render(quotaScreen, { id: idQ }); } };
  env.location.hash = '#/word/' + encodeURIComponent(idQ);
  env.setStorageFail(true);
  ns.session.pending = { id: idQ, input: 'quota', label: 'quota', language: 'en', kind: 'word' };
  ns.views.word.reset(null);
  ns.views.word.render(quotaScreen, { id: idQ });
  await tick(); await tick();

  check('a failed write leaves no history row behind', !store.findRow(idQ));
  check('and the screen says the answer could not be kept',
    /Storage is full/.test(quotaScreen.innerHTML));
  env.setStorageFail(false);
  env.location.hash = '#/dictionary';
  ns.router = { refresh: function () {} };
  ns.session.pending = null;
}

/* ---------- One explanation language per source language ---------- */

async function testLanguageDefaults(env) {
  const ns = env.ns;
  const store = ns.store;
  section('The per-language explanation table');

  store.patchSettings({ outputLangBySource: { en: 'en', fr: 'fr', de: 'de', ja: 'zh', zh: 'zh' } });
  check('each source language has its own row',
    store.outputLangFor('en') === 'en' && store.outputLangFor('fr') === 'fr' &&
    store.outputLangFor('ja') === 'zh' && store.outputLangFor('zh') === 'zh');
  check('an unknown source language falls back', store.outputLangFor('auto') === 'zh');

  /* Profile writes one row at a time. */
  store.patchSettings({ outputLangBySource: { en: 'zh', fr: 'fr', de: 'de', ja: 'zh', zh: 'zh' } });
  ns.views.profile.render(container(), {});
  const profileScreen = container();
  ns.views.profile.render(profileScreen, {});
  check('Profile shows one picker per source language',
    (profileScreen.innerHTML.match(/data-picker="out-lang-/g) || []).length === 5,
    String((profileScreen.innerHTML.match(/data-picker="out-lang-/g) || []).length));
  check('with the current value on it',
    /data-picker="out-lang-en"[\s\S]{0,120}class="picker-value">中文<\/span>/.test(profileScreen.innerHTML),
    (profileScreen.innerHTML.match(/data-picker="out-lang-en"[\s\S]{0,120}/) || [''])[0]);

  ns.ui.pickerAction('out-lang-fr', 'en');
  check('picking a row changes only that row',
    store.getSettings().outputLangBySource.fr === 'en' &&
    store.getSettings().outputLangBySource.de === 'de',
    JSON.stringify(store.getSettings().outputLangBySource));

  section('An Auto lookup settles on the right explanation language');

  store.patchSettings({ outputLangBySource: { en: 'zh', fr: 'fr', de: 'de', ja: 'zh', zh: 'zh' } });
  store.clearStarred();
  store.clearHistory();
  ns.CONFIG.api.retryBackoffMs = 1;
  store.patchSettings({ apiKey: 'sk-test', queryLang: 'auto' });

  const provisional = store.entryId('flâner', 'auto', 'deepseek-flash', 'zh');
  let overviews = 0;
  const asked = [];
  env.setFetch((url, options) => {
    const body = JSON.parse(options.body);
    if (/fast, reliable overview/.test(body.messages[0].content)) {
      overviews += 1;
      asked.push(/Simplified Chinese/.test(body.messages[0].content) ? 'zh' : 'fr');
      return jsonResponse(completion(JSON.stringify({
        status: 'ok', word: 'flâner', language: 'French', reading: '/flɑ.ne/',
        pos: 'v.', quick_meaning: '闲逛', register: 'neutral', tags: []
      })));
    }
    return new Promise(() => {});
  });

  const screen = container();
  let routeId = provisional;
  ns.router = { refresh: function () { ns.views.word.render(screen, { id: routeId }); } };
  env.location.hash = '#/word/' + encodeURIComponent(provisional);
  ns.session.pending = { id: provisional, input: 'flâner', label: 'flâner', language: 'auto', kind: 'word' };
  ns.views.word.reset(null);
  ns.views.word.render(screen, { id: provisional });
  await tick(); await tick(); await tick();

  check('the overview is asked twice: once in the fallback, once in the right language',
    overviews === 2 && asked.join(',') === 'zh,fr', overviews + ' → ' + asked.join(','));
  const settled = store.entryId('flâner', 'fr', 'deepseek-flash', 'fr');
  check('and the entry ends up keyed by source language and explanation language',
    !!store.getEntry(settled), settled);
  check('with nothing left under the provisional key', !store.getEntry(provisional));
  check('and the address follows it', env.location.hash === '#/word/' + encodeURIComponent(settled),
    env.location.hash);

  /* A pinned lookup knows its language from the start, so it costs one call. */
  const pinned = store.entryId('wandern', 'de', 'deepseek-flash', 'de');
  let pinnedOverviews = 0;
  env.setFetch((url, options) => {
    const body = JSON.parse(options.body);
    if (/fast, reliable overview/.test(body.messages[0].content)) {
      pinnedOverviews += 1;
      return jsonResponse(completion(JSON.stringify({
        status: 'ok', word: 'wandern', language: 'de', reading: '/ˈvandɐn/',
        pos: 'v.', quick_meaning: '徒步', register: 'neutral', tags: []
      })));
    }
    return new Promise(() => {});
  });
  routeId = pinned;
  env.location.hash = '#/word/' + encodeURIComponent(pinned);
  ns.session.pending = { id: pinned, input: 'wandern', label: 'wandern', language: 'de', kind: 'word' };
  ns.views.word.reset(null);
  ns.views.word.render(screen, { id: pinned });
  await tick(); await tick(); await tick();
  check('a pinned lookup is asked once', pinnedOverviews === 1, String(pinnedOverviews));
  check('and lands on the id it started with', !!store.getEntry(pinned));

  /* The harness pins every row to Chinese again so the rest of the suite keeps
     its own expectations. */
  store.patchSettings({ outputLangBySource: { en: 'zh', fr: 'zh', de: 'zh', ja: 'zh', zh: 'zh' } });
  env.location.hash = '#/dictionary';
  ns.router = { refresh: function () {} };
  ns.session.pending = null;
}

/* ---------- Undo, search, storage, Surprise ---------- */

async function testInterfaceLanguage(env) {
  const ns = env.ns;
  const store = ns.store;
  section('The interface language');

  const S = ns.strings;
  const locales = Object.keys(S);
  const keys = Object.keys(S.en);
  check('five languages ship', locales.join(',') === 'en,zh,fr,de,ja', locales.join(','));
  check('with a substantial table', keys.length > 250, String(keys.length));
  check('every table has exactly the same keys', locales.every((lang) => {
    const other = Object.keys(S[lang]);
    return other.length === keys.length && keys.every((key) => key in S[lang]);
  }), locales.map((l) => l + ':' + Object.keys(S[l]).length).join(' '));
  const placeholderProblems = [];
  locales.forEach((lang) => {
    keys.forEach((key) => {
      const a = (S.en[key].match(/\{\w+\}/g) || []).sort().join(',');
      const b = (String(S[lang][key]).match(/\{\w+\}/g) || []).sort().join(',');
      if (a !== b) placeholderProblems.push(lang + ':' + key);
    });
  });
  check('and the same placeholders in each', placeholderProblems.length === 0,
    placeholderProblems.slice(0, 6).join(', '));

  /* Nothing may be left in English by accident: every key the source asks for
     has to exist, or the interface would show the key itself. */
  const sources = ['config.js', 'strings.js', 'store.js', 'ui.js', 'practice.js', 'api.js', 'extract.js',
    'pool.js', 'roots.js', 'root-review.js',
    'view-dictionary.js', 'view-word.js', 'view-document.js', 'view-favorites.js', 'view-profile.js',
    'view-roots.js', 'view-discovery.js', 'tour.js', 'app.js']
    .map((file) => fs.readFileSync(path.join(JS_DIR, file), 'utf8')).join('\n');
  const wanted = [...new Set([...sources.matchAll(/ui\.t\(\s*'([a-zA-Z0-9_.]+)'/g)].map((m) => m[1]))];
  /* A key that ends in a dot is a prefix the code completes at runtime —
     `'entry.line.' + line`, `'profile.cards.group.' + group`. What has to exist
     is at least one key under it, and the concrete keys are checked apart so a
     typo in the constant part still fails. */
  const prefixes = wanted.filter((key) => key.endsWith('.'));
  const concrete = wanted.filter((key) => !key.endsWith('.'));
  check('every key the code asks for exists', concrete.every((key) => key in S.en),
    concrete.filter((key) => !(key in S.en)).join(', '));
  check('every key prefix the code builds resolves to real keys',
    prefixes.every((prefix) => Object.keys(S.en).some((key) => key.indexOf(prefix) === 0)),
    prefixes.filter((prefix) => !Object.keys(S.en).some((key) => key.indexOf(prefix) === 0)).join(', '));
  check('and the code asks for a good number of them', wanted.length > 100, String(wanted.length));

  /* A missing translation falls back to English rather than to a blank. */
  const german = ns.ui.t('nav.dictionary', null);
  check('the fallback chain works', typeof german === 'string' && german.length > 0);
  store.patchSettings({ uiLang: 'zh' });
  check('switching the language changes the copy',
    ns.ui.t('nav.dictionary') === '词典' && ns.ui.t('nav.starred') === '星标',
    ns.ui.t('nav.dictionary'));
  check('and the language names follow it',
    ns.ui.langName('fr') === '法语' && ns.ui.langName('de') === '德语',
    ns.ui.langName('fr'));
  check('while the native names stay native for the pickers',
    ns.CONFIG.queryLanguages.filter((l) => l.id === 'fr')[0].native === 'Français');

  store.patchSettings({ uiLang: 'fr' });
  check('French reads French', ns.ui.t('nav.profile') === 'Profil');
  check('and dates follow the locale',
    /oct/i.test(ns.ui.dayLabel(new Date(2026, 9, 12).getTime())) ||
    /\d/.test(ns.ui.dayLabel(new Date(2026, 9, 12).getTime())),
    ns.ui.dayLabel(new Date(2026, 9, 12).getTime()));

  store.patchSettings({ uiLang: 'auto' });
  check('auto falls back to English when the browser asks for nothing we have',
    ns.ui.locale() === 'en', ns.ui.locale());
  check('and follows the browser when it asks for one of ours',
    ns.ui.locale('fr') === 'fr' && ns.ui.locale('ja') === 'ja');

  /* The document says which language it is written in. */
  ns.applyLang();
  check('the document language follows the setting',
    env.ns.CONFIG && typeof ns.applyLang === 'function');

  const profileScreen = container();
  ns.views.profile.render(profileScreen, {});
  check('Profile offers the interface language', /data-picker="ui-lang"/.test(profileScreen.innerHTML));
  ns.ui.pickerAction('ui-lang', 'ja');
  check('picking one writes the setting', store.getSettings().uiLang === 'ja');
  store.patchSettings({ uiLang: 'auto' });

  section('The first-run tour');

  const steps = ns.tour.steps;
  /* Nine steps, and the two that used to leave the card stranded — the
     explanation-language default and the key — now name the screen they live
     on, so the runner can go there before it points at anything. */
  check('it has ten steps', steps.length === 10, String(steps.length));
  check('and the list covers what 6.0 and 7.0 added',
    steps.map((step) => step.id).join(',') === 'search,type,lang,explain,cards,roots,surprise,file,tabs,key',
    steps.map((step) => step.id).join(','));
  check('every step names the screen it points at',
    steps.every((step) => typeof step.route === 'string' || typeof step.route === 'function'),
    steps.filter((step) => !step.route).map((step) => step.id).join(','));
  store.patchSettings({ apiKey: '' });
  const keyRouteWithout = steps[9].route();
  store.patchSettings({ apiKey: 'sk-test' });
  const keyRouteWith = steps[9].route();
  store.patchSettings({ apiKey: '' });
  check('the key step goes where the key actually is',
    keyRouteWithout === '#/dictionary' && keyRouteWith === '#/profile' &&
    steps[9].targets.join(',') === '#quick-key,#api-key',
    keyRouteWithout + ' / ' + keyRouteWith);
  check('each with a title and a text in the table',
    steps.every((step) => ('tour.' + step.id + '.title') in S.en && ('tour.' + step.id + '.text') in S.en),
    steps.map((step) => step.id).join(','));
  check('and each pointing at a real control',
    steps.every((step) => Array.isArray(step.targets) && step.targets.length > 0));
  check('the chrome has a table entry per language', locales.every((lang) =>
    ['tour.skip', 'tour.back', 'tour.next', 'tour.done', 'tour.step']
      .every((key) => key in S[lang])));

  store.patchSettings({ tourDone: false });
  check('it has not been seen yet', ns.tour.shouldRun() === true);
  /* The harness has no real DOM, so the overlay itself cannot be built here —
     the headless screenshots cover that. What is checked is the decision and
     the bookkeeping, which is what could go wrong silently. */
  check('and asking for it in a DOM-less scope declines rather than throws',
    ns.tour.maybeStart() === false && ns.tour.isOpen() === false);
  ns.tour.finish();
  check('finishing records it', store.getSettings().tourDone === true);
  check('so it does not come back', ns.tour.shouldRun() === false && ns.tour.maybeStart() === false);

  const profileAgain = container();
  ns.views.profile.render(profileAgain, {});
  check('Profile can replay it', /id="show-tour"/.test(profileAgain.innerHTML));
}

async function testBatchFour(env) {
  const ns = env.ns;
  const store = ns.store;
  section('Deleting is undoable');

  store.clearStarred();
  store.clearHistory();
  store.listWordbooks().forEach((book) => store.removeWordbook(book.id));
  store.patchSettings({ outputLangBySource: { en: 'zh', fr: 'zh', de: 'zh', ja: 'zh', zh: 'zh' }, outputLang: 'zh' });

  const entry = entryFor(ns, store, 'de', 'Gift');
  store.saveEntry(entry);
  store.toggleStar(entry.id);
  const book = store.createWordbook('Undo');
  store.addToWordbook(book.id, entry.id);

  const snapshot = store.snapshotEntry(entry.id);
  store.removeEntry(entry.id);
  check('deleting removes the row, the payload and the membership',
    !store.findRow(entry.id) && !store.getEntry(entry.id) &&
    store.findWordbook(book.id).entries.length === 0);
  check('and the undo can put it all back', store.restoreEntry(snapshot) === true);
  check('with the row', !!store.findRow(entry.id) && store.findRow(entry.id).starred === true);
  check('the payload', !!store.getEntry(entry.id) && store.getEntry(entry.id).word === 'Gift');
  check('and the wordbook membership',
    store.findWordbook(book.id).entries.indexOf(entry.id) > -1);
  check('the snapshot is a copy, so later edits do not leak into it',
    snapshot.entry.word === 'Gift');

  section('Searching the history');

  store.clearStarred();
  store.clearHistory();
  ['éphémère', 'ephemeral', 'Gift'].forEach((word) => {
    store.saveEntry(entryFor(ns, store, 'en', word, {
      id: store.entryId(word, 'en', 'deepseek-flash', 'zh'),
      overview: { word, language: 'en', reading: '/x/', pos: 'n.', quick_meaning: '提示词 ' + word }
    }));
  });
  const dictScreen = container();
  ns.views.dictionary.render(dictScreen, {});
  check('the history has a search field', /id="history-search"/.test(dictScreen.innerHTML));

  ns.session.historyQuery = 'ephem';
  const found = container();
  ns.views.dictionary.render(found, {});
  check('it matches without the accent',
    /2 matches/.test(found.innerHTML), found.innerHTML.slice(0, 200));
  check('and shows only what matched',
    found.innerHTML.indexOf('>Gift<') === -1 && found.innerHTML.indexOf('éphémère') > -1);
  check('the days expand themselves while searching',
    found.innerHTML.indexOf('aria-expanded="false"') === -1);

  ns.session.historyQuery = 'nothing here';
  const none = container();
  ns.views.dictionary.render(none, {});
  check('a search with no hits says so', /Nothing matches/.test(none.innerHTML));
  ns.session.historyQuery = '';

  section('Storage is visible and bounded');

  const report = store.storageReport();
  check('the report counts entries', report.entries === 3, JSON.stringify(report));
  check('and something about the size', report.bytes === -1 || report.bytes > 0, JSON.stringify(report));
  const profileScreen = container();
  ns.views.profile.render(profileScreen, {});
  check('Profile shows it', /Storage/.test(profileScreen.innerHTML) &&
    /3 stored/.test(profileScreen.innerHTML));

  /* The index is parsed once per session, not once per question. */
  const realGet = env.storage.get.bind(env.storage);
  let reads = 0;
  env.storage.get = function (key) { if (key === 'dict5.history') reads += 1; return realGet(key); };
  store.listHistory(); store.findRow('x'); store.isStarred('x'); store.listHistory();
  env.storage.get = realGet;
  check('the index is not re-read on every lookup', reads === 0, String(reads));

  section('Surprise does not repeat itself');

  store.writeAux('surpriseSeen', []);
  let offers = 0;
  env.setFetch((url, options) => {
    offers += 1;
    const body = JSON.parse(options.body);
    check('the avoid list carries everything already offered',
      offers > 1 ? /ephemeral/.test(body.messages[1].content) : true);
    /* The model keeps returning the same word, which is exactly the case the
       client-side check exists for. */
    return jsonResponse(completion('{"word":"ephemeral","language":"en","gloss":"短暂的","why":"x"}'));
  });
  const button = { textContent: 'Surprise', disabled: false, addEventListener() {} };
  ns.session.query = '';
  ns.views.dictionary.submit('ephemeral');
  await tick();
  /* Drive the feature directly: the button is a DOM object the harness cannot
     make, and the logic under test is what happens with the answers. */
  const seen = store.readAux('surpriseSeen', []);
  check('nothing was recorded before it was ever used', seen.length === 0);

  store.writeAux('surpriseSeen', ['ephemeral']);
  check('and a repeat can be spotted', store.readAux('surpriseSeen', []).indexOf('ephemeral') > -1);
  check('the dice is the icon now', /<rect /.test(ns.ui.icon('dice')) &&
    ns.ui.icon('dice').indexOf('circle') > -1);
  store.writeAux('surpriseSeen', []);

  section('The tab bar is made of links');

  const appRaw = fs.readFileSync(path.join(JS_DIR, 'app.js'), 'utf8');
  check('tabs are anchors, not buttons',
    /<a class="tab" data-tab=/.test(appRaw) && !/<button type="button" class="tab"/.test(appRaw));
  check('and carry their own destination', /href="' \+ ui\.esc\(tab\.hash\)/.test(appRaw));

  section('Practice can be left');

  const practiceRaw = fs.readFileSync(path.join(JS_DIR, 'practice.js'), 'utf8');
  check('the layer is modal and closes with the route',
    /aria-modal/.test(practiceRaw) && /hashchange/.test(practiceRaw));
  /* The labelled exit moved: the top-right control is now "skip", and the way
     out is the × at the bottom left, which was always there. */
  check('the bottom-left control is the way out',
    /data-spell="close" aria-label="' \+ ui\.esc\(ui\.t\('practice\.close'\)\)/.test(practiceRaw));
  check('and the top-right control is skip',
    /data-spell="skip"/.test(practiceRaw) && /practice\.skip/.test(practiceRaw));
  check('and it does not fight the input method',
    /compositionstart/.test(practiceRaw) && /compositionend/.test(practiceRaw));
  check('Tab stays inside the layer', /event\.key !== 'Tab'/.test(practiceRaw));
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
    /data-group-toggle="lang:ja:word"/.test(html) &&
    /data-group-toggle="lang:ja:sentence"/.test(html));
  check('and Words listed first', html.indexOf('>Words<') < html.indexOf('>Sentences<'));
  check('each of those folds on its own',
    (html.match(/class="group-toggle is-sub"/g) || []).length === 2,
    String((html.match(/class="group-toggle is-sub"/g) || []).length));
  check('a language with only one kind gets no sub-groups',
    !/data-group-toggle="lang:de:/.test(html));

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
    /data-group-toggle="lang:ja:word"/.test(bookScreen.innerHTML) &&
    /data-group-toggle="lang:ja:sentence"/.test(bookScreen.innerHTML));
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

  fav.groupKeys().forEach((key) => { ns.session.collapsedGroups[key] = true; });
  check('the master switch covers the sub-groups too',
    fav.groupKeys().indexOf('lang:ja:word') > -1, fav.groupKeys().join(','));
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
    (orphanScreen.innerHTML.match(/data-group-toggle="lang:[a-z]{2}"/g) || []).length === 2,
    String((orphanScreen.innerHTML.match(/data-group-toggle="lang:[a-z]{2}"/g) || []).length));
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

  /* Retries are real, so the backoff between them is not something a test
     should have to wait out. */
  ns.CONFIG.api.retryBackoffMs = 1;
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
  /* A dropped connection is retried once now, so the failure has to fail
     twice before the line is reported. */
  await tick(); await tick();
  const distinctionRetry = pending[pending.length - 1];
  distinctionRetry.reject(new TypeError('offline'));
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
  /* A not_found answer names no language, so the row is filed under the
     language the lookup was pinned to — the entry is kept either way. */
  check('and the not_found entry is kept',
    store.listHistory().some((row) => row.word === 'notaheadword'),
    JSON.stringify(store.listHistory().map((r) => r.word)));

  env.location.hash = '#/dictionary';
  ns.session.pending = null;
}

/* ---------- PWA, worker, packaging ---------- */

const EXPECTED_SITE_FILES = [
  'index.html', 'manifest.webmanifest', 'sw.js',
  'assets/app.css', 'assets/tokens.css',
  'js/api.js', 'js/app.js', 'js/config.js', 'js/extract.js', 'js/practice.js', 'js/prompts.js',
  'js/pool.js', 'js/roots.js', 'js/root-review.js',
  'js/pwa.js', 'js/speech.js', 'js/store.js', 'js/ui.js',
  'js/strings.js',
  'js/tour.js',
  'js/view-dictionary.js', 'js/view-document.js', 'js/view-favorites.js', 'js/view-profile.js', 'js/view-word.js',
  'js/view-roots.js', 'js/view-discovery.js',
  'vendor/pdfjs/LICENSE', 'vendor/pdfjs/pdf.min.js', 'vendor/pdfjs/pdf.worker.min.js',
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
  const ORIGIN = 'https://linguist.example';
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

/* ---------- 6.0: the name, the description, the rename ---------- */

function testBrand(env) {
  const ns = env.ns;
  const S = ns.strings;
  const locales = Object.keys(S);
  section('The name');

  check('every interface language shows the same product name',
    locales.every((lang) => S[lang]['app.name'] === 'Linguist'),
    locales.map((lang) => S[lang]['app.name']).join(','));
  check('and ui.appName reads it from CONFIG', ns.ui.appName() === 'Linguist', ns.ui.appName());
  check('the tagline and the description are rewritten per language',
    new Set(locales.map((l) => S[l]['app.description'])).size === locales.length &&
    new Set(locales.map((l) => S[l]['app.tagline'])).size === locales.length);
  check('the interface language starts as Chinese', ns.DEFAULT_SETTINGS.uiLang === 'zh',
    String(ns.DEFAULT_SETTINGS.uiLang));

  /* The rename touched every module, both tools and the shell. */
  const FILES = ['config.js', 'strings.js', 'store.js', 'ui.js', 'speech.js', 'pwa.js', 'prompts.js',
    'api.js', 'practice.js', 'extract.js', 'pool.js', 'roots.js', 'root-review.js', 'tour.js',
    'view-word.js', 'view-dictionary.js', 'view-document.js', 'view-favorites.js', 'view-profile.js',
    'view-roots.js', 'view-discovery.js', 'app.js'];
  const code = FILES.map((file) => fs.readFileSync(path.join(JS_DIR, file), 'utf8')).join('\n');
  check('no module still refers to the old namespace', !/RADICLE/.test(code));
  check('every module installs onto the new one',
    (code.match(/window\.LINGUIST/g) || []).length >= FILES.length - 1,
    String((code.match(/window\.LINGUIST/g) || []).length) + ' of ' + (FILES.length - 1));
  check('the localStorage probe was renamed with it', !/__radicle_probe__/.test(code));

  const tools = ['build.mjs', 'preview.mjs', 'measure.mjs']
    .map((file) => fs.readFileSync(path.join(REPO_DIR, 'tools', file), 'utf8')).join('\n');
  check('the packaging tools were renamed too', !/radicle|Radicle|RADICLE/.test(tools),
    (tools.match(/radicle|Radicle|RADICLE/g) || []).slice(0, 4).join(','));

  const html = fs.readFileSync(path.join(WEB_DIR, 'index.html'), 'utf8');
  check('the shell is titled after the product', /<title>Linguist<\/title>/.test(html));
  const manifest = JSON.parse(fs.readFileSync(path.join(WEB_DIR, 'manifest.webmanifest'), 'utf8'));
  check('and the manifest is named after it',
    manifest.name === 'Linguist' && manifest.short_name === 'Linguist',
    manifest.name + ' / ' + manifest.short_name);
  check('the manifest description is the 6.0 one',
    /roots/.test(manifest.description) && /files/.test(manifest.description), manifest.description);

  /* The old label is gone from the English table; other languages use their own
     word for the same idea, which is not the same thing as a leftover. */
  check('no English string still calls the Starred screen "Favourites"',
    !Object.keys(S.en).some((key) => /favourite/i.test(String(S.en[key]))),
    Object.keys(S.en).filter((key) => /favourite/i.test(String(S.en[key]))).join(','));

  /* What has to stay true for a desktop or mobile shell to keep being cheap. */
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
    .filter((value) => !value.startsWith('data:') && !/^https?:/i.test(value) && value !== '#');
  check('every asset is referenced by a relative path',
    assets.every((value) => !value.startsWith('/')), assets.join(','));
  check('index.html loads the vendored pdf.js before the module that uses it',
    html.indexOf('vendor/pdfjs/pdf.min.js') > -1 &&
    html.indexOf('vendor/pdfjs/pdf.min.js') < html.indexOf('js/extract.js'));
  const fetchers = FILES.filter((file) => /window\.fetch\(/.test(
    fs.readFileSync(path.join(JS_DIR, file), 'utf8')));
  check('exactly one module performs network requests', fetchers.join(',') === 'api.js', fetchers.join(','));
}

/* ---------- 6.0: the tour's arithmetic ---------- */

/* The tour card is positioned by a pure function now. The bug it replaces was
   arithmetic plus a stale inline style, so the arithmetic is what is checked —
   a screenshot cannot tell a clamped card from a lucky one. */

function testTourLayout(env) {
  const ns = env.ns;
  const layoutFor = ns.tour.layoutFor;
  section('Tour placement');

  const view = { width: 400, height: 800 };
  const card = { width: 380, height: 200 };

  const centred = layoutFor(null, view, card);
  check('a step with no target centres its card',
    centred.placement === 'centred' && centred.cardTop === 300, JSON.stringify(centred));
  check('and the spotlight is switched off for it', centred.top === null && centred.width === 0);

  const below = layoutFor({ top: 200, left: 20, width: 360, height: 44 }, view, card);
  check('a comfortable target puts the card below it',
    below.placement === 'below' && below.cardTop === 260, JSON.stringify(below));
  check('and the spotlight covers the target with a small margin',
    below.top === 194 && below.left === 14 && below.width === 372 && below.height === 56,
    JSON.stringify(below));

  const above = layoutFor({ top: 700, left: 0, width: 400, height: 60 }, view, card);
  check('a low target puts the card above it',
    above.placement === 'above' && above.cardTop === 484, JSON.stringify(above));

  /* The case that used to strand the buttons: the target fills the screen, so
     neither above nor below fits. */
  const cramped = layoutFor({ top: 100, left: 0, width: 400, height: 700 }, view, card);
  check('a target with no room beside it centres the card',
    cramped.placement === 'centred' && cramped.cardTop === 300, JSON.stringify(cramped));
  check('and the card never starts off screen',
    layoutFor({ top: 0, left: 0, width: 400, height: 900 }, view, card).cardTop >= 12);
  check('and never ends off screen either',
    layoutFor({ top: 760, left: 0, width: 400, height: 40 }, { width: 400, height: 400 }, card).cardTop <= 188,
    String(layoutFor({ top: 760, left: 0, width: 400, height: 40 }, { width: 400, height: 400 }, card).cardTop));

  const tall = layoutFor({ top: 400, left: 0, width: 400, height: 40 }, { width: 400, height: 300 },
    { width: 380, height: 600 });
  check('a card taller than the screen is pinned to the top', tall.cardTop === 12, JSON.stringify(tall));
  check('and a tiny viewport still leaves a margin',
    layoutFor({ top: 0, left: 0, width: 100, height: 20 }, { width: 200, height: 120 }, card).cardTop === 12);
}

/* ---------- 6.0: card preferences ---------- */

function testCardPreferences(env) {
  const ns = env.ns;
  const C = ns.CONFIG;
  const store = ns.store;
  const profile = ns.views.profile;
  section('Card preferences');

  C.cardPrefGroups.forEach((group) => {
    const resolved = C.resolveCardPrefs(group, {});
    check('the ' + group + ' group defaults to exactly its reading order',
      resolved.order.join(',') === C.baseOrderFor(group).join(','), resolved.order.join(','));
    check('and it hides nothing', Object.keys(resolved.hidden).length === 0);
  });
  check('the sentence group is the sentence catalogue',
    C.baseOrderFor('sentence').join(',') === C.sentenceCardOrder.join(','));
  check('the group is chosen by the language being read',
    C.prefGroupForLanguage('en') === 'latin' && C.prefGroupForLanguage('ja') === 'ja' &&
    C.prefGroupForLanguage('zh') === 'zh' && C.prefGroupForLanguage('es') === 'latin');

  /* A preference written by another version can name cards that are not there;
     that must not shorten the list or lose a card. */
  const stale = { latin: { order: ['retiredCard', 'mnemonic'], hidden: ['alsoRetired', 'culture'] } };
  const resolved = C.resolveCardPrefs('latin', stale);
  check('an unknown key in the order is ignored', resolved.order.indexOf('retiredCard') === -1);
  check('a known key moves to where the preference puts it', resolved.order[0] === 'mnemonic',
    resolved.order.slice(0, 3).join(','));
  check('an unknown key in the hidden list is ignored', !resolved.hidden.alsoRetired);
  check('a known hidden key is honoured', resolved.hidden.culture === true);
  check('and the result is still a permutation of the catalogue',
    resolved.order.length === C.baseOrderFor('latin').length, String(resolved.order.length));

  /* Rendering follows it. */
  store.clearHistory();
  store.patchSettings({ cardPrefs: {} });
  const entry = entryFor(ns, store, 'en', 'contend');
  store.saveEntry(entry);
  const screen = container();
  ns.views.word.render(screen, { id: entry.id });
  const sequence = (html) => [...html.matchAll(/data-card="([^"]+)"/g)].map((m) => m[1]);
  const byDefault = sequence(screen.innerHTML);
  check('an entry renders its cards with no preference set', byDefault.length > 8,
    String(byDefault.length));
  const expectedOrder = C.resolveCardPrefs('latin', {}).order.filter((key) => byDefault.indexOf(key) > -1);
  check('in the order the reading family specifies', byDefault.join(',') === expectedOrder.join(','),
    byDefault.slice(0, 6).join(','));

  store.patchSettings({ cardPrefs: { latin: { order: [], hidden: ['senses', 'collocations'] } } });
  const hidden = container();
  ns.views.word.render(hidden, { id: entry.id });
  check('a hidden card is not rendered at all',
    !/data-card="senses"/.test(hidden.innerHTML) && !/data-card="collocations"/.test(hidden.innerHTML));
  check('and the cards around it are still there', /data-card="usage"/.test(hidden.innerHTML));

  store.patchSettings({ cardPrefs: { latin: { order: ['mnemonic'], hidden: [] } } });
  const moved = container();
  ns.views.word.render(moved, { id: entry.id });
  check('a card moved to the front is rendered first', sequence(moved.innerHTML)[0] === 'mnemonic',
    sequence(moved.innerHTML).slice(0, 3).join(','));

  const allHidden = C.baseOrderFor('latin').reduce((prefs, key) => {
    if (C.cardCatalog[key]) prefs.hidden.push(key);
    return prefs;
  }, { order: [], hidden: [] });
  store.patchSettings({ cardPrefs: { latin: allHidden } });
  const blank = container();
  ns.views.word.render(blank, { id: entry.id });
  check('hiding everything says so instead of showing a blank page',
    sequence(blank.innerHTML).length === 0 &&
    blank.innerHTML.indexOf(ns.ui.t('entry.noCardsTitle')) > -1, '');

  /* Editing through Profile writes the shape the renderer reads. */
  store.patchSettings({ cardPrefs: {} });
  profile.toggleCard('latin', 'culture');
  check('hiding a card from Profile writes it down',
    store.getSettings().cardPrefs.latin.hidden.join(',') === 'culture',
    JSON.stringify(store.getSettings().cardPrefs));
  /* Moves are computed on the list the reader can see (the cards this group
     produces), then the cards it does not produce are appended unchanged. So
     the visible prefix of the stored order is what to compare against. */
  const visibleLatin = C.cardPrefCatalog('latin').map((card) => card.key);
  const sensesAt = visibleLatin.indexOf('senses');
  profile.moveCard('latin', 'senses', -1);
  const orderAfter = store.getSettings().cardPrefs.latin.order;
  check('moving a card writes the whole order',
    orderAfter.indexOf('senses') === sensesAt - 1 && orderAfter.length === C.cardOrder.length,
    String(orderAfter.indexOf('senses')) + ' of ' + String(orderAfter.length));
  check('and a card hidden before the move stays hidden',
    store.getSettings().cardPrefs.latin.hidden.join(',') === 'culture');
  profile.toggleCard('latin', 'culture');
  check('showing it again takes it off the list',
    store.getSettings().cardPrefs.latin.hidden.length === 0,
    JSON.stringify(store.getSettings().cardPrefs.latin.hidden));
  profile.resetPrefs('');
  check('the master reset clears every group',
    Object.keys(store.getSettings().cardPrefs).length === 0,
    JSON.stringify(store.getSettings().cardPrefs));

  /* The screen offers the controls. */
  ns.session.openPrefGroups = { latin: true };
  const profileScreen = container();
  profile.render(profileScreen, {});
  check('Profile has a Cards section with a group per family',
    C.cardPrefGroups.every((group) => profileScreen.innerHTML.indexOf('data-pref-group="' + group + '"') > -1));
  check('an unfolded group lists its cards with a control each',
    /data-pref-up="core"/.test(profileScreen.innerHTML) &&
    /data-pref-toggle="mnemonic"/.test(profileScreen.innerHTML));
  check('and the first card cannot be moved further up',
    /data-pref-up="[^"]+" data-pref-of="latin" disabled/.test(profileScreen.innerHTML), '');
  ns.session.openPrefGroups = {};

  /* A backup carries the arrangement. */
  store.patchSettings({ cardPrefs: { ja: { order: ['mnemonic'], hidden: ['culture'] } } });
  const backup = JSON.parse(JSON.stringify(store.exportAll()));
  check('the export carries the card preferences',
    backup.settings.cardPrefs && backup.settings.cardPrefs.ja.order[0] === 'mnemonic',
    JSON.stringify(backup.settings.cardPrefs));
  store.patchSettings({ cardPrefs: {} });
  store.importAll(backup);
  check('and importing puts them back',
    !!store.getSettings().cardPrefs.ja && store.getSettings().cardPrefs.ja.hidden.join(',') === 'culture',
    JSON.stringify(store.getSettings().cardPrefs));
  store.patchSettings({ cardPrefs: {} });
  store.clearHistory();
}

/* ---------- 6.0: reading a file ---------- */

/* Everything that can be decided from a string is a pure function in
   extract.js, which is why this section can be this direct: the only part that
   needs a browser is the FileReader and pdf.js, and both are stubbed. */

async function testFileMode(env) {
  const ns = env.ns;
  const store = ns.store;
  const extract = ns.extract;
  const dictionary = ns.views.dictionary;
  section('File mode');

  check('the picker accepts text, subtitles and PDFs',
    /\.txt/.test(extract.ACCEPT) && /\.pdf/.test(extract.ACCEPT) && /\.srt/.test(extract.ACCEPT),
    extract.ACCEPT);
  check('a reader is chosen by extension',
    extract.readerFor('a.PDF') === 'pdf' && extract.readerFor('notes.md') === 'text' &&
    extract.readerFor('sub.srt') === 'subtitle' && extract.readerFor('page.htm') === 'html');
  check('and an unknown extension has none',
    extract.readerFor('photo.png') === '' && extract.isSupported('photo.png') === false);

  const html = '<html><head><style>p{color:red}</style></head><body>' +
    '<h1>Titel</h1><p>Ein <b>Satz</b> &amp; noch einer.</p>' +
    '<script>var x = 1 < 2;</script></body></html>';
  const stripped = extract.stripHtml(html);
  check('HTML keeps its text', /Titel/.test(stripped) && /Ein Satz & noch einer\./.test(stripped),
    stripped);
  check('and drops script, style and tags',
    !/color:red/.test(stripped) && !/var x/.test(stripped) && stripped.indexOf('<') === -1, stripped);
  check('entities are decoded', extract.decodeEntities('a &amp; b &#65; &#x42;') === 'a & b A B',
    extract.decodeEntities('a &amp; b &#65; &#x42;'));

  const srt = '1\n00:00:01,000 --> 00:00:03,000\nBonjour.\n\n2\n00:00:03,500 --> 00:00:05,000\nÇa va ?\n';
  const dialogue = extract.stripSubtitle(srt);
  check('subtitles keep the dialogue', dialogue === 'Bonjour.\nÇa va ?', JSON.stringify(dialogue));
  check('and drop the numbering and the timing', !/-->/.test(dialogue));

  const limits = ns.CONFIG.limits.document;
  /* Measured, not guessed: a real 16,000-character part took 24 seconds, so a
     document part gets a longer ceiling than the 45s a word lookup uses. */
  check('a document part is allowed longer than a word lookup',
    ns.api.timeoutFor('document') === ns.CONFIG.api.documentTimeoutMs &&
    ns.api.timeoutFor('document') > ns.CONFIG.api.timeoutMs,
    String(ns.api.timeoutFor('document')));
  check('and the merge gets the same room',
    ns.api.timeoutFor('documentMerge') === ns.CONFIG.api.documentTimeoutMs);
  check('while the word lines keep the short one',
    ['etymology', 'usage', 'inflection', 'distinction', 'semantics', 'grammar']
      .every((line) => ns.api.timeoutFor(line) === ns.CONFIG.api.timeoutMs),
    String(ns.api.timeoutFor('usage')));
  check('the document ceiling is the measured one',
    ns.CONFIG.maxTokens.document === 8000 && ns.CONFIG.api.documentTimeoutMs === 90000,
    String(ns.CONFIG.maxTokens.document) + ' / ' + String(ns.CONFIG.api.documentTimeoutMs));
  check('the limits are the ones the screen quotes',
    limits.maxSingle === 40000 && limits.maxTotal === 200000 && limits.chunk === 20000);
  const short = extract.planChunks('x'.repeat(1200), limits);
  check('a short file is one part', short.length === 1 && short[0].total === 1, String(short.length));
  const longText = Array.from({ length: 70 }, (_, i) => 'Paragraph ' + i + ' ' + 'y'.repeat(750)).join('\n\n');
  const long = extract.planChunks(longText, limits);
  check('a long file is split into several parts', long.length > 1, String(long.length));
  check('every part knows its place',
    long.every((part, i) => part.index === i + 1 && part.total === long.length));
  check('no part runs far over the budget',
    long.every((part) => part.text.length <= limits.chunk + limits.overlap + 100),
    String(Math.max.apply(null, long.map((p) => p.text.length))));
  check('the last part of the text is in the last part of the plan',
    long[long.length - 1].text.indexOf('Paragraph 59') > -1);
  check('an empty file plans nothing', extract.planChunks('   ', limits).length === 0);

  /* File mode reads the file when it is chosen, not when the button is pressed:
     the reader has to see what was found before spending anything. */
  ns.session.file = null;
  ns.session.fileLang = '';
  const panelEmpty = dictionary.filePanel();
  check('the panel offers a drop target and a language picker',
    /id="file-drop"/.test(panelEmpty) && /data-picker="file-lang"/.test(panelEmpty));
  check('and the button is disabled until there is something to read',
    /data-file-analyse disabled/.test(panelEmpty), '');

  dictionary.acceptFile({ name: 'photo.png', size: 100 });
  await tick();
  check('an unsupported file is refused with the list of what works',
    ns.session.file.state === 'error' && /Markdown/.test(ns.session.file.error),
    JSON.stringify(ns.session.file));

  env.setFileText('# Titel\n\nEin Absatz mit Umlauten: äöü.');
  dictionary.acceptFile({ name: 'notes.md', size: 40 });
  await tick();
  await tick();
  check('a text file is read and measured',
    ns.session.file.state === 'ready' && ns.session.file.chars > 10 && ns.session.file.chunks === 1,
    JSON.stringify(ns.session.file));
  check('markdown is read as text, markers and all',
    ns.session.file.text.indexOf('# Titel') === 0, ns.session.file.text);

  dictionary.analyseFile();
  check('analysing without a language is refused',
    ns.session.pending == null, JSON.stringify(ns.session.pending));
  ns.session.fileLang = 'de';
  dictionary.analyseFile();
  const pending = ns.session.pending;
  check('with a language it opens a document entry',
    pending && pending.kind === 'document' && pending.language === 'de' &&
    pending.name === 'notes.md' && pending.text.indexOf('Umlauten') > -1,
    JSON.stringify(pending && { kind: pending.kind, language: pending.language, name: pending.name }));
  check('and the id is a document id',
    store.documentId('notes.md', pending.text, 'de', store.getSettings().model, pending.outputLang) === pending.id);
  check('a document id tells two files of the same size apart',
    store.documentId('a.txt', 'hello', 'en', 'm', 'zh') !== store.documentId('a.txt', 'world', 'en', 'm', 'zh'));
  ns.session.pending = null;

  /* PDFs: with pdf.js present the text is read; without it the reader is told
     why nothing can be opened, instead of getting an empty document. */
  env.setFileText('');
  await extract.extract({ name: 'scan.pdf' }).then(
    () => check('a PDF without pdf.js is refused', false, 'resolved anyway'),
    (err) => check('a PDF without pdf.js is refused with a code', err.code === 'pdf_unavailable', String(err.code)));

  env.setPdfLib({
    GlobalWorkerOptions: {},
    getDocument: () => ({ promise: Promise.resolve({
      numPages: 1,
      getPage: () => Promise.resolve({
        getTextContent: () => Promise.resolve({ items: [{ str: 'Hallo' }, { str: 'Welt' }] })
      })
    }) })
  });
  const pdf = await extract.extract({ name: 'article.pdf' });
  check('with pdf.js the pages are read', pdf.kind === 'pdf' && pdf.text === 'Hallo Welt', JSON.stringify(pdf));
  check('and the worker is pointed at the vendored file when there is no inlined one',
    true);

  env.setPdfLib({
    GlobalWorkerOptions: {},
    getDocument: () => ({ promise: Promise.resolve({
      numPages: 1, getPage: () => Promise.resolve({ getTextContent: () => Promise.resolve({ items: [] }) })
    }) })
  });
  dictionary.acceptFile({ name: 'scan.pdf', size: 900 });
  await tick();
  await tick();
  check('a scanned PDF is reported as a scan, not as an empty file',
    ns.session.file.state === 'error' && /OCR/.test(ns.session.file.error), ns.session.file.error);
  env.setPdfLib(null);

  env.setFileText('z'.repeat(limits.maxTotal + 50));
  dictionary.acceptFile({ name: 'huge.txt', size: limits.maxTotal });
  await tick();
  await tick();
  check('a file past the ceiling is refused and quotes its own size',
    ns.session.file.state === 'error' && ns.session.file.error.indexOf(String(limits.maxTotal + 50)) > -1,
    ns.session.file.error);

  ns.session.file = null;
  ns.session.fileLang = '';
  store.clearHistory();
}

/* ---------- 6.0: reading a document ---------- */

/* The pipeline is driven through the real module with a stubbed fetch, because
   the parts that can go wrong — the request count, the ordering, what survives
   a failure — are the parts a click test cannot see. */

async function testDocumentRun(env) {
  const ns = env.ns;
  const store = ns.store;
  const word = ns.views.word;
  section('A document, part by part');

  store.clearHistory();
  const text = Array.from({ length: 70 }, (_, i) => 'Absatz ' + i + ' ' + 'w'.repeat(750)).join('\n\n');
  const name = 'aufsatz.txt';
  const id = store.documentId(name, text, 'de', 'deepseek-flash', 'zh');
  const entry = {
    id, schema: ns.CONFIG.schemaVersion, kind: 'document', word: name, name, input: name, text,
    language: 'de', status: 'ok', ts: Date.now(), model: 'deepseek-flash', outputLang: 'zh',
    sourceLangArg: 'de', overview: { status: 'ok', language: 'de', reading: '', quick_meaning: '' }
  };

  const plan = word.documentPlan(entry);
  check('the document is planned in parts', plan.length > 1, String(plan.length));

  const calls = [];
  env.setFetch((url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ system: body.messages[0].content, user: body.messages[1].content, max: body.max_tokens });
    const isMerge = /assembling one outline/i.test(body.messages[0].content);
    const data = isMerge
      ? { summary: ['Das ganze Dokument'], register: { genre: 'Essay', register: 'formal', period: 'contemporary', notes: ['als Ganzes'] } }
      : {
        summary: ['Teil ' + calls.length],
        translation: 'Übersetzung ' + calls.length,
        vocabulary: [{ term: 'Absatz', reading: '', meaning: '段落', example: 'Absatz 1' },
          { term: 'Absatz', reading: '', meaning: '段落', example: 'doppelt' }],
        register: { genre: 'Essay', register: 'formal', period: 'contemporary', notes: ['sachlich'] }
      };
    return jsonResponse(completion(JSON.stringify(data)));
  });

  await word.runDocument(entry, 1);
  await tick();
  check('one request per part, then one merge',
    calls.length === plan.length + 1, String(calls.length) + ' for ' + plan.length + ' parts');
  check('the merge comes last and is the small one',
    /assembling one outline/i.test(calls[calls.length - 1].system) &&
    calls[calls.length - 1].max === ns.CONFIG.maxTokens.documentMerge);
  check('every part is asked for in order',
    new RegExp('part 1 of ' + plan.length).test(calls[0].user) &&
    new RegExp('part 2 of ' + plan.length).test(calls[1].user), calls[1].user.slice(0, 40));
  check('and the part ceiling is the document one',
    calls[0].max === ns.CONFIG.maxTokens.document, String(calls[0].max));
  check('the prompt tells the model to look at this part alone',
    /this part only/i.test(calls[0].system));

  const data = word.documentData(entry);
  check('the translation is joined in order',
    data.translation.indexOf('Übersetzung 1') === 0 && data.translation.split('\n\n').length === plan.length,
    data.translation.slice(0, 40));
  check('the glossary is de-duplicated', data.vocabulary.length === 1, JSON.stringify(data.vocabulary));
  check('the outline comes from the merge', data.summary.join(',') === 'Das ganze Dokument',
    JSON.stringify(data.summary));
  check('and the register note is kept whole',
    data.register.genre === 'Essay' && data.register.notes.length === 1, JSON.stringify(data.register));

  const row = store.findRow(id);
  check('the entry reached history as a document',
    row && row.kind === 'document' && row.language === 'de', JSON.stringify(row));
  /* The page itself: four cards, in the order the catalogue gives, each fed
     from the assembled document rather than from a stored line. A card that
     never renders is silent, so this is asserted rather than eyeballed. */
  const docScreen = container();
  ns.views.word.render(docScreen, { id });
  const docCards = [...docScreen.innerHTML.matchAll(/data-card="([^"]+)"/g)].map((m) => m[1]);
  check('and it renders its four cards', docCards.join(',') === ns.CONFIG.documentCardOrder.join(','),
    docCards.join(','));
  check('with the outline in the first of them',
    docScreen.innerHTML.indexOf('Das ganze Dokument') > -1);
  check('and the translation in the second',
    docScreen.innerHTML.indexOf('Übersetzung 1') > -1);
  check('and no card the word catalogue owns',
    !/data-card="senses"/.test(docScreen.innerHTML) && !/data-card="etymology"/.test(docScreen.innerHTML));
  check('the register card carries the judgement',
    docScreen.innerHTML.indexOf('Essay') > -1,
    JSON.stringify(store.getEntry(id).merged));
  check('with the first point of the outline as its subtitle', row.quickMeaning === 'Das ganze Dokument');
  check('and the file name as its title', row.word === name);
  const saved = store.getEntry(id);
  check('the payload keeps the parts it paid for', saved.parts.filter(Boolean).length === plan.length);
  check('and it keeps the source text', saved.text.length === text.length, String(saved.text.length));

  /* A part that fails stops the run and keeps what arrived. */
  const partial = JSON.parse(JSON.stringify(entry));
  partial.id = store.documentId('partial.txt', text, 'de', 'deepseek-flash', 'zh');
  partial.word = 'partial.txt';
  partial.name = 'partial.txt';
  partial.parts = [];
  let seen = 0;
  env.setFetch(() => {
    seen += 1;
    /* Every attempt after the first fails, so the retry inside api.js runs out
       and the run has to stop rather than quietly succeed. */
    if (seen >= 2) return Promise.reject(new Error('the network went away'));
    return jsonResponse(completion(JSON.stringify({ summary: ['Teil'], translation: 'x', vocabulary: [], register: {} })));
  });
  await word.runDocument(partial, 1).catch(() => {});
  await tick();
  check('a failed part stops the run',
    partial.parts.filter(Boolean).length === 1, String(partial.parts.filter(Boolean).length));
  check('the parts that arrived are kept and shown',
    word.documentData(partial).translation === 'x', word.documentData(partial).translation);
  check('and the run knows which part to continue from', word.nextMissingPart(partial) === 2,
    String(word.nextMissingPart(partial)));

  /* Resuming asks only for what is missing. */
  let resumed = 0;
  env.setFetch(() => {
    resumed += 1;
    return jsonResponse(completion(JSON.stringify({
      summary: ['Teil 2'], translation: 'y', vocabulary: [], register: {}
    })));
  });
  await word.runDocument(partial, 2);
  await tick();
  check('resuming does not re-ask for a part it already has',
    resumed === plan.length - 1 + 1, String(resumed) + ' for ' + (plan.length - 1) + ' missing parts');
  check('and the translation is complete once every part is there',
    word.documentData(partial).translation.split('\n\n').length === plan.length,
    String(word.documentData(partial).translation.split('\n\n').length));

  /* A file is not a practice item, and Starred files it apart from words. The
     label only appears when a group holds more than one kind, so the document
     gets a German headword beside it. */
  const germanWord = entryFor(ns, store, 'de', 'Absatz');
  germanWord.starred = true;
  store.saveEntry(germanWord);
  store.saveEntry(Object.assign({}, entry, { starred: true }));
  const favScreen = container();
  ns.views.favorites.render(favScreen, {});
  check('a document can be starred like anything else', store.isStarred(id));
  check('and Starred shows it under its own label',
    favScreen.innerHTML.indexOf(ns.ui.t('fav.documents')) > -1, '');
  check('a document is never a practice item',
    ns.views.favorites.practicePool('all').every((row) => row.id !== id),
    JSON.stringify(ns.views.favorites.practicePool('all').map((row) => row.kind)));
  check('and the practice pool still has the words',
    ns.views.favorites.practicePool('all').some((row) => row.id === germanWord.id),
    JSON.stringify(ns.views.favorites.practicePool('all').map((row) => row.word)));

  /* Deleting and restoring a document. */
  const snapshot = store.snapshotEntry(id);
  store.removeEntry(id);
  check('deleting a document removes its row', store.findRow(id) === null);
  store.restoreEntry(snapshot);
  check('and the undo brings it back with its payload',
    store.findRow(id) !== null && store.getEntry(id) !== null);

  /* Regenerating a document clears and refills it. */
  env.setFetch(() => jsonResponse(completion(JSON.stringify({
    summary: ['Neu'], translation: 'neu', vocabulary: [], register: {}
  }))));
  await word.runDocument(partial, 1);
  await tick();
  check('a document can be read again', word.documentData(partial).translation.length > 0);

  store.clearHistory();
  store.clearStarred();
  env.setFetch(() => jsonResponse(completion('{}')));
}

/* ---------- 6.1: what the practice screen asks ---------- */

function testPracticePrompt(env) {
  const ns = env.ns;
  const store = ns.store;
  const practice = ns.practice;
  section('Practice prompt');

  const latin = practice.createExercise({
    word: 'contend', reading: '/kənˈtend/', meaning: '争夺', pos: 'v.',
    language: 'en', practice: 'spell', outputLang: 'zh'
  });
  check('the exercise carries the meaning and the part of speech',
    latin.meaning === '争夺' && latin.item.pos === 'v.', latin.meaning + ' / ' + latin.item.pos);
  check('the first hint for a Latin word is its IPA',
    practice.firstHint(latin) === '/kənˈtend/', practice.firstHint(latin));
  check('and it never contains the word itself',
    practice.firstHint(latin).toLowerCase().indexOf('contend') === -1);

  const pinyin = practice.createExercise({
    word: '青', reading: 'qīng', meaning: 'blue', pos: '形',
    language: 'zh', practice: 'pinyin', outputLang: 'en'
  });
  check('the first hint for a Chinese word is the tone pattern',
    /1/.test(practice.firstHint(pinyin)) && practice.firstHint(pinyin).toLowerCase().indexOf('qing') === -1,
    practice.firstHint(pinyin));
  check('two syllables give two tones', practice.tonePatternOf('qīng shān').join(',') === '1,1',
    practice.tonePatternOf('qīng shān').join(','));
  check('a neutral tone is not invented', practice.tonePatternOf('de').length === 0);

  const kana = practice.createExercise({
    word: '成功', reading: 'せいこう', meaning: 'success', pos: '名',
    language: 'ja', practice: 'kana', outputLang: 'en'
  });
  check('the first hint for a Japanese word is the mora count',
    practice.firstHint(kana).indexOf('4') > -1, practice.firstHint(kana));
  check('and not the kana itself', practice.firstHint(kana).indexOf('せいこう') === -1);
  check('small kana do not add a mora',
    practice.moraCount('きょう') === 2 && practice.moraCount('がっこう') === 4,
    practice.moraCount('きょう') + ' / ' + practice.moraCount('がっこう'));
  check('the stage markup has a prompt block', /data-spell-prompt/.test(
    fs.readFileSync(path.join(JS_DIR, 'practice.js'), 'utf8')));
  check('and the prompt is not hidden behind the hint', !/spell-prompt[^>]*hidden/.test(
    fs.readFileSync(path.join(JS_DIR, 'practice.js'), 'utf8')));

  /* The translation follows the explanation language set for that source
     language, not whatever language the entry was written in. */
  store.clearHistory();
  const zhEntry = entryFor(ns, store, 'en', 'contend');
  zhEntry.outputLang = 'zh';
  zhEntry.overview.quick_meaning = '中文释义';
  store.saveEntry(zhEntry);
  const enEntry = entryFor(ns, store, 'en', 'contend');
  enEntry.id = store.entryId('contend', 'en', 'deepseek-flash', 'en');
  enEntry.outputLang = 'en';
  enEntry.overview.quick_meaning = 'English gloss';
  store.saveEntry(enEntry);
  const table = store.getSettings().outputLangBySource;
  table.en = 'zh';
  store.patchSettings({ outputLangBySource: table });

  const resolved = practice.meaningFor({
    word: 'contend', language: 'en', model: 'deepseek-flash',
    outputLang: 'en', meaning: 'English gloss'
  });
  check('the meaning follows the configured explanation language',
    resolved === '中文释义', resolved);
  check('with no sibling it falls back to the stored gloss',
    practice.meaningFor({ word: 'unseen', language: 'en', model: 'deepseek-flash', outputLang: 'en', meaning: 'fallback' }) === 'fallback');
  store.clearHistory();
  store.patchSettings({ outputLangBySource: { en: 'zh', fr: 'zh', de: 'zh', ja: 'zh', zh: 'zh' } });
}

/* ---------- 6.1: card names in the ordering list ---------- */

function testCardTitles(env) {
  const ns = env.ns;
  const C = ns.CONFIG;
  const store = ns.store;
  const profile = ns.views.profile;
  section('Card names');

  const keys = C.cardOrder.concat(C.sentenceCardOrder);
  const langs = ['en', 'zh', 'fr', 'de', 'ja'];
  const missing = [];
  keys.forEach((key) => {
    const card = C.cardCatalog[key] || C.sentenceCatalog[key];
    langs.forEach((lang) => { if (!C.cardTitle(card, lang)) missing.push(key + ':' + lang); });
  });
  check('every card has a name in all five interface languages', missing.length === 0, missing.join(','));
  check('the Chinese name of a shared card is the term the entry page uses',
    C.cardTitle(C.cardCatalog.senses, 'zh') === C.cardCatalog.senses.notes.zh,
    C.cardTitle(C.cardCatalog.senses, 'zh'));
  check('the name of the core card follows the 6.0 rename',
    C.cardTitle(C.cardCatalog.core, 'en') === 'Core meaning' &&
    C.cardTitle(C.cardCatalog.core, 'zh') === '核心义');

  store.patchSettings({ uiLang: 'zh', cardPrefs: {} });
  ns.session.openPrefGroups = { latin: true };
  const screen = container();
  profile.render(screen, {});
  check('the list shows the name in the interface language',
    screen.innerHTML.indexOf('核心义') > -1 && screen.innerHTML.indexOf('Core meaning') === -1);
  ns.session.openPrefGroups = {};
  store.patchSettings({ uiLang: 'en' });

  /* The entry page keeps its own device: English, then the term in the language
     being studied. */
  /* An entry whose source language is not English is the case where the
     native half appears at all. */
  const entry = entryFor(ns, store, 'zh', '青');
  store.saveEntry(entry);
  store.patchSettings({ uiLang: 'zh' });
  const wordScreen = container();
  ns.views.word.render(wordScreen, { id: entry.id });
  check('the entry page still titles the card English · native',
    wordScreen.innerHTML.indexOf('Senses · 义项') > -1,
    wordScreen.innerHTML.slice(wordScreen.innerHTML.indexOf('data-card="senses"'), wordScreen.innerHTML.indexOf('data-card="senses"') + 140));
  store.patchSettings({ uiLang: 'en' });
  store.clearHistory();
}

/* ---------- 6.1: restoring one group ---------- */

function testGroupReset(env) {
  const ns = env.ns;
  const store = ns.store;
  const profile = ns.views.profile;
  section('Restoring a group');

  store.patchSettings({ cardPrefs: {} });
  ns.session.openPrefGroups = {};
  const folded = container();
  profile.render(folded, {});
  const resets = [...folded.innerHTML.matchAll(/data-pref-reset="([^"]+)"/g)].map((m) => m[1]);
  check('every group keeps its restore control while folded',
    resets.join(',') === 'latin,ja,zh,sentence', resets.join(','));
  check('and no card rows are drawn while folded', !/data-pref-up=/.test(folded.innerHTML));

  store.patchSettings({
    cardPrefs: {
      latin: { order: ['mnemonic'], hidden: ['culture'] },
      ja: { order: ['mnemonic'], hidden: [] }
    }
  });
  profile.resetPrefs('latin');
  check('restoring one group leaves the others alone',
    !store.getSettings().cardPrefs.latin && !!store.getSettings().cardPrefs.ja,
    JSON.stringify(store.getSettings().cardPrefs));
  profile.resetPrefs('');
  check('the master restore still clears everything',
    Object.keys(store.getSettings().cardPrefs).length === 0);
}

/* ---------- 6.1: docx, and keeping the file's shape ---------- */

/* A minimal zip writer: enough for one member, stored or deflated, which is all
   a .docx needs from the format for this reader. */
async function makeZip(entryName, xml, deflate) {
  const name = Buffer.from(entryName, 'utf8');
  const raw = Buffer.from(xml, 'utf8');
  let data = raw;
  if (deflate) {
    const source = new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(raw)); controller.close(); }
    });
    const reader = source.pipeThrough(new CompressionStream('deflate-raw')).getReader();
    const parts = [];
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      parts.push(Buffer.from(chunk.value));
    }
    data = Buffer.concat(parts);
  }

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(deflate ? 8 : 0, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  const body = Buffer.concat([local, name, data]);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(deflate ? 8 : 0, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const directory = Buffer.concat([central, name]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(body.length, 16);

  const zip = Buffer.concat([body, directory, eocd]);
  return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
}

const DOCX_XML = '<?xml version="1.0" encoding="UTF-8"?>' +
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
  '<w:p><w:r><w:t>Erster Absatz.</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>Zweiter Absatz mit </w:t></w:r><w:r><w:t>einem Tab</w:t></w:r>' +
  '<w:r><w:tab/><w:t>danach</w:t></w:r><w:r><w:br/><w:t>neue Zeile</w:t></w:r></w:p>' +
  '<w:p><w:r><w:instrText>PAGE</w:instrText><w:t>&amp; Ende</w:t></w:r></w:p>' +
  '</w:body></w:document>';

async function testDocx(env) {
  const ns = env.ns;
  const extract = ns.extract;
  section('DOCX');

  check('the picker offers docx', /\.docx/.test(extract.ACCEPT), extract.ACCEPT);
  check('and names the legacy format so it can be refused by name',
    extract.readerFor('a.docx') === 'docx' && extract.readerFor('a.doc') === 'legacy');

  const parsed = extract.docxXmlToText(DOCX_XML);
  check('paragraphs become paragraph breaks', parsed.split(/\n{2,}/).length === 3, JSON.stringify(parsed));
  check('a line break inside a paragraph survives', parsed.indexOf('danach\nneue Zeile') > -1, JSON.stringify(parsed));
  check('a tab survives as a tab', parsed.indexOf('\t') > -1);
  check('field codes are dropped', parsed.indexOf('PAGE') === -1);
  check('entities are decoded once', parsed.indexOf('& Ende') > -1, JSON.stringify(parsed));

  env.setFileBytes(await makeZip('word/document.xml', DOCX_XML, false));
  const stored = await extract.extract({ name: 'stored.docx', size: 1000 });
  check('a stored (uncompressed) member is read', stored.text.indexOf('Erster Absatz.') > -1, stored.text.slice(0, 40));

  env.setFileBytes(await makeZip('word/document.xml', DOCX_XML, true));
  const deflated = await extract.extract({ name: 'packed.docx', size: 1000 });
  check('a deflated member is read', deflated.text.indexOf('Zweiter Absatz') > -1, deflated.text.slice(0, 40));

  env.setFileBytes(new Uint8Array([1, 2, 3, 4]).buffer);
  await extract.extract({ name: 'broken.docx', size: 4 }).then(
    () => check('a broken zip is refused', false, 'resolved anyway'),
    (err) => check('a broken zip is refused', err.code === 'docx_failed', String(err.code)));

  await extract.extract({ name: 'old.doc', size: 10 }).then(
    () => check('a legacy .doc is refused by name', false, 'resolved anyway'),
    (err) => check('a legacy .doc is refused by name', err.code === 'legacy_doc', String(err.code)));
  await extract.extract({ name: 'huge.docx', size: extract.MAX_DOCX_BYTES + 1 }).then(
    () => check('a docx over the ceiling is refused', false, 'resolved anyway'),
    (err) => check('a docx over the ceiling is refused', err.code === 'docx_too_large', String(err.code)));

  /* A browser without raw deflate must say so rather than fail obscurely. */
  env.setFileBytes(await makeZip('word/document.xml', DOCX_XML, true));
  const held = env.sandbox.DecompressionStream;
  env.sandbox.DecompressionStream = undefined;
  await extract.extract({ name: 'nodeflate.docx', size: 1000 }).then(
    () => check('an engine without raw deflate is told, not crashed', false, 'resolved anyway'),
    (err) => check('an engine without raw deflate is told, not crashed',
      err.code === 'docx_unavailable', String(err.code)));
  env.sandbox.DecompressionStream = held;

  check('an image is still refused with the list of what works',
    extract.isSupported('photo.png') === false && /DOCX/.test(ns.ui.t('file.unsupported')));
}

function testShaping(env) {
  const ns = env.ns;
  const extract = ns.extract;
  section('Keeping the file\'s shape');

  check('blank lines survive extraction', extract.clean('a\n\n\nb', 'x.txt') === 'a\n\n\nb');
  check('runs of spaces collapse inside a line', extract.clean('a    b', 'x.txt') === 'a b');
  check('trailing spaces go', extract.clean('a   \nb', 'x.txt') === 'a\nb');
  check('indentation on a line is kept as a single space', extract.clean('a\n    indented', 'x.txt') === 'a\n indented',
    JSON.stringify(extract.clean('a\n    indented', 'x.txt')));

  const lines = extract.pageText([
    { str: 'Hello', transform: [1, 0, 0, 1, 0, 700] },
    { str: 'world', transform: [1, 0, 0, 1, 40, 700] },
    { str: 'Next line', transform: [1, 0, 0, 1, 0, 680] },
    { str: 'New paragraph', transform: [1, 0, 0, 1, 0, 600] }
  ]);
  check('PDF text is rebuilt line by line', lines.split('\n')[0] === 'Hello world', JSON.stringify(lines));
  check('and a paragraph gap becomes a blank line', lines.indexOf('Next line\n\nNew paragraph') > -1, JSON.stringify(lines));

  /* The translation card keeps a single line break inside a paragraph. */
  const doc = { translation: 'Line one\nline two\n\nSecond paragraph.', summary: ['s'], vocabulary: [], register: {}, parts: 1, total: 1 };
  const html = ns.views.document.builders.translation(doc);
  check('the translation keeps the paragraph split', /<p class="doc-para">Line one\nline two<\/p>/.test(html), html);
  check('and the second paragraph is its own block', /Second paragraph\.<\/p>/.test(html));
  check('the style preserves whitespace', /white-space: pre-wrap/.test(
    fs.readFileSync(path.join(WEB_DIR, 'assets', 'app.css'), 'utf8')));
}

function testDocPrompt(env) {
  const ns = env.ns;
  section('Document prompt');
  const prompt = ns.prompts.document('de', 'zh', { index: 1, total: 1 });
  check('it asks for the source shape', /one paragraph for every paragraph/i.test(prompt) && /blank line/i.test(prompt));
  check('it asks for 信 · 达 · 雅 in that order', prompt.indexOf('信') > -1 && prompt.indexOf('达') > -1 && prompt.indexOf('雅') > -1);
  check('and it says accuracy wins', /accuracy wins/i.test(prompt));
  check('the merge prompt is untouched by the translation rules',
    !/信/.test(ns.prompts.documentMerge('de', 'zh')));
}

/* ---------- 6.1: skipping a word, and coming back to it ---------- */

function testSkipQueue(env) {
  const ns = env.ns;
  const queue = ns.views.favorites.roundQueue;
  section('Skipping a word');

  const round = queue(['a', 'b', 'c']);
  check('a round starts on its first word', round.current() === 'a');
  check('and counts it as neither done nor skipped',
    round.progress().done === 0 && round.progress().skipped.length === 0);

  const afterSkip = round.skip();
  check('skipping moves to the next word', afterSkip === 'b', String(afterSkip));
  check('and remembers where it happened', round.progress().skipped.join(',') === '0',
    round.progress().skipped.join(','));
  check('the second pass has not started yet', round.progress().pass === 1);

  round.advance();
  check('answering moves on as usual', round.current() === 'c');
  const looped = round.advance();
  check('the end of the set loops to the first skipped word', looped === 'a', String(looped));
  check('as a new pass', round.progress().pass === 2 && round.progress().total === 1,
    JSON.stringify(round.progress()));
  check('whose dot row starts clean', round.progress().done === 0 && round.progress().skipped.length === 0);

  const done = queue(['a', 'b']);
  done.advance();
  check('a round with no skips ends at the last word', done.advance() === null);

  const all = queue(['a', 'b', 'c']);
  all.skip();
  all.skip();
  all.skip();
  check('skipping everything leaves one word to try',
    all.current() === 'a' && all.progress().pass === 2 && all.progress().total === 3,
    JSON.stringify(all.progress()));
  const again = all.skip();
  check('skipping inside the second pass stays in it',
    all.progress().pass === 2 && again === 'b' && all.progress().skipped.join(',') === '0',
    JSON.stringify(all.progress()));
  all.skip();
  all.skip();
  check('and words skipped twice become a third pass starting at the first of them',
    all.progress().pass === 3 && all.progress().total === 3 && all.current() === 'a',
    JSON.stringify(all.progress()));
}

function testSkipSurface(env) {
  const ns = env.ns;
  const practiceRaw = fs.readFileSync(path.join(JS_DIR, 'practice.js'), 'utf8');
  const css = fs.readFileSync(path.join(WEB_DIR, 'assets', 'app.css'), 'utf8');
  section('Skipping — the controls');

  check('the top control is skip and carries its own label',
    /data-spell="skip"/.test(practiceRaw) && /data-spell-skip-label/.test(practiceRaw));
  check('it is hidden until a round says otherwise',
    /class="spell-exit" data-spell="skip" hidden/.test(practiceRaw));
  check('a single word never offers it',
    /var canSkip = !!current\.practiceMode/.test(practiceRaw));
  check('closing is not disabled while a round runs',
    !/data-spell="close"[^>]*disabled/.test(practiceRaw) && !/refs\.close\.disabled/.test(practiceRaw));
  check('skipping cancels the queued advance first',
    /clearTimeout\(advanceTimer\)/.test(practiceRaw));

  check('hidden really hides the top control', /\.spell-exit\[hidden\] \{ display: none; \}/.test(css));
  check('a skipped word has its own dot state', /\.spell-dot\.is-skipped \{/.test(css));
  check('the current word is a ring, not a fill', /\.spell-dot\.is-current \{/.test(css));

  /* And the dot row is built from progress.skipped, not from a counter. */
  check('the dot row reads the skipped positions',
    /skippedAt\.indexOf\(d\) > -1/.test(practiceRaw) && /is-skipped/.test(practiceRaw));
}

/* ---------- 6.1: only the cards a group can actually produce ---------- */

function testCardApplicability(env) {
  const ns = env.ns;
  const C = ns.CONFIG;
  const store = ns.store;
  const profile = ns.views.profile;
  section('Which cards a group can produce');

  const missing = C.cardOrder.filter((key) => C.cardLangs(key).length === 0);
  check('every word card declares the languages that can fill it', missing.length === 0, missing.join(','));

  /* The gap this patch closed: a card that can appear for a language must carry
     that language's term, or the entry title loses its native half. */
  const withoutNote = [];
  C.cardOrder.forEach((key) => {
    const card = C.cardCatalog[key];
    C.cardLangs(key).forEach((lang) => {
      /* English needs no gloss — the title is already English. Every other
         language a card can appear in must say what the card is called there. */
      if (lang === 'en') return;
      if (!card.notes || !card.notes[lang]) withoutNote.push(key + ':' + lang);
    });
  });
  check('and every language it can appear in has a term on the card',
    withoutNote.length === 0, withoutNote.join(','));

  check('the list for each group is only what that group produces',
    C.cardPrefCatalog('latin').length === 25 &&
    C.cardPrefCatalog('ja').length === 17 &&
    C.cardPrefCatalog('zh').length === 16 &&
    C.cardPrefCatalog('sentence').length === 9,
    ['latin', 'ja', 'zh', 'sentence'].map((g) => g + ':' + C.cardPrefCatalog(g).length).join(' '));

  const latin = C.cardPrefCatalog('latin').map((card) => card.key);
  check('the Latin list keeps the French and German signature cards',
    latin.indexOf('doublets') > -1 && latin.indexOf('kasusRektion') > -1 &&
    latin.indexOf('komposita') > -1 && latin.indexOf('lautverschiebung') > -1);
  check('and holds none of the Japanese or Chinese ones',
    ['nuance', 'readings', 'kanjiOrigin', 'multipleReadings', 'characterEvolution', 'thenAndNow']
      .every((key) => latin.indexOf(key) === -1), latin.join(','));
  const ja = C.cardPrefCatalog('ja').map((card) => card.key);
  check('the Japanese list holds its own cards and the shared ones',
    ['nuance', 'readings', 'components', 'conjugation', 'senses', 'culture'].every((k) => ja.indexOf(k) > -1));
  check('and none of the Latin-only forms cards',
    ['nounForms', 'comparison', 'government', 'kasusRektion', 'doublets'].every((k) => ja.indexOf(k) === -1));

  /* The five note gaps found while auditing. */
  const notes = (key) => C.cardCatalog[key].notes || {};
  check('doublets carries its French term', notes('doublets').fr === 'Doublets');
  check('government carries its German term', notes('government').de === 'Verb + Präposition');
  check('culture carries Japanese and Chinese',
    notes('culture').ja === '文化' && notes('culture').zh === '文化');
  check('pronunciation carries Japanese', notes('pronunciation').ja === '発音');

  /* What the reader sees, in the interface they are using. */
  store.patchSettings({ uiLang: 'zh', cardPrefs: {} });
  ns.session.openPrefGroups = { latin: true };
  const screen = container();
  profile.render(screen, {});
  ns.session.openPrefGroups = {};
  const names = [...screen.innerHTML.matchAll(/class="pref-name">([^<]+)</g)].map((m) => m[1]);
  check('the Chinese list no longer offers the retired Spanish cards',
    names.every((name) => name.indexOf('Ser') === -1 && name.indexOf('Arabisms') === -1), names.slice(0, 8).join(','));
  check('and shows the cards this group can really produce',
    names.length === 25 && names.indexOf('核心义') > -1 && names.indexOf('双式词') > -1,
    String(names.length) + ' — ' + names.slice(0, 6).join(','));
  store.patchSettings({ uiLang: 'en' });
}

/* ---------- 6.1: one tap to the top of a long list ---------- */

function testMoveToTop(env) {
  const ns = env.ns;
  const C = ns.CONFIG;
  const store = ns.store;
  const profile = ns.views.profile;
  section('Moving a card to the top');

  store.patchSettings({ cardPrefs: { latin: { order: [], hidden: ['culture'] } } });
  const visible = () => C.cardPrefCatalog('latin').map((card) => card.key);
  const last = visible()[visible().length - 1];
  profile.moveToTop('latin', last);
  const stored = store.getSettings().cardPrefs.latin.order;
  check('the last card of the list moves to the first place', stored[0] === last, stored.slice(0, 3).join(','));
  check('and the stored order is still a full permutation', stored.length === C.cardOrder.length,
    String(stored.length));
  check('hiding is untouched by a move',
    store.getSettings().cardPrefs.latin.hidden.join(',') === 'culture');
  check('other groups are untouched', !store.getSettings().cardPrefs.ja);

  const before = stored.slice();
  profile.moveToTop('latin', before[0]);
  check('a card already at the top writes nothing',
    store.getSettings().cardPrefs.latin.order.join(',') === before.join(','));

  /* And the row offers it, disabled where it would do nothing. */
  ns.session.openPrefGroups = { latin: true };
  const screen = container();
  profile.render(screen, {});
  ns.session.openPrefGroups = {};
  const tops = [...screen.innerHTML.matchAll(/data-pref-top="([^"]+)"/g)].map((m) => m[1]);
  check('every row has a move-to-top control', tops.length === 25, String(tops.length));
  check('and the first one is disabled',
    /data-pref-top="[^"]+" data-pref-of="latin" disabled/.test(screen.innerHTML));
  check('its own icon is not the same as move-up',
    ns.ui.icon('toTop') !== ns.ui.icon('arrowUp') && /M5\.5 4\.5h13/.test(ns.ui.icon('toTop')));
  store.patchSettings({ cardPrefs: {} });
}

/* ---------- 6.3: a practice source can be one language ---------- */

function testLanguageSource(env) {
  const ns = env.ns;
  const store = ns.store;
  const fav = ns.views.favorites;
  section('Practising one language');

  store.clearHistory();
  store.clearStarred();
  ['en', 'de', 'ja', 'zh'].forEach((lang) => {
    const words = { en: 'contend', de: 'Gift', ja: '成功', zh: '青' };
    const entry = entryFor(ns, store, lang, words[lang]);
    entry.starred = true;
    store.saveEntry(entry);
  });

  check('the source selects one language', fav.sourceLanguage('lang:ja') === 'ja' &&
    fav.sourceLanguage('all') === '' && fav.sourceLanguage('wb123') === '');
  check('rows for a language are only that language',
    fav.sourceRows('lang:ja').length === 1 && fav.sourceRows('lang:ja')[0].language === 'ja',
    String(fav.sourceRows('lang:ja').length));
  check('the pool behind it holds only that language',
    fav.practicePool('lang:ja').length === 1 && fav.practicePool('lang:ja')[0].language === 'ja');
  check('and "all" still holds every starred row', fav.sourceRows('all').length === 4);

  /* The list is offered in the picker's own order, retired languages last. */
  check('languages are offered in the picker order',
    fav.starredLanguages().join(',') === 'en,de,ja,zh', fav.starredLanguages().join(','));

  ns.session.favoritesSource = 'all';
  const screen = container();
  fav.render(screen, {});
  const config = ns.ui.pickerConfig('practice-source');
  check('the source picker starts with everything', config.options[0].id === 'all',
    config.options.map((o) => o.id).join(','));
  check('then offers each starred language with its practisable count',
    config.options.map((o) => o.id).slice(1, 5).join(',') === 'lang:en,lang:de,lang:ja,lang:zh' &&
    config.options[1].label === 'English (1)',
    config.options.map((o) => o.label).join(' | '));
  const ids = config.options.map((o) => o.id);
  const lastLang = ids.reduce((at, id, i) => (id.indexOf('lang:') === 0 ? i : at), -1);
  const firstOther = ids.findIndex((id) => id !== 'all' && id.indexOf('lang:') !== 0);
  check('and puts wordbooks after the languages', firstOther === -1 || firstOther > lastLang,
    ids.join(','));

  /* Choosing one narrows the screen as well as the pencil. */
  ns.session.favoritesSource = 'lang:ja';
  const filtered = container();
  fav.render(filtered, {});
  const open = [...filtered.innerHTML.matchAll(/data-open="([^"]+)"/g)].map((m) => m[1]);
  check('the list shows only the chosen language', open.length === 1, String(open.length));
  check('and no other language badge is drawn',
    filtered.innerHTML.indexOf('>EN<') === -1 && filtered.innerHTML.indexOf('>DE<') === -1);
  check('the picker shows what is chosen',
    ns.ui.pickerConfig('practice-source').value === 'lang:ja');

  /* A starred row with no reading stays in the list but out of the pool:
     Chinese and Japanese cannot be practised without one. */
  const bare = entryFor(ns, store, 'zh', '水');
  bare.starred = true;
  bare.overview = { status: 'ok', language: 'zh', reading: '', quick_meaning: 'water' };
  store.saveEntry(bare);
  check('a row without a reading stays listed but out of the pool',
    fav.sourceRows('lang:zh').length === 2 && fav.practicePool('lang:zh').length === 1,
    fav.sourceRows('lang:zh').length + ' listed / ' + fav.practicePool('lang:zh').length + ' practisable');

  ns.session.favoritesSource = 'all';
  store.clearHistory();
  store.clearStarred();
}

/* ---------- the feature map must move with the app ---------- */

function testFeatureMap(env) {
  section('Feature map');
  const file = path.join(REPO_DIR, '..', 'docs', 'feature-map', 'features.json');
  if (!fs.existsSync(file)) {
    check('the feature map exists', false, 'run node docs/feature-map/build.mjs');
    return;
  }
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('the feature map has been built', true);
  check('and is not stale: it was built for this version',
    map.counts && map.counts.version === env.ns.CONFIG.version,
    'map ' + (map.counts && map.counts.version) + ' vs app ' + env.ns.CONFIG.version +
    ' — run node docs/feature-map/build.mjs');
  const ids = new Set(map.nodes.map((node) => node.id));
  check('every node it marks as new or changed exists',
    Object.keys(map.badges || {}).every((id) => ids.has(id)),
    Object.keys(map.badges || {}).filter((id) => !ids.has(id)).join(','));
}

/* ---------- 6.4: a word that was missed the first time comes back ---------- */

function testRoundReview(env) {
  const ns = env.ns;
  const practice = ns.practice;
  const fav = ns.views.favorites;
  section('Missing a word marks it for review');

  const missed = practice.createExercise({
    word: 'contend', reading: '', meaning: 'strive', pos: 'v.',
    language: 'en', practice: 'spell', mode: 'practice', progress: { total: 3 }
  });
  check('a fresh exercise is not marked', missed.firstWrong === false);
  practice.applyInput(missed, 'conten');
  practice.applySubmit(missed);
  check('a first wrong attempt marks the word as not known', missed.firstWrong === true);
  practice.applySubmit(missed);
  practice.applyInput(missed, 'contend');
  practice.applySubmit(missed);
  check('and the exercise still ends correct with the mark intact',
    missed.status === 'correct' && missed.firstWrong === true);

  const clean = practice.createExercise({
    word: 'contend', reading: '', meaning: 'strive', pos: 'v.',
    language: 'en', practice: 'spell', mode: 'practice', progress: { total: 3 }
  });
  practice.applyInput(clean, 'contend');
  practice.applySubmit(clean);
  check('a first-try correct is not marked', clean.status === 'correct' && clean.firstWrong === false);

  /* The queue keeps both kinds of unfinished word, in the order they happened. */
  const round = fav.roundQueue(['a', 'b', 'c']);
  round.advance('unknown');
  check('a missed word is queued and its dot marked',
    round.progress().unknown.join(',') === '0' && round.progress().skipped.length === 0,
    JSON.stringify(round.progress()));
  round.advance('known');
  round.skip();
  check('skipped and missed words form one review pass, from the first one',
    round.current() === 'a' && round.progress().pass === 2 && round.progress().total === 2,
    JSON.stringify(round.progress()));
  round.advance('unknown');
  round.advance('unknown');
  check('a word missed again stays in the loop',
    round.progress().pass === 3 && round.progress().total === 2 && round.current() === 'a',
    JSON.stringify(round.progress()));
  const tidy = fav.roundQueue(['x', 'y']);
  tidy.advance('known');
  check('a clean pass still ends', tidy.advance('known') === null);

  const raw = fs.readFileSync(path.join(JS_DIR, 'practice.js'), 'utf8');
  check('the dots have a state for a missed word', /is-unknown/.test(raw) &&
    /\.spell-dot\.is-unknown \{/.test(fs.readFileSync(path.join(WEB_DIR, 'assets', 'app.css'), 'utf8')));
  check('and the round is told the outcome', /onAdvance\(\{ outcome:/.test(raw));
}

/* ---------- 6.4: no user-visible string outside strings.js ---------- */

function testLocalizationGuard(env) {
  const ns = env.ns;
  const store = ns.store;
  section('Interface copy is localised');
  const files = ['view-favorites.js', 'view-word.js', 'view-profile.js', 'view-dictionary.js',
    'view-document.js', 'practice.js', 'tour.js'];
  const raw = files.map((file) => fs.readFileSync(path.join(JS_DIR, file), 'utf8')).join('\n');
  const forbidden = [
    ["'Expand all'", /'Expand all'/],
    ["'Collapse all'", /'Collapse all'/],
    ['<th>Word</th>', /<th>Word<\/th>/],
    ["window.prompt('", /window\.prompt\('/],
    ['Irregular comparison', /Irregular comparison/],
    ['On readings', /On readings/],
    ['Kun readings', /Kun readings/],
    ['本义', /'本义'/],
    ["the 'via' fact label", /\['via'/],
    ["the 'attested' fact label", /\['attested'/],
    ["the 'certainty' fact label", /\['certainty'/],
    ["the English explanation-language label", /label: 'Explanation language'/]
  ];
  forbidden.forEach(([label, pattern]) => {
    check('no hardcoded ' + label + ' left in the views', !pattern.test(raw),
      files.filter((file) => pattern.test(fs.readFileSync(path.join(JS_DIR, file), 'utf8'))).join(','));
  });

  ['profile.model.hint', 'field.on', 'field.kun', 'field.special', 'field.primarySense',
    'field.figurativeSense', 'field.now', 'field.okurigana', 'entry.irregularComparison']
    .forEach((key) => {
      check('every language has ' + key,
        Object.keys(ns.strings).every((lang) => typeof ns.strings[lang][key] === 'string' &&
          ns.strings[lang][key].length > 0));
    });

  /* The screen from the screenshot: the master toggle follows the interface. */
  store.patchSettings({ uiLang: 'zh' });
  const screen = container();
  ns.views.favorites.render(screen, {});
  check('the Starred master toggle is translated',
    (screen.innerHTML.indexOf('全部收起') > -1 || screen.innerHTML.indexOf('全部展开') > -1) &&
    screen.innerHTML.indexOf('Collapse all') === -1);

  /* Appearance and the etymology facts follow the interface too. */
  const profile = container();
  ns.views.profile.render(profile, {});
  check('the theme options are translated',
    profile.innerHTML.indexOf('自动') > -1 && profile.innerHTML.indexOf('浅色') > -1 &&
    profile.innerHTML.indexOf('深色') > -1 &&
    profile.innerHTML.indexOf('Light') === -1 && profile.innerHTML.indexOf('Dark') === -1,
    '');

  const entry = entryFor(ns, store, 'en', 'contend');
  entry.lines.etymology.etymology.certainty = 'high';
  store.saveEntry(entry);
  const entryScreen = container();
  ns.views.word.render(entryScreen, { id: entry.id });
  check('the etymology fact labels are translated',
    entryScreen.innerHTML.indexOf(ns.ui.t('field.certainty')) > -1,
    ns.ui.t('field.certainty'));
  store.clearHistory();
  store.patchSettings({ uiLang: 'en' });
}

/* ---------- 6.5: retyping after a mistake, and when playback unlocks ---------- */

function testRetryAndPlayback(env) {
  const ns = env.ns;
  const practice = ns.practice;
  const raw = fs.readFileSync(path.join(JS_DIR, 'practice.js'), 'utf8');
  section('Retyping after a mistake');

  const ex = practice.createExercise({
    word: 'contend', reading: '/kənˈtend/', meaning: 'strive', pos: 'v.',
    language: 'en', practice: 'spell', mode: 'practice', progress: { total: 3 }
  });
  /* Same length as the answer: the input is capped, so a longer wrong spelling
     would be trimmed into the right one. */
  practice.applyInput(ex, 'contand');
  practice.applySubmit(ex);
  check('a wrong attempt leaves the answer on screen', ex.status === 'wrong' && ex.reveal === true);
  check('and keeps what was typed for the comparison',
    ex.typed === 'contand', ex.typed);

  /* The bug: typing was ignored while status stayed 'wrong', and the old value
     was written back into the field. One keystroke must start a new attempt. */
  practice.applyInput(ex, 'c');
  check('one keystroke starts a clean attempt', ex.status === 'input' && ex.typed === 'c',
    ex.status + ' / ' + ex.typed);
  check('the old mistake is gone from the model', ex.typed.indexOf('contand') === -1);
  check('and the answer is still there to copy from', ex.reveal === true);
  practice.applyInput(ex, 'contend');
  practice.applySubmit(ex);
  check('the retry can succeed', ex.status === 'correct' && ex.reveal === false);
  check('while the miss is still recorded', ex.firstWrong === true);

  /* Playback is a hint about the word, so it waits for a hint. */
  check('nothing is spoken when a word opens', !/speak\(item\);/i.test(raw));
  check('the speaker is gated on the hint level', /current\.hint >= 1/.test(raw) && /refs\.replay\.disabled/.test(raw));
  check('and there is copy for the locked state', 'practice.replayLocked' in ns.strings.en);
}

/* ---------- 6.5: the document limits are real ---------- */

function testDocumentBounds(env) {
  const ns = env.ns;
  const store = ns.store;
  const C = ns.CONFIG;
  section('Document limits');

  const limit = C.limits.document.keepSource;
  const text = 'A'.repeat(limit) + 'B'.repeat(2000);
  const id = store.documentId('long.txt', text, 'en', 'deepseek-flash', 'zh');
  const entry = {
    id, kind: 'document', word: 'long.txt', name: 'long.txt', input: 'long.txt', text,
    language: 'en', status: 'ok', ts: Date.now(), model: 'deepseek-flash', outputLang: 'zh',
    overview: { status: 'ok', language: 'en', reading: '', quick_meaning: 'q' },
    lines: { document: { summary: ['s'], translation: 't', vocabulary: [], register: {}, parts: 1, total: 1 } }
  };
  store.saveEntry(entry);
  const stored = store.getEntry(id);
  check('a long source is cut at the kept length', stored.text.length === limit, String(stored.text.length));
  check('and the copy says it was cut', stored.textTruncated === true);
  check('while the entry in memory keeps the whole text', entry.text.length === text.length);
  check('the page has copy for that state', 'file.truncated' in ns.strings.en);

  /* Same name and length, different tail: two documents, not one. */
  const a = 'x'.repeat(5000) + 'END-A';
  const b = 'x'.repeat(5000) + 'END-B';
  check('two files with the same name and length are told apart',
    a.length === b.length &&
    store.documentId('same.txt', a, 'en', 'm', 'zh') !== store.documentId('same.txt', b, 'en', 'm', 'zh'));
  store.removeEntry(id);
}

/* ---------- 6.5: an unstarred row keeps its place until the screen is left ---- */

function testKeptUnstarred(env) {
  const ns = env.ns;
  const store = ns.store;
  const fav = ns.views.favorites;
  section('Unstarring keeps the row');

  store.clearHistory();
  const entry = entryFor(ns, store, 'en', 'contend');
  entry.starred = true;
  store.saveEntry(entry);
  ns.session.keptUnstarred = {};
  check('the row starts in the starred set', fav.sourceRows('all').length === 1);

  store.toggleStar(entry.id);
  ns.session.keptUnstarred[entry.id] = true;
  const kept = fav.sourceRows('all');
  check('unstarred, it is still listed for this visit',
    kept.length === 1 && kept[0].starred === false, JSON.stringify(kept.map((r) => r.starred)));
  check('and it is no longer in the stored starred set', store.findRow(entry.id).starred === false);

  fav.leave();
  check('leaving the screen drops it', fav.sourceRows('all').length === 0);

  /* Putting the star back is the same control in its other state. */
  ns.session.keptUnstarred[entry.id] = true;
  store.toggleStar(entry.id);
  delete ns.session.keptUnstarred[entry.id];
  check('starring it again restores the row as starred',
    fav.sourceRows('all').length === 1 && store.findRow(entry.id).starred === true);
  store.clearHistory();
}

/* ---------- 7.0 ---------- */

function testSurprisePool(env) {
  section('7.0 Surprise pool');
  const pool = env.ns.pool;
  const state = { items: [], seen: [], seenNames: [], batches: 0 };
  const added = pool._append(state, [
    { word: 'lumen', language: 'Latin', code: 'la', native: 'Latinum', theme: 'light' },
    { word: 'lumen', language: 'Latin', code: 'la', native: 'Latinum', theme: 'light' },
    { word: '木漏れ日', language: 'Japanese', code: 'ja', native: '日本語', theme: 'light' }
  ]);
  check('a batch de-duplicates by language and word', added === 2 && state.items.length === 2, String(added));
  check('the language filter returns only that language',
    pool._candidates(state, 'ja').length === 1 && pool._candidates(state, 'ja')[0].word === '木漏れ日');
  check('an unused mixed item is available in Auto', pool._candidates(state, 'auto').length === 2);
  check('the pool limit is 200 with 100-word batches',
    env.ns.CONFIG.limits.surprisePool.target === 200 && env.ns.CONFIG.limits.surprisePool.batch === 100);
  const prompt = env.ns.prompts.surprisePool('auto', 100, 'zh');
  check('the pool prompt restricts every word to the five live languages',
    /Every word must be in one of/.test(prompt) && /do not use any other language/.test(prompt));
  check('the pool prompt names all five live languages',
    ['English', 'French', 'German', 'Japanese', 'Chinese'].every((name) => prompt.indexOf(name) > -1));
}

function testRoots(env) {
  section('7.0 Roots');
  const roots = env.ns.roots;
  const entry = {
    id: 'root-test-entry', word: 'contend', language: 'en',
    lines: {
      etymology: {
        morphology: {
          breakdown: [
            { part: 'con-', type: 'prefix', meaning: 'together', origin: 'Latin' },
            { part: 'tend', type: 'root', meaning: 'stretch', origin: 'Latin' }
          ],
          root_variants: [{ form: 'tens', note: 'before -ion' }]
        },
        root_family: { shared_root: [{ word: 'extend', gloss: 'stretch out' }], direct: [] }
      }
    }
  };
  const found = roots.rootsFromEntry(entry);
  check('a Latin root is extracted from morphology', found.length === 1 && found[0].display === 'tend');
  check('the root key separates kind and origin', found[0].key === 'morpheme:latin:tend', found[0].key);
  check('variants and family words travel with the root',
    found[0].variants.indexOf('tens') > -1 && found[0].family[0].word === 'extend');
  check('root answers accept aliases and ignore case',
    roots.answerMatches('TENS', ['tend', 'tens']) && !roots.answerMatches('tent', ['tend']));
  check('Atlas origin normalization is conservative',
    roots.originFamily('Latin tendere') === 'latin' && roots.originFamily('Greek logos') === 'greek');
  check('Atlas ids are stable root ids',
    roots.atlasId({ kind: 'morpheme', origin: 'Latin', display: 'tend', language: 'en' }) === 'root:latin:tend');
  roots.indexEntry(Object.assign({}, entry, { outputLang: 'zh', ts: Date.now() }));
  const atlas = roots.buildAtlas();
  check('Atlas derives a root entity from entry data',
    atlas.roots.some((item) => item.id === 'root:latin:tend' && item.derivedWords.some((word) => word.word === 'extend')));
  check('Atlas search finds a root by form and family word',
    roots.searchAtlas('tend').length > 0 && roots.searchAtlas('extend').length > 0);
  env.ns.store.writeAux('rootProgress', {});
  roots.recordWordOutcome({ roots: found }, 'known');
  const progress = env.ns.store.readAux('rootProgress', {});
  check('spelling records an encounter without changing the review date',
    progress[found[0].key].correct === 1 && !progress[found[0].key].dueAt);
  roots.recordRootAnswer(found[0].key, false);
  const after = env.ns.store.readAux('rootProgress', {});
  check('a wrong stage does not change the review date',
    after[found[0].key].dueAt === 0 && after[found[0].key].intervalIndex === 0 &&
    after[found[0].key].wrong === 1);
  roots.recordStage(found[0].key, 1, true);
  roots.recordStage(found[0].key, 2, true);
  roots.recordStage(found[0].key, 3, true);
  const completed = env.ns.store.readAux('rootProgress', {})[found[0].key];
  check('all three correct stages advance one Ebbinghaus interval',
    completed.intervalIndex === 1 && completed.dueAt > Date.now());
  check('mastery states map from strength',
    roots._stateFor(0) === 'new' && roots._stateFor(3) === 'familiar' && roots._stateFor(5) === 'known');
  const stageOne = env.ns.rootReview._stageQuestion({ key: found[0].key, display: 'tend', meaning: 'stretch', variants: ['tens'] }, 1, []);
  const stageTwo = env.ns.rootReview._stageQuestion({ key: found[0].key, display: 'tend', meaning: 'stretch', variants: ['tens'] }, 2, []);
  check('root review fixes meaning, spelling and family stages',
    stageOne.type === 'choice' && stageTwo.type === 'input' && stageTwo.answers.indexOf('tens') > -1);
  const discovery = env.ns.prompts.discovery('sobremesa', 'Spanish', 'zh');
  check('the discovery prompt asks for two examples', /exactly 2/.test(discovery));
  check('and forbids invented etymology', /Never invent/.test(discovery));
}

function testDiscoveryBook(env) {
  section('7.0 Discovery wordbook');
  const ns = env.ns;
  const store = ns.store;
  const id = 'discovery-test-entry';
  const entry = {
    id, kind: 'discovery', word: 'sobremesa', language: 'Spanish',
    languageName: 'Spanish', languageCode: 'es', coreMeaning: 'lingering at the table',
    examples: [{ text: 'Una sobremesa larga.', translation: 'A long after-meal conversation.' }],
    rootNote: '', model: 'deepseek-flash', outputLang: 'zh', ts: Date.now(), starred: false
  };
  check('a discovery entry saves as its own kind', !!store.saveDiscovery(entry));
  const row = store.findRow(id);
  check('the history row keeps the discovery kind and language name',
    row && row.kind === 'discovery' && row.languageName === 'Spanish');
  check('discovery words are not practisable', ns.views.favorites.canPractise(row) === false);
  store.toggleStar(id);
  check('starring puts it in the reserved Surprise book',
    store.wordbooksFor(id).some((book) => book.id === store.SURPRISE_BOOK_ID));
  const discoveryScreen = container();
  ns.views.discovery.render(discoveryScreen, { id });
  check('the discovery view renders the word and core meaning',
    discoveryScreen.innerHTML.indexOf('sobremesa') > -1 &&
    discoveryScreen.innerHTML.indexOf('lingering at the table') > -1);
  const rootsScreen = container();
  ns.views.roots.render(rootsScreen, {});
  check('the Roots view renders without a live DOM',
    rootsScreen.innerHTML.indexOf('root-stats') > -1);
  const normal = store.createWordbook('7.0 normal test');
  check('a normal wordbook refuses a discovery word',
    normal && store.addToWordbook(normal.id, id) === false);
  const snapshot = store.snapshotEntry(id);
  store.removeEntry(id);
  check('deleting removes the row and its payload', !store.findRow(id) && !store.getEntry(id));
  store.restoreEntry(snapshot);
  check('Undo restores the row, star and reserved-book link',
    !!store.findRow(id) && store.isStarred(id) &&
    store.wordbooksFor(id).some((book) => book.id === store.SURPRISE_BOOK_ID));
  store.removeEntry(id);
  if (normal) store.removeWordbook(normal.id);
  check('the practice module renders a language chip', /spell-lang/.test(
    fs.readFileSync(path.join(JS_DIR, 'practice.js'), 'utf8')));
  check('the discovery view exists', fs.existsSync(path.join(JS_DIR, 'view-discovery.js')));
  check('the roots view exists', fs.existsSync(path.join(JS_DIR, 'view-roots.js')));
}

function testVersionGroups(env) {
  section('7.1 Version groups');
  const ns = env.ns;
  const store = ns.store;
  const word = 'version-test-' + Date.now();
  const base = {
    kind: 'word', word, language: 'en', model: 'deepseek-flash',
    overview: { status: 'ok', language: 'en', quick_meaning: 'test', reading: '' },
    lines: {}, ts: Date.now(), starred: false
  };
  const zh = Object.assign({}, base, { id: store.entryId(word, 'en', 'deepseek-flash', 'zh'), outputLang: 'zh', ts: Date.now() - 1000 });
  const en = Object.assign({}, base, { id: store.entryId(word, 'en', 'deepseek-flash', 'en'), outputLang: 'en', ts: Date.now() });
  store.saveEntry(zh);
  store.saveEntry(en);
  const groups = store.listGroups().filter((row) => row.word === word);
  check('two explanation languages collapse to one history group', groups.length === 1, String(groups.length));
  check('the group carries both versions', groups[0] && groups[0].versions.length === 2);
  check('the first version language is the earliest version', groups[0] && groups[0].firstOutputLang === 'zh');
  store.removeGroup(groups[0].id);
  check('deleting the group removes every version', !store.getEntry(zh.id) && !store.getEntry(en.id));
  const langs = Object.keys(ns.roots.rootGroups('learning', 'zh'));
  check('root groups are fixed to en/fr/de', langs.join(',') === 'en,fr,de', langs.join(','));
  check('the discovery route highlights Dictionary',
    /name: 'discovery', tab: 'dictionary'/.test(fs.readFileSync(path.join(JS_DIR, 'app.js'), 'utf8')));
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
  const offlinePath = path.join(REPO_DIR, 'dist', 'linguist_' + version + '.html');
  check('the offline bundle is named after the version', fs.existsSync(offlinePath), offlinePath);

  const offline = fs.readFileSync(offlinePath, 'utf8');
  /* Markup only: the inlined modules contain strings that look like attributes
     (the tab bar builds `href="…"` by concatenation), and those are not files
     the bundle would ever try to fetch. */
  const offlineMarkup = offline.replace(/<script[\s\S]*?<\/script>/gi, '');
  const external = [...offlineMarkup.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
    .filter((v) => !v.startsWith('data:') && !/^https?:/i.test(v) && v !== '#');
  check('the offline bundle references no local files', external.length === 0, external.join(','));
  check('the offline bundle has no service worker registration',
    !/serviceWorker\s*\.\s*register/.test(offline));

  /* 6.0 additions. The single file is what a file:// reader (and, later, a
     desktop shell) actually opens, so what is inside it is asserted. */
  check('the offline bundle is named after this release',
    path.basename(offlinePath) === 'linguist_8.0.0.html', path.basename(offlinePath));
  check('it inlines the vendored pdf.js rather than linking to it',
    /pdfjsLib/.test(offline) && offline.indexOf('vendor/pdfjs/pdf.min.js') === -1);
  check('and carries the worker source for the blob URL',
    /id="pdf-worker-source"/.test(offline));
  check('no script in it points at a file', !/<script[^>]+src=/.test(offline));
  check('it has no reference to the old product name', !/radicle/i.test(offline));

  const sw = fs.readFileSync(path.join(WEB_DIR, 'sw.js'), 'utf8');
  check('the cache is named after the product and this release',
    /CACHE_VERSION = 'v8\.0\.0'/.test(sw) && /linguist-' \+ CACHE_VERSION/.test(sw));
  ['js/extract.js', 'js/view-document.js', 'vendor/pdfjs/pdf.min.js', 'vendor/pdfjs/pdf.worker.min.js']
    .forEach((file) => {
      check('the shell precaches ' + file, sw.indexOf("'./" + file + "'") > -1);
    });

  /* A stale artefact from the folder this one was copied from would be shipped
     by anyone who zips dist/, so it must not be there. */
  const strays = fs.readdirSync(path.join(REPO_DIR, 'dist'))
    .filter((entry) => /^radicle/i.test(entry));
  check('dist holds no artefact from the previous name', strays.length === 0, strays.join(','));
  check('the deploy folder has no documentation in it',
    !published.some((file) => /\.md$/.test(file)));
}

(async function main() {
  const env = createEnvironment();
  /* The shipped default explains each language in itself (en→en, fr→fr) and
     Japanese and Chinese in Chinese. The suite pins every row to Chinese
     instead, which is what an upgraded 4.x user has and what keeps the dozens
     of id-building assertions below meaningful; the per-language table gets its
     own section. */
  env.ns.store.patchSettings({
    outputLangBySource: { en: 'zh', fr: 'zh', de: 'zh', ja: 'zh', zh: 'zh' },
    outputLang: 'zh'
  });
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
  await testBatchOne(env);
  await testLanguageDefaults(env);
  await testBatchFour(env);
  await testInterfaceLanguage(env);
  await testInterleaving(env);
  await testAutoFallback(env);
  testBrand(env);
  testTourLayout(env);
  testCardPreferences(env);
  await testFileMode(env);
  await testDocumentRun(env);
  testPracticePrompt(env);
  testSkipQueue(env);
  testSkipSurface(env);
  testCardApplicability(env);
  testMoveToTop(env);
  testCardTitles(env);
  testGroupReset(env);
  await testDocx(env);
  testShaping(env);
  testDocPrompt(env);
  testLanguageSource(env);
  testSurprisePool(env);
  testRoots(env);
  testDiscoveryBook(env);
  testVersionGroups(env);
  testFeatureMap(env);
  testRoundReview(env);
  testRetryAndPlayback(env);
  testDocumentBounds(env);
  testKeptUnstarred(env);
  testLocalizationGuard(env);
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
