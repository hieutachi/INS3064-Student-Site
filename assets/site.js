/* Shared, dependency-free behaviour for the INS3064 student portal. */
(function () {
  "use strict";

  var root = document.documentElement;
  var themeKey = "ins3064.theme";
  root.classList.add("js");

  /* ---- Theme ---- */
  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      var next = theme === "dark" ? "light" : "dark";
      button.setAttribute("aria-pressed", String(theme === "dark"));
      button.setAttribute("aria-label", "Switch to " + next + " theme");
      var label = button.querySelector("[data-theme-label]");
      if (label) label.textContent = theme === "dark" ? "Light" : "Dark";
    });
  }

  applyTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");

  document.addEventListener("click", function (event) {
    var themeButton = event.target.closest && event.target.closest("[data-theme-toggle]");
    if (themeButton) {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem(themeKey, next); } catch (_error) { /* storage may be blocked */ }
    }
  });

  /* ---- Active nav ---- */
  var section = window.location.pathname.match(/\/(sessions|ebook|slides|guides)\//);
  if (section) {
    var current = document.querySelector('[data-nav="' + section[1] + '"]');
    if (current) current.setAttribute("aria-current", "page");
  }

  /* ---- Reading progress ---- */
  var progress = document.querySelector("[data-reading-progress]");
  function updateProgress() {
    if (!progress) return;
    var distance = root.scrollHeight - root.clientHeight;
    var percent = distance > 0 ? Math.max(0, Math.min(100, root.scrollTop / distance * 100)) : 0;
    progress.style.width = percent + "%";
  }
  if (progress) {
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
  }

  /* ---- Scroll-triggered entrance animations ---- */
  if ("IntersectionObserver" in window) {
    var animatedEls = document.querySelectorAll(
      ".session-card, .resource-card, .stat, .flow-card, .part-block, .hero-actions .button-link"
    );
    animatedEls.forEach(function (el) {
      el.style.opacity = "0";
      el.style.transform = "translateY(16px)";
    });
    var entranceObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          el.style.transition = "opacity .45s cubic-bezier(0.22,1,0.36,1), transform .45s cubic-bezier(0.22,1,0.36,1)";
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          entranceObserver.unobserve(el);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
    animatedEls.forEach(function (el) { entranceObserver.observe(el); });
  }

  /* ---- Filter cards ---- */
  document.querySelectorAll("[data-filter]").forEach(function (input) {
    var selector = input.getAttribute("data-filter");
    var items = Array.prototype.slice.call(document.querySelectorAll(selector));
    var blocks = Array.prototype.slice.call(document.querySelectorAll("[data-part-block]"));
    var status = document.querySelector("[data-filter-status]");
    function filterItems() {
      var query = input.value.trim().toLocaleLowerCase("en");
      var shown = 0;
      items.forEach(function (item) {
        var match = !query || item.textContent.toLocaleLowerCase("en").indexOf(query) !== -1;
        item.hidden = !match;
        if (match) shown += 1;
      });
      blocks.forEach(function (block) {
        var visible = block.querySelectorAll(selector + ":not([hidden])").length;
        block.hidden = visible === 0;
      });
      if (status) status.textContent = shown + " session" + (shown === 1 ? "" : "s") + " shown";
    }
    input.addEventListener("input", filterItems);
    filterItems();
  });

  /* ---- TOC ---- */
  var toc = document.querySelector("[data-toc]");
  if (toc) {
    var wide = window.matchMedia("(min-width: 1081px)");
    function applyTocState(query) { toc.open = query.matches; }
    applyTocState(wide);
    if (wide.addEventListener) wide.addEventListener("change", applyTocState);
    else if (wide.addListener) wide.addListener(applyTocState);
    toc.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("a[href^='#']");
      if (link && !wide.matches) toc.open = false;
    });
  }

  /* ---- TOC active highlight ---- */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc a[href^='#']"));
  if (tocLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    var targets = [];
    tocLinks.forEach(function (link) {
      var target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (!target) return;
      byId[target.id] = link;
      targets.push(target);
    });
    var activeToc = null;
    var tocObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var link = byId[entry.target.id];
        if (!link || link === activeToc) return;
        if (activeToc) activeToc.removeAttribute("aria-current");
        link.setAttribute("aria-current", "true");
        activeToc = link;
      });
    }, { rootMargin: "-88px 0px -70% 0px", threshold: 0 });
    targets.forEach(function (target) { tocObserver.observe(target); });
  }

  /* ---- Copy code ---- */
  function selectListing(code) {
    try {
      var range = document.createRange();
      range.selectNodeContents(code);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function flashButton(button, message) {
    button.textContent = message;
    button.classList.add("is-done");
    window.setTimeout(function () {
      button.textContent = "Copy";
      button.classList.remove("is-done");
    }, 2400);
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest && event.target.closest("[data-code-copy]");
    if (!button) return;
    var figure = button.closest(".code-block");
    var code = figure && figure.querySelector("pre code");
    if (!code) return;
    function fallback() {
      flashButton(button, selectListing(code) ? "Selected \u2014 press Ctrl+C" : "Select the code, then Ctrl+C");
    }
    if (!navigator.clipboard) { fallback(); return; }
    navigator.clipboard.writeText(code.textContent)
      .then(function () { flashButton(button, "Copied"); })
      .catch(fallback);
  });

  /* ---- Card tilt micro-interaction ---- */
  document.addEventListener("mousemove", function (event) {
    var card = event.target.closest && event.target.closest(".session-card, .resource-card, .flow-card, .stat");
    if (!card) return;
    var rect = card.getBoundingClientRect();
    var x = (event.clientX - rect.left) / rect.width - 0.5;
    var y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = "translateY(-4px) perspective(600px) rotateY(" + (x * 3) + "deg) rotateX(" + (-y * 3) + "deg)";
  });
  document.addEventListener("mouseleave", function (event) {
    var card = event.target.closest && event.target.closest(".session-card, .resource-card, .flow-card, .stat");
    if (card) card.style.transform = "";
  }, true);

  /* ---- Slide deck ---- */
  var deck = document.querySelector("[data-deck]");
  if (!deck) return;
  var slides = Array.prototype.slice.call(deck.querySelectorAll("[data-slide]"));
  if (!slides.length) return;
  var select = document.querySelector("[data-deck-select]");
  var counter = document.querySelector("[data-deck-counter]");
  var bar = document.querySelector("[data-deck-progress]");
  var previous = document.querySelector("[data-deck-prev]");
  var nextButton = document.querySelector("[data-deck-next]");
  var modeButton = document.querySelector("[data-deck-mode]");
  var jumps = Array.prototype.slice.call(document.querySelectorAll("[data-deck-jump]"));
  var activeSlide = 0;
  var overview = false;

  function showSlide(index, updateHash) {
    activeSlide = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach(function (slide, i) {
      var isActive = i === activeSlide;
      slide.classList.toggle("is-active", isActive);
      slide.setAttribute("aria-hidden", String(!isActive && !overview));
      if (isActive) slide.setAttribute("data-current", "true");
      else slide.removeAttribute("data-current");
    });
    jumps.forEach(function (button, i) {
      if (i === activeSlide) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    if (select) select.value = String(activeSlide);
    if (counter) counter.textContent = (activeSlide + 1) + " / " + slides.length;
    if (bar) bar.style.width = ((activeSlide + 1) / slides.length * 100) + "%";
    if (previous) previous.disabled = activeSlide === 0;
    if (nextButton) nextButton.disabled = activeSlide === slides.length - 1;
    if (updateHash && history.replaceState) history.replaceState(null, "", "#slide-" + (activeSlide + 1));
    if (!overview) {
      slides[activeSlide].focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    var rail = jumps[activeSlide];
    if (rail && rail.scrollIntoView) rail.scrollIntoView({ block: "nearest" });
  }

  function setOverview(next) {
    overview = next;
    deck.classList.toggle("is-overview", overview);
    if (modeButton) {
      modeButton.setAttribute("aria-pressed", String(overview));
      modeButton.textContent = overview ? "Single slide" : "Overview";
    }
    slides.forEach(function (slide, i) {
      slide.classList.toggle("is-active", overview || i === activeSlide);
      slide.setAttribute("aria-hidden", String(!overview && i !== activeSlide));
    });
    if (!overview) showSlide(activeSlide, true);
  }

  if (previous) previous.addEventListener("click", function () { setOverview(false); showSlide(activeSlide - 1, true); });
  if (nextButton) nextButton.addEventListener("click", function () { setOverview(false); showSlide(activeSlide + 1, true); });
  if (select) select.addEventListener("change", function () { setOverview(false); showSlide(Number(select.value), true); });
  if (modeButton) modeButton.addEventListener("click", function () { setOverview(!overview); });
  jumps.forEach(function (button, index) {
    button.addEventListener("click", function () { setOverview(false); showSlide(index, true); });
  });
  slides.forEach(function (slide, index) {
    slide.addEventListener("click", function () { if (overview) { activeSlide = index; setOverview(false); } });
  });

  document.addEventListener("keydown", function (event) {
    if (/input|select|textarea/i.test(event.target.tagName)) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (["ArrowRight", "PageDown", "j", "J"].indexOf(event.key) !== -1) { setOverview(false); showSlide(activeSlide + 1, true); }
    if (["ArrowLeft", "PageUp", "k", "K"].indexOf(event.key) !== -1) { setOverview(false); showSlide(activeSlide - 1, true); }
    if (event.key === "Home") { setOverview(false); showSlide(0, true); }
    if (event.key === "End") { setOverview(false); showSlide(slides.length - 1, true); }
    if (event.key === "o" || event.key === "O") setOverview(!overview);
    if (event.key === "Escape" && overview) setOverview(false);
  });

  var hash = window.location.hash.match(/^#slide-(\d+)$/);
  showSlide(hash ? Number(hash[1]) - 1 : 0, false);
})();
