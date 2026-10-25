/* LINGUIST — the Surprise word pool.

   Surprise should feel infinite without asking the model on every tap. A pool
   is filled in 100-word batches, persisted locally, and drawn with a stable
   used flag. The client owns duplicate rejection; the prompt only receives a
   short recent-avoid list. */

window.LINGUIST = window.LINGUIST || {};

(function (ns) {
  'use strict';

  var LIMITS = ns.CONFIG.limits.surprisePool;
  var generating = null;

  function norm(text) {
    var value = String(text == null ? '' : text);
    if (typeof value.normalize === 'function') value = value.normalize('NFC');
    return value.trim().toLowerCase();
  }

  function hash(text) {
    var value = norm(text);
    var h = 2166136261;
    for (var i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  function keyOf(item) {
    return hash(norm(item.language) + ':' + norm(item.word));
  }

  function readState() {
    var state = ns.store.readAux('surprisePool', null);
    if (!state || typeof state !== 'object') {
      state = { items: [], seen: [], seenNames: [], batches: 0 };
    }
    if (!Array.isArray(state.items)) state.items = [];
    if (!Array.isArray(state.seen)) state.seen = [];
    if (!Array.isArray(state.seenNames)) state.seenNames = [];
    state.batches = Number(state.batches) || 0;
    return state;
  }

  function writeState(state) {
    state.items = state.items.slice(-1000);
    state.seen = state.seen.slice(-LIMITS.seenMax);
    state.seenNames = state.seenNames.slice(-100);
    ns.store.writeAux('surprisePool', state);
    return state;
  }

  function isLive(language, code) {
    var id = ns.CONFIG.languageByAnyName(code) || ns.CONFIG.languageByAnyName(language);
    return !!id && ns.CONFIG.queryLanguages.some(function (lang) { return lang.id === id; });
  }

  function languageId(item) {
    return ns.CONFIG.languageByAnyName(item.code) || ns.CONFIG.languageByAnyName(item.language) || '';
  }

  function append(state, rows) {
    var seen = {};
    state.seen.forEach(function (h) { seen[h] = true; });
    var byId = {};
    state.items.forEach(function (item) { byId[keyOf(item)] = true; });
    var added = 0;
    (rows || []).forEach(function (row) {
      if (!row || !row.word || !row.language) return;
      var key = keyOf(row);
      if (seen[key] || byId[key]) return;
      seen[key] = true;
      byId[key] = true;
      state.items.push({
        word: row.word,
        language: row.language,
        code: row.code || '',
        native: row.native || row.language,
        theme: row.theme || '',
        live: isLive(row.language, row.code),
        batch: state.batches + 1,
        used: false
      });
      added += 1;
    });
    state.batches += 1;
    return added;
  }

  function generate(pinned, settings, count) {
    var sourceLang = pinned && pinned !== ns.CONFIG.autoLang ? pinned : 'auto';
    var out = ns.store.outputLangFor(sourceLang);
    var avoid = readState().seenNames.slice(-100);
    return ns.api.surprisePool({
      apiKey: settings.apiKey,
      model: settings.model,
      sourceLang: sourceLang,
      outputLang: out,
      count: count,
      avoid: avoid
    }).then(function (rows) {
      var state = readState();
      append(state, rows);
      rows.forEach(function (row) {
        var key = keyOf(row);
        if (state.seen.indexOf(key) < 0) state.seen.push(key);
        state.seenNames.push(row.word);
      });
      writeState(state);
      return state;
    });
  }

  function fillOnce(pinned, settings) {
    var state = readState();
    var count = pinned && pinned !== ns.CONFIG.autoLang ? LIMITS.topUp : LIMITS.batch;
    if (generating) return generating;
    generating = generate(pinned, settings, count).then(function (next) {
      generating = null;
      return next;
    }).catch(function (error) {
      generating = null;
      throw error;
    });
    return generating;
  }

  function candidates(state, pinned) {
    var auto = !pinned || pinned === ns.CONFIG.autoLang;
    return state.items.filter(function (item) {
      if (item.used) return false;
      return auto ? true : languageId(item) === pinned;
    });
  }

  function allUnused(state) {
    return state.items.filter(function (item) { return !item.used; });
  }

  function random(list) {
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  function markUsed(item) {
    var state = readState();
    var key = keyOf(item);
    state.items.forEach(function (entry) {
      if (keyOf(entry) === key) entry.used = true;
    });
    if (state.seen.indexOf(key) < 0) state.seen.push(key);
    state.seenNames.push(item.word);
    writeState(state);
  }

  function topUpInBackground(pinned, settings, state) {
    var matching = candidates(state, pinned).length;
    var totalUnused = allUnused(state).length;
    var needs = pinned && pinned !== ns.CONFIG.autoLang
      ? matching < LIMITS.lowWater
      : totalUnused < LIMITS.lowWater;
    if (!needs || generating) return;
    fillOnce(pinned, settings).catch(function () { /* keep the old pool */ });
  }

  /* Pick one usable item. The first request of a fresh pool is awaited; the
     second half of an Auto pool is filled in the background. */
  function pick(pinned, settings) {
    var state = readState();
    var matching = candidates(state, pinned);
    var pickNow = random(matching);
    if (pickNow) {
      markUsed(pickNow);
      topUpInBackground(pinned, settings, state);
      return Promise.resolve({ item: pickNow, fallback: false });
    }

    var auto = !pinned || pinned === ns.CONFIG.autoLang;
    var wanted = auto ? LIMITS.batch : LIMITS.topUp;
    return generate(pinned, settings, wanted).then(function (next) {
      var got = random(candidates(next, pinned));
      if (got) {
        markUsed(got);
        if (auto) {
          setTimeout(function () {
            fillOnce(ns.CONFIG.autoLang, settings).catch(function () {});
          }, 10);
        }
        return { item: got, fallback: false };
      }
      var fallback = random(allUnused(next));
      if (!fallback) return null;
      markUsed(fallback);
      return { item: fallback, fallback: true };
    });
  }

  function stats() {
    var state = readState();
    return {
      total: state.items.length,
      unused: allUnused(state).length,
      used: state.items.filter(function (item) { return item.used; }).length,
      batches: state.batches,
      generating: !!generating
    };
  }

  function reset() {
    writeState({ items: [], seen: [], seenNames: [], batches: 0 });
  }

  ns.pool = {
    pick: pick,
    stats: stats,
    reset: reset,
    readState: readState,
    markUsed: markUsed,
    keyOf: keyOf,
    _append: append,
    _candidates: candidates,
    _random: random
  };
})(window.LINGUIST);
