// Offline QR Code encoder: byte mode (UTF-8), error correction level M,
// automatic version 1-10. No dependencies, no network calls.
//
// Tickets render locally (QRCode.jsx) and door staff scan them with the
// built-in decoder (qr-decode.js). Nothing leaves the device.

import {
  ALIGN_CENTERS,
  EC_LEVEL_BITS_M,
  REMAINDER_BITS,
  expandBlocks,
  formatInfoBits,
  rsEncodeBlock,
  versionInfoBits,
} from "./qr-common.js";

function pushBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

// Byte-mode bit stream with terminator, byte padding and EC/11 fill.
function encodeDataBits(bytes, version, dataCapacity) {
  const bits = [];
  pushBits(bits, 0b0100, 4);
  pushBits(bits, bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) pushBits(bits, b, 8);
  const capacity = dataCapacity * 8;
  if (bits.length > capacity) throw new Error("Data does not fit the selected QR version.");
  pushBits(bits, 0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    out.push(v);
  }
  for (let pad = 0xec; out.length < dataCapacity; pad = pad === 0xec ? 0x11 : 0xec) {
    out.push(pad);
  }
  return out;
}

function selectVersion(byteLen) {
  for (let v = 1; v <= 10; v++) {
    const { dataTotal } = expandBlocks(v);
    const countBits = v < 10 ? 8 : 16;
    if (4 + countBits + 8 * byteLen <= dataTotal * 8) return v;
  }
  throw new Error("Text is too long for a version 10-M QR code.");
}

function interleave(blocks, ecPerBlock) {
  const out = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const b of blocks) out.push(b.ec[i]);
  }
  return out;
}

// ---- Mask patterns ----
export function maskApplies(pattern, r, c) {
  switch (pattern) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return (r * c) % 2 + ((r * c) % 3) === 0;
    case 6: return ((r * c) % 2 + ((r * c) % 3)) % 2 === 0;
    case 7: return ((r + c) % 2 + ((r * c) % 3)) % 2 === 0;
    default: return false;
  }
}

// ---- Penalty scoring (spec rules N1..N4) ----
function penaltyScore(modules) {
  const n = modules.length;
  let score = 0;
  const runPenalty = (line) => {
    let run = 1;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) score += 3 + (run - 5);
  };
  for (let r = 0; r < n; r++) runPenalty(modules[r]);
  for (let c = 0; c < n; c++) runPenalty(modules.map((row) => row[c]));
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) score += 3;
    }
  }
  const finderLike = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const finderLikeInv = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matchAt = (line, i, pat) => {
    if (i + pat.length > line.length) return false;
    for (let k = 0; k < pat.length; k++) if (line[i + k] !== pat[k]) return false;
    return true;
  };
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matchAt(modules[r], c, finderLike) || matchAt(modules[r], c, finderLikeInv)) score += 40;
    }
  }
  for (let c = 0; c < n; c++) {
    const col = modules.map((row) => row[c]);
    for (let r = 0; r < n; r++) {
      if (matchAt(col, r, finderLike) || matchAt(col, r, finderLikeInv)) score += 40;
    }
  }
  let dark = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (modules[r][c]) dark++;
  const k = Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n));
  score += k * 10;
  return score;
}

// ---- Matrix construction ----
const FINDER = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1],
];

export function buildBase(version) {
  const size = 4 * version + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(null));
  const set = (r, c, dark) => {
    modules[r][c] = !!dark;
  };

  const placeFinder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const inPattern = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        set(r, c, inPattern ? FINDER[dr][dc] === 1 : false);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    if (modules[6][i] === null) set(6, i, i % 2 === 0);
    if (modules[i][6] === null) set(i, 6, i % 2 === 0);
  }

  for (const r of ALIGN_CENTERS[version]) {
    for (const c of ALIGN_CENTERS[version]) {
      if (r < 9 && c < 9) continue;
      if (r < 9 && c > size - 10) continue;
      if (r > size - 10 && c < 9) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  // Fixed dark module.
  set(4 * version + 9, 8, true);

  // Reserve format-info cells (values written per mask later).
  for (const i of [0, 1, 2, 3, 4, 5, 7, 8]) {
    modules[8][i] = false;
    modules[i][8] = false;
  }
  for (let i = size - 8; i < size; i++) modules[8][i] = false;
  for (let i = size - 7; i < size; i++) modules[i][8] = false;

  // Reserve version-info cells (versions 7+).
  if (version >= 7) {
    for (let r = 0; r < 6; r++) {
      for (let c = size - 11; c < size - 8; c++) modules[r][c] = false;
    }
    for (let r = size - 11; r < size - 8; r++) {
      for (let c = 0; c < 6; c++) modules[r][c] = false;
    }
  }

  return modules;
}

function writeFormatInfo(modules, mask) {
  const size = modules.length;
  const bits = formatInfoBits(EC_LEVEL_BITS_M, mask);
  const bit = (i) => ((bits >> i) & 1) === 1;
  for (let i = 0; i < 15; i++) {
    const v = bit(i);
    if (i < 6) modules[i][8] = v;
    else if (i < 8) modules[i + 1][8] = v;
    else modules[size - 15 + i][8] = v;
  }
  for (let i = 0; i < 15; i++) {
    const v = bit(i);
    if (i < 8) modules[8][size - i - 1] = v;
    else if (i < 9) modules[8][15 - i] = v;
    else modules[8][15 - i - 1] = v;
  }
}

function writeVersionInfo(modules, version) {
  if (version < 7) return;
  const size = modules.length;
  const bits = versionInfoBits(version);
  for (let i = 0; i < 18; i++) {
    const v = ((bits >> i) & 1) === 1;
    modules[Math.floor(i / 3)][(i % 3) + size - 11] = v;
    modules[(i % 3) + size - 11][Math.floor(i / 3)] = v;
  }
}

function placeData(modules, codewords, mask, version) {
  const size = modules.length;
  let inc = 0;
  const totalBits = codewords.length * 8;
  let row = size - 1;
  let dir = -1;
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col--;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        if (modules[row][col - c] === null) {
          let dark = false;
          if (inc < totalBits) dark = ((codewords[inc >>> 3] >>> (7 - (inc & 7))) & 1) === 1;
          if (maskApplies(mask, row, col - c)) dark = !dark;
          modules[row][col - c] = dark;
          inc++;
        }
      }
      row += dir;
      if (row < 0 || row >= size) {
        row -= dir;
        dir = -dir;
        break;
      }
    }
  }
  if (inc !== totalBits + REMAINDER_BITS[version]) throw new Error("QR data placement mismatch.");
}

function cloneMatrix(modules) {
  return modules.map((row) => row.slice());
}

// Builds the module matrix for `text`. Returns { version, size, at(r, c) }.
export function createQRMatrix(text) {
  const bytes = new TextEncoder().encode(String(text ?? ""));
  if (bytes.length === 0) throw new Error("Cannot encode an empty QR payload.");
  const version = selectVersion(bytes.length);
  const { blocks, ecPerBlock, dataTotal } = expandBlocks(version);
  const dataBytes = encodeDataBits(bytes, version, dataTotal);

  let offset = 0;
  const filled = blocks.map((b) => {
    const data = dataBytes.slice(offset, offset + b.dataLen);
    offset += b.dataLen;
    return { data, ec: rsEncodeBlock(data, ecPerBlock) };
  });
  const codewords = interleave(filled, ecPerBlock);

  const base = buildBase(version);
  let best = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const trial = cloneMatrix(base);
    writeFormatInfo(trial, mask);
    writeVersionInfo(trial, version);
    placeData(trial, codewords, mask, version);
    const score = penaltyScore(trial);
    if (score < bestScore) {
      bestScore = score;
      best = trial;
    }
  }

  const size = 4 * version + 17;
  return {
    version,
    size,
    modules: best,
    at(r, c) {
      return best[r][c];
    },
  };
}
