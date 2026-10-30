/* ==========================================================================
 Module 4: Latent worlds and dreaming
 Audience: graduate introduction to machine learning.
 Every model in the interactives is trained in the browser, live.
 All pregnancy numbers are synthetic and illustrative.
 ========================================================================== */
(function () {
 'use strict';
 var WM = window.WM, D = WM.draw, h = WM.h;
 var MINUS = '−';

 /* ====================================================================
  0. SHARED HELPERS
  ==================================================================== */
 function T(g, s, x, y, o) {
  o = o || {}; if (o.size == null) o.size = 22;
  if (o.baseline == null) { if (o.maxWidth) { o.baseline = 'top'; y -= o.size * 0.62; } else o.baseline = 'middle'; }
  return D.text(g, s, x, y, o);
 }
 function head(g, s) { T(g, s, 40, 40, { size: 30, weight: 700, font: 'display' }); }
 function fade(g, a, fn) { if (a > 0) D.withAlpha(g, a, fn); }
 function pick(t, cuts) { var i = 0; while (i < cuts.length && t >= cuts[i]) i++; return i; }
 function pct(v) { return Math.round(D.clamp(v) * 100) + '%'; }
 /* draw a grid of values as ink intensity; v in [lo, hi] */
 var rgbC = {}, off = null;
 function rgb(cs) {
  if (rgbC[cs]) return rgbC[cs];
  var m = /^#([0-9a-f]{6})$/i.exec(cs), v;
  if (m) v = [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4), 16)];
  else { m = cs.match(/[\d.]+/g) || [128, 128, 128]; v = [+m[0], +m[1], +m[2]]; }
  return (rgbC[cs] = v);
 }
 function img(g, pix, cols, rows, x, y, w, hh, lo, hi, color, bg) {
  if (!off) off = document.createElement('canvas');
  off.width = cols; off.height = rows;
  var o = off.getContext('2d'), id = o.createImageData(cols, rows), a = rgb(color), b = rgb(bg || WM.colors().stage);
  for (var k = 0; k < cols * rows; k++) {
   var t = D.clamp((pix[k] - lo) / (hi - lo));
   id.data[k * 4] = b[0] + (a[0] - b[0]) * t; id.data[k * 4 + 1] = b[1] + (a[1] - b[1]) * t; id.data[k * 4 + 2] = b[2] + (a[2] - b[2]) * t; id.data[k * 4 + 3] = 255;
  }
  o.putImageData(id, 0, 0);
  g.save(); g.imageSmoothingEnabled = false; g.drawImage(off, x, y, w, hh); g.restore();
 }
 function notice(label) {
  var r = WM.readout(label || 'What you should notice', '');
  var v = r.el.querySelector('.wm-readout__val');
  v.style.fontFamily = 'var(--font-body)'; v.style.fontSize = '1rem'; v.style.lineHeight = '1.45';
  v.setAttribute('aria-live', 'polite');
  r.el.style.flexBasis = '100%';
  return r;
 }
 /* visibility-aware loop; stops when the panel leaves the screen */
 function visLoop(el, fn) {
  var lp = WM.loop(fn), want = false, vis = true, io = null;
  if ('IntersectionObserver' in window) {
   io = new IntersectionObserver(function (es) { vis = es[es.length - 1].isIntersecting; if (vis && want) lp.start(); else lp.stop(); });
   io.observe(el);
  }
  WM.onDispose(function () { lp.stop(); if (io) io.disconnect(); });
  return { start: function () { want = true; if (vis) lp.start(); }, stop: function () { want = false; lp.stop(); }, get on() { return want; } };
 }

 /* ====================================================================
  1. A TINY NEURAL NETWORK (for the latent explorer)
  Dense layers with Adam; enough for a 2-D autoencoder or VAE.
  ==================================================================== */
 function Layer(i, o, r) {
  var s = Math.sqrt(1 / i), W = new Float32Array(i * o);
  for (var k = 0; k < W.length; k++) W[k] = WM.gauss(r) * s;
  return { i: i, o: o, W: W, b: new Float32Array(o), gW: new Float32Array(i * o), gb: new Float32Array(o), mW: new Float32Array(i * o), vW: new Float32Array(i * o), mb: new Float32Array(o), vb: new Float32Array(o) };
 }
 function fwd(L, x, y) { for (var j = 0; j < L.o; j++) { var s = L.b[j], off = j * L.i; for (var k = 0; k < L.i; k++) s += L.W[off + k] * x[k]; y[j] = s; } }
 function bwd(L, x, dy, dx) {
  var j, k, off, gg;
  for (j = 0; j < L.o; j++) { gg = dy[j]; L.gb[j] += gg; off = j * L.i; for (k = 0; k < L.i; k++) L.gW[off + k] += gg * x[k]; }
  if (!dx) return;
  dx.fill(0);
  for (j = 0; j < L.o; j++) { gg = dy[j]; off = j * L.i; for (k = 0; k < L.i; k++) dx[k] += L.W[off + k] * gg; }
 }
 function adam(L, lr, t, bs) {
  var c1 = 1 - Math.pow(0.9, t), c2 = 1 - Math.pow(0.999, t);
  [[L.W, L.gW, L.mW, L.vW], [L.b, L.gb, L.mb, L.vb]].forEach(function (q) {
   var w = q[0], g = q[1], m = q[2], v = q[3];
   for (var k = 0; k < w.length; k++) {
    var gg = g[k] / bs; m[k] = 0.9 * m[k] + 0.1 * gg; v[k] = 0.999 * v[k] + 0.001 * gg * gg;
    w[k] -= lr * (m[k] / c1) / (Math.sqrt(v[k] / c2) + 1e-8); g[k] = 0;
   }
  });
 }

 /* images: a soft blob at (cx, cy) on a 12 x 12 grid; two true factors of variation */
 var AS = 12, AP = AS * AS, AH = 32, AN = 500, AG = 9;
 function blob(cx, cy, out) {
  for (var y = 0; y < AS; y++) for (var x = 0; x < AS; x++) { var d = (x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy); out[y * AS + x] = Math.exp(-d / (2 * 1.3 * 1.3)); }
  return out;
 }
 var AED = null;
 function aeData() {
  if (AED) return AED;
  var r = WM.rng(7), X = [], F = [], G = [], TE = [], i, j;
  for (i = 0; i < AN; i++) { var cx = 2 + r() * (AS - 4), cy = 2 + r() * (AS - 4); F.push([cx, cy]); X.push(blob(cx, cy, new Float32Array(AP))); }
  for (i = 0; i < 100; i++) TE.push(blob(2 + r() * (AS - 4), 2 + r() * (AS - 4), new Float32Array(AP)));
  for (j = 0; j < AG; j++) for (i = 0; i < AG; i++) G.push(blob(2.5 + i * (AS - 5) / (AG - 1), 2.5 + j * (AS - 5) / (AG - 1), new Float32Array(AP)));
  AED = { X: X, F: F, G: G, TE: TE };
  return AED;
 }
 function aeNet(vae, seed) {
  var r = WM.rng(seed), n = { vae: vae, r: r, t: 0 };
  n.e1 = Layer(AP, AH, r); n.e2 = Layer(AH, vae ? 4 : 2, r); n.d1 = Layer(2, AH, r); n.d2 = Layer(AH, AH, r); n.d3 = Layer(AH, AP, r);
  ['a1', 'h1', 'b1', 'g1', 'b2', 'g2', 'dG1', 'dG2', 'dH1'].forEach(function (k) { n[k] = new Float32Array(AH); });
  n.eo = new Float32Array(4); n.z = new Float32Array(2); n.eps = new Float32Array(2); n.dZ = new Float32Array(2); n.dEo = new Float32Array(4);
  n.o = new Float32Array(AP); n.dO = new Float32Array(AP);
  return n;
 }
 function aeEnc(n, x) { fwd(n.e1, x, n.a1); for (var k = 0; k < AH; k++) n.h1[k] = Math.tanh(n.a1[k]); fwd(n.e2, n.h1, n.eo); return n.eo; }
 function aeDec(n, z, out) {
  var k;
  fwd(n.d1, z, n.b1); for (k = 0; k < AH; k++) n.g1[k] = Math.tanh(n.b1[k]);
  fwd(n.d2, n.g1, n.b2); for (k = 0; k < AH; k++) n.g2[k] = Math.tanh(n.b2[k]);
  fwd(n.d3, n.g2, n.o); for (k = 0; k < AP; k++) out[k] = 1 / (1 + Math.exp(-n.o[k]));
  return out;
 }
 function aeStep(n, X, BS) {
  var k, L = 0, r = n.r;
  for (var b = 0; b < BS; b++) {
   var x = X[(r() * X.length) | 0];
   aeEnc(n, x);
   for (k = 0; k < 2; k++) {
    if (n.vae) { n.eps[k] = WM.gauss(r); n.z[k] = n.eo[k] + Math.exp(0.5 * n.eo[k + 2]) * n.eps[k]; } else n.z[k] = n.eo[k];
   }
   aeDec(n, n.z, n.dO);
   for (k = 0; k < AP; k++) { var e = n.dO[k] - x[k]; L += e * e; n.dO[k] = e; } /* sigmoid + cross-entropy gradient */
   bwd(n.d3, n.g2, n.dO, n.dG2); for (k = 0; k < AH; k++) n.dG2[k] *= 1 - n.g2[k] * n.g2[k];
   bwd(n.d2, n.g1, n.dG2, n.dG1); for (k = 0; k < AH; k++) n.dG1[k] *= 1 - n.g1[k] * n.g1[k];
   bwd(n.d1, n.z, n.dG1, n.dZ);
   for (k = 0; k < 2; k++) {
    if (n.vae) { var lv = n.eo[k + 2]; n.dEo[k] = n.dZ[k] + n.eo[k]; n.dEo[k + 2] = n.dZ[k] * n.eps[k] * 0.5 * Math.exp(0.5 * lv) + 0.5 * (Math.exp(lv) - 1); }
    else n.dEo[k] = n.dZ[k];
   }
   bwd(n.e2, n.h1, n.dEo, n.dH1); for (k = 0; k < AH; k++) n.dH1[k] *= 1 - n.h1[k] * n.h1[k];
   bwd(n.e1, x, n.dH1, null);
  }
  n.t++;
  [n.e1, n.e2, n.d1, n.d2, n.d3].forEach(function (Ly) { adam(Ly, 0.012, n.t, BS); });
  return L / BS;
 }

 /* ---- Interactive A: latent explorer ---- */
 function buildLatent() {
  var data = aeData(), STEPS = 2000;
  var kind = 'vae', net = aeNet(true, 2), hist = [], codes = [], mesh = [], view = null, handle = [0, 0], dragging = false, training = false, folds = null, testErr = null;
  var dec = new Float32Array(AP), zz = new Float32Array(2);
  var LX = 40, LY = 64, LW = 430, LH = 430;
  function refreshCodes() {
   var i, e;
   codes = []; for (i = 0; i < 160; i++) { e = aeEnc(net, data.X[i]); codes.push([e[0], e[1], i]); }
   mesh = []; for (i = 0; i < data.G.length; i++) { e = aeEnc(net, data.G[i]); mesh.push([e[0], e[1]]); }
   var pos = 0, neg = 0;
   for (var j = 0; j < AG - 1; j++) for (i = 0; i < AG - 1; i++) {
    var a = mesh[j * AG + i], b = mesh[j * AG + i + 1], c = mesh[(j + 1) * AG + i];
    if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0) pos++; else neg++;
   }
   folds = Math.min(pos, neg);
   var s = 0; for (i = 0; i < data.TE.length; i++) { e = aeEnc(net, data.TE[i]); zz[0] = e[0]; zz[1] = e[1]; aeDec(net, zz, dec); for (var k = 0; k < AP; k++) s += (dec[k] - data.TE[i][k]) * (dec[k] - data.TE[i][k]); }
   testErr = s / data.TE.length / AP;
   if (!dragging) {
    var pts = codes.concat(mesh), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, sp = Math.max(x1 - x0, y1 - y0, 0.5) * 0.62;
    view = { cx: cx, cy: cy, s: sp };
   }
  }
  function toPx(z) { return [LX + LW / 2 + (z[0] - view.cx) / view.s * LW / 2, LY + LH / 2 - (z[1] - view.cy) / view.s * LH / 2]; }
  function toZ(px, py) { return [view.cx + (px - LX - LW / 2) / (LW / 2) * view.s, view.cy - (py - LY - LH / 2) / (LH / 2) * view.s]; }
  function nearest() {
   var best = 0, bd = 1e9;
   codes.forEach(function (c, i) { var d = (c[0] - handle[0]) * (c[0] - handle[0]) + (c[1] - handle[1]) * (c[1] - handle[1]); if (d < bd) { bd = d; best = i; } });
   return { i: codes[best] ? codes[best][2] : 0, d: Math.sqrt(bd) };
  }
  var tpl = new Float32Array(AP);
  function blobMatch() { /* best cosine similarity between the drawing and any true single blob */
   zz[0] = handle[0]; zz[1] = handle[1]; aeDec(net, zz, dec);
   var best = 0, nd = 0, k; for (k = 0; k < AP; k++) nd += dec[k] * dec[k]; nd = Math.sqrt(nd) || 1;
   for (var cy = 1; cy <= AS - 1; cy += 0.5) for (var cx = 1; cx <= AS - 1; cx += 0.5) {
    blob(cx, cy, tpl); var dp = 0, nt2 = 0; for (k = 0; k < AP; k++) { dp += dec[k] * tpl[k]; nt2 += tpl[k] * tpl[k]; }
    best = Math.max(best, dp / nd / Math.sqrt(nt2));
   }
   return best;
  }
  function draw(g, env) {
   var c = env.c, i, j, p;
   D.box(g, LX, LY, LW, LH, { fill: c.surface, stroke: c.line, lw: 1 });
   D.grid(g, LX, LY, LW, LH, 8, 8, { color: c.faint });
   T(g, 'Latent space (2 numbers)', LX, 36, { size: 22, weight: 700 });
   T(g, 'latent 1 →', LX + LW, LY + LH + 22, { size: 18, font: 'mono', color: c.muted, align: 'right' });
   g.save(); g.translate(LX - 14, LY); g.rotate(-Math.PI / 2); T(g, 'latent 2 →', 0, 0, { size: 18, font: 'mono', color: c.muted, align: 'right' }); g.restore();
   g.save(); g.beginPath(); g.rect(LX, LY, LW, LH); g.clip();
   codes.forEach(function (q) { var pp = toPx(q); D.dot(g, pp[0], pp[1], 3.2, { fill: c.muted, alpha: 0.75 }); });
   for (j = 0; j < AG; j++) {
    var row = [], col = [];
    for (i = 0; i < AG; i++) { row.push(toPx(mesh[j * AG + i])); col.push(toPx(mesh[i * AG + j])); }
    D.poly(g, row, { color: c.imagined, lw: 1.6, dash: [6, 4], alpha: 0.85 });
    D.poly(g, col, { color: c.imagined, lw: 1.6, dash: [6, 4], alpha: 0.85 });
   }
   p = toPx(handle);
   D.line(g, p[0] - 22, p[1], p[0] + 22, p[1], { color: c.ink, lw: 1.5 }); D.line(g, p[0], p[1] - 22, p[0], p[1] + 22, { color: c.ink, lw: 1.5 });
   D.dot(g, p[0], p[1], 13, { fill: false, stroke: c.ink, lw: 3 });
   g.restore();
   /* decoded image */
   zz[0] = handle[0]; zz[1] = handle[1]; aeDec(net, zz, dec);
   var IX = 520, IY = 64, IS = 220;
   T(g, 'Decoder’s drawing', IX, 36, { size: 22, weight: 700 });
   D.box(g, IX, IY, IS, IS, { fill: c.stage });
   img(g, dec, AS, AS, IX, IY, IS, IS, 0, 1, c.ink);
   D.box(g, IX, IY, IS, IS, { stroke: c.imagined, lw: 3, dash: true });
   T(g, 'of the point you hold', IX, IY + IS + 24, { size: 18, color: c.muted });
   /* nearest real image */
   var nn = nearest(), NX = 790, NS = 130;
   T(g, 'Nearest', NX, 36, { size: 22, weight: 700 });
   T(g, 'training image', NX, IY + NS + 22, { size: 18, color: c.muted });
   D.box(g, NX, IY, NS, NS, { fill: c.stage });
   img(g, data.X[nn.i], AS, AS, NX, IY, NS, NS, 0, 1, c.ink);
   D.box(g, NX, IY, NS, NS, { stroke: c.reality, lw: 2.5 });
   /* loss curve */
   var ax = D.axes(g, 540, 390, 340, 92, { color: c.muted, xticks: [[0, '0'], [1, STEPS.toLocaleString('en-US')]], xlabel: 'steps', size: 17 });
   T(g, 'error on new images', 528, 364, { size: 18, font: 'mono', color: c.muted });
   if (hist.length > 1) {
    var mx = hist[0];
    D.poly(g, hist.map(function (v, k) { return [ax.x((k * 30) / STEPS), ax.y(D.clamp(v / mx))]; }), { color: c.ink, lw: 2 });
   }
   if (net.t === 0) {
    D.box(g, LX + 60, LY + LH / 2 - 34, LW - 120, 68, { fill: c.surface, stroke: c.line });
    T(g, 'Untrained: press Train', LX + LW / 2, LY + LH / 2, { align: 'center', weight: 600 });
   }
  }
  var cv = WM.canvas({
   w: 960, h: 540, draw: draw, label: 'Latent explorer. Left: the two-number latent space with the codes of training images as dots and a dashed mesh joining codes of images on a regular grid of blob positions. Right: the image the decoder draws for the point you hold, and the nearest training image.',
   pointer: function (type, x, y) {
    if (type === 'down') { var p = toPx(handle); if (Math.hypot(x - p[0], y - p[1]) < 40 || (x > LX && x < LX + LW && y > LY && y < LY + LH)) dragging = true; }
    if (dragging && (type === 'down' || type === 'move')) { handle = toZ(D.clamp(x, LX, LX + LW), D.clamp(y, LY, LY + LH)); say(); }
    if (type === 'up') { dragging = false; say(); }
   }
  });
  cv.el.setAttribute('tabindex', '0');
  cv.el.addEventListener('keydown', function (e) {
   var k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
   if (!k || !view) return;
   e.preventDefault(); handle = [handle[0] + k[0] * view.s * 0.05, handle[1] + k[1] * view.s * 0.05];
   var hp = toPx(handle); handle = toZ(D.clamp(hp[0], LX, LX + LW), D.clamp(hp[1], LY, LY + LH)); say(); cv.redraw();
  });
  var rSteps = WM.readout('Training steps', '0'), rErr = WM.readout('Error on new images', MINUS), rFold = WM.readout('Folded mesh cells', MINUS), rMatch = WM.readout('Match to a real blob', MINUS);
  var nt = notice();
  function say() {
   if (net.t === 0 || training) rMatch.set(MINUS);
   if (net.t === 0) { nt.set('The network is untrained, so every point decodes to the same smudge. Press Train and watch the mesh organise.'); return; }
   if (training) { nt.set('Training: the encoder and decoder are fitted together to redraw 500 blob images through a two-number bottleneck.'); return; }
   var m = blobMatch(); rMatch.set(WM.ui.fmt(m, 2));
   var base = kind === 'vae'
    ? 'The VAE packs codes into a compact, roughly round region, so walking across it moves the blob smoothly.'
    : 'The plain autoencoder spreads codes over a wide, uneven region' + (folds > 2 ? ' and its mesh folds over itself in places.' : '.');
   nt.set(base + (m >= 0.95 ? ' Here the drawing matches a real single blob (similarity ' + WM.ui.fmt(m, 2) + ').' : ' Here the drawing is smeared or faint (similarity ' + WM.ui.fmt(m, 2) + ' to the best real blob): no training image was coded near this point.'));
  }
  function sync() {
   rSteps.set(String(net.t)); rErr.set(net.t ? WM.ui.fmt(testErr, 4) : MINUS); rFold.set(net.t ? folds + ' of 64' : MINUS);
   btn.buttons[0].textContent = training ? 'Pause' : net.t >= STEPS ? 'Trained' : net.t ? 'Resume' : 'Train';
   btn.buttons[0].disabled = net.t >= STEPS;
   say(); cv.redraw();
  }
  var since = 0;
  var lp = visLoop(cv.el, function () {
   var t0 = performance.now();
   while (performance.now() - t0 < 13 && net.t < STEPS) {
    aeStep(net, data.X, 16);
    if (net.t % 30 === 0) { var e = 0; for (var i = 0; i < 20; i++) { aeEnc(net, data.TE[i]); zz[0] = net.eo[0]; zz[1] = net.eo[1]; aeDec(net, zz, dec); for (var k = 0; k < AP; k++) e += (dec[k] - data.TE[i][k]) * (dec[k] - data.TE[i][k]); } hist.push(e / 20); }
   }
   if (++since % 6 === 0 || net.t >= STEPS) refreshCodes();
   if (net.t >= STEPS) { training = false; lp.stop(); refreshCodes(); handle = [view.cx, view.cy]; }
   sync();
  });
  function reset(k) {
   kind = k; training = false; lp.stop();
   net = aeNet(k === 'vae', 2); hist = []; refreshCodes(); handle = [view.cx, view.cy]; sync();
  }
  var sel = WM.select({ label: 'Model', value: 'vae', options: [{ value: 'vae', label: 'Variational autoencoder (VAE)' }, { value: 'ae', label: 'Plain autoencoder' }], onChange: function (v) { reset(v); } });
  var btn = WM.buttons([
   { label: 'Train', kind: 'primary', onClick: function () { if (net.t >= STEPS) return; training = !training; if (training) lp.start(); else lp.stop(); sync(); } },
   { label: 'Reset weights', kind: 'ghost', onClick: function () { reset(kind); } }
  ]);
  refreshCodes(); handle = [view.cx, view.cy]; sync();
  return WM.panel({ title: 'Train a two-number latent space and walk around in it', note: 'Press <b>Train</b> (a few seconds), then drag the crosshair across the map. Switch to the <b>Plain autoencoder</b>, train again and compare the mesh.' },
   cv, WM.controls(sel, btn), WM.readouts(rSteps, rErr, rFold, rMatch), WM.readouts(nt));
 }

 /* ====================================================================
  2. EXPLAINER 1: World Models (Ha and Schmidhuber 2018)   (96 s)
  Script
   0-12  a frame is 64x64x3 = 12,288 numbers
   12-26 V: VAE, frame -> z (32 numbers) -> redrawn frame
   26-42 M: MDN-RNN, h with 256 units, predicts next z as a 5-component mixture
   42-56 C: linear, (32+256) x 3 + 3 = 867 parameters, evolved by CMA-ES
   56-70 CarRacing: C trained in the real game; 906 +/- 21 vs previous 838 +/- 11, solved = 900
   70-84 VizDoom: real game removed, M's samples fed back; temperature tau
   84-96 low tau: exploits M; tau = 1.15 -> 1092 +/- 556 steps vs 750 needed
  ==================================================================== */
 function track(g, c, x, y, s, blur) {
  D.box(g, x, y, s, s, { fill: c.surface, stroke: c.line, lw: 1 });
  g.save(); g.beginPath(); g.rect(x, y, s, s); g.clip();
  var pts = [[x - 10, y + s * 0.82], [x + s * 0.35, y + s * 0.7], [x + s * 0.55, y + s * 0.4], [x + s * 0.8, y + s * 0.2], [x + s + 10, y + s * 0.18]];
  D.curve(g, pts, { color: c.line, lw: s * 0.2, cap: 'butt' });
  if (!blur) D.curve(g, pts, { color: c.stage, lw: 2, dash: [8, 8] });
  D.box(g, x + s * 0.5 - 7, y + s * 0.5 - 11, 14, 22, { r: 3, fill: c.ink, alpha: blur ? 0.55 : 1 });
  g.restore();
 }
 function zbars(g, c, x, y, n, w, hh, a, seed) {
  var r = WM.rng(seed || 3);
  for (var i = 0; i < n; i++) { var v = (r() - 0.5) * 2, bh = Math.abs(v) * hh / 2 * a; D.box(g, x + i * w, v > 0 ? y - bh : y, w - 2, bh, { fill: c.imagined, alpha: 0.85 }); }
  D.line(g, x - 4, y, x + n * w + 2, y, { color: c.muted, lw: 1 });
 }
 function mixture(g, c, x, y, w, hh, a) {
  var comps = [[0.2, 0.06, 0.25], [0.38, 0.05, 0.35], [0.55, 0.08, 0.2], [0.72, 0.05, 0.12], [0.86, 0.04, 0.08]];
  var tot = [];
  comps.forEach(function (q) {
   var pts = [];
   for (var i = 0; i <= 60; i++) { var u = i / 60, v = q[2] * Math.exp(-(u - q[0]) * (u - q[0]) / (2 * q[1] * q[1])); pts.push([x + u * w, y - v * hh * 2.2 * a]); tot[i] = (tot[i] || 0) + v; }
   D.poly(g, pts, { color: c.imagined, lw: 1.4, dash: [4, 4], alpha: 0.6 });
  });
  D.poly(g, tot.map(function (v, i) { return [x + i / 60 * w, y - v * hh * 2.2 * a]; }), { color: c.imagined, lw: 3, dash: true });
  D.line(g, x, y, x + w, y, { color: c.muted, lw: 1.5 });
 }
 function drawE1(g, p, env) {
  var t = env.t, c = env.c, k;
  var heads = ['A frame is a lot of numbers', 'V: compress', 'M: predict the next code', 'C: choose the action', 'CarRacing: trained in the real game', 'VizDoom: trained in the dream', 'The temperature matters'];
  head(g, heads[pick(t, [12, 26, 42, 56, 70, 84])]);
  if (t < 26) {
   var fs = t < 12 ? 300 : D.lerp(300, 200, D.ease(D.seg(t, 12, 14)));
   track(g, c, 60, 110, fs, false);
   if (t < 12) {
    fade(g, D.seg(t, 2, 4), function () { D.grid(g, 60, 110, 300, 300, 16, 16, { color: c.ink, alpha: 0.18 }); });
    fade(g, D.seg(t, 4, 6), function () {
     T(g, '64 × 64 pixels', 420, 200, { size: 28, font: 'mono' });
     T(g, '× 3 colours', 420, 244, { size: 28, font: 'mono' });
     T(g, '= 12,288 numbers', 420, 300, { size: 34, font: 'mono', weight: 700 });
    });
    fade(g, D.seg(t, 8, 9.5), function () { T(g, 'What matters for driving: where the road bends, where the car is.', 420, 380, { maxWidth: 480, color: c.ink2, lineHeight: 1.35 }); });
   } else {
    var a = D.seg(t, 14, 16), b = D.seg(t, 17, 19), r2 = D.seg(t, 20, 22);
    fade(g, a, function () {
     D.poly(g, [[270, 120], [400, 180], [400, 260], [270, 300]], { close: true, fill: c.faint, color: c.ink2, lw: 2 });
     T(g, 'encoder', 335, 330, { align: 'center', size: 20, color: c.muted });
    });
    fade(g, b, function () {
     zbars(g, c, 420, 220, 32, 7, 120, b, 4);
     T(g, 'z: 32 numbers', 420, 320, { font: 'mono', color: c.imagined, weight: 700 });
    });
    fade(g, r2, function () {
     D.poly(g, [[660, 180], [790, 120], [790, 300], [660, 260]], { close: true, fill: c.faint, color: c.ink2, lw: 2 });
     T(g, 'decoder', 725, 330, { align: 'center', size: 20, color: c.muted });
     track(g, c, 800, 120, 140, true);
     D.box(g, 800, 120, 140, 140, { stroke: c.imagined, lw: 3, dash: true });
     T(g, 'redrawn frame', 870, 290, { size: 20, align: 'center', color: c.imagined });
     T(g, 'V is trained so the redrawn frame matches the original.', 60, 430, { color: c.ink2 });
    });
   }
  } else if (t < 42) {
   var m1 = D.seg(t, 27, 29), m2 = D.seg(t, 31, 33), m3 = D.seg(t, 35, 37), m4 = D.seg(t, 38.5, 40);
   zbars(g, c, 50, 220, 16, 9, 90, 1, 4); T(g, 'zₜ', 50, 300, { font: 'mono', color: c.imagined, weight: 700 });
   T(g, 'aₜ', 50, 370, { font: 'mono', size: 22, weight: 700 }); T(g, 'steer, gas, brake', 50, 402, { size: 19, color: c.muted });
   fade(g, m1, function () {
    D.arrow(g, 200, 220, 278, 232, { color: c.ink2, lw: 2.5 }); D.arrow(g, 90, 372, 290, 290, { color: c.ink2, lw: 2.5 });
    D.box(g, 290, 170, 260, 130, { r: 4, fill: c.surface, stroke: c.ink, lw: 2 });
    T(g, 'M', 420, 205, { align: 'center', size: 30, weight: 700, font: 'display' });
    T(g, 'recurrent network', 420, 240, { align: 'center', size: 19, color: c.muted });
    T(g, 'memory h: 256 units', 420, 270, { align: 'center', size: 19, font: 'mono' });
    D.arrow(g, 470, 300, 470, 340, { color: c.ink2, lw: 2 }); D.arrow(g, 370, 340, 370, 302, { color: c.ink2, lw: 2 });
    T(g, 'h carries forward', 420, 362, { align: 'center', size: 19, color: c.muted });
   });
   fade(g, m2, function () {
    D.arrow(g, 552, 235, 592, 235, { color: c.ink2, lw: 2.5 });
    mixture(g, c, 600, 300, 320, 110, m2);
    T(g, 'p(next z): mixture of 5 Gaussians', 600, 110, { size: 21, color: c.imagined, weight: 600 });
    T(g, 'one dimension of z shown', 600, 330, { size: 18, color: c.muted });
   });
   fade(g, m3, function () {
    var sx = 600 + 0.38 * 320;
    D.line(g, sx, 300, sx, 170, { color: c.imagined, lw: 2, dash: [3, 4] });
    D.dot(g, sx, 300, 8, { fill: c.imagined });
    T(g, 'sample', sx + 12, 160, { size: 20, color: c.imagined });
   });
   fade(g, m4, function () { T(g, 'One average would blur several possible futures into one impossible one.', 50, 460, { maxWidth: 860, color: c.ink2 }); });
  } else if (t < 56) {
   var c1 = D.seg(t, 43, 45), c2 = D.seg(t, 46, 48), c3 = D.seg(t, 49, 51);
   fade(g, c1, function () {
    T(g, 'a = W · [z, h] + b', 60, 130, { size: 34, font: 'mono', weight: 700 });
    T(g, 'inputs: 32 + 256 = 288     outputs: 3', 60, 186, { size: 22, font: 'mono', color: c.muted });
   });
   fade(g, c2, function () {
    T(g, '288 × 3 + 3 = 867 parameters', 60, 240, { size: 28, font: 'mono' });
    T(g, 'V and M together hold about 4.8 million; C is tiny on purpose.', 60, 284, { color: c.ink2, maxWidth: 510, lineHeight: 1.3 });
   });
   fade(g, c3, function () {
    var cx0 = 760, cy0 = 300, gen = Math.floor(D.seg(t, 49, 55) * 5), r = WM.rng(gen + 11);
    D.box(g, 600, 120, 320, 320, { fill: c.surface, stroke: c.line, lw: 1 });
    T(g, 'CMA-ES population', 612, 146, { size: 19, color: c.muted });
    var mx = D.lerp(650, 830, gen / 4), my = D.lerp(400, 230, gen / 4), sp = D.lerp(70, 18, gen / 4);
    for (k = 0; k < 16; k++) D.dot(g, D.clamp(mx + WM.gauss(r) * sp, 612, 908), D.clamp(my + WM.gauss(r) * sp, 170, 400), 5, { fill: false, stroke: c.imagined, lw: 2 });
    D.dot(g, 830, 230, 9, { fill: false, stroke: c.good, lw: 3 }); T(g, 'better', 800, 186, { size: 19, color: c.good });
    T(g, 'generation ' + (gen + 1), 612, 420, { size: 19, font: 'mono' });
    T(g, 'Each candidate C is scored only by its total reward. No gradients are needed.', 60, 380, { maxWidth: 500, color: c.ink2, lineHeight: 1.35 });
   });
  } else if (t < 70) {
   var r1 = D.seg(t, 57, 60), r3 = D.seg(t, 62, 64);
   var X0 = 280, W0 = 600, sc = function (v) { return X0 + (v - 600) / 350 * W0; };
   D.line(g, sc(600), 360, sc(950), 360, { color: c.muted, lw: 1.5 });
   [600, 700, 800, 900].forEach(function (v) { T(g, String(v), sc(v), 384, { size: 18, font: 'mono', color: c.muted, align: 'center' }); });
   T(g, 'average score, 100 trials', 280, 418, { size: 18, color: c.muted });
   fade(g, r1, function () {
    T(g, 'Previous best', 60, 170, { size: 22 });
    D.box(g, X0, 152, (sc(838) - X0) * r1, 36, { fill: c.muted, alpha: 0.6 });
    T(g, '838 ± 11', sc(838) - 10, 170, { font: 'mono', size: 22, align: 'right', alpha: r1 });
    T(g, 'V + M + C', 60, 250, { size: 22, weight: 700 });
    D.box(g, X0, 232, (sc(906) - X0) * r1, 36, { fill: c.ink });
    T(g, '906 ± 21', sc(906) + 10, 250, { font: 'mono', size: 22, weight: 700, halo: 6 });
   });
   fade(g, r3, function () {
    D.line(g, sc(900), 120, sc(900), 360, { color: c.good, lw: 2, dash: [5, 5] });
    T(g, '906 ± 21', sc(906) + 10, 250, { font: 'mono', size: 22, weight: 700, halo: 6 });
    T(g, 'solved: 900', sc(900) - 8, 112, { size: 20, color: c.good, align: 'right' });
    T(g, 'Here C acted in the real game, seeing it through V and M.', 60, 470, { color: c.ink2 });
   });
  } else {
   var hot = t >= 84, dz = D.seg(t, 71, 73), tau = hot ? D.lerp(0.1, 1.15, D.ease(D.seg(t, 88, 91))) : D.lerp(1, 0.1, D.ease(D.seg(t, 79, 82)));
   /* loop diagram */
   D.box(g, 60, 110, 220, 90, { r: 4, fill: c.surface, stroke: c.line, lw: 2, alpha: 1 - 0.6 * dz });
   T(g, 'real game', 170, 155, { align: 'center', alpha: 1 - 0.6 * dz });
   fade(g, dz, function () { D.line(g, 70, 120, 270, 190, { color: c.error, lw: 3 }); T(g, 'not used', 170, 225, { align: 'center', color: c.error, size: 20 }); });
   D.box(g, 360, 110, 160, 90, { r: 4, fill: c.surface, stroke: c.ink, lw: 2 }); T(g, 'M', 440, 155, { align: 'center', size: 30, weight: 700, font: 'display' });
   D.box(g, 700, 110, 160, 90, { r: 4, fill: c.surface, stroke: c.ink, lw: 2 }); T(g, 'C', 780, 155, { align: 'center', size: 30, weight: 700, font: 'display' });
   D.arrow(g, 522, 140, 698, 140, { color: c.imagined, lw: 3, dash: true }); T(g, 'sampled z, h', 610, 122, { align: 'center', size: 19, color: c.imagined });
   D.arrow(g, 698, 175, 522, 175, { color: c.ink2, lw: 2.5 }); T(g, 'action', 610, 196, { align: 'center', size: 19 });
   D.curve(g, [[480, 202], [500, 250], [440, 262], [400, 250], [410, 204]], { color: c.imagined, lw: 2.5, dash: true });
   T(g, 'M feeds itself', 440, 284, { align: 'center', size: 19, color: c.imagined });
   /* temperature dial */
   fade(g, D.seg(t, 74, 76), function () {
    D.line(g, 600, 330, 900, 330, { color: c.muted, lw: 3 });
    var tx = 600 + D.clamp(tau / 1.5) * 300;
    D.dot(g, tx, 330, 11, { fill: c.imagined });
    T(g, 'temperature τ = ' + WM.ui.fmt(tau, 2), 600, 296, { font: 'mono', size: 22 });
    T(g, 'calmer', 600, 362, { size: 19, color: c.muted }); T(g, 'wilder', 900, 362, { size: 19, color: c.muted, align: 'right' });
   });
   if (!hot) {
    fade(g, D.seg(t, 78, 80), function () { T(g, 'In VizDoom Take Cover, M also predicts when the agent dies, so the whole game, monsters and fireballs included, can be dreamed.', 60, 420, { maxWidth: 500, color: c.ink2, lineHeight: 1.35 }); });
   } else {
    fade(g, D.seg(t, 84.5, 86.5), function () {
     T(g, 'Low τ: the dream is too easy. C exploits errors in M and fails in the real game.', 60, 396, { maxWidth: 500, color: c.error, lineHeight: 1.35 });
    });
    fade(g, D.seg(t, 90, 92), function () {
     T(g, 'τ = 1.15: survived', 60, 466, { size: 22 });
     T(g, '1092 ± 556 steps', 290, 466, { size: 26, font: 'mono', weight: 700 });
     T(g, '(750 needed)', 560, 466, { size: 22, color: c.muted });
    });
   }
  }
 }

 /* ====================================================================
  3. INTERACTIVE B: train a controller inside a dream
  Reality: a threat level u. When it starts rising it usually keeps rising;
  at u >= 1 a fireball launches. Standing in the open earns +1 per step;
  cover earns 0; a fireball while in the open ends the episode.
  M is fitted to 4,000 logged steps: a two-part mixture (rise or settle)
  with a logistic weight, the same kind of model as an MDN, just tiny.
  C: take cover when u > theta. Trained by a cross-entropy evolution
  strategy inside M at temperature tau, starting from "never hide".
  ==================================================================== */
 var EP = 100;
 function realStep(u, r) { return r() < (u > 0.25 ? 0.9 : 0.1) ? u + 0.4 + 0.05 * WM.gauss(r) : 0.5 * u + 0.05 * Math.abs(WM.gauss(r)); }
 var DM = null;
 function dreamModel() {
  if (DM) return DM;
  var r = WM.rng(1), u = 0, Dt = [], i;
  for (i = 0; i < 4000; i++) { var n = realStep(u, r); Dt.push([u, n]); u = n >= 1 ? 0 : n; }
  var rise = Dt.filter(function (d) { return d[1] - d[0] > 0.2; }), set = Dt.filter(function (d) { return d[1] - d[0] <= 0.2; });
  var mr = 0, sr = 0, su = 0, sn = 0, suu = 0, sun = 0, ss = 0, m = set.length;
  rise.forEach(function (d) { mr += (d[1] - d[0]) / rise.length; });
  rise.forEach(function (d) { sr += (d[1] - d[0] - mr) * (d[1] - d[0] - mr) / rise.length; });
  set.forEach(function (d) { su += d[0]; sn += d[1]; suu += d[0] * d[0]; sun += d[0] * d[1]; });
  var a = (m * sun - su * sn) / (m * suu - su * su), b = (sn - a * su) / m;
  set.forEach(function (d) { ss += (d[1] - a * d[0] - b) * (d[1] - a * d[0] - b) / m; });
  var w0 = 0, w1 = 0;
  for (var it = 0; it < 600; it++) {
   var g0 = 0, g1 = 0;
   Dt.forEach(function (d) { var y = d[1] - d[0] > 0.2 ? 1 : 0, q = 1 / (1 + Math.exp(-(w0 + w1 * d[0]))); g0 += q - y; g1 += (q - y) * d[0]; });
   w0 -= 4 * g0 / Dt.length; w1 -= 4 * g1 / Dt.length;
  }
  DM = { mr: mr, sr: Math.sqrt(sr), a: a, b: b, ss: Math.sqrt(ss), w0: w0, w1: w1 };
  return DM;
 }
 function dreamStep(M, u, tau, r) {
  var pr = 1 / (1 + Math.exp(-(M.w0 + M.w1 * u) / tau)), st = Math.sqrt(tau);
  return r() < pr ? u + M.mr + st * M.sr * WM.gauss(r) : M.a * u + M.b + st * M.ss * WM.gauss(r);
 }
 function episode(step, th, r, trace) {
  var u = 0, ret = 0;
  for (var t = 0; t < EP; t++) {
   var cover = u > th, n = step(u, r), fire = n >= 1;
   if (trace) trace.push({ u: u, cover: cover, fire: fire, hit: fire && !cover });
   if (fire && !cover) return ret;
   if (!cover) ret += 1;
   u = fire ? 0 : n;
  }
  if (trace) trace.push({ u: u, cover: u > th, fire: false, hit: false });
  return ret;
 }
 function avgScore(step, th, n, seed) { var r = WM.rng(seed), s = 0; for (var i = 0; i < n; i++) s += episode(step, th, r); return s / n; }
 function evolve(tau, seed) {
  var M = dreamModel(), mu = 1.5, sd = 0.6, R = WM.rng(seed), gens = [];
  var dstep = function (u, r) { return dreamStep(M, u, tau, r); };
  for (var gi = 0; gi < 10; gi++) {
   var pop = [];
   for (var i = 0; i < 24; i++) { var th = D.clamp(mu + sd * WM.gauss(R), -0.1, 1.6); pop.push([th, avgScore(dstep, th, 30, 100 + gi)]); }
   pop.sort(function (x, y) { return y[1] - x[1]; });
   var el = pop.slice(0, 6); mu = 0; el.forEach(function (q) { mu += q[0] / 6; });
   var v = 0; el.forEach(function (q) { v += (q[0] - mu) * (q[0] - mu) / 6; }); sd = Math.max(0.06, Math.sqrt(v));
   gens.push({ pop: pop, mu: mu });
  }
  return { th: mu, gens: gens, dream: avgScore(dstep, mu, 200, 555), real: avgScore(realStep, mu, 200, 777) };
 }

 function buildDream() {
  var tau = 1, res = null, th = 1.5, history = [], prog = 1, dTrace = [], rTrace = [], seedN = 1, gen = 10;
  var reduced = WM.reducedMotion();
  function traces() {
   var M = dreamModel(); dTrace = []; rTrace = [];
   episode(function (u, r) { return dreamStep(M, u, tau, r); }, th, WM.rng('d' + seedN + tau), dTrace);
   episode(realStep, th, WM.rng('r' + seedN), rTrace);
  }
  function band(g, c, tr, y0, hh, label, dream) {
   var x0 = 60, xs = 5.6, sy = function (u) { return y0 + hh - D.clamp(u / 1.4) * hh; };
   T(g, label, 40, y0 - 22, { size: 22, weight: 700, color: dream ? c.imagined : c.ink });
   D.box(g, x0, y0, EP * xs, hh, { fill: c.surface, stroke: c.line, lw: 1 });
   D.line(g, x0, sy(1), x0 + EP * xs, sy(1), { color: c.error, lw: 1.5, dash: [3, 5] });
   T(g, 'fireball launches', x0 + EP * xs - 6, sy(1) - 14, { size: 18, color: c.error, align: 'right' });
   D.line(g, x0, sy(th), x0 + EP * xs, sy(th), { color: c.accent2, lw: 2, dash: [10, 5] });
   T(g, 'θ', x0 + EP * xs + 8, sy(th), { size: 22, color: c.accent2, font: 'mono', weight: 700 });
   var n = Math.max(1, Math.round(tr.length * prog)), pts = [], i;
   for (i = 0; i < n; i++) {
    var s = tr[i], x = x0 + i * xs;
    if (s.cover) D.box(g, x, y0 + hh - 12, xs + 0.5, 12, { fill: c.accent2, alpha: 0.55 });
    pts.push([x, sy(s.u)]);
    if (s.fire && !s.hit) { D.dot(g, x + xs, sy(1), 6, { fill: false, stroke: c.muted, lw: 2 }); }
    if (s.hit) {
     D.line(g, x - 9, sy(1) - 9, x + 9, sy(1) + 9, { color: c.error, lw: 4 }); D.line(g, x - 9, sy(1) + 9, x + 9, sy(1) - 9, { color: c.error, lw: 4 });
     T(g, 'hit in the open', Math.min(x + 16, x0 + EP * xs - 170), sy(1) + 26, { size: 19, color: c.error, weight: 700 });
    }
   }
   D.poly(g, pts, { color: dream ? c.imagined : c.reality, lw: 2.5, dash: dream });
   if (dream && gen < 10 && res) res.gens[Math.floor(gen)].pop.forEach(function (q) { D.dot(g, x0 + EP * xs + 34, sy(q[0]), 4.5, { fill: false, stroke: c.imagined, lw: 2 }); });
   T(g, 'threat ↑', x0 + 6, y0 + 14, { size: 16, color: c.muted, font: 'mono' });
   if (prog >= 1) {
    var last = tr[tr.length - 1], score = 0; tr.forEach(function (s, i) { if (i < EP && !s.cover && !s.hit) score++; });
    T(g, (last && last.hit ? 'ended at step ' + (tr.length) : 'survived 100 steps') + ', score ' + score, x0 + 4, y0 + hh + 24, { size: 19, font: 'mono', color: c.muted });
   }
  }
  function draw(g, env) {
   var c = env.c;
   band(g, c, dTrace, 66, 140, 'Dream inside M, τ = ' + WM.ui.fmt(tau, 2), true);
   band(g, c, rTrace, 298, 140, 'Reality', false);
   /* history chart */
   var ax = D.axes(g, 740, 90, 190, 340, { color: c.muted, size: 17, xticks: [[0, '0'], [0.5, '1'], [1, '2']], yticks: [[0, '0'], [0.5, '50'], [1, '100']] });
   T(g, 'Score vs τ', 700, 44, { size: 22, weight: 700 });
   T(g, 'τ', 935, 476, { size: 18, font: 'mono', color: c.muted, align: 'right' });
   history.forEach(function (q) {
    var x = ax.x(q.tau / 2);
    D.dot(g, x, ax.y(q.dream / 100), 7, { fill: false, stroke: c.imagined, lw: 2.5, dash: [3, 2] });
    D.dot(g, x, ax.y(q.real / 100), 5.5, { fill: c.reality });
   });
   D.dot(g, 712, 506, 7, { fill: false, stroke: c.imagined, lw: 2.5, dash: [3, 2] }); T(g, 'dream', 726, 506, { size: 18, color: c.imagined });
   D.dot(g, 812, 506, 5.5, { fill: c.reality }); T(g, 'real', 826, 506, { size: 18 });
   if (gen < 10) T(g, 'generation ' + (Math.floor(gen) + 1) + ' of 10; circles are candidate θ', 60, 506, { size: 19, font: 'mono', color: c.imagined });
  }
  var cv = WM.canvas({ w: 960, h: 540, draw: draw, label: 'Two timelines of the threat level over 100 steps, one dreamed inside the model (dashed) and one real (solid), with cover periods shaded and hits marked; on the right, dream and real scores for each temperature you have tried.' });
  var anim = visLoop(cv.el, function (dt) {
   if (gen < 10) {
    gen = Math.min(10, gen + dt * 8);
    if (gen >= 10) { th = res.th; traces(); prog = 0; } else th = res.gens[Math.floor(gen)].mu;
   } else { prog = Math.min(1, prog + dt / 1.2); if (prog >= 1) { anim.stop(); if (res) finish(); } }
   cv.redraw();
  });
  var rTh = WM.readout('Learned θ', 'none yet'), rD = WM.readout('Dream score', MINUS), rR = WM.readout('Real score', MINUS);
  var nt = notice();
  function finish() {
   rTh.set(WM.ui.fmt(res.th, 2)); rD.set(WM.ui.fmt(res.dream, 1)); rR.set(WM.ui.fmt(res.real, 1));
   var gap = res.dream - res.real;
   if (res.real < 40) nt.set('The dream at τ = ' + WM.ui.fmt(tau, 2) + ' almost never produces an attack, so cover never pays and the controller learns to stay out. Dream score ' + WM.ui.fmt(res.dream, 0) + ', real score ' + WM.ui.fmt(res.real, 0) + '. The model was exploited.');
   else if (gap > 6) nt.set('The controller learned to hide, but the dream is still easier than reality (dream ' + WM.ui.fmt(res.dream, 0) + ', real ' + WM.ui.fmt(res.real, 0) + '). Try a higher τ.');
   else if (gap < -4) nt.set('This dream is harder than reality (dream ' + WM.ui.fmt(res.dream, 0) + ', real ' + WM.ui.fmt(res.real, 0) + '), and the cautious controller still transfers. Ha and Schmidhuber reported the same pattern at τ = 1.15.');
   else nt.set('Dream and real scores agree (' + WM.ui.fmt(res.dream, 0) + ' and ' + WM.ui.fmt(res.real, 0) + '). Here M is accurate, so an honest dream transfers. Now try τ below 0.3.');
   cv.redraw();
  }
  function run() {
   res = evolve(tau, seedN); seedN++;
   history = history.filter(function (q) { return Math.abs(q.tau - tau) > 0.01; }); history.push({ tau: tau, dream: res.dream, real: res.real });
   if (reduced) { gen = 10; th = res.th; traces(); prog = 1; finish(); return; }
   gen = 0; prog = 1; nt.set('Evolving 24 candidate controllers per generation inside the dream…'); anim.start();
  }
  var sl = WM.slider({ label: 'Dream temperature τ', min: 0.05, max: 2, step: 0.05, value: 1, fmt: 2, onInput: function (v) { tau = v; if (gen >= 10 && prog >= 1) { traces(); cv.redraw(); } } });
  var b = WM.buttons([
   { label: 'Evolve controller in the dream', kind: 'primary', onClick: run },
   { label: 'New episode', kind: 'ghost', onClick: function () { seedN++; traces(); prog = reduced ? 1 : 0; if (!reduced) anim.start(); else cv.redraw(); } },
   { label: 'Clear chart', kind: 'ghost', onClick: function () { history = []; cv.redraw(); } }
  ]);
  traces();
  nt.set('The starting controller never takes cover (θ = 1.5, above any threat it acts on), so in reality it is hit by the first attack. Press Evolve.');
  return WM.panel({ title: 'Train in a dream, test in reality', note: 'Press <b>Evolve</b> at τ = 1. Then set <b>τ</b> to 0.1 and evolve again. Each run adds a dream score and a real score to the chart.' },
   cv, WM.controls(sl, b), WM.readouts(rTh, rD, rR), WM.readouts(nt));
 }

 /* ====================================================================
  4. EXPLAINER 2: a recurrent state-space model   (100 s)
  Script
   0-14  two latent parts per step: deterministic h, stochastic z (unrolled 3 steps)
   14-30 posterior q(z|h,x) vs prior p(z|h): narrow vs wide; KL pulls prior toward posterior
   30-44 loss: reconstruction + reward + KL
   44-58 imagination: start from a filtered state, step with the prior only; futures fan out
   58-72 PlaNet: CEM over action sequences, refit to the best, act once, repeat
   72-88 Dreamer: actor and critic trained on imagined trajectories; v1 backpropagates values
   88-100 lineage: V2 discrete latents; V3 150+ tasks, diamonds from scratch; Dreamer 4 offline
  ==================================================================== */
 function gaussCurve(g, x, y, w, hh, mu, sd, color, dash, lw) {
  var pts = [];
  for (var i = 0; i <= 60; i++) { var u = i / 60, v = Math.exp(-(u - mu) * (u - mu) / (2 * sd * sd)); pts.push([x + u * w, y - v * hh * (0.12 / sd) * 0.9]); }
  D.poly(g, pts, { color: color, lw: lw || 3, dash: dash });
 }
 function drawE2(g, p, env) {
  var t = env.t, c = env.c, i, k;
  var heads = ['Two kinds of latent state', 'Prior and posterior', 'One loss trains the model', 'Imagining without observations', 'PlaNet: plan at every step', 'Dreamer: learn to act in imagination', 'The Dreamer line'];
  head(g, heads[pick(t, [14, 30, 44, 58, 72, 88])]);
  if (t < 44) {
   var xs = [150, 420, 690], fadeX = t < 14 ? 1 : 1 - D.seg(t, 14, 15.5) * 0.65;
   for (i = 0; i < 3; i++) {
    var X = xs[i], a = t < 14 ? D.seg(t, 1 + i * 2, 2.5 + i * 2) : (i === 2 ? 0 : 1);
    fade(g, a * (i === 1 ? 1 : fadeX), function () {
     D.box(g, X - 55, 100, 110, 60, { r: 4, fill: c.surface, stroke: c.ink2, lw: 2.5 });
     T(g, 'h' + '₁₂₃'[i], X, 130, { align: 'center', size: 26, font: 'mono', weight: 700 });
     D.dot(g, X, 250, 34, { fill: c.stage, stroke: c.imagined, lw: 3, dash: [6, 5] });
     T(g, 'z' + '₁₂₃'[i], X, 250, { align: 'center', size: 26, font: 'mono', weight: 700, color: c.imagined });
     D.arrow(g, X, 162, X, 214, { color: c.ink2, lw: 2 });
     if (i < 2 && (t < 14 || i === 0)) {
      D.arrow(g, X + 57, 130, xs[i + 1] - 57, 130, { color: c.ink2, lw: 2.5 });
      D.arrow(g, X + 30, 226, xs[i + 1] - 58, 150, { color: c.ink2, lw: 1.8 });
      T(g, 'a' + '₁₂'[i], (X + xs[i + 1]) / 2, 108, { align: 'center', size: 20, font: 'mono', color: c.muted });
     }
     D.box(g, X - 40, 330, 80, 80, { fill: c.surface, stroke: c.reality, lw: 2 });
     for (k = 0; k < 4; k++) D.line(g, X - 30, 345 + k * 16, X + 30 - k * 9, 345 + k * 16, { color: c.ink, lw: 3, alpha: 0.5 });
     T(g, 'x' + '₁₂₃'[i], X, 432, { align: 'center', size: 20, font: 'mono' });
     D.arrow(g, X, 328, X, 288, { color: c.reality, lw: 2 });
    });
   }
   if (t < 14) {
    fade(g, D.seg(t, 8, 9.5), function () {
     T(g, 'h: deterministic memory, carried reliably from step to step', 40, 486, { size: 21 });
     T(g, 'z: stochastic state, a distribution for what cannot be known', 40, 518, { size: 21, color: c.imagined });
    });
   } else if (t < 30) {
    var b1 = D.seg(t, 15, 17), b2 = D.seg(t, 19, 21), b3 = D.seg(t, 24, 26);
    var PX = 560, PY = 470, PW = 360;
    fade(g, b1, function () {
     D.box(g, 520, 170, 420, 330, { fill: c.stage, stroke: c.line, lw: 1 });
     D.line(g, PX, PY, PX + PW, PY, { color: c.muted, lw: 1.5 });
     gaussCurve(g, PX, PY, PW, 220, 0.42, 0.17, c.imagined, true, 3);
     T(g, 'prior p(z | h)', PX, 196, { size: 21, color: c.imagined, weight: 600 });
     T(g, 'before seeing x₂', PX, 224, { size: 18, color: c.muted });
    });
    fade(g, b2, function () {
     gaussCurve(g, PX, PY, PW, 220 * 0.5, 0.6, 0.06, c.imagined, false, 3.5);
     T(g, 'posterior q(z | h, x)', PX + PW, 196, { size: 21, color: c.imagined, weight: 600, align: 'right' });
     T(g, 'after seeing x₂', PX + PW, 224, { size: 18, color: c.muted, align: 'right' });
    });
    fade(g, b3, function () {
     D.arrow(g, PX + PW * 0.3, 280, PX + PW * 0.5, 280, { color: c.error, lw: 3 });
     T(g, 'KL: pull the prior', PX, 256, { size: 18, color: c.error });
    });
   } else {
    var l1 = D.seg(t, 31, 33), l2 = D.seg(t, 34, 36), l3 = D.seg(t, 37, 39);
    D.box(g, 520, 170, 420, 345, { fill: c.stage, stroke: c.line, lw: 1 });
    T(g, 'loss =', 540, 206, { size: 26, font: 'mono', weight: 700 });
    fade(g, l1, function () { T(g, 'redraw error of x', 560, 260, { size: 22 }); T(g, 'decoder', 920, 260, { size: 18, color: c.muted, align: 'right', font: 'mono' }); });
    fade(g, l2, function () { T(g, '+ reward prediction error', 560, 312, { size: 22 }); T(g, 'reward head', 920, 340, { size: 18, color: c.muted, align: 'right', font: 'mono' }); });
    fade(g, l3, function () { T(g, '+ KL(posterior ‖ prior)', 560, 384, { size: 22, color: c.error }); T(g, 'keeps the prior honest', 560, 416, { size: 18, color: c.muted }); });
    fade(g, D.seg(t, 40, 41.5), function () { T(g, 'All parts are trained together on replayed real experience.', 540, 456, { size: 19, color: c.ink2, maxWidth: 390 }); });
   }
  } else if (t < 58) {
   var ax = D.axes(g, 90, 110, 800, 330, { color: c.muted, size: 17, xlabel: 'step', ylabel: 'one latent coordinate' });
   var now = 0.34, obsPts = [], r = WM.rng(5), y = 0.45;
   for (i = 0; i <= 10; i++) { y += 0.03 * Math.sin(i * 0.9) + 0.02 * WM.gauss(r); obsPts.push([ax.x(i / 10 * now), ax.y(y)]); }
   D.poly(g, obsPts, { color: c.reality, lw: 3.5 });
   for (i = 0; i <= 10; i++) D.dot(g, obsPts[i][0], obsPts[i][1], 4.5, { fill: c.reality });
   T(g, 'inferred from real frames', ax.x(0.02), ax.y(0.9), { size: 20 });
   D.line(g, ax.x(now), ax.y(0), ax.x(now), ax.y(1), { color: c.muted, lw: 1.5, dash: [4, 5] });
   T(g, 'now', ax.x(now) + 8, ax.y(0.04), { size: 19, color: c.muted, font: 'mono' });
   var pr = D.seg(t, 46, 54);
   for (k = 0; k < 9; k++) {
    var rr = WM.rng(40 + k), yy = y, pts = [obsPts[10]];
    for (i = 1; i <= 26; i++) { yy += 0.006 + 0.022 * WM.gauss(rr); pts.push([ax.x(now + i / 26 * (1 - now)), ax.y(D.clamp(yy, 0.02, 0.98))]); }
    D.poly(g, pts, { color: c.imagined, lw: 2, dash: true, alpha: 0.75, progress: pr });
   }
   fade(g, D.seg(t, 52, 54), function () { T(g, 'prior only: no frames, no simulator, thousands of rollouts in parallel', ax.x(now) + 16, ax.y(0.95), { size: 20, color: c.imagined, maxWidth: 520 }); });
  } else if (t < 72) {
   var it = Math.min(2, Math.floor(D.seg(t, 59, 68.5) * 3)), ax2 = D.axes(g, 90, 110, 520, 320, { color: c.muted, size: 17, xlabel: 'planning horizon', ylabel: 'action' });
   var center = [0.5, 0.62, 0.7][it], spread = [0.32, 0.16, 0.07][it], r3 = WM.rng(70 + it), best = [];
   for (k = 0; k < 14; k++) {
    var pts2 = [], a0 = center + spread * WM.gauss(r3), slope = spread * WM.gauss(r3) * 0.6, score = 1 - Math.abs(a0 - 0.72) - Math.abs(slope);
    for (i = 0; i <= 8; i++) pts2.push([ax2.x(i / 8), ax2.y(D.clamp(a0 + slope * i / 8 + 0.04 * Math.sin(i + k)))]);
    best.push([score, pts2]);
   }
   best.sort(function (q, w) { return w[0] - q[0]; });
   best.forEach(function (q, j) { D.poly(g, q[1], { color: j < 4 ? c.imagined : c.muted, lw: j < 4 ? 3 : 1.5, dash: true, alpha: j < 4 ? 1 : 0.6 }); });
   T(g, 'iteration ' + (it + 1) + ': keep the 4 best, refit, resample', 660, 150, { size: 20, maxWidth: 270 });
   T(g, 'Each sequence is scored by summing the model’s predicted rewards.', 660, 250, { size: 20, color: c.ink2, maxWidth: 270 });
   fade(g, D.seg(t, 68, 69.5), function () {
    D.dot(g, ax2.x(0), best[0][1][0][1], 10, { fill: c.reality });
    T(g, 'execute only the first action, then plan again', 660, 360, { size: 20, weight: 700, maxWidth: 270 });
   });
  } else if (t < 88) {
   var q1 = D.seg(t, 73, 75), q2 = D.seg(t, 76, 80), q3 = D.seg(t, 81, 83);
   D.dot(g, 120, 300, 12, { fill: c.reality }); T(g, 'start state', 100, 262, { size: 19, align: 'center' });
   for (k = 0; k < 5; k++) {
    var pts3 = [], r4 = WM.rng(90 + k), yv = 300;
    for (i = 0; i <= 15; i++) { yv += (k - 2) * 3.2 + 4 * WM.gauss(r4); pts3.push([120 + i * 28, yv]); }
    D.poly(g, pts3, { color: c.imagined, lw: 2.2, dash: true, progress: q1 });
    fade(g, q2, function () { for (i = 2; i <= 15; i += 3) D.line(g, pts3[i][0], pts3[i][1] - 7, pts3[i][0], pts3[i][1] + 7, { color: c.good, lw: 2 }); });
    fade(g, q2, function () { D.box(g, pts3[15][0] + 8, pts3[15][1] - 13, 46, 26, { r: 3, fill: c.surface, stroke: c.ink2, lw: 1.5 }); T(g, 'v', pts3[15][0] + 31, pts3[15][1], { size: 18, align: 'center', font: 'mono' }); });
   }
   fade(g, q2, function () { T(g, 'rewards predicted along the way (ticks) plus the critic’s value v at the end', 60, 470, { size: 20, maxWidth: 560 }); });
   fade(g, q1, function () {
    D.box(g, 680, 120, 240, 80, { r: 4, fill: c.surface, stroke: c.ink, lw: 2 }); T(g, 'actor π(a | s)', 800, 160, { align: 'center', size: 22, font: 'mono' });
    D.box(g, 680, 230, 240, 80, { r: 4, fill: c.surface, stroke: c.ink, lw: 2 }); T(g, 'critic v(s)', 800, 270, { align: 'center', size: 22, font: 'mono' });
   });
   fade(g, q3, function () {
    D.arrow(g, 662, 400, 662, 165, { color: c.error, lw: 3 });
    T(g, 'v1: gradients of the imagined return flow back through the learned dynamics into the actor', 680, 350, { size: 19, maxWidth: 250, color: c.ink2 });
   });
  } else {
   var rows = [
    ['2018–19', 'PlaNet', 'learned latent dynamics from pixels; plans online'],
    ['2019', 'Dreamer', 'actor-critic learned purely in latent imagination'],
    ['2020–21', 'DreamerV2', 'discrete latents (32 × 32 classes); human-level Atari'],
    ['2023 / 2025', 'DreamerV3', 'one fixed setup, 150+ tasks; Minecraft diamonds from scratch'],
    ['2025', 'Dreamer 4', 'trained offline inside a video world model; diamonds in 0.7% of episodes']
   ];
   rows.forEach(function (rw, j) {
    fade(g, D.seg(t, 88.5 + j * 1.6, 89.8 + j * 1.6), function () {
     var yy = 116 + j * 78;
     D.dot(g, 60, yy, 7, { fill: c.ink });
     if (j < 4) D.line(g, 60, yy + 8, 60, yy + 70, { color: c.line, lw: 2 });
     T(g, rw[0], 84, yy, { size: 19, font: 'mono', color: c.muted });
     T(g, rw[1], 230, yy, { size: 24, weight: 700 });
     T(g, rw[2], 400, yy, { size: 20, maxWidth: 520, color: c.ink2 });
    });
   });
  }
 }

 /* ====================================================================
  5. EXPLAINER 3: JEPA   (90 s)
  Script
   0-12  masked scene; a pixel predictor must output every pixel, grass included
   12-26 under squared error the best guess is the average: blur; most error is texture
   26-40 JEPA: context encoder, target encoder, predictor; loss between embeddings
   40-52 collapse: constant embedding, zero loss
   52-66 remedies: slow-moving target copy without gradient (I-JEPA, V-JEPA); Gaussian regulariser (LeJEPA, LeWorldModel)
   66-80 V-JEPA 2-AC plans by moving the predicted embedding toward a goal embedding
   80-90 established vs open
  ==================================================================== */
 function lawn(g, c, x, y, w, hh, seed, blurred, ball) {
  D.box(g, x, y, w, hh, { fill: c.surface, stroke: c.line, lw: 1 });
  g.save(); g.beginPath(); g.rect(x, y, w, hh); g.clip();
  if (blurred) D.box(g, x, y, w, hh, { fill: c.good, alpha: 0.18 });
  else {
   var r = WM.rng(seed);
   for (var i = 0; i < 170; i++) { var bx = x + r() * w, by = y + r() * hh; D.line(g, bx, by, bx + (r() - 0.5) * 8, by - 6 - r() * 10, { color: c.good, lw: 1.6, alpha: 0.55 }); }
  }
  if (ball) D.dot(g, ball[0], ball[1], 18, { fill: c.ink, alpha: blurred ? 0.4 : 1 });
  g.restore();
 }
 function emb(g, c, x, y, vals, color, dash) {
  for (var i = 0; i < vals.length; i++) D.box(g, x + i * 22, y, 20, 34, { fill: color, alpha: 0.15 + 0.85 * Math.abs(vals[i]) });
  D.box(g, x - 3, y - 3, vals.length * 22 + 4, 40, { stroke: color, lw: 2, dash: dash });
 }
 function drawE3(g, p, env) {
  var t = env.t, c = env.c, i, k;
  var heads = ['Fill in a hidden part', 'Pixel loss pays for the grass', 'JEPA: predict the embedding', 'Collapse', 'Keeping embeddings informative', 'Planning in embedding space', 'What is established'];
  head(g, heads[pick(t, [12, 26, 40, 52, 66, 80])]);
  if (t < 26) {
   lawn(g, c, 50, 100, 360, 240, 21, false, [300, 220]);
   D.box(g, 230, 150, 140, 140, { fill: c.stage });
   D.box(g, 230, 150, 140, 140, { stroke: c.ink2, lw: 2, dash: [4, 4] });
   T(g, '?', 300, 222, { align: 'center', size: 44, weight: 700, color: c.muted });
   T(g, 'scene with a hidden patch', 50, 366, { size: 19, color: c.muted });
   if (t < 12) {
    fade(g, D.seg(t, 3, 5), function () { D.arrow(g, 420, 220, 520, 220, { color: c.ink2, lw: 2.5 }); T(g, 'predict every pixel', 530, 180, { size: 22 }); });
    fade(g, D.seg(t, 6, 8), function () {
     lawn(g, c, 530, 200, 140, 140, 0, true, [600, 270]);
     D.box(g, 530, 200, 140, 140, { stroke: c.imagined, lw: 3, dash: true });
     T(g, 'best squared-error guess', 690, 250, { size: 19, color: c.imagined, maxWidth: 230 });
     T(g, 'blurred average', 690, 300, { size: 19, color: c.muted });
    });
    fade(g, D.seg(t, 9, 10.5), function () { T(g, 'The exact blades of grass are not predictable from the rest of the scene.', 50, 450, { maxWidth: 860, color: c.ink2 }); });
   } else {
    lawn(g, c, 530, 120, 140, 140, 0, true, [600, 190]);
    D.box(g, 530, 120, 140, 140, { stroke: c.imagined, lw: 3, dash: true });
    lawn(g, c, 760, 120, 140, 140, 21, false, [830, 190]);
    T(g, 'prediction', 600, 284, { size: 19, align: 'center', color: c.imagined });
    T(g, 'truth', 830, 284, { size: 19, align: 'center' });
    var a = D.seg(t, 14, 18), bx = 530, bw = 370;
    T(g, 'where the remaining error comes from', bx, 340, { size: 20 });
    D.box(g, bx, 360, bw * 0.86 * a, 40, { fill: c.error, alpha: 0.75 });
    D.box(g, bx + bw * 0.86 * a, 360, bw * 0.14 * a, 40, { fill: c.ink });
    fade(g, D.seg(t, 18, 19.5), function () {
     T(g, 'grass texture', bx, 424, { size: 19, color: c.error }); T(g, 'ball', bx + bw, 424, { size: 19, align: 'right' });
     T(g, 'Illustrative split', bx, 452, { size: 17, color: c.muted, font: 'mono' });
    });
    fade(g, D.seg(t, 20, 22), function () { T(g, 'Training effort and capacity follow the error: here, mostly grass.', 50, 500, { maxWidth: 860, color: c.ink2 }); });
   }
  } else if (t < 66) {
   var collapse = t >= 40 && t < 52 ? D.ease(D.seg(t, 42, 48)) : 0, spread = t >= 52 ? D.ease(D.seg(t, 54, 60)) : 0;
   var sx = [0.9, 0.3, 0.6, 0.15], sy = [0.25, 0.8, 0.5, 0.65];
   if (t < 40 || t >= 52) {
    var d1 = D.seg(t, 27, 29), d2 = D.seg(t, 30, 32), d3 = D.seg(t, 33, 35), d4 = D.seg(t, 36, 38);
    if (t >= 52) d1 = d2 = d3 = d4 = 1;
    lawn(g, c, 50, 100, 170, 120, 21, false, [170, 150]);
    D.box(g, 140, 115, 76, 90, { fill: c.stage }); T(g, 'context x', 50, 244, { size: 19 });
    lawn(g, c, 50, 300, 170, 120, 21, false, [170, 350]);
    D.box(g, 50, 300, 90, 120, { fill: c.stage }); D.box(g, 140, 315, 76, 90, { stroke: c.ink2, lw: 2 }); T(g, 'target y', 50, 444, { size: 19 });
    fade(g, d1, function () {
     D.arrow(g, 224, 160, 270, 160, { color: c.ink2, lw: 2 }); D.box(g, 274, 130, 120, 60, { r: 4, fill: c.surface, stroke: c.ink, lw: 2 }); T(g, 'encoder', 334, 160, { size: 19, align: 'center' });
     D.arrow(g, 396, 160, 420, 160, { color: c.ink2, lw: 2 }); emb(g, c, 426, 143, sx, c.ink2, false); T(g, 'sₓ', 520, 205, { size: 19, font: 'mono' });
    });
    fade(g, d2, function () {
     D.arrow(g, 224, 360, 270, 360, { color: c.ink2, lw: 2 }); D.box(g, 274, 330, 120, 60, { r: 4, fill: c.surface, stroke: c.ink, lw: 2 }); T(g, 'target', 334, 352, { size: 19, align: 'center' }); T(g, 'encoder', 334, 372, { size: 17, align: 'center', color: c.muted });
     D.arrow(g, 396, 360, 420, 360, { color: c.ink2, lw: 2 }); emb(g, c, 426, 343, sy, c.ink2, false); T(g, 'sᵧ', 520, 405, { size: 19, font: 'mono' });
    });
    fade(g, d3, function () {
     D.arrow(g, 520, 160, 580, 220, { color: c.ink2, lw: 2 }); D.box(g, 560, 220, 150, 70, { r: 4, fill: c.surface, stroke: c.imagined, lw: 2.5 }); T(g, 'predictor', 635, 255, { size: 20, align: 'center', color: c.imagined });
     T(g, 'which patch / which action', 580, 316, { size: 17, color: c.muted });
     D.arrow(g, 712, 255, 740, 255, { color: c.imagined, lw: 2 }); emb(g, c, 748, 238, [0.85, 0.75, 0.5, 0.6], c.imagined, true); T(g, 'ŝᵧ', 850, 255, { size: 19, font: 'mono', color: c.imagined });
    });
    fade(g, d4, function () {
     D.line(g, 840, 280, 840, 340, { color: c.error, lw: 3 }); D.line(g, 520, 360, 840, 360, { color: c.error, lw: 1.5, dash: [3, 4] });
     if (t < 52) { T(g, 'loss: distance between embeddings', 560, 456, { size: 21, color: c.error }); T(g, 'no pixels are predicted', 560, 490, { size: 19, color: c.muted }); }
    });
    if (t >= 52) {
     fade(g, D.seg(t, 53, 55), function () {
      D.arrow(g, 334, 192, 334, 326, { color: c.accent2, lw: 2.5, dash: [5, 4] });
      T(g, 'slow copy, no gradient', 346, 270, { size: 18, color: c.accent2 });
      T(g, 'Remedy 1: the target encoder is a slowly updated copy (I-JEPA, V-JEPA)', 40, 484, { size: 20 });
     });
     fade(g, D.seg(t, 58, 60), function () { T(g, 'Remedy 2: a regulariser keeps embeddings spread like a Gaussian (LeJEPA, LeWorldModel)', 40, 518, { size: 20 }); });
    }
   } else {
    var r5 = WM.rng(33), cx = 300, cy = 300;
    D.box(g, 80, 100, 440, 400, { fill: c.surface, stroke: c.line, lw: 1 });
    T(g, 'embeddings of 40 different scenes', 96, 126, { size: 19, color: c.muted });
    for (k = 0; k < 40; k++) { var ex = D.clamp(cx + WM.gauss(r5) * 85, 100, 500), ey = D.clamp(cy + WM.gauss(r5) * 70, 150, 485); D.dot(g, D.lerp(ex, cx, collapse), D.lerp(ey, cy, collapse), 6, { fill: c.imagined, alpha: 0.75 }); }
    var lossv = (1 - collapse) * 0.83;
    T(g, 'prediction loss', 600, 160, { size: 22 });
    D.box(g, 600, 186, 300 * lossv + 2, 34, { fill: c.error, alpha: 0.8 });
    T(g, WM.ui.fmt(lossv, 2), 600 + 300 * lossv + 14, 203, { size: 22, font: 'mono' });
    fade(g, D.seg(t, 48, 50), function () { T(g, 'Every scene maps to the same point. The loss is zero and the embedding says nothing.', 600, 300, { size: 21, maxWidth: 320, color: c.error, lineHeight: 1.35 }); });
   }
  } else if (t < 80) {
   var pl = D.seg(t, 67, 75), ax = { x0: 80, y0: 100, w: 520, h: 400 };
   D.box(g, ax.x0, ax.y0, ax.w, ax.h, { fill: c.surface, stroke: c.line, lw: 1 });
   T(g, 'embedding space', ax.x0 + 14, ax.y0 + 24, { size: 19, color: c.muted });
   var start = [170, 420], goal = [500, 180];
   D.dot(g, start[0], start[1], 11, { fill: c.reality }); T(g, 'now', start[0] + 18, start[1] + 6, { size: 20 });
   D.dot(g, goal[0], goal[1], 14, { fill: false, stroke: c.good, lw: 3.5 }); T(g, 'goal image', goal[0] - 20, goal[1] - 30, { size: 20, color: c.good, align: 'center' });
   var ends = [[250, 200], [420, 330], [480, 210], [330, 460], [520, 260]];
   ends.forEach(function (e, j) {
    var mid = [(start[0] + e[0]) / 2 + (j - 2) * 20, (start[1] + e[1]) / 2 - 30];
    D.curve(g, [start, mid, e], { color: c.imagined, lw: j === 2 ? 3.5 : 2, dash: true, progress: pl, alpha: j === 2 ? 1 : 0.6 });
    if (pl > 0.98) D.dot(g, e[0], e[1], 6, { fill: c.imagined });
   });
   fade(g, D.seg(t, 75, 76.5), function () { D.line(g, 480, 210, goal[0], goal[1], { color: c.error, lw: 2.5 }); T(g, 'closest to the goal wins', 96, 150, { size: 19, color: c.error }); });
   T(g, 'V-JEPA 2-AC', 640, 120, { size: 24, weight: 700 });
   T(g, 'Candidate action sequences are pushed through the predictor. Pick the one whose predicted embedding lands closest to the goal’s embedding.', 640, 170, { size: 19, maxWidth: 290, lineHeight: 1.35 });
   fade(g, D.seg(t, 72, 74), function () { T(g, 'Post-trained on under 62 hours of robot video; ran zero-shot on Franka arms in two labs.', 640, 340, { size: 19, maxWidth: 290, color: c.ink2, lineHeight: 1.35 }); });
  } else {
   var e1 = D.seg(t, 81, 83), e2 = D.seg(t, 84, 86);
   fade(g, e1, function () {
    T(g, 'Shown', 60, 110, { size: 24, weight: 700, color: c.good });
    ['Useful representations learned without predicting pixels', 'Action-conditioned versions that plan robot motions', 'Small JEPA world models trained end to end from pixels'].forEach(function (s, j) { T(g, '• ' + s, 60, 154 + j * 40, { size: 21 }); });
   });
   fade(g, e2, function () {
    T(g, 'Open', 60, 320, { size: 24, weight: 700, color: c.warn });
    ['Intuitive physics: models remain near chance on IntPhys 2', 'No decoder, so the latent is harder to inspect', 'Not shown to beat generative world models in general'].forEach(function (s, j) { T(g, '• ' + s, 60, 364 + j * 40, { size: 21 }); });
   });
  }
 }

 /* ====================================================================
  6. INTERACTIVE C: pixel-prediction loss vs latent-prediction loss
  Frames: 32 pixels. A striped belt slides steadily (predictable, what we
  care about) under leaf shadows: 6 broad patterns whose strengths follow
  an AR(1) with coefficient 0.5 (only a quarter of their variance can be
  predicted from the previous frame).
  Model A (pixel loss): z = E x_t, predict x_{t+1} = Dec(P z). Linear.
  Model B (latent loss): z = E x_t, predict E x_{t+1} = P z, plus a
  regulariser pushing Cov(z) toward the identity (anti-collapse). Linear.
  Both trained by Adam, full batch, live. Evaluated on fresh frames.
  ==================================================================== */
 var JD = 32, JTR = 240, JTE = 300, JROWS = 60;
 function jData(T0, sig, seed) {
  var r = WM.rng(seed), X = [], O = [], B = [], a = new Float64Array(6), ph = r() * 6.28, i, j, t;
  for (j = 0; j < 6; j++) a[j] = WM.gauss(r);
  for (t = 0; t < T0; t++) {
   ph += 0.35;
   for (j = 0; j < 6; j++) a[j] = 0.5 * a[j] + 0.866 * WM.gauss(r);
   var o = new Float64Array(JD), b = new Float64Array(JD), x = new Float64Array(JD);
   for (i = 0; i < JD; i++) {
    o[i] = Math.cos(2 * Math.PI * 5 * i / JD - ph);
    var s = 0; for (j = 0; j < 3; j++) { var f = 2 * Math.PI * (j + 1) * i / JD; s += a[2 * j] * Math.cos(f) + a[2 * j + 1] * Math.sin(f); }
    b[i] = s * sig; x[i] = o[i] + b[i] + 0.05 * WM.gauss(r);
   }
   X.push(x); O.push(o); B.push(b);
  }
  return { X: X, O: O, B: B };
 }
 function centre(X) { var mu = new Float64Array(JD); X.forEach(function (x) { for (var i = 0; i < JD; i++) mu[i] += x[i] / X.length; }); return { mu: mu, C: X.map(function (x) { return x.map(function (v, i) { return v - mu[i]; }); }) }; }
 function mat(n, s, r) { var a = new Float64Array(n); if (r) for (var i = 0; i < n; i++) a[i] = WM.gauss(r) * s; return a; }
 function Opt() {
  var st = [], t = 0;
  return function (ps, gs, lr) {
   t++;
   ps.forEach(function (P, pi) {
    if (!st[pi]) st[pi] = [new Float64Array(P.length), new Float64Array(P.length)];
    var m = st[pi][0], v = st[pi][1], G = gs[pi];
    for (var i = 0; i < P.length; i++) { m[i] = 0.9 * m[i] + 0.1 * G[i]; v[i] = 0.999 * v[i] + 0.001 * G[i] * G[i]; P[i] -= lr * (m[i] / (1 - Math.pow(0.9, t))) / (Math.sqrt(v[i] / (1 - Math.pow(0.999, t))) + 1e-8); }
   });
  };
 }
 function enc(E, k, x, z) { for (var a = 0; a < k; a++) { var s = 0, off = a * JD; for (var i = 0; i < JD; i++) s += E[off + i] * x[i]; z[a] = s; } return z; }
 function stepA(M, X) {
  var k = M.k, N = X.length - 1, gE = mat(k * JD), gP = mat(k * k), gD = mat(JD * k), z = new Float64Array(k), zp = new Float64Array(k), dzp = new Float64Array(k), dz = new Float64Array(k), L = 0, n, i, a, b;
  for (n = 0; n < N; n++) {
   var x = X[n], y = X[n + 1];
   enc(M.E, k, x, z);
   for (a = 0; a < k; a++) { var s = 0; for (b = 0; b < k; b++) s += M.P[a * k + b] * z[b]; zp[a] = s; }
   dzp.fill(0);
   for (i = 0; i < JD; i++) {
    var yh = 0; for (a = 0; a < k; a++) yh += M.Dc[i * k + a] * zp[a];
    var e = yh - y[i]; L += e * e;
    for (a = 0; a < k; a++) { gD[i * k + a] += e * zp[a]; dzp[a] += M.Dc[i * k + a] * e; }
   }
   dz.fill(0);
   for (a = 0; a < k; a++) for (b = 0; b < k; b++) { gP[a * k + b] += dzp[a] * z[b]; dz[b] += M.P[a * k + b] * dzp[a]; }
   for (a = 0; a < k; a++) for (i = 0; i < JD; i++) gE[a * JD + i] += dz[a] * x[i];
  }
  [gE, gP, gD].forEach(function (G) { for (var q = 0; q < G.length; q++) G[q] *= 2 / N; });
  M.opt([M.E, M.P, M.Dc], [gE, gP, gD], 0.03);
  return L / N;
 }
 function stepB(M, X, reg) {
  var k = M.k, N = X.length - 1, gE = mat(k * JD), gP = mat(k * k), L = 0, n, i, a, b;
  var Z = X.map(function (x) { return enc(M.E, k, x, new Float64Array(k)); });
  var mz = new Float64Array(k); Z.forEach(function (z) { for (a = 0; a < k; a++) mz[a] += z[a] / Z.length; });
  var Cz = new Float64Array(k * k); Z.forEach(function (z) { for (a = 0; a < k; a++) for (b = 0; b < k; b++) Cz[a * k + b] += (z[a] - mz[a]) * (z[b] - mz[b]) / Z.length; });
  var e = new Float64Array(k), dz = new Float64Array(k);
  for (n = 0; n < N; n++) {
   var z = Z[n], z2 = Z[n + 1];
   for (a = 0; a < k; a++) { var s = 0; for (b = 0; b < k; b++) s += M.P[a * k + b] * z[b]; e[a] = s - z2[a]; L += e[a] * e[a]; }
   dz.fill(0);
   for (a = 0; a < k; a++) for (b = 0; b < k; b++) { gP[a * k + b] += e[a] * z[b]; dz[b] += M.P[a * k + b] * e[a]; }
   for (a = 0; a < k; a++) for (i = 0; i < JD; i++) gE[a * JD + i] += (dz[a] * X[n][i] - e[a] * X[n + 1][i]);
  }
  [gE, gP].forEach(function (G) { for (var q = 0; q < G.length; q++) G[q] *= 2 / N; });
  var R = 0;
  if (reg) {
   for (a = 0; a < k; a++) for (b = 0; b < k; b++) { var dm = Cz[a * k + b] - (a === b ? 1 : 0); R += dm * dm; }
   for (n = 0; n < Z.length; n++) for (a = 0; a < k; a++) {
    var gz = 0; for (b = 0; b < k; b++) gz += (Cz[a * k + b] - (a === b ? 1 : 0)) * (Z[n][b] - mz[b]);
    gz *= 4 / Z.length; for (i = 0; i < JD; i++) gE[a * JD + i] += gz * X[n][i];
   }
  }
  M.opt([M.E, M.P], [gE, gP], 0.03);
  return L / N + R;
 }
 function solve(A, bv, n) { /* Gaussian elimination, A n x n (copied) */
  var M = [], i, r, cc;
  for (i = 0; i < n; i++) { M.push(Array.prototype.slice.call(A, i * n, i * n + n)); M[i].push(bv[i]); }
  for (i = 0; i < n; i++) {
   var pv = i; for (r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[pv][i])) pv = r;
   var tmp = M[i]; M[i] = M[pv]; M[pv] = tmp;
   var v = M[i][i] || 1e-12;
   for (r = 0; r < n; r++) { if (r === i) continue; var f = M[r][i] / v; for (cc = i; cc <= n; cc++) M[r][cc] -= f * M[i][cc]; }
  }
  return M.map(function (row, j) { return row[n] / (row[j] || 1e-12); });
 }
 /* metrics on held-out frames, plus a linear read-out of each frame from the latent (for display) */
 function jEval(E, k, te, mu) {
  var n = te.X.length, a, b, i, t;
  var Z = te.X.map(function (x) { return enc(E, k, x.map(function (v, j) { return v - mu[j]; }), new Float64Array(k)); });
  var Zo = te.O.map(function (o) { return enc(E, k, o, new Float64Array(k)); }), Zb = te.B.map(function (bb) { return enc(E, k, bb, new Float64Array(k)); });
  function tv(L) { var m = new Float64Array(k), s = 0; L.forEach(function (z) { for (a = 0; a < k; a++) m[a] += z[a] / L.length; }); L.forEach(function (z) { for (a = 0; a < k; a++) s += (z[a] - m[a]) * (z[a] - m[a]); }); return s; }
  var vo = tv(Zo), vb = tv(Zb), tot = tv(Z);
  var K = k + 1, G = new Float64Array(K * K), F = Z.map(function (z) { var f = Array.prototype.slice.call(z); f.push(1); return f; });
  F.forEach(function (f) { for (a = 0; a < K; a++) for (b = 0; b < K; b++) G[a * K + b] += f[a] * f[b]; });
  for (a = 0; a < k; a++) G[a * K + a] += 1e-6 * n;
  function readout(Y) { /* least squares Y ~ F W; returns predictions and R2 */
   var W = [], p, sse = 0, sst = 0, mY = new Float64Array(JD), out = [];
   for (p = 0; p < JD; p++) { var rhs = new Float64Array(K); for (t = 0; t < n; t++) for (a = 0; a < K; a++) rhs[a] += F[t][a] * Y[t][p]; W.push(solve(G, rhs, K)); }
   Y.forEach(function (y) { for (p = 0; p < JD; p++) mY[p] += y[p] / n; });
   for (t = 0; t < n; t++) {
    var row = new Float64Array(JD);
    for (p = 0; p < JD; p++) { var yh = 0; for (a = 0; a < K; a++) yh += W[p][a] * F[t][a]; row[p] = yh; sse += (yh - Y[t][p]) * (yh - Y[t][p]); sst += (Y[t][p] - mY[p]) * (Y[t][p] - mY[p]); }
    out.push(row);
   }
   return { pred: out, r2: 1 - sse / sst };
  }
  var ro = readout(te.O), rx = readout(te.X);
  return { belt: D.clamp(ro.r2), leaves: tot > 1e-9 ? D.clamp(vb / (vb + vo + 1e-12)) : 0, scale: tot, view: rx.pred.slice(0, JROWS) };
 }

 function buildJepa() {
  var sig = 2, k = 2, reg = true, STEPS = 500, tr, te, mu, C, A, B, evA = null, evB = null, steps = 0, loss = [[], []];
  function init() {
   tr = jData(JTR, sig, 11); te = jData(JTE, sig, 12);
   var cc = centre(tr.X); mu = cc.mu; C = cc.C;
   var r = WM.rng(5);
   A = { k: k, E: mat(k * JD, 0.2, r), P: mat(k * k, 0.3, r), Dc: mat(JD * k, 0.2, r), opt: Opt() };
   var r2 = WM.rng(5);
   B = { k: k, E: mat(k * JD, 0.2, r2), P: mat(k * k, 0.3, r2), opt: Opt() };
   steps = 0; loss = [[], []]; evA = jEval(A.E, k, te, mu); evB = jEval(B.E, k, te, mu);
  }
  var inScale = 1;
  function kymo(g, c, rows, x, y, w, hh) {
   var flat = new Float64Array(JD * JROWS);
   for (var t = 0; t < JROWS; t++) for (var i = 0; i < JD; i++) flat[t * JD + i] = rows[t] ? rows[t][i] : 0;
   D.box(g, x, y, w, hh, { fill: c.stage });
   img(g, flat, JD, JROWS, x, y, w, hh, -inScale, inScale, c.ink);
  }
  function draw(g, env) {
   var c = env.c, cols = [40, 350, 660], W = 260, Y0 = 118, H0 = 330;
   var s = 0, n = 0; te.X.slice(0, JROWS).forEach(function (x) { x.forEach(function (v, i) { s += (v - mu[i]) * (v - mu[i]); n++; }); }); inScale = 2.2 * Math.sqrt(s / n);
   var inRows = te.X.slice(0, JROWS).map(function (x) { return x.map(function (v, i) { return v - mu[i]; }); });
   var titles = [['Input frames', 'belt + leaf shadows'], ['A: pixel loss', 'what its latent keeps'], ['B: latent loss', 'what its latent keeps']];
   [inRows, evA.view, evB.view].forEach(function (rows, j) {
    var x = cols[j];
    T(g, titles[j][0], x, 36, { size: 23, weight: 700, color: j ? c.imagined : c.ink });
    T(g, titles[j][1], x, 66, { size: 19, color: c.muted });
    kymo(g, c, rows, x, Y0, W, H0);
    D.box(g, x, Y0, W, H0, j ? { stroke: c.imagined, lw: 2.5, dash: true } : { stroke: c.reality, lw: 2 });
    if (j) {
     var ev = j === 1 ? evA : evB;
     T(g, 'belt kept', x, 478, { size: 19 }); T(g, pct(ev.belt), x + W, 478, { size: 20, font: 'mono', align: 'right', weight: 700 });
     D.box(g, x, 490, W, 10, { fill: c.faint }); D.box(g, x, 490, W * ev.belt, 10, { fill: c.ink });
     T(g, 'latent on leaves', x, 520, { size: 18, color: c.muted }); T(g, ev.collapsed ? 'collapsed' : pct(ev.leaves), x + W, 520, { size: 19, font: 'mono', align: 'right', color: ev.collapsed ? c.error : c.muted });
    }
   });
   T(g, 'space →', 40, 98, { size: 17, font: 'mono', color: c.muted });
   g.save(); g.translate(26, Y0); g.rotate(Math.PI / 2); T(g, 'time →', 0, 0, { size: 17, font: 'mono', color: c.muted }); g.restore();
   T(g, steps < STEPS ? 'training step ' + steps + ' of ' + STEPS : 'trained: ' + STEPS + ' steps', 40, 478, { size: 18, font: 'mono', color: c.muted });
   T(g, 'diagonal stripes = belt', 40, 504, { size: 18, color: c.muted });
   T(g, 'blotchy bands = leaves', 40, 528, { size: 18, color: c.muted });
  }
  var cv = WM.canvas({ w: 960, h: 540, draw: draw, label: 'Three space-time pictures, time running downwards. Left: the input frames, a sliding striped belt under flickering leaf shadows. Middle and right: what can be read back from the latent of model A (pixel loss) and model B (latent loss), with the share of the belt each keeps.' });
  var rA = WM.readout('A: belt kept', MINUS), rB = WM.readout('B: belt kept', MINUS), rLA = WM.readout('A: latent on leaves', MINUS), rLB = WM.readout('B: latent on leaves', MINUS);
  var nt = notice();
  function say() {
   var col = !reg && evB.scale < 0.02 * k * JTE; evB.collapsed = col;
   rA.set(pct(evA.belt)); rB.set(pct(evB.belt)); rLA.set(pct(evA.leaves)); rLB.set(col ? 'collapsed' : pct(evB.leaves));
   if (steps < STEPS) { nt.set('Training both models on the same 240 frames…'); return; }
   if (!reg) { nt.set('Without the regulariser, B makes its embeddings predictable by shrinking them toward a constant. Its loss is near zero and it keeps ' + pct(evB.belt) + ' of the belt. This is collapse.'); return; }
   if (sig < 0.4) nt.set('With faint leaves both models keep the belt. The difference only appears when irrelevant detail is strong.');
   else if (evA.belt < 0.5 && evB.belt > 0.8) nt.set('A spends its ' + k + ' latent number' + (k > 1 ? 's' : '') + ' on leaf shadows, because their predictable part carries more pixel variance than the belt. B ranks directions by how predictable they are, so it keeps the belt.');
   else if (evA.belt >= 0.5) nt.set('A now has enough capacity, or faint enough leaves, to keep the belt too (' + pct(evA.belt) + '). Count how many latent numbers it needed compared with B.' + (k > 2 ? ' B needs only 2 for the belt; the regulariser makes its other numbers vary too, so they pick up leaves.' : ''));
   else if (k < 2) nt.set('With one number B keeps only part of the belt (' + pct(evB.belt) + '): the steady sliding is a rotation, and predicting a rotation linearly needs two numbers. A still keeps leaves.');
   else nt.set('Compare the two middle pictures: blotches mean leaves, diagonal stripes mean belt.');
  }
  var lp = visLoop(cv.el, function () {
   for (var q = 0; q < 10 && steps < STEPS; q++) { stepA(A, C); stepB(B, C, reg); steps++; }
   if (steps % 50 === 0 || steps >= STEPS) { evA = jEval(A.E, k, te, mu); evB = jEval(B.E, k, te, mu); say(); }
   cv.redraw();
   if (steps >= STEPS) lp.stop();
  });
  var timer = 0;
  function restart() { clearTimeout(timer); timer = setTimeout(function () { init(); say(); cv.redraw(); lp.start(); }, 120); }
  WM.onDispose(function () { clearTimeout(timer); });
  var s1 = WM.slider({ label: 'Leaf shadow strength', min: 0, max: 3, step: 0.1, value: 2, fmt: 1, onInput: function (v) { sig = v; restart(); } });
  var s2 = WM.slider({ label: 'Latent size (numbers)', min: 1, max: 8, step: 1, value: 2, onInput: function (v) { k = v; restart(); } });
  var tg = WM.toggle({ label: 'Anti-collapse regulariser for B', value: true, onChange: function (v) { reg = v; restart(); } });
  init(); say(); lp.start();
  return WM.panel({ title: 'Pixel loss versus latent loss under flickering detail', note: 'Wait for training (about 2 seconds), then raise the <b>Latent size</b> until model A keeps the belt. Finally switch off the <b>regulariser</b>.' },
   cv, WM.controls(s1, s2, tg), WM.readouts(rA, rLA, rB, rLB), WM.readouts(nt));
 }

 /* ====================================================================
  7. PREGNANCY FIGURE: a latent level between visits (Kalman filter,
  the linear-Gaussian cousin of an RSSM's prior and posterior).
  Synthetic systolic blood pressure, weeks 10 to 40.
  ==================================================================== */
 function truthBP(w) { return 112 - 4 * Math.exp(-Math.pow((w - 20) / 6, 2)) + Math.max(0, w - 28) * 1.5; }
 function buildPreg() {
  var sched = 'routine', showTrue = true;
  var SCH = { routine: [12, 16, 20, 24, 28, 30, 32, 34, 36, 38], sparse: [12, 20, 28, 36], gap: [12, 16, 20, 24, 28, 36, 38] };
  var r = WM.rng('bp'), noise = {}; for (var w = 10; w <= 40; w++) noise[w] = 5 * WM.gauss(r);
  function filter() { /* local linear trend: state [level, slope]; weekly steps */
   var vis = SCH[sched], m = [112, 0], P = [[40, 0], [0, 0.2]], q = [0.4, 0.006], R = 25, out = [];
   for (var wk = 10; wk <= 40; wk++) {
    if (wk > 10) {
     m = [m[0] + m[1], m[1]];
     P = [[P[0][0] + 2 * P[0][1] + P[1][1] + q[0], P[0][1] + P[1][1]], [P[0][1] + P[1][1], P[1][1] + q[1]]];
    }
    var obs = vis.indexOf(wk) >= 0 ? truthBP(wk) + noise[wk] : null;
    if (obs != null) {
     var S = P[0][0] + R, K0 = P[0][0] / S, K1 = P[1][0] / S, inn = obs - m[0];
     m = [m[0] + K0 * inn, m[1] + K1 * inn];
     P = [[(1 - K0) * P[0][0], (1 - K0) * P[0][1]], [P[1][0] - K1 * P[0][0], P[1][1] - K1 * P[0][1]]];
    }
    out.push({ w: wk, m: m[0], sd: Math.sqrt(Math.max(0, P[0][0])), obs: obs });
   }
   return out;
  }
  var F = filter();
  function draw(g, env) {
   var c = env.c, ax = D.axes(g, 100, 40, 800, 330, { color: c.muted, size: 17, xlabel: 'gestational age (weeks)', ylabel: 'systolic BP, mmHg', xticks: [[0, '10'], [1 / 3, '20'], [2 / 3, '30'], [1, '40']], yticks: [[0, '95'], [0.5, '120'], [1, '145']] });
   var X = function (wk) { return ax.x((wk - 10) / 30); }, Y = function (v) { return ax.y((v - 95) / 50); };
   var up = F.map(function (q) { return [X(q.w), Y(q.m + 2 * q.sd)]; }), lo = F.map(function (q) { return [X(q.w), Y(q.m - 2 * q.sd)]; }).reverse();
   D.poly(g, up.concat(lo), { close: true, fill: c.imagined, stroke: false, alpha: 0.12 });
   D.poly(g, up, { color: c.imagined, lw: 1.2, dash: [4, 4], alpha: 0.8 }); D.poly(g, lo, { color: c.imagined, lw: 1.2, dash: [4, 4], alpha: 0.8 });
   D.poly(g, F.map(function (q) { return [X(q.w), Y(q.m)]; }), { color: c.imagined, lw: 3, dash: true });
   if (showTrue) { var tp = []; for (var wk = 10; wk <= 40; wk += 0.5) tp.push([X(wk), Y(truthBP(wk))]); D.poly(g, tp, { color: c.reality, lw: 2, alpha: 0.6 }); }
   F.forEach(function (q) { if (q.obs != null) D.dot(g, X(q.w), Y(q.obs), 7, { fill: c.reality, stroke: c.stage, lw: 2 }); });
   T(g, 'Synthetic, illustrative data', 900, 26, { size: 17, font: 'mono', color: c.muted, align: 'right' });
   var lx = 110, ly = 446;
   D.dot(g, lx, ly, 7, { fill: c.reality }); T(g, 'visit reading', lx + 16, ly, { size: 19 });
   D.line(g, lx + 170, ly, lx + 214, ly, { color: c.imagined, lw: 3, dash: true }); T(g, 'model’s estimate ± 2 SD', lx + 224, ly, { size: 19, color: c.imagined });
   if (showTrue) { D.line(g, lx + 500, ly, lx + 544, ly, { color: c.reality, lw: 2, alpha: 0.6 }); T(g, 'hidden true level', lx + 554, ly, { size: 19 }); }
  }
  var cv = WM.canvas({ w: 960, h: 470, draw: draw, label: 'Synthetic systolic blood pressure across pregnancy: visit readings as dots and the model estimate as a dashed line with a shaded band that widens between visits and narrows at each visit.' });
  var rW = WM.readout('Band half-width at 34 weeks', ''), nt = notice();
  function upd() {
   F = filter(); var q = F[34 - 10];
   rW.set('±' + WM.ui.fmt(2 * q.sd, 1) + ' mmHg');
   nt.set(sched === 'routine' ? 'Between visits the prior carries the estimate forward and the band widens a little; each visit (posterior) pulls it back.' :
    'With fewer visits the prior runs longer without correction, so the band widens and the late rise is noticed later.');
   cv.redraw();
  }
  var sel = WM.select({ label: 'Visit schedule', value: 'routine', options: [{ value: 'routine', label: '10 visits' }, { value: 'gap', label: '7 visits, none at 30–34 weeks' }, { value: 'sparse', label: '4 visits' }], onChange: function (v) { sched = v; upd(); } });
  var tg = WM.toggle({ label: 'Show the hidden true level', value: true, onChange: function (v) { showTrue = v; cv.redraw(); } });
  upd();
  return WM.panel({ title: 'A latent level between sparse visits', kicker: 'Interactive figure', note: 'Change the <b>Visit schedule</b> and watch the band between 28 and 36 weeks.' },
   cv, WM.controls(sel, tg), WM.readouts(rW), WM.readouts(nt));
 }

 /* ====================================================================
  8. THE MODULE
  ==================================================================== */
 WM.register({
  id: 'm4', num: 4, title: 'Latent worlds and dreaming', tagline: 'Compress observations into a small learned state, then predict, plan and learn inside it.', minutes: 35, level: 'Core',
  build: function (root) {
   root.append(
    WM.hero({
     kicker: 'Module 4 · Core', title: 'Latent worlds and dreaming', minutes: 35,
     lede: 'Module 3 learned transitions for a state that was handed to the model: a position, a few numbers. Real observations are images or long lists of measurements, and the state that matters is hidden inside them. This module compresses observations into a small learned state, then predicts, plans and learns behaviour inside that compressed world. It ends with JEPA, which drops pixel prediction altogether.',
     goals: [
      'Explain why world models predict in a learned <b>latent space</b>, and read the map of a latent space you train yourself.',
      'Describe the V–M–C agent of Ha and Schmidhuber (2018) and the recurrent state-space model behind PlaNet and Dreamer, including how behaviour is learned inside imagination and how that fails.',
      'Contrast a pixel-prediction loss with a latent-prediction (JEPA) loss: what each spends capacity on, and how JEPA avoids collapse.'
     ]
    }),

    /* ---------------- 1 LATENT ---------------- */
    WM.section({ id: 'latent', kicker: '§1', title: 'Compress, then predict' },
     WM.p('A camera frame of 64 × 64 colour pixels is 12,288 numbers. The situation it shows can often be described with a handful: where the car is, how fast it moves, where the road bends. Predicting all 12,288 numbers at every step is expensive, and most of the effort goes to detail that does not affect what happens next.'),
     WM.p('World models therefore map each observation to a short vector, the <dfn data-def="A small set of numbers, learned from data, that summarises an observation. Latent means hidden: nobody labels these numbers; training decides what they hold.">latent state</dfn>, and learn the dynamics on that vector. The usual tool is an <dfn data-def="A network made of an encoder, which squeezes the input into a few numbers, and a decoder, which tries to redraw the input from them. Both are trained together to make the redrawing match.">autoencoder</dfn>. The bottleneck forces the code to keep whatever matters most for redrawing the input.'),
     WM.p('A <dfn data-def="An autoencoder whose encoder outputs a distribution (a mean and a spread) for each input. The decoder redraws from a sample of that distribution, and a penalty pulls every distribution toward a standard normal.">variational autoencoder</dfn> (VAE) adds two things: the encoder outputs a small cloud instead of a point, and a penalty, the <dfn data-def="Kullback–Leibler divergence: a measure of how far one probability distribution is from another. Zero when they are identical.">KL divergence</dfn>, pulls every cloud toward a standard normal distribution. Codes are packed into one compact region without gaps, so a point chosen near the centre decodes to something plausible. That property matters as soon as a model starts producing latents by itself, which is what a dreaming world model does.'),
     WM.p('The panel below trains both kinds of network in your browser. The 500 training images show one soft blob on a 12 × 12 grid, so the images differ in exactly two ways: horizontal and vertical position. The latent has two numbers, which is just enough.'),
     buildLatent(),
     WM.callout('warn', 'Misconception: the latent axes are the physical variables', 'The images vary only in horizontal and vertical position, yet the learned axes are usually rotated, stretched or curved versions of those two, and a plain autoencoder can fold them. Nothing in the training asks for interpretable axes. Reading a latent number as “speed” or “blood pressure” needs separate evidence, for example a probe fitted against a measured variable.')
    ),

    /* ---------------- 2 V-M-C ---------------- */
    WM.section({ id: 'vmc', kicker: '§2', title: 'Dreaming with V, M and C' },
     WM.p('Ha and Schmidhuber’s 2018 paper, titled simply “World Models”, built an agent from three learned parts. <b>V</b> (vision) is a VAE that turns each frame into a code z. <b>M</b> (memory) is a recurrent network that predicts the next z from the current z and action. <b>C</b> (controller) picks the action. The parts are trained one after another: V on frames, M on sequences of V’s codes, then C.'),
     WM.explainer({
      id: 'e1', title: 'World Models (2018): V, M and C', duration: 96, poster: 22,
      scenes: [
       { start: 0, end: 12, caption: 'A single frame from the CarRacing task is 64 × 64 colour pixels: 12,288 numbers. Very few of them matter for driving.', draw: drawE1 },
       { start: 12, end: 26, caption: 'V is a variational autoencoder. It compresses each frame into a code z of 32 numbers and is trained to redraw the frame from that code.', draw: drawE1 },
       { start: 26, end: 42, caption: 'M is a recurrent network with 256 hidden units. From z and the action it predicts the next z as a mixture of five Gaussians, because the next frame is uncertain.', draw: drawE1 },
       { start: 42, end: 56, caption: 'C is a single linear layer from z and M’s hidden state h to three actions: 867 parameters. It was trained with an evolution strategy, CMA-ES, which needs only the total reward of each attempt.', draw: drawE1 },
       { start: 56, end: 70, caption: 'In CarRacing, C was trained in the real environment, seeing it through V and M. It averaged 906 ± 21 over 100 trials, above the 900 that counts as solved.', draw: drawE1 },
       { start: 70, end: 84, caption: 'In VizDoom Take Cover the real game was removed. M’s own samples were fed back as the next input, and C was trained entirely inside this dream. A temperature τ sets how uncertain M’s samples are.', draw: drawE1 },
       { start: 84, end: 96, caption: 'At low temperature the agent learned to exploit flaws in M and failed in the real game. With τ = 1.15 it survived 1092 ± 556 steps in the real game, above the 750 required.', draw: drawE1 }
      ]
     }),
     WM.p('M is a <dfn data-def="Mixture density network: a network whose output is the set of weights, means and spreads of several Gaussian bumps. Together they describe a probability distribution with more than one peak.">mixture density network</dfn> on top of an LSTM. The mixture matters. If a fireball may or may not appear in the next frame, a single average prediction describes half a fireball, which never happens. A mixture can say “probably nothing, possibly a fireball”. When the dream is generated, a <dfn data-def="A number that rescales a model’s uncertainty when sampling. Below 1 the samples cluster around the most likely outcome; above 1 they spread out and rare outcomes become more common.">temperature</dfn> τ rescales that uncertainty.'),
     WM.p('The panel below rebuilds the dream experiment at toy scale. Reality has a threat level that, once it starts rising, usually keeps rising until a fireball launches. Standing in the open scores a point per step; taking cover scores nothing; a fireball while in the open ends the episode. M is fitted to 4,000 logged steps as a two-part mixture (rise or settle) whose weights depend on the threat, the same kind of model as Ha and Schmidhuber’s M, much smaller. C has one number, θ: take cover when the threat exceeds θ. Evolution tunes θ inside the dream only, starting from a controller that never hides.'),
     buildDream(),
     WM.callout('warn', 'An optimiser finds the model’s mistakes', 'Training a policy inside a model rewards anything the model gets wrong in the agent’s favour. In this toy, cooling the dream removes the rare attacks; Ha and Schmidhuber’s low-temperature agents likewise exploited flaws in M. Common remedies are noisier dreams, penalties where the model is uncertain (the ensembles of Module 3), retraining the model on fresh real data, and checking in reality before trusting a dreamed score. Here M is accurate, so τ = 1 already transfers; Ha and Schmidhuber’s M was not, and a slightly hotter dream worked best.')
    ),

    /* ---------------- 3 RSSM ---------------- */
    WM.section({ id: 'rssm', kicker: '§3', title: 'Recurrent state-space models: PlaNet and Dreamer' },
     WM.p('V–M–C trained its parts separately, so V decided what to keep before anyone asked what M could predict. PlaNet (Hafner and colleagues, 2018–19) learned the representation and the dynamics together, from pixels, with one loss. Its model, which the paper named the <dfn data-def="Recurrent state-space model: a latent dynamics model whose state has a deterministic part h (a recurrent network’s memory) and a stochastic part z (a sampled latent). Used in PlaNet and the Dreamer agents.">recurrent state-space model</dfn> (RSSM), became the template for the Dreamer agents.'),
     WM.p('Its state has two parts. A deterministic memory h, updated by a recurrent network, carries information reliably over many steps. A stochastic latent z, drawn from a distribution, expresses what the model cannot know for certain. When a real frame arrives, the model can look at it. When it imagines, it cannot. The explainer shows how both cases are handled.'),
     WM.explainer({
      id: 'e2', title: 'Inside a recurrent state-space model', duration: 100, poster: 26,
      scenes: [
       { start: 0, end: 14, caption: 'PlaNet’s model, which its authors named the recurrent state-space model (RSSM), keeps two latent parts per step: a deterministic memory h and a stochastic state z. Real frames x feed in from below.', draw: drawE2 },
       { start: 14, end: 30, caption: 'With a frame, the posterior q(z | h, x) uses it and is narrow. Without one, the prior p(z | h) must guess and is wide. Training pulls the prior toward the posterior.', draw: drawE2 },
       { start: 30, end: 44, caption: 'One loss trains everything: redraw the frame, predict the reward, and keep the prior close to the posterior with a KL term.', draw: drawE2 },
       { start: 44, end: 58, caption: 'To imagine, start from a state inferred from real frames and step forward with the prior only. No frames and no simulator are needed, and the futures spread out.', draw: drawE2 },
       { start: 58, end: 72, caption: 'PlaNet plans at every real step: sample many action sequences, score them by imagined reward, refit to the best, repeat, then carry out only the first action.', draw: drawE2 },
       { start: 72, end: 88, caption: 'Dreamer instead learns an actor and a critic from imagined trajectories. The first Dreamer improved the actor by backpropagating value estimates through the learned dynamics.', draw: drawE2 },
       { start: 88, end: 100, caption: 'The design scaled: discrete latents in DreamerV2, one fixed configuration across more than 150 tasks in DreamerV3, and Dreamer 4, trained offline inside a large video world model.', draw: drawE2 }
      ]
     }),
     WM.callout('math', 'The RSSM in symbols', '<p>Deterministic path: h<sub>t</sub> = f(h<sub>t−1</sub>, z<sub>t−1</sub>, a<sub>t−1</sub>), with f a recurrent network.<br>Prior: ẑ<sub>t</sub> ~ p(z<sub>t</sub> | h<sub>t</sub>). Posterior: z<sub>t</sub> ~ q(z<sub>t</sub> | h<sub>t</sub>, x<sub>t</sub>).<br>Heads: decoder p(x<sub>t</sub> | h<sub>t</sub>, z<sub>t</sub>) and reward p(r<sub>t</sub> | h<sub>t</sub>, z<sub>t</sub>).</p><p>Loss per step: −ln p(x<sub>t</sub> | h<sub>t</sub>, z<sub>t</sub>) − ln p(r<sub>t</sub> | h<sub>t</sub>, z<sub>t</sub>) + KL[q(z<sub>t</sub> | h<sub>t</sub>, x<sub>t</sub>) ‖ p(z<sub>t</sub> | h<sub>t</sub>)].</p><p>This is the variational bound of the VAE in §1, unrolled over time, with the prior now supplied by the dynamics instead of a fixed standard normal.</p>'),
     WM.p('PlaNet and Dreamer differ in where the computing goes. PlaNet searches over action sequences at every real step, using the <dfn data-def="Cross-entropy method: sample many candidates from a distribution, keep the best few, refit the distribution to them, and repeat.">cross-entropy method</dfn>, which is expensive at decision time. Dreamer spends the computing during training: an <dfn data-def="In reinforcement learning, a pair of networks: the actor chooses actions, the critic estimates how much future reward a state is worth.">actor and critic</dfn> learn from thousands of imagined latent trajectories, and acting afterwards is one pass through the actor. Later versions changed the details, for example discrete latents in DreamerV2 and a single fixed set of hyperparameters across domains in DreamerV3.'),
     WM.callout('warn', 'Two Minecraft results that are often merged', 'DreamerV3 (arXiv 2023; <i>Nature</i> 2025) learned online, interacting with the game from scratch without human data, and was the first algorithm reported to collect diamonds that way. Dreamer 4 (2025) never touched the game during training: it learned a world model from 2,541 hours of recorded human play, only 100 hours of it with actions, then trained its agent inside that model. It obtained diamonds in 0.7% of episodes.')
    ),

    /* ---------------- 4 JEPA ---------------- */
    WM.section({ id: 'jepa', kicker: '§4', title: 'JEPA: predict in representation space' },
     WM.p('Every model so far keeps a decoder and shapes its latent partly by redrawing pixels. LeCun’s 2022 position paper argued that this objective is wasteful. Much of what a camera sees, such as the exact pattern of leaves or ripples, cannot be predicted, and a pixel loss keeps paying for it. He proposed the <dfn data-def="Joint-embedding predictive architecture: encode the context and the target separately, and train a predictor to output the target’s embedding from the context’s embedding. No pixels are predicted.">joint-embedding predictive architecture</dfn> (JEPA): encode both the visible part and the part to be predicted, and predict the second encoding from the first.'),
     WM.explainer({
      id: 'e3', title: 'JEPA: predict the embedding', duration: 90, poster: 36,
      scenes: [
       { start: 0, end: 12, caption: 'Hide part of a scene and ask a model to fill it in. A pixel predictor must give a value for every pixel, including the exact grass, which cannot be known from the rest.', draw: drawE3 },
       { start: 12, end: 26, caption: 'Under a squared pixel loss the best guess for unpredictable detail is its average, so the prediction blurs, and most of the remaining error is texture, not the ball.', draw: drawE3 },
       { start: 26, end: 40, caption: 'A JEPA encodes the visible context and the hidden target separately, then predicts the target’s embedding from the context’s. The loss is a distance between embeddings.', draw: drawE3 },
       { start: 40, end: 52, caption: 'There is a cheap way to make embeddings predictable: map every input to the same vector. The loss reaches zero and the representation is useless. This is collapse.', draw: drawE3 },
       { start: 52, end: 66, caption: 'I-JEPA and V-JEPA prevent collapse with a target encoder that is a slowly updated copy, with no gradient through it. LeJEPA and LeWorldModel instead add a regulariser that keeps embeddings spread out like a Gaussian.', draw: drawE3 },
       { start: 66, end: 80, caption: 'V-JEPA 2-AC adds actions. To plan, it searches for actions whose predicted embedding lands closest to the embedding of a goal image.', draw: drawE3 },
       { start: 80, end: 90, caption: 'Shown so far: useful representations and planning without pixel prediction. Open: whether these models capture intuitive physics, and how they compare with generative world models.', draw: drawE3 }
      ]
     }),
     WM.p('The claim that a pixel loss wastes capacity can be tested directly. In the panel, each frame is a strip of 32 pixels. A striped belt slides steadily: that is the part an agent would care about, and it is fully predictable. Over it play broad leaf shadows whose strength changes randomly from frame to frame; only a quarter of their variance can be predicted from the previous frame. Two linear models with the same small latent are trained live on the same 240 frames. Model A must predict the next frame’s pixels from its latent. Model B must predict its own next latent, with a regulariser that keeps the latent from collapsing. Afterwards, both latents are tested on fresh frames: how much of the belt can be read back from them?'),
     buildJepa(),
     WM.callout('math', 'Why B finds the belt', '<p>For a linear encoder E and predictor P, model B minimises ‖P E x<sub>t</sub> − E x<sub>t+1</sub>‖² while the regulariser holds the covariance of E x near the identity. With the scale fixed, the loss is smallest for the directions of the input that are most predictable one step ahead, whatever their size. The belt is perfectly predictable and the leaves are mostly not, so B’s latent goes to the belt.</p><p>Model A’s squared pixel error weighs each direction by how much pixel variance it can explain. Large leaf shadows, even only partly predictable, explain more pixel variance than the belt, so A’s first latent numbers go to them. Remove the regulariser and B’s best move is E = 0: perfect prediction of nothing.</p>'),
     WM.callout('source', 'Published JEPA systems in one line each', '<p><b>I-JEPA</b> (2023): predict the representations of image blocks from one context block.<br><b>V-JEPA</b> (2024): the same for video, about 2 million videos, no pixel reconstruction.<br><b>V-JEPA 2-AC</b> (2025): built on V-JEPA 2 (1.2 billion parameters, pretrained on over a million hours of video), then post-trained as an action-conditioned model on under 62 hours of unlabelled robot video; zero-shot pick-and-place with image goals on Franka arms in two labs.<br><b>LeWorldModel</b> (2026): about 15 million parameters, trained end to end from pixels on one GPU.</p>')
    ),

    /* ---------------- 5 PREGNANCY ---------------- */
    WM.section({ id: 'pregnancy', kicker: '§5', title: 'Pregnancy corner' },
     WM.callout('pregnancy', 'Antenatal care as a latent world', '<p>An antenatal record is a sequence of sparse, noisy observations: blood pressure and weight at each visit, fundal height or ultrasound biometry, an occasional glucose test. A latent world model would compress each visit into a small state, carry that state forward between visits with its prior, and sharpen it with the posterior when a new measurement arrives. That is the RSSM’s structure, and it matches the rhythm of care.</p><p>A JEPA-style objective would ask the model to predict a summary of the next visit, not every raw number. That matters because cuff readings taken minutes apart at the same visit can differ by several mmHg, and a loss that chases those wiggles spends capacity on them. Learning a treatment policy inside such a model would invite the exploitation seen in §2: an optimiser finds the model’s errors, and in clinical data those errors concentrate where a treatment was rarely given. Module 6 takes these points further.</p><p>The figure uses a Kalman filter, the linear-Gaussian relative of an RSSM, on synthetic systolic pressures. All numbers are invented for illustration.</p>'),
     buildPreg()
    ),

    WM.takeaways([
     'World models usually predict in a learned <b>latent space</b> that is far smaller than the observation. A VAE makes that space compact and gap-free, which matters once the model generates its own latents.',
     'Ha and Schmidhuber’s <b>V–M–C</b> agent compressed frames with a VAE, predicted codes with a mixture-density RNN, and acted with an 867-parameter controller. In VizDoom the controller was trained entirely inside M’s dream.',
     'An agent trained in imagination <b>optimises the model, flaws included</b>. Dream score is not real score until reality has been checked.',
     'The <b>RSSM</b> (PlaNet, Dreamer) splits the latent into deterministic memory and a stochastic state, with a posterior when observations arrive and a prior for imagining. PlaNet plans online; Dreamer learns an actor and critic in imagination.',
     '<b>JEPA</b> predicts embeddings instead of pixels, so capacity goes to what is predictable rather than to large irrelevant detail. It needs an explicit defence against <b>collapse</b>.'
    ]),
    WM.quiz({
     id: 'q4', title: 'Check your understanding', questions: [
      { q: 'Why do most world models for images predict in a latent space?',
       options: ['Pixels cannot be predicted by neural networks', 'A small learned code keeps what matters for prediction, so dynamics are cheaper to learn and roll out', 'The latent dimensions are guaranteed to be physical variables such as speed', 'It removes all uncertainty from the prediction'], answer: 1,
       why: 'Compression makes each prediction step cheap and focuses the model on the main factors of variation. The latent axes are whatever training found useful; they are not guaranteed to be physical variables, and uncertainty remains.' },
      { q: 'In the latent explorer, a point between training codes decodes to a faint, doubled blob. Which change most directly addresses this?',
       options: ['Train the plain autoencoder for longer', 'Use a VAE, whose KL penalty packs codes into one compact region without gaps', 'Give the decoder more output pixels', 'Use a larger learning rate'], answer: 1,
       why: 'The decoder was never trained on points far from any code. The VAE’s sampling and KL term make the region around and between codes meaningful, so points there decode sensibly.' },
      { q: 'In Ha and Schmidhuber (2018), what was trained entirely inside the dream?',
       options: ['V, the VAE, in both tasks', 'The controller C in CarRacing', 'The controller C in VizDoom Take Cover', 'M, the recurrent model, in both tasks'], answer: 2,
       why: 'V and M were trained on recorded real frames. In CarRacing, C was evolved in the real environment. Only in VizDoom Take Cover was C trained inside M’s dream and then deployed in the real game.' },
      { q: 'In the toy dream, the controller trained at τ = 0.1 scores near 100 in the dream and about 12 in reality. What happened?',
       options: ['The dream was too noisy for evolution to work', 'At low temperature the model almost never samples the rare rising threat, so the dream has no attacks and cover never pays', 'The real game changed after training', 'Evolution strategies cannot train controllers'], answer: 1,
       why: 'Low temperature pushes sampling toward the most likely branch, which is “settle”. The dream loses its dangerous events, and the controller is optimised for a world that does not exist.' },
      { q: 'When Dreamer imagines a trajectory, where does z come from at each step?',
       options: ['The posterior q(z | h, x), using the next real frame', 'The prior p(z | h), since there is no frame to look at', 'A replay buffer of real latents', 'A fixed standard normal, independent of h'], answer: 1,
       why: 'Imagination has no observations, so only the prior is available. The KL term in training is what makes the prior a good stand-in for the posterior.' },
      { q: 'Model B in the panel predicts its own next embedding. If the regulariser is removed, what is the cheapest way for it to reach zero loss?',
       options: ['Learn the belt perfectly', 'Learn the leaf shadows', 'Map every frame to the same embedding', 'Copy the input pixels into the latent'], answer: 2,
       why: 'A constant embedding is perfectly predictable and carries no information. This is collapse; I-JEPA and V-JEPA avoid it with a slowly updated target encoder, LeJEPA and LeWorldModel with a distribution regulariser.' }
     ]
    }),
    WM.goDeeper([
     { title: 'Ha and Schmidhuber (2018), World Models', url: 'https://arxiv.org/abs/1803.10122', note: 'The V–M–C agent, the dream experiment and the temperature result.' },
     { title: 'Hafner et al., Learning Latent Dynamics for Planning from Pixels (PlaNet)', url: 'https://arxiv.org/abs/1811.04551v5', note: 'The RSSM and online planning in latent space.' },
     { title: 'Hafner et al., Dream to Control (Dreamer)', url: 'https://arxiv.org/pdf/1912.01603', note: 'Actor-critic learning purely in latent imagination.' },
     { title: 'DreamerV3 project page', url: 'https://danijar.com/project/dreamerv3/', note: 'One configuration across domains; links to the 2025 <i>Nature</i> paper.' },
     { title: 'Hafner, Yan and Lillicrap (2025), Training Agents Inside of Scalable World Models', url: 'https://arxiv.org/abs/2509.24527', note: 'Dreamer 4: offline training inside a video world model.' },
     { title: 'Assran et al. (2023), I-JEPA', url: 'https://openaccess.thecvf.com/content/CVPR2023/html/Assran_Self-Supervised_Learning_From_Images_With_a_Joint-Embedding_Predictive_Architecture_CVPR_2023_paper.html', note: 'Predicting representations of image blocks.' },
     { title: 'V-JEPA 2 and V-JEPA 2-AC (2025)', url: 'https://arxiv.org/abs/2506.09985', note: 'Video pretraining plus action-conditioned planning on robots.' },
     { title: 'Maes et al. (2026), LeWorldModel', url: 'https://arxiv.org/abs/2603.19312', note: 'A small JEPA world model trained end to end from pixels.' }
    ])
   );
  }
 });
})();
