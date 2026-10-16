"use client";

import { useEffect, useState } from "react";

import { formatMoney, formatValue } from "@/lib/view/format";
import { Chip, Section } from "./ui";

interface NoticeRecord {
  notice: {
    id: string;
    agency: string;
    type: string;
    tax_year: number;
    dated: string;
    response_due?: string;
    items_under_examination?: string[];
  };
  preparedAt: string;
  filing: { jurisdiction: string; submissionId: string; acceptedAt: string; filedBy: string }[];
  items: {
    item: number;
    text: string;
    lines: {
      key: string;
      form: string;
      line: string;
      label: string;
      rule: string;
      ruleText?: string;
      valueAsFiled: number | string;
      valueNow: number | string;
      evidence: {
        ref: string;
        title: string;
        detail?: string;
        document?: { id: string; title?: string; issuer?: string };
        page?: number;
        field?: string;
        value?: number | string | boolean;
        confidence?: number;
        printed?: string;
      }[];
      addedInReview: { ref: string; title: string; detail?: string; by?: string; at: string }[];
      verifications: { type: string; by?: string; at: string; note?: string }[];
      questions: { question: string; askedOf: string; answer?: string; answeredBy?: string; channel?: string }[];
      signoffs: { level: string; by?: string; at: string; valid: boolean }[];
      findings: { id: string; severity: string; title: string; detail: string }[];
    }[];
  }[];
}

interface Rollforward {
  taxYear: number;
  nextYear: number;
  carryovers: { jurisdiction: string; items: { name: string; amount: number; source?: string }[]; zeroed: number }[];
  basis: { name: string; ref: string; entries: Record<string, unknown>[] }[];
  planning: {
    federal_safe_harbor: string;
    california_safe_harbor: string;
    known_2026_changes_for_this_household: string[];
    federal_estimate_due_dates: string[];
  };
  openItems: { id: string; severity: string; title: string; lineKey?: string }[];
  assetsWithDifferences: number;
}

/**
 * After filing: answering a notice, and handing the year on.
 *
 * Both are the same question asked at different distances — what does someone
 * need who was not here. The notice record answers it for an examiner two years
 * later; the rollforward answers it for next year's preparer.
 */
export function After({
  onSelect,
  onOpenRef,
}: {
  onSelect: (key: string) => void;
  onOpenRef: (ref: string) => void;
}) {
  const [notice, setNotice] = useState<NoticeRecord | null>(null);
  const [roll, setRoll] = useState<Rollforward | null>(null);

  useEffect(() => {
    fetch("/api/notice?id=N-2025-L566").then((r) => r.json()).then(setNotice).catch(() => undefined);
    fetch("/api/rollforward").then((r) => r.json()).then(setRoll).catch(() => undefined);
  }, []);

  return (
    <>
      {notice?.notice && (
        <>
          <div className="border-b border-edge px-4 py-2.5">
            <div className="flex flex-wrap items-baseline gap-2">
              <Chip tone="bad">{notice.notice.type}</Chip>
              <span className="text-[12px] font-medium">
                {notice.notice.agency}, tax year {notice.notice.tax_year}
              </span>
              <span className="text-[11px] text-muted">
                dated {notice.notice.dated}
                {notice.notice.response_due && ` · response due ${notice.notice.response_due}`}
              </span>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(notice, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${notice.notice.id}-record.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="ml-auto rounded border border-edge px-2 py-0.5 text-[11px] font-medium transition hover:border-accent hover:text-accent"
              >
                Export the record
              </button>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              Everything below is assembled from the file: the figure as filed, the document and
              page behind each component, who verified it and how, what the client was asked and
              answered, who signed, and what the firm&rsquo;s own checks said — including where they
              disagree with the return. The export is readable without this system.
            </p>
          </div>

          {notice.items.map((item) => (
            <Section key={item.item} title={`Item ${item.item}`}>
              <p className="mb-2 text-[12px] italic">{item.text}</p>

              {item.lines.length === 0 && (
                <p className="text-[11px] text-muted">
                  No line on the current return has been mapped to this item.
                </p>
              )}

              {item.lines.map((line) => (
                <div key={line.key} className="mb-3 rounded border border-edge px-2 py-2">
                  <div className="flex items-baseline gap-2">
                    <button onClick={() => onSelect(line.key)} className="shrink-0 font-mono text-[10px] text-muted hover:text-accent">
                      {line.key}
                    </button>
                    <span className="min-w-0 flex-1 text-[12px] font-medium">{line.label}</span>
                    <span className="tnum shrink-0 text-[12px]">{formatValue(line.valueAsFiled)}</span>
                  </div>
                  {line.ruleText && (
                    <p className="mt-0.5 text-[10px] text-muted">
                      {line.rule}: {line.ruleText}
                    </p>
                  )}

                  {line.findings.length > 0 && (
                    <div className="mt-1.5 rounded border border-[#f3d4d2] bg-bad-soft px-2 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-bad">
                        The firm&rsquo;s own checks on this item
                      </p>
                      {line.findings.map((f) => (
                        <p key={f.id} className="mt-0.5 text-[11px]">
                          <Chip tone={f.severity === "high" ? "bad" : "warn"}>{f.severity}</Chip>{" "}
                          {f.title}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="mt-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">
                      Evidence · {line.evidence.length}
                    </p>
                    <ul className="mt-0.5 space-y-1">
                      {line.evidence.slice(0, 8).map((e) => (
                        <li key={e.ref} className="text-[11px]">
                          <button onClick={() => onOpenRef(e.ref)} className="transition hover:brightness-95">
                            <Chip tone="accent">{e.ref}</Chip>
                          </button>{" "}
                          {e.document ? (
                            <>
                              <span className="font-medium">{e.document.id}</span> p{e.page}, field{" "}
                              <span className="font-mono text-[10px]">{e.field}</span> ={" "}
                              <span className="tnum">{formatValue(e.value)}</span>
                              <span className="text-muted"> — {e.document.title}</span>
                            </>
                          ) : (
                            <span>{e.title}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {line.addedInReview.length > 0 && (
                    <div className="mt-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">
                        Added in review
                      </p>
                      {line.addedInReview.map((a) => (
                        <p key={a.ref} className="text-[11px]">
                          {a.title} <span className="text-muted">— {a.detail}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {line.questions.length > 0 && (
                    <div className="mt-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">
                        Asked and answered
                      </p>
                      {line.questions.map((q, i) => (
                        <p key={i} className="text-[11px]">
                          <span className="text-muted">Q ({q.askedOf}):</span> {q.question}
                          {q.answer && (
                            <>
                              <br />
                              <span className="text-muted">A ({q.answeredBy}, {q.channel}):</span> {q.answer}
                            </>
                          )}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {line.verifications.map((v, i) => (
                      <Chip key={i} tone="accent" title={v.note}>
                        {v.type.replace(/_/g, " ")} · {v.by}
                      </Chip>
                    ))}
                    {line.signoffs.map((s, i) => (
                      <Chip key={i} tone={s.valid ? "accent" : "warn"}>
                        {s.level} · {s.by}
                      </Chip>
                    ))}
                    {line.verifications.length === 0 && line.signoffs.length === 0 && (
                      <span className="text-[10px] text-muted">
                        Nothing verified or signed on this line.
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </Section>
          ))}
        </>
      )}

      {roll && (
        <>
          <Section title={`Carry forward to ${roll.nextYear}`}>
            {roll.carryovers.map((group) => (
              <div key={group.jurisdiction} className="mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">
                  {group.jurisdiction}
                </p>
                {group.items.length === 0 ? (
                  <p className="text-[11px] text-muted">
                    Nothing carries forward. {group.zeroed} carryovers were used up this year.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {group.items.map((item) => (
                      <li key={item.name} className="flex items-baseline gap-2 text-[11px]">
                        <span className="min-w-0 flex-1">{item.name.replace(/_/g, " ")}</span>
                        {item.source && (
                          <button onClick={() => onSelect(item.source!)} className="shrink-0">
                            <Chip tone="quiet">{item.source}</Chip>
                          </button>
                        )}
                        <span className="tnum shrink-0">{formatMoney(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <p className="mt-1 text-[10px] text-muted">
              {roll.assetsWithDifferences} assets carry a federal-to-California depreciation
              difference that has to travel with them.
            </p>
          </Section>

          <Section title="Still open when the year closed">
            {roll.openItems.length === 0 ? (
              <p className="text-[11px] text-muted">Nothing outstanding.</p>
            ) : (
              <ul className="space-y-0.5">
                {roll.openItems.slice(0, 12).map((item) => (
                  <li key={item.id} className="flex items-baseline gap-2 text-[11px]">
                    <Chip tone={item.severity === "high" ? "bad" : "warn"}>{item.severity}</Chip>
                    <button
                      onClick={() => item.lineKey && onSelect(item.lineKey)}
                      className="min-w-0 flex-1 truncate text-left hover:text-accent"
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-[10px] text-muted">
              An open question does not close because the year ended. These arrive with the file.
            </p>
          </Section>

          <Section title={`Planning ${roll.nextYear}`}>
            <p className="text-[11px]">{roll.planning.federal_safe_harbor}</p>
            <p className="mt-1 text-[11px]">{roll.planning.california_safe_harbor}</p>
            <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">
              What changes for this household
            </p>
            <ul className="mt-0.5 space-y-0.5">
              {roll.planning.known_2026_changes_for_this_household.map((change) => (
                <li key={change} className="text-[11px]">
                  {change}
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </>
  );
}
