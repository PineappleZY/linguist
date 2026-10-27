/* LINGUIST — the file page.

   Four cards and one header. The cards are read from the assembled document
   (see view-word.js:documentData), not from a stored line, so the renderers
   here take that assembly and each picks out its own field.

   The header is where a long file becomes bearable: which part is being read,
   how many there are, and a way to stop without losing what has already
   arrived. Reading a document is the only place in the app where a single
   action can cost several minutes and several requests, and the reader is
   entitled to see that happening. */

window.LINGUIST = window.LINGUIST || {};
window.LINGUIST.views = window.LINGUIST.views || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var CONFIG = ns.CONFIG;

  function list(items) {
    var clean = (Array.isArray(items) ? items : []).filter(Boolean);
    if (!clean.length) return '';
    return '<ul class="stack-sm">' + clean.map(function (item) {
      return '<li>' + ui.esc(item) + '</li>';
    }).join('') + '</ul>';
  }

  /* ---------- Card bodies ---------- */

  function bodySummary(doc) {
    var html = '';
    /* How much of the file this outline covers. A different string from the
       running counter: that one ends in an ellipsis because work is happening,
       and nothing is happening by the time a card has content. */
    if (doc.parts > 1) {
      html += '<div class="doc-progress-line">' + ui.esc(ui.t('doc.read', {
        n: doc.parts, total: doc.total
      })) + '</div>';
    }
    return html + list(doc.summary);
  }

  function bodyTranslation(doc) {
    var text = String(doc.translation || '');
    if (!text) return '';
    /* Paragraphs are the blank-line-separated blocks; inside one, a single line
       break is part of the source's shape (a verse, a list, a heading) and is
       kept by pre-wrap rather than flattened into a space. */
    var paragraphs = text.split(/\n{2,}/).filter(function (part) { return part.trim(); });
    return paragraphs.map(function (part) {
      return '<p class="doc-para">' + ui.esc(part.replace(/^\n+|\n+$/g, '')) + '</p>';
    }).join('');
  }

  function bodyVocabulary(doc) {
    var items = (Array.isArray(doc.vocabulary) ? doc.vocabulary : []).filter(Boolean);
    if (!items.length) return '';
    return '<ul class="deflist">' + items.map(function (item) {
      var root = ns.roots && ns.roots.findRootForWord(item.term, doc.language);
      return '<li>' +
        '<div class="def-term">' + ui.esc(item.term || '') +
        (item.reading ? '<span class="mono muted-3"> ' + ui.esc(item.reading) + '</span>' : '') +
        (root ? '<a class="chip chip-button" href="#/root/' + encodeURIComponent(root.key) + '">' +
          ui.esc(root.display) + '</a>' : '') +
        '</div>' +
        (item.meaning ? '<div class="def-desc">' + ui.esc(item.meaning) + '</div>' : '') +
        (item.example ? '<div class="example"><div class="example-text">' + ui.esc(item.example) +
          '</div></div>' : '') +
        '</li>';
    }).join('') + '</ul>';
  }

  function bodyRegister(doc) {
    var register = doc.register && typeof doc.register === 'object' ? doc.register : {};
    var facts = [
      ['field.genre', register.genre],
      ['field.register', register.register],
      ['field.period', register.period]
    ].filter(function (pair) { return pair[1]; });
    var html = '';
    if (facts.length) {
      html += '<div class="fact-grid">' + facts.map(function (pair) {
        return '<div class="fact"><span class="fact-key">' + ui.esc(ui.t(pair[0])) + '</span>' +
          '<span class="fact-value">' + ui.esc(pair[1]) + '</span></div>';
      }).join('') + '</div>';
    }
    var notes = (Array.isArray(register.notes) ? register.notes : []).filter(Boolean);
    if (notes.length) {
      html += '<div class="sub-label">' + ui.esc(ui.t('field.notes')) + '</div>' + list(notes);
    }
    return html;
  }

  /* ---------- Header ---------- */

  function progressBar(doc) {
    var total = doc.total || 1;
    var done = doc.state === 'done' ? total : Math.max(0, Math.min(total, doc.index - 1));
    var width = total ? Math.round((done / total) * 100) : 0;
    return '<div class="doc-bar"><span style="width:' + width + '%"></span></div>';
  }

  /* Nothing here is a control until something is actually running: a document
     that finished has no use for a Stop button. */
  function statusRow(doc) {
    if (!doc) return '';
    if (doc.state === 'running') {
      return '<div class="doc-status">' + ui.icon('hourglass') +
        '<span>' + ui.esc(ui.t('doc.progress', { n: doc.index, total: doc.total })) + '</span>' +
        '<span class="topbar-spacer"></span>' +
        '<button type="button" class="btn btn-sm" data-doc-cancel>' +
        ui.esc(ui.t('doc.cancel')) + '</button></div>' + progressBar(doc);
    }
    if (doc.state === 'merging') {
      return '<div class="doc-status">' + ui.icon('hourglass') +
        '<span>' + ui.esc(ui.t('doc.progress', { n: doc.total, total: doc.total })) + '</span></div>' +
        progressBar(doc);
    }
    if (doc.state === 'partial') {
      return '<div class="notice notice-warn" style="margin-top:12px">' + ui.icon('alert') +
        '<div><div class="notice-title">' +
        ui.esc(ui.t('doc.partial', { n: doc.index, total: doc.total })) +
        '</div><div class="notice-actions">' +
        '<button type="button" class="btn btn-sm" data-doc-resume>' +
        ui.esc(ui.t('doc.resume', { n: Math.min(doc.index + 1, doc.total) })) + '</button>' +
        '</div></div></div>';
    }
    return '';
  }

  function head(entry, doc) {
    var name = entry.name || entry.word || '';
    var meta = '<span class="badge-lang">' + ui.esc(String(entry.language || '').toUpperCase()) + '</span>' +
      '<span class="chip">' + ui.esc(ui.t('mode.file')) + '</span>' +
      (doc && doc.total > 1
        ? '<span class="chip">' + ui.esc(ui.t('file.requests', { n: doc.total })) + '</span>'
        : '');
    var html = '<section class="card word-head doc-head">' +
      '<div class="word-title-row"><div class="word-title">' + ui.esc(name) + '</div></div>' +
      '<div class="word-meta">' + meta + '</div>';
    html += statusRow(doc);
    /* The source text past the storage ceiling is not kept, and the reader has
       to know that switching the explanation language later will re-read only
       what was kept. */
    if (entry.textTruncated) {
      html += '<p class="hint">' + ui.esc(ui.t('file.truncated', { n: CONFIG.limits.document.keepSource })) + '</p>';
    }
    return html;
  }

  ns.views.document = {
    head: head,
    statusRow: statusRow,
    builders: {
      summary: bodySummary,
      translation: bodyTranslation,
      vocabulary: bodyVocabulary,
      register: bodyRegister
    }
  };
})(window.LINGUIST);
