// Ticket text is converted to SVG paths instead of relying on fonts installed
// in the renderer. Vercel's serverless runtime has no usable system fonts, so
// <text> elements come out as rectangles there. Geist is bundled as base64 in
// ticket-font-data.js (SIL OFL 1.1; see src/server/fonts/OFL.txt).

import { parse } from 'opentype.js';

import { GEIST_BOLD_BASE64, GEIST_REGULAR_BASE64 } from './ticket-font-data.js';

function parseFont(base64) {
  const buffer = Buffer.from(base64, 'base64');
  return parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

const fonts = {
  regular: parseFont(GEIST_REGULAR_BASE64),
  bold: parseFont(GEIST_BOLD_BASE64),
};

function fontFor(weight) {
  return weight === 'bold' || Number(weight) >= 600 ? fonts.bold : fonts.regular;
}

function glyphPathData(glyphs, font, size, x, y, letterSpacing) {
  const scale = size / font.unitsPerEm;
  let cursor = x;
  let previous = null;
  let data = '';
  for (const glyph of glyphs) {
    if (previous && font.getKerningValue) {
      cursor += font.getKerningValue(previous, glyph) * scale;
    }
    data += `${glyph.getPath(cursor, y, size).toPathData(2)} `;
    cursor += glyph.advanceWidth * scale + letterSpacing;
    previous = glyph;
  }
  return data;
}

function lineWidth(glyphs, font, size, letterSpacing) {
  const scale = size / font.unitsPerEm;
  let width = 0;
  let previous = null;
  for (const glyph of glyphs) {
    if (previous && font.getKerningValue) {
      width += font.getKerningValue(previous, glyph) * scale;
    }
    width += glyph.advanceWidth * scale + letterSpacing;
    previous = glyph;
  }
  return Math.max(0, width - (glyphs.length ? letterSpacing : 0));
}

/**
 * Render one or more lines as filled SVG paths.
 * `y` is the first baseline, matching the previous <text y="..."> placement.
 */
export function svgText({
  lines,
  x,
  y,
  size,
  lineHeight = size * 1.18,
  weight = '400',
  fill = '#0f172a',
  letterSpacing = 0,
  anchor = 'start',
  opacity = 1,
}) {
  const allLines = Array.isArray(lines) ? lines : String(lines ?? '').split('\n');
  const font = fontFor(weight);
  let data = '';

  allLines.forEach((line, index) => {
    const glyphs = font.stringToGlyphs(String(line));
    if (!glyphs.length) return;
    const width = lineWidth(glyphs, font, size, letterSpacing);
    const lineX = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
    data += glyphPathData(glyphs, font, size, lineX, y + index * lineHeight, letterSpacing);
  });

  if (!data) return '';
  return `<path d="${data.trim()}" fill="${fill}" fill-opacity="${opacity}" />`;
}
