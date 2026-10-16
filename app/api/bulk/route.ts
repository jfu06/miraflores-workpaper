import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/actor";
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
