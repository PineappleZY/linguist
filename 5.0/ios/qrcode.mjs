/* A QR encoder, small enough to read, and only as much of the spec as this
   project needs: byte mode, error-correction levels M and L, versions 1–4.

   Why hand-written: the LAN URL that gets printed when someone wants to open
   5.0 on a phone is the one thing here that has to be exact, and a dependency
   would be a package to install on a machine that may well be offline. A
   version-4 code at level L holds 78 bytes, which is more than any LAN or
   tunnel URL is long; anything longer is reported rather than truncated.

   Verified against the reference implementation — see ios/test/qr-check.mjs. */

/* Version 1–4 geometry. totalCodewords and the block split are the only parts
   of the spec that are pure table; everything else below is computed. */
const VERSIONS = [
  /* version 1 */ { size: 21, totalCodewords: 26, align: [], M: { blocks: 1, ecPerBlock: 10 }, L: { blocks: 1, ecPerBlock: 7 } },
  /* version 2 */ { size: 25, totalCodewords: 44, align: [6, 18], M: { blocks: 1, ecPerBlock: 16 }, L: { blocks: 1, ecPerBlock: 10 } },
  /* version 3 */ { size: 29, totalCodewords: 70, align: [6, 22], M: { blocks: 1, ecPerBlock: 26 }, L: { blocks: 1, ecPerBlock: 15 } },
  /* version 4 */ { size: 33, totalCodewords: 100, align: [6, 26], M: { blocks: 2, ecPerBlock: 18 }, L: { blocks: 1, ecPerBlock: 20 } }
];

/* The two-bit level indicator that goes into the format information. */
const ECL_BITS = { L: 1, M: 0 };

/* ---------- Galois field, for Reed–Solomon ---------- */

function gfMul(a, b) {
  let product = 0;
  for (let i = 7; i >= 0; i -= 1) {
    product = (product << 1) ^ ((product >>> 7) * 0x11d);
    product ^= ((b >>> i) & 1) * a;
  }
  return product & 0xff;
}

function ecDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 2);
  }
  return result;
}

function ecRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    for (let i = 0; i < divisor.length; i += 1) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

/* ---------- Bit stream ---------- */

class Bits {
  constructor() {
    this.bytes = [];
    this.length = 0;
  }

  put(value, count) {
    for (let i = count - 1; i >= 0; i -= 1) this.putBit(((value >>> i) & 1) !== 0);
  }

  putBit(bit) {
    if (this.length % 8 === 0) this.bytes.push(0);
    if (bit) this.bytes[this.bytes.length - 1] |= 0x80 >>> (this.length % 8);
    this.length += 1;
  }
}

/* ---------- Encoding ---------- */

function payload(text) {
  /* Byte mode, UTF-8. A URL is ASCII, but nothing here assumes it. */
  return Array.from(new TextEncoder().encode(text));
}

function choose(text, preferred) {
  const bytes = payload(text);
  for (const level of preferred) {
    for (let version = 1; version <= VERSIONS.length; version += 1) {
      const spec = VERSIONS[version - 1];
      const dataCodewords = spec.totalCodewords - spec[level].blocks * spec[level].ecPerBlock;
      /* Mode indicator (4 bits) + character count (8 bits at these versions). */
      if (dataCodewords - 2 >= bytes.length) return { version, level, spec, bytes, dataCodewords };
    }
  }
  throw new Error('text does not fit a version-4 QR code (' + bytes.length + ' bytes): ' + text);
}

function dataCodewords(text, chosen) {
  const { bytes, dataCodewords: capacity, version } = chosen;
  const bits = new Bits();
  bits.put(0x4, 4); /* byte mode */
  bits.put(bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) bits.put(byte, 8);

  /* Terminator, then pad to a codeword boundary, then the alternating fill. */
  bits.put(0, Math.min(4, capacity * 8 - bits.length));
  bits.put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.bytes.length < capacity; pad ^= 0xec ^ 0x11) bits.bytes.push(pad);
  return bits.bytes;
}

function interleave(codewords, chosen) {
  const { blocks, ecPerBlock } = chosen.spec[chosen.level];
  const dataPerBlock = chosen.dataCodewords / blocks;
  const divisor = ecDivisor(ecPerBlock);

  const dataBlocks = [];
  const ecBlocks = [];
  for (let i = 0; i < blocks; i += 1) {
    const block = codewords.slice(i * dataPerBlock, (i + 1) * dataPerBlock);
    dataBlocks.push(block);
    ecBlocks.push(ecRemainder(block, divisor));
  }

  const result = [];
  for (let i = 0; i < dataPerBlock; i += 1) {
    for (const block of dataBlocks) result.push(block[i]);
  }
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (const block of ecBlocks) result.push(block[i]);
  }
  return result;
}

/* ---------- Matrix ---------- */

function blank(size) {
  const modules = [];
  const isFunction = [];
  for (let y = 0; y < size; y += 1) {
    modules.push(new Array(size).fill(false));
    isFunction.push(new Array(size).fill(false));
  }
  return { modules, isFunction, size };
}

function set(grid, x, y, dark) {
  grid.modules[y][x] = dark;
  grid.isFunction[y][x] = true;
}

function finder(grid, cx, cy) {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) continue;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      set(grid, x, y, distance !== 2 && distance !== 4);
    }
  }
}

function alignment(grid, cx, cy) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      set(grid, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

/* Everything that is not data: finders, separators, timing, alignment, the
   format copies and the module that is always dark. */
function functionPatterns(grid, spec) {
  const size = grid.size;

  for (let i = 0; i < size; i += 1) {
    set(grid, 6, i, i % 2 === 0);
    set(grid, i, 6, i % 2 === 0);
  }
  finder(grid, 3, 3);
  finder(grid, size - 4, 3);
  finder(grid, 3, size - 4);

  for (const cy of spec.align) {
    for (const cx of spec.align) {
      /* The three finder corners already cover their own alignment pattern. */
      const nearFinder = (cx === 6 && cy === 6) ||
        (cx === 6 && cy === size - 7) ||
        (cx === size - 7 && cy === 6);
      if (!nearFinder) alignment(grid, cx, cy);
    }
  }

  /* Reserve the format areas so the data walk skips them. Row 6 and column 6
     are skipped here because they are the timing patterns: the format strips
     run alongside them and never through them, which is what lets a scanner
     find the module grid. Clearing those two crossings would leave (8,6) and
     (6,8) light when the pattern says dark. */
  for (let i = 0; i <= 8; i += 1) {
    if (i === 6) continue;
    set(grid, i, 8, false);
    set(grid, 8, i, false);
  }
  for (let i = 0; i < 8; i += 1) {
    set(grid, size - 1 - i, 8, false);
    set(grid, 8, size - 1 - i, false);
  }
}

function drawFormat(grid, level, mask) {
  const size = grid.size;
  const data = (ECL_BITS[level] << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  const bits = ((data << 10) | remainder) ^ 0x5412;
  const bit = (index) => ((bits >>> index) & 1) !== 0;

  for (let i = 0; i <= 5; i += 1) set(grid, 8, i, bit(i));
  set(grid, 8, 7, bit(6));
  set(grid, 8, 8, bit(7));
  set(grid, 7, 8, bit(8));
  for (let i = 9; i < 15; i += 1) set(grid, 14 - i, 8, bit(i));

  for (let i = 0; i < 8; i += 1) set(grid, size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i += 1) set(grid, 8, size - 15 + i, bit(i));
  set(grid, 8, size - 8, true);
}

function drawData(grid, codewords) {
  const size = grid.size;
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (grid.isFunction[y][x]) continue;
        if (index < codewords.length * 8) {
          grid.modules[y][x] = ((codewords[index >>> 3] >>> (7 - (index & 7))) & 1) !== 0;
          index += 1;
        }
        /* Anything left over is a remainder module and stays light. */
      }
    }
  }
}

function maskBit(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(grid, mask) {
  for (let y = 0; y < grid.size; y += 1) {
    for (let x = 0; x < grid.size; x += 1) {
      if (grid.isFunction[y][x]) continue;
      if (maskBit(mask, x, y)) grid.modules[y][x] = !grid.modules[y][x];
    }
  }
}

/* Penalty rules 1–4. A different mask would still scan — the mask number
   travels in the format bits — but the winner is the one scanners like. */
function penalty(grid) {
  const size = grid.size;
  const modules = grid.modules;
  let score = 0;

  const runScore = (run) => (run >= 5 ? 3 + (run - 5) : 0);
  for (let y = 0; y < size; y += 1) {
    let run = 1;
    for (let x = 1; x < size; x += 1) {
      if (modules[y][x] === modules[y][x - 1]) run += 1;
      else { score += runScore(run); run = 1; }
    }
    score += runScore(run);
  }
  for (let x = 0; x < size; x += 1) {
    let run = 1;
    for (let y = 1; y < size; y += 1) {
      if (modules[y][x] === modules[y - 1][x]) run += 1;
      else { score += runScore(run); run = 1; }
    }
    score += runScore(run);
  }

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const first = modules[y][x];
      if (first === modules[y][x + 1] && first === modules[y + 1][x] && first === modules[y + 1][x + 1]) {
        score += 3;
      }
    }
  }

  const pattern = [true, false, true, true, true, false, true, false, false, false, false];
  const reversed = [false, false, false, false, true, false, true, true, true, false, true];
  const matches = (get, at) => {
    let forward = true;
    let backward = true;
    for (let i = 0; i < 11; i += 1) {
      const value = get(at + i);
      if (value !== pattern[i]) forward = false;
      if (value !== reversed[i]) backward = false;
    }
    return forward || backward;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x + 11 <= size; x += 1) {
      if (matches((i) => modules[y][i], x)) score += 40;
    }
  }
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y + 11 <= size; y += 1) {
      if (matches((i) => modules[i][x], y)) score += 40;
    }
  }

  let dark = 0;
  for (const row of modules) for (const cell of row) if (cell) dark += 1;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/* ---------- Public ---------- */

/* Preference order is a parameter because the caller knows what it is for: a
   URL printed in a terminal has a clean foreground, so level M (more error
   correction than L) is affordable and is tried first. */
export function encode(text, options) {
  const preferred = (options && options.levels) || ['M', 'L'];
  const chosen = choose(text, preferred);
  const codewords = interleave(dataCodewords(text, chosen), chosen);

  const grid = blank(chosen.spec.size);
  functionPatterns(grid, chosen.spec);
  drawData(grid, codewords);

  let best = null;
  for (let mask = 0; mask < 8; mask += 1) {
    applyMask(grid, mask);
    drawFormat(grid, chosen.level, mask);
    const score = penalty(grid);
    if (!best || score < best.score) best = { mask, score, modules: grid.modules.map((row) => row.slice()) };
    applyMask(grid, mask); /* involutive: this undoes it */
  }

  return {
    version: chosen.version,
    level: chosen.level,
    mask: best.mask,
    size: chosen.spec.size,
    modules: best.modules
  };
}

/* Half-block rendering with explicit colours, so the code scans whatever the
   terminal's background happens to be: dark modules are painted dark instead
   of being left to the theme. Two module rows become one text line, and a
   character cell is about twice as tall as it is wide, so a half block comes
   out square — which is what a scanner wants to see. */
export function toTerminal(qr, options) {
  const quiet = (options && options.quiet !== undefined) ? options.quiet : 4;
  const size = qr.size + quiet * 2;
  const at = (x, y) => {
    const mx = x - quiet;
    const my = y - quiet;
    if (mx < 0 || my < 0 || mx >= qr.size || my >= qr.size) return false;
    return qr.modules[my][mx];
  };

  const lines = [];
  for (let y = 0; y < size; y += 2) {
    let row = '';
    for (let x = 0; x < size; x += 1) {
      const top = at(x, y);
      const bottom = y + 1 < size ? at(x, y + 1) : false;
      /* Black on white: the foreground paints the dark half of the glyph and
         the background paints the light one, so every cell looks the same to
         the terminal and only the glyph changes. */
      if (top && bottom) row += '\u2588';
      else if (top) row += '\u2580';
      else if (bottom) row += '\u2584';
      else row += ' ';
    }
    lines.push('\u001b[30m\u001b[47m' + row + '\u001b[0m');
  }
  return lines;
}

export function toSvg(qr, options) {
  const quiet = (options && options.quiet !== undefined) ? options.quiet : 4;
  const scale = (options && options.scale) || 8;
  const size = (qr.size + quiet * 2) * scale;
  let path = '';
  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      if (!qr.modules[y][x]) continue;
      path += 'M' + ((x + quiet) * scale) + ' ' + ((y + quiet) * scale) +
        'h' + scale + 'v' + scale + 'h-' + scale + 'z';
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
    '" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges">' +
    '<rect width="' + size + '" height="' + size + '" fill="#fff"/>' +
    '<path d="' + path + '" fill="#000"/></svg>';
}
