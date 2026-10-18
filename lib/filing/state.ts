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
import type {
  AmendmentPayload,
  FilingPayload,
  RevertPayload,
  ReviewNotePayload,
  ReviewNoteResolvedPayload,
} from "../events/types";
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

export interface OpenBlockingNote {
  eventId: string;
  text: string;
  at: string;
  raisedBy: string;
  scopeKind: string;
  scopeId: string;
  /**
   * The returns this note bears on, where they can be told: the jurisdiction of
   * the line it was raised on, and every jurisdiction that line's value flows
   * into. A note whose scope is not a line has none, and then it bears on every
   * filing.
   */
  jurisdictions?: string[];
}

/**
 * The blocking review notes still standing.
 *
 * A note is open until it is resolved; reverting either the note or its
 * resolution is handled the same way as everywhere else, by folding reverts
 * first and reading what is left.
 */
export function openBlockingNotes(
  events: WorkpaperEvent[],
  actorName: (id: string) => string,
  jurisdictionsOf: (lineKey: string) => string[] | undefined,
): OpenBlockingNote[] {
  const reverted = new Set<string>();
  for (const event of events) {
    if (event.type === "revert") {
      reverted.add((event.payload as RevertPayload).targetEventId);
      reverted.add(event.id);
    }
  }

  const live = events.filter((e) => !reverted.has(e.id));
  const resolved = new Set(
    live
      .filter((e) => e.type === "review_note_resolved")
      .map((e) => (e.payload as ReviewNoteResolvedPayload).targetEventId),
  );

  return live
    .filter(
      (e) =>
        e.type === "review_note" &&
        (e.payload as ReviewNotePayload).blocking &&
        !resolved.has(e.id),
    )
    .map((event) => {
      const p = event.payload as ReviewNotePayload;
      return {
        eventId: event.id,
        text: p.text,
        at: event.at,
        raisedBy: actorName(event.actorId),
        scopeKind: event.scope.kind,
        scopeId: event.scope.id,
        jurisdictions:
          event.scope.kind === "line" ? jurisdictionsOf(event.scope.id) : undefined,
      };
    });
}

/**
 * Whether a return may be transmitted now.
 *
 * `ReviewNotePayload.blocking` has always been documented as stopping filing;
 * until this existed, nothing enforced it, and a return could be transmitted
 * with the firm's own blocking notes still open.
 *
 * A note stops a filing when the figure it was raised against reaches that
 * return — not when it happens to share a jurisdiction with it. The two are not
 * the same, and the difference is the whole of the judgment here: California is
 * computed from federal amounts, so a federal figure in doubt leaves the
 * California return in doubt, while a question about the California wage split
 * says nothing about the federal return and should not hold it up. The file
 * itself runs that way — its e-file record shows the state return held because
 * the federal one was rejected, never the reverse.
 *
 * Fail-closed where the record cannot say: a note raised on a document, an
 * extracted value, or the return as a whole stops every filing, because nothing
 * establishes that it is unrelated to this one.
 */
export function canFile(
  state: FilingState,
  notes: OpenBlockingNote[],
  jurisdiction: string,
): { ok: boolean; reason?: string; blockedBy?: OpenBlockingNote[] } {
  if (state.filedJurisdictions.includes(jurisdiction)) {
    return { ok: false, reason: `The ${jurisdiction} return has already been filed.` };
  }

  const bearing = notes.filter(
    (n) => n.jurisdictions === undefined || n.jurisdictions.includes(jurisdiction),
  );
  if (bearing.length === 0) return { ok: true };

  const first = bearing[0];
  const rest = bearing.length - 1;
  return {
    ok: false,
    blockedBy: bearing,
    reason:
      `${bearing.length} blocking review note${bearing.length === 1 ? "" : "s"} ` +
      `still stand${bearing.length === 1 ? "s" : ""} against the ${jurisdiction} return: ` +
      `"${first.text}" (${first.scopeId}, ${first.raisedBy})` +
      `${rest > 0 ? ` and ${rest} more` : ""}. Resolve ${
        bearing.length === 1 ? "it" : "them"
      } or withdraw ${bearing.length === 1 ? "it" : "them"} before filing.`,
  };
}
