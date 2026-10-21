/* RADICLE 2.0 — static design preview.

   Renders the real screens through the real view modules using a sample entry
   modelled on the reference analysis of "contend", then inlines the stylesheets
   into one standalone HTML file.

   Why: the new layout can be inspected without a DeepSeek key and without
   spending a single token. It is a design check, not a substitute for a real
   lookup — the data here is hand-written.

   node 2.0/tools/preview.mjs
   -> 2.0/dist/preview.html
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V2 = path.join(HERE, '..');
const WEB = path.join(V2, 'web');
const OUT = path.join(V2, 'dist', 'preview.html');

const LOAD_ORDER = [
  'config.js', 'prompts.js', 'store.js', 'speech.js', 'ui.js', 'spell.js',
  'api.js', 'pwa.js', 'view-dictionary.js', 'view-word.js', 'view-profile.js'
];

/* ---------- Minimal browser ---------- */

function createEnvironment() {
  const storage = new Map();
  const sandbox = {
    console, setTimeout, clearTimeout, Promise, JSON, Date, Math, Object, Array,
    String, Number, Error, AbortController, URL
  };

  const localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  };

  const documentStub = {
    readyState: 'complete',
    documentElement: { setAttribute: () => {} },
    body: { setAttribute: () => {}, appendChild: () => {}, classList: { add: () => {}, remove: () => {} } },
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {} }),
    getElementById: () => null,
    addEventListener: () => {},
    querySelectorAll: () => []
  };

  const windowStub = {
    localStorage,
    document: documentStub,
    location: { hash: '#/dictionary', replace: () => {}, protocol: 'file:', hostname: '' },
    setTimeout,
    clearTimeout,
    navigator: { onLine: true, userAgent: 'node' },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    fetch: () => Promise.reject(new Error('preview does not call the network'))
  };

  sandbox.window = windowStub;
  sandbox.document = documentStub;
  sandbox.localStorage = localStorage;
  sandbox.navigator = windowStub.navigator;
  sandbox.location = windowStub.location;

  vm.createContext(sandbox);
  LOAD_ORDER.forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(WEB, 'js', file), 'utf8'), sandbox, { filename: file });
  });
  return sandbox.window.RADICLE;
}

function container() {
  return {
    _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(value) { this._html = value; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
}

/* ---------- Sample data, modelled on the "contend" reference ---------- */

const CONTEND = {
  word: 'contend',
  language: 'en',
  overview: {
    word: 'contend',
    language: 'en',
    ipa: '/kənˈtend/',
    pos: 'v.',
    quick_meaning: '争夺；坚决主张；对付',
    register: 'formal',
    tags: ['conflict', 'assertion']
  },
  lines: {
    etymology: {
      core_metaphor: '一枚深植于拉丁语“拉紧、伸展、全力朝向”之动作的“张力印章”。',
      etymology: {
        chain: [
          { stage: 'Proto-Indo-European', language: '原始印欧语', form: '*ten-', meaning: '拉紧，伸展', date: '' },
          { stage: 'Latin', language: '拉丁语', form: 'tendere', meaning: '伸展，拉紧，朝向', date: '' },
          { stage: 'Latin', language: '拉丁语', form: 'contendere', meaning: '全力伸展；努力；争斗；主张', date: '' },
          { stage: 'Old French', language: '古法语', form: 'contendre', meaning: '争斗；主张', date: '12–13c' },
          { stage: 'Middle English', language: '中古英语', form: 'contend', meaning: '', date: '15c' }
        ],
        via: '古法语',
        first_attested: '15世纪进入中古英语',
        certainty: 'high',
        shift: '由“把力量绷紧并朝向某处”这一具体动作，分化出“与他人争夺”与“在争论中坚决主张”两条引申义。'
      },
      morphology: {
        breakdown: [
          { part: 'con-', type: 'prefix', form_note: 'com- 的变体，此处起加强语气作用', meaning: '一起；完全', origin: 'Latin' },
          { part: 'tend', type: 'root', form_note: '过去分词 tentus', meaning: '伸展，拉紧，朝向', origin: 'Latin tendere' }
        ],
        root_variants: [
          { form: '-tend-', note: '原形，多出现在动词中（extend、intend）' },
          { form: '-tent-', note: '来自过去分词 tentus，多出现在名词与形容词中（contentious、tension）' }
        ],
        composition: 'con-（完全）+ tend（拉紧）→ 把全部力量拉紧到一起，朝向一个目标'
      },
      root_family: {
        direct: [
          { word: 'contention', pos: 'n.', gloss: '争论；争夺；论点', formula: 'contend + -ion', examples: [{ text: 'The main point of contention is money.', translation: '争论的主要焦点是钱。' }] },
          { word: 'contentious', pos: 'adj.', gloss: '好争论的；有争议的', formula: 'contend + -ious', examples: [{ text: 'It is a highly contentious issue.', translation: '这是一个极具争议的问题。' }] },
          { word: 'contender', pos: 'n.', gloss: '竞争者，争夺者', formula: 'contend + -er', examples: [{ text: 'She is a serious contender for the title.', translation: '她是冠军的有力争夺者。' }] }
        ],
        shared_root: [
          { word: 'tend', gloss: '倾向；照料', formula: 'tend → 朝向（某方向）' },
          { word: 'tension', gloss: '张力，紧张', formula: 'tens（拉紧）+ -ion' },
          { word: 'tense', gloss: '紧张的；时态', formula: 'tensus（被拉紧的）' },
          { word: 'tendon', gloss: '腱', formula: '“拉紧的组织”' },
          { word: 'extend', gloss: '延伸', formula: 'ex-（向外）+ tend（伸展）' },
          { word: 'intend', gloss: '意图', formula: 'in-（朝向）+ tend（伸展）' },
          { word: 'attend', gloss: '出席；照料', formula: 'ad-（向）+ tend（伸展）' },
          { word: 'pretend', gloss: '假装', formula: 'pre-（在前）+ tend（展开）' }
        ]
      },
      derived_pronunciation: [
        { word: 'contention', ipa: '/kənˈtenʃn/' },
        { word: 'contentious', ipa: '/kənˈtenʃəs/' },
        { word: 'contender', ipa: '/kənˈtendər/' }
      ],
      false_cognates: [
        { word: 'content', actual_origin: '拉丁语 continere（包含）', note: '看似同源，实与 contend 无关。' },
        { word: 'contest', actual_origin: '拉丁语 contestari（作证）', note: '同属“争执”语义场，但词源不同。' }
      ]
    },
    usage: {
      senses: [
        { pos: 'v.', definition: '争夺，竞争（contend for）', examples: [{ text: 'Three candidates are contending for the presidency.', translation: '三名候选人正在争夺总统职位。' }] },
        { pos: 'v.', definition: '坚决主张，声称（contend that）', examples: [{ text: 'She contends that the law is unconstitutional.', translation: '她主张该法律违宪。' }] },
        { pos: 'v.', definition: '对付，应付（contend with）', examples: [{ text: 'Rescue workers are contending with freezing temperatures.', translation: '救援人员正在与严寒作斗争。' }] }
      ],
      collocations: [
        { pattern: 'contend for', meaning: '争夺（奖项、职位、权力）', typical_objects: ['a prize', 'a title', 'a seat', 'the championship'] },
        { pattern: 'contend with', meaning: '对付，应付（困难、问题）', typical_objects: ['difficulties', 'inflation', 'disease'] },
        { pattern: 'contend against', meaning: '对抗（对手、劣势）', typical_objects: ['an opponent', 'overwhelming odds'] },
        { pattern: 'contend that', meaning: '坚决主张……', typical_objects: ['the law is…', 'the evidence was…'] }
      ],
      usage_notes: [
        '属正式用语，日常口语里更常说 compete 或 claim。',
        'contend with 的宾语通常是困难或处境，不是人；与人争某物要用 contend with sb for sth。'
      ]
    },
    distinction: {
      confusables: {
        theme: '表示“声称／主张”的一组动词',
        table: [
          { word: 'contend', meaning: '坚决主张', note: '在争论中全力主张，语气强' },
          { word: 'compete', meaning: '竞争', note: '更中性，强调参与比赛或市场' },
          { word: 'claim', meaning: '声称', note: '可能无证据，语气较弱' },
          { word: 'argue', meaning: '争论；论证', note: '强调论证过程' },
          { word: 'maintain', meaning: '坚持认为', note: '强调持续坚持某一立场' },
          { word: 'assert', meaning: '断言', note: '自信有力地陈述' },
          { word: 'allege', meaning: '指控；声称', note: '法律语境，未经证实' }
        ],
        parallel_examples: [
          { sentence: 'He claims he is innocent.', note: '可能只是说法' },
          { sentence: 'He contends that he is innocent.', note: '在争论中坚决主张' },
          { sentence: 'He maintains his innocence.', note: '持续坚持立场' },
          { sentence: 'He asserts his innocence.', note: '自信有力' }
        ],
        contrast_pairs: [
          { a: 'contend with', a_meaning: '对付、应付（困难、问题）', b: 'contend for', b_meaning: '争夺（奖项、职位、权力）' }
        ]
      },
      cultural_notes: [
        '常见于体育报道与法律文本，“有力争夺者”“争端的起因”都是它的固定说法。'
      ],
      synthesis: [
        '拉紧：肌肉绷紧，朝向目标。',
        '朝向目标：与他人争夺，与困难搏斗。',
        '在争论中拉紧：坚决主张，奋力辩护。'
      ],
      mnemonic: 'con + tend：把全部力量拉紧到一起，朝向一个目标，绝不松手。'
    }
  }
};

const OTHER_ROWS = [
  { word: 'ephemeral', pos: 'adj.', quickMeaning: '短暂的', language: 'en', ts: Date.now() - 3600e3, starred: true },
  { word: 'flâner', pos: 'v.', quickMeaning: '闲逛，无所事事地漫步', language: 'fr', ts: Date.now() - 86400e3 * 2 },
  { word: 'liminal', pos: 'adj.', quickMeaning: '阈限的，过渡阶段的', language: 'en', ts: Date.now() - 86400e3 * 9 }
];

/* A static rendering of the spell layer, mirroring what spell.js produces.
   Kept hand-written because the layer is built lazily behind real DOM APIs. */
function spellDemo(ns, answer, typed, status) {
  const chars = ns.spell.toChars(answer);
  const given = ns.spell.toChars(typed);
  const marks = status === 'wrong' ? ns.spell.judge(typed, answer) : null;
  let html = '<div class="spell-word" data-status="' + status + '">';
  for (let i = 0; i < chars.length; i += 1) {
    if (status === 'input' && i === given.length) html += '<span class="spell-caret"></span>';
    const shown = i < given.length ? given[i] : '';
    let cls = 'spell-ch';
    if (status === 'correct') cls += ' is-ok';
    else if (marks) cls += marks[i] ? ' is-ok' : (shown ? ' is-bad' : ' is-missing');
    else cls += shown ? ' is-neutral' : ' is-empty';
    html += '<span class="' + cls + '">' + ns.ui.esc(shown || '_') + '</span>';
  }
  if (status === 'input' && given.length === chars.length) html += '<span class="spell-caret"></span>';
  html += '</div>';
  if (status === 'wrong') {
    html += '<div class="spell-answer">' + ns.ui.esc(answer) + '</div>';
  }
  return html;
}

/* ---------- Build ---------- */

const ns = createEnvironment();
const store = ns.store;

/* Seed history so the dictionary screen has something to show. */
const contendId = store.entryId('contend', 'deepseek-flash', 'zh');
store.saveEntry(Object.assign({ id: contendId, schema: 2, status: 'ok', ts: Date.now() }, CONTEND));
OTHER_ROWS.forEach((row) => {
  const id = store.entryId(row.word, 'deepseek-flash', 'zh');
  store.saveEntry({
    id,
    schema: 2,
    word: row.word,
    language: row.language,
    status: 'ok',
    ts: row.ts,
    starred: !!row.starred,
    overview: { word: row.word, pos: row.pos, quick_meaning: row.quickMeaning }
  });
  if (row.starred) store.toggleStar(id);
});
store.patchSettings({ apiKey: 'sk-preview-not-a-real-key' });

const dictionary = container();
ns.views.dictionary.render(dictionary, {});

const word = container();
ns.views.word.render(word, { id: contendId });

const profile = container();
ns.views.profile.render(profile, {});

const css = ['tokens.css', 'app.css']
  .map((file) => fs.readFileSync(path.join(WEB, 'assets', file), 'utf8'))
  .join('\n');

function panel(title, note, body) {
  return '<section class="pv-panel">' +
    '<div class="pv-head"><h2>' + title + '</h2><p>' + note + '</p></div>' +
    '<div class="app pv-frame"><main class="screen">' + body + '</main></div>' +
    '</section>';
}

const spellPanel =
  '<section class="pv-panel">' +
  '<div class="pv-head"><h2>Spelling layer</h2><p>三种状态。真实层是全屏虚化的，这里为了并排展示去掉了背景。</p></div>' +
  '<div class="pv-spell">' +
    '<div class="pv-spell-cell"><span class="pv-tag">input</span>' + spellDemo(ns, 'checker', 'checke', 'input') + '</div>' +
    '<div class="pv-spell-cell"><span class="pv-tag">wrong</span>' + spellDemo(ns, 'checker', 'checker', 'wrong') + '</div>' +
    '<div class="pv-spell-cell"><span class="pv-tag">correct</span>' + spellDemo(ns, 'checker', 'checker', 'correct') + '</div>' +
  '</div>' +
  '<div class="pv-spell-tools">' +
    '<button type="button" class="spell-btn">' + ns.ui.icon('close') + '</button>' +
    '<button type="button" class="spell-btn">' + ns.ui.icon('bulb') + '</button>' +
    '<button type="button" class="spell-btn">' + ns.ui.icon('check') + '</button>' +
  '</div>' +
  '</section>';

const html = [
  '<!DOCTYPE html>',
  '<html lang="en" data-theme="auto">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>Radicle 2.0 — design preview</title>',
  '<style>',
  css,
  '\n/* preview chrome only */',
  'body { padding: 24px 0 64px; }',
  '.pv-wrap { max-width: 900px; margin: 0 auto; padding: 0 20px; }',
  '.pv-title { font-size: 30px; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 6px; }',
  '.pv-sub { color: var(--text-2); margin-bottom: 28px; }',
  '.pv-panel { margin-bottom: 44px; }',
  '.pv-head { margin-bottom: 12px; }',
  '.pv-head h2 { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }',
  '.pv-head p { font-size: 13px; color: var(--text-2); margin-top: 3px; }',
  '.pv-frame { background: var(--bg); border: 1px solid var(--separator-soft); border-radius: 22px; overflow: hidden; }',
  '.pv-frame .screen { padding-top: 20px; }',
  '.pv-spell { display: flex; gap: 12px; flex-wrap: wrap; }',
  '.pv-spell-cell { flex: 1 1 240px; background: var(--card); border: 1px solid var(--separator-soft); border-radius: 18px; padding: 28px 16px; display: flex; flex-direction: column; align-items: center; gap: 14px; position: relative; }',
  '.pv-tag { position: absolute; top: 10px; left: 12px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); }',
  '.pv-spell-cell .spell-word { font-size: 32px; }',
  '.pv-spell-tools { display: flex; justify-content: center; gap: 90px; margin-top: 20px; }',
  '.pv-note { margin-top: 40px; padding: 16px 18px; border-radius: 14px; background: var(--fill); font-size: 13px; color: var(--text-2); line-height: 1.55; }',
  '</style>',
  '</head>',
  '<body>',
  '<div class="pv-wrap">',
  '<div class="pv-title">Radicle 2.0 — design preview</div>',
  '<p class="pv-sub">Sample data, hand-written from the reference analysis of “contend”. No API key, no network, no tokens spent.</p>',
  panel('1 · Dictionary', '搜索框、Spelling practice 入口、按时间分组的历史列表。', dictionary.innerHTML),
  panel('2 · Entry', '十二张深度卡：语义内核、词源时间轴、构词分解、词根家族、假同源词、释义、搭配、用法、辨析表、文化、收束、记忆法。每张卡点表头可收起。', word.innerHTML),
  spellPanel,
  panel('4 · Profile', 'API Key、模型、解析语言、外观、数据（含清除应用缓存）、About。', profile.innerHTML),
  '<div class="pv-note">这是用 Node 直接渲染视图模块生成的静态页面，用来在没有 Key 的情况下检查版式。' +
  '真实查询的数据由 DeepSeek 返回，字段结构与此一致，但内容会不同。深浅色可用系统主题切换查看。</div>',
  '</div>',
  '</body>',
  '</html>'
].join('\n');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log('preview written to ' + path.relative(path.join(V2, '..'), OUT) + '  (' + kb + ' KB)');
