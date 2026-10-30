/* ==========================================================================
   Module 3: Learning a model from data
   Audience: first-year university (functions, basic statistics).
   Every interactive does real computation in the browser: least squares,
   small neural networks trained by gradient descent, a simulated pendulum.
   All pregnancy numbers are synthetic and illustrative.
   ========================================================================== */
(function () {
  'use strict';
  var WM = window.WM, D = WM.draw;

  /* ====================================================================
     1. SMALL HELPERS
     ==================================================================== */
  function f2(n, d) { return WM.ui.fmt(n, d); }
  function d1(v) { return f2(v, 1); }
  function fr(v) {
    if (!isFinite(v) || v >= 10) return 'over 10';
    if (v < 0.0005) return 'under 0.001';
    return v < 0.01 ? v.toFixed(4) : v.toFixed(3);
  }
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
    /* y label drawn here, further left than the core default, so it never touches tick labels */
    if (o.yl) { g.save(); g.translate(x - (o.ylo || 64), y + hh / 2); g.rotate(-Math.PI / 2); D.text(g, o.yl, 0, 0, { size: 20, align: 'center', baseline: 'bottom', color: 'muted' }); g.restore(); }
    return { X: function (v) { return A.x(sx(v)); }, Y: function (v) { return A.y(sy(v)); }, x: x, y: y, w: w, h: hh, xr: xr, yr: yr };
  }
  function inPlot(g, M, fn) { g.save(); g.beginPath(); g.rect(M.x - 2, M.y - 6, M.w + 8, M.h + 8); g.clip(); try { fn(); } finally { g.restore(); } }
  function fnPts(M, fn, a, b, n) {
    var pts = [], span = M.yr[1] - M.yr[0];
    for (var i = 0; i <= n; i++) {
      var x = a + (b - a) * i / n, y = fn(x);
      if (!isFinite(y)) y = M.yr[1] + span;
      pts.push([M.X(x), M.Y(D.clamp(y, M.yr[0] - span, M.yr[1] + span))]);
    }
    return pts;
  }
  function upto(pts, q) {
    var n = D.clamp(q) * (pts.length - 1), k = Math.floor(n), out = pts.slice(0, k + 1);
    if (k < pts.length - 1 && n > k) { var a = pts[k], b = pts[k + 1], f = n - k; out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
    return out;
  }
  function legend(g, c, x, y, items) {
    items.forEach(function (it) {
      if (it.k === 'dot') D.dot(g, x + 12, y, 7, { fill: c.reality });
      else if (it.k === 'ring') D.dot(g, x + 12, y, 7, { fill: false, stroke: it.c || c.imagined, lw: 2.5 });
      else if (it.k === 'band') D.box(g, x, y - 9, 30, 18, { fill: it.c || c.imagined, alpha: 0.3, stroke: false });
      else D.line(g, x, y, x + 30, y, { color: it.c || (it.k === 'dash' ? c.imagined : it.k === 'err' ? c.error : c.reality), lw: 3.5, dash: it.k === 'dash' });
      var m = D.text(g, it.t, x + 40, y, { size: 20, baseline: 'middle', color: c.ink2 });
      x += 40 + m.width + 26;
    });
  }
  function tag(g, c, s) { D.text(g, s, 940, 22, { size: 20, font: 'mono', color: c.muted, align: 'right', baseline: 'middle' }); }
  function rmse(a, b) { var s = 0; for (var i = 0; i < a.length; i++) { var d = a[i] - b[i]; s += d * d; } return Math.sqrt(s / Math.max(1, a.length)); }
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / Math.max(1, a.length); }

  /* ====================================================================
     2. NUMERICS: least squares, a tiny neural network, two systems
     ==================================================================== */
  function solve(A, b) {
    var n = b.length, i, j, k, M = A.map(function (r, i) { return r.slice().concat([b[i]]); });
    for (k = 0; k < n; k++) {
      var p = k; for (i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      var t = M[k]; M[k] = M[p]; M[p] = t;
      var piv = M[k][k] || 1e-12;
      for (i = k + 1; i < n; i++) { var f = M[i][k] / piv; if (!f) continue; for (j = k; j <= n; j++) M[i][j] -= f * M[k][j]; }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) { var s = M[i][n]; for (j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / (M[i][i] || 1e-12); }
    return x;
  }
  /* ridge-regularised least squares: minimise sum (y - w.row)^2 + lam |w|^2 */
  function lsq(rows, ys, lam) {
    var n = rows[0].length, A = [], b = [], i, j, k;
    for (i = 0; i < n; i++) { A.push(new Array(n).fill(0)); b.push(0); }
    for (k = 0; k < rows.length; k++) {
      var r = rows[k];
      for (i = 0; i < n; i++) { b[i] += r[i] * ys[k]; for (j = i; j < n; j++) A[i][j] += r[i] * r[j]; }
    }
    for (i = 0; i < n; i++) { for (j = 0; j < i; j++) A[i][j] = A[j][i]; A[i][i] += lam; }
    return solve(A, b);
  }
  function dot(w, r) { var s = 0; for (var i = 0; i < w.length; i++) s += w[i] * r[i]; return s; }

  /* The population system: logistic growth, x' = x + 1.6 x (1 - x). */
  var GR = 1.6;
  function F(x) { return x + GR * x * (1 - x); }
  function U(x) { return (x - 0.7) / 0.7; }
  function V(y) { return (y - 0.55) / 0.5; }
  function Vinv(v) { return 0.55 + 0.5 * v; }
  function polyRow(x, deg) { var u = U(x), r = [1]; for (var k = 1; k <= deg; k++) r.push(r[k - 1] * u); return r; }
  function polyFit(xs, ys, deg) {
    var w = lsq(xs.map(function (x) { return polyRow(x, deg); }), ys, 1e-7);
    return function (x) { return dot(w, polyRow(x, deg)); };
  }

  /* One hidden layer of tanh units, trained by full-batch Adam on squared error. */
  function Net(H, seed) {
    var r = WM.rng(seed), n = 3 * H + 1, P = new Float64Array(n), M1 = new Float64Array(n), M2 = new Float64Array(n), G = new Float64Array(n), A = new Float64Array(H), t = 0, j;
    for (j = 0; j < H; j++) { P[j] = WM.gauss(r) * 2.2; P[H + j] = WM.gauss(r) * 1.2; P[2 * H + j] = WM.gauss(r) / Math.sqrt(H); }
    var net = {
      it: 0,
      f: function (u) { var s = P[3 * H]; for (var j = 0; j < H; j++) s += P[2 * H + j] * Math.tanh(P[j] * u + P[H + j]); return s; },
      train: function (us, vs, iters, lr) {
        var N = us.length; if (!N) return;
        for (var it = 0; it < iters; it++) {
          G.fill(0);
          for (var i = 0; i < N; i++) {
            var u = us[i], o = P[3 * H];
            for (j = 0; j < H; j++) { A[j] = Math.tanh(P[j] * u + P[H + j]); o += P[2 * H + j] * A[j]; }
            var d = 2 * (o - vs[i]) / N;
            G[3 * H] += d;
            for (j = 0; j < H; j++) { var da = d * P[2 * H + j] * (1 - A[j] * A[j]); G[2 * H + j] += d * A[j]; G[j] += da * u; G[H + j] += da; }
          }
          t++;
          var c1 = 1 - Math.pow(0.9, t), c2 = 1 - Math.pow(0.999, t);
          for (j = 0; j < n; j++) {
            M1[j] = 0.9 * M1[j] + 0.1 * G[j]; M2[j] = 0.999 * M2[j] + 0.001 * G[j] * G[j];
            P[j] -= lr * (M1[j] / c1) / (Math.sqrt(M2[j] / c2) + 1e-8);
          }
        }
        net.it += iters;
      }
    };
    return net;
  }

  /* The pendulum: angle'' = -4 sin(angle) - 0.15 angle'. Recorded every 0.1 s, integrated with RK4. */
  var DT = 0.1, K2 = 4, CD = 0.15;
  function pacc(th, om) { return -K2 * Math.sin(th) - CD * om; }
  function pstep(s) {
    var th = s[0], om = s[1], hh = DT / 4;
    for (var i = 0; i < 4; i++) {
      var k1t = om, k1o = pacc(th, om);
      var k2t = om + hh / 2 * k1o, k2o = pacc(th + hh / 2 * k1t, om + hh / 2 * k1o);
      var k3t = om + hh / 2 * k2o, k3o = pacc(th + hh / 2 * k2t, om + hh / 2 * k2o);
      var k4t = om + hh * k3o, k4o = pacc(th + hh * k3t, om + hh * k3o);
      th += hh / 6 * (k1t + 2 * k2t + 2 * k3t + k4t); om += hh / 6 * (k1o + 2 * k2o + 2 * k3o + k4o);
    }
    return [th, om];
  }
  function pfeat(th, om) { var a = th, b = om / 2; return [1, a, b, a * a, a * b, b * b, a * a * a, a * a * b, a * b * b, b * b * b]; }
  /* Fit a cubic-polynomial transition model to 300 noisy transitions from swings up to amplitude A. */
  function fitPend(A, sig, seed) {
    var r = WM.rng(seed), rows = [], y1 = [], y2 = [];
    for (var i = 0; i < 300; i++) {
      var th = (2 * r() - 1) * A, om = (r() < 0.5 ? -1 : 1) * r() * Math.sqrt(Math.max(0, 2 * K2 * (Math.cos(th) - Math.cos(A))));
      var nx = pstep([th, om]);
      var oth = th + sig * WM.gauss(r), oom = om + 2 * sig * WM.gauss(r);
      rows.push(pfeat(oth, oom));
      y1.push(nx[0] + sig * WM.gauss(r) - oth); y2.push(nx[1] + 2 * sig * WM.gauss(r) - oom);
    }
    var w1 = lsq(rows, y1, 1e-6), w2 = lsq(rows, y2, 1e-6);
    return function (s) { var p = pfeat(s[0], s[1]); return [s[0] + dot(w1, p), s[1] + dot(w2, p)]; };
  }
  /* Roll the model forward; every k steps (k > 0) it is reset to the true state. k = 0 is open loop. */
  function pendRun(model, th0, H, k) {
    var tru = [[th0, 0]], i;
    for (i = 0; i < H; i++) tru.push(pstep(tru[i]));
    var pr = [tru[0]], err = [0], m = tru[0], bad = false;
    for (i = 0; i < H; i++) {
      if (k && i % k === 0) { m = tru[i]; bad = false; }
      if (!bad) { m = model(m); if (!isFinite(m[0]) || Math.abs(m[0]) > 40 || Math.abs(m[1]) > 200) bad = true; }
      pr.push(bad ? [NaN, NaN] : m);
      /* state error: angle error combined with velocity error scaled by the natural frequency (2 rad/s), in radians */
      err.push(bad ? 99 : Math.hypot(m[0] - tru[i + 1][0], (m[1] - tru[i + 1][1]) / 2));
    }
    return { tru: tru, pr: pr, err: err };
  }

  /* ====================================================================
     3. EXPLAINER 1: from a recording to a rule
     Script
       0-12  A population counted each season: a time series that levels off.
       12-26 Each neighbouring pair (x_t, x_t+1) becomes one point on a new plot.
       26-38 Many seasons give a noisy cloud; the true rule is hidden.
       38-54 Least squares: a dashed quadratic, red vertical gaps, RMSE.
       54-68 Degree 9 on 12 points: tiny training error, large error on new points.
       68-84 Data only below 0.7: good inside, wild outside.
     ==================================================================== */
  var E1 = null;
  function e1d() {
    if (E1) return E1;
    var r = WM.rng('e1-data'), ts = [0.06], cx = [], cy = [], i;
    for (i = 0; i < 11; i++) ts.push(D.clamp(F(ts[i]) + 0.025 * WM.gauss(r), 0.02, 1.3));
    for (i = 0; i < 48; i++) { var x = 0.03 + 1.32 * r(); cx.push(x); cy.push(F(x) + 0.045 * WM.gauss(r)); }
    /* every fourth point in x order is used for the degree-9 fit; the rest are held out */
    var order = cx.map(function (x, j) { return j; }).sort(function (a, b) { return cx[a] - cx[b]; }), tx = [], ty = [], hx = [], hy = [];
    order.forEach(function (j, k) { if (k % 4 === 3) { tx.push(cx[j]); ty.push(cy[j]); } else { hx.push(cx[j]); hy.push(cy[j]); } });
    var q = polyFit(cx, cy, 2);
    var w9 = polyFit(tx, ty, 9);
    var lx = [], ly = []; cx.forEach(function (x, j) { if (x < 0.7) { lx.push(x); ly.push(cy[j]); } });
    var w5 = polyFit(lx, ly, 5);
    E1 = {
      ts: ts, cx: cx, cy: cy, q: q, w9: w9, w5: w5, lx: lx, ly: ly, tx: tx, ty: ty, hx: hx, hy: hy,
      qErr: rmse(cx.map(q), cy), tr9: rmse(tx.map(w9), ty), ho9: rmse(hx.map(w9), hy)
    };
    return E1;
  }
  function e1Big(g) {
    return frame(g, 130, 54, 760, 360, [0, 1.4], [0, 1.3], { xl: 'x(t), size this season', yl: 'x(t+1), next season', xt: [0, 0.35, 0.7, 1.05, 1.4], yt: [0, 0.5, 1], yf: d1 });
  }
  function e1s1(g, p, env) {
    var c = env.c, E = e1d();
    var M = frame(g, 130, 54, 760, 360, [0, 11], [0, 1.3], { xl: 'season', yl: 'population size, x', xt: [0, 2, 4, 6, 8, 10], xf: String, yt: [0, 0.5, 1], yf: d1 });
    var pts = E.ts.map(function (v, i) { return [M.X(i), M.Y(v)]; }), q = D.clamp(p * 1.3);
    D.line(g, M.X(0), M.Y(1), M.X(11), M.Y(1), { color: c.muted, lw: 1.5, dash: [3, 6] });
    D.poly(g, upto(pts, q), { color: c.reality, lw: 3 });
    pts.forEach(function (pt, i) { if (i <= q * 11 + 1e-6) D.dot(g, pt[0], pt[1], 7, { fill: c.reality }); });
    D.text(g, 'ceiling = 1', M.X(11), M.Y(1) - 14, { size: 20, color: c.muted, align: 'right', alpha: D.seg(p, 0.6, 0.8) });
    tag(g, c, 'synthetic data');
  }
  function e1s2(g, p, env) {
    var c = env.c, E = e1d();
    var L = frame(g, 90, 70, 340, 320, [0, 11], [0, 1.3], { xl: 'season', xt: [0, 5, 10], xf: String, yt: [0, 1], yf: d1 });
    var R = frame(g, 590, 70, 330, 320, [0, 1.4], [0, 1.3], { xl: 'x(t)', yl: 'x(t+1)', xt: [0, 0.7, 1.4], yt: [0, 1], yf: d1 });
    D.text(g, 'recording', 260, 34, { size: 22, weight: 700, align: 'center', baseline: 'middle' });
    D.text(g, 'one point per pair', 755, 34, { size: 22, weight: 700, align: 'center', baseline: 'middle' });
    var pts = E.ts.map(function (v, i) { return [L.X(i), L.Y(v)]; });
    D.poly(g, pts, { color: c.reality, lw: 2.5 });
    pts.forEach(function (pt) { D.dot(g, pt[0], pt[1], 5, { fill: c.reality }); });
    for (var i = 0; i < 11; i++) {
      var t = D.seg(p, 0.06 + i * 0.075, 0.2 + i * 0.075);
      if (t <= 0) continue;
      var tx = R.X(E.ts[i]), ty = R.Y(E.ts[i + 1]);
      if (t < 1) {
        D.dot(g, pts[i][0], pts[i][1], 11, { fill: false, stroke: c.accent2, lw: 3 });
        D.dot(g, pts[i + 1][0], pts[i + 1][1], 11, { fill: false, stroke: c.accent2, lw: 3 });
        var sx = (pts[i][0] + pts[i + 1][0]) / 2, sy = (pts[i][1] + pts[i + 1][1]) / 2, e = D.ease(t);
        var mx = D.lerp(sx, tx, e), my = D.lerp(sy, ty, e) - Math.sin(e * Math.PI) * 60;
        D.dot(g, mx, my, 8, { fill: c.accent2 });
        D.text(g, '(x' + i + ', x' + (i + 1) + ')', mx, my - 22, { size: 20, font: 'mono', align: 'center', color: c.ink2, halo: true });
      } else D.dot(g, tx, ty, 7, { fill: c.reality });
    }
  }
  function e1cloud(g, c, M, n) {
    var E = e1d();
    for (var i = 0; i < n; i++) D.dot(g, M.X(E.cx[i]), M.Y(E.cy[i]), 6, { fill: c.reality });
  }
  function e1s3(g, p, env) {
    var c = env.c, M = e1Big(g);
    e1cloud(g, c, M, Math.floor(D.seg(p, 0, 0.75) * 48));
    D.text(g, 'the true rule is hidden from the learner', M.X(0.05), 74, { size: 22, color: c.muted, alpha: D.seg(p, 0.6, 0.8) });
    tag(g, c, 'synthetic data');
  }
  function e1s4(g, p, env) {
    var c = env.c, E = e1d(), M = e1Big(g);
    var ra = D.seg(p, 0.35, 0.6);
    if (ra > 0) E.cx.forEach(function (x, i) { D.line(g, M.X(x), M.Y(E.cy[i]), M.X(x), M.Y(E.q(x)), { color: c.error, lw: 2.5, alpha: ra }); });
    e1cloud(g, c, M, 48);
    inPlot(g, M, function () { D.poly(g, fnPts(M, E.q, 0, 1.4, 80), { color: c.imagined, lw: 4, dash: true, progress: D.seg(p, 0, 0.35) }); });
    legend(g, c, 150, 80, [{ k: 'dot', t: 'observed pair' }, { k: 'dash', t: 'fitted quadratic' }, { k: 'err', t: 'gap' }]);
    D.withAlpha(g, D.seg(p, 0.65, 0.8), function () {
      D.box(g, 360, 300, 320, 64, { r: 8, fill: c.surface, stroke: c.line, lw: 1.5 });
      D.text(g, 'RMSE = ' + f2(E.qErr, 3), 520, 332, { size: 26, weight: 700, font: 'mono', align: 'center', baseline: 'middle' });
    });
  }
  function e1s5(g, p, env) {
    var c = env.c, E = e1d(), M = e1Big(g);
    E.tx.forEach(function (x, i) { D.dot(g, M.X(x), M.Y(E.ty[i]), 6.5, { fill: c.reality }); });
    D.withAlpha(g, D.seg(p, 0.45, 0.6), function () { E.hx.forEach(function (x, i) { D.dot(g, M.X(x), M.Y(E.hy[i]), 6, { fill: false, stroke: c.reality, lw: 2 }); }); });
    inPlot(g, M, function () { D.poly(g, fnPts(M, E.w9, 0.02, 1.38, 260), { color: c.imagined, lw: 4, dash: true, progress: D.seg(p, 0, 0.4) }); });
    legend(g, c, 150, 80, [{ k: 'dot', t: '12 fitted' }, { k: 'ring', t: 'new points', c: c.reality }, { k: 'dash', t: 'degree 9' }]);
    D.withAlpha(g, D.seg(p, 0.6, 0.75), function () {
      D.box(g, 330, 290, 400, 100, { r: 8, fill: c.surface, stroke: c.line, lw: 1.5 });
      D.text(g, 'error on fitted points  ' + f2(E.tr9, 3), 350, 324, { size: 21, font: 'mono', baseline: 'middle' });
      D.text(g, 'error on new points     ' + (E.ho9 > 10 ? '> 10' : f2(E.ho9, 3)), 350, 360, { size: 21, font: 'mono', baseline: 'middle', color: c.error, weight: 700 });
    });
  }
  function e1s6(g, p, env) {
    var c = env.c, E = e1d(), M = e1Big(g);
    D.box(g, M.X(0.7), M.y, M.X(1.4) - M.X(0.7), M.h, { fill: c.faint, alpha: 0.55, stroke: false });
    D.text(g, 'no data here', M.X(1.05), M.y + 26, { size: 22, color: c.muted, align: 'center', baseline: 'middle' });
    E.lx.forEach(function (x, i) { D.dot(g, M.X(x), M.Y(E.ly[i]), 6, { fill: c.reality }); });
    inPlot(g, M, function () {
      D.poly(g, fnPts(M, E.w5, 0.02, 1.4, 120), { color: c.imagined, lw: 4, dash: true, progress: D.seg(p, 0, 0.4) });
      D.poly(g, fnPts(M, F, 0, 1.4, 80), { color: c.reality, lw: 3, alpha: D.seg(p, 0.45, 0.65) });
    });
    legend(g, c, 150, 80, [{ k: 'dash', t: 'degree-5 fit' }, { k: 'solid', t: 'true rule' }]);
  }

  /* ====================================================================
     4. EXPLAINER 2: why errors compound
     Script
       0-12  A damped pendulum; its true angle over time.
       12-26 One-step test: arrows from each true state land near the next.
       26-42 Rollout: the model feeds on itself; red gaps grow.
       42-56 Error vs horizon: one-step flat, rollout rising.
       56-70 e(k+1) = L e(k) + eps: growth if L > 1, levelling if L < 1.
       70-84 Phase plane: rollout drifts out of the training region and accelerates.
       84-98 Remedies: re-observing resets the error (sawtooth).
     A toy linear model (rotation plus decay) stands in for the pendulum so the
     effect is clean; it is labelled as a toy in the frame.
     ==================================================================== */
  var E2 = null;
  function rot(z, rho, ph) { var cc = Math.cos(ph), s = Math.sin(ph); return [rho * (cc * z[0] - s * z[1]), rho * (s * z[0] + cc * z[1])]; }
  function e2d() {
    if (E2) return E2;
    var T = [[1, 0]], M = [[1, 0]], O = [[1, 0]], S = [[1, 0]], z = [1, 0], i;
    for (i = 0; i < 60; i++) {
      T.push(rot(T[i], 0.985, 0.2)); M.push(rot(M[i], 0.99, 0.216)); O.push(rot(T[i], 0.99, 0.216));
      if (i % 10 === 0) z = T[i];
      z = rot(z, 0.99, 0.216); S.push(z);
    }
    var eo = [], em = [], es = [];
    /* error = distance between whole states (angle and velocity), which does not dip when the angles happen to cross */
    var dz = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    for (i = 0; i <= 60; i++) { eo.push(dz(O[i], T[i])); em.push(dz(M[i], T[i])); es.push(dz(S[i], T[i])); }
    var PT = [[0.75, 0]], PM = [[0.75, 0]];
    for (i = 0; i < 64; i++) {
      PT.push(rot(PT[i], 0.99, 0.22));
      var rr = Math.hypot(PM[i][0], PM[i][1]);
      PM.push(rr > 2.7 ? PM[i] : rr < 1 ? rot(PM[i], 1.012, 0.22) : rot(PM[i], 1.03 + 0.03 * (rr - 1), 0.22 + 0.15 * (rr - 1)));
    }
    var mo = mean(eo.slice(1));
    E2 = { T: T, M: M, O: O, S: S, eo: eo, em: em, es: es, PT: PT, PM: PM, mo: mo, emax: Math.max.apply(null, em) };
    return E2;
  }
  function e2Frame(g) {
    return frame(g, 120, 60, 780, 350, [0, 60], [-1.15, 1.15], { xl: 'time step', yl: 'angle (start = 1)', xt: [0, 10, 20, 30, 40, 50, 60], xf: String, yt: [-1, 0, 1], yf: function (v) { return f2(v, 0); } });
  }
  function pend(g, c, px, py, L, th, o) {
    o = o || {};
    var bx = px + L * Math.sin(th), by = py + L * Math.cos(th);
    D.line(g, px, py, bx, by, { color: c.reality, lw: 4, alpha: o.alpha });
    D.dot(g, bx, by, o.r || 22, { fill: c.reality, alpha: o.alpha });
    D.dot(g, px, py, 6, { fill: c.muted });
    return [bx, by];
  }
  function e2s1(g, p, env) {
    var c = env.c, E = e2d(), n = p * 40, k = Math.min(59, Math.floor(n)), f = n - k;
    var th = D.lerp(E.T[k][0], E.T[k + 1][0], f);
    D.line(g, 70, 90, 270, 90, { color: c.muted, lw: 3 });
    pend(g, c, 170, 90, 230, th * 0.7);
    var M = frame(g, 400, 70, 500, 320, [0, 60], [-1.15, 1.15], { xl: 'time step', yl: 'angle', xt: [0, 20, 40, 60], xf: String, yt: [-1, 0, 1], yf: function (v) { return f2(v, 0); } });
    D.poly(g, upto(E.T.map(function (z, i) { return [M.X(i), M.Y(z[0])]; }), n / 60), { color: c.reality, lw: 3 });
    tag(g, c, 'toy model, illustrative');
  }
  function e2truth(g, c, M, E) {
    D.poly(g, E.T.map(function (z, i) { return [M.X(i), M.Y(z[0])]; }), { color: c.reality, lw: 3 });
    E.T.forEach(function (z, i) { D.dot(g, M.X(i), M.Y(z[0]), 3.5, { fill: c.reality }); });
  }
  function e2s2(g, p, env) {
    var c = env.c, E = e2d(), M = e2Frame(g);
    e2truth(g, c, M, E);
    var n = Math.floor(D.seg(p, 0, 0.8) * 60);
    for (var i = 0; i < n; i++) {
      D.line(g, M.X(i), M.Y(E.T[i][0]), M.X(i + 1), M.Y(E.O[i + 1][0]), { color: c.imagined, lw: 2, dash: [5, 4] });
      D.dot(g, M.X(i + 1), M.Y(E.O[i + 1][0]), 5, { fill: false, stroke: c.imagined, lw: 2 });
    }
    legend(g, c, 140, 470, [{ k: 'solid', t: 'reality' }, { k: 'ring', t: 'one-step prediction' }]);
    tag(g, c, 'toy model, illustrative');
  }
  function e2s3(g, p, env) {
    var c = env.c, E = e2d(), M = e2Frame(g);
    e2truth(g, c, M, E);
    var q = D.seg(p, 0, 0.85), n = q * 60;
    for (var i = 2; i <= n; i += 2) D.line(g, M.X(i), M.Y(E.T[i][0]), M.X(i), M.Y(E.M[i][0]), { color: c.error, lw: 3 });
    D.poly(g, upto(E.M.map(function (z, i) { return [M.X(i), M.Y(z[0])]; }), q), { color: c.imagined, lw: 4, dash: true });
    var k = Math.floor(n);
    D.text(g, 'gap now: ' + f2(Math.abs(E.M[k][0] - E.T[k][0]), 2), M.X(Math.max(8, Math.min(44, k))), 40, { size: 22, weight: 700, color: c.error, align: 'center', baseline: 'middle', halo: true });
    legend(g, c, 140, 470, [{ k: 'solid', t: 'reality' }, { k: 'dash', t: 'rollout' }, { k: 'err', t: 'error' }]);
    tag(g, c, 'toy model');
  }
  function e2s4(g, p, env) {
    var c = env.c, E = e2d(), top = Math.ceil(E.emax * 10) / 10;
    var M = frame(g, 120, 60, 780, 350, [0, 60], [0, top], { xl: 'steps ahead', yl: 'error in the whole state', xt: [0, 10, 20, 30, 40, 50, 60], xf: String, yt: [0, top / 2, top], yf: function (v) { return f2(v, 2); } });
    var q = D.seg(p, 0, 0.8);
    D.poly(g, upto(E.eo.map(function (e, i) { return [M.X(i), M.Y(e)]; }), q), { color: c.muted, lw: 3.5 });
    D.poly(g, upto(E.em.map(function (e, i) { return [M.X(i), M.Y(e)]; }), q), { color: c.error, lw: 4.5 });
    D.withAlpha(g, D.seg(p, 0.8, 0.95), function () {
      D.text(g, 'one-step error', M.X(60), M.Y(E.eo[60]) - 18, { size: 22, color: c.muted, align: 'right', weight: 700 });
      D.text(g, 'rollout error', M.X(45), M.Y(E.em[45]) - 22, { size: 22, color: c.error, align: 'right', weight: 700, halo: true });
    });
    tag(g, c, 'toy model');
  }
  function bars(g, c, x, y, w, hh, L, n, title, sub) {
    var e = [1], i; for (i = 1; i < 12; i++) e.push(L * e[i - 1] + 1);
    var mx = Math.max.apply(null, e), bw = w / 12;
    D.text(g, title, x + w / 2, y - 50, { size: 24, weight: 700, align: 'center', baseline: 'middle' });
    D.text(g, sub, x + w / 2, y - 20, { size: 20, color: c.muted, align: 'center', baseline: 'middle' });
    D.line(g, x, y + hh, x + w, y + hh, { color: c.muted, lw: 1.5 });
    for (i = 0; i < Math.min(12, n); i++) { var bh = e[i] / mx * hh; D.box(g, x + i * bw + 3, y + hh - bh, bw - 6, bh, { fill: c.error, alpha: 0.85, stroke: false }); }
    D.text(g, 'steps 1 to 12', x, y + hh + 24, { size: 20, color: c.muted, baseline: 'middle' });
    if (n >= 12) D.text(g, 'step 12: ' + f2(e[11], 1) + ' ε', x + w, y + hh + 24, { size: 20, font: 'mono', align: 'right', baseline: 'middle', color: c.error, weight: 700 });
  }
  function e2s5(g, p, env) {
    var c = env.c;
    D.text(g, 'error(k + 1) ≈ L × error(k) + ε', 480, 56, { size: 32, weight: 700, font: 'mono', align: 'center', baseline: 'middle' });
    var n = Math.floor(D.seg(p, 0.1, 0.75) * 12) + (p > 0.1 ? 1 : 0);
    bars(g, c, 70, 220, 360, 220, 1.15, n, 'L = 1.15', 'errors grow geometrically');
    bars(g, c, 530, 220, 360, 220, 0.7, n, 'L = 0.7', 'errors level off near ε / (1 − L)');
  }
  function e2s6(g, p, env) {
    var c = env.c, E = e2d(), cx = 480, cy = 285, S = 80;
    g.save(); g.beginPath(); g.rect(0, 30, 960, 510); g.clip();
    D.dot(g, cx, cy, S, { fill: c.faint, alpha: 0.8 });
    D.dot(g, cx, cy, S, { fill: false, stroke: c.muted, lw: 2 });
    D.line(g, cx - 250, cy, cx + 250, cy, { color: c.muted, lw: 1.5 });
    D.line(g, cx, cy - 250, cx, cy + 250, { color: c.muted, lw: 1.5 });
    D.text(g, 'angle', cx + 250, cy + 22, { size: 20, color: c.muted, align: 'right' });
    D.text(g, 'velocity', cx + 10, 48, { size: 20, color: c.muted, baseline: 'middle' });
    D.text(g, 'shaded disc: training data', 40, 70, { size: 20, color: c.ink2, align: 'left', baseline: 'middle' });
    var q = D.seg(p, 0, 0.9), P = function (z) { return [cx + z[0] * S, cy - z[1] * S]; };
    var pt = upto(E.PT.map(P), q), pm = upto(E.PM.map(P), q);
    D.poly(g, pt, { color: c.reality, lw: 3 });
    D.poly(g, pm, { color: c.imagined, lw: 4, dash: true });
    var a = pt[pt.length - 1], b = pm[pm.length - 1];
    D.line(g, a[0], a[1], b[0], b[1], { color: c.error, lw: 3 });
    D.dot(g, a[0], a[1], 7, { fill: c.reality });
    D.dot(g, b[0], b[1], 8, { fill: false, stroke: c.imagined, lw: 3 });
    g.restore();
    legend(g, c, 24, 516, [{ k: 'solid', t: 'reality' }, { k: 'dash', t: 'rollout' }, { k: 'err', t: 'error' }]);
    tag(g, c, 'schematic');
  }
  function e2s7(g, p, env) {
    var c = env.c, E = e2d(), top = Math.ceil(E.emax * 10) / 10;
    var M = frame(g, 120, 60, 780, 350, [0, 60], [0, top], { xl: 'steps ahead', yl: 'error in the whole state', xt: [0, 10, 20, 30, 40, 50, 60], xf: String, yt: [0, top / 2, top], yf: function (v) { return f2(v, 2); } });
    var q = D.seg(p, 0, 0.55);
    D.poly(g, E.em.map(function (e, i) { return [M.X(i), M.Y(e)]; }), { color: c.error, lw: 4.5, alpha: 0.9 });
    D.poly(g, upto(E.es.map(function (e, i) { return [M.X(i), M.Y(e)]; }), q), { color: c.error, lw: 2.5 });
    for (var i = 0; i <= q * 60; i += 10) { D.dot(g, M.X(i), M.Y(0), 7, { fill: c.reality }); }
    D.text(g, 'never re-observe', M.X(58), M.Y(E.em[58]) - 16, { size: 21, color: c.error, align: 'right', weight: 700, halo: true });
    D.text(g, 'observe every 10 steps (dots)', M.X(60), M.Y(Math.max.apply(null, E.es)) - 14, { size: 21, color: c.ink2, align: 'right', alpha: D.seg(p, 0.3, 0.45), halo: true });
    D.withAlpha(g, D.seg(p, 0.55, 0.7), function () {
      D.box(g, 132, 58, 335, 128, { r: 8, fill: c.surface, stroke: c.line, lw: 1.5 });
      ['re-observe often', 'keep rollouts short', 'train on multi-step errors', 'know where data are missing'].forEach(function (s, k) {
        D.dot(g, 150, 80 + k * 28, 4.5, { fill: c.ink });
        D.text(g, s, 164, 80 + k * 28, { size: 20, baseline: 'middle' });
      });
    });
    tag(g, c, 'toy model');
  }

  /* ====================================================================
     5. EXPLAINER 3: what a model can be missing (data, or part of the state)
     Script
       0-12  Twelve points in a narrow range; one network fitted.
       12-26 Four more networks: agree on the data, fan out beyond it.
       26-38 Spread strip below: epistemic uncertainty; truth confirms errors there.
       38-52 Aleatoric noise band stays the same width as points are added.
       52-66 Two pendulums at the same angle, moving opposite ways.
       66-78 A previous snapshot reveals the direction: memory.
       78-92 Belief: a column of candidate velocities, propagated and filtered.
     ==================================================================== */
  var E3 = null;
  function trainEnsemble(xs, ys, tag2, iters) {
    var n = xs.length, nets = [], sets = [];
    for (var m = 0; m < 5; m++) {
      var r = WM.rng('boot' + m + '-' + tag2 + n), us = [], vs = [];
      for (var i = 0; i < n; i++) { var j = Math.floor(r() * n); us.push(U(xs[j])); vs.push(V(ys[j])); }
      var net = Net(10, 'ens' + m + '-' + tag2 + n);
      if (iters) net.train(us, vs, iters, 0.02);
      nets.push(net); sets.push([us, vs]);
    }
    return { nets: nets, sets: sets };
  }
  function e3d() {
    if (E3) return E3;
    var r = WM.rng('e3-data'), xs = [], ys = [], i;
    for (i = 0; i < 12; i++) { var x = 0.15 + 0.45 * r(); xs.push(x); ys.push(F(x) + 0.03 * WM.gauss(r)); }
    var ens = trainEnsemble(xs, ys, 'e3', 2000);
    var G = [], P = [], sd = [], mu = [];
    for (i = 0; i <= 70; i++) G.push(1.4 * i / 70);
    ens.nets.forEach(function (n) { P.push(G.map(function (x) { return Vinv(n.f(U(x))); })); });
    G.forEach(function (x, k) {
      var s = 0, s2 = 0; P.forEach(function (row) { s += row[k]; s2 += row[k] * row[k]; });
      mu.push(s / 5); sd.push(Math.sqrt(Math.max(0, s2 / 5 - (s / 5) * (s / 5))));
    });
    var ar = WM.rng('e3-alea'), ax = [], ay = [];
    for (i = 0; i < 130; i++) { var x2 = 0.03 + 1.34 * ar(); ax.push(x2); ay.push(F(x2) + 0.06 * WM.gauss(ar)); }
    /* belief: candidates with the observed angle and any velocity, pushed forward 0.3 s by the dynamics */
    var tr = [0.4, -1.2], pr = WM.rng('e3-part'), cand = [], obs2;
    var adv = function (s) { return pstep(pstep(pstep(s))); };
    obs2 = adv(tr)[0];
    for (i = 0; i < 90; i++) { var s0 = [0.4 + 0.02 * WM.gauss(pr), -2.5 + 5 * pr()], s1 = adv(s0); cand.push({ a: s0, b: s1, keep: Math.abs(s1[0] - obs2) < 0.05 }); }
    var kept = cand.filter(function (q) { return q.keep; });
    E3 = { xs: xs, ys: ys, G: G, P: P, sd: sd, mu: mu, ax: ax, ay: ay, tr: tr, tr2: adv(tr), obs2: obs2, cand: cand, vEst: mean(kept.map(function (q) { return q.a[1]; })) };
    return E3;
  }
  function e3Main(g, tall) { return frame(g, 120, 40, 780, tall ? 380 : 290, [0, 1.4], [-0.2, 1.4], { xl: 'x(t)', yl: 'x(t+1)', xt: [0, 0.35, 0.7, 1.05, 1.4], yt: [0, 0.5, 1], yf: d1 }); }
  function e3base(g, c, M, E) {
    D.box(g, M.X(0.62), M.y, M.X(1.4) - M.X(0.62), M.h, { fill: c.faint, alpha: 0.5, stroke: false });
    E.xs.forEach(function (x, i) { D.dot(g, M.X(x), M.Y(E.ys[i]), 6, { fill: c.reality }); });
  }
  function e3members(g, c, M, E, k, prog) {
    inPlot(g, M, function () {
      for (var m = 0; m < k; m++) {
        D.poly(g, E.P[m].map(function (y, i) { return [M.X(E.G[i]), M.Y(D.clamp(y, -1.2, 2.4))]; }), { color: c.imagined, lw: 2.5, dash: true, progress: m === k - 1 ? prog : 1 });
      }
    });
  }
  function e3s1(g, p, env) {
    var c = env.c, E = e3d(), M = e3Main(g, true);
    e3base(g, c, M, E);
    e3members(g, c, M, E, 1, D.seg(p, 0.2, 0.8));
    D.text(g, 'no data', M.X(1.0), M.y + 24, { size: 21, color: c.muted, align: 'center', baseline: 'middle' });
    tag(g, c, 'synthetic data');
  }
  function e3s2(g, p, env) {
    var c = env.c, E = e3d(), M = e3Main(g, true), sh = D.seg(p, 0, 0.7) * 4, k = 1 + Math.min(4, Math.floor(sh) + 1);
    e3base(g, c, M, E);
    e3members(g, c, M, E, k, sh - Math.floor(sh) || 1);
    D.withAlpha(g, D.seg(p, 0.7, 0.85), function () {
      D.text(g, 'agree', M.X(0.38), M.Y(1.25), { size: 24, weight: 700, align: 'center', baseline: 'middle', color: c.good });
      D.text(g, 'fan out', M.X(1.2), M.Y(1.25), { size: 24, weight: 700, align: 'center', baseline: 'middle', color: c.error, halo: true });
    });
    legend(g, c, 150, 70, [{ k: 'dot', t: 'data' }, { k: 'dash', t: 'five networks' }]);
  }
  function e3s3(g, p, env) {
    var c = env.c, E = e3d(), M = e3Main(g);
    e3base(g, c, M, E);
    e3members(g, c, M, E, 5, 1);
    var tA = D.seg(p, 0.45, 0.6);
    inPlot(g, M, function () { D.poly(g, fnPts(M, F, 0, 1.4, 70), { color: c.reality, lw: 3, alpha: tA }); });
    var S = frame(g, 120, 420, 780, 80, [0, 1.4], [0, 0.5], { yl: 'spread', yt: [0, 0.5], yf: d1 });
    var q = D.seg(p, 0, 0.4), pts = E.G.map(function (x, i) { return [S.X(x), S.Y(Math.min(0.5, E.sd[i]))]; });
    var vis = upto(pts, q);
    if (vis.length > 1) D.poly(g, vis.concat([[vis[vis.length - 1][0], S.Y(0)], [S.X(0), S.Y(0)]]), { fill: c.imagined, alpha: 0.28, stroke: false, close: true });
    D.poly(g, vis, { color: c.imagined, lw: 2.5, dash: true });
    D.poly(g, E.G.map(function (x, i) { return [S.X(x), S.Y(Math.min(0.5, Math.abs(E.mu[i] - F(x))))]; }), { color: c.error, lw: 3, alpha: tA });
    D.text(g, 'spread', S.X(0.02), S.y - 8, { size: 20, color: c.imagined, weight: 700, baseline: 'bottom' });
    D.text(g, 'actual error of the average', S.X(1.38), S.y - 8, { size: 20, color: c.error, weight: 700, baseline: 'bottom', align: 'right', alpha: tA });
  }
  function e3s4(g, p, env) {
    var c = env.c, E = e3d(), M = frame(g, 120, 60, 780, 350, [0, 1.4], [-0.2, 1.4], { xl: 'x(t)', yl: 'x(t+1)', xt: [0, 0.35, 0.7, 1.05, 1.4], yt: [0, 0.5, 1], yf: d1 });
    var up = fnPts(M, function (x) { return F(x) + 0.12; }, 0, 1.4, 60), dn = fnPts(M, function (x) { return F(x) - 0.12; }, 0, 1.4, 60).reverse();
    D.poly(g, up.concat(dn), { fill: c.reality, alpha: 0.13, stroke: false, close: true });
    D.poly(g, fnPts(M, F, 0, 1.4, 60), { color: c.reality, lw: 3 });
    var n = 10 + Math.floor(D.seg(p, 0.05, 0.85) * 120);
    for (var i = 0; i < n; i++) D.dot(g, M.X(E.ax[i]), M.Y(E.ay[i]), 4.5, { fill: c.reality });
    D.box(g, 570, 300, 330, 84, { r: 8, fill: c.surface, stroke: c.line, lw: 1.5 });
    D.text(g, 'points: ' + n, 590, 328, { size: 22, font: 'mono', baseline: 'middle' });
    D.text(g, 'band width: unchanged', 590, 360, { size: 22, font: 'mono', baseline: 'middle', color: c.ink2 });
    legend(g, c, 140, 500, [{ k: 'solid', t: 'true rule' }, { k: 'band', t: 'noise band (95%)', c: c.reality }]);
    tag(g, c, 'synthetic data');
  }
  function e3pend(g, c, p, memory) {
    var P = [[290, 100], [670, 100]], cur = 0.45, prev = [0.55, 0.35], names = ['A', 'B'];
    P.forEach(function (pv, i) {
      D.line(g, pv[0] - 70, pv[1], pv[0] + 70, pv[1], { color: c.muted, lw: 3 });
      if (memory) {
        var ga = D.seg(p, 0.1, 0.35);
        var gb = [pv[0] + 240 * Math.sin(prev[i]), pv[1] + 240 * Math.cos(prev[i])];
        D.withAlpha(g, 0.35 * ga, function () { pend(g, c, pv[0], pv[1], 240, prev[i]); });
        D.text(g, 'a moment ago', gb[0] + (i ? -24 : 24), gb[1] - 40, { size: 20, color: c.muted, align: i ? 'right' : 'left', alpha: ga, halo: true });
      }
      var b = pend(g, c, pv[0], pv[1], 240, cur);
      D.text(g, names[i], pv[0] - 90, pv[1] + 6, { size: 28, weight: 700, baseline: 'middle' });
      var show = memory ? D.seg(p, 0.4, 0.6) : D.seg(p, 0.45, 0.6);
      if (show < 1) D.text(g, '?', b[0] + 38, b[1] - 30, { size: 34, weight: 700, color: c.imagined, alpha: 1 - show, baseline: 'middle' });
      var dir = i === 0 ? -1 : 1;
      D.withAlpha(g, show, function () {
        D.arrow(g, b[0] + dir * 30, b[1] + 6, b[0] + dir * 110, b[1] + 6 + dir * 0, { color: c.reality, lw: 4 });
        D.text(g, i === 0 ? 'moving left' : 'moving right', b[0] + dir * 70, b[1] + 46, { size: 21, align: 'center', baseline: 'middle', halo: true });
      });
    });
  }
  function e3s5(g, p, env) {
    var c = env.c;
    e3pend(g, c, p, false);
    D.box(g, 200, 450, 560, 56, { r: 8, fill: c.surface, stroke: c.line, lw: 1.5 });
    D.text(g, 'camera reading for both: angle = 0.45 rad', 480, 478, { size: 22, font: 'mono', align: 'center', baseline: 'middle' });
  }
  function e3s6(g, p, env) {
    var c = env.c;
    e3pend(g, c, p, true);
    D.withAlpha(g, D.seg(p, 0.6, 0.75), function () {
      D.box(g, 120, 440, 720, 84, { r: 8, fill: c.surface, stroke: c.line, lw: 1.5 });
      D.text(g, 'A: 0.55 → 0.45 rad     B: 0.35 → 0.45 rad', 480, 466, { size: 22, font: 'mono', align: 'center', baseline: 'middle' });
      D.text(g, 'velocity ≈ (angle now − angle before) / time step', 480, 500, { size: 21, align: 'center', baseline: 'middle', color: c.ink2 });
    });
  }
  function e3s7(g, p, env) {
    var c = env.c, E = e3d();
    var M = frame(g, 120, 50, 780, 380, [-0.5, 0.9], [-2.6, 2.6], { xl: 'angle (rad)', yl: 'velocity (rad/s)', xt: [-0.4, 0, 0.4, 0.8], yt: [-2, 0, 2], xf: d1, yf: String });
    var mv = D.ease(D.seg(p, 0.25, 0.5)), cut = D.seg(p, 0.55, 0.7);
    D.line(g, M.X(0.4), M.Y(-2.6), M.X(0.4), M.Y(2.6), { color: c.reality, lw: 2, alpha: 1 - mv * 0.6 });
    D.text(g, 'picture 1', M.X(0.4) + 8, M.Y(2.45), { size: 20, color: c.ink2, baseline: 'middle', alpha: 1 - mv * 0.6 });
    D.withAlpha(g, D.seg(p, 0.45, 0.55), function () {
      D.line(g, M.X(E.obs2), M.Y(-2.6), M.X(E.obs2), M.Y(2.6), { color: c.reality, lw: 3 });
      D.text(g, 'picture 2', M.X(E.obs2) - 8, M.Y(2.45), { size: 20, align: 'right', baseline: 'middle', weight: 700 });
    });
    inPlot(g, M, function () { E.cand.forEach(function (q) {
      var x = D.lerp(q.a[0], q.b[0], mv), y = D.lerp(q.a[1], q.b[1], mv);
      var a = q.keep ? 1 : 1 - 0.8 * cut;
      D.dot(g, M.X(x), M.Y(y), q.keep ? 5.5 : 4.5, { fill: false, stroke: c.imagined, lw: 2, alpha: a });
    }); });
    D.withAlpha(g, D.seg(p, 0.75, 0.9), function () {
      D.dot(g, M.X(E.tr2[0]), M.Y(E.tr2[1]), 8, { fill: c.reality });
      D.box(g, 560, 330, 320, 70, { r: 8, fill: c.surface, stroke: c.line, lw: 1.5 });
      D.text(g, 'belief: velocity ≈ ' + f2(E.vEst, 1) + ' rad/s', 720, 352, { size: 21, align: 'center', baseline: 'middle', weight: 700 });
      D.text(g, '(true: ' + f2(E.tr[1], 1) + ' rad/s)', 720, 380, { size: 20, align: 'center', baseline: 'middle', color: c.ink2 });
    });
    legend(g, c, 140, 520, [{ k: 'ring', t: 'candidate states' }, { k: 'dot', t: 'true state' }]);
  }

  /* ====================================================================
     6. INTERACTIVE A: fit the rule from noisy pairs
     ==================================================================== */
  function buildFit() {
    var st = { model: 2, n: 40, noise: 0.05, cov: 1.4, seed: 1, truth: true, net: null, fit: null, us: [], vs: [] };
    var NIT = 3000;
    var rTr = WM.readout('Error on fitted points', '—'), rIn = WM.readout('True error, inside the data', '—'), rOut = WM.readout('True error, beyond the data', '—');
    var notice = noticeReadout('What you should notice');
    function gen() {
      var r = WM.rng('fit' + st.seed), xs = [], ys = [];
      for (var i = 0; i < st.n; i++) { var x = 0.03 + (st.cov - 0.03) * r(); xs.push(x); ys.push(F(x) + st.noise * WM.gauss(r)); }
      st.xs = xs; st.ys = ys; st.us = xs.map(U); st.vs = ys.map(V);
    }
    function pred(x) { return st.net ? Vinv(st.net.f(U(x))) : st.fit(x); }
    function stats() {
      var tr = rmse(st.xs.map(pred), st.ys), gi = [], go = [], i;
      for (i = 0; i <= 200; i++) { var x = 0.03 + 1.37 * i / 200, e = pred(x) - F(x); if (x <= st.cov + 1e-9 || st.cov > 1.38) gi.push(e); else go.push(e); }
      var ein = Math.sqrt(mean(gi.map(function (e) { return e * e; }))), eout = go.length ? Math.sqrt(mean(go.map(function (e) { return e * e; }))) : NaN;
      rTr.set(fr(tr)); rIn.set(fr(ein)); rOut.set(go.length ? fr(eout) : 'no region');
      var s, training = st.net && st.net.it < NIT;
      if (training) s = 'The network is still training (step ' + st.net.it + ' of ' + NIT + '). Watch the dashed curve settle onto the points.';
      else if (tr < 0.75 * ein && st.noise > 0) s = 'The curve matches the fitted points (error ' + fr(tr) + ') better than it matches the rule (' + fr(ein) + '). It has learned part of the noise. Held-out data would expose this.';
      else if (st.model === 1) s = 'A straight line cannot bend, so its error stays large however many points you add. This is underfitting.';
      else s = 'Inside the data the fit tracks the rule with error ' + fr(ein) + '.';
      if (!training && go.length && eout > 2 * ein && eout >= 0.001) s += ' Beyond x = ' + d1(st.cov) + ', where no data exist, the error is ' + (eout >= 10 ? 'over 10' : Math.round(eout / Math.max(ein, 1e-4)) + ' times larger') + '.';
      else if (!training && !go.length) s += ' Now shrink the data range and see what happens beyond it.';
      notice.set(s);
    }
    var cv = WM.canvas({
      w: 960, h: 500, animate: false,
      label: 'Scatter of noisy observed pairs of population size this season and next season, with the true rule as a solid curve and the fitted model as a dashed curve.',
      draw: function (g, env) {
        var c = env.c;
        if (st.net && st.net.it < NIT) {
          st.net.train(st.us, st.vs, 60, 0.02);
          if (env.frame % 5 === 0 || st.net.it >= NIT) stats();
          if (st.net.it >= NIT) setTimeout(function () { cv.stop(); }, 0);
        }
        var M = frame(g, 120, 70, 790, 340, [0, 1.4], [0, 1.3], { xl: 'x(t), size this season', yl: 'x(t+1), next season', xt: [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4], xf: d1, yt: [0, 0.5, 1], yf: d1 });
        if (st.cov < 1.39) {
          D.box(g, M.X(st.cov), M.y, M.X(1.4) - M.X(st.cov), M.h, { fill: c.faint, alpha: 0.55, stroke: false });
          D.text(g, 'no data', (M.X(st.cov) + M.X(1.4)) / 2, M.y + 22, { size: 20, color: c.muted, align: 'center', baseline: 'middle' });
        }
        st.xs.forEach(function (x, i) { D.dot(g, M.X(x), M.Y(D.clamp(st.ys[i], -0.05, 1.35)), 5, { fill: c.reality }); });
        inPlot(g, M, function () {
          if (st.truth) D.poly(g, fnPts(M, F, 0, 1.4, 80), { color: c.reality, lw: 3 });
          D.poly(g, fnPts(M, pred, 0, 1.4, 200), { color: c.imagined, lw: 4, dash: true });
        });
        legend(g, c, 120, 26, [{ k: 'dot', t: 'observed pairs' }].concat(st.truth ? [{ k: 'solid', t: 'true rule' }] : []).concat([{ k: 'dash', t: 'fitted model' }]));
        if (st.net) D.text(g, 'training step ' + Math.min(st.net.it, NIT), 900, M.y + M.h - 18, { size: 20, font: 'mono', color: c.muted, align: 'right', baseline: 'middle' });
      }
    });
    function refit() {
      gen();
      if (st.model === 'nn') {
        st.net = Net(12, 'fitnet' + st.seed); st.fit = null;
        if (WM.reducedMotion()) st.net.train(st.us, st.vs, NIT, 0.02); else cv.start();
      } else { st.net = null; st.fit = polyFit(st.xs, st.ys, st.model); cv.stop(); }
      stats(); cv.redraw();
    }
    var sel = WM.select({ label: 'Model family', value: 2, options: [{ value: 1, label: 'Straight line' }, { value: 2, label: 'Quadratic' }, { value: 5, label: 'Degree-5 polynomial' }, { value: 9, label: 'Degree-9 polynomial' }, { value: 'nn', label: 'Small neural network (12 units)' }], onChange: function (v) { st.model = v; refit(); } });
    var sN = WM.slider({ label: 'Number of observations', min: 6, max: 200, step: 1, value: st.n, fmt: 0, onInput: function (v) { st.n = v; refit(); } });
    var sS = WM.slider({ label: 'Measurement noise (sd)', min: 0, max: 0.15, step: 0.01, value: st.noise, fmt: 2, onInput: function (v) { st.noise = v; refit(); } });
    var sC = WM.slider({ label: 'Largest x observed', min: 0.4, max: 1.4, step: 0.05, value: st.cov, fmt: 2, onInput: function (v) { st.cov = v; refit(); } });
    var tg = WM.toggle({ label: 'Show the true rule', value: true, onChange: function (v) { st.truth = v; cv.redraw(); } });
    var b = WM.buttons([{ label: 'New noisy sample', kind: 'primary', onClick: function () { st.seed++; refit(); } }]);
    refit();
    return WM.panel({ title: 'Fit the rule from noisy pairs', note: 'Choose <b>Degree-9 polynomial</b> with 12 observations, then set <b>Largest x observed</b> to 0.6 and compare the three error readouts.' },
      cv, WM.controls(sel, sN, sS, sC, tg), WM.row(b.el), WM.readouts(rTr, rIn, rOut), WM.readouts(notice));
  }

  /* ====================================================================
     7. INTERACTIVE B: one-step versus rollout error on a pendulum
     ==================================================================== */
  function buildRoll() {
    var st = { A: 1.2, th0: 1.0, sig: 0.02, k: 0, seed: 1 }, model = null, res = null, one = null, H = 60;
    var rOne = WM.readout('Mean one-step error', '—'), rEnd = WM.readout('Error at step 60', '—'), rCross = WM.readout('First step with error > 0.1 rad', '—');
    var notice = noticeReadout('What you should notice');
    function stats() {
      var mo = mean(one.err.slice(1)), end = res.err[H], cross = -1;
      for (var i = 1; i <= H; i++) if (res.err[i] > 0.1) { cross = i; break; }
      rOne.set(fr(mo) + ' rad'); rEnd.set(end >= 10 ? 'model blew up' : fr(end) + ' rad'); rCross.set(cross < 0 ? 'never (in 60)' : 'step ' + cross);
      var s = 'One-step error averages ' + fr(mo) + ' rad. ';
      if (st.k === 1) s += 'With a fresh observation before every step, that is all the error there is.';
      else {
        var ratio = end / Math.max(mo, 1e-6);
        s += (st.k ? 'Re-observing every ' + st.k + ' steps' : 'Without any new observation') + ', the error at step 60 is ' + (end >= 10 ? 'unbounded, the rollout has left any sensible range' : fr(end) + ' rad, ' + (ratio > 1000 ? 'over 1,000' : Math.round(ratio)) + ' times the one-step error') + '.';
      }
      if (st.th0 > st.A + 0.05) s += ' The test swing starts at ' + d1(st.th0) + ' rad, outside the training swings of up to ' + d1(st.A) + ' rad, so the model is extrapolating from the first step.';
      notice.set(s);
    }
    function rerun() { res = pendRun(model, st.th0, H, st.k); one = pendRun(model, st.th0, H, 1); stats(); cv.redraw(); }
    function refit() { model = fitPend(st.A, st.sig, 'pend' + st.seed); rerun(); }
    var cv = WM.canvas({
      w: 960, h: 600,
      label: 'Top: the true pendulum angle over 60 steps as a solid line and the model rollout as a dashed line, with the training range shaded. Bottom: error against steps on a log scale.',
      draw: function (g, env) {
        var c = env.c, R = Math.max(1.2, Math.ceil(Math.max(st.th0, st.A) * 1.2 * 2) / 2);
        var T = frame(g, 120, 46, 700, 220, [0, H], [-R, R], { yl: 'angle (rad)', xt: [0, 10, 20, 30, 40, 50, 60], xf: String, yt: [-R, 0, R], yf: d1 });
        D.box(g, T.x, T.Y(st.A), T.w, T.Y(-st.A) - T.Y(st.A), { fill: c.faint, alpha: 0.6, stroke: false });
        D.text(g, 'training swings', T.X(60) - 6, T.Y(st.A) + 16, { size: 20, color: c.muted, align: 'right', baseline: 'middle', halo: true });
        inPlot(g, T, function () {
          D.poly(g, res.tru.map(function (s, i) { return [T.X(i), T.Y(s[0])]; }), { color: c.reality, lw: 3 });
          var seg = [];
          res.pr.forEach(function (s, i) {
            if (st.k && i % st.k === 0 && i > 0) { if (seg.length > 1) D.poly(g, seg, { color: c.imagined, lw: 3.5, dash: true }); seg = [[T.X(i), T.Y(res.tru[i][0])]]; }
            if (isFinite(s[0])) seg.push([T.X(i), T.Y(D.clamp(s[0], -3 * R, 3 * R))]);
          });
          if (seg.length > 1) D.poly(g, seg, { color: c.imagined, lw: 3.5, dash: true });
          if (st.k) for (var i = 0; i < H; i += st.k) D.dot(g, T.X(i), T.Y(res.tru[i][0]), st.k === 1 ? 3 : 6, { fill: c.reality });
        });
        legend(g, c, 140, 18, [{ k: 'solid', t: 'real pendulum' }, { k: 'dash', t: 'model rollout' }].concat(st.k ? [{ k: 'dot', t: 'observed' }] : []));
        var LY = function (e) { return (Math.log10(D.clamp(e, 1e-4, 10)) + 4) / 5; };
        var E = frame(g, 120, 340, 700, 190, [0, H], [0, 1], { xl: 'steps ahead', yl: 'state error (rad)', xt: [0, 10, 20, 30, 40, 50, 60], xf: String, yt: [0, 0.2, 0.4, 0.6, 0.8, 1], yf: function (v) { return ['0.0001', '0.001', '0.01', '0.1', '1', '10'][Math.round(v * 5)]; }, ylo: 88 });
        D.line(g, E.x, E.Y(LY(0.1)), E.x + E.w, E.Y(LY(0.1)), { color: c.muted, lw: 1, dash: [3, 5] });
        D.poly(g, one.err.slice(1).map(function (e, i) { return [E.X(i + 1), E.Y(LY(e))]; }), { color: c.muted, lw: 3 });
        if (st.k !== 1) D.poly(g, res.err.slice(1).map(function (e, i) { return [E.X(i + 1), E.Y(LY(e))]; }), { color: c.error, lw: 4 });
        D.text(g, 'one-step', E.X(60) + 6, E.Y(LY(one.err[H])), { size: 20, color: c.muted, baseline: 'middle', weight: 700 });
        if (st.k !== 1) D.text(g, 'your setting', E.X(60) + 6, E.Y(LY(res.err[H])) - (Math.abs(LY(res.err[H]) - LY(one.err[H])) < 0.12 ? 22 : 0), { size: 20, color: c.error, baseline: 'middle', weight: 700 });
        D.text(g, 'log scale: each line up is ten times more error', 820, 334, { size: 20, color: c.muted, align: 'right', baseline: 'bottom' });
      }
    });
    var sA = WM.slider({ label: 'Training swings up to', min: 0.4, max: 2.5, step: 0.1, value: st.A, fmt: 1, unit: 'rad', onInput: function (v) { st.A = v; refit(); } });
    var sT = WM.slider({ label: 'Test swing starts at', min: 0.2, max: 2.8, step: 0.1, value: st.th0, fmt: 1, unit: 'rad', onInput: function (v) { st.th0 = v; rerun(); } });
    var sS = WM.slider({ label: 'Measurement noise (sd)', min: 0, max: 0.06, step: 0.005, value: st.sig, fmt: 3, unit: 'rad', onInput: function (v) { st.sig = v; refit(); } });
    var sel = WM.select({ label: 'Re-observe the real state', value: 0, options: [{ value: 0, label: 'Never (open loop)' }, { value: 20, label: 'Every 20 steps' }, { value: 10, label: 'Every 10 steps' }, { value: 5, label: 'Every 5 steps' }, { value: 1, label: 'Every step (one-step)' }], onChange: function (v) { st.k = v; rerun(); } });
    var b = WM.buttons([{ label: 'New training sample', kind: 'primary', onClick: function () { st.seed++; refit(); } }]);
    refit();
    return WM.panel({ title: 'One step versus many steps', note: 'Leave <b>Re-observe</b> at Never and compare the two error lines. Then start the test swing beyond the training swings, and finally switch to <b>Every 10 steps</b>.' },
      cv, WM.controls(sA, sT, sS, sel), WM.row(b.el), WM.readouts(rOne, rEnd, rCross), WM.readouts(notice));
  }

  /* ====================================================================
     8. INTERACTIVE C: an ensemble that knows where it has no data
     ==================================================================== */
  function buildEns() {
    var st = { xs: [], ys: [], ens: null, it: 0, truth: true, rn: null }, NIT = 2000, G = [], i, last = null;
    for (i = 0; i <= 56; i++) G.push(1.4 * i / 56);
    var rIn = WM.readout('Spread near measurements', '—'), rOut = WM.readout('Spread away from them', '—'), rN = WM.readout('Measurements', '—');
    var notice = noticeReadout('What you should notice');
    var cv;
    function compute() {
      var P = st.ens.nets.map(function (n) { return G.map(function (x) { return Vinv(n.f(U(x))); }); });
      var mu = [], sd = [], er = [];
      G.forEach(function (x, k) {
        var s = 0, s2 = 0; P.forEach(function (row) { s += row[k]; s2 += row[k] * row[k]; });
        mu.push(s / 5); sd.push(Math.sqrt(Math.max(0, s2 / 5 - (s / 5) * (s / 5)))); er.push(Math.abs(s / 5 - F(x)));
      });
      last = { P: P, mu: mu, sd: sd, er: er };
      /* 'near the data' = within 0.08 of some measurement */
      var a = [], b = [];
      G.forEach(function (x, k) { var near = st.xs.some(function (xm) { return Math.abs(xm - x) <= 0.08; }); (near ? a : b).push(sd[k]); });
      var ms = mean(sd), me = mean(er), num = 0, d1s = 0, d2s = 0;
      G.forEach(function (x, k) { num += (sd[k] - ms) * (er[k] - me); d1s += (sd[k] - ms) * (sd[k] - ms); d2s += (er[k] - me) * (er[k] - me); });
      var corr = num / Math.sqrt(d1s * d2s || 1), sIn = mean(a), sOut = b.length ? mean(b) : NaN;
      rIn.set(fr(sIn)); rOut.set(b.length ? fr(sOut) : 'no gap left'); rN.set(String(st.xs.length));
      if (st.it < NIT) notice.set('Five networks are training (step ' + st.it + ' of ' + NIT + ').');
      else notice.set((b.length ? 'Spread is ' + fr(sIn) + ' near the measurements and ' + fr(sOut) + ' away from them. ' : 'The measurements now cover the whole range, and the spread is small everywhere. ') +
        'Across the range, spread and the actual error of the average have a correlation of ' + f2(corr, 2) + '. ' + (b.length ? 'Measure where the dashed curves fan out and watch the fan close.' : ''));
    }
    function trainStep(n) { st.ens.nets.forEach(function (net, m) { net.train(st.ens.sets[m][0], st.ens.sets[m][1], n, 0.02); }); st.it += n; }
    function retrain() {
      st.ens = trainEnsemble(st.xs, st.ys, 'live', 0); st.it = 0;
      if (WM.reducedMotion()) trainStep(NIT); else cv.start();
      compute(); cv.redraw();
    }
    function reset() {
      var r = WM.rng('ens-data'); st.xs = []; st.ys = []; st.rn = WM.rng('ens-noise');
      for (var j = 0; j < 8; j++) { var x = 0.15 + 0.45 * r(); st.xs.push(x); st.ys.push(F(x) + 0.03 * WM.gauss(r)); }
      retrain();
    }
    function measure(x) { if (st.xs.length >= 40) return; st.xs.push(x); st.ys.push(F(x) + 0.03 * WM.gauss(st.rn)); retrain(); }
    var MX = { x: 120, w: 780 };
    cv = WM.canvas({
      w: 960, h: 560, touchAction: 'manipulation',
      label: 'Five neural networks fitted to the same measurements, drawn as dashed curves, with a strip below showing their spread and the actual error.',
      pointer: function (type, x, y) {
        if (type !== 'down' || y > 380 || x < MX.x || x > MX.x + MX.w) return;
        measure(D.clamp((x - MX.x) / MX.w * 1.4, 0.02, 1.38));
      },
      draw: function (g, env) {
        var c = env.c;
        if (st.it < NIT) { trainStep(40); compute(); if (st.it >= NIT) setTimeout(function () { cv.stop(); }, 0); }
        var M = frame(g, MX.x, 50, MX.w, 280, [0, 1.4], [-0.2, 1.4], { xl: 'x(t)', yl: 'x(t+1)', xt: [0, 0.35, 0.7, 1.05, 1.4], yt: [0, 0.5, 1], yf: d1 });
        inPlot(g, M, function () {
          last.P.forEach(function (row) { D.poly(g, row.map(function (y, k) { return [M.X(G[k]), M.Y(D.clamp(y, -1, 2.4))]; }), { color: c.imagined, lw: 2, dash: true, alpha: 0.6 }); });
          D.poly(g, last.mu.map(function (y, k) { return [M.X(G[k]), M.Y(D.clamp(y, -1, 2.4))]; }), { color: c.imagined, lw: 4.5, dash: true });
          if (st.truth) D.poly(g, fnPts(M, F, 0, 1.4, 70), { color: c.reality, lw: 3 });
        });
        st.xs.forEach(function (x, k) { D.dot(g, M.X(x), M.Y(st.ys[k]), 6, { fill: c.reality, stroke: c.stage, lw: 2 }); });
        legend(g, c, 130, 18, [{ k: 'dot', t: 'measurements' }, { k: 'dash', t: 'five networks and their average' }].concat(st.truth ? [{ k: 'solid', t: 'true rule' }] : []));
        var S = frame(g, MX.x, 430, MX.w, 90, [0, 1.4], [0, 0.4], { yt: [0, 0.4], yf: d1 });
        var pts = G.map(function (x, k) { return [S.X(x), S.Y(Math.min(0.4, last.sd[k]))]; });
        D.poly(g, pts.concat([[S.X(1.4), S.Y(0)], [S.X(0), S.Y(0)]]), { fill: c.imagined, alpha: 0.25, stroke: false, close: true });
        D.poly(g, pts, { color: c.imagined, lw: 2.5, dash: true });
        D.poly(g, G.map(function (x, k) { return [S.X(x), S.Y(Math.min(0.4, last.er[k]))]; }), { color: c.error, lw: 3 });
        D.text(g, 'spread (shaded, dashed)', S.X(0.01), S.y - 12, { size: 20, color: c.imagined, weight: 700, baseline: 'bottom' });
        D.text(g, 'actual error of the average (solid)', S.X(1.4), S.y - 12, { size: 20, color: c.error, weight: 700, baseline: 'bottom', align: 'right' });
        if (st.it < NIT) D.text(g, 'training ' + st.it + ' / ' + NIT, 900, 70, { size: 20, font: 'mono', color: c.muted, align: 'right', baseline: 'middle' });
        else if (env.pointer.inside && env.pointer.y < 380) D.line(g, env.pointer.x, M.y, env.pointer.x, M.y + M.h, { color: c.muted, lw: 1.5, dash: [4, 4] });
      }
    });
    var tg = WM.toggle({ label: 'Show the true rule', value: true, onChange: function (v) { st.truth = v; cv.redraw(); } });
    var b = WM.buttons([
      { label: 'Measure where they disagree most', kind: 'primary', onClick: function () { var k = 0; last.sd.forEach(function (s, j) { if (s > last.sd[k]) k = j; }); measure(D.clamp(G[k], 0.02, 1.38)); } },
      { label: 'Reset measurements', kind: 'ghost', onClick: function () { reset(); } }
    ]);
    reset();
    return WM.panel({ title: 'Five networks, one question: where are we guessing?', note: 'Click the upper plot to take a measurement at that size, or press <b>Measure where they disagree most</b> three or four times. Watch the spread strip.' },
      cv, WM.controls(tg), WM.row(b.el), WM.readouts(rIn, rOut, rN), WM.readouts(notice));
  }

  /* ====================================================================
     9. INTERACTIVE D: the hidden velocity
     ==================================================================== */
  var HVF = [
    function (E, t) { var a = E.ob[t]; return [1, a, a * a, a * a * a]; },
    function (E, t) { var a = E.ob[t]; return [1, a, E.ob[t - 1], a * a * a]; },
    function (E, t) { var a = E.ob[t]; return [1, a, E.ob[t - 1], E.ob[t - 2], a * a * a]; },
    function (E, t) { var a = E.ob[t]; return [1, a, E.om[t], a * a * a, a * a * E.om[t]]; }
  ];
  var HVN = ['angle now only', 'angle now + 1 before', 'angle now + 2 before', 'angle + velocity sensor'];
  function hvCompute(sig) {
    var r = WM.rng('hv-traj'), rn = WM.rng('hv-noise'), eps = [], e, t;
    for (e = 0; e < 40; e++) {
      var A = 0.35 + 0.85 * r(), ph = 6.2832 * r(), s = [A * Math.cos(ph), -2 * A * Math.sin(ph)], E = { th: [], om: [], ob: [] };
      for (t = 0; t < 36; t++) { E.th.push(s[0]); E.om.push(s[1]); E.ob.push(s[0] + sig * WM.gauss(rn)); s = pstep(s); }
      eps.push(E);
    }
    return HVF.map(function (fn) {
      var rows = [], ys = [];
      for (e = 0; e < 30; e++) for (t = 2; t < 35; t++) { rows.push(fn(eps[e], t)); ys.push(eps[e].ob[t + 1]); }
      var w = lsq(rows, ys, 1e-6), pts = [], se = 0, n = 0;
      for (e = 30; e < 40; e++) for (t = 2; t < 35; t++) {
        var pv = dot(w, fn(eps[e], t)), d = pv - eps[e].th[t + 1];
        se += d * d; n++; pts.push([eps[e].ob[t], eps[e].ob[t + 1], pv]);
      }
      return { rmse: Math.sqrt(se / n), pts: pts };
    });
  }
  function buildHidden() {
    var st = { m: 0, sig: 0.01 }, R = null;
    var rE = WM.readout('One-step error (selected model)', '—');
    var notice = noticeReadout('What you should notice');
    function upd() {
      var e = R[st.m].rmse;
      rE.set(fr(e) + ' rad');
      var s;
      if (st.m === 0) s = 'With the angle alone, the predictions (rings) collapse onto one line through the middle of the loops of real points. The same angle occurs swinging either way, so the model averages the two futures. Its error is ' + (function (q) { return q >= 50 ? 'more than 50 times' : q < 1.5 ? 'about the same as' : Math.round(q) + ' times'; })(e / Math.max(R[1].rmse, 1e-4)) + ' that of the model with one past angle' + (e / Math.max(R[1].rmse, 1e-4) < 1.5 ? ', because camera noise dominates at this setting.' : '.');
      else if (st.m === 3) s = 'A direct velocity measurement makes the state complete. This is the reference for what the memory models are trying to recover.';
      else s = 'With memory the rings sit on the real points: the change between angles reveals the velocity. ' + (st.sig >= 0.03 ? 'With this much noise, the difference of two noisy angles is a noisy velocity, and a longer memory helps.' : 'Raise the noise to see a longer memory pay off.');
      notice.set(s);
    }
    function recompute() { R = hvCompute(st.sig); upd(); cv.redraw(); }
    var cv = WM.canvas({
      w: 960, h: 500,
      label: 'Left: the real change in angle over one step against the current angle as dots, with the model predictions as rings. Right: one-step error for four kinds of model input, as horizontal bars.',
      draw: function (g, env) {
        var c = env.c;
        /* plotting the change in angle (next minus now) separates the two swing directions */
        var M = frame(g, 120, 60, 420, 360, [-1.3, 1.3], [-0.3, 0.3], { xl: 'angle now (rad)', yl: 'change to next angle', xt: [-1, 0, 1], yt: [-0.2, 0, 0.2], xf: String, yf: d1, ylo: 70 });
        D.text(g, 'swinging one way', M.X(0), M.Y(0.27), { size: 20, color: c.muted, align: 'center', baseline: 'middle' });
        D.text(g, 'swinging the other way', M.X(0), M.Y(-0.27), { size: 20, color: c.muted, align: 'center', baseline: 'middle' });
        R[st.m].pts.forEach(function (q, k) { if (k % 2) return; D.dot(g, M.X(q[0]), M.Y(D.clamp(q[1] - q[0], -0.3, 0.3)), 3, { fill: c.reality }); });
        R[st.m].pts.forEach(function (q, k) { if (k % 2) return; D.dot(g, M.X(q[0]), M.Y(D.clamp(q[2] - q[0], -0.3, 0.3)), 5, { fill: false, stroke: c.imagined, lw: 1.6 }); });
        legend(g, c, 110, 22, [{ k: 'dot', t: 'real' }, { k: 'ring', t: 'predicted' }]);
        var mx = Math.max.apply(null, R.map(function (q) { return q.rmse; })), x0 = 620, bw = 220;
        D.text(g, 'one-step error, held-out swings', 620, 40, { size: 20, weight: 700, baseline: 'middle' });
        R.forEach(function (q, k) {
          var y = 90 + k * 96, on = k === st.m, w = Math.max(3, q.rmse / mx * bw);
          D.text(g, HVN[k], x0, y, { size: 20, baseline: 'middle', weight: on ? 700 : 400, color: on ? c.ink : c.ink2 });
          D.box(g, x0, y + 18, w, 28, { fill: on ? c.error : c.muted, alpha: on ? 0.9 : 0.45, stroke: false, r: 3 });
          D.text(g, fr(q.rmse), x0 + w + 8, y + 32, { size: 20, font: 'mono', baseline: 'middle', color: on ? c.ink : c.ink2 });
          if (on) D.text(g, '▶', x0 - 12, y, { size: 18, align: 'right', baseline: 'middle', color: c.ink });
        });
      }
    });
    var sel = WM.select({ label: 'What the model is given', value: 0, options: HVN.map(function (n, k) { return { value: k, label: n.charAt(0).toUpperCase() + n.slice(1) }; }), onChange: function (v) { st.m = v; upd(); cv.redraw(); } });
    var sS = WM.slider({ label: 'Camera noise (sd)', min: 0, max: 0.06, step: 0.005, value: st.sig, fmt: 3, unit: 'rad', onInput: function (v) { st.sig = v; recompute(); } });
    R = hvCompute(st.sig); upd();
    return WM.panel({ title: 'A camera that sees only the angle', note: 'Switch between <b>Angle now only</b> and <b>Angle now + 1 before</b> and watch where the rings go. Then raise the <b>Camera noise</b> and compare one and two past angles.' },
      cv, WM.controls(sel, sS), WM.readouts(rE), WM.readouts(notice));
  }

  /* ====================================================================
     10. PREGNANCY PANEL: two fetuses, one scan or two (synthetic)
     ==================================================================== */
  var REFW = [[20, 330], [24, 670], [28, 1200], [32, 1900], [36, 2750], [40, 3500]];
  function refW(w) {
    for (var i = 0; i < REFW.length - 1; i++) if (w <= REFW[i + 1][0]) {
      var a = REFW[i], b = REFW[i + 1], f = (w - a[0]) / (b[0] - a[0]);
      return Math.exp(Math.log(a[1]) + (Math.log(b[1]) - Math.log(a[1])) * f);
    }
    return REFW[REFW.length - 1][1];
  }
  function ratA() { return 0.84; }
  /* B falls across centiles, and (unknown to any model at 30 weeks) the fall speeds up later.
     Coefficients chosen so that B's weight still rises every week (a fetus does not lose weight). */
  function ratB(w) { return 1.0 - 0.016 * (w - 20) - 0.0008 * Math.pow(Math.max(0, w - 30), 2); }
  function buildPreg() {
    var st = { two: false, reveal: false }, SC = [22, 26, 30], NOW = 30;
    var rA = WM.readout('Forecast at 38 weeks, A', '—'), rB = WM.readout('Forecast at 38 weeks, B', '—');
    var notice = noticeReadout('What you should notice');
    function fc(rat, w) { var r30 = rat(NOW), sl = st.two ? (rat(NOW) - rat(26)) / 4 : 0; return refW(w) * (r30 + sl * (w - NOW)); }
    function fan(w) { return refW(w) * (0.015 + (st.two ? 0.013 : 0.011) * (w - NOW)); }
    function r10(v) { return Math.round(v / 10) * 10; }
    function upd() {
      var a = fc(ratA, 38), b = fc(ratB, 38);
      rA.set(r10(a) + ' g'); rB.set(r10(b) + ' g');
      var s = st.two ? 'Using the previous scan, the model sees that B has been crossing centiles and forecasts ' + r10(b) + ' g at 38 weeks against ' + r10(a) + ' g for A. The fan still widens with the horizon, and extrapolating a trend is itself an assumption.'
        : 'With only today’s scan, A and B get the same forecast, ' + r10(a) + ' g at 38 weeks, because they weigh the same today. B’s fall across centiles is invisible in a single measurement.';
      if (st.reveal) {
        var tb = refW(38) * ratB(38), inFan = Math.abs(tb - b) <= fan(38);
        s += ' What happened (synthetic): A ' + r10(refW(38) * ratA(38)) + ' g, B ' + r10(tb) + ' g. B’s fall sped up after 30 weeks, which no scan up to today could show. Its outcome lies ' + (inFan ? 'inside' : 'outside') + ' the forecast fan.';
      }
      notice.set(s);
    }
    var cv = WM.canvas({
      w: 960, h: 470,
      label: 'Synthetic estimated fetal weight by gestational week for two fetuses, A and B, with scans at 22, 26 and 30 weeks and dashed forecasts to 40 weeks.',
      draw: function (g, env) {
        var c = env.c;
        var M = frame(g, 130, 50, 680, 330, [20, 40], [0, 4000], { xl: 'gestational age (weeks)', yl: 'estimated fetal weight (g)', xt: [20, 24, 28, 32, 36, 40], xf: String, yt: [0, 1000, 2000, 3000, 4000], yf: function (v) { return String(v); } });
        var pts = function (fn, a, b) { var o = []; for (var w = a; w <= b + 1e-9; w += 0.25) o.push([M.X(w), M.Y(fn(w))]); return o; };
        D.poly(g, pts(refW, 20, 40), { color: c.muted, lw: 2 });
        D.text(g, 'reference median', M.X(40) - 4, M.Y(refW(40)) - 16, { size: 20, color: c.muted, align: 'right' });
        D.line(g, M.X(NOW), M.y, M.X(NOW), M.y + M.h, { color: c.muted, lw: 1.5, dash: [4, 6] });
        D.text(g, 'today', M.X(NOW) + 6, M.y + 14, { size: 20, color: c.muted, baseline: 'middle' });
        [ratA, ratB].forEach(function (rat, k) {
          var up = pts(function (w) { return fc(rat, w) + fan(w); }, NOW, 40), dn = pts(function (w) { return fc(rat, w) - fan(w); }, NOW, 40).reverse();
          D.poly(g, up.concat(dn), { fill: c.imagined, alpha: 0.1, stroke: false, close: true });
          D.poly(g, pts(function (w) { return fc(rat, w); }, NOW, 40), { color: c.imagined, lw: 3.5, dash: k ? [10, 6] : true });
          if (st.reveal) D.poly(g, pts(function (w) { return refW(w) * rat(w); }, NOW, 40), { color: c.reality, lw: 2.5, alpha: 0.55 });
          D.poly(g, SC.map(function (w) { return [M.X(w), M.Y(refW(w) * rat(w))]; }), { color: c.reality, lw: 2.5 });
          SC.forEach(function (w) {
            var x = M.X(w), y = M.Y(refW(w) * rat(w));
            if (k) D.box(g, x - 7, y - 7, 14, 14, { fill: c.reality, stroke: c.stage, lw: 1.5 }); else D.dot(g, x, y, 7, { fill: c.reality, stroke: c.stage, lw: 1.5 });
          });
        });
        var yA = M.Y(fc(ratA, 40)), yB = M.Y(fc(ratB, 40));
        if (Math.abs(yA - yB) < 24) D.text(g, 'A and B: same forecast', M.X(40) + 6, yA, { size: 20, color: c.imagined, baseline: 'middle', maxWidth: 130, weight: 700 });
        else { D.text(g, 'A', M.X(40) + 8, yA, { size: 22, weight: 700, color: c.imagined, baseline: 'middle' }); D.text(g, 'B', M.X(40) + 8, yB, { size: 22, weight: 700, color: c.imagined, baseline: 'middle' }); }
        D.text(g, 'A ●', M.X(22) - 14, M.Y(refW(22) * 0.84) + 26, { size: 20, weight: 700, align: 'center' });
        D.text(g, 'B ■', M.X(22) - 14, M.Y(refW(22) * ratB(22)) - 16, { size: 20, weight: 700, align: 'center' });
        D.text(g, 'SYNTHETIC, ILLUSTRATIVE. Not a clinical model.', 940, 22, { size: 20, font: 'mono', color: c.muted, align: 'right', baseline: 'middle' });
      }
    });
    var t1 = WM.toggle({ label: 'Model also uses the previous scan', value: false, onChange: function (v) { st.two = v; upd(); cv.redraw(); } });
    var t2 = WM.toggle({ label: 'Reveal what happened', value: false, onChange: function (v) { st.reveal = v; upd(); cv.redraw(); } });
    upd();
    return WM.panel({ title: 'Same weight today, different futures', kicker: 'Interactive · synthetic', note: 'Read the two forecasts with one scan, then switch on <b>Model also uses the previous scan</b>, then reveal what happened.' },
      cv, WM.controls(t1, t2), WM.readouts(rA, rB), WM.readouts(notice));
  }

  /* ====================================================================
     11. THE MODULE
     ==================================================================== */
  WM.register({
    id: 'm3', num: 3, title: 'Learning a model from data', tagline: 'Fit the rules of change from noisy observations, and learn where the fitted model can and cannot be trusted.', minutes: 35, level: 'Core',
    build: function (root) {
      var E1d = e1d(), E2d = e2d();
      root.append(
        WM.hero({
          kicker: 'Module 3 · Core', title: 'Learning a model from data', minutes: 35,
          lede: 'In Module 2 the agent was handed its model. For real systems nobody can write the rules down, so they are learned from recordings. This module fits transition rules to noisy data, measures how wrong they are, and shows why a model that is accurate one step ahead can be badly wrong twenty steps ahead.',
          goals: [
            'Turn a recording into (state, action, next state) examples, fit a <b>transition function</b> to them, and judge it on data it has not seen.',
            'Explain why <b>rollout error</b> grows with the horizon even when one-step error is small, and how <b>distribution shift</b> makes it worse.',
            'Use <b>ensemble disagreement</b> as an uncertainty signal, and explain why a hidden variable calls for <b>memory</b> or a <b>belief state</b>.'
          ]
        }),

        /* ---------------- 1 PAIRS ---------------- */
        WM.section({ id: 'pairs', kicker: '§1', title: 'From a recording to training examples' },
          WM.p('In Module 2 the transition rule s′ = T(s, a) was written by hand. For a real system the rule is unknown and has to be learned from what we observe. The raw material is a recording: the state at one moment, the action taken, and the state that followed. Each such triple is a <dfn data-def="One recorded step of a system: the state, the action taken, and the state that followed.">transition example</dfn>.'),
          WM.p('Learning the rule is then <dfn data-def="Learning a function from examples in which both the input and the correct output are known.">supervised learning</dfn>. The input is the current state and action, the target is the next state, and the model is any function flexible enough to map one to the other. Fitting a curve through points is the simplest version.'),
          WM.p('The first example system is a population that grows toward a ceiling. Its size each season, x, is measured as a fraction of that ceiling, so 1 means full. There is no action yet, which keeps the picture two-dimensional.'),
          WM.explainer({
            id: 'm3-e1', title: 'From a recording to a rule', duration: 84, poster: 10,
            scenes: [
              { start: 0, end: 12, caption: 'A population is counted once a season. The solid line is the recording: size x as a fraction of the ceiling it can reach. The numbers are synthetic.', draw: e1s1 },
              { start: 12, end: 26, caption: 'Each pair of neighbouring seasons is one training example, with input x<sub>t</sub> and target x<sub>t+1</sub>. Plotting target against input turns a time series into a picture of the rule.', draw: e1s2 },
              { start: 26, end: 38, caption: 'Many seasons, from many starting sizes, fill the picture. The counts are noisy, so the points scatter around a curve that nobody has shown the learner.', draw: e1s3 },
              { start: 38, end: 54, caption: 'Fitting means choosing a curve. <b>Least squares</b> picks the curve that makes the sum of squared vertical gaps (red) as small as possible. Here a quadratic leaves a typical gap of ' + f2(E1d.qErr, 3) + '.', draw: e1s4 },
              { start: 54, end: 68, caption: 'A more flexible curve, here a degree-9 polynomial fitted to 12 points, passes close to every one of them. On points it has not seen (hollow) its error is far larger. It has learned the noise.', draw: e1s5 },
              { start: 68, end: 84, caption: 'Now the data stop at x = 0.7. Inside that range the fit is good. Beyond it nothing constrains the curve, and it goes wherever its formula takes it. A learned model is only trustworthy where it has seen data.', draw: e1s6 }
            ]
          }),
          WM.callout('math', 'The rule in this example', '<p>The data come from logistic growth, x<sub>t+1</sub> = x<sub>t</sub> + 1.6·x<sub>t</sub>·(1 − x<sub>t</sub>), plus measurement noise. The learner never sees this formula. It is shown here so that you can check the fits against it.</p>')
        ),

        /* ---------------- 2 FIT ---------------- */
        WM.section({ id: 'fit', kicker: '§2', title: 'Fit, then check on data the model has not seen' },
          WM.p('Below, you are the learner. Choose a model family and compare three numbers. The first is the error on the points used for fitting. The other two are the error against the true rule, inside and beyond the range of the data. In real work the true rule is never available, so the last two have to be estimated from <dfn data-def="Data kept aside during fitting and used only to measure error, as a stand-in for new cases.">held-out data</dfn>.'),
          WM.p('The option <b>Small neural network</b> trains a <dfn data-def="A function built from layers of simple units, each computing a weighted sum followed by a bend such as tanh. Its weights are adjusted to reduce the error on the examples.">neural network</dfn> with one hidden layer of 12 units by <dfn data-def="Repeatedly nudging the model’s weights in the direction that most reduces the error.">gradient descent</dfn>, live in your browser. Networks are the usual choice when the state has many numbers, because nobody has to guess the right formula.'),
          buildFit(),
          WM.callout('math', 'Least squares and RMSE', '<p>For examples (x<sub>i</sub>, y<sub>i</sub>) and a model f, least squares chooses f to make Σ (y<sub>i</sub> − f(x<sub>i</sub>))² as small as possible. The square root of the average squared gap is the <dfn data-def="Root mean squared error: the square root of the average of the squared prediction errors. It is in the same units as the quantity predicted.">RMSE</dfn>, in the same units as x. For polynomials the minimum has a closed-form solution. For a neural network it is approached step by step.</p>'),
          WM.callout('warn', 'Misconception: the lowest training error wins', 'A model that matches the training points more closely is not necessarily closer to the rule. A flexible enough model can match any set of noisy points almost exactly, noise included. This is <dfn data-def="Fitting the noise in the training data as well as the underlying rule, which makes predictions on new data worse.">overfitting</dfn>. Models are compared on held-out error.'),
          WM.callout('idea', 'A lucky family', 'The true rule here is a quadratic, so the quadratic family can represent it exactly. Real systems give no such guarantee. That is why flexible families checked on held-out data are the norm.')
        ),

        /* ---------------- 3 ROLLOUT ---------------- */
        WM.section({ id: 'rollout', kicker: '§3', title: 'One step is easy, many steps are hard' },
          WM.p('A world model is used to imagine many steps ahead. It is applied to the current state to get the next one, then applied again to its own prediction, and so on. This is an <dfn data-def="A multi-step prediction in which each step starts from the model’s previous prediction, with no new observations. Also called open-loop prediction.">open-loop rollout</dfn>. The error of a single step that starts from a true state is the <dfn data-def="The error of a prediction one step ahead, starting from the true current state.">one-step error</dfn>. The two behave very differently.'),
          WM.p('The system now is a pendulum with friction. Its state has two numbers, the angle and the angular velocity, recorded ten times a second.'),
          WM.explainer({
            id: 'm3-e2', title: 'How small errors compound', duration: 98, poster: 34,
            scenes: [
              { start: 0, end: 12, caption: 'A pendulum with friction swings and slowly settles. The solid line is reality: its angle, recorded ten times a second.', draw: e2s1 },
              { start: 12, end: 26, caption: 'One-step test. Start from each true state and let the model predict the next one. Every dashed arrow lands close to the next true point. The average one-step error is ' + f2(E2d.mo, 3) + '.', draw: e2s2 },
              { start: 26, end: 42, caption: 'Rollout. Feed the model its own prediction instead. Step 2 starts from a slightly wrong state, step 3 from a more wrong one, and the red gaps grow.', draw: e2s3 },
              { start: 42, end: 56, caption: 'The same two errors over time. One-step error stays small. Rollout error grows with the horizon, here to ' + f2(E2d.emax, 2) + ', about ' + Math.round(E2d.emax / E2d.mo) + ' times the one-step error.', draw: e2s4 },
              { start: 56, end: 70, caption: 'A simple account: each step adds a fresh error ε, and the dynamics multiply the existing error by a factor L. If L is above 1, errors grow geometrically. If L is below 1, they level off near ε / (1 − L).', draw: e2s5 },
              { start: 70, end: 84, caption: 'Errors also move the imagined state. Here the model was fitted to states inside the shaded disc. Its rollout drifts outward, leaves the data, and there the model is worse still. The model has created its own <b>distribution shift</b>.', draw: e2s6 },
              { start: 84, end: 98, caption: 'The remedies follow. Re-observe the real state often, which resets the error. Keep rollouts short. Train the model on its own multi-step mistakes. And know where the model has no data, which is the next section.', draw: e2s7 }
            ]
          }),
          WM.p('The panel below fits a model to 300 noisy transitions of a simulated pendulum. The model is a cubic polynomial in angle and velocity, fitted by least squares, which is accurate for moderate swings. You choose how wide the training swings were, where the test swing starts, and how often the model is given the real state again.'),
          buildRoll(),
          WM.callout('warn', 'Distribution shift', 'A model is fitted to the states that appear in its training data. On other states its error is no longer described by the training error. This is <dfn data-def="A difference between the situations a model was trained on and the situations it is used in.">distribution shift</dfn>. Rollouts create their own shift: a small error moves the imagined state off the real path, sometimes into a region with less data, where the next error is larger.'),
          WM.callout('source', 'Short rollouts in practice', 'Model-based reinforcement learning methods design around this. MBPO (Janner and colleagues, 2019) generates its imagined experience from short model rollouts that branch off real observed states, which leaves model errors little room to compound.'),
          WM.callout('idea', 'Why replanning helps', 'The planner in Module 2 acted on one step, observed where it really was, and planned again. Each plan therefore starts from a fresh observation, and the model is trusted only as far as the horizon of one plan.')
        ),

        /* ---------------- 4 UNCERTAINTY ---------------- */
        WM.section({ id: 'uncertainty', kicker: '§4', title: 'Knowing what the model does not know' },
          WM.p('A model that returns one number for the next state gives no hint of how far to trust it. Two sources of doubt are worth separating. <dfn data-def="Uncertainty from randomness in the system or the measurement. More data of the same kind does not reduce it.">Aleatoric uncertainty</dfn> is noise in the system or the measurement, and more data does not remove it. <dfn data-def="Uncertainty from lack of knowledge, usually because there were few or no data in that region. More data there reduces it.">Epistemic uncertainty</dfn> comes from not having seen enough, and more data in the right place does remove it.'),
          WM.p('A practical estimate of epistemic uncertainty is an <dfn data-def="Several models trained on the same task with different random starting weights and different resamples of the data. Their spread is used as an uncertainty signal.">ensemble</dfn>. Train several models that differ only in their random starting weights and in a random resample of the data. Where the data pin the answer down, they agree. Where the data are silent, each fills the gap its own way. The explainer covers this, and then a third thing a model can be missing, which §5 takes up.'),
          WM.explainer({
            id: 'm3-e3', title: 'Missing data, missing state', duration: 92, poster: 22,
            scenes: [
              { start: 0, end: 12, caption: 'Twelve noisy measurements, all from small populations between 0.15 and 0.6. One small neural network is fitted to them.', draw: e3s1 },
              { start: 12, end: 26, caption: 'Four more networks are trained, each from different random starting weights and a random resample of the same data. Where there are data they agree. Away from the data they fan out.', draw: e3s2 },
              { start: 26, end: 38, caption: 'The spread across the five, plotted below, is low where data exist and high where they do not. This is <b>epistemic</b> uncertainty, caused by missing data. The spread flags the right region, though here it understates how wrong the average is.', draw: e3s3 },
              { start: 38, end: 52, caption: 'Noise in the system itself is different. The scatter around the true rule keeps the same width however many points are collected. This is <b>aleatoric</b> uncertainty.', draw: e3s4 },
              { start: 52, end: 66, caption: 'A model can also miss part of the state. A camera sees two pendulums at the same angle. One is swinging left, the other right. From one picture they look identical, so a model that sees only the angle must predict the same next angle for both.', draw: e3s5 },
              { start: 66, end: 78, caption: 'Memory resolves it. A moment ago A was further right and B further left. The change between two pictures estimates the hidden velocity.', draw: e3s6 },
              { start: 78, end: 92, caption: 'A <b>belief state</b> does the same with probabilities. After picture 1 every velocity is possible (the column of rings). Each candidate is moved forward 0.3 s by the dynamics, and only those that match picture 2 survive.', draw: e3s7 }
            ]
          }),
          WM.p('Below, five small networks are trained live on the same population data, each on its own resample. You decide where to measure next.'),
          buildEns(),
          WM.callout('warn', 'Agreement is not proof', 'Members that agree can be wrong together. If they share a wrong assumption, or the data are biased in the same way for all of them, the spread stays small while the error is large. Disagreement is a useful warning light and gives no guarantee in either direction.'),
          WM.callout('source', 'Where the idea comes from', 'Deep ensembles were proposed by Lakshminarayanan, Pritzel and Blundell (preprint 2016, published 2017) as a simple alternative to Bayesian neural networks. They reported higher uncertainty on inputs unlike the training data. PETS (Chua and colleagues, 2018) used ensembles of probabilistic dynamics models and carried their uncertainty through rollouts when planning.')
        ),

        /* ---------------- 5 HIDDEN ---------------- */
        WM.section({ id: 'hidden', kicker: '§5', title: 'When part of the state is hidden' },
          WM.p('So far the model saw the full state. Often it does not. A camera records where the pendulum is, not how fast it is moving. When the observation leaves out part of the state, the system is <dfn data-def="A system whose observations do not reveal the full state, so the same observation can arise from states with different futures.">partially observed</dfn>.'),
          WM.p('At a given angle the pendulum may be swinging either way. A model that sees only the current angle has to give one answer for both, and the best it can do is average them. More data of the same kind does not help, because the missing information is not in the input.'),
          WM.p('There are two remedies, both shown at the end of the explainer above. A model with <dfn data-def="Access to past observations, either directly or through an internal state that summarises them.">memory</dfn> can use earlier angles as well, since the change between two angles reveals the velocity. A model can also keep a <dfn data-def="A probability distribution over the hidden state, updated as each new observation arrives.">belief state</dfn>, a spread of possible hidden states that each observation narrows. The panel fits four least-squares models to the same camera recordings, each given a different input.'),
          buildHidden(),
          WM.callout('idea', 'The Markov property, revisited', 'Module 2 required the state to hold everything needed for the next step. A single angle does not. A short history of observations, or a belief computed from it, restores that property. This is why the world models in Module 4 carry a recurrent memory.')
        ),

        /* ---------------- 6 PREGNANCY ---------------- */
        WM.section({ id: 'pregnancy', kicker: '§6', title: 'Pregnancy corner' },
          WM.callout('pregnancy', 'Fetal growth from a few scans', '<p>Antenatal care observes a pregnancy at a few visits, weeks apart, and each visit measures only part of the state. Fetal size is seen on ultrasound. Placental function, which shapes how fast the fetus will grow, is not seen directly. That is partial observability, and the remedy is the same as for the pendulum: use more than one scan. Two fetuses with the same estimated weight today can be on different paths, one small and growing steadily, the other falling across centiles. Only the history separates them.</p><p>The other ideas in this module carry over. A forecast from 30 weeks to term is a multi-step rollout, and its error grows with the horizon. A model developed in one population and used in another faces distribution shift. For example, Yang and colleagues (2025) reported a c-index (a measure of how well a model ranks risk: 1 is perfect, 0.5 is chance) of 0.79 at the development site and 0.74 at an external site for a model of the interval from pre-eclampsia diagnosis to delivery. Ensemble disagreement is one way to flag a pregnancy that looks unlike the training data.</p><p>Everything in the panel below is synthetic and illustrative. The reference curve and both fetuses were made up for teaching.</p>'),
          buildPreg()
        ),

        WM.takeaways([
          'A transition model is learned by supervised learning on recorded (state, action, next state) examples. Judge it on held-out data, never on the data it was fitted to.',
          'Small one-step errors compound in an open-loop rollout, because each step starts from the previous step’s mistake. Re-observing the real state resets the error.',
          'A learned model is reliable only where it has data. Rollouts can carry the imagined state into regions the data never covered, which is distribution shift.',
          '<b>Ensemble disagreement</b> estimates epistemic uncertainty and is high where data are thin. It cannot reveal an error that all members share.',
          'When observations hide part of the state, more data cannot rescue a memoryless model. It needs <b>memory</b> or a <b>belief state</b>.'
        ]),
        WM.quiz({
          id: 'q3', title: 'Check your understanding', questions: [
            { q: 'You fit two models to the same noisy transitions. Model A has a training RMSE of 0.02 and model B 0.04. What can you conclude?',
              options: ['A is the better model', 'B is underfitting and should be discarded', 'Nothing yet. Compare them on held-out data', 'A has learned the true rule more exactly'], answer: 2,
              why: 'Training error rewards flexibility, including the ability to fit noise. In the fitting panel a degree-9 polynomial beats the quadratic on its own points and loses badly on new ones. Held-out error is the fair comparison.' },
            { q: 'A pendulum model has a one-step error of 0.01 rad. What should you expect after 50 open-loop steps?',
              options: ['About 0.01 rad, the same as one step', 'Exactly 0.5 rad, which is 50 × 0.01', 'Larger than 0.01 rad, possibly far larger, because each step starts from the previous mistake', 'Smaller, because positive and negative errors cancel'], answer: 2,
              why: 'Errors feed into the next input. If the dynamics stretch small differences, errors grow geometrically; with strong damping they may level off. Multiplying by the number of steps is at best a rough guide, and errors cancelling is the exception.' },
            { q: 'Five ensemble members agree closely at some input. Which statement is safest?',
              options: ['The prediction there is correct', 'The data probably constrain the model there, though all members could share the same error', 'The system has no noise there', 'Adding more members would make them disagree'], answer: 1,
              why: 'Agreement says the members were pushed to the same answer, usually by data. If the data or the model family are wrong in the same way for all of them, they agree and are wrong together.' },
            { q: 'You collect ten times more data in a region where the model already has plenty. Which uncertainty there shrinks least?',
              options: ['Epistemic uncertainty about the rule in that region', 'Aleatoric uncertainty from measurement noise', 'Uncertainty about the fitted coefficients', 'All shrink by the same amount'], answer: 1,
              why: 'Measurement noise is a property of the system and the instrument. More samples pin down the average rule more precisely, and the scatter of individual measurements around it stays the same.' },
            { q: 'A model sees only the pendulum’s angle and predicts the next angle. Its error stays high however much data you add. Why?',
              options: ['The model is too small', 'The same angle occurs with different velocities, so the input does not determine the output', 'The data are too noisy', 'Pendulums are chaotic'], answer: 1,
              why: 'The missing velocity is not in the input, so there are two correct answers for the same input. A bigger model or more data cannot separate them. One past angle, or a velocity sensor, does. A damped pendulum with no driving force is not chaotic.' },
            { q: 'A fetal-growth model was trained on scans between 20 and 32 weeks in one population. It is used to forecast weight at 40 weeks in another population. Which problems should you expect?',
              options: ['None, if its one-step error was small during development', 'Compounding error over a long horizon, and distribution shift from the new population', 'Only measurement noise', 'Only a calibration issue that a bigger network removes'], answer: 1,
              why: 'Forecasting to term is a long rollout, so error grows with the horizon. The new population and the weeks beyond 32 are both outside the training data. Good one-step accuracy in development says little about either.' }
          ]
        }),
        WM.goDeeper([
          { title: 'Sutton and Barto, Reinforcement Learning: An Introduction (2nd ed., 2018)', url: 'http://incompleteideas.net/book/the-book-2nd.html', note: 'Full text is linked from the authors’ site. The chapter on planning and learning introduces Dyna, an agent that learns a model from experience and plans with it.' },
          { title: 'Chua et al., Deep Reinforcement Learning in a Handful of Trials using Probabilistic Dynamics Models (PETS, 2018)', url: 'https://arxiv.org/abs/1805.12114', note: 'Ensembles of uncertainty-aware dynamics models, with uncertainty carried through planning rollouts.' },
          { title: 'Janner et al., When to Trust Your Model: Model-Based Policy Optimization (MBPO, 2019)', url: 'https://arxiv.org/abs/1906.08253', note: 'Uses short model rollouts branched from real data.' },
          { title: 'Lakshminarayanan, Pritzel and Blundell, Simple and Scalable Predictive Uncertainty Estimation using Deep Ensembles (2016)', url: 'https://arxiv.org/abs/1612.01474', note: 'The deep-ensembles paper, including higher uncertainty on unfamiliar inputs.' },
          { title: 'Ha and Schmidhuber, World Models (2018)', url: 'https://arxiv.org/abs/1803.10122', note: 'Bridge to Module 4. Also shows an agent exploiting flaws in its own learned model.' },
          { title: 'Rizopoulos, Dynamic predictions and prospective accuracy in joint models for longitudinal and time-to-event data (Biometrics, 2011)', url: 'https://doi.org/10.1111/j.1541-0420.2010.01546.x', note: 'Statistical template for updating an individual’s prediction as each new measurement arrives.' }
        ])
      );
    }
  });
})();
