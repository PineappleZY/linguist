/* Linguist — shell: hash router, top bar, tab bar, theme, bootstrap. */

window.LINGUIST = window.LINGUIST || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var store = ns.store;
  var CONFIG = ns.CONFIG;

  /* ---------- Theme ---------- */

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'auto');
  }

  /* The document's language, so the browser hyphenates, quotes and reads the
     page out in the language it is actually written in. */
  function applyLang() {
    document.documentElement.setAttribute('lang', ui.locale());
  }

  ns.applyTheme = applyTheme;
  ns.applyLang = applyLang;

  /* ---------- Routing ---------- */

  /* Takes an optional hash so the mapping can be checked without moving the
     browser; falls back to the real one. */
  function parseRoute(hashArg) {
    var hash = hashArg || location.hash || '#/dictionary';
    var word = /^#\/word\/(.+)$/.exec(hash);
    if (word) return { name: 'word', tab: 'dictionary', params: { id: decodeURIComponent(word[1]) } };
    if (hash.indexOf('#/profile') === 0) return { name: 'profile', tab: 'profile', params: {} };
    if (hash.indexOf('#/favorites') === 0) return { name: 'favorites', tab: 'favorites', params: {} };
    return { name: 'dictionary', tab: 'dictionary', params: {} };
  }

  function renderTopbar(view, route) {
    var topbar = ui.byId('topbar');
    if (!topbar) return;

    var meta = view.topbar ? view.topbar(route.params) : { title: ui.appName(), sub: '' };
    var title = meta.title || ui.appName();
    var html = '<div class="topbar-inner">';

    if (meta.back) {
      html += '<button type="button" class="icon-btn topbar-back" id="topbar-back" ' +
        'aria-label="' + ui.esc(ui.t('common.back')) + '">' + ui.icon('back') + '</button>';
    }

    html += '<div><div class="topbar-title">' + ui.esc(title) + '</div>';
    if (meta.sub) html += '<div class="topbar-sub">' + ui.esc(meta.sub) + '</div>';
    html += '</div><span class="topbar-spacer"></span>';

    html += '</div>';
    ui.setHTML(topbar, html);

    var back = topbar.querySelector('#topbar-back');
    if (back) {
      back.addEventListener('click', function () {
        if (history.length > 1) history.back();
        else location.hash = '#/dictionary';
      });
    }

  }

  function renderTabbar(route) {
    var tabbar = ui.byId('tabbar');
    if (!tabbar) return;

    /* One definition, shared with the exported list the tests check. */
    var tabs = ns.router.tabs;

    /* Real links, not buttons: the tab bar is navigation, so it should be
       focusable, middle-clickable and copyable like any other link. */
    var html = tabs.map(function (tab) {
      var current = tab.id === route.tab;
      return '<a class="tab" data-tab="' + ui.esc(tab.id) + '" href="' + ui.esc(tab.hash) + '"' +
        (current ? ' aria-current="page"' : '') + '>' +
        ui.icon(tab.icon) +
        '<span class="tab-label">' + ui.esc(ui.t(tab.labelKey)) + '</span>' +
        '</a>';
    }).join('');

    ui.setHTML(tabbar, html);

    tabbar.querySelectorAll('[data-tab]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        var id = link.getAttribute('data-tab');
        /* Tapping the tab you are already on is a "take me back to the top",
           which the browser will not do for a link to the same hash. */
        if (id !== route.tab) return;
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (id === 'dictionary') {
          ns.session.focusSearch = true;
          refresh();
        }
      });
    });
  }

  function refresh() {
    var route = parseRoute();
    var view = ns.views[route.name] || ns.views.dictionary;
    var screen = ui.byId('screen');

    /* Turning the page on an entry cancels whatever it still had in flight.
       Without this, leaving a word mid-lookup kept the requests running and
       the results then landed under a different screen's state. */
    if (route.name !== 'word' && ns.views.word && ns.views.word.leave) ns.views.word.leave();
    /* Rows unstarred on the Starred screen keep their place only for that
       visit: leaving is what makes them disappear. */
    if (route.name !== 'favorites' && ns.views.favorites && ns.views.favorites.leave) {
      ns.views.favorites.leave();
    }

    renderTopbar(view, route);
    renderTabbar(route);

    /* The document's title is the app's name in the interface language: a
       bookmark, a taskbar entry and a browser tab all show it. */
    document.title = route.name === 'dictionary'
      ? ui.appName() + ' — ' + ui.t('app.tagline')
      : ui.appName();

    if (screen) view.render(screen, route.params);
    document.body.setAttribute('data-route', route.name);
  }

  /* Where the page was, per route. Coming back from a long entry used to drop
     the reader at the top of the history they were just reading. */
  var routeScroll = {};
  var lastHash = null;

  function onHashChange() {
    if (lastHash !== null) routeScroll[lastHash] = window.scrollY || 0;
    lastHash = location.hash;
    refresh();
    var restore = routeScroll[lastHash] || 0;
    /* After the paint: the new screen has to exist before it can be scrolled. */
    window.setTimeout(function () { window.scrollTo({ top: restore }); }, 0);
  }

  ns.router = { refresh: refresh, go: function (hash) { location.hash = hash; } };

  /* The tab bar is the only navigation between the three screens, so each tab's
     hash has to resolve back to that tab. Exposed so this stays checked — a
     handler that hard-codes destinations is exactly how a tab becomes
     unreachable without any test noticing. */
  ns.router.tabs = [
    { id: 'dictionary', labelKey: 'nav.dictionary', icon: 'book', hash: '#/dictionary' },
    { id: 'favorites', labelKey: 'nav.starred', icon: 'star', hash: '#/favorites' },
    { id: 'profile', labelKey: 'nav.profile', icon: 'person', hash: '#/profile' }
  ];
  ns.router.parse = parseRoute;

  /* ---------- Bootstrap ---------- */

  /* One import path, shared by the first-run prompt and by Profile. It reads
     the older version's storage once, re-keys every entry with the current id
     scheme (which is also what de-duplicates the rows that Auto and a pinned
     language used to write separately), and never writes to the source. */
  ns.importFromVersion = function (source) {
    var result = store.importFrom(source.prefix);
    store.markImported(source.label);
    /* Carry the choices a returning user already made rather than resetting
       them to this version's defaults. */
    var seed = result.settings || {};
    var patch = {};
    ['outputLang', 'model', 'theme'].forEach(function (key) {
      if (seed[key]) patch[key] = seed[key];
    });
    if (ns.settingsFromImport) patch = ns.settingsFromImport(seed, patch);
    if (Object.keys(patch).length) store.patchSettings(patch);
    return result;
  };

  function boot() {
    var settings = store.getSettings();
    applyTheme(settings.theme);
    applyLang();
    if (!location.hash) location.replace('#/dictionary');

    /* Absent in the offline single-file build, where service workers cannot
       run at all. */
    if (ns.pwa) ns.pwa.init();

    lastHash = location.hash;
    window.addEventListener('hashchange', onHashChange);

    /* One delegated listener for every picker in the app: the views describe
       their controls while rendering, and this opens the matching sheet. It
       lives on the document so it survives the full-screen re-render. */
    document.addEventListener('click', function (event) {
      var trigger = event.target && event.target.closest ? event.target.closest('[data-picker]') : null;
      if (!trigger) return;
      event.preventDefault();
      ui.openSheet(trigger.getAttribute('data-picker'));
    });

    if (window.matchMedia) {
      var query = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        if (store.getSettings().theme === 'auto') applyTheme('auto');
      };
      if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange);
      else if (typeof query.addListener === 'function') query.addListener(onChange);
    }

    refresh();

    /* An older version folder may be sitting next to this one. Ask once — even
       a no is recorded, so the prompt never comes back — and do it after the
       first paint so the app is on screen behind the dialog. */
    var source = store.importableSource();
    if (source && !store.importedAlready()) {
      window.setTimeout(function () {
        var wanted = window.confirm(ui.t('profile.importFirstRun', {
          version: source.label, app: ui.appName(), current: CONFIG.version }));
        if (!wanted) {
          store.markImported(source.label);
          if (ns.tour) ns.tour.maybeStart();
          return;
        }
        var result = ns.importFromVersion(source);
        ui.toast(result.entries
          ? ui.t('profile.import.imported', { n: result.entries })
          : ui.t('profile.import.nothing'));
        applyTheme(store.getSettings().theme);
        refresh();
        if (ns.tour) ns.tour.maybeStart();
      }, 0);
    } else if (ns.tour) {
      /* No data to import: the tour is the first thing a newcomer sees. */
      window.setTimeout(function () { ns.tour.maybeStart(); }, 0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.LINGUIST);
