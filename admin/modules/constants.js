export const CASES_URL = "./data/cases.json";
export const STORAGE_KEY = "raksa-admin-cases-v2";
export const LEGACY_STORAGE_KEYS = ["raksa-admin-cases-v1"];
export const ADMINS_TABLE = "admin_users";
export const CASES_TABLE = "cases";
export const IMAGE_BUCKET = "case-images";
export const PAGE_BASE = "/raksadesign";
export const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export const ACCEPTED_IMAGE_ACCEPT = [...ACCEPTED_IMAGE_TYPES].join(",");
export const ACCEPTED_IMAGE_LABEL = "PNG, JPEG, WEBP ou GIF";
export const TAGS = ["UI/UX Design", "Desenvolvimento", "Branding", "Editorial"];

export const BASIC_CASE_COLUMNS = "id, slug, title, tags, description, cover, images, updated_at";
export const EXTENDED_CASE_COLUMNS = `${BASIC_CASE_COLUMNS}, published, featured_on_home, home_order, excerpt, content_blocks, created_at`;
export const FULL_CASE_COLUMNS = `${EXTENDED_CASE_COLUMNS}, external_url`;
export const CLIENT_COLUMNS = "id, name, type, document, email, phone, website, status, billing_email, address, referral_source, commission_rate, notes, created_at, updated_at";
export const CONTACT_COLUMNS = "id, client_id, name, role, email, phone, notes, created_at, updated_at";
export const PROJECT_COLUMNS = "id, client_id, case_id, name, status, description, starts_at, due_at, budget_total, created_at, updated_at";
export const PRODUCT_COLUMNS = "id, name, category, description, base_price, estimated_hours, default_markup, pricing_model, hourly_rate, default_substrate_ids, status, created_at, updated_at";
export const SUBSTRATE_COLUMNS = "id, name, kind, unit, unit_cost, notes, status, created_at, updated_at";
export const BUDGET_COLUMNS = "id, budget_number, client_id, contact_id, project_id, title, status, currency, subtotal, discount, tax, total, valid_until, resolved, payload, created_at, updated_at";
export const SERVICE_ORDER_COLUMNS = "id, client_id, project_id, budget_id, title, status, scope, starts_at, due_at, recurrence, billing_cycle, estimated_hours, hourly_rate, created_at, updated_at";
export const TIME_ENTRY_COLUMNS = "id, project_id, service_order_id, user_id, work_date, minutes, hourly_rate, description, billable, created_at, updated_at";
export const METRIC_COLUMNS = "id, event_name, path, metadata, created_at";

export const ADMIN_SECTIONS = [
  ["home", "Dashboard"],
  ["cases", "CMS"],
  ["site-home", "Página inicial"],
  ["crm", "CRM"],
  ["metrics", "Métricas"],
];

export const CRM_TABS = [
  ["clients", "Clientes"],
  ["budgets", "Orçamentos"],
  ["orders", "OS"],
  ["products", "Produtos"],
  ["substrates", "Substratos"],
];

export const CLIENT_TYPES = [
  ["company", "Empresa"],
  ["person", "Pessoa"],
];

export const CLIENT_STATUSES = [
  ["active", "Ativo"],
  ["lead", "Lead"],
  ["inactive", "Inativo"],
];

export const PROJECT_STATUSES = [
  ["lead", "Lead"],
  ["proposal", "Proposta"],
  ["active", "Ativo"],
  ["paused", "Pausado"],
  ["done", "Concluído"],
  ["canceled", "Cancelado"],
];

export const BUDGET_STATUSES = [
  ["draft", "Rascunho"],
  ["sent", "Enviado"],
  ["approved", "Aprovado"],
  ["rejected", "Reprovado"],
];

export const ORDER_STATUSES = [
  ["open", "Aberta"],
  ["in_progress", "Em andamento"],
  ["done", "Concluída"],
  ["canceled", "Cancelada"],
];

export const PRODUCT_PRICING_MODELS = [
  ["fixed", "Preço fixo"],
  ["hourly", "Horas x valor/hora"],
  ["hybrid", "Fixo + horas"],
];

export const ORDER_RECURRENCES = [
  ["one_time", "Única"],
  ["biweekly", "Quinzenal"],
  ["monthly", "Mensal"],
  ["custom", "Personalizada"],
];

export const CRM_STATE_KEYS = {
  clients: "clients",
  contacts: "contacts",
  projects: "projects",
  products: "products",
  substrates: "substrates",
  budgets: "budgets",
  service_orders: "serviceOrders",
  time_entries: "timeEntries",
};

export const logo = `
  <span class="logo" aria-label="RAKSA">
    <svg viewBox="0 0 132 64" fill="none" role="img">
      <path d="M16.0849 63.2085C15.6854 61.6031 15.413 60.6179 15.413 55.5456V45.7297C15.413 39.9276 13.9419 37.7928 10.5822 37.7928H8.03965V63.2085H0.648193V0.791242H11.7808C19.4265 0.791242 22.7136 5.5168 22.7136 15.1503V20.0583C22.7136 26.4806 21.17 30.6772 17.8828 32.7205C21.5695 34.7641 22.7863 39.4897 22.7863 46.0033V55.6368C22.7863 58.6656 22.8589 60.8916 23.5854 63.2085H16.0668H16.0849ZM8.02149 9.71322V28.8891H10.9091C13.6695 28.8891 15.3403 27.2836 15.3403 22.2843V16.1356C15.3403 11.6837 14.1962 9.71322 11.581 9.71322H8.02149Z" fill="currentColor"/>
      <path d="M44.0525 63.2085L42.7811 51.8783H33.7189L32.4477 63.2085H25.6738L33.1922 0.791242H43.998L51.5165 63.2085H44.0525ZM34.6634 43.4124H41.7824L38.2229 11.8479L34.6634 43.4124Z" fill="currentColor"/>
      <path d="M64.5927 38.3402L62.3046 44.051V63.2268H54.9312V0.791242H62.3046V27.9951L71.9661 0.791242H79.3393L69.0785 28.6154L79.3393 63.2086H71.7482L64.5745 38.3219L64.5927 38.3402Z" fill="#7E43FF"/>
      <path d="M92.288 0.0797046C99.4617 0.0797046 103.148 5.79049 103.148 15.7707V17.7412H96.1746V15.1504C96.1746 10.6985 94.8306 9.00169 92.4878 9.00169C90.1452 9.00169 88.8012 10.6985 88.8012 15.1504C88.8012 27.9951 103.221 30.4035 103.221 48.2293C103.221 66.0551 99.4617 63.9203 92.2154 63.9203C84.9693 63.9203 81.2101 58.2095 81.2101 48.2293V44.3976H88.1838V48.8496C88.1838 53.3014 89.6549 54.9071 92.0157 54.9071C94.3766 54.9071 95.8478 53.3014 95.8478 48.8496C95.8478 36.0049 81.428 33.5965 81.428 15.7707C81.428 -2.05501 85.1146 0.0797046 92.288 0.0797046Z" fill="currentColor"/>
      <path d="M123.888 63.2085L122.616 51.8783H113.554L112.283 63.2085H105.509L113.028 0.791242H123.833L131.352 63.2085H123.888ZM114.499 43.4124H121.618L118.058 11.8479L114.499 43.4124Z" fill="currentColor"/>
    </svg>
  </span>`;
