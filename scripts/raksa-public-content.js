(() => {
  const PAGE_BASE = "/raksadesign";
  const CASES_PATH = `${PAGE_BASE}/cases/`;
  const CASE_TEMPLATE_PATH = `${PAGE_BASE}/cases/atitus-educação/`;
  const CASE_WEBSITE_BUTTON_TEMPLATE_PATH = `${PAGE_BASE}/cases/paula-and-domenick/`;
  const BASIC_COLUMNS = "id,slug,title,tags,description,cover,images,updated_at";
  const EXTENDED_COLUMNS = `${BASIC_COLUMNS},excerpt,published,featured_on_home,home_order,content_blocks,created_at`;
  const FULL_COLUMNS = `${EXTENDED_COLUMNS},external_url`;
  const TAGS = ["Todos", "UI/UX Design", "Desenvolvimento", "Branding", "Editorial"];

  const config = window.RAKSA_SUPABASE || {};
  const hasConfig = Boolean(config.url && config.anonKey);
  let metricsStarted = false;
  let caseFiltersBound = false;
  let activeCaseFilter = "Todos";
  let contentGuardObserver = null;
  let contentGuardTimer = 0;
  let partialFilterControls = [];
  let caseTemplatePromise = null;
  let caseWebsiteButtonTemplatePromise = null;
  let dynamicCaseRenderingSlug = "";

  function sitePath(pathname = window.location.pathname) {
    if (pathname === PAGE_BASE) return "/";
    if (pathname.startsWith(`${PAGE_BASE}/`)) return pathname.slice(PAGE_BASE.length);
    return pathname;
  }

  function isCasesRoute() {
    return sitePath().replace(/\/+$/, "") === "/cases";
  }

  function isHomeRoute() {
    return sitePath().replace(/\/+$/, "") === "";
  }

  function caseSlugFromPath() {
    const match = sitePath().match(/^\/cases\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]).normalize("NFC") : "";
  }

  function routeType() {
    if (isHomeRoute()) return "home";
    if (isCasesRoute()) return "cases_index";
    if (caseSlugFromPath()) return "case_detail";
    return "page";
  }

  function internalPathFromUrl(url) {
    if (url.origin !== window.location.origin) return "";
    return sitePath(url.pathname);
  }

  function caseSlugFromUrl(url) {
    const match = internalPathFromUrl(url).match(/^\/cases\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]).normalize("NFC") : "";
  }

  function shortText(value = "", maxLength = 220) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setTextContent(element, value = "") {
    if (!element) return;
    element.textContent = value;
  }

  function cleanMetadata(metadata = {}) {
    return Object.fromEntries(
      Object.entries(metadata)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => {
          if (typeof value === "string") return [key, shortText(value, 500)];
          if (typeof value === "number" || typeof value === "boolean" || value === null) return [key, value];
          return [key, value];
        }),
    );
  }

  function referrerMetadata() {
    if (!document.referrer) return {};

    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin === window.location.origin) return { referrer_path: sitePath(referrer.pathname) };
      return { referrer_host: referrer.hostname };
    } catch {
      return {};
    }
  }

  function normalizeAssetUrl(value = "") {
    if (value.startsWith("/framerusercontent.com/") || value.startsWith("/vendor/")) return `${PAGE_BASE}${value}`;
    return value;
  }

  function caseExternalUrl(item = {}) {
    return String(item.external_url || item.externalUrl || item.website || item.link || "").trim();
  }

  function caseUrl(slug) {
    return `${PAGE_BASE}/cases/${encodeURIComponent(String(slug || "").normalize("NFC"))}/`;
  }

  async function rest(table, params) {
    const url = new URL(`/rest/v1/${table}`, config.url);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const response = await fetch(url, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || response.statusText);
    }

    return response.json();
  }

  function trackMetric(eventName, metadata = {}) {
    if (!hasConfig) return;

    const payload = {
      event_name: shortText(eventName, 120),
      path: sitePath(),
      metadata: cleanMetadata({
        route_type: routeType(),
        title: document.title,
        ...metadata,
      }),
    };

    fetch(new URL("/rest/v1/metrics_events", config.url), {
      method: "POST",
      keepalive: true,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    }).catch((error) => {
      console.warn("[RAKSA] Metrics event unavailable:", error);
    });
  }

  function isWhatsappUrl(url) {
    const href = url.href.toLowerCase();
    return url.protocol === "whatsapp:" || href.includes("wa.me/") || href.includes("api.whatsapp.com") || href.includes("web.whatsapp.com");
  }

  function trackPageView() {
    trackMetric("page_view", {
      case_slug: caseSlugFromPath(),
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      ...referrerMetadata(),
    });
  }

  function trackPublicClick(event) {
    const anchor = event.target.closest?.("a[href]");
    if (!anchor) return;

    let url;
    try {
      url = new URL(anchor.getAttribute("href"), window.location.href);
    } catch {
      return;
    }

    if (isWhatsappUrl(url)) {
      trackMetric("whatsapp_click", {
        label: shortText(anchor.textContent),
        target_host: url.hostname,
      });
      return;
    }

    const caseSlug = caseSlugFromUrl(url);
    if (caseSlug) {
      trackMetric("case_click", {
        case_slug: caseSlug,
        label: shortText(anchor.getAttribute("aria-label") || anchor.textContent),
        target_path: internalPathFromUrl(url),
      });
    }
  }

  function trackPublicSubmit(event) {
    const form = event.target.closest?.("form");
    if (!form) return;

    trackMetric("form_submit", {
      form_id: form.id,
      form_name: form.getAttribute("name"),
      action: form.getAttribute("action") || window.location.pathname,
      method: (form.getAttribute("method") || "get").toLowerCase(),
    });
  }

  function startMetrics() {
    if (!hasConfig || metricsStarted) return;
    metricsStarted = true;

    trackPageView();
    document.addEventListener("click", trackPublicClick, true);
    document.addEventListener("submit", trackPublicSubmit, true);
  }

  async function loadCases() {
    try {
      return await rest("cases", {
        select: FULL_COLUMNS,
        published: "eq.true",
        order: "home_order.asc,title.asc",
      });
    } catch (error) {
      if (!/column|schema cache|does not exist/i.test(error.message || "")) throw error;
      try {
        return await rest("cases", {
          select: EXTENDED_COLUMNS,
          published: "eq.true",
          order: "home_order.asc,title.asc",
        });
      } catch (fallbackError) {
        if (!/column|schema cache|does not exist/i.test(fallbackError.message || "")) throw fallbackError;
        return rest("cases", {
          select: BASIC_COLUMNS,
          order: "title.asc",
        });
      }
    }
  }

  async function loadLocalCases() {
    const response = await fetch(`${PAGE_BASE}/admin/data/cases.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(response.statusText);
    const rows = await response.json();
    return rows.map((item) => ({
      ...item,
      external_url: caseExternalUrl(item),
      featured_on_home: item.featured_on_home ?? item.featuredOnHome ?? false,
      home_order: item.home_order ?? item.homeOrder ?? 999,
      published: item.published ?? true,
      updated_at: item.updated_at ?? item.updatedAt ?? "",
    }));
  }

  function normalizedCase(item) {
    return {
      ...item,
      id: String(item.id || "").normalize("NFC"),
      slug: String(item.slug || "").normalize("NFC"),
      cover: normalizeAssetUrl(item.cover || ""),
      images: (item.images || []).map(normalizeAssetUrl),
      tags: item.tags || [],
      excerpt: item.excerpt || item.description || "",
      featured_on_home: item.featured_on_home ?? false,
      home_order: item.home_order ?? 999,
      external_url: caseExternalUrl(item),
    };
  }

  function normalizeSlug(value = "") {
    let slug = String(value || "");
    try {
      slug = decodeURIComponent(slug);
    } catch {
      // Keep the original value if Framer gives us an already-partial slug.
    }

    return slug.normalize("NFC").replace(/^\/+|\/+$/g, "");
  }

  function caseBySlug(cases) {
    const map = new Map();
    cases.forEach((item) => {
      if (item.slug) map.set(normalizeSlug(item.slug), item);
    });
    return map;
  }

  function caseSlugFromAnchor(anchor) {
    let url;
    try {
      url = new URL(anchor.getAttribute("href") || "", window.location.href);
    } catch {
      return "";
    }

    if (url.origin !== window.location.origin) return "";

    const nestedMatch = sitePath(url.pathname).match(/^\/cases\/cases\/([^/]+)\/?$/);
    if (nestedMatch) return normalizeSlug(nestedMatch[1]);

    const match = sitePath(url.pathname).match(/^\/cases\/([^/]+)\/?$/);
    if (!match || match[1] === "cases") return "";
    return normalizeSlug(match[1]);
  }

  function isInsideSiteChrome(element) {
    if (element.closest?.("[data-raksa-case-filters='true']")) return false;

    for (let node = element; node && node !== document.body; node = node.parentElement) {
      const name = String(node.getAttribute?.("data-framer-name") || "").toLowerCase();
      if (node.matches?.("header, footer, nav")) return true;
      if (name === "header" || name === "footer" || name === "menu") return true;
      if (name.includes("header") || name.includes("footer")) return true;
    }
    return false;
  }

  function isCaseCardAnchor(anchor) {
    const main = document.querySelector("#main");
    if (main && !main.contains(anchor)) return false;
    if (!caseSlugFromAnchor(anchor)) return false;
    if (isInsideSiteChrome(anchor)) return false;
    return Boolean(anchor.querySelector("img"));
  }

  function caseCardAnchors() {
    const root = document.querySelector("#main") || document;
    return Array.from(root.querySelectorAll("a[href]")).filter(isCaseCardAnchor);
  }

  function groupedCards(cards) {
    const groups = [];
    const seen = new Set();
    cards.forEach((card) => {
      const parent = card.parentElement;
      if (!parent || seen.has(parent)) return;
      seen.add(parent);
      groups.push(cards.filter((item) => item.parentElement === parent));
    });
    return groups;
  }

  function tagsFor(item) {
    return Array.isArray(item?.tags) ? item.tags.map((tag) => String(tag || "").trim()).filter(Boolean) : [];
  }

  function annotateCaseCard(anchor, item, slug = item?.slug || caseSlugFromAnchor(anchor)) {
    if (!slug) return;
    anchor.dataset.raksaCaseCard = "true";
    anchor.dataset.raksaCaseFilterable = "true";
    delete anchor.dataset.raksaCaseHomeExcluded;
    anchor.dataset.raksaCaseSlug = slug;
    anchor.dataset.raksaCaseTags = tagsFor(item).join("|");
    anchor.href = caseUrl(slug);
    if (item?.title) anchor.setAttribute("aria-label", item.title);
    if (item) {
      updateCardCover(anchor, item);
      updateDynamicCardTitle(anchor, item);
      updateCardBadges(anchor, item);
      if (anchor.dataset.raksaDynamicCard === "true") {
        ensureDynamicCardOverlay(anchor, item);
      }
    }
  }

  function updateDynamicCardTitle(anchor, item) {
    if (!item?.title) return;
    const textNodes = Array.from(anchor.querySelectorAll("p, h1, h2, h3, h4, h5, h6"))
      .filter((node) => {
        const text = shortText(node.textContent, 90);
        return text && !TAGS.includes(text) && !node.querySelector("img");
      })
      .sort((a, b) => shortText(b.textContent, 90).length - shortText(a.textContent, 90).length);

    if (textNodes[0]) textNodes[0].textContent = item.title;
  }

  function updateCardBadges(anchor, item) {
    const tags = tagsFor(item);
    anchor.querySelectorAll("[data-framer-name='badge']").forEach((badge, index) => {
      const tag = tags[index];
      const textNode = Array.from(badge.querySelectorAll("p, h1, h2, h3, h4, h5, h6"))
        .find((node) => shortText(node.textContent, 90));
      if (tag) {
        if (textNode) textNode.textContent = tag;
        badge.hidden = false;
        badge.style.display = "";
      } else {
        badge.hidden = true;
        badge.style.display = "none";
      }
    });
  }

  function ensureDynamicCardOverlay(anchor, item) {
    anchor.querySelectorAll(".raksa-dynamic-card-overlay, .raksa-dynamic-framer-hover, .raksa-dynamic-framer-blur")
      .forEach((node) => node.remove());
    const cardShell = anchor.querySelector("[data-framer-name='Variant 1']") || anchor;

    const overlay = document.createElement("div");
    overlay.className = "framer-1hjnzcb raksa-dynamic-framer-hover";
    overlay.dataset.framerName = "Location";
    overlay.innerHTML = `
      <div class="framer-12pffjj" data-framer-name="Top">
        <div class="framer-154ku1h" data-framer-component-type="RichTextContainer" style="--framer-link-text-color:rgb(0, 153, 255);--framer-link-text-decoration:underline;text-shadow:rgb(0, 0, 0) 1px 1px 15px;will-change:transform;opacity:1;transform:none">
          <p class="framer-text framer-styles-preset-1wztk85" data-styles-preset="FC000Yg_M" style="--framer-text-alignment:center;">${escapeHtml(item.title || item.slug)}</p>
        </div>
      </div>
      <div class="framer-163e9mi" style="will-change:transform;opacity:1;transform:none">
        <div class="framer-196ls8" data-border="true" data-framer-name="badge" style="--border-bottom-width:1px;--border-color:rgba(255, 255, 255, 0.2);--border-left-width:1px;--border-right-width:1px;--border-style:solid;--border-top-width:1px;background-color:rgba(54, 54, 54, 0.2);border-radius:1000px;opacity:1;">
          <div class="framer-1ly6p7u" data-framer-name="Heading" data-framer-component-type="RichTextContainer" style="justify-content:center;--extracted-r6o4lv:var(--token-eb7a4d4b-ecab-4fea-8d34-73063eb2b1f1, rgb(255, 255, 255));--framer-paragraph-spacing:0px;transform:none;opacity:1;">
            <p class="framer-text framer-styles-preset-1bpsbw4" data-styles-preset="WK2SQ_2kV" style="--framer-text-alignment:left;--framer-text-color:var(--extracted-r6o4lv, var(--token-eb7a4d4b-ecab-4fea-8d34-73063eb2b1f1, rgb(255, 255, 255)));">${escapeHtml(tagsFor(item)[0] || "Case")}</p>
          </div>
        </div>
      </div>
    `;

    const blur = document.createElement("div");
    blur.className = "framer-k46fe6-container raksa-dynamic-framer-blur";
    blur.innerHTML = `
      <div style="position:relative;width:100%;height:100%;border-radius:30px;">
        ${[0.1875, 0.375, 0.75, 1.5, 3, 6, 12, 24].map((blurValue, index) => {
          const start = index * 12.5;
          const mid = (index + 1) * 12.5;
          const end = Math.min(100, (index + 3) * 12.5);
          const mask = index === 7
            ? `linear-gradient(rgba(0, 0, 0, 0) 87.5%, rgb(0, 0, 0) 100%)`
            : `linear-gradient(rgba(0, 0, 0, 0) ${start}%, rgb(0, 0, 0) ${mid}%, rgb(0, 0, 0) ${Math.min(100, mid + 12.5)}%, rgba(0, 0, 0, 0) ${end}%)`;
          return `<div style="position:absolute;inset:0;z-index:${index + 1};backdrop-filter:blur(${blurValue}px);-webkit-backdrop-filter:blur(${blurValue}px);mask-image:${mask};-webkit-mask-image:${mask};border-radius:30px;pointer-events:none;"></div>`;
        }).join("")}
      </div>
    `;
    cardShell.appendChild(overlay);
    cardShell.appendChild(blur);
  }

  function ensureCaseIndexCards(cases) {
    const cards = caseCardAnchors();
    if (!cards.length) return cards;

    const existingSlugs = new Set(cards.map(caseSlugFromAnchor).filter(Boolean));
    const missing = cases.filter((item) => item.slug && !existingSlugs.has(normalizeSlug(item.slug)));
    if (!missing.length) return cards;

    groupedCards(cards).forEach((group) => {
      const parent = group[0]?.parentElement;
      const template = group[group.length - 1];
      if (!parent || !template) return;

      missing.forEach((item) => {
        const clone = template.cloneNode(true);
        clone.dataset.raksaDynamicCard = "true";
        annotateCaseCard(clone, item, item.slug);
        parent.appendChild(clone);
      });
    });

    return caseCardAnchors();
  }

  function annotateCaseCards(cases) {
    const map = caseBySlug(cases);
    const cards = ensureCaseIndexCards(cases);

    cards.forEach((anchor) => {
      const slug = caseSlugFromAnchor(anchor);
      const item = map.get(slug);
      annotateCaseCard(anchor, item, slug);
    });

    return cards;
  }

  function injectEnhancementStyle() {
    if (document.querySelector("[data-raksa-public-content-style]")) return;
    const style = document.createElement("style");
    style.dataset.raksaPublicContentStyle = "true";
    style.textContent = `
      .raksa-case-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        grid-column: 1 / -1;
        margin: 0 0 20px;
        position: relative;
        width: 100%;
        z-index: 2;
      }
      .raksa-case-filter {
        appearance: none;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 999px;
        color: rgba(255, 255, 255, 0.72);
        cursor: pointer;
        font: inherit;
        font-size: 14px;
        line-height: 1;
        min-height: 38px;
        padding: 0 16px;
        transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
      }
      .raksa-case-filter.is-active {
        background: rgba(139, 81, 255, 0.18);
        border-color: rgba(139, 81, 255, 0.62);
        color: #fff;
      }
      #main a[data-raksa-case-card][hidden] { display: none !important; }
      #main a[data-raksa-dynamic-card] {
        filter: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
      #main a[data-raksa-dynamic-card] > :not(.raksa-dynamic-framer-hover):not(.raksa-dynamic-framer-blur) {
        opacity: 1 !important;
        transform: none !important;
      }
      #main a[data-raksa-dynamic-card] {
        isolation: isolate;
        overflow: hidden;
        position: relative;
      }
      #main a[data-raksa-dynamic-card] .raksa-dynamic-framer-hover {
        background: linear-gradient(180deg, rgba(22, 6, 41, 0) 0%, var(--token-62aa78d2-963e-44c5-9eb4-156169cb3e7f, rgb(22, 6, 41)) 100%);
        opacity: 0 !important;
        pointer-events: none;
        transition: opacity 250ms cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 6;
      }
      #main a[data-raksa-dynamic-card] .raksa-dynamic-framer-blur {
        opacity: 0 !important;
        pointer-events: none;
        transition: opacity 250ms cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 5;
      }
      #main a[data-raksa-dynamic-card]:hover .raksa-dynamic-framer-hover,
      #main a[data-raksa-dynamic-card]:focus-visible .raksa-dynamic-framer-hover,
      #main a[data-raksa-dynamic-card]:hover .raksa-dynamic-framer-blur,
      #main a[data-raksa-dynamic-card]:focus-visible .raksa-dynamic-framer-blur {
        opacity: 1 !important;
      }
      .raksa-dynamic-case-loading {
        background: #0b0312;
        min-height: 100vh;
      }
      #main[data-raksa-dynamic-case-slug] a[data-raksa-framer-button-component] {
        cursor: pointer;
        text-decoration: none;
      }
      #main[data-raksa-dynamic-case-slug] a[data-raksa-framer-button-component] [data-framer-name="Fill"] {
        --border-color: var(--token-245d0ec3-831e-4505-88ff-21ba98a952c3, rgba(255, 255, 255, 0.15)) !important;
        background-color: rgba(139, 81, 255, 0) !important;
        box-shadow: none;
        opacity: 1 !important;
        transition: background-color 800ms cubic-bezier(0, 0, 1, 1), border-color 800ms cubic-bezier(0, 0, 1, 1), box-shadow 800ms cubic-bezier(0, 0, 1, 1);
      }
      #main[data-raksa-dynamic-case-slug] a[data-raksa-framer-button-component] [data-framer-name="Fill"]::after {
        transition: border-color 800ms cubic-bezier(0, 0, 1, 1);
      }
      #main[data-raksa-dynamic-case-slug] a[data-raksa-framer-button-component] svg {
        --4i27ky: var(--token-eb7a4d4b-ecab-4fea-8d34-73063eb2b1f1, rgb(255, 255, 255)) !important;
        color: var(--token-eb7a4d4b-ecab-4fea-8d34-73063eb2b1f1, rgb(255, 255, 255)) !important;
      }
      #main[data-raksa-dynamic-case-slug] a[data-raksa-framer-button-component] [data-framer-name="Text"],
      #main[data-raksa-dynamic-case-slug] a[data-raksa-framer-button-component] [data-framer-name="Text"] p {
        color: var(--token-eb7a4d4b-ecab-4fea-8d34-73063eb2b1f1, rgb(255, 255, 255)) !important;
      }
      #main[data-raksa-dynamic-case-slug] a[data-raksa-framer-button-component]:focus-visible {
        outline: none;
      }
      #main[data-raksa-dynamic-case-slug] a[data-raksa-framer-button-component]:hover [data-framer-name="Fill"],
      #main[data-raksa-dynamic-case-slug] a[data-raksa-framer-button-component]:focus-visible [data-framer-name="Fill"] {
        --border-color: var(--token-d5a3f924-bdad-4911-a441-46283d5f3ba6, rgb(139, 81, 255)) !important;
        background-color: var(--token-d5a3f924-bdad-4911-a441-46283d5f3ba6, rgb(139, 81, 255)) !important;
        box-shadow: 0 0 28px rgba(139, 81, 255, 0.72), 0 0 72px rgba(139, 81, 255, 0.34);
        opacity: 1 !important;
      }
      .raksa-dynamic-case {
        background: #0b0312;
        color: #fff;
        display: block;
        min-height: 100vh;
        padding: 42px clamp(18px, 7vw, 120px) 80px;
      }
      .raksa-dynamic-case__nav {
        align-items: center;
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }
      .raksa-dynamic-case__nav a {
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 999px;
        color: #fff;
        padding: 14px 20px;
        text-decoration: none;
      }
      .raksa-dynamic-case__hero {
        display: grid;
        gap: 24px;
        max-width: 980px;
        position: sticky;
        top: 42px;
      }
      .raksa-dynamic-case__body {
        display: grid;
        gap: clamp(28px, 4vw, 64px);
        grid-template-columns: minmax(260px, 390px) minmax(0, 1fr);
        margin-top: 56px;
      }
      .raksa-dynamic-case__tags {
        color: #8b51ff;
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .raksa-dynamic-case h1 {
        font-size: clamp(48px, 7vw, 104px);
        letter-spacing: 0;
        line-height: 0.96;
      }
      .raksa-dynamic-case__copy {
        color: rgba(255, 255, 255, 0.78);
        font-size: clamp(18px, 2vw, 24px);
        line-height: 1.45;
        max-width: 900px;
      }
      .raksa-dynamic-case__media {
        display: grid;
        gap: 24px;
      }
      .raksa-dynamic-case__media img {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 20px;
        display: block;
        height: auto;
        width: 100%;
      }
      @media (max-width: 720px) {
        .raksa-case-filters { gap: 8px; }
        .raksa-case-filter {
          font-size: 13px;
          min-height: 36px;
          padding: 0 12px;
        }
        .raksa-dynamic-case { gap: 32px; padding: 28px 16px 56px; }
        .raksa-dynamic-case__nav { align-items: flex-start; flex-direction: column; }
        .raksa-dynamic-case__body { grid-template-columns: 1fr; margin-top: 36px; }
        .raksa-dynamic-case__hero { position: static; }
        .raksa-dynamic-case__media img { border-radius: 12px; }
      }
    `;
    document.head.appendChild(style);
  }

  function coverSrcSet(cover) {
    if (!cover) return "";
    if (cover.includes("width=788") && cover.includes("height=434")) {
      return `${cover.replace("?", "?scale-down-to=512&")} 512w,${cover} 788w`;
    }
    return cover;
  }

  function updateCardCover(anchor, item) {
    const images = Array.from(anchor.querySelectorAll("img"));
    if (!images.length || !item.cover) return;

    const srcset = coverSrcSet(item.cover);
    images.forEach((image) => {
      if (image.getAttribute("src") !== item.cover) image.setAttribute("src", item.cover);
      if (image.getAttribute("srcset") !== srcset) image.setAttribute("srcset", srcset);
      if ((item.title || image.alt || "") !== image.alt) image.alt = item.title || image.alt || "";
    });
  }

  function applyHomeCases(cases) {
    const featured = cases
      .filter((item) => item.featured_on_home)
      .sort((a, b) => Number(a.home_order ?? 999) - Number(b.home_order ?? 999));
    const selected = (featured.length ? featured : cases).slice(0, 9);
    const cards = caseCardAnchors();

    groupedCards(cards).forEach((group) => {
      group.forEach((anchor, index) => {
        const item = selected[index];
        if (!item) {
          anchor.hidden = true;
          anchor.dataset.raksaCaseFilterable = "false";
          anchor.dataset.raksaCaseHomeExcluded = "true";
          return;
        }

        anchor.hidden = false;
        anchor.dataset.raksaCaseCard = "true";
        anchor.dataset.raksaCaseFilterable = "true";
        delete anchor.dataset.raksaCaseHomeExcluded;
        anchor.dataset.raksaCaseSlug = item.slug;
        anchor.dataset.raksaCaseTags = tagsFor(item).join("|");
        anchor.href = caseUrl(item.slug);
        anchor.setAttribute("aria-label", item.title);
        updateCardCover(anchor, item);
        updateDynamicCardTitle(anchor, item);
        updateCardBadges(anchor, item);
      });
    });
  }

  function syncExistingCaseCards(cases) {
    const map = caseBySlug(cases);
    caseCardAnchors().forEach((anchor) => {
      const slug = caseSlugFromAnchor(anchor);
      const item = map.get(slug);
      if (item) annotateCaseCard(anchor, item, slug);
    });
  }

  function hasOwnFilterBar(parent) {
    return Array.from(parent.children).some((child) => child instanceof HTMLElement && child.dataset.raksaCaseFilters === "true");
  }

  function buildFilterBar() {
    const nav = document.createElement("nav");
    nav.className = "raksa-case-filters";
    nav.dataset.raksaCaseFilters = "true";
    nav.setAttribute("aria-label", "Filtros de cases");

    TAGS.forEach((tag) => {
      const button = document.createElement("button");
      button.className = "raksa-case-filter";
      button.type = "button";
      button.dataset.raksaFilter = tag;
      button.textContent = tag;
      nav.appendChild(button);
    });

    return nav;
  }

  function filterTagFromText(value = "") {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return TAGS.find((tag) => tag === text) || "";
  }

  function nativeButtonLike(element) {
    return element.matches("a, button, [role='button'], [tabindex], [data-highlight='true']");
  }

  function prepareFilterControl(element, tag) {
    element.dataset.raksaFilter = tag;
    element.setAttribute("aria-pressed", "false");
    if (element instanceof HTMLAnchorElement) {
      element.removeAttribute("href");
      element.removeAttribute("target");
    }
    element.querySelectorAll?.("a[href]").forEach((anchor) => {
      anchor.removeAttribute("href");
      anchor.removeAttribute("target");
    });
    if (!nativeButtonLike(element)) {
      element.setAttribute("role", "button");
      element.tabIndex = 0;
    }
  }

  function filterControlFromEvent(event) {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target) return null;

    const prepared = target.closest("[data-raksa-filter]");
    if (prepared && !isInsideSiteChrome(prepared)) {
      return { element: prepared, tag: prepared.dataset.raksaFilter };
    }

    const root = document.querySelector("#main") || document.body;
    for (let node = target; node && node !== document.body; node = node.parentElement) {
      if (node === root.parentElement) break;
      if (isInsideSiteChrome(node)) return null;
      if (node.querySelector?.("img")) return null;

      const tag = filterTagFromText(node.textContent);
      if (tag) return { element: node, tag };
      if (node === root) break;
    }

    return null;
  }

  function existingFilterControls() {
    const root = document.querySelector("#main") || document;
    const controls = new Map();
    const nodes = Array.from(root.querySelectorAll("*"));

    nodes.forEach((node) => {
      const tag = filterTagFromText(node.textContent);
      if (!tag || isInsideSiteChrome(node)) return;

      const clickable = node.closest("a, button, [role='button'], [tabindex], [data-highlight='true']") || node;
      if (isInsideSiteChrome(clickable) || clickable.querySelector("img")) return;

      const key = `${tag}:${nodes.indexOf(clickable)}`;
      controls.set(key, { element: clickable, tag });
    });

    return Array.from(controls.values());
  }

  function enhanceExistingFilterControls() {
    const controls = existingFilterControls();
    const foundTags = new Set(controls.map((control) => control.tag));
    partialFilterControls = [];
    if (foundTags.size < 3) return false;

    controls.forEach(({ element, tag }) => {
      prepareFilterControl(element, tag);
    });

    if (TAGS.every((tag) => foundTags.has(tag))) return true;
    partialFilterControls = controls.map((control) => control.element);
    return false;
  }

  function hidePartialFilterControls() {
    partialFilterControls.forEach((element) => {
      element.hidden = true;
      element.style.display = "none";
    });
  }

  function applyCaseFilter(filter = activeCaseFilter) {
    activeCaseFilter = TAGS.includes(filter) ? filter : "Todos";

    document.querySelectorAll("[data-raksa-filter]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.raksaFilter === activeCaseFilter);
      button.setAttribute("aria-pressed", String(button.dataset.raksaFilter === activeCaseFilter));
    });

    caseCardAnchors().forEach((anchor) => {
      if (anchor.dataset.raksaCaseFilterable === "false") {
        anchor.hidden = true;
        return;
      }

      const tags = (anchor.dataset.raksaCaseTags || "").split("|").filter(Boolean);
      anchor.hidden = activeCaseFilter !== "Todos" && !tags.includes(activeCaseFilter);
    });
  }

  function bindCaseFilters() {
    if (caseFiltersBound) return;
    caseFiltersBound = true;

    const intercept = (event, shouldApply) => {
      const control = filterControlFromEvent(event);
      if (!control?.tag) return;
      prepareFilterControl(control.element, control.tag);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (shouldApply) applyCaseFilter(control.tag);
    };

    document.addEventListener("pointerdown", (event) => intercept(event, false), true);
    document.addEventListener("mousedown", (event) => intercept(event, false), true);
    document.addEventListener("touchstart", (event) => intercept(event, false), { capture: true, passive: false });
    document.addEventListener("click", (event) => intercept(event, true), true);

    document.addEventListener("keydown", (event) => {
      const control = filterControlFromEvent(event);
      if (!control?.tag || !["Enter", " "].includes(event.key)) return;
      prepareFilterControl(control.element, control.tag);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      applyCaseFilter(control.tag);
    }, true);
  }

  function enhanceCaseFilters(cards) {
    if (!cards.length) return;

    injectEnhancementStyle();
    bindCaseFilters();
    const hasFramerFilters = enhanceExistingFilterControls();
    if (!hasFramerFilters) hidePartialFilterControls();

    groupedCards(cards).forEach((group) => {
      const parent = group[0]?.parentElement;
      if (!parent || hasFramerFilters || hasOwnFilterBar(parent)) return;
      parent.insertBefore(buildFilterBar(), group[0]);
    });

    applyCaseFilter(activeCaseFilter);
  }

  function enhanceCasesIndex(cases) {
    const cards = annotateCaseCards(cases);
    enhanceCaseFilters(cards);
  }

  function startContentGuard(sync) {
    const root = document.querySelector("#main") || document.body;
    if (!root) return;

    contentGuardObserver?.disconnect();
    window.clearTimeout(contentGuardTimer);
    contentGuardTimer = 0;

    const schedule = () => {
      if (contentGuardTimer) return;
      contentGuardTimer = window.setTimeout(() => {
        contentGuardTimer = 0;
        sync();
      }, 80);
    };

    contentGuardObserver = new MutationObserver(schedule);
    contentGuardObserver.observe(root, {
      attributes: true,
      attributeFilter: ["href", "src", "srcset", "hidden", "style"],
      childList: true,
      subtree: true,
    });

    [250, 800, 1800, 3200, 5000].forEach((delay) => window.setTimeout(sync, delay));
  }

  async function loadCaseTemplateDocument() {
    if (!caseTemplatePromise) {
      caseTemplatePromise = fetch(CASE_TEMPLATE_PATH, { cache: "force-cache" })
        .then((response) => {
          if (!response.ok) throw new Error(`Template ${response.status}`);
          return response.text();
        })
        .then((html) => new DOMParser().parseFromString(html, "text/html"));
    }

    return caseTemplatePromise;
  }

  async function loadCaseWebsiteButtonTemplateDocument() {
    if (!caseWebsiteButtonTemplatePromise) {
      caseWebsiteButtonTemplatePromise = fetch(CASE_WEBSITE_BUTTON_TEMPLATE_PATH, { cache: "force-cache" })
        .then((response) => {
          if (!response.ok) throw new Error(`Website button template ${response.status}`);
          return response.text();
        })
        .then((html) => new DOMParser().parseFromString(html, "text/html"));
    }

    return caseWebsiteButtonTemplatePromise;
  }

  function injectCaseTemplateAssets(templateDocument, assetKey = "base") {
    if (!document.querySelector(`[data-raksa-case-template-assets="${assetKey}"]`)) {
      templateDocument
        .querySelectorAll("style[data-framer-font-css], style[data-framer-breakpoint-css], style[data-framer-css-ssr-minified]")
        .forEach((style) => {
          const clone = style.cloneNode(true);
          clone.dataset.raksaCaseTemplateAssets = assetKey;
          document.head.appendChild(clone);
        });
    }

    const templateSvg = templateDocument.querySelector("#svg-templates");
    const currentSvg = document.querySelector("#svg-templates");
    if (templateSvg && currentSvg) {
      templateSvg.querySelectorAll("[id]").forEach((node) => {
        if (!document.getElementById(node.id)) currentSvg.appendChild(node.cloneNode(true));
      });
    } else if (templateSvg && !currentSvg) {
      document.body.appendChild(templateSvg.cloneNode(true));
    }
  }

  function replaceMainWithTemplate(root, templateDocument) {
    const templateMain = templateDocument.querySelector("#main");
    if (!templateMain) throw new Error("Case template missing #main");

    [...root.attributes].forEach((attribute) => {
      if (attribute.name !== "id") root.removeAttribute(attribute.name);
    });

    [...templateMain.attributes].forEach((attribute) => {
      if (attribute.name !== "id") root.setAttribute(attribute.name, attribute.value);
    });

    root.innerHTML = templateMain.innerHTML;
  }

  function setImageSource(image, url, alt = "") {
    if (!image || !url) return;
    const srcset = coverSrcSet(url);
    image.setAttribute("src", url);
    image.setAttribute("srcset", srcset);
    image.setAttribute("sizes", image.getAttribute("sizes") || "100vw");
    image.setAttribute("alt", alt);
    image.removeAttribute("data-framer-original-sizes");
  }

  function mediaForCase(item) {
    const seen = new Set();
    return [item.cover, ...(item.images || [])].filter((url) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  }

  function imageKey(image) {
    const value = image.getAttribute("src") || "";
    return value.split("?")[0];
  }

  function groupSequentialImages(images) {
    const groups = [];
    images.forEach((image) => {
      const key = imageKey(image);
      const previous = groups[groups.length - 1];
      if (previous && previous.key === key) previous.images.push(image);
      else groups.push({ key, images: [image] });
    });
    return groups;
  }

  function templateImageGroups(root) {
    return groupSequentialImages(Array.from(root.querySelectorAll("img")));
  }

  function imageDisplayUnit(image) {
    return image.closest(".ssr-variant") || image.closest("[data-framer-name='Image']") || image.parentElement;
  }

  function updateImageAspectRatio(image) {
    const frame = image.closest("[data-framer-name='Image']");
    if (!frame) return;

    const sync = () => {
      if (image.naturalWidth && image.naturalHeight) {
        frame.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
      }
    };

    if (image.complete) sync();
    else image.addEventListener("load", sync, { once: true });
  }

  function setImageGroup(group, url, alt, options = {}) {
    group.images.forEach((image) => {
      setImageSource(image, url, alt);
      if (options.syncAspectRatio) updateImageAspectRatio(image);
      const unit = imageDisplayUnit(image);
      if (unit) {
        unit.hidden = false;
        unit.style.display = "";
      }
    });
  }

  function hideImageGroup(group) {
    group.images.forEach((image) => {
      const unit = imageDisplayUnit(image);
      if (unit) {
        unit.hidden = true;
        unit.style.display = "none";
      }
    });
  }

  function nodePathToBoundary(node, boundary) {
    const path = [];
    let current = node;
    while (current && current !== boundary.parentElement) {
      path.unshift(current);
      if (current === boundary) break;
      current = current.parentElement;
    }
    return path;
  }

  function commonAncestor(nodes, boundary) {
    const validNodes = nodes.filter(Boolean);
    if (!validNodes.length) return null;

    const paths = validNodes.map((node) => nodePathToBoundary(node, boundary));
    const shortest = Math.min(...paths.map((path) => path.length));
    let common = null;

    for (let index = 0; index < shortest; index += 1) {
      const candidate = paths[0][index];
      if (paths.every((path) => path[index] === candidate)) common = candidate;
      else break;
    }

    return common && common !== boundary ? common : null;
  }

  function setTemplateBlockVisible(element, visible) {
    if (!element) return;
    element.hidden = !visible;
    element.style.display = visible ? "" : "none";
    if (visible) delete element.dataset.raksaHiddenDynamicUnit;
    else element.dataset.raksaHiddenDynamicUnit = "true";
  }

  function caseBodyHtml(item) {
    const paragraphClass = "framer-text framer-styles-preset-1wztk85";
    const blocks = Array.isArray(item.content_blocks) ? item.content_blocks : [];
    const blockText = blocks
      .map((block) => block?.text || block?.content || block?.body || "")
      .filter(Boolean)
      .join("\n\n");
    const rawText = blockText || item.description || item.excerpt || "";
    const paragraphs = String(rawText)
      .split(/\n{2,}/)
      .map((text) => String(text || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const intro = `<p class="${paragraphClass}"><strong class="framer-text">${escapeHtml(item.title || item.slug)}</strong></p>`;
    const body = paragraphs.length
      ? paragraphs.map((text) => `<p class="${paragraphClass}">${escapeHtml(text)}</p>`).join("")
      : `<p class="${paragraphClass}">${escapeHtml(item.excerpt || "Case em edicao.")}</p>`;

    return `${intro}${body}`;
  }

  function orderedCases(cases) {
    return [...cases]
      .filter((item) => item.slug && item.published !== false)
      .sort((a, b) => {
        const order = Number(a.home_order ?? 999) - Number(b.home_order ?? 999);
        if (order) return order;
        return String(a.title || a.slug).localeCompare(String(b.title || b.slug), "pt-BR");
      });
  }

  function neighborsForCase(cases, slug) {
    const ordered = orderedCases(cases);
    const index = ordered.findIndex((item) => normalizeSlug(item.slug) === slug);
    return {
      previous: index > 0 ? ordered[index - 1] : null,
      next: index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null,
    };
  }

  function textEquals(element, label) {
    return shortText(element.textContent, 80) === label;
  }

  function hideTemplateUnit(element) {
    const unit = element.closest(".ssr-variant") || element.parentElement;
    if (!unit) return;
    unit.hidden = true;
    unit.style.display = "none";
    unit.dataset.raksaHiddenDynamicUnit = "true";
  }

  function showTemplateUnit(element) {
    const unit = element.closest(".ssr-variant") || element.parentElement;
    if (!unit) return;
    unit.hidden = false;
    unit.style.display = "";
    delete unit.dataset.raksaHiddenDynamicUnit;
  }

  const ORIGINAL_FRAMER_BUTTON_ICON_IDS = {
    back: "MERlRzhFk",
    next: "FnOnDEHYH",
    previous: "dzahky1SR",
  };

  function originalFramerCaseButton(templateDocument, kind) {
    const buttons = Array.from(templateDocument.querySelectorAll("#main a[data-reset='button']"));
    if (kind === "back") return buttons.find((button) => (button.getAttribute("href") || "").includes("../cases"));
    if (kind === "nextIcon") {
      return buttons.find((button) => (button.getAttribute("href") || "").includes("valor-capital-group") && !shortText(button.textContent, 80));
    }
    if (kind === "previousIcon") {
      return buttons.find((button) => (button.getAttribute("href") || "").includes("leylaw") && !shortText(button.textContent, 80));
    }
    if (kind === "nextText") return buttons.find((button) => shortText(button.textContent, 80) === "Pr\u00f3ximo");
    if (kind === "previousText") return buttons.find((button) => shortText(button.textContent, 80) === "Anterior");
    if (kind === "externalText") return buttons.find((button) => shortText(button.textContent, 80) === "Acessar website");
    return null;
  }

  function setOriginalFramerButtonIcon(button, kind) {
    const iconId = ORIGINAL_FRAMER_BUTTON_ICON_IDS[kind];
    const use = iconId ? button.querySelector("use") : null;
    if (!use) return;
    use.setAttribute("href", `#${iconId}`);
    use.setAttributeNS("http://www.w3.org/1999/xlink", "href", `#${iconId}`);
  }

  function normalizeOriginalFramerCaseButton(button, component) {
    if (!button) return null;
    button.dataset.raksaFramerButtonComponent = component;
    button.style.borderBottomLeftRadius = "118px";
    button.style.borderBottomRightRadius = "118px";
    button.style.borderTopLeftRadius = "118px";
    button.style.borderTopRightRadius = "118px";

    const fill = button.querySelector("[data-framer-name='Fill']");
    if (fill) {
      fill.style.setProperty("--border-bottom-width", "1px");
      fill.style.setProperty("--border-color", "var(--token-245d0ec3-831e-4505-88ff-21ba98a952c3, rgba(255, 255, 255, 0.15))");
      fill.style.setProperty("--border-left-width", "1px");
      fill.style.setProperty("--border-right-width", "1px");
      fill.style.setProperty("--border-style", "solid");
      fill.style.setProperty("--border-top-width", "1px");
      fill.style.backgroundColor = "rgba(139, 81, 255, 0)";
      fill.style.opacity = "1";
      fill.style.borderBottomLeftRadius = "114px";
      fill.style.borderBottomRightRadius = "114px";
      fill.style.borderTopLeftRadius = "114px";
      fill.style.borderTopRightRadius = "114px";
    }

    button.querySelectorAll("svg").forEach((svg) => {
      svg.style.setProperty("--4i27ky", "var(--token-eb7a4d4b-ecab-4fea-8d34-73063eb2b1f1, rgb(255, 255, 255))");
      svg.style.color = "var(--token-eb7a4d4b-ecab-4fea-8d34-73063eb2b1f1, rgb(255, 255, 255))";
    });

    return button;
  }

  function framerCaseButtonComponent(templateDocument, kind, options = {}) {
    const source = originalFramerCaseButton(templateDocument, kind);
    if (!source) return null;

    const button = source.cloneNode(true);
    if (options.href) button.href = options.href;
    if (options.ariaLabel) button.setAttribute("aria-label", options.ariaLabel);
    button.removeAttribute("target");
    button.removeAttribute("rel");

    const iconKind = kind === "nextIcon" ? "next" : kind === "previousIcon" ? "previous" : kind;
    setOriginalFramerButtonIcon(button, iconKind);
    return normalizeOriginalFramerCaseButton(button, kind);
  }

  function replaceWithFramerCaseButton(target, component) {
    if (!target || !component) return target;
    target.replaceWith(component);
    showTemplateUnit(component);
    return component;
  }

  function patchTemplateNavigation(root, cases, slug, templateDocument) {
    const { previous, next } = neighborsForCase(cases, slug);
    const recommendationRoot = root.querySelector("[data-framer-name='Recomendação']");
    const recommendationTexts = Array.from(
      (recommendationRoot || root).querySelectorAll("[data-framer-name='Parceria de verdade'][data-framer-component-type='RichTextContainer']"),
    );
    const recommendationImageGroups = templateImageGroups(recommendationRoot || root).slice(0, 2);

    [
      { item: previous, label: "Anterior", oldSlug: "leylaw", textNode: recommendationTexts[0], imageGroup: recommendationImageGroups[0] },
      { item: next, label: "Próximo", oldSlug: "valor-capital-group", textNode: recommendationTexts[1], imageGroup: recommendationImageGroups[1] },
    ].forEach(({ item, label, oldSlug, textNode, imageGroup }) => {
      const recommendationAnchors = Array.from((recommendationRoot || root).querySelectorAll("a"))
        .filter((anchor) => {
          const href = anchor.getAttribute("href") || "";
          return href.includes(oldSlug) || textEquals(anchor, label);
        });
      const recommendationBlock = commonAncestor(
        [textNode, ...(imageGroup?.images || []), ...recommendationAnchors],
        recommendationRoot || root,
      );

      setTemplateBlockVisible(recommendationBlock, Boolean(item));

      if (textNode) {
        if (item) {
          setTextContent(textNode, item.title || item.slug);
          showTemplateUnit(textNode);
        } else {
          hideTemplateUnit(textNode);
        }
      }

      if (imageGroup) {
        if (item?.cover) setImageGroup(imageGroup, item.cover, item.title || "");
        else hideImageGroup(imageGroup);
      }

      root.querySelectorAll("a").forEach((anchor) => {
        const href = anchor.getAttribute("href") || "";
        const matchesTemplateSlug = href.includes(oldSlug);
        const matchesLabel = textEquals(anchor, label);
        if (!matchesTemplateSlug && !matchesLabel) return;

        if (item) {
          const direction = oldSlug === "valor-capital-group" ? "next" : "previous";
          const variant = matchesLabel ? "Text" : "Icon";
          const kind = `${direction}${variant}`;
          const component = framerCaseButtonComponent(templateDocument, kind, { href: caseUrl(item.slug) });
          if (component) {
            replaceWithFramerCaseButton(anchor, component);
          } else {
            anchor.href = caseUrl(item.slug);
            anchor.removeAttribute("target");
            anchor.removeAttribute("rel");
            showTemplateUnit(anchor);
          }
        } else {
          anchor.removeAttribute("href");
          hideTemplateUnit(anchor);
        }
      });
    });
  }

  function patchTemplateBadges(root, tags) {
    const badges = Array.from(root.querySelectorAll("[data-framer-name='badge']"));
    badges.forEach((badge, index) => {
      const tag = tags[index];
      const text = badge.querySelector("[data-framer-component-type='RichTextContainer']");
      if (tag) {
        setTextContent(text, tag);
        badge.hidden = false;
        badge.style.display = "";
      } else {
        badge.hidden = true;
        badge.style.display = "none";
      }
    });
  }

  function insertTemplateExternalLink(root, templateDocument) {
    const component = framerCaseButtonComponent(templateDocument, "externalText");
    if (!component) return null;

    const wrapper = document.createElement("div");
    wrapper.dataset.raksaDynamicExternalLink = "true";
    wrapper.style.width = "100%";
    wrapper.style.willChange = "transform";
    wrapper.style.opacity = "1";
    wrapper.style.transform = "none";
    wrapper.appendChild(component);

    const badges = root.querySelector("[data-framer-name='badge']")?.parentElement;
    const textScroll = root.querySelector("[data-framer-name='texto-scroll']");
    if (badges?.parentElement) badges.insertAdjacentElement("afterend", wrapper);
    else if (textScroll?.parentElement) textScroll.insertAdjacentElement("beforebegin", wrapper);
    else root.prepend(wrapper);

    return component;
  }

  function patchTemplateExternalLinks(root, item, websiteButtonTemplateDocument = null) {
    const externalUrl = caseExternalUrl(item);
    let externalAnchors = Array.from(root.querySelectorAll("a"))
      .filter((anchor) => shortText(anchor.textContent, 80) === "Acessar website");

    if (!externalAnchors.length && externalUrl && websiteButtonTemplateDocument) {
      const inserted = insertTemplateExternalLink(root, websiteButtonTemplateDocument);
      if (inserted) externalAnchors = [inserted];
    }

    externalAnchors.forEach((anchor) => {
      if (externalUrl) {
        anchor.href = externalUrl;
        anchor.target = "_blank";
        anchor.rel = "noopener";
        showTemplateUnit(anchor);
      } else {
        anchor.removeAttribute("href");
        hideTemplateUnit(anchor);
      }
    });
  }

  function patchTemplateBackLinks(root, templateDocument) {
    root.querySelectorAll("a").forEach((anchor) => {
      const href = anchor.getAttribute("href") || "";
      if (!href.includes("../cases") && !href.endsWith("/cases") && !href.endsWith("/cases/")) return;

      const component = framerCaseButtonComponent(templateDocument, "back", {
        href: CASES_PATH,
        ariaLabel: "Voltar para todos os cases",
      });
      if (component) {
        replaceWithFramerCaseButton(anchor, component);
      } else {
        anchor.href = CASES_PATH;
        anchor.removeAttribute("target");
        anchor.removeAttribute("rel");
        anchor.setAttribute("aria-label", "Voltar para todos os cases");
        showTemplateUnit(anchor);
      }
    });
  }

  function patchTemplateGallery(root, item) {
    const gallery = root.querySelector("[data-framer-name='imagens-scroll']");
    const groups = gallery
      ? groupSequentialImages(Array.from(gallery.querySelectorAll("img")))
      : templateImageGroups(root).slice(2);
    const media = mediaForCase(item);
    groups.forEach((group, index) => {
      const url = media[index];
      if (url) setImageGroup(group, url, item.title || "", { syncAspectRatio: true });
      else hideImageGroup(group);
    });
  }

  function inlineStyleValue(element, property, fallback = "") {
    const style = element.getAttribute("style") || "";
    const match = style.match(new RegExp(`${property}\\s*:\\s*([^;]+)`, "i"));
    return match ? match[1].trim() : fallback;
  }

  function animateTemplateAppear(element, index) {
    if (element.dataset.raksaAnimatedAppear === "true" || element.hidden) return;
    element.dataset.raksaAnimatedAppear = "true";

    const initialTransform = inlineStyleValue(element, "transform", "translateY(150px)");
    const delay = Math.min(index * 55, 260);
    element.style.opacity = "0";
    element.style.transform = initialTransform === "none" ? "translateY(40px)" : initialTransform;
    element.style.willChange = "transform, opacity";

    const finish = () => {
      element.style.opacity = "1";
      element.style.transform = "none";
      element.style.willChange = "";
    };

    if (!element.animate) {
      window.setTimeout(finish, delay);
      return;
    }

    const animation = element.animate(
      [
        { opacity: 0, transform: element.style.transform },
        { opacity: 1, transform: "translateY(0px)" },
      ],
      {
        duration: 820,
        delay,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "forwards",
      },
    );
    animation.finished.then(finish).catch(finish);
  }

  function animateTemplateBlur(element, index) {
    if (element.dataset.raksaAnimatedBlur === "true" || element.hidden) return;
    element.dataset.raksaAnimatedBlur = "true";

    const delay = Math.min(index * 50, 220);
    element.style.opacity = "0";
    element.style.filter = inlineStyleValue(element, "filter", "blur(12px)");

    const finish = () => {
      element.style.opacity = "1";
      element.style.filter = "none";
    };

    if (!element.animate) {
      window.setTimeout(finish, delay);
      return;
    }

    const animation = element.animate(
      [
        { opacity: 0, filter: element.style.filter },
        { opacity: 1, filter: "blur(0px)" },
      ],
      {
        duration: 680,
        delay,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "forwards",
      },
    );
    animation.finished.then(finish).catch(finish);
  }

  function revealFramerTemplate(root) {
    const appearElements = new Set();
    root
      .querySelectorAll("[style*='opacity:0'][style*='translate'], [style*='opacity:0.001'][style*='translate']")
      .forEach((element) => appearElements.add(element));

    root.querySelectorAll("[data-framer-appear-id]").forEach((element) => {
      if (element.getAttribute("data-framer-name") === "Fill") return;
      const style = element.getAttribute("style") || "";
      if (style.includes("translate") || style.includes("opacity:0")) appearElements.add(element);
      else element.style.opacity = "1";
    });

    [...appearElements].forEach((element, index) => animateTemplateAppear(element, index));

    root.querySelectorAll("[style*='filter:blur'], [style*='filter: blur']").forEach((element, index) => {
      animateTemplateBlur(element, index);
    });
  }

  function patchFramerCaseTemplate(root, item, cases, slug, templateDocument, websiteButtonTemplateDocument = null) {
    root.dataset.raksaDynamicCaseSlug = slug;
    document.title = `${item.title || "Case"} - Raksa`;

    root
      .querySelectorAll("[data-framer-name='Título'][data-framer-component-type='RichTextContainer']")
      .forEach((node) => setTextContent(node, item.title || item.slug));

    patchTemplateBadges(root, tagsFor(item));

    const body = root.querySelector("[data-framer-name='texto-scroll'] [data-framer-component-type='RichTextContainer']");
    if (body) body.innerHTML = caseBodyHtml(item);

    patchTemplateExternalLinks(root, item, websiteButtonTemplateDocument);
    patchTemplateBackLinks(root, templateDocument);
    patchTemplateGallery(root, item);
    patchTemplateNavigation(root, cases, slug, templateDocument);
    revealFramerTemplate(root);
  }

  function renderFallbackDynamicCaseDetail(root, item, slug) {
    injectEnhancementStyle();
    const tags = tagsFor(item);
    const description = item.description || item.excerpt || "";
    const images = mediaForCase(item);
    const externalUrl = caseExternalUrl(item);
    document.title = `${item.title || "Case"} - Raksa`;
    root.innerHTML = `
      <main class="raksa-dynamic-case" data-raksa-case-slug="${escapeHtml(slug)}">
        <nav class="raksa-dynamic-case__nav" aria-label="Navegacao do case">
          <a href="${CASES_PATH}">Todos os cases</a>
          ${externalUrl ? `<a href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener">Acessar website</a>` : ""}
        </nav>
        <div class="raksa-dynamic-case__body">
          <section class="raksa-dynamic-case__hero">
            <div class="raksa-dynamic-case__tags">${escapeHtml(tags.join(" / ") || "Case")}</div>
            <h1>${escapeHtml(item.title || item.slug)}</h1>
            ${description ? `<p class="raksa-dynamic-case__copy">${escapeHtml(description)}</p>` : ""}
          </section>
          <section class="raksa-dynamic-case__media" aria-label="Imagens do case">
            ${images.map((url) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(item.title || "")}" loading="lazy">`).join("")}
          </section>
        </div>
      </main>`;
  }

  async function renderDynamicCaseDetail(cases) {
    const slug = normalizeSlug(caseSlugFromPath());
    const item = caseBySlug(cases).get(slug);
    const root = document.querySelector("#main");
    if (!root || !item || item.published === false) return;
    if (root.dataset.raksaDynamicCaseSlug === slug || dynamicCaseRenderingSlug === slug) return;

    dynamicCaseRenderingSlug = slug;
    try {
      const templateDocument = await loadCaseTemplateDocument();
      let websiteButtonTemplateDocument = null;
      if (caseExternalUrl(item)) {
        try {
          websiteButtonTemplateDocument = await loadCaseWebsiteButtonTemplateDocument();
        } catch (buttonError) {
          console.warn("[RAKSA] Case website button template unavailable.", buttonError);
        }
      }
      if (normalizeSlug(caseSlugFromPath()) !== slug) return;
      injectCaseTemplateAssets(templateDocument, "case");
      replaceMainWithTemplate(root, templateDocument);
      patchFramerCaseTemplate(root, item, cases, slug, templateDocument, websiteButtonTemplateDocument);
    } catch (error) {
      console.warn("[RAKSA] Case template unavailable, using fallback.", error);
      renderFallbackDynamicCaseDetail(root, item, slug);
    } finally {
      dynamicCaseRenderingSlug = "";
    }
  }

  function renderDynamicCaseLoading(slug) {
    const root = document.querySelector("#main");
    if (!root || root.querySelector(".raksa-dynamic-case")) return;

    injectEnhancementStyle();
    root.innerHTML = `
      <main class="raksa-dynamic-case-loading" data-raksa-case-slug="${escapeHtml(slug)}" aria-busy="true"></main>`;
  }

  async function boot() {
    const homeRoute = isHomeRoute();
    const casesRoute = isCasesRoute();
    const detailRoute = routeType() === "case_detail";
    window.RAKSA_PUBLIC_CONTENT_STATUS = {
      hasConfig,
      path: sitePath(),
      route: routeType(),
      startedAt: Date.now(),
    };
    if (!hasConfig || (!casesRoute && !homeRoute && !detailRoute)) return;

    try {
      if (detailRoute) renderDynamicCaseLoading(caseSlugFromPath());

      if (homeRoute) {
        loadLocalCases()
          .then((localCases) => {
            const cases = localCases.map(normalizedCase);
            if (!cases.length || window.RAKSA_PUBLIC_CONTENT_STATUS.mode === "home") return;
            const sync = () => syncExistingCaseCards(cases);
            window.RAKSA_PUBLIC_CONTENT_STATUS.localCases = cases.length;
            window.RAKSA_PUBLIC_CONTENT_STATUS.mode = "home_local_covers";
            sync();
            startContentGuard(sync);
          })
          .catch(() => {});
      }

      const cases = (await loadCases()).map(normalizedCase);
      window.RAKSA_PUBLIC_CONTENT_STATUS.cases = cases.length;
      if (!cases.length) return;
      if (homeRoute) {
        const sync = () => applyHomeCases(cases);
        window.RAKSA_PUBLIC_CONTENT_STATUS.mode = "home";
        sync();
        startContentGuard(sync);
      } else if (casesRoute) {
        const sync = () => enhanceCasesIndex(cases);
        window.RAKSA_PUBLIC_CONTENT_STATUS.mode = "cases_index";
        sync();
        startContentGuard(sync);
      } else if (detailRoute) {
        const sync = () => renderDynamicCaseDetail(cases);
        window.RAKSA_PUBLIC_CONTENT_STATUS.mode = "case_detail";
        sync();
        startContentGuard(sync);
      }
    } catch (error) {
      window.RAKSA_PUBLIC_CONTENT_STATUS.error = error.message || String(error);
      console.warn("[RAKSA] Supabase public content unavailable:", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startMetrics);
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    startMetrics();
    boot();
  }
})();
