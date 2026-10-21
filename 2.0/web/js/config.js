/* RADICLE — constants and shared configuration.
   The Mini Program build (phase 2) imports the same values from a single
   config module so behaviour and wording stay identical. */

window.RADICLE = window.RADICLE || {};

(function (ns) {
  'use strict';

  ns.CONFIG = {
    appName: 'Radicle',
    tagline: 'The roots of words',
    /* Used by the prompts as the assistant persona, and by the Profile page. */
    description: "A linguist's dictionary: meaning, usage, etymology, word roots and cultural depth.",
    version: '2.1.0',

    /* Bumped whenever the stored entry shape changes. 1.0 wrote schema 1. */
    schemaVersion: 2,

    api: {
      endpoint: 'https://api.deepseek.com/chat/completions',
      /* Measured against a real lookup: the slowest line took 5.3s and the
         whole four-request set 6.4s. 60s keeps an order of magnitude of
         headroom without letting a hung request hang for minutes. */
      timeoutMs: 60000,
      maxAttemptsOnRateLimit: 2,
      retryBackoffMs: 1200
    },

    /* Token ceilings per request. Measured against a real call before being
       trusted; deliberately generous so a long entry is never cut mid-json. */
    maxTokens: {
      overview: 700,
      etymology: 3200,
      usage: 2600,
      distinction: 2000,
      candidate: 900
    },

    /* The three deep lines, run in parallel. This is the order the requests
       are sent in, not the order the cards render in — see cardOrder. */
    deepLines: ['etymology', 'usage', 'distinction'],

    /* Reading order of the deep cards: meaning first, then the roots.
       The single source of truth for card order. Cards are placed by this
       list, so a line still in flight leaves skeletons in its own positions
       instead of shifting everything around when it lands. */
    cardOrder: [
      'senses',
      'collocations',
      'usage',
      'confusables',
      'core',
      'etymology',
      'morphology',
      'rootFamily',
      'falseCognates',
      'culture',
      'synthesis',
      'mnemonic'
    ],

    models: [
      { id: 'deepseek-flash', label: 'DeepSeek Flash', hint: 'Fast, 1M context — best for lookups' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', hint: 'Deeper reasoning, noticeably slower' }
    ],
    defaultModel: 'deepseek-flash',

    outputLanguages: [
      { id: 'zh', label: 'Chinese', native: '中文', speech: 'zh-CN' },
      { id: 'en', label: 'English', native: 'English', speech: 'en-US' },
      { id: 'fr', label: 'Français', native: 'Français', speech: 'fr-FR' }
    ],
    defaultOutputLang: 'zh',

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
      /* Spelling practice round length, shown as progress dots. */
      practiceRound: 5
    }
  };

  /* Storage keys are namespaced so 2.0 never touches 1.0's data even when both
     are opened from the same origin. Bump this if the shape changes again. */
  ns.STORAGE_PREFIX = 'dict2';

  ns.STORAGE = {
    settings: ns.STORAGE_PREFIX + '.settings',
    history: ns.STORAGE_PREFIX + '.history',
    entryPrefix: ns.STORAGE_PREFIX + '.entry.'
  };

  ns.DEFAULT_SETTINGS = {
    apiKey: '',
    outputLang: ns.CONFIG.defaultOutputLang,
    model: ns.CONFIG.defaultModel,
    theme: ns.CONFIG.defaultTheme,
    thinking: false
  };

  /* Shared cross-view session state. In-memory only: it describes what the
     current screen is doing, not anything worth persisting. Defined here so
     views can be loaded and rendered independently of the app shell. */
  ns.session = {
    query: '',
    filter: 'all',
    pending: null,      /* { id, input } for a lookup that has not been generated yet */
    candidates: null,   /* reverse-lookup panel state */
    focusSearch: false
  };
})(window.RADICLE);
