import { NextResponse } from "next/server";

import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";
import { getClock } from "@/lib/time/server";
import { buildDocumentIndex } from "@/lib/view/documents";

/** Every document, where it landed, and why it didn't. */
export async function GET() {
  const graph = buildGraph(loadPacket(), await getClock());
  const rows = buildDocumentIndex(graph);

  return NextResponse.json({
    documents: rows,
    counts: {
      total: rows.length,
      landed: rows.filter((r) => r.landedOn.length > 0).length,
      notLanded: rows.filter((r) => r.landedOn.length === 0).length,
      unexplained: rows.filter((r) => r.notLanded?.kind === "unexplained").length,
    },
    /** Lines in the current return, so the index can report its own coverage. */
    lineCount: graph.current.lines.length,
  });
}
