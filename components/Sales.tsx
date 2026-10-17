"use client";

import { useEffect, useMemo, useState } from "react";

import type { Lot, SalesReport } from "@/lib/view/sales";
import { formatMoney, formatValue } from "@/lib/view/format";
import { Chip, Empty, Section } from "./ui";

type View = "exceptions" | "all";
type Sort = "gain" | "proceeds" | "sold";

/**
 * 295 lots, arranged so nobody has to read 295 lots.
 *
 * Box totals first, each tied against the engine's own figure for that box;
 * then the lots something is unusual about; then the rest, only if asked for.
 * A reviewer who reads only the first screen has still seen everything that
 * could be wrong.
 */
export function Sales({ onSelect, onOpenRef }: { onSelect: (key: string) => void; onOpenRef: (ref: string) => void }) {
  const [data, setData] = useState<SalesReport | null>(null);
  const [view, setView] = useState<View>("exceptions");
  const [sort, setSort] = useState<Sort>("gain");
  const [query, setQuery] = useState("");
  const [box, setBox] = useState<string>("");

  useEffect(() => {
    fetch("/api/sales")
      .then((r) => r.json())
      .then((d: SalesReport) => setData(d))
      .catch(() => undefined);
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const source = view === "exceptions" ? data.exceptions : data.lots;
    const needle = query.trim().toLowerCase();

    return source
      .filter((lot) => (box ? lot.box === box : true))
      .filter((lot) =>
        needle
          ? lot.description.toLowerCase().includes(needle) || lot.key.toLowerCase().includes(needle)
          : true,
      )
      .sort((a, b) => {
        if (sort === "gain") return Math.abs(b.gain) - Math.abs(a.gain);
        if (sort === "proceeds") return (b.proceeds ?? 0) - (a.proceeds ?? 0);
        return (b.sold ?? "").localeCompare(a.sold ?? "");
      });
  }, [data, view, query, box, sort]);

  if (!data) return <Empty>Loading…</Empty>;

  const allTie = data.boxes.every((b) => b.ties);

  return (
    <>
      <div className="border-b border-edge px-4 py-2.5 text-[11px]">
        <span className="font-medium">
          {data.counts.lots} lots across {data.boxes.length} boxes, from{" "}
          {data.counts.documents} documents
        </span>
        <span className="text-muted">
          {" · "}
          {data.counts.exceptions} worth a look · net {formatMoney(data.netGain)}
        </span>
      </div>

      <Section title="Boxes">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.06em] text-muted">
              <th className="pb-1 text-left font-semibold">Box</th>
              <th className="pb-1 text-right font-semibold">Lots</th>
              <th className="pb-1 text-right font-semibold">Proceeds</th>
              <th className="pb-1 text-right font-semibold">Basis</th>
              <th className="pb-1 text-right font-semibold">Adj</th>
              <th className="pb-1 text-right font-semibold">Gain</th>
              <th className="pb-1 text-right font-semibold">Engine</th>
            </tr>
          </thead>
          <tbody>
            {data.boxes.map((summary) => (
              <tr key={summary.box} className="border-t border-edge">
                <td className="py-1">
                  <button
                    onClick={() => setBox(box === summary.box ? "" : summary.box)}
                    className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
                      box === summary.box ? "bg-accent text-white" : "hover:bg-[#f4f4f2]"
                    }`}
                  >
                    {summary.box}
                  </button>
                </td>
                <td className="tnum py-1 text-right text-[12px] text-muted">{summary.lots}</td>
                <td className="tnum py-1 text-right text-[12px]">{formatMoney(summary.proceeds)}</td>
                <td className="tnum py-1 text-right text-[12px]">{formatMoney(summary.basis)}</td>
                <td className="tnum py-1 text-right text-[12px] text-muted">
                  {summary.adjustment === 0 ? "—" : formatMoney(summary.adjustment)}
                </td>
                <td className="tnum py-1 text-right text-[12px] font-medium">
                  {formatMoney(summary.gain)}
                </td>
                <td className="tnum py-1 text-right text-[12px]">
                  {summary.totalKey ? (
                    <button onClick={() => onSelect(summary.totalKey!)} className="hover:text-accent">
                      {formatValue(summary.totalValue)}
                    </button>
                  ) : (
                    "—"
                  )}
                  <Chip tone={summary.ties ? "accent" : "bad"}>
                    {summary.ties ? "ties" : formatMoney(summary.difference)}
                  </Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          {allTie
            ? "Every box's gain, added here from the lots, equals the engine's own total for that box."
            : "A box whose gain does not equal the engine's total is flagged."}{" "}
          The proceeds and basis columns are what the brokers reported. Where a lot used an adjusted
          basis from a stock-plan supplement the gain reflects that and these two columns do not, so
          they can differ from the engine&rsquo;s stated composition while the gain still ties.
        </p>
      </Section>

      <div className="flex flex-wrap items-center gap-1.5 border-y border-edge px-4 py-2">
        {(
          [
            ["exceptions", `Worth a look ${data.counts.exceptions}`],
            ["all", `All ${data.counts.lots}`],
          ] as [View, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setView(value)}
            className={`rounded border px-2 py-0.5 text-[11px] font-medium transition ${
              view === value ? "border-accent bg-accent text-white" : "border-edge text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
        {box && (
          <button onClick={() => setBox("")} className="rounded border border-edge px-2 py-0.5 text-[11px] text-muted">
            box {box} ✕
          </button>
        )}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded border border-edge bg-surface px-1.5 py-1 text-[11px] outline-none focus:border-accent"
        >
          <option value="gain">largest gain or loss</option>
          <option value="proceeds">largest proceeds</option>
          <option value="sold">most recently sold</option>
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by security"
          className="ml-auto w-48 rounded border border-edge bg-surface px-2 py-1 text-[11px] outline-none placeholder:text-muted focus:border-accent"
        />
      </div>

      <Section title={`${rows.length} lot${rows.length === 1 ? "" : "s"}`}>
        <ul className="space-y-0.5">
          {rows.slice(0, 200).map((lot) => (
            <LotRow key={lot.key} lot={lot} onSelect={onSelect} onOpenRef={onOpenRef} />
          ))}
        </ul>
        {rows.length > 200 && (
          <p className="mt-2 text-[10px] text-muted">
            Showing the first 200. Narrow by box or security rather than scrolling — the point of
            this view is that nobody should have to read {data.counts.lots} rows.
          </p>
        )}
      </Section>
    </>
  );
}

function LotRow({
  lot,
  onSelect,
  onOpenRef,
}: {
  lot: Lot;
  onSelect: (key: string) => void;
  onOpenRef: (ref: string) => void;
}) {
  return (
    <li className={`rounded px-1.5 py-1 ${lot.flags.length > 0 ? "bg-warn-soft" : "hover:bg-[#f4f4f2]"}`}>
      <div className="flex items-baseline gap-2">
        <span className="w-6 shrink-0 font-mono text-[10px] text-muted">{lot.box}</span>
        <button
          onClick={() => onSelect(lot.key)}
          className="min-w-0 flex-1 truncate text-left text-[12px] hover:text-accent"
          title={lot.description}
        >
          {lot.description}
        </button>
        <span className="tnum w-24 shrink-0 text-right text-[11px] text-muted">
          {lot.proceeds === undefined ? "—" : formatMoney(lot.proceeds)}
        </span>
        <span className="tnum w-24 shrink-0 text-right text-[11px] text-muted">
          {lot.basis === undefined ? "—" : formatMoney(lot.basis)}
        </span>
        <span
          className={`tnum w-24 shrink-0 text-right text-[12px] font-medium ${
            lot.gain < 0 ? "text-accent" : ""
          }`}
        >
          {formatMoney(lot.gain)}
        </span>
      </div>
      {(lot.flags.length > 0 || lot.sold) && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1 pl-8">
          {lot.acquired && lot.sold && (
            <span className="text-[10px] text-muted">
              {lot.acquired} → {lot.sold}
              {lot.heldDays !== undefined && ` · ${lot.heldDays} days`}
            </span>
          )}
          {lot.flags.map((flag) => (
            <Chip key={flag} tone="warn">
              {flag}
            </Chip>
          ))}
          {lot.documents.map((id) => (
            <button key={id} onClick={() => onOpenRef(id)} className="transition hover:brightness-95">
              <Chip tone="quiet">{id}</Chip>
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
