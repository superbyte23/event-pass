// Dependency-free PNG renderer for ticket QR codes.
// Shared by real ticket emails and the sample ticket used by mail tests.

import { deflateSync } from 'node:zlib';

import { createQRMatrix } from './qr-encode.js';

const CRC_TABLE = (() => {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32([...typeBuf, ...data]), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

export function qrPngBuffer(text, { scale = 8, quiet = 4 } = {}) {
  const qr = createQRMatrix(text);
  const dim = qr.size + quiet * 2;
  const width = dim * scale;
  const rows = [];
  for (let r = 0; r < dim; r++) {
    const row = Buffer.alloc(1 + width, 255);
    row[0] = 0; // filter type 0 (None)
    for (let c = 0; c < dim; c++) {
      const mr = r - quiet;
      const mc = c - quiet;
      const dark = mr >= 0 && mc >= 0 && mr < qr.size && mc < qr.size && qr.at(mr, mc);
      if (!dark) continue;
      for (let x = 0; x < scale; x++) {
        row[1 + c * scale + x] = 0;
      }
    }
    rows.push(row);
  }
  const expanded = [];
  for (let r = 0; r < dim; r++) {
    for (let y = 0; y < scale; y++) expanded.push(rows[r]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(width, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  const idat = deflateSync(Buffer.concat(expanded));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
