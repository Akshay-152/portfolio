/*
 * effects.js — scroll-linked motion for the portfolio.
 *
 *  1. Navbar reading-progress line + its glowing head (set via --p).
 *  2. Igniting hairline dividers at the top of Skills / Work / Experience
 *     (set via --enter on each .section-divider).
 *  3. The Experience timeline: its green track draws with scroll (via --draw)
 *     and each node ignites as the playhead passes it.
 *  4. The Work/Experience ticker leans with scroll velocity (skewX).
 *  5. Stat counters that count up once when they enter the viewport.
 *  6. A pointer-position glow across project cards.
 *
 * Everything is driven by ONE rAF loop that only runs in response to scroll —
 * no idle frames. All layout reads happen before any style writes.
 *
 * Reduced motion settles every effect into its final state instead of
 * animating, and without JS the markup already shows the finished values.
 */
(function () {
  "use strict";

  var reduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  /* ---------------- shared scroll loop ---------------- */

  var progressRoot = document.querySelector(".scroll-progress");
  var marquee = document.querySelector(".marquee");
  var timeline = document.querySelector(".timeline");

  var dividers = Array.prototype.map.call(
    document.querySelectorAll(".section-divider"),
    function (el) {
      return { el: el, section: el.parentNode };
    }
  );

  var timelineItems = timeline
    ? Array.prototype.slice.call(timeline.querySelectorAll(".timeline-item"))
    : [];

  var queued = false;
  var vel = 0;
  var lastY = null;

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  }

  /* Cache node positions once per layout so the frame loop never has to. */
  function measure() {
    for (var i = 0; i < timelineItems.length; i++) {
      var item = timelineItems[i];
      /* The node sits near the item's top (see .timeline-item::before). */
      item.__nodeY = item.offsetTop + Math.min(item.offsetHeight * 0.3, 46);
    }
  }

  function settleFinalState() {
    for (var i = 0; i < dividers.length; i++) {
      dividers[i].el.style.setProperty("--enter", "1");
    }
    if (timeline) {
      timeline.style.setProperty("--draw", "1");
      for (var j = 0; j < timelineItems.length; j++) {
        timelineItems[j].classList.add("is-lit");
      }
    }
    if (marquee) marquee.style.transform = "";
  }

  function frame() {
    queued = false;

    var vh = window.innerHeight || 1;
    var doc = document.documentElement;
    var y = window.scrollY || doc.scrollTop || 0;

    /* --- all layout reads first --- */
    var max = doc.scrollHeight - doc.clientHeight;
    var p = max > 0 ? clamp01(y / max) : 0;

    var dividerTops = [];
    for (var i = 0; i < dividers.length; i++) {
      dividerTops.push(dividers[i].section.getBoundingClientRect().top);
    }

    var tlRect = timeline ? timeline.getBoundingClientRect() : null;

    /* --- progress line + glowing head --- */
    if (progressRoot) progressRoot.style.setProperty("--p", p.toFixed(4));

    if (reduced) return; /* everything below is decorative motion */

    /* --- scroll velocity (for the ticker skew) --- */
    if (lastY !== null) {
      var delta = y - lastY;
      vel += (delta - vel) * 0.4;
    }
    lastY = y;
    if (Math.abs(vel) < 0.03) vel = 0;

    /* --- igniting section dividers --- */
    for (var d = 0; d < dividers.length; d++) {
      var enter = clamp01((vh * 0.9 - dividerTops[d]) / (vh * 0.45));
      dividers[d].el.style.setProperty("--enter", enter.toFixed(4));
    }

    /* --- timeline draw + node ignition --- */
    if (tlRect) {
      var draw = clamp01((vh * 0.75 - tlRect.top) / (Math.max(tlRect.height, 1) * 0.85));
      timeline.style.setProperty("--draw", draw.toFixed(4));

      var drawn = draw * tlRect.height;
      for (var t = 0; t < timelineItems.length; t++) {
        var item = timelineItems[t];
        var lit = (item.__nodeY || 0) <= drawn;
        if (lit !== item.__lit) {
          item.__lit = lit;
          item.classList.toggle("is-lit", lit);
        }
      }
    }

    /* --- ticker leans into the scroll, then settles --- */
    if (marquee) {
      var skew = Math.max(-7, Math.min(7, vel * 0.16));
      marquee.style.transform = skew ? "skewX(" + skew.toFixed(2) + "deg)" : "";
    }

    /* Keep a short tail of frames alive while the skew decays. */
    if (vel !== 0) schedule();
  }

  function onResize() {
    measure();
    schedule();
  }

  measure();
  if (reduced) {
    settleFinalState();
  }
  schedule();

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("load", onResize);

  /* ---------------- stat counters ---------------- */

  var stats = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));

  /* How many decimal places a stat keeps (e.g. 8.9 CGPA). */
  function decimalsOf(target) {
    var s = String(target);
    var dot = s.indexOf(".");
    return dot === -1 ? 0 : s.length - dot - 1;
  }

  function finalValue(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    if (!isNaN(target)) el.textContent = target.toFixed(decimalsOf(target)) + suffix;
  }

  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    if (isNaN(target)) return;

    var dec = decimalsOf(target);
    var duration = 1100;
    var start = null;

    function step(now) {
      if (start === null) start = now;
      var t = (now - start) / duration;
      if (t > 1) t = 1;
      var eased = 1 - Math.pow(1 - t, 3); /* ease-out cubic */
      el.textContent = (target * eased).toFixed(dec) + suffix;
      if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  if (stats.length) {
    if (reduced || !("IntersectionObserver" in window)) {
      stats.forEach(finalValue);
    } else {
      var statObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            statObserver.unobserve(entry.target);
            countUp(entry.target);
          });
        },
        { threshold: 0.6 }
      );
      stats.forEach(function (el) {
        statObserver.observe(el);
      });
    }
  }

  /* ---------------- pointer glow on project cards ---------------- */

  var canHover =
    window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (!reduced && canHover) {
    var cards = document.querySelectorAll(".project-card");
    Array.prototype.forEach.call(cards, function (card) {
      card.addEventListener(
        "pointermove",
        function (e) {
          var rect = card.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          var x = ((e.clientX - rect.left) / rect.width) * 100;
          var y = ((e.clientY - rect.top) / rect.height) * 100;
          card.style.setProperty("--mx", x.toFixed(2) + "%");
          card.style.setProperty("--my", y.toFixed(2) + "%");
        },
        { passive: true }
      );
    });
  }
})();
