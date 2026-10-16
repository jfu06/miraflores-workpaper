"use client";

import { useCallback, useEffect, useState } from "react";

import { CATEGORY_LABEL, type EffectCategory, type TaxEffect } from "@/lib/adjust/effect";
import type { Provenance } from "@/lib/adjust/recompute";
import { appendEvent } from "@/lib/view/client";
import { formatMoney } from "@/lib/view/format";
import { Chip, Section } from "./ui";

interface Preview {
  from: number;
  defaultCategory: EffectCategory | null;
  category?: EffectCategory;
  effect?: TaxEffect;
  requiresPartner?: boolean;
  needsCategory?: boolean;
  wouldMove?: { key: string; label: string; from: number; to: number; provenance: Provenance }[];
  barriers?: { key: string; reason: string }[];
}

/**
 * Proposing a change.
 *
 * The preview is the point. Before anything is recorded it shows both what the
 * change would be estimated at — the figure the firm's partner threshold is
 * measured against — and which lines the arithmetic would actually carry it to,
 * exactly. Where the two differ, the reviewer can see that before committing.
 */
export function AdjustPanel({
  lineKey,
  currentValue,
  defaultCategory,
  onChanged,
}: {
  lineKey: string;
  currentValue: number;
  /** The category this line's change belongs to, so the control opens on the right one. */
  defaultCategory: string | null;
  onChanged: () => void;
}) {
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<EffectCategory | "">(
    (defaultCategory as EffectCategory | null) ?? "",
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = Number(to);
  const valid = to.trim() !== "" && Number.isFinite(target) && target !== currentValue;

  useEffect(() => {
    if (!valid) {
      setPreview(null);
      return;
    }
    let live = true;
    const url = `/api/effect?line=${encodeURIComponent(lineKey)}&to=${target}${
      category ? `&category=${category}` : ""
    }`;
    fetch(url)
      .then((r) => r.json())
      .then((p: Preview) => {
        if (!live) return;
        setPreview(p);
        if (!category && p.category) setCategory(p.category);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [lineKey, target, category, valid]);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await appendEvent({
        type: "adjustment",
        scope: { kind: "line", id: lineKey },
        payload: { to: target, reason: reason.trim(), category: category || undefined },
      });
      setTo("");
      setReason("");
      setCategory((defaultCategory as EffectCategory | null) ?? "");
      setPreview(null);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [lineKey, target, reason, category, defaultCategory, onChanged]);

  return (
    <Section title="Adjust">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="tnum text-[12px] text-muted">{formatMoney(currentValue)}</span>
        <span className="text-[11px] text-muted">&rarr;</span>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          inputMode="decimal"
          placeholder="new value"
          className="tnum w-28 rounded border border-edge bg-surface px-2 py-1 text-[12px] outline-none focus:border-accent"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as EffectCategory)}
          disabled={false}
          className="rounded border border-edge bg-surface px-1.5 py-1 text-[11px] outline-none focus:border-accent"
          title="Which per-dollar rate the effect is estimated with"
        >
          {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why — this is kept with the original figure"
        className="mt-1.5 w-full rounded border border-edge bg-surface px-2 py-1 text-[11px] outline-none placeholder:text-muted focus:border-accent"
      />

      {preview?.needsCategory && (
        <p className="mt-1.5 text-[11px] text-warn">
          This line has no default category. Choose the rate the effect should be estimated with.
        </p>
      )}

      {preview?.effect && (
        <div className="mt-2 rounded border border-edge bg-[#fafaf9] px-2 py-1.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <Chip tone={preview.effect.basis === "direct" ? "accent" : "neutral"}>
              {preview.effect.basis === "direct" ? "one for one" : "estimated"}
            </Chip>
            <span className="tnum text-[12px]">
              federal {formatMoney(preview.effect.federal)} &middot; California{" "}
              {formatMoney(preview.effect.california)}
            </span>
            {preview.effect.basis === "rate" && (
              <span className="text-[10px] text-muted">
                at {preview.effect.federalRate} / {preview.effect.californiaRate} per dollar
              </span>
            )}
            {preview.requiresPartner && <Chip tone="warn">partner sign-off required</Chip>}
          </div>

          {preview.effect.caveats.map((caveat) => (
            <p key={caveat} className="mt-1 text-[10px] leading-relaxed text-muted">
              {caveat}
            </p>
          ))}

          {preview.wouldMove && preview.wouldMove.length > 0 && (
            <div className="mt-1.5 border-t border-edge pt-1.5">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">
                Carried through exactly
              </p>
              <ul className="space-y-0.5">
                {preview.wouldMove.map((move) => (
                  <li key={move.key} className="flex items-baseline gap-2 text-[11px]">
                    <Chip tone={move.provenance === "recomputed" ? "accent" : "warn"}>
                      {move.provenance}
                    </Chip>
                    <span className="min-w-0 flex-1 truncate">{move.label}</span>
                    <span className="tnum shrink-0">
                      {formatMoney(move.from)} &rarr; {formatMoney(move.to)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.barriers && preview.barriers.length > 0 && (
            <p className="mt-1.5 border-t border-edge pt-1.5 text-[10px] text-warn">
              Stops at {preview.barriers.map((b) => b.key).join(", ")} — {preview.barriers[0].reason}
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-1.5 text-[11px] text-bad">{error}</p>}

      <button
        disabled={busy || !valid || !reason.trim()}
        onClick={submit}
        className="mt-2 rounded bg-accent px-2.5 py-1 text-[11px] font-medium text-white transition hover:brightness-110 disabled:opacity-40"
      >
        {preview?.requiresPartner ? "Propose adjustment" : "Adjust"}
      </button>
    </Section>
  );
}
