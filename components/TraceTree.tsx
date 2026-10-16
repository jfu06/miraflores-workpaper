"use client";

import { useEffect, useState } from "react";

import type { LineDetail, LineRef } from "@/lib/view/models";
import { fetchLine } from "@/lib/view/client";
import { formatValue } from "@/lib/view/format";
import { Chip } from "./ui";

interface Props {
  node: LineRef;
  depth: number;
  onSelect: (key: string) => void;
  onOpenSource: (ref: string) => void;
  /**
   * Lines the adjustment ledger has moved. The trace must show the same figure
   * the header does: a derivation that still reads the engine's number while the
   * total above it reads the adjusted one is exactly the inconsistency this
   * workpaper exists to remove.
   */
  adjusted?: Map<string, { value: number; original: number; provenance: string }>;
}

/**
 * One node of "how this number was built".
 *
 * Expanding walks `lines[].inputs` downward. A node with no inputs is where the
 * return meets the evidence, so instead of a dead end it shows its own source
 * references, and clicking one opens the source document at that field. That is
 * the whole trace, from a figure on Form 1040 to a box on a W-2, without leaving
 * the panel.
 */
export function TraceNode({ node, depth, onSelect, onOpenSource, adjusted }: Props) {
  const [open, setOpen] = useState(depth === 0);
  const [detail, setDetail] = useState<LineDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const expandable = node.inputCount > 0 || node.sourceCount > 0;
  const moved = adjusted?.get(node.key);

  useEffect(() => {
    if (!open || detail || !expandable) return;
    let live = true;
    fetchLine(node.key)
      .then((d) => live && setDetail(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [open, detail, expandable, node.key]);

  return (
    <div className={depth > 0 ? "border-l border-edge pl-3" : ""}>
      <div className="group flex items-baseline gap-1.5 py-[3px]">
        <button
          onClick={() => expandable && setOpen(!open)}
          disabled={!expandable}
          className={`mt-[1px] w-3 shrink-0 text-[9px] leading-3 ${
            expandable ? "text-muted hover:text-foreground" : "text-transparent"
          }`}
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? "▾" : "▸"}
        </button>

        <button
          onClick={() => onSelect(node.key)}
          className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left"
        >
          <span className="shrink-0 font-mono text-[10px] text-muted">
            {node.form} {node.line}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] hover:text-accent" title={node.label}>
            {node.label}
          </span>
          {moved && (
            <span className="tnum shrink-0 text-[10px] text-muted line-through">
              {formatValue(moved.original)}
            </span>
          )}
          <span
            className={`tnum shrink-0 text-[12px] font-medium ${moved ? "text-accent" : ""}`}
            title={moved ? moved.provenance : undefined}
          >
            {formatValue(moved ? moved.value : node.value)}
          </span>
        </button>
      </div>

      {open && (
        <div className="ml-[18px]">
          {error && <p className="py-1 text-[11px] text-bad">{error}</p>}

          {detail?.inputs.map((input) => (
            <TraceNode
              key={input.key}
              node={input}
              depth={depth + 1}
              onSelect={onSelect}
              onOpenSource={onOpenSource}
              adjusted={adjusted}
            />
          ))}

          {/* A node with no inputs is fed by evidence, not by other lines. */}
          {detail && detail.inputs.length === 0 && detail.sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 py-1">
              <span className="mr-0.5 text-[10px] text-muted">from</span>
              {detail.sources.map((source) => (
                <button
                  key={source.parsed.raw}
                  onClick={() => onOpenSource(source.parsed.raw)}
                  title={source.ok ? source.subtitle : source.reason}
                  className="transition hover:brightness-95"
                >
                  <Chip tone={source.ok ? "accent" : "bad"}>{source.parsed.raw}</Chip>
                </button>
              ))}
            </div>
          )}

          {detail && detail.inputs.length === 0 && detail.sources.length === 0 && (
            <p className="py-1 text-[10px] text-muted">
              No inputs and no sources — the engine produced this from rule{" "}
              <span className="font-mono">{detail.rule}</span> alone.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
