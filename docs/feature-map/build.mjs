/*
 * Builds the feature map for the Linguist project.
 *
 *   node docs/feature-map/build.mjs
 *
 * Reads the app so the map cannot lie about its own size, merges the hand-written
 * graph in graph.json, and writes:
 *   features.json      the graph plus the numbers (machine-readable)
 *   feature-map.html   a self-contained viewer (no network, no dependencies)
 *
 * The prose in graph.json is the part a machine cannot infer: what each feature
 * is for and which files implement it. The numbers are all read here.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const APP = path.join(ROOT, '8.0');
const WEB = path.join(APP, 'web');

function loadApp() {
  const sandbox = { window: {}, console, Promise, JSON, Date, Math, Object, Array, String, Number, Error };
  sandbox.window.LINGUIST = {};
  vm.createContext(sandbox);
  ['config.js', 'strings.js', 'prompts.js'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(WEB, 'js', file), 'utf8'), sandbox, { filename: file });
  });
  return sandbox.window.LINGUIST;
}

const ns = loadApp();
const C = ns.CONFIG;
const S = ns.strings;
const tests = fs.readFileSync(path.join(WEB, 'tests', 'smoke.js'), 'utf8');

/* How many assertions really ran, not how many `check(` calls are written: some
   sit inside loops over languages and card groups. The suite is run twice: once
   at the end, after the map exists, because the suite itself checks that the
   map is current — running it before the write would be a circle. */
function runSuite() {
  try {
    const out = execFileSync(process.execPath, [path.join(WEB, 'tests', 'smoke.js')], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 180000
    });
    const match = /(\d+) passed/.exec(out);
    if (match) return Number(match[1]);
  } catch (err) {
    /* Fall through to the static count. */
  }
  return (tests.match(/\bcheck\(/g) || []).length;
}

const cardLists = {};
['latin', 'ja', 'zh', 'sentence'].forEach((group) => {
  cardLists[group] = C.cardPrefCatalog(group).length;
});

const counts = {
  version: C.version,
  languages: C.languages.length,
  liveLanguages: C.queryLanguages.length,
  retiredLanguages: C.languages.filter((l) => l.retired).map((l) => l.id),
  wordCards: C.cardOrder.length,
  sentenceCards: C.sentenceCardOrder.length,
  documentCards: C.documentCardOrder.length,
  uiLanguages: Object.keys(S).length,
  strings: Object.keys(S.en).length,
  timeoutMs: C.api.timeoutMs,
  documentTimeoutMs: C.api.documentTimeoutMs,
  chunkChars: C.limits.document.chunk,
  maxFileChars: C.limits.document.maxTotal,
  practiceRound: C.limits.practiceRound,
  /* Provisional; replaced by the real number once the suite has run below. */
  assertions: (tests.match(/\bcheck\(/g) || []).length
};

const graph = JSON.parse(fs.readFileSync(path.join(HERE, 'graph.json'), 'utf8'));

/* The map is part of every release, not a document written once. A version
   bump that does not say, in graph.json, which features were added or changed
   fails here — before anything is written — so the picture cannot quietly fall
   behind the app. */
function assertChanges() {
  const list = Array.isArray(graph.changes) ? graph.changes : [];
  const ids = new Set(graph.nodes.map((node) => node.id));
  const problems = [];
  if (!list.length) {
    problems.push('graph.json has no changes[] — every version needs an entry');
  } else {
    if (list[0].version !== counts.version) {
      problems.push('newest change is ' + list[0].version + ' but CONFIG.version is ' + counts.version);
    }
    list.forEach((entry) => {
      const touched = (entry.added || []).concat(entry.changed || []);
      if (!entry.version) problems.push('a change entry has no version');
      if (!touched.length) problems.push('change ' + entry.version + ' names no nodes');
      touched.forEach((id) => {
        if (!ids.has(id)) problems.push('change ' + entry.version + ' names an unknown node: ' + id);
      });
    });
  }
  if (problems.length) {
    console.error('feature map is out of step with the app:');
    problems.forEach((problem) => console.error('  - ' + problem));
    console.error('Fix graph.json (changes + nodes), then run this script again.');
    process.exit(1);
  }
}

assertChanges();

/* Badges for the version being written: new wins over updated. */
const latest = graph.changes[0];
const badges = {};
(latest.changed || []).forEach((id) => { badges[id] = 'updated'; });
(latest.added || []).forEach((id) => { badges[id] = 'new'; });

const payload = {
  generated: new Date().toISOString(),
  counts,
  cardLists,
  layers: graph.layers,
  latest: { version: latest.version, summary: latest.summary || '' },
  badges,
  changes: graph.changes,
  nodes: graph.nodes,
  edges: graph.edges
};

/* Keep the node labels in step with the code for the two that quote numbers. */
payload.nodes.forEach((node) => {
  if (node.id === 'cards') node.label = counts.wordCards + ' word cards';
  if (node.id === 'tests') node.label = counts.assertions + ' assertions';
  if (node.id === 'cards') node.zh = '词条卡片 ' + counts.wordCards + ' 张';
  if (node.id === 'chunking') {
    node.summary = 'About ' + counts.chunkChars.toLocaleString('en-US') +
      ' characters per request with overlap, one merge request at the end; up to ' +
      counts.maxFileChars.toLocaleString('en-US') + ' characters, then the file is refused with its size.';
  }
  if (node.id === 'api') {
    node.summary = 'The only place that fetches. JSON mode, no thinking, abortable, ' +
      (counts.timeoutMs / 1000) + ' s for lookups and ' + (counts.documentTimeoutMs / 1000) +
      ' s for a document part, retries on 429, 5xx, network and timeout.';
  }
  if (node.id === 'i18n') {
    node.summary = counts.strings + ' keys in ' + counts.uiLanguages +
      ' languages, written per language rather than translated word for word; a missing key falls back to English, then to the key itself.';
  }
  if (node.id === 'card-prefs') {
    node.summary = 'Four groups; only the cards a group can produce are listed (' + cardLists.latin + ' / ' +
      cardLists.ja + ' / ' + cardLists.zh + ' / ' + cardLists.sentence +
      '). Each row hides, moves up or down, or goes straight to the top; each group restores on its own.';
  }
});

const template = fs.readFileSync(path.join(HERE, 'viewer.html'), 'utf8');

function write(next) {
  const json = JSON.stringify(next, null, 2) + '\n';
  fs.writeFileSync(path.join(HERE, 'features.json'), json, 'utf8');
  fs.writeFileSync(
    path.join(HERE, 'feature-map.html'),
    template.replace('__PAYLOAD__', JSON.stringify(next).replace(/</g, '\\u003c')),
    'utf8'
  );
  return json.length;
}

/* Pass one: the map now exists with the right version, so the suite's own
   "is the map current?" check can pass. Pass two records how many assertions
   really ran. */
write(payload);
const real = runSuite();
if (real !== counts.assertions) {
  counts.assertions = real;
  payload.nodes.forEach((node) => {
    if (node.id === 'tests') node.label = real + ' assertions';
  });
  write(payload);
}

console.log('feature map: ' + payload.nodes.length + ' nodes, ' + payload.edges.length + ' edges');
console.log('  version ' + counts.version + ', ' + counts.wordCards + ' word cards, ' +
  counts.strings + ' strings, ' + counts.assertions + ' assertions');
console.log('  features.json     ' + (JSON.stringify(payload).length / 1024).toFixed(1) + ' KB');
console.log('  feature-map.html  ' + (Buffer.byteLength(template.replace('__PAYLOAD__', JSON.stringify(payload))) / 1024).toFixed(1) + ' KB');
