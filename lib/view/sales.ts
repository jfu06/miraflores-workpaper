/**
 * Sales detail.
 *
 * "Handle large detail without swamping the review." There are 295 lots across
 * seven boxes, and a reviewer reading them one by one is doing the wrong job. So
 * this is built the other way round: the box totals first with their own tie-out,
 * then the lots that are exceptional, then everything else only if asked for.
 *
 * Lots are assembled from each line's own source values rather than by parsing
 * the label's prose, so a lot's fields are the figures the pipeline read, not a
 * second reading of a sentence.
 */

import type { FactGraph } from "../graph/graph";
import type { ReturnLine } from "../packet/types";

export type LotFlag =
  | "no basis reported"
  | "wash sale adjustment"
  | "basis taken from another document"
  | "gain does not match the reported basis"
  | "dates missing"
  | "sold before acquired";

export interface Lot {
  key: string;
  box: string;
  lotId: string;
  description: string;
  acquired?: string;
  sold?: string;
  /** Calendar days held, which is arithmetic, not a holding-period determination. */
  heldDays?: number;
  proceeds?: number;
  basis?: number;
  adjustment?: number;
  gain: number;
  documents: string[];
  flags: LotFlag[];
}

export interface BoxSummary {
  box: string;
  label: string;
  lots: number;
  proceeds: number;
  basis: number;
  adjustment: number;
  /** Summed from the lots here, not taken from the engine. */
  gain: number;
  totalKey?: string;
  /** The engine's own total for the box. */
  totalValue?: number;
  ties: boolean;
  difference: number;
}

const FIELD = /^(.+?)_(description|desc|acquired|acq|sold|proceeds|basis|wash|term|covered|quantity)$/;

function days(from?: string, to?: string): number | undefined {
  if (!from || !to) return undefined;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return undefined;
  return Math.round((b - a) / 86_400_000);
}

function buildLot(graph: FactGraph, line: ReturnLine): Lot | null {
  const [box, ...rest] = line.line.split(".");
  const lotId = rest.join(".");
  if (!lotId || lotId === "total" || typeof line.value !== "number") return null;

  const fields = new Map<string, string | number | boolean>();
  const documents = new Set<string>();

  for (const ref of line.sources) {
    if (!ref.startsWith("ev-")) continue;
    const ev = graph.evById.get(ref);
    if (!ev) continue;
    documents.add(ev.document_id);
    const match = ev.field.match(FIELD);
    if (match) fields.set(match[2], ev.value);
  }

  const num = (name: string) => {
    const value = fields.get(name);
    return typeof value === "number" ? value : undefined;
  };
  const text = (name: string) => {
    const value = fields.get(name);
    return typeof value === "string" ? value : undefined;
  };

  const proceeds = num("proceeds");
  const basis = num("basis");
  const wash = num("wash");
  const acquired = text("acquired") ?? text("acq");
  const sold = text("sold");

  const flags: LotFlag[] = [];
  if (proceeds !== undefined && proceeds > 0 && (basis === undefined || basis === 0)) {
    flags.push("no basis reported");
  }
  if (wash !== undefined && wash > 0) flags.push("wash sale adjustment");
  if (documents.size > 1) flags.push("basis taken from another document");
  if (!acquired || !sold) flags.push("dates missing");
  const held = days(acquired, sold);
  if (held !== undefined && held < 0) flags.push("sold before acquired");

  /**
   * Does the gain follow from the figures on the face of the broker's form?
   *
   * Where it does not, the engine used something else — most often an adjusted
   * basis from a stock-plan supplement, which is correct and worth seeing.
   */
  if (proceeds !== undefined && basis !== undefined) {
    const implied = proceeds - basis + (wash ?? 0);
    if (Math.abs(implied - line.value) > 1 && !flags.includes("basis taken from another document")) {
      flags.push("gain does not match the reported basis");
    }
  }

  return {
    key: line.key,
    box,
    lotId,
    description: text("description") ?? text("desc") ?? line.label.split("(")[0].trim(),
    acquired,
    sold,
    heldDays: held,
    proceeds,
    basis,
    adjustment: wash,
    gain: line.value,
    documents: [...documents],
    flags,
  };
}

export interface SalesReport {
  boxes: BoxSummary[];
  lots: Lot[];
  exceptions: Lot[];
  counts: { lots: number; exceptions: number; documents: number };
  /** Net of every box, summed here and compared to Schedule D. */
  netGain: number;
  scheduleD: { key: string; label: string; value: number }[];
}

export function buildSales(graph: FactGraph): SalesReport {
  const lines = graph.current.lines.filter((l) => l.form === "F8949");
  const lots = lines
    .map((line) => buildLot(graph, line))
    .filter((lot): lot is Lot => lot !== null);

  const totals = new Map(
    lines
      .filter((l) => l.line.endsWith(".total") && typeof l.value === "number")
      .map((l) => [l.line.split(".")[0], l]),
  );

  const boxes: BoxSummary[] = [];
  for (const box of [...new Set(lots.map((l) => l.box))].sort()) {
    const inBox = lots.filter((l) => l.box === box);
    const sum = (pick: (lot: Lot) => number | undefined) =>
      inBox.reduce((total, lot) => total + (pick(lot) ?? 0), 0);

    const gain = sum((l) => l.gain);
    const total = totals.get(box);
    const totalValue = typeof total?.value === "number" ? total.value : undefined;
    const difference = totalValue === undefined ? 0 : gain - totalValue;

    boxes.push({
      box,
      label: total?.label ?? `Box ${box}`,
      lots: inBox.length,
      proceeds: sum((l) => l.proceeds),
      basis: sum((l) => l.basis),
      adjustment: sum((l) => l.adjustment),
      gain,
      totalKey: total?.key,
      totalValue,
      // Whole-dollar rounding on the engine's total is expected; more is not.
      ties: Math.abs(difference) <= 1,
      difference,
    });
  }

  const exceptions = lots
    .filter((lot) => lot.flags.length > 0)
    .sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain));

  return {
    boxes,
    lots,
    exceptions,
    counts: {
      lots: lots.length,
      exceptions: exceptions.length,
      documents: new Set(lots.flatMap((l) => l.documents)).size,
    },
    netGain: boxes.reduce((total, b) => total + b.gain, 0),
    scheduleD: graph.current.lines
      .filter((l) => l.form === "SchD" && typeof l.value === "number")
      .filter((l) => ["1b", "3", "8b", "10", "15", "16"].includes(l.line))
      .map((l) => ({ key: l.key, label: l.label, value: l.value as number })),
  };
}
