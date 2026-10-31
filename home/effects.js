/*
 * effects.js — small dynamic touches for the full page.
 *
 *  1. Navbar reading-progress line (transform only, one rAF per scroll event).
 *  2. Stat counters that count up once when they enter the viewport.
 *  3. A pointer-position glow that follows the cursor across project cards.
 *
 * Everything degrades to static content: values are already correct in the
 * markup, and reduced-motion visitors get the final numbers with no animation.
 */
(function () {
  "use strict";

  var reduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- scroll progress line ---------------- */

  var bar = document.querySelector(".scroll-progress-bar");
  if (bar) {
    var queued = false;

    var paint = function () {
      queued = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var p = max > 0 ? doc.scrollTop / max : 0;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      bar.style.transform = "scaleX(" + p + ")";
    };

    var onScroll = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    paint();
  }

  /* ---------------- stat counters ---------------- */

  var stats = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));

  function finalValue(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    if (!isNaN(target)) el.textContent = target + suffix;
  }

  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    if (isNaN(target)) return;

    var duration = 1100;
    var start = null;

    function step(now) {
      if (start === null) start = now;
      var t = (now - start) / duration;
      if (t > 1) t = 1;
      var eased = 1 - Math.pow(1 - t, 3); /* ease-out cubic */
      el.textContent = Math.round(target * eased) + suffix;
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
