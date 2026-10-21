/* RADICLE — Dictionary screen: search field, candidate cards, history list. */

window.RADICLE = window.RADICLE || {};
window.RADICLE.views = window.RADICLE.views || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var store = ns.store;
  var CONFIG = ns.CONFIG;

  /* Scripts we treat as "not the headword language" and route to the
     reverse-lookup candidate flow. Latin letters with diacritics are allowed. */
  var NON_LATIN = /[\u0370-\u03FF\u0400-\u04FF\u0530-\u058F\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/;

  function isNonLatin(text) {
    return NON_LATIN.test(text);
  }

  function wordCount(text) {
    return text.split(/\s+/).filter(function (part) { return part.length > 0; }).length;
  }

  /* ---------- Search ---------- */

  function validate(raw) {
    var text = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!text) return { error: 'Type a word to look up.' };
    if (text.length > CONFIG.limits.maxInputLength) {
      return { error: 'Keep it under ' + CONFIG.limits.maxInputLength + ' characters.' };
    }
    if (isNonLatin(text)) return { value: text, reverse: true };
    if (wordCount(text) > CONFIG.limits.maxExpressionWords) {
      return { error: 'Enter a single word or a short fixed expression.' };
    }
    if (/[.!?;]/.test(text) && wordCount(text) > 2) {
      return { error: 'Enter a word or short expression, not a sentence.' };
    }
    return { value: text, reverse: false };
  }

  function submit(raw, options) {
    var result = validate(raw);
    if (result.error) {
      ui.toast(result.error);
      return;
    }
    ns.session.candidates = null;

    if (result.reverse) {
      runCandidates(result.value, options);
      return;
    }
    openWord(result.value, options);
  }

  /* Opens an entry: cache hit renders instantly, miss starts generation. */
  function openWord(word, options) {
    var settings = store.getSettings();
    var id = store.entryId(word, settings.model, settings.outputLang);
    var cached = store.getEntry(id);

    if (cached && cached.overview) {
      ns.session.pending = null;
      location.hash = '#/word/' + encodeURIComponent(id);
      return;
    }

    ns.session.pending = { id: id, input: word };
    location.hash = '#/word/' + encodeURIComponent(id);
    /* Re-render even when the hash is already on this entry. */
    ns.router.refresh();
  }

  function runCandidates(input, options) {
    var settings = store.getSettings();
    var panel = options && options.panel;

    if (!settings.apiKey) {
      ns.session.candidates = {
        input: input,
        state: 'error',
        error: { kind: 'no_key', message: ns.api.errorText.no_key }
      };
      ns.router.refresh();
      return;
    }

    ns.session.candidates = { input: input, state: 'loading', items: [] };
    ns.router.refresh();

    ns.api.candidates({
      apiKey: settings.apiKey,
      model: settings.model,
      outputLang: settings.outputLang,
      input: input
    }).then(function (data) {
      ns.session.candidates = {
        input: input,
        state: data.candidates && data.candidates.length ? 'ready' : 'empty',
        items: data.candidates || []
      };
      ns.router.refresh();
    }).catch(function (err) {
      ns.session.candidates = {
        input: input,
        state: 'error',
        error: { kind: err.kind || 'server', message: err.message, detail: err.detail }
      };
      ns.router.refresh();
    });
  }

  function clearCandidates(event) {
    if (event) event.preventDefault();
    ns.session.candidates = null;
    ns.router.refresh();
  }

  /* ---------- Candidate panel ---------- */

  function candidatePanel() {
    var state = ns.session.candidates;
    if (!state) return '';

    var html = '<section class="card fade-in" id="candidate-panel" style="margin-bottom:16px">';
    html += '<div class="card-head">' + ui.icon('search') +
      '<span class="card-title">Looking for the word behind "' + ui.esc(state.input) + '"</span>' +
      '<span class="topbar-spacer"></span>' +
      '<button type="button" class="btn-quiet btn" data-clear-candidates>Dismiss</button></div>';

    if (state.state === 'loading') {
      html += '<div class="skeleton sk-line sk-w-60" style="margin-top:0"></div>';
      html += '<div class="skeleton sk-line sk-w-80"></div>';
      html += '<div class="skeleton sk-line sk-w-70"></div>';
    } else if (state.state === 'empty') {
      html += '<p class="muted small">No close English or French match was found. Try describing it differently, ' +
        'or type the word in English.</p>';
    } else if (state.state === 'error') {
      html += errorNotice(state.error, { compact: true });
    } else {
      html += '<ol class="deflist">';
      state.items.forEach(function (item, index) {
        html += '<li><button type="button" class="row" style="padding:8px 0;border-radius:12px" ' +
          'data-candidate="' + ui.esc(item.word) + '">' +
          '<span class="row-main">' +
          '<span class="row-title">' + ui.esc(item.word) + ' ' + ui.langBadge(item.language) + '</span>' +
          '<span class="row-sub">' + ui.esc(item.gloss || '') +
          (item.why ? ' — ' + ui.esc(item.why) : '') + '</span>' +
          '</span>' +
          '<span class="row-aside">' + ui.icon('chevron') + '</span>' +
          '</button></li>';
      });
      html += '</ol>';
    }
    return html + '</section>';
  }

  /* ---------- Error notices ---------- */

  function errorNotice(error, options) {
    var kind = error && error.kind ? error.kind : 'server';
    var compact = options && options.compact;
    var title = 'Lookup failed';
    var iconName = 'alert';
    var actions = '';

    if (kind === 'no_key') {
      title = 'API key required';
      iconName = 'key';
      actions = '<button type="button" class="btn btn-primary" data-go-profile>Open Profile</button>';
    } else if (kind === 'auth') {
      title = 'Invalid API key';
      iconName = 'key';
      actions = '<button type="button" class="btn btn-primary" data-go-profile>Fix in Profile</button>';
    } else if (kind === 'balance') {
      title = 'Insufficient balance';
      iconName = 'alert';
    } else if (kind === 'rate_limit') {
      title = 'Rate limited';
      iconName = 'hourglass';
    } else if (kind === 'timeout') {
      title = 'Request timed out';
      iconName = 'hourglass';
    } else if (kind === 'network' || kind === 'offline') {
      title = kind === 'offline' ? 'You are offline' : 'Network unreachable';
      iconName = 'network';
    } else if (kind === 'bad_json') {
      title = 'Unreadable answer';
      iconName = 'info';
    }

    var html = '<div class="notice notice-danger"' + (compact ? ' style="padding:12px"' : '') + '>' +
      ui.icon(iconName) + '<div>' +
      '<div class="notice-title">' + ui.esc(title) + '</div>' +
      '<div class="notice-body">' + ui.esc(error && error.message ? error.message : 'Something went wrong.') + '</div>';

    if (options && options.rawText) {
      html += '<details style="margin-top:12px"><summary class="small" style="cursor:pointer">Show raw answer</summary>' +
        '<div class="plain-fallback" style="margin-top:8px">' + ui.esc(options.rawText) + '</div></details>';
    }

    if (actions || (options && options.retryAttr)) {
      html += '<div class="notice-actions">' + actions;
      if (options && options.retryAttr) {
        html += '<button type="button" class="btn" ' + options.retryAttr + '>' +
          ui.icon('refresh') + 'Try again</button>';
      }
      html += '</div>';
    }
    return html + '</div></div>';
  }

  /* ---------- History ---------- */

  function historySection() {
    var settings = store.getSettings();
    var rows = store.listHistory();
    var filter = ns.session.filter || 'all';
    var visible = filter === 'starred' ? rows.filter(function (row) { return row.starred; }) : rows;

    var html = '';
    html += '<div style="display:flex;align-items:center;gap:12px;margin:20px 4px 0">';
    html += '<span class="card-title" style="margin:0">' +
      (filter === 'starred' ? 'Starred' : 'History') + '</span>';
    html += '<span class="topbar-spacer"></span>';
    html += ui.segmented(
      [{ id: 'all', label: 'All' }, { id: 'starred', label: 'Starred' }],
      filter,
      'history'
    );
    html += '</div>';

    if (!visible.length) {
      var noKey = !settings.apiKey;
      html += '<div class="empty">';
      html += '<div class="empty-icon">' + ui.icon(noKey ? 'key' : 'book') + '</div>';
      if (noKey) {
        html += '<div class="empty-title">Add your DeepSeek API key to begin</div>';
        html += '<div class="empty-text">' + ui.esc(CONFIG.appName) + ' keeps every answer on this device only. ' +
          'Your key is never sent anywhere except api.deepseek.com.</div>';
        html += '<div class="empty-actions">' +
          '<button type="button" class="btn btn-primary" data-go-profile>Open Profile</button></div>';
      } else if (filter === 'starred') {
        html += '<div class="empty-title">No starred words yet</div>';
        html += '<div class="empty-text">Tap the star on any entry to keep it here.</div>';
      } else {
        html += '<div class="empty-title">No lookups yet</div>';
        html += '<div class="empty-text">Search an English or French word to see its origin, roots and cultural weight.</div>';
      }
      html += '</div>';
      return html;
    }

    var groups = {};
    var order = [];
    visible.forEach(function (row) {
      var bucket = ui.bucketFor(row.ts || 0);
      if (!groups[bucket]) {
        groups[bucket] = [];
        order.push(bucket);
      }
      groups[bucket].push(row);
    });

    order.forEach(function (bucket) {
      html += '<div class="group-label">' + ui.esc(bucket) + '</div>';
      html += '<div class="list">';
      groups[bucket].forEach(function (row) {
        html += historyRow(row);
      });
      html += '</div>';
    });
    return html;
  }

  function historyRow(row) {
    var starred = row.starred ? ' is-starred' : '';
    var starIcon = row.starred ? ui.iconFilled('star') : ui.icon('star');
    var statusChip = row.status === 'not_found' ? '<span class="chip chip-warn">not found</span>' : '';

    return '<div class="row" data-open="' + ui.esc(row.id) + '">' +
      '<span class="row-main">' +
      '<span class="row-title">' + ui.esc(row.word) + '</span>' +
      '<span class="row-sub">' +
      (row.pos ? ui.esc(row.pos) + ' · ' : '') +
      ui.esc(row.quickMeaning || 'No summary') +
      '</span></span>' +
      '<span class="row-aside">' + statusChip +
      (row.language ? ui.langBadge(row.language) : '') +
      '<span class="nowrap">' + ui.esc(ui.relativeTime(row.ts || 0)) + '</span>' +
      '<button type="button" class="icon-btn' + starred + '" data-star="' + ui.esc(row.id) + '" ' +
      'aria-label="Toggle star" title="Star">' + starIcon + '</button>' +
      '</span></div>';
  }

  /* ---------- Screen ---------- */

  function render(container) {
    var html = '';
    html += '<div class="searchbar">' + ui.icon('search') +
      '<input id="lookup-input" type="search" autocomplete="off" autocapitalize="off" ' +
      'spellcheck="false" enterkeyhint="search" placeholder="English or French word" ' +
      'value="' + ui.esc(ns.session.query || '') + '" aria-label="Look up a word">' +
      '</div>';
    html += '<div class="search-actions">' +
      '<button type="button" class="btn btn-primary" id="lookup-submit">Look up</button>' +
      '<button type="button" class="btn" id="lookup-random">Surprise me</button>' +
      '</div>';

    html += candidatePanel();
    html += historySection();

    ui.setHTML(container, html);
    wire(container);
  }

  function wire(container) {
    var input = container.querySelector('#lookup-input');
    var submitBtn = container.querySelector('#lookup-submit');

    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        ns.session.query = input ? input.value : '';
        submit(ns.session.query);
      });
    }

    if (input) {
      input.addEventListener('input', function () {
        ns.session.query = input.value;
      });
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          ns.session.query = input.value;
          submit(ns.session.query);
        }
      });
      if (ns.session.focusSearch) {
        ns.session.focusSearch = false;
        window.setTimeout(function () { input.focus(); }, 0);
      }
    }

    var randomBtn = container.querySelector('#lookup-random');
    if (randomBtn) {
      randomBtn.addEventListener('click', function () {
        var pool = ['ephemeral', 'petrichor', 'flâner', 'saudade', 'liminal', 'rêverie', 'obfuscate', 'dépaysement'];
        var pick = pool[Math.floor(Math.random() * pool.length)];
        if (input) input.value = pick;
        ns.session.query = pick;
        submit(pick);
      });
    }

    var clearBtn = container.querySelector('[data-clear-candidates]');
    if (clearBtn) clearBtn.addEventListener('click', clearCandidates);

    ui.bindSegmented(container, 'history', function (next) {
      ns.session.filter = next;
      ns.router.refresh();
    });

    var profileBtn = container.querySelector('[data-go-profile]');
    if (profileBtn) {
      profileBtn.addEventListener('click', function () {
        location.hash = '#/profile';
      });
    }

    container.querySelectorAll('[data-candidate]').forEach(function (button) {
      button.addEventListener('click', function () {
        var word = button.getAttribute('data-candidate');
        ns.session.candidates = null;
        ns.session.query = word;
        openWord(word);
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
        if ((ns.session.filter || 'all') === 'starred') ns.router.refresh();
      });
    });
  }

  ns.views.dictionary = {
    topbar: function () {
      return { title: CONFIG.appName, sub: CONFIG.tagline };
    },
    render: render,
    submit: submit,
    errorNotice: errorNotice,
    openWord: openWord
  };
})(window.RADICLE);
