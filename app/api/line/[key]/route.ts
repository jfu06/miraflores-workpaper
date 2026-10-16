import { NextResponse } from "next/server";

import { buildLookup } from "@/lib/events/lookup";
import { listAll, listForScope } from "@/lib/events/store";
import type { CitePayload, RevertPayload } from "@/lib/events/types";
import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";
import { getClock } from "@/lib/time/server";
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
  const packet = loadPacket();
  const graph = buildGraph(packet, await getClock());
  const lineKey = decodeURIComponent(key);

  const all = listAll(10_000);
  const lookup = buildLookup(packet, all);

  const reverted = new Set<string>();
  for (const event of all) {
    if (event.type === "revert") {
      reverted.add((event.payload as RevertPayload).targetEventId);
      reverted.add(event.id);
    }
  }

  const names = new Map([
    ...packet.firm.staff.map((s) => [s.id, s.name] as const),
    ...packet.firm.client_users.map((c) => [c.id, c.name] as const),
  ]);

  const citations = listForScope({ kind: "line", id: lineKey })
    .filter((e) => e.type === "cite" && !reverted.has(e.id))
    .map((e) => ({
      ref: (e.payload as CitePayload).ref,
      note: (e.payload as CitePayload).note,
      by: names.get(e.actorId) ?? e.actorId,
      at: e.at,
    }));

  const detail = buildLineDetail(graph, lineKey, { citations, lookup });

  if (!detail) {
    return NextResponse.json({ error: `No line "${lineKey}"` }, { status: 404 });
  }
  return NextResponse.json(detail);
}
