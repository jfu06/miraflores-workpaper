/**
 * The adjustment ledger.
 *
 * Adjustments are events like everything else, so the ledger is a fold, the
 * original figure is never lost, and withdrawing one is an append rather than a
 * delete.
 *
 * The firm's rule — "any adjustment with a tax effect over 1,000 (federal or
 * state) requires partner sign-off" — is enforced by holding such an adjustment
 * as **proposed** until a partner approves it. A proposed adjustment shows its
 * effect but does not move the return's figures, because a number nobody has
 * approved is not yet the return.
 */

import type { WorkpaperEvent } from "../events/types";
import type {
  AdjustmentApprovedPayload,
  AdjustmentPayload,
  RevertPayload,
} from "../events/types";
import type { FactGraph } from "../graph/graph";
import type { AppliedAdjustment, Provenance, RecomputeResult } from "./recompute";

export interface LedgerEntry {
  eventId: string;
  lineKey: string;
  from: number;
  to: number;
  delta: number;
  reason: string;
  category: string;
  effect: AdjustmentPayload["effect"];
  requiresPartner: boolean;
  actorId: string;
  actorName: string;
  at: string;
  /** Set when several adjustments were applied as one action. */
  groupId?: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  /** True once it moves the return: approved, or below the firm's threshold. */
  applied: boolean;
}

export function buildLedger(
  events: WorkpaperEvent[],
  actorName: (id: string) => string,
): LedgerEntry[] {
  const reverted = new Set<string>();
  for (const event of events) {
    if (event.type === "revert") {
      reverted.add((event.payload as RevertPayload).targetEventId);
      reverted.add(event.id);
    }
  }

  const approvals = new Map<string, WorkpaperEvent>();
  for (const event of events) {
    if (event.type === "adjustment_approved" && !reverted.has(event.id)) {
      approvals.set((event.payload as AdjustmentApprovedPayload).targetEventId, event);
    }
  }

  return events
    .filter((e) => e.type === "adjustment" && !reverted.has(e.id))
    .map((event) => {
      const p = event.payload as AdjustmentPayload;
      const approval = approvals.get(event.id);
      const approved = Boolean(approval);

      return {
        eventId: event.id,
        lineKey: event.scope.id,
        from: p.from,
        to: p.to,
        delta: p.to - p.from,
        reason: p.reason,
        category: p.category,
        effect: p.effect,
        requiresPartner: p.requiresPartner,
        actorId: event.actorId,
        actorName: actorName(event.actorId),
        at: event.at,
        groupId: event.groupId,
        approved,
        approvedBy: approval ? actorName(approval.actorId) : undefined,
        approvedAt: approval?.at,
        applied: !p.requiresPartner || approved,
      };
    });
}

/** The entries that actually move the return. */
export function appliedAdjustments(ledger: LedgerEntry[]): AppliedAdjustment[] {
  return ledger
    .filter((entry) => entry.applied)
    .map((entry) => ({
      eventId: entry.eventId,
      lineKey: entry.lineKey,
      from: entry.from,
      to: entry.to,
      reason: entry.reason,
    }));
}

/**
 * The totals as adjusted.
 *
 * Where a summary figure was recomputed, the recomputed number is used. Where it
 * was not reached — because propagation stopped at a line whose arithmetic could
 * not be recovered — the engine's figure stands and the estimated effect is
 * reported separately rather than folded in, so the two are never confused.
 */
export function summariseEffect(ledger: LedgerEntry[]) {
  const applied = ledger.filter((e) => e.applied);
  const pending = ledger.filter((e) => !e.applied);

  const sum = (entries: LedgerEntry[], key: "federal" | "california") =>
    entries.reduce((total, entry) => total + entry.effect[key], 0);

  return {
    appliedCount: applied.length,
    pendingCount: pending.length,
    appliedFederal: sum(applied, "federal"),
    appliedCalifornia: sum(applied, "california"),
    pendingFederal: sum(pending, "federal"),
    pendingCalifornia: sum(pending, "california"),
  };
}


export interface BalanceMovement {
  jurisdiction: "federal" | "california";
  key: string;
  label: string;
  from: number;
  to: number;
  delta: number;
  provenance: Provenance;
}

/** The lines a reader actually cares about: what is owed or refunded. */
const BALANCE_LABEL = /amount you owe|overpaid|refund/i;

/**
 * Where an adjustment reached the bottom line, the recomputed figure is the
 * answer and the rate estimate is superseded.
 *
 * Showing both as though they were two readings of the same thing would be the
 * kind of false precision this workpaper is meant to remove: one is arithmetic
 * carried through verified form, the other a linear approximation measured at
 * numbers that have since moved.
 */
export function balanceMovements(
  graph: FactGraph,
  result: RecomputeResult,
): BalanceMovement[] {
  const movements: BalanceMovement[] = [];

  for (const line of result.lines.values()) {
    const source = graph.lineByKey.get(line.key);
    if (!source || !BALANCE_LABEL.test(source.label)) continue;
    if (line.value === line.original) continue;

    movements.push({
      jurisdiction: source.jurisdiction,
      key: line.key,
      label: source.label,
      from: line.original,
      to: line.value,
      delta: line.value - line.original,
      provenance: line.provenance,
    });
  }

  return movements;
}
