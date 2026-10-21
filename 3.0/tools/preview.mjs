/* RADICLE 3.0 — static design preview.

   Renders the real screens through the real view modules with hand-written
   sample data, then inlines the stylesheets into one standalone HTML file. The
   point is to inspect the layout for every language without an API key and
   without spending a token.

   node 3.0/tools/preview.mjs
   -> 3.0/dist/preview.html
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V3 = path.join(HERE, '..');
const WEB = path.join(V3, 'web');
const OUT = path.join(V3, 'dist', 'preview.html');

function scriptOrder() {
  const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
  return [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
}

function createEnvironment() {
  const storage = new Map();
  const sandbox = {
    console, setTimeout, clearTimeout, Promise, JSON, Date, Math, Object, Array,
    String, Number, Error, AbortController, URL
  };
  const localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k)
  };
  const documentStub = {
    readyState: 'complete',
    documentElement: { setAttribute: () => {} },
    body: {
      setAttribute: () => {}, appendChild: () => {},
      classList: { add: () => {}, remove: () => {} }
    },
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {} }),
    getElementById: () => null,
    addEventListener: () => {},
    querySelectorAll: () => []
  };
  const windowStub = {
    localStorage, document: documentStub,
    location: { hash: '#/dictionary', replace: () => {}, protocol: 'file:', hostname: '' },
    setTimeout, clearTimeout,
    navigator: { onLine: true, userAgent: 'node' },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    prompt: () => null,
    confirm: () => true,
    fetch: () => Promise.reject(new Error('the preview never calls the network'))
  };
  sandbox.window = windowStub;
  sandbox.document = documentStub;
  sandbox.localStorage = localStorage;
  sandbox.navigator = windowStub.navigator;
  sandbox.location = windowStub.location;
  sandbox.self = windowStub;

  vm.createContext(sandbox);
  scriptOrder().forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(WEB, file), 'utf8'), sandbox, { filename: file });
  });
  return sandbox.window.RADICLE;
}

function container() {
  return {
    _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
}

/* ---------- Sample data ---------- */

const EN = {
  word: 'contend', language: 'en',
  overview: { word: 'contend', language: 'en', reading: '/kənˈtend/', pos: 'v.', quick_meaning: '争夺；坚决主张；对付', register: 'formal', tags: ['conflict', 'assertion'] },
  lines: {
    etymology: {
      core_metaphor: '一枚深植于拉丁语“拉紧、伸展、全力朝向”之动作的「张力印章」。',
      etymology: {
        chain: [
          { stage: 'PIE', language: 'Proto-Indo-European', form: '*ten-', meaning: '拉紧，伸展', date: '' },
          { stage: 'Latin', language: 'Latin', form: 'tendere', meaning: '伸展，拉紧，朝向', date: '' },
          { stage: 'Latin', language: 'Latin', form: 'contendere', meaning: '全力伸展；争斗；主张', date: '' },
          { stage: 'Old French', language: 'Old French', form: 'contendre', meaning: '争斗；主张', date: '12–13c' },
          { stage: 'Middle English', language: 'Middle English', form: 'contend', meaning: '', date: '15c' }
        ],
        via: 'Old French', first_attested: '15c', certainty: 'high',
        shift: '由“把力量绷紧并朝向某处”这一具体动作，分化出“与他人争夺”与“在争论中坚决主张”两条引申义。'
      },
      morphology: {
        breakdown: [
          { part: 'con-', type: 'prefix', form_note: 'com- 的变体，此处起加强语气作用', meaning: '一起；完全', origin: 'Latin' },
          { part: 'tend', type: 'root', form_note: '过去分词 tentus', meaning: '伸展，拉紧，朝向', origin: 'Latin tendere' }
        ],
        root_variants: [
          { form: '-tend-', note: '原形，多出现在动词中（extend、intend）' },
          { form: '-tent-', note: '来自过去分词 tentus，多出现在名词与形容词中' }
        ],
        composition: 'con-（完全）+ tend（拉紧）→ 把全部力量拉紧到一起，朝向一个目标'
      },
      root_family: {
        direct: [
          { word: 'contention', pos: 'n.', gloss: '争论；争夺；论点', formula: 'contend + -ion', examples: [{ text: 'The main point of contention is money.', translation: '争论的主要焦点是钱。' }] },
          { word: 'contentious', pos: 'adj.', gloss: '好争论的；有争议的', formula: 'contend + -ious', examples: [] }
        ],
        shared_root: [
          { word: 'extend', gloss: '延伸', formula: 'ex- (outward) + tend (stretch)' },
          { word: 'intend', gloss: '意图', formula: 'in- (toward) + tend (stretch)' },
          { word: 'attention', gloss: '注意力', formula: 'ad- (to) + tend + -ion' },
          { word: 'tension', gloss: '张力', formula: 'tens (stretched) + -ion' },
          { word: 'tendon', gloss: '腱', formula: 'the stretched tissue' }
        ]
      },
      derived_pronunciation: [
        { word: 'contention', ipa: '/kənˈtenʃn/' },
        { word: 'contentious', ipa: '/kənˈtenʃəs/' }
      ],
      false_cognates: [
        { word: 'content', actual_origin: 'Latin continere (to hold together)', note: '看似同源，实与 contend 无关。' },
        { word: 'context', actual_origin: 'Latin contexere (to weave)', note: '来自“编织”，不是“拉紧”。' }
      ]
    },
    usage: {
      senses: [
        { pos: 'v.', definition: '争夺，竞争', examples: [{ text: 'Three candidates are contending for the presidency.', translation: '三名候选人正在争夺总统职位。' }] },
        { pos: 'v.', definition: '坚决主张，声称', examples: [{ text: 'She contends that the law is unconstitutional.', translation: '她主张该法律违宪。' }] },
        { pos: 'v.', definition: '对付，应付', examples: [] }
      ],
      collocations: [
        { pattern: 'contend for', meaning: '争夺（奖项、职位）', typical_objects: ['a prize', 'a title', 'a seat'] },
        { pattern: 'contend with', meaning: '对付（困难、问题）', typical_objects: ['difficulties', 'inflation'] },
        { pattern: 'contend that', meaning: '坚决主张……', typical_objects: ['the law is…'] }
      ],
      usage_notes: ['属正式用语，日常口语里更常说 compete 或 claim。', 'contend with 的宾语通常是困难或处境，不是人。']
    },
    distinction: {
      confusables: {
        theme: '表示“声称／主张”的一组动词',
        table: [
          { word: 'contend', meaning: '坚决主张', note: '在争论中全力主张，语气强' },
          { word: 'claim', meaning: '声称', note: '可能无证据，语气较弱' },
          { word: 'argue', meaning: '争论；论证', note: '强调论证过程' },
          { word: 'assert', meaning: '断言', note: '自信有力地陈述' }
        ],
        parallel_examples: [
          { sentence: 'He claims he is innocent.', note: '可能只是说法' },
          { sentence: 'He contends that he is innocent.', note: '在争论中坚决主张' }
        ],
        contrast_pairs: [
          { a: 'contend with', a_meaning: '对付、应付', b: 'contend for', b_meaning: '争夺' }
        ]
      },
      cultural_notes: ['常见于体育报道与法律文本。'],
      synthesis: ['拉紧：肌肉绷紧，朝向目标。', '朝向目标：与他人争夺，与困难搏斗。', '在争论中拉紧：坚决主张，奋力辩护。'],
      mnemonic: 'con + tend：把全部力量拉紧到一起，朝向一个目标，绝不松手。'
    }
  }
};

const ZH = {
  word: '青', language: 'zh',
  overview: { word: '青', language: 'zh', reading: 'qīng', pos: '名', quick_meaning: '蓝色；绿色；年轻', register: 'neutral', tags: ['颜色'] },
  lines: {
    etymology: {
      original_sense: '本义为从矿井中采出的蓝色矿石，故字形从“生”从“丹”，后泛指蓝绿色。',
      senses_path: {
        primary: '蓝铜矿的颜色',
        extended: [
          { sense: '泛指蓝、绿等冷色', from: '矿石之色' },
          { sense: '年轻（青年、青春）', from: '草木初生之色' }
        ],
        figurative: '清廉、高洁（青天、青史）'
      },
      character_evolution: [
        { stage: '甲骨文', form: '上生下丹', meaning: '矿井中采出的矿石', note: '' },
        { stage: '小篆', form: '青', meaning: '沿用会意结构', note: '上“生”下“丹”' },
        { stage: '楷书', form: '青', meaning: '定型至今', note: '' },
        { stage: '简化字', form: '青', meaning: '未作简化', note: '' }
      ],
      components: [
        { part: '生（省形）', kind: 'semantic', meaning: '生长、初生', note: '兼表音' },
        { part: '丹', kind: 'semantic', meaning: '矿石之色', note: '本义来源' },
        { part: '月（讹变）', kind: 'component', meaning: '由“丹”讹变而来', note: '楷书中的下部' }
      ],
      multiple_readings: [
        { reading: 'qīng', meaning: '蓝绿色；年轻', example: '青山不老' }
      ],
      classical: {
        meanings: [
          { sense: '青色之物，如青草', example: '青，取之于蓝，而青于蓝。', source: '荀子·劝学' }
        ],
        usages: [
          { pattern: '名词作动词', example: '青，取之于蓝', gloss: '此处“青”指提取青色染料' }
        ]
      }
    },
    usage: {
      senses: [
        { pos: '名', definition: '蓝、绿、黑等冷色的总称', examples: [{ text: '青天', translation: '' }] },
        { pos: '形', definition: '年轻的，未成熟的', examples: [{ text: '青年', translation: '' }] }
      ],
      collocations: [
        { pattern: '青 + 名', meaning: '表颜色或年轻', typical_objects: ['青天', '青山', '青年'] },
        { pattern: '青于蓝', meaning: '出于蓝而胜于蓝', typical_objects: [] }
      ],
      usage_notes: ['现代汉语中“青”多用于书面语和固定搭配，口语里常换成“蓝”“绿”。']
    },
    distinction: {
      confusables: {
        theme: '表示蓝绿色的一组词',
        table: [
          { word: '青', meaning: '蓝绿黑的总称', note: '书面语色彩最重' },
          { word: '蓝', meaning: '蓝色', note: '专指蓝，不含绿' },
          { word: '绿', meaning: '绿色', note: '专指绿' }
        ],
        parallel_examples: [{ sentence: '青出于蓝而胜于蓝。', note: '“青”在此指靛青，比“蓝”更深' }],
        contrast_pairs: [{ a: '青春', a_meaning: '年轻时期', b: '青天', b_meaning: '晴朗的天空' }]
      },
      origin_allusion: {
        source: '荀子·劝学', author: '荀况',
        quote: '青，取之于蓝，而青于蓝。',
        meaning: '靛青从蓝草里提取，颜色却比蓝草更深。',
        note: '后用来比喻学生超过老师。'
      },
      then_and_now: {
        then: '指靛青染料，一种具体的颜色',
        now: '泛指蓝绿黑等冷色，并引申为年轻',
        note: '由染料之名泛化为颜色类别，再抽象为“未成熟”。'
      },
      cultural_notes: ['“青”在五行中对应东方与春天，因此有“青春”“青阳”之说。'],
      synthesis: ['字形来自矿井中的矿石，颜色是本义。', '草木初生之色引申出“年轻”。'],
      mnemonic: '“生”在上、“丹”在下：从矿井里采出的颜色。'
    }
  }
};

const JA_KANGO = {
  word: '成功', language: 'ja',
  overview: { word: '成功', language: 'ja', reading: 'せいこう', pos: '名', quick_meaning: '成功，达成目标', register: 'neutral', tags: ['結果'] },
  lines: {
    etymology: {
      nuance: '把该做的事做成了的那一瞬间，重点在“结果达成”，不强调努力过程。',
      word_stratum: 'kango',
      readings: {
        on: [
          { reading: 'せいこう', romaji: 'seikou', note: '最常用' },
          { reading: 'じょうごう', romaji: 'jougou', note: '佛教语境，指修行达成' }
        ],
        kun: [],
        special: []
      },
      kanji_origin: [
        { kanji: '成', formation: 'compound', formation_term: '会意', original_image: '以斧劈物而定其形', path: '由“定形”引申为“完成”。' },
        { kanji: '功', formation: 'phono-semantic', formation_term: '形声', original_image: '力（形旁）+ 工（声旁）', path: '尽力做事所得之效。' }
      ],
      components: [
        { part: '成', kind: 'semantic', meaning: '完成', note: '' },
        { part: '功', kind: 'semantic', meaning: '功业、成效', note: '形旁“力”表用力' }
      ],
      etymology: { chain: [], via: '', first_attested: '汉代已见', certainty: 'high', shift: '由“成就功业”收窄为“事情达成”。' },
      derived_pronunciation: [{ word: '成功裏に', reading: 'せいこうりに' }]
    },
    usage: {
      senses: [
        { pos: '名', definition: '事情按预期完成，达成目标', examples: [{ text: '実験は成功した。', translation: '实验成功了。' }] },
        { pos: '名', definition: '（佛教）修行达到境界', examples: [] }
      ],
      collocations: [
        { pattern: '成功する', meaning: '成功', typical_objects: [] },
        { pattern: '成功を収める', meaning: '获得成功', typical_objects: [] },
        { pattern: '〜に成功する', meaning: '在……上取得成功', typical_objects: ['実験に', '交渉に'] }
      ],
      usage_notes: ['「成功」是他动词性的サ変名詞，常接「〜に成功する」。', '反义词「失敗」，但「成功」不用于人本身，说“他是个成功者”要用「成功者」。']
    },
    distinction: {
      confusables: {
        theme: '表示“达到目标”的一组词',
        table: [
          { word: '成功', meaning: '成功', note: '最中性，只看结果' },
          { word: '達成', meaning: '达成', note: '偏书面，强调经过努力而实现' },
          { word: '実現', meaning: '实现', note: '强调由计划变为现实' }
        ],
        parallel_examples: [
          { sentence: '実験は成功した。', note: '只陈述结果' },
          { sentence: '目標を達成した。', note: '“達成”必须带宾语' }
        ],
        contrast_pairs: [
          { a: '成功する', a_meaning: '自动词用法，成功', b: '成功を収める', b_meaning: '较正式的固定说法' }
        ]
      },
      source_word: null,
      spelling_variants: [],
      cultural_notes: ['日语里“成功”常与“失敗”成对出现，用于实验、考试、谈判等具体事项。'],
      synthesis: ['“成”是定形，“功”是用力的结果。', '所以“成功”看的是事情定形，而不是人的品质。'],
      mnemonic: '成＝把事定形，功＝用力所得。'
    }
  }
};

const JA_GAIRAIGO = {
  word: 'アルバイト', language: 'ja',
  overview: { word: 'アルバイト', language: 'ja', reading: 'あるばいと', pos: '名', quick_meaning: '打工，兼职', register: 'neutral', tags: ['仕事'] },
  lines: {
    etymology: {
      nuance: '学生或非正式身份的、按小时计的临时工作，语感比「パート」更偏学生。',
      word_stratum: 'gairaigo',
      readings: { on: [], kun: [], special: [] },
      kanji_origin: [],
      components: [{ part: 'アルバイト', kind: 'component', meaning: '整体为借词，不可再分', note: '和制外来语的典型' }],
      etymology: { chain: [], via: '', first_attested: '明治时期', certainty: 'high', shift: '由德语“工作”变为日语特指“打工”。' },
      derived_pronunciation: []
    },
    usage: {
      senses: [{ pos: '名', definition: '按小时计酬的临时工作', examples: [{ text: 'コンビニでアルバイトをする。', translation: '在便利店打工。' }] }],
      collocations: [
        { pattern: 'アルバイトをする', meaning: '打工', typical_objects: [] },
        { pattern: 'アルバイト先', meaning: '打工的地方', typical_objects: [] }
      ],
      usage_notes: ['日常口语常缩为「バイト」。', '正式场合或长期职位用「パートタイム」而不是「アルバイト」。']
    },
    distinction: {
      confusables: {
        theme: '表示兼职工作的一组词',
        table: [
          { word: 'アルバイト', meaning: '打工', note: '多指学生、按小时计' },
          { word: 'パート', meaning: '兼职', note: '多指主妇、时间较长' },
          { word: '正社員', meaning: '正式员工', note: '与两者相对' }
        ],
        parallel_examples: [],
        contrast_pairs: []
      },
      source_word: { origin_language: 'German', original: 'Arbeit', literal: 'work', note: '日语把“工作”收窄为“临时工作”，语感与德语原词已不同。' },
      spelling_variants: [
        { form: 'バイト', note: '口语缩略，报纸与日常会话都常用' },
        { form: 'アルバイト', note: '正式书写形' }
      ],
      cultural_notes: ['“アルバイト”与“パート”的区分是日本劳动用语里的固定区别，选错会显得不了解语境。'],
      synthesis: ['借自德语 Arbeit，却只保留了“临时工作”的意思。', '所以日本学生说アルバイト，德国人听了会觉得范围窄得多。'],
      mnemonic: '德语的“工作”到日语里只剩“打工”。'
    }
  }
};

const SENTENCE = {
  text: 'Er hat sich darüber geärgert, dass sie nichts gesagt hat.',
  language: 'de',
  lines: {
    semantics: {
      translation: '他为她什么都没说而生气。',
      register: 'neutral，口语与书面皆可',
      word_by_word: [
        { form: 'Er', lemma: 'er', pos: 'Pron.', meaning: '他', note: '' },
        { form: 'hat', lemma: 'haben', pos: 'V.', meaning: '（助动词，构成完成时）', note: '第三人称单数' },
        { form: 'sich', lemma: 'sich', pos: 'Pron.', meaning: '自己', note: '反身代词，第四格' },
        { form: 'darüber', lemma: 'darüber', pos: 'Adv.', meaning: '对此', note: 'da(r)- + über，回指后文从句' },
        { form: 'geärgert', lemma: 'sich ärgern', pos: 'V.', meaning: '生气', note: '过去分词' },
        { form: 'dass', lemma: 'dass', pos: 'Konj.', meaning: '（引导从句）', note: '' },
        { form: 'sie', lemma: 'sie', pos: 'Pron.', meaning: '她', note: '' },
        { form: 'nichts', lemma: 'nichts', pos: 'Pron.', meaning: '什么也没', note: '' },
        { form: 'gesagt', lemma: 'sagen', pos: 'V.', meaning: '说', note: '过去分词' }
      ],
      chunks: [
        { chunk: 'sich über etwas ärgern', kind: 'collocation', meaning: '为某事生气', note: '介词 über 支配第四格' },
        { chunk: 'sich darüber ärgern, dass …', kind: 'fixed phrase', meaning: '为……而生气', note: 'da(r)- 提前预告从句' }
      ]
    },
    grammar: {
      structure: [
        { part: 'Er hat sich … geärgert', role: '主句（框架结构）', note: 'hat 在第二位，geärgert 在句末' },
        { part: 'dass sie nichts gesagt hat', role: '宾语从句', note: '动词 hat 位于从句末位' }
      ],
      grammar: [
        { point: 'Satzklammer 框型结构', explanation: '助动词 hat 占第二位，过去分词 geärgert 落到句末，中间夹住整个句子。', example: 'Er hat sich darüber geärgert.' },
        { point: 'Nebensatz mit Verb am Ende', explanation: 'dass 引导的从句中，变位动词必须放在最后一位。', example: 'dass sie nichts gesagt hat' },
        { point: 'Pronominaladverb dar-', explanation: '指代后文从句时用 da(r)- + 介词，而不是“über es”。', example: 'darüber, dass …' },
        { point: 'Perfekt mit haben', explanation: 'sich ärgern 用 haben 构成完成时，且是反身动词。', example: 'Ich habe mich geärgert.' }
      ],
      pitfalls: [
        { issue: '从句里把 hat 放到前面', explanation: '英语语序说 “that she has said nothing”，德语必须让 hat 落到从句末位。' }
      ],
      pattern: {
        template: 'X hat sich darüber geärgert, dass Y …',
        gloss: 'X 为 Y 而生气',
        substitutions: [
          { slot: 'X', options: ['Sie', 'Mein Vater', 'Die Nachbarn'] },
          { slot: 'Y', options: ['er zu spät kam', 'wir nichts gesagt haben', 'es geregnet hat'] }
        ],
        examples: [
          { text: 'Sie hat sich darüber geärgert, dass er zu spät kam.', translation: '她为他迟到而生气。' }
        ]
      },
      cultural_notes: []
    }
  }
};

/* ---------- Build ---------- */

const ns = createEnvironment();
const store = ns.store;

const enId = store.entryId('contend', 'en', 'deepseek-flash', 'en');
const zhId = store.entryId('青', 'zh', 'deepseek-flash', 'en');
const jaKangoId = store.entryId('成功', 'ja', 'deepseek-flash', 'en');
const jaGairaigoId = store.entryId('アルバイト', 'ja', 'deepseek-flash', 'en');
const sentId = store.sentenceId(SENTENCE.text, 'de', 'deepseek-flash', 'en');

store.saveEntry(Object.assign({ id: enId, schema: 3, kind: 'word', status: 'ok', ts: Date.now(), starred: true }, EN));
store.saveEntry(Object.assign({ id: zhId, schema: 3, kind: 'word', status: 'ok', ts: Date.now(), starred: true }, ZH));
store.saveEntry(Object.assign({ id: jaKangoId, schema: 3, kind: 'word', status: 'ok', ts: Date.now(), starred: true }, JA_KANGO));
store.saveEntry(Object.assign({ id: jaGairaigoId, schema: 3, kind: 'word', status: 'ok', ts: Date.now(), starred: true }, JA_GAIRAIGO));
store.saveEntry(Object.assign({ id: sentId, schema: 3, kind: 'sentence', status: 'ok', ts: Date.now() }, SENTENCE));

/* A few more favourites so the language grouping has something to show. */
[['Gift', 'de', '毒药；礼物（假朋友）'], ['flâner', 'fr', '闲逛，无所事事地漫步'], ['木漏れ日', 'ja', '树叶间洒下的阳光']]
  .forEach(([word, lang, gloss], i) => {
    const id = store.entryId(word, lang, 'deepseek-flash', 'en');
    store.saveEntry({
      id, schema: 3, kind: 'word', word, language: lang, status: 'ok',
      ts: Date.now() - (i + 1) * 3600e3,
      overview: { word, language: lang, reading: lang === 'ja' ? 'こもれび' : '', pos: 'n.', quick_meaning: gloss },
      lines: {}
    });
    store.toggleStar(id);
  });

const bookA = store.createWordbook('Hard words');
const bookB = store.createWordbook('Exam');
store.addToWordbook(bookA.id, enId);
store.addToWordbook(bookA.id, zhId);
store.addToWordbook(bookB.id, enId);

store.patchSettings({ apiKey: 'sk-preview-not-a-real-key', outputLang: 'en', queryLang: 'auto' });

const dictionary = container();
ns.views.dictionary.render(dictionary, {});

const enScreen = container();
ns.views.word.render(enScreen, { id: enId });

const zhScreen = container();
ns.views.word.render(zhScreen, { id: zhId });

const jaKangoScreen = container();
ns.views.word.render(jaKangoScreen, { id: jaKangoId });

const jaGairaigoScreen = container();
ns.views.word.render(jaGairaigoScreen, { id: jaGairaigoId });

const sentenceScreen = container();
ns.views.word.render(sentenceScreen, { id: sentId });

const favorites = container();
ns.views.favorites.render(favorites, {});

const profile = container();
ns.views.profile.render(profile, {});

/* A static strip of the three practice forms, mirroring what practice.js draws. */
function practiceDemo(answer, typed, status, practice) {
  const ns2 = ns;
  const ex = ns2.practice.createExercise({ word: practice === 'spell' ? answer : '', reading: practice === 'spell' ? '' : answer, practice });
  ns2.practice.applyInput(ex, typed);
  const want = ns2.practice.answerChars(ex);
  const given = ns2.practice.displayChars(ex);
  const marks = status === 'wrong' ? ns2.practice.judgeAnswer(ex).marks : null;
  let html = '<div class="spell-word" data-status="' + status + '">';
  for (let i = 0; i < want.length; i += 1) {
    if (status === 'input' && i === given.length) html += '<span class="spell-caret"></span>';
    const shown = i < given.length ? given[i] : '';
    let cls = 'spell-ch';
    if (status === 'correct') cls += ' is-ok';
    else if (marks) cls += marks[i] ? ' is-ok' : (shown ? ' is-bad' : ' is-missing');
    else cls += shown ? ' is-neutral' : ' is-empty';
    html += '<span class="' + cls + '">' + ns2.ui.esc(shown || '_') + '</span>';
  }
  html += '</div>';
  if (status === 'wrong') html += '<div class="spell-answer">' + ns2.ui.esc(want.join('')) + '</div>';
  return html;
}

const css = ['tokens.css', 'app.css']
  .map((file) => fs.readFileSync(path.join(WEB, 'assets', file), 'utf8')).join('\n');

function panel(title, note, body) {
  return '<section class="pv-panel"><div class="pv-head"><h2>' + title + '</h2><p>' + note + '</p></div>' +
    '<div class="app pv-frame"><main class="screen">' + body + '</main></div></section>';
}

const practicePanel =
  '<section class="pv-panel"><div class="pv-head"><h2>Practice — three forms</h2>' +
  '<p>同一套全屏层，按语言切换形式。这里去掉虚化背景以便并排展示。</p></div>' +
  '<div class="pv-spell">' +
    '<div class="pv-spell-cell"><span class="pv-tag">English · spell</span>' + practiceDemo('checker', 'checke', 'input', 'spell') + '</div>' +
    '<div class="pv-spell-cell"><span class="pv-tag">Chinese · pinyin</span>' + practiceDemo('qīng', 'qing', 'correct', 'pinyin') + '</div>' +
    '<div class="pv-spell-cell"><span class="pv-tag">Japanese · kana</span>' + practiceDemo('せいこう', 'seiko', 'wrong', 'kana') + '</div>' +
  '</div>' +
  '<div class="pv-spell-tools">' +
    '<button type="button" class="spell-btn">' + ns.ui.icon('close') + '</button>' +
    '<button type="button" class="spell-btn">' + ns.ui.icon('bulb') + '</button>' +
    '<button type="button" class="spell-btn">' + ns.ui.icon('check') + '</button>' +
  '</div></section>';

const html = [
  '<!DOCTYPE html>', '<html lang="en" data-theme="auto">', '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>Radicle 3.0 — design preview</title>',
  '<style>', css,
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
  '.pv-spell-cell { flex: 1 1 240px; background: var(--card); border: 1px solid var(--separator-soft); border-radius: 18px; padding: 30px 16px; display: flex; flex-direction: column; align-items: center; gap: 14px; position: relative; }',
  '.pv-tag { position: absolute; top: 10px; left: 12px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3); }',
  '.pv-spell-cell .spell-word { font-size: 30px; }',
  '.pv-spell-tools { display: flex; justify-content: center; gap: 90px; margin-top: 20px; }',
  '.pv-note { margin-top: 40px; padding: 16px 18px; border-radius: 14px; background: var(--fill); font-size: 13px; color: var(--text-2); line-height: 1.55; }',
  '</style>', '</head>', '<body>', '<div class="pv-wrap">',
  '<div class="pv-title">Radicle 3.0 — design preview</div>',
  '<p class="pv-sub">Sample data for five languages. No API key, no network, no tokens spent.</p>',
  panel('1 · Dictionary', '语言选择器（Auto + 五语）与 Word / Sentence 模式切换，历史记录留在本页，收藏夹已独立。', dictionary.innerHTML),
  panel('2 · Entry — English', '英语词条的完整卡片集：语义内核、词源时间轴、构词分解、词根家族、假同源词、派生词发音、辨析表。', enScreen.innerHTML),
  panel('3 · Entry — Chinese', '中文词条换成另一套卡：字源演变、字形分解、本义与引申、多音字、古今异义、古汉语用法。标题为英文并带母语小注。', zhScreen.innerHTML),
  panel('4 · Entry — Japanese, kango', '漢語词：語感、語種、読み、漢字の成り立ち、字形分解。同一个「成功」在日语里两套读音，卡片直接给出区别。', jaKangoScreen.innerHTML),
  panel('5 · Entry — Japanese, gairaigo', '外来语自动换卡：不再出现漢字の成り立ち与読み，改出原詞与表記のゆれ。这就是「按词形自适应」的实际效果。', jaGairaigoScreen.innerHTML),
  panel('6 · Sentence analysis', '德语句子：语义线（翻译／逐词／固定搭配）与语法线（结构／语法点／易错点／句式模板）。语法点针对德语的框型结构与从句动词末位。', sentenceScreen.innerHTML),
  panel('7 · Favourites', '按语言主分类，单词本跨语言挂在顶部；来源选择器同时决定练习池与下方列表。', favorites.innerHTML),
  practicePanel,
  panel('9 · Profile', '解释语言可选全部五种可查语言，默认英文；界面本身始终是英文。', profile.innerHTML),
  '<div class="pv-note">这是用 Node 直接渲染真实视图模块生成的静态页面，用来在沒有 Key 的情况下检查版式。' +
  '真实查询的数据由 DeepSeek 返回，字段结构一致但内容不同。深浅色随系统主题切换。</div>',
  '</div>', '</body>', '</html>'
].join('\n');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log('preview written to ' + path.relative(path.join(V3, '..'), OUT) +
  '  (' + (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' KB)');
