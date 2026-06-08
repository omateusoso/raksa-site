import { createCrmModule } from "./modules/crm.js?v=15";
import { createMetricsModule } from "./modules/metrics.js?v=3";
import { createApiModule } from "./modules/api.js?v=7";
import { createShellModule } from "./modules/shell.js?v=10";
import { createCasesModule } from "./modules/cases.js?v=6";

const app = document.querySelector("#app");
const supabaseConfig = window.RAKSA_SUPABASE || {};
let supabase = null;
if (supabaseConfig.url && supabaseConfig.anonKey) {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
}
const state = {
  cases: [],
  initialCases: [],
  session: null,
  search: "",
  tag: "Todos",
  notice: null,
  modal: null,
  authLoading: false,
  creatingCase: false,
  crmSubmitting: null,
  draggingImageIndex: null,
  dragOverImageIndex: null,
  draggingHomeSlug: null,
  crmLoaded: false,
  crmLoading: false,
  crmEdit: null,
  crmBudgetSearch: "",
  crmBudgetStatus: "all",
  crmSelectedBudgets: [],
  crmOrderSearch: "",
  crmOrderStatus: "all",
  crmSelectedOrders: [],
  crmProductSearch: "",
  crmProductStatus: "all",
  crmSubstrateSearch: "",
  crmSubstrateStatus: "all",
  crmReportFilters: {},
  crmPdfExport: null,
  clients: [],
  contacts: [],
  projects: [],
  products: [],
  substrates: [],
  budgets: [],
  serviceOrders: [],
  timeEntries: [],
  metricsEvents: [],
};

function isLoggedIn() {
  return Boolean(state.session);
}

let noticeTimer = null;
let noticeSequence = 0;

function currentRouteSection() {
  const [section, slug] = window.location.hash.replace(/^#\/?/, "").split("/");
  if (section === "crm" && slug) return `crm/${slug}`;
  return section || "home";
}

function clearNoticeTimer() {
  if (!noticeTimer) return;
  window.clearTimeout(noticeTimer);
  noticeTimer = null;
}

function syncNoticeToast() {
  let region = document.querySelector("[data-toast-region]");
  if (!state.notice) {
    region?.remove();
    return;
  }

  if (!region) {
    region = document.createElement("div");
    region.className = "toast-region";
    region.setAttribute("data-toast-region", "");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    document.body.append(region);
  }

  region.textContent = "";
  const toast = document.createElement("div");
  toast.className = `toast-card toast-${state.notice.type === "error" ? "error" : "success"}`;
  toast.style.setProperty("--toast-duration", `${state.notice.timeout || 4200}ms`);
  toast.style.setProperty("--toast-exit-delay", `${Math.max(0, (state.notice.timeout || 4200) - 360)}ms`);

  const marker = document.createElement("span");
  marker.className = "toast-marker";
  marker.setAttribute("aria-hidden", "true");

  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = state.notice.type === "error" ? "Atenção" : "Tudo certo";
  const message = document.createElement("span");
  message.textContent = state.notice.text || "";

  copy.append(title, message);
  toast.append(marker, copy);
  region.append(toast);
}

function setNotice(type, text, { route = currentRouteSection(), timeout } = {}) {
  clearNoticeTimer();
  const id = ++noticeSequence;
  const dismissAfter = timeout ?? (type === "error" ? 7000 : 4200);
  state.notice = { id, route, type, text, timeout: dismissAfter };
  syncNoticeToast();

  if (dismissAfter > 0) {
    noticeTimer = window.setTimeout(() => {
      if (state.notice?.id !== id) return;
      clearNotice();
    }, dismissAfter);
  }
}

function clearNotice() {
  clearNoticeTimer();
  state.notice = null;
  syncNoticeToast();
}

function clearStaleNotice() {
  if (state.notice && state.notice.route !== currentRouteSection()) clearNotice();
}

const {
  deleteRemoteCase,
  deleteUploadedFileIfUnused,
  fileExtension,
  isAdminUser,
  isManagedUpload,
  loadAdminData,
  loadCases,
  loadSession,
  persistCase,
  persistCases,
  seedCasesIfEmpty,
} = createApiModule({
  state,
  supabaseConfig,
  getSupabase: () => supabase,
  isLoggedIn,
});

const { renderComingSoon, renderLogin, renderShell } = createShellModule({
  app,
  state,
  getSupabase: () => supabase,
});

function render() {
  if (!isLoggedIn()) {
    renderLogin();
    return;
  }

  const hash = window.location.hash.replace(/^#\/?/, "");
  const [section, slug] = hash.split("/");
  if (!section) {
    window.location.replace("#/home");
    return;
  }

  clearStaleNotice();

  if (section === "cases" && slug) renderEditor(decodeURIComponent(slug).normalize("NFC"));
  else if (section === "home") renderAdminDashboard();
  else if (section === "site-home") renderHomeSettings();
  else if (section === "crm" && !slug) window.location.replace("#/crm/clients");
  else if (section === "crm") renderCrmPage(slug);
  else if (section === "clients") window.location.replace("#/crm/clients");
  else if (section === "projects") window.location.replace("#/crm/clients");
  else if (section === "budgets") window.location.replace("#/crm/budgets");
  else if (section === "orders") window.location.replace("#/crm/orders");
  else if (section === "time") window.location.replace("#/crm/orders");
  else if (section === "metrics") renderMetricsPage();
  else renderDashboard();
}

const {
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
} = createCasesModule({
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
});

const {
  addBudgetItem,
  cancelCrmEdit,
  createBudget,
  createClient,
  createContact,
  createProduct,
  createProject,
  createServiceOrder,
  createSubstrate,
  createServiceOrderFromBudget,
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
  updateBudgetEstimate,
  updateBudgetItemsEstimate,
  updateBudgetFilters,
  updateBudgetReportFilter,
  updateOrderFilters,
  updateProductFilters,
  updateSubstrateFilters,
  updateBudgetTotalPreview,
} = createCrmModule({
  state,
  getSupabase: () => supabase,
  isLoggedIn,
  setNotice,
  clearNotice,
  render,
  renderShell,
  loadAdminData,
});

const { renderMetricsPage } = createMetricsModule({ state, renderShell, renderCrmNotice });


document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-login-form]");
  const clientForm = event.target.closest("[data-client-form]");
  const contactForm = event.target.closest("[data-contact-form]");
  const projectForm = event.target.closest("[data-project-form]");
  const productForm = event.target.closest("[data-product-form]");
  const substrateForm = event.target.closest("[data-substrate-form]");
  const budgetForm = event.target.closest("[data-budget-form]");
  const orderForm = event.target.closest("[data-order-form]");
  const timeForm = event.target.closest("[data-time-form]");
  if (!form && !clientForm && !contactForm && !projectForm && !productForm && !substrateForm && !budgetForm && !orderForm && !timeForm) return;
  event.preventDefault();

  if (clientForm) return createClient(clientForm);
  if (contactForm) return createContact(contactForm);
  if (projectForm) return createProject(projectForm);
  if (productForm) return createProduct(productForm);
  if (substrateForm) return createSubstrate(substrateForm);
  if (budgetForm) return createBudget(budgetForm);
  if (orderForm) return createServiceOrder(orderForm);
  if (timeForm) return createTimeEntry(timeForm);

  if (state.authLoading) return;
  if (!supabase) {
    renderLogin("Configure o Supabase antes de entrar.");
    return;
  }

  const data = new FormData(form);
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "").trim();
  if (!email || !password) {
    renderLogin("Preencha e-mail e senha.");
    return;
  }

  state.authLoading = true;
  renderLogin();
  try {
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      state.authLoading = false;
      renderLogin(error.message);
      return;
    }

    state.session = authData.session;
    if (!(await isAdminUser())) {
      await supabase.auth.signOut();
      state.session = null;
      state.authLoading = false;
      renderLogin("Usuario autenticado, mas sem permissao de admin.");
      return;
    }

    await seedCasesIfEmpty();
    await loadAdminData({ force: true });
  } catch (error) {
    state.authLoading = false;
    renderLogin(error.message || "Não foi possível entrar agora.");
    return;
  }

  state.authLoading = false;
  if (window.location.hash !== "#/home") window.location.hash = "#/home";
  else render();
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-search]")) {
    updateDashboardSearch(event.target.value);
  }

  if (event.target.matches("[data-home-search]")) {
    updateHomeSearch(event.target.value);
  }

  if (event.target.matches("[data-budget-money]")) {
    updateBudgetTotalPreview(event.target.form);
  }

  if (event.target.matches("[data-budget-item-calc]")) {
    updateBudgetItemsEstimate(event.target.form);
  }

  if (event.target.matches("[data-budget-calc]")) {
    updateBudgetEstimate(event.target.form);
  }

  if (event.target.matches("[data-budget-search]")) {
    updateBudgetFilters({ search: event.target.value });
  }

  if (event.target.matches("[data-order-search]")) {
    updateOrderFilters({ search: event.target.value });
  }

  if (event.target.matches("[data-product-search]")) {
    updateProductFilters({ search: event.target.value });
  }

  if (event.target.matches("[data-substrate-search]")) {
    updateSubstrateFilters({ search: event.target.value });
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.matches("[data-cms-field]")) {
    event.preventDefault();
    event.target.blur();
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button, a");
  if (!target) return;

  if (target.matches("[data-logout]")) {
    if (supabase) await supabase.auth.signOut();
    state.session = null;
    window.location.hash = "#/";
    render();
  }

  if (target.matches("[data-create-case]")) await createCase();

  if (target.matches("[data-filter]")) {
    updateDashboardFilter(target.dataset.filter);
  }

  if (target.matches("[data-save-case]")) await saveCurrentCase(target.dataset.saveCase);
  if (target.matches("[data-save-home-settings]")) await saveHomeSettings();
  if (target.matches("[data-reset-home-settings]")) resetHomeSettingsDraft();
  if (target.matches("[data-home-toggle]")) toggleHomeCase(target.dataset.homeToggle, target.dataset.homeFeatured === "true");
  if (target.matches("[data-home-move]")) moveHomeCase(target.dataset.homeMove, target.dataset.homeDirection);
  if (target.matches("[data-remove-cover]")) await removeCover(target.dataset.removeCover);

  if (target.matches("[data-remove-image]")) {
    const slug = document.querySelector("[data-image-list]")?.dataset.imageList;
    await removeImage(slug, Number(target.dataset.removeImage));
  }

  if (target.matches("[data-delete-case]")) openDeleteModal(target.dataset.deleteCase);
  if (target.matches("[data-open-client-modal]")) openClientModal(target.dataset.openClientModal || "");
  if (target.matches("[data-view-client]")) openClientDetailsModal(target.dataset.viewClient || "");
  if (target.matches("[data-open-budget-modal]")) openBudgetModal();
  if (target.matches("[data-open-contact-modal]")) openContactModal(target.dataset.openContactModal || "", target.dataset.contactId || "");
  if (target.matches("[data-open-project-modal]")) openProjectModal(target.dataset.openProjectModal || "");
  if (target.matches("[data-edit-budget-modal]")) openBudgetModal(target.dataset.editBudgetModal);
  if (target.matches("[data-add-budget-item]")) addBudgetItem(target.closest("[data-budget-form]"));
  if (target.matches("[data-remove-budget-item]")) removeBudgetItem(target);
  if (target.matches("[data-recalc-budget-items]")) updateBudgetItemsEstimate(target.closest("[data-budget-form]"), true, true);
  if (target.matches("[data-duplicate-budget]")) await duplicateSelectedBudget();
  if (target.matches("[data-duplicate-order]")) await duplicateSelectedServiceOrders();
  if (target.matches("[data-create-order-from-budget]")) await createServiceOrderFromBudget(target.dataset.createOrderFromBudget || "");
  if (target.matches("[data-generate-recurring-orders]")) await generateRecurringOrders(target.dataset.generateRecurringOrders || "");
  if (target.matches("[data-export-budget-pdf]")) exportSelectedBudgetPdf(target.dataset.exportBudgetPdf || "");
  if (target.matches("[data-open-budget-reports]")) openBudgetReports();
  if (target.matches("[data-export-budget-report-csv]")) exportBudgetReportCsv();
  if (target.matches("[data-export-order-pdf]")) exportServiceOrderPdf(target.dataset.exportOrderPdf || "");
  if (target.matches("[data-download-proposal-pdf]")) await downloadActivePdf();
  if (target.matches("[data-print-budget-pdf]")) window.print();
  if (target.matches("[data-open-order-modal]")) openServiceOrderModal(target.dataset.openOrderModal || "");
  if (target.matches("[data-open-product-modal]")) openProductModal(target.dataset.openProductModal || "");
  if (target.matches("[data-open-substrate-modal]")) openSubstrateModal(target.dataset.openSubstrateModal || "");
  if (target.matches("[data-edit-crm]")) {
    const [table, id] = target.dataset.editCrm.split(":");
    openCrmEdit(table, id);
  }
  if (target.matches("[data-cancel-crm-edit]")) {
    cancelCrmEdit();
  }
  if (target.matches("[data-delete-crm]")) {
    const [table, id] = target.dataset.deleteCrm.split(":");
    openDeleteCrmModal(table, id);
  }
  if (target.matches("[data-confirm-delete-crm]")) {
    const [table, id] = target.dataset.confirmDeleteCrm.split(":");
    await deleteCrmRecord(table, id);
  }
  if (target.matches("[data-close-modal]")) {
    state.modal = null;
    state.crmEdit = null;
    state.crmPdfExport = null;
    render();
  }
  if (target.matches("[data-confirm-delete]")) await deleteCase(target.dataset.confirmDelete);
});

document.addEventListener("change", async (event) => {
  const budgetClientSelect = event.target.closest("[data-budget-client-select]");
  if (budgetClientSelect) {
    syncBudgetContactOptions(budgetClientSelect);
    return;
  }

  const budgetCalc = event.target.closest("[data-budget-calc]");
  if (budgetCalc) {
    updateBudgetEstimate(budgetCalc.form, true);
    return;
  }

  const budgetItemCalc = event.target.closest("[data-budget-item-calc]");
  if (budgetItemCalc) {
    updateBudgetItemsEstimate(budgetItemCalc.form, true);
    return;
  }

  const budgetStatus = event.target.closest("[data-budget-status-filter]");
  if (budgetStatus) {
    updateBudgetFilters({ status: budgetStatus.value });
    return;
  }

  const orderStatus = event.target.closest("[data-order-status-filter]");
  if (orderStatus) {
    updateOrderFilters({ status: orderStatus.value });
    return;
  }

  const productStatus = event.target.closest("[data-product-status-filter]");
  if (productStatus) {
    updateProductFilters({ status: productStatus.value });
    return;
  }

  const substrateStatus = event.target.closest("[data-substrate-status-filter]");
  if (substrateStatus) {
    updateSubstrateFilters({ status: substrateStatus.value });
    return;
  }

  const reportFilter = event.target.closest("[data-budget-report-filter]");
  if (reportFilter) {
    updateBudgetReportFilter(reportFilter.dataset.budgetReportFilter, reportFilter.value);
    return;
  }

  const budgetSelect = event.target.closest("[data-select-budget]");
  if (budgetSelect) {
    selectBudget(budgetSelect.value, budgetSelect.checked);
    return;
  }

  const budgetSelectAll = event.target.closest("[data-select-all-budgets]");
  if (budgetSelectAll) {
    selectAllVisibleBudgets(budgetSelectAll.checked);
    return;
  }

  const orderSelect = event.target.closest("[data-select-order]");
  if (orderSelect) {
    selectOrder(orderSelect.value, orderSelect.checked);
    return;
  }

  const orderSelectAll = event.target.closest("[data-select-all-orders]");
  if (orderSelectAll) {
    selectAllVisibleOrders(orderSelectAll.checked);
    return;
  }

  const cmsField = event.target.closest("[data-cms-field]");
  if (cmsField) {
    await updateCmsCaseField(cmsField.dataset.cmsSlug, cmsField.dataset.cmsField, cmsField.value);
    return;
  }

  const cmsTag = event.target.closest("[data-cms-tag]");
  if (cmsTag) {
    await updateCmsCaseTag(cmsTag.dataset.cmsSlug, cmsTag.dataset.cmsTag, cmsTag.checked);
    return;
  }

  const coverInput = event.target.closest("[data-cover-file]");
  if (coverInput) {
    await replaceCover(coverInput.dataset.coverFile, coverInput.files?.[0]);
    coverInput.value = "";
    return;
  }

  const imagesInput = event.target.closest("[data-case-images-file]");
  if (imagesInput) {
    await uploadCaseImages(imagesInput.dataset.caseImagesFile, [...(imagesInput.files || [])]);
    imagesInput.value = "";
  }
});

document.addEventListener("dragstart", (event) => {
  const homeCard = event.target.closest("[data-home-selected-card]");
  if (homeCard) {
    state.draggingHomeSlug = homeCard.dataset.homeSelectedCard;
    homeCard.classList.add("is-dragging");
    return;
  }

  const row = event.target.closest("[data-image-index]");
  if (!row) return;
  state.draggingImageIndex = Number(row.dataset.imageIndex);
  row.classList.add("is-dragging");
});

document.addEventListener("dragover", (event) => {
  const uploadZone = event.target.closest("[data-upload-zone]");
  if (uploadZone && [...(event.dataTransfer?.types || [])].includes("Files")) {
    event.preventDefault();
    uploadZone.classList.add("is-drop-target");
    return;
  }

  const homeCard = event.target.closest("[data-home-selected-card]");
  if (homeCard && state.draggingHomeSlug) {
    event.preventDefault();
    document.querySelectorAll(".home-selected-card.is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
    homeCard.classList.add("is-drop-target");
    return;
  }

  const row = event.target.closest("[data-image-index]");
  if (!row) return;
  event.preventDefault();
  state.dragOverImageIndex = Number(row.dataset.imageIndex);
  document.querySelectorAll(".image-row.is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
  row.classList.add("is-drop-target");
});

document.addEventListener("drop", (event) => {
  const uploadZone = event.target.closest("[data-upload-zone]");
  if (uploadZone && event.dataTransfer?.files?.length) {
    event.preventDefault();
    uploadZone.classList.remove("is-drop-target");
    uploadCaseImages(uploadZone.dataset.uploadZone, [...event.dataTransfer.files]);
    return;
  }

  const homeCard = event.target.closest("[data-home-selected-card]");
  if (homeCard && state.draggingHomeSlug) {
    event.preventDefault();
    reorderHomeByDrag(state.draggingHomeSlug, homeCard.dataset.homeSelectedCard);
    state.draggingHomeSlug = null;
    return;
  }

  const row = event.target.closest("[data-image-index]");
  if (!row) return;
  event.preventDefault();
  reorderByDrag(row.dataset.imageSlug, state.draggingImageIndex, Number(row.dataset.imageIndex));
  state.draggingImageIndex = null;
  state.dragOverImageIndex = null;
});

document.addEventListener("dragend", () => {
  state.draggingImageIndex = null;
  state.dragOverImageIndex = null;
  state.draggingHomeSlug = null;
  document.querySelectorAll(".is-dragging, .is-drop-target").forEach((node) => node.classList.remove("is-dragging", "is-drop-target"));
});

document.addEventListener("dragleave", (event) => {
  const uploadZone = event.target.closest("[data-upload-zone]");
  if (uploadZone && !uploadZone.contains(event.relatedTarget)) uploadZone.classList.remove("is-drop-target");
});

window.addEventListener("hashchange", () => {
  clearNotice();
  render();
});

await loadCases();
await loadSession();
await loadAdminData();
render();
