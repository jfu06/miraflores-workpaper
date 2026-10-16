"use client";

import { useEffect, useRef, useState } from "react";

import type { DocumentDetail, PageValue } from "@/lib/view/models";
import type { ResolvedRef } from "@/lib/graph/graph";
import { fetchDocument } from "@/lib/view/client";
import { formatValue } from "@/lib/view/format";
import { Chip, Empty, LOCATE_METHOD, PaneHeader, Section } from "./ui";

export interface DocRequest {
  documentId: string;
  page?: number;
  highlightEv?: string;
}

interface Props {
  request: DocRequest | null;
  /** A resolved reference that is not a document (a prior-year record, an answer, a parameter). */
  record: ResolvedRef | null;
  onSelect: (lineKey: string) => void;
}

export function EvidencePane({ request, record, onSelect }: Props) {
  if (record) return <RecordView record={record} />;
  if (request) return <DocumentView request={request} onSelect={onSelect} />;
  return (
    <div className="flex h-full flex-col">
      <PaneHeader eyebrow="Evidence" title="No source open" />
      <Empty>
        Trace a number and click one of its source references to open the document it came from.
      </Empty>
    </div>
  );
}

/**
 * A simulated source document.
 *
 * The pages render the packet's `printed_content` as a document rather than as
 * data, with the traced field highlighted in place. The simulation is confined to
 * this component and `locatePage`: the workpaper addresses evidence as "value
 * ev-0035 on page 1 of D09", which is what a real document store would also be
 * asked for, so replacing these pages with real scans does not reach any caller.
 */
function DocumentView({ request, onSelect }: { request: DocRequest; onSelect: (k: string) => void }) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(request.page ?? 1);
  const markRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    setDoc(null);
    fetchDocument(request.documentId)
      .then((d) => {
        if (!live) return;
        setDoc(d);
        setPage(request.page ?? d.pages[0]?.page ?? 1);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [request.documentId, request.page]);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [doc, page, request.highlightEv]);

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <PaneHeader eyebrow="Evidence" title={request.documentId} />
        <p className="px-4 py-8 text-[12px] text-bad">{error}</p>
      </div>
    );
  }
  if (!doc) {
    return (
      <div className="flex h-full flex-col">
        <PaneHeader eyebrow="Evidence" title={request.documentId} />
        <Empty>Loading…</Empty>
      </div>
    );
  }

  const view = doc.pages.find((p) => p.page === page) ?? doc.pages[0];
  const highlighted = view?.values.find((v) => v.evId === request.highlightEv);

  return (
    <div className="flex h-full flex-col">
      <PaneHeader
        eyebrow={`${doc.documentType} · ${doc.issuer}`}
        title={
          <span>
            <span className="font-mono text-[12px] text-muted">{doc.id}</span>
            <span className="mx-2 text-edge">|</span>
            {doc.title}
          </span>
        }
        right={
          <>
            {doc.markedCorrected && <Chip tone="warn">CORRECTED</Chip>}
            {doc.extraction.status !== "extracted" && (
              <Chip tone="warn" title={doc.extraction.reason ?? undefined}>
                {doc.extraction.status}
              </Chip>
            )}
            {doc.supersededIn.length > 0 && (
              <Chip tone="bad" title={`Superseded in ${doc.supersededIn.join(", ")}`}>
                superseded
              </Chip>
            )}
          </>
        }
      />

      <div className="flex items-center gap-3 border-b border-edge px-4 py-2 text-[11px] text-muted">
        <span>{doc.fileName}</span>
        <span>·</span>
        <span>
          uploaded by {doc.uploadedBy}, {doc.receivedAt.slice(0, 10)}
        </span>
        <span>·</span>
        <span>{doc.belongsTo}</span>
      </div>

      {doc.pageCount > 1 && (
        <div className="flex items-center gap-2 border-b border-edge px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Page
          </span>
          <div className="flex flex-wrap gap-1">
            {doc.pages.map((p) => {
              const empty = doc.pagesWithoutValues.includes(p.page);
              return (
                <button
                  key={p.page}
                  onClick={() => setPage(p.page)}
                  title={empty ? "No extracted values on this page" : `${p.values.length} values`}
                  className={`tnum min-w-6 rounded border px-1 py-0.5 text-[10px] transition ${
                    p.page === page
                      ? "border-accent bg-accent text-white"
                      : empty
                        ? "border-[#f0e0bd] bg-warn-soft text-warn"
                        : "border-edge text-muted hover:border-accent hover:text-accent"
                  }`}
                >
                  {p.page}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* The page itself, as a document. */}
        <div className="px-4 py-4">
          <div className="rounded border border-edge bg-white px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="mb-3 flex items-baseline justify-between border-b border-dashed border-edge pb-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                {doc.issuer}
              </span>
              <span className="tnum text-[10px] text-muted">
                page {view?.page} of {doc.pageCount}
              </span>
            </div>
            <p className="text-[12.5px] leading-[1.75] whitespace-pre-wrap">
              {view?.segments.map((segment, i) =>
                segment.evId ? (
                  <span
                    key={i}
                    ref={segment.evId === request.highlightEv ? markRef : undefined}
                    title={`${segment.evId} · ${segment.method}`}
                    className={
                      segment.evId === request.highlightEv
                        ? "rounded-sm bg-[#ffe9a8] px-0.5 outline outline-2 outline-[#d9a505]"
                        : "rounded-sm bg-[#eef4f9] px-0.5"
                    }
                  >
                    {segment.text}
                  </span>
                ) : (
                  <span key={i}>{segment.text}</span>
                ),
              )}
            </p>
          </div>
          {view?.values.length === 0 && (
            <p className="mt-2 rounded border border-[#f0e0bd] bg-warn-soft px-2 py-1.5 text-[11px] text-warn">
              The pipeline extracted nothing from this page.
              {doc.extraction.reason ? ` ${doc.extraction.reason}` : ""} It is still addressable as{" "}
              <span className="font-mono">
                doc:{doc.id}#page{view.page}
              </span>
              .
            </p>
          )}
        </div>

        {highlighted && (
          <Section title="Traced field">
            <ValueRow value={highlighted} onSelect={onSelect} emphasize />
          </Section>
        )}

        {view && view.values.length > 0 && (
          <Section title={`Everything read from this page · ${view.values.length}`}>
            <ul className="divide-y divide-edge">
              {view.values.map((value) => (
                <li key={value.evId} className="py-1">
                  <ValueRow value={value} onSelect={onSelect} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title={`Where this document landed · ${doc.landedOn.length} line${doc.landedOn.length === 1 ? "" : "s"}`}>
          {doc.landedOn.length === 0 ? (
            <p className="text-[12px] text-muted">
              No line in the current return cites any value from this document.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {doc.landedOn.map((line) => (
                <li key={line.key}>
                  <button
                    onClick={() => onSelect(line.key)}
                    className="flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left transition hover:bg-[#f4f4f2]"
                  >
                    <span className="shrink-0 font-mono text-[10px] text-muted">
                      {line.form} {line.line}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px]">{line.label}</span>
                    <span className="tnum shrink-0 text-[12px]">{formatValue(line.value)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="h-16" />
      </div>
    </div>
  );
}

function ValueRow({
  value,
  onSelect,
  emphasize,
}: {
  value: PageValue;
  onSelect: (k: string) => void;
  emphasize?: boolean;
}) {
  const method = LOCATE_METHOD[value.method];
  const lowConfidence = value.confidence < 0.8;

  return (
    <div className={emphasize ? "rounded border border-[#f0e0bd] bg-warn-soft px-2 py-2" : ""}>
      <div className="flex items-baseline gap-2">
        <Chip tone="quiet">{value.evId}</Chip>
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium" title={value.label}>
          {value.label || value.field}
        </span>
        <span className="tnum shrink-0 text-[12px]">{formatValue(value.value)}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 pl-1">
        <span className="font-mono text-[10px] text-muted">{value.field}</span>
        <Chip tone={method.tone} title={method.note}>
          {method.label}
        </Chip>
        <Chip tone={lowConfidence ? "bad" : "quiet"} title="Pipeline confidence">
          {value.confidence.toFixed(2)}
        </Chip>
        {value.textAsRead && value.textAsRead !== String(value.value) && (
          <span className="text-[10px] text-muted">read &ldquo;{value.textAsRead}&rdquo;</span>
        )}
        {value.landedOn.length > 0 ? (
          value.landedOn.map((key) => (
            <button key={key} onClick={() => onSelect(key)} className="transition hover:brightness-95">
              <Chip tone="accent">{key}</Chip>
            </button>
          ))
        ) : (
          <Chip tone="quiet" title="No line in the current return cites this value">
            unused
          </Chip>
        )}
      </div>
    </div>
  );
}

/** A non-document reference: a prior-year record, a client answer, an engine parameter. */
function RecordView({ record }: { record: ResolvedRef }) {
  return (
    <div className="flex h-full flex-col">
      <PaneHeader
        eyebrow={record.target?.kind === "record" ? record.target.section : "Reference"}
        title={record.title}
        right={<Chip tone={record.ok ? "accent" : "bad"}>{record.parsed.raw}</Chip>}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {record.subtitle && (
          <Section title="Summary">
            <p className="text-[12px]">{record.subtitle}</p>
          </Section>
        )}
        {record.reason && (
          <Section title="Does not resolve">
            <p className="text-[12px] text-bad">{record.reason}</p>
          </Section>
        )}
        {record.value !== undefined && (
          <Section title="Record">
            <pre className="overflow-x-auto rounded border border-edge bg-[#fafaf9] p-3 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(record.value, null, 2)}
            </pre>
          </Section>
        )}
        <div className="h-16" />
      </div>
    </div>
  );
}
