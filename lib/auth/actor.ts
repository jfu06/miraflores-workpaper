import { cookies } from "next/headers";

import type { Packet } from "../packet/types";
import type { ActorInfo } from "../events/derive";

/**
 * Who is acting.
 *
 * Held in a cookie and read on the server, not passed from the client. That
 * matters: masking and the view log are only meaningful if the server decides
 * what the browser is allowed to receive. A role switcher that merely hides
 * values in the UI still ships them, and anyone can read them.
 */
export const ACTOR_COOKIE = "workpaper_actor";

export function listActors(packet: Packet): ActorInfo[] {
  const staff = packet.firm.staff.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    sensitiveDataClearance: s.sensitive_data_clearance,
  }));

  // Client users hold no firm clearance; they see their own return, masked.
  const clients = packet.firm.client_users.map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    sensitiveDataClearance: false,
  }));

  return [...staff, ...clients];
}

export function actorIndex(packet: Packet): Map<string, ActorInfo> {
  return new Map(listActors(packet).map((a) => [a.id, a]));
}

/** The engagement's assigned preparer, used until a role is chosen. */
function defaultActorId(packet: Packet): string {
  return packet.firm.assignment_at_start.preparer;
}

export async function getActor(packet: Packet): Promise<ActorInfo> {
  const store = await cookies();
  const id = store.get(ACTOR_COOKIE)?.value;
  const index = actorIndex(packet);
  return index.get(id ?? "") ?? index.get(defaultActorId(packet))!;
}
