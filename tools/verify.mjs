/* Node-only verification of the mathematics the page claims to do.
   No browser, no dependencies — this is the gate CI runs on every push.

   If this fails, the site is telling visitors something untrue, and the
   deploy should not happen. */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Sieve = require('../assets/js/sieve.js');

let failed = 0;
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failed++;
};

/* Published values, independent of anything this repo computes. */
const PI = { 10: 4, 100: 25, 1000: 168, 10000: 1229, 100000: 9592 };
const A104272 = Sieve.A104272_HEAD;

console.log('\nsieve of eratosthenes');
for (const [n, expected] of Object.entries(PI)) {
  const got = Sieve.compute(+n).piN;
  ok(`pi(${n}) = ${expected}`, got === expected, got === expected ? '' : `got ${got}`);
}

console.log('\nramanujan primes (OEIS A104272)');
{
  const r = Sieve.compute(4000);
  const head = r.R.slice(0, A104272.length);
  ok(`first ${A104272.length} terms match the published sequence`,
    JSON.stringify(head) === JSON.stringify(A104272),
    JSON.stringify(head.slice(0, 6)));
  ok('every R_n is itself prime', r.verify.allPrime);
  ok('verify.ok is set', r.verify.ok === true);

  /* R_n must genuinely satisfy its defining condition, not merely match a
     table: for each n, pi(x) - pi(x/2) >= n for every x >= R_n in range. */
  let holds = true, witness = '';
  for (let n = 1; n <= Math.min(30, r.R.length); n++) {
    const Rn = r.R[n - 1];
    for (let x = Rn; x <= r.N; x++) {
      if (r.pi[x] - r.pi[x >> 1] < n) { holds = false; witness = `n=${n}, x=${x}`; break; }
    }
    if (!holds) break;
    /* and R_n - 1 must fail it, or R_n would not be least */
    const x0 = Rn - 1;
    if (x0 >= 1 && r.pi[x0] - r.pi[x0 >> 1] >= n) {
      holds = false; witness = `n=${n} not minimal`; break;
    }
  }
  ok('R_n satisfies and minimally satisfies its definition', holds, witness);
}

console.log('\nstability across grid sizes the page actually uses');
for (const N of [546, 570, 616, 736, 792, 1248, 2400]) {
  const r = Sieve.compute(N);
  const k = Math.min(r.R.length, A104272.length);
  const agree = JSON.stringify(r.R.slice(0, k)) === JSON.stringify(A104272.slice(0, k));
  ok(`N=${N}: ${r.R.length} Ramanujan primes, first ${k} agree`, agree && r.verify.ok);
}

console.log('\nthe twelve project anchors are Ramanujan primes');
{
  const anchors = [2, 11, 17, 29, 41, 47, 59, 67, 71, 97, 101, 107];
  const r = Sieve.compute(546); /* the smallest grid the page ever builds */
  const missing = anchors.filter(v => !r.isRamanujan[v]);
  ok('all 12 anchors present in the smallest grid', missing.length === 0, missing.join(','));
  ok('anchors are exactly R_1..R_12',
    JSON.stringify(r.R.slice(0, 12)) === JSON.stringify(anchors));
}

console.log(failed === 0
  ? '\nAll verification passed.\n'
  : `\n${failed} check(s) FAILED.\n`);
process.exit(failed === 0 ? 0 : 1);
