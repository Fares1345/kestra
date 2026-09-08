/**
 * Runs the checks. `node tools/check/run.mjs` for all of them, or name the
 * ones you want: `node tools/check/run.mjs a11y rtl`.
 *
 * Needs the site served — `node server.js` — or KESTRA_URL pointing at it.
 */
import { BASE } from './harness.mjs';

const ALL = { a11y: './a11y.mjs', rtl: './rtl.mjs', shop: './shop.mjs', layout: './layout.mjs' };

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const names = wanted.length ? wanted : Object.keys(ALL);

for (const n of names) {
  if (!ALL[n]) {
    console.error(`unknown check "${n}". Available: ${Object.keys(ALL).join(', ')}`);
    process.exit(2);
  }
}

try {
  const res = await fetch(BASE, { method: 'HEAD' });
  if (!res.ok) throw new Error(String(res.status));
} catch {
  console.error(`Cannot reach ${BASE} — start the site first (node server.js) or set KESTRA_URL.`);
  process.exit(2);
}

console.log(`checking ${BASE}\n`);
const started = Date.now();
let failed = 0;
for (const n of names) {
  const check = (await import(ALL[n])).default;
  try {
    if (!(await check())) failed++;
  } catch (e) {
    console.log(`ERROR ${n}: ${e.message}`);
    failed++;
  }
}
const secs = ((Date.now() - started) / 1000).toFixed(0);
console.log(`\n${names.length - failed}/${names.length} passed in ${secs}s`);
process.exit(failed ? 1 : 0);
