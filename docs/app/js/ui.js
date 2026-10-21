/* LINGUIST — DOM helpers, icon set and small presentational utilities.
   Markup is produced as strings; every interpolated value goes through esc(). */

window.LINGUIST = window.LINGUIST || {};

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

  /* ---------- Interface language ----------
     Two independent axes: this one changes the buttons and labels, and the
     per-language table in Profile decides what language the model writes in.
     A key missing from a language falls back to English, and a missing English
     key returns the key itself, so a gap shows up in the interface and in the
     tests rather than silently blanking a label. */

  var LOCALE_TAGS = {
    en: 'en-US', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', es: 'es-ES', ja: 'ja-JP', zh: 'zh-CN'
  };

  function supportedLocales() {
    return ns.CONFIG.queryLanguages.map(function (lang) { return lang.id; });
  }

  /* The setting may be 'auto', which means "whatever the browser asks for". */
  function locale(setting) {
    var wanted = setting;
    if (wanted == null) {
      var settings = ns.store && ns.store.getSettings ? ns.store.getSettings() : null;
      wanted = settings ? settings.uiLang : 'auto';
    }
    var supported = supportedLocales();
    if (wanted && wanted !== 'auto' && supported.indexOf(wanted) > -1) return wanted;
    var asked = [];
    if (typeof navigator !== 'undefined') {
      if (Array.isArray(navigator.languages)) asked = asked.concat(navigator.languages);
      if (navigator.language) asked.push(navigator.language);
    }
    for (var i = 0; i < asked.length; i += 1) {
      var base = String(asked[i] || '').toLowerCase().split('-')[0];
      if (supported.indexOf(base) > -1) return base;
    }
    return 'en';
  }

  function localeTag(which) { return LOCALE_TAGS[which || locale()] || 'en-US'; }

  /* A language's name *in the interface language* — the pickers show the native
     name on purpose (Français, 日本語), but prose has to say it the reader's way:
     a French sentence says « en allemand », not « en German ». */
  var LANG_NAMES = {
    en: { en: 'English', fr: 'French', de: 'German', it: 'Italian', es: 'Spanish', ja: 'Japanese', zh: 'Chinese' },
    zh: { en: '英语', fr: '法语', de: '德语', it: '意大利语', es: '西班牙语', ja: '日语', zh: '中文' },
    fr: { en: 'anglais', fr: 'français', de: 'allemand', it: 'italien', es: 'espagnol', ja: 'japonais', zh: 'chinois' },
    de: { en: 'Englisch', fr: 'Französisch', de: 'Deutsch', it: 'Italienisch', es: 'Spanisch', ja: 'Japanisch', zh: 'Chinesisch' },
    ja: { en: '英語', fr: 'フランス語', de: 'ドイツ語', it: 'イタリア語', es: 'スペイン語', ja: '日本語', zh: '中国語' }
  };

  function langName(id) {
    var row = LANG_NAMES[locale()] || LANG_NAMES.en;
    return row[id] || LANG_NAMES.en[id] || String(id || '');
  }

  /* What the app calls itself. Deliberately not translated: the same word
     everywhere is what makes it a name. It is read from CONFIG so the file
     names, the cache name and the backup kind cannot drift away from it. */
  function appName() {
    return ns.CONFIG.appName;
  }

  /* `{name}` placeholders. An unknown key is returned as it stands, so it shows
     up in the interface and in the tests rather than blanking a label. */
  function t(key, vars) {
    var table = ns.strings || {};
    var lang = locale();
    var value = table[lang] && table[lang][key] != null ? table[lang][key]
      : (table.en ? table.en[key] : null);
    if (value == null) return key;
    return String(value).replace(/\{(\w+)\}/g, function (whole, name) {
      return vars && vars[name] != null ? String(vars[name]) : whole;
    });
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
    /* Surprise me. A sparkle said "magic" without saying "chance" — and the
       same sparkle already marks the mnemonic card — so the action is a die,
       which is the most legible metaphor for "pick one at random" that still
       reads at 22px. */
    dice: '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.2"/>' +
      '<circle cx="8.7" cy="8.7" r="1.15" fill="currentColor" stroke="none"/>' +
      '<circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/>' +
      '<circle cx="15.3" cy="15.3" r="1.15" fill="currentColor" stroke="none"/>',
    quote: '<path d="M9.5 6.5H6.2A1.7 1.7 0 0 0 4.5 8.2v3.1a1.7 1.7 0 0 0 1.7 1.7h1.5c0 2.2-.7 3.6-2.2 4.5"/><path d="M19.5 6.5h-3.3a1.7 1.7 0 0 0-1.7 1.7v3.1a1.7 1.7 0 0 0 1.7 1.7h1.5c0 2.2-.7 3.6-2.2 4.5"/>',
    eye: '<path d="M2.8 12S6.4 6.2 12 6.2 21.2 12 21.2 12 17.6 17.8 12 17.8 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.6"/>',
    key: '<circle cx="8.6" cy="12" r="3.6"/><path d="M12.2 12H20"/><path d="M17 12v3"/><path d="M14 12v2.2"/>',
    close: '<path d="M6.6 6.6 17.4 17.4"/><path d="M17.4 6.6 6.6 17.4"/>',
    bulb: '<path d="M9.6 18.2h4.8"/><path d="M10.2 21h3.6"/><path d="M12 3.4a5.6 5.6 0 0 1 3.3 10.1c-.5.4-.8.9-.8 1.5v.2h-5v-.2c0-.6-.3-1.1-.8-1.5A5.6 5.6 0 0 1 12 3.4z"/>',
    target: '<circle cx="12" cy="12" r="7.6"/><circle cx="12" cy="12" r="2.7"/>',
    shield: '<path d="M12 3.4 5.2 6.3v5c0 4 2.9 7.5 6.8 9 3.9-1.5 6.8-5 6.8-9v-5z"/>',
    pencil: '<path d="M4.6 19.4l4.2-1 9.3-9.3a2.2 2.2 0 0 0-3.1-3.1L5.7 15.3z"/><path d="M13.6 7.4l3.1 3.1"/>',
    /* The practice action has its own glyph. A bare pencil at 22px reads as
       "new folder" (and the plain pencil already means "rename" elsewhere in
       the app), so the action says what it is: a keycap spelling out prac.
       Candidates for this slot, and the one chosen, are in
       design/icon-concepts/make_practice_icons.py. */
    write: '<rect x="3" y="6.6" width="18" height="10.8" rx="3.2"/>' +
      '<text class="icon-text" x="12" y="13" text-anchor="middle" font-size="6.2" ' +
      'font-weight="700" fill="currentColor" stroke="none">prac</text>',
    plus: '<path d="M12 5.5v13"/><path d="M5.5 12h13"/>',
    arrowUp: '<path d="M12 19.5V5.5"/><path d="M6.4 11.1 12 5.5l5.6 5.6"/>',
    arrowDown: '<path d="M12 4.5v14"/><path d="M6.4 12.9 12 18.5l5.6-5.6"/>',
    /* An arrow with a bar over it: one tap to the front of the list, which is
       a different action from "up one place" and must not look like it. */
    toTop: '<path d="M12 20V10"/><path d="M7.2 14.2 12 9.4l4.8 4.8"/><path d="M5.5 4.5h13"/>',
    /* Two chevrons: "on to the next one", which is what skipping a word in a
       round does. A crossed-out circle would say "cancel", and cancelling is
       the × at the bottom left. */
    skip: '<path d="M5.5 6.5 12 12l-6.5 5.5"/><path d="M12.5 6.5 19 12l-6.5 5.5"/>',
    folder: '<path d="M3.6 7.2A2.6 2.6 0 0 1 6.2 4.6h3l1.8 2.2h6.8a2.6 2.6 0 0 1 2.6 2.6v7.4a2.6 2.6 0 0 1-2.6 2.6H6.2a2.6 2.6 0 0 1-2.6-2.6z"/>'
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

  /* `options` may be a duration or { ms, action: { label, onClick } }. An
     action turns the toast into an undo bar, which is how the destructive
     buttons (delete an entry, unstar a word) became recoverable without a
     second confirmation dialog. */
  function toast(message, options) {
    var host = byId('toast-host');
    if (!host) return;
    var ms = typeof options === 'number' ? options : (options && options.ms) || 2600;
    var action = options && typeof options === 'object' ? options.action : null;
    host.innerHTML = '<div class="toast">' + esc(message) +
      (action ? '<button type="button" class="toast-action" data-toast-action="1">' +
        esc(action.label) + '</button>' : '') + '</div>';
    if (toastTimer) window.clearTimeout(toastTimer);
    var clear = function () {
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = null;
      host.innerHTML = '';
    };
    if (action && typeof action.onClick === 'function') {
      var button = host.querySelector('[data-toast-action]');
      if (button) {
        button.addEventListener('click', function () {
          clear();
          action.onClick();
        });
      }
    }
    toastTimer = window.setTimeout(clear, ms);
  }

  /* ---------- Formatting ---------- */

  function startOfDay(date) {
    var copy = new Date(date.getTime());
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function pad2(value) {
    return value < 10 ? '0' + value : String(value);
  }

  /* Local calendar day, used as the history grouping key. */
  function dayKey(ts) {
    var date = new Date(ts || 0);
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function dayLabel(ts) {
    var key = dayKey(ts);
    if (key === dayKey(Date.now())) return t('date.today');
    if (key === dayKey(Date.now() - 86400000)) return t('date.yesterday');
    var date = new Date(ts || 0);
    var sameYear = date.getFullYear() === new Date().getFullYear();
    /* The reader's own date conventions, not a hand-rolled English month list:
       「10月12日」 and « 12 oct. » are both correct answers here. */
    try {
      return new Intl.DateTimeFormat(localeTag(), sameYear
        ? { month: 'short', day: 'numeric' }
        : { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
    } catch (err) {
      var label = MONTHS[date.getMonth()] + ' ' + date.getDate();
      return sameYear ? label : label + ', ' + date.getFullYear();
    }
  }

  /* Inside a dated group the header already carries the date, so repeating it
     on the row would be noise; the row shows the clock instead. Today keeps
     relative time, which says more than "14:32" about something just looked
     up. */
  function rowTime(ts) {
    var stamp = ts || 0;
    if (dayKey(stamp) === dayKey(Date.now())) {
      var diff = Date.now() - stamp;
      if (diff < 60000) return t('date.now');
      if (diff < 3600000) return t('date.minutes', { n: Math.floor(diff / 60000) });
      return t('date.hours', { n: Math.floor(diff / 3600000) });
    }
    var date = new Date(stamp);
    try {
      return new Intl.DateTimeFormat(localeTag(), { hour: '2-digit', minute: '2-digit' }).format(date);
    } catch (err) {
      return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
    }
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

  /* ---------- Pickers and the action sheet ----------
     Choosing one of a few things is the same interaction everywhere in the
     app, so it has one implementation: a button that says what is chosen, and
     a sheet that lists the alternatives. A native <select> was the only piece
     of the interface that looked like a form rather than like the app, and on
     a phone it hands over to a system picker that ignores the styling. The
     sheet is a real dialog: modal, focus-trapped, keyboard-drivable and
     dismissable by dragging it down. */

  var pickers = {};
  var sheetHostNode = null;
  var sheetConfig = null;
  var sheetReturnFocus = null;

  function picker(config) {
    /* Rendered values are also the lookup table for the delegated click
       handler, so a view only has to describe the control once. */
    pickers[config.id] = config;
    var current = null;
    (config.options || []).forEach(function (option) {
      if (option.id === config.value) current = option;
    });
    return '<button type="button" class="picker' + (config.compact ? ' is-compact' : '') +
      (config.block ? ' is-block' : '') + '" data-picker="' + esc(config.id) + '" ' +
      'aria-haspopup="dialog">' +
      '<span class="picker-value">' + esc(current ? current.label : (config.placeholder || '—')) + '</span>' +
      '<span class="picker-chevron">' + icon('chevron') + '</span></button>';
  }

  /* The list inside the sheet, as markup. Kept separate from the DOM wiring so
     the contents can be checked without a browser. */
  function sheetMarkup(config) {
    return (config.options || []).map(function (option) {
      var current = option.id === config.value;
      return '<button type="button" class="sheet-option' + (current ? ' is-current' : '') + '" ' +
        'role="option" aria-selected="' + (current ? 'true' : 'false') + '" ' +
        'data-sheet-option="' + esc(option.id) + '">' +
        '<span class="sheet-option-label">' + esc(option.label) + '</span>' +
        (option.note ? '<span class="sheet-option-note">' + esc(option.note) + '</span>' : '') +
        (current ? '<span class="sheet-check">' + icon('check') + '</span>' : '') +
        '</button>';
    }).join('');
  }

  /* Whether there is a DOM real enough to host a sheet. The offline build and
     the test harness both end up here. */
  function sheetUsable() {
    if (!document || typeof document.createElement !== 'function') return false;
    if (!document.body || typeof document.body.appendChild !== 'function') return false;
    return typeof document.createElement('div').querySelector === 'function';
  }

  function ensureSheet() {
    if (sheetHostNode) return sheetHostNode;
    var host = document.createElement('div');
    host.className = 'sheet-host';
    host.hidden = true;
    host.innerHTML =
      '<div class="sheet-backdrop" data-sheet-dismiss="1"></div>' +
      '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' +
      '<div class="sheet-grip" data-sheet-grip="1"></div>' +
      '<div class="sheet-title" id="sheet-title"></div>' +
      '<div class="sheet-list" role="listbox" aria-labelledby="sheet-title"></div>' +
      '<button type="button" class="btn btn-block sheet-cancel" data-sheet-dismiss="1">' +
      esc(t('common.cancel')) + '</button>' +
      '</div>';
    document.body.appendChild(host);

    host.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('[data-sheet-dismiss]')) { closeSheet(); return; }
      var option = event.target.closest ? event.target.closest('[data-sheet-option]') : null;
      if (option) chooseFromSheet(option.getAttribute('data-sheet-option'));
    });
    host.addEventListener('keydown', onSheetKey);
    wireSheetDrag(host);
    sheetHostNode = host;
    return host;
  }

  function openSheet(id) {
    var config = pickers[id];
    if (!config || !sheetUsable()) return false;
    sheetConfig = config;
    var host = ensureSheet();
    host.querySelector('.sheet-title').textContent = config.title || '';
    host.querySelector('.sheet-list').innerHTML = sheetMarkup(config);
    sheetReturnFocus = document.activeElement;
    host.hidden = false;
    if (document.body.classList) document.body.classList.add('is-sheet');
    var list = host.querySelector('.sheet-list');
    var target = list.querySelector('.is-current') || list.querySelector('.sheet-option');
    if (target) window.setTimeout(function () { target.focus(); }, 0);
    return true;
  }

  function closeSheet() {
    if (!sheetHostNode || sheetHostNode.hidden) return false;
    sheetHostNode.hidden = true;
    if (document.body.classList) document.body.classList.remove('is-sheet');
    sheetConfig = null;
    if (sheetReturnFocus && typeof sheetReturnFocus.focus === 'function') sheetReturnFocus.focus();
    sheetReturnFocus = null;
    return true;
  }

  function isSheetOpen() { return !!sheetHostNode && !sheetHostNode.hidden; }

  /* One entry point for "the user picked this", shared by the sheet and by the
     tests, so the wiring cannot drift from the behaviour. */
  function chooseFromSheet(optionId) {
    if (!sheetConfig) return false;
    var config = sheetConfig;
    closeSheet();
    if (typeof config.onPick === 'function') config.onPick(optionId);
    return true;
  }

  /* Used by the tests and by anything that picks without a sheet. */
  function pickerAction(id, optionId) {
    var config = pickers[id];
    if (!config) return false;
    closeSheet();
    if (typeof config.onPick === 'function') config.onPick(optionId);
    return true;
  }

  function onSheetKey(event) {
    if (!isSheetOpen()) return;
    if (event.key === 'Escape') { event.preventDefault(); closeSheet(); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Tab') return;
    var focusable = [].slice.call(sheetHostNode.querySelectorAll('.sheet-option, .sheet-cancel'));
    if (!focusable.length) return;
    event.preventDefault();
    var index = focusable.indexOf(document.activeElement);
    var step = (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) ? -1 : 1;
    focusable[(index + step + focusable.length) % focusable.length].focus();
  }

  function wireSheetDrag(host) {
    var panel = host.querySelector('.sheet');
    var startY = null;
    panel.addEventListener('pointerdown', function (event) {
      if (!event.target.closest || !event.target.closest('[data-sheet-grip]')) return;
      startY = event.clientY;
      panel.style.transition = 'none';
      if (panel.setPointerCapture) panel.setPointerCapture(event.pointerId);
    });
    panel.addEventListener('pointermove', function (event) {
      if (startY == null) return;
      panel.style.transform = 'translateY(' + Math.max(0, event.clientY - startY) + 'px)';
    });
    panel.addEventListener('pointerup', function (event) {
      if (startY == null) return;
      var moved = event.clientY - startY;
      startY = null;
      panel.style.transition = '';
      panel.style.transform = '';
      if (moved > 80) closeSheet();
    });
  }

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
    t: t,
    appName: appName,
    locale: locale,
    localeTag: localeTag,
    langName: langName,
    icon: icon,
    iconFilled: iconFilled,
    el: el,
    setHTML: setHTML,
    byId: byId,
    revealClass: revealClass,
    segmented: segmented,
    bindSegmented: bindSegmented,
    toast: toast,
    dayKey: dayKey,
    dayLabel: dayLabel,
    rowTime: rowTime,
    langBadge: langBadge,
    outputLangMeta: outputLangMeta,
    modelMeta: modelMeta,
    skeletonCard: skeletonCard,
    picker: picker,
    sheetMarkup: sheetMarkup,
    openSheet: openSheet,
    closeSheet: closeSheet,
    isSheetOpen: isSheetOpen,
    chooseFromSheet: chooseFromSheet,
    pickerAction: pickerAction,
    pickerIds: function () { return Object.keys(pickers); },
    /* The options a picker was rendered with — for tests, which cannot open a
       sheet without a real DOM. */
    pickerConfig: function (id) { return pickers[id] || null; }
  };
})(window.LINGUIST);
