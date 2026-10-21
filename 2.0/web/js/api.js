/* RADICLE — DeepSeek client.

   Lookup is four requests:
     overview                            — IPA, part of speech, one-line gist (fast, first paint)
     etymology | usage | distinction     — three deep lines, fired in parallel

   The deep lines are independent: each has its own prompt, its own token
   ceiling, its own retry, and its own failure. One line failing never blocks
   the other two.

   The API is OpenAI-compatible; json_object output additionally requires the
   prompt to contain the word "json" and a shape example, which the templates in
   prompts.js provide. */

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
    offline: 'You appear to be offline.'
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

  function isApiError(err) {
    return !!err && err.name === 'ApiError';
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

  /* Performs one HTTP round trip and resolves with the raw content string. */
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: JSON.stringify(payload)
    };
    if (controller) options.signal = controller.signal;

    /* Wrapped so a synchronous throw from fetch lands in the catch below
       instead of escaping as a non-promise error. */
    return Promise.resolve().then(function () {
      return window.fetch(CONFIG.api.endpoint, options);
    }).then(function (response) {
      return response.text().then(function (text) {
        if (timer) window.clearTimeout(timer);
        var parsed = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch (err) {
          parsed = null;
        }

        if (!response.ok) {
          var kind = statusToKind(response.status, parsed);
          throw new ApiError(kind, describe(parsed, 'HTTP ' + response.status));
        }
        if (!parsed || !parsed.choices || !parsed.choices.length) {
          throw new ApiError('server', 'Malformed response from the model.');
        }

        var message = parsed.choices[0].message || {};
        var content = message.content || '';
        if (typeof content === 'string' && content.trim()) return content;
        /* JSON mode can occasionally return empty content; surface the finish
           reason so the UI can offer a retry instead of rendering nothing. */
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

  /* Retries once on 429 with a short backoff, per the agreed error matrix. */
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
      /* Recover the outermost object when the model wrapped json in prose. */
      var start = text.indexOf('{');
      var end = text.lastIndexOf('}');
      if (start > -1 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch (inner) {
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
      /* Thinking is off everywhere: it ignores temperature, roughly doubles
         latency, and these are structured extraction tasks rather than
         reasoning problems. */
      thinking: { type: 'disabled' },
      temperature: 0.3
    };
  }

  function requireKey(apiKey) {
    if (!apiKey || !String(apiKey).trim()) throw new ApiError('no_key', 'settings.apiKey is empty');
    return String(apiKey).trim();
  }

  /* Shared context block for every deep line: the headword plus the overview
     that was already produced, so all three lines stay consistent with it. */
  function deepContext(overview) {
    var context = {
      word: overview.word,
      language: overview.language,
      pos: overview.pos,
      quick_meaning: overview.quick_meaning,
      register: overview.register
    };
    return 'Headword: "' + overview.word + '"\n' +
      'Overview already produced for it (json): ' + JSON.stringify(context);
  }

  var LINE_BUILDERS = {
    etymology: function (outputLang) { return prompts.etymology(outputLang); },
    usage: function (outputLang) { return prompts.usage(outputLang); },
    distinction: function (outputLang) { return prompts.distinction(outputLang); }
  };

  var LINE_TOKENS = {
    etymology: function () { return CONFIG.maxTokens.etymology; },
    usage: function () { return CONFIG.maxTokens.usage; },
    distinction: function () { return CONFIG.maxTokens.distinction; }
  };

  /* ---------- Public API ---------- */

  function overview(options) {
    var key;
    try {
      key = requireKey(options.apiKey);
    } catch (err) {
      return Promise.reject(err);
    }
    var messages = [
      { role: 'system', content: prompts.overview(options.outputLang) },
      { role: 'user', content: 'Headword: "' + options.input + '"' }
    ];
    return request(key, basePayload(options.model, messages, CONFIG.maxTokens.overview)).then(extractJSON);
  }

  /* One deep line. line ∈ etymology | usage | distinction. */
  function deepLine(options) {
    var key;
    try {
      key = requireKey(options.apiKey);
    } catch (err) {
      return Promise.reject(err);
    }

    var build = LINE_BUILDERS[options.line];
    if (!build) return Promise.reject(new ApiError('server', 'Unknown deep line: ' + options.line));

    var messages = [
      { role: 'system', content: build(options.outputLang) },
      { role: 'user', content: deepContext(options.overview) }
    ];
    return request(key, basePayload(options.model, messages, LINE_TOKENS[options.line]()))
      .then(extractJSON);
  }

  /* All three deep lines in parallel, each settled independently so a single
     failure never rejects the batch. `onLine` fires as each one settles, which
     is what lets the entry page paint line by line instead of waiting for the
     slowest. Resolves with { line: {ok, data|error} } once all are done. */
  function deepLines(options, onLine) {
    var lines = CONFIG.deepLines.slice();
    return Promise.all(lines.map(function (line) {
      return deepLine({
        apiKey: options.apiKey,
        model: options.model,
        outputLang: options.outputLang,
        overview: options.overview,
        line: line
      }).then(function (data) {
        var result = { line: line, ok: true, data: data };
        if (typeof onLine === 'function') onLine(result);
        return result;
      }).catch(function (err) {
        var failure = {
          line: line,
          ok: false,
          error: isApiError(err)
            ? { kind: err.kind, message: err.message, detail: err.detail, raw: err.extra ? err.extra.raw : '' }
            : { kind: 'server', message: String(err && err.message ? err.message : err) }
        };
        if (typeof onLine === 'function') onLine(failure);
        return failure;
      });
    })).then(function (results) {
      var byLine = {};
      results.forEach(function (result) { byLine[result.line] = result; });
      return byLine;
    });
  }

  function candidates(options) {
    var key;
    try {
      key = requireKey(options.apiKey);
    } catch (err) {
      return Promise.reject(err);
    }
    var messages = [
      { role: 'system', content: prompts.candidate(options.outputLang) },
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
    try {
      key = requireKey(options.apiKey);
    } catch (err) {
      return Promise.reject(err);
    }
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

  ns.api = {
    ApiError: ApiError,
    isApiError: isApiError,
    overview: overview,
    deepLine: deepLine,
    deepLines: deepLines,
    candidates: candidates,
    testConnection: testConnection,
    errorText: ERROR_TEXT
  };
})(window.RADICLE);
