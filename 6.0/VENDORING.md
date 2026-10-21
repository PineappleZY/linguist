# Vendored code

The published site (`dist/site`) is a copy of `web/`, and `web/vendor/` is the
one place third-party code is allowed to live. Everything else in the project is
written here.
Vendored, not linked. `pdf.min.js` and `pdf.worker.min.js` come from
`pdfjs-dist@3.11.174`, **legacy** build (the ES5 one), taken from the npm
tarball:

```
npm pack pdfjs-dist@3.11.174
tar -xzf pdfjs-dist-3.11.174.tgz package/legacy/build/pdf.min.js package/legacy/build/pdf.worker.min.js package/LICENSE
```

Why this version, and why the legacy build:

- **3.11.174 is the last release that ships a UMD bundle.** The app is plain
  classic scripts with no bundler and no build step; pdf.js 4 and later ship
  ESM only, which cannot be loaded that way without adding the build step the
  project deliberately does not have.
- **Legacy, not modern.** The modern build assumes a recent enough engine that
  the Android WebView of an older phone fails on it, and File mode is the one
  feature a phone is most likely to be used for.
- **Local, not from a CDN.** Reading a PDF has to work with no network beyond
  the DeepSeek call, and the eventual desktop shell loads this folder from
  disk. A remote script tag would break both.

Upgrading means re-running the commands above, replacing both files, and
checking that `web/js/extract.js` still finds `pdfjsLib` on `window` — the
`pdf.worker.min.js` source is inlined into the offline single file by
`tools/build.mjs`, which will fail loudly if the file is missing.

Licence: Apache-2.0; see `LICENSE` in this folder.

