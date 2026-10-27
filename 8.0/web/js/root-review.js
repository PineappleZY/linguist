/* LINGUIST — Ebbinghaus root review.

   Three fixed stages: root meaning, root spelling, same-root word meaning.
   A wrong answer changes nothing about the review date; it only moves the same
   stage to the end of this session. */

window.LINGUIST = window.LINGUIST || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var layer = null;
  var queue = [];
  var sessionRoots = [];
  var current = null;
  var completedRoots = 0;
  var correct = 0;
  var wrong = 0;
  var answered = false;
  var returnFocus = null;

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = copy[i]; copy[i] = copy[j]; copy[j] = t;
    }
    return copy;
  }

  function unique(values) {
    var seen = {};
    return values.filter(function (value) {
      var key = String(value || '').trim().toLowerCase();
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function optionsFor(root, all, family) {
    var answer = family ? family.gloss : root.meaning;
    var others = [];
    ns.roots.familyWords(root.key).forEach(function (word) {
      if (word.gloss && (!family || word.word !== family.word)) others.push(word.gloss);
    });
    all.forEach(function (item) {
      if (item.key !== root.key && item.meaning) others.push(item.meaning);
    });
    return shuffle(unique([answer].concat(shuffle(others).slice(0, 3))));
  }

  function stageQuestion(root, stage, all) {
    if (stage === 2) {
      return {
        root: root, stage: 2, type: 'input',
        prompt: root.meaning || root.display, hint: ui.t('roots.inputRoot'),
        answers: [root.display].concat(root.variants || [])
      };
    }
    if (stage === 3) {
      var family = ns.roots.familyWords(root.key).filter(function (item) { return item.word && item.gloss; })[0];
      if (family) {
        return {
          root: root, stage: 3, type: 'choice',
          prompt: root.display + ' + affix → ' + family.word,
          hint: ui.t('roots.choiceMeaning'),
          options: optionsFor(root, all, family), answer: family.gloss
        };
      }
      return null;
    }
    return {
      root: root, stage: 1, type: 'choice',
      prompt: root.display, hint: ui.t('roots.choiceMeaning'),
      options: optionsFor(root, all), answer: root.meaning
    };
  }

  function buildStageQuestions(roots) {
    return roots.map(function (root) { return stageQuestion(root, 1, roots); });
  }

  function build() {
    layer = document.createElement('div');
    layer.className = 'root-layer';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', ui.t('roots.reviewTitle'));
    document.body.appendChild(layer);
    layer.addEventListener('click', function (event) {
      if (event.target.closest('[data-root-close]')) close();
    });
    layer.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
      if (event.key !== 'Tab') return;
      var focusable = [].slice.call(layer.querySelectorAll('button:not([disabled]),input:not([disabled])'));
      if (!focusable.length) return;
      event.preventDefault();
      var index = focusable.indexOf(document.activeElement);
      var step = event.shiftKey ? -1 : 1;
      focusable[(index + step + focusable.length) % focusable.length].focus();
    });
  }

  function close() {
    if (layer) layer.remove();
    layer = null;
    queue = [];
    sessionRoots = [];
    current = null;
    completedRoots = 0;
    correct = 0;
    wrong = 0;
    answered = false;
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
    returnFocus = null;
  }

  function total() { return sessionRoots.length; }

  function render() {
    if (!layer) return;
    if (!current) {
      if (!queue.length) {
        layer.innerHTML = '<div class="root-review-card"><h2>' + ui.esc(ui.t('roots.finished')) +
          '</h2><p>' + ui.esc(ui.t('roots.score', { n: correct, total: correct + wrong })) +
          '</p><button type="button" class="btn btn-primary" data-root-close>' +
          ui.esc(ui.t('common.back')) + '</button></div>';
        return;
      }
      current = queue.shift();
    }
    var q = current;
    var body = '<div class="root-review-card"><div class="root-review-top"><span>' +
      ui.esc(ui.t('roots.question', { n: Math.min(total(), completedRoots + 1), total: total() })) + '</span>' +
      '<button type="button" class="icon-btn" data-root-close aria-label="' +
      ui.esc(ui.t('practice.close')) + '">' + ui.icon('close') + '</button></div>' +
      '<div class="root-review-prompt mono" dir="auto">' + ui.esc(q.prompt) + '</div>' +
      '<p class="hint">' + ui.esc(ui.t('roots.stage', { n: q.stage, total: 3 })) + ' · ' +
      ui.esc(q.hint) + '</p>';
    if (q.type === 'choice') {
      body += '<div class="root-options">' + q.options.map(function (option) {
        return '<button type="button" class="row" data-root-answer="' + ui.esc(option) + '">' +
          '<span class="row-main">' + ui.esc(option) + '</span></button>';
      }).join('') + '</div>';
    } else {
      body += '<input class="input" data-root-input aria-label="' + ui.esc(ui.t('roots.inputRoot')) +
        '" autocomplete="off" autocapitalize="off" ' +
        'autocorrect="off" spellcheck="false"><button type="button" class="btn btn-primary" ' +
        'data-root-submit>' + ui.esc(ui.t('practice.check')) + '</button>';
    }
    body += '<div class="root-feedback" aria-live="polite" hidden></div></div>';
    layer.innerHTML = body;
    if (q.type === 'input') {
      var input = layer.querySelector('[data-root-input]');
      input.focus();
      input.addEventListener('keydown', function (event) { if (event.key === 'Enter') submitInput(); });
      layer.querySelector('[data-root-submit]').addEventListener('click', submitInput);
    }
    layer.querySelectorAll('[data-root-answer]').forEach(function (button) {
      button.addEventListener('click', function () { judge(button.getAttribute('data-root-answer')); });
    });
  }

  function submitInput() {
    var input = layer && layer.querySelector('[data-root-input]');
    if (input) judge(input.value);
  }

  function judge(given) {
    if (answered || !current || !layer) return;
    answered = true;
    var q = current;
    var ok = q.type === 'choice' ? given === q.answer : ns.roots.answerMatches(given, q.answers);
    if (ok) {
      correct += 1;
      ns.roots.recordStage(q.root.key, q.stage, true);
      if (q.stage < 3) {
        var next = stageQuestion(q.root, q.stage + 1, sessionRoots);
        if (next) queue.push(next);
        else {
          ns.roots.recordStage(q.root.key, 3, true);
          completedRoots += 1;
        }
      }
      if (q.stage === 3) completedRoots += 1;
    } else {
      wrong += 1;
      ns.roots.recordStage(q.root.key, q.stage, false);
      queue.push(q);
    }
    current = null;
    var feedback = layer.querySelector('.root-feedback');
    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = ui.t(ok ? 'roots.right' : 'roots.wrong', { answer: q.answer || q.answers[0] });
    }
    setTimeout(function () { answered = false; render(); }, 650);
  }

  function open(onlyKey, options) {
    close();
    build();
    returnFocus = document.activeElement;
    options = options || {};
    var language = options.language || 'en';
    var outputLang = options.outputLang || ns.store.outputLangFor(language);
    var scope = options.scope || 'due';
    var due = ns.roots.reviewRoots
      ? ns.roots.reviewRoots(language, outputLang, scope)
      : ns.roots.dueQueue(ns.CONFIG.limits.rootReviewRound);
    due = due.slice(0, ns.CONFIG.limits.rootReviewRound);
    if (onlyKey) {
      var one = ns.roots.getRoot(onlyKey);
      due = one ? [one] : [];
    }
    if (!due.length) {
      layer.innerHTML = '<div class="root-review-card"><p>' + ui.esc(ui.t('roots.noDue')) +
        '</p><button type="button" class="btn" data-root-close>' + ui.esc(ui.t('common.back')) + '</button></div>';
      return;
    }
    sessionRoots = due.slice();
    queue = due.map(function (root) { return stageQuestion(root, 1, sessionRoots); });
    render();
    var first = layer.querySelector('button,input');
    if (first) first.focus();
  }

  ns.rootReview = {
    open: open,
    close: close,
    buildStageQuestions: buildStageQuestions,
    _stageQuestion: stageQuestion
  };
})(window.LINGUIST);
