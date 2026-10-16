"use client";

import { useMemo, useState } from "react";

import type { ScopeSummary } from "@/lib/events/summary";
import type { Jurisdiction } from "@/lib/packet/types";
import type { OutlineGroup, OutlineLine } from "@/lib/view/models";
import { areaLabel } from "@/lib/view/areas";
import { formatValue } from "@/lib/view/format";
import { Chip, PaneHeader } from "./ui";

interface Props {
  outline: OutlineGroup[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Work done per scope, keyed `line:<key>`, for the status markers. */
  summaries: Record<string, ScopeSummary>;
  /** Lines with a flagged prior-year variance. */
  flaggedKeys: Set<string>;
  /** Lines carrying a high-severity check finding. */
  findingKeys: Set<string>;
  /** Lines the adjustment ledger has moved, with how the new figure was arrived at. */
  adjustedLines: { key: string; value: number; original: number; provenance: string }[];
}

/**
 * The return as an outline, not a grid.
 *
 * Grouping is jurisdiction → review area → form, because that is the order a
 * reviewer works in: the firm budgets hours by area, and a form belongs to one.
 * Lines keep the engine's own order inside a form.
 */
export function ReturnOutline({
  outline,
  selectedKey,
  onSelect,
  summaries,
  flaggedKeys,
  findingKeys,
  adjustedLines,
}: Props) {
  const adjusted = useMemo(
    () => new Map(adjustedLines.map((l) => [l.key, l])),
    [adjustedLines],
  );
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("federal");
  const [query, setQuery] = useState("");

  const group = outline.find((g) => g.jurisdiction === jurisdiction);

  const areas = useMemo(() => {
    if (!group) return [];
    const needle = query.trim().toLowerCase();

    const byArea = new Map<string, { form: string; lines: OutlineLine[] }[]>();
    for (const form of group.forms) {
      const lines = needle
        ? form.lines.filter(
            (l) =>
              l.label.toLowerCase().includes(needle) ||
              l.key.toLowerCase().includes(needle) ||
              String(l.value).toLowerCase().includes(needle),
          )
        : form.lines;
      if (lines.length === 0) continue;
      const entry = byArea.get(form.area);
      if (entry) entry.push({ form: form.form, lines });
      else byArea.set(form.area, [{ form: form.form, lines }]);
    }
    return [...byArea];
  }, [group, query]);

  const shown = areas.reduce(
    (n, [, forms]) => n + forms.reduce((m, f) => m + f.lines.length, 0),
    0,
  );

  return (
    <div className="flex h-full flex-col">
      <PaneHeader
        eyebrow="Return"
        title="Okafor-Lindqvist 2025"
        right={
          <div className="flex rounded border border-edge p-0.5">
            {(["federal", "california"] as Jurisdiction[]).map((j) => (
              <button
                key={j}
                onClick={() => setJurisdiction(j)}
                className={`rounded px-2 py-0.5 text-[11px] font-medium capitalize transition ${
                  jurisdiction === j ? "bg-accent text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {j === "california" ? "CA" : "Federal"}
              </button>
            ))}
          </div>
        }
      />

      <div className="border-b border-edge px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter lines, labels, amounts"
          className="w-full rounded border border-edge bg-surface px-2 py-1.5 text-[12px] outline-none placeholder:text-muted focus:border-accent"
        />
        <div className="mt-1.5 text-[10px] text-muted">{shown} lines</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {areas.map(([area, forms]) => (
          <div key={area}>
            <div className="sticky top-0 z-[1] border-y border-edge bg-[#f4f4f2] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#55554f]">
              {areaLabel(area)}
            </div>
            {forms.map(({ form, lines }) => (
              <div key={form} className="border-b border-edge last:border-b-0">
                <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                  <span className="font-mono text-[11px] font-semibold">{form}</span>
                  <span className="text-[10px] text-muted">{lines.length}</span>
                </div>
                <ul>
                  {lines.map((line) => {
                    const active = line.key === selectedKey;
                    const work = summaries[`line:${line.key}`];
                    const moved = adjusted.get(line.key);
                    return (
                      <li key={line.key}>
                        <button
                          onClick={() => onSelect(line.key)}
                          className={`group flex w-full items-baseline gap-2 px-3 py-1 text-left transition ${
                            active ? "bg-accent-soft" : "hover:bg-[#f4f4f2]"
                          }`}
                        >
                          <span
                            className={`w-12 shrink-0 font-mono text-[10px] ${
                              active ? "text-accent" : "text-muted"
                            }`}
                          >
                            {line.line}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[12px]" title={line.label}>
                            {line.label}
                          </span>
                          {findingKeys.has(line.key) && (
                            <span
                              className="shrink-0 text-[10px] font-bold text-bad"
                              title="A check found something on this line"
                            >
                              &#9679;
                            </span>
                          )}
                          {flaggedKeys.has(line.key) && (
                            <span
                              className="shrink-0 text-[10px] text-warn"
                              title="Flagged against last year by the firm's variance standard"
                            >
                              &#9650;
                            </span>
                          )}
                          {line.hasNote && (
                            <span
                              className="mt-[5px] size-1.5 shrink-0 rounded-full bg-warn"
                              title="The engine left a note on this line"
                            />
                          )}
                          {work?.openBlocking ? (
                            <span
                              className="shrink-0 text-[10px] font-semibold text-bad"
                              title={`${work.openBlocking} open blocking review note`}
                            >
                              !
                            </span>
                          ) : work?.signoffLevels.length ? (
                            <span
                              className="shrink-0 text-[10px] text-accent"
                              title={`Signed: ${work.signoffLevels.join(", ")}`}
                            >
                              {"\u2713".repeat(work.signoffLevels.length)}
                            </span>
                          ) : work?.verifications ? (
                            <span
                              className="shrink-0 text-[10px] text-muted"
                              title={`${work.verifications} verification`}
                            >
                              \u00b7
                            </span>
                          ) : null}
                          {line.sourceCount > 0 && (
                            <span className="shrink-0 text-[9px] text-muted" title={`${line.sourceCount} source references`}>
                              {line.sourceCount}
                            </span>
                          )}
                          <span
                            className={`tnum shrink-0 text-right text-[12px] font-medium ${
                              moved ? "text-accent" : ""
                            }`}
                            title={
                              moved
                                ? `${moved.provenance} — the engine published ${formatValue(
                                    moved.original,
                                  )}`
                                : undefined
                            }
                          >
                            {formatValue(moved ? moved.value : line.value)}
                            {moved && <span className="ml-0.5 text-[9px]">&bull;</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ))}
        {shown === 0 && (
          <p className="px-4 py-10 text-center text-[12px] text-muted">
            No lines match <span className="font-medium">{query}</span>.
          </p>
        )}
        <div className="h-16" />
      </div>
    </div>
  );
}
