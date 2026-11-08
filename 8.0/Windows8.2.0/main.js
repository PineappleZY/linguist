/* Linguist 8.2.0 — Electron desktop shell.

   The offline, single-file web application is loaded through a stable custom
   origin so localStorage remains available after installation and upgrades. */

'use strict';

const { app, BrowserWindow, Menu, dialog, shell, session, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const EXPECTED_VERSION = '8.2.0';
const SMOKE = process.argv.includes('--smoke-test');
const SMOKE_KEY = 'linguist.smoke.last';
const SCHEME = 'linguist';
const APP_URL = `${SCHEME}://app/index.html`;
const APP_FILE = path.join(__dirname, 'app', `linguist_${EXPECTED_VERSION}.html`);

app.setName('Linguist');
app.setAppUserModelId('app.linguist.dictionary');
app.disableHardwareAcceleration();

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

let mainWindow = null;

if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(start);
}

function start() {
  installMenu();
  installProtocol();

  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });

  mainWindow = createWindow(SMOKE);
}

function installMenu() {
  const template = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function installProtocol() {
  protocol.handle(SCHEME, () => {
    try {
      const html = fs.readFileSync(APP_FILE);
      return new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });
    } catch (error) {
      return new Response(
        `Linguist could not read its application file.\n\n${APP_FILE}\n\n${error.message}`,
        {
          status: 500,
          headers: { 'content-type': 'text/plain; charset=utf-8' }
        }
      );
    }
  });
}

function createWindow(hidden) {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    show: !hidden,
    backgroundColor: '#faf9f7',
    autoHideMenuBar: true,
    title: 'Linguist 8.2.0',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  });

  win.setMenuBarVisibility(false);

  const openExternal = (url) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
  };

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${SCHEME}://`)) return;
    event.preventDefault();
    openExternal(url);
  });

  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame === false || SMOKE) return;
    dialog.showErrorBox(
      'Linguist could not start',
      `${description} (${code})\n${url}\n\n${APP_FILE}`
    );
  });

  if (SMOKE) runSmokeTest(win);
  win.loadURL(APP_URL);
  return win;
}

function runSmokeTest(win) {
  let finished = false;
  const resultFile = path.join(app.getPath('temp'), `linguist-${EXPECTED_VERSION}-smoke.json`);
  const timer = setTimeout(() => finish(1, 'smoke: timeout after 30s'), 30000);

  function finish(code, message) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    console.log(message);
    app.exit(code);
  }

  win.webContents.once('did-fail-load', (_event, code, description) => {
    finish(1, `smoke: load failed ${code} ${description}`);
  });

  win.webContents.once('did-finish-load', async () => {
    try {
      const info = await win.webContents.executeJavaScript(
        '(() => {' +
        `  const key = ${JSON.stringify(SMOKE_KEY)};` +
        '  const current = String(Date.now());' +
        '  localStorage.setItem(key, current);' +
        '  return {' +
        '    version: window.LINGUIST && window.LINGUIST.CONFIG && window.LINGUIST.CONFIG.version,' +
        '    title: document.title,' +
        '    ready: document.readyState,' +
        '    hasAppRoot: !!document.querySelector("#app, #root, main"),' +
        '    modules: ["ui", "store", "practice"].filter(function (name) {' +
        '      return !!(window.LINGUIST && window.LINGUIST[name]);' +
        '    }).length,' +
        '    storageRoundTrip: localStorage.getItem(key) === current' +
        '  };' +
        '})()'
      );
      const ok = !!info
        && info.version === EXPECTED_VERSION
        && info.ready === 'complete'
        && info.hasAppRoot
        && info.modules === 3
        && info.storageRoundTrip;
      fs.writeFileSync(resultFile, JSON.stringify({
        ok,
        expectedVersion: EXPECTED_VERSION,
        ...info,
        packaged: app.isPackaged,
        arch: process.arch,
        at: new Date().toISOString()
      }, null, 2));
      console.log('smoke:', JSON.stringify(info));
      finish(ok ? 0 : 1, ok ? 'smoke: ok' : 'smoke: unexpected app state');
    } catch (error) {
      finish(1, `smoke: ${error && error.message ? error.message : error}`);
    }
  });
}

app.on('window-all-closed', () => {
  app.quit();
});
