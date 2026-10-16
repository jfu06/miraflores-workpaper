"use client";

import { useEffect, useState } from "react";

import type { LineDetail } from "@/lib/view/models";
import { fetchLine } from "@/lib/view/client";
import { areaLabel } from "@/lib/view/areas";
import { formatValue } from "@/lib/view/format";
import { REF_KIND_LABEL } from "@/lib/graph/refs";
import { TraceNode } from "./TraceTree";
import { WorkPanel } from "./WorkPanel";
import { Chip, Empty, PaneHeader, Section } from "./ui";

interface Props {
  lineKey: string | null;
  onSelect: (key: string) => void;
  onOpenSource: (ref: string) => void;
  onWorkChanged: () => void;
}

/**
 * Everything known about one number.
 *
 * The order answers a reviewer's questions in the order they ask them: what is
 * it, what rule produced it, what was it built from, what evidence sits under it,
 * what does it feed, and has the engine said anything about it.
 */
export function NumberPanel({ lineKey, onSelect, onOpenSource, onWorkChanged }: Props) {
  const [detail, setDetail] = useState<LineDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lineKey) {
      setDetail(null);
      return;
    }
    let live = true;
    setError(null);
    fetchLine(lineKey)
      .then((d) => live && setDetail(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [lineKey]);

  if (!lineKey) {
    return (
      <div className="flex h-full flex-col">
        <PaneHeader eyebrow="Number" title="Nothing selected" />
        <Empty>Pick a line to see where its number came from.</Empty>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <PaneHeader eyebrow="Number" title={lineKey} />
        <p className="px-4 py-8 text-[12px] text-bad">{error}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-full flex-col">
        <PaneHeader eyebrow="Number" title={lineKey} />
        <Empty>Loading…</Empty>
      </div>
    );
  }

  const unresolved = detail.sources.filter((s) => !s.ok);

  return (
    <div className="flex h-full flex-col">
      <PaneHeader
        eyebrow={`${areaLabel(detail.area)} · ${detail.jurisdiction === "california" ? "California" : "Federal"}`}
        title={
          <span>
            <span className="font-mono text-[12px] text-muted">
              {detail.form} {detail.line}
            </span>
            <span className="mx-2 text-edge">|</span>
            {detail.label}
          </span>
        }
        right={<span className="tnum text-[15px] font-semibold">{formatValue(detail.value)}</span>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {detail.diagnostics.length > 0 && (
          <div className="border-b border-edge bg-warn-soft px-4 py-3">
            {detail.diagnostics.map((d) => (
              <div key={d.code} className="flex gap-2 py-0.5">
                <Chip tone={d.severity === "warning" ? "warn" : "neutral"}>{d.code}</Chip>
                <p className="text-[12px] text-[#5b4300]">{d.message}</p>
              </div>
            ))}
          </div>
        )}

        {detail.note && (
          <div className="border-b border-edge px-4 py-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Engine note
            </div>
            <p className="text-[12px]">{detail.note}</p>
          </div>
        )}

        <Section title="Rule">
          <div className="flex items-baseline gap-2">
            <Chip tone="quiet">{detail.rule}</Chip>
            <p className="flex-1 text-[12px]">
              {detail.ruleText ?? (
                <span className="text-bad">
                  Rule id is not described in engine_reference.rules.
                </span>
              )}
            </p>
          </div>
        </Section>

        <Section title={`Built from${detail.inputs.length ? ` · ${detail.inputs.length} inputs` : ""}`}>
          {detail.inputs.length > 0 || detail.sources.length > 0 ? (
            <TraceNode
              node={{
                key: detail.key,
                form: detail.form,
                line: detail.line,
                label: detail.label,
                value: detail.value,
                inputCount: detail.inputs.length,
                sourceCount: detail.sources.length,
              }}
              depth={0}
              onSelect={onSelect}
              onOpenSource={onOpenSource}
            />
          ) : (
            <p className="text-[12px] text-muted">
              No inputs and no source references on this line.
            </p>
          )}
        </Section>

        {detail.sources.length > 0 && (
          <Section title={`Evidence · ${detail.sources.length} reference${detail.sources.length === 1 ? "" : "s"}`}>
            {unresolved.length > 0 && (
              <p className="mb-2 rounded border border-[#f3d4d2] bg-bad-soft px-2 py-1.5 text-[11px] text-bad">
                {unresolved.length} of these references do not resolve against the packet.
              </p>
            )}
            <ul className="space-y-1">
              {detail.sources.map((source) => (
                <li key={source.parsed.raw}>
                  <button
                    onClick={() => onOpenSource(source.parsed.raw)}
                    className="flex w-full items-start gap-2 rounded px-1 py-1 text-left transition hover:bg-[#f4f4f2]"
                  >
                    <Chip tone={source.ok ? "accent" : "bad"}>{source.parsed.raw}</Chip>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium">{source.title}</span>
                      <span className="block text-[11px] text-muted">
                        {source.ok ? source.subtitle : source.reason}
                      </span>
                      {source.aliasedFrom && (
                        <span className="mt-0.5 block text-[10px] text-warn">
                          Non-standard reference format, resolved through an alias.
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">
                      {REF_KIND_LABEL[source.parsed.kind]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {detail.dependents.length > 0 && (
          <Section title={`Feeds into · ${detail.dependents.length}`}>
            <ul className="space-y-0.5">
              {detail.dependents.map((d) => (
                <li key={d.key}>
                  <button
                    onClick={() => onSelect(d.key)}
                    className="flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left transition hover:bg-[#f4f4f2]"
                  >
                    <span className="shrink-0 font-mono text-[10px] text-muted">
                      {d.form} {d.line}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px]">{d.label}</span>
                    <span className="tnum shrink-0 text-[12px]">{formatValue(d.value)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <WorkPanel scope={{ kind: "line", id: detail.key }} onChanged={onWorkChanged} />

        <div className="h-16" />
      </div>
    </div>
  );
}
