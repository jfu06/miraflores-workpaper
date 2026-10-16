import { NextResponse } from "next/server";

import { computeEffect, defaultCategory, requiresPartnerSignoff, type EffectCategory } from "@/lib/adjust/effect";
import { buildFormIndex, recompute } from "@/lib/adjust/recompute";
import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";
import { getClock } from "@/lib/time/server";

/**
 * Preview an adjustment before it is made: what it would be estimated at, and
 * what the arithmetic would actually carry through.
 *
 * Both are returned, because they answer different questions. The estimate is
 * what the firm's partner threshold is measured against; the recomputation is
 * what the return would say.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lineKey = params.get("line");
  const to = Number(params.get("to"));
  const chosen = params.get("category") as EffectCategory | null;

  const graph = buildGraph(loadPacket(), await getClock());
  const line = lineKey ? graph.lineByKey.get(lineKey) : undefined;

  if (!line || typeof line.value !== "number") {
    return NextResponse.json({ error: `No numeric line "${lineKey}"` }, { status: 404 });
  }
  if (!Number.isFinite(to)) {
    return NextResponse.json({ error: "A numeric ?to= is required" }, { status: 400 });
  }

  const category = chosen ?? defaultCategory(line);
  if (!category) {
    return NextResponse.json({
      from: line.value,
      defaultCategory: null,
      needsCategory: true,
    });
  }

  const effect = computeEffect(graph, to - line.value, category, line.jurisdiction);
  const forms = buildFormIndex(graph);
  const result = recompute(
    graph,
    [{ eventId: "preview", lineKey: line.key, from: line.value, to, reason: "preview" }],
    forms,
  );

  return NextResponse.json({
    from: line.value,
    defaultCategory: defaultCategory(line),
    category,
    effect,
    requiresPartner: requiresPartnerSignoff(effect),
    wouldMove: [...result.lines.values()]
      .filter((l) => l.key !== line.key)
      .map((l) => ({
        key: l.key,
        label: graph.lineByKey.get(l.key)?.label ?? l.key,
        from: l.original,
        to: l.value,
        provenance: l.provenance,
      })),
    barriers: result.barriers,
  });
}
