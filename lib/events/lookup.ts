import type { WorkpaperLookup } from "../graph/graph";
import type { Packet } from "../packet/types";
import type { WorkpaperEvent } from "./types";

/**
 * The bridge that lets `resolveRef` reach records this workpaper produced.
 *
 * Built per request from the event log and the firm's roster, so the fact graph
 * stays what it is: an immutable index over the packet.
 */
export function buildLookup(packet: Packet, events: WorkpaperEvent[]): WorkpaperLookup {
  const byId = new Map(events.map((e) => [e.id, e]));
  const names = new Map([
    ...packet.firm.staff.map((s) => [s.id, s.name] as const),
    ...packet.firm.client_users.map((c) => [c.id, c.name] as const),
  ]);

  return {
    event: (id) => byId.get(id) ?? null,
    actorName: (id) => names.get(id) ?? id,
  };
}
