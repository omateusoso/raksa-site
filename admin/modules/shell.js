import { logo } from "./constants.js?v=9";
import { escapeHtml } from "./utils.js?v=3";

export function createShellModule({ app, state, getSupabase }) {
  function renderLogin(error = "") {
    const supabase = getSupabase();
    app.innerHTML = `
      <section class="login-screen">
        <form class="login-card ${state.authLoading ? "is-loading" : ""}" data-login-form aria-busy="${state.authLoading ? "true" : "false"}">
          ${logo}
          <div class="login-copy">
            <span class="eyebrow">Admin</span>
            <h1>Entrar na plataforma</h1>
            <p>Acesse com e-mail e senha para gerenciar os cases da RAKSA.</p>
          </div>
          <div class="form-stack">
            <label class="field">
              <span>E-mail</span>
              <input class="input" name="email" type="email" inputmode="email" autocomplete="email" ${state.authLoading ? "disabled" : ""} required>
            </label>
            <label class="field">
              <span>Senha</span>
              <input class="input" name="password" type="password" autocomplete="current-password" ${state.authLoading ? "disabled" : ""} required>
            </label>
            <div class="notice notice-error ${error || !supabase ? "is-visible" : ""}">
              ${escapeHtml(error || (!supabase ? "Configure a anon key do Supabase em /admin/supabase-config.js." : ""))}
            </div>
            <button class="button button-primary ${state.authLoading ? "is-loading" : ""}" type="submit" ${supabase && !state.authLoading ? "" : "disabled"}>
              ${state.authLoading ? `<span class="spinner" aria-hidden="true"></span><span>Entrando...</span>` : "Entrar"}
            </button>
          </div>
        </form>
      </section>`;
  }

  function currentSection() {
    return window.location.hash.replace(/^#\/?/, "").split("/")[0] || "home";
  }

  function currentCrmTab() {
    const [section, slug] = window.location.hash.replace(/^#\/?/, "").split("/");
    if (section !== "crm") return "";
    return slug || "clients";
  }

  function renderSidebarLink(href, label, active) {
    return `
      <a class="sidebar-link ${active ? "is-active" : ""}" href="${escapeHtml(href)}">
        <span>${escapeHtml(label)}</span>
      </a>`;
  }

  function renderSidebarCategory(label) {
    return `<span class="sidebar-category">${escapeHtml(label)}</span>`;
  }

  function userProfile() {
    const user = state.session?.user || {};
    const email = user.email || "";
    const name = user.user_metadata?.name || user.user_metadata?.full_name || email.split("@")[0] || "Usuário";
    const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
    const initials = String(name || email || "U").trim().slice(0, 1).toUpperCase() || "U";
    return { avatar, email, initials, name };
  }

  function renderProfileBlock({ compact = false } = {}) {
    const profile = userProfile();
    return `
      <div class="${compact ? "sidebar-profile" : "platform-profile-card"}">
        <a class="profile-view" href="#/home" aria-label="Ver perfil">
          <span class="profile-avatar" aria-hidden="true">
            ${profile.avatar ? `<img src="${escapeHtml(profile.avatar)}" alt="">` : `<span>${escapeHtml(profile.initials)}</span>`}
          </span>
          <span class="profile-copy">
            <strong>Ver perfil</strong>
            <small>${escapeHtml(profile.email || profile.name)}</small>
          </span>
        </a>
        <button class="button button-ghost" type="button" data-logout>Log out</button>
      </div>`;
  }

  function renderPlatformSidebar() {
    const section = currentSection();
    const crmTab = currentCrmTab();
    const cmsLinks = [
      ["#/cases", "Cases", section === "cases"],
      ["#/site-home", "Página inicial", section === "site-home"],
    ];
    const crmLinks = [
      ["#/crm/clients", "Clientes", crmTab === "clients"],
      ["#/crm/budgets", "Orçamentos", crmTab === "budgets"],
      ["#/crm/orders", "Ordens de serviço", crmTab === "orders"],
      ["#/crm/products", "Produtos", crmTab === "products"],
      ["#/crm/substrates", "Substratos", crmTab === "substrates"],
    ];

    return `
      <aside class="module-sidebar platform-sidebar" aria-label="Navegação da plataforma">
        <div class="sidebar-brand">
          <a href="#/home" aria-label="Voltar para início">${logo}</a>
          <span>Admin</span>
        </div>
        <nav class="sidebar-nav">
          ${renderSidebarLink("#/home", "Página inicial", section === "home")}
          ${renderSidebarCategory("CMS")}
          ${cmsLinks.map(([href, label, active]) => renderSidebarLink(href, label, active)).join("")}
          ${renderSidebarCategory("CRM")}
          ${crmLinks.map(([href, label, active]) => renderSidebarLink(href, label, active)).join("")}
        </nav>
        ${renderProfileBlock({ compact: true })}
      </aside>`;
  }

  function renderShell(content) {
    const sidebar = renderPlatformSidebar();
    app.innerHTML = `
      <section class="admin-shell has-sidebar">
        <div class="admin-layout">
          ${sidebar}
          <div class="module-main">
            ${content}
          </div>
        </div>
        ${state.modal || ""}
      </section>`;
  }

  function renderComingSoon(section) {
    const labels = {
      home: "Dashboard",
      cases: "CMS",
      "site-home": "Página inicial",
      crm: "CRM",
    };
    renderShell(`
      <main class="page">
        <section class="page-header">
          <div class="page-title">
            <span class="eyebrow">${escapeHtml(labels[section] || "Admin")}</span>
            <h1>Módulo em preparação</h1>
            <p class="section-subtitle">A navegação e o banco já estão reservados para esta área.</p>
          </div>
        </section>
        <section class="panel roadmap-panel">
          <h2>Proximo passo</h2>
          <p class="section-subtitle">Aqui entram tabelas, formulários, permissões e relatórios sem misturar os módulos.</p>
        </section>
      </main>`);
  }

  return { currentSection, renderPlatformSidebar, renderComingSoon, renderLogin, renderProfileBlock, renderShell };
}
