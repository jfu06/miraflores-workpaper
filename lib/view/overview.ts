/**
 * The two summaries a reviewer opens the file to see: this return against last
 * year, and the state of each review area.
 */

import type { FactGraph } from "../graph/graph";
import type { ScopeSummary } from "../events/summary";
import { AREA_LABELS, areaForForm, areaLabel } from "./areas";
import type { VarianceReport } from "./variance";

export interface ComparisonRow {
  label: string;
  prior?: number;
  current: number;
  delta?: number;
  /** Set when the two years are not measured the same way. */
  caveat?: string;
  /** Prior-year line key, so the figure can be traced. */
  priorKey?: string;
}

export interface Comparison {
  jurisdiction: "federal" | "california";
  rows: ComparisonRow[];
}

/**
 * Prior-year totals, mapped by the label each return gave them.
 *
 * This map is safe in a way a line-by-line California map would not be: "Total
 * tax" to "Total tax" is label identity, not an assertion about which Form 540NR
 * line corresponds to which Form 540 line.
 */
function priorNumber(graph: FactGraph, key: string): number | undefined {
  const value = (graph.packet.prior_years.return_2024 as { lines: Record<string, unknown> })
    .lines[key];
  return typeof value === "number" ? value : undefined;
}

export function buildComparisons(graph: FactGraph): Comparison[] {
  const federal = graph.current.summary.federal;
  const california = graph.current.summary.california;

  const overpaid2024 = priorNumber(graph, "F1040.34");
  const caWithheld = priorNumber(graph, "CA540.71") ?? 0;
  const caEstimated = priorNumber(graph, "CA540.72") ?? 0;

  const movedCaveat =
    "2024 was a full-year California resident return (Form 540); 2025 is part-year (Form 540NR). The two are not measured on the same basis.";

  return [
    {
      jurisdiction: "federal",
      rows: [
        {
          label: "Adjusted gross income",
          prior: priorNumber(graph, "F1040.11"),
          current: federal.agi,
          priorKey: "F1040.11",
        },
        {
          label: "Taxable income",
          prior: priorNumber(graph, "F1040.15"),
          current: federal.taxable_income,
          priorKey: "F1040.15",
        },
        {
          label: "Total tax",
          prior: priorNumber(graph, "F1040.24"),
          current: federal.total_tax,
          priorKey: "F1040.24",
        },
        {
          label: "Payments",
          prior: priorNumber(graph, "F1040.33"),
          current: federal.payments,
          priorKey: "F1040.33",
        },
        {
          label: "Balance due",
          // 2024 overpaid, recorded as a refund; shown here on the same sign convention.
          prior: overpaid2024 === undefined ? undefined : -overpaid2024,
          current: federal.balance_due,
          priorKey: "F1040.34",
        },
        { label: "Estimated tax penalty", current: federal.penalty },
      ],
    },
    {
      jurisdiction: "california",
      rows: [
        {
          label: "California AGI",
          prior: priorNumber(graph, "CA540.17"),
          current: california.ca_agi,
          caveat: movedCaveat,
          priorKey: "CA540.17",
        },
        {
          label: "Total tax",
          prior: priorNumber(graph, "CA540.64"),
          current: california.total_tax,
          caveat: movedCaveat,
          priorKey: "CA540.64",
        },
        {
          label: "Payments",
          prior: caWithheld + caEstimated,
          current: california.payments,
          priorKey: "CA540.71",
        },
        {
          label: "Balance due",
          prior: priorNumber(graph, "CA540.111"),
          current: california.balance_due,
          priorKey: "CA540.111",
        },
      ],
    },
  ].map((c) => ({
    ...c,
    rows: c.rows.map((r) => ({
      ...r,
      delta: r.prior === undefined ? undefined : r.current - r.prior,
    })),
  })) as Comparison[];
}

export interface AreaSummaryRow {
  area: string;
  label: string;
  lines: number;
  forms: string[];
  flaggedVariances: number;
  explainedVariances: number;
  unmatchedPriorLines: number;
  diagnostics: number;
  warnings: number;
  verifiedLines: number;
  signedLines: number;
  openBlocking: number;
  budgetHours?: number;
}

export function buildAreaSummaries(
  graph: FactGraph,
  variance: VarianceReport,
  summaries: Record<string, ScopeSummary>,
  explainedKeys: Set<string>,
): AreaSummaryRow[] {
  const budget = graph.packet.firm.budget_hours;
  const rows = new Map<string, AreaSummaryRow>();

  const ensure = (area: string): AreaSummaryRow => {
    const existing = rows.get(area);
    if (existing) return existing;
    const created: AreaSummaryRow = {
      area,
      label: areaLabel(area),
      lines: 0,
      forms: [],
      flaggedVariances: 0,
      explainedVariances: 0,
      unmatchedPriorLines: 0,
      diagnostics: 0,
      warnings: 0,
      verifiedLines: 0,
      signedLines: 0,
      openBlocking: 0,
      budgetHours: budget[area],
    };
    rows.set(area, created);
    return created;
  };

  // Seed every known area so an untouched one still appears.
  for (const area of Object.keys(AREA_LABELS)) ensure(area);

  for (const line of graph.current.lines) {
    const row = ensure(areaForForm(line.form));
    row.lines += 1;
    if (!row.forms.includes(line.form)) row.forms.push(line.form);

    const work = summaries[`line:${line.key}`];
    if (!work) continue;
    if (work.verifications > 0) row.verifiedLines += 1;
    if (work.signoffLevels.length > 0) row.signedLines += 1;
    row.openBlocking += work.openBlocking;
  }

  for (const v of variance.rows) {
    const row = ensure(v.area);
    if (v.status === "unmatched") row.unmatchedPriorLines += 1;
    if (v.flagged) {
      row.flaggedVariances += 1;
      if (explainedKeys.has(v.key)) row.explainedVariances += 1;
    }
  }

  for (const diagnostic of graph.current.diagnostics) {
    const areas = new Set<string>();
    for (const ref of diagnostic.refs) {
      const line = graph.lineByKey.get(ref);
      if (line) areas.add(areaForForm(line.form));
    }
    // A diagnostic citing no line at all still belongs somewhere a reviewer looks.
    if (areas.size === 0) areas.add("summary");
    for (const area of areas) {
      const row = ensure(area);
      row.diagnostics += 1;
      if (diagnostic.severity === "warning") row.warnings += 1;
    }
  }

  return [...rows.values()].filter((r) => r.lines > 0 || r.flaggedVariances > 0);
}
