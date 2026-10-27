/* LINGUIST — root index, mastery and Ebbinghaus scheduling. */

window.LINGUIST = window.LINGUIST || {};

(function (ns) {
  'use strict';

  var DAY = 86400000;
  var INTERVALS = (ns.CONFIG.limits.rootIntervals || [0, 1, 2, 4, 7, 15, 30, 60, 120])
    .map(function (days) { return days * DAY; });
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
    if (!entry || ['en', 'fr', 'de'].indexOf(entry.language) < 0) return found;
    var lines = entry && entry.lines && typeof entry.lines === 'object' ? entry.lines : {};
    Object.keys(lines).forEach(function (name) {
      var line = lines[name];
      if (!line || typeof line !== 'object') return;

      var morph = line.morphology;
      if (morph && Array.isArray(morph.breakdown)) {
        var primary = morph.breakdown.filter(function (part) {
          return part && part.type === 'root' && cleanPart(part.part).length >= 2 &&
            String(part.meaning || '').trim() && String(part.origin || '').trim();
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
            outputLang: entry.outputLang || '',
            variants: variants,
            family: family,
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
      outputLang: entry.outputLang || '',
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
        outputLang: entry.outputLang || row.firstOutputLang || '',
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
            variants: [], family: [], entries: [], firstTs: item.ts || 0,
            latestTs: item.ts || 0, outputLangs: []
          };
        }
        if (root.variants) root.variants.forEach(function (v) {
          if (current.variants.indexOf(v) < 0) current.variants.push(v);
        });
        if (root.family) root.family.forEach(function (word) {
          if (!current.family.some(function (w) { return norm(w.word) === norm(word.word); })) current.family.push(word);
        });
        if (!current.entries.some(function (e) { return e.id === id; })) {
          current.entries.push({ id: id, word: item.word, ts: item.ts, outputLang: item.outputLang || '' });
        }
        current.starred = current.entries.some(function (entry) { return ns.store.isStarred(entry.id); });
        if (item.ts > current.latestTs) current.latestTs = item.ts;
        if (item.outputLang && current.outputLangs.indexOf(item.outputLang) < 0) current.outputLangs.push(item.outputLang);
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
        lastSeen: 0, lastReviewed: 0, dueAt: 0,
        intervalIndex: 0, stage: 1, lapses: 0, streak: 0
      };
    }
    var p = progress[root.key];
    if (!p.meaning && root.meaning) p.meaning = root.meaning;
    if (p.intervalIndex == null) p.intervalIndex = 0;
    if (!p.stage) p.stage = 1;
    if (p.lapses == null) p.lapses = 0;
    if (p.streak == null) p.streak = 0;
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

  function stateForInterval(index) {
    if (index >= 7) return 'known';
    if (index >= 4) return 'familiar';
    if (index >= 1) return 'learning';
    return 'new';
  }

  function nextInterval(root) {
    var index = Math.max(0, Math.min(INTERVALS.length - 1, root.intervalIndex || 0));
    return INTERVALS[index];
  }

  /* A stage answer never changes dueAt on failure. It only moves the same
     stage to the end of the session queue. A complete three-stage pass is the
     only thing that advances the Ebbinghaus interval. */
  function recordStage(key, stage, correct) {
    var progress = readProgress();
    var p = progress[key];
    if (!p) return null;
    var now = Date.now();
    if (!correct) {
      p.wrong += 1;
      p.lapses = (p.lapses || 0) + 1;
      p.lastSeen = now;
      writeProgress(progress);
      if (ns.events) ns.events.emit('catalog:changed');
      return { status: 'repeat', stage: stage, dueAt: p.dueAt || 0 };
    }
    p.correct += 1;
    p.stage = Number(stage) + 1;
    p.lastSeen = now;
    if (p.stage > 3) {
      p.streak = (p.streak || 0) + 1;
      p.intervalIndex = Math.min(INTERVALS.length - 1, (p.intervalIndex || 0) + 1);
      p.strength = Math.min(5, Math.floor(p.intervalIndex / 2));
      p.state = stateForInterval(p.intervalIndex);
      p.lastReviewed = now;
      p.dueAt = now + INTERVALS[p.intervalIndex];
      p.stage = 1;
    } else {
      if (p.intervalIndex === 0 && !p.dueAt) p.dueAt = 0;
    }
    writeProgress(progress);
    if (ns.events) ns.events.emit('catalog:changed');
    return p;
  }

  function recordWordOutcome(item, outcome) {
    if (!item || !Array.isArray(item.roots) || !item.roots.length) return;
    if (outcome !== 'known' && outcome !== 'unknown') return;
    var progress = readProgress();
    item.roots.forEach(function (root) {
      var p = ensureProgress(progress, root);
      if (outcome === 'known') p.correct += 1;
      else { p.wrong += 1; p.lapses = (p.lapses || 0) + 1; }
      p.lastSeen = Date.now();
    });
    writeProgress(progress);
    if (ns.events) ns.events.emit('catalog:changed');
  }

  function dueQueue(limit) {
    var progress = ensureAllProgress();
    var now = Date.now();
    var starred = {};
    allRoots().forEach(function (root) { if (root.starred) starred[root.key] = true; });
    return Object.keys(progress).map(function (key) { return progress[key]; })
      .filter(function (p) {
        return starred[p.key] && ['en', 'fr', 'de'].indexOf(p.language) > -1 &&
          (!p.dueAt || p.dueAt <= now || p.state === 'new');
      })
      .sort(function (a, b) {
        if (a.state === 'new' && b.state !== 'new') return -1;
        if (b.state === 'new' && a.state !== 'new') return 1;
        return (a.dueAt || 0) - (b.dueAt || 0);
      })
      .slice(0, limit || ns.CONFIG.limits.rootReviewRound);
  }

  function rootGroups(sort, uiLang) {
    var progress = ensureAllProgress();
    var roots = allRoots().filter(function (root) { return !!root.starred; });
    var collator = null;
    try { collator = new Intl.Collator(uiLang || 'en'); } catch (err) { collator = null; }
    var byLanguage = { en: [], fr: [], de: [] };
    roots.forEach(function (root) {
      if (!byLanguage[root.language]) return;
      var p = progress[root.key] || {};
      byLanguage[root.language].push({
        key: root.key, display: root.display, meaning: p.meaning || root.meaning,
        origin: root.origin, language: root.language, state: p.state || 'new',
        strength: p.strength || 0, dueAt: p.dueAt || 0, latestTs: root.latestTs || root.firstTs || 0,
        familyCount: (root.family || []).length, variants: root.variants || [],
        entries: root.entries || []
      });
    });
    function rank(state) {
      return { new: 0, learning: 1, familiar: 2, known: 3 }[state] == null ? 4 : { new: 0, learning: 1, familiar: 2, known: 3 }[state];
    }
    ['en', 'fr', 'de'].forEach(function (language) {
      byLanguage[language].sort(function (a, b) {
        if (sort === 'latest') return (b.latestTs || 0) - (a.latestTs || 0);
        if (sort === 'alphabetical') return collator ? collator.compare(a.display, b.display) : a.display.localeCompare(b.display);
        if (sort === 'family') return (b.familyCount - a.familyCount) || ((b.latestTs || 0) - (a.latestTs || 0));
        return (rank(a.state) - rank(b.state)) ||
          ((a.dueAt || Number.MAX_SAFE_INTEGER) - (b.dueAt || Number.MAX_SAFE_INTEGER)) ||
          ((b.latestTs || 0) - (a.latestTs || 0)) ||
          a.display.localeCompare(b.display);
      });
    });
    return byLanguage;
  }

  function stats() {
    var progress = ensureAllProgress();
    var groups = rootGroups('learning', 'en');
    var roots = ['en', 'fr', 'de'].reduce(function (sum, lang) { return sum.concat(groups[lang] || []); }, []);
    var list = roots.map(function (root) { return progress[root.key]; }).filter(Boolean);
    return {
      total: list.length,
      new: list.filter(function (p) { return p.state === 'new'; }).length,
      learning: list.filter(function (p) { return p.state === 'learning'; }).length,
      familiar: list.filter(function (p) { return p.state === 'familiar'; }).length,
      known: list.filter(function (p) { return p.state === 'known'; }).length,
      due: list.filter(function (p) { return p.state === 'new' || !p.dueAt || p.dueAt <= Date.now(); }).length,
      words: (function () {
        var seen = {};
        list.forEach(function (p) {
          (p.wordIds || []).forEach(function (id) {
            var row = ns.store.findRow(id);
            if (!row) return;
            var key = (row.word || '') + '|' + (row.language || '');
            seen[key] = true;
          });
        });
        return Object.keys(seen).length;
      })()
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

  function reviewRoots(language, outputLang, scope) {
    var progress = ensureAllProgress();
    var index = readIndex();
    var now = Date.now();
    return allRoots().filter(function (root) {
      if (!root.starred || root.language !== language) return false;
      return root.entries.some(function (entry) { return entry.outputLang === outputLang; });
    }).map(function (root) {
      var entry = root.entries.filter(function (item) { return item.outputLang === outputLang; })[0];
      var p = progress[root.key] || {};
      var indexed = (index.entries[entry.id] && index.entries[entry.id].roots || [])
        .filter(function (item) { return item.key === root.key; })[0] || {};
      return {
        key: root.key, display: root.display, meaning: indexed.meaning || p.meaning || root.meaning,
        origin: root.origin, language: root.language, outputLang: outputLang,
        variants: indexed.variants || root.variants || [],
        wordIds: root.entries.map(function (item) { return item.id; }),
        state: p.state || 'new', strength: p.strength || 0, dueAt: p.dueAt || 0,
        intervalIndex: p.intervalIndex || 0, lapses: p.lapses || 0, stage: p.stage || 1
      };
    }).filter(function (root) {
      if (scope === 'new') return root.state === 'new';
      if (scope === 'all') return true;
      return root.state === 'new' || !root.dueAt || root.dueAt <= now;
    });
  }

  function todayQueue(language, outputLang) {
    return reviewRoots(language, outputLang, 'due');
  }

  function rootVersion(rootKey, outputLang) {
    var all = ns.store.readAux('rootVersions', {});
    return all[rootKey + '|' + outputLang] || null;
  }

  function addRootVersion(rootKey, outputLang, value) {
    var all = ns.store.readAux('rootVersions', {});
    all[rootKey + '|' + outputLang] = Object.assign({ ts: Date.now() }, value || {});
    ns.store.writeAux('rootVersions', all);
    return all[rootKey + '|' + outputLang];
  }

  function rootVersionOptions(rootKey) {
    var all = ns.store.readAux('rootVersions', {});
    return Object.keys(all).filter(function (key) {
      return key.indexOf(rootKey + '|') === 0;
    }).map(function (key) { return key.slice(rootKey.length + 1); });
  }

  function recordRootAnswer(key, correct) {
    return correct ? recordStage(key, 3, true) : recordStage(key, 1, false);
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
    todayQueue: todayQueue,
    nextInterval: nextInterval,
    recordStage: recordStage,
    rootVersion: rootVersion,
    addRootVersion: addRootVersion,
    rootVersionOptions: rootVersionOptions,
    rootGroups: rootGroups,
    reviewRoots: reviewRoots,
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
