/* Radicle — Entry screen.
   Two-stage generation: the overview card paints first, then the nine deep
   cards stream in as a staggered reveal while the second request is in flight. */

window.RADICLE = window.RADICLE || {};
window.RADICLE.views = window.RADICLE.views || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var store = ns.store;
  var api = ns.api;

  /* Transient per-screen state; cleared whenever another entry is opened. */
  var state = {
    id: null,
    entry: null,
    overviewState: 'idle',   /* idle | loading | ready | error | not_found */
    overviewError: null,
    deepState: 'idle',       /* idle | loading | ready | error */
    deepError: null
  };

  function reset(newId) {
    state.id = newId;
    state.entry = null;
    state.overviewState = 'idle';
    state.overviewError = null;
    state.deepState = 'idle';
    state.deepError = null;
  }

  /* ---------- Deep card builders ---------- */
  /* Each returns '' when the model gave nothing, so empty cards never render. */

  function card(title, iconName, body, index) {
    if (!body) return '';
    return '<section class="card reveal"' + ui.revealDelay(index) + '>' +
      '<div class="card-head">' + ui.icon(iconName) +
      '<span class="card-title">' + ui.esc(title) + '</span></div>' +
      '<div class="card-body">' + body + '</div></section>';
  }

  function bullets(items) {
    if (!Array.isArray(items) || !items.length) return '';
    return '<ul class="stack-sm">' + items.filter(Boolean).map(function (item) {
      return '<li>' + ui.esc(item) + '</li>';
    }).join('') + '</ul>';
  }

  function cardSenses(deep, index) {
    var senses = Array.isArray(deep.senses) ? deep.senses : [];
    if (!senses.length) return '';
    var body = senses.map(function (sense, i) {
      var html = '<div class="sense">';
      html += '<div class="sense-head">';
      html += '<span class="sense-index">' + (i + 1) + '</span>';
      if (sense.pos) html += '<span class="pos">' + ui.esc(sense.pos) + '</span>';
      html += '</div>';
      html += '<div class="sense-def">' + ui.esc(sense.definition || '') + '</div>';

      var examples = Array.isArray(sense.examples) ? sense.examples : [];
      if (examples.length) {
        html += '<div class="examples">';
        examples.forEach(function (example) {
          if (!example || !example.text) return;
          html += '<div class="example">' +
            '<div class="example-text">' + ui.esc(example.text) + '</div>' +
            (example.translation ? '<div class="example-trans">' + ui.esc(example.translation) + '</div>' : '') +
            '</div>';
        });
        html += '</div>';
      }
      return html + '</div>';
    }).join('');
    return card('Senses', 'list', body, index);
  }

  function cardCollocations(deep, index) {
    var items = Array.isArray(deep.collocations) ? deep.collocations : [];
    if (!items.length) return '';
    var body = '<ul class="deflist">' + items.map(function (item) {
      return '<li><div class="def-term">' + ui.esc(item.phrase || '') + '</div>' +
        (item.meaning ? '<div class="def-desc">' + ui.esc(item.meaning) + '</div>' : '') + '</li>';
    }).join('') + '</ul>';
    return card('Collocations', 'link', body, index);
  }

  function cardUsage(deep, index) {
    return card('Usage', 'info', bullets(deep.usage_notes), index);
  }

  function cardEtymology(deep, index) {
    var ety = deep.etymology;
    if (!ety || typeof ety !== 'object') return '';

    var chain = Array.isArray(ety.origin_chain) ? ety.origin_chain.filter(Boolean) : [];
    var story = ety.story || '';
    if (!chain.length && !story && !ety.root_form && !ety.first_attested) return '';

    var body = '';
    if (chain.length) {
      body += '<div class="etym-chain">' + chain.map(function (node, i) {
        return (i ? '<span class="etym-arrow">→</span>' : '') +
          '<span class="etym-node">' + ui.esc(node) + '</span>';
      }).join('') + '</div>';
    }

    var facts = '';
    if (ety.root_form) facts += '<span class="chip">root <b>' + ui.esc(ety.root_form) + '</b></span>';
    if (ety.first_attested) facts += '<span class="chip">' + ui.esc(ety.first_attested) + '</span>';
    if (ety.certainty) {
      var tone = ety.certainty === 'high' ? 'chip-good' : (ety.certainty === 'low' ? 'chip-warn' : '');
      facts += '<span class="chip ' + tone + '">certainty: ' + ui.esc(ety.certainty) + '</span>';
    }
    if (facts) body += '<div class="etym-facts">' + facts + '</div>';
    if (story) body += '<p>' + ui.esc(story) + '</p>';

    return card('Etymology', 'hourglass', body, index);
  }

  function cardMorphology(deep, index) {
    var morph = deep.morphology;
    if (!morph || typeof morph !== 'object') return '';

    var groups = [
      { key: 'prefixes', label: 'Prefixes' },
      { key: 'roots', label: 'Roots' },
      { key: 'suffixes', label: 'Suffixes' }
    ];

    var body = '';
    groups.forEach(function (group) {
      var items = Array.isArray(morph[group.key]) ? morph[group.key].filter(Boolean) : [];
      if (!items.length) return;
      body += '<div class="morph-group"><div class="morph-label">' + ui.esc(group.label) + '</div>';
      items.forEach(function (item) {
        body += '<div class="morph-item">' +
          '<span class="morph-form">' + ui.esc(item.form || '') + '</span>' +
          '<span class="morph-detail">' + ui.esc(item.meaning || '') +
          (item.origin ? ' <span class="muted-3">· ' + ui.esc(item.origin) + '</span>' : '') +
          '</span></div>';
      });
      body += '</div>';
    });

    return card('Morphology', 'branch', body, index);
  }

  function cardCognates(deep, index) {
    var items = Array.isArray(deep.cognates) ? deep.cognates.filter(Boolean) : [];
    if (!items.length) return '';
    var body = '<ul class="deflist">' + items.map(function (item) {
      return '<li><div class="def-term">' + ui.esc(item.word || '') +
        (item.language ? ' <span class="chip">' + ui.esc(item.language) + '</span>' : '') +
        '</div>' +
        (item.relation ? '<div class="def-desc">' + ui.esc(item.relation) + '</div>' : '') + '</li>';
    }).join('') + '</ul>';
    return card('Cognates', 'network', body, index);
  }

  function cardCulture(deep, index) {
    return card('Culture', 'museum', bullets(deep.cultural_notes), index);
  }

  function cardConfusables(deep, index) {
    var items = Array.isArray(deep.confusables) ? deep.confusables.filter(Boolean) : [];
    if (!items.length) return '';
    var body = '<ul class="deflist">' + items.map(function (item) {
      return '<li><div class="def-term">' + ui.esc(item.word || '') + '</div>' +
        (item.distinction ? '<div class="def-desc">' + ui.esc(item.distinction) + '</div>' : '') + '</li>';
    }).join('') + '</ul>';
    return card('Confusables', 'question', body, index);
  }

  function cardMnemonic(deep, index) {
    if (!deep.mnemonic) return '';
    var body = '<div style="display:flex;gap:12px;align-items:flex-start">' +
      '<span style="color:var(--accent);flex:none">' + ui.icon('sparkle') + '</span>' +
      '<p style="flex:1">' + ui.esc(deep.mnemonic) + '</p></div>';
    return card('Mnemonic', 'sparkle', body, index);
  }

  function deepCards(deep) {
    if (!deep) return '';
    var builders = [
      cardSenses, cardCollocations, cardUsage, cardEtymology, cardMorphology,
      cardCognates, cardCulture, cardConfusables, cardMnemonic
    ];
    var html = '';
    var index = 0;
    builders.forEach(function (build) {
      var block = build(deep, index);
      if (block) {
        index += 1;
        html += block;
      }
    });
    return html;
  }

  /* ---------- Header and overview ---------- */

  function headerCard(entry) {
    var overview = entry.overview || {};
    var word = entry.word || overview.word || '';
    var ipa = overview.ipa || '';
    var pos = overview.pos || '';
    var starred = store.isStarred(entry.id);
    var canSpeak = ns.speech.supported();

    var html = '<section class="card word-head reveal">';
    html += '<div class="word-title-row">';
    html += '<div class="word-title">' + ui.esc(word);
    if (entry.language || overview.language) {
      html += ' <span class="badge-lang">' + ui.esc((entry.language || overview.language || '').toUpperCase()) + '</span>';
    }
    html += '</div>';
    html += '<div class="word-actions">';
    if (canSpeak && word) {
      html += '<button type="button" class="icon-btn" data-speak="' + ui.esc(word) + '" ' +
        'data-speak-lang="' + ui.esc(entry.language === 'fr' ? 'fr-FR' : 'en-US') + '" ' +
        'aria-label="Pronounce" title="Pronounce">' + ui.icon('speaker') + '</button>';
    }
    html += '<button type="button" class="icon-btn' + (starred ? ' is-starred' : '') + '" data-star-entry ' +
      'aria-label="Star this entry" title="Star">' + (starred ? ui.iconFilled('star') : ui.icon('star')) + '</button>';
    html += '<button type="button" class="icon-btn is-muted" data-refresh-entry aria-label="Regenerate" title="Regenerate">' +
      ui.icon('refresh') + '</button>';
    html += '<button type="button" class="icon-btn is-muted" data-delete-entry aria-label="Delete" title="Delete">' +
      ui.icon('trash') + '</button>';
    html += '</div></div>';

    if (ipa) html += '<div class="word-ipa">' + ui.esc(ipa) + '</div>';
    if (overview.quick_meaning) html += '<div class="quick-meaning">' + ui.esc(overview.quick_meaning) + '</div>';

    var meta = '';
    if (pos) meta += '<span class="pos">' + ui.esc(pos) + '</span>';
    if (overview.register) meta += '<span class="chip">' + ui.esc(overview.register) + '</span>';
    (Array.isArray(overview.tags) ? overview.tags : []).forEach(function (tag) {
      if (tag) meta += '<span class="chip">' + ui.esc(tag) + '</span>';
    });
    if (meta) html += '<div class="word-meta">' + meta + '</div>';

    html += '</section>';
    return html;
  }

  function loadingScreen() {
    var html = '<section class="card fade-in">';
    html += '<div class="skeleton sk-line-lg sk-w-40" style="margin-top:0"></div>';
    html += '<div class="skeleton sk-line sk-w-40"></div>';
    html += '<div class="skeleton sk-line-lg sk-w-90" style="height:20px"></div>';
    html += '<div class="skeleton sk-line sk-w-60"></div>';
    html += '</section>';
    html += ui.skeletonCard(3);
    html += ui.skeletonCard(2);
    return html;
  }

  function notFoundScreen(entry) {
    var overview = entry.overview || {};
    var suggestions = Array.isArray(overview.suggestions) ? overview.suggestions.filter(Boolean) : [];
    var html = '<section class="card reveal">';
    html += '<div class="card-head">' + ui.icon('question') + '<span class="card-title">No such headword</span></div>';
    html += '<div class="card-body">';
    html += '<p>“' + ui.esc(entry.word) + '” is not a current English or French word or fixed expression. ' +
      'Check the spelling, or try the reverse lookup by typing the meaning in Chinese.</p>';
    if (suggestions.length) {
      html += '<div class="chips" style="margin-top:16px">' + suggestions.map(function (word) {
        return '<button type="button" class="chip chip-button" data-suggestion="' + ui.esc(word) + '">' +
          ui.esc(word) + '</button>';
      }).join('') + '</div>';
    }
    html += '</div></section>';
    return html;
  }

  function missingScreen(id) {
    return '<section class="card reveal"><div class="empty" style="padding:32px 8px">' +
      '<div class="empty-icon">' + ui.icon('book') + '</div>' +
      '<div class="empty-title">Entry not on this device</div>' +
      '<div class="empty-text">Radicle stores answers locally, so this link only works where the lookup happened.</div>' +
      '<div class="empty-actions"><button type="button" class="btn btn-primary" data-go-dictionary>Back to Dictionary</button></div>' +
      '</div></section>';
  }

  function disclaimer() {
    return '<p class="small muted-3" style="text-align:center;margin-top:20px">' +
      'AI-generated. Etymology is scholarly consensus, not gospel — always double-check a claim before quoting it.</p>';
  }

  /* ---------- Generation ---------- */

  function settingsSnapshot() {
    var settings = store.getSettings();
    return {
      apiKey: settings.apiKey,
      model: settings.model,
      outputLang: settings.outputLang,
      thinking: settings.thinking
    };
  }

  function runOverview(entry) {
    var settings = settingsSnapshot();
    state.overviewState = 'loading';
    state.overviewError = null;
    renderScreen();

    api.overview({
      apiKey: settings.apiKey,
      model: settings.model,
      outputLang: settings.outputLang,
      input: entry.input || entry.word
    }).then(function (overview) {
      entry.overview = overview && typeof overview === 'object' ? overview : {};
      entry.status = entry.overview.status === 'not_found' ? 'not_found' : 'ok';
      entry.word = entry.overview.word || entry.word;
      entry.language = entry.overview.language || entry.language;
      entry.ts = Date.now();
      state.overviewState = entry.status === 'not_found' ? 'not_found' : 'ready';
      store.saveEntry(entry);
      renderScreen();
      if (entry.status !== 'not_found') runDeep(entry);
    }).catch(function (err) {
      state.overviewState = 'error';
      state.overviewError = err;
      renderScreen();
    });
  }

  function runDeep(entry) {
    var settings = settingsSnapshot();
    state.deepState = 'loading';
    state.deepError = null;
    renderScreen();

    api.deep({
      apiKey: settings.apiKey,
      model: settings.model,
      outputLang: settings.outputLang,
      thinking: settings.thinking,
      overview: entry.overview
    }).then(function (deep) {
      entry.deep = deep && typeof deep === 'object' ? deep : {};
      entry.deepAt = Date.now();
      state.deepState = 'ready';
      store.saveEntry(entry);
      renderScreen();
    }).catch(function (err) {
      state.deepState = 'error';
      state.deepError = err;
      renderScreen();
    });
  }

  /* ---------- Screen ---------- */

  function renderScreen() {
    if (state.id !== currentRouteId()) return;
    ns.router.refresh();
  }

  function currentRouteId() {
    var match = /^#\/word\/(.+)$/.exec(location.hash);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function render(container, params) {
    var id = params.id;

    if (state.id !== id) {
      reset(id);
      var pending = ns.session.pending;
      var cached = store.getEntry(id);
      var settings = store.getSettings();

      if (pending && pending.id === id) {
        ns.session.pending = null;
        state.entry = {
          id: id,
          input: pending.input,
          word: pending.input,
          language: '',
          status: 'ok',
          starred: false,
          model: settings.model,
          outputLang: settings.outputLang,
          ts: Date.now()
        };
        state.overviewState = 'loading';
        state.entry = state.entry;
        renderScreen();
        runOverview(state.entry);
        return;
      }

      if (!cached) {
        ui.setHTML(container, missingScreen(id) + disclaimer());
        wire(container, null);
        return;
      }

      state.entry = cached;
      state.overviewState = cached.status === 'not_found' ? 'not_found' : 'ready';
      state.deepState = cached.deep ? 'ready' : 'idle';
    }

    var entry = state.entry;
    if (!entry) {
      ui.setHTML(container, missingScreen(id) + disclaimer());
      wire(container, null);
      return;
    }

    var html = '';

    if (state.overviewState === 'loading' && !entry.overview) {
      html += loadingScreen();
    } else {
      html += headerCard(entry);
    }

    if (state.overviewState === 'not_found') {
      html += notFoundScreen(entry);
    } else if (state.overviewState === 'error') {
      html += '<div style="margin-top:16px">' + dictionaryView().errorNotice(state.overviewError, {
        retryAttr: 'data-retry-overview="1"',
        rawText: state.overviewError && state.overviewError.extra ? state.overviewError.extra.raw : ''
      }) + '</div>';
    } else if (entry.overview) {
      html += deepRegion(entry);
    }

    html += disclaimer();
    ui.setHTML(container, html);
    wire(container, entry);
  }

  function deepRegion(entry) {
    var html = '<div style="height:16px"></div>';
    if (state.deepState === 'error') {
      html += dictionaryView().errorNotice(state.deepError, {
        retryAttr: 'data-retry-deep="1"',
        rawText: state.deepError && state.deepError.extra ? state.deepError.extra.raw : ''
      });
    } else if (state.deepState === 'loading') {
      html += ui.skeletonCard(3) + ui.skeletonCard(2) + ui.skeletonCard(2);
    } else if (entry.deep) {
      html += deepCards(entry.deep);
    } else {
      html += '<div class="notice notice-warn">' + ui.icon('alert') + '<div>' +
        '<div class="notice-title">Deep analysis was not completed</div>' +
        '<div class="notice-body">The overview above is saved. Run the second pass to add etymology, roots and culture.</div>' +
        '<div class="notice-actions"><button type="button" class="btn" data-retry-deep="1">' +
        ui.icon('refresh') + 'Run deep analysis</button></div></div></div>';
    }
    return html;
  }

  function dictionaryView() {
    return ns.views.dictionary;
  }

  function wire(container, entry) {
    var back = container.querySelector('[data-go-dictionary]');
    if (back) {
      back.addEventListener('click', function () { location.hash = '#/dictionary'; });
    }
    if (!entry) return;

    var speakBtn = container.querySelector('[data-speak]');
    if (speakBtn) {
      speakBtn.addEventListener('click', function () {
        ns.speech.speak(speakBtn.getAttribute('data-speak'), speakBtn.getAttribute('data-speak-lang'));
      });
    }

    var starBtn = container.querySelector('[data-star-entry]');
    if (starBtn) {
      starBtn.addEventListener('click', function () {
        var starred = store.toggleStar(entry.id);
        starBtn.classList.toggle('is-starred', starred);
        starBtn.innerHTML = starred ? ui.iconFilled('star') : ui.icon('star');
        ui.toast(starred ? 'Starred' : 'Removed from starred');
      });
    }

    var refreshBtn = container.querySelector('[data-refresh-entry]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        entry.deep = null;
        state.deepState = 'idle';
        runOverview(entry);
      });
    }

    var deleteBtn = container.querySelector('[data-delete-entry]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        store.removeEntry(entry.id);
        ui.toast('Entry deleted');
        location.hash = '#/dictionary';
      });
    }

    var retryOverview = container.querySelector('[data-retry-overview]');
    if (retryOverview) {
      retryOverview.addEventListener('click', function () { runOverview(entry); });
    }

    var retryDeep = container.querySelector('[data-retry-deep]');
    if (retryDeep) {
      retryDeep.addEventListener('click', function () { runDeep(entry); });
    }

    container.querySelectorAll('[data-suggestion]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var word = chip.getAttribute('data-suggestion');
        ns.session.query = word;
        ns.views.dictionary.openWord(word);
      });
    });

    var goProfile = container.querySelector('[data-go-profile]');
    if (goProfile) {
      goProfile.addEventListener('click', function () { location.hash = '#/profile'; });
    }
  }

  ns.views.word = {
    topbar: function (params) {
      var title = state.entry && state.id === params.id ? (state.entry.word || 'Entry') : 'Entry';
      return {
        back: true,
        title: title,
        sub: state.entry ? ui.modelMeta(store.getSettings().model).label : ''
      };
    },
    render: render,
    reset: reset
  };
})(window.RADICLE);
