import { NextResponse } from "next/server";

import { actorIndex } from "@/lib/auth/actor";
import { appliedAdjustments, buildLedger } from "@/lib/adjust/ledger";
import { deriveScope } from "@/lib/events/derive";
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

  /**
   * Findings the workpaper has corrected.
   *
   * Checks read the packet and never the event log, so a finding cannot be made
   * to disappear by working around it. But applying the exact figure a check
   * supplied is not working around it — it is answering it, and the check will
   * go on reporting because the engine's return still says what it said.
   *
   * So an applied adjustment that matches a finding's own suggestion marks it
   * addressed. That is different from a dismissal: nobody argued the finding
   * away, the number was changed to what the other record says.
   */
  const ledger = buildLedger(events, (id) => actors.get(id) ?? id);
  const applied = appliedAdjustments(ledger);
  const findings = allFindings(results);

  const addressed = findings
    .filter((finding) => {
      const suggestion = finding.suggestedAdjustment;
      if (!suggestion) return false;
      return applied.some(
        (adjustment) =>
          adjustment.lineKey === suggestion.lineKey && adjustment.to === suggestion.to,
      );
    })
    .map((finding) => {
      const entry = ledger.find(
        (e) =>
          e.lineKey === finding.suggestedAdjustment!.lineKey &&
          e.to === finding.suggestedAdjustment!.to,
      )!;
      return {
        findingId: finding.id,
        lineKey: entry.lineKey,
        to: entry.to,
        actorName: entry.actorName,
        at: entry.at,
      };
    });

  /**
   * Sign-offs on the return as a whole, so the two sign-off steps are derived
   * from the record rather than ticked beside it.
   */
  const returnScope = deriveScope(
    graph,
    { kind: "return", id: String(packet.household.tax_year) },
    actorIndex(packet),
  );

  return NextResponse.json({
    returnSignoffs: returnScope.signoffs.map((s) => ({
      level: s.level,
      actorName: s.actor?.name ?? s.eventId,
      at: s.at,
      valid: s.valid,
    })),
    /** Documents the required steps are derived against. */
    documents: packet.documents.map((d) => ({
      id: d.id,
      documentType: d.document_type,
      title: d.title,
    })),
    checks: results.map((r) => r.check),
    findings,
    addressed,
    dismissals,
    completedSteps,
    requiredSteps: packet.firm.starter_standards.required_steps,
    diagnostics: graph.current.diagnostics,
  });
}
