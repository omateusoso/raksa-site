import { calculateAppliedSubstrateCost } from "./substratePricing.js";

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nonNegative(value) {
  return Math.max(0, numberOrZero(value));
}

function percentageAmount(amount, percent) {
  return amount * (nonNegative(percent) / 100);
}

function normalizeSubstrateInput(entry = {}) {
  const substrate = entry.substrate || entry.substrates || entry;
  const quantityUsed = entry.quantity ?? entry.quantity_used ?? entry.used_quantity ?? 1;
  return { substrate, quantityUsed };
}

export function roundMoney(value) {
  return Math.round((numberOrZero(value) + Number.EPSILON) * 100) / 100;
}

export function calculateProductPricing({
  product = {},
  quantity = 0,
  financialSettings = {},
  substrates = [],
} = {}) {
  const requestedQuantity = nonNegative(quantity);
  const hoursPerUnit = nonNegative(product.hours_per_unit ?? product.estimated_hours);
  const laborHours = requestedQuantity * hoursPerUnit;
  const hourlyRate = nonNegative(financialSettings.hourly_rate);
  const laborCost = laborHours * hourlyRate;

  const substrateCost = substrates.reduce((sum, entry) => {
    const { substrate, quantityUsed } = normalizeSubstrateInput(entry);
    return sum + calculateAppliedSubstrateCost(substrate, quantityUsed);
  }, 0);

  const subtotal = laborCost + substrateCost;
  const markupPercent = nonNegative(financialSettings.default_markup_percent);
  const markupAmount = percentageAmount(subtotal, markupPercent);
  const taxPercent = nonNegative(financialSettings.default_tax_percent);
  const taxAmount = percentageAmount(subtotal, taxPercent);
  const total = subtotal + markupAmount + taxAmount;

  return {
    quantity: requestedQuantity,
    laborHours: roundMoney(laborHours),
    hourlyRate: roundMoney(hourlyRate),
    laborCost: roundMoney(laborCost),
    substrateCost: roundMoney(substrateCost),
    subtotal: roundMoney(subtotal),
    markupPercent: roundMoney(markupPercent),
    markupAmount: roundMoney(markupAmount),
    taxPercent: roundMoney(taxPercent),
    taxAmount: roundMoney(taxAmount),
    total: roundMoney(total),
  };
}
