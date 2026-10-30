/* ==========================================================================
   Module 2: States, actions and imagining ahead
   Audience: ~16 years, basic algebra.
   All pregnancy numbers are synthetic and illustrative.
   ========================================================================== */
(function () {
  'use strict';
  var WM = window.WM, D = WM.draw, h = WM.h;

  /* ====================================================================
     1. GRIDWORLD ENGINE (real computation used by every interactive)
     ==================================================================== */
  var NAMES = ['Up', 'Down', 'Left', 'Right'];
  var ARR = ['↑', '↓', '←', '→'];
  var DX = [0, 0, -1, 1], DY = [-1, 1, 0, 0];
  var FL = 0, WL = 1, HZ = 2, GL = 3, CH = '.#HG';
  var STEP = -1, R_GOAL = 20, R_HAZ = -20;
  var MINUS = '−';

  function parse(rows) {
    var w = { W: rows[0].length, H: rows.length, c: [], s: 0 };
    rows.forEach(function (r, y) {
      for (var x = 0; x < w.W; x++) {
        var ch = r.charAt(x);
        if (ch === 'S') { w.s = y * w.W + x; w.c.push(FL); } else w.c.push(Math.max(0, CH.indexOf(ch)));
      }
    });
    return w;
  }
  function clone(w) { return { W: w.W, H: w.H, c: w.c.slice(), s: w.s }; }
  /* The transition table: this is literally the model, T(s, a) -> s', plus rewards. */
  function table(w) {
    var key = w.c.join('');
    if (w._k === key) return w._T;
    var N = w.W * w.H, n = new Int16Array(N * 4), r = new Int16Array(N * 4), tg = new Int16Array(N * 4), d = new Uint8Array(N);
    for (var s = 0; s < N; s++) {
      var x = s % w.W, y = (s / w.W) | 0;
      d[s] = (w.c[s] === GL || w.c[s] === HZ) ? 1 : 0;
      for (var a = 0; a < 4; a++) {
        var nx = x + DX[a], ny = y + DY[a], inb = nx >= 0 && ny >= 0 && nx < w.W && ny < w.H;
        var t = s;
        if (inb && w.c[ny * w.W + nx] !== WL) t = ny * w.W + nx;
        var k = w.c[t];
        n[s * 4 + a] = t;
        tg[s * 4 + a] = inb ? ny * w.W + nx : -1;
        r[s * 4 + a] = STEP + (k === GL ? R_GOAL : k === HZ ? R_HAZ : 0);
      }
    }
    w._k = key; w._T = { n: n, r: r, d: d, tg: tg, N: N };
    return w._T;
  }
  function pos(w, s) { return '(' + (s % w.W) + ', ' + ((s / w.W) | 0) + ')'; }

  /* Exhaustive search: every action sequence up to the horizon, with a node budget. */
  function planExh(T, s0, H, budget, rng) {
    var best = -1e9, seq = [], cur = [], ties = 0, nodes = 0, aborted = false;
    function rec(s, d, ret) {
      for (var a = 0; a < 4; a++) {
        if (++nodes > budget) { aborted = true; return; }
        var i = s * 4 + a, r = ret + T.r[i], s2 = T.n[i];
        cur[d] = a;
        if (T.d[s2] || d + 1 === H) {
          if (r > best) { best = r; seq = cur.slice(0, d + 1); ties = 1; }
          else if (r === best) { ties++; if (rng() * ties < 1) seq = cur.slice(0, d + 1); }
        } else { rec(s2, d + 1, r); if (aborted) return; }
      }
    }
    if (T.d[s0] || H < 1) return { best: 0, seq: [], nodes: 0, aborted: false };
    rec(s0, 0, 0);
    return { best: best, seq: seq, nodes: nodes, aborted: aborted };
  }
  /* Merged search: because the state holds everything needed, keep only the best way to reach each state at each step. */
  function planMerged(T, s0, H, rng) {
    var N = T.N, NEG = -30000, cur = new Int32Array(N).fill(NEG), pars = [], nodes = 0, best = NEG, endL = -1, endS = -1, ties = 0;
    cur[s0] = 0;
    if (T.d[s0] || H < 1) return { best: 0, seq: [], nodes: 0, aborted: false };
    for (var d = 0; d < H; d++) {
      var nv = new Int32Array(N).fill(NEG), np = new Int32Array(N).fill(-1);
      for (var s = 0; s < N; s++) {
        if (cur[s] === NEG) continue;
        for (var a = 0; a < 4; a++) {
          nodes++;
          var i = s * 4 + a, s2 = T.n[i], v = cur[s] + T.r[i];
          if (v > nv[s2] || (v === nv[s2] && rng() < 0.5)) { nv[s2] = v; np[s2] = i; }
        }
      }
      pars.push(np);
      var nextCur = new Int32Array(N).fill(NEG);
      for (var u = 0; u < N; u++) {
        if (nv[u] === NEG) continue;
        var cand = T.d[u] || d === H - 1;
        if (cand) {
          if (nv[u] > best) { best = nv[u]; endL = d; endS = u; ties = 1; }
          else if (nv[u] === best) { ties++; if (rng() * ties < 1) { endL = d; endS = u; } }
        }
        if (!T.d[u]) nextCur[u] = nv[u];
      }
      cur = nextCur;
    }
    var seq = [], s3 = endS;
    for (var l = endL; l >= 0; l--) { var pi = pars[l][s3]; seq.unshift(pi & 3); s3 = pi >> 2; }
    return { best: best, seq: seq, nodes: nodes, aborted: false };
  }
  function pathStates(T, s0, seq) {
    var out = [s0], s = s0, ret = 0;
    for (var i = 0; i < seq.length; i++) { var k = s * 4 + seq[i]; ret += T.r[k]; s = T.n[k]; out.push(s); if (T.d[s]) break; }
    return { states: out, ret: ret, end: s };
  }
  /* Node counts by depth, for the cost chart. */
  function countExh(T, s0, HM) {
    var c = []; for (var i = 0; i <= HM; i++) c.push(0);
    (function rec(s, d) {
      for (var a = 0; a < 4; a++) { c[d + 1]++; var s2 = T.n[s * 4 + a]; if (!T.d[s2] && d + 1 < HM) rec(s2, d + 1); }
    })(s0, 0);
    var cum = [0]; for (var j = 1; j <= HM; j++) cum.push(cum[j - 1] + c[j]);
    return cum;
  }
  function countMerged(T, s0, HM) {
    var cum = [0], cur = new Uint8Array(T.N); cur[s0] = 1; var tot = 0;
    for (var d = 0; d < HM; d++) {
      var nx = new Uint8Array(T.N);
      for (var s = 0; s < T.N; s++) if (cur[s] && !T.d[s]) { for (var a = 0; a < 4; a++) { tot++; nx[T.n[s * 4 + a]] = 1; } }
      cum.push(tot); cur = nx;
    }
    return cum;
  }

  var MAP = ['.........', '.##.#.##.', 'S.......G', '.#H.#.H#.', '.........', '.H.....H.'];
  var CHOKE = 22; /* cell (4, 2): the short corridor */

  /* ====================================================================
     2. DRAWING HELPERS
     ==================================================================== */
  function drawWorld(g, env, w, o) {
    var c = env.c, cs = o.cs, x0 = o.x0, y0 = o.y0, i, k, x, y;
    var lab = Math.max(14, cs * 0.2);
    for (i = 0; i < w.W * w.H; i++) {
      k = w.c[i]; x = x0 + (i % w.W) * cs; y = y0 + ((i / w.W) | 0) * cs;
      D.box(g, x + 1, y + 1, cs - 2, cs - 2, { fill: k === WL ? c.reality : c.surface, stroke: c.line, lw: 1, alpha: k === WL ? 0.88 : 1 });
      if (k === HZ) {
        D.withAlpha(g, 0.16, function () { D.box(g, x + 1, y + 1, cs - 2, cs - 2, { fill: c.error }); });
        D.line(g, x + cs * 0.28, y + cs * 0.28, x + cs * 0.72, y + cs * 0.72, { color: c.error, lw: Math.max(3, cs * 0.05) });
        D.line(g, x + cs * 0.72, y + cs * 0.28, x + cs * 0.28, y + cs * 0.72, { color: c.error, lw: Math.max(3, cs * 0.05) });
      } else if (k === GL) {
        D.withAlpha(g, 0.18, function () { D.box(g, x + 1, y + 1, cs - 2, cs - 2, { fill: c.good }); });
        D.dot(g, x + cs / 2, y + cs / 2, cs * 0.3, { fill: false, stroke: c.good, lw: Math.max(3, cs * 0.05) });
        D.dot(g, x + cs / 2, y + cs / 2, cs * 0.12, { fill: c.good });
      }
      if (o.startTag && i === w.s) D.text(g, 'S', x + 6, y + 4, { size: lab, font: 'mono', color: c.muted, baseline: 'top' });
      if (o.ref && o.ref.c[i] !== k) {
        D.box(g, x + 4, y + 4, cs - 8, cs - 8, { r: 2, stroke: c.imagined, lw: 3, dash: true });
        D.text(g, '?', x + cs - 9, y + 5, { size: cs * 0.26, weight: 700, color: c.imagined, align: 'right', baseline: 'top' });
      }
    }
    if (o.labels) {
      for (var cx = 0; cx < w.W; cx++) D.text(g, String(cx), x0 + cx * cs + cs / 2, y0 - 6, { size: 18, font: 'mono', color: c.muted, align: 'center', baseline: 'bottom' });
      for (var cy = 0; cy < w.H; cy++) D.text(g, String(cy), x0 - 8, y0 + cy * cs + cs / 2, { size: 18, font: 'mono', color: c.muted, align: 'right', baseline: 'middle' });
    }
  }
  function ctr(w, geo, s) { return [geo.x0 + (s % w.W) * geo.cs + geo.cs / 2, geo.y0 + ((s / w.W) | 0) * geo.cs + geo.cs / 2]; }
  function drawAgent(g, env, p, r, imagined) {
    if (imagined) D.dot(g, p[0], p[1], r, { fill: false, stroke: env.c.imagined, lw: 4, dash: [4, 4] });
    else { D.dot(g, p[0], p[1], r, { fill: env.c.reality, stroke: env.c.stage, lw: 3 }); }
  }
  function drawTrail(g, env, w, geo, trail) {
    if (trail.length < 2) return;
    D.poly(g, trail.map(function (s) { return ctr(w, geo, s); }), { color: env.c.reality, lw: 4, alpha: 0.7 });
  }
  function drawPlan(g, env, w, geo, states, alpha, numbers) {
    var pts = states.map(function (s, i) { var p = ctr(w, geo, s), j = alpha ? 0 : 5 * ((i % 2) ? 1 : -1) * 0; return [p[0] + j, p[1]]; });
    if (pts.length > 1) D.poly(g, pts, { color: env.c.imagined, lw: alpha ? 2 : 4, dash: true, alpha: alpha || 1 });
    if (numbers) {
      for (var i = 1; i < pts.length && i <= 16; i++) {
        var ox = geo.cs * 0.24, oy = -geo.cs * 0.24;
        D.dot(g, pts[i][0] + ox, pts[i][1] + oy, 12, { fill: env.c.surface, stroke: env.c.imagined, lw: 2 });
        D.text(g, String(i), pts[i][0] + ox, pts[i][1] + oy + 1, { size: 15, weight: 700, color: env.c.imagined, align: 'center', baseline: 'middle' });
      }
    }
  }
  function fmt(n) { return (n < 0 ? MINUS : '') + Math.abs(n); }
  function fmtS(n) { return (n < 0 ? MINUS : n > 0 ? '+' : '') + Math.abs(n); }
  function sup(n) { var m = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }; return String(n).split('').map(function (ch) { return m[ch]; }).join(''); }
  function big(n) { return n >= 1e9 ? WM.ui.fmt(n / 1e9, 1) + ' billion' : n >= 1e6 ? WM.ui.fmt(n / 1e6, n >= 1e7 ? 0 : 1) + ' million' : Math.round(n).toLocaleString('en-US'); }

  function noticeReadout(label) {
    var r = WM.readout(label, '');
    var v = r.el.querySelector('.wm-readout__val');
    v.style.fontFamily = 'var(--font-body)'; v.style.fontSize = '1rem'; v.style.lineHeight = '1.45';
    r.el.style.flexBasis = '100%';
    v.setAttribute('aria-live', 'polite');
    return r;
  }

  /* ====================================================================
     3. EXPLAINER 1: state, action, transition, reward   (76 s)
     Script
       0-10  state: agent on a 6x4 grid, state = (column,row)
       10-22 actions: four arrows
       22-36 transition: Right moves; Up into a wall leaves the state unchanged; table rows appear
       36-50 model: whole table for one state, imagined destinations drawn dashed
       50-62 reward: +20 goal, -20 hazard, -1 per move
       62-76 a state must hold velocity: same height, different futures
     ==================================================================== */
  var E1W = parse(['...#.G', '.#....', '.#.H..', '....#.']);
  function drawE1(g, p, env) {
    var t = env.t, c = env.c, w = E1W, geo = { x0: 40, y0: 96, cs: 100 }, S0 = 1 * 6 + 2;
    var mapA = 1 - D.seg(t, 61, 62.5), ballA = D.seg(t, 62, 64);
    var sec = t < 10 ? 'State' : t < 22 ? 'Actions' : t < 36 ? 'Transitions' : t < 50 ? 'The model' : t < 62 ? 'Rewards' : 'What belongs in a state';
    D.text(g, sec, 40, 44, { size: 30, weight: 700, font: 'display', baseline: 'middle' });
    if (mapA > 0) D.withAlpha(g, mapA, function () {
      drawWorld(g, env, w, { x0: geo.x0, y0: geo.y0, cs: geo.cs, labels: t < 12 });
      // agent position over time
      var a = S0, off = [0, 0];
      var mv = D.ease(D.seg(t, 24, 26.5));
      var P0 = ctr(w, geo, S0), P1 = ctr(w, geo, S0 + 1), pa;
      if (t >= 36) pa = P0; else pa = [D.lerp(P0[0], P1[0], mv), P0[1]];
      if (t >= 30 && t < 36) { var b = D.seg(t, 31, 33); off = [0, -Math.sin(b * Math.PI) * 14]; }
      drawAgent(g, env, [pa[0] + off[0], pa[1] + off[1]], 30, false);
      // scene 1: label
      if (t < 12) {
        var al = D.seg(t, 2, 3.5);
        D.withAlpha(g, al, function () {
          D.box(g, 660, 120, 270, 120, { r: 3, fill: c.surface, stroke: c.line });
          D.text(g, 's = (2, 1)', 795, 160, { size: 36, weight: 700, font: 'mono', align: 'center', baseline: 'middle' });
          D.text(g, 'column 2, row 1', 795, 206, { size: 22, color: c.muted, align: 'center', baseline: 'middle' });
          D.arrow(g, 660, 170, pa[0] + 34, pa[1] - 6, { color: c.ink2, lw: 2, head: 9 });
        });
      }
      // scene 2: four actions
      if (t >= 10 && t < 24) {
        for (var i = 0; i < 4; i++) {
          var al2 = D.seg(t, 11 + i * 1.8, 12.6 + i * 1.8), L = 62 * al2, dxy = [[0, -1], [0, 1], [-1, 0], [1, 0]][i];
          D.withAlpha(g, al2, function () { D.arrow(g, P0[0] + dxy[0] * 38, P0[1] + dxy[1] * 38, P0[0] + dxy[0] * (38 + L), P0[1] + dxy[1] * (38 + L), { color: c.imagined, lw: 4, head: 12 }); });
        }
        var rows = ['Up', 'Down', 'Left', 'Right'];
        if (t < 22) for (var j = 0; j < 4; j++) D.withAlpha(g, D.seg(t, 11 + j * 1.8, 12.6 + j * 1.8), function () {
          D.text(g, ARR[j] + '  ' + rows[j], 690, 150 + j * 52, { size: 30, font: 'mono', baseline: 'middle' });
        });
        if (t < 22) D.text(g, 'a ∈ {Up, Down, Left, Right}', 660, 100, { size: 22, color: c.muted, baseline: 'middle' });
      }
      // scene 3: table rows
      if (t >= 22 && t < 36) {
        D.text(g, 'state, action → next state', 660, 110, { size: 22, color: c.muted, baseline: 'middle' });
        D.withAlpha(g, D.seg(t, 25, 26.5), function () {
          D.box(g, 660, 140, 280, 76, { r: 3, fill: c.surface, stroke: c.line });
          D.text(g, '(2,1) + Right', 674, 166, { size: 24, font: 'mono', baseline: 'middle' });
          D.text(g, '→ (3,1)', 674, 198, { size: 24, font: 'mono', baseline: 'middle', color: c.ink });
        });
        D.withAlpha(g, D.seg(t, 31, 32.5), function () {
          D.box(g, 660, 236, 280, 108, { r: 3, fill: c.surface, stroke: c.line });
          D.text(g, '(3,1) + Up', 674, 262, { size: 24, font: 'mono', baseline: 'middle' });
          D.text(g, '→ (3,1)', 674, 294, { size: 24, font: 'mono', baseline: 'middle' });
          D.text(g, 'wall: state unchanged', 674, 326, { size: 21, baseline: 'middle', color: c.muted });
        });
      }
      // scene 4: all four rows for one state, imagined destinations
      if (t >= 36 && t < 50) {
        var dest = [S0 - 6, S0 + 6, S0, S0 + 1];
        D.text(g, 's′ = T(s, a)', 660, 108, { size: 30, weight: 700, font: 'mono', baseline: 'middle' });
        D.text(g, 'from s = (2, 1)', 660, 140, { size: 22, color: c.muted, baseline: 'middle' });
        for (var m = 0; m < 4; m++) {
          var al4 = D.seg(t, 38 + m * 1.6, 39.5 + m * 1.6);
          var Q = ctr(w, geo, dest[m]);
          D.withAlpha(g, al4, function () {
            D.text(g, NAMES[m], 660, 184 + m * 48, { size: 24, font: 'mono', baseline: 'middle' });
            D.text(g, '→ ' + pos(w, dest[m]), 760, 184 + m * 48, { size: 24, font: 'mono', baseline: 'middle' });
            if (m !== 2) D.dot(g, Q[0], Q[1], 30, { fill: false, stroke: c.imagined, lw: 4, dash: [4, 4] });
            else D.text(g, 'stays', ctr(w, geo, S0 - 1)[0], ctr(w, geo, S0 - 1)[1], { size: 22, weight: 700, color: c.stage, baseline: 'middle', align: 'center' });
          });
        }
        D.withAlpha(g, D.seg(t, 45, 47), function () { D.text(g, 'and so on for every cell', 660, 420, { size: 22, color: c.muted, baseline: 'middle' }); });
      }
      // scene 5: rewards
      if (t >= 50) {
        var a5 = D.seg(t, 51, 53);
        D.withAlpha(g, a5, function () {
          var G = ctr(w, geo, 5), H = ctr(w, geo, 15);
          D.text(g, '+20', G[0], G[1] + 44, { size: 26, weight: 700, color: c.good, align: 'center', baseline: 'middle', halo: true });
          D.text(g, MINUS + '20', H[0], H[1] + 44, { size: 26, weight: 700, color: c.error, align: 'center', baseline: 'middle', halo: true });
          D.box(g, 660, 140, 270, 220, { r: 3, fill: c.surface, stroke: c.line });
          D.text(g, 'goal', 676, 172, { size: 24, baseline: 'middle' }); D.text(g, '+20', 916, 172, { size: 24, font: 'mono', align: 'right', baseline: 'middle', color: c.good });
          D.text(g, 'hazard', 676, 218, { size: 24, baseline: 'middle' }); D.text(g, MINUS + '20', 916, 218, { size: 24, font: 'mono', align: 'right', baseline: 'middle', color: c.error });
          D.text(g, 'each move', 676, 264, { size: 24, baseline: 'middle' }); D.text(g, MINUS + '1', 916, 264, { size: 24, font: 'mono', align: 'right', baseline: 'middle' });
          D.text(g, 'shorter routes score higher', 676, 306, { size: 20, color: c.muted, baseline: 'top', maxWidth: 240, lineHeight: 1.2 });
        });
      }
    });
    if (ballA > 0) D.withAlpha(g, ballA, function () {
      var cols = [[60, 'moving up'], [520, 'moving down']], gy = 480;
      for (var q = 0; q < 2; q++) {
        var bx = cols[q][0] + 190;
        D.line(g, cols[q][0], gy, cols[q][0] + 380, gy, { color: c.reality, lw: 4 });
        D.line(g, bx, gy, bx, 130, { color: c.faint, lw: 2 });
        D.text(g, 'height 3 m', bx + 36, 330, { size: 20, color: c.muted, baseline: 'middle' });
        D.dot(g, bx, 300, 22, { fill: c.reality, stroke: c.stage, lw: 3 });
        var dir = q === 0 ? -1 : 1, grow = D.seg(t, 64, 66);
        D.arrow(g, bx, 300 + dir * 30, bx, 300 + dir * (30 + 70 * grow), { color: c.accent2, lw: 5, head: 13 });
        D.text(g, cols[q][1], bx, 104, { size: 26, weight: 700, align: 'center', baseline: 'middle' });
        var nz = D.seg(t, 68, 70.5);
        D.withAlpha(g, nz, function () {
          D.dot(g, bx, 300 + dir * 130, 22, { fill: false, stroke: c.imagined, lw: 4, dash: [4, 4] });
          D.text(g, 'next: ' + (q === 0 ? 'higher' : 'lower'), bx + 40, 300 + dir * 130, { size: 22, color: c.imagined, baseline: 'middle' });
        });
      }
      D.withAlpha(g, D.seg(t, 71, 73), function () { D.text(g, 'same position, different future: velocity is part of the state', 480, 516, { size: 24, weight: 600, align: 'center', baseline: 'middle' }); });
    });
  }

  /* ====================================================================
     4. EXPLAINER 2: planning by rollout   (96 s)
     Script
       0-10  agent at (2,1), goal at (5,0); the agent has a model
       10-24 imagined sequence 1 (Down, Right) -> hazard, return -22; the solid agent has not moved
       24-38 imagined sequence 2 (R,R,R,U) -> goal, return +16
       38-56 branching: 4, 16, 64 sequences
       56-72 score all 4-step sequences (256), histogram of returns, keep the best
       72-86 act once (Right), observe, plan again from (3,1)
       86-96 recap
     ==================================================================== */
  var E2W = parse(['...#.G', '.#....', '.#.H..', '....#.']);
  var E2T = table(E2W), E2S = 8;
  var E2A = [1, 3], E2B = [3, 3, 3, 0];
  var E2PA = pathStates(E2T, E2S, E2A), E2PB = pathStates(E2T, E2S, E2B);
  var E2HIST = (function () {
    var m = {}, tot = 0;
    (function rec(s, d, ret) {
      for (var a = 0; a < 4; a++) {
        var i = s * 4 + a, r = ret + E2T.r[i], s2 = E2T.n[i];
        if (E2T.d[s2] || d + 1 === 4) { m[r] = (m[r] || 0) + 1; tot++; } else rec(s2, d + 1, r);
      }
    })(E2S, 0, 0);
    var ks = Object.keys(m).map(Number).sort(function (a, b) { return b - a; });
    return { keys: ks, m: m, max: Math.max.apply(null, ks.map(function (k) { return m[k]; })), tot: tot };
  })();
  var E2PR = pathStates(E2T, 9, [3, 3, 0]); /* replan from (3,1): Right, Right, Up */
  function drawE2(g, p, env) {
    var t = env.t, c = env.c, w = E2W, geo = { x0: 30, y0: 104, cs: 84 };
    var heads = ['Where we start', 'Imagining sequence 1', 'Imagining sequence 2', 'Many possible sequences', 'Scoring every sequence', 'Act once, then plan again', 'Model plus search'];
    var hi = t < 10 ? 0 : t < 24 ? 1 : t < 38 ? 2 : t < 56 ? 3 : t < 72 ? 4 : t < 86 ? 5 : 6;
    D.text(g, heads[hi], 30, 44, { size: 30, weight: 700, font: 'display', baseline: 'middle' });
    drawWorld(g, env, w, { x0: geo.x0, y0: geo.y0, cs: geo.cs });
    var real = E2S, P = function (s) { return ctr(w, geo, s); };
    if (t >= 76) real = 9;
    var realPos = P(E2S);
    if (t >= 74 && t < 76.5) { var m = D.ease(D.seg(t, 74, 76)); realPos = [D.lerp(P(8)[0], P(9)[0], m), P(8)[1]]; } else if (t >= 76.5) realPos = P(9);
    function ghostPath(ps, t0, dt) { // returns position of ghost along states, with steps
      var n = ps.states.length - 1, u = D.clamp((t - t0) / dt, 0, 1) * n, i = Math.min(n - 1, Math.floor(u)), f = u - i;
      var a = P(ps.states[i]), b = P(ps.states[i + 1]);
      return { p: [D.lerp(a[0], b[0], D.ease(f)), D.lerp(a[1], b[1], D.ease(f))], k: u };
    }
    function drawGhost(ps, t0, dt, col) {
      var gp = ghostPath(ps, t0, dt), n = ps.states.length - 1, pts = [];
      for (var i = 0; i <= Math.min(n, Math.floor(gp.k)); i++) pts.push(P(ps.states[i]));
      pts.push(gp.p);
      D.poly(g, pts, { color: c.imagined, lw: 4, dash: true });
      drawAgent(g, env, gp.p, 28, true);
      for (var j = 1; j <= Math.min(n, Math.floor(gp.k + 0.0)); j++) {
        D.dot(g, P(ps.states[j])[0] + 20, P(ps.states[j])[1] - 20, 12, { fill: c.surface, stroke: c.imagined, lw: 2 });
        D.text(g, String(j), P(ps.states[j])[0] + 20, P(ps.states[j])[1] - 19, { size: 15, weight: 700, color: c.imagined, align: 'center', baseline: 'middle' });
      }
    }
    var RX = 560;
    // scorecard
    if (t >= 10 && t < 38) {
      D.text(g, 'Imagined sequences', RX, 110, { size: 22, color: c.muted, baseline: 'middle' });
      if (t >= 17.5) D.withAlpha(g, D.seg(t, 17.5, 19), function () {
        D.box(g, RX, 134, 370, 74, { r: 3, fill: c.surface, stroke: c.line });
        D.text(g, 'Down, Right', RX + 14, 160, { size: 24, font: 'mono', baseline: 'middle' });
        D.text(g, 'hazard   ' + MINUS + '22', RX + 14, 190, { size: 24, font: 'mono', baseline: 'middle', color: c.error });
      });
      if (t >= 34) D.withAlpha(g, D.seg(t, 34, 35.5), function () {
        D.box(g, RX, 224, 370, 74, { r: 3, fill: c.surface, stroke: c.line });
        D.text(g, 'Right, Right, Right, Up', RX + 14, 250, { size: 24, font: 'mono', baseline: 'middle' });
        D.text(g, 'goal   +16', RX + 14, 280, { size: 24, font: 'mono', baseline: 'middle', color: c.good });
      });
    }
    if (t < 38) {
      if (t >= 10 && t < 24) drawGhost(E2PA, 12, 5.5);
      else if (t >= 24) drawGhost(E2PB, 26, 6.5);
    }
    // real agent
    drawAgent(g, env, realPos, 28, false);
    if (t >= 10 && t < 38) D.text(g, 'real agent has not moved', 30, geo.y0 + 4 * 84 + 34, { size: 22, color: c.muted, baseline: 'middle' });
    if (t < 10) {
      D.withAlpha(g, D.seg(t, 2, 3.5), function () {
        var G = P(5); D.dot(g, G[0], G[1], 40 + 6 * Math.sin(t * 3), { fill: false, stroke: c.good, lw: 3 });
        D.text(g, 'goal (5, 0)', RX, 130, { size: 26, baseline: 'middle', color: c.good, weight: 600 });
        D.text(g, 'agent (2, 1)', RX, 176, { size: 26, baseline: 'middle', weight: 600 });
        D.text(g, 'It also has a model T(s, a).', RX, 232, { size: 24, baseline: 'middle', color: c.ink2 });
        D.text(g, 'It can run the model forward', RX, 268, { size: 24, baseline: 'middle', color: c.imagined });
        D.text(g, 'without moving.', RX, 300, { size: 24, baseline: 'middle', color: c.imagined });
      });
    }
    // tree
    if (t >= 38 && t < 56) {
      var rx = 585, ry = 312, cols = [rx, rx + 90, rx + 195, rx + 300], counts = [1, 4, 16, 64], ys = [];
      var pts = [[rx, ry]];
      for (var L = 1; L <= 3; L++) {
        var n = counts[L], sp = L === 3 ? 4.6 : L === 2 ? 16 : 52, arr = [];
        for (var i = 0; i < n; i++) arr.push([cols[L], ry + (i - (n - 1) / 2) * sp]);
        ys.push(arr);
      }
      var shown = [D.seg(t, 39, 41), D.seg(t, 43, 45), D.seg(t, 47, 49.5)];
      for (var L2 = 1; L2 <= 3; L2++) {
        var par = L2 === 1 ? [[rx, ry]] : ys[L2 - 2], per = counts[L2] / par.length;
        D.withAlpha(g, shown[L2 - 1], function () {
          for (var i2 = 0; i2 < ys[L2 - 1].length; i2++) {
            var pp = par[Math.floor(i2 / per)]; D.line(g, pp[0], pp[1], ys[L2 - 1][i2][0], ys[L2 - 1][i2][1], { color: c.imagined, lw: L2 === 3 ? 1 : 2, dash: L2 < 3, alpha: L2 === 3 ? 0.55 : 0.9 });
          }
          for (var i3 = 0; i3 < ys[L2 - 1].length; i3++) D.dot(g, ys[L2 - 1][i3][0], ys[L2 - 1][i3][1], L2 === 3 ? 1.8 : L2 === 2 ? 4 : 7, { fill: c.imagined });
        });
      }
      D.dot(g, rx, ry, 9, { fill: c.reality });
      var labs = [['start', 1], ['4', 4], ['16', 16], ['64', 64]];
      for (var q = 1; q <= 3; q++) D.withAlpha(g, shown[q - 1], function () {
        D.text(g, String(counts[q]), cols[q], 104, { size: 28, weight: 700, font: 'mono', align: 'center', baseline: 'middle' });
        D.text(g, q + (q === 1 ? ' step' : ' steps'), cols[q], 132, { size: 20, color: c.muted, align: 'center', baseline: 'middle' });
      });
      D.withAlpha(g, D.seg(t, 51, 53), function () { D.text(g, '4 choices per step, so 4ⁿ', RX, 486, { size: 22, color: c.ink2, baseline: 'middle' }); });
    }
    // histogram
    if (t >= 56 && t < 72) {
      var a0 = D.seg(t, 57, 59);
      D.text(g, 'All ' + E2HIST.tot + ' imagined sequences', RX, 108, { size: 22, color: c.muted, baseline: 'middle' });
      D.text(g, 'return          count', RX, 140, { size: 20, font: 'mono', color: c.muted, baseline: 'middle' });
      E2HIST.keys.forEach(function (k, i) {
        var y = 176 + i * 52, bw = Math.max(8, 190 * E2HIST.m[k] / E2HIST.max) * a0, best = i === 0;
        D.withAlpha(g, D.seg(t, 57 + i * 0.5, 58.5 + i * 0.5), function () {
          D.text(g, fmtS(k), RX, y, { size: 24, font: 'mono', baseline: 'middle', color: best ? c.good : k < -10 ? c.error : c.ink, weight: best ? 700 : 400 });
          D.box(g, RX + 82, y - 15, bw, 30, { fill: best ? c.good : k < -10 ? c.error : c.muted, alpha: 0.75 });
          D.text(g, String(E2HIST.m[k]), RX + 90 + bw, y, { size: 22, font: 'mono', baseline: 'middle' });
        });
      });
      D.withAlpha(g, D.seg(t, 64, 66), function () {
        var yb = 176;
        D.box(g, RX - 8, yb - 24, 380, 48, { r: 3, stroke: c.good, lw: 3 });
        D.text(g, 'keep the best', RX + 364, yb, { size: 22, color: c.good, weight: 700, align: 'right', baseline: 'middle' });
      });
    }
    // act once, replan
    if (t >= 72 && t < 86) {
      D.text(g, '1  Imagine with the model', RX, 130, { size: 24, baseline: 'middle', color: c.imagined });
      D.text(g, '2  Score and pick the best', RX, 176, { size: 24, baseline: 'middle' });
      D.withAlpha(g, D.seg(t, 73, 74.5), function () { D.text(g, '3  Do the first action only', RX, 222, { size: 24, baseline: 'middle', weight: 700 }); });
      D.withAlpha(g, D.seg(t, 77, 78.5), function () { D.text(g, '4  Observe, then plan again', RX, 268, { size: 24, baseline: 'middle', color: c.imagined }); });
      if (t >= 78) {
        var gp = D.seg(t, 78.5, 83);
        var pts2 = [], n2 = E2PR.states.length - 1, u = gp * n2;
        for (var i4 = 0; i4 <= Math.floor(u) && i4 <= n2; i4++) pts2.push(P(E2PR.states[i4]));
        if (u < n2) { var fa = P(E2PR.states[Math.floor(u)]), fb = P(E2PR.states[Math.floor(u) + 1]), ff = u - Math.floor(u); pts2.push([D.lerp(fa[0], fb[0], ff), D.lerp(fa[1], fb[1], ff)]); }
        D.poly(g, pts2, { color: c.imagined, lw: 4, dash: true });
        drawAgent(g, env, pts2[pts2.length - 1], 28, true);
      }
    }
    if (t >= 86) {
      D.withAlpha(g, D.seg(t, 86.5, 88.5), function () {
        D.text(g, 'model + search = planner', RX, 150, { size: 28, weight: 700, baseline: 'middle' });
        D.text(g, 'The hazard was found', RX, 212, { size: 24, baseline: 'middle' });
        D.text(g, 'by imagining it,', RX, 246, { size: 24, baseline: 'middle' });
        D.text(g, 'not by walking into it.', RX, 280, { size: 24, baseline: 'middle' });
      });
      D.withAlpha(g, D.seg(t, 90, 92), function () { D.text(g, 'Next: what it costs, and when the model is wrong.', RX, 350, { size: 22, color: c.muted, baseline: 'middle', maxWidth: 370, lineHeight: 1.3 }); });
    }
  }

  /* ====================================================================
     5. EXPLAINER 3: ball and cliff   (82 s)
     Script
       0-10  ball 10 m from a cliff edge; friction slows it
       10-24 model: deceleration 2.0 m/s2; push at 5.7 m/s to stop at 8 m (dashed ghost)
       24-40 reality: 1.5 m/s2; same push; solid ball slides past 8, over the edge at 2.8 s
       40-55 position error over time: gap grows until the real ball stops or falls
       55-70 numbers: 25% friction error, 8.0 vs 10.7 m, margin 2 m
       70-82 remedies: margin; compare prediction with measurement (a surprise)
     ==================================================================== */
  var AM = 2.0, AR = 1.5, EDGE = 10, V0 = Math.sqrt(2 * AM * 8), BG = 340;
  function ballX(a, v, t) { var ts = v / a, tt = Math.min(t, ts); return v * tt - 0.5 * a * tt * tt; }
  function bsx(m) { return 70 + m * 68; }
  function scenery(g, env, labels) {
    var c = env.c, ex = bsx(EDGE);
    D.box(g, 0, BG, ex, 540 - BG, { fill: c.faint, stroke: c.line, lw: 1 });
    D.line(g, 0, BG, ex, BG, { color: c.reality, lw: 4 });
    D.line(g, ex, BG, ex, 540, { color: c.reality, lw: 4 });
    D.line(g, ex, 508, 960, 508, { color: c.muted, lw: 2 });
    if (labels) {
      D.text(g, 'start', bsx(0), BG + 34, { size: 20, color: c.muted, align: 'center', baseline: 'middle' });
      D.text(g, 'edge, 10 m', ex - 8, BG + 34, { size: 20, color: c.muted, align: 'right', baseline: 'middle' });
    }
  }
  function realBall(t) { // returns {x (m), y (px), fell}
    var ex = EDGE, te = (V0 - Math.sqrt(Math.max(0, V0 * V0 - 2 * AR * ex))) / AR;
    if (t < te) return { x: ballX(AR, V0, t), y: BG - 18, fell: false };
    var vx = V0 - AR * te, dt = Math.min(t - te, 0.6), y = BG - 18 + 0.5 * 900 * dt * dt;
    return { x: ex + vx * dt, y: Math.min(y, 508 - 18), fell: true };
  }
  function drawE3(g, p, env) {
    var t = env.t, c = env.c;
    var heads = ['A ball and a cliff', 'The model’s plan', 'Reality', 'The error grows', 'A small error, a big miss', 'What helps'];
    var hi = t < 10 ? 0 : t < 24 ? 1 : t < 40 ? 2 : t < 55 ? 3 : t < 70 ? 4 : 5;
    D.text(g, heads[hi], 40, 44, { size: 30, weight: 700, font: 'display', baseline: 'middle' });
    var tt = t < 24 ? Math.max(0, t - 12) : t < 40 ? Math.max(0, t - 26) : 0;
    if (t < 40 || t >= 70) {
      scenery(g, env, true);
      if (t >= 70) { drawRemedy(g, env, t); return; }
      var by = BG - 18, x0 = bsx(0);
      // ball always drawn
      if (t < 24) {
        drawAgentBall(g, env, bsx(0), by, false);
        D.withAlpha(g, D.seg(t, 1, 3), function () {
          D.arrow(g, bsx(0) + 30, by - 50, bsx(10) - 20, by - 50, { color: c.muted, lw: 2, head: 10 });
          D.text(g, '10 m', (bsx(0) + bsx(10)) / 2, by - 80, { size: 22, color: c.muted, align: 'center', baseline: 'middle' });
        });
        D.withAlpha(g, D.seg(t, 4.5, 6.5) * (1 - D.seg(t, 9, 10)), function () { D.text(g, 'Floor friction slows the ball. We push once and want it to stop short of the edge.', 40, 130, { size: 24, maxWidth: 800, lineHeight: 1.35, baseline: 'top' }); });
        if (t >= 10) {
          D.withAlpha(g, D.seg(t, 10, 11.5), function () {
            D.text(g, 'Model: friction slows the ball by 2.0 m/s²', 40, 110, { size: 24, color: c.imagined, baseline: 'middle', weight: 600 });
            D.text(g, 'To stop at 8 m, push at 5.7 m/s', 40, 146, { size: 24, color: c.imagined, baseline: 'middle', weight: 600 });
          });
          var gx = ballX(AM, V0, tt);
          D.line(g, bsx(0), by + 34, bsx(gx), by + 34, { color: c.imagined, lw: 3, dash: true });
          drawAgentBall(g, env, bsx(gx), by, true);
          D.withAlpha(g, D.seg(t, 19, 21), function () {
            D.line(g, bsx(8), by - 44, bsx(8), by + 50, { color: c.imagined, lw: 3, dash: true });
            D.text(g, 'predicted stop 8.0 m', bsx(8), by - 62, { size: 22, color: c.imagined, align: 'center', baseline: 'middle', weight: 600 });
          });
        }
      } else {
        var rb = realBall(tt), gx2 = ballX(AM, V0, tt);
        D.withAlpha(g, D.seg(t, 24, 25.5), function () {
          D.text(g, 'Reality: the floor is slicker, 1.5 m/s²', 40, 110, { size: 24, weight: 600, baseline: 'middle' });
          D.text(g, 'Same push, same 5.7 m/s', 40, 146, { size: 24, baseline: 'middle' });
        });
        D.line(g, bsx(8), by - 44, bsx(8), by + 50, { color: c.imagined, lw: 3, dash: true });
        drawAgentBall(g, env, bsx(gx2), by, true);
        drawAgentBall(g, env, bsx(rb.x), rb.y, false);
        if (rb.fell && t > 29.5) D.withAlpha(g, D.seg(t, 29.8, 31.2), function () { D.text(g, 'over the edge', 940, 440, { size: 26, weight: 700, color: c.error, align: 'right', baseline: 'middle' }); });
        D.withAlpha(g, D.seg(t, 32, 34), function () { D.text(g, 'The model thought it was safe.', 40, 200, { size: 26, weight: 700, color: c.error, baseline: 'middle' }); });
      }
      return;
    }
    // plot scenes 40-70
    var ax = D.axes(g, 120, 110, 760, 340, { xlabel: 'time (s)', ylabel: 'position (m)', xticks: [[0, '0'], [1 / 4.5, '1'], [2 / 4.5, '2'], [3 / 4.5, '3'], [4 / 4.5, '4']], yticks: [[0, '0'], [5 / 12, '5'], [10 / 12, '10']], size: 20 });
    var sh = D.seg(t, 41, 46);
    var Mx = [], Rx = [];
    var TE = (V0 - Math.sqrt(V0 * V0 - 2 * AR * EDGE)) / AR;
    for (var i = 0; i <= 90; i++) { var ti = i / 90 * 4.5; Mx.push([ax.x(ti / 4.5), ax.y(ballX(AM, V0, ti) / 12)]); if (ti <= TE) Rx.push([ax.x(ti / 4.5), ax.y(ballX(AR, V0, ti) / 12)]); }
    Rx.push([ax.x(TE / 4.5), ax.y(EDGE / 12)]);
    D.line(g, ax.x(0), ax.y(10 / 12), ax.x(1), ax.y(10 / 12), { color: c.muted, lw: 2, dash: [8, 6] });
    D.text(g, 'edge', ax.x(1) - 4, ax.y(10 / 12) - 14, { size: 20, color: c.muted, align: 'right', baseline: 'middle' });
    D.poly(g, Mx, { color: c.imagined, lw: 4, dash: true, progress: sh });
    D.poly(g, Rx, { color: c.reality, lw: 4, progress: sh });
    D.withAlpha(g, D.seg(sh, 0.62, 0.7), function () { D.text(g, 'leaves the floor', ax.x(TE / 4.5), ax.y(EDGE / 12) - 16, { size: 20, color: c.error, weight: 700, align: 'center', baseline: 'middle' }); D.dot(g, ax.x(TE / 4.5), ax.y(EDGE / 12), 7, { fill: c.error }); });
    D.text(g, 'model', ax.x(0.8), ax.y(8 / 12) + 26, { size: 22, color: c.imagined, weight: 700, baseline: 'middle' });
    D.text(g, 'reality', ax.x(0.36), ax.y(ballX(AR, V0, 1.6) / 12) - 24, { size: 22, weight: 700, baseline: 'middle', align: 'right' });
    var steps = 0;
    for (var k = 1; k <= 10; k++) {
      var tk = k * 0.4; if (tk / 4.5 > sh) break;
      if (tk > TE) break;
      var a = ballX(AM, V0, tk), b = ballX(AR, V0, tk);
      D.line(g, ax.x(tk / 4.5), ax.y(a / 12), ax.x(tk / 4.5), ax.y(b / 12), { color: c.error, lw: 3 });
    }
    if (t >= 47) D.withAlpha(g, D.seg(t, 47, 49), function () {
      D.text(g, 'gap = error', ax.x(0.3), ax.y(0.2), { size: 24, weight: 700, color: c.error, baseline: 'middle', align: 'center' });
    });
    if (t >= 55) {
      D.withAlpha(g, D.seg(t, 55, 57), function () {
        D.box(g, 540, 296, 350, 146, { r: 3, fill: c.surface, stroke: c.line });
        D.text(g, 'friction error', 556, 324, { size: 22, baseline: 'middle' }); D.text(g, '25%', 876, 324, { size: 22, font: 'mono', align: 'right', baseline: 'middle' });
        D.text(g, 'predicted stop', 556, 358, { size: 22, color: c.imagined, baseline: 'middle' }); D.text(g, '8.0 m', 876, 358, { size: 22, font: 'mono', color: c.imagined, align: 'right', baseline: 'middle' });
        D.text(g, 'would stop at', 556, 392, { size: 22, baseline: 'middle' }); D.text(g, '10.7 m', 876, 392, { size: 22, font: 'mono', align: 'right', baseline: 'middle' });
        D.text(g, 'planned margin', 556, 426, { size: 22, color: c.muted, baseline: 'middle' }); D.text(g, '2.0 m', 876, 426, { size: 22, font: 'mono', color: c.muted, align: 'right', baseline: 'middle' });
      });
      D.withAlpha(g, D.seg(t, 61, 63), function () { D.text(g, 'Nothing inside the model signalled a problem.', 480, 504, { size: 24, weight: 700, color: c.error, align: 'center', baseline: 'middle' }); });
    }
  }
  function drawAgentBall(g, env, x, y, ghost) {
    if (ghost) D.dot(g, x, y, 18, { fill: false, stroke: env.c.imagined, lw: 4, dash: [4, 4] });
    else D.dot(g, x, y, 18, { fill: env.c.reality, stroke: env.c.stage, lw: 3 });
  }
  function drawRemedy(g, env, t) {
    var c = env.c, by = BG - 18;
    D.withAlpha(g, D.seg(t, 70, 71.5), function () {
      D.text(g, '1  Leave a margin that covers plausible error', 40, 104, { size: 24, weight: 600, baseline: 'middle' });
      D.line(g, bsx(5.0), by - 40, bsx(5.0), by + 40, { color: c.good, lw: 3 });
      D.arrow(g, bsx(5.0) + 8, by - 52, bsx(10) - 8, by - 52, { color: c.good, lw: 3, head: 10 });
      D.text(g, 'aim for a stop here, far from the edge', (bsx(5) + bsx(10)) / 2, by - 78, { size: 21, color: c.good, align: 'center', baseline: 'middle' });
    });
    D.withAlpha(g, D.seg(t, 74, 75.5), function () {
      D.text(g, '2  Compare prediction with measurement, and plan again', 40, 150, { size: 24, weight: 600, baseline: 'middle' });
    });
    var a = D.seg(t, 76, 79), tm = 1.0, xm = ballX(AM, V0, tm), xr = ballX(AR, V0, tm);
    D.withAlpha(g, a, function () {
      drawAgentBall(g, env, bsx(xm), by, true);
      drawAgentBall(g, env, bsx(xr), by, false);
      D.line(g, bsx(xm), by + 34, bsx(xr), by + 34, { color: c.error, lw: 4 });
      D.text(g, 'at 1 s: predicted ' + WM.ui.fmt(xm, 2) + ' m, measured ' + WM.ui.fmt(xr, 2) + ' m', 40, 184, { size: 22, baseline: 'middle', font: 'mono' });
    });
    D.withAlpha(g, D.seg(t, 79.5, 81), function () { D.text(g, 'The gap is a surprise. It says the model is wrong.', 40, 214, { size: 24, weight: 700, color: c.error, baseline: 'middle' }); });
  }

  /* ====================================================================
     6. INTERACTIVE: GRIDWORLD CANVAS + PAINTING
     ==================================================================== */
  var GEO = { x0: 30, y0: 30, cs: 84 };
  function gridCanvas(cfg) {
    var lastCell = -1;
    var cv = WM.canvas({
      w: 800, h: 540, label: cfg.label,
      pointer: function (type, x, y) {
        if (type === 'up' || type === 'leave') { lastCell = -1; return; }
        if (type !== 'down' && type !== 'move') return;
        var w = cfg.world(), cx = Math.floor((x - GEO.x0) / GEO.cs), cy = Math.floor((y - GEO.y0) / GEO.cs);
        if (cx < 0 || cy < 0 || cx >= w.W || cy >= w.H) return;
        var i = cy * w.W + cx;
        if (type === 'move' && i === lastCell) return;
        lastCell = i; cfg.onCell(i, type);
      },
      draw: function (g, env) {
        var w = cfg.world();
        drawWorld(g, env, w, { x0: GEO.x0, y0: GEO.y0, cs: GEO.cs, labels: true, startTag: true, ref: cfg.ref ? cfg.ref() : null });
        if (cfg.extra) cfg.extra(g, env, w, GEO);
      }
    });
    return cv;
  }
  var TOOLS = [{ value: 'play', label: 'Play' }, { value: 'wall', label: 'Paint wall' }, { value: 'hazard', label: 'Paint hazard' }, { value: 'goal', label: 'Paint goal' }, { value: 'floor', label: 'Erase to floor' }, { value: 'start', label: 'Move start' }];
  function paint(w, i, tool, protect) {
    if (i === w.s && tool !== 'start' && tool !== 'floor') return false;
    if (protect !== undefined && i === protect && tool !== 'floor' && tool !== 'start') return false;
    if (tool === 'start') { if (w.c[i] === WL) return false; w.s = i; w.c[i] = FL; return true; }
    var v = tool === 'wall' ? WL : tool === 'hazard' ? HZ : tool === 'goal' ? GL : FL;
    if (w.c[i] === v) return false;
    if (i === w.s && v !== FL) return false;
    w.c[i] = v; return true;
  }

  /* ---- Interactive A: walk the world by hand and watch the transition table ---- */
  function buildLab() {
    var w = parse(MAP), agent = w.s, ret = 0, trail = [agent], log = [], tool = 'play', last = null;
    var rS = WM.readout('State s', pos(w, agent)), rA = WM.readout('Action a', '—'), rN = WM.readout('Next state s′', '—'), rR = WM.readout('Reward r', '—'), rT = WM.readout('Return so far', '0');
    var notice = noticeReadout('What you should notice');
    var pre = h('pre', { style: { margin: '0', padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '.82rem', lineHeight: '1.55', color: 'var(--ink-2)', background: 'var(--surface)', border: '1px solid var(--faint)', borderRadius: 'var(--r)', overflowX: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minHeight: '9.4em' }, 'aria-label': 'Transition log' });
    function say(m) { notice.set(m); }
    function refresh() {
      rS.set(pos(w, agent)); rT.set(fmt(ret));
      pre.textContent = log.length ? log.slice(-6).join('\n') : 'Each move you make adds one line here: state, action, next state, reward.';
      cv.redraw();
    }
    function move(a) {
      var T = table(w);
      if (T.d[agent]) { say('The attempt has ended. Press Reset agent to start again.'); return; }
      var i = agent * 4 + a, s2 = T.n[i], r = T.r[i], bump = s2 === agent;
      log.push(pos(w, agent) + ' + ' + NAMES[a].padEnd(5) + ' → ' + pos(w, s2) + '   r = ' + fmt(r) + (bump ? '   (blocked)' : ''));
      rA.set(NAMES[a]); rN.set(pos(w, s2)); rR.set(fmt(r));
      agent = s2; ret += r; trail.push(s2);
      if (T.d[s2]) say(w.c[s2] === GL ? 'Goal reached. Return ' + fmt(ret) + '. A longer route would have paid less.' : 'Hazard. The attempt ends with a return of ' + fmt(ret) + '.');
      else if (bump) say('Blocked by a wall or the edge: the next state equals the current state, but the move still costs 1.');
      else say('The next state depends only on where you are and which action you chose.');
      refresh();
    }
    var cv = gridCanvas({
      label: 'Editable gridworld. Walls are filled, hazards have a cross, the goal is a target.',
      world: function () { return w; },
      onCell: function (i, type) {
        if (tool === 'play') {
          if (type !== 'down') return;
          var dx = (i % w.W) - (agent % w.W), dy = ((i / w.W) | 0) - ((agent / w.W) | 0);
          for (var a = 0; a < 4; a++) if (DX[a] === dx && DY[a] === dy) { move(a); return; }
          say('In Play mode, tap a cell next to the agent, or use the arrow buttons or keys.');
        } else {
          if (paint(w, i, tool, agent)) { if (tool === 'start') { agent = w.s; trail = [agent]; ret = 0; log = []; } refresh(); say('Map edited. Switch to Play and walk it.'); }
        }
      },
      extra: function (g, env, ww, geo) {
        drawTrail(g, env, ww, geo, trail);
        drawAgent(g, env, ctr(ww, geo, agent), 26, false);
      }
    });
    cv.el.setAttribute('tabindex', '0');
    cv.el.addEventListener('keydown', function (e) {
      var k = { ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3 }[e.key];
      if (k !== undefined && tool === 'play') { e.preventDefault(); move(k); }
    });
    var sel = WM.select({ label: 'Tool', options: TOOLS, value: 'play', onChange: function (v) { tool = v; say(v === 'play' ? 'Play mode: tap next to the agent to move.' : 'Paint mode: click or drag on the grid.'); } });
    var btns = WM.buttons(NAMES.map(function (n, a) { return { label: ARR[a] + ' ' + n, kind: 'ghost', aria: 'Move ' + n, onClick: function () { if (tool === 'play') move(a); else say('Set the tool to Play to move.'); } }; }));
    var rst = WM.buttons([
      { label: 'Reset agent', kind: 'primary', onClick: function () { agent = w.s; ret = 0; trail = [agent]; log = []; rA.set('—'); rN.set('—'); rR.set('—'); say('Back at the start.'); refresh(); } },
      { label: 'Reset map', kind: 'ghost', onClick: function () { w = parse(MAP); agent = w.s; ret = 0; trail = [agent]; log = []; say('Original map restored.'); refresh(); } }
    ]);
    refresh(); say('Walk to the goal. Then paint a wall in the corridor and walk again.');
    return WM.panel({ title: 'Walk the world and read its rules', note: 'Click the grid and press the arrow keys, or tap the cell next to the agent. Then choose <b>Paint wall</b> and change the world.' },
      cv, WM.controls(sel), WM.row(btns.el, rst.el), WM.readouts(rS, rA, rN, rR, rT), pre, WM.readouts(notice));
  }

  /* ---- Interactive B and E: planner, single world or reality versus model ---- */
  function buildPlanner(dual) {
    var real = parse(MAP), model = dual ? clone(real) : real, base = parse(MAP);
    var agent = real.s, trail = [agent], ret = 0, steps = 0, H = dual ? 12 : 8, merge = dual, plan = null, samples = [], tool = 'wall', view = 'real', learn = false, running = false, surprises = 0, over = null, showSamples = !dual;
    var rng = WM.rng(dual ? 'wrong' : 'plan'), pred0 = null;
    var cur = function () { return dual && view === 'model' ? model : real; };
    var rNodes = WM.readout('Model calls', '—'), rBest = WM.readout(dual ? 'Model predicts' : 'Best imagined return', '—');
    var rAct = WM.readout(dual ? 'Actually obtained' : 'Return so far', '0'), rSur = WM.readout('Surprises', '0');
    var notice = noticeReadout('What you should notice');
    function applyPreset(k) {
      real = parse(MAP); model = clone(real);
      if (k === 'pit') real.c[CHOKE] = HZ;
      if (k === 'wall') real.c[CHOKE] = WL;
      if (k === 'cautious') model.c[CHOKE] = WL;
      resetAgent();
    }
    function resetAgent() {
      agent = real.s; trail = [agent]; ret = 0; steps = 0; over = null; running = false; if (loopH) loopH.stop();
      surprises = dual ? surprises : 0; replan();
    }
    function replan() {
      var M = model, T = table(M);
      rAct.set(fmt(ret)); rSur.set(String(surprises));
      if (T.d[agent]) { plan = null; samples = []; rNodes.set('—'); rBest.set('—'); report(); cv.redraw(); return; }
      plan = merge ? planMerged(T, agent, H, rng) : planExh(T, agent, H, 1.5e6, rng);
      samples = [];
      if (showSamples && !plan.aborted) for (var k = 0; k < 28; k++) { var s = agent, ps = [s]; for (var d = 0; d < H; d++) { s = T.n[s * 4 + ((rng() * 4) | 0)]; ps.push(s); if (T.d[s]) break; } samples.push(ps); }
      if (plan.aborted) { rNodes.set('> 1.5 million'); rBest.set('gave up'); }
      else { rNodes.set(big(plan.nodes)); rBest.set(fmtS(plan.best)); }
      if (steps === 0) pred0 = plan.aborted ? null : plan.best;
      report(); cv.redraw();
    }
    function report() {
      var T = table(model), pp = plan && !plan.aborted ? pathStates(T, agent, plan.seq) : null, goal = pp && model.c[pp.end] === GL;
      if (over) { notice.set(over); return; }
      if (T.d[agent]) { notice.set('This attempt has ended. Press Reset agent.'); return; }
      if (plan && plan.aborted) { notice.set('Exhaustive search gave up after 1.5 million model calls. Turn on merging or shorten the horizon.'); return; }
      if (!dual) {
        if (!pp) return;
        if (goal) notice.set('The goal is inside the horizon, so the best imagined plan reaches it in ' + plan.seq.length + (plan.seq.length === 1 ? ' step' : ' steps') + '. Set the horizon below ' + plan.seq.length + ' and watch the plan lose the goal.');
        else notice.set('The goal is beyond the horizon, so every safe plan scores the same and the planner picks one at random. A longer look-ahead gives it a reason to move.');
      } else {
        var pit = pp && pp.states.some(function (s) { return real.c[s] === HZ && model.c[s] !== HZ; }), wall = pp && pp.states.length > 1 && (function () { for (var i = 0; i < plan.seq.length; i++) { var a = pp.states[i], k = a * 4 + plan.seq[i]; if (table(real).n[k] !== table(model).n[k]) return true; if (pp.states[i + 1] === undefined) break; } return false; })();
        if (pit) notice.set('The plan is the best one in the model and it ends in a hazard in reality. The planner reports a high predicted return and no doubt.');
        else if (wall) notice.set('The plan runs into a wall that the model does not contain. Replanning will repeat the same plan, because the model never changes.');
        else if (model.c.join('') !== real.c.join('')) notice.set('The model differs from the world, but this plan avoids the difference. Press Run to see what happens.');
        else notice.set('The model matches the world, so plans work as predicted.');
      }
    }
    function act() {
      if (!plan || plan.aborted || !plan.seq.length) { return false; }
      var Tm = table(model), Tr = table(real), a = plan.seq[0], i = agent * 4 + a;
      var s2 = Tr.n[i], r = Tr.r[i], sur = '';
      if (dual && (Tm.n[i] !== s2 || Tm.r[i] !== r)) {
        surprises++;
        var tgt = Tr.tg[i];
        sur = 'Surprise at step ' + (steps + 1) + ': the model predicted ' + (Tm.n[i] === s2 ? 'reward ' + fmt(Tm.r[i]) + ', the world gave reward ' + fmt(r) : pos(real, Tm.n[i]) + ', the world gave ' + pos(real, s2)) + '.' + (learn ? ' The model was corrected.' : ' Learning is off, so the model stays wrong.');
        over = sur;
        if (learn && tgt >= 0) model.c[tgt] = real.c[tgt];
      }
      agent = s2; ret += r; steps++; trail.push(s2);
      if (Tr.d[s2]) {
        running = false;
        over = (sur ? sur + ' ' : '') + (real.c[s2] === GL ? 'Goal reached with return ' + fmt(ret) + '.' : 'Fell into a hazard. Return ' + fmt(ret) + '.') + (dual && pred0 !== null ? ' At the start the model predicted ' + fmtS(pred0) + '.' : '') + (dual && learn && sur ? ' Press Reset agent and run again to see the corrected model.' : '') + (dual && !surprises && real.c[s2] === GL && model.c.join('') !== real.c.join('') ? ' The model still differs from the world, but no surprise occurred, so the agent had no evidence of it.' : '');
      }
      return true;
    }
    var loopH = null, acc = 0;
    loopH = WM.loop(function (dt) {
      acc += dt; if (acc < 0.32) return; acc = 0;
      if (steps >= 36 || table(real).d[agent]) { running = false; loopH.stop(); if (steps >= 36 && !over) over = 'Stopped after 36 steps without reaching the goal.'; replan(); return; }
      if (!act()) { running = false; loopH.stop(); }
      replan();
    });
    WM.onDispose(function () { loopH.stop(); });
    var cv = gridCanvas({
      label: dual ? 'Gridworld showing the real world or the agent’s model, with the imagined plan dashed.' : 'Gridworld with the agent’s imagined plan drawn dashed.',
      world: cur,
      ref: dual ? function () { return view === 'real' ? model : real; } : null,
      onCell: function (i) {
        var w = cur();
        if (paint(w, i, tool, agent)) { if (tool === 'start') { real.s = w.s; if (dual) model.s = w.s; resetAgent(); } else { over = null; replan(); } }
      },
      extra: function (g, env, w, geo) {
        var T = table(model);
        if (showSamples) samples.forEach(function (ps, i) { drawPlan(g, env, w, geo, ps, 0.16, false); });
        drawTrail(g, env, w, geo, trail);
        if (plan && plan.seq.length && !plan.aborted) { var pp = pathStates(T, agent, plan.seq); drawPlan(g, env, w, geo, pp.states, 0, true); }
        drawAgent(g, env, ctr(w, geo, agent), 26, false);
      }
    });
    var ctrls = [];
    var slH = WM.slider({ label: 'Horizon (steps imagined)', min: 1, max: 16, step: 1, value: H, fmt: 0, onInput: function (v) { H = v; over = null; replan(); } });
    var tgM = WM.toggle({ label: 'Merge repeated states', value: merge, onChange: function (v) { merge = v; over = null; replan(); } });
    var tgS = WM.toggle({ label: 'Show sample of tries', value: showSamples, onChange: function (v) { showSamples = v; replan(); } });
    var selT = WM.select({ label: 'Tool', options: TOOLS.slice(1), value: 'wall', onChange: function (v) { tool = v; } });
    ctrls.push(slH, tgM);
    if (!dual) ctrls.push(tgS);
    ctrls.push(selT);
    var selV, selP, tgL;
    if (dual) {
      selV = WM.select({ label: 'Show and edit', options: [{ value: 'real', label: 'Reality' }, { value: 'model', label: 'Agent’s model' }], value: 'real', onChange: function (v) { view = v; cv.redraw(); } });
      selP = WM.select({ label: 'Mismatch', options: [{ value: 'pit', label: 'Hidden pit in the short corridor' }, { value: 'wall', label: 'Hidden wall in the short corridor' }, { value: 'cautious', label: 'Model thinks the corridor is blocked' }, { value: 'none', label: 'No mismatch' }], value: 'pit', onChange: function (v) { surprises = 0; applyPreset(v); } });
      tgL = WM.toggle({ label: 'Learn from surprises', value: false, onChange: function (v) { learn = v; } });
      ctrls.unshift(selP, selV); ctrls.push(tgL);
    }
    var b = WM.buttons([
      { label: 'Act one step', kind: 'primary', onClick: function () { if (table(real).d[agent]) { return; } if (act()) replan(); } },
      { label: 'Run', kind: 'ghost', onClick: function () { if (table(real).d[agent]) return; running = true; acc = 1; loopH.start(); } },
      { label: 'Pause', kind: 'ghost', onClick: function () { running = false; loopH.stop(); } },
      { label: 'Reset agent', kind: 'ghost', onClick: function () { resetAgent(); } },
      { label: 'Reset map', kind: 'ghost', onClick: function () { real = parse(MAP); model = dual ? clone(real) : real; surprises = 0; if (dual) applyPreset(selP.get()); else resetAgent(); } }
    ]);
    if (dual) applyPreset('pit'); else replan();
    var el = WM.panel(dual
      ? { title: 'A perfect search of the wrong model', note: 'Press <b>Run</b> and watch the agent follow its best plan. Then switch <b>Show and edit</b> between Reality and Agent’s model, and turn on <b>Learn from surprises</b>.' }
      : { title: 'Plan by imagining ahead', note: 'Drag <b>Horizon</b> down until the dashed plan loses the goal, then press <b>Run</b>. Paint a wall across the corridor and watch the plan change.' },
      cv, WM.controls.apply(null, ctrls), WM.row(b.el), WM.readouts(rNodes, rBest, rAct, rSur), WM.readouts(notice));
    el._planner = { world: function () { return real; }, agent: function () { return agent; } };
    return el;
  }

  /* ---- Interactive C: the cost of looking ahead ---- */
  function buildCost(getPlanner) {
    var cache = { key: '', exh: [], mer: [] }, HM = 16, budget = 1e6, H = 8;
    var rE = WM.readout('Exhaustive, model calls', '—'), rM = WM.readout('Merged, model calls', '—'), rBE = WM.readout('Deepest horizon, exhaustive', '—'), rBM = WM.readout('Deepest horizon, merged', '—');
    var notice = noticeReadout('What you should notice');
    function compute() {
      var P = getPlanner(); if (!P) return;
      var w = P.world(), T0 = table(w), s = T0.d[P.agent()] ? w.s : P.agent(), key = w.c.join('') + ':' + s;
      if (key === cache.key) return;
      var T = T0; cache.key = key;
      cache.exh = countExh(T, s, 9); cache.mer = countMerged(T, s, HM);
      var ratio = cache.exh[9] / Math.max(1, cache.exh[8]);
      for (var h2 = 10; h2 <= HM; h2++) cache.exh.push(cache.exh[h2 - 1] * ratio);
      cache.ratio = ratio;
    }
    function deepest(arr) { var d = 0; for (var i = 1; i <= HM; i++) if (arr[i] <= budget) d = i; return d; }
    function upd() {
      compute();
      var e = cache.exh[H], m = cache.mer[H];
      rE.set((H > 9 ? '≈ ' : '') + big(e)); rM.set(big(m));
      var de = deepest(cache.exh), dm = deepest(cache.mer);
      rBE.set((de >= 9 && de < HM ? '≈ ' : '') + de); rBM.set(dm >= HM ? HM + '+' : dm);
      notice.set('Each extra step of look-ahead multiplies exhaustive cost by about ' + WM.ui.fmt(cache.ratio, 1) + ' here. Merged cost grows slowly because the map has only ' + table(getPlanner().world()).N + ' cells.');
    }
    var cv = WM.canvas({
      w: 960, h: 460, label: 'Log-scale chart of model calls against the look-ahead horizon, exhaustive versus merged.',
      draw: function (g, env) {
        compute(); var c = env.c;
        var ax = D.axes(g, 110, 40, 800, 340, { xlabel: 'horizon (steps imagined)', size: 20, xticks: [1, 2, 4, 6, 8, 10, 12, 14, 16].map(function (v) { return [(v - 1) / 15, String(v)]; }), yticks: [0, 2, 4, 6, 8, 10].map(function (e) { return [e / 10, e === 0 ? '1' : '10' + sup(e)]; }) });
        g.save(); g.translate(26, 40 + 170); g.rotate(-Math.PI / 2); D.text(g, 'model calls (log scale)', 0, 0, { size: 20, align: 'center', baseline: 'middle', color: c.muted }); g.restore();
        var X = function (hh) { return ax.x((hh - 1) / 15); }, Y = function (v) { return ax.y(D.clamp(Math.log10(Math.max(1, v)) / 10)); };
        var i, pts;
        // reference 4^h
        pts = []; for (i = 1; i <= HM; i++) pts.push([X(i), Y(Math.pow(4, i))]);
        D.poly(g, pts, { color: c.muted, lw: 2, dash: [2, 6], alpha: 0.9 });
        // budget
        D.line(g, ax.x(0), Y(budget), ax.x(1), Y(budget), { color: c.warn, lw: 3 });
        D.text(g, 'budget', ax.x(1) - 6, Y(budget) - 14, { size: 20, color: c.warn, weight: 700, align: 'right', baseline: 'middle' });
        // exhaustive: solid to 9, dashed projection after
        pts = []; for (i = 1; i <= 9; i++) pts.push([X(i), Y(cache.exh[i])]);
        D.poly(g, pts, { color: c.reality, lw: 4 });
        pts = [[X(9), Y(cache.exh[9])]]; for (i = 10; i <= HM; i++) pts.push([X(i), Y(cache.exh[i])]);
        D.poly(g, pts, { color: c.imagined, lw: 4, dash: true });
        for (i = 1; i <= 9; i++) D.dot(g, X(i), Y(cache.exh[i]), 5, { fill: c.reality });
        // merged
        pts = []; for (i = 1; i <= HM; i++) pts.push([X(i), Y(cache.mer[i])]);
        D.poly(g, pts, { color: c.accent2, lw: 4 });
        for (i = 1; i <= HM; i++) D.box(g, X(i) - 5, Y(cache.mer[i]) - 5, 10, 10, { fill: c.accent2 });
        // selected
        D.line(g, X(H), ax.y(0), X(H), ax.y(1), { color: c.ink2, lw: 2, alpha: 0.5 });
        D.dot(g, X(H), Y(cache.exh[H]), 9, { fill: false, stroke: c.ink, lw: 3 });
        D.dot(g, X(H), Y(cache.mer[H]), 9, { fill: false, stroke: c.ink, lw: 3 });
        // legend
        var ly = 62, lx = 140;
        D.line(g, lx, ly, lx + 40, ly, { color: c.reality, lw: 4 }); D.text(g, 'exhaustive (counted)', lx + 50, ly, { size: 20, baseline: 'middle' });
        D.line(g, lx, ly + 28, lx + 40, ly + 28, { color: c.imagined, lw: 4, dash: true }); D.text(g, 'exhaustive (projected)', lx + 50, ly + 28, { size: 20, baseline: 'middle' });
        D.line(g, lx, ly + 56, lx + 40, ly + 56, { color: c.accent2, lw: 4 }); D.text(g, 'merged states', lx + 50, ly + 56, { size: 20, baseline: 'middle' });
        D.line(g, lx, ly + 84, lx + 40, ly + 84, { color: c.muted, lw: 2, dash: [2, 6] }); D.text(g, '4 to the power h', lx + 50, ly + 84, { size: 20, baseline: 'middle' });
      }
    });
    var slH = WM.slider({ label: 'Horizon', min: 1, max: HM, step: 1, value: H, fmt: 0, onInput: function (v) { H = v; upd(); cv.redraw(); } });
    var selB = WM.select({ label: 'Compute budget (model calls)', options: [{ value: 1e4, label: '10,000' }, { value: 1e5, label: '100,000' }, { value: 1e6, label: '1 million' }, { value: 1e8, label: '100 million' }], value: 1e6, onChange: function (v) { budget = +v; upd(); cv.redraw(); } });
    var el = WM.panel({ title: 'How far ahead can the planner afford to look?', note: 'Move the <b>Horizon</b> and the <b>Budget</b>. The chart uses the map and agent position from the planner above, so edit that map and come back.' },
      cv, WM.controls(slH, selB), WM.readouts(rE, rM, rBE, rBM), WM.readouts(notice));
    var first = true;
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { upd(); cv.redraw(); } }, { threshold: 0.05 });
    io.observe(el); WM.onDispose(function () { io.disconnect(); });
    return el;
  }

  /* ---- Interactive D: ball and cliff ---- */
  function buildBall() {
    var st = { am: 2.0, ar: 1.5, margin: 2.0, t: 0, play: false, ran: false };
    var rM = WM.readout('Model predicts stop at', '—'), rR = WM.readout('Reality stops at', '—'), rN = WM.readout('Margin needed', '—'), rO = WM.readout('Outcome', '—');
    var notice = noticeReadout('What you should notice');
    function calc() {
      var dp = Math.max(0.2, EDGE - st.margin), v = Math.sqrt(2 * st.am * dp), sr = v * v / (2 * st.ar);
      return { dp: dp, v: v, sr: sr, need: Math.max(0, EDGE * (1 - st.ar / st.am)), fall: sr > EDGE + 1e-9, te: sr > EDGE + 1e-9 ? (v - Math.sqrt(v * v - 2 * st.ar * EDGE)) / st.ar : 0 };
    }
    function ballAt(C, t) {
      if (!C.fall || t < C.te) return { x: ballX(st.ar, C.v, t), y: BG - 18, fell: false };
      var vx = C.v - st.ar * C.te, dt = Math.min(t - C.te, 0.6);
      return { x: EDGE + vx * dt, y: Math.min(BG - 18 + 450 * dt * dt, 508 - 18), fell: true };
    }
    function summary() {
      var C = calc();
      rM.set(WM.ui.fmt(C.dp, 1) + ' m'); rN.set(WM.ui.fmt(C.need, 1) + ' m');
      if (st.ran) { rR.set(WM.ui.fmt(C.sr, 1) + ' m'); rO.set(C.fall ? 'falls' : 'safe'); } else { rR.set('—'); rO.set('—'); }
      var err = Math.round((1 - st.ar / st.am) * 100);
      if (st.margin + 1e-9 >= C.need && !C.fall) notice.set('The margin of ' + WM.ui.fmt(st.margin, 1) + ' m covers a friction error of ' + (err > 0 ? err + '%' : 'this size') + '. The plan survives, but only because the margin was chosen after the error was known.');
      else notice.set('A friction error of ' + err + '% moves the stopping point by ' + WM.ui.fmt(C.sr - C.dp, 1) + ' m. The planned margin is ' + WM.ui.fmt(st.margin, 1) + ' m, so the plan ' + (C.fall ? 'fails' : 'survives') + '. Needed margin: ' + WM.ui.fmt(C.need, 1) + ' m.');
    }
    var cv = WM.canvas({
      w: 960, h: 540, label: 'Side view of a ball rolling toward a cliff edge. A dashed ring shows where the model expects it, a solid ball shows reality.',
      draw: function (g, env) {
        var c = env.c, C = calc(), by = BG - 18;
        if (st.play) { st.t += env.dt; var tend = Math.max(C.v / st.ar, C.fall ? C.te + 1.4 : 0) + 0.3; if (st.t >= tend) { st.t = tend; st.play = false; setTimeout(function () { cv.stop(); }, 0); } }
        scenery(g, env, true);
        var gx = ballX(st.am, C.v, st.t), rb = ballAt(C, st.t);
        D.line(g, bsx(C.dp), by - 44, bsx(C.dp), by + 50, { color: c.imagined, lw: 3, dash: true });
        D.text(g, 'model stop ' + WM.ui.fmt(C.dp, 1) + ' m', bsx(C.dp), by - 62, { size: 22, color: c.imagined, weight: 700, align: 'center', baseline: 'middle' });
        if (st.ran && st.t > 0) {
          var sx2 = C.fall ? EDGE : C.sr;
          D.withAlpha(g, D.seg(st.t, C.v / st.ar - 0.2, C.v / st.ar), function () { if (!C.fall) { D.line(g, bsx(C.sr), by + 34, bsx(C.sr), by + 58, { color: c.reality, lw: 3 }); D.text(g, 'reality ' + WM.ui.fmt(C.sr, 1) + ' m', bsx(C.sr), by + 82, { size: 22, weight: 700, align: 'center', baseline: 'middle' }); } });
          if (rb.fell) D.text(g, 'falls', bsx(EDGE) + 30, 430, { size: 30, weight: 700, color: c.error, baseline: 'middle' });
        }
        drawAgentBall(g, env, bsx(gx), by, true);
        drawAgentBall(g, env, bsx(rb.x), rb.y, false);
        D.text(g, 'solid = real ball, dashed = the model’s ball', 40, 40, { size: 22, color: c.muted, baseline: 'middle' });
        D.text(g, 'friction slows the ball by: model ' + WM.ui.fmt(st.am, 1) + ' m/s², reality ' + WM.ui.fmt(st.ar, 1) + ' m/s²', 40, 76, { size: 22, color: c.ink2, baseline: 'middle' });
      }
    });
    function reset() { st.t = 0; st.play = false; st.ran = false; cv.stop(); summary(); cv.redraw(); }
    var sA = WM.slider({ label: 'Friction the model believes (m/s²)', min: 0.5, max: 4, step: 0.1, value: st.am, fmt: 1, onInput: function (v) { st.am = v; reset(); } });
    var sR = WM.slider({ label: 'Friction in reality (m/s²)', min: 0.5, max: 4, step: 0.1, value: st.ar, fmt: 1, onInput: function (v) { st.ar = v; reset(); } });
    var sM = WM.slider({ label: 'Safety margin (m)', min: 0, max: 6, step: 0.5, value: st.margin, fmt: 1, onInput: function (v) { st.margin = v; reset(); } });
    var b = WM.buttons([
      { label: 'Push the ball', kind: 'primary', onClick: function () { st.t = 0; st.ran = true; var C = calc(); if (WM.reducedMotion()) { st.t = Math.max(C.v / st.ar, C.fall ? C.te + 1.4 : 0) + 0.3; summary(); cv.redraw(); return; } st.play = true; summary(); cv.start(); } },
      { label: 'Reset', kind: 'ghost', onClick: function () { reset(); } },
      { label: 'Set reality = model', kind: 'ghost', onClick: function () { sR.set(st.am, true); } }
    ]);
    summary();
    return WM.panel({ title: 'Ball and cliff: one wrong number', note: 'Make reality slicker than the model (a smaller number), push the ball, then raise the <b>Safety margin</b> until it stops in time.' },
      cv, WM.controls(sA, sR, sM), WM.row(b.el), WM.readouts(rM, rR, rN, rO), WM.readouts(notice));
  }

  /* ---- Interactive F: pregnancy, an imagined blood pressure path (synthetic) ---- */
  function buildBP() {
    var NOW = 28, st = { start: 28, eff: 1.0 }, rng = WM.rng('bp-synth');
    function trend(k) { return 118 + 0.8 * k + 0.04 * k * (k - 1); }
    var obs = []; for (var wk = 20; wk <= NOW; wk += 2) obs.push([wk, trend(wk - 20) + (rng() - 0.5) * 4]);
    var last = obs[obs.length - 1][1];
    function roll(startTx) {
      var out = [[NOW, last]], bp = last;
      for (var wk2 = NOW; wk2 < 40; wk2++) { var dr = 0.8 + 0.08 * (wk2 - 20) - (wk2 >= startTx ? st.eff : 0); bp += dr; out.push([wk2 + 1, bp]); }
      return out;
    }
    function cross(path) { for (var i = 0; i < path.length; i++) if (path[i][1] >= 140) return path[i][0]; return null; }
    var rA = WM.readout('No treatment, BP reaches 140', '—'), rB = WM.readout('Chosen action, BP reaches 140', '—');
    var notice = noticeReadout('What you should notice');
    function upd() {
      var a = cross(roll(99)), b = cross(roll(st.start));
      rA.set(a ? 'week ' + a : 'not by week 40'); rB.set(b ? 'week ' + b : 'not by week 40');
      notice.set('The answer to “what if we start at week ' + st.start + '?” depends directly on the assumed effect of ' + WM.ui.fmt(st.eff, 1) + ' mmHg per week. The visits above contain no information about that number.');
    }
    var cv = WM.canvas({
      w: 960, h: 440, label: 'Synthetic systolic blood pressure by gestational week: observed points, and imagined paths with and without treatment.',
      draw: function (g, env) {
        var c = env.c, ax = D.axes(g, 100, 50, 810, 320, { xlabel: 'gestational age (weeks)', ylabel: 'systolic BP (mmHg)', size: 20, xticks: [20, 24, 28, 32, 36, 40].map(function (v) { return [(v - 20) / 20, String(v)]; }), yticks: [100, 120, 140, 160].map(function (v) { return [(v - 100) / 60, String(v)]; }) });
        var X = function (wk3) { return ax.x((wk3 - 20) / 20); }, Y = function (v) { return ax.y(D.clamp((v - 100) / 60)); };
        D.line(g, X(20), Y(140), X(40), Y(140), { color: c.error, lw: 2 });
        D.text(g, '140', X(20) + 6, Y(140) - 12, { size: 20, color: c.error, baseline: 'middle' });
        D.line(g, X(NOW), ax.y(0), X(NOW), ax.y(1), { color: c.muted, lw: 2, dash: [6, 6] });
        D.text(g, 'today', X(NOW) - 8, ax.y(1) + 16, { size: 20, color: c.muted, align: 'right', baseline: 'middle' });
        D.poly(g, roll(99).map(function (p) { return [X(p[0]), Y(p[1])]; }), { color: c.muted, lw: 3, dash: true });
        D.poly(g, roll(st.start).map(function (p) { return [X(p[0]), Y(p[1])]; }), { color: c.imagined, lw: 4, dash: true });
        D.poly(g, obs.map(function (p) { return [X(p[0]), Y(p[1])]; }), { color: c.reality, lw: 3 });
        obs.forEach(function (p) { D.dot(g, X(p[0]), Y(p[1]), 6, { fill: c.reality }); });
        D.text(g, 'imagined, no treatment', X(34), Y(roll(99)[6][1]) - 46, { size: 20, color: c.muted, align: 'center', baseline: 'middle' });
        D.text(g, 'imagined, treat from week ' + st.start, X(34), Y(roll(st.start)[6][1]) + 40, { size: 20, color: c.imagined, weight: 700, align: 'center', baseline: 'middle' });
        D.text(g, 'observed (synthetic)', X(24), Y(obs[2][1]) + 44, { size: 20, align: 'center', baseline: 'middle' });
        D.text(g, 'SYNTHETIC, ILLUSTRATIVE. Not a clinical model.', 910, 24, { size: 20, font: 'mono', color: c.muted, align: 'right', baseline: 'middle' });
      }
    });
    var s1 = WM.slider({ label: 'Start treatment at week', min: 28, max: 38, step: 1, value: st.start, fmt: 0, onInput: function (v) { st.start = v; upd(); cv.redraw(); } });
    var s2 = WM.slider({ label: 'Assumed effect (mmHg per week)', min: 0, max: 2, step: 0.1, value: st.eff, fmt: 1, onInput: function (v) { st.eff = v; upd(); cv.redraw(); } });
    upd();
    return WM.panel({ title: 'Imagine two actions, compare the futures', note: 'Move <b>Start treatment</b> earlier, then lower the <b>Assumed effect</b> and see whether the imagined conclusion survives.' },
      cv, WM.controls(s1, s2), WM.readouts(rA, rB), WM.readouts(notice));
  }

  /* ====================================================================
     7. THE MODULE
     ==================================================================== */
  WM.register({
    id: 'm2', num: 2, title: 'States, actions and imagining ahead', tagline: 'Describe a situation, say what an action does to it, and plan by trying futures in your head.', minutes: 25, level: 'Foundations',
    build: function (root) {
      var planner = null;
      var plannerPanel = buildPlanner(false);
      planner = plannerPanel._planner;
      root.append(
        WM.hero({
          kicker: 'Module 2 · Foundations', title: 'States, actions and imagining ahead', minutes: 25,
          lede: 'Module 1 described a loop of predicting, acting and comparing. Here the pieces become exact enough to compute with. You will edit a small world, watch an agent imagine its way across it, and then see what happens when its picture of the world is wrong.',
          goals: [
            'Describe a situation as a <b>state</b>, an action as a choice, and a <b>transition</b> as the rule that gives the next state.',
            'Plan by <b>rollout</b>: imagine action sequences with a model, score them, and pick the best, in a gridworld you edit.',
            'Explain why look-ahead gets expensive quickly, and why a perfect search of a wrong model gives a confident wrong plan.'
          ]
        }),

        /* ---------------- 1 STATE ---------------- */
        WM.section({ id: 'state', kicker: '§1', title: 'A state is a snapshot' },
          WM.p('Photograph a chess board in the middle of a game. Someone who has never seen the game can carry on from that photograph, because it holds nearly everything the rules need (strictly, you would also need to know whose turn it is and a few details, such as whether castling is still allowed). That photograph is the idea of a <dfn data-def="A description of the situation that contains everything needed to work out what can happen next.">state</dfn>.'),
          WM.p('For a piece on a grid, the column and row are enough. For a ball in flight they are not, because a ball moving up and a ball moving down can be at the same height and have different futures. The state of the ball also contains its velocity. Deciding what goes into the state is the first modelling choice, and it is easy to get wrong.'),
          WM.p('An <dfn data-def="One of the choices available to the agent at a given moment, such as move up or move right.">action</dfn> is a choice the agent can make. A <dfn data-def="The rule that says which state follows when a given action is taken in a given state. Written s′ = T(s, a).">transition</dfn> says which state follows. Together with the rewards you will meet in a moment, the transition rule is the agent’s <dfn data-def="Here, the agent’s internal copy of the world’s rules, which it can run without acting.">model</dfn> of the world. Watch the idea built up on a small grid.'),
          WM.explainer({
            id: 'e1', title: 'State, action, transition, reward', duration: 76, poster: 8,
            scenes: [
              { start: 0, end: 10, caption: 'A <b>state</b> is a snapshot of the situation. For a piece on a grid it is the column and the row. Here s = (2, 1).', draw: drawE1 },
              { start: 10, end: 22, caption: 'An <b>action</b> is a choice the agent can make. Here there are four: up, down, left and right.', draw: drawE1 },
              { start: 22, end: 36, caption: 'A <b>transition</b> says which state follows. From (2, 1), Right leads to (3, 1). Up from (3, 1) meets a wall, so the state stays the same.', draw: drawE1 },
              { start: 36, end: 50, caption: 'The model is the whole rule: for every state and action, the next state, written s′ = T(s, a). It works like a lookup table the agent can read without moving.', draw: drawE1 },
              { start: 50, end: 62, caption: 'What the agent wants is written as <b>rewards</b>. Every move costs 1, the goal pays 20, and the hazard costs 20 and ends the attempt.', draw: drawE1 },
              { start: 62, end: 76, caption: 'A state must hold everything that matters for the next step. A ball at the same height moving up or down has a different future, so velocity belongs in the state.', draw: drawE1 }
            ]
          }),
          WM.callout('warn', 'Misconception: the state is just where you are', 'Anything that changes the future and is missing from the state makes the model’s predictions wrong in a way that more position data cannot repair. Whether a description is a good state is judged by one test: does it contain everything needed to predict the next step?')
        ),

        /* ---------------- 2 LAB ---------------- */
        WM.section({ id: 'lab', kicker: '§2', title: 'Transitions and rewards in a world you can edit' },
          WM.p('Wanting something is written as a <dfn data-def="A number the world hands out after each step. Positive for what the agent wants, negative for what it wants to avoid.">reward</dfn>. In this grid every move costs 1, reaching the goal pays 20, and stepping on a hazard costs 20 and ends the attempt. The sum of rewards along a route is the <dfn data-def="The total of the rewards collected along a sequence of steps.">return</dfn>. Because each move costs 1, a shorter route to the goal has a higher return.'),
          WM.p('Below, you are the agent. Every move you make is one row of the transition table. Edit the world and the table changes with it.'),
          buildLab()
        ),

        /* ---------------- 3 IMAGINE ---------------- */
        WM.section({ id: 'imagine', kicker: '§3', title: 'Planning by imagining' },
          WM.p('So far the agent moved in the world. Now suppose it applies the transition rule to itself without moving. It writes down a short sequence of actions, applies the model once per action, adds up the rewards, and sees where it ends. This is a <dfn data-def="Running a model forward through a chosen sequence of actions to see where it leads, without acting in the real world.">rollout</dfn>. Imagined steps cost nothing and cannot hurt.'),
          WM.p('A planner does this for many sequences, keeps the one with the highest return, performs only its first action, looks at where it really is, and plans again. The video shows one cycle.'),
          WM.explainer({
            id: 'e2', title: 'Planning by rollout', duration: 96, poster: 30,
            scenes: [
              { start: 0, end: 10, caption: 'The agent is at (2, 1) and the goal is at (5, 0). It has a model, so it can imagine before it moves.', draw: drawE2 },
              { start: 10, end: 24, caption: 'Imagined sequence 1: Down, then Right. The model says the agent lands in the hazard. Imagined return: −22. The real agent has not moved.', draw: drawE2 },
              { start: 24, end: 38, caption: 'Imagined sequence 2: Right, Right, Right, Up. The model says it reaches the goal. Imagined return: +16.', draw: drawE2 },
              { start: 38, end: 56, caption: 'There are many sequences. With four actions at each step there are 4 after one step, 16 after two and 64 after three.', draw: drawE2 },
              { start: 56, end: 72, caption: 'Every imagined sequence of up to four actions is scored with the model. The planner keeps the sequence with the highest return.', draw: drawE2 },
              { start: 72, end: 86, caption: 'The agent performs only the first action in the real world, observes where it is, and plans again from there.', draw: drawE2 },
              { start: 86, end: 96, caption: 'A model plus a search is a planner. The hazard was found by imagining it, not by walking into it.', draw: drawE2 }
            ]
          }),
          WM.p('How many steps the planner imagines is its <dfn data-def="How many steps ahead the planner imagines before it scores a sequence.">horizon</dfn>. Try the planner below. It really does enumerate every action sequence up to the horizon in this grid, using the transition table from the previous section.'),
          plannerPanel,
          WM.callout('idea', 'What the model buys', 'Without a model, finding out that a cell is a hazard means standing on it. With a model, the same fact is found by a rollout that costs a few microseconds and harms nobody.')
        ),

        /* ---------------- 4 COST ---------------- */
        WM.section({ id: 'cost', kicker: '§4', title: 'Why looking far ahead is expensive' },
          WM.p('Each step offers four actions. That is 4 sequences of length 1, 16 of length 2, and 4<sup>h</sup> of length h. The number of choices at each step is the <dfn data-def="The number of options available at each decision point. Here it is 4.">branching factor</dfn>. At horizon 8 an exhaustive planner scores 65,536 sequences, and at horizon 12 about 17 million. The goal and hazard cells end some sequences early, so the real count is smaller, but the growth is still multiplicative. The chart counts every call to the model, including the shorter partial sequences on the way, which is somewhat more than the number of complete sequences.'),
          WM.p('There is a way out in this grid. Many sequences end on the same cell after the same number of steps, and what happens next depends only on that cell, not on the route taken. This holds because the state contains everything needed for the future. It is called the <dfn data-def="The property that the future depends on the present state alone, not on the path that led to it.">Markov property</dfn>. The planner may therefore keep only the best way to reach each cell at each step, and the cost grows with the number of cells instead of the number of sequences.'),
          buildCost(function () { return planner; }),
          WM.callout('idea', 'Scale outside the grid', 'Board games make the same point. Chess is commonly quoted at roughly 35 legal moves per position and Go at a few hundred, which is why exhaustive look-ahead is hopeless there and why later modules replace it with learned guidance.'),
          WM.callout('warn', 'Merging needs a good state', 'If the state leaves out something that matters, such as the ball’s velocity, two sequences that look as if they reach the same state are actually different, and merging them gives wrong answers.')
        ),

        /* ---------------- 5 WRONG ---------------- */
        WM.section({ id: 'wrong', kicker: '§5', title: 'When the model is wrong' },
          WM.p('Everything so far assumed the model matches the world. Real models never do. A planner that searches perfectly inside a wrong model returns a plan that is perfect for the wrong world, and nothing in the search warns it. A ball and a cliff show the effect in one line of arithmetic.'),
          WM.explainer({
            id: 'e3', title: 'Ball and cliff: a small error, a confident wrong plan', duration: 82, poster: 36,
            scenes: [
              { start: 0, end: 10, caption: 'A ball sits 10 m from a cliff edge. Friction slows it. We push once and want it to stop short of the edge.', draw: drawE3 },
              { start: 10, end: 24, caption: 'The model says friction slows the ball by 2.0 m/s². To stop at 8 m, push at 5.7 m/s. The dashed ball is the model’s prediction.', draw: drawE3 },
              { start: 24, end: 40, caption: 'In reality the floor is slicker: 1.5 m/s². With the same push the solid ball slides past 8 m and over the edge.', draw: drawE3 },
              { start: 40, end: 55, caption: 'Plotted over time, the model and reality drift apart. The gap grows until the real ball stops or leaves the floor.', draw: drawE3 },
              { start: 55, end: 70, caption: 'Friction was 25% off. The real stopping distance is 10.7 m instead of 8 m. The plan had a 2 m margin, and nothing inside the model said it might fail.', draw: drawE3 },
              { start: 70, end: 82, caption: 'Two things help. Leave a margin that covers plausible error, and compare each prediction with what you measure. A gap is a surprise, and a surprise says the model is wrong.', draw: drawE3 }
            ]
          }),
          WM.p('Try the ball yourself. The stopping distance of a sliding ball scales as one over the friction, so a modest error in the friction number becomes a larger error in where the ball ends up.'),
          buildBall(),
          WM.p('The same thing happens in the gridworld. Below, the agent plans in its model and acts in the world, and the two are not quite the same. In the first setting the model thinks a cell is floor where reality has a pit. The search is exact and correct, and the plan is still fatal.'),
          buildPlanner(true),
          WM.callout('idea', 'Surprise is information', 'When the world gives a result the model did not predict, that gap is the evidence that the model is wrong. Learning from such gaps is the subject of Module 3. Notice also that the third mismatch never produces a surprise at all, because the agent never tries the corridor it wrongly believes is blocked.'),
          WM.callout('warn', 'More search does not fix a wrong model', 'Search quality and model quality are separate. A deeper horizon, more computing power or a better algorithm finds a better plan for the model, and the model is the only thing the plan is checked against.')
        ),

        /* ---------------- 6 PREGNANCY ---------------- */
        WM.section({ id: 'pregnancy', kicker: '§6', title: 'Pregnancy corner' },
          WM.callout('pregnancy', 'A visit as a decision step', '<p>Antenatal care is a sequence of decision points. The <b>state</b> at a visit is the gestational age together with measurements such as blood pressure and weight, and whatever else the clinician knows. The <b>actions</b> are choices such as the interval to the next visit or whether to start treatment. The <b>transition</b> describes how the state looks at the next visit. A <b>reward</b> would encode what we want, for example avoiding severe-range blood pressure while keeping delivery near term.</p><p>Two caveats are developed later in the course. A clinic sees only a few noisy measurements, not the full state of the mother and fetus (Module 3). And the transition for an action that is rarely taken cannot be learned safely from routine records alone (Module 6). Every number below is synthetic and chosen for illustration.</p>'),
          WM.p('The panel below is a toy rollout. The solid line is a synthetic series of visits to week 28. The dashed lines are the model’s imagined futures with and without an action, using a transition rule written by hand for this exercise. The effect of treatment is an assumption you can change, which is exactly where real what-if models are weakest.'),
          buildBP()
        ),

        WM.takeaways([
          'A <b>state</b> holds everything needed to predict the next step. If something that matters is missing, the model fails however much data it sees.',
          'A <b>transition</b> maps a state and an action to the next state. A model is that rule plus the rewards, and it can be run without acting.',
          'Planning by <b>rollout</b> imagines action sequences, scores them with the model and acts on the best first step, then plans again.',
          'Exhaustive look-ahead grows like the branching factor to the power of the horizon. Merging states works only because the state is a sufficient description.',
          'A perfect search of a wrong model gives a confident wrong plan. Surprises are the signal that the model needs fixing.'
        ]),
        WM.quiz({
          id: 'q2', title: 'Check your understanding', questions: [
            { q: 'You want to predict where a thrown ball will be one second from now. Which description is the better state?',
              options: ['Its position now', 'Its position and velocity now', 'The time since it was thrown', 'Its colour and size'], answer: 1,
              why: 'Two balls at the same height can be moving in opposite directions. The state must contain everything that determines the next step, and for a moving object that includes velocity.' },
            { q: 'In the gridworld the agent chooses Right while a wall is directly to its right. What does the model say?',
              options: ['The action is illegal, so the model has no answer', 'The next state equals the current state, and the move still costs 1', 'The agent moves through the wall and the wall disappears', 'The attempt ends'], answer: 1,
              why: 'A transition rule must return a state for every state and action. Being blocked is a valid outcome in which the state does not change.' },
            { q: 'A planner has 4 actions per step and scores every sequence 8 steps ahead, with no merging and no sequence ending early. About how many sequences is that?',
              options: ['32', '1,024', '65,536', '4,096'], answer: 2,
              why: 'The count is 4 multiplied by itself 8 times, which is 65,536. It grows as a power of the horizon, not in proportion to it. 4,096 is 8 to the power 4, the same numbers in the wrong roles.' },
            { q: 'Why can the planner merge two different action sequences that reach the same cell after the same number of steps?',
              options: ['Because both sequences have the same length', 'Because what happens next depends only on the current state, not on how it was reached', 'Because both sequences must have the same return', 'Because walls make all routes equivalent'], answer: 1,
              why: 'This is the Markov property. The sequences may have different returns so far, so the planner keeps the better one, and the future is the same for both.' },
            { q: 'The model believes a cell is safe floor, but it is really a pit. The planner searches exhaustively and finds that the best route crosses that cell. What does the agent do?',
              options: ['It notices the pit and avoids it', 'It walks in, because the plan was optimal for the model', 'The planner reports its uncertainty and stops', 'A deeper horizon would have avoided it'], answer: 1,
              why: 'Search finds the best plan for the model it is given. Nothing in the model signals the pit, and a deeper horizon only looks further into the same wrong world.' },
            { q: 'The agent replans every step with a horizon of 5, but the goal is 9 steps away and no hazard is near. What do you expect?',
              options: ['It takes the shortest route anyway', 'Every imagined plan scores the same, so nothing pulls it toward the goal', 'The planner reports an error', 'The goal appears closer to the model'], answer: 1,
              why: 'Within 5 steps no sequence reaches the goal, so all safe sequences score the same. The goal only influences the plan once it lies inside the horizon.' }
          ]
        })
      );
    }
  });
})();
