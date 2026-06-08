import { PAGE_BASE } from "./constants.js?v=3";

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeAssetUrl(value = "") {
  const url = String(value || "").trim();
  if (url.startsWith("/framerusercontent.com/") || url.startsWith("/vendor/")) return `${PAGE_BASE}${url}`;
  return url;
}

export function normalizeExternalUrl(value = "") {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return url;
  return `https://${url}`;
}

export function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function formatCurrency(value = 0, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatHours(minutes = 0) {
  const total = Number(minutes || 0);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return `${hours}h${String(rest).padStart(2, "0")}`;
}

export function labelFromOptions(options, value) {
  return options.find(([id]) => id === value)?.[1] || value || "-";
}

export function selectOptions(options, selectedValue = "", placeholder = "") {
  return [
    placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : "",
    ...options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${String(selectedValue) === String(value) ? "selected" : ""}>${escapeHtml(label)}</option>`),
  ].join("");
}

export function entityName(items, id, fallback = "-") {
  return items.find((item) => item.id === id)?.name || items.find((item) => item.id === id)?.title || fallback;
}

export function numberFromForm(data, key) {
  const value = String(data.get(key) || "").replace(",", ".").trim();
  return value ? Number(value) : 0;
}

export function requiredTextFromForm(data, key, label, errors) {
  const value = String(data.get(key) || "").trim();
  if (!value) errors.push(`Preencha ${label}.`);
  return value;
}

export function optionalEmailFromForm(data, key, label, errors) {
  const value = String(data.get(key) || "").trim();
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors.push(`${label} deve ser um e-mail válido.`);
    return null;
  }
  return value;
}

export function optionalUrlFromForm(data, key, label, errors) {
  const value = String(data.get(key) || "").trim();
  if (!value) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;

  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) {
      errors.push(`${label} deve ser uma URL válida.`);
      return null;
    }
    return url.toString();
  } catch {
    errors.push(`${label} deve ser uma URL válida.`);
    return null;
  }
}

export function optionalDateFromForm(data, key, label, errors) {
  const value = String(data.get(key) || "").trim();
  if (!value) return null;
  if (!isValidDateInput(value)) {
    errors.push(`${label} deve ser uma data válida.`);
    return null;
  }
  return value;
}

export function requiredDateFromForm(data, key, label, errors) {
  const rawValue = String(data.get(key) || "").trim();
  if (!rawValue) {
    errors.push(`Preencha ${label}.`);
    return null;
  }
  return optionalDateFromForm(data, key, label, errors);
}

export function validateDateOrder(start, end, startLabel, endLabel, errors) {
  if (!start || !end) return;
  if (Date.parse(`${start}T00:00:00Z`) > Date.parse(`${end}T00:00:00Z`)) {
    errors.push(`${endLabel} deve ser igual ou posterior a ${startLabel}.`);
  }
}

export function nonNegativeNumberFromForm(data, key, label, errors, defaultValue = 0) {
  const parsed = parseDecimalInput(data.get(key), label, errors);
  return parsed ?? defaultValue;
}

export function positiveIntegerFromForm(data, key, label, errors) {
  const value = String(data.get(key) || "").trim();
  if (!value) {
    errors.push(`Preencha ${label}.`);
    return 0;
  }
  if (!/^\d+$/.test(value)) {
    errors.push(`${label} deve ser um número inteiro.`);
    return 0;
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    errors.push(`${label} deve ser maior que zero.`);
    return 0;
  }
  return number;
}

export function optionalFormValue(data, key) {
  const value = String(data.get(key) || "").trim();
  return value || null;
}

export function valueAttr(value = "") {
  return escapeHtml(value ?? "");
}

export function dateInputValue(value) {
  return value ? String(value).slice(0, 10) : "";
}

export function scopeText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.text === "string") return value.text;
  return JSON.stringify(value, null, 2);
}

function isValidDateInput(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function parseDecimalInput(rawValue, label, errors) {
  const value = String(rawValue ?? "").trim().replace(",", ".");
  if (!value) return null;
  if (!/^\d+(\.\d+)?$/.test(value)) {
    errors.push(`${label} deve ser um número positivo.`);
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    errors.push(`${label} deve ser um número positivo.`);
    return null;
  }
  return number;
}
