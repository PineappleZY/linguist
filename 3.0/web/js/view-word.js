/* RADICLE — Entry screen.

   Card order and card metadata come from CONFIG; this file only knows how to
   turn one field of the model's response into markup. A card whose field is
   empty is not rendered at all, which is how five languages with different
   card sets share one layout. */

window.RADICLE = window.RADICLE || {};
window.RADICLE.views = window.RADICLE.views || {};

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
    lineError: {}
  };

  var revealed = {};

  function lines() { return state.kind === 'sentence' ? CONFIG.sentenceLines : CONFIG.deepLines; }
  function catalog() { return state.kind === 'sentence' ? CONFIG.sentenceCatalog : CONFIG.cardCatalog; }
  function order() { return state.kind === 'sentence' ? CONFIG.sentenceCardOrder : CONFIG.cardOrder; }

  function reset(newId) {
    state.id = newId;
    state.entry = null;
    state.overviewState = 'idle';
    state.overviewError = null;
    state.lineState = {};
    state.lineError = {};
    revealed = {};
    CONFIG.deepLines.concat(CONFIG.sentenceLines).forEach(function (line) {
      state.lineState[line] = 'idle';
      state.lineError[line] = null;
    });
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
      var card = catalog()[key];
      if (card && !seen[key]) { seen[key] = true; list.push(card); }
    });
    Object.keys(catalog()).forEach(function (key) {
      if (!seen[key]) { seen[key] = true; list.push(catalog()[key]); }
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
    var clean = list.filter(function (pair) { return pair && pair[1]; });
    if (!clean.length) return '';
    return '<div class="fact-grid">' + clean.map(function (pair) {
      return '<div class="fact"><span class="fact-key">' + ui.esc(pair[0]) + '</span>' +
        '<span class="fact-value">' + ui.esc(pair[1]) + '</span></div>';
    }).join('') + '</div>';
  }

  function paragraph(text) {
    return text ? '<p>' + ui.esc(text) + '</p>' : '';
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
        '<th>Word</th><th>Meaning</th><th>Note</th></tr></thead><tbody>' +
        table.map(function (row) {
          return '<tr><td class="ct-word">' + ui.esc(row.word || '') + '</td>' +
            '<td>' + ui.esc(row.meaning || '') + '</td>' +
            '<td class="ct-note">' + ui.esc(row.note || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    if (parallels.length) {
      html += subLabel('Same idea, different word');
      html += '<ul class="parallel-list">' + parallels.map(function (item) {
        return '<li><div class="example-text">' + ui.esc(item.sentence || '') + '</div>' +
          (item.note ? '<div class="def-desc">' + ui.esc(item.note) + '</div>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    if (pairs.length) {
      html += subLabel('Easily mixed');
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

  function bodyCore(line) {
    return line && line.core_metaphor ? '<p class="core-metaphor">' + ui.esc(line.core_metaphor) + '</p>' : '';
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
      if (path.primary) html += facts([['本义', path.primary]]);
      var extended = Array.isArray(path.extended) ? path.extended.filter(Boolean) : [];
      if (extended.length) {
        html += subLabel('Extended senses');
        html += rows(extended, function (item) {
          return {
            term: ui.esc(item.sense || ''),
            desc: item.from ? '← ' + ui.esc(item.from) : ''
          };
        });
      }
      if (path.figurative) html += facts([['比喻义', path.figurative]]);
    }
    return html;
  }

  function bodyThenAndNow(line) {
    var item = line && line.then_and_now;
    if (!item || typeof item !== 'object') return '';
    return facts([['古义', item.then], ['今义', item.now]]) + paragraph(item.note);
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
    if (ety.via) factList.push(['via', ety.via]);
    if (ety.first_attested) factList.push(['attested', ety.first_attested]);
    if (ety.certainty) factList.push(['certainty', ety.certainty]);
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
      return (i ? '<span class="morph-op">+</span>' : '') +
        '<span class="morph-part">' +
        '<b>' + ui.esc(item.part || '') + '</b>' +
        (item.meaning ? '<i>' + ui.esc(item.meaning) + '</i>' : '') +
        (item.kind ? '<em>' + ui.esc(item.kind) + '</em>' : '') +
        (item.note ? '<u>' + ui.esc(item.note) + '</u>' : '') +
        '</span>';
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
        return (i ? '<span class="morph-op">+</span>' : '') +
          '<span class="morph-part"><b>' + ui.esc(part.part || '') + '</b>' +
          (part.meaning ? '<i>' + ui.esc(part.meaning) + '</i>' : '') +
          (part.origin ? '<em>' + ui.esc(part.origin) + '</em>' : '') +
          (part.form_note ? '<u>' + ui.esc(part.form_note) + '</u>' : '') + '</span>';
      }).join('') + '</div>';
    }
    if (morph.composition) html += '<p class="morph-composition">' + ui.esc(morph.composition) + '</p>';
    if (variants.length) {
      html += subLabel('Root variants');
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
      html += subLabel('Direct derivatives');
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
      html += subLabel('Shared root');
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
    [['On readings', r.on], ['Kun readings', r.kun], ['Special', r.special]].forEach(function (group) {
      var items = Array.isArray(group[1]) ? group[1].filter(Boolean) : [];
      if (!items.length) return;
      html += subLabel(group[0]);
      html += rows(items, function (item) {
        return {
          term: '<span class="kana-lg">' + ui.esc(item.reading || '') + '</span>' +
            (item.romaji ? '<span class="chip">' + ui.esc(item.romaji) + '</span>' : '') +
            (item.okurigana ? '<span class="chip">送り仮名 ' + ui.esc(item.okurigana) + '</span>' : ''),
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
    return facts([['Stratum', labels[value] || value]]);
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

  /* French verbs and Japanese verbs return different shapes; both land here. */
  function bodyConjugation(line) {
    var c = line && (line.conjugation || line.conjugaison);
    if (!c || typeof c !== 'object') return '';
    var html = '';
    if (c.class) {
      html += facts([['Class', c.class], ['Stem', c.stem]]);
      var forms = Array.isArray(c.forms) ? c.forms.filter(Boolean) : [];
      if (forms.length) {
        html += rows(forms, function (item) {
          return { term: ui.esc(item.name || ''), desc: '<span class="mono">' + ui.esc(item.form || '') + '</span>' };
        });
      }
    } else {
      html += facts([['Auxiliary', c.auxiliary], ['Participle', c.participle]]);
      var tenses = Array.isArray(c.tenses) ? c.tenses.filter(Boolean) : [];
      tenses.forEach(function (tense) {
        var list = Array.isArray(tense.forms) ? tense.forms.filter(Boolean) : [];
        if (!list.length) return;
        html += subLabel(tense.tense || '');
        html += '<ul class="variant-list">' + list.map(function (form) {
          return '<li><span class="mono">' + ui.esc(form) + '</span></li>';
        }).join('') + '</ul>';
      });
    }
    if (c.note) html += paragraph(c.note);
    return html;
  }

  function bodyPrincipalParts(line) {
    var s = line && line.principal_parts;
    if (!s || typeof s !== 'object') return '';
    var html = '<div class="verb-forms">' + ['infinitive', 'praeteritum', 'partizipII'].map(function (key) {
      return s[key] ? '<span class="verb-form">' + ui.esc(s[key]) + '</span>' : '';
    }).join('<span class="verb-arrow">→</span>') + '</div>';
    html += facts([['Auxiliary', s.auxiliary], ['Vowel change', s.vowel_change]]);
    if (s.note) html += paragraph(s.note);
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

  function bodyArticlePlural(line) {
    var a = line && line.article_plural;
    if (!a || typeof a !== 'object') return '';
    return facts([['Article', a.article], ['Plural', a.plural], ['Genitive', a.genitive]]) + paragraph(a.note);
  }

  function bodyGenderNumber(line) {
    var g = line && line.gender_number;
    if (!g || typeof g !== 'object') return '';
    return facts([['Gender', g.gender], ['Plural', g.plural]]) + paragraph(g.note);
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
    return facts([['From', s.origin_language], ['Original', s.original], ['Litterally', s.literal]]) +
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
    var html = facts([['Source', o.source], ['Author', o.author]]);
    if (o.quote) html += '<blockquote class="classic-quote">' + ui.esc(o.quote) + '</blockquote>';
    if (o.meaning) html += facts([['Then', o.meaning]]);
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
      (line.register ? facts([['Register', line.register]]) : '');
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
    if (p.gloss) html += facts([['Means', p.gloss]]);
    var subs = Array.isArray(p.substitutions) ? p.substitutions.filter(Boolean) : [];
    if (subs.length) {
      html += subLabel('Slots');
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
    conjugation: bodyConjugation, stammformen: bodyPrincipalParts, kasusRektion: bodyCaseGovernment,
    trennbarePraefixe: bodySeparablePrefixes, artikelPlural: bodyArticlePlural, genreNombre: bodyGenderNumber,
    classicalVsModern: bodyClassicalVsModern, classicalUsage: bodyClassicalUsage,
    doublets: bodyDoublets, lautverschiebung: bodySoundShift, sourceWord: bodySourceWord,
    spellingVariants: bodySpellingVariants, originAllusion: bodyOriginAllusion,
    pronunciation: bodyPronunciation, culture: bodyCulture, synthesis: bodySynthesis, mnemonic: bodyMnemonic,
    translation: bodyTranslation, wordByWord: bodyWordByWord, chunks: bodyChunks,
    structure: bodyStructure, grammar: bodyGrammar, register: bodyRegister,
    pitfalls: bodyPitfalls, pattern: bodyPattern
  };

  /* ---------- Card shell ---------- */

  function cardTitle(card) {
    return card.note ? card.title + ' · ' + card.note : card.title;
  }

  function cardShell(card, body) {
    if (!body) return '';
    var collapsed = isCollapsed(card.key);
    var isNew = !revealed[card.key];
    if (isNew) revealed[card.key] = true;
    return '<section class="card deep-card' + (collapsed ? ' is-collapsed' : '') +
      (isNew ? ' reveal' : '') + '" data-card="' + ui.esc(card.key) + '">' +
      '<button type="button" class="card-head card-toggle" data-toggle="' + ui.esc(card.key) + '" ' +
      'aria-expanded="' + (collapsed ? 'false' : 'true') + '">' +
      ui.icon(card.icon) +
      '<span class="card-title">' + ui.esc(cardTitle(card)) + '</span>' +
      '<span class="card-chevron">' + ui.icon('chevron') + '</span></button>' +
      '<div class="card-body">' + body + '</div></section>';
  }

  function cardSkeleton(card) {
    return '<section class="card deep-card is-loading" data-loading="' + ui.esc(card.key) + '">' +
      '<div class="card-head">' + ui.icon(card.icon) +
      '<span class="card-title">' + ui.esc(cardTitle(card)) + '</span></div>' +
      '<div class="card-body">' +
      '<div class="skeleton sk-line sk-w-90" style="margin-top:0"></div>' +
      '<div class="skeleton sk-line sk-w-70"></div></div></section>';
  }

  function lineLabel(line) {
    if (line === 'etymology') return 'Word root';
    if (line === 'usage') return 'Meaning and use';
    if (line === 'distinction') return 'Disambiguation';
    if (line === 'semantics') return 'Meaning';
    return 'Grammar and structure';
  }

  function lineNotice(card) {
    var line = card.line;
    if ((state.lineState[line] || 'idle') === 'error') {
      return '<section class="card deep-card" data-line-notice="' + ui.esc(line) + '">' +
        ns.views.dictionary.errorNotice(state.lineError[line], {
          retryAttr: 'data-retry-line="' + ui.esc(line) + '"',
          rawText: state.lineError[line] && state.lineError[line].extra ? state.lineError[line].extra.raw : ''
        }) + '</section>';
    }
    return '<section class="card deep-card" data-line-notice="' + ui.esc(line) + '">' +
      '<div class="notice notice-warn">' + ui.icon('info') + '<div>' +
      '<div class="notice-title">' + ui.esc(lineLabel(line)) + ' not generated yet</div>' +
      '<div class="notice-body">This entry was saved before that section finished.</div>' +
      '<div class="notice-actions"><button type="button" class="btn" data-retry-line="' + ui.esc(line) + '">' +
      ui.icon('refresh') + 'Generate</button></div></div></div></section>';
  }

  function deepRegion() {
    var cards = orderedCards();
    var html = '<div class="deep-toolbar">' +
      '<span class="tiny muted-3">' + cards.length + ' sections</span>' +
      '<span class="topbar-spacer"></span>' +
      '<button type="button" class="btn btn-sm" data-collapse-toggle="1">' +
      (allCollapsed() ? 'Expand all' : 'Collapse all') + '</button></div>';

    var anchors = {};
    cards.forEach(function (card) { if (!anchors[card.line]) anchors[card.line] = card.key; });
    var data = state.entry && state.entry.lines ? state.entry.lines : null;

    cards.forEach(function (card) {
      var status = state.lineState[card.line] || 'idle';
      if (status === 'ready') {
        var build = BODY_BUILDERS[card.key];
        if (build) html += cardShell(card, build(data ? data[card.line] : null));
        return;
      }
      if (status === 'loading') { html += cardSkeleton(card); return; }
      if (anchors[card.line] === card.key) html += lineNotice(card);
    });
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
    var meta = languageMeta(entry.language);
    if (!meta) return null;
    var overview = entry.overview || {};
    if (meta.needsReading && !overview.reading) return null;
    return {
      word: entry.word,
      reading: overview.reading || '',
      meaning: overview.quick_meaning || '',
      language: entry.language,
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
        'data-speak-lang="' + ui.esc(entry.language || 'en') + '" aria-label="Pronounce" title="Pronounce">' +
        ui.icon('speaker') + '</button>';
    }
    html += '<button type="button" class="icon-btn is-muted" data-practice-entry ' +
      (item ? '' : 'disabled ') + 'aria-label="Practise" title="' +
      (item ? 'Practise this word' : 'This entry has no reading to practise') + '">' + ui.icon('pencil') + '</button>';
    html += '<button type="button" class="icon-btn' + (starred ? ' is-starred' : '') + '" data-star-entry ' +
      'aria-label="Star" title="Star">' + (starred ? ui.iconFilled('star') : ui.icon('star')) + '</button>';
    html += '<button type="button" class="icon-btn is-muted" data-refresh-entry aria-label="Regenerate" title="Regenerate">' +
      ui.icon('refresh') + '</button>';
    html += '<button type="button" class="icon-btn is-muted" data-delete-entry aria-label="Delete" title="Delete">' +
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
      '<span class="card-title">No such headword</span></div><div class="card-body">' +
      '<p>“' + ui.esc(entry.word) + '” is not a current ' +
      ui.esc((languageMeta(entry.language) || { label: 'target' }).label) +
      ' word or fixed expression. Check the spelling, or switch the language.</p>';
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
      '<div class="empty-title">Entry not on this device</div>' +
      '<div class="empty-text">Radicle stores answers locally, so this link only works where the lookup happened.</div>' +
      '<div class="empty-actions"><button type="button" class="btn btn-primary" data-go-dictionary>Back to Dictionary</button></div>' +
      '</div></section>';
  }

  function disclaimer() {
    return '<p class="small muted-3" style="text-align:center;margin-top:20px">' +
      'AI-generated. Etymology is scholarly consensus, not gospel — double-check before quoting it.</p>';
  }

  /* ---------- Generation ---------- */

  function settingsSnapshot() {
    var s = store.getSettings();
    return { apiKey: s.apiKey, model: s.model, outputLang: s.outputLang };
  }

  function runOverview(entry) {
    var settings = settingsSnapshot();
    state.overviewState = 'loading';
    state.overviewError = null;
    renderScreen();

    var request = entry.kind === 'sentence'
      ? null
      : api.overview({
        apiKey: settings.apiKey, model: settings.model,
        sourceLang: entry.language, outputLang: settings.outputLang,
        input: entry.input || entry.word
      });

    /* A sentence needs no overview: the sentence itself is the input. */
    if (!request) {
      entry.overview = { status: 'ok', language: entry.language, quick_meaning: '' };
      state.overviewState = 'ready';
      store.saveEntry(entry);
      renderScreen();
      runLines(entry);
      return;
    }

    request.then(function (overview) {
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

  function runLines(entry) {
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
        state.lineState[result.line] = 'ready';
        store.saveEntry(entry);
      } else {
        state.lineState[result.line] = 'error';
        state.lineError[result.line] = result.error;
      }
      renderScreen();
    };

    if (state.kind === 'sentence') {
      return api.sentenceLines({
        apiKey: settings.apiKey, model: settings.model,
        sourceLang: entry.language, outputLang: settings.outputLang,
        input: entry.text
      }, onLine);
    }
    return api.deepLines({
      apiKey: settings.apiKey, model: settings.model,
      sourceLang: entry.language, outputLang: settings.outputLang,
      overview: entry.overview
    }, onLine);
  }

  function runSingleLine(entry, line) {
    var settings = settingsSnapshot();
    state.lineState[line] = 'loading';
    state.lineError[line] = null;
    renderScreen();

    var request = state.kind === 'sentence'
      ? api.sentenceLine({
        apiKey: settings.apiKey, model: settings.model, sourceLang: entry.language,
        outputLang: settings.outputLang, input: entry.text, line: line
      })
      : api.deepLine({
        apiKey: settings.apiKey, model: settings.model, sourceLang: entry.language,
        outputLang: settings.outputLang, overview: entry.overview, line: line
      });

    return request.then(function (data) {
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
        state.kind = pending.kind || 'word';
        state.entry = {
          id: id,
          kind: state.kind,
          input: pending.input,
          text: pending.text || pending.input,
          word: pending.label || pending.input,
          language: pending.language || settings.queryLang,
          status: 'ok',
          schema: CONFIG.schemaVersion,
          model: settings.model,
          outputLang: settings.outputLang,
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
        '<span class="chip">Sentence</span></div></section>';
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
        var tag = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', ja: 'ja-JP', zh: 'zh-CN' };
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
      starBtn.addEventListener('click', function () {
        var starred = store.toggleStar(entry.id);
        starBtn.classList.toggle('is-starred', starred);
        starBtn.innerHTML = starred ? ui.iconFilled('star') : ui.icon('star');
        ui.toast(starred ? 'Starred' : 'Removed from favorites');
      });
    }

    var refreshBtn = container.querySelector('[data-refresh-entry]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        entry.lines = {};
        lines().forEach(function (line) { state.lineState[line] = 'idle'; });
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
        if (map[key]) delete map[key]; else map[key] = true;
        ns.router.refresh();
      });
    });

    var collapseAll = container.querySelector('[data-collapse-toggle]');
    if (collapseAll) {
      collapseAll.addEventListener('click', function () {
        var map = collapsedMap();
        if (allCollapsed()) orderedCards().forEach(function (c) { delete map[c.key]; });
        else orderedCards().forEach(function (c) { map[c.key] = true; });
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
    cards: ns.CONFIG.cardCatalog,
    cardKeys: function () { return orderedCards().map(function (c) { return c.key; }); },
    retryLine: retryLine,
    topbar: function (params) {
      var title = state.entry && state.id === params.id
        ? (state.kind === 'sentence' ? 'Sentence' : (state.entry.word || 'Entry'))
        : 'Entry';
      return { back: true, title: title, sub: '' };
    },
    render: render,
    reset: reset
  };
})(window.RADICLE);
