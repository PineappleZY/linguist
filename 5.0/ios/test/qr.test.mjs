/* Regression test for the QR encoder in ios/qrcode.mjs.
 *
 * The encoder was verified against an independent decoder (jsQR, the library
 * most scanner apps are built on) before any of these values were written
 * down: fourteen payloads — LAN URLs, tunnel URLs, a bare letter, UTF-8 text —
 * at three pixel scales each, all decoded back to the exact input. This test
 * locks that output so a later refactor cannot quietly change the codes that
 * people scan with a phone camera.
 *
 *   node ios/test/qr.test.mjs
 */

import { createHash } from 'node:crypto';
import { encode, toSvg, toTerminal } from '../qrcode.mjs';

let passed = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
  } else {
    failures.push(label + (detail ? ' — ' + detail : ''));
    console.log('  FAIL ' + label + (detail ? ' — ' + detail : ''));
  }
}

function digest(qr) {
  const bits = qr.modules.map((row) => row.map((cell) => (cell ? '1' : '0')).join('')).join('');
  return createHash('sha256').update(bits).digest('hex').slice(0, 16);
}

function section(name) {
  console.log('\n' + name);
}

/* ---------- what the caller gets ---------- */

section('version and level selection');

const expectations = [
  { text: 'x', version: 1, level: 'M', size: 21 },
  { text: 'http://10.141.235.23:5173/', version: 2, level: 'M', size: 25 },
  { text: 'https://linguist.example.com/', version: 3, level: 'M', size: 29 },
  { text: 'https://random-name-1234.trycloudflare.com/', version: 4, level: 'M', size: 33 },
  /* Level M runs out of room at version 4, so the encoder steps down to L
     rather than refusing to print a code for a long tunnel URL. */
  { text: 'https://thenameisquiteabitlongerthanmost-but-still-short.enough.example.com/', version: 4, level: 'L', size: 33 }
];

for (const expectation of expectations) {
  const qr = encode(expectation.text);
  check('"' + expectation.text.slice(0, 40) + '" is version ' + expectation.version +
    ' at level ' + expectation.level,
    qr.version === expectation.version && qr.level === expectation.level && qr.size === expectation.size,
    'v' + qr.version + qr.level + ' size ' + qr.size);
}

check('a payload too long for version 4 is reported, not truncated',
  (() => {
    try {
      encode('https://' + 'a'.repeat(200) + '.example.com/');
      return false;
    } catch (err) {
      return /does not fit/.test(err.message);
    }
  })());

/* ---------- golden matrices ---------- */

section('golden matrices (jsQR-verified output)');

const goldens = [
  { text: 'x', mask: 4, digest: '38232e7e263ef0ca' },
  { text: 'http://10.141.235.23:5173/', mask: 4, digest: 'd8ba289c1e324b70' },
  { text: 'https://linguist.example.com/', mask: 0, digest: '0f335623fcf1b532' },
  { text: 'https://random-name-1234.trycloudflare.com/', mask: 2, digest: 'ad3f6d0ffa562c30' }
];

for (const golden of goldens) {
  const qr = encode(golden.text);
  check('mask ' + golden.mask + ' chosen for "' + golden.text.slice(0, 36) + '"', qr.mask === golden.mask,
    'chose ' + qr.mask);
  check('matrix unchanged for "' + golden.text.slice(0, 36) + '"', digest(qr) === golden.digest,
    'got ' + digest(qr));
}

/* ---------- the structure a scanner looks for first ---------- */

section('structural invariants');

const sample = encode('http://10.141.235.23:5173/');

function finderAt(qr, cx, cy) {
  const expected = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1]
  ];
  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const cell = qr.modules[cy - 3 + y][cx - 3 + x] ? 1 : 0;
      if (cell !== expected[y][x]) return false;
    }
  }
  return true;
}

check('finder pattern in the top-left corner', finderAt(sample, 3, 3));
check('finder pattern in the top-right corner', finderAt(sample, sample.size - 4, 3));
check('finder pattern in the bottom-left corner', finderAt(sample, 3, sample.size - 4));
check('timing pattern along row 6 alternates',
  Array.from({ length: sample.size }, (_, i) => sample.modules[6][i]).every((cell, i) =>
    i < 8 || i > sample.size - 9 ? true : cell === (i % 2 === 0)));
check('timing pattern down column 6 alternates',
  Array.from({ length: sample.size }, (_, i) => sample.modules[i][6]).every((cell, i) =>
    i < 8 || i > sample.size - 9 ? true : cell === (i % 2 === 0)));
check('the format strips do not overwrite the timing crossings',
  sample.modules[6][8] === true && sample.modules[8][6] === true);
check('the module above the bottom-left finder is always dark',
  sample.modules[sample.size - 8][8] === true);
check('every row is the same width', sample.modules.every((row) => row.length === sample.size));

/* ---------- rendering ---------- */

section('rendering');

const lines = toTerminal(sample);
check('terminal rendering is half as many lines as modules plus the quiet zone',
  lines.length === Math.ceil((sample.size + 8) / 2), 'got ' + lines.length);
check('every terminal line sets black on white explicitly, so the theme cannot invert it',
  lines.every((line) => line.startsWith('\u001b[30m\u001b[47m') && line.endsWith('\u001b[0m')));
check('the first terminal line is the quiet zone, so it is blank between the colours',
  lines[0].slice('\u001b[30m\u001b[47m'.length, -'\u001b[0m'.length).trim() === '');
check('the rendered width matches the modules plus both quiet zones',
  lines[1].slice('\u001b[30m\u001b[47m'.length, -'\u001b[0m'.length).length === sample.size + 8);

const svg = toSvg(sample);
check('svg carries a quiet zone and one path per dark module',
  svg.startsWith('<svg') && svg.includes('viewBox="0 0 ' + ((sample.size + 8) * 8) + ' ' + ((sample.size + 8) * 8) + '"') &&
  (svg.match(/M/g) || []).length === sample.modules.flat().filter(Boolean).length);

console.log('');
if (failures.length) {
  console.error(failures.length + ' check(s) failed, ' + passed + ' passed');
  process.exit(1);
}
console.log('qr ok — ' + passed + ' checks passed');
