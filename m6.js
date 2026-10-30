/* ==========================================================================
   Module 6: World models for pregnancy
   Audience: clinician-researcher in maternal and child health.
   Every trajectory, visit, patient and population in this module is
   SYNTHETIC, generated in the browser from seeded random numbers for
   teaching. No real participant or patient data appear anywhere.
   Interactives do real computation: a Kalman filter, a Monte Carlo
   simulation of confounding by indication, and a rule-based evidence ladder.
   ========================================================================== */
(function () {
  'use strict';
  var WM = window.WM, D = WM.draw;

  /* ====================================================================
     1. SMALL HELPERS
     ==================================================================== */
  function f2(n, d) { return WM.ui.fmt(n, d); }
  function sig(x) { return 1 / (1 + Math.exp(-x)); }
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / Math.max(1, a.length); }
  function smooth(t) { t = D.clamp(t); return t * t * (3 - 2 * t); }
  function noticeReadout(label) {
    var r = WM.readout(label, '');
    var v = r.el.querySelector('.wm-readout__val');
    v.style.fontFamily = 'var(--font-body)'; v.style.fontSize = '1rem'; v.style.lineHeight = '1.45';
    r.el.style.flexBasis = '100%';
    v.setAttribute('aria-live', 'polite');
    return r;
  }
  /* axes in data units */
  function frame(g, x, y, w, hh, xr, yr, o) {
    o = o || {};
    var sx = function (v) { return (v - xr[0]) / (xr[1] - xr[0]); }, sy = function (v) { return (v - yr[0]) / (yr[1] - yr[0]); };
    var A = D.axes(g, x, y, w, hh, {
      size: o.size || 20, xlabel: o.xl,
      xticks: (o.xt || []).map(function (v) { return [sx(v), o.xf ? o.xf(v) : f2(v)]; }),
      yticks: (o.yt || []).map(function (v) { return [sy(v), o.yf ? o.yf(v) : f2(v)]; })
    });
    if (o.yl) { g.save(); g.translate(x - (o.ylo || 64), y + hh / 2); g.rotate(-Math.PI / 2); D.text(g, o.yl, 0, 0, { size: 20, align: 'center', baseline: 'bottom', color: 'muted' }); g.restore(); }
    return { X: function (v) { return A.x(sx(v)); }, Y: function (v) { return A.y(sy(v)); }, x: x, y: y, w: w, h: hh, xr: xr, yr: yr };
  }
  function inPlot(g, M, fn) { g.save(); g.beginPath(); g.rect(M.x - 2, M.y - 6, M.w + 8, M.h + 8); g.clip(); try { fn(); } finally { g.restore(); } }
  function upto(pts, q) {
    var n = D.clamp(q) * (pts.length - 1), k = Math.floor(n), out = pts.slice(0, k + 1);
    if (k < pts.length - 1 && n > k) { var a = pts[k], b = pts[k + 1], f = n - k; out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
    return out;
  }
  function legend(g, c, x, y, items) {
    items.forEach(function (it) {
      if (it.k === 'dot') D.dot(g, x + 12, y, 7, { fill: it.c || c.reality });
      else if (it.k === 'ring') D.dot(g, x + 12, y, 7, { fill: false, stroke: it.c || c.error, lw: 2.5 });
      else if (it.k === 'band') D.box(g, x, y - 9, 30, 18, { fill: it.c || c.imagined, alpha: 0.25, stroke: false });
      else D.line(g, x, y, x + 30, y, { color: it.c || (it.k === 'dash' ? c.imagined : it.k === 'err' ? c.error : c.reality), lw: 3.5, dash: it.k === 'dash', alpha: it.a });
      var m = D.text(g, it.t, x + 40, y, { size: 20, baseline: 'middle', color: c.ink2 });
      x += 40 + m.width + 26;
    });
  }
  function tag(g, c, s) { D.text(g, s || 'synthetic, illustrative', 940, 22, { size: 20, font: 'mono', color: c.muted, align: 'right', baseline: 'middle' }); }
  function title(g, c, s, y) { D.text(g, s, 20, y || 22, { size: 22, weight: 700, baseline: 'middle', color: c.ink }); }
  function bar(g, x, y0, w, hgt, o) { D.box(g, x, y0 - hgt, w, hgt, o); }

  /* ====================================================================
     2. SYNTHETIC PHYSIOLOGY SHARED BY FIGURES
     Population prior: a gentle rise in systolic pressure across pregnancy,
     shaped like the pooled means in Loerup et al. 2019 (about 110 at 10 wk
     to about 116 at 40 wk, no substantial mid-pregnancy dip). Illustrative.
     ==================================================================== */
  function phys(w) { return 110.4 + 5.6 * (w - 10) / 30; }
  /* E1 case: vascular tone rises from 26 weeks, crossing 140 near 35 weeks */
  function e1true(w) { return phys(w) + 30 * smooth((w - 26) / 12); }
  var E1 = null;
  function e1d() {
    if (E1) return E1;
    var r = WM.rng('m6-e1'), vw = [9, 14, 20, 26, 30, 33, 36, 38];
    E1 = { vw: vw, vy: vw.map(function (w) { return e1true(w) + 5 * WM.gauss(r); }) };
    return E1;
  }
  function tl(g, o) {
    o = o || {};
    return frame(g, 120, o.y || 70, 780, o.h || 330, [8, 40], [90, 170], { xl: 'gestational age, weeks', yl: o.yl || 'systolic BP, mmHg', xt: [8, 16, 24, 32, 40], xf: String, yt: [100, 120, 140, 160], yf: String });
  }
  function truthLine(g, M, fn, a, b, o) {
    var pts = []; for (var w = a; w <= b + 1e-9; w += 0.5) pts.push([M.X(w), M.Y(fn(w))]);
    D.poly(g, pts, o);
  }

  /* ====================================================================
     3. EXPLAINER 1: a pregnancy as a hidden state
     Script
       0-12  The state: a continuous physiological quantity nobody sees whole.
       12-24 Observations: a few visits, irregular, noisy.
       24-36 Several channels, each a window on a different part of the state.
       36-50 Actions: aspirin, antihypertensive, delivery. A what-if branch.
       50-62 Outcomes on the clock, competing with delivery.
       62-74 The clock itself is uncertain: dating error moves every label.
       74-90 The loop: observe, filter, forecast, what-if, act.
     ==================================================================== */
  function e1s1(g, p, env) {
    var c = env.c, M = tl(g);
    D.line(g, M.X(8), M.Y(140), M.X(40), M.Y(140), { color: c.muted, lw: 1.5, dash: [3, 6] });
    D.text(g, '140, illustrative threshold', M.X(40), M.Y(140) - 10, { size: 18, color: c.muted, align: 'right' });
    inPlot(g, M, function () {
      truthLine(g, M, phys, 8, 40, { color: c.muted, lw: 2, dash: [2, 6], alpha: D.seg(p, 0.05, 0.3) });
      truthLine(g, M, e1true, 8, 8 + 32 * D.seg(p, 0.2, 0.9), { color: c.reality, lw: 3.5 });
    });
    D.text(g, 'population average', M.X(24), M.Y(phys(24)) + 26, { size: 18, color: c.muted, align: 'center', alpha: D.seg(p, 0.3, 0.45) });
    D.text(g, 'this pregnancy: the state, always present, never seen whole', 120, 44, { size: 21, color: c.ink2, alpha: D.seg(p, 0.5, 0.7) });
    tag(g, c);
  }
  function e1s2(g, p, env) {
    var c = env.c, M = tl(g), E = e1d();
    inPlot(g, M, function () { truthLine(g, M, e1true, 8, 40, { color: c.reality, lw: 3.5, alpha: 0.28 }); });
    E.vw.forEach(function (w, i) {
      var t = D.seg(p, 0.05 + i * 0.1, 0.15 + i * 0.1);
      if (t <= 0) return;
      var x = M.X(w), y = M.Y(E.vy[i]);
      D.line(g, x, M.Y(E.vy[i] - 10), x, M.Y(E.vy[i] + 10), { color: c.muted, lw: 1.5, alpha: t });
      D.dot(g, x, y, 8 * D.easeOut(t), { fill: c.reality });
      if (i === 3) D.text(g, 'clinic reading = state + noise', x + 14, y - 30, { size: 19, color: c.ink2, alpha: t, halo: true });
    });
    D.text(g, 'what the record holds: eight visits, unevenly spaced', 120, 44, { size: 21, color: c.ink2, alpha: D.seg(p, 0.8, 0.95) });
    legend(g, c, 130, 485, [{ k: 'line', t: 'hidden state', a: 0.35 }, { k: 'dot', t: 'observation' }]);
    tag(g, c);
  }
  function e1s3(g, p, env) {
    var c = env.c;
    var rows = [
      { t: 'blood pressure', w: [9, 14, 20, 26, 30, 33, 36, 38], s: 'vascular tone' },
      { t: 'ultrasound biometry', w: [12, 20, 32], s: 'fetal growth, dating' },
      { t: 'glucose (OGTT)', w: [26], s: 'glycaemic regulation' },
      { t: 'PlGF, uterine artery PI', w: [12], s: 'placental function' },
      { t: 'home BP device', w: [28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38], s: 'vascular tone, dense' }
    ];
    var x0 = 300, x1 = 900, X = function (w) { return x0 + (w - 8) / 32 * (x1 - x0); };
    title(g, c, 'each channel is a window on a different part of the state', 30);
    D.line(g, x0, 70, x1, 70, { color: c.muted, lw: 1.5 });
    [8, 16, 24, 32, 40].forEach(function (w) { D.line(g, X(w), 64, X(w), 76, { color: c.muted, lw: 1.5 }); D.text(g, w + ' wk', X(w), 56, { size: 17, font: 'mono', align: 'center', color: c.muted }); });
    rows.forEach(function (r, i) {
      var y = 125 + i * 76, t = D.seg(p, 0.05 + i * 0.16, 0.2 + i * 0.16);
      if (t <= 0) return;
      D.text(g, r.t, 20, y, { size: 20, weight: 600, baseline: 'middle', alpha: t });
      D.text(g, 'sees: ' + r.s, 20, y + 26, { size: 17, color: c.muted, baseline: 'middle', alpha: t });
      D.line(g, x0, y, x1, y, { color: c.faint, lw: 1 });
      r.w.forEach(function (w, j) { var u = D.seg(t, j / r.w.length, (j + 1) / r.w.length); if (u > 0) D.dot(g, X(w), y, (i === 4 ? 5 : 8) * D.easeOut(u), { fill: c.reality }); });
    });
    D.text(g, 'no single channel sees the whole state; the state is inferred from all of them', 20, 505, { size: 20, color: c.ink2, alpha: D.seg(p, 0.85, 1) });
    tag(g, c);
  }
  function e1s4(g, p, env) {
    var c = env.c, M = tl(g);
    inPlot(g, M, function () {
      truthLine(g, M, e1true, 8, 40, { color: c.reality, lw: 3.5, alpha: 0.28 });
      var q = D.seg(p, 0.45, 0.8);
      if (q > 0) {
        var pts = []; for (var w = 33; w <= 38; w += 0.5) pts.push([M.X(w), M.Y(e1true(33) + (e1true(w) - e1true(33)) * 0.3 - 10 * smooth((w - 33) / 2))]);
        D.poly(g, upto(pts, q), { color: c.imagined, lw: 3.5, dash: true });
        D.text(g, 'imagined: if treated at 33 wk', M.X(33) - 10, M.Y(122), { size: 19, color: c.imagined, align: 'right', alpha: D.seg(q, 0.5, 1), halo: true });
      }
    });
    var acts = [{ w: 12, t: 'aspirin from 12 wk', y: 134 }, { w: 33, t: 'antihypertensive', y: 163 }, { w: 38, t: 'delivery', y: 163 }];
    acts.forEach(function (a, i) {
      var t = D.seg(p, 0.05 + i * 0.15, 0.15 + i * 0.15);
      if (t <= 0) return;
      var yTop = M.Y(a.y), yEnd = M.Y(e1true(a.w)) - 14;
      D.arrow(g, M.X(a.w), yTop, M.X(a.w), yTop + (yEnd - yTop) * D.easeOut(t), { color: c.accent2, lw: 3, alpha: t });
      D.text(g, a.t, M.X(a.w) + (i === 1 ? -10 : 10), yTop - 8, { size: 19, color: c.accent2, align: i === 1 ? 'right' : 'left', baseline: 'bottom', alpha: t, halo: true });
    });
    D.text(g, 'actions change the state. A model can imagine the branch not taken.', 120, 36, { size: 21, color: c.ink2, alpha: D.seg(p, 0.75, 0.9) });
    legend(g, c, 130, 485, [{ k: 'line', t: 'hidden state', a: 0.35 }, { k: 'dash', t: 'model’s imagined branch' }, { k: 'line', t: 'action', c: c.accent2 }]);
    tag(g, c);
  }
  function e1s5(g, p, env) {
    var c = env.c, M = tl(g);
    var t37 = D.seg(p, 0.05, 0.25);
    D.box(g, M.X(8), M.y, (M.X(37) - M.X(8)), M.h, { fill: c.warn, alpha: 0.08 * t37, stroke: false });
    D.line(g, M.X(37), M.y, M.X(37), M.y + M.h, { color: c.warn, lw: 2, dash: [6, 6], alpha: t37 });
    D.text(g, 'preterm: birth before 37 wk', M.X(37) - 8, M.y + 18, { size: 18, color: c.warn, align: 'right', alpha: t37 });
    inPlot(g, M, function () { truthLine(g, M, e1true, 8, 40, { color: c.reality, lw: 3.5, alpha: 0.28 }); });
    var t2 = D.seg(p, 0.3, 0.5);
    if (t2 > 0) { var xw = M.X(34.9); D.dot(g, xw, M.Y(140), 12 * t2, { fill: false, stroke: c.error, lw: 3 }); D.text(g, 'hypertension threshold crossed', xw - 16, M.Y(140) - 24, { size: 19, color: c.error, align: 'right', alpha: t2, halo: true }); }
    var t3 = D.seg(p, 0.55, 0.75);
    if (t3 > 0) { D.line(g, M.X(38), M.y, M.X(38), M.y + M.h, { color: c.ink, lw: 3, alpha: t3 }); D.text(g, 'delivery ends the process', M.X(38) - 8, M.y + 60, { size: 19, align: 'right', alpha: t3, halo: true }); }
    D.text(g, 'outcomes are events on the clock, and delivery competes with all of them', 120, 44, { size: 21, color: c.ink2, alpha: D.seg(p, 0.8, 0.95) });
    tag(g, c);
  }
  function e1s6(g, p, env) {
    var c = env.c;
    var shift = Math.sin(p * Math.PI * 2) * 1.0 * D.seg(p, 0.1, 0.3);
    var M = frame(g, 120, 70, 780, 330, [8 + shift, 40 + shift], [90, 170], { xl: 'gestational age, weeks (as dated)', yl: 'systolic BP, mmHg', xt: [8, 16, 24, 32, 40].map(function (w) { return w + shift; }), xf: function (v) { return String(Math.round(v - shift)); }, yt: [100, 120, 140, 160], yf: String });
    inPlot(g, M, function () { truthLine(g, M, e1true, 8, 40, { color: c.reality, lw: 3.5, alpha: 0.5 }); });
    D.line(g, M.X(37), M.y, M.X(37), M.y + M.h, { color: c.warn, lw: 2, dash: [6, 6] });
    D.text(g, '37 wk', M.X(37) - 6, M.y + 18, { size: 17, color: c.warn, align: 'right' });
    var xb = M.X(37.3 + shift);
    D.line(g, xb, M.y, xb, M.y + M.h, { color: c.ink, lw: 3 });
    var pre = 37.3 + shift < 37;
    D.text(g, 'birth: ' + (pre ? 'PRETERM' : 'term'), xb - 8, M.y + 60, { size: 20, weight: 700, align: 'right', color: pre ? c.error : c.good, halo: true });
    D.text(g, 'dating error ' + (shift >= 0 ? '+' : '−') + f2(Math.abs(shift) * 7, 0) + ' days', 900, 50, { size: 20, font: 'mono', align: 'right', color: c.ink2 });
    D.text(g, 'the clock is estimated too. A few days of dating error relabel births, scans and thresholds.', 120, 490, { size: 20, color: c.ink2, maxWidth: 800 });
    tag(g, c);
  }
  function e1s7(g, p, env) {
    var c = env.c;
    var nodes = [
      { t: 'observe', s: 'visits, scans, labs, devices', x: 150, y: 120 },
      { t: 'filter', s: 'update belief about the hidden state', x: 480, y: 120 },
      { t: 'forecast', s: 'roll the state forward, with uncertainty', x: 810, y: 120 },
      { t: 'what-if', s: 'imagine each action’s branch', x: 810, y: 360 },
      { t: 'act', s: 'treat, schedule, deliver', x: 480, y: 360 },
      { t: 'the real pregnancy', s: 'changes, on its own clock', x: 150, y: 360 }
    ];
    title(g, c, 'the world-model loop, on pregnancy’s clock', 30);
    nodes.forEach(function (n, i) {
      var t = D.seg(p, i * 0.13, i * 0.13 + 0.12);
      if (t <= 0) return;
      var model = i >= 1 && i <= 3;
      D.box(g, n.x - 125, n.y - 46, 250, 92, { r: 6, fill: c.surface, stroke: model ? c.imagined : c.ink, lw: 2.5, dash: model, alpha: t });
      D.text(g, n.t, n.x, n.y - 10, { size: 22, weight: 700, align: 'center', baseline: 'middle', color: model ? c.imagined : c.ink, alpha: t });
      D.text(g, n.s, n.x, n.y + 18, { size: 16, align: 'center', baseline: 'middle', color: c.muted, alpha: t, maxWidth: 230 });
      if (i > 0) {
        var m = nodes[i - 1], a = D.easeOut(t);
        if (m.y === n.y) D.arrow(g, m.x + 128, m.y, m.x + 128 + (n.x - m.x - 256) * a, n.y, { color: c.muted, lw: 2.5 });
        else D.arrow(g, m.x, m.y + 48, m.x, m.y + 48 + (n.y - m.y - 96) * a, { color: c.muted, lw: 2.5 });
      }
    });
    var tl2 = D.seg(p, 0.8, 0.95);
    if (tl2 > 0) D.arrow(g, 150, 312, 150, 312 - 144 * D.easeOut(tl2), { color: c.muted, lw: 2.5 });
    D.text(g, 'solid: reality. dashed: the model. The loop is Module 1’s, but each turn is weeks long and the clock itself is uncertain.', 20, 495, { size: 19, color: c.ink2, alpha: D.seg(p, 0.85, 1), maxWidth: 920 });
  }

  /* ====================================================================
     4. EXPLAINER 2: why a good forecaster can give a bad what-if
     Script
       0-12  Two women, same recorded BP; hidden risk differs.
       12-24 The clinician treats the one at higher hidden risk.
       24-38 In the records, treated women do worse: naive comparison.
       38-50 Within each hidden-risk group, treatment helps: the truth.
       50-62 A simulator fitted to the records learns the clinician, not the drug.
       62-74 Positivity: no one treated below 120, so that what-if has no data.
       74-86 Time-varying confounding: today's BP is both confounder and effect.
       86-100 What repairs it: trials, target-trial emulation, hybrid models.
     ==================================================================== */
  function e2women(g, c, p, o) {
    o = o || {};
    [{ n: 'A', x: 240, risk: 0.25 }, { n: 'B', x: 720, risk: 0.85 }].forEach(function (w, i) {
      var t = D.seg(p, i * 0.15, i * 0.15 + 0.15);
      if (t <= 0) return;
      D.box(g, w.x - 170, 80, 340, 300, { r: 8, fill: c.surface, stroke: c.ink, lw: 2, alpha: t });
      D.text(g, w.n, w.x - 150, 120, { size: 30, weight: 800, baseline: 'middle', alpha: t });
      D.text(g, '20 weeks', w.x + 150, 120, { size: 18, font: 'mono', align: 'right', baseline: 'middle', color: c.muted, alpha: t });
      D.text(g, 'recorded BP  128 / 82', w.x - 150, 170, { size: 21, baseline: 'middle', alpha: t });
      D.text(g, 'recorded history  nothing notable', w.x - 150, 204, { size: 19, baseline: 'middle', color: c.ink2, alpha: t });
      var hr = D.seg(p, 0.35, 0.55) * (o.hide ? 0 : 1);
      D.text(g, 'hidden risk (not in the record)', w.x - 150, 262, { size: 18, baseline: 'middle', color: c.muted, alpha: t * Math.max(0.35, hr) });
      D.box(g, w.x - 150, 280, 300, 22, { fill: c.faint, stroke: false, alpha: t });
      D.box(g, w.x - 150, 280, 300 * w.risk * hr, 22, { fill: w.risk > 0.5 ? c.error : c.good, stroke: false, alpha: t * 0.8 });
      if (o.treat) {
        var tt = D.seg(p, 0.6, 0.8);
        if (i === 1 && tt > 0) { D.arrow(g, w.x, 440 - 10, w.x, 392, { color: c.accent2, lw: 3, alpha: tt }); D.text(g, 'treated', w.x, 465, { size: 21, weight: 700, color: c.accent2, align: 'center', alpha: tt }); }
        if (i === 0 && tt > 0) D.text(g, 'not treated', w.x, 465, { size: 21, color: c.muted, align: 'center', alpha: tt });
      }
    });
  }
  function e2s1(g, p, env) {
    var c = env.c; title(g, c, 'two pregnancies that look the same in the record'); e2women(g, c, p, {});
    D.text(g, 'the clinician sees pallor, oedema, a worried face, a sister with eclampsia. The record holds two numbers.', 20, 440, { size: 19, color: c.ink2, alpha: D.seg(p, 0.7, 0.9), maxWidth: 920 });
    tag(g, c);
  }
  function e2s2(g, p, env) {
    var c = env.c; title(g, c, 'the decision uses what the record does not hold'); e2women(g, c, D.clamp(0.55 + p * 0.45), { treat: true });
    D.text(g, 'confounding by indication: treatment goes to those at higher risk, for reasons the data only partly capture', 20, 505, { size: 19, color: c.ink2, alpha: D.seg(p, 0.5, 0.7), maxWidth: 920 });
    tag(g, c);
  }
  function e2bars(g, c, p, groups, x0, label, o) {
    o = o || {};
    var bw = 110, gap = 40, base = 400, scale = o.scale || 9;
    groups.forEach(function (gr, i) {
      var x = x0 + i * (bw + gap), t = D.seg(p, 0.1 + i * 0.2, 0.3 + i * 0.2), hgt = gr.v * scale * D.easeOut(t);
      bar(g, x, base, bw, hgt, { fill: gr.treated ? c.accent2 : c.ink, alpha: 0.85, stroke: false });
      if (gr.treated) { g.save(); g.beginPath(); g.rect(x, base - hgt, bw, hgt); g.clip(); for (var k = -bw; k < hgt + bw; k += 12) D.line(g, x + k, base, x + k + hgt, base - hgt, { color: c.stage, lw: 2, alpha: 0.5 }); g.restore(); }
      D.text(g, f2(gr.v, o.digits || 0) + '%', x + bw / 2, base - hgt - 10, { size: 21, weight: 700, align: 'center', alpha: t });
      D.text(g, gr.t, x + bw / 2, base + 14, { size: 17, align: 'center', baseline: 'top', color: c.ink2, alpha: t, maxWidth: bw + 30 });
    });
    if (label) D.text(g, label, x0 + (groups.length * (bw + gap) - gap) / 2, o.ly || 470, { size: 19, weight: 600, align: 'center', color: c.muted });
  }
  function e2s3(g, p, env) {
    var c = env.c; title(g, c, 'in the records, treated pregnancies do worse');
    D.text(g, 'pre-eclampsia, % (synthetic)', 20, 60, { size: 18, color: c.muted });
    e2bars(g, c, p, [{ v: 6, t: 'not treated', treated: false }, { v: 14, t: 'treated', treated: true }], 340, 'whole population');
    D.text(g, 'naive comparison: treatment raises risk by 8 points', 20, 505, { size: 21, color: c.error, weight: 700, alpha: D.seg(p, 0.6, 0.8) });
    tag(g, c);
  }
  function e2s4(g, p, env) {
    var c = env.c; title(g, c, 'inside each hidden-risk group, treatment helps');
    D.text(g, 'pre-eclampsia, % (synthetic)', 20, 60, { size: 18, color: c.muted });
    e2bars(g, c, p, [{ v: 5, t: 'not treated', treated: false }, { v: 3, t: 'treated', treated: true }], 100, 'low hidden risk (mostly untreated)');
    e2bars(g, c, D.clamp(p - 0.3), [{ v: 24, t: 'not treated', treated: false }, { v: 16, t: 'treated', treated: true }], 560, 'high hidden risk (mostly treated)');
    D.text(g, 'true effect: treatment lowers risk. The naive answer had the sign wrong.', 20, 505, { size: 21, color: c.good, weight: 700, alpha: D.seg(p, 0.75, 0.9) });
    tag(g, c);
  }
  function e2s5(g, p, env) {
    var c = env.c; title(g, c, 'a simulator fitted to these records learns the clinician, not the drug');
    var t1 = D.seg(p, 0.05, 0.3), t2 = D.seg(p, 0.35, 0.6), t3 = D.seg(p, 0.65, 0.9);
    D.box(g, 60, 110, 260, 150, { r: 6, fill: c.surface, stroke: c.ink, lw: 2, alpha: t1 });
    D.text(g, 'records', 190, 150, { size: 22, weight: 700, align: 'center', baseline: 'middle', alpha: t1 });
    D.text(g, 'BP, treated?, outcome\nfrom routine care', 190, 200, { size: 17, align: 'center', baseline: 'middle', color: c.muted, alpha: t1 });
    D.arrow(g, 330, 185, 330 + 90 * D.easeOut(t2), 185, { color: c.muted, lw: 2.5, alpha: t2 });
    D.text(g, 'fit', 375, 165, { size: 18, align: 'center', color: c.muted, alpha: t2 });
    D.box(g, 430, 90, 470, 190, { r: 6, fill: c.surface, stroke: c.imagined, lw: 2.5, dash: true, alpha: t2 });
    D.text(g, 'learned world model', 665, 125, { size: 22, weight: 700, align: 'center', baseline: 'middle', color: c.imagined, alpha: t2 });
    D.text(g, 'P(outcome | BP, treated)', 665, 165, { size: 19, font: 'mono', align: 'center', baseline: 'middle', alpha: t2 });
    D.text(g, 'what it learned: “treated → +8 points”', 665, 205, { size: 19, align: 'center', baseline: 'middle', color: c.error, alpha: t2 });
    D.text(g, 'a faithful fit to the data, and the data were made by a policy', 665, 245, { size: 16, align: 'center', baseline: 'middle', color: c.muted, alpha: t2 });
    D.box(g, 60, 330, 840, 150, { r: 6, fill: c.surface, stroke: c.error, lw: 2, alpha: t3 });
    D.text(g, 'what-if asked: “treat A at 20 weeks?”', 80, 368, { size: 21, weight: 700, baseline: 'middle', alpha: t3 });
    D.text(g, 'simulator answers: risk rises. The model predicts the records well and the intervention wrongly, because in the records “treated” also meant “judged high risk”.', 80, 405, { size: 18, baseline: 'middle', color: c.ink2, alpha: t3, maxWidth: 800 });
    D.text(g, 'prediction ≠ intervention', 880, 455, { size: 20, font: 'mono', align: 'right', color: c.error, alpha: t3 });
  }
  function e2s6(g, p, env) {
    var c = env.c, r = WM.rng('m6-pos');
    title(g, c, 'positivity: a what-if with no examples');
    var M = frame(g, 120, 90, 780, 300, [100, 160], [0, 1], { xl: 'recorded BP at 20 wk, mmHg', xt: [100, 120, 140, 160], xf: String, yt: [0.25, 0.75], yf: function (v) { return v > 0.5 ? 'treated' : 'untreated'; } });
    var n = Math.floor(140 * D.seg(p, 0, 0.5));
    for (var i = 0; i < 140; i++) {
      var bp = 102 + 56 * r(), pt = bp < 120 ? 0 : sig((bp - 136) / 5), tr = r() < pt, jy = (r() - 0.5) * 0.25;
      if (i >= n) continue;
      D.dot(g, M.X(bp), M.Y((tr ? 0.75 : 0.25) + jy), 5, { fill: tr ? c.accent2 : c.ink, alpha: 0.75 });
    }
    var t = D.seg(p, 0.55, 0.75);
    D.box(g, M.X(100), M.y, M.X(120) - M.X(100), M.h, { fill: c.error, alpha: 0.1 * t, stroke: false });
    D.text(g, 'nobody treated here', M.X(110), M.y + 24, { size: 18, align: 'center', color: c.error, alpha: t });
    var t2 = D.seg(p, 0.75, 0.95);
    if (t2 > 0) { D.dot(g, M.X(112), M.Y(0.75), 11, { fill: false, stroke: c.imagined, lw: 3, dash: true, alpha: t2 }); D.text(g, 'what-if: treat at 112? pure extrapolation', M.X(112) + 18, M.Y(0.75) - 24, { size: 19, color: c.imagined, alpha: t2, halo: true }); }
    D.text(g, 'a learned model can only answer what-ifs that the data contain. Elsewhere it guesses.', 20, 500, { size: 19, color: c.ink2, alpha: t2, maxWidth: 920 });
    tag(g, c);
  }
  function e2s7(g, p, env) {
    var c = env.c; title(g, c, 'time-varying confounding');
    var N = { b24: [160, 180], t24: [160, 380], b28: [480, 180], t28: [480, 380], y: [800, 280], u: [480, 60] };
    var edges = [['b24', 't24'], ['t24', 'b28'], ['b24', 'b28'], ['b28', 't28'], ['t28', 'y'], ['t24', 'y'], ['b28', 'y'], ['u', 'b24'], ['u', 'b28'], ['u', 'y']];
    var labels = { b24: 'BP at 24 wk', t24: 'treat at 24?', b28: 'BP at 28 wk', t28: 'treat at 28?', y: 'outcome', u: 'hidden U' };
    edges.forEach(function (e, i) {
      var t = D.seg(p, 0.08 + i * 0.07, 0.16 + i * 0.07); if (t <= 0) return;
      var a = N[e[0]], b = N[e[1]], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, hid = e[0] === 'u';
      D.arrow(g, a[0] + ux * 62, a[1] + uy * 34, a[0] + ux * 62 + (dx - ux * 130) * D.easeOut(t), a[1] + uy * 34 + (dy - uy * 72) * D.easeOut(t), { color: hid ? c.error : c.muted, lw: 2.5, dash: hid });
    });
    Object.keys(N).forEach(function (k, i) {
      var n = N[k], t = D.seg(p, i * 0.05, i * 0.05 + 0.1), hid = k === 'u';
      D.box(g, n[0] - 70, n[1] - 26, 140, 52, { r: 6, fill: c.surface, stroke: hid ? c.error : c.ink, lw: 2, dash: hid, alpha: t });
      D.text(g, labels[k], n[0], n[1], { size: 18, align: 'center', baseline: 'middle', color: hid ? c.error : c.ink, alpha: t });
    });
    D.text(g, 'BP at 28 weeks is a confounder of the second decision and an effect of the first. Adjusting for it in a regression removes part of the first treatment’s effect and opens a path through U. The remedies are g-methods or a sequence of emulated trials with explicit time zero.', 20, 440, { size: 18, color: c.ink2, alpha: D.seg(p, 0.75, 0.95), maxWidth: 920 });
  }
  function e2s8(g, p, env) {
    var c = env.c; title(g, c, 'what repairs the what-if');
    var items = [
      ['Randomise the action', 'ASPRE: aspirin after first-trimester screening, preterm pre-eclampsia 1.6% vs 4.3%. CHAP: treating mild chronic hypertension, composite 30.2% vs 37.0%. ARRIVE: induction at 39 wk, caesarean 18.6% vs 22.2%.'],
      ['Emulate the trial you would have run', 'Explicit eligibility, strategies, time zero and follow-up (Hernán and Robins 2016). Two emulations of labetalol vs nifedipine still disagreed (aRR 1.03 vs 1.33), which is the warning.'],
      ['Build a hybrid', 'Dynamics learned from data, intervention effects taken from trials or pre-registered emulations, mechanism where it is known (PBPK, haemodynamics).'],
      ['Evaluate off-policy with care', 'Importance weights shrink the effective sample; unrecorded reasons for decisions cannot be weighted away (Gottesman and colleagues 2019).']
    ];
    items.forEach(function (it, i) {
      var t = D.seg(p, i * 0.22, i * 0.22 + 0.2), y = 80 + i * 108;
      if (t <= 0) return;
      D.text(g, String(i + 1), 40, y + 10, { size: 30, weight: 800, font: 'display', color: c.imagined, alpha: t });
      D.text(g, it[0], 90, y + 6, { size: 22, weight: 700, alpha: t });
      D.text(g, it[1], 90, y + 36, { size: 17, color: c.ink2, alpha: t, maxWidth: 840, lineHeight: 1.25 });
    });
  }

  /* ====================================================================
     5. EXPLAINER 3: the checks before a model touches care
     Script
       0-14  Discrimination is not calibration: same ranking, wrong numbers.
       14-28 Transport: performance falls at a new site; local adaptation.
       28-42 The visit process is informative: who gets measured, and when.
       42-56 Accuracy is not benefit: INFANT, 0.7% vs 0.7%.
       56-70 The Indian regulatory frame: CDSCO, ICMR, DPDP.
       70-84 An evidence ladder for model-based answers.
     ==================================================================== */
  function e3s1(g, p, env) {
    var c = env.c; title(g, c, 'discrimination is not calibration');
    var M = frame(g, 130, 80, 420, 330, [0, 0.6], [0, 0.6], { xl: 'predicted risk', yl: 'observed risk', xt: [0, 0.2, 0.4, 0.6], xf: function (v) { return Math.round(v * 100) + '%'; }, yt: [0.2, 0.4, 0.6], yf: function (v) { return Math.round(v * 100) + '%'; } });
    D.line(g, M.X(0), M.Y(0), M.X(0.6), M.Y(0.6), { color: c.muted, lw: 1.5, dash: [4, 6] });
    var bins = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55];
    bins.forEach(function (b, i) {
      var t = D.seg(p, 0.05 + i * 0.05, 0.15 + i * 0.05); if (t <= 0) return;
      D.dot(g, M.X(b), M.Y(b * (1 + 0.1 * Math.sin(i))), 8, { fill: c.reality, alpha: t });
      var t2 = D.seg(p, 0.45 + i * 0.05, 0.55 + i * 0.05); if (t2 <= 0) return;
      D.dot(g, M.X(b), M.Y(b * 0.55), 8, { fill: false, stroke: c.error, lw: 3, alpha: t2 });
    });
    legend(g, c, 140, 505, [{ k: 'dot', t: 'development site' }, { k: 'ring', t: 'new site' }]);
    var tt = D.seg(p, 0.5, 0.7);
    D.text(g, 'c-index 0.78 at both', 600, 120, { size: 22, weight: 700, alpha: tt });
    D.text(g, 'the model ranks pregnancies equally well at the new site, but every risk it states is about twice the truth. Decisions made on the stated risk, such as who gets aspirin, are then wrong even though the ranking is right. Calibration must be checked wherever the model is used.', 600, 160, { size: 18, color: c.ink2, alpha: tt, maxWidth: 330, lineHeight: 1.3 });
    tag(g, c);
  }
  function e3s2(g, p, env) {
    var c = env.c; title(g, c, 'performance moves when the model is transported');
    var data = [[0.79, 'development\n(Michigan)'], [0.74, 'external\n(Florida)'], [0.67, 'external,\nearly onset']];
    var M = frame(g, 130, 90, 500, 300, [0, 3], [0.5, 0.85], { yl: 'c-index', yt: [0.5, 0.6, 0.7, 0.8], yf: function (v) { return v.toFixed(2); } });
    data.forEach(function (d, i) {
      var t = D.seg(p, 0.05 + i * 0.18, 0.25 + i * 0.18), x = M.X(i + 0.25), w = M.X(i + 0.75) - x, hgt = (M.Y(0.5) - M.Y(d[0])) * D.easeOut(t);
      bar(g, x, M.Y(0.5), w, hgt, { fill: i ? c.error : c.reality, alpha: i ? 0.8 : 0.9, stroke: false });
      D.text(g, d[0].toFixed(2), x + w / 2, M.Y(0.5) - hgt - 10, { size: 21, weight: 700, align: 'center', alpha: t });
      D.text(g, d[1], x + w / 2, M.Y(0.5) + 12, { size: 16, align: 'center', baseline: 'top', color: c.ink2, alpha: t });
    });
    var tt = D.seg(p, 0.6, 0.8);
    D.text(g, 'time from pre-eclampsia diagnosis to delivery', 680, 110, { size: 20, weight: 700, alpha: tt, maxWidth: 260 });
    D.text(g, 'Yang and colleagues 2025, a 12-feature model derived from EHR deep learning. The same pattern appears in imaging: blind-sweep gestational-age AI was non-inferior to sonographers at two new sites after lightweight local adaptation (Willis and colleagues 2026).', 680, 170, { size: 17, color: c.ink2, alpha: tt, maxWidth: 260, lineHeight: 1.3 });
    D.text(g, 'published figures, not synthetic', 940, 22, { size: 18, font: 'mono', color: c.muted, align: 'right', baseline: 'middle' });
  }
  function e3s3(g, p, env) {
    var c = env.c, M = tl(g, { y: 80, h: 300 });
    title(g, c, 'the visit process is informative');
    inPlot(g, M, function () { truthLine(g, M, e1true, 8, 40, { color: c.reality, lw: 3.5, alpha: 0.3 }); });
    var vis = [9, 14, 20, 26, 30, 32, 33, 34, 35, 35.5, 36, 36.5, 37, 37.5];
    vis.forEach(function (w, i) { var t = D.seg(p, 0.05 + i * 0.04, 0.12 + i * 0.04); if (t > 0) D.dot(g, M.X(w), M.Y(e1true(w)), 7, { fill: c.reality, alpha: t }); });
    var t2 = D.seg(p, 0.65, 0.85);
    D.box(g, M.X(31.5), M.y, M.X(38) - M.X(31.5), M.h, { fill: c.warn, alpha: 0.1 * t2, stroke: false });
    D.text(g, 'visits cluster when she is unwell', M.X(34.8), M.y + 20, { size: 18, align: 'center', color: c.warn, alpha: t2 });
    D.text(g, 'weeks without visits are not missing at random: feeling well, distance, cost and advice all decide who is measured and when. A model that reads the record as a neutral sample over-learns the sick weeks. The fact of a visit is itself a signal.', 120, 430, { size: 18, color: c.ink2, alpha: D.seg(p, 0.75, 0.95), maxWidth: 800, lineHeight: 1.3 });
    tag(g, c);
  }
  function e3s4(g, p, env) {
    var c = env.c; title(g, c, 'accuracy is not benefit');
    e2bars(g, c, p, [{ v: 0.7, t: 'usual CTG reading', treated: false }, { v: 0.7, t: 'with decision support', treated: true }], 120, 'poor neonatal outcome, % (INFANT trial)', { scale: 300, digits: 1, ly: 500 });
    var ctx = D.seg(p, 0.55, 0.75);
    D.text(g, 'INFANT, 2017', 540, 120, { size: 22, weight: 700, alpha: ctx });
    D.text(g, '46,042 women in labour were analysed. Decision-support software for interpreting the fetal heart-rate trace did not change the primary outcome: 0.7% in both arms, adjusted RR 1.01 (0.82 to 1.25).', 540, 160, { size: 18, color: c.ink2, alpha: ctx, maxWidth: 380, lineHeight: 1.3 });
    D.text(g, 'the gap between a correct reading and a better decision is where most clinical AI fails. Only a trial of acting on the model measures it.', 540, 300, { size: 18, color: c.ink2, alpha: D.seg(p, 0.8, 0.95), maxWidth: 380, lineHeight: 1.3 });
    D.text(g, 'published figures, not synthetic', 940, 22, { size: 18, font: 'mono', color: c.muted, align: 'right', baseline: 'middle' });
  }
  function e3s5(g, p, env) {
    var c = env.c; title(g, c, 'the Indian frame, from the primary documents');
    var cols = [
      ['CDSCO', 'Medical Device Software guidance (MDR 2017)', ['AI/ML software that meets the definition is medical device software', 'standalone software is classed by condition state against significance of its output', 'an Algorithm Change Protocol may be required', 'training, validation and test data must be disclosed, real or synthetic', 'foreign evidence may be supplemented with Indian validation']],
      ['ICMR', 'Ethical guidelines for AI in health, 2023', ['ten principles, including validity: rigorous clinical and field validation before use', 'written informed consent', 'vulnerable groups named']],
      ['DPDP Act', 'Digital Personal Data Protection Act, 2023', ['the research exemption holds only if data are not used for a decision specific to a person', 'a twin that informs an individual’s care would likely count as such a decision', 'children under 18 need verifiable parental consent']]
    ];
    cols.forEach(function (col, i) {
      var t = D.seg(p, i * 0.25, i * 0.25 + 0.2), x = 20 + i * 310;
      if (t <= 0) return;
      D.box(g, x, 60, 290, 440, { r: 6, fill: c.surface, stroke: c.ink, lw: 2, alpha: t });
      D.text(g, col[0], x + 16, 96, { size: 24, weight: 800, font: 'display', alpha: t });
      D.text(g, col[1], x + 16, 124, { size: 15, color: c.muted, alpha: t, maxWidth: 260 });
      var y = 170;
      col[2].forEach(function (s) { D.dot(g, x + 22, y + 8, 3.5, { fill: c.imagined, alpha: t }); var m = D.text(g, s, x + 34, y + 14, { size: 15.5, color: c.ink2, alpha: t, maxWidth: 250, lineHeight: 1.22 }); y += m.height + 10; });
    });
  }
  var RUNGS = ['concept or in-silico only', 'retrospective development, internal validation', 'external validation, another site or population', 'prospective accuracy, as it would be used', 'outcome benefit shown in a trial of acting on it', 'deployed under regulation, with monitoring'];
  function ladder(g, c, x, y0, hgt, hi, dashed, alpha) {
    var step = hgt / 5;
    D.line(g, x, y0, x, y0 + hgt, { color: c.line, lw: 3 }); D.line(g, x + 200, y0, x + 200, y0 + hgt, { color: c.line, lw: 3 });
    RUNGS.forEach(function (r, i) {
      var y = y0 + hgt - i * step, on = i <= hi, dsh = dashed != null && i > hi && i <= dashed;
      D.line(g, x, y, x + 200, y, { color: on ? c.reality : dsh ? c.imagined : c.line, lw: on ? 5 : 3, dash: dsh, alpha: alpha != null ? alpha : 1 });
      D.text(g, i + '  ' + r, x + 216, y, { size: 17, baseline: 'middle', color: on ? c.ink : dsh ? c.imagined : c.muted, alpha: alpha != null ? alpha : 1, maxWidth: 520 });
    });
  }
  function e3s6(g, p, env) {
    var c = env.c; title(g, c, 'an evidence ladder for model-based answers');
    var hi = Math.floor(D.seg(p, 0.05, 0.75) * 5.99) - 1;
    ladder(g, c, 60, 90, 360, hi, null);
    D.text(g, 'each rung is a different study. A model climbs one rung at a time, and a what-if question needs a trial of the action, not of the forecast.', 60, 495, { size: 18, color: c.ink2, alpha: D.seg(p, 0.8, 0.95), maxWidth: 860 });
  }

  /* ====================================================================
     6. INTERACTIVE 1: filtering a hidden vascular state
     A local-linear-trend Kalman filter tracks the deviation of this
     pregnancy from the population curve, from irregular noisy visits.
     ==================================================================== */
  function genTruth(scn, seed) {
    /* a slow random walk in level and slope, plus (case B) a rise in tone from 25 weeks */
    var r = WM.rng('m6-truth-' + scn + '-' + seed), l = 0, s = 0, out = {};
    for (var w = 8; w <= 40; w++) {
      out[w] = phys(w) + l + (scn === 'B' ? 34 * smooth((w - 25) / 11) : 0);
      s = 0.9 * s + 0.08 * WM.gauss(r);
      l += s + 0.35 * WM.gauss(r);
    }
    return out;
  }
  function visitWeeks(k, seed) {
    var r = WM.rng('m6-visits-' + k + '-' + seed), ws = [8], w = 8;
    while (true) { w += k + Math.round((r() - 0.5) * (k >= 4 ? 2 : 1)); if (w > 40) break; ws.push(w); }
    return ws;
  }
  function kalman(obs, now) {
    /* state [level, slope] of deviation from the population curve; weekly steps */
    var l = 0, s = 0, P00 = 36, P01 = 0, P11 = 1, ql = 0.25, qs = 0.03, est = {};
    for (var w = 8; w <= 40; w++) {
      if (w > 8) {
        l += s;
        var n00 = P00 + 2 * P01 + P11 + ql, n01 = P01 + P11, n11 = P11 + qs;
        P00 = n00; P01 = n01; P11 = n11;
      }
      var list = obs[w];
      if (list && w <= now) list.forEach(function (o) {
        var S = P00 + o.R, k0 = P00 / S, k1 = P01 / S, inn = o.y - phys(w) - l;
        l += k0 * inn; s += k1 * inn;
        var m00 = P00 - k0 * P00, m01 = P01 - k0 * P01, m11 = P11 - k1 * P01;
        P00 = m00; P01 = m01; P11 = m11;
      });
      est[w] = { m: phys(w) + l, sd: Math.sqrt(Math.max(P00, 1e-6)) };
    }
    return est;
  }
  function buildFilter() {
    var st = { scn: 'B', k: 4, noise: 5, now: 30, home: false, truth: false, seed: 1 };
    var cache = {};
    function data() {
      var key = [st.scn, st.k, st.noise, st.home, st.seed].join('|');
      if (cache[key]) return cache[key];
      var tr = genTruth(st.scn, st.seed), r = WM.rng('m6-obs-' + key), obs = {}, pts = [];
      visitWeeks(st.k, st.seed).forEach(function (w) { var y = tr[w] + st.noise * WM.gauss(r); (obs[w] = obs[w] || []).push({ y: y, R: st.noise * st.noise, home: false }); pts.push([w, y, false]); });
      if (st.home) for (var w = 28; w <= 40; w++) { var y2 = tr[w] + (st.noise + 2) * WM.gauss(r); (obs[w] = obs[w] || []).push({ y: y2, R: (st.noise + 2) * (st.noise + 2), home: true }); pts.push([w, y2, true]); }
      return (cache[key] = { tr: tr, obs: obs, pts: pts });
    }
    var rEst = WM.readout('Estimate now', ''), rF = WM.readout('Forecast at 40 wk', ''), rErr = WM.readout('Filter error now', ''), notice = noticeReadout('What you should notice');
    var cv = WM.canvas({
      w: 960, h: 540, label: 'Blood pressure visits, filtered estimate with uncertainty band, and forecast to 40 weeks',
      draw: function (g, env) {
        var c = env.c, Dd = data(), est = kalman(Dd.obs, st.now), M = tl(g, { y: 60, h: 350 });
        D.line(g, M.X(8), M.Y(140), M.X(40), M.Y(140), { color: c.muted, lw: 1.5, dash: [3, 6] });
        D.text(g, '140, illustrative threshold', M.X(8) + 8, M.Y(140) - 8, { size: 17, color: c.muted });
        inPlot(g, M, function () {
          var up = [], lo = [], mid = [], w;
          for (w = 8; w <= 40; w++) { up.push([M.X(w), M.Y(est[w].m + 1.96 * est[w].sd)]); lo.unshift([M.X(w), M.Y(est[w].m - 1.96 * est[w].sd)]); mid.push([M.X(w), M.Y(est[w].m)]); }
          D.poly(g, up.concat(lo), { fill: c.imagined, alpha: 0.16, stroke: false, close: true });
          D.poly(g, mid, { color: c.imagined, lw: 3, dash: true });
          if (st.truth) { var pts = []; for (w = 8; w <= 40; w++) pts.push([M.X(w), M.Y(Dd.tr[w])]); D.poly(g, pts, { color: c.reality, lw: 3 }); }
          D.box(g, M.X(st.now), M.y, M.X(40) - M.X(st.now), M.h, { fill: c.ink, alpha: 0.04, stroke: false });
          D.line(g, M.X(st.now), M.y, M.X(st.now), M.y + M.h, { color: c.ink, lw: 2, dash: [8, 6] });
          Dd.pts.forEach(function (p) { var fut = p[0] > st.now; if (p[2]) D.dot(g, M.X(p[0]), M.Y(p[1]), 4.5, { fill: fut ? c.stage : c.accent2, stroke: c.accent2, lw: 1.5, alpha: fut ? 0.5 : 1 }); else D.dot(g, M.X(p[0]), M.Y(p[1]), 7.5, { fill: fut ? c.stage : c.reality, stroke: c.reality, lw: 2, alpha: fut ? 0.5 : 1 }); });
        });
        D.text(g, 'now: ' + st.now + ' wk', M.X(st.now) + 6, M.y + 16, { size: 17, font: 'mono', color: c.ink2 });
        D.text(g, 'forecast →', M.X(st.now) + 6, M.y + 38, { size: 17, color: c.imagined });
        legend(g, c, 130, 486, [{ k: 'dot', t: 'clinic visit' }, { k: 'dash', t: 'estimate' }, { k: 'band', t: '95% band' }].concat(st.home ? [{ k: 'dot', t: 'home reading', c: c.accent2 }] : []).concat(st.truth ? [{ k: 'line', t: 'hidden truth' }] : []));
        D.text(g, 'synthetic case ' + st.scn + ', illustrative', 940, 22, { size: 18, font: 'mono', color: c.muted, align: 'right', baseline: 'middle' });
        tag(g, c, ' ');
        D.text(g, 'the model knows the population curve and tracks this pregnancy’s deviation from it', 130, 522, { size: 17, color: c.muted });
        var e = est[st.now], e40 = est[40], err = Math.abs(e.m - Dd.tr[st.now]);
        rEst.set(f2(e.m, 0) + ' ± ' + f2(1.96 * e.sd, 0) + ' mmHg');
        rF.set(f2(e40.m, 0) + ' ± ' + f2(1.96 * e40.sd, 0) + ' mmHg');
        rErr.set(f2(err, 1) + ' mmHg');
        var nVis = Dd.pts.filter(function (p) { return p[0] <= st.now; }).length;
        var cross = null; for (var w2 = st.now; w2 <= 40; w2++) if (est[w2].m + 1.96 * est[w2].sd >= 140) { cross = w2; break; }
        notice.set('The band is narrow near measurements and widens with every week of forecast; at 40 weeks it is ' + f2(2 * 1.96 * e40.sd, 0) + ' mmHg wide after ' + nVis + (nVis === 1 ? ' reading. ' : ' readings. ') +
          (cross ? 'Its upper edge reaches 140 at ' + cross + ' weeks, which is the earliest the model can no longer rule out hypertension, not a prediction that it will occur.' : 'Its upper edge stays below 140, so the model currently rules hypertension out through term.') +
          (st.truth ? ' Compare the dashed estimate with the solid truth: the filter lags a turn in the hidden state until the next reading arrives.' : ' Switch on the hidden truth to see how far the estimate is from what is really happening.'));
      }
    });
    function go() { cv.redraw(); }
    var scn = WM.select({ label: 'Synthetic case', options: [{ value: 'A', label: 'A: stable' }, { value: 'B', label: 'B: tone rising from 25 wk' }], value: 'B', onChange: function (v) { st.scn = v; go(); } });
    var kSel = WM.select({ label: 'Clinic visit interval', options: [{ value: 2, label: 'every 2 weeks' }, { value: 4, label: 'every 4 weeks' }, { value: 6, label: 'every 6 weeks' }], value: 4, onChange: function (v) { st.k = v; go(); } });
    var noise = WM.slider({ label: 'Clinic measurement noise (SD)', min: 2, max: 10, step: 1, value: 5, unit: 'mmHg', onInput: function (v) { st.noise = v; go(); } });
    var now = WM.slider({ label: 'Today (gestational age)', min: 12, max: 40, step: 1, value: 30, unit: 'wk', onInput: function (v) { st.now = v; go(); } });
    var home = WM.toggle({ label: 'Home BP device, weekly from 28 wk', value: false, onChange: function (v) { st.home = v; go(); } });
    var truth = WM.toggle({ label: 'Show hidden truth', value: false, onChange: function (v) { st.truth = v; go(); } });
    var btn = WM.buttons([{ label: 'New synthetic pregnancy', kind: 'ghost', onClick: function () { st.seed++; go(); } }]);
    return WM.panel({ title: 'Track a hidden vascular state from a few visits', kicker: 'Interactive · synthetic', note: 'Drag <b>Today</b> from 20 to 38 weeks and watch the band beyond it. Then switch the visit interval to 6 weeks, switch on the <b>home device</b>, and finally reveal the <b>hidden truth</b>.' },
      WM.controls(scn, kSel, noise, now, home, truth), cv, WM.readouts(rEst, rF, rErr), WM.readouts(notice), btn);
  }

  /* ====================================================================
     7. INTERACTIVE 2: a what-if under confounding by indication
     Monte Carlo: hidden risk r, recorded marker m (partly reflects r),
     clinician treats more at higher r, outcome depends on r and treatment.
     Four estimates of the treatment effect are computed on the same people.
     ==================================================================== */
  function simWhatIf(beta, gam, rho, N, seed) {
    var r = WM.rng('m6-whatif-' + seed), n = N, risk = new Float64Array(n), m = new Float64Array(n), T = new Uint8Array(n), Y = new Uint8Array(n), Y1 = new Uint8Array(n), Y0 = new Uint8Array(n), Yr = new Uint8Array(n), Tr = new Uint8Array(n), i;
    var c = Math.sqrt(1 - rho * rho);
    for (i = 0; i < n; i++) {
      risk[i] = WM.gauss(r); m[i] = rho * risk[i] + c * WM.gauss(r);
      T[i] = r() < sig(-1.0 + gam * risk[i]) ? 1 : 0;
      var base = -2.0 + 1.3 * risk[i], u = r(), u2 = r();
      Y1[i] = u < sig(base + beta) ? 1 : 0; Y0[i] = u < sig(base) ? 1 : 0;
      Y[i] = T[i] ? Y1[i] : Y0[i];
      Tr[i] = u2 < 0.5 ? 1 : 0; Yr[i] = Tr[i] ? Y1[i] : Y0[i];
    }
    function rd(t, y) { var s1 = 0, n1 = 0, s0 = 0, n0 = 0; for (var j = 0; j < n; j++) { if (t[j]) { s1 += y[j]; n1++; } else { s0 += y[j]; n0++; } } return { d: s1 / Math.max(1, n1) - s0 / Math.max(1, n0), p1: s1 / Math.max(1, n1), p0: s0 / Math.max(1, n0), n1: n1, n0: n0 }; }
    var naive = rd(T, Y), rct = rd(Tr, Yr);
    /* adjusted for the recorded marker: standardise over deciles of m */
    var idx = []; for (i = 0; i < n; i++) idx.push(i); idx.sort(function (a, b) { return m[a] - m[b]; });
    var adj = 0, Q = 10, used = 0;
    for (var q = 0; q < Q; q++) {
      var s1 = 0, n1 = 0, s0 = 0, n0 = 0;
      for (var k = Math.floor(q * n / Q); k < Math.floor((q + 1) * n / Q); k++) { var j = idx[k]; if (T[j]) { s1 += Y[j]; n1++; } else { s0 += Y[j]; n0++; } }
      if (n1 && n0) { adj += (s1 / n1 - s0 / n0) * (n1 + n0); used += n1 + n0; }
    }
    adj = used ? adj / used : NaN;
    var tru = (mean(Y1) - mean(Y0));
    var se = Math.sqrt(rct.p1 * (1 - rct.p1) / rct.n1 + rct.p0 * (1 - rct.p0) / rct.n0);
    return { naive: naive, adj: adj, tru: tru, rct: rct, se: se, pT: mean(T) };
  }
  function buildWhatIf() {
    var st = { beta: -0.7, gam: 1.5, rho: 0.6, seed: 1 }, res = null;
    function run() { res = simWhatIf(st.beta, st.gam, st.rho, 6000, st.seed); }
    run();
    var rN = WM.readout('Naive (records)', ''), rA = WM.readout('Adjusted for marker', ''), rT = WM.readout('True effect', ''), rR = WM.readout('Randomised arm', ''), notice = noticeReadout('What you should notice');
    function pp(v) { return (v > 0 ? '+' : '') + f2(v * 100, 1) + ' pts'; }
    var cv = WM.canvas({
      w: 960, h: 460, label: 'Four estimates of the same treatment effect as bars: naive, adjusted, true, randomised',
      draw: function (g, env) {
        var c = env.c, R = res;
        var vals = [{ t: 'naive comparison\nof records', v: R.naive.d, k: 'model' }, { t: 'adjusted for the recorded\nmarker, ten strata', v: R.adj, k: 'model' }, { t: 'true effect\n(both branches simulated)', v: R.tru, k: 'truth' }, { t: 'randomised arm\n(same people)', v: R.rct.d, k: 'rct', se: R.se }];
        var lim = Math.max(0.12, Math.ceil(Math.max.apply(null, vals.map(function (v) { return Math.abs(v.v) + (v.se || 0) * 2; })) * 100 / 5) * 5 / 100);
        var M = frame(g, 130, 50, 780, 300, [0, 4], [-lim, lim], { yl: 'risk difference, points (+ harm, − benefit)', ylo: 70, yt: [-lim, -lim / 2, 0, lim / 2, lim], yf: function (v) { return (v > 0 ? '+' : '') + Math.round(v * 100); } });
        D.line(g, M.X(0), M.Y(0), M.X(4), M.Y(0), { color: c.ink, lw: 1.5 });
        vals.forEach(function (v, i) {
          var x = M.X(i + 0.25), w = M.X(i + 0.75) - x, y0 = M.Y(0), y1 = M.Y(v.v), model = v.k === 'model';
          D.box(g, x, Math.min(y0, y1), w, Math.abs(y1 - y0), { fill: model ? c.imagined : c.reality, alpha: model ? 0.22 : 0.85, stroke: model ? c.imagined : false, lw: 2.5, dash: model });
          if (v.se) { D.line(g, x + w / 2, M.Y(v.v - 1.96 * v.se), x + w / 2, M.Y(v.v + 1.96 * v.se), { color: c.reality, lw: 2.5 }); D.line(g, x + w / 2 - 10, M.Y(v.v - 1.96 * v.se), x + w / 2 + 10, M.Y(v.v - 1.96 * v.se), { color: c.reality, lw: 2.5 }); D.line(g, x + w / 2 - 10, M.Y(v.v + 1.96 * v.se), x + w / 2 + 10, M.Y(v.v + 1.96 * v.se), { color: c.reality, lw: 2.5 }); }
          var wrong = model && Math.sign(v.v) !== Math.sign(R.tru) && Math.abs(v.v) > 0.005;
          D.text(g, pp(v.v), x + w / 2, (v.v >= 0 ? Math.min(y0, y1) - 10 : Math.max(y0, y1) + 24), { size: 20, weight: 700, align: 'center', color: wrong ? c.error : c.ink, halo: true });
          D.text(g, v.t, x + w / 2, M.y + M.h + 14, { size: 15, align: 'center', baseline: 'top', color: c.ink2, lineHeight: 1.2 });
        });
        legend(g, c, 140, 440, [{ k: 'dash', t: 'estimates a learned simulator would give' }, { k: 'line', t: 'ground truth of the simulation' }]);
        D.text(g, 'synthetic population, n = 6000', 940, 22, { size: 18, font: 'mono', color: c.muted, align: 'right', baseline: 'middle' });
        rN.set(pp(R.naive.d)); rA.set(pp(R.adj)); rT.set(pp(R.tru)); rR.set(pp(R.rct.d) + ' ± ' + f2(1.96 * R.se * 100, 1));
        var flip = Math.sign(R.naive.d) !== Math.sign(R.tru), flipA = Math.sign(R.adj) !== Math.sign(R.tru);
        var gapN = Math.abs(R.naive.d - R.tru), gapA = Math.abs(R.adj - R.tru), tp = f2(Math.round(R.pT * 100), 0) + '% of the population was treated';
        if (st.gam < 0.05 || gapN < 0.02) notice.set('The naive comparison is close to the truth: ' + tp + ', and because treatment was barely steered by hidden risk the records behave much like a trial. Adjusting for the recorded marker changes little. The randomised arm recovers the truth to within its error bar. Raise the steering slider to see the records go wrong.');
        else notice.set((Math.abs(R.tru) < 0.005 ? 'The naive comparison shows an effect where there is none: ' : (flip ? 'The naive comparison has the wrong sign: ' : 'The naive comparison has the right sign but the wrong size: ')) + tp + ', mostly those at higher hidden risk. Adjusting for the recorded marker ' + (gapA < 0.02 ? 'lands close to the truth' : (flipA ? 'still gives the wrong sign' : 'moves the estimate toward the truth but not onto it')) + ', because the marker captures ' + Math.round(st.rho * st.rho * 100) + '% of the variance in hidden risk. The randomised arm recovers the truth to within its error bar. A simulator fitted to the records would reproduce the dashed bars.');
      }
    });
    var beta = WM.slider({ label: 'True effect of treatment (log-odds)', min: -1.5, max: 0.6, step: 0.1, value: -0.7, fmt: function (v) { return (v > 0 ? '+' : '') + f2(v, 1) + (v < 0 ? ' (helps)' : v > 0 ? ' (harms)' : ' (none)'); }, onInput: function (v) { st.beta = v; run(); cv.redraw(); } });
    var gam = WM.slider({ label: 'How strongly clinicians treat by hidden risk', min: 0, max: 3, step: 0.1, value: 1.5, fmt: function (v) { return v === 0 ? '0 (as if random)' : f2(v, 1); }, onInput: function (v) { st.gam = v; run(); cv.redraw(); } });
    var rho = WM.slider({ label: 'Share of risk the record captures (correlation)', min: 0.1, max: 0.98, step: 0.02, value: 0.6, fmt: 2, onInput: function (v) { st.rho = v; run(); cv.redraw(); } });
    var btn = WM.buttons([{ label: 'Re-draw the population', kind: 'ghost', onClick: function () { st.seed++; run(); cv.redraw(); } }]);
    return WM.panel({ title: 'Ask a what-if from observational records', kicker: 'Interactive · synthetic', note: 'Leave the true effect at −0.7 and move <b>How strongly clinicians treat by hidden risk</b> from 0 to 3. Then raise <b>Share of risk the record captures</b> toward 0.98 and watch the adjusted bar.' },
      WM.controls(beta, gam, rho), cv, WM.readouts(rN, rA, rT, rR), WM.readouts(notice), btn);
  }

  /* ====================================================================
     8. INTERACTIVE 3: the maturity ladder
     Rule-based. Each use case has a current rung taken from the
     literature base and the assets that the next rungs need.
     ==================================================================== */
  var CASES = [
    { id: 'ga', t: 'Gestational age from blind ultrasound sweeps', rung: 3, now: 'Prospective study with novice users: MAE 3.2 days vs 3.0 for sonographers (Stringer and colleagues 2024). At two new sites it was non-inferior to sonographers after lightweight local adaptation (Willis and colleagues 2026).', next: 'A trial showing that AI dating changes outcomes or care, and local validation in the population of use.', cap: 5 },
    { id: 'pe1', t: 'First-trimester pre-eclampsia risk and aspirin', rung: 4, now: 'Competing-risks screening (Wright and colleagues 2015) linked to an RCT of acting on it: ASPRE, preterm pre-eclampsia 1.6% vs 4.3%.', next: 'Calibration and detection rates in the local population, then a regulated deployment with monitoring.', cap: 5 },
    { id: 'bp', t: 'Early BP trajectory as a risk state', rung: 1, now: 'Latent-class trajectories in about 175,000 pregnancies in one health system, adjusted OR 9.2 for the elevated-stable class (Gunderson and colleagues 2021). No external validation found in the literature base.', next: 'External validation at another site, then a prospective study of a running filter, not a retrospective class assignment.', cap: 4 },
    { id: 'ped', t: 'Time from pre-eclampsia diagnosis to delivery', rung: 2, now: 'c-index 0.79 internally and 0.74 at an external site, 0.67 for early onset (Yang and colleagues 2025).', next: 'A prospective study in which the forecast is shown to clinicians as it would be in use.', cap: 4 },
    { id: 'pbpk', t: 'What-if drug dose: pregnancy PBPK', rung: 1, now: 'Mechanistic labetalol PBPK/PD captured observed pregnancy exposure only roughly and underestimated clearance, predicted/observed AUC ratio about 1.39 (Liu and colleagues 2024). Regulatory readiness is being assessed (Dallmann and colleagues 2026).', next: 'Independent datasets across gestation to validate placental transfer, which the regulator-authored review names as a major gap.', cap: 3 },
    { id: 'aht', t: 'What-if antihypertensive choice, learned from records', rung: 1, now: 'Two target-trial emulations of labetalol vs nifedipine disagreed: aRR 1.03 (Leonard and colleagues 2025) vs 1.33 (Atkinson and colleagues 2026).', next: 'A randomised comparison, or pre-registered emulations with explicit time zero in the population of use. A learned simulator cannot settle this.', cap: 2 },
    { id: 'tim', t: 'What-if delivery timing', rung: 4, now: 'The policy, not a model, has an RCT anchor: ARRIVE, induction at 39 weeks in low-risk nulliparous women, caesarean 18.6% vs 22.2%. Day-by-day emulations exist (Gunnarsdottir and colleagues 2025).', next: 'An individualised timing model would start again at rung 1: its personalised recommendations have no trial.', cap: 4 },
    { id: 'twin', t: 'Whole-pregnancy patient-level digital twin', rung: 1, now: 'A systematic review found two studies meeting strict twin criteria, at early validation and with clinical utility “largely theoretical” (Vallée and colleagues 2025). A proof of concept was poor for pre-eclampsia (Sanz Rodrigo and colleagues 2026).', next: 'A cohort with serial visits, ultrasound, biomarkers and outcomes, and a pre-specified prospective accuracy study of the running twin.', cap: 3 },
    { id: 'us', t: 'Generative ultrasound video world model', rung: 0, now: 'No published action-conditioned generative model of obstetric ultrasound was found. Vision-language models reach about 55% on a fetal ultrasound QA benchmark (Alasmawi and colleagues 2025).', next: 'Probe-motion-labelled video at scale, then a retrospective study of whether imagined views help any clinical task.', cap: 2 },
    { id: 'ptb', t: 'Drug repurposing for preterm birth by an immune twin', rung: 0, now: 'A single-cell-level model simulated nine drugs’ effects on gestational length in an independent cohort (Einhaus and colleagues 2026). These are simulated effects.', next: 'A trial of the top candidate. The simulation is a hypothesis generator.', cap: 2 }
  ];
  var ASSETS = [
    { id: 'cohort', t: 'A longitudinal cohort with serial visits and outcomes', rung: 1 },
    { id: 'ext', t: 'Data from a second site or population', rung: 2 },
    { id: 'pros', t: 'Capacity to run the model live in a clinic', rung: 3 },
    { id: 'rct', t: 'An RCT of acting on the model', rung: 4 },
    { id: 'reg', t: 'A regulatory and data-protection pathway', rung: 5 }
  ];
  function buildLadder() {
    var st = { id: 'twin', have: { cohort: true, ext: false, pros: false, rct: false, reg: false } };
    function compute() {
      var cs = CASES.filter(function (x) { return x.id === st.id; })[0];
      var reach = cs.rung, block = null;
      for (var r = cs.rung + 1; r <= 5; r++) {
        var need = ASSETS[r - 1];
        if (!st.have[need.id]) { block = need; break; }
        if (r > cs.cap) { block = { t: 'the field itself: ' + cs.next }; break; }
        if (r - cs.rung > 2) { block = { t: 'time: more than two rungs in 24 months is not realistic' }; break; }
        reach = r;
      }
      return { cs: cs, reach: reach, block: block };
    }
    var rCur = WM.readout('Rung today', ''), rReach = WM.readout('Reachable in 12–24 months', ''), rBlock = noticeReadout('What blocks the next rung');
    var detail = WM.h('div', { class: 'wm-note' }, WM.h('span', { class: 'wm-kicker' }, 'Evidence'), WM.h('p'));
    var cv = WM.canvas({
      w: 960, h: 420, label: 'Evidence ladder with the current rung solid and reachable rungs dashed',
      draw: function (g, env) {
        var c = env.c, R = compute();
        ladder(g, c, 40, 40, 330, R.cs.rung, R.reach);
        D.text(g, R.cs.t, 40, 410, { size: 20, weight: 700, maxWidth: 880 });
        D.text(g, 'solid: evidence exists · dashed: reachable with ticked assets · a heuristic', 940, 22, { size: 16, font: 'mono', color: c.muted, align: 'right', baseline: 'middle' });
        rCur.set(R.cs.rung + ': ' + RUNGS[R.cs.rung]);
        rReach.set(R.reach > R.cs.rung ? R.reach + ': ' + RUNGS[R.reach] : 'no gain in this window');
        rBlock.set(R.block ? R.block.t : 'nothing in this heuristic; the remaining work is doing the studies well');
        detail.lastChild.textContent = R.cs.now + ' Next: ' + R.cs.next;
      }
    });
    var sel = WM.select({ label: 'Question a pregnancy world model would be asked', options: CASES.map(function (x) { return { value: x.id, label: x.t }; }), value: 'twin', onChange: function (v) { st.id = v; cv.redraw(); } });
    var togs = ASSETS.map(function (a) { return WM.toggle({ label: a.t, value: st.have[a.id], onChange: function (v) { st.have[a.id] = v; cv.redraw(); } }); });
    return WM.panel({ title: 'Where each use case stands, and what moves it', kicker: 'Interactive · literature-based', note: 'Pick <b>Whole-pregnancy digital twin</b>, tick the assets one at a time and read the blocker. Then compare with <b>First-trimester pre-eclampsia risk and aspirin</b>.' },
      WM.controls(sel), cv, WM.h('div', { class: 'wm-controls' }, togs), WM.readouts(rCur, rReach), WM.readouts(rBlock), detail);
  }

  /* ====================================================================
     9. FIGURE: four families of model
     ==================================================================== */
  function buildFamilies() {
    return WM.canvas({
      w: 960, h: 500, label: 'Four families of pregnancy model and what a world model adds',
      draw: function (g, env) {
        var c = env.c, r = WM.rng('fam');
        var cards = [
          { t: 'Mechanistic', s: 'equations from physiology: PBPK, 0D/1D haemodynamics, placental transport', x: 20, y: 20, glyph: 'ode' },
          { t: 'Statistical dynamic', s: 'mixed models, joint models, competing risks, landmarking', x: 490, y: 20, glyph: 'fan' },
          { t: 'Learned latent dynamics', s: 'RNN or state-space on EHR sequences, latent ODEs for irregular visits, transformers', x: 20, y: 250, glyph: 'rnn' },
          { t: 'Generative, imaging', s: 'ultrasound foundation models, video-language models; no obstetric video world model yet', x: 490, y: 250, glyph: 'us' }
        ];
        cards.forEach(function (k) {
          D.box(g, k.x, k.y, 450, 215, { r: 6, fill: c.surface, stroke: c.ink, lw: 2 });
          D.text(g, k.t, k.x + 18, k.y + 40, { size: 24, weight: 700, font: 'display' });
          D.text(g, k.s, k.x + 18, k.y + 72, { size: 16, color: c.ink2, maxWidth: 240, lineHeight: 1.25 });
          var gx = k.x + 290, gy = k.y + 40, gw = 140, gh = 150, i, pts;
          D.box(g, gx, gy, gw, gh, { fill: c.stage, stroke: c.faint, lw: 1 });
          if (k.glyph === 'ode') { pts = []; for (i = 0; i <= 40; i++) { var t = i / 40; pts.push([gx + 10 + t * (gw - 20), gy + gh - 15 - (gh - 40) * (Math.exp(-3 * t) * Math.sin(9 * t) * 0.5 + 0.5)]); } D.poly(g, pts, { color: c.reality, lw: 2.5 }); D.text(g, 'dx/dt = f(x)', gx + gw / 2, gy + gh - 2, { size: 13, font: 'mono', align: 'center', baseline: 'bottom', color: c.muted }); }
          if (k.glyph === 'fan') { for (i = 0; i < 7; i++) { pts = []; var sl = (i - 3) * 0.08; for (var j = 0; j <= 10; j++) pts.push([gx + 10 + j * (gw - 20) / 10, gy + gh / 2 - j * (gw - 20) / 10 * (0.35 + sl) + 40]); D.poly(g, pts, { color: c.reality, lw: 1.5, alpha: 0.4 }); } pts = []; for (i = 0; i <= 10; i++) pts.push([gx + 10 + i * (gw - 20) / 10, gy + gh / 2 - i * (gw - 20) / 10 * 0.35 + 40]); D.poly(g, pts, { color: c.reality, lw: 3 }); }
          if (k.glyph === 'rnn') { for (i = 0; i < 4; i++) { var bx = gx + 12 + i * 32; D.box(g, bx, gy + 55, 24, 36, { r: 3, stroke: c.imagined, lw: 2, dash: true }); D.text(g, 'z', bx + 12, gy + 78, { size: 15, font: 'mono', align: 'center', color: c.imagined }); if (i < 3) D.arrow(g, bx + 26, gy + 73, bx + 31, gy + 73, { color: c.imagined, lw: 1.5, head: 6 }); if (i !== 2) { D.dot(g, bx + 12, gy + 125, 5, { fill: c.reality }); D.arrow(g, bx + 12, gy + 118, bx + 12, gy + 95, { color: c.muted, lw: 1.5, head: 6 }); } } D.text(g, 'irregular visits', gx + gw / 2, gy + gh - 4, { size: 13, align: 'center', baseline: 'bottom', color: c.muted }); }
          if (k.glyph === 'us') { g.save(); g.beginPath(); g.moveTo(gx + gw / 2, gy + 12); g.lineTo(gx + gw - 8, gy + gh - 14); g.lineTo(gx + 8, gy + gh - 14); g.closePath(); g.clip(); g.fillStyle = c.faint; g.fillRect(gx, gy, gw, gh); for (i = 0; i < 90; i++) D.dot(g, gx + r() * gw, gy + r() * gh, 1.5 + r() * 2, { fill: c.ink, alpha: 0.25 + 0.5 * r() }); g.restore(); D.box(g, gx + 30, gy + 70, 80, 50, { stroke: c.imagined, lw: 2, dash: true }); }
        });
        D.text(g, 'what a world model adds: one latent state, fed by every channel, rolled forward under each action', 480, 490, { size: 18, align: 'center', color: c.imagined });
      }
    }).el;
  }

  /* ====================================================================
     10. MODULE
     ==================================================================== */
  WM.register({
    id: 'm6', num: 6, title: 'World models for pregnancy', tagline: 'Pregnancy as a partially observed dynamical system: what a world model could track, forecast and imagine, and where it would mislead.', minutes: 40, level: 'Applied',
    build: function (root) {
      root.append(
        WM.hero({
          kicker: 'Module 6 · Applied', title: 'World models for pregnancy', minutes: 40,
          lede: 'The earlier modules built one idea: a model that holds a hidden state, updates it from observations, rolls it forward, and imagines the result of actions. This module asks what that idea means for a pregnancy, which of its parts exist today, and why the step from forecasting to what-if is the hard one. Every trajectory and population shown is synthetic.',
          goals: [
            'Describe a pregnancy as a <b>partially observed dynamical system</b>: latent physiology, sparse irregular observations, actions, outcomes, and an uncertain clock.',
            'Place mechanistic, statistical, learned-latent and generative models in one frame, and say what a <b>world model</b> would add: simulated what-if policies.',
            'Explain why a model that forecasts well can answer a what-if wrongly, through <b>confounding by indication</b>, positivity and time-varying confounding, and name the evidence needed before a simulator informs care.'
          ]
        }),

        /* ---------------- 1 SYSTEM ---------------- */
        WM.section({ id: 'system', kicker: '§1', title: 'Pregnancy as a system that changes' },
          WM.p('Module 2 described a system by its state, the actions applied to it, and the rule that moves one state to the next. Pregnancy fits that description with three complications. The state is mostly hidden: <dfn data-def="How well the placenta perfuses and exchanges; it is inferred from markers such as PlGF, uterine artery Doppler and fetal growth, never measured directly.">placental function</dfn>, <dfn data-def="The constriction of the maternal arteries, which sets blood pressure together with cardiac output; it is seen only through blood pressure readings.">vascular tone</dfn>, glycaemic regulation and fetal growth are inferred, not read off. The observations are sparse and irregular: a few antenatal visits, a few scans, one glucose tolerance test, and sometimes a home device. And the clock, gestational age, is itself an estimate.'),
          WM.p('The vocabulary carries over unchanged. <b>State</b>: the latent physiology at a given week. <b>Observation</b>: whatever a visit records, which is the state seen through noise and through one narrow window. <b>Action</b>: aspirin, an antihypertensive, a diet plan, the timing of the next visit, the timing of delivery. <b>Outcome</b>: an event on the clock, such as pre-eclampsia, gestational diabetes, preterm birth or fetal growth restriction. Delivery ends the process and so competes with every outcome.'),
          WM.explainer({
            id: 'm6-e1', title: 'A pregnancy as a hidden state', duration: 90, poster: 10,
            scenes: [
              { start: 0, end: 12, caption: 'The state is continuous and always there. Here it is one synthetic pregnancy’s systolic blood pressure, which rises from 26 weeks as vascular tone changes. The population average (dotted) rises only gently across pregnancy, as Module 1 noted. Nobody ever sees the solid line whole.', draw: e1s1 },
              { start: 12, end: 24, caption: 'What the record holds is eight clinic readings, unevenly spaced, each the state plus measurement noise of several mmHg. Everything a model knows about this pregnancy must come from such points.', draw: e1s2 },
              { start: 24, end: 36, caption: 'Each channel opens a window on a different part of the state. Blood pressure sees vascular tone; biometry sees fetal growth; one OGTT sees glycaemic regulation at one moment; PlGF sees placental function. A home device sees one channel densely.', draw: e1s3 },
              { start: 36, end: 50, caption: 'Actions change the state. The model’s job in a what-if is to draw the dashed branch: what the pressure would have done had an antihypertensive been started at 33 weeks. The solid line is the branch that was taken.', draw: e1s4 },
              { start: 50, end: 62, caption: 'Outcomes are events on the clock: a threshold crossed, a birth before 37 weeks. Delivery ends the process, so every outcome competes with it. This is why the Fetal Medicine Foundation screening model treats gestational age at delivery with pre-eclampsia as the quantity to model.', draw: e1s5 },
              { start: 62, end: 74, caption: 'The clock is estimated, usually from an early scan, and every estimate carries an error of days. Shift it by a few days and the same birth changes from term to preterm, every scan moves against its reference curve, and every gestational-age threshold moves with it.', draw: e1s6 },
              { start: 74, end: 90, caption: 'Put together, this is the loop from Module 1: observe, update a belief about the hidden state, roll it forward, imagine each action’s branch, act. The dashed boxes are the model. Each turn of the loop is weeks long, and the clock itself is uncertain.', draw: e1s7 }
            ]
          }),
          WM.callout('idea', 'Why the framing matters', 'A risk score answers one question at one visit. A state model carries a belief forward between visits, so every reading updates the same object, and the same object can be asked a forecast question and a what-if question. The two questions have very different evidence requirements, which is the subject of §4.')
        ),

        /* ---------------- 2 FAMILIES ---------------- */
        WM.section({ id: 'families', kicker: '§2', title: 'Four families of model, and what a world model adds' },
          WM.p('Four families of model already exist in obstetric research. They differ in where the rules come from.'),
          WM.p('<b>Mechanistic models</b> write the rules from physiology. Lumped cardiovascular circuits, driven by the trimester-level fall in vascular resistance and rise in heart rate and ventricular volume, reproduce maternal and uterine Doppler-like waveforms (Corsini and colleagues 2017), and personalised network models have been proposed as pre-eclampsia biomarkers in a 21-woman study (Popp and colleagues 2024). <dfn data-def="Physiologically based pharmacokinetic model: a set of organ compartments with flows and clearances, used to predict drug concentration over time.">PBPK</dfn> models predict how drug exposure changes with gestation; a labetalol model captured observed pregnancy exposure only roughly and underestimated clearance, with a predicted-to-observed AUC ratio of about 1.39 (Liu and colleagues 2024). These models answer what-if questions by construction, within the limits of what the equations contain.'),
          WM.p('<b>Statistical dynamic models</b> fit trajectories to data. <dfn data-def="Regression models in which each individual has their own random intercept and slope around a population curve, so repeated measurements can be modelled together.">Mixed models</dfn> give reference curves such as INTERGROWTH-21st. <dfn data-def="A model that fits a longitudinal marker and a time-to-event outcome together, so the marker’s trajectory updates the predicted risk as new values arrive.">Joint models</dfn> update an individual’s risk as each new marker value arrives (Rizopoulos 2011). <dfn data-def="A survival model in which gestational age at delivery with the disorder is the latent quantity, and delivery for other reasons competes with it.">Competing-risks screening</dfn> for pre-eclampsia treats the time of onset as a latent variable updated by biomarkers (Wright and colleagues 2015). Latent-class trajectory models of early-pregnancy blood pressure found six classes in about 175,000 pregnancies, with an adjusted odds ratio of 9.2 for pre-eclampsia in the elevated-stable class (Gunderson and colleagues 2021).'),
          WM.p('<b>Learned latent dynamics</b> are Module 4’s idea applied to records. Recurrent networks on embedded EHR sequences reached an AUC of 0.83 for birth before 28 weeks (Gao and colleagues 2019). <dfn data-def="A model whose hidden state evolves by a differential equation parameterised by a neural network, so it can be evaluated at any time, including irregular visit times.">Latent ODEs</dfn> handle irregular sampling in principle, though no pregnancy application was found in the literature base. <b>Generative and imaging models</b> learn representations of ultrasound: a fetal ultrasound foundation model pre-trained on 210,035 image-text pairs (Maani and colleagues 2026), and blind-sweep video models that date a pregnancy about as well as a sonographer when a novice holds the probe (Stringer and colleagues 2024). No action-conditioned generative world model of obstetric ultrasound video was found.'),
          buildFamilies(),
          WM.p('What a world model adds is not a fifth family. It is the arrangement: one latent state, updated by every channel, rolled forward under each candidate action, with mechanism where it is known and learned dynamics where it is not. The forecast half of that arrangement exists in pieces. The what-if half is where the evidence thins.'),
          WM.callout('source', 'Digital twins in obstetrics, as reviewed', 'A systematic review to July 2025 found eight original studies and nine conceptual works; only two met strict digital-twin criteria, most were static or batch-coupled, at early validation and at moderate-to-high risk of bias, and clinical utility was called “largely theoretical” (Vallée and colleagues 2025). A proof-of-concept twin built on public and synthetic data was poor for pre-eclampsia from wearable-accessible blood pressure alone (Sanz Rodrigo and colleagues 2026).')
        ),

        /* ---------------- 3 FILTER ---------------- */
        WM.section({ id: 'filter', kicker: '§3', title: 'Tracking a hidden state from a few visits' },
          WM.p('The forecast half can be shown concretely. Below, a synthetic pregnancy’s systolic pressure follows a hidden path. A <dfn data-def="A recursive estimator for a hidden state in a linear system with Gaussian noise. It predicts the state forward, then corrects the prediction by the new observation in proportion to how much more precise the observation is than the prediction.">Kalman filter</dfn> tracks the deviation of this pregnancy from the population curve using a level and a slope. Between visits it only predicts, so its band widens. At a visit it corrects, so the band narrows. Beyond today it has nothing to correct with, and the forecast band grows with every week of horizon, exactly as rollout error grew in Module 3.'),
          WM.p('This is a toy in two respects. The hidden path and the readings are generated by a seeded random process, and the filter is linear with Gaussian noise. A research version would use a joint model or a learned state-space model, several channels, and a non-Gaussian outcome. The behaviour to notice is the same: information arrives in lumps, uncertainty grows between them, and a forecast is a statement about a band, not a line.'),
          buildFilter(),
          WM.callout('warn', 'Misconception: more frequent visits fix forecasting', 'Frequent readings narrow the band around today by more than they narrow the band at term. The band at term has a floor set by how unpredictable the hidden state is week to week, the process noise, and no number of past readings removes it. The home device in the panel narrows the estimate today by a larger fraction than it narrows the forecast at 40 weeks. A forecast horizon of ten weeks is a long rollout in a system whose dynamics the model knows only roughly.'),
          WM.callout('idea', 'What the filter is, in Module 4’s terms', 'The level and slope are a two-number latent state. The predict step is the transition model, the correct step is the encoder, and the band is the belief. A recurrent state-space model learns both steps from data instead of assuming them. The irregular spacing of visits is why latent ODEs and continuous-time state-space models are the natural tools.')
        ),

        /* ---------------- 4 WHAT-IF ---------------- */
        WM.section({ id: 'whatif', kicker: '§4', title: 'Prediction is not intervention' },
          WM.p('A pregnancy world model would be asked what-if questions: start an antihypertensive now, or wait; deliver at 37 weeks, or at 39; see her again in one week, or in four. Module 5 noted that a model trained on recorded experience learns the regularities of that experience. In clinical records, one of those regularities is the clinician. Treatment goes to those judged to need it, for reasons the record captures only in part. This is <dfn data-def="Bias that arises because the reason a treatment was given is itself related to the outcome, so treated and untreated patients differ in ways other than the treatment.">confounding by indication</dfn>.'),
          WM.explainer({
            id: 'm6-e2', title: 'Why a good forecaster can give a bad what-if', duration: 100, poster: 8,
            scenes: [
              { start: 0, end: 12, caption: 'Two synthetic pregnancies at 20 weeks, identical in the record. Their hidden risk differs, and the clinician can see some of what the record does not hold.', draw: e2s1 },
              { start: 12, end: 24, caption: 'The clinician treats B. In the record this becomes one more variable: treated, yes or no. The reason for the decision is not stored.', draw: e2s2 },
              { start: 24, end: 38, caption: 'Across the records, treated pregnancies do worse: 14% against 6% in this synthetic population. A naive comparison concludes that treatment raises risk by 8 points.', draw: e2s3 },
              { start: 38, end: 50, caption: 'Split by the hidden risk and the picture inverts. Within each group treatment lowers risk. The treated group did worse because it was the high-risk group. The sign of the naive answer was wrong.', draw: e2s4 },
              { start: 50, end: 62, caption: 'A learned world model fitted to these records does what it is asked: it reproduces the data. The data were generated by a policy, so the model learns “treated implies worse”. Its forecasts can be excellent and its what-if wrong, because in the records “treated” also meant “judged high risk”.', draw: e2s5 },
              { start: 62, end: 74, caption: 'A second problem. Nobody with a recorded pressure below 120 was treated. The what-if “treat at 112” has no examples at all. This is a failure of <b>positivity</b>, and a learned model answers it by extrapolation, which is Module 3’s curve leaving its data.', draw: e2s6 },
              { start: 74, end: 86, caption: 'A third. In pregnancy the decision is repeated every visit. Blood pressure at 28 weeks is a confounder of the second decision and an effect of the first. Ordinary adjustment removes part of the first treatment’s effect and opens a path through the hidden variable. This is <b>time-varying confounding</b>.', draw: e2s7 },
              { start: 86, end: 100, caption: 'The repairs are known. Randomise the action, as ASPRE, CHAP and ARRIVE did. Emulate the trial explicitly, with a stated time zero. Take intervention effects from trials and let the model learn only dynamics. And treat off-policy evaluation of learned policies as a hypothesis, not a result.', draw: e2s8 }
            ]
          }),
          WM.p('The panel below generates a synthetic population in which the truth is known, because both branches are simulated for every person. You control how helpful the treatment really is, how strongly clinicians treat according to hidden risk, and how much of that risk the record captures. Four estimates are computed on the same people.'),
          buildWhatIf(),
          WM.callout('warn', 'The same failure in the literature', 'Two target-trial emulations asked whether labetalol or nifedipine is safer in pregnancy. One, in US claims data on chronic hypertension, found no difference: composite adjusted RR 1.03 (Leonard and colleagues 2025). The other, in Australian linked data on any hypertensive disorder of pregnancy, found more maternal morbidity with nifedipine: adjusted RR 1.33 (Atkinson and colleagues 2026). Residual confounding by indication, different populations and different outcome definitions are the candidate explanations. A simulator trained on either dataset would inherit its answer.'),
          WM.callout('math', 'Positivity and the target trial', '<p>A what-if about action a in state s is answerable from data only if people in states like s sometimes received a and sometimes did not, and if everything that drove the choice is recorded. Hernán and Robins (2016) make the requirement operational: write the randomised trial you would have run, with eligibility, strategies, time zero, follow-up and outcome, then emulate it. Where time zero is a gestational age, the emulation is often a sequence of weekly trials (DiTosto and colleagues 2025).</p>'),
          WM.callout('idea', 'Where learned policies stand', 'An offline reinforcement-learning policy for sepsis was reported to be associated with lower mortality where clinicians’ doses matched it (Komorowski and colleagues 2018); the evidence was retrospective, and the accompanying guidelines warn that such evaluation depends on no unmeasured confounding and on an effective sample size that importance weighting can shrink to almost nothing (Gottesman and colleagues 2019). No prospectively evaluated learned policy for an obstetric decision was found in the literature base.')
        ),

        /* ---------------- 5 CHECKS ---------------- */
        WM.section({ id: 'checks', kicker: '§5', title: 'What would make it trustworthy' },
          WM.p('Suppose the forecasting half is built and the what-if half is anchored to trials. Five checks remain before any of it touches care, and a sixth is a legal frame.'),
          WM.p('<dfn data-def="Whether the model ranks higher-risk individuals above lower-risk ones, summarised by the c-index or AUC.">Discrimination</dfn> and <dfn data-def="Whether the risks a model states match the observed frequencies, for example whether 20% of those given a risk of 20% go on to have the event.">calibration</dfn> are separate. <dfn data-def="How a model’s performance changes when it is used in a population, site or time other than the one it was developed in.">Transportability</dfn> is measured, not assumed. The visit process is informative, so missing weeks are <dfn data-def="Missing not at random: the probability that a value is missing depends on the unobserved value itself, for example when well women skip visits.">missing not at random</dfn>. Gestational-age dating error is a shared error in the clock, which is why population-specific dating models such as Garbhini-GA2 were developed and externally validated (Gadekar and colleagues 2024). And accuracy is not benefit.'),
          WM.explainer({
            id: 'm6-e3', title: 'The checks before a model touches care', duration: 84, poster: 11,
            scenes: [
              { start: 0, end: 14, caption: 'A model can keep its ranking and lose its numbers. Here a synthetic model has the same c-index at both sites, and at the new site every stated risk is about twice the observed frequency. Aspirin thresholds set on the stated risk would be wrong for everyone.', draw: e3s1 },
              { start: 14, end: 28, caption: 'Real transport losses are routine. A pre-eclampsia model of time from diagnosis to delivery fell from a c-index of 0.79 to 0.74 at an external site, and to 0.67 for early-onset disease. Blind-sweep dating was evaluated at new sites after lightweight local adaptation, and was non-inferior to sonographers there.', draw: e3s2 },
              { start: 28, end: 42, caption: 'Visits cluster when a woman is unwell and thin out when she is well, or far away, or busy. The record is a sample taken by a process that depends on the state. A model that ignores this over-learns sick weeks, and the fact of a visit is itself information.', draw: e3s3 },
              { start: 42, end: 56, caption: 'Accurate reading did not help. INFANT randomised 46,042 labouring women to CTG with or without decision-support software. Poor neonatal outcome was 0.7% in both arms. The distance from a correct reading to a better decision has to be measured in a trial.', draw: e3s4 },
              { start: 56, end: 70, caption: 'In India, the frame is concrete. CDSCO treats AI software that meets the definition as medical device software, with change control and disclosure of training data, real or synthetic. ICMR requires rigorous clinical and field validation. The DPDP Act’s research exemption falls away once data drive a decision about a specific person.', draw: e3s5 },
              { start: 70, end: 84, caption: 'The ladder in the next panel orders the evidence. Each rung is a different study, a model climbs one rung at a time, and a what-if needs a trial of the action, not a trial of the forecast.', draw: e3s6 }
            ]
          }),
          buildLadder(),
          WM.callout('source', 'The regulatory statements above, from the primary documents', '<p>CDSCO Guidance Document on Medical Device Software (CDSCO/MD/GD/MDSW/01/2026): AI/ML software meeting the definition is regulated as medical device software; standalone software is classed by condition state against significance of output; an Algorithm Change Protocol may be required; training, validation and test datasets must be disclosed, including whether they are real or synthetic; evidence generated outside India may be supplemented with validation in Indian populations; clinical investigation of investigational software needs Form MD-23. ICMR Ethical Guidelines for AI in Biomedical Research and Healthcare (2023): ten principles, including validity, requiring rigorous clinical and field validation, and written informed consent. Digital Personal Data Protection Act 2023: the research exemption in s.17(2)(b) applies only if the data are not used to take a decision specific to a Data Principal; a child is anyone under 18 and needs verifiable parental consent (s.9). The document notice says the CDSCO guidance is for public awareness and not for legal purposes; check the current text before relying on any of this.</p>')
        ),

        /* ---------------- 6 ROADMAP ---------------- */
        WM.section({ id: 'roadmap', kicker: '§6', title: 'A roadmap, and how it would fail' },
          WM.callout('pregnancy', 'What could be built in 12 to 24 months', '<p><b>The object.</b> A hybrid state model with four parts: a gestational-age clock with its own error; a latent physiological state (vascular, glycaemic, placental, fetal growth) updated by a joint or state-space filter from blood pressure, glucose, biomarkers and biometry at irregular visits; mechanistic sub-models where physiology is known, such as PBPK for dosing; and intervention effects taken from trials or pre-registered target-trial emulations, never learned from routine practice.</p><p><b>The data.</b> A cohort like GARBH-Ini, with enrolment before 20 weeks, four to five visits across trimesters, serial ultrasound and biospecimens, and linked outcomes, is the right shape. Two things are usually missing and must be planned: a second site for external validation, and a record of why each visit happened and why each treatment was started.</p><p><b>The deliverable.</b> Not a twin. A running forecast of two or three state components with calibrated bands, validated retrospectively, then externally, then prospectively as it would be shown to a clinician. The what-if layer is limited to actions with a trial anchor, with the trial’s effect size and population stated beside every answer.</p><p><b>How it fails.</b> Calibration drifts at the second site and nobody re-checks it. The visit process is treated as neutral, so the model learns the sick weeks. Dating error is ignored and every threshold inherits it. A what-if is answered for a region of state space with no treated examples. The forecast is accurate and the trial of acting on it shows no benefit, as INFANT found for CTG decision support. And the data-protection exemption that covered the research does not cover the decision support, which is a different legal object.</p>'),
          WM.callout('warn', 'Three things this module did not show', 'No validated patient-level digital twin exists in obstetrics. No learned policy for an obstetric decision has been evaluated prospectively. No generative world model of obstetric ultrasound video has been published. Each is a research opportunity. None is a product.')
        ),

        WM.takeaways([
          'A pregnancy is a <b>partially observed dynamical system</b>: a hidden physiological state, seen through sparse irregular channels, moved by actions, ending in events on an uncertain clock.',
          'Mechanistic, statistical, learned-latent and imaging models each exist. A <b>world model</b> is their arrangement around one latent state that can be rolled forward under each candidate action.',
          'Filtering narrows the belief at each reading; forecasting widens it with every week of horizon. A forecast is a band, and process noise sets a floor on its width at term that visit frequency cannot remove.',
          'A model fitted to records learns the clinician’s policy along with the physiology. <b>Prediction is not intervention</b>: what-ifs need randomisation, explicit trial emulation, or effects imported from trials.',
          'Before care: calibration where it is used, external and then prospective validation, a trial of acting on it, and the CDSCO, ICMR and DPDP requirements, which treat decision support differently from research.'
        ]),
        WM.quiz({
          id: 'q6', title: 'Check your understanding', questions: [
            { q: 'In the state, observation, action framing, which of these is the <b>state</b>?',
              options: ['The blood pressure written in the antenatal card at 28 weeks', 'The vascular tone and placental function that produced that reading', 'The decision to start labetalol', 'The diagnosis of pre-eclampsia at 35 weeks'], answer: 1,
              why: 'The reading is an observation: the state seen through noise and one window. Starting labetalol is an action. The diagnosis is an outcome, an event on the clock. The state is the hidden physiology that all three relate to.' },
            { q: 'In the filtering panel, why does the band widen after today even when visits were frequent before?',
              options: ['The filter forgets old readings', 'No further observations correct the prediction, so process noise accumulates with each week of horizon', 'Measurement noise grows later in pregnancy', 'The population curve is less accurate near term'], answer: 1,
              why: 'Beyond today the filter can only predict. Each predicted week adds the uncertainty of how the hidden state moves, which is process noise. Frequent earlier visits narrow the band today but cannot remove the uncertainty of weeks not yet observed.' },
            { q: 'In records, pregnancies given an antihypertensive have more pre-eclampsia than those not given one. The safest conclusion is:',
              options: ['The drug causes pre-eclampsia', 'Those treated were at higher risk for reasons the record may not hold, so the comparison does not estimate the drug’s effect', 'The drug has no effect', 'A larger dataset would settle it'], answer: 1,
              why: 'This is confounding by indication. More data of the same kind reproduce the same bias. The explainer showed the sign flipping once hidden risk was accounted for, and a simulator fitted to such records would reproduce the biased answer.' },
            { q: 'A learned simulator is asked what happens if treatment starts at a recorded pressure of 112, but nobody in the training data was treated below 120. Its answer is:',
              options: ['Reliable, because the model interpolates smoothly', 'An extrapolation with no supporting data, which is a positivity failure', 'Correct if the model’s one-step error is small', 'Correct if the model was trained on enough pregnancies'], answer: 1,
              why: 'Positivity requires that in states like this one, the action was sometimes taken and sometimes not. Where it was never taken, no amount of data constrains the answer. Small one-step error on the training distribution says nothing about this region.' },
            { q: 'A pre-eclampsia model keeps its c-index at a new hospital but states risks about twice as high as the observed frequencies. What is wrong, and what follows?',
              options: ['Discrimination has failed; the model must be retrained', 'Calibration has failed; thresholds based on stated risk, such as who receives aspirin, will be wrong', 'Nothing; the ranking is what matters', 'The new hospital’s data are at fault'], answer: 1,
              why: 'Ranking (discrimination) and the correctness of the stated probabilities (calibration) are separate. Decisions are made on the stated probability, so a miscalibrated model harms care even with intact discrimination. Recalibration at the new site is the usual remedy.' },
            { q: 'INFANT found that decision-support software for CTG interpretation did not change neonatal outcomes. For a pregnancy world model, this implies:',
              options: ['Forecast accuracy is not evidence of benefit; benefit needs a trial of acting on the model', 'The software was inaccurate', 'CTG is not a useful signal', 'Better outcomes follow once accuracy is high enough'], answer: 0,
              why: 'The trial tested the software as it would be used, decision support against none, and outcomes did not move. The distance from a correct reading to a better decision is not predicted by accuracy metrics. It is the fourth rung of the ladder, and only a trial of the action measures it.' }
          ]
        }),
        WM.goDeeper([
          { title: 'Competing risks model in screening for preeclampsia (Wright et al. 2015)', url: 'https://doi.org/10.1016/j.ajog.2015.02.018', note: 'Gestational age at delivery with pre-eclampsia as a latent variable; the closest classical analogue to a pregnancy state model.' },
          { title: 'ASPRE: aspirin versus placebo in pregnancies at high risk for preterm preeclampsia (Rolnik et al. 2017)', url: 'https://doi.org/10.1056/NEJMoa1704559', note: 'The clearest obstetric case of a predictive model linked to an RCT-proven action.' },
          { title: 'Dynamic predictions in joint models for longitudinal and time-to-event data (Rizopoulos 2011)', url: 'https://doi.org/10.1111/j.1541-0420.2010.01546.x', note: 'The statistical template for a continually updated risk state.' },
          { title: 'Early pregnancy blood pressure patterns and hypertensive disorders (Gunderson et al. 2021)', url: 'https://doi.org/10.1161/HYPERTENSIONAHA.121.18568', note: 'Latent-class BP trajectories in about 175,000 pregnancies.' },
          { title: 'Predicting interval from diagnosis to delivery in preeclampsia using EHR (Yang et al. 2025)', url: 'https://doi.org/10.1038/s41467-025-58437-7', note: 'Internal versus external c-index, and the drop for early-onset disease.' },
          { title: 'Digital twins in fertility, ART and pregnancy: a systematic review (Vallée et al. 2025)', url: 'https://doi.org/10.1016/j.rbmo.2025.105281', note: 'Where the field stands: two studies met strict criteria.' },
          { title: 'AI gestational age from blind ultrasound sweeps, prospective diagnostic accuracy (Stringer et al. 2024)', url: 'https://doi.org/10.1001/jama.2024.10770', note: 'A perception model at the prospective-accuracy rung.' },
          { title: 'Using big data to emulate a target trial (Hernán and Robins 2016)', url: 'https://doi.org/10.1093/aje/kwv254', note: 'How to ask a what-if of observational data without fooling yourself.' },
          { title: 'Labetalol versus nifedipine, target trial emulation in US data (Leonard et al. 2025)', url: 'https://doi.org/10.1016/j.jacadv.2025.102054', note: 'Read together with the Australian emulation below; they disagree.' },
          { title: 'Labetalol versus nifedipine, target trial emulation in Australian data (Atkinson et al. 2026)', url: 'https://doi.org/10.1016/j.eclinm.2026.104002', note: 'Same question, different answer.' },
          { title: 'Guidelines for reinforcement learning in healthcare (Gottesman et al. 2019)', url: 'https://doi.org/10.1038/s41591-018-0310-5', note: 'Why off-policy evaluation of learned policies is fragile.' },
          { title: 'INFANT: computerised interpretation of fetal heart rate during labour (Brocklehurst et al. 2017)', url: 'https://doi.org/10.1016/S0140-6736(17)30568-8', note: 'Accuracy without benefit, in 46,042 women.' },
          { title: 'CDSCO Guidance Document on Medical Device Software', url: 'https://www.cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/Guidance-document-on-Medical-Device-Software-under-MDR-2017.pdf', note: 'Classification, Algorithm Change Protocol and dataset disclosure for AI software in India.' },
          { title: 'ICMR Ethical Guidelines for Application of AI in Biomedical Research and Healthcare (2023)', url: 'https://www.icmr.gov.in/icmrobject/custom_data/pdf/Ethical-guidelines/Ethical_Guidelines_AI_Healthcare_2023.pdf', note: 'Ten principles, including validity and consent.' },
          { title: 'Digital Personal Data Protection Act, 2023', url: 'https://www.indiacode.nic.in/bitstream/123456789/22037/2/a2023-22.pdf', note: 'Section 17(2)(b) on the research exemption and section 9 on children.' }
        ])
      );
    }
  });
})();
