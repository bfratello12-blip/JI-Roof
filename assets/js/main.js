/* ==========================================================================
   JI Roofing & Exteriors Corp — site behaviour
   ========================================================================== */
(function () {
  "use strict";

  var onReady = function (fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  };

  /* ---------------------------------------------------------------- Header */
  function initHeader() {
    var header = document.querySelector(".header");
    if (!header) return;

    var setStuck = function () {
      header.classList.toggle("is-stuck", window.scrollY > 12);
    };
    setStuck();
    window.addEventListener("scroll", setStuck, { passive: true });
  }

  /* ------------------------------------------------------------ Mobile nav */
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".nav");
    var scrim = document.querySelector(".nav-scrim");
    var header = document.querySelector(".header");
    if (!toggle || !nav) return;

    // The panel lives inside the sticky header, so anchor it to the header's
    // live bottom edge rather than a fixed offset.
    var syncOffset = function () {
      if (!header) return;
      document.documentElement.style.setProperty(
        "--nav-top",
        Math.round(header.getBoundingClientRect().bottom) + "px"
      );
    };

    var close = function () {
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", function () {
      syncOffset();
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    if (scrim) scrim.addEventListener("click", close);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    window.addEventListener("resize", function () {
      syncOffset();
      if (window.innerWidth > 1040) close();
    });

    syncOffset();

    // Submenu toggles (mobile only — desktop uses hover/focus)
    nav.querySelectorAll(".nav__item--has-menu > .nav__link").forEach(function (
      link
    ) {
      link.addEventListener("click", function (e) {
        if (window.innerWidth > 1040) return;
        e.preventDefault();
        link.parentElement.classList.toggle("is-open");
      });
    });
  }

  /* -------------------------------------------------------- Scroll reveals */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var delay = Number(el.dataset.delay || 0);
          window.setTimeout(function () {
            el.classList.add("is-visible");
          }, delay);
          io.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    items.forEach(function (el) {
      io.observe(el);
    });
  }

  /* -------------------------------------------------------- Stat counters */
  function initCounters() {
    var nums = document.querySelectorAll("[data-count]");
    if (!nums.length || !("IntersectionObserver" in window)) {
      nums.forEach(function (el) {
        el.textContent =
          (el.dataset.prefix || "") +
          el.dataset.count +
          (el.dataset.suffix || "");
      });
      return;
    }

    var run = function (el) {
      var target = Number(el.dataset.count) || 0;
      var prefix = el.dataset.prefix || "";
      var suffix = el.dataset.suffix || "";
      var duration = 1500;
      var start = null;

      var tick = function (ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + Math.round(target * eased) + suffix;
        if (p < 1) window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    };

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          run(entry.target);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );

    nums.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------------ FAQ */
  function initFaq() {
    document.querySelectorAll(".faq__q").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") === "true";
        var group = btn.closest(".faq");
        if (group && !open) {
          group.querySelectorAll('.faq__q[aria-expanded="true"]').forEach(
            function (other) {
              other.setAttribute("aria-expanded", "false");
            }
          );
        }
        btn.setAttribute("aria-expanded", open ? "false" : "true");
      });
    });
  }

  /* ---------------------------------------------------------- Testimonials */
  function initReviews() {
    var root = document.querySelector(".reviews");
    if (!root) return;

    var slides = Array.prototype.slice.call(root.querySelectorAll(".review"));
    var dots = Array.prototype.slice.call(root.querySelectorAll(".reviews__dot"));
    if (slides.length < 2) return;

    var index = 0;
    var timer = null;

    var show = function (i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) {
        s.classList.toggle("is-active", n === index);
      });
      dots.forEach(function (d, n) {
        d.setAttribute("aria-selected", n === index ? "true" : "false");
      });
    };

    var autoplay = function () {
      window.clearInterval(timer);
      timer = window.setInterval(function () {
        show(index + 1);
      }, 7000);
    };

    dots.forEach(function (dot, n) {
      dot.addEventListener("click", function () {
        show(n);
        autoplay();
      });
    });

    var prev = root.querySelector(".reviews__arrow--prev");
    var next = root.querySelector(".reviews__arrow--next");
    if (prev)
      prev.addEventListener("click", function () {
        show(index - 1);
        autoplay();
      });
    if (next)
      next.addEventListener("click", function () {
        show(index + 1);
        autoplay();
      });

    root.addEventListener("mouseenter", function () {
      window.clearInterval(timer);
    });
    root.addEventListener("mouseleave", autoplay);

    show(0);
    autoplay();
  }

  /* -------------------------------------------------------- Gallery filter */
  function initGallery() {
    var grid = document.querySelector(".gallery-grid");
    if (!grid) return;

    var shots = Array.prototype.slice.call(grid.querySelectorAll(".shot"));
    var filters = Array.prototype.slice.call(
      document.querySelectorAll(".filter")
    );

    filters.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cat = btn.dataset.filter;
        filters.forEach(function (f) {
          f.setAttribute("aria-pressed", f === btn ? "true" : "false");
        });
        shots.forEach(function (shot) {
          var match = cat === "all" || (shot.dataset.cat || "").split(" ").indexOf(cat) > -1;
          shot.classList.toggle("is-hidden", !match);
        });
      });
    });

    initLightbox(shots);
  }

  /* -------------------------------------------------------------- Lightbox */
  function initLightbox(shots) {
    var box = document.querySelector(".lightbox");
    if (!box || !shots.length) return;

    var stage = box.querySelector(".lightbox__stage");
    var meta = box.querySelector(".lightbox__meta");
    var current = 0;
    var lastFocus = null;

    var visibleShots = function () {
      return shots.filter(function (s) {
        return !s.classList.contains("is-hidden");
      });
    };

    var render = function (shot) {
      var figure = shot.querySelector(".ph, .media-img");
      stage.textContent = "";
      if (figure) stage.appendChild(figure.cloneNode(true));

      meta.textContent = "";
      var title = shot.querySelector(".shot__caption strong");
      var sub = shot.querySelector(".shot__caption span");
      if (title) {
        var t = document.createElement("strong");
        t.textContent = title.textContent;
        meta.appendChild(t);
      }
      if (sub) {
        var s = document.createElement("span");
        s.textContent = sub.textContent;
        meta.appendChild(s);
      }
    };

    var open = function (shot) {
      var list = visibleShots();
      current = list.indexOf(shot);
      render(shot);
      lastFocus = document.activeElement;
      box.classList.add("is-open");
      document.body.classList.add("nav-open");
      var closeBtn = box.querySelector(".lightbox__btn--close");
      if (closeBtn) closeBtn.focus();
    };

    var close = function () {
      box.classList.remove("is-open");
      document.body.classList.remove("nav-open");
      if (lastFocus) lastFocus.focus();
    };

    var step = function (dir) {
      var list = visibleShots();
      if (!list.length) return;
      current = (current + dir + list.length) % list.length;
      render(list[current]);
    };

    shots.forEach(function (shot) {
      shot.addEventListener("click", function () {
        open(shot);
      });
    });

    box.querySelector(".lightbox__btn--close").addEventListener("click", close);
    box.querySelector(".lightbox__btn--prev").addEventListener("click", function () {
      step(-1);
    });
    box.querySelector(".lightbox__btn--next").addEventListener("click", function () {
      step(1);
    });

    box.addEventListener("click", function (e) {
      if (e.target === box) close();
    });

    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });
  }

  /* ----------------------------------------------------------------- Forms */
  function initForms() {
    var emailRe = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

    document.querySelectorAll("form[data-lead-form]").forEach(function (form) {
      var showError = function (input, message) {
        var slot = form.querySelector('[data-error-for="' + input.name + '"]');
        if (slot) slot.textContent = message;
        input.setAttribute("aria-invalid", message ? "true" : "false");
      };

      var validate = function (input) {
        var value = (input.value || "").trim();

        if (input.type === "checkbox" && input.required && !input.checked) {
          showError(input, "Please confirm to continue.");
          return false;
        }
        if (input.required && input.type !== "checkbox" && !value) {
          showError(input, "This field is required.");
          return false;
        }
        if (input.type === "email" && value && !emailRe.test(value)) {
          showError(input, "Enter a valid email address.");
          return false;
        }
        if (input.type === "tel" && value && value.replace(/\D/g, "").length < 10) {
          showError(input, "Enter a 10-digit phone number.");
          return false;
        }
        showError(input, "");
        return true;
      };

      form.querySelectorAll("input, select, textarea").forEach(function (input) {
        input.addEventListener("blur", function () {
          validate(input);
        });
        input.addEventListener("input", function () {
          if (input.getAttribute("aria-invalid") === "true") validate(input);
        });
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();

        var fields = Array.prototype.slice.call(
          form.querySelectorAll("input, select, textarea")
        );
        var firstBad = null;

        fields.forEach(function (input) {
          if (!validate(input) && !firstBad) firstBad = input;
        });

        if (firstBad) {
          firstBad.focus();
          return;
        }

        // TODO: wire this up to a real endpoint (Formspree, Netlify Forms,
        // or your own handler). Submission is simulated client-side for now.
        var success = form.nextElementSibling;
        form.classList.add("is-submitted");
        if (success && success.classList.contains("form-success")) {
          success.classList.add("is-visible");
          success.setAttribute("tabindex", "-1");
          success.focus();
        }
      });
    });
  }

  /* ------------------------------------------------------------ Footer year */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  onReady(function () {
    initHeader();
    initNav();
    initReveal();
    initCounters();
    initFaq();
    initReviews();
    initGallery();
    initForms();
    initYear();
  });
})();
