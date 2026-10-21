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
    version: '0.1.0',

    api: {
      endpoint: 'https://api.deepseek.com/chat/completions',
      timeoutMs: 60000,
      maxAttemptsOnRateLimit: 2,
      retryBackoffMs: 1200
    },

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
      maxExpressionWords: 4
    }
  };

  ns.STORAGE = {
    settings: 'dict.settings',
    history: 'dict.history',
    entryPrefix: 'dict.entry.'
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
