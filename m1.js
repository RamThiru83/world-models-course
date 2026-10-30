/* ==========================================================================
   M1  What is a world model?   (foundations, about age 14)
   Explainer scripts are written as comments above each explainer.
   ========================================================================== */
WM.register({
  id: 'm1', num: 1, title: 'What is a world model?', tagline: 'Predict, act, compare, update', minutes: 25, level: 'Foundations',
  build: function (root, WM) {
    'use strict';
    var h = WM.h, D = WM.draw;
    root.appendChild(h('style', null, '.wm-m1-live{margin:0 -16px;border-bottom:0;border-top:1px solid var(--faint)}@media (max-width:640px){.wm-m1-live{margin:0 -12px}}'));
    var f1 = function (n) { return WM.ui.fmt(n, 1); };
    var f2 = function (n) { return WM.ui.fmt(n, 2); };
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    /* small helper: a live "what you should notice" line at the foot of a panel */
    function notice(initial) {
      var span = h('span', null, initial || '');
      var el = h('p', { class: 'wm-panel__note wm-m1-live', 'aria-live': 'polite' }, h('b', null, 'Notice'), span);
      var last = initial || '';
      return { el: el, set: function (t) { if (t !== last) { last = t; span.textContent = t; } } };
    }

    /* shared drawing helpers (pure) */
    function gridBg(g) { D.grid(g, 0, 0, 960, 540, 32, 18, { color: 'faint', alpha: 0.6, lw: 1 }); }
    function legend(g, kinds) {
      var x = 24, y = 36;
      if (kinds.indexOf('real') >= 0) {
        D.line(g, x, y, x + 40, y, { color: 'reality', lw: 4 });
        D.text(g, 'what happens', x + 50, y, { size: 24, baseline: 'middle', color: 'ink2' });
        x += 250;
      }
      if (kinds.indexOf('model') >= 0) {
        D.line(g, x, y, x + 40, y, { color: 'imagined', lw: 4, dash: true });
        D.text(g, 'what the model predicts', x + 50, y, { size: 24, baseline: 'middle', color: 'imagined' });
      }
    }

    /* ======================================================================
       EXPLAINER 1  "Running the future in your head"   74 s
       Script
        1  0-10   A cup slides towards a table edge. Solid = what is seen.
        2  10-22  The mind runs ahead: dashed path, cup falls to the floor.
        3  22-34  Two simple rules behind the imagined path; equal time steps, growing gaps.
        4  34-48  What-if: a hand at the edge; run the simulation again; cup is caught.
        5  48-62  Reality: the cup falls and matches the prediction.
        6  62-74  Cost: trying it in the model is cheap, in the world it is not.
       ====================================================================== */
    var TOP = 300, EDGE = 520, FLOOR = 470, CX0 = 150, VX = 80, SEDGE = (EDGE - CX0) / VX, TH = Math.sqrt(120 / 170);
    function cupAt(s) {
      if (s <= SEDGE) return { x: CX0 + VX * s, y: TOP };
      var tau = Math.min(s - SEDGE, 1);
      return { x: EDGE + VX * tau, y: TOP + 170 * tau * tau };
    }
    function cupHand(s) {
      if (s <= SEDGE) return { x: CX0 + VX * s, y: TOP };
      var tau = Math.min(s - SEDGE, TH);
      return { x: EDGE + VX * tau, y: TOP + 170 * tau * tau };
    }
    function cupDraw(g, x, y, o) {
      o = o || {};
      var col = o.color || 'reality', dash = o.dash || false;
      D.poly(g, [[x - 22, y - 50], [x + 22, y - 50], [x + 17, y], [x - 17, y]], { close: true, fill: o.fill, color: col, lw: 3, dash: dash, alpha: o.alpha });
      D.curve(g, [[x + 22, y - 42], [x + 36, y - 38], [x + 35, y - 18], [x + 19, y - 10]], { color: col, lw: 3, dash: dash, alpha: o.alpha });
    }
    function tableBase(g, fade) {
      gridBg(g);
      D.withAlpha(g, fade == null ? 1 : fade, function () {
        D.box(g, 60, TOP, 460, 14, { fill: 'surface', stroke: 'reality', lw: 3 });
        D.box(g, 470, 314, 16, 156, { fill: 'surface', stroke: 'reality', lw: 3 });
        D.box(g, 84, 314, 16, 156, { fill: 'surface', stroke: 'reality', lw: 3 });
        D.line(g, 20, FLOOR, 940, FLOOR, { color: 'reality', lw: 3 });
      });
    }
    function ghostPath(g, s0, s1, fn, o) {
      var pts = [], n = 44;
      for (var i = 0; i <= n; i++) { var q = fn(s0 + (s1 - s0) * i / n); pts.push([q.x, q.y]); }
      D.poly(g, pts, { color: 'imagined', lw: 3, dash: true, alpha: o && o.alpha });
    }
    var sEnd = SEDGE + 1;

    var ex1 = WM.explainer({
      id: 'x-simulator', title: 'Running the future in your head', duration: 74, poster: 20,
      scenes: [
        { start: 0, end: 10, caption: 'You watch a cup slide towards the edge of a table. This is what you can see, so it is drawn with a <b>solid</b> line.',
          draw: function (g, p, env) {
            tableBase(g); legend(g, ['real']);
            var m = D.seg(p, 0, 0.92), s = 3 * D.ease(m), q = cupAt(s);
            if (m > 0 && m < 1) for (var k = 1; k <= 3; k++) D.line(g, q.x - 30 - 14 * k, q.y - 12 * k - 4, q.x - 30 - 14 * k - 22, q.y - 12 * k - 4, { color: 'muted', lw: 3, alpha: 0.7 });
            cupDraw(g, q.x, q.y, { fill: 'surface' });
            D.text(g, 'What happens next?', 700, 200, { size: 28, weight: 700, font: 'display', align: 'center', alpha: D.seg(p, 0.7, 0.92) });
          } },
        { start: 10, end: 22, caption: 'Before it moves any further you already know the ending. Your mind runs the future ahead of time. That imagined path is drawn <b>dashed</b>.',
          draw: function (g, p, env) {
            tableBase(g); legend(g, ['real', 'model']);
            var q0 = cupAt(3); cupDraw(g, q0.x, q0.y, { fill: 'surface' });
            var q = D.ease(D.seg(p, 0.05, 0.9)), s = 3 + (sEnd - 3) * q;
            ghostPath(g, 3, s, cupAt);
            var gp = cupAt(s); cupDraw(g, gp.x, gp.y, { color: 'imagined', dash: true });
            D.text(g, 'lands on the floor', 640, 508, { size: 22, align: 'center', color: 'imagined', alpha: D.seg(p, 0.85, 1) });
          } },
        { start: 22, end: 34, caption: 'The imagined path follows two simple rules. Nothing holds the cup up, so it falls. Each moment it falls faster, so equal time steps cover more and more distance.',
          draw: function (g, p, env) {
            tableBase(g, 0.35); legend(g, ['model']);
            D.withAlpha(g, D.seg(p, 0.04, 0.2), function () {
              D.text(g, 'Rule 1', 60, 100, { size: 26, weight: 700, color: 'imagined', font: 'mono' });
              D.text(g, 'Nothing holds it up, so it falls.', 170, 100, { size: 26 });
            });
            D.withAlpha(g, D.seg(p, 0.2, 0.36), function () {
              D.text(g, 'Rule 2', 60, 160, { size: 26, weight: 700, color: 'imagined', font: 'mono' });
              D.text(g, 'Each moment it falls faster.', 170, 160, { size: 26 });
            });
            var pts = [];
            for (var k = 0; k <= 5; k++) {
              var tau = k * 0.2, x = EDGE + VX * tau, y = TOP + 170 * tau * tau;
              pts.push([x, y]);
              D.dot(g, x, y, 9, { stroke: 'imagined', dash: true, lw: 3, alpha: D.seg(p, 0.4 + k * 0.07, 0.47 + k * 0.07) });
            }
            D.withAlpha(g, D.seg(p, 0.85, 1), function () {
              D.text(g, 'Same time between dots. The gaps grow.', 640, 330, { size: 22, color: 'ink2', maxWidth: 290 });
            });
          } },
        { start: 34, end: 48, caption: 'Because it is a simulation, you can change one thing and run it again. With a hand at the edge, the cup is caught. No cup was dropped to find that out.',
          draw: function (g, p, env) {
            tableBase(g); legend(g, ['real', 'model']);
            var q0 = cupAt(3); cupDraw(g, q0.x, q0.y, { fill: 'surface' });
            ghostPath(g, 3, sEnd, cupAt, { alpha: 0.3 });
            var a1 = D.seg(p, 0.05, 0.3);
            D.withAlpha(g, a1, function () {
              D.box(g, 551, 420, 72, 22, { r: 9, stroke: 'imagined', dash: true, lw: 3, fill: 'surface' });
              D.poly(g, [[623, 426], [700, 440], [700, 470]], { color: 'imagined', lw: 3, dash: true });
            });
            D.text(g, 'What if a hand is there?', 480, 110, { size: 28, weight: 700, font: 'display', align: 'center', alpha: a1 });
            var q = D.ease(D.seg(p, 0.32, 0.92)), s = 3 + (SEDGE + TH - 3) * q;
            ghostPath(g, 3, s, cupHand);
            var gp = cupHand(s); cupDraw(g, gp.x, gp.y, { color: 'imagined', dash: true });
            D.text(g, 'caught', 587, 508, { size: 22, align: 'center', color: 'imagined', alpha: D.seg(p, 0.9, 1) });
          } },
        { start: 48, end: 62, caption: 'Now the real cup goes over the edge. Reality follows the prediction closely, so the model did its job.',
          draw: function (g, p, env) {
            tableBase(g); legend(g, ['real', 'model']);
            ghostPath(g, 3, sEnd, cupAt);
            cupDraw(g, EDGE + VX, FLOOR, { color: 'imagined', dash: true, alpha: 0.9 });
            var s = 3 + (sEnd - 3) * D.seg(p, 0.1, 0.8), q = cupAt(s);
            cupDraw(g, q.x, q.y, { fill: 'surface' });
            D.text(g, 'The prediction held.', 480, 110, { size: 28, weight: 700, font: 'display', align: 'center', color: 'good', alpha: D.seg(p, 0.82, 0.96) });
          } },
        { start: 62, end: 74, caption: 'Trying an idea in the model is cheap and can be repeated. Trying it in the world can be costly and happens once. That is why brains and machines keep models.',
          draw: function (g, p, env) {
            gridBg(g);
            function card(x, title, lines, dash, color, a0) {
              D.withAlpha(g, D.seg(p, a0, a0 + 0.12), function () {
                D.box(g, x, 70, 420, 260, { r: 8, fill: 'surface', stroke: color, lw: 3, dash: dash });
                D.text(g, title, x + 24, 120, { size: 30, weight: 700, font: 'display', color: color });
              });
              lines.forEach(function (l, i) { D.text(g, l, x + 24, 180 + i * 50, { size: 26, alpha: D.seg(p, a0 + 0.12 + i * 0.1, a0 + 0.24 + i * 0.1) }); });
            }
            card(40, 'In the model', ['Costs a moment of thought', 'Can be repeated', 'Bad ideas do no harm'], true, 'imagined', 0.02);
            card(500, 'In the world', ['Costs a cup, or worse', 'Happens once', 'Bad ideas have real costs'], false, 'reality', 0.1);
            D.text(g, 'A world model is a cheap simulator.', 480, 452, { size: 34, weight: 700, font: 'display', align: 'center', alpha: D.seg(p, 0.7, 0.92) });
          } }
      ] });

    /* ======================================================================
       EXPLAINER 2  "The loop: observe, predict, act, compare, update"   88 s
       Script
        0  0-9    A child learning to catch; the five-step loop appears.
        1  9-17   Observe: the first part of the throw (solid).
        2  17-27  Predict: the rest of the flight imagined (dashed), a landing spot chosen.
        3  27-37  Act: she runs to the predicted spot.
        4  37-49  Compare: ball lands further; error segment.
        5  49-61  Update: a dial inside the model moves towards the truth.
        6  61-76  Rounds 1-3: the error shrinks.
        7  76-88  Wrap-up: the loop never stops; compare is what lets it learn.
       ====================================================================== */
    var GR = 420, X0 = 70, RREAL = 380;
    function arcX(R, u) { return X0 + R * u; }
    function arcY(R, u) { return GR - (38 * (1 - u) + 4 * 0.3 * R * u * (1 - u)); }
    function arcPts(R, u0, u1) { var a = [], n = 40; for (var i = 0; i <= n; i++) { var u = u0 + (u1 - u0) * i / n; a.push([arcX(R, u), arcY(R, u)]); } return a; }
    var STEPS = ['Observe', 'Predict', 'Act', 'Compare', 'Update'];
    function loopPanel(g, env, active, alphaOf, hot) {
      var c = env.c;
      for (var i = 0; i < 5; i++) {
        var y = 60 + i * 86, on = (active === i), a = alphaOf ? alphaOf(i) : 1;
        D.withAlpha(g, a, function () {
          D.box(g, 640, y, 260, 56, { r: 6, fill: on ? c.ink : c.surface, stroke: 'reality', lw: on ? 3 : 2 });
          D.text(g, String(i + 1), 664, y + 29, { size: 24, weight: 700, font: 'mono', baseline: 'middle', color: on ? c.surface : c.muted });
          D.text(g, STEPS[i], 700, y + 29, { size: 28, weight: 600, baseline: 'middle', color: on ? c.surface : c.ink });
          if (i < 4) D.arrow(g, 770, y + 58, 770, y + 84, { color: 'muted', lw: 3, head: 11 });
        });
      }
      D.withAlpha(g, alphaOf ? alphaOf(5) : 1, function () {
        var col = hot ? 'accent2' : 'muted', lw = hot ? 5 : 3;
        D.poly(g, [[902, 60 + 4 * 86 + 28], [932, 60 + 4 * 86 + 28], [932, 88]], { color: col, lw: lw });
        D.arrow(g, 932, 88, 904, 88, { color: col, lw: lw, head: 12 });
      });
    }
    function person(g, x, o) {
      o = o || {};
      var col = o.color || 'reality', lw = 3;
      D.dot(g, x, 372, 12, { fill: false, stroke: col, lw: lw });
      D.line(g, x, 384, x, 408, { color: col, lw: lw });
      D.line(g, x, 408, x - 9, 420, { color: col, lw: lw }); D.line(g, x, 408, x + 9, 420, { color: col, lw: lw });
      if (o.up) { D.line(g, x, 392, x - 13, 378, { color: col, lw: lw }); D.line(g, x, 392, x + 13, 378, { color: col, lw: lw }); }
      else D.line(g, x, 392, x + 16, o.throwing ? 382 : 402, { color: col, lw: lw });
    }
    function world2(g, cx, o) {
      o = o || {};
      gridBg(g);
      D.line(g, 20, GR, 600, GR, { color: 'reality', lw: 3 });
      person(g, 50, { throwing: true });
      person(g, cx, { up: true });
      if (o.labels) { D.text(g, 'thrower', 50, 458, { size: 22, align: 'center', color: 'muted' }); D.text(g, 'child', cx, 458, { size: 22, align: 'center', color: 'muted' }); }
    }
    function marks(g, xp, xr, a) {
      D.withAlpha(g, a, function () {
        D.dot(g, xp, 436, 10, { fill: false, stroke: 'imagined', dash: true, lw: 3 });
        D.dot(g, xr, 436, 9, { fill: 'reality' });
      });
    }

    var ex2 = WM.explainer({
      id: 'x-loop', title: 'The loop: observe, predict, act, compare, update', duration: 88, poster: 40,
      scenes: [
        { start: 0, end: 9, caption: 'A child is learning to catch. Each throw can be described with the same five-step loop.',
          draw: function (g, p, env) {
            world2(g, 140, { labels: true });
            loopPanel(g, env, -1, function (i) { return i === 5 ? D.seg(p, 0.85, 1) : D.seg(p, 0.08 + i * 0.14, 0.2 + i * 0.14); });
          } },
        { start: 9, end: 17, caption: '<b>Observe.</b> She sees the ball leave the thrower’s hand and follows the first part of its flight.',
          draw: function (g, p, env) {
            world2(g, 140); legend(g, ['real']);
            var u = 0.3 * D.ease(D.seg(p, 0.1, 0.95));
            D.poly(g, arcPts(RREAL, 0, u), { color: 'reality', lw: 4 });
            D.dot(g, arcX(RREAL, u), arcY(RREAL, u), 9, { fill: 'reality' });
            D.text(g, 'she sees only the start of the flight', 40, 200, { size: 22, color: 'muted', alpha: D.seg(p, 0.5, 0.8) });
            loopPanel(g, env, 0);
          } },
        { start: 17, end: 27, caption: '<b>Predict.</b> Her model imagines the rest of the flight, drawn <b>dashed</b>, and picks a landing spot.',
          draw: function (g, p, env) {
            world2(g, 140); legend(g, ['real', 'model']);
            D.poly(g, arcPts(RREAL, 0, 0.3), { color: 'reality', lw: 4 });
            D.dot(g, arcX(RREAL, 0.3), arcY(RREAL, 0.3), 9, { fill: 'reality' });
            var Rm = 0.6 * RREAL;
            D.poly(g, arcPts(Rm, 0, 1), { color: 'imagined', lw: 4, dash: true, progress: D.easeOut(D.seg(p, 0.1, 0.8)) });
            D.withAlpha(g, D.seg(p, 0.75, 0.95), function () {
              D.dot(g, X0 + Rm, 436, 10, { fill: false, stroke: 'imagined', dash: true, lw: 3 });
              D.text(g, 'predicted landing', X0 + Rm, 474, { size: 22, align: 'center', color: 'imagined' });
            });
            loopPanel(g, env, 1);
          } },
        { start: 27, end: 37, caption: '<b>Act.</b> She runs to the spot her model predicted.',
          draw: function (g, p, env) {
            var Rm = 0.6 * RREAL, cx = D.lerp(140, X0 + Rm, D.ease(D.seg(p, 0.05, 0.85)));
            world2(g, cx); legend(g, ['real', 'model']);
            D.poly(g, arcPts(RREAL, 0, 0.3), { color: 'reality', lw: 4 });
            D.dot(g, arcX(RREAL, 0.3), arcY(RREAL, 0.3), 9, { fill: 'reality' });
            D.poly(g, arcPts(Rm, 0, 1), { color: 'imagined', lw: 4, dash: true });
            D.dot(g, X0 + Rm, 436, 10, { fill: false, stroke: 'imagined', dash: true, lw: 3 });
            loopPanel(g, env, 2);
          } },
        { start: 37, end: 49, caption: '<b>Compare.</b> The ball lands further away than predicted. The gap between the two landing spots is the <b>prediction error</b>.',
          draw: function (g, p, env) {
            var Rm = 0.6 * RREAL, cx = X0 + Rm;
            world2(g, cx); legend(g, ['real', 'model']);
            var u = D.lerp(0.3, 1, D.ease(D.seg(p, 0.02, 0.55)));
            D.poly(g, arcPts(RREAL, 0, u), { color: 'reality', lw: 4 });
            D.dot(g, arcX(RREAL, u), arcY(RREAL, u), 9, { fill: 'reality' });
            D.poly(g, arcPts(Rm, 0, 1), { color: 'imagined', lw: 4, dash: true, alpha: 0.7 });
            var a = D.seg(p, 0.5, 0.7);
            marks(g, X0 + Rm, X0 + RREAL, a);
            D.withAlpha(g, D.seg(p, 0.65, 0.9), function () {
              D.line(g, X0 + Rm + 12, 436, X0 + RREAL - 12, 436, { color: 'error', lw: 5 });
              D.text(g, 'predicted', X0 + Rm, 474, { size: 22, align: 'center', color: 'imagined' });
              D.text(g, 'actual', X0 + RREAL, 474, { size: 22, align: 'center' });
              D.text(g, 'prediction error', (X0 + Rm + X0 + RREAL) / 2, 512, { size: 24, weight: 700, align: 'center', color: 'error' });
            });
            loopPanel(g, env, 3);
          } },
        { start: 49, end: 61, caption: '<b>Update.</b> She adjusts a dial inside her model: balls fly further than she thought. She does not rebuild the model, she nudges it.',
          draw: function (g, p, env) {
            gridBg(g);
            var bx0 = 80, bx1 = 560, by = 270;
            function vx(v) { return bx0 + (v - 0.4) / 0.7 * (bx1 - bx0); }
            D.text(g, 'a dial inside her model', 320, 110, { size: 26, weight: 700, font: 'display', align: 'center' });
            D.text(g, 'how far does a thrown ball fly?', 320, 152, { size: 22, align: 'center', color: 'ink2' });
            D.line(g, bx0, by, bx1, by, { color: 'muted', lw: 6 });
            D.line(g, vx(1.0), by - 20, vx(1.0), by + 20, { color: 'reality', lw: 4 });
            D.text(g, 'truth', vx(1.0), by + 52, { size: 22, align: 'center' });
            var m = D.lerp(0.6, 0.85, D.ease(D.seg(p, 0.2, 0.65)));
            D.arrow(g, vx(0.6) + 14, by - 40, vx(0.85) - 18, by - 40, { color: 'imagined', lw: 3, dash: true, alpha: D.seg(p, 0.15, 0.3) });
            D.dot(g, vx(m), by, 13, { fill: false, stroke: 'imagined', dash: true, lw: 4 });
            D.text(g, 'model', vx(m), by - 66, { size: 22, align: 'center', color: 'imagined' });
            D.text(g, 'Next throw: a smaller error.', 320, 410, { size: 26, weight: 600, align: 'center', color: 'good', alpha: D.seg(p, 0.75, 0.92) });
            loopPanel(g, env, 4);
          } },
        { start: 61, end: 76, caption: 'On later throws the loop runs again. Each lap starts from the corrected model, so the error shrinks.',
          draw: function (g, p, env) {
            gridBg(g);
            var rows = [{ y: 140, xp: X0 + 0.6 * RREAL, t: 'large error' }, { y: 240, xp: X0 + 0.85 * RREAL, t: 'smaller error' }, { y: 340, xp: X0 + 0.96 * RREAL, t: 'tiny error' }];
            rows.forEach(function (r, i) {
              var a = D.seg(p, 0.04 + i * 0.26, 0.2 + i * 0.26), e = D.ease(D.seg(p, 0.16 + i * 0.26, 0.34 + i * 0.26));
              D.withAlpha(g, a, function () {
                D.text(g, 'Round ' + (i + 1), 24, r.y + 7, { size: 22, weight: 600 });
                D.line(g, 130, r.y, 600, r.y, { color: 'faint', lw: 3 });
                D.line(g, r.xp + 12, r.y, r.xp + 12 + (X0 + RREAL - 12 - r.xp - 12) * e, r.y, { color: 'error', lw: 6, alpha: 0.95 });
                D.dot(g, r.xp, r.y, 10, { fill: false, stroke: 'imagined', dash: true, lw: 3 });
                D.dot(g, X0 + RREAL, r.y, 9, { fill: 'reality' });
                D.text(g, r.t, 486, r.y + 8, { size: 22, color: 'error', weight: 600 });
              });
            });
            D.text(g, 'dashed ring = predicted landing', 24, 440, { size: 22, color: 'imagined' });
            D.text(g, 'solid dot = actual landing', 24, 474, { size: 22 });
            loopPanel(g, env, Math.floor(p * 15) % 5);
          } },
        { start: 76, end: 88, caption: 'Observe, predict, act, compare, update, then repeat. Without the compare step the model has nothing to learn from.',
          draw: function (g, p, env) {
            gridBg(g);
            D.text(g, 'Each lap makes the model a little better.', 40, 190, { size: 32, weight: 700, font: 'display', maxWidth: 540, alpha: D.seg(p, 0.05, 0.3) });
            D.text(g, 'Compare is the step that turns experience into learning.', 40, 350, { size: 26, color: 'ink2', maxWidth: 540, alpha: D.seg(p, 0.35, 0.6) });
            loopPanel(g, env, -1, null, true);
          } }
      ] });

    /* ======================================================================
       EXPLAINER 3  "Every model leaves something out"   72 s
       Script
        1  0-8    Rule: things fall together. Stone: prediction matches.
        2  8-20   Feather: same rule fails; error grows.
        3  20-32  What the rule left out: air pushes up, mostly on light, wide things.
        4  32-46  Add air to the model; prediction hugs the feather; small error remains.
        5  46-60  Trade-off: simple rule vs richer rule.
        6  60-72  A model is judged by the question you ask of it.
       ====================================================================== */
    var SX = 260, FX = 700, RY = 90, FL = 470, VT = 60, TA = 0.4;
    function stoneY(t) { return Math.min(FL - 16, RY + 100 * t * t); }
    function featherY(t) { return Math.min(FL - 10, RY + VT * (t - TA * (1 - Math.exp(-t / TA)))); }
    function featherX(t, amp) { return FX + amp * Math.sin(2.2 * t) * Math.min(1, t / 0.8); }
    function leaf(g, x, y, ang, o) {
      var pts = [], n = 18;
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2, ex = 22 * Math.cos(a), ey = 7 * Math.sin(a);
        pts.push([x + ex * Math.cos(ang) - ey * Math.sin(ang), y + ex * Math.sin(ang) + ey * Math.cos(ang)]);
      }
      D.poly(g, pts, { close: true, fill: o.fill, color: o.color || 'reality', lw: 3, dash: o.dash, alpha: o.alpha });
    }
    function dropFrame(g, labels) {
      gridBg(g);
      D.line(g, 20, FL, 940, FL, { color: 'reality', lw: 3 });
      [SX, FX].forEach(function (x) { D.line(g, x - 40, RY - 24, x + 40, RY - 24, { color: 'muted', lw: 3 }); });
      if (labels !== false) { D.text(g, 'stone', SX, 512, { size: 22, align: 'center', color: 'muted' }); D.text(g, 'feather', FX, 512, { size: 22, align: 'center', color: 'muted' }); }
    }
    function stoneDraw(g, t, withRing) {
      var y = stoneY(t);
      if (withRing) D.dot(g, SX, y, 24, { fill: false, stroke: 'imagined', dash: true, lw: 3 });
      D.dot(g, SX, y, 15, { fill: 'reality' });
    }
    function simpleRuleExtra(g, t) { D.dot(g, FX, stoneY(t) + 6, 24, { fill: false, stroke: 'imagined', dash: true, lw: 3 }); }

    var ex3 = WM.explainer({
      id: 'x-leaves-out', title: 'Every model leaves something out', duration: 72, poster: 14,
      scenes: [
        { start: 0, end: 8, caption: 'A simple model says all things fall together. Drop a stone. The prediction, a <b>dashed</b> ring, matches what happens.',
          draw: function (g, p, env) {
            dropFrame(g, false); legend(g, ['real', 'model']);
            D.text(g, 'stone', SX, 512, { size: 22, align: 'center', color: 'muted' });
            var t = Math.max(0, 8 * p - 1);
            stoneDraw(g, t, true);
            D.text(g, 'Model: all things fall together.', 480, 150, { size: 26, weight: 600, align: 'center', alpha: 1 });
            D.text(g, 'error close to zero', SX, 440 - 24, { size: 22, align: 'center', color: 'good', weight: 600, alpha: D.seg(p, 0.6, 0.8) });
          } },
        { start: 8, end: 20, caption: 'Now drop a feather with the same rule. The model still says it falls like the stone. It does not, and the gap is the error.',
          draw: function (g, p, env) {
            dropFrame(g); legend(g, ['real', 'model']);
            stoneDraw(g, 8, true);
            var t = Math.max(0, 12 * p - 1);
            simpleRuleExtra(g, t);
            var fy = featherY(t); leaf(g, featherX(t, 28), fy, 0.5 * Math.sin(2.2 * t + 1), { fill: 'surface' });
            var gy = stoneY(t) + 6;
            if (gy - fy > 14) {
              D.line(g, FX + 70, fy, FX + 70, gy, { color: 'error', lw: 5 });
              D.text(g, 'error', FX + 84, (fy + gy) / 2 + 8, { size: 24, weight: 700, color: 'error' });
            }
          } },
        { start: 20, end: 32, caption: 'The rule left something out. Air pushes back on a falling object. The push matters a lot for a light, wide feather and very little for a stone.',
          draw: function (g, p, env) {
            dropFrame(g);
            var yS = 250, yF = 250, e = D.ease(D.seg(p, 0.15, 0.7));
            D.dot(g, SX, yS, 15, { fill: 'reality' });
            leaf(g, FX, yF, 0, { fill: 'surface' });
            function arrows(x, y, L, dx) { for (var i = -1; i <= 1; i++) D.arrow(g, x + i * dx, y + 70, x + i * dx, y + 70 - L * e, { color: 'accent2', lw: 4, head: 12, alpha: L * e > 6 ? 1 : 0 }); }
            arrows(SX, yS, 12, 14); arrows(FX, yF, 62, 22);
            D.withAlpha(g, D.seg(p, 0.7, 0.9), function () {
              D.text(g, 'tiny push', SX, 380, { size: 24, align: 'center', color: 'accent2', weight: 700 });
              D.text(g, 'big push', FX, 380, { size: 24, align: 'center', color: 'accent2', weight: 700 });
            });
            D.text(g, 'air pushes up', 480, 150, { size: 28, weight: 700, font: 'display', align: 'center', color: 'accent2', alpha: D.seg(p, 0.05, 0.25) });
          } },
        { start: 32, end: 46, caption: 'Add the air to the model. Its prediction, dashed, now follows the feather. A small error remains because the model ignores the sideways drift.',
          draw: function (g, p, env) {
            dropFrame(g); legend(g, ['real', 'model']);
            stoneDraw(g, 8, true);
            var t = Math.max(0, 14 * p - 1), fy = featherY(t);
            D.dot(g, FX, fy, 26, { fill: false, stroke: 'imagined', dash: true, lw: 3 });
            leaf(g, featherX(t, 28), fy, 0.5 * Math.sin(2.2 * t + 1), { fill: 'surface' });
            D.text(g, 'Model: gravity plus air', 480, 150, { size: 26, weight: 600, align: 'center' });
            D.text(g, 'small error left', FX, 440 - 24, { size: 22, align: 'center', color: 'error', weight: 600, alpha: D.seg(p, 0.75, 0.9) });
          } },
        { start: 46, end: 60, caption: 'The richer model is better for feathers and costs more. It needs more facts and takes longer to run, and each extra fact can be wrong.',
          draw: function (g, p, env) {
            gridBg(g);
            function card(x, title, lines, dash, color, a0) {
              D.withAlpha(g, D.seg(p, a0, a0 + 0.1), function () {
                D.box(g, x, 70, 420, 300, { r: 8, fill: 'surface', stroke: color, lw: 3, dash: dash });
                D.text(g, title, x + 24, 120, { size: 30, weight: 700, font: 'display', color: color });
              });
              lines.forEach(function (l, i) { D.text(g, l, x + 24, 180 + i * 46, { size: 25, alpha: D.seg(p, a0 + 0.1 + i * 0.09, a0 + 0.2 + i * 0.09) }); });
            }
            card(40, 'Simple rule', ['Needs one fact: gravity', 'Runs instantly', 'Good for stones and balls', 'Wrong for feathers'], true, 'imagined', 0.02);
            card(500, 'Rule plus air', ['Needs size and shape too', 'Runs slower', 'Good for stones and feathers', 'More facts that can be wrong'], true, 'imagined', 0.12);
          } },
        { start: 60, end: 72, caption: 'No model is best everywhere. A model is judged by how well it answers the question you ask of it.',
          draw: function (g, p, env) {
            gridBg(g);
            var rows = [['Will the stone hit my foot?', 'The simple rule is enough.'], ['Where will the feather land?', 'The air must be included.']];
            rows.forEach(function (r, i) {
              var a = D.seg(p, 0.05 + i * 0.25, 0.2 + i * 0.25);
              D.withAlpha(g, a, function () {
                D.text(g, r[0], 40, 150 + i * 110, { size: 28, weight: 600 });
                D.arrow(g, 470, 142 + i * 110, 520, 142 + i * 110, { color: 'muted', lw: 3, head: 12 });
                D.text(g, r[1], 540, 150 + i * 110, { size: 28, color: 'imagined', weight: 600 });
              });
            });
            D.text(g, 'Useful means good enough for the question.', 480, 430, { size: 32, weight: 700, font: 'display', align: 'center', alpha: D.seg(p, 0.65, 0.9) });
          } }
      ] });

    /* ======================================================================
       INTERACTIVE 1  Catch the ball: predict first, then look
       ====================================================================== */
    function catchGame() {
      var G = 9.8, PXM = 20, GX = 60, GY = 372, Y0 = 1.5, CATCH = 1.5, NS = 6, SIG = 0.2;
      var st = { frac: 0.25, noisy: true, peek: false, round: 0, base: Math.floor(Math.random() * 1e6), phase: 'watch', t: 0, tc: 0, th: null, model: null, lock: 0, hist: [], youC: 0, modC: 0, last: null };
      var cvs, spot, ro = {}, note = notice('Choose where to stand, then watch. The model will play the same game.');

      function newThrow(same) {
        if (!same || !st.th) {
          st.round++;
          var r = WM.rng(st.base + st.round);
          var v = 13 + 6 * r(), a = (35 + 27 * r()) * Math.PI / 180;
          var vx = v * Math.cos(a), vy = v * Math.sin(a), T = (vy + Math.sqrt(vy * vy + 2 * G * Y0)) / G;
          var nx = [], ny = [];
          for (var i = 0; i < NS; i++) { nx.push(WM.gauss(r)); ny.push(WM.gauss(r)); }
          st.th = { vx: vx, vy: vy, T: T, xr: vx * T, nx: nx, ny: ny };
        }
        restart();
      }
      function fit() {
        var th = st.th, tc = st.tc, sg = st.noisy ? SIG : 0, n = NS, ts = [], X = [], Y = [];
        for (var i = 0; i < n; i++) {
          var t = tc * i / (n - 1);
          ts.push(t);
          X.push(th.vx * t + sg * th.nx[i]);
          Y.push(Y0 + th.vy * t - 0.5 * G * t * t + sg * th.ny[i]);
        }
        function lin(T, V) {
          var mt = 0, mv = 0, k;
          for (k = 0; k < T.length; k++) { mt += T[k]; mv += V[k]; }
          mt /= T.length; mv /= T.length;
          var sxy = 0, sxx = 0;
          for (k = 0; k < T.length; k++) { sxy += (T[k] - mt) * (V[k] - mv); sxx += (T[k] - mt) * (T[k] - mt); }
          var b = sxy / sxx; return [mv - b * mt, b];
        }
        var fx = lin(ts, X), fy = lin(ts, Y.map(function (y, k) { return y + 0.5 * G * ts[k] * ts[k]; }));
        var disc = Math.max(0, fy[1] * fy[1] + 2 * G * fy[0]), tst = (fy[1] + Math.sqrt(disc)) / G;
        st.model = { a: fx[0], b: fx[1], c: fy[0], d: fy[1], tst: tst, xp: fx[0] + fx[1] * tst, X: X, Y: Y };
      }
      function restart() {
        st.phase = 'watch'; st.t = 0; st.tc = st.frac * st.th.T; st.last = null;
        fit();
        if (ro.yc) summary();
        note.set('Choose where to stand, then watch. The model will play the same game.');
        if (cvs) { cvs.start(); }
        if (btnLock) btnLock.disabled = true;
      }
      function lockIn() {
        if (st.phase !== 'guess' && st.phase !== 'watch') return;
        st.lock = spot.get();
        st.phase = 'fly';
        if (btnLock) btnLock.disabled = true;
        cvs.start();
      }
      function key() { return st.frac + '|' + st.noisy; }
      function summary() {
        var hs = st.hist.filter(function (r) { return r.key === key(); }), n = hs.length, sy = 0, sm = 0, yc = 0, mc = 0;
        hs.forEach(function (r) { sy += r.you; sm += r.mod; if (r.you <= CATCH) yc++; if (r.mod <= CATCH) mc++; });
        ro.yc.set(yc + ' of ' + n); ro.mc.set(mc + ' of ' + n);
        return { n: n, ay: n ? sy / n : 0, am: n ? sm / n : 0 };
      }
      function finish() {
        var th = st.th, you = Math.abs(st.lock - th.xr), mod = Math.abs(st.model.xp - th.xr);
        st.last = { you: you, mod: mod };
        st.hist.push({ you: you, mod: mod, key: key() });
        var sm = summary();
        ro.you.set(f1(you) + ' m'); ro.mod.set(f1(mod) + ' m');
        var s = 'You missed by ' + f1(you) + ' m and the model by ' + f1(mod) + ' m.';
        if (sm.n >= 2) s += ' Average over ' + sm.n + ' throws at this view length: you ' + f1(sm.ay) + ' m, model ' + f1(sm.am) + ' m.';
        s += ' The model sees ' + NS + ' points over ' + f2(st.tc) + ' s. Move the slider and throw again to see how its error changes.';
        note.set(s);
        cvs.stop();
      }
      function px(m) { return GX + m * PXM; }
      function py(m) { return GY - m * PXM; }
      function pos(t) { var th = st.th; return [th.vx * t, Y0 + th.vy * t - 0.5 * G * t * t]; }

      function draw(g, env) {
        var Dd = env.d, c = env.c, th = st.th, dt = env.dt || 0;
        if (st.phase === 'watch') { st.t += dt; if (st.t >= st.tc) { st.t = st.tc; st.phase = 'guess'; if (btnLock) btnLock.disabled = false; cvs.stop(); } }
        else if (st.phase === 'fly') { st.t += dt; if (st.t >= th.T) { st.t = th.T; st.phase = 'done'; finish(); } }
        // ground and ticks
        Dd.line(g, 0, GY, 960, GY, { color: 'reality', lw: 3 });
        for (var m = 10; m <= 40; m += 10) { Dd.line(g, px(m), GY, px(m), GY + 8, { color: 'muted', lw: 2 }); Dd.text(g, m + ' m', px(m), GY + 12, { size: 20, align: 'center', baseline: 'top', color: 'muted', font: 'mono' }); }
        // thrower
        var hx = 36;
        Dd.dot(g, hx, 318, 12, { fill: false, stroke: 'reality', lw: 3 });
        Dd.line(g, hx, 330, hx, 360, { color: 'reality', lw: 3 }); Dd.line(g, hx, 360, hx - 9, GY, { color: 'reality', lw: 3 }); Dd.line(g, hx, 360, hx + 9, GY, { color: 'reality', lw: 3 });
        Dd.line(g, hx, 338, px(0), py(Y0), { color: 'reality', lw: 3 });
        // catch zone and marker
        var showMark = st.phase !== 'watch', mx = px(st.phase === 'fly' || st.phase === 'done' ? st.lock : spot.get());
        if (showMark) {
          Dd.box(g, mx - CATCH * PXM, GY - 9, 2 * CATCH * PXM, 9, { fill: 'accent2', stroke: false, alpha: 0.4 });
          Dd.line(g, mx, GY, mx, GY - 34, { color: 'accent2', lw: 4 });
          var fd = mx > 920 ? -1 : 1;
          Dd.poly(g, [[mx, GY - 34], [mx + 24 * fd, GY - 26], [mx, GY - 18]], { close: true, fill: 'accent2', color: 'accent2', lw: 2 });
          Dd.text(g, 'you', mx, GY - 42, { size: 20, align: 'center', color: 'accent2', weight: 700, halo: true });
        }
        // real flight so far
        var ts = st.t, pts = [];
        for (var t = 0; t <= ts; t += 0.04) { var q = pos(t); pts.push([px(q[0]), py(q[1])]); }
        var qe = pos(ts); pts.push([px(qe[0]), py(qe[1])]);
        Dd.poly(g, pts, { color: 'reality', lw: 4 });
        if (st.phase === 'guess') Dd.dot(g, px(qe[0]), py(qe[1]), 10, { fill: false, stroke: 'muted', dash: true, lw: 3 });
        else Dd.dot(g, px(qe[0]), py(qe[1]), 9, { fill: 'reality' });
        // what the model saw
        if (st.phase !== 'watch') for (var i = 0; i < NS; i++) Dd.dot(g, px(st.model.X[i]), py(st.model.Y[i]), 4, { fill: 'ink2' });
        // model prediction
        if (st.phase === 'done' || (st.peek && st.phase !== 'watch')) {
          var mp = [], md = st.model;
          for (var u = 0; u <= md.tst; u += 0.04) mp.push([px(md.a + md.b * u), py(md.c + md.d * u - 0.5 * G * u * u)]);
          mp.push([px(md.xp), GY]);
          Dd.poly(g, mp, { color: 'imagined', lw: 3, dash: true });
          Dd.dot(g, px(md.xp), GY, 10, { fill: false, stroke: 'imagined', dash: true, lw: 3 });
          if (st.phase !== 'done') Dd.text(g, 'model', px(md.xp), GY - 18, { size: 20, align: 'center', color: 'imagined', weight: 700, halo: true });
        }
        // result
        if (st.phase === 'done' && st.last) {
          Dd.dot(g, px(th.xr), GY, 8, { fill: 'reality' });
          var xs = [[mx, px(th.xr), GY - 74, 'you ' + f1(st.last.you) + ' m'], [px(st.model.xp), px(th.xr), GY - 100, 'model ' + f1(st.last.mod) + ' m']];
          xs.forEach(function (b) {
            var a = Math.min(b[0], b[1]), z = Math.max(b[0], b[1]);
            Dd.line(g, a, b[2], z, b[2], { color: 'error', lw: 4 });
            Dd.line(g, a, b[2] - 7, a, b[2] + 7, { color: 'error', lw: 3 }); Dd.line(g, z, b[2] - 7, z, b[2] + 7, { color: 'error', lw: 3 });
            if (z + 150 < 950) Dd.text(g, b[3], z + 12, b[2], { size: 20, baseline: 'middle', color: 'error', weight: 700, halo: true });
            else Dd.text(g, b[3], a - 12, b[2], { size: 20, baseline: 'middle', align: 'right', color: 'error', weight: 700, halo: true });
          });
        }
        // prompt
        var msg = st.phase === 'watch' ? 'Watch the first part of the throw'
          : st.phase === 'guess' ? 'Ball hidden. Click the ground to choose where to stand.'
            : st.phase === 'fly' ? 'Watch where it lands'
              : (st.last.you <= CATCH ? 'You caught it' : 'You missed by ' + f1(st.last.you) + ' m');
        Dd.text(g, msg, 480, 40, { size: 26, weight: 600, align: 'center', color: st.phase === 'done' ? (st.last.you <= CATCH ? 'good' : 'error') : 'ink' });
      }

      var btnLock, btnNew;
      cvs = WM.canvas({
        w: 960, h: 420, animate: true, label: 'A ball is thrown from the left. After the first part of its flight it is hidden, and you choose where to stand to catch it.',
        draw: draw,
        pointer: function (type, x, y) {
          if ((type === 'down' || type === 'move') && (st.phase === 'guess' || st.phase === 'watch')) {
            var m = clamp(Math.round((x - GX) / PXM * 2) / 2, 2, 44);
            spot.set(m);
          }
        }
      });
      spot = WM.slider({ label: 'Where you stand', min: 2, max: 44, step: 0.5, value: 20, fmt: 1, unit: 'm', onInput: function () { if (st.phase === 'guess') cvs.redraw(); } });
      var sFrac = WM.slider({ label: 'How much of the flight you see', min: 10, max: 60, step: 5, value: 25, fmt: 0, unit: '%', onInput: function (v) { st.frac = v / 100; newThrow(true); } });
      var tNoise = WM.toggle({ label: 'Blurry vision (noisy measurements)', value: true, onChange: function (v) { st.noisy = v; newThrow(true); } });
      var tPeek = WM.toggle({ label: 'Peek at the model’s prediction', value: false, onChange: function (v) { st.peek = v; cvs.redraw(); } });
      var bt = WM.buttons([
        { label: 'Lock in and watch', kind: 'primary', onClick: lockIn },
        { label: 'New throw', kind: 'ghost', onClick: function () { newThrow(false); } }
      ]);
      btnLock = bt.buttons[0]; btnLock.disabled = true; btnNew = bt.buttons[1];
      ro.you = WM.readout('Your miss', '—'); ro.mod = WM.readout('Model’s miss', '—');
      ro.yc = WM.readout('You caught (this setting)', '0 of 0'); ro.mc = WM.readout('Model caught (this setting)', '0 of 0');
      newThrow(false);
      return WM.panel({ title: 'Catch the ball', note: 'Watch the start of the throw, pick a spot, and lock in. Then drag <b>How much of the flight you see</b> down to 10% and throw again.' },
        cvs, WM.controls(spot, sFrac, tNoise, tPeek), WM.row(bt.el), WM.readouts(ro.you, ro.mod, ro.yc, ro.mc), note.el);
    }

    /* ======================================================================
       INTERACTIVE 2  Tune a forecaster: the loop with a dial
       ====================================================================== */
    function forecaster() {
      var TR = 22, T0 = 85, KT = 0.06, DT = 3, N = 20, K0 = 0.15;
      var st = { k: K0, lr: 0.3, sigma: 0.4, learn: true, auto: false, acc: 0, step: 0, run: 0, noise: [], obs: [], pred: [], err: [] };
      var cvs, kS, ro = {}, note = notice('Press Run one loop. The model predicts the next reading, then meets the real one.');
      function trueT(t) { return TR + (T0 - TR) * Math.exp(-KT * t); }
      function reset() {
        st.run++; st.step = 0; st.k = K0; st.pred = []; st.err = []; st.acc = 0;
        var r = WM.rng('tea' + st.run + '-' + Math.floor(st.sigma * 10)), i;
        st.noise = []; for (i = 0; i <= N; i++) st.noise.push(WM.gauss(r));
        st.obs = []; for (i = 0; i <= N; i++) st.obs.push(trueT(DT * i) + st.sigma * st.noise[i]);
        if (kS) kS.set(st.k);
        report();
      }
      function stepOnce() {
        if (st.step >= N) return;
        var i = st.step, o = st.obs[i], p = TR + (o - TR) * Math.exp(-st.k * DT), e = st.obs[i + 1] - p;
        st.pred[i] = p; st.err[i] = e;
        if (st.learn) {
          var slope = (o - TR) * DT * Math.exp(-st.k * DT);
          st.k = clamp(st.k - st.lr * e * slope / (slope * slope + 4), 0.005, 0.4);
          if (kS) kS.set(clamp(st.k, 0.01, 0.3));
        }
        st.step++;
      }
      function report() {
        var n = st.err.length;
        if (!n) { ro.last.set('—'); ro.avg.set('—'); }
        else {
          var e = st.err[n - 1];
          ro.last.set((e >= 0 ? '+' : '−') + f1(Math.abs(e)) + ' °C');
          var s = 0, m = Math.min(5, n); for (var i = n - m; i < n; i++) s += Math.abs(st.err[i]);
          ro.avg.set(f1(s / m) + ' °C');
        }
        ro.k.set(st.k.toFixed(3)); ro.kt.set(st.step >= N ? KT.toFixed(3) : 'hidden');
        if (!n) note.set('Press Run one loop. The model predicts the next reading, then meets the real one.');
        else {
          var t = 'Latest miss ' + ro.last.get() + '. The dial is at ' + st.k.toFixed(3) + (st.step >= N ? ', and the hidden true value is ' + KT.toFixed(3) + '.' : '.');
          if (st.learn && st.lr >= 0.8 && st.sigma >= 1) t += ' A high learning rate with noisy readings makes the dial chase the noise.';
          else if (!st.learn) t += ' Learning is off, so only you can move the dial.';
          note.set(t);
        }
      }
      function draw(g, env) {
        var Dd = env.d;
        if (st.auto) { st.acc += env.dt || 0; while (st.acc > 0.45 && st.step < N) { st.acc -= 0.45; stepOnce(); report(); } if (st.step >= N) { st.auto = false; tAuto.set(false); cvs.stop(); } }
        var ax = Dd.axes(g, 90, 20, 830, 260, { xlabel: 'minutes', ylabel: 'tea °C', size: 20, xticks: [[0, '0'], [1 / 3, '20'], [2 / 3, '40'], [1, '60']], yticks: [[0, '20'], [30 / 70, '50'], [60 / 70, '80']] });
        function X(t) { return ax.x(t / 60); } function Y(T) { return ax.y(clamp((T - 20) / 70, -0.05, 1.05)); }
        var now = DT * st.step, i;
        // reality so far
        var rp = []; for (var t = 0; t <= now + 0.01; t += 1) rp.push([X(t), Y(trueT(t))]);
        Dd.poly(g, rp, { color: 'reality', lw: 3 });
        // forecast from latest reading
        var fp = [], o = st.obs[st.step];
        for (var u = now; u <= 60.01; u += 1) fp.push([X(u), Y(TR + (o - TR) * Math.exp(-st.k * (u - now)))]);
        Dd.poly(g, fp, { color: 'imagined', lw: 4, dash: true });
        // one-step predictions and errors
        for (i = 0; i < st.pred.length; i++) {
          Dd.line(g, X(DT * (i + 1)), Y(st.pred[i]), X(DT * (i + 1)), Y(st.obs[i + 1]), { color: 'error', lw: 4 });
          Dd.dot(g, X(DT * (i + 1)), Y(st.pred[i]), 6, { fill: false, stroke: 'imagined', dash: true, lw: 2.5 });
        }
        for (i = 0; i <= st.step; i++) Dd.dot(g, X(DT * i), Y(st.obs[i]), 5, { fill: 'reality' });
        // legend
        var lx = 560, ly = 56;
        Dd.dot(g, lx, ly, 5, { fill: 'reality' }); Dd.text(g, 'measured temperature', lx + 20, ly, { size: 20, baseline: 'middle' });
        Dd.line(g, lx - 14, ly + 32, lx + 14, ly + 32, { color: 'imagined', lw: 4, dash: true }); Dd.text(g, 'model forecast', lx + 20, ly + 32, { size: 20, baseline: 'middle', color: 'imagined' });
        Dd.dot(g, lx, ly + 64, 6, { fill: false, stroke: 'imagined', dash: true, lw: 2.5 }); Dd.text(g, 'one-step prediction', lx + 20, ly + 64, { size: 20, baseline: 'middle', color: 'imagined' });
        Dd.line(g, lx, ly + 90, lx, ly + 112, { color: 'error', lw: 4 }); Dd.text(g, 'miss', lx + 20, ly + 101, { size: 20, baseline: 'middle', color: 'error' });
        // error strip
        Dd.text(g, 'Miss at each step (bar height = °C)', 90, 358, { size: 20, color: 'muted' });
        Dd.line(g, 90, 440, 920, 440, { color: 'muted', lw: 2 });
        Dd.line(g, 90, 440 - 65, 920, 440 - 65, { color: 'faint', lw: 1.5, dash: true }); Dd.text(g, '10', 80, 440 - 65, { size: 18, align: 'right', baseline: 'middle', color: 'muted', font: 'mono' });
        for (i = 0; i < st.err.length; i++) {
          var hh = Math.min(78, Math.abs(st.err[i]) * 6.5), bx = ax.x((i + 1) / N) - 11;
          Dd.box(g, bx, 440 - hh, 22, hh, { fill: 'error', stroke: false, alpha: 0.9 });
        }
      }
      var tAuto;
      cvs = WM.canvas({ w: 960, h: 460, animate: false, draw: draw, label: 'Chart of a cooling cup of tea with measured points, the model forecast, and the miss at each step' });
      kS = WM.slider({ label: 'Model dial: cooling rate', min: 0.01, max: 0.3, step: 0.005, value: K0, fmt: 3, unit: 'per min', onInput: function (v) { st.k = v; report(); cvs.redraw(); } });
      var lrS = WM.slider({ label: 'Learning rate', min: 0.05, max: 1, step: 0.05, value: st.lr, fmt: 2, onInput: function (v) { st.lr = v; report(); } });
      var nS = WM.slider({ label: 'Measurement noise', min: 0, max: 2, step: 0.1, value: st.sigma, fmt: 1, unit: '°C', onInput: function (v) { st.sigma = v; reset(); cvs.redraw(); } });
      var tL = WM.toggle({ label: 'Update the dial after each loop', value: true, onChange: function (v) { st.learn = v; report(); } });
      tAuto = WM.toggle({ label: 'Auto-run', value: false, onChange: function (v) { st.auto = v; if (v) { if (st.step >= N) reset(); cvs.start(); } else cvs.stop(); } });
      var bt = WM.buttons([
        { label: 'Run one loop', kind: 'primary', onClick: function () { stepOnce(); report(); cvs.redraw(); } },
        { label: 'Run to the end', kind: 'secondary', onClick: function () { while (st.step < N) stepOnce(); report(); cvs.redraw(); } },
        { label: 'Reset', kind: 'ghost', onClick: function () { reset(); cvs.redraw(); } }
      ]);
      ro.last = WM.readout('Latest miss', '—'); ro.avg = WM.readout('Average miss, last 5', '—');
      ro.k = WM.readout('Model dial', '0.150'); ro.kt = WM.readout('True value', 'hidden');
      reset();
      return WM.panel({ title: 'Tune a forecaster', note: 'Run the loop 20 times with learning on, then reset, switch learning off, and try to match the dashed line to the dots with the dial yourself.' },
        cvs, WM.controls(kS, lrS, nS, tL, tAuto), WM.row(bt.el), WM.readouts(ro.last, ro.avg, ro.k, ro.kt), note.el);
    }

    /* ======================================================================
       INTERACTIVE 3  Build your own model of a bouncing ball
       ====================================================================== */
    function heightAt(t, g, e, h0) {
      var t0 = Math.sqrt(2 * h0 / g);
      if (t < t0) return h0 - 0.5 * g * t * t;
      var tau = t - t0, v = g * t0 * e;
      for (var i = 0; i < 300; i++) {
        var fl = 2 * v / g;
        if (v < 0.02) return 0;
        if (tau < fl) return v * tau - 0.5 * g * tau * tau;
        tau -= fl; v *= e;
      }
      return 0;
    }
    function polyFit(x, y, deg) {
      var n = deg + 1, A = [], b = [], i, j, k;
      for (i = 0; i < n; i++) { A.push(new Array(n).fill(0)); b.push(0); }
      for (k = 0; k < x.length; k++) {
        var pw = [1]; for (j = 1; j <= 2 * deg; j++) pw.push(pw[j - 1] * x[k]);
        for (i = 0; i < n; i++) { b[i] += pw[i] * y[k]; for (j = 0; j < n; j++) A[i][j] += pw[i + j]; }
      }
      for (i = 0; i < n; i++) {
        var m = i; for (k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[m][i])) m = k;
        var tmp = A[i]; A[i] = A[m]; A[m] = tmp; var tb = b[i]; b[i] = b[m]; b[m] = tb;
        for (k = i + 1; k < n; k++) { var f = A[k][i] / A[i][i]; for (j = i; j < n; j++) A[k][j] -= f * A[i][j]; b[k] -= f * b[i]; }
      }
      var c = new Array(n).fill(0);
      for (i = n - 1; i >= 0; i--) { var sum = b[i]; for (j = i + 1; j < n; j++) sum -= A[i][j] * c[j]; c[i] = sum / A[i][i]; }
      return c;
    }
    function polyEval(c, x) { var s = 0; for (var i = c.length - 1; i >= 0; i--) s = s * x + c[i]; return s; }

    function bouncer() {
      var TG = 9.8, TE = 0.72, H0 = 4, SEEN = 3.5, TMAX = 7, SIG = 0.05, HM = 4.4;
      var r = WM.rng('bounce-data'), i, ts = [], ys = [];
      for (i = 0; i <= 35; i++) { ts.push(i * 0.1); ys.push(heightAt(i * 0.1, TG, TE, H0) + SIG * WM.gauss(r)); }
      var truth = []; for (i = 0; i <= 350; i++) truth.push(heightAt(i * 0.02, TG, TE, H0));
      var st = { mode: 'rules', g: 6, e: 0.5, deg: 5, reveal: false, clock: 0, key: '', curve: [], coef: null };
      var gS, eS, dS, ro = {}, note = notice('');
      function curve() {
        var k = st.mode + ',' + st.g + ',' + st.e + ',' + st.deg;
        if (k !== st.key) {
          st.key = k; st.curve = [];
          if (st.mode === 'curve') st.coef = polyFit(ts.map(function (t) { return t / SEEN; }), ys, st.deg);
          for (var j = 0; j <= 350; j++) st.curve.push(st.mode === 'rules' ? heightAt(j * 0.02, st.g, st.e, H0) : polyEval(st.coef, j * 0.02 / SEEN));
        }
        return st.curve;
      }
      function rulesSeen(g, e) { var s = 0; for (var j = 0; j < ts.length; j++) { var d = heightAt(ts[j], g, e, H0) - ys[j]; s += d * d; } return Math.sqrt(s / ts.length); }
      function seenErr() { var c = curve(), s = 0; for (var j = 0; j < ts.length; j++) { var d = c[j * 5] - ys[j]; s += d * d; } return Math.sqrt(s / ts.length); }
      function futErr() { var c = curve(), s = 0, n = 0; for (var j = 176; j <= 350; j++) { var d = c[j] - truth[j]; s += d * d; n++; } return Math.sqrt(s / n); }
      function setMode() {
        var rules = st.mode === 'rules';
        gS.input.disabled = !rules; eS.input.disabled = !rules; dS.input.disabled = rules;
        gS.el.style.opacity = eS.el.style.opacity = rules ? '1' : '0.45'; dS.el.style.opacity = rules ? '0.45' : '1';
        if (btnFit) btnFit.disabled = !rules;
      }
      function report() {
        if (typeof RM !== 'undefined' && RM && cvs) cvs.redraw();
        var se = seenErr(), fe = futErr(), rules = st.mode === 'rules';
        var fut = fe > 99 ? 'over 99 m' : f2(fe) + ' m';
        ro.seen.set(f2(se) + ' m'); ro.fut.set(st.reveal ? fut : 'hidden');
        var t = se <= 0.07 ? 'The dashed line follows the dots to within the measurement noise, so no setting can do much better on this data.'
          : 'The dashed line misses the dots by about ' + f2(se) + ' m on average.' + (rules ? ' Move the dials to shrink the red ticks.' : ' A higher degree bends the curve closer to the dots.');
        if (st.reveal) {
          t += ' On the future part the miss is ' + fut + '.';
          if (!rules && fe > 3 * Math.max(se, 0.05)) t += ' The curve fits the dots and fails beyond them, because it holds no rule about gravity or bounces.';
          else if (rules && se <= 0.07 && fe < 0.1) t += ' Correct rules carry over to the future.';
          else if (rules && fe > 1.5 * se) t += ' Small dial errors grow with each bounce.';
        } else t += ' Reveal the future to test the model on data it has not seen.';
        note.set(t);
      }
      function draw(g, env) {
        var Dd = env.d;
        st.clock += env.dt || 0;
        var tt = st.clock % 8;
        var cv = curve();
        var GL = 330, R = 16, sc = 64;
        Dd.line(g, 20, GL, 300, GL, { color: 'reality', lw: 3 });
        var hr = heightAt(tt, TG, TE, H0), hm = clamp(cv[Math.min(350, Math.round(tt / 0.02))], 0, 4.8);
        var hidden = !st.reveal && tt > SEEN;
        if (hidden) { Dd.dot(g, 100, GL - R, R, { fill: false, stroke: 'muted', dash: true, lw: 2.5 }); Dd.text(g, '?', 100, GL - R, { size: 22, align: 'center', baseline: 'middle', color: 'muted', weight: 700 }); }
        else Dd.dot(g, 100, GL - R - hr * sc, R, { fill: 'reality' });
        Dd.dot(g, 240, GL - R - hm * sc, R, { fill: false, stroke: 'imagined', dash: true, lw: 3 });
        Dd.text(g, 'Reality', 100, 372, { size: 22, align: 'center' });
        Dd.text(g, 'Your model', 240, 372, { size: 22, align: 'center', color: 'imagined', weight: 600 });
        Dd.text(g, hidden ? 'no data after ' + SEEN + ' s' : 't = ' + f1(tt) + ' s', 170, 412, { size: 20, align: 'center', color: 'muted', font: 'mono' });
        var ax = Dd.axes(g, 400, 30, 520, 290, { xlabel: 'time (s)', ylabel: 'height (m)', size: 20, xticks: [[0, '0'], [2 / 7, '2'], [4 / 7, '4'], [6 / 7, '6']], yticks: [[0, '0'], [2 / HM, '2'], [4 / HM, '4']] });
        function X(t) { return ax.x(t / TMAX); } function Y(h) { return ax.y(clamp(h / HM, -0.015, 1.06)); }
        Dd.line(g, X(SEEN), ax.y(0), X(SEEN), ax.y(1), { color: 'muted', lw: 2, dash: true });
        Dd.text(g, 'data ends', X(SEEN) + 8, ax.y(1) + 4, { size: 20, color: 'muted', baseline: 'top' });
        var j;
        for (j = 0; j < ts.length; j++) Dd.line(g, X(ts[j]), Y(ys[j]), X(ts[j]), Y(cv[j * 5]), { color: 'error', lw: 2, alpha: 0.65 });
        if (st.reveal) {
          for (j = 36; j <= 350; j += 5) Dd.line(g, X(j * 0.02), Y(truth[j]), X(j * 0.02), Y(cv[j]), { color: 'error', lw: 2, alpha: 0.5 });
          var tp = []; for (j = 0; j <= 350; j++) tp.push([X(j * 0.02), Y(truth[j])]);
          Dd.poly(g, tp, { color: 'reality', lw: 3 });
        }
        var mp = []; for (j = 0; j <= 350; j++) mp.push([X(j * 0.02), Y(cv[j])]);
        Dd.poly(g, mp, { color: 'imagined', lw: 4, dash: true });
        for (j = 0; j < ts.length; j++) Dd.dot(g, X(ts[j]), Y(ys[j]), 4.5, { fill: 'reality' });
        Dd.line(g, X(tt), ax.y(0), X(tt), ax.y(1), { color: 'accent2', lw: 2, alpha: 0.8 });
      }
      var RM = WM.reducedMotion();
      var cvs = WM.canvas({ w: 960, h: 430, animate: !RM, draw: draw, label: 'Two balls drop and bounce, one real and one from your model, with a plot of height against time comparing the data to your model' });
      var btnFit;
      var mSel = WM.select({ label: 'Kind of model', options: [{ value: 'rules', label: 'Rules: gravity and bounce' }, { value: 'curve', label: 'Curve fit: no rules' }], value: 'rules', onChange: function (v) { st.mode = v; setMode(); report(); } });
      gS = WM.slider({ label: 'Strength of gravity', min: 2, max: 20, step: 0.1, value: st.g, fmt: 1, unit: 'm/s²', onInput: function (v) { st.g = v; report(); } });
      eS = WM.slider({ label: 'Bounciness (share of speed kept)', min: 0.1, max: 0.95, step: 0.01, value: st.e, fmt: 2, onInput: function (v) { st.e = v; report(); } });
      dS = WM.slider({ label: 'Curve flexibility (degree)', min: 2, max: 9, step: 1, value: st.deg, fmt: 0, onInput: function (v) { st.deg = v; report(); } });
      var tS = RM ? WM.slider({ label: 'Time shown in the two animations', min: 0, max: 7.9, step: 0.1, value: 0, fmt: 1, unit: 's', onInput: function (v) { st.clock = v; cvs.redraw(); } }) : null;
      var tR = WM.toggle({ label: 'Reveal the future', value: false, onChange: function (v) { st.reveal = v; report(); } });
      var bt = WM.buttons([
        { label: 'Let the computer fit the rules', kind: 'primary', onClick: function () {
          var best = 1e9, bg = st.g, be = st.e;
          for (var g2 = 2; g2 <= 20.001; g2 += 0.1) for (var e2 = 0.1; e2 <= 0.9501; e2 += 0.01) { var s = rulesSeen(g2, e2); if (s < best) { best = s; bg = g2; be = e2; } }
          st.g = Math.round(bg * 10) / 10; st.e = Math.round(be * 100) / 100; gS.set(st.g); eS.set(st.e); report();
        } },
        { label: 'Reset dials', kind: 'ghost', onClick: function () { st.g = 6; st.e = 0.5; st.deg = 5; gS.set(6); eS.set(0.5); dS.set(5); report(); } }
      ]);
      btnFit = bt.buttons[0];
      ro.seen = WM.readout('Miss on the dots (rms)', '—'); ro.fut = WM.readout('Miss on the future (rms)', 'hidden'); ro.floor = WM.readout('Measurement noise', f2(SIG) + ' m');
      setMode(); report();
      return WM.panel({ title: 'Build your own model of a bouncing ball', note: 'Tune the two dials until the dashed line runs through the dots, then switch on <b>Reveal the future</b>. Next change the kind of model to a curve fit and compare.' },
        cvs, WM.controls.apply(null, tS ? [mSel, gS, eS, dS, tR, tS] : [mSel, gS, eS, dS, tR]), WM.row(bt.el), WM.readouts(ro.seen, ro.fut, ro.floor), note.el);
    }

    /* ======================================================================
       Pregnancy figure: a growth chart is a very small world model (SYNTHETIC)
       ====================================================================== */
    function growthFigure() {
      var st = { m36: 2200 };
      function med(w) { return Math.exp(0.496 + 0.3397 * w - 0.00372 * w * w); }
      var ro = {}, note = notice('');
      function status() { var m = med(36), lo = 0.88 * m, hi = 1.12 * m; return st.m36 < lo ? 'below range' : st.m36 > hi ? 'above range' : 'inside range'; }
      function report() {
        var m = med(36), gap = st.m36 - m, s = status();
        ro.exp.set(Math.round(m) + ' g'); ro.gap.set((gap >= 0 ? '+' : '−') + Math.round(Math.abs(gap)) + ' g (' + (gap >= 0 ? '+' : '−') + Math.round(Math.abs(gap) / m * 100) + '%)'); ro.st.set(s);
        note.set(s === 'inside range' ? 'The measurement agrees with the chart, so there is no surprise to act on.'
          : 'The measurement disagrees with the chart. That is a prediction error. It says look closer. It does not say why, and the scan estimate is itself uncertain.');
      }
      var cvs = WM.canvas({
        w: 960, h: 460, label: 'Synthetic chart of expected fetal weight from 20 to 40 weeks with an expected range and three measurements',
        draw: function (g, env) {
          var Dd = env.d;
          var ax = Dd.axes(g, 140, 30, 770, 330, { xlabel: 'weeks of pregnancy', ylabel: 'estimated weight (g)', size: 20, xticks: [[0, '20'], [0.25, '25'], [0.5, '30'], [0.75, '35'], [1, '40']], yticks: [[0, '0'], [1000 / 3800, '1000'], [2000 / 3800, '2000'], [3000 / 3800, '3000']] });
          function X(w) { return ax.x((w - 20) / 20); } function Y(v) { return ax.y(v / 3800); }
          var up = [], lo = [], mid = [], w;
          for (w = 20; w <= 40.01; w += 0.5) { up.push([X(w), Y(1.12 * med(w))]); lo.push([X(w), Y(0.88 * med(w))]); mid.push([X(w), Y(med(w))]); }
          Dd.poly(g, up.concat(lo.slice().reverse()), { close: true, fill: 'imagined', alpha: 0.14 });
          Dd.poly(g, up, { color: 'imagined', lw: 2, dash: true, alpha: 0.55 }); Dd.poly(g, lo, { color: 'imagined', lw: 2, dash: true, alpha: 0.55 });
          Dd.poly(g, mid, { color: 'imagined', lw: 4, dash: true });
          var ms = [[28, 1170], [32, 1850], [36, st.m36]];
          ms.forEach(function (p) {
            var wx = X(p[0]), exp = med(p[0]), out = p[1] < 0.88 * exp || p[1] > 1.12 * exp;
            Dd.line(g, wx, Y(exp), wx, Y(p[1]), { color: 'error', lw: out ? 5 : 3, alpha: out ? 1 : 0.6 });
            Dd.dot(g, wx, Y(p[1]), 8, { fill: 'reality' });
          });
          var s = status(), p36 = Y(st.m36);
          Dd.text(g, '36 weeks: ' + (s === 'inside range' ? 'inside the expected range' : s === 'below range' ? 'below the expected range' : 'above the expected range'), X(40), Y(650), { size: 22, weight: 700, align: 'right', color: s === 'inside range' ? 'good' : 'error', halo: true });
          var lx = 180, ly = 56;
          Dd.line(g, lx, ly, lx + 40, ly, { color: 'imagined', lw: 4, dash: true }); Dd.text(g, 'expected weight (the model’s prediction)', lx + 54, ly, { size: 20, baseline: 'middle', color: 'imagined' });
          Dd.box(g, lx, ly + 20, 40, 18, { fill: 'imagined', stroke: false, alpha: 0.2 }); Dd.text(g, 'expected range (illustrative)', lx + 54, ly + 29, { size: 20, baseline: 'middle', color: 'ink2' });
          Dd.dot(g, lx + 20, ly + 62, 7, { fill: 'reality' }); Dd.text(g, 'measured at a scan', lx + 54, ly + 62, { size: 20, baseline: 'middle' });
          Dd.line(g, lx + 20, ly + 84, lx + 20, ly + 104, { color: 'error', lw: 4 }); Dd.text(g, 'prediction error', lx + 54, ly + 94, { size: 20, baseline: 'middle', color: 'error' });
          Dd.text(g, 'Synthetic numbers for teaching', 910, 446, { size: 20, align: 'right', color: 'muted' });
        }
      });
      var sl = WM.slider({ label: 'Measured weight at 36 weeks', min: 1800, max: 3200, step: 10, value: st.m36, fmt: 0, unit: 'g', onInput: function (v) { st.m36 = v; report(); cvs.redraw(); } });
      ro.exp = WM.readout('Chart expects at 36 weeks', '—'); ro.gap = WM.readout('Gap (measured minus expected)', '—'); ro.st = WM.readout('Reading', '—');
      report();
      return WM.panel({ kicker: 'Interactive, synthetic data', title: 'A growth chart as a prediction', note: 'Drag the weight measured at 36 weeks and watch the gap, the error line and the reading change.' },
        cvs, WM.controls(sl), WM.readouts(ro.exp, ro.gap, ro.st), note.el);
    }

    /* ======================================================================
       Page assembly
       ====================================================================== */
    root.append(
      WM.hero({
        kicker: 'Module 1 · Foundations', minutes: 25, title: 'What is a world model?',
        lede: 'When you reach out to catch a ball, you do not wait to see where it lands. Your brain is already anticipating its motion, using a <dfn data-def="An internal simulation of how a situation changes over time. It is used to predict what happens next and to try actions in imagination.">world model</dfn>. This module shows what such a model is, how it is used and how it is corrected.',
        goals: [
          'Say what a world model is and what it is used for.',
          'Name the five steps of the loop (observe, predict, act, compare, update) and find each one in an everyday example.',
          'Measure how wrong a prediction is, and explain why a model that leaves things out can still be useful.'
        ]
      }),

      WM.section({ id: 'simulator', kicker: '§1', title: 'A simulator in your head' },
        WM.p('Picture a cup sliding towards the edge of a table. Before it drops you know how this ends. Nobody told you. You ran a short <dfn data-def="A step-by-step imitation of how something would unfold, run without doing it for real.">simulation</dfn> in your head, using what you have learned about how things move and fall.'),
        WM.p('That inner simulation is a world model. It has two jobs. It predicts what happens next if nothing interferes. It also answers what-if questions, such as what happens if a hand is placed at the edge of the table, without breaking any cups.'),
        ex1,
        WM.callout('idea', 'A world model is a cheap simulator', 'The model is much cheaper to run than the world. Trying a bad idea in the world can cost a broken cup, a failed experiment or a risky treatment. Trying it in the model costs a moment of thought. This is the reason brains, robots and forecasters all keep one.'),
        WM.callout('warn', 'A model is not a copy of the world', 'A common first guess is that a world model is a detailed picture of everything. It is not. Your cup model says nothing about the colour of the table or the age of the cup. It keeps only what helps predict the next moment, so models are small on purpose.')
      ),

      WM.section({ id: 'predict', kicker: '§2', title: 'Predict first, then look' },
        WM.p('A prediction is easy to claim and easy to test. In the game below a ball is thrown and you see only the first part of its flight. You then choose where to stand to catch it. Standing somewhere is an <dfn data-def="Something an agent does that can change the world, such as moving to a spot.">action</dfn> that rests on a prediction.'),
        WM.p('A simple computer model plays the same game. It knows one rule, the steady pull of gravity. From the points it sees, it estimates how fast the ball is moving, then runs the flight forward. Its measurements carry <dfn data-def="Random wobble in a measurement that is not part of the thing being measured.">noise</dfn>, so its estimate is never exact.'),
        catchGame(),
        WM.p('The model’s miss grows as it sees less of the flight. Its estimate of the ball’s speed rests on a few blurry points, and a small error in speed becomes a large error in landing spot by the end of the flight. A related effect, error that builds up as a model is run further ahead, returns in module 3 under the name compounding error.')
      ),

      WM.section({ id: 'loop', kicker: '§3', title: 'The loop that keeps a model honest' },
        WM.p('A model is useful only while it stays in touch with the world. That contact comes from a loop with five steps, repeated for as long as the agent is active. An <dfn data-def="Anything that senses, decides and acts, such as a person, a robot or a program.">agent</dfn> is any such actor.'),
        ex2,
        WM.callout('idea', 'The loop', '<ol><li><b>Observe.</b> Take in what the world looks like now.</li><li><b>Predict.</b> Run the model forward to say what comes next, with and without a planned action.</li><li><b>Act.</b> Do the thing that looks best.</li><li><b>Compare.</b> Set the prediction beside what happened. The difference is the <dfn data-def="The gap between what the model predicted and what was actually observed.">prediction error</dfn>.</li><li><b>Update.</b> Change the model a little so that the error would have been smaller.</li></ol>'),
        WM.callout('warn', 'A model is not built once and then finished', 'The loop never stops. Even adults keep adjusting their model of how a ball bounces, which is why a ball on an unfamiliar surface surprises you for a moment.'),
        WM.p('The update step has a dial of its own. Each time the model is corrected it can move a lot or a little. This size is the <dfn data-def="How big a correction the model makes after each error.">learning rate</dfn>. In the next interactive a cup of tea cools in a room. The model has one <dfn data-def="A dial inside a model whose setting changes its predictions, for example how fast tea cools.">parameter</dfn>, the cooling rate, and it starts with a poor setting.'),
        forecaster(),
        WM.p('A low learning rate corrects the model slowly. A high one makes the model react to the random wobble in each reading as if it were real change, so the dial jumps around. Good forecasters choose a middle path.')
      ),

      WM.section({ id: 'leaves-out', kicker: '§4', title: 'Every model leaves something out' },
        WM.p('A rule that works for a stone gives the wrong answer for a feather, because the rule leaves out the air. Adding the air improves the prediction and makes the model harder to run.'),
        ex3,
        WM.p('Now build a model yourself. A ball is dropped and bounces. The dots are measurements of its height over the first 3.5 seconds. Your model has two dials, the strength of gravity and the bounciness. Set them so the dashed line follows the dots, then reveal the future to see whether the model keeps working. A second option replaces the rules with a flexible curve, bent to pass as close to the dots as it can (module 3 explains how such fits are computed).'),
        bouncer(),
        WM.callout('idea', 'A good fit to the past does not guarantee a good forecast', 'A flexible curve can pass close to every dot and still be useless beyond them, because it holds no knowledge of how balls move. A model with the right rules can carry on into the future. Even then, small errors in a dial grow with each bounce. The button that fits the dials for you is a first look at learning a model from data, which module 3 covers in detail.')
      ),

      WM.section({ id: 'pregnancy', kicker: '§5', title: 'A pregnancy example' },
        WM.callout('pregnancy', 'Pregnancy corner: the growth chart', '<p>A fetal growth chart is a small world model. Give it the gestational age and it predicts an expected weight range. A scan then measures the real value. A gap between the two is a prediction error. It prompts a closer look, such as a repeat scan, because part of the gap may be error in the scan estimate itself.</p><p>Blood pressure follows the same logic. It is expected to change with gestation, lowest in the first half of pregnancy and rising towards term, although a 2019 meta-analysis (Loerup and colleagues, <i>BMC Medicine</i>) did not find the large mid-pregnancy fall that is commonly taught. A reading far from the expected pattern for that gestation gets attention. All numbers below are synthetic and illustrative. They are not a reference chart.</p>'),
        growthFigure(),
        WM.p('The chart takes one input and returns one number. Richer questions need richer models. What is the state of this pregnancy now, including things nobody measures directly? Which actions are available? How does the state change under each action? Module 2 introduces the vocabulary of state, action and transition that these questions need.')
      ),

      WM.takeaways([
        'A <b>world model</b> is an inner simulator of how things change. It predicts the next moment and answers what-if questions cheaply.',
        'The loop is observe, predict, act, compare, update. The <b>prediction error</b> is the signal that drives improvement.',
        'Every model leaves something out. It is judged by how well it answers the question being asked, and its dials are tuned with data.',
        'A good fit to past data does not guarantee a good forecast, and noisy measurements limit what any model can predict.'
      ]),

      WM.quiz({
        id: 'check', title: 'Check your understanding',
        questions: [
          { q: 'Which statement best describes a world model?',
            options: ['A detailed picture that stores everything about the world', 'An inner simulator that predicts how a situation changes and lets you try actions in imagination', 'A list of facts that is looked up when needed', 'A recording of what has already happened'],
            answer: 1, why: 'A world model is useful because it can be run forward. It keeps only what helps prediction, so it is neither a full picture nor a record.' },
          { q: 'A fielder runs to the spot where the ball is right now and misses. Which step of the loop went wrong first?',
            options: ['Observe', 'Update', 'Predict', 'Compare'],
            answer: 2, why: 'Seeing the ball was fine. The mistake was to treat where the ball is as where it will be. Predicting means carrying the ball forward in time. Compare and update only come after the ball lands.' },
          { q: 'In the tea forecaster the learning rate is very high and the readings are very noisy. What is most likely?',
            options: ['The dial jumps around because the model reacts to random wobble as if it were real change', 'The model learns faster and ends up more accurate', 'Nothing changes, because the learning rate only affects the animation speed', 'The model stops making predictions'],
            answer: 0, why: 'A large correction after every reading means a noisy reading moves the dial a long way. The model chases noise instead of the true cooling rate.' },
          { q: 'A model matches all of the past data perfectly. What can you conclude?',
            options: ['It will predict the future well', 'It has captured every rule of the world', 'The measurements contained no noise', 'Very little by itself, because it may be tuned only to the past and small errors can grow over time'],
            answer: 3, why: 'A good fit to past data is not enough on its own, and a perfect match to noisy data can mean the model has learned the noise. In the bouncing ball, dial values slightly off can fit the first bounces and still drift later.' },
          { q: 'A growth chart expects a fetus at 36 weeks to weigh within a range, and a scan estimate falls below it. In the language of the loop, the gap is',
            options: ['proof that the fetus is growth restricted', 'a prediction error, which is information that prompts a closer look and may partly reflect measurement uncertainty', 'an update to the chart', 'an action taken by the clinician'],
            answer: 1, why: 'The gap is the compare step. It tells you the model and the measurement disagree, not which one is at fault. Scan estimates are uncertain, and the chart only knows gestational age.' },
          { q: 'In the diagrams of this course, a dashed violet line shows',
            options: ['what the model predicts or imagines', 'what really happened', 'the prediction error', 'the noise in a measurement'],
            answer: 0, why: 'Solid lines are reality, dashed violet lines are the model’s imagination and red marks error. Shape and label are used as well as colour.' }
        ]
      })
    );
  }
});
