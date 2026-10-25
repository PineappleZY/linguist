# Linguist 7.0 — web app

## What 7.0 changed

- **Roots is now a fourth tab.** Words expose clickable roots, the index is
  built from existing etymology/components, mastery uses a 10m/1d/3d/7d/21d/60d
  ladder, and a five-question mixed review (three choices, two objective typed
  answers) updates it.
- **Surprise uses a persistent 200-word pool.** Two 100-word batches, 80/20
  live/exotic mix, local anti-repeat, and a 100-word top-up when a selected
  language runs low. It no longer asks the model on every tap.
- **Non-dictionary languages get a discovery card.** Core meaning, two
  examples, pronunciation and an honest root note. Discovery words only join the
  reserved Surprise wordbook and never enter practice.
- **Sentences, files and discovery words can be deleted from a row**, with the
  same eight-second Undo as the entry page.
- **Spelling names its language** before the part of speech.

## What 6.5 changed

- **Nothing that costs money.** Entry points no longer speak on open or when
  moving to the next word. The speaker stays disabled until the reader has
  revealed at least one hint (`practice.replayLocked`), and `handle('replay')`
  enforces the same rule. Tone mistakes still count as correct.
- **Retyping works.** A `wrong` exercise used to keep its old `typed` value, so
  the next keystroke redrew the previous misspelling. `applyInput` now opens a
  fresh attempt (clears typed/marks/note/tail) while keeping the revealed
  answer visible; `Retry` takes the same path.
- **Surprise respects a pinned language.** A model-named language that differs
  from the pin is rejected and re-rolled; only an empty answer, the pinned
  language, or a non-Latin-script conflict with a live language is accepted.
- **The last interface strings moved into `strings.js`**: theme names, both
  model hints, the three etymology fact labels, and the explanation picker.
  The Chinese Profile renders 自动 / 浅色 / 深色; a static guard fails on the old
  literals.
- **Document limits are real.** The stored copy of a document is cut to 60,000
  characters with `textTruncated: true` while the in-memory entry keeps the
  full text; `documentId` hashes the whole normalised text.
- **Unstarring leaves the row in place.** `ns.session.keptUnstarred` unions
  with the stored starred rows until `leave()` runs (route change or reload),
  so the row turns into a hollow star and can be re-starred on the spot.

`node tools/strings-md.mjs` regenerates `../STRINGS.md` (420 keys × 5 languages).
`node web/tests/smoke.js` is the 792-assertion suite; `node tools/build.mjs`
writes `dist/linguist_7.0.0.html`.

## What 6.1 changed

- **The practice prompt is the prompt.** A round used to show nothing but
  underscores until the bulb was tapped, and the bulb revealed the meaning —
  which is the only thing the exercise asks you to know. Now `pos` and the
  meaning are drawn from the first frame (`.spell-prompt`), and the hint ladder
  is IPA → first letter. The meaning is resolved to the explanation language the
  reader configured for that source language (`practice.meaningFor`), falling
  back to a sibling entry when the stored one was written in another language,
  and to the stored gloss otherwise — never a network request.
- **Hints cannot leak the answer.** For Chinese and Japanese the reading *is*
  the answer, so `firstHint()` returns the tone pattern (`tonePatternOf`, read
  off the tone-marked vowels) or the mora count (`moraCount`, small kana
  excluded) instead.
- **Card names in the ordering list follow the interface language**
  (`CONFIG.cardTitle(card, uiLang)`, fed by a `CARD_TITLES` table that reuses
  each card's native term where it has one). The entry page keeps its
  "English · native term" title — the list is the only place a reader is
  choosing between cards rather than reading one.
- **Each group's restore is outside the disclosure.** The four headings are now
  a row: toggle on the left, `Reset this group` on the right, visible whether
  the group is folded or open. Storage is unchanged.
- **DOCX.** `extract.readDocx` treats the file as a zip (central directory walk,
  stored and deflated members, `DecompressionStream('deflate-raw')`, no
  dependency) and turns `<w:p>`/`<w:br/>`/`<w:tab/>` into paragraph, line and
  tab. `.doc` has a reader entry only so it can be refused by name; a docx over
  10 MB is refused before it is unpacked.
- **The file's shape survives.** `normaliseText` now keeps every line break and
  blank line and collapses only runs of spaces (tabs are kept — in a docx a tab
  is a column). `pageText` rebuilds PDF lines from the y coordinate of each text
  run and turns a gap larger than 1.6× the page's own line pitch into a blank
  line. The translation card renders with `white-space: pre-wrap`, so a single
  break inside a paragraph is not flattened.
- **信 · 达 · 雅 in the document prompt**, in that order, with accuracy winning
  any conflict, and paragraph-for-paragraph mapping required.

## What 6.0 changed

- **The product is called `Linguist`.** The namespace is `window.LINGUIST`, the
  offline file is `linguist_<version>.html`, the cache is `linguist-v<version>`
  and the backup kind is `linguist-backup` — all derived from
  `CONFIG.appName`, so the name cannot drift between them. The *displayed* name
  comes from `strings.js` (`app.name`) and is deliberately the same string in
  all five interface languages; the tagline and the description beside it are
  written per language. The icon is concept 1 of
  `design/icon-concepts/make_app_icons.py`.
- **`Core meaning` replaced `Semantic core`.** The card used to ask for a vivid
  metaphor, which duplicated `Mnemonic` and left the precise sense nowhere; it
  now asks for one or two plain sentences naming the central meaning, the
  semantic field and the link to the first sense, and forbids imagery. The
  field is `core_meaning`; `core_metaphor` is still rendered so a cached entry
  does not lose a card to a rename.
- **Definitions are capped per explanation language** (`SENSE_MIN` /
  `SENSE_LIMIT`: 24 characters for Chinese, 40 for Japanese, 12 words for the
  rest) and the "one short clause, no synonym lists, no etymology, no repeat"
  rule lives in `prompts.LINE_RULES.usage`, which applies to all seven source
  languages at once. Measured on `contend`: 11/9/11/12 characters.
- **Card preferences** (`Profile → Cards`): four groups — the three reading
  families and the sentence page. `CONFIG.resolveCardPrefs(group, prefs)` is a
  pure function returning `{ order, hidden }`; unknown keys are ignored, so a
  preference written by another version cannot shorten the list. The entry page
  derives both its sequence and its group headings from it, and a hidden card
  is not rendered at all — no body, no skeleton, no failed-line notice.
- **File mode** (the fourth query type). `web/js/extract.js` is the whole of the
  file handling: pure functions for HTML, subtitles, normalisation and chunk
  planning, plus two readers (text via `FileReader`, PDF via the vendored
  pdf.js). One request per chunk, four fields at once, sequential, then one
  merge request that folds the per-chunk bullets into a single outline. The
  document page is `web/js/view-document.js`; its four card builders live there
  and are reached first for `kind === 'document'` — `translation` and `register`
  are card names the sentence page also uses, and the collision silently emptied
  the register card until the screenshot check caught it.
- **The document line has its own timeout** (`api.documentTimeoutMs = 90000`).
  Measured: a 16,000-character part took 24 seconds, against the 45 seconds the
  word lookups use — a 1.9× margin, which is not one. Word and sentence lines
  keep 45s.
- **The tour card is positioned by `tour.layoutFor`**, a pure function, and the
  inline `top` is written on every step — including the centred ones. The old
  code left the previous step's inline value in place, and an inline style beats
  `.tour-card.is-centred`, which is what put the card off screen with its
  buttons. Steps may name the screen they live on and the runner goes there
  first.

## What 4.2 changed

- **The practice glyph is a keycap spelling `prac`.** The bare pencil read as
  "new folder" at 22px and already meant "rename" elsewhere, so the action now
  says what it is; rename keeps the pencil. The candidates it was chosen from
  are in `design/icon-concepts/make_practice_icons.py`, drawn from the same
  geometry the shipped icon uses.
- **Group headings fold.** Each date in History, and each language and the
  `Wordbooks` heading in Favourites, is a disclosure button carrying a count,
  with a master `Collapse all` / `Expand all` on the section row. Everything
  starts open and the state is in-memory only, like the entry page's folded
  cards.
- **Sentences are favourites.** They used to be filtered out of the screen
  entirely — you could star one and never see it. Now they appear, and inside a
  language group `Words` and `Sentences` are separated whenever both are
  present. A sentence is never a practice item; the button is not drawn.
- **`auto` is no longer stored as a language.** It was a picker state being
  copied into the history row, which meant the row could not be grouped or
  practised, and — worse — the four deep prompts fell back to English, so the
  content was wrong too. Now:
  - the overview must name a language; if it does not, one retry, then the
    lookup fails with a `Language unclear` notice instead of saving a half
    entry. `CONFIG.languageByAnyName` accepts an id, an English name or a native
    name, and returns `''` for anything else;
  - a sentence, which never gets an overview, is identified first with one tiny
    request (`prompts.detect` / `api.detectLanguage`, 60 tokens) — this also
    fixes Auto sentences having been analysed with the English prompts;
  - rows stored before 4.2 are identified when the Favourites screen opens: once
    each, only with a key and only online, a word through a full overview (which
    also restores its reading and gloss) and a sentence through the detector.
    Until then they are listed under `Language unknown` with a manual Identify,
    rather than under a language that does not exist.

## What 4.1 changed

- **A fourth request line, `inflection`.** "How does this word change its
  shape" is a different question from what it means, and it is the largest
  payload in the app, so it gets its own line: its own prompt, its own token
  ceiling, its own retry, its own failure. Japanese and Chinese have nothing to
  tabulate, so `CONFIG.deepLinesFor(language)` returns three lines for them and
  the app neither requests a fourth nor reports one missing.
- **Full person-by-person paradigms.** 5 tenses for English, 7 for French, 6 for
  German, 8 each for Italian and Spanish, six persons each (the French
  imperative has three). A paradigm is worthless if it is truncated, so the
  prompt demands every person of every tense and forbids summarising a tense as
  "regular".
- **Six new cards and three retired ones.** `Word profile`, `Noun forms`,
  `Adjective forms`, `Comparison`, `Pronouns`, `Verb + preposition` join the
  catalogue; `Gender and number` and `Article and plural` fold into
  `Noun forms`, and `Principal parts` folds into `Conjugation` (the German card
  renders the `gehen → ging → gegangen` strip above its tables). One card owns
  one part of speech outright. The renderer still reads the two retired field
  names, so an entry cached before 4.1 keeps working.
- **Four quiet section labels** — Meaning / Forms / Roots / Culture — because
  twelve to fifteen cards in a row is no longer readable as a structure. The
  labels are not controls; the page still has exactly one collapse button.
- **Paradigms open per tense.** Each tense is a disclosure row showing its size,
  `Expand all forms` opens a whole card, and the state lives in the session so a
  re-render cannot lose it. Everything starts closed.
- **The explanation language moved into the entry toolbar**, sharing one setting
  with Profile. Switching it re-runs the whole lookup under the original
  language argument; since the entry id contains the explanation language that
  lands as a new history row and switching back is served from cache.
- **The practice button has its own glyph.** The bare pencil read as "new
  folder" at 22px and already means "rename" elsewhere, so practice now uses
  `write` — a pencil over a writing line. Candidates are in
  `design/icon-concepts/make_practice_icons.py`.
- **Measured, not guessed**: two real lookups (a French verb and a German noun)
  put the whole four-line set at 7.1–7.3s wall clock, slowest line 7.3s, and the
  inflection line at 388–1136 tokens against its 4500 ceiling.

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
`dict4.*`, so all four can be open in the same browser without touching each
other.

## Run it

```powershell
# from the 4.0 folder
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

## Look at it without spending a token

```powershell
node tools/preview.mjs                  # -> dist/preview.html
node tools/preview.mjs --panel p-de-noun  # -> dist/preview-panel.html, one screen only
```

The preview renders the real view modules through Node with hand-written sample
data for all seven languages, so the layout can be inspected without a key,
without a network call and without spending anything. `--panel <id>` writes a
single screen, which is what you want when driving a headless browser: the full
page is tens of thousands of pixels tall and a fragment link does not reliably
scroll it. Known ids include `p-dict`, `p-en`, `p-fr-forms`, `p-de-noun`,
`p-de-adj`, `p-fav`, `p-doc`, `p-cards`, `p-cards-zh`.

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --headless=new `
  --disable-gpu --hide-scrollbars --window-size=980,5200 `
  --screenshot=dist/shots/p-de-noun.png `
  "file:///<repo>/6.0/dist/preview-panel.html"
```

`dist/shots/` holds the screens worth re-checking after a change to the entry,
practice, Starred or Cards screens.

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
| `dist/linguist_<version>.html` | One self-contained file. Double-click it and the whole app runs, no server involved. |

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

`dist/radicle_<version>.html` — currently `radicle_4.2.0.html` — is for handing
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
| `js/store.js` | localStorage: settings, history, entry payloads, wordbooks, backup/restore. `saveEntry` refuses to write `auto` as a language |
| `js/api.js` | DeepSeek client: overview, the deep lines, two sentence lines, candidate lookups, the one-question language detector |
| `js/practice.js` | Pinyin and kana normalisers plus the exercise state machine and its layer |
| `js/ui.js` | Escaping, icon set, formatting, markup helpers |
| `js/speech.js` | Pronunciation via the platform speech synthesiser |
| `js/pwa.js` | Service worker registration and install-prompt state |
| `js/view-dictionary.js` | Lookup: language picker, word/sentence mode, history with foldable days |
| `js/view-word.js` | Entry: card registry, section labels, collision-free collapse, paradigm disclosures, the explanation-language switch |
| `js/view-favorites.js` | Favourites: language groups with Words/Sentences inside, wordbooks, practice source, identifying rows an older version left without a language |
| `js/view-profile.js` | Key, model, explanation language, appearance, data |
| `js/app.js` | Hash router, top bar, three tabs, theme, bootstrap |

## Request shape

Four deep requests per lookup, fired once the overview lands:

1. **Overview** — reading, part of speech, a one-line gist. The `reading` field
   is IPA for English/French/German, pinyin with tones for Chinese, kana for
   Japanese; it is what the practice exercises answer against.
2. **The deep lines, fired in parallel** — `etymology`, `usage`, `inflection`,
   `distinction` for the five inflecting languages, the same list minus
   `inflection` for Chinese and Japanese. Each owns a set of cards and
   repaints as it lands, so a slow line never holds up the others and a failed
   line can be retried alone. Which cards a line produces depends on the
   language — the prompt shapes are per language, the card catalog is shared.
   Asking for the inflection line of a Chinese word is rejected before any
   request is spent, because the prompt cannot be built.

Sentence analysis is two requests, same contract: `semantics` (translation,
word by word, chunks) and `grammar` (structure, grammar points, register,
pitfalls, pattern).

A full entry runs to roughly 4500 Chinese characters once the paradigms are
included. Split four ways, the first block paints while the rest are still
generating. Measured on real lookups (`aller`/fr and `Gift`/de): overview 1.0s,
the four deep lines in parallel 7.1s, the whole set about 7.3s.

Both set `response_format: {"type":"json_object"}`; the prompts also contain the
word "json" and a shape example, which JSON mode requires to avoid a stalled
generation. Thinking mode is off by default because it ignores `temperature` and
is markedly slower; these are structured extraction tasks, not reasoning
problems. Per-request token ceilings live in `CONFIG.maxTokens` and were chosen
generously so a long entry is never cut mid-JSON. A real call used about 1000
tokens on the longest line against a 3200 ceiling and returned `finish_reason:
stop` everywhere, so the headroom is doing its job rather than papering over a
too-small cap. The 4.1 measurements are the same story on the bigger line: 1136
tokens against a 4500 ceiling. Every card renders only when its field is
non-empty, which is what lets one catalog serve seven different-looking
entries; the inflection prompt is explicit that an inapplicable field must come
back `null` rather than as an empty table.

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
| `dict4.settings` | API key, explanation language, query language, model, theme |
| `dict4.history` | Index rows (id, word, kind, language, reading, timestamp, star, summary) |
| `dict4.entry.<id>` | One full payload per headword or sentence |
| `dict4.wordbooks` | Named subsets of the favourites |

History holds 500 entries; when it overflows the oldest **unstarred** row is
evicted. Starred entries are never removed automatically. Exports never include
the API key. Every payload carries `schema: 4`.

A favourite **is** a starred entry — there is no second "is it saved" flag — and
a wordbook is a named subset of those. Adding to a book stars the word; deleting
a book never deletes a word; deleting a word unlinks it everywhere.

## Tests

```powershell
node web/tests/smoke.js
```

339 assertions run the app in stubbed browser and service worker scopes. The
ones worth naming:

- **All 25 source × output language combinations** build a complete prompt with
  no unfilled placeholder left behind — the check that caught a nested
  placeholder surviving a single-pass substitution.
- **`gift/en` and `gift/de` produce different entry ids**, and the same word in
  all five languages never overwrites itself.
- **Every card in the catalog has a renderer.** A card declared without one
  silently never appears — that is exactly how `Ser and estar` and `Arabisms`
  were invisible until someone looked — so `builderKeys()` is compared against
  `cardOrder` on every run.
- **Per-language card sets**: an English noun gets no `Adjective forms`; a German
  noun gets the four-case table and no `Verb + preposition`; a French noun drops
  its verb cards; a Japanese gairaigo renders `Source word` and not `Kanji
  origin`; a Chinese two-character word renders `Word formation` and not
  `Character evolution`. Expected order is derived from `CONFIG.cardOrder`, so
  the test asserts against the one declared order rather than a second copy.
- **Sections never interleave** and each is announced exactly once; a Chinese
  entry has no Forms section at all, and the labels carry no handlers.
- **Paradigms**: two tenses render two disclosure rows and no persons, opening
  one shows six rows and leaves the other shut, opening both flips the card
  control, and the open state survives a re-render. An entry cached before 4.1
  (string forms, `article_plural`) still renders.
- **The explanation-language switch** writes the setting, toasts, re-queues the
  lookup under the original language argument with a different entry id, leaves
  the old entry and its answer intact in history, and offers all seven languages
  by native name.
- **4.2's language handling**: `auto` normalises to nothing rather than to a
  language, and a row never stores it; an overview with no language is asked for
  once more and then reported as `Language unclear` with nothing saved; an Auto
  sentence sends exactly one detector request against its 60-token ceiling and
  is stored under what it found, while a pinned one sends none; an older row
  with no language is asked once per session, gets its reading and gloss back,
  has its wrongly-prompted deep lines dropped, and never reaches the practice
  pool.
- **4.2's groups**: date and language headings render as disclosures with counts
  and start open; folding one hides only its rows and survives a re-render; the
  master switch flips every group it is showing; a starred sentence is a
  favourite but never a practice item; a language holding both kinds gets a
  `Words` and a `Sentences` label in that order, and one holding a single kind
  gets none.
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
