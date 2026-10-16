/**
 * Review areas.
 *
 * The firm budgets hours by area (`firm.budget_hours`), so those are the names a
 * reviewer already thinks in. Forms are mapped onto them rather than inventing a
 * second taxonomy. Anything unmapped falls to "Return summary" instead of being
 * hidden, so a form the engine emits that this table has not seen still appears.
 */

export const AREA_LABELS: Record<string, string> = {
  summary: "Return summary",
  wages_and_stock_compensation: "Wages and stock compensation",
  investments_and_digital_assets: "Investments and digital assets",
  business: "Business",
  rentals_and_sale: "Rentals and sale",
  pass_throughs_and_basis: "Pass-throughs and basis",
  deductions_and_credits: "Deductions and credits",
  california: "California",
  payments_and_penalties: "Payments and penalties",
  compliance: "Compliance and due diligence",
};

const FORM_AREA: Record<string, string> = {
  F1040: "summary",
  Sch1: "summary",
  Sch2: "summary",
  Sch3: "summary",

  SchB: "investments_and_digital_assets",
  SchD: "investments_and_digital_assets",
  F8949: "investments_and_digital_assets",

  SchC: "business",
  SchSE: "business",
  "F4562-C": "business",
  F8995: "business",
  F8995A: "business",

  SchE: "rentals_and_sale",
  F4797: "rentals_and_sale",
  "F4562-E": "rentals_and_sale",
  F8582: "rentals_and_sale",

  F7203: "pass_throughs_and_basis",

  SchA: "deductions_and_credits",
  F8812: "deductions_and_credits",
  F8863: "deductions_and_credits",
  F2441: "deductions_and_credits",
  F8889: "deductions_and_credits",
  F8606: "deductions_and_credits",
  F8283: "deductions_and_credits",

  F6251: "payments_and_penalties",
  F8959: "payments_and_penalties",
  F8960: "payments_and_penalties",
  F2210: "payments_and_penalties",

  F8938: "compliance",
  F8867: "compliance",

  SchCA540NR: "california",
  F540NR: "california",
  // The 2024 return used Form 540, the full-year resident form. Its lines appear
  // only in the prior-year comparison, and they belong in the California area.
  CA540: "california",
  ScheduleS: "california",
  FTB3885A: "california",
  FTB5805: "california",
};

export function areaForForm(form: string): string {
  return FORM_AREA[form] ?? "summary";
}

export function areaLabel(area: string): string {
  return AREA_LABELS[area] ?? area;
}
