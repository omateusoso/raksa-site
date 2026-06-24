import {
  ACTIVITY_LOG_COLUMNS,
  ACTIVITY_LOGS_TABLE,
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
  PRODUCT_SUBSTRATE_COLUMNS,
  PROJECT_COLUMNS,
  SERVICE_ORDER_COLUMNS,
  SERVICE_ORDER_ITEM_COLUMNS,
  STORAGE_KEY,
  SUBSTRATE_COLUMNS,
  TAGS,
  TIME_ENTRY_COLUMNS,
  USER_PROFILE_COLUMNS,
  USER_PROFILES_TABLE,
} from "./constants.js?v=20";
import { isSuperAdmin } from "./permissions.js?v=2";
import { normalizeAssetUrl } from "./utils.js?v=3";

const PROTECTED_SUPER_ADMIN_EMAILS = new Set(["davidraksa@live.com", "omateusosos@gmail.com"]);

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

  function normalizeEmail(value = "") {
    return String(value || "").trim().toLowerCase();
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
    state.currentUserProfile = null;
    if (state.session && !(await isAdminUser())) {
      await client.auth.signOut();
      state.session = null;
      state.currentUserProfile = null;
    }
  }

  function fallbackProfileForSession() {
    const user = state.session?.user;
    if (!user) return null;
    const email = String(user.email || "").trim().toLowerCase();
    const name = user.user_metadata?.name || user.user_metadata?.full_name || email.split("@")[0] || "";
    const role = isSuperAdmin(state) ? "super_admin" : "viewer";
    return {
      auth_user_id: user.id,
      email,
      full_name: name,
      display_name: name,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
      role,
      access_level: role,
      hierarchy_level: role === "super_admin" ? 100 : 10,
      status: "active",
      synthetic: true,
    };
  }

  async function getCurrentUserProfile({ touchLastLogin = false } = {}) {
    const client = supabase();
    const user = state.session?.user;
    if (!client || !user?.id) return null;

    const email = String(user.email || "").trim().toLowerCase();
    let { data, error } = await client
      .from(USER_PROFILES_TABLE)
      .select(USER_PROFILE_COLUMNS)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("[RAKSA Admin] Perfil interno indisponivel.", error);
      state.currentUserProfile = fallbackProfileForSession();
      return state.currentUserProfile;
    }

    if (!data) {
      const fallback = fallbackProfileForSession();
      const insertResult = await client
        .from(USER_PROFILES_TABLE)
        .insert({
          auth_user_id: user.id,
          email,
          full_name: fallback.full_name || "",
          display_name: fallback.display_name || "",
          avatar_url: fallback.avatar_url || "",
          role: fallback.role,
          access_level: fallback.access_level,
          hierarchy_level: fallback.hierarchy_level,
          status: "active",
          last_login_at: touchLastLogin ? new Date().toISOString() : null,
        })
        .select(USER_PROFILE_COLUMNS)
        .maybeSingle();

      if (!insertResult.error && insertResult.data) data = insertResult.data;
      else data = fallback;
    } else if (touchLastLogin) {
      const updateResult = await client
        .from(USER_PROFILES_TABLE)
        .update({
          email: data.email || email,
          last_login_at: new Date().toISOString(),
        })
        .eq("auth_user_id", user.id)
        .select(USER_PROFILE_COLUMNS)
        .maybeSingle();

      if (!updateResult.error && updateResult.data) data = updateResult.data;
    }

    state.currentUserProfile = data || fallbackProfileForSession();
    return state.currentUserProfile;
  }

  function normalizeUserProfile(row = {}) {
    return {
      ...row,
      email: normalizeEmail(row.email),
      full_name: row.full_name || "",
      display_name: row.display_name || "",
      avatar_url: row.avatar_url || "",
      phone: row.phone || "",
      whatsapp: row.whatsapp || "",
      role: row.role || "viewer",
      department: row.department || "",
      hierarchy_level: numberOrDefault(row.hierarchy_level, 10),
      access_level: row.access_level || row.role || "viewer",
      employment_type: row.employment_type || "",
      status: row.status || "pending",
      weekly_hours: numberOrDefault(row.weekly_hours, 0),
      internal_hourly_rate: numberOrDefault(row.internal_hourly_rate, 0),
      monthly_cost: numberOrDefault(row.monthly_cost, 0),
      productive_hours_goal: numberOrDefault(row.productive_hours_goal, 0),
      internal_notes: row.internal_notes || "",
      preferences: {
        theme: "dark",
        density: "comfortable",
        home_page: "home",
        notifications: true,
        timezone: "America/Sao_Paulo",
        ...(row.preferences || {}),
      },
    };
  }

  function userProfilePayload(payload = {}) {
    const email = normalizeEmail(payload.email);
    const role = String(payload.role || payload.access_level || "viewer").trim() || "viewer";
    return {
      full_name: String(payload.full_name || "").trim(),
      display_name: String(payload.display_name || payload.full_name || "").trim(),
      email,
      phone: String(payload.phone || "").trim(),
      whatsapp: String(payload.whatsapp || "").trim(),
      role,
      department: String(payload.department || "").trim(),
      hierarchy_level: numberOrDefault(payload.hierarchy_level, 10),
      access_level: String(payload.access_level || role).trim() || role,
      employment_type: String(payload.employment_type || "").trim(),
      status: String(payload.status || "pending").trim(),
      supervisor_id: payload.supervisor_id || null,
      weekly_hours: numberOrDefault(payload.weekly_hours, 0),
      internal_hourly_rate: numberOrDefault(payload.internal_hourly_rate, 0),
      monthly_cost: numberOrDefault(payload.monthly_cost, 0),
      productive_hours_goal: numberOrDefault(payload.productive_hours_goal, 0),
      internal_notes: String(payload.internal_notes || "").trim(),
      updated_by: state.session?.user?.id || null,
    };
  }

  async function loadUserProfiles({ force = false } = {}) {
    const client = supabase();
    if (!client || !isLoggedIn()) return { data: [], error: new Error("Supabase indisponivel.") };
    if (state.userProfilesLoaded && !force) return { data: state.userProfiles, error: null };
    if (state.userProfilesLoading) return { data: state.userProfiles || [], error: null };

    state.userProfilesLoading = true;
    const result = await client
      .from(USER_PROFILES_TABLE)
      .select(USER_PROFILE_COLUMNS)
      .order("full_name", { ascending: true });

    state.userProfilesLoading = false;
    if (result.error) return { data: [], error: result.error };

    state.userProfiles = (result.data || []).map(normalizeUserProfile);
    state.userProfilesLoaded = true;
    return { data: state.userProfiles, error: null };
  }

  async function createUserProfile(payload = {}) {
    const client = supabase();
    if (!client || !isLoggedIn()) return { data: null, error: new Error("Supabase indisponivel.") };
    const record = userProfilePayload(payload);
    if (!record.full_name || !record.email) return { data: null, error: new Error("Nome completo e e-mail são obrigatórios.") };

    const duplicate = await client
      .from(USER_PROFILES_TABLE)
      .select("id, email")
      .ilike("email", record.email)
      .maybeSingle();
    if (duplicate.data) return { data: null, error: new Error("Já existe um perfil com este e-mail.") };
    if (duplicate.error && duplicate.error.code !== "PGRST116") return { data: null, error: duplicate.error };

    const functionPayload = {
      ...record,
      created_by: state.session?.user?.id || null,
    };
    const functionResult = await client.functions.invoke("create-user", { body: functionPayload });
    if (!functionResult.error && functionResult.data?.profile) {
      state.userProfilesLoaded = false;
      return { data: normalizeUserProfile(functionResult.data.profile), error: null };
    }

    const pendingRecord = {
      ...record,
      auth_user_id: null,
      status: record.status === "active" ? "pending" : record.status,
      created_by: state.session?.user?.id || null,
      internal_notes: [
        record.internal_notes,
        "Auth pendente: deploy/configure a Edge Function supabase/functions/create-user para criar o usuário no Supabase Auth com service role no backend.",
      ].filter(Boolean).join("\n\n"),
    };

    const insertResult = await client
      .from(USER_PROFILES_TABLE)
      .insert(pendingRecord)
      .select(USER_PROFILE_COLUMNS)
      .single();

    if (!insertResult.error) state.userProfilesLoaded = false;
    return {
      data: insertResult.data ? normalizeUserProfile(insertResult.data) : null,
      error: insertResult.error,
      authPending: !insertResult.error,
      edgeFunctionError: functionResult.error,
    };
  }

  async function saveUserProfile(id, payload = {}) {
    const client = supabase();
    if (!client || !isLoggedIn()) return { data: null, error: new Error("Supabase indisponivel.") };
    const current = state.userProfiles?.find((item) => item.id === id);
    const email = normalizeEmail(current?.email || payload.email);
    if (PROTECTED_SUPER_ADMIN_EMAILS.has(email) && !isSuperAdmin(state)) {
      const nextRole = String(payload.role || current?.role || "").toLowerCase();
      const nextAccess = String(payload.access_level || current?.access_level || "").toLowerCase();
      const nextLevel = numberOrDefault(payload.hierarchy_level, current?.hierarchy_level || 0);
      const nextStatus = String(payload.status || current?.status || "").toLowerCase();
      if (nextRole !== "super_admin" || nextAccess !== "super_admin" || nextLevel < 100 || nextStatus !== "active") {
        return { data: null, error: new Error("Somente super_admin pode alterar o acesso raiz deste usuário.") };
      }
    }

    const result = await client
      .from(USER_PROFILES_TABLE)
      .update(userProfilePayload(payload))
      .eq("id", id)
      .select(USER_PROFILE_COLUMNS)
      .single();

    if (!result.error) state.userProfilesLoaded = false;
    return {
      data: result.data ? normalizeUserProfile(result.data) : null,
      error: result.error,
    };
  }

  async function setUserProfileStatus(id, status) {
    const current = state.userProfiles?.find((item) => item.id === id);
    return saveUserProfile(id, { ...current, status });
  }

  async function saveOwnProfile(payload = {}) {
    const client = supabase();
    const id = state.currentUserProfile?.id;
    if (!client || !isLoggedIn() || !id) return { data: null, error: new Error("Perfil indisponível.") };

    const record = {
      full_name: String(payload.full_name || "").trim(),
      display_name: String(payload.display_name || payload.full_name || "").trim(),
      cpf: String(payload.cpf || "").trim(),
      birth_date: payload.birth_date || null,
      phone: String(payload.phone || "").trim(),
      whatsapp: String(payload.whatsapp || "").trim(),
      address: String(payload.address || "").trim(),
      city: String(payload.city || "").trim(),
      state: String(payload.state || "").trim(),
      zip_code: String(payload.zip_code || "").trim(),
    };

    const result = await client
      .from(USER_PROFILES_TABLE)
      .update(record)
      .eq("id", id)
      .select(USER_PROFILE_COLUMNS)
      .single();

    if (!result.error && result.data) state.currentUserProfile = normalizeUserProfile(result.data);
    return {
      data: result.data ? normalizeUserProfile(result.data) : null,
      error: result.error,
    };
  }

  async function saveOwnPreferences(preferences = {}) {
    const client = supabase();
    const id = state.currentUserProfile?.id;
    if (!client || !isLoggedIn() || !id) return { data: null, error: new Error("Perfil indisponível.") };
    const nextPreferences = {
      ...(state.currentUserProfile?.preferences || {}),
      theme: String(preferences.theme || "dark"),
      density: String(preferences.density || "comfortable"),
      home_page: String(preferences.home_page || "home"),
      notifications: Boolean(preferences.notifications),
      timezone: String(preferences.timezone || "America/Sao_Paulo"),
    };

    const result = await client
      .from(USER_PROFILES_TABLE)
      .update({
        preferences: nextPreferences,
      })
      .eq("id", id)
      .select(USER_PROFILE_COLUMNS)
      .single();

    if (!result.error && result.data) state.currentUserProfile = normalizeUserProfile(result.data);
    return {
      data: result.data ? normalizeUserProfile(result.data) : null,
      error: result.error,
    };
  }

  async function loadActivityLogs({ limit = 50 } = {}) {
    const client = supabase();
    if (!client || !isLoggedIn()) return { data: [], error: new Error("Supabase indisponivel.") };
    const result = await client
      .from(ACTIVITY_LOGS_TABLE)
      .select(ACTIVITY_LOG_COLUMNS)
      .eq("user_id", state.session.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!result.error) {
      state.activityLogs = result.data || [];
      state.activityLogsLoaded = true;
    }
    return { data: result.data || [], error: result.error };
  }

  async function logActivity(action, module, entityType = "", entityId = "", description = "", oldValue = null, newValue = null) {
    const client = supabase();
    if (!client || !isLoggedIn() || !state.session?.user?.id) return { data: null, error: null };
    const result = await client
      .from(ACTIVITY_LOGS_TABLE)
      .insert({
        user_id: state.session.user.id,
        action: String(action || "").trim(),
        module: String(module || "").trim(),
        entity_type: String(entityType || "").trim(),
        entity_id: String(entityId || "").trim(),
        description: String(description || "").trim(),
        old_value: oldValue,
        new_value: newValue,
        user_agent: navigator.userAgent || "",
      })
      .select(ACTIVITY_LOG_COLUMNS)
      .single();

    if (!result.error && result.data) {
      state.activityLogs = [result.data, ...(state.activityLogs || [])].slice(0, 50);
      state.activityLogsLoaded = true;
    }
    return result;
  }

  async function updateCurrentUserPassword(password) {
    const client = supabase();
    if (!client || !isLoggedIn()) return { data: null, error: new Error("Supabase indisponivel.") };
    return client.auth.updateUser({ password });
  }

  async function loadAdminData({ force = false } = {}) {
    const client = supabase();
    if (!client || !isLoggedIn() || (state.crmLoaded && !force) || state.crmLoading) return;
    state.crmLoading = true;

    const [clients, contacts, projects, products, productSubstrates, substrates, budgets, serviceOrders, serviceOrderItems, timeEntries, metricsEvents] = await Promise.all([
      client.from("clients").select(CLIENT_COLUMNS).order("name", { ascending: true }),
      client.from("contacts").select(CONTACT_COLUMNS).order("name", { ascending: true }),
      client.from("projects").select(PROJECT_COLUMNS).order("created_at", { ascending: false }),
      client.from("products").select(PRODUCT_COLUMNS).order("name", { ascending: true }),
      client.from("product_substrates").select(PRODUCT_SUBSTRATE_COLUMNS).order("created_at", { ascending: true }),
      client.from("substrates").select(SUBSTRATE_COLUMNS).order("name", { ascending: true }),
      client.from("budgets").select(BUDGET_COLUMNS).order("budget_number", { ascending: false }).order("created_at", { ascending: false }),
      client.from("service_orders").select(SERVICE_ORDER_COLUMNS).order("created_at", { ascending: false }),
      client.from("service_order_items").select(SERVICE_ORDER_ITEM_COLUMNS).order("position", { ascending: true }).order("created_at", { ascending: true }),
      client.from("time_entries").select(TIME_ENTRY_COLUMNS).order("work_date", { ascending: false }).limit(300),
      client.from("metrics_events").select(METRIC_COLUMNS).order("created_at", { ascending: false }).limit(500),
    ]);

    state.crmLoading = false;
    const error = [clients, contacts, projects, products, productSubstrates, substrates, budgets, serviceOrders, serviceOrderItems, timeEntries, metricsEvents].find((result) => result.error)?.error;
    if (error) {
      console.warn("[RAKSA Admin] CRM indisponivel.", error);
      return;
    }

    state.clients = clients.data || [];
    state.contacts = contacts.data || [];
    state.projects = projects.data || [];
    state.products = products.data || [];
    state.productSubstrates = productSubstrates.data || [];
    state.substrates = substrates.data || [];
    state.budgets = budgets.data || [];
    state.serviceOrders = serviceOrders.data || [];
    state.serviceOrderItems = serviceOrderItems.data || [];
    state.timeEntries = timeEntries.data || [];
    state.metricsEvents = metricsEvents.data || [];
    state.crmLoaded = true;
  }

  async function isAdminUser() {
    const client = supabase();
    if (!client || !state.session?.user?.id) return false;
    state.currentUserProfile = fallbackProfileForSession();
    if (isSuperAdmin(state)) return true;

    const { data, error } = await client
      .from(ADMINS_TABLE)
      .select("user_id")
      .eq("user_id", state.session.user.id)
      .maybeSingle();

    if (!error && data) {
      await getCurrentUserProfile();
      return true;
    }

    const profile = await getCurrentUserProfile();
    return isSuperAdmin(state) || (profile?.status === "active" && !profile.synthetic);
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
    loadActivityLogs,
    loadUserProfiles,
    logActivity,
    getCurrentUserProfile,
    persistCase,
    persistCases,
    saveFinancialSettings,
    saveOwnPreferences,
    saveOwnProfile,
    createUserProfile,
    saveUserProfile,
    seedCasesIfEmpty,
    setUserProfileStatus,
    updateCurrentUserPassword,
  };
}
