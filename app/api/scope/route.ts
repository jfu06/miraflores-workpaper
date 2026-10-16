import { NextResponse } from "next/server";

import { actorIndex, getActor } from "@/lib/auth/actor";
import { canSignOff, deriveScope } from "@/lib/events/derive";
import { REVIEW_LEVELS, type Scope, type ScopeKind } from "@/lib/events/types";
import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";

const SCOPE_KINDS: ScopeKind[] = ["line", "document", "extracted_value", "return"];

/**
 * The work state of one scope: verifications, notes, review notes, sign-offs and
 * whether each sign-off still holds, plus which sign-offs this actor is allowed
 * to add. The permission check is returned with the state rather than inferred in
 * the browser, so the UI and the server cannot disagree about it.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") as ScopeKind | null;
  const id = params.get("id");

  if (!kind || !id || !SCOPE_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Expected ?kind=<scope kind>&id=<id>" }, { status: 400 });
  }

  const packet = loadPacket();
  const graph = buildGraph(packet);
  const actor = await getActor(packet);
  const scope: Scope = { kind, id };

  const derived = deriveScope(graph, scope, actorIndex(packet));

  return NextResponse.json({
    ...derived,
    actor,
    /** Colleagues a question can be addressed to. */
    staff: packet.firm.staff.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      sensitiveDataClearance: s.sensitive_data_clearance,
    })),
    signoffChecks: Object.fromEntries(
      REVIEW_LEVELS.map((level) => [level, canSignOff(derived, actor, level)]),
    ),
  });
}
