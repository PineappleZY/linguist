/* RADICLE — pronunciation playback via the platform speech synthesiser.
   Free and offline on most devices; the UI hides the speaker button when the
   browser has no speech synthesis at all. */

window.RADICLE = window.RADICLE || {};

(function (ns) {
  'use strict';

  var synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  var voices = [];
  var speaking = false;

  function refreshVoices() {
    if (!synth || typeof synth.getVoices !== 'function') return;
    try {
      voices = synth.getVoices() || [];
    } catch (err) {
      voices = [];
    }
  }

  if (synth) {
    refreshVoices();
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', refreshVoices);
    } else {
      synth.onvoiceschanged = refreshVoices;
    }
  }

  function supported() {
    return !!synth && typeof window.SpeechSynthesisUtterance === 'function';
  }

  /* Voice lookup degrades gracefully: exact locale -> language prefix -> default. */
  function pickVoice(lang) {
    if (!voices.length) refreshVoices();
    var target = String(lang || '').toLowerCase();
    var base = target.split('-')[0];
    var i;

    for (i = 0; i < voices.length; i += 1) {
      if (String(voices[i].lang || '').toLowerCase() === target) return voices[i];
    }
    for (i = 0; i < voices.length; i += 1) {
      var candidate = String(voices[i].lang || '').toLowerCase();
      if (candidate.split('-')[0] === base) return voices[i];
    }
    return null;
  }

  /* Returns true when playback was started. */
  function speak(text, lang) {
    if (!supported() || !text) return false;
    try {
      synth.cancel();
      var utterance = new window.SpeechSynthesisUtterance(String(text));
      utterance.lang = lang || 'en-US';
      var voice = pickVoice(utterance.lang);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.onstart = function () { speaking = true; };
      utterance.onend = function () { speaking = false; };
      utterance.onerror = function () { speaking = false; };
      synth.speak(utterance);
      return true;
    } catch (err) {
      return false;
    }
  }

  function stop() {
    if (!synth) return;
    try {
      synth.cancel();
    } catch (err) {
      /* ignore */
    }
    speaking = false;
  }

  ns.speech = {
    supported: supported,
    speak: speak,
    stop: stop,
    isSpeaking: function () { return speaking; }
  };
})(window.RADICLE);
