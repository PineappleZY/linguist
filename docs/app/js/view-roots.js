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
        '<div class="empty-text">' + ui.esc(ui.t('roots.emptyText')) + '</div></div>';
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
    var reviewPool = roots.reviewRoots(reviewLang, ns.store.outputLangFor(reviewLang), reviewScope);
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
    html += '<div class="notice-actions"><button type="button" class="btn btn-primary" id="root-review-one">' +
      ui.icon('branch') + ui.esc(ui.t('roots.reviewOne')) + '</button></div>';
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
    return html;
  }

  function render(container, params) {
    if (!roots.allRoots().length) roots.rebuildIndex();
    var html = params && params.key ? detail(decodeURIComponent(params.key)) : list();
    ui.setHTML(container, html);
    var review = container.querySelector('#roots-review');
    if (review) review.addEventListener('click', function () {
      var lang = ns.session.rootReviewLang || 'en';
      ns.rootReview.open(null, {
        language: lang,
        outputLang: ns.store.outputLangFor(lang),
        scope: ns.session.rootReviewScope || 'due'
      });
    });
    var one = container.querySelector('#root-review-one');
    if (one) one.addEventListener('click', function () { ns.rootReview.open(params.key); });
    container.querySelectorAll('[data-root]').forEach(function (row) {
      row.addEventListener('click', function () {
        location.hash = '#/root/' + encodeURIComponent(row.getAttribute('data-root'));
      });
    });
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
