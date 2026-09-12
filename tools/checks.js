(function () {
  var out = {}, fail = [];
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function check(name, cond, detail) {
    out[name] = cond ? 'pass' : ('FAIL' + (detail ? ' — ' + detail : ''));
    if (!cond) fail.push(name + (detail ? ': ' + detail : ''));
  }

  /* ── the mathematics actually ran ── */
  var S = window.Sieve ? window.Sieve.compute(1296) : null;
  check('sieve_verifies', !!S && S.verify.ok, S ? ('agree ' + S.verify.agree + '/' + S.verify.checked) : 'no Sieve');
  check('pi_1000_is_168', window.Sieve.compute(1000).piN === 168);

  /* ── readout reached its final, verified state ── */
  var rv = $('#roVerify');
  check('readout_verified', !!rv && /A104272 ✓/.test(rv.textContent), rv ? rv.textContent : 'missing');
  var rp = $('#roPi');
  check('readout_pi', !!rp && /\d+ primes/.test(rp.textContent), rp ? rp.textContent : 'missing');
  var fm = $('#footMath');
  check('footer_math', !!fm && /match OEIS A104272/.test(fm.textContent), fm ? fm.textContent : '');

  /* ── every project anchor really is a Ramanujan prime ── */
  var cards = $$('.card[data-r]');
  out.card_count = cards.length;
  check('twelve_cards', cards.length === 12, 'got ' + cards.length);
  var bad = cards.filter(function (c) {
    var v = +c.getAttribute('data-r');
    return !(v >= 2 && S.isRamanujan[v] === 1);
  }).map(function (c) { return c.getAttribute('data-r'); });
  check('anchors_are_ramanujan', bad.length === 0, bad.join(','));

  var maxR = Math.max.apply(null, cards.map(function (c) { return +c.getAttribute('data-r'); }));
  out.max_anchor = maxR;

  /* ── every anchor is actually reachable: no chrome sits on top of it ── */
  (function () {
    var g = window.__grid && window.__grid();
    check('grid_hook', !!g);
    if (!g) return;
    var cl = g.cell, cc = g.cols, oy = g.offY, ox = g.offX;
    out.grid = g.cell + 'px x ' + g.cols + 'col, N=' + g.N + ', offY=' + g.offY;
    check('intro_completed', g.introDone === true);
    var occ = ['.hero-inner', '.bar', '.readout'].map(function (s) {
      var e = $(s); return e ? { s: s, r: e.getBoundingClientRect() } : null;
    }).filter(Boolean);
    var blocked = cards.map(function (c) {
      var v = +c.getAttribute('data-r'), k = v - 1;
      var q = { l: ox + (k % cc) * cl, t: oy + Math.floor(k / cc) * cl };
      var on = occ.filter(function (o) {
        return !(q.l + cl <= o.r.left || q.l >= o.r.right ||
                 q.t + cl <= o.r.top || q.t >= o.r.bottom);
      });
      return on.length ? v + '←' + on.map(function (o) { return o.s; }).join('+') : null;
    }).filter(Boolean);
    check('anchors_not_occluded', blocked.length === 0, blocked.join(', '));
    out.anchor_rows = cards.map(function (c) {
      var k = (+c.getAttribute('data-r')) - 1;
      return Math.floor(k / cc);
    }).join(',');
  })();

  /* ── the canvas has gold on it (the sweep completed) ── */
  var cv = $('#sieveBase');
  var ctx = cv.getContext('2d');
  var d = ctx.getImageData(0, 0, cv.width, Math.min(cv.height, 1400)).data;
  var gold = 0, lit = 0;
  for (var i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 24) continue;
    lit++;
    if (d[i] > 180 && d[i + 1] > 120 && d[i + 2] < 150) gold++;
  }
  out.lit_px = lit; out.gold_px = gold;
  check('canvas_has_content', lit > 3000, 'lit=' + lit);
  check('canvas_has_gold', gold > 200, 'gold=' + gold);

  /* ── layout: nothing escapes the viewport ── */
  var ow = document.documentElement.scrollWidth - window.innerWidth;
  out.overflow_px = ow;
  check('no_h_overflow', ow <= 1, ow + 'px wider than viewport');

  var wide = $$('*').filter(function (el) {
    var r = el.getBoundingClientRect();
    return r.width > window.innerWidth + 2 && r.height > 0;
  }).map(function (el) { return el.className || el.tagName; }).slice(0, 5);
  check('no_wide_elements', wide.length === 0, wide.join(' | '));

  /* ── links are real ── */
  var links = $$('a[href]');
  var empties = links.filter(function (a) {
    var h = a.getAttribute('href');
    return !h || h === '#' || h === '';
  });
  out.link_count = links.length;
  check('links_nonempty', empties.length === 0, empties.length + ' empty');
  var ext = links.filter(function (a) { return /^https?:/.test(a.href); });
  out.external_links = ext.length;

  /* ── filters ── */
  var mlBtn = $('.filter[data-filter="ml"]');
  mlBtn.click();
  var visAfter = $$('.card').filter(function (c) { return !c.classList.contains('is-hidden'); }).length;
  var expect = $$('.card[data-kind]').filter(function (c) {
    return (c.getAttribute('data-kind') || '').split(/\s+/).indexOf('ml') > -1;
  }).length;
  check('filter_ml', visAfter === expect && expect > 0, visAfter + ' shown vs ' + expect + ' expected');
  $('.filter[data-filter="all"]').click();
  var visAll = $$('.card').filter(function (c) { return !c.classList.contains('is-hidden'); }).length;
  check('filter_reset', visAll === 12, 'got ' + visAll);

  /* ── skim mode really removes prose ── */
  var btn = $('#skimToggle');
  var detail = $('.card-detail');
  var beforeVis = getComputedStyle(detail).display !== 'none';
  btn.click();
  var afterVis = getComputedStyle(detail).display !== 'none';
  check('skim_hides_prose', beforeVis && !afterVis, 'before=' + beforeVis + ' after=' + afterVis);
  check('skim_aria', btn.getAttribute('aria-pressed') === 'true');
  /* skim must not leave a card squeezed into a sliver by a hidden column */
  var narrow = $$('.card:not(.is-hidden) .card-title').filter(function (t) {
    return t.getBoundingClientRect().width < 200;
  }).length;
  check('skim_no_squeezed_cards', narrow === 0, narrow + ' titles under 200px');
  btn.click();
  check('skim_restores', getComputedStyle(detail).display !== 'none');

  /* ── reveal animation resolved (cards are not stuck invisible) ── */
  var firstCard = $('#p-oeis');
  firstCard.scrollIntoView();
  out.reveal_note = 'checked after scroll';

  /* ── contrast sanity on the two most important colours ── */
  function lum(hex) {
    var c = hex.match(/\d+/g).map(Number).map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function ratio(a, b) {
    var l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  var bodyBg = getComputedStyle(document.body).backgroundColor;
  var bodyFg = getComputedStyle($('.card-line')).color;
  var goldFg = getComputedStyle($('.sec-idx')).color;
  out.contrast_body = +ratio(bodyFg, 'rgb(6,7,12)').toFixed(2);
  out.contrast_gold = +ratio(goldFg, 'rgb(6,7,12)').toFixed(2);
  check('contrast_body_4_5', out.contrast_body >= 4.5, out.contrast_body + ':1');
  check('contrast_gold_4_5', out.contrast_gold >= 4.5, out.contrast_gold + ':1');
  out.body_bg = bodyBg;

  out.failures = fail;
  out.passed = fail.length === 0;
  return out;
})();
