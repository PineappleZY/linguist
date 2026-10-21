# Radicle — web app (phase 1)

A zero-backend static dictionary. No build step, no bundler, no server: the
browser talks to `api.deepseek.com` directly using your own API key, because
DeepSeek's API echoes the request `Origin` and therefore allows cross-origin
calls from a page.

## Run it

```powershell
# from the repository root
python -m http.server 5173 --directory web
# then open http://127.0.0.1:5173
```

Double-clicking `index.html` also works in Chrome: DeepSeek answers a `file://`
origin (reported as `null`) with `Access-Control-Allow-Origin: null`, which the
browser accepts. A local server is still recommended so that modules, the file
picker and clipboard-adjacent APIs behave identically to production.

## First use

1. Open **Profile**.
2. Paste a DeepSeek key (`sk-...`) and press **Save key**. **Test connection**
   verifies it with a single cheap request.
3. Go back to **Dictionary** and look a word up.

Nothing works until a key is present — that is deliberate, and the empty state
says so.

## Package and share

`web/` is a plain static site, but it is not the thing you publish: it carries
the test suite and this README. Run the packaging step instead.

```powershell
node tools/build.mjs
```

That produces two artefacts, and asserts on both before exiting:

| Output | What it is |
| --- | --- |
| `dist/site/` | The deployable PWA folder. Allowlisted contents only — no tests, no docs. Upload this folder. |
| `dist/radicle-offline.html` | One self-contained file. Double-click it and the whole app runs, no server involved. |

### Hosting it online

Upload `dist/site/` to a static host and share the resulting HTTPS address.
[EdgeOne Pages](https://pages.edgeone.ai/) (Tencent) is the recommended target
for a mainly-mainland audience: free, automatic HTTPS, global edge delivery, and
its default domain needs no ICP filing. The app also works unchanged on
Cloudflare Pages, Vercel, Netlify or GitHub Pages — those are just less
reliable to reach from mainland China.

No rewrite or 404 rules are needed: every route is `/index.html#/...`.

### Installing it as an app

Because the site ships a manifest and a service worker, visitors can install it:

- **Chrome / Edge** — an install icon appears in the address bar, and
  Profile → Account also offers an **Install** button.
- **iOS Safari** — Share → Add to Home Screen (iOS exposes no install API, so
  Profile just shows the instructions).

The two honest caveats: installing caches only the **app shell**, so looking a
word up still needs a network connection to DeepSeek; and installed or not,
everyone's key and history live on their own device.

### Offline single file

`dist/radicle-offline.html` is for handing the app to someone directly — email
it, put it on a USB stick, whatever. Stylesheets and all nine modules are inlined
in original load order, and the service worker bootstrap is stripped, because
`file://` has no secure context and registration could only fail.

### Releasing an update

1. Edit the source in `web/`.
2. **Bump `CACHE_VERSION` in `web/sw.js`.** Without this, installed clients keep
   serving the old shell from Cache Storage — there is no server-side
   invalidation.
3. `node tools/build.mjs`
4. Re-upload `dist/site/`, and re-send `dist/radicle-offline.html` if you
   handed it out.

## What lives where

| Path | Purpose |
| --- | --- |
| `index.html` | Shell: top bar, screen container, tab bar |
| `manifest.webmanifest` | Install metadata: name, icons, standalone display |
| `sw.js` | Service worker. Caches the shell only — never the API |
| `icons/` | 192 / 512 / maskable / apple-touch icons |
| `assets/tokens.css` | Colour, type, radius, spacing, motion — ported 1:1 to WXSS in phase 2 |
| `assets/app.css` | Layout and components |
| `js/config.js` | Product name, models, output languages, limits, shared session state |
| `js/store.js` | localStorage: settings, history index, per-entry payloads, backup/restore |
| `js/api.js` | Prompts and the DeepSeek client (two-stage lookup, candidate lookup) |
| `js/ui.js` | Escaping, icon set, formatting, markup helpers |
| `js/speech.js` | Pronunciation via the platform speech synthesiser |
| `js/pwa.js` | Service worker registration and install-prompt state |
| `js/view-*.js` | One module per screen |
| `js/app.js` | Hash router, top bar, tab bar, theme, bootstrap |

## Request shape

Two requests per lookup:

1. **Overview** — `thinking` disabled, `temperature: 0.3`, `max_tokens: 700`.
   Returns IPA, part of speech, a one-line gist.
2. **Deep** — `max_tokens: 4000`. Returns senses, collocations, usage, etymology,
   morphology, cognates, culture, confusables and a mnemonic.

Both set `response_format: {"type":"json_object"}`; the prompts also contain the
word "json" and a shape example, which JSON mode requires to avoid a stalled
generation. Thinking mode is off by default because it ignores `temperature` and
is markedly slower; **Profile → Extended thinking** turns it on for the deep
pass only, and then sends `reasoning_effort: "high"` instead of a temperature.

## Stored data

| Key | Contents |
| --- | --- |
| `dict.settings` | API key, output language, model, theme, thinking flag |
| `dict.history` | Index rows (id, word, timestamp, star, summary) |
| `dict.entry.<id>` | One full analysis payload per headword |

History holds 500 entries; when it overflows the oldest **unstarred** row is
evicted. Starred entries are never removed automatically. Exports never include
the API key.

## Tests

```powershell
node web/tests/smoke.js
```

138 assertions run the app in stubbed browser and service worker scopes:
history eviction, backup round-tripping, the exact request body, JSON recovery
from markdown fences and prose, the full error matrix, 429 retry, the render
layer including HTML escaping of model output, install-state transitions, and
the distribution artefacts (it runs the packaging step itself and then checks
the output).

The service worker test is the one that matters most for safety: it drives the
worker's `fetch` handler with a synthetic `api.deepseek.com` call carrying an
`Authorization` header and asserts that not a single cache read or write
occurs. That is the guard that keeps users' API keys out of Cache Storage.
