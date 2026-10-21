/* RADICLE — DeepSeek client and prompt construction.

   Two-stage lookup:
     stage 1  overview  — IPA, part of speech, one-line gist  (fast, non-thinking)
     stage 2  deep      — senses, collocations, etymology, morphology, culture
   plus a candidate stage used when the user types non-Latin script.

   The API is OpenAI-compatible; JSON output requires response_format
   {"type":"json_object"} *and* the word "json" plus a shape example in the
   prompt, otherwise the model can stall on whitespace. */

window.RADICLE = window.RADICLE || {};

(function (ns) {
  'use strict';

  var CONFIG = ns.CONFIG;

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

  /* ---------- Prompt helpers ---------- */

  var OUTPUT_LANG_NAME = { zh: 'Simplified Chinese', en: 'English', fr: 'French' };

  function langName(id) {
    return OUTPUT_LANG_NAME[id] || OUTPUT_LANG_NAME.zh;
  }

  /* Chinese is dense, so the byte budget differs per output language. */
  function budget(outputLang, forChinese, otherwise) {
    return outputLang === 'zh' ? forChinese : otherwise;
  }

  var OVERVIEW_PROMPT = [
    'You are {APP}, a precise lexicographer writing for an advanced learner of English and French.',
    'You receive ONE headword or fixed expression. Produce a fast, reliable overview of it.',
    '',
    'Respond with a single valid json object and nothing else — no markdown fence, no commentary.',
    'Shape:',
    '{"status":"ok","word":"ephemeral","language":"en","ipa":"/ɪˈfem(ə)rəl/","pos":"adj.",',
    ' "quick_meaning":"Lasting for a very short time.","register":"formal",',
    ' "tags":["time","transience"],"suggestions":[]}',
    '',
    'Field rules:',
    '- status: "ok", or "not_found" when the query is not a real English or French word or fixed expression.',
    '- word: the canonical modern headword, lower case unless it is a proper noun.',
    '- language: "en" for English, "fr" for French.',
    '- ipa: International Phonetic Alphabet transcription wrapped in slashes. Use "" when unknown.',
    '- pos: the single most common part of speech, abbreviated (n., v., adj., adv., prep., conj., phr.).',
    '- quick_meaning: ONE sentence. Never longer than {QUICK_LIMIT}.',
    '- register: exactly one of neutral, formal, informal, literary, archaic, slang, technical.',
    '- tags: 2 to 4 very short semantic-field labels.',
    '- suggestions: when status is "not_found", up to 3 close valid headwords as a json array; otherwise [].',
    '',
    'Language rules:',
    '- Write quick_meaning and tags in {LANG}. Other fields stay in their natural form.',
    '- Never translate or transliterate the headword itself.',
    '- Do not mention etymology, word roots or cultural history in this response — a later request covers that.',
    '',
    'Accuracy rules:',
    '- If you are unsure the word exists, use "not_found" instead of inventing a definition.',
    '- Output json only.'
  ].join('\n');

  var DEEP_PROMPT = [
    'You are {APP}: a historical lexicographer, etymologist and language historian.',
    'You receive ONE headword plus a short overview that was already produced for it.',
    'Produce the deep analysis a linguist would give a serious learner.',
    '',
    'Respond with a single valid json object and nothing else — no markdown fence, no commentary.',
    'Shape:',
    '{"senses":[{"pos":"adj.","definition":"...","examples":[{"text":"...","translation":"..."}]}],',
    ' "collocations":[{"phrase":"...","meaning":"..."}],',
    ' "usage_notes":["..."],',
    ' "etymology":{"origin_chain":["Proto-Indo-European *...","Latin ...","Old French ...","Modern French ..."],',
    '   "root_form":"...","first_attested":"...","story":"...","certainty":"high"},',
    ' "morphology":{"prefixes":[{"form":"...","meaning":"...","origin":"..."}],',
    '   "roots":[{"form":"...","meaning":"...","origin":"..."}],',
    '   "suffixes":[{"form":"...","meaning":"...","origin":"..."}]},',
    ' "cognates":[{"word":"...","language":"...","relation":"..."}],',
    ' "cultural_notes":["..."],',
    ' "confusables":[{"word":"...","distinction":"..."}],',
    ' "mnemonic":"..."}',
    '',
    'Content rules:',
    '- senses: at most 4, most common first. definition at most {DEF_LIMIT}.',
    '  Each sense has 1 or 2 real examples: text in the headword\'s own language, translation in {LANG}.',
    '- collocations: 3 to 6 high-frequency patterns with a short meaning each.',
    '- usage_notes: 1 to 4 items on register, grammar behaviour, typical mistakes or regional variation.',
    '- etymology.origin_chain: chronological, oldest known ancestor first, ending at the modern form.',
    '  Keep the chain SHORT and only include stages you are confident about. An empty array is better than a guess.',
    '- etymology.root_form: the reconstructed or attested base form, or "" when unknown.',
    '- etymology.first_attested: for example "first attested c. 1380". Use "unknown" rather than inventing a date.',
    '- etymology.story: how the meaning shifted over time, at most {STORY_LIMIT}.',
    '- etymology.certainty: exactly one of high, medium, low — your confidence in the chain above.',
    '- morphology: split the headword into prefixes, roots and suffixes, each with form, meaning and origin',
    '  (for example Latin, Greek, Old French). Use empty arrays for parts that do not apply.',
    '- cognates: 3 to 6 words in other languages that share the same ancestor, with the relation.',
    '- cultural_notes: at most 3 items, each at most {CULT_LIMIT}, on literary, historical or social connotations.',
    '- confusables: at most 4 easily confused words with a one-line distinction.',
    '- mnemonic: one memorable hook, at most {MNEM_LIMIT}.',
    '',
    'Honesty rules:',
    '- Never invent an etymology, a date or a source. Popular-but-false etymologies must be avoided.',
    '- When scholars disagree or you are unsure, say so inside the relevant field instead of guessing.',
    '- Write every natural-language value in {LANG}; keep headwords, cognates and root forms in their own language.',
    '- Output json only.'
  ].join('\n');

  var CANDIDATE_PROMPT = [
    'You are {APP}, a bilingual lexicographer helping someone find the English or French word behind a concept.',
    'The user typed something that is NOT written in the Latin alphabet.',
    '',
    'Respond with a single valid json object and nothing else — no markdown fence, no commentary.',
    'Shape: {"status":"ok","candidates":[{"word":"nostalgia","language":"en","gloss":"...","why":"..."}]}',
    '',
    'Rules:',
    '- Return 3 or 4 candidates, ordered by how likely they are to be the word the user has in mind.',
    '- Every candidate is a real, current English or French headword.',
    '- language: "en" or "fr".',
    '- gloss: a short gloss in {LANG}. why: one short clause in {LANG} explaining the fit.',
    '- If nothing plausible exists, return {"status":"not_found","candidates":[]}.',
    '- Output json only.'
  ].join('\n');

  function fill(template, vars) {
    return template.replace(/\{(\w+)\}/g, function (whole, key) {
      return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole;
    });
  }

  function overviewPrompt(outputLang) {
    return fill(OVERVIEW_PROMPT, {
      APP: CONFIG.appName,
      LANG: langName(outputLang),
      QUICK_LIMIT: outputLang === 'zh' ? '40 characters' : '100 characters'
    });
  }

  function deepPrompt(outputLang) {
    return fill(DEEP_PROMPT, {
      APP: CONFIG.appName,
      LANG: langName(outputLang),
      DEF_LIMIT: budget(outputLang, '60 characters', '140 characters'),
      STORY_LIMIT: budget(outputLang, '180 characters', '420 characters'),
      CULT_LIMIT: budget(outputLang, '80 characters', '180 characters'),
      MNEM_LIMIT: budget(outputLang, '60 characters', '140 characters')
    });
  }

  function candidatePrompt(outputLang) {
    return fill(CANDIDATE_PROMPT, { APP: CONFIG.appName, LANG: langName(outputLang) });
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

  function basePayload(model, thinking, messages, maxTokens) {
    var payload = {
      model: model,
      messages: messages,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      /* Thinking mode ignores temperature, so only send it when disabled. */
      thinking: { type: thinking ? 'enabled' : 'disabled' }
    };
    if (thinking) {
      payload.reasoning_effort = 'high';
    } else {
      payload.temperature = 0.3;
    }
    return payload;
  }

  /* ---------- Public API ---------- */

  function requireKey(apiKey) {
    if (!apiKey || !String(apiKey).trim()) throw new ApiError('no_key', 'settings.apiKey is empty');
    return String(apiKey).trim();
  }

  function overview(options) {
    var key;
    try {
      key = requireKey(options.apiKey);
    } catch (err) {
      return Promise.reject(err);
    }
    var messages = [
      { role: 'system', content: overviewPrompt(options.outputLang) },
      { role: 'user', content: 'Headword: "' + options.input + '"' }
    ];
    return request(key, basePayload(options.model, false, messages, 700)).then(extractJSON);
  }

  function deep(options) {
    var key;
    try {
      key = requireKey(options.apiKey);
    } catch (err) {
      return Promise.reject(err);
    }
    var context = {
      word: options.overview.word,
      language: options.overview.language,
      pos: options.overview.pos,
      quick_meaning: options.overview.quick_meaning,
      register: options.overview.register
    };
    var messages = [
      { role: 'system', content: deepPrompt(options.outputLang) },
      {
        role: 'user',
        content: 'Headword: "' + options.overview.word + '"\n' +
          'Overview already produced for it (json): ' + JSON.stringify(context)
      }
    ];
    return request(key, basePayload(options.model, !!options.thinking, messages, 4000)).then(extractJSON);
  }

  function candidates(options) {
    var key;
    try {
      key = requireKey(options.apiKey);
    } catch (err) {
      return Promise.reject(err);
    }
    var messages = [
      { role: 'system', content: candidatePrompt(options.outputLang) },
      { role: 'user', content: 'The user typed: "' + options.input + '"' }
    ];
    return request(key, basePayload(options.model, false, messages, 900)).then(extractJSON).then(function (data) {
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
    deep: deep,
    candidates: candidates,
    testConnection: testConnection,
    errorText: ERROR_TEXT
  };
})(window.RADICLE);
