"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ScopeSummary } from "@/lib/events/summary";
import type { ResolvedRef } from "@/lib/graph/graph";
import type { OutlineGroup } from "@/lib/view/models";
import { formatMoney } from "@/lib/view/format";
import { EvidencePane, type DocRequest } from "./EvidencePane";
import { NumberPanel } from "./NumberPanel";
import { OverviewPane, type Overview } from "./OverviewPane";
import { ReturnOutline } from "./ReturnOutline";
import { RoleSwitcher } from "./RoleSwitcher";
import { Chip } from "./ui";

export interface WorkpaperMeta {
  client: string;
  taxYear: number;
  filingStatus: string;
  version: string;
  computedAt: string;
  trigger: string;
  federalBalance: number;
  californiaBalance: number;
  documents: number;
  extractedValues: number;
  lines: number;
  warnings: number;
}

interface Props {
  meta: WorkpaperMeta;
  outline: OutlineGroup[];
}

export function Workpaper({ meta, outline }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [docRequest, setDocRequest] = useState<DocRequest | null>(null);
  const [record, setRecord] = useState<ResolvedRef | null>(null);
  const [summaries, setSummaries] = useState<Record<string, ScopeSummary>>({});
  const [overview, setOverview] = useState<Overview | null>(null);

  /**
   * Bumped whenever the acting role changes, to force the detail panes to refetch.
   * Masking is applied server-side per actor, so a pane holding another person's
   * response has to be thrown away rather than reinterpreted.
   */
  const [revision, setRevision] = useState(0);

  const loadDerived = useCallback(() => {
    fetch("/api/summary")
      .then((r) => r.json())
      .then((d: { summaries: Record<string, ScopeSummary> }) => setSummaries(d.summaries))
      .catch(() => undefined);
    fetch("/api/overview")
      .then((r) => r.json())
      .then((d: Overview) => setOverview(d))
      .catch(() => undefined);
  }, []);

  const refreshWork = useCallback(() => {
    setRevision((r) => r + 1);
    loadDerived();
  }, [loadDerived]);

  useEffect(loadDerived, [loadDerived]);

  /** Flagged prior-year variances, for the markers in the outline. */
  const flaggedKeys = useMemo(
    () => new Set((overview?.variance.rows ?? []).filter((r) => r.flagged).map((r) => r.key)),
    [overview],
  );

  /**
   * One entry point for every reference click in the app.
   *
   * The reference is resolved on the server by the same `resolveRef` the fact
   * graph uses, so the UI never has to know the grammar — it only has to know what
   * to do with the target it gets back.
   */
  const openSource = useCallback(async (ref: string) => {
    const response = await fetch(`/api/ref?ref=${encodeURIComponent(ref)}`);
    const resolved = (await response.json()) as ResolvedRef;

    if (resolved.ok && resolved.target?.kind === "document") {
      setDocRequest({
        documentId: resolved.target.documentId,
        page: resolved.target.page,
        highlightEv: resolved.target.highlightEv,
      });
      setRecord(null);
      return;
    }
    if (resolved.ok && resolved.target?.kind === "line") {
      setSelectedKey(resolved.target.lineKey);
      return;
    }
    // Records and unresolvable references both render in the evidence pane.
    setRecord(resolved);
    setDocRequest(null);
  }, []);

  const selectLine = useCallback((key: string) => setSelectedKey(key), []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-4 border-b border-edge bg-surface px-4 py-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate text-[13px] font-semibold">{meta.client}</h1>
            <span className="text-[11px] text-muted">
              {meta.taxYear} · {meta.filingStatus.replace(/_/g, " ")}
            </span>
          </div>
          <div className="text-[10px] text-muted">
            Engine version {meta.version}, computed {meta.computedAt.slice(0, 10)}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4 text-[11px]">
          <RoleSwitcher onSwitched={refreshWork} />
          <Balance label="Federal" amount={meta.federalBalance} />
          <Balance label="California" amount={meta.californiaBalance} />
          <div className="flex items-center gap-1.5 border-l border-edge pl-4">
            <Chip tone="quiet" title="Documents in the packet">
              {meta.documents} docs
            </Chip>
            <Chip tone="quiet" title="Extracted values">
              {meta.extractedValues.toLocaleString("en-US")} values
            </Chip>
            <Chip tone="quiet" title="Lines in the current return">
              {meta.lines} lines
            </Chip>
            <Chip tone="warn" title="Engine diagnostics at warning severity">
              {meta.warnings} warnings
            </Chip>
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(0,1.15fr)] divide-x divide-edge">
        <div className="min-h-0 bg-surface">
          <ReturnOutline
            outline={outline}
            selectedKey={selectedKey}
            onSelect={selectLine}
            summaries={summaries}
            flaggedKeys={flaggedKeys}
          />
        </div>
        <div className="min-h-0 bg-surface">
          {selectedKey === null ? (
            <OverviewPane data={overview} onSelect={selectLine} onChanged={refreshWork} />
          ) : (
            <NumberPanel
              key={`line-${revision}`}
              lineKey={selectedKey}
              onSelect={selectLine}
              onOpenSource={openSource}
              onWorkChanged={refreshWork}
              onBack={() => setSelectedKey(null)}
            />
          )}
        </div>
        <div className="min-h-0 bg-surface">
          <EvidencePane
            key={`doc-${revision}`}
            request={docRequest}
            record={record}
            onSelect={selectLine}
          />
        </div>
      </main>
    </div>
  );
}

function Balance({ label, amount }: { label: string; amount: number }) {
  const refund = amount < 0;
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className={`tnum text-[13px] font-semibold ${refund ? "text-accent" : ""}`}>
        {refund ? `(${formatMoney(Math.abs(amount))})` : formatMoney(amount)}
      </div>
    </div>
  );
}
