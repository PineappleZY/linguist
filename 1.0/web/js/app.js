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

  function parseRoute() {
    var hash = location.hash || '#/dictionary';
    var word = /^#\/word\/(.+)$/.exec(hash);
    if (word) return { name: 'word', tab: 'dictionary', params: { id: decodeURIComponent(word[1]) } };
    if (hash.indexOf('#/profile') === 0) return { name: 'profile', tab: 'profile', params: {} };
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

    if (!meta.back && route.name !== 'profile') {
      html += '<button type="button" class="icon-btn" id="topbar-settings" aria-label="Profile">' +
        ui.icon('person') + '</button>';
    }

    html += '</div>';
    ui.setHTML(topbar, html);

    var back = topbar.querySelector('#topbar-back');
    if (back) {
      back.addEventListener('click', function () {
        if (history.length > 1) history.back();
        else location.hash = '#/dictionary';
      });
    }

    var settings = topbar.querySelector('#topbar-settings');
    if (settings) {
      settings.addEventListener('click', function () { location.hash = '#/profile'; });
    }
  }

  function renderTabbar(route) {
    var tabbar = ui.byId('tabbar');
    if (!tabbar) return;

    var tabs = [
      { id: 'dictionary', label: 'Dictionary', icon: 'book', hash: '#/dictionary' },
      { id: 'profile', label: 'Profile', icon: 'person', hash: '#/profile' }
    ];

    var html = tabs.map(function (tab) {
      var current = tab.id === route.tab;
      return '<button type="button" class="tab" data-tab="' + tab.id + '"' +
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
        location.hash = id === 'profile' ? '#/profile' : '#/dictionary';
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
