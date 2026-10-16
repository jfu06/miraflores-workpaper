/**
 * Filing, and what happens after it.
 *
 * "Freeze at filing; amend on top." Both halves fall out of the event log
 * without a new mechanism: filing appends a snapshot of everything the return
 * said at that instant, and an amendment is a later layer whose adjustments are
 * simply the ones that come after.
 *
 * Nothing is locked by changing a flag on a record. The filed figures are
 * preserved because they were written down, not because later writes are
 * prevented — and later writes are refused only where they would misrepresent
 * what was filed.
 */

import type { FactGraph } from "../graph/graph";
import type { WorkpaperEvent } from "../events/types";
import type { AmendmentPayload, FilingPayload, RevertPayload } from "../events/types";
import type { LedgerEntry } from "../adjust/ledger";

export interface FilingRecord {
  eventId: string;
  seq: number;
  at: string;
  jurisdiction: string;
  submissionId: string;
  acceptedAt: string;
  filedBy: string;
  /** Every line's value at the instant of filing. */
  snapshot: Record<string, number | string>;
  /** The ledger entries that were in force. */
  adjustmentEventIds: string[];
  contentHash: string;
}

export interface AmendmentRecord {
  eventId: string;
  seq: number;
  at: string;
  reason: string;
  openedBy: string;
  /** Adjustments recorded after this amendment was opened. */
  adjustmentEventIds: string[];
}

export interface FilingState {
  filings: FilingRecord[];
  amendments: AmendmentRecord[];
  /** True once anything has been filed; the original figures are then fixed. */
  frozen: boolean;
  /** True when an amendment is open and further adjustments belong to it. */
  amending: boolean;
  /** Jurisdictions already filed. */
  filedJurisdictions: string[];
}

export function buildFilingState(
  events: WorkpaperEvent[],
  actorName: (id: string) => string,
): FilingState {
  const reverted = new Set<string>();
  for (const event of events) {
    if (event.type === "revert") {
      reverted.add((event.payload as RevertPayload).targetEventId);
      reverted.add(event.id);
    }
  }

  const live = events.filter((e) => !reverted.has(e.id));

  const filings: FilingRecord[] = live
    .filter((e) => e.type === "filing")
    .map((event) => {
      const p = event.payload as FilingPayload;
      return {
        eventId: event.id,
        seq: event.seq,
        at: event.at,
        jurisdiction: p.jurisdiction,
        submissionId: p.submissionId,
        acceptedAt: p.acceptedAt,
        filedBy: actorName(event.actorId),
        snapshot: p.snapshot,
        adjustmentEventIds: p.adjustmentEventIds,
        contentHash: p.contentHash,
      };
    });

  const lastFilingSeq = filings.reduce((max, f) => Math.max(max, f.seq), 0);

  const amendments: AmendmentRecord[] = live
    .filter((e) => e.type === "amendment_opened")
    .map((event) => {
      const p = event.payload as AmendmentPayload;
      return {
        eventId: event.id,
        seq: event.seq,
        at: event.at,
        reason: p.reason,
        openedBy: actorName(event.actorId),
        adjustmentEventIds: live
          .filter((e) => e.type === "adjustment" && e.seq > event.seq)
          .map((e) => e.id),
      };
    });

  return {
    filings,
    amendments,
    frozen: filings.length > 0,
    amending: amendments.some((a) => a.seq > lastFilingSeq),
    filedJurisdictions: [...new Set(filings.map((f) => f.jurisdiction))],
  };
}

/**
 * Whether an adjustment may be recorded now.
 *
 * Before filing, freely. After filing, only inside an open amendment — otherwise
 * the workpaper would show figures that differ from the return that was actually
 * transmitted, with nothing marking the difference.
 */
export function canAdjust(state: FilingState): { ok: boolean; reason?: string } {
  if (!state.frozen) return { ok: true };
  if (state.amending) return { ok: true };
  return {
    ok: false,
    reason: `The return was filed (${state.filedJurisdictions.join(
      " and ",
    )}). Open an amendment to change a figure; the filed return stays as transmitted.`,
  };
}

/** The snapshot a filing records: every line as it stands, adjustments included. */
export function buildSnapshot(
  graph: FactGraph,
  adjustedLines: Map<string, { value: number }>,
): Record<string, number | string> {
  const snapshot: Record<string, number | string> = {};
  for (const line of graph.current.lines) {
    const adjusted = adjustedLines.get(line.key);
    snapshot[line.key] = adjusted ? adjusted.value : line.value;
  }
  return snapshot;
}

/** What a later amendment changed, against what was filed. */
export function amendedSince(
  filing: FilingRecord,
  current: Record<string, number | string>,
): { key: string; filed: number | string; now: number | string }[] {
  const changes: { key: string; filed: number | string; now: number | string }[] = [];
  for (const [key, filed] of Object.entries(filing.snapshot)) {
    const now = current[key];
    if (now !== undefined && now !== filed) changes.push({ key, filed, now });
  }
  return changes;
}

export type { LedgerEntry };
