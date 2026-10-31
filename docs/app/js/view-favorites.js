/* LINGUIST — Favourites.

   The whole screen is built on one relationship: a favourite is a starred entry,
   and a wordbook is a named subset of those. So a word can sit in several
   wordbooks or in none, and deleting a wordbook only ever unlinks.

   Practice lives here now. The source selector at the top drives both the list
   below it and the pool the pencil draws from, so the two can never disagree. */

window.LINGUIST = window.LINGUIST || {};
window.LINGUIST.views = window.LINGUIST.views || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var store = ns.store;
  var CONFIG = ns.CONFIG;

  var openPicker = null;   /* entry id whose wordbook picker is expanded */

  function languageMeta(id) {
    var list = CONFIG.languages;
    for (var i = 0; i < list.length; i += 1) if (list[i].id === id) return list[i];
    return null;
  }

  function favourites() {
    /* A row that was just unstarred stays until the screen is left, so the
       star can be un-clicked by eye instead of the whole list shifting under
       the finger. `keptUnstarred` is emptied on leaving the screen. */
    var kept = ns.session.keptUnstarred || {};
    return store.listGroups().filter(function (row) {
      return row.starred || kept[row.id];
    });
  }

  /* Leaving the Starred screen is what makes the unstarred rows disappear. */
  function leave() {
    ns.session.keptUnstarred = {};
  }

  /* A sentence or a file is a favourite like any other, so the star on those
     headers means something here. Neither is ever a practice item: spelling out
     a sentence, or a document, is not the exercise. */
  function kindOf(row) {
    if (row.kind === 'sentence') return 'sentence';
    if (row.kind === 'document') return 'document';
    if (row.kind === 'discovery') return 'discovery';
    return 'word';
  }

  function wordsIn(rows) { return rows.filter(function (row) { return kindOf(row) === 'word'; }); }
  function sentencesIn(rows) { return rows.filter(function (row) { return kindOf(row) === 'sentence'; }); }
  function documentsIn(rows) { return rows.filter(function (row) { return kindOf(row) === 'document'; }); }

  /* The three kinds in the order they are listed inside a language group:
     headwords first, because that is what the screen is mostly for. */
  var KIND_LABEL = { word: 'fav.words', sentence: 'fav.sentences', document: 'fav.documents' };
  var KIND_CHIP = { sentence: 'dict.badge.sentence', document: 'dict.badge.document', discovery: 'dict.surprise' };

  function bookEntries(bookId) {
    var book = store.findWordbook(bookId);
    if (!book) return [];
    var byId = {};
    favourites().forEach(function (row) { byId[row.id] = row; });
    return book.entries.map(function (id) { return byId[id]; }).filter(Boolean);
  }

  /* A source is one of three things: everything starred, one language, or one
     wordbook. The language form is a prefix so it can live in the same picker
     and the same in-memory setting as the other two. */
  function sourceLanguage(source) {
    var text = String(source == null ? '' : source);
    return text.indexOf('lang:') === 0 ? text.slice(5) : '';
  }

  function sourceRows(source) {
    var lang = sourceLanguage(source);
    if (lang) {
      return favourites().filter(function (row) { return row.language === lang; });
    }
    return source === 'all' ? favourites() : bookEntries(source);
  }

  /* The languages worth offering: those with at least one starred entry, live
     ones in the picker's own order, retired ones after them. A language with
     nothing starred is not a choice — it would be a row that does nothing. */
  function starredLanguages() {
    var present = {};
    favourites().forEach(function (row) {
      var id = CONFIG.languageByAnyName(row.language);
      if (id) present[id] = true;
    });
    var order = CONFIG.queryLanguages.map(function (lang) { return lang.id; });
    CONFIG.languages.forEach(function (lang) {
      if (lang.retired && order.indexOf(lang.id) === -1) order.push(lang.id);
    });
    return order.filter(function (id) { return present[id]; });
  }

  /* Practisable = the language has a practice form AND the entry carries what
     that form needs. Latin languages need only the word itself; Chinese and
     Japanese need a reading. */
  function canPractise(row) {
    if (kindOf(row) !== 'word') return false;
    var meta = languageMeta(row.language);
    if (!meta) return false;
    if (meta.needsReading && !row.reading) return false;
    if (meta.practice === 'spell' && !ns.practice.canSpell(row.word)) return false;
    return true;
  }

  /* ---------- Folded groups ---------- */

  function collapsedGroups() {
    if (!ns.session.collapsedGroups) ns.session.collapsedGroups = {};
    return ns.session.collapsedGroups;
  }

  function groupToggle(key, label, count, body) {
    var open = !collapsedGroups()[key];
    return '<button type="button" class="group-toggle" data-group-toggle="' + ui.esc(key) + '" ' +
      'aria-expanded="' + (open ? 'true' : 'false') + '">' +
      '<span class="group-text">' + ui.esc(label) + '</span>' +
      '<span class="group-count">' + count + '</span>' +
      '<span class="group-chevron">' + ui.icon('chevron') + '</span></button>' +
      (open ? body : '');
  }

  /* Words and sentences fold apart too, so a language group with both can be
     read one kind at a time. */
  function subGroup(key, label, rows) {
    var open = !collapsedGroups()[key];
    return '<button type="button" class="group-toggle is-sub" data-group-toggle="' + ui.esc(key) + '" ' +
      'aria-expanded="' + (open ? 'true' : 'false') + '">' +
      '<span class="group-text">' + ui.esc(label) + '</span>' +
      '<span class="group-count">' + rows.length + '</span>' +
      '<span class="group-chevron">' + ui.icon('chevron') + '</span></button>' +
      (open ? '<div class="list">' + rows.map(wordRow).join('') + '</div>' : '');
  }

  /* ---------- Entries whose language was never recorded ----------
     Entries stored before 4.2 can carry no language at all, which is what used
     to surface as an "AUTO" group. They are identified once, on this screen,
     and only when there is a key to ask with. */

  var attempted = {};    /* id -> true once asked, so a failure does not loop */
  var inFlight = {};     /* id -> true while the question is out */

  function unknownLanguage() {
    return favourites().filter(function (row) {
      return kindOf(row) !== 'discovery' && !CONFIG.languageByAnyName(row.language);
    });
  }

  function identify(row) {
    var settings = store.getSettings();
    if (!settings.apiKey || attempted[row.id] || inFlight[row.id]) return Promise.resolve(null);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(null);
    attempted[row.id] = true;
    inFlight[row.id] = true;

    /* A sentence has no overview, so it gets the tiny detector. A word gets the
       full overview, which also fills in the reading and the gloss it never
       had — the row stops being a bare headword with a greyed-out practice
       button. */
    var question = kindOf(row) === 'sentence'
      ? ns.api.detectLanguage({
        apiKey: settings.apiKey, model: settings.model, input: row.word
      })
      : ns.api.overview({
        apiKey: settings.apiKey, model: settings.model,
        sourceLang: CONFIG.autoLang, outputLang: settings.outputLang, input: row.word
      }).then(function (overview) {
        var named = overview && typeof overview === 'object' ? overview : {};
        return {
          language: CONFIG.languageByAnyName(named.language),
          overview: named.quick_meaning || named.word ? named : null
        };
      });

    return question.then(function (result) {
      delete inFlight[row.id];
      if (!result || !result.language) return null;
      var entry = store.getEntry(row.id);
      if (!entry) return result.language;
      entry.language = result.language;
      if (result.overview) {
        entry.overview = result.overview;
        entry.word = result.overview.word || entry.word;
      }
      /* Deep lines made while the language was unknown were built from the
         English prompt, so they are wrong for anything that turns out not to be
         English. Dropping them lets the entry page regenerate, on request. */
      if (result.language !== 'en') entry.lines = {};
      store.saveEntry(entry);
      return result.language;
    }).catch(function () {
      delete inFlight[row.id];
      return null;
    });
  }

  /* Identifying an entry spends the user's own credit, so it only ever happens
     because they asked for it: one button, a few entries at a time, one
     request in flight at a time. It used to fire on every visit to this screen
     as an unbounded Promise.all, which was both a rate-limit hazard and a bill
     nobody agreed to. */
  var IDENTIFY_BATCH = 3;

  function pendingIdentification() {
    return unknownLanguage().filter(function (row) {
      return !attempted[row.id] && !inFlight[row.id];
    });
  }

  function identifyPending(limit) {
    var rows = pendingIdentification().slice(0, limit || IDENTIFY_BATCH);
    if (!rows.length) return Promise.resolve(0);
    var answered = 0;
    return rows.reduce(function (chain, row) {
      return chain.then(function () {
        return identify(row).then(function (language) { if (language) answered += 1; });
      });
    }, Promise.resolve()).then(function () {
      ns.router.refresh();
      return answered;
    });
  }

  function practicePool(source) {
    return sourceRows(source).filter(canPractise);
  }

  function toItem(row, progress) {
    var meta = languageMeta(row.language) || { practice: 'spell' };
    var entry = store.getEntry(row.id);
    var roots = ns.roots && entry ? ns.roots.rootsFromEntry(entry) : [];
    return {
      word: row.word,
      reading: row.reading || '',
      meaning: row.quickMeaning || '',
      pos: row.pos || '',
      language: row.language,
      languageName: row.languageName || (meta && meta.native) || row.language,
      languageCode: row.languageCode || '',
      roots: roots,
      primaryRoot: roots[0] || null,
      model: row.model || '',
      outputLang: row.outputLang || '',
      practice: meta.practice,
      entryId: row.id,
      mode: 'practice',
      progress: progress
    };
  }

  function shuffled(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var swap = copy[i]; copy[i] = copy[j]; copy[j] = swap;
    }
    return copy;
  }

  /* ---------- A round, as a queue ----------
     A round of five is dealt from the pool; neither skipping a word nor getting
     it wrong on the first try loses it. Both send the word to a review queue —
     in the order they happened — and when the pass runs out the round
     continues with that queue from its first word. Skipping or failing again
     queues it once more, so a round ends when every word was spelled right on
     the first try; closing the layer works at any moment.

     Pure, so the ordering rules are checked without a browser. */
  function roundQueue(items) {
    var queue = (items || []).slice();
    /* [{ word, reason }] — reason is 'skipped' or 'unknown'. */
    var review = [];
    /* Positions in the pass being practised now, per reason, so the dot row can
       mark them without walking the queue. */
    var skippedAt = [];
    var unknownAt = [];
    var index = 0;
    var pass = 1;

    function current() { return queue[index] || null; }
    function progress() {
      return {
        done: index, total: queue.length, pass: pass, index: index,
        skipped: skippedAt.slice(), unknown: unknownAt.slice()
      };
    }

    /* `outcome` is how the word that was just on screen went: 'known' moves on,
       'unknown' and 'skipped' move on *and* queue it for the next pass. */
    function advance(outcome) {
      var word = current();
      if (word && outcome === 'unknown') {
        review.push({ word: word, reason: 'unknown' });
        unknownAt.push(index);
      } else if (word && outcome === 'skipped') {
        review.push({ word: word, reason: 'skipped' });
        skippedAt.push(index);
      }
      index += 1;
      if (index < queue.length) return current();
      if (!review.length) return null;
      queue = review.map(function (item) { return item.word; });
      review = [];
      skippedAt = [];
      unknownAt = [];
      index = 0;
      pass += 1;
      return current();
    }

    function skip() { return advance('skipped'); }

    return {
      current: current,
      progress: progress,
      advance: advance,
      skip: skip,
      pass: function () { return pass; },
      size: function () { return queue.length; },
      skippedCount: function () {
        return review.filter(function (item) { return item.reason === 'skipped'; }).length;
      },
      unknownCount: function () {
        return review.filter(function (item) { return item.reason === 'unknown'; }).length;
      }
    };
  }

  function startPractice() {
    var source = ns.session.favoritesSource || 'all';
    var pool = practicePool(source);
    if (!pool.length) {
      var rows = sourceRows(source);
      if (!rows.length) ui.toast(ui.t('fav.practiceNone'));
      else ui.toast(ui.t('fav.practiceNoReading'));
      return;
    }
    var round = roundQueue(shuffled(pool).slice(0, CONFIG.limits.practiceRound));
    ns.practice.openWithMeaning(toItem(round.current(), round.progress()), {
      onAdvance: function (result) {
        var next = round.advance(result && result.outcome);
        return next ? toItem(next, round.progress()) : null;
      },
      /* Skipping moves on exactly as answering does — the word is simply queued
         for the next pass instead of being counted as done. */
      onSkip: function () {
        var next = round.skip();
        return next ? toItem(next, round.progress()) : null;
      }
    });
  }

  /* ---------- Sections ---------- */

  function sourceBar() {
    var source = ns.session.favoritesSource || 'all';
    var books = store.listWordbooks();
    /* Three tiers in one control: everything, one language, one wordbook. The
       language tier is what makes a drill stay in one language instead of
       drawing whatever the shuffle happens to pick. */
    var options = [{ id: 'all', label: ui.t('fav.source.all', { n: practicePool('all').length }) }];
    starredLanguages().forEach(function (id) {
      var meta = languageMeta(id);
      options.push({
        id: 'lang:' + id,
        label: (meta ? meta.native : id) + ' (' + practicePool('lang:' + id).length + ')'
      });
    });
    books.forEach(function (book) {
      var name = book.id === store.SURPRISE_BOOK_ID ? ui.t('dict.surprise') : book.name;
      options.push({ id: book.id, label: name + ' (' + practicePool(book.id).length + ')' });
    });

    /* One control and one action. The source selector already filters the list
       below it, so the pencil needs nothing else beside it. */
    return '<div class="source-bar">' +
      ui.picker({
        id: 'practice-source',
        value: source,
        block: true,
        label: ui.t('fav.source'),
        title: ui.t('fav.source'),
        options: options,
        onPick: function (next) {
          ns.session.favoritesSource = next;
          ns.router.refresh();
        }
      }) +
      '<button type="button" class="icon-btn surprise-btn is-accent" id="practice-start" ' +
      'title="' + ui.esc(ui.t('fav.practise')) + '" aria-label="' + ui.esc(ui.t('fav.practise')) + '">' + ui.icon('write') + '</button>' +
      '<button type="button" class="link-btn" data-groups-toggle="1">' +
      ui.t(allGroupsFolded() ? 'dict.history.expandAll' : 'dict.history.collapseAll') + '</button>' +
      '</div>';
  }

  /* Every foldable heading the screen is currently showing. */
  function groupKeys() {
    var keys = ['books'];
    var byLanguage = {};
    var hasDiscovery = false;
    sourceRows(ns.session.favoritesSource || 'all').forEach(function (row) {
      if (kindOf(row) === 'discovery') { hasDiscovery = true; return; }
      var language = CONFIG.languageByAnyName(row.language);
      if (!language) return;
      if (!byLanguage[language]) byLanguage[language] = { words: 0, sentences: 0 };
      if (kindOf(row) === 'sentence') byLanguage[language].sentences += 1;
      else byLanguage[language].words += 1;
    });
    Object.keys(byLanguage).forEach(function (language) {
      keys.push('lang:' + language);
      var counts = byLanguage[language];
      if (counts.words && counts.sentences) {
        keys.push('lang:' + language + ':word');
        keys.push('lang:' + language + ':sentence');
      }
    });
    if (hasDiscovery) keys.push('discoveries');
    return keys;
  }

  function allGroupsFolded() {
    var folded = collapsedGroups();
    var keys = groupKeys();
    return keys.length > 0 && keys.every(function (key) { return folded[key]; });
  }

  function wordbookSection() {
    var books = store.listWordbooks();
    var body = '<div class="list">';
    books.forEach(function (book) {
      var counts = {};
      sourceRows(book.id).forEach(function (row) {
        if (kindOf(row) === 'discovery') { counts.surprise = (counts.surprise || 0) + 1; return; }
        var key = CONFIG.languageByAnyName(row.language) || '??';
        counts[key] = (counts[key] || 0) + 1;
      });
      var breakdown = Object.keys(counts).sort().map(function (key) {
        return key.toUpperCase() + ' ' + counts[key];
      }).join(' · ');

      body += '<div class="row row-static">' +
        '<span class="row-main"><span class="row-title">' +
        ui.esc(book.id === store.SURPRISE_BOOK_ID ? ui.t('dict.surprise') : book.name) + '</span>' +
        '<span class="row-sub">' + ui.esc(breakdown || 'Empty') + '</span></span>' +
        '<span class="row-aside">' + (book.id === store.SURPRISE_BOOK_ID ? '' :
        '<button type="button" class="icon-btn is-muted" data-rename-book="' + ui.esc(book.id) + '" ' +
        'aria-label="' + ui.esc(ui.t('fav.rename')) + '" title="' + ui.esc(ui.t('fav.rename')) + '">' + ui.icon('pencil') + '</button>' +
        '<button type="button" class="icon-btn is-muted" data-delete-book="' + ui.esc(book.id) + '" ' +
        'aria-label="' + ui.esc(ui.t('fav.delete')) + '" title="' + ui.esc(ui.t('fav.delete')) + '">' + ui.icon('trash') + '</button>' +
        '') + '</span></div>';
    });
    /* Adding a book belongs with the books, not in the control row above. */
    body += '<button type="button" class="row" id="wordbook-new">' +
      '<span class="row-main"><span class="row-title">' + ui.esc(ui.t('fav.newBook')) + '</span>' +
      '<span class="row-sub">' + ui.esc(ui.t('fav.newBookHint')) + '</span></span>' +
      '<span class="row-aside">' + ui.icon('plus') + '</span></button>';
    return groupToggle('books', ui.t('fav.books.title'), books.length, body + '</div>');
  }

  /* Language is the primary classification, so books are NOT nested under it —
     a book can hold several languages. */
  function languageSection() {
    var source = ns.session.favoritesSource || 'all';
    var rows = sourceRows(source);
    if (!rows.length) {
      return '<div class="empty"><div class="empty-icon">' + ui.icon('star') + '</div>' +
        '<div class="empty-title">' + ui.esc(ui.t('fav.emptyTitle')) + '</div>' +
        '<div class="empty-text">' + ui.esc(ui.t('fav.emptyText')) + '</div>' +
        '<div class="empty-actions"><button type="button" class="btn btn-primary" data-go-dictionary>' +
        ui.esc(ui.t('fav.emptyAction')) + '</button></div></div>';
    }

    var groups = {};
    var order = [];
    var unknown = [];
    var discoveries = [];
    rows.forEach(function (row) {
      if (kindOf(row) === 'discovery') { discoveries.push(row); return; }
      var key = CONFIG.languageByAnyName(row.language);
      /* No language is not a language. These are shown as a plain cluster at
         the top, with a way to fill the gap, rather than under a label like
         "Auto" that pretends to be one. */
      if (!key) { unknown.push(row); return; }
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(row);
    });
    /* Retired languages keep working but are not offered any more, so their
       groups sit after the current ones and say what they are. */
    var orderIds = CONFIG.queryLanguages.map(function (l) { return l.id; });
    order.sort(function (a, b) {
      var rankA = orderIds.indexOf(a) < 0 ? 100 : orderIds.indexOf(a);
      var rankB = orderIds.indexOf(b) < 0 ? 100 : orderIds.indexOf(b);
      return rankA - rankB;
    });

    var html = '';
    if (discoveries.length) {
      html += groupToggle('discoveries', ui.t('dict.surprise'), discoveries.length,
        '<div class="list">' + discoveries.map(wordRow).join('') + '</div>');
    }
    if (unknown.length) html += unknownSection(unknown);

    order.forEach(function (key) {
      var meta = languageMeta(key);
      var list = groups[key];
      var kinds = [
        { id: 'word', rows: wordsIn(list) },
        { id: 'sentence', rows: sentencesIn(list) },
        { id: 'document', rows: documentsIn(list) }
      ].filter(function (kind) { return kind.rows.length; });
      var body = '';
      /* More than one kind under one language still reads as separate lists — a
         file, a sentence and a headword are not the same thing to look at.
         With only one kind the label would be noise, so it is left out. */
      if (kinds.length > 1) {
        body = kinds.map(function (kind) {
          return subGroup('lang:' + key + ':' + kind.id, ui.t(KIND_LABEL[kind.id]), kind.rows);
        }).join('');
      } else {
        body = '<div class="list">' + list.map(wordRow).join('') + '</div>';
      }
      var heading = meta ? meta.label : key;
      if (meta && meta.retired) heading += ' · ' + ui.t('fav.retired');
      html += groupToggle('lang:' + key, heading, list.length, body);
    });
    return html;
  }

  /* Rows with no language: no heading, an honest line about why, and a manual
     way to ask again once the automatic attempt has run. */
  function unknownSection(rows) {
    var settings = store.getSettings();
    var html = '<div class="group-sub">' + ui.esc(ui.t('fav.unknown')) + '</div>';
    if (!settings.apiKey) {
      html += '<p class="small muted-3" style="margin:0 4px 8px">' + ui.esc(ui.t('fav.unknownNeedKey')) + '</p>';
    } else {
      /* Nothing here runs on its own: identifying costs a request per entry, so
         the screen asks first and says what it will spend. */
      html += '<p class="small muted-3" style="margin:0 4px 8px">' + ui.esc(ui.t('fav.unknownText')) + '</p>' +
        '<div class="chips" style="margin:0 4px 10px">' +
        '<button type="button" class="chip chip-button chip-accent" data-identify-all="1">' +
        ui.esc(ui.t('fav.identifyMany', { n: Math.min(IDENTIFY_BATCH, rows.length), total: rows.length })) +
        '</button></div>';
    }
    if (rows.some(function (row) { return inFlight[row.id]; })) {
      html += '<p class="small muted-3" style="margin:0 4px 8px">' + ui.esc(ui.t('fav.identifying')) + '</p>';
    }
    html += '<div class="list">' + rows.map(function (row) {
      return wordRow(row, {
        action: '<button type="button" class="chip chip-button" data-identify="' + ui.esc(row.id) +
          '" title="' + ui.esc(ui.t('fav.identifyOne')) + '">' +
          ui.esc(ui.t('fav.identifyOne')) + '</button>'
      });
    }).join('') + '</div>';
    return html;
  }

  function wordRow(row, options) {
    options = options || {};
    var practisable = canPractise(row);
    var books = store.wordbooksFor(row.id);
    /* Three cases: an entry whose language is unknown carries the way to fill
       that in, a sentence has nothing to practise at all so it carries
       nothing, and a word carries the practice button — greyed when the word
       itself cannot be practised. */
    var action = options.action || '';
    if (!action && kindOf(row) === 'word') {
      action = '<button type="button" class="icon-btn' + (practisable ? '' : ' is-muted') + '" ' +
        'data-practice-one="' + ui.esc(row.id) + '" ' + (practisable ? '' : 'disabled ') +
        'aria-label="' + ui.esc(ui.t('fav.practise')) + '" title="' +
        ui.esc(ui.t(practisable ? 'fav.practise' : 'fav.practiseUnavailable')) + '">' +
        ui.icon('write') + '</button>';
    }
    var html = '<div class="row" data-open="' + ui.esc(row.id) + '">' +
      '<span class="row-main"><span class="row-title">' + ui.esc(row.word) + '</span>' +
      '<span class="row-sub">' +
      (KIND_CHIP[kindOf(row)] ? '<span class="chip">' + ui.esc(ui.t(KIND_CHIP[kindOf(row)])) + '</span> ' : '') +
      (row.pos ? ui.esc(row.pos) + ' · ' : '') +
      ui.esc(row.quickMeaning || '') +
      (books.length ? ' · ' + books.map(function (b) {
        return ui.esc(b.id === store.SURPRISE_BOOK_ID ? ui.t('dict.surprise') : b.name);
      }).join(', ') : '') +
      '</span></span>' +
      '<span class="row-aside">' +
      (kindOf(row) === 'discovery' ? ui.languageBadge(row.languageCode, row.languageName) : '') +
      (kindOf(row) === 'discovery' ? '' :
        '<button type="button" class="icon-btn is-muted" data-pick-books="' + ui.esc(row.id) + '" ' +
        'aria-label="' + ui.esc(ui.t('fav.wordbooks')) + '" title="' + ui.esc(ui.t('fav.wordbooks')) + '">' + ui.icon('folder') + '</button>') +
      action +
      '<button type="button" class="icon-btn is-muted" data-delete-row="' + ui.esc(row.id) + '" ' +
      'aria-label="' + ui.esc(ui.t('entry.delete')) + '" title="' + ui.esc(ui.t('entry.delete')) + '">' +
      ui.icon('trash') + '</button>' +
      /* A row kept after being unstarred shows a hollow star, and the same
         button puts it back — one control, two states. */
      (row.starred
        ? '<button type="button" class="icon-btn is-starred" data-unstar="' + ui.esc(row.id) + '" ' +
          'aria-label="' + ui.esc(ui.t('fav.remove')) + '" title="' + ui.esc(ui.t('fav.remove')) + '">' +
          ui.iconFilled('star') + '</button>'
        : '<button type="button" class="icon-btn" data-star="' + ui.esc(row.id) + '" ' +
          'aria-label="' + ui.esc(ui.t('dict.history.star')) + '" title="' +
          ui.esc(ui.t('dict.history.star')) + '">' + ui.icon('star') + '</button>') +
      '</span></div>';

    if (openPicker === row.id) html += bookPicker(row);
    return html;
  }

  /* A word can belong to several books, so this is a row of toggles rather than
     a single choice. */
  function bookPicker(row) {
    var discovery = kindOf(row) === 'discovery';
    var books = store.listWordbooks().filter(function (book) {
      return discovery ? book.id === store.SURPRISE_BOOK_ID : book.id !== store.SURPRISE_BOOK_ID;
    });
    var member = {};
    store.wordbooksFor(row.id).forEach(function (book) { member[book.id] = true; });

    var html = '<div class="book-picker">';
    if (!books.length) {
      html += '<span class="muted small">' + ui.esc(ui.t('fav.noWordbooks')) + '</span>';
    } else {
      html += books.map(function (book) {
        return '<button type="button" class="chip chip-button' + (member[book.id] ? ' chip-accent' : '') + '" ' +
          'data-toggle-book="' + ui.esc(book.id) + '" data-entry="' + ui.esc(row.id) + '">' +
          (member[book.id] ? '✓ ' : '+ ') + ui.esc(book.name) + '</button>';
      }).join('');
    }
    if (!discovery) {
      html += '<button type="button" class="chip chip-button" data-new-book-for="' + ui.esc(row.id) + '">' +
        ui.esc(ui.t('fav.newBookInline')) + '</button>';
    }
    return html + '</div>';
  }

  /* ---------- Actions ---------- */

  function newWordbook(afterEntryId) {
    var name = window.prompt(ui.t('fav.bookPrompt'));
    if (name == null) return;
    var book = store.createWordbook(name);
    if (!book) { ui.toast(ui.t('fav.bookFailed')); return; }
    if (afterEntryId) store.addToWordbook(book.id, afterEntryId);
    ui.toast(ui.t('fav.bookCreated', { name: book.name }));
    ns.router.refresh();
  }

  /* ---------- Screen ---------- */

  function render(container) {
    var html = '';
    html += sourceBar();
    if (favourites().length) html += wordbookSection();
    html += languageSection();
    ui.setHTML(container, html);
    wire(container);
  }

  function wire(container) {
    var start = container.querySelector('#practice-start');
    if (start) start.addEventListener('click', startPractice);

    var create = container.querySelector('#wordbook-new');
    if (create) create.addEventListener('click', function () { newWordbook(null); });

    container.querySelectorAll('[data-rename-book]').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = button.getAttribute('data-rename-book');
        var book = store.findWordbook(id);
        var name = window.prompt(ui.t('fav.bookPrompt'), book ? book.name : '');
        if (name == null) return;
        if (store.renameWordbook(id, name)) { ui.toast(ui.t('fav.bookRenamed')); ns.router.refresh(); }
      });
    });

    container.querySelectorAll('[data-delete-book]').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = button.getAttribute('data-delete-book');
        var book = store.findWordbook(id);
        if (!window.confirm(ui.t('fav.bookConfirm', { name: book ? book.name : '' }))) return;
        store.removeWordbook(id);
        if (ns.session.favoritesSource === id) ns.session.favoritesSource = 'all';
        ui.toast(ui.t('fav.bookDeleted'));
        ns.router.refresh();
      });
    });

    container.querySelectorAll('[data-pick-books]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        var id = button.getAttribute('data-pick-books');
        openPicker = openPicker === id ? null : id;
        ns.router.refresh();
      });
    });

    container.querySelectorAll('[data-toggle-book]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        var bookId = button.getAttribute('data-toggle-book');
        var entryId = button.getAttribute('data-entry');
        var isMember = store.wordbooksFor(entryId).some(function (b) { return b.id === bookId; });
        if (isMember) store.removeFromWordbook(bookId, entryId);
        else store.addToWordbook(bookId, entryId);
        ns.router.refresh();
      });
    });

    container.querySelectorAll('[data-new-book-for]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        newWordbook(button.getAttribute('data-new-book-for'));
      });
    });

    container.querySelectorAll('[data-practice-one]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        if (button.disabled) return;
        var id = button.getAttribute('data-practice-one');
        var row = store.findRow(id);
        if (row) ns.practice.openWithMeaning(toItem(row));
      });
    });

    container.querySelectorAll('[data-unstar]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        var id = button.getAttribute('data-unstar');
        store.toggleStar(id);
        /* Keep it on screen, as an unstarred row, until the screen is left. */
        if (!ns.session.keptUnstarred) ns.session.keptUnstarred = {};
        ns.session.keptUnstarred[id] = true;
        /* Unstarring removes it from favourites, but a wordbook entry would
           otherwise dangle, so unlink it everywhere. */
        store.listWordbooks().forEach(function (book) {
          store.removeFromWordbook(book.id, id);
        });
        ui.toast(ui.t('fav.removed'));
        ns.router.refresh();
      });
    });

    container.querySelectorAll('[data-star]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        var id = button.getAttribute('data-star');
        store.toggleStar(id);
        if (ns.session.keptUnstarred) delete ns.session.keptUnstarred[id];
        ui.toast(ui.t('entry.addedStarred'));
        ns.router.refresh();
      });
    });

    container.querySelectorAll('[data-open]').forEach(function (row) {
      row.addEventListener('click', function (event) {
        if (event.target.closest('button')) return;
        ns.session.pending = null;
        var id = row.getAttribute('data-open');
        var found = store.findRow(id);
        location.hash = (found && found.kind === 'discovery' ? '#/discovery/' : '#/word/') + encodeURIComponent(id);
      });
    });

    container.querySelectorAll('[data-delete-row]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        var id = button.getAttribute('data-delete-row');
        var snapshot = store.snapshotEntry(id);
        if (!snapshot) return;
        openPicker = null;
        store.removeGroup(id);
        if (ns.roots) ns.roots.invalidate();
        ui.toast(ui.t('entry.deleted'), {
          ms: 8000,
          action: {
            label: ui.t('common.undo'),
            onClick: function () {
              store.restoreEntry(snapshot);
              if (ns.roots) ns.roots.invalidate();
              ui.toast(ui.t('entry.restored'));
              ns.router.refresh();
            }
          }
        });
        ns.router.refresh();
      });
    });

    var goDictionary = container.querySelector('[data-go-dictionary]');
    if (goDictionary) goDictionary.addEventListener('click', function () { location.hash = '#/dictionary'; });

    container.querySelectorAll('[data-group-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var key = button.getAttribute('data-group-toggle');
        var map = collapsedGroups();
        if (map[key]) delete map[key]; else map[key] = true;
        ns.router.refresh();
      });
    });

    var groupsToggle = container.querySelector('[data-groups-toggle]');
    if (groupsToggle) {
      groupsToggle.addEventListener('click', function () {
        var map = collapsedGroups();
        var keys = groupKeys();
        var folded = allGroupsFolded();
        keys.forEach(function (key) {
          if (folded) delete map[key]; else map[key] = true;
        });
        ns.router.refresh();
      });
    }

    container.querySelectorAll('[data-identify]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        var id = button.getAttribute('data-identify');
        var row = store.findRow(id);
        if (!row) return;
        if (!store.getSettings().apiKey) { ui.toast(ui.t('fav.needKey')); return; }
        delete attempted[id];
        delete inFlight[id];
        identify(row).then(function (language) {
          if (language) ui.toast(ui.t('fav.filedUnder', { lang: language.toUpperCase() }));
          else ui.toast(ui.t('fav.notIdentified'));
          ns.router.refresh();
        });
      });
    });

    var identifyAll = container.querySelector('[data-identify-all]');
    if (identifyAll) {
      identifyAll.addEventListener('click', function () {
        if (!store.getSettings().apiKey) { ui.toast(ui.t('fav.needKey')); return; }
        identifyAll.disabled = true;
        identifyPending().then(function (answered) {
          ui.toast(answered ? ui.t('fav.identified', { n: answered }) : ui.t('fav.notIdentified'));
        });
      });
    }
  }

  ns.views.favorites = {
    toItem: toItem,
    roundQueue: roundQueue,
    leave: leave,
    sourceRows: sourceRows,
    starredLanguages: starredLanguages,
    sourceLanguage: sourceLanguage,
    topbar: function () { return { title: ui.t('fav.title'), sub: '' }; },
    render: render,
    practicePool: practicePool,
    canPractise: canPractise,
    unknownLanguage: unknownLanguage,
    identify: identify,
    identifyPending: identifyPending,
    pendingIdentification: pendingIdentification,
    /* Exposed so a test can fold exactly what the screen is showing. */
    groupKeys: groupKeys,
    startPractice: startPractice,
    favourites: favourites,
    sourceRows: sourceRows
  };
})(window.LINGUIST);
