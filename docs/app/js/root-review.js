/* LINGUIST — five-question root review: three choices, two objective inputs. */

window.LINGUIST = window.LINGUIST || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var rootLayer = null;
  var questions = [];
  var index = 0;
  var correct = 0;
  var answered = false;

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = copy[i]; copy[i] = copy[j]; copy[j] = t;
    }
    return copy;
  }

  function choicesFor(root, all) {
    var others = all.filter(function (item) { return item.key !== root.key && item.meaning; });
    var options = [root.meaning].concat(shuffle(others).slice(0, 3).map(function (item) { return item.meaning; }));
    return shuffle(options).filter(function (value, i, list) { return value && list.indexOf(value) === i; });
  }

  function buildQuestions(list) {
    var all = ns.roots.allRoots();
    return list.slice(0, 5).map(function (root, i) {
      var family = ns.roots.familyWords(root.key);
      var word = root.wordIds && root.wordIds.length ? (ns.store.findRow(root.wordIds[0]) || {}).word : '';
      var useInput = i >= 3 && word && family.length;
      if (useInput) {
        if (i === 3) {
          return { type: 'input', mode: 'word-root', key: root.key, prompt: word,
            answers: [root.display].concat(root.variants || []), hint: ui.t('roots.inputRoot') };
        }
        return { type: 'input', mode: 'root-word', key: root.key, prompt: root.display,
          answers: family.map(function (item) { return item.word; }), hint: ui.t('roots.inputWord') };
      }
      return { type: 'choice', mode: 'root-meaning', key: root.key, prompt: root.display,
        hint: ui.t('roots.choiceMeaning'), options: choicesFor(root, all), answer: root.meaning };
    });
  }

  function build() {
    rootLayer = document.createElement('div');
    rootLayer.className = 'root-layer';
    rootLayer.setAttribute('role', 'dialog');
    rootLayer.setAttribute('aria-modal', 'true');
    rootLayer.setAttribute('aria-label', ui.t('roots.reviewTitle'));
    document.body.appendChild(rootLayer);
    rootLayer.addEventListener('click', function (event) {
      var close = event.target.closest('[data-root-close]');
      if (close) closeLayer();
    });
    rootLayer.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeLayer();
    });
  }

  function closeLayer() {
    if (rootLayer) {
      rootLayer.remove();
      rootLayer = null;
    }
    questions = [];
    index = 0;
    correct = 0;
  }

  function render() {
    if (!rootLayer) return;
    if (index >= questions.length) {
      rootLayer.innerHTML = '<div class="root-review-card"><h2>' + ui.esc(ui.t('roots.finished')) +
        '</h2><p>' + ui.esc(ui.t('roots.score', { n: correct, total: questions.length })) +
        '</p><button type="button" class="btn btn-primary" data-root-close>' +
        ui.esc(ui.t('common.back')) + '</button></div>';
      return;
    }
    var q = questions[index];
    var body = '<div class="root-review-card"><div class="root-review-top">' +
      '<span>' + ui.esc(ui.t('roots.question', { n: index + 1, total: questions.length })) + '</span>' +
      '<button type="button" class="icon-btn" data-root-close aria-label="' +
      ui.esc(ui.t('practice.close')) + '">' + ui.icon('close') + '</button></div>' +
      '<div class="root-review-prompt mono" dir="auto">' + ui.esc(q.prompt) + '</div>' +
      '<p class="hint">' + ui.esc(q.hint) + '</p>';
    if (q.type === 'choice') {
      body += '<div class="root-options">' + q.options.map(function (option) {
        return '<button type="button" class="row" data-root-answer="' + ui.esc(option) + '">' +
          '<span class="row-main">' + ui.esc(option) + '</span></button>';
      }).join('') + '</div>';
    } else {
      body += '<input class="input" data-root-input autocomplete="off" autocapitalize="off" ' +
        'autocorrect="off" spellcheck="false">' +
        '<button type="button" class="btn btn-primary" data-root-submit>' +
        ui.esc(ui.t('practice.check')) + '</button>';
    }
    body += '<div class="root-feedback" hidden></div></div>';
    rootLayer.innerHTML = body;
    if (q.type === 'input') {
      var input = rootLayer.querySelector('[data-root-input]');
      input.focus();
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') submitInput();
      });
      rootLayer.querySelector('[data-root-submit]').addEventListener('click', submitInput);
    }
    rootLayer.querySelectorAll('[data-root-answer]').forEach(function (button) {
      button.addEventListener('click', function () {
        judge(button.getAttribute('data-root-answer'));
      });
    });
  }

  function submitInput() {
    var input = rootLayer && rootLayer.querySelector('[data-root-input]');
    if (input) judge(input.value);
  }

  function judge(given) {
    if (answered || !rootLayer) return;
    answered = true;
    var q = questions[index];
    var ok = q.type === 'choice'
      ? given === q.answer
      : ns.roots.answerMatches(given, q.answers);
    if (ok) correct += 1;
    ns.roots.recordRootAnswer(q.key, ok);
    var feedback = rootLayer.querySelector('.root-feedback');
    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = ui.t(ok ? 'roots.right' : 'roots.wrong', { answer: q.answer || q.answers[0] });
    }
    setTimeout(function () {
      answered = false;
      index += 1;
      render();
    }, 650);
  }

  function open(onlyKey) {
    closeLayer();
    build();
    var due = ns.roots.dueQueue(5);
    if (onlyKey) {
      var one = ns.roots.getRoot(onlyKey);
      due = one ? [one] : [];
    }
    if (!due.length) {
      rootLayer.innerHTML = '<div class="root-review-card"><p>' +
        ui.esc(ui.t('roots.noDue')) + '</p><button type="button" class="btn" data-root-close>' +
        ui.esc(ui.t('common.back')) + '</button></div>';
      return;
    }
    questions = buildQuestions(due);
    render();
  }

  ns.rootReview = {
    open: open,
    close: closeLayer,
    buildQuestions: buildQuestions
  };
})(window.LINGUIST);
