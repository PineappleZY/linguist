/* RADICLE 2.0 — real-call measurement.

   The token ceilings and the network timeout in config.js are estimates. This
   runs one genuine lookup and reports what actually happens: how long each of
   the four requests takes, how much it returns, and whether anything was cut
   off by max_tokens.

   The key is read from .deepseek-key.local at the repository root (or from the
   DEEPSEEK_API_KEY environment variable). It is never printed, never logged and
   never written into any source file.

   Every raw response is saved under dist/measure/ so the field structure can be
   reviewed afterwards without spending another call.

   node 3.0/tools/measure.mjs [word] [sourceLang]
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V2 = path.join(HERE, '..');
const WEB = path.join(V2, 'web');
const REPO = path.join(V2, '..');
const KEY_FILE = path.join(REPO, '.deepseek-key.local');
const OUT_DIR = path.join(V2, 'dist', 'measure');

const WORD = process.argv[2] || 'contend';
const SOURCE = process.argv[3] || 'en';

/* ---------- Key ---------- */

function readKey() {
  const fromEnv = process.env.DEEPSEEK_API_KEY;
  if (fromEnv && fromEnv.trim()) return { key: fromEnv.trim(), source: 'DEEPSEEK_API_KEY' };
  if (!fs.existsSync(KEY_FILE)) return null;
  const raw = fs.readFileSync(KEY_FILE, 'utf8').trim();
  if (!raw) return null;
  return { key: raw, source: path.basename(KEY_FILE) };
}

/* Never let the key reach stdout, a log, or a saved artefact. */
function redact(text, key) {
  if (!text || !key) return text;
  return String(text).split(key).join('[redacted]');
}

/* ---------- The app's own prompts and config ---------- */

function loadConfig() {
  const sandbox = { window: {}, console, Promise, JSON, Date, Math, Object, Array, String, Number, Error };
  sandbox.window.RADICLE = sandbox.window.RADICLE || {};
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  ['config.js', 'prompts.js'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(WEB, 'js', file), 'utf8'), sandbox, { filename: file });
  });
  return sandbox.window.RADICLE;
}

/* ---------- Requests ---------- */

function payload(model, system, user, maxTokens) {
  return {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    thinking: { type: 'disabled' },
    temperature: 0.3
  };
}

function overviewContext(word) {
  return 'Headword: "' + word + '"';
}

function deepContext(overview) {
  const context = {
    word: overview.word,
    language: overview.language,
    pos: overview.pos,
    quick_meaning: overview.quick_meaning,
    register: overview.register
  };
  return 'Headword: "' + overview.word + '"\n' +
    'Overview already produced for it (json): ' + JSON.stringify(context);
}

async function call(name, key, body) {
  const started = Date.now();
  let response = null;
  let text = '';
  let failure = null;

  try {
    response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body)
    });
    text = await response.text();
  } catch (err) {
    failure = err.message;
  }

  const elapsed = Date.now() - started;
  const record = { name, elapsed, status: response ? response.status : null, failure };

  if (failure) return { record, raw: null };

  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* keep text for the report */ }

  if (!response.ok) {
    record.error = parsed && parsed.error ? parsed.error.message : text.slice(0, 200);
    return { record, raw: null };
  }

  const choice = parsed && parsed.choices ? parsed.choices[0] : null;
  const content = choice && choice.message ? choice.message.content || '' : '';
  record.finish = choice ? choice.finish_reason : 'unknown';
  record.chars = content.length;
  /* DeepSeek does not return token usage reliably for JSON mode, so estimate:
     CJK runs about 1 token per character, latin about 1 per 4 characters. */
  const cjk = (content.match(/[\u3400-\u9FFF]/g) || []).length;
  record.tokensApprox = Math.round(cjk + (content.length - cjk) / 4);
  record.usage = parsed && parsed.usage ? parsed.usage : null;

  let data = null;
  const cleaned = content.trim().replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '');
  try { data = JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start > -1 && end > start) {
      try { data = JSON.parse(cleaned.slice(start, end + 1)); } catch { data = null; }
    }
  }
  record.json = data ? 'ok' : 'FAILED';
  record.topKeys = data ? Object.keys(data).join(', ') : '';

  return { record, raw: data, text: content };
}

/* ---------- Report ---------- */

function line(label, value) {
  console.log('  ' + label.padEnd(26) + value);
}

function report(record) {
  const status = record.status === null ? 'NETWORK FAIL' : record.status;
  const parts = [
    String(record.elapsed).padStart(6) + 'ms',
    'http ' + status
  ];
  if (record.chars !== undefined) parts.push(String(record.chars).padStart(6) + ' chars');
  if (record.tokensApprox !== undefined) parts.push('~' + String(record.tokensApprox).padStart(5) + ' tok');
  if (record.finish) parts.push('finish=' + record.finish);
  if (record.json) parts.push('json=' + record.json);
  if (record.error) parts.push('error=' + String(record.error).slice(0, 120));
  if (record.failure) parts.push('failure=' + record.failure);
  console.log('  ' + record.name.padEnd(13) + parts.join('  '));
  if (record.topKeys) console.log('  ' + ' '.repeat(13) + 'keys: ' + record.topKeys);
}

/* ---------- Main ---------- */

async function main() {
  const found = readKey();
  if (!found) {
    console.error('No key found.');
    console.error('Create ' + KEY_FILE + ' containing only the key,');
    console.error('or set DEEPSEEK_API_KEY.');
    process.exit(1);
  }

  const ns = loadConfig();
  const CONFIG = ns.CONFIG;
  const prompts = ns.prompts;
  const model = CONFIG.defaultModel;
  const outputLang = CONFIG.defaultOutputLang;

  console.log('Radicle 2.0 — real-call measurement');
  line('key source', found.source + ' (never printed)');
  line('model', model);
  line('source language', SOURCE + ' (' + prompts.srcName(SOURCE) + ')');
  line('output language', outputLang + ' (' + prompts.outName(outputLang) + ')');
  line('headword', WORD);
  line('timeout in app', CONFIG.api.timeoutMs + 'ms');
  console.log('');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('stage 1 — overview');
  const overviewCall = await call('overview', found.key, payload(
    model,
    prompts.overview(SOURCE, outputLang),
    overviewContext(WORD),
    CONFIG.maxTokens.overview
  ));
  report(overviewCall.record);
  if (!overviewCall.raw) {
    console.error('\nOverview failed, stopping before the deep lines.');
    console.error('Detail: ' + redact(JSON.stringify(overviewCall.record), found.key));
    process.exit(1);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'overview.json'), JSON.stringify(overviewCall.raw, null, 2), 'utf8');
  const overview = overviewCall.raw;
  console.log('');

  console.log('stage 2 — three deep lines, in parallel');
  const batchStarted = Date.now();
  const [etymology, usage, distinction] = await Promise.all([
    call('etymology', found.key, payload(model, prompts.deep(SOURCE, 'etymology', outputLang), deepContext(overview), CONFIG.maxTokens.etymology)),
    call('usage', found.key, payload(model, prompts.deep(SOURCE, 'usage', outputLang), deepContext(overview), CONFIG.maxTokens.usage)),
    call('distinction', found.key, payload(model, prompts.deep(SOURCE, 'distinction', outputLang), deepContext(overview), CONFIG.maxTokens.distinction))
  ]);
  const batchElapsed = Date.now() - batchStarted;

  [etymology, usage, distinction].forEach((result) => report(result.record));
  console.log('');
  line('parallel wall clock', batchElapsed + 'ms');
  line('slowest line', Math.max(etymology.record.elapsed, usage.record.elapsed, distinction.record.elapsed) + 'ms');

  [etymology, usage, distinction].forEach((result) => {
    if (result.raw) {
      fs.writeFileSync(path.join(OUT_DIR, result.record.name + '.json'), JSON.stringify(result.raw, null, 2), 'utf8');
    }
  });

  console.log('');
  console.log('raw responses saved to ' + path.relative(REPO, OUT_DIR));

  const truncated = [overviewCall, etymology, usage, distinction]
    .filter((result) => result.record.finish === 'length')
    .map((result) => result.record.name);
  const failed = [overviewCall, etymology, usage, distinction]
    .filter((result) => result.record.json !== 'ok')
    .map((result) => result.record.name);

  console.log('');
  if (truncated.length) {
    console.log('NEEDS ATTENTION — cut off by max_tokens: ' + truncated.join(', '));
    console.log('Raise CONFIG.maxTokens for those lines.');
  } else {
    console.log('No response was truncated.');
  }
  if (failed.length) {
    console.log('NEEDS ATTENTION — unparsable json: ' + failed.join(', '));
  }
  const slowest = Math.max(overviewCall.record.elapsed, etymology.record.elapsed, usage.record.elapsed, distinction.record.elapsed);
  if (slowest > CONFIG.api.timeoutMs * 0.8) {
    console.log('NEEDS ATTENTION — slowest request is within 20% of the configured timeout.');
  }
}

main().catch((err) => {
  console.error('measurement failed:', redact(String(err && err.message ? err.message : err), ''));
  process.exit(1);
});
