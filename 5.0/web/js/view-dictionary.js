/* RADICLE — Dictionary screen.

   Type (Auto / Word / Sentence), language, search, candidate panels, and the
   history grouped by day. Favourites lives on its own tab. */

window.RADICLE = window.RADICLE || {};
window.RADICLE.views = window.RADICLE.views || {};

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
    if (selected === 'word' || selected === 'sentence') return selected;
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

  /* ---------- Search ---------- */

  function submit(raw) {
    var selected = currentMode();
    var text = String(raw || '').trim().replace(/\s+/g, ' ');
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
  function surpriseTarget(pinned, returned, word) {
    if (pinned && pinned !== CONFIG.autoLang) {
      var meta = languageMeta(pinned);
      if (meta && meta.script === 'latin' && isNonLatin(String(word || ''))) {
        return languageMeta(returned) ? returned : pinned;
      }
      return pinned;
    }
    return languageMeta(returned) ? returned : 'en';
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
    var avoid = surpriseSeen().concat(store.listHistory().map(function (row) { return row.word; }));
    var label = button.textContent;
    button.disabled = true;
    button.textContent = 'Thinking…';

    function ask(left) {
      return ns.api.surprise({
        apiKey: settings.apiKey,
        model: settings.model,
        sourceLang: pinned === CONFIG.autoLang ? 'auto' : pinned,
        outputLang: store.outputLangFor(pinned === CONFIG.autoLang ? 'auto' : pinned),
        avoid: avoid
      }).then(function (result) {
        if (!result || !result.word) return null;
        if (!alreadyOffered(result.word) || left === 0) return result;
        /* It came back with something it has already offered. Ask again rather
           than showing the same word a sixth time. */
        return ask(left - 1);
      });
    }

    ask(SURPRISE_RETRIES).then(function (result) {
      button.disabled = false;
      button.textContent = label;
      if (!result || !result.word) { ui.toast(ui.t('dict.surprise.empty')); return; }
      if (alreadyOffered(result.word)) {
        ui.toast(ui.t('dict.surprise.repeat'));
        return;
      }
      rememberSurprise(result.word);

      var target = surpriseTarget(pinned, result.language, result.word);
      ns.session.query = result.word;
      ns.session.surprise = { word: result.word, language: target, gloss: result.gloss || '' };
      ns.router.refresh();

      window.setTimeout(function () {
        ns.session.surprise = null;
        openWord(result.word, target);
      }, 900);
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
      html += '<details style="margin-top:12px"><summary class="small" style="cursor:pointer">Show raw answer</summary>' +
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
      html += '<p class="muted small">No close match was found. Try the exact spelling, or switch the language.</p>';
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
    return '<div class="surprise-line fade-in">' + ui.icon('sparkle') +
      '<span>Picked for you: <b>' + ui.esc(pick.word) + '</b>' +
      (meta ? ' · ' + ui.esc(meta.native) : '') +
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
    var all = store.listHistory();
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
          '<div class="empty-text">' + ui.esc(ui.t('dict.key.text', { app: CONFIG.appName })) + '</div>' +
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
        html += '<div class="empty-title">Nothing here yet</div>' +
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
      return html + '<div class="empty" style="padding:24px 8px"><div class="empty-title">Nothing matches</div>' +
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
      ? '<span class="chip">' + ui.esc(ui.t('dict.badge.sentence')) + '</span>' : '';
    return '<div class="row" data-open="' + ui.esc(row.id) + '">' +
      '<span class="row-main"><span class="row-title">' + ui.esc(row.word) + '</span>' +
      '<span class="row-sub">' + kindChip +
      (row.pos ? ui.esc(row.pos) + ' · ' : '') + ui.esc(row.quickMeaning || '') + '</span></span>' +
      '<span class="row-aside">' + (row.language ? ui.langBadge(row.language) : '') +
      /* The group header already carries the date, so the row shows the clock. */
      '<span class="nowrap">' + ui.esc(ui.rowTime(row.ts || 0)) + '</span>' +
      '<button type="button" class="icon-btn' + starred + '" data-star="' + ui.esc(row.id) + '" ' +
      'aria-label="' + ui.esc(ui.t('dict.history.star')) + '" title="' +
      ui.esc(ui.t('dict.history.star')) + '">' + starIcon + '</button></span></div>';
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
        { id: 'sentence', label: ui.t('mode.sentence') }
      ], mode, 'mode', true) +
      '</div>';

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
        if (event.target.closest('[data-star]')) return;
        ns.session.pending = null;
        location.hash = '#/word/' + encodeURIComponent(row.getAttribute('data-open'));
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
        var keys = store.listHistory().map(function (row) { return ui.dayKey(row.ts || 0); });
        var allFolded = keys.length && keys.every(function (key) { return map[key]; });
        keys.forEach(function (key) {
          if (allFolded) delete map[key]; else map[key] = true;
        });
        ns.router.refresh();
      });
    }
  }

  ns.views.dictionary = {
    topbar: function () { return { title: CONFIG.appName, sub: CONFIG.tagline }; },
    render: render,
    submit: submit,
    errorNotice: errorNotice,
    openWord: openWord,
    openSentence: openSentence,
    isNonLatin: isNonLatin,
    hasAccent: hasAccent,
    looksLikeSentence: looksLikeSentence,
    resolveMode: resolveMode,
    /* Exposed so the choice logic is testable without a live DOM. */
    accentDecision: accentDecision,
    surpriseTarget: surpriseTarget
  };
})(window.RADICLE);
