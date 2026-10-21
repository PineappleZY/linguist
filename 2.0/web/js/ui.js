/* RADICLE — DOM helpers, icon set and small presentational utilities.
   Markup is produced as strings; every interpolated value goes through esc(). */

window.RADICLE = window.RADICLE || {};

(function (ns) {
  'use strict';

  /* ---------- Escaping ---------- */

  var ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ESCAPE_MAP[char];
    });
  }

  function escList(values) {
    if (!Array.isArray(values)) return '';
    return values.map(esc).join('');
  }

  /* ---------- Icons (stroke based, SF-Symbols flavoured) ---------- */

  var PATHS = {
    search: '<circle cx="11" cy="11" r="6"/><path d="M15.6 15.6 20 20"/>',
    book: '<path d="M5 6.5A3.5 3.5 0 0 1 8.5 3H19v14.5H8.5A3.5 3.5 0 0 0 5 21z"/><path d="M19 17.5v3"/><path d="M9 7.5h6"/>',
    person: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/>',
    back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    chevron: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    star: '<path d="M12 3.8l2.5 5.1 5.6.8-4.05 3.95.95 5.6L12 16.6l-5 2.65.95-5.6L3.9 9.7l5.6-.8z"/>',
    speaker: '<path d="M4.5 9.5h3L11.5 6v12l-4-3.5h-3z"/><path d="M15 9.6a3.6 3.6 0 0 1 0 4.8"/><path d="M17.6 7.2a7.2 7.2 0 0 1 0 9.6"/>',
    refresh: '<path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L20 9"/><path d="M20 4.5V9h-4.5"/><path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4 15"/><path d="M4 19.5V15h4.5"/>',
    trash: '<path d="M5 7h14"/><path d="M9.5 7V4.8h5V7"/><path d="M7 7l.9 12.2h8.2L17 7"/>',
    download: '<path d="M12 4v10.5"/><path d="M8 11l4 3.5 4-3.5"/><path d="M5 19.5h14"/>',
    upload: '<path d="M12 20v-10.5"/><path d="M16 13l-4-3.5-4 3.5"/><path d="M5 4.5h14"/>',
    check: '<path d="M5 12.5 9.5 17 19 7"/>',
    alert: '<path d="M12 4.2 2.6 20h18.8z"/><path d="M12 10v4.2"/><path d="M12 17.4h.01"/>',
    info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5.2"/><path d="M12 7.6h.01"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4.5 17.5 10 12l4 4 2.5-2 3 3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.8l1.9 1.1M17.2 15.1l1.9 1.1M4.9 16.2l1.9-1.1M17.2 8.9l1.9-1.1"/>',
    list: '<path d="M4.5 7h15"/><path d="M4.5 12h15"/><path d="M4.5 17h9"/>',
    link: '<path d="M10.2 13.4a4 4 0 0 0 5.7 0l2.7-2.7a4 4 0 0 0-5.7-5.7l-1.4 1.4"/><path d="M13.8 10.6a4 4 0 0 0-5.7 0l-2.7 2.7a4 4 0 0 0 5.7 5.7l1.4-1.4"/>',
    hourglass: '<path d="M6.8 4h10.4L12 10.6z"/><path d="M6.8 20h10.4L12 13.4z"/><path d="M12 10.6v2.8"/>',
    branch: '<path d="M12 3.5v5.6"/><path d="M12 9.1 6.4 20.5"/><path d="M12 9.1l5.6 11.4"/>',
    network: '<circle cx="6" cy="7" r="2.4"/><circle cx="18" cy="7" r="2.4"/><circle cx="12" cy="18" r="2.4"/><path d="M8 8.6 10.6 15.8"/><path d="M16 8.6 13.4 15.8"/>',
    museum: '<path d="M4 20V9.6L12 4.5l8 5.1V20"/><path d="M9.2 20v-5.6h5.6V20"/><path d="M4 20h16"/>',
    question: '<circle cx="12" cy="12" r="8"/><path d="M9.6 9.6a2.6 2.6 0 1 1 3.3 2.5c-.6.2-.9.7-.9 1.3v.4"/><path d="M12 16.6h.01"/>',
    sparkle: '<path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z"/><path d="M18.4 15.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
    quote: '<path d="M9.5 6.5H6.2A1.7 1.7 0 0 0 4.5 8.2v3.1a1.7 1.7 0 0 0 1.7 1.7h1.5c0 2.2-.7 3.6-2.2 4.5"/><path d="M19.5 6.5h-3.3a1.7 1.7 0 0 0-1.7 1.7v3.1a1.7 1.7 0 0 0 1.7 1.7h1.5c0 2.2-.7 3.6-2.2 4.5"/>',
    eye: '<path d="M2.8 12S6.4 6.2 12 6.2 21.2 12 21.2 12 17.6 17.8 12 17.8 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.6"/>',
    key: '<circle cx="8.6" cy="12" r="3.6"/><path d="M12.2 12H20"/><path d="M17 12v3"/><path d="M14 12v2.2"/>',
    close: '<path d="M6.6 6.6 17.4 17.4"/><path d="M17.4 6.6 6.6 17.4"/>',
    bulb: '<path d="M9.6 18.2h4.8"/><path d="M10.2 21h3.6"/><path d="M12 3.4a5.6 5.6 0 0 1 3.3 10.1c-.5.4-.8.9-.8 1.5v.2h-5v-.2c0-.6-.3-1.1-.8-1.5A5.6 5.6 0 0 1 12 3.4z"/>',
    target: '<circle cx="12" cy="12" r="7.6"/><circle cx="12" cy="12" r="2.7"/>',
    shield: '<path d="M12 3.4 5.2 6.3v5c0 4 2.9 7.5 6.8 9 3.9-1.5 6.8-5 6.8-9v-5z"/>'
  };

  function icon(name, className) {
    var body = PATHS[name] || PATHS.info;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
      (className ? ' class="' + esc(className) + '"' : '') + '>' + body + '</svg>';
  }

  var FILLED = {
    star: '<path d="M12 3.8l2.5 5.1 5.6.8-4.05 3.95.95 5.6L12 16.6l-5 2.65.95-5.6L3.9 9.7l5.6-.8z"/>'
  };

  function iconFilled(name, className) {
    var body = FILLED[name];
    if (!body) return icon(name, className);
    return '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.2" ' +
      'stroke-linejoin="round" aria-hidden="true"' +
      (className ? ' class="' + esc(className) + '"' : '') + '>' + body + '</svg>';
  }

  /* ---------- DOM ---------- */

  function el(html) {
    var host = document.createElement('div');
    host.innerHTML = html.trim();
    return host.firstElementChild;
  }

  function setHTML(node, html) {
    node.innerHTML = html;
    return node;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  /* Marks freshly rendered blocks for the staggered entrance animation. */
  function revealClass(index) {
    return 'reveal';
  }

  /* ---------- Segmented control ---------- */

  /* options: [{ id, label }] -> markup string. Wire it with bindSegmented so
     views keep rendering pure HTML and attach handlers in one pass. */
  function segmented(options, value, group, block) {
    var html = '<div class="segmented' + (block ? ' is-block' : '') +
      '" data-segmented="' + esc(group) + '" role="group">';
    options.forEach(function (option) {
      html += '<button type="button" class="segment" data-seg="' + esc(option.id) + '" aria-pressed="' +
        (option.id === value ? 'true' : 'false') + '">' + esc(option.label) + '</button>';
    });
    return html + '</div>';
  }

  function bindSegmented(root, group, onSelect) {
    var node = root.querySelector('[data-segmented="' + group + '"]');
    if (!node) return;
    node.addEventListener('click', function (event) {
      var button = event.target.closest('[data-seg]');
      if (!button || button.getAttribute('aria-pressed') === 'true') return;
      node.querySelectorAll('[data-seg]').forEach(function (item) {
        item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
      });
      onSelect(button.getAttribute('data-seg'));
    });
  }

  /* ---------- Toast ---------- */

  var toastTimer = null;

  function toast(message, ms) {
    var host = byId('toast-host');
    if (!host) return;
    host.innerHTML = '<div class="toast">' + esc(message) + '</div>';
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      host.innerHTML = '';
    }, ms || 2600);
  }

  /* ---------- Formatting ---------- */

  function startOfDay(date) {
    var copy = new Date(date.getTime());
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function bucketFor(ts) {
    var today = startOfDay(new Date()).getTime();
    var day = 86400000;
    if (ts >= today) return 'Today';
    if (ts >= today - day) return 'Yesterday';
    return 'Earlier';
  }

  function relativeTime(ts) {
    var diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    var date = new Date(ts);
    var sameYear = date.getFullYear() === new Date().getFullYear();
    var month = date.toLocaleString('en', { month: 'short' });
    return sameYear ? month + ' ' + date.getDate() : month + ' ' + date.getDate() + ', ' + date.getFullYear();
  }

  function langBadge(code) {
    if (!code) return '';
    return '<span class="badge-lang">' + esc(String(code).toUpperCase()) + '</span>';
  }

  function outputLangMeta(id) {
    var list = ns.CONFIG.outputLanguages;
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return list[i];
    }
    return list[0];
  }

  function modelMeta(id) {
    var list = ns.CONFIG.models;
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return list[i];
    }
    return list[0];
  }

  /* ---------- Skeleton blocks ---------- */

  function skeletonCard(lines) {
    var html = '<div class="card">';
    html += '<div class="skeleton sk-line sk-w-40" style="margin-top:0"></div>';
    for (var i = 0; i < (lines || 2); i += 1) {
      html += '<div class="skeleton sk-line ' + (i % 2 ? 'sk-w-90' : 'sk-w-70') + '"></div>';
    }
    return html + '</div>';
  }

  ns.ui = {
    esc: esc,
    escList: escList,
    icon: icon,
    iconFilled: iconFilled,
    el: el,
    setHTML: setHTML,
    byId: byId,
    revealClass: revealClass,
    segmented: segmented,
    bindSegmented: bindSegmented,
    toast: toast,
    bucketFor: bucketFor,
    relativeTime: relativeTime,
    langBadge: langBadge,
    outputLangMeta: outputLangMeta,
    modelMeta: modelMeta,
    skeletonCard: skeletonCard
  };
})(window.RADICLE);
