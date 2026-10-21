/* Radicle — shell: hash router, top bar, tab bar, theme, bootstrap. */

window.RADICLE = window.RADICLE || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var store = ns.store;
  var CONFIG = ns.CONFIG;

  /* ---------- Theme ---------- */

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'auto');
  }

  ns.applyTheme = applyTheme;

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

    var meta = view.topbar ? view.topbar(route.params) : { title: CONFIG.appName, sub: '' };
    var title = meta.title || CONFIG.appName;
    var html = '<div class="topbar-inner">';

    if (meta.back) {
      html += '<button type="button" class="icon-btn topbar-back" id="topbar-back" ' +
        'aria-label="Back">' + ui.icon('back') + '</button>';
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

    var html = tabs.map(function (tab) {
      var current = tab.id === route.tab;
      return '<button type="button" class="tab" data-tab="' + ui.esc(tab.id) + '"' +
        ' data-hash="' + ui.esc(tab.hash) + '"' +
        (current ? ' aria-current="page"' : '') + '>' +
        ui.icon(tab.icon) +
        '<span class="tab-label">' + ui.esc(tab.label) + '</span>' +
        '</button>';
    }).join('');

    ui.setHTML(tabbar, html);

    tabbar.querySelectorAll('[data-tab]').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = button.getAttribute('data-tab');
        if (id === route.tab) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          if (id === 'dictionary') {
            ns.session.focusSearch = true;
            refresh();
          }
          return;
        }
        /* The destination comes from the tab itself. Hard-coding it here is how
           Favourites ended up being unreachable: the button existed, carried a
           hash, and the handler ignored it. */
        var target = button.getAttribute('data-hash');
        if (target) location.hash = target;
      });
    });
  }

  function refresh() {
    var route = parseRoute();
    var view = ns.views[route.name] || ns.views.dictionary;
    var screen = ui.byId('screen');

    renderTopbar(view, route);
    renderTabbar(route);

    document.title = route.name === 'dictionary'
      ? CONFIG.appName + ' — ' + CONFIG.tagline
      : CONFIG.appName;

    if (screen) view.render(screen, route.params);
    document.body.setAttribute('data-route', route.name);
  }

  ns.router = { refresh: refresh, go: function (hash) { location.hash = hash; } };

  /* The tab bar is the only navigation between the three screens, so each tab's
     hash has to resolve back to that tab. Exposed so this stays checked — a
     handler that hard-codes destinations is exactly how a tab becomes
     unreachable without any test noticing. */
  ns.router.tabs = [
    { id: 'dictionary', label: 'Dictionary', icon: 'book', hash: '#/dictionary' },
    { id: 'favorites', label: 'Favourites', icon: 'star', hash: '#/favorites' },
    { id: 'profile', label: 'Profile', icon: 'person', hash: '#/profile' }
  ];
  ns.router.parse = parseRoute;

  /* ---------- Bootstrap ---------- */

  function boot() {
    var settings = store.getSettings();
    applyTheme(settings.theme);
    if (!location.hash) location.replace('#/dictionary');

    /* Absent in the offline single-file build, where service workers cannot
       run at all. */
    if (ns.pwa) ns.pwa.init();

    window.addEventListener('hashchange', function () {
      window.scrollTo({ top: 0 });
      refresh();
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.RADICLE);
