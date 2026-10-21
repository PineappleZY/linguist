/* RADICLE — Favourites.

   The whole screen is built on one relationship: a favourite is a starred entry,
   and a wordbook is a named subset of those. So a word can sit in several
   wordbooks or in none, and deleting a wordbook only ever unlinks.

   Practice lives here now. The source selector at the top drives both the list
   below it and the pool the pencil draws from, so the two can never disagree. */

window.RADICLE = window.RADICLE || {};
window.RADICLE.views = window.RADICLE.views || {};

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
    return store.listHistory().filter(function (row) {
      return row.starred && row.kind !== 'sentence';
    });
  }

  function bookEntries(bookId) {
    var book = store.findWordbook(bookId);
    if (!book) return [];
    var byId = {};
    favourites().forEach(function (row) { byId[row.id] = row; });
    return book.entries.map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function sourceRows(source) {
    return source === 'all' ? favourites() : bookEntries(source);
  }

  /* Practisable = the language has a practice form AND the entry carries what
     that form needs. Latin languages need only the word itself; Chinese and
     Japanese need a reading. */
  function canPractise(row) {
    var meta = languageMeta(row.language);
    if (!meta) return false;
    if (meta.needsReading && !row.reading) return false;
    if (meta.practice === 'spell' && !ns.practice.canSpell(row.word)) return false;
    return true;
  }

  function practicePool(source) {
    return sourceRows(source).filter(canPractise);
  }

  function toItem(row, progress) {
    var meta = languageMeta(row.language) || { practice: 'spell' };
    return {
      word: row.word,
      reading: row.reading || '',
      meaning: row.quickMeaning || '',
      language: row.language,
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

  function startPractice() {
    var source = ns.session.favoritesSource || 'all';
    var pool = practicePool(source);
    if (!pool.length) {
      var rows = sourceRows(source);
      if (!rows.length) ui.toast('Nothing here to practise yet.');
      else ui.toast('Nothing in this source can be practised yet — Chinese and Japanese words need a reading.');
      return;
    }
    var round = shuffled(pool).slice(0, CONFIG.limits.practiceRound);
    var progress = { total: round.length, done: 0 };
    var index = 0;
    ns.practice.open(toItem(round[index], progress), {
      onAdvance: function () {
        progress.done += 1;
        index += 1;
        if (index >= round.length) return null;
        return toItem(round[index], progress);
      }
    });
  }

  /* ---------- Sections ---------- */

  function sourceBar() {
    var source = ns.session.favoritesSource || 'all';
    var books = store.listWordbooks();
    var options = [{ id: 'all', label: 'All favourites (' + practicePool('all').length + ')' }].concat(
      books.map(function (book) {
        return { id: book.id, label: book.name + ' (' + practicePool(book.id).length + ')' };
      })
    );

    return '<div class="source-bar">' +
      '<select class="source-select" id="practice-source" aria-label="Practice source">' +
      options.map(function (option) {
        return '<option value="' + ui.esc(option.id) + '"' +
          (option.id === source ? ' selected' : '') + '>' + ui.esc(option.label) + '</option>';
      }).join('') + '</select>' +
      '<button type="button" class="btn btn-primary" id="practice-start" title="Practise">' +
      ui.icon('pencil') + 'Practise</button>' +
      '<button type="button" class="btn" id="wordbook-new" title="New wordbook">' +
      ui.icon('plus') + 'Wordbook</button>' +
      '</div>';
  }

  function wordbookSection() {
    var books = store.listWordbooks();
    if (!books.length) return '';
    var html = '<div class="group-label">Wordbooks</div><div class="list">';
    books.forEach(function (book) {
      var counts = {};
      sourceRows(book.id).forEach(function (row) {
        var key = row.language || '??';
        counts[key] = (counts[key] || 0) + 1;
      });
      var breakdown = Object.keys(counts).sort().map(function (key) {
        return key.toUpperCase() + ' ' + counts[key];
      }).join(' · ');

      html += '<div class="row row-static">' +
        '<span class="row-main"><span class="row-title">' + ui.esc(book.name) + '</span>' +
        '<span class="row-sub">' + ui.esc(breakdown || 'Empty') + '</span></span>' +
        '<span class="row-aside">' +
        '<button type="button" class="icon-btn is-muted" data-rename-book="' + ui.esc(book.id) + '" ' +
        'aria-label="Rename" title="Rename">' + ui.icon('pencil') + '</button>' +
        '<button type="button" class="icon-btn is-muted" data-delete-book="' + ui.esc(book.id) + '" ' +
        'aria-label="Delete" title="Delete">' + ui.icon('trash') + '</button>' +
        '</span></div>';
    });
    return html + '</div>';
  }

  /* Language is the primary classification, so books are NOT nested under it —
     a book can hold several languages. */
  function languageSection() {
    var source = ns.session.favoritesSource || 'all';
    var rows = sourceRows(source);
    if (!rows.length) {
      return '<div class="empty"><div class="empty-icon">' + ui.icon('star') + '</div>' +
        '<div class="empty-title">Nothing here yet</div>' +
        '<div class="empty-text">Star a word while looking it up and it lands here, ' +
        'grouped by language. Then build wordbooks from it.</div>' +
        '<div class="empty-actions"><button type="button" class="btn btn-primary" data-go-dictionary>' +
        'Back to Dictionary</button></div></div>';
    }

    var groups = {};
    var order = [];
    rows.forEach(function (row) {
      var key = row.language || '??';
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(row);
    });
    order.sort(function (a, b) {
      var orderIds = CONFIG.languages.map(function (l) { return l.id; });
      return orderIds.indexOf(a) - orderIds.indexOf(b);
    });

    var html = '';
    order.forEach(function (key) {
      var meta = languageMeta(key);
      html += '<div class="group-label">' + ui.esc(meta ? meta.label : key) + '</div><div class="list">';
      groups[key].forEach(function (row) { html += wordRow(row); });
      html += '</div>';
    });
    return html;
  }

  function wordRow(row) {
    var meta = languageMeta(row.language);
    var practisable = canPractise(row);
    var books = store.wordbooksFor(row.id);
    var html = '<div class="row" data-open="' + ui.esc(row.id) + '">' +
      '<span class="row-main"><span class="row-title">' + ui.esc(row.word) + '</span>' +
      '<span class="row-sub">' + (row.pos ? ui.esc(row.pos) + ' · ' : '') +
      ui.esc(row.quickMeaning || '') +
      (books.length ? ' · ' + books.map(function (b) { return ui.esc(b.name); }).join(', ') : '') +
      '</span></span>' +
      '<span class="row-aside">' +
      '<button type="button" class="icon-btn is-muted" data-pick-books="' + ui.esc(row.id) + '" ' +
      'aria-label="Wordbooks" title="Wordbooks">' + ui.icon('folder') + '</button>' +
      '<button type="button" class="icon-btn' + (practisable ? '' : ' is-muted') + '" ' +
      'data-practice-one="' + ui.esc(row.id) + '" ' + (practisable ? '' : 'disabled ') +
      'aria-label="Practise" title="' + (practisable ? 'Practise' : 'No reading to practise') + '">' +
      ui.icon('pencil') + '</button>' +
      '<button type="button" class="icon-btn is-starred" data-unstar="' + ui.esc(row.id) + '" ' +
      'aria-label="Remove from favourites" title="Remove">' + ui.iconFilled('star') + '</button>' +
      '</span></div>';

    if (openPicker === row.id) html += bookPicker(row);
    return html;
  }

  /* A word can belong to several books, so this is a row of toggles rather than
     a single choice. */
  function bookPicker(row) {
    var books = store.listWordbooks();
    var member = {};
    store.wordbooksFor(row.id).forEach(function (book) { member[book.id] = true; });

    var html = '<div class="book-picker">';
    if (!books.length) {
      html += '<span class="muted small">No wordbooks yet.</span>';
    } else {
      html += books.map(function (book) {
        return '<button type="button" class="chip chip-button' + (member[book.id] ? ' chip-accent' : '') + '" ' +
          'data-toggle-book="' + ui.esc(book.id) + '" data-entry="' + ui.esc(row.id) + '">' +
          (member[book.id] ? '✓ ' : '+ ') + ui.esc(book.name) + '</button>';
      }).join('');
    }
    html += '<button type="button" class="chip chip-button" data-new-book-for="' + ui.esc(row.id) + '">' +
      '+ New wordbook</button>';
    return html + '</div>';
  }

  /* ---------- Actions ---------- */

  function newWordbook(afterEntryId) {
    var name = window.prompt('Name this wordbook');
    if (name == null) return;
    var book = store.createWordbook(name);
    if (!book) { ui.toast('Could not create that wordbook.'); return; }
    if (afterEntryId) store.addToWordbook(book.id, afterEntryId);
    ui.toast('Created “' + book.name + '”');
    ns.router.refresh();
  }

  /* ---------- Screen ---------- */

  function render(container) {
    var html = '';
    html += sourceBar();
    if (!favourites().length) {
      html += languageSection();
    } else {
      html += wordbookSection();
      html += languageSection();
    }
    ui.setHTML(container, html);
    wire(container);
  }

  function wire(container) {
    var select = container.querySelector('#practice-source');
    if (select) {
      select.addEventListener('change', function () {
        ns.session.favoritesSource = select.value;
        ns.router.refresh();
      });
    }

    var start = container.querySelector('#practice-start');
    if (start) start.addEventListener('click', startPractice);

    var create = container.querySelector('#wordbook-new');
    if (create) create.addEventListener('click', function () { newWordbook(null); });

    container.querySelectorAll('[data-rename-book]').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = button.getAttribute('data-rename-book');
        var book = store.findWordbook(id);
        var name = window.prompt('Rename wordbook', book ? book.name : '');
        if (name == null) return;
        if (store.renameWordbook(id, name)) { ui.toast('Renamed'); ns.router.refresh(); }
      });
    });

    container.querySelectorAll('[data-delete-book]').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = button.getAttribute('data-delete-book');
        var book = store.findWordbook(id);
        if (!window.confirm('Delete “' + (book ? book.name : '') + '”? The words stay in your favourites.')) return;
        store.removeWordbook(id);
        if (ns.session.favoritesSource === id) ns.session.favoritesSource = 'all';
        ui.toast('Wordbook deleted');
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
        if (row) ns.practice.open(toItem(row));
      });
    });

    container.querySelectorAll('[data-unstar]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        var id = button.getAttribute('data-unstar');
        store.toggleStar(id);
        /* Unstarring removes it from favourites, but a wordbook entry would
           otherwise dangle, so unlink it everywhere. */
        store.listWordbooks().forEach(function (book) {
          store.removeFromWordbook(book.id, id);
        });
        ui.toast('Removed from favourites');
        ns.router.refresh();
      });
    });

    container.querySelectorAll('[data-open]').forEach(function (row) {
      row.addEventListener('click', function (event) {
        if (event.target.closest('button')) return;
        ns.session.pending = null;
        location.hash = '#/word/' + encodeURIComponent(row.getAttribute('data-open'));
      });
    });

    var goDictionary = container.querySelector('[data-go-dictionary]');
    if (goDictionary) goDictionary.addEventListener('click', function () { location.hash = '#/dictionary'; });
  }

  ns.views.favorites = {
    topbar: function () { return { title: 'Favourites', sub: '' }; },
    render: render,
    practicePool: practicePool,
    canPractise: canPractise,
    startPractice: startPractice,
    favourites: favourites,
    sourceRows: sourceRows
  };
})(window.RADICLE);
