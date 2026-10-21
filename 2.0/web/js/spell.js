/* RADICLE — spelling practice.

   A full-screen focus layer: the entry page behind it is blurred away, the
   answer sits large in the middle, and three small round buttons live just
   above the keyboard. No card, no letter boxes.

   The exercise is modelled as a plain object and driven by pure functions
   (createExercise / applyInput / applySubmit / applyHint). The DOM layer only
   renders that object, which means the whole state machine is testable without
   a browser.

   Judging happens on submit, not while typing: the typed letters stay neutral
   until ✓ is pressed. Accents are judged loosely (é ≡ e) because requiring a
   French keyboard would make the exercise hostile; the revealed answer still
   shows the correct spelling. */

window.RADICLE = window.RADICLE || {};

(function (ns) {
  'use strict';

  /* ---------- Pure helpers ---------- */

  /* Spelling only makes sense for a plain word: no spaces, hyphens or
     apostrophes, which is what multi-word expressions contain. */
  var PLAIN_WORD = /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\u1E00-\u1EFF]+$/;

  function canSpell(word) {
    return PLAIN_WORD.test(String(word || '').trim());
  }

  function toChars(text) {
    return Array.from(String(text == null ? '' : text).normalize('NFC'));
  }

  /* Fold an accented letter to its base form for comparison. */
  function fold(char) {
    return String(char).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function isLetterChar(char) {
    return canSpell(char);
  }

  /* Keeps only letters, folds case in the model but preserves what was typed
     so the display matches the keyboard. */
  function normalizeInput(raw, maxLength) {
    var chars = toChars(raw);
    var kept = [];
    for (var i = 0; i < chars.length && kept.length < maxLength; i += 1) {
      if (isLetterChar(chars[i])) kept.push(chars[i]);
    }
    return kept.join('');
  }

  /* Position by position verdict. Returns one boolean per answer character. */
  function judge(typed, answer) {
    var expected = toChars(answer);
    var given = toChars(typed);
    return expected.map(function (char, index) {
      if (index >= given.length) return false;
      return fold(given[index]) === fold(char);
    });
  }

  function isPerfect(typed, answer) {
    var expected = toChars(answer);
    var given = toChars(typed);
    if (given.length !== expected.length) return false;
    return judge(typed, answer).every(Boolean);
  }

  /* ---------- Exercise model ---------- */

  /* item: { word, meaning, pos, language, entryId, mode, progress } */
  function createExercise(item) {
    return {
      item: item,
      answer: String(item.word || '').normalize('NFC'),
      typed: '',
      status: 'input',   /* input | correct | wrong */
      reveal: false,
      hint: 0,           /* 0 none, 1 meaning, 2 first letter */
      practice: item.mode === 'practice',
      progress: item.progress || null
    };
  }

  function applyInput(exercise, raw) {
    /* Typing is ignored once the answer has been revealed. */
    if (exercise.status !== 'input') return exercise;
    exercise.typed = normalizeInput(raw, toChars(exercise.answer).length);
    return exercise;
  }

  function applySubmit(exercise) {
    if (exercise.status === 'wrong') {
      /* The ✓ button doubles as Retry: clear and go again. */
      exercise.typed = '';
      exercise.status = 'input';
      exercise.reveal = false;
      return exercise;
    }
    if (!exercise.typed) return exercise;
    if (isPerfect(exercise.typed, exercise.answer)) {
      exercise.status = 'correct';
      exercise.reveal = false;
    } else {
      exercise.status = 'wrong';
      exercise.reveal = true;
    }
    return exercise;
  }

  function applyHint(exercise) {
    if (exercise.hint < 2) exercise.hint += 1;
    return exercise;
  }

  /* ---------- DOM layer ---------- */

  var root = null;
  var refs = {};
  var current = null;
  var advanceTimer = null;
  var onAdvance = null;

  function el(tag, className, html) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function build() {
    if (root) return;
    var ui = ns.ui;

    root = el('div', 'spell-layer');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Spelling practice');
    root.hidden = true;
    root.innerHTML =
      '<div class="spell-top">' +
        '<button type="button" class="spell-icon" data-spell="star" aria-label="Star">' + ui.icon('star') + '</button>' +
        '<button type="button" class="spell-icon" data-spell="replay" aria-label="Replay">' + ui.icon('speaker') + '</button>' +
      '</div>' +
      '<div class="spell-stage">' +
        '<div class="spell-hint" data-spell-hint hidden></div>' +
        '<div class="spell-word" data-spell-word></div>' +
        '<div class="spell-answer" data-spell-answer hidden></div>' +
      '</div>' +
      '<div class="spell-dots" data-spell-dots hidden></div>' +
      '<div class="spell-tools">' +
        '<button type="button" class="spell-btn" data-spell="close" aria-label="Close">' + ui.icon('close', 'spell-glyph') + '</button>' +
        '<button type="button" class="spell-btn" data-spell="hint" aria-label="Hint">' + ui.icon('bulb', 'spell-glyph') + '</button>' +
        '<button type="button" class="spell-btn" data-spell="submit" aria-label="Check">' + ui.icon('check', 'spell-glyph') + '</button>' +
      '</div>' +
      '<input class="spell-input" data-spell-input type="text" autocomplete="off" ' +
        'autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Type the word">';

    document.body.appendChild(root);

    refs.hint = root.querySelector('[data-spell-hint]');
    refs.word = root.querySelector('[data-spell-word]');
    refs.answer = root.querySelector('[data-spell-answer]');
    refs.dots = root.querySelector('[data-spell-dots]');
    refs.input = root.querySelector('[data-spell-input]');
    refs.star = root.querySelector('[data-spell="star"]');
    refs.submit = root.querySelector('[data-spell="submit"]');
    refs.hintBtn = root.querySelector('[data-spell="hint"]');

    root.addEventListener('click', function (event) {
      var action = event.target.closest('[data-spell]');
      if (action) {
        handle(action.getAttribute('data-spell'));
        return;
      }
      /* Anywhere else just puts focus back on the hidden field. */
      if (refs.input) refs.input.focus();
    });

    refs.input.addEventListener('input', function () {
      if (!current) return;
      var raw = refs.input.value;
      applyInput(current, raw);
      refs.input.value = current.typed;
      render();
    });

    refs.input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        handle('submit');
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handle('close');
      }
    });
  }

  function handle(action) {
    if (!current) return;
    if (action === 'close') { close(); return; }
    if (action === 'replay') { speak(current.item); return; }
    if (action === 'star') { toggleStar(); return; }
    if (action === 'hint') { applyHint(current); render(); return; }
    if (action === 'submit') {
      var before = current.status;
      applySubmit(current);
      render();
      if (before === 'input' && current.status === 'correct') {
        /* Recorded so closing the layer mid-pause cancels the advance. */
        advanceTimer = window.setTimeout(settle, 700);
      }
    }
  }

  /* Runs after a correct answer: advance in practice mode, close otherwise. */
  function settle() {
    if (!current || current.status !== 'correct') return;
    if (current.practice && typeof onAdvance === 'function') {
      var next = onAdvance();
      if (next) { open(next); return; }
    }
    close();
  }

  function speak(item) {
    if (!item || !item.word) return;
    ns.speech.speak(item.word, item.language === 'fr' ? 'fr-FR' : 'en-US');
  }

  function toggleStar() {
    if (!current || !current.item.entryId) return;
    var starred = ns.store.toggleStar(current.item.entryId);
    if (refs.star) refs.star.classList.toggle('is-starred', starred);
  }

  /* ---------- Render ---------- */

  function render() {
    if (!root || !current) return;
    var ui = ns.ui;
    var chars = toChars(current.answer);
    var typed = toChars(current.typed);
    var marks = current.status === 'wrong' ? judge(current.typed, current.answer) : null;

    var html = '';
    for (var i = 0; i < chars.length; i += 1) {
      if (current.status === 'input' && i === typed.length) {
        html += '<span class="spell-caret"></span>';
      }
      var shown = i < typed.length ? typed[i] : '';
      var cls = 'spell-ch';
      if (current.status === 'correct') cls += ' is-ok';
      else if (marks) cls += marks[i] ? ' is-ok' : (shown ? ' is-bad' : ' is-missing');
      else cls += shown ? ' is-neutral' : ' is-empty';
      html += '<span class="' + cls + '">' + ui.esc(shown || '_') + '</span>';
    }
    if (current.status === 'input' && typed.length === chars.length) {
      html += '<span class="spell-caret"></span>';
    }
    refs.word.innerHTML = html;
    refs.word.setAttribute('data-status', current.status);

    if (current.reveal) {
      refs.answer.hidden = false;
      refs.answer.textContent = current.answer;
    } else {
      refs.answer.hidden = true;
      refs.answer.textContent = '';
    }

    var hintText = '';
    if (current.hint >= 1 && current.item.meaning) hintText = current.item.meaning;
    if (current.hint >= 2) {
      var first = chars[0] ? chars[0] : '';
      hintText += (hintText ? ' · ' : '') + 'starts with “' + first + '”';
    }
    refs.hint.hidden = !hintText;
    refs.hint.textContent = hintText;

    if (current.progress && current.progress.total > 1) {
      refs.dots.hidden = false;
      var dots = '';
      for (var d = 0; d < current.progress.total; d += 1) {
        dots += '<span class="spell-dot' + (d < current.progress.done ? ' is-done' : '') + '"></span>';
      }
      refs.dots.innerHTML = dots;
    } else {
      refs.dots.hidden = true;
      refs.dots.innerHTML = '';
    }

    refs.submit.disabled = current.status === 'input' && !current.typed;
    refs.submit.setAttribute('data-mode', current.status === 'wrong' ? 'retry' : 'check');
    refs.hintBtn.disabled = current.hint >= 2;
    refs.star.classList.toggle('is-starred', !!(current.item.entryId && ns.store.isStarred(current.item.entryId)));
  }

  /* ---------- Open / close ---------- */

  function open(item) {
    build();
    if (advanceTimer) { window.clearTimeout(advanceTimer); advanceTimer = null; }
    current = createExercise(item);
    root.hidden = false;
    document.body.classList.add('is-spelling');
    render();
    if (refs.input) {
      refs.input.value = '';
      refs.input.focus();
    }
    speak(item);
  }

  function close() {
    if (advanceTimer) { window.clearTimeout(advanceTimer); advanceTimer = null; }
    ns.speech.stop();
    current = null;
    onAdvance = null;
    if (root) root.hidden = true;
    document.body.classList.remove('is-spelling');
  }

  function isOpen() {
    return !!current;
  }

  ns.spell = {
    /* pure */
    canSpell: canSpell,
    judge: judge,
    isPerfect: isPerfect,
    normalizeInput: normalizeInput,
    fold: fold,
    toChars: toChars,
    createExercise: createExercise,
    applyInput: applyInput,
    applySubmit: applySubmit,
    applyHint: applyHint,
    /* dom */
    open: function (item, options) {
      onAdvance = options && options.onAdvance ? options.onAdvance : null;
      open(item);
    },
    close: close,
    isOpen: isOpen,
    current: function () { return current; }
  };
})(window.RADICLE);
