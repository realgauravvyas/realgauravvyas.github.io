# realgauravvyas.github.io

My portfolio. The whole page is built around a sieve that actually runs.

**Live:** <https://realgauravvyas.github.io/>

## The idea

Most portfolios are a list. This one is a filter.

The hero renders the integers 1…N as a grid and runs a real Sieve of
Eratosthenes across them — composites are struck out in the order the
algorithm strikes them, primes are left standing, and then a second pass
tests the Ramanujan condition

```
R_n  =  the least integer such that  π(x) − π(x/2) ≥ n  for all x ≥ R_n
```

The numbers that survive both passes light up gold. The first twelve of them —
2, 11, 17, 29, 41, 47, 59, 67, 71, 97, 101, 107 — are the twelve projects on
the page. Click one and it takes you there.

The metaphor is not decoration. Extending the count of Ramanujan primes is the
thing I am proudest of: OEIS A181671 lists `a(18)-a(23) from Gaurav Vyas,
Aug 15 2026` (moving the sequence from 10^17 to 10^23), and the base-2 sibling
OEIS A190502 extends the count below 2^n through 2^72 (`a(57)-a(72) from
Gaurav Vyas, Sep 13 2026`).

## Nothing here is faked

`assets/js/sieve.js` computes the sieve, π(x) as a running prefix count, and
R_n from its defining condition. It then checks its own output against the
published head of [OEIS A104272](https://oeis.org/A104272) and reports the
result in the corner of the hero. If the check ever failed, the page would say
`MISMATCH` instead of `✓`.

`tools/verify.mjs` is the same claim, enforced in CI. It asserts π(x) against
five published values, checks the first 24 Ramanujan primes against A104272,
confirms every R_n is prime, and — the part that matters — verifies that each
R_n *satisfies and minimally satisfies* its definition, rather than merely
matching a table. The deploy workflow will not publish if any of it fails.

## Skim mode

The page has two readings. Press **S**, or use the toggle in the header, and
the prose falls away and leaves the numbers — the same idea as the sieve,
applied to the writing. It is there because the people I most want to reach
are usually reading quickly.

## Running it

There is no build step and there are no dependencies.

```sh
# just open it
start index.html

# verify the mathematics (Node 18+, no packages)
node tools/verify.mjs

# drive a real browser and assert the rendered page
node tools/probe.mjs "file://$PWD/index.html" --w 1440 --h 900 \
  --wait 5200 --eval tools/checks.js
```

`tools/probe.mjs` is a small Chrome DevTools Protocol driver built on Node's
built-in WebSocket, so the test suite has no dependencies either. It runs in
real time deliberately: `--virtual-time-budget` starves `requestAnimationFrame`
and `IntersectionObserver`, which would make the animation and the reveals look
like they passed when they never ran.

## Layout

```
index.html              the page — all copy lives here, statically
assets/css/style.css    one stylesheet
assets/js/sieve.js      the mathematics (also runs under Node)
assets/js/main.js       canvas rendering, interaction, skim mode
tools/verify.mjs        CI gate: the maths must be right
tools/probe.mjs         dependency-free CDP driver
tools/checks.js         assertions run inside the page
tools/og.html           source of the social preview image
```

## Licence

Code MIT. Text, images and the description of my work are mine — please don't
reuse those as your own.
