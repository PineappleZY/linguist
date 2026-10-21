/* Radicle 5.0 — iOS behaviour layer.

   One job: keep the writing-practice controls above the on-screen keyboard.

   iOS does not resize the layout viewport when the keyboard opens, so an
   element pinned to `bottom: 0` inside a fixed, full-screen layer ends up
   behind it. The *visual* viewport does resize, so the gap between the two is
   the keyboard — measured here and published as --keyboard-inset, which
   overlay/ios.css consumes. Nothing else in the app reads it, and no other
   behaviour is patched: the frozen 5.0 code is left to do its own work. */

window.RADICLE = window.RADICLE || {};

(function (ns) {
  'use strict';

  var viewport = window.visualViewport;
  if (!viewport) return;

  /* Below this the difference is browser chrome drifting, not a keyboard. */
  var MIN_KEYBOARD = 80;

  function measure() {
    /* A pinch-zoom shrinks the visual viewport too, and that is not a
       keyboard. Only the unzoomed case is measured. */
    if (viewport.scale && viewport.scale !== 1) return;

    var covered = window.innerHeight - viewport.height - viewport.offsetTop;
    var inset = covered > MIN_KEYBOARD ? Math.round(covered) : 0;
    document.documentElement.style.setProperty('--keyboard-inset', inset + 'px');
  }

  function clear() {
    document.documentElement.style.removeProperty('--keyboard-inset');
  }

  viewport.addEventListener('resize', measure);
  viewport.addEventListener('scroll', measure);
  window.addEventListener('orientationchange', function () {
    /* Coming out of a rotation the numbers are briefly stale; the resize that
       follows re-measures anyway, this only stops a wrong padding flashing. */
    clear();
    window.setTimeout(measure, 120);
  });

  ns.ios = {
    keyboardInset: function () {
      var raw = document.documentElement.style.getPropertyValue('--keyboard-inset');
      return parseInt(raw, 10) || 0;
    },
    measure: measure
  };
})(window.RADICLE);
