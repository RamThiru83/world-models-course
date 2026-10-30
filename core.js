/* ==========================================================================
   World Models course: core runtime (window.WM)
   Plain JS, no dependencies. Modules call WM.register(...). The only fetch is
   the optional narration/manifest.json (synced voice-over for explainers).
   ========================================================================== */
(function () {
  'use strict';

  var WM = (window.WM = window.WM || {});
  var doc = document;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var SVG_TAGS = { svg: 1, path: 1, circle: 1, rect: 1, line: 1, polyline: 1, polygon: 1, g: 1, text: 1, tspan: 1, defs: 1, marker: 1, ellipse: 1, title: 1, use: 1, pattern: 1, clipPath: 1 };

  var mqReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener: function () {} };
  var mqDark = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : { matches: false, addEventListener: function () {} };
  WM.reducedMotion = function () { return !!mqReduce.matches; };

  /* ------------------------------------------------------------------ store */
  var mem = Object.create(null);
  WM.store = {
    get: function (key, def) {
      if (key in mem) return mem[key];
      try {
        var raw = window.localStorage.getItem('wm:' + key);
        if (raw != null) { var v = JSON.parse(raw); mem[key] = v; return v; }
      } catch (e) { /* storage unavailable */ }
      return def;
    },
    set: function (key, val) {
      mem[key] = val;
      try { window.localStorage.setItem('wm:' + key, JSON.stringify(val)); } catch (e) { /* memory only */ }
      return val;
    }
  };

  /* ---------------------------------------------------------------- h() */
  function appendKids(el, kids) {
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      if (c == null || c === false || c === true) continue;
      if (Array.isArray(c)) appendKids(el, c);
      else if (c instanceof Node) el.appendChild(c);
      else if (c && c.el instanceof Node) el.appendChild(c.el);
      else el.appendChild(doc.createTextNode(String(c)));
    }
    return el;
  }
  function isAttrs(a) {
    return a != null && typeof a === 'object' && !(a instanceof Node) && !Array.isArray(a) && !(a.el instanceof Node);
  }
  function h(tag, attrs) {
    var kids = Array.prototype.slice.call(arguments, 2);
    var el = typeof tag === 'string' ? (SVG_TAGS[tag] ? doc.createElementNS(SVGNS, tag) : doc.createElement(tag)) : tag;
    if (attrs != null && !isAttrs(attrs)) { kids.unshift(attrs); attrs = null; }
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class' || k === 'className') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
        else if (k === 'style') {
          if (typeof v === 'string') el.style.cssText = v;
          else for (var s in v) { if (v[s] == null) continue; if (s.indexOf('-') >= 0) el.style.setProperty(s, v[s]); else el.style[s] = v[s]; }
        }
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'html') { el.innerHTML = v; prepDfn(el); }
        else if (k === 'text') el.textContent = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
      }
    }
    return appendKids(el, kids);
  }
  WM.h = h;

  function rich(tag, cls, html) {
    var el = h(tag, { class: cls });
    if (html != null) {
      if (html instanceof Node) el.appendChild(html);
      else el.innerHTML = String(html);
    }
    prepDfn(el);
    return el;
  }

  function icon(name) {
    var paths = {
      play: 'M7 4.5v15l12-7.5z',
      pause: 'M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z',
      replay: 'M12 5a7 7 0 1 1-6.6 4.7l1.9.6A5 5 0 1 0 12 7v3L7.5 6 12 2z',
      home: 'M3 11.5 12 4l9 7.5V20h-6v-5H9v5H3z',
      menu: 'M4 6.5h16v1.6H4zM4 11.2h16v1.6H4zM4 15.9h16v1.6H4z',
      close: 'M6.3 5.2 12 10.9l5.7-5.7 1.1 1.1-5.7 5.7 5.7 5.7-1.1 1.1-5.7-5.7-5.7 5.7-1.1-1.1 5.7-5.7-5.7-5.7z',
      theme: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 1.8v14.4a7.2 7.2 0 0 1 0-14.4z',
      arrowR: 'M5 11.2h11.1l-4.4-4.4 1.1-1.1 6.3 6.3-6.3 6.3-1.1-1.1 4.4-4.4H5z'
    };
    return h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, h('path', { d: paths[name], fill: 'currentColor' }));
  }
  WM.icon = icon;

  /* --------------------------------------------------------- theme & colours */
  var TOKENS = ['bg', 'surface', 'stage', 'raise', 'ink', 'ink-2', 'muted', 'line', 'faint', 'reality', 'imagined', 'error', 'good', 'warn', 'accent2'];
  var colorCache = null, fontCache = null;
  WM.colors = function () {
    if (colorCache) return colorCache;
    var cs = getComputedStyle(doc.documentElement), o = {};
    TOKENS.forEach(function (t) {
      var v = cs.getPropertyValue('--' + t).trim();
      o[t === 'ink-2' ? 'ink2' : t] = v || '#888888';
    });
    colorCache = o;
    return o;
  };
  WM.fonts = function () {
    if (fontCache) return fontCache;
    var cs = getComputedStyle(doc.documentElement);
    fontCache = {
      body: cs.getPropertyValue('--font-body').trim() || 'system-ui, sans-serif',
      mono: cs.getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace',
      display: cs.getPropertyValue('--font-display').trim() || 'system-ui, sans-serif'
    };
    return fontCache;
  };
  function themeChanged() {
    colorCache = null; fontCache = null;
    try { window.dispatchEvent(new CustomEvent('wm:theme')); } catch (e) { /* old browsers */ }
  }
  WM.onTheme = function (fn) {
    window.addEventListener('wm:theme', fn);
    return function () { window.removeEventListener('wm:theme', fn); };
  };
  if (mqDark.addEventListener) mqDark.addEventListener('change', themeChanged);
  new MutationObserver(themeChanged).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(themeChanged);
  if (doc.fonts && doc.fonts.addEventListener) doc.fonts.addEventListener('loadingdone', themeChanged);

  /* ------------------------------------------------------------ disposers */
  var disposers = [];
  function onDispose(fn) { disposers.push(fn); }
  function disposeAll() {
    var list = disposers; disposers = [];
    list.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
  }
  WM.onDispose = onDispose;

  /* shared observers */
  var visCbs = new WeakMap();
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { var cb = visCbs.get(e.target); if (cb) cb(e.isIntersecting ? e.intersectionRatio : 0, e); });
  }, { threshold: [0, 0.01, 0.15, 0.35, 0.5, 0.75, 1] }) : null;
  function watchVis(el, cb) {
    if (!io) { cb(1); return function () {}; }
    visCbs.set(el, cb); io.observe(el);
    return function () { io.unobserve(el); visCbs.delete(el); };
  }
  var sizeCbs = new WeakMap();
  var ro = 'ResizeObserver' in window ? new ResizeObserver(function (entries) {
    entries.forEach(function (e) { var cb = sizeCbs.get(e.target); if (cb) cb(); });
  }) : null;
  function watchSize(el, cb) {
    if (!ro) { window.addEventListener('resize', cb); return function () { window.removeEventListener('resize', cb); }; }
    sizeCbs.set(el, cb); ro.observe(el);
    return function () { ro.unobserve(el); sizeCbs.delete(el); };
  }

  /* --------------------------------------------------------------- numbers */
  WM.rng = function (seed) {
    var a;
    if (typeof seed === 'string') { a = 2166136261; for (var i = 0; i < seed.length; i++) { a ^= seed.charCodeAt(i); a = Math.imul(a, 16777619); } }
    else a = (seed == null ? 1 : Math.floor(seed)) >>> 0;
    if (!a) a = 0x9E3779B9;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  WM.gauss = function (rng) {
    rng = rng || Math.random;
    var u = 0; while (u === 0) u = rng();
    var v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  WM.ui = {
    fmt: function (n, digits) {
      if (n == null || typeof n !== 'number' || !isFinite(n)) return n == null ? '' : String(n);
      var d = digits == null ? (Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2) : digits;
      var s = n.toFixed(d);
      if (/^-0(\.0+)?$/.test(s)) s = s.slice(1);
      return s.replace('-', '−');
    }
  };

  WM.loop = function (fn) {
    var id = 0, last = 0, running = false;
    function tick(ts) {
      if (!running) return;
      var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
      last = ts;
      try { fn(dt); } catch (e) { running = false; console.error(e); return; }
      if (running) id = requestAnimationFrame(tick);
    }
    return {
      start: function () { if (running) return; running = true; last = 0; id = requestAnimationFrame(tick); },
      stop: function () { running = false; cancelAnimationFrame(id); },
      get running() { return running; }
    };
  };

  /* ------------------------------------------------------------ draw utils */
  function C() { return WM.colors(); }
  function col(v, def) {
    if (v == null || v === true) return def;
    var c = C();
    if (typeof v === 'string' && Object.prototype.hasOwnProperty.call(c, v)) return c[v];
    return v;
  }
  function dashOf(v, lw) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === 'number') return [v, v];
    var w = lw || 2;
    return [Math.max(6, w * 4), Math.max(5, w * 3)];
  }
  function fam(f) {
    var F = WM.fonts();
    if (!f || f === 'body') return F.body;
    if (f === 'mono') return F.mono;
    if (f === 'display') return F.display;
    return f;
  }
  function normPts(pts) {
    return (pts || []).map(function (p) { return Array.isArray(p) ? p : [p.x, p.y]; });
  }
  function partial(pts, t) {
    if (t == null || t >= 1 || pts.length < 2) return pts;
    if (t <= 0) return [pts[0]];
    var lens = [], L = 0;
    for (var i = 1; i < pts.length; i++) { var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(l); L += l; }
    var target = L * t, out = [pts[0]];
    for (var j = 1; j < pts.length; j++) {
      if (target >= lens[j - 1]) { out.push(pts[j]); target -= lens[j - 1]; }
      else { var f = lens[j - 1] ? target / lens[j - 1] : 0; out.push([pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * f, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * f]); break; }
    }
    return out;
  }
  function catmull(pts, steps) {
    if (pts.length < 3) return pts;
    var out = [], n = pts.length;
    for (var i = 0; i < n - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      for (var s = 0; s < steps; s++) {
        var t = s / steps, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    out.push(pts[n - 1]);
    return out;
  }
  function strokePath(g, pts, o, close) {
    if (!pts.length) return;
    g.save();
    if (o.alpha != null) g.globalAlpha *= o.alpha;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (close) g.closePath();
    if (o.fill) { g.fillStyle = col(o.fill); g.fill(); }
    if (o.stroke !== false && (o.stroke || o.color || !o.fill)) {
      var lw = o.lw || 2;
      g.strokeStyle = col(o.stroke || o.color, C().ink);
      g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = o.cap || 'round';
      g.setLineDash(dashOf(o.dash, lw));
      if (o.dashOffset) g.lineDashOffset = o.dashOffset;
      g.stroke();
    }
    g.restore();
  }
  function rrPath(g, x, y, w, hh, r) {
    g.beginPath();
    if (!r) { g.rect(x, y, w, hh); return; }
    r = Math.min(r, Math.abs(w) / 2, Math.abs(hh) / 2);
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + hh, r);
    g.arcTo(x + w, y + hh, x, y + hh, r);
    g.arcTo(x, y + hh, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  var D = (WM.draw = {
    clamp: function (v, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return v < a ? a : v > b ? b : v; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    ease: function (t) { t = D.clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    easeOut: function (t) { t = D.clamp(t); return 1 - Math.pow(1 - t, 3); },
    seg: function (p, a, b) { return b === a ? (p >= b ? 1 : 0) : D.clamp((p - a) / (b - a)); },
    col: col,
    text: function (g, str, x, y, o) {
      o = o || {};
      str = String(str == null ? '' : str);
      g.save();
      var size = o.size || 20, lh = (o.lineHeight || 1.3) * size;
      g.font = (o.style ? o.style + ' ' : '') + (o.weight || 400) + ' ' + size + 'px ' + fam(o.font);
      g.textAlign = o.align || 'left';
      g.textBaseline = o.baseline || 'alphabetic';
      g.fillStyle = col(o.color, C().ink);
      if (o.alpha != null) g.globalAlpha *= o.alpha;
      if (o.letterSpacing != null && 'letterSpacing' in g) g.letterSpacing = o.letterSpacing + 'px';
      var lines = [];
      str.split('\n').forEach(function (para) {
        if (!o.maxWidth) { lines.push(para); return; }
        var cur = '';
        para.split(' ').forEach(function (w) {
          var test = cur ? cur + ' ' + w : w;
          if (cur && g.measureText(test).width > o.maxWidth) { lines.push(cur); cur = w; } else cur = test;
        });
        lines.push(cur);
      });
      var y0 = y;
      if (lines.length > 1) {
        if (g.textBaseline === 'middle') y0 = y - (lines.length - 1) * lh / 2;
        else if (g.textBaseline === 'bottom' || g.textBaseline === 'ideographic') y0 = y - (lines.length - 1) * lh;
      }
      var wmax = 0;
      for (var i = 0; i < lines.length; i++) {
        if (o.halo) { g.save(); g.lineWidth = o.halo === true ? 5 : o.halo; g.strokeStyle = C().stage; g.lineJoin = 'round'; g.strokeText(lines[i], x, y0 + i * lh); g.restore(); }
        g.fillText(lines[i], x, y0 + i * lh);
        wmax = Math.max(wmax, g.measureText(lines[i]).width);
      }
      g.restore();
      return { lines: lines.length, width: wmax, height: lines.length * lh };
    },
    box: function (g, x, y, w, hh, o) {
      o = o || {};
      g.save();
      if (o.alpha != null) g.globalAlpha *= o.alpha;
      rrPath(g, x, y, w, hh, o.r || 0);
      if (o.fill) { g.fillStyle = col(o.fill); g.fill(); }
      if (o.stroke !== false && (o.stroke || !o.fill)) {
        var lw = o.lw || 2;
        g.strokeStyle = col(o.stroke, C().ink); g.lineWidth = lw;
        g.setLineDash(dashOf(o.dash, lw)); g.stroke();
      }
      g.restore();
    },
    line: function (g, x1, y1, x2, y2, o) {
      o = o || {};
      strokePath(g, [[x1, y1], [x2, y2]], { color: o.color || 'ink', lw: o.lw, dash: o.dash, alpha: o.alpha, cap: o.cap, dashOffset: o.dashOffset }, false);
    },
    arrow: function (g, x1, y1, x2, y2, o) {
      o = o || {};
      var lw = o.lw || 2, hs = o.head || Math.max(10, lw * 4.5);
      var ang = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
      var sx = x2 - Math.cos(ang) * Math.min(hs * 0.8, len), sy = y2 - Math.sin(ang) * Math.min(hs * 0.8, len);
      var c = col(o.color, C().ink);
      strokePath(g, [[x1, y1], [sx, sy]], { color: c, lw: lw, dash: o.dash, alpha: o.alpha, cap: 'butt' }, false);
      g.save();
      if (o.alpha != null) g.globalAlpha *= o.alpha;
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(x2, y2);
      g.lineTo(x2 - Math.cos(ang - 0.42) * hs, y2 - Math.sin(ang - 0.42) * hs);
      g.lineTo(x2 - Math.cos(ang + 0.42) * hs, y2 - Math.sin(ang + 0.42) * hs);
      g.closePath(); g.fill();
      g.restore();
    },
    dot: function (g, x, y, r, o) {
      o = o || {};
      g.save();
      if (o.alpha != null) g.globalAlpha *= o.alpha;
      g.beginPath(); g.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
      if (o.fill !== false) { g.fillStyle = col(o.fill, o.stroke ? C().stage : C().ink); g.fill(); }
      if (o.stroke) { var lw = o.lw || 2; g.strokeStyle = col(o.stroke); g.lineWidth = lw; g.setLineDash(dashOf(o.dash, lw)); g.stroke(); }
      g.restore();
    },
    poly: function (g, pts, o) {
      o = o || {};
      strokePath(g, partial(normPts(pts), o.progress), o, !!o.close);
    },
    curve: function (g, pts, o) {
      o = o || {};
      strokePath(g, partial(catmull(normPts(pts), o.steps || 14), o.progress), o, !!o.close);
    },
    grid: function (g, x, y, w, hh, cols, rows, o) {
      o = o || {};
      g.save();
      if (o.alpha != null) g.globalAlpha *= o.alpha;
      g.strokeStyle = col(o.color, C().faint); g.lineWidth = o.lw || 1; g.setLineDash(dashOf(o.dash, o.lw || 1));
      g.beginPath();
      for (var i = 0; i <= cols; i++) { var xx = x + w * i / cols; g.moveTo(xx, y); g.lineTo(xx, y + hh); }
      for (var j = 0; j <= rows; j++) { var yy = y + hh * j / rows; g.moveTo(x, yy); g.lineTo(x + w, yy); }
      g.stroke(); g.restore();
    },
    axes: function (g, x, y, w, hh, o) {
      o = o || {};
      var c = col(o.color, C().muted), lw = o.lw || 1.5;
      D.arrow(g, x, y + hh, x + w + 10, y + hh, { color: c, lw: lw, head: 9 });
      D.arrow(g, x, y + hh, x, y - 10, { color: c, lw: lw, head: 9 });
      var fs = o.size || 15;
      (o.xticks || []).forEach(function (t) {
        var xx = x + w * t[0];
        D.line(g, xx, y + hh, xx, y + hh + 6, { color: c, lw: 1 });
        D.text(g, t[1], xx, y + hh + 10, { size: fs - 2, align: 'center', baseline: 'top', color: c, font: 'mono' });
      });
      (o.yticks || []).forEach(function (t) {
        var yy = y + hh - hh * t[0];
        D.line(g, x - 6, yy, x, yy, { color: c, lw: 1 });
        D.text(g, t[1], x - 10, yy, { size: fs - 2, align: 'right', baseline: 'middle', color: c, font: 'mono' });
      });
      if (o.xlabel) D.text(g, o.xlabel, x + w, y + hh + (o.xticks ? 34 : 14), { size: fs, align: 'right', baseline: 'top', color: c });
      if (o.ylabel) {
        var ml = 0; (o.yticks || []).forEach(function (t) { ml = Math.max(ml, String(t[1]).length); });
        g.save(); g.translate(x - (o.yticks ? Math.max(46, 24 + ml * 0.62 * (fs - 2)) : 14), y); g.rotate(-Math.PI / 2);
        D.text(g, o.ylabel, 0, 0, { size: fs, align: 'right', baseline: 'bottom', color: c });
        g.restore();
      }
      return {
        x: function (u) { return x + u * w; },
        y: function (v) { return y + hh - v * hh; },
        x0: x, y0: y, w: w, h: hh
      };
    },
    withAlpha: function (g, a, fn) {
      g.save(); g.globalAlpha *= D.clamp(a); try { fn(); } finally { g.restore(); }
    }
  });

  function drawError(g, W, H, e, label) {
    var c = C();
    D.box(g, 20, H / 2 - 48, W - 40, 96, { fill: c.surface, stroke: c.error, lw: 2 });
    D.text(g, (label || 'This figure') + ' could not be drawn', W / 2, H / 2 - 12, { align: 'center', size: 22, weight: 700, color: c.error });
    D.text(g, String((e && e.message) || e).slice(0, 120), W / 2, H / 2 + 20, { align: 'center', size: 15, font: 'mono', color: c.muted, maxWidth: W - 80 });
  }

  /* ---------------------------------------------------------- canvas stage */
  function makeStage(cv, W, H, onSize) {
    var dpr = 1;
    function size() {
      var cw = cv.clientWidth;
      if (!cw) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var bw = Math.round(cw * dpr), bh = Math.round(cw * H / W * dpr);
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      return true;
    }
    var off = watchSize(cv.parentNode, function () { if (size()) onSize(); });
    return { size: size, dispose: off };
  }

  WM.canvas = function (o) {
    o = o || {};
    var W = o.w || 960, H = o.h || 540;
    var cv = h('canvas', { role: o.label ? 'img' : null, 'aria-label': o.label || null });
    if (!o.label) cv.setAttribute('aria-hidden', 'true');
    var el = h('div', { class: 'wm-canvas' + (o.pointer ? ' wm-canvas--pointer' : ''), style: { aspectRatio: W + ' / ' + H } }, cv);
    if (o.touchAction) cv.style.touchAction = o.touchAction;
    var g = cv.getContext('2d');
    var visible = false, wantRun = !!o.animate, warned = false, raf = 0;
    var env = { t: 0, dt: 0, frame: 0, w: W, h: H, c: WM.colors(), d: D, rng: WM.rng, pointer: { x: 0, y: 0, down: false, inside: false } };
    var stage = makeStage(cv, W, H, function () { redraw(); });
    function redraw() {
      if (!cv.width && !stage.size()) return;
      g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
      env.c = WM.colors();
      g.save(); g.fillStyle = env.c.stage; g.fillRect(0, 0, W, H); g.restore();
      try { if (o.draw) { g.save(); o.draw(g, env); g.restore(); } }
      catch (e) { if (!warned) { console.warn('[WM.canvas] draw failed:', e); warned = true; } drawError(g, W, H, e); }
    }
    function schedule() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; redraw(); }); }
    var lp = WM.loop(function (dt) { env.dt = dt; env.t += dt; env.frame++; redraw(); });
    var offVis = watchVis(el, function (ratio) {
      visible = ratio > 0;
      if (visible && wantRun) lp.start(); else lp.stop();
      if (visible && !wantRun) schedule();
    });
    var offTheme = WM.onTheme(schedule);
    if (o.pointer) {
      var down = false;
      var pos = function (ev) { var r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * H]; };
      var fire = function (type, ev) {
        var p = pos(ev); env.pointer.x = p[0]; env.pointer.y = p[1]; env.pointer.down = down;
        try { o.pointer(type, p[0], p[1], ev); } catch (e) { console.warn('[WM.canvas] pointer handler failed:', e); }
        if (!lp.running) schedule();
      };
      cv.addEventListener('pointerdown', function (ev) { down = true; env.pointer.inside = true; try { cv.setPointerCapture(ev.pointerId); } catch (e) {} fire('down', ev); });
      cv.addEventListener('pointermove', function (ev) { env.pointer.inside = true; fire(down ? 'move' : 'hover', ev); });
      var up = function (ev) { if (!down) return; down = false; fire('up', ev); };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', function (ev) { env.pointer.inside = false; if (!down) fire('leave', ev); });
    }
    var api = {
      el: el, g: g, env: env,
      redraw: redraw,
      start: function () { wantRun = true; if (visible) lp.start(); },
      stop: function () { wantRun = false; lp.stop(); },
      get running() { return lp.running; }
    };
    onDispose(function () { lp.stop(); offVis(); offTheme(); stage.dispose(); });
    requestAnimationFrame(function () { stage.size(); redraw(); });
    return api;
  };

  /* -------------------------------------------------------------- explainer */
  function fmtTime(s) {
    s = Math.max(0, s);
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  var SPEEDS = [0.5, 1, 1.5, 2];

  /* narration manifest: narration/manifest.json, fetched once at boot.
     Missing or unreadable manifest = no narration (silent explainers). */
  var narr = { settled: false, data: null, waiters: [] };
  function narrSettle(data) {
    if (narr.settled) return;
    narr.settled = true;
    narr.data = data && typeof data === 'object' && data.explainers && typeof data.explainers === 'object' ? data : null;
    var w = narr.waiters; narr.waiters = [];
    w.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
  }
  function loadNarration() {
    if (narr.started) return;
    narr.started = true;
    if (!window.fetch || location.protocol === 'file:') { narrSettle(null); return; }
    var timer = setTimeout(function () { narrSettle(null); }, 4000);
    var fin = function (j) { clearTimeout(timer); narrSettle(j); };
    try {
      fetch('narration/manifest.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(fin, function () { fin(null); });
    } catch (e) { fin(null); }
  }
  WM.narrationReady = function (fn) { if (narr.settled) fn(); else narr.waiters.push(fn); };
  function narrEntry(key, origDur) {
    var e = narr.data && narr.data.explainers[key];
    if (!e || typeof e.audio !== 'string' || !e.audio || !(Number(e.duration) > 0)) return null;
    var nd = Number(e.duration), map = [], last = [0, 0];
    (Array.isArray(e.map) ? e.map : []).forEach(function (p) {
      if (!Array.isArray(p) || p.length < 2) return;
      var a = Number(p[0]), b = Number(p[1]);
      if (!isFinite(a) || !isFinite(b) || a < last[0] || b < last[1]) return;
      if (!map.length && (a > 0 || b > 0)) map.push([0, 0]);
      map.push([a, b]); last = [a, b];
    });
    if (!map.length) map.push([0, 0]);
    if (last[0] < origDur) map.push([origDur, Math.max(nd, last[1])]);
    if (map.length < 2) return null;
    return { audio: e.audio, duration: Math.max(nd, map[map.length - 1][1]), map: map };
  }
  /* piecewise-linear lookup in map columns a -> b; on a flat stretch, the first point wins */
  function pwl(map, v, a, b) {
    var n = map.length;
    if (v <= map[0][a]) return map[0][b];
    for (var i = 0; i < n - 1; i++) {
      var p = map[i], q = map[i + 1];
      if (v <= q[a]) { var span = q[a] - p[a]; return span > 1e-9 ? p[b] + (q[b] - p[b]) * (v - p[a]) / span : p[b]; }
    }
    return map[n - 1][b];
  }
  /* live explainers on the page; a narrated one never plays alongside another */
  var players = [];
  function vicon(muted) {
    return h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
      h('path', { d: 'M3.5 9h4l5-4.3v14.6l-5-4.3h-4z', fill: 'currentColor' }),
      muted
        ? h('path', { d: 'M16 9.2l5 5.6M21 9.2l-5 5.6', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round' })
        : h('path', { d: 'M15.6 9a4.2 4.2 0 0 1 0 6M18 6.6a7.6 7.6 0 0 1 0 10.8', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round' }));
  }

  WM.explainer = function (o) {
    o = o || {};
    var W = o.w || 960, H = o.h || 540;
    var scenes = (o.scenes || []).map(function (s, i) { return Object.assign({ i: i }, s); });
    var dur = o.duration || scenes.reduce(function (m, s) { return Math.max(m, s.end || 0); }, 0) || 1;
    var ordered = scenes.slice().sort(function (a, b) { return a.start - b.start; });
    var first = ordered[0];
    var poster = o.poster != null ? D.clamp(o.poster, 0, dur) : (first ? first.start + (first.end - first.start) * 0.85 : 0);
    var reduced = WM.reducedMotion();
    var autoplay = o.autoplay !== false && !reduced;
    var modId = WM._currentModule || '';
    var N = o.id && modId ? narrEntry(modId + '.' + o.id, dur) : null;
    var ndur = N ? N.duration : dur;
    /* st.t is the authored (original) timeline the scenes draw from; st.nt is player time */
    var st = { t: poster, nt: poster, playing: false, started: false, speed: 1, autoPaused: false, autoplayed: false, ratio: 0 };
    var warned = {};
    function toNew(t) { return N ? pwl(N.map, t, 0, 1) : t; }
    function setFromNew(nt) { st.nt = D.clamp(nt, 0, ndur); st.t = N ? D.clamp(pwl(N.map, st.nt, 1, 0), 0, dur) : st.nt; }
    function setFromOrig(t) { st.t = D.clamp(t, 0, dur); st.nt = N ? D.clamp(toNew(st.t), 0, ndur) : st.t; }
    setFromOrig(poster);

    var cv = h('canvas', { 'aria-hidden': 'true' });
    var bigLabel = h('span', null, N ? 'Play with narration' : 'Play');
    var bigPlay = h('button', { class: 'wm-bigplay', type: 'button', 'aria-label': N ? 'Play explainer with narration' : 'Play explainer' }, icon('play'), bigLabel);
    var stageEl = h('div', { class: 'wm-explainer__stage', style: { aspectRatio: W + ' / ' + H } }, cv, bigPlay);
    var playBtn = h('button', { class: 'wm-ibtn', type: 'button', 'aria-label': 'Play' }, icon('play'));
    var replayBtn = h('button', { class: 'wm-ibtn wm-replay', type: 'button', 'aria-label': 'Replay from start' }, icon('replay'));
    var fill = h('div', { class: 'wm-scrub__fill' });
    var thumb = h('div', { class: 'wm-scrub__thumb' });
    var track = h('div', { class: 'wm-scrub__track' }, fill);
    var ticks = ordered.filter(function (s) { return s.start > 0.01 && s.start < dur - 0.01; }).map(function (s) {
      var tk = h('i', { class: 'wm-scrub__tick' });
      tk._o = s.start; track.appendChild(tk); return tk;
    });
    function placeTicks() {
      ticks.forEach(function (tk) { tk._t = toNew(tk._o); tk.style.left = (tk._t / ndur * 100) + '%'; });
    }
    placeTicks();
    var range = h('input', { type: 'range', min: 0, max: Math.round(ndur * 1000), step: 10, value: Math.round(st.nt * 1000), 'aria-label': 'Seek', 'aria-valuetext': fmtTime(st.nt) });
    var scrub = h('div', { class: 'wm-scrub' }, track, thumb, range);
    var timeEl = h('span', { class: 'wm-time', 'aria-hidden': 'true' });
    var speedBtn = h('button', { class: 'wm-speed', type: 'button', 'aria-label': 'Playback speed 1x' }, '1×');
    var muted = !!WM.store.get('narration-muted', false);
    var muteBtn = N ? h('button', { class: 'wm-ibtn wm-mute', type: 'button' }) : null;
    var chapEl = h('span', { class: 'wm-explainer__chap' });
    var capText = h('p', { class: 'wm-explainer__text', 'aria-live': 'polite' });
    var titleId = 'wmx-' + (o.id || Math.random().toString(36).slice(2));
    var durEl = h('span', { class: 'wm-explainer__dur' }, fmtTime(ndur));
    var kicker = h('span', { class: 'wm-kicker' }, N ? 'Narrated explainer' : 'Explainer');
    var hint = h('span', { class: 'wm-sr', id: titleId + '-k' }, 'Space plays or pauses; left and right arrow keys skip 5 seconds.' + (N ? ' M mutes or unmutes the narration.' : ''));
    var transcript = N ? buildTranscript() : null;
    var fig = h('figure', {
      class: 'wm-explainer wm-wide' + (N ? ' is-narrated' : ''), id: o.id || null, tabindex: '0', role: 'group',
      'aria-labelledby': titleId,
      'aria-roledescription': 'animated explainer',
      'aria-describedby': titleId + '-k'
    },
      h('div', { class: 'wm-explainer__head' },
        kicker,
        h('h3', { class: 'wm-explainer__title', id: titleId }, o.title || 'Explainer'),
        durEl
      ),
      stageEl,
      h('div', { class: 'wm-explainer__bar' }, playBtn, replayBtn, scrub, timeEl, muteBtn, speedBtn),
      h('figcaption', { class: 'wm-explainer__cap' }, chapEl, capText),
      transcript,
      hint
    );
    var g = cv.getContext('2d');
    var lastCap = -1;

    function buildTranscript() {
      return h('details', { class: 'wm-transcript' },
        h('summary', null, h('span', null, 'Transcript'), h('span', { class: 'wm-transcript__n' }, ordered.length + ' scenes')),
        h('ol', { class: 'wm-transcript__list' }, ordered.map(function (s, k) {
          var at = toNew(s.start);
          var go = h('button', { class: 'wm-transcript__go', type: 'button', 'aria-label': 'Go to scene ' + (k + 1) + ', at ' + fmtTime(at) }, fmtTime(at));
          go.addEventListener('click', function (e) { e.stopPropagation(); seek(toNew(s.start) + 0.01); });
          return h('li', null, go, h('div', { class: 'wm-transcript__text', html: s.caption || '' }));
        })));
    }

    function capScene(t) {
      var best = null;
      for (var i = 0; i < ordered.length; i++) {
        var s = ordered[i];
        if (s.start <= t + 1e-6 && (t < s.end || (t >= dur - 1e-6 && s.end >= dur - 1e-6))) best = s;
      }
      if (!best) { for (var j = ordered.length - 1; j >= 0; j--) if (ordered[j].start <= t) { best = ordered[j]; break; } }
      return best || first;
    }
    function render() {
      if (!cv.width && !stage.size()) return;
      var c = WM.colors();
      g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
      g.save(); g.fillStyle = c.stage; g.fillRect(0, 0, W, H); g.restore();
      var env = { t: st.t, w: W, h: H, c: c, d: D, rng: WM.rng, duration: dur };
      for (var i = 0; i < scenes.length; i++) {
        var s = scenes[i];
        var on = st.t >= s.start && (st.t < s.end || (st.t >= dur - 1e-6 && s.end >= dur - 1e-6) || (s.end === s.start && st.t === s.start));
        if (!on || !s.draw) continue;
        var p = s.end > s.start ? D.clamp((st.t - s.start) / (s.end - s.start)) : 1;
        g.save();
        try { s.draw(g, p, env); }
        catch (e) { if (!warned[i]) { console.warn('[WM.explainer] scene ' + i + ' failed:', e); warned[i] = 1; } g.restore(); g.save(); drawError(g, W, H, e, 'Scene ' + (i + 1)); }
        g.restore();
      }
    }
    function ui() {
      var f = st.nt / ndur;
      fill.style.width = (f * 100) + '%';
      thumb.style.left = (f * 100) + '%';
      ticks.forEach(function (tk) { tk.classList.toggle('is-past', tk._t <= st.nt + 1e-6); });
      if (document.activeElement !== range) range.value = String(Math.round(st.nt * 1000));
      range.setAttribute('aria-valuetext', fmtTime(st.nt) + ' of ' + fmtTime(ndur));
      timeEl.textContent = fmtTime(st.nt) + ' / ' + fmtTime(ndur);
      playBtn.replaceChildren(icon(st.playing ? 'pause' : 'play'));
      playBtn.setAttribute('aria-label', st.playing ? 'Pause' : 'Play');
      var ended = st.nt >= ndur - 1e-3;
      bigPlay.hidden = st.playing || (st.started && !ended);
      var lbl = ended && st.started ? 'Replay' : (N ? 'Play with narration' : 'Play');
      if (bigLabel.textContent !== lbl) bigLabel.textContent = lbl;
      bigPlay.setAttribute('aria-label', (ended && st.started ? 'Replay' : 'Play') + ' explainer' + (N && !(ended && st.started) ? ' with narration' : ''));
      fig.classList.toggle('is-playing', st.playing);
      var s = capScene(st.t);
      if (s && s.i !== lastCap) {
        lastCap = s.i;
        capText.innerHTML = s.caption || '';
        prepDfn(capText);
        chapEl.textContent = 'Scene ' + (ordered.indexOf(s) + 1) + ' / ' + ordered.length;
      }
    }

    /* ---- narration audio: the master clock while narration is available ---- */
    var audio = null, tail = false, lastCt = -1, buffering = false, disposed = false, pend = null;
    function audioDur() { return audio && isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Infinity; }
    function setBuffering(b) { buffering = b; fig.classList.toggle('is-buffering', b); }
    function syncMute() {
      if (!muteBtn) return;
      if (audio) audio.muted = muted;
      muteBtn.replaceChildren(vicon(muted));
      muteBtn.setAttribute('aria-label', muted ? 'Unmute narration' : 'Mute narration');
      muteBtn.setAttribute('aria-pressed', String(muted));
      muteBtn.title = muted ? 'Narration muted' : 'Narration on';
    }
    function onMuteEvt(e) { muted = !!(e.detail && e.detail.muted); syncMute(); }
    function setupAudio() {
      audio = new Audio();
      audio.preload = 'metadata';
      audio.volume = 0.8;
      audio.muted = muted;
      try { audio.preservesPitch = true; audio.mozPreservesPitch = true; audio.webkitPreservesPitch = true; } catch (e) { /* older engines */ }
      audio.addEventListener('error', function () { if (!disposed && N) fallback(); });
      audio.addEventListener('waiting', function () { if (st.playing) setBuffering(true); });
      ['playing', 'canplay', 'seeked'].forEach(function (ev) { audio.addEventListener(ev, function () { setBuffering(false); }); });
      audio.addEventListener('pause', function () {
        if (!N || !st.playing || tail) return;
        if (audio.ended) { tail = true; return; }
        pause(false); /* paused from outside (media keys, OS) */
      });
      audio.addEventListener('ended', function () { tail = true; setBuffering(false); });
      audio.src = N.audio;
      window.addEventListener('wm:narration-mute', onMuteEvt);
      syncMute();
    }
    function dropAudio() {
      if (!audio) return;
      var a = audio; audio = null;
      try { a.pause(); a.removeAttribute('src'); a.load(); } catch (e) { /* ignore */ }
      window.removeEventListener('wm:narration-mute', onMuteEvt);
    }
    function startAudio() {
      if (!audio) return;
      tail = st.nt >= audioDur() - 0.05;
      if (tail) { audio.pause(); return; }
      try { if (Math.abs(audio.currentTime - st.nt) > 0.05) { audio.currentTime = st.nt; pend = st.nt; } } catch (e) { /* not seekable yet */ }
      lastCt = -1;
      audio.playbackRate = st.speed;
      var pr;
      try { pr = audio.play(); } catch (e) { fallback(); return; }
      if (pr && pr.catch) pr.catch(function (err) {
        if (!N || disposed) return;
        var n = err && err.name;
        if (n === 'NotAllowedError') pause(false);
        else if (n !== 'AbortError') fallback();
      });
    }
    function fallback() {
      if (!N) return;
      var t = st.t;
      N = null; dropAudio(); setBuffering(false); tail = false; pend = null;
      ndur = dur;
      setFromOrig(t);
      placeTicks();
      range.max = String(Math.round(ndur * 1000));
      durEl.textContent = fmtTime(ndur);
      kicker.textContent = 'Explainer';
      hint.textContent = 'Space plays or pauses; left and right arrow keys skip 5 seconds.';
      fig.classList.remove('is-narrated');
      if (muteBtn) { muteBtn.remove(); muteBtn = null; }
      if (transcript) { transcript.remove(); transcript = null; }
      lastCap = -1;
      render(); ui();
      if (!st.playing && autoplay && !st.autoplayed && !st.started && st.ratio >= 0.5 && !narratedPlaying()) { st.autoplayed = true; play(); }
    }

    var lp = WM.loop(function (dt) {
      if (N && audio && !tail && pend != null && !audio.seeking && audio.readyState >= 1) {
        /* a host without HTTP Range support cannot seek: drop to the silent timeline */
        if (Math.abs(audio.currentTime - pend) > 1.5) fallback();
        pend = null;
      }
      if (N && audio && !tail && audio.seeking) { /* hold the frame until the seek lands */ }
      else if (N && audio && !tail) {
        var ct = audio.currentTime;
        if (ct !== lastCt) { lastCt = ct; setFromNew(ct); }
        else if (!buffering && !audio.paused) setFromNew(Math.min(st.nt + dt * st.speed, ct + 0.25));
        if (audio.ended) tail = true;
      } else setFromNew(st.nt + dt * st.speed);
      if (st.nt >= ndur - 1e-6) { setFromNew(ndur); st.playing = false; lp.stop(); if (audio) audio.pause(); setBuffering(false); }
      render(); ui();
    });

    var self = { pause: function () { pause(false); } };
    Object.defineProperty(self, 'playing', { get: function () { return st.playing; } });
    Object.defineProperty(self, 'narrated', { get: function () { return !!N; } });
    players.push(self);
    function narratedPlaying() { return players.some(function (p) { return p !== self && p.playing && p.narrated; }); }
    function claim() {
      players.forEach(function (p) { if (p !== self && p.playing && (N || p.narrated)) p.pause(); });
    }

    function play() {
      if (!st.started) { st.started = true; setFromNew(0); }
      if (st.nt >= ndur - 1e-3) setFromNew(0);
      claim();
      st.playing = true; st.autoPaused = false;
      if (N) startAudio();
      lp.start(); render(); ui();
    }
    function pause(auto) {
      if (!st.playing) return;
      st.playing = false; st.autoPaused = !!auto;
      if (audio) audio.pause();
      setBuffering(false);
      lp.stop(); ui();
    }
    function toggle() { if (st.playing) pause(false); else play(); }
    function seek(nt) {
      setFromNew(nt); st.started = true;
      if (N && audio) {
        if (st.playing) startAudio();
        else { tail = false; try { if (st.nt < audioDur()) audio.currentTime = st.nt; } catch (e) { /* not seekable yet */ } }
      }
      render(); ui();
    }
    function setSpeed(s) {
      st.speed = s;
      speedBtn.textContent = s + '×';
      speedBtn.setAttribute('aria-label', 'Playback speed ' + s + 'x');
      if (audio) audio.playbackRate = s;
    }
    function toggleMute() {
      muted = !muted;
      WM.store.set('narration-muted', muted);
      try { window.dispatchEvent(new CustomEvent('wm:narration-mute', { detail: { muted: muted } })); } catch (e) { syncMute(); }
      syncMute();
    }
    var stage = makeStage(cv, W, H, render);

    bigPlay.addEventListener('click', function (e) { e.stopPropagation(); play(); });
    stageEl.addEventListener('click', toggle);
    playBtn.addEventListener('click', toggle);
    replayBtn.addEventListener('click', function () { setFromNew(0); st.started = true; play(); });
    range.addEventListener('input', function () { seek(Number(range.value) / 1000); });
    speedBtn.addEventListener('click', function () {
      var i = SPEEDS.indexOf(st.speed);
      setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
    });
    if (muteBtn) muteBtn.addEventListener('click', toggleMute);
    fig.addEventListener('keydown', function (e) {
      var tag = e.target.tagName;
      if ((e.key === ' ' || e.key === 'k' || e.key === 'K') && tag !== 'BUTTON' && tag !== 'SUMMARY') { e.preventDefault(); toggle(); }
      else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target !== range) { e.preventDefault(); seek(st.nt + (e.key === 'ArrowRight' ? 5 : -5)); }
      else if (e.key === 'Home' && e.target !== range) { e.preventDefault(); seek(0); }
      else if ((e.key === 'm' || e.key === 'M') && muteBtn && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); toggleMute(); }
    });
    var offVis = watchVis(fig, function (ratio) {
      st.ratio = ratio;
      if (ratio < 0.15) { if (st.playing) pause(true); return; }
      if (ratio >= 0.5) {
        if (st.autoPaused) { if (N || !narratedPlaying()) play(); }
        else if (!N && autoplay && !st.autoplayed && !st.started && !narratedPlaying()) { st.autoplayed = true; play(); }
      }
    });
    var onHidden = function () { if (doc.hidden && st.playing) pause(true); };
    doc.addEventListener('visibilitychange', onHidden);
    var offTheme = WM.onTheme(function () { render(); });
    onDispose(function () {
      disposed = true; st.playing = false;
      lp.stop(); dropAudio(); offVis(); offTheme(); stage.dispose();
      doc.removeEventListener('visibilitychange', onHidden);
      var k = players.indexOf(self); if (k >= 0) players.splice(k, 1);
    });
    if (N) setupAudio();
    requestAnimationFrame(function () { stage.size(); render(); ui(); });
    ui();

    fig.wm = {
      play: play, pause: function () { pause(false); }, seek: seek, toggle: toggle,
      get t() { return st.nt; }, get playing() { return st.playing; }, get duration() { return ndur; },
      get sceneTime() { return st.t; }, get narrated() { return !!N; }, get audio() { return audio; },
      setSpeed: setSpeed
    };
    return fig;
  };

  /* --------------------------------------------------------- content blocks */
  WM.hero = function (o) {
    o = o || {};
    var goals = o.goals || [];
    return h('header', { class: 'wm-hero' },
      h('div', { class: 'wm-hero__meta' },
        o.kicker ? h('span', { class: 'wm-kicker' }, o.kicker) : null,
        o.minutes ? h('span', { class: 'wm-mono' }, 'about ' + o.minutes + ' min') : null
      ),
      h('h1', { class: 'wm-hero__title' }, o.title || ''),
      o.lede ? rich('p', 'wm-lede', o.lede) : null,
      goals.length ? h('div', { class: 'wm-goals' },
        h('h2', { class: 'wm-goals__label' }, 'By the end you can'),
        h('ol', null, goals.map(function (g, i) { var li = h('li', null, rich('span', null, g)); li.setAttribute('data-n', String(i + 1).padStart(2, '0')); return li; }))
      ) : null
    );
  };
  WM.section = function (o) {
    o = o || {};
    var kids = Array.prototype.slice.call(arguments, 1);
    var sec = h('section', { class: 'wm-section', id: o.id || null, 'data-toc': o.toc || o.title || null, 'aria-labelledby': o.id ? o.id + '-h' : null },
      h('header', { class: 'wm-section__head' },
        o.kicker ? h('span', { class: 'wm-kicker' }, o.kicker) : null,
        o.title ? h('h2', { class: 'wm-section__title', id: o.id ? o.id + '-h' : null }, o.title) : null
      )
    );
    appendKids(sec, kids);
    return sec;
  };
  WM.p = function (html) { return rich('p', 'wm-p', html); };
  var CALLOUT_LABEL = { idea: 'Key idea', pregnancy: 'In pregnancy', warn: 'Caution', math: 'The maths', try: 'Try this', source: 'Source' };
  WM.callout = function (kind, title, html) {
    if (!CALLOUT_LABEL[kind]) kind = 'idea';
    return h('aside', { class: 'wm-callout wm-callout--' + kind, role: 'note', 'aria-label': CALLOUT_LABEL[kind] + (title ? ': ' + title : '') },
      h('div', { class: 'wm-callout__tag' }, CALLOUT_LABEL[kind]),
      title ? h('h3', { class: 'wm-callout__title' }, title) : null,
      rich('div', 'wm-callout__body', /^\s*</.test(String(html || '')) ? html : '<p>' + (html || '') + '</p>')
    );
  };
  WM.takeaways = function (items) {
    return h('section', { class: 'wm-takeaways', 'aria-label': 'Takeaways' },
      h('h2', null, 'Takeaways'),
      h('ol', null, (items || []).map(function (t, i) { var li = rich('li', null, h('div', { html: t })); li.setAttribute('data-n', String(i + 1).padStart(2, '0')); return li; }))
    );
  };
  WM.goDeeper = function (links) {
    return h('section', { class: 'wm-deeper', 'aria-label': 'Go deeper' },
      h('h2', null, 'Go deeper'),
      h('ul', null, (links || []).map(function (l) {
        var host = '';
        try { host = new URL(l.url, location.href).hostname.replace(/^www\./, ''); } catch (e) { host = ''; }
        return h('li', null,
          h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, l.title),
          host ? h('span', { class: 'wm-deeper__host' }, host) : null,
          l.note ? rich('span', 'wm-deeper__note', l.note) : null
        );
      }))
    );
  };

  /* --------------------------------------------------------------- controls */
  var uid = 0;
  function nextId(p) { uid += 1; return (p || 'wm') + '-' + uid; }

  WM.slider = function (o) {
    o = o || {};
    var min = o.min != null ? o.min : 0, max = o.max != null ? o.max : 1, step = o.step != null ? o.step : (max - min) / 100;
    var id = nextId('sl');
    var fmt = typeof o.fmt === 'function' ? o.fmt : function (v) { return WM.ui.fmt(v, typeof o.fmt === 'number' ? o.fmt : (step >= 1 ? 0 : step >= 0.1 ? 1 : 2)); };
    var input = h('input', { class: 'wm-range', type: 'range', id: id, min: min, max: max, step: step, value: o.value != null ? o.value : min });
    var out = h('output', { class: 'wm-ctl__val', for: id });
    function show() {
      var v = Number(input.value);
      out.textContent = fmt(v) + (o.unit ? ' ' + o.unit : '');
      input.setAttribute('aria-valuetext', out.textContent);
      input.style.setProperty('--fill', ((v - min) / (max - min || 1) * 100) + '%');
    }
    input.addEventListener('input', function () { show(); if (o.onInput) o.onInput(Number(input.value)); });
    show();
    var el = h('div', { class: 'wm-ctl wm-slider' },
      h('div', { class: 'wm-ctl__top' }, h('label', { class: 'wm-ctl__label', for: id }, o.label || ''), out),
      input);
    return {
      el: el, input: input,
      get: function () { return Number(input.value); },
      set: function (v, fire) { input.value = String(v); show(); if (fire && o.onInput) o.onInput(Number(input.value)); }
    };
  };
  WM.toggle = function (o) {
    o = o || {};
    var on = !!o.value;
    var btn = h('button', { class: 'wm-switch', type: 'button', role: 'switch', 'aria-checked': String(on) },
      h('span', { class: 'wm-switch__track', 'aria-hidden': 'true' }), h('span', null, o.label || ''));
    btn.addEventListener('click', function () { on = !on; btn.setAttribute('aria-checked', String(on)); if (o.onChange) o.onChange(on); });
    return {
      el: h('div', { class: 'wm-ctl wm-toggle' }, btn), button: btn,
      get: function () { return on; },
      set: function (v, fire) { on = !!v; btn.setAttribute('aria-checked', String(on)); if (fire && o.onChange) o.onChange(on); }
    };
  };
  WM.select = function (o) {
    o = o || {};
    var id = nextId('se');
    var sel = h('select', { class: 'wm-select', id: id },
      (o.options || []).map(function (op) {
        var v = typeof op === 'object' ? op.value : op, l = typeof op === 'object' ? (op.label != null ? op.label : op.value) : op;
        return h('option', { value: v }, l);
      }));
    if (o.value != null) sel.value = String(o.value);
    var orig = {};
    (o.options || []).forEach(function (op) { var v = typeof op === 'object' ? op.value : op; orig[String(v)] = v; });
    var get = function () { return Object.prototype.hasOwnProperty.call(orig, sel.value) ? orig[sel.value] : sel.value; };
    sel.addEventListener('change', function () { if (o.onChange) o.onChange(get()); });
    return {
      el: h('div', { class: 'wm-ctl wm-selectctl' },
        o.label ? h('label', { class: 'wm-ctl__label', for: id }, o.label) : null,
        h('div', { class: 'wm-selectwrap' }, sel)),
      select: sel, get: get,
      set: function (v, fire) { sel.value = String(v); if (fire && o.onChange) o.onChange(get()); }
    };
  };
  WM.buttons = function (list) {
    var btns = (list || []).map(function (b) {
      var el = h('button', { class: 'wm-btn wm-btn--' + (b.kind || 'secondary'), type: 'button', 'aria-label': b.aria || null }, b.label);
      if (b.onClick) el.addEventListener('click', function (e) { b.onClick(e, el); });
      return el;
    });
    return { el: h('div', { class: 'wm-btns' }, btns), buttons: btns };
  };
  WM.readout = function (label, initial) {
    var val = h('span', { class: 'wm-readout__val', 'aria-live': 'off' }, initial == null ? '—' : String(initial));
    var cur = initial;
    return {
      el: h('div', { class: 'wm-readout' }, h('span', { class: 'wm-readout__label' }, label || ''), val),
      set: function (v) { cur = v; val.textContent = typeof v === 'number' ? WM.ui.fmt(v) : String(v); },
      get: function () { return cur; }
    };
  };
  WM.controls = function () { return appendKids(h('div', { class: 'wm-controls' }), Array.prototype.slice.call(arguments)); };
  WM.row = function () { return appendKids(h('div', { class: 'wm-row' }), Array.prototype.slice.call(arguments)); };
  WM.readouts = function () { return appendKids(h('div', { class: 'wm-readouts' }), Array.prototype.slice.call(arguments)); };
  WM.panel = function (o) {
    o = o || {};
    var kids = Array.prototype.slice.call(arguments, 1);
    var tid = nextId('pn');
    return h('div', { class: 'wm-panel wm-wide', role: 'group', 'aria-labelledby': tid, id: o.id || null },
      h('div', { class: 'wm-panel__head' },
        h('span', { class: 'wm-kicker' }, o.kicker || 'Interactive'),
        h('h3', { class: 'wm-panel__title', id: tid }, o.title || 'Try it')),
      o.note ? h('p', { class: 'wm-panel__note' }, h('b', null, 'Try'), rich('span', null, o.note)) : null,
      appendKids(h('div', { class: 'wm-panel__body' }), kids)
    );
  };

  /* ------------------------------------------------------------------- quiz */
  WM.quiz = function (o) {
    o = o || {};
    var mod = WM._currentModule || 'x';
    var key = 'quiz:' + mod + ':' + (o.id || 'quiz');
    var qs = o.questions || [];
    var answered = 0, correct = 0;
    var prev = WM.store.get(key, null);
    var countEl = h('span', { class: 'wm-quiz__count' });
    var scoreEl = h('span', { class: 'wm-quiz__score' });
    var sumText = h('p');
    var list = h('ol', { class: 'wm-quiz__list' });
    var sum = h('div', { class: 'wm-quiz__sum', hidden: true, 'aria-live': 'polite' }, scoreEl, sumText,
      h('button', { class: 'wm-btn wm-btn--ghost', type: 'button', onclick: function () { reset(); } }, 'Try again'));
    var root = h('section', { class: 'wm-quiz', id: o.id || null, 'aria-label': o.title || 'Check yourself' },
      h('div', { class: 'wm-quiz__head' },
        h('span', { class: 'wm-kicker', style: 'flex-basis:100%' }, 'Check yourself'),
        h('h2', { class: 'wm-quiz__title' }, o.title || 'Quick check'),
        countEl),
      prev && prev.done ? h('p', { class: 'wm-quiz__prev' }, 'You completed this before, scoring ' + prev.score + ' of ' + prev.total + '. Answer again any time.') : null,
      list, sum);
    function count() { countEl.textContent = answered + ' / ' + qs.length + ' answered'; }
    function build() {
      list.textContent = '';
      qs.forEach(function (q, qi) {
        var fb = h('div', { class: 'wm-q__fb', 'aria-live': 'polite' });
        var opts = h('div', { class: 'wm-q__opts', role: 'group', 'aria-label': 'Options for question ' + (qi + 1) });
        var btns = (q.options || []).map(function (opt, oi) {
          var b = h('button', { class: 'wm-opt', type: 'button' },
            h('span', { class: 'wm-opt__k' }, String.fromCharCode(65 + oi)),
            rich('span', 'wm-opt__t', opt),
            h('span', { class: 'wm-opt__mark' }));
          b.addEventListener('click', function () { choose(oi); });
          opts.appendChild(b);
          return b;
        });
        function choose(oi) {
          var ok = oi === q.answer;
          btns.forEach(function (b, i) {
            b.disabled = true;
            if (i === q.answer) { b.classList.add('is-correct'); b.lastChild.textContent = 'Answer'; }
            else if (i === oi) { b.classList.add('is-wrong'); b.lastChild.textContent = 'Your pick'; }
            else b.classList.add('is-dim');
          });
          btns[oi].setAttribute('aria-pressed', 'true');
          fb.className = 'wm-q__fb ' + (ok ? 'is-good' : 'is-bad');
          fb.innerHTML = '<b>' + (ok ? 'Correct' : 'Not quite') + '</b>' +
            (ok ? '' : 'The answer is ' + String.fromCharCode(65 + q.answer) + '. ') + (q.why || '');
          prepDfn(fb);
          answered++; if (ok) correct++;
          count();
          if (answered === qs.length) finish();
        }
        list.appendChild(h('li', { class: 'wm-q' },
          h('span', { class: 'wm-q__n' }, 'Q' + (qi + 1)),
          h('div', null, rich('p', 'wm-q__text', q.q), opts, fb)));
      });
    }
    function finish() {
      scoreEl.textContent = correct + ' / ' + qs.length;
      var r = qs.length ? correct / qs.length : 0;
      sumText.textContent = r === 1 ? 'All correct. You are ready for the next module.'
        : r >= 0.6 ? 'Good. Re-read the explanations for the ones you missed.'
          : 'Worth another pass: revisit the explainers above, then try again.';
      sum.hidden = false;
      var best = WM.store.get(key, null);
      var rec = { done: true, score: correct, total: qs.length, best: Math.max(correct, best && best.best || 0), at: Date.now() };
      WM.store.set(key, rec);
      WM.store.set('done:' + mod, true);
      try { window.dispatchEvent(new CustomEvent('wm:progress', { detail: { module: mod } })); } catch (e) {}
    }
    function reset() { answered = 0; correct = 0; sum.hidden = true; build(); count(); var f = list.querySelector('.wm-opt'); if (f) f.focus(); }
    build(); count();
    return root;
  };

  /* ---------------------------------------------------- glossary tooltips */
  function prepDfn(root) {
    if (!root || !root.querySelectorAll) return;
    var list = root.querySelectorAll('dfn[data-def]');
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (d.hasAttribute('tabindex')) continue;
      d.setAttribute('tabindex', '0');
      d.setAttribute('role', 'button');
      d.setAttribute('aria-expanded', 'false');
      d.setAttribute('aria-describedby', 'wm-tip');
    }
  }
  WM.enhance = prepDfn;
  var tip = null, tipFor = null, tipPinned = false;
  function ensureTip() {
    if (tip) return tip;
    tip = h('div', { class: 'wm-tip', id: 'wm-tip', role: 'tooltip' });
    doc.body.appendChild(tip);
    return tip;
  }
  function showTip(dfn, pinned) {
    ensureTip();
    if (tipFor && tipFor !== dfn) { tipFor.classList.remove('is-open'); tipFor.setAttribute('aria-expanded', 'false'); }
    tipFor = dfn; tipPinned = !!pinned;
    tip.replaceChildren(h('span', { class: 'wm-tip__term' }, dfn.textContent.trim()), doc.createTextNode(dfn.getAttribute('data-def')));
    dfn.classList.add('is-open'); dfn.setAttribute('aria-expanded', 'true');
    tip.classList.add('is-on');
    var r = dfn.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = Math.min(Math.max(12, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 12);
    var y = r.top - th - 10;
    if (y < 64) y = r.bottom + 10;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() {
    if (!tip || !tipFor) return;
    tip.classList.remove('is-on');
    tipFor.classList.remove('is-open'); tipFor.setAttribute('aria-expanded', 'false');
    tipFor = null; tipPinned = false;
  }
  function dfnOf(t) { return t && t.closest ? t.closest('dfn[data-def]') : null; }
  doc.addEventListener('pointerover', function (e) { if (e.pointerType === 'mouse') { var d = dfnOf(e.target); if (d && !tipPinned) showTip(d, false); } });
  doc.addEventListener('pointerout', function (e) { if (e.pointerType === 'mouse') { var d = dfnOf(e.target); if (d && d === tipFor && !tipPinned && !d.contains(e.relatedTarget)) hideTip(); } });
  doc.addEventListener('focusin', function (e) { var d = dfnOf(e.target); if (d) showTip(d, false); });
  doc.addEventListener('focusout', function (e) { var d = dfnOf(e.target); if (d && d === tipFor) hideTip(); });
  doc.addEventListener('click', function (e) {
    var d = dfnOf(e.target);
    if (d) { e.preventDefault(); if (tipFor === d && tipPinned) hideTip(); else showTip(d, true); return; }
    if (tipPinned) hideTip();
  });
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideTip();
    var d = dfnOf(e.target);
    if (d && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (tipFor === d && tipPinned) hideTip(); else showTip(d, true); }
  });
  window.addEventListener('scroll', function () { if (tipFor) hideTip(); }, { passive: true });

  /* ===================================================================
     Shell: navigator, routing, progress, home page
     =================================================================== */
  WM.modules = {};
  var shell = { ready: false, status: {}, route: null, rendered: false };

  WM.register = function (mod) {
    if (!mod || !mod.id || typeof mod.build !== 'function') { console.warn('[WM.register] a module needs an id and a build(root, WM) function', mod); return; }
    WM.modules[mod.id] = mod;
    shell.status[mod.id] = 'loaded';
    if (shell.ready) {
      updateNav();
      if (shell.route && shell.route.id === mod.id && !shell.rendered) route(true);
    }
  };

  function metaOf(id) { return (shell.cfg && shell.cfg.modules || []).filter(function (m) { return m.id === id; })[0] || null; }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function progressOf(id) {
    var read = WM.store.get('read:' + id, 0) || 0;
    var done = !!WM.store.get('done:' + id, false) || read >= 0.97;
    return { read: read, done: done, started: read > 0.04 || done };
  }

  /* theme */
  var THEMES = ['system', 'light', 'dark'];
  var THEME_LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' };
  function applyTheme(t) {
    if (THEMES.indexOf(t) < 0) t = 'system';
    shell.theme = t;
    if (t === 'system') doc.documentElement.removeAttribute('data-theme');
    else doc.documentElement.setAttribute('data-theme', t);
    if (shell.themeBtn) {
      shell.themeBtn.lastChild.textContent = THEME_LABEL[t];
      shell.themeBtn.setAttribute('aria-label', 'Colour theme: ' + THEME_LABEL[t] + '. Activate to change.');
    }
  }
  WM.setTheme = function (t) { applyTheme(t); WM.store.set('theme', t); };

  function brandMark() {
    return h('svg', { class: 'wm-brand__mark', viewBox: '0 0 30 22', 'aria-hidden': 'true' },
      h('path', { d: 'M2 19 C 8 19, 10 7, 15 7', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }),
      h('path', { d: 'M15 7 C 20 7, 23 13, 28 15', fill: 'none', stroke: 'var(--imagined)', 'stroke-width': '2', 'stroke-dasharray': '3 3', 'stroke-linecap': 'round' }),
      h('path', { d: 'M15 7 C 20 7, 24 4, 28 3', fill: 'none', stroke: 'var(--imagined)', 'stroke-width': '2', 'stroke-dasharray': '3 3', 'stroke-linecap': 'round', opacity: '.55' }),
      h('circle', { cx: '15', cy: '7', r: '2.8', fill: 'currentColor' }));
  }

  function buildChrome() {
    var cfg = shell.cfg;
    var app = doc.getElementById('wm-app') || doc.body.appendChild(h('div', { id: 'wm-app' }));
    shell.menuBtn = h('button', { class: 'wm-tbtn wm-menu', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'wm-nav' }, icon('menu'), h('span', null, 'Modules'));
    shell.themeBtn = h('button', { class: 'wm-tbtn wm-themebtn', type: 'button' }, icon('theme'), h('span', null, 'Auto'));
    shell.navList = h('ol', { class: 'wm-nav__list' });
    shell.homeLink = h('a', { class: 'wm-nav__home', href: '#home' }, icon('home'), h('span', null, 'Course map'));
    shell.nav = h('nav', { class: 'wm-nav', id: 'wm-nav', 'aria-label': 'Modules' },
      shell.homeLink,
      h('span', { class: 'wm-kicker wm-nav__label' }, 'Modules'),
      shell.navList,
      h('p', { class: 'wm-nav__foot' }, 'Progress is saved in this browser only. All pregnancy examples use synthetic data.'));
    shell.scrim = h('div', { class: 'wm-scrim', 'aria-hidden': 'true' });
    shell.view = h('div', { class: 'wm-view' });
    shell.main = h('main', { class: 'wm-main', id: 'wm-main', tabindex: '-1' }, shell.view);
    app.replaceChildren(
      h('a', { class: 'wm-skip', href: '#wm-main', onclick: function (e) { e.preventDefault(); shell.main.focus(); } }, 'Skip to content'),
      h('header', { class: 'wm-top' },
        shell.menuBtn,
        h('a', { class: 'wm-brand', href: '#home', 'aria-label': cfg.title + ', course map' },
          brandMark(),
          h('span', { class: 'wm-brand__name' }, cfg.short || 'World Models'),
          h('span', { class: 'wm-brand__sub' }, cfg.subtitle || '')),
        shell.themeBtn),
      h('div', { class: 'wm-shell' }, shell.nav, shell.scrim, shell.main)
    );
    shell.menuBtn.addEventListener('click', function () { setDrawer(!shell.nav.classList.contains('is-open')); });
    shell.scrim.addEventListener('click', function () { setDrawer(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && shell.nav.classList.contains('is-open')) { setDrawer(false); shell.menuBtn.focus(); } });
    shell.themeBtn.addEventListener('click', function () {
      var i = THEMES.indexOf(shell.theme);
      WM.setTheme(THEMES[(i + 1) % THEMES.length]);
    });
    applyTheme(shell.theme);
    window.addEventListener('wm:progress', function () { updateNav(); });
  }
  function setDrawer(open) {
    shell.nav.classList.toggle('is-open', open);
    shell.scrim.classList.toggle('is-open', open);
    shell.menuBtn.setAttribute('aria-expanded', String(open));
    shell.menuBtn.replaceChildren(icon(open ? 'close' : 'menu'), h('span', null, open ? 'Close' : 'Modules'));
    if (open) { var cur = shell.nav.querySelector('[aria-current="page"]') || shell.homeLink; cur.focus({ preventScroll: true }); }
  }

  function updateNav() {
    if (!shell.navList) return;
    var cur = shell.route ? shell.route.id : 'home';
    shell.navList.textContent = '';
    shell.cfg.modules.forEach(function (m) {
      var pr = progressOf(m.id), stt = shell.status[m.id];
      var pending = stt === 'missing' && !WM.modules[m.id];
      var stateTxt = pending ? 'In preparation' : pr.done ? 'Completed' : pr.started ? Math.round(pr.read * 100) + '% read' : (m.minutes || 25) + ' min';
      var link = h('a', { class: 'wm-nav__link', href: '#' + m.id, 'aria-current': cur === m.id ? 'page' : null },
        h('span', { class: 'wm-nav__num' }, pad2(m.num)),
        h('span', { class: 'wm-nav__title' }, m.title),
        h('span', { class: 'wm-nav__bar', 'aria-hidden': 'true' }, h('i', { style: { width: (pr.done ? 100 : Math.round(pr.read * 100)) + '%' } })),
        h('span', { class: 'wm-nav__state' }, stateTxt));
      var li = h('li', { class: ['wm-nav__item', pr.done && 'is-done', pending && 'is-pending'] }, link);
      if (cur === m.id && shell.toc && shell.toc.length) {
        li.appendChild(h('ol', { class: 'wm-toc', 'aria-label': 'In this module' }, shell.toc.map(function (t) {
          return h('li', null, h('a', { href: '#' + m.id + '/' + t.id, 'data-sec': t.id }, t.title));
        })));
      }
      shell.navList.appendChild(li);
    });
    shell.homeLink.setAttribute('aria-current', cur === 'home' ? 'page' : 'false');
  }
  function setNavProgress(id, read) {
    var link = shell.navList && shell.navList.querySelector('a[href="#' + id + '"]');
    if (!link) return;
    var pr = progressOf(id);
    link.querySelector('.wm-nav__bar > i').style.width = (pr.done ? 100 : Math.round(read * 100)) + '%';
    link.querySelector('.wm-nav__state').textContent = pr.done ? 'Completed' : Math.round(read * 100) + '% read';
    link.parentNode.classList.toggle('is-done', pr.done);
  }

  function parseHash() {
    var raw = '';
    try { raw = decodeURIComponent(location.hash.slice(1)); } catch (e) { raw = location.hash.slice(1); }
    var parts = raw.split(/[/:]/);
    var id = parts[0] || 'home';
    return { id: id, sec: parts[1] || null };
  }
  function scrollToSec(sec) {
    var el = doc.getElementById(sec);
    if (el) el.scrollIntoView({ behavior: WM.reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function route(force) {
    var r = parseHash();
    if (r.id !== 'home' && !metaOf(r.id) && !WM.modules[r.id]) r.id = 'notfound';
    var same = shell.route && shell.route.id === r.id && shell.rendered;
    if (same && force !== true) { if (r.sec) scrollToSec(r.sec); setDrawer(false); return; }
    var rerender = shell.route && shell.route.id === r.id && force === true;
    disposeAll(); hideTip();
    shell.route = r; shell.rendered = false; shell.toc = [];
    if (shell.nav.classList.contains('is-open')) setDrawer(false);
    var view = shell.view;
    view.textContent = '';
    if (r.id === 'home') { renderHome(view); shell.rendered = true; doc.title = shell.cfg.docTitle || 'World Models Course'; }
    else if (r.id === 'notfound') { renderNotFound(view); shell.rendered = true; }
    else renderModule(view, r.id);
    updateNav();
    if (!rerender) {
      window.scrollTo(0, 0);
      if (shell.ready) shell.main.focus({ preventScroll: true });
    }
    if (r.sec) requestAnimationFrame(function () { scrollToSec(r.sec); });
  }
  WM.route = route;

  function renderModule(view, id) {
    var meta = metaOf(id) || { id: id, num: (WM.modules[id] && WM.modules[id].num) || 0, title: (WM.modules[id] && WM.modules[id].title) || id };
    var mod = WM.modules[id], stt = shell.status[id];
    doc.title = 'M' + meta.num + ' · ' + meta.title;
    view.appendChild(h('nav', { class: 'wm-crumbs', 'aria-label': 'Breadcrumb' },
      h('a', { href: '#home' }, 'Course map'), h('span', { 'aria-hidden': 'true' }, '/'),
      h('span', null, 'Module ' + pad2(meta.num) + ' of ' + pad2(shell.cfg.modules.length))));
    if (mod && !narr.settled) {
      /* wait (briefly) for the narration manifest so explainers know their audio */
      view.appendChild(h('div', { class: 'wm-loading', 'aria-busy': 'true', 'aria-label': 'Loading module' }, h('i'), h('i'), h('i'), h('i', { style: 'width:80%' })));
      WM.narrationReady(function () { if (shell.route && shell.route.id === id && !shell.rendered) route(true); });
    } else if (mod) {
      var root = h('article', { class: 'wm-module', 'data-module': id, 'aria-label': meta.title });
      view.appendChild(root);
      WM._currentModule = id;
      try {
        mod.build(root, WM);
        prepDfn(root);
        shell.rendered = true;
      } catch (e) {
        console.error('[WM] module ' + id + ' failed to build:', e);
        disposeAll();
        root.remove();
        view.appendChild(errorCard(meta, e));
        shell.rendered = true;
      }
      WM._currentModule = null;
      view.appendChild(pager(meta));
      if (root.isConnected) { collectToc(root); trackReading(root, id); }
    } else if (stt === 'loading' || stt == null) {
      view.appendChild(h('div', { class: 'wm-loading', 'aria-busy': 'true', 'aria-label': 'Loading module' }, h('i'), h('i'), h('i'), h('i', { style: 'width:80%' })));
    } else if (stt === 'missing') {
      view.appendChild(pendingCard(meta));
      view.appendChild(pager(meta));
    } else {
      view.appendChild(errorCard(meta, new Error('The file ' + (meta.file || id + '.js') + ' loaded but did not call WM.register({ id: \'' + id + '\', ... }).')));
      view.appendChild(pager(meta));
      shell.rendered = true;
    }
  }

  function pendingCard(meta) {
    return h('div', { class: 'wm-card wm-card--pending', role: 'status' },
      h('span', { class: 'wm-kicker' }, 'Module ' + pad2(meta.num) + ' · in preparation'),
      h('h1', null, meta.title),
      meta.desc ? h('p', null, meta.desc) : null,
      h('p', null, 'This module has not been published yet. It will appear here as soon as its file is added; the rest of the course works without it.'),
      h('div', { class: 'wm-card__acts' }, h('a', { class: 'wm-btn wm-btn--ghost', href: '#home' }, 'Back to the course map')));
  }
  function errorCard(meta, e) {
    return h('div', { class: 'wm-card wm-card--error', role: 'alert' },
      h('span', { class: 'wm-kicker' }, 'Module ' + pad2(meta.num) + ' · could not be displayed'),
      h('h1', null, meta.title),
      h('p', null, 'Something in this module failed while it was being built. Other modules are unaffected.'),
      h('pre', null, String((e && e.message) || e)),
      h('div', { class: 'wm-card__acts' },
        h('button', { class: 'wm-btn', type: 'button', onclick: function () { route(true); } }, 'Try again'),
        h('a', { class: 'wm-btn wm-btn--ghost', href: '#home' }, 'Back to the course map')));
  }
  function renderNotFound(view) {
    doc.title = 'Page not found';
    view.appendChild(h('div', { class: 'wm-card' },
      h('span', { class: 'wm-kicker' }, 'Not found'),
      h('h1', null, 'There is no page at this address'),
      h('p', null, 'The link may be out of date. Every module is listed on the course map.'),
      h('div', { class: 'wm-card__acts' }, h('a', { class: 'wm-btn wm-btn--primary', href: '#home' }, 'Open the course map'))));
  }
  function pager(meta) {
    var mods = shell.cfg.modules, i = mods.indexOf(meta);
    var prev = i > 0 ? mods[i - 1] : null, next = i >= 0 && i < mods.length - 1 ? mods[i + 1] : null;
    return h('nav', { class: 'wm-pager', 'aria-label': 'Previous and next module' },
      prev ? h('a', { href: '#' + prev.id, rel: 'prev' }, h('span', { class: 'wm-pager__dir' }, '← Previous · M' + prev.num), h('span', { class: 'wm-pager__t' }, prev.title))
        : h('a', { href: '#home' }, h('span', { class: 'wm-pager__dir' }, '← Back'), h('span', { class: 'wm-pager__t' }, 'Course map')),
      next ? h('a', { class: 'is-next', href: '#' + next.id, rel: 'next' }, h('span', { class: 'wm-pager__dir' }, 'Next · M' + next.num + ' →'), h('span', { class: 'wm-pager__t' }, next.title))
        : h('a', { class: 'is-next', href: '#home' }, h('span', { class: 'wm-pager__dir' }, 'Finished →'), h('span', { class: 'wm-pager__t' }, 'Course map')));
  }

  function collectToc(root) {
    var secs = root.querySelectorAll('section.wm-section[id]');
    shell.toc = Array.prototype.map.call(secs, function (s) { return { id: s.id, title: s.getAttribute('data-toc') || s.id, el: s }; });
    if (!shell.toc.length || !io) return;
    var spy = new IntersectionObserver(function () {
      var best = null;
      shell.toc.forEach(function (t) { var r = t.el.getBoundingClientRect(); if (r.top < window.innerHeight * 0.35) best = t; });
      var links = shell.navList.querySelectorAll('.wm-toc a');
      Array.prototype.forEach.call(links, function (a) { a.classList.toggle('is-active', !!best && a.getAttribute('data-sec') === best.id); });
    }, { rootMargin: '0px 0px -60% 0px', threshold: [0, 1] });
    shell.toc.forEach(function (t) { spy.observe(t.el); });
    onDispose(function () { spy.disconnect(); });
  }

  function trackReading(root, id) {
    var pending = false;
    function measure() {
      pending = false;
      if (!root.isConnected) return;
      var r = root.getBoundingClientRect();
      var total = Math.max(1, r.height);
      var seen = D.clamp((window.innerHeight - r.top) / total);
      var best = WM.store.get('read:' + id, 0) || 0;
      if (seen > best + 0.01 || (seen >= 0.97 && best < 0.97)) {
        WM.store.set('read:' + id, Math.round(seen * 100) / 100);
        setNavProgress(id, seen);
      }
    }
    var onScroll = function () { if (!pending) { pending = true; requestAnimationFrame(measure); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    onDispose(function () { window.removeEventListener('scroll', onScroll); });
    setTimeout(measure, 600);
  }

  /* ------------------------------------------------------------- home page */
  function legendSvg(kind) {
    var c = 'var(--' + (kind === 'error' ? 'error' : kind === 'imagined' ? 'imagined' : 'reality') + ')';
    if (kind === 'error') {
      return h('svg', { viewBox: '0 0 76 28', 'aria-hidden': 'true' },
        h('line', { x1: 4, y1: 22, x2: 72, y2: 22, stroke: 'var(--reality)', 'stroke-width': 2 }),
        h('line', { x1: 4, y1: 6, x2: 72, y2: 6, stroke: 'var(--imagined)', 'stroke-width': 2, 'stroke-dasharray': '7 5' }),
        h('line', { x1: 40, y1: 7, x2: 40, y2: 21, stroke: c, 'stroke-width': 3 }),
        h('circle', { cx: 40, cy: 6, r: 2.5, fill: c }), h('circle', { cx: 40, cy: 22, r: 2.5, fill: c }));
    }
    return h('svg', { viewBox: '0 0 76 28', 'aria-hidden': 'true' },
      h('path', { d: 'M4 22 C 22 22, 30 6, 50 8 S 68 14, 72 12', fill: 'none', stroke: c, 'stroke-width': 2.2, 'stroke-dasharray': kind === 'imagined' ? '7 5' : null, 'stroke-linecap': 'round' }),
      h('circle', { cx: 72, cy: 12, r: 3.4, fill: kind === 'imagined' ? 'var(--stage)' : c, stroke: c, 'stroke-width': 2, 'stroke-dasharray': kind === 'imagined' ? '2.5 2' : null }));
  }

  function homeFigure() {
    // A ball's real arc (solid ink) against the futures a model imagines from "now" (dashed violet).
    var reduced = WM.reducedMotion();
    var cvs = WM.canvas({
      w: 640, h: 400, animate: !reduced, label: 'A thrown ball: its real path drawn solid and three paths a model imagines from the present moment drawn dashed.',
      draw: function (g, env) {
        var c = env.c, d = env.d, W = 640, H = 400, ground = 330;
        d.grid(g, 0, 0, W, H, 20, 12, { color: c.faint, lw: 1 });
        d.line(g, 24, ground, W - 24, ground, { color: c.muted, lw: 1.5 });
        var cycle = 7.5, T = reduced ? 2.9 : (env.t % cycle);
        var tau = d.clamp(T / 5.6) * 1.0;
        // reality: a projectile with a little drag and gusty wind the model does not know about
        function real(s) {
          var x = 48 + 520 * s - 26 * Math.sin(s * 3.1) * s;
          var y = ground - 4 - (900 * s - 860 * s * s) * 0.95 * (1 + 0.04 * Math.sin(s * 9));
          return [x, y];
        }
        var n = 90, path = [];
        for (var i = 0; i <= n; i++) path.push(real(i / n));
        var now = real(tau);
        // faint full real path (future part not yet observed)
        d.poly(g, path, { color: c.muted, lw: 2, alpha: 0.35 });
        // observed so far: solid ink
        d.poly(g, path.slice(0, Math.max(1, Math.round(tau * n)) + 1).concat([now]), { color: c.reality, lw: 3 });
        // imagined futures from now: dashed, fanned
        var ahead = 1 - tau;
        if (ahead > 0.02) {
          var eps = 0.004, a = real(Math.max(0, tau - eps)), vx = (now[0] - a[0]) / eps, vy = (now[1] - a[1]) / eps;
          [-1, 0, 1].forEach(function (k, idx) {
            var pts = [];
            for (var j = 0; j <= 40; j++) {
              var s = j / 40 * ahead * 1.15;
              var px = now[0] + vx * s * (1 + k * 0.07);
              var py = now[1] + vy * s * (1 - k * 0.12) + 0.95 * 860 * s * s;
              if (py > ground) { pts.push([px, ground]); break; }
              pts.push([px, py]);
            }
            var draw = reduced ? 1 : d.easeOut(d.seg(T % 1.25, 0, 0.9));
            d.poly(g, pts, { color: c.imagined, lw: 2.2, dash: [9, 7], alpha: idx === 1 ? 1 : 0.5, progress: draw });
            if (idx === 1 && draw > 0.98) {
              var end = pts[pts.length - 1], land = real(1);
              if (Math.abs(end[0] - land[0]) > 6) {
                d.line(g, end[0], ground + 14, land[0], ground + 14, { color: c.error, lw: 3 });
                d.dot(g, end[0], ground + 14, 3.5, { fill: c.error }); d.dot(g, land[0], ground + 14, 3.5, { fill: c.error });
                d.text(g, 'error', (end[0] + land[0]) / 2, ground + 42, { align: 'center', size: 19, font: 'mono', color: c.error });
              }
            }
          });
        }
        d.dot(g, now[0], now[1], 9, { fill: c.reality });
        d.dot(g, now[0], now[1], 15, { fill: false, stroke: c.reality, lw: 1.2 });
        d.text(g, 'now', now[0] - 4, now[1] - 26, { size: 20, font: 'mono', color: c.ink, halo: 5, align: 'center' });
        d.text(g, 'observed', 32, 40, { size: 19, font: 'mono', color: c.muted });
        d.line(g, 142, 33, 186, 33, { color: c.reality, lw: 3 });
        d.text(g, 'imagined', 222, 40, { size: 19, font: 'mono', color: c.muted });
        d.line(g, 332, 33, 384, 33, { color: c.imagined, lw: 2.5, dash: [9, 7] });
      }
    });
    return cvs;
  }

  function renderHome(view) {
    var cfg = shell.cfg, mods = cfg.modules;
    var total = mods.reduce(function (a, m) { return a + (m.minutes || 25); }, 0);
    var next = mods.filter(function (m) { return !progressOf(m.id).done; })[0];
    var anyStarted = mods.some(function (m) { return progressOf(m.id).started; });
    var fig = homeFigure();
    view.appendChild(h('div', { class: 'wm-home' },
      h('header', { class: 'wm-home__head' },
        h('span', { class: 'wm-kicker' }, 'An interactive course \u00b7 ' + mods.length + ' modules \u00b7 about ' + (Math.round(total / 30) / 2) + ' hours'),
        h('h1', { class: 'wm-home__title' }, 'World Models,', h('span', null, 'from first principles to pregnancy'))),
      h('div', { class: 'wm-home__hero' },
        h('div', { class: 'wm-home__text' },
          rich('p', 'wm-home__lede', cfg.intro || ''),
          h('div', { class: 'wm-home__cta' },
            next ? h('a', { class: 'wm-btn wm-btn--primary', href: '#' + next.id }, (anyStarted ? 'Continue with M' : 'Start with M') + next.num, icon('arrowR')) : h('a', { class: 'wm-btn wm-btn--primary', href: '#' + mods[0].id }, 'Revisit M1', icon('arrowR')),
            h('a', { class: 'wm-btn wm-btn--ghost', href: '#course-map', onclick: function (e) { e.preventDefault(); scrollToSec('course-map'); } }, 'See all modules'))),
        h('figure', { class: 'wm-home__fig' }, fig.el,
          h('figcaption', null, h('span', null, 'Every diagram uses this code: what really happens is solid; what a model imagines is dashed.')))),
      h('div', { class: 'wm-home__grid2' },
        h('section', { class: 'wm-home__sec', id: 'course-map', 'aria-labelledby': 'cm-h' },
          h('span', { class: 'wm-kicker' }, 'Course map'),
          h('h2', { id: 'cm-h' }, 'Six modules, one idea built up step by step'),
          h('ol', { class: 'wm-map' }, mods.map(function (m) {
            var pr = progressOf(m.id), stt = shell.status[m.id];
            var pending = stt === 'missing' && !WM.modules[m.id];
            var state = pending ? 'In preparation' : pr.done ? 'Completed' : pr.started ? Math.round(pr.read * 100) + '% read' : 'Not started';
            return h('li', { class: ['wm-map__item', pr.done && 'is-done', !pr.done && pr.started && 'is-started'] },
              h('span', { class: 'wm-map__node', 'aria-hidden': 'true' }),
              h('a', { class: 'wm-map__link', href: '#' + m.id },
                h('span', { class: 'wm-map__top' }, h('span', { class: 'wm-map__num' }, 'M' + m.num), h('span', { class: 'wm-map__title' }, m.title)),
                h('p', { class: 'wm-map__desc' }, m.desc || ''),
                h('span', { class: 'wm-map__meta' }, h('b', null, state), h('span', null, (m.level || '') + ' · ' + (m.minutes || 25) + ' min'))));
          })),
          h('p', { class: 'wm-map__total' }, 'Total about ' + total + ' minutes. Modules build on each other, but each one stands on its own.')),
        h('section', { class: 'wm-home__sec', 'aria-labelledby': 'lg-h' },
          h('span', { class: 'wm-kicker' }, 'Before you start'),
          h('h2', { id: 'lg-h' }, 'How to read the diagrams'),
          h('div', { class: 'wm-legend' },
            h('div', { class: 'wm-legend__row' }, legendSvg('reality'), h('div', null, h('h3', null, 'Solid ink: reality'), h('p', null, 'What actually happened, or what was measured.'))),
            h('div', { class: 'wm-legend__row' }, legendSvg('imagined'), h('div', null, h('h3', null, 'Dashed violet: the model'), h('p', null, 'What a model imagines, predicts or simulates.'))),
            h('div', { class: 'wm-legend__row' }, legendSvg('error'), h('div', null, h('h3', null, 'Red: error'), h('p', null, 'The gap between prediction and reality.')))),
          h('p', { style: 'margin-top:18px;font-size:.92rem;color:var(--ink-2)' },
            'Explainers play like short videos: pause, scrub and change speed. Panels marked ', h('b', null, 'Try'), ' tell you what to change first. ',
            rich('span', null, 'Words with a dotted underline, like <dfn data-def="A simulation, held inside a brain or a computer, of how the world changes over time.">world model</dfn>, show a definition when tapped.')),
          h('div', { class: 'wm-note', role: 'note' },
            h('span', { class: 'wm-kicker' }, 'Data'),
            h('p', null, cfg.dataNote || 'All pregnancy examples use synthetic data generated for teaching. No real patient or study participant data appear anywhere in this course.'))))
    ));
  }

  /* ------------------------------------------------------------------ boot */
  function loadModule(m) {
    if (WM.modules[m.id]) { shell.status[m.id] = 'loaded'; return; }
    shell.status[m.id] = 'loading';
    var s = doc.createElement('script');
    s.src = (shell.cfg.base || '') + (m.file || m.id + '.js');
    s.async = true;
    function after() {
      updateNav();
      if (shell.route && shell.route.id === m.id && !shell.rendered) route(true);
      else if (shell.route && shell.route.id === 'home') {
        // refresh map state labels quietly
        var items = shell.view.querySelectorAll('.wm-map__link');
        Array.prototype.forEach.call(items, function (a) {
          var id = a.getAttribute('href').slice(1), stt = shell.status[id];
          if (stt === 'missing' && !WM.modules[id]) { var b = a.querySelector('.wm-map__meta b'); if (b) b.textContent = 'In preparation'; }
        });
      }
    }
    s.onload = function () { if (!WM.modules[m.id]) shell.status[m.id] = 'unregistered'; after(); };
    s.onerror = function () { if (!WM.modules[m.id]) shell.status[m.id] = 'missing'; after(); };
    doc.head.appendChild(s);
  }

  WM.boot = function (cfg) {
    shell.cfg = cfg;
    cfg.modules.forEach(function (m, i) { if (m.num == null) m.num = i + 1; });
    shell.theme = WM.store.get('theme', 'system');
    buildChrome();
    loadNarration();
    cfg.modules.forEach(loadModule);
    window.addEventListener('hashchange', function () { route(false); });
    route(false);
    shell.ready = true;
  };
})();
