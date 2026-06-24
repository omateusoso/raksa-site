import {
  EMPLOYMENT_TYPES,
  HIERARCHY_LEVELS,
  SUPER_ADMIN_EMAILS,
  USER_ROLES,
  USER_STATUSES,
} from "./constants.js?v=20";
import { canManageUsers, isSuperAdmin } from "./permissions.js?v=2";
import { escapeHtml } from "./utils.js?v=3";

const ROLE_LABELS = Object.fromEntries(USER_ROLES);
const STATUS_LABELS = Object.fromEntries(USER_STATUSES);
const EMPLOYMENT_LABELS = Object.fromEntries(EMPLOYMENT_TYPES);

const TABS = [
  ["overview", "Visão geral"],
  ["personal", "Dados pessoais"],
  ["professional", "Dados profissionais"],
  ["permissions", "Permissões"],
  ["activity", "Atividade"],
  ["security", "Segurança"],
  ["preferences", "Preferências"],
];

function activeTab() {
  const [, tab] = window.location.hash.replace(/^#\/?/, "").split("/");
  return TABS.some(([key]) => key === tab) ? tab : "overview";
}

function profileName(profile = {}) {
  return profile.display_name || profile.full_name || profile.email || "Usuário";
}

function initials(profile = {}) {
  return profileName(profile).trim().slice(0, 1).toUpperCase() || "U";
}

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
}

function formatDateTime(value) {
  if (!value) return "Nunca";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Nunca" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" }).format(Number(value || 0));
}

function detail(label, value) {
  return `<div class="profile-detail"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "-")}</strong></div>`;
}

function selectOptions(options, selected) {
  return options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function permissionFlags(profile, state) {
  const flags = [
    ["Super admin", isSuperAdmin(state)],
    ["Admin ou acima", Number(profile.hierarchy_level || 0) >= HIERARCHY_LEVELS.admin || ["admin", "super_admin"].includes(profile.access_level)],
    ["Gerencia usuários", canManageUsers(state)],
    ["Configurações", isSuperAdmin(state)],
    ["Criação de usuários", canManageUsers(state)],
  ];
  return flags.map(([label, enabled]) => `
    <span class="permission-chip ${enabled ? "is-enabled" : ""}">
      <span aria-hidden="true"></span>${escapeHtml(label)}
    </span>`).join("");
}

function activityRows(logs = []) {
  if (!logs.length) {
    return `<div class="profile-empty-state">Nenhuma atividade registrada ainda.</div>`;
  }
  return logs.map((log) => `
    <article class="activity-item">
      <span class="activity-dot" aria-hidden="true"></span>
      <div>
        <div class="activity-heading">
          <strong>${escapeHtml(log.action || "atividade")}</strong>
          <time>${escapeHtml(formatDateTime(log.created_at))}</time>
        </div>
        <p>${escapeHtml(log.description || `${log.module || "Plataforma"} · ${log.entity_type || "registro"}`)}</p>
        <small>${escapeHtml([log.module, log.entity_type, log.entity_id].filter(Boolean).join(" / ") || "RAKSA")}</small>
      </div>
    </article>`).join("");
}

export function createProfileModule({
  state,
  render,
  renderShell,
  setNotice,
  getCurrentUserProfile,
  loadActivityLogs,
  logActivity,
  saveOwnProfile,
  saveOwnPreferences,
  updateCurrentUserPassword,
  getSupabase,
}) {
  function profile() {
    return state.currentUserProfile || {};
  }

  function ensureActivityLoaded() {
    if (state.activityLogsLoaded || state.activityLogsLoading) return;
    state.activityLogsLoading = true;
    loadActivityLogs({ limit: 50 }).then(({ error }) => {
      if (error) setNotice("error", error.message || "Não foi possível carregar atividades.", { route: "profile/activity" });
    }).finally(() => {
      state.activityLogsLoading = false;
      render();
    });
  }

  function header() {
    const current = profile();
    const root = SUPER_ADMIN_EMAILS.includes(normalizeEmail(current.email));
    return `
      <section class="profile-hero">
        <div class="profile-hero-main">
          <span class="profile-hero-avatar" aria-hidden="true">
            ${current.avatar_url ? `<img src="${escapeHtml(current.avatar_url)}" alt="">` : `<span>${escapeHtml(initials(current))}</span>`}
          </span>
          <div>
            <span class="eyebrow">${root ? "Controle total" : escapeHtml(STATUS_LABELS[current.status] || current.status || "Perfil")}</span>
            <h1>${escapeHtml(current.full_name || profileName(current))}</h1>
            <p>${escapeHtml([ROLE_LABELS[current.role] || current.role, current.department, current.email].filter(Boolean).join(" · "))}</p>
            <div class="profile-hero-meta">
              <span>${escapeHtml(STATUS_LABELS[current.status] || current.status || "-")}</span>
              <span>Último acesso: ${escapeHtml(formatDateTime(current.last_login_at))}</span>
            </div>
          </div>
        </div>
        <div class="profile-hero-actions">
          <button class="button button-primary" type="button" data-profile-edit>Editar perfil</button>
          <button class="button button-secondary" type="button" data-profile-password>Alterar senha</button>
          <button class="button button-ghost" type="button" data-logout>Sair</button>
        </div>
      </section>`;
  }

  function tabs() {
    const currentTab = activeTab();
    return `
      <nav class="profile-tabs" aria-label="Seções do perfil">
        ${TABS.map(([key, label]) => `
          <a class="${currentTab === key ? "is-active" : ""}" href="#/profile/${key}">${escapeHtml(label)}</a>
        `).join("")}
      </nav>`;
  }

  function overview() {
    const current = profile();
    const logs = state.activityLogs || [];
    return `
      <section class="profile-grid">
        <article class="panel profile-panel">
          <h2>Dados principais</h2>
          <div class="profile-detail-grid">
            ${detail("Nome de exibição", current.display_name || "-")}
            ${detail("E-mail", current.email || "-")}
            ${detail("Telefone", current.phone || "-")}
            ${detail("WhatsApp", current.whatsapp || "-")}
          </div>
        </article>
        <article class="panel profile-panel">
          <h2>Posição</h2>
          <div class="profile-detail-grid">
            ${detail("Cargo", ROLE_LABELS[current.role] || current.role || "-")}
            ${detail("Departamento", current.department || "-")}
            ${detail("Acesso", ROLE_LABELS[current.access_level] || current.access_level || "-")}
            ${detail("Hierarquia", String(current.hierarchy_level || 0))}
          </div>
        </article>
        <article class="panel profile-panel profile-wide">
          <h2>Atividade recente</h2>
          <div class="profile-activity-list">${activityRows(logs.slice(0, 5))}</div>
        </article>
      </section>`;
  }

  function personal() {
    const current = profile();
    return `
      <section class="panel profile-panel">
        <div class="profile-detail-grid">
          ${detail("Nome completo", current.full_name)}
          ${detail("Nome de exibição", current.display_name)}
          ${detail("CPF", current.cpf)}
          ${detail("Data de nascimento", formatDate(current.birth_date))}
          ${detail("Telefone", current.phone)}
          ${detail("WhatsApp", current.whatsapp)}
          ${detail("E-mail", current.email)}
          ${detail("Endereço", current.address)}
          ${detail("Cidade", current.city)}
          ${detail("Estado", current.state)}
          ${detail("CEP", current.zip_code)}
        </div>
      </section>`;
  }

  function professional() {
    const current = profile();
    const supervisor = (state.userProfiles || []).find((item) => item.id === current.supervisor_id);
    return `
      <section class="panel profile-panel">
        <div class="profile-detail-grid">
          ${detail("Cargo", ROLE_LABELS[current.role] || current.role)}
          ${detail("Departamento", current.department)}
          ${detail("Tipo de vínculo", EMPLOYMENT_LABELS[current.employment_type] || current.employment_type)}
          ${detail("Data de entrada", formatDate(current.start_date))}
          ${detail("Data de saída", formatDate(current.end_date))}
          ${detail("Supervisor", supervisor ? profileName(supervisor) : "-")}
          ${detail("Carga horária semanal", `${Number(current.weekly_hours || 0)}h`)}
          ${detail("Valor hora interno", formatMoney(current.internal_hourly_rate))}
          ${detail("Custo mensal estimado", formatMoney(current.monthly_cost))}
          ${detail("Meta produtiva/mês", `${Number(current.productive_hours_goal || 0)}h`)}
        </div>
      </section>`;
  }

  function permissions() {
    const current = profile();
    const root = SUPER_ADMIN_EMAILS.includes(normalizeEmail(current.email));
    return `
      <section class="panel profile-panel">
        <div class="profile-permissions-header">
          <div>
            <h2>Permissões</h2>
            <p class="section-subtitle">Permissões são geridas pela tela Usuários. Usuários comuns só visualizam esta aba.</p>
          </div>
          <span class="status-pill ${root || isSuperAdmin(state) ? "user-status-active" : ""}">${root || isSuperAdmin(state) ? "super_admin" : "perfil padrão"}</span>
        </div>
        <div class="profile-detail-grid">
          ${detail("Nível hierárquico", String(current.hierarchy_level || 0))}
          ${detail("Nível de acesso", ROLE_LABELS[current.access_level] || current.access_level)}
          ${detail("Cargo", ROLE_LABELS[current.role] || current.role)}
          ${detail("Status", STATUS_LABELS[current.status] || current.status)}
        </div>
        <div class="permission-chip-grid">${permissionFlags(current, state)}</div>
      </section>`;
  }

  function activity() {
    ensureActivityLoaded();
    return `
      <section class="panel profile-panel">
        <div class="profile-panel-heading">
          <h2>Atividade</h2>
          <button class="button button-secondary" type="button" data-profile-refresh-activity>Atualizar</button>
        </div>
        <div class="profile-activity-list ${state.activityLogsLoading ? "is-loading" : ""}">
          ${state.activityLogsLoading ? `<div class="profile-empty-state">Carregando atividades...</div>` : activityRows(state.activityLogs || [])}
        </div>
      </section>`;
  }

  function security() {
    const current = profile();
    return `
      <section class="profile-grid">
        <article class="panel profile-panel">
          <h2>Login</h2>
          <div class="profile-detail-grid">
            ${detail("E-mail de login", state.session?.user?.email || current.email)}
            ${detail("Último login", formatDateTime(current.last_login_at))}
            ${detail("Sessões ativas", "Sessão atual")}
            ${detail("Autenticação em dois fatores", "Futuro")}
          </div>
        </article>
        <article class="panel profile-panel">
          <h2>Senha</h2>
          <p class="section-subtitle">Use uma senha forte. A alteração é aplicada pelo Supabase Auth.</p>
          <button class="button button-primary" type="button" data-profile-password>Alterar senha</button>
        </article>
      </section>`;
  }

  function preferences() {
    const current = profile();
    const prefs = current.preferences || {};
    return `
      <form class="panel profile-panel profile-preferences-form" data-profile-preferences-form>
        <h2>Preferências</h2>
        <div class="form-grid">
          <label class="field">
            <span>Tema</span>
            <select class="select" name="theme">
              ${selectOptions([["dark", "Escuro"], ["system", "Sistema"]], prefs.theme || "dark")}
            </select>
          </label>
          <label class="field">
            <span>Densidade da interface</span>
            <select class="select" name="density">
              ${selectOptions([["comfortable", "Confortável"], ["compact", "Compacta"]], prefs.density || "comfortable")}
            </select>
          </label>
          <label class="field">
            <span>Página inicial padrão</span>
            <select class="select" name="home_page">
              ${selectOptions([["home", "Dashboard"], ["crm/clients", "Clientes"], ["crm/budgets", "Orçamentos"], ["users", "Usuários"]], prefs.home_page || "home")}
            </select>
          </label>
          <label class="field">
            <span>Notificações</span>
            <select class="select" name="notifications">
              ${selectOptions([["true", "Ativas"], ["false", "Desativadas"]], String(prefs.notifications !== false))}
            </select>
          </label>
          <label class="field">
            <span>Fuso horário</span>
            <input class="input" name="timezone" value="${escapeHtml(prefs.timezone || "America/Sao_Paulo")}">
          </label>
        </div>
        <div class="form-actions">
          <button class="button button-primary" type="submit">Salvar preferências</button>
        </div>
      </form>`;
  }

  function tabContent() {
    const tab = activeTab();
    if (tab === "personal") return personal();
    if (tab === "professional") return professional();
    if (tab === "permissions") return permissions();
    if (tab === "activity") return activity();
    if (tab === "security") return security();
    if (tab === "preferences") return preferences();
    return overview();
  }

  function renderProfilePage() {
    if (!state.currentUserProfile?.id) {
      getCurrentUserProfile({ touchLastLogin: false }).then(() => render());
    }
    if (["overview", "activity"].includes(activeTab())) ensureActivityLoaded();
    renderShell(`
      <main class="page profile-page">
        ${header()}
        ${tabs()}
        ${tabContent()}
      </main>`);
  }

  function editProfileModal() {
    const current = profile();
    state.modal = `
      <div class="modal-backdrop">
        <form class="modal modal-wide" data-profile-form>
          <div class="modal-header">
            <div>
              <span class="eyebrow">Meu perfil</span>
              <h2>Editar dados pessoais</h2>
              <p class="section-subtitle">Cargo, custos e permissões são alterados pela tela Usuários.</p>
            </div>
            <button class="button button-ghost" type="button" data-close-modal>Fechar</button>
          </div>
          <div class="form-grid user-form-grid">
            <label class="field"><span>Nome completo</span><input class="input" name="full_name" value="${escapeHtml(current.full_name || "")}" required></label>
            <label class="field"><span>Nome de exibição</span><input class="input" name="display_name" value="${escapeHtml(current.display_name || "")}"></label>
            <label class="field"><span>CPF</span><input class="input" name="cpf" value="${escapeHtml(current.cpf || "")}"></label>
            <label class="field"><span>Data de nascimento</span><input class="input" type="date" name="birth_date" value="${escapeHtml(current.birth_date || "")}"></label>
            <label class="field"><span>Telefone</span><input class="input" name="phone" value="${escapeHtml(current.phone || "")}"></label>
            <label class="field"><span>WhatsApp</span><input class="input" name="whatsapp" value="${escapeHtml(current.whatsapp || "")}"></label>
            <label class="field"><span>E-mail</span><input class="input" name="email" value="${escapeHtml(current.email || "")}" readonly></label>
            <label class="field"><span>Endereço</span><input class="input" name="address" value="${escapeHtml(current.address || "")}"></label>
            <label class="field"><span>Cidade</span><input class="input" name="city" value="${escapeHtml(current.city || "")}"></label>
            <label class="field"><span>Estado</span><input class="input" name="state" value="${escapeHtml(current.state || "")}"></label>
            <label class="field"><span>CEP</span><input class="input" name="zip_code" value="${escapeHtml(current.zip_code || "")}"></label>
          </div>
          <div class="form-actions">
            <button class="button button-primary" type="submit">Salvar perfil</button>
            <button class="button button-ghost" type="button" data-close-modal>Cancelar</button>
          </div>
        </form>
      </div>`;
    render();
  }

  function passwordModal() {
    state.modal = `
      <div class="modal-backdrop">
        <form class="modal" data-profile-password-form>
          <div class="modal-header">
            <div>
              <span class="eyebrow">Segurança</span>
              <h2>Alterar senha</h2>
              <p class="section-subtitle">A senha será atualizada no Supabase Auth.</p>
            </div>
          </div>
          <label class="field">
            <span>Nova senha</span>
            <input class="input" name="password" type="password" autocomplete="new-password" minlength="8" required>
          </label>
          <label class="field">
            <span>Confirmar senha</span>
            <input class="input" name="password_confirm" type="password" autocomplete="new-password" minlength="8" required>
          </label>
          <div class="form-actions">
            <button class="button button-primary" type="submit">Alterar senha</button>
            <button class="button button-ghost" type="button" data-close-modal>Cancelar</button>
          </div>
        </form>
      </div>`;
    render();
  }

  async function submitProfileForm(form) {
    const data = new FormData(form);
    const oldValue = { ...profile() };
    const payload = Object.fromEntries(data.entries());
    const result = await saveOwnProfile(payload);
    if (result.error) {
      setNotice("error", result.error.message || "Não foi possível salvar perfil.", { route: "profile" });
      return;
    }
    await logActivity("editou perfil", "perfil", "profile", result.data?.id || "", "Atualizou dados pessoais do próprio perfil.", oldValue, result.data);
    state.modal = null;
    setNotice("success", "Perfil atualizado.", { route: "profile" });
    renderProfilePage();
  }

  async function submitPreferencesForm(form) {
    const data = new FormData(form);
    const payload = {
      theme: data.get("theme"),
      density: data.get("density"),
      home_page: data.get("home_page"),
      notifications: data.get("notifications") === "true",
      timezone: data.get("timezone"),
    };
    const oldValue = profile().preferences || {};
    const result = await saveOwnPreferences(payload);
    if (result.error) {
      setNotice("error", result.error.message || "Não foi possível salvar preferências.", { route: "profile/preferences" });
      return;
    }
    await logActivity("alterou preferências", "perfil", "profile", result.data?.id || "", "Atualizou preferências de interface.", oldValue, result.data?.preferences || payload);
    setNotice("success", "Preferências salvas.", { route: "profile/preferences" });
    renderProfilePage();
  }

  async function submitPasswordForm(form) {
    const data = new FormData(form);
    const password = String(data.get("password") || "");
    const confirm = String(data.get("password_confirm") || "");
    if (password !== confirm) {
      setNotice("error", "As senhas não conferem.", { route: "profile/security" });
      return;
    }
    const result = await updateCurrentUserPassword(password);
    if (result.error) {
      setNotice("error", result.error.message || "Não foi possível alterar a senha.", { route: "profile/security" });
      return;
    }
    await logActivity("alterou senha", "segurança", "auth_user", state.session?.user?.id || "", "Alterou a própria senha.", null, { changed: true });
    state.modal = null;
    setNotice("success", "Senha alterada.", { route: "profile/security" });
    renderProfilePage();
  }

  async function refreshActivity() {
    state.activityLogsLoaded = false;
    state.activityLogsLoading = false;
    ensureActivityLoaded();
  }

  async function signOut() {
    await logActivity("fez logout", "auth", "auth_user", state.session?.user?.id || "", "Saiu da plataforma RAKSA.", null, null);
    if (getSupabase()) await getSupabase().auth.signOut();
    state.session = null;
    state.currentUserProfile = null;
    window.location.hash = "#/";
    render();
  }

  return {
    editProfileModal,
    passwordModal,
    refreshActivity,
    renderProfilePage,
    signOut,
    submitPasswordForm,
    submitPreferencesForm,
    submitProfileForm,
  };
}
