import { NextResponse } from "next/server";

import { listAll } from "@/lib/events/store";
import { balanceMovements, buildLedger, appliedAdjustments, summariseEffect } from "@/lib/adjust/ledger";
import { buildFormIndex, recompute } from "@/lib/adjust/recompute";
import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";

/**
 * The return as adjusted: the ledger, what each adjustment moved, and where the
 * change could not be carried any further.
 */
export async function GET() {
  const packet = loadPacket();
  const graph = buildGraph(packet);

  const names = new Map([
    ...packet.firm.staff.map((s) => [s.id, s.name] as const),
    ...packet.firm.client_users.map((c) => [c.id, c.name] as const),
  ]);

  const ledger = buildLedger(listAll(10_000), (id) => names.get(id) ?? id);
  const forms = buildFormIndex(graph);
  const result = recompute(graph, appliedAdjustments(ledger), forms);

  const lines = [...result.lines.values()].map((line) => ({
    ...line,
    label: graph.lineByKey.get(line.key)?.label ?? line.key,
    form: graph.lineByKey.get(line.key)?.form ?? "",
    line: graph.lineByKey.get(line.key)?.line ?? "",
  }));

  const movements = balanceMovements(graph, result);

  return NextResponse.json({
    ledger,
    movements,
    /**
     * Which jurisdictions the recomputation carried all the way to a balance.
     * Where it did, the rate estimate for that jurisdiction is superseded.
     */
    recomputedJurisdictions: [...new Set(movements.filter((m) => m.provenance === "recomputed").map((m) => m.jurisdiction))],
    summary: summariseEffect(ledger),
    lines,
    barriers: result.barriers,
    unknownBeyond: result.unknownBeyond,
    recomputableLines: forms.forms.size,
    unrecoverableLines: forms.unsolved.size,
    engineSummary: graph.current.summary,
  });
}
