"use client";

import { useEffect, useMemo, useState } from "react";

import type { DocumentRow, NotLandedKind } from "@/lib/view/documents";
import { Chip, Empty, Section } from "./ui";

interface Index {
  documents: DocumentRow[];
  counts: { total: number; landed: number; notLanded: number; unexplained: number };
  lineCount: number;
}

const REASON_LABEL: Record<NotLandedKind, string> = {
  superseded: "superseded",
  not_extracted: "not extracted",
  prior_year: "prior year",
  duplicate: "duplicate",
  engagement: "engagement",
  unexplained: "nothing explains it",
};

const REASON_TONE: Record<NotLandedKind, "quiet" | "warn" | "bad"> = {
  superseded: "quiet",
  not_extracted: "quiet",
  prior_year: "quiet",
  duplicate: "quiet",
  engagement: "quiet",
  unexplained: "bad",
};

type View = "all" | "landed" | "not-landed" | "unexplained";

/**
 * Every document, and where it went.
 *
 * The index exists for the second half of the requirement — "or why it didn't".
 * Before it, a document could only be reached by clicking a source reference on
 * a line, so the eighteen that reach no line could not be opened at all, and the
 * four that nothing explains could not be found.
 */
export function Documents({
  onOpenRef,
  onSelect,
}: {
  onOpenRef: (ref: string) => void;
  onSelect: (lineKey: string) => void;
}) {
  const [data, setData] = useState<Index | null>(null);
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((d: Index) => setData(d))
      .catch(() => undefined);
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.documents.filter((row) => {
      if (view === "landed" && row.landedOn.length === 0) return false;
      if (view === "not-landed" && row.landedOn.length > 0) return false;
      if (view === "unexplained" && row.notLanded?.kind !== "unexplained") return false;
      if (!needle) return true;
      return (
        row.id.toLowerCase().includes(needle) ||
        row.title.toLowerCase().includes(needle) ||
        row.documentType.toLowerCase().includes(needle) ||
        row.issuer.toLowerCase().includes(needle)
      );
    });
  }, [data, view, query]);

  if (!data) return <Empty>Loading…</Empty>;

  return (
    <>
      <div className="border-b border-edge px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["all", `All ${data.counts.total}`],
              ["landed", `Landed ${data.counts.landed}`],
              ["not-landed", `Reached no line ${data.counts.notLanded}`],
              ["unexplained", `Unexplained ${data.counts.unexplained}`],
            ] as [View, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setView(value)}
              className={`rounded border px-2 py-0.5 text-[11px] font-medium transition ${
                view === value
                  ? "border-accent bg-accent text-white"
                  : value === "unexplained" && data.counts.unexplained > 0
                    ? "border-[#f3d4d2] text-bad hover:bg-bad-soft"
                    : "border-edge text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by id, title, type or issuer"
            className="ml-auto w-56 rounded border border-edge bg-surface px-2 py-1 text-[11px] outline-none placeholder:text-muted focus:border-accent"
          />
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
          Every document, and everywhere it landed — or why it didn&rsquo;t. Each reason is derived
          from the file: displaced by a corrected copy, never extracted, cited by the prior-year
          records, a duplicate, or evidence for a required step.{" "}
          {data.counts.unexplained > 0 && (
            <span className="text-bad">
              {data.counts.unexplained} are explained by nothing, which is the point of looking.
            </span>
          )}
        </p>
      </div>

      <Section title={`${rows.length} document${rows.length === 1 ? "" : "s"}`}>
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`rounded border px-2 py-1.5 ${
                row.notLanded?.kind === "unexplained"
                  ? "border-[#f3d4d2] bg-bad-soft"
                  : "border-edge"
              }`}
            >
              <div className="flex items-baseline gap-2">
                <button
                  onClick={() => onOpenRef(row.id)}
                  className="shrink-0 font-mono text-[10px] text-muted hover:text-accent"
                >
                  {row.id}
                </button>
                <button
                  onClick={() => onOpenRef(row.id)}
                  className="min-w-0 flex-1 truncate text-left text-[12px] font-medium hover:text-accent"
                  title={row.title}
                >
                  {row.title}
                </button>
                {row.markedCorrected && <Chip tone="warn">CORRECTED</Chip>}
                {row.extraction.status !== "extracted" && (
                  <Chip tone="warn" title={row.extraction.reason ?? undefined}>
                    {row.extraction.status.replace(/_/g, " ")}
                  </Chip>
                )}
                {row.landedOn.length > 0 ? (
                  <Chip tone="accent">
                    {row.landedOn.length} line{row.landedOn.length === 1 ? "" : "s"}
                  </Chip>
                ) : (
                  <Chip tone={REASON_TONE[row.notLanded!.kind]}>
                    {REASON_LABEL[row.notLanded!.kind]}
                  </Chip>
                )}
              </div>

              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                <span>{row.documentType}</span>
                <span>·</span>
                <span>{row.issuer}</span>
                <span>·</span>
                <span>{row.belongsTo}</span>
                <span>·</span>
                <span>
                  {row.pageCount} page{row.pageCount === 1 ? "" : "s"}, {row.valueCount} values
                </span>
                <span>·</span>
                <span>
                  {row.uploadedBy}, {row.receivedAt.slice(0, 10)}
                </span>
              </div>

              {row.notLanded && (
                <p
                  className={`mt-1 text-[11px] ${
                    row.notLanded.kind === "unexplained" ? "text-bad" : "text-muted"
                  }`}
                >
                  {row.notLanded.detail}
                </p>
              )}

              {row.landedOn.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {row.landedOn.slice(0, 10).map((key) => (
                    <button key={key} onClick={() => onSelect(key)} className="transition hover:brightness-95">
                      <Chip tone="quiet">{key}</Chip>
                    </button>
                  ))}
                  {row.landedOn.length > 10 && (
                    <span className="text-[10px] text-muted">
                      and {row.landedOn.length - 10} more
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
