/*
 * cursor.js — circular pointer indicator + fading SVG trail.
 *
 * Design goals:
 *  - one animation loop, driven by requestAnimationFrame
 *  - pointer coordinates live in plain variables/refs, never in React/DOM state
 *  - bounded point history, no per-frame allocations beyond a small path string
 *  - decorative only: the whole layer is pointer-events:none and aria-hidden
 *  - capability gated: fine pointer + hover, honours prefers-reduced-motion
 *
 * Public surface: window.initCursorEffect() -> teardown function.
 */
(function () {
  "use strict";

  var TAIL_MS = 340; // trail lifetime in ms (short, so it fades behind the pointer)
  var MAX_POINTS = 26; // hard cap on stored pointer history
  var MIN_STEP = 2.5; // px before a new history point is recorded
  var EASE = 0.22; // ring follow interpolation

  var mqFine = window.matchMedia("(hover: hover) and (pointer: fine)");
  var mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  var active = null;

  function canRun() {
    return mqFine.matches && !mqReduced.matches;
  }

  function mount() {
    if (active) return active;

    var SVG_NS = "http://www.w3.org/2000/svg";

    /* ---------- DOM ---------- */
    var layer = document.createElement("div");
    layer.id = "cursor-layer";
    layer.setAttribute("aria-hidden", "true");

    var follow = document.createElement("div");
    follow.className = "cursor-follow";
    var ring = document.createElement("div");
    ring.className = "cursor-ring";
    follow.appendChild(ring);

    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "cursor-trail");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");

    var defs = document.createElementNS(SVG_NS, "defs");
    var grad = document.createElementNS(SVG_NS, "linearGradient");
    grad.setAttribute("id", "cursorTrailGradient");
    grad.setAttribute("gradientUnits", "userSpaceOnUse");
    var stopA = document.createElementNS(SVG_NS, "stop");
    stopA.setAttribute("offset", "0");
    stopA.setAttribute("stop-color", "#22c55e");
    stopA.setAttribute("stop-opacity", "0");
    var stopB = document.createElementNS(SVG_NS, "stop");
    stopB.setAttribute("offset", "1");
    stopB.setAttribute("stop-color", "#4ade80");
    stopB.setAttribute("stop-opacity", "0.85");
    grad.appendChild(stopA);
    grad.appendChild(stopB);
    defs.appendChild(grad);

    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "cursor-trail-path");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "url(#cursorTrailGradient)");

    svg.appendChild(defs);
    svg.appendChild(path);
    layer.appendChild(svg);
    layer.appendChild(follow);
    document.body.appendChild(layer);
    document.documentElement.classList.add("has-custom-cursor");

    /* ---------- state ---------- */
    var target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    var pos = { x: target.x, y: target.y };
    var points = []; // newest first: { x, y, t }
    var hovering = false;
    var shown = false;
    var rafId = null;
    var lastPath = "";

    /* ---------- pointer input ---------- */
    function onPointerMove(e) {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!shown) show();
      start();
    }

    function show() {
      shown = true;
      // Snap so re-entering the viewport never produces a long slide across the page.
      pos.x = target.x;
      pos.y = target.y;
      points.length = 0;
      layer.classList.add("is-active");
    }

    function hide() {
      if (!shown) return;
      shown = false;
      layer.classList.remove("is-active");
    }

    function onPointerOut(e) {
      if (!e.relatedTarget) hide();
    }

    /* ---------- hover state ---------- */
    var HOVERABLE = "a, button, [role='button'], [data-cursor], input, textarea, select, summary";

    function onPointerOver(e) {
      var el = e.target && e.target.closest ? e.target.closest(HOVERABLE) : null;
      var next = !!el;
      if (next === hovering) return;
      hovering = next;
      follow.classList.toggle("is-hover", hovering);
      layer.classList.toggle("is-hovering", hovering);
    }

    /* ---------- animation ---------- */
    function start() {
      if (rafId !== null || document.hidden) return;
      rafId = requestAnimationFrame(frame);
    }

    function stop() {
      if (rafId === null) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    function frame(now) {
      rafId = requestAnimationFrame(frame);

      pos.x += (target.x - pos.x) * EASE;
      pos.y += (target.y - pos.y) * EASE;
      follow.style.transform =
        "translate3d(" + pos.x.toFixed(2) + "px," + pos.y.toFixed(2) + "px,0)";

      // Age out the tail, then record the current head position when it moved.
      while (points.length && now - points[points.length - 1].t > TAIL_MS) {
        points.pop();
      }
      var head = points[0];
      if (!head || Math.abs(pos.x - head.x) + Math.abs(pos.y - head.y) > MIN_STEP) {
        points.unshift({ x: pos.x, y: pos.y, t: now });
        if (points.length > MAX_POINTS) points.pop();
      }

      updateTrail();
    }

    function updateTrail() {
      var n = points.length;
      if (n < 2) {
        if (lastPath) {
          path.setAttribute("d", "");
          lastPath = "";
        }
        return;
      }

      var d = "M" + points[0].x.toFixed(1) + " " + points[0].y.toFixed(1);
      for (var i = 1; i < n - 1; i++) {
        var midX = (points[i].x + points[i + 1].x) / 2;
        var midY = (points[i].y + points[i + 1].y) / 2;
        d +=
          "Q" + points[i].x.toFixed(1) + " " + points[i].y.toFixed(1) +
          " " + midX.toFixed(1) + " " + midY.toFixed(1);
      }
      d +=
        "L" + points[n - 1].x.toFixed(1) + " " + points[n - 1].y.toFixed(1);

      if (d !== lastPath) {
        path.setAttribute("d", d);
        lastPath = d;
      }

      // Gradient runs tail -> head so the oldest segment is the faintest.
      var tail = points[n - 1];
      grad.setAttribute("x1", tail.x.toFixed(1));
      grad.setAttribute("y1", tail.y.toFixed(1));
      grad.setAttribute("x2", points[0].x.toFixed(1));
      grad.setAttribute("y2", points[0].y.toFixed(1));
    }

    /* ---------- lifecycle ---------- */
    function onVisibility() {
      if (document.hidden) stop();
      else if (shown) start();
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", onVisibility);

    function destroy() {
      stop();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", onVisibility);
      if (layer.parentNode) layer.parentNode.removeChild(layer);
      document.documentElement.classList.remove("has-custom-cursor");
      active = null;
    }

    active = { destroy: destroy };
    return active;
  }

  function evaluate() {
    if (canRun()) mount();
    else if (active) active.destroy();
  }

  evaluate();

  // Capability can change at runtime (plugging in a mouse, toggling reduced motion).
  var onChange = function () {
    evaluate();
  };
  if (mqFine.addEventListener) {
    mqFine.addEventListener("change", onChange);
    mqReduced.addEventListener("change", onChange);
  } else if (mqFine.addListener) {
    mqFine.addListener(onChange);
    mqReduced.addListener(onChange);
  }

  window.initCursorEffect = function () {
    return active ? active.destroy : null;
  };
})();
