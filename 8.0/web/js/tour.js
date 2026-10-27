/* LINGUIST — first-run tour.

   Spotlight steps over the real interface, in whichever interface language is
   set. It runs once, writes the fact into settings (so a backup carries it),
   and Profile can replay it.

   Two rules, both learned the hard way:

   1. A step may name the screen it lives on. The explanation-language default
      and the card preferences are on Profile; pointing at them without going
      there left the card floating over a screen that had no such control.
   2. The card's position is computed by a pure function and the inline `top` is
      always cleared before a new value is written. The old code left the value
      from the previous step in place, and an inline style beats the class that
      centres the card — so a step whose target was missing put the card off
      screen, buttons and all. That is what "the tour gets stuck" was. */

window.LINGUIST = window.LINGUIST || {};

(function (ns) {
  'use strict';

  var ui = ns.ui;
  var store = ns.store;

  /* The order a newcomer needs them: what to type, what the type picker does,
     which language, what the answers are written in, which cards show, the one
     button that is not a search, the file reader, where the screens are, and
     the key. `route` is the screen the step points at — a string, or a function
     when the right screen depends on the state (the key lives in the dictionary
     empty state until one has been saved, and in Profile after that). */
  var STEPS = [
    { id: 'search', route: '#/dictionary', targets: ['#lookup-input'] },
    { id: 'type', route: '#/dictionary', targets: ['[data-segmented="mode"]'] },
    { id: 'lang', route: '#/dictionary', targets: ['[data-picker="lookup-lang"]'] },
    { id: 'explain', route: '#/profile', targets: ['[data-picker="out-lang-en"]'] },
    { id: 'cards', route: '#/profile', targets: ['[data-pref-group="latin"]'] },
    { id: 'roots', route: '#/roots', targets: ['#roots-review', '#tabbar'] },
    { id: 'surprise', route: '#/dictionary', targets: ['#lookup-surprise'] },
    /* Showing the file panel rather than the segment that opens it: the panel
       is the thing being explained, and the mode is put back afterwards. */
    { id: 'file', route: '#/dictionary', mode: 'file', targets: ['#file-drop', '[data-seg="file"]'] },
    { id: 'tabs', route: '#/dictionary', mode: 'auto', targets: ['#tabbar'] },
    {
      id: 'key',
      route: function () { return store.getSettings().apiKey ? '#/profile' : '#/dictionary'; },
      targets: ['#quick-key', '#api-key']
    }
  ];

  var root = null;
  var spot = null;
  var card = null;
  var index = 0;
  var returnFocus = null;
  var routeBefore = null;
  var modeBefore = null;

  function usable() {
    return !!(document && document.body && typeof document.createElement === 'function' &&
      typeof document.createElement('div').querySelector === 'function');
  }

  /* ---------- Layout (pure) ----------
     Everything about where things go is decided here, with numbers, so it can
     be tested without a DOM. `box` is a target's viewport rect or null when
     there is no target on this screen — a step is still worth reading, and a
     step that vanishes silently is worse than one without a spot. */

  var MARGIN = 12;
  var GAP = 16;

  function layoutFor(box, viewport, cardSize) {
    var vh = viewport && viewport.height ? viewport.height : 800;
    var vw = viewport && viewport.width ? viewport.width : 400;
    var cardH = cardSize && cardSize.height ? cardSize.height : 200;
    var cardW = cardSize && cardSize.width ? cardSize.width : Math.min(420, vw - 32);
    var cardLeft = Math.max(MARGIN, Math.round((vw - cardW) / 2));
    var centred = Math.max(MARGIN, Math.round((vh - cardH) / 2));

    if (!box) {
      return {
        placement: 'centred', top: null, left: null, width: 0, height: 0,
        cardTop: clamp(centred, MARGIN, vh - cardH - MARGIN), cardLeft: cardLeft
      };
    }

    /* Clamped into the viewport at both ends: a card that is taller than the
       screen still has to start on it. */
    var cardTop = clamp(centred, MARGIN, vh - cardH - MARGIN);
    var placement = 'centred';
    var below = box.top + box.height + GAP;
    var above = box.top - cardH - GAP;
    if (below + cardH <= vh - MARGIN) {
      placement = 'below';
      cardTop = clamp(below, MARGIN, vh - cardH - MARGIN);
    } else if (above >= MARGIN) {
      placement = 'above';
      cardTop = clamp(above, MARGIN, vh - cardH - MARGIN);
    }

    return {
      placement: placement,
      top: Math.max(0, Math.round(box.top) - 6),
      left: Math.max(0, Math.round(box.left) - 6),
      width: Math.round(box.width) + 12,
      height: Math.round(box.height) + 12,
      cardTop: cardTop,
      cardLeft: cardLeft
    };
  }

  function clamp(value, low, high) {
    if (high < low) return low;
    return Math.max(low, Math.min(high, value));
  }

  function rectOf(node) {
    var box = node.getBoundingClientRect();
    return { top: box.top, left: box.left, width: box.width, height: box.height };
  }

  function viewport() {
    return {
      width: window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 400,
      height: window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 800
    };
  }

  function cardSize() {
    var box = card && card.getBoundingClientRect ? card.getBoundingClientRect() : null;
    return { width: (box && box.width) || 420, height: (box && box.height) || 200 };
  }

  /* ---------- DOM ---------- */

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
    var focusable = [].slice.call(card.querySelectorAll('button:not([hidden]):not([disabled])'));
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

  /* Writes the layout onto the card. The inline `top` is removed first, every
     time: `is-centred` sets `top: 50%` in the stylesheet, and an inline value
     left over from an earlier step would win over it. */
  function place(node) {
    if (!node) {
      spot.hidden = true;
      card.classList.add('is-centred');
      var view = viewport();
      var size = cardSize();
      var box = layoutFor(null, view, size);
      card.style.top = box.cardTop + 'px';
      return box;
    }

    /* The target has to be on screen before it can be measured: a spotlight on
       something below the fold used to put the card below the fold too. */
    var rect = node.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > (window.innerHeight || 800)) {
      if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'center' });
      rect = node.getBoundingClientRect();
    }

    var layout = layoutFor(rectOf(node), viewport(), cardSize());
    spot.hidden = false;
    spot.style.top = layout.top + 'px';
    spot.style.left = layout.left + 'px';
    spot.style.width = layout.width + 'px';
    spot.style.height = layout.height + 'px';
    card.classList.remove('is-centred');
    card.style.top = layout.cardTop + 'px';
    return layout;
  }

  function relayout() {
    if (!root || root.hidden) return;
    place(findTarget(STEPS[index]));
  }

  function watchLayout() {
    window.addEventListener('resize', relayout);
    window.addEventListener('scroll', relayout, true);
  }

  function unwatchLayout() {
    window.removeEventListener('resize', relayout);
    window.removeEventListener('scroll', relayout, true);
  }

  /* ---------- Running a step ---------- */

  /* A step that lives on another screen goes there first, and the spotlight is
     placed after that screen has painted. */
  function show(next) {
    if (next < 0 || next >= STEPS.length) return;
    index = next;
    var step = STEPS[next];
    build();

    if (step.mode && modeBefore === null) modeBefore = ns.session.mode;
    else if (!step.mode && modeBefore !== null) { ns.session.mode = modeBefore; modeBefore = null; }
    if (step.mode) ns.session.mode = step.mode;

    var route = typeof step.route === 'function' ? step.route() : step.route;
    var wait = false;
    if (route && location.hash !== route) {
      ns.router.go(route);
      wait = true;
    } else if (step.mode) {
      ns.router.refresh();
      wait = true;
    }

    function draw() {
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

    if (wait) window.setTimeout(draw, 0);
    else draw();
  }

  function start() {
    if (!usable()) return false;
    returnFocus = document.activeElement;
    routeBefore = location.hash;
    modeBefore = null;
    build();
    watchLayout();
    show(0);
    return true;
  }

  function finish() {
    if (root) root.hidden = true;
    unwatchLayout();
    /* Whatever the tour changed to show itself is put back: it is a visitor on
       these screens, not a setting. */
    if (modeBefore !== null) { ns.session.mode = modeBefore; modeBefore = null; }
    if (routeBefore && location.hash !== routeBefore) ns.router.go(routeBefore);
    else ns.router.refresh();
    routeBefore = null;
    store.patchSettings({ tourDone: true });
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
    /* Exposed so the placement arithmetic is checked directly rather than
       through a screenshot: the bug this replaces was in these numbers. */
    layoutFor: layoutFor,
    place: place,
    isOpen: function () { return !!root && !root.hidden; },
    index: function () { return index; }
  };
})(window.LINGUIST);
