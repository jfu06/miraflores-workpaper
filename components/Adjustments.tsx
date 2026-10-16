"use client";

import { useState } from "react";

import type { BalanceMovement, LedgerEntry } from "@/lib/adjust/ledger";
import type { Provenance } from "@/lib/adjust/recompute";
import { CATEGORY_LABEL, type EffectCategory } from "@/lib/adjust/effect";
import { appendEvent } from "@/lib/view/client";
import { formatMoney } from "@/lib/view/format";
import { Chip, Section } from "./ui";

export interface AdjustedData {
  ledger: LedgerEntry[];
  movements: BalanceMovement[];
  recomputedJurisdictions: ("federal" | "california")[];
  summary: {
    appliedCount: number;
    pendingCount: number;
    appliedFederal: number;
    appliedCalifornia: number;
    pendingFederal: number;
    pendingCalifornia: number;
  };
  lines: {
    key: string;
    label: string;
    value: number;
    original: number;
    provenance: Provenance;
    limitation?: string;
  }[];
  barriers: { key: string; reason: string }[];
  unknownBeyond: string[];
  recomputableLines: number;
  unrecoverableLines: number;
}

export const PROVENANCE_TONE: Record<Provenance, "accent" | "neutral" | "warn" | "quiet"> = {
  engine: "quiet",
  manual: "accent",
  recomputed: "accent",
  estimated: "warn",
};

export const PROVENANCE_NOTE: Record<Provenance, string> = {
  engine: "The figure the engine published, untouched.",
  manual: "Set by a person, with a reason, over the engine's figure.",
  recomputed:
    "Derived from the adjusted inputs by arithmetic recovered from the engine's own numbers and verified against them. Exact.",
  estimated:
    "Not derivable here. The effect is approximated from the packet's per-dollar rates, measured at this version's numbers.",
};

export function Adjustments({
  data,
  onSelect,
  onChanged,
}: {
  data: AdjustedData | null;
  onSelect: (key: string) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  if (!data) return <Section title="Adjustments">Loading…</Section>;

  const groups = [...new Set(data.ledger.map((e) => e.groupId).filter(Boolean))] as string[];

  return (
    <>
      <div className="border-b border-edge px-4 py-2.5 text-[11px] text-muted">
        Every number in this return is one of four things, and the workpaper says which.{" "}
        <span className="text-foreground">{data.recomputableLines}</span> lines have arithmetic
        recovered from the engine&rsquo;s own figures and verified against them;{" "}
        <span className="text-foreground">{data.unrecoverableLines}</span> do not, and a change
        cannot be carried through those.
      </div>

      {data.movements.length > 0 && (
        <Section title="What this changes">
          <ul className="space-y-1">
            {data.movements.map((movement) => (
              <li key={movement.key} className="flex items-baseline gap-2">
                <Chip tone={PROVENANCE_TONE[movement.provenance]} title={PROVENANCE_NOTE[movement.provenance]}>
                  {movement.provenance}
                </Chip>
                <button
                  onClick={() => onSelect(movement.key)}
                  className="min-w-0 flex-1 truncate text-left text-[12px] hover:text-accent"
                >
                  {movement.jurisdiction === "california" ? "California" : "Federal"} &middot;{" "}
                  {movement.label}
                </button>
                <span className="tnum shrink-0 text-[12px] text-muted">
                  {formatMoney(movement.from)}
                </span>
                <span className="shrink-0 text-[10px] text-muted">&rarr;</span>
                <span className="tnum shrink-0 text-[12px] font-medium">
                  {formatMoney(movement.to)}
                </span>
                <span
                  className={`tnum w-20 shrink-0 text-right text-[12px] ${
                    movement.delta > 0 ? "text-bad" : "text-accent"
                  }`}
                >
                  {movement.delta > 0 ? "+" : ""}
                  {formatMoney(movement.delta)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] leading-relaxed text-muted">
            These are recomputed, not estimated: the change was carried to the balance by
            arithmetic that reproduces every figure the engine published. Where that is true, the
            per-dollar estimate recorded with the adjustment is superseded and is kept only as the
            measure the firm&rsquo;s partner threshold was applied to.
          </p>
        </Section>
      )}

      <Section title={`Ledger · ${data.ledger.length}`}>
        {data.ledger.length === 0 ? (
          <p className="text-[12px] text-muted">
            Nothing adjusted. The return is the engine&rsquo;s v3 as published.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {data.ledger.map((entry) => (
              <li
                key={entry.eventId}
                className={`rounded border px-2 py-1.5 ${
                  entry.applied ? "border-edge" : "border-[#f0e0bd] bg-warn-soft"
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <button
                    onClick={() => onSelect(entry.lineKey)}
                    className="shrink-0 font-mono text-[10px] text-muted hover:text-accent"
                  >
                    {entry.lineKey}
                  </button>
                  <span className="tnum text-[12px] text-muted">{formatMoney(entry.from)}</span>
                  <span className="text-[10px] text-muted">&rarr;</span>
                  <span className="tnum text-[12px] font-medium">{formatMoney(entry.to)}</span>
                  <span className="ml-auto shrink-0">
                    {entry.applied ? (
                      <Chip tone="accent">applied</Chip>
                    ) : (
                      <Chip tone="warn">awaiting partner</Chip>
                    )}
                  </span>
                </div>

                <p className="mt-0.5 text-[11px]">{entry.reason}</p>

                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                  <Chip tone="quiet">
                    {CATEGORY_LABEL[entry.category as EffectCategory] ?? entry.category}
                  </Chip>
                  <span className="tnum">
                    estimated effect: federal {formatMoney(entry.effect.federal)}, California{" "}
                    {formatMoney(entry.effect.california)}
                  </span>
                  <span>
                    · {entry.actorName}, {entry.at.slice(0, 10)}
                  </span>
                  {entry.approvedBy && (
                    <span>
                      · approved by {entry.approvedBy}, {entry.approvedAt?.slice(0, 10)}
                    </span>
                  )}
                </div>

                {!entry.applied && (
                  <div className="mt-1.5 flex items-center gap-2 border-t border-[#f0e0bd] pt-1.5">
                    <span className="text-[10px] text-warn">
                      Effect over 1,000 — the firm&rsquo;s standards require partner sign-off before
                      this moves the return.
                    </span>
                    <button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await appendEvent({
                            type: "adjustment_approved",
                            scope: { kind: "line", id: entry.lineKey },
                            payload: { targetEventId: entry.eventId },
                          });
                          onChanged();
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="ml-auto shrink-0 rounded border border-edge bg-surface px-2 py-0.5 text-[10px] font-medium transition hover:border-accent hover:text-accent disabled:opacity-40"
                    >
                      Approve as partner
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {groups.length > 0 && (
          <div className="mt-2 border-t border-edge pt-2">
            {groups.map((groupId) => {
              const members = data.ledger.filter((e) => e.groupId === groupId);
              return (
                <div key={groupId} className="flex items-center gap-2 py-0.5">
                  <span className="text-[11px] text-muted">
                    {members.length} applied together
                  </span>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await fetch("/api/bulk", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "undo_group", groupId }),
                        });
                        onChanged();
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="rounded border border-edge px-1.5 py-0.5 text-[10px] font-medium transition hover:border-bad hover:text-bad disabled:opacity-40"
                  >
                    Undo all
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {data.barriers.length > 0 && (
        <Section title={`Where the change stopped · ${data.barriers.length}`}>
          <ul className="space-y-1">
            {data.barriers.map((barrier) => (
              <li key={barrier.key} className="text-[11px]">
                <button
                  onClick={() => onSelect(barrier.key)}
                  className="font-mono text-[10px] hover:text-accent"
                >
                  {barrier.key}
                </button>
                <span className="ml-1.5 text-muted">{barrier.reason}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-muted">
            Beyond these the figures are unknown, not approximately known, so nothing downstream is
            restated.
            {data.unknownBeyond.length > 0 && ` ${data.unknownBeyond.length} lines sit beyond them.`}
          </p>
        </Section>
      )}
    </>
  );
}
