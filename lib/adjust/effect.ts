/**
 * The tax effect of a change.
 *
 * The engine cannot be rerun, and the packet is explicit about what it offers
 * instead: per-dollar rates measured at this version's numbers, by category, for
 * each jurisdiction. Credits and payments move tax or balance one for one.
 *
 * So an effect here is an estimate with stated limits, never a recomputation
 * dressed as one. Every limit the README attaches to a rate is carried onto the
 * result and shown beside the figure, because a reviewer deciding whether 1,000
 * of effect needs partner sign-off has to know how firm the 1,000 is.
 */

import type { FactGraph } from "../graph/graph";
import type { ReturnLine } from "../packet/types";

export type EffectCategory =
  | "wages"
  | "interest"
  | "schc_profit"
  | "stcg"
  | "ltcg"
  | "ordinary_income"
  | "adjustment"
  | "salt"
  | "itemized"
  | "ca_source_income"
  /** Credits and payments, which the README says move tax or balance one for one. */
  | "direct";

export const CATEGORY_LABEL: Record<EffectCategory, string> = {
  wages: "Wages",
  interest: "Interest and dividends",
  schc_profit: "Schedule C profit",
  stcg: "Short-term capital gain",
  ltcg: "Long-term capital gain",
  ordinary_income: "Other ordinary income",
  adjustment: "Adjustment to income",
  salt: "State and local taxes",
  itemized: "Other itemized deductions",
  ca_source_income: "California-source amount",
  direct: "Credit or payment (one for one)",
};

/**
 * Limits the README states for particular rates, carried onto any effect that
 * uses them.
 */
const CATEGORY_CAVEATS: Partial<Record<EffectCategory, string[]>> = {
  schc_profit: [
    "Schedule C profit also drives self-employment tax and the QBI deduction; the rate includes those.",
  ],
  adjustment: [
    "An adjustment tied to the business (SEP, self-employed health insurance) also changes the QBI deduction, which this rate does not capture.",
  ],
  interest: [
    "The California rate assumes residency-day proration. For an item wholly California-source, use the California-source category instead.",
  ],
  stcg: [
    "The California rate assumes residency-day proration. A sale during California residency is wholly California-source.",
  ],
  ltcg: [
    "The California rate assumes residency-day proration. A sale during California residency is wholly California-source.",
  ],
  salt: ["Subject to the cap, which this rate reflects only at the current numbers."],
  ca_source_income: ["Changes the California-source amount only; no federal effect."],
  direct: ["Credits and payments move tax or balance one for one, with no rate applied."],
};

/**
 * The category a line's change belongs to, by the form and line it sits on.
 *
 * A default, not a determination. Every adjustment carries its category, and the
 * person making it can change it — which matters most where the line itself does
 * not settle the question, as a capital gain's holding period does not appear in
 * the line key.
 */
/** Labels the forms use for credits and payments, which move the balance one for one. */
const DIRECT_LABEL = /credit|withheld|payment|paid|overpaid|amount you owe|refund|penalty/i;

export function defaultCategory(line: ReturnLine): EffectCategory | null {
  const { form, line: number, label } = line;

  // Tested before anything form-wide: a California payment line is a payment,
  // not California-source income, and treating it as income would run it through
  // a 0.063 rate instead of moving the balance dollar for dollar.
  if (DIRECT_LABEL.test(label)) return "direct";

  if (form === "SchCA540NR") return number.endsWith(".E") ? "ca_source_income" : null;
  if (form === "F540NR" || form === "ScheduleS" || form === "FTB3885A" || form === "FTB5805") {
    return "ca_source_income";
  }

  if (form === "SchC" || form === "SchSE" || form === "F4562-C" || form.startsWith("F8995")) {
    return "schc_profit";
  }

  if (form === "SchB") return "interest";
  if (form === "F8949") return /^[ABC]\./.test(number) ? "stcg" : "ltcg";
  if (form === "SchD") {
    // Schedule D's short-term part runs to line 7; the long-term part follows.
    const first = Number(number.split(".")[0]);
    return Number.isFinite(first) && first <= 7 ? "stcg" : "ltcg";
  }

  if (form === "SchA") return /state|local|property|sales tax/i.test(label) ? "salt" : "itemized";
  if (form === "Sch1") return "adjustment";
  if (
    form === "SchE" ||
    form === "F8582" ||
    form === "F4797" ||
    form === "F7203" ||
    // Rental depreciation lands in Schedule E, so it moves the same way.
    form === "F4562-E"
  ) {
    return "ordinary_income";
  }

  // Noncash charitable gifts feed Schedule A line 12.
  if (form === "F8283") return "itemized";

  // Schedule 2 holds additional taxes, which move total tax one for one.
  if (form === "Sch2") return "direct";

  if (form === "F1040") {
    if (number.startsWith("1")) return "wages";
    if (number === "2b" || number === "3a" || number === "3b") return "interest";
    return null;
  }

  if (form === "Sch3" || form === "F8812" || form === "F8863" || form === "F2441") return "direct";

  /**
   * Everything else returns null on purpose, and the UI asks.
   *
   * On `F6251`, `F8606`, `F8889`, `F8959` and `F8960` the same form carries both
   * a base and a tax — `F8959.1` is Medicare wages, `F8959.17` is the tax on them
   * — so a form-wide default would be right on some lines and silently wrong on
   * others. `F8938` has no tax effect at all, and the `.A` columns of Schedule CA
   * are the federal figures carried across, which is not where a change belongs.
   * A default that is wrong half the time is worse than asking.
   */
  return null;
}

export interface TaxEffect {
  category: EffectCategory;
  delta: number;
  federal: number;
  california: number;
  /** "rate" when a per-dollar rate was applied, "direct" when it moves one for one. */
  basis: "rate" | "direct";
  federalRate?: number;
  californiaRate?: number;
  caveats: string[];
}

/** How large a change has to be, against AGI, before threshold-crossing is worth warning about. */
const THRESHOLD_FRACTION = 0.05;

export function computeEffect(
  graph: FactGraph,
  delta: number,
  category: EffectCategory,
  /** Which jurisdiction a one-for-one change lands in. */
  jurisdiction: "federal" | "california" = "federal",
): TaxEffect {
  const caveats = [...(CATEGORY_CAVEATS[category] ?? [])];

  if (category === "direct") {
    return {
      category,
      delta,
      federal: jurisdiction === "federal" ? delta : 0,
      california: jurisdiction === "california" ? delta : 0,
      basis: "direct",
      caveats,
    };
  }

  const rates = graph.current.tax_effect_rates[category];
  if (!rates) {
    return { category, delta, federal: 0, california: 0, basis: "rate", caveats };
  }

  const agi = graph.current.summary.federal.agi;
  if (agi > 0 && Math.abs(delta) > agi * THRESHOLD_FRACTION) {
    caveats.push(
      `This change is ${((Math.abs(delta) / agi) * 100).toFixed(
        0,
      )}% of adjusted gross income. The rates are measured at this version's numbers, and a change this size can cross a bracket or phase-out that only a recomputation would catch.`,
    );
  }

  return {
    category,
    delta,
    federal: delta * rates.federal_per_dollar,
    california: delta * rates.california_per_dollar,
    basis: "rate",
    federalRate: rates.federal_per_dollar,
    californiaRate: rates.california_per_dollar,
    caveats,
  };
}

/**
 * The firm's threshold for partner sign-off, read from its own standards:
 * "Any adjustment with a tax effect over 1,000 (federal or state) requires
 * partner sign-off."
 */
export function requiresPartnerSignoff(effect: TaxEffect): boolean {
  return Math.abs(effect.federal) > 1000 || Math.abs(effect.california) > 1000;
}
