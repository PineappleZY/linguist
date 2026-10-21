/* RADICLE — local persistence.
   Layout:
     dict.settings          -> { apiKey, outputLang, model, theme, thinking }
     dict.history           -> [{ id, word, language, pos, quickMeaning, ts, starred, status, model, outputLang }]
     dict.entry.<id>        -> full analysis payload for one headword
   Entries are stored individually so a single lookup never rewrites the
   whole corpus, and history is capped by evicting the oldest *unstarred* row. */

window.RADICLE = window.RADICLE || {};

(function (ns) {
  'use strict';

  var STORAGE = ns.STORAGE;
  var DEFAULTS = ns.DEFAULT_SETTINGS;
  var MAX_HISTORY = ns.CONFIG.limits.maxHistory;

  /* Derived from the product name so a rename never invalidates old backups. */
  function exportKind() {
    return ns.CONFIG.appName.toLowerCase() + '-backup';
  }

  /* localStorage can throw in private mode or when the quota is exhausted.
     Fall back to an in-memory map so the app degrades instead of breaking. */
  var memory = {};
  var persistent = true;

  try {
    var probe = '__radicle_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  } catch (err) {
    persistent = false;
  }

  function rawGet(key) {
    if (!persistent) return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function rawSet(key, value) {
    if (!persistent) {
      memory[key] = value;
      return true;
    }
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function rawRemove(key) {
    delete memory[key];
    if (!persistent) return;
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      /* ignore */
    }
  }

  function readJSON(key, fallback) {
    var value = rawGet(key);
    if (value == null || value === '') return fallback;
    try {
      var parsed = JSON.parse(value);
      return parsed == null ? fallback : parsed;
    } catch (err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    return rawSet(key, JSON.stringify(value));
  }

  /* ---------- Settings ---------- */

  function getSettings() {
    var stored = readJSON(STORAGE.settings, {});
    var result = {};
    for (var key in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
        result[key] = Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : DEFAULTS[key];
      }
    }
    return result;
  }

  function saveSettings(settings) {
    writeJSON(STORAGE.settings, settings);
    return settings;
  }

  function patchSettings(patch) {
    var next = getSettings();
    for (var key in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) next[key] = patch[key];
    }
    return saveSettings(next);
  }

  /* ---------- Entry identity ---------- */

  /* Deterministic 32-bit hash, used only as a fallback below. */
  function hash(text) {
    var value = 5381;
    var source = String(text || '');
    for (var i = 0; i < source.length; i += 1) {
      value = ((value << 5) + value + source.charCodeAt(i)) >>> 0;
    }
    return value.toString(36);
  }

  function slug(text) {
    var base = String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);
    if (base) return base;
    /* A word written entirely in non-Latin script — every Chinese and Japanese
       headword — would otherwise slug to the empty string, and every one of
       them would share an entry id and overwrite the others. */
    return 'x' + hash(String(text || ''));
  }

  /* One cache key per "word + source language + model + output language".

     The source language is not optional: German Gift (poison) and English gift
     are the same slug, and so are Rat/rat and Bald/bald. Without the language
     in the key they would overwrite each other. */
  function entryId(word, language, model, outputLang) {
    return [slug(word), language || 'en', model, outputLang].join('--');
  }

  /* Sentence analyses share the history but live under their own kind. */
  function sentenceId(text, language, model, outputLang) {
    return [slug(String(text || '').split(/\s+/).slice(0, 6).join(' ')), 'sentence',
      language || 'en', model, outputLang].join('--');
  }

  /* ---------- History index ---------- */

  function listHistory() {
    var rows = readJSON(STORAGE.history, []);
    return Array.isArray(rows) ? rows : [];
  }

  function saveHistory(rows) {
    writeJSON(STORAGE.history, rows);
    return rows;
  }

  function findRow(id) {
    var rows = listHistory();
    for (var i = 0; i < rows.length; i += 1) {
      if (rows[i].id === id) return rows[i];
    }
    return null;
  }

  /* Upsert: newest first, and the same id never appears twice. */
  function upsertRow(row) {
    var rows = listHistory().filter(function (item) { return item.id !== row.id; });
    rows.unshift(row);
    prune(rows);
    saveHistory(rows);
    return row;
  }

  function prune(rows) {
    if (rows.length <= MAX_HISTORY) return rows;
    /* Walk from the oldest end and drop unstarred rows until we fit. */
    for (var i = rows.length - 1; i >= 0 && rows.length > MAX_HISTORY; i -= 1) {
      if (!rows[i].starred) {
        rawRemove(STORAGE.entryPrefix + rows[i].id);
        rows.splice(i, 1);
      }
    }
    /* If everything left is starred, hard-trim the tail. */
    while (rows.length > MAX_HISTORY) {
      var dropped = rows.pop();
      rawRemove(STORAGE.entryPrefix + dropped.id);
    }
    return rows;
  }

  function removeEntry(id) {
    saveHistory(listHistory().filter(function (item) { return item.id !== id; }));
    rawRemove(STORAGE.entryPrefix + id);
    /* Do not leave a dangling reference behind in any wordbook. */
    var books = listWordbooks();
    var changed = false;
    books.forEach(function (book) {
      var next = book.entries.filter(function (entry) { return entry !== id; });
      if (next.length !== book.entries.length) { book.entries = next; changed = true; }
    });
    if (changed) saveWordbooks(books);
  }

  /* ---------- Wordbooks ----------
     A wordbook is a named subset of the favourites, so every member is also
     starred. Adding to a book stars the word; removing a book never unstars
     anything, and deleting a book never deletes a word. */

  function listWordbooks() {
    var books = readJSON(STORAGE.wordbooks, []);
    return Array.isArray(books) ? books : [];
  }

  function saveWordbooks(books) {
    writeJSON(STORAGE.wordbooks, books);
    return books;
  }

  function findWordbook(id) {
    var books = listWordbooks();
    for (var i = 0; i < books.length; i += 1) {
      if (books[i].id === id) return books[i];
    }
    return null;
  }

  function cleanName(name) {
    return String(name == null ? '' : name).trim().slice(0, ns.CONFIG.limits.maxWordbookName);
  }

  function createWordbook(name) {
    var clean = cleanName(name);
    if (!clean) return null;
    var books = listWordbooks();
    if (books.length >= ns.CONFIG.limits.maxWordbooks) return null;
    var book = {
      id: 'wb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: clean,
      ts: Date.now(),
      entries: []
    };
    books.push(book);
    saveWordbooks(books);
    return book;
  }

  function renameWordbook(id, name) {
    var clean = cleanName(name);
    if (!clean) return false;
    var books = listWordbooks();
    var found = false;
    books.forEach(function (book) {
      if (book.id === id) { book.name = clean; found = true; }
    });
    if (found) saveWordbooks(books);
    return found;
  }

  /* Removes the book only. Its words stay in the favourites. */
  function removeWordbook(id) {
    var books = listWordbooks();
    var next = books.filter(function (book) { return book.id !== id; });
    if (next.length === books.length) return false;
    saveWordbooks(next);
    return true;
  }

  function addToWordbook(bookId, id) {
    var books = listWordbooks();
    var added = false;
    books.forEach(function (book) {
      if (book.id !== bookId) return;
      if (book.entries.indexOf(id) === -1) { book.entries.push(id); added = true; }
    });
    if (added) {
      saveWordbooks(books);
      /* Membership implies favourite. */
      if (!isStarred(id)) toggleStar(id);
    }
    return added;
  }

  function removeFromWordbook(bookId, id) {
    var books = listWordbooks();
    var removed = false;
    books.forEach(function (book) {
      if (book.id !== bookId) return;
      var next = book.entries.filter(function (entry) { return entry !== id; });
      if (next.length !== book.entries.length) { book.entries = next; removed = true; }
    });
    if (removed) saveWordbooks(books);
    return removed;
  }

  /* Which books currently hold this word. */
  function wordbooksFor(id) {
    return listWordbooks().filter(function (book) {
      return book.entries.indexOf(id) > -1;
    });
  }

  /* ---------- Entry payloads ---------- */

  function getEntry(id) {
    var entry = readJSON(STORAGE.entryPrefix + id, null);
    return entry && typeof entry === 'object' ? entry : null;
  }

  function saveEntry(entry) {
    var ok = writeJSON(STORAGE.entryPrefix + entry.id, entry);
    upsertRow({
      id: entry.id,
      word: entry.word,
      /* 'word' or 'sentence' — the history mixes both, so the row must say
         which it is rather than being inferred from the id. */
      kind: entry.kind || 'word',
      language: entry.language || '',
      pos: entry.pos || '',
      quickMeaning: entry.overview && entry.overview.quick_meaning ? entry.overview.quick_meaning : '',
      /* Kept on the row so the practice pool can be computed without loading
         every entry payload — Chinese and Japanese need a reading to be
         practisable at all. */
      reading: entry.overview && entry.overview.reading ? entry.overview.reading : '',
      ts: entry.ts || Date.now(),
      starred: !!(entry.starred),
      status: entry.status || 'ok',
      model: entry.model || '',
      outputLang: entry.outputLang || ''
    });
    return ok ? entry : null;
  }

  function toggleStar(id) {
    var rows = listHistory();
    var starred = false;
    for (var i = 0; i < rows.length; i += 1) {
      if (rows[i].id === id) {
        rows[i].starred = !rows[i].starred;
        starred = rows[i].starred;
      }
    }
    saveHistory(rows);
    var entry = getEntry(id);
    if (entry) {
      entry.starred = starred;
      writeJSON(STORAGE.entryPrefix + id, entry);
    }
    return starred;
  }

  function isStarred(id) {
    var row = findRow(id);
    return !!(row && row.starred);
  }

  /* ---------- Bulk operations ---------- */

  function clearHistory() {
    listHistory().forEach(function (row) {
      if (!row.starred) rawRemove(STORAGE.entryPrefix + row.id);
    });
    saveHistory(listHistory().filter(function (row) { return row.starred; }));
  }

  function clearStarred() {
    listHistory().forEach(function (row) {
      if (row.starred) rawRemove(STORAGE.entryPrefix + row.id);
    });
    saveHistory(listHistory().map(function (row) {
      row.starred = false;
      return row;
    }));
  }

  function isPersistent() {
    return persistent;
  }

  function exportAll() {
    var rows = listHistory();
    var entries = {};
    rows.forEach(function (row) {
      var entry = getEntry(row.id);
      if (entry) entries[row.id] = entry;
    });
    return {
      app: ns.CONFIG.appName,
      kind: exportKind(),
      version: ns.CONFIG.version,
      exportedAt: new Date().toISOString(),
      /* The API key is deliberately excluded from exports. */
      settings: (function () {
        var s = getSettings();
        delete s.apiKey;
        return s;
      })(),
      history: rows,
      entries: entries
    };
  }

  /* Returns the number of restored entries. Throws on malformed input. */
  function importAll(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Not a backup file.');
    if (typeof payload.kind !== 'string' || !/-backup$/.test(payload.kind)) {
      throw new Error('This file was not produced by ' + ns.CONFIG.appName + '.');
    }

    var rows = Array.isArray(payload.history) ? payload.history : [];
    var entries = payload.entries && typeof payload.entries === 'object' ? payload.entries : {};
    var byId = {};
    listHistory().forEach(function (row) { byId[row.id] = row; });

    var restored = 0;
    rows.forEach(function (row) {
      if (!row || !row.id) return;
      var entry = entries[row.id];
      if (entry) {
        writeJSON(STORAGE.entryPrefix + row.id, entry);
        restored += 1;
      }
      var existing = byId[row.id];
      byId[row.id] = {
        id: row.id,
        word: row.word,
        language: row.language || '',
        pos: row.pos || '',
        quickMeaning: row.quickMeaning || '',
        ts: row.ts || Date.now(),
        starred: !!(row.starred || (existing && existing.starred)),
        status: row.status || 'ok',
        model: row.model || '',
        outputLang: row.outputLang || ''
      };
    });

    var merged = Object.keys(byId).map(function (key) { return byId[key]; });
    merged.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    prune(merged);
    saveHistory(merged);

    if (payload.settings && typeof payload.settings === 'object') {
      var safe = {};
      ['outputLang', 'model', 'theme', 'thinking'].forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(payload.settings, key)) safe[key] = payload.settings[key];
      });
      patchSettings(safe);
    }
    return restored;
  }

  ns.store = {
    getSettings: getSettings,
    saveSettings: saveSettings,
    patchSettings: patchSettings,
    entryId: entryId,
    sentenceId: sentenceId,
    listHistory: listHistory,
    getEntry: getEntry,
    saveEntry: saveEntry,
    findRow: findRow,
    toggleStar: toggleStar,
    isStarred: isStarred,
    removeEntry: removeEntry,
    clearHistory: clearHistory,
    clearStarred: clearStarred,
    exportAll: exportAll,
    importAll: importAll,
    isPersistent: isPersistent,
    listWordbooks: listWordbooks,
    findWordbook: findWordbook,
    createWordbook: createWordbook,
    renameWordbook: renameWordbook,
    removeWordbook: removeWordbook,
    addToWordbook: addToWordbook,
    removeFromWordbook: removeFromWordbook,
    wordbooksFor: wordbooksFor
  };
})(window.RADICLE);
