# Radicle 2.1 — web app

A zero-backend static dictionary. No build step, no bundler, no server: the
browser talks to `api.deepseek.com` directly using your own API key, because
DeepSeek's API echoes the request `Origin` and therefore allows cross-origin
calls from a page.

## What 2.1 changed

- **Card order is now meaning-first**, driven by `CONFIG.cardOrder`: Senses →
  Collocations → Usage → Confusables → Semantic core → Etymology → Morphology →
  Root family → False cognates → Culture → Synthesis → Mnemonic. Because that
  order interleaves the three lines, cards are placed **by order** with the
  still-loading ones showing titled skeletons in their own slots, rather than
  each line rendering as one contiguous block.
- **Spelling practice follows the All / Starred filter**, and the button label
  says which source it will draw from.
- **`timeoutMs` is now 60s**, down from 180s, after a real call showed the
  slowest line at 5.3s. `maxTokens` is unchanged: it is only a ceiling.
- **Two prompt floors added** after the same call showed two fields coming back
  thin: `form_note` is now required whenever a part has a spelling variant, and
  definitions may not be bare synonym lists.

## What 2.0 adds over 1.0

- **A fuller, more structured entry.** Word-root family (direct derivatives plus
  words sharing the root), false-cognate warnings, pronunciation of derivatives,
  a comparison table with parallel examples, a one-line semantic core and a
  closing synthesis. Etymology is now a **vertical timeline** plus a
  **morphology formula**, not a row of chips followed by prose.
- **Collapsible cards.** Every deep card collapses from its header, with a
  `Collapse all / Expand all` control above them. Expansion survives re-renders.
- **Spelling practice.** A full-screen frosted layer with three round buttons,
  judged on submit.

The `2.0/` folder is **storage-isolated** from `1.0/`: it writes to `dict2.*` and
never reads or writes 1.0's `dict.*`, so both can be open in the same browser.
(The folder keeps its `2.0` name through a deliberate in-place iteration —
`CONFIG.version` is the authority on which version you are looking at.)

## Run it

```powershell
# from the 2.0 folder
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
| `js/prompts.js` | Every prompt the app sends, in one file |
| `js/store.js` | localStorage: settings, history index, per-entry payloads, backup/restore |
| `js/api.js` | DeepSeek client: overview, the three deep lines, candidate lookup |
| `js/ui.js` | Escaping, icon set, formatting, markup helpers |
| `js/speech.js` | Pronunciation via the platform speech synthesiser |
| `js/spell.js` | Spelling exercise: pure state machine plus its DOM layer |
| `js/pwa.js` | Service worker registration and install-prompt state |
| `js/view-*.js` | One module per screen |
| `js/app.js` | Hash router, top bar, tab bar, theme, bootstrap |

## Request shape

Four requests per lookup:

1. **Overview** — IPA, part of speech, a one-line gist. Fast, and the first thing
   on screen.
2. **Three deep lines, fired in parallel.** `etymology` (semantic core, timeline,
   morphology, root family, false cognates), `usage` (senses, collocations,
   usage notes) and `distinction` (comparison table, culture, synthesis,
   mnemonic). Each owns a block of cards and repaints as it lands, so a slow
   line never holds up the others and a failed line can be retried alone.

A full entry runs to roughly 3000 Chinese characters. Split three ways, the
first block paints while the rest are still generating. Measured on a real
lookup: overview 1.0s, the three deep lines in parallel 5.3s, the whole set 6.4s.

Both set `response_format: {"type":"json_object"}`; the prompts also contain the
word "json" and a shape example, which JSON mode requires to avoid a stalled
generation. Thinking mode is off by default because it ignores `temperature` and
is markedly slower; these are structured extraction tasks, not reasoning
problems. Per-request token ceilings live in `CONFIG.maxTokens` and were chosen
generously so a long entry is never cut mid-JSON. A real call used about 1000
tokens on the longest line against a 3200 ceiling and returned `finish_reason:
stop` everywhere, so the headroom is doing its job rather than papering over a
too-small cap.

## Spelling practice

Opened from the word page header (single word) or **Spelling practice** on the
dictionary screen, which draws a five-word round from starred entries first and
history second.

The exercise is a plain object driven by pure functions
(`createExercise / applyInput / applySubmit / applyHint`), so the whole state
machine is testable without a browser. Judging happens **on submit**: typed
letters stay neutral until ✓ is pressed, then correct positions turn green and
wrong ones red, with the correct spelling revealed underneath. Accents are
judged loosely (`é` ≡ `e`); the revealed answer still shows the real spelling.
Spelling is only offered for plain single words — multi-word expressions and
hyphenated forms disable the button.

## Stored data

| Key | Contents |
| --- | --- |
| `dict2.settings` | API key, output language, model, theme |
| `dict2.history` | Index rows (id, word, timestamp, star, summary) |
| `dict2.entry.<id>` | One full analysis payload per headword |

History holds 500 entries; when it overflows the oldest **unstarred** row is
evicted. Starred entries are never removed automatically. Exports never include
the API key. Every payload carries `schema: 2`; the `dict2.` prefix is what keeps
2.0 clear of 1.0's data.

## Tests

```powershell
node web/tests/smoke.js
```

221 assertions run the app in stubbed browser and service worker scopes:
history eviction and backup round-tripping, **storage isolation from 1.0**, the
prompt library's caps and honesty rules, the exact request body for each of the
four requests, JSON recovery from markdown fences and prose, the full error
matrix, 429 retry, **parallel deep lines where one line fails without taking the
others down**, **cross-line interleaving** (a real lookup driven with manually
released promises, to prove skeletons hold their slots, a failed line reports
once at its first card, and a retry refetches only that line), the spelling state
machine and its judgement edge cases (accents, repeated letters, short answers),
the practice pool following the All / Starred filter, the render layer including
exact card order, collapse state and HTML escaping of model output,
install-state transitions, and the distribution artefacts (it runs the packaging
step itself and then checks the output).

The service worker test is the one that matters most for safety: it drives the
worker's `fetch` handler with a synthetic `api.deepseek.com` call carrying an
`Authorization` header and asserts that not a single cache read or write
occurs. That is the guard that keeps users' API keys out of Cache Storage.
