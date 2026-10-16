import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/actor";
import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";
import { getClock } from "@/lib/time/server";
import { buildDocumentDetail } from "@/lib/view/models";

/**
 * One simulated source document: its pages, located highlights, and where its
 * values landed. Sensitive values are masked here, against the actor the server
 * resolves from the cookie, so nothing protected reaches the browser unasked.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const packet = loadPacket();
  const graph = buildGraph(packet, await getClock());
  const actor = await getActor(packet);
  const detail = buildDocumentDetail(graph, decodeURIComponent(id), actor);

  if (!detail) {
    return NextResponse.json({ error: `No document "${decodeURIComponent(id)}"` }, { status: 404 });
  }
  return NextResponse.json(detail);
}
