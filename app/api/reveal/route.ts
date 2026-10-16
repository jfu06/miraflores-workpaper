import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/actor";
import { isSensitive } from "@/lib/auth/mask";
import { append } from "@/lib/events/store";
import type { SensitiveViewPayload } from "@/lib/events/types";
import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";
import { getClock } from "@/lib/time/server";

/**
 * Reveal one masked value.
 *
 * Clearance is checked here and the disclosure is appended to the event log
 * before the value is returned, so the log cannot be out of step with what was
 * actually shown. A refusal is logged nowhere and discloses nothing.
 */
export async function POST(request: Request) {
  const { evId } = (await request.json()) as { evId?: string };
  const packet = loadPacket();
  const clock = await getClock();
  const graph = buildGraph(packet, clock);
  const actor = await getActor(packet);

  const ev = evId ? graph.evById.get(evId) : undefined;
  if (!ev) return NextResponse.json({ error: `No extracted value ${evId}` }, { status: 404 });

  if (!isSensitive(ev.value_type, ev.field)) {
    return NextResponse.json({ value: ev.value, logged: false });
  }

  if (!actor.sensitiveDataClearance) {
    return NextResponse.json(
      {
        error: `${actor.name} does not have sensitive-data clearance.`,
        rule: "Staff without sensitive-data clearance see SSNs, bank and account numbers and IP PINs masked.",
      },
      { status: 403 },
    );
  }

  const payload: SensitiveViewPayload = { ref: ev.id, field: ev.field };
  const event = append({
    actorId: actor.id,
    type: "sensitive_view",
    scope: { kind: "extracted_value", id: ev.id },
    payload,
  });

  return NextResponse.json({ value: ev.value, logged: true, eventId: event.id });
}
