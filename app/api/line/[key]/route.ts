import { NextResponse } from "next/server";

import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";
import { buildLineDetail } from "@/lib/view/models";

/**
 * Detail for one return line.
 *
 * Served per click rather than shipped with the page: the current return has 627
 * lines whose resolved sources run to thousands of references, and the browser
 * only ever needs the one the reviewer is looking at. This is also the choke point
 * where role-based masking and sensitive-view logging will go.
 */
export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  const graph = buildGraph(loadPacket());
  const detail = buildLineDetail(graph, decodeURIComponent(key));

  if (!detail) {
    return NextResponse.json({ error: `No line "${decodeURIComponent(key)}"` }, { status: 404 });
  }
  return NextResponse.json(detail);
}
