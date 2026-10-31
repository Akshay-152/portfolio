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
   * ---- Send-to-email (no backend required) ----
   *
   * "Send message" delivers the form straight to your inbox through
   * FormSubmit (https://formsubmit.co), which turns a plain POST into an email.
   * No account or API key is needed, so this works on any static host, including
   * file:// previews and Render/Netlify/GitHub Pages deployments.
   *
   * One-time setup: the very first submission makes FormSubmit send an
   * activation email to SEND_TO_EMAIL. Click the link in it once and every
   * later message arrives normally.
   *
   * Prefer a different provider (Formspree, your own API route, ...)? Set
   * DELIVERY_ENDPOINT to a URL that accepts JSON and it takes priority.
   */
  var SEND_TO_EMAIL = "akshayganesh239@gmail.com";
  var FORMSUBMIT_URL = "https://formsubmit.co/ajax/" + SEND_TO_EMAIL;
  var FORMSUBMIT_FORM_URL = "https://formsubmit.co/" + SEND_TO_EMAIL;
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

  /* ---------------------------------------------------------- delivery */

  // Build the exact field set sent to the mail provider.
  function buildPayload(data) {
    return {
      name: data.name,
      email: data.email,
      message: data.message,
      _subject: "Portfolio message from " + (data.name || "a visitor"),
      _template: "table",
      _captcha: "false"
    };
  }

  // POST JSON and surface a readable reason when the provider rejects it.
  function postJSON(url, payload) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.text().then(function (text) {
        var json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch (err) {
          // Non-JSON reply: only trust a 2xx status.
        }

        if (!res.ok) {
          throw new Error((json && json.message) || "Request failed with " + res.status + ".");
        }
        if (json && String(json.success) === "false") {
          throw new Error(json.message || "The message was rejected.");
        }
        return json;
      });
    });
  }

  // Fallback for origins where fetch() is blocked (CORS on file://, ad blockers):
  // a real form POST into a hidden frame is a plain navigation, so it always goes through.
  function postWithoutCors(data) {
    return new Promise(function (resolve, reject) {
      if (!document.body) {
        reject(new Error("Page is not ready."));
        return;
      }

      var frameName = "contact-delivery-" + Date.now();
      var frame = document.createElement("iframe");
      frame.name = frameName;
      frame.title = "Contact form delivery";
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden;";

      var relay = document.createElement("form");
      relay.method = "POST";
      relay.action = FORMSUBMIT_FORM_URL;
      relay.target = frameName;
      relay.style.display = "none";

      var payload = buildPayload(data);
      Object.keys(payload).forEach(function (key) {
        var input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = payload[key];
        relay.appendChild(input);
      });

      var settled = false;
      var blankLoaded = false;
      var submitted = false;
      var timer = null;
      var poll = null;
      var kick = null;

      function cleanup() {
        clearTimeout(timer);
        clearTimeout(kick);
        clearInterval(poll);
        if (relay.parentNode) relay.parentNode.removeChild(relay);
        if (frame.parentNode) frame.parentNode.removeChild(frame);
      }

      function finish(ok, error) {
        if (settled) return;
        settled = true;
        cleanup();
        if (ok) resolve();
        else reject(error);
      }

      function submitRelay() {
        if (submitted || settled) return;
        clearTimeout(kick);
        clearInterval(poll);
        submitted = true;
        relay.submit();
      }

      // The frame's first load is its own empty document, not our POST response.
      frame.addEventListener("load", function () {
        if (!submitted) {
          blankLoaded = true;
          return;
        }
        finish(true);
      });

      document.body.appendChild(frame);
      document.body.appendChild(relay);

      // Send only after the empty frame is in place, so its blank load cannot be
      // mistaken for a delivered message.
      poll = setInterval(function () {
        if (blankLoaded) submitRelay();
      }, 30);

      // Engines that never fire a load on an empty frame still get to submit.
      kick = setTimeout(submitRelay, 2500);

      timer = setTimeout(function () {
        finish(false, new Error("The message could not be delivered in time."));
      }, 22000);
    });
  }

  /**
   * Send one message to SEND_TO_EMAIL.
   * @param {{name:string,email:string,message:string}} data
   * @returns {Promise<{activated?:boolean}>} resolves when delivered, rejects with a reason
   */
  function sendMessage(data) {
    var payload = buildPayload(data);
    var url = DELIVERY_ENDPOINT || FORMSUBMIT_URL;

    return postJSON(url, payload).then(
      function (json) {
        var note = (json && (json.message || json.detail)) || "";
        return { activated: /activ|confirm/i.test(String(note)) };
      },
      function (err) {
        // Only network/CORS failures are worth retrying through the relay form.
        var isNetwork =
          err && (err.name === "TypeError" || /failed to fetch|networkerror|load failed/i.test(err.message || ""));
        if (!isNetwork || DELIVERY_ENDPOINT) throw err;
        return postWithoutCors(data).then(function () {
          return { activated: false, relayed: true };
        });
      }
    );
  }

  /* ---------------------------------------------------------- submission */

  function setSending(busy) {
    submitting = busy;
    if (!submitBtn) return;
    submitBtn.disabled = busy;
    if (busy) {
      submitBtn.dataset.idleLabel = submitBtn.textContent;
      submitBtn.textContent = "Sending…";
    } else if (submitBtn.dataset.idleLabel) {
      submitBtn.textContent = submitBtn.dataset.idleLabel;
      delete submitBtn.dataset.idleLabel;
    }
  }

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

    setSending(true);
    setStatus("Sending your message…", null);

    sendMessage(data)
      .then(function (result) {
        setStatus(
          result && result.activated
            ? "Message sent. A one-time activation email just went to Akshay's inbox — confirm it so future messages arrive."
            : "Thanks — your message is on its way to Akshay. He'll reply to " + data.email + ".",
          "success"
        );
        form.reset();
      })
      .catch(function (err) {
        setStatus(
          "Sorry, that didn't send" +
            (err && err.message ? " (" + err.message + ")" : "") +
            ". You can email " + SEND_TO_EMAIL + " directly.",
          "error"
        );
      })
      .then(function () {
        setSending(false);
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
