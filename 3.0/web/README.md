# Radicle 3.0.1 — web app

## What 3.0.1 fixed

- **The selected segment was invisible in dark mode.** It used `--card`
  (`#1C1C1E`) against a track that resolves to roughly `#1D1D1F` — the same
  colour. Selected surfaces now come from `--segment-selected` / `--segment-ring`
  (`#FFFFFF` on light, `#2C2C2E` on dark), drawn with an inset ring so switching
  does not resize the box. The accent chip got the same treatment, since it
  carries the same "this one is selected" meaning on the explanation-language
  picker and the wordbook toggles.
- **Sentence mode no longer counts words.** It required two, and `words()`
  splits on spaces — so every Chinese sentence counted as one word and was
  rejected. Only the length bounds remain; a single word is accepted too.
- **Ambiguous accented words now ask before looking up.** The old branch skipped
  the choice whenever the typed form was itself a valid word, so `cote` against
  `côte` / `côté` never offered a choice. The test is now *how many readings
  exist*: no candidates, or a single candidate that is the input, looks up
  directly; anything else shows the panel, with the as-typed form forced to the
  front and labelled `you typed this`.
- **Duplicate entry points removed.** The top-bar profile icon and the
  Favourites button under the search field are gone; both are bottom tabs. The
  contextual "Open Profile" inside a missing-key notice stays — that is a nudge,
  not navigation.

A zero-backend static dictionary. No build step, no bundler, no server: the
browser talks to `api.deepseek.com` directly using your own API key, because
DeepSeek's API echoes the request `Origin` and therefore allows cross-origin
calls from a page.

## What 3.0 changed

- **Five languages.** English, French, German, Japanese and Chinese, chosen by
  the picker next to the search box (default `Auto`). The source language is now
  part of the entry id — without it German `Gift` and English `gift`, `Rat`/`rat`
  and `Bald`/`bald` would share a key and overwrite each other.
- **A card set per language.** Cards are declared once in `CONFIG.cardCatalog`
  with the line that produces them, and a language only fills the ones it has
  data for; anything empty is simply not rendered. French verbs get
  `Conjugation`, German nouns get `Article and plural`, Japanese switches between
  reading/kanji/stratum cards by word type, Chinese switches between
  character-history and word-formation cards by word length. CJK titles carry a
  native gloss (`Word stratum · 語種`) because the English rendering alone is
  less recognisable than the term used in teaching materials.
- **Favourites became its own screen** with a third tab. Grouped by language,
  with named wordbooks that can span languages and that a word may belong to
  several of. History stayed on the dictionary screen.
- **One practice entry point**, pencil icon, drawing on whichever source the
  selector above the list shows. Four input forms behind it: spelling for Latin
  scripts, pinyin for Chinese, kana/katakana for Japanese.
- **Sentence analysis** alongside word lookup, two lines in parallel, with the
  grammar card classified per language.
- **Explanations default to English** and can be written in any of the five
  languages. The interface itself is always English.

Older versions are frozen and storage-isolated: `dict.*`, `dict2.*`, `dict3.*`,
so all three can be open in the same browser without touching each other.

## Run it

```powershell
# from the 3.0 folder
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

`dist/radicle_<version>.html` — currently `radicle_3.0.1.html` — is for handing
the app to someone directly: email it, put it on a USB stick, whatever. The name
carries the version so a folder of them stays readable. Stylesheets and every
module are inlined in original load order, and the service worker bootstrap is
stripped, because `file://` has no secure context and registration could only
fail. The version comes from `CONFIG.version`; nothing is hard-coded in the
build script.

### Releasing an update

1. Edit the source in `web/`.
2. **Bump `CACHE_VERSION` in `web/sw.js`.** Without this, installed clients keep
   serving the old shell from Cache Storage — there is no server-side
   invalidation.
3. `node tools/build.mjs`
4. Re-upload `dist/site/`, and re-send the versioned offline file if you handed
   it out.

## What lives where

| Path | Purpose |
| --- | --- |
| `index.html` | Shell: top bar, screen container, tab bar |
| `manifest.webmanifest` | Install metadata: name, icons, standalone display |
| `sw.js` | Service worker. Caches the shell only — never the API |
| `icons/` | 192 / 512 / maskable / apple-touch icons |
| `assets/tokens.css` | Colour, type, radius, spacing, motion — ported 1:1 to WXSS in phase 2 |
| `assets/app.css` | Layout and components |
| `js/config.js` | The language table, the card catalog, card order, limits, shared session state |
| `js/prompts.js` | Every prompt, table-driven per language, with the shared rules composed in |
| `js/store.js` | localStorage: settings, history, entry payloads, wordbooks, backup/restore |
| `js/api.js` | DeepSeek client: overview, three deep lines, two sentence lines, candidate lookups |
| `js/practice.js` | Pinyin and kana normalisers plus the exercise state machine and its layer |
| `js/ui.js` | Escaping, icon set, formatting, markup helpers |
| `js/speech.js` | Pronunciation via the platform speech synthesiser |
| `js/pwa.js` | Service worker registration and install-prompt state |
| `js/view-dictionary.js` | Lookup: language picker, word/sentence mode, history |
| `js/view-word.js` | Entry: card registry, collapse, progressive lines |
| `js/view-favorites.js` | Favourites: language groups, wordbooks, practice source |
| `js/view-profile.js` | Key, model, explanation language, appearance, data |
| `js/app.js` | Hash router, top bar, three tabs, theme, bootstrap |

## Request shape

Four requests per lookup:

1. **Overview** — reading, part of speech, a one-line gist. The `reading` field
   is IPA for English/French/German, pinyin with tones for Chinese, kana for
   Japanese; it is what the practice exercises answer against.
2. **Three deep lines, fired in parallel.** Each owns a set of cards and
   repaints as it lands, so a slow line never holds up the others and a failed
   line can be retried alone. Which cards a line produces depends on the
   language — the prompt shapes are per language, the card catalog is shared.

Sentence analysis is two requests, same contract: `semantics` (translation,
word by word, chunks) and `grammar` (structure, grammar points, register,
pitfalls, pattern).

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

## Practice

Opened from the word page header (one word) or from Favourites, where the source
selector above the list decides the pool — all favourites or one wordbook. The
two can never disagree because the same selector drives both.

Four forms behind one layer, chosen by the word's language:

| Language | Form | Typed |
| --- | --- | --- |
| en / fr / de | spell | the word itself |
| zh | pinyin | the reading, with or without tones |
| ja (kango, wago) | kana | the reading, in kana or romaji |
| ja (gairaigo) | katakana | the word, in romaji or katakana |

Judging is language-aware because "correct" means something different in each.
Accents are forgiven in Latin scripts (`é` ≡ `e`). Chinese separates the
syllable from the tone: getting `qing` for `qīng` is reported as *reading
correct, mind the tone* rather than wrong, because not recalling a word and not
recalling its tone are different failures. Japanese compares through a romaji
normaliser, folds long vowels so `seikou` / `seikoo` / `seikō` all pass, accepts
the spellings listed under `Spelling variants`, and names a wrong okurigana
specifically. Chinese and Japanese words with no reading are excluded from the
pool rather than failing at the point of practice.

The exercise is a plain object driven by pure functions
(`createExercise / applyInput / applySubmit / applyHint`), so the whole state
machine — and both normalisers — are testable without a browser.

## Stored data

| Key | Contents |
| --- | --- |
| `dict3.settings` | API key, explanation language, query language, model, theme |
| `dict3.history` | Index rows (id, word, kind, language, reading, timestamp, star, summary) |
| `dict3.entry.<id>` | One full payload per headword or sentence |
| `dict3.wordbooks` | Named subsets of the favourites |

History holds 500 entries; when it overflows the oldest **unstarred** row is
evicted. Starred entries are never removed automatically. Exports never include
the API key. Every payload carries `schema: 3`.

A favourite **is** a starred entry — there is no second "is it saved" flag — and
a wordbook is a named subset of those. Adding to a book stars the word; deleting
a book never deletes a word; deleting a word unlinks it everywhere.

## Tests

```powershell
node web/tests/smoke.js
```

198 assertions run the app in stubbed browser and service worker scopes. The
ones worth naming:

- **All 25 source × output language combinations** build a complete prompt with
  no unfilled placeholder left behind — the check that caught a nested
  placeholder surviving a single-pass substitution.
- **`gift/en` and `gift/de` produce different entry ids**, and the same word in
  all five languages never overwrites itself.
- **Per-language card sets**: a French verb renders `Conjugation` and not
  `Gender and number`; a German noun renders `Article and plural`; a Japanese
  gairaigo renders `Source word` and not `Kanji origin`; a Chinese two-character
  word renders `Word formation` and not `Character evolution`. Expected order is
  derived from `CONFIG.cardOrder`, so the test asserts against the one declared
  order rather than a second copy of it.
- **Card titles are plain ASCII on every Latin-script card**, and the native
  gloss appears only on CJK cards.
- **Normalisers**: `qīng` / `qing1` / `qing` share a base and differ only in
  tone; `せいこう` / `seikou` / `sēkō` land on the same kana form; katakana and
  hiragana convert both ways.
- **Wordbooks**: a word can sit in several, membership implies favourite,
  removing or deleting a book only unlinks, and deleting a word unlinks it
  everywhere.
- **Cross-line interleaving**, driven with manually released promises: skeletons
  hold their slots, a failed line reports exactly once at its first card, and a
  retry refetches only that line.
- **3.0.1's four fixes**: a spaceless Chinese sentence validates, a single word
  validates, and the length bounds still bite; the accent decision shows a panel
  for `cote` + `côte`/`côté` but not for `table`, keeps the as-typed form first
  and labelled, survives a model that omits it, and matches with diacritics
  intact (folding them would defeat the feature); the dictionary screen has no
  Favourites button and the top bar has no profile icon, while the bottom bar
  still has three tabs and the missing-key notice still links to Profile; and
  light and dark both declare `--segment-selected` with different values, so the
  same-colour bug cannot come back unnoticed.

The service worker test is the one that matters most for safety: it drives the
worker's `fetch` handler with a synthetic `api.deepseek.com` call carrying an
`Authorization` header and asserts that not a single cache read or write
occurs. That is the guard that keeps users' API keys out of Cache Storage.
