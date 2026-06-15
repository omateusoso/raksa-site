import {
  ADMINS_TABLE,
  BASIC_CASE_COLUMNS,
  BUDGET_COLUMNS,
  CASES_TABLE,
  CASES_URL,
  CLIENT_COLUMNS,
  CONTACT_COLUMNS,
  EXTENDED_CASE_COLUMNS,
  FINANCIAL_SETTINGS_COLUMNS,
  FINANCIAL_SETTINGS_ID,
  FINANCIAL_SETTINGS_TABLE,
  FULL_CASE_COLUMNS,
  IMAGE_BUCKET,
  LEGACY_STORAGE_KEYS,
  METRIC_COLUMNS,
  PRODUCT_COLUMNS,
  PROJECT_COLUMNS,
  SERVICE_ORDER_COLUMNS,
  STORAGE_KEY,
  SUBSTRATE_COLUMNS,
  TAGS,
  TIME_ENTRY_COLUMNS,
} from "./constants.js?v=10";
import { normalizeAssetUrl } from "./utils.js?v=3";

export function createApiModule({ state, supabaseConfig, getSupabase, isLoggedIn }) {
  const DEFAULT_FINANCIAL_SETTINGS = {
    id: FINANCIAL_SETTINGS_ID,
    hourly_rate: 70,
    default_markup_percent: 30,
    default_tax_percent: 6,
    currency: "BRL",
  };

  function supabase() {
    return getSupabase();
  }

  function fileExtension(file) {
    if (file.type === "image/png") return "png";
    if (file.type === "image/jpeg") return "jpg";
    if (file.type === "image/webp") return "webp";
    if (file.type === "image/gif") return "gif";

    const extension = String(file.name || "").split(".").pop()?.toLowerCase();
    if (extension === "jpeg") return "jpg";
    if (["png", "jpg", "webp", "gif"].includes(extension)) return extension;
    return "";
  }

  function storagePathFromPublicUrl(url = "") {
    if (!supabaseConfig.url || !url.startsWith(supabaseConfig.url)) return "";
    const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
    const pathIndex = url.indexOf(marker);
    if (pathIndex < 0) return "";
    const path = url.slice(pathIndex + marker.length).split("?")[0];
    return decodeURIComponent(path);
  }

  function isManagedUpload(url = "") {
    return Boolean(storagePathFromPublicUrl(url));
  }

  async function deleteUploadedFileIfUnused(url, item) {
    const path = storagePathFromPublicUrl(url);
    if (!path || !supabase()) return;
    const stillUsed = item.cover === url || item.images.includes(url);
    if (stillUsed) return;
    await supabase().storage.from(IMAGE_BUCKET).remove([path]);
  }

  function getStoredCases() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  function saveCases() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cases));
  }

  function clearLegacyStoredCases() {
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
  }

  function normalizeTags(tags = []) {
    const values = Array.isArray(tags) ? tags.map(String) : [];
    return TAGS.filter((tag) => values.includes(tag));
  }

  function normalizeHomeOrder(value) {
    if (value === null || value === undefined || value === "") return 999;
    const order = Number(value);
    return Number.isFinite(order) ? order : 999;
  }

  function caseExternalUrl(item = {}) {
    return String(item.externalUrl || item.external_url || item.website || item.link || "").trim();
  }

  function withCaseDefaults(item) {
    const normalized = {
      tags: [],
      images: [],
      description: "",
      cover: "",
      updatedAt: new Date().toISOString(),
      ...item,
    };

    return {
      excerpt: "",
      published: true,
      featuredOnHome: false,
      homeOrder: 999,
      contentBlocks: [],
      ...normalized,
      externalUrl: caseExternalUrl(normalized),
      tags: normalizeTags(normalized.tags),
      images: Array.isArray(normalized.images) ? normalized.images : [],
      published: normalized.published !== false,
      featuredOnHome: Boolean(normalized.featuredOnHome),
      homeOrder: normalizeHomeOrder(normalized.homeOrder),
      contentBlocks: Array.isArray(normalized.contentBlocks) ? normalized.contentBlocks : [],
    };
  }

  function isSchemaColumnError(error) {
    return Boolean(error?.message && /column|schema cache|does not exist/i.test(error.message));
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeFinancialSettings(row = {}) {
    return {
      id: row.id || FINANCIAL_SETTINGS_ID,
      hourly_rate: numberOrDefault(row.hourly_rate, DEFAULT_FINANCIAL_SETTINGS.hourly_rate),
      default_markup_percent: numberOrDefault(row.default_markup_percent, DEFAULT_FINANCIAL_SETTINGS.default_markup_percent),
      default_tax_percent: numberOrDefault(row.default_tax_percent, DEFAULT_FINANCIAL_SETTINGS.default_tax_percent),
      currency: row.currency || DEFAULT_FINANCIAL_SETTINGS.currency,
      created_at: row.created_at || "",
      updated_at: row.updated_at || "",
    };
  }

  async function loadFinancialSettings({ force = false } = {}) {
    const client = supabase();
    if (!client || !isLoggedIn()) return { data: null, error: new Error("Supabase indisponivel.") };
    if (state.financialSettingsLoaded && !force) return { data: state.financialSettings, error: null };
    if (state.financialSettingsLoading) return { data: state.financialSettings, error: null };

    state.financialSettingsLoading = true;

    const selectResult = await client
      .from(FINANCIAL_SETTINGS_TABLE)
      .select(FINANCIAL_SETTINGS_COLUMNS)
      .eq("id", FINANCIAL_SETTINGS_ID)
      .maybeSingle();

    if (selectResult.error) {
      state.financialSettingsLoading = false;
      return { data: null, error: selectResult.error };
    }

    if (selectResult.data) {
      state.financialSettings = normalizeFinancialSettings(selectResult.data);
      state.financialSettingsLoaded = true;
      state.financialSettingsLoading = false;
      return { data: state.financialSettings, error: null };
    }

    const insertResult = await client
      .from(FINANCIAL_SETTINGS_TABLE)
      .insert(DEFAULT_FINANCIAL_SETTINGS)
      .select(FINANCIAL_SETTINGS_COLUMNS)
      .single();

    state.financialSettingsLoading = false;
    if (insertResult.error) return { data: null, error: insertResult.error };

    state.financialSettings = normalizeFinancialSettings(insertResult.data);
    state.financialSettingsLoaded = true;
    return { data: state.financialSettings, error: null };
  }

  async function saveFinancialSettings(payload = {}) {
    const client = supabase();
    if (!client || !isLoggedIn()) return { data: null, error: new Error("Supabase indisponivel.") };

    const record = {
      id: FINANCIAL_SETTINGS_ID,
      hourly_rate: numberOrDefault(payload.hourly_rate, DEFAULT_FINANCIAL_SETTINGS.hourly_rate),
      default_markup_percent: numberOrDefault(payload.default_markup_percent, DEFAULT_FINANCIAL_SETTINGS.default_markup_percent),
      default_tax_percent: numberOrDefault(payload.default_tax_percent, DEFAULT_FINANCIAL_SETTINGS.default_tax_percent),
      currency: payload.currency || DEFAULT_FINANCIAL_SETTINGS.currency,
      updated_at: new Date().toISOString(),
    };

    const result = await client
      .from(FINANCIAL_SETTINGS_TABLE)
      .upsert(record, { onConflict: "id" })
      .select(FINANCIAL_SETTINGS_COLUMNS)
      .single();

    if (!result.error) {
      state.financialSettings = normalizeFinancialSettings(result.data);
      state.financialSettingsLoaded = true;
    }

    return result;
  }

  async function loadCases() {
    const response = await fetch(CASES_URL);
    const initialCases = (await response.json()).map(withCaseDefaults);
    state.initialCases = initialCases;
    clearLegacyStoredCases();

    const client = supabase();
    if (!client) {
      state.cases = (getStoredCases() || initialCases).map(withCaseDefaults);
      return;
    }

    let { data, error } = await client
      .from(CASES_TABLE)
      .select(FULL_CASE_COLUMNS)
      .order("title", { ascending: true });

    if (isSchemaColumnError(error)) {
      const fallback = await client
        .from(CASES_TABLE)
        .select(EXTENDED_CASE_COLUMNS)
        .order("title", { ascending: true });
      data = fallback.data;
      error = fallback.error;
    }

    if (isSchemaColumnError(error)) {
      const fallback = await client
        .from(CASES_TABLE)
        .select(BASIC_CASE_COLUMNS)
        .order("title", { ascending: true });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.warn("[RAKSA Admin] Supabase indisponivel, usando fallback local.", error);
      state.cases = (getStoredCases() || initialCases).map(withCaseDefaults);
      return;
    }

    state.cases = data.length ? data.map(fromSupabaseCase).map(withCaseDefaults) : initialCases;
    saveCases();
  }

  async function loadSession() {
    const client = supabase();
    if (!client) return;
    const { data } = await client.auth.getSession();
    state.session = data.session;
    if (state.session && !(await isAdminUser())) {
      await client.auth.signOut();
      state.session = null;
    }
  }

  async function loadAdminData({ force = false } = {}) {
    const client = supabase();
    if (!client || !isLoggedIn() || (state.crmLoaded && !force) || state.crmLoading) return;
    state.crmLoading = true;

    const [clients, contacts, projects, products, substrates, budgets, serviceOrders, timeEntries, metricsEvents] = await Promise.all([
      client.from("clients").select(CLIENT_COLUMNS).order("name", { ascending: true }),
      client.from("contacts").select(CONTACT_COLUMNS).order("name", { ascending: true }),
      client.from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: false }),
      client.from("products").select(PRODUCT_COLUMNS).order("name", { ascending: true }),
      client.from("substrates").select(SUBSTRATE_COLUMNS).order("name", { ascending: true }),
      client.from("budgets").select(BUDGET_COLUMNS).order("budget_number", { ascending: false }).order("created_at", { ascending: false }),
      client.from("service_orders").select(SERVICE_ORDER_COLUMNS).order("created_at", { ascending: false }),
      client.from("time_entries").select(TIME_ENTRY_COLUMNS).order("work_date", { ascending: false }).limit(300),
      client.from("metrics_events").select(METRIC_COLUMNS).order("created_at", { ascending: false }).limit(500),
    ]);

    state.crmLoading = false;
    const error = [clients, contacts, projects, products, substrates, budgets, serviceOrders, timeEntries, metricsEvents].find((result) => result.error)?.error;
    if (error) {
      console.warn("[RAKSA Admin] CRM indisponivel.", error);
      return;
    }

    state.clients = clients.data || [];
    state.contacts = contacts.data || [];
    state.projects = projects.data || [];
    state.products = products.data || [];
    state.substrates = substrates.data || [];
    state.budgets = budgets.data || [];
    state.serviceOrders = serviceOrders.data || [];
    state.timeEntries = timeEntries.data || [];
    state.metricsEvents = metricsEvents.data || [];
    state.crmLoaded = true;
  }

  async function isAdminUser() {
    const client = supabase();
    if (!client || !state.session?.user?.id) return false;

    const { data, error } = await client
      .from(ADMINS_TABLE)
      .select("user_id")
      .eq("user_id", state.session.user.id)
      .maybeSingle();

    return !error && Boolean(data);
  }

  function fromSupabaseCase(row) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      tags: row.tags || [],
      description: row.description || "",
      cover: normalizeAssetUrl(row.cover || ""),
      images: (row.images || []).map(normalizeAssetUrl),
      excerpt: row.excerpt || "",
      published: row.published ?? true,
      featuredOnHome: row.featured_on_home ?? false,
      homeOrder: row.home_order ?? 999,
      contentBlocks: row.content_blocks || [],
      externalUrl: caseExternalUrl(row),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function toSupabaseCase(item, { extended = true, external = true } = {}) {
    const base = {
      id: item.id,
      slug: item.slug,
      title: item.title,
      tags: normalizeTags(item.tags),
      description: item.description,
      cover: item.cover || "",
      images: Array.isArray(item.images) ? item.images : [],
      updated_at: item.updatedAt || new Date().toISOString(),
    };

    if (!extended) return base;

    const payload = {
      ...base,
      published: item.published !== false,
      featured_on_home: Boolean(item.featuredOnHome),
      home_order: normalizeHomeOrder(item.homeOrder),
      excerpt: item.excerpt || "",
      content_blocks: Array.isArray(item.contentBlocks) ? item.contentBlocks : [],
      created_at: item.createdAt || item.updatedAt || new Date().toISOString(),
    };

    if (external) payload.external_url = caseExternalUrl(item);
    return payload;
  }

  async function persistCase(item) {
    const client = supabase();
    if (!client || !isLoggedIn()) {
      saveCases();
      return { error: null };
    }

    let result = await client
      .from(CASES_TABLE)
      .upsert(toSupabaseCase(item), { onConflict: "id" });

    if (!isSchemaColumnError(result.error)) {
      if (!result.error) saveCases();
      return result;
    }

    result = await client
      .from(CASES_TABLE)
      .upsert(toSupabaseCase(item, { external: false }), { onConflict: "id" });

    if (!isSchemaColumnError(result.error)) {
      if (!result.error) saveCases();
      return result;
    }

    result = await client
      .from(CASES_TABLE)
      .upsert(toSupabaseCase(item, { extended: false }), { onConflict: "id" });

    if (!result.error) saveCases();
    return result;
  }

  async function persistCases(items = []) {
    const client = supabase();
    const records = items.filter(Boolean);
    if (!records.length) return { error: null };

    if (!client || !isLoggedIn()) {
      saveCases();
      return { error: null };
    }

    let result = await client
      .from(CASES_TABLE)
      .upsert(records.map((item) => toSupabaseCase(item)), { onConflict: "id" });

    if (!isSchemaColumnError(result.error)) {
      if (!result.error) saveCases();
      return result;
    }

    result = await client
      .from(CASES_TABLE)
      .upsert(records.map((item) => toSupabaseCase(item, { external: false })), { onConflict: "id" });

    if (!isSchemaColumnError(result.error)) {
      if (!result.error) saveCases();
      return result;
    }

    result = await client
      .from(CASES_TABLE)
      .upsert(records.map((item) => toSupabaseCase(item, { extended: false })), { onConflict: "id" });

    if (!result.error) saveCases();
    return result;
  }

  async function deleteRemoteCase(slug) {
    const client = supabase();
    if (!client || !isLoggedIn()) {
      saveCases();
      return { error: null };
    }

    return client.from(CASES_TABLE).delete().eq("slug", slug);
  }

  async function seedCasesIfEmpty() {
    const client = supabase();
    if (!client || !isLoggedIn() || state.cases.length !== state.initialCases.length) return;

    const { count, error } = await client
      .from(CASES_TABLE)
      .select("id", { count: "exact", head: true });

    if (error || count) return;

    let { error: upsertError } = await client
      .from(CASES_TABLE)
      .upsert(state.initialCases.map((item) => toSupabaseCase(item)), { onConflict: "id" });

    if (isSchemaColumnError(upsertError)) {
      const fallback = await client
        .from(CASES_TABLE)
        .upsert(state.initialCases.map((item) => toSupabaseCase(item, { external: false })), { onConflict: "id" });
      upsertError = fallback.error;
    }

    if (isSchemaColumnError(upsertError)) {
      const fallback = await client
        .from(CASES_TABLE)
        .upsert(state.initialCases.map((item) => toSupabaseCase(item, { extended: false })), { onConflict: "id" });
      upsertError = fallback.error;
    }

    if (upsertError) console.warn("[RAKSA Admin] Nao foi possivel popular cases iniciais.", upsertError);
  }

  return {
    deleteRemoteCase,
    deleteUploadedFileIfUnused,
    fileExtension,
    isAdminUser,
    isManagedUpload,
    loadAdminData,
    loadCases,
    loadFinancialSettings,
    loadSession,
    persistCase,
    persistCases,
    saveFinancialSettings,
    seedCasesIfEmpty,
  };
}
