function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function calculateAppliedSubstrateCost(substrate = {}, quantityUsed = 1) {
  const cost = nonNegative(substrate.cost_amount ?? substrate.unit_cost);
  const quantity = nonNegative(quantityUsed);
  const method = substrate.pass_through_method || "none";

  if (method === "none") return 0;
  if (method === "full") return cost;
  if (method === "fixed") return nonNegative(substrate.fixed_pass_through_amount);
  if (method === "percent") return cost * (nonNegative(substrate.pass_through_percent) / 100);
  if (method === "allocated") {
    const allocationQuantity = nonNegative(substrate.allocation_quantity);
    return allocationQuantity > 0 ? cost / allocationQuantity : 0;
  }
  if (method === "per_unit") return cost * quantity;

  return 0;
}
