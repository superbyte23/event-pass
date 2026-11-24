import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const fontDir = path.join(process.cwd(), 'src', 'server', 'fonts');

function encode(name) {
  return readFileSync(path.join(fontDir, name)).toString('base64');
}

function chunks(value) {
  return value
    .match(/.{1,120}/g)
    .map((part) => `  ${JSON.stringify(part)}`)
    .join(',\n');
}

const regular = encode('Geist-Regular.ttf');
const bold = encode('Geist-Bold.ttf');
const source = `// Generated from src/server/fonts/Geist-*.ttf (Geist, SIL OFL 1.1).
// Run node scripts/generate-ticket-font-data.mjs after replacing the fonts.
// See src/server/fonts/OFL.txt for the license.
export const GEIST_REGULAR_BASE64 = [
${chunks(regular)},
].join('');

export const GEIST_BOLD_BASE64 = [
${chunks(bold)},
].join('');
`;

writeFileSync(path.join(process.cwd(), 'src', 'server', 'ticket-font-data.js'), source);
console.log(`Wrote src/server/ticket-font-data.js (${source.length} bytes)`);
