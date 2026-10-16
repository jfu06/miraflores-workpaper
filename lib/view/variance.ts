/**
 * Prior-year comparison.
 *
 * `firm.starter_standards.variance_review` is the rule, read from the packet
 * rather than hard-coded: compare to prior year, flag a change over 10 percent
 * **and** over 1,000. Both conditions, as written.
 *
 * The comparison is driven by the 2024 return's line set, not this year's. The
 * prior year is recorded as 106 key lines against this year's 627, so "new in
 * 2025" would be mostly an artifact of granularity and would bury the real
 * signal. Every line last year, against this year, is the question a reviewer
 * actually asks.
 *
 * Nineteen prior-year lines have no counterpart. Most are California: 2024 was a
 * full-year resident Form 540, 2025 is a part-year Form 540NR, because the
 * household moved in July. No alias table maps one to the other. Deciding that
 * `CA540.17` "California AGI" corresponds to some line on Schedule CA (540NR) is
 * a tax judgment, and quietly asserting it is exactly the kind of invisible wrong
 * answer this workpaper exists to prevent. They are reported as unmatched, with
 * the reason where it can be derived from the packet, and a person explains them.
 */

import type { Jurisdiction, Packet } from "../packet/types";
import type { FactGraph } from "../graph/graph";
import { areaForForm } from "./areas";

export interface VarianceStandard {
  compareTo: string;
  percentThreshold: number;
  amountThreshold: number;
}

export type VarianceStatus = "matched" | "unmatched";

export interface VarianceRow {
  key: string;
  form: string;
  area: string;
  jurisdiction: Jurisdiction;
  status: VarianceStatus;
  /** The label as each year recorded it; they do not always agree. */
  priorLabel: string;
  currentLabel?: string;
  prior: number | string;
  current?: number | string;
  delta?: number;
  /** Undefined when the prior amount was zero, so a percentage has no meaning. */
  percent?: number;
  flagged: boolean;
  /**
   * True when the two years describe the line differently. A changed label on an
   * unchanged line number often means a method changed, which a percentage cannot
   * show: 2024 took the standard deduction on Form 1040 line 12, 2025 itemizes on
   * the same line.
   */
  labelChanged: boolean;
  /** How much the two descriptions overlap, 0 to 1. Lower sorts first in the UI. */
  labelSimilarity: number;
  /**
   * True when the labels name different entities, so the two years' figures are
   * not the same thing and no variance is computed. See F-004.
   */
  notComparable: boolean;
  /** Why there is no counterpart, when it can be derived from the packet. */
  unmatchedReason?: string;
  /** The prior preparer's note on this line, if any. */
  priorNote?: string;
  /** Extracted values on the prior-year return document that fed this line. */
  priorSources: string[];
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "the", "of", "and", "a", "an", "for", "to", "in", "on", "or", "at", "from",
  "with", "line", "property", "add", "combine", "total", "net",
]);

/** Content words, lightly singularized, for comparing two descriptions. */
function tokens(label: string): Set<string> {
  return new Set(
    normalizeLabel(label)
      .split(" ")
      .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
      .filter((w) => w.length > 0 && !STOPWORDS.has(w)),
  );
}

/** Jaccard overlap of the two descriptions, 0 to 1. */
function labelSimilarity(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (x.size === 0 || y.size === 0) return 1;
  const shared = [...x].filter((t) => y.has(t)).length;
  return shared / (x.size + y.size - shared);
}

/**
 * Proper nouns in a label, taken as capitalized words after the first.
 *
 * The first word is skipped because every label starts capitalized; what is left
 * is the institutions, properties and entities the line names.
 */
function properNouns(label: string): Set<string> {
  const words = label.split(/[\s,()-]+/).filter(Boolean).slice(1);
  return new Set(
    words
      .filter((w) => /^[A-Z]/.test(w))
      .map((w) => w.replace(/[^A-Za-z.]/g, "").toLowerCase())
      // A bare letter is a designator, not an entity: "property A" names nothing,
      // so it must not make "Rents - 1450 Fremont Way" look like a different line.
      .filter((w) => w.length > 1),
  );
}

/**
 * Whether the two years' labels name different entities.
 *
 * This is the load-bearing check on enumerated lines. `R-INTEREST-PAYER` assigns
 * one Schedule B line per interest payer, so a line key is a position, not an
 * identity: the household had four payers in 2024 and eight in 2025, and
 * `SchB.1.3` names Sacramento Valley Bank in one year and Meridian Brokerage in
 * the other. Subtracting one from the other produces a confident, meaningless
 * variance, so lines whose labels name entirely different proper nouns are
 * reported as not comparable instead of being given a percentage.
 *
 * Requires proper nouns on both sides: "Rents - 1450 Fremont Way" against
 * "Rents received - property A" is the same line described two ways, and only one
 * side names anything, so it stays comparable.
 */
function namesDifferentSubject(a: string, b: string): boolean {
  const x = properNouns(a);
  const y = properNouns(b);
  if (x.size === 0 || y.size === 0) return false;
  return [...x].every((n) => !y.has(n));
}

function readStandard(packet: Packet): VarianceStandard {
  const raw = packet.firm.starter_standards.variance_review as {
    compare_to: string;
    flag_if_change_over_percent: number;
    and_over_amount: number;
  };
  return {
    compareTo: raw.compare_to,
    percentThreshold: raw.flag_if_change_over_percent,
    amountThreshold: raw.and_over_amount,
  };
}

/**
 * Why a prior-year line has no counterpart, where the packet says so.
 *
 * Only derived facts are offered — the residency records and the form codes in
 * play. Anything else is left for a person to explain.
 */
function unmatchedReason(key: string, graph: FactGraph): string | undefined {
  if (!key.startsWith("CA540.")) return undefined;

  const hasNonResidentForms = graph.current.lines.some(
    (l) => l.form === "F540NR" || l.form === "SchCA540NR",
  );
  if (!hasNonResidentForms) return undefined;

  const residency = graph.packet.household.residency as { state: string; to?: string }[];
  const left = residency.find((r) => r.state === "CA")?.to;

  return `The California form changed: 2024 was Form 540, a full-year resident return; 2025 is Form 540NR, part-year${
    left ? `, after California residency ended ${left}` : ""
  }. The two forms do not share line numbers, and matching them is a judgment call.`;
}

export interface VarianceReport {
  standard: VarianceStandard;
  rows: VarianceRow[];
  flaggedCount: number;
  unmatchedCount: number;
  labelChangedCount: number;
  notComparableCount: number;
  priorYear: {
    preparedBy: string;
    filed: string;
    residency: string;
  };
}

export function buildVarianceReport(graph: FactGraph): VarianceReport {
  const packet = graph.packet;
  const standard = readStandard(packet);
  const prior = packet.prior_years.return_2024 as {
    lines: Record<string, number | string>;
    line_labels: Record<string, string>;
    line_sources: Record<string, string[]>;
    notes: Record<string, string>;
    prepared_by: string;
    filed: string;
    residency: string;
  };

  const rows: VarianceRow[] = [];

  for (const [key, priorValue] of Object.entries(prior.lines)) {
    const current = graph.lineByKey.get(key);
    const priorLabel = prior.line_labels[key] ?? key;
    const form = key.split(".")[0];

    const base = {
      key,
      form,
      area: areaForForm(current?.form ?? form),
      jurisdiction: (current?.jurisdiction ??
        (key.startsWith("CA540") ? "california" : "federal")) as Jurisdiction,
      priorLabel,
      prior: priorValue,
      priorNote: prior.notes?.[key],
      priorSources: prior.line_sources?.[key] ?? [],
    };

    if (!current) {
      rows.push({
        ...base,
        status: "unmatched",
        flagged: true,
        labelChanged: false,
        labelSimilarity: 0,
        notComparable: true,
        unmatchedReason: unmatchedReason(key, graph),
      });
      continue;
    }

    const similarity = labelSimilarity(priorLabel, current.label);
    const labelChanged = similarity < 0.6;
    const notComparable = namesDifferentSubject(priorLabel, current.label);
    const labelling = { labelChanged, labelSimilarity: similarity, notComparable };

    // Different subjects: no subtraction, because the figures are not the same thing.
    if (notComparable) {
      rows.push({
        ...base,
        ...labelling,
        status: "matched",
        currentLabel: current.label,
        current: current.value,
        flagged: true,
      });
      continue;
    }

    const bothNumeric = typeof priorValue === "number" && typeof current.value === "number";

    if (!bothNumeric) {
      const changed = String(priorValue) !== String(current.value);
      rows.push({
        ...base,
        ...labelling,
        status: "matched",
        currentLabel: current.label,
        current: current.value,
        flagged: changed || labelChanged,
      });
      continue;
    }

    const delta = (current.value as number) - (priorValue as number);
    const percent =
      priorValue === 0 ? undefined : (delta / Math.abs(priorValue as number)) * 100;

    // Both conditions, as the standard is written.
    const overAmount = Math.abs(delta) > standard.amountThreshold;
    const overPercent = percent === undefined || Math.abs(percent) > standard.percentThreshold;

    rows.push({
      ...base,
      ...labelling,
      status: "matched",
      currentLabel: current.label,
      current: current.value,
      delta,
      percent,
      flagged: (overAmount && overPercent) || labelChanged,
    });
  }

  // Largest swings first; unmatched lines sort to the top of their own group in the UI.
  rows.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));

  return {
    standard,
    rows,
    flaggedCount: rows.filter((r) => r.flagged).length,
    unmatchedCount: rows.filter((r) => r.status === "unmatched").length,
    labelChangedCount: rows.filter((r) => r.labelChanged).length,
    notComparableCount: rows.filter((r) => r.notComparable && r.status === "matched").length,
    priorYear: {
      preparedBy: prior.prepared_by,
      filed: prior.filed,
      residency: prior.residency,
    },
  };
}
