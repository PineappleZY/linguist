/* Regenerate STRINGS.md from web/js/strings.js.

   The table is deliberately mechanical: one row per key, five columns in the
   same order as the source. The preamble is hand-written, because its job is to
   tell a native-speaker reviewer where to look first. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'web', 'js', 'strings.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const table = sandbox.window.LINGUIST.strings;
const langs = ['en', 'zh', 'fr', 'de', 'ja'];
const enKeys = Object.keys(table.en);

for (const lang of langs) {
  const keys = Object.keys(table[lang]);
  const missing = enKeys.filter((key) => !keys.includes(key));
  if (keys.length !== enKeys.length || missing.length) {
    throw new Error(`strings.js: ${lang} is missing ${missing.join(', ') || 'keys'}`);
  }
}

const version = (() => {
  const text = fs.readFileSync(path.join(root, 'web', 'js', 'config.js'), 'utf8');
  const match = text.match(/version:\s*'([^']+)'/);
  return match ? match[1] : '';
})();

const cell = (value) => String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');

const lines = [
  `# Linguist ${version} — 界面文案对照表`,
  '',
  `这份表是 \`web/js/strings.js\` 的直接产物（\`node tools/strings-md.mjs\` 重新生成），供你或母语者复核。共 **${enKeys.length} 条 × 5 种语言**。`,
  '',
  '**怎么用**：切到某一语言后，可能觉得某句不像该语言的人会说的话——直接在表里指出 key 与建议改法即可，我会改 `strings.js`（改一行，五个语言各自独立）。',
  '',
  '**6.5 最没把握的几处**：',
  '',
  '| key | 我的顾虑 |',
  '| --- | --- |',
  '| `practice.replayLocked` | 「先用一次提示」要够短（扬声器的 title）又不至于像报错；德语与法语容易变长 |',
  '| `theme.auto` / `theme.light` / `theme.dark` | 三个主题名在各语言里的常用度；德语 „Automatisch" 偏长，是否该用 „System" |',
  '| `model.flash.hint` / `model.pro.hint` | 「1M 上下文」的写法：100 万 / 1 Mio. / 1 M，以及破折号后的卖点是否自然 |',
  '| `field.via` / `field.attested` / `field.certainty` | 词源事实的三个标签；法语 « Première attestation » 是否过长，德语 „Belegt seit" 是否更惯用 |',
  '| `field.on` / `field.kun` / `field.special` | 日语读音的三个小标题：英语用 On/Kun readings，法语 « Lectures on » 是否够自然，或该直接留「音読み / 訓読み」 |',
  '| `entry.irregularComparison` | 比较级提示要短、要像注释而不是报错 |',
  '| `app.description` | 名字在五种语言里都写成 `Linguist`（刻意的）。简介按各自惯用写法重写 |',
  '',
  `| key | English | 中文 | Français | Deutsch | 日本語 |`,
  `| --- | --- | --- | --- | --- | --- |`,
];

for (const key of enKeys) {
  const values = langs.map((lang) => cell(table[lang][key]));
  lines.push(`| \`${key}\` | ${values.join(' | ')} |`);
}

fs.writeFileSync(path.join(root, 'STRINGS.md'), `${lines.join('\n')}\n`, 'utf8');
console.log(`STRINGS.md: ${enKeys.length} keys × ${langs.length} languages`);
