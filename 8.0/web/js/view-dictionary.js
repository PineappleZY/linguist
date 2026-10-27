/* LINGUIST — Dictionary screen.

   Type (Auto / Word / Sentence), language, search, candidate panels, and the
   history grouped by day. Favourites lives on its own tab. */

window.LINGUIST = window.LINGUIST || {};
window.LINGUIST.views = window.LINGUIST.views || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var store = ns.store;
  var CONFIG = ns.CONFIG;

  var NON_LATIN = /[\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/;
  var HAS_ACCENT = /[\u00C0-\u024F\u1E00-\u1EFF\u0100-\u014D\u016A-\u016B]/;

  function isNonLatin(text) { return NON_LATIN.test(text); }
  function hasAccent(text) { return HAS_ACCENT.test(text); }
  function words(text) {
    return String(text).trim().split(/\s+/).filter(function (part) { return part.length > 0; }).length;
  }

  function languageMeta(id) {
    var list = CONFIG.languages;
    for (var i = 0; i < list.length; i += 1) if (list[i].id === id) return list[i];
    return null;
  }

  function currentLang() { return store.getSettings().queryLang || CONFIG.autoLang; }
  function currentMode() { return ns.session.mode || 'auto'; }

  /* ---------- Type detection ---------- */

  /* A cheap guess that costs nothing. When it guesses "word" and the model
     disagrees, view-word falls back to sentence analysis — so a wrong guess
     costs a second, never a wrong answer. */
  function looksLikeSentence(text, lang) {
    var heuristic = CONFIG.sentenceHeuristic;
    var trimmed = String(text).trim();
    if (!trimmed) return false;
    if (heuristic.enders.indexOf(trimmed.slice(-1)) > -1) return true;

    var meta = lang === CONFIG.autoLang ? null : languageMeta(lang);
    var script = meta ? meta.script : (isNonLatin(trimmed) ? 'han' : 'latin');
    if (script === 'latin') return words(trimmed) > heuristic.maxWords;
    return Array.from(trimmed.replace(/\s+/g, '')).length > heuristic.maxChars;
  }

  function resolveMode(text, selected) {
    if (selected === 'word' || selected === 'sentence' || selected === 'file') return selected;
    return looksLikeSentence(text, currentLang()) ? 'sentence' : 'word';
  }

  /* ---------- Validation ---------- */

  function validate(text, mode) {
    if (!text) return { error: 'validation.empty' };
    if (mode === 'sentence') {
      if (text.length > CONFIG.limits.maxSentenceLength) {
        return { error: 'validation.sentenceTooLong', vars: { n: CONFIG.limits.maxSentenceLength } };
      }
      /* No word-count floor: Chinese has no spaces, and a one-word sentence is
         a legitimate input. */
      return { value: text };
    }
    if (text.length > CONFIG.limits.maxInputLength) {
      return { error: 'validation.wordTooLong', vars: { n: CONFIG.limits.maxInputLength } };
    }
    if (words(text) > CONFIG.limits.maxExpressionWords) {
      return { error: 'validation.expression' };
    }
    return { value: text };
  }

  /* ---------- Opening an entry ---------- */

  function openWord(word, language, autoMode, outputLang) {
    var settings = store.getSettings();
    var lang = language || (currentLang() === CONFIG.autoLang ? null : currentLang());
    /* The explanation language follows the source language through the user's
       per-language table. With the picker on Auto the language is not known
       yet, so the fallback is used for the provisional key and the entry is
       re-keyed once the overview names the language. */
    var out = outputLang || store.outputLangFor(lang || CONFIG.autoLang);
    var id = store.entryId(word, lang || 'auto', settings.model, out);
    var cached = store.getEntry(id);

    if (cached && cached.lines) {
      ns.session.pending = null;
      location.hash = '#/word/' + encodeURIComponent(id);
      ns.router.refresh();
      return;
    }
    ns.session.pending = {
      id: id, input: word, label: word, language: lang || 'auto',
      kind: 'word', autoMode: !!autoMode, outputLang: out, outputLangFixed: !!outputLang
    };
    location.hash = '#/word/' + encodeURIComponent(id);
    ns.router.refresh();
  }

  function openSentence(text, language, outputLang) {
    var settings = store.getSettings();
    var lang = language || (currentLang() === CONFIG.autoLang ? null : currentLang());
    var out = outputLang || store.outputLangFor(lang || CONFIG.autoLang);
    var id = store.sentenceId(text, lang || 'auto', settings.model, out);
    var cached = store.getEntry(id);
    if (cached && cached.lines) {
      ns.session.pending = null;
      location.hash = '#/word/' + encodeURIComponent(id);
      ns.router.refresh();
      return;
    }
    ns.session.pending = {
      id: id, input: text, text: text,
      label: text.split(/\s+/).slice(0, 4).join(' ') + (words(text) > 4 ? '…' : ''),
      language: lang || 'auto', kind: 'sentence', outputLang: out, outputLangFixed: !!outputLang
    };
    location.hash = '#/word/' + encodeURIComponent(id);
    ns.router.refresh();
  }

  /* ---------- Opening a file ----------
     The reader names the language; nothing here guesses it. Getting that wrong
     would send the whole text through the wrong prompts, and the cost of the
     mistake is the whole document. */

  function openDocument(name, text, language, outputLang) {
    var settings = store.getSettings();
    var lang = language || (currentLang() === CONFIG.autoLang ? null : currentLang());
    var out = outputLang || store.outputLangFor(lang || CONFIG.autoLang);
    var id = store.documentId(name, text, lang, settings.model, out);
    var cached = store.getEntry(id);
    if (cached && cached.lines) {
      ns.session.pending = null;
      location.hash = '#/word/' + encodeURIComponent(id);
      ns.router.refresh();
      return;
    }
    ns.session.pending = {
      id: id, input: name, name: name, text: text, label: name,
      language: lang || CONFIG.autoLang, kind: 'document',
      outputLang: out, outputLangFixed: !!outputLang
    };
    location.hash = '#/word/' + encodeURIComponent(id);
    ns.router.refresh();
  }

  /* ---------- File mode ---------- */

  function fileState() {
    if (!ns.session.file) ns.session.file = null;
    return ns.session.file;
  }

  function fileLanguage() { return ns.session.fileLang || ''; }

  function readableChars(file) { return file && file.text ? file.text.length : 0; }

  /* Read the file now, not on submit: the reader has to see what was found —
     the character count, the number of requests it will cost, or the reason it
     cannot be read — before spending anything. */
  function acceptFile(file) {
    var limits = CONFIG.limits.document;
    if (!file) return;
    if (!ns.extract.isSupported(file.name)) {
      ns.session.file = { name: file.name, size: file.size, state: 'error', error: ui.t('file.unsupported') };
      ns.router.refresh();
      return;
    }
    ns.session.file = { name: file.name, size: file.size, state: 'reading' };
    ns.router.refresh();

    ns.extract.extract(file, function (page, total) {
      var state = ns.session.file;
      if (!state || state.state !== 'reading') return;
      state.page = page;
      state.pages = total;
      ns.router.refresh();
    }).then(function (result) {
      var text = ns.extract.normaliseText(result.text || '');
      var plan = ns.extract.planChunks(text, limits);
      var next = { name: file.name, size: file.size, state: 'ready', text: text,
        chars: text.length, chunks: plan.length, pages: result.pages || 0 };
      if (!text) {
        next.state = 'error';
        next.error = ui.t(result.kind === 'pdf' ? 'file.scanned' : 'file.empty');
      } else if (text.length > limits.maxTotal) {
        next.state = 'error';
        next.error = ui.t('file.tooLong', { n: text.length, max: limits.maxTotal });
      }
      ns.session.file = next;
      ns.router.refresh();
    }).catch(function (err) {
      var known = {
        unsupported: 'file.unsupported',
        pdf_unavailable: 'file.pdfUnavailable',
        pdf_encrypted: 'file.pdfEncrypted',
        pdf_failed: 'file.pdfFailed',
        legacy_doc: 'file.legacyDoc',
        docx_unavailable: 'file.docxUnavailable',
        docx_failed: 'file.docxFailed',
        docx_too_large: 'file.docxTooLarge',
        no_reader: 'file.noReader',
        read_failed: 'file.readFailed'
      };
      ns.session.file = {
        name: file.name, size: file.size, state: 'error',
        error: ui.t(known[err && err.code] || 'file.readFailed', {
          max: Math.round((ns.extract.MAX_DOCX_BYTES || 0) / (1024 * 1024))
        })
      };
      ns.router.refresh();
    });
  }

  function analyseFile() {
    var file = ns.session.file;
    var lang = fileLanguage();
    if (!file || file.state !== 'ready') { ui.toast(ui.t('file.needFile')); return; }
    if (!lang) { ui.toast(ui.t('file.needLang')); return; }
    openDocument(file.name, file.text, lang);
  }

  function filePanel() {
    var file = ns.session.file;
    var lang = fileLanguage();
    var limits = CONFIG.limits.document;
    var html = '<section class="card file-panel" id="file-panel">' +
      '<div class="card-head">' + ui.icon('upload') +
      '<span class="card-title">' + ui.esc(ui.t('file.title')) + '</span></div>';

    html += '<input type="file" id="file-input" accept="' + ui.esc(ns.extract.ACCEPT) + '" hidden>';

    if (!file || file.state === 'error' || file.state === 'reading') {
      html += '<button type="button" class="dropzone" id="file-drop">' + ui.icon('upload') +
        '<span>' + ui.esc(ui.t('file.drop')) + '</span></button>';
    }

    if (file && file.state === 'reading') {
      html += '<div class="doc-status" style="margin-top:12px">' + ui.icon('hourglass') +
        '<span>' + ui.esc(ui.t('file.reading')) +
        (file.pages ? ' ' + ui.esc(ui.t('doc.progress', { n: file.page || 1, total: file.pages })) : '') +
        '</span></div>';
    }

    if (file && file.state === 'error') {
      html += '<div class="notice notice-danger" style="margin-top:12px">' + ui.icon('alert') +
        '<div><div class="notice-body">' + ui.esc(file.error || '') + '</div></div></div>';
    }

    if (file && file.state === 'ready') {
      html += '<div class="file-meta">' + ui.icon('book') +
        '<span class="file-name">' + ui.esc(file.name) + '</span>' +
        '<span class="muted small nowrap">' + ui.esc(ui.t('file.chars', { n: file.chars })) + ' · ' +
        ui.esc(ui.t(file.chunks > 1 ? 'file.requests' : 'file.oneRequest', { n: file.chunks })) + '</span>' +
        '<span class="topbar-spacer"></span>' +
        '<button type="button" class="link-btn" data-file-change>' + ui.esc(ui.t('file.change')) + '</button>' +
        '<button type="button" class="link-btn" data-file-clear>' + ui.esc(ui.t('file.clear')) + '</button>' +
        '</div>';
    }

    html += '<div class="settings-row" style="margin-top:14px"><span class="settings-key">' +
      ui.esc(ui.t('file.language')) + '</span>' +
      ui.picker({
        id: 'file-lang',
        value: lang,
        compact: true,
        label: ui.t('file.language'),
        title: ui.t('file.language'),
        placeholder: ui.t('file.language.placeholder'),
        options: CONFIG.queryLanguages.map(function (item) {
          return { id: item.id, label: item.native };
        }),
        onPick: function (next) {
          ns.session.fileLang = next;
          ns.router.refresh();
        }
      }) + '</div>';

    var ready = !!(file && file.state === 'ready' && lang);
    html += '<div class="notice-actions" style="margin-top:14px">' +
      '<button type="button" class="btn btn-primary" data-file-analyse' + (ready ? '' : ' disabled') + '>' +
      ui.icon('book') + ui.esc(ui.t('file.analyse')) + '</button></div>';

    html += '<p class="hint">' + ui.esc(ui.t('file.language.hint')) + ' ' +
      ui.esc(ui.t('file.notice')) + '</p>';
    return html + '</section>';
  }

  /* ---------- Search ---------- */

  function submit(raw) {
    var selected = currentMode();
    var text = String(raw || '').trim().replace(/\s+/g, ' ');
    /* File mode has no text to type: the button beside the picker is the only
       way in, and it validates the file and the language itself. */
    if (selected === 'file') { analyseFile(); return; }
    if (!text) { ui.toast(ui.t('validation.empty')); return; }

    var mode = resolveMode(text, selected);
    var result = validate(text, mode);
    if (result.error) { ui.toast(ui.t(result.error, result.vars)); return; }
    ns.session.candidates = null;

    if (mode === 'sentence') { openSentence(result.value); return; }

    var lang = currentLang();

    /* Reverse lookup only makes sense when the target is a Latin-script
       language and the query is not: you pinned English and typed a meaning.
       In Auto a non-Latin query is simply a headword in Japanese or Chinese,
       which the overview prompt identifies. */
    if (lang !== CONFIG.autoLang && isNonLatin(text)) {
      var meta = languageMeta(lang);
      if (meta && meta.script === 'latin') { runReverse(text, lang); return; }
    }

    /* Accented language typed without diacritics: check before spending a
       full lookup. */
    var target = lang === CONFIG.autoLang ? null : languageMeta(lang);
    if (target && target.accents && !hasAccent(text)) {
      runAccentCheck(text, lang);
      return;
    }

    openWord(text, lang === CONFIG.autoLang ? null : lang, selected === 'auto');
  }

  /* ---------- Candidate panels ---------- */

  /* Where a suggested word should be looked up. A pinned language normally
     wins, unless the word is written in a script that language does not use —
     then the model ignored the instruction and its own answer is the safer
     one. Looking a Japanese word up as English can only end in not_found. */
  /* A language the app can still be asked for. Italian and Spanish are in the
     table (imported entries read fine) but no picker offers them, so a random
     word in one of them must not be looked up as if it were supported. */
  function isLiveLanguage(id) {
    return CONFIG.queryLanguages.some(function (lang) { return lang.id === id; });
  }

  /* Where a suggested word should be looked up — or '' when there is nowhere
     sensible: an unknown language ("Portuguese"), or a retired one. The caller
     treats '' as a bad pick and asks again. */
  function surpriseTarget(pinned, returned, word) {
    /* 7.0 deliberately removes the hard language ceiling. The pool itself
       controls the mix; this helper must preserve whatever the pick named so
       the caller can choose a full entry or a discovery card. */
    var said = String(returned == null ? '' : returned).trim();
    if (said) return said;
    return pinned && pinned !== CONFIG.autoLang ? pinned : CONFIG.autoLang;
  }

  /* ---------- Surprise me ----------
     It only picks something; the lookup is the ordinary pipeline. The pick is
     shown before the page changes so the jump is visible.

     The avoid list is every word this feature has ever offered, not the twelve
     most recent history rows: clicking it five times in a row left that list
     almost unchanged, so the model kept reaching for the same handful of
     words. On top of that the answer is checked here and asked for again if it
     repeats — a prompt is a request, not a guarantee. */

  var SURPRISE_SEEN_MAX = 100;
  var SURPRISE_RETRIES = 2;

  function surpriseSeen() {
    var list = store.readAux('surpriseSeen', []);
    return Array.isArray(list) ? list : [];
  }

  function rememberSurprise(word) {
    var list = surpriseSeen().filter(function (item) { return item !== word; });
    list.unshift(word);
    store.writeAux('surpriseSeen', list.slice(0, SURPRISE_SEEN_MAX));
  }

  function alreadyOffered(word) {
    return surpriseSeen().indexOf(word) > -1;
  }

  function surpriseMe(button) {
    var settings = store.getSettings();
    if (!settings.apiKey) {
      ui.toast(ui.t('error.kind.no_key'));
      location.hash = '#/profile';
      return;
    }

    var pinned = currentLang();
    var label = button.textContent;
    button.disabled = true;
    button.textContent = ui.t('dict.surprise.thinking');

    ns.pool.pick(pinned, settings).then(function (picked) {
      button.disabled = false;
      button.textContent = label;
      if (!picked || !picked.item) { ui.toast(ui.t('dict.surprise.empty')); return; }
      var item = picked.item;
      var live = CONFIG.languageByAnyName(item.code) || CONFIG.languageByAnyName(item.language);
      var supported = !!live && CONFIG.queryLanguages.some(function (lang) { return lang.id === live; });
      ns.session.query = picked.item.word;
      ns.session.surprise = { word: item.word, language: item.language, gloss: '' };
      ns.router.refresh();

      if (supported) {
        window.setTimeout(function () {
          ns.session.surprise = null;
          openWord(item.word, live);
        }, 700);
        return;
      }

      var out = store.outputLangFor('auto');
      var id = store.discoveryId(item.word, item.language, settings.model, out);
      var cached = store.getEntry(id);
      if (cached) {
        ns.session.surprise = null;
        location.hash = '#/discovery/' + encodeURIComponent(id);
        return;
      }
      ns.api.discoveryCard({
        apiKey: settings.apiKey,
        model: settings.model,
        word: item.word,
        language: item.language,
        code: item.code,
        outputLang: out
      }).then(function (card) {
        ns.session.surprise = null;
        if (!card) { ui.toast(ui.t('dict.surprise.empty')); return; }
        var entry = {
          id: id,
          kind: 'discovery',
          word: card.word || item.word,
          language: item.language,
          languageName: item.language,
          languageCode: item.code || '',
          native: item.native || card.native || '',
          pronunciation: card.pronunciation || '',
          coreMeaning: card.coreMeaning || '',
          examples: card.examples || [],
          rootNote: card.rootNote || '',
          why: card.why || '',
          quickMeaning: card.coreMeaning || '',
          overview: { status: 'ok', quick_meaning: card.coreMeaning || '' },
          model: settings.model,
          outputLang: out,
          ts: Date.now(),
          starred: false
        };
        if (!store.saveDiscovery(entry)) { ui.toast(ui.t('entry.saveFailed')); return; }
        location.hash = '#/discovery/' + encodeURIComponent(id);
        ns.router.refresh();
      });
    }).catch(function (err) {
      button.disabled = false;
      button.textContent = label;
      ui.toast(err && err.message ? err.message : ui.t('dict.surprise.empty'));
    });
  }

  function panelState(patch) {
    ns.session.candidates = patch;
    ns.router.refresh();
  }

  function runAccentCheck(input, lang) {
    var settings = store.getSettings();
    if (!settings.apiKey) {
      panelState({ state: 'error', input: input, error: { kind: 'no_key', message: ns.api.errorText.no_key } });
      return;
    }
    panelState({ state: 'loading', input: input, kind: 'accent' });

    ns.api.accentCandidates({
      apiKey: settings.apiKey, model: settings.model,
      sourceLang: lang, outputLang: settings.outputLang, input: input
    }).then(function (result) {
      ns.session.candidates = null;
      var decision = accentDecision(input, result.typedIsValid, result.candidates);
      if (!decision.showPanel) { openWord(input, lang); return; }
      panelState({
        state: 'ready', kind: 'accent', input: input, language: lang, items: decision.items
      });
    }).catch(function (err) {
      panelState({ state: 'error', input: input, error: ns.api.toErrorShape(err) });
    });
  }

  function runReverse(input, lang) {
    var settings = store.getSettings();
    if (!settings.apiKey) {
      panelState({ state: 'error', input: input, error: { kind: 'no_key', message: ns.api.errorText.no_key } });
      return;
    }
    panelState({ state: 'loading', input: input, kind: 'reverse' });

    ns.api.reverseCandidates({
      apiKey: settings.apiKey, model: settings.model,
      sourceLang: lang, outputLang: settings.outputLang, input: input
    }).then(function (data) {
      panelState({
        state: data.candidates && data.candidates.length ? 'ready' : 'empty',
        kind: 'reverse', input: input, language: lang, items: data.candidates || []
      });
    }).catch(function (err) {
      panelState({ state: 'error', input: input, error: ns.api.toErrorShape(err) });
    });
  }

  /* Case-insensitive but diacritic-SENSITIVE: cote and côte are precisely the
     pair this panel exists to tell apart. */
  function sameWord(a, b) {
    var left = String(a == null ? '' : a).normalize('NFC').trim().toLowerCase();
    var right = String(b == null ? '' : b).normalize('NFC').trim().toLowerCase();
    return left.length > 0 && left === right;
  }

  /* Pure: does the learner need to choose, and in what order? The test is "is
     there more than one reading", not "did they omit an accent". */
  function accentDecision(input, typedIsValid, candidates) {
    var items = (candidates || []).filter(Boolean).slice();

    if (typedIsValid && !items.some(function (item) { return sameWord(item.word, input); })) {
      items.unshift({ word: input, gloss: '', typed: true });
    } else {
      items = items.map(function (item) {
        if (!sameWord(item.word, input)) return item;
        return { word: item.word, gloss: item.gloss, why: item.why, language: item.language, typed: true };
      });
    }

    if (!items.length) return { showPanel: false, items: [] };
    if (items.length === 1 && sameWord(items[0].word, input)) return { showPanel: false, items: [] };

    items.sort(function (a, b) { return (b.typed ? 1 : 0) - (a.typed ? 1 : 0); });
    return { showPanel: true, items: items };
  }

  function errorNotice(error, options) {
    var kind = error && error.kind ? error.kind : 'server';
    var compact = options && options.compact;
    var title = ui.t('error.lookupFailed');
    var iconName = 'alert';
    var actions = '';

    if (kind === 'no_key') {
      title = ui.t('error.noKey.title'); iconName = 'key';
      actions = '<button type="button" class="btn btn-primary" data-go-profile>' +
        ui.esc(ui.t('error.noKey.action')) + '</button>';
    } else if (kind === 'auth') {
      title = ui.t('error.auth.title'); iconName = 'key';
      actions = '<button type="button" class="btn btn-primary" data-go-profile>' +
        ui.esc(ui.t('error.auth.action')) + '</button>';
    } else if (kind === 'balance') { title = ui.t('error.balance.title'); }
    else if (kind === 'rate_limit') { title = ui.t('error.rateLimit.title'); iconName = 'hourglass'; }
    else if (kind === 'timeout') { title = ui.t('error.timeout.title'); iconName = 'hourglass'; }
    else if (kind === 'network' || kind === 'offline') {
      title = ui.t(kind === 'offline' ? 'error.offline.title' : 'error.network.title');
      iconName = 'network';
    } else if (kind === 'bad_json') { title = ui.t('error.badJson.title'); iconName = 'info'; }
    else if (kind === 'language') {
      /* The answer named no language, so there was nothing to group the entry
         under and no way to pick the right prompts. */
      title = ui.t('error.language.title'); iconName = 'question';
    }

    var html = '<div class="notice notice-danger"' + (compact ? ' style="padding:12px"' : '') + '>' +
      ui.icon(iconName) + '<div><div class="notice-title">' + ui.esc(title) + '</div>' +
      '<div class="notice-body">' + ui.esc(error && error.message ? error.message : ui.t('error.generic')) + '</div>';
    if (options && options.rawText) {
      html += '<details style="margin-top:12px"><summary class="small" style="cursor:pointer">' + ui.esc(ui.t('error.showRaw')) + '</summary>' +
        '<div class="plain-fallback" style="margin-top:8px">' + ui.esc(options.rawText) + '</div></details>';
    }
    if (actions || (options && options.retryAttr)) {
      html += '<div class="notice-actions">' + actions;
      if (options && options.retryAttr) {
        html += '<button type="button" class="btn" ' + options.retryAttr + '>' + ui.icon('refresh') +
          ui.esc(ui.t('common.retry')) + '</button>';
      }
      html += '</div>';
    }
    return html + '</div></div>';
  }

  function candidatePanel() {
    var state = ns.session.candidates;
    if (!state) return '';
    var accent = state.kind === 'accent';
    var heading = accent
      ? ui.t('dict.candidates.accentTitle')
      : ui.t('dict.candidates.title', { input: state.input });

    var html = '<section class="card fade-in" id="candidate-panel" style="margin-bottom:16px">' +
      '<div class="card-head">' + ui.icon(accent ? 'pencil' : 'search') +
      '<span class="card-title">' + heading + '</span><span class="topbar-spacer"></span>' +
      '<button type="button" class="btn-quiet btn" data-clear-candidates>' +
      ui.esc(ui.t('dict.candidates.cancel')) + '</button></div>';

    if (state.state === 'loading') {
      html += '<div class="skeleton sk-line sk-w-60" style="margin-top:0"></div>' +
        '<div class="skeleton sk-line sk-w-80"></div>';
    } else if (state.state === 'empty') {
      html += '<p class="muted small">' + ui.esc(ui.t('dict.candidates.empty')) + '</p>';
    } else if (state.state === 'error') {
      html += errorNotice(state.error, { compact: true });
    } else {
      html += '<ol class="deflist">' + state.items.map(function (item) {
        return '<li><button type="button" class="row" style="padding:8px 0;border-radius:12px" ' +
          'data-candidate="' + ui.esc(item.word) + '">' +
          '<span class="row-main"><span class="row-title">' + ui.esc(item.word) +
          (item.language ? ' ' + ui.langBadge(item.language) : '') +
          (item.typed ? ' <span class="chip chip-accent">' +
          ui.esc(ui.t('dict.candidates.typed')) + '</span>' : '') + '</span>' +
          '<span class="row-sub">' + ui.esc(item.gloss || '') +
          (item.why ? ' — ' + ui.esc(item.why) : '') + '</span></span>' +
          '<span class="row-aside">' + ui.icon('chevron') + '</span></button></li>';
      }).join('') + '</ol>';
    }
    return html + '</section>';
  }

  /* The line shown between picking a word and opening its entry. */
  function surpriseLine() {
    var pick = ns.session.surprise;
    if (!pick) return '';
    var meta = languageMeta(pick.language);
    /* The whole line comes from `dict.surprise.picked` — it used to be an
       English sentence with the word interpolated twice. */
    return '<div class="surprise-line fade-in">' + ui.icon('sparkle') +
      '<span>' + ui.esc(ui.t('dict.surprise.picked', { word: pick.word })) +
      (meta ? ' · ' + ui.esc(meta.native) : (pick.language ? ' · ' + ui.esc(pick.language) : '')) +
      (pick.gloss ? ' · ' + ui.esc(pick.gloss) : '') + '</span></div>';
  }

  /* ---------- History ---------- */

  /* Folded days. In memory only, like the entry page's folded cards: a reload
     starts with everything open, which is the state the screen shipped with. */
  function collapsedDays() {
    if (!ns.session.collapsedDays) ns.session.collapsedDays = {};
    return ns.session.collapsedDays;
  }

  function dayGroup(key, label, count, body, forceOpen) {
    var open = forceOpen || !collapsedDays()[key];
    return '<button type="button" class="group-toggle" data-day="' + ui.esc(key) + '" ' +
      'aria-expanded="' + (open ? 'true' : 'false') + '">' +
      '<span class="group-text">' + ui.esc(label) + '</span>' +
      '<span class="group-count">' + count + '</span>' +
      '<span class="group-chevron">' + ui.icon('chevron') + '</span></button>' +
      (open ? body : '');
  }

  function historySection() {
    var settings = store.getSettings();
    var all = store.listGroups();
    var query = ns.session.historyQuery || '';
    var rows = query ? all.filter(function (row) { return matchesQuery(row, query); }) : all;

    var html = '<div class="section-head"><span class="card-title">' +
      ui.esc(ui.t('dict.history.title')) + '</span>';

    if (!all.length) {
      var noKey = !settings.apiKey;
      html += '</div><div class="empty"><div class="empty-icon">' + ui.icon(noKey ? 'key' : 'book') + '</div>';
      if (noKey) {
        /* The key goes here, in the empty state, because "go to Profile and
           come back" is the whole of the app's first-run friction. */
        html += '<div class="empty-title">' + ui.esc(ui.t('dict.key.title')) + '</div>' +
        '<div class="empty-text">' + ui.esc(ui.t('dict.key.text', { app: ui.appName() })) + '</div>' +
          '<div class="empty-actions">' +
          '<input id="quick-key" class="input" type="password" autocomplete="off" ' +
          'placeholder="' + ui.esc(ui.t('dict.key.placeholder')) + '" aria-label="' +
          ui.esc(ui.t('dict.key.label')) + '">' +
          '<button type="button" class="btn btn-primary" data-save-key>' +
          ui.esc(ui.t('dict.key.save')) + '</button></div>' +
          '<p class="hint" style="text-align:center;margin-top:10px">' +
          ui.esc(ui.t('dict.key.hint')) + ' ' +
          '<button type="button" class="link-btn" data-go-profile>' +
          ui.esc(ui.t('dict.key.more')) + '</button></p>';
      } else {
        html += '<div class="empty-title">' + ui.esc(ui.t('dict.history.emptyTitle')) + '</div>' +
          '<div class="empty-text">' + ui.esc(ui.t('dict.history.emptyText')) + '</div>';
      }
      return html + '</div>';
    }

    /* One group per calendar day. Rows arrive newest first, so the groups come
       out in date order without sorting. */
    var keys = [];
    var groups = {};
    rows.forEach(function (row) {
      var key = ui.dayKey(row.ts || 0);
      if (!groups[key]) { groups[key] = { label: ui.dayLabel(row.ts || 0), rows: [] }; keys.push(key); }
      groups[key].rows.push(row);
    });

    var folded = collapsedDays();
    var allFolded = keys.every(function (key) { return folded[key]; });
    html += '<button type="button" class="link-btn" data-history-toggle="1">' +
      ui.esc(ui.t(allFolded ? 'dict.history.expandAll' : 'dict.history.collapseAll')) +
      '</button></div>';

    /* "The word I looked up last week" is the common question a long history
       raises, and a date heading is not an answer to it. */
    html += '<div class="searchbar is-small">' + ui.icon('search') +
      '<input id="history-search" type="search" autocomplete="off" spellcheck="false" ' +
      'placeholder="' + ui.esc(ui.t('dict.history.search')) + '" aria-label="' +
      ui.esc(ui.t('dict.history.search')) + '" value="' + ui.esc(query) + '">' +
      (query ? '<span class="muted small nowrap">' +
      ui.esc(ui.t(rows.length === 1 ? 'dict.history.match' : 'dict.history.matches', { n: rows.length })) +
      '</span>' : '') +
      '</div>';

    if (!rows.length) {
      return html + '<div class="empty" style="padding:24px 8px"><div class="empty-title">' + ui.esc(ui.t('dict.history.noMatch')) + '</div>' +
        '<div class="empty-text">' + ui.esc(ui.t('dict.history.noMatchText', { query: query })) +
        '</div></div></div>';
    }

    keys.forEach(function (key) {
      var body = '<div class="list">' + groups[key].rows.map(historyRow).join('') + '</div>';
      /* While searching, the answer should be visible rather than folded away. */
      html += dayGroup(key, groups[key].label, groups[key].rows.length, body, !!query);
    });
    return html;
  }

  /* Case- and accent-insensitive: typing "ephemere" should find "éphémère". */
  function fold(text) {
    var value = String(text == null ? '' : text).toLowerCase();
    if (typeof value.normalize === 'function') value = value.normalize('NFD');
    return value.replace(/[\u0300-\u036f]/g, '');
  }

  function matchesQuery(row, query) {
    var needle = fold(query).trim();
    if (!needle) return true;
    return fold(row.word).indexOf(needle) > -1 || fold(row.quickMeaning).indexOf(needle) > -1;
  }

  function historyRow(row) {
    var starred = row.starred ? ' is-starred' : '';
    var starIcon = row.starred ? ui.iconFilled('star') : ui.icon('star');
    var kindChip = row.kind === 'sentence'
      ? '<span class="chip">' + ui.esc(ui.t('dict.badge.sentence')) + '</span>'
      : (row.kind === 'document'
        ? '<span class="chip">' + ui.esc(ui.t('dict.badge.document')) + '</span>'
        : (row.kind === 'discovery'
          ? '<span class="chip">' + ui.esc(ui.t('dict.surprise')) + '</span>' : ''));
    return '<div class="row" data-open="' + ui.esc(row.id) + '">' +
      '<span class="row-main"><span class="row-title">' + ui.esc(row.word) + '</span>' +
      '<span class="row-sub">' + kindChip +
      (row.pos ? ui.esc(row.pos) + ' · ' : '') + ui.esc(row.quickMeaning || '') + '</span></span>' +
      '<span class="row-aside">' + (row.kind === 'discovery'
        ? ui.languageBadge(row.languageCode, row.languageName)
        : (row.language ? ui.langBadge(row.language) : '')) +
      /* The group header already carries the date, so the row shows the clock. */
      '<span class="nowrap">' + ui.esc(ui.rowTime(row.ts || 0)) + '</span>' +
      '<button type="button" class="icon-btn' + starred + '" data-star="' + ui.esc(row.id) + '" ' +
      'aria-label="' + ui.esc(ui.t('dict.history.star')) + '" title="' +
      ui.esc(ui.t('dict.history.star')) + '">' + starIcon + '</button>' +
      '<button type="button" class="icon-btn is-muted" data-delete-row="' + ui.esc(row.id) + '" ' +
      'aria-label="' + ui.esc(ui.t('entry.delete')) + '" title="' + ui.esc(ui.t('entry.delete')) + '">' +
      ui.icon('trash') + '</button></span></div>';
  }

  /* ---------- Screen ---------- */

  function render(container) {
    var lang = currentLang();
    var mode = currentMode();

    var html = '';
    html += '<div class="lookup-controls">' +
      ui.segmented([
        { id: 'auto', label: ui.t('mode.auto') },
        { id: 'word', label: ui.t('mode.word') },
        { id: 'sentence', label: ui.t('mode.sentence') },
        { id: 'file', label: ui.t('mode.file') }
      ], mode, 'mode', true) +
      '</div>';

    if (mode === 'file') {
      html += filePanel();
    } else {
      html += '<div class="lookup-row">' +
        ui.picker({
          id: 'lookup-lang',
          value: lang,
          label: ui.t('dict.language'),
          title: ui.t('dict.language'),
          options: [{ id: CONFIG.autoLang, label: ui.t('mode.auto'), note: ui.t('dict.language.autoNote') }]
            .concat(CONFIG.queryLanguages.map(function (item) {
              return { id: item.id, label: item.native };
            })),
          onPick: function (next) {
            store.patchSettings({ queryLang: next });
            ns.session.candidates = null;
            ns.router.refresh();
          }
        }) +
        '<button type="button" class="icon-btn surprise-btn" id="lookup-surprise" ' +
        'aria-label="' + ui.esc(ui.t('dict.surprise')) + '" title="' +
          ui.esc(ui.t('dict.surprise')) + '">' + ui.icon('dice') + '</button>' +
        '</div>';

      html += '<div class="searchbar">' + ui.icon('search') +
        '<input id="lookup-input" type="search" autocomplete="off" autocapitalize="off" ' +
        'spellcheck="false" enterkeyhint="search" placeholder="' +
        ui.t(mode === 'sentence' ? 'dict.search.placeholder.sentence' : 'dict.search.placeholder') +
        '" value="' + ui.esc(ns.session.query || '') + '" aria-label="' +
        ui.esc(ui.t('dict.search.label')) + '">' +
        '<button type="button" class="search-go" id="lookup-submit" aria-label="' +
        ui.esc(ui.t('dict.search.label')) + '">' +
        ui.icon('chevron') + '</button>' +
        '</div>';
    }

    html += surpriseLine();
    html += candidatePanel();
    html += historySection();

    ui.setHTML(container, html);
    wire(container);

    if (ns.session.focusSearch) {
      ns.session.focusSearch = false;
      var input = container.querySelector('#lookup-input');
      if (input) window.setTimeout(function () { input.focus(); }, 0);
    }
  }

  function wire(container) {
    var input = container.querySelector('#lookup-input');
    var submitBtn = container.querySelector('#lookup-submit');

    /* ---------- File mode ---------- */
    var fileInput = container.querySelector('#file-input');
    var dropzone = container.querySelector('#file-drop');
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', function () { fileInput.click(); });
      dropzone.addEventListener('dragover', function (event) {
        event.preventDefault();
        dropzone.classList.add('is-over');
      });
      dropzone.addEventListener('dragleave', function () { dropzone.classList.remove('is-over'); });
      dropzone.addEventListener('drop', function (event) {
        event.preventDefault();
        dropzone.classList.remove('is-over');
        var dropped = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        acceptFile(dropped);
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        acceptFile(fileInput.files && fileInput.files[0]);
      });
    }
    var fileChange = container.querySelector('[data-file-change]');
    if (fileChange && fileInput) fileChange.addEventListener('click', function () { fileInput.click(); });
    var fileClear = container.querySelector('[data-file-clear]');
    if (fileClear) {
      fileClear.addEventListener('click', function () {
        ns.session.file = null;
        if (fileInput) fileInput.value = '';
        ns.router.refresh();
      });
    }
    var fileAnalyse = container.querySelector('[data-file-analyse]');
    if (fileAnalyse && !fileAnalyse.disabled) {
      fileAnalyse.addEventListener('click', function () { analyseFile(); });
    }

    ui.bindSegmented(container, 'mode', function (next) {
      ns.session.mode = next;
      ns.session.candidates = null;
      ns.router.refresh();
    });

    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        ns.session.query = input ? input.value : '';
        submit(ns.session.query);
      });
    }
    if (input) {
      input.addEventListener('input', function () { ns.session.query = input.value; });
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          ns.session.query = input.value;
          submit(ns.session.query);
        }
      });
    }

    var surpriseBtn = container.querySelector('#lookup-surprise');
    if (surpriseBtn) {
      surpriseBtn.addEventListener('click', function () { surpriseMe(surpriseBtn); });
    }

    var clearBtn = container.querySelector('[data-clear-candidates]');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        ns.session.candidates = null;
        ns.router.refresh();
      });
    }

    container.querySelectorAll('[data-candidate]').forEach(function (button) {
      button.addEventListener('click', function () {
        var word = button.getAttribute('data-candidate');
        var state = ns.session.candidates;
        var lang = state && state.language ? state.language : currentLang();
        ns.session.candidates = null;
        ns.session.query = word;
        openWord(word, lang === CONFIG.autoLang ? null : lang);
      });
    });

    container.querySelectorAll('[data-open]').forEach(function (row) {
      row.addEventListener('click', function (event) {
        if (event.target.closest('button')) return;
        ns.session.pending = null;
        var id = row.getAttribute('data-open');
        var found = store.findRow(id);
        location.hash = (found && found.kind === 'discovery' ? '#/discovery/' : '#/word/') + encodeURIComponent(id);
      });
    });

    container.querySelectorAll('[data-delete-row]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        var id = button.getAttribute('data-delete-row');
        var snapshot = store.snapshotEntry(id);
        if (!snapshot) return;
        store.removeGroup(id);
        if (ns.roots) ns.roots.invalidate();
        ui.toast(ui.t('entry.deleted'), {
          ms: 8000,
          action: {
            label: ui.t('common.undo'),
            onClick: function () {
              store.restoreEntry(snapshot);
              if (ns.roots) ns.roots.invalidate();
              ui.toast(ui.t('entry.restored'));
              ns.router.refresh();
            }
          }
        });
        ns.router.refresh();
      });
    });

    container.querySelectorAll('[data-star]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        var id = button.getAttribute('data-star');
        var starred = store.toggleStar(id);
        button.classList.toggle('is-starred', starred);
        button.innerHTML = starred ? ui.iconFilled('star') : ui.icon('star');
        ui.toast(ui.t(starred ? 'entry.addedStarred' : 'entry.removedStarred'));
      });
    });

    var goProfile = container.querySelector('[data-go-profile]');
    if (goProfile) goProfile.addEventListener('click', function () { location.hash = '#/profile'; });

    var saveKey = container.querySelector('[data-save-key]');
    if (saveKey) {
      saveKey.addEventListener('click', function () {
        var field = container.querySelector('#quick-key');
        var value = field ? field.value.trim() : '';
        if (!value) { ui.toast(ui.t('dict.key.empty')); return; }
        store.patchSettings({ apiKey: value });
        if (ns.pool) ns.pool.warmup(store.getSettings()).catch(function () {});
        ui.toast(ui.t('dict.key.saved'));
        ns.session.focusSearch = true;
        ns.router.refresh();
      });
    }

    var historySearch = container.querySelector('#history-search');
    if (historySearch) {
      historySearch.addEventListener('input', function () {
        ns.session.historyQuery = historySearch.value;
        ns.router.refresh();
        var again = document.getElementById('history-search');
        if (again) {
          again.focus();
          again.setSelectionRange(again.value.length, again.value.length);
        }
      });
    }

    container.querySelectorAll('[data-day]').forEach(function (button) {
      button.addEventListener('click', function () {
        var key = button.getAttribute('data-day');
        var map = collapsedDays();
        if (map[key]) delete map[key]; else map[key] = true;
        ns.router.refresh();
      });
    });

    var historyToggle = container.querySelector('[data-history-toggle]');
    if (historyToggle) {
      historyToggle.addEventListener('click', function () {
        var map = collapsedDays();
        var keys = store.listGroups().map(function (row) { return ui.dayKey(row.ts || 0); });
        var allFolded = keys.length && keys.every(function (key) { return map[key]; });
        keys.forEach(function (key) {
          if (allFolded) delete map[key]; else map[key] = true;
        });
        ns.router.refresh();
      });
    }
  }

  ns.views.dictionary = {
    topbar: function () { return { title: ui.appName(), sub: ui.t('app.tagline') }; },
    render: render,
    submit: submit,
    errorNotice: errorNotice,
    openWord: openWord,
    openSentence: openSentence,
    openDocument: openDocument,
    acceptFile: acceptFile,
    analyseFile: analyseFile,
    filePanel: filePanel,
    isNonLatin: isNonLatin,
    hasAccent: hasAccent,
    looksLikeSentence: looksLikeSentence,
    resolveMode: resolveMode,
    /* Exposed so the choice logic is testable without a live DOM. */
    accentDecision: accentDecision,
    surpriseTarget: surpriseTarget
  };
})(window.LINGUIST);
