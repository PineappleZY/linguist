/* LINGUIST — constants and shared configuration.

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

window.LINGUIST = window.LINGUIST || {};

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
      notes: { fr: 'Construction du verbe', de: 'Verb + Präposition', it: 'Reggenza', es: 'Régimen preposicional' } },
    { key: 'kasusRektion', group: 'forms', line: 'inflection', icon: 'info', title: 'Case government',
      notes: { de: 'Kasus & Rektion' } },
    { key: 'trennbarePraefixe', group: 'forms', line: 'inflection', icon: 'branch',
      title: 'Separable prefixes', notes: { de: 'Trennbare Präfixe' } },

    /* ---------- Roots ----------
       The centre of the word's meaning, expressed the way each language family
       thinks of it. `core` used to ask for a metaphor, which duplicated the
       mnemonic card and answered a question nobody had asked: what a learner
       needs here is the precise central sense, with the detail that does not
       belong in the one-line definitions of the Senses card. */
    { key: 'core', group: 'dna', line: 'etymology', icon: 'target', title: 'Core meaning',
      notes: { fr: 'Sens central', de: 'Kernbedeutung', it: 'Senso centrale', es: 'Sentido central',
        ja: '核心義', zh: '核心义' } },
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
      notes: { fr: 'Prononciation', de: 'Aussprache', it: 'Pronuncia', es: 'Pronunciación', ja: '発音' } },

    /* ---------- Culture ---------- */
    { key: 'doublets', group: 'context', line: 'distinction', icon: 'network', title: 'Doublets',
      notes: { fr: 'Doublets', it: 'Doppioni' } },
    { key: 'lautverschiebung', group: 'context', line: 'distinction', icon: 'shield', title: 'Sound shift', notes: { de: 'Lautverschiebung' } },
    { key: 'sourceWord', group: 'dna', line: 'distinction', icon: 'link', title: 'Source word', notes: { ja: '原詞' } },
    { key: 'spellingVariants', group: 'dna', line: 'distinction', icon: 'close', title: 'Spelling variants', notes: { ja: '表記のゆれ' } },
    { key: 'originAllusion', group: 'context', line: 'distinction', icon: 'museum', title: 'Origin & allusion', notes: { zh: '出处典故' } },
    { key: 'culture', group: 'context', line: 'distinction', icon: 'museum', title: 'Culture',
      notes: { fr: 'Culture', de: 'Kultur', it: 'Cultura', es: 'Cultura', ja: '文化', zh: '文化' } },
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

  /* ---------- Document cards ----------
     Reading a file is one line of work, not four: every chunk request returns
     all four fields at once, because four parallel requests per chunk would
     multiply the cost of a 200,000-character document by four. The cards share
     the single `document` line, so the existing "a failed line reports once, at
     its first card" rule covers them without any special case. */

  var DOCUMENT_CARDS = [
    { key: 'summary', group: 'document', line: 'document', icon: 'list', title: 'Summary', required: true,
      notes: { fr: 'Résumé', de: 'Zusammenfassung', it: 'Sintesi', es: 'Resumen', ja: '要約', zh: '概要' } },
    { key: 'translation', group: 'document', line: 'document', icon: 'quote', title: 'Translation', required: true,
      notes: { fr: 'Traduction', de: 'Übersetzung', it: 'Traduzione', es: 'Traducción', ja: '翻訳', zh: '翻译' } },
    { key: 'vocabulary', group: 'document', line: 'document', icon: 'book', title: 'Vocabulary', required: true,
      notes: { fr: 'Vocabulaire', de: 'Wortschatz', it: 'Lessico', es: 'Vocabulario', ja: '語彙', zh: '词汇表' } },
    { key: 'register', group: 'document', line: 'document', icon: 'museum', title: 'Register & genre', required: true,
      notes: { fr: 'Registre et genre', de: 'Register und Textsorte', it: 'Registro e genere',
        es: 'Registro y género', ja: '文体とジャンル', zh: '文体与体裁' } }
  ];

  var DOCUMENT_GROUPS = [
    { id: 'document', labelKey: 'group.document' }
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
      'senses', 'collocations', 'usage', 'confusables',
      'classicalVsModern', 'classicalUsage', 'thenAndNow', 'wordFormation',
      /* Forms */
      'wordProfile', 'nounForms', 'adjectiveForms', 'conjugation', 'comparison', 'pronouns',
      'government', 'kasusRektion', 'trennbarePraefixe',
      /* Context */
      'lautverschiebung', 'doublets', 'originAllusion', 'culture', 'synthesis', 'mnemonic'
    ],
    ja: [
      /* What kind of word it is, where the characters came from, how it is read */
      'nuance', 'wordStratum', 'kanjiOrigin', 'components', 'readings', 'sourceWord', 'spellingVariants',
      'core', 'originalSense', 'etymology', 'characterEvolution', 'morphology', 'komposita',
      'rootFamily', 'falseCognates', 'multipleReadings', 'pronunciation',
      'senses', 'collocations', 'usage', 'confusables', 'wordFormation',
      'classicalVsModern', 'classicalUsage', 'thenAndNow',
      'conjugation', 'wordProfile', 'nounForms', 'adjectiveForms', 'comparison', 'pronouns',
      'government', 'kasusRektion', 'trennbarePraefixe',
      'culture', 'synthesis', 'mnemonic', 'lautverschiebung', 'doublets', 'originAllusion'
    ],
    zh: [
      /* 本义 → 字源 → 字形 → 读音 */
      'originalSense', 'characterEvolution', 'components', 'multipleReadings',
      'nuance', 'core', 'etymology', 'kanjiOrigin', 'morphology', 'komposita', 'rootFamily',
      'falseCognates', 'readings', 'wordStratum', 'pronunciation', 'sourceWord', 'spellingVariants',
      'senses', 'collocations', 'usage', 'wordFormation',
      'classicalVsModern', 'classicalUsage', 'thenAndNow', 'confusables',
      'wordProfile', 'nounForms', 'adjectiveForms', 'conjugation', 'comparison', 'pronouns',
      'government', 'kasusRektion', 'trennbarePraefixe',
      'originAllusion', 'culture', 'synthesis', 'mnemonic', 'lautverschiebung', 'doublets'
    ]
  };

  var FAMILY_OF_LANGUAGE = { zh: 'zh', ja: 'ja' };

  /* ---------- What each card is called, per interface language ----------
     The entry page keeps its "English · native term" title on purpose — that
     pairing is the learning device. This table exists for the one screen where
     a reader is choosing between cards rather than reading one: Profile →
     Cards, which is written in the interface language like everything else
     around it.

     Wherever a card already carries a native term in `notes`, that term is
     reused here, so the name in the list is the same string a reader sees as
     the second half of the entry's card title. */
  var CARD_TITLES = {
    /* Meaning */
    senses: { en: 'Senses', zh: '义项', fr: 'Sens', de: 'Bedeutungen', ja: '語義' },
    collocations: { en: 'Collocations', zh: '搭配', fr: 'Collocations', de: 'Kollokationen', ja: 'コロケーション' },
    usage: { en: 'Usage', zh: '用法', fr: 'Emploi', de: 'Gebrauch', ja: '用法' },
    confusables: { en: 'Confusables', zh: '近义词辨析', fr: 'Confusions', de: 'Verwechslungen', ja: '類義語の使い分け' },
    classicalVsModern: { en: 'Classical vs modern', zh: '古今异义', fr: 'Sens classique et moderne', de: 'Klassisch und modern', ja: '古今異義' },
    classicalUsage: { en: 'Classical usage', zh: '古汉语用法', fr: 'Emploi classique', de: 'Klassischer Gebrauch', ja: '古漢語の用法' },
    thenAndNow: { en: 'Then and now', zh: '本义与今义', fr: "Sens d'hier et d'aujourd'hui", de: 'Damals und heute', ja: '本義と今義' },
    wordFormation: { en: 'Word formation', zh: '构词分解', fr: 'Formation du mot', de: 'Wortbildung', ja: '語構成' },

    /* Forms */
    wordProfile: { en: 'Word profile', zh: '词类档案', fr: 'Fiche du mot', de: 'Wortprofil', ja: '語のプロフィール' },
    nounForms: { en: 'Noun forms', zh: '名词形式', fr: 'Formes du nom', de: 'Substantivformen', ja: '名詞の形' },
    adjectiveForms: { en: 'Adjective forms', zh: '形容词形式', fr: "Formes de l'adjectif", de: 'Adjektivdeklination', ja: '形容詞の形' },
    conjugation: { en: 'Conjugation', zh: '变位', fr: 'Conjugaison', de: 'Konjugation', ja: '活用' },
    comparison: { en: 'Comparison', zh: '比较级与最高级', fr: 'Comparatif et superlatif', de: 'Steigerung', ja: '比較級・最上級' },
    pronouns: { en: 'Pronouns', zh: '代词', fr: 'Pronoms', de: 'Pronomina', ja: '代名詞' },
    government: { en: 'Verb + preposition', zh: '动词与介词搭配', fr: 'Construction du verbe', de: 'Verb + Präposition', ja: '動詞の格支配' },
    kasusRektion: { en: 'Case government', zh: '格与支配', fr: 'Régime casuel', de: 'Kasus & Rektion', ja: '格支配' },
    trennbarePraefixe: { en: 'Separable prefixes', zh: '可分前缀', fr: 'Préfixes séparables', de: 'Trennbare Präfixe', ja: '分離前綴り' },

    /* Roots */
    core: { en: 'Core meaning', zh: '核心义', fr: 'Sens central', de: 'Kernbedeutung', ja: '核心義' },
    nuance: { en: 'Nuance', zh: '语感', fr: 'Nuance', de: 'Nuance', ja: '語感' },
    originalSense: { en: 'Original sense', zh: '本义与引申', fr: 'Sens originel', de: 'Ursprüngliche Bedeutung', ja: '本義と派生' },
    etymology: { en: 'Etymology', zh: '词源', fr: 'Étymologie', de: 'Etymologie', ja: '語源' },
    kanjiOrigin: { en: 'Kanji origin', zh: '汉字字源', fr: 'Origine du kanji', de: 'Kanji-Herkunft', ja: '漢字の成り立ち' },
    characterEvolution: { en: 'Character evolution', zh: '字源演变', fr: 'Évolution du caractère', de: 'Zeichenentwicklung', ja: '字源の変遷' },
    components: { en: 'Components', zh: '字形分解', fr: 'Composants', de: 'Bestandteile', ja: '字形分解' },
    morphology: { en: 'Morphology', zh: '构词形态', fr: 'Morphologie', de: 'Morphologie', ja: '形態論' },
    komposita: { en: 'Compounds', zh: '复合词', fr: 'Composés', de: 'Komposita', ja: '複合語' },
    rootFamily: { en: 'Root family', zh: '同根词族', fr: 'Famille de mots', de: 'Wortfamilie', ja: '同根語' },
    falseCognates: { en: 'False cognates', zh: '假同源词', fr: 'Faux amis', de: 'Falsche Freunde', ja: '紛らわしい語' },
    readings: { en: 'Readings', zh: '读音', fr: 'Lectures', de: 'Lesungen', ja: '読み' },
    wordStratum: { en: 'Word stratum', zh: '语种', fr: 'Couche lexicale', de: 'Wortschicht', ja: '語種' },
    multipleReadings: { en: 'Multiple readings', zh: '多音字', fr: 'Lectures multiples', de: 'Mehrere Lesungen', ja: '多音字' },
    pronunciation: { en: 'Pronunciation', zh: '发音', fr: 'Prononciation', de: 'Aussprache', ja: '発音' },
    sourceWord: { en: 'Source word', zh: '原词', fr: "Mot d'origine", de: 'Ursprungswort', ja: '原詞' },
    spellingVariants: { en: 'Spelling variants', zh: '写法变体', fr: 'Variantes orthographiques', de: 'Schreibvarianten', ja: '表記のゆれ' },

    /* Culture */
    doublets: { en: 'Doublets', zh: '双式词', fr: 'Doublets', de: 'Dubletten', ja: '二重語' },
    lautverschiebung: { en: 'Sound shift', zh: '音变', fr: 'Mutation consonantique', de: 'Lautverschiebung', ja: '音韻推移' },
    originAllusion: { en: 'Origin & allusion', zh: '出处典故', fr: 'Origine et allusion', de: 'Herkunft und Anspielung', ja: '出典と故事' },
    culture: { en: 'Culture', zh: '文化', fr: 'Culture', de: 'Kultur', ja: '文化' },
    synthesis: { en: 'Synthesis', zh: '小结', fr: 'Synthèse', de: 'Zusammenfassung', ja: 'まとめ' },
    mnemonic: { en: 'Mnemonic', zh: '记忆法', fr: 'Moyen mnémotechnique', de: 'Eselsbrücke', ja: '覚え方' },

    /* Sentence analysis */
    translation: { en: 'Translation', zh: '翻译', fr: 'Traduction', de: 'Übersetzung', ja: '訳' },
    wordByWord: { en: 'Word by word', zh: '逐词', fr: 'Mot à mot', de: 'Wort für Wort', ja: '逐語' },
    chunks: { en: 'Chunks & idioms', zh: '固定搭配', fr: 'Expressions figées', de: 'Feste Wendungen', ja: '慣用句' },
    structure: { en: 'Structure', zh: '结构', fr: 'Structure', de: 'Struktur', ja: '構造' },
    grammar: { en: 'Grammar', zh: '语法', fr: 'Grammaire', de: 'Grammatik', ja: '文法' },
    register: { en: 'Register & nuance', zh: '语域', fr: 'Registre', de: 'Register', ja: '文体' },
    pitfalls: { en: 'Pitfalls', zh: '易错点', fr: 'Pièges', de: 'Stolpersteine', ja: '注意点' },
    pattern: { en: 'Pattern', zh: '句式模板', fr: 'Structure réutilisable', de: 'Satzmuster', ja: '文型' }
  };

  /* A card's name in one interface language, with two fallbacks: the native
     term the entry page already uses, then the English title. The list can
     therefore never show a missing or empty name. */
  function cardTitleFor(card, uiLang) {
    if (!card) return '';
    var row = CARD_TITLES[card.key];
    if (row && row[uiLang]) return row[uiLang];
    if (card.notes && card.notes[uiLang]) return card.notes[uiLang];
    return card.title;
  }

  /* ---------- Which languages can actually fill a card ----------
     Derived from the shape of each language's deep prompts, not guessed: a card
     that a language never asks for cannot appear in an entry in that language,
     and listing it in Profile → Cards is noise. Italian and Spanish stay in the
     table because imported entries from 5.x still render, but they are no longer
     in any group's picker, so they no longer decide what is listed. */
  var LATIN_LANGS = ['en', 'fr', 'de', 'it', 'es'];
  var ALL_LANGS = ['en', 'fr', 'de', 'it', 'es', 'ja', 'zh'];

  var CARD_LANGS = {
    /* Every language produces these. */
    senses: ALL_LANGS, collocations: ALL_LANGS, usage: ALL_LANGS, confusables: ALL_LANGS,
    culture: ALL_LANGS, synthesis: ALL_LANGS, mnemonic: ALL_LANGS,

    /* The root line, for the languages that have one. */
    core: LATIN_LANGS,
    etymology: LATIN_LANGS.concat(['ja']),
    morphology: LATIN_LANGS,
    rootFamily: LATIN_LANGS,
    falseCognates: LATIN_LANGS,
    pronunciation: LATIN_LANGS.concat(['ja']),

    /* Forms: French, German and the Latin-script languages that inflect;
       Japanese conjugates too, through the usage line. */
    wordProfile: LATIN_LANGS,
    nounForms: LATIN_LANGS,
    adjectiveForms: LATIN_LANGS,
    comparison: LATIN_LANGS,
    pronouns: LATIN_LANGS,
    government: LATIN_LANGS,
    conjugation: LATIN_LANGS.concat(['ja']),

    /* One language each. */
    doublets: ['fr', 'it'],
    komposita: ['de'],
    kasusRektion: ['de'],
    trennbarePraefixe: ['de'],
    lautverschiebung: ['de'],
    nuance: ['ja'],
    wordStratum: ['ja'],
    kanjiOrigin: ['ja'],
    readings: ['ja'],
    sourceWord: ['ja'],
    spellingVariants: ['ja'],
    components: ['ja', 'zh'],
    originalSense: ['zh'],
    characterEvolution: ['zh'],
    multipleReadings: ['zh'],
    classicalVsModern: ['zh'],
    classicalUsage: ['zh'],
    thenAndNow: ['zh'],
    wordFormation: ['zh'],
    originAllusion: ['zh']
  };

  function cardLangs(key) {
    return (CARD_LANGS[key] || []).slice();
  }

  /* The languages a preference group is responsible for. The sentence group is
     not language-bound, so it gets `null` and its list is not filtered. */
  function groupCardLangs(group) {
    if (group === 'ja') return ['ja'];
    if (group === 'zh') return ['zh'];
    if (group === 'latin') return ['en', 'fr', 'de'];
    return null;
  }

  /* ---------- Card preferences ----------
     Four groups: the three reading families plus the sentence page. A
     preference is { order: [keys], hidden: [keys] } — the shipped reading order
     is the default, so an empty preference reproduces exactly what 5.0 showed.
     A key the catalogue no longer knows (a card that was renamed or retired) is
     ignored instead of corrupting the list. */
  var CARD_PREF_GROUPS = ['latin', 'ja', 'zh', 'sentence'];

  function familyOf(language) { return FAMILY_OF_LANGUAGE[language] || 'latin'; }

  function baseOrderFor(group) {
    if (group === 'sentence') return SENTENCE_CARDS.map(function (card) { return card.key; });
    return CARD_ORDER_FAMILY[group] || CARD_ORDER_FAMILY.latin;
  }

  /* Pure: the sequence and the hidden set a group renders with. Exported so the
     rule can be tested without a browser, and so Profile and the entry page
     cannot drift apart. */
  function resolveCardPrefs(group, prefs) {
    var base = baseOrderFor(group);
    var known = {};
    base.forEach(function (key) { known[key] = true; });
    var pref = prefs && prefs[group] && typeof prefs[group] === 'object' ? prefs[group] : {};
    var seen = {};
    var order = [];
    (Array.isArray(pref.order) ? pref.order : []).forEach(function (key) {
      if (!known[key] || seen[key]) return;
      seen[key] = true;
      order.push(key);
    });
    base.forEach(function (key) {
      if (seen[key]) return;
      seen[key] = true;
      order.push(key);
    });
    var hidden = {};
    (Array.isArray(pref.hidden) ? pref.hidden : []).forEach(function (key) {
      if (known[key]) hidden[key] = true;
    });
    return { order: order, hidden: hidden };
  }

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
    appName: 'Linguist',
    /* The name is not translated: every language shows "Linguist". It is also
       what the offline file, the cache name and the backup kind are derived
       from, so it has to be one string and it has to be ASCII. The description
       below it IS translated — see strings.js. */
    taglineKey: 'app.tagline',
    descriptionKey: 'app.description',
    version: '7.2.0',

    /* Bumped whenever the stored entry shape changes. */
    schemaVersion: 8,

    api: {
      endpoint: 'https://api.deepseek.com/chat/completions',
      /* Measured on 2026-10-14, two real lookups (aller/fr, Gift/de) with the
         four-line set: slowest single line 7.3s, whole set 7.1–7.3s wall
         clock. 45s keeps a six-fold margin while cutting the worst case a user
         can be left waiting on a hung request. */
      timeoutMs: 45000,
      /* A document part is a different animal, and this is measured rather than
         assumed: 2026-10-16, a 44,885-character German text split into three
         parts, each part answered in 23.8s / 24.2s / 14.3s with ~10,000
         characters of output. Against a 45s ceiling that is a 1.9× margin on
         the slowest request, which is not a margin — a denser chunk or a
         busier server would time out a request the reader has already waited
         20 seconds for. 90s restores a comfortable margin for the one request
         type that legitimately takes this long; word and sentence lookups keep
         the 45s above. */
      documentTimeoutMs: 90000,
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
      surprisePool: 6000,
      discovery: 900,
      /* One tiny question — "what language is this?" — asked once for a sentence
         or for an old entry that never recorded one. */
      detect: 60,
      sentenceSemantics: 2400,
      sentenceGrammar: 2400,
      /* One chunk of a document: four fields at once. Measured 2026-10-16 on a
         16,000-character part: 10,153 characters of output with finish=stop, so
         the real answer sits near 6,000 tokens and 8,000 is headroom against a
         denser chunk. A ceiling costs nothing until it is used. */
      document: 8000,
      /* Folding the per-chunk bullet lists into one outline is a small job on a
         long input, and it is the request that would fail silently if the
         ceiling were tight. */
      documentMerge: 1600
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

    /* The document page. One line, four cards, and a chunked pipeline on top
       of it: what a file needs is not a different kind of answer but a longer
       one, produced in pieces and stitched back together in order. */
    documentLines: ['document'],
    documentCardOrder: DOCUMENT_CARDS.map(function (card) { return card.key; }),
    documentCatalog: DOCUMENT_CARDS.reduce(function (map, card) {
      map[card.key] = card;
      return map;
    }, {}),
    documentGroups: DOCUMENT_GROUPS,

    /* ---------- Card preferences ---------- */
    cardPrefGroups: CARD_PREF_GROUPS,
    familyOf: familyOf,
    baseOrderFor: baseOrderFor,
    resolveCardPrefs: resolveCardPrefs,
    /* What a card is called in the interface language — used by the ordering
       list, and only there. */
    cardTitle: cardTitleFor,
    /* The catalogue a preference group edits, in its default order. */
    cardPrefCatalog: function (group) {
      var langs = groupCardLangs(group);
      return baseOrderFor(group).map(function (key) {
        return group === 'sentence' ? this.sentenceCatalog[key] : this.cardCatalog[key];
      }, this).filter(Boolean).filter(function (card) {
        /* A card no language in this group can produce is not this group's
           business: the list shows what can actually appear. */
        if (!langs) return true;
        var produces = CARD_LANGS[card.key] || [];
        return produces.some(function (lang) { return langs.indexOf(lang) > -1; });
      });
    },
    cardLangs: cardLangs,
    groupCardLangs: groupCardLangs,
    prefGroupForLanguage: function (language) {
      if (!language) return 'latin';
      return familyOf(language);
    },

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
      surprisePool: { batch: 100, target: 200, topUp: 100, lowWater: 20, seenMax: 20000 },
      rootReviewRound: 5,
      rootIntervals: [0, 1, 2, 4, 7, 15, 30, 60, 120],
      maxWordbooks: 50,
      maxWordbookName: 40,
      /* A file is read in pieces. One piece is a single request, which keeps
         the cost of a mistake small and lets a long document make progress the
         user can watch; past the total ceiling the honest answer is no, because
         the whole text has to fit in one context to be translated coherently. */
      document: {
        maxSingle: 40000,
        maxTotal: 200000,
        chunk: 20000,
        overlap: 1000,
        /* What the entry keeps of the source. The translation is kept whole —
           it is what the reader came for — but pasting 200,000 characters of
           source next to it would use most of the storage quota on one file. */
        keepSource: 60000
      }
    }
  };

  ns.STORAGE_PREFIX = 'dict7';

  ns.STORAGE = {
    settings: ns.STORAGE_PREFIX + '.settings',
    history: ns.STORAGE_PREFIX + '.history',
    entryPrefix: ns.STORAGE_PREFIX + '.entry.',
    wordbooks: ns.STORAGE_PREFIX + '.wordbooks',
    rootIndex: ns.STORAGE_PREFIX + '.rootIndex',
    rootProgress: ns.STORAGE_PREFIX + '.rootProgress',
    surprisePool: ns.STORAGE_PREFIX + '.surprisePool',
    surpriseSeen: ns.STORAGE_PREFIX + '.surpriseSeen',
    /* Set once an older version's data has been offered for import, so the prompt never
       comes back — even if the user declined. */
    imported: ns.STORAGE_PREFIX + '.imported'
  };

  /* The version folders whose data can be imported, newest first. 7.0 starts on
     a fresh prefix, so nothing is ever rewritten in place: this is a one-way
     read, and the first folder that actually holds data is the one offered. */
  ns.IMPORT_SOURCES = [
    { prefix: 'dict6', label: '6.x' },
    { prefix: 'dict5', label: '5.x' },
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
    /* The interface language. It starts as Chinese, because that is who the app
       is for; 'auto' (follow the browser) is still one of the choices in
       Profile. It has nothing to do with the explanation language — those are
       two independent axes. */
    uiLang: 'zh',
    /* The first-run tour runs once; it lives in settings so a backup carries
       the fact that it has been seen. */
    tourDone: false,
    /* 'auto' or one of the language ids. */
    queryLang: ns.CONFIG.autoLang,
    /* 'auto' | 'word' | 'sentence' | 'file' */
    queryMode: 'auto',
    /* Which cards each reading family shows, and in what order. Empty means
       "exactly what the app ships with" — see CONFIG.resolveCardPrefs. */
    cardPrefs: {},
    rootSort: 'learning',
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
    /* Rows unstarred while the Starred screen is open. They keep their place,
       greyed-starred, until the screen is left — a row that vanishes under the
       cursor is hard to undo by eye. Cleared by views.favorites.leave(). */
    keptUnstarred: {},
    /* The file chosen in File mode: { name, size, text, chars, chunks, error }.
       Held between renders because reading a long PDF is not something a
       repaint should repeat. */
    file: null,
    /* Which card-preference groups are unfolded in Profile. Empty means all of
       them are closed, which is what keeps that screen from becoming a wall. */
    openPrefGroups: {},
    surprisePoolStatus: '',
    rootQuery: '',
    /* Which history days and which favourite groups are folded shut. Both are
       empty on load, so everything starts expanded. */
    collapsedDays: {},
    collapsedGroups: {}
  };
})(window.LINGUIST);
