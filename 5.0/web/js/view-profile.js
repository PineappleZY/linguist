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
    var html = sectionHead(ui.t('profile.section.account'));
    html += '<div class="list">';
    html += row(ui.t('profile.device.title'), ui.t('profile.device.text'));
    html += row(ui.t('profile.history.title'), ui.t('profile.history.sub', {
      n: store.listHistory().length,
      m: store.listHistory().filter(function (item) { return item.starred; }).length
    }));
    html += installRow();
    html += '</div>';

    if (!store.isPersistent()) {
      html += '<div class="notice notice-warn" style="margin-top:12px">' + ui.icon('alert') + '<div>' +
        '<div class="notice-title">' + ui.esc(ui.t('profile.storageUnavailable.title')) + '</div>' +
        '<div class="notice-body">' + ui.esc(ui.t('profile.storageUnavailable.text')) + '</div>' +
        '</div></div>';
    }

    if (!settings.apiKey) {
      html += '<div class="notice notice-warn" style="margin-top:12px">' + ui.icon('key') + '<div>' +
        '<div class="notice-title">' + ui.esc(ui.t('profile.noKey.title')) + '</div>' +
        '<div class="notice-body">' + ui.esc(ui.t('profile.noKey.text')) + '</div>' +
        '</div></div>';
    }
    return html;
  }

  /* Install affordance. Chrome and Edge hand us a prompt event; iOS Safari has
     no install API at all, so it gets written instructions instead. */
  function installRow() {
    var pwa = ns.pwa;
    if (!pwa) {
      return row(ui.t('profile.install'), ui.t('profile.install.offline'));
    }

    var state = pwa.state();
    if (state === 'installed') {
      return row(ui.t('profile.install'), ui.t('profile.install.installed'),
      '<span class="chip chip-good">' + ui.esc(ui.t('profile.install.chip')) + '</span>');
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
      return row(ui.t('profile.install'), ui.t('profile.install.ios'));
    }
    if (!pwa.secureContext()) {
      return row(ui.t('profile.install'), ui.t('profile.install.needsHttps'));
    }
    return row(ui.t('profile.install'), ui.t('profile.install.menu'));
  }

  function keySection(settings) {
    var value = draftKey !== null ? draftKey : settings.apiKey;
    var html = sectionHead(ui.t('profile.section.key'));
    html += '<div class="card">';
    html += '<label class="field" for="api-key"><span class="field-label">API key</span>' +
      '<span class="input-row">' +
      '<input id="api-key" class="input" type="' + (showKey ? 'text' : 'password') + '" ' +
      'value="' + ui.esc(value) + '" placeholder="' + ui.esc(ui.t('profile.key.placeholder')) + '" autocomplete="off" ' +
      'autocapitalize="off" spellcheck="false" aria-label="' + ui.esc(ui.t('dict.key.label')) + '">' +
      '<button type="button" class="btn btn-sm" id="toggle-key">' + (showKey ? 'Hide' : 'Show') + '</button>' +
      '</span></label>';

    html += '<div class="notice-actions">' +
      '<button type="button" class="btn btn-primary btn-sm" id="save-key">Save key</button>' +
      '<button type="button" class="btn btn-sm" id="test-key">Test connection</button>' +
      '</div>';

    if (testState.status === 'testing') {
      html += '<p class="hint">' + ui.esc(ui.t('profile.key.testing')) + '</p>';
    } else if (testState.status === 'ok') {
      html += '<p class="hint hint-good">' + ui.esc(testState.message) + '</p>';
    } else if (testState.status === 'fail') {
      html += '<p class="hint hint-danger">' + ui.esc(testState.message) + '</p>';
    } else {
      html += '<p class="hint">' + ui.esc(ui.t('profile.key.hint')) +
        '<a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer noopener">' +
        'platform.deepseek.com</a>.</p>';
    }
    html += '</div>';
    return html;
  }

  function modelSection(settings) {
    var html = sectionHead(ui.t('profile.section.model'));
    html += '<div class="card">';
    html += ui.segmented(CONFIG.models.map(function (model) {
      return { id: model.id, label: model.label.replace('DeepSeek ', '') };
    }), settings.model, 'model', true);

    var active = ui.modelMeta(settings.model);
    html += '<p class="hint">' + ui.esc(active.label) + ' — ' + ui.esc(active.hint) + '. ' +
      'Switching the model or the explanation language makes the next lookup of the same word regenerate.</p>';
    html += '</div>';
    return html;
  }

  /* One row per source language: what a word in that language is explained in.
     Looking up an English word can explain it in English; a Japanese word can
     explain it in Chinese. The interface language is a separate axis and lives
     in Appearance. */
  function languageSection(settings) {
    var html = sectionHead(ui.t('profile.section.explanation'));
    html += '<div class="card"><div class="settings-table">';
    CONFIG.queryLanguages.forEach(function (source) {
      var current = settings.outputLangBySource[source.id] || settings.outputLang;
      html += '<div class="settings-row">' +
        '<span class="settings-key">' + ui.esc(source.native) + '</span>' +
        ui.picker({
          id: 'out-lang-' + source.id,
          value: current,
          compact: true,
          label: 'Explanation language for ' + source.label,
          title: source.native,
          options: CONFIG.outputLanguages.map(function (lang) {
            return { id: lang.id, label: lang.native };
          }),
          onPick: function (next) {
            var table = store.getSettings().outputLangBySource;
            table[source.id] = next;
            store.patchSettings({ outputLangBySource: table });
            ui.toast(source.native + ' → ' + ui.outputLangMeta(next).native);
            ns.router.refresh();
          }
        }) + '</div>';
    });
    html += '</div>';
    html += '<p class="hint">' + ui.esc(ui.t('profile.explanation.hint')) + '</p>';
    html += '</div>';
    return html;
  }

  function appearanceSection(settings) {
    var html = sectionHead(ui.t('profile.section.appearance'));
    html += '<div class="card">';
    html += ui.segmented(CONFIG.themes, settings.theme, 'theme', true);
    html += '<p class="hint">' + ui.esc(ui.t('profile.appearance.hint')) + '</p>';
    html += '</div>';

    /* The interface language. Separate from the explanation language above:
       this one changes the buttons, that one changes what the model writes. */
    html += '<div class="card" style="margin-top:12px">';
    html += '<div class="settings-row"><span class="settings-key">' +
      ui.esc(ui.t('profile.uiLang')) + '</span>' +
      ui.picker({
        id: 'ui-lang',
        value: settings.uiLang,
        compact: true,
        label: ui.t('profile.uiLang'),
        title: ui.t('profile.uiLang'),
        options: [{ id: 'auto', label: ui.t('profile.uiLang.auto') }].concat(
          CONFIG.queryLanguages.map(function (lang) {
            return { id: lang.id, label: lang.native };
          })),
        onPick: function (next) {
          store.patchSettings({ uiLang: next });
          if (ns.applyLang) ns.applyLang();
          ns.router.refresh();
        }
      }) + '</div>';
    html += '<p class="hint">' + ui.esc(ui.t('profile.uiLang.hint')) + '</p>';
    html += '</div>';
    return html;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /* A tappable row rather than a button, so the two risk levels can look as
     different as they are. */
  function actionRow(id, label, sub, danger) {
    return '<button type="button" class="row" id="' + ui.esc(id) + '"' +
      (danger ? ' data-danger="1"' : '') + '>' +
      '<span class="row-main"><span class="row-title">' + ui.esc(label) + '</span>' +
      (sub ? '<span class="row-sub">' + ui.esc(sub) + '</span>' : '') + '</span>' +
      '<span class="row-aside">' + ui.icon('chevron') + '</span></button>';
  }

  /* Split by risk, not by kind. Backups are routine; erasing data is not, and
     the two should not sit at the same visual weight. */
  function dataSection() {
    var rows = store.listHistory();
    var unstarred = rows.filter(function (item) { return !item.starred; }).length;
    var starred = rows.filter(function (item) { return item.starred; }).length;
    /* An older version folder may still hold data; offering the import here
       means it does not matter whether the first-run prompt was declined. */
    var source = store.importableSource();

    var report = store.storageReport();
    var html = sectionHead(ui.t('profile.section.storage'));
    html += '<div class="list">' +
      row(ui.t('profile.storage.entries', { n: report.entries }),
        unstarred ? ui.t('profile.storage.unstarred', { n: unstarred }) : '',
        report.bytes >= 0 ? ui.t('profile.storage.size', { size: formatBytes(report.bytes) })
          : ui.t('profile.storage.sizeUnknown')) +
      (unstarred ? actionRow('prune-old', ui.t('profile.storage.prune'),
        ui.t('profile.storage.pruneHint'), true) : '') +
      '</div>';
    html += '<p class="hint">' + ui.esc(ui.t('profile.storage.hint')) + '</p>';

    html += sectionHead(ui.t('profile.section.backup'));
    html += '<div class="list">' +
      actionRow('export-data', ui.t('profile.backup.export'), ui.t('profile.backup.exportHint')) +
      actionRow('import-data', ui.t('profile.backup.import'), ui.t('profile.backup.importHint')) +
      (source ? actionRow('import-old', ui.t('profile.backup.old', { version: source.label }),
        ui.t('profile.backup.oldHint')) : '') +
      '</div>';
    html += '<p class="hint">' + ui.esc(ui.t('profile.backup.neverKey')) + '</p>';

    html += sectionHead(ui.t('profile.section.reset'));
    html += '<div class="list is-danger">' +
      actionRow('clear-history', ui.t('profile.reset.clearHistory'),
        ui.t('profile.reset.clearHistoryHint', { n: unstarred }), true) +
      actionRow('clear-starred', ui.t('profile.reset.clearStars'),
        ui.t('profile.reset.clearStarsHint', { n: starred }), true) +
      actionRow('clear-cache', ui.t('profile.reset.clearCache'),
        ui.t('profile.reset.clearCacheHint'), true) +
      '</div>';
    html += '<p class="hint">' + ui.esc(ui.t('profile.reset.clearCacheHint2')) + '</p>';
    html += '<input type="file" id="import-file" accept="application/json,.json" hidden>';
    return html;
  }

  function aboutSection() {
    var html = sectionHead(ui.t('profile.section.about'));
    html += '<div class="list">';
    html += row(CONFIG.appName, CONFIG.tagline, '<span class="tiny muted-3">v' + ui.esc(CONFIG.version) + '</span>');
    html += actionRow('show-tour', ui.t('profile.showTour'), '');
    html += '</div>';
    html += '<p class="hint" style="margin:12px 4px 0">' + ui.esc(CONFIG.description) + '</p>';
    html += '<p class="hint" style="margin:8px 4px 0">' + ui.esc(ui.t('profile.about.disclaimer')) + '</p>';
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
      ui.toast(ui.t('profile.model.set', { model: ui.modelMeta(next).label }));
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
          if (outcome === 'accepted') ui.toast(ui.t('profile.install.accepted', { app: CONFIG.appName }));
          else if (outcome === 'dismissed') ui.toast(ui.t('profile.install.dismissed'));
          else ui.toast(ui.t('profile.install.unavailable'));
          ns.router.refresh();
        });
      });
    }

    var save = container.querySelector('#save-key');
    if (save) {
      save.addEventListener('click', function () {
        store.patchSettings({ apiKey: currentKey() });
        testState = { status: 'idle', message: '' };
        ui.toast(ui.t(currentKey() ? 'profile.key.saved' : 'profile.key.cleared'));
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
          ui.toast(ui.t('profile.key.saved'));
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
          ui.toast(ui.t('profile.backup.exported'));
        } catch (err) {
          ui.toast(ui.t('profile.backup.exportFailed', { message: err.message }));
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
            ui.toast(ui.t('profile.backup.restored', { n: restored }));
            testState = { status: 'idle', message: '' };
            ns.router.refresh();
          } catch (err) {
            ui.toast(ui.t('profile.backup.importFailed', { message: err.message }));
          }
        };
        reader.onerror = function () { ui.toast(ui.t('profile.backup.readFailed')); };
        reader.readAsText(file);
      });
    }

    var clearHistory = container.querySelector('#clear-history');
    if (clearHistory) {
      clearHistory.addEventListener('click', function () {
        if (!window.confirm(ui.t('profile.reset.clearHistoryConfirm'))) return;
        store.clearHistory();
        ui.toast(ui.t('profile.reset.historyCleared'));
        ns.router.refresh();
      });
    }

    var clearStarred = container.querySelector('#clear-starred');
    if (clearStarred) {
      clearStarred.addEventListener('click', function () {
        /* The confirm has to describe what actually happens: the entries do
           stay, and the wordbooks do not survive, because membership implies
           starred. */
        if (!window.confirm(ui.t('profile.reset.clearStarsConfirm'))) return;
        store.clearStarred();
        ui.toast(ui.t('profile.reset.starsCleared'));
        ns.router.refresh();
      });
    }

    var importOld = container.querySelector('#import-old');
    if (importOld) {
      importOld.addEventListener('click', function () {
        var source = store.importableSource();
        if (!source) { ui.toast(ui.t('profile.import.available')); ns.router.refresh(); return; }
        if (!window.confirm(ui.t('profile.import.confirm', { version: source.label }))) return;
        var result = ns.importFromVersion(source);
        ui.toast(result.entries ? ui.t('profile.import.imported', { n: result.entries }) : ui.t('profile.import.nothing'));
        ns.router.refresh();
      });
    }

    var clearCache = container.querySelector('#clear-cache');
    if (clearCache) {
      clearCache.addEventListener('click', function () {
        if (!window.confirm(ui.t('profile.reset.clearCacheConfirm'))) return;
        clearCacheAndReload();
      });
    }

    var pruneOld = container.querySelector('#prune-old');
    if (pruneOld) {
      pruneOld.addEventListener('click', function () {
        var removed = store.pruneOldest(Math.max(0, store.listHistory().length - 200));
        ui.toast(removed ? ui.t('profile.storage.pruned', { n: removed }) : ui.t('profile.storage.pruneNone'));
        ns.router.refresh();
      });
    }

    var showTour = container.querySelector('#show-tour');
    if (showTour) {
      showTour.addEventListener('click', function () {
        location.hash = '#/dictionary';
        /* The dictionary screen has to exist before a spotlight can point at
           anything on it. */
        window.setTimeout(function () { if (ns.tour) ns.tour.start(); }, 0);
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
