import { listAll } from "./store";
import { scopeKey, type ReviewNotePayload, type RevertPayload, type SignoffPayload } from "./types";

export interface ScopeSummary {
  events: number;
  verifications: number;
  openBlocking: number;
  signoffLevels: string[];
}

/**
 * A fold over every event, keyed by scope, for marking the outline.
 *
 * Done in one pass in memory rather than per-scope queries: the outline shows 627
 * lines at once, and a workpaper's event log is small next to its facts. If it
 * ever stopped being small, this becomes a materialized view updated on append.
 */
export function summarizeAll(): Record<string, ScopeSummary> {
  const events = listAll(10_000);

  const reverted = new Set<string>();
  for (const event of events) {
    if (event.type === "revert") {
      reverted.add((event.payload as RevertPayload).targetEventId);
      reverted.add(event.id);
    }
  }

  const resolved = new Set<string>();
  for (const event of events) {
    if (event.type === "review_note_resolved" && !reverted.has(event.id)) {
      resolved.add((event.payload as { targetEventId: string }).targetEventId);
    }
  }

  const summaries: Record<string, ScopeSummary> = {};
  for (const event of events) {
    if (reverted.has(event.id)) continue;

    const key = scopeKey(event.scope);
    const summary = (summaries[key] ??= {
      events: 0,
      verifications: 0,
      openBlocking: 0,
      signoffLevels: [],
    });

    summary.events += 1;
    if (event.type === "verification") summary.verifications += 1;
    if (event.type === "signoff") summary.signoffLevels.push((event.payload as SignoffPayload).level);
    if (
      event.type === "review_note" &&
      (event.payload as ReviewNotePayload).blocking &&
      !resolved.has(event.id)
    ) {
      summary.openBlocking += 1;
    }
  }

  return summaries;
}
