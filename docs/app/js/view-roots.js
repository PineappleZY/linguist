/* LINGUIST — Roots tab and root detail. */

window.LINGUIST = window.LINGUIST || {};
window.LINGUIST.views = window.LINGUIST.views || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var roots = ns.roots;

  function dueLabel(dueAt) {
    if (!dueAt || dueAt <= Date.now()) return ui.t('roots.dueToday');
    var days = Math.max(1, Math.ceil((dueAt - Date.now()) / 86400000));
    return ui.t('roots.dueIn', { n: days });
  }

  function tabs(active) {
    return '<div class="segmented is-block" role="group">' +
      '<button type="button" class="segment" aria-pressed="' + (active === 'atlas') +
      '" data-roots-view="atlas">' + ui.esc(ui.t('roots.atlas')) + '</button>' +
      '<button type="button" class="segment" aria-pressed="' + (active === 'personal') +
      '" data-roots-view="personal">' + ui.esc(ui.t('roots.personal')) + '</button>' +
      '<button type="button" class="segment" aria-pressed="' + (active === 'review') +
      '" data-roots-view="review">' + ui.esc(ui.t('roots.reviewTab')) + '</button></div>';
  }

  function atlasView() {
    var q = ns.session.atlasQuery || '';
    var lang = ns.session.atlasLang || '';
    var results = roots.searchAtlas(q, { language: lang });
    var html = stats() + '<div class="searchbar is-small">' + ui.icon('search') +
      '<input id="atlas-search" type="search" value="' + ui.esc(q) + '" placeholder="' +
      ui.esc(ui.t('roots.atlasSearch')) + '" aria-label="' + ui.esc(ui.t('roots.atlasSearch')) + '"></div>';
    html += '<div class="settings-row"><span class="settings-key">' + ui.esc(ui.t('roots.languageFilter')) + '</span>' +
      ui.picker({ id: 'atlas-lang', value: lang, compact: true, label: ui.t('roots.languageFilter'),
        options: [{ id: '', label: ui.t('roots.allLanguages') }, { id: 'en', label: 'English' },
          { id: 'fr', label: 'Français' }, { id: 'de', label: 'Deutsch' }],
        onPick: function (next) { ns.session.atlasLang = next; ns.router.refresh(); } }) + '</div>';
    html += '<div id="atlas-results">' + atlasRows(results) + '</div>';
    return html;
  }

  function atlasRows(results) {
    if (!results.length) return '<div class="empty"><div class="empty-text">' +
      ui.esc(ui.t('roots.atlasEmpty')) + '</div></div>';
    return '<div class="list">' + results.map(function (root) {
      var starred = roots.isRootStarred(root.id);
      return '<button type="button" class="row" data-root="' + ui.esc(root.id) + '">' +
        '<span class="row-main"><span class="row-title"><span class="mono">' + ui.esc(root.form) +
        '</span></span><span class="row-sub">' + ui.esc(root.meaning || root.originLabel || '') +
        ' · ' + ui.esc(root.originFamily) + '</span></span><span class="row-aside"><span class="chip">' +
        (root.derivedWords || []).length + '</span><span class="icon-btn' + (starred ? ' is-starred' : '') +
        '" data-root-star="' + ui.esc(root.id) + '">' + (starred ? ui.iconFilled('star') : ui.icon('star')) +
        '</span></span></button>';
    }).join('') + '</div>';
  }

  function bindRootRows(root) {
    root.querySelectorAll('[data-root]').forEach(function (row) {
      row.addEventListener('click', function () {
        location.hash = '#/root/' + encodeURIComponent(row.getAttribute('data-root'));
      });
    });
  }

  function bindRootStars(root) {
    root.querySelectorAll('[data-root-star]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        roots.toggleRootStar(button.getAttribute('data-root-star'));
        ns.router.refresh();
      });
    });
  }

  function personalView() {
    var rows = roots.personalRoots();
    var html = '<div class="section-head"><span class="card-title">' + ui.esc(ui.t('roots.personal')) +
      ' · ' + rows.length + '</span></div>';
    if (!rows.length) return html + '<div class="empty"><div class="empty-text">' +
      ui.esc(ui.t('roots.personalEmpty')) + '</div></div>';
    html += '<div class="chips root-network" aria-hidden="true">' + rows.slice(0, 12).map(function (root) {
      return '<span class="chip">' + ui.esc(root.form) + '</span>';
    }).join('<span class="morph-op">·</span>') + '</div>';
    html += '<div class="list">' + rows.map(function (root) {
      var note = roots.rootNote(root.id);
      return '<button type="button" class="row" data-root="' + ui.esc(root.id) + '">' +
        '<span class="row-main"><span class="row-title"><span class="mono">' + ui.esc(root.form) +
        '</span></span><span class="row-sub">' + ui.esc(root.meaning || '') +
        (note ? ' · ' + ui.esc(note) : '') + '</span></span><span class="row-aside"><span class="chip">' +
        ui.esc(ui.t('roots.state.' + root.state)) + '</span></span></button>';
    }).join('') + '</div>';
    return html;
  }

  function stats() {
    var s = roots.stats();
    return '<div class="root-stats">' +
      '<div><b>' + s.due + '</b><span>' + ui.esc(ui.t('roots.stat.due')) + '</span></div>' +
      '<div><b>' + s.learning + '</b><span>' + ui.esc(ui.t('roots.stat.learning')) + '</span></div>' +
      '<div><b>' + s.known + '</b><span>' + ui.esc(ui.t('roots.stat.known')) + '</span></div>' +
      '<div><b>' + s.words + '</b><span>' + ui.esc(ui.t('roots.stat.words')) + '</span></div></div>';
  }

  function list() {
    var settings = ns.store.getSettings();
    var sort = settings.rootSort || 'learning';
    var groups = roots.rootGroups(sort, ui.locale());
    var all = ['en', 'fr', 'de'].reduce(function (sum, lang) { return sum.concat(groups[lang] || []); }, []);
    var html = stats();
    if (!all.length) {
      return html + '<div class="empty"><div class="empty-icon">' + ui.icon('branch') + '</div>' +
        '<div class="empty-title">' + ui.esc(ui.t('roots.emptyTitle')) + '</div>' +
        '<div class="empty-text">' + ui.esc(ui.t('roots.emptyText')) + '</div>' +
        '<div class="empty-actions"><button type="button" class="btn btn-primary" data-roots-dictionary>' +
        ui.esc(ui.t('nav.dictionary')) + '</button><button type="button" class="btn" data-roots-starred>' +
        ui.esc(ui.t('nav.starred')) + '</button></div></div>';
    }
    var sortOptions = [
      { id: 'learning', label: ui.t('roots.sort.learning') },
      { id: 'latest', label: ui.t('roots.sort.latest') },
      { id: 'alphabetical', label: ui.t('roots.sort.alphabetical') },
      { id: 'family', label: ui.t('roots.sort.family') }
    ];
    html += '<div class="settings-row"><span class="settings-key">' + ui.esc(ui.t('roots.sort')) + '</span>' +
      ui.picker({ id: 'root-sort', value: sort, compact: true, label: ui.t('roots.sort'),
        options: sortOptions, onPick: function (next) {
          ns.store.patchSettings({ rootSort: next });
          ns.router.refresh();
        } }) + '</div>';
    var reviewLang = ns.session.rootReviewLang || 'en';
    var reviewScope = ns.session.rootReviewScope || 'due';
    var reviewPool = roots.reviewRoots(reviewLang, ns.store.outputLangFor(reviewLang), reviewScope)
      .slice(0, ns.CONFIG.limits.rootReviewRound);
    html += '<div class="settings-row"><span class="settings-key">' + ui.esc(ui.t('roots.reviewLanguage')) + '</span>' +
      ui.picker({ id: 'root-review-lang', value: reviewLang, compact: true, label: ui.t('roots.reviewLanguage'),
        options: [
          { id: 'en', label: 'English' }, { id: 'fr', label: 'Français' }, { id: 'de', label: 'Deutsch' }
        ], onPick: function (next) { ns.session.rootReviewLang = next; ns.router.refresh(); } }) + '</div>';
    html += '<div class="settings-row"><span class="settings-key">' + ui.esc(ui.t('roots.reviewScope')) + '</span>' +
      ui.picker({ id: 'root-review-scope', value: reviewScope, compact: true, label: ui.t('roots.reviewScope'),
        options: [
          { id: 'due', label: ui.t('roots.scope.due') },
          { id: 'all', label: ui.t('roots.scope.all') },
          { id: 'new', label: ui.t('roots.scope.new') }
        ], onPick: function (next) { ns.session.rootReviewScope = next; ns.router.refresh(); } }) + '</div>';
    html += '<div class="notice-actions"><button type="button" class="btn btn-primary" id="roots-review"' +
      (reviewPool.length ? '' : ' disabled') + '>' + ui.icon('branch') +
      ui.esc(ui.t('roots.review', { n: reviewPool.length })) + '</button></div>';
    ['en', 'fr', 'de'].forEach(function (language) {
      var items = groups[language] || [];
      if (!items.length) return;
      html += '<div class="section-head"><span class="card-title">' + ui.esc(ui.langName(language)) +
        ' · ' + items.length + '</span></div><div class="list">';
      items.forEach(function (root) {
        html += '<button type="button" class="row" data-root="' + ui.esc(root.key) + '">' +
          '<span class="row-main"><span class="row-title"><span class="mono" dir="auto">' +
          ui.esc(root.display) + '</span></span><span class="row-sub">' +
          ui.esc(root.meaning || '') + (root.origin ? ' · ' + ui.esc(root.origin) : '') + '</span></span>' +
          '<span class="row-aside"><span class="chip">' + ui.esc(ui.t('roots.state.' + root.state)) +
          '</span></span></button>';
      });
      html += '</div>';
    });
    return html;
  }

  function detail(key) {
    var root = roots.getRoot(key);
    if (!root) return '<div class="empty"><div class="empty-title">' + ui.esc(ui.t('roots.notFound')) + '</div></div>';
    var family = roots.familyWords(key);
    var html = '<div class="root-detail-head"><div class="root-glyph mono" dir="auto">' +
      ui.esc(root.display) + '</div><div><div class="root-meaning">' + ui.esc(root.meaning || '') +
      '</div><div class="hint">' + ui.esc(root.origin || '') + ' · ' +
      ui.esc(ui.t('roots.state.' + root.state)) + ' · ' + ui.esc(dueLabel(root.dueAt)) +
      '</div><div class="hint">' + ui.esc(ui.t('roots.lapses', { n: root.lapses || 0 })) + '</div></div></div>';
    html += '<p class="hint">' + ui.esc(ui.t('roots.aiNote')) + '</p>';
    html += '<div class="notice-actions"><button type="button" class="icon-btn' +
      (roots.isRootStarred(roots.atlasId(root)) ? ' is-starred' : '') + '" data-root-star="' +
      ui.esc(roots.atlasId(root)) + '" aria-label="' + ui.esc(ui.t('roots.starRoot')) + '">' +
      (roots.isRootStarred(roots.atlasId(root)) ? ui.iconFilled('star') : ui.icon('star')) + '</button>' +
      '<button type="button" class="icon-btn" data-root-note="' + ui.esc(roots.atlasId(root)) +
      '" aria-label="' + ui.esc(ui.t('roots.note')) + '">' + ui.icon('pencil') + '</button></div>';
    if (root.variants && root.variants.length) {
      html += '<p class="hint">' + ui.esc(ui.t('roots.variants')) + ': ' +
        ui.esc(root.variants.join(' · ')) + '</p>';
    }
    var sourceEntry = root.wordIds && root.wordIds.length ? ns.store.getEntry(root.wordIds[0]) : null;
    var chain = sourceEntry && sourceEntry.lines && sourceEntry.lines.etymology &&
      sourceEntry.lines.etymology.etymology && sourceEntry.lines.etymology.etymology.chain;
    if (Array.isArray(chain) && chain.length) {
      html += '<div class="section-head"><span class="card-title">' + ui.esc(ui.t('discovery.rootNote')) +
        '</span></div><ol class="etym-timeline">' + chain.map(function (node) {
          return '<li class="etym-node"><span class="etym-mark"></span><div class="etym-line">' +
            '<span class="etym-lang">' + ui.esc(node.language || node.stage || '') + '</span></div>' +
            (node.form ? '<div class="etym-form" dir="auto">' + ui.esc(node.form) + '</div>' : '') +
            (node.meaning ? '<div class="etym-meaning">' + ui.esc(node.meaning) + '</div>' : '') + '</li>';
        }).join('') + '</ol>';
    }
    if (family.length) {
      html += '<div class="section-head"><span class="card-title">' + ui.esc(ui.t('roots.family')) +
        '</span></div><div class="list">' + family.map(function (word) {
          return '<button type="button" class="row" data-family-word="' + ui.esc(word.word) +
            '" data-family-lang="' + ui.esc(root.language || 'en') + '" dir="auto">' +
            '<span class="row-main"><span class="row-title">' +
            ui.esc(word.word) + '</span><span class="row-sub">' + ui.esc(word.gloss || '') + '</span></span>' +
            '<span class="row-aside">' + ui.icon('chevron') + '</span></button>';
        }).join('') + '</div>';
    }
    var entries = root.wordIds.map(function (id) { return ns.store.findRow(id); }).filter(Boolean);
    if (entries.length) {
      html += '<div class="section-head"><span class="card-title">' + ui.esc(ui.t('roots.sources')) +
        '</span></div><div class="chips">' + entries.map(function (row) {
          return '<a class="chip chip-button" href="#/word/' + encodeURIComponent(row.id) + '">' +
            ui.esc(row.word) + '</a>';
        }).join('') + '</div>';
    }
    var contexts = roots.contextFor(roots.atlasId(root));
    if (contexts.length) {
      html += '<div class="section-head"><span class="card-title">' + ui.esc(ui.t('roots.sources')) +
        '</span></div><div class="chips">' + contexts.map(function (item) {
          return '<span class="chip" dir="auto">' + ui.esc(item.title || item.contextKind) + '</span>';
        }).join('') + '</div>';
    }
    return html;
  }

  function render(container, params) {
    if (!roots.allRoots().length) roots.rebuildIndex();
    var active = ns.session.rootsView || 'atlas';
    var html = tabs(active) + (params && params.key ? detail(decodeURIComponent(params.key)) :
      (active === 'personal' ? stats() + personalView() :
        (active === 'review' ? list() : atlasView() + personalView())));
    ui.setHTML(container, html);
    container.querySelectorAll('[data-roots-view]').forEach(function (button) {
      button.addEventListener('click', function () {
        ns.session.rootsView = button.getAttribute('data-roots-view');
        ns.router.refresh();
      });
    });
    var atlasSearch = container.querySelector('#atlas-search');
    if (atlasSearch) {
      var timer = null;
      atlasSearch.addEventListener('input', function () {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
          ns.session.atlasQuery = atlasSearch.value;
          var results = container.querySelector('#atlas-results');
          if (results) {
            results.innerHTML = atlasRows(roots.searchAtlas(ns.session.atlasQuery, { language: ns.session.atlasLang || '' }));
            bindRootRows(results);
            bindRootStars(results);
          }
        }, 120);
      });
    }
    var review = container.querySelector('#roots-review');
    if (review) review.addEventListener('click', function () {
      var lang = ns.session.rootReviewLang || 'en';
      ns.rootReview.open(null, {
        language: lang,
        outputLang: ns.store.outputLangFor(lang),
        scope: ns.session.rootReviewScope || 'due'
      });
    });
    var toDictionary = container.querySelector('[data-roots-dictionary]');
    if (toDictionary) toDictionary.addEventListener('click', function () { location.hash = '#/dictionary'; });
    var toStarred = container.querySelector('[data-roots-starred]');
    if (toStarred) toStarred.addEventListener('click', function () { location.hash = '#/favorites'; });
    var note = container.querySelector('[data-root-note]');
    if (note) note.addEventListener('click', function () {
      var id = note.getAttribute('data-root-note');
      var value = window.prompt(ui.t('roots.note'), roots.rootNote(id));
      if (value == null) return;
      roots.setRootNote(id, value);
      ns.router.refresh();
    });
    bindRootRows(container);
    bindRootStars(container);
    container.querySelectorAll('[data-family-word]').forEach(function (row) {
      row.addEventListener('click', function () {
        var word = row.getAttribute('data-family-word');
        var lang = row.getAttribute('data-family-lang') || 'en';
        ns.session.query = word;
        ns.store.patchSettings({ queryLang: lang, queryMode: 'word' });
        location.hash = '#/dictionary';
        window.setTimeout(function () { ns.views.dictionary.openWord(word, lang); }, 0);
      });
    });
  }

  ns.views.roots = {
    topbar: function (params) {
      return {
        title: ui.t(params && params.key ? 'roots.detail' : 'nav.roots'),
        sub: params && params.key ? ui.t('roots.sub') : '',
        back: !!(params && params.key)
      };
    },
    render: render
  };
})(window.LINGUIST);
