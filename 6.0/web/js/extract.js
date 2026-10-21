/* LINGUIST — getting text out of a file.

   Reading a file is the one place where the app touches formats it does not
   control, so the work is split in two: everything that can be decided from a
   string is a pure function here (and is tested without a browser), and only
   the two readers that need a File — plain text and PDF — touch the DOM.

   PDF text extraction is done by pdf.js, vendored under vendor/pdfjs. The
   module never assumes it is loaded: an environment that cannot run the worker
   falls back to a clear message rather than an empty page. */

window.LINGUIST = window.LINGUIST || {};

(function (ns) {
  'use strict';

  /* Extension -> how to read it. `text` is read as UTF-8 and cleaned by the
     stripper below; `pdf` goes through pdf.js. */
  var READERS = {
    txt: 'text', text: 'text', md: 'text', markdown: 'text', csv: 'text', tsv: 'text',
    json: 'text', log: 'text', ini: 'text', yaml: 'text', yml: 'text',
    html: 'html', htm: 'html', xhtml: 'html',
    srt: 'subtitle', vtt: 'subtitle', ass: 'subtitle', ssa: 'subtitle',
    pdf: 'pdf',
    docx: 'docx',
    /* Legacy Word files are binary, not zipped XML. Naming them here means the
       reader gets "save it as .docx" instead of the generic list of types. */
    doc: 'legacy'
  };

  /* What the picker offers. Kept in one place so the accept attribute, the
     rejection message and the tests cannot disagree. */
  var ACCEPT = '.txt,.text,.md,.markdown,.csv,.tsv,.json,.log,.ini,.yaml,.yml,' +
    '.html,.htm,.xhtml,.srt,.vtt,.ass,.ssa,.pdf,.docx';

  /* A docx is a zip; past a few megabytes it is a picture book, not a text, and
     unpacking it in the tab would cost more than it returns. */
  var MAX_DOCX_BYTES = 10 * 1024 * 1024;

  function extensionOf(name) {
    var match = /\.([a-z0-9]+)$/i.exec(String(name || '').trim());
    return match ? match[1].toLowerCase() : '';
  }

  function readerFor(name) { return READERS[extensionOf(name)] || ''; }
  function isSupported(name) { return !!readerFor(name); }
  function isPdf(name) { return readerFor(name) === 'pdf'; }

  /* ---------- Pure text cleaning ---------- */

  var ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    mdash: '—', ndash: '–', hellip: '…', laquo: '«', raquo: '»', deg: '°'
  };

  function decodeEntities(text) {
    return String(text || '').replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (whole, body) {
      if (body.charAt(0) === '#') {
        var code = body.charAt(1) === 'x' || body.charAt(1) === 'X'
          ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
        return isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
      }
      var key = body.toLowerCase();
      return Object.prototype.hasOwnProperty.call(ENTITIES, key) ? ENTITIES[key] : whole;
    });
  }

  /* Keeps the text and drops the machinery. Block elements become newlines so
     paragraphs survive; script, style and comments leave nothing behind. */
  function stripHtml(html) {
    var text = String(html || '');
    text = text.replace(/<!--[\s\S]*?-->/g, ' ');
    text = text.replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1>/gi, ' ');
    text = text.replace(/<(br|hr)\s*\/?>/gi, '\n');
    text = text.replace(/<\/(p|div|section|article|header|footer|li|tr|h[1-6]|blockquote|pre)\s*>/gi, '\n\n');
    text = text.replace(/<[^>]+>/g, ' ');
    return normaliseText(decodeEntities(text));
  }

  /* Subtitle files carry timing and numbering on lines of their own. What is
     left after dropping those is the dialogue. */
  function stripSubtitle(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var kept = [];
    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) return;
      if (/^\d+$/.test(trimmed)) return;
      if (/^(WEBVTT|NOTE|STYLE|REGION)\b/i.test(trimmed)) return;
      if (trimmed.indexOf('-->') > -1) return;
      /* ASS/SSA dialogue lines. */
      if (/^Dialogue:/i.test(trimmed)) {
        var parts = trimmed.split(',');
        if (parts.length > 9) {
          kept.push(parts.slice(9).join(',').replace(/\{[^}]*\}/g, ' ').trim());
          return;
        }
      }
      kept.push(trimmed.replace(/\{[^}]*\}/g, ' '));
    });
    return normaliseText(kept.join('\n'));
  }

  /* Structure is kept, noise is not. Line breaks and blank lines survive
     exactly as they were — that is the file's shape, and the translation is
     asked to mirror it. Runs of spaces and tabs inside a line are collapsed to
     one space, because a PDF's per-word positioning otherwise arrives as a
     thicket of gaps; trailing spaces are dropped. */
  function normaliseText(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      /* Runs of spaces become one; tabs are left alone, because a tab in a
         docx is a column boundary rather than spacing. Only trailing spaces
         are dropped — leading ones are indentation and part of the shape. */
      .replace(/ +/g, ' ')
      .replace(/ +\n/g, '\n')
      .trim();
  }

  function clean(raw, name) {
    var reader = readerFor(name);
    if (reader === 'html') return stripHtml(raw);
    if (reader === 'subtitle') return stripSubtitle(raw);
    return normaliseText(String(raw || '').replace(/^\uFEFF/, ''));
  }

  /* ---------- Chunking ----------
     Split on blank lines first, then on single line breaks, then on sentence
     ends, and only then mid-word: a chunk that starts in the middle of a
     sentence translates as badly as it reads. The overlap walks whole blocks
     back, not characters, for the same reason. */

  function splitBlocks(text) {
    var blocks = String(text || '').split(/\n{2,}/);
    var out = [];
    blocks.forEach(function (block) {
      var trimmed = block.trim();
      if (!trimmed) return;
      if (trimmed.length <= 4000) { out.push(trimmed); return; }
      trimmed.split(/\n/).forEach(function (line) {
        var piece = line.trim();
        if (piece) out.push(piece);
      });
    });
    return out;
  }

  function hardSplit(block, size) {
    var pieces = [];
    var rest = block;
    while (rest.length > size) {
      var window = rest.slice(0, size);
      var cut = Math.max(
        window.lastIndexOf('。'), window.lastIndexOf('．'), window.lastIndexOf('！'), window.lastIndexOf('？'),
        window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '),
        window.lastIndexOf('; '), window.lastIndexOf(', '), window.lastIndexOf(' ')
      );
      if (cut < size * 0.4) cut = size - 1;
      pieces.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) pieces.push(rest);
    return pieces;
  }

  /* [{index, total, text}] — the shape the runner walks. */
  function planChunks(text, options) {
    var settings = options || {};
    var size = settings.size || ns.CONFIG.limits.document.chunk;
    var overlap = settings.overlap || ns.CONFIG.limits.document.overlap;
    var source = normaliseText(text);
    if (!source) return [];
    if (source.length <= settings.maxSingle || source.length <= size) {
      return [{ index: 1, total: 1, text: source }];
    }

    var blocks = splitBlocks(source);
    var chunks = [];
    var current = [];
    var length = 0;

    function flush() {
      if (!current.length) return;
      chunks.push(current.join('\n\n'));
      current = [];
      length = 0;
    }

    blocks.forEach(function (block) {
      var pieces = block.length > size ? hardSplit(block, size) : [block];
      pieces.forEach(function (piece) {
        if (length && length + piece.length + 2 > size) {
          var previous = current.slice();
          flush();
          /* Carry the tail of the part just closed into the next one, so a
             sentence split across the boundary is still seen whole. */
          var carried = 0;
          for (var i = previous.length - 1; i >= 0 && carried < overlap; i -= 1) {
            carried += previous[i].length;
            current.unshift(previous[i]);
            length += previous[i].length + 2;
          }
        }
        current.push(piece);
        length += piece.length + 2;
      });
    });
    flush();

    /* The last chunk is sometimes only the overlap; folding it into the one
       before keeps the count honest rather than adding a request for nothing. */
    if (chunks.length > 1) {
      var last = chunks[chunks.length - 1];
      if (last.length < size * 0.15) {
        chunks[chunks.length - 2] = chunks[chunks.length - 2] + '\n\n' + last;
        chunks.pop();
      }
    }
    return chunks.map(function (piece, i) {
      return { index: i + 1, total: chunks.length, text: piece };
    });
  }

  /* ---------- Reading ---------- */

  function pdfLib() {
    return typeof window !== 'undefined' ? window.pdfjsLib : null;
  }

  function pdfAvailable() {
    var lib = pdfLib();
    return !!(lib && typeof lib.getDocument === 'function');
  }

  /* Errors carry a code, not a sentence: the view decides how to say it, in the
     interface language. A module that inlined translated text would break the
     moment the reader switched language. */
  function failure(code, detail) {
    var error = new Error(detail || code);
    error.code = code;
    return error;
  }

  function readTextFile(file) {
    return new Promise(function (resolve, reject) {
      if (typeof FileReader !== 'function') {
        reject(failure('no_reader'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(failure('read_failed')); };
      reader.readAsText(file);
    });
  }

  /* pdf.js wants the worker; the site build loads it from vendor/pdfjs, and the
     offline single file carries the source in an inert script element instead
     (see tools/build.mjs), because a single file has no second file to point
     at — the source becomes a blob URL. */
  function carriedWorkerSource() {
    if (typeof document === 'undefined' || !document.getElementById) return '';
    var node = document.getElementById('pdf-worker-source');
    return node && node.textContent ? node.textContent : '';
  }

  function ensureWorker(lib) {
    if (!lib.GlobalWorkerOptions) return;
    if (lib.GlobalWorkerOptions.workerSrc || lib.GlobalWorkerOptions.workerPort) return;
    var source = carriedWorkerSource();
    if (source && typeof Blob === 'function' && typeof URL !== 'undefined' && URL.createObjectURL) {
      lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      return;
    }
    lib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
  }

  function readPdf(file, onProgress) {
    var lib = pdfLib();
    if (!lib || typeof lib.getDocument !== 'function') {
      return Promise.reject(failure('pdf_unavailable'));
    }
    ensureWorker(lib);
    return readArrayBuffer(file).then(function (buffer) {
      return lib.getDocument({ data: new Uint8Array(buffer) }).promise;
    }).catch(function (err) {
      /* pdf.js reports an encrypted file as a password exception; there is no
         password prompt in this app, so it is a plain refusal. */
      if (err && /password/i.test(String(err.name || err.message || ''))) throw failure('pdf_encrypted');
      if (err && err.code) throw err;
      throw failure('pdf_failed', err && err.message ? err.message : '');
    }).then(function (doc) {
      var pages = [];
      var total = doc.numPages;
      function step(number) {
        if (number > total) return Promise.resolve(pages);
        return doc.getPage(number).then(function (page) {
          return page.getTextContent();
        }).then(function (content) {
          pages.push(normaliseText(pageText(content.items)));
          if (typeof onProgress === 'function') onProgress(number, total);
          /* Yield, so a 300 page file does not freeze the tab while it works. */
          return new Promise(function (resolve) { window.setTimeout(resolve, 0); }).then(function () {
            return step(number + 1);
          });
        });
      }
      return step(1);
    }).then(function (pages) {
      var text = normaliseText(pages.join('\n\n'));
      return { text: text, pages: pages.length };
    });
  }

  /* pdf.js hands back one item per text run, each with its own position. Joining
     them with spaces — which is what this used to do — threw away every line
     break in the page, and with it the paragraph shape of the document. Items
     are grouped by their height on the page; a gap clearly larger than the usual
     leading becomes a blank line, i.e. a paragraph break. */
  function pageText(items) {
    var rows = [];
    (items || []).forEach(function (item) {
      if (!item || typeof item.str !== 'string' || !item.str) return;
      var y = item.transform && item.transform.length >= 6 ? Math.round(item.transform[5]) : 0;
      var row = rows[rows.length - 1];
      if (!row || Math.abs(row.y - y) > 2) rows.push({ y: y, parts: [item.str] });
      else row.parts.push(item.str);
    });
    if (!rows.length) return '';

    /* The *smallest* distances between lines, as the page's own line pitch: on a
       double-spaced page every gap is large, so a median would call a paragraph
       break ordinary leading and lose it. The lower quartile is the line
       spacing; anything well above it is a paragraph gap. */
    var gaps = [];
    for (var i = 1; i < rows.length; i += 1) gaps.push(Math.abs(rows[i].y - rows[i - 1].y));
    gaps = gaps.filter(function (gap) { return gap > 0; }).sort(function (a, b) { return a - b; });
    var typical = gaps.length ? gaps[Math.floor(gaps.length * 0.25)] : 0;

    var out = '';
    rows.forEach(function (row, index) {
      if (index) {
        var gap = Math.abs(rows[index - 1].y - row.y);
        out += typical && gap > typical * 1.6 ? '\n\n' : '\n';
      }
      out += row.parts.join(' ').replace(/\s+/g, ' ').trim();
    });
    return out;
  }

  function readArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      if (typeof FileReader !== 'function') {
        reject(failure('no_reader'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(failure('read_failed')); };
      reader.readAsArrayBuffer(file);
    });
  }

  /* ---------- DOCX ----------
     A .docx is a zip holding word/document.xml. Only two pieces of the format
     matter here: the central directory (where is that file) and the two ways a
     member can be stored (0 = as-is, 8 = raw deflate). No library: the browser
     already knows how to inflate. */

  function zipEntry(buffer, wanted) {
    var view = new DataView(buffer);
    var length = buffer.byteLength;
    /* End of central directory: scan back over at most 64 KB of comment. */
    var floor = Math.max(0, length - 65558);
    var eocd = -1;
    for (var at = length - 22; at >= floor; at -= 1) {
      if (view.getUint32(at, true) === 0x06054b50) { eocd = at; break; }
    }
    if (eocd < 0) throw failure('docx_failed');

    var count = view.getUint16(eocd + 10, true);
    var cursor = view.getUint32(eocd + 16, true);
    var decoder = new TextDecoder('utf-8');
    for (var i = 0; i < count; i += 1) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw failure('docx_failed');
      var method = view.getUint16(cursor + 10, true);
      var compressed = view.getUint32(cursor + 20, true);
      var nameLength = view.getUint16(cursor + 28, true);
      var extraLength = view.getUint16(cursor + 30, true);
      var commentLength = view.getUint16(cursor + 32, true);
      var localAt = view.getUint32(cursor + 42, true);
      var name = decoder.decode(new Uint8Array(buffer, cursor + 46, nameLength));
      if (name === wanted) {
        var localName = view.getUint16(localAt + 26, true);
        var localExtra = view.getUint16(localAt + 28, true);
        return { method: method, start: localAt + 30 + localName + localExtra, length: compressed };
      }
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return null;
  }

  /* Raw deflate through the platform. Reading the stream by hand keeps this
     free of Response/Blob, which also means the same code runs in the tests. */
  function inflateRaw(bytes) {
    if (typeof DecompressionStream !== 'function' || typeof ReadableStream !== 'function') {
      return Promise.reject(failure('docx_unavailable'));
    }
    var source = new ReadableStream({
      start: function (controller) {
        controller.enqueue(bytes);
        controller.close();
      }
    });
    var reader = source.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    var parts = [];
    function pump() {
      return reader.read().then(function (chunk) {
        if (chunk.done) {
          var total = parts.reduce(function (n, part) { return n + part.length; }, 0);
          var out = new Uint8Array(total);
          var at = 0;
          parts.forEach(function (part) { out.set(part, at); at += part.length; });
          return out.buffer;
        }
        parts.push(chunk.value);
        return pump();
      });
    }
    return pump();
  }

  /* Paragraphs and line breaks are the document's shape, so they are the two
     things kept: </w:p> becomes a paragraph break, <w:br/> a line break, and a
     tab stays a tab. Everything else is markup. */
  function docxXmlToText(xml) {
    var text = String(xml || '');
    text = text.replace(/<w:instrText\b[\s\S]*?<\/w:instrText>/g, '');
    text = text.replace(/<w:delText\b[\s\S]*?<\/w:delText>/g, '');
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    text = text.replace(/<w:tab\b[^>]*\/>/g, '\t');
    text = text.replace(/<w:(br|cr)\b[^>]*\/>/g, '\n');
    text = text.replace(/<\/w:p>/g, '\n\n');
    text = text.replace(/<[^>]+>/g, '');
    return normaliseText(decodeEntities(text));
  }

  function readDocx(file) {
    if (!file || !file.size || file.size > MAX_DOCX_BYTES) {
      return Promise.reject(failure('docx_too_large', String(file && file.size)));
    }
    return readArrayBuffer(file).then(function (buffer) {
      var entry = zipEntry(buffer, 'word/document.xml');
      if (!entry) throw failure('docx_failed');
      var bytes = new Uint8Array(buffer, entry.start, entry.length);
      if (entry.method === 0) {
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      }
      if (entry.method === 8) return inflateRaw(bytes);
      throw failure('docx_failed');
    }).then(function (xmlBuffer) {
      var xml = new TextDecoder('utf-8').decode(new Uint8Array(xmlBuffer));
      return { text: docxXmlToText(xml), kind: 'docx' };
    });
  }

  /* The reader a file's name asks for. Returns { text, kind, scanned? }. */
  function extract(file, onProgress) {
    var name = file && file.name ? file.name : '';
    var reader = readerFor(name);
    /* `.doc` has a reader entry only so it can be refused by name. */
    if (reader === 'legacy') return Promise.reject(failure('legacy_doc'));
    if (!reader) {
      return Promise.reject(failure('unsupported'));
    }
    if (reader === 'docx') return readDocx(file);
    if (reader === 'pdf') {
      return readPdf(file, onProgress).then(function (result) {
        return { text: result.text, kind: 'pdf', pages: result.pages };
      });
    }
    return readTextFile(file).then(function (raw) {
      return { text: clean(raw, name), kind: reader };
    });
  }

  ns.extract = {
    ACCEPT: ACCEPT,
    READERS: READERS,
    extensionOf: extensionOf,
    readerFor: readerFor,
    isSupported: isSupported,
    isPdf: isPdf,
    pdfAvailable: pdfAvailable,
    carriedWorkerSource: carriedWorkerSource,
    decodeEntities: decodeEntities,
    stripHtml: stripHtml,
    stripSubtitle: stripSubtitle,
    normaliseText: normaliseText,
    pageText: pageText,
    clean: clean,
    splitBlocks: splitBlocks,
    hardSplit: hardSplit,
    planChunks: planChunks,
    extract: extract,
    readTextFile: readTextFile,
    readPdf: readPdf,
    readDocx: readDocx,
    docxXmlToText: docxXmlToText,
    zipEntry: zipEntry,
    MAX_DOCX_BYTES: MAX_DOCX_BYTES
  };
})(window.LINGUIST);
