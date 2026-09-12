/* ═══════════════════════════════════════════════════════════════
   sieve.js — the actual mathematics.

   Nothing here is decorative. The Sieve of Eratosthenes really runs,
   pi(x) is a real prefix count, and the Ramanujan primes are derived
   from the defining condition, then checked against the published
   head of OEIS A104272. If the check fails, the page says so.

   R_n  =  the least integer such that  pi(x) - pi(x/2) >= n  for all x >= R_n
        =  1 + max{ x : pi(x) - pi(floor(x/2)) < n }
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* First 24 terms of OEIS A104272 (Ramanujan primes), used as an
     independent check on everything computed below. */
  var A104272_HEAD = [
    2, 11, 17, 29, 41, 47, 59, 67, 71, 97, 101, 107,
    127, 149, 151, 167, 179, 181, 227, 229, 233, 239, 241, 263
  ];

  /**
   * Run the sieve and everything derived from it.
   * @param {number} N upper bound (inclusive)
   */
  function compute(N) {
    if (!(N >= 2)) N = 2;

    /* ---- 1. Sieve of Eratosthenes, recording strike order ---- */
    var composite = new Uint8Array(N + 1);
    var strikeOrder = new Int32Array(N + 1); // when each composite fell
    var strikeBy = new Int32Array(N + 1);    // which prime struck it
    var order = [];                          // composites, in the order struck

    composite[0] = 1;
    if (N >= 1) composite[1] = 1;

    for (var p = 2; p * p <= N; p++) {
      if (composite[p]) continue;
      for (var m = p * p; m <= N; m += p) {
        if (!composite[m]) {
          composite[m] = 1;
          strikeBy[m] = p;
          order.push(m);
        }
      }
    }
    for (var k = 0; k < order.length; k++) strikeOrder[order[k]] = k;

    /* ---- 2. pi(x), as a running count ---- */
    var pi = new Int32Array(N + 1);
    var primes = [];
    var run = 0;
    for (var x = 1; x <= N; x++) {
      if (x >= 2 && !composite[x]) { run++; primes.push(x); }
      pi[x] = run;
    }

    /* ---- 3. The Ramanujan counting function ---- */
    /* c(x) = pi(x) - pi(floor(x/2)) : primes in the interval (x/2, x] */
    var cx = new Int32Array(N + 1);
    var maxC = 0;
    for (var y = 1; y <= N; y++) {
      var v = pi[y] - pi[y >> 1];
      cx[y] = v;
      if (v > maxC) maxC = v;
    }

    /* lastOcc[k] = largest x with c(x) exactly k; prefix-max gives
       largest x with c(x) <= k, which is what R_n needs. */
    var lastOcc = new Int32Array(maxC + 2);
    for (var z = 1; z <= N; z++) lastOcc[cx[z]] = z;

    var atMost = new Int32Array(maxC + 2);
    var best = 0;
    for (var j = 0; j <= maxC; j++) {
      if (lastOcc[j] > best) best = lastOcc[j];
      atMost[j] = best;
    }

    /* R_n is only trustworthy while it sits well inside the sieved
       range — beyond that we cannot see whether c(x) dips again. */
    var horizon = Math.floor(N * 0.55);
    var R = [];
    for (var n = 1; n <= maxC; n++) {
      var r = atMost[n - 1] + 1;
      if (r > horizon) break;
      R.push(r);
    }

    var isRamanujan = new Uint8Array(N + 1);
    var indexOfR = new Int32Array(N + 1); // value -> n (1-based)
    for (var i = 0; i < R.length; i++) {
      isRamanujan[R[i]] = 1;
      indexOfR[R[i]] = i + 1;
    }

    /* ---- 4. Check against the published sequence ---- */
    var checked = Math.min(R.length, A104272_HEAD.length);
    var agree = checked;
    for (var q = 0; q < checked; q++) {
      if (R[q] !== A104272_HEAD[q]) { agree = q; break; }
    }
    /* Every Ramanujan prime must itself be prime — a second, independent
       property the computation has no excuse to get wrong. */
    var allPrime = R.every(function (v) { return v >= 2 && !composite[v]; });

    return {
      N: N,
      composite: composite,
      strikeOrder: strikeOrder,
      strikeBy: strikeBy,
      order: order,
      pi: pi,
      primes: primes,
      piN: pi[N],
      R: R,
      isRamanujan: isRamanujan,
      indexOfR: indexOfR,
      verify: {
        checked: checked,
        agree: agree,
        ok: agree === checked && checked > 0 && allPrime,
        allPrime: allPrime
      }
    };
  }

  global.Sieve = { compute: compute, A104272_HEAD: A104272_HEAD };

  /* Node-side test hook; ignored in the browser. */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.Sieve;
  }
})(typeof window !== 'undefined' ? window : globalThis);
