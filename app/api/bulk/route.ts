import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/actor";
import { buildFilingState, canAdjust } from "@/lib/filing/state";
import { computeEffect, defaultCategory, requiresPartnerSignoff } from "@/lib/adjust/effect";
import { allFindings, runChecks } from "@/lib/checks/run";
import { appendGroup, listAll } from "@/lib/events/store";
import type { AdjustmentPayload, AppendEvent, RevertPayload } from "@/lib/events/types";
import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";
import { getClock } from "@/lib/time/server";

/**
 * Acting on many items at once, and undoing it.
 *
 * A bulk action writes its events under one group id, so undoing it is one
 * action too — a group of compensating `revert` events, appended, never a delete.
 * Both halves go through the ordinary event store, so nothing about bulk work is
 * a special case in the record.
 *
 * The only figures that can be applied in bulk are ones a check can state
 * exactly, because the right answer is a fact in another record. Anything needing
 * judgment is adjusted one at a time, with a reason.
 *
 * Doing many at once changes how much is written, never what is allowed. This
 * route therefore applies the same two rules the one-at-a-time path applies —
 * the filing freeze, and who may withdraw someone else's entry — rather than
 * restating them. A second path that writes the same events under weaker rules
 * is not a bulk action; it is a way around the rules.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    action: "apply_findings" | "undo_group";
    findingIds?: string[];
    groupId?: string;
  };

  const packet = loadPacket();
  const clock = await getClock();
  const graph = buildGraph(packet, clock);
  const actor = await getActor(packet);

  if (!clock.live) {
    return NextResponse.json(
      { error: "Replay is read-only. Return to live to record anything." },
      { status: 409 },
    );
  }

  const packetNames = new Map(packet.firm.staff.map((s) => [s.id, s.name] as const));
  const filing = buildFilingState(listAll(10_000), (id) => packetNames.get(id) ?? id);
  const mayAdjust = canAdjust(filing);
  if (!mayAdjust.ok) {
    return NextResponse.json({ error: mayAdjust.reason }, { status: 409 });
  }

  if (body.action === "undo_group") {
    const groupId = body.groupId;
    if (!groupId) return NextResponse.json({ error: "Missing groupId" }, { status: 400 });

    const events = listAll(10_000);
    const already = new Set(
      events
        .filter((e) => e.type === "revert")
        .map((e) => (e.payload as RevertPayload).targetEventId),
    );
    const members = events.filter((e) => e.groupId === groupId && !already.has(e.id));
    if (members.length === 0) {
      return NextResponse.json({ error: "Nothing in that group is still in force" }, { status: 400 });
    }

    // Withdrawing is the author's to do, or a reviewer's — the same rule one
    // entry at a time. A group whose members are not all the actor's own needs
    // the reviewer's standing, so the whole group is refused rather than part.
    const isReviewer = actor.role === "reviewer" || actor.role === "partner";
    const others = members.filter((m) => m.actorId !== actor.id);
    if (!isReviewer && others.length > 0) {
      return NextResponse.json(
        {
          error: `${actor.name} may only withdraw their own entries, and ${others.length} of these ${
            others.length === 1 ? "is" : "are"
          } not.`,
        },
        { status: 403 },
      );
    }

    const written = appendGroup(
      members.map((member) => ({
        actorId: actor.id,
        type: "revert" as const,
        scope: member.scope,
        payload: { targetEventId: member.id, reason: "Bulk action undone." },
      })),
    );
    return NextResponse.json({ undone: written.length, groupId: written[0]?.groupId });
  }

  const ids = new Set(body.findingIds ?? []);
  if (ids.size === 0) return NextResponse.json({ error: "No findings selected" }, { status: 400 });

  const findings = allFindings(runChecks(graph, new Set())).filter(
    (f) => ids.has(f.id) && f.suggestedAdjustment,
  );
  if (findings.length === 0) {
    return NextResponse.json(
      { error: "None of the selected findings carry a figure that can be applied" },
      { status: 400 },
    );
  }

  const events: AppendEvent[] = findings.map((finding) => {
    const suggestion = finding.suggestedAdjustment!;
    const line = graph.lineByKey.get(suggestion.lineKey)!;
    const category = defaultCategory(line) ?? "direct";
    const effect = computeEffect(graph, suggestion.to - suggestion.from, category, line.jurisdiction);

    const payload: AdjustmentPayload = {
      from: suggestion.from,
      to: suggestion.to,
      reason: `${suggestion.reason} Applied from ${finding.checkId}.`,
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

    return {
      actorId: actor.id,
      type: "adjustment",
      scope: { kind: "line", id: suggestion.lineKey },
      payload,
    };
  });

  const written = appendGroup(events);
  return NextResponse.json({
    applied: written.length,
    groupId: written[0]?.groupId,
    lines: findings.map((f) => f.suggestedAdjustment!.lineKey),
  });
}
