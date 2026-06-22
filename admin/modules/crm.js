import {
  BUDGET_STATUSES,
  CLIENT_STATUSES,
  CLIENT_TYPES,
  CRM_TABS,
  CRM_STATE_KEYS,
  ORDER_STATUSES,
  ORDER_RECURRENCES,
  PRODUCT_PRICING_MODELS,
  PROJECT_STATUSES,
  SUBSTRATE_ACQUISITION_TYPES,
  SUBSTRATE_PASS_THROUGH_METHODS,
} from "./constants.js?v=14";
import { calculateProductPricing, roundMoney } from "./pricingEngine.js?v=1";
import { calculateAppliedSubstrateCost } from "./substratePricing.js?v=1";
import {
  dateInputValue,
  entityName,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatDateTime,
  labelFromOptions,
  nonNegativeNumberFromForm,
  optionalDateFromForm,
  optionalEmailFromForm,
  optionalFormValue,
  optionalUrlFromForm,
  requiredDateFromForm,
  requiredTextFromForm,
  scopeText,
  selectOptions,
  validateDateOrder,
  valueAttr,
} from "./utils.js?v=3";

export function createCrmModule({ state, getSupabase, isLoggedIn, setNotice, clearNotice, render, renderShell, loadAdminData, loadFinancialSettings }) {
  function supabase() {
    return getSupabase();
  }

  function crmItems(table) {
    return state[CRM_STATE_KEYS[table]] || [];
  }

  function crmEditRecord(table) {
    if (state.crmEdit?.table !== table) return null;
    return crmItems(table).find((item) => item.id === state.crmEdit.id) || null;
  }

  function isSubmitting(table) {
    return state.crmSubmitting === table;
  }

  function crmFormAttrs(table) {
    return `aria-busy="${isSubmitting(table) ? "true" : "false"}"`;
  }

  function renderCrmFormActions(table, record, createLabel, updateLabel) {
    const submitting = isSubmitting(table);
    const label = record ? updateLabel : createLabel;
    return `
      <div class="form-actions">
        <button class="button button-primary ${submitting ? "is-loading" : ""}" type="submit" ${submitting ? "disabled" : ""}>
          ${submitting ? `<span class="spinner" aria-hidden="true"></span><span>Salvando...</span>` : escapeHtml(label)}
        </button>
        ${record ? `<button class="button button-secondary" type="button" data-cancel-crm-edit ${submitting ? "disabled" : ""}>Cancelar edição</button>` : ""}
      </div>`;
  }

  async function saveCrmRecord(table, payload, editing) {
    const client = supabase();
    if (editing) {
      return client
        .from(table)
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editing.id);
    }

    return client.from(table).insert(payload);
  }

  function routeKey() {
    const [section, slug] = window.location.hash.replace(/^#\/?/, "").split("/");
    if (section === "crm" && slug) return `crm/${slug}`;
    return section || "home";
  }

  function renderTablePage(table) {
    if (table === "clients") return renderClients();
    if (table === "contacts") return renderClients();
    if (table === "projects") return renderProjects();
    if (table === "products") return renderProducts();
    if (table === "substrates") return renderSubstrates();
    if (table === "budgets") return renderBudgets();
    if (table === "service_orders") return renderServiceOrders();
    if (table === "time_entries") return renderTimeEntries();
    render();
  }

  function renderCrmPage(tab = "clients") {
    if (tab === "products") return renderProducts();
    if (tab === "substrates") return renderSubstrates();
    if (tab === "budgets") return renderBudgets();
    if (tab === "orders") return renderServiceOrders();
    return renderClients();
  }

  function renderAdminDashboard() {
    renderShell(`
      <main class="page platform-start-page">
        ${renderCrmNotice()}
        <section class="platform-start-panel">
          <div>
            <h1>Página inicial</h1>
          </div>
        </section>
      </main>`);
  }

  function renderDashboardNavCard(card) {
    return `
      <a class="dashboard-nav-card" href="${escapeHtml(card.href)}">
        <span class="dashboard-nav-icon" aria-hidden="true">${dashboardNavIcon(card.icon)}</span>
        <span class="dashboard-nav-content">
          <strong>${escapeHtml(card.title)}</strong>
          ${card.description ? `<span>${escapeHtml(card.description)}</span>` : ""}
        </span>
        <span class="dashboard-nav-action">
          <span>Abrir</span>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7 4.5L12.5 10L7 15.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </a>`;
  }

  function renderPlatformProfile() {
    const user = state.session?.user || {};
    const email = user.email || "";
    const name = user.user_metadata?.name || user.user_metadata?.full_name || email.split("@")[0] || "Usuário";
    const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
    const initials = String(name || email || "U").trim().slice(0, 1).toUpperCase() || "U";

    return `
      <section class="platform-home-profile" aria-label="Perfil">
        <a class="profile-view" href="#/home" aria-label="Ver perfil">
          <span class="profile-avatar" aria-hidden="true">
            ${avatar ? `<img src="${escapeHtml(avatar)}" alt="">` : `<span>${escapeHtml(initials)}</span>`}
          </span>
          <span class="profile-copy">
            <strong>Ver perfil</strong>
            <small>${escapeHtml(email || name)}</small>
          </span>
        </a>
        <button class="button button-ghost" type="button" data-logout>Log out</button>
      </section>`;
  }

  function dashboardNavIcon(icon) {
    const icons = {
      cms: `
        <svg viewBox="0 0 28 28" fill="none">
          <path d="M6.5 7.5H21.5V20.5H6.5V7.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M10 12H18M10 16H15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M8.5 5.5H19.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>`,
      home: `
        <svg viewBox="0 0 28 28" fill="none">
          <path d="M6 13.2L14 6.5L22 13.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8.5 12V21H19.5V12" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M12 21V16.5H16V21" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        </svg>`,
      crm: `
        <svg viewBox="0 0 28 28" fill="none">
          <path d="M8 19.5C8.8 16.7 10.8 15.2 14 15.2C17.2 15.2 19.2 16.7 20 19.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M14 12.8C16 12.8 17.2 11.6 17.2 9.8C17.2 8 16 6.8 14 6.8C12 6.8 10.8 8 10.8 9.8C10.8 11.6 12 12.8 14 12.8Z" stroke="currentColor" stroke-width="1.6"/>
          <path d="M5.5 21.5H22.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>`,
      metrics: `
        <svg viewBox="0 0 28 28" fill="none">
          <path d="M7 21V15.5M14 21V8M21 21V12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M5.5 21.5H22.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M7 12L12.5 9L16 11.5L21 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
    };

    return icons[icon] || icons.cms;
  }

  function renderDashboardKpi(label, value, caption) {
    return `
      <article class="dashboard-kpi">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(caption)}</small>
      </article>`;
  }

  function renderRecentBudgetList(items = []) {
    if (!items.length) return `<div class="empty-state compact-empty">Nenhum orçamento cadastrado.</div>`;
    return `
      <div class="dashboard-list">
        ${items.map((budget) => `
          <a class="dashboard-list-row" href="#/crm/budgets" aria-label="Abrir orçamento ${escapeHtml(budget.title || budgetNumberLabel(budget))}">
            <div>
              <strong>${escapeHtml(budget.title || "Sem título")}</strong>
              <span>${escapeHtml(budgetNumberLabel(budget))} · ${escapeHtml(entityName(state.clients, budget.client_id))}</span>
            </div>
            <div>
              <strong>${formatCurrency(budget.total, budget.currency || "BRL")}</strong>
              <span>${escapeHtml(labelFromOptions(BUDGET_STATUSES, budget.status))} · ${formatDate(budget.created_at)}</span>
            </div>
          </a>
        `).join("")}
      </div>`;
  }

  function renderRecentOrderList(items = []) {
    if (!items.length) return `<div class="empty-state compact-empty">Nenhuma OS aberta.</div>`;
    return `
      <div class="dashboard-list">
        ${items.map((order) => `
          <a class="dashboard-list-row" href="#/crm/orders" aria-label="Abrir OS ${escapeHtml(order.title)}">
            <div>
              <strong>${escapeHtml(order.title || "Sem título")}</strong>
              <span>${escapeHtml(entityName(state.clients, order.client_id))} · ${escapeHtml(entityName(state.projects, order.project_id))}</span>
            </div>
            <div>
              <strong>${escapeHtml(formatDate(order.due_at))}</strong>
              <span>${escapeHtml(orderBudgetLabel(order))}</span>
            </div>
          </a>
        `).join("")}
      </div>`;
  }

  function blockSubmitWithNotice(table, message) {
    setNotice("error", message);
    renderTablePage(table);
  }

  function validateCrmPayload(table, errors) {
    if (errors.length) {
      blockSubmitWithNotice(table, errors[0]);
      return false;
    }
    return true;
  }

  async function submitCrmRecord(table, payload, editing, successMessage) {
    if (isSubmitting(table)) return;
    if (!supabase() || !isLoggedIn()) {
      blockSubmitWithNotice(table, "Supabase indisponível. Tente novamente em instantes.");
      return;
    }

    const noticeRoute = routeKey();
    state.crmSubmitting = table;
    refreshSubmittingModal(table, editing);
    renderTablePage(table);

    let error = null;
    try {
      const result = await saveCrmRecord(table, payload, editing);
      error = result.error;
    } catch (caught) {
      error = caught;
    }

    await afterCrmMutation(error, successMessage, noticeRoute, table, editing);
  }

  function refreshSubmittingModal(table, record) {
    if (!state.modal) return;
    if (table === "clients") state.modal = renderClientModal(record);
    if (table === "projects") state.modal = renderProjectModal(record);
    if (table === "budgets") state.modal = renderBudgetModal(record);
    if (table === "service_orders") state.modal = renderServiceOrderModal(record);
    if (table === "contacts") state.modal = renderContactModal(record, record?.client_id || "");
    if (table === "products") state.modal = renderProductModal(record);
    if (table === "substrates") state.modal = renderSubstrateModal(record);
  }

  function renderCrmNotice() {
    return !supabase() ? `<div class="notice notice-error is-visible">Configure o Supabase para usar o CRM.</div>` : "";
  }

  function renderCrmWorkspace(activeTab, { eyebrow, title, subtitle, actions = "", metrics = "", body }) {
    renderShell(`
      <main class="page crm-page">
        <section class="page-header">
          <div class="page-title">
            <h1>${escapeHtml(title)}</h1>
            <p class="section-subtitle">${escapeHtml(subtitle)}</p>
          </div>
          ${actions ? `<div class="editor-actions">${actions}</div>` : ""}
        </section>

        ${renderCrmNotice()}
        ${metrics}
        ${body}
      </main>`);
  }

  function renderClients() {
    renderCrmWorkspace("clients", {
      eyebrow: "Clientes",
      title: "Clientes",
      subtitle: `${state.clients.length} registros no CRM`,
      actions: `<button class="button button-primary" type="button" data-open-client-modal>+ Novo cliente</button>`,
      body: `
        <section class="crm-panel-stack">
          <section class="panel data-panel">
            ${renderClientTable()}
          </section>
        </section>`,
    });
  }

  function renderClientTable() {
    if (!state.clients.length) return `<div class="empty-state">Nenhum cliente cadastrado.</div>`;

    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contato</th>
              <th>Pessoas</th>
              <th>Status</th>
              <th>Atualizado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${state.clients.map((client) => {
              const contacts = clientContacts(client.id);
              const primaryContact = contacts[0];
              return `
                <tr>
                  <td>
                    <strong>${escapeHtml(client.name)}</strong>
                    <span>${escapeHtml(labelFromOptions(CLIENT_TYPES, client.type))}</span>
                  </td>
                  <td>
                    <strong>${escapeHtml(primaryContact?.name || client.email || client.phone || "-")}</strong>
                    <span>${escapeHtml(primaryContact?.email || primaryContact?.phone || client.website || client.document || "")}</span>
                  </td>
                  <td>
                    <strong>${contacts.length}</strong>
                    <span>${contacts.length === 1 ? "contato cadastrado" : "contatos cadastrados"}</span>
                  </td>
                  <td><span class="status-pill">${escapeHtml(labelFromOptions(CLIENT_STATUSES, client.status))}</span></td>
                  <td>${formatDate(client.updated_at || client.created_at)}</td>
                  <td>
                    <div class="row-actions">
                      <button class="icon-button" type="button" data-view-client="${escapeHtml(client.id)}">Detalhes</button>
                      <button class="icon-button" type="button" data-open-client-modal="${escapeHtml(client.id)}">Editar</button>
                      <button class="icon-button" type="button" data-delete-crm="clients:${escapeHtml(client.id)}">Excluir</button>
                    </div>
                  </td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function openClientModal(id = "") {
    const client = state.clients.find((item) => item.id === id) || null;
    state.crmEdit = client ? { table: "clients", id: client.id } : null;
    state.modal = renderClientModal(client);
    clearNotice();
    render();
  }

  function renderClientModal(client) {
    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${client ? "Editar cliente" : "Novo cliente"}">
        <form class="modal modal-wide form-stack crm-editor-form" data-client-form ${crmFormAttrs("clients")}>
          <div class="modal-header">
            <div>
              <h2>${client ? "Editar cliente" : "Novo cliente"}</h2>
            </div>
            <button class="icon-button" type="button" data-close-modal>Fechar</button>
          </div>
          
          <div class="crm-form-sections">
            <section class="crm-form-section">
              <div class="budget-section-heading">
                <strong>Dados comerciais</strong>
              </div>
              <div class="crm-form-grid">
                <label class="field field-span-2">
                  <span>Nome</span>
                  <input class="input" name="name" value="${valueAttr(client?.name)}" required>
                </label>
                <label class="field">
                  <span>Tipo de cliente</span>
                  <select class="select" name="type" data-client-type-select>
                    <option value="company" ${client?.type === "company" || !client ? "selected" : ""}>Pessoa Jurídica</option>
                    <option value="person" ${client?.type === "person" ? "selected" : ""}>Pessoa Física</option>
                  </select>
                </label>
                <label class="field">
                  <span>Status</span>
                  <select class="select" name="status">${selectOptions(CLIENT_STATUSES, client?.status || "active")}</select>
                </label>
                <label class="field field-span-2">
                  <span>Documento (CPF / CNPJ)</span>
                  <input class="input" name="document" value="${valueAttr(client?.document)}" placeholder="00.000.000/0000-00">
                </label>
                <label class="field" data-tax-fields style="${client?.type === "person" ? "display: none;" : ""}">
                  <span>Inscrição Estadual</span>
                  <input class="input" name="state_registration" value="${valueAttr(client?.state_registration)}">
                </label>
                <label class="field" data-tax-fields style="${client?.type === "person" ? "display: none;" : ""}">
                  <span>Inscrição Municipal</span>
                  <input class="input" name="municipal_registration" value="${valueAttr(client?.municipal_registration)}">
                </label>
                <label class="field field-span-2">
                  <span>Indicação</span>
                  <select class="select" name="referral_source">
                    <option value="">Sem indicação</option>
                    ${state.clients
                      .filter(c => c.id !== client?.id)
                      .map(c => `<option value="${escapeHtml(c.id)}" ${client?.referral_source === c.id || client?.referral_source === c.name ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
                      .join("")}
                  </select>
                </label>
                <label class="field field-span-2">
                  <span>Comissão (%)</span>
                  <input class="input" name="commission_rate" type="number" min="0" max="100" step="0.01" value="${valueAttr(client?.commission_rate ?? "")}">
                </label>
              </div>
            </section>

            <section class="crm-form-section">
              <div class="budget-section-heading">
                <strong>Dados de contato</strong>
              </div>
              <div class="crm-form-grid">
                <label class="field field-span-2">
                  <span>E-mail principal</span>
                  <input class="input" name="email" type="email" value="${valueAttr(client?.email)}">
                </label>
                <label class="field field-span-2">
                  <span>E-mail de cobrança</span>
                  <input class="input" name="billing_email" type="email" value="${valueAttr(client?.billing_email)}">
                </label>
                <label class="field field-span-2">
                  <span>Telefone</span>
                  <input class="input" name="phone" value="${valueAttr(client?.phone)}" placeholder="(00) 00000-0000">
                </label>
                <label class="field field-span-2">
                  <span>Website</span>
                  <input class="input" name="website" type="text" inputmode="url" value="${valueAttr(client?.website)}" placeholder="raksa.com.br">
                </label>
              </div>
            </section>

            <section class="crm-form-section">
              <div class="budget-section-heading">
                <strong>Endereço Comercial</strong>
              </div>
              <div class="crm-form-grid">
                <label class="field">
                  <span>CEP</span>
                  <input class="input" name="postal_code" value="${valueAttr(client?.postal_code)}" placeholder="00000-000">
                </label>
                <label class="field field-span-2">
                  <span>Rua</span>
                  <input class="input" name="street" value="${valueAttr(client?.street)}">
                </label>
                <label class="field">
                  <span>Número</span>
                  <input class="input" name="number" value="${valueAttr(client?.number)}">
                </label>
                <label class="field field-span-2">
                  <span>Complemento</span>
                  <input class="input" name="complement" value="${valueAttr(client?.complement)}">
                </label>
                <label class="field field-span-2">
                  <span>Bairro</span>
                  <input class="input" name="neighborhood" value="${valueAttr(client?.neighborhood)}">
                </label>
                <label class="field field-span-2">
                  <span>Cidade</span>
                  <input class="input" name="city" value="${valueAttr(client?.city)}">
                </label>
                <label class="field">
                  <span>Estado</span>
                  <input class="input" name="state" value="${valueAttr(client?.state)}">
                </label>
                <label class="field">
                  <span>País</span>
                  <input class="input" name="country" value="${valueAttr(client?.country || "Brasil")}">
                </label>
              </div>
            </section>

            <section class="crm-form-section">
              <div class="budget-section-heading">
                <strong>Endereço de Faturamento</strong>
              </div>
              <div class="toggle-row" style="margin-bottom: 14px;">
                <input type="checkbox" name="billing_same_as_commercial" data-billing-same-toggle ${client?.billing_same_as_commercial !== false ? "checked" : ""}>
                <span>Mesmo do comercial</span>
              </div>
              <div class="crm-form-grid" data-billing-address-fields style="display: ${client?.billing_same_as_commercial !== false ? "none" : "grid"};">
                <label class="field">
                  <span>CEP</span>
                  <input class="input" name="billing_postal_code" value="${valueAttr(client?.billing_postal_code)}" placeholder="00000-000">
                </label>
                <label class="field field-span-2">
                  <span>Rua</span>
                  <input class="input" name="billing_street" value="${valueAttr(client?.billing_street)}">
                </label>
                <label class="field">
                  <span>Número</span>
                  <input class="input" name="billing_number" value="${valueAttr(client?.billing_number)}">
                </label>
                <label class="field field-span-2">
                  <span>Complemento</span>
                  <input class="input" name="billing_complement" value="${valueAttr(client?.billing_complement)}">
                </label>
                <label class="field field-span-2">
                  <span>Bairro</span>
                  <input class="input" name="billing_neighborhood" value="${valueAttr(client?.billing_neighborhood)}">
                </label>
                <label class="field field-span-2">
                  <span>Cidade</span>
                  <input class="input" name="billing_city" value="${valueAttr(client?.billing_city)}">
                </label>
                <label class="field">
                  <span>Estado</span>
                  <input class="input" name="billing_state" value="${valueAttr(client?.billing_state)}">
                </label>
                <label class="field">
                  <span>País</span>
                  <input class="input" name="billing_country" value="${valueAttr(client?.billing_country || "Brasil")}">
                </label>
              </div>
            </section>

            <section class="crm-form-section">
              <div class="budget-section-heading">
                <strong>Notas</strong>
              </div>
              <div class="crm-form-grid">
                <label class="field field-span-4">
                  <span>Notas sobre o cliente</span>
                  <textarea class="textarea textarea-small" name="notes">${escapeHtml(client?.notes || "")}</textarea>
                </label>
              </div>
            </section>
          </div>
          ${renderCrmFormActions("clients", client, "Criar cliente", "Salvar cliente")}
        </form>
      </div>`;
  }

  function openClientDetailsModal(id = "") {
    const client = state.clients.find((item) => item.id === id) || null;
    if (!client) return;
    state.crmEdit = null;
    state.modal = renderClientDetailsModal(client);
    clearNotice();
    render();
  }

  function renderClientDetailsModal(client) {
    const contacts = clientContacts(client.id);
    const referralName = state.clients.find((c) => c.id === client.referral_source)?.name || client.referral_source || "-";
    
    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Detalhes do cliente">
        <div class="modal modal-wide form-stack">
          <div class="modal-header">
            <div>
              <h2>${escapeHtml(client.name)}</h2>
            </div>
            <div class="modal-actions">
              <button class="button button-secondary" type="button" data-open-contact-modal="${escapeHtml(client.id)}">Novo contato</button>
              <button class="button button-primary" type="button" data-open-client-modal="${escapeHtml(client.id)}">Editar</button>
              <button class="icon-button" type="button" data-close-modal>Fechar</button>
            </div>
          </div>
          
          <div class="crm-details-sections">
            <section class="details-section">
              <div class="budget-section-heading">
                <strong>Dados comerciais</strong>
              </div>
              <div class="detail-grid">
                <div class="detail-item">
                  <span>Tipo</span>
                  <strong>${client.type === "person" ? "Pessoa Física" : "Pessoa Jurídica"}</strong>
                </div>
                <div class="detail-item">
                  <span>Status</span>
                  <strong>${labelFromOptions(CLIENT_STATUSES, client.status)}</strong>
                </div>
                <div class="detail-item">
                  <span>Documento</span>
                  <strong>${client.document || "-"}</strong>
                </div>
                ${client.type !== "person" ? `
                  <div class="detail-item">
                    <span>Inscrição Estadual</span>
                    <strong>${client.state_registration || "-"}</strong>
                  </div>
                  <div class="detail-item">
                    <span>Inscrição Municipal</span>
                    <strong>${client.municipal_registration || "-"}</strong>
                  </div>
                ` : ""}
                <div class="detail-item">
                  <span>Indicação</span>
                  <strong>${escapeHtml(referralName)}</strong>
                </div>
                <div class="detail-item">
                  <span>Comissão</span>
                  <strong>${Number(client.commission_rate || 0) ? `${formatPercent(client.commission_rate)} comissão` : "-"}</strong>
                </div>
              </div>
            </section>

            <section class="details-section">
              <div class="budget-section-heading">
                <strong>Dados de contato</strong>
              </div>
              <div class="detail-grid">
                <div class="detail-item">
                  <span>E-mail</span>
                  <strong>${client.email || "-"}</strong>
                </div>
                <div class="detail-item">
                  <span>E-mail de cobrança</span>
                  <strong>${client.billing_email || "-"}</strong>
                </div>
                <div class="detail-item">
                  <span>Telefone</span>
                  <strong>${client.phone || "-"}</strong>
                </div>
                <div class="detail-item">
                  <span>Website</span>
                  <strong>${client.website || "-"}</strong>
                </div>
              </div>
            </section>

            <section class="details-section">
              <div class="budget-section-heading">
                <strong>Endereço</strong>
              </div>
              <div class="detail-grid">
                <div class="detail-item field-span-2">
                  <span>Endereço Comercial</span>
                  <strong>
                    ${client.street ? `
                      ${escapeHtml(client.street)}, ${escapeHtml(client.number || "s/n")}
                      ${client.complement ? ` - ${escapeHtml(client.complement)}` : ""}
                      <br>${escapeHtml(client.neighborhood || "")}
                      <br>${escapeHtml(client.city || "")} - ${escapeHtml(client.state || "")}
                      <br>CEP ${escapeHtml(client.postal_code || "")}
                      ${client.country && client.country !== "Brasil" ? `<br>${escapeHtml(client.country)}` : ""}
                    ` : (client.address || "-")}
                  </strong>
                </div>
                <div class="detail-item field-span-2">
                  <span>Endereço de Faturamento</span>
                  <strong>
                    ${client.billing_same_as_commercial !== false ? "Mesmo do comercial" : `
                      ${client.billing_street ? `
                        ${escapeHtml(client.billing_street)}, ${escapeHtml(client.billing_number || "s/n")}
                        ${client.billing_complement ? ` - ${escapeHtml(client.billing_complement)}` : ""}
                        <br>${escapeHtml(client.billing_neighborhood || "")}
                        <br>${escapeHtml(client.billing_city || "")} - ${escapeHtml(client.billing_state || "")}
                        <br>CEP ${escapeHtml(client.billing_postal_code || "")}
                        ${client.billing_country && client.billing_country !== "Brasil" ? `<br>${escapeHtml(client.billing_country)}` : ""}
                      ` : "-"}
                    `}
                  </strong>
                </div>
              </div>
            </section>
          </div>

          <section class="notes-section">
            <div class="budget-section-heading">
              <strong>Notas sobre o cliente</strong>
            </div>
            <p style="color: var(--muted); margin: 0; white-space: pre-wrap; font-size: 14px; line-height: 1.5;">${escapeHtml(client.notes) || "Nenhuma nota cadastrada."}</p>
          </section>

          <section class="budget-section">
            <div class="budget-section-heading">
              <strong>Pessoas de contato</strong>
              <span>${contacts.length ? `${contacts.length} pessoa${contacts.length === 1 ? "" : "s"} vinculada${contacts.length === 1 ? "" : "s"}` : "Nenhum contato cadastrado"}</span>
            </div>
            ${contacts.length ? `
              <div class="table-wrap" style="margin-top: 10px;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Nome do contato</th>
                      <th>E-mail</th>
                      <th>Celular</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${contacts.map((contact) => `
                      <tr>
                        <td>
                          <strong>${escapeHtml(contact.name)}</strong>
                          <span>${escapeHtml(contact.role || "")}</span>
                        </td>
                        <td>${escapeHtml(contact.email || "-")}</td>
                        <td>${escapeHtml(contact.phone || "-")}</td>
                        <td>
                          <div class="row-actions">
                            <button class="icon-button" type="button" data-open-contact-modal="${escapeHtml(client.id)}" data-contact-id="${escapeHtml(contact.id)}">Editar</button>
                            <button class="icon-button" type="button" data-delete-crm="contacts:${escapeHtml(contact.id)}">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>` : `<div class="empty-state compact-empty">Nenhum contato cadastrado.</div>`}
          </section>
        </div>
      </div>`;
  }

  function renderContactTable() {
    if (!state.contacts.length) {
      return `
        <section class="crm-related-panel">
          <div class="crm-list-heading">
            <div class="page-title">
              <h2>Contatos</h2>
              <p class="section-subtitle">Cadastre as pessoas que pedem e recebem propostas por cliente.</p>
            </div>
            <button class="button button-secondary" type="button" data-open-contact-modal>+ Novo contato</button>
          </div>
          <div class="empty-state">Nenhum contato cadastrado.</div>
        </section>`;
    }

    return `
      <section class="crm-related-panel">
        <div class="crm-list-heading">
          <div class="page-title">
            <h2>Contatos</h2>
            <p class="section-subtitle">Pessoas vinculadas aos clientes para orçamentos e envio de propostas.</p>
          </div>
          <button class="button button-secondary" type="button" data-open-contact-modal>+ Novo contato</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cliente</th>
                <th>Cargo</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${state.contacts.map((contact) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(contact.name)}</strong>
                    <span>${escapeHtml(contact.notes || "")}</span>
                  </td>
                  <td>${escapeHtml(entityName(state.clients, contact.client_id))}</td>
                  <td>${escapeHtml(contact.role || "-")}</td>
                  <td>${escapeHtml(contact.email || "-")}</td>
                  <td>${escapeHtml(contact.phone || "-")}</td>
                  <td>
                    <div class="row-actions">
                      <button class="icon-button" type="button" data-open-contact-modal="${escapeHtml(contact.client_id || "")}" data-contact-id="${escapeHtml(contact.id)}">Editar</button>
                      <button class="icon-button" type="button" data-delete-crm="contacts:${escapeHtml(contact.id)}">Excluir</button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function renderProjects() {
    const totalBudget = state.projects.reduce((sum, project) => sum + Number(project.budget_total || 0), 0);
    const statusCards = PROJECT_STATUSES.map(([id, label]) => [label, state.projects.filter((project) => project.status === id).length]);

    renderCrmWorkspace("projects", {
      eyebrow: "Projetos",
      title: "Projetos",
      subtitle: `${state.projects.length} projetos cadastrados`,
      actions: `<button class="button button-primary" type="button" data-open-project-modal>+ Novo projeto</button>`,
      metrics: `
        <section class="metrics crm-metrics" aria-label="Resumo de projetos">
          <div class="metric">
            <strong>${formatCurrency(totalBudget)}</strong>
            <span>Valor previsto</span>
          </div>
          ${statusCards.map(([label, count]) => `
            <div class="metric">
              <strong>${count}</strong>
              <span>${escapeHtml(label)}</span>
            </div>
          `).join("")}
        </section>`,
      body: `
        <section class="crm-panel-stack">
          <section class="panel data-panel">
            <div class="crm-list-heading">
              <div class="page-title">
                <h2>Projetos ativos e históricos</h2>
                <p class="section-subtitle">Funil operacional de trabalho.</p>
              </div>
            </div>
            ${renderProjectTable()}
          </section>
        </section>`,
    });
  }

  function openProjectModal(id = "") {
    const project = state.projects.find((item) => item.id === id) || null;
    state.crmEdit = project ? { table: "projects", id: project.id } : null;
    state.modal = renderProjectModal(project);
    clearNotice();
    render();
  }

  function renderProjectModal(project) {
    const clientOptions = state.clients.map((client) => [client.id, client.name]);
    const caseOptions = state.cases.map((item) => [item.id, item.title]);

    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${project ? "Editar projeto" : "Novo projeto"}">
        <form class="modal modal-wide form-stack crm-editor-form" data-project-form ${crmFormAttrs("projects")}>
          <div class="modal-header">
            <div>
              <span class="eyebrow">Projeto</span>
              <h2>${project ? "Editar projeto" : "Novo projeto"}</h2>
            </div>
            <button class="icon-button" type="button" data-close-modal>Fechar</button>
          </div>
          <p class="section-subtitle">${project ? "Atualize status, prazo e previsão financeira." : "Vincule cliente, case e previsão financeira."}</p>
          <div class="crm-form-grid">
            <label class="field field-span-2">
              <span>Nome</span>
              <input class="input" name="name" value="${valueAttr(project?.name)}" required>
            </label>
            <label class="field">
              <span>Cliente</span>
              <select class="select" name="client_id">${selectOptions(clientOptions, project?.client_id || "", "Sem cliente")}</select>
            </label>
            <label class="field">
              <span>Status</span>
              <select class="select" name="status">${selectOptions(PROJECT_STATUSES, project?.status || "lead")}</select>
            </label>
            <label class="field">
              <span>Case relacionado</span>
              <select class="select" name="case_id">${selectOptions(caseOptions, project?.case_id || "", "Sem case")}</select>
            </label>
            <label class="field">
              <span>Início</span>
              <input class="input" name="starts_at" type="date" value="${valueAttr(dateInputValue(project?.starts_at))}">
            </label>
            <label class="field">
              <span>Prazo</span>
              <input class="input" name="due_at" type="date" value="${valueAttr(dateInputValue(project?.due_at))}">
            </label>
            <label class="field">
              <span>Valor previsto</span>
              <input class="input" name="budget_total" type="number" min="0" step="0.01" placeholder="0.00" value="${valueAttr(project?.budget_total ?? "")}">
            </label>
            <label class="field field-span-4">
              <span>Descrição</span>
              <textarea class="textarea textarea-small" name="description">${escapeHtml(project?.description || "")}</textarea>
            </label>
          </div>
          ${renderCrmFormActions("projects", project, "Criar projeto", "Salvar projeto")}
        </form>
      </div>`;
  }

  function renderProjectTable() {
    if (!state.projects.length) return `<div class="empty-state">Nenhum projeto cadastrado.</div>`;

    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Projeto</th>
              <th>Cliente</th>
              <th>Status</th>
              <th>Valor</th>
              <th>Prazo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${state.projects.map((project) => `
              <tr>
                <td>
                  <strong>${escapeHtml(project.name)}</strong>
                  <span>${escapeHtml(project.description || "")}</span>
                </td>
                <td>${escapeHtml(entityName(state.clients, project.client_id))}</td>
                <td><span class="status-pill">${escapeHtml(labelFromOptions(PROJECT_STATUSES, project.status))}</span></td>
                <td>${formatCurrency(project.budget_total)}</td>
                <td>${formatDate(project.due_at)}</td>
                <td>
                  <div class="row-actions">
                    <button class="icon-button" type="button" data-open-project-modal="${escapeHtml(project.id)}">Editar</button>
                    <button class="icon-button" type="button" data-delete-crm="projects:${escapeHtml(project.id)}">Excluir</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderProducts() {
    const products = filteredProducts();
    renderCrmWorkspace("products", {
      eyebrow: "Configurações",
      title: "Produtos",
      subtitle: `${state.products.length} produtos cadastrados`,
      actions: `<button class="button button-primary" type="button" data-open-product-modal>+ Novo produto</button>`,
      body: `
        <section class="crm-panel-stack">
          <section class="panel data-panel">
            ${renderCatalogToolbar("product", products.length)}
            ${renderProductTable(products)}
          </section>
        </section>`,
    });
  }

  function renderProductTable(products = state.products) {
    if (!products.length) return `<div class="empty-state">Nenhum produto encontrado.</div>`;

    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Horas padrão</th>
              <th>Substratos padrão</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${products.map((product) => `
              <tr>
                <td>
                  <strong>${escapeHtml(product.name)}</strong>
                  <span>${escapeHtml(product.description || "")}</span>
                </td>
                <td>${escapeHtml(product.category || "-")}</td>
                <td>${formatDecimalHours(product.hours_per_unit || product.estimated_hours || 0)}</td>
                <td>${escapeHtml(productLinkedSubstrates(product).map((item) => item.name).join(", ") || "-")}</td>
                <td><span class="status-pill">${product.status === "inactive" ? "Inativo" : "Ativo"}</span></td>
                <td>
                  <div class="row-actions">
                    <button class="icon-button" type="button" data-open-product-modal="${escapeHtml(product.id)}">Editar</button>
                    <button class="icon-button" type="button" data-delete-crm="products:${escapeHtml(product.id)}">Excluir</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderSubstrates() {
    const substrates = filteredSubstrates();
    renderCrmWorkspace("substrates", {
      eyebrow: "Configurações",
      title: "Substratos",
      subtitle: `${state.substrates.length} substratos cadastrados`,
      actions: `<button class="button button-primary" type="button" data-open-substrate-modal>+ Novo substrato</button>`,
      body: `
        <section class="crm-panel-stack">
          <section class="panel data-panel">
            ${renderCatalogToolbar("substrate", substrates.length)}
            ${renderSubstrateTable(substrates)}
          </section>
        </section>`,
    });
  }

  function renderSubstrateTable(substrates = state.substrates) {
    if (!substrates.length) return `<div class="empty-state">Nenhum substrato encontrado.</div>`;

    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Substrato</th>
              <th>Tipo de custo</th>
              <th>Custo</th>
              <th>Repasse ao cliente</th>
              <th>Custo aplicado estimado</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${substrates.map((substrate) => `
              <tr>
                <td>
                  <strong>${escapeHtml(substrate.name)}</strong>
                </td>
                <td>${escapeHtml(substrateAcquisitionLabel(substrate))}</td>
                <td>
                  <strong>${formatCurrency(substrateCostAmount(substrate))}</strong>
                  <span>${escapeHtml(substrate.cost_unit || substrate.unit || "-")}</span>
                </td>
                <td>${escapeHtml(substratePassThroughLabel(substrate))}</td>
                <td><strong>${formatCurrency(calculateAppliedSubstrateCost(substrate, 1))}</strong></td>
                <td><span class="status-pill">${substrate.status === "inactive" ? "Inativo" : "Ativo"}</span></td>
                <td>
                  <div class="row-actions">
                    <button class="icon-button" type="button" data-open-substrate-modal="${escapeHtml(substrate.id)}">Editar</button>
                    <button class="icon-button" type="button" data-delete-crm="substrates:${escapeHtml(substrate.id)}">Excluir</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderCatalogToolbar(kind, visibleCount) {
    const isProduct = kind === "product";
    const search = isProduct ? state.crmProductSearch : state.crmSubstrateSearch;
    const status = isProduct ? state.crmProductStatus : state.crmSubstrateStatus;
    const searchAttr = isProduct ? "data-product-search" : "data-substrate-search";
    const statusAttr = isProduct ? "data-product-status-filter" : "data-substrate-status-filter";
    const label = isProduct ? "produtos" : "substratos";

    return `
      <div class="crm-toolbar catalog-toolbar">
        <label class="field compact-field">
          <span>Busca</span>
          <input class="input" type="search" placeholder="Buscar por nome, categoria ou descrição" value="${valueAttr(search || "")}" ${searchAttr}>
        </label>
        <label class="field compact-field">
          <span>Status</span>
          <select class="select" ${statusAttr}>${selectOptions([["all", "Todos"], ["active", "Ativos"], ["inactive", "Inativos"]], status || "all")}</select>
        </label>
        <div class="toolbar-meta">
          <strong>${visibleCount}</strong>
          <span>${label} visíveis</span>
        </div>
      </div>`;
  }

  function renderBudgets() {
    const budgets = filteredBudgets();

    renderCrmWorkspace("budgets", {
      eyebrow: "Comercial",
      title: "Orçamentos",
      subtitle: `${state.budgets.length} orçamentos cadastrados`,
      actions: `<button class="button button-primary" type="button" data-open-budget-modal>+ Novo orçamento</button>`,
      body: `
        <section class="crm-panel-stack">
          <section class="panel data-panel budget-list-panel">
            ${renderBudgetToolbar(budgets)}
            ${renderBudgetTable(budgets)}
          </section>
        </section>`,
    });
  }

  function renderBudgetToolbar(budgets) {
    const selectedCount = selectedBudgetIds().filter((id) => budgets.some((budget) => budget.id === id)).length;
    const statusOptions = [
      ["all", "Todos"],
      ...BUDGET_STATUSES,
      ["resolved", "Resolvidos"],
    ];

    return `
      <div class="crm-toolbar budget-toolbar">
        <label class="field compact-field">
          <span>Busca</span>
          <input class="input" type="search" placeholder="Número, cliente, contato, vendedor ou título" value="${valueAttr(state.crmBudgetSearch || "")}" data-budget-search>
        </label>
        <label class="field compact-field">
          <span>Filtro</span>
          <select class="select" data-budget-status-filter>${selectOptions(statusOptions, state.crmBudgetStatus || "all")}</select>
        </label>
        <div class="toolbar-meta">
          <strong>${budgets.length}</strong>
          <span>${budgets.length === 1 ? "orçamento visível" : "orçamentos visíveis"}</span>
        </div>
        <div class="toolbar-meta">
          <strong>${selectedCount}</strong>
          <span>${selectedCount === 1 ? "selecionado" : "selecionados"}</span>
        </div>
        ${renderBudgetToolbarActions(budgets)}
      </div>`;
  }

  function renderBudgetTable(budgets) {
    if (!budgets.length) return `<div class="empty-state">Nenhum orçamento cadastrado.</div>`;
    const visibleIds = budgets.map((budget) => budget.id);
    const selectedIds = selectedBudgetIds();
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    return `
      <div class="table-wrap budget-table-wrap">
        <table class="data-table budget-table">
          <thead>
            <tr>
              <th class="select-column">
                <input type="checkbox" aria-label="Selecionar orçamentos visíveis" data-select-all-budgets ${allVisibleSelected ? "checked" : ""}>
              </th>
              <th>Orçamento</th>
              <th>Itens</th>
              <th>Cliente / contato</th>
              <th>Vendedor / indicação</th>
              <th>Últ. movimento</th>
              <th>OS</th>
              <th>Resolvido</th>
              <th>Para</th>
              <th>Total / status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${budgets.map((budget) => {
              const hasOrder = budgetHasOrder(budget);
              const selected = selectedIds.includes(budget.id);
              return `
                <tr class="${selected ? "is-selected" : ""}">
                  <td class="select-column">
                    <input type="checkbox" value="${escapeHtml(budget.id)}" aria-label="Selecionar orçamento ${escapeHtml(budgetNumberLabel(budget))}" data-select-budget ${selected ? "checked" : ""}>
                  </td>
                  <td>
                    <strong>${escapeHtml(budgetNumberLabel(budget))}</strong>
                    <span>${escapeHtml(budget.title || "Sem título")}</span>
                  </td>
                  <td>${budgetItemCount(budget)}</td>
                  <td>
                    <strong>${escapeHtml(entityName(state.clients, budget.client_id))}</strong>
                    <span>${escapeHtml([budgetContactName(budget), budgetContactLine(budget)].filter(Boolean).join(" · "))}</span>
                  </td>
                  <td>
                    <strong>${escapeHtml(budgetSeller(budget))}</strong>
                    <span>${escapeHtml(budgetAgency(budget))}</span>
                  </td>
                  <td>${formatDate(budget.updated_at || budget.created_at)}</td>
                  <td><span class="crm-check ${hasOrder ? "is-on" : ""}" aria-label="${hasOrder ? "OS emitida" : "Sem OS"}">${hasOrder ? "✓" : "-"}</span></td>
                  <td><span class="crm-check ${budget.resolved ? "is-on" : ""}" aria-label="${budget.resolved ? "Resolvido" : "Pendente"}">${budget.resolved ? "✓" : "-"}</span></td>
                  <td>${escapeHtml(budgetForLabel(budget))}</td>
                  <td><strong>${formatCurrency(budget.total, budget.currency || "BRL")}</strong><span>${escapeHtml(labelFromOptions(BUDGET_STATUSES, budget.status))}</span></td>
                  <td>
                    <div class="row-actions">
                      <button class="icon-button" type="button" data-edit-budget-modal="${escapeHtml(budget.id)}">Editar</button>
                      <button class="icon-button" type="button" data-export-budget-pdf="${escapeHtml(budget.id)}">PDF</button>
                      <button class="icon-button" type="button" data-create-order-from-budget="${escapeHtml(budget.id)}">${hasOrder ? "Ver OS" : "Gerar OS"}</button>
                      <button class="icon-button" type="button" data-delete-crm="budgets:${escapeHtml(budget.id)}">Excluir</button>
                    </div>
                  </td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderBudgetToolbarActions(budgets) {
    const selectedCount = selectedBudgetIds().filter((id) => budgets.some((budget) => budget.id === id)).length;
    const singleSelected = selectedCount === 1;
    const hasSelection = selectedCount > 0;

    return `
      <div class="crm-toolbar-actions" aria-label="Ações de orçamento">
        <button class="button button-secondary" type="button" data-duplicate-budget ${singleSelected ? "" : "disabled"}>Duplicar</button>
        <button class="button button-secondary" type="button" data-open-budget-reports>Relatórios</button>
        <button class="button button-secondary" type="button" data-export-budget-pdf ${hasSelection ? "" : "disabled"}>Exportar PDF</button>
        <button class="button button-secondary" type="button" data-create-order-from-budget ${hasSelection ? "" : "disabled"}>Gerar OS</button>
      </div>`;
  }

  function openBudgetReports() {
    state.modal = renderBudgetReportsModal();
    render();
  }

  function renderBudgetReportsModal() {
    const reportBudgets = filteredReportBudgets();
    const filters = state.crmReportFilters || {};
    const total = reportBudgets.length;
    const approved = reportBudgets.filter((budget) => budget.status === "approved").length;
    const sent = reportBudgets.filter((budget) => budget.status === "sent").length;
    const resolved = reportBudgets.filter((budget) => budget.resolved).length;
    const totalValue = reportBudgets.reduce((sum, budget) => sum + Number(budget.total || 0), 0);
    const approvedValue = reportBudgets
      .filter((budget) => budget.status === "approved")
      .reduce((sum, budget) => sum + Number(budget.total || 0), 0);
    const conversion = total ? Math.round((approved / total) * 100) : 0;
    const topClients = groupedBudgetTotals("client", reportBudgets).slice(0, 6);
    const topProducts = groupedBudgetTotals("product", reportBudgets).slice(0, 6);
    const statusRows = groupedBudgetStatusTotals(reportBudgets);
    const clientOptions = state.clients.map((client) => [client.id, client.name]);
    const productOptions = state.products.map((product) => [product.id, product.name]);

    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Relatórios de orçamento">
        <div class="modal modal-wide form-stack">
          <div class="modal-header">
            <div>
              <span class="eyebrow">Relatórios</span>
              <h2>Resumo de orçamentos</h2>
            </div>
            <div class="modal-actions">
              <button class="button button-secondary" type="button" data-export-budget-report-csv>Exportar CSV</button>
              <button class="icon-button" type="button" data-close-modal>Fechar</button>
            </div>
          </div>
          <section class="crm-toolbar report-toolbar">
            <label class="field compact-field">
              <span>De</span>
              <input class="input" type="date" value="${valueAttr(filters.from || "")}" data-budget-report-filter="from">
            </label>
            <label class="field compact-field">
              <span>Até</span>
              <input class="input" type="date" value="${valueAttr(filters.to || "")}" data-budget-report-filter="to">
            </label>
            <label class="field compact-field">
              <span>Status</span>
              <select class="select" data-budget-report-filter="status">${selectOptions([["all", "Todos"], ...BUDGET_STATUSES, ["resolved", "Resolvidos"]], filters.status || "all")}</select>
            </label>
            <label class="field compact-field">
              <span>Cliente</span>
              <select class="select" data-budget-report-filter="clientId">${selectOptions(clientOptions, filters.clientId || "", "Todos")}</select>
            </label>
            <label class="field compact-field">
              <span>Produto</span>
              <select class="select" data-budget-report-filter="productId">${selectOptions(productOptions, filters.productId || "", "Todos")}</select>
            </label>
          </section>
          <section class="metrics crm-metrics">
            <div class="metric"><strong>${total}</strong><span>Orçamentos</span></div>
            <div class="metric"><strong>${sent}</strong><span>Enviados</span></div>
            <div class="metric"><strong>${approved}</strong><span>Aprovados</span></div>
            <div class="metric"><strong>${resolved}</strong><span>Resolvidos</span></div>
            <div class="metric"><strong>${conversion}%</strong><span>Conversão</span></div>
            <div class="metric"><strong>${formatCurrency(totalValue)}</strong><span>Total orçado</span></div>
            <div class="metric"><strong>${formatCurrency(approvedValue)}</strong><span>Total aprovado</span></div>
          </section>
          <section class="report-grid">
            <div class="budget-section report-wide">
              <div class="budget-section-heading">
                <strong>Funil por status</strong>
                <span>Volume e valor por etapa do orçamento.</span>
              </div>
              ${renderReportBars(statusRows, totalValue)}
            </div>
            <div class="budget-section">
              <div class="budget-section-heading">
                <strong>Clientes com mais valor orçado</strong>
                <span>Soma de todos os orçamentos por cliente.</span>
              </div>
              ${renderReportRows(topClients)}
            </div>
            <div class="budget-section">
              <div class="budget-section-heading">
                <strong>Produtos mais orçados</strong>
                <span>Baseada no produto salvo no orçamento.</span>
              </div>
              ${renderReportRows(topProducts)}
            </div>
          </section>
        </div>
      </div>`;
  }

  function filteredReportBudgets() {
    const filters = state.crmReportFilters || {};
    return state.budgets.filter((budget) => {
      if (filters.status === "resolved" && !budget.resolved) return false;
      if (filters.status && filters.status !== "all" && filters.status !== "resolved" && budget.status !== filters.status) return false;
      if (filters.clientId && budget.client_id !== filters.clientId) return false;
      if (filters.productId && budgetPayload(budget).productId !== filters.productId) return false;
      const created = String(budget.created_at || "").slice(0, 10);
      if (filters.from && created && created < filters.from) return false;
      if (filters.to && created && created > filters.to) return false;
      return true;
    });
  }

  function updateBudgetReportFilter(key, value) {
    state.crmReportFilters = {
      ...(state.crmReportFilters || {}),
      [key]: value,
    };
    state.modal = renderBudgetReportsModal();
    render();
  }

  function exportBudgetReportCsv() {
    const rows = filteredReportBudgets();
    const headers = ["numero", "titulo", "cliente", "contato", "status", "resolvido", "produto", "subtotal", "desconto", "impostos", "total", "criado_em"];
    const csvRows = [
      headers.join(","),
      ...rows.map((budget) => {
        const payload = budgetPayload(budget);
        return [
          budgetNumberLabel(budget),
          budget.title,
          entityName(state.clients, budget.client_id, ""),
          budgetContactName(budget),
          labelFromOptions(BUDGET_STATUSES, budget.status),
          budget.resolved ? "sim" : "nao",
          payload.productName || payload.serviceType || "",
          Number(budget.subtotal || 0),
          `${Number(budget.discount || 0)}%`,
          Number(budget.tax || 0),
          Number(budget.total || 0),
          String(budget.created_at || "").slice(0, 10),
        ].map(csvCell).join(",");
      }),
    ];
    downloadTextFile(`raksa-orcamentos-${new Date().toISOString().slice(0, 10)}.csv`, csvRows.join("\n"), "text/csv;charset=utf-8");
  }

  function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function downloadTextFile(filename, content, type) {
    if (typeof document === "undefined") return;
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function groupedBudgetTotals(kind, budgets = state.budgets) {
    const map = new Map();
    budgets.forEach((budget) => {
      const payload = budgetPayload(budget);
      const key = kind === "client"
        ? entityName(state.clients, budget.client_id, "Sem cliente")
        : payload.productName || payload.serviceType || "Sem produto";
      const current = map.get(key) || { label: key, count: 0, total: 0 };
      current.count += 1;
      current.total += Number(budget.total || 0);
      map.set(key, current);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  function groupedBudgetStatusTotals(budgets = state.budgets) {
    return BUDGET_STATUSES.map(([status, label]) => {
      const rows = budgets.filter((budget) => budget.status === status);
      return {
        label,
        count: rows.length,
        total: rows.reduce((sum, budget) => sum + Number(budget.total || 0), 0),
      };
    });
  }

  function renderReportRows(rows) {
    if (!rows.length) return `<div class="empty-state">Sem dados suficientes.</div>`;
    return `
      <div class="report-list">
        ${rows.map((row) => `
          <div class="compact-row">
            <span>${escapeHtml(row.label)} · ${row.count} ${row.count === 1 ? "orçamento" : "orçamentos"}</span>
            <strong>${formatCurrency(row.total)}</strong>
          </div>
        `).join("")}
      </div>`;
  }

  function renderReportBars(rows, totalValue = 0) {
    if (!rows.some((row) => row.count || row.total)) return `<div class="empty-state">Sem dados suficientes.</div>`;
    const maxTotal = Math.max(...rows.map((row) => row.total), 1);
    return `
      <div class="report-bars">
        ${rows.map((row) => {
          const width = Math.max(row.total ? (row.total / maxTotal) * 100 : 0, row.count ? 8 : 0);
          const share = totalValue ? Math.round((row.total / totalValue) * 100) : 0;
          return `
            <div class="report-bar-row">
              <div class="report-bar-meta">
                <span>${escapeHtml(row.label)}</span>
                <strong>${formatCurrency(row.total)}</strong>
              </div>
              <div class="report-bar-track" aria-label="${escapeHtml(row.label)}: ${escapeHtml(formatCurrency(row.total))}">
                <span style="width: ${width.toFixed(2)}%"></span>
              </div>
              <small>${row.count} ${row.count === 1 ? "orçamento" : "orçamentos"} · ${share}%</small>
            </div>`;
        }).join("")}
      </div>`;
  }

  function renderLegacyBudgetBoard() {
    const editingBudget = crmEditRecord("budgets");
    const editingPayload = budgetPayload(editingBudget);
    const editingItemsText = budgetItemsText(editingBudget);
    const subtotal = Number(editingBudget?.subtotal || 0);
    const discount = Number(editingBudget?.discount || 0);
    const tax = Number(editingBudget?.tax || 0);
    const clientOptions = state.clients.map((client) => [client.id, client.name]);
    const projectOptions = state.projects.map((project) => [project.id, project.name]);

    renderCrmWorkspace("budgets", {
      eyebrow: "Orçamentos",
      title: "Orçamentos",
      subtitle: `${state.budgets.length} orçamentos cadastrados`,
      metrics: renderBudgetMetrics(),
      body: `
        <section class="crm-panel-stack">
          <form class="panel form-stack budget-form" data-budget-form ${crmFormAttrs("budgets")}>
            <div class="page-title">
              <h2>${editingBudget ? "Editar orçamento" : "Novo orçamento"}</h2>
              <p class="section-subtitle">${editingBudget ? "Atualize briefing, valores e condições." : "Monte a ficha comercial e técnica antes de virar OS."}</p>
            </div>

            <section class="budget-section">
              <div class="budget-section-heading">
                <strong>Ficha comercial</strong>
                <span>Cliente, responsáveis e etapa da proposta.</span>
              </div>
              <label class="field">
                <span>Titulo</span>
                <input class="input" name="title" value="${valueAttr(editingBudget?.title)}" required>
              </label>
              <div class="form-grid">
                <label class="field">
                  <span>Cliente</span>
                  <select class="select" name="client_id">${selectOptions(clientOptions, editingBudget?.client_id || "", "Sem cliente")}</select>
                </label>
                <label class="field">
                  <span>Projeto</span>
                  <select class="select" name="project_id">${selectOptions(projectOptions, editingBudget?.project_id || "", "Sem projeto")}</select>
                </label>
              </div>
              <div class="form-grid">
                <label class="field">
                  <span>Status</span>
                  <select class="select" name="status">${selectOptions(BUDGET_STATUSES, editingBudget?.status || "draft")}</select>
                </label>
                <label class="field">
                  <span>Validade</span>
                  <input class="input" name="valid_until" type="date" value="${valueAttr(dateInputValue(editingBudget?.valid_until))}">
                </label>
              </div>
              <div class="form-grid">
                <label class="field">
                  <span>Contato</span>
                  <input class="input" name="contact" value="${valueAttr(editingPayload.contact)}" placeholder="Nome, e-mail ou WhatsApp">
                </label>
                <label class="field">
                  <span>Vendedor</span>
                  <input class="input" name="sales_owner" value="${valueAttr(editingPayload.salesOwner)}" placeholder="Responsavel comercial">
                </label>
              </div>
              <label class="field">
                <span>Agencia / origem</span>
                <input class="input" name="agency" value="${valueAttr(editingPayload.agency)}" placeholder="Opcional">
              </label>
            </section>

            <section class="budget-section">
              <div class="budget-section-heading">
                <strong>Serviço e escopo</strong>
                <span>Resumo para proposta, produção e carta comercial.</span>
              </div>
              <label class="field">
                <span>Resumo da proposta</span>
                <textarea class="textarea textarea-small" name="summary" placeholder="Ex: Landing page institucional com CMS e integracao de metricas.">${escapeHtml(editingPayload.summary || "")}</textarea>
              </label>
              <div class="form-grid">
                <label class="field">
                  <span>Tipo de serviço</span>
                  <input class="input" name="service_type" value="${valueAttr(editingPayload.serviceType)}" placeholder="Website, branding, editorial...">
                </label>
                <label class="field">
                  <span>Quantidade</span>
                  <input class="input" name="quantity" type="number" min="1" step="1" value="${valueAttr(editingPayload.quantity ?? "")}" placeholder="1">
                </label>
              </div>
              <div class="form-grid">
                <label class="field">
                  <span>Formato / dimensões</span>
                  <input class="input" name="format" value="${valueAttr(editingPayload.format)}" placeholder="Ex: 1440px, A4, 20x30cm">
                </label>
                <label class="field">
                  <span>Material / tecnologia</span>
                  <input class="input" name="material" value="${valueAttr(editingPayload.material)}" placeholder="Ex: Webflow, React, couche...">
                </label>
              </div>
              <div class="form-grid">
                <label class="field">
                  <span>Cores / páginas</span>
                  <input class="input" name="color_profile" value="${valueAttr(editingPayload.colorProfile)}" placeholder="Ex: 4x4, digital, 12 páginas">
                </label>
                <label class="field">
                  <span>Acabamentos</span>
                  <input class="input" name="finishing" value="${valueAttr(editingPayload.finishing)}" placeholder="Corte, dobra, animacoes, SEO...">
                </label>
              </div>
              <label class="field">
                <span>Itens da proposta</span>
                <textarea class="textarea textarea-small" name="items_text" placeholder="Um item por linha">${escapeHtml(editingItemsText)}</textarea>
              </label>
            </section>

            <section class="budget-section">
              <div class="budget-section-heading">
                <strong>Valores</strong>
                <span>Calculo simples, mantendo detalhamento tecnico no escopo.</span>
              </div>
              <div class="form-grid">
                <label class="field">
                  <span>Subtotal</span>
                  <input class="input" name="subtotal" type="number" min="0" step="0.01" placeholder="0.00" value="${valueAttr(editingBudget?.subtotal ?? "")}" data-budget-money>
                </label>
                <label class="field">
                  <span>Desconto</span>
                  <input class="input" name="discount" type="number" min="0" step="0.01" placeholder="0.00" value="${valueAttr(editingBudget?.discount ?? "")}" data-budget-money>
                </label>
              </div>
              <div class="form-grid">
                <label class="field">
                  <span>Impostos</span>
                  <input class="input" name="tax" type="number" min="0" step="0.01" placeholder="0.00" value="${valueAttr(editingBudget?.tax ?? "")}" data-budget-money>
                </label>
                <div class="budget-total-preview" aria-live="polite">
                  <span>Total estimado</span>
                  <strong data-budget-total-preview-value>${formatCurrency(subtotal - discount + tax)}</strong>
                </div>
              </div>
            </section>

            <section class="budget-section">
              <div class="budget-section-heading">
                <strong>Condições e produção</strong>
                <span>Informacoes que alimentam OS e acompanhamento.</span>
              </div>
              <div class="form-grid">
                <label class="field">
                  <span>Pagamento</span>
                  <input class="input" name="payment_terms" value="${valueAttr(editingPayload.paymentTerms)}" placeholder="Ex: 50% inicio / 50% entrega">
                </label>
                <label class="field">
                  <span>Entrega</span>
                  <input class="input" name="delivery_terms" value="${valueAttr(editingPayload.deliveryTerms)}" placeholder="Ex: 20 dias uteis">
                </label>
              </div>
              <label class="field">
                <span>Observacoes tecnicas</span>
                <textarea class="textarea textarea-small" name="production_notes" placeholder="Dependencias, arquivos do cliente, restricoes e criterios de aceite.">${escapeHtml(editingPayload.productionNotes || "")}</textarea>
              </label>
              <label class="field">
                <span>Notas internas</span>
                <textarea class="textarea textarea-small" name="internal_notes" placeholder="Não aparece na proposta.">${escapeHtml(editingPayload.internalNotes || "")}</textarea>
              </label>
            </section>

            ${renderCrmFormActions("budgets", editingBudget, "Criar orçamento", "Salvar orçamento")}
          </form>

          <section class="panel data-panel budget-board">
            <div class="page-title">
              <h2>Pipeline comercial</h2>
              <p class="section-subtitle">Propostas agrupadas por status, com validade e escopo visíveis.</p>
            </div>
            ${renderBudgetPipeline()}
          </section>
        </section>`,
    });
  }

  function renderBudgetMetrics() {
    const activeBudgetTotal = state.budgets
      .filter((budget) => !["approved", "rejected"].includes(budget.status))
      .reduce((sum, budget) => sum + Number(budget.total || 0), 0);
    const totalApproved = state.budgets
      .filter((budget) => budget.status === "approved")
      .reduce((sum, budget) => sum + Number(budget.total || 0), 0);
    const overdueCount = state.budgets.filter((budget) => isBudgetOverdue(budget)).length;
    const averageTicket = state.budgets.length
      ? state.budgets.reduce((sum, budget) => sum + Number(budget.total || 0), 0) / state.budgets.length
      : 0;

    return `
      <section class="metrics budget-metrics" aria-label="Resumo de orçamentos">
        <div class="metric">
          <strong>${formatCurrency(activeBudgetTotal)}</strong>
          <span>Em negociacao</span>
        </div>
        <div class="metric">
          <strong>${formatCurrency(totalApproved)}</strong>
          <span>Aprovado</span>
        </div>
        <div class="metric">
          <strong>${overdueCount}</strong>
          <span>Validade vencida</span>
        </div>
        <div class="metric">
          <strong>${formatCurrency(averageTicket)}</strong>
          <span>Ticket medio</span>
        </div>
      </section>`;
  }

  function renderBudgetPipeline() {
    if (!state.budgets.length) return `<div class="empty-state">Nenhum orçamento cadastrado.</div>`;

    return `
      <div class="budget-pipeline">
        ${BUDGET_STATUSES.map(([status, label]) => {
          const items = state.budgets.filter((budget) => budget.status === status);
          return `
            <section class="budget-column">
              <div class="budget-column-heading">
                <span>${escapeHtml(label)}</span>
                <strong>${items.length}</strong>
              </div>
              <div class="budget-card-list">
                ${items.length ? items.map(renderBudgetCard).join("") : `<div class="budget-empty-column">Sem propostas</div>`}
              </div>
            </section>`;
        }).join("")}
      </div>`;
  }

  function renderBudgetCard(budget) {
    const payload = budgetPayload(budget);
    const summary = payload.summary || firstBudgetItemLine(budget) || "Sem resumo cadastrado.";
    const specs = [
      payload.serviceType,
      payload.quantity ? `${payload.quantity} un.` : "",
      payload.format,
      payload.material,
      payload.colorProfile,
    ].filter(Boolean);

    return `
      <article class="budget-card ${isBudgetOverdue(budget) ? "is-overdue" : ""}">
        <div class="budget-card-top">
          <span class="status-pill budget-status-${escapeHtml(budget.status || "draft")}">${escapeHtml(labelFromOptions(BUDGET_STATUSES, budget.status))}</span>
          <strong>${formatCurrency(budget.total, budget.currency || "BRL")}</strong>
        </div>
        <div class="budget-card-copy">
          <h3>${escapeHtml(budget.title)}</h3>
          <p>${escapeHtml(summary)}</p>
        </div>
        ${specs.length ? `<div class="budget-specs">${specs.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
        <dl class="budget-meta">
          <div>
            <dt>Cliente</dt>
            <dd>${escapeHtml(entityName(state.clients, budget.client_id))}</dd>
          </div>
          <div>
            <dt>Projeto</dt>
            <dd>${escapeHtml(entityName(state.projects, budget.project_id))}</dd>
          </div>
          <div>
            <dt>Validade</dt>
            <dd>${escapeHtml(budgetValidityText(budget))}</dd>
          </div>
          ${payload.contact ? `
            <div>
              <dt>Contato</dt>
              <dd>${escapeHtml(payload.contact)}</dd>
            </div>` : ""}
        </dl>
        <div class="row-actions">
          <button class="icon-button" type="button" data-edit-crm="budgets:${escapeHtml(budget.id)}">Editar</button>
          <button class="icon-button" type="button" data-delete-crm="budgets:${escapeHtml(budget.id)}">Excluir</button>
        </div>
      </article>`;
  }

  function selectedBudgetIds() {
    return Array.isArray(state.crmSelectedBudgets) ? state.crmSelectedBudgets : [];
  }

  function setSelectedBudgetIds(ids) {
    const available = new Set(state.budgets.map((budget) => budget.id));
    state.crmSelectedBudgets = [...new Set(ids)].filter((id) => available.has(id));
  }

  function selectedBudgetFromState(fallbackId = "") {
    const id = fallbackId || selectedBudgetIds()[0] || "";
    return state.budgets.find((budget) => budget.id === id) || null;
  }

  function selectedBudgetsForAction(fallbackId = "") {
    if (fallbackId) return state.budgets.filter((budget) => budget.id === fallbackId);
    const ids = selectedBudgetIds();
    return ids.length
      ? ids.map((id) => state.budgets.find((budget) => budget.id === id)).filter(Boolean)
      : [];
  }

  function selectedOrderIds() {
    return Array.isArray(state.crmSelectedOrders) ? state.crmSelectedOrders : [];
  }

  function setSelectedOrderIds(ids) {
    const available = new Set(state.serviceOrders.map((order) => order.id));
    state.crmSelectedOrders = [...new Set(ids)].filter((id) => available.has(id));
  }

  function selectedServiceOrdersForAction(fallbackId = "") {
    if (fallbackId) return state.serviceOrders.filter((order) => order.id === fallbackId);
    const ids = selectedOrderIds();
    return ids.length
      ? ids.map((id) => state.serviceOrders.find((order) => order.id === id)).filter(Boolean)
      : [];
  }

  function filteredProducts() {
    const query = String(state.crmProductSearch || "").trim().toLowerCase();
    const status = state.crmProductStatus || "all";
    return state.products.filter((product) => {
      if (status !== "all" && product.status !== status) return false;
      if (!query) return true;
      return [product.name, product.category, product.description, product.production_unit, productPricingLabel(product), productLinkedSubstrates(product).map((item) => item.name).join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }

  function filteredSubstrates() {
    const query = String(state.crmSubstrateSearch || "").trim().toLowerCase();
    const status = state.crmSubstrateStatus || "all";
    return state.substrates.filter((substrate) => {
      if (status !== "all" && substrate.status !== status) return false;
      if (!query) return true;
      return [
        substrate.name,
        substrate.kind,
        substrateAcquisitionLabel(substrate),
        substrate.unit,
        substrate.cost_unit,
        substratePassThroughLabel(substrate),
        substrate.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }

  function updateProductFilters(nextFilters = {}) {
    state.crmProductSearch = nextFilters.search ?? state.crmProductSearch ?? "";
    state.crmProductStatus = nextFilters.status ?? state.crmProductStatus ?? "all";
    renderProducts();
    restoreFieldFocus("[data-product-search]", Object.prototype.hasOwnProperty.call(nextFilters, "search"));
  }

  function updateSubstrateFilters(nextFilters = {}) {
    state.crmSubstrateSearch = nextFilters.search ?? state.crmSubstrateSearch ?? "";
    state.crmSubstrateStatus = nextFilters.status ?? state.crmSubstrateStatus ?? "all";
    renderSubstrates();
    restoreFieldFocus("[data-substrate-search]", Object.prototype.hasOwnProperty.call(nextFilters, "search"));
  }

  function restoreFieldFocus(selector, shouldFocus) {
    if (!shouldFocus || typeof document === "undefined") return;
    requestAnimationFrame(() => {
      const input = document.querySelector(selector);
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }

  function selectBudget(id, checked) {
    if (!id) return;
    const current = selectedBudgetIds();
    setSelectedBudgetIds(checked ? [...current, id] : current.filter((item) => item !== id));
    renderBudgets();
  }

  function selectAllVisibleBudgets(checked) {
    const visibleIds = filteredBudgets().map((budget) => budget.id);
    const current = selectedBudgetIds().filter((id) => !visibleIds.includes(id));
    setSelectedBudgetIds(checked ? [...current, ...visibleIds] : current);
    renderBudgets();
  }

  function updateBudgetFilters(nextFilters = {}) {
    const restoreSearchFocus = Object.prototype.hasOwnProperty.call(nextFilters, "search");
    state.crmBudgetSearch = nextFilters.search ?? state.crmBudgetSearch ?? "";
    state.crmBudgetStatus = nextFilters.status ?? state.crmBudgetStatus ?? "all";
    setSelectedBudgetIds(selectedBudgetIds());
    renderBudgets();
    restoreFieldFocus("[data-budget-search]", restoreSearchFocus);
  }

  function selectOrder(id, checked) {
    if (!id) return;
    const current = selectedOrderIds();
    setSelectedOrderIds(checked ? [...current, id] : current.filter((item) => item !== id));
    renderServiceOrders();
  }

  function selectAllVisibleOrders(checked) {
    const visibleIds = filteredServiceOrders().map((order) => order.id);
    const current = selectedOrderIds().filter((id) => !visibleIds.includes(id));
    setSelectedOrderIds(checked ? [...current, ...visibleIds] : current);
    renderServiceOrders();
  }

  function updateOrderFilters(nextFilters = {}) {
    const restoreSearchFocus = Object.prototype.hasOwnProperty.call(nextFilters, "search");
    state.crmOrderSearch = nextFilters.search ?? state.crmOrderSearch ?? "";
    state.crmOrderStatus = nextFilters.status ?? state.crmOrderStatus ?? "all";
    setSelectedOrderIds(selectedOrderIds());
    renderServiceOrders();
    restoreFieldFocus("[data-order-search]", restoreSearchFocus);
  }

  function filteredBudgets() {
    const query = String(state.crmBudgetSearch || "").trim().toLowerCase();
    const status = state.crmBudgetStatus || "all";
    return state.budgets.filter((budget) => {
      if (status === "resolved" && !budget.resolved) return false;
      if (status !== "all" && status !== "resolved" && budget.status !== status) return false;
      if (!query) return true;
      return budgetSearchText(budget).includes(query);
    });
  }

  function filteredServiceOrders() {
    const query = String(state.crmOrderSearch || "").trim().toLowerCase();
    const status = state.crmOrderStatus || "all";
    return state.serviceOrders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (!query) return true;
      return orderSearchText(order).includes(query);
    });
  }

  function orderSearchText(order) {
    return [
      order.title,
      scopeText(order.scope),
      orderBudgetLabel(order),
      entityName(state.clients, order.client_id, ""),
      entityName(state.projects, order.project_id, ""),
      labelFromOptions(ORDER_STATUSES, order.status),
      orderBillingLine(order),
      formatDate(order.due_at),
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function budgetSearchText(budget) {
    const payload = budgetPayload(budget);
    return [
      budgetNumberLabel(budget),
      budget.title,
      entityName(state.clients, budget.client_id, ""),
      budgetContactName(budget),
      budgetContactLine(budget),
      payload.salesOwner,
      payload.agency,
      payload.budgetFor,
      payload.productName,
      payload.substrateName,
      budgetItemsText(budget),
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function budgetNumberLabel(budget) {
    if (budget?.budget_number) return String(budget.budget_number);
    return budget?.id ? `TMP-${String(budget.id).slice(0, 8)}` : "Automático";
  }

  function currentUserLabel() {
    const user = state.session?.user || {};
    return user.user_metadata?.name || user.user_metadata?.full_name || user.email || "Usuário atual";
  }

  function defaultBudgetValidUntil() {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return date.toISOString().slice(0, 10);
  }

  function nextBudgetNumberPreview() {
    const maxNumber = state.budgets.reduce((max, budget) => Math.max(max, Number(budget.budget_number || 0)), 209);
    return Math.max(210, maxNumber + 1);
  }

  function budgetDiscountLabel(budget) {
    const percent = Number(budget?.discount || 0);
    const grossTotal = Number(budget?.subtotal || 0) + Number(budget?.tax || 0);
    const amount = roundMoney(grossTotal * (percent / 100));
    return `${formatPercent(percent)} (${formatCurrency(amount)})`;
  }

  function budgetDeliveryInputValue(value) {
    const text = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
  }

  function budgetDeliveryLabel(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return /^\d{4}-\d{2}-\d{2}/.test(text) ? formatDate(text.slice(0, 10)) : text;
  }

  function budgetItemCount(budget) {
    const payload = budgetPayload(budget);
    if (Array.isArray(payload.items) && payload.items.length) return payload.items.length;
    if (budgetItemsText(budget)) return budgetItemsText(budget).split(/\r?\n/).filter((line) => line.trim()).length;
    return payload.productId || payload.serviceType ? 1 : 0;
  }

  function budgetHasOrder(budget) {
    return state.serviceOrders.some((order) => order.budget_id === budget.id);
  }

  function budgetContactRecord(budget) {
    return state.contacts.find((contact) => contact.id === budget?.contact_id) || null;
  }

  function budgetContactName(budget) {
    const contact = budgetContactRecord(budget);
    const payload = budgetPayload(budget);
    return contact?.name || payload.contact || "-";
  }

  function budgetContactLine(budget) {
    const contact = budgetContactRecord(budget);
    const payload = budgetPayload(budget);
    return contact?.email || contact?.phone || payload.contactEmail || payload.contactPhone || "";
  }

  function budgetSeller(budget) {
    return budgetPayload(budget).salesOwner || "-";
  }

  function budgetAgency(budget) {
    return budgetPayload(budget).agency || "-";
  }

  function budgetForLabel(budget) {
    return budgetPayload(budget).budgetFor || "Cliente";
  }

  function orderBudgetLabel(order) {
    const budget = state.budgets.find((item) => item.id === order?.budget_id);
    return budget ? `${budgetNumberLabel(budget)} · ${budget.title}` : "-";
  }

  function orderRecurrenceLabel(order) {
    return labelFromOptions(ORDER_RECURRENCES, order?.recurrence || "one_time");
  }

  function orderBillingLine(order) {
    const parts = [
      orderRecurrenceLabel(order),
      order?.billing_cycle,
      Number(order?.estimated_hours || 0) ? `${formatDecimalHours(order.estimated_hours)} previstas` : "",
      Number(order?.hourly_rate || 0) ? `${formatCurrency(order.hourly_rate)}/h` : "",
    ].filter(Boolean);
    return parts.join(" · ") || "-";
  }

  function orderScopeObject(order) {
    return order?.scope && typeof order.scope === "object" && !Array.isArray(order.scope) ? order.scope : {};
  }

  function isoDate(value) {
    const date = value ? new Date(`${String(value).slice(0, 10)}T00:00:00`) : new Date();
    if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
    return date.toISOString().slice(0, 10);
  }

  function advanceRecurringDate(value, recurrence, step = 1) {
    const date = new Date(`${isoDate(value)}T00:00:00`);
    if (recurrence === "biweekly") date.setDate(date.getDate() + 14 * step);
    else if (recurrence === "monthly") date.setMonth(date.getMonth() + step);
    else return "";
    return date.toISOString().slice(0, 10);
  }

  function clientContacts(clientId = "") {
    return state.contacts
      .filter((contact) => contact.client_id === clientId)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  }

  function productRecord(id) {
    return state.products.find((product) => product.id === id) || null;
  }

  function substrateRecord(id) {
    return state.substrates.find((substrate) => substrate.id === id) || null;
  }

  function substrateCostAmount(substrate) {
    return Number(substrate?.cost_amount ?? substrate?.unit_cost ?? 0);
  }

  function substrateAcquisitionType(substrate) {
    return substrate?.acquisition_type || "unit_cost";
  }

  function substrateAcquisitionLabel(substrate) {
    return labelFromOptions(SUBSTRATE_ACQUISITION_TYPES, substrateAcquisitionType(substrate));
  }

  function substratePassThroughMethod(substrate) {
    return substrate?.pass_through_method || "none";
  }

  function substratePassThroughLabel(substrate) {
    return labelFromOptions(SUBSTRATE_PASS_THROUGH_METHODS, substratePassThroughMethod(substrate));
  }

  function productPricingLabel(product) {
    return labelFromOptions(PRODUCT_PRICING_MODELS, product?.pricing_model || "fixed");
  }

  function productSubstrateLinks(product) {
    if (!product?.id) return [];
    return state.productSubstrates
      .filter((link) => link.product_id === product.id)
      .sort((a, b) => String(substrateRecord(a.substrate_id)?.name || "").localeCompare(String(substrateRecord(b.substrate_id)?.name || ""), "pt-BR"));
  }

  function productLinkedSubstrates(product) {
    return productSubstrateLinks(product)
      .map((link) => substrateRecord(link.substrate_id))
      .filter(Boolean);
  }

  function budgetFinancialSettings() {
    return {
      hourly_rate: Number(state.financialSettings?.hourly_rate ?? 70),
      default_markup_percent: Number(state.financialSettings?.default_markup_percent ?? 30),
      default_tax_percent: Number(state.financialSettings?.default_tax_percent ?? 6),
      currency: state.financialSettings?.currency || "BRL",
    };
  }

  function productPricingSubstrates(product, extraSubstrate = null) {
    const linked = productSubstrateLinks(product)
      .map((link) => {
        const substrate = substrateRecord(link.substrate_id);
        return substrate ? {
          substrate,
          quantity: Number(link.quantity || 1),
          isRequired: link.is_required !== false,
          notes: link.notes || "",
        } : null;
      })
      .filter(Boolean);

    if (extraSubstrate && !linked.some((entry) => entry.substrate.id === extraSubstrate.id)) {
      linked.push({ substrate: extraSubstrate, quantity: 1, isRequired: false, notes: "Custo extra do orçamento" });
    }

    return linked;
  }

  function calculateBudgetPricing(product, quantity = 0, extraSubstrate = null) {
    return calculateProductPricing({
      product: product || {},
      quantity,
      financialSettings: budgetFinancialSettings(),
      substrates: productPricingSubstrates(product, extraSubstrate),
    });
  }

  function emptyBudgetPricingSnapshot() {
    return {
      quantity: 0,
      laborHours: 0,
      hourlyRate: roundMoney(budgetFinancialSettings().hourly_rate),
      laborCost: 0,
      substrateCost: 0,
      subtotal: 0,
      markupPercent: roundMoney(budgetFinancialSettings().default_markup_percent),
      markupAmount: 0,
      taxPercent: roundMoney(budgetFinancialSettings().default_tax_percent),
      taxAmount: 0,
      total: 0,
    };
  }

  function combineBudgetPricingSnapshots(snapshots = []) {
    const valid = snapshots.filter(Boolean);
    if (!valid.length) return emptyBudgetPricingSnapshot();
    const settings = budgetFinancialSettings();
    const subtotal = valid.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const markupAmount = valid.reduce((sum, item) => sum + Number(item.markupAmount || 0), 0);
    const taxAmount = valid.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0);
    return {
      quantity: roundMoney(valid.reduce((sum, item) => sum + Number(item.quantity || 0), 0)),
      laborHours: roundMoney(valid.reduce((sum, item) => sum + Number(item.laborHours || 0), 0)),
      hourlyRate: roundMoney(valid.find((item) => Number(item.hourlyRate || 0))?.hourlyRate || settings.hourly_rate),
      laborCost: roundMoney(valid.reduce((sum, item) => sum + Number(item.laborCost || 0), 0)),
      substrateCost: roundMoney(valid.reduce((sum, item) => sum + Number(item.substrateCost || 0), 0)),
      subtotal: roundMoney(subtotal),
      markupPercent: roundMoney(settings.default_markup_percent),
      markupAmount: roundMoney(markupAmount),
      taxPercent: roundMoney(settings.default_tax_percent),
      taxAmount: roundMoney(taxAmount),
      total: roundMoney(subtotal + markupAmount + taxAmount),
    };
  }

  function budgetPricingSnapshot(record) {
    const payload = budgetPayload(record);
    const source = record?.pricing_snapshot && typeof record.pricing_snapshot === "object" && !Array.isArray(record.pricing_snapshot)
      ? record.pricing_snapshot
      : payload.pricingSnapshot && typeof payload.pricingSnapshot === "object" && !Array.isArray(payload.pricingSnapshot)
        ? payload.pricingSnapshot
        : {};
    const settings = budgetFinancialSettings();
    return {
      quantity: roundMoney(record?.quantity ?? source.quantity ?? payload.quantity ?? 0),
      laborHours: roundMoney(record?.labor_hours_snapshot ?? source.laborHours ?? 0),
      hourlyRate: roundMoney(record?.hourly_rate_snapshot ?? source.hourlyRate ?? settings.hourly_rate),
      laborCost: roundMoney(record?.labor_cost_snapshot ?? source.laborCost ?? 0),
      substrateCost: roundMoney(record?.substrate_cost_snapshot ?? source.substrateCost ?? 0),
      subtotal: roundMoney(record?.subtotal_snapshot ?? source.subtotal ?? 0),
      markupPercent: roundMoney(record?.markup_percent_snapshot ?? source.markupPercent ?? settings.default_markup_percent),
      markupAmount: roundMoney(record?.markup_amount_snapshot ?? source.markupAmount ?? 0),
      taxPercent: roundMoney(record?.tax_percent_snapshot ?? source.taxPercent ?? settings.default_tax_percent),
      taxAmount: roundMoney(record?.tax_amount_snapshot ?? source.taxAmount ?? 0),
      total: roundMoney(record?.total_snapshot ?? source.total ?? 0),
    };
  }

  function budgetPricingSnapshotColumns(snapshot) {
    return {
      quantity: roundMoney(snapshot.quantity),
      pricing_snapshot: snapshot,
      hourly_rate_snapshot: roundMoney(snapshot.hourlyRate),
      markup_percent_snapshot: roundMoney(snapshot.markupPercent),
      tax_percent_snapshot: roundMoney(snapshot.taxPercent),
      labor_hours_snapshot: roundMoney(snapshot.laborHours),
      labor_cost_snapshot: roundMoney(snapshot.laborCost),
      substrate_cost_snapshot: roundMoney(snapshot.substrateCost),
      subtotal_snapshot: roundMoney(snapshot.subtotal),
      markup_amount_snapshot: roundMoney(snapshot.markupAmount),
      tax_amount_snapshot: roundMoney(snapshot.taxAmount),
      total_snapshot: roundMoney(snapshot.total),
    };
  }

  function renderBudgetPricingSummary(snapshot = emptyBudgetPricingSnapshot()) {
    return `
      <div class="budget-pricing-summary" data-budget-pricing-summary>
        <div class="budget-pricing-summary-heading">
          <strong>Resumo de cálculo</strong>
          <span>Prévia automática baseada no produto, quantidade, substratos e configurações financeiras.</span>
        </div>
        <dl>
          <div><dt>Quantidade</dt><dd data-pricing-summary="quantity">${formatDecimalNumber(snapshot.quantity)}</dd></div>
          <div><dt>Horas totais</dt><dd data-pricing-summary="laborHours">${formatDecimalHours(snapshot.laborHours)}</dd></div>
          <div><dt>Valor/hora usado</dt><dd data-pricing-summary="hourlyRate">${formatCurrency(snapshot.hourlyRate)}</dd></div>
          <div><dt>Mão de obra</dt><dd data-pricing-summary="laborCost">${formatCurrency(snapshot.laborCost)}</dd></div>
          <div><dt>Substratos</dt><dd data-pricing-summary="substrateCost">${formatCurrency(snapshot.substrateCost)}</dd></div>
          <div><dt>Subtotal</dt><dd data-pricing-summary="subtotal">${formatCurrency(snapshot.subtotal)}</dd></div>
          <div><dt>Markup</dt><dd data-pricing-summary="markupAmount">${formatPercent(snapshot.markupPercent)} · ${formatCurrency(snapshot.markupAmount)}</dd></div>
          <div><dt>Impostos</dt><dd data-pricing-summary="taxAmount">${formatPercent(snapshot.taxPercent)} · ${formatCurrency(snapshot.taxAmount)}</dd></div>
          <div class="budget-pricing-summary-total"><dt>Total estimado</dt><dd data-pricing-summary="total">${formatCurrency(snapshot.total)}</dd></div>
        </dl>
      </div>`;
  }

  function updateBudgetPricingSummary(form, snapshot = emptyBudgetPricingSnapshot()) {
    const summary = form?.querySelector("[data-budget-pricing-summary]");
    if (!summary) return;
    const values = {
      quantity: formatDecimalNumber(snapshot.quantity),
      laborHours: formatDecimalHours(snapshot.laborHours),
      hourlyRate: formatCurrency(snapshot.hourlyRate),
      laborCost: formatCurrency(snapshot.laborCost),
      substrateCost: formatCurrency(snapshot.substrateCost),
      subtotal: formatCurrency(snapshot.subtotal),
      markupAmount: `${formatPercent(snapshot.markupPercent)} · ${formatCurrency(snapshot.markupAmount)}`,
      taxAmount: `${formatPercent(snapshot.taxPercent)} · ${formatCurrency(snapshot.taxAmount)}`,
      total: formatCurrency(snapshot.total),
    };
    Object.entries(values).forEach(([key, value]) => {
      const node = summary.querySelector(`[data-pricing-summary="${key}"]`);
      if (node) node.textContent = value;
    });
  }

  function productIncludedSubstrateIds(product) {
    const value = product?.default_substrate_ids;
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value !== "string" || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }

  function productIncludedSubstrates(product) {
    const ids = new Set(productIncludedSubstrateIds(product));
    if (!ids.size) return [];
    return state.substrates.filter((substrate) => ids.has(substrate.id));
  }

  function productBaseAmount(product) {
    if (!product) return 0;
    const model = product.pricing_model || "fixed";
    const fixed = Number(product.base_price || 0);
    const hourly = Number(product.estimated_hours || 0) * Number(product.hourly_rate || 0);
    if (model === "hourly") return hourly;
    if (model === "hybrid") return fixed + hourly;
    return fixed;
  }

  function calculateBudgetEstimate(product, substrate, quantityValue = 1) {
    const quantity = Math.max(1, Number(quantityValue || 1));
    const includedSubstrates = productIncludedSubstrates(product);
    const includedIds = new Set(includedSubstrates.map((item) => item.id));
    const additionalSubstrates = substrate && !includedIds.has(substrate.id) ? [substrate] : [];
    const substrateCost = [...includedSubstrates, ...additionalSubstrates]
      .reduce((sum, item) => sum + Number(item.unit_cost || 0), 0);
    const baseAmount = productBaseAmount(product);
    const markupRate = Math.max(0, Number(product?.default_markup || 0));
    const unitCostBeforeMarkup = baseAmount + substrateCost;
    const markupAmount = product ? unitCostBeforeMarkup * (markupRate / 100) : 0;
    const unitSubtotal = unitCostBeforeMarkup + markupAmount;

    return {
      additionalSubstrates,
      baseAmount,
      includedSubstrates,
      markupAmount,
      markupRate,
      quantity,
      substrateCost,
      subtotal: unitSubtotal * quantity,
      unitSubtotal,
    };
  }

  function renderProductSubstrateChoices(product) {
    const links = productSubstrateLinks(product);

    return `
      <section class="product-substrate-panel">
        <div class="panel-heading product-substrate-heading">
          <div>
            <h2>Substratos padrão</h2>
            <p class="section-subtitle">Sugestões copiadas para o orçamento, editáveis em cada proposta.</p>
          </div>
          <button class="button button-secondary" type="button" data-add-product-substrate ${state.substrates.length ? "" : "disabled"}>Adicionar substrato</button>
        </div>
        ${!state.substrates.length ? `<div class="empty-state compact-empty">Cadastre substratos antes de vinculá-los ao produto.</div>` : `
          <div class="product-substrate-list" data-product-substrate-list>
            ${links.length ? links.map((link) => renderProductSubstrateRow(link)).join("") : renderProductSubstrateRow()}
          </div>
          <template data-product-substrate-template>
            ${renderProductSubstrateRow()}
          </template>
        `}
      </section>`;
  }

  function renderProductSubstrateRow(link = {}) {
    return `
      <div class="product-substrate-row" data-product-substrate-row>
        <label class="field compact-field">
          <span>Substrato</span>
          <select class="select" name="product_substrate_id">${selectOptions(state.substrates.map((substrate) => [substrate.id, substrate.name]), link.substrate_id || "", "Selecione")}</select>
        </label>
        <label class="field compact-field">
          <span>Quantidade padrão</span>
          <input class="input" name="product_substrate_quantity" type="number" min="0" step="0.01" value="${valueAttr(link.quantity ?? 1)}">
        </label>
        <button class="icon-button" type="button" data-remove-product-substrate>Remover</button>
      </div>`;
  }

  function collectProductSubstrateLinks(form, errors) {
    const rows = [...form.querySelectorAll("[data-product-substrate-row]")];
    const seen = new Set();
    const links = [];

    rows.forEach((row) => {
      const substrateId = String(row.querySelector('[name="product_substrate_id"]')?.value || "").trim();
      const quantityValue = row.querySelector('[name="product_substrate_quantity"]')?.value;
      const hasAnyValue = substrateId;
      if (!hasAnyValue) return;
      if (!substrateId) {
        errors.push("Selecione o substrato vinculado ao produto.");
        return;
      }
      if (seen.has(substrateId)) {
        errors.push("Não duplique o mesmo substrato no produto.");
        return;
      }
      seen.add(substrateId);

      const quantity = Math.max(0, Number(String(quantityValue || "1").replace(",", ".")));
      if (!Number.isFinite(quantity)) {
        errors.push("Quantidade do substrato deve ser um número positivo.");
        return;
      }

      links.push({
        substrate_id: substrateId,
        quantity: quantity || 1,
        is_required: true,
        notes: "",
      });
    });

    return links;
  }

  async function saveProductSubstrateLinks(productId, links = []) {
    const deleteResult = await supabase().from("product_substrates").delete().eq("product_id", productId);
    if (deleteResult.error) return deleteResult;
    if (!links.length) return { error: null };

    return supabase().from("product_substrates").insert(links.map((link) => ({
      product_id: productId,
      substrate_id: link.substrate_id,
      quantity: link.quantity || 1,
      is_required: link.is_required !== false,
      notes: link.notes || "",
    })));
  }

  function budgetEditorItems(budget) {
    const payload = budgetPayload(budget);
    const source = Array.isArray(payload.lineItems) && payload.lineItems.length
      ? payload.lineItems
      : Array.isArray(payload.items) && payload.items.length
        ? payload.items
        : [];
    if (source.length) return source.map(normalizeBudgetLineItem).filter(Boolean);

    const textItems = budgetItemsText(budget).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (textItems.length) {
      const unitPrice = textItems.length ? Number(budget?.subtotal || budget?.total || 0) / textItems.length : 0;
      return textItems.map((description) => normalizeBudgetLineItem({
        description,
        quantity: 1,
        unitPrice,
        total: unitPrice,
      }));
    }

    return [normalizeBudgetLineItem({
      description: payload.productName || payload.serviceType || budget?.title || "",
      productId: payload.productId || "",
      substrateId: payload.substrateId || "",
      quantity: payload.quantity || 1,
      unitPrice: Number(budget?.subtotal || 0) / Math.max(1, Number(payload.quantity || 1)),
      total: Number(budget?.subtotal || 0),
    })];
  }

  function normalizeBudgetLineItem(item = {}) {
    if (typeof item === "string") return { description: item, quantity: 1, unitPrice: 0, total: 0 };
    const quantity = Math.max(1, Number(item.quantity || 1));
    const total = Number(item.total ?? item.amount ?? 0);
    const unitPrice = Number(item.unitPrice ?? item.unit_price ?? (quantity ? total / quantity : total) ?? 0);
    const pricingSnapshot = item.pricingSnapshot && typeof item.pricingSnapshot === "object" && !Array.isArray(item.pricingSnapshot)
      ? item.pricingSnapshot
      : null;
    const autoUnit = item.autoUnit ?? item.auto_unit ?? Boolean(pricingSnapshot);
    return {
      description: item.description || item.text || item.title || "",
      proposalDescription: item.proposalDescription || item.proposal_description || item.description || item.text || item.title || "",
      productId: item.productId || item.product_id || "",
      substrateId: item.substrateId || item.substrate_id || "",
      quantity,
      estimatedHours: Number(item.estimatedHours ?? item.estimated_hours ?? item.pricingSnapshot?.laborHours ?? 0),
      hourlyRate: Number(item.hourlyRate ?? item.hourly_rate ?? item.pricingSnapshot?.hourlyRate ?? 0),
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      total: Number.isFinite(total) && total > 0 ? total : unitPrice * quantity,
      substratesUsed: normalizeBudgetItemSubstrates(item),
      pricingSnapshot,
      autoUnit: autoUnit === true || autoUnit === "true",
    };
  }

  function renderBudgetItemRows(items = []) {
    const rows = items.length ? items : [normalizeBudgetLineItem()];
    return rows.map((item, index) => renderBudgetItemRow(item, index)).join("");
  }

  function normalizeBudgetItemSubstrates(item = {}) {
    const source = Array.isArray(item.substratesUsed) ? item.substratesUsed
      : Array.isArray(item.substrates_used) ? item.substrates_used
        : Array.isArray(item.includedSubstrates) ? item.includedSubstrates
          : [];
    const normalized = source
      .map((entry) => {
        const id = entry.id || entry.substrateId || entry.substrate_id || "";
        const substrate = substrateRecord(id);
        return {
          id: id || substrate?.id || "",
          name: entry.name || substrate?.name || "",
          cost: Number(entry.cost ?? substrate?.cost_amount ?? substrate?.unit_cost ?? 0),
          quantity: Number(entry.quantity ?? entry.quantityUsed ?? entry.quantity_used ?? 1) || 1,
          acquisition_type: entry.acquisition_type || substrate?.acquisition_type || "unit_cost",
          unit_cost: Number(entry.unit_cost ?? entry.cost ?? substrate?.unit_cost ?? 0),
          cost_amount: Number(entry.cost_amount ?? entry.cost ?? substrate?.cost_amount ?? substrate?.unit_cost ?? 0),
          pass_through_method: entry.pass_through_method || substrate?.pass_through_method || "none",
          fixed_pass_through_amount: Number(entry.fixed_pass_through_amount ?? substrate?.fixed_pass_through_amount ?? 0),
          pass_through_percent: Number(entry.pass_through_percent ?? substrate?.pass_through_percent ?? 0),
          allocation_quantity: Number(entry.allocation_quantity ?? substrate?.allocation_quantity ?? 0),
        };
      })
      .filter((entry) => entry.id || entry.name);

    if (!normalized.length && item.substrateId) {
      const substrate = substrateRecord(item.substrateId);
      if (substrate) {
        normalized.push({
          id: substrate.id,
          name: substrate.name,
          cost: Number(substrate.cost_amount ?? substrate.unit_cost ?? 0),
          quantity: 1,
          acquisition_type: substrate.acquisition_type || "unit_cost",
          unit_cost: Number(substrate.unit_cost ?? 0),
          cost_amount: Number(substrate.cost_amount ?? substrate.unit_cost ?? 0),
          pass_through_method: substrate.pass_through_method || "none",
          fixed_pass_through_amount: Number(substrate.fixed_pass_through_amount ?? 0),
          pass_through_percent: Number(substrate.pass_through_percent ?? 0),
          allocation_quantity: Number(substrate.allocation_quantity ?? 0),
        });
      }
    }

    return normalized;
  }

  function budgetItemSubstratesFromProduct(product) {
    return productPricingSubstrates(product).map((entry) => ({
      id: entry.substrate.id,
      name: entry.substrate.name,
      cost: Number(entry.substrate.cost_amount ?? entry.substrate.unit_cost ?? 0),
      quantity: Number(entry.quantity || 1),
      acquisition_type: entry.substrate.acquisition_type || "unit_cost",
      unit_cost: Number(entry.substrate.unit_cost ?? 0),
      cost_amount: Number(entry.substrate.cost_amount ?? entry.substrate.unit_cost ?? 0),
      pass_through_method: entry.substrate.pass_through_method || "none",
      fixed_pass_through_amount: Number(entry.substrate.fixed_pass_through_amount ?? 0),
      pass_through_percent: Number(entry.substrate.pass_through_percent ?? 0),
      allocation_quantity: Number(entry.substrate.allocation_quantity ?? 0),
    }));
  }

  function budgetItemSubstrateEntries(row) {
    return [...row.querySelectorAll("[data-budget-item-substrate-row]")]
      .map((entry) => {
        const selected = substrateRecord(entry.querySelector('[name="item_substrate_id"]')?.value);
        const snapshotId = entry.querySelector('[name="item_substrate_snapshot_id"]')?.value || "";
        const useSnapshot = !selected || snapshotId === selected.id;
        const substrate = {
          id: selected?.id || entry.querySelector('[name="item_substrate_id"]')?.value || "",
          name: useSnapshot ? entry.querySelector('[name="item_substrate_name"]')?.value || selected?.name || "" : selected?.name || "",
          acquisition_type: useSnapshot ? entry.querySelector('[name="item_substrate_acquisition_type"]')?.value || selected?.acquisition_type || "unit_cost" : selected?.acquisition_type || "unit_cost",
          unit_cost: useSnapshot ? decimalInputValue(entry.querySelector('[name="item_substrate_unit_cost"]')?.value || selected?.unit_cost || 0) : Number(selected?.unit_cost || 0),
          cost_amount: useSnapshot ? decimalInputValue(entry.querySelector('[name="item_substrate_cost_amount"]')?.value || selected?.cost_amount || selected?.unit_cost || 0) : Number(selected?.cost_amount ?? selected?.unit_cost ?? 0),
          pass_through_method: useSnapshot ? entry.querySelector('[name="item_substrate_pass_through_method"]')?.value || selected?.pass_through_method || "none" : selected?.pass_through_method || "none",
          fixed_pass_through_amount: useSnapshot ? decimalInputValue(entry.querySelector('[name="item_substrate_fixed_pass_through_amount"]')?.value || selected?.fixed_pass_through_amount || 0) : Number(selected?.fixed_pass_through_amount || 0),
          pass_through_percent: useSnapshot ? decimalInputValue(entry.querySelector('[name="item_substrate_pass_through_percent"]')?.value || selected?.pass_through_percent || 0) : Number(selected?.pass_through_percent || 0),
          allocation_quantity: useSnapshot ? decimalInputValue(entry.querySelector('[name="item_substrate_allocation_quantity"]')?.value || selected?.allocation_quantity || 0) : Number(selected?.allocation_quantity || 0),
        };
        if (!substrate.id && !substrate.name) return null;
        return {
          substrate,
          quantity: Math.max(0, Number(String(entry.querySelector('[name="item_substrate_quantity"]')?.value || "1").replace(",", ".")) || 1),
        };
      })
      .filter(Boolean);
  }

  function calculateCustomBudgetItemPricing({ quantity = 1, hours = 0, hourlyRate = 0, substrates = [] } = {}) {
    return calculateProductPricing({
      product: { hours_per_unit: hours },
      quantity,
      financialSettings: {
        ...budgetFinancialSettings(),
        hourly_rate: hourlyRate || budgetFinancialSettings().hourly_rate,
      },
      substrates,
    });
  }

  function pricingSnapshotForBillableTotal(pricing, billableTotal) {
    const totalBeforeTax = roundMoney(billableTotal);
    const markupDivider = 1 + (Number(pricing.markupPercent || 0) / 100);
    const subtotal = markupDivider > 0 ? roundMoney(totalBeforeTax / markupDivider) : totalBeforeTax;
    const markupAmount = roundMoney(totalBeforeTax - subtotal);
    const taxAmount = roundMoney(subtotal * (Number(pricing.taxPercent || 0) / 100));
    return {
      ...pricing,
      subtotal,
      markupAmount,
      taxAmount,
      total: roundMoney(totalBeforeTax + taxAmount),
    };
  }

  function renderBudgetItemSubstrateRow(entry = {}) {
    const substrateOptions = state.substrates.map((substrate) => [substrate.id, `${substrate.name}${substrate.unit_cost ? ` · ${formatCurrency(substrate.unit_cost)}` : ""}`]);
    return `
      <div class="budget-item-substrate-row" data-budget-item-substrate-row>
        <input type="hidden" name="item_substrate_snapshot_id" value="${valueAttr(entry.id || entry.substrateId || "")}">
        <input type="hidden" name="item_substrate_name" value="${valueAttr(entry.name || "")}">
        <input type="hidden" name="item_substrate_acquisition_type" value="${valueAttr(entry.acquisition_type || "unit_cost")}">
        <input type="hidden" name="item_substrate_unit_cost" value="${valueAttr(entry.unit_cost ?? entry.cost ?? 0)}">
        <input type="hidden" name="item_substrate_cost_amount" value="${valueAttr(entry.cost_amount ?? entry.cost ?? 0)}">
        <input type="hidden" name="item_substrate_pass_through_method" value="${valueAttr(entry.pass_through_method || "none")}">
        <input type="hidden" name="item_substrate_fixed_pass_through_amount" value="${valueAttr(entry.fixed_pass_through_amount ?? 0)}">
        <input type="hidden" name="item_substrate_pass_through_percent" value="${valueAttr(entry.pass_through_percent ?? 0)}">
        <input type="hidden" name="item_substrate_allocation_quantity" value="${valueAttr(entry.allocation_quantity ?? 0)}">
        <label class="field compact-field">
          <span>Substrato</span>
          <select class="select" name="item_substrate_id" data-budget-item-calc>${selectOptions(substrateOptions, entry.id || entry.substrateId || "", "Selecione")}</select>
        </label>
        <label class="field compact-field">
          <span>Quantidade</span>
          <input class="input" name="item_substrate_quantity" type="number" min="0" step="0.01" value="${valueAttr(entry.quantity ?? 1)}" data-budget-item-calc>
        </label>
        <button class="icon-button" type="button" data-remove-budget-item-substrate>Remover</button>
      </div>`;
  }

  function renderBudgetItemRow(item = {}, index = 0) {
    const productOptions = state.products.map((product) => [product.id, product.name]);
    const quantity = Math.max(1, Number(item.quantity || 1));
    const hours = Number(item.estimatedHours || 0);
    const hourlyRate = Number(item.hourlyRate || budgetFinancialSettings().hourly_rate || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const total = Number(item.total || unitPrice * quantity || 0);
    const isAutoUnit = item.autoUnit || !unitPrice;
    const substratesUsed = normalizeBudgetItemSubstrates(item);

    return `
      <div class="budget-item-row" data-budget-item-row>
        <div class="budget-item-index">${index + 1}</div>
        <label class="field">
          <span>Produto</span>
          <select class="select" name="item_product_id" data-budget-item-calc>${selectOptions(productOptions, item.productId || "", "Sem produto")}</select>
        </label>
        <label class="field compact-field">
          <span>Quantidade</span>
          <input class="input" name="item_quantity" type="number" min="1" step="1" value="${valueAttr(quantity)}" data-budget-item-calc>
        </label>
        <div class="budget-item-total">
          <span>Total</span>
          <strong data-budget-item-total>${formatCurrency(total)}</strong>
        </div>
        <button class="icon-button budget-item-remove" type="button" data-remove-budget-item aria-label="Remover item">Remover</button>
        <label class="field budget-item-description-field">
          <span>Descrição do item</span>
          <textarea class="textarea textarea-small" name="item_description" placeholder="Descrição copiada do produto, editável apenas neste orçamento." data-budget-item-calc>${escapeHtml(item.description || "")}</textarea>
        </label>
        <details class="budget-item-customizer">
          <summary>Personalizar item</summary>
          <input type="hidden" name="item_product_snapshot_id" value="${valueAttr(item.productId || "")}">
          <div class="budget-item-customizer-grid">
            <label class="field compact-field">
              <span>Horas estimadas</span>
              <input class="input" name="item_custom_hours" type="number" min="0" step="0.25" value="${valueAttr(hours || "")}" data-budget-item-calc>
            </label>
            <label class="field compact-field">
              <span>Valor/hora usado</span>
              <input class="input" name="item_hourly_rate" type="number" min="0" step="0.01" value="${valueAttr(hourlyRate ? hourlyRate.toFixed(2) : "")}" data-budget-item-calc>
            </label>
            <label class="field compact-field">
              <span>Preço manual</span>
              <input class="input" name="item_unit_price" type="number" min="0" step="0.01" value="${valueAttr(unitPrice ? unitPrice.toFixed(2) : "")}" data-budget-item-calc data-auto-unit="${isAutoUnit ? "true" : "false"}">
            </label>
          </div>
          <div class="budget-item-substrate-panel">
            <div class="budget-item-substrate-heading">
              <strong>Substratos usados</strong>
              <button class="button button-secondary" type="button" data-add-budget-item-substrate ${state.substrates.length ? "" : "disabled"}>Adicionar substrato</button>
            </div>
            <div class="budget-item-substrate-list" data-budget-item-substrate-list>
              ${substratesUsed.map((entry) => renderBudgetItemSubstrateRow(entry)).join("")}
            </div>
            <template data-budget-item-substrate-template>
              ${renderBudgetItemSubstrateRow()}
            </template>
          </div>
          <div class="budget-item-calc-summary" data-budget-item-calc-summary>
            <span>Resumo do item</span>
            <strong>${formatCurrency(total)}</strong>
            <small>${formatDecimalHours(hours * quantity)} totais · ${substratesUsed.length} substrato(s)</small>
          </div>
        </details>
      </div>`;
  }

  function addBudgetItem(form) {
    const list = form?.querySelector("[data-budget-item-list]");
    if (!form || !list) return;
    list.insertAdjacentHTML("beforeend", renderBudgetItemRow({}, list.querySelectorAll("[data-budget-item-row]").length));
    updateBudgetItemsEstimate(form, true);
  }

  function removeBudgetItem(button) {
    const form = button?.closest("[data-budget-form]");
    const list = form?.querySelector("[data-budget-item-list]");
    const row = button?.closest("[data-budget-item-row]");
    if (!form || !list || !row) return;
    const rows = [...list.querySelectorAll("[data-budget-item-row]")];
    if (rows.length <= 1) {
      row.querySelectorAll("input, select, textarea").forEach((field) => {
        if (field.name === "item_quantity") field.value = "1";
        else if (field.name === "item_hourly_rate") field.value = valueAttr(budgetFinancialSettings().hourly_rate || "");
        else field.value = "";
      });
      const substrateList = row.querySelector("[data-budget-item-substrate-list]");
      if (substrateList) substrateList.innerHTML = "";
    } else {
      row.remove();
    }
    renumberBudgetItemRows(list);
    updateBudgetItemsEstimate(form, true);
  }

  function addBudgetItemSubstrate(button) {
    const row = button?.closest("[data-budget-item-row]");
    const list = row?.querySelector("[data-budget-item-substrate-list]");
    const template = row?.querySelector("[data-budget-item-substrate-template]");
    if (!row || !list || !template) return;
    list.insertAdjacentHTML("beforeend", template.innerHTML);
    updateBudgetItemsEstimate(row.closest("[data-budget-form]"), true);
  }

  function removeBudgetItemSubstrate(button) {
    const row = button?.closest("[data-budget-item-row]");
    button?.closest("[data-budget-item-substrate-row]")?.remove();
    updateBudgetItemsEstimate(row?.closest("[data-budget-form]"), true);
  }

  function renumberBudgetItemRows(list) {
    [...(list?.querySelectorAll("[data-budget-item-row]") || [])].forEach((row, index) => {
      const label = row.querySelector(".budget-item-index");
      if (label) label.textContent = String(index + 1);
    });
  }

  function contactOptions(selectedValue = "", clientId = "") {
    if (clientId) {
      const contacts = state.contacts.filter((contact) => contact.client_id === clientId);
      return [
        `<option value="">${contacts.length ? "Selecione" : "Sem contato cadastrado"}</option>`,
        ...contacts.map((contact) => `<option value="${escapeHtml(contact.id)}" ${String(selectedValue) === String(contact.id) ? "selected" : ""}>${escapeHtml(contact.name)}${contact.email ? ` · ${escapeHtml(contact.email)}` : ""}</option>`),
      ].join("");
    }

    const contactsByClient = state.clients.map((client) => {
      const contacts = state.contacts.filter((contact) => contact.client_id === client.id);
      if (!contacts.length) return "";
      return `
        <optgroup label="${escapeHtml(client.name)}">
          ${contacts.map((contact) => `<option value="${escapeHtml(contact.id)}" ${String(selectedValue) === String(contact.id) ? "selected" : ""}>${escapeHtml(contact.name)}${contact.email ? ` · ${escapeHtml(contact.email)}` : ""}</option>`).join("")}
        </optgroup>`;
    }).join("");
    return `<option value="">Sem contato vinculado</option>${contactsByClient}`;
  }

  function syncBudgetContactOptions(clientSelect) {
    const contactSelect = clientSelect?.closest("[data-budget-form]")?.querySelector("[data-budget-contact-select]");
    if (!contactSelect) return;
    contactSelect.innerHTML = contactOptions("", clientSelect.value);
  }

  function budgetPreviewItems(budget) {
    const payload = budgetPayload(budget);
    if (Array.isArray(payload.lineItems) && payload.lineItems.length) {
      return payload.lineItems.map((item, index) => ({
        code: String(index + 1).padStart(4, "0"),
        description: item.proposalDescription || item.description || item.text || item.title || "-",
        quantity: item.quantity || 1,
        unitPrice: Number(item.unitPrice || 0),
        total: Number(item.total || 0),
      }));
    }

    if (Array.isArray(payload.items) && payload.items.length) {
      const fallbackTotal = Number(budget.subtotal || budget.total || 0) / payload.items.length;
      return payload.items.map((item, index) => {
        const quantity = typeof item === "string" ? payload.quantity || 1 : item.quantity || payload.quantity || 1;
        const unitPrice = typeof item === "string" ? fallbackTotal : Number(item.unitPrice ?? item.unit_price ?? fallbackTotal);
        return {
          code: String(index + 1).padStart(4, "0"),
          description: typeof item === "string" ? item : item.text || item.title || "-",
          quantity,
          unitPrice,
          total: typeof item === "string" ? fallbackTotal : Number(item.total ?? item.amount ?? unitPrice * quantity),
        };
      });
    }

    const textItems = budgetItemsText(budget).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (textItems.length) {
      const unitPrice = textItems.length ? Number(budget.total || 0) / textItems.length : 0;
      return textItems.map((description, index) => ({
        code: String(index + 1).padStart(4, "0"),
        description,
        quantity: 1,
        unitPrice,
        total: unitPrice,
      }));
    }

    return [{
      code: "0001",
      description: budget.title || budgetPayload(budget).serviceType || "Serviço",
      quantity: payload.quantity || 1,
      unitPrice: Number(budget.total || 0),
      total: Number(budget.total || 0),
    }];
  }

  function budgetPayload(record) {
    if (!record?.payload || typeof record.payload !== "object" || Array.isArray(record.payload)) return {};
    return record.payload;
  }

  function budgetItemsText(record) {
    const payload = budgetPayload(record);
    if (Array.isArray(payload.lineItems) && payload.lineItems.length) {
      return payload.lineItems
        .map((item) => item.description || item.text || item.title)
        .filter(Boolean)
        .join("\n");
    }
    if (typeof payload.itemsText === "string") return payload.itemsText;
    if (!Array.isArray(payload.items)) return "";
    return payload.items
      .map((item) => typeof item === "string" ? item : item?.text)
      .filter(Boolean)
      .join("\n");
  }

  function firstBudgetItemLine(record) {
    return budgetItemsText(record).split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
  }

  function budgetItemsFromText(value, total = 0) {
    const lines = String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const unitTotal = lines.length ? Number(total || 0) / lines.length : 0;
    return lines.map((text, index) => ({
      position: index + 1,
      text,
      title: text,
      quantity: 1,
      unitPrice: unitTotal,
      total: unitTotal,
    }));
  }

  function budgetValidityText(budget) {
    if (!budget.valid_until) return "Sem validade";
    return `${isBudgetOverdue(budget) ? "Venceu em" : "Até"} ${formatDate(budget.valid_until)}`;
  }

  function isBudgetOverdue(budget) {
    if (!budget?.valid_until || ["approved", "rejected"].includes(budget.status)) return false;
    const endOfDay = Date.parse(`${String(budget.valid_until).slice(0, 10)}T23:59:59Z`);
    return Number.isFinite(endOfDay) && endOfDay < Date.now();
  }

  function textFromForm(data, key) {
    return String(data.get(key) || "").trim();
  }

  function optionalQuantityFromForm(data, errors) {
    const rawValue = String(data.get("quantity") || "").trim();
    if (!rawValue) return null;
    if (!/^\d+$/.test(rawValue)) {
      errors.push("Quantidade deve ser um número inteiro.");
      return null;
    }
    const value = Number(rawValue);
    if (!Number.isSafeInteger(value) || value <= 0) {
      errors.push("Quantidade deve ser maior que zero.");
      return null;
    }
    return value;
  }

  function updateBudgetTotalPreview(form) {
    if (!form) return;
    if (typeof document !== "undefined" && document.activeElement?.name === "subtotal") {
      form.elements.subtotal.dataset.autoSubtotal = "false";
    }
    if (typeof document !== "undefined" && document.activeElement?.name === "tax") {
      form.elements.tax.dataset.autoTax = "false";
    }
    const target = form.querySelector("[data-budget-total-preview-value]");
    const subtotal = decimalInputValue(form.elements.subtotal?.value);
    const discount = decimalInputValue(form.elements.discount?.value);
    const tax = decimalInputValue(form.elements.tax?.value);
    const grossTotal = subtotal + tax;
    const discountAmount = roundMoney(grossTotal * (discount / 100));
    const finalTotal = roundMoney(grossTotal - discountAmount);
    const grossNode = form.querySelector("[data-budget-gross-total]");
    const discountNode = form.querySelector("[data-budget-discount-preview]");
    if (grossNode) grossNode.textContent = formatCurrency(grossTotal);
    if (discountNode) discountNode.textContent = `${formatPercent(discount)} · ${formatCurrency(discountAmount)}`;
    if (target) target.textContent = formatCurrency(finalTotal);
  }

  function updateBudgetEstimate(form, forceSubtotal = false) {
    if (!form) return;
    if (form.querySelector("[data-budget-item-list]")) {
      updateBudgetItemsEstimate(form, forceSubtotal);
      return;
    }
    const product = productRecord(form.elements.product_id?.value);
    const substrate = substrateRecord(form.elements.substrate_id?.value);
    const quantity = Math.max(1, Number(form.elements.quantity?.value || 1));
    const pricing = calculateBudgetPricing(product, quantity, substrate);
    const subtotal = pricing.subtotal + pricing.markupAmount;
    const subtotalInput = form.elements.subtotal;
    const shouldWriteSubtotal = subtotalInput
      && subtotal > 0
      && (forceSubtotal || !subtotalInput.value || subtotalInput.dataset.autoSubtotal === "true");
    if (shouldWriteSubtotal) {
      subtotalInput.value = subtotal.toFixed(2);
      subtotalInput.dataset.autoSubtotal = "true";
    }
    const taxInput = form.elements.tax;
    if (taxInput && pricing.taxAmount > 0 && (forceSubtotal || !taxInput.value || taxInput.dataset.autoTax === "true")) {
      taxInput.value = pricing.taxAmount.toFixed(2);
      taxInput.dataset.autoTax = "true";
    }
    const detail = form.querySelector("[data-budget-estimate-detail]");
    if (detail) {
      const parts = [
        product ? `${product.name}: ${productPricingLabel(product)}` : "",
        product ? `Mão de obra ${formatCurrency(pricing.laborCost)}` : "",
        pricing.substrateCost ? `Substratos ${formatCurrency(pricing.substrateCost)}` : "",
        pricing.markupAmount ? `Markup ${formatPercent(pricing.markupPercent)} (${formatCurrency(pricing.markupAmount)})` : "",
        quantity ? `${quantity} un.` : "",
      ].filter(Boolean);
      detail.textContent = parts.length ? parts.join(" · ") : "Selecione produto e custos para estimar automaticamente.";
    }
    updateBudgetPricingSummary(form, product ? pricing : emptyBudgetPricingSnapshot());
    updateBudgetTotalPreview(form);
  }

  function updateBudgetItemsEstimate(form, forceSubtotal = false, resetManualUnits = false) {
    if (!form) return;
    const rows = [...form.querySelectorAll("[data-budget-item-row]")];
    if (!rows.length) {
      updateBudgetPricingSummary(form);
      updateBudgetTotalPreview(form);
      return;
    }

    let subtotal = 0;
    let taxAmount = 0;
    const detailParts = [];
    const pricingSnapshots = [];
    rows.forEach((row) => {
      const product = productRecord(row.querySelector('[name="item_product_id"]')?.value);
      const quantityInput = row.querySelector('[name="item_quantity"]');
      const hoursInput = row.querySelector('[name="item_estimated_hours"]');
      const customHoursInput = row.querySelector('[name="item_custom_hours"]');
      const hourlyRateInput = row.querySelector('[name="item_hourly_rate"]');
      const unitInput = row.querySelector('[name="item_unit_price"]');
      const snapshotInput = row.querySelector('[name="item_product_snapshot_id"]');
      const quantity = Math.max(1, Number(quantityInput?.value || 1));
      const productChanged = product && snapshotInput && snapshotInput.value !== product.id;

      if (productChanged) {
        // Produto sugere. Orçamento decide: copiamos o preset para a linha e depois a linha vira snapshot editável.
        const defaultHours = Number(product.hours_per_unit ?? product.estimated_hours ?? 0);
        const defaultHourlyRate = Number(budgetFinancialSettings().hourly_rate || product.hourly_rate || 0);
        const descriptionInput = row.querySelector('[name="item_description"]');
        if (descriptionInput) descriptionInput.value = product.description || product.name || descriptionInput.value || "";
        if (hoursInput) hoursInput.value = defaultHours ? String(defaultHours) : "";
        if (customHoursInput) customHoursInput.value = defaultHours ? String(defaultHours) : "";
        if (hourlyRateInput) hourlyRateInput.value = defaultHourlyRate ? defaultHourlyRate.toFixed(2) : "";
        if (unitInput) unitInput.dataset.autoUnit = "true";

        const substrateList = row.querySelector("[data-budget-item-substrate-list]");
        if (substrateList) {
          substrateList.innerHTML = budgetItemSubstratesFromProduct(product).map((entry) => renderBudgetItemSubstrateRow(entry)).join("");
        }
        snapshotInput.value = product.id;
      }

      if (customHoursInput && hoursInput && typeof document !== "undefined" && document.activeElement === hoursInput) {
        customHoursInput.value = hoursInput.value;
      }
      if (hoursInput && customHoursInput && typeof document !== "undefined" && document.activeElement === customHoursInput) {
        hoursInput.value = customHoursInput.value;
      }

      const hours = Math.max(0, Number(String(customHoursInput?.value || hoursInput?.value || "0").replace(",", ".")) || 0);
      const hourlyRate = Math.max(0, Number(String(hourlyRateInput?.value || budgetFinancialSettings().hourly_rate || "0").replace(",", ".")) || 0);
      const substrates = budgetItemSubstrateEntries(row);
      const pricing = calculateCustomBudgetItemPricing({ quantity, hours, hourlyRate, substrates });
      const billableSubtotal = pricing.subtotal + pricing.markupAmount;
      const automaticUnitPrice = quantity ? billableSubtotal / quantity : billableSubtotal;
      if (product || hours || substrates.length) pricingSnapshots.push(pricing);
      if (resetManualUnits && unitInput) {
        unitInput.dataset.autoUnit = "true";
      }
      if (unitInput && typeof document !== "undefined" && document.activeElement === unitInput) {
        unitInput.dataset.autoUnit = "false";
      }
      const shouldWriteUnit = unitInput
        && automaticUnitPrice > 0
        && (!unitInput.value || unitInput.dataset.autoUnit === "true" || (forceSubtotal && unitInput.dataset.autoUnit !== "false"));
      if (shouldWriteUnit) {
        unitInput.value = automaticUnitPrice.toFixed(2);
        unitInput.dataset.autoUnit = "true";
      }
      const unitPrice = decimalInputValue(unitInput?.value);
      const total = unitPrice * quantity;
      const itemSnapshot = pricingSnapshotForBillableTotal(pricing, total);
      subtotal += total;
      taxAmount += itemSnapshot.taxAmount;
      const totalNode = row.querySelector("[data-budget-item-total]");
      if (totalNode) totalNode.textContent = formatCurrency(total);
      const rowSummary = row.querySelector("[data-budget-item-calc-summary]");
      if (rowSummary) {
        const strong = rowSummary.querySelector("strong");
        const small = rowSummary.querySelector("small");
        if (strong) strong.textContent = formatCurrency(total);
        if (small) small.textContent = `${formatDecimalHours(itemSnapshot.laborHours)} totais · ${formatCurrency(itemSnapshot.laborCost)} mão de obra · ${formatCurrency(itemSnapshot.substrateCost)} substratos`;
      }
      if (product || hours || substrates.length) {
        detailParts.push([
          product ? product.name : "Item manual",
          `${formatDecimalHours(itemSnapshot.laborHours)} totais`,
          substrates.length ? `${substrates.length} substrato(s)` : "",
          `Total estimado ${formatCurrency(total)}`,
        ].filter(Boolean).join(" · "));
      }
      if (product || hours || substrates.length) {
        pricingSnapshots[pricingSnapshots.length - 1] = itemSnapshot;
      }
    });

    const pricingSnapshot = combineBudgetPricingSnapshots(pricingSnapshots);
    const automaticSubtotal = pricingSnapshots.length ? pricingSnapshot.subtotal + pricingSnapshot.markupAmount : subtotal;
    const subtotalInput = form.elements.subtotal;
    if (subtotalInput && (forceSubtotal || !subtotalInput.value || subtotalInput.dataset.autoSubtotal === "true")) {
      subtotalInput.value = automaticSubtotal.toFixed(2);
      subtotalInput.dataset.autoSubtotal = "true";
    }
    const taxInput = form.elements.tax;
    if (taxInput && (forceSubtotal || !taxInput.value || taxInput.dataset.autoTax === "true")) {
      taxInput.value = taxAmount.toFixed(2);
      taxInput.dataset.autoTax = "true";
    }
    const detail = form.querySelector("[data-budget-estimate-detail]");
    if (detail) {
      detail.textContent = detailParts.length
        ? detailParts.join(" | ")
        : "Adicione produtos, custos e quantidades para estimar automaticamente.";
    }
    updateBudgetPricingSummary(form, pricingSnapshot);
    updateBudgetTotalPreview(form);
  }

  function decimalInputValue(value) {
    const number = Number(String(value || "").replace(",", "."));
    return Number.isFinite(number) ? number : 0;
  }

  function nonNegativeNumberFromRaw(rawValue, label, errors, defaultValue = 0) {
    const value = String(rawValue ?? "").trim().replace(",", ".");
    if (!value) return defaultValue;
    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      errors.push(`${label} deve ser um número positivo.`);
      return defaultValue;
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      errors.push(`${label} não pode ser negativo.`);
      return defaultValue;
    }
    return number;
  }

  function positiveQuantityFromRaw(rawValue, label, errors, defaultValue = 1) {
    const value = String(rawValue ?? "").trim().replace(",", ".");
    if (!value) return defaultValue;
    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      errors.push(`${label} deve ser um número positivo.`);
      return defaultValue;
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      errors.push(`${label} deve ser maior que zero.`);
      return defaultValue;
    }
    return number;
  }

  function collectBudgetLineItems(form, errors) {
    const lineItems = [];
    const rows = [...form.querySelectorAll("[data-budget-item-row]")];

    rows.forEach((row) => {
      const index = lineItems.length;
      const product = productRecord(row.querySelector('[name="item_product_id"]')?.value);
      const description = String(row.querySelector('[name="item_description"]')?.value || "").trim();
      const proposalDescription = description;
      const unitPriceRaw = row.querySelector('[name="item_unit_price"]')?.value;
      const quantity = positiveQuantityFromRaw(row.querySelector('[name="item_quantity"]')?.value, `Quantidade do item ${index + 1}`, errors, 1);
      const hours = nonNegativeNumberFromRaw(row.querySelector('[name="item_custom_hours"]')?.value || row.querySelector('[name="item_estimated_hours"]')?.value, `Horas do item ${index + 1}`, errors, 0);
      const hourlyRate = nonNegativeNumberFromRaw(row.querySelector('[name="item_hourly_rate"]')?.value, `Valor/hora do item ${index + 1}`, errors, budgetFinancialSettings().hourly_rate);
      const substrateEntries = budgetItemSubstrateEntries(row);
      const hasAnyValue = description || proposalDescription || product || substrateEntries.length || String(unitPriceRaw || "").trim() || hours;
      if (!hasAnyValue) return;

      const pricing = calculateCustomBudgetItemPricing({ quantity, hours, hourlyRate, substrates: substrateEntries });
      const automaticUnitPrice = quantity ? (pricing.subtotal + pricing.markupAmount) / quantity : pricing.subtotal + pricing.markupAmount;
      const unitPrice = nonNegativeNumberFromRaw(unitPriceRaw, `Preço unitário do item ${index + 1}`, errors, automaticUnitPrice || 0);
      const total = unitPrice * quantity;
      const itemSnapshot = pricingSnapshotForBillableTotal(pricing, total);
      const autoUnit = roundMoney(unitPrice) === roundMoney(automaticUnitPrice);
      const substratesUsed = substrateEntries.map((entry) => ({
        id: entry.substrate.id,
        name: entry.substrate.name,
        cost: Number(entry.substrate.cost_amount ?? entry.substrate.unit_cost ?? 0),
        quantity: entry.quantity,
        acquisition_type: entry.substrate.acquisition_type || "unit_cost",
        unit_cost: Number(entry.substrate.unit_cost ?? 0),
        cost_amount: Number(entry.substrate.cost_amount ?? entry.substrate.unit_cost ?? 0),
        pass_through_method: entry.substrate.pass_through_method || "none",
        fixed_pass_through_amount: Number(entry.substrate.fixed_pass_through_amount ?? 0),
        pass_through_percent: Number(entry.substrate.pass_through_percent ?? 0),
        allocation_quantity: Number(entry.substrate.allocation_quantity ?? 0),
      }));
      const title = description || product?.name || substratesUsed.map((entry) => entry.name).join(", ") || `Item ${index + 1}`;
      lineItems.push({
        position: lineItems.length + 1,
        text: title,
        title,
        description: title,
        proposalDescription: proposalDescription || title,
        productId: product?.id || "",
        productName: product?.name || "",
        productPricingModel: product?.pricing_model || "",
        substrateId: substratesUsed[0]?.id || "",
        substrateName: substratesUsed[0]?.name || "",
        quantity,
        unitPrice,
        autoUnit,
        total,
        baseAmount: pricing.laborCost,
        includedSubstrates: substratesUsed,
        substratesUsed,
        additionalSubstrateCost: pricing.substrateCost,
        estimatedHours: itemSnapshot.laborHours,
        hourlyRate: itemSnapshot.hourlyRate,
        markup: itemSnapshot.markupPercent,
        pricingSnapshot: itemSnapshot,
      });
    });

    return lineItems;
  }

  function uniqueIncludedSubstrates(lineItems = []) {
    const map = new Map();
    lineItems.forEach((item) => {
      (item.includedSubstrates || []).forEach((substrate) => {
        const key = substrate.id || substrate.name;
        if (!key || map.has(key)) return;
        map.set(key, substrate);
      });
    });
    return [...map.values()];
  }

  function hoursFromEntry(entry) {
    return Number(entry?.minutes || 0) / 60;
  }

  function hoursInputValue(entry) {
    const hours = hoursFromEntry(entry);
    if (!hours) return "1";
    return Number.isInteger(hours) ? String(hours) : String(Number(hours.toFixed(2)));
  }

  function formatDecimalHours(value = 0) {
    const hours = Number(value || 0);
    return `${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
      minimumFractionDigits: Number.isInteger(hours) ? 0 : 1,
    }).format(hours)} h`;
  }

  function formatDecimalNumber(value = 0) {
    const number = Number(value || 0);
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
      minimumFractionDigits: Number.isInteger(number) ? 0 : 1,
    }).format(number);
  }

  function formatPercent(value = 0) {
    return `${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(Number(value || 0))}%`;
  }

  function billableAmount(entry) {
    return hoursFromEntry(entry) * Number(entry?.hourly_rate || 0);
  }

  function positiveHoursFromForm(data, errors) {
    const rawValue = String(data.get("hours") || "").trim().replace(",", ".");
    if (!rawValue) {
      errors.push("Preencha horas.");
      return 0;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(rawValue)) {
      errors.push("Horas deve ser um número positivo.");
      return 0;
    }
    const hours = Number(rawValue);
    if (!Number.isFinite(hours) || hours <= 0) {
      errors.push("Horas deve ser maior que zero.");
      return 0;
    }
    return hours;
  }

  function boundedPercentFromForm(data, key, label, errors) {
    const value = nonNegativeNumberFromForm(data, key, label, errors);
    if (value > 100) {
      errors.push(`${label} deve ser no máximo 100%.`);
      return 0;
    }
    return value;
  }

  function openBudgetModal(id = "") {
    const budget = selectedBudgetFromState(id);
    state.crmEdit = budget ? { table: "budgets", id: budget.id } : null;
    state.modal = renderBudgetModal(budget);
    clearNotice();
    render();
    if (!state.financialSettingsLoaded && !state.financialSettingsLoading && typeof loadFinancialSettings === "function") {
      loadFinancialSettings()
        .then(({ error } = {}) => {
          if (error || typeof document === "undefined") return;
          const form = document.querySelector("[data-budget-form]");
          if (!budget && form) updateBudgetItemsEstimate(form);
        })
        .catch(() => {});
    }
  }

  function openContactModal(clientId = "", contactId = "") {
    const contact = state.contacts.find((item) => item.id === contactId) || null;
    const resolvedClientId = contact?.client_id || clientId || "";
    state.crmEdit = contact ? { table: "contacts", id: contact.id } : null;
    state.modal = renderContactModal(contact, resolvedClientId);
    clearNotice();
    render();
  }

  function renderContactModal(contact, clientId = "") {
    const clientOptions = state.clients.map((client) => [client.id, client.name]);
    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${contact ? "Editar contato" : "Novo contato"}">
        <form class="modal form-stack" data-contact-form ${crmFormAttrs("contacts")}>
          <div class="modal-header">
            <div>
              <span class="eyebrow">Contato</span>
              <h2>${contact ? "Editar contato" : "Novo contato"}</h2>
            </div>
            <button class="icon-button" type="button" data-close-modal>Fechar</button>
          </div>
          <label class="field">
            <span>Cliente</span>
            <select class="select" name="client_id" required>${selectOptions(clientOptions, clientId || contact?.client_id || "", "Selecione")}</select>
          </label>
          <label class="field">
            <span>Nome</span>
            <input class="input" name="name" value="${valueAttr(contact?.name)}" required>
          </label>
          <label class="field">
            <span>Cargo / papel</span>
            <input class="input" name="role" value="${valueAttr(contact?.role)}" placeholder="Compras, marketing, direção...">
          </label>
          <div class="form-grid">
            <label class="field">
              <span>E-mail</span>
              <input class="input" name="email" type="email" value="${valueAttr(contact?.email)}">
            </label>
            <label class="field">
              <span>Telefone</span>
              <input class="input" name="phone" value="${valueAttr(contact?.phone)}">
            </label>
          </div>
          <label class="field">
            <span>Notas</span>
            <textarea class="textarea textarea-small" name="notes">${escapeHtml(contact?.notes || "")}</textarea>
          </label>
          ${renderCrmFormActions("contacts", contact, "Criar contato", "Salvar contato")}
        </form>
      </div>`;
  }

  function renderBudgetModal(budget) {
    const editingPayload = budgetPayload(budget);
    const editingItems = budgetEditorItems(budget);
    const subtotal = Number(budget?.subtotal || 0);
    const discount = Number(budget?.discount || 0);
    const tax = Number(budget?.tax || 0);
    const clientOptions = state.clients.map((client) => [client.id, client.name]);
    const pricingSnapshot = budgetPricingSnapshot(budget);
    const grossTotal = subtotal + tax;
    const discountAmount = roundMoney(grossTotal * (discount / 100));
    const finalTotal = roundMoney(grossTotal - discountAmount);
    const validUntilValue = dateInputValue(budget?.valid_until) || defaultBudgetValidUntil();
    const createdAtLabel = formatDateTime(budget?.created_at || new Date().toISOString());
    const creatorLabel = budget?.created_by_email || editingPayload.createdByEmail || currentUserLabel();
    const paymentMethod = editingPayload.paymentMethod || editingPayload.paymentTerms || "";
    const paymentInstallments = editingPayload.paymentInstallments || "";
    const deliveryDateValue = budgetDeliveryInputValue(editingPayload.deliveryTerms);
    const discountReason = editingPayload.discountReason || "";
    const discountReasonOther = editingPayload.discountReasonOther || "";
    const hasDiscount = discount > 0;

    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${budget ? "Editar orçamento" : "Novo orçamento"}">
        <form class="modal modal-wide form-stack budget-form" data-budget-form ${crmFormAttrs("budgets")}>
          <div class="modal-header">
            <div>
              <span class="eyebrow">Orçamento</span>
              <h2>${budget ? "Editar orçamento" : "Novo orçamento"}</h2>
            </div>
            <button class="icon-button" type="button" data-close-modal>Fechar</button>
          </div>

          <section class="budget-identity-panel" aria-label="Identificação do orçamento">
            <div>
              <span>Número do orçamento</span>
              <strong>Orçamento nº ${escapeHtml(budget ? budgetNumberLabel(budget) : String(nextBudgetNumberPreview()))}</strong>
            </div>
            <div>
              <span>Data e hora de criação</span>
              <strong>${escapeHtml(createdAtLabel)}</strong>
            </div>
            <div>
              <span>Usuário criador</span>
              <strong>${escapeHtml(creatorLabel)}</strong>
            </div>
          </section>

          <section class="budget-section">
            <div class="budget-section-heading">
              <strong>Ficha comercial</strong>
              <span>Dados essenciais da proposta.</span>
            </div>
            <label class="field field-span-2">
              <span>Título do serviço</span>
              <input class="input" name="title" value="${valueAttr(budget?.title)}" required>
            </label>
            <div class="form-grid">
              <label class="field">
                <span>Cliente</span>
                <select class="select" name="client_id" data-budget-client-select>${selectOptions(clientOptions, budget?.client_id || "", "Sem cliente")}</select>
              </label>
              <label class="field">
                <span>Contato</span>
                <select class="select" name="contact_id" data-budget-contact-select>${contactOptions(budget?.contact_id || "", budget?.client_id || "")}</select>
              </label>
            </div>
            <div class="form-grid">
              <label class="field">
                <span>Orçamento para</span>
                <select class="select" name="budget_for">${selectOptions([["Cliente", "Cliente"], ["Interno", "Interno"], ["Agência", "Agência"]], editingPayload.budgetFor || "Cliente")}</select>
              </label>
              <label class="field">
                <span>Validade</span>
                <input class="input" name="valid_until" type="date" value="${valueAttr(validUntilValue)}" readonly>
              </label>
            </div>
          </section>

          <section class="budget-section">
            <div class="budget-section-heading">
              <strong>Itens e cálculo</strong>
              <span>Produto sugere. Orçamento decide. Personalize apenas as exceções.</span>
            </div>
            <div class="budget-item-list" data-budget-item-list>
              ${renderBudgetItemRows(editingItems)}
            </div>
            <div class="budget-item-actions">
              <button class="button button-secondary" type="button" data-add-budget-item>Adicionar item</button>
              <button class="button button-secondary" type="button" data-recalc-budget-items>Recalcular valores</button>
            </div>
            <div class="budget-estimate-detail" data-budget-estimate-detail>
              Adicione produtos, custos e quantidades para estimar automaticamente.
            </div>
            ${renderBudgetPricingSummary(pricingSnapshot)}
          </section>

          <section class="budget-section">
            <div class="budget-section-heading">
              <strong>Valores e condições</strong>
              <span>Condições comerciais que podem aparecer na proposta.</span>
            </div>
            <input type="hidden" name="subtotal" value="${valueAttr(budget?.subtotal ?? "")}" data-budget-subtotal data-auto-subtotal="true">
            <input type="hidden" name="tax" value="${valueAttr(budget?.tax ?? "")}" data-auto-tax="true">
            <div class="form-grid">
              <label class="field">
                <span>Desconto (%)</span>
                <span class="affix-field">
                  <input class="input" name="discount" type="number" min="0" max="100" step="0.01" placeholder="0" value="${valueAttr(budget?.discount ?? "")}" data-budget-money data-budget-discount-percent>
                  <span class="field-affix" aria-hidden="true">%</span>
                </span>
              </label>
              <label class="field ${hasDiscount ? "" : "is-hidden"}" data-discount-reason-field>
                <span>Justificativa do desconto</span>
                <select class="select" name="discount_reason" data-discount-reason-select>
                  ${selectOptions([["Pagamento no Pix", "Pagamento no Pix"], ["Permuta", "Permuta"], ["Promoção", "Promoção"], ["Indicação", "Indicação"], ["Outro", "Outro"]], discountReason, "Selecione")}
                </select>
              </label>
            </div>
            <label class="field ${hasDiscount && discountReason === "Outro" ? "" : "is-hidden"}" data-discount-reason-other-field>
              <span>Qual justificativa?</span>
              <input class="input" name="discount_reason_other" value="${valueAttr(discountReasonOther)}" placeholder="Descreva a justificativa do desconto">
            </label>
            <div class="budget-final-summary" aria-live="polite">
              <div>
                <span>Total estimado</span>
                <strong data-budget-gross-total>${formatCurrency(grossTotal)}</strong>
              </div>
              <div>
                <span>Desconto aplicado</span>
                <strong data-budget-discount-preview>${formatPercent(discount)} · ${formatCurrency(discountAmount)}</strong>
              </div>
              <div>
                <span>Total final</span>
                <strong data-budget-total-preview-value>${formatCurrency(finalTotal)}</strong>
              </div>
            </div>
            <div class="form-grid">
              <label class="field">
                <span>Pagamento</span>
                <select class="select" name="payment_method" data-payment-method-select>
                  ${selectOptions([["Pix", "Pix"], ["Débito", "Débito"], ["Boleto", "Boleto"], ["Crédito à vista", "Crédito à vista"], ["Crédito parcelado", "Crédito parcelado"], ["Transferência", "Transferência"]], paymentMethod, "Selecione")}
                </select>
              </label>
              <label class="field ${paymentMethod === "Crédito parcelado" ? "" : "is-hidden"}" data-payment-installments-field>
                <span>Número de parcelas</span>
                <select class="select" name="payment_installments">
                  ${selectOptions(Array.from({ length: 11 }, (_, index) => {
                    const value = `${index + 2}x`;
                    return [value, value];
                  }), paymentInstallments, "Selecione")}
                </select>
              </label>
              <label class="field">
                <span>Entrega</span>
                <input class="input" name="delivery_terms" type="date" value="${valueAttr(deliveryDateValue)}">
              </label>
            </div>
          </section>

          ${renderCrmFormActions("budgets", budget, "Criar orçamento", "Salvar orçamento")}
        </form>
      </div>`;
  }

  function openProductModal(id = "") {
    const product = state.products.find((item) => item.id === id) || null;
    state.crmEdit = product ? { table: "products", id: product.id } : null;
    state.modal = renderProductModal(product);
    clearNotice();
    render();
  }

  function renderProductModal(product) {
    const hoursPerUnit = Number(product?.hours_per_unit ?? product?.estimated_hours ?? 0);

    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${product ? "Editar produto" : "Novo produto"}">
        <form class="modal modal-wide form-stack crm-editor-form" data-product-form ${crmFormAttrs("products")}>
          <div class="modal-header">
            <div>
              <span class="eyebrow">Produto</span>
              <h2>${product ? "Editar produto" : "Novo produto"}</h2>
            </div>
            <button class="icon-button" type="button" data-close-modal>Fechar</button>
          </div>
          <div class="crm-form-sections">
            <section class="crm-form-section">
              <span class="eyebrow">Produto</span>
              <div class="crm-form-grid">
                <label class="field field-span-2">
                  <span>Nome</span>
                  <input class="input" name="name" value="${valueAttr(product?.name)}" required>
                </label>
                <label class="field">
                  <span>Categoria</span>
                  <input class="input" name="category" value="${valueAttr(product?.category)}" placeholder="Landing page, apresentação, social...">
                </label>
                <label class="field">
                  <span>Status</span>
                  <select class="select" name="status">${selectOptions([["active", "Ativo"], ["inactive", "Inativo"]], product?.status || "active")}</select>
                </label>
              </div>
            </section>
            <section class="crm-form-section">
              <span class="eyebrow">Base de cálculo</span>
              <div class="crm-form-grid">
                <label class="field field-span-2">
                  <span>Horas padrão</span>
                  <input class="input" name="hours_per_unit" type="number" min="0" step="0.25" value="${valueAttr(hoursPerUnit || "")}" placeholder="24">
                </label>
                <label class="field field-span-2">
                  <span>Preço base</span>
                  <input class="input" name="base_price" type="number" min="0" step="0.01" value="${valueAttr(product?.base_price ?? "")}" placeholder="0.00">
                </label>
              </div>
            </section>
            ${renderProductSubstrateChoices(product)}
            <section class="crm-form-section">
              <span class="eyebrow">Descrição</span>
              <label class="field">
                <span>Descrição padrão</span>
                <textarea class="textarea textarea-small" name="description" placeholder="Texto base copiado para o orçamento e ajustado por cliente/projeto.">${escapeHtml(product?.description || "")}</textarea>
              </label>
            </section>
          </div>
          ${renderCrmFormActions("products", product, "Criar produto", "Salvar produto")}
        </form>
      </div>`;
  }

  function openSubstrateModal(id = "") {
    const substrate = state.substrates.find((item) => item.id === id) || null;
    state.crmEdit = substrate ? { table: "substrates", id: substrate.id } : null;
    state.modal = renderSubstrateModal(substrate);
    clearNotice();
    render();
  }

  function renderSubstrateModal(substrate) {
    const passThroughMethod = substratePassThroughMethod(substrate);
    const acquisitionType = substrateAcquisitionType(substrate);
    const costAmount = substrateCostAmount(substrate);

    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${substrate ? "Editar substrato" : "Novo substrato"}">
        <form class="modal modal-wide form-stack crm-editor-form" data-substrate-form ${crmFormAttrs("substrates")}>
          <div class="modal-header">
            <div>
              <span class="eyebrow">Substrato</span>
              <h2>${substrate ? "Editar substrato" : "Novo substrato"}</h2>
            </div>
            <button class="icon-button" type="button" data-close-modal>Fechar</button>
          </div>
          <div class="crm-form-sections">
            <section class="crm-form-section">
              <span class="eyebrow">Informações do substrato</span>
              <div class="crm-form-grid">
                <label class="field field-span-4">
                  <span>Nome</span>
                  <input class="input" name="name" value="${valueAttr(substrate?.name)}" required>
                </label>
              </div>
            </section>
            <section class="crm-form-section">
              <span class="eyebrow">Precificação</span>
              <div class="crm-form-grid">
                <label class="field field-span-2">
                  <span>Tipo de custo</span>
                  <select class="select" name="acquisition_type">${selectOptions(SUBSTRATE_ACQUISITION_TYPES, acquisitionType)}</select>
                </label>
                <label class="field field-span-2">
                  <span>Custo</span>
                  <span class="affix-field">
                    <span class="field-affix" aria-hidden="true">R$</span>
                    <input class="input" name="cost_amount" type="number" min="0" step="0.01" inputmode="decimal" value="${valueAttr(costAmount || "")}" placeholder="70,00">
                  </span>
                </label>
              </div>
            </section>
            <section class="crm-form-section">
              <span class="eyebrow">Repasse</span>
              <div class="crm-form-grid">
                <label class="field field-span-2">
                  <span>Repasse ao cliente</span>
                  <select class="select" name="pass_through_method" data-substrate-pass-through-method>${selectOptions(SUBSTRATE_PASS_THROUGH_METHODS, passThroughMethod)}</select>
                </label>
                <label class="field field-span-2 ${passThroughMethod === "fixed" ? "" : "is-hidden"}" data-substrate-rule-field="fixed">
                  <span>Valor fixo de repasse</span>
                  <span class="affix-field">
                    <span class="field-affix" aria-hidden="true">R$</span>
                    <input class="input" name="fixed_pass_through_amount" type="number" min="0" step="0.01" inputmode="decimal" value="${valueAttr(substrate?.fixed_pass_through_amount ?? "")}" placeholder="0,00">
                  </span>
                </label>
                <label class="field field-span-2 ${passThroughMethod === "percent" ? "" : "is-hidden"}" data-substrate-rule-field="percent">
                  <span>Percentual de repasse</span>
                  <span class="affix-field">
                    <input class="input" name="pass_through_percent" type="number" min="0" step="0.01" inputmode="decimal" value="${valueAttr(substrate?.pass_through_percent ?? "")}" placeholder="100">
                    <span class="field-affix" aria-hidden="true">%</span>
                  </span>
                </label>
                <label class="field field-span-2 ${passThroughMethod === "allocated" ? "" : "is-hidden"}" data-substrate-rule-field="allocated">
                  <span>Quantidade estimada para rateio</span>
                  <input class="input" name="allocation_quantity" type="number" min="0" step="0.01" inputmode="decimal" value="${valueAttr(substrate?.allocation_quantity ?? "")}" placeholder="10">
                </label>
              </div>
            </section>
            <section class="crm-form-section">
              <span class="eyebrow">Controle</span>
              <div class="crm-form-grid">
                <label class="field field-span-2">
                  <span>Status</span>
                  <select class="select" name="status">${selectOptions([["active", "Ativo"], ["inactive", "Inativo"]], substrate?.status || "active")}</select>
                </label>
              </div>
            </section>
          </div>
          ${renderCrmFormActions("substrates", substrate, "Criar substrato", "Salvar substrato")}
        </form>
      </div>`;
  }

  function renderServiceOrders() {
    const orders = filteredServiceOrders();

    renderCrmWorkspace("orders", {
      eyebrow: "Operação",
      title: "OS",
      subtitle: `${state.serviceOrders.length} OS cadastradas`,
      actions: `<button class="button button-primary" type="button" data-open-order-modal>+ Nova OS</button>`,
      body: `
        <section class="crm-panel-stack">
          <section class="panel data-panel">
            ${renderOrderToolbar(orders)}
            ${renderOrderTable(orders)}
          </section>
        </section>`,
    });
  }

  function renderOrderToolbar(orders) {
    const selectedCount = selectedOrderIds().filter((id) => orders.some((order) => order.id === id)).length;
    return `
      <div class="crm-toolbar order-toolbar">
        <label class="field compact-field">
          <span>Busca</span>
          <input class="input" type="search" placeholder="OS, cliente, projeto, orçamento ou escopo" value="${valueAttr(state.crmOrderSearch || "")}" data-order-search>
        </label>
        <label class="field compact-field">
          <span>Filtro</span>
          <select class="select" data-order-status-filter>${selectOptions([["all", "Todos"], ...ORDER_STATUSES], state.crmOrderStatus || "all")}</select>
        </label>
        <div class="toolbar-meta">
          <strong>${orders.length}</strong>
          <span>${orders.length === 1 ? "OS visível" : "OS visíveis"}</span>
        </div>
        <div class="toolbar-meta">
          <strong>${selectedCount}</strong>
          <span>${selectedCount === 1 ? "selecionada" : "selecionadas"}</span>
        </div>
        ${renderOrderToolbarActions(orders)}
      </div>`;
  }

  function renderOrderToolbarActions(orders) {
    const visibleSelected = selectedOrderIds().filter((id) => orders.some((order) => order.id === id));
    const selectedOrders = visibleSelected.map((id) => state.serviceOrders.find((order) => order.id === id)).filter(Boolean);
    const selectedCount = selectedOrders.length;
    const singleSelected = selectedCount === 1;
    const recurringSelected = singleSelected && selectedOrders[0].recurrence && selectedOrders[0].recurrence !== "one_time";

    return `
      <div class="crm-toolbar-actions" aria-label="Ações de OS">
        <button class="button button-secondary" type="button" data-duplicate-order ${selectedCount ? "" : "disabled"}>Duplicar</button>
        <button class="button button-secondary" type="button" data-export-order-pdf ${selectedCount ? "" : "disabled"}>Exportar PDF</button>
        <button class="button button-secondary" type="button" data-generate-recurring-orders="${escapeHtml(selectedOrders[0]?.id || "")}" ${recurringSelected ? "" : "disabled"}>Gerar ciclo</button>
      </div>`;
  }

  function openServiceOrderModal(id = "") {
    const order = state.serviceOrders.find((item) => item.id === id) || null;
    state.crmEdit = order ? { table: "service_orders", id: order.id } : null;
    state.modal = renderServiceOrderModal(order);
    clearNotice();
    render();
  }

  function renderServiceOrderModal(order) {
    const clientOptions = state.clients.map((client) => [client.id, client.name]);
    const projectOptions = state.projects.map((project) => [project.id, project.name]);
    const budgetOptions = state.budgets.map((budget) => [budget.id, `${budgetNumberLabel(budget)} · ${budget.title}`]);

    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${order ? "Editar OS" : "Nova OS"}">
        <form class="modal modal-wide form-stack crm-editor-form" data-order-form ${crmFormAttrs("service_orders")}>
          <div class="modal-header">
            <div>
              <span class="eyebrow">Ordem de serviço</span>
              <h2>${order ? "Editar OS" : "Nova OS"}</h2>
            </div>
            <button class="icon-button" type="button" data-close-modal>Fechar</button>
          </div>
          <div class="crm-form-grid">
            <label class="field field-span-2">
              <span>Título</span>
              <input class="input" name="title" value="${valueAttr(order?.title)}" required>
            </label>
            <label class="field">
              <span>Cliente</span>
              <select class="select" name="client_id">${selectOptions(clientOptions, order?.client_id || "", "Sem cliente")}</select>
            </label>
            <label class="field">
              <span>Projeto</span>
              <select class="select" name="project_id">${selectOptions(projectOptions, order?.project_id || "", "Sem projeto")}</select>
            </label>
            <label class="field">
              <span>Orçamento</span>
              <select class="select" name="budget_id">${selectOptions(budgetOptions, order?.budget_id || "", "Sem orçamento")}</select>
            </label>
            <label class="field">
              <span>Status</span>
              <select class="select" name="status">${selectOptions(ORDER_STATUSES, order?.status || "open")}</select>
            </label>
            <label class="field">
              <span>Recorrência</span>
              <select class="select" name="recurrence">${selectOptions(ORDER_RECURRENCES, order?.recurrence || "one_time")}</select>
            </label>
            <label class="field">
              <span>Ciclo de cobrança</span>
              <input class="input" name="billing_cycle" value="${valueAttr(order?.billing_cycle)}" placeholder="Ex: mensal, quinzenal, sob demanda">
            </label>
            <label class="field">
              <span>Início</span>
              <input class="input" name="starts_at" type="date" value="${valueAttr(dateInputValue(order?.starts_at))}">
            </label>
            <label class="field">
              <span>Prazo</span>
              <input class="input" name="due_at" type="date" value="${valueAttr(dateInputValue(order?.due_at))}">
            </label>
            <label class="field">
              <span>Horas previstas</span>
              <input class="input" name="estimated_hours" type="number" min="0" step="0.25" value="${valueAttr(order?.estimated_hours ?? "")}">
            </label>
            <label class="field">
              <span>Valor/hora</span>
              <input class="input" name="hourly_rate" type="number" min="0" step="0.01" value="${valueAttr(order?.hourly_rate ?? "")}" placeholder="0.00">
            </label>
            <label class="field field-span-4">
              <span>Escopo</span>
              <textarea class="textarea textarea-small" name="scope">${escapeHtml(scopeText(order?.scope))}</textarea>
            </label>
          </div>
          ${renderCrmFormActions("service_orders", order, "Criar OS", "Salvar OS")}
        </form>
      </div>`;
  }

  function exportSelectedBudgetPdf(id = "") {
    const budgets = selectedBudgetsForAction(id);
    if (!budgets.length) {
      setNotice("error", "Selecione um orçamento para exportar.");
      renderBudgets();
      return;
    }
    state.crmPdfExport = { type: "budgets", ids: budgets.map((budget) => budget.id) };
    state.modal = renderBudgetPdfModal(budgets);
    render();
  }

  function renderBudgetPdfModal(budgets) {
    const firstBudget = budgets[0];
    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Preview do orçamento">
        <div class="modal modal-preview">
          <div class="modal-header no-print">
            <div>
              <span class="eyebrow">Preview PDF</span>
              <h2>${budgets.length === 1 ? `Orçamento ${escapeHtml(budgetNumberLabel(firstBudget))}` : `${budgets.length} orçamentos selecionados`}</h2>
            </div>
            <div class="modal-actions">
              <button class="button button-secondary" type="button" data-download-proposal-pdf>Baixar PDF</button>
              <button class="button button-secondary" type="button" data-print-budget-pdf>Imprimir</button>
              <button class="icon-button" type="button" data-close-modal>Fechar</button>
            </div>
          </div>
          <div class="proposal-stack">
            ${budgets.map(renderBudgetProposalSheet).join("")}
          </div>
        </div>
      </div>`;
  }

  function renderBudgetProposalSheet(budget) {
    const payload = budgetPayload(budget);
    const contact = budgetContactRecord(budget);
    const client = state.clients.find((item) => item.id === budget.client_id);
    const items = budgetPreviewItems(budget);
    const validUntil = budget.valid_until ? formatDate(budget.valid_until) : "-";

    return `
          <article class="proposal-sheet" aria-label="Documento do orçamento">
            <header class="proposal-header">
              <div class="proposal-brand">
                <strong>RAKSA</strong>
                <span>Design, estratégia e tecnologia</span>
              </div>
              <dl>
                <div><dt>Criado em</dt><dd>${formatDate(budget.created_at)}</dd></div>
                <div><dt>Orçamento nº</dt><dd>${escapeHtml(budgetNumberLabel(budget))}</dd></div>
                <div><dt>Válido até</dt><dd>${escapeHtml(validUntil)}</dd></div>
              </dl>
            </header>
            <h1>Orçamento</h1>
            <section class="proposal-grid">
              <div>
                <strong>Cliente</strong>
                <span>${escapeHtml(client?.name || "-")}</span>
              </div>
              <div>
                <strong>Contato</strong>
                <span>${escapeHtml(contact?.name || payload.contact || "-")}</span>
              </div>
              <div>
                <strong>E-mail</strong>
                <span>${escapeHtml(contact?.email || payload.contactEmail || client?.email || "-")}</span>
              </div>
              <div>
                <strong>Criado por</strong>
                <span>${escapeHtml(payload.salesOwner || "-")}</span>
              </div>
              <div>
                <strong>Produto</strong>
                <span>${escapeHtml(payload.productName || payload.serviceType || budget.title || "-")}</span>
              </div>
              <div>
                <strong>Custos padrão</strong>
                <span>${escapeHtml(Array.isArray(payload.includedSubstrates) && payload.includedSubstrates.length ? payload.includedSubstrates.map((item) => item.name).join(", ") : "-")}</span>
              </div>
            </section>
            <table class="proposal-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Qtd</th>
                  <th>Preço unit.</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item) => `
                  <tr>
                    <td>${escapeHtml(item.code)}</td>
                    <td>${escapeHtml(item.description)}</td>
                    <td>${escapeHtml(item.quantity)}</td>
                    <td>${formatCurrency(item.unitPrice)}</td>
                    <td>${formatCurrency(item.total)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <section class="proposal-summary">
              <dl>
                <div><dt>Subtotal</dt><dd>${formatCurrency(budget.subtotal)}</dd></div>
                <div><dt>Desconto</dt><dd>${budgetDiscountLabel(budget)}</dd></div>
                <div><dt>Impostos</dt><dd>${formatCurrency(budget.tax)}</dd></div>
                <div><dt>Total final</dt><dd>${formatCurrency(budget.total)}</dd></div>
              </dl>
            </section>
            <section class="proposal-notes">
              <strong>Observações</strong>
              <p>${escapeHtml(payload.summary || payload.productionNotes || "Proposta válida conforme escopo descrito.")}</p>
              ${payload.paymentTerms ? `<p><strong>Pagamento:</strong> ${escapeHtml(payload.paymentTerms)}</p>` : ""}
              ${payload.deliveryTerms ? `<p><strong>Entrega:</strong> ${escapeHtml(budgetDeliveryLabel(payload.deliveryTerms))}</p>` : ""}
            </section>
          </article>`;
  }

  function exportServiceOrderPdf(id = "") {
    const orders = selectedServiceOrdersForAction(id);
    if (!orders.length) {
      setNotice("error", "Selecione uma OS para exportar.");
      renderServiceOrders();
      return;
    }
    state.crmPdfExport = { type: "orders", ids: orders.map((order) => order.id) };
    state.modal = renderServiceOrderPdfModal(orders);
    render();
  }

  function renderServiceOrderPdfModal(orders) {
    const firstOrder = orders[0];
    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Preview da OS">
        <div class="modal modal-preview">
          <div class="modal-header no-print">
            <div>
              <span class="eyebrow">Preview PDF</span>
              <h2>${orders.length === 1 ? escapeHtml(firstOrder.title) : `${orders.length} OS selecionadas`}</h2>
            </div>
            <div class="modal-actions">
              <button class="button button-secondary" type="button" data-download-proposal-pdf>Baixar PDF</button>
              <button class="button button-secondary" type="button" data-print-budget-pdf>Imprimir</button>
              <button class="icon-button" type="button" data-close-modal>Fechar</button>
            </div>
          </div>
          <div class="proposal-stack">
            ${orders.map(renderServiceOrderProposalSheet).join("")}
          </div>
        </div>
      </div>`;
  }

  function renderServiceOrderProposalSheet(order) {
    const budget = state.budgets.find((item) => item.id === order.budget_id);
    const client = state.clients.find((item) => item.id === order.client_id);
    const scope = scopeText(order.scope) || "Escopo não informado.";

    return `
          <article class="proposal-sheet" aria-label="Documento da OS">
            <header class="proposal-header">
              <div class="proposal-brand">
                <strong>RAKSA</strong>
                <span>Ordem de serviço</span>
              </div>
              <dl>
                <div><dt>Criado em</dt><dd>${formatDate(order.created_at)}</dd></div>
                <div><dt>Status</dt><dd>${escapeHtml(labelFromOptions(ORDER_STATUSES, order.status))}</dd></div>
                <div><dt>Prazo</dt><dd>${formatDate(order.due_at)}</dd></div>
              </dl>
            </header>
            <h1>Ordem de serviço</h1>
            <section class="proposal-grid">
              <div>
                <strong>Cliente</strong>
                <span>${escapeHtml(client?.name || "-")}</span>
              </div>
              <div>
                <strong>Projeto</strong>
                <span>${escapeHtml(entityName(state.projects, order.project_id))}</span>
              </div>
              <div>
                <strong>Orçamento</strong>
                <span>${escapeHtml(budget ? budgetNumberLabel(budget) : "-")}</span>
              </div>
              <div>
                <strong>Título</strong>
                <span>${escapeHtml(order.title)}</span>
              </div>
              <div>
                <strong>Ciclo</strong>
                <span>${escapeHtml(orderBillingLine(order))}</span>
              </div>
              <div>
                <strong>Valor previsto</strong>
                <span>${escapeHtml(Number(order.estimated_hours || 0) && Number(order.hourly_rate || 0) ? formatCurrency(Number(order.estimated_hours || 0) * Number(order.hourly_rate || 0)) : "-")}</span>
              </div>
            </section>
            <section class="proposal-notes proposal-scope">
              <strong>Escopo</strong>
              ${scope.split(/\r?\n/).filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
            </section>
          </article>`;
  }

  async function downloadActivePdf() {
    if (!state.crmPdfExport) {
      setNotice("error", "Abra um preview antes de baixar o PDF.");
      render();
      return;
    }

    try {
      const { jsPDF } = await import("https://esm.sh/jspdf@2.5.1");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      if (state.crmPdfExport.type === "budgets") {
        const budgets = state.crmPdfExport.ids
          .map((id) => state.budgets.find((budget) => budget.id === id))
          .filter(Boolean);
        budgets.forEach((budget, index) => {
          if (index) doc.addPage();
          drawBudgetPdfPage(doc, budget);
        });
        doc.save(budgets.length === 1 ? `orcamento-${budgetNumberLabel(budgets[0])}.pdf` : `orcamentos-raksa-${new Date().toISOString().slice(0, 10)}.pdf`);
      } else {
        const orders = state.crmPdfExport.ids
          .map((id) => state.serviceOrders.find((order) => order.id === id))
          .filter(Boolean);
        if (!orders.length) throw new Error("OS não encontrada.");
        orders.forEach((order, index) => {
          if (index) doc.addPage();
          drawOrderPdfPage(doc, order);
        });
        doc.save(orders.length === 1 ? `os-${slugSafe(orders[0].title || "raksa")}.pdf` : `ordens-servico-raksa-${new Date().toISOString().slice(0, 10)}.pdf`);
      }
    } catch (error) {
      setNotice("error", error.message || "Não foi possível gerar o PDF agora.");
      render();
    }
  }

  function drawBudgetPdfPage(doc, budget) {
    const payload = budgetPayload(budget);
    const contact = budgetContactRecord(budget);
    const client = state.clients.find((item) => item.id === budget.client_id);
    let y = drawPdfHeader(doc, "Orçamento", [
      ["Criado em", formatDate(budget.created_at)],
      ["Orçamento nº", budgetNumberLabel(budget)],
      ["Válido até", budget.valid_until ? formatDate(budget.valid_until) : "-"],
    ]);
    y = drawPdfKeyValues(doc, y, [
      ["Cliente", client?.name || "-"],
      ["Contato", contact?.name || payload.contact || "-"],
      ["E-mail", contact?.email || payload.contactEmail || client?.billing_email || client?.email || "-"],
      ["Criado por", payload.salesOwner || "-"],
      ["Produto", payload.productName || payload.serviceType || budget.title || "-"],
      ["Custos padrão", Array.isArray(payload.includedSubstrates) && payload.includedSubstrates.length ? payload.includedSubstrates.map((item) => item.name).join(", ") : "-"],
    ]);
    y = drawPdfTable(doc, y + 16, ["Código", "Descrição", "Qtd", "Preço unit.", "Total"], budgetPreviewItems(budget).map((item) => [
      item.code,
      item.description,
      item.quantity,
      formatCurrency(item.unitPrice),
      formatCurrency(item.total),
    ]));
    y = drawPdfTotals(doc, y + 14, [
      ["Subtotal", formatCurrency(budget.subtotal)],
      ["Desconto", budgetDiscountLabel(budget)],
      ["Impostos", formatCurrency(budget.tax)],
      ["Total final", formatCurrency(budget.total)],
    ]);
    drawPdfNotes(doc, y + 18, "Observações", [
      payload.summary || payload.productionNotes || "Proposta válida conforme escopo descrito.",
      payload.paymentTerms ? `Pagamento: ${payload.paymentTerms}` : "",
      payload.deliveryTerms ? `Entrega: ${budgetDeliveryLabel(payload.deliveryTerms)}` : "",
    ].filter(Boolean));
  }

  function drawOrderPdfPage(doc, order) {
    const budget = state.budgets.find((item) => item.id === order.budget_id);
    const client = state.clients.find((item) => item.id === order.client_id);
    let y = drawPdfHeader(doc, "Ordem de serviço", [
      ["Criado em", formatDate(order.created_at)],
      ["Status", labelFromOptions(ORDER_STATUSES, order.status)],
      ["Prazo", formatDate(order.due_at)],
    ]);
    y = drawPdfKeyValues(doc, y, [
      ["Cliente", client?.name || "-"],
      ["Projeto", entityName(state.projects, order.project_id)],
      ["Orçamento", budget ? budgetNumberLabel(budget) : "-"],
      ["Título", order.title],
      ["Ciclo", orderBillingLine(order)],
      ["Valor previsto", Number(order.estimated_hours || 0) && Number(order.hourly_rate || 0) ? formatCurrency(Number(order.estimated_hours || 0) * Number(order.hourly_rate || 0)) : "-"],
    ]);
    drawPdfNotes(doc, y + 18, "Escopo", (scopeText(order.scope) || "Escopo não informado.").split(/\r?\n/).filter(Boolean));
  }

  function drawPdfHeader(doc, title, meta) {
    doc.setTextColor(17, 17, 17);
    doc.setDrawColor(17, 17, 17);
    doc.setLineWidth(1);
    doc.rect(32, 32, 530, 92);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("RAKSA", 48, 72);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Design, estratégia e tecnologia", 48, 90);
    meta.forEach(([label, value], index) => {
      const y = 48 + index * 24;
      doc.line(430, 32 + index * 31, 430, 124);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(label, 442, y);
      doc.setFontSize(10);
      doc.text(String(value || "-"), 442, y + 13);
    });
    doc.setFontSize(24);
    doc.text(title, 297, 158, { align: "center" });
    return 180;
  }

  function drawPdfKeyValues(doc, y, pairs) {
    doc.setFontSize(9);
    doc.setDrawColor(17, 17, 17);
    pairs.forEach(([label, value], index) => {
      const x = index % 2 === 0 ? 32 : 297;
      const rowY = y + Math.floor(index / 2) * 42;
      doc.rect(x, rowY, 265, 42);
      doc.setFont("helvetica", "bold");
      doc.text(label, x + 8, rowY + 14);
      doc.setFont("helvetica", "normal");
      drawWrappedPdfText(doc, String(value || "-"), x + 8, rowY + 29, 248, 10);
    });
    return y + Math.ceil(pairs.length / 2) * 42;
  }

  function drawPdfTable(doc, y, headers, rows) {
    const widths = [58, 242, 42, 86, 86];
    let x = 32;
    const drawHeader = (headerY) => {
      x = 32;
      doc.setFillColor(17, 17, 17);
      doc.rect(32, headerY, 530, 24, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      headers.forEach((header, index) => {
        doc.text(header, x + 6, headerY + 15);
        x += widths[index];
      });
      doc.setTextColor(17, 17, 17);
      doc.setFont("helvetica", "normal");
      return headerY + 24;
    };
    let rowY = drawHeader(y);
    rows.forEach((row) => {
      const rowHeight = 34;
      if (rowY + rowHeight > 760) {
        doc.addPage();
        rowY = drawHeader(40);
      }
      x = 32;
      row.forEach((value, index) => {
        doc.rect(x, rowY, widths[index], rowHeight);
        drawWrappedPdfText(doc, String(value || "-"), x + 6, rowY + 14, widths[index] - 12, 9);
        x += widths[index];
      });
      rowY += rowHeight;
    });
    return rowY;
  }

  function drawPdfTotals(doc, y, rows) {
    if (y + rows.length * 24 > 760) {
      doc.addPage();
      y = 40;
    }
    const x = 342;
    rows.forEach(([label, value], index) => {
      const rowY = y + index * 24;
      doc.rect(x, rowY, 110, 24);
      doc.rect(x + 110, rowY, 110, 24);
      doc.setFont("helvetica", "normal");
      doc.text(label, x + 8, rowY + 15);
      doc.setFont("helvetica", "bold");
      doc.text(value, x + 212, rowY + 15, { align: "right" });
    });
    return y + rows.length * 24;
  }

  function drawPdfNotes(doc, y, title, lines) {
    if (y + 120 > 780) {
      doc.addPage();
      y = 40;
    }
    doc.rect(32, y, 530, 120);
    doc.setFillColor(17, 17, 17);
    doc.rect(32, y, 530, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(title, 40, y + 14);
    doc.setTextColor(17, 17, 17);
    doc.setFont("helvetica", "normal");
    let cursor = y + 38;
    lines.forEach((line) => {
      cursor = drawWrappedPdfText(doc, line, 40, cursor, 514, 11) + 8;
    });
  }

  function drawWrappedPdfText(doc, text, x, y, width, lineHeight) {
    const lines = doc.splitTextToSize(String(text || "-"), width);
    doc.text(lines, x, y);
    return y + Math.max(0, lines.length - 1) * lineHeight;
  }

  function slugSafe(value) {
    return String(value || "raksa").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "raksa";
  }

  function crmDeleteRecordName(table, id) {
    const records = crmItems(table);
    const record = records.find((item) => item.id === id);
    if (!record) return "este registro";
    if (table === "budgets") return `orçamento ${budgetNumberLabel(record)}`;
    if (table === "service_orders") return `OS ${record.title || record.id}`;
    return record.name || record.title || record.email || "este registro";
  }

  function crmDeleteTableLabel(table) {
    const labels = {
      budgets: "Orçamento",
      clients: "Cliente",
      contacts: "Contato",
      products: "Produto",
      projects: "Projeto",
      service_orders: "OS",
      substrates: "Substrato",
      time_entries: "Horas",
    };
    return labels[table] || "Registro";
  }

  function openDeleteCrmModal(table, id) {
    if (!CRM_STATE_KEYS[table] || !id) return;
    const title = crmDeleteTableLabel(table);
    const name = crmDeleteRecordName(table, id);
    state.modal = `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirmar exclusão">
        <div class="modal form-stack">
          <div class="modal-header">
            <div>
              <span class="eyebrow">Excluir</span>
              <h2>Excluir ${escapeHtml(title)}</h2>
            </div>
            <button class="icon-button" type="button" data-close-modal>Fechar</button>
          </div>
          <p class="section-subtitle">Tem certeza que deseja excluir ${escapeHtml(name)}? Essa ação não pode ser desfeita.</p>
          <div class="form-actions">
            <button class="button button-danger" type="button" data-confirm-delete-crm="${escapeHtml(table)}:${escapeHtml(id)}">Excluir</button>
            <button class="button button-secondary" type="button" data-close-modal>Cancelar</button>
          </div>
        </div>
      </div>`;
    render();
  }

  function renderLegacyServiceOrders() {
    const editingOrder = crmEditRecord("service_orders");
    const clientOptions = state.clients.map((client) => [client.id, client.name]);
    const projectOptions = state.projects.map((project) => [project.id, project.name]);
    const budgetOptions = state.budgets.map((budget) => [budget.id, budget.title]);

    renderCrmWorkspace("orders", {
      eyebrow: "Ordens de serviço",
      title: "OS",
      subtitle: `${state.serviceOrders.length} OS cadastradas`,
      body: `
        <section class="crm-panel-stack">
          <form class="panel form-stack crm-editor-form" data-order-form ${crmFormAttrs("service_orders")}>
            <div class="page-title">
              <h2>${editingOrder ? "Editar OS" : "Nova OS"}</h2>
              <p class="section-subtitle">${editingOrder ? "Atualize vínculos, status, prazo e escopo." : "Transforme proposta em trabalho executável."}</p>
            </div>
            <div class="crm-form-grid">
              <label class="field field-span-2">
                <span>Título</span>
                <input class="input" name="title" value="${valueAttr(editingOrder?.title)}" required>
              </label>
              <label class="field">
                <span>Cliente</span>
                <select class="select" name="client_id">${selectOptions(clientOptions, editingOrder?.client_id || "", "Sem cliente")}</select>
              </label>
              <label class="field">
                <span>Projeto</span>
                <select class="select" name="project_id">${selectOptions(projectOptions, editingOrder?.project_id || "", "Sem projeto")}</select>
              </label>
              <label class="field">
                <span>Orçamento</span>
                <select class="select" name="budget_id">${selectOptions(budgetOptions, editingOrder?.budget_id || "", "Sem orçamento")}</select>
              </label>
              <label class="field">
                <span>Status</span>
                <select class="select" name="status">${selectOptions(ORDER_STATUSES, editingOrder?.status || "open")}</select>
              </label>
              <label class="field">
                <span>Início</span>
                <input class="input" name="starts_at" type="date" value="${valueAttr(dateInputValue(editingOrder?.starts_at))}">
              </label>
              <label class="field">
                <span>Prazo</span>
                <input class="input" name="due_at" type="date" value="${valueAttr(dateInputValue(editingOrder?.due_at))}">
              </label>
              <label class="field field-span-4">
                <span>Escopo</span>
                <textarea class="textarea textarea-small" name="scope">${escapeHtml(scopeText(editingOrder?.scope))}</textarea>
              </label>
            </div>
            ${renderCrmFormActions("service_orders", editingOrder, "Criar OS", "Salvar OS")}
          </form>

          <section class="panel data-panel">
            <div class="page-title">
              <h2>Ordens de serviço</h2>
              <p class="section-subtitle">Base para controle de horas e entregas.</p>
            </div>
            ${renderOrderTable()}
          </section>
        </section>`,
    });
  }

  function renderOrderTable(orders = filteredServiceOrders()) {
    if (!orders.length) return `<div class="empty-state">Nenhuma OS cadastrada.</div>`;
    const visibleIds = orders.map((order) => order.id);
    const selectedIds = selectedOrderIds();
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th class="select-column">
                <input type="checkbox" aria-label="Selecionar OS visíveis" data-select-all-orders ${allVisibleSelected ? "checked" : ""}>
              </th>
              <th>OS</th>
              <th>Orçamento</th>
              <th>Cliente</th>
              <th>Projeto</th>
              <th>Status</th>
              <th>Ciclo</th>
              <th>Prazo</th>
              <th>Valor previsto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${orders.map((order) => {
              const selected = selectedIds.includes(order.id);
              const orderTotal = Number(order.estimated_hours || 0) && Number(order.hourly_rate || 0)
                ? formatCurrency(Number(order.estimated_hours || 0) * Number(order.hourly_rate || 0))
                : "-";
              return `
                <tr class="${selected ? "is-selected" : ""}">
                  <td class="select-column">
                    <input type="checkbox" value="${escapeHtml(order.id)}" aria-label="Selecionar OS ${escapeHtml(order.title)}" data-select-order ${selected ? "checked" : ""}>
                  </td>
                  <td>
                    <strong>${escapeHtml(order.title)}</strong>
                    <span>${escapeHtml(scopeText(order.scope).slice(0, 96))}</span>
                  </td>
                  <td>${escapeHtml(orderBudgetLabel(order))}</td>
                  <td>${escapeHtml(entityName(state.clients, order.client_id))}</td>
                  <td>${escapeHtml(entityName(state.projects, order.project_id))}</td>
                  <td><span class="status-pill">${escapeHtml(labelFromOptions(ORDER_STATUSES, order.status))}</span></td>
                  <td>${escapeHtml(orderBillingLine(order))}</td>
                  <td>${formatDate(order.due_at)}</td>
                  <td><strong>${escapeHtml(orderTotal)}</strong></td>
                  <td>
                    <div class="row-actions">
                      <button class="icon-button" type="button" data-open-order-modal="${escapeHtml(order.id)}">Editar</button>
                      <button class="icon-button" type="button" data-export-order-pdf="${escapeHtml(order.id)}">PDF</button>
                      ${order.recurrence && order.recurrence !== "one_time" ? `<button class="icon-button" type="button" data-generate-recurring-orders="${escapeHtml(order.id)}">Gerar ciclo</button>` : ""}
                      <button class="icon-button" type="button" data-delete-crm="service_orders:${escapeHtml(order.id)}">Excluir</button>
                    </div>
                  </td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderTimeEntries() {
    const editingEntry = crmEditRecord("time_entries");
    const projectOptions = state.projects.map((project) => [project.id, project.name]);
    const orderOptions = state.serviceOrders.map((order) => [order.id, order.title]);
    const totalHours = state.timeEntries.reduce((sum, entry) => sum + hoursFromEntry(entry), 0);
    const billableHours = state.timeEntries.filter((entry) => entry.billable).reduce((sum, entry) => sum + hoursFromEntry(entry), 0);
    const billableTotal = state.timeEntries.filter((entry) => entry.billable).reduce((sum, entry) => sum + billableAmount(entry), 0);

    renderCrmWorkspace("time", {
      eyebrow: "Horas",
      title: "Controle de horas",
      subtitle: `${state.timeEntries.length} lançamentos recentes`,
      metrics: `
        <section class="metrics crm-metrics" aria-label="Resumo de horas">
          <div class="metric">
            <strong>${formatDecimalHours(totalHours)}</strong>
            <span>Total lançado</span>
          </div>
          <div class="metric">
            <strong>${formatDecimalHours(billableHours)}</strong>
            <span>Faturável</span>
          </div>
          <div class="metric">
            <strong>${formatCurrency(billableTotal)}</strong>
            <span>Valor faturável</span>
          </div>
        </section>`,
      body: `
        <section class="crm-panel-stack">
          <form class="panel form-stack crm-editor-form" data-time-form ${crmFormAttrs("time_entries")}>
            <div class="page-title">
              <h2>${editingEntry ? "Editar lançamento" : "Novo lançamento"}</h2>
              <p class="section-subtitle">${editingEntry ? "Atualize projeto, data, horas e valor/hora." : "Registre horas por projeto e OS."}</p>
            </div>

            <div class="crm-form-grid">
              <label class="field field-span-2">
                <span>Projeto</span>
                <select class="select" name="project_id" required>${selectOptions(projectOptions, editingEntry?.project_id || "", "Selecione")}</select>
              </label>
              <label class="field">
                <span>OS</span>
                <select class="select" name="service_order_id">${selectOptions(orderOptions, editingEntry?.service_order_id || "", "Sem OS")}</select>
              </label>
              <label class="field">
                <span>Data</span>
                <input class="input" name="work_date" type="date" value="${valueAttr(dateInputValue(editingEntry?.work_date) || new Date().toISOString().slice(0, 10))}" required>
              </label>
              <label class="field">
                <span>Horas</span>
                <input class="input" name="hours" type="number" min="0.25" step="0.25" value="${valueAttr(hoursInputValue(editingEntry))}" required>
              </label>
              <label class="field">
                <span>Valor/hora</span>
                <input class="input" name="hourly_rate" type="number" min="0" step="0.01" placeholder="0.00" value="${valueAttr(editingEntry?.hourly_rate ?? "")}">
              </label>
              <label class="toggle-row field-span-2">
                <input type="checkbox" name="billable" ${editingEntry?.billable === false ? "" : "checked"}>
                <span>Faturável</span>
              </label>
              <label class="field field-span-4">
                <span>Descrição</span>
                <textarea class="textarea textarea-small" name="description">${escapeHtml(editingEntry?.description || "")}</textarea>
              </label>
            </div>
            ${renderCrmFormActions("time_entries", editingEntry, "Registrar horas", "Salvar lançamento")}
          </form>

          <section class="panel data-panel">
            <div class="page-title">
              <h2>Lançamentos</h2>
              <p class="section-subtitle">Últimos 300 registros.</p>
            </div>
            ${renderTimeTable()}
          </section>
        </section>`,
    });
  }

  function renderTimeTable() {
    if (!state.timeEntries.length) return `<div class="empty-state">Nenhuma hora registrada.</div>`;

    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Projeto</th>
              <th>Horas</th>
              <th>Valor/hora</th>
              <th>Total</th>
              <th>Descrição</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${state.timeEntries.map((entry) => `
              <tr>
                <td>${formatDate(entry.work_date)}</td>
                <td>${escapeHtml(entityName(state.projects, entry.project_id))}</td>
                <td>
                  <strong>${formatDecimalHours(hoursFromEntry(entry))}</strong>
                  <span>${entry.billable ? "Faturável" : "Interno"}</span>
                </td>
                <td>${formatCurrency(entry.hourly_rate || 0)}</td>
                <td>${formatCurrency(billableAmount(entry))}</td>
                <td>${escapeHtml(entry.description || "-")}</td>
                <td>
                  <div class="row-actions">
                    <button class="icon-button" type="button" data-edit-crm="time_entries:${escapeHtml(entry.id)}">Editar</button>
                    <button class="icon-button" type="button" data-delete-crm="time_entries:${escapeHtml(entry.id)}">Excluir</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;
  }

  async function createClient(form) {
    if (isSubmitting("clients")) return;
    const editing = crmEditRecord("clients");
    const data = new FormData(form);
    const errors = [];
    
    const postal_code = textFromForm(data, "postal_code");
    const street = textFromForm(data, "street");
    const number = textFromForm(data, "number");
    const complement = textFromForm(data, "complement");
    const neighborhood = textFromForm(data, "neighborhood");
    const city = textFromForm(data, "city");
    const stateVal = textFromForm(data, "state");
    const country = textFromForm(data, "country");
    
    // Assemble the full address string for backwards compatibility
    let address = "";
    if (street) {
      address = `${street}, ${number || "s/n"}`;
      if (complement) address += ` - ${complement}`;
      if (neighborhood) address += `, ${neighborhood}`;
      if (city) address += `, ${city} - ${stateVal || ""}`;
      if (postal_code) address += `, CEP ${postal_code}`;
      if (country && country !== "Brasil") address += ` · ${country}`;
    }

    const payload = {
      name: requiredTextFromForm(data, "name", "o nome do cliente", errors),
      type: String(data.get("type") || "company"),
      status: String(data.get("status") || "active"),
      document: optionalFormValue(data, "document"),
      email: optionalEmailFromForm(data, "email", "E-mail", errors),
      billing_email: optionalEmailFromForm(data, "billing_email", "E-mail de cobrança", errors),
      phone: optionalFormValue(data, "phone"),
      website: optionalUrlFromForm(data, "website", "Website", errors),
      referral_source: textFromForm(data, "referral_source"),
      commission_rate: boundedPercentFromForm(data, "commission_rate", "Comissão", errors),
      address: address || textFromForm(data, "address"),
      notes: String(data.get("notes") || "").trim(),
      
      state_registration: textFromForm(data, "state_registration"),
      municipal_registration: textFromForm(data, "municipal_registration"),
      postal_code,
      street,
      number,
      complement,
      neighborhood,
      city,
      state: stateVal,
      country,
      billing_postal_code: textFromForm(data, "billing_postal_code"),
      billing_street: textFromForm(data, "billing_street"),
      billing_number: textFromForm(data, "billing_number"),
      billing_complement: textFromForm(data, "billing_complement"),
      billing_neighborhood: textFromForm(data, "billing_neighborhood"),
      billing_city: textFromForm(data, "billing_city"),
      billing_state: textFromForm(data, "billing_state"),
      billing_country: textFromForm(data, "billing_country"),
      billing_same_as_commercial: data.get("billing_same_as_commercial") === "on",
    };
    if (!validateCrmPayload("clients", errors)) return;

    await submitCrmRecord("clients", payload, editing, editing ? "Cliente atualizado." : "Cliente cadastrado.");
  }

  async function createContact(form) {
    if (isSubmitting("contacts")) return;
    const editing = crmEditRecord("contacts");
    const data = new FormData(form);
    const errors = [];
    const payload = {
      client_id: optionalFormValue(data, "client_id"),
      name: requiredTextFromForm(data, "name", "o nome do contato", errors),
      role: optionalFormValue(data, "role"),
      email: optionalEmailFromForm(data, "email", "E-mail", errors),
      phone: optionalFormValue(data, "phone"),
      notes: textFromForm(data, "notes"),
    };
    if (!payload.client_id) errors.push("Selecione o cliente do contato.");
    if (!payload.email && !payload.phone) errors.push("Preencha e-mail ou telefone do contato.");
    if (!validateCrmPayload("contacts", errors)) return;

    await submitCrmRecord("contacts", payload, editing, editing ? "Contato atualizado." : "Contato cadastrado.");
  }

  async function createProduct(form) {
    if (isSubmitting("products")) return;
    const editing = crmEditRecord("products");
    const data = new FormData(form);
    const errors = [];
    const productSubstrateLinks = collectProductSubstrateLinks(form, errors);
    const financialSettings = budgetFinancialSettings();
    const hoursPerUnit = nonNegativeNumberFromForm(data, "hours_per_unit", "Horas padrão", errors);
    const payload = {
      name: requiredTextFromForm(data, "name", "o nome do produto", errors),
      category: textFromForm(data, "category"),
      description: textFromForm(data, "description"),
      base_price: nonNegativeNumberFromForm(data, "base_price", "Preço base", errors),
      estimated_hours: hoursPerUnit,
      production_unit: editing?.production_unit || "projeto",
      hours_per_unit: hoursPerUnit,
      default_quantity: 1,
      default_markup: Number(financialSettings.default_markup_percent || 0),
      pricing_model: editing?.pricing_model || "hourly",
      hourly_rate: Number(financialSettings.hourly_rate || 0),
      status: String(data.get("status") || "active"),
    };
    if (!PRODUCT_PRICING_MODELS.some(([value]) => value === payload.pricing_model)) errors.push("Modelo de preço inválido.");
    if (!validateCrmPayload("products", errors)) return;

    if (!supabase() || !isLoggedIn()) {
      blockSubmitWithNotice("products", "Supabase indisponível. Tente novamente em instantes.");
      return;
    }

    const noticeRoute = routeKey();
    state.crmSubmitting = "products";
    refreshSubmittingModal("products", editing);
    renderProducts();

    let error = null;
    try {
      const result = editing
        ? await supabase().from("products").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editing.id).select("id").single()
        : await supabase().from("products").insert(payload).select("id").single();
      error = result.error;

      const productId = result.data?.id || editing?.id;
      if (!error && productId) {
        const linkResult = await saveProductSubstrateLinks(productId, productSubstrateLinks);
        error = linkResult.error;
      }
    } catch (caught) {
      error = caught;
    }

    await afterCrmMutation(error, editing ? "Produto atualizado." : "Produto cadastrado.", noticeRoute, "products", editing);
  }

  async function createSubstrate(form) {
    if (isSubmitting("substrates")) return;
    const editing = crmEditRecord("substrates");
    const data = new FormData(form);
    const errors = [];
    const costAmount = nonNegativeNumberFromForm(data, "cost_amount", "Custo", errors);
    const costUnit = editing?.cost_unit || editing?.unit || "unidade";
    const payload = {
      name: requiredTextFromForm(data, "name", "o nome do substrato", errors),
      kind: editing?.kind || "",
      acquisition_type: String(data.get("acquisition_type") || "unit_cost"),
      unit: costUnit,
      cost_unit: costUnit,
      unit_cost: costAmount,
      cost_amount: costAmount,
      pass_through_method: String(data.get("pass_through_method") || "none"),
      fixed_pass_through_amount: nonNegativeNumberFromForm(data, "fixed_pass_through_amount", "Valor fixo de repasse", errors),
      pass_through_percent: nonNegativeNumberFromForm(data, "pass_through_percent", "Percentual de repasse", errors),
      allocation_quantity: nonNegativeNumberFromForm(data, "allocation_quantity", "Quantidade estimada para rateio", errors),
      notes: editing?.notes || "",
      status: String(data.get("status") || "active"),
    };
    if (!SUBSTRATE_ACQUISITION_TYPES.some(([value]) => value === payload.acquisition_type)) errors.push("Tipo de custo inválido.");
    if (!SUBSTRATE_PASS_THROUGH_METHODS.some(([value]) => value === payload.pass_through_method)) errors.push("Repasse ao cliente inválido.");
    if (!validateCrmPayload("substrates", errors)) return;

    await submitCrmRecord("substrates", payload, editing, editing ? "Substrato atualizado." : "Substrato cadastrado.");
  }

  async function createProject(form) {
    if (isSubmitting("projects")) return;
    const editing = crmEditRecord("projects");
    const data = new FormData(form);
    const errors = [];
    const startsAt = optionalDateFromForm(data, "starts_at", "Início", errors);
    const dueAt = optionalDateFromForm(data, "due_at", "Prazo", errors);
    validateDateOrder(startsAt, dueAt, "Início", "Prazo", errors);
    const payload = {
      name: requiredTextFromForm(data, "name", "o nome do projeto", errors),
      client_id: optionalFormValue(data, "client_id"),
      case_id: optionalFormValue(data, "case_id"),
      status: String(data.get("status") || "lead"),
      starts_at: startsAt,
      due_at: dueAt,
      budget_total: nonNegativeNumberFromForm(data, "budget_total", "Valor previsto", errors),
      description: String(data.get("description") || "").trim(),
    };
    if (!validateCrmPayload("projects", errors)) return;

    await submitCrmRecord("projects", payload, editing, editing ? "Projeto atualizado." : "Projeto criado.");
  }

  async function createBudget(form) {
    if (isSubmitting("budgets")) return;
    if ((!state.financialSettingsLoaded || !state.financialSettings) && typeof loadFinancialSettings === "function") {
      const { error } = await loadFinancialSettings();
      if (error) {
        blockSubmitWithNotice("budgets", error.message || "Não foi possível carregar as configurações financeiras.");
        return;
      }
    }
    const editing = crmEditRecord("budgets");
    const data = new FormData(form);
    const errors = [];
    const lineItems = collectBudgetLineItems(form, errors);
    const firstLine = lineItems[0] || null;
    const selectedProduct = productRecord(firstLine?.productId || optionalFormValue(data, "product_id"));
    const selectedSubstrate = substrateRecord(firstLine?.substrateId || optionalFormValue(data, "substrate_id"));
    const quantity = firstLine?.quantity || optionalQuantityFromForm(data, errors) || 1;
    const discount = nonNegativeNumberFromForm(data, "discount", "Desconto", errors);
    if (discount > 100) errors.push("Desconto não pode ser maior que 100%.");
    const discountReason = optionalFormValue(data, "discount_reason");
    const discountReasonOther = textFromForm(data, "discount_reason_other");
    if (discount > 0 && !discountReason) errors.push("Selecione a justificativa do desconto.");
    if (discount > 0 && discountReason === "Outro" && !discountReasonOther) errors.push("Descreva a justificativa do desconto.");
    const paymentMethod = optionalFormValue(data, "payment_method");
    const paymentInstallments = paymentMethod === "Crédito parcelado" ? optionalFormValue(data, "payment_installments") : "";
    if (paymentMethod === "Crédito parcelado" && !paymentInstallments) errors.push("Selecione o número de parcelas.");
    const deliveryDate = optionalDateFromForm(data, "delivery_terms", "Entrega", errors);
    const pricingSnapshot = lineItems.length
      ? combineBudgetPricingSnapshots(lineItems.map((item) => item.pricingSnapshot).filter(Boolean))
      : selectedProduct
        ? calculateBudgetPricing(selectedProduct, quantity, selectedSubstrate)
        : emptyBudgetPricingSnapshot();
    const automaticPricingSubtotal = pricingSnapshot.subtotal + pricingSnapshot.markupAmount;
    const automaticSubtotal = lineItems.length
      ? lineItems.reduce((sum, item) => sum + Number(item.total || 0), 0) || automaticPricingSubtotal
      : selectedProduct ? automaticPricingSubtotal : 0;
    const subtotal = automaticSubtotal;
    const tax = pricingSnapshot.taxAmount;
    const grossTotal = roundMoney(subtotal + tax);
    const discountAmount = roundMoney(grossTotal * (discount / 100));
    const total = roundMoney(grossTotal - discountAmount);
    const itemsText = lineItems.length ? lineItems.map((item) => item.description || item.title).join("\n") : textFromForm(data, "items_text");
    const productNames = [...new Set(lineItems.map((item) => item.productName).filter(Boolean))];
    const previousPayload = budgetPayload(editing);
    const includedSubstrates = lineItems.length
      ? uniqueIncludedSubstrates(lineItems)
      : productPricingSubstrates(selectedProduct).map((entry) => ({
        id: entry.substrate.id,
        name: entry.substrate.name,
        cost: Number(entry.substrate.cost_amount ?? entry.substrate.unit_cost ?? 0),
        quantity: entry.quantity,
      }));
    const totalEstimatedHours = lineItems.length
      ? lineItems.reduce((sum, item) => sum + Number(item.estimatedHours || 0), 0)
      : pricingSnapshot.laborHours;
    if (total < 0) errors.push("Total do orçamento não pode ficar negativo.");
    const itemTitle = firstLine?.description || selectedProduct?.name || optionalFormValue(data, "service_type") || textFromForm(data, "title") || "Serviço";
    const payload = {
      title: requiredTextFromForm(data, "title", "o título do orçamento", errors),
      client_id: optionalFormValue(data, "client_id"),
      contact_id: optionalFormValue(data, "contact_id"),
      project_id: data.has("project_id") ? optionalFormValue(data, "project_id") : editing?.project_id || null,
      status: data.has("status") ? String(data.get("status") || "draft") : editing?.status || "draft",
      currency: "BRL",
      subtotal,
      discount,
      tax,
      total,
      ...budgetPricingSnapshotColumns(pricingSnapshot),
      valid_until: optionalDateFromForm(data, "valid_until", "Validade", errors) || defaultBudgetValidUntil(),
      resolved: data.has("resolved") ? data.get("resolved") === "on" : Boolean(editing?.resolved),
      created_by: editing?.created_by || state.session?.user?.id || null,
      created_by_email: editing?.created_by_email || state.session?.user?.email || "",
      payload: {
        ...previousPayload,
        contact: data.has("contact") ? optionalFormValue(data, "contact") : previousPayload.contact || "",
        salesOwner: data.has("sales_owner") ? optionalFormValue(data, "sales_owner") : previousPayload.salesOwner || "",
        agency: data.has("agency") ? optionalFormValue(data, "agency") : previousPayload.agency || "",
        budgetFor: optionalFormValue(data, "budget_for") || "Cliente",
        summary: data.has("summary") ? textFromForm(data, "summary") : previousPayload.summary || "",
        serviceType: data.has("service_type") ? optionalFormValue(data, "service_type") : previousPayload.serviceType || "",
        productId: selectedProduct?.id || optionalFormValue(data, "product_id"),
        productName: productNames.length > 1 ? `${productNames.length} produtos` : selectedProduct?.name || productNames[0] || null,
        productPricingModel: selectedProduct?.pricing_model || null,
        productBaseAmount: pricingSnapshot.laborCost,
        productEstimatedHours: totalEstimatedHours,
        productHourlyRate: pricingSnapshot.hourlyRate,
        productMarkup: pricingSnapshot.markupPercent,
        substrateId: selectedSubstrate?.id || optionalFormValue(data, "substrate_id"),
        substrateName: selectedSubstrate?.name || firstLine?.substrateName || null,
        includedSubstrates,
        additionalSubstrateCost: lineItems.length
          ? lineItems.reduce((sum, item) => sum + Number(item.additionalSubstrateCost || 0), 0)
          : selectedSubstrate ? calculateBudgetPricing(null, 0, selectedSubstrate).substrateCost : 0,
        pricingSnapshot,
        grossTotal,
        discountPercent: discount,
        discountAmount,
        discountReason: discount > 0 ? discountReason : "",
        discountReasonOther: discount > 0 && discountReason === "Outro" ? discountReasonOther : "",
        finalTotal: total,
        quantity,
        itemsText,
        lineItems,
        items: lineItems.length ? lineItems : itemsText ? budgetItemsFromText(itemsText, subtotal) : [{
          position: 1,
          text: itemTitle,
          title: itemTitle,
          quantity,
          unitPrice: quantity ? subtotal / quantity : subtotal,
          total: subtotal,
        }],
        paymentTerms: paymentMethod,
        paymentMethod,
        paymentInstallments,
        deliveryTerms: deliveryDate || previousPayload.deliveryTerms || "",
        productionNotes: data.has("production_notes") ? textFromForm(data, "production_notes") : previousPayload.productionNotes || "",
        createdByEmail: editing?.created_by_email || state.session?.user?.email || previousPayload.createdByEmail || "",
        internalNotes: data.has("internal_notes") ? textFromForm(data, "internal_notes") : previousPayload.internalNotes || "",
        updatedFromAdminAt: new Date().toISOString(),
      },
    };
    if (!validateCrmPayload("budgets", errors)) return;

    await submitCrmRecord("budgets", payload, editing, editing ? "Orçamento atualizado." : "Orçamento criado.");
  }

  async function createServiceOrder(form) {
    if (isSubmitting("service_orders")) return;
    const editing = crmEditRecord("service_orders");
    const data = new FormData(form);
    const errors = [];
    const scopeValue = String(data.get("scope") || "").trim();
    const previousScopeText = scopeText(editing?.scope);
    const startsAt = optionalDateFromForm(data, "starts_at", "Início", errors);
    const dueAt = optionalDateFromForm(data, "due_at", "Prazo", errors);
    validateDateOrder(startsAt, dueAt, "Início", "Prazo", errors);
    const recurrence = optionalFormValue(data, "recurrence") || "one_time";
    const payload = {
      title: requiredTextFromForm(data, "title", "o título da OS", errors),
      client_id: optionalFormValue(data, "client_id"),
      project_id: optionalFormValue(data, "project_id"),
      budget_id: optionalFormValue(data, "budget_id"),
      status: String(data.get("status") || "open"),
      starts_at: startsAt,
      due_at: dueAt,
      recurrence,
      billing_cycle: textFromForm(data, "billing_cycle"),
      estimated_hours: nonNegativeNumberFromForm(data, "estimated_hours", "Horas previstas", errors),
      hourly_rate: nonNegativeNumberFromForm(data, "hourly_rate", "Valor/hora", errors),
      scope: scopeValue ? (editing?.scope && scopeValue === previousScopeText ? editing.scope : { text: scopeValue }) : {},
    };
    if (!ORDER_RECURRENCES.some(([value]) => value === recurrence)) errors.push("Recorrência inválida.");
    if (!validateCrmPayload("service_orders", errors)) return;

    await submitCrmRecord("service_orders", payload, editing, editing ? "OS atualizada." : "OS criada.");
  }

  async function duplicateSelectedBudget() {
    if (!supabase() || !isLoggedIn() || isSubmitting("budgets")) return;
    const budgets = selectedBudgetsForAction();
    if (!budgets.length) {
      setNotice("error", "Selecione um orçamento para duplicar.");
      renderBudgets();
      return;
    }

    state.crmSubmitting = "budgets";
    renderBudgets();
    const payloads = budgets.map((budget) => ({
      client_id: budget.client_id,
      contact_id: budget.contact_id,
      project_id: budget.project_id,
      title: `Cópia de ${budget.title}`,
      status: "draft",
      currency: budget.currency || "BRL",
      subtotal: Number(budget.subtotal || 0),
      discount: Number(budget.discount || 0),
      tax: Number(budget.tax || 0),
      total: Number(budget.total || 0),
      valid_until: budget.valid_until,
      resolved: false,
      created_by: state.session?.user?.id || null,
      created_by_email: state.session?.user?.email || "",
      payload: {
        ...budgetPayload(budget),
        duplicatedFrom: budget.id,
        createdByEmail: state.session?.user?.email || "",
        updatedFromAdminAt: new Date().toISOString(),
      },
    }));

    let error = null;
    try {
      const result = await supabase().from("budgets").insert(payloads);
      error = result.error;
    } catch (caught) {
      error = caught;
    }
    await afterCrmMutation(error, budgets.length === 1 ? "Orçamento duplicado." : "Orçamentos duplicados.", routeKey());
  }

  async function duplicateSelectedServiceOrders() {
    if (!supabase() || !isLoggedIn() || isSubmitting("service_orders")) return;
    const orders = selectedServiceOrdersForAction();
    if (!orders.length) {
      setNotice("error", "Selecione uma OS para duplicar.");
      renderServiceOrders();
      return;
    }

    state.crmSubmitting = "service_orders";
    renderServiceOrders();
    const rows = orders.map((order) => ({
      client_id: order.client_id,
      project_id: order.project_id,
      budget_id: order.budget_id,
      title: `Cópia de ${order.title}`,
      status: "open",
      starts_at: order.starts_at,
      due_at: order.due_at,
      recurrence: order.recurrence || "one_time",
      billing_cycle: order.billing_cycle || "",
      estimated_hours: Number(order.estimated_hours || 0),
      hourly_rate: Number(order.hourly_rate || 0),
      scope: {
        ...orderScopeObject(order),
        text: scopeText(order.scope) || order.title,
        duplicatedFrom: order.id,
        duplicatedAt: new Date().toISOString(),
      },
    }));

    let error = null;
    try {
      const result = await supabase().from("service_orders").insert(rows);
      error = result.error;
    } catch (caught) {
      error = caught;
    }
    await afterCrmMutation(error, orders.length === 1 ? "OS duplicada." : "OS duplicadas.", routeKey());
  }

  async function createServiceOrderFromBudget(id = "") {
    if (!supabase() || !isLoggedIn() || isSubmitting("service_orders")) return;
    const budgets = selectedBudgetsForAction(id);
    if (!budgets.length) {
      setNotice("error", "Selecione um orçamento para gerar OS.");
      renderBudgets();
      return;
    }

    const budgetsWithoutOrder = budgets.filter((budget) => !state.serviceOrders.some((order) => order.budget_id === budget.id));
    if (!budgetsWithoutOrder.length) {
      state.crmSelectedBudgets = budgets.map((budget) => budget.id);
      setNotice("success", budgets.length === 1 ? "OS já existente para este orçamento." : "Todos os orçamentos selecionados já têm OS.", { route: "crm/orders" });
      if (window.location.hash !== "#/crm/orders") window.location.hash = "#/crm/orders";
      else renderServiceOrders();
      return;
    }

    state.crmSubmitting = "service_orders";
    renderBudgets();
    const rows = budgetsWithoutOrder.map((budget) => {
      const payload = budgetPayload(budget);
      const scope = [
        payload.summary,
        budgetItemsText(budget),
        payload.productionNotes,
      ].filter(Boolean).join("\n\n");
      return {
        client_id: budget.client_id,
        project_id: budget.project_id,
        budget_id: budget.id,
        title: budget.title,
        status: "open",
        due_at: budget.valid_until,
        recurrence: "one_time",
        billing_cycle: payload.deliveryTerms || "",
        estimated_hours: Number(payload.productEstimatedHours || 0),
        hourly_rate: Number(payload.productHourlyRate || 0),
        scope: {
          text: scope || budget.title,
          fromBudget: budget.id,
          budgetNumber: budgetNumberLabel(budget),
        },
      };
    });
    let error = null;
    try {
      const result = await supabase().from("service_orders").insert(rows);
      error = result.error;
    } catch (caught) {
      error = caught;
    }

    state.crmSubmitting = null;
    if (error) {
      setNotice("error", error.message || "Não foi possível gerar a OS.", { route: routeKey() });
      renderBudgets();
      return;
    }
    state.crmLoaded = false;
    await loadAdminData({ force: true });
    setNotice("success", rows.length === 1 ? "OS gerada a partir do orçamento." : "OS geradas a partir dos orçamentos.", { route: "crm/orders" });
    if (window.location.hash !== "#/crm/orders") window.location.hash = "#/crm/orders";
    else renderServiceOrders();
  }

  async function generateRecurringOrders(id = "") {
    if (!supabase() || !isLoggedIn() || isSubmitting("service_orders")) return;
    const order = state.serviceOrders.find((item) => item.id === id);
    if (!order) {
      setNotice("error", "OS não encontrada.", { route: "crm/orders" });
      renderServiceOrders();
      return;
    }
    if (!["biweekly", "monthly"].includes(order.recurrence)) {
      setNotice("error", "Geração automática disponível para OS quinzenal ou mensal.", { route: "crm/orders" });
      renderServiceOrders();
      return;
    }

    const existingIndexes = new Set(
      state.serviceOrders
        .map((item) => orderScopeObject(item))
        .filter((scope) => scope.recurringFrom === order.id)
        .map((scope) => Number(scope.recurringIndex || 0))
        .filter(Boolean),
    );
    const sourceScope = orderScopeObject(order);
    const baseStart = order.starts_at || order.due_at || order.created_at || new Date().toISOString();
    const baseDue = order.due_at || order.starts_at || order.created_at || new Date().toISOString();
    const rows = [1, 2, 3]
      .filter((index) => !existingIndexes.has(index))
      .map((index) => {
        const startsAt = advanceRecurringDate(baseStart, order.recurrence, index);
        const dueAt = advanceRecurringDate(baseDue, order.recurrence, index);
        return {
          client_id: order.client_id,
          project_id: order.project_id,
          budget_id: order.budget_id,
          title: `${order.title} · ${orderRecurrenceLabel(order)} ${formatDate(startsAt)}`,
          status: "open",
          starts_at: startsAt,
          due_at: dueAt,
          recurrence: order.recurrence,
          billing_cycle: order.billing_cycle,
          estimated_hours: Number(order.estimated_hours || 0),
          hourly_rate: Number(order.hourly_rate || 0),
          scope: {
            ...sourceScope,
            text: scopeText(order.scope) || order.title,
            recurringFrom: order.id,
            recurringIndex: index,
            recurringGeneratedAt: new Date().toISOString(),
          },
        };
      });

    if (!rows.length) {
      setNotice("success", "Os próximos ciclos desta OS já foram gerados.", { route: "crm/orders" });
      renderServiceOrders();
      return;
    }

    state.crmSubmitting = "service_orders";
    renderServiceOrders();
    let error = null;
    try {
      const result = await supabase().from("service_orders").insert(rows);
      error = result.error;
    } catch (caught) {
      error = caught;
    }
    state.crmSubmitting = null;
    if (error) {
      setNotice("error", error.message || "Não foi possível gerar os ciclos da OS.", { route: "crm/orders" });
      renderServiceOrders();
      return;
    }
    state.crmLoaded = false;
    await loadAdminData({ force: true });
    setNotice("success", rows.length === 1 ? "Ciclo recorrente gerado." : `${rows.length} ciclos recorrentes gerados.`, { route: "crm/orders" });
    renderServiceOrders();
  }

  async function createTimeEntry(form) {
    if (isSubmitting("time_entries")) return;
    const editing = crmEditRecord("time_entries");
    const data = new FormData(form);
    const errors = [];
    const hours = positiveHoursFromForm(data, errors);
    const payload = {
      project_id: optionalFormValue(data, "project_id"),
      service_order_id: optionalFormValue(data, "service_order_id"),
      work_date: requiredDateFromForm(data, "work_date", "a data", errors),
      minutes: Math.max(1, Math.round(hours * 60)),
      hourly_rate: nonNegativeNumberFromForm(data, "hourly_rate", "Valor/hora", errors),
      description: String(data.get("description") || "").trim(),
      billable: data.get("billable") === "on",
    };
    if (!editing) payload.user_id = state.session?.user?.id || null;
    if (!payload.project_id) errors.push("Selecione um projeto para registrar horas.");
    if (payload.project_id && !state.projects.some((project) => project.id === payload.project_id)) {
      errors.push("Projeto selecionado não foi encontrado.");
    }
    if (!validateCrmPayload("time_entries", errors)) return;

    await submitCrmRecord("time_entries", payload, editing, editing ? "Lançamento atualizado." : "Horas registradas.");
  }

  async function deleteCrmRecord(table, id) {
    if (!supabase() || !isLoggedIn() || !table || !id) return;
    const allowedTables = new Set(["clients", "contacts", "projects", "products", "substrates", "budgets", "service_orders", "time_entries"]);
    if (!allowedTables.has(table)) return;
    if (state.crmEdit?.table === table && state.crmEdit?.id === id) state.crmEdit = null;

    let error = null;
    try {
      const result = await supabase().from(table).delete().eq("id", id);
      error = result.error;
    } catch (caught) {
      error = caught;
    }
    await afterCrmMutation(error, "Registro excluido.", routeKey());
  }

  function openCrmEdit(table, id) {
    if (!CRM_STATE_KEYS[table] || !id) return;
    if (table === "clients") {
      openClientModal(id);
      return;
    }
    if (table === "contacts") {
      const contact = state.contacts.find((item) => item.id === id);
      openContactModal(contact?.client_id || "", id);
      return;
    }
    if (table === "projects") {
      openProjectModal(id);
      return;
    }
    state.crmEdit = { table, id };
    clearNotice();
    render();
  }

  function cancelCrmEdit() {
    state.crmEdit = null;
    clearNotice();
    render();
  }

  async function afterCrmMutation(error, successMessage, noticeRoute = routeKey(), table = "", editing = null) {
    state.crmSubmitting = null;
    if (error) {
      setNotice("error", error.message || "Não foi possível concluir a operação.", { route: noticeRoute });
      refreshSubmittingModal(table, editing);
    } else {
      setNotice("success", successMessage, { route: noticeRoute });
      state.crmEdit = null;
      state.modal = null;
      state.crmLoaded = false;
      try {
        await loadAdminData({ force: true });
      } catch (caught) {
        setNotice("error", caught.message || "Registro salvo, mas não foi possível recarregar o CRM.", { route: noticeRoute });
      }
    }
    render();
  }

  return {
    addBudgetItem,
    addBudgetItemSubstrate,
    cancelCrmEdit,
    createBudget,
    createClient,
    createContact,
    createProduct,
    createProject,
    createServiceOrder,
    createServiceOrderFromBudget,
    createSubstrate,
    createTimeEntry,
    deleteCrmRecord,
    duplicateSelectedBudget,
    duplicateSelectedServiceOrders,
    downloadActivePdf,
    exportBudgetReportCsv,
    exportSelectedBudgetPdf,
    exportServiceOrderPdf,
    generateRecurringOrders,
    openCrmEdit,
    openBudgetModal,
    openClientDetailsModal,
    openClientModal,
    openBudgetReports,
    openContactModal,
    openDeleteCrmModal,
    openProductModal,
    openProjectModal,
    openServiceOrderModal,
    openSubstrateModal,
    renderBudgets,
    renderAdminDashboard,
    renderClients,
    renderCrmPage,
    renderCrmNotice,
    renderProjects,
    renderServiceOrders,
    renderTimeEntries,
    selectBudget,
    selectAllVisibleBudgets,
    selectOrder,
    selectAllVisibleOrders,
    syncBudgetContactOptions,
    removeBudgetItem,
    removeBudgetItemSubstrate,
    updateBudgetEstimate,
    updateBudgetItemsEstimate,
    updateBudgetFilters,
    updateBudgetReportFilter,
    updateOrderFilters,
    updateProductFilters,
    updateSubstrateFilters,
    updateBudgetTotalPreview,
  };
}
