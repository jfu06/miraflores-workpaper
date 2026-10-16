import { NextResponse } from "next/server";

import { listAll } from "@/lib/events/store";
import { summarizeAll } from "@/lib/events/summary";
import type { RevertPayload } from "@/lib/events/types";
import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";
import { buildAreaSummaries, buildComparisons } from "@/lib/view/overview";
import { buildVarianceReport } from "@/lib/view/variance";

/**
 * Which prior-year variances have been explained.
 *
 * "Prior-year variances explained" is a required step, so the explanations are
 * events on the line, and a withdrawn explanation stops counting.
 */
export interface VarianceExplanation {
  key: string;
  text: string;
  actorId: string;
  at: string;
}

function explanations(): VarianceExplanation[] {
  const events = listAll(10_000);
  const reverted = new Set<string>();
  for (const event of events) {
    if (event.type === "revert") {
      reverted.add((event.payload as RevertPayload).targetEventId);
      reverted.add(event.id);
    }
  }
  return events
    .filter((e) => e.type === "variance_explained" && !reverted.has(e.id))
    .map((e) => ({
      key: e.scope.id,
      text: (e.payload as { text: string }).text,
      actorId: e.actorId,
      at: e.at,
    }));
}

export async function GET() {
  const packet = loadPacket();
  const graph = buildGraph(packet);
  const variance = buildVarianceReport(graph);
  const explained = explanations();
  const explainedKeys = new Set(explained.map((e) => e.key));

  const actors = new Map(packet.firm.staff.map((s) => [s.id, s.name]));

  return NextResponse.json({
    comparisons: buildComparisons(graph),
    areas: buildAreaSummaries(graph, variance, summarizeAll(), explainedKeys),
    variance,
    explanations: explained.map((e) => ({ ...e, actorName: actors.get(e.actorId) ?? e.actorId })),
  });
}
