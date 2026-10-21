/* RADICLE — DeepSeek client.

   Two axes are threaded through every call: the SOURCE language (what the
   headword is in) and the OUTPUT language (what the explanations are in).

   Lookup is two stages — a fast overview, then the deep lines in parallel.
   There are four of those for the languages that inflect (etymology, usage,
   inflection, distinction) and three for Chinese and Japanese, which have no
   paradigm to tabulate. Sentence analysis is two requests in parallel.
   Everything downstream of a line is independent: its own prompt, its own
   token ceiling, its own retry, its own failure. */

window.RADICLE = window.RADICLE || {};

(function (ns) {
  'use strict';

  var CONFIG = ns.CONFIG;
  var prompts = ns.prompts;

  /* ---------- Errors ---------- */

  var ERROR_TEXT = {
    no_key: 'No API key yet. Add your DeepSeek key in Profile to start looking words up.',
    auth: 'DeepSeek rejected this API key.',
    balance: 'This DeepSeek account is out of balance.',
    rate_limit: 'DeepSeek is rate limiting right now.',
    timeout: 'The request took too long and was cancelled.',
    network: 'Could not reach api.deepseek.com.',
    server: 'DeepSeek returned a server error.',
    bad_json: 'The answer came back unreadable.',
    offline: 'You appear to be offline.',
    /* The overview or the detector came back without a language. Without one
       the entry could only be grouped under a language that does not exist. */
    language: 'The answer did not say which language this is.'
  };

  function ApiError(kind, detail, extra) {
    var message = ERROR_TEXT[kind] || 'Something went wrong.';
    this.name = 'ApiError';
    this.kind = kind;
    this.message = message;
    this.detail = detail || '';
    this.extra = extra || {};
    this.stack = new Error(message).stack;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  function isApiError(err) { return !!err && err.name === 'ApiError'; }

  function toErrorShape(err) {
    if (isApiError(err)) {
      return {
        kind: err.kind, message: err.message, detail: err.detail,
        raw: err.extra ? err.extra.raw : ''
      };
    }
    return { kind: 'server', message: String(err && err.message ? err.message : err) };
  }

  /* ---------- Transport ---------- */

  function statusToKind(status, payload) {
    if (status === 401) return 'auth';
    if (status === 402) return 'balance';
    if (status === 429) return 'rate_limit';
    if (status === 400 || status === 422) return 'server';
    if (status >= 500) return 'server';
    var code = payload && payload.error && payload.error.type;
    if (code === 'insufficient_quota') return 'balance';
    return 'server';
  }

  function describe(payload, fallback) {
    if (payload && payload.error && payload.error.message) return String(payload.error.message);
    return fallback || '';
  }

  function requestOnce(apiKey, payload) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = null;
    var timedOut = false;

    if (controller) {
      timer = window.setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, CONFIG.api.timeoutMs);
    }

    var options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify(payload)
    };
    if (controller) options.signal = controller.signal;

    return Promise.resolve().then(function () {
      return window.fetch(CONFIG.api.endpoint, options);
    }).then(function (response) {
      return response.text().then(function (text) {
        if (timer) window.clearTimeout(timer);
        var parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch (err) { parsed = null; }

        if (!response.ok) {
          throw new ApiError(statusToKind(response.status, parsed), describe(parsed, 'HTTP ' + response.status));
        }
        if (!parsed || !parsed.choices || !parsed.choices.length) {
          throw new ApiError('server', 'Malformed response from the model.');
        }

        var message = parsed.choices[0].message || {};
        var content = message.content || '';
        if (typeof content === 'string' && content.trim()) return content;
        throw new ApiError('bad_json', 'Empty content', {
          raw: '',
          finishReason: parsed.choices[0].finish_reason || 'unknown'
        });
      });
    }).catch(function (err) {
      if (timer) window.clearTimeout(timer);
      if (isApiError(err)) throw err;
      if (err && err.name === 'AbortError') {
        throw new ApiError(timedOut ? 'timeout' : 'network', timedOut ? 'Request timed out' : 'Request aborted');
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new ApiError('offline', 'navigator.onLine is false');
      }
      throw new ApiError('network', err && err.message ? err.message : 'fetch failed');
    });
  }

  function request(apiKey, payload) {
    var attempts = 0;
    function attempt() {
      attempts += 1;
      return requestOnce(apiKey, payload).catch(function (err) {
        if (isApiError(err) && err.kind === 'rate_limit' && attempts < CONFIG.api.maxAttemptsOnRateLimit) {
          return new Promise(function (resolve) {
            window.setTimeout(resolve, CONFIG.api.retryBackoffMs * attempts);
          }).then(attempt);
        }
        throw err;
      });
    }
    return attempt();
  }

  /* ---------- JSON extraction ---------- */

  function extractJSON(content) {
    var text = String(content || '').trim();
    if (!text) throw new ApiError('bad_json', 'Empty content', { raw: '' });

    if (text.indexOf('```') === 0 || text.indexOf('```') > -1 && text.indexOf('{') > text.indexOf('```')) {
      text = text.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim();
    }

    try {
      return JSON.parse(text);
    } catch (err) {
      var start = text.indexOf('{');
      var end = text.lastIndexOf('}');
      if (start > -1 && end > start) {
        try { return JSON.parse(text.slice(start, end + 1)); } catch (inner) {
          throw new ApiError('bad_json', 'Could not parse json', { raw: text });
        }
      }
      throw new ApiError('bad_json', 'Could not parse json', { raw: text });
    }
  }

  /* ---------- Payload ---------- */

  function basePayload(model, messages, maxTokens) {
    return {
      model: model,
      messages: messages,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      temperature: 0.3
    };
  }

  function requireKey(apiKey) {
    if (!apiKey || !String(apiKey).trim()) throw new ApiError('no_key', 'settings.apiKey is empty');
    return String(apiKey).trim();
  }

  /* Shared context block for every deep line. */
  function deepContext(overview) {
    var context = {
      word: overview.word,
      language: overview.language,
      reading: overview.reading,
      pos: overview.pos,
      quick_meaning: overview.quick_meaning,
      register: overview.register
    };
    return 'Headword: "' + overview.word + '"\n' +
      'Overview already produced for it (json): ' + JSON.stringify(context);
  }

  function lineTokens(line) { return CONFIG.maxTokens[line] || CONFIG.maxTokens.etymology; }

  /* ---------- Public API ---------- */

  function overview(options) {
    var key;
    try { key = requireKey(options.apiKey); } catch (err) { return Promise.reject(err); }
    var messages = [
      { role: 'system', content: prompts.overview(options.sourceLang, options.outputLang) },
      { role: 'user', content: 'Headword: "' + options.input + '"' }
    ];
    return request(key, basePayload(options.model, messages, CONFIG.maxTokens.overview)).then(extractJSON);
  }

  function deepLine(options) {
    var key;
    try { key = requireKey(options.apiKey); } catch (err) { return Promise.reject(err); }
    /* Which lines exist is a function of the source language, not a constant:
       asking for the inflection line of a Chinese word must fail here rather
       than spend a request on a prompt that cannot be built. */
    if (CONFIG.deepLinesFor(options.sourceLang).indexOf(options.line) === -1) {
      return Promise.reject(new ApiError('server', 'Unknown deep line: ' + options.line));
    }
    var messages = [
      { role: 'system', content: prompts.deep(options.sourceLang, options.line, options.outputLang) },
      { role: 'user', content: deepContext(options.overview) }
    ];
    return request(key, basePayload(options.model, messages, lineTokens(options.line))).then(extractJSON);
  }

  /* Every deep line in parallel; `onLine` fires as each settles so the page can
     paint line by line. Never rejects as a batch. */
  function deepLines(options, onLine) {
    return Promise.all(CONFIG.deepLinesFor(options.sourceLang).map(function (line) {
      return deepLine({
        apiKey: options.apiKey,
        model: options.model,
        sourceLang: options.sourceLang,
        outputLang: options.outputLang,
        overview: options.overview,
        line: line
      }).then(function (data) {
        var result = { line: line, ok: true, data: data };
        if (typeof onLine === 'function') onLine(result);
        return result;
      }).catch(function (err) {
        var failure = { line: line, ok: false, error: toErrorShape(err) };
        if (typeof onLine === 'function') onLine(failure);
        return failure;
      });
    })).then(function (results) {
      var byLine = {};
      results.forEach(function (result) { byLine[result.line] = result; });
      return byLine;
    });
  }

  /* Sentence analysis: two lines in parallel, same contract as deepLines. */
  function sentenceLine(options) {
    var key;
    try { key = requireKey(options.apiKey); } catch (err) { return Promise.reject(err); }
    if (CONFIG.sentenceLines.indexOf(options.line) === -1) {
      return Promise.reject(new ApiError('server', 'Unknown sentence line: ' + options.line));
    }
    var messages = [
      { role: 'system', content: prompts.sentence(options.sourceLang, options.line, options.outputLang) },
      { role: 'user', content: 'Sentence: "' + options.input + '"' }
    ];
    var tokens = options.line === 'semantics' ? CONFIG.maxTokens.sentenceSemantics : CONFIG.maxTokens.sentenceGrammar;
    return request(key, basePayload(options.model, messages, tokens)).then(extractJSON);
  }

  function sentenceLines(options, onLine) {
    return Promise.all(CONFIG.sentenceLines.map(function (line) {
      return sentenceLine({
        apiKey: options.apiKey,
        model: options.model,
        sourceLang: options.sourceLang,
        outputLang: options.outputLang,
        input: options.input,
        line: line
      }).then(function (data) {
        var result = { line: line, ok: true, data: data };
        if (typeof onLine === 'function') onLine(result);
        return result;
      }).catch(function (err) {
        var failure = { line: line, ok: false, error: toErrorShape(err) };
        if (typeof onLine === 'function') onLine(failure);
        return failure;
      });
    })).then(function (results) {
      var byLine = {};
      results.forEach(function (result) { byLine[result.line] = result; });
      return byLine;
    });
  }

  /* One tiny question, no overview involved: what language is this? A sentence
     never gets an overview, and an entry stored before 4.2 may have no language
     recorded at all, so this is the cheapest way to fill that in. */
  function detectLanguage(options) {
    var key;
    try { key = requireKey(options.apiKey); } catch (err) { return Promise.reject(err); }
    var messages = [
      { role: 'system', content: prompts.detect() },
      { role: 'user', content: 'The text: "' + options.input + '"' }
    ];
    return request(key, basePayload(options.model, messages, CONFIG.maxTokens.detect))
      .then(extractJSON)
      .then(function (data) {
        return { language: CONFIG.languageByAnyName(data && data.language) };
      });
  }

  /* Accent rescue: the learner typed a form without diacritics. Returns
     { typed_is_valid, candidates }. */
  function accentCandidates(options) {
    var key;
    try { key = requireKey(options.apiKey); } catch (err) { return Promise.reject(err); }
    var messages = [
      { role: 'system', content: prompts.candidate(options.sourceLang, options.outputLang, options.input) },
      { role: 'user', content: 'The learner typed: "' + options.input + '"' }
    ];
    return request(key, basePayload(options.model, messages, CONFIG.maxTokens.candidate))
      .then(extractJSON)
      .then(function (data) {
        return {
          typedIsValid: !!(data && data.typed_is_valid),
          candidates: data && Array.isArray(data.candidates) ? data.candidates : []
        };
      });
  }

  /* Reverse lookup: the query is not in the target language at all. */
  function reverseCandidates(options) {
    var key;
    try { key = requireKey(options.apiKey); } catch (err) { return Promise.reject(err); }
    var messages = [
      { role: 'system', content: prompts.reverse(options.sourceLang, options.outputLang) },
      { role: 'user', content: 'The user typed: "' + options.input + '"' }
    ];
    return request(key, basePayload(options.model, messages, CONFIG.maxTokens.candidate))
      .then(extractJSON)
      .then(function (data) {
        if (!data || !Array.isArray(data.candidates)) {
          return { status: data && data.status ? data.status : 'not_found', candidates: [] };
        }
        return data;
      });
  }

  function testConnection(options) {
    var key;
    try { key = requireKey(options.apiKey); } catch (err) { return Promise.reject(err); }
    var payload = {
      model: options.model,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      max_tokens: 16,
      thinking: { type: 'disabled' }
    };
    return request(key, payload).then(function (content) {
      return { ok: true, sample: String(content).trim().slice(0, 40) };
    });
  }

  /* One beautiful word to explore. Returns null rather than throwing when the
     model answers with something unusable — a bad suggestion should just mean
     "try again", not an error banner. */
  function surprise(options) {
    var key;
    try { key = requireKey(options.apiKey); } catch (err) { return Promise.reject(err); }
    var avoid = Array.isArray(options.avoid) ? options.avoid.filter(Boolean).slice(0, 12) : [];
    var messages = [
      { role: 'system', content: prompts.surprise(options.sourceLang, options.outputLang) },
      {
        role: 'user',
        content: avoid.length
          ? 'Do not offer any of these, they were shown recently: ' + avoid.join(', ')
          : 'Nothing to avoid yet.'
      }
    ];
    return request(key, basePayload(options.model, messages, CONFIG.maxTokens.surprise))
      .then(extractJSON)
      .then(function (data) {
        if (!data || !data.word) return null;
        return {
          word: String(data.word).trim(),
          language: String(data.language || '').trim(),
          gloss: data.gloss || '',
          why: data.why || ''
        };
      });
  }

  ns.api = {
    ApiError: ApiError,
    isApiError: isApiError,
    toErrorShape: toErrorShape,
    overview: overview,
    deepLine: deepLine,
    deepLines: deepLines,
    sentenceLine: sentenceLine,
    sentenceLines: sentenceLines,
    detectLanguage: detectLanguage,
    accentCandidates: accentCandidates,
    reverseCandidates: reverseCandidates,
    testConnection: testConnection,
    surprise: surprise,
    errorText: ERROR_TEXT
  };
})(window.RADICLE);
