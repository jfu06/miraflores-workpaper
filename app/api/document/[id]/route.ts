import { NextResponse } from "next/server";

import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";
import { buildDocumentDetail } from "@/lib/view/models";

/** One simulated source document: its pages, located highlights, and where its values landed. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const graph = buildGraph(loadPacket());
  const detail = buildDocumentDetail(graph, decodeURIComponent(id));

  if (!detail) {
    return NextResponse.json({ error: `No document "${decodeURIComponent(id)}"` }, { status: 404 });
  }
  return NextResponse.json(detail);
}
