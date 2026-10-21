/* Linguist 6.5 — Electron shell.

   The shell is deliberately thin: one BrowserWindow loads the same offline
   single-file build that ships in 6.0/dist. No Node integration, no preload,
   no IPC. The custom `linguist://app` protocol gives the page a stable origin,
   so localStorage survives even when the portable exe unpacks to a different
   temporary directory on every run. */

'use strict';

const { app, BrowserWindow, Menu, dialog, shell, session, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SMOKE = process.argv.includes('--smoke-test');
const CLEAN = process.argv.includes('--smoke-clean');
const SMOKE_KEY = 'linguist.smoke.last';
const SCHEME = 'linguist';
const APP_URL = `${SCHEME}://app/index.html`;
const APP_FILE = path.join(__dirname, 'app', 'linguist_6.5.0.html');

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

if (!SMOKE && !CLEAN && !app.requestSingleInstanceLock()) {
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

  if (SMOKE) {
    mainWindow = createWindow(true, runSmokeTest);
  } else if (CLEAN) {
    mainWindow = createWindow(true, runSmokeClean);
  } else {
    mainWindow = createWindow(false);
  }
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

function createWindow(hidden, onReady) {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    show: !hidden,
    backgroundColor: '#faf9f7',
    autoHideMenuBar: true,
    title: 'Linguist',
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
    if (url.startsWith(`${SCHEME}://`) || url.startsWith('file://')) return;
    event.preventDefault();
    openExternal(url);
  });

  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame === false || SMOKE || CLEAN) return;
    dialog.showErrorBox(
      'Linguist could not start',
      `${description} (${code})\n${url}\n\n${APP_FILE}`
    );
  });

  if (typeof onReady === 'function') onReady(win);

  win.loadURL(APP_URL);
  return win;
}

function runSmokeTest(win) {
  let finished = false;
  const resultFile = path.join(app.getPath('temp'), 'linguist-smoke.json');
  const timer = setTimeout(() => finish(1, 'smoke: timeout after 30s'), 30000);

  function finish(code, message) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    try {
      const current = fs.existsSync(resultFile)
        ? JSON.parse(fs.readFileSync(resultFile, 'utf8'))
        : {};
      fs.writeFileSync(resultFile, JSON.stringify({
        ...current,
        ok: code === 0,
        message,
        packaged: app.isPackaged,
        arch: process.arch,
        at: new Date().toISOString()
      }, null, 2));
    } catch (error) {
      console.error('smoke: could not write result file', error.message);
    }
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
        '  const previous = localStorage.getItem(key);' +
        '  const current = String(Date.now());' +
        '  localStorage.setItem(key, current);' +
        '  return {' +
        '    version: window.LINGUIST && window.LINGUIST.CONFIG && window.LINGUIST.CONFIG.version,' +
        '    title: document.title,' +
        '    modules: ["ui", "store", "practice"].filter(function (name) {' +
        '      return !!(window.LINGUIST && window.LINGUIST[name]);' +
        '    }).length,' +
        '    previous: previous,' +
        '    current: current' +
        '  };' +
        '})()'
      );
      console.log('smoke:', JSON.stringify(info));
      const ok = !!info && info.version === '6.5.0' && info.modules === 3;
      fs.writeFileSync(resultFile, JSON.stringify({
        ok,
        ...info,
        packaged: app.isPackaged,
        arch: process.arch,
        at: new Date().toISOString()
      }, null, 2));
      finish(ok ? 0 : 1, ok ? 'smoke: ok' : 'smoke: unexpected app state');
    } catch (error) {
      finish(1, `smoke: ${error && error.message ? error.message : error}`);
    }
  });
}

function runSmokeClean(win) {
  let finished = false;
  const resultFile = path.join(app.getPath('temp'), 'linguist-smoke.json');
  const timer = setTimeout(() => finish(1, 'smoke-clean: timeout after 30s'), 30000);

  function finish(code, message) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    try {
      fs.writeFileSync(resultFile, JSON.stringify({
        ok: code === 0,
        clean: true,
        message,
        packaged: app.isPackaged,
        arch: process.arch,
        at: new Date().toISOString()
      }, null, 2));
    } catch (error) {
      console.error('smoke-clean: could not write result file', error.message);
    }
    console.log(message);
    app.exit(code);
  }

  win.webContents.once('did-fail-load', (_event, code, description) => {
    finish(1, `smoke-clean: load failed ${code} ${description}`);
  });

  win.webContents.once('did-finish-load', async () => {
    try {
      const previous = await win.webContents.executeJavaScript(
        '(() => {' +
        `  const key = ${JSON.stringify(SMOKE_KEY)};` +
        '  const value = localStorage.getItem(key);' +
        '  localStorage.removeItem(key);' +
        '  return value;' +
        '})()'
      );
      console.log('smoke-clean:', previous === null ? 'nothing to remove' : 'removed');
      finish(0, 'smoke-clean: ok');
    } catch (error) {
      finish(1, `smoke-clean: ${error && error.message ? error.message : error}`);
    }
  });
}

app.on('window-all-closed', () => {
  app.quit();
});
