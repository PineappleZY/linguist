/* LINGUIST 6.0 — real-call measurement.

   The token ceilings and the network timeout in config.js are estimates. This
   runs genuine calls and reports what actually happens: how long each request
   takes, how much it returns, whether anything was cut off by max_tokens, and
   whether the answers respect the length rules the prompts state.

   The key is read from .deepseek-key.local at the repository root (or from the
   DEEPSEEK_API_KEY environment variable). It is never printed, never logged and
   never written into any source file.

   Every raw response is saved under dist/measure/ so the field structure can be
   reviewed afterwards without spending another call.

   node 6.0/tools/measure.mjs [word] [sourceLang]
   node 6.0/tools/measure.mjs Gift de
   node 6.0/tools/measure.mjs --doc path/to/article.txt de

   The document form is the one that matters most for 6.0: it is the only path
   that can cost several requests, and the only one whose ceilings were guessed
   without ever having been measured.
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
const DOC_INDEX = process.argv.indexOf('--doc');
const DOC_FILE = DOC_INDEX > -1 ? process.argv[DOC_INDEX + 1] : null;
const DOC_LANG = DOC_INDEX > -1 ? (process.argv[DOC_INDEX + 2] || 'de') : '';

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
  sandbox.window.LINGUIST = sandbox.window.LINGUIST || {};
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  ['config.js', 'strings.js', 'extract.js', 'prompts.js'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(WEB, 'js', file), 'utf8'), sandbox, { filename: file });
  });
  return sandbox.window.LINGUIST;
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

  if (DOC_FILE) {
    await measureDocument(ns, found, model, outputLang);
    return;
  }

  console.log('Linguist ' + CONFIG.version + ' — real-call measurement');
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

  const lines = CONFIG.deepLinesFor(SOURCE);
  console.log('stage 2 — ' + lines.length + ' deep lines, in parallel' +
    (lines.indexOf('inflection') === -1 ? ' (this language has no inflection line)' : ''));
  const batchStarted = Date.now();
  const results = await Promise.all(lines.map((line) => call(
    line, found.key,
    payload(model, prompts.deep(SOURCE, line, outputLang), deepContext(overview), CONFIG.maxTokens[line])
  )));
  const batchElapsed = Date.now() - batchStarted;

  results.forEach((result) => report(result.record));
  console.log('');
  line('parallel wall clock', batchElapsed + 'ms');
  line('slowest line', Math.max(...results.map((result) => result.record.elapsed)) + 'ms');

  /* 6.0 tightened two fields: the central sense moved into `core_meaning` and
     the definitions were capped. A ceiling is only real if the answers are
     actually inside it, so the lengths are printed rather than assumed. */
  const etym = results.filter((result) => result.record.name === 'etymology')[0];
  const usage = results.filter((result) => result.record.name === 'usage')[0];
  if (etym && etym.raw) {
    const core = etym.raw.core_meaning || etym.raw.core_metaphor || '';
    line('core_meaning', core ? String(core).length + ' chars — ' + String(core).slice(0, 60) : 'MISSING');
  }
  if (usage && usage.raw && Array.isArray(usage.raw.senses)) {
    const lengths = usage.raw.senses.map((sense) => String(sense.definition || '').length);
    line('definitions', usage.raw.senses.length + ' senses, ' +
      (lengths.length ? lengths.join('/') + ' chars' : 'none') +
      ' (cap ' + (outputLang === 'zh' ? '24 字' : outputLang === 'ja' ? '40 字' : '12 words') + ')');
    const over = lengths.filter((n) => outputLang === 'zh' ? n > 24 : (outputLang === 'ja' ? n > 40 : n > 90));
    if (over.length) console.log('  NOTE: ' + over.length + ' definition(s) are over the stated cap.');
  }

  results.forEach((result) => {
    if (result.raw) {
      fs.writeFileSync(path.join(OUT_DIR, result.record.name + '.json'), JSON.stringify(result.raw, null, 2), 'utf8');
    }
  });

  console.log('');
  console.log('raw responses saved to ' + path.relative(REPO, OUT_DIR));

  const all = [overviewCall].concat(results);
  const truncated = all
    .filter((result) => result.record.finish === 'length')
    .map((result) => result.record.name);
  const failed = all
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
  const slowest = Math.max(...all.map((result) => result.record.elapsed));
  if (slowest > CONFIG.api.timeoutMs * 0.8) {
    console.log('NEEDS ATTENTION — slowest request is within 20% of the configured timeout.');
  }
}

/* ---------- Documents ----------
   One request per part, then the outline merge. Sequential, exactly as the app
   runs it, so the wall clock here is the wall clock a reader sees. */

async function measureDocument(ns, found, model, outputLang) {
  const CONFIG = ns.CONFIG;
  const extract = ns.extract;
  const prompts = ns.prompts;
  const limits = CONFIG.limits.document;

  if (!fs.existsSync(DOC_FILE)) {
    console.error('No such file: ' + DOC_FILE);
    process.exit(1);
  }
  const name = path.basename(DOC_FILE);
  const raw = fs.readFileSync(DOC_FILE, 'utf8');
  const text = extract.clean(raw, name);
  const plan = extract.planChunks(text, limits);

  console.log('Linguist ' + CONFIG.version + ' — real-call measurement (document)');
  line('key source', found.source + ' (never printed)');
  line('model', model);
  line('file', name);
  line('characters', String(text.length));
  line('parts', String(plan.length) + ' of at most ' + limits.chunk + ' characters');
  line('source language', DOC_LANG + ' (' + prompts.srcName(DOC_LANG) + ')');
  line('output language', outputLang + ' (' + prompts.outName(outputLang) + ')');
  line('timeout in app', CONFIG.api.timeoutMs + 'ms');
  console.log('');
  if (text.length > limits.maxTotal) {
    console.log('NOTE: the app would refuse this file (> ' + limits.maxTotal + ' characters).');
    console.log('');
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const started = Date.now();
  const parts = [];
  const records = [];

  for (let i = 0; i < plan.length; i += 1) {
    const part = plan[i];
    console.log('part ' + part.index + ' of ' + plan.length);
    const result = await call('part-' + part.index, found.key, payload(
      model,
      prompts.document(DOC_LANG, outputLang, { index: part.index, total: part.total }),
      'Text (part ' + part.index + ' of ' + part.total + '):\n' + part.text,
      CONFIG.maxTokens.document
    ));
    report(result.record);
    records.push(result.record);
    if (result.raw) {
      parts.push(result.raw);
      fs.writeFileSync(path.join(OUT_DIR, 'document-part-' + part.index + '.json'),
        JSON.stringify(result.raw, null, 2), 'utf8');
      /* What the four cards would show, so the fields can be judged rather
         than only counted. */
      const summary = Array.isArray(result.raw.summary) ? result.raw.summary : [];
      const vocab = Array.isArray(result.raw.vocabulary) ? result.raw.vocabulary : [];
      line('  bullets', String(summary.length) + ' (' +
        (summary.length ? Math.round(summary.reduce((n, s) => n + String(s).length, 0) / summary.length) : 0) +
        ' chars each)');
      line('  translation', String(result.raw.translation || '').length + ' chars');
      line('  glossary', String(vocab.length) + ' items');
      line('  register', [result.raw.register && result.raw.register.genre,
        result.raw.register && result.raw.register.register,
        result.raw.register && result.raw.register.period].filter(Boolean).join(' / '));
    }
  }

  const withoutMerge = Date.now() - started;

  if (plan.length > 1 && parts.length) {
    console.log('');
    console.log('merge — one outline from every part');
    const summary = parts.reduce((all, part) => all.concat(Array.isArray(part.summary) ? part.summary : []), []).slice(0, 40);
    const register = parts[parts.length - 1].register || {};
    const merged = await call('merge', found.key, payload(
      model,
      prompts.documentMerge(DOC_LANG, outputLang),
      'Notes taken part by part, in order (json): ' + JSON.stringify({ summary: summary, register: register }),
      CONFIG.maxTokens.documentMerge
    ));
    report(merged.record);
    records.push(merged.record);
    if (merged.raw) {
      fs.writeFileSync(path.join(OUT_DIR, 'document-merge.json'), JSON.stringify(merged.raw, null, 2), 'utf8');
    }
  }

  const elapsed = Date.now() - started;
  console.log('');
  line('parts wall clock', withoutMerge + 'ms');
  line('whole run', elapsed + 'ms');
  line('slowest request', Math.max(...records.map((r) => r.elapsed)) + 'ms');
  line('requests', String(records.length) + ' for ' + text.length + ' characters');
  console.log('');

  const truncated = records.filter((r) => r.finish === 'length').map((r) => r.name);
  const failed = records.filter((r) => r.json !== 'ok').map((r) => r.name);
  if (truncated.length) {
    console.log('NEEDS ATTENTION — cut off by max_tokens: ' + truncated.join(', '));
  } else {
    console.log('No part was truncated.');
  }
  if (failed.length) console.log('NEEDS ATTENTION — unparsable json: ' + failed.join(', '));
  const slowest = Math.max(...records.map((r) => r.elapsed));
  if (slowest > CONFIG.api.timeoutMs * 0.8) {
    console.log('NEEDS ATTENTION — slowest request is within 20% of the configured timeout.');
  }
  console.log('');
  console.log('raw responses saved to ' + path.relative(REPO, OUT_DIR));
}

main().catch((err) => {
  console.error('measurement failed:', redact(String(err && err.message ? err.message : err), ''));
  process.exit(1);
});
