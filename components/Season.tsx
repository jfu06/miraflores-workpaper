"use client";

import { useCallback, useEffect, useState } from "react";

import type { Clock } from "@/lib/time/clock";
import type { FilingState } from "@/lib/filing/state";
import { appendEvent, clearCaches } from "@/lib/view/client";
import { formatMoney } from "@/lib/view/format";
import { Chip, Section } from "./ui";

interface TimelineEvent {
  id: string;
  at: string;
  event: string;
  actor: string | null;
  actorName: string | null;
  detail: string | null;
  refs: string[];
}

export interface SeasonData {
  clock: Clock;
  beforeFirstRun: boolean;
  currentVersion: string;
  documentsInView: number;
  timeline: TimelineEvent[];
  versions: { version: string; computedAt: string; trigger: string; documentsUsed: number }[];
  efile: { date: string; jurisdiction: string; submission_id: string; status: string; errors?: { code: string; message: string }[] }[];
  workEvents: { id: string; at: string; type: string }[];
}

/**
 * The season, replayed.
 *
 * Moving the clock shows the file as it stood: the version the engine had
 * produced by then, the documents that had arrived, the work that had been
 * recorded. It is read-only, and says so, because recording work against a past
 * view would be writing history rather than replaying it.
 */
export function Season({
  data,
  filing,
  onChanged,
  onClockMoved,
  onOpenRef,
}: {
  data: SeasonData | null;
  filing: FilingState | null;
  onChanged: () => void;
  /** Moving the clock changes what every pane would be served, so the page reloads. */
  onClockMoved: () => void;
  onOpenRef: (ref: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const moveTo = useCallback(
    async (asOf: string | null) => {
      setBusy(true);
      try {
        await fetch("/api/clock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asOf }),
        });
        clearCaches();
        onClockMoved();
      } finally {
        setBusy(false);
      }
    },
    [onClockMoved],
  );

  if (!data) return <Section title="Timeline">Loading…</Section>;

  const live = data.clock.live;
  const asOf = data.clock.asOf;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-edge px-4 py-2.5">
        <Chip tone={live ? "accent" : "warn"}>{live ? "live" : "replay"}</Chip>
        <span className="text-[11px] text-muted">
          {live
            ? `The whole file is in view and work can be recorded. Version ${data.currentVersion}, ${data.documentsInView} documents.`
            : data.beforeFirstRun
              ? `On ${asOf?.slice(0, 10)} the engine had not computed a return yet. ${data.documentsInView} documents had arrived; the figures shown are the first run's and did not exist at this date.`
              : `Showing the file as it stood on ${asOf?.slice(0, 10)}: version ${data.currentVersion}, ${data.documentsInView} documents. Read-only.`}
        </span>
        {!live && (
          <button
            disabled={busy}
            onClick={() => moveTo(null)}
            className="ml-auto rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-white transition hover:brightness-110 disabled:opacity-40"
          >
            Return to live
          </button>
        )}
      </div>

      {filing && (
        <Section title="Filing">
          {filing.filings.length === 0 ? (
            <>
              <p className="mb-2 text-[12px] text-muted">
                Nothing filed. Filing freezes every line as transmitted; changes after that belong
                to an amendment.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(["federal", "california"] as const).map((jurisdiction) => {
                  const accepted = data.efile.find(
                    (e) => e.jurisdiction === jurisdiction && e.status === "accepted",
                  );
                  return (
                    <button
                      key={jurisdiction}
                      disabled={busy || !live}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await appendEvent({
                            type: "filing",
                            scope: { kind: "return", id: "2025" },
                            payload: {
                              jurisdiction,
                              submissionId: accepted?.submission_id ?? "",
                              acceptedAt: accepted?.date ?? new Date().toISOString(),
                            },
                          });
                          onChanged();
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="rounded border border-edge px-2 py-1 text-[11px] font-medium capitalize transition hover:border-accent hover:text-accent disabled:opacity-40"
                    >
                      Freeze and file {jurisdiction}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <ul className="space-y-1">
                {filing.filings.map((record) => (
                  <li key={record.eventId} className="rounded border border-[#cfe2ef] bg-accent-soft px-2 py-1.5">
                    <div className="flex items-baseline gap-2">
                      <Chip tone="accent">filed</Chip>
                      <span className="text-[12px] font-medium capitalize">{record.jurisdiction}</span>
                      <span className="font-mono text-[10px] text-muted">{record.submissionId}</span>
                      <span className="ml-auto text-[10px] text-muted">
                        {record.filedBy}, {record.at.slice(0, 10)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {Object.keys(record.snapshot).length} lines frozen · hash{" "}
                      {record.contentHash.slice(0, 16)}…
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-2 border-t border-edge pt-2">
                {filing.amending ? (
                  <p className="text-[11px] text-warn">
                    An amendment is open. Adjustments now sit on top of the filed return, which
                    stays as transmitted.
                  </p>
                ) : (
                  <AmendmentControl busy={busy || !live} onOpen={async (reason) => {
                    setBusy(true);
                    try {
                      await appendEvent({
                        type: "amendment_opened",
                        scope: { kind: "return", id: "2025" },
                        payload: { reason },
                      });
                      onChanged();
                    } finally {
                      setBusy(false);
                    }
                  }} />
                )}
                {filing.amendments.map((a) => (
                  <p key={a.eventId} className="mt-1 text-[11px]">
                    <Chip tone="warn">amendment</Chip> {a.reason}{" "}
                    <span className="text-muted">
                      — {a.openedBy}, {a.at.slice(0, 10)}, {a.adjustmentEventIds.length} changes since
                    </span>
                  </p>
                ))}
              </div>
            </>
          )}
        </Section>
      )}

      <Section title={`e-file · ${data.efile.length} submissions`}>
        <ul className="space-y-1">
          {data.efile.map((submission) => (
            <li key={submission.submission_id} className="flex items-start gap-2">
              <Chip
                tone={
                  submission.status === "accepted"
                    ? "accent"
                    : submission.status === "rejected"
                      ? "bad"
                      : "warn"
                }
              >
                {submission.status.replace(/_/g, " ")}
              </Chip>
              <span className="min-w-0 flex-1 text-[11px]">
                <span className="capitalize">{submission.jurisdiction}</span> ·{" "}
                <span className="font-mono text-[10px]">{submission.submission_id}</span> ·{" "}
                {submission.date.slice(0, 10)}
                {submission.errors?.map((error) => (
                  <span key={error.code} className="mt-0.5 block text-bad">
                    {error.code}: {error.message}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Season · ${data.timeline.length} events`}>
        <ul>
          {data.timeline.map((event) => {
            const past = !asOf || event.at <= asOf;
            const isHere = asOf === event.at;
            return (
              <li
                key={event.id}
                className={`flex items-baseline gap-2 border-l-2 py-1 pl-2 ${
                  isHere ? "border-accent bg-accent-soft" : past ? "border-edge" : "border-transparent opacity-45"
                }`}
              >
                <span className="tnum w-20 shrink-0 text-[10px] text-muted">
                  {event.at.slice(0, 10)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-[12px]">{event.event.replace(/_/g, " ")}</span>
                  {event.actorName && (
                    <span className="ml-1.5 text-[10px] text-muted">{event.actorName}</span>
                  )}
                  {event.detail && (
                    <span className="mt-0.5 block text-[10px] text-muted">{event.detail}</span>
                  )}
                  {event.refs.length > 0 && (
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {event.refs.slice(0, 5).map((ref) => (
                        <button key={ref} onClick={() => onOpenRef(ref)} className="transition hover:brightness-95">
                          <Chip tone="quiet">{ref}</Chip>
                        </button>
                      ))}
                    </span>
                  )}
                </span>
                <button
                  disabled={busy}
                  onClick={() => moveTo(event.at)}
                  className="shrink-0 text-[10px] text-muted hover:text-accent disabled:opacity-40"
                  title="Show the file as it stood here"
                >
                  show here
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}

function AmendmentControl({ busy, onOpen }: { busy: boolean; onOpen: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="flex items-center gap-1.5">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why the return needs amending"
        className="min-w-0 flex-1 rounded border border-edge bg-surface px-2 py-1 text-[11px] outline-none focus:border-accent"
      />
      <button
        disabled={busy || !reason.trim()}
        onClick={() => onOpen(reason.trim())}
        className="rounded border border-edge px-2 py-1 text-[11px] font-medium transition hover:border-accent hover:text-accent disabled:opacity-40"
      >
        Open amendment
      </button>
    </div>
  );
}

export { formatMoney };
