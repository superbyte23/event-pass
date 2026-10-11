// Shared QR core: Galois field arithmetic, version/block tables, EC helpers.
// Used by both the encoder (qr-encode.js) and the decoder (qr-decode.js).
// Pure math, no DOM, no dependencies, no network.

export const EC_LEVEL_BITS_M = 0b00;

// [totalCodewords, ecCodewordsPerBlock, [[blockCount, dataCodewords], ...]]
// Error correction level M, versions 1-10.
export const BLOCK_TABLE = {
  1: [26, 10, [[1, 16]]],
  2: [44, 16, [[1, 28]]],
  3: [70, 26, [[1, 44]]],
  4: [100, 18, [[2, 32]]],
  5: [134, 24, [[2, 43]]],
  6: [172, 16, [[4, 27]]],
  7: [196, 18, [[4, 31]]],
  8: [242, 24, [[2, 36], [2, 37]]],
  9: [292, 29, [[4, 44]]],
  10: [346, 22, [[2, 35], [4, 36]]],
};

// Alignment pattern centers per version (empty for version 1).
export const ALIGN_CENTERS = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

// Remainder (padding) modules after the data: always light, not part of any
// codeword. Only versions 2-6 have them.
export const REMAINDER_BITS = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0 };

export function matrixSize(version) {
  return 4 * version + 17;
}

// ---- Galois field GF(256) ----
export const GF_EXP = new Array(512);
export const GF_LOG = new Array(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

export function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

export function gfDiv(a, b) {
  if (a === 0) return 0;
  if (b === 0) throw new Error("GF division by zero.");
  return GF_EXP[(GF_LOG[a] + 255 - GF_LOG[b]) % 255];
}

export function polyMul(a, b) {
  const out = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) out[i + j] ^= gfMul(a[i], b[j]);
  }
  return out;
}

// Reed-Solomon generator polynomial of given degree (highest-degree first).
export function rsGeneratorPoly(degree) {
  let g = [1];
  for (let i = 0; i < degree; i++) g = polyMul(g, [1, GF_EXP[i]]);
  return g;
}

// Reed-Solomon error correction codewords for one block.
export function rsEncodeBlock(data, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const ec = new Array(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ ec[0];
    ec.shift();
    ec.push(0);
    for (let i = 0; i < ecLen; i++) ec[i] ^= gfMul(gen[i + 1], factor);
  }
  return ec;
}

export function expandBlocks(version) {
  const [total, ecPerBlock, groups] = BLOCK_TABLE[version];
  const blocks = [];
  for (const [count, dataLen] of groups) {
    for (let i = 0; i < count; i++) blocks.push({ dataLen });
  }
  const dataTotal = blocks.reduce((s, b) => s + b.dataLen, 0);
  if (dataTotal + blocks.length * ecPerBlock !== total) {
    throw new Error(`Bad block table for QR version ${version}.`);
  }
  return { blocks, ecPerBlock, dataTotal, total };
}

export function bitLength(n) {
  let len = 0;
  while (n > 0) {
    len++;
    n >>>= 1;
  }
  return len;
}

// 15-bit format string for EC level + mask, with BCH error correction.
export function formatInfoBits(ecLevelBits, mask) {
  const data = (ecLevelBits << 3) | mask;
  let d = data << 10;
  const g = 0b10100110111;
  while (bitLength(d) >= bitLength(g)) d ^= g << (bitLength(d) - bitLength(g));
  return ((data << 10) | d) ^ 0b101010000010010;
}

// 18-bit version string (versions 7+), with BCH error correction.
export function versionInfoBits(version) {
  let d = version << 12;
  const g = 0b1111100100101;
  while (bitLength(d) >= bitLength(g)) d ^= g << (bitLength(d) - bitLength(g));
  return (version << 12) | d;
}
