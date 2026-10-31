/*
 * motion.js — reusable motion utilities for the portfolio.
 *
 *  1. Scroll reveal: elements marked [data-reveal] fade/rise into place once,
 *     driven by IntersectionObserver (no scroll handler, no per-frame work).
 *  2. Active navigation: keeps the drawer's section links in sync with the
 *     section currently in view.
 *
 * Reduced motion (or a missing IntersectionObserver) shows everything
 * immediately instead of animating.
 */
(function () {
  "use strict";

  var reduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var revealables = Array.prototype.slice.call(
    document.querySelectorAll("[data-reveal]")
  );

  function showAll() {
    revealables.forEach(function (el) {
      el.classList.add("is-revealed");
    });
  }

  if (reduced || !("IntersectionObserver" in window)) {
    showAll();
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    revealables.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /* ---------- active section link ---------- */
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll(".nav-link[href^='#']")
  );

  if (!navLinks.length || !("IntersectionObserver" in window)) return;

  var sections = Array.prototype.slice.call(
    document.querySelectorAll("section[id], header[id], footer[id]")
  );

  var footerLinks = Array.prototype.slice.call(
    document.querySelectorAll(".footer-nav a")
  );

  function setActive(id) {
    navLinks.forEach(function (link) {
      link.classList.toggle(
        "text-indigo-400",
        link.getAttribute("href") === "#" + id
      );
    });

    footerLinks.forEach(function (link) {
      if (link.getAttribute("href") === "#" + id) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  var activeObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    },
    { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
  );

  sections.forEach(function (section) {
    activeObserver.observe(section);
  });
})();
