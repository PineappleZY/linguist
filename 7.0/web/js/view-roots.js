/* LINGUIST — Roots tab and root detail. */

window.LINGUIST = window.LINGUIST || {};
window.LINGUIST.views = window.LINGUIST.views || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var roots = ns.roots;

  function stats() {
    var s = roots.stats();
    return '<div class="root-stats">' +
      '<div><b>' + s.due + '</b><span>' + ui.esc(ui.t('roots.stat.due')) + '</span></div>' +
      '<div><b>' + s.learning + '</b><span>' + ui.esc(ui.t('roots.stat.learning')) + '</span></div>' +
      '<div><b>' + s.known + '</b><span>' + ui.esc(ui.t('roots.stat.known')) + '</span></div>' +
      '<div><b>' + s.words + '</b><span>' + ui.esc(ui.t('roots.stat.words')) + '</span></div></div>';
  }

  function list() {
    var all = roots.allRoots();
    var progress = roots.stats();
    var html = stats();
    if (!all.length) {
      return html + '<div class="empty"><div class="empty-icon">' + ui.icon('branch') + '</div>' +
        '<div class="empty-title">' + ui.esc(ui.t('roots.emptyTitle')) + '</div>' +
        '<div class="empty-text">' + ui.esc(ui.t('roots.emptyText')) + '</div></div>';
    }
    var due = roots.dueQueue(ns.CONFIG.limits.rootReviewRound);
    html += '<div class="notice-actions"><button type="button" class="btn btn-primary" id="roots-review"' +
      (due.length ? '' : ' disabled') + '>' + ui.icon('branch') +
      ui.esc(ui.t('roots.review', { n: due.length })) + '</button></div>';
    html += '<div class="section-head"><span class="card-title">' + ui.esc(ui.t('roots.all')) + '</span></div><div class="list">';
    all.forEach(function (root) {
      var p = roots.getRoot(root.key) || {};
      html += '<button type="button" class="row" data-root="' + ui.esc(root.key) + '">' +
        '<span class="row-main"><span class="row-title"><span class="mono" dir="auto">' +
        ui.esc(root.display) + '</span></span><span class="row-sub">' +
        ui.esc(root.meaning || '') + (root.origin ? ' · ' + ui.esc(root.origin) : '') + '</span></span>' +
        '<span class="row-aside"><span class="chip">' + ui.esc(ui.t('roots.state.' + (p.state || 'new'))) +
        '</span></span></button>';
    });
    return html + '</div>';
  }

  function detail(key) {
    var root = roots.getRoot(key);
    if (!root) return '<div class="empty"><div class="empty-title">' + ui.esc(ui.t('roots.notFound')) + '</div></div>';
    var family = roots.familyWords(key);
    var html = '<div class="root-detail-head"><div class="root-glyph mono" dir="auto">' +
      ui.esc(root.display) + '</div><div><div class="root-meaning">' + ui.esc(root.meaning || '') +
      '</div><div class="hint">' + ui.esc(root.origin || '') + ' · ' +
      ui.esc(ui.t('roots.state.' + root.state)) + '</div></div></div>';
    if (root.variants && root.variants.length) {
      html += '<p class="hint">' + ui.esc(ui.t('roots.variants')) + ': ' +
        ui.esc(root.variants.join(' · ')) + '</p>';
    }
    html += '<div class="notice-actions"><button type="button" class="btn btn-primary" id="root-review-one">' +
      ui.icon('branch') + ui.esc(ui.t('roots.reviewOne')) + '</button></div>';
    if (family.length) {
      html += '<div class="section-head"><span class="card-title">' + ui.esc(ui.t('roots.family')) +
        '</span></div><div class="list">' + family.map(function (word) {
          return '<div class="row row-static" dir="auto"><span class="row-main"><span class="row-title">' +
            ui.esc(word.word) + '</span><span class="row-sub">' + ui.esc(word.gloss || '') + '</span></span></div>';
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
    if (review) review.addEventListener('click', function () { ns.rootReview.open(); });
    var one = container.querySelector('#root-review-one');
    if (one) one.addEventListener('click', function () { ns.rootReview.open(params.key); });
    container.querySelectorAll('[data-root]').forEach(function (row) {
      row.addEventListener('click', function () {
        location.hash = '#/root/' + encodeURIComponent(row.getAttribute('data-root'));
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
