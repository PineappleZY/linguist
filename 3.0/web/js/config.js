/* RADICLE — constants and shared configuration.

   3.0 turns the app from a two-language dictionary into a five-language one.
   Two ideas carry most of that weight:

   1. CONFIG.languages is the single table behind BOTH axes — the language you
      look a word up in, and the language explanations are written in. They
      used to be separate concepts; they are the same five languages now.
   2. CONFIG.cardCatalog is the single table behind every deep card. A language
      only fills the cards it has data for, and the view renders whatever is
      non-empty. There is no per-language layout code anywhere. */

window.RADICLE = window.RADICLE || {};

(function (ns) {
  'use strict';

  /* ---------- Languages ---------- */

  /* practice   — which exercise a word in this language gets
     needsReading — whether the exercise needs overview.reading to exist
     accents    — whether typed input may arrive without its diacritics */
  var LANGUAGES = [
    { id: 'en', label: 'English', native: 'English', script: 'latin', accents: false, practice: 'spell', needsReading: false },
    { id: 'fr', label: 'French', native: 'Français', script: 'latin', accents: true, practice: 'spell', needsReading: false },
    { id: 'de', label: 'German', native: 'Deutsch', script: 'latin', accents: true, practice: 'spell', needsReading: false },
    { id: 'ja', label: 'Japanese', native: '日本語', script: 'kana', accents: false, practice: 'kana', needsReading: true },
    { id: 'zh', label: 'Chinese', native: '中文', script: 'han', accents: false, practice: 'pinyin', needsReading: true }
  ];

  /* ---------- Deep cards ----------
     `line` says which of the three parallel requests produces this card, so a
     failed line can be retried on its own. `note` is the native gloss shown
     after the English title on CJK cards, where the English rendering alone
     would be less recognisable than the term used in teaching materials. */

  var CARDS = [
    /* meaning */
    { key: 'senses', line: 'usage', icon: 'list', title: 'Senses' },
    { key: 'collocations', line: 'usage', icon: 'link', title: 'Collocations' },
    { key: 'usage', line: 'usage', icon: 'info', title: 'Usage' },
    { key: 'confusables', line: 'distinction', icon: 'question', title: 'Confusables' },

    /* the semantic core, expressed the way each language family thinks about it */
    { key: 'core', line: 'etymology', icon: 'target', title: 'Semantic core' },
    { key: 'nuance', line: 'etymology', icon: 'target', title: 'Nuance', note: '語感' },
    { key: 'originalSense', line: 'etymology', icon: 'target', title: 'Original sense', note: '本义与引申' },
    { key: 'thenAndNow', line: 'distinction', icon: 'hourglass', title: 'Then and now', note: '本义与今义' },

    /* history and form */
    { key: 'etymology', line: 'etymology', icon: 'hourglass', title: 'Etymology' },
    { key: 'kanjiOrigin', line: 'etymology', icon: 'hourglass', title: 'Kanji origin', note: '漢字の成り立ち' },
    { key: 'characterEvolution', line: 'etymology', icon: 'hourglass', title: 'Character evolution', note: '字源演变' },
    { key: 'components', line: 'etymology', icon: 'branch', title: 'Components', note: '字形分解' },
    { key: 'morphology', line: 'etymology', icon: 'branch', title: 'Morphology' },
    { key: 'wordFormation', line: 'etymology', icon: 'branch', title: 'Word formation', note: '构词分解' },
    { key: 'komposita', line: 'etymology', icon: 'network', title: 'Compounds', note: 'Komposita' },
    { key: 'rootFamily', line: 'etymology', icon: 'network', title: 'Root family' },
    { key: 'falseCognates', line: 'etymology', icon: 'shield', title: 'False cognates' },
    { key: 'readings', line: 'etymology', icon: 'quote', title: 'Readings', note: '読み' },
    { key: 'wordStratum', line: 'etymology', icon: 'museum', title: 'Word stratum', note: '語種' },
    { key: 'multipleReadings', line: 'etymology', icon: 'quote', title: 'Multiple readings', note: '多音字' },

    /* grammar */
    { key: 'conjugation', line: 'usage', icon: 'list', title: 'Conjugation' },
    { key: 'stammformen', line: 'usage', icon: 'list', title: 'Principal parts', note: 'Stammformen' },
    { key: 'kasusRektion', line: 'usage', icon: 'info', title: 'Case government', note: 'Kasus & Rektion' },
    { key: 'trennbarePraefixe', line: 'usage', icon: 'branch', title: 'Separable prefixes', note: 'Trennbare Präfixe' },
    { key: 'artikelPlural', line: 'usage', icon: 'info', title: 'Article and plural', note: 'Artikel & Plural' },
    { key: 'genreNombre', line: 'usage', icon: 'info', title: 'Gender and number', note: 'Genre & Nombre' },
    /* These two ride with the etymology line: the prompt returns them together
       with the character's history, and a card must read the line that
       actually carries its field. */
    { key: 'classicalVsModern', line: 'etymology', icon: 'hourglass', title: 'Classical vs modern', note: '古今异义' },
    { key: 'classicalUsage', line: 'etymology', icon: 'quote', title: 'Classical usage', note: '古汉语用法' },

    /* word building */
    { key: 'doublets', line: 'distinction', icon: 'network', title: 'Doublets', note: 'Doublets' },
    { key: 'lautverschiebung', line: 'distinction', icon: 'shield', title: 'Sound shift', note: 'Lautverschiebung' },
    { key: 'sourceWord', line: 'distinction', icon: 'link', title: 'Source word', note: '原詞' },
    { key: 'spellingVariants', line: 'distinction', icon: 'close', title: 'Spelling variants', note: '表記のゆれ' },
    { key: 'originAllusion', line: 'distinction', icon: 'museum', title: 'Origin & allusion', note: '出处典故' },

    /* sound and closing */
    { key: 'pronunciation', line: 'etymology', icon: 'speaker', title: 'Pronunciation' },
    { key: 'culture', line: 'distinction', icon: 'museum', title: 'Culture' },
    { key: 'synthesis', line: 'distinction', icon: 'quote', title: 'Synthesis' },
    { key: 'mnemonic', line: 'distinction', icon: 'sparkle', title: 'Mnemonic' }
  ];

  /* ---------- Sentence analysis cards ---------- */

  var SENTENCE_CARDS = [
    { key: 'translation', line: 'semantics', icon: 'quote', title: 'Translation', required: true },
    { key: 'wordByWord', line: 'semantics', icon: 'list', title: 'Word by word', required: true },
    { key: 'chunks', line: 'semantics', icon: 'link', title: 'Chunks & idioms' },
    { key: 'structure', line: 'grammar', icon: 'branch', title: 'Structure' },
    { key: 'grammar', line: 'grammar', icon: 'info', title: 'Grammar', required: true },
    { key: 'register', line: 'grammar', icon: 'museum', title: 'Register & nuance' },
    { key: 'pitfalls', line: 'grammar', icon: 'alert', title: 'Pitfalls' },
    { key: 'pattern', line: 'grammar', icon: 'sparkle', title: 'Pattern', required: true },
    { key: 'culture', line: 'grammar', icon: 'museum', title: 'Culture' }
  ];

  ns.CONFIG = {
    appName: 'Radicle',
    tagline: 'The roots of words',
    description: "A linguist's dictionary: meaning, usage, etymology, word roots and cultural depth.",
    version: '3.0.2',

    /* Bumped whenever the stored entry shape changes. 1.0 wrote schema 1,
       2.x wrote 2. 3.0 adds the target language to the entry id. */
    schemaVersion: 3,

    api: {
      endpoint: 'https://api.deepseek.com/chat/completions',
      /* Measured against a real English lookup: slowest line 5.3s, whole
         four-request set 6.4s. */
      timeoutMs: 60000,
      maxAttemptsOnRateLimit: 2,
      retryBackoffMs: 1200
    },

    maxTokens: {
      overview: 700,
      etymology: 3200,
      usage: 2600,
      distinction: 2000,
      candidate: 900,
      surprise: 300,
      sentenceSemantics: 2400,
      sentenceGrammar: 2400
    },

    languages: LANGUAGES,
    /* The explanation language offers exactly the same five. */
    outputLanguages: LANGUAGES,
    defaultOutputLang: 'en',
    /* Shown in the query-language picker; not a real language id. */
    autoLang: 'auto',
    autoLabel: 'Auto',

    /* Which line produces which card. Derived from CARDS so the two can never
       drift apart. */
    cardLines: CARDS.reduce(function (map, card) {
      map[card.key] = card.line;
      return map;
    }, {}),

    /* Reading order of the deep cards: meaning first, then form and history.
       Every language shares this order; cards a language has no data for are
       simply not rendered. */
    cardOrder: CARDS.map(function (card) { return card.key; }),
    cardCatalog: CARDS.reduce(function (map, card) {
      map[card.key] = card;
      return map;
    }, {}),

    deepLines: ['etymology', 'usage', 'distinction'],
    sentenceLines: ['semantics', 'grammar'],
    sentenceCardOrder: SENTENCE_CARDS.map(function (card) { return card.key; }),
    sentenceCatalog: SENTENCE_CARDS.reduce(function (map, card) {
      map[card.key] = card;
      return map;
    }, {}),

    models: [
      { id: 'deepseek-flash', label: 'DeepSeek Flash', hint: 'Fast, 1M context — best for lookups' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', hint: 'Deeper reasoning, noticeably slower' }
    ],
    defaultModel: 'deepseek-flash',

    themes: [
      { id: 'auto', label: 'Auto' },
      { id: 'light', label: 'Light' },
      { id: 'dark', label: 'Dark' }
    ],
    defaultTheme: 'auto',

    limits: {
      maxHistory: 500,
      maxInputLength: 64,
      maxExpressionWords: 4,
      /* Sentence mode accepts much longer input. */
      maxSentenceLength: 400,
      practiceRound: 5,
      maxWordbooks: 50,
      maxWordbookName: 40
    }
  };

  /* Storage keys are namespaced per major version so 3.0 never touches 2.x's
     data even when both are opened from the same origin. */
  ns.STORAGE_PREFIX = 'dict3';

  ns.STORAGE = {
    settings: ns.STORAGE_PREFIX + '.settings',
    history: ns.STORAGE_PREFIX + '.history',
    entryPrefix: ns.STORAGE_PREFIX + '.entry.',
    wordbooks: ns.STORAGE_PREFIX + '.wordbooks'
  };

  ns.DEFAULT_SETTINGS = {
    apiKey: '',
    /* Explanations default to English; the interface is English regardless. */
    outputLang: ns.CONFIG.defaultOutputLang,
    /* 'auto' or one of the language ids. */
    queryLang: ns.CONFIG.autoLang,
    model: ns.CONFIG.defaultModel,
    theme: ns.CONFIG.defaultTheme
  };

  /* Shared cross-view session state. In-memory only. */
  ns.session = {
    query: '',
    filter: 'all',
    mode: 'word',        /* word | sentence */
    pending: null,
    candidates: null,
    favoritesSource: 'all',   /* all | <wordbookId> */
    focusSearch: false
  };
})(window.RADICLE);
