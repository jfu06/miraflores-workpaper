"use client";

import { useMemo, useState } from "react";

import type { Dismissal } from "@/app/api/checks/route";
import type { Check, CheckFamily, Finding } from "@/lib/checks/types";
import { FAMILY_LABEL } from "@/lib/checks/types";
import type { Diagnostic } from "@/lib/packet/types";
import { appendEvent } from "@/lib/view/client";
import { formatMoney } from "@/lib/view/format";
import { Chip, Section } from "./ui";

export interface ChecksData {
  checks: Omit<Check, "run">[];
  findings: Finding[];
  dismissals: Dismissal[];
  /** Findings the workpaper has corrected by applying the figure they supplied. */
  addressed: { findingId: string; lineKey: string; to: number; actorName: string; at: string }[];
  completedSteps: { step: string; actorName: string; at: string }[];
  requiredSteps: string[];
  diagnostics: Diagnostic[];
  returnSignoffs: { level: string; actorName: string; at: string; valid: boolean }[];
  documents: { id: string; documentType: string; title: string }[];
}

interface StepStatus {
  done: boolean;
  because: string;
  /** References the step is derived from, so the evidence is one click away. */
  refs?: string[];
}

/**
 * Required steps the file can answer for itself.
 *
 * Anything derivable is derived, so a step cannot be ticked while the thing it
 * asserts is untrue. The rest are a person's to confirm, and are recorded as
 * events like any other act.
 */
const DERIVED_STEPS: Record<string, (data: ChecksData, live: Finding[]) => StepStatus> = {
  "Engagement letter and consents signed": (data) => {
    const letter = data.documents.filter((d) => d.documentType === "engagement_letter");
    const consent = data.documents.filter((d) => d.documentType === "consent_7216");
    const done = letter.length > 0 && consent.length > 0;
    return {
      done,
      because: done
        ? "Both are in the file."
        : `Missing ${[letter.length === 0 && "engagement letter", consent.length === 0 && "section 7216 consent"].filter(Boolean).join(" and ")}.`,
      refs: [...letter, ...consent].map((d) => d.id),
    };
  },
  "Identity verified": (data) => {
    const ids = data.documents.filter((d) => d.documentType === "identity_document");
    return {
      done: ids.length > 0,
      because: ids.length > 0 ? `${ids.length} identity documents in the file.` : "No identity document.",
      refs: ids.map((d) => d.id),
    };
  },
  "Due diligence completed": (data) => {
    const outstanding = data.diagnostics.filter((d) => d.code === "DUE_DILIGENCE_REQUIRED");
    return {
      done: outstanding.length === 0,
      because:
        outstanding.length === 0
          ? "No outstanding due-diligence requirement."
          : outstanding[0].message,
      refs: outstanding.flatMap((d) => d.refs),
    };
  },
  "Reviewer sign-off": (data) => {
    const signoff = data.returnSignoffs.find((s) => s.level === "reviewer");
    return {
      done: Boolean(signoff?.valid),
      because: !signoff
        ? "The return has not been signed at reviewer level."
        : signoff.valid
          ? `${signoff.actorName}, ${signoff.at.slice(0, 10)}.`
          : `Signed by ${signoff.actorName} but reopened by a later change.`,
    };
  },
  "Partner sign-off": (data) => {
    const signoff = data.returnSignoffs.find((s) => s.level === "partner");
    return {
      done: Boolean(signoff?.valid),
      because: !signoff
        ? "The return has not been signed at partner level."
        : signoff.valid
          ? `${signoff.actorName}, ${signoff.at.slice(0, 10)}.`
          : `Signed by ${signoff.actorName} but reopened by a later change.`,
    };
  },
  "Prior-year variances explained": (_data, live) => {
    const open = live.filter((f) => f.checkId === "RECON-VARIANCE").length;
    return {
      done: open === 0,
      because: open === 0 ? "No flagged variance is unexplained." : `${open} still unexplained.`,
    };
  },
  "Estimated payments agreed to IRS and FTB records": (_data, live) => {
    const open = live.filter((f) => f.checkId === "RECON-AGENCY");
    const total = open.reduce((sum, f) => sum + (f.amount ?? 0), 0);
    return {
      done: open.length === 0,
      because:
        open.length === 0
          ? "The return agrees to both agencies' records."
          : `${open.length} disagreement${open.length === 1 ? "" : "s"}, ${formatMoney(total)} in total.`,
    };
  },
  "Diagnostics resolved": (data) => {
    const warnings = data.diagnostics.filter((d) => d.severity === "warning").length;
    return {
      done: warnings === 0,
      because: warnings === 0 ? "No engine warnings outstanding." : `${warnings} engine warnings.`,
    };
  },
  "All documents accounted for": (_data, live) => {
    const open = live.filter(
      (f) => f.checkId === "DOC-PAGE-UNREAD" || f.checkId === "DOC-SUPERSEDED-USED",
    ).length;
    return {
      done: open === 0,
      because: open === 0 ? "Every page with figures has been read." : `${open} document gaps.`,
    };
  },
  "Carryovers agreed to prior year": (_data, live) => {
    const open = live.filter((f) => f.checkId === "INT-BASIS-GAP").length;
    return {
      done: open === 0,
      because: open === 0 ? "No gap in the basis records." : `${open} basis records have holes.`,
    };
  },
};

const SEVERITY_TONE = { high: "bad", medium: "warn", low: "quiet" } as const;

interface Props {
  data: ChecksData | null;
  onSelect: (lineKey: string) => void;
  onOpenRef: (ref: string) => void;
  onChanged: () => void;
}

export function OpenItems({ data, onSelect, onOpenRef, onChanged }: Props) {
  const [showDismissed, setShowDismissed] = useState(false);
  /**
   * Low findings are hidden by default, because 78 of the 108 are unexplained
   * prior-year variances and they bury everything else in their own family. The
   * count is still shown, so nothing is hidden silently.
   */
  const [showLow, setShowLow] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const dismissedIds = useMemo(
    () => new Set((data?.dismissals ?? []).map((d) => d.findingId)),
    [data],
  );
  const addressedIds = useMemo(
    () => new Set((data?.addressed ?? []).map((a) => a.findingId)),
    [data],
  );
  const live = useMemo(
    () =>
      (data?.findings ?? []).filter((f) => !dismissedIds.has(f.id) && !addressedIds.has(f.id)),
    [data, dismissedIds, addressedIds],
  );
  const shown = useMemo(
    () => (showLow ? live : live.filter((f) => f.severity !== "low")),
    [live, showLow],
  );

  if (!data) return <Section title="Open items">Loading…</Section>;

  const byFamily = new Map<CheckFamily, Finding[]>();
  const checkById = new Map(data.checks.map((c) => [c.id, c]));
  for (const finding of shown) {
    const family = checkById.get(finding.checkId)?.family ?? "integrity";
    const list = byFamily.get(family);
    if (list) list.push(finding);
    else byFamily.set(family, [finding]);
  }

  const applicable = live.filter((f) => f.suggestedAdjustment);
  const high = live.filter((f) => f.severity === "high").length;
  const medium = live.filter((f) => f.severity === "medium").length;
  const low = live.filter((f) => f.severity === "low").length;

  /**
   * Deliberately no total.
   *
   * The amounts on findings are not the same kind of number — one is gross income
   * sourced to a state, another is a payment the agency has not posted. Adding
   * them produces a figure that looks like exposure and is not, which is the sort
   * of confident wrong total this workpaper exists to catch.
   */

  return (
    <>
      <div className="border-b border-edge px-4 py-2.5 text-[11px]">
        <span className="font-medium">
          {live.length} open {live.length === 1 ? "item" : "items"}
        </span>
        <span className="text-muted">
          {" "}
          from {data.checks.length} checks · {high} high, {medium} medium
          {low > 0 && (
            <>
              {", "}
              <button onClick={() => setShowLow(!showLow)} className="underline">
                {low} low {showLow ? "shown" : "hidden"}
              </button>
            </>
          )}
          {addressedIds.size > 0 && ` · ${addressedIds.size} addressed`}
          {dismissedIds.size > 0 && (
            <>
              {" · "}
              <button onClick={() => setShowDismissed(!showDismissed)} className="underline">
                {dismissedIds.size} dismissed
              </button>
            </>
          )}
        </span>
      </div>

      {applicable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-accent-soft px-4 py-2">
          <span className="text-[11px]">
            {applicable.length} finding{applicable.length === 1 ? "" : "s"} carry a figure that can
            be applied directly, because the right answer is a fact in another record.
          </span>
          <button
            disabled={busy || selected.size === 0}
            onClick={async () => {
              setBusy(true);
              try {
                await fetch("/api/bulk", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "apply_findings", findingIds: [...selected] }),
                });
                setSelected(new Set());
                onChanged();
              } finally {
                setBusy(false);
              }
            }}
            className="ml-auto shrink-0 rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-white transition hover:brightness-110 disabled:opacity-40"
          >
            Apply {selected.size || ""} as one action
          </button>
          <button
            onClick={() => setSelected(new Set(applicable.map((f) => f.id)))}
            className="shrink-0 text-[10px] text-muted hover:text-foreground"
          >
            select all
          </button>
        </div>
      )}

      <Section title={`Required steps · ${data.requiredSteps.length}`}>
        <ul className="space-y-0.5">
          {data.requiredSteps.map((step) => {
            const derived = DERIVED_STEPS[step]?.(data, live);
            const manual = data.completedSteps.find((c) => c.step === step);
            const done = derived ? derived.done : Boolean(manual);

            return (
              <li key={step} className="flex items-baseline gap-2 py-0.5">
                <span className={`w-3 shrink-0 text-[11px] ${done ? "text-accent" : "text-muted"}`}>
                  {done ? "✓" : "○"}
                </span>
                <span className={`min-w-0 flex-1 text-[12px] ${done ? "" : "font-medium"}`}>
                  {step}
                  <span className="ml-1.5 text-[10px] text-muted">
                    {derived
                      ? derived.because
                      : manual
                        ? `${manual.actorName}, ${manual.at.slice(0, 10)}`
                        : ""}
                  </span>
                  {derived?.refs && derived.refs.length > 0 && (
                    <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">
                      {derived.refs.slice(0, 4).map((ref) => (
                        <button
                          key={ref}
                          onClick={() => onOpenRef(ref)}
                          className="transition hover:brightness-95"
                        >
                          <Chip tone="quiet">{ref}</Chip>
                        </button>
                      ))}
                    </span>
                  )}
                </span>
                {!derived && !manual && (
                  <button
                    onClick={async () => {
                      await appendEvent({
                        type: "required_step",
                        scope: { kind: "step", id: step },
                        payload: { step },
                      });
                      onChanged();
                    }}
                    className="shrink-0 text-[10px] text-muted hover:text-accent"
                  >
                    mark done
                  </button>
                )}
                {derived && <Chip tone="quiet">derived</Chip>}
              </li>
            );
          })}
        </ul>
      </Section>

      {[...byFamily.entries()].map(([family, findings]) => (
        <Section key={family} title={`${FAMILY_LABEL[family]} · ${findings.length}`}>
          <ul className="space-y-1.5">
            {findings.map((finding) => (
              <FindingCard
                key={finding.id}
                finding={finding}
                check={checkById.get(finding.checkId)}
                onSelect={onSelect}
                onOpenRef={onOpenRef}
                onChanged={onChanged}
                selected={selected.has(finding.id)}
                onToggle={() => toggle(finding.id)}
              />
            ))}
          </ul>
        </Section>
      ))}

      {data.addressed.length > 0 && (
        <Section title={`Addressed · ${data.addressed.length}`}>
          <ul className="space-y-1">
            {data.addressed.map((item) => {
              const finding = data.findings.find((f) => f.id === item.findingId);
              return (
                <li key={item.findingId} className="rounded border border-[#cfe2ef] bg-accent-soft px-2 py-1.5">
                  <div className="text-[12px]">{finding?.title ?? item.findingId}</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    Corrected on{" "}
                    <button onClick={() => onSelect(item.lineKey)} className="font-mono hover:text-accent">
                      {item.lineKey}
                    </button>{" "}
                    to {formatMoney(item.to)} — {item.actorName}, {item.at.slice(0, 10)}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] text-muted">
            The check still reports these: it reads the packet, and the engine&rsquo;s return still
            says what it said. They are closed here because the figure was changed to what the
            other record holds — which is not the same as dismissing them.
          </p>
        </Section>
      )}

      {showDismissed && data.dismissals.length > 0 && (
        <Section title={`Dismissed · ${data.dismissals.length}`}>
          <ul className="space-y-1">
            {data.dismissals.map((d) => {
              const finding = data.findings.find((f) => f.id === d.findingId);
              return (
                <li key={d.findingId} className="rounded border border-edge px-2 py-1.5">
                  <div className="text-[12px]">{finding?.title ?? d.findingId}</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {d.reason} — {d.actorName}, {d.at.slice(0, 10)}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] text-muted">
            The check still runs and still reports these. Dismissing records that someone looked
            and decided; it does not silence the check.
          </p>
        </Section>
      )}

      <Section title={`Engine diagnostics · ${data.diagnostics.length}`}>
        <p className="mb-2 text-[10px] text-muted">
          The engine&rsquo;s own warnings, given with the packet. Shown as an input, not a verdict —
          one check re-tests each condition they assert.
        </p>
        <ul className="space-y-1">
          {data.diagnostics.map((d) => (
            <li key={d.code} className="flex items-start gap-2">
              <Chip tone={d.severity === "warning" ? "warn" : "quiet"}>{d.code}</Chip>
              <span className="min-w-0 flex-1 text-[11px]">{d.message}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function FindingCard({
  finding,
  check,
  onSelect,
  onOpenRef,
  onChanged,
  selected,
  onToggle,
}: {
  finding: Finding;
  check?: Omit<Check, "run">;
  onSelect: (k: string) => void;
  onOpenRef: (ref: string) => void;
  onChanged: () => void;
  selected: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <li
      className={`rounded border px-2 py-1.5 ${
        finding.severity === "high" ? "border-[#f3d4d2] bg-bad-soft" : "border-edge"
      }`}
    >
      <div className="flex items-baseline gap-1.5">
        {finding.suggestedAdjustment && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            title={`Apply ${finding.suggestedAdjustment.lineKey}: ${formatMoney(
              finding.suggestedAdjustment.from,
            )} to ${formatMoney(finding.suggestedAdjustment.to)}`}
            className="mt-0.5 shrink-0 accent-[#1f5c8b]"
          />
        )}
        <Chip tone={SEVERITY_TONE[finding.severity]}>{finding.severity}</Chip>
        <button
          onClick={() => finding.scope?.kind === "line" && onSelect(finding.scope.id)}
          className="min-w-0 flex-1 text-left text-[12px] font-medium hover:text-accent"
        >
          {finding.title}
        </button>
        {finding.amount !== undefined && (
          <span className="tnum shrink-0 text-[11px] text-muted">{formatMoney(finding.amount)}</span>
        )}
      </div>

      <p className="mt-0.5 text-[11px] leading-relaxed">{finding.detail}</p>

      {finding.suggestedAdjustment && (
        <p className="mt-1 text-[11px]">
          <Chip tone="accent">applicable</Chip>{" "}
          <span className="tnum">
            {finding.suggestedAdjustment.lineKey} {formatMoney(finding.suggestedAdjustment.from)}{" "}
            &rarr; {formatMoney(finding.suggestedAdjustment.to)}
          </span>{" "}
          <span className="text-muted">{finding.suggestedAdjustment.reason}</span>
        </p>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-1">
        {finding.refs.slice(0, 7).map((ref) => (
          <button key={ref} onClick={() => onOpenRef(ref)} className="transition hover:brightness-95">
            <Chip tone="accent">{ref}</Chip>
          </button>
        ))}
        <button
          onClick={() => setOpen(!open)}
          className="ml-auto text-[10px] text-muted hover:text-foreground"
        >
          {open ? "close" : "why this check"}
        </button>
      </div>

      {open && check && (
        <div className="mt-1.5 border-t border-edge pt-1.5 text-[11px] text-muted">
          <p>
            <span className="font-medium text-foreground">{check.id}</span> — {check.rationale}
          </p>
          <p className="mt-1">
            <span className="font-medium text-foreground">Checked independently:</span>{" "}
            {check.independent}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for dismissing"
              className="min-w-0 flex-1 rounded border border-edge bg-surface px-1.5 py-0.5 text-[11px] outline-none focus:border-accent"
            />
            <button
              disabled={busy || !reason.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await appendEvent({
                    type: "finding_dismissed",
                    scope: { kind: "finding", id: finding.id },
                    payload: { reason: reason.trim() },
                  });
                  onChanged();
                } finally {
                  setBusy(false);
                }
              }}
              className="shrink-0 rounded border border-edge px-1.5 py-0.5 text-[10px] font-medium transition hover:border-accent hover:text-accent disabled:opacity-40"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
