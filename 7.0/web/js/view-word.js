/* LINGUIST — Entry screen.

   Card order and card metadata come from CONFIG; this file only knows how to
   turn one field of the model's response into markup. A card whose field is
   empty is not rendered at all, which is how five languages with different
   card sets share one layout. */

window.LINGUIST = window.LINGUIST || {};
window.LINGUIST.views = window.LINGUIST.views || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var store = ns.store;
  var api = ns.api;
  var CONFIG = ns.CONFIG;

  var state = {
    id: null,
    entry: null,
    kind: 'word',
    overviewState: 'idle',
    overviewError: null,
    lineState: {},
    lineError: {},
    /* Bumped by reset(); async callbacks compare against it before touching
       any of the fields above. */
    generation: 0,
    controller: null,
    /* Where a document's chunk run has got to: { index, total, state }, with
       state one of running, partial, done. Held here because the reader has to
       see it in the header, which the deep region does not repaint. */
    doc: null,
    /* Set when a save could not be written at all (storage full), so the
       screen can say so instead of silently losing the answer. */
    storageError: false
  };

  var revealed = {};

  function lines() {
    if (state.kind === 'sentence') return CONFIG.sentenceLines;
    if (state.kind === 'document') return CONFIG.documentLines;
    /* Chinese and Japanese have no paradigm line, so their entries ask for
       three requests rather than four and never report a missing fourth. */
    return CONFIG.deepLinesFor(state.entry ? state.entry.language : null);
  }
  function catalog() {
    if (state.kind === 'sentence') return CONFIG.sentenceCatalog;
    if (state.kind === 'document') return CONFIG.documentCatalog;
    return CONFIG.cardCatalog;
  }

  /* ---------- Which cards, in what order ----------
     One arrangement per reading family, chosen in Profile. A document has a
     fixed four, because ordering a summary, a translation, a glossary and a
     register note differently would be a way of losing the file's shape. */
  function prefGroup() {
    if (state.kind === 'sentence') return 'sentence';
    if (state.kind === 'document') return '';
    return CONFIG.prefGroupForLanguage(state.entry ? state.entry.language : null);
  }

  function prefsFor() {
    if (!prefGroup()) return { order: CONFIG.documentCardOrder, hidden: {} };
    return CONFIG.resolveCardPrefs(prefGroup(), store.getSettings().cardPrefs);
  }

  /* The reading order depends on the language being studied: a Latin-script
     word leads with its roots, a Chinese character with 本义 and 字源. An entry
     whose language is not known yet falls back to the full catalogue order. */
  function order() {
    return prefsFor().order;
  }

  function isHidden(key) { return !!prefsFor().hidden[key]; }

  /* Which response object a card reads from. Usually the card's own line; for
     Japanese the conjugation card is fed by the usage line, and sentence cards
     always name their own two lines. */
  function cardLine(card) {
    /* Sentences and documents live in their own catalogues, which the word
       line-override table knows nothing about — asking it for `summary` would
       answer "" and every document card would be skipped as "not part of this
       entry". They name their own line, always. */
    if (state.kind === 'sentence' || state.kind === 'document') return card.line;
    return CONFIG.lineFor(card.key, state.entry ? state.entry.language : null);
  }

  function availableLines() { return lines(); }

  function reset(newId) {
    /* Every generation bump invalidates whatever is still in flight. Results
       that arrive afterwards belong to an entry nobody is looking at, and
       writing them into the shared state is what used to paint one entry's
       error onto another. */
    state.generation += 1;
    abortInFlight();
    state.id = newId;
    state.entry = null;
    state.overviewState = 'idle';
    state.overviewError = null;
    state.lineState = {};
    state.lineError = {};
    state.doc = null;
    state.storageError = false;
    revealed = {};
    /* Paradigm groups open per entry, so a tense opened on one word does not
       silently unfold on the next. */
    ns.session.formsOpen = {};
    CONFIG.deepLines.concat(CONFIG.sentenceLines).concat(CONFIG.documentLines).forEach(function (line) {
      state.lineState[line] = 'idle';
      state.lineError[line] = null;
    });
  }

  /* One controller per entry: leaving the screen stops paying for answers
     nobody will read. */
  function abortInFlight() {
    if (state.controller) {
      state.controller.abort();
      state.controller = null;
    }
  }

  function requestSignal() {
    if (typeof AbortController !== 'function') return undefined;
    if (!state.controller) state.controller = new AbortController();
    return state.controller.signal;
  }

  /* True while `generation` is still the one the caller started in. */
  function current(generation) { return generation === state.generation; }

  function isAborted(error) {
    return !!(error && (error.kind === 'aborted' || error.name === 'aborted'));
  }

  /* ---------- Collapse ---------- */

  function collapsedMap() {
    if (!ns.session.collapsed) ns.session.collapsed = {};
    return ns.session.collapsed;
  }

  function isCollapsed(key) { return collapsedMap()[key] === true; }

  function orderedCards() {
    var seen = {};
    var list = [];
    order().forEach(function (key) {
      /* A hidden card is not part of the page at all — not its body, not its
         skeleton, not the one place a failed line reports itself. */
      if (isHidden(key)) return;
      var card = catalog()[key];
      if (card && !seen[key]) { seen[key] = true; list.push(card); }
    });
    Object.keys(catalog()).forEach(function (key) {
      if (seen[key] || isHidden(key)) return;
      seen[key] = true;
      list.push(catalog()[key]);
    });
    return list;
  }

  function allCollapsed() {
    return orderedCards().every(function (card) { return isCollapsed(card.key); });
  }

  /* ---------- Primitives ---------- */

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

  function subLabel(text) { return '<div class="sub-label">' + ui.esc(text) + '</div>'; }

  /* Most language-specific cards are a list of small term/description rows, so
     one helper covers a large share of them. */
  function rows(items, map) {
    if (!Array.isArray(items)) return '';
    var list = items.filter(Boolean);
    if (!list.length) return '';
    return '<ul class="deflist">' + list.map(function (item) {
      var parts = map(item) || {};
      return '<li>' +
        '<div class="def-term">' + (parts.term || '') + '</div>' +
        (parts.desc ? '<div class="def-desc">' + parts.desc + '</div>' : '') +
        (parts.extra || '') +
        '</li>';
    }).join('') + '</ul>';
  }

  function chips(list, tone) {
    if (!Array.isArray(list)) return '';
    var clean = list.filter(Boolean);
    if (!clean.length) return '';
    return '<div class="chips">' + clean.map(function (item) {
      return '<span class="chip' + (tone ? ' ' + tone : '') + '">' + ui.esc(item) + '</span>';
    }).join('') + '</div>';
  }

  /* A labelled fact row, used by the grammar cards. */
  function facts(list) {
    var clean = list.filter(function (pair) { return pair && pair[1]; }).map(function (pair) {
      /* `field.*` are our labels and follow the interface language; anything
         else is model data and is passed through untouched. */
      var label = String(pair[0]).indexOf('field.') === 0 ? ui.t(pair[0]) : pair[0];
      return [label, pair[1]];
    });
    if (!clean.length) return '';
    return '<div class="fact-grid">' + clean.map(function (pair) {
      return '<div class="fact"><span class="fact-key">' + ui.esc(pair[0]) + '</span>' +
        '<span class="fact-value">' + ui.esc(pair[1]) + '</span></div>';
    }).join('') + '</div>';
  }

  function paragraph(text) {
    return text ? '<p>' + ui.esc(text) + '</p>' : '';
  }

  /* ---------- Paradigms ----------
     A word's forms are the one place where a card legitimately runs long, so
     each tense is a disclosure row that opens into its persons. Everything is
     closed when an entry is first read: the page shows the shape of the
     paradigm, not twelve tables at once. */

  function formsMap() {
    if (!ns.session.formsOpen) ns.session.formsOpen = {};
    return ns.session.formsOpen;
  }

  function formsOpen(id) { return formsMap()[id] === true; }

  /* Both the model's new [{person, form}] shape and the older string list are
     accepted, so an entry saved before 4.1 still renders. */
  function formList(items) {
    if (!Array.isArray(items)) return [];
    return items.map(function (item) {
      if (typeof item === 'string') return { person: '', form: item };
      if (!item) return null;
      return {
        person: String(item.person || item.label || item.name || ''),
        form: String(item.form || item.text || '')
      };
    }).filter(function (item) { return item && item.form; });
  }

  function paradigmRows(items) {
    return formList(items).map(function (item) {
      return '<div class="para-row">' +
        (item.person ? '<span class="para-key">' + ui.esc(item.person) + '</span>' : '') +
        '<span class="para-value">' + ui.esc(item.form) + '</span></div>';
    }).join('');
  }

  /* One disclosure row. `register` collects the ids so the card can offer a
     single Expand all forms control above them. */
  function paradigmGroup(cardKey, index, label, items, register) {
    var list = formList(items);
    if (!list.length) return '';
    var id = cardKey + ':' + index;
    register.push(id);
    var open = formsOpen(id);
    /* Two columns only when the group halves evenly. An odd count — the French
       imperative, which has three persons — would split 2/1 and then read
       left-to-right in the wrong order. */
    var paired = list.length >= 4 && list.length % 2 === 0;
    return '<div class="form-group' + (open ? ' is-open' : '') + '">' +
      '<button type="button" class="form-toggle" data-forms="' + ui.esc(id) + '" ' +
      'aria-expanded="' + (open ? 'true' : 'false') + '">' +
      '<span class="form-name">' + ui.esc(label) + '</span>' +
      '<span class="form-count">' + ui.esc(ui.t('entry.formsCount', { n: list.length })) + '</span>' +
      '<span class="form-chevron">' + ui.icon('chevron') + '</span></button>' +
      (open ? '<div class="paradigm' + (paired ? '' : ' is-single') + '">' +
        paradigmRows(list) + '</div>' : '') +
      '</div>';
  }

  function formsToolbar(cardKey, ids) {
    if (!ids.length) return '';
    var openEverywhere = ids.every(formsOpen);
    return '<div class="forms-toolbar"><button type="button" class="link-btn" ' +
      'data-forms-all="' + ui.esc(cardKey) + '" data-forms-ids="' + ui.esc(ids.join(' ')) + '">' +
      ui.t(openEverywhere ? 'entry.formsCollapse' : 'entry.formsExpand') + '</button></div>';
  }

  /* ---------- Card bodies ---------- */

  function bodySenses(line) {
    var senses = line && Array.isArray(line.senses) ? line.senses : [];
    if (!senses.length) return '';
    return senses.map(function (sense, i) {
      return '<div class="sense">' +
        '<div class="sense-head"><span class="sense-index">' + (i + 1) + '</span>' +
        (sense.pos ? '<span class="pos">' + ui.esc(sense.pos) + '</span>' : '') + '</div>' +
        '<div class="sense-def">' + ui.esc(sense.definition || '') + '</div>' +
        examples(sense.examples) + '</div>';
    }).join('');
  }

  function bodyCollocations(line) {
    var items = line && Array.isArray(line.collocations) ? line.collocations.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      var objects = Array.isArray(item.typical_objects) ? item.typical_objects.filter(Boolean) : [];
      return {
        term: '<span class="mono">' + ui.esc(item.pattern || '') + '</span>',
        desc: ui.esc(item.meaning || ''),
        extra: objects.length ? '<div class="chips" style="margin-top:6px">' + objects.map(function (obj) {
          return '<span class="chip">' + ui.esc(obj) + '</span>';
        }).join('') + '</div>' : ''
      };
    });
  }

  function bodyUsage(line) { return bullets(line && line.usage_notes); }

  function bodyConfusables(line) {
    var conf = line && line.confusables;
    if (!conf || typeof conf !== 'object') return '';
    var table = Array.isArray(conf.table) ? conf.table.filter(Boolean) : [];
    var parallels = Array.isArray(conf.parallel_examples) ? conf.parallel_examples.filter(Boolean) : [];
    var pairs = Array.isArray(conf.contrast_pairs) ? conf.contrast_pairs.filter(Boolean) : [];
    var html = '';

    if (conf.theme) html += '<p class="confuse-theme">' + ui.esc(conf.theme) + '</p>';
    if (table.length) {
      html += '<div class="table-wrap"><table class="compare-table"><thead><tr>' +
        '<th>' + ui.esc(ui.t('field.word')) + '</th><th>' + ui.esc(ui.t('field.meaning')) +
        '</th><th>' + ui.esc(ui.t('field.note')) + '</th></tr></thead><tbody>' +
        table.map(function (row) {
          return '<tr><td class="ct-word">' + ui.esc(row.word || '') + '</td>' +
            '<td>' + ui.esc(row.meaning || '') + '</td>' +
            '<td class="ct-note">' + ui.esc(row.note || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    if (parallels.length) {
      html += subLabel(ui.t('entry.sameIdea'));
      html += '<ul class="parallel-list">' + parallels.map(function (item) {
        return '<li><div class="example-text">' + ui.esc(item.sentence || '') + '</div>' +
          (item.note ? '<div class="def-desc">' + ui.esc(item.note) + '</div>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    if (pairs.length) {
      html += subLabel(ui.t('entry.easilyMixed'));
      html += rows(pairs, function (pair) {
        return {
          term: '<span class="mono">' + ui.esc(pair.a || '') + '</span><span class="vs">vs</span>' +
            '<span class="mono">' + ui.esc(pair.b || '') + '</span>',
          desc: ui.esc(pair.a_meaning || '') + ' · ' + ui.esc(pair.b_meaning || '')
        };
      });
    }
    return html;
  }

  /* The precise central sense. Entries written before 6.0 hold a metaphor in
     `core_metaphor`; it is still rendered rather than dropped, because a cached
     entry should not lose a card to a rename. */
  function bodyCore(line) {
    if (!line) return '';
    var text = line.core_meaning || line.core_metaphor;
    return text ? '<p class="core-metaphor">' + ui.esc(text) + '</p>' : '';
  }

  function bodyNuance(line) {
    return line && line.nuance ? '<p class="core-metaphor">' + ui.esc(line.nuance) + '</p>' : '';
  }

  function bodyOriginalSense(line) {
    if (!line) return '';
    var html = line.original_sense
      ? '<p class="core-metaphor">' + ui.esc(line.original_sense) + '</p>' : '';
    var path = line.senses_path;
    if (path && typeof path === 'object') {
      if (path.primary) html += facts([['field.primarySense', path.primary]]);
      var extended = Array.isArray(path.extended) ? path.extended.filter(Boolean) : [];
      if (extended.length) {
        html += subLabel(ui.t('entry.extendedSenses'));
        html += rows(extended, function (item) {
          return {
            term: ui.esc(item.sense || ''),
            desc: item.from ? '← ' + ui.esc(item.from) : ''
          };
        });
      }
      if (path.figurative) html += facts([['field.figurativeSense', path.figurative]]);
    }
    return html;
  }

  function bodyThenAndNow(line) {
    var item = line && line.then_and_now;
    if (!item || typeof item !== 'object') return '';
    return facts([['field.then', item.then], ['field.now', item.now]]) + paragraph(item.note);
  }

  function bodyEtymology(line) {
    var ety = line && line.etymology;
    if (!ety || typeof ety !== 'object') return '';
    var chain = Array.isArray(ety.chain) ? ety.chain.filter(Boolean) : [];
    var html = '';
    if (chain.length) {
      html += '<ol class="etym-timeline">' + chain.map(function (node) {
        return '<li class="etym-node"><span class="etym-mark"></span>' +
          '<div class="etym-line">' +
          '<span class="etym-lang">' + ui.esc(node.language || node.stage || '') + '</span>' +
          (node.date ? '<span class="etym-date">' + ui.esc(node.date) + '</span>' : '') + '</div>' +
          (node.form ? '<div class="etym-form">' + ui.esc(node.form) + '</div>' : '') +
          (node.meaning ? '<div class="etym-meaning">' + ui.esc(node.meaning) + '</div>' : '') +
          '</li>';
      }).join('') + '</ol>';
    }
    var factList = [];
    if (ety.via) factList.push(['field.via', ety.via]);
    if (ety.first_attested) factList.push(['field.attested', ety.first_attested]);
    if (ety.certainty) factList.push(['field.certainty', ety.certainty]);
    if (factList.length) html += facts(factList);
    if (ety.shift) html += '<p class="etym-shift">' + ui.esc(ety.shift) + '</p>';
    return html;
  }

  function bodyKanjiOrigin(line) {
    var items = line && Array.isArray(line.kanji_origin) ? line.kanji_origin.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return {
        term: '<span class="kanji-lg">' + ui.esc(item.kanji || '') + '</span>' +
          (item.formation_term ? '<span class="chip">' + ui.esc(item.formation_term) + '</span>' : '') +
          (item.formation ? '<span class="chip">' + ui.esc(item.formation) + '</span>' : ''),
        desc: ui.esc(item.original_image || ''),
        extra: item.path ? '<div class="def-desc">' + ui.esc(item.path) + '</div>' : ''
      };
    });
  }

  function bodyCharacterEvolution(line) {
    var items = line && Array.isArray(line.character_evolution) ? line.character_evolution.filter(Boolean) : [];
    if (!items.length) return '';
    return '<ol class="etym-timeline">' + items.map(function (item) {
      return '<li class="etym-node"><span class="etym-mark"></span>' +
        '<div class="etym-line"><span class="etym-lang">' + ui.esc(item.stage || '') + '</span></div>' +
        (item.form ? '<div class="etym-form">' + ui.esc(item.form) + '</div>' : '') +
        (item.meaning ? '<div class="etym-meaning">' + ui.esc(item.meaning) + '</div>' : '') +
        (item.note ? '<div class="etym-meaning muted">' + ui.esc(item.note) + '</div>' : '') +
        '</li>';
    }).join('') + '</ol>';
  }

  function bodyComponents(line) {
    var items = line && Array.isArray(line.components) ? line.components.filter(Boolean) : [];
    if (!items.length) return '';
    return '<div class="morph-formula">' + items.map(function (item, i) {
      var rootKey = ns.roots && item.part
        ? ns.roots._keyOf('component', item.origin || (state.entry && state.entry.language) || 'han', item.part)
        : '';
      var open = rootKey
        ? '<button type="button" class="morph-part is-link" data-root-link="' + ui.esc(rootKey) + '">'
        : '<span class="morph-part">';
      var close = rootKey ? '</button>' : '</span>';
      return (i ? '<span class="morph-op">+</span>' : '') +
        open +
        '<b>' + ui.esc(item.part || '') + '</b>' +
        (item.meaning ? '<i>' + ui.esc(item.meaning) + '</i>' : '') +
        (item.kind ? '<em>' + ui.esc(item.kind) + '</em>' : '') +
        (item.note ? '<u>' + ui.esc(item.note) + '</u>' : '') +
        close;
    }).join('') + '</div>';
  }

  function bodyMorphology(line) {
    var morph = line && line.morphology;
    if (!morph || typeof morph !== 'object') return '';
    var parts = Array.isArray(morph.breakdown) ? morph.breakdown.filter(Boolean) : [];
    var variants = Array.isArray(morph.root_variants) ? morph.root_variants.filter(Boolean) : [];
    var html = '';
    if (parts.length) {
      html += '<div class="morph-formula">' + parts.map(function (part, i) {
        var rootKey = part.type === 'root' && ns.roots
          ? ns.roots._keyOf('morpheme', part.origin || (state.entry && state.entry.language), part.part)
          : '';
        var open = rootKey
          ? '<button type="button" class="morph-part is-link" data-root-link="' + ui.esc(rootKey) + '">'
          : '<span class="morph-part">';
        var close = rootKey ? '</button>' : '</span>';
        return (i ? '<span class="morph-op">+</span>' : '') +
          open + '<b>' + ui.esc(part.part || '') + '</b>' +
          (part.meaning ? '<i>' + ui.esc(part.meaning) + '</i>' : '') +
          (part.origin ? '<em>' + ui.esc(part.origin) + '</em>' : '') +
          (part.form_note ? '<u>' + ui.esc(part.form_note) + '</u>' : '') + close;
      }).join('') + '</div>';
    }
    if (morph.composition) html += '<p class="morph-composition">' + ui.esc(morph.composition) + '</p>';
    if (variants.length) {
      html += subLabel(ui.t('entry.rootVariants'));
      html += rows(variants, function (item) {
        return { term: '<span class="mono">' + ui.esc(item.form || '') + '</span>', desc: ui.esc(item.note || '') };
      });
    }
    return html;
  }

  function bodyWordFormation(line) {
    var form = line && line.word_formation;
    if (!form || typeof form !== 'object') return '';
    var parts = Array.isArray(form.parts) ? form.parts.filter(Boolean) : [];
    var html = form.type ? chips([form.type], 'chip-accent') : '';
    if (parts.length) {
      html += '<div class="morph-formula">' + parts.map(function (part, i) {
        return (i ? '<span class="morph-op">+</span>' : '') +
          '<span class="morph-part"><b>' + ui.esc(part.morpheme || '') + '</b>' +
          (part.meaning ? '<i>' + ui.esc(part.meaning) + '</i>' : '') +
          (part.role ? '<u>' + ui.esc(part.role) + '</u>' : '') + '</span>';
      }).join('') + '</div>';
    }
    if (form.note) html += paragraph(form.note);
    return html;
  }

  function bodyCompounds(line) {
    var items = line && Array.isArray(line.compounds) ? line.compounds.filter(Boolean) : [];
    if (!items.length) return '';
    return '<div class="morph-formula">' + items.map(function (item, i) {
      return (i ? '<span class="morph-op">+</span>' : '') +
        '<span class="morph-part"><b>' + ui.esc(item.part || '') + '</b>' +
        (item.meaning ? '<i>' + ui.esc(item.meaning) + '</i>' : '') +
        (item.note ? '<u>' + ui.esc(item.note) + '</u>' : '') + '</span>';
    }).join('') + '</div>';
  }

  function bodyRootFamily(line) {
    var family = line && line.root_family;
    if (!family || typeof family !== 'object') return '';
    var direct = Array.isArray(family.direct) ? family.direct.filter(Boolean) : [];
    var shared = Array.isArray(family.shared_root) ? family.shared_root.filter(Boolean) : [];
    var html = '';
    if (direct.length) {
      html += subLabel(ui.t('entry.directDerivatives'));
      html += '<ul class="family-list">' + direct.map(function (item) {
        return '<li><div class="family-head"><b>' + ui.esc(item.word || '') + '</b>' +
          (item.pos ? '<span class="pos">' + ui.esc(item.pos) + '</span>' : '') +
          (item.formula ? '<span class="family-formula">' + ui.esc(item.formula) + '</span>' : '') +
          '</div>' +
          (item.gloss ? '<div class="family-gloss">' + ui.esc(item.gloss) + '</div>' : '') +
          examples(item.examples) + '</li>';
      }).join('') + '</ul>';
    }
    if (shared.length) {
      html += subLabel(ui.t('entry.sharedRoot'));
      html += '<ul class="family-list is-compact">' + shared.map(function (item) {
        return '<li><div class="family-head"><b>' + ui.esc(item.word || '') + '</b></div>' +
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
    return rows(items, function (item) {
      return {
        term: ui.esc(item.word || '') +
          (item.actual_origin ? ' <span class="chip">' + ui.esc(item.actual_origin) + '</span>' : ''),
        desc: ui.esc(item.note || '')
      };
    });
  }

  function bodyReadings(line) {
    var r = line && line.readings;
    if (!r || typeof r !== 'object') return '';
    var html = '';
    [['field.on', r.on], ['field.kun', r.kun], ['field.special', r.special]].forEach(function (group) {
      var items = Array.isArray(group[1]) ? group[1].filter(Boolean) : [];
      if (!items.length) return;
      html += subLabel(ui.t(group[0]));
      html += rows(items, function (item) {
        return {
          term: '<span class="kana-lg">' + ui.esc(item.reading || '') + '</span>' +
            (item.romaji ? '<span class="chip">' + ui.esc(item.romaji) + '</span>' : '') +
            (item.okurigana ? '<span class="chip">' + ui.esc(ui.t('field.okurigana')) + ' ' +
              ui.esc(item.okurigana) + '</span>' : ''),
          desc: ui.esc(item.note || '')
        };
      });
    });
    return html;
  }

  function bodyWordStratum(line) {
    var value = line && line.word_stratum;
    if (!value) return '';
    var labels = { wago: '和語 · native Japanese', kango: '漢語 · Sino-Japanese', gairaigo: '外来語 · loanword', mixed: '混種語 · mixed' };
    return facts([['field.stratum', labels[value] || value]]);
  }

  function bodyMultipleReadings(line) {
    var items = line && Array.isArray(line.multiple_readings) ? line.multiple_readings.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return {
        term: '<span class="pinyin-lg">' + ui.esc(item.reading || '') + '</span>',
        desc: ui.esc(item.meaning || ''),
        extra: item.example ? '<div class="example"><div class="example-text">' + ui.esc(item.example) + '</div></div>' : ''
      };
    });
  }

  /* Every language's verb data lands here: the Japanese class/stem/forms shape,
     the German principal-parts strip, and the person-by-person tense tables
     that the other four languages return. */
  function bodyConjugation(line, info) {
    var c = line && (line.conjugation || line.conjugaison);
    if (!c || typeof c !== 'object') return '';
    var key = (info && info.key) || 'conjugation';
    var html = '';

    var pp = c.principal_parts;
    if (pp && typeof pp === 'object') {
      var strip = [pp.infinitive, pp.praeteritum, pp.partizipII].filter(Boolean);
      if (strip.length) {
        html += '<div class="verb-forms">' + strip.map(function (form) {
          return '<span class="verb-form">' + ui.esc(form) + '</span>';
        }).join('<span class="verb-arrow">→</span>') + '</div>';
      }
      html += facts([['field.base', pp.base], ['field.thirdPerson', pp.third_person], ['field.past', pp.past],
        ['field.participle', pp.participle], ['field.gerund', pp.gerund]]);
    }

    html += facts([['field.class', c.class], ['field.stem', c.stem], ['field.auxiliary', c.auxiliary],
      ['field.participle', c.participle], ['field.gerund', c.gerund]]);

    /* Japanese names its forms rather than inflecting by person. */
    var forms = Array.isArray(c.forms) ? c.forms.filter(Boolean) : [];
    if (forms.length) {
      html += rows(forms, function (item) {
        return { term: ui.esc(item.name || ''), desc: '<span class="mono">' + ui.esc(item.form || '') + '</span>' };
      });
    }

    var ids = [];
    (Array.isArray(c.tenses) ? c.tenses : []).forEach(function (tense) {
      if (!tense) return;
      var label = [tense.mood, tense.tense].filter(Boolean).join(' · ') || 'Forms';
      html += paradigmGroup(key, ids.length, label, tense.forms, ids);
    });
    html += formsToolbar(key, ids);

    var irregular = Array.isArray(c.irregular) ? c.irregular.filter(Boolean) : [];
    if (irregular.length) html += subLabel(ui.t('entry.paradigmIrregular')) + bullets(irregular);
    if (c.note) html += paragraph(c.note);
    return html;
  }

  function bodyCaseGovernment(line) {
    var items = line && Array.isArray(line.case_government) ? line.case_government.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return {
        term: '<span class="mono">' + ui.esc(item.pattern || '') + '</span>',
        desc: ui.esc(item.note || ''),
        extra: item.example ? '<div class="example"><div class="example-text">' + ui.esc(item.example) + '</div></div>' : ''
      };
    });
  }

  function bodySeparablePrefixes(line) {
    var items = line && Array.isArray(line.separable_prefixes) ? line.separable_prefixes.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return {
        term: '<span class="mono">' + ui.esc(item.prefix || '') + '</span>',
        desc: ui.esc(item.meaning || ''),
        extra: item.example ? '<div class="example"><div class="example-text">' + ui.esc(item.example) + '</div></div>' : ''
      };
    });
  }

  /* ---------- Forms of a noun ----------
     One card for every language that marks its nouns: gender and article in
     French and Italian, the four-case declension table in German. The retired
     article_plural and gender_number fields are still read, so an entry saved
     before 4.1 keeps working. */
  function nounData(line) {
    if (!line || typeof line !== 'object') return null;
    if (line.noun_forms && typeof line.noun_forms === 'object') return line.noun_forms;
    if (line.article_plural && typeof line.article_plural === 'object') {
      var a = line.article_plural;
      return {
        gender: a.article, plural: a.plural,
        article_forms: a.genitive ? [{ context: 'Genitive singular', form: a.genitive }] : [],
        note: a.note
      };
    }
    if (line.gender_number && typeof line.gender_number === 'object') return line.gender_number;
    return null;
  }

  function bodyNounForms(line) {
    var n = nounData(line);
    if (!n) return '';
    var html = facts([['field.gender', n.gender], ['field.article', n.article], ['field.plural', n.plural]]);

    var articles = Array.isArray(n.article_forms) ? n.article_forms.filter(Boolean) : [];
    if (articles.length) {
      html += rows(articles, function (item) {
        return {
          term: ui.esc(item.context || ''),
          desc: '<span class="mono">' + ui.esc(item.form || '') + '</span>'
        };
      });
    }

    var declension = Array.isArray(n.declension) ? n.declension.filter(Boolean) : [];
    if (declension.length) {
      html += '<div class="table-wrap decl-wrap"><table class="compare-table decl-table">' +
        '<thead><tr><th>' + ui.t('field.case') + '</th><th>' + ui.t('field.singular') +
        '</th><th>' + ui.t('field.plural') + '</th></tr></thead><tbody>' +
        declension.map(function (row) {
          return '<tr><td class="ct-word">' + ui.esc(row.case || '') + '</td>' +
            '<td class="mono">' + ui.esc(row.singular || '') + '</td>' +
            '<td class="mono">' + ui.esc(row.plural || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    var irregular = Array.isArray(n.irregular) ? n.irregular.filter(Boolean) : [];
    if (irregular.length) html += subLabel(ui.t('entry.paradigmIrregular')) + bullets(irregular);
    if (n.note) html += paragraph(n.note);
    return html;
  }

  /* ---------- Forms of an adjective ----------
     Agreement in the four Romance languages; in German the attributive endings
     are the whole point, and there is no agreement row at all. */
  function bodyAdjectiveForms(line) {
    var a = line && line.adjective_forms;
    if (!a || typeof a !== 'object') return '';
    var html = facts([['field.position', a.position]]);

    var agreement = Array.isArray(a.agreement) ? a.agreement.filter(Boolean) : [];
    if (agreement.length) {
      html += rows(agreement, function (item) {
        return {
          term: ui.esc(item.context || ''),
          desc: '<span class="mono">' + ui.esc(item.form || '') + '</span>'
        };
      });
    }

    var endings = Array.isArray(a.endings) ? a.endings.filter(Boolean) : [];
    if (endings.length) {
      html += subLabel(ui.t('entry.endings')) + rows(endings, function (item) {
        return {
          term: ui.esc(item.pattern || ''),
          desc: '<span class="mono">' + ui.esc(item.ending || '') + '</span>'
        };
      });
    }

    var special = Array.isArray(a.special) ? a.special.filter(Boolean) : [];
    if (special.length) html += subLabel(ui.t('entry.watchOut')) + bullets(special);
    if (a.note) html += paragraph(a.note);
    return html;
  }

  function bodyComparison(line) {
    var c = line && line.comparison;
    if (!c || typeof c !== 'object') return '';
    var html = facts([['field.comparative', c.comparative], ['field.superlative', c.superlative], ['field.absolute', c.absolute]]);
    if (c.irregular) html += '<p class="small muted-3">' + ui.esc(ui.t('entry.irregularComparison')) + '</p>';
    if (c.note) html += paragraph(c.note);
    return html;
  }

  /* ---------- Pronouns and government ---------- */
  function bodyPronouns(line) {
    var p = line && line.pronouns;
    if (!p || typeof p !== 'object') return '';
    var html = facts([['field.kind', p.kind], ['field.position', p.position]]);
    var forms = Array.isArray(p.forms) ? p.forms.filter(Boolean) : [];
    if (forms.length) {
      html += rows(forms, function (item) {
        return {
          term: ui.esc(item.label || '') + (item.form ? '<span class="chip mono">' + ui.esc(item.form) + '</span>' : ''),
          desc: ui.esc(item.note || '')
        };
      });
    }
    if (p.clitics) html += paragraph(p.clitics);
    if (p.note) html += paragraph(p.note);
    return html;
  }

  /* What a verb governs — an accusative in German, a preposition everywhere
     else. Both shapes arrive as a list of patterns with one example each. */
  function bodyGovernment(line) {
    var g = line && line.government;
    if (!g || typeof g !== 'object') return '';
    var items = Array.isArray(g.items) ? g.items.filter(Boolean) : [];
    var html = '';
    if (items.length) {
      html += rows(items, function (item) {
        return {
          term: '<span class="mono">' + ui.esc(item.pattern || '') + '</span>' +
            (item.case ? '<span class="chip chip-accent">' + ui.esc(item.case) + '</span>' : ''),
          desc: ui.esc(item.meaning || ''),
          extra: item.example ? '<div class="example"><div class="example-text">' +
            ui.esc(item.example) + '</div></div>' : ''
        };
      });
    }
    if (g.clitics) html += paragraph(g.clitics);
    if (g.note) html += paragraph(g.note);
    return html;
  }

  /* ---------- Profile ----------
     The one card that answers "what kind of word is this, and what about it do
     I simply have to memorise". */
  function bodyWordProfile(line) {
    var p = line && line.word_profile;
    if (!p || typeof p !== 'object') return '';
    var html = facts([['field.pos', p.pos], ['field.subtype', p.subtype],
      ['field.transitivity', p.transitivity], ['field.countability', p.countability],
      ['field.aspect', p.aspect], ['field.auxiliary', p.auxiliary], ['field.level', p.frequency]]);
    var memo = Array.isArray(p.must_memorise) ? p.must_memorise.filter(Boolean) : [];
    if (memo.length) html += subLabel(ui.t('entry.memorise')) + bullets(memo);
    if (p.note) html += paragraph(p.note);
    return html;
  }

  function bodyClassicalVsModern(line) {
    var items = line && line.classical && Array.isArray(line.classical.meanings)
      ? line.classical.meanings.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return {
        term: ui.esc(item.sense || ''),
        desc: item.source ? '《' + ui.esc(item.source) + '》' : '',
        extra: item.example ? '<div class="example"><div class="example-text">' + ui.esc(item.example) + '</div></div>' : ''
      };
    });
  }

  function bodyClassicalUsage(line) {
    var items = line && line.classical && Array.isArray(line.classical.usages)
      ? line.classical.usages.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return {
        term: '<span class="chip chip-accent">' + ui.esc(item.pattern || '') + '</span>',
        desc: ui.esc(item.gloss || ''),
        extra: item.example ? '<div class="example"><div class="example-text">' + ui.esc(item.example) + '</div></div>' : ''
      };
    });
  }

  function bodyDoublets(line) {
    var items = line && Array.isArray(line.doublets) ? line.doublets.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return {
        term: '<span class="mono">' + ui.esc(item.popular || '') + '</span>' +
          '<span class="vs">·</span><span class="mono">' + ui.esc(item.learned || '') + '</span>' +
          (item.latin ? '<span class="chip">' + ui.esc(item.latin) + '</span>' : ''),
        desc: ui.esc(item.difference || '')
      };
    });
  }

  function bodySoundShift(line) {
    var items = line && Array.isArray(line.sound_shift) ? line.sound_shift.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return {
        term: '<span class="mono">' + ui.esc(item.english || '') + '</span>' +
          '<span class="vs">→</span><span class="mono">' + ui.esc(item.german || '') + '</span>' +
          (item.shift ? '<span class="chip">' + ui.esc(item.shift) + '</span>' : ''),
        desc: ui.esc(item.note || '')
      };
    });
  }

  function bodySourceWord(line) {
    var s = line && line.source_word;
    if (!s || typeof s !== 'object') return '';
    return facts([['field.from', s.origin_language], ['field.original', s.original], ['field.literally', s.literal]]) +
      paragraph(s.note);
  }

  function bodySpellingVariants(line) {
    var items = line && Array.isArray(line.spelling_variants) ? line.spelling_variants.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return { term: '<span class="mono">' + ui.esc(item.form || '') + '</span>', desc: ui.esc(item.note || '') };
    });
  }

  function bodyOriginAllusion(line) {
    var o = line && line.origin_allusion;
    if (!o || typeof o !== 'object') return '';
    var html = facts([['field.source', o.source], ['field.author', o.author]]);
    if (o.quote) html += '<blockquote class="classic-quote">' + ui.esc(o.quote) + '</blockquote>';
    if (o.meaning) html += facts([['field.then', o.meaning]]);
    if (o.note) html += paragraph(o.note);
    return html;
  }

  function bodyPronunciation(line) {
    var items = line && Array.isArray(line.derived_pronunciation) ? line.derived_pronunciation.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return {
        term: ui.esc(item.word || ''),
        desc: '<span class="mono">' + ui.esc(item.ipa || item.reading || '') + '</span>'
      };
    });
  }

  function bodyCulture(line) { return bullets(line && line.cultural_notes); }

  function bodySynthesis(line) {
    var items = line && Array.isArray(line.synthesis) ? line.synthesis.filter(Boolean) : [];
    if (!items.length) return '';
    return '<ul class="synthesis-list">' + items.map(function (item) {
      return '<li>' + ui.esc(item) + '</li>';
    }).join('') + '</ul>';
  }

  function bodyMnemonic(line) {
    return line && line.mnemonic ? '<div class="mnemonic">' + ui.esc(line.mnemonic) + '</div>' : '';
  }

  /* ---------- Sentence card bodies ---------- */

  function bodyTranslation(line) {
    if (!line || !line.translation) return '';
    return '<p class="core-metaphor">' + ui.esc(line.translation) + '</p>' +
      (line.register ? facts([['field.register', line.register]]) : '');
  }

  function bodyWordByWord(line) {
    var items = line && Array.isArray(line.word_by_word) ? line.word_by_word.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return {
        term: '<span class="mono">' + ui.esc(item.form || '') + '</span>' +
          (item.lemma && item.lemma !== item.form ? '<span class="chip">→ ' + ui.esc(item.lemma) + '</span>' : '') +
          (item.pos ? '<span class="pos">' + ui.esc(item.pos) + '</span>' : ''),
        desc: ui.esc(item.meaning || '') + (item.note ? ' · ' + ui.esc(item.note) : '')
      };
    });
  }

  function bodyChunks(line) {
    var items = line && Array.isArray(line.chunks) ? line.chunks.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return {
        term: '<span class="mono">' + ui.esc(item.chunk || '') + '</span>' +
          (item.kind ? '<span class="chip">' + ui.esc(item.kind) + '</span>' : ''),
        desc: ui.esc(item.meaning || ''),
        extra: item.note ? '<div class="def-desc muted">' + ui.esc(item.note) + '</div>' : ''
      };
    });
  }

  function bodyStructure(line) {
    var items = line && Array.isArray(line.structure) ? line.structure.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return {
        term: ui.esc(item.part || '') + (item.role ? '<span class="chip">' + ui.esc(item.role) + '</span>' : ''),
        desc: ui.esc(item.note || '')
      };
    });
  }

  function bodyGrammar(line) {
    var items = line && Array.isArray(line.grammar) ? line.grammar.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return {
        term: ui.esc(item.point || ''),
        desc: ui.esc(item.explanation || ''),
        extra: item.example ? '<div class="example"><div class="example-text">' + ui.esc(item.example) + '</div></div>' : ''
      };
    });
  }

  function bodyRegister(line) {
    var items = line && Array.isArray(line.register) ? line.register.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return { term: ui.esc(item.aspect || item.point || ''), desc: ui.esc(item.explanation || item.note || '') };
    });
  }

  function bodyPitfalls(line) {
    var items = line && Array.isArray(line.pitfalls) ? line.pitfalls.filter(Boolean) : [];
    if (!items.length) return '';
    return rows(items, function (item) {
      return { term: ui.esc(item.issue || ''), desc: ui.esc(item.explanation || '') };
    });
  }

  function bodyPattern(line) {
    var p = line && line.pattern;
    if (!p || typeof p !== 'object') return '';
    var html = p.template ? '<p class="core-metaphor mono">' + ui.esc(p.template) + '</p>' : '';
    if (p.gloss) html += facts([['field.means', p.gloss]]);
    var subs = Array.isArray(p.substitutions) ? p.substitutions.filter(Boolean) : [];
    if (subs.length) {
      html += subLabel(ui.t('entry.slots'));
      html += subs.map(function (slot) {
        var options = Array.isArray(slot.options) ? slot.options.filter(Boolean) : [];
        return '<div class="slot-row"><span class="mono">' + ui.esc(slot.slot || '') + '</span>' +
          chips(options) + '</div>';
      }).join('');
    }
    html += examples(p.examples);
    return html;
  }

  var BODY_BUILDERS = {
    senses: bodySenses, collocations: bodyCollocations, usage: bodyUsage, confusables: bodyConfusables,
    core: bodyCore, nuance: bodyNuance, originalSense: bodyOriginalSense, thenAndNow: bodyThenAndNow,
    etymology: bodyEtymology, kanjiOrigin: bodyKanjiOrigin, characterEvolution: bodyCharacterEvolution,
    components: bodyComponents, morphology: bodyMorphology, wordFormation: bodyWordFormation,
    komposita: bodyCompounds, rootFamily: bodyRootFamily, falseCognates: bodyFalseCognates,
    readings: bodyReadings, wordStratum: bodyWordStratum, multipleReadings: bodyMultipleReadings,
    wordProfile: bodyWordProfile, nounForms: bodyNounForms, adjectiveForms: bodyAdjectiveForms,
    conjugation: bodyConjugation, comparison: bodyComparison, pronouns: bodyPronouns,
    government: bodyGovernment, kasusRektion: bodyCaseGovernment, trennbarePraefixe: bodySeparablePrefixes,
    classicalVsModern: bodyClassicalVsModern, classicalUsage: bodyClassicalUsage,
    doublets: bodyDoublets, lautverschiebung: bodySoundShift, sourceWord: bodySourceWord,
    spellingVariants: bodySpellingVariants, originAllusion: bodyOriginAllusion,
    pronunciation: bodyPronunciation, culture: bodyCulture, synthesis: bodySynthesis, mnemonic: bodyMnemonic,
    translation: bodyTranslation, wordByWord: bodyWordByWord, chunks: bodyChunks,
    structure: bodyStructure, grammar: bodyGrammar, register: bodyRegister,
    pitfalls: bodyPitfalls, pattern: bodyPattern
  };

  /* A card's renderer, wherever it lives. The document cards are built in
     view-document.js because they belong to that page; a card with no renderer
     is a bug the test suite catches by comparing the catalogue with this. */
  /* The two catalogues share two key names — `translation` and `register` mean
     something different on a file than they do on a sentence — so the document
     page resolves its builders first rather than by accident. */
  function bodyBuilder(key) {
    var documentBuilders = ns.views.document && ns.views.document.builders;
    if (state.kind === 'document' && documentBuilders && documentBuilders[key]) return documentBuilders[key];
    if (BODY_BUILDERS[key]) return BODY_BUILDERS[key];
    return documentBuilders ? documentBuilders[key] : null;
  }

  function builderKeys() {
    var keys = Object.keys(BODY_BUILDERS);
    var extra = ns.views.document && ns.views.document.builders;
    if (extra) keys = keys.concat(Object.keys(extra));
    return keys;
  }

  /* ---------- Card shell ---------- */

  /* "English · native" for any non-English source language. The gloss is
     dropped when it would just repeat the English word, so Collocations and
     Culture do not come out as "Collocations · Collocations". */
  function cardTitle(card, sourceLang) {
    var gloss = card.notes && sourceLang ? card.notes[sourceLang] : '';
    if (!gloss || gloss === card.title) return card.title;
    return card.title + ' · ' + gloss;
  }

  function cardShell(card, body, sourceLang) {
    if (!body) return '';
    var collapsed = isCollapsed(card.key);
    var isNew = !revealed[card.key];
    if (isNew) revealed[card.key] = true;
    return '<section class="card deep-card' + (collapsed ? ' is-collapsed' : '') +
      (isNew ? ' reveal' : '') + '" data-card="' + ui.esc(card.key) + '">' +
      '<button type="button" class="card-head card-toggle" data-toggle="' + ui.esc(card.key) + '" ' +
      'aria-expanded="' + (collapsed ? 'false' : 'true') + '">' +
      ui.icon(card.icon) +
      '<span class="card-title">' + ui.esc(cardTitle(card, sourceLang)) + '</span>' +
      '<span class="card-chevron">' + ui.icon('chevron') + '</span></button>' +
      '<div class="card-body">' + body + '</div></section>';
  }

  function cardSkeleton(card, sourceLang) {
    return '<section class="card deep-card is-loading" data-loading="' + ui.esc(card.key) + '">' +
      '<div class="card-head">' + ui.icon(card.icon) +
      '<span class="card-title">' + ui.esc(cardTitle(card, sourceLang)) + '</span></div>' +
      '<div class="card-body">' +
      '<div class="skeleton sk-line sk-w-90" style="margin-top:0"></div>' +
      '<div class="skeleton sk-line sk-w-70"></div></div></section>';
  }

  /* The name of a request line, in the interface language. `entry.line.*` lives
     in strings.js like every other piece of copy; the fallback is for a line
     that has no key yet, so a new line reports something readable instead of a
     raw key. */
  function lineLabel(line) {
    var key = 'entry.line.' + line;
    var label = ui.t(key);
    if (label !== key) return label;
    if (line === 'etymology') return 'Word root';
    if (line === 'usage') return 'Meaning and use';
    if (line === 'inflection') return 'Forms and grammar';
    if (line === 'distinction') return 'Disambiguation';
    if (line === 'semantics') return 'Meaning';
    if (line === 'document') return 'The file';
    return 'Grammar and structure';
  }

  function lineNotice(card, line) {
    if ((state.lineState[line] || 'idle') === 'error') {
      return '<section class="card deep-card" data-line-notice="' + ui.esc(line) + '">' +
        ns.views.dictionary.errorNotice(state.lineError[line], {
          retryAttr: 'data-retry-line="' + ui.esc(line) + '"',
          rawText: state.lineError[line] && state.lineError[line].extra ? state.lineError[line].extra.raw : ''
        }) + '</section>';
    }
    return '<section class="card deep-card" data-line-notice="' + ui.esc(line) + '">' +
      '<div class="notice notice-warn">' + ui.icon('info') + '<div>' +
      '<div class="notice-title">' + ui.esc(ui.t('entry.pendingTitle', { section: lineLabel(line) })) + '</div>' +
      '<div class="notice-body">' + ui.esc(ui.t('entry.pendingText')) + '</div>' +
      '<div class="notice-actions"><button type="button" class="btn" data-retry-line="' + ui.esc(line) + '">' +
      ui.icon('refresh') + ui.esc(ui.t('common.generate')) + '</button></div></div></div></section>';
  }

  /* A quiet section label. Deliberately not a control: the page keeps exactly
     one collapse button, and a heading that also folds is a third state to
     reason about when twelve cards are already on screen. */
  function groupHeading(id) {
    var list = state.kind === 'sentence' ? CONFIG.sentenceGroups : CONFIG.groups;
    var meta = null;
    for (var i = 0; i < list.length; i += 1) if (list[i].id === id) meta = list[i];
    if (!meta) return '';
    return '<div class="entry-group" data-group="' + ui.esc(meta.id) + '">' +
      ui.esc(ui.t(meta.labelKey)) + '</div>';
  }

  /* The explanation language lives here because it is a fact about the answer
     being read, not about the app. Changing it re-runs the whole lookup in the
     new language; the entry id carries the language, so the old answer stays in
     history and switching back is served from cache. */
  function outputLangControl() {
    var current = effectiveOutputLang(state.entry);
    return '<div class="toolbar-field">' +
      '<span class="toolbar-label">' + ui.esc(ui.t('entry.explainIn')) + '</span>' +
      ui.picker({
        id: 'output-lang',
        value: current,
        compact: true,
        label: ui.t('entry.explainIn'),
        title: ui.t('entry.explainIn'),
        options: CONFIG.outputLanguages.map(function (lang) {
          return { id: lang.id, label: lang.native };
        }),
        onPick: switchOutputLang
      }) + '</div>';
  }

  function deepRegion() {
    var cards = orderedCards();
    var html = '<div class="deep-toolbar">' + outputLangControl() +
      '<button type="button" class="btn btn-sm" data-collapse-toggle="1">' +
      ui.t(allCollapsed() ? 'entry.expandAll' : 'entry.collapseAll') + '</button></div>';

    /* Every card for this language is hidden. That has to say so: a blank page
       looks like a failure, and the fix lives in another screen. */
    if (!cards.length) {
      return html + '<section class="card deep-card"><div class="notice notice-warn">' + ui.icon('info') +
        '<div><div class="notice-title">' + ui.esc(ui.t('entry.noCardsTitle')) + '</div>' +
        '<div class="notice-body">' + ui.esc(ui.t('entry.noCards')) + '</div></div></div></section>';
    }

    var available = availableLines();
    var anchors = {};
    cards.forEach(function (card) {
      var line = cardLine(card);
      if (available.indexOf(line) === -1) return;
      if (!anchors[line]) anchors[line] = card.key;
    });
    var data = state.entry && state.entry.lines ? state.entry.lines : null;
    /* A document's four cards read one assembled object rather than a field of
       a stored line: the parts are stitched together as they arrive, so what
       the cards need is the current assembly, not the last response. */
    if (state.kind === 'document' && state.entry) data = { document: documentData(state.entry) };
    var sourceLang = state.entry ? state.entry.language : '';
    var group = null;
    /* The Word DNA cards are one argument told in several parts, so they share
       a container and read as a single block rather than as five unrelated
       cards that happen to be next to each other. */
    var dna = [];

    function flushDna() {
      if (!dna.length) return;
      html += '<div class="dna-block">' + dna.join('') + '</div>';
      dna = [];
    }

    cards.forEach(function (card) {
      var line = cardLine(card);
      /* Cards whose line does not run for this language are not part of this
         entry at all — Chinese never asks for a paradigm, and Japanese feeds
         its conjugation card from the usage line. */
      if (available.indexOf(line) === -1) return;
      if (card.group !== group) {
        flushDna();
        group = card.group;
        html += groupHeading(group);
      }
      var status = state.lineState[line] || 'idle';
      var piece = '';
      if (status === 'ready') {
        var build = bodyBuilder(card.key);
        if (build) {
          var body = build(data ? data[line] : null, { key: card.key, line: line, lang: sourceLang });
          piece = cardShell(card, body, sourceLang);
        }
      } else if (status === 'loading') {
        piece = cardSkeleton(card, sourceLang);
      } else if (anchors[line] === card.key) {
        piece = lineNotice(card, line);
      }
      if (!piece) return;
      /* Anything this card produced joins the DNA block instead of the flow. */
      if (card.group === 'dna') dna.push(piece); else html += piece;
    });
    flushDna();
    return html;
  }

  /* ---------- Header ---------- */

  function languageMeta(id) {
    var list = CONFIG.languages;
    for (var i = 0; i < list.length; i += 1) if (list[i].id === id) return list[i];
    return null;
  }

  /* What the practice button needs. Chinese and Japanese have no usable answer
     without a reading, so an entry missing one cannot be practised. */
  function practiceItemFor(entry) {
    /* Only headwords are practisable. A sentence or a document in the pool
       would be handed to the spelling exercise as if it were a word. */
    if (entry.kind && entry.kind !== 'word') return null;
    var meta = languageMeta(entry.language);
    if (!meta) return null;
    var overview = entry.overview || {};
    if (meta.needsReading && !overview.reading) return null;
    var roots = ns.roots ? ns.roots.rootsFromEntry(entry) : [];
    return {
      word: entry.word,
      reading: overview.reading || '',
      meaning: overview.quick_meaning || '',
      /* The exercise shows these two from the first frame. */
      pos: overview.pos || '',
      language: entry.language,
      languageName: meta.native || entry.language,
      languageCode: entry.language || '',
      roots: roots,
      primaryRoot: roots[0] || null,
      /* Needed to find the translation in the explanation language the reader
         has configured for this source language. */
      model: entry.model || '',
      outputLang: entry.outputLang || '',
      practice: meta.practice,
      entryId: entry.id,
      mode: 'single',
      variants: entry.variants || []
    };
  }

  function headerCard(entry) {
    var overview = entry.overview || {};
    var word = entry.word || overview.word || '';
    var starred = store.isStarred(entry.id);
    var item = practiceItemFor(entry);

    var html = '<section class="card word-head">';
    html += '<div class="word-title-row">';
    html += '<div class="word-title">' + ui.esc(word);
    if (entry.language) html += ' <span class="badge-lang">' + ui.esc(entry.language.toUpperCase()) + '</span>';
    html += '</div><div class="word-actions">';
    if (ns.speech.supported() && word) {
      html += '<button type="button" class="icon-btn" data-speak="' + ui.esc(word) + '" ' +
        'data-speak-lang="' + ui.esc(entry.language || 'en') + '" aria-label="' +
        ui.esc(ui.t('entry.pronounce')) + '" title="' + ui.esc(ui.t('entry.pronounce')) + '">' +
        ui.icon('speaker') + '</button>';
    }
    html += '<button type="button" class="icon-btn is-muted" data-practice-entry ' +
      (item ? '' : 'disabled ') + 'aria-label="' + ui.esc(ui.t('entry.practise')) + '" title="' +
      ui.esc(ui.t(item ? 'entry.practise' : 'entry.practiseUnavailable')) + '">' + ui.icon('write') + '</button>';
    html += '<button type="button" class="icon-btn' + (starred ? ' is-starred' : '') + '" data-star-entry ' +
      'aria-label="' + ui.esc(ui.t('entry.star')) + '" title="' +
        ui.esc(ui.t('entry.star')) + '">' + (starred ? ui.iconFilled('star') : ui.icon('star')) + '</button>';
    html += '<button type="button" class="icon-btn is-muted" data-refresh-entry aria-label="' +
      ui.esc(ui.t('entry.regenerate')) + '" title="' + ui.esc(ui.t('entry.regenerate')) + '">' +
      ui.icon('refresh') + '</button>';
    html += '<button type="button" class="icon-btn is-muted" data-delete-entry aria-label="' +
      ui.esc(ui.t('entry.delete')) + '" title="' + ui.esc(ui.t('entry.delete')) + '">' +
      ui.icon('trash') + '</button>';
    html += '</div></div>';

    if (overview.reading) html += '<div class="word-ipa">' + ui.esc(overview.reading) + '</div>';
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
      '<div class="skeleton sk-line sk-w-60"></div></section>' +
      ui.skeletonCard(3) + ui.skeletonCard(2);
  }

  function notFoundScreen(entry) {
    var overview = entry.overview || {};
    var suggestions = Array.isArray(overview.suggestions) ? overview.suggestions.filter(Boolean) : [];
    var html = '<section class="card"><div class="card-head">' + ui.icon('question') +
      '<span class="card-title">' + ui.esc(ui.t('entry.notFoundTitle')) + '</span></div>' +
      '<div class="card-body">' +
      '<p>' + ui.esc(ui.t('entry.notFoundText', { word: entry.word })) + '</p>';
    if (suggestions.length) {
      html += '<div class="chips" style="margin-top:16px">' + suggestions.map(function (w) {
        return '<button type="button" class="chip chip-button" data-suggestion="' + ui.esc(w) + '">' +
          ui.esc(w) + '</button>';
      }).join('') + '</div>';
    }
    return html + '</div></section>';
  }

  function missingScreen() {
    return '<section class="card"><div class="empty" style="padding:32px 8px">' +
      '<div class="empty-icon">' + ui.icon('book') + '</div>' +
      '<div class="empty-title">' + ui.esc(ui.t('entry.notOnDeviceTitle')) + '</div>' +
      '<div class="empty-text">' + ui.esc(ui.t('entry.notOnDeviceText')) + '</div>' +
      '<div class="empty-actions"><button type="button" class="btn btn-primary" data-go-dictionary>' +
      ui.esc(ui.t('fav.emptyAction')) + '</button></div>' +
      '</div></section>';
  }

  function disclaimer() {
    return '<p class="small muted-3" style="text-align:center;margin-top:20px">' +
      ui.esc(ui.t('entry.disclaimer')) + '</p>';
  }

  /* ---------- Generation ---------- */

  function settingsSnapshot() {
    var s = store.getSettings();
    return { apiKey: s.apiKey, model: s.model };
  }

  /* The language this entry's answer is written in. Normally it follows the
     source language through the user's per-language table; an entry opened
     with an explicit override from the toolbar keeps that instead. */
  function effectiveOutputLang(entry) {
    if (!entry) return store.outputLangFor(null);
    if (entry.outputLangFixed && entry.outputLang) return entry.outputLang;
    if (entry.language && entry.language !== CONFIG.autoLang) return store.outputLangFor(entry.language);
    return entry.outputLang || store.outputLangFor(null);
  }

  function runOverview(entry) {
    var generation = state.generation;
    var settings = settingsSnapshot();
    state.overviewState = 'loading';
    state.overviewError = null;
    renderScreen();

    /* A sentence needs no overview: the sentence itself is the input. It does
       need a language though, and with the picker on Auto nothing else would
       ever supply one — the two sentence prompts fall back to English when the
       source language is unknown, so an Auto sentence used to be analysed as
       if it were English and filed under a language that does not exist. */
    if (entry.kind === 'sentence') {
      detectSentenceLanguage(entry, settings).then(function () {
        if (isAborted(null) || !current(generation)) return;
        entry.overview = { status: 'ok', language: entry.language, quick_meaning: '' };
        entry.outputLang = effectiveOutputLang(entry);
        state.overviewState = 'ready';
        noteSave(entry);
        adoptResolvedId(entry);
        renderScreen();
        runLines(entry);
      }).catch(function (err) {
        if (isAborted(err) || !current(generation)) return;
        state.overviewState = 'error';
        state.overviewError = err;
        renderScreen();
      });
      return;
    }

    /* A file's language is chosen by the reader, never guessed, so there is no
       overview to ask for and nothing to detect: the pipeline starts here. */
    if (entry.kind === 'document') {
      entry.overview = { status: 'ok', language: entry.language, reading: '', quick_meaning: '' };
      entry.outputLang = effectiveOutputLang(entry);
      state.overviewState = 'ready';
      noteSave(entry);
      adoptResolvedId(entry);
      renderScreen();
      runLines(entry);
      return;
    }

    settleOverview(entry, settings, generation, false);
  }

  /* One overview, then the decision of where the entry belongs. Split out so
     the "the explanation language moved" retry can run the same path again. */
  function settleOverview(entry, settings, generation, redone) {
    askOverview(entry, settings, 0).then(function (overview) {
      var named = overview && typeof overview === 'object' ? overview : {};
      entry.overview = named;
      entry.status = named.status === 'not_found' ? 'not_found' : 'ok';
      entry.word = named.word || entry.word;
      /* Never store the picker's word "auto" as if it were a language. */
      entry.language = resolveLanguage(named.language, entry);

      /* Auto guessed "headword" and the model disagreed. Rather than showing a
         dead end, hand the same text to sentence analysis — that is the whole
         point of a guess that costs nothing. */
      if (entry.status === 'not_found' && entry.autoMode && current(generation)) {
        var lang = entry.sourceLangArg && entry.sourceLangArg !== CONFIG.autoLang
          ? entry.sourceLangArg : null;
        ns.views.dictionary.openSentence(entry.input || entry.word, lang);
        return;
      }

      entry.ts = Date.now();
      noteSave(entry);
      /* The source language decides the explanation language, and with the
         picker on Auto it was unknown when this overview went out. If the
         answer moved it, this gloss is in the wrong language: ask once more. */
      var moved = adoptResolvedId(entry);
      if (moved && !redone && entry.status !== 'not_found') {
        if (!current(generation)) return;
        return settleOverview(entry, settings, generation, true);
      }
      if (!current(generation)) return;
      state.overviewState = entry.status === 'not_found' ? 'not_found' : 'ready';
      renderScreen();
      if (entry.status !== 'not_found') runLines(entry);
    }).catch(function (err) {
      if (isAborted(err) || !current(generation)) return;
      state.overviewState = 'error';
      state.overviewError = err;
      renderScreen();
    });
  }

  /* The language a stored entry should carry: whatever the answer named, else
     the language the lookup was pinned to. '' when neither knows. */
  function resolveLanguage(named, entry) {
    var language = CONFIG.languageByAnyName(named);
    if (language) return language;
    if (entry.sourceLangArg && entry.sourceLangArg !== CONFIG.autoLang) return entry.sourceLangArg;
    return '';
  }

  /* Saving can fail outright when the browser's quota is full. The screen has
     to say so: an answer the user cannot keep, presented as if it were kept,
     is worse than an error. */
  function noteSave(entry) {
    var saved = store.saveEntry(entry);
    if (!saved) state.storageError = true;
    if (saved && ns.roots && (entry.kind || 'word') === 'word') ns.roots.indexEntry(saved);
    return saved;
  }

  function storageNotice() {
    return '<div class="notice notice-warn" style="margin-top:16px">' + ui.icon('alert') + '<div>' +
      '<div class="notice-title">' + ui.esc(ui.t('entry.storageTitle')) + '</div>' +
      '<div class="notice-body">' + ui.esc(ui.t('entry.storageText')) + '</div>' +
      '</div></div>';
  }

  /* The id a lookup started with was built from the query argument; now that
     the language is known the entry belongs under its real key. Moving it is
     what makes "the same word on Auto and pinned" one entry instead of two —
     one row in history, one charge.

     It also settles the explanation language, which follows the source
     language through the user's table. Returns true when that moved, because
     the overview already fetched was then written in the wrong language. */
  function adoptResolvedId(entry) {
    var before = entry.outputLang;
    entry.outputLang = effectiveOutputLang(entry);
    var final = entry.kind === 'sentence'
      ? store.sentenceId(entry.text || entry.word, entry.language, entry.model, entry.outputLang)
      : entry.kind === 'document'
        ? store.documentId(entry.name || entry.word, entry.text || '', entry.language, entry.model, entry.outputLang)
        : store.entryId(entry.word, entry.language, entry.model, entry.outputLang);
    if (!final || final === entry.id) return before !== entry.outputLang;
    var previous = entry.id;
    entry.id = final;
    state.id = final;
    noteSave(entry);
    store.removeEntry(previous);
    var hash = '#/word/' + encodeURIComponent(final);
    if (location.hash !== hash) location.replace(hash);
    return before !== entry.outputLang;
  }

  /* An overview that does not name a language is not usable: the four deep
     prompts would silently answer as if the word were English, and the row
     would have no language to be grouped or practised under. One retry is worth
     a request; a second failure is reported rather than saved. */
  function askOverview(entry, settings, attempt) {
    return api.overview({
      apiKey: settings.apiKey, model: settings.model,
      sourceLang: entry.language, outputLang: effectiveOutputLang(entry),
      input: entry.input || entry.word, signal: requestSignal()
    }).then(function (overview) {
      var named = overview && typeof overview === 'object' ? overview : {};
      if (named.status === 'not_found') return named;
      if (resolveLanguage(named.language, entry)) return named;
      if (attempt === 0) return askOverview(entry, settings, 1);
      throw new api.ApiError('language', 'The answer did not say which language "' +
        (entry.input || entry.word) + '" is in.');
    });
  }

  function detectSentenceLanguage(entry, settings) {
    var pinned = entry.sourceLangArg && entry.sourceLangArg !== CONFIG.autoLang
      ? entry.sourceLangArg : '';
    if (pinned) { entry.language = pinned; return Promise.resolve(pinned); }
    if (entry.language && entry.language !== CONFIG.autoLang) return Promise.resolve(entry.language);
    return api.detectLanguage({
      apiKey: settings.apiKey, model: settings.model, input: entry.text || entry.word,
      signal: requestSignal()
    }).then(function (result) {
      if (!result.language) {
        throw new api.ApiError('language',
          'The answer did not say which language this sentence is in.');
      }
      entry.language = result.language;
      return result.language;
    });
  }

  function runLines(entry) {
    var generation = state.generation;
    var settings = settingsSnapshot();
    lines().forEach(function (line) {
      state.lineState[line] = 'loading';
      state.lineError[line] = null;
    });
    renderScreen();

    var onLine = function (result) {
      if (result.ok) {
        if (!entry.lines) entry.lines = {};
        entry.lines[result.line] = result.data;
        /* The payload belongs to this entry wherever the user has wandered
           off to, so it is saved either way — that is the request they paid
           for. */
        noteSave(entry);
      }
      /* The shared state belongs to whatever entry is on screen now. */
      if (!current(generation)) return;
      if (result.ok) {
        state.lineState[result.line] = 'ready';
      } else if (isAborted(result.error)) {
        /* Cancelled, not failed: leave it looking ung generated so it offers
           the Generate button instead of an error the user did not cause. */
        state.lineState[result.line] = 'idle';
      } else {
        state.lineState[result.line] = 'error';
        state.lineError[result.line] = result.error;
      }
      renderScreen();
    };

    if (state.kind === 'sentence') {
      return api.sentenceLines({
        apiKey: settings.apiKey, model: settings.model,
        sourceLang: entry.language, outputLang: effectiveOutputLang(entry),
        input: entry.text, signal: requestSignal()
      }, onLine);
    }
    if (state.kind === 'document') return runDocument(entry, nextMissingPart(entry));
    return api.deepLines({
      apiKey: settings.apiKey, model: settings.model,
      sourceLang: entry.language, outputLang: effectiveOutputLang(entry),
      overview: entry.overview, signal: requestSignal()
    }, onLine);
  }

  function runSingleLine(entry, line) {
    /* A document has no single lines to re-ask for: its four cards come out of
       one pipeline, so "retry" means "carry on from the first part that is
       missing", never "ask for one field again". */
    if (state.kind === 'document') return runDocument(entry, nextMissingPart(entry));
    var generation = state.generation;
    var settings = settingsSnapshot();
    state.lineState[line] = 'loading';
    state.lineError[line] = null;
    renderScreen();

    var request = state.kind === 'sentence'
      ? api.sentenceLine({
        apiKey: settings.apiKey, model: settings.model, sourceLang: entry.language,
        outputLang: effectiveOutputLang(entry), input: entry.text, line: line, signal: requestSignal()
      })
      : api.deepLine({
        apiKey: settings.apiKey, model: settings.model, sourceLang: entry.language,
        outputLang: effectiveOutputLang(entry), overview: entry.overview, line: line, signal: requestSignal()
      });

    return request.then(function (data) {
      if (!entry.lines) entry.lines = {};
      entry.lines[line] = data;
      noteSave(entry);
      if (!current(generation)) return;
      state.lineState[line] = 'ready';
      renderScreen();
    }).catch(function (err) {
      if (isAborted(err) || !current(generation)) return;
      state.lineState[line] = 'error';
      state.lineError[line] = err;
      renderScreen();
    });
  }

  function retryLine(line) {
    if (!state.entry) return Promise.resolve();
    return runSingleLine(state.entry, line);
  }

  /* ---------- Documents ----------
     A file is read part by part, in order, and the parts are kept: stopping
     half way through a long document and losing it would be worse than waiting.
     Every part is one request, so the cost of a failure is one part. */

  function documentPlan(entry) {
    return ns.extract.planChunks(String(entry.text || ''), CONFIG.limits.document);
  }

  function documentParts(entry) {
    var list = Array.isArray(entry.parts) ? entry.parts.filter(Boolean) : [];
    return list.slice().sort(function (a, b) { return (a.index || 0) - (b.index || 0); });
  }

  /* The first part whose answer is missing, or 1. */
  function nextMissingPart(entry) {
    var have = {};
    documentParts(entry).forEach(function (part) { have[part.index] = true; });
    var plan = documentPlan(entry);
    for (var i = 0; i < plan.length; i += 1) {
      if (!have[plan[i].index]) return plan[i].index;
    }
    return plan.length + 1;
  }

  /* What the four cards read. Translation is joined in order, the glossary is
     concatenated and de-duplicated, the outline is the merged answer when there
     is one, and the register comes from the merge or from the last part. */
  function documentData(entry) {
    var parts = documentParts(entry);
    var translation = parts.map(function (part) {
      return part.data && part.data.translation ? String(part.data.translation) : '';
    }).filter(Boolean).join('\n\n');

    var summary = entry && entry.merged && Array.isArray(entry.merged.summary) && entry.merged.summary.length
      ? entry.merged.summary.slice()
      : parts.reduce(function (all, part) {
        return all.concat(part.data && Array.isArray(part.data.summary) ? part.data.summary : []);
      }, []);

    var seen = {};
    var vocabulary = [];
    parts.forEach(function (part) {
      var items = part.data && Array.isArray(part.data.vocabulary) ? part.data.vocabulary : [];
      items.forEach(function (item) {
        if (!item) return;
        var key = String(item.term || '').toLowerCase() + '|' + String(item.meaning || '').toLowerCase();
        if (!item.term || seen[key]) return;
        seen[key] = true;
        vocabulary.push(item);
      });
    });

    var register = (entry && entry.merged && entry.merged.register) ||
      (parts.length && parts[parts.length - 1].data ? parts[parts.length - 1].data.register : null) || {};

    return {
      summary: summary,
      translation: translation,
      vocabulary: vocabulary.slice(0, 200),
      register: register,
      parts: parts.length,
      total: state.doc ? state.doc.total : parts.length
    };
  }

  function runDocument(entry, resumeFrom) {
    var generation = state.generation;
    var settings = settingsSnapshot();
    var plan = documentPlan(entry);
    var total = plan.length;

    if (!total) {
      state.lineState.document = 'error';
      state.lineError.document = api.toErrorShape(
        new api.ApiError('server', ui.t('file.empty')));
      ns.router.refresh();
      return Promise.resolve();
    }
    if (!Array.isArray(entry.parts)) entry.parts = [];
    entry.total = total;

    var have = {};
    documentParts(entry).forEach(function (part) { have[part.index] = true; });
    var start = Math.max(1, resumeFrom || 1);
    state.doc = { index: Math.min(start, total), total: total, state: 'running' };
    state.lineState.document = 'loading';
    state.lineError.document = null;
    ns.router.refresh();

    function save() {
      entry.lines = { document: documentData(entry) };
      noteSave(entry);
    }

    function step(index) {
      if (index > total) return merge();
      while (index <= total && have[index]) index += 1;
      if (index > total) return merge();
      state.doc = { index: index, total: total, state: 'running' };
      ns.router.refresh();
      var part = plan[index - 1];
      return api.documentLine({
        apiKey: settings.apiKey,
        model: settings.model,
        sourceLang: entry.language,
        outputLang: effectiveOutputLang(entry),
        part: { index: part.index, total: part.total },
        text: part.text,
        signal: requestSignal()
      }).then(function (data) {
        /* The answer is saved wherever the reader has wandered off to — it is
           what they paid for — but only the screen that is still theirs gets
           repainted. */
        entry.parts[index - 1] = { index: index, data: data };
        save();
        if (!current(generation)) return null;
        return step(index + 1);
      });
    }

    /* One extra request folds the per-part bullets into a single outline. It is
       an improvement, not a requirement: if it fails, the per-part bullets are
       what the Summary card shows. */
    function merge() {
      if (total < 2) return finish();
      state.doc = { index: total, total: total, state: 'merging' };
      ns.router.refresh();
      var parts = documentParts(entry);
      var bullets = parts.reduce(function (all, part) {
        return all.concat(part.data && Array.isArray(part.data.summary) ? part.data.summary : []);
      }, []).slice(0, 40);
      var register = parts.length && parts[parts.length - 1].data ? parts[parts.length - 1].data.register : {};
      return api.documentMerge({
        apiKey: settings.apiKey,
        model: settings.model,
        sourceLang: entry.language,
        outputLang: effectiveOutputLang(entry),
        summary: bullets,
        register: register,
        signal: requestSignal()
      }).then(function (merged) {
        entry.merged = merged;
        save();
      }).catch(function () { /* keep the per-part bullets */ }).then(function () {
        /* The merge is the last request of the run, so the run ends here. */
        return finish();
      });
    }

    function finish() {
      if (!current(generation)) return;
      var data = documentData(entry);
      entry.lines = { document: data };
      entry.overview = {
        status: 'ok',
        language: entry.language,
        reading: '',
        quick_meaning: data.summary.length ? String(data.summary[0]).slice(0, 120) : ''
      };
      state.doc = { index: total, total: total, state: 'done' };
      state.lineState.document = 'ready';
      noteSave(entry);
      ns.router.refresh();
    }

    function stopped(index, error) {
      if (!current(generation)) return;
      var kept = documentParts(entry).length;
      if (error) state.lineError.document = api.toErrorShape(error);
      state.doc = { index: index, total: total, state: 'partial' };
      /* Anything at all is worth showing; nothing at all is an error. */
      state.lineState.document = kept ? 'ready' : 'error';
      if (!kept) state.lineError.document = state.lineError.document || api.toErrorShape(error);
      ns.router.refresh();
    }

    return step(start).then(function () {
      /* step() falls through to merge() and finish(), which manage their own
         state; a cancelled run must not overwrite it. */
      return null;
    }).catch(function (err) {
      if (isAborted(err)) { stopped(start, null); return; }
      stopped(state.doc ? state.doc.index : start, err);
    });
  }

  /* The reader asked to stop. The parts already paid for stay on the page. */
  function cancelDocument() {
    if (!state.entry || state.kind !== 'document') return;
    abortInFlight();
    var keep = documentParts(state.entry).length;
    state.doc = {
      index: keep,
      total: state.doc ? state.doc.total : keep,
      state: 'partial'
    };
    state.lineState.document = keep ? 'ready' : 'idle';
    ui.toast(ui.t('doc.cancelled'));
    ns.router.refresh();
  }

  /* Leaving the screen entirely (not just switching to another entry): stop
     paying for answers nobody will read, and invalidate anything that already
     came back and is still sitting in a microtask queue. */
  function leave() {
    state.generation += 1;
    abortInFlight();
  }

  /* ---------- Explanation language ---------- */

  /* Re-runs the whole lookup exactly as it was originally asked — same input,
     same language argument — under whatever `outputLang` now holds. Because the
     entry id contains the explanation language this lands as a separate history
     row, which is what makes switching back free. */
  function requery(entry) {
    if (!entry) return;
    var arg = entry.sourceLangArg || entry.language;
    var input = entry.input || entry.word;
    ns.session.pending = null;
    if (entry.kind === 'document') {
      ns.views.dictionary.openDocument(entry.name || entry.word, entry.text || '', arg, entry.outputLang);
      return;
    }
    if (entry.kind === 'sentence') ns.views.dictionary.openSentence(entry.text || input, arg);
    else ns.views.dictionary.openWord(input, arg);
  }

  /* Switching the explanation language here is a statement about this entry
     only: "I want to read this one in English". The default per language lives
     in Profile, so nothing global is written. */
  function switchOutputLang(next) {
    var entry = state.entry;
    if (!entry || !next || next === effectiveOutputLang(entry)) return;
    var arg = entry.sourceLangArg || entry.language;
    var input = entry.input || entry.word;
    ns.session.pending = null;
    ui.toast(ui.t('entry.regenerating', { lang: ui.langName(next) }));
    if (entry.kind === 'document') {
      ns.views.dictionary.openDocument(entry.name || entry.word, entry.text || '', arg, next);
      return;
    }
    if (entry.kind === 'sentence') {
      ns.views.dictionary.openSentence(entry.text || input, arg, next);
    } else {
      ns.views.dictionary.openWord(input, arg, false, next);
    }
  }

  /* ---------- Screen ---------- */

  /* Everything inside the card region, wired separately so the region can be
     repainted on its own without touching the header or the shell. */
  function wireRegion(root, entry) {
    root.querySelectorAll('[data-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var key = button.getAttribute('data-toggle');
        var map = collapsedMap();
        if (map[key]) delete map[key]; else map[key] = true;
        ns.router.refresh();
      });
    });

    var collapseAll = root.querySelector('[data-collapse-toggle]');
    if (collapseAll) {
      collapseAll.addEventListener('click', function () {
        var map = collapsedMap();
        if (allCollapsed()) orderedCards().forEach(function (c) { delete map[c.key]; });
        else orderedCards().forEach(function (c) { map[c.key] = true; });
        ns.router.refresh();
      });
    }

    root.querySelectorAll('[data-forms]').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = button.getAttribute('data-forms');
        var map = formsMap();
        if (map[id]) delete map[id]; else map[id] = true;
        ns.router.refresh();
      });
    });

    root.querySelectorAll('[data-forms-all]').forEach(function (button) {
      button.addEventListener('click', function () {
        var ids = String(button.getAttribute('data-forms-ids') || '').split(' ').filter(Boolean);
        var map = formsMap();
        var openEverywhere = ids.length && ids.every(function (id) { return map[id]; });
        ids.forEach(function (id) {
          if (openEverywhere) delete map[id]; else map[id] = true;
        });
        ns.router.refresh();
      });
    });

    root.querySelectorAll('[data-retry-line]').forEach(function (button) {
      button.addEventListener('click', function () {
        ns.views.word.retryLine(button.getAttribute('data-retry-line'));
      });
    });
  }

  function renderScreen() {
    if (state.id !== currentRouteId()) return;
    /* Only the cards change while an answer is arriving, so only the cards are
       rebuilt. A full refresh would also close the sheet, drop the caret and
       rebuild the header. */
    var region = document.getElementById('deep-region');
    /* A document repaints whole: its header carries the part counter and the
       Stop button, and those live outside the card region. */
    if (region && state.entry && state.overviewState === 'ready' && state.kind !== 'document') {
      region.innerHTML = deepRegion();
      wireRegion(region, state.entry);
      return;
    }
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
        state.kind = pending.kind || 'word';
        state.entry = {
          id: id,
          kind: state.kind,
          input: pending.input,
          text: pending.text || pending.input,
          word: pending.label || pending.input,
          /* Documents carry the file name as their identity and the whole text
             as their payload. */
          name: pending.name || pending.input,
          language: pending.language || settings.queryLang,
          /* The argument the lookup was started with, 'auto' included. Kept so
             a later re-query in another explanation language hits the same
             cache key the original would have produced. */
          sourceLangArg: pending.language || settings.queryLang,
          status: 'ok',
          /* Set when the type picker was on Auto, so a not_found can be handed
             to sentence analysis instead of dead-ending. */
          autoMode: !!pending.autoMode,
          schema: CONFIG.schemaVersion,
          model: settings.model,
          /* The language this answer is written in. Set by the opener from the
             per-language table, unless the toolbar pinned one for this entry. */
          outputLang: pending.outputLang || store.outputLangFor(pending.language || settings.queryLang),
          outputLangFixed: !!pending.outputLangFixed,
          ts: Date.now()
        };
        if (state.kind === 'sentence') state.overviewState = 'loading';
        else state.overviewState = 'loading';
        renderScreen();
        runOverview(state.entry);
        return;
      }

      if (!cached) {
        ui.setHTML(container, missingScreen() + disclaimer());
        wire(container, null);
        return;
      }

      state.kind = cached.kind || 'word';
      state.entry = cached;
      if (state.kind === 'word' && ns.roots) ns.roots.indexEntry(cached);
      state.overviewState = cached.status === 'not_found' ? 'not_found' : 'ready';
      lines().forEach(function (line) {
        state.lineState[line] = cached.lines && cached.lines[line] ? 'ready' : 'idle';
      });
    }

    var entry = state.entry;
    if (!entry) {
      ui.setHTML(container, missingScreen() + disclaimer());
      wire(container, null);
      return;
    }

    var html = '';
    if (state.kind === 'sentence') {
      html += '<section class="card sentence-head">' +
        '<div class="sentence-text">' + ui.esc(entry.text || '') + '</div>' +
        '<div class="word-meta"><span class="badge-lang">' + ui.esc((entry.language || '').toUpperCase()) + '</span>' +
        '<span class="chip">' + ui.esc(ui.t('mode.sentence')) + '</span></div></section>';
    } else if (state.kind === 'document') {
      html += ns.views.document.head(entry, state.doc);
    } else if (state.overviewState === 'loading' && !entry.overview) {
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
    } else if (state.kind === 'sentence' || entry.overview) {
    if (state.storageError) html += storageNotice();
      /* The cards live in their own container so a line landing can repaint
         just them: rebuilding the whole screen closed the explanation-language
         sheet, threw the caret away and rebuilt the header for nothing. */
      html += '<div style="height:16px"></div><div id="deep-region">' + deepRegion() + '</div>';
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
        var tag = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', es: 'es-ES', ja: 'ja-JP', zh: 'zh-CN' };
        ns.speech.speak(speakBtn.getAttribute('data-speak'),
          tag[speakBtn.getAttribute('data-speak-lang')] || 'en-US');
      });
    }

    var practiceBtn = container.querySelector('[data-practice-entry]');
    if (practiceBtn && !practiceBtn.disabled) {
      practiceBtn.addEventListener('click', function () {
        var item = practiceItemFor(entry);
        if (item) ns.practice.open(item);
      });
    }

    var starBtn = container.querySelector('[data-star-entry]');
    if (starBtn) {
      var paintStar = function (on) {
        starBtn.classList.toggle('is-starred', on);
        starBtn.innerHTML = on ? ui.iconFilled('star') : ui.icon('star');
      };
      starBtn.addEventListener('click', function () {
        var starred = store.toggleStar(entry.id);
        paintStar(starred);
        ui.toast(ui.t(starred ? 'entry.addedStarred' : 'entry.removedStarred'), {
          ms: 6000,
          action: {
            label: ui.t('common.undo'),
            onClick: function () {
              paintStar(store.toggleStar(entry.id));
            }
          }
        });
      });
    }

    var refreshBtn = container.querySelector('[data-refresh-entry]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        if (entry.kind === 'document') {
          /* Re-reading a file means asking for its parts again, not for one
             field: keep what is there and refill the gaps. */
          entry.parts = [];
          entry.merged = null;
          state.doc = null;
          runDocument(entry, 1);
          return;
        }
        /* Regenerating under a different explanation language than the entry
           was made in would leave a cache key that lies about its contents, so
           that case goes through the language switch instead. */
        if (entry.outputLang && entry.outputLang !== store.getSettings().outputLang) {
          requery(entry);
          return;
        }
        entry.lines = {};
        lines().forEach(function (line) { state.lineState[line] = 'idle'; });
        runOverview(entry);
      });
    }

    var deleteBtn = container.querySelector('[data-delete-entry]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        /* An undo instead of a confirmation: deleting a word you just looked up
           is common and cheap to reverse, and a modal for it is friction. */
        var snapshot = store.snapshotEntry(entry.id);
        store.removeEntry(entry.id);
        ui.toast(ui.t('entry.deleted'), {
          ms: 8000,
          action: {
            label: ui.t('common.undo'),
            onClick: function () {
              if (store.restoreEntry(snapshot)) {
                ui.toast(ui.t('entry.restored'));
                location.hash = '#/word/' + encodeURIComponent(entry.id);
                ns.router.refresh();
              }
            }
          }
        });
        location.hash = '#/dictionary';
      });
    }

    container.querySelectorAll('[data-root-link]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        location.hash = '#/root/' + encodeURIComponent(button.getAttribute('data-root-link'));
      });
    });

    wireRegion(container, entry);

    var retryOverview = container.querySelector('[data-retry-overview]');
    if (retryOverview) retryOverview.addEventListener('click', function () { runOverview(entry); });

    container.querySelectorAll('[data-suggestion]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var word = chip.getAttribute('data-suggestion');
        ns.session.query = word;
        ns.views.dictionary.openWord(word);
      });
    });

    var stopDoc = container.querySelector('[data-doc-cancel]');
    if (stopDoc) stopDoc.addEventListener('click', function () { cancelDocument(); });

    var resumeDoc = container.querySelector('[data-doc-resume]');
    if (resumeDoc) {
      resumeDoc.addEventListener('click', function () {
        runDocument(entry, nextMissingPart(entry));
      });
    }

    var goProfile = container.querySelector('[data-go-profile]');
    if (goProfile) goProfile.addEventListener('click', function () { location.hash = '#/profile'; });
  }

  ns.views.word = {
    cards: ns.CONFIG.cardCatalog,
    cardKeys: function () { return orderedCards().map(function (c) { return c.key; }); },
    /* Exposed so a card added to the config without a renderer fails the test
       suite instead of silently never appearing. */
    builderKeys: builderKeys,
    retryLine: retryLine,
    switchOutputLang: switchOutputLang,
    /* Exposed for the tests: the document pipeline is the one piece of this
       screen that a stub DOM cannot drive through a click. */
    runDocument: runDocument,
    cancelDocument: cancelDocument,
    documentData: documentData,
    documentPlan: documentPlan,
    nextMissingPart: nextMissingPart,
    /* Exposed so the practice prompt's data (pos, meaning, model, output
       language) is checked at the source rather than through a stub DOM. */
    practiceItemFor: practiceItemFor,
    /* Called by the shell when this screen is left entirely. */
    leave: leave,
    topbar: function (params) {
      var title = state.entry && state.id === params.id
        ? (state.kind === 'sentence' ? ui.t('mode.sentence') : (state.entry.word || ui.t('nav.dictionary')))
        : ui.t('nav.dictionary');
      return { back: true, title: title, sub: '' };
    },
    render: render,
    reset: reset
  };
})(window.LINGUIST);
