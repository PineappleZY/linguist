import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const previewScript = path.join(root, '8.0', 'tools', 'preview.mjs');
const previewFile = path.join(root, '8.0', 'dist', 'preview-panel.html');
const outputDir = path.join(root, 'docs', 'showcase');
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linguist-showcase-'));
const chromePath = process.env.CHROME_PATH || (
  process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'google-chrome'
);
const port = 9338;

fs.mkdirSync(outputDir, { recursive: true });

const chrome = spawn(chromePath, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--hide-scrollbars',
  '--no-first-run',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  'about:blank'
], { stdio: 'ignore' });

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url, attempts = 30) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      /* Chrome may still be starting. */
    }
    await delay(200);
  }
  throw new Error(`Could not connect to ${url}`);
}

class Cdp {
  constructor(url) {
    this.id = 0;
    this.pending = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
  }

  async send(method, params = {}, sessionId) {
    await this.ready;
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const result = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.socket.send(JSON.stringify(payload));
    return result;
  }

  close() {
    this.socket.close();
  }
}

const captures = [
  {
    panel: 'p-dict-zh',
    output: 'dictionary.png',
    selector: '.app',
    maxHeight: 1420
  },
  {
    panel: 'p-en',
    output: 'word-dna.png',
    selector: '.app',
    maxHeight: 1680
  },
  {
    panel: 'p-practice',
    output: 'practice.png',
    selector: '.pv-spell',
    maxHeight: 1380
  }
];

const versionInfo = await getJson(`http://127.0.0.1:${port}/json/version`);
const cdp = new Cdp(versionInfo.webSocketDebuggerUrl);

try {
  for (const item of captures) {
    const generated = spawnSync(
      process.execPath,
      [previewScript, '--panel', item.panel],
      { cwd: root, encoding: 'utf8' }
    );
    if (generated.status !== 0) {
      throw new Error(generated.stderr || generated.stdout || `Preview failed for ${item.panel}`);
    }

    const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const attached = await cdp.send('Target.attachToTarget', {
      targetId: target.targetId,
      flatten: true
    });
    const session = attached.sessionId;

    await cdp.send('Page.enable', {}, session);
    await cdp.send('Runtime.enable', {}, session);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 430,
      height: 1800,
      deviceScaleFactor: 2,
      mobile: true
    }, session);
    await cdp.send('Page.navigate', {
      url: pathToFileURL(previewFile).href
    }, session);
    await delay(700);

    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const style = document.createElement('style');
          style.textContent = [
            '.pv-title,.pv-sub,.pv-head,.pv-note{display:none!important}',
            'body{padding:0!important;background:#f5f5f7!important;margin:0!important}',
            '.pv-wrap{max-width:none!important;padding:0!important;margin:0!important}',
            '.pv-panel{margin:0!important}',
            '.app.pv-frame{width:100%!important;border:0!important;border-radius:0!important}'
          ].join('');
          document.head.appendChild(style);
          window.scrollTo(0, 0);
        })()
      `,
      returnByValue: true
    }, session);
    await delay(220);

    const rectResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const element = document.querySelector(${JSON.stringify(item.selector)});
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          x: Math.max(0, rect.left),
          y: Math.max(0, rect.top),
          width: rect.width,
          height: rect.height
        };
      })()`,
      returnByValue: true
    }, session);
    const rect = rectResult.result.value;
    if (!rect) throw new Error(`Missing selector ${item.selector}`);

    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      fromSurface: true,
      clip: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: Math.min(rect.height, item.maxHeight),
        scale: 2
      }
    }, session);
    fs.writeFileSync(
      path.join(outputDir, item.output),
      Buffer.from(shot.data, 'base64')
    );
    console.log(`captured docs/showcase/${item.output}`);
    await cdp.send('Target.closeTarget', { targetId: target.targetId });
  }

  const landing = path.join(root, 'docs', 'index.html');
  for (const width of [390, 768, 1440]) {
    const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const attached = await cdp.send('Target.attachToTarget', {
      targetId: target.targetId,
      flatten: true
    });
    const session = attached.sessionId;
    await cdp.send('Page.enable', {}, session);
    await cdp.send('Runtime.enable', {}, session);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    }, session);
    await cdp.send('Page.navigate', {
      url: pathToFileURL(landing).href
    }, session);
    await delay(500);
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        document.querySelectorAll('img[loading="lazy"]').forEach((image) => {
          image.loading = 'eager';
        });
        window.scrollTo(0, document.documentElement.scrollHeight);
        window.scrollTo(0, 0);
      })()`
    }, session);
    await delay(1300);
    const metrics = await cdp.send('Runtime.evaluate', {
      expression: `(() => ({
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        pageScrollX: (() => {
          window.scrollTo(1000, 0);
          const value = window.scrollX;
          window.scrollTo(0, 0);
          return value;
        })(),
        imageFailures: [...document.images].filter((image) => !image.complete || !image.naturalWidth).length,
        titleCount: document.querySelectorAll('h1').length,
        offenders: [...document.querySelectorAll('body *')]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName.toLowerCase(),
              className: typeof element.className === 'string' ? element.className : '',
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width)
            };
          })
          .filter((item) => item.right > innerWidth + 1 || item.left < -1)
          .slice(0, 12)
      }))()`,
      returnByValue: true
    }, session);
    const value = metrics.result.value;
    console.log(
      `landing ${width}px: inner=${value.innerWidth} scroll=${value.scrollWidth} ` +
      `body=${value.bodyWidth} brokenImages=${value.imageFailures} h1=${value.titleCount}`
    );
    if (value.offenders.length) {
      console.log(JSON.stringify(value.offenders, null, 2));
    }
    if (value.pageScrollX > 0) {
      throw new Error(`Horizontal overflow at ${width}px`);
    }
    if (value.imageFailures || value.titleCount !== 1) {
      throw new Error(`Landing audit failed at ${width}px`);
    }
    await cdp.send('Target.closeTarget', { targetId: target.targetId });
  }
} finally {
  cdp.close();
  chrome.kill();
}
