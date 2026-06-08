import { escapeHtml, formatDate } from "./utils.js?v=3";

export function createMetricsModule({ state, renderShell, renderCrmNotice }) {
  function renderMetricsPage() {
    const byEvent = new Map();
    const byPath = new Map();
    for (const event of state.metricsEvents) {
      byEvent.set(event.event_name, (byEvent.get(event.event_name) || 0) + 1);
      if (event.path) byPath.set(event.path, (byPath.get(event.path) || 0) + 1);
    }
    const topEvents = [...byEvent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const topPaths = [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    renderShell(`
      <main class="page">
        <section class="page-header">
          <div class="page-title">
            <h1>Eventos do site</h1>
            <p class="section-subtitle">${state.metricsEvents.length} eventos recentes carregados</p>
          </div>
        </section>

        ${renderCrmNotice()}

        <section class="metrics" aria-label="Resumo de metricas">
          <div class="metric">
            <strong>${state.metricsEvents.length}</strong>
            <span>Eventos recentes</span>
          </div>
          ${topEvents.map(([name, count]) => `
            <div class="metric">
              <strong>${count}</strong>
              <span>${escapeHtml(name)}</span>
            </div>
          `).join("")}
        </section>

        <section class="data-layout data-layout-even">
          <section class="panel data-panel">
            <div class="page-title">
              <h2>Páginas</h2>
              <p class="section-subtitle">Caminhos mais registrados.</p>
            </div>
            ${topPaths.length ? `
              <div class="compact-list">
                ${topPaths.map(([path, count]) => `
                  <div class="compact-row">
                    <span>${escapeHtml(path)}</span>
                    <strong>${count}</strong>
                  </div>
                `).join("")}
              </div>
            ` : `<div class="empty-state">Nenhum evento de pagina registrado.</div>`}
          </section>

          <section class="panel data-panel">
            <div class="page-title">
              <h2>Eventos recentes</h2>
              <p class="section-subtitle">Últimos registros recebidos.</p>
            </div>
            ${renderMetricTable()}
          </section>
        </section>
      </main>`);
  }

  function renderMetricTable() {
    if (!state.metricsEvents.length) return `<div class="empty-state">Nenhum evento registrado.</div>`;

    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Evento</th>
              <th>Pagina</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            ${state.metricsEvents.slice(0, 60).map((event) => `
              <tr>
                <td><strong>${escapeHtml(event.event_name)}</strong></td>
                <td>${escapeHtml(event.path || "-")}</td>
                <td>${formatDate(event.created_at)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;
  }

  return { renderMetricsPage };
}
