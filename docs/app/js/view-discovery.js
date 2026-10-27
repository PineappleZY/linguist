/* LINGUIST — a compact card for a word outside the five full dictionaries.

   It deliberately stays a discovery, not a full entry: language, core meaning,
   two examples and an honest root note. No practice, no normal wordbooks. */

window.LINGUIST = window.LINGUIST || {};
window.LINGUIST.views = window.LINGUIST.views || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var store = ns.store;

  function render(container, params) {
    var entry = store.getEntry(params.id);
    if (!entry || entry.kind !== 'discovery') {
      ui.setHTML(container, '<div class="empty"><div class="empty-title">' +
        ui.esc(ui.t('entry.notOnDeviceTitle')) + '</div></div>');
      return;
    }
    var starred = store.isStarred(entry.id);
    var html = '<div class="discovery-head">' +
      '<div class="discovery-word" dir="auto">' + ui.esc(entry.word) + '</div>' +
      '<div class="discovery-meta">' + ui.esc(ui.languageLabel(entry.languageCode, entry.languageName || entry.language)) +
      (entry.pronunciation ? ' · <span class="mono" dir="auto">' + ui.esc(entry.pronunciation) + '</span>' : '') +
      '</div><div class="topbar-actions">' +
      '<button type="button" class="icon-btn' + (starred ? ' is-starred' : '') + '" data-discovery-star>' +
      (starred ? ui.iconFilled('star') : ui.icon('star')) + '</button></div></div>';

    html += '<section class="card"><div class="card-head">' + ui.icon('target') +
      '<span class="card-title">' + ui.esc(ui.t('discovery.core')) + '</span></div>' +
      '<p class="discovery-meaning" dir="auto">' + ui.esc(entry.coreMeaning || '') + '</p>' +
      (entry.why ? '<p class="hint" dir="auto">' + ui.esc(entry.why) + '</p>' : '') +
      '</section>';

    if (entry.examples && entry.examples.length) {
      html += '<section class="card"><div class="card-head">' + ui.icon('quote') +
        '<span class="card-title">' + ui.esc(ui.t('discovery.examples')) + '</span></div><div class="discovery-examples">' +
        entry.examples.map(function (ex) {
          return '<div class="discovery-example"><div dir="auto">' + ui.esc(ex.text || '') + '</div>' +
            '<div class="muted" dir="auto">' + ui.esc(ex.translation || '') + '</div></div>';
        }).join('') + '</div></section>';
    }

    if (entry.rootNote) {
      html += '<section class="card"><div class="card-head">' + ui.icon('branch') +
        '<span class="card-title">' + ui.esc(ui.t('discovery.rootNote')) + '</span></div>' +
        '<p dir="auto">' + ui.esc(entry.rootNote) + '</p></section>';
    }

    html += '<p class="hint">' + ui.esc(ui.t('discovery.bookOnly')) + '</p>';
    ui.setHTML(container, html);

    var star = container.querySelector('[data-discovery-star]');
    if (star) star.addEventListener('click', function () {
      var next = store.toggleStar(entry.id);
      entry.starred = next;
      ns.router.refresh();
    });
  }

  ns.views.discovery = {
    topbar: function () { return { title: ui.t('dict.surprise'), sub: '', back: true }; },
    render: render
  };
})(window.LINGUIST);
