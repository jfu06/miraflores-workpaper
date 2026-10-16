import { NextResponse } from "next/server";

import { actorIndex, getActor } from "@/lib/auth/actor";
import { canSignOff, deriveScope } from "@/lib/events/derive";
import { contentHash } from "@/lib/events/hash";
import { append, getById, listAll } from "@/lib/events/store";
import type {
  EventPayload,
  EventType,
  ReviewLevel,
  RevertPayload,
  Scope,
  SignoffPayload,
} from "@/lib/events/types";
import { REVIEW_LEVELS, VERIFICATION_TYPES } from "@/lib/events/types";
import { computeEffect, defaultCategory, requiresPartnerSignoff, type EffectCategory } from "@/lib/adjust/effect";
import type { AdjustmentApprovedPayload, AdjustmentPayload } from "@/lib/events/types";
import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 200);
  const packet = loadPacket();
  const actors = actorIndex(packet);

  return NextResponse.json({
    events: listAll(limit).map((event) => ({
      ...event,
      actor: actors.get(event.actorId) ?? null,
    })),
  });
}

interface Body {
  type: EventType;
  scope: Scope;
  payload: Record<string, unknown>;
}

/**
 * Append one event.
 *
 * The firm's standards are enforced here, not in the UI. Two things in
 * particular are decided by the server and cannot be supplied by the caller:
 * who is acting (read from the cookie) and, for a sign-off, what is being signed
 * (the content hash, computed from the graph at this moment). A client that
 * claimed either could sign something other than what it displayed.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  const packet = loadPacket();
  const graph = buildGraph(packet);
  const actor = await getActor(packet);

  const bad = (reason: string, status = 400) => NextResponse.json({ error: reason }, { status });

  if (!body?.scope?.kind || !body.scope.id) return bad("Missing scope");

  switch (body.type) {
    case "verification": {
      const verificationType = body.payload?.verificationType as string;
      if (!VERIFICATION_TYPES.includes(verificationType as never)) {
        return bad(`Unknown verification type: ${verificationType}`);
      }
      break;
    }

    case "note":
    case "review_note":
    case "variance_explained": {
      if (!String(body.payload?.text ?? "").trim()) return bad("A note needs text");
      break;
    }

    case "adjustment": {
      const line = graph.lineByKey.get(body.scope.id);
      if (!line) return bad(`No line "${body.scope.id}"`);
      if (typeof line.value !== "number") return bad("Only numeric lines can be adjusted");

      const to = Number(body.payload?.to);
      if (!Number.isFinite(to)) return bad("A new value is required");

      const reason = String(body.payload?.reason ?? "").trim();
      if (!reason) return bad("An adjustment requires a reason");

      const category = (body.payload?.category as EffectCategory) ?? defaultCategory(line);
      if (!category) {
        return bad(
          "This line has no default tax-effect category; choose one so the effect can be estimated.",
        );
      }

      // The effect decides whether a partner is required, so the server computes it.
      const effect = computeEffect(graph, to - line.value, category, line.jurisdiction);
      const payload: AdjustmentPayload = {
        from: line.value,
        to,
        reason,
        category,
        effect: {
          federal: effect.federal,
          california: effect.california,
          basis: effect.basis,
          federalRate: effect.federalRate,
          californiaRate: effect.californiaRate,
          caveats: effect.caveats,
        },
        requiresPartner: requiresPartnerSignoff(effect),
      };

      return NextResponse.json({
        event: append({ actorId: actor.id, type: "adjustment", scope: body.scope, payload }),
      });
    }

    case "adjustment_approved": {
      const target = getById(String(body.payload?.targetEventId ?? ""));
      if (!target || target.type !== "adjustment") return bad("No such adjustment");
      if (actor.role !== "partner") {
        return bad(`${actor.name} is a ${actor.role} and cannot approve an adjustment.`, 403);
      }
      if (target.actorId === actor.id) {
        return bad(`${actor.name} proposed this adjustment and may not also approve it.`, 403);
      }
      const payload: AdjustmentApprovedPayload = {
        targetEventId: target.id,
        note: body.payload?.note ? String(body.payload.note) : undefined,
      };
      return NextResponse.json({
        event: append({
          actorId: actor.id,
          type: "adjustment_approved",
          scope: body.scope,
          payload,
        }),
      });
    }

    case "finding_dismissed": {
      // A dismissal without a reason is a deletion wearing a different name.
      if (!String(body.payload?.reason ?? "").trim()) {
        return bad("Dismissing a finding requires a reason");
      }
      break;
    }

    case "required_step":
      break;

    case "review_note_resolved": {
      const target = getById(String(body.payload?.targetEventId ?? ""));
      if (!target || target.type !== "review_note") return bad("No such review note");
      break;
    }

    case "revert": {
      const target = getById(String(body.payload?.targetEventId ?? ""));
      if (!target) return bad("No such event");
      if (target.scope.kind !== body.scope.kind || target.scope.id !== body.scope.id) {
        return bad("Event belongs to a different scope");
      }
      // Withdrawing someone else's work is a review action, not a peer one.
      const isAuthor = target.actorId === actor.id;
      const isReviewer = actor.role === "reviewer" || actor.role === "partner";
      if (!isAuthor && !isReviewer) {
        return bad(`${actor.name} may only withdraw their own entries.`, 403);
      }
      break;
    }

    case "signoff": {
      const level = body.payload?.level as ReviewLevel;
      if (!REVIEW_LEVELS.includes(level)) return bad(`Unknown review level: ${level}`);

      const derived = deriveScope(graph, body.scope, actorIndex(packet));
      const check = canSignOff(derived, actor, level);
      if (!check.ok) return bad(check.reason ?? "Not permitted", 403);

      // The server decides what is being signed.
      const { hash, facts, workEventIds } = contentHash(graph, body.scope, derived.live);
      const payload: SignoffPayload = { level, contentHash: hash, facts, workEventIds };

      return NextResponse.json({
        event: append({ actorId: actor.id, type: "signoff", scope: body.scope, payload }),
      });
    }

    case "sensitive_view":
      return bad("Sensitive views are recorded by /api/reveal, not appended directly.", 403);

    default:
      return bad(`Unknown event type: ${body.type}`);
  }

  const event = append({
    actorId: actor.id,
    type: body.type,
    scope: body.scope,
    payload: body.payload as unknown as EventPayload,
  });

  return NextResponse.json({ event });
}

export type { RevertPayload };
