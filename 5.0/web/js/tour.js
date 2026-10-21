/* RADICLE — first-run tour.

   Seven spotlight steps over the real interface, in whichever interface
   language is set. It runs once, writes the fact into settings (so a backup
   carries it), and Profile can replay it.

   A step whose target is not on screen — someone with an empty history has no
   entry toolbar to point at — shows its card centred instead of skipping: the
   sentence is still worth reading, and a step that vanishes silently is worse
   than one without a spot. */

window.RADICLE = window.RADICLE || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;

  /* Order is the order a newcomer needs them: what to type, what the type
     picker does, which language, which explanation language, the one button
     that is not a search, where the three screens are, and the key. */
  var STEPS = [
    { id: 'search', targets: ['#lookup-input'] },
    { id: 'type', targets: ['[data-segmented="mode"]'] },
    { id: 'lang', targets: ['[data-picker="lookup-lang"]'] },
    { id: 'explain', targets: ['[data-picker="output-lang"]', '[data-picker="out-lang-en"]'] },
    { id: 'surprise', targets: ['#lookup-surprise'] },
    { id: 'tabs', targets: ['#tabbar'] },
    { id: 'key', targets: ['#quick-key', '[data-picker="ui-lang"]'] }
  ];

  var root = null;
  var spot = null;
  var card = null;
  var index = 0;
  var returnFocus = null;

  function usable() {
    return !!(document && document.body && typeof document.createElement === 'function' &&
      typeof document.createElement('div').querySelector === 'function');
  }

  function build() {
    if (root) return root;
    root = document.createElement('div');
    root.className = 'tour-host';
    root.hidden = true;
    root.innerHTML =
      '<div class="tour-spot" data-tour-spot hidden></div>' +
      '<div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" tabindex="-1">' +
      '<div class="tour-step" data-tour-step></div>' +
      '<div class="tour-title" id="tour-title" data-tour-title></div>' +
      '<div class="tour-text" data-tour-text></div>' +
      '<div class="tour-actions">' +
      '<button type="button" class="btn-quiet btn" data-tour="skip" data-tour-skip></button>' +
      '<span class="tour-spacer"></span>' +
      '<button type="button" class="btn" data-tour="back" data-tour-back></button>' +
      '<button type="button" class="btn btn-primary" data-tour="next" data-tour-next></button>' +
      '</div></div>';
    document.body.appendChild(root);
    spot = root.querySelector('[data-tour-spot]');
    card = root.querySelector('.tour-card');
    root.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('[data-tour]') : null;
      if (!button) return;
      var action = button.getAttribute('data-tour');
      if (action === 'skip') finish();
      else if (action === 'back') show(index - 1);
      else if (action === 'next') (index >= STEPS.length - 1 ? finish() : show(index + 1));
    });
    root.addEventListener('keydown', onKey);
    return root;
  }

  function onKey(event) {
    if (root.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); finish(); return; }
    if (event.key === 'ArrowRight') { event.preventDefault(); if (index < STEPS.length - 1) show(index + 1); return; }
    if (event.key === 'ArrowLeft') { event.preventDefault(); if (index > 0) show(index - 1); return; }
    if (event.key !== 'Tab') return;
    /* Modal, so Tab stays inside the card. */
    var focusable = [].slice.call(card.querySelectorAll('button:not([hidden])'));
    if (!focusable.length) return;
    event.preventDefault();
    var at = focusable.indexOf(document.activeElement);
    var step = event.shiftKey ? -1 : 1;
    focusable[(at + step + focusable.length) % focusable.length].focus();
  }

  function findTarget(step) {
    for (var i = 0; i < step.targets.length; i += 1) {
      var node = document.querySelector(step.targets[i]);
      if (node) return node;
    }
    return null;
  }

  function place(node) {
    if (!node) {
      spot.hidden = true;
      card.classList.add('is-centred');
      return;
    }
    var box = node.getBoundingClientRect();
    card.classList.remove('is-centred');
    spot.hidden = false;
    spot.style.top = Math.max(0, box.top - 6) + 'px';
    spot.style.left = Math.max(0, box.left - 6) + 'px';
    spot.style.width = (box.width + 12) + 'px';
    spot.style.height = (box.height + 12) + 'px';
    /* Put the card under the spotlight, or above it when the target is low. */
    var below = box.bottom + 16;
    if (below + 220 > window.innerHeight) {
      card.style.top = Math.max(12, box.top - 236) + 'px';
    } else {
      card.style.top = below + 'px';
    }
  }

  function show(next) {
    if (next < 0 || next >= STEPS.length) return;
    index = next;
    var step = STEPS[index];
    build();
    root.querySelector('[data-tour-step]').textContent =
      ui.t('tour.step', { n: index + 1, total: STEPS.length });
    root.querySelector('[data-tour-title]').textContent = ui.t('tour.' + step.id + '.title');
    root.querySelector('[data-tour-text]').textContent = ui.t('tour.' + step.id + '.text');
    root.querySelector('[data-tour-skip]').textContent = ui.t('tour.skip');
    root.querySelector('[data-tour-back]').textContent = ui.t('tour.back');
    root.querySelector('[data-tour-next]').textContent =
      index === STEPS.length - 1 ? ui.t('tour.done') : ui.t('tour.next');
    root.querySelector('[data-tour-back]').disabled = index === 0;
    root.hidden = false;
    place(findTarget(step));
    if (card.focus) card.focus();
  }

  function start() {
    if (!usable()) return false;
    returnFocus = document.activeElement;
    build();
    show(0);
    return true;
  }

  function finish() {
    if (root) root.hidden = true;
    ns.store.patchSettings({ tourDone: true });
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
    returnFocus = null;
    index = 0;
  }

  /* Called once after the first paint: it runs for a new install and never
     again, unless Profile asks for it. */
  function shouldRun() {
    return !ns.store.getSettings().tourDone;
  }

  function maybeStart() {
    if (!shouldRun()) return false;
    return start();
  }

  ns.tour = {
    steps: STEPS,
    start: start,
    show: show,
    finish: finish,
    maybeStart: maybeStart,
    shouldRun: shouldRun,
    isOpen: function () { return !!root && !root.hidden; },
    index: function () { return index; }
  };
})(window.RADICLE);
