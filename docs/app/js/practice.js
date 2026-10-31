/* LINGUIST — practice.

   Four exercise forms behind one entry point, chosen by the word's language:

     spell      Latin-script words   type the word itself
     pinyin     Chinese              type the reading in pinyin
     kana       Japanese kango/wago  type the reading in kana or romaji
     katakana   Japanese gairaigo    type the word in katakana

   All four are input exercises, so they share one full-screen layer. The
   exercise is a plain object driven by pure functions, which keeps the whole
   state machine testable without a browser.

   Judging is language-aware because "correct" means something different in
   each: Latin words forgive missing diacritics, Chinese separates the syllable
   from the tone, Japanese compares through a romaji normaliser so both input
   styles land on the same form. */

window.LINGUIST = window.LINGUIST || {};

(function (ns) {
  'use strict';

  /* ---------- Character classes ---------- */

  /* Single-character classes, used one character at a time. */
  var LATIN = /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\u1E00-\u1EFF]$/;
  var PINYIN = /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\u01CD-\u01DC\u00FC0-\u00FC5\u0100-\u0105\u0112-\u011B\u012A-\u012B\u014C-\u014D\u016A-\u016B0-9]$/;
  var KANA = /^[\u3041-\u309F\u30A0-\u30FF\u30FC]$/;
  var ROMAJI = /^[A-Za-z\u0100-\u014D\u014C-\u014D\u016A-\u016B\u00F4\u00F6\-]$/;

  /* Whole-word test: must stay separate from LATIN, which matches one
     character only. */
  var PLAIN_WORD = /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\u1E00-\u1EFF]+$/;

  function canSpell(word) {
    return PLAIN_WORD.test(String(word || '').trim());
  }

  function isLetterChar(char, practice) {
    if (practice === 'pinyin') return PINYIN.test(char);
    if (practice === 'kana' || practice === 'katakana') {
      return ROMAJI.test(char) || KANA.test(char);
    }
    return LATIN.test(char);
  }

  function toChars(text) {
    return Array.from(String(text == null ? '' : text).normalize('NFC'));
  }

  function fold(char) {
    return String(char).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function normalizeInput(raw, maxLength, practice) {
    var chars = toChars(raw);
    var kept = [];
    for (var i = 0; i < chars.length && kept.length < maxLength; i += 1) {
      if (isLetterChar(chars[i], practice)) kept.push(chars[i]);
    }
    return kept.join('');
  }

  /* ---------- Pinyin ---------- */

  var PINYIN_TONES = {
    'ā': ['a', '1'], 'á': ['a', '2'], 'ǎ': ['a', '3'], 'à': ['a', '4'],
    'ē': ['e', '1'], 'é': ['e', '2'], 'ě': ['e', '3'], 'è': ['e', '4'],
    'ī': ['i', '1'], 'í': ['i', '2'], 'ǐ': ['i', '3'], 'ì': ['i', '4'],
    'ō': ['o', '1'], 'ó': ['o', '2'], 'ǒ': ['o', '3'], 'ò': ['o', '4'],
    'ū': ['u', '1'], 'ú': ['u', '2'], 'ǔ': ['u', '3'], 'ù': ['u', '4'],
    'ǖ': ['v', '1'], 'ǘ': ['v', '2'], 'ǚ': ['v', '3'], 'ǜ': ['v', '4'],
    'ü': ['v', '']
  };

  /* Returns { base, tone } so that qīng / qing1 / qing all land on the same
     base and differ only in tone. */
  function normalizePinyin(text) {
    var raw = String(text == null ? '' : text).trim().toLowerCase().replace(/\s+/g, '');
    var base = '';
    var tone = '';
    toChars(raw).forEach(function (ch) {
      if (Object.prototype.hasOwnProperty.call(PINYIN_TONES, ch)) {
        base += PINYIN_TONES[ch][0];
        if (PINYIN_TONES[ch][1]) tone = PINYIN_TONES[ch][1];
        return;
      }
      if (ch >= '1' && ch <= '5') {
        /* A digit tone replaces whatever a diacritic said; 5 is neutral. */
        tone = ch === '5' ? '' : ch;
        return;
      }
      base += ch;
    });
    return { base: base.replace(/ü/g, 'v'), tone: tone };
  }

  /* perfect = syllable and tone both match; tone = syllable right, tone wrong
     or missing; wrong = the syllable itself differs. */
  function judgePinyin(typed, answer) {
    var given = normalizePinyin(typed);
    var want = normalizePinyin(answer);
    var answerChars = toChars(want.base);
    var marks = answerChars.map(function (ch, i) { return given.base[i] === ch; });
    if (given.base !== want.base) return { status: 'wrong', marks: marks };
    if (given.tone !== want.tone) return { status: 'tone', marks: marks.map(function () { return true; }) };
    return { status: 'perfect', marks: marks.map(function () { return true; }) };
  }

  /* ---------- Kana ---------- */

  /* Romaji to kana. Alternate romanisations are included so a learner using
     kunrei-shiki (si, ti, tu, hu) is not marked wrong for spelling it their
     way. */
  var ROMAJI_TO_KANA = {
    a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
    ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
    sa: 'さ', si: 'し', shi: 'し', su: 'す', se: 'せ', so: 'そ',
    ta: 'た', ti: 'ち', chi: 'ち', tu: 'つ', tsu: 'つ', te: 'て', to: 'と',
    na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
    ha: 'は', hi: 'ひ', hu: 'ふ', fu: 'ふ', he: 'へ', ho: 'ほ',
    ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
    ya: 'や', yu: 'ゆ', yo: 'よ',
    ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
    wa: 'わ', wi: 'うぃ', we: 'うぇ', wo: 'を', n: 'ん',
    ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
    za: 'ざ', zi: 'じ', ji: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
    da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
    ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
    pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
    kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
    sha: 'しゃ', shu: 'しゅ', sho: 'しょ', sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
    cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ',
    nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
    hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
    mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
    rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
    gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
    ja: 'じゃ', ju: 'じゅ', jo: 'じょ', zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
    bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
    pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
    fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
    va: 'ヴぁ', vi: 'ヴぃ', vu: 'ヴ', ve: 'ヴぇ', vo: 'ヴぉ'
  };

  var KANA_TO_ROMAJI = (function () {
    var map = {};
    Object.keys(ROMAJI_TO_KANA).forEach(function (romaji) {
      var kana = ROMAJI_TO_KANA[romaji];
      if (!Object.prototype.hasOwnProperty.call(map, kana)) map[kana] = romaji;
    });
    return map;
  })();

  var LONG_VOWEL = /ō|ô|oo|ou|uu|û|ū/g;

  /* long vowels collapse so seikou / seikoo / seikō are the same answer. */
  function foldLong(romaji) {
    return String(romaji).toLowerCase().replace(LONG_VOWEL, 'ou');
  }

  function hiraganaToKatakana(text) {
    return String(text).replace(/[\u3041-\u3096]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) + 0x60);
    });
  }

  function katakanaToHiragana(text) {
    return String(text).replace(/[\u30A1-\u30F6]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0x60);
    });
  }

  /* Romaji to hiragana, handling 促音 (doubled consonant) and ん. */
  function romajiToHiragana(text) {
    var s = String(text).toLowerCase().replace(/\s+/g, '');
    var out = '';
    var i = 0;
    while (i < s.length) {
      if (s[i] === '-') { out += 'ー'; i += 1; continue; }
      if (s[i] === 'n' && (i + 1 >= s.length || !/[aeiouy]/.test(s[i + 1]))) {
        out += 'ん'; i += 1; continue;
      }
      var three = s.slice(i, i + 3);
      var two = s.slice(i, i + 2);
      if (Object.prototype.hasOwnProperty.call(ROMAJI_TO_KANA, three)) { out += ROMAJI_TO_KANA[three]; i += 3; continue; }
      if (Object.prototype.hasOwnProperty.call(ROMAJI_TO_KANA, two)) { out += ROMAJI_TO_KANA[two]; i += 2; continue; }
      var one = s[i];
      if (Object.prototype.hasOwnProperty.call(ROMAJI_TO_KANA, one)) { out += ROMAJI_TO_KANA[one]; i += 1; continue; }
      /* A doubled consonant that is not a digraph is 促音. */
      if (one === s[i + 1] && one !== 'n') { out += 'っ'; i += 1; continue; }
      out += s[i];
      i += 1;
    }
    return out;
  }

  function hiraganaToRomaji(text) {
    var s = String(text);
    var out = '';
    var i = 0;
    while (i < s.length) {
      if (s[i] === 'っ') { out += 'q'; i += 1; continue; }
      if (s[i] === 'ー') { out += 'ou'; i += 1; continue; }
      var two = s.slice(i, i + 2);
      if (KANA_TO_ROMAJI[two]) { out += KANA_TO_ROMAJI[two]; i += 2; continue; }
      if (KANA_TO_ROMAJI[s[i]]) { out += KANA_TO_ROMAJI[s[i]]; i += 1; continue; }
      out += s[i];
      i += 1;
    }
    /* 促音 was kept as q; expand it into the doubled consonant it stands for. */
    return out.replace(/q([a-z])/g, '$1$1');
  }

  /* Whichever way it was typed, land on one canonical hiragana string. */
  function normalizeKana(text, script) {
    var raw = String(text == null ? '' : text).normalize('NFC');
    var hasKana = /[\u3041-\u309F\u30A0-\u30FF]/.test(raw);
    var hira = hasKana ? katakanaToHiragana(raw) : romajiToHiragana(raw);
    if (script === 'katakana') return hiraganaToKatakana(hira);
    return hira;
  }

  function kanaEquivalent(a, b) {
    return foldLong(hiraganaToRomaji(katakanaToHiragana(a))) ===
      foldLong(hiraganaToRomaji(katakanaToHiragana(b)));
  }

  /* expected: the reading (or the katakana word). variants: other accepted
     spellings, e.g. 表記のゆれ. okurigana: for wago, the part that must be
     spelled out, so a mismatch there can be named specifically. */
  function judgeKana(typed, expected, script, variants, okurigana) {
    var given = normalizeKana(typed, script);
    var want = normalizeKana(expected, script);
    var accepted = [want].concat((variants || []).map(function (v) { return normalizeKana(v, script); }));

    if (accepted.some(function (form) { return kanaEquivalent(given, form); })) {
      return { status: 'perfect', marks: want.split('').map(function () { return true; }) };
    }

    var marks = want.split('').map(function (ch, i) { return given[i] === ch; });
    var result = { status: 'wrong', marks: marks };

    /* If only the tail is wrong and that tail is the okurigana, say so. */
    if (okurigana) {
      var tail = normalizeKana(okurigana, script);
      if (want.slice(-tail.length) === tail && given.slice(-tail.length) !== tail) {
        result.note = 'okurigana';
        result.expectedTail = tail;
      }
    }
    return result;
  }

  /* ---------- Latin-script judging ---------- */

  function judgeSpelling(typed, answer, variants) {
    var expected = toChars(String(answer).normalize('NFC'));
    var given = toChars(String(typed).normalize('NFC'));
    var accepted = [answer].concat(variants || []);

    var perfect = accepted.some(function (form) {
      var chars = toChars(form);
      if (chars.length !== given.length) return false;
      return chars.every(function (ch, i) { return fold(given[i]) === fold(ch); });
    });
    var marks = expected.map(function (ch, i) {
      return i < given.length && fold(given[i]) === fold(ch);
    });
    return { status: perfect ? 'perfect' : 'wrong', marks: marks };
  }

  function judgeAnswer(exercise) {
    var variants = exercise.variants || [];
    if (exercise.practice === 'pinyin') return judgePinyin(exercise.typed, exercise.answer);
    if (exercise.practice === 'kana' || exercise.practice === 'katakana') {
      return judgeKana(exercise.typed, exercise.answer, exercise.practice, variants, exercise.okurigana);
    }
    return judgeSpelling(exercise.typed, exercise.answer, variants);
  }

  /* What the learner sees as they type. Japanese is shown as kana because that
     is what they are producing. */
  function displayChars(exercise) {
    if (exercise.practice === 'kana' || exercise.practice === 'katakana') {
      return toChars(normalizeKana(exercise.typed, exercise.practice));
    }
    return toChars(exercise.typed);
  }

  function answerChars(exercise) {
    if (exercise.practice === 'kana' || exercise.practice === 'katakana') {
      return toChars(normalizeKana(exercise.answer, exercise.practice));
    }
    return toChars(exercise.answer);
  }

  /* ---------- Exercise model ---------- */

  /* item: { word, reading, meaning, language, practice, entryId, mode,
            progress, variants, okurigana } */
  function createExercise(item) {
    var practice = item.practice || 'spell';
    var answer = practice === 'kana' || practice === 'katakana'
      ? normalizeKana(item.reading || item.word, practice)
      : (practice === 'pinyin' ? String(item.reading || '') : String(item.word || ''));
    return {
      item: item,
      practice: practice,
      answer: answer,
      /* The translation shown while the word is still hidden, already resolved
         to the explanation language this source language is set to. Resolved
         once, here, so painting a frame never touches storage. */
      meaning: meaningFor(item),
      typed: '',
      status: 'input',       /* input | correct | wrong | tone */
      reveal: false,
      note: '',
      marks: null,
      hint: 0,
      /* Set when the first submit was wrong. The word still has to be spelled
         correctly to move on, but it is remembered as "did not know it" and
         comes back in the next pass — the round treats that differently from
         skipping, which says "not now". */
      firstWrong: false,
      practiceMode: item.mode === 'practice',
      progress: item.progress || null
    };
  }

  /* ---------- The prompt ----------
     Which translation a learner is asked to produce depends on the explanation
     language they set for this source language, not on the language the stored
     entry happens to have been written in. The entry itself is the first
     candidate; if it was written in another explanation language, the sibling
     entry for the configured one is used when it is already on the device.
     Nothing is requested here — a practice round must never start spending. */
  function meaningFor(item) {
    var fallback = String((item && item.meaning) || '');
    if (!item || !item.language || !ns.store) return fallback;
    var wanted = ns.store.outputLangFor(item.language);
    if (!wanted || item.outputLang === wanted) return fallback;
    var id = ns.store.entryId(item.word || '', item.language, item.model, wanted);
    var sibling = ns.store.getEntry(id);
    var text = sibling && sibling.overview ? sibling.overview.quick_meaning : '';
    return text ? String(text) : fallback;
  }

  /* Prepare the meaning in the configured default explanation language. If
     that version is not on the device, fetch a tiny overview version and merge
     it into the same group. Practice still opens on a fallback if no key or
     the request fails. */
  function ensureDefaultMeaning(item) {
    if (!item || !item.language || !ns.store) return Promise.resolve(item);
    var wanted = ns.store.outputLangFor(item.language);
    if (!wanted || item.outputLang === wanted) return Promise.resolve(item);
    var id = ns.store.entryId(item.word || '', item.language, item.model, wanted);
    var sibling = ns.store.getEntry(id);
    if (sibling && sibling.overview) return Promise.resolve(item);
    var settings = ns.store.getSettings();
    if (!settings.apiKey || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      item.meaningFallback = true;
      return Promise.resolve(item);
    }
    return ns.api.overview({
      apiKey: settings.apiKey, model: item.model || settings.model,
      sourceLang: item.language, outputLang: wanted, input: item.word
    }).then(function (overview) {
      if (overview && overview.quick_meaning) {
        ns.store.saveEntry({
          id: id, kind: 'word', word: item.word, language: item.language,
          model: item.model || settings.model, outputLang: wanted,
          overview: overview, lines: {}, ts: Date.now(), starred: false
        });
      }
      return item;
    }).catch(function () {
      item.meaningFallback = true;
      return item;
    });
  }

  function openWithMeaning(item, options) {
    ensureDefaultMeaning(item).then(function (prepared) {
      open(prepared, options);
      if (prepared.meaningFallback && refs.prompt) {
        ns.ui.toast(ns.ui.t('practice.meaningFallback'), { ms: 5000 });
      }
    });
  }

  /* The tone of every pinyin syllable, deduced from the tone marks themselves:
     a syllable carries at most one marked vowel, so walking the marks gives the
     pattern without needing a syllable splitter. Neutral tone stays 5. */
  var TONE_MARKS = [
    ['āēīōūǖ', 1], ['áéíóúǘ', 2], ['ǎěǐǒǔǚ', 3], ['àèìòùǜ', 4]
  ];

  function tonePatternOf(reading) {
    var text = String(reading || '');
    var tones = [];
    for (var i = 0; i < text.length; i += 1) {
      var ch = text.charAt(i);
      for (var t = 0; t < TONE_MARKS.length; t += 1) {
        if (TONE_MARKS[t][0].indexOf(ch) > -1) { tones.push(TONE_MARKS[t][1]); break; }
      }
    }
    return tones;
  }

  /* Small kana and the sokuon are counted the way a learner counts a word out
     loud: きょう is two mora, がっこう is four. */
  var SMALL_KANA = 'ゃゅょぁぃぅぇぉャュョァィゥェォ';

  function moraCount(reading) {
    var text = String(reading || '');
    var count = 0;
    for (var i = 0; i < text.length; i += 1) {
      if (SMALL_KANA.indexOf(text.charAt(i)) > -1) continue;
      count += 1;
    }
    return count;
  }

  function answerLength(exercise) {
    return answerChars(exercise).length;
  }

  /* Japanese is typed in romaji, which is roughly two to three times longer
     than the kana it produces, so the cap cannot be the answer length. */
  function inputLimit(exercise) {
    var answer = answerLength(exercise);
    if (exercise.practice === 'kana' || exercise.practice === 'katakana') {
      return Math.max(answer * 4, 12);
    }
    return answer;
  }

  function applyInput(exercise, raw) {
    /* Typing after a wrong attempt starts a new one. Without this the layer
       ignored every keystroke while `status` was `wrong`, then wrote the old
       attempt back into the field — the previous mistake reappeared on every
       key. The answer stays visible, because that is what the reader is
       copying from. */
    if (exercise.status === 'wrong') {
      exercise.typed = '';
      exercise.status = 'input';
      exercise.marks = null;
      exercise.note = '';
      exercise.expectedTail = '';
    }
    if (exercise.status !== 'input') return exercise;
    exercise.typed = normalizeInput(raw, inputLimit(exercise), exercise.practice);
    return exercise;
  }

  function applySubmit(exercise) {
    if (exercise.status === 'wrong') {
      exercise.typed = '';
      exercise.status = 'input';
      exercise.note = '';
      exercise.marks = null;
      exercise.expectedTail = '';
      /* The answer stays on screen while it is retyped. */
      return exercise;
    }
    if (!exercise.typed) return exercise;

    var verdict = judgeAnswer(exercise);
    exercise.marks = verdict.marks;
    if (verdict.status === 'perfect') {
      exercise.status = 'correct';
      exercise.reveal = false;
      exercise.note = '';
    } else if (verdict.status === 'tone') {
      /* Chinese: the syllable is right, the tone is not. That is a different
         failure from not knowing the word, so it does not read as wrong. */
      exercise.status = 'correct';
      exercise.reveal = false;
      exercise.note = 'tone';
    } else {
      exercise.status = 'wrong';
      exercise.reveal = true;
      exercise.note = verdict.note || '';
      exercise.expectedTail = verdict.expectedTail || '';
      exercise.firstWrong = true;
    }
    return exercise;
  }

  function applyHint(exercise) {
    if (exercise.hint < 2) exercise.hint += 1;
    return exercise;
  }

  /* ---------- DOM layer ---------- */

  var root = null;
  var refs = {};
  var current = null;
  var advanceTimer = null;
  var returnFocus = null;
  var onAdvance = null;
  var onSkip = null;

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function build() {
    if (root) return;
    var ui = ns.ui;

    root = el('div', 'spell-layer');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', ui.t('practice.title'));
    root.hidden = true;
    root.innerHTML =
      '<div class="spell-top">' +
        '<button type="button" class="spell-icon" data-spell="star" aria-label="' + ui.esc(ui.t('practice.star')) + '">' + ui.icon('star') + '</button>' +
        '<button type="button" class="spell-icon" data-spell="replay" aria-label="' + ui.esc(ui.t('practice.replay')) + '">' + ui.icon('speaker') + '</button>' +
        /* Skipping belongs to a round: there is a "next word" to move to. In a
           single-word session the button is hidden, and the × at the bottom
           left is the way out — as it always was. */
        '<button type="button" class="spell-exit" data-spell="skip" hidden>' + ui.icon('skip') +
          '<span data-spell-skip-label>' + ui.esc(ui.t('practice.skip')) + '</span></button>' +
      '</div>' +
      '<div class="spell-stage">' +
        '<div class="spell-prompt" data-spell-prompt></div>' +
        '<div class="spell-hint" data-spell-hint hidden></div>' +
        '<div class="spell-word" data-spell-word></div>' +
        '<div class="spell-answer" data-spell-answer hidden></div>' +
        '<div class="spell-note" data-spell-note hidden></div>' +
      '</div>' +
      '<div class="spell-dots" data-spell-dots hidden></div>' +
      '<div class="spell-tools">' +
        '<button type="button" class="spell-btn" data-spell="close" aria-label="' + ui.esc(ui.t('practice.close')) + '">' + ui.icon('close') + '</button>' +
        '<button type="button" class="spell-btn" data-spell="hint" aria-label="' + ui.esc(ui.t('practice.hint')) + '">' + ui.icon('bulb') + '</button>' +
        '<button type="button" class="spell-btn" data-spell="submit" aria-label="' + ui.esc(ui.t('practice.check')) + '">' + ui.icon('check') + '</button>' +
      '</div>' +
      '<input class="spell-input" data-spell-input type="text" autocomplete="off" ' +
        'autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="' +
        ui.esc(ui.t('practice.input')) + '">';

    document.body.appendChild(root);

    refs.hint = root.querySelector('[data-spell-hint]');
    refs.prompt = root.querySelector('[data-spell-prompt]');
    refs.word = root.querySelector('[data-spell-word]');
    refs.answer = root.querySelector('[data-spell-answer]');
    refs.note = root.querySelector('[data-spell-note]');
    refs.dots = root.querySelector('[data-spell-dots]');
    refs.input = root.querySelector('[data-spell-input]');
    refs.star = root.querySelector('[data-spell="star"]');
    refs.replay = root.querySelector('[data-spell="replay"]');
    refs.submit = root.querySelector('[data-spell="submit"]');
    refs.hintBtn = root.querySelector('[data-spell="hint"]');
    refs.skipBtn = root.querySelector('[data-spell="skip"]');
    refs.skipLabel = root.querySelector('[data-spell-skip-label]');

    root.addEventListener('click', function (event) {
      var action = event.target.closest('[data-spell]');
      if (action) { handle(action.getAttribute('data-spell')); return; }
      if (refs.input) refs.input.focus();
    });

    /* An input method — Japanese kana, Chinese pinyin, a dead key on macOS —
       builds a character over several events. Writing the model's own value
       back on every one of them interrupted the composition, so the layer stays
       out of the way until the composition commits. */
    var composing = false;

    refs.input.addEventListener('compositionstart', function () { composing = true; });
    refs.input.addEventListener('compositionend', function () {
      composing = false;
      if (!current) return;
      applyInput(current, refs.input.value);
      refs.input.value = current.typed;
      render();
    });

    refs.input.addEventListener('input', function (event) {
      if (composing || (event && event.isComposing)) return;
      if (!current) return;
      applyInput(current, refs.input.value);
      refs.input.value = current.typed;
      render();
    });

    refs.input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); handle('submit'); }
      else if (event.key === 'Escape') { event.preventDefault(); handle('close'); }
    });

    /* The layer is modal, so Tab must not walk out of it into the page behind. */
    root.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab') return;
      var focusable = [].slice.call(root.querySelectorAll('button:not([disabled])'))
        .concat(refs.input ? [refs.input] : []);
      if (!focusable.length) return;
      event.preventDefault();
      var index = focusable.indexOf(document.activeElement);
      var step = event.shiftKey ? -1 : 1;
      focusable[(index + step + focusable.length) % focusable.length].focus();
    });
  }

  function handle(action) {
    if (!current) return;
    if (action === 'close') { close(); return; }
    if (action === 'skip') {
      /* The round decides what "next" means — including the pass that comes
         back to the words skipped in this one. Nothing to go to means the
         round is over. */
      if (advanceTimer) { window.clearTimeout(advanceTimer); advanceTimer = null; }
      var next = typeof onSkip === 'function' ? onSkip() : null;
      if (next) open(next);
      else close();
      return;
    }
    if (action === 'replay') {
      /* The button is disabled until a hint has been asked for; the guard keeps
         a keyboard or a script from going around it. */
      if (current.hint >= 1) speak(current.item);
      return;
    }
    if (action === 'star') { toggleStar(); return; }
    if (action === 'hint') { applyHint(current); render(); return; }
    if (action === 'submit') {
      var before = current.status;
      applySubmit(current);
      render();
      if (before === 'input' && current.status === 'correct') {
        advanceTimer = window.setTimeout(settle, 900);
      }
    }
  }

  function settle() {
    if (!current || current.status !== 'correct') return;
    var outcome = current.firstWrong ? 'unknown' : 'known';
    if (ns.roots && current.item) ns.roots.recordWordOutcome(current.item, outcome);
    if (current.practiceMode && typeof onAdvance === 'function') {
      /* Tell the round how it went. "unknown" means the first attempt was
         wrong, even though the word was eventually spelled right: it belongs
         in the next pass just as a skipped word does. */
      var next = onAdvance({ outcome: outcome });
      if (next) { ensureDefaultMeaning(next).then(function (prepared) { open(prepared); }); return; }
    }
    close();
  }

  /* Always speak the headword itself, not the reading: a zh-CN voice reads 青 as
     "qīng" and a ja-JP voice reads 成功 as せいこう, which is exactly the prompt
     the exercise wants. */
  var SPEECH_TAG = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', es: 'es-ES', ja: 'ja-JP', zh: 'zh-CN' };

  function speak(item) {
    if (!item || !item.word) return;
    ns.speech.speak(item.word, SPEECH_TAG[item.language] || 'en-US');
  }

  function toggleStar() {
    if (!current || !current.item.entryId) return;
    var starred = ns.store.toggleStar(current.item.entryId);
    if (refs.star) refs.star.classList.toggle('is-starred', starred);
  }

  /* ---------- Render ---------- */

  /* The first hint for one exercise. Separate from render() because it is the
     part worth testing: what it returns must never be the answer. */
  function firstHint(exercise) {
    if (!exercise) return '';
    var item = exercise.item || {};
    var reading = String(item.reading || '');
    if (exercise.practice === 'pinyin') {
      var tones = tonePatternOf(reading || exercise.answer);
      return tones.length ? ns.ui.t('practice.toneHint', { tones: tones.join(' + ') }) : '';
    }
    if (exercise.practice === 'kana' || exercise.practice === 'katakana') {
      var count = moraCount(exercise.answer || reading);
      return count ? ns.ui.t('practice.moraHint', { n: count }) : '';
    }
    return reading;
  }

  function render() {
    if (!root || !current) return;
    var ui = ns.ui;
    var want = answerChars(current);
    var given = displayChars(current);
    var marks = current.status === 'wrong' ? current.marks : null;

    var html = '';
    for (var i = 0; i < want.length; i += 1) {
      if (current.status === 'input' && i === given.length) html += '<span class="spell-caret"></span>';
      var shown = i < given.length ? given[i] : '';
      var cls = 'spell-ch';
      if (current.status === 'correct') cls += ' is-ok';
      else if (marks) cls += marks[i] ? ' is-ok' : (shown ? ' is-bad' : ' is-missing');
      else cls += shown ? ' is-neutral' : ' is-empty';
      html += '<span class="' + cls + '">' + ui.esc(shown || '_') + '</span>';
    }
    if (current.status === 'input' && given.length === want.length) html += '<span class="spell-caret"></span>';
    refs.word.innerHTML = html;
    refs.word.setAttribute('data-status', current.status);

    /* Skip only exists when there is a queue behind this word. */
    if (refs.skipBtn) {
      var canSkip = !!current.practiceMode && typeof onSkip === 'function';
      refs.skipBtn.hidden = !canSkip;
      if (canSkip) refs.skipBtn.setAttribute('aria-label', ui.t('practice.skip'));
    }
    if (refs.skipLabel) refs.skipLabel.textContent = ui.t('practice.skip');

    refs.answer.hidden = !current.reveal;
    refs.answer.textContent = current.reveal ? want.join('') : '';

    var note = '';
    if (current.status === 'correct' && current.note === 'tone') {
      note = ui.t('practice.tone', { answer: current.answer });
    } else if (current.status === 'wrong' && current.note === 'okurigana') {
      note = ui.t('practice.okurigana', { answer: current.expectedTail });
    }
    if (!note && current.firstWrong && current.item && current.item.primaryRoot) {
      note = ui.t('roots.spellNote', {
        root: current.item.primaryRoot.display || '',
        meaning: current.item.primaryRoot.meaning || ''
      });
    }
    refs.note.hidden = !note;
    refs.note.textContent = note;

    /* Playback is a hint about the word itself, so it stays locked until one
       hint has been asked for. Nothing is spoken automatically: a layer that
       reads the answer out loud the moment it appears is a dictation exercise,
       not a spelling one. */
    if (refs.replay) {
      var canPlay = current.hint >= 1;
      refs.replay.disabled = !canPlay;
      refs.replay.setAttribute('aria-label',
        ui.t(canPlay ? 'practice.replay' : 'practice.replayLocked'));
      refs.replay.setAttribute('title',
        ui.t(canPlay ? 'practice.replay' : 'practice.replayLocked'));
    }

    /* What is being asked is on screen from the first frame: the part of speech
       and the meaning, in the explanation language this source language is set
       to. It is a prompt, not a hint — reading it is the whole exercise. */
    if (refs.prompt) {
      var pos = current.item && current.item.pos ? String(current.item.pos) : '';
      var meaning = String(current.meaning || current.item.meaning || '');
      var promptHtml = '';
      var langName = current.item && (current.item.languageName || current.item.language);
      if (langName) {
        var langCode = current.item.languageCode || current.item.language || '';
        promptHtml += '<span class="spell-lang">' + ui.esc(langName) +
          (langCode ? ' · ' + ui.esc(String(langCode).toUpperCase()) : '') + '</span>';
      }
      if (pos) promptHtml += '<span class="spell-pos">' + ui.esc(pos) + '</span>';
      if (meaning) promptHtml += '<span class="spell-meaning">' + ui.esc(meaning) + '</span>';
      refs.prompt.innerHTML = promptHtml;
      refs.prompt.hidden = !promptHtml;
    }

    /* A hint must never hand over the answer. For English, French and German
       the reading is IPA, which is useful and different from the spelling; for
       Chinese and Japanese the reading *is* the answer, so the first hint gives
       the tone pattern or the mora count instead. */
    var hintText = '';
    if (current.hint >= 1) hintText = firstHint(current);
    if (current.hint >= 2) {
      var first = want[0] || '';
      var more = first ? ui.t('practice.startsWith', { char: first }) : '';
      hintText = hintText ? hintText + ' · ' + more : more;
    }
    refs.hint.hidden = !hintText;
    refs.hint.textContent = hintText;

    if (current.progress && current.progress.total > 1) {
      refs.dots.hidden = false;
      var dots = '';
      var skippedAt = current.progress.skipped || [];
      var unknownAt = current.progress.unknown || [];
      for (var d = 0; d < current.progress.total; d += 1) {
        /* Five states, in this order of precedence: skipped (pale accent) and
           did-not-know (pale amber) stay marked for the rest of the pass, a
           finished word is solid, the word being asked now is a ring, and the
           rest are grey. */
        var dotClass = 'spell-dot';
        if (skippedAt.indexOf(d) > -1) dotClass += ' is-skipped';
        else if (unknownAt.indexOf(d) > -1) dotClass += ' is-unknown';
        else if (d < current.progress.done) dotClass += ' is-done';
        else if (d === current.progress.index) dotClass += ' is-current';
        dots += '<span class="' + dotClass + '"></span>';
      }
      refs.dots.innerHTML = dots;
    } else {
      refs.dots.hidden = true;
      refs.dots.innerHTML = '';
    }

    refs.submit.disabled = current.status === 'input' && !current.typed;
    refs.submit.setAttribute('data-mode', current.status === 'wrong' ? 'retry' : 'check');
    refs.submit.setAttribute('aria-label',
      ui.t(current.status === 'wrong' ? 'practice.retry' : 'practice.check'));
    refs.hintBtn.disabled = current.hint >= 2;
    refs.star.classList.toggle('is-starred',
      !!(current.item.entryId && ns.store.isStarred(current.item.entryId)));
  }

  /* ---------- Open / close ---------- */

  /* The layer lives on <body>, outside the router, so nothing used to close it
     when the route changed: on a phone the back gesture or the browser's back
     button would move the screen underneath while the layer stayed on top, and
     the only way out was the one small × in the toolbar. Both are fixed here —
     the layer follows the route, and there is a labelled way out. */
  function onRouteChange() { close(); }

  function open(item) {
    build();
    if (advanceTimer) { window.clearTimeout(advanceTimer); advanceTimer = null; }
    current = createExercise(item);
    root.hidden = false;
    document.body.classList.add('is-spelling');
    returnFocus = document.activeElement;
    window.addEventListener('hashchange', onRouteChange);
    render();
    if (refs.input) { refs.input.value = ''; refs.input.focus(); }
  }

  function close() {
    if (advanceTimer) { window.clearTimeout(advanceTimer); advanceTimer = null; }
    ns.speech.stop();
    current = null;
    onAdvance = null;
    onSkip = null;
    window.removeEventListener('hashchange', onRouteChange);
    if (root) root.hidden = true;
    document.body.classList.remove('is-spelling');
    /* Put the caret back where the user left it, rather than at the top of the
       document. */
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
    returnFocus = null;
  }

  ns.practice = {
    /* pure — normalisers */
    normalizePinyin: normalizePinyin,
    normalizeKana: normalizeKana,
    romajiToHiragana: romajiToHiragana,
    hiraganaToRomaji: hiraganaToRomaji,
    hiraganaToKatakana: hiraganaToKatakana,
    katakanaToHiragana: katakanaToHiragana,
    foldLong: foldLong,
    kanaEquivalent: kanaEquivalent,
    /* pure — judging */
    judgePinyin: judgePinyin,
    judgeKana: judgeKana,
    judgeSpelling: judgeSpelling,
    judgeAnswer: judgeAnswer,
    canSpell: canSpell,
    normalizeInput: normalizeInput,
    toChars: toChars,
    fold: fold,
    answerChars: answerChars,
    displayChars: displayChars,
    /* pure — state machine */
    createExercise: createExercise,
    applyInput: applyInput,
    applySubmit: applySubmit,
    applyHint: applyHint,
    meaningFor: meaningFor,
    ensureDefaultMeaning: ensureDefaultMeaning,
    firstHint: firstHint,
    tonePatternOf: tonePatternOf,
    moraCount: moraCount,
    /* dom */
    open: function (item, options) {
      onAdvance = options && options.onAdvance ? options.onAdvance : null;
      onSkip = options && options.onSkip ? options.onSkip : null;
      open(item);
    },
    openWithMeaning: openWithMeaning,
    close: close,
    isOpen: function () { return !!current; },
    current: function () { return current; }
  };
})(window.LINGUIST);
