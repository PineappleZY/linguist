/* RADICLE — prompt library.

   Five languages times (overview + three deep lines + candidate) is a lot of
   surface, so nothing is duplicated: each language contributes only the parts
   that are actually language-specific, and the shared rules (json output,
   honesty, how to treat the output language) are composed in by deepPrompt().

   Two axes must never be confused:
     source language  — what the headword is written in (CONFIG.languages)
     output language  — what the explanations are written in
   They are independent, so all 25 combinations have to work. */

window.RADICLE = window.RADICLE || {};

(function (ns) {
  'use strict';

  /* How the output language is named inside a prompt. */
  var OUT_NAME = {
    en: 'English',
    fr: 'French',
    de: 'German',
    ja: 'Japanese',
    zh: 'Simplified Chinese'
  };

  /* How the source language is named inside a prompt. */
  var SRC_NAME = {
    en: 'English',
    fr: 'French',
    de: 'German',
    ja: 'Japanese',
    zh: 'Chinese'
  };

  function outName(id) { return OUT_NAME[id] || OUT_NAME.zh; }
  function srcName(id) { return SRC_NAME[id] || SRC_NAME.en; }

  function fill(template, vars) {
    return template.replace(/\{(\w+)\}/g, function (whole, key) {
      return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole;
    });
  }

  function budget(outputLang, forChinese, otherwise) {
    return outputLang === 'zh' ? forChinese : otherwise;
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
     that exist in several of the five (gift, Rat, bald) are the interesting
     case, so the rule says what to do rather than leaving it to chance. */
  var LANGUAGE_AUTO = [
    '- language: which language the headword actually is, as exactly one of',
    '  "en", "fr", "de", "ja", "zh".',
    '  A spelling that exists in more than one of them (gift, Rat, bald, die) must be',
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
        '{"core_metaphor":"...",',
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
        '- core_metaphor: ONE vivid sentence naming the semantic core, between {METAPHOR_MIN} and {METAPHOR_LIMIT}.',
        '  It must be a full sentence carrying an image, never a label.',
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
        '{"core_metaphor":"...",',
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
        '- core_metaphor: ONE vivid sentence naming the semantic core, between {METAPHOR_MIN} and {METAPHOR_LIMIT}.',
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
        '{"core_metaphor":"...",',
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
        '- core_metaphor: ONE vivid sentence naming the semantic core, between {METAPHOR_MIN} and {METAPHOR_LIMIT}.',
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
        '- senses: at most 4, most common first. definition between {DEF_MIN} and {DEF_LIMIT}, a complete phrase',
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
        ' "usage_notes":["..."],',
        ' "gender_number":{"gender":"masculin|féminin|either","plural":"...","note":"..."},',
        ' "conjugation":{"auxiliary":"avoir|être","participle":"...","tenses":[{"tense":"présent","forms":["je ...","tu ..."]}],',
        '   "note":"..."}}'
      ].join('\n'),
      rules: [
        '- senses: at most 4, most common first, definition between {DEF_MIN} and {DEF_LIMIT} as a complete phrase.',
        '- collocations: 4 to 8 patterns with the preposition they take, a short meaning and typical objects.',
        '- usage_notes: 1 to 4 items on register (familier / courant / soutenu), grammar behaviour or pitfalls.',
        '- gender_number: NOUNS ONLY, otherwise use null. The gender, the plural form, and any trap',
        '  (un problème, une page, un/une élève). Gender is the single thing a French learner most needs,',
        '  so never leave it to inference.',
        '- conjugation: VERBS ONLY, otherwise use null. The auxiliary (être or avoir), the past participle,',
        '  and the forms a learner needs first (présent, passé composé, futur simple), plus any irregularity',
        '  worth naming. Give the forms with their pronoun.'
      ]
    },
    de: {
      role: 'a lexicographer of German',
      shape: [
        '{"senses":[{"pos":"v.","definition":"...","examples":[{"text":"...","translation":"..."}]}],',
        ' "collocations":[{"pattern":"...","meaning":"...","typical_objects":["..."]}],',
        ' "usage_notes":["..."],',
        ' "article_plural":{"article":"der|die|das","plural":"die ...","genitive":"...","note":"..."},',
        ' "principal_parts":{"infinitive":"...","praeteritum":"...","partizipII":"...","auxiliary":"haben|sein",',
        '   "vowel_change":"...","note":"..."},',
        ' "case_government":[{"pattern":"helfen + Dativ","example":"...","note":"..."}],',
        ' "separable_prefixes":[{"prefix":"auf-","meaning":"...","example":"...","note":"..."}]}'
      ].join('\n'),
      rules: [
        '- senses: at most 4, definition between {DEF_MIN} and {DEF_LIMIT} as a complete phrase; 1 or 2 examples each.',
        '- collocations: 4 to 8 patterns, and say which case the pattern governs here.',
        '- usage_notes: 1 to 4 items on register, word order or typical mistakes.',
        '- article_plural: NOUNS ONLY, otherwise null. Definite article, plural form, genitive singular,',
        '  and any trap (das Gift ≠ der Gift, der Band ≠ das Band). Never leave gender to inference.',
        '- principal_parts: VERBS ONLY, otherwise null. Infinitive, Präteritum, Partizip II, the auxiliary,',
        '  and the vowel change (sprechen – sprach – gesprochen).',
        '- case_government: for VERBS AND PREPOSITIONS ONLY, otherwise []. Which case the word governs, with one',
        '  short example per pattern. This is what learners get wrong most often.',
        '- separable_prefixes: for VERBS WITH A SEPARABLE PREFIX ONLY, otherwise []. The prefix, what it',
        '  contributes to the meaning, and a sentence showing it split off.'
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
        '- senses: at most 4, definition between {DEF_MIN} and {DEF_LIMIT} as a complete phrase; 1 or 2 examples each.',
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
        '- senses: at most 4 modern senses, most common first, definition between {DEF_MIN} and {DEF_LIMIT};',
        '  1 or 2 examples each, with the text in Chinese and the translation in {LANG}.',
        '- collocations: 4 to 8 common patterns (量词搭配, 动词搭配, 固定说法), each with a short meaning.',
        '- usage_notes: 1 to 4 items on register, 语体 or typical mistakes.'
      ]
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
    ja: '助詞, 敬語の層, 省略 (主語・助詞), 語順 (SOV) と修飾の位置, 時制とアスペクト',
    zh: '虚词与语序, 量词, 把字句/被字句, 语气助词, 古今异义残留'
  };

  /* ---------- Builders ---------- */

  function overviewPrompt(sourceLang, outputLang) {
    var auto = sourceLang === 'auto';
    return fill(OVERVIEW, {
      APP: ns.CONFIG.appName,
      SRC: auto ? 'English, French, German, Japanese or Chinese' : srcName(sourceLang),
      SRCID: sourceLang,
      /* Substituted in full rather than left to hold a placeholder of its own —
         fill() makes a single pass and would not revisit a nested one. */
      LANGUAGE_RULE: auto ? LANGUAGE_AUTO : ('- language: always "' + sourceLang + '".'),
      LANG: outName(outputLang),
      QUICK_LIMIT: budget(outputLang, '40 characters', '100 characters')
    });
  }

  function deepPrompt(sourceLang, line, outputLang) {
    var specs = line === 'etymology' ? ETYM : (line === 'usage' ? USAGE : DIST);
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
        ? 'Pick one language at random from English, French, German, Japanese and Chinese.'
        : 'The word must be in ' + srcName(sourceLang) + '.'
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
    surprise: surprisePrompt,
    templates: { OVERVIEW: OVERVIEW, ETYM: ETYM, USAGE: USAGE, DIST: DIST, ACCENT: ACCENT_PROMPT, REVERSE: REVERSE }
  };
})(window.RADICLE);
