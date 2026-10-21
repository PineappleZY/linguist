/* RADICLE — Entry screen.

   Three deep lines are requested in parallel; whichever lands first paints
   first. Each line owns a contiguous block of cards, so a line that fails only
   costs its own block and can be retried on its own.

   Cards are collapsible. Expansion state lives in session.collapsed (keyed by
   card key) so it survives the re-render that happens every time another line
   arrives. */

window.RADICLE = window.RADICLE || {};
window.RADICLE.views = window.RADICLE.views || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var store = ns.store;
  var api = ns.api;
  var CONFIG = ns.CONFIG;

  /* Fixed order. Card order here is the reading order, independent of the
     order requests happen to return in. */
  var CARDS = [
    { key: 'core', line: 'etymology', title: 'Semantic core', icon: 'target' },
    { key: 'etymology', line: 'etymology', title: 'Etymology', icon: 'hourglass' },
    { key: 'morphology', line: 'etymology', title: 'Morphology', icon: 'branch' },
    { key: 'rootFamily', line: 'etymology', title: 'Root family', icon: 'network' },
    { key: 'falseCognates', line: 'etymology', title: 'False cognates', icon: 'shield' },
    { key: 'senses', line: 'usage', title: 'Senses', icon: 'list' },
    { key: 'collocations', line: 'usage', title: 'Collocations', icon: 'link' },
    { key: 'usage', line: 'usage', title: 'Usage', icon: 'info' },
    { key: 'confusables', line: 'distinction', title: 'Confusables', icon: 'question' },
    { key: 'culture', line: 'distinction', title: 'Culture', icon: 'museum' },
    { key: 'synthesis', line: 'distinction', title: 'Synthesis', icon: 'quote' },
    { key: 'mnemonic', line: 'distinction', title: 'Mnemonic', icon: 'sparkle' }
  ];

  var state = {
    id: null,
    entry: null,
    overviewState: 'idle',   /* idle | loading | ready | error | not_found */
    overviewError: null,
    lineState: {},
    lineError: {}
  };

  /* Cards already painted once. Each deep line arrival triggers a full
     re-render, so animating every card every time would flicker; only cards
     appearing for the first time get the entrance. */
  var revealed = {};

  function reset(newId) {
    state.id = newId;
    state.entry = null;
    state.overviewState = 'idle';
    state.overviewError = null;
    state.lineState = {};
    state.lineError = {};
    revealed = {};
    CONFIG.deepLines.forEach(function (line) {
      state.lineState[line] = 'idle';
      state.lineError[line] = null;
    });
  }

  /* ---------- Collapse ---------- */

  function collapsedMap() {
    if (!ns.session.collapsed) ns.session.collapsed = {};
    return ns.session.collapsed;
  }

  function isCollapsed(key) {
    return collapsedMap()[key] === true;
  }

  function allCollapsed() {
    return orderedCards().every(function (card) { return isCollapsed(card.key); });
  }

  /* ---------- Card shell ---------- */

  function cardShell(cardDef, body) {
    if (!body) return '';
    var collapsed = isCollapsed(cardDef.key);
    var isNew = !revealed[cardDef.key];
    if (isNew) revealed[cardDef.key] = true;
    return '<section class="card deep-card' + (collapsed ? ' is-collapsed' : '') +
      (isNew ? ' reveal' : '') +
      '" data-card="' + ui.esc(cardDef.key) + '">' +
      '<button type="button" class="card-head card-toggle" data-toggle="' + ui.esc(cardDef.key) + '" ' +
        'aria-expanded="' + (collapsed ? 'false' : 'true') + '">' +
        ui.icon(cardDef.icon) +
        '<span class="card-title">' + ui.esc(cardDef.title) + '</span>' +
        '<span class="card-chevron">' + ui.icon('chevron') + '</span>' +
      '</button>' +
      '<div class="card-body">' + body + '</div>' +
      '</section>';
  }

  /* ---------- Small builders ---------- */

  function bullets(items) {
    if (!Array.isArray(items)) return '';
    var list = items.filter(Boolean);
    if (!list.length) return '';
    return '<ul class="stack-sm">' + list.map(function (item) {
      return '<li>' + ui.esc(item) + '</li>';
    }).join('') + '</ul>';
  }

  function examples(list) {
    if (!Array.isArray(list)) return '';
    var html = '';
    list.forEach(function (example) {
      if (!example || !example.text) return;
      html += '<div class="example">' +
        '<div class="example-text">' + ui.esc(example.text) + '</div>' +
        (example.translation ? '<div class="example-trans">' + ui.esc(example.translation) + '</div>' : '') +
        '</div>';
    });
    return html ? '<div class="examples">' + html + '</div>' : '';
  }

  function subLabel(text) {
    return '<div class="sub-label">' + ui.esc(text) + '</div>';
  }

  /* ---------- Card bodies ---------- */

  function bodyCore(line) {
    if (!line || !line.core_metaphor) return '';
    return '<p class="core-metaphor">' + ui.esc(line.core_metaphor) + '</p>';
  }

  function bodyEtymology(line) {
    var ety = line && line.etymology;
    if (!ety || typeof ety !== 'object') return '';

    var chain = Array.isArray(ety.chain) ? ety.chain.filter(Boolean) : [];
    var html = '';

    if (chain.length) {
      html += '<ol class="etym-timeline">';
      chain.forEach(function (node) {
        html += '<li class="etym-node">' +
          '<span class="etym-mark"></span>' +
          '<div class="etym-line">' +
            '<span class="etym-lang">' + ui.esc(node.language || node.stage || '') + '</span>' +
            (node.date ? '<span class="etym-date">' + ui.esc(node.date) + '</span>' : '') +
          '</div>' +
          (node.form ? '<div class="etym-form">' + ui.esc(node.form) + '</div>' : '') +
          (node.meaning ? '<div class="etym-meaning">' + ui.esc(node.meaning) + '</div>' : '') +
          '</li>';
      });
      html += '</ol>';
    }

    var facts = '';
    if (ety.via) facts += '<span class="chip">via ' + ui.esc(ety.via) + '</span>';
    if (ety.first_attested) facts += '<span class="chip">' + ui.esc(ety.first_attested) + '</span>';
    if (ety.certainty) {
      var tone = ety.certainty === 'high' ? 'chip-good' : (ety.certainty === 'low' ? 'chip-warn' : '');
      facts += '<span class="chip ' + tone + '">certainty: ' + ui.esc(ety.certainty) + '</span>';
    }
    if (facts) html += '<div class="etym-facts">' + facts + '</div>';

    if (ety.shift) html += '<p class="etym-shift">' + ui.esc(ety.shift) + '</p>';
    return html;
  }

  function bodyMorphology(line) {
    var morph = line && line.morphology;
    if (!morph || typeof morph !== 'object') return '';

    var parts = Array.isArray(morph.breakdown) ? morph.breakdown.filter(Boolean) : [];
    var variants = Array.isArray(morph.root_variants) ? morph.root_variants.filter(Boolean) : [];
    var html = '';

    if (parts.length) {
      html += '<div class="morph-formula">';
      parts.forEach(function (part, index) {
        if (index) html += '<span class="morph-op">+</span>';
        html += '<span class="morph-part">' +
          '<b>' + ui.esc(part.part || '') + '</b>' +
          (part.meaning ? '<i>' + ui.esc(part.meaning) + '</i>' : '') +
          (part.origin ? '<em>' + ui.esc(part.origin) + '</em>' : '') +
          (part.form_note ? '<u>' + ui.esc(part.form_note) + '</u>' : '') +
          '</span>';
      });
      html += '</div>';
    }

    if (morph.composition) {
      html += '<p class="morph-composition">' + ui.esc(morph.composition) + '</p>';
    }

    if (variants.length) {
      html += subLabel('Root variants');
      html += '<ul class="variant-list">' + variants.map(function (item) {
        return '<li><span class="mono">' + ui.esc(item.form || '') + '</span>' +
          (item.note ? '<span class="muted"> ' + ui.esc(item.note) + '</span>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    return html;
  }

  function bodyRootFamily(line) {
    var family = line && line.root_family;
    if (!family || typeof family !== 'object') return '';

    var direct = Array.isArray(family.direct) ? family.direct.filter(Boolean) : [];
    var shared = Array.isArray(family.shared_root) ? family.shared_root.filter(Boolean) : [];
    var html = '';

    if (direct.length) {
      html += subLabel('Direct derivatives');
      html += '<ul class="family-list">' + direct.map(function (item) {
        return '<li>' +
          '<div class="family-head">' +
            '<b>' + ui.esc(item.word || '') + '</b>' +
            (item.pos ? '<span class="pos">' + ui.esc(item.pos) + '</span>' : '') +
            (item.formula ? '<span class="family-formula">' + ui.esc(item.formula) + '</span>' : '') +
          '</div>' +
          (item.gloss ? '<div class="family-gloss">' + ui.esc(item.gloss) + '</div>' : '') +
          examples(item.examples) +
          '</li>';
      }).join('') + '</ul>';
    }

    if (shared.length) {
      html += subLabel('Shared root');
      html += '<ul class="family-list is-compact">' + shared.map(function (item) {
        return '<li>' +
          '<div class="family-head"><b>' + ui.esc(item.word || '') + '</b></div>' +
          (item.gloss ? '<div class="family-gloss">' + ui.esc(item.gloss) + '</div>' : '') +
          (item.formula ? '<div class="family-formula is-block">' + ui.esc(item.formula) + '</div>' : '') +
          '</li>';
      }).join('') + '</ul>';
    }

    return html;
  }

  function bodyFalseCognates(line) {
    var items = line && Array.isArray(line.false_cognates) ? line.false_cognates.filter(Boolean) : [];
    if (!items.length) return '';
    return '<ul class="deflist">' + items.map(function (item) {
      return '<li>' +
        '<div class="def-term">' + ui.esc(item.word || '') +
        (item.actual_origin ? ' <span class="chip">' + ui.esc(item.actual_origin) + '</span>' : '') +
        '</div>' +
        (item.note ? '<div class="def-desc">' + ui.esc(item.note) + '</div>' : '') +
        '</li>';
    }).join('') + '</ul>';
  }

  function bodySenses(line) {
    var senses = line && Array.isArray(line.senses) ? line.senses : [];
    if (!senses.length) return '';
    return senses.map(function (sense, i) {
      var html = '<div class="sense">';
      html += '<div class="sense-head"><span class="sense-index">' + (i + 1) + '</span>';
      if (sense.pos) html += '<span class="pos">' + ui.esc(sense.pos) + '</span>';
      html += '</div>';
      html += '<div class="sense-def">' + ui.esc(sense.definition || '') + '</div>';
      html += examples(sense.examples);
      return html + '</div>';
    }).join('');
  }

  function bodyCollocations(line) {
    var items = line && Array.isArray(line.collocations) ? line.collocations.filter(Boolean) : [];
    if (!items.length) return '';
    return '<ul class="deflist">' + items.map(function (item) {
      var objects = Array.isArray(item.typical_objects) ? item.typical_objects.filter(Boolean) : [];
      return '<li>' +
        '<div class="def-term mono">' + ui.esc(item.pattern || '') + '</div>' +
        (item.meaning ? '<div class="def-desc">' + ui.esc(item.meaning) + '</div>' : '') +
        (objects.length ? '<div class="chips" style="margin-top:6px">' + objects.map(function (obj) {
          return '<span class="chip">' + ui.esc(obj) + '</span>';
        }).join('') + '</div>' : '') +
        '</li>';
    }).join('') + '</ul>';
  }

  function bodyUsage(line) {
    return bullets(line && line.usage_notes);
  }

  function bodyConfusables(line) {
    var conf = line && line.confusables;
    if (!conf || typeof conf !== 'object') return '';

    var rows = Array.isArray(conf.table) ? conf.table.filter(Boolean) : [];
    var parallels = Array.isArray(conf.parallel_examples) ? conf.parallel_examples.filter(Boolean) : [];
    var pairs = Array.isArray(conf.contrast_pairs) ? conf.contrast_pairs.filter(Boolean) : [];
    var html = '';

    if (conf.theme) html += '<p class="confuse-theme">' + ui.esc(conf.theme) + '</p>';

    if (rows.length) {
      html += '<div class="table-wrap"><table class="compare-table"><thead><tr>' +
        '<th>Word</th><th>Meaning</th><th>Note</th></tr></thead><tbody>' +
        rows.map(function (row) {
          return '<tr>' +
            '<td class="ct-word">' + ui.esc(row.word || '') + '</td>' +
            '<td>' + ui.esc(row.meaning || '') + '</td>' +
            '<td class="ct-note">' + ui.esc(row.note || '') + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>';
    }

    if (parallels.length) {
      html += subLabel('Same idea, different verb');
      html += '<ul class="parallel-list">' + parallels.map(function (item) {
        return '<li><div class="example-text">' + ui.esc(item.sentence || '') + '</div>' +
          (item.note ? '<div class="def-desc">' + ui.esc(item.note) + '</div>' : '') + '</li>';
      }).join('') + '</ul>';
    }

    if (pairs.length) {
      html += subLabel('Easily mixed');
      html += '<ul class="deflist">' + pairs.map(function (pair) {
        return '<li><div class="def-term"><span class="mono">' + ui.esc(pair.a || '') + '</span>' +
          '<span class="vs">vs</span><span class="mono">' + ui.esc(pair.b || '') + '</span></div>' +
          '<div class="def-desc">' + ui.esc(pair.a_meaning || '') + ' · ' + ui.esc(pair.b_meaning || '') + '</div>' +
          '</li>';
      }).join('') + '</ul>';
    }
    return html;
  }

  function bodyCulture(line) {
    return bullets(line && line.cultural_notes);
  }

  function bodySynthesis(line) {
    var items = line && Array.isArray(line.synthesis) ? line.synthesis.filter(Boolean) : [];
    if (!items.length) return '';
    return '<ul class="synthesis-list">' + items.map(function (item) {
      return '<li>' + ui.esc(item) + '</li>';
    }).join('') + '</ul>';
  }

  function bodyMnemonic(line) {
    if (!line || !line.mnemonic) return '';
    return '<div class="mnemonic">' + ui.esc(line.mnemonic) + '</div>';
  }

  var BODY_BUILDERS = {
    core: bodyCore,
    etymology: bodyEtymology,
    morphology: bodyMorphology,
    rootFamily: bodyRootFamily,
    falseCognates: bodyFalseCognates,
    senses: bodySenses,
    collocations: bodyCollocations,
    usage: bodyUsage,
    confusables: bodyConfusables,
    culture: bodyCulture,
    synthesis: bodySynthesis,
    mnemonic: bodyMnemonic
  };

  /* ---------- Deep region ---------- */

  var CARD_BY_KEY = {};
  CARDS.forEach(function (card) { CARD_BY_KEY[card.key] = card; });

  /* Cards in the configured reading order. An unknown key in cardOrder is
     ignored, and a card missing from cardOrder is appended rather than
     dropped — a typo in the order must never silently hide a section. */
  function orderedCards() {
    var order = Array.isArray(CONFIG.cardOrder) ? CONFIG.cardOrder : [];
    var seen = {};
    var list = [];
    order.forEach(function (key) {
      var card = CARD_BY_KEY[key];
      if (card && !seen[key]) { seen[key] = true; list.push(card); }
    });
    CARDS.forEach(function (card) {
      if (!seen[card.key]) { seen[card.key] = true; list.push(card); }
    });
    return list;
  }

  /* Where a line's loading / error placeholder goes: the slot of its first card
     in the reading order. A failed line reports once there instead of repeating
     the same error under every one of its cards. */
  function lineAnchors() {
    var anchors = {};
    orderedCards().forEach(function (card) {
      if (!anchors[card.line]) anchors[card.line] = card.key;
    });
    return anchors;
  }

  function lineLabel(line) {
    if (line === 'etymology') return 'Word root';
    if (line === 'usage') return 'Meaning and use';
    return 'Disambiguation';
  }

  /* A titled skeleton, so the outline of the entry is readable while the lines
     are still in flight rather than a stack of anonymous grey blocks. */
  function cardSkeleton(card) {
    return '<section class="card deep-card is-loading" data-loading="' + ui.esc(card.key) + '">' +
      '<div class="card-head">' + ui.icon(card.icon) +
      '<span class="card-title">' + ui.esc(card.title) + '</span></div>' +
      '<div class="card-body">' +
        '<div class="skeleton sk-line sk-w-90" style="margin-top:0"></div>' +
        '<div class="skeleton sk-line sk-w-70"></div>' +
      '</div></section>';
  }

  function lineNotice(card) {
    if ((state.lineState[card.line] || 'idle') === 'error') {
      return '<section class="card deep-card" data-line-notice="' + ui.esc(card.line) + '">' +
        ns.views.dictionary.errorNotice(state.lineError[card.line], {
          retryAttr: 'data-retry-line="' + ui.esc(card.line) + '"',
          rawText: state.lineError[card.line] && state.lineError[card.line].extra
            ? state.lineError[card.line].extra.raw : ''
        }) + '</section>';
    }
    return '<section class="card deep-card" data-line-notice="' + ui.esc(card.line) + '">' +
      '<div class="notice notice-warn">' + ui.icon('info') + '<div>' +
      '<div class="notice-title">' + ui.esc(lineLabel(card.line)) + ' not generated yet</div>' +
      '<div class="notice-body">This entry was saved before that section finished.</div>' +
      '<div class="notice-actions"><button type="button" class="btn" data-retry-line="' + ui.esc(card.line) + '">' +
      ui.icon('refresh') + 'Generate</button></div></div></div></section>';
  }

  function deepRegion() {
    var cards = orderedCards();
    var html = '<div class="deep-toolbar">' +
      '<span class="tiny muted-3">' + cards.length + ' sections</span>' +
      '<span class="topbar-spacer"></span>' +
      '<button type="button" class="btn btn-sm" data-collapse-toggle="1">' +
      (allCollapsed() ? 'Expand all' : 'Collapse all') +
      '</button></div>';

    var anchors = lineAnchors();
    var data = state.entry && state.entry.lines ? state.entry.lines : null;

    cards.forEach(function (card) {
      var status = state.lineState[card.line] || 'idle';

      if (status === 'ready') {
        html += cardShell(card, BODY_BUILDERS[card.key](data ? data[card.line] : null));
        return;
      }
      if (status === 'loading') {
        html += cardSkeleton(card);
        return;
      }
      /* error or idle: report once, at this line's first card in the order */
      if (anchors[card.line] === card.key) html += lineNotice(card);
    });
    return html;
  }

  /* ---------- Header ---------- */

  function headerCard(entry) {
    var overview = entry.overview || {};
    var word = entry.word || overview.word || '';
    var starred = store.isStarred(entry.id);
    var spellable = ns.spell.canSpell(word);

    var html = '<section class="card word-head">';
    html += '<div class="word-title-row">';
    html += '<div class="word-title">' + ui.esc(word);
    if (entry.language || overview.language) {
      html += ' <span class="badge-lang">' + ui.esc((entry.language || overview.language || '').toUpperCase()) + '</span>';
    }
    html += '</div>';
    html += '<div class="word-actions">';
    if (ns.speech.supported() && word) {
      html += '<button type="button" class="icon-btn" data-speak="' + ui.esc(word) + '" ' +
        'data-speak-lang="' + ui.esc(entry.language === 'fr' ? 'fr-FR' : 'en-US') + '" ' +
        'aria-label="Pronounce" title="Pronounce">' + ui.icon('speaker') + '</button>';
    }
    html += '<button type="button" class="icon-btn is-muted" data-spell-entry ' +
      (spellable ? '' : 'disabled ') +
      'aria-label="Spell this word" title="' +
      (spellable ? 'Spell this word' : 'Spelling is only available for single words') + '">' +
      ui.icon('key') + '</button>';
    html += '<button type="button" class="icon-btn' + (starred ? ' is-starred' : '') + '" data-star-entry ' +
      'aria-label="Star this entry" title="Star">' + (starred ? ui.iconFilled('star') : ui.icon('star')) + '</button>';
    html += '<button type="button" class="icon-btn is-muted" data-refresh-entry aria-label="Regenerate" title="Regenerate">' +
      ui.icon('refresh') + '</button>';
    html += '<button type="button" class="icon-btn is-muted" data-delete-entry aria-label="Delete" title="Delete">' +
      ui.icon('trash') + '</button>';
    html += '</div></div>';

    if (overview.ipa) html += '<div class="word-ipa">' + ui.esc(overview.ipa) + '</div>';
    if (overview.quick_meaning) html += '<div class="quick-meaning">' + ui.esc(overview.quick_meaning) + '</div>';

    var meta = '';
    if (overview.pos) meta += '<span class="pos">' + ui.esc(overview.pos) + '</span>';
    if (overview.register) meta += '<span class="chip">' + ui.esc(overview.register) + '</span>';
    (Array.isArray(overview.tags) ? overview.tags : []).forEach(function (tag) {
      if (tag) meta += '<span class="chip">' + ui.esc(tag) + '</span>';
    });
    if (meta) html += '<div class="word-meta">' + meta + '</div>';

    html += '</section>';
    return html;
  }

  function loadingScreen() {
    return '<section class="card">' +
      '<div class="skeleton sk-line-lg sk-w-40" style="margin-top:0"></div>' +
      '<div class="skeleton sk-line sk-w-40"></div>' +
      '<div class="skeleton sk-line-lg sk-w-90" style="height:20px"></div>' +
      '<div class="skeleton sk-line sk-w-60"></div>' +
      '</section>' + ui.skeletonCard(3) + ui.skeletonCard(2);
  }

  function notFoundScreen(entry) {
    var overview = entry.overview || {};
    var suggestions = Array.isArray(overview.suggestions) ? overview.suggestions.filter(Boolean) : [];
    var html = '<section class="card">';
    html += '<div class="card-head">' + ui.icon('question') + '<span class="card-title">No such headword</span></div>';
    html += '<div class="card-body"><p>“' + ui.esc(entry.word) + '” is not a current English or French word or fixed expression. ' +
      'Check the spelling, or try the reverse lookup by typing the meaning in Chinese.</p>';
    if (suggestions.length) {
      html += '<div class="chips" style="margin-top:16px">' + suggestions.map(function (word) {
        return '<button type="button" class="chip chip-button" data-suggestion="' + ui.esc(word) + '">' +
          ui.esc(word) + '</button>';
      }).join('') + '</div>';
    }
    return html + '</div></section>';
  }

  function missingScreen() {
    return '<section class="card"><div class="empty" style="padding:32px 8px">' +
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
      outputLang: settings.outputLang
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
      if (entry.status !== 'not_found') runLines(entry);
    }).catch(function (err) {
      state.overviewState = 'error';
      state.overviewError = err;
      renderScreen();
    });
  }

  /* Fires the three deep lines together and repaints as each one settles. */
  function runLines(entry) {
    var settings = settingsSnapshot();
    CONFIG.deepLines.forEach(function (line) {
      state.lineState[line] = 'loading';
      state.lineError[line] = null;
    });
    renderScreen();

    return api.deepLines({
      apiKey: settings.apiKey,
      model: settings.model,
      outputLang: settings.outputLang,
      overview: entry.overview
    }, function (result) {
      if (result.ok) {
        if (!entry.lines) entry.lines = {};
        entry.lines[result.line] = result.data;
        state.lineState[result.line] = 'ready';
        store.saveEntry(entry);
      } else {
        state.lineState[result.line] = 'error';
        state.lineError[result.line] = result.error;
      }
      renderScreen();
    });
  }

  function runSingleLine(entry, line) {
    var settings = settingsSnapshot();
    state.lineState[line] = 'loading';
    state.lineError[line] = null;
    renderScreen();

    api.deepLine({
      apiKey: settings.apiKey,
      model: settings.model,
      outputLang: settings.outputLang,
      overview: entry.overview,
      line: line
    }).then(function (data) {
      if (!entry.lines) entry.lines = {};
      entry.lines[line] = data;
      state.lineState[line] = 'ready';
      store.saveEntry(entry);
      renderScreen();
    }).catch(function (err) {
      state.lineState[line] = 'error';
      state.lineError[line] = err;
      renderScreen();
    });
  }

  /* Retry one failed line. Exported so the same code path the retry button
     uses is also the one under test. */
  function retryLine(line) {
    if (!state.entry) return Promise.resolve();
    return runSingleLine(state.entry, line);
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
          schema: CONFIG.schemaVersion,
          model: settings.model,
          outputLang: settings.outputLang,
          ts: Date.now()
        };
        state.overviewState = 'loading';
        renderScreen();
        runOverview(state.entry);
        return;
      }

      if (!cached) {
        ui.setHTML(container, missingScreen() + disclaimer());
        wire(container, null);
        return;
      }

      state.entry = cached;
      state.overviewState = cached.status === 'not_found' ? 'not_found' : 'ready';
      CONFIG.deepLines.forEach(function (line) {
        var has = cached.lines && cached.lines[line];
        state.lineState[line] = has ? 'ready' : 'idle';
      });
    }

    var entry = state.entry;
    if (!entry) {
      ui.setHTML(container, missingScreen() + disclaimer());
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
      html += '<div style="margin-top:16px">' + ns.views.dictionary.errorNotice(state.overviewError, {
        retryAttr: 'data-retry-overview="1"',
        rawText: state.overviewError && state.overviewError.extra ? state.overviewError.extra.raw : ''
      }) + '</div>';
    } else if (entry.overview) {
      html += '<div style="height:16px"></div>' + deepRegion();
    }

    html += disclaimer();
    ui.setHTML(container, html);
    wire(container, entry);
  }

  function wire(container, entry) {
    var back = container.querySelector('[data-go-dictionary]');
    if (back) back.addEventListener('click', function () { location.hash = '#/dictionary'; });
    if (!entry) return;

    var speakBtn = container.querySelector('[data-speak]');
    if (speakBtn) {
      speakBtn.addEventListener('click', function () {
        ns.speech.speak(speakBtn.getAttribute('data-speak'), speakBtn.getAttribute('data-speak-lang'));
      });
    }

    var spellBtn = container.querySelector('[data-spell-entry]');
    if (spellBtn && !spellBtn.disabled) {
      spellBtn.addEventListener('click', function () {
        var overview = entry.overview || {};
        ns.spell.open({
          word: entry.word,
          meaning: overview.quick_meaning || '',
          pos: overview.pos || '',
          language: entry.language || overview.language || 'en',
          entryId: entry.id,
          mode: 'single'
        });
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
        entry.lines = {};
        CONFIG.deepLines.forEach(function (line) { state.lineState[line] = 'idle'; });
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

    container.querySelectorAll('[data-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var key = button.getAttribute('data-toggle');
        var map = collapsedMap();
        if (map[key]) delete map[key];
        else map[key] = true;
        ns.router.refresh();
      });
    });

    var collapseAll = container.querySelector('[data-collapse-toggle]');
    if (collapseAll) {
      collapseAll.addEventListener('click', function () {
        var map = collapsedMap();
        if (allCollapsed()) {
          orderedCards().forEach(function (card) { delete map[card.key]; });
        } else {
          orderedCards().forEach(function (card) { map[card.key] = true; });
        }
        ns.router.refresh();
      });
    }

    container.querySelectorAll('[data-retry-line]').forEach(function (button) {
      button.addEventListener('click', function () {
        ns.views.word.retryLine(button.getAttribute('data-retry-line'));
      });
    });

    var retryOverview = container.querySelector('[data-retry-overview]');
    if (retryOverview) retryOverview.addEventListener('click', function () { runOverview(entry); });

    container.querySelectorAll('[data-suggestion]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var word = chip.getAttribute('data-suggestion');
        ns.session.query = word;
        ns.views.dictionary.openWord(word);
      });
    });

    var goProfile = container.querySelector('[data-go-profile]');
    if (goProfile) goProfile.addEventListener('click', function () { location.hash = '#/profile'; });
  }

  ns.views.word = {
    cards: CARDS,
    retryLine: retryLine,
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
