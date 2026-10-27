/* LINGUIST — local persistence.
   Layout:
     dict.settings          -> { apiKey, outputLang, model, theme, thinking }
     dict.history           -> [{ id, word, language, pos, quickMeaning, ts, starred, status, model, outputLang }]
     dict.entry.<id>        -> full analysis payload for one headword
   Entries are stored individually so a single lookup never rewrites the
   whole corpus, and history is capped by evicting the oldest *unstarred* row. */

window.LINGUIST = window.LINGUIST || {};

(function (ns) {
  'use strict';

  var STORAGE = ns.STORAGE;
  var DEFAULTS = ns.DEFAULT_SETTINGS;
  var MAX_HISTORY = ns.CONFIG.limits.maxHistory;
  /* How many entries to drop when the browser refuses a write. Small enough
     that nobody loses more than they have to, large enough that one prune
     usually buys a real amount of room. */
  var QUOTA_PRUNE_STEP = 20;

  /* Derived from the product name so a rename never invalidates old backups. */
  function exportKind() {
    return ns.CONFIG.appName.toLowerCase() + '-backup';
  }

  /* localStorage can throw in private mode or when the quota is exhausted.
     Fall back to an in-memory map so the app degrades instead of breaking. */
  var memory = {};
  var persistent = true;

  try {
    var probe = '__linguist_probe__';
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

  /* Small named blobs that are neither history nor settings — today that is
     the list of words Surprise has already offered. */
  function readAux(name, fallback) {
    return readJSON(ns.STORAGE_PREFIX + '.' + name, fallback);
  }

  function writeAux(name, value) {
    return writeJSON(ns.STORAGE_PREFIX + '.' + name, value);
  }

  function getSettings() {
    var stored = readJSON(STORAGE.settings, {});
    var result = {};
    for (var key in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
        result[key] = Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : DEFAULTS[key];
      }
    }
    /* One level of copying for the table-valued settings, so a caller that
       edits what it read cannot reach back into the defaults. */
    if (result.outputLangBySource && typeof result.outputLangBySource === 'object') {
      result.outputLangBySource = merge({}, DEFAULTS.outputLangBySource, result.outputLangBySource);
      result.outputLangBySource = merge({}, result.outputLangBySource);
    }
    /* Same one-level copy for the card preferences: Profile edits what it
       reads, and an edit must never reach back into the defaults. */
    if (result.cardPrefs && typeof result.cardPrefs === 'object') {
      var prefs = {};
      Object.keys(result.cardPrefs).forEach(function (group) {
        var row = result.cardPrefs[group] || {};
        prefs[group] = {
          order: Array.isArray(row.order) ? row.order.slice() : [],
          hidden: Array.isArray(row.hidden) ? row.hidden.slice() : []
        };
      });
      result.cardPrefs = prefs;
    }
    return result;
  }

  function merge(target) {
    for (var i = 1; i < arguments.length; i += 1) {
      var source = arguments[i];
      if (!source) continue;
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
      }
    }
    return target;
  }

  /* The explanation language for a source language: the user's own row for it,
     or the fallback when the language is not known yet or has no row. */
  function outputLangFor(language) {
    var settings = getSettings();
    var table = settings.outputLangBySource || {};
    var id = ns.CONFIG.languageByAnyName(language) || language;
    if (id && table[id]) return table[id];
    return settings.outputLang || ns.CONFIG.defaultOutputLang;
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

  /* A fingerprint of the exact spelling: NFC-normalised, so the same letters
     typed on different keyboards (composed vs decomposed accents) land on the
     same entry, but never case-folded — German Essen (the meal) and essen (to
     eat) are different words, and so are French pâte and pète, which the ASCII
     slug below cannot tell apart on its own. */
  function fingerprint(text) {
    var source = String(text == null ? '' : text);
    if (typeof source.normalize === 'function') source = source.normalize('NFC');
    return hash(source);
  }

  function slug(text) {
    var source = String(text || '');
    /* Normalise first: otherwise the same word typed with a composed accent and
       with a combining one produces different readable halves, and the id stops
       being one id. */
    if (typeof source.normalize === 'function') source = source.normalize('NFC');
    var base = source
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

     The slug is for a human reading a key; the fingerprint is what actually
     keeps entries apart. The source language is not optional either: German
     Gift (poison) and English gift share a slug, as do Rat/rat and Bald/bald. */
  function entryId(word, language, model, outputLang) {
    return [slug(word), fingerprint(word), language || 'en', model, outputLang].join('--');
  }

  /* Sentence analyses share the history but live under their own kind. The
     fingerprint is over the whole sentence: truncating to the first six words
     made "I think that it is a good idea" and "…a bad idea" the same entry. */
  function sentenceId(text, language, model, outputLang) {
    var source = String(text || '');
    return [slug(source.split(/\s+/).slice(0, 6).join(' ')), fingerprint(source), 'sentence',
      language || 'en', model, outputLang].join('--');
  }

  /* A document's identity is its name plus a fingerprint of its text, so the
     same file analysed twice is one entry and two different files that happen
     to share a name are two. Hashing the whole text would mean walking 200,000
     characters on every save, so it hashes the length and the opening — enough
     that no two files a person actually uploads can collide. */
  /* The whole text, not a sample of it: two files with the same name and the
     same length but different contents are two documents, and hashing only the
     first four thousand characters made them share one entry. One pass over the
     string is cheap even at two hundred thousand characters. */
  function documentId(name, text, language, model, outputLang) {
    return [slug(name), fingerprint(String(name || '') + '#' + String(text || '')),
      'document', language || 'en', model, outputLang].join('--');
  }

  function discoveryId(word, language, model, outputLang) {
    return [slug(word), fingerprint(String(word || '') + '#' + String(language || '')),
      'discovery', model, outputLang].join('--');
  }

  /* ---------- History index ---------- */

  /* The index and the wordbooks are small and are read constantly — every
     isStarred, findRow and wordbooksFor call used to re-read and re-parse the
     whole table, which made the favourites screen quadratic. They are cached in
     memory and every write goes through the cache, so there is one parse per
     session instead of one per question. Entry payloads are still read on
     demand: they are the big objects. */
  var cache = { history: null, wordbooks: null };

  function listHistory() {
    if (!cache.history) {
      var rows = readJSON(STORAGE.history, []);
      cache.history = Array.isArray(rows) ? rows : [];
    }
    return cache.history;
  }

  function saveHistory(rows) {
    cache.history = Array.isArray(rows) ? rows : [];
    writeJSON(STORAGE.history, cache.history);
    return cache.history;
  }

  function findRow(id) {
    var rows = listHistory();
    for (var i = 0; i < rows.length; i += 1) {
      if (rows[i].id === id) return rows[i];
    }
    return null;
  }

  /* Rows for different explanation languages are versions of one entry. The
     stored rows stay separate (each payload has its own id), but every screen
     works with one virtual group row: the earliest version is the reading
     order's "first language", the latest timestamp decides history order, and
     deleting the group removes every version. */
  function groupKeyOf(row) {
    if (!row) return '';
    return [row.kind || 'word', String(row.word || '').normalize('NFC'),
      row.language || '', row.model || '', row.sourceLangArg || ''].join('|');
  }

  function versionRows(id) {
    var row = findRow(id);
    if (!row) return [];
    var key = groupKeyOf(row);
    return listHistory().filter(function (item) { return groupKeyOf(item) === key; });
  }

  function listGroups() {
    var byKey = {};
    var order = [];
    listHistory().forEach(function (row) {
      var key = groupKeyOf(row);
      if (!byKey[key]) { byKey[key] = []; order.push(key); }
      byKey[key].push(row);
    });
    return order.map(function (key) {
      var versions = byKey[key].slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
      var primary = versions[0];
      var latest = versions[versions.length - 1];
      var group = JSON.parse(JSON.stringify(primary));
      group.id = primary.id;
      group.groupKey = key;
      group.firstOutputLang = primary.outputLang || '';
      group.outputLang = primary.outputLang || '';
      group.ts = latest.ts || primary.ts || 0;
      group.starred = versions.some(function (row) { return !!row.starred; });
      group.versions = versions.map(function (row) {
        return { id: row.id, outputLang: row.outputLang || '', ts: row.ts || 0, starred: !!row.starred };
      });
      return group;
    }).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  }

  /* Upsert: the index stays in timestamp order, and the same id never appears
     twice. Inserting by position rather than always unshifting matters because
     a saved entry does not have to be the newest one — an imported backup or a
     regenerated entry carries an older stamp. */
  function upsertRow(row) {
    var rows = listHistory().filter(function (item) { return item.id !== row.id; });
    var at = 0;
    while (at < rows.length && (rows[at].ts || 0) > (row.ts || 0)) at += 1;
    rows.splice(at, 0, row);
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

  function removeGroup(id) {
    var rows = versionRows(id);
    if (!rows.length) rows = findRow(id) ? [findRow(id)] : [];
    var ids = rows.map(function (row) { return row.id; });
    saveHistory(listHistory().filter(function (item) { return ids.indexOf(item.id) < 0; }));
    ids.forEach(function (versionId) { rawRemove(STORAGE.entryPrefix + versionId); });
    var rootIndex = readJSON(STORAGE.rootIndex, null);
    if (rootIndex && rootIndex.entries) {
      ids.forEach(function (versionId) { delete rootIndex.entries[versionId]; });
      writeJSON(STORAGE.rootIndex, rootIndex);
    }
    /* Do not leave a dangling reference behind in any wordbook. */
    var books = listWordbooks();
    var changed = false;
    books.forEach(function (book) {
      var next = book.entries.filter(function (entry) { return ids.indexOf(entry) < 0; });
      if (next.length !== book.entries.length) { book.entries = next; changed = true; }
    });
    if (changed) saveWordbooks(books);
    if (ns.events) ns.events.emit('catalog:changed');
  }

  /* Keep the historical single-row primitive for callers that are explicitly
     re-keying one payload. User-facing deletion uses removeGroup. */
  function removeEntry(id) {
    saveHistory(listHistory().filter(function (item) { return item.id !== id; }));
    rawRemove(STORAGE.entryPrefix + id);
    var rootIndex = readJSON(STORAGE.rootIndex, null);
    if (rootIndex && rootIndex.entries && rootIndex.entries[id]) {
      delete rootIndex.entries[id];
      writeJSON(STORAGE.rootIndex, rootIndex);
    }
    var books = listWordbooks();
    var changed = false;
    books.forEach(function (book) {
      var next = book.entries.filter(function (entry) { return entry !== id; });
      if (next.length !== book.entries.length) { book.entries = next; changed = true; }
    });
    if (changed) saveWordbooks(books);
  }

  /* Emergency room-making for a full quota. Only unstarred rows, oldest first,
     and it reports how many it managed to drop so the caller can tell whether
     a retry is worth attempting. */
  function pruneOldest(count) {
    var rows = listHistory();
    var wanted = count || QUOTA_PRUNE_STEP;
    var removed = 0;
    for (var i = rows.length - 1; i >= 0 && removed < wanted; i -= 1) {
      if (rows[i].starred) continue;
      rawRemove(STORAGE.entryPrefix + rows[i].id);
      rows.splice(i, 1);
      removed += 1;
    }
    if (!removed) return 0;
    saveHistory(rows);
    unlinkMissing(rows);
    return removed;
  }

  /* Wordbooks may still point at entries that were just evicted. */
  function unlinkMissing(rows) {
    var alive = {};
    (rows || listHistory()).forEach(function (row) { alive[row.id] = true; });
    var books = listWordbooks();
    var changed = false;
    books.forEach(function (book) {
      var next = book.entries.filter(function (id) { return alive[id]; });
      if (next.length !== book.entries.length) { book.entries = next; changed = true; }
    });
    if (changed) saveWordbooks(books);
    return changed;
  }

  /* ---------- Wordbooks ----------
     A wordbook is a named subset of the favourites, so every member is also
     starred. Adding to a book stars the word; removing a book never unstars
     anything, and deleting a book never deletes a word. */

  var SURPRISE_BOOK_ID = 'surprise';

  function listWordbooks() {
    if (!cache.wordbooks) {
      var books = readJSON(STORAGE.wordbooks, []);
      cache.wordbooks = Array.isArray(books) ? books : [];
    }
    return cache.wordbooks;
  }

  function saveWordbooks(books) {
    cache.wordbooks = Array.isArray(books) ? books : [];
    writeJSON(STORAGE.wordbooks, cache.wordbooks);
    return cache.wordbooks;
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
    if (id === SURPRISE_BOOK_ID) return false;
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
    if (id === SURPRISE_BOOK_ID) return false;
    var books = listWordbooks();
    var next = books.filter(function (book) { return book.id !== id; });
    if (next.length === books.length) return false;
    saveWordbooks(next);
    return true;
  }

  function addToWordbook(bookId, id) {
    var entry = getEntry(id);
    var discovery = !!(entry && entry.kind === 'discovery');
    if (bookId === SURPRISE_BOOK_ID && !discovery) return false;
    if (bookId !== SURPRISE_BOOK_ID && discovery) return false;
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

  function ensureSurpriseBook() {
    var book = findWordbook(SURPRISE_BOOK_ID);
    if (book) return book;
    var books = listWordbooks();
    book = { id: SURPRISE_BOOK_ID, name: 'Surprise me', ts: Date.now(), entries: [] };
    books.push(book);
    saveWordbooks(books);
    return book;
  }

  function saveDiscovery(entry) {
    if (!entry || !entry.id || entry.kind !== 'discovery') return null;
    if (!writeJSON(STORAGE.entryPrefix + entry.id, entry)) return null;
    upsertRow({
      id: entry.id,
      word: entry.word,
      kind: 'discovery',
      language: '',
      languageName: entry.languageName || entry.language || '',
      languageCode: entry.languageCode || '',
      pos: '',
      quickMeaning: entry.coreMeaning || entry.quickMeaning || '',
      reading: entry.pronunciation || '',
      rootNote: entry.rootNote || '',
      ts: entry.ts || Date.now(),
      starred: !!entry.starred,
      status: 'ok',
      model: entry.model || '',
      outputLang: entry.outputLang || ''
    });
    if (entry.starred) addToWordbook(ensureSurpriseBook().id, entry.id);
    if (ns.events) ns.events.emit('catalog:changed');
    return entry;
  }

  /* ---------- Entry payloads ---------- */

  function getEntry(id) {
    var entry = readJSON(STORAGE.entryPrefix + id, null);
    return entry && typeof entry === 'object' ? entry : null;
  }

  /* What actually goes to disk. A document keeps an excerpt of its source — the
     translation is what a reader comes back for, and a 200,000-character source
     beside it would use most of the quota for one file. The entry in memory
     keeps the whole text, so the session can still resume or re-run it, and the
     stored copy says so with `textTruncated` so the page can explain itself. */
  function forStorage(entry) {
    var limit = ns.CONFIG.limits.document.keepSource;
    if (!entry || entry.kind !== 'document') return entry;
    if (typeof entry.text !== 'string' || entry.text.length <= limit) return entry;
    var copy = merge({}, entry);
    copy.text = entry.text.slice(0, limit);
    copy.textTruncated = true;
    return copy;
  }

  function saveEntry(entry) {
    var ok = writeJSON(STORAGE.entryPrefix + entry.id, forStorage(entry));
    if (!ok) {
      /* Storage full. Writing the row without its payload is the worst outcome:
         the history keeps a row that opens to "Entry not on this device", and
         it never expires. Make room and try once more instead. */
      pruneOldest(QUOTA_PRUNE_STEP);
      ok = writeJSON(STORAGE.entryPrefix + entry.id, forStorage(entry));
    }
    if (!ok) return null;
    upsertRow({
      id: entry.id,
      word: entry.word,
      /* 'word' or 'sentence' — the history mixes both, so the row must say
         which it is rather than being inferred from the id. */
      kind: entry.kind || 'word',
      /* 'auto' is a picker state, not a language. Letting it through is what
         put a language-less row in history and in the favourites, where it
         could not be grouped or analysed correctly. */
      language: entry.language && entry.language !== 'auto' ? entry.language : '',
      languageName: entry.languageName || '',
      languageCode: entry.languageCode || '',
      pos: entry.pos || '',
      quickMeaning: entry.overview && entry.overview.quick_meaning ? entry.overview.quick_meaning : '',
      /* Kept on the row so the practice pool can be computed without loading
         every entry payload — Chinese and Japanese need a reading to be
         practisable at all. */
      reading: entry.overview && entry.overview.reading ? entry.overview.reading : '',
      rootNote: entry.rootNote || '',
      ts: entry.ts || Date.now(),
      starred: !!(entry.starred),
      status: entry.status || 'ok',
      model: entry.model || '',
      outputLang: entry.outputLang || ''
    });
    return ok ? entry : null;
  }

  /* Rewrites an entry's language in place, for rows stored before 4.2 that
     never had one. `dropLines` is for the entries whose deep lines were
     generated from the wrong language's prompt — keeping them would mean
     showing English-prompts analysis under a Japanese badge. */
  function setLanguage(id, language, dropLines) {
    var rows = listHistory();
    var found = false;
    rows.forEach(function (row) {
      if (row.id !== id) return;
      row.language = language;
      found = true;
    });
    if (found) saveHistory(rows);

    var entry = getEntry(id);
    if (entry) {
      entry.language = language;
      if (dropLines) entry.lines = {};
      writeJSON(STORAGE.entryPrefix + id, entry);
    }
    return found || !!entry;
  }

  function toggleStar(id) {
    var rows = listHistory();
    var group = versionRows(id);
    if (!group.length) return false;
    var starred = !group.some(function (item) { return !!item.starred; });
    group.forEach(function (item) {
      rows.forEach(function (candidate) {
        if (candidate.id === item.id) candidate.starred = starred;
      });
    });
    saveHistory(rows);
    group.forEach(function (item) {
      var entry = getEntry(item.id);
      if (entry) {
        entry.starred = starred;
        writeJSON(STORAGE.entryPrefix + item.id, entry);
      }
    });
    var row = group[0];
    if (row && row.kind === 'discovery') {
      if (starred) addToWordbook(ensureSurpriseBook().id, row.id);
      else listWordbooks().forEach(function (book) {
        group.forEach(function (item) { removeFromWordbook(book.id, item.id); });
      });
    }
    if (ns.events) ns.events.emit('catalog:changed');
    return starred;
  }

  function isStarred(id) {
    return versionRows(id).some(function (row) { return !!row.starred; });
  }

  /* ---------- Bulk operations ---------- */

  function clearHistory() {
    listHistory().forEach(function (row) {
      if (!row.starred) rawRemove(STORAGE.entryPrefix + row.id);
    });
    saveHistory(listHistory().filter(function (row) { return row.starred; }));
  }

  /* Clearing the stars keeps every entry, which is what the confirm says.
     The wordbooks are emptied because membership implies starred — a book
     whose words are no longer starred would show rows the Starred screen
     filters out. The confirm says that too. */
  function clearStarred() {
    saveHistory(listHistory().map(function (row) {
      row.starred = false;
      return row;
    }));
    var books = listWordbooks();
    books.forEach(function (book) { book.entries = []; });
    saveWordbooks(books);
  }

  function isPersistent() {
    return persistent;
  }

  /* What this app is using, so Profile can say so. The browser's own estimate
     is better when it exists, but it is not available on file:// or in every
     engine, so the fallback counts our own keys. */
  function storageReport() {
    var bytes = 0;
    var keys = 0;
    try {
      var store = window.localStorage;
      if (typeof store.length === 'number' && typeof store.key === 'function') {
        for (var i = 0; i < store.length; i += 1) {
          var key = store.key(i);
          if (!key || key.indexOf(ns.STORAGE_PREFIX) !== 0) continue;
          keys += 1;
          bytes += key.length + String(store.getItem(key) || '').length;
        }
      } else {
        return { entries: listHistory().length, keys: -1, bytes: -1, persistent: persistent };
      }
    } catch (err) {
      bytes = -1;
    }
    return { entries: listHistory().length, keys: keys, bytes: bytes, persistent: persistent };
  }

  /* Enough to put an entry back exactly as it was, for an undo. */
  function snapshotEntry(id) {
    if (!id) return null;
    var rows = versionRows(id);
    if (!rows.length && findRow(id)) rows = [findRow(id)];
    var snapshot = {
      rows: rows,
      entries: rows.reduce(function (map, row) {
        map[row.id] = getEntry(row.id);
        return map;
      }, {}),
      books: listWordbooks().filter(function (book) {
        return rows.some(function (row) { return book.entries.indexOf(row.id) > -1; });
      }).map(function (book) { return book.id; })
    };
    snapshot.row = rows[0] || null;
    snapshot.entry = snapshot.row ? snapshot.entries[snapshot.row.id] : null;
    return JSON.parse(JSON.stringify(snapshot));
  }

  function restoreEntry(snapshot) {
    if (!snapshot) return false;
    var rows = snapshot.rows || (snapshot.row ? [snapshot.row] : []);
    if (!rows.length || !rows[0].id) return false;
    rows.forEach(function (row) {
      var entry = snapshot.entries ? snapshot.entries[row.id] : (row.id === (snapshot.row && snapshot.row.id) ? snapshot.entry : null);
      if (entry) writeJSON(STORAGE.entryPrefix + row.id, entry);
      upsertRow(row);
    });
    if (snapshot.books && snapshot.books.length) {
      var books = listWordbooks();
      books.forEach(function (book) {
        if (snapshot.books.indexOf(book.id) < 0) return;
        rows.forEach(function (row) {
          if (book.entries.indexOf(row.id) < 0) book.entries.push(row.id);
        });
      });
      saveWordbooks(books);
    }
    return true;
  }

  function exportAll() {
    var rows = listHistory();
    var entries = {};
    rows.forEach(function (row) {
      var entry = getEntry(row.id);
      if (entry) entries[row.id] = entry;
    });
    /* A copy, not the live structures: the index is cached in memory now, so
       handing out references would let a later edit reach back into a backup
       that was already "taken". */
    var payload = JSON.parse(JSON.stringify({
      history: rows,
      entries: entries,
      wordbooks: listWordbooks()
    }));
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
      history: payload.history,
      entries: payload.entries,
      rootProgress: readJSON(STORAGE.rootProgress, {}),
      rootIndex: readJSON(STORAGE.rootIndex, null),
      /* Wordbooks are the user's own curation; leaving them out meant a backup
         round-trip silently threw them away. */
      wordbooks: payload.wordbooks
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
        /* kind and reading decide whether a row is a sentence and whether a
           Chinese or Japanese word can be practised at all. Dropping them made
           restored sentences look like headwords. */
        kind: row.kind || 'word',
        language: row.language || '',
        languageName: row.languageName || '',
        languageCode: row.languageCode || '',
        pos: row.pos || '',
        quickMeaning: row.quickMeaning || '',
        reading: row.reading || '',
        rootNote: row.rootNote || '',
        ts: row.ts || Date.now(),
        starred: !!(row.starred || (existing && existing.starred)),
        status: row.status || 'ok',
        model: row.model || '',
        outputLang: row.outputLang || '',
        sourceLangArg: row.sourceLangArg || ''
      };
    });

    var merged = Object.keys(byId).map(function (key) { return byId[key]; });
    merged.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    prune(merged);
    saveHistory(merged);
    restoreWordbooks(payload.wordbooks);
    if (payload.rootProgress && typeof payload.rootProgress === 'object') {
      var progress = readJSON(STORAGE.rootProgress, {});
      Object.keys(payload.rootProgress).forEach(function (key) {
        var next = payload.rootProgress[key];
        var old = progress[key];
        if (!old || (next.lastSeen || 0) >= (old.lastSeen || 0)) progress[key] = next;
      });
      writeJSON(STORAGE.rootProgress, progress);
    }
    if (payload.rootIndex && typeof payload.rootIndex === 'object') {
      writeJSON(STORAGE.rootIndex, payload.rootIndex);
      if (ns.roots) ns.roots.invalidate();
    }

    if (payload.settings && typeof payload.settings === 'object') {
      var safe = {};
      /* Everything the user chose, except the API key. A backup that restored
         the history but reset the explanation language, the interface language
         or the card preferences would be a backup of half a setup. */
      ['outputLang', 'outputLangBySource', 'model', 'theme', 'thinking',
        'uiLang', 'queryLang', 'queryMode', 'cardPrefs', 'rootSort', 'poolWarmupNotice', 'tourDone'].forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(payload.settings, key)) safe[key] = payload.settings[key];
      });
      patchSettings(safe);
    }
    return restored;
  }

  /* Wordbooks arrive whole, so this merges by id rather than replacing: a
     backup restored into a browser that already has books must not drop them. */
  function restoreWordbooks(incoming) {
    if (!Array.isArray(incoming) || !incoming.length) return 0;
    var byId = {};
    listWordbooks().forEach(function (book) { byId[book.id] = book; });
    var alive = {};
    listHistory().forEach(function (row) { alive[row.id] = true; });
    var merged = 0;
    incoming.forEach(function (book) {
      if (!book || !book.id || !book.name) return;
      var previous = byId[book.id];
      var entries = (previous ? previous.entries : []).concat(Array.isArray(book.entries) ? book.entries : []);
      var seen = {};
      byId[book.id] = {
        id: book.id,
        name: book.name,
        ts: book.ts || (previous && previous.ts) || Date.now(),
        entries: entries.filter(function (id) {
          if (!id || seen[id] || !alive[id]) return false;
          seen[id] = true;
          return true;
        })
      };
      merged += 1;
    });
    saveWordbooks(Object.keys(byId).map(function (key) { return byId[key]; }));
    return merged;
  }

  /* ---------- Import from an older Linguist ----------
     A version folder keeps its own prefix, so upgrading is a read, never a
     rewrite: the old data stays exactly where it was and stays usable by the
     old build. Rows come across re-keyed with the current id scheme, which is
     also what de-duplicates them — the same word looked up once on Auto and
     once with a pinned language used to be two rows, and becomes one. Running
     this twice changes nothing. */

  function importedAlready() {
    return !!rawGet(STORAGE.imported);
  }

  function markImported(label) {
    rawSet(STORAGE.imported, JSON.stringify({ at: Date.now(), from: label || '' }));
  }

  function importFrom(prefix) {
    var rows = readJSON(prefix + '.history', []);
    if (!Array.isArray(rows) || !rows.length) return { entries: 0, wordbooks: 0, settings: null };

    var settings = readJSON(prefix + '.settings', null);
    var byId = {};
    listHistory().forEach(function (row) { byId[row.id] = row; });

    var imported = 0;
    var idMap = {};
    rows.forEach(function (row) {
      if (!row || !row.id) return;
      var entry = readJSON(prefix + '.entry.' + row.id, null);
      var word = (entry && entry.word) || row.word;
      if (!word) return;
      var kind = (entry && entry.kind) || row.kind || 'word';
      var language = (entry && entry.language) || row.language || 'en';
      var model = (entry && entry.model) || row.model || ns.CONFIG.defaultModel;
      var outputLang = (entry && entry.outputLang) || row.outputLang || ns.CONFIG.defaultOutputLang;
      var id = kind === 'sentence'
        ? sentenceId((entry && (entry.text || entry.word)) || word, language, model, outputLang)
        : entryId(word, language, model, outputLang);
      idMap[row.id] = id;

      var next = entry || {
        id: id, kind: kind, word: word, language: language, status: row.status || 'ok',
        overview: { status: 'ok', language: language, quick_meaning: row.quickMeaning || '' }
      };
      next.id = id;
      next.kind = kind;
      next.language = language;
      next.model = model;
      next.outputLang = outputLang;
      /* The language argument is no longer part of the key, but it is still the
         thing a re-query replays, so it has to survive the trip. */
      if (!next.sourceLangArg) next.sourceLangArg = row.sourceLangArg || language || 'auto';
      if (!writeJSON(STORAGE.entryPrefix + id, next)) return;

      var existing = byId[id];
      byId[id] = {
        id: id,
        word: next.word,
        kind: kind,
        language: language,
        pos: row.pos || '',
        quickMeaning: row.quickMeaning || (next.overview && next.overview.quick_meaning) || '',
        reading: row.reading || (next.overview && next.overview.reading) || '',
        ts: Math.max(row.ts || 0, (existing && existing.ts) || 0) || Date.now(),
        starred: !!(row.starred || (existing && existing.starred)),
        status: row.status || 'ok',
        model: model,
        outputLang: outputLang,
        sourceLangArg: next.sourceLangArg
      };
      imported += 1;
    });

    var merged = Object.keys(byId).map(function (key) { return byId[key]; });
    merged.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    prune(merged);
    saveHistory(merged);

    var books = readJSON(prefix + '.wordbooks', []);
    var restored = 0;
    if (Array.isArray(books) && books.length) {
      restored = restoreWordbooks(books.map(function (book) {
        return {
          id: book.id,
          name: book.name,
          ts: book.ts,
          entries: (book.entries || []).map(function (old) { return idMap[old]; }).filter(Boolean)
        };
      }));
    }

    return { entries: imported, wordbooks: restored, settings: settings && typeof settings === 'object' ? settings : null };
  }

  /* The first 4.x build that has anything to offer. */
  function importableSource() {
    for (var i = 0; i < ns.IMPORT_SOURCES.length; i += 1) {
      var source = ns.IMPORT_SOURCES[i];
      var rows = readJSON(source.prefix + '.history', []);
      if (Array.isArray(rows) && rows.length) return source;
    }
    return null;
  }

  ns.store = {
    getSettings: getSettings,
    saveSettings: saveSettings,
    patchSettings: patchSettings,
    readAux: readAux,
    writeAux: writeAux,
    outputLangFor: outputLangFor,
    entryId: entryId,
    sentenceId: sentenceId,
    documentId: documentId,
    discoveryId: discoveryId,
    listHistory: listHistory,
    listGroups: listGroups,
    versionsFor: versionRows,
    groupKeyOf: groupKeyOf,
    getEntry: getEntry,
    saveEntry: saveEntry,
    setLanguage: setLanguage,
    findRow: findRow,
    toggleStar: toggleStar,
    isStarred: isStarred,
    removeEntry: removeEntry,
    removeGroup: removeGroup,
    clearHistory: clearHistory,
    clearStarred: clearStarred,
    exportAll: exportAll,
    importAll: importAll,
    importFrom: importFrom,
    importableSource: importableSource,
    importedAlready: importedAlready,
    markImported: markImported,
    pruneOldest: pruneOldest,
    isPersistent: isPersistent,
    storageReport: storageReport,
    snapshotEntry: snapshotEntry,
    restoreEntry: restoreEntry,
    listWordbooks: listWordbooks,
    findWordbook: findWordbook,
    createWordbook: createWordbook,
    renameWordbook: renameWordbook,
    removeWordbook: removeWordbook,
    addToWordbook: addToWordbook,
    removeFromWordbook: removeFromWordbook,
    wordbooksFor: wordbooksFor,
    ensureSurpriseBook: ensureSurpriseBook,
    saveDiscovery: saveDiscovery,
    SURPRISE_BOOK_ID: SURPRISE_BOOK_ID
  };
})(window.LINGUIST);
