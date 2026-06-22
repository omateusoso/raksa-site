import assert from "node:assert/strict";
import { calculateProductPricing, roundMoney } from "../admin/modules/pricingEngine.js";

const financialSettings = {
  hourly_rate: 70,
  default_markup_percent: 30,
  default_tax_percent: 6,
};

function product(overrides = {}) {
  return {
    hours_per_unit: 1,
    ...overrides,
  };
}

function substrate(overrides = {}) {
  return {
    cost_amount: 0,
    pass_through_method: "none",
    ...overrides,
  };
}

assert.equal(roundMoney(10.235), 10.24);
assert.equal(roundMoney(Number.NaN), 0);
assert.equal(calculateProductPricing().total, 0);

assert.deepEqual(
  calculateProductPricing({
    product: product({ hours_per_unit: 2 }),
    quantity: 1,
    financialSettings,
    substrates: [],
  }),
  {
    quantity: 1,
    laborHours: 2,
    hourlyRate: 70,
    laborCost: 140,
    substrateCost: 0,
    subtotal: 140,
    markupPercent: 30,
    markupAmount: 42,
    taxPercent: 6,
    taxAmount: 8.4,
    total: 190.4,
  },
);

assert.deepEqual(
  calculateProductPricing({
    product: product({ hours_per_unit: 0 }),
    quantity: 1,
    financialSettings,
    substrates: [
      substrate({
        cost_amount: 80,
        pass_through_method: "allocated",
        allocation_quantity: 10,
      }),
    ],
  }),
  {
    quantity: 1,
    laborHours: 0,
    hourlyRate: 70,
    laborCost: 0,
    substrateCost: 8,
    subtotal: 8,
    markupPercent: 30,
    markupAmount: 2.4,
    taxPercent: 6,
    taxAmount: 0.48,
    total: 10.88,
  },
);

assert.deepEqual(
  calculateProductPricing({
    product: product({ hours_per_unit: 0 }),
    quantity: 1,
    financialSettings,
    substrates: [
      substrate({
        cost_amount: 200,
        pass_through_method: "percent",
        pass_through_percent: 25,
      }),
    ],
  }),
  {
    quantity: 1,
    laborHours: 0,
    hourlyRate: 70,
    laborCost: 0,
    substrateCost: 50,
    subtotal: 50,
    markupPercent: 30,
    markupAmount: 15,
    taxPercent: 6,
    taxAmount: 3,
    total: 68,
  },
);

assert.deepEqual(
  calculateProductPricing({
    product: product({ hours_per_unit: 0 }),
    quantity: 1,
    financialSettings,
    substrates: [
      substrate({
        pass_through_method: "fixed",
        fixed_pass_through_amount: 120,
      }),
    ],
  }),
  {
    quantity: 1,
    laborHours: 0,
    hourlyRate: 70,
    laborCost: 0,
    substrateCost: 120,
    subtotal: 120,
    markupPercent: 30,
    markupAmount: 36,
    taxPercent: 6,
    taxAmount: 7.2,
    total: 163.2,
  },
);

assert.deepEqual(
  calculateProductPricing({
    product: product({ hours_per_unit: 1 }),
    quantity: 20,
    financialSettings,
    substrates: [
      {
        quantity: 3,
        substrate: substrate({
          cost_amount: 10,
          pass_through_method: "per_unit",
        }),
      },
    ],
  }),
  {
    quantity: 20,
    laborHours: 20,
    hourlyRate: 70,
    laborCost: 1400,
    substrateCost: 30,
    subtotal: 1430,
    markupPercent: 30,
    markupAmount: 429,
    taxPercent: 6,
    taxAmount: 85.8,
    total: 1944.8,
  },
);

assert.deepEqual(
  calculateProductPricing({
    product: { hours_per_unit: "not-a-number" },
    quantity: "invalid",
    financialSettings: {
      hourly_rate: null,
      default_markup_percent: undefined,
      default_tax_percent: Number.NaN,
    },
    substrates: [substrate({ cost_amount: Number.NaN, pass_through_method: "full" })],
  }),
  {
    quantity: 0,
    laborHours: 0,
    hourlyRate: 0,
    laborCost: 0,
    substrateCost: 0,
    subtotal: 0,
    markupPercent: 0,
    markupAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 0,
  },
);

console.log("Pricing engine tests passed.");
