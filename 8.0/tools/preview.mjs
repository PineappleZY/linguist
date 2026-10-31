/* LINGUIST 6.5 — static design preview.

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
  /* The vendored pdf.js is skipped: it is browser code that expects a real
     window, and nothing in a preview needs it. The File panel renders without
     it — the module feature-detects. */
  scriptOrder().filter((file) => !file.startsWith('vendor/')).forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(WEB, file), 'utf8'), sandbox, { filename: file });
  });
  return sandbox.window.LINGUIST;
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
      core_meaning: '努力与对手争夺同一目标，或在分歧中坚持自己的说法。',
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
    },
    inflection: {
      word_profile: {
        pos: 'verb', subtype: 'regular transitive verb', transitivity: 'transitive and intransitive',
        countability: null, aspect: null, auxiliary: 'have', frequency: 'B2',
        must_memorise: ['contend with 的宾语是困难，不是人。', '过去分词 contended 不双写 d。'],
        note: '不及物时的搭配决定它说的是“争夺”还是“对付”。'
      },
      noun_forms: null,
      adjective_forms: null,
      conjugation: {
        principal_parts: { base: 'contend', third_person: 'contends', past: 'contended', participle: 'contended', gerund: 'contending' },
        class: 'regular', auxiliary: 'have',
        tenses: [
          { mood: 'indicative', tense: 'present', forms: [
            { person: 'I', form: 'contend' }, { person: 'you', form: 'contend' },
            { person: 'he / she', form: 'contends' }, { person: 'we', form: 'contend' },
            { person: 'you (pl.)', form: 'contend' }, { person: 'they', form: 'contend' } ] },
          { mood: 'indicative', tense: 'past', forms: [
            { person: 'I', form: 'contended' }, { person: 'you', form: 'contended' },
            { person: 'he / she', form: 'contended' }, { person: 'we', form: 'contended' },
            { person: 'you (pl.)', form: 'contended' }, { person: 'they', form: 'contended' } ] },
          { mood: 'indicative', tense: 'present perfect', forms: [
            { person: 'I', form: 'have contended' }, { person: 'you', form: 'have contended' },
            { person: 'he / she', form: 'has contended' }, { person: 'we', form: 'have contended' },
            { person: 'you (pl.)', form: 'have contended' }, { person: 'they', form: 'have contended' } ] },
          { mood: 'indicative', tense: 'present continuous', forms: [
            { person: 'I', form: 'am contending' }, { person: 'you', form: 'are contending' },
            { person: 'he / she', form: 'is contending' }, { person: 'we', form: 'are contending' },
            { person: 'you (pl.)', form: 'are contending' }, { person: 'they', form: 'are contending' } ] },
          { mood: 'indicative', tense: 'future (will)', forms: [
            { person: 'I', form: 'will contend' }, { person: 'you', form: 'will contend' },
            { person: 'he / she', form: 'will contend' }, { person: 'we', form: 'will contend' },
            { person: 'you (pl.)', form: 'will contend' }, { person: 'they', form: 'will contend' } ] }
        ],
        irregular: [], note: '英语几乎没有人称变化，只有第三人称单数加 -s。'
      },
      comparison: null,
      pronouns: null,
      government: {
        items: [
          { pattern: 'contend for', case: null, meaning: '为……而争夺', example: 'Three clubs are contending for the title.' },
          { pattern: 'contend with', case: null, meaning: '对付（困难、处境）', example: 'We had to contend with heavy rain.' },
          { pattern: 'contend that', case: null, meaning: '坚决主张……', example: 'She contends that the rule is illegal.' }
        ],
        clitics: null, note: '介词决定词义：for 是争夺，with 是对付，that 是主张。'
      }
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

const IT = {
  word: 'cosa', language: 'it',
  overview: { word: 'cosa', language: 'it', reading: '/ˈkɔza/', pos: 's. f.', quick_meaning: '东西；事情', register: 'neutral', tags: ['sostantivo'] },
  lines: {
    etymology: {
      core_meaning: '泛指不特指的事物，也可指某个具体的东西；与表示原因的 causa 同源而分工不同。',
      etymology: {
        chain: [
          { stage: 'Latin', language: 'latino', form: 'causa', meaning: '原因，理由', date: '' },
          { stage: 'Vulgar Latin', language: 'latino volgare', form: 'causa', meaning: '事情，事由', date: '' },
          { stage: 'Old Italian', language: 'italiano antico', form: 'cosa', meaning: '事情；东西', date: '13c' }
        ],
        via: 'latino volgare', first_attested: '13c', certainty: 'high',
        shift: '由“原因”泛指“事情”，再弱化为“东西”——泛指义把原义挤到了边缘。'
      },
      morphology: {
        breakdown: [{ part: 'cosa', type: 'root', form_note: '来自 causa 的通俗形', meaning: '原因 → 事情', origin: 'latino' }],
        root_variants: [{ form: 'caus-', note: '学者形保留在 causa 一词中' }],
        composition: ''
      },
      root_family: {
        direct: [],
        shared_root: [
          { word: 'causa', gloss: '原因；诉讼', formula: 'causa（学者形，原义）' },
          { word: 'causare', gloss: '引起', formula: 'causa + -are' },
          { word: 'accusare', gloss: '指控', formula: 'ad- + causa + -are' }
        ]
      },
      derived_pronunciation: [{ word: 'causa', ipa: '/ˈkauza/' }],
      false_cognates: [
        { word: 'causa', actual_origin: '同一拉丁词根', note: '不是假同源，而是同一个词根的学者形——这组是 doublets 而非 false friends。' },
        { word: 'factory', actual_origin: 'Latin factorium', note: '英语 fattoria 才是假朋友：意大利语 fattoria 是农庄，不是工厂。' }
      ]
    },
    usage: {
      senses: [
        { pos: 's. f.', definition: '不指名的具体物体，相当于英语的 thing', examples: [{ text: 'Che cosa è questo?', translation: '这是什么？' }] },
        { pos: 's. f.', definition: '事情、情况', examples: [{ text: 'Le cose vanno bene.', translation: '情况不错。' }] }
      ],
      collocations: [
        { pattern: 'che cosa', meaning: '什么（疑问）', typical_objects: ['che cosa vuoi?'] },
        { pattern: 'qualcosa', meaning: '某物；某事', typical_objects: [] },
        { pattern: 'ogni cosa', meaning: '每一样东西', typical_objects: [] }
      ],
      usage_notes: ['口语里 che cosa 常缩成 cosa 或 che。', '指人时不用 cosa，要用 chi 或 persona。'],
      gender_number: null
    },
    inflection: {
      word_profile: {
        pos: 'sostantivo', subtype: 'nome comune femminile', countability: 'numerabile',
        transitivity: null, aspect: null, auxiliary: null, frequency: 'A1',
        must_memorise: ['复数 le cose，冠词随之从 la 变 le。', '指人时不能用它，要用 chi 或 persona。'],
        note: '因为高频，它的原义“原因”几乎被自己的泛化吃掉了。'
      },
      noun_forms: {
        gender: 'femminile', article: 'la', plural: 'le cose',
        article_forms: [
          { context: 'Determinativo singolare', form: 'la cosa' },
          { context: 'Determinativo plurale', form: 'le cose' },
          { context: 'Indeterminativo singolare', form: 'una cosa' },
          { context: 'Partitivo', form: 'delle cose' }
        ],
        declension: [],
        irregular: ['无：-a → -e 的规则阴性变化。'],
        note: '意大利语名词没有格，变的是性与数，以及必须跟着变的冠词。'
      },
      adjective_forms: null,
      conjugation: null,
      comparison: null,
      pronouns: null,
      government: null
    },
    distinction: {
      confusables: {
        theme: '表示“东西／事情”的一组词',
        table: [
          { word: 'cosa', meaning: '东西；事情', note: '最泛，几乎什么都能指' },
          { word: 'oggetto', meaning: '物体', note: '只指具体实物，不能指事情' },
          { word: 'faccenda', meaning: '事务', note: '多指要处理的事，带负担感' }
        ],
        parallel_examples: [
          { sentence: 'Che cosa fai?', note: '中性、日常' },
          { sentence: 'Che faccenda è?', note: '把这件事说得更重' }
        ],
        contrast_pairs: [{ a: 'qualcosa', a_meaning: '某事（不定）', b: 'che cosa', b_meaning: '什么（疑问）' }]
      },
      doublets: [
        { popular: 'cosa', learned: 'causa', latin: 'causa', difference: '通俗形泛指“东西”，学者形保留“原因、诉讼”的原义。' }
      ],
      cultural_notes: ['“Cosa”在意大利语里的高频程度接近英语的 thing，因此它的原义几乎被自身的泛化吃掉了。'],
      synthesis: ['拉丁语 causa 本指“原因”。', '通俗拉丁把它用成了“事由、事情”。', '到了意大利语，它再退一步，成了万能的“东西”。'],
      mnemonic: '越常用的词越容易被用空：causa（原因）→ cosa（东西）。'
    }
  }
};

const ES = {
  word: 'azúcar', language: 'es',
  overview: { word: 'azúcar', language: 'es', reading: '/aˈθukaɾ/', pos: 's. m./f.', quick_meaning: '糖', register: 'neutral', tags: ['arabismo'] },
  lines: {
    etymology: {
      core_meaning: '指糖这一物质，作可数名词时指一块或一份；来自阿拉伯语，定冠词 al- 已并入词形。',
      etymology: {
        chain: [
          { stage: 'Arabic', language: 'árabe', form: 'as-sukkar', meaning: '糖', date: '' },
          { stage: 'Andalusian Arabic', language: 'árabe andalusí', form: 'as-súkkar', meaning: '糖', date: '' },
          { stage: 'Old Spanish', language: 'español antiguo', form: 'açúcar', meaning: '糖', date: '13c' },
          { stage: 'Modern Spanish', language: 'español', form: 'azúcar', meaning: '糖', date: '15c' }
        ],
        via: 'árabe andalusí', first_attested: '13c', certainty: 'high',
        shift: '语音上 az- 取代了 al-（后者受后接 -s- 影响），词义几乎未变，但从此成了西语里最典型的阿拉伯借词。'
      },
      morphology: {
        breakdown: [
          { part: 'az-', type: 'prefix', form_note: '阿拉伯语定冠词 al- 的变体，在 -s- 前同化', meaning: '定冠词，已失去功能', origin: 'árabe' },
          { part: 'úcar', type: 'root', meaning: '糖', origin: 'árabe sukkar' }
        ],
        root_variants: [{ form: 'suc-', note: '出现在学术词中，如 sacarosa（蔗糖）' }],
        composition: 'al-（定冠词）+ sukkar（糖）→ azúcar：冠词被冻结在词里'
      },
      root_family: {
        direct: [
          { word: 'azucarado', pos: 'adj.', gloss: '加糖的，甜的', formula: 'azúcar + -ado', examples: [] },
          { word: 'azucarera', pos: 's. f.', gloss: '糖罐', formula: 'azúcar + -era', examples: [] }
        ],
        shared_root: [
          { word: 'sacarosa', gloss: '蔗糖（化学术语）', formula: 'sacar- + -osa' },
          { word: 'azucarillo', gloss: '糖块', formula: 'azúcar + -illo' }
        ]
      },
      derived_pronunciation: [{ word: 'azucarero', ipa: '/aθukaˈɾeɾo/' }],
      false_cognates: [
        { word: 'sugar', actual_origin: 'Germanic + Arabic', note: '英语 sugar 与它同源于阿拉伯语 sukkar，但绕道中世纪拉丁语与古法语，不算假朋友。' }
      ]
    },
    usage: {
      senses: [{ pos: 's. m./f.', definition: '白色结晶的甜味调味品，即糖', examples: [{ text: 'Echa azúcar al café.', translation: '往咖啡里加点糖。' }] }],
      collocations: [
        { pattern: 'azúcar moreno', meaning: '红糖', typical_objects: [] },
        { pattern: 'sin azúcar', meaning: '无糖', typical_objects: [] }
      ],
      usage_notes: ['阴阳性两可：el azúcar / la azúcar，复数统一用 los azúcares。', '这是极少数仍保留冠词痕迹的阿拉伯借词，现代使用者不再意识到 az- 是冠词。'],
      gender_number: null
    },
    inflection: {
      word_profile: {
        pos: 'sustantivo', subtype: 'nombre común, ambiguo en género', countability: 'contable',
        transitivity: null, aspect: null, auxiliary: null, frequency: 'A1',
        must_memorise: ['单数 el azúcar 或 la azúcar 都行。', '复数一律 los azúcares，不随单数变化。'],
        note: '以 -ar 结尾却按阳性复数走，是阿拉伯借词留下的例外。'
      },
      noun_forms: {
        gender: 'masculino o femenino', article: 'el / la', plural: 'los azúcares',
        article_forms: [
          { context: 'Definite singular', form: 'el azúcar / la azúcar' },
          { context: 'Definite plural', form: 'los azúcares' },
          { context: 'Indefinite singular', form: 'un azúcar / una azúcar' },
          { context: 'Indefinite plural', form: 'unos azúcares' }
        ],
        declension: [],
        irregular: ['复数 los azúcares 不随单数阴阳性改变。', '同类：el arte / las artes。'],
        note: '西班牙语名词没有格，可变的部分只有性、数与冠词。'
      },
      adjective_forms: null,
      conjugation: null,
      comparison: null,
      pronouns: null,
      government: null
    },
    distinction: {
      confusables: {
        theme: '表示甜味剂的一组词',
        table: [
          { word: 'azúcar', meaning: '糖', note: '日常用词，最泛' },
          { word: 'azúcar glas', meaning: '糖粉', note: '特指研磨后的' },
          { word: 'edulcorante', meaning: '甜味剂', note: '不含糖，指代糖' }
        ],
        parallel_examples: [],
        contrast_pairs: []
      },
      arabismos: [
        { word: 'azúcar', arabic: 'as-sukkar', meaning: '糖', note: 'al- 在 -s- 前同化为 az-，冠词彻底冻结在词里。' },
        { word: 'alcohol', arabic: 'al-kuḥl', meaning: '锑粉（原义）', note: '原指化妆用的锑粉，经炼金术转指酒精。' },
        { word: 'almohada', arabic: 'al-muḫadda', meaning: '枕头', note: 'al- 完整保留。' },
        { word: 'ojalá', arabic: 'law šāʾ allāh', meaning: '如果真主愿意', note: '整句浓缩成一个词，且已完全世俗化。' }
      ],
      cultural_notes: ['西班牙语约有四千个阿拉伯来源的词，其中多数集中在农业、建筑与日常器物，因此一看就知道哪一层是外来。'],
      synthesis: ['阿拉伯语把 sugár 连冠词一起给了西班牙语。', '所以 azúcar 里的 az- 不是词根，是一个已经退休的 the。'],
      mnemonic: 'az- 是阿拉伯语的 the：azúcar、almohada、alcohol，都是“那个……”。'
    }
  }
};

const ES_VERB = {
  word: 'estar', language: 'es',
  overview: { word: 'estar', language: 'es', reading: '/esˈtaɾ/', pos: 'v.', quick_meaning: '在（某处）；处于（某状态）', register: 'neutral', tags: ['verbo'] },
  lines: {
    usage: {
      senses: [
        { pos: 'v.', definition: '表示所处的位置', examples: [{ text: 'Estoy en casa.', translation: '我在家。' }] },
        { pos: 'v.', definition: '表示临时的状态或情况', examples: [{ text: 'Estoy cansado.', translation: '我累了。' }] }
      ],
      collocations: [
        { pattern: 'estar en', meaning: '在（地点）', typical_objects: ['casa', 'el trabajo'] },
        { pattern: 'estar + gerundio', meaning: '正在做', typical_objects: ['estoy comiendo'] }
      ],
      usage_notes: ['estar 描述状态与位置，ser 描述本质与身份。', '形容词与 ser/estar 搭配会改变含义：ser listo（聪明）／estar listo（准备好了）。'],
      ser_estar: {
        ser: '本质、身份、固有属性：Es español. / Es alto.',
        estar: '状态、位置、暂时情况：Está en Madrid. / Está cansado.',
        note: '同一个形容词两边都能用，意思就分叉：ser aburrido 是“无趣的人”，estar aburrido 是“觉得无聊”。'
      }
    },
    inflection: {
      word_profile: {
        pos: 'verbo', subtype: 'verbo irregular de la primera conjugación', transitivity: 'intransitive and copular',
        countability: null, aspect: 'stative', auxiliary: 'haber', frequency: 'A1',
        must_memorise: ['过去时不规则：estuve, estuviste, estuvo…', '与 ser 的分工决定意思，不只是语法。'],
        note: '它承担“状态”这一半，ser 承担“本质”那一半。'
      },
      noun_forms: null,
      adjective_forms: null,
      conjugation: {
        class: '-ar', auxiliary: 'haber', participle: 'estado', gerund: 'estando',
        tenses: [
          { mood: 'indicativo', tense: 'presente', forms: [
            { person: 'yo', form: 'estoy' }, { person: 'tú', form: 'estás' },
            { person: 'él', form: 'está' }, { person: 'nosotros', form: 'estamos' },
            { person: 'vosotros', form: 'estáis' }, { person: 'ellos', form: 'están' } ] },
          { mood: 'indicativo', tense: 'pretérito indefinido', forms: [
            { person: 'yo', form: 'estuve' }, { person: 'tú', form: 'estuviste' },
            { person: 'él', form: 'estuvo' }, { person: 'nosotros', form: 'estuvimos' },
            { person: 'vosotros', form: 'estuvisteis' }, { person: 'ellos', form: 'estuvieron' } ] },
          { mood: 'indicativo', tense: 'imperfecto', forms: [
            { person: 'yo', form: 'estaba' }, { person: 'tú', form: 'estabas' },
            { person: 'él', form: 'estaba' }, { person: 'nosotros', form: 'estábamos' },
            { person: 'vosotros', form: 'estabais' }, { person: 'ellos', form: 'estaban' } ] },
          { mood: 'subjuntivo', tense: 'presente', forms: [
            { person: 'yo', form: 'esté' }, { person: 'tú', form: 'estés' },
            { person: 'él', form: 'esté' }, { person: 'nosotros', form: 'estemos' },
            { person: 'vosotros', form: 'estéis' }, { person: 'ellos', form: 'estén' } ] }
        ],
        irregular: ['过去时词干 estuv-：estuve, estuviste, estuvo, estuvimos, estuvieron。', '重音几乎全部落在词尾。'],
        note: '第二、三人称拼写带重音符号，写漏了就是另一个时态。'
      },
      comparison: null,
      pronouns: null,
      government: {
        items: [
          { pattern: 'estar en', case: null, meaning: '在（某地）', example: 'Estoy en casa.' },
          { pattern: 'estar + gerundio', case: null, meaning: '正在做', example: 'Estoy comiendo.' },
          { pattern: 'estar de', case: null, meaning: '以某身份／状态临时担任', example: 'Está de camarero.' }
        ],
        clitics: '代词前置：me estoy cansando / se está cansando。',
        note: 'estar 不需要介词就能带形容词，但带地点要用 en。'
      }
    },
    distinction: {
      confusables: {
        theme: '表示“是／在”的两个动词',
        table: [
          { word: 'estar', meaning: '状态与位置', note: '可变的、暂时的' },
          { word: 'ser', meaning: '本质与身份', note: '固有的、定义性的' },
          { word: 'haber', meaning: '存在（hay）', note: '只用于无人称存在句' }
        ],
        parallel_examples: [
          { sentence: 'Es alegre.', note: '性格开朗' },
          { sentence: 'Está alegre.', note: '眼下很高兴' }
        ],
        contrast_pairs: [{ a: 'ser listo', a_meaning: '聪明', b: 'estar listo', b_meaning: '准备好了' }]
      },
      cultural_notes: [],
      synthesis: ['estar 说“眼下如何”，ser 说“本来是什么”。', '西语把这两件事当成两个词，学它的人就得把一句话拆成两问：本质，还是状态？'],
      mnemonic: 'ser 是 identity，estar 是 status。'
    }
  }
};

/* ---------- The inflection line: the longest paradigm, and the case table ---------- */

const FR_VERB = {
  word: 'aller', language: 'fr',
  overview: { word: 'aller', language: 'fr', reading: '/a.le/', pos: 'v.', quick_meaning: '去；前往；（身体）处于……状况', register: 'neutral', tags: ['mouvement', 'irrégulier'] },
  lines: {
    etymology: {
      core_meaning: '表示朝某处移动，引申指身体或事情的状况如何。',
      etymology: {
        chain: [
          { stage: 'Latin', language: 'Latin', form: 'ire / vadere / ambulare', meaning: '去／迈步／行走', date: '' },
          { stage: 'Gallia', language: 'latin vulgaire', form: 'alare', meaning: '走', date: '5–8c' },
          { stage: 'Old French', language: 'ancien français', form: 'aler', meaning: '去', date: '10c' },
          { stage: 'Modern French', language: 'français', form: 'aller', meaning: '去', date: '15c' }
        ],
        via: 'latin vulgaire', first_attested: '10c', certainty: 'medium',
        shift: '关键不在词义，而在词干：aller 是法语里唯一由三个不同拉丁词干拼出来的动词，所以变位才如此破碎。'
      },
      morphology: {
        breakdown: [
          { part: 'all-', type: 'root', form_note: '来自 ambulare，只出现在 je vais 之外的多数形式里', meaning: '走', origin: 'Latin ambulare' },
          { part: 'v-', type: 'root', form_note: '来自 vadere 的 vado', meaning: '迈步', origin: 'Latin vadere' }
        ],
        root_variants: [
          { form: 'all-', note: '不定式与复数人称：aller, nous allons' },
          { form: 'v-', note: '直陈现在三单与三复：je vais, ils vont' },
          { form: 'i-', note: '将来时与条件式：j\'irai, j\'irais' }
        ],
        composition: 'ir-（去）+ vad-（迈步）+ ambul-（行走）→ aller：一个词里住着三个动词'
      },
      root_family: {
        direct: [
          { word: 'allée', pos: 'n. f.', gloss: '小径；走道', formula: 'aller + -ée', examples: [] },
          { word: 'allure', pos: 'n. f.', gloss: '步态；速度', formula: 'aller + -ure', examples: [] }
        ],
        shared_root: [
          { word: 'ambulance', gloss: '救护车', formula: 'ambulare + -ance' },
          { word: 'ambulant', gloss: '走动的；流动的', formula: 'ambulare + -ant' },
          { word: 'itinerary', gloss: '路线', formula: 'iter (journey) + -ary' },
          { word: 'exit', gloss: '出口', formula: 'ex- + ire' }
        ]
      },
      derived_pronunciation: [
        { word: 'allée', ipa: '/a.le/' },
        { word: 'allure', ipa: '/a.lyʁ/' }
      ],
      false_cognates: [
        { word: 'aller (English)', actual_origin: 'English all + -er', note: '英语的 allers 与法语 aller 毫无关系。' }
      ]
    },
    usage: {
      senses: [
        { pos: 'v.', definition: '从一处移动到另一处，即“去”', examples: [{ text: 'Je vais à Paris demain.', translation: '我明天去巴黎。' }] },
        { pos: 'v.', definition: '与副代词或形容词连用，表示健康状况', examples: [{ text: 'Comment allez-vous ?', translation: '您身体怎么样？' }] },
        { pos: 'v.', definition: '作为半助动词，构成最近将来时', examples: [{ text: 'Il va pleuvoir.', translation: '要下雨了。' }] }
      ],
      collocations: [
        { pattern: 'aller à', meaning: '去（某地）', typical_objects: ['Paris', 'la plage', 'l\'école'] },
        { pattern: 'aller bien', meaning: '身体好；合适', typical_objects: ['ça va bien', 'la robe te va bien'] },
        { pattern: 'aller + infinitif', meaning: '即将做', typical_objects: ['aller voir', 'aller chercher'] },
        { pattern: 's\'en aller', meaning: '离开', typical_objects: ['je m\'en vais'] }
      ],
      usage_notes: [
        'aller 的助动词是 être，不是 avoir，且过去分词要跟主语性数配合：elle est allée。',
        's\'en aller 是独立的代动词，命令式有 va-t\'en / allez-vous-en 这样的特殊形。'
      ]
    },
    inflection: {
      word_profile: {
        pos: 'verbe', subtype: 'verbe du 3e groupe, irrégulier, à trois radicaux',
        transitivity: 'intransitif et semi-auxiliaire', countability: null,
        aspect: null, auxiliary: 'être', frequency: 'A1',
        must_memorise: [
          '过去时用 être，不是 avoir：Je suis allé。',
          '过去分词与主语性数配合：elle est allée / elles sont allées。',
          '将来时与条件式换成 i- 词干：j\'irai, j\'irais。',
          '直陈现在三单三复是 v- 词干：je vais, ils vont。'
        ],
        note: '三套词干各有各的来历，所以它只能背，不能推。'
      },
      noun_forms: null,
      adjective_forms: null,
      conjugation: {
        class: '3e groupe', auxiliary: 'être', participle: 'allé', gerund: 'en allant',
        tenses: [
          { mood: 'indicatif', tense: 'présent', forms: [
            { person: 'je', form: 'vais' }, { person: 'tu', form: 'vas' }, { person: 'il / elle', form: 'va' },
            { person: 'nous', form: 'allons' }, { person: 'vous', form: 'allez' }, { person: 'ils / elles', form: 'vont' } ] },
          { mood: 'indicatif', tense: 'imparfait', forms: [
            { person: 'j\'', form: 'allais' }, { person: 'tu', form: 'allais' }, { person: 'il / elle', form: 'allait' },
            { person: 'nous', form: 'allions' }, { person: 'vous', form: 'alliez' }, { person: 'ils / elles', form: 'allaient' } ] },
          { mood: 'indicatif', tense: 'futur simple', forms: [
            { person: 'j\'', form: 'irai' }, { person: 'tu', form: 'iras' }, { person: 'il / elle', form: 'ira' },
            { person: 'nous', form: 'irons' }, { person: 'vous', form: 'irez' }, { person: 'ils / elles', form: 'iront' } ] },
          { mood: 'conditionnel', tense: 'présent', forms: [
            { person: 'j\'', form: 'irais' }, { person: 'tu', form: 'irais' }, { person: 'il / elle', form: 'irait' },
            { person: 'nous', form: 'irions' }, { person: 'vous', form: 'iriez' }, { person: 'ils / elles', form: 'iraient' } ] },
          { mood: 'subjonctif', tense: 'présent', forms: [
            { person: 'que j\'', form: 'aille' }, { person: 'que tu', form: 'ailles' }, { person: 'qu\'il / elle', form: 'aille' },
            { person: 'que nous', form: 'allions' }, { person: 'que vous', form: 'alliez' }, { person: 'qu\'ils / elles', form: 'aillent' } ] },
          { mood: 'impératif', tense: 'présent', forms: [
            { person: '(tu)', form: 'va' }, { person: '(nous)', form: 'allons' }, { person: '(vous)', form: 'allez' } ] },
          { mood: 'indicatif', tense: 'passé composé', forms: [
            { person: 'je', form: 'suis allé(e)' }, { person: 'tu', form: 'es allé(e)' }, { person: 'il / elle', form: 'est allé(e)' },
            { person: 'nous', form: 'sommes allé(e)s' }, { person: 'vous', form: 'êtes allé(e)(s)' }, { person: 'ils / elles', form: 'sont allé(e)s' } ] }
        ],
        irregular: [
          '直陈现在：v- 词干（vais, vas, va, vont），其余 all-。',
          '将来时与条件式：i- 词干（irai, irais）。',
          '虚拟式：aill- 词干（aille, ailles, aillent）。',
          '命令式只有三个人称，第二人称单数在 -er 动词般的规则下去掉 -s：va，且 va-t\'en。'
        ],
        note: '它在法语里是唯一一个由三套拉丁词干拼成的动词，所以每个时态都要单独记。'
      },
      comparison: null,
      pronouns: null,
      government: {
        items: [
          { pattern: 'aller à + lieu', case: null, meaning: '去某地', example: 'Je vais à Lyon.' },
          { pattern: 'aller en + pays féminin', case: null, meaning: '去某国（阴性国名）', example: 'Elle va en France.' },
          { pattern: 'aller chez + personne', case: null, meaning: '去某人那里', example: 'Nous allons chez le médecin.' },
          { pattern: 'aller + infinitif', case: null, meaning: '即将做（最近将来时）', example: 'Je vais partir.' }
        ],
        clitics: 'y 可以替代地点：J\'y vais.',
        note: '地点介词取决于名词的性与数：à Paris、au Japon、en France、aux États-Unis。'
      }
    },
    distinction: {
      confusables: {
        theme: '表示移动的一组动词',
        table: [
          { word: 'aller', meaning: '去', note: '强调离开与目的地' },
          { word: 'venir', meaning: '来', note: '朝说话人方向移动' },
          { word: 'partir', meaning: '出发、离开', note: '强调离开，不强调目的' },
          { word: 'se rendre', meaning: '前往', note: '书面、正式，行政文体常用' }
        ],
        parallel_examples: [
          { sentence: 'Je vais à Paris.', note: '中性，日常' },
          { sentence: 'Je me rends à Paris.', note: '正式，报告或公文' }
        ],
        contrast_pairs: [
          { a: 'aller bien', a_meaning: '身体好', b: 'bien aller', b_meaning: '（衣服）合适' }
        ]
      },
      cultural_notes: ['“Ça va ?”是法语里最省事的问候语，回答也是 “Ça va.”——它把 aller 从“去”里抽出来，只剩一个社会功能。'],
      synthesis: ['拉丁语的“走”与“去”在俗拉丁语里合并。', '合并得不彻底，于是三个词干都留在了变位里。', '今天它是最高频的动词之一，也是最不规则的一个。'],
      mnemonic: 'aller 的变位像三股绳：all-、v-、i-，记住绳子来自哪里，就不会把它们搅错。'
    }
  }
};

const DE_NOUN = {
  word: 'Gift', language: 'de',
  overview: { word: 'Gift', language: 'de', reading: '/ɡɪft/', pos: 'Substantiv', quick_meaning: '毒，毒药', register: 'neutral', tags: ['Falscher Freund', 'Substantiv'] },
  lines: {
    etymology: {
      core_meaning: '指有毒之物；与 geben「给予」同源，本义是“所给之物”，后专指有害的那一种。',
      etymology: {
        chain: [
          { stage: 'PIE', language: 'Urgermanisch', form: '*geftiz', meaning: '给予', date: '' },
          { stage: 'Old High German', language: 'Althochdeutsch', form: 'gift', meaning: '给予；馈赠', date: '8c' },
          { stage: 'Middle High German', language: 'Mittelhochdeutsch', form: 'gift', meaning: '馈赠；也有“毒药”义', date: '12c' },
          { stage: 'Modern German', language: 'Neuhochdeutsch', form: 'Gift', meaning: '毒药', date: '16c' }
        ],
        via: 'Althochdeutsch', first_attested: '8c', certainty: 'high',
        shift: '古高地德语里 gift 泛指“给予”，与英语 gift 完全同义；到近代德语，中性名词 Gift 的“馈赠”一义被 Mitgift、Ausgabe 等词分走，只剩“毒药”一义。'
      },
      morphology: {
        breakdown: [
          { part: 'geb-', type: 'root', form_note: 'geben 的词根，与英语 give 同源', meaning: '给', origin: 'Germanisch *geban' },
          { part: '-t', type: 'suffix', form_note: '原始日耳曼语的名词后缀 *-iz', meaning: '动作的结果', origin: 'Germanisch' }
        ],
        root_variants: [
          { form: 'gift-', note: '现代德语基本形：Gift, giftig, vergiften' },
          { form: 'geb-', note: '同根动词仍在：geben, Gabe, Aufgabe' }
        ],
        composition: 'geb-（给）+ -t（结果）→ “给出去的东西”→ 后来专门指毒药'
      },
      root_family: {
        direct: [
          { word: 'giftig', pos: 'Adj.', gloss: '有毒的', formula: 'Gift + -ig', examples: [] },
          { word: 'vergiften', pos: 'V.', gloss: '下毒；毒害', formula: 'ver- + Gift + -en', examples: [] },
          { word: 'Mitgift', pos: 'N.', gloss: '嫁妆', formula: 'mit + Gift', examples: [] }
        ],
        shared_root: [
          { word: 'geben', gloss: '给', formula: 'geb- + -en' },
          { word: 'Gabe', gloss: '赠礼；天赋', formula: 'geb- + -e' },
          { word: 'Aufgabe', gloss: '任务；放弃', formula: 'auf- + Gabe' },
          { word: 'gift', gloss: '礼物（英语）', formula: '古英语 gift, 同源' }
        ]
      },
      derived_pronunciation: [
        { word: 'giftig', ipa: '/ˈɡɪftɪç/' },
        { word: 'vergiften', ipa: '/fɛɐ̯ˈɡɪftn̩/' }
      ],
      false_cognates: [
        { word: 'gift (English)', actual_origin: 'Old Norse gift / Old English gift', note: '与德语 Gift 同源，但一个是“礼物”，一个是“毒药”——教科书级的假朋友。' },
        { word: 'Mitgift', actual_origin: 'mit + Gift', note: '它还保留着“馈赠”的旧义，说明这个义项没有消失，只是搬了家。' }
      ]
    },
    usage: {
      senses: [
        { pos: 'N.', definition: '能致伤或致死的物质，即毒药', examples: [{ text: 'Das ist ein starkes Gift.', translation: '这是一种烈性毒药。' }] },
        { pos: 'N.', definition: '比喻义：有害的东西或言论', examples: [{ text: 'Seine Worte waren Gift für sie.', translation: '他的话对她来说是毒药。' }] }
      ],
      collocations: [
        { pattern: 'ein Gift nehmen', meaning: '服毒', typical_objects: ['Gift', 'Tabletten'] },
        { pattern: 'Gift und Galle spucken', meaning: '暴跳如雷，口出恶言', typical_objects: [] },
        { pattern: 'auf etwas Gift nehmen', meaning: '（口语）对某物极其执着', typical_objects: [] }
      ],
      usage_notes: ['德语 Gift 是中性：das Gift；奥地利德语里还有“肥料”的旧义。', '复数 die Gifte 多指不同种类的毒物，日常更常说 das Gift。']
    },
    inflection: {
      word_profile: {
        pos: 'Substantiv', subtype: 'starkes Substantiv, neutral', transitivity: null,
        countability: 'überwiegend im Singular', aspect: null, auxiliary: null, frequency: 'B1',
        must_memorise: [
          'das Gift 是毒药，英语 gift 是礼物——同源却相反。',
          '属格是 des Giftes，不是 des Gifts（-es 结尾）。',
          '复数 die Gifte 指不同种类的毒物。'
        ],
        note: '词的性别与它看起来的样子无关：以 -t 结尾的中性名词要单独记。'
      },
      noun_forms: {
        gender: 'das', article: 'das', plural: 'die Gifte',
        article_forms: [
          { context: 'Bestimmt Singular', form: 'das Gift' },
          { context: 'Bestimmt Plural', form: 'die Gifte' },
          { context: 'Unbestimmt', form: 'ein Gift' },
          { context: 'Verneinung', form: 'kein Gift' }
        ],
        declension: [
          { case: 'Nominativ', singular: 'das Gift', plural: 'die Gifte' },
          { case: 'Akkusativ', singular: 'das Gift', plural: 'die Gifte' },
          { case: 'Dativ', singular: 'dem Gift(e)', plural: 'den Giften' },
          { case: 'Genitiv', singular: 'des Giftes', plural: 'der Gifte' }
        ],
        irregular: ['属格单数要加 -es（des Giftes），与单音节名词同规。', '奥地利用 Gift 表示“肥料”，与德国用法不同。'],
        note: '四个格里只有属格单数和第三格复数改形，其余靠冠词扛。'
      },
      adjective_forms: null,
      conjugation: null,
      comparison: null,
      pronouns: null,
      case_government: [
        { pattern: 'Gift für + Akkusativ', example: 'Gift für die Haut', note: '固定搭配用 für 加第四格。' }
      ],
      separable_prefixes: null
    },
    distinction: {
      confusables: {
        theme: '与“毒／药”相关的一组词',
        table: [
          { word: 'Gift', meaning: '毒药', note: '最泛，可指一切毒物' },
          { word: 'Giftstoff', meaning: '有毒物质', note: '化学、技术语境' },
          { word: 'Medikament', meaning: '药物', note: '中性，无贬义' },
          { word: 'Droge', meaning: '毒品；药物', note: '多指成瘾性物质' }
        ],
        parallel_examples: [
          { sentence: 'Das ist Gift.', note: '致命之物' },
          { sentence: 'Das ist ein Medikament.', note: '治病之物，语气完全不同' }
        ],
        contrast_pairs: [
          { a: 'Gift', a_meaning: '毒药', b: 'Mitgift', b_meaning: '嫁妆（同一个 gift）' }
        ]
      },
      lautverschiebung: [
        { english: 'gift', german: 'Gift', shift: '同形同源，义反', note: '古英语与古高地德语都指“给予之物”；英语保留“礼物”，德语滑向“毒药”。' },
        { english: 'give', german: 'geben', shift: 'g ↔ g, v ↔ b', note: '同源动词，说明 Gift 的词根确实是“给”。' }
      ],
      cultural_notes: ['德语里 Gift 与英语 gift 的这层反转，是最常被引用的假朋友例子，也因此频繁出现在德语教学的入门材料里。'],
      synthesis: ['日耳曼语的 *geftiz 意思是“给出去的东西”。', '英语让它留在“礼物”这一侧。', '德语让它变成“毒药”——同一个动作，接受者最不想要的结果。'],
      mnemonic: 'Gift 和 gift 只差一个字母大小写：英语的礼物到了德语，成了礼物里最坏的那种。'
    }
  }
};

/* The adjective keeps the noun's root, so only the overview and the forms differ. */
const DE_ADJ = Object.assign({}, DE_NOUN, {
  word: 'giftig',
  overview: { word: 'giftig', language: 'de', reading: '/ˈɡɪftɪç/', pos: 'Adjektiv', quick_meaning: '有毒的；（口语）恶毒的', register: 'neutral', tags: ['Adjektiv', 'Ableitung'] },
  lines: Object.assign({}, DE_NOUN.lines, {
    inflection: {
      word_profile: {
        pos: 'Adjektiv', subtype: 'denominales Adjektiv, Ableitung von Gift', transitivity: null,
        countability: null, aspect: null, auxiliary: null, frequency: 'B1',
        must_memorise: [
          '作表语永不变形：Das ist giftig。',
          '作定语时要按冠词类型加词尾：das giftige Gas。',
          '口语里也指“恶毒的”：eine giftige Bemerkung。'
        ],
        note: '德语形容词只有作定语才变形，这一条决定了整张词尾表。'
      },
      noun_forms: null,
      adjective_forms: {
        position: 'predicative (invariable) and attributive (declined)',
        agreement: [],
        endings: [
          { pattern: 'weak, after der/die/das', ending: '-e (Nom. Sg. alle Genera) / -en (sonst)' },
          { pattern: 'mixed, after ein/kein/mein', ending: '-e / -en, mit starker Form im Nom. Sg.' },
          { pattern: 'strong, without an article', ending: '-es / -e / -er / -en / -em' },
          { pattern: 'plural, after die or without article', ending: '-en / -e' }
        ],
        special: [
          '动词的过去分词同样按这套词尾变化：das vergiftete Wasser。',
          '由名词派生的形容词（giftig, freundlich）不加比较级以外的特殊形式。'
        ],
        note: '词尾由前面的冠词决定，不由形容词本身决定，所以这张表是每学一个新形容词都要回来查的。'
      },
      conjugation: null,
      comparison: {
        comparative: 'giftiger', superlative: 'am giftigsten', absolute: null, irregular: false,
        note: '常规加 -er / am -sten，无元音变音。'
      },
      pronouns: null,
      case_government: [
        { pattern: 'giftig für + Akkusativ', example: 'giftig für Insekten', note: '介词支配第四格。' }
      ],
      separable_prefixes: null
    }
  })
});

const SENTENCE = {
  word: 'Er hat sich darüber geärgert…',
  text: 'Er hat sich darüber geärgert, dass sie nichts gesagt hat.',
  language: 'de',
  overview: { status: 'ok', language: 'de', quick_meaning: '他为她什么都没说而生气。' },
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

/* The app's default interface language is Chinese now; the preview pins English
   so every panel that is not deliberately showing another language reads the
   same way, and the two language panels switch explicitly. */
store.patchSettings({ uiLang: 'en' });

const enId = store.entryId('contend', 'en', 'deepseek-flash', 'en');
const zhId = store.entryId('青', 'zh', 'deepseek-flash', 'en');
const jaKangoId = store.entryId('成功', 'ja', 'deepseek-flash', 'en');
const jaGairaigoId = store.entryId('アルバイト', 'ja', 'deepseek-flash', 'en');
const sentId = store.sentenceId(SENTENCE.text, 'de', 'deepseek-flash', 'en');
const itId = store.entryId('cosa', 'it', 'deepseek-flash', 'zh');
const esId = store.entryId('azúcar', 'es', 'deepseek-flash', 'zh');
const esVerbId = store.entryId('estar', 'es', 'deepseek-flash', 'zh');
const frVerbId = store.entryId('aller', 'fr', 'deepseek-flash', 'zh');
const deNounId = store.entryId('Gift', 'de', 'deepseek-flash', 'zh');
const deAdjId = store.entryId('giftig', 'de', 'deepseek-flash', 'zh');
const OUTPUT = 'zh';

const day = 86400000;
const seed = (id, data, extra) => Object.assign(
  { id, schema: 5, kind: 'word', status: 'ok', ts: Date.now() }, data, extra || {}
);

store.saveEntry(seed(enId, EN, { starred: true }));
store.saveEntry(seed(zhId, ZH, { starred: true }));
store.saveEntry(seed(jaKangoId, JA_KANGO, { starred: true }));
store.saveEntry(seed(jaGairaigoId, JA_GAIRAIGO, { starred: true, ts: Date.now() - day }));
store.saveEntry(seed(itId, IT, { starred: true }));
store.saveEntry(seed(esId, ES, { starred: true, ts: Date.now() - day * 2 }));
store.saveEntry(seed(esVerbId, ES_VERB, { starred: true, ts: Date.now() - day * 9 }));
store.saveEntry(seed(frVerbId, FR_VERB, { starred: true }));
store.saveEntry(seed(deNounId, DE_NOUN, { starred: true }));
store.saveEntry(seed(deAdjId, DE_ADJ, { starred: true, ts: Date.now() - day }));
/* A sentence is a favourite too, so the German group shows both kinds. */
store.saveEntry(seed(sentId, SENTENCE, { kind: 'sentence', starred: true }));

/* A few more favourites so the language grouping has something to show. */
[['Gift', 'de', '毒药；礼物（假朋友）'], ['flâner', 'fr', '闲逛，无所事事地漫步'], ['木漏れ日', 'ja', '树叶间洒下的阳光']]
  .forEach(([word, lang, gloss], i) => {
    const id = store.entryId(word, lang, 'deepseek-flash', 'en');
    store.saveEntry({
      id, schema: 4, kind: 'word', word, language: lang, status: 'ok',
      ts: Date.now() - (i + 1) * 3600e3,
      overview: { word, language: lang, reading: lang === 'ja' ? 'こもれび' : '', pos: 'n.', quick_meaning: gloss },
      lines: {}
    });
    store.toggleStar(id);
  });

/* An entry from before 4.2 whose language was never recorded — the case that
   used to show up as an "AUTO" group. */
const orphanId = 'oror--auto--deepseek-flash--zh';
store.saveEntry({
  id: orphanId, schema: 4, kind: 'word', word: '寂し', language: '', status: 'ok',
  ts: Date.now() - 7200e3, overview: {}, lines: {}
});
store.toggleStar(orphanId);

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

const frVerbScreen = container();
ns.views.word.render(frVerbScreen, { id: frVerbId });

const deNounScreen = container();
ns.views.word.render(deNounScreen, { id: deNounId });

/* The same German noun again, with the genitive opened, to check what an
   unfolded case table actually looks like against the surface. */
const deNounOpenScreen = container();
ns.views.word.render(deNounOpenScreen, { id: deNounId });
ns.session.formsOpen['conjugation:0'] = true;

const deAdjScreen = container();
ns.views.word.render(deAdjScreen, { id: deAdjId });

/* The longest paradigm in the app: seven tenses, one of them with five persons
   where the other six have six. */
const frVerbOpenScreen = container();
ns.views.word.render(frVerbOpenScreen, { id: frVerbId });
ns.session.formsOpen = {};
['0', '1', '2', '3', '4', '5', '6'].forEach((i) => { ns.session.formsOpen['conjugation:' + i] = true; });
ns.views.word.render(frVerbOpenScreen, { id: frVerbId });
ns.session.formsOpen = {};
ns.views.word.render(deNounOpenScreen, { id: deNounId });

const favorites = container();
ns.views.favorites.render(favorites, {});

/* A second rendering with one group folded, to check what a folded heading
   looks like next to an open one. */
const favoritesFolded = container();
ns.session.collapsedGroups = { 'lang:it': true };
ns.views.favorites.render(favoritesFolded, {});
ns.session.collapsedGroups = {};

/* One language as the practice source: the middle tier of the picker. The list
   and the pencil's pool are narrowed together, so a round cannot mix languages. */
ns.session.favoritesSource = 'lang:ja';
const favoritesJa = container();
ns.views.favorites.render(favoritesJa, {});
ns.session.favoritesSource = 'all';

const profile = container();
ns.views.profile.render(profile, {});

/* The interface in another language. The copy lives in web/js/strings.js and
   is written per language rather than translated word for word, so the layout
   has to be checked with the real strings — Chinese is the shortest of the
   five and French the longest. */
store.patchSettings({ uiLang: 'zh' });
const dictZh = container();
ns.views.dictionary.render(dictZh, {});
const entryFr = container();
store.patchSettings({ uiLang: 'fr' });
ns.views.word.render(entryFr, { id: enId });
store.patchSettings({ uiLang: 'auto' });

/* ---------- 6.0 panels ---------- */

/* File mode, after a file has been chosen: the reader sees what was found —
   the length, the number of requests it will cost — before anything is spent.
   The language is the reader's own statement, never a guess. */
ns.session.mode = 'file';
ns.session.file = {
  name: 'aufsatz.pdf', size: 244000, state: 'ready', pages: 6,
  text: 'x'.repeat(24880), chars: 24880, chunks: 1
};
ns.session.fileLang = 'de';
const dictFile = container();
ns.views.dictionary.render(dictFile, {});
ns.session.mode = 'auto';
ns.session.file = null;
ns.session.fileLang = '';

/* A document that has been read: outline, translation, glossary, register.
   The four cards come from the assembled parts, not from a single answer. */
const DOC_TEXT = 'Ein Essay über Wörter und ihre Wurzeln. '.repeat(40);
const docId = store.documentId('aufsatz.txt', DOC_TEXT, 'de', 'deepseek-flash', 'en');
store.saveEntry({
  id: docId, schema: 5, kind: 'document', word: 'aufsatz.txt', name: 'aufsatz.txt',
  input: 'aufsatz.txt', text: DOC_TEXT, language: 'de', status: 'ok', ts: Date.now(),
  model: 'deepseek-flash', outputLang: 'en', sourceLangArg: 'de', starred: true,
  parts: [
    { index: 1, data: { summary: ['Wörter tragen ihre Herkunft in sich.'], translation: 'Words carry their origin inside them.', vocabulary: [{ term: 'Wurzel', reading: '/ˈvʊʁtsl̩/', meaning: 'root', example: 'ihre Wurzeln' }], register: { genre: 'Essay', register: 'formal', period: 'contemporary', notes: [] } } },
    { index: 2, data: { summary: ['Die Herkunft erklärt die heutige Bedeutung.'], translation: 'That origin explains the meaning they have today.', vocabulary: [{ term: 'Herkunft', reading: '/ˈheːɐ̯kʊnft/', meaning: 'origin', example: 'ihre Herkunft' }], register: {} } }
  ],
  merged: {
    summary: ['Wörter tragen ihre Herkunft in sich.', 'Die Herkunft erklärt die heutige Bedeutung.',
      'Wer die Wurzel kennt, muss weniger auswendig lernen.'],
    register: { genre: 'Essay', register: 'formal', period: 'contemporary', notes: ['Sachlich, mit erklärendem Ton.'] }
  },
  lines: {
    document: {
      summary: ['Wörter tragen ihre Herkunft in sich.', 'Die Herkunft erklärt die heutige Bedeutung.',
        'Wer die Wurzel kennt, muss weniger auswendig lernen.'],
      translation: 'Words carry their origin inside them.\n\nThat origin explains the meaning they have today.',
      vocabulary: [
        { term: 'Wurzel', reading: '/ˈvʊʁtsl̩/', meaning: 'root', example: 'ihre Wurzeln' },
        { term: 'Herkunft', reading: '/ˈheːɐ̯kʊnft/', meaning: 'origin', example: 'ihre Herkunft' }
      ],
      register: { genre: 'Essay', register: 'formal', period: 'contemporary', notes: ['Sachlich, mit erklärendem Ton.'] },
      parts: 2, total: 2
    }
  },
  overview: { status: 'ok', language: 'de', reading: '', quick_meaning: 'Wörter tragen ihre Herkunft in sich.' }
});
const docScreen = container();
ns.views.word.render(docScreen, { id: docId });

/* The card preferences, and what they do. The same English entry is rendered
   twice: once as it ships, once with four cards hidden and one pulled to the
   front — the sequence on the page is the only thing that changes. */
const prefGroupOpen = { latin: true };
store.patchSettings({ cardPrefs: {} });
ns.session.openPrefGroups = prefGroupOpen;
const profileCards = container();
ns.views.profile.render(profileCards, {});
ns.session.openPrefGroups = {};

store.patchSettings({
  cardPrefs: { latin: { order: ['mnemonic'], hidden: ['collocations', 'culture', 'synthesis', 'pronunciation'] } }
});
const enPrefsScreen = container();
ns.views.word.render(enPrefsScreen, { id: enId });
store.patchSettings({ cardPrefs: {} });

/* The same section with the interface in Chinese: the card names follow the
   interface language here, and only here — the entry page keeps its
   "English · native term" title. */
store.patchSettings({ uiLang: 'zh' });
ns.session.openPrefGroups = { latin: true };
const profileCardsZh = container();
ns.views.profile.render(profileCardsZh, {});
ns.session.openPrefGroups = {};
store.patchSettings({ uiLang: 'en' });

/* The preview panel for card preferences should show that section, not the
   account/key/model screens above it. Cut from the Cards heading to the next
   section heading. */
function sectionOf(html, label) {
  const marker = '<div class="group-label">' + label + '</div>';
  const start = html.indexOf(marker);
  if (start < 0) return html;
  const next = html.indexOf('<div class="group-label">', start + marker.length);
  return html.slice(start, next < 0 ? html.length : next);
}

/* A static strip of the three practice forms, mirroring what practice.js draws. */

/* A static strip of the three practice forms, mirroring what practice.js draws. */
function practiceDemo(answer, typed, status, practice, prompt) {
  const ns2 = ns;
  const ex = ns2.practice.createExercise({ word: practice === 'spell' ? answer : '', reading: practice === 'spell' ? '' : answer, practice });
  ns2.practice.applyInput(ex, typed);
  const want = ns2.practice.answerChars(ex);
  const given = ns2.practice.displayChars(ex);
  const marks = status === 'wrong' ? ns2.practice.judgeAnswer(ex).marks : null;
  let html = '';
  /* The prompt — part of speech and meaning — is on screen from the first
     frame now, rather than behind the hint button. */
  if (prompt) {
    html += '<div class="spell-prompt"><span class="spell-pos">' + ns2.ui.esc(prompt.pos) +
      '</span><span class="spell-meaning">' + ns2.ui.esc(prompt.meaning) + '</span></div>';
  }
  html += '<div class="spell-word" data-status="' + status + '">';
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

/* `id` gives each panel a fragment target, so a single screen can be
   screenshotted headlessly (`preview.html#p-fr-forms`) instead of reading the
   whole page at once. */
function panel(title, note, body, id) {
  return '<section class="pv-panel"' + (id ? ' id="' + id + '"' : '') + '>' +
    '<div class="pv-head"><h2>' + title + '</h2><p>' + note + '</p></div>' +
    '<div class="app pv-frame"><main class="screen">' + body + '</main></div></section>';
}

const practicePanel =
  '<section class="pv-panel" id="p-practice"><div class="pv-head"><h2>14 · Practice — three forms</h2>' +
  '<p>进入一道题就直接看到词性与释义（按该源语言设定的解释语言）；灯泡第一级给音标，中文给声调、日语给拍数——提示永不泄露答案。' +
  '整组练习里顶栏右上角是「跳过当前词」，一组练完会回到第一个被跳过的词；左下角的 × 始终是退出。跳过的词在进度点里留一个淡点。</p></div>' +
  '<div class="pv-spell">' +
    '<div class="pv-spell-cell"><span class="pv-tag">English · spell</span>' +
      practiceDemo('checker', 'checke', 'input', 'spell', { pos: 'n.', meaning: '检查程序；检验员' }) + '</div>' +
    '<div class="pv-spell-cell"><span class="pv-tag">Chinese · pinyin</span>' +
      practiceDemo('qīng', 'qing', 'correct', 'pinyin', { pos: '形', meaning: 'blue; green' }) + '</div>' +
    '<div class="pv-spell-cell"><span class="pv-tag">Japanese · kana</span>' +
      practiceDemo('せいこう', 'seiko', 'wrong', 'kana', { pos: '名', meaning: 'success' }) + '</div>' +
  '</div>' +
  '<div class="pv-spell-tools">' +
    '<button type="button" class="spell-btn">' + ns.ui.icon('close') + '</button>' +
    '<button type="button" class="spell-btn">' + ns.ui.icon('bulb') + '</button>' +
    '<button type="button" class="spell-btn">' + ns.ui.icon('check') + '</button>' +
  '</div></section>';

const panels = [
  panel('1 · Dictionary', '语言选择器现在是一个按钮（点开是底部动作面板），旁边是 Surprise 骰子。历史留在本页，带搜索、按日期折叠与总开关。', dictionary.innerHTML, 'p-dict'),
  panel('2 · Entry — English, verb', '四个分组标题：Word DNA / Meaning / Forms / Context。词根块紧接头卡且共用一个容器，释义在它之后。工具栏左侧是解释语言选择器（底部动作面板），右侧仍只有一个 Collapse all。', enScreen.innerHTML, 'p-en'),
  panel('3 · Entry — Chinese', '中文词条换成另一套卡：字源演变、字形分解、本义与引申、多音字、古今异义、古汉语用法。标题为英文并带母语小注。', zhScreen.innerHTML),
  panel('4 · Entry — Japanese, kango', '漢語词：語感、語種、読み、漢字の成り立ち、字形分解。同一个「成功」在日语里两套读音，卡片直接给出区别。', jaKangoScreen.innerHTML),
  panel('5 · Entry — Japanese, gairaigo', '外来语自动换卡：不再出现漢字の成り立ち与読み，改出原詞与表記のゆれ。这就是「按词形自适应」的实际效果。', jaGairaigoScreen.innerHTML),
  panel('6 · Entry — French verb, forms open', 'Forms 组全开的样子：七个时态逐人称，命令式只有三个人称，复合时态带助动词与配合。这就是把整张变位表摊开后的最长形态。', frVerbOpenScreen.innerHTML, 'p-fr-forms'),
  panel('7 · Entry — German noun', '德语名词卡：性别、冠词、复数，下面接四格变格表。德语是唯一有格的语言，所以只有它有这张表。', deNounScreen.innerHTML, 'p-de-noun'),
  panel('8 · Entry — German adjective', '由 Gift 派生的 giftig：德语形容词作表语不变形，作定语按冠词类型加词尾，所以卡里给的是 weak / mixed / strong 三套词尾，而不是性数一致。', deAdjScreen.innerHTML, 'p-de-adj'),
  panel('9 · Sentence analysis', '德语句子：语义线（翻译／逐词／固定搭配）与语法线（结构／语法点／易错点／句式模板）。句子卡同样带母语小注，并分 Meaning / Grammar 两组。', sentenceScreen.innerHTML),
  panel('10 · Favourites', '按语言主分类，语言里再分 Words / Sentences；句子也能收藏。语言没被识别出来的旧条目列在最上方、标着 Language unknown，不再冒充一种叫 Auto 的语言。', favorites.innerHTML, 'p-fav'),
  panel('11 · Favourites, one group folded', '每个语言标题与 Wordbooks 都能单独收起，右上角的总开关一次翻全部；折叠后标题仍显示条数。', favoritesFolded.innerHTML, 'p-fav-folded'),
  panel('11b · Starred — one language', '练习来源多了语言这一层：选 日本語 后，下面的列表只剩日语的星标条目，铅笔也只从这些词里抽——一轮五个词不会再跨语言。', favoritesJa.innerHTML, 'p-fav-ja'),
  practicePanel,
  panel('12 · Profile', '解释语言可选全部七种可查语言，显示各语言的母语名，默认中文；数据区按风险分成 Backup 与 Reset 两组。词条页顶部的解释语言下拉与这里是同一份设置。', profile.innerHTML),
  panel('13 · Dictionary — interface in Chinese', '界面语言与解释语言是两条独立的轴。这里界面是中文（查词、历史、按钮全部中文化），而词条内容仍按每种源语言各自的默认解释语言生成。', dictZh.innerHTML, 'p-dict-zh'),
  panel('14 · Entry — interface in French', '同一份词典换成法文界面：卡片的英文类别名保持英文 + 源语言术语（那是学习术语，不随界面语言翻译），而按钮、分组标题、提示与免责声明全部是法文。', entryFr.innerHTML, 'p-entry-fr'),
  panel('15 · File mode', '第四个查询类型。选定文件后先读文本、报出字数与预计请求数，再要求指明文件语言——语言绝不由模型猜。下方一行是隐私提示：文本会随你自己的 Key 发给 DeepSeek，本机之外不留副本。', dictFile.innerHTML, 'p-file'),
  panel('16 · A document, read', '一份文件读完后的样子：概要给出全局脉络，译文按段顺序拼接，词汇表已去重，文体卡说明体裁、语体与年代。分块读取时标题栏会显示第几块，并给出中途停止与继续的入口。', docScreen.innerHTML, 'p-doc'),
  panel('17 · Profile — Cards', '只列该组真正会出现的卡（英法德 25 张，而不是整个目录的 40 张）。每行可隐藏、上移、下移，或一键置顶；分组标题行右侧的「恢复默认」收起时也在。三个语言族与句子分析各存一套，默认就是当前顺序。', sectionOf(profileCards.innerHTML, ns.ui.t('profile.section.cards')), 'p-cards'),
  panel('18 · The same entry, trimmed', '把上面那套偏好作用到同一个英语词条上：Collocations、Culture、Synthesis、Pronunciation 不再出现，Mnemonic 被提到最前。分组标题跟着过滤后的顺序走，不会留下空段落。', enPrefsScreen.innerHTML, 'p-prefs'),
  panel('19 · Cards, interface in Chinese', '同一处换成中文界面：卡名随界面语言（义项 / 搭配 / 核心义 …），而词条页的卡标题仍是「英文 · 母语术语」。每个分组标题行右侧都常驻一个「恢复本组」，收起时也在。', sectionOf(profileCardsZh.innerHTML, ns.strings.zh['profile.section.cards']), 'p-cards-zh'),
];

/* `--panel <id>` writes one panel on its own. A headless screenshot of the
   whole page lands on whatever fits the viewport, and fragments do not scroll
   reliably in headless mode, so the way to look at a single screen is to give
   it a page of its own. */
const focusIndex = process.argv.indexOf('--panel');
const focus = focusIndex > -1 ? process.argv[focusIndex + 1] : null;
const chosen = focus
  ? panels.filter((markup) => markup.indexOf('id="' + focus + '"') > -1)
  : panels;
const knownIds = panels.map((markup) => (/id="([^"]+)"/.exec(markup) || [])[1]).filter(Boolean);
if (focus && !chosen.length) {
  console.error('no panel with id "' + focus + '". Known ids: ' + knownIds.join(', '));
  process.exit(1);
}

const html = [
  '<!DOCTYPE html>', '<html lang="en" data-theme="auto">', '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>Linguist 8.1.2 — design preview</title>',
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
  '<div class="pv-title">Linguist 8.1.2 — design preview</div>',
  '<p class="pv-sub">Sample data for the five languages in use: the word-root-first reading order, the practice prompt and its skip round, card preferences in the interface language, the practice source by language, File mode and the document page. No API key, no network, no tokens spent.</p>'
].concat(chosen, [
  '<div class="pv-note">这是用 Node 直接渲染真实视图模块生成的静态页面，用来在沒有 Key 的情况下检查版式。' +
  '真实查询的数据由 DeepSeek 返回，字段结构一致但内容不同。深浅色随系统主题切换。</div>',
  '</div>', '</body>', '</html>'
]).join('\n');

const outPath = focus ? path.join(V3, 'dist', 'preview-panel.html') : OUT;
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html, 'utf8');
console.log('preview written to ' + path.relative(path.join(V3, '..'), outPath) +
  '  (' + (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' KB)');
