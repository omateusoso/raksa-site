import {
  ACCEPTED_IMAGE_ACCEPT,
  ACCEPTED_IMAGE_LABEL,
  ACCEPTED_IMAGE_TYPES,
  IMAGE_BUCKET,
  PAGE_BASE,
  TAGS,
} from "./constants.js?v=3";
import { escapeHtml, formatDateTime, normalizeExternalUrl, slugify } from "./utils.js?v=3";

const CASE_SAVE_DEBOUNCE_MS = 850;

export function createCasesModule({
  state,
  supabase,
  render,
  renderShell,
  setNotice,
  isLoggedIn,
  persistCase,
  persistCases,
  deleteRemoteCase,
  deleteUploadedFileIfUnused,
  fileExtension,
  isManagedUpload,
}) {
  const pendingCaseSaves = new Map();
  const pendingCaseTimers = new Map();
  const persistCaseBatch = persistCases || persistCasesFallback;
  let homeDraft = null;
  let homeSearch = "";
  let cmsSearchFrame = 0;
  let homeSearchFrame = 0;

  async function persistCasesFallback(items) {
    for (const item of items) {
      const result = await persistCase(item);
      if (result.error) return result;
    }
    return { error: null };
  }

  function normalizeCaseTags(tags = []) {
    const values = Array.isArray(tags) ? tags.map(String) : [];
    return TAGS.filter((tag) => values.includes(tag));
  }

  function normalizedHomeOrder(value) {
    if (value === null || value === undefined || value === "") return 999;
    const order = Number(value);
    return Number.isFinite(order) ? order : 999;
  }

  function caseMatches(item, query) {
    if (!query) return true;
    const haystack = [item.title, item.slug, item.externalUrl, item.description, ...normalizeCaseTags(item.tags)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  }

  function filteredCases() {
    const query = state.search.trim().toLowerCase();
    return state.cases.filter((item) => {
      const matchesQuery = caseMatches(item, query);
      const matchesTag = state.tag === "Todos" || normalizeCaseTags(item.tags).includes(state.tag);
      return matchesQuery && matchesTag;
    });
  }

  function renderNotice() {
    return "";
  }

  function updateVisibleNotice(type, text) {
    setNotice(type, text);
  }

  function renderImage(url, alt = "") {
    return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
  }

  function renderDashboard() {
    const items = filteredCases();
    const tagCount = TAGS.map((tag) => state.cases.filter((item) => normalizeCaseTags(item.tags).includes(tag)).length);
    const publishedCount = state.cases.filter((item) => item.published !== false).length;
    const draftCount = state.cases.length - publishedCount;
    const externalCount = state.cases.filter((item) => item.externalUrl).length;
    renderShell(`
      <main class="page cms-page">
        <section class="page-header cms-header">
          <div class="page-title">
            <span class="eyebrow">CMS</span>
            <h1>Posts</h1>
            <p class="section-subtitle">${state.cases.length} posts cadastrados no portfolio</p>
          </div>
          <button class="button button-primary" type="button" data-create-case>Criar post</button>
        </section>

        ${renderNotice()}

        <section class="cms-metrics" aria-label="Resumo do CMS">
          <div class="metric">
            <strong>${publishedCount}</strong>
            <span>Live</span>
          </div>
          <div class="metric">
            <strong>${draftCount}</strong>
            <span>Draft</span>
          </div>
          <div class="metric">
            <strong>${externalCount}</strong>
            <span>Com link</span>
          </div>
          ${TAGS.map((tag, index) => `
            <div class="metric">
              <strong>${tagCount[index]}</strong>
              <span>${escapeHtml(tag)}</span>
            </div>
          `).join("")}
        </section>

        <section class="cms-toolbar" aria-label="Ferramentas do CMS">
          <button class="icon-button cms-tool-button ${state.creatingCase ? "is-loading" : ""}" type="button" data-create-case aria-label="Criar post" title="Criar post" ${state.creatingCase ? "disabled" : ""}>
            ${state.creatingCase ? `<span class="spinner" aria-hidden="true"></span>` : "+"}
          </button>
          <input class="input" type="search" placeholder="Buscar case" value="${escapeHtml(state.search)}" data-search>
          <div class="tag-filter" aria-label="Filtros">
            ${["Todos", ...TAGS].map((tag) => `
              <button class="tag-pill ${state.tag === tag ? "is-active" : ""}" type="button" data-filter="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
            `).join("")}
          </div>
        </section>

        <div data-cms-table-region>
          ${renderCmsTable(items)}
        </div>
      </main>`);
  }

  function refreshCmsTable() {
    const region = document.querySelector("[data-cms-table-region]");
    if (region) region.innerHTML = renderCmsTable(filteredCases());
  }

  function updateDashboardSearch(value) {
    state.search = value;
    window.cancelAnimationFrame(cmsSearchFrame);
    cmsSearchFrame = window.requestAnimationFrame(refreshCmsTable);
  }

  function updateDashboardFilter(tag) {
    state.tag = ["Todos", ...TAGS].includes(tag) ? tag : "Todos";
    document.querySelectorAll("[data-filter]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.filter === state.tag);
    });
    refreshCmsTable();
  }

  function renderCmsTable(items) {
    if (!items.length) return `<section class="panel empty-state">Nenhum post encontrado.</section>`;

    return `
      <section class="cms-table-shell" aria-label="Posts do CMS">
        <div class="cms-table-wrap">
          <table class="cms-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Status</th>
                <th>Slug</th>
                <th>Capa</th>
                <th>Imagens</th>
                ${TAGS.map((tag) => `<th>${escapeHtml(tag)}</th>`).join("")}
                <th>Link</th>
                <th>Criado</th>
                <th>Editado</th>
                <th>Estado</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(renderCmsRow).join("")}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function renderCmsRow(item) {
    const status = item.published === false ? "draft" : "live";
    const tags = normalizeCaseTags(item.tags);
    return `
      <tr data-cms-row="${escapeHtml(item.slug)}">
        <td class="cms-title-cell">
          <input class="cms-cell-input cms-title-input" value="${escapeHtml(item.title)}" data-cms-field="title" data-cms-slug="${escapeHtml(item.slug)}" aria-label="Nome de ${escapeHtml(item.title)}">
        </td>
        <td>
          <select class="cms-status-select is-${status}" data-cms-field="status" data-cms-slug="${escapeHtml(item.slug)}" aria-label="Status de ${escapeHtml(item.title)}">
            <option value="draft" ${status === "draft" ? "selected" : ""}>Draft</option>
            <option value="live" ${status === "live" ? "selected" : ""}>Live</option>
          </select>
        </td>
        <td>
          <input class="cms-cell-input cms-slug-input" value="${escapeHtml(item.slug)}" data-cms-field="slug" data-cms-slug="${escapeHtml(item.slug)}" aria-label="Slug de ${escapeHtml(item.title)}">
        </td>
        <td>${renderCmsCoverCell(item)}</td>
        <td>${renderCmsGalleryCell(item)}</td>
        ${TAGS.map((tag) => `<td class="cms-toggle-cell">${renderCmsTagToggle(item, tag, tags)}</td>`).join("")}
        <td>
          <input class="cms-cell-input cms-link-input" type="url" value="${escapeHtml(item.externalUrl || "")}" placeholder="Sem link" data-cms-field="externalUrl" data-cms-slug="${escapeHtml(item.slug)}" aria-label="Link externo de ${escapeHtml(item.title)}">
        </td>
        <td class="cms-date-cell">${formatDateTime(item.createdAt || item.updatedAt)}</td>
        <td class="cms-date-cell" data-cms-updated-at>${formatDateTime(item.updatedAt)}</td>
        <td class="cms-save-cell">
          <span class="cms-save-state" data-cms-save-state>Sincronizado</span>
        </td>
        <td class="cms-actions-cell">
          <a class="button button-secondary cms-row-action" href="#/cases/${encodeURIComponent(item.slug)}" data-cms-edit-link aria-label="Editar detalhes de ${escapeHtml(item.title)}">Editar</a>
          <a class="button button-secondary cms-row-action" href="${PAGE_BASE}/cases/${encodeURIComponent(item.slug)}" data-cms-view-link target="_blank" rel="noopener" aria-label="Ver ${escapeHtml(item.title)}">Ver</a>
          <button class="button button-danger cms-row-action" type="button" data-delete-case="${escapeHtml(item.slug)}" aria-label="Excluir ${escapeHtml(item.title)}">Excluir</button>
        </td>
      </tr>`;
  }

  function renderCmsCoverCell(item) {
    return `
      <label class="cms-thumb cms-cover-thumb file-button" title="${item.cover ? "Substituir capa" : "Enviar capa"}">
        ${item.cover ? renderImage(item.cover) : `<span>Capa</span>`}
        <input type="file" accept="${ACCEPTED_IMAGE_ACCEPT}" data-cover-file="${escapeHtml(item.slug)}">
      </label>`;
  }

  function renderCmsGalleryCell(item) {
    const count = (item.images || []).length;
    return `
      <div class="cms-gallery-strip cms-gallery-summary">
        <span class="cms-gallery-count">${count} ${count === 1 ? "imagem" : "imagens"}</span>
        <label class="cms-gallery-add file-button" title="Adicionar imagens">
          +
          <input type="file" accept="${ACCEPTED_IMAGE_ACCEPT}" multiple data-case-images-file="${escapeHtml(item.slug)}">
        </label>
      </div>`;
  }

  function renderCmsTagToggle(item, tag, tags = normalizeCaseTags(item.tags)) {
    return `
      <label class="cms-switch" title="${escapeHtml(tag)}">
        <input type="checkbox" data-cms-tag="${escapeHtml(tag)}" data-cms-slug="${escapeHtml(item.slug)}" ${tags.includes(tag) ? "checked" : ""} aria-label="${escapeHtml(tag)} em ${escapeHtml(item.title)}">
        <span></span>
      </label>`;
  }

  function renderCaseCard(item) {
    const tags = normalizeCaseTags(item.tags);
    return `
      <article class="case-card">
        ${item.cover ? renderImage(item.cover, item.title) : `<div class="case-placeholder">${escapeHtml(item.title)}</div>`}
        <div class="case-overlay">
          <div>
            <div class="case-card-title">${escapeHtml(item.title)}</div>
            <div class="meta">${tags.map(escapeHtml).join(" - ")}</div>
          </div>
          <div class="case-card-actions">
            <a class="button button-primary" href="#/cases/${encodeURIComponent(item.slug)}">Alterar case</a>
            <button class="button button-danger" type="button" data-delete-case="${escapeHtml(item.slug)}">Excluir case</button>
          </div>
        </div>
      </article>`;
  }

  function renderEditor(slug) {
    const item = getCase(slug);
    if (!item) {
      window.location.hash = "#/";
      return;
    }

    const tags = normalizeCaseTags(item.tags);
    const gallery = item.images || [];
    renderShell(`
      <main class="page editor-page">
        <section class="page-header">
          <div class="page-title">
            <span class="eyebrow">Editar case</span>
            <h1>${escapeHtml(item.title || "Novo case")}</h1>
            <p class="section-subtitle">/${escapeHtml(item.slug)}</p>
          </div>
          <div class="editor-actions">
            <a class="button button-secondary" href="#/cases">Voltar</a>
            <a class="button button-secondary" href="${PAGE_BASE}/cases/${encodeURIComponent(item.slug)}" target="_blank" rel="noopener">Ver case</a>
            <button class="button button-primary" type="button" data-save-case="${escapeHtml(item.slug)}">Salvar alteracoes</button>
          </div>
        </section>

        ${renderNotice()}

        <form class="editor-layout editor-layout-framer" data-editor-form>
          <div class="editor-main-column">
            <section class="panel editor-panel">
              <div class="panel-heading">
                <span class="eyebrow">Dados</span>
                <h2>Informacoes do case</h2>
              </div>
              <div class="form-stack">
                <label class="field">
                  <span>Nome</span>
                  <input class="input" name="title" value="${escapeHtml(item.title)}" required>
                </label>
                <div class="form-grid">
                  <label class="field">
                    <span>Slug</span>
                    <input class="input" name="slug" value="${escapeHtml(item.slug)}" required>
                  </label>
                  <label class="field">
                    <span>Link externo</span>
                    <input class="input" name="externalUrl" type="url" placeholder="https://site.com" value="${escapeHtml(item.externalUrl || "")}">
                  </label>
                </div>
                <label class="field">
                  <span>Resumo curto</span>
                  <textarea class="textarea textarea-small" name="excerpt">${escapeHtml(item.excerpt || "")}</textarea>
                </label>
                <label class="field">
                  <span>Descritivo</span>
                  <textarea class="textarea" name="description">${escapeHtml(item.description || "")}</textarea>
                </label>
              </div>
            </section>

            <section class="panel editor-panel">
              <div class="panel-heading">
                <span class="eyebrow">Categorias</span>
                <h2>Taxonomia</h2>
              </div>
              <div class="tag-filter">
                ${TAGS.map((tag) => `
                  <label class="tag-check">
                    <input type="checkbox" name="tags" value="${escapeHtml(tag)}" ${tags.includes(tag) ? "checked" : ""}>
                    ${escapeHtml(tag)}
                  </label>
                `).join("")}
              </div>
            </section>

            <section class="panel editor-panel">
              <div class="panel-heading">
                <span class="eyebrow">Capa</span>
                <h2>Imagem principal</h2>
              </div>
              <div class="cover-preview">
                ${item.cover ? renderImage(item.cover, item.title) : `<div class="case-placeholder">Sem capa</div>`}
              </div>
              <div class="upload-actions">
                <label class="button button-secondary file-button">
                  ${item.cover ? "Substituir capa" : "Enviar capa"}
                  <input type="file" accept="${ACCEPTED_IMAGE_ACCEPT}" data-cover-file="${escapeHtml(item.slug)}">
                </label>
                ${item.cover ? `<button class="button button-danger" type="button" data-remove-cover="${escapeHtml(item.slug)}">Excluir capa</button>` : ""}
              </div>
            </section>

            <section class="panel editor-panel">
              <div class="panel-heading">
                <div>
                  <span class="eyebrow">Galeria</span>
                  <h2>Imagens do case</h2>
                </div>
                <span class="panel-count">${gallery.length} imagens</span>
              </div>
              <div class="image-list" data-image-list="${escapeHtml(item.slug)}">
                ${gallery.map((url, index) => renderImageRow(item, url, index)).join("")}
              </div>
              <div class="upload-zone" data-upload-zone="${escapeHtml(item.slug)}">
                <div>
                  <strong>Subir imagens</strong>
                  <span>${ACCEPTED_IMAGE_LABEL}, um ou varios arquivos.</span>
                </div>
                <label class="button button-secondary file-button">
                  Selecionar arquivos
                  <input type="file" accept="${ACCEPTED_IMAGE_ACCEPT}" multiple data-case-images-file="${escapeHtml(item.slug)}">
                </label>
              </div>
            </section>
          </div>

          <aside class="editor-side-column">
            <section class="panel editor-panel">
              <div class="panel-heading">
                <span class="eyebrow">Publicacao</span>
                <h2>Status</h2>
              </div>
              <div class="form-stack">
                <label class="toggle-row">
                  <input type="checkbox" name="published" ${item.published !== false ? "checked" : ""}>
                  <span>Publicado no site</span>
                </label>
                <div class="meta-list">
                  <div>
                    <span>Criado</span>
                    <strong>${formatDateTime(item.createdAt || item.updatedAt)}</strong>
                  </div>
                  <div>
                    <span>Editado</span>
                    <strong>${formatDateTime(item.updatedAt)}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section class="panel editor-panel">
              <div class="panel-heading">
                <span class="eyebrow">Home</span>
                <h2>Destaque</h2>
              </div>
              <div class="form-stack">
                <label class="toggle-row">
                  <input type="checkbox" name="featuredOnHome" ${item.featuredOnHome ? "checked" : ""}>
                  <span>Mostrar na home</span>
                </label>
                <label class="field">
                  <span>Ordem</span>
                  <input class="input" name="homeOrder" type="number" min="0" step="1" value="${escapeHtml(normalizedHomeOrder(item.homeOrder))}">
                </label>
                <div class="home-preview-card">
                  <div class="image-thumb">${item.cover ? renderImage(item.cover) : ""}</div>
                  <div class="case-setting-copy">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${tags.map(escapeHtml).join(" - ") || "Sem categoria"}</span>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </form>
      </main>`);
  }

  function renderHomeSettings() {
    syncHomeDraft();
    const selected = selectedHomeCases();
    const hasChanges = hasHomeDraftChanges();

    renderShell(`
      <main class="page home-settings-page">
        <section class="page-header">
          <div class="page-title">
            <span class="eyebrow">Página inicial</span>
            <h1>Cases em destaque</h1>
            <p class="section-subtitle">${selected.length} cases selecionados para a landing page</p>
          </div>
          <div class="editor-actions">
            <button class="button button-secondary" type="button" data-reset-home-settings ${hasChanges ? "" : "disabled"}>Descartar</button>
            <button class="button button-primary" type="button" data-save-home-settings ${hasChanges ? "" : "disabled"}>Salvar página inicial</button>
          </div>
        </section>

        ${renderNotice()}

        <section class="cms-toolbar home-toolbar" aria-label="Buscar cases para a home">
          <input class="input home-search-input" type="search" placeholder="Buscar case para adicionar" value="${escapeHtml(homeSearch)}" data-home-search>
          <span class="toolbar-meta">${selected.length} na home</span>
        </section>

        ${homeSearch.trim() ? `
          <section class="panel home-panel home-search-panel">
            <div class="home-case-list home-search-results">
              ${renderHomeCaseList()}
            </div>
          </section>` : ""}

        <section class="home-settings-layout">
          <section class="panel home-panel home-live-panel">
            <div class="panel-heading">
              <div>
                <span class="eyebrow">Destaques</span>
                <h2>Página inicial do site</h2>
              </div>
              <span class="panel-count">${selected.length}</span>
            </div>
            <div class="home-selected-grid" aria-label="Cases visíveis na home">
              ${selected.length ? selected.map((item, index) => renderHomeSelectedCard(item, index)).join("") : `<div class="empty-state">Nenhum case selecionado.</div>`}
            </div>
          </section>
        </section>
      </main>`);
  }

  function renderHomeCaseList() {
    const selectedSlugs = new Set(selectedHomeCases().map((item) => item.slug));
    const query = homeSearch.trim().toLowerCase();
    if (!query) return `<div class="empty-state">Busque pelo nome, slug ou categoria para adicionar um case.</div>`;
    const visibleCases = [...state.cases]
      .filter((item) => !selectedSlugs.has(item.slug) && caseMatches(item, query))
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"))
      .slice(0, 12);
    return visibleCases.map((item) => renderHomeCaseRow(item)).join("") || `<div class="empty-state">Nenhum case encontrado para adicionar.</div>`;
  }

  function renderHomeSelectedCard(item, index) {
    const tags = normalizeCaseTags(item.tags);
    return `
      <article class="home-selected-card" draggable="true" data-home-selected-card="${escapeHtml(item.slug)}">
        <span class="home-order-badge">${String(index + 1).padStart(2, "0")}</span>
        <button class="icon-button home-remove-button" type="button" data-home-toggle="${escapeHtml(item.slug)}" data-home-featured="false" aria-label="Remover ${escapeHtml(item.title)} da home">X</button>
        <div class="home-card-media">${item.cover ? renderImage(item.cover, item.title) : `<div class="case-placeholder">${escapeHtml(item.title)}</div>`}</div>
        <div class="home-card-copy">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${tags.map(escapeHtml).join(" - ") || "Sem categoria"}</span>
        </div>
      </article>`;
  }

  function renderHomeCaseRow(item) {
    const tags = normalizeCaseTags(item.tags);
    return `
      <article class="home-case-row" data-home-case="${escapeHtml(item.slug)}">
        <div class="image-thumb">${item.cover ? renderImage(item.cover) : ""}</div>
        <div class="case-setting-copy">
          <strong>${escapeHtml(item.title)}</strong>
          <span>/${escapeHtml(item.slug)}${tags.length ? ` - ${tags.map(escapeHtml).join(" - ")}` : ""}</span>
        </div>
        <button class="button button-primary" type="button" data-home-toggle="${escapeHtml(item.slug)}" data-home-featured="true">
          Adicionar
        </button>
      </article>`;
  }

  function renderImageRow(item, url, index) {
    return `
      <div class="image-row ${state.dragOverImageIndex === index ? "is-drop-target" : ""}" draggable="true" data-image-index="${index}" data-image-slug="${escapeHtml(item.slug)}">
        <button class="drag-handle" type="button" draggable="true" data-drag-handle aria-label="Arrastar para reordenar">
          <span></span><span></span><span></span>
        </button>
        <div class="image-thumb">${url ? renderImage(url) : ""}</div>
        <div class="image-copy">
          <strong>Imagem ${index + 1}</strong>
          <span>${isManagedUpload(url) ? "Arquivo enviado" : "Imagem existente"}</span>
        </div>
        <div class="image-actions">
          <button class="icon-button" type="button" data-remove-image="${index}" aria-label="Remover imagem">Excluir</button>
        </div>
      </div>`;
  }

  function getCase(slug) {
    const normalizedSlug = String(slug || "").normalize("NFC");
    return state.cases.find((item) => item.slug.normalize("NFC") === normalizedSlug);
  }

  async function createCase() {
    if (state.creatingCase) return;
    state.creatingCase = true;
    renderDashboard();

    const title = "Novo case";
    const slug = `novo-case-${Date.now()}`;
    const item = {
      id: slug,
      slug,
      title,
      tags: [],
      description: "",
      cover: "",
      images: [],
      excerpt: "",
      published: true,
      featuredOnHome: false,
      homeOrder: 999,
      contentBlocks: [],
      externalUrl: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const { error } = await persistCase(item);
    if (error) {
      state.creatingCase = false;
      setNotice("error", error.message);
      renderDashboard();
      return;
    }
    state.cases.unshift(item);
    if (homeDraft) homeDraft.set(slug, { featuredOnHome: false, homeOrder: 999 });
    state.creatingCase = false;
    window.location.hash = `#/cases/${encodeURIComponent(slug)}`;
  }

  async function saveCurrentCase(slug) {
    const item = getCase(slug);
    const form = document.querySelector("[data-editor-form]");
    if (!item || !form) return;

    const pendingResult = await flushPendingCaseSave(item);
    if (pendingResult.error) {
      setNotice("error", pendingResult.error.message);
      renderEditor(slug);
      return;
    }

    const data = new FormData(form);
    const newTitle = String(data.get("title") || "").trim();
    const newSlug = slugify(String(data.get("slug") || newTitle));
    if (!newTitle || !newSlug) {
      setNotice("error", "Preencha nome e slug.");
      renderEditor(slug);
      return;
    }

    const duplicate = state.cases.find((entry) => entry.slug === newSlug && entry.slug !== slug);
    if (duplicate) {
      setNotice("error", "Ja existe um case com esse slug.");
      renderEditor(slug);
      return;
    }

    const previousSlug = item.slug;
    item.title = newTitle;
    item.slug = newSlug;
    item.id = newSlug;
    item.tags = normalizeCaseTags(data.getAll("tags").map(String));
    item.description = String(data.get("description") || "").trim();
    item.excerpt = String(data.get("excerpt") || "").trim();
    item.published = data.get("published") === "on";
    item.featuredOnHome = data.get("featuredOnHome") === "on";
    item.homeOrder = normalizedHomeOrder(data.get("homeOrder"));
    item.externalUrl = normalizeExternalUrl(data.get("externalUrl"));
    item.updatedAt = new Date().toISOString();
    renameHomeDraftSlug(previousSlug, newSlug);

    const { error } = await persistCase(item);
    if (error) {
      setNotice("error", error.message);
      renderEditor(slug);
      return;
    }
    if (previousSlug !== newSlug) await deleteRemoteCase(previousSlug);
    setNotice("success", "Case salvo.");
    window.location.hash = `#/cases/${encodeURIComponent(newSlug)}`;
    renderEditor(newSlug);
  }

  function findCmsRow(slug) {
    return [...document.querySelectorAll("[data-cms-row]")].find((row) => row.dataset.cmsRow === slug);
  }

  function setCmsRowSaveState(slug, status, text) {
    const row = findCmsRow(slug);
    if (!row) return;
    row.classList.toggle("is-dirty", status === "dirty");
    row.classList.toggle("is-saving", status === "saving");
    row.classList.toggle("is-save-error", status === "error");
    const node = row.querySelector("[data-cms-save-state]");
    if (node) node.textContent = text;
  }

  function refreshCmsRowSlug(previousSlug, item) {
    const row = findCmsRow(previousSlug);
    if (!row) return;
    row.dataset.cmsRow = item.slug;
    row.querySelectorAll("[data-cms-slug]").forEach((node) => {
      node.dataset.cmsSlug = item.slug;
    });
    row.querySelectorAll("[data-cover-file]").forEach((node) => {
      node.dataset.coverFile = item.slug;
    });
    row.querySelectorAll("[data-case-images-file]").forEach((node) => {
      node.dataset.caseImagesFile = item.slug;
    });
    const editLink = row.querySelector("[data-cms-edit-link]");
    if (editLink) editLink.href = `#/cases/${encodeURIComponent(item.slug)}`;
    const viewLink = row.querySelector("[data-cms-view-link]");
    if (viewLink) viewLink.href = `${PAGE_BASE}/cases/${encodeURIComponent(item.slug)}`;
    const deleteButton = row.querySelector("[data-delete-case]");
    if (deleteButton) deleteButton.dataset.deleteCase = item.slug;
  }

  function queueCaseSave(item, previousSlug, message) {
    const existing = pendingCaseSaves.get(item);
    pendingCaseSaves.set(item, {
      previousSlug: existing?.previousSlug || previousSlug,
      message,
    });
    setCmsRowSaveState(item.slug, "dirty", "Pendente");
    window.clearTimeout(pendingCaseTimers.get(item));
    pendingCaseTimers.set(item, window.setTimeout(() => {
      flushPendingCaseSave(item);
    }, CASE_SAVE_DEBOUNCE_MS));
  }

  async function flushPendingCaseSave(item) {
    const pending = pendingCaseSaves.get(item);
    if (!pending) return { error: null };

    window.clearTimeout(pendingCaseTimers.get(item));
    pendingCaseTimers.delete(item);
    pendingCaseSaves.delete(item);
    setCmsRowSaveState(item.slug, "saving", "Salvando");

    const { error } = await persistCase(item);
    if (error) {
      updateVisibleNotice("error", error.message);
      setCmsRowSaveState(item.slug, "error", "Erro");
      return { error };
    }

    if (pending.previousSlug !== item.slug) {
      const deleteResult = await deleteRemoteCase(pending.previousSlug);
      if (deleteResult.error) {
        updateVisibleNotice("error", deleteResult.error.message);
        setCmsRowSaveState(item.slug, "error", "Erro");
        return { error: deleteResult.error };
      }
    }

    updateVisibleNotice("success", pending.message);
    setCmsRowSaveState(item.slug, "saved", "Sincronizado");
    const row = findCmsRow(item.slug);
    const updatedAtNode = row?.querySelector("[data-cms-updated-at]");
    if (updatedAtNode) updatedAtNode.textContent = formatDateTime(item.updatedAt);
    return { error: null };
  }

  async function updateCmsCaseField(slug, field, rawValue) {
    const item = getCase(slug);
    if (!item) return;

    const previousSlug = item.slug;
    const value = String(rawValue || "").trim();

    if (field === "title") {
      if (!value) {
        updateVisibleNotice("error", "Preencha o nome do post.");
        return;
      }
      if (item.title === value) return;
      item.title = value;
    } else if (field === "slug") {
      const newSlug = slugify(value);
      if (!newSlug) {
        updateVisibleNotice("error", "Preencha um slug válido.");
        return;
      }
      const duplicate = state.cases.find((entry) => entry.slug === newSlug && entry.slug !== item.slug);
      if (duplicate) {
        updateVisibleNotice("error", "Ja existe um post com esse slug.");
        return;
      }
      if (item.slug === newSlug) return;
      item.slug = newSlug;
      item.id = newSlug;
      renameHomeDraftSlug(previousSlug, newSlug);
      refreshCmsRowSlug(previousSlug, item);
      const row = findCmsRow(newSlug);
      const slugInput = row?.querySelector('[data-cms-field="slug"]');
      if (slugInput) slugInput.value = newSlug;
    } else if (field === "status") {
      const published = value === "live";
      if ((item.published !== false) === published) return;
      item.published = published;
      const statusSelect = findCmsRow(item.slug)?.querySelector('[data-cms-field="status"]');
      if (statusSelect) {
        statusSelect.classList.toggle("is-live", published);
        statusSelect.classList.toggle("is-draft", !published);
      }
    } else if (field === "externalUrl") {
      const externalUrl = normalizeExternalUrl(value);
      if ((item.externalUrl || "") === externalUrl) return;
      item.externalUrl = externalUrl;
      const linkInput = findCmsRow(item.slug)?.querySelector('[data-cms-field="externalUrl"]');
      if (linkInput) linkInput.value = externalUrl;
    } else {
      return;
    }

    item.updatedAt = new Date().toISOString();
    queueCaseSave(item, previousSlug, "Post atualizado.");
  }

  async function updateCmsCaseTag(slug, tag, checked) {
    const item = getCase(slug);
    if (!item || !TAGS.includes(tag)) return;

    const currentTags = normalizeCaseTags(item.tags);
    const hasTag = currentTags.includes(tag);
    if (hasTag === checked) return;

    const nextTags = checked ? [...currentTags, tag] : currentTags.filter((entry) => entry !== tag);
    item.tags = normalizeCaseTags(nextTags);
    item.updatedAt = new Date().toISOString();
    queueCaseSave(item, item.slug, "Categorias atualizadas.");
  }

  async function uploadImageFile(slug, file, scope) {
    if (!supabase || !isLoggedIn()) throw new Error("Entre novamente para subir imagens.");
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) throw new Error(`Envie apenas arquivos ${ACCEPTED_IMAGE_LABEL}.`);

    const extension = fileExtension(file);
    if (!extension) throw new Error("Formato de imagem inválido.");

    const safeSlug = slugify(slug);
    const fileName = `${scope}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const path = `cases/${safeSlug}/${fileName}`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function replaceCover(slug, file) {
    const item = getCase(slug);
    if (!item || !file) return;
    try {
      const previousCover = item.cover;
      const publicUrl = await uploadImageFile(slug, file, "cover");
      item.cover = publicUrl;
      item.updatedAt = new Date().toISOString();
      const { error } = await persistCase(item);
      if (error) throw error;
      await deleteUploadedFileIfUnused(previousCover, item);
      setNotice("success", previousCover ? "Capa substituida." : "Capa enviada.");
    } catch (error) {
      setNotice("error", error.message);
    }
    render();
  }

  async function removeCover(slug) {
    const item = getCase(slug);
    if (!item) return;
    const previousCover = item.cover;
    item.cover = "";
    item.updatedAt = new Date().toISOString();
    const { error } = await persistCase(item);
    if (error) {
      setNotice("error", error.message);
    } else {
      await deleteUploadedFileIfUnused(previousCover, item);
      setNotice("success", "Capa excluida.");
    }
    render();
  }

  async function uploadCaseImages(slug, files) {
    const item = getCase(slug);
    if (!item || !files.length) return;
    try {
      for (const file of files) {
        if (!ACCEPTED_IMAGE_TYPES.has(file.type)) throw new Error(`Envie apenas arquivos ${ACCEPTED_IMAGE_LABEL}.`);
      }
      const uploadedUrls = [];
      for (const file of files) uploadedUrls.push(await uploadImageFile(slug, file, "image"));
      item.images.push(...uploadedUrls);
      item.updatedAt = new Date().toISOString();
      const { error } = await persistCase(item);
      if (error) throw error;
      setNotice("success", `${uploadedUrls.length} imagem${uploadedUrls.length === 1 ? "" : "s"} enviada${uploadedUrls.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setNotice("error", error.message);
    }
    render();
  }

  async function removeImage(slug, index) {
    const item = getCase(slug);
    if (!item) return;
    const [removed] = item.images.splice(index, 1);
    item.updatedAt = new Date().toISOString();
    const { error } = await persistCase(item);
    if (error) {
      setNotice("error", error.message);
    } else {
      await deleteUploadedFileIfUnused(removed, item);
      setNotice("success", "Imagem excluida.");
    }
    render();
  }

  async function reorderByDrag(slug, from, to) {
    const item = getCase(slug);
    if (!item || !Number.isInteger(from) || !Number.isInteger(to) || from === to || from < 0 || to < 0) return;
    if (from >= item.images.length || to >= item.images.length) return;
    const [image] = item.images.splice(from, 1);
    item.images.splice(to, 0, image);
    item.updatedAt = new Date().toISOString();
    const { error } = await persistCase(item);
    if (error) setNotice("error", error.message);
    else setNotice("success", "Galeria reordenada.");
    render();
  }

  function openDeleteModal(slug) {
    const item = getCase(slug);
    if (!item) return;
    state.modal = `
      <div class="modal-backdrop" role="dialog" aria-modal="true">
        <div class="modal">
          <div class="page-title">
            <h2>Excluir case</h2>
            <p class="section-subtitle">${escapeHtml(item.title)}</p>
          </div>
          <div class="modal-actions">
            <button class="button button-secondary" type="button" data-close-modal>Cancelar</button>
            <button class="button button-danger" type="button" data-confirm-delete="${escapeHtml(slug)}">Excluir</button>
          </div>
        </div>
      </div>`;
    renderDashboard();
  }

  async function deleteCase(slug) {
    const { error } = await deleteRemoteCase(slug);
    if (error) {
      state.modal = null;
      setNotice("error", error.message);
      renderDashboard();
      return;
    }
    state.cases = state.cases.filter((item) => item.slug !== slug);
    if (homeDraft) homeDraft.delete(slug);
    state.modal = null;
    renderDashboard();
  }

  function syncHomeDraft() {
    if (!homeDraft) homeDraft = new Map();
    const existingSlugs = new Set();
    for (const item of state.cases) {
      existingSlugs.add(item.slug);
      if (!homeDraft.has(item.slug)) {
        homeDraft.set(item.slug, {
          featuredOnHome: Boolean(item.featuredOnHome),
          homeOrder: normalizedHomeOrder(item.homeOrder),
        });
      }
    }
    for (const slug of [...homeDraft.keys()]) {
      if (!existingSlugs.has(slug)) homeDraft.delete(slug);
    }
  }

  function renameHomeDraftSlug(previousSlug, newSlug) {
    if (!homeDraft || previousSlug === newSlug) return;
    const entry = homeDraft.get(previousSlug);
    if (!entry) return;
    homeDraft.delete(previousSlug);
    homeDraft.set(newSlug, entry);
  }

  function selectedHomeCases() {
    syncHomeDraft();
    return state.cases
      .filter((item) => homeDraft.get(item.slug)?.featuredOnHome)
      .sort((a, b) => {
        const order = normalizedHomeOrder(homeDraft.get(a.slug)?.homeOrder) - normalizedHomeOrder(homeDraft.get(b.slug)?.homeOrder);
        return order || a.title.localeCompare(b.title, "pt-BR");
      });
  }

  function normalizeHomeDraftOrder() {
    if (!homeDraft) return;
    const selected = state.cases
      .filter((item) => homeDraft.get(item.slug)?.featuredOnHome)
      .sort((a, b) => {
        const order = normalizedHomeOrder(homeDraft.get(a.slug)?.homeOrder) - normalizedHomeOrder(homeDraft.get(b.slug)?.homeOrder);
        return order || a.title.localeCompare(b.title, "pt-BR");
      });
    selected.forEach((item, index) => {
      homeDraft.set(item.slug, { featuredOnHome: true, homeOrder: index });
    });
    for (const [slug, entry] of homeDraft) {
      if (!entry.featuredOnHome) homeDraft.set(slug, { featuredOnHome: false, homeOrder: 999 });
    }
  }

  function hasHomeDraftChanges() {
    syncHomeDraft();
    return state.cases.some((item) => {
      const entry = homeDraft.get(item.slug) || { featuredOnHome: false, homeOrder: 999 };
      const nextFeatured = Boolean(entry.featuredOnHome);
      const nextOrder = nextFeatured ? normalizedHomeOrder(entry.homeOrder) : 999;
      return Boolean(item.featuredOnHome) !== nextFeatured || normalizedHomeOrder(item.homeOrder) !== nextOrder;
    });
  }

  function updateHomeSearch(value) {
    homeSearch = String(value || "");
    window.cancelAnimationFrame(homeSearchFrame);
    homeSearchFrame = window.requestAnimationFrame(() => {
      const list = document.querySelector(".home-case-list");
      if (list) list.innerHTML = renderHomeCaseList();
      else renderHomeSettings();
    });
  }

  function toggleHomeCase(slug, featured) {
    const item = getCase(slug);
    if (!item) return;
    syncHomeDraft();
    const selectedCount = [...homeDraft.values()].filter((entry) => entry.featuredOnHome).length;
    homeDraft.set(item.slug, {
      featuredOnHome: Boolean(featured),
      homeOrder: featured ? selectedCount : 999,
    });
    normalizeHomeDraftOrder();
    renderHomeSettings();
  }

  function moveHomeCase(slug, direction) {
    syncHomeDraft();
    const selected = selectedHomeCases();
    const currentIndex = selected.findIndex((item) => item.slug === slug);
    if (currentIndex < 0) return;
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= selected.length) return;
    const [item] = selected.splice(currentIndex, 1);
    selected.splice(nextIndex, 0, item);
    selected.forEach((entry, index) => {
      homeDraft.set(entry.slug, { featuredOnHome: true, homeOrder: index });
    });
    renderHomeSettings();
  }

  function reorderHomeByDrag(fromSlug, toSlug) {
    syncHomeDraft();
    if (!fromSlug || !toSlug || fromSlug === toSlug) return;
    const selected = selectedHomeCases();
    const fromIndex = selected.findIndex((item) => item.slug === fromSlug);
    const toIndex = selected.findIndex((item) => item.slug === toSlug);
    if (fromIndex < 0 || toIndex < 0) return;
    const [item] = selected.splice(fromIndex, 1);
    selected.splice(toIndex, 0, item);
    selected.forEach((entry, index) => {
      homeDraft.set(entry.slug, { featuredOnHome: true, homeOrder: index });
    });
    renderHomeSettings();
  }

  function resetHomeSettingsDraft() {
    homeDraft = null;
    renderHomeSettings();
  }

  async function saveHomeSettings() {
    syncHomeDraft();
    const changed = [];

    for (const item of state.cases) {
      const entry = homeDraft.get(item.slug) || { featuredOnHome: false, homeOrder: 999 };
      const featuredOnHome = Boolean(entry.featuredOnHome);
      const homeOrder = featuredOnHome ? normalizedHomeOrder(entry.homeOrder) : 999;
      if (Boolean(item.featuredOnHome) === featuredOnHome && normalizedHomeOrder(item.homeOrder) === homeOrder) continue;

      item.featuredOnHome = featuredOnHome;
      item.homeOrder = homeOrder;
      item.updatedAt = new Date().toISOString();
      changed.push(item);
    }

    if (!changed.length) {
      setNotice("success", "Nenhuma alteracao para salvar.");
      renderHomeSettings();
      return;
    }

    const { error } = await persistCaseBatch(changed);
    if (error) {
      setNotice("error", error.message);
      renderHomeSettings();
      return;
    }

    homeDraft = null;
    setNotice("success", "Home atualizada.");
    renderHomeSettings();
  }

  return {
    createCase,
    deleteCase,
    moveHomeCase,
    openDeleteModal,
    removeCover,
    removeImage,
    renderDashboard,
    renderEditor,
    renderHomeSettings,
    reorderByDrag,
    reorderHomeByDrag,
    replaceCover,
    resetHomeSettingsDraft,
    saveCurrentCase,
    saveHomeSettings,
    toggleHomeCase,
    updateCmsCaseField,
    updateCmsCaseTag,
    updateDashboardFilter,
    updateDashboardSearch,
    updateHomeSearch,
    uploadCaseImages,
  };
}
