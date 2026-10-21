/* Freeze the 6.5 offline build into the desktop project.

   The source of truth stays 6.0/dist/linguist_6.5.0.html. This script refuses
   to copy anything that is not version 6.5.0, then records the SHA-256 of the
   exact file that went into the exe. */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const source = path.resolve(root, '..', '..', '6.0', 'dist', 'linguist_6.5.0.html');
const targetDir = path.join(root, 'app');
const target = path.join(targetDir, 'linguist_6.5.0.html');

function fail(message) {
  console.error(`prepare: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(source)) {
  fail(`missing offline build: ${source}`);
}

const bytes = fs.readFileSync(source);
const text = bytes.toString('utf8');

if (!/version:\s*'6\.5\.0'/.test(text)) {
  fail(`offline build is not 6.5.0: ${source}`);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(target, bytes);

const digest = crypto.createHash('sha256').update(bytes).digest('hex');
fs.writeFileSync(path.join(targetDir, 'SHA256.txt'), `${digest}\n`, 'utf8');

console.log(`prepare: ${bytes.length} bytes`);
console.log(`prepare: sha256 ${digest}`);
console.log(`prepare: ${target}`);
