/* LINGUIST — prompt library.

   Five languages times (overview + three deep lines + candidate) is a lot of
   surface, so nothing is duplicated: each language contributes only the parts
   that are actually language-specific, and the shared rules (json output,
   honesty, how to treat the output language) are composed in by deepPrompt().

   Two axes must never be confused:
     source language  — what the headword is written in (CONFIG.languages)
     output language  — what the explanations are written in
   They are independent, so all 25 combinations have to work. */

window.LINGUIST = window.LINGUIST || {};

(function (ns) {
  'use strict';

  /* How the output language is named inside a prompt. */
  var OUT_NAME = {
    en: 'English',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    es: 'Spanish',
    ja: 'Japanese',
    zh: 'Simplified Chinese'
  };

  /* How the source language is named inside a prompt. */
  var SRC_NAME = {
    en: 'English',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    es: 'Spanish',
    ja: 'Japanese',
    zh: 'Chinese'
  };

  function outName(id) { return OUT_NAME[id] || OUT_NAME.zh; }
  function srcName(id) { return SRC_NAME[id] || SRC_NAME.en; }

  /* The language set is derived from CONFIG so adding a language can never
     leave a prompt claiming a narrower world than the app supports. Prompts use
     the English names; only the UI pickers use the native ones. */
  function languageNames() {
    return ns.CONFIG.languages.map(function (lang) { return lang.label; });
  }

  function languageListText() {
    var names = languageNames();
    return names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1];
  }

  /* The languages a reader can actually pick. Italian and Spanish stay in the
     full table so imported entries still resolve, but nothing *offers* them
     any more — a random pick from the full list produced words the app then
     looked up in a language it no longer supports. */
  function queryLanguageNames() {
    return ns.CONFIG.queryLanguages.map(function (lang) { return lang.label; });
  }

  function queryLanguageListText() {
    var names = queryLanguageNames();
    return names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1];
  }

  function languageCodeList() {
    return ns.CONFIG.languages.map(function (lang) { return '"' + lang.id + '"'; }).join(', ');
  }

  function fill(template, vars) {
    return template.replace(/\{(\w+)\}/g, function (whole, key) {
      return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole;
    });
  }

  function budget(outputLang, forChinese, otherwise) {
    return outputLang === 'zh' ? forChinese : otherwise;
  }

  /* Three-way caps, for the fields where a single "Chinese or not" split was
     the bug: a definition that is one short clause in Chinese is a paragraph in
     German, and Japanese sits between the two. Word counts for the languages
     that separate words, character counts for the two that do not. */
  function limits3(outputLang, zh, ja, other) {
    if (outputLang === 'zh') return zh;
    if (outputLang === 'ja') return ja;
    return other;
  }

  /* ---------- Shared blocks ---------- */

  var JSON_RULE = [
    'Respond with a single valid json object and nothing else — no markdown fence, no commentary.',
    'Output json only.'
  ].join('\n');

  var HONESTY = [
    'Honesty rules:',
    '- Never invent an etymology, a date, a source or an example. Popular-but-false etymologies must not appear.',
    '- When scholars disagree or you are unsure, shorten the claim or say so inside the field instead of guessing.',
    '- Keep headwords, word forms and cited forms in their own language; everything else is in {LANG}.'
  ].join('\n');

  var WRITE_IN = 'Write every natural-language value in {LANG}.';

  /* Rules that belong to a line rather than to a language. They live here so
     the tightening applies to all seven source languages at once — a per
     language copy is how the Chinese and Japanese answers drifted long while
     the English ones stayed short. */
  var LINE_RULES = {
    usage: [
      '- A definition is ONE short clause. Never a list of synonyms, never a restatement of the',
      '  etymology, never a sense that has already been given above it.',
      '- When two senses are close, merge them instead of spending a slot on each.'
    ].join('\n'),
    etymology: [
      '- core_meaning carries the meaning, not a picture of it. If a sentence would work as a',
      '  mnemonic, it belongs in the mnemonic field instead.'
    ].join('\n')
  };

  /* ---------- Overview ---------- */

  var OVERVIEW_RULES = [
    '- status: "ok", or "not_found" when the query is not a real {SRC} word or fixed expression.',
    '- word: the canonical modern headword, lower case unless it is a proper noun.',
    '{LANGUAGE_RULE}',
    '- reading: the pronunciation in the notation a learner of {SRC} actually uses —',
    '  IPA between slashes for English, French and German;',
    '  pinyin WITH tone marks for Chinese (for example "qīng");',
    '  kana for Japanese (for example "せいこう"). Use "" when unknown.',
    '- pos: the single most common part of speech, abbreviated.',
    '- quick_meaning: ONE sentence, never longer than {QUICK_LIMIT}.',
    '- register: exactly one of neutral, formal, informal, literary, archaic, slang, technical.',
    '- tags: 2 to 4 very short semantic-field labels.',
    '- suggestions: when status is "not_found", up to 3 close valid headwords as a json array; otherwise [].'
  ].join('\n');

  /* With the picker on Auto the model has to name the language itself. Words
     that exist in several of them (gift, Rat, bald, die) are the interesting
     case, so the rule says what to do rather than leaving it to chance. */
  var LANGUAGE_AUTO = [
    '- language: which language the headword actually is, as exactly one of',
    '  ' + languageCodeList() + '.',
    '  A spelling that exists in more than one of them (gift, Rat, bald, die, non) must be',
    '  judged from the form itself; pick the language in which that spelling is the',
    '  more common word. If it is genuinely ambiguous, pick the one a learner is most',
    '  likely to have meant and say so in tags.'
  ].join('\n');

  var OVERVIEW = [
    'You are {APP}, a precise lexicographer writing for an advanced learner of {SRC}.',
    'You receive ONE {SRC} headword or fixed expression. Produce a fast, reliable overview of it.',
    '',
    JSON_RULE,
    'Shape:',
    '{"status":"ok","word":"...","language":"{SRCID}","reading":"...","pos":"...",',
    ' "quick_meaning":"...","register":"neutral","tags":["..."],"suggestions":[]}',
    '',
    WRITE_IN,
    '- Never translate or transliterate the headword itself.',
    '- Do not mention etymology, word roots or cultural history here — later requests cover that.',
    '',
    'Field rules:',
    OVERVIEW_RULES
  ].join('\n');

  /* ---------- Deep lines, per language ----------
     Each entry is { role, shape, rules }, where rules is an array joined by
     newlines. deepPrompt() adds the shared preamble and honesty block. */

  var ETYM = {
    en: {
      role: 'a historical lexicographer and etymologist',
      shape: [
        '{"core_meaning":"...",',
        ' "etymology":{"chain":[{"stage":"Proto-Indo-European","language":"...","form":"*ten-","meaning":"...","date":""}],',
        '   "via":"Old French","first_attested":"...","certainty":"high","shift":"..."},',
        ' "morphology":{"breakdown":[{"part":"con-","type":"prefix","form_note":"...","meaning":"...","origin":"Latin"}],',
        '   "root_variants":[{"form":"tend","note":"..."}],"composition":"..."},',
        ' "root_family":{"direct":[{"word":"contention","pos":"n.","gloss":"...","formula":"contend + -ion",',
        '     "examples":[{"text":"...","translation":"..."}]}],',
        '   "shared_root":[{"word":"extend","gloss":"...","formula":"ex- (outward) + tend (stretch)"}]},',
        ' "derived_pronunciation":[{"word":"contention","ipa":"/kənˈtenʃn/"}],',
        ' "false_cognates":[{"word":"content","actual_origin":"Latin continere","note":"..."}]}'
      ].join('\n'),
      rules: [
        '- core_meaning: ONE or TWO plain sentences giving the precise central sense, between {CORE_MIN} and {CORE_LIMIT}: state the essential meaning, and where it helps the semantic field it sits in. Plain prose only — no metaphor, no imagery, no poetry.',
        '- etymology.chain: chronological, OLDEST FIRST, ending at the modern form; 2 to 6 nodes with',
        '  stage, language, form, meaning and date ("" when unknown). A short honest chain beats a long guessed one.',
        '- etymology.certainty: exactly one of high, medium, low.',
        '- etymology.shift: how the meaning travelled from the literal sense to today\'s, at most {SHIFT_LIMIT}.',
        '- morphology.breakdown: 1 to 4 parts in word order, each with type (prefix/root/suffix).',
        '  form_note MUST be filled whenever that part has a spelling variant (for example "com- before a labial").',
        '- morphology.root_variants: the shapes the SAME root takes across this family, each with a one-line reason.',
        '- root_family.direct: at most 6 words built on this headword, with the affix formula and at most one example.',
        '- root_family.shared_root: at most 12 COMMON words sharing the root, most useful first, gloss at most {GLOSS_LIMIT}.',
        '  This is the most valuable field in the response — choose words a learner will actually meet.',
        '- derived_pronunciation: IPA for at most 4 derivatives a learner is likely to mispronounce.',
        '- false_cognates: words that LOOK related but are not, with their real origin. Use [] when no trap exists.'
      ]
    },
    fr: {
      role: 'a historical lexicographer and etymologist of French',
      shape: [
        '{"core_meaning":"...",',
        ' "etymology":{"chain":[{"stage":"Latin","language":"...","form":"...","meaning":"...","date":""}],',
        '   "via":"...","first_attested":"...","certainty":"high","shift":"..."},',
        ' "morphology":{"breakdown":[{"part":"...","type":"prefix","form_note":"...","meaning":"...","origin":"Latin"}],',
        '   "root_variants":[{"form":"...","note":"..."}],"composition":"..."},',
        ' "root_family":{"direct":[{"word":"...","pos":"n.","gloss":"...","formula":"...","examples":[]}],',
        '   "shared_root":[{"word":"...","gloss":"...","formula":"..."}]},',
        ' "derived_pronunciation":[{"word":"...","ipa":"..."}],',
        ' "false_cognates":[{"word":"...","actual_origin":"...","note":"..."}]}'
      ].join('\n'),
      rules: [
        '- core_meaning: ONE or TWO plain sentences giving the precise central sense, between {CORE_MIN} and {CORE_LIMIT}: state the essential meaning, and where it helps the semantic field it sits in. Plain prose only — no metaphor, no imagery, no poetry.',
        '- etymology.chain: Latin (or Gaulish/Germanic where that is the real origin) through Old French to the',
        '  modern form, oldest first, 2 to 6 nodes with stage, language, form, meaning and date.',
        '  Say explicitly whether the word is a popular (inherited) form or a learned (borrowed) one.',
        '- etymology.certainty: high, medium or low.',
        '- etymology.shift: the semantic path in at most {SHIFT_LIMIT}.',
        '- morphology.breakdown: 1 to 4 parts in word order with type and form_note where a spelling change occurs.',
        '- morphology.root_variants: shapes the same root takes inside this family.',
        '- root_family.direct: at most 6 derivatives of this headword; shared_root: at most 12 common French words',
        '  on the same root, most useful first, gloss at most {GLOSS_LIMIT}.',
        '- derived_pronunciation: IPA for at most 4 derivatives a learner is likely to mispronounce.',
        '- false_cognates: FRENCH–ENGLISH false friends (actuellement ≠ actually, éventuellement ≠ eventually).',
        '  This is what a French learner needs, so fill it even when the trap is only on the English side.'
      ]
    },
    de: {
      role: 'a historical lexicographer and etymologist of German',
      shape: [
        '{"core_meaning":"...",',
        ' "etymology":{"chain":[{"stage":"Proto-Germanic","language":"...","form":"*...","meaning":"...","date":""}],',
        '   "via":"...","first_attested":"...","certainty":"high","shift":"..."},',
        ' "morphology":{"breakdown":[{"part":"...","type":"prefix","form_note":"...","meaning":"...","origin":"..."}],',
        '   "root_variants":[{"form":"...","note":"..."}],"composition":"..."},',
        ' "compounds":[{"part":"...","meaning":"...","note":"..."}],',
        ' "root_family":{"direct":[{"word":"...","pos":"n.","gloss":"...","formula":"...","examples":[]}],',
        '   "shared_root":[{"word":"...","gloss":"...","formula":"..."}]},',
        ' "derived_pronunciation":[{"word":"...","ipa":"..."}],',
        ' "false_cognates":[{"word":"...","actual_origin":"...","note":"..."}]}'
      ].join('\n'),
      rules: [
        '- core_meaning: ONE or TWO plain sentences giving the precise central sense, between {CORE_MIN} and {CORE_LIMIT}: state the essential meaning, and where it helps the semantic field it sits in. Plain prose only — no metaphor, no imagery, no poetry.',
        '- etymology.chain: oldest ancestor first (Proto-Indo-European, Proto-Germanic, Old High German,',
        '  Middle High German) down to the modern form; 2 to 6 nodes with stage, language, form, meaning, date.',
        '  Mark the High German consonant shift where it is visible in the form.',
        '- etymology.certainty: high, medium or low.',
        '- morphology.breakdown: 1 to 4 parts in word order; form_note is required whenever a part has an allomorph.',
        '- compounds: ONLY when the headword is a compound. Decompose it into its members in order, each with its',
        '  own meaning and what it contributes; plus the linking element (Fugen-s, Fugen-e) if there is one.',
        '  Use [] when the word is not a compound — do not invent members.',
        '- root_family.direct: at most 6 derivatives; shared_root: at most 12 common German words on the same root.',
        '- derived_pronunciation: IPA for at most 4 derivatives a learner is likely to mispronounce.',
        '- false_cognates: GERMAN–ENGLISH false friends (Gift, bald, bekommen, Chef, Rat). This is the highest-value',
        '  field for a German learner; fill it even when the trap runs only one way.'
      ]
    },
    ja: {
      role: 'a lexicographer and kanji historian writing for a serious learner of Japanese',
      shape: [
        '{"nuance":"...",',
        ' "readings":{"on":[{"reading":"...","romaji":"...","note":"..."}],',
        '   "kun":[{"reading":"...","romaji":"...","okurigana":"...","note":"..."}],',
        '   "special":[]},',
        ' "word_stratum":"wago|kango|gairaigo|mixed",',
        ' "kanji_origin":[{"kanji":"...","formation":"pictograph|indicative|compound|phono-semantic",',
        '   "formation_term":"象形|指事|会意|形声","original_image":"...","path":"..."}],',
        ' "components":[{"part":"...","kind":"radical|component|semantic|phonetic","meaning":"...","note":"..."}],',
        ' "etymology":{"chain":[],"via":"","first_attested":"...","certainty":"medium","shift":"..."},',
        ' "derived_pronunciation":[{"word":"...","reading":"..."}]}'
      ].join('\n'),
      rules: [
        '- nuance: ONE vivid sentence capturing the 語感 of the word, between {METAPHOR_MIN} and {METAPHOR_LIMIT}.',
        '- word_stratum: exactly one of wago (和語), kango (漢語), gairaigo (外来語), mixed.',
        '  This decides register, so it is never guessed loosely.',
        '- readings: for every kanji in a kango word give its on and kun readings with romaji, and mark the',
        '  okurigana for kun readings. For a wago word written with kanji, put the reading under kun.',
        '  For a gairaigo, leave both arrays empty and use source_word instead.',
        '  Use special[] for 熟字訓 (今日 = きょう).',
        '- kanji_origin: the formation of each kanji — pictograph / indicative / compound / phono-semantic,',
        '  written in {LANG} with the underlying term, the original image it drew, and how it reached the',
        '  present meaning. Use [] for words with no kanji.',
        '- components: the radical and any semantic/phonetic components, and what each contributes.',
        '  For a phono-semantic character say which part carries meaning and which carries sound.',
        '- etymology: the word\'s own history (mostly relevant for wago and mixed words); chain may be [].',
        '- derived_pronunciation: at most 4 related words a learner is likely to misread, with their reading.'
      ]
    },
    zh: {
      role: 'a lexicographer and palaeographer writing for a serious learner of Chinese',
      shape: [
        '{"original_sense":"...",',
        ' "character_evolution":[{"stage":"甲骨文|金文|小篆|隶书|楷书|简化字","form":"...","meaning":"...","note":"..."}],',
        ' "components":[{"part":"...","kind":"radical|component|semantic|phonetic","meaning":"...","note":"..."}],',
        ' "multiple_readings":[{"reading":"...","meaning":"...","example":"..."}],',
        ' "senses_path":{"primary":"...","extended":[{"sense":"...","from":"..."}],"figurative":"..."},',
        ' "classical":{"meanings":[{"sense":"...","example":"...","source":"..."}],',
        '   "usages":[{"pattern":"名词作动词","example":"...","gloss":"..."}]},',
        ' "word_formation":{"type":"联合式|偏正式|动宾式|主谓式|补充式|单纯词","parts":[{"morpheme":"...","meaning":"...","role":"..."}],',
        '   "note":"..."}}'
      ].join('\n'),
      rules: [
        '- original_sense: ONE sentence naming the semantic core of the character or word, between {METAPHOR_MIN}',
        '  and {METAPHOR_LIMIT}. For a single character this is the 本义; for a two-character word it is the core',
        '  idea the two morphemes build together.',
        '- character_evolution: for a SINGLE character, the script stages it passed through, oldest first,',
        '  each with the stage name, a description of the form and what it depicted. For a multi-character word,',
        '  leave this as [].',
        '- components: the radical and the semantic/phonetic parts, and what each contributes. For a 形声字 say',
        '  explicitly which part gives meaning and which gives sound. For a two-character word, decompose into',
        '  its two morphemes, each with its own meaning and the relation between them.',
        '- multiple_readings: 多音字 only — each distinct reading with the meaning it carries and one example.',
        '  Use [] when the character has a single reading.',
        '- senses_path: the chain from 本义 to 引申义 to 比喻义, each extended sense saying which earlier sense',
        '  it came from. This is how a Chinese dictionary is read, so it matters more than a flat sense list.',
        '- classical: 古义 — the meanings the word had in 文言 that differ from today, each with a classical',
        '  example and its source, plus 词类活用 patterns (名词作动词, 形容词作名词, 使动, 意动) with examples.',
        '  Use empty arrays when the word has no such divergence.',
        '- word_formation: TWO-CHARACTER AND LONGER WORDS ONLY, otherwise null. The structural type, each',
        '  morpheme with its own meaning, and the relation between them. Use 单纯词 when the word cannot be',
        '  split into meaningful parts — do not invent a decomposition.',
        '  The word\'s history belongs in character_evolution; do not repeat it elsewhere.'
      ]
    },
    it: {
      role: 'a historical lexicographer and etymologist of Italian',
      shape: [
        '{"core_meaning":"...",',
        ' "etymology":{"chain":[{"stage":"Latin","language":"...","form":"...","meaning":"...","date":""}],',
        '   "via":"...","first_attested":"...","certainty":"high","shift":"..."},',
        ' "morphology":{"breakdown":[{"part":"...","type":"prefix","form_note":"...","meaning":"...","origin":"Latin"}],',
        '   "root_variants":[{"form":"...","note":"..."}],"composition":"..."},',
        ' "root_family":{"direct":[{"word":"...","pos":"n.","gloss":"...","formula":"...","examples":[]}],',
        '   "shared_root":[{"word":"...","gloss":"...","formula":"..."}]},',
        ' "derived_pronunciation":[{"word":"...","ipa":"..."}],',
        ' "false_cognates":[{"word":"...","actual_origin":"...","note":"..."}]}'
      ].join('\n'),
      rules: [
        '- core_meaning: ONE or TWO plain sentences giving the precise central sense, between {CORE_MIN} and {CORE_LIMIT}: state the essential meaning, and where it helps the semantic field it sits in. Plain prose only — no metaphor, no imagery, no poetry.',
        '- etymology.chain: Latin (or Gaulish, Greek, Germanic or Arabic where that is the real origin — Italian',
        '  is unusually mixed) through Vulgar Latin and Tuscan to the modern form; 2 to 6 nodes with stage,',
        '  language, form, meaning and date.',
        '  Say whether the word reached Italian by popular transmission or as a learned borrowing.',
        '- etymology.certainty: high, medium or low.',
        '- etymology.shift: the semantic path in at most {SHIFT_LIMIT}.',
        '- morphology.breakdown: 1 to 4 parts in word order, with type and form_note where a spelling change occurs.',
        '- morphology.root_variants: shapes the same root takes inside this family.',
        '- root_family.direct: at most 6 derivatives; shared_root: at most 12 common Italian words on the same',
        '  root, most useful first, gloss at most {GLOSS_LIMIT}.',
        '- derived_pronunciation: IPA for at most 4 derivatives a learner is likely to mispronounce. Mark the',
        '  stress when it is not on the usual syllable.',
        '- false_cognates: ITALIAN–ENGLISH false friends (attualmente ≠ actually, eventualmente ≠ eventually,',
        '  fattoria ≠ factory, parente ≠ parent, magazzino ≠ magazine). This is what an Italian learner needs.'
      ]
    },
    es: {
      role: 'a historical lexicographer and etymologist of Spanish',
      shape: [
        '{"core_meaning":"...",',
        ' "etymology":{"chain":[{"stage":"Latin","language":"...","form":"...","meaning":"...","date":""}],',
        '   "via":"...","first_attested":"...","certainty":"high","shift":"..."},',
        ' "morphology":{"breakdown":[{"part":"...","type":"prefix","form_note":"...","meaning":"...","origin":"Latin"}],',
        '   "root_variants":[{"form":"...","note":"..."}],"composition":"..."},',
        ' "root_family":{"direct":[{"word":"...","pos":"n.","gloss":"...","formula":"...","examples":[]}],',
        '   "shared_root":[{"word":"...","gloss":"...","formula":"..."}]},',
        ' "derived_pronunciation":[{"word":"...","ipa":"..."}],',
        ' "false_cognates":[{"word":"...","actual_origin":"...","note":"..."}]}'
      ].join('\n'),
      rules: [
        '- core_meaning: ONE or TWO plain sentences giving the precise central sense, between {CORE_MIN} and {CORE_LIMIT}: state the essential meaning, and where it helps the semantic field it sits in. Plain prose only — no metaphor, no imagery, no poetry.',
        '- etymology.chain: Latin (or Arabic, Basque, Germanic or Nahuatl where that is the real origin) through',
        '  Old Spanish to the modern form; 2 to 6 nodes with stage, language, form, meaning and date.',
        '  Note the popular versus learned transmission where it matters.',
        '- etymology.certainty: high, medium or low.',
        '- etymology.shift: the semantic path in at most {SHIFT_LIMIT}.',
        '- morphology.breakdown: 1 to 4 parts in word order, with type and form_note where a spelling change occurs.',
        '- root_family.direct: at most 6 derivatives; shared_root: at most 12 common Spanish words on the same',
        '  root, most useful first, gloss at most {GLOSS_LIMIT}.',
        '- derived_pronunciation: IPA for at most 4 derivatives a learner is likely to mispronounce. Mark the',
        '  stress, which changes meaning (papa / papá).',
        '- false_cognates: SPANISH–ENGLISH false friends (actual ≠ actual, embarazada ≠ embarrassed,',
        '  éxito ≠ exit, asistir ≠ assist, largo ≠ large). This is what a Spanish learner needs.'
      ]
    }
  };

  var USAGE = {
    en: {
      role: 'a lexicographer',
      shape: [
        '{"senses":[{"pos":"v.","definition":"...","examples":[{"text":"...","translation":"..."}]}],',
        ' "collocations":[{"pattern":"contend for","meaning":"...","typical_objects":["a prize"]}],',
        ' "usage_notes":["..."]}'
      ].join('\n'),
      rules: [
        '- senses: at most 4, most common first. definition between {SENSE_MIN} and {SENSE_LIMIT}, a complete phrase',
        '  that could stand on its own in a dictionary — never a bare list of synonyms.',
        '  Each sense carries 1 or 2 real examples: text in the headword\'s language, translation in {LANG}.',
        '- collocations: 4 to 8 high-frequency patterns with a short meaning and 2 to 4 typical objects.',
        '- usage_notes: 1 to 4 items on register, grammar behaviour or typical mistakes, each at most {NOTE_LIMIT}.'
      ]
    },
    fr: {
      role: 'a lexicographer of French',
      shape: [
        '{"senses":[{"pos":"v.","definition":"...","examples":[{"text":"...","translation":"..."}]}],',
        ' "collocations":[{"pattern":"...","meaning":"...","typical_objects":["..."]}],',
        ' "usage_notes":["..."]}'
      ].join('\n'),
      rules: [
        '- senses: at most 4, most common first, definition between {SENSE_MIN} and {SENSE_LIMIT} as a complete phrase.',
        '- collocations: 4 to 8 patterns with the preposition they take, a short meaning and typical objects.',
        '- usage_notes: 1 to 4 items on register (familier / courant / soutenu), grammar behaviour or pitfalls.',
        '- Do not describe the word\'s gender, plural or conjugation here; a separate request covers its forms.'
      ]
    },
    de: {
      role: 'a lexicographer of German',
      shape: [
        '{"senses":[{"pos":"v.","definition":"...","examples":[{"text":"...","translation":"..."}]}],',
        ' "collocations":[{"pattern":"...","meaning":"...","typical_objects":["..."]}],',
        ' "usage_notes":["..."]}'
      ].join('\n'),
      rules: [
        '- senses: at most 4, definition between {SENSE_MIN} and {SENSE_LIMIT} as a complete phrase; 1 or 2 examples each.',
        '- collocations: 4 to 8 patterns, and say which case the pattern governs here.',
        '- usage_notes: 1 to 4 items on register, word order or typical mistakes.',
        '- Do not decline the word here. Its article, plural, principal parts, case government and separable',
        '  prefixes belong to a separate request about forms.'
      ]
    },
    ja: {
      role: 'a lexicographer of Japanese',
      shape: [
        '{"senses":[{"pos":"...","definition":"...","examples":[{"text":"...","translation":"..."}]}],',
        ' "collocations":[{"pattern":"...","meaning":"...","typical_objects":["..."]}],',
        ' "usage_notes":["..."],',
        ' "conjugation":{"class":"godan|ichidan|irregular|i-adjective|na-adjective","stem":"...",',
        '   "forms":[{"name":"ます形","form":"..."},{"name":"て形","form":"..."},{"name":"た形","form":"..."}]}}'
      ].join('\n'),
      rules: [
        '- senses: at most 4, definition between {SENSE_MIN} and {SENSE_LIMIT} as a complete phrase; 1 or 2 examples each.',
        '- collocations: 4 to 8 patterns showing the particles the word takes (〜を待つ, 〜に間に合う).',
        '- usage_notes: 1 to 4 items on register, politeness or typical mistakes.',
        '- conjugation: VERBS AND ADJECTIVES ONLY, otherwise null. The conjugation class, the stem, and the',
        '  forms a learner needs first (ます形, て形, た形, and ない形). Name each form in Japanese.',
        '- When the word has a 自他動詞 partner (開く / 開ける), say so in usage_notes together with the particle',
        '  each side takes. There is no separate card for it.'
      ]
    },
    zh: {
      role: 'a lexicographer of Chinese',
      shape: [
        '{"senses":[{"pos":"...","definition":"...","examples":[{"text":"...","translation":"..."}]}],',
        ' "collocations":[{"pattern":"...","meaning":"...","typical_objects":["..."]}],',
        ' "usage_notes":["..."]}'
      ].join('\n'),
      rules: [
        '- senses: at most 4 modern senses, most common first, definition between {SENSE_MIN} and {SENSE_LIMIT};',
        '  1 or 2 examples each, with the text in Chinese and the translation in {LANG}.',
        '- collocations: 4 to 8 common patterns (量词搭配, 动词搭配, 固定说法), each with a short meaning.',
        '- usage_notes: 1 to 4 items on register, 语体 or typical mistakes.'
      ]
    },
    it: {
      role: 'a lexicographer of Italian',
      shape: [
        '{"senses":[{"pos":"v.","definition":"...","examples":[{"text":"...","translation":"..."}]}],',
        ' "collocations":[{"pattern":"...","meaning":"...","typical_objects":["..."]}],',
        ' "usage_notes":["..."]}'
      ].join('\n'),
      rules: [
        '- senses: at most 4, most common first, definition between {SENSE_MIN} and {SENSE_LIMIT} as a complete phrase.',
        '- collocations: 4 to 8 patterns with the preposition they take, a short meaning and typical objects.',
        '- usage_notes: 1 to 4 items on register or typical mistakes.',
        '- Do not describe gender, plurals or conjugation here; a separate request covers the word\'s forms.'
      ]
    },
    es: {
      role: 'a lexicographer of Spanish',
      shape: [
        '{"senses":[{"pos":"v.","definition":"...","examples":[{"text":"...","translation":"..."}]}],',
        ' "collocations":[{"pattern":"...","meaning":"...","typical_objects":["..."]}],',
        ' "usage_notes":["..."]}'
      ].join('\n'),
      rules: [
        '- senses: at most 4, most common first, definition between {SENSE_MIN} and {SENSE_LIMIT} as a complete phrase.',
        '- collocations: 4 to 8 patterns with the preposition they take, a short meaning and typical objects.',
        '- usage_notes: 1 to 4 items on register or typical mistakes.',
        '- Do not describe gender, plurals or conjugation here; a separate request covers the word\'s forms.'
      ]
    }
  };

  /* ---------- Inflection (the five inflecting languages) ----------
     The fourth line. "How does this word change its shape" is a different
     question from "what does it mean", and it is the largest payload in the
     app — so applicability is strict: a noun must come back with
     conjugation: null rather than an empty table. */

  var INFL_SHARED = [
    'This request is about FORM, not meaning: how this word is inflected, declined and governed.',
    'Applicability is strict, because a learner is looking at exactly one part of speech:',
    '- word_profile is always filled.',
    '- noun_forms: nouns only. adjective_forms: adjectives only. conjugation: verbs only.',
    '  comparison: adjectives and adverbs only. pronouns: pronouns and determiners only.',
    '  government: verbs only.',
    '- Every field that does not apply MUST be null, and every list that does not apply MUST be [].',
    '  An empty field costs the reader attention; a wrong one teaches something false.',
    '- A paradigm is worthless if it is incomplete: when a table applies, give EVERY person of EVERY tense',
    '  listed below, with the pronoun inside each form ("je vais", "ich gehe", "yo voy"). Never give the',
    '  first person and stop, and never summarise a tense as "regular".',
    '- mood is the bare category (indicatif, conditionnel, subjonctif, impératif and their equivalents);',
    '  tense is the name of the form and must not repeat it — write "présent", never "conditionnel présent".',
    '- Spelling and stem changes, accents included, must be exactly right in every single form.'
  ].join('\n');

  /* Every language shares this shape; only the languages that need the two
     German-only arrays at the end use them. */
  var INFL_SHAPE_HEAD = [
    '{"word_profile":{"pos":"...","subtype":"...","transitivity":null,"countability":null,',
    '   "aspect":null,"auxiliary":null,"frequency":"A1|A2|B1|B2|C1|C2","must_memorise":["..."],"note":"..."},',
    ' "noun_forms":{"gender":"...","article":"...","plural":"...",',
    '   "article_forms":[{"context":"...","form":"..."}],',
    '   "declension":[{"case":"...","singular":"...","plural":"..."}],"irregular":["..."],"note":"..."},',
    ' "adjective_forms":{"agreement":[{"context":"...","form":"..."}],"position":"...",',
    '   "endings":[{"pattern":"...","ending":"..."}],"special":["..."],"note":"..."},',
    ' "conjugation":{"principal_parts":{"infinitive":"...","praeteritum":"...","partizipII":"...","auxiliary":"..."},',
    '   "class":"...","auxiliary":"...","participle":"...","gerund":"...",',
    '   "tenses":[{"mood":"...","tense":"...","forms":[{"person":"...","form":"..."}],"note":"..."}],',
    '   "irregular":["..."],"note":"..."},',
    ' "comparison":{"comparative":"...","superlative":"...","absolute":null,"irregular":true,"note":"..."},',
    ' "pronouns":{"kind":"...","forms":[{"label":"...","form":"...","note":"..."}],"position":"...","note":"..."},',
  ].join('\n');

  var INFL_SHAPE = INFL_SHAPE_HEAD + '\n' +
    ' "government":{"items":[{"pattern":"...","case":null,"meaning":"...","example":"..."}],\n' +
    '   "clitics":"...","note":"..."}}';

  var INFL_SHAPE_DE = INFL_SHAPE_HEAD + '\n' +
    ' "government":null,\n' +
    ' "case_government":[{"pattern":"helfen + Dativ","example":"...","note":"..."}],\n' +
    ' "separable_prefixes":[{"prefix":"auf-","meaning":"...","example":"...","note":"..."}]}';

  /* Fields every language shares, so only the genuinely language-specific
     rules are repeated in the five specs below. */
  var INFL_COMMON_RULES = [
    '- word_profile: pos is the part of speech. subtype narrows it where that helps a learner',
    '  (count noun, irregular verb, modal verb, comparative adjective). frequency is the CEFR band at',
    '  which a learner meets this word, exactly one of A1, A2, B1, B2, C1, C2. must_memorise: 2 to 4',
    '  items, each at most {NOTE_LIMIT}, naming what cannot be derived from a rule — an irregular form, a',
    '  fixed preposition, a doubled consonant, a word whose gender contradicts its ending. note: at most',
    '  {NOTE_LIMIT}, only when something is left over.',
    '- Set every field that does not apply to null and every list that does not apply to [].',
    '  Above all: never fill noun_forms for a verb, or conjugation for a noun.'
  ];

  var INFL = {
    en: {
      role: 'a grammarian of English',
      shape: INFL_SHAPE,
      rules: INFL_COMMON_RULES.concat([
        '- transitivity for verbs: transitive, intransitive, both or linking. countability for nouns:',
        '  countable, uncountable or both. aspect for a verb that is stative or rarely used in the continuous.',
        '- noun_forms: NOUNS ONLY, otherwise null. gender is ALWAYS null — English has no grammatical gender.',
        '  article: the article the noun actually takes (a, an, the, or none). plural: the plain plural.',
        '  article_forms: one row per article decision a learner has to get right. declension stays [].',
        '  irregular: every plural or article form that breaks the spelling rule.',
        '- adjective_forms: ALWAYS null. English adjectives never agree; comparison carries their forms.',
        '- conjugation: VERBS ONLY, otherwise null. principal_parts: the five forms a learner writes on a',
        '  card — base, third_person, past, participle, gerund. class: regular, irregular or modal.',
        '  auxiliary: be, have or do, whichever builds its compound tenses. tenses: exactly these five, each',
        '  with all six persons — present, past, present perfect, present continuous, future (will + base).',
        '  irregular: each form that breaks the pattern together with the rule it breaks, at most 6.',
        '- comparison: ADJECTIVES AND ADVERBS ONLY, otherwise null. comparative and superlative: the form',
        '  actually used (bigger / biggest, more careful / most careful, better / best). absolute: null.',
        '  irregular: true when it is not formed with -er/-est or more/most.',
        '- pronouns: PRONOUNS AND DETERMINERS ONLY, otherwise null. kind: personal, possessive, reflexive,',
        '  demonstrative, relative, interrogative or indefinite. forms: one row per function the word has',
        '  (subject, object, possessive determiner, possessive pronoun), each with a short example in {LANG}.',
        '  position: where it sits in the clause. clitics: null.',
        '- government: VERBS ONLY, otherwise null. items: every preposition or particle this verb actually',
        '  requires (depend on, accuse someone of, look after, be afraid of), each with its meaning in {LANG}',
        '  and one short example. clitics: null.'
      ])
    },
    fr: {
      role: 'a grammarian of French',
      shape: INFL_SHAPE,
      rules: INFL_COMMON_RULES.concat([
        '- noun_forms: NOUNS ONLY, otherwise null. gender: masculin, féminin or either. article: the',
        '  definite article with the elision and the contraction shown (le, la, l\', les, du, des).',
        '  article_forms: definite singular, definite plural, indefinite singular, indefinite plural, and the',
        '  partitive where it exists. plural: the normal plural, then irregular in irregular[] (cheval →',
        '  chevaux, œil → yeux, un travail → des travaux). declension stays [].',
        '- adjective_forms: ADJECTIVES ONLY, otherwise null. agreement: the four forms — masculine singular,',
        '  feminine singular, masculine plural, feminine plural — spelled out (grand, grande, grands,',
        '  grandes). position: before the noun, after it, or either, and whether the place changes the',
        '  meaning. special: the adjectives with a second masculine form before a vowel (beau / bel, vieux /',
        '  vieil, nouveau / nouvel). endings: the -al → -aux and -eau → -eaux patterns when they apply.',
        '- conjugation: VERBS ONLY, otherwise null. class: the infinitive group and any stem family. auxiliary:',
        '  être or avoir, and say when être is required (aller and the pronominal verbs). participle and',
        '  gerund. tenses: exactly these seven, each with all six persons — présent, imparfait, futur simple,',
        '  conditionnel présent, subjonctif présent, impératif (five persons, the pronoun omitted), passé',
        '  composé (with the auxiliary and the participle, agreement shown where it changes). irregular:',
        '  the stems and endings that break the pattern, at most 6.',
        '- comparison: ADJECTIVES AND ADVERBS ONLY, otherwise null. comparative and superlative: the actual',
        '  forms (plus grand, le plus grand, meilleur, le meilleur, mieux). irregular: true for bon, mauvais,',
        '  petit and the adverbs bien, mal. note: whether the adjective stands before or after the noun,',
        '  since that changes both meaning and comparison.',
        '- pronouns: PRONOUNS AND DETERMINERS ONLY, otherwise null. forms: one row per set the word belongs',
        '  to — subject, direct object, indirect object, tonic, reflexive, possessive, demonstrative, relative',
        '  — spelled out person by person (je / me / moi, tu / te / toi, il / le / lui). position: where the',
        '  pronoun goes, the elision before a vowel, and what happens in the imperative. clitics: the object',
        '  pronoun order and the two adverbial pronouns y and en, with one example each.',
        '- government: VERBS ONLY, otherwise null. items: every preposition the verb actually governs',
        '  (penser à, se souvenir de, jouer à / jouer de, obéir à), each with its meaning in {LANG} and one',
        '  short example — this is what learners get wrong most often. clitics: whether the object pronoun',
        '  is direct or indirect with this verb, and where y or en can stand in for an argument.'
      ])
    },
    de: {
      role: 'a grammarian of German',
      shape: INFL_SHAPE_DE,
      rules: INFL_COMMON_RULES.concat([
        '- noun_forms: NOUNS ONLY, otherwise null. gender: der, die or das. article: the definite article.',
        '  plural: the plural form with its article (die Männer, die Häuser, die Autos). article_forms:',
        '  exactly four rows — definite (der / die / das), indefinite (ein / eine), kein, and the plural',
        '  article system. Do not repeat the case table here; declension carries it. declension: the full',
        '  four-case table, one row per case, each cell the',
        '  article AND the noun form together (der Mann / des Mannes / dem Mann / den Mann, and the plural',
        '  column beside it). irregular: weak nouns that take -en in every case but the nominative, and any',
        '  trap (das Gift ≠ der Gift, der Band ≠ das Band).',
        '- adjective_forms: ADJECTIVES ONLY, otherwise null. Predicative adjectives never change — say so in',
        '  position. agreement is [] in German; the table lives in endings: one row per pattern showing the',
        '  endings a learner has to memorise — weak after der/die/das, mixed after ein/kein/mein, strong',
        '  when no article precedes. Write each row as the four-case pattern, for example',
        '  "-e / -e / -en / -en". special: participles used as adjectives, and adjectives with a fixed case',
        '  government (mir ist kalt, dieser Typ).',
        '- conjugation: VERBS ONLY, otherwise null. principal_parts: infinitive, Präteritum, Partizip II,',
        '  auxiliary — the three forms a learner writes on the top of the card. class: weak, strong or',
        '  mixed. tenses: exactly these six, each with all six persons — Präsens, Präteritum, Perfekt,',
        '  Futur I, Konjunktiv II, Imperativ. irregular: the vowel change (sprechen – sprach – gesprochen)',
        '  and the third-person forms that lose the -e, at most 6.',
        '- comparison: ADJECTIVES AND ADVERBS ONLY, otherwise null. comparative and superlative: the actual',
        '  forms (schneller, am schnellsten). irregular: true for gut, viel, gern, hoch, nah. note: whether',
        '  the comparison takes an umlaut and how the superlative endings decline.',
        '- pronouns: PRONOUNS AND DETERMINERS ONLY, otherwise null. forms: one row per case the word has —',
        '  Nominativ, Akkusativ, Dativ, Genitiv, and the possessive or demonstrative set it belongs to.',
        '  position: where it stands, including the pronoun before the participle in a Perfekt clause.',
        '  clitics: null.',
        '- government: ALWAYS null in German. The case a word governs belongs in case_government, and a',
        '  prefix that splits off belongs in separable_prefixes. Fill both only when they apply; otherwise',
        '  use []. case_government covers verbs and prepositions that take a fixed case (helfen + Dativ,',
        '  warten auf + Akkusativ, während + Genitiv), each with one short example. separable_prefixes is',
        '  for verbs with a separable prefix only: what the prefix contributes and a sentence showing it',
        '  split off to the end.'
      ])
    },
    it: {
      role: 'a grammarian of Italian',
      shape: INFL_SHAPE,
      rules: INFL_COMMON_RULES.concat([
        '- noun_forms: NOUNS ONLY, otherwise null. gender: maschile, femminile or either. article: the',
        '  definite article with its elision (il, lo, la, l\', i, gli, le). article_forms: definite singular,',
        '  definite plural, indefinite (un, uno, una, un\'), and the partitive where it is used. plural: the',
        '  normal plural, then irregular in irregular[] — including the nouns that change gender in the',
        '  plural (uovo / uova, braccio / braccia, dito / dita) and the invariant ones (città, re, crisi).',
        '  declension stays [].',
        '- adjective_forms: ADJECTIVES ONLY, otherwise null. agreement: the four forms spelled out (alto,',
        '  alta, alti, alte). position: before or after the noun, and whether the place changes the meaning.',
        '  special: the adjectives with a shortened form (buono / buon, bello / bel, quello-like patterns)',
        '  and the invariable ones (rosa, blu). endings: the -co / -ca and -go / -ga plurals that keep or',
        '  lose the h.',
        '- conjugation: VERBS ONLY, otherwise null. class: -are, -ere, -ire, and the -isc- subgroup.',
        '  auxiliary: avere or essere, and say when essere is required. participle and gerund. tenses:',
        '  exactly these eight, each with all six persons — presente, imperfetto, passato remoto, futuro',
        '  semplice, condizionale presente, congiuntivo presente, imperativo, passato prossimo. irregular:',
        '  the stems and participles that break the pattern, at most 6.',
        '- comparison: ADJECTIVES AND ADVERBS ONLY, otherwise null. comparative and superlative: the actual',
        '  forms (più alto, il più alto, altissimo). absolute: the -issimo form where one exists. irregular:',
        '  true for buono, cattivo, grande, piccolo and for meglio / peggio.',
        '- pronouns: PRONOUNS AND DETERMINERS ONLY, otherwise null. forms: one row per set — subject, direct',
        '  object, indirect object, tonic, reflexive, possessive, demonstrative — spelled out person by',
        '  person (io / mi / me, tu / ti / te, lui / lo / gli). position: where the clitic goes, the elision',
        '  and doubling before a vowel, and what happens in the imperative and with a modal. clitics: the',
        '  combined forms (me lo, glielo, te ne) and ci / ne, with one example each.',
        '- government: VERBS ONLY, otherwise null. items: every preposition the verb actually governs',
        '  (pensare a, dipendere da, fidarsi di, cercare di), each with its meaning in {LANG} and one short',
        '  example. clitics: which clitic replaces the argument this verb takes.'
      ])
    },
    es: {
      role: 'a grammarian of Spanish',
      shape: INFL_SHAPE,
      rules: INFL_COMMON_RULES.concat([
        '- noun_forms: NOUNS ONLY, otherwise null. gender: masculino, femenino or either. article: the',
        '  definite article (el, la, los, las). article_forms: definite singular, definite plural, indefinite',
        '  (un / una / unos / unas), each with the case that surprises a learner (el agua but las aguas, el',
        '  hacha). plural: the normal plural, then irregular in irregular[] (el régimen → los regímenes,',
        '  el lunes → los lunes). declension stays [].',
        '- adjective_forms: ADJECTIVES ONLY, otherwise null. agreement: the four forms spelled out (bueno,',
        '  buena, buenos, buenas). position: before or after the noun, and whether the place changes the',
        '  meaning. special: the apocope before a masculine singular noun (bueno → buen, grande → gran,',
        '  malo → mal) and the adjectives that never change (feliz, grande in both genders).',
        '- conjugation: VERBS ONLY, otherwise null. class: -ar, -er, -ir. auxiliary: haber where it applies.',
        '  participle and gerund. tenses: exactly these eight, each with all six persons — presente,',
        '  pretérito indefinido, imperfecto, futuro simple, condicional simple, presente de subjuntivo,',
        '  imperativo, pretérito perfecto. irregular: the stem changes (e→ie, o→ue, e→i), the irregular',
        '  first persons (hago, pongo, salgo) and the irregular preterites (estuve, tuve), at most 6.',
        '- comparison: ADJECTIVES AND ADVERBS ONLY, otherwise null. comparative and superlative: the actual',
        '  forms (más alto, el más alto). absolute: the -ísimo form where one exists. irregular: true for',
        '  bueno, malo, grande, pequeño and for mejor / peor.',
        '- pronouns: PRONOUNS AND DETERMINERS ONLY, otherwise null. forms: one row per set — subject, direct',
        '  object, indirect object, reflexive, possessive, demonstrative — spelled out person by person',
        '  (yo / me / mí, tú / te / ti, él / lo / le). position: where the clitic goes, the doubling of the',
        '  indirect object, and what happens in the imperative and with a gerund. clitics: the combined forms',
        '  (se lo, me lo) and when le becomes se, with one example each.',
        '- government: VERBS ONLY, otherwise null. items: every preposition the verb actually governs',
        '  (pensar en, depender de, soñar con, acordarse de), each with its meaning in {LANG} and one short',
        '  example — this is where learners import the wrong preposition from another language. clitics:',
        '  which clitic replaces the argument this verb takes.'
      ])
    }
  };

  var DIST = {
    en: {
      role: 'a lexicographer',
      shape: [
        '{"confusables":{"theme":"...","table":[{"word":"...","meaning":"...","note":"..."}],',
        '   "parallel_examples":[{"sentence":"...","note":"..."}],',
        '   "contrast_pairs":[{"a":"...","a_meaning":"...","b":"...","b_meaning":"..."}]},',
        ' "cultural_notes":["..."],"synthesis":["..."],"mnemonic":"..."}'
      ].join('\n'),
      rules: [
        '- confusables.theme: what the cluster has in common, at most {THEME_LIMIT}.',
        '- confusables.table: at most 8 near-synonyms with the HEADWORD ITSELF AS THE FIRST ROW;',
        '  note names the single sharpest difference. Use [] with a theme only when nothing is confusable.',
        '- confusables.parallel_examples: 2 to 4 sentences showing the SAME situation with different words.',
        '- confusables.contrast_pairs: 1 to 3 easily mixed collocations, or [].',
        '- cultural_notes: at most 3, each at most {CULT_LIMIT}, on literary or social connotations.',
        '- synthesis: 2 to 4 short lines tying the origin back to today\'s use, each at most {SYNTH_LIMIT}.',
        '- mnemonic: ONE memorable hook, at most {MNEM_LIMIT}.'
      ]
    },
    fr: {
      role: 'a lexicographer of French',
      shape: [
        '{"confusables":{"theme":"...","table":[{"word":"...","meaning":"...","note":"..."}],',
        '   "parallel_examples":[{"sentence":"...","note":"..."}],"contrast_pairs":[]},',
        ' "doublets":[{"popular":"...","learned":"...","latin":"...","difference":"..."}],',
        ' "cultural_notes":["..."],"synthesis":["..."],"mnemonic":"..."}'
      ].join('\n'),
      rules: [
        '- confusables: as for any language — theme, a table of at most 8 near-synonyms with the headword first,',
        '  2 to 4 parallel examples, 1 to 3 contrast pairs. note at most {NOTE_LIMIT}.',
        '- doublets: ONLY when the same Latin root entered French twice — once by popular transmission and once',
        '  as a learned borrowing (chose / cause, poison / potion, château / castel, rançon / rédemption).',
        '  Give the Latin form and what separates the two branches in meaning or register. Use [] when there is',
        '  no such pair — most words do not have one.',
        '- cultural_notes: at most 3, each at most {CULT_LIMIT}.',
        '- synthesis: 2 to 4 short lines, each at most {SYNTH_LIMIT}.',
        '- mnemonic: ONE hook, at most {MNEM_LIMIT}.'
      ]
    },
    de: {
      role: 'a lexicographer of German',
      shape: [
        '{"confusables":{"theme":"...","table":[{"word":"...","meaning":"...","note":"..."}],',
        '   "parallel_examples":[{"sentence":"...","note":"..."}],"contrast_pairs":[]},',
        ' "sound_shift":[{"english":"water","german":"Wasser","shift":"t → ss","note":"..."}],',
        ' "cultural_notes":["..."],"synthesis":["..."],"mnemonic":"..."}'
      ].join('\n'),
      rules: [
        '- confusables: theme, a table of at most 8 near-synonyms with the headword first, 2 to 4 parallel',
        '  examples, 1 to 3 contrast pairs. note at most {NOTE_LIMIT}.',
        '- sound_shift: ONLY when this word has a recognisable English cognate that shows the High German',
        '  consonant shift (water/Wasser, time/Zeit, pepper/Pfeffer, make/machen). Give the English word, the',
        '  German word, the shift, and one line on why the two look so different. Use [] when there is no such',
        '  pair — do not force one.',
        '- cultural_notes: at most 3, each at most {CULT_LIMIT}.',
        '- synthesis: 2 to 4 short lines, each at most {SYNTH_LIMIT}.',
        '- mnemonic: ONE hook, at most {MNEM_LIMIT}.'
      ]
    },
    ja: {
      role: 'a lexicographer of Japanese',
      shape: [
        '{"confusables":{"theme":"...","table":[{"word":"...","meaning":"...","note":"..."}],',
        '   "parallel_examples":[{"sentence":"...","note":"..."}],"contrast_pairs":[]},',
        ' "source_word":{"origin_language":"...","original":"...","literal":"...","note":"..."},',
        ' "spelling_variants":[{"form":"...","note":"..."}],',
        ' "cultural_notes":["..."],"synthesis":["..."],"mnemonic":"..."}'
      ].join('\n'),
      rules: [
        '- confusables: theme, a table of at most 8 near-synonyms with the headword first, 2 to 4 parallel',
        '  examples, 1 to 3 contrast pairs. note at most {NOTE_LIMIT}.',
        '- source_word: GAIRAIGO ONLY, otherwise null. Which language it came from, the original word, its',
        '  literal meaning, and how far the Japanese sense drifted from it. For non-gairaigo use null.',
        '- spelling_variants: 表記のゆれ — the other forms of this word that are in real use (ヴァイオリン / バイオリン,',
        '  引っ越し / 引越し, 表す / 表わす), each with a note on which is now standard or why both survive.',
        '  Use [] when the spelling is settled.',
        '- cultural_notes: at most 3, each at most {CULT_LIMIT}.',
        '- synthesis: 2 to 4 short lines, each at most {SYNTH_LIMIT}.',
        '- mnemonic: ONE hook, at most {MNEM_LIMIT}.'
      ]
    },
    zh: {
      role: 'a lexicographer of Chinese',
      shape: [
        '{"confusables":{"theme":"...","table":[{"word":"...","meaning":"...","note":"..."}],',
        '   "parallel_examples":[{"sentence":"...","note":"..."}],"contrast_pairs":[]},',
        ' "origin_allusion":{"source":"...","author":"...","quote":"...","meaning":"...","note":"..."},',
        ' "then_and_now":{"then":"...","now":"...","note":"..."},',
        ' "cultural_notes":["..."],"synthesis":["..."],"mnemonic":"..."}'
      ].join('\n'),
      rules: [
        '- confusables: theme, a table of at most 8 near-synonyms or 形近字 with the headword first, 2 to 4',
        '  parallel examples, 1 to 3 contrast pairs. note at most {NOTE_LIMIT}.',
        '  For 形近字 the note must name the structural difference (偏旁不同、部件不同).',
        '- origin_allusion: IDIOMS (成语) AND WORDS WITH A CLASSICAL SOURCE. Where it first appears, who wrote',
        '  it, the original line, what it meant there, and how the present use differs. Use null otherwise.',
        '- then_and_now: ONLY when the word\'s classical sense differs from its modern one. The classical reading',
        '  and the modern one, side by side, with a note on what shifted. Use null when they agree.',
        '- cultural_notes: at most 3, each at most {CULT_LIMIT}.',
        '- synthesis: 2 to 4 short lines, each at most {SYNTH_LIMIT}.',
        '- mnemonic: ONE hook, at most {MNEM_LIMIT}, built on the character\'s shape or components where possible.'
      ]
    },
    it: {
      role: 'a lexicographer of Italian',
      shape: [
        '{"confusables":{"theme":"...","table":[{"word":"...","meaning":"...","note":"..."}],',
        '   "parallel_examples":[{"sentence":"...","note":"..."}],"contrast_pairs":[]},',
        ' "doublets":[{"popular":"...","learned":"...","latin":"...","difference":"..."}],',
        ' "cultural_notes":["..."],"synthesis":["..."],"mnemonic":"..."}'
      ].join('\n'),
      rules: [
        '- confusables: theme, a table of at most 8 near-synonyms with the headword first, 2 to 4 parallel',
        '  examples, 1 to 3 contrast pairs. note at most {NOTE_LIMIT}.',
        '- doublets: ONLY when the same Latin root entered Italian twice — once by popular transmission and once',
        '  as a learned borrowing (cosa / causa, vezzo / vizio, chiostro / claustro, vescovo / episcopo).',
        '  Give the Latin form and what separates the two branches in meaning or register. Use [] when there is',
        '  no such pair — most words do not have one.',
        '- cultural_notes: at most 3, each at most {CULT_LIMIT}.',
        '- synthesis: 2 to 4 short lines, each at most {SYNTH_LIMIT}.',
        '- mnemonic: ONE hook, at most {MNEM_LIMIT}.'
      ]
    },
    es: {
      role: 'a lexicographer of Spanish',
      shape: [
        '{"confusables":{"theme":"...","table":[{"word":"...","meaning":"...","note":"..."}],',
        '   "parallel_examples":[{"sentence":"...","note":"..."}],"contrast_pairs":[]},',
        ' "cultural_notes":["..."],"synthesis":["..."],"mnemonic":"..."}'
      ].join('\n'),
      rules: [
        '- confusables: theme, a table of at most 8 near-synonyms with the headword first, 2 to 4 parallel',
        '  examples, 1 to 3 contrast pairs. note at most {NOTE_LIMIT}.',
        '- cultural_notes: at most 3, each at most {CULT_LIMIT}.',
        '- synthesis: 2 to 4 short lines, each at most {SYNTH_LIMIT}.',
        '- mnemonic: ONE hook, at most {MNEM_LIMIT}.'
      ]
    }
  };

  /* ---------- Accent candidates (French, German) ---------- */

  /* ---------- Surprise me ---------- */

  /* A single beautiful word to explore, rather than a canned list. The avoid
     list is what keeps two taps in a row from offering the same thing. */
  var SURPRISE = [
    'You are {APP}. Offer the learner ONE beautiful, evocative word to explore — the kind of word that',
    'makes someone want to learn the language it belongs to.',
    '',
    JSON_RULE,
    'Shape: {"word":"...","language":"en|fr|de|ja|zh","gloss":"...","why":"..."}',
    '',
    'Rules:',
    '- {SCOPE}',
    '- Choose a word with texture: a precise feeling, a vivid image, a cultural weight, a telling history.',
    '  Avoid the most common words and textbook vocabulary — the learner already knows those.',
    '- It must be ONE headword or a short fixed expression, written in its own script.',
    '- gloss: a short gloss in {LANG}. why: one clause in {LANG} on what makes it worth knowing.',
    '- Never invent a word.',
    'Output json only.'
  ].join('\n');

  /* A pool is generated once and then drawn locally. 100 rows per request
     keeps one bad answer cheap and leaves room for the JSON wrapper. */
  var SURPRISE_POOL = [
    'You are {APP}. Build a pool of {N} memorable words for a curious language learner.',
    '',
    JSON_RULE,
    'Shape: {"words":[{"word":"...","language":"English","code":"en","native":"English","theme":"scenery"}]}',
    '',
    'Rules:',
    '- {SCOPE}',
    '- Themes should mix beautiful, scenic, romantic and positive ideas. Avoid proper nouns, inflections,',
    '  and the most common textbook vocabulary.',
    '- Every row must be a real headword or a short fixed expression in its own script.',
    '- language is the English name; code is an ISO 639 code when known; native is the name in that language.',
    '- theme is one short English label: beauty, scenery, romance, hope, calm, memory, light, water, or similar.',
    '- Do not repeat a word already in the avoid list.',
    'Output json only.'
  ].join('\n');

  /* The compact card for a language outside the five full-dictionary
     languages. It deliberately asks for less: a precise meaning, examples and
     an honest root note, never a fabricated etymology. */
  var DISCOVERY = [
    'You are {APP}, introducing one word from {SRC} to a learner whose explanation language is {LANG}.',
    'The word is "{WORD}".',
    '',
    JSON_RULE,
    'Shape: {"word":"...","language":"...","native":"...","code":"...","pronunciation":"...",',
    ' "core_meaning":"...","examples":[{"text":"...","translation":"..."}],',
    ' "root_note":"...","why":"..."}',
    '',
    'Rules:',
    '- core_meaning: one or two plain sentences in {LANG}; state the precise central meaning, no imagery.',
    '- examples: exactly 2 short natural examples in {SRC}, each with a {LANG} translation.',
    '- pronunciation: IPA or the most useful learner notation; empty if unknown.',
    '- root_note: at most one sentence on a genuine root or etymology. If uncertain, use "".',
    '- why: at most one short sentence in {LANG} on why the word is worth knowing.',
    '- Never invent a word, etymology, example or translation.',
    'Output json only.'
  ].join('\n');

  var ACCENT_PROMPT = [
    'You are {APP}. A learner of {SRC} typed "{INPUT}" but cannot easily type {SRC} diacritics,',
    'so the accents may be missing or wrong.',
    '',
    JSON_RULE,
    'Shape: {"typed_is_valid":true,"candidates":[{"word":"...","gloss":"..."}]}',
    '',
    'Rules:',
    '- typed_is_valid: whether the string the learner typed is itself a correct {SRC} word. It says nothing',
    '  about whether they need help — that is decided by how many readings there are, below.',
    '- candidates: EVERY plausible {SRC} word the typed string could stand for, best first, at most 4.',
    '  When typed_is_valid is true you MUST include the typed string itself in the list, because the learner',
    '  may well have meant exactly that.',
    '  For example: typed "cote" in French yields cote (valid as typed), côte and côté — three readings, so',
    '  three candidates. Typed "table" yields only table, so one candidate.',
    '- gloss: a short gloss in {LANG} for each candidate.',
    '- Never invent a word, and never pad the list to look thorough. A single unambiguous reading is the',
    '  correct answer for most words.',
    '- If nothing plausible exists, return typed_is_valid false with candidates [].',
    'Output json only.'
  ].join('\n');

  var TRANSLATE = [
    'You are {APP}. Translate the text from {SRC} into {LANG}.',
    '',
    JSON_RULE,
    'Shape: {"source_language":"...","target_language":"...","translation":"..."}',
    '',
    'Rules:',
    '- Translate the complete meaning; do not add commentary.',
    '- Preserve names, numbers and paragraph breaks.',
    '- target_language must be an id from the app language table.',
    'Output json only.'
  ].join('\n');

  /* ---------- Language detection ----------
     One question, no explanation, no output language: a sentence has no
     overview to name its language, and without one an Auto sentence used to be
     stored as "auto" and then analysed with the English prompts. */

  var DETECT = [
    'You are {APP}. The user typed ONE piece of text and you answer a single question about it:',
    'which language is it written in?',
    '',
    JSON_RULE,
    'Shape: {"language":"en"}',
    '',
    'Rules:',
    '- language: exactly one of ' + languageCodeList() + '.',
    '  Judge from the text itself. A single word that exists in more than one of them',
    '  (gift, Rat, bald, die) takes the language in which it is the more common word.',
    '- Do not translate the text, correct it, answer it or comment on it.',
    '- If it is not text in any of those languages, return {"language":""}.',
    'Output json only.'
  ].join('\n');

  function detectPrompt() {
    return fill(DETECT, { APP: ns.CONFIG.appName });
  }

  function translatePrompt(sourceLang, targetLang) {
    return fill(TRANSLATE, {
      APP: ns.CONFIG.appName, SRC: srcName(sourceLang), LANG: outName(targetLang)
    });
  }

  /* ---------- Document analysis ----------
     One request per chunk, four fields at once. Four parallel lines per chunk
     would multiply the cost of a long file by four and gain nothing: the four
     answers are written from the same reading of the same text, and a reader
     of a document wants them together anyway.

     The per-language note is where the real teaching happens — what a learner
     should watch for in THIS kind of text. It follows the same idea as
     GRAMMAR_FOCUS for sentences: the prompt knows where the difficulty of each
     language actually sits. */

  var DOC_FOCUS = {
    en: 'phrasal verbs, the tense system, article use and how nouns are counted',
    fr: 'the tense and mood system, the agreement of gender and number, liaison and the elision of e muet',
    de: 'case, the frame structure (Satzklammer) and word order, separable prefixes and compound nouns',
    ja: 'particles, the politeness level, keigo where it appears, and the reading of each kanji compound',
    zh: 'measure words, aspect markers, 把 and 被 constructions, and where a written text drifts into 书面语'
  };

  var DOC_SHARED = [
    'You are {APP}: a {SRC} teacher reading ONE part of a longer {SRC} text for a serious learner.',
    'The text may be an article, a story, an essay, a transcript or a set of notes.',
    '',
    JSON_RULE,
    'Shape:',
    '{"summary":["..."],',
    ' "translation":"...",',
    ' "vocabulary":[{"term":"...","reading":"...","meaning":"...","example":"..."}],',
    ' "register":{"genre":"...","register":"...","period":"...","notes":["..."]}}',
    '',
    WRITE_IN,
    'Quote the text\'s own words in {SRC}; everything you write about them is in {LANG}.',
    '',
    'Field rules:',
    '- summary: 3 to 8 bullets in {LANG}, in reading order, each carrying one real point of this part.',
    '  A bullet is a statement about the text, never a topic label ("introduction", "conclusion").',
    '  Follow the order of the text and keep the section structure visible.',
    '- translation: the WHOLE of this part rendered in {LANG}, and shaped like the source:',
    '  one paragraph for every paragraph, a blank line wherever the source has one, a line break',
    '  wherever the source breaks a line inside a paragraph. Never merge, split or reorder blocks.',
    '- Aim for 信 · 达 · 雅, in that order, and never trade one for another.',
    '  信: faithful — nothing added, nothing dropped, no sentence skipped, proper names and',
    '  technical terms kept as they are. 达: idiomatic — a native reader must not hear the source',
    "  grammar through it; translate the sense, not the words. 雅: elegant — match the register and",
    '  rhythm the text itself uses, without decorating it. When elegance would cost accuracy,',
    '  accuracy wins. Never add commentary of your own.',
    '- vocabulary: at most 20 items a learner of {SRC} would actually need, most useful first.',
    '  term exactly as it appears; reading is the pronunciation a learner uses (IPA for English, French',
    '  and German; pinyin with tone marks for Chinese; kana for Japanese); meaning is short and in {LANG};',
    '  example is one short phrase quoted from the text where possible.',
    '- register: genre is what kind of text this is, register is its tone, period is when it reads as',
    '  having been written (say "contemporary" when it is modern), notes carries at most 3 short',
    '  observations on style and on what the choice of words implies about the writer.',
    '',
    HONESTY
  ].join('\n');

  /* Folding per-chunk bullets into one outline. Small input, small output, and
     the one request whose absence would leave a long document summarised as a
     stack of unrelated lists. */
  var DOC_MERGE = [
    'You are {APP}: an editor assembling one outline of a {SRC} text from notes taken part by part.',
    '',
    JSON_RULE,
    'Shape: {"summary":["..."],"register":{"genre":"...","register":"...","period":"...","notes":["..."]}}',
    '',
    WRITE_IN,
    '',
    'Rules:',
    '- summary: 6 to 14 bullets in {LANG} describing the whole text, in reading order.',
    '  Merge what the parts say; do not repeat the same point twice, and do not mention the parts',
    '  themselves ("the first part says…" is wrong).',
    '- register: the same three judgements for the text as a whole, not for one part.',
    'Output json only.'
  ].join('\n');

  function documentPrompt(sourceLang, outputLang, part) {
    var index = part && part.index ? part.index : 1;
    var total = part && part.total ? part.total : 1;
    var where = total > 1
      ? 'This is part ' + index + ' of ' + total + ' of the text. Work on this part only — the parts are ' +
        'translated separately and joined afterwards, so nothing may depend on a part you cannot see.'
      : 'This is the whole text.';
    return fill(DOC_SHARED, {
      APP: ns.CONFIG.appName,
      SRC: srcName(sourceLang),
      LANG: outName(outputLang)
    }) + '\n' + where + '\n' +
      '- What a learner of ' + srcName(sourceLang) + ' usually trips over in this kind of text: ' +
      (DOC_FOCUS[sourceLang] || DOC_FOCUS.en) + '. Point those out where the text shows them.';
  }

  function documentMergePrompt(sourceLang, outputLang) {
    return fill(DOC_MERGE, {
      APP: ns.CONFIG.appName,
      SRC: srcName(sourceLang),
      LANG: outName(outputLang)
    });
  }

  /* ---------- Sentence analysis ---------- */

  var SENT_SHARED = [
    'You are {APP}: a {SRC} teacher analysing ONE {SRC} sentence for a serious learner.',
    'You receive the sentence and nothing else.',
    '',
    WRITE_IN,
    'Quote the sentence\'s own words in {SRC}; everything you write about them is in {LANG}.',
    '- Analyse the sentence as it is written. Do not silently correct it; if it is ungrammatical or odd,',
    '  say so inside the relevant field.'
  ].join('\n');

  var SENTENCE = {
    semantics: {
      role: 'meaning',
      shape: [
        '{"translation":"...","register":"...","word_by_word":[{"form":"...","lemma":"...","pos":"...",',
        '   "meaning":"...","note":"..."}],"chunks":[{"chunk":"...","kind":"collocation|idiom|fixed phrase",',
        '   "meaning":"...","note":"..."}]}'
      ].join('\n'),
      rules: [
        '- translation: the whole sentence rendered naturally in {LANG}. Translate what it means, not word for word.',
        '- register: the tone of the sentence in {LANG} (for example neutral, formal, colloquial, ironic).',
        '- word_by_word: EVERY content word plus any function word that carries meaning, in sentence order.',
        '  form is the word as it appears; lemma is its dictionary form; meaning is what it means IN THIS',
        '  SENTENCE, not its whole range.',
        '- chunks: the multi-word units — collocations, idioms, fixed phrases — with what each contributes.',
        '  Use [] when the sentence is built from free combinations.'
      ]
    },
    grammar: {
      role: 'grammar and structure',
      shape: [
        '{"structure":[{"part":"...","role":"...","note":"..."}],',
        ' "grammar":[{"point":"...","explanation":"...","example":"..."}],',
        ' "pitfalls":[{"issue":"...","explanation":"..."}],',
        ' "pattern":{"template":"...","gloss":"...","substitutions":[{"slot":"...","options":["..."]}],',
        '   "examples":[{"text":"...","translation":"..."}]},',
        ' "cultural_notes":["..."]}'
      ].join('\n'),
      rules: [
        '- structure: how the sentence is built, from the largest division down. For each part give its role',
        '  (subject, predicate, subordinate clause, modifier …). Use [] for a very short sentence.',
        '- grammar: the points this sentence actually demonstrates, {GRAMMAR_FOCUS}.',
        '  Only include a point if the sentence really shows it.',
        '- pitfalls: what a learner is most likely to misread here, and why. Use [] when the sentence is plain.',
        '- pattern: the reusable sentence pattern extracted from this sentence — the template with its slots,',
        '  what each slot accepts, and 2 or 3 substitutions showing it reused.',
        '- cultural_notes: at most 2, only when the sentence really carries something cultural. Otherwise [].'
      ]
    }
  };

  /* What "grammar" means is genuinely different per language, so the focus
     list is per source language rather than generic. */
  var GRAMMAR_FOCUS = {
    en: 'tense and aspect, voice, clause type, non-finite forms, articles and prepositions',
    fr: 'temps et mode (including subjonctif), accord en genre et en nombre, place des pronoms (en, y), negation',
    de: 'Kasus, Satzklammer (separable prefix, verb-final), Wortstellung (TeKaMoLo), Nebensatz mit Verb am Ende',
    it: 'tempi e modi (congiuntivo, condizionale), accordo di genere e numero, pronomi combinati (me lo, glielo), concordanza del participio',
    es: 'tiempos y modos (subjuntivo, indefinido frente a imperfecto), concordancia de género y número, ser frente a estar, pronombres de objeto',
    ja: '助詞, 敬語の層, 省略 (主語・助詞), 語順 (SOV) と修飾の位置, 時制とアスペクト',
    zh: '虚词与语序, 量词, 把字句/被字句, 语气助词, 古今异义残留'
  };

  /* ---------- Builders ---------- */

  function overviewPrompt(sourceLang, outputLang) {
    var auto = sourceLang === 'auto';
    return fill(OVERVIEW, {
      APP: ns.CONFIG.appName,
      SRC: auto ? languageListText() : srcName(sourceLang),
      SRCID: sourceLang,
      /* Substituted in full rather than left to hold a placeholder of its own —
         fill() makes a single pass and would not revisit a nested one. */
      LANGUAGE_RULE: auto ? LANGUAGE_AUTO : ('- language: always "' + sourceLang + '".'),
      LANG: outName(outputLang),
      QUICK_LIMIT: budget(outputLang, '40 characters', '100 characters')
    });
  }

  function deepSpecs(line) {
    if (line === 'etymology') return ETYM;
    if (line === 'usage') return USAGE;
    if (line === 'inflection') return INFL;
    if (line === 'distinction') return DIST;
    return null;
  }

  function deepPrompt(sourceLang, line, outputLang) {
    var specs = deepSpecs(line);
    if (!specs) return '';
    /* The inflection line only exists for the languages that inflect. Returning
       the English spec here would ask for English forms of a Chinese word. */
    if (line === 'inflection' && !ns.CONFIG.inflects(sourceLang)) return '';
    /* By the time a deep line runs the language has been resolved from the
       overview, so 'auto' should never reach here — fall back rather than
       emit an empty prompt if it ever does. */
    var spec = specs[sourceLang] || specs.en;
    if (!spec) return '';
    return [
      'You are {APP}: {ROLE} writing for a serious learner.',
      'You receive ONE {SRC} headword plus a short overview that was already produced for it.',
      '',
      JSON_RULE,
      'Shape:',
      spec.shape,
      '',
      WRITE_IN,
      '',
      'Field rules:',
      spec.rules.join('\n'),
      LINE_RULES[line] || '',
      '',
      HONESTY
    ].join('\n').replace(/\{(\w+)\}/g, function (whole, key) {
      var vars = {
        APP: ns.CONFIG.appName,
        ROLE: spec.role,
        SRC: srcName(sourceLang),
        LANG: outName(outputLang),
        METAPHOR_MIN: budget(outputLang, '20 characters', '50 characters'),
        METAPHOR_LIMIT: budget(outputLang, '45 characters', '110 characters'),
        /* The card that carries the precise central sense. Short enough to be
           read at a glance, long enough to be more than a synonym. */
        CORE_MIN: limits3(outputLang, '25 characters', '30 characters', '10 words'),
        CORE_LIMIT: limits3(outputLang, '60 characters', '70 characters', '35 words'),
        /* One definition. This is the cap that keeps Chinese and Japanese
           entries from turning into essays. */
        SENSE_MIN: limits3(outputLang, '8 characters', '12 characters', '4 words'),
        SENSE_LIMIT: limits3(outputLang, '24 characters', '40 characters', '12 words'),
        SHIFT_LIMIT: budget(outputLang, '120 characters', '280 characters'),
        COMPOSE_LIMIT: budget(outputLang, '50 characters', '120 characters'),
        GLOSS_LIMIT: budget(outputLang, '22 characters', '60 characters'),
        DEF_MIN: budget(outputLang, '15 characters', '35 characters'),
        DEF_LIMIT: budget(outputLang, '60 characters', '140 characters'),
        NOTE_LIMIT: budget(outputLang, '45 characters', '110 characters'),
        THEME_LIMIT: budget(outputLang, '30 characters', '70 characters'),
        CULT_LIMIT: budget(outputLang, '80 characters', '180 characters'),
        SYNTH_LIMIT: budget(outputLang, '60 characters', '140 characters'),
        MNEM_LIMIT: budget(outputLang, '60 characters', '140 characters')
      };
      return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole;
    });
  }

  function candidatePrompt(sourceLang, outputLang, input) {
    return fill(ACCENT_PROMPT, {
      APP: ns.CONFIG.appName,
      SRC: srcName(sourceLang),
      LANG: outName(outputLang),
      INPUT: input
    });
  }

  /* Reverse lookup from a non-Latin query: which English/French/etc. headword
     is the user after? */
  var REVERSE = [
    'You are {APP}, a bilingual lexicographer helping someone find the {SRC} word behind a concept.',
    'The user typed something that is NOT a word of the target language.',
    '',
    JSON_RULE,
    'Shape: {"status":"ok","candidates":[{"word":"...","gloss":"...","why":"..."}]}',
    '',
    'Rules:',
    '- Return 3 or 4 candidates in {SRC}, ordered by how likely they are what the user has in mind.',
    '- Every candidate is a real, current {SRC} headword.',
    '- gloss: a short gloss in {LANG}. why: one short clause in {LANG} explaining the fit.',
    '- If nothing plausible exists, return {"status":"not_found","candidates":[]}.',
    'Output json only.'
  ].join('\n');

  function reversePrompt(sourceLang, outputLang) {
    return fill(REVERSE, {
      APP: ns.CONFIG.appName,
      SRC: srcName(sourceLang),
      LANG: outName(outputLang)
    });
  }

  function sentencePrompt(sourceLang, line, outputLang) {
    var spec = SENTENCE[line];
    return [
      SENT_SHARED,
      '',
      JSON_RULE,
      'Shape:',
      spec.shape,
      '',
      'Field rules:',
      spec.rules.join('\n'),
      '',
      HONESTY
    ].join('\n').replace(/\{(\w+)\}/g, function (whole, key) {
      var vars = {
        APP: ns.CONFIG.appName,
        SRC: srcName(sourceLang),
        LANG: outName(outputLang),
        GRAMMAR_FOCUS: GRAMMAR_FOCUS[sourceLang] || GRAMMAR_FOCUS.en,
        CULT_LIMIT: budget(outputLang, '80 characters', '180 characters')
      };
      return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole;
    });
  }

  function surprisePrompt(sourceLang, outputLang) {
    var auto = sourceLang === 'auto';
    return fill(SURPRISE, {
      APP: ns.CONFIG.appName,
      SRC: auto ? 'any of them' : srcName(sourceLang),
      LANG: outName(outputLang),
      SCOPE: auto
        ? 'Pick one language at random from ' + queryLanguageListText() + '.'
        : 'The word must be in ' + srcName(sourceLang) + '.'
    });
  }

  function surprisePoolPrompt(sourceLang, count, outputLang) {
    var auto = !sourceLang || sourceLang === 'auto';
    return fill(SURPRISE_POOL, {
      APP: ns.CONFIG.appName,
      N: String(count),
      LANG: outName(outputLang),
      SCOPE: auto
        ? 'Every word must be in one of ' + queryLanguageListText() +
          '; do not use any other language.'
        : 'Every word must be in ' + srcName(sourceLang) + '.'
    });
  }

  function discoveryPrompt(word, language, outputLang) {
    return fill(DISCOVERY, {
      APP: ns.CONFIG.appName,
      WORD: String(word || ''),
      SRC: String(language || 'its language'),
      LANG: outName(outputLang)
    });
  }

  ns.prompts = {
    outName: outName,
    srcName: srcName,
    overview: overviewPrompt,
    deep: deepPrompt,
    candidate: candidatePrompt,
    reverse: reversePrompt,
    sentence: sentencePrompt,
    document: documentPrompt,
    documentMerge: documentMergePrompt,
    surprise: surprisePrompt,
    surprisePool: surprisePoolPrompt,
    discovery: discoveryPrompt,
    detect: detectPrompt,
    translate: translatePrompt,
    templates: { OVERVIEW: OVERVIEW, ETYM: ETYM, USAGE: USAGE, INFL: INFL, DIST: DIST, DETECT: DETECT,
      ACCENT: ACCENT_PROMPT, REVERSE: REVERSE, DOC: DOC_SHARED, DOC_MERGE: DOC_MERGE,
      LINE_RULES: LINE_RULES, DOC_FOCUS: DOC_FOCUS }
  };
})(window.LINGUIST);
