import {
  EMPLOYMENT_TYPES,
  HIERARCHY_LEVELS,
  SUPER_ADMIN_EMAILS,
  USER_ROLES,
  USER_STATUSES,
} from "./constants.js?v=20";
import {
  canCreateUser,
  canDeactivateUser,
  canEditUser,
  canManageUsers,
  isSuperAdmin,
} from "./permissions.js?v=2";
import { escapeHtml } from "./utils.js?v=3";

const STATUS_LABELS = Object.fromEntries(USER_STATUSES);
const ROLE_LABELS = Object.fromEntries(USER_ROLES);
const EMPLOYMENT_LABELS = Object.fromEntries(EMPLOYMENT_TYPES);

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function formatDateTime(value) {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nunca";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" }).format(Number(value || 0));
}

function initialsFor(profile = {}) {
  const source = profile.display_name || profile.full_name || profile.email || "U";
  return String(source).trim().slice(0, 1).toUpperCase() || "U";
}

function roleOptions(value) {
  return USER_ROLES.map(([key, label]) => `<option value="${key}" ${value === key ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function statusOptions(value) {
  return USER_STATUSES.map(([key, label]) => `<option value="${key}" ${value === key ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function employmentOptions(value) {
  return [`<option value="">Não informado</option>`]
    .concat(EMPLOYMENT_TYPES.map(([key, label]) => `<option value="${key}" ${value === key ? "selected" : ""}>${escapeHtml(label)}</option>`))
    .join("");
}

function supervisorOptions(users = [], selectedId = "", currentId = "") {
  const rows = users
    .filter((profile) => profile.id !== currentId && profile.status === "active")
    .map((profile) => `<option value="${escapeHtml(profile.id)}" ${selectedId === profile.id ? "selected" : ""}>${escapeHtml(profile.display_name || profile.full_name || profile.email)}</option>`);
  return [`<option value="">Sem supervisor</option>`, ...rows].join("");
}

function protectedRootProfile(profile = {}) {
  return SUPER_ADMIN_EMAILS.includes(normalizeEmail(profile.email));
}

function profileName(profile = {}) {
  return profile.display_name || profile.full_name || profile.email || "Usuário";
}

export function createUsersModule({
  state,
  render,
  renderShell,
  setNotice,
  loadUserProfiles,
  createUserProfile,
  saveUserProfile,
  setUserProfileStatus,
  permissions,
}) {
  function users() {
    return Array.isArray(state.userProfiles) ? state.userProfiles : [];
  }

  function ensureUsersLoaded() {
    if (state.userProfilesLoaded || state.userProfilesLoading) return;
    loadUserProfiles().then(({ error }) => {
      if (error) setNotice("error", error.message || "Não foi possível carregar usuários.", { route: "users" });
      render();
    }).catch((error) => {
      setNotice("error", error.message || "Não foi possível carregar usuários.", { route: "users" });
      render();
    });
  }

  function summaryCards() {
    const rows = users();
    const admins = rows.filter((profile) => ["super_admin", "admin"].includes(profile.access_level) || Number(profile.hierarchy_level || 0) >= HIERARCHY_LEVELS.admin).length;
    const data = [
      ["Total de usuários", rows.length],
      ["Usuários ativos", rows.filter((profile) => profile.status === "active").length],
      ["Usuários inativos", rows.filter((profile) => ["inactive", "suspended"].includes(profile.status)).length],
      ["Administradores", admins],
      ["Convites pendentes", rows.filter((profile) => profile.status === "pending" || !profile.auth_user_id).length],
    ];
    return data.map(([label, value]) => `
      <article class="user-summary-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(String(value))}</strong>
      </article>`).join("");
  }

  function rowActions(profile) {
    const canEdit = permissions.canEditUser(state, profile);
    const canStatus = permissions.canDeactivateUser(state, profile);
    const inactive = profile.status === "inactive" || profile.status === "suspended";
    return `
      <div class="table-actions">
        <button class="button button-ghost button-small" type="button" data-view-user="${escapeHtml(profile.id)}">Ver</button>
        <button class="button button-secondary button-small" type="button" data-edit-user="${escapeHtml(profile.id)}" ${canEdit ? "" : "disabled"}>Editar</button>
        <button class="button button-secondary button-small" type="button" data-permissions-user="${escapeHtml(profile.id)}" ${canEdit ? "" : "disabled"}>Permissões</button>
        <button class="button ${inactive ? "button-secondary" : "button-danger"} button-small" type="button" data-user-status="${escapeHtml(profile.id)}:${inactive ? "active" : "inactive"}" ${canStatus ? "" : "disabled"}>${inactive ? "Reativar" : "Desativar"}</button>
      </div>`;
  }

  function userRows() {
    if (state.userProfilesLoading) {
      return `<tr><td colspan="8">Carregando usuários...</td></tr>`;
    }
    if (!users().length) {
      return `<tr><td colspan="8">Nenhum usuário cadastrado.</td></tr>`;
    }
    return users().map((profile) => `
      <tr>
        <td>
          <span class="user-cell">
            <span class="profile-avatar user-table-avatar" aria-hidden="true">
              ${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="">` : `<span>${escapeHtml(initialsFor(profile))}</span>`}
            </span>
            <span>
              <strong>${escapeHtml(profileName(profile))}</strong>
              <span>${escapeHtml(profile.full_name || profile.email)}</span>
            </span>
          </span>
        </td>
        <td>${escapeHtml(profile.email || "-")}</td>
        <td><strong>${escapeHtml(ROLE_LABELS[profile.role] || profile.role || "-")}</strong></td>
        <td>${escapeHtml(profile.department || "-")}</td>
        <td><span class="status-pill">${escapeHtml(ROLE_LABELS[profile.access_level] || profile.access_level || "-")}</span></td>
        <td><span class="status-pill user-status-${escapeHtml(profile.status)}">${escapeHtml(STATUS_LABELS[profile.status] || profile.status || "-")}</span></td>
        <td>${escapeHtml(formatDateTime(profile.last_login_at))}</td>
        <td>${rowActions(profile)}</td>
      </tr>`).join("");
  }

  function renderUsersPage() {
    ensureUsersLoaded();
    renderShell(`
      <main class="page users-page">
        <section class="page-header">
          <div class="page-title">
            <h1>Usuários</h1>
            <p class="section-subtitle">Gerencie colaboradores, cargos, acessos e permissões da plataforma.</p>
          </div>
          <button class="button button-primary" type="button" data-open-user-modal ${canCreateUser(state) ? "" : "disabled"}>Novo usuário</button>
        </section>

        <section class="users-summary-grid">
          ${summaryCards()}
        </section>

        <section class="panel data-panel users-table-panel">
          <div class="panel-heading">
            <div>
              <h2>Base de usuários</h2>
              <p class="section-subtitle">Contas internas vinculadas ou preparadas para vínculo com o Supabase Auth.</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data-table users-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Cargo</th>
                  <th>Departamento</th>
                  <th>Acesso</th>
                  <th>Status</th>
                  <th>Último acesso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>${userRows()}</tbody>
            </table>
          </div>
        </section>
      </main>`);
  }

  function userForm(profile = {}, { mode = "create" } = {}) {
    const isCreate = mode === "create";
    const canEditRoot = isSuperAdmin(state) || !protectedRootProfile(profile);
    const role = profile.role || "viewer";
    const accessLevel = profile.access_level || role;
    const status = profile.status || "pending";
    const hierarchy = profile.hierarchy_level ?? HIERARCHY_LEVELS[accessLevel] ?? 10;
    return `
      <div class="modal-backdrop" data-user-modal-backdrop>
        <form class="modal modal-wide user-modal" data-user-form="${isCreate ? "create" : escapeHtml(profile.id)}">
          <div class="modal-header">
            <div>
              <span class="eyebrow">${isCreate ? "Novo acesso" : "Editar usuário"}</span>
              <h2>${isCreate ? "Novo usuário" : escapeHtml(profileName(profile))}</h2>
              <p class="section-subtitle">${isCreate ? "A criação de Auth deve rodar pela Edge Function segura; sem ela, o perfil fica pendente." : "Atualize dados profissionais, permissões e status."}</p>
            </div>
            <button class="button button-ghost" type="button" data-close-modal>Fechar</button>
          </div>

          <div class="form-grid user-form-grid">
            <label class="field">
              <span>Nome completo</span>
              <input class="input" name="full_name" value="${escapeHtml(profile.full_name || "")}" required>
            </label>
            <label class="field">
              <span>Nome de exibição</span>
              <input class="input" name="display_name" value="${escapeHtml(profile.display_name || "")}">
            </label>
            <label class="field">
              <span>E-mail</span>
              <input class="input" name="email" type="email" value="${escapeHtml(profile.email || "")}" ${isCreate ? "" : "readonly"} required>
            </label>
            <label class="field">
              <span>Telefone</span>
              <input class="input" name="phone" value="${escapeHtml(profile.phone || "")}">
            </label>
            <label class="field">
              <span>WhatsApp</span>
              <input class="input" name="whatsapp" value="${escapeHtml(profile.whatsapp || "")}">
            </label>
            <label class="field">
              <span>Cargo</span>
              <select class="select" name="role" ${canEditRoot ? "" : "disabled"}>${roleOptions(role)}</select>
            </label>
            <label class="field">
              <span>Departamento</span>
              <input class="input" name="department" value="${escapeHtml(profile.department || "")}">
            </label>
            <label class="field">
              <span>Tipo de vínculo</span>
              <select class="select" name="employment_type">${employmentOptions(profile.employment_type || "")}</select>
            </label>
            <label class="field">
              <span>Nível hierárquico</span>
              <input class="input" name="hierarchy_level" type="number" min="0" max="100" step="1" value="${escapeHtml(String(hierarchy))}" ${canEditRoot ? "" : "readonly"}>
            </label>
            <label class="field">
              <span>Nível de acesso</span>
              <select class="select" name="access_level" ${canEditRoot ? "" : "disabled"}>${roleOptions(accessLevel)}</select>
            </label>
            <label class="field">
              <span>Status</span>
              <select class="select" name="status" ${canEditRoot ? "" : "disabled"}>${statusOptions(status)}</select>
            </label>
            <label class="field">
              <span>Supervisor/responsável</span>
              <select class="select" name="supervisor_id">${supervisorOptions(users(), profile.supervisor_id || "", profile.id || "")}</select>
            </label>
            <label class="field">
              <span>Carga horária semanal</span>
              <input class="input" name="weekly_hours" type="number" min="0" step="0.01" value="${escapeHtml(String(profile.weekly_hours || 0))}">
            </label>
            <label class="field">
              <span>Valor hora interno</span>
              <input class="input" name="internal_hourly_rate" type="number" min="0" step="0.01" value="${escapeHtml(String(profile.internal_hourly_rate || 0))}">
            </label>
            <label class="field">
              <span>Custo mensal estimado</span>
              <input class="input" name="monthly_cost" type="number" min="0" step="0.01" value="${escapeHtml(String(profile.monthly_cost || 0))}">
            </label>
            <label class="field">
              <span>Meta de horas produtivas/mês</span>
              <input class="input" name="productive_hours_goal" type="number" min="0" step="0.01" value="${escapeHtml(String(profile.productive_hours_goal || 0))}">
            </label>
          </div>

          <label class="field">
            <span>Observações internas</span>
            <textarea class="textarea" name="internal_notes" rows="4">${escapeHtml(profile.internal_notes || "")}</textarea>
          </label>
          ${canEditRoot ? "" : `
            <input type="hidden" name="role" value="${escapeHtml(role)}">
            <input type="hidden" name="access_level" value="${escapeHtml(accessLevel)}">
            <input type="hidden" name="status" value="${escapeHtml(status)}">
          `}

          <div class="notice notice-warning is-visible">
            A chave service_role nunca deve ir para o frontend. A criação real no Supabase Auth usa a Edge Function create-user; sem deploy/configuração dela, este formulário salva apenas um perfil pendente.
          </div>

          <div class="form-actions">
            <button class="button button-primary ${state.userProfileSaving ? "is-loading" : ""}" type="submit" ${state.userProfileSaving ? "disabled" : ""}>
              ${state.userProfileSaving ? `<span class="spinner" aria-hidden="true"></span><span>Salvando...</span>` : isCreate ? "Criar usuário" : "Salvar alterações"}
            </button>
            <button class="button button-ghost" type="button" data-close-modal>Cancelar</button>
          </div>
        </form>
      </div>`;
  }

  function userDetails(profile = {}) {
    return `
      <div class="modal-backdrop">
        <div class="modal modal-wide">
          <div class="modal-header">
            <div>
              <span class="eyebrow">${escapeHtml(STATUS_LABELS[profile.status] || profile.status || "Perfil")}</span>
              <h2>${escapeHtml(profileName(profile))}</h2>
              <p class="section-subtitle">${escapeHtml(profile.email || "")}</p>
            </div>
            <button class="button button-ghost" type="button" data-close-modal>Fechar</button>
          </div>
          <div class="detail-grid">
            <div class="detail-item"><span>Cargo</span><strong>${escapeHtml(ROLE_LABELS[profile.role] || profile.role || "-")}</strong></div>
            <div class="detail-item"><span>Departamento</span><strong>${escapeHtml(profile.department || "-")}</strong></div>
            <div class="detail-item"><span>Acesso</span><strong>${escapeHtml(ROLE_LABELS[profile.access_level] || profile.access_level || "-")}</strong></div>
            <div class="detail-item"><span>Hierarquia</span><strong>${escapeHtml(String(profile.hierarchy_level || 0))}</strong></div>
            <div class="detail-item"><span>Vínculo</span><strong>${escapeHtml(EMPLOYMENT_LABELS[profile.employment_type] || profile.employment_type || "-")}</strong></div>
            <div class="detail-item"><span>Último acesso</span><strong>${escapeHtml(formatDateTime(profile.last_login_at))}</strong></div>
            <div class="detail-item"><span>Carga semanal</span><strong>${escapeHtml(String(profile.weekly_hours || 0))}h</strong></div>
            <div class="detail-item"><span>Valor hora</span><strong>${escapeHtml(formatMoney(profile.internal_hourly_rate))}</strong></div>
            <div class="detail-item"><span>Custo mensal</span><strong>${escapeHtml(formatMoney(profile.monthly_cost))}</strong></div>
          </div>
          <div class="panel user-notes-panel">
            <h3>Observações internas</h3>
            <p>${escapeHtml(profile.internal_notes || "Sem observações.")}</p>
          </div>
        </div>
      </div>`;
  }

  function openUserModal(id = "", mode = "edit") {
    const profile = id ? users().find((item) => item.id === id) : null;
    if (id && !profile) return;
    if (profile && !canEditUser(state, profile)) {
      setNotice("error", "Permissão insuficiente para editar este usuário.", { route: "users" });
      return;
    }
    state.modal = userForm(profile || {}, { mode: id ? mode : "create" });
    render();
  }

  function openUserDetails(id) {
    const profile = users().find((item) => item.id === id);
    if (!profile) return;
    state.modal = userDetails(profile);
    render();
  }

  function payloadFromForm(form) {
    const data = new FormData(form);
    return {
      full_name: data.get("full_name"),
      display_name: data.get("display_name"),
      email: data.get("email"),
      phone: data.get("phone"),
      whatsapp: data.get("whatsapp"),
      role: data.get("role"),
      department: data.get("department"),
      employment_type: data.get("employment_type"),
      hierarchy_level: data.get("hierarchy_level"),
      access_level: data.get("access_level"),
      status: data.get("status"),
      supervisor_id: data.get("supervisor_id"),
      weekly_hours: data.get("weekly_hours"),
      internal_hourly_rate: data.get("internal_hourly_rate"),
      monthly_cost: data.get("monthly_cost"),
      productive_hours_goal: data.get("productive_hours_goal"),
      internal_notes: data.get("internal_notes"),
    };
  }

  async function submitUserForm(form) {
    const mode = form.dataset.userForm;
    const isCreate = mode === "create";
    if (isCreate && !canCreateUser(state)) {
      setNotice("error", "Permissão insuficiente para criar usuários.", { route: "users" });
      return;
    }

    const profile = isCreate ? null : users().find((item) => item.id === mode);
    if (!isCreate && !canEditUser(state, profile)) {
      setNotice("error", "Permissão insuficiente para editar este usuário.", { route: "users" });
      return;
    }

    state.userProfileSaving = true;
    const result = isCreate
      ? await createUserProfile(payloadFromForm(form))
      : await saveUserProfile(mode, { ...profile, ...payloadFromForm(form) });
    state.userProfileSaving = false;

    if (result.error) {
      setNotice("error", result.error.message || "Não foi possível salvar usuário.", { route: "users" });
      renderUsersPage();
      return;
    }

    state.modal = null;
    await loadUserProfiles({ force: true });
    setNotice("success", result.authPending ? "Perfil criado como pendente. Configure/deploy a Edge Function para criar Auth." : "Usuário salvo.", { route: "users" });
    renderUsersPage();
  }

  async function changeUserStatus(id, status) {
    const profile = users().find((item) => item.id === id);
    if (!profile || !canDeactivateUser(state, profile)) {
      setNotice("error", "Permissão insuficiente para alterar status deste usuário.", { route: "users" });
      return;
    }
    state.userProfileSaving = true;
    const result = await setUserProfileStatus(id, status);
    state.userProfileSaving = false;
    if (result.error) setNotice("error", result.error.message || "Não foi possível alterar status.", { route: "users" });
    else {
      await loadUserProfiles({ force: true });
      setNotice("success", status === "active" ? "Usuário reativado." : "Usuário desativado.", { route: "users" });
    }
    renderUsersPage();
  }

  return {
    changeUserStatus,
    openUserDetails,
    openUserModal,
    renderUsersPage,
    submitUserForm,
  };
}
