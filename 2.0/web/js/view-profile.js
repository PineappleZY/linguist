/* Radicle — Profile screen: API key, model, output language, appearance, data. */

window.RADICLE = window.RADICLE || {};
window.RADICLE.views = window.RADICLE.views || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var store = ns.store;
  var CONFIG = ns.CONFIG;

  var showKey = false;
  var testState = { status: 'idle', message: '' };
  /* Keeps a typed-but-unsaved key alive across the re-renders triggered by
     Show/Hide and Test, which would otherwise reset the field. */
  var draftKey = null;

  function row(title, sub, aside) {
    return '<div class="row row-static">' +
      '<span class="row-main"><span class="row-title">' + ui.esc(title) + '</span>' +
      (sub ? '<span class="row-sub">' + ui.esc(sub) + '</span>' : '') + '</span>' +
      (aside ? '<span class="row-aside">' + aside + '</span>' : '') +
      '</div>';
  }

  function sectionHead(title) {
    return '<div class="group-label">' + ui.esc(title) + '</div>';
  }

  /* ---------- Sections ---------- */

  function accountSection(settings) {
    var html = sectionHead('Account');
    html += '<div class="list">';
    html += row('This device', 'Answers and settings stay in this browser. No account is created.');
    html += row('History', store.listHistory().length + ' entries · ' +
      store.listHistory().filter(function (item) { return item.starred; }).length + ' starred');
    html += installRow();
    html += '</div>';

    if (!store.isPersistent()) {
      html += '<div class="notice notice-warn" style="margin-top:12px">' + ui.icon('alert') + '<div>' +
        '<div class="notice-title">Storage is unavailable</div>' +
        '<div class="notice-body">This browser blocks local storage, so nothing will survive a reload.</div>' +
        '</div></div>';
    }

    if (!settings.apiKey) {
      html += '<div class="notice notice-warn" style="margin-top:12px">' + ui.icon('key') + '<div>' +
        '<div class="notice-title">Add a key to start</div>' +
        '<div class="notice-body">Radicle only works once your own DeepSeek API key is in place.</div>' +
        '</div></div>';
    }
    return html;
  }

  /* Install affordance. Chrome and Edge hand us a prompt event; iOS Safari has
     no install API at all, so it gets written instructions instead. */
  function installRow() {
    var pwa = ns.pwa;
    if (!pwa) {
      return row('Install app', 'Not available in the offline single-file build.');
    }

    var state = pwa.state();
    if (state === 'installed') {
      return row('Install app', 'Running as an installed app.', '<span class="chip chip-good">installed</span>');
    }
    if (state === 'prompt') {
      return '<div class="row row-static">' +
        '<span class="row-main"><span class="row-title">Install app</span>' +
        '<span class="row-sub">Adds Radicle to your dock, taskbar or home screen and opens it in its own window.</span>' +
        '</span>' +
        '<button type="button" class="btn btn-primary btn-sm" id="install-app">Install</button>' +
        '</div>';
    }
    if (state === 'ios') {
      return row('Install app', 'Tap Share in Safari, then “Add to Home Screen”.');
    }
    if (!pwa.secureContext()) {
      return row('Install app', 'Installation needs an https address. Open the hosted version to install.');
    }
    return row('Install app', 'Use your browser menu: Install app, or Add to Home Screen.');
  }

  function keySection(settings) {
    var value = draftKey !== null ? draftKey : settings.apiKey;
    var html = sectionHead('DeepSeek API key');
    html += '<div class="card">';
    html += '<label class="field" for="api-key"><span class="field-label">API key</span>' +
      '<span class="input-row">' +
      '<input id="api-key" class="input" type="' + (showKey ? 'text' : 'password') + '" ' +
      'value="' + ui.esc(value) + '" placeholder="sk-..." autocomplete="off" ' +
      'autocapitalize="off" spellcheck="false" aria-label="DeepSeek API key">' +
      '<button type="button" class="btn btn-sm" id="toggle-key">' + (showKey ? 'Hide' : 'Show') + '</button>' +
      '</span></label>';

    html += '<div class="notice-actions">' +
      '<button type="button" class="btn btn-primary btn-sm" id="save-key">Save key</button>' +
      '<button type="button" class="btn btn-sm" id="test-key">Test connection</button>' +
      '</div>';

    if (testState.status === 'testing') {
      html += '<p class="hint">Contacting DeepSeek…</p>';
    } else if (testState.status === 'ok') {
      html += '<p class="hint hint-good">' + ui.esc(testState.message) + '</p>';
    } else if (testState.status === 'fail') {
      html += '<p class="hint hint-danger">' + ui.esc(testState.message) + '</p>';
    } else {
      html += '<p class="hint">Stored as plain text in this browser only. Get a key at ' +
        '<a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer noopener">' +
        'platform.deepseek.com</a>.</p>';
    }
    html += '</div>';
    return html;
  }

  function modelSection(settings) {
    var html = sectionHead('Model');
    html += '<div class="card">';
    html += ui.segmented(CONFIG.models.map(function (model) {
      return { id: model.id, label: model.label.replace('DeepSeek ', '') };
    }), settings.model, 'model', true);

    var active = ui.modelMeta(settings.model);
    html += '<p class="hint">' + ui.esc(active.label) + ' — ' + ui.esc(active.hint) + '. ' +
      'Switching the model or the output language makes the next lookup of the same word regenerate.</p>';

    html += '<div class="divider"></div>';
    html += '<div class="row row-static" style="padding:0">' +
      '<span class="row-main"><span class="row-title">Extended thinking</span>' +
      '<span class="row-sub">Applies to the deep pass only. Better etymology, noticeably slower, more tokens.</span>' +
      '</span>' +
      '<button type="button" class="switch" id="thinking-switch" role="switch" aria-checked="' +
      (settings.thinking ? 'true' : 'false') + '" aria-label="Extended thinking"></button>' +
      '</div>';
    html += '</div>';
    return html;
  }

  function languageSection(settings) {
    var html = sectionHead('Output language');
    html += '<div class="card">';
    html += ui.segmented(CONFIG.outputLanguages.map(function (lang) {
      return { id: lang.id, label: lang.label };
    }), settings.outputLang, 'lang', true);
    html += '<p class="hint">Interface stays in English. Definitions, etymology and cultural notes are written in ' +
      ui.esc(ui.outputLangMeta(settings.outputLang).native) + '.</p>';
    html += '</div>';
    return html;
  }

  function appearanceSection(settings) {
    var html = sectionHead('Appearance');
    html += '<div class="card">';
    html += ui.segmented(CONFIG.themes, settings.theme, 'theme', true);
    html += '<p class="hint">Auto follows your system appearance.</p>';
    html += '</div>';
    return html;
  }

  function dataSection() {
    var rows = store.listHistory();
    var starred = rows.filter(function (item) { return item.starred; }).length;

    var html = sectionHead('Data');
    html += '<div class="card">';
    html += '<div class="notice-actions" style="margin-top:0;flex-direction:column;align-items:stretch">';
    html += '<button type="button" class="btn btn-block" id="export-data">' +
      ui.icon('download') + 'Export JSON backup</button>';
    html += '<button type="button" class="btn btn-block" id="import-data">' +
      ui.icon('upload') + 'Import backup</button>';
    html += '<button type="button" class="btn btn-block" id="clear-history">' +
      ui.icon('trash') + 'Clear history (' + (rows.length - starred) + ')</button>';
    html += '<button type="button" class="btn btn-block" id="clear-starred">' +
      ui.icon('star') + 'Clear starred (' + starred + ')</button>';
    html += '<button type="button" class="btn btn-block" id="clear-cache">' +
      ui.icon('refresh') + 'Clear app cache &amp; reload</button>';
    html += '</div>';
    html += '<p class="hint">Clearing history keeps your starred entries. Backups never contain your API key.</p>';
    html += '<p class="hint">Clear app cache unregisters the service worker and empties Cache Storage. ' +
      'Use it when the hosted build keeps serving an older version after an update.</p>';
    html += '<input type="file" id="import-file" accept="application/json,.json" hidden>';
    html += '</div>';
    return html;
  }

  function aboutSection() {
    var html = sectionHead('About');
    html += '<div class="list">';
    html += row(CONFIG.appName, CONFIG.tagline, '<span class="tiny muted-3">v' + ui.esc(CONFIG.version) + '</span>');
    html += '</div>';
    html += '<p class="hint" style="margin:12px 4px 0">' + ui.esc(CONFIG.description) + '</p>';
    html += '<p class="hint" style="margin:8px 4px 0">Answers are generated by DeepSeek from your own key. ' +
      'They can be incomplete or wrong, etymology especially — treat them as a starting point, not a citation.</p>';
    return html;
  }

  /* ---------- Screen ---------- */

  function render(container, params) {
    var settings = store.getSettings();
    var html = '';
    html += accountSection(settings);
    html += '<div style="height:16px"></div>';
    html += keySection(settings);
    html += '<div style="height:16px"></div>';
    html += modelSection(settings);
    html += '<div style="height:16px"></div>';
    html += languageSection(settings);
    html += '<div style="height:16px"></div>';
    html += appearanceSection(settings);
    html += '<div style="height:16px"></div>';
    html += dataSection();
    html += '<div style="height:16px"></div>';
    html += aboutSection();

    ui.setHTML(container, html);
    wire(container);
  }

  function currentKey() {
    var input = document.getElementById('api-key');
    return input ? input.value.trim() : store.getSettings().apiKey;
  }

  function wire(container) {
    ui.bindSegmented(container, 'model', function (next) {
      store.patchSettings({ model: next });
      ui.toast('Model set to ' + ui.modelMeta(next).label);
      ns.router.refresh();
    });

    ui.bindSegmented(container, 'lang', function (next) {
      store.patchSettings({ outputLang: next });
      ui.toast('Explanations in ' + ui.outputLangMeta(next).native);
      ns.router.refresh();
    });

    ui.bindSegmented(container, 'theme', function (next) {
      store.patchSettings({ theme: next });
      ns.applyTheme(next);
      ns.router.refresh();
    });

    var toggle = container.querySelector('#toggle-key');
    if (toggle) {
      toggle.addEventListener('click', function () {
        showKey = !showKey;
        ns.router.refresh();
      });
    }

    var install = container.querySelector('#install-app');
    if (install) {
      install.addEventListener('click', function () {
        install.disabled = true;
        ns.pwa.promptInstall().then(function (outcome) {
          if (outcome === 'accepted') ui.toast('Installing Radicle');
          else if (outcome === 'dismissed') ui.toast('Install dismissed');
          else ui.toast('Your browser did not offer an install prompt');
          ns.router.refresh();
        });
      });
    }

    var save = container.querySelector('#save-key');
    if (save) {
      save.addEventListener('click', function () {
        store.patchSettings({ apiKey: currentKey() });
        testState = { status: 'idle', message: '' };
        ui.toast(currentKey() ? 'Key saved' : 'Key cleared');
        ns.router.refresh();
      });
    }

    var keyInput = container.querySelector('#api-key');
    if (keyInput) {
      keyInput.addEventListener('input', function () { draftKey = keyInput.value; });
      keyInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          store.patchSettings({ apiKey: currentKey() });
          ui.toast('Key saved');
          ns.router.refresh();
        }
      });
    }

    var test = container.querySelector('#test-key');
    if (test) {
      test.addEventListener('click', function () {
        var key = currentKey();
        if (!key) {
          testState = { status: 'fail', message: 'Enter a key first.' };
          ns.router.refresh();
          return;
        }
        testState = { status: 'testing', message: '' };
        ns.router.refresh();
        ns.api.testConnection({ apiKey: key, model: store.getSettings().model })
          .then(function (result) {
            store.patchSettings({ apiKey: key });
            testState = { status: 'ok', message: 'Connection works. The model replied "' + (result.sample || 'ok') + '".' };
            ns.router.refresh();
          })
          .catch(function (err) {
            testState = { status: 'fail', message: err.message + (err.detail ? ' (' + err.detail + ')' : '') };
            ns.router.refresh();
          });
      });
    }

    var thinking = container.querySelector('#thinking-switch');
    if (thinking) {
      thinking.addEventListener('click', function () {
        var next = thinking.getAttribute('aria-checked') !== 'true';
        thinking.setAttribute('aria-checked', next ? 'true' : 'false');
        store.patchSettings({ thinking: next });
        ui.toast(next ? 'Extended thinking on' : 'Extended thinking off');
      });
    }

    var exportBtn = container.querySelector('#export-data');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        try {
          var payload = JSON.stringify(store.exportAll(), null, 2);
          var blob = new Blob([payload], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = url;
          link.download = CONFIG.appName.toLowerCase() + '-backup-' +
            new Date().toISOString().slice(0, 10) + '.json';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
          ui.toast('Backup exported');
        } catch (err) {
          ui.toast('Export failed: ' + err.message);
        }
      });
    }

    var importBtn = container.querySelector('#import-data');
    var importFile = container.querySelector('#import-file');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', function () { importFile.click(); });
      importFile.addEventListener('change', function () {
        var file = importFile.files && importFile.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var restored = store.importAll(JSON.parse(String(reader.result)));
            ui.toast('Restored ' + restored + ' entries');
            testState = { status: 'idle', message: '' };
            ns.router.refresh();
          } catch (err) {
            ui.toast('Import failed: ' + err.message);
          }
        };
        reader.onerror = function () { ui.toast('Could not read that file'); };
        reader.readAsText(file);
      });
    }

    var clearHistory = container.querySelector('#clear-history');
    if (clearHistory) {
      clearHistory.addEventListener('click', function () {
        if (!window.confirm('Delete every unstarred entry? Starred entries are kept.')) return;
        store.clearHistory();
        ui.toast('History cleared');
        ns.router.refresh();
      });
    }

    var clearStarred = container.querySelector('#clear-starred');
    if (clearStarred) {
      clearStarred.addEventListener('click', function () {
        if (!window.confirm('Remove every star? The entries themselves stay in history.')) return;
        store.clearStarred();
        ui.toast('Stars cleared');
        ns.router.refresh();
      });
    }

    var clearCache = container.querySelector('#clear-cache');
    if (clearCache) {
      clearCache.addEventListener('click', function () {
        if (!window.confirm('Unregister the service worker and empty the cache, then reload?')) return;
        clearCacheAndReload();
      });
    }
  }

  /* Escape hatch for the development loop: a registered service worker will
     happily keep serving yesterday's shell until its version constant changes. */
  function clearCacheAndReload() {
    var jobs = [];
    if (window.caches && typeof window.caches.keys === 'function') {
      jobs.push(window.caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) { return window.caches.delete(key); }));
      }));
    }
    if (window.navigator.serviceWorker && typeof window.navigator.serviceWorker.getRegistrations === 'function') {
      jobs.push(window.navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (reg) { return reg.unregister(); }));
      }));
    }
    var reload = function () { location.reload(); };
    Promise.all(jobs).then(reload, reload);
  }

  ns.views.profile = {
    topbar: function () {
      return { title: 'Profile', sub: '' };
    },
    render: render
  };
})(window.RADICLE);
