/**
 * The value each line carries right now, with the ledger applied.
 *
 * The fact graph is built from the packet alone, so a line read from it is the
 * figure the engine published. Adjustments live in the event layer and are
 * applied on top. Anything that has to reason about what a line *says today* —
 * rather than what the engine said — needs this, and the sign-off hash needs it
 * most: a hash taken over engine values can never notice an adjustment, and the
 * packet is immutable, so it could never notice anything at all.
 */

import type { WorkpaperEvent } from "../events/types";
import type { FactGraph } from "../graph/graph";
import { appliedAdjustments, buildLedger } from "./ledger";
import type { FormIndex } from "./arithmetic";
import { buildFormIndex, recompute } from "./recompute";

/** Line key to its value as adjusted. Lines the ledger never reached are absent. */
export type AdjustedValues = ReadonlyMap<string, number>;

export const NO_ADJUSTMENTS: AdjustedValues = new Map();

export function adjustedLineValues(
  graph: FactGraph,
  events: WorkpaperEvent[],
  forms?: FormIndex,
): AdjustedValues {
  // Names play no part in a value, so the ledger is built with an identity namer.
  const ledger = buildLedger(events, (id) => id);
  const applied = appliedAdjustments(ledger);
  if (applied.length === 0) return NO_ADJUSTMENTS;

  const result = recompute(graph, applied, forms ?? buildFormIndex(graph));
  const values = new Map<string, number>();
  for (const [key, line] of result.lines) values.set(key, line.value);
  return values;
}
