(() => {
  const BASE_PATH = "/raksadesign";
  const CASES_PATH = `${BASE_PATH}/cases/`;
  const HOME_PATH = `${BASE_PATH}/`;
  const HOME_SECTION_HASHES = new Set(["#servicos", "#faq", "#hero"]);

  function decodedSegment(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function setCaseDetailPath(url, slug) {
    url.pathname = `${BASE_PATH}/cases/${decodedSegment(slug)}/`;
  }

  function normalizedLabel(anchor) {
    return String(anchor.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function canonicalHomeHref(anchor) {
    const raw = anchor.getAttribute("href");
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return "";
    if (normalizedLabel(anchor) !== "home") return "";

    let url;
    try {
      url = new URL(raw, window.location.href);
    } catch {
      return "";
    }

    if (url.origin !== window.location.origin) return "";
    url.pathname = HOME_PATH;
    url.search = "";
    url.hash = "";
    return url.href;
  }

  function canonicalSectionHref(anchor) {
    const raw = anchor.getAttribute("href");
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return "";

    let url;
    try {
      url = new URL(raw, window.location.href);
    } catch {
      return "";
    }

    if (url.origin !== window.location.origin) return "";
    if (!HOME_SECTION_HASHES.has(url.hash)) return "";

    url.pathname = HOME_PATH;
    url.search = "";
    return url.href;
  }

  function canonicalCaseHref(anchor) {
    const raw = anchor.getAttribute("href");
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return "";

    let url;
    try {
      url = new URL(raw, window.location.href);
    } catch {
      return "";
    }

    if (url.origin !== window.location.origin) return "";

    const pathname = url.pathname.replace(/\/+$/, "");
    const nestedDetail = pathname.match(new RegExp(`^${BASE_PATH}/cases/cases/([^/]+)$`));
    const relativeDetail = pathname.match(new RegExp(`^${BASE_PATH}/cases/([^/]+)/([^/]+)$`));
    const detail = pathname.match(new RegExp(`^${BASE_PATH}/cases/([^/]+)$`));

    if (pathname === `${BASE_PATH}/cases` || pathname === `${BASE_PATH}/cases/cases`) {
      url.pathname = CASES_PATH;
      return url.href;
    }

    if (nestedDetail) {
      setCaseDetailPath(url, nestedDetail[1]);
      return url.href;
    }

    if (relativeDetail && relativeDetail[2] !== "cases") {
      setCaseDetailPath(url, relativeDetail[2]);
      return url.href;
    }

    if (pathname.match(new RegExp(`^${BASE_PATH}/cases/[^/]+/cases$`))) {
      url.pathname = CASES_PATH;
      return url.href;
    }

    if (detail && detail[1] !== "cases") {
      setCaseDetailPath(url, detail[1]);
      return url.href;
    }

    return "";
  }

  function canonicalInternalHref(anchor) {
    return canonicalHomeHref(anchor) || canonicalSectionHref(anchor) || canonicalCaseHref(anchor);
  }

  function normalizeAnchor(anchor) {
    const nextHref = canonicalInternalHref(anchor);
    if (!nextHref) return;
    if (anchor.href !== nextHref) anchor.href = nextHref;
    if (anchor.target && anchor.target !== "_self") anchor.removeAttribute("target");
  }

  function normalizeCaseLinks(root = document) {
    if (root.matches?.("a[href]")) normalizeAnchor(root);
    root.querySelectorAll?.("a[href]").forEach(normalizeAnchor);
  }

  function isCaseDetailPath() {
    return window.location.pathname.replace(/\/+$/, "").match(new RegExp(`^${BASE_PATH}/cases/[^/]+$`));
  }

  function injectRoutingStyle() {
    if (document.querySelector("[data-raksa-routing-style]")) return;

    const style = document.createElement("style");
    style.dataset.raksaRoutingStyle = "true";
    style.textContent = `
      #main a[data-reset="button"]:not([href]),
      #main a[data-reset="button"][aria-disabled="true"],
      #main [data-raksa-empty-case-nav="true"] {
        opacity: 0 !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);
  }

  function navigateTo(nextHref) {
    const url = new URL(nextHref);
    if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search && url.hash) {
      const target = document.querySelector(url.hash);
      history.pushState(null, "", url.href);
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }
    }

    window.location.assign(url.href);
  }

  function textOf(element) {
    return String(element.textContent || "").replace(/\s+/g, " ").trim();
  }

  function emptyCaseNavSlot(anchor, label) {
    const opposite = label === "Anterior" ? "Próximo" : "Anterior";
    const main = document.querySelector("#main");

    for (let node = anchor.parentElement; node && node !== main; node = node.parentElement) {
      const text = textOf(node);
      if (!text.includes(label) || text.includes(opposite)) continue;

      const rect = node.getBoundingClientRect();
      if (rect.width >= 120 && rect.height >= 90) return node;
    }

    return anchor;
  }

  function hideEmptyCaseNav() {
    if (!isCaseDetailPath()) return;
    injectRoutingStyle();

    document.querySelectorAll("#main a[data-reset='button']").forEach((anchor) => {
      const label = textOf(anchor);
      if (label !== "Anterior" && label !== "Próximo") return;

      const rawHref = anchor.getAttribute("href");
      if (rawHref) return;

      anchor.setAttribute("aria-disabled", "true");
      emptyCaseNavSlot(anchor, label).dataset.raksaEmptyCaseNav = "true";
    });
  }

  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = event.target.closest?.("a[href]");
      if (!anchor) return;

      const nextHref = canonicalInternalHref(anchor);
      if (!nextHref) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      navigateTo(nextHref);
    },
    true,
  );

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      normalizeCaseLinks();
      injectRoutingStyle();
      hideEmptyCaseNav();
    });
  } else {
    normalizeCaseLinks();
    injectRoutingStyle();
    hideEmptyCaseNav();
  }

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === "attributes") {
        normalizeCaseLinks(record.target);
        hideEmptyCaseNav();
        return;
      }

      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) normalizeCaseLinks(node);
      });
      hideEmptyCaseNav();
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["href"],
    childList: true,
    subtree: true,
  });

  window.setTimeout(() => normalizeCaseLinks(), 500);
  window.setTimeout(() => normalizeCaseLinks(), 1500);
  window.setTimeout(() => {
    normalizeCaseLinks();
    injectRoutingStyle();
    hideEmptyCaseNav();
  }, 3000);
})();
