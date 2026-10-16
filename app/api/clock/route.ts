import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { buildLedger } from "@/lib/adjust/ledger";
import { buildFilingState } from "@/lib/filing/state";
import { listAll } from "@/lib/events/store";
import { ASOF_COOKIE, parseClock } from "@/lib/time/clock";
import { getClock } from "@/lib/time/server";
import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";

/** The timeline, the current position, and what sits at each stop. */
export async function GET() {
  const packet = loadPacket();
  const clock = await getClock();
  const events = listAll(10_000);

  const names = new Map([
    ...packet.firm.staff.map((s) => [s.id, s.name] as const),
    ...packet.firm.client_users.map((c) => [c.id, c.name] as const),
  ]);

  const graph = buildGraph(packet, clock);

  return NextResponse.json({
    clock,
    beforeFirstRun: graph.beforeFirstRun,
    currentVersion: graph.current.version,
    documentsInView: graph.documents.length,
    filing: buildFilingState(events, (id) => names.get(id) ?? id),
    timeline: packet.timeline.map((event) => ({
      ...event,
      actorName: event.actor ? (names.get(event.actor) ?? event.actor) : null,
    })),
    versions: packet.return_versions.map((v) => ({
      version: v.version,
      computedAt: v.computed_at,
      trigger: v.trigger,
      documentsUsed: v.documents_used.length,
      summary: v.summary,
    })),
    efile: packet.tax_agency_records.efile,
    /** Work recorded in this workpaper, so replay covers it too. */
    workEvents: events.map((e) => ({ id: e.id, at: e.at, type: e.type, scope: e.scope })),
    ledgerEntries: buildLedger(events, (id) => names.get(id) ?? id).length,
  });
}

/** Move the clock, or return to live. */
export async function POST(request: Request) {
  const { asOf } = (await request.json()) as { asOf?: string | null };
  const store = await cookies();

  if (!asOf) {
    store.delete(ASOF_COOKIE);
    return NextResponse.json({ clock: { live: true } });
  }

  const clock = parseClock(asOf);
  if (clock.live) return NextResponse.json({ error: "Not a valid instant" }, { status: 400 });

  store.set(ASOF_COOKIE, clock.asOf!, { httpOnly: true, sameSite: "lax", path: "/" });
  return NextResponse.json({ clock });
}
