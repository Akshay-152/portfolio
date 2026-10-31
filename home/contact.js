/*
 * contact.js — "LET'S TALK" contact overlay.
 *
 *  - Opens as a modal dialog over the still-visible footer, closes on the ✕
 *    button, backdrop click or Escape, traps Tab inside, and returns focus to
 *    the CTA that opened it.
 *  - Client-side validation for required fields and email format, with inline
 *    messages wired through aria-invalid / aria-describedby, plus live status
 *    feedback for submission.
 *  - No backend exists in this project, so nothing is transmitted unless a
 *    delivery endpoint is configured below. The form never claims a message
 *    was sent when it was not.
 */
(function () {
  "use strict";

  /*
   * Connect delivery here: set this to a POST endpoint (Formspree, Basin, your
   * own API route, ...) and the form will submit to it as JSON.
   * While it is null the form only validates and reports "not connected yet".
   */
  var DELIVERY_ENDPOINT = null;

  var overlay = document.getElementById("contact-overlay");
  var openBtn = document.getElementById("contact-open");
  if (!overlay || !openBtn) return;

  var closeEls = overlay.querySelectorAll("[data-contact-close]");
  var form = document.getElementById("contact-form");
  var statusEl = document.getElementById("contact-status");
  var submitBtn = form ? form.querySelector(".contact-submit") : null;
  var lastFocused = null;
  var isOpen = false;
  var submitting = false;
  var hideTimer = null;

  var FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusableItems() {
    return Array.prototype.filter.call(overlay.querySelectorAll(FOCUSABLE), function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    lastFocused = document.activeElement;

    clearTimeout(hideTimer);
    overlay.hidden = false;
    overlay.removeAttribute("aria-hidden");
    // Next frame so the entry transition runs from its initial state.
    requestAnimationFrame(function () {
      overlay.classList.add("is-open");
    });

    document.documentElement.style.overflow = "hidden";
    document.addEventListener("keydown", onKeydown, true);

    var items = focusableItems();
    if (items.length) items[0].focus();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    overlay.classList.remove("is-open");
    // Leave the accessibility tree immediately even while it fades out.
    overlay.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", onKeydown, true);
    document.documentElement.style.overflow = "";

    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (!isOpen) overlay.hidden = true;
    }, 320);

    if (submitBtn) submitBtn.disabled = false;
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function onKeydown(e) {
    if (!isOpen) return;

    if (e.key === "Escape" || e.key === "Esc") {
      e.preventDefault();
      close();
      return;
    }

    if (e.key !== "Tab") return;

    var items = focusableItems();
    if (!items.length) return;

    var first = items[0];
    var last = items[items.length - 1];
    var active = document.activeElement;

    if (e.shiftKey && (active === first || !overlay.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !overlay.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ---------------------------------------------------------- validation */

  function setError(field, message) {
    var error = document.getElementById(field.id + "-error");
    if (message) {
      field.setAttribute("aria-invalid", "true");
      if (error) error.textContent = message;
    } else {
      field.removeAttribute("aria-invalid");
      if (error) error.textContent = "";
    }
  }

  function validateField(field) {
    var value = (field.value || "").trim();

    if (field.hasAttribute("required") && !value) {
      setError(field, field.dataset.requiredMessage || "This field is required.");
      return false;
    }

    if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setError(field, "Enter a valid email address.");
      return false;
    }

    setError(field, "");
    return true;
  }

  function validateForm() {
    var fields = form.querySelectorAll("input[required], textarea[required]");
    var ok = true;
    var firstBad = null;

    Array.prototype.forEach.call(fields, function (field) {
      if (!validateField(field)) {
        ok = false;
        if (!firstBad) firstBad = field;
      }
    });

    if (firstBad) firstBad.focus();
    return ok;
  }

  function setStatus(message, kind) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.remove("is-error", "is-success");
    if (kind) statusEl.classList.add("is-" + kind);
  }

  /* ---------------------------------------------------------- submission */

  function handleSubmit(e) {
    e.preventDefault();

    if (submitting) return; // no duplicate submissions

    if (!validateForm()) {
      setStatus("Please fix the highlighted fields.", "error");
      return;
    }

    var data = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      message: form.elements.message.value.trim()
    };

    if (!DELIVERY_ENDPOINT) {
      setStatus(
        "Looks good — this form is not connected to a delivery service yet, so nothing was sent.",
        "error"
      );
      return;
    }

    submitting = true;
    if (submitBtn) submitBtn.disabled = true;
    setStatus("Sending…", null);

    fetch(DELIVERY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Request failed: " + res.status);
        setStatus("Thanks — your message has been sent.", "success");
        form.reset();
      })
      .catch(function () {
        setStatus("Something went wrong sending that. Please try again.", "error");
      })
      .then(function () {
        submitting = false;
        if (submitBtn) submitBtn.disabled = false;
      });
  }

  /* ---------------------------------------------------------------- wire */

  openBtn.addEventListener("click", open);

  Array.prototype.forEach.call(closeEls, function (el) {
    el.addEventListener("click", close);
  });

  if (form) {
    form.addEventListener("submit", handleSubmit);

    Array.prototype.forEach.call(
      form.querySelectorAll("input, textarea"),
      function (field) {
        field.addEventListener("blur", function () {
          validateField(field);
        });
        field.addEventListener("input", function () {
          if (field.getAttribute("aria-invalid") === "true") validateField(field);
        });
      }
    );
  }

  // Back to top control in the footer.
  var backToTop = document.getElementById("back-to-top");
  if (backToTop) {
    backToTop.addEventListener("click", function () {
      var hero = document.getElementById("hero");
      var reduced =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (hero) {
        hero.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      }
    });
  }
})();
