/* Linguist — installability.
   Registers the service worker, tracks whether the browser is offering an
   install prompt, and exposes install state to the Profile screen.

   This file is removed from the offline single-file build: file:// has no
   secure context, so service worker registration there could only fail. */

window.LINGUIST = window.LINGUIST || {};

(function (ns) {
  'use strict';

  var deferredPrompt = null;
  var installed = false;

  function secureContext() {
    if (location.protocol === 'https:') return true;
    var host = location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  }

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia && window.matchMedia('(display-mode: minimal-ui)').matches) return true;
    } catch (err) {
      /* ignore */
    }
    return window.navigator.standalone === true;
  }

  function isIos() {
    var ua = window.navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    /* iPadOS 13+ reports itself as a Mac; the touch points give it away. */
    return /Macintosh/.test(ua) && (window.navigator.maxTouchPoints || 0) > 1;
  }

  function register() {
    if (!('serviceWorker' in window.navigator)) return Promise.resolve(false);
    if (!secureContext()) return Promise.resolve(false);
    return window.navigator.serviceWorker.register('sw.js').then(function () {
      return true;
    }).catch(function () {
      return false;
    });
  }

  function init() {
    installed = isStandalone();

    window.addEventListener('beforeinstallprompt', function (event) {
      /* Keep the event so Profile can trigger it from a tap later. */
      event.preventDefault();
      deferredPrompt = event;
    });

    window.addEventListener('appinstalled', function () {
      installed = true;
      deferredPrompt = null;
    });

    return register();
  }

  /* 'installed' | 'prompt' | 'ios' | 'manual' */
  function state() {
    if (installed || isStandalone()) return 'installed';
    if (deferredPrompt) return 'prompt';
    if (isIos()) return 'ios';
    return 'manual';
  }

  /* Resolves to 'accepted' | 'dismissed' | 'unavailable'. */
  function promptInstall() {
    if (!deferredPrompt) return Promise.resolve('unavailable');
    var event = deferredPrompt;
    deferredPrompt = null;
    return event.prompt().then(function () {
      return event.userChoice;
    }).then(function (choice) {
      return choice && choice.outcome ? choice.outcome : 'dismissed';
    }).catch(function () {
      return 'dismissed';
    });
  }

  ns.pwa = {
    init: init,
    register: register,
    state: state,
    promptInstall: promptInstall,
    isStandalone: isStandalone,
    secureContext: secureContext
  };
})(window.LINGUIST);
