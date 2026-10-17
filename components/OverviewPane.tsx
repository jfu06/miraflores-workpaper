"use client";

import { useMemo, useState } from "react";

import type { AreaSummaryRow, Comparison } from "@/lib/view/overview";
import type { VarianceReport, VarianceRow } from "@/lib/view/variance";
import { appendEvent } from "@/lib/view/client";
import { formatMoney, formatValue } from "@/lib/view/format";
import { OpenItems, type ChecksData } from "./OpenItems";
import { Adjustments, type AdjustedData } from "./Adjustments";
import { Season, type SeasonData } from "./Season";
import { After } from "./After";
import { Documents } from "./Documents";
import { Sales } from "./Sales";
import type { FilingState } from "@/lib/filing/state";
import { Chip, Empty, PaneHeader, Section } from "./ui";

export interface Overview {
  comparisons: Comparison[];
  areas: AreaSummaryRow[];
  variance: VarianceReport;
  explanations: { key: string; text: string; actorName: string; at: string }[];
}

type Tab =
  | "summary"
  | "areas"
  | "documents"
  | "sales"
  | "variances"
  | "open"
  | "adjustments"
  | "timeline"
  | "after";

/**
 * What a reviewer sees on opening the file.
 *
 * This occupies the middle pane whenever no line is selected, so the landing
 * state is the return against last year and the state of each area, rather than
 * an empty panel waiting to be told what to show.
 */
export function OverviewPane({
  data,
  checks,
  adjusted,
  season,
  filing,
  onClockMoved,
  onSelect,
  onOpenRef,
  onChanged,
}: {
  data: Overview | null;
  checks: ChecksData | null;
  adjusted: AdjustedData | null;
  season: SeasonData | null;
  filing: FilingState | null;
  onClockMoved: () => void;
  onSelect: (key: string) => void;
  onOpenRef: (ref: string) => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("summary");

  if (!data) {
    return (
      <div className="flex h-full flex-col">
        <PaneHeader eyebrow="Overview" title="Return summary" />
        <Empty>Loading…</Empty>
      </div>
    );
  }

  const { variance } = data;
  // Closed is closed, however it was closed: dismissed with a reason, or corrected.
  const closed = new Set([
    ...(checks?.dismissals ?? []).map((d) => d.findingId),
    ...(checks?.addressed ?? []).map((a) => a.findingId),
  ]);
  const openCount = (checks?.findings ?? []).filter((f) => !closed.has(f.id)).length;
  const adjustedCount = adjusted?.ledger.length ?? 0;
  const unexplained = variance.rows.filter(
    (r) => r.flagged && !data.explanations.some((e) => e.key === r.key),
  ).length;

  return (
    <div className="flex h-full flex-col">
      <PaneHeader
        eyebrow="Overview"
        title="This return, against last year"
        right={
          <div className="flex rounded border border-edge p-0.5">
            {(
              [
                "summary",
                "areas",
                "documents",
                "sales",
                "variances",
                "open",
                "adjustments",
                "timeline",
                "after",
              ] as Tab[]
            ).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded px-2 py-0.5 text-[11px] font-medium capitalize transition ${
                  tab === t ? "bg-accent text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {t === "variances"
                  ? `Variances ${variance.flaggedCount}`
                  : t === "open"
                    ? `Open items ${openCount}`
                    : t === "adjustments"
                      ? `Adjustments${adjustedCount ? ` ${adjustedCount}` : ""}`
                      : t === "after"
                        ? "After filing"
                        : t}
              </button>
            ))}
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "summary" && (
          <>
            {data.comparisons.map((comparison) => (
              <Section
                key={comparison.jurisdiction}
                title={comparison.jurisdiction === "federal" ? "Federal" : "California"}
              >
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.06em] text-muted">
                      <th className="pb-1 text-left font-semibold">&nbsp;</th>
                      <th className="pb-1 text-right font-semibold">2024</th>
                      <th className="pb-1 text-right font-semibold">2025</th>
                      <th className="pb-1 text-right font-semibold">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.rows.map((row) => (
                      <tr key={row.label} className="border-t border-edge">
                        <td className="py-1 text-[12px]">
                          {row.label}
                          {row.caveat && (
                            <span title={row.caveat} className="ml-1 cursor-help text-warn">
                              &#9888;
                            </span>
                          )}
                        </td>
                        <td className="tnum py-1 text-right text-[12px] text-muted">
                          {row.prior === undefined ? "—" : formatMoney(row.prior)}
                        </td>
                        <td className="tnum py-1 text-right text-[12px] font-medium">
                          {formatMoney(row.current)}
                        </td>
                        <td
                          className={`tnum py-1 text-right text-[12px] ${
                            (row.delta ?? 0) > 0 ? "text-bad" : "text-accent"
                          }`}
                        >
                          {row.delta === undefined
                            ? ""
                            : `${row.delta > 0 ? "+" : ""}${formatMoney(row.delta)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            ))}

            <Section title="Last year">
              <p className="text-[12px] leading-relaxed">
                Prepared by {variance.priorYear.preparedBy}, filed{" "}
                {variance.priorYear.filed}. {variance.priorYear.residency}.
              </p>
              <p className="mt-1 text-[11px] text-muted">
                The household moved to Texas in July 2025, so the California return changed from
                Form 540 to Form 540NR. The two forms do not share line numbers, and this
                workpaper does not guess a mapping between them — {variance.unmatchedCount} prior
                lines are reported as unmatched instead.
              </p>
            </Section>
          </>
        )}

        {tab === "areas" && (
          <Section title={`Areas · ${data.areas.length}`}>
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.06em] text-muted">
                  <th className="pb-1 text-left font-semibold">Area</th>
                  <th className="pb-1 text-right font-semibold" title="Lines in this area">
                    Lines
                  </th>
                  <th className="pb-1 text-right font-semibold" title="Flagged prior-year variances">
                    Flags
                  </th>
                  <th className="pb-1 text-right font-semibold" title="Engine warnings">
                    Warn
                  </th>
                  <th className="pb-1 text-right font-semibold" title="Lines with a verification">
                    Verified
                  </th>
                  <th className="pb-1 text-right font-semibold" title="Budget hours">
                    Budget
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.areas.map((area) => (
                  <tr key={area.area} className="border-t border-edge align-top">
                    <td className="py-1.5 text-[12px]">
                      <div className="font-medium">{area.label}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {area.forms.slice(0, 5).map((f) => (
                          <span key={f} className="font-mono text-[9px] text-muted">
                            {f}
                          </span>
                        ))}
                        {area.openBlocking > 0 && <Chip tone="bad">{area.openBlocking} blocking</Chip>}
                        {area.unmatchedPriorLines > 0 && (
                          <Chip tone="quiet">{area.unmatchedPriorLines} unmatched</Chip>
                        )}
                      </div>
                    </td>
                    <td className="tnum py-1.5 text-right text-[12px] text-muted">{area.lines}</td>
                    <td className="tnum py-1.5 text-right text-[12px]">
                      {area.flaggedVariances > 0 ? (
                        <span className={area.explainedVariances < area.flaggedVariances ? "text-warn" : ""}>
                          {area.explainedVariances}/{area.flaggedVariances}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="tnum py-1.5 text-right text-[12px]">
                      {area.warnings > 0 ? <span className="text-warn">{area.warnings}</span> : "—"}
                    </td>
                    <td className="tnum py-1.5 text-right text-[12px] text-muted">
                      {area.verifiedLines}
                    </td>
                    <td className="tnum py-1.5 text-right text-[12px] text-muted">
                      {area.budgetHours ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] text-muted">
              Flags are explained / flagged. Budget hours come from the firm&rsquo;s own
              engagement budget.
            </p>
          </Section>
        )}

        {tab === "documents" && <Documents onOpenRef={onOpenRef} onSelect={onSelect} />}

        {tab === "sales" && <Sales onSelect={onSelect} onOpenRef={onOpenRef} />}

        {tab === "timeline" && (
          <Season
            data={season}
            filing={filing}
            onChanged={onChanged}
            onClockMoved={onClockMoved}
            onOpenRef={onOpenRef}
          />
        )}

        {tab === "after" && <After onSelect={onSelect} onOpenRef={onOpenRef} />}

        {tab === "adjustments" && (
          <Adjustments data={adjusted} onSelect={onSelect} onChanged={onChanged} />
        )}

        {tab === "open" && (
          <OpenItems
            data={checks}
            onSelect={onSelect}
            onOpenRef={onOpenRef}
            onChanged={onChanged}
          />
        )}

        {tab === "variances" && (
          <Variances data={data} onSelect={onSelect} onChanged={onChanged} unexplained={unexplained} />
        )}

        <div className="h-16" />
      </div>
    </div>
  );
}

function Variances({
  data,
  onSelect,
  onChanged,
  unexplained,
}: {
  data: Overview;
  onSelect: (key: string) => void;
  onChanged: () => void;
  unexplained: number;
}) {
  const { variance } = data;

  const groups = useMemo(() => {
    const flagged = variance.rows.filter((r) => r.flagged);
    return {
      notComparable: flagged.filter((r) => r.status === "matched" && r.notComparable),
      unmatched: flagged.filter((r) => r.status === "unmatched"),
      swings: flagged
        .filter((r) => r.status === "matched" && !r.notComparable)
        .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)),
    };
  }, [variance.rows]);

  return (
    <>
      <div className="border-b border-edge px-4 py-2.5 text-[11px] text-muted">
        The firm&rsquo;s standard flags a change over {variance.standard.percentThreshold}% and
        over {formatMoney(variance.standard.amountThreshold)}, both conditions.{" "}
        <span className="font-medium text-foreground">
          {unexplained} of {variance.flaggedCount} still unexplained.
        </span>
      </div>

      {groups.notComparable.length > 0 && (
        <Section title={`Not comparable · ${groups.notComparable.length}`}>
          <p className="mb-2 text-[11px] text-muted">
            The same line key names a different payer in each year, so no variance is computed.
            Schedule B assigns one line per interest payer and the household had four in 2024 and
            eight in 2025.
          </p>
          <ul className="space-y-1.5">
            {groups.notComparable.map((row) => (
              <VarianceCard key={row.key} row={row} data={data} onSelect={onSelect} onChanged={onChanged} />
            ))}
          </ul>
        </Section>
      )}

      {groups.unmatched.length > 0 && (
        <Section title={`No counterpart this year · ${groups.unmatched.length}`}>
          <ul className="space-y-1.5">
            {groups.unmatched.map((row) => (
              <VarianceCard key={row.key} row={row} data={data} onSelect={onSelect} onChanged={onChanged} />
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Swings · ${groups.swings.length}`}>
        <ul className="space-y-1.5">
          {groups.swings.map((row) => (
            <VarianceCard key={row.key} row={row} data={data} onSelect={onSelect} onChanged={onChanged} />
          ))}
        </ul>
      </Section>
    </>
  );
}

function VarianceCard({
  row,
  data,
  onSelect,
  onChanged,
}: {
  row: VarianceRow;
  data: Overview;
  onSelect: (key: string) => void;
  onChanged: () => void;
}) {
  const explanation = data.explanations.find((e) => e.key === row.key);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const explain = async () => {
    setBusy(true);
    try {
      await appendEvent({
        type: "variance_explained",
        scope: { kind: "line", id: row.key },
        payload: { text: text.trim() },
      });
      setText("");
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded border border-edge px-2 py-1.5">
      <button onClick={() => onSelect(row.key)} className="block w-full text-left">
        <div className="flex items-baseline gap-2">
          <span className="shrink-0 font-mono text-[10px] text-muted">{row.key}</span>
          <span className="min-w-0 flex-1 truncate text-[12px]">
            {row.currentLabel ?? row.priorLabel}
          </span>
          {row.status === "matched" && !row.notComparable && (
            <>
              <span className="tnum shrink-0 text-[11px] text-muted">
                {formatValue(row.prior)}
              </span>
              <span className="shrink-0 text-[10px] text-muted">&rarr;</span>
              <span className="tnum shrink-0 text-[12px] font-medium">
                {formatValue(row.current)}
              </span>
              {row.percent !== undefined && (
                <span
                  className={`tnum w-14 shrink-0 text-right text-[11px] ${
                    row.percent > 0 ? "text-bad" : "text-accent"
                  }`}
                >
                  {row.percent > 0 ? "+" : ""}
                  {Math.abs(row.percent) > 999 ? ">999" : row.percent.toFixed(0)}%
                </span>
              )}
            </>
          )}
        </div>

        {(row.labelChanged || row.notComparable || row.status === "unmatched") && (
          <div className="mt-1 space-y-0.5 text-[11px]">
            <div className="flex items-baseline gap-1.5">
              <Chip tone={row.notComparable ? "bad" : "warn"}>
                {row.status === "unmatched"
                  ? "no counterpart"
                  : row.notComparable
                    ? "different subject"
                    : "label differs"}
              </Chip>
              <span className="text-muted">
                2024: {row.priorLabel}
                {row.status === "unmatched" ? ` · ${formatValue(row.prior)}` : ""}
              </span>
            </div>
            {row.unmatchedReason && <p className="text-muted">{row.unmatchedReason}</p>}
          </div>
        )}

        {row.priorNote && (
          <p className="mt-0.5 text-[11px] text-muted">
            Prior preparer: {row.priorNote}
          </p>
        )}
      </button>

      {explanation ? (
        <p className="mt-1 border-t border-edge pt-1 text-[11px]">
          <Chip tone="accent">explained</Chip>{" "}
          <span>{explanation.text}</span>{" "}
          <span className="text-muted">
            — {explanation.actorName}, {explanation.at.slice(0, 10)}
          </span>
        </p>
      ) : (
        <div className="mt-1 flex items-center gap-1.5 border-t border-edge pt-1">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Explain this variance"
            className="min-w-0 flex-1 rounded border border-edge bg-surface px-1.5 py-0.5 text-[11px] outline-none placeholder:text-muted focus:border-accent"
          />
          <button
            disabled={busy || !text.trim()}
            onClick={explain}
            className="rounded border border-edge px-1.5 py-0.5 text-[10px] font-medium transition hover:border-accent hover:text-accent disabled:opacity-40"
          >
            Record
          </button>
        </div>
      )}
    </li>
  );
}
