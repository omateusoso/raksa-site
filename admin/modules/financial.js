import { escapeHtml } from "./utils.js?v=3";

const DEFAULT_SETTINGS = {
  hourly_rate: 70,
  default_markup_percent: 30,
  default_tax_percent: 6,
  currency: "BRL",
};

function numericValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function inputValue(value, fallback) {
  const number = numericValue(value, fallback);
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

export function createFinancialModule({
  state,
  render,
  renderShell,
  setNotice,
  loadFinancialSettings,
  saveFinancialSettings,
}) {
  function settings() {
    return {
      ...DEFAULT_SETTINGS,
      ...(state.financialSettings || {}),
    };
  }

  function renderFinancePage() {
    if (!state.financialSettingsLoaded && !state.financialSettingsLoading && !state.financialSettingsLoadError) {
      loadFinancialSettings().then(({ error }) => {
        state.financialSettingsLoadError = error?.message || "";
        if (error) setNotice("error", error.message || "Nao foi possivel carregar as configuracoes financeiras.", { route: "financeiro" });
        render();
      }).catch((error) => {
        state.financialSettingsLoadError = error?.message || "Nao foi possivel carregar as configuracoes financeiras.";
        setNotice("error", state.financialSettingsLoadError, { route: "financeiro" });
        render();
      });
    }

    const current = settings();
    const loading = state.financialSettingsLoading;
    const saving = state.financialSettingsSaving;
    const loadError = state.financialSettingsLoadError;

    renderShell(`
      <main class="page finance-settings-page">
        <section class="page-header">
          <div class="page-title">
            <h1>Configurações Financeiras</h1>
            <p class="section-subtitle">Defina os valores globais que serão usados nas próximas etapas da precificação.</p>
          </div>
        </section>

        <form class="panel form-stack finance-settings-form ${saving ? "is-saving" : ""}" data-financial-form aria-busy="${saving || loading ? "true" : "false"}">
          <div class="panel-heading">
            <div>
              <h2>Parâmetros globais</h2>
              <p class="section-subtitle">Esses dados ficam salvos como configuração única da plataforma.</p>
            </div>
          </div>

          <div class="notice notice-error ${loadError ? "is-visible" : ""}">
            ${escapeHtml(loadError)}
          </div>

          <div class="form-grid">
            <label class="field">
              <span>Valor hora padrão</span>
              <span class="affix-field">
                <span class="field-affix" aria-hidden="true">R$</span>
                <input class="input" name="hourly_rate" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(inputValue(current.hourly_rate, DEFAULT_SETTINGS.hourly_rate))}" placeholder="70,00" ${loading || saving || loadError ? "disabled" : ""} required>
              </span>
            </label>

            <label class="field">
              <span>Markup padrão</span>
              <span class="affix-field">
                <input class="input" name="default_markup_percent" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(inputValue(current.default_markup_percent, DEFAULT_SETTINGS.default_markup_percent))}" placeholder="30" ${loading || saving || loadError ? "disabled" : ""} required>
                <span class="field-affix" aria-hidden="true">%</span>
              </span>
            </label>

            <label class="field">
              <span>Imposto padrão</span>
              <span class="affix-field">
                <input class="input" name="default_tax_percent" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHtml(inputValue(current.default_tax_percent, DEFAULT_SETTINGS.default_tax_percent))}" placeholder="6" ${loading || saving || loadError ? "disabled" : ""} required>
                <span class="field-affix" aria-hidden="true">%</span>
              </span>
            </label>

            <label class="field">
              <span>Moeda</span>
              <select class="select" name="currency" ${loading || saving || loadError ? "disabled" : ""} required>
                <option value="BRL" ${current.currency === "BRL" ? "selected" : ""}>BRL</option>
              </select>
            </label>
          </div>

          <div class="form-actions">
            <button class="button button-primary ${saving ? "is-loading" : ""}" type="submit" ${loading || saving || loadError ? "disabled" : ""}>
              ${saving ? `<span class="spinner" aria-hidden="true"></span><span>Salvando...</span>` : "Salvar configurações"}
            </button>
            <span class="meta">${loading ? "Carregando configurações..." : `Ultima atualizacao: ${escapeHtml(current.updated_at ? new Date(current.updated_at).toLocaleString("pt-BR") : "ainda nao salva")}`}</span>
          </div>
        </form>
      </main>`);
  }

  async function submitFinancialSettings(form) {
    if (state.financialSettingsSaving) return;
    state.financialSettingsLoadError = "";
    const data = new FormData(form);
    const payload = {
      hourly_rate: numericValue(data.get("hourly_rate"), DEFAULT_SETTINGS.hourly_rate),
      default_markup_percent: numericValue(data.get("default_markup_percent"), DEFAULT_SETTINGS.default_markup_percent),
      default_tax_percent: numericValue(data.get("default_tax_percent"), DEFAULT_SETTINGS.default_tax_percent),
      currency: String(data.get("currency") || DEFAULT_SETTINGS.currency),
    };

    state.financialSettingsSaving = true;
    renderFinancePage();

    const { error } = await saveFinancialSettings(payload);
    state.financialSettingsSaving = false;

    if (error) {
      setNotice("error", error.message || "Nao foi possivel salvar as configuracoes financeiras.", { route: "financeiro" });
    } else {
      setNotice("success", "Configurações financeiras salvas.", { route: "financeiro" });
    }

    renderFinancePage();
  }

  return { renderFinancePage, submitFinancialSettings };
}
