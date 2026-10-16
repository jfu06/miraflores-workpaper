import { NextResponse } from "next/server";

import { buildGraph, resolveRef } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";

/**
 * Resolve one reference.
 *
 * Taken as a query parameter rather than a path segment because several reference
 * formats contain slashes (`py:/carryovers_into_2025/capital_loss_short`).
 */
export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get("ref");
  if (!ref) return NextResponse.json({ error: "Missing ?ref=" }, { status: 400 });

  const graph = buildGraph(loadPacket());
  return NextResponse.json(resolveRef(graph, ref));
}
