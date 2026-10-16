import { NextResponse } from "next/server";

import { allFindings, runChecks } from "@/lib/checks/run";
import { listAll } from "@/lib/events/store";
import type { FindingDismissedPayload, RevertPayload } from "@/lib/events/types";
import { buildGraph, resolveRef } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";
import { getClock } from "@/lib/time/server";

/**
 * What next year's preparer opens this file for.
 *
 * Carryovers are the obvious half; the other half is everything still unsettled,
 * because an open question does not close by the year ending. Each carryover is
 * reported with the line it came out of, so the figure arrives next year with its
 * derivation rather than as a number someone typed.
 */
export async function GET() {
  const packet = loadPacket();
  const graph = buildGraph(packet, await getClock());
  const current = graph.current;

  const events = listAll(10_000);
  const reverted = new Set<string>();
  for (const event of events) {
    if (event.type === "revert") {
      reverted.add((event.payload as RevertPayload).targetEventId);
      reverted.add(event.id);
    }
  }
  const dismissed = new Set(
    events
      .filter((e) => e.type === "finding_dismissed" && !reverted.has(e.id))
      .map((e) => (e.scope.id)),
  );

  const flatten = (
    value: unknown,
    prefix = "",
  ): { name: string; amount: number }[] => {
    if (typeof value === "number") return [{ name: prefix, amount: value }];
    if (value && typeof value === "object") {
      return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
        flatten(v, prefix ? `${prefix}.${k}` : k),
      );
    }
    return [];
  };

  const carryovers = (["federal", "california"] as const).map((jurisdiction) => ({
    jurisdiction,
    items: flatten(current.carryovers_out[jurisdiction])
      .filter((c) => c.amount !== 0)
      .map((c) => ({
        ...c,
        /** The line that produced it, where the return has one. */
        source: graph.current.lines.find((l) =>
          l.label.toLowerCase().includes(c.name.split(".").pop()!.replace(/_/g, " ")),
        )?.key,
      })),
    zeroed: flatten(current.carryovers_out[jurisdiction]).filter((c) => c.amount === 0).length,
  }));

  /** Basis that has to arrive next year with its history, gaps included. */
  const basis = Object.entries(packet.prior_years.basis_records).map(([name, entries]) => ({
    name,
    entries,
    ref: `py:/basis_records/${name}`,
  }));

  const openFindings = allFindings(runChecks(graph, new Set())).filter(
    (f) => !dismissed.has(f.id) && f.severity !== "low",
  );

  return NextResponse.json({
    taxYear: packet.household.tax_year,
    nextYear: packet.household.tax_year + 1,
    carryovers,
    basis,
    planning: packet.planning_reference_2026,
    /** The prior-year record this becomes, read through the same resolver. */
    priorYearRef: resolveRef(graph, "py:/carryovers_into_2025"),
    openItems: openFindings.map((f) => ({
      id: f.id,
      severity: f.severity,
      title: f.title,
      lineKey: f.scope?.kind === "line" ? f.scope.id : undefined,
    })),
    assetsWithDifferences: current.assets.filter(
      (a) => typeof a.california === "number" && a.california !== a.federal,
    ).length,
  });
}
