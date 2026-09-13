/* ═══════════════════════════════════════════════════════════════
   main.js — rendering the sieve, and the rest of the page.
   No dependencies. Everything degrades without JS.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  /* ═════════════════════ 1. THE SIEVE CANVAS ═════════════════════ */

  var hero     = $('.hero');
  var baseCv   = $('#sieveBase');
  var glowCv   = $('#sieveGlow');

  var COL = {
    pending:   [122, 134, 156],
    composite: [122, 134, 156],
    prime:     [232, 241, 255],
    gold:      [255, 193,  77],
    goldHot:   [255, 233, 176],
    cyan:      [ 86, 220, 255]
  };
  var rgba = function (c, a) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';
  };

  var S = null;           // sieve result
  var cols = 0, rows = 0, cell = 40, offX = 0, offY = 0, N = 0;
  var W = 0, H = 0, dpr = 1;
  var bctx = null, gctx = null;
  var anchors = {};       // Ramanujan value -> { id, title, n }
  var anchorList = [];
  var introDone = false;

  function collectAnchors() {
    anchors = {}; anchorList = [];
    $$('.card[data-r]').forEach(function (card) {
      var v = parseInt(card.getAttribute('data-r'), 10);
      if (!v) return;
      var t = $('.card-title', card);
      anchors[v] = {
        id: card.id,
        title: t ? t.textContent.trim() : '',
        el: card
      };
      anchorList.push(v);
    });
    anchorList.sort(function (a, b) { return a - b; });
  }

  function sizeCanvas(cv, ctxName) {
    cv.width  = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width  = W + 'px';
    cv.style.height = H + 'px';
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
  }

  function layout() {
    if (!hero || !baseCv) return false;
    var r = hero.getBoundingClientRect();
    W = Math.max(240, Math.round(r.width));
    H = Math.max(240, Math.round(r.height));
    dpr = clamp(window.devicePixelRatio || 1, 1, 2);

    cell = W < 560 ? 26 : W < 900 ? 34 : 40;
    cols = Math.max(6, Math.floor(W / cell));
    offX = Math.round((W - cols * cell) / 2);

    /* Start the grid below the header, so the low Ramanujan primes —
       which are the clickable project anchors — land in a clear band
       across the top instead of hiding behind the bar or the headline. */
    var bar = document.getElementById('bar');
    offY = (bar ? bar.getBoundingClientRect().height : 56) + 14;

    /* Reserve exactly as much of the hero as that band needs. The deepest
       anchor row depends on how many columns fit, so this is measured
       rather than guessed per breakpoint — narrow screens push 107 down. */
    var deepest = 0;
    for (var a = 0; a < anchorList.length; a++) {
      var r2 = Math.floor((anchorList[a] - 1) / cols);
      if (r2 > deepest) deepest = r2;
    }
    var need = Math.max(offY + (deepest + 1) * cell + (W < 760 ? 22 : 30),
                        W < 760 ? 150 : 210);
    hero.style.paddingTop = need + 'px';
    /* narrow layouts dim the grid below the band, where the copy sits */
    hero.style.setProperty('--band', need + 'px');

    /* padding changed the hero's height — re-measure before sizing canvases */
    H = Math.max(240, Math.round(hero.getBoundingClientRect().height));

    rows = Math.max(4, Math.ceil((H - offY) / cell));
    N = Math.min(cols * rows, 2400);

    /* test hook: lets the check suite assert against the real grid
       instead of re-deriving it and drifting out of sync */
    window.__grid = function () {
      return { cell: cell, cols: cols, rows: rows, offX: offX, offY: offY, N: N,
               anchors: anchorList.slice(), introDone: introDone };
    };

    bctx = sizeCanvas(baseCv);
    gctx = sizeCanvas(glowCv);

    S = window.Sieve.compute(N);
    return true;
  }

  function cellXY(i) {
    var k = i - 1;
    return {
      x: offX + (k % cols) * cell + cell / 2,
      y: offY + Math.floor(k / cols) * cell + cell / 2,
      row: Math.floor(k / cols)
    };
  }

  var fontFor = function (px, bold) {
    return (bold ? '700 ' : '400 ') + px + 'px ui-monospace, "Cascadia Mono", "SF Mono", Consolas, monospace';
  };

  /**
   * Draw one frame.
   * t = { fade, sieveK, primeUp, sweep }  — all 0..1 except sieveK (index)
   */
  function draw(t) {
    if (!bctx || !S) return;
    var fsz = Math.round(cell * 0.36);
    bctx.clearRect(0, 0, W, H);
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.font = fontFor(fsz, false);
    bctx.shadowBlur = 0;

    var bandRow = t.sweep * (rows + 3) - 1.5;
    var ignited = [];

    /* ── pass A: everything that is not an ignited Ramanujan prime ── */
    for (var i = 1; i <= N; i++) {
      var isComp = S.composite[i] === 1;
      var isR = S.isRamanujan[i] === 1;

      var ig = 0;
      if (isR && t.sweep > 0) {
        var p = cellXY(i);
        ig = clamp((bandRow - p.row) / 1.4 + 1, 0, 1);
      }
      if (ig > 0.02) { ignited.push({ i: i, ig: ig }); continue; }

      var col, alpha;
      if (isComp) {
        var struck = S.strikeOrder[i] < t.sieveK && (i > 1);
        var justNow = struck ? (t.sieveK - S.strikeOrder[i]) : 1e9;
        if (i === 1) {
          col = COL.composite; alpha = 0.10 * t.fade;          /* the unit: never in play */
        } else if (!struck) {
          col = COL.pending; alpha = 0.30 * t.fade;
        } else if (justNow < 55) {
          /* brief flash in the striking prime's moment */
          var f = 1 - justNow / 55;
          col = COL.cyan; alpha = (0.09 + 0.5 * f) * t.fade;
        } else {
          col = COL.composite; alpha = 0.085 * t.fade;
        }
      } else {
        col = COL.prime;
        alpha = (0.30 + 0.48 * t.primeUp) * t.fade;
      }

      var pt = cellXY(i);
      bctx.fillStyle = rgba(col, alpha);
      bctx.fillText(String(i), pt.x, pt.y);
    }

    /* ── the scan line, while the Ramanujan pass is running ── */
    if (t.sweep > 0 && t.sweep < 1) {
      var ly = offY + (bandRow + 0.5) * cell;
      var g = bctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0,   'rgba(255,193,77,0)');
      g.addColorStop(0.5, 'rgba(255,193,77,.42)');
      g.addColorStop(1,   'rgba(255,193,77,0)');
      bctx.fillStyle = g;
      bctx.fillRect(0, ly, W, 1);
    }

    /* ── pass B: the Ramanujan primes, with bloom ── */
    bctx.font = fontFor(fsz, true);
    for (var j = 0; j < ignited.length; j++) {
      var it = ignited[j];
      var q = cellXY(it.i);
      var isAnchor = Object.prototype.hasOwnProperty.call(anchors, it.i);
      var bloom = 1 - Math.abs(it.ig - 0.55) * 1.2;   /* brightest as it lights */
      bctx.shadowColor = 'rgba(255,193,77,' + (0.55 * it.ig).toFixed(3) + ')';
      bctx.shadowBlur = (isAnchor ? 16 : 9) * it.ig;
      bctx.fillStyle = rgba(
        bloom > 0.55 ? COL.goldHot : COL.gold,
        (isAnchor ? 0.95 : 0.78) * it.ig
      );
      bctx.fillText(String(it.i), q.x, q.y);
    }
    bctx.shadowBlur = 0;
  }

  /* ═════════════════════ 2. READOUT ═════════════════════ */

  var ro = {
    phase:  $('#roPhase'),
    pi:     $('#roPi'),
    r:      $('#roR'),
    verify: $('#roVerify')
  };
  var lastRO = 0;
  function setRO(phase, force) {
    var now = performance.now();
    if (!force && now - lastRO < 90) return;
    lastRO = now;
    if (ro.phase) ro.phase.textContent = phase;
  }
  function finalRO() {
    if (!S) return;
    if (ro.phase)  ro.phase.textContent = 'N = ' + S.N + ', complete';
    if (ro.pi)     ro.pi.textContent = S.piN + ' primes';
    if (ro.r)      ro.r.textContent = 'R₁…R' + sub(S.R.length) + ' located';
    if (ro.verify) {
      var v = S.verify;
      ro.verify.textContent = v.ok
        ? 'A104272 ✓ ' + v.agree + '/' + v.checked
        : 'MISMATCH at n=' + (v.agree + 1);
      ro.verify.className = 'readout-v ' + (v.ok ? 'ok' : 'bad');
    }
    var fm = $('#footMath');
    if (fm && S.verify.ok) {
      fm.textContent = S.N + ' integers sieved in your browser · ' + S.piN +
        ' primes · first ' + S.verify.checked + ' Rₙ match OEIS A104272';
    }
  }
  function sub(n) {
    var m = { 0:'₀',1:'₁',2:'₂',3:'₃',4:'₄',
              5:'₅',6:'₆',7:'₇',8:'₈',9:'₉' };
    return String(n).split('').map(function (d) { return m[d]; }).join('');
  }

  /* ═════════════════════ 3. INTRO ANIMATION ═════════════════════ */

  var T = { fadeEnd: 380, sieveEnd: 2150, primeEnd: 2520, sweepEnd: 3450 };

  function runIntro() {
    if (!S) return;
    if (reduceMotion) {
      draw({ fade: 1, sieveK: 1e9, primeUp: 1, sweep: 1 });
      introDone = true;
      finalRO();
      startIdle();
      return;
    }
    var start = performance.now();
    var total = S.order.length;

    function frame(now) {
      var e = now - start;
      var t = { fade: 0, sieveK: 0, primeUp: 0, sweep: 0 };

      t.fade = clamp(e / T.fadeEnd, 0, 1);

      if (e > T.fadeEnd) {
        var sp = clamp((e - T.fadeEnd) / (T.sieveEnd - T.fadeEnd), 0, 1);
        t.sieveK = Math.pow(sp, 0.78) * total;
        var idx = Math.min(total - 1, Math.floor(t.sieveK));
        if (idx >= 0 && S.order[idx]) {
          setRO('striking multiples of ' + S.strikeBy[S.order[idx]]);
        }
      }
      if (e > T.sieveEnd) {
        t.sieveK = 1e9;
        t.primeUp = clamp((e - T.sieveEnd) / (T.primeEnd - T.sieveEnd), 0, 1);
        setRO('isolating primes');
        if (ro.pi) ro.pi.textContent = S.piN + ' primes';
      }
      if (e > T.primeEnd) {
        t.primeUp = 1;
        t.sweep = clamp((e - T.primeEnd) / (T.sweepEnd - T.primeEnd), 0, 1);
        setRO('testing π(x) − π(x/2) ≥ n');
        if (ro.r) {
          var got = 0;
          for (var a = 0; a < S.R.length; a++) {
            var pr = cellXY(S.R[a]);
            if (pr.row <= t.sweep * (rows + 3) - 1.5) got++;
          }
          ro.r.textContent = got + ' found';
        }
      }

      draw(t);

      if (e < T.sweepEnd) {
        requestAnimationFrame(frame);
      } else {
        draw({ fade: 1, sieveK: 1e9, primeUp: 1, sweep: 1 });
        introDone = true;
        finalRO();
        startIdle();
      }
    }
    requestAnimationFrame(frame);
  }

  /* ═════════════════════ 4. IDLE GLOW ═════════════════════ */
  /* Only the anchored Ramanujan primes breathe, on their own small
     canvas, and only while the hero is actually on screen. */

  var idleRAF = null, heroVisible = true;

  function idleFrame(now) {
    if (!gctx || !S) return;
    gctx.clearRect(0, 0, W, H);
    var fsz = Math.round(cell * 0.36);
    gctx.textAlign = 'center';
    gctx.textBaseline = 'middle';
    gctx.font = fontFor(fsz, true);

    for (var a = 0; a < anchorList.length; a++) {
      var v = anchorList[a];
      if (v > N) continue;
      var p = cellXY(v);
      var ph = (now / 1000) * 0.7 + a * 0.55;
      var puls = 0.5 + 0.5 * Math.sin(ph);
      gctx.shadowColor = 'rgba(255,193,77,' + (0.3 + 0.4 * puls).toFixed(3) + ')';
      gctx.shadowBlur = 10 + 14 * puls;
      gctx.fillStyle = rgba(COL.goldHot, 0.30 + 0.45 * puls);
      gctx.fillText(String(v), p.x, p.y);
    }
    gctx.shadowBlur = 0;
    idleRAF = requestAnimationFrame(idleFrame);
  }

  function startIdle() {
    if (reduceMotion || idleRAF !== null || !heroVisible) return;
    idleRAF = requestAnimationFrame(idleFrame);
  }
  function stopIdle() {
    if (idleRAF !== null) { cancelAnimationFrame(idleRAF); idleRAF = null; }
    if (gctx) gctx.clearRect(0, 0, W, H);
  }

  /* ═════════════════════ 5. POINTING AT NUMBERS ═════════════════════ */

  var tip = null;
  function ensureTip() {
    if (tip || !hero) return;
    tip = document.createElement('div');
    tip.className = 'sieve-tip';
    tip.setAttribute('role', 'status');
    tip.style.cssText =
      'position:absolute;z-index:4;pointer-events:none;opacity:0;' +
      'transform:translate(-50%,-150%);transition:opacity .18s ease;' +
      'background:rgba(10,12,21,.96);border:1px solid rgba(255,193,77,.5);' +
      'border-radius:9px;padding:8px 13px;max-width:min(280px,70vw);' +
      'font:12.5px/1.45 ui-monospace,"Cascadia Mono",Consolas,monospace;' +
      'color:#ffe9b0;box-shadow:0 10px 34px rgba(0,0,0,.6);white-space:normal;';
    hero.appendChild(tip);
  }

  function indexAt(clientX, clientY) {
    if (!hero) return 0;
    var r = hero.getBoundingClientRect();
    var x = clientX - r.left - offX;
    var y = clientY - r.top - offY;
    if (x < 0 || y < 0) return 0;
    var c = Math.floor(x / cell), rw = Math.floor(y / cell);
    if (c < 0 || c >= cols || rw < 0 || rw >= rows) return 0;
    var i = rw * cols + c + 1;
    return i >= 1 && i <= N ? i : 0;
  }

  /* Cells are small — especially on a phone. Snap to the nearest anchor
     within about three quarters of a cell so tapping one is realistic. */
  function anchorNear(clientX, clientY) {
    var exact = indexAt(clientX, clientY);
    if (exact && anchors[exact]) return exact;
    if (!hero) return 0;
    var r = hero.getBoundingClientRect();
    var px = clientX - r.left, py = clientY - r.top;
    var bestV = 0, bestD = cell * 0.75;
    for (var i = 0; i < anchorList.length; i++) {
      var v = anchorList[i];
      if (v > N) continue;
      var p = cellXY(v);
      var d = Math.hypot(p.x - px, p.y - py);
      if (d < bestD) { bestD = d; bestV = v; }
    }
    return bestV;
  }

  function overContent(target) {
    return !!(target && target.closest &&
      target.closest('.hero-inner, .readout, .hero-hint, .sieve-tip'));
  }

  function onMove(e) {
    if (!introDone || overContent(e.target)) { hideTip(); return; }
    var i = anchorNear(e.clientX, e.clientY);
    var a = i && anchors[i];
    if (!a) { hideTip(); hero.style.cursor = ''; return; }
    ensureTip();
    var p = cellXY(i);
    tip.innerHTML = '<b style="color:#ffc14d">R' + sub(S.indexOfR[i]) + ' = ' + i + '</b><br>' +
      a.title.replace(/[<>&]/g, '') + '<br>' +
      '<span style="color:#78849b">click to jump</span>';
    tip.style.left = p.x + 'px';
    tip.style.top = p.y - 8 + 'px';
    tip.style.opacity = '1';
    hero.style.cursor = 'pointer';
  }
  function hideTip() { if (tip) tip.style.opacity = '0'; }

  function onClick(e) {
    if (!introDone || overContent(e.target)) return;
    var i = anchorNear(e.clientX, e.clientY);
    var a = i && anchors[i];
    if (!a) return;
    var el = document.getElementById(a.id);
    if (!el) return;
    if (document.body.classList.contains('skim')) {
      /* details are hidden in skim mode — show the full card being jumped to */
      setSkim(false);
    }
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    el.classList.add('is-pinged');
    setTimeout(function () { el.classList.remove('is-pinged'); }, 2000);
    hideTip();
  }

  /* ═════════════════════ 6. SKIM MODE ═════════════════════ */

  var skimBtn = $('#skimToggle');
  function setSkim(on, persist) {
    document.body.classList.toggle('skim', on);
    if (skimBtn) {
      skimBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var lbl = $('.skim-label', skimBtn);
      if (lbl) lbl.textContent = on ? 'Skimming' : 'Skim';
    }
    if (persist !== false) {
      try { localStorage.setItem('gv-skim', on ? '1' : '0'); } catch (err) { /* private mode */ }
    }
    /* the hero shrinks in skim mode — the canvas has to follow */
    requestAnimationFrame(function () { relayout(true); });
  }
  if (skimBtn) {
    skimBtn.addEventListener('click', function () {
      setSkim(!document.body.classList.contains('skim'));
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 's' && e.key !== 'S') return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    setSkim(!document.body.classList.contains('skim'));
  });
  try {
    if (localStorage.getItem('gv-skim') === '1') setSkim(true, false);
  } catch (err) { /* ignore */ }

  /* ═════════════════════ 7. FILTERS ═════════════════════ */

  var allCards = [];
  function initFilters() {
    allCards = $$('.card[data-kind]');
    $$('.filter').forEach(function (btn) {
      var f = btn.getAttribute('data-filter');
      if (f !== 'all') {
        var n = allCards.filter(function (c) {
          return (c.getAttribute('data-kind') || '').split(/\s+/).indexOf(f) > -1;
        }).length;
        var s = document.createElement('span');
        s.className = 'filter-n';
        s.textContent = n;
        btn.appendChild(document.createTextNode(' '));
        btn.appendChild(s);
      }
      btn.addEventListener('click', function () {
        $$('.filter').forEach(function (b) { b.classList.toggle('is-on', b === btn); });
        allCards.forEach(function (c) {
          var kinds = (c.getAttribute('data-kind') || '').split(/\s+/);
          var show = f === 'all' || kinds.indexOf(f) > -1;
          c.classList.toggle('is-hidden', !show);
        });
      });
    });
  }

  /* ═════════════════════ 8. SCROLL BEHAVIOUR ═════════════════════ */

  function initScroll() {
    var bar = $('#bar');
    var onScroll = function () {
      if (bar) bar.classList.toggle('is-stuck', window.scrollY > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (!('IntersectionObserver' in window)) {
      $$('.reveal').forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    /* reveals — added here so a no-JS page is never left invisible */
    var targets = $$('.card, .method, .rec, .sec-head, .ledger-item, .contact-main, .portrait');
    targets.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    targets.forEach(function (el) { io.observe(el); });

    /* which section am I in */
    var links = {};
    $$('.bar-nav a').forEach(function (a) {
      links[a.getAttribute('href').slice(1)] = a;
    });
    var secIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var a = links[en.target.id];
        if (!a) return;
        if (en.isIntersecting) {
          $$('.bar-nav a').forEach(function (x) { x.classList.remove('is-current'); });
          a.classList.add('is-current');
        }
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    ['work', 'method', 'record', 'contact'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) secIO.observe(el);
    });

    /* pause the idle glow when the hero is off screen */
    if (hero) {
      var heroIO = new IntersectionObserver(function (entries) {
        heroVisible = entries[0].isIntersecting;
        document.body.classList.toggle('past-hero', !heroVisible);
        if (heroVisible && introDone) startIdle(); else stopIdle();
      }, { threshold: 0.01 });
      heroIO.observe(hero);
    }
  }

  /* ═════════════════════ 9. RESIZE ═════════════════════ */

  var resizeTimer = null, lastW = 0, lastH = 0;
  function relayout(force) {
    var r = hero ? hero.getBoundingClientRect() : null;
    if (!r) return;
    /* ignore the mobile URL-bar height jitter */
    if (!force && Math.abs(r.width - lastW) < 2 && Math.abs(r.height - lastH) < 90) return;
    lastW = r.width; lastH = r.height;
    stopIdle();
    if (!layout()) return;
    collectAnchors();
    draw({ fade: 1, sieveK: 1e9, primeUp: 1, sweep: 1 });
    introDone = true;
    finalRO();
    startIdle();
  }

  /* ═════════════════════ 9b. CONTACT FORM ═════════════════════ */

  function initContactForm() {
    var form = $('#contactForm');
    var status = $('#cf-status');
    var submitBtn = $('#cf-submit');
    if (!form || !status) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Send message';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Sending...';
      }
      status.className = 'form-status';
      status.textContent = '';

      var formData = new FormData(form);

      fetch(form.action, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      })
      .then(function (res) {
        if (res.ok) {
          status.className = 'form-status is-success';
          status.textContent = '✓ Thank you! Your message has been delivered directly to Gaurav’s inbox.';
          form.reset();
        } else {
          throw new Error('Form submission failed');
        }
      })
      .catch(function () {
        // Fallback info if network fails
        status.className = 'form-status is-error';
        status.innerHTML = 'Could not send directly via form. Please email directly at <a href="mailto:g.vyas@op.iitg.ac.in" style="color:inherit;text-decoration:underline;">g.vyas@op.iitg.ac.in</a> or <a href="mailto:gaurav.vyas.1729@gmail.com" style="color:inherit;text-decoration:underline;">gaurav.vyas.1729@gmail.com</a>.';
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
      });
    });
  }

  /* ═════════════════════ 10. GO ═════════════════════ */

  function init() {
    var y = $('#year');
    if (y) y.textContent = String(new Date().getFullYear());

    initFilters();
    initScroll();
    initContactForm();

    if (hero && baseCv && window.Sieve) {
      collectAnchors();
      if (layout()) {
        lastW = hero.getBoundingClientRect().width;
        lastH = hero.getBoundingClientRect().height;
        runIntro();
        hero.addEventListener('pointermove', onMove, { passive: true });
        hero.addEventListener('pointerleave', hideTip, { passive: true });
        hero.addEventListener('click', onClick);
      }
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () { relayout(false); }, 180);
      });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopIdle();
        else if (introDone) startIdle();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
