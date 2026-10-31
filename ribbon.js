/*
 * ribbon.js — one continuous, scroll-linked light ribbon that carries the eye
 * from the landing page into the About heading.
 *
 * How it works
 *  - ONE cubic-Bézier path, measured once per resize. Its layout is:
 *        enters top-right -> broad S-bend -> returns past the right edge
 *        -> off-screen connector that dips below the viewport and crosses left
 *        -> re-enters from the left -> sweeps across the About heading
 *        -> continues past it and exits top-right.
 *      Because the right-to-left connection happens inside the same path
 *      (below the viewport, clipped by the SVG), the beam never teleports.
 *  - The visible beam is a travelling window of finite length anchored to a
 *    "head" position along the path, so only part of the ribbon is ever on
 *    screen and the rest reads as continuing beyond the viewport.
 *  - Head position, heading reveal, heading highlight and glow boost are all
 *    pure functions of one scroll progress value, so slow, fast and reverse
 *    scrolling stay in sync and everything reverses naturally.
 *  - No animation library, no canvas, no continuous loop: one rAF per scroll
 *    or resize event, cancelled while the document is hidden.
 */
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var HEAD = 70; // length of the bright leading tip, in CSS px
  var NARROW_AT = 760; // below this width the simplified path is used

  var mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  var overlay = null;
  var seg = null;
  var aboutEl = null;
  var heading = null;
  var portrait = null;

  var total = 1; // full path length
  var anchors = []; // [{ p, f }] progress -> fraction of the path
  var start = 0; // scroll position where the journey begins
  var end = 1; // scroll position where it settles

  var rafId = null;
  var resizeTimer = null;

  /* ---------------------------------------------------------------- utils */

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function smoothstep(a, b, v) {
    var t = clamp01((v - a) / (b - a));
    return t * t * (3 - 2 * t);
  }

  function px(v) {
    return v.toFixed(1);
  }

  function svgEl(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    for (var key in attrs) node.setAttribute(key, attrs[key]);
    return node;
  }

  /* ------------------------------------------------------------- geometry */
  /* Coordinates are normalized fractions of the viewport, so the same shape
     adapts from a 320px phone to a 1920px desktop. Control points are chosen
     so neighbouring segments join with matching tangent directions (no corners). */

  function curveSet(w, h) {
    if (w < NARROW_AT) {
      return {
        start: [1.08 * w, -0.04 * h],
        curves: [
          { c1: [0.94, 0.10], c2: [0.80, 0.14], p: [0.72, 0.30] },
          { c1: [0.66, 0.44], c2: [0.96, 0.44], p: [1.10, 0.54] },
          { c1: [1.18, 0.72], c2: [1.06, 1.16], p: [0.62, 1.16] },
          { c1: [0.30, 1.16], c2: [0.04, 1.16], p: [-0.12, 1.06] },
          { c1: [-0.16, 0.94], c2: [0.04, 0.86], p: [0.22, 0.74] },
          { c1: [0.34, 0.68], c2: [0.48, 0.64], p: [0.62, 0.58] },
          { c1: [0.76, 0.52], c2: [0.96, 0.36], p: [1.12, 0.20] }
        ],
        marks: { exitRight: 1, enterLeft: 4, atHeading: 5, exitTop: 6 },
        phases: [
          { p: 0.44, mark: "exitRight" },
          { p: 0.58, mark: "enterLeft" },
          { p: 0.72, mark: "atHeading" },
          { p: 0.94, mark: "exitTop" }
        ],
        snake: [240, 0.22, 540]
      };
    }

    return {
      start: [1.06 * w, -0.05 * h],
      curves: [
        { c1: [0.94, 0.10], c2: [0.72, 0.12], p: [0.60, 0.34] },
        { c1: [0.48, 0.54], c2: [0.72, 0.66], p: [0.86, 0.60] },
        { c1: [1.00, 0.54], c2: [1.06, 0.62], p: [1.10, 0.76] },
        { c1: [1.14, 0.94], c2: [1.06, 1.24], p: [0.72, 1.26] },
        { c1: [0.38, 1.28], c2: [0.05, 1.28], p: [-0.14, 1.20] },
        { c1: [-0.20, 1.08], c2: [-0.02, 0.98], p: [0.14, 0.86] },
        { c1: [0.24, 0.79], c2: [0.33, 0.77], p: [0.46, 0.70] },
        { c1: [0.60, 0.64], c2: [0.71, 0.60], p: [0.82, 0.46] },
        { c1: [0.93, 0.33], c2: [1.03, 0.17], p: [1.12, 0.02] }
      ],
      marks: { exitRight: 2, enterLeft: 5, atHeading: 6, exitTop: 8 },
      phases: [
        { p: 0.46, mark: "exitRight" },
        { p: 0.60, mark: "enterLeft" },
        { p: 0.74, mark: "atHeading" },
        { p: 0.95, mark: "exitTop" }
      ],
      snake: [420, 0.18, 900]
    };
  }

  /* ---------------------------------------------------------------- build */

  function makeSegment() {
    var group = svgEl("g", { id: "ribbon-beam", class: "ribbon-group" });

    function stroke(cls, color) {
      return svgEl("path", {
        class: "ribbon-stroke " + cls,
        stroke: color,
        fill: "none",
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      });
    }

    var glow = stroke("ribbon-glow", "#22c55e");
    var mid = stroke("ribbon-mid", "#22c55e");
    var core = stroke("ribbon-core", "#eafff4");
    var head = stroke("ribbon-head", "#ffffff");

    group.appendChild(glow);
    group.appendChild(mid);
    group.appendChild(core);
    group.appendChild(head);
    overlay.appendChild(group);

    return {
      g: group,
      glow: glow,
      mid: mid,
      core: core,
      head: head,
      layers: [],
      glowBase: 0.13,
      glowBoost: 0.17,
      midBase: 0.4
    };
  }

  /* ------------------------------------------------------------ measure */

  function measure() {
    var w = document.documentElement.clientWidth;
    var h = document.documentElement.clientHeight;
    if (!w || !h || !aboutEl || !seg) return;

    var set = curveSet(w, h);
    var i;

    // One string per curve, reused for the full path and the cumulative probe.
    var origin = "M " + px(set.start[0]) + " " + px(set.start[1]);
    var segs = [];
    for (i = 0; i < set.curves.length; i++) {
      var c = set.curves[i];
      segs.push(
        " C " + px(c.c1[0] * w) + " " + px(c.c1[1] * h) +
        ", " + px(c.c2[0] * w) + " " + px(c.c2[1] * h) +
        ", " + px(c.p[0] * w) + " " + px(c.p[1] * h)
      );
    }

    overlay.setAttribute("viewBox", "0 0 " + w + " " + h);
    var d = origin + segs.join("");
    seg.glow.setAttribute("d", d);
    seg.mid.setAttribute("d", d);
    seg.core.setAttribute("d", d);
    seg.head.setAttribute("d", d);

    // Prefix lengths, so scroll progress can be mapped onto named landmarks
    // (right exit, left entry, heading pass) instead of guessed percentages.
    var probe = svgEl("path", { fill: "none", stroke: "none" });
    overlay.appendChild(probe);
    var acc = origin;
    probe.setAttribute("d", acc);
    var marks = [0];
    for (i = 0; i < segs.length; i++) {
      acc += segs[i];
      probe.setAttribute("d", acc);
      marks.push(probe.getTotalLength());
    }
    if (probe.parentNode) probe.parentNode.removeChild(probe);

    total = seg.core.getTotalLength() || marks[marks.length - 1] || 1;

    // Visible beam: a tapering window anchored to the head.
    var narrow = w < NARROW_AT;
    seg.glowBase = narrow ? 0.1 : 0.13;
    seg.glowBoost = narrow ? 0.12 : 0.17;
    seg.midBase = narrow ? 0.34 : 0.4;
    var snake = Math.max(set.snake[0], Math.min(set.snake[1] * total, set.snake[2]));
    seg.layers = [
      { el: seg.glow, len: snake },
      { el: seg.mid, len: snake * 0.72 },
      { el: seg.core, len: snake * 0.42 }
    ];
    for (i = 0; i < seg.layers.length; i++) {
      var layer = seg.layers[i];
      layer.el.setAttribute("stroke-dasharray", layer.len.toFixed(1) + " " + total.toFixed(1));
    }
    seg.head.setAttribute("stroke-dasharray", HEAD + " " + total.toFixed(1));

    // Landmark anchors: progress -> fraction along the path.
    anchors = [{ p: 0, f: 0 }];
    for (i = 0; i < set.phases.length; i++) {
      var phase = set.phases[i];
      var idx = set.marks[phase.mark] + 1;
      anchors.push({ p: phase.p, f: clamp01(marks[idx] / total) });
    }
    anchors.push({ p: 1, f: 1 });

    // Stable scroll range: About entering the viewport -> About at the top.
    var aboutTop = aboutEl.getBoundingClientRect().top + (window.pageYOffset || 0);
    start = aboutTop - h;
    end = aboutTop - h * 0.08;
    if (end <= start) end = start + 1;
  }

  function fractionAt(p) {
    for (var i = 1; i < anchors.length; i++) {
      if (p <= anchors[i].p) {
        var a = anchors[i - 1];
        var b = anchors[i];
        var span = b.p - a.p;
        var t = span > 0 ? (p - a.p) / span : 1;
        return a.f + (b.f - a.f) * clamp01(t);
      }
    }
    return 1;
  }

  /* -------------------------------------------------------------- render */

  function paint(head, opacity, boost) {
    for (var i = 0; i < seg.layers.length; i++) {
      seg.layers[i].el.setAttribute(
        "stroke-dashoffset",
        (seg.layers[i].len - head).toFixed(2)
      );
    }
    seg.head.setAttribute("stroke-dashoffset", (HEAD - head).toFixed(2));

    seg.g.style.opacity = opacity.toFixed(3);
    seg.glow.style.opacity = (seg.glowBase + seg.glowBoost * boost).toFixed(3);
    seg.mid.style.opacity = (seg.midBase + 0.22 * boost).toFixed(3);
  }

  function update() {
    if (!overlay) return;

    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var p = clamp01((y - start) / (end - start));

    var head = fractionAt(p) * total;
    var opacity = smoothstep(0, 0.045, p) * (1 - smoothstep(0.93, 1, p));
    var boost = smoothstep(0.63, 0.73, p) * (1 - smoothstep(0.8, 0.92, p));
    paint(head, opacity, boost);

    if (heading) {
      // Reveal: the heading unmasks as the beam reaches it.
      var reveal = smoothstep(0.5, 0.72, p);
      heading.style.clipPath = "inset(0 " + ((1 - reveal) * 100).toFixed(2) + "% 0 0)";
      // Brief left-to-right highlight riding the beam.
      heading.style.setProperty("--sweep", smoothstep(0.56, 0.78, p).toFixed(3));
    }
  }

  /* --------------------------------------------------------- scheduling */

  function schedule() {
    if (rafId !== null || document.hidden) return;
    rafId = requestAnimationFrame(function () {
      rafId = null;
      update();
    });
  }

  function stop() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  function onScroll() {
    schedule();
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      measure();
      update();
    }, 120);
  }

  function onVisibility() {
    if (document.hidden) stop();
    else schedule();
  }

  /* ---------------------------------------------------------- lifecycle */

  function init() {
    if (overlay || mqReduced.matches) return;

    aboutEl = document.getElementById("about");
    if (!aboutEl) return;

    heading = document.getElementById("about-title");
    portrait = aboutEl.querySelector(".about-portrait");

    overlay = svgEl("svg", {
      id: "light-ribbon",
      "aria-hidden": "true",
      focusable: "false"
    });
    seg = makeSegment();
    document.body.appendChild(overlay);

    measure();
    update();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("load", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    if (portrait) portrait.addEventListener("load", onResize);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(onResize, function () {});
    }
  }

  function teardown() {
    if (!overlay) return;

    stop();
    clearTimeout(resizeTimer);

    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("load", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    if (portrait) portrait.removeEventListener("load", onResize);

    if (heading) {
      heading.style.clipPath = "";
      heading.style.removeProperty("--sweep");
    }
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);

    overlay = null;
    seg = null;
    aboutEl = null;
    heading = null;
    portrait = null;
    anchors = [];
  }

  function evaluate() {
    if (mqReduced.matches) teardown();
    else init();
  }

  evaluate();

  var onChange = function () {
    evaluate();
  };
  if (mqReduced.addEventListener) {
    mqReduced.addEventListener("change", onChange);
  } else if (mqReduced.addListener) {
    mqReduced.addListener(onChange);
  }

  // Small manual hook; nothing on the page depends on it.
  window.initLightRibbon = {
    remeasure: function () {
      measure();
      update();
    },
    isRunning: function () {
      return !!overlay;
    }
  };
})();
