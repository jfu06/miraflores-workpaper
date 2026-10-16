import { NextResponse } from "next/server";

import { listAll } from "@/lib/events/store";
import type { FindingDismissedPayload, RevertPayload } from "@/lib/events/types";
import { allFindings, runChecks } from "@/lib/checks/run";
import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";

export interface Dismissal {
  findingId: string;
  reason: string;
  actorId: string;
  actorName: string;
  at: string;
}

/**
 * Run the suite and report it alongside what has been dismissed.
 *
 * The checks never read the event log, so dismissals are applied here rather than
 * inside a check. A finding cannot be made to go away by doing work around it:
 * it goes away when someone says why, and that record is itself reversible.
 */
export async function GET() {
  const packet = loadPacket();
  const graph = buildGraph(packet);

  const events = listAll(10_000);
  const reverted = new Set<string>();
  for (const event of events) {
    if (event.type === "revert") {
      reverted.add((event.payload as RevertPayload).targetEventId);
      reverted.add(event.id);
    }
  }

  const explainedKeys = new Set(
    events.filter((e) => e.type === "variance_explained" && !reverted.has(e.id)).map((e) => e.scope.id),
  );

  const actors = new Map([
    ...packet.firm.staff.map((s) => [s.id, s.name] as const),
    ...packet.firm.client_users.map((c) => [c.id, c.name] as const),
  ]);

  const dismissals: Dismissal[] = events
    .filter((e) => e.type === "finding_dismissed" && !reverted.has(e.id))
    .map((e) => ({
      findingId: e.scope.id,
      reason: (e.payload as FindingDismissedPayload).reason,
      actorId: e.actorId,
      actorName: actors.get(e.actorId) ?? e.actorId,
      at: e.at,
    }));

  const completedSteps = events
    .filter((e) => e.type === "required_step" && !reverted.has(e.id))
    .map((e) => ({
      step: e.scope.id,
      actorName: actors.get(e.actorId) ?? e.actorId,
      at: e.at,
    }));

  const results = runChecks(graph, explainedKeys);

  return NextResponse.json({
    checks: results.map((r) => r.check),
    findings: allFindings(results),
    dismissals,
    completedSteps,
    requiredSteps: packet.firm.starter_standards.required_steps,
    diagnostics: graph.current.diagnostics,
  });
}
