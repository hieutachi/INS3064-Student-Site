/* Shared, dependency-free behaviour for the INS3064 student portal. */
(function () {
  "use strict";

  var root = document.documentElement;
  var themeKey = "ins3064.theme";
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    var frame = document.querySelector("[data-reader-frame]");
    try {
      if (frame && frame.contentDocument) frame.contentDocument.documentElement.setAttribute("data-theme", theme);
    } catch (_error) { /* A standalone page is always available. */ }
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
  var section = window.location.pathname.match(/\/(sessions|homework|ebook|slides|guides)\//);
  if (section) {
    var current = document.querySelector('[data-nav="' + section[1] + '"]');
    if (current) current.setAttribute("aria-current", "page");
  }


  /* ---- Hash-routed learning workspace; HTML pages remain the fallback. ---- */
  var spaViews = Array.prototype.slice.call(document.querySelectorAll("[data-spa-view]"));
  var spaLinks = Array.prototype.slice.call(document.querySelectorAll("[data-spa-nav]"));
  if (spaViews.length) {
    var portalTitle = document.title;
    var portalBase = new URL("./", window.location.href);
    var publishedPages = document.querySelector("[data-material-pages]").getAttribute("data-material-pages").split(" ");
    var frame = document.querySelector("[data-reader-frame]");
    var readerStatus = document.querySelector("[data-reader-status]");
    var readerTitle = document.querySelector("[data-reader-title]") || document.getElementById("reader-title");
    var originalLink = document.querySelector("[data-reader-original]");
    var completeButton = document.querySelector("[data-complete-session]");
    var focusButton = document.querySelector("[data-focus-toggle]");
    var progressKey = "ins3064.learning.v1";
    var learning = { completed: [], last: "" };
    var currentPath = "";
    var readerDocumentTitle = portalTitle;
    var currentSession = 0;
    var loadTimer;
    try {
      var saved = JSON.parse(localStorage.getItem(progressKey));
      if (saved && Array.isArray(saved.completed)) {
        learning.completed = saved.completed.filter(function (n, index, list) {
          return Number.isInteger(n) && n >= 1 && n <= 15 && list.indexOf(n) === index;
        });
        learning.last = typeof saved.last === "string" ? saved.last : "";
      }
    } catch (_error) { /* Private browsing and blocked storage still work. */ }

    function materialPath(href) {
      try {
        var url = new URL(href, portalBase);
        if (url.origin !== portalBase.origin || url.protocol !== portalBase.protocol || !url.pathname.startsWith(portalBase.pathname)) return "";
        var relative = url.pathname.slice(portalBase.pathname.length);
        if (!/^(?:(?:ebook|slides|sessions|guides)\/[a-z0-9-]+|homework\/(?:index|session-\d{2}\/homework))\.html$/.test(relative)) return "";
        // Only navigate to published links, never arbitrary paths from a hash.
        var published = publishedPages.indexOf(relative) !== -1;
        return published ? relative + url.hash : "";
      } catch (_error) { return ""; }
    }

    function saveLearning() {
      try { localStorage.setItem(progressKey, JSON.stringify(learning)); } catch (_error) { /* session-only fallback */ }
    }

    function updateLearning() {
      var count = learning.completed.length;
      var percent = Math.round(count / 15 * 100);
      var completionLabel = document.querySelector("[data-completion-label]");
      var completionPercent = document.querySelector("[data-completion-percent]");
      if (completionLabel) completionLabel.textContent = count + " of 15 sessions completed";
      if (completionPercent) completionPercent.textContent = percent + "%";
      var bar = document.querySelector("[data-completion-bar]");
      if (bar) {
        bar.setAttribute("aria-valuenow", String(count));
        bar.querySelector("span").style.width = percent + "%";
      }
      var last = materialPath(learning.last);
      var resume = document.querySelector("[data-resume-link]");
      var resumeCaption = document.querySelector("[data-resume-caption]");
      var nextTitle = document.querySelector("[data-next-step-title]");
      var nextCopy = document.querySelector("[data-next-step-copy]");
      var firstOpen = Array.prototype.slice.call(document.querySelectorAll("[data-session-item]"))
        .find(function (item) { return learning.completed.indexOf(Number(item.getAttribute("data-session-item"))) === -1; });
      var nextSession = firstOpen ? Number(firstOpen.getAttribute("data-session-item")) : 0;
      var lastSessionMatch = last.match(/(?:ebook|slides)\/(\d{2})-|sessions\/session-(\d{2})|homework\/session-(\d{2})/);
      var lastSession = lastSessionMatch ? Number(Array.prototype.slice.call(lastSessionMatch, 1).find(Boolean)) : 0;
      function sessionStatus(n) {
        return learning.completed.indexOf(n) !== -1 ? "completed" : n === lastSession ? "in-progress" : "not-started";
      }
      document.querySelectorAll("[data-session-state]").forEach(function (badge) {
        var state = sessionStatus(Number(badge.getAttribute("data-session-state")));
        badge.textContent = { completed: "✓ Completed", "in-progress": "In progress", "not-started": "Not started" }[state];
        badge.classList.toggle("is-complete", state === "completed");
      });
      document.querySelectorAll("[data-session-item]").forEach(function (item) {
        item.setAttribute("data-learning-status", sessionStatus(Number(item.getAttribute("data-session-item"))));
      });
      document.querySelectorAll("[data-part-progress]").forEach(function (label) {
        var cards = document.querySelectorAll('[data-session-card][data-part="' + label.getAttribute("data-part-progress") + '"]');
        var done = Array.prototype.filter.call(cards, function (card) {
          return learning.completed.indexOf(Number(card.querySelector("[data-session-state]").getAttribute("data-session-state"))) !== -1;
        }).length;
        label.textContent = done + " / " + cards.length + " complete · Open stage →";
      });
      if (last && lastSession && learning.completed.indexOf(lastSession) === -1) {
        resume.href = last;
        resume.textContent = "Continue Session " + String(lastSession).padStart(2, "0") + " →";
        if (resumeCaption) resumeCaption.textContent = "Pick up where you left off. Your progress is saved on this device.";
        var lastItem = document.querySelector('[data-session-item="' + lastSession + '"]');
        if (nextTitle) nextTitle.textContent = "Continue: " + lastItem.getAttribute("data-session-title");
        if (nextCopy) nextCopy.textContent = "You do not need to restart. Continue the lesson, try the example locally, and mark the session complete when it feels clear.";
      } else if (nextSession) {
        resume.href = "sessions/session-" + String(nextSession).padStart(2, "0") + ".html";
        resume.textContent = "Start Session " + String(nextSession).padStart(2, "0") + " →";
        if (resumeCaption) resumeCaption.textContent = count ? "Your next unfinished session is ready. Progress stays on this device." : "Start small: your progress is saved automatically on this device.";
        if (nextTitle) nextTitle.textContent = count ? "Up next: " + firstOpen.getAttribute("data-session-title") : "Start with the server, not the stress.";
        if (nextCopy) nextCopy.textContent = count ? "Build on what you already know. Read the next chapter, run the examples, and leave with one working result." : "Read one example, run it locally, then change one thing. The course gets easier when every session leaves you with something working.";
      } else {
        resume.href = "#course";
        resume.textContent = "Review the course map →";
        if (resumeCaption) resumeCaption.textContent = "You completed all 15 sessions. Revisit any chapter whenever you need a refresher.";
        if (nextTitle) nextTitle.textContent = "Course complete. Keep building.";
        if (nextCopy) nextCopy.textContent = "Take a breath, review the course map, and choose the project or topic you want to strengthen next.";
      }
      var done = learning.completed.indexOf(currentSession) !== -1;
      completeButton.hidden = !currentSession;
      completeButton.setAttribute("aria-pressed", String(done));
      completeButton.textContent = done ? "✓ Completed · Undo" : "Mark session complete";
      document.dispatchEvent(new Event("ins3064:learning-updated"));
    }

    function showSpaView(name, focus) {
      var allowed = spaViews.some(function (view) { return view.getAttribute("data-spa-view") === name; });
      var active = allowed ? name : "dashboard";
      spaViews.forEach(function (view) {
        var isActive = view.getAttribute("data-spa-view") === active;
        view.hidden = !isActive;
        view.classList.toggle("is-active", isActive);
      });
      spaLinks.forEach(function (link) {
        var sectionName = currentPath.split("/")[0];
        var readerSection = { ebook: "library", slides: "resources", sessions: "course", homework: "homework", guides: "guides" }[sectionName];
        var isActive = link.getAttribute("data-spa-nav") === (active === "reader" ? readerSection : active);
        link.classList.toggle("is-active", isActive);
        if (isActive) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
      document.querySelectorAll(".primary-nav [data-nav]").forEach(function (link) {
        var navView = { home: "dashboard", sessions: "course", ebook: "library", homework: "homework", guides: "guides", slides: "resources" }[link.getAttribute("data-nav")];
        if (navView === active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
      document.body.classList.toggle("is-reading", active === "reader");
      if (active === "reader") document.title = readerDocumentTitle;
      if (active !== "reader") {
        document.title = portalTitle;
        document.body.classList.remove("is-focused");
        focusButton.setAttribute("aria-pressed", "false");
        focusButton.textContent = "Focus mode";
      }
      if (focus) {
        var heading = document.querySelector('[data-spa-view="' + active + '"] h2');
        if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
        window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
      }
    }

    function openMaterial(href) {
      var relative = materialPath(href);
      if (!relative) return false;
      window.location.hash = "reader=" + encodeURIComponent(relative);
      return true;
    }
    // Embedded documents use their existing code-copy, TOC and deck controls.
    // Only cross-document navigation is handed back to the workspace.
    window.ins3064OpenMaterial = openMaterial;
    window.ins3064GoHome = function () { window.location.hash = "dashboard"; };
    window.ins3064ExitFocus = function () {
      if (document.body.classList.contains("is-focused")) focusButton.click();
    };

    function route(focus) {
      var hash = window.location.hash.slice(1) || "dashboard";
      if (/^part-[1-4]$/.test(hash)) {
        showSpaView("course", false);
        var partHeading = document.querySelector("#" + hash + " h2");
        partHeading.setAttribute("tabindex", "-1");
        partHeading.focus({ preventScroll: true });
        partHeading.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
        return;
      }
      if (hash.startsWith("reader=")) {
        var requested = "";
        try { requested = decodeURIComponent(hash.slice(7)); } catch (_error) { /* invalid URL */ }
        var relative = materialPath(requested);
        if (relative) {
          currentSession = Number((relative.match(/(?:ebook|slides)\/(\d{2})-|sessions\/session-(\d{2})|homework\/session-(\d{2})/) || []).slice(1).find(Boolean)) || 0;
          learning.last = relative;
          saveLearning();
          if (currentPath !== relative) {
            currentPath = relative;
            frame.hidden = true;
            readerStatus.hidden = false;
            readerStatus.textContent = "Loading your learning material…";
            originalLink.href = relative;
            readerTitle.textContent = "Learning material";
            readerDocumentTitle = portalTitle;
            frame.src = new URL(relative, portalBase).href;
            window.clearTimeout(loadTimer);
            loadTimer = window.setTimeout(function () {
              readerStatus.textContent = "Taking longer than expected? Use ‘Open page’ to read the original document.";
            }, 10000);
          }
          updateLearning();
          showSpaView("reader", focus);
          return;
        }
        window.history.replaceState(null, "", "#library");
        hash = "library";
      }
      showSpaView(hash, focus);
    }

    frame.addEventListener("load", function () {
      if (!currentPath) return;
      window.clearTimeout(loadTimer);
      try {
        var doc = frame.contentDocument;
        if (!doc || !doc.getElementById("main")) throw new Error("Missing document");
        doc.body.classList.add("embedded-page");
        doc.documentElement.setAttribute("data-theme", root.getAttribute("data-theme"));
        var heading = doc.querySelector("h1");
        var title = heading ? heading.textContent : doc.title.split(" — ")[0];
        readerTitle.textContent = title;
        frame.title = title;
        readerDocumentTitle = doc.title;
        if (window.location.hash.startsWith("#reader=")) document.title = doc.title;
        readerStatus.hidden = true;
        frame.hidden = false;
      } catch (_error) {
        // file:// restrictions vary between browsers; use the standalone link.
        readerStatus.textContent = "This browser cannot embed the local document. Use ‘Open page’, or serve the site over HTTP.";
      }
    });
    completeButton.addEventListener("click", function () {
      if (!currentSession) return;
      var index = learning.completed.indexOf(currentSession);
      if (index === -1) learning.completed.push(currentSession);
      else learning.completed.splice(index, 1);
      saveLearning();
      updateLearning();
    });
    focusButton.addEventListener("click", function () {
      var focused = document.body.classList.toggle("is-focused");
      focusButton.setAttribute("aria-pressed", String(focused));
      focusButton.textContent = focused ? "Exit focus" : "Focus mode";
    });
    document.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("a[href]");
      if (!link || link.target || link.hasAttribute("download") || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (link.closest(".primary-nav")) {
        var view = { home: "dashboard", sessions: "course", ebook: "library", homework: "homework", guides: "guides" }[link.getAttribute("data-nav")];
        if (view) { event.preventDefault(); window.location.hash = view; return; }
      }
      if (openMaterial(link.href)) event.preventDefault();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { window.ins3064ExitFocus(); return; }
      if (/input|textarea|select/i.test(event.target.tagName) || event.target.isContentEditable || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "/") {
        event.preventDefault();
        window.location.hash = "library";
        window.setTimeout(function () { document.getElementById("chapter-search").focus(); }, 0);
      }
    });
    updateLearning();
    route(false);
    window.addEventListener("hashchange", function () { route(true); });
  }

  /* ---- Personal self-checks: separate from completion and LMS grades. ---- */
  var studyChecks = Array.prototype.slice.call(document.querySelectorAll("[data-study-check]"));
  if (studyChecks.length) {
    var checkKey = "ins3064.self-checks.v1";
    var savedChecks = {};
    var checkStorage = true;
    var checkStatus = document.querySelector("[data-check-storage-status]");
    try {
      var parsedChecks = JSON.parse(localStorage.getItem(checkKey));
      if (parsedChecks && typeof parsedChecks === "object" && !Array.isArray(parsedChecks)) {
        Object.keys(parsedChecks).forEach(function (key) {
          if (/^(?:0[1-9]|1[0-5])-[12]$/.test(key) && parsedChecks[key] === true) savedChecks[key] = true;
        });
      }
    } catch (_error) { checkStorage = false; }
    function reportChecks() {
      var checked = studyChecks.filter(function (input) { return input.checked; }).length;
      checkStatus.textContent = checked + " of " + studyChecks.length + " checked · " + (checkStorage ? "Saved in this browser, not submitted to LMS." : "Storage unavailable. Ticks last only while this page stays open.");
    }
    studyChecks.forEach(function (input) {
      input.checked = savedChecks[input.getAttribute("data-study-check")] === true;
      input.addEventListener("change", function () {
        var key = input.getAttribute("data-study-check");
        if (input.checked) savedChecks[key] = true;
        else delete savedChecks[key];
        try { localStorage.setItem(checkKey, JSON.stringify(savedChecks)); checkStorage = true; }
        catch (_error) { checkStorage = false; }
        reportChecks();
      });
    });
    reportChecks();
  }

  if (window.parent !== window) {
    document.body.classList.add("embedded-page");
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      try {
        if (window.parent.ins3064ExitFocus) window.parent.ins3064ExitFocus();
      } catch (_error) { /* Cross-origin embedding has no workspace controls. */ }
    });
    document.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("a[href]");
      if (!link || link.target || link.hasAttribute("download") || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      var url = new URL(link.href);
      if (url.pathname === window.location.pathname && url.hash) return;
      try {
        if (window.parent.ins3064OpenMaterial && window.parent.ins3064OpenMaterial(url.href)) event.preventDefault();
        else if (/\/index\.html$/.test(url.pathname) && url.pathname === new URL("./index.html", window.parent.location.href).pathname) {
          event.preventDefault(); window.parent.ins3064GoHome();
        }
      } catch (_error) { /* Standalone links remain usable. */ }
    });
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
  if ("IntersectionObserver" in window && !reducedMotion) {
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
    var scope = input.closest("[data-filter-scope]") || document;
    var items = Array.prototype.slice.call(scope.querySelectorAll(selector));
    var blocks = Array.prototype.slice.call(scope.querySelectorAll("[data-part-block]"));
    var status = scope.querySelector("[data-filter-status]");
    var empty = scope.querySelector("[data-filter-empty]");
    var partFilter = scope.querySelector("[data-filter-part]");
    var learningFilter = scope.querySelector("[data-filter-learning]");
    var reset = scope.querySelector("[data-filter-reset]");
    var filters = scope.querySelector("[data-library-filters]");
    if (filters) filters.hidden = false;
    function filterItems() {
      var query = input.value.trim().toLocaleLowerCase("en");
      var shown = 0;
      items.forEach(function (item) {
        var text = item.textContent + " " + (item.getAttribute("data-search-text") || "");
        var match = (!query || text.toLocaleLowerCase("en").indexOf(query) !== -1) &&
          (!partFilter || !partFilter.value || item.getAttribute("data-part") === partFilter.value) &&
          (!learningFilter || !learningFilter.value || item.getAttribute("data-learning-status") === learningFilter.value);
        item.hidden = !match;
        if (match) shown += 1;
      });
      blocks.forEach(function (block) {
        var visible = block.querySelectorAll(selector + ":not([hidden])").length;
        block.hidden = visible === 0;
      });
      if (status) status.textContent = shown + " session" + (shown === 1 ? "" : "s") + " shown";
      if (empty) empty.hidden = shown !== 0;
    }
    input.addEventListener("input", filterItems);
    if (partFilter) partFilter.addEventListener("change", filterItems);
    if (learningFilter) learningFilter.addEventListener("change", filterItems);
    if (reset) reset.addEventListener("click", function () {
      input.value = "";
      partFilter.value = "";
      learningFilter.value = "";
      filterItems();
      input.focus();
    });
    document.addEventListener("ins3064:learning-updated", filterItems);
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
