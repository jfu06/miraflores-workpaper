/**
 * Propagating an adjustment through the return.
 *
 * The engine cannot be rerun, so every number in an adjusted return is one of
 * four things, and the workpaper says which:
 *
 *   - **engine**      the figure the engine published, untouched
 *   - **manual**      a figure a person set, with a reason
 *   - **recomputed**  derived from the adjusted inputs by arithmetic recovered
 *                     from the engine's own numbers and verified against them
 *   - **estimated**   not derivable here; the effect is approximated from the
 *                     per-dollar rates the packet supplies, and labelled as such
 *
 * Propagation stops at a line whose arithmetic could not be recovered. Everything
 * downstream of such a line is unknown, not approximately known, and the barrier
 * is reported rather than computed through. Pretending otherwise would be the
 * same failure the packet's own confident mistakes represent.
 */

import type { FactGraph } from "../graph/graph";
import { applyForm, indexForms, type FormIndex } from "./arithmetic";

export type Provenance = "engine" | "manual" | "recomputed" | "estimated";

export interface AppliedAdjustment {
  eventId: string;
  lineKey: string;
  from: number;
  to: number;
  reason: string;
}

export interface AdjustedLine {
  key: string;
  value: number;
  original: number;
  provenance: Provenance;
  /** Set on a barrier: why this line could not be carried through. */
  limitation?: string;
}

export interface RecomputeResult {
  /** Only the lines that moved or became unknown. */
  lines: Map<string, AdjustedLine>;
  /** Lines downstream of a change whose arithmetic could not be recovered. */
  barriers: { key: string; reason: string }[];
  /** Lines beyond a barrier, whose value this workpaper cannot state. */
  unknownBeyond: string[];
  forms: FormIndex;
}

export function buildFormIndex(graph: FactGraph): FormIndex {
  const valueOf = (key: string) => {
    const value = graph.lineByKey.get(key)?.value;
    return typeof value === "number" ? value : undefined;
  };
  return indexForms(graph.current.lines, valueOf);
}

/**
 * Apply adjustments and carry them as far as the arithmetic allows.
 *
 * Walks the dependency graph breadth-first from the adjusted lines, recomputing
 * each dependent whose form is known once all of its own inputs are settled.
 */
export function recompute(
  graph: FactGraph,
  adjustments: AppliedAdjustment[],
  forms: FormIndex = buildFormIndex(graph),
): RecomputeResult {
  const lines = new Map<string, AdjustedLine>();
  const barriers: { key: string; reason: string }[] = [];
  const unknownBeyond: string[] = [];

  const currentValue = (key: string): number | undefined => {
    const adjusted = lines.get(key);
    if (adjusted) return adjusted.value;
    const value = graph.lineByKey.get(key)?.value;
    return typeof value === "number" ? value : undefined;
  };

  for (const adjustment of adjustments) {
    const line = graph.lineByKey.get(adjustment.lineKey);
    if (!line || typeof line.value !== "number") continue;
    lines.set(adjustment.lineKey, {
      key: adjustment.lineKey,
      value: adjustment.to,
      original: line.value,
      provenance: "manual",
    });
  }

  const blocked = new Set<string>();
  const queue: string[] = [...lines.keys()];
  const seen = new Set<string>(queue);

  while (queue.length > 0) {
    const key = queue.shift()!;

    for (const dependentKey of graph.dependents.get(key) ?? []) {
      const dependent = graph.lineByKey.get(dependentKey);
      if (!dependent || typeof dependent.value !== "number") continue;

      // Beyond a barrier nothing can be stated.
      if (blocked.has(key)) {
        if (!unknownBeyond.includes(dependentKey)) unknownBeyond.push(dependentKey);
        if (!blocked.has(dependentKey)) {
          blocked.add(dependentKey);
          if (!seen.has(dependentKey)) {
            seen.add(dependentKey);
            queue.push(dependentKey);
          }
        }
        continue;
      }

      const form = forms.forms.get(dependentKey);
      if (!form) {
        const reason =
          forms.unsolved.get(dependentKey)?.reason ??
          `Rule ${dependent.rule} is not arithmetic over its inputs, so the change cannot be carried through it here.`;
        if (!barriers.some((b) => b.key === dependentKey)) {
          barriers.push({ key: dependentKey, reason });
        }
        lines.set(dependentKey, {
          key: dependentKey,
          value: dependent.value,
          original: dependent.value,
          provenance: "estimated",
          limitation: reason,
        });
        blocked.add(dependentKey);
        if (!seen.has(dependentKey)) {
          seen.add(dependentKey);
          queue.push(dependentKey);
        }
        continue;
      }

      const inputs = dependent.inputs.map((k) => currentValue(k) ?? 0);
      const next = applyForm(form, inputs);
      const existing = lines.get(dependentKey);
      if (existing && existing.value === next) continue;

      lines.set(dependentKey, {
        key: dependentKey,
        value: next,
        original: dependent.value,
        provenance: "recomputed",
      });

      // Re-queue so a line fed by several changed inputs settles once.
      if (!seen.has(dependentKey) || existing) {
        seen.add(dependentKey);
        queue.push(dependentKey);
      }
    }
  }

  // A line that ended up back at its original value did not really move.
  for (const [key, line] of [...lines]) {
    if (line.provenance === "recomputed" && line.value === line.original) lines.delete(key);
  }

  return { lines, barriers, unknownBeyond, forms };
}
