/* reduced-scroll-page.js — make one wheel tick travel a shorter, smoother distance.
 *
 * How it works:
 *   1. Capture wheel events at document level and stop the browser's instant jump.
 *   2. Add only a fraction of the wheel distance (DELTA_SCALE) to a scroll target.
 *   3. Ease the real scroll position toward that target each frame (EASE), so the
 *      page glides instead of hopping. Smaller EASE = slower, calmer movement.
 *
 * Native scrolling is left alone for touch devices, keyboard keys, scrollbar
 * drags and reduced-motion visitors, and anything else on the page that listens
 * to `scroll` keeps seeing normal, real scroll positions.
 */

(function () {
  "use strict";

  var motion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  if (motion && motion.matches) return;

  // Touch screens already have momentum scrolling we should not fight.
  var coarse = window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : false;
  if (coarse) return;

  /* ------------------------------------------------------------- tunables */

  // Distance travelled per wheel tick. Lower values allow more controlled scrolling.
  var DELTA_SCALE = 0.25;

  // How fast the page catches up to the target each frame.
  // 0.16 feels deliberate and calm; raise it toward 0.3 for snappier motion.
  var EASE = 0.16;

  // A single "page" delta can be huge on some mice; cap it so one flick of a
  // free-spinning wheel does not fling the page.
  var MAX_STEP = 260;

  /* ---------------------------------------------------------------- state */

  var target = window.scrollY || window.pageYOffset || 0;
  var rafId = null;
  var animating = false;
  var previousScrollBehavior = "";

  function maxScroll() {
    var doc = document.documentElement;
    var body = document.body;
    var height = Math.max(
      doc ? doc.scrollHeight : 0,
      body ? body.scrollHeight : 0
    );
    return Math.max(0, height - window.innerHeight);
  }

  function clamp(value) {
    return Math.max(0, Math.min(maxScroll(), value));
  }

  function currentScroll() {
    return window.scrollY || window.pageYOffset || 0;
  }

  // Turn any wheel event into a signed pixel amount.
  function wheelDelta(e) {
    var delta = 0;

    if (typeof e.deltaY === "number" && e.deltaY !== 0) {
      delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16; // lines -> approximate pixels
      else if (e.deltaMode === 2) delta *= window.innerHeight || 1; // pages
    } else if (typeof e.detail === "number" && e.detail !== 0) {
      delta = e.detail * 16;
    } else if (typeof e.wheelDelta === "number" && e.wheelDelta !== 0) {
      delta = (-e.wheelDelta / 120) * 16;
    }

    if (!delta) return 0;

    if (delta > MAX_STEP) delta = MAX_STEP;
    else if (delta < -MAX_STEP) delta = -MAX_STEP;

    return delta;
  }

  /* ------------------------------------------------------------ animation */

  function start() {
    if (rafId !== null) return;

    // The stylesheet sets `scroll-behavior: smooth`, which would animate every
    // scrollTo() on its own and fight the easing below. Park it while we drive.
    if (previousScrollBehavior === "") {
      var doc = document.documentElement;
      previousScrollBehavior = doc.style.scrollBehavior || "";
      doc.style.scrollBehavior = "auto";
    }

    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    animating = false;

    if (previousScrollBehavior !== "") {
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
      previousScrollBehavior = "";
    }
  }

  function tick() {
    animating = true;

    var at = currentScroll();
    var diff = target - at;

    if (Math.abs(diff) < 0.5) {
      if (diff !== 0) window.scrollTo(0, target);
      stop();
      return;
    }

    window.scrollTo(0, at + diff * EASE);
    rafId = requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------------- wheel */

  function onWheel(e) {
    // Ctrl + wheel is browser zoom / pinch, never page scroll.
    if (e.ctrlKey) return;

    var delta = wheelDelta(e);
    if (!delta) return;

    // Leave clearly horizontal gestures (sideways swipes) to the browser.
    if (Math.abs(e.deltaX || 0) > Math.abs(delta)) return;

    e.preventDefault();

    target = clamp(target + delta * DELTA_SCALE);
    start();
  }

  /* --------------------------------------------------------------- resync */

  // If the page moved for any other reason (keyboard, scrollbar, anchor link,
  // layout change), adopt that position so the next wheel tick starts there
  // instead of snapping back.
  function onScroll() {
    if (animating) return;
    var at = currentScroll();
    if (Math.abs(at - target) > 1) target = at;
  }

  function onResize() {
    if (!animating) {
      target = clamp(currentScroll());
    }
  }

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });

  // Re-clamp after fonts/images settle and change the page height.
  window.addEventListener("load", onResize, { passive: true });
})();
