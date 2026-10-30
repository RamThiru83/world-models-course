/* ==========================================================================
   Module 5: State of the art, 2026
   Audience: researchers and practitioners.
   Fact base: _research/sota.md (compiled 29 Oct 2026). Every number in the
   comparison explorer is taken from that file; undisclosed figures are
   stated as undisclosed. Pregnancy examples are illustrative only.
   ========================================================================== */
(function () {
  'use strict';
  var WM = window.WM, D = WM.draw, h = WM.h;
  var MINUS = '−';

  /* ====================================================================
     0. SHARED HELPERS
     ==================================================================== */
  function T(g, s, x, y, o) { o = o || {}; if (o.size == null) o.size = 22; if (o.baseline == null) o.baseline = 'middle'; return D.text(g, s, x, y, o); }
  function head(g, s) { T(g, s, 40, 40, { size: 30, weight: 700, font: 'display' }); }
  function fade(g, a, fn) { if (a > 0) D.withAlpha(g, a, fn); }
  function pick(t, cuts) { var i = 0; while (i < cuts.length && t >= cuts[i]) i++; return i; }
  function notice(label) {
    var r = WM.readout(label || 'What you should notice', '');
    var v = r.el.querySelector('.wm-readout__val');
    v.style.fontFamily = 'var(--font-body)'; v.style.fontSize = '1rem'; v.style.lineHeight = '1.45';
    v.setAttribute('aria-live', 'polite');
    r.el.style.flexBasis = '100%';
    return r;
  }
  /* a stylised scene: table, block, ball; bx = ball position 0..1 */
  function scene(g, c, x, y, w, hh, bx, o) {
    o = o || {};
    D.box(g, x, y, w, hh, { fill: c.surface, stroke: o.dash ? c.imagined : c.ink, lw: o.dash ? 3 : 2, dash: !!o.dash });
    var ty = y + hh * 0.74, r = hh * 0.1;
    D.line(g, x + 14, ty, x + w - 14, ty, { color: c.ink2, lw: 2 });
    var bw = w * 0.17;
    D.box(g, x + w * 0.7, ty - bw, bw, bw, { fill: c.faint, stroke: c.ink2, lw: 2 });
    var px = x + w * (0.2 + bx * 0.38);
    D.dot(g, px, ty - r, r, { fill: o.dash ? c.imagined : c.ink });
    if (o.push) D.arrow(g, x + w * 0.05, ty - r, x + w * 0.15, ty - r, { color: c.accent2, lw: 3, head: 11 });
    if (o.label) T(g, o.label, x + w / 2, y + hh + 22, { size: 19, align: 'center', color: o.dash ? c.imagined : c.muted, font: 'mono' });
  }
  /* embedding bars; seed makes them deterministic */
  function bars(g, c, x, y, n, bh, seed, color, dash, prog) {
    var r = WM.rng(seed), bw = 14, gap = 5;
    prog = prog == null ? 1 : prog;
    for (var i = 0; i < n; i++) {
      var v = 0.25 + 0.75 * r();
      if (i / n > prog) break;
      var hh = bh * v;
      if (dash) D.box(g, x + i * (bw + gap), y + bh - hh, bw, hh, { stroke: color, lw: 2, dash: [4, 3] });
      else D.box(g, x + i * (bw + gap), y + bh - hh, bw, hh, { fill: color, stroke: false });
    }
    D.line(g, x - 4, y + bh, x + n * (bw + gap), y + bh, { color: c.line, lw: 1 });
  }
  function block(g, c, x, y, w, hh, title, sub, o) {
    o = o || {};
    D.box(g, x, y, w, hh, { r: 4, fill: o.fill || c.surface, stroke: o.stroke || c.ink, lw: 2, dash: !!o.dash });
    T(g, title, x + w / 2, y + hh / 2 - (sub ? 11 : 0), { align: 'center', size: o.size || 21, weight: 700, color: o.color });
    if (sub) T(g, sub, x + w / 2, y + hh / 2 + 15, { align: 'center', size: 17, color: c.muted });
  }

  /* ====================================================================
     1. EXPLAINER 1: THREE THINGS A WORLD MODEL CAN PREDICT (90 s)
     Script
     S1 0-15   One situation (ball, block, push action). What comes next?
     S2 15-30  Pixel family: generator renders the whole next frame.
     S3 30-45  Latent family: encoder, action-conditioned predictor, no decoder needed.
     S4 45-60  Value-equivalent: MuZero predicts reward, value, policy only.
     S5 60-75  Side by side: what each predicts, what it costs, how to check it.
     S6 75-90  A fourth output (explicit 3D) and the map of families.
     ==================================================================== */
  function drawE1(g, p, env) {
    var t = env.t, c = env.c;
    var heads = ['One situation, what comes next?', 'Predict pixels', 'Predict a latent', 'Predict only what planning needs', 'Three outputs, three ways to check', 'The map of families'];
    head(g, heads[pick(t, [15, 30, 45, 60, 75])]);
    if (t < 15) {
      scene(g, c, 60, 110, 300, 220, 0, { push: t > 3, label: 'frame at time t' });
      fade(g, D.seg(t, 3, 5), function () { T(g, 'action: push', 110, 90, { color: c.accent2, font: 'mono', size: 20 }); });
      fade(g, D.seg(t, 6, 8), function () {
        D.arrow(g, 390, 220, 560, 220, { color: c.ink2, lw: 3 });
        D.box(g, 600, 110, 300, 220, { stroke: c.imagined, lw: 3, dash: true });
        T(g, '?', 750, 220, { align: 'center', size: 72, weight: 700, color: c.imagined, font: 'display' });
        T(g, 'time t + 1', 750, 352, { size: 19, align: 'center', color: c.imagined, font: 'mono' });
      });
      fade(g, D.seg(t, 9, 11), function () { T(g, 'Every world model answers this question. They differ in what the answer is made of.', 60, 440, { maxWidth: 840, color: c.ink2 }); });
    } else if (t < 30) {
      var a = D.seg(t, 16, 18), b = D.seg(t, 19, 21), d = D.seg(t, 23, 25);
      scene(g, c, 40, 110, 240, 180, 0, { push: true, label: 'frame t + action' });
      fade(g, a, function () {
        D.arrow(g, 290, 200, 350, 200, { color: c.ink2, lw: 3 });
        block(g, c, 360, 150, 220, 100, 'generator', 'diffusion or token model');
      });
      fade(g, b, function () {
        D.arrow(g, 590, 200, 650, 200, { color: c.imagined, lw: 3, dash: true });
        scene(g, c, 660, 110, 240, 180, 0.85, { dash: true, label: 'predicted frame t + 1' });
      });
      fade(g, d, function () {
        T(g, 'Genie, Cosmos, GAIA, Waymo World Model, Runway GWM-1', 40, 380, { size: 21, weight: 600 });
        T(g, 'Every pixel is predicted, including grain and shadows that do not matter for the push. A human can watch the result and judge it.', 40, 430, { maxWidth: 860, color: c.ink2 });
      });
    } else if (t < 45) {
      var e1 = D.seg(t, 31, 33), e2 = D.seg(t, 34, 36), e3 = D.seg(t, 38, 40);
      scene(g, c, 40, 110, 200, 150, 0, { push: true, label: 'frame t' });
      fade(g, e1, function () {
        D.arrow(g, 250, 185, 300, 185, { color: c.ink2, lw: 3 });
        block(g, c, 306, 150, 130, 70, 'encoder', null, { size: 19 });
        D.arrow(g, 440, 185, 480, 185, { color: c.ink2, lw: 3 });
        bars(g, c, 490, 130, 8, 110, 11, c.ink, false);
        T(g, 'sₜ', 560, 262, { font: 'mono', align: 'center', size: 20 });
      });
      fade(g, e2, function () {
        D.arrow(g, 650, 185, 700, 185, { color: c.ink2, lw: 3 });
        block(g, c, 706, 150, 150, 70, 'predictor', null, { size: 19 });
        T(g, 'action', 781, 120, { color: c.accent2, font: 'mono', size: 19, align: 'center' });
        D.arrow(g, 781, 132, 781, 148, { color: c.accent2, lw: 2.5, head: 9 });
        D.arrow(g, 781, 222, 781, 262, { color: c.imagined, lw: 3, dash: true });
        bars(g, c, 720, 280, 8, 110, 12, c.imagined, true);
        T(g, 'ŝₜ₊₁', 790, 412, { font: 'mono', align: 'center', size: 20, color: c.imagined });
      });
      fade(g, e3, function () {
        T(g, 'JEPA, Dreamer, PlaNet', 40, 322, { size: 21, weight: 600 });
        T(g, 'The prediction is a vector, not a picture. Dreamer also learns a decoder for training; JEPA never reconstructs pixels. Nobody can look at ŝ directly, so it is checked by probing it or by planning with it.', 40, 350, { maxWidth: 620, color: c.ink2, lineHeight: 1.3, baseline: 'top' });
      });
    } else if (t < 60) {
      var f1 = D.seg(t, 46, 48), f2 = D.seg(t, 49, 51), f3 = D.seg(t, 53, 55);
      scene(g, c, 40, 110, 200, 150, 0, { push: true, label: 'observation' });
      fade(g, f1, function () {
        D.arrow(g, 250, 185, 300, 185, { color: c.ink2, lw: 3 });
        block(g, c, 306, 150, 170, 70, 'hidden state', 'any shape', { size: 19 });
        D.arrow(g, 486, 185, 536, 185, { color: c.ink2, lw: 3 });
        block(g, c, 542, 150, 150, 70, 'dynamics', '+ action', { size: 19 });
      });
      fade(g, f2, function () {
        ['reward r', 'value v', 'policy π'].forEach(function (s, i) {
          var yy = 120 + i * 60;
          D.arrow(g, 700, 185, 760, yy + 14, { color: c.imagined, lw: 2.5, dash: true, head: 9 });
          D.box(g, 770, yy, 150, 40, { stroke: c.imagined, lw: 2, dash: true, r: 3 });
          T(g, s, 845, yy + 20, { align: 'center', font: 'mono', size: 19, color: c.imagined });
        });
      });
      fade(g, f3, function () {
        T(g, 'MuZero, EfficientZero', 40, 330, { size: 21, weight: 600 });
        T(g, 'No observation is predicted at all. The hidden state is not asked to resemble the real state; it only has to make reward, value and policy come out right. That is enough for tree search, and it matched AlphaZero without being told the rules.', 40, 395, { maxWidth: 860, color: c.ink2, lineHeight: 1.3 });
      });
    } else if (t < 75) {
      var cols = [
        ['Pixels', 'next frame', 'high: every pixel', 'watch it; let a person play in it', c.ink],
        ['Latent', 'next embedding', 'low: a vector', 'probe it; plan with it; test the plan', c.imagined],
        ['Value', 'r, v, π only', 'lowest', 'play; compare scores', c.accent2]
      ];
      cols.forEach(function (col, i) {
        var x = 50 + i * 300, on = D.seg(t, 61 + i * 2.5, 62.5 + i * 2.5);
        fade(g, on, function () {
          D.box(g, x, 95, 270, 360, { r: 4, fill: c.surface, stroke: c.line, lw: 1 });
          T(g, col[0], x + 20, 128, { size: 26, weight: 700, font: 'display', color: col[4] });
          T(g, 'predicts', x + 20, 180, { size: 17, color: c.muted, font: 'mono' });
          T(g, col[1], x + 20, 208, { size: 21, maxWidth: 230 });
          T(g, 'cost per step', x + 20, 262, { size: 17, color: c.muted, font: 'mono' });
          T(g, col[2], x + 20, 290, { size: 21, maxWidth: 230 });
          T(g, 'how to check', x + 20, 344, { size: 17, color: c.muted, font: 'mono' });
          T(g, col[3], x + 20, 384, { size: 20, maxWidth: 236, lineHeight: 1.25, baseline: 'top' });
        });
      });
      fade(g, D.seg(t, 70, 72), function () { T(g, 'Realism is easy to judge and physics is not. Keep the two apart.', 480, 500, { align: 'center', color: c.ink2, size: 21 }); });
    } else {
      var fams = [
        ['A', 'Latent-dynamics RL agents', 'Dreamer line, MuZero lineage'],
        ['B', 'Predictive representations', 'I-JEPA, V-JEPA 2, LeWorldModel'],
        ['C', 'Generative and interactive', 'Genie 1 to 4, Cosmos, driving models'],
        ['D', 'LLMs and VLMs as implicit models', 'Othello-GPT, Code World Model, the debate']
      ];
      fams.forEach(function (f, i) {
        var y = 95 + i * 86, on = D.seg(t, 76 + i * 1.8, 77 + i * 1.8);
        fade(g, on, function () {
          D.box(g, 50, y, 860, 70, { r: 4, fill: c.surface, stroke: c.line, lw: 1 });
          T(g, f[0], 85, y + 35, { size: 30, weight: 700, font: 'display', align: 'center', color: c.imagined });
          T(g, f[1], 130, y + 24, { size: 22, weight: 700 });
          T(g, f[2], 130, y + 52, { size: 18, color: c.muted });
        });
      });
      fade(g, D.seg(t, 84, 86), function () { T(g, 'Explicit 3D output (World Labs Marble and Atlas, Tencent HY-World) sits inside C. The sections below take the families in turn.', 50, 470, { maxWidth: 860, color: c.ink2, size: 20 }); });
    }
  }

  /* ====================================================================
     2. EXPLAINER 2: PLANNING IN EMBEDDING SPACE (V-JEPA 2-AC) (96 s)
     S1 0-16   Pretraining: masked video, predict embeddings, no actions, 1M+ hours.
     S2 16-32  Post-training: <62 h robot video with actions; action-conditioned predictor.
     S3 32-48  A goal image becomes a goal embedding; the current frame a start point.
     S4 48-64  Sample action sequences; roll the predictor; distance to goal.
     S5 64-80  Execute the first action of the best plan, observe, re-plan.
     S6 80-96  Result and caveats.
     ==================================================================== */
  var E2 = (function () {
    var r = WM.rng('e2'), cands = [];
    for (var i = 0; i < 9; i++) {
      var pts = [[0, 0]], ang = -1.3 + r() * 1.5, x = 0, y = 0;
      for (var k = 0; k < 5; k++) { ang += (r() - 0.5) * 0.9; x += Math.cos(ang) * 38; y += Math.sin(ang) * 38; pts.push([x, y]); }
      cands.push(pts);
    }
    return cands;
  })();
  function embedMap(g, c, x, y, w, hh, title) {
    D.box(g, x, y, w, hh, { fill: c.surface, stroke: c.line, lw: 1 });
    D.grid(g, x, y, w, hh, 8, 6, { color: c.faint });
    T(g, title, x, y - 18, { size: 18, font: 'mono', color: c.muted });
  }
  function drawE2(g, p, env) {
    var t = env.t, c = env.c, i, k;
    var heads = ['Step 1: learn to predict embeddings from video', 'Step 2: add actions with a little robot data', 'A goal is a point in embedding space', 'Imagine many action sequences', 'Act, observe, re-plan', 'What it achieved, and what it did not'];
    head(g, heads[pick(t, [16, 32, 48, 64, 80])]);
    if (t < 16) {
      var a = D.seg(t, 1, 3), b = D.seg(t, 4, 6), d = D.seg(t, 7, 9), e = D.seg(t, 10, 12);
      for (i = 0; i < 5; i++) {
        var fx = 50 + i * 100;
        D.box(g, fx, 110, 88, 66, { fill: c.surface, stroke: c.ink, lw: 2 });
        D.dot(g, fx + 30 + i * 8, 150, 9, { fill: c.ink });
        D.line(g, fx + 8, 162, fx + 80, 162, { color: c.ink2, lw: 2 });
      }
      T(g, 'video clip', 50, 196, { size: 18, font: 'mono', color: c.muted });
      fade(g, a, function () {
        for (i = 2; i < 5; i++) { D.box(g, 50 + i * 100 + 30, 118, 50, 50, { fill: c.faint, stroke: c.muted, lw: 1.5, dash: [4, 3] }); }
        T(g, 'masked', 350, 196, { size: 18, font: 'mono', color: c.muted });
      });
      fade(g, b, function () {
        D.arrow(g, 290, 215, 290, 255, { color: c.ink2, lw: 3 });
        block(g, c, 60, 260, 460, 60, 'encoder (vision transformer)', null, { size: 20 });
        D.arrow(g, 290, 322, 290, 358, { color: c.ink2, lw: 3 });
        bars(g, c, 60, 370, 12, 90, 21, c.ink, false);
        T(g, 'context embeddings', 60, 486, { size: 18, font: 'mono', color: c.muted });
      });
      fade(g, d, function () {
        D.arrow(g, 320, 420, 560, 420, { color: c.ink2, lw: 3 });
        block(g, c, 570, 390, 160, 60, 'predictor', null, { size: 20 });
        D.arrow(g, 732, 420, 760, 420, { color: c.imagined, lw: 3, dash: true });
        bars(g, c, 770, 370, 8, 90, 22, c.imagined, true);
        T(g, 'predicted embeddings of the masked part', 600, 486, { size: 17, font: 'mono', color: c.imagined, maxWidth: 330 });
      });
      fade(g, e, function () {
        D.box(g, 590, 100, 320, 130, { r: 4, fill: c.surface, stroke: c.line, lw: 1 });
        T(g, 'V-JEPA 2 pretraining', 610, 128, { size: 20, weight: 700 });
        T(g, 'over 1M hours of internet video', 610, 160, { size: 18, color: c.ink2 });
        T(g, 'no actions, no pixels reconstructed', 610, 188, { size: 18, color: c.ink2 });
        T(g, '1.2B parameters', 610, 214, { size: 18, color: c.ink2 });
      });
    } else if (t < 32) {
      var a2 = D.seg(t, 17, 19), b2 = D.seg(t, 20, 22), d2 = D.seg(t, 24, 26);
      block(g, c, 50, 110, 220, 70, 'frozen encoder', 'from step 1', { size: 20 });
      fade(g, a2, function () {
        D.arrow(g, 160, 182, 160, 230, { color: c.ink2, lw: 3 });
        bars(g, c, 60, 240, 10, 90, 31, c.ink, false);
        T(g, 'sₜ', 150, 352, { font: 'mono', size: 20, align: 'center' });
        D.arrow(g, 260, 285, 330, 285, { color: c.ink2, lw: 3 });
        block(g, c, 340, 250, 240, 70, 'action-conditioned', 'predictor', { size: 20 });
        T(g, 'aₜ  (arm motion)', 460, 215, { color: c.accent2, font: 'mono', size: 19, align: 'center' });
        D.arrow(g, 460, 228, 460, 248, { color: c.accent2, lw: 2.5, head: 9 });
        D.arrow(g, 582, 285, 650, 285, { color: c.imagined, lw: 3, dash: true });
        bars(g, c, 660, 240, 10, 90, 32, c.imagined, true);
        T(g, 'ŝₜ₊₁', 750, 352, { font: 'mono', size: 20, align: 'center', color: c.imagined });
      });
      fade(g, b2, function () {
        T(g, 'Loss: distance between ŝₜ₊₁ and the encoder’s real sₜ₊₁', 50, 400, { size: 20, color: c.ink2 });
      });
      fade(g, d2, function () {
        D.box(g, 50, 430, 860, 70, { r: 4, fill: c.surface, stroke: c.line, lw: 1 });
        T(g, 'Post-trained on fewer than 62 hours of unlabeled DROID robot video. The encoder stays fixed; only the predictor learns what actions do.', 70, 465, { size: 19, maxWidth: 820, color: c.ink2 });
      });
    } else if (t < 48) {
      var a3 = D.seg(t, 33, 35), b3 = D.seg(t, 37, 39), d3 = D.seg(t, 41, 43);
      embedMap(g, c, 420, 120, 490, 340, 'embedding space (2 of many dimensions)');
      scene(g, c, 50, 300, 200, 140, 0.05, { label: 'current frame' });
      fade(g, a3, function () {
        D.arrow(g, 260, 370, 420 + 0.2 * 490, 120 + 0.65 * 340, { color: c.ink2, lw: 2 });
        D.dot(g, 420 + 0.2 * 490, 120 + 0.65 * 340, 9, { fill: c.ink });
        T(g, 'sₜ', 420 + 0.2 * 490 - 22, 120 + 0.65 * 340 + 2, { font: 'mono', size: 20, align: 'right' });
      });
      fade(g, b3, function () {
        scene(g, c, 50, 110, 200, 140, 0.9, { label: 'goal image' });
        var gx = 420 + 0.78 * 490, gy = 120 + 0.28 * 340;
        D.arrow(g, 260, 180, gx - 14, gy - 8, { color: c.ink2, lw: 2 });
        star(g, gx, gy, 14, c.good);
        T(g, 's_goal', gx + 22, gy, { font: 'mono', size: 20, color: c.good });
      });
      fade(g, d3, function () { T(g, 'No reward function is written. The task is “make the embedding of what you see close to the embedding of the goal image”.', 50, 486, { maxWidth: 860, color: c.ink2, size: 19, baseline: 'top' }); });
    } else if (t < 64) {
      embedMap(g, c, 420, 120, 490, 340, 'embedding space');
      var sx = 420 + 0.2 * 490, sy = 120 + 0.65 * 340, gx2 = 420 + 0.78 * 490, gy2 = 120 + 0.28 * 340;
      D.dot(g, sx, sy, 9, { fill: c.ink }); star(g, gx2, gy2, 14, c.good);
      var best = 0, bd = 1e9;
      for (i = 0; i < E2.length; i++) { var q = E2[i][5]; var dd = Math.hypot(sx + q[0] - gx2, sy + q[1] - gy2); if (dd < bd) { bd = dd; best = i; } }
      g.save(); g.beginPath(); g.rect(420, 120, 490, 340); g.clip();
      for (i = 0; i < E2.length; i++) {
        var on = D.seg(t, 49 + i * 0.7, 50.5 + i * 0.7);
        if (on <= 0) continue;
        var pts = E2[i].map(function (q) { return [sx + q[0], sy + q[1]]; });
        var isBest = i === best && t > 58;
        D.poly(g, pts, { color: c.imagined, lw: isBest ? 4 : 2, dash: true, alpha: isBest ? 1 : 0.55, progress: on });
        if (on >= 1 && t > 56) { var e2 = pts[5]; D.line(g, e2[0], e2[1], gx2, gy2, { color: isBest ? c.good : c.muted, lw: 1, dash: [2, 4], alpha: 0.7 }); }
      }
      g.restore();
      T(g, 'Each dashed path is one candidate action sequence, rolled forward by the predictor. Nothing is rendered.', 50, 140, { maxWidth: 340, size: 20, color: c.ink2, lineHeight: 1.3 });
      fade(g, D.seg(t, 56, 58), function () { T(g, 'Score = distance of the end point to the goal embedding.', 50, 300, { maxWidth: 340, size: 20, color: c.ink2, lineHeight: 1.3 }); });
      fade(g, D.seg(t, 58, 60), function () { T(g, 'The search (cross-entropy method) keeps the best sequences and resamples around them.', 50, 420, { maxWidth: 340, size: 20, color: c.ink2, lineHeight: 1.3 }); });
    } else if (t < 80) {
      embedMap(g, c, 420, 120, 490, 340, 'embedding space');
      var sx2 = 420 + 0.2 * 490, sy2 = 120 + 0.65 * 340, gx3 = 420 + 0.78 * 490, gy3 = 120 + 0.28 * 340;
      star(g, gx3, gy3, 14, c.good);
      var plan = E2[2].map(function (q) { return [sx2 + q[0], sy2 + q[1]]; });
      var real = [[sx2, sy2], [sx2 + E2[2][1][0] + 26, sy2 + E2[2][1][1] + 22]];
      D.poly(g, plan, { color: c.imagined, lw: 3, dash: true, alpha: 0.8 });
      D.dot(g, sx2, sy2, 9, { fill: c.ink });
      fade(g, D.seg(t, 65, 67), function () { D.arrow(g, real[0][0], real[0][1], real[1][0], real[1][1], { color: c.ink, lw: 4 }); T(g, 'first action, for real', real[0][0] - 10, real[0][1] + 34, { size: 18, font: 'mono' }); });
      fade(g, D.seg(t, 69, 71), function () {
        D.dot(g, real[1][0], real[1][1], 9, { fill: c.ink });
        D.line(g, plan[1][0], plan[1][1], real[1][0], real[1][1], { color: c.error, lw: 2 });
        T(g, 'imagined vs observed', real[1][0] + 14, real[1][1] + 62, { size: 17, color: c.error });
      });
      fade(g, D.seg(t, 73, 75), function () {
        var pts2 = E2[6].map(function (q) { return [real[1][0] + q[0] * 0.8, real[1][1] + q[1] * 0.8]; });
        D.poly(g, pts2, { color: c.imagined, lw: 3, dash: true });
        T(g, 're-plan from the new embedding', 896, 436, { size: 17, color: c.imagined, align: 'right' });
      });
      T(g, 'Receding-horizon control: imagine, take one step, look again. Errors in the model are corrected by the next observation rather than compounding.', 50, 160, { maxWidth: 340, size: 20, color: c.ink2, lineHeight: 1.3 });
      fade(g, D.seg(t, 76, 78), function () { T(g, 'Real latent trajectory: solid. Imagined: dashed.', 50, 340, { maxWidth: 340, size: 19, color: c.muted }); });
    } else {
      var rows = [
        ['Zero-shot on Franka arms in two labs', 'reach, grasp, pick-and-place of new objects', c.good],
        ['65 to 80% success on pick-and-place', 'unseen environments (Meta blog, Jun 2025)', c.good],
        ['V-JEPA 2.1 (Mar 2026)', 'about +20 points real-robot grasp success over V-JEPA 2-AC', c.good],
        ['IntPhys 2: close to chance', 'V-JEPA 2 best of the models tested, yet below 60% (chance 50%); humans about 96%', c.error],
        ['Goals must be images', 'paper lists image-only goals, sensitivity to camera position, and costly long-horizon planning', c.warn]
      ];
      rows.forEach(function (rw, i) {
        var y = 100 + i * 78, on = D.seg(t, 81 + i * 1.6, 82 + i * 1.6);
        fade(g, on, function () {
          D.box(g, 50, y, 860, 64, { r: 4, fill: c.surface, stroke: c.line, lw: 1 });
          D.dot(g, 78, y + 32, 9, { fill: rw[2] });
          T(g, rw[0], 104, y + 22, { size: 21, weight: 700 });
          T(g, rw[1], 104, y + 48, { size: 18, color: c.muted });
        });
      });
      fade(g, D.seg(t, 90, 92), function () { T(g, 'Green: reported result. Red: known gap. Amber: scope limit.', 480, 508, { size: 18, align: 'center', color: c.muted }); });
    }
  }
  function star(g, x, y, r, color) {
    g.save(); g.fillStyle = color; g.beginPath();
    for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill(); g.restore();
  }

  /* ====================================================================
     3. EXPLAINER 3: NEXT-TOKEN ACCURACY IS NOT A COHERENT MAP (84 s)
     Vafa et al. 2024 (arXiv 2406.03689) and Othello-GPT (Li et al. 2023).
     S1 0-14   A grid city; training data are turn-by-turn routes.
     S2 14-28  Next-token accuracy near 100%: looks like the map is learned.
     S3 28-42  Reconstruct the map the model implies: impossible streets appear.
     S4 42-56  Detours: performance collapses when routes leave the familiar.
     S5 56-70  Contrast: Othello-GPT, where a probe recovers the board and interventions work.
     S6 70-84  Lesson: test the implied world model with structure-aware tests.
     ==================================================================== */
  var E3 = (function () {
    var r = WM.rng('e3'), bad = [];
    /* impossible edges: diagonals and long jumps on a 5x5 grid */
    var cand = [[[0, 0], [1, 1]], [[2, 1], [3, 2]], [[1, 3], [2, 4]], [[0, 2], [2, 2]], [[3, 0], [4, 1]], [[4, 3], [2, 4]], [[1, 1], [1, 3]], [[3, 3], [4, 4]]];
    cand.forEach(function (e) { bad.push({ e: e, r: r() }); });
    return { bad: bad, route: [[0, 4], [1, 4], [1, 3], [2, 3], [3, 3], [3, 2], [4, 2]] };
  })();
  function city(g, c, x, y, cell, o) {
    o = o || {};
    for (var i = 0; i < 5; i++) {
      D.line(g, x + i * cell, y, x + i * cell, y + 4 * cell, { color: c.line, lw: 3 });
      D.line(g, x, y + i * cell, x + 4 * cell, y + i * cell, { color: c.line, lw: 3 });
    }
    for (var j = 0; j < 5; j++) for (var k = 0; k < 5; k++) D.dot(g, x + j * cell, y + k * cell, 5, { fill: c.muted });
  }
  function drawE3(g, p, env) {
    var t = env.t, c = env.c, i;
    var heads = ['A city and a model trained on routes', 'It predicts the next turn almost perfectly', 'But the map it implies is incoherent', 'Leave the familiar and it collapses', 'Contrast: Othello-GPT', 'Test the world model, not the next token'];
    head(g, heads[pick(t, [14, 28, 42, 56, 70])]);
    var cx = 70, cy = 110, cell = 85;
    var P = function (q) { return [cx + q[0] * cell, cy + q[1] * cell]; };
    if (t < 14) {
      city(g, c, cx, cy, cell);
      fade(g, D.seg(t, 2, 4), function () {
        D.poly(g, E3.route.map(P), { color: c.ink, lw: 4, progress: D.seg(t, 2, 6) });
        D.dot(g, P(E3.route[0])[0], P(E3.route[0])[1], 9, { fill: c.ink });
      });
      fade(g, D.seg(t, 6, 8), function () {
        T(g, 'Training data: millions of routes written as directions', 470, 130, { size: 20, weight: 600, maxWidth: 440 });
        T(g, 'start (0,4) → E → N → E → E → N → E', 470, 190, { font: 'mono', size: 19, color: c.ink2 });
        T(g, 'The model never sees the map. It sees only sequences of turns, the way a language model sees only text.', 470, 260, { maxWidth: 440, color: c.ink2, lineHeight: 1.3 });
      });
      fade(g, D.seg(t, 10, 12), function () { block(g, c, 470, 340, 440, 70, 'transformer', 'trained to predict the next turn', { size: 20 }); });
    } else if (t < 28) {
      city(g, c, cx, cy, cell);
      D.poly(g, E3.route.map(P), { color: c.ink, lw: 4, alpha: 0.35 });
      var toks = ['E', 'N', 'E', 'E', 'N', 'E'];
      toks.forEach(function (tk, k) {
        var on = D.seg(t, 15 + k * 1.3, 15.8 + k * 1.3);
        fade(g, on, function () {
          var x = 480 + k * 72;
          D.box(g, x, 150, 56, 56, { r: 4, fill: c.surface, stroke: c.imagined, lw: 2, dash: true });
          T(g, tk, x + 28, 178, { align: 'center', size: 26, font: 'mono', color: c.imagined });
          T(g, '✓', x + 28, 232, { align: 'center', size: 24, color: c.good });
        });
      });
      fade(g, D.seg(t, 23, 25), function () {
        T(g, 'Next-token accuracy: about 100%', 470, 300, { size: 24, weight: 700 });
        T(g, 'State probes: over 90% (Vafa et al. 2024, NYC taxi routes)', 470, 340, { size: 19, color: c.ink2, maxWidth: 440 });
        T(g, 'On these numbers, you would say it has learned the city.', 470, 410, { color: c.ink2, maxWidth: 440, lineHeight: 1.3 });
      });
    } else if (t < 42) {
      city(g, c, cx, cy, cell);
      E3.bad.forEach(function (b, k) {
        var on = D.seg(t, 29 + k * 1.1, 30 + k * 1.1);
        if (on <= 0) return;
        var a = P(b.e[0]), d = P(b.e[1]);
        if (Math.abs(b.e[0][0] - b.e[1][0]) === 2 || Math.abs(b.e[0][1] - b.e[1][1]) === 2) {
          var mx = (a[0] + d[0]) / 2, my = (a[1] + d[1]) / 2 - 38;
          D.curve(g, [a, [mx, my], d], { color: c.error, lw: 3, dash: true, progress: on });
        } else D.line(g, a[0], a[1], d[0], d[1], { color: c.error, lw: 3, dash: true });
      });
      fade(g, D.seg(t, 31, 33), function () {
        T(g, 'Ask the model which moves it believes are possible at each corner, and draw them.', 470, 140, { maxWidth: 440, color: c.ink2, lineHeight: 1.3 });
        T(g, 'Dashed red: streets that do not exist. Impossible orientations, and flyovers over whole blocks (stylised here).', 470, 230, { maxWidth: 440, color: c.error, lineHeight: 1.3 });
      });
      fade(g, D.seg(t, 37, 39), function () {
        T(g, 'The implied map is “far less coherent than it appears”. A model can be right about the next step along familiar routes while holding an impossible picture of the city.', 470, 340, { maxWidth: 440, color: c.ink2, lineHeight: 1.3 });
      });
    } else if (t < 56) {
      city(g, c, cx, cy, cell);
      D.poly(g, E3.route.map(P), { color: c.ink, lw: 4, alpha: 0.35 });
      fade(g, D.seg(t, 43, 45), function () {
        var det = [[1, 3], [1, 2], [2, 2], [2, 3]].map(P);
        D.poly(g, det, { color: c.accent2, lw: 4, progress: D.seg(t, 43, 47) });
        T(g, 'detour', det[1][0] - 12, det[1][1] - 24, { size: 18, color: c.accent2, font: 'mono' });
      });
      fade(g, D.seg(t, 47, 49), function () {
        var bx = 470, by = 150, bw = 420, bh = 60;
        T(g, 'share of valid routes', bx, by - 20, { size: 18, font: 'mono', color: c.muted });
        D.box(g, bx, by, bw, bh, { stroke: c.line, lw: 1 });
        D.box(g, bx, by, bw * 0.99, bh, { fill: c.ink, stroke: false });
        T(g, 'no detours: 99%', bx + 12, by + bh / 2, { size: 19, color: c.bg, weight: 600 });
        var w2 = bw * 0.08 * D.seg(t, 49, 51);
        D.box(g, bx, by + 90, bw, bh, { stroke: c.line, lw: 1 });
        D.box(g, bx, by + 90, w2, bh, { fill: c.error, stroke: false });
        fade(g, D.seg(t, 50, 51), function () { T(g, 'random detour, 10% chance per step: 8%', bx + w2 + 12, by + 90 + bh / 2, { size: 19, color: c.error, weight: 600 }); });
      });
      fade(g, D.seg(t, 52, 54), function () { T(g, 'A coherent map would let the model recover from any detour. Case-based memory of familiar sequences does not.', 470, 360, { maxWidth: 440, color: c.ink2, lineHeight: 1.3 }); });
    } else if (t < 70) {
      var bx2 = 70, by2 = 110, cs = 42;
      var r = WM.rng('oth');
      for (i = 0; i < 64; i++) {
        var xx = bx2 + (i % 8) * cs, yy = by2 + Math.floor(i / 8) * cs;
        D.box(g, xx, yy, cs, cs, { fill: c.surface, stroke: c.line, lw: 1 });
        var v = r();
        if (v < 0.3) D.dot(g, xx + cs / 2, yy + cs / 2, 14, { fill: c.ink });
        else if (v < 0.58) D.dot(g, xx + cs / 2, yy + cs / 2, 14, { fill: c.stage, stroke: c.ink, lw: 2 });
      }
      T(g, 'board recovered by a probe', bx2, by2 - 16, { size: 18, font: 'mono', color: c.muted });
      fade(g, D.seg(t, 57, 59), function () {
        T(g, 'Othello-GPT (Li et al., ICLR 2023) was trained only on move sequences.', 470, 110, { maxWidth: 440, color: c.ink2, lineHeight: 1.3, baseline: 'top' });
        T(g, 'A probe reads the board state out of its activations.', 470, 180, { maxWidth: 440, color: c.ink2, lineHeight: 1.3, baseline: 'top' });
      });
      fade(g, D.seg(t, 61, 63), function () {
        var fx = bx2 + 3 * cs, fy = by2 + 4 * cs;
        D.box(g, fx, fy, cs, cs, { stroke: c.imagined, lw: 3, dash: true });
        D.arrow(g, bx2 + 150, 498, fx + cs / 2 + 6, fy + cs + 6, { color: c.imagined, lw: 2.5 });
        T(g, 'flip one square inside the network', bx2, 512, { size: 17, color: c.imagined });
        T(g, 'Edit that internal board and the predicted legal moves change accordingly. That is causal evidence of a usable state representation, within one small game.', 470, 250, { maxWidth: 440, color: c.ink2, lineHeight: 1.3, baseline: 'top' });
      });
      fade(g, D.seg(t, 66, 68), function () { T(g, 'Both findings are true. The question is never “does it have a world model?” but “how coherent, and for which tasks?”', 470, 400, { maxWidth: 440, color: c.ink2, lineHeight: 1.3, baseline: 'top' }); });
    } else {
      var lines = [
        ['Next-token accuracy', 'necessary, not sufficient', c.warn],
        ['Probing', 'shows what is encoded, not whether it is coherent', c.warn],
        ['Intervention', 'edits inside the model should change behaviour as predicted', c.good],
        ['Structure tests', 'compression and distinction: are two histories that reach the same state treated the same?', c.good],
        ['Out-of-distribution routes', 'detours, perturbations, new starts', c.good]
      ];
      lines.forEach(function (l, k) {
        var y = 100 + k * 76, on = D.seg(t, 71 + k * 1.5, 72 + k * 1.5);
        fade(g, on, function () {
          D.box(g, 50, y, 860, 62, { r: 4, fill: c.surface, stroke: c.line, lw: 1 });
          D.dot(g, 78, y + 31, 9, { fill: l[2] });
          T(g, l[0], 104, y + 20, { size: 21, weight: 700 });
          T(g, l[1], 104, y + 46, { size: 17, color: c.muted, maxWidth: 780 });
        });
      });
      fade(g, D.seg(t, 80, 82), function () { T(g, 'The defensible position in 2026: LLMs hold partial, fragile, task-dependent world models.', 480, 505, { size: 20, align: 'center', color: c.ink2 }); });
    }
  }

  /* ====================================================================
     4. FIGURE: REPORTED CONSISTENCY HORIZONS (Genie line)
     ==================================================================== */
  function buildHorizonFig() {
    var rows = [
      { name: 'Genie 1', date: 'Feb 2024', lo: 1.6, hi: 1.6, note: '16-frame memory (training video at 10 FPS)' },
      { name: 'Genie 2', date: 'Dec 2024', lo: 10, hi: 60, note: 'most examples 10 to 20 s; up to a minute' },
      { name: 'Genie 3', date: 'Aug 2025', lo: 60, hi: 180, note: 'about 1 min of visual memory; consistent for a few minutes' },
      { name: 'Genie 4', date: 'Oct 2026', lo: 120, hi: 120, note: 'up to 2 min (TechCrunch); DeepMind does not quantify' }
    ];
    var ticks = [[1, '1 s'], [10, '10 s'], [60, '1 min'], [600, '10 min']];
    function lx(s) { return Math.log10(s); }
    function draw(g, env) {
      var c = env.c, X0 = 150, X1 = 900, Y0 = 70, RH = 92;
      var u = function (s) { return X0 + (lx(s) - 0) / (lx(600) - 0) * (X1 - X0); };
      T(g, 'Reported temporal consistency, Genie line (log scale, vendor definitions differ)', 40, 32, { size: 20, weight: 700 });
      ticks.forEach(function (tk) {
        D.line(g, u(tk[0]), Y0 - 10, u(tk[0]), Y0 + rows.length * RH, { color: c.faint, lw: 1 });
        T(g, tk[1], u(tk[0]), Y0 + rows.length * RH + 20, { size: 17, font: 'mono', color: c.muted, align: 'center' });
      });
      rows.forEach(function (r, i) {
        var y = Y0 + i * RH + 20;
        T(g, r.name, 40, y + 4, { size: 22, weight: 700 });
        T(g, r.date, 40, y + 30, { size: 16, font: 'mono', color: c.muted });
        if (r.lo === r.hi) { D.dot(g, u(r.lo), y + 4, 10, { fill: c.ink }); }
        else { D.line(g, u(r.lo), y + 4, u(r.hi), y + 4, { color: c.muted, lw: 10, cap: 'butt', alpha: 0.35 }); D.dot(g, u(r.lo), y + 4, 8, { fill: c.ink }); D.dot(g, u(r.hi), y + 4, 8, { fill: c.stage, stroke: c.ink, lw: 3, dash: [3, 3] }); }
        T(g, r.note, X0, y + 36, { size: 16, color: c.ink2, maxWidth: 740 });
      });
      T(g, 'Dots: a single reported figure. Band: a reported range. Hollow dot: upper figure given loosely.', 40, Y0 + rows.length * RH + 54, { size: 16, color: c.muted, maxWidth: 860 });
    }
    var cv = WM.canvas({ w: 960, h: 500, draw: draw, label: 'Reported temporal consistency of Genie 1 to 4 on a log scale: 1.6 seconds, 10 to 60 seconds, 1 to a few minutes, and up to 2 minutes.' });
    return h('figure', { class: 'wm-wide' }, cv.el,
      h('figcaption', { class: 'wm-note' }, 'Figure. Reported temporal consistency of the Genie line, from DeepMind posts and the Genie 1 paper; Genie 4’s figure is TechCrunch’s. Each vendor measures a different thing (frame memory, scene recall, visual stability), so read the trend, not the decimals. Parameter counts for Genie 2 to 4 are undisclosed.'));
  }

  /* ====================================================================
     5. INTERACTIVE A: ROLLOUT DRIFT AND THE CONSISTENCY HORIZON
     True system: a ball under gravity in a box with elastic-ish walls.
     Model: same equations with a biased gravity and restitution, plus
     per-step sampling noise. Rollouts are computed, not animated.
     ==================================================================== */
  function buildDrift() {
    var N = 240, DT = 0.03, S = 10, THR = 0.1;
    var state = { bias: 0.03, noise: 0.004, anchor: 0, step: 120, seed: 1 };
    var sim = null;
    function stepBall(s, gparam, e, nz, rnd) {
      var x = s[0], y = s[1], vx = s[2], vy = s[3];
      vy += gparam * DT; x += vx * DT; y += vy * DT;
      if (nz) { vx += nz * WM.gauss(rnd); vy += nz * WM.gauss(rnd); }
      if (x < 0.04) { x = 0.04; vx = -vx * e; } if (x > 0.96) { x = 0.96; vx = -vx * e; }
      if (y > 0.96) { y = 0.96; vy = -vy * e; } if (y < 0.04) { y = 0.04; vy = -vy * e; }
      return [x, y, vx, vy];
    }
    function run() {
      var r0 = WM.rng(state.seed * 7 + 3);
      var init = [0.15 + r0() * 0.2, 0.2 + r0() * 0.2, 0.9 + r0() * 0.6, 0];
      var truth = [init], s = init, k, i;
      for (k = 1; k <= N; k++) { s = stepBall(s, 1.6, 0.86, 0, null); truth.push(s); }
      var G = 1.6 * (1 + state.bias), E = 0.86 * (1 - state.bias), samples = [], err = [];
      for (i = 0; i < S; i++) {
        var rnd = WM.rng(state.seed * 101 + i), path = [init], m = init;
        for (k = 1; k <= N; k++) {
          if (state.anchor && k % state.anchor === 1 && k > 1) m = truth[k - 1];
          m = stepBall(m, G, E, state.noise, rnd); path.push(m);
        }
        samples.push(path);
      }
      var horizon = null;
      for (k = 0; k <= N; k++) {
        var ds = samples.map(function (pth) { return Math.hypot(pth[k][0] - truth[k][0], pth[k][1] - truth[k][1]); }).sort(function (a, b) { return a - b; });
        var med = ds[Math.floor(S / 2)];
        err.push(med);
        if (horizon == null && med > THR) horizon = k;
      }
      sim = { truth: truth, samples: samples, err: err, horizon: horizon };
    }
    function draw(g, env) {
      var c = env.c, BX = 40, BY = 60, BW = 400, BH = 400, k;
      var px = function (q) { return [BX + q[0] * BW, BY + q[1] * BH]; };
      T(g, 'Reality (solid) and ' + S + ' imagined rollouts (dashed)', BX, 34, { size: 20, weight: 700 });
      D.box(g, BX, BY, BW, BH, { fill: c.surface, stroke: c.ink, lw: 2 });
      var st = state.step;
      sim.samples.forEach(function (pth, i) {
        D.poly(g, pth.slice(0, st + 1).map(px), { color: c.imagined, lw: 1.5, dash: [5, 4], alpha: 0.5 });
        var e = px(pth[st]); D.dot(g, e[0], e[1], 7, { fill: c.stage, stroke: c.imagined, lw: 2 });
      });
      D.poly(g, sim.truth.slice(0, st + 1).map(px), { color: c.ink, lw: 2.5 });
      var tp = px(sim.truth[st]); D.dot(g, tp[0], tp[1], 9, { fill: c.ink });
      if (state.anchor) {
        for (k = 1; k <= st; k += state.anchor) { var ap = px(sim.truth[k - 1]); D.dot(g, ap[0], ap[1], 4, { fill: c.accent2 }); }
        T(g, 'teal dots: re-anchored', BX, BY + BH + 24, { size: 15, color: c.accent2 });
      }
      T(g, 'step ' + st + ' of ' + N + ' (' + WM.ui.fmt(st * DT, 1) + ' s)', BX + BW, BY + BH + 24, { size: 15, font: 'mono', color: c.muted, align: 'right' });
      /* error chart */
      var ax = D.axes(g, 540, 90, 360, 330, { xlabel: 'rollout step', ylabel: 'median distance to reality', xticks: [[0, '0'], [0.5, String(N / 2)], [1, String(N)]], yticks: [[0, '0'], [THR / 0.5, String(THR)], [1, '0.5']], size: 16 });
      T(g, 'Error vs horizon', 540, 34, { size: 20, weight: 700 });
      D.line(g, ax.x(0), ax.y(THR / 0.5), ax.x(1), ax.y(THR / 0.5), { color: c.error, lw: 1.5, dash: [4, 4] });
      D.box(g, ax.x(1) - 114, ax.y(THR / 0.5) - 24, 96, 20, { fill: c.bg, stroke: false, alpha: 0.9 });
      T(g, 'threshold', ax.x(1) - 20, ax.y(THR / 0.5) - 12, { size: 16, color: c.error, align: 'right', font: 'mono' });
      D.poly(g, sim.err.map(function (e, i) { return [ax.x(i / N), ax.y(D.clamp(e / 0.5))]; }), { color: c.error, lw: 2.5 });
      D.line(g, ax.x(st / N), ax.y(0), ax.x(st / N), ax.y(1), { color: c.muted, lw: 1, dash: [2, 4] });
      if (sim.horizon != null) {
        D.dot(g, ax.x(sim.horizon / N), ax.y(THR / 0.5), 7, { fill: c.error });
        D.box(g, ax.x(sim.horizon / N) + 6, ax.y(THR / 0.5) + 10, 20 + 9.2 * ('horizon: ' + sim.horizon + ' steps').length - 20, 24, { fill: c.bg, stroke: false, alpha: 0.9 });
        T(g, 'horizon: ' + sim.horizon + ' steps', ax.x(sim.horizon / N) + 10, ax.y(THR / 0.5) + 22, { size: 16, color: c.error, font: 'mono', maxWidth: 200 });
      } else T(g, 'error stays below threshold', ax.x(0.5), ax.y(0.5), { size: 17, color: c.good, align: 'center', font: 'mono' });
    }
    run();
    var cv = WM.canvas({ w: 960, h: 500, draw: draw, label: 'Left: a ball bouncing in a box, the true path solid and ten imagined rollouts dashed. Right: the median distance between imagined and true positions against rollout step, with a threshold line and the step at which it is crossed.' });
    var rH = WM.readout('Consistency horizon', MINUS), rE = WM.readout('Error at this step', MINUS), nt = notice();
    function say() {
      var hz = sim.horizon, s = '';
      if (state.bias === 0 && state.noise === 0) s = 'With no model error and no sampling noise the rollouts sit exactly on reality forever. No learned model is like this.';
      else if (state.anchor) s = 'Re-anchoring every ' + state.anchor + ' steps resets the error, so it never accumulates for long. This is what conditioning on real frames does during evaluation, and what receding-horizon planning does during control. The free-running case is the hard one.';
      else if (state.noise === 0) s = 'A bias of ' + Math.round(state.bias * 100) + '% in gravity and bounce gives almost nothing at first, then a visible gap after each bounce. Rollouts stay tight together because the model is deterministic: it is confidently wrong.';
      else if (state.bias === 0) s = 'With no bias the rollouts spread out but their median stays near reality for a while. Each bounce amplifies small differences, so the fan widens with every impact. Sampling noise alone limits the horizon.';
      else s = 'Bias pulls the whole fan away from reality and noise spreads it. ' + (hz != null ? 'The median crosses the threshold at step ' + hz + ' (' + WM.ui.fmt(hz * DT, 1) + ' s). ' : '') + 'Real systems are measured in seconds of video for the same reason: errors compound through every step and every contact.';
      nt.set(s);
    }
    function sync() {
      rH.set(sim.horizon == null ? 'beyond ' + N + ' steps' : sim.horizon + ' steps (' + WM.ui.fmt(sim.horizon * DT, 1) + ' s)');
      rE.set(WM.ui.fmt(sim.err[state.step], 3));
      say(); cv.redraw();
    }
    var sB = WM.slider({ label: 'Model bias (gravity and bounce)', min: 0, max: 0.1, step: 0.005, value: state.bias, fmt: function (v) { return Math.round(v * 100) + '%'; }, onInput: function (v) { state.bias = v; run(); sync(); } });
    var sN = WM.slider({ label: 'Sampling noise per step', min: 0, max: 0.02, step: 0.001, value: state.noise, fmt: 3, onInput: function (v) { state.noise = v; run(); sync(); } });
    var sS = WM.slider({ label: 'Show up to step', min: 0, max: N, step: 1, value: state.step, fmt: 0, onInput: function (v) { state.step = v; sync(); } });
    var sel = WM.select({ label: 'Re-anchor on observations', options: [{ value: 0, label: 'never (free-running)' }, { value: 20, label: 'every 20 steps' }, { value: 60, label: 'every 60 steps' }], value: 0, onChange: function (v) { state.anchor = Number(v); run(); sync(); } });
    var btn = WM.buttons([{ label: 'New start', kind: 'ghost', onClick: function () { state.seed++; run(); sync(); } }]);
    sync();
    return WM.panel({ title: 'Measure the consistency horizon of an imperfect simulator', note: 'Set <b>noise</b> to 0 and raise <b>bias</b>; then set bias to 0 and raise noise; then switch on <b>re-anchoring</b>. Drag <b>step</b> to see where the fan leaves reality.' },
      cv, WM.controls(sB, sN, sel, sS, btn), WM.readouts(rH, rE), WM.readouts(nt));
  }

  /* ====================================================================
     6. INTERACTIVE B: COMPARISON EXPLORER
     Every field below is sourced from _research/sota.md. "Undisclosed"
     means no primary source gives the number.
     ==================================================================== */
  var SYS = [
    { id: 'ws18', name: 'World Models (Ha & Schmidhuber)', fam: 'A', org: 'Google Brain / NNAISENSE', date: 'Mar 2018', inputs: '64×64 game frames, actions', predicts: 'Latent: next VAE code z (32-D); decodable', action: 'Yes', scale: 'MDN-RNN with 256 hidden units; 867-parameter controller (CarRacing)', evidence: 'CarRacing-v0 906 ± 21 (solved); VizDoom agent trained entirely in the dream survived 1092 ± 556 steps', limits: 'At low temperature the controller exploited model flaws and did not transfer', status: 'Verified from arXiv 1803.10122' },
    { id: 'dv3', name: 'DreamerV3', fam: 'A', org: 'Google DeepMind / Toronto', date: 'arXiv Jan 2023; Nature Apr 2025', inputs: 'Pixels or proprioception, actions, rewards (online)', predicts: 'Latent: RSSM state (with reconstruction for training), reward', action: 'Yes', scale: 'One fixed configuration across 150+ tasks', evidence: 'First to collect diamonds in Minecraft from scratch without human data; outperforms specialised methods across 150+ tasks', limits: 'Learns online by interacting; per-task training', status: 'Verified (danijar.com project page, which links the 2025 Nature paper)' },
    { id: 'd4', name: 'Dreamer 4', fam: 'A', org: 'Google DeepMind', date: 'Sep 2025', inputs: 'Minecraft video; 100 h of it with actions', predicts: 'Pixels via latent tokens; 360×640 frames; reward', action: 'Yes', scale: '2B parameters (400M tokenizer, 1.6B dynamics); 2,541 h of video; 21 FPS on one H100', evidence: 'First to obtain diamonds from offline data alone; 0.7% of episodes; 14 of 16 human interaction tests', limits: 'Short memory (9.6 s context); inventory drift; Hafner: “still far from human-level play”', status: 'Verified from arXiv 2509.24527 and InfoQ' },
    { id: 'mz', name: 'MuZero', fam: 'A', org: 'DeepMind', date: 'arXiv Nov 2019; Nature Dec 2020', inputs: 'Board or Atari observations, actions', predicts: 'Value-equivalent only: reward, value, policy', action: 'Yes (plans with Monte Carlo tree search)', scale: 'Not recorded in the fact base', evidence: 'Atari-57 state of the art; matched AlphaZero at Go, chess, shogi without the rules', limits: 'Hidden state has no observational meaning; no imagery to inspect', status: 'Verified from arXiv 1911.08265; Nature paper 2020' },
    { id: 'ez2', name: 'EfficientZero V2', fam: 'A', org: 'Wang, Liu, Ye, You and Gao', date: 'Mar 2024', inputs: 'Pixels or states, actions, rewards', predicts: 'Value-equivalent latent plus self-supervised consistency', action: 'Yes', scale: 'Sample-efficient regime (Atari 100k, DMC)', evidence: 'Beat DreamerV3 in 50 of 66 tasks; EfficientZero (2021) reached 194% mean human-normalised Atari 100k from ~2 h of play', limits: 'Small-scale single-task benchmarks', status: 'Verified from arXiv 2403.00564' },
    { id: 'vj2', name: 'V-JEPA 2 and V-JEPA 2-AC', fam: 'B', org: 'Meta FAIR, with Mila', date: 'Jun 2025', inputs: 'Video (pretraining); robot video with actions (post-training)', predicts: 'Latent embeddings only; no pixels', action: 'V-JEPA 2: no. V-JEPA 2-AC: yes', scale: '1.2B parameters; >1M hours of video + 1M images; <62 h DROID robot video', evidence: '77.3% top-1 on the Something-Something v2 action benchmark; zero-shot on Franka arms in two labs; 65 to 80% pick-and-place with new objects', limits: 'Below 60% on IntPhys 2 (close to chance); image goals only; sensitive to camera position', status: 'Verified from arXiv 2506.09985, 2506.09849 and Meta blog' },
    { id: 'lwm', name: 'LeWorldModel', fam: 'B', org: 'LeCun, Balestriero et al.', date: 'Mar 2026', inputs: 'Raw pixels, actions', predicts: 'Latent embeddings', action: 'Yes', scale: 'About 15M parameters; trains on one GPU in hours', evidence: 'First JEPA that trains stably end-to-end from pixels; plans up to 48× faster than foundation-model world models (authors’ claim)', limits: 'Small control tasks; early', status: 'Verified from arXiv 2603.19312' },
    { id: 'g3', name: 'Genie 3', fam: 'C', org: 'Google DeepMind', date: 'Aug 2025', inputs: 'Text prompt, navigation actions, text events', predicts: 'Pixels, frame by frame, 720p at 24 FPS', action: 'Yes (limited action space)', scale: 'Undisclosed parameters and data', evidence: 'Real-time; about 1 min of visual memory; consistent for a few minutes; no explicit 3D representation', limits: 'Limited actions; multi-agent unsolved; sessions last minutes; no benchmark numbers', status: 'Verified from DeepMind blog' },
    { id: 'g4', name: 'Genie 4', fam: 'C', org: 'Google DeepMind', date: '27 Oct 2026', inputs: 'Text, images, actions, free-form edits; Gemini as director', predicts: 'Pixels plus native real-time audio', action: 'Yes', scale: 'Undisclosed parameters, resolution and FPS', evidence: 'Consistent scene for up to 2 min (TechCrunch); robot demos (UR5, Apollo humanoid) shown without success rates', limits: 'Drift in detail and object permanence; complex physics and legible text remain open; research preview only', status: 'Verified from DeepMind blog and TechCrunch' },
    { id: 'cos', name: 'NVIDIA Cosmos (Predict1 to Cosmos 3)', fam: 'C', org: 'NVIDIA', date: 'Jan 2025; Cosmos 3 Jun 2026', inputs: 'Text, image, video; actions via post-training; Cosmos 3 adds audio and actions natively', predicts: 'Pixels via latent tokens; Cosmos 3 also predicts actions', action: 'Optional (post-training); native in Cosmos 3', scale: 'Predict1: 4B to 14B; ~20M hours of raw video; open weights', evidence: 'Post-training examples for robot manipulation and driving; Cosmos 3 claims first among open models on Physics-IQ (vendor claim)', limits: 'NVIDIA: the problem is “still far from being solved”; benchmark claims not independently replicated', status: 'Verified from arXiv 2501.03575 and NVIDIA newsroom' },
    { id: 'sora', name: 'Sora and Sora 2', fam: 'C', org: 'OpenAI', date: 'Feb 2024; Sora 2 Sep 2025; app shut 26 Apr 2026', inputs: 'Text, image or video prompt', predicts: 'Pixels (latent spacetime patches)', action: 'No', scale: 'Undisclosed', evidence: 'Emergent 3D consistency and object permanence claimed; Sora 2 added synchronised audio and better rebounds', limits: 'OpenAI’s own report: glass does not shatter correctly, long videos lose coherence; Physics-IQ finds physical understanding “severely limited”', status: 'Verified from OpenAI pages, TechCrunch, CBS' },
    { id: 'waymo', name: 'Waymo World Model', fam: 'C', org: 'Waymo (on Genie 3)', date: 'Feb 2026', inputs: 'Driving action, scene layout, language; dashcam video', predicts: 'Pixels and lidar together', action: 'Yes (what-if counterfactual driving)', scale: 'Undisclosed', evidence: 'Generates rare scenarios (floods, animals on the road); turns dashcam video into simulation', limits: 'Long simulations are expensive; no quantitative benchmarks published', status: 'Verified from Waymo blog' },
    { id: 'gaia', name: 'Wayve GAIA-2 and GAIA-3', fam: 'C', org: 'Wayve', date: 'Mar 2025; GAIA-3 Dec 2025', inputs: 'Ego actions, other agents, road layout, weather, time of day', predicts: 'Pixels, multi-camera surround view', action: 'Yes', scale: 'GAIA-1 was 9B on ~4,700 h of London driving; GAIA-3 about 15B with ~10× more data', evidence: 'Used for validation; company reports simulated results “closely mirror” real ones', limits: 'Company claims only; no independent replication', status: 'GAIA-2 verified from Wayve press; GAIA-3 secondary' },
    { id: 'wl', name: 'World Labs Marble and Atlas', fam: 'C', org: 'World Labs (AMD acquisition pending)', date: 'Nov 2025; Atlas Sep 2026', inputs: 'Text, images, video, coarse 3D layouts, camera poses, depth', predicts: 'Explicit 3D: Gaussian splats, meshes; Atlas also video up to 1 min at 1440p', action: 'No (camera-navigable, not agent actions)', scale: 'Undisclosed', evidence: 'Atlas: raters preferred it 75 to 94% of the time over five video models (vendor claim)', limits: 'Early access; not conditioned on robot actions', status: 'Verified from World Labs blog and AMD newsroom' },
    { id: 'gwm', name: 'Runway GWM-1', fam: 'C', org: 'Runway', date: 'Dec 2025', inputs: 'Camera pose, robot commands, audio', predicts: 'Pixels, frame by frame, real time; up to 2 min at 720p', action: 'Yes', scale: 'Undisclosed', evidence: 'Variants for worlds, avatars and robotics policy evaluation', limits: 'No benchmark numbers found', status: 'Verified from Runway research page' },
    { id: 'cwm', name: 'Meta Code World Model', fam: 'D', org: 'Meta', date: 'Sep 2025', inputs: 'Code, interpreter traces, agentic Docker trajectories', predicts: 'Program execution: observation after an action in an environment', action: 'Yes (code actions)', scale: '32B parameters, open weights', evidence: 'SWE-bench Verified 65.8% with test-time scaling', limits: 'A world model of software, not of the physical world', status: 'Verified from arXiv 2510.02387' }
  ];
  var FAM = { A: 'A · latent-dynamics RL', B: 'B · predictive representation', C: 'C · generative / interactive', D: 'D · LLM as implicit model' };
  var FIELDS = [['fam', 'Family'], ['org', 'Organisation'], ['date', 'Date'], ['inputs', 'Inputs'], ['predicts', 'What is predicted'], ['action', 'Action-conditioned'], ['scale', 'Scale'], ['evidence', 'Evidence'], ['limits', 'Known limits'], ['status', 'Source status']];
  function buildCompare() {
    var a = 'vj2', b = 'g3';
    var grid = h('div', { style: { display: 'grid', gap: '10px' } });
    var nt = notice();
    function cell(txt, hl) {
      return h('div', { style: { padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r)', fontSize: '.92rem', lineHeight: '1.4', color: hl ? 'var(--ink)' : 'var(--ink-2)', minWidth: '0' } }, txt);
    }
    function render() {
      var A = SYS.filter(function (s) { return s.id === a; })[0], B = SYS.filter(function (s) { return s.id === b; })[0];
      grid.textContent = '';
      grid.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' } },
        h('div', { style: { fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '1.05rem', borderBottom: '2px solid var(--ink)', padding: '4px 0' } }, A.name),
        h('div', { style: { fontFamily: 'var(--font-display)', fontWeight: '700', fontSize: '1.05rem', borderBottom: '2px solid var(--accent2)', padding: '4px 0' } }, B.name)));
      FIELDS.forEach(function (f) {
        var va = f[0] === 'fam' ? FAM[A.fam] : A[f[0]], vb = f[0] === 'fam' ? FAM[B.fam] : B[f[0]];
        var same = va === vb;
        grid.appendChild(h('div', null,
          h('div', { class: 'wm-kicker', style: { marginBottom: '4px' } }, f[1]),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' } }, cell(va, !same), cell(vb, !same))));
      });
      var msg;
      if (A.fam !== B.fam) msg = 'These belong to different families, so compare the “What is predicted” and “Action-conditioned” rows first: they decide which questions each can answer. ';
      else msg = 'Same family: look at the “Evidence” and “Known limits” rows, which is where the two differ. ';
      var und = [A, B].filter(function (s) { return /Undisclosed/.test(s.scale); }).map(function (s) { return s.name; });
      if (und.length) msg += 'Scale is undisclosed for ' + und.join(' and ') + '; no parameter count should be quoted for ' + (und.length > 1 ? 'them' : 'it') + '.';
      else msg += 'Both report their scale, which is unusual for 2026 generative systems.';
      nt.set(msg);
    }
    var opts = SYS.map(function (s) { return { value: s.id, label: s.name }; });
    var selA = WM.select({ label: 'System A (left)', options: opts, value: a, onChange: function (v) { a = v; render(); } });
    var selB = WM.select({ label: 'System B (right)', options: opts, value: b, onChange: function (v) { b = v; render(); } });
    render();
    return WM.panel({ title: 'Compare two systems, field by field', note: 'Pick <b>MuZero</b> against <b>Genie 4</b>, then <b>V-JEPA 2</b> against <b>LeWorldModel</b>. Watch the “What is predicted” and “Scale” rows.' },
      WM.controls(selA, selB), grid, WM.readouts(nt));
  }

  /* ====================================================================
     7. INTERACTIVE C: WHICH QUESTION CAN THIS MODEL ANSWER?
     Verdicts: yes / partly / no / open, each with a reason.
     ==================================================================== */
  var QS = [
    { q: 'What will the camera see if the robot pushes left for two seconds?', v: { A: ['partly', 'Dreamer-style models can decode imagined latents to frames (Dreamer 4 renders 360×640), but the picture is a by-product, and MuZero cannot render at all.'], B: ['no', 'JEPA predicts an embedding, not pixels. You get a vector that can be compared to other embeddings, never a picture.'], C: ['yes', 'This is the native output of Genie, Cosmos, GAIA or GWM-1, if the system is action-conditioned. Sora-type models without actions cannot take the “pushes left” part.'], D: ['no', 'A text model can describe the likely outcome in words; it does not produce the frame.'] } },
    { q: 'Will this sequence of actions reach the goal?', v: { A: ['yes', 'This is what the model is for: imagine the sequence in latent space and read off reward or value (Dreamer) or search over sequences (MuZero).'], B: ['yes', 'V-JEPA 2-AC rolls the predictor forward and scores the end point by distance to the goal embedding; this is how it plans on a real arm.'], C: ['partly', 'The rollout can be generated and then judged by a separate scorer. World-in-World found that visual quality does not guarantee task success and that action-observation post-training matters more.'], D: ['partly', 'For code, the Code World Model predicts execution traces. For physical tasks, verbal reasoning has no grounded dynamics behind it.'] } },
    { q: 'What is the value of this board position, or which move is best?', v: { A: ['yes', 'MuZero predicts reward, value and policy directly, and matched AlphaZero at Go, chess and shogi without being told the rules.'], B: ['no', 'No reward or value is learned; JEPA has no notion of a game score.'], C: ['no', 'A frame generator has no value function. It could render the next board, not evaluate it.'], D: ['partly', 'Probing shows Othello-GPT holds a board state within one small game; Vafa et al. show the implied state can be incoherent elsewhere. Coherence is the weak point.'] } },
    { q: 'Is this video physically plausible?', v: { A: ['no', 'Agent models are not trained to judge arbitrary videos.'], B: ['partly', 'LeWorldModel reports detecting implausible events, but V-JEPA 2, the best model tested on IntPhys 2, scores below 60% where chance is 50%.'], C: ['open', 'Physics-IQ and IntPhys 2 find video models near chance on physical understanding; realism does not imply physics.'], D: ['partly', 'A VLM can answer in words, but CausalVQA and MVPBench were built because they often answer wrongly.'] } },
    { q: 'Generate a rare driving scenario (a flood, an animal on the road) for testing.', v: { A: ['no', 'Not a generative-video system.'], B: ['no', 'Produces embeddings, not scenes.'], C: ['yes', 'Waymo World Model and Wayve GAIA-2/3 are built for this, with controls for weather, layout and other agents. Fidelity to the real risk is a company claim.'], D: ['partly', 'An LLM can write the scenario; it cannot render the sensor data.'] } },
    { q: 'Rank several robot policies without running them on a real robot.', v: { A: ['partly', 'Dreamer 4 evaluated agents inside its model, but only for the game it was trained on.'], B: ['no', 'No published use as a policy evaluator.'], C: ['partly', 'Veo as an action-conditioned simulator predicted the relative ranking of 8 policy checkpoints, validated against 1,600+ real trials. Absolute success rates are less reliable than rankings.'], D: ['no', 'No grounded dynamics.'] } },
    { q: 'Explain, in words, why the stack of blocks will fall.', v: { A: ['no', 'No language interface.'], B: ['partly', 'VL-JEPA predicts text embeddings and can decode them, but explanation is not its purpose.'], C: ['partly', 'Cosmos pairs a VLM (Cosmos-Reason) with its generator; the explanation comes from the VLM, not the world model.'], D: ['yes', 'This is what LLMs and VLMs do best. Whether the explanation reflects a correct internal model is a separate question.'] } },
    { q: 'Will this patient’s blood pressure cross 140/90 within two weeks if we start treatment?', v: { A: ['no', 'No system above is trained on clinical time series; the agent-RL framing also needs an action log with known outcomes.'], B: ['no', 'Same: no clinical embeddings exist in these systems, and a counterfactual treatment effect cannot be read from observational video-style training.'], C: ['no', 'Generative video has nothing to say about physiology.'], D: ['partly', 'An LLM will produce an answer. It is not a prediction from a validated model of that patient. Module 6 sets out what would be needed.'] } }
  ];
  var VERD = { yes: ['Yes', 'var(--good)'], partly: ['Partly', 'var(--warn)'], no: ['No', 'var(--error)'], open: ['Open', 'var(--muted)'] };
  function buildMatcher() {
    var qi = 0;
    var list = h('div', { style: { display: 'grid', gap: '10px' } });
    var nt = notice();
    function render() {
      var q = QS[qi];
      list.textContent = '';
      ['A', 'B', 'C', 'D'].forEach(function (f) {
        var v = q.v[f], vd = VERD[v[0]];
        list.appendChild(h('div', { style: { display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: '10px', alignItems: 'start', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderLeft: '4px solid ' + vd[1], borderRadius: 'var(--r)' } },
          h('div', null,
            h('div', { style: { fontFamily: 'var(--font-mono)', fontWeight: '700', color: vd[1], fontSize: '1rem' } }, vd[0]),
            h('div', { style: { fontSize: '.78rem', color: 'var(--muted)', marginTop: '2px', lineHeight: '1.25' } }, FAM[f])),
          h('div', { style: { fontSize: '.95rem', lineHeight: '1.45', color: 'var(--ink-2)' } }, v[1])));
      });
      var yes = ['A', 'B', 'C', 'D'].filter(function (f) { return q.v[f][0] === 'yes'; }).length;
      var open = ['A', 'B', 'C', 'D'].filter(function (f) { return q.v[f][0] === 'open'; }).length;
      nt.set(yes === 0 ? (open ? 'No family answers this reliably today. The benchmarks that test it put current models near chance.' : qi < QS.length - 1 ? 'No family answers this natively. The partial answers above are the closest available, and each carries the limit stated beside it.' : 'No family answers this as it stands. A pregnancy question needs clinical state estimation and treatment effects from trials, which none of these systems contain.')
        : yes === 1 ? 'Exactly one family answers this natively. The others would need a bolt-on component, and the bolt-on is usually where the evidence is thin.'
          : 'More than one family answers this, but by different means: one reads a value, another measures a distance in embedding space. Their failure modes differ accordingly.');
    }
    var sel = WM.select({ label: 'Question', options: QS.map(function (q, i) { return { value: i, label: q.q }; }), value: 0, onChange: function (v) { qi = Number(v); render(); } });
    render();
    return WM.panel({ title: 'Which family can answer this question?', note: 'Work down the list. The last question is the pregnancy one; notice that no family answers it as it stands.' },
      WM.controls(sel), list, WM.readouts(nt));
  }

  /* ====================================================================
     8. REGISTER
     ==================================================================== */
  WM.register({
    id: 'm5', num: 5, title: 'State of the art, 2026', tagline: 'Four families of world model, what each can answer, and how to tell a good one from a convincing one.', minutes: 35, level: 'Advanced',
    build: function (root) {
      root.append(
        WM.hero({
          kicker: 'Module 5 · Advanced', title: 'State of the art, 2026', minutes: 35,
          lede: 'Module 4 ended with two ideas: learn behaviour inside a latent model, and predict representations rather than pixels. By late 2026 those ideas have grown into four families of system that all get called world models and that answer different questions. This module sorts them by what they predict and what they are conditioned on, then turns to the harder problem: how to tell whether a world model is any good. Facts are drawn from the research notes compiled on 29 October 2026; where a vendor has not disclosed a number, the module says so.',
          goals: [
            'Place any 2026 system (Dreamer 4, V-JEPA 2, Genie 4, Cosmos 3, Waymo World Model, a code world model) in one of four families by <b>what it predicts</b> and whether it is <b>action-conditioned</b>.',
            'Explain why next-token or next-frame accuracy does not establish a coherent world model, and name the tests that do: intervention, closed-loop task success, out-of-distribution physics.',
            'State, for a given question, which family could answer it today and what evidence supports that, including why none of them answers a clinical what-if as they stand.'
          ]
        }),

        /* ---------------- 1 MAP ---------------- */
        WM.section({ id: 'map', kicker: '§1', title: 'What is being predicted?' },
          WM.p('The phrase “world model” now covers a game-playing agent with no images in it, a video generator with no actions in it, and a 15-million-parameter model that plans in a vector space. The useful question is not which one deserves the name. It is what each one predicts, and whether an <dfn data-def="A model is action-conditioned when its prediction of the next state depends on an action chosen by an agent, so it can answer what-if questions about that agent’s choices.">action</dfn> goes in. Those two answers decide which questions a system can be asked.'),
          WM.explainer({
            id: 'e1', title: 'Three things a world model can predict', duration: 90, poster: 12,
            scenes: [
              { start: 0, end: 15, caption: 'A ball, a block and a push. Every world model answers “what comes next?”. They differ in what the answer is made of.', draw: drawE1 },
              { start: 15, end: 30, caption: 'The generative family renders the whole next frame. Genie, Cosmos and the driving models work this way. The output can be watched, and a person can be put inside it to play.', draw: drawE1 },
              { start: 30, end: 45, caption: 'The latent family predicts the next embedding. Dreamer also learns a decoder so that training has a target; JEPA never reconstructs pixels. The prediction cannot be looked at directly.', draw: drawE1 },
              { start: 45, end: 60, caption: 'MuZero predicts no observation at all: only reward, value and policy. Its hidden state is free to mean anything, as long as search on top of it works.', draw: drawE1 },
              { start: 60, end: 75, caption: 'The three outputs differ in cost per step and in how they can be checked. Pixels are easy to judge for realism and hard to judge for physics.', draw: drawE1 },
              { start: 75, end: 90, caption: 'Four families organise the rest of this module. Explicit 3D output, as in World Labs Marble and Atlas, sits inside the generative family.', draw: drawE1 }
            ]
          }),
          WM.callout('idea', 'The two sorting questions', 'Ask of any system: <b>what is predicted</b> (pixels, a latent vector, only reward and value, or an explicit 3D scene) and <b>is it action-conditioned</b>. A text-to-video model that takes no actions is a simulator of observations, not a model an agent can plan with. A value-equivalent model that renders nothing can still beat the best planners. The surveys use similar axes: the Li et al. survey (Oct 2025) splits by decision-coupled versus general-purpose, sequential simulation versus global prediction, and spatial representation.')
        ),

        /* ---------------- 2 FAMILY A ---------------- */
        WM.section({ id: 'agents', kicker: '§2', title: 'Family A: latent-dynamics agents' },
          WM.p('This is the lineage Module 4 traced: Ha and Schmidhuber’s V–M–C agent, PlaNet, and the Dreamer series. <b>DreamerV3</b> (arXiv 2023, published in <i>Nature</i> in April 2025) runs one fixed configuration across more than 150 tasks and was the first algorithm to collect diamonds in Minecraft from scratch, with no human data. It learns online: the agent acts in the real environment, the model is refitted, behaviour is learned in imagination, and the loop repeats.'),
          WM.p('<b>Dreamer 4</b> (September 2025) changes the recipe. The world model is a tokenizer plus an action-conditioned transformer trained on 2,541 hours of recorded Minecraft play, only 100 hours of which carry actions. The agent is then trained by reinforcement learning <dfn data-def="Offline here means the agent never interacts with the real game during training; it learns only from recorded data and from rollouts inside the learned model.">entirely inside the model, offline</dfn>, and never touches the game until evaluation. It is the first agent to obtain diamonds from offline data alone. It does so in 0.7% of episodes, which Hafner has described as still far from human-level play. The two Dreamer results are different achievements and are often conflated.'),
          WM.p('The <b>MuZero</b> lineage takes the opposite view on observations. MuZero’s model predicts only what tree search needs, reward, value and policy, and its hidden state is never asked to match the real state. It matched AlphaZero in Go, chess and shogi without being told the rules, and <b>EfficientZero V2</b> (2024) outperformed DreamerV3 in 50 of 66 sample-efficiency tasks. The cost is that there is nothing to look at: a value-equivalent model cannot be inspected the way a video can.'),
          WM.p('All of these agents learn behaviour by rolling the model forward many steps. That makes <dfn data-def="The number of steps or seconds over which a model’s free-running prediction stays close enough to reality to be useful.">rollout horizon</dfn> the central engineering quantity, and it is where Module 3’s compounding error returns at scale.'),
          buildDrift(),
          WM.callout('warn', 'Misconception: an agent that scores well in imagination has learned the task', 'Ha and Schmidhuber’s VizDoom controller found and exploited errors in its own model at low temperature, and those policies failed in the real game. Dreamer 4’s human-operated interaction tests exist for the same reason: an interactive model is checked by putting a person inside it, not by looking at its loss curve. Dream score is a claim; real score is the evidence.')
        ),

        /* ---------------- 3 FAMILY B ---------------- */
        WM.section({ id: 'jepa', kicker: '§3', title: 'Family B: predictive representations' },
          WM.p('LeCun’s 2022 position paper argued that predicting pixels is the wrong objective, because most pixels are unpredictable detail, and proposed the <dfn data-def="Joint-Embedding Predictive Architecture: an encoder maps inputs to embeddings and a predictor predicts the embedding of a hidden or future part, with no pixel reconstruction.">JEPA</dfn> family instead. I-JEPA (2023) predicts the embeddings of hidden image blocks; V-JEPA (2024) does the same across video frames. Neither is action-conditioned. They are representation learners.'),
          WM.p('<b>V-JEPA 2</b> (June 2025) is the first in the line to become a world model in the control sense. A 1.2-billion-parameter encoder is pretrained on more than a million hours of video with no actions. Then a small action-conditioned predictor is post-trained on fewer than 62 hours of unlabeled robot video. The result was deployed zero-shot on Franka arms in two labs, planning towards image goals, with 65 to 80% success on pick-and-place of new objects. The explainer follows that planning loop.'),
          WM.explainer({
            id: 'e2', title: 'Planning in embedding space: V-JEPA 2-AC', duration: 96, poster: 14,
            scenes: [
              { start: 0, end: 16, caption: 'Pretraining: parts of a video are masked, the encoder embeds the rest, and the predictor must produce the embeddings of the masked part. Over a million hours of video, no actions, no pixels reconstructed.', draw: drawE2 },
              { start: 16, end: 32, caption: 'Post-training: the encoder is frozen and an action-conditioned predictor learns, from under 62 hours of robot video, how the embedding moves when the arm moves.', draw: drawE2 },
              { start: 32, end: 48, caption: 'A goal is given as an image. Its embedding is a point. The current frame’s embedding is another point. No reward function is written down.', draw: drawE2 },
              { start: 48, end: 64, caption: 'Candidate action sequences are sampled and rolled forward by the predictor, entirely in embedding space. Each is scored by how close its end point lands to the goal.', draw: drawE2 },
              { start: 64, end: 80, caption: 'The first action of the best plan is executed for real. The new frame is embedded and planning starts again, so model errors are corrected by observation instead of compounding.', draw: drawE2 },
              { start: 80, end: 96, caption: 'What it achieved and what it did not. Zero-shot manipulation in new labs is real; intuitive physics is not solved, with V-JEPA 2 below 60% on IntPhys 2, where chance is 50% and humans score about 96%.', draw: drawE2 }
            ]
          }),
          WM.p('The 2026 papers push in two directions. <b>V-JEPA 2.1</b> (March 2026) adds dense features and reports about 20 points higher real-robot grasp success than V-JEPA 2-AC. <b>LeWorldModel</b> (March 2026) is the first JEPA to train stably end-to-end from raw pixels, with about 15 million parameters on one GPU, and its authors report planning up to 48 times faster than foundation-model world models. A generalisation theory for JEPA world models appeared in mid-2026, relating pretraining error to planning regret. The family is young: as of October 2026, AMI Labs, the company LeCun founded after leaving Meta in late 2025 and which raised a $1.03 billion round in March 2026, had released no model.'),
          WM.callout('warn', 'Misconception: JEPA has been shown to beat generative world models', 'Not established. V-JEPA 2-AC showed zero-shot robot planning from very little robot data, which is a strong result. But on IntPhys 2, V-JEPA 2 was the best of the models tested and still scored below 60% against a chance level of 50%, the generalisation theory is at its first paper, and no head-to-head closed-loop comparison across families exists in the sources for this course. Treat “non-generative is better” as a hypothesis with early support.')
        ),

        /* ---------------- 4 FAMILY C ---------------- */
        WM.section({ id: 'generative', kicker: '§4', title: 'Family C: generative and interactive worlds' },
          WM.p('The generative family produces observations: frames, sometimes audio, sometimes lidar or explicit 3D geometry. Its systems divide by whether an action goes in. <b>Sora</b> (February 2024) was a diffusion transformer over spacetime patches, conditioned on text or images, and OpenAI framed scaling it as a path towards general simulators. It took no actions. OpenAI’s own report listed physics failures; the Sora app was discontinued in April 2026, with the research team said to continue world-simulation work for robotics.'),
          WM.p('The <b>Genie</b> line is action-conditioned. Genie 1 (February 2024) learned eight <dfn data-def="Actions inferred from video alone, with no action labels, by learning a small discrete code that best explains the change between consecutive frames.">latent actions</dfn> from 30,000 hours of platformer video and ran at about one frame per second with a 16-frame memory. Genie 2 (December 2024) took keyboard and mouse input and stayed consistent for up to a minute, though most examples ran 10 to 20 seconds. Genie 3 (August 2025) runs in real time at 720p and 24 frames per second with about a minute of visual memory, generating frame by frame with no explicit 3D representation. Genie 4 (27 October 2026) adds native audio, mid-simulation text edits and a Gemini model as a director that plans, checks and revises; TechCrunch reports a consistent scene for up to two minutes, double Genie 3’s. DeepMind lists drift in object permanence, complex physics and legible text as open problems, and has published no resolution, frame rate or benchmark for it.'),
          buildHorizonFig(),
          WM.p('Industry builds on the same idea. <b>NVIDIA Cosmos</b> (January 2025) released open-weight 4B to 14B video models trained from about 20 million hours of video, with action conditioning added by post-training; Cosmos 3 (June 2026) folds reasoning, generation and action prediction into one model. The <b>Waymo World Model</b> (February 2026) is built on Genie 3 and generates camera and lidar together for counterfactual driving; <b>Wayve GAIA-2</b> and <b>GAIA-3</b> do the same with multi-camera views for validation. <b>World Labs</b> outputs explicit 3D (Gaussian splats and meshes) in Marble and Atlas, and in September 2026 agreed to be acquired by AMD for about $8.2 billion in stock, a deal that had not closed at the time of writing. <b>Runway GWM-1</b> takes camera, robot and audio actions. Parameter counts for most of these are undisclosed.'),
          buildCompare(),
          WM.callout('warn', 'Misconception: a photorealistic world is a physically correct one', 'Physics-IQ (DeepMind, 2025) tested Sora, Runway, Pika, Lumiere and others on fluids, solids, optics and magnetism and concluded that visual realism does not imply physical understanding. Kang et al. (ByteDance, 2024) found that video models generalise by imitating the nearest training case, in the order colour, size, velocity, shape, and that scaling alone does not recover physical laws. IntPhys 2 (2025) puts most models near chance where humans are near-perfect. Judge realism and physics separately.')
        ),

        /* ---------------- 5 FAMILY D ---------------- */
        WM.section({ id: 'llm', kicker: '§5', title: 'Family D: language models as implicit world models' },
          WM.p('Do large language models contain a world model? Both extreme answers are wrong, and the evidence on each side is specific. For: Othello-GPT (2023), trained only on move sequences, holds an internal board that a probe can read, and editing that board changes the model’s predicted moves, which is causal evidence. Gurnee and Tegmark (2023) found linear representations of place and time in Llama-2. Richens et al. (2025) argue formally that any agent that generalises across multi-step goals must have learned a predictive model, which can be extracted from its policy. Against: Vafa et al. (2024) trained transformers on New York taxi routes and got near-perfect next-token accuracy with an incoherent implied map. The explainer takes that case apart.'),
          WM.explainer({
            id: 'e3', title: 'Next-token accuracy is not a coherent map', duration: 84, poster: 11,
            scenes: [
              { start: 0, end: 14, caption: 'A transformer is trained on millions of routes through a grid city, written as turn-by-turn directions. It never sees the map, just as a language model never sees the world.', draw: drawE3 },
              { start: 14, end: 28, caption: 'On held-out routes it predicts the next turn almost perfectly, and probes recover the current location. By the usual metrics, the city has been learned.', draw: drawE3 },
              { start: 28, end: 42, caption: 'Reconstruct the map the model implies by asking which moves it allows at each corner. Streets appear that do not exist: impossible orientations and flyovers across blocks.', draw: drawE3 },
              { start: 42, end: 56, caption: 'Add random detours with a 10% chance per step and the share of valid routes collapses from 99% to 8% for the model trained on shortest paths. A coherent map would recover from a detour; a memory of familiar sequences does not.', draw: drawE3 },
              { start: 56, end: 70, caption: 'Othello-GPT shows the other side: a probe reads the board, and editing the internal board changes the predicted moves. A real, usable state, within a small closed game.', draw: drawE3 },
              { start: 70, end: 84, caption: 'The lesson is about evaluation. Accuracy on the next step is necessary and not sufficient; intervention, structure tests and out-of-distribution routes are what reveal the model behind the predictions.', draw: drawE3 }
            ]
          }),
          WM.p('Two 2025 developments complicate the picture productively. Meta’s <b>Code World Model</b> is a 32-billion-parameter language model mid-trained on observation–action traces from Python interpreters and containerised agent environments, so that it predicts what code does when run. Here “world model” means program execution, and it reached 65.8% on SWE-bench Verified. And Genie 4 uses Gemini as a director over a pixel simulator, which DeepMind calls a hybrid of code, text and pixels. The boundary between families C and D is already porous.'),
          WM.callout('idea', 'A defensible position', 'LLMs hold partial, fragile, task-dependent world models. The interesting questions are measurable: how coherent is the implied state, does intervening on it change behaviour as predicted, and does it survive leaving the training distribution. The same three questions apply to every family above.')
        ),

        /* ---------------- 6 EVALUATION ---------------- */
        WM.section({ id: 'evaluation', kicker: '§6', title: 'What counts as a good world model' },
          WM.p('Five themes recur across the benchmarks of 2025 and 2026. <b>Open-loop versus closed-loop.</b> A model can produce beautiful video and be useless for control. World-in-World (October 2025) evaluated world models by whether an agent using them succeeded at tasks in four environments, and found that visual quality alone does not guarantee success and that <dfn data-def="How reliably the model’s predicted outcome follows the action it was given, consistently, over time.">controllability</dfn> matters more; post-training on action–observation data beat a better base video model. <b>Action-conditioned fidelity.</b> Does pressing left do the right thing for minutes? Dreamer 4’s human interaction tests and the Genie line’s consistency figures measure this. <b>Long-horizon consistency and memory</b>, which the drift demo above makes concrete. <b>Physics out of distribution</b>, tested by Physics-IQ, IntPhys 2, MVPBench and CausalVQA. <b>Correlation with reality</b> when the model is used as an evaluator: Veo as an action-conditioned simulator predicted the relative ranking of eight robot policies, checked against more than 1,600 real trials.'),
          WM.p('The known failure modes follow from the same list: agents exploit model errors, free-running rollouts drift, object permanence decays after edits, text becomes illegible, and training data is imitated case by case rather than law by law. A sixth, specific to the field’s current economics, is that most 2026 claims about scale and benchmark leadership are vendor claims with no independent replication.'),
          buildMatcher(),
          WM.callout('pregnancy', 'Evaluating a model of pregnancy the same way', 'Suppose a model forecasts a woman’s blood pressure at the next antenatal visit from her previous visits. Next-visit accuracy is the next-token test, and it can look excellent while the implied physiology is incoherent, exactly as in the taxi-route case. The closed-loop test asks whether care guided by the model changes outcomes. The field has a cautionary example: the INFANT trial (2017) found that computerised decision support for interpreting fetal heart-rate traces during labour, in about 46,000 women, did not change poor neonatal outcomes. The out-of-distribution test is transport: a pre-eclampsia time-to-delivery model reported a c-index of 0.79 at its home site and 0.74 at an external one, falling to 0.67 for early-onset disease. And a what-if about treatment is a counterfactual that no model trained on routine care can answer without confounding by indication; two published emulations of the same labetalol-versus-nifedipine question reached different conclusions. Module 6 builds on these constraints. Any trajectories shown there are synthetic.'),
          WM.p('Open problems. Nobody has an interactive model that stays consistent for hours, or a video model that passes intuitive-physics tests at human level. Nobody has shown that the JEPA objective beats generation at scale, or the reverse, in a closed-loop comparison. The relation between scale and physical understanding is contested. Multi-agent interaction inside generated worlds is unsolved. Evaluation itself is unsettled: there is no agreed metric that a system can optimise without also learning to fool it. And no world model of any family has been built for, or validated on, a physiological system over the timescale of a pregnancy.')
        ),

        WM.takeaways([
          'Sort any system by <b>what it predicts</b> (pixels, a latent, only reward and value, or explicit 3D) and <b>whether it is action-conditioned</b>. Those two answers decide which questions it can be asked.',
          'DreamerV3 learned Minecraft online from scratch; Dreamer 4 learned it offline from 2,541 hours of human play and obtained diamonds in 0.7% of episodes. MuZero predicts no observation at all and still matched AlphaZero.',
          'V-JEPA 2-AC plans by rolling an action-conditioned predictor forward in embedding space and measuring distance to a goal embedding. It transferred zero-shot to real robot arms; on IntPhys 2 it stays close to chance, like the generative models.',
          'Reported consistency in the Genie line grew from 16 frames to up to two minutes in under three years, with no explicit 3D representation. Parameter counts are undisclosed, and physical correctness is not implied by realism.',
          'A good world model is shown by intervention, closed-loop task success, long-horizon consistency and out-of-distribution physics, not by next-step accuracy. The same tests apply to a model of pregnancy, where the closed-loop test is patient outcome.'
        ]),

        WM.quiz({
          id: 'q5', title: 'Check your understanding', questions: [
            { q: 'Which of these systems predicts no observation at all, only reward, value and policy?',
              options: ['Genie 3', 'MuZero', 'V-JEPA 2', 'Cosmos'], answer: 1,
              why: 'MuZero is value-equivalent: its hidden state is never asked to match the real state or to produce an image. Genie 3 and Cosmos generate frames; V-JEPA 2 predicts embeddings.' },
            { q: 'Sora produced convincing videos. Why is it not a world model in the sense an agent could plan with?',
              options: ['Its videos were too short', 'It took no action as input, so it cannot answer what-if questions about an agent’s choices, and its own report listed physics failures', 'It used diffusion rather than a transformer', 'It was trained on too little data'], answer: 1,
              why: 'Action conditioning is the defining test. Sora was conditioned on text, images or video only. Length, architecture and data size are not what separates a simulator of observations from a model an agent can use.' },
            { q: 'Which statement about the Dreamer results is correct?',
              options: ['Dreamer 4 learned Minecraft from scratch without any human data', 'DreamerV3 learned online from scratch; Dreamer 4 learned offline from recorded human play and obtained diamonds in 0.7% of episodes', 'Both agents reached human-level Minecraft play', 'Dreamer 4 needs the real game during training'], answer: 1,
              why: 'The two results are often conflated. DreamerV3 (Nature 2025) needed no human data but interacted online. Dreamer 4 never touched the game during training but learned from 2,541 hours of contractor video, only 100 hours of it with actions. Neither is at human level.' },
            { q: 'How does Genie 3 keep a scene consistent when the camera turns away and back?',
              options: ['It builds an explicit 3D mesh of the world', 'It uses Gaussian splats like World Labs Marble', 'Consistency is emergent from frame-by-frame generation with a window of recent frames; there is no explicit 3D representation', 'It stores a map in a database'], answer: 2,
              why: 'DeepMind states that Genie 3 generates autoregressively with about a minute of visual memory and no explicit 3D representation. World Labs’ Marble and Atlas, and Tencent HY-World, are the systems that output explicit 3D.' },
            { q: 'A model trained on city routes predicts the next turn with near-perfect accuracy. What did Vafa et al. (2024) show about such a model?',
              options: ['Near-perfect next-token accuracy guarantees it has learned the map', 'Its implied map can contain impossible streets, and valid routing collapses when detours are introduced', 'It cannot be probed for location', 'The model is overfitting and the fix is more data'], answer: 1,
              why: 'Next-token accuracy and state probes both looked excellent, yet the reconstructed map had impossible streets and flyovers, and valid routing fell to 8% with random detours at a 10% chance per step. Accuracy on familiar sequences is necessary, not sufficient.' },
            { q: 'You must choose between two world models for a robot task. Which single test is the best evidence?',
              options: ['Which produces more realistic video', 'Which has more parameters', 'Which gives higher task success when an agent plans with it in a closed loop', 'Which scores higher on next-frame reconstruction error'], answer: 2,
              why: 'World-in-World found that visual quality does not guarantee task success and that controllability matters more. Parameter counts are often undisclosed and do not predict usefulness. Reconstruction error is an open-loop metric.' }
          ]
        }),

        WM.goDeeper([
          { title: 'Hafner, Yan and Lillicrap (2025), Training Agents Inside of Scalable World Models (Dreamer 4)', url: 'https://arxiv.org/abs/2509.24527', note: 'Offline agent training in a 2B-parameter action-conditioned video model; the diamond result and its 0.7% rate.' },
          { title: 'Schrittwieser et al. (2019), Mastering Atari, Go, Chess and Shogi by Planning with a Learned Model (MuZero)', url: 'https://ar5iv.labs.arxiv.org/html/1911.08265', note: 'The value-equivalent model: reward, value and policy only.' },
          { title: 'Assran et al. (2025), V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction and Planning', url: 'https://arxiv.org/abs/2506.09985', note: 'Pretraining on 1M hours, the action-conditioned predictor and zero-shot robot planning.' },
          { title: 'Maes et al. (2026), LeWorldModel: Stable End-to-End Joint-Embedding Predictive Architecture from Pixels', url: 'https://arxiv.org/abs/2603.19312', note: 'A 15M-parameter JEPA world model trained end-to-end from pixels.' },
          { title: 'DeepMind (Aug 2025), Genie 3: a new frontier for world models', url: 'https://deepmind.google/blog/genie-3-a-new-frontier-for-world-models/', note: 'Real-time interactive generation; the limitations list is worth reading in full.' },
          { title: 'DeepMind (Oct 2026), Genie 4: a new generation of world simulation', url: 'https://deepmind.google/blog/genie-4-a-new-generation-of-world-simulation/', note: 'Native audio, Gemini as director, and the stated open problems.' },
          { title: 'NVIDIA (2025), Cosmos World Foundation Model Platform for Physical AI', url: 'https://arxiv.org/abs/2501.03575', note: 'Open-weight video world models and post-training for robotics and driving.' },
          { title: 'Waymo (Feb 2026), The Waymo World Model', url: 'https://waymo.com/blog/2026/02/the-waymo-world-model-a-new-frontier-for-autonomous-driving-simulation', note: 'Camera and lidar generation on Genie 3 for counterfactual driving.' },
          { title: 'Vafa et al. (2024), Evaluating the World Model Implicit in a Generative Model', url: 'https://arxiv.org/html/2406.03689v3', note: 'The taxi-route experiment and structure-aware evaluation metrics.' },
          { title: 'Li et al. (2023), Emergent World Representations: Exploring a Sequence Model Trained on a Synthetic Task (Othello-GPT)', url: 'https://arxiv.org/pdf/2210.13382', note: 'Probing and intervention on an internal board state.' },
          { title: 'Richens et al. (2025), General agents need world models (ICML 2025; the current arXiv version is titled “General agents contain world models”)', url: 'https://arxiv.org/abs/2506.01622', note: 'The theoretical argument that capable agents must contain predictive models.' },
          { title: 'Motamed et al. (2025), Do generative video models understand physical principles? (Physics-IQ)', url: 'https://arxiv.org/abs/2501.09038', note: '“Visual realism does not imply physical understanding.”' },
          { title: 'Bordes et al. (2025), IntPhys 2: Benchmarking Intuitive Physics Understanding in Complex Synthetic Environments', url: 'https://arxiv.org/abs/2506.09849', note: 'Intuitive-physics benchmark on which most models are at chance; the best, V-JEPA 2, stays below 60%.' },
          { title: 'World-in-World: World Models in a Closed-Loop World (2025)', url: 'https://arxiv.org/abs/2510.18135v1', note: 'Closed-loop evaluation: does the world model help the agent succeed?' },
          { title: 'Gemini Robotics Team (2025), Evaluating Gemini Robotics Policies in a Veo World Simulator', url: 'https://arxiv.org/abs/2512.10675v2', note: 'A video world model validated against 1,600+ real robot trials.' },
          { title: 'Li et al. (2025), A Comprehensive Survey on World Models for Embodied AI', url: 'https://www.arxiv.org/abs/2510.16732', note: 'A three-axis taxonomy of the field.' }
        ])
      );
    }
  });
})();
