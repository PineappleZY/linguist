/* LINGUIST — root index, mastery and scheduling.

   Roots come from data the entry already has: morphology for the Latin family,
   character components for Chinese and Japanese. No extra model request is
   made just to open the Roots tab. */

window.LINGUIST = window.LINGUIST || {};

(function (ns) {
  'use strict';

  var INTERVALS = [10 * 60000, 86400000, 3 * 86400000, 7 * 86400000, 21 * 86400000, 60 * 86400000];
  var indexCache = null;

  function norm(text) {
    var value = String(text == null ? '' : text).trim();
    if (typeof value.normalize === 'function') value = value.normalize('NFC');
    return value.toLowerCase();
  }

  function cleanPart(text) {
    return String(text == null ? '' : text).replace(/^[-‐‑–—]+|[-‐‑–—]+$/g, '').trim();
  }

  function originOf(value) {
    return norm(value || 'unknown').replace(/\s+/g, '_');
  }

  function keyOf(kind, origin, part) {
    return kind + ':' + originOf(origin) + ':' + norm(cleanPart(part));
  }

  function rootsFromEntry(entry) {
    var found = [];
    var lines = entry && entry.lines && typeof entry.lines === 'object' ? entry.lines : {};
    Object.keys(lines).forEach(function (name) {
      var line = lines[name];
      if (!line || typeof line !== 'object') return;

      var morph = line.morphology;
      if (morph && Array.isArray(morph.breakdown)) {
        var primary = morph.breakdown.filter(function (part) {
          return part && part.type === 'root' && cleanPart(part.part);
        });
        var variants = (Array.isArray(morph.root_variants) ? morph.root_variants : [])
          .map(function (item) { return item && item.form ? cleanPart(item.form) : ''; })
          .filter(Boolean);
        var family = [];
        var rf = line.root_family;
        if (rf && Array.isArray(rf.direct)) {
          rf.direct.forEach(function (item) { if (item && item.word) family.push({ word: item.word, gloss: item.gloss || '' }); });
        }
        if (rf && Array.isArray(rf.shared_root)) {
          rf.shared_root.forEach(function (item) { if (item && item.word) family.push({ word: item.word, gloss: item.gloss || '' }); });
        }
        primary.forEach(function (part) {
          found.push({
            key: keyOf('morpheme', part.origin || entry.language, part.part),
            kind: 'morpheme',
            display: cleanPart(part.part),
            meaning: String(part.meaning || ''),
            origin: String(part.origin || ''),
            language: entry.language || '',
            variants: variants,
            family: family,
            entryId: entry.id,
            word: entry.word || ''
          });
        });
      }

      if (Array.isArray(line.components)) {
        line.components.forEach(function (part) {
          if (!part || !part.part) return;
          found.push({
            key: keyOf('component', part.origin || entry.language || 'han', part.part),
            kind: 'component',
            display: cleanPart(part.part),
            meaning: String(part.meaning || ''),
            origin: String(part.origin || ''),
            language: entry.language || '',
            variants: [],
            family: [],
            entryId: entry.id,
            word: entry.word || ''
          });
        });
      }

      if (Array.isArray(line.kanji_origin)) {
        line.kanji_origin.forEach(function (part) {
          if (!part || !part.kanji) return;
          found.push({
            key: keyOf('component', 'han', part.kanji),
            kind: 'component',
            display: cleanPart(part.kanji),
            meaning: String(part.original_image || part.formation || ''),
            origin: 'Han',
            language: entry.language || 'ja',
            variants: [],
            family: [],
            entryId: entry.id,
            word: entry.word || ''
          });
        });
      }
    });

    var unique = {};
    return found.filter(function (root) {
      if (!root.display || unique[root.key]) return false;
      unique[root.key] = true;
      return true;
    });
  }

  function readIndex() {
    if (indexCache) return indexCache;
    var stored = ns.store.readAux('rootIndex', null);
    if (stored && stored.version === ns.CONFIG.schemaVersion && stored.entries) {
      indexCache = stored;
    } else {
      indexCache = { version: ns.CONFIG.schemaVersion, entries: {} };
    }
    return indexCache;
  }

  function writeIndex() {
    if (indexCache) ns.store.writeAux('rootIndex', indexCache);
  }

  function indexEntry(entry) {
    if (!entry || !entry.id) return [];
    var roots = rootsFromEntry(entry);
    var index = readIndex();
    index.entries[entry.id] = {
      ts: entry.ts || Date.now(),
      word: entry.word || '',
      language: entry.language || '',
      roots: roots
    };
    writeIndex();
    return roots;
  }

  function rebuildIndex() {
    var index = { version: ns.CONFIG.schemaVersion, entries: {} };
    ns.store.listHistory().forEach(function (row) {
      var entry = ns.store.getEntry(row.id);
      if (!entry) return;
      var roots = rootsFromEntry(entry);
      index.entries[row.id] = {
        ts: row.ts || entry.ts || 0,
        word: row.word || entry.word || '',
        language: row.language || entry.language || '',
        roots: roots
      };
    });
    indexCache = index;
    writeIndex();
    return index;
  }

  function allRoots() {
    var index = readIndex();
    var map = {};
    Object.keys(index.entries).forEach(function (id) {
      var item = index.entries[id];
      (item.roots || []).forEach(function (root) {
        var current = map[root.key];
        if (!current) {
          current = map[root.key] = {
            key: root.key, kind: root.kind, display: root.display,
            meaning: root.meaning, origin: root.origin, language: root.language,
            variants: [], family: [], entries: [], firstTs: item.ts || 0
          };
        }
        if (root.variants) root.variants.forEach(function (v) {
          if (current.variants.indexOf(v) < 0) current.variants.push(v);
        });
        if (root.family) root.family.forEach(function (word) {
          if (!current.family.some(function (w) { return norm(w.word) === norm(word.word); })) current.family.push(word);
        });
        if (!current.entries.some(function (e) { return e.id === id; })) {
          current.entries.push({ id: id, word: item.word, ts: item.ts });
        }
        if (!current.meaning && root.meaning) current.meaning = root.meaning;
      });
    });
    return Object.keys(map).map(function (key) { return map[key]; });
  }

  function readProgress() {
    var progress = ns.store.readAux('rootProgress', {});
    return progress && typeof progress === 'object' ? progress : {};
  }

  function writeProgress(progress) {
    ns.store.writeAux('rootProgress', progress);
  }

  function stateFor(strength) {
    if (strength >= 5) return 'known';
    if (strength >= 3) return 'familiar';
    if (strength >= 1) return 'learning';
    return 'new';
  }

  function ensureProgress(progress, root) {
    if (!progress[root.key]) {
      progress[root.key] = {
        key: root.key, display: root.display, kind: root.kind,
        meaning: root.meaning, origin: root.origin, language: root.language,
        variants: (root.variants || []).slice(), wordIds: [],
        state: 'new', strength: 0, correct: 0, wrong: 0,
        lastSeen: 0, dueAt: 0
      };
    }
    var p = progress[root.key];
    if (!p.meaning && root.meaning) p.meaning = root.meaning;
    (root.entries || []).forEach(function (entry) {
      if (p.wordIds.indexOf(entry.id) < 0) p.wordIds.push(entry.id);
    });
    if (root.entryId && p.wordIds.indexOf(root.entryId) < 0) p.wordIds.push(root.entryId);
    return p;
  }

  function ensureAllProgress() {
    var progress = readProgress();
    allRoots().forEach(function (root) { ensureProgress(progress, root); });
    writeProgress(progress);
    return progress;
  }

  function recordRootAnswer(key, correct) {
    var progress = readProgress();
    var p = progress[key];
    if (!p) return null;
    var now = Date.now();
    if (correct) {
      p.correct += 1;
      p.strength = Math.min(5, p.strength + 1);
    } else {
      p.wrong += 1;
      p.strength = Math.max(0, p.strength - 1);
    }
    p.state = stateFor(p.strength);
    p.lastSeen = now;
    p.dueAt = now + INTERVALS[p.strength];
    writeProgress(progress);
    return p;
  }

  function recordWordOutcome(item, outcome) {
    if (!item || !Array.isArray(item.roots) || !item.roots.length) return;
    if (outcome !== 'known' && outcome !== 'unknown') return;
    var progress = readProgress();
    item.roots.forEach(function (root) {
      var p = ensureProgress(progress, root);
      var known = outcome === 'known';
      if (known) {
        p.correct += 1;
        p.strength = Math.min(5, p.strength + 1);
      } else {
        p.wrong += 1;
        p.strength = Math.max(0, p.strength - 1);
      }
      p.state = stateFor(p.strength);
      p.lastSeen = Date.now();
      p.dueAt = p.lastSeen + INTERVALS[p.strength];
    });
    writeProgress(progress);
  }

  function dueQueue(limit) {
    var progress = ensureAllProgress();
    var now = Date.now();
    return Object.keys(progress).map(function (key) { return progress[key]; })
      .filter(function (p) { return !p.dueAt || p.dueAt <= now || p.state === 'new'; })
      .sort(function (a, b) {
        if (a.state === 'new' && b.state !== 'new') return -1;
        if (b.state === 'new' && a.state !== 'new') return 1;
        return (a.dueAt || 0) - (b.dueAt || 0);
      })
      .slice(0, limit || ns.CONFIG.limits.rootReviewRound);
  }

  function stats() {
    var progress = ensureAllProgress();
    var list = Object.keys(progress).map(function (key) { return progress[key]; });
    return {
      total: list.length,
      new: list.filter(function (p) { return p.state === 'new'; }).length,
      learning: list.filter(function (p) { return p.state === 'learning'; }).length,
      familiar: list.filter(function (p) { return p.state === 'familiar'; }).length,
      known: list.filter(function (p) { return p.state === 'known'; }).length,
      due: list.filter(function (p) { return !p.dueAt || p.dueAt <= Date.now(); }).length,
      words: list.reduce(function (sum, p) { return sum + (p.wordIds ? p.wordIds.length : 0); }, 0)
    };
  }

  function getRoot(key) {
    var progress = readProgress();
    if (progress[key]) return progress[key];
    var root = allRoots().filter(function (item) { return item.key === key; })[0];
    if (!root) return null;
    var p = ensureProgress(progress, root);
    writeProgress(progress);
    return p;
  }

  function familyWords(key) {
    var root = allRoots().filter(function (item) { return item.key === key; })[0];
    if (!root) return [];
    var list = root.family.slice();
    (root.entries || []).forEach(function (entry) {
      if (entry.word && !list.some(function (w) { return norm(w.word) === norm(entry.word); })) {
        list.push({ word: entry.word, gloss: '' });
      }
    });
    return list;
  }

  function normalizeAnswer(text) {
    return norm(cleanPart(text)).replace(/\s+/g, '');
  }

  function answerMatches(text, answers) {
    var given = normalizeAnswer(text);
    return (answers || []).some(function (answer) { return normalizeAnswer(answer) === given; });
  }

  function reset() {
    ns.store.writeAux('rootProgress', {});
  }

  function invalidate() { indexCache = null; }

  function mergeProgress(incoming) {
    if (!incoming || typeof incoming !== 'object') return;
    var progress = readProgress();
    Object.keys(incoming).forEach(function (key) {
      var next = incoming[key];
      var old = progress[key];
      if (!next) return;
      if (!old || (next.lastSeen || 0) >= (old.lastSeen || 0)) progress[key] = next;
    });
    writeProgress(progress);
  }

  ns.roots = {
    rootsFromEntry: rootsFromEntry,
    indexEntry: indexEntry,
    rebuildIndex: rebuildIndex,
    allRoots: allRoots,
    dueQueue: dueQueue,
    stats: stats,
    getRoot: getRoot,
    familyWords: familyWords,
    recordRootAnswer: recordRootAnswer,
    recordWordOutcome: recordWordOutcome,
    normalizeAnswer: normalizeAnswer,
    answerMatches: answerMatches,
    mergeProgress: mergeProgress,
    reset: reset,
    invalidate: invalidate,
    _keyOf: keyOf,
    _stateFor: stateFor
  };
})(window.LINGUIST);
