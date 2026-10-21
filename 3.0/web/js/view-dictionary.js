/* RADICLE — Dictionary screen: language picker, word/sentence mode, search,
   candidate panels, history.

   History stays here. Favourites moved to their own screen in 3.0, and the
   global practice entry went with them — what remains is lookup. */

window.RADICLE = window.RADICLE || {};
window.RADICLE.views = window.RADICLE.views || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var store = ns.store;
  var CONFIG = ns.CONFIG;

  /* Scripts that cannot be the source language when the picker is on Auto. */
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

  /* ---------- Validation ---------- */

  function validate(raw, mode) {
    var text = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!text) return { error: 'Type something to look up.' };
    if (mode === 'sentence') {
      if (text.length > CONFIG.limits.maxSentenceLength) {
        return { error: 'Keep it under ' + CONFIG.limits.maxSentenceLength + ' characters.' };
      }
      /* No word-count check: Chinese has no spaces, so a whole Chinese sentence
         counts as one "word". A single word is also accepted — deciding whether
         it deserves an analysis is not this function's business. */
      return { value: text };
    }
    if (text.length > CONFIG.limits.maxInputLength) {
      return { error: 'Keep it under ' + CONFIG.limits.maxInputLength + ' characters.' };
    }
    if (words(text) > CONFIG.limits.maxExpressionWords) {
      return { error: 'Enter a single word or a short fixed expression.' };
    }
    if (/[.!?;]/.test(text) && words(text) > 2) {
      return { error: 'That looks like a sentence — switch to Sentence mode.' };
    }
    return { value: text };
  }

  /* ---------- Opening an entry ---------- */

  function openWord(word, language) {
    var settings = store.getSettings();
    var lang = language || (currentLang() === CONFIG.autoLang ? null : currentLang());
    var id = store.entryId(word, lang || 'auto', settings.model, settings.outputLang);
    var cached = store.getEntry(id);

    if (cached && cached.lines) {
      ns.session.pending = null;
      location.hash = '#/word/' + encodeURIComponent(id);
      ns.router.refresh();
      return;
    }
    ns.session.pending = { id: id, input: word, label: word, language: lang || 'auto', kind: 'word' };
    location.hash = '#/word/' + encodeURIComponent(id);
    ns.router.refresh();
  }

  function openSentence(text, language) {
    var settings = store.getSettings();
    var lang = language || (currentLang() === CONFIG.autoLang ? null : currentLang());
    var id = store.sentenceId(text, lang || 'auto', settings.model, settings.outputLang);
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
      language: lang || 'auto', kind: 'sentence'
    };
    location.hash = '#/word/' + encodeURIComponent(id);
    ns.router.refresh();
  }

  /* ---------- Search ---------- */

  function submit(raw) {
    var mode = ns.session.mode || 'word';
    var result = validate(raw, mode);
    if (result.error) { ui.toast(result.error); return; }
    ns.session.candidates = null;

    if (mode === 'sentence') { openSentence(result.value); return; }

    var lang = currentLang();
    var text = result.value;

    /* Non-Latin input cannot be a headword in a Latin-script language, so it
       becomes a reverse lookup. The picker still chooses the target. */
    if (lang === CONFIG.autoLang && isNonLatin(text)) {
      runReverse(text, 'en');
      return;
    }
    if (lang !== CONFIG.autoLang && isNonLatin(text)) {
      var meta = languageMeta(lang);
      if (meta && meta.script === 'latin') { runReverse(text, lang); return; }
    }

    /* Accented language, typed without diacritics: check before spending a
       full lookup. */
    var meta2 = lang === CONFIG.autoLang ? null : languageMeta(lang);
    if (meta2 && meta2.accents && !hasAccent(text)) {
      runAccentCheck(text, lang);
      return;
    }

    openWord(text, lang === CONFIG.autoLang ? null : lang);
  }

  /* ---------- Candidate panels ---------- */

  /* Where a suggested word should be looked up. A pinned language wins; on Auto
     the model's own answer decides, falling back to English if it names
     something we do not support. */
  function surpriseTarget(pinned, returned) {
    if (pinned && pinned !== CONFIG.autoLang) return pinned;
    return languageMeta(returned) ? returned : 'en';
  }

  /* No canned word list: the point of this button is to be surprised, and a
     fixed list stops surprising anyone after the second tap. */
  function surpriseMe(button, input) {
    var settings = store.getSettings();
    if (!settings.apiKey) {
      ui.toast(ns.api.errorText.no_key);
      location.hash = '#/profile';
      return;
    }

    var pinned = currentLang();
    var avoid = store.listHistory().slice(0, 12).map(function (row) { return row.word; });
    var label = button.textContent;
    button.disabled = true;
    button.textContent = 'Thinking…';

    var restore = function () {
      button.disabled = false;
      button.textContent = label;
    };

    ns.api.surprise({
      apiKey: settings.apiKey,
      model: settings.model,
      sourceLang: pinned === CONFIG.autoLang ? 'auto' : pinned,
      outputLang: settings.outputLang,
      avoid: avoid
    }).then(function (result) {
      restore();
      if (!result || !result.word) { ui.toast('Could not think of one — try again.'); return; }
      var target = surpriseTarget(pinned, result.language);
      if (input) input.value = result.word;
      ns.session.query = result.word;
      if (result.gloss) ui.toast(result.gloss, 3200);
      openWord(result.word, target);
    }).catch(function (err) {
      restore();
      ui.toast(err && err.message ? err.message : 'Could not think of one — try again.');
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

  /* Case-insensitive but diacritic-SENSITIVE: cote and côte are precisely the
     pair this panel exists to tell apart, so folding accents here would defeat
     the whole thing. */
  function sameWord(a, b) {
    var left = String(a == null ? '' : a).normalize('NFC').trim().toLowerCase();
    var right = String(b == null ? '' : b).normalize('NFC').trim().toLowerCase();
    return left.length > 0 && left === right;
  }

  /* Pure: does the learner need to choose, and in what order?

     The test is "is there more than one reading", not "did they omit an
     accent". A word like table has exactly one reading — itself — so it is
     never interrupted; cote has three (cote, côte, côté) so it always is.
     The as-typed form is forced into the list and put first, because the model
     occasionally omits it and a panel that cannot offer back what you typed is
     worse than no panel at all. */
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

  function errorNotice(error, options) {
    var kind = error && error.kind ? error.kind : 'server';
    var compact = options && options.compact;
    var title = 'Lookup failed';
    var iconName = 'alert';
    var actions = '';

    if (kind === 'no_key') {
      title = 'API key required'; iconName = 'key';
      actions = '<button type="button" class="btn btn-primary" data-go-profile>Open Profile</button>';
    } else if (kind === 'auth') {
      title = 'Invalid API key'; iconName = 'key';
      actions = '<button type="button" class="btn btn-primary" data-go-profile>Fix in Profile</button>';
    } else if (kind === 'balance') { title = 'Insufficient balance'; }
    else if (kind === 'rate_limit') { title = 'Rate limited'; iconName = 'hourglass'; }
    else if (kind === 'timeout') { title = 'Request timed out'; iconName = 'hourglass'; }
    else if (kind === 'network' || kind === 'offline') {
      title = kind === 'offline' ? 'You are offline' : 'Network unreachable'; iconName = 'network';
    } else if (kind === 'bad_json') { title = 'Unreadable answer'; iconName = 'info'; }

    var html = '<div class="notice notice-danger"' + (compact ? ' style="padding:12px"' : '') + '>' +
      ui.icon(iconName) + '<div><div class="notice-title">' + ui.esc(title) + '</div>' +
      '<div class="notice-body">' + ui.esc(error && error.message ? error.message : 'Something went wrong.') + '</div>';
    if (options && options.rawText) {
      html += '<details style="margin-top:12px"><summary class="small" style="cursor:pointer">Show raw answer</summary>' +
        '<div class="plain-fallback" style="margin-top:8px">' + ui.esc(options.rawText) + '</div></details>';
    }
    if (actions || (options && options.retryAttr)) {
      html += '<div class="notice-actions">' + actions;
      if (options && options.retryAttr) {
        html += '<button type="button" class="btn" ' + options.retryAttr + '>' + ui.icon('refresh') + 'Try again</button>';
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
      ? 'Did you mean one of these?'
      : 'Looking for the word behind “' + ui.esc(state.input) + '”';

    var html = '<section class="card fade-in" id="candidate-panel" style="margin-bottom:16px">' +
      '<div class="card-head">' + ui.icon(accent ? 'pencil' : 'search') +
      '<span class="card-title">' + heading + '</span><span class="topbar-spacer"></span>' +
      '<button type="button" class="btn-quiet btn" data-clear-candidates>Dismiss</button></div>';

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
          (item.typed ? ' <span class="chip chip-accent">you typed this</span>' : '') + '</span>' +
          '<span class="row-sub">' + ui.esc(item.gloss || '') +
          (item.why ? ' — ' + ui.esc(item.why) : '') + '</span></span>' +
          '<span class="row-aside">' + ui.icon('chevron') + '</span></button></li>';
      }).join('') + '</ol>';
    }
    return html + '</section>';
  }

  /* ---------- History ---------- */

  function historySection() {
    var settings = store.getSettings();
    var rows = store.listHistory();

    var html = '<div style="display:flex;align-items:center;gap:12px;margin:20px 4px 0">' +
      '<span class="card-title" style="margin:0">History</span></div>';

    if (!rows.length) {
      var noKey = !settings.apiKey;
      html += '<div class="empty"><div class="empty-icon">' + ui.icon(noKey ? 'key' : 'book') + '</div>';
      if (noKey) {
        html += '<div class="empty-title">Add your DeepSeek API key to begin</div>' +
          '<div class="empty-text">' + ui.esc(CONFIG.appName) + ' keeps every answer on this device only. ' +
          'Your key is never sent anywhere except api.deepseek.com.</div>' +
          '<div class="empty-actions"><button type="button" class="btn btn-primary" data-go-profile>Open Profile</button></div>';
      } else {
        html += '<div class="empty-title">Nothing here yet</div>' +
          '<div class="empty-text">Look up a word, or analyse a sentence. Star the ones worth keeping — ' +
          'they move to Favourites.</div>';
      }
      return html + '</div>';
    }

    var groups = {};
    var order = [];
    rows.forEach(function (row) {
      var bucket = ui.bucketFor(row.ts || 0);
      if (!groups[bucket]) { groups[bucket] = []; order.push(bucket); }
      groups[bucket].push(row);
    });

    order.forEach(function (bucket) {
      html += '<div class="group-label">' + ui.esc(bucket) + '</div><div class="list">';
      groups[bucket].forEach(function (row) { html += historyRow(row); });
      html += '</div>';
    });
    return html;
  }

  function historyRow(row) {
    var starred = row.starred ? ' is-starred' : '';
    var starIcon = row.starred ? ui.iconFilled('star') : ui.icon('star');
    var kindChip = row.kind === 'sentence' ? '<span class="chip">Sentence</span>' : '';
    return '<div class="row" data-open="' + ui.esc(row.id) + '">' +
      '<span class="row-main"><span class="row-title">' + ui.esc(row.word) + '</span>' +
      '<span class="row-sub">' + kindChip +
      (row.pos ? ui.esc(row.pos) + ' · ' : '') + ui.esc(row.quickMeaning || '') + '</span></span>' +
      '<span class="row-aside">' + (row.language ? ui.langBadge(row.language) : '') +
      '<span class="nowrap">' + ui.esc(ui.relativeTime(row.ts || 0)) + '</span>' +
      '<button type="button" class="icon-btn' + starred + '" data-star="' + ui.esc(row.id) + '" ' +
      'aria-label="Toggle star" title="Star">' + starIcon + '</button></span></div>';
  }

  /* ---------- Screen ---------- */

  function render(container) {
    var settings = store.getSettings();
    var lang = currentLang();
    var mode = ns.session.mode || 'word';

    var langOptions = [{ id: CONFIG.autoLang, label: CONFIG.autoLabel }].concat(
      CONFIG.languages.map(function (item) { return { id: item.id, label: item.label }; })
    );

    var html = '';
    html += '<div class="lookup-controls">' +
      ui.segmented([{ id: 'word', label: 'Word' }, { id: 'sentence', label: 'Sentence' }], mode, 'mode', false) +
      ui.segmented(langOptions, lang, 'lang', false) +
      '</div>';

    html += '<div class="searchbar">' + ui.icon('search') +
      '<input id="lookup-input" type="search" autocomplete="off" autocapitalize="off" ' +
      'spellcheck="false" enterkeyhint="search" placeholder="' +
      (mode === 'sentence' ? 'Paste a sentence to analyse' : 'Word or short phrase') +
      '" value="' + ui.esc(ns.session.query || '') + '" aria-label="Look up">' +
      '</div>';

    html += '<div class="search-actions">' +
      '<button type="button" class="btn btn-primary" id="lookup-submit">' +
      (mode === 'sentence' ? 'Analyse' : 'Look up') + '</button>' +
      /* Favourites is a bottom tab now, so there is no second entry point here. */
      (mode === 'word' ? '<button type="button" class="btn" id="lookup-random">Surprise me</button>' : '') +
      '</div>';

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
    ui.bindSegmented(container, 'lang', function (next) {
      store.patchSettings({ queryLang: next });
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

    var randomBtn = container.querySelector('#lookup-random');
    if (randomBtn) {
      randomBtn.addEventListener('click', function () {
        surpriseMe(randomBtn, input);
      });
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
        ui.toast(starred ? 'Added to favourites' : 'Removed from favourites');
      });
    });

    var goProfile = container.querySelector('[data-go-profile]');
    if (goProfile) goProfile.addEventListener('click', function () { location.hash = '#/profile'; });
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
    /* Exposed so the choice logic is testable without a live DOM. */
    accentDecision: accentDecision,
    surpriseTarget: surpriseTarget
  };
})(window.RADICLE);
