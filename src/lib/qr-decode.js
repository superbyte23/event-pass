// Offline QR decoder: finder localization, perspective sampling, format-info
// recovery, full Reed-Solomon error correction, byte-mode parsing.
// Pure math + pixel loops. No DOM, no dependencies, no network calls.
//
// Entry points:
//   decodeGrayscale(pixels, width, height) -> { text } | null
//     pixels: Uint8Array/Uint8ClampedArray of luminance (0 = black).
//   decodeMatrix(modules, size) -> { text } | null
//     modules: sampled 2D boolean matrix (ideal alignment, for tests/fallback).
//   rsCorrectBlock(received, ecLen) -> data bytes | null (exported for tests).

import {
  ALIGN_CENTERS,
  EC_LEVEL_BITS_M,
  expandBlocks,
  formatInfoBits,
  gfDiv,
  gfMul,
  GF_EXP,
} from "./qr-common.js";
import { buildBase, maskApplies } from "./qr-encode.js";

// ---------- Reed-Solomon decoding ----------

function rsSyndromes(received, ecLen) {
  const syn = [];
  for (let i = 0; i < ecLen; i++) {
    let s = 0;
    const x = GF_EXP[i];
    for (const coef of received) s = gfMul(s, x) ^ coef;
    syn.push(s);
  }
  return syn;
}

function berlekampMassey(synd) {
  let cPoly = [1];
  let bPoly = [1];
  let order = 0;
  let m = 1;
  let b = 1;
  for (let n = 0; n < synd.length; n++) {
    let d = synd[n];
    for (let i = 1; i <= order; i++) d ^= gfMul(cPoly[i] || 0, synd[n - i]);
    if (d === 0) {
      m++;
      continue;
    }
    const prev = cPoly.slice();
    const coef = gfDiv(d, b);
    while (cPoly.length < bPoly.length + m) cPoly.push(0);
    for (let i = 0; i < bPoly.length; i++) cPoly[i + m] ^= gfMul(coef, bPoly[i]);
    if (2 * order <= n) {
      order = n + 1 - order;
      bPoly = prev;
      b = d;
      m = 1;
    } else {
      m++;
    }
  }
  return { locator: cPoly, degree: order };
}

function findErrorPositions(locator, n) {
  const pos = [];
  for (let i = 0; i < 255; i++) {
    let s = 0;
    for (let j = 0; j < locator.length; j++) s ^= gfMul(locator[j], GF_EXP[(j * i) % 255]);
    if (s === 0) {
      const loc = (255 - i) % 255;
      if (loc < n) pos.push(n - 1 - loc);
    }
  }
  return pos;
}

export function rsCorrectBlock(received, ecLen) {
  const n = received.length;
  const synd = rsSyndromes(received, ecLen);
  if (synd.every((s) => s === 0)) return received.slice(0, n - ecLen);
  const { locator, degree } = berlekampMassey(synd);
  if (degree === 0 || degree * 2 > ecLen) return null;
  const errPos = findErrorPositions(locator, n);
  if (errPos.length !== degree) return null;
  const twoT = ecLen;
  const omega = new Array(twoT).fill(0);
  for (let i = 0; i < twoT; i++) {
    for (let j = 0; j <= Math.min(i, degree); j++) {
      omega[i] ^= gfMul(synd[i - j] || 0, locator[j] || 0);
    }
  }
  const corrected = received.slice();
  for (const p of errPos) {
    const loc = n - 1 - p;
    const xInv = (255 - loc) % 255;
    let num = 0;
    for (let j = 0; j < omega.length; j++) num ^= gfMul(omega[j], GF_EXP[(j * xInv) % 255]);
    let den = 0;
    for (let j = 1; j < locator.length; j += 2) {
      den ^= gfMul(locator[j], GF_EXP[(((j - 1) * xInv) % 255)]);
    }
    if (den === 0) return null;
    // Forney with first generator root alpha^0: magnitude carries an extra X factor.
    corrected[p] ^= gfMul(gfDiv(num, den), GF_EXP[loc % 255]);
  }
  const check = rsSyndromes(corrected, ecLen);
  if (!check.every((s) => s === 0)) return null;
  return corrected.slice(0, n - ecLen);
}

// ---------- Format info ----------

function hamming(a, b) {
  let d = a ^ b;
  let n = 0;
  while (d) {
    n += d & 1;
    d >>>= 1;
  }
  return n;
}

function nearestFormat(word) {
  const unmasked = word ^ 0b101010000010010;
  let best = null;
  for (let level = 0; level < 4; level++) {
    for (let mask = 0; mask < 8; mask++) {
      const cand = formatInfoBits(level, mask) ^ 0b101010000010010;
      const dist = hamming(unmasked, cand);
      if (!best || dist < best.dist) best = { level, mask, dist };
    }
  }
  return best && best.dist <= 3 ? best : null;
}

function readFormatWord(modules, cells) {
  let word = 0;
  cells.forEach(([r, c], i) => {
    if (modules[r][c]) word |= 1 << i;
  });
  return word;
}

export function decodeFormatInfo(modules) {
  const n = modules.length;
  const vCells = [];
  for (let i = 0; i < 6; i++) vCells.push([i, 8]);
  vCells.push([7, 8], [8, 8]);
  for (let i = n - 7; i < n; i++) vCells.push([i, 8]);
  const hCells = [];
  for (let i = n - 1; i >= n - 8; i--) hCells.push([8, i]);
  hCells.push([8, 7]);
  for (let i = 5; i >= 0; i--) hCells.push([8, i]);
  const copies = [
    vCells.slice(0, 8).concat(hCells.slice(8)),
    vCells.slice(8).concat(hCells.slice(0, 8)),
  ];
  const out = [];
  for (const cells of copies) {
    const fmt = nearestFormat(readFormatWord(modules, cells));
    if (fmt) out.push(fmt);
  }
  return out;
}

// ---------- Bit stream (inverse of the encoder's zigzag placement) ----------

function readBits(modules, version, mask) {
  const size = modules.length;
  const base = buildBase(version);
  const bits = [];
  let row = size - 1;
  let dir = -1;
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col--;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        if (base[row][col - c] === null) {
          let b = modules[row][col - c] ? 1 : 0;
          if (maskApplies(mask, row, col - c)) b ^= 1;
          bits.push(b);
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
  return bits;
}

function bitsToBytes(bits) {
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    out.push(v);
  }
  return out;
}

function deinterleave(allBytes, version) {
  const { blocks, ecPerBlock } = expandBlocks(version);
  const out = blocks.map(() => ({ data: [], ec: [] }));
  let p = 0;
  const maxData = Math.max(...blocks.map((b) => b.dataLen));
  for (let i = 0; i < maxData; i++) {
    for (let bi = 0; bi < blocks.length; bi++) {
      if (i < blocks[bi].dataLen) out[bi].data.push(allBytes[p++]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let bi = 0; bi < blocks.length; bi++) out[bi].ec.push(allBytes[p++]);
  }
  return out;
}

function parseBytePayload(dataBytes, version) {
  const bits = [];
  for (const b of dataBytes) {
    for (let i = 7; i >= 0; i--) bits.push((b >>> i) & 1);
  }
  let p = 0;
  const read = (count) => {
    let v = 0;
    for (let i = 0; i < count; i++) v = (v << 1) | (bits[p++] || 0);
    return v;
  };
  if (p + 4 > bits.length || read(4) !== 0b0100) return null;
  const countBits = version < 10 ? 8 : 16;
  if (p + countBits > bits.length) return null;
  const len = read(countBits);
  if (p + len * 8 > bits.length) return null;
  const out = [];
  for (let i = 0; i < len; i++) out.push(read(8));
  try {
    return new TextDecoder().decode(new Uint8Array(out));
  } catch {
    return null;
  }
}

// Decode an ideally-sampled boolean matrix of known size.
export function decodeMatrix(modules, size) {
  const version = (size - 17) / 4;
  if (!Number.isInteger(version) || version < 1 || version > 10) return null;
  if (!Array.isArray(modules) || modules.length !== size) return null;
  for (const row of modules) {
    if (!Array.isArray(row) || row.length !== size) return null;
  }
  const { total } = expandBlocks(version);
  const formats = decodeFormatInfo(modules);
  const maskTries = [];
  for (const f of formats) {
    if (f.level === EC_LEVEL_BITS_M && !maskTries.includes(f.mask)) maskTries.push(f.mask);
  }
  for (let m = 0; m < 8; m++) if (!maskTries.includes(m)) maskTries.push(m);
  for (const mask of maskTries) {
    const bits = readBits(modules, version, mask);
    const allBytes = bitsToBytes(bits.slice(0, total * 8));
    if (allBytes.length < total) continue;
    const parts = deinterleave(allBytes, version);
    const { ecPerBlock } = expandBlocks(version);
    const stream = [];
    let ok = true;
    for (const part of parts) {
      const data = rsCorrectBlock(part.data.concat(part.ec), ecPerBlock);
      if (!data) {
        ok = false;
        break;
      }
      stream.push(...data);
    }
    if (!ok) continue;
    const text = parseBytePayload(stream, version);
    if (text !== null) return { text, version, mask };
  }
  return null;
}

// ---------- Vision: grayscale pixels -> finder triples ----------

function buildIntegral(pixels, w, h) {
  const integral = new Uint32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += pixels[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + rowSum;
    }
  }
  return integral;
}

function windowMean(integral, w, x0, y0, x1, y1) {
  const A = integral[y0 * (w + 1) + x0];
  const B = integral[y0 * (w + 1) + x1];
  const C = integral[y1 * (w + 1) + x0];
  const D = integral[y1 * (w + 1) + x1];
  return (A + D - B - C) / ((x1 - x0) * (y1 - y0));
}

export function binarize(pixels, w, h) {
  const integral = buildIntegral(pixels, w, h);
  const win = Math.max(9, Math.round(Math.min(w, h) / 20));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - win);
    const y1 = Math.min(h, y + win + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - win);
      const x1 = Math.min(w, x + win + 1);
      const mean = windowMean(integral, w, x0, y0, x1, y1);
      out[y * w + x] = pixels[y * w + x] < mean * 0.85 ? 1 : 0;
    }
  }
  return out;
}

function checkRatio(s0, s1, s2, s3, s4) {
  const total = s0 + s1 + s2 + s3 + s4;
  const m = total / 7;
  if (m < 1.5) return 0;
  if (Math.abs(s0 - m) > m * 0.8) return 0;
  if (Math.abs(s1 - m) > m * 0.8) return 0;
  if (Math.abs(s2 - 3 * m) > m * 1.1) return 0;
  if (Math.abs(s3 - m) > m * 0.8) return 0;
  if (Math.abs(s4 - m) > m * 0.8) return 0;
  return m;
}

function scanRowForFinders(bin, w, y) {
  const found = [];
  let runColor = bin[y * w];
  let runLen = 1;
  const runs = [];
  for (let x = 1; x < w; x++) {
    const v = bin[y * w + x];
    if (v === runColor) {
      runLen++;
    } else {
      runs.push({ color: runColor, len: runLen, end: x });
      runColor = v;
      runLen = 1;
    }
  }
  runs.push({ color: runColor, len: runLen, end: w });
  for (let i = 0; i + 4 < runs.length; i++) {
    if (runs[i].color !== 1) continue;
    const s = [runs[i].len, runs[i + 1].len, runs[i + 2].len, runs[i + 3].len, runs[i + 4].len];
    const m = checkRatio(...s);
    if (m > 0) {
      const endX = runs[i + 4].end;
      const startX = endX - (s[0] + s[1] + s[2] + s[3] + s[4]);
      found.push({ x: startX + s[0] + s[1] + s[2] / 2, y, size: m });
    }
  }
  return found;
}

function crossCheckVertical(bin, w, h, cx, cy, sizeEst) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : bin[y * w + x]);
  const x = Math.round(cx);
  let y = Math.round(cy);
  if (at(x, y) !== 1) {
    if (at(x, y - 1) === 1) y--;
    else if (at(x, y + 1) === 1) y++;
    else return null;
  }
  let top = y;
  while (top - 1 >= 0 && at(x, top - 1) === 1) top--;
  let bottom = y;
  while (bottom + 1 < h && at(x, bottom + 1) === 1) bottom++;
  // central dark run is rows top..bottom; now count the 5 vertical runs
  const runs = [];
  let yy = top;
  // run above (should be light)
  let up = yy;
  while (up - 1 >= 0 && at(x, up - 1) === 0) up--;
  runs.push(yy - up);
  runs.push(bottom - yy + 1);
  yy = bottom + 1;
  // This simplified check measures: light-above, dark-center; extend below
  let y2 = yy;
  while (y2 < h && at(x, y2) === 0) y2++;
  runs.push(y2 - yy);
  // We need 5 runs; measure outer dark runs too
  let y3 = y2;
  while (y3 < h && at(x, y3) === 1) y3++;
  // runs currently: [lightAbove, darkCenter, lightBelow, darkBelow?] — need full 5:
  // walk upward from `up` for the dark-above run, and we already have light-above.
  let y4 = up;
  while (y4 - 1 >= 0 && at(x, y4 - 1) === 1) y4--;
  const darkAbove = up - y4;
  // The five vertical runs mirror the horizontal check: they start and end
  // with the outer dark runs (never the light beyond, which merges with the
  // quiet zone): [dark, light, dark x3, light, dark].
  const five = [darkAbove, runs[0], runs[1], runs[2], y3 - y2];
  const m = checkRatio(...five);
  if (!m) return null;
  if (Math.abs(m - sizeEst) > sizeEst * 0.6) return null;
  return { x: cx, y: top + (bottom - top) / 2, size: (m + sizeEst) / 2 };
}

function clusterCandidates(list) {
  const clusters = [];
  for (const c of list) {
    let hit = null;
    for (const k of clusters) {
      const d = Math.hypot(k.x - c.x, k.y - c.y);
      if (d < (k.size + c.size) * 1.6) {
        hit = k;
        break;
      }
    }
    if (hit) {
      const n = hit.count + 1;
      hit.x = (hit.x * hit.count + c.x) / n;
      hit.y = (hit.y * hit.count + c.y) / n;
      hit.size = (hit.size * hit.count + c.size) / n;
      hit.count = n;
    } else {
      clusters.push({ x: c.x, y: c.y, size: c.size, count: 1 });
    }
  }
  return clusters.filter((k) => k.count >= 2);
}

export function tripleScore(a, b, c) {
  // Try each vertex as the right angle; return best { vertex, others, score }.
  const pts = [a, b, c];
  let best = null;
  for (let v = 0; v < 3; v++) {
    const p = pts[v];
    const q = pts[(v + 1) % 3];
    const r = pts[(v + 2) % 3];
    const d1 = Math.hypot(q.x - p.x, q.y - p.y);
    const d2 = Math.hypot(r.x - p.x, r.y - p.y);
    const dh = Math.hypot(q.x - r.x, q.y - r.y);
    if (d1 < 1 || d2 < 1) continue;
    const mean = (d1 + d2) / 2;
    const legErr = Math.abs(d1 - d2) / mean;
    const hypErr = Math.abs(dh - mean * Math.SQRT2) / (mean * Math.SQRT2);
    const cosA =
      (d1 * d1 + d2 * d2 - dh * dh) / (2 * d1 * d2);
    const sizeMean = (p.size + q.size + r.size) / 3;
    const sizeErr = Math.max(p.size, q.size, r.size) / Math.min(p.size, q.size, r.size) - 1;
    if (legErr > 0.3 || hypErr > 0.3 || Math.abs(cosA) > 0.3 || sizeErr > 0.6) continue;
    const score = legErr + hypErr + Math.abs(cosA) + sizeErr * 0.5;
    if (!best || score < best.score) best = { vertex: p, others: [q, r], score, leg: mean, size: sizeMean };
  }
  return best;
}

export function solveAffine(src, dst) {
  // Maps src[i] -> dst[i] for 3 points: X = a*x + b*y + c, Y = d*x + e*y + f.
  const det =
    src[0][0] * (src[1][1] - src[2][1]) +
    src[1][0] * (src[2][1] - src[0][1]) +
    src[2][0] * (src[0][1] - src[1][1]);
  if (Math.abs(det) < 1e-9) return null;
  const solve = (v0, v1, v2) => {
    const a =
      (v0 * (src[1][1] - src[2][1]) + v1 * (src[2][1] - src[0][1]) + v2 * (src[0][1] - src[1][1])) / det;
    const b =
      (v0 * (src[2][0] - src[1][0]) + v1 * (src[0][0] - src[2][0]) + v2 * (src[1][0] - src[0][0])) / det;
    const c =
      (v0 * (src[1][0] * src[2][1] - src[2][0] * src[1][1]) +
        v1 * (src[2][0] * src[0][1] - src[0][0] * src[2][1]) +
        v2 * (src[0][0] * src[1][1] - src[1][0] * src[0][1])) /
      det;
    return [a, b, c];
  };
  const [a, b, c] = solve(dst[0][0], dst[1][0], dst[2][0]);
  const [d, e, f] = solve(dst[0][1], dst[1][1], dst[2][1]);
  return { a, b, c, d, e, f };
}

export function sampleMatrix(bin, w, h, map, n) {
  const modules = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      const x = Math.round(map.a * (c + 0.5) + map.b * (r + 0.5) + map.c);
      const y = Math.round(map.d * (c + 0.5) + map.e * (r + 0.5) + map.f);
      if (x < 0 || y < 0 || x >= w || y >= h) return null;
      row.push(bin[y * w + x] === 1);
    }
    modules.push(row);
  }
  return modules;
}

// Projective transform (homography) from 4 module->pixel correspondences.
// Used when the code is photographed at a tilt that affine sampling can't model.
export function solveHomography(src, dst) {
  const A = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const n = 8;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    }
    const tmp = A[col];
    A[col] = A[piv];
    A[piv] = tmp;
    const d = A[col][col];
    if (Math.abs(d) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col] / d;
      for (let c = col; c <= n; c++) A[r][c] -= f * A[col][c];
    }
  }
  const H = A.map((row, i) => row[n] / A[i][i]);
  H.push(1);
  return H;
}

export function sampleProjective(bin, w, h, H, n) {
  const modules = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      const mx = c + 0.5;
      const my = r + 0.5;
      const Wd = H[6] * mx + H[7] * my + H[8];
      const x = Math.round((H[0] * mx + H[1] * my + H[2]) / Wd);
      const y = Math.round((H[3] * mx + H[4] * my + H[5]) / Wd);
      if (x < 0 || y < 0 || x >= w || y >= h) return null;
      row.push(bin[y * w + x] === 1);
    }
    modules.push(row);
  }
  return modules;
}

// Alignment-pattern center points (module coords), excluding finder
// overlaps. Note the +0.5: centers are module middle points, matching the
// 3.5-based finder corners used in the affine fit.
export function alignmentPositions(version) {
  const centers = ALIGN_CENTERS[version] || [];
  const n = 4 * version + 17;
  const out = [];
  for (const r of centers) {
    for (const c of centers) {
      if (r < 9 && c < 9) continue;
      if (r < 9 && c > n - 10) continue;
      if (r > n - 10 && c < 9) continue;
      out.push([c + 0.5, r + 0.5]);
    }
  }
  return out;
}

function sampleLum(lum, w, h, x, y) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  return lum[y * w + x];
}

// Bullseye check for an alignment pattern on raw luminance: dark center,
// light ring (~1.2 modules out), dark ring (~2.2 modules out).
// Lenient mode relaxes the ring thresholds for the multi-peak search
// (the decoder itself validates each candidate, so impostors are harmless).
function bullseyeScore(lum, w, h, cx, cy, mod, lenient) {
  const c0 = sampleLum(lum, w, h, cx, cy);
  if (c0 === null || c0 > (lenient ? 165 : 140)) return null;
  let m1 = 0;
  let m2 = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * 2 * Math.PI;
    const v1 = sampleLum(lum, w, h, cx + Math.cos(a) * 1.2 * mod, cy + Math.sin(a) * 1.2 * mod);
    const v2 = sampleLum(lum, w, h, cx + Math.cos(a) * 2.2 * mod, cy + Math.sin(a) * 2.2 * mod);
    if (v1 === null || v2 === null) return null;
    m1 += v1;
    m2 += v2;
  }
  m1 /= 8;
  m2 /= 8;
  if (m1 < (lenient ? 90 : 110) || m2 > (lenient ? 165 : 140)) return null;
  return 255 - c0 + m1 + (255 - m2);
}

export function refineAlignment(lum, w, h, px, py, mod) {
  const peaks = findAlignmentPeaks(lum, w, h, px, py, mod);
  return peaks.length && peaks[0].score > 480 ? peaks[0] : null;
}

// All bullseye peaks near a predicted alignment position, best first.
export function findAlignmentPeaks(lum, w, h, px, py, mod) {
  const R = Math.max(4, mod * 4);
  const step = Math.max(1, mod / 4);
  const peaks = [];
  for (let dy = -R; dy <= R; dy += step) {
    for (let dx = -R; dx <= R; dx += step) {
      const s = bullseyeScore(lum, w, h, px + dx, py + dy, mod, true);
      if (s !== null) peaks.push({ x: px + dx, y: py + dy, score: s });
    }
  }
  peaks.sort((a, b) => b.score - a.score);
  // Distinct peaks only (at least one module apart), capped.
  const distinct = [];
  for (const p of peaks) {
    if (distinct.length >= 4) break;
    if (distinct.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > mod)) distinct.push(p);
  }
  return distinct;
}

// Full decode from luminance pixels. Returns { text, version } or null.
export function decodeGrayscale(pixels, width, height) {
  const loc = locateFinders(pixels, width, height);
  if (!loc) return null;
  const { bin, w, h, clusters } = loc;
  // Attempt budget: hopeless frames bail out quickly so live scanning keeps
  // pulling fresh frames instead of grinding on one bad image.
  let attempts = 0;
  const attempt = (modules, n) => {
    attempts++;
    return decodeMatrix(modules, n);
  };

  // Best geometric triples first.
  const scored = [];
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      for (let k = j + 1; k < clusters.length; k++) {
        const t = tripleScore(clusters[i], clusters[j], clusters[k]);
        if (t) scored.push(t);
      }
    }
  }
  scored.sort((x, y) => x.score - y.score);

  for (const t of scored.slice(0, 6)) {
    if (attempts > 400) return null;
    // Resolve the version from the leg length: try every version whose
    // implied module size is close to the measured one, and let the
    // decoder (format info + Reed-Solomon + parsing) pick the right one.
    // The raw size estimate degrades under rotation/resampling, so a
    // single rounded division is too fragile here.
    const candidates = [];
    for (let version = 1; version <= 10; version++) {
      const n = 4 * version + 17;
      const mod = t.leg / (n - 7);
      const err = Math.abs(mod - t.size) / t.size;
      if (err < 0.35) candidates.push({ version, n, err });
    }
    candidates.sort((x, y) => x.err - y.err);
    if (!candidates.length) continue;
    const [q, r] = t.others;
    const assignments = [
      ["TL", "TR", "BL"],
      ["TL", "BL", "TR"],
      ["TR", "TL", "BL"],
      ["TR", "BL", "TL"],
      ["BL", "TL", "TR"],
      ["BL", "TR", "TL"],
    ];
    for (const { version, n } of candidates.slice(0, 3)) {
      const corners = {
        TL: [3.5, 3.5],
        TR: [n - 3.5, 3.5],
        BL: [3.5, n - 3.5],
      };
      for (const [ca, cb, cc] of assignments) {
        const srcCorners = [corners[ca], corners[cb], corners[cc]];
        const dstPts = [[t.vertex.x, t.vertex.y], [q.x, q.y], [r.x, r.y]];
        // Fit module coords -> pixel coords so each module center can be sampled.
        const map = solveAffine(srcCorners, dstPts);
        let affineModules = null;
        if (map) {
          const modules = sampleMatrix(bin, w, h, map, n);
          if (modules) {
            affineModules = modules;
            const decoded = attempt(modules, n);
            if (decoded) return decoded;
          }
        }
        // Escalate: true projective sampling using an alignment pattern as
        // the fourth reference point (handles photographed-at-a-tilt codes
        // that affine sampling can't model). Only when affine failed.
        // Several peaks are tried per position: the decoder validates each,
        // so lookalikes cost time but can't cause a wrong result.
        if (version >= 2 && map) {
          const mod = t.leg / (n - 7);
          for (const [amx, amy] of alignmentPositions(version)) {
            const px = map.a * amx + map.b * amy + map.c;
            const py = map.d * amx + map.e * amy + map.f;
            for (const peak of findAlignmentPeaks(pixels, w, h, px, py, mod)) {
              const H = solveHomography(
                [srcCorners[0], srcCorners[1], srcCorners[2], [amx, amy]],
                [dstPts[0], dstPts[1], dstPts[2], [peak.x, peak.y]]
              );
              if (!H) continue;
              const modules = sampleProjective(bin, w, h, H, n);
              if (!modules) continue;
              const decoded = attempt(modules, n);
              if (decoded) return decoded;
            }
          }
        }
        // Last resort: sub-module grid jitter around the affine fit. Covers
        // small systematic sampling offsets (e.g. biased finder centers on
        // large, steeply rotated codes). Gated on a readable format block:
        // if the grid were far off, jitter couldn't help anyway. Only when
        // everything above failed.
        if (map && affineModules && decodeFormatInfo(affineModules).length > 0) {
          const mod = t.leg / (n - 7);
          const d = mod / 2;
          for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [d, -d], [-d, d], [-d, -d]]) {
            if (attempts > 400) return null;
            const jm = { ...map, c: map.c + dx, f: map.f + dy };
            const modules = sampleMatrix(bin, w, h, jm, n);
            if (!modules) continue;
            const decoded = attempt(modules, n);
            if (decoded) return decoded;
          }
        }
      }
    }
  }
  return null;
}

// Finder localization stages (exported for testing): binarize, row scan,
// vertical cross-check, clustering. Returns { bin, w, h, clusters } or null.
export function locateFinders(pixels, width, height) {
  const w = width;
  const h = height;
  if (!pixels || pixels.length < w * h || w < 29 || h < 29) return null;
  const bin = binarize(pixels, w, h);

  const raw = [];
  for (let y = 0; y < h; y++) {
    for (const f of scanRowForFinders(bin, w, y)) {
      const v = crossCheckVertical(bin, w, h, f.x, f.y, f.size);
      if (v) raw.push(v);
    }
  }
  if (raw.length < 3) return null;
  const clusters = clusterCandidates(raw);
  if (clusters.length < 3) return null;
  return { bin, w, h, clusters };
}

// RGBA ImageData -> luminance (0 = black). Exported for the camera path.
export function toGrayscale(rgba, width, height) {
  const out = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    out[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  }
  return out;
}
