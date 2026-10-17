import { NextResponse } from "next/server";

import { actorIndex, getActor } from "@/lib/auth/actor";
import { canSignOff, deriveScope } from "@/lib/events/derive";
import { adjustedLineValues } from "@/lib/adjust/values";
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
import { appliedAdjustments, buildLedger } from "@/lib/adjust/ledger";
import { buildFormIndex, recompute } from "@/lib/adjust/recompute";
import {
  buildFilingState,
  buildSnapshot,
  canAdjust,
  canFile,
  openBlockingNotes,
} from "@/lib/filing/state";
import { createHash } from "node:crypto";
import { buildLookup } from "@/lib/events/lookup";
import type {
  AdjustmentApprovedPayload,
  AdjustmentPayload,
  AmendmentPayload,
  FilingPayload,
  AnswerPayload,
  CitePayload,
  QuestionPayload,
} from "@/lib/events/types";
import { resolveRef } from "@/lib/graph/graph";
import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";
import { getClock } from "@/lib/time/server";

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
  const clock = await getClock();
  const graph = buildGraph(packet, clock);
  const actor = await getActor(packet);

  const bad = (reason: string, status = 400) => NextResponse.json({ error: reason }, { status });

  /**
   * Replay is read-only.
   *
   * Recording work while the file is shown as it stood at an earlier moment
   * would be writing history, not replaying it — the event would carry today's
   * timestamp against a view of March.
   */
  if (!clock.live) {
    return bad(
      `The file is being shown as it stood on ${clock.asOf?.slice(0, 10)}. Return to live to record anything.`,
      409,
    );
  }

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

    case "filing": {
      const jurisdiction = String(body.payload?.jurisdiction ?? "");
      if (!["federal", "california"].includes(jurisdiction)) {
        return bad("A filing names a jurisdiction");
      }
      if (actor.role !== "partner" && actor.role !== "reviewer") {
        return bad(`${actor.name} is a ${actor.role} and cannot transmit a return.`, 403);
      }

      const names = new Map([
        ...packet.firm.staff.map((s) => [s.id, s.name] as const),
        ...packet.firm.client_users.map((c) => [c.id, c.name] as const),
      ]);
      const all = listAll(10_000);
      const ledger = buildLedger(all, (id) => names.get(id) ?? id);
      const state = buildFilingState(all, (id) => names.get(id) ?? id);

      /**
       * The firm's own standards stop a transmission, not just the UI. A
       * blocking review note is documented as stopping filing, so it does.
       */
      const blocking = openBlockingNotes(
        all,
        (id) => names.get(id) ?? id,
        (lineKey) => graph.lineByKey.get(lineKey)?.jurisdiction,
      );
      const allowed = canFile(state, blocking, jurisdiction);
      if (!allowed.ok) return bad(allowed.reason!, 409);

      const result = recompute(graph, appliedAdjustments(ledger), buildFormIndex(graph));
      const snapshot = buildSnapshot(graph, result.lines);

      /**
       * The submission identifier is the agency's, not ours: where the file
       * records an accepted transmission for this jurisdiction, that is the one
       * the filing refers to.
       */
      const accepted = (
        packet.tax_agency_records.efile as {
          jurisdiction: string;
          status: string;
          submission_id: string;
          date: string;
        }[]
      ).find((e) => e.jurisdiction === jurisdiction && e.status === "accepted");

      const payload: FilingPayload = {
        jurisdiction,
        submissionId: String(body.payload?.submissionId || accepted?.submission_id || ""),
        acceptedAt: String(body.payload?.acceptedAt || accepted?.date || new Date().toISOString()),
        snapshot,
        adjustmentEventIds: ledger.filter((e) => e.applied).map((e) => e.eventId),
        contentHash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
      };

      return NextResponse.json({
        event: append({ actorId: actor.id, type: "filing", scope: body.scope, payload }),
      });
    }

    case "amendment_opened": {
      const names = new Map(packet.firm.staff.map((s) => [s.id, s.name] as const));
      const state = buildFilingState(listAll(10_000), (id) => names.get(id) ?? id);
      if (!state.frozen) return bad("Nothing has been filed, so there is nothing to amend.");

      const reason = String(body.payload?.reason ?? "").trim();
      if (!reason) return bad("An amendment needs a reason");

      const payload: AmendmentPayload = { reason };
      return NextResponse.json({
        event: append({ actorId: actor.id, type: "amendment_opened", scope: body.scope, payload }),
      });
    }

    case "adjustment": {
      const names = new Map(packet.firm.staff.map((s) => [s.id, s.name] as const));
      const allowed = canAdjust(buildFilingState(listAll(10_000), (id) => names.get(id) ?? id));
      if (!allowed.ok) return bad(allowed.reason!, 409);

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

    case "question": {
      const text = String(body.payload?.text ?? "").trim();
      if (!text) return bad("A question needs text");

      const to = String(body.payload?.to ?? "").trim();
      if (!to) return bad("A question needs a recipient");
      if (to !== "client" && !packet.firm.staff.some((s) => s.id === to)) {
        return bad(`No colleague with id "${to}"`);
      }

      const payload: QuestionPayload = {
        to,
        text,
        findingId: body.payload?.findingId ? String(body.payload.findingId) : undefined,
      };
      return NextResponse.json({
        event: append({ actorId: actor.id, type: "question", scope: body.scope, payload }),
      });
    }

    case "answer": {
      const target = getById(String(body.payload?.targetEventId ?? ""));
      if (!target || target.type !== "question") return bad("No such question");

      const text = String(body.payload?.text ?? "").trim();
      if (!text) return bad("An answer needs text");

      const channel = String(body.payload?.channel ?? "portal");
      if (!["portal", "phone", "email", "document"].includes(channel)) {
        return bad(`Unknown channel: ${channel}`);
      }

      /**
       * How the answer arrived is part of the evidence, so it is recorded rather
       * than inferred. An answer recorded by a staff member on the client's
       * behalf says so, and says whose answer it is.
       */
      const asked = target.payload as QuestionPayload;
      const answeringForClient = asked.to === "client" && actor.role !== "client";
      const payload: AnswerPayload = {
        targetEventId: target.id,
        text,
        channel: channel as AnswerPayload["channel"],
        onBehalfOf: answeringForClient
          ? String(body.payload?.onBehalfOf ?? "the client")
          : undefined,
      };
      return NextResponse.json({
        event: append({ actorId: actor.id, type: "answer", scope: target.scope, payload }),
      });
    }

    case "cite": {
      const ref = String(body.payload?.ref ?? "").trim();
      if (!ref) return bad("A citation needs a reference");
      if (body.scope.kind !== "line") return bad("Evidence is attached to a line");
      if (!graph.lineByKey.get(body.scope.id)) return bad(`No line "${body.scope.id}"`);

      // A reference that does not resolve is not evidence.
      const resolved = resolveRef(graph, ref, buildLookup(packet, listAll(10_000)));
      if (!resolved.ok) return bad(`That reference does not resolve: ${resolved.reason}`);

      const payload: CitePayload = {
        ref,
        note: body.payload?.note ? String(body.payload.note) : undefined,
      };
      return NextResponse.json({
        event: append({ actorId: actor.id, type: "cite", scope: body.scope, payload }),
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

      const adjusted = adjustedLineValues(graph, listAll(10_000));
      const derived = deriveScope(graph, body.scope, actorIndex(packet), adjusted);
      const check = canSignOff(derived, actor, level);
      if (!check.ok) return bad(check.reason ?? "Not permitted", 403);

      // The server decides what is being signed.
      const { hash, facts, workEventIds } = contentHash(graph, body.scope, derived.live, adjusted);
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
