// Genskriver testdata-fixturen fra en ægte .aeon-fil (dev-værktøj, ikke i build/test):
//   node tools/make-fixture.mjs "C:/Users/jensa/OneDrive/Documents/Tidslinie-Historien Til nu.aeon"
// Kun JSON-blokken gemmes (billeder udelades) — den skal kunne findes af locateAeonJson.
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
if (!src) {
  console.error('brug: node tools/make-fixture.mjs "<sti til .aeon-fil>"');
  process.exit(1);
}
const bytes = readFileSync(src);

function jsonEnd(b, s) {
  let depth = 0, inStr = false, esc = false;
  for (let i = s; i < b.length; i++) {
    const c = b[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === 0x5c) esc = true;
      else if (c === 0x22) inStr = false;
      continue;
    }
    if (c === 0x22) inStr = true;
    else if (c === 0x7b || c === 0x5b) depth++;
    else if (c === 0x7d || c === 0x5d) {
      if (--depth === 0) return i + 1;
    }
  }
  return -1;
}

let out = null;
for (const pat of ['{"fileVersion"', '{"definitions"', '{"data"']) {
  for (let at = bytes.indexOf(Buffer.from(pat, 'latin1')); at >= 0; at = bytes.indexOf(Buffer.from(pat, 'latin1'), at + 1)) {
    const end = jsonEnd(bytes, at);
    if (end < 0) continue;
    let raw;
    try { raw = JSON.parse(bytes.subarray(at, end).toString('utf8')); } catch { continue; }
    const d = raw.core?.data ?? raw.data;
    const items = d?.itemsById ?? d?.items?.byId ?? d?.items;
    if (items) { out = JSON.stringify(raw); console.log('JSON-blok ved', at, '->', Object.keys(items).length, 'poster'); break; }
  }
  if (out) break;
}
if (!out) { console.error('ingen gyldig Aeon-JSON fundet'); process.exit(1); }

writeFileSync(new URL('../testdata/aeon-real-fixture.json', import.meta.url), out);
console.log('skrev testdata/aeon-real-fixture.json', out.length, 'bytes');
