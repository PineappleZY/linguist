/* RADICLE — constants and shared configuration.

   4.2 makes "which language is this" a hard fact of every stored entry. It used
   to be possible to keep the query picker's literal "auto" on a saved row,
   which meant it could not be grouped, practised, or analysed in the right
   language — the deep prompts fall back to English when the source language is
   not one they know. `languageByAnyName` plus the checks around the overview
   are what close that hole.

   4.1 added the fourth request line — `inflection` — and with it the whole
   morphology of the five Latin-script languages: full person-by-person
   paradigms, noun declension, adjective agreement, comparison, pronouns and
   verb government. Japanese and Chinese keep the three lines they had.

   Four tables carry the weight:
     LANGUAGES      the seven languages, serving both the query picker and the
                    explanation picker
     GROUPS         the four visual sections of an entry, in reading order
     CARDS          every deep card, each with a group, a line and a
                    per-language glossary
     SENTENCE_CARDS the nine sentence-analysis cards, same treatment

   A card only renders when the model filled its field, so one shared catalog
   drives seven different-looking entries. */

window.RADICLE = window.RADICLE || {};

(function (ns) {
  'use strict';

  /* ---------- Languages ---------- */

  /* practice    — which exercise a word in this language gets
     needsReading — whether the exercise needs overview.reading to exist
     accents     — whether typed input may arrive without its diacritics
     inflects    — whether words in it have paradigms worth tabulating, which
                    decides whether the fourth request line runs at all
     retired     — no longer offered: not in any picker, not in the Surprise
                    pool. Entries already stored in it keep working, so the
                    rows people already have do not break.
     label       — English name, used in tests and as a fallback
     native      — the name the language calls itself; what the pickers show */
  var LANGUAGES = [
    { id: 'en', label: 'English', native: 'English', script: 'latin', accents: false, practice: 'spell', needsReading: false, inflects: true },
    { id: 'fr', label: 'French', native: 'Français', script: 'latin', accents: true, practice: 'spell', needsReading: false, inflects: true },
    { id: 'de', label: 'German', native: 'Deutsch', script: 'latin', accents: true, practice: 'spell', needsReading: false, inflects: true },
    { id: 'it', label: 'Italian', native: 'Italiano', script: 'latin', accents: true, practice: 'spell', needsReading: false, inflects: true, retired: true },
    { id: 'es', label: 'Spanish', native: 'Español', script: 'latin', accents: true, practice: 'spell', needsReading: false, inflects: true, retired: true },
    { id: 'ja', label: 'Japanese', native: '日本語', script: 'kana', accents: false, practice: 'kana', needsReading: true, inflects: false },
    { id: 'zh', label: 'Chinese', native: '中文', script: 'han', accents: false, practice: 'pinyin', needsReading: true, inflects: false }
  ];

  /* What the pickers offer, and what Surprise may hand out. `languages` above
     stays the full table because stored entries, grouping and pronunciation
     still have to resolve Italian and Spanish. */
  var QUERY_LANGUAGES = LANGUAGES.filter(function (lang) { return !lang.retired; });

  /* The four sections an entry is read in. A group header is a quiet label,
     never a control: the entry page still has exactly one collapse button. */
  var GROUPS = [
    { id: 'dna', labelKey: 'group.dna' },
    { id: 'meaning', labelKey: 'group.meaning' },
    { id: 'forms', labelKey: 'group.forms' },
    { id: 'context', labelKey: 'group.context' }
  ];

  var SENTENCE_GROUPS = [
    { id: 'meaning', labelKey: 'group.sentenceMeaning' },
    { id: 'grammar', labelKey: 'group.grammar' }
  ];

  /* ---------- Deep cards ----------
     `line` says which of the three parallel requests produces this card, so a
     failed line can be retried on its own. `notes` gives the card's name in the
     language being studied; the title is rendered as "English · native" for any
     non-English source language, and the gloss is dropped when it would just
     repeat the English word (Collocations, Culture). */

  var CARDS = [
    /* ---------- Meaning ---------- */
    { key: 'senses', group: 'meaning', line: 'usage', icon: 'list', title: 'Senses',
      notes: { fr: 'Sens', de: 'Bedeutungen', it: 'Significati', es: 'Acepciones', ja: '語義', zh: '义项' } },
    { key: 'collocations', group: 'meaning', line: 'usage', icon: 'link', title: 'Collocations',
      notes: { fr: 'Collocations', de: 'Kollokationen', it: 'Collocazioni', es: 'Colocaciones', ja: 'コロケーション', zh: '搭配' } },
    { key: 'usage', group: 'meaning', line: 'usage', icon: 'info', title: 'Usage',
      notes: { fr: 'Emploi', de: 'Gebrauch', it: 'Uso', es: 'Uso', ja: '用法', zh: '用法' } },
    { key: 'serEstar', group: 'meaning', line: 'usage', icon: 'info', title: 'Ser and estar',
      notes: { es: 'Ser y estar' } },
    { key: 'confusables', group: 'meaning', line: 'distinction', icon: 'question', title: 'Confusables',
      notes: { fr: 'Confusions', de: 'Verwechslungen', it: 'Confusioni', es: 'Confusiones', ja: '類義語の使い分け', zh: '近义词辨析' } },
    { key: 'classicalVsModern', group: 'meaning', line: 'etymology', icon: 'hourglass',
      title: 'Classical vs modern', notes: { zh: '古今异义' } },
    { key: 'classicalUsage', group: 'meaning', line: 'etymology', icon: 'quote',
      title: 'Classical usage', notes: { zh: '古汉语用法' } },
    { key: 'thenAndNow', group: 'meaning', line: 'distinction', icon: 'hourglass',
      title: 'Then and now', notes: { zh: '本义与今义' } },

    /* ---------- Forms ----------
       Everything a learner has to inflect. One card per part of speech, and a
       card only appears when the headword is of that class. */
    { key: 'wordProfile', group: 'forms', line: 'inflection', icon: 'eye', title: 'Word profile',
      notes: { fr: 'Fiche du mot', de: 'Wortprofil', it: 'Profilo della parola', es: 'Ficha de la palabra' } },
    { key: 'nounForms', group: 'forms', line: 'inflection', icon: 'list', title: 'Noun forms',
      notes: { fr: 'Formes du nom', de: 'Substantivformen', it: 'Forme del nome', es: 'Formas del nombre' } },
    { key: 'adjectiveForms', group: 'forms', line: 'inflection', icon: 'sparkle', title: 'Adjective forms',
      notes: { fr: "Formes de l'adjectif", de: 'Adjektivdeklination', it: "Forme dell'aggettivo", es: 'Formas del adjetivo' } },
    { key: 'conjugation', group: 'forms', line: 'inflection', icon: 'list', title: 'Conjugation',
      notes: { fr: 'Conjugaison', de: 'Konjugation', it: 'Coniugazione', es: 'Conjugación', ja: '活用' } },
    { key: 'comparison', group: 'forms', line: 'inflection', icon: 'network', title: 'Comparison',
      notes: { fr: 'Comparatif et superlatif', de: 'Steigerung', it: 'Comparativo e superlativo', es: 'Comparación' } },
    { key: 'pronouns', group: 'forms', line: 'inflection', icon: 'person', title: 'Pronouns',
      notes: { fr: 'Pronoms', de: 'Pronomina', it: 'Pronomi', es: 'Pronombres' } },
    { key: 'government', group: 'forms', line: 'inflection', icon: 'link', title: 'Verb + preposition',
      notes: { fr: 'Construction du verbe', it: 'Reggenza', es: 'Régimen preposicional' } },
    { key: 'kasusRektion', group: 'forms', line: 'inflection', icon: 'info', title: 'Case government',
      notes: { de: 'Kasus & Rektion' } },
    { key: 'trennbarePraefixe', group: 'forms', line: 'inflection', icon: 'branch',
      title: 'Separable prefixes', notes: { de: 'Trennbare Präfixe' } },

    /* ---------- Roots ----------
       The semantic core, expressed the way each language family thinks of it. */
    { key: 'core', group: 'dna', line: 'etymology', icon: 'target', title: 'Semantic core',
      notes: { fr: 'Noyau sémantique', de: 'Semantischer Kern', it: 'Nucleo semantico', es: 'Núcleo semántico' } },
    { key: 'nuance', group: 'dna', line: 'etymology', icon: 'target', title: 'Nuance', notes: { ja: '語感' } },
    { key: 'originalSense', group: 'dna', line: 'etymology', icon: 'target', title: 'Original sense', notes: { zh: '本义与引申' } },

    /* history and form */
    { key: 'etymology', group: 'dna', line: 'etymology', icon: 'hourglass', title: 'Etymology',
      notes: { fr: 'Étymologie', de: 'Etymologie', it: 'Etimologia', es: 'Etimología', ja: '語源' } },
    { key: 'kanjiOrigin', group: 'dna', line: 'etymology', icon: 'hourglass', title: 'Kanji origin', notes: { ja: '漢字の成り立ち' } },
    { key: 'characterEvolution', group: 'dna', line: 'etymology', icon: 'hourglass', title: 'Character evolution', notes: { zh: '字源演变' } },
    { key: 'components', group: 'dna', line: 'etymology', icon: 'branch', title: 'Components', notes: { ja: '字形分解', zh: '字形分解' } },
    { key: 'morphology', group: 'dna', line: 'etymology', icon: 'branch', title: 'Morphology',
      notes: { fr: 'Morphologie', de: 'Morphologie', it: 'Morfologia', es: 'Morfología' } },
    { key: 'wordFormation', group: 'meaning', line: 'etymology', icon: 'branch', title: 'Word formation', notes: { zh: '构词分解' } },
    { key: 'komposita', group: 'dna', line: 'etymology', icon: 'network', title: 'Compounds', notes: { de: 'Komposita' } },
    { key: 'rootFamily', group: 'dna', line: 'etymology', icon: 'network', title: 'Root family',
      notes: { fr: 'Famille de mots', de: 'Wortfamilie', it: 'Famiglia di parole', es: 'Familia de palabras' } },
    { key: 'falseCognates', group: 'dna', line: 'etymology', icon: 'shield', title: 'False cognates',
      notes: { fr: 'Faux amis', de: 'Falsche Freunde', it: 'Falsi amici', es: 'Falsos amigos' } },
    { key: 'readings', group: 'dna', line: 'etymology', icon: 'quote', title: 'Readings', notes: { ja: '読み' } },
    { key: 'wordStratum', group: 'dna', line: 'etymology', icon: 'museum', title: 'Word stratum', notes: { ja: '語種' } },
    { key: 'multipleReadings', group: 'dna', line: 'etymology', icon: 'quote', title: 'Multiple readings', notes: { zh: '多音字' } },

    /* word building */
    { key: 'pronunciation', group: 'dna', line: 'etymology', icon: 'speaker', title: 'Pronunciation',
      notes: { fr: 'Prononciation', de: 'Aussprache', it: 'Pronuncia', es: 'Pronunciación' } },

    /* ---------- Culture ---------- */
    { key: 'doublets', group: 'context', line: 'distinction', icon: 'network', title: 'Doublets', notes: { it: 'Doppioni' } },
    { key: 'lautverschiebung', group: 'context', line: 'distinction', icon: 'shield', title: 'Sound shift', notes: { de: 'Lautverschiebung' } },
    { key: 'arabismos', group: 'context', line: 'distinction', icon: 'museum', title: 'Arabisms', notes: { es: 'Arabismos' } },
    { key: 'sourceWord', group: 'dna', line: 'distinction', icon: 'link', title: 'Source word', notes: { ja: '原詞' } },
    { key: 'spellingVariants', group: 'dna', line: 'distinction', icon: 'close', title: 'Spelling variants', notes: { ja: '表記のゆれ' } },
    { key: 'originAllusion', group: 'context', line: 'distinction', icon: 'museum', title: 'Origin & allusion', notes: { zh: '出处典故' } },
    { key: 'culture', group: 'context', line: 'distinction', icon: 'museum', title: 'Culture',
      notes: { fr: 'Culture', de: 'Kultur', it: 'Cultura', es: 'Cultura' } },
    { key: 'synthesis', group: 'context', line: 'distinction', icon: 'quote', title: 'Synthesis',
      notes: { fr: 'Synthèse', de: 'Zusammenfassung', it: 'Sintesi', es: 'Síntesis', ja: 'まとめ', zh: '小结' } },
    { key: 'mnemonic', group: 'context', line: 'distinction', icon: 'sparkle', title: 'Mnemonic',
      notes: { fr: 'Moyen mnémotechnique', de: 'Eselsbrücke', it: 'Trucco mnemonico', es: 'Regla mnemotécnica', ja: '覚え方', zh: '记忆法' } }
  ];

  /* ---------- Sentence analysis cards ---------- */

  var SENTENCE_CARDS = [
    { key: 'translation', group: 'meaning', line: 'semantics', icon: 'quote', title: 'Translation', required: true,
      notes: { fr: 'Traduction', de: 'Übersetzung', it: 'Traduzione', es: 'Traducción', ja: '訳', zh: '翻译' } },
    { key: 'wordByWord', group: 'meaning', line: 'semantics', icon: 'list', title: 'Word by word', required: true,
      notes: { fr: 'Mot à mot', de: 'Wort für Wort', it: 'Parola per parola', es: 'Palabra por palabra', ja: '逐語', zh: '逐词' } },
    { key: 'chunks', group: 'meaning', line: 'semantics', icon: 'link', title: 'Chunks & idioms',
      notes: { fr: 'Expressions figées', de: 'Feste Wendungen', it: 'Espressioni fisse', es: 'Expresiones fijas', ja: '慣用句', zh: '固定搭配' } },
    { key: 'structure', group: 'grammar', line: 'grammar', icon: 'branch', title: 'Structure',
      notes: { fr: 'Structure', de: 'Struktur', it: 'Struttura', es: 'Estructura', ja: '構造', zh: '结构' } },
    { key: 'grammar', group: 'grammar', line: 'grammar', icon: 'info', title: 'Grammar', required: true,
      notes: { fr: 'Grammaire', de: 'Grammatik', it: 'Grammatica', es: 'Gramática', ja: '文法', zh: '语法' } },
    { key: 'register', group: 'grammar', line: 'grammar', icon: 'museum', title: 'Register & nuance',
      notes: { fr: 'Registre', de: 'Register', it: 'Registro', es: 'Registro', ja: '文体', zh: '语域' } },
    { key: 'pitfalls', group: 'grammar', line: 'grammar', icon: 'alert', title: 'Pitfalls',
      notes: { fr: 'Pièges', de: 'Stolpersteine', it: 'Insidie', es: 'Trampas', ja: '注意点', zh: '易错点' } },
    { key: 'pattern', group: 'grammar', line: 'grammar', icon: 'sparkle', title: 'Pattern', required: true,
      notes: { fr: 'Structure réutilisable', de: 'Satzmuster', it: 'Struttura riutilizzabile', es: 'Estructura reutilizable', ja: '文型', zh: '句式模板' } },
    { key: 'culture', group: 'grammar', line: 'grammar', icon: 'museum', title: 'Culture',
      notes: { fr: 'Culture', de: 'Kultur', it: 'Cultura', es: 'Cultura', ja: '文化', zh: '文化' } }
  ];

  /* ---------- Request lines ----------
     One parallel request per line. `inflection` is the 4.1 addition and is
     only asked of the five languages that actually inflect. */

  var DEEP_LINES = ['etymology', 'usage', 'inflection', 'distinction'];

  /* Japanese keeps its conjugation card — a verb ending table is exactly what a
     learner of Japanese needs — but that data has always come back with the
     usage line, so the card stays pointed at it rather than at a line that does
     not run for Japanese. */
  var CARD_LINE_OVERRIDES = { ja: { conjugation: 'usage' } };

  /* ---------- Reading order ----------
     The product's angle is that a word is understood through its roots, so the
     Word DNA block leads and the definitions follow — a learner reads where the
     word came from and how it is built before reading what it means. Each
     language family gets its own order because the material differs: the
     Romance and Germanic languages have a PIE-to-modern chain and a cognate
     family, Japanese has 語種 and 字源, Chinese has 本义 and 字形.

     These lists are the reading order, not the full catalogue: any card not
     Each list names all forty-two cards so the order is fully determined and
     each section stays in one piece. The cards a family never fills simply
     have no data and never render — they sit at the end of their section,
     where they cost nothing. `cardOrder` above stays the full catalogue so
     completeness can still be checked in one place. */
  var CARD_ORDER_FAMILY = {
    latin: [
      /* Word DNA */
      'core', 'etymology', 'morphology', 'komposita', 'rootFamily', 'pronunciation', 'falseCognates',
      'nuance', 'originalSense', 'kanjiOrigin', 'characterEvolution', 'components', 'readings',
      'wordStratum', 'multipleReadings', 'sourceWord', 'spellingVariants',
      /* Meaning */
      'senses', 'collocations', 'usage', 'confusables', 'serEstar',
      'classicalVsModern', 'classicalUsage', 'thenAndNow', 'wordFormation',
      /* Forms */
      'wordProfile', 'nounForms', 'adjectiveForms', 'conjugation', 'comparison', 'pronouns',
      'government', 'kasusRektion', 'trennbarePraefixe',
      /* Context */
      'lautverschiebung', 'doublets', 'arabismos', 'originAllusion', 'culture', 'synthesis', 'mnemonic'
    ],
    ja: [
      /* What kind of word it is, where the characters came from, how it is read */
      'nuance', 'wordStratum', 'kanjiOrigin', 'components', 'readings', 'sourceWord', 'spellingVariants',
      'core', 'originalSense', 'etymology', 'characterEvolution', 'morphology', 'komposita',
      'rootFamily', 'falseCognates', 'multipleReadings', 'pronunciation',
      'senses', 'collocations', 'usage', 'confusables', 'wordFormation',
      'classicalVsModern', 'classicalUsage', 'thenAndNow', 'serEstar',
      'conjugation', 'wordProfile', 'nounForms', 'adjectiveForms', 'comparison', 'pronouns',
      'government', 'kasusRektion', 'trennbarePraefixe',
      'culture', 'synthesis', 'mnemonic', 'lautverschiebung', 'doublets', 'arabismos', 'originAllusion'
    ],
    zh: [
      /* 本义 → 字源 → 字形 → 读音 */
      'originalSense', 'characterEvolution', 'components', 'multipleReadings',
      'nuance', 'core', 'etymology', 'kanjiOrigin', 'morphology', 'komposita', 'rootFamily',
      'falseCognates', 'readings', 'wordStratum', 'pronunciation', 'sourceWord', 'spellingVariants',
      'senses', 'collocations', 'usage', 'wordFormation',
      'classicalVsModern', 'classicalUsage', 'thenAndNow', 'confusables', 'serEstar',
      'wordProfile', 'nounForms', 'adjectiveForms', 'conjugation', 'comparison', 'pronouns',
      'government', 'kasusRektion', 'trennbarePraefixe',
      'originAllusion', 'culture', 'synthesis', 'mnemonic', 'lautverschiebung', 'doublets', 'arabismos'
    ]
  };

  var FAMILY_OF_LANGUAGE = { zh: 'zh', ja: 'ja' };

  function languageMeta(id) {
    for (var i = 0; i < LANGUAGES.length; i += 1) {
      if (LANGUAGES[i].id === id) return LANGUAGES[i];
    }
    return null;
  }

  /* A language can come back as an id, an English name or a native name. The
     prompts ask for the id, but a model answering "Japanese" or "日本語" must
     not cost the entry its classification. Anything else — including "auto",
     which is a picker state and not a language — is not a language. */
  function languageByAnyName(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return '';
    var lower = text.toLowerCase();
    for (var i = 0; i < LANGUAGES.length; i += 1) {
      var lang = LANGUAGES[i];
      if (lower === lang.id) return lang.id;
      if (lower === lang.label.toLowerCase()) return lang.id;
      if (lower === String(lang.native).toLowerCase()) return lang.id;
    }
    return '';
  }

  ns.CONFIG = {
    appName: 'Radicle',
    tagline: 'The roots of words',
    description: "A linguist's dictionary: meaning, usage, etymology, word roots and cultural depth.",
    version: '5.0.0',

    /* Bumped whenever the stored entry shape changes. */
    schemaVersion: 4,

    api: {
      endpoint: 'https://api.deepseek.com/chat/completions',
      /* Measured on 2026-10-14, two real lookups (aller/fr, Gift/de) with the
         four-line set: slowest single line 7.3s, whole set 7.1–7.3s wall
         clock. 45s keeps a six-fold margin while cutting the worst case a user
         can be left waiting on a hung request. */
      timeoutMs: 45000,
      maxAttemptsOnRateLimit: 2,
      retryBackoffMs: 1200
    },

    maxTokens: {
      overview: 700,
      etymology: 3200,
      /* The grammar cards moved to their own line, so this one shrank. */
      usage: 1800,
      /* The biggest payload in the app. Measured: a French verb with seven
         tenses came back at ~1136 tokens; a German noun at ~388. The ceiling
         is headroom against truncation, so it stays well above both. */
      inflection: 4500,
      distinction: 2000,
      candidate: 900,
      surprise: 300,
      /* One tiny question — "what language is this?" — asked once for a sentence
         or for an old entry that never recorded one. */
      detect: 60,
      sentenceSemantics: 2400,
      sentenceGrammar: 2400
    },

    languages: LANGUAGES,
    /* The languages a picker may offer. */
    queryLanguages: QUERY_LANGUAGES,
    /* The languages an explanation may be written in — the same set. */
    outputLanguages: QUERY_LANGUAGES,
    defaultOutputLang: 'zh',
    autoLang: 'auto',
    autoLabel: 'Auto',

    /* What each source language is explained in. The user sets one row per
       language in Profile; this is only the shape of the default. */
    defaultOutputLangBySource: { en: 'en', fr: 'fr', de: 'de', ja: 'zh', zh: 'zh' },

    cardLines: CARDS.reduce(function (map, card) {
      map[card.key] = card.line;
      return map;
    }, {}),
    /* The line a card's data comes from, which is the card's own line except
       where a language routes it elsewhere. */
    lineFor: function (key, language) {
      var overrides = CARD_LINE_OVERRIDES[language];
      if (overrides && overrides[key]) return overrides[key];
      var card = this.cardCatalog[key];
      return card ? card.line : '';
    },
    cardGroups: CARDS.reduce(function (map, card) {
      map[card.key] = card.group;
      return map;
    }, {}),
    cardOrder: CARDS.map(function (card) { return card.key; }),
    /* The reading order for a language. Anything not named in the family list
       is appended in catalogue order, so the result is always a permutation of
       the whole catalogue — a card merely has no data and does not render. */
    cardOrderFor: function (language) {
      var family = CARD_ORDER_FAMILY[FAMILY_OF_LANGUAGE[language] || 'latin'];
      var seen = {};
      var order = [];
      family.forEach(function (key) {
        if (seen[key] || !this.catalog[key]) return;
        seen[key] = true;
        order.push(key);
      }, { catalog: this.cardCatalog });
      this.cardOrder.forEach(function (key) {
        if (seen[key]) return;
        seen[key] = true;
        order.push(key);
      });
      return order;
    },
    cardCatalog: CARDS.reduce(function (map, card) {
      map[card.key] = card;
      return map;
    }, {}),

    groups: GROUPS,
    sentenceGroups: SENTENCE_GROUPS,

    deepLines: DEEP_LINES,
    /* Whether a language has paradigms at all. An unresolved language — the
       picker is on Auto and the overview has not answered yet — is assumed to
       inflect, because a line that was never requested can never be retried. */
    inflects: function (language) {
      var meta = languageMeta(language);
      if (!meta) return true;
      return meta.inflects !== false;
    },
    /* '' when the value is not one of the seven. */
    languageByAnyName: languageByAnyName,
    deepLinesFor: function (language) {
      if (ns.CONFIG.inflects(language)) return DEEP_LINES;
      return DEEP_LINES.filter(function (line) { return line !== 'inflection'; });
    },
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

    /* Deciding whether the input is a headword or a sentence. The heuristic
       runs first because it costs nothing; when it guesses "word" and the model
       disagrees, lookup falls back to sentence analysis. */
    sentenceHeuristic: {
      enders: ['.', '!', '?', '。', '！', '？', '…'],
      maxWords: 4,
      maxChars: 4
    },

    limits: {
      maxHistory: 500,
      maxInputLength: 64,
      maxExpressionWords: 4,
      maxSentenceLength: 400,
      practiceRound: 5,
      maxWordbooks: 50,
      maxWordbookName: 40
    }
  };

  ns.STORAGE_PREFIX = 'dict5';

  ns.STORAGE = {
    settings: ns.STORAGE_PREFIX + '.settings',
    history: ns.STORAGE_PREFIX + '.history',
    entryPrefix: ns.STORAGE_PREFIX + '.entry.',
    wordbooks: ns.STORAGE_PREFIX + '.wordbooks',
    /* Set once the 4.x data has been offered for import, so the prompt never
       comes back — even if the user declined. */
    imported: ns.STORAGE_PREFIX + '.imported'
  };

  /* The version folder whose data can be imported. 5.0 starts on a fresh
     prefix, so nothing is ever rewritten in place: this is a one-way read. */
  ns.IMPORT_SOURCES = [
    { prefix: 'dict4', label: '4.x' },
    { prefix: 'dict3', label: '3.x' }
  ];

  ns.DEFAULT_SETTINGS = {
    apiKey: '',
    /* The fallback explanation language: used when the source language is not
       known yet, and for entries whose language has no row of its own. */
    outputLang: ns.CONFIG.defaultOutputLang,
    /* One explanation language per source language — looking up an English
       word can explain in English, a Japanese one in Chinese. */
    outputLangBySource: ns.CONFIG.defaultOutputLangBySource,
    /* 'auto' follows the browser; otherwise one of the five active languages.
       The interface language has nothing to do with the explanation language;
       they are two independent axes. */
    uiLang: 'auto',
    /* The first-run tour runs once; it lives in settings so a backup carries
       the fact that it has been seen. */
    tourDone: false,
    /* 'auto' or one of the language ids. */
    queryLang: ns.CONFIG.autoLang,
    /* 'auto' | 'word' | 'sentence' */
    queryMode: 'auto',
    model: ns.CONFIG.defaultModel,
    theme: ns.CONFIG.defaultTheme
  };

  /* Shared cross-view session state. In-memory only. */
  ns.session = {
    query: '',
    filter: 'all',
    mode: 'auto',
    pending: null,
    candidates: null,
    /* The line shown for a moment after Surprise me picks something. */
    surprise: null,
    favoritesSource: 'all',
    focusSearch: false,
    /* Which history days and which favourite groups are folded shut. Both are
       empty on load, so everything starts expanded. */
    collapsedDays: {},
    collapsedGroups: {}
  };
})(window.RADICLE);
