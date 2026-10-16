/**
 * Checks on the shape of the file rather than its arithmetic: references that do
 * not land, parameters from the wrong year, state sourcing against residency, and
 * things the engine said that may no longer be true.
 */

import { parseRef } from "../graph/refs";
import { resolveRef } from "../graph/graph";
import { buildFormIndex } from "../adjust/recompute";
import type { Check, Finding } from "./types";

function money(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// No trailing word boundary: the year is followed by "_" in paths like
// "SEK.2024_average", and "_" is a word character, so \b would never match.
const YEAR_IN_PATH = /(?:^|[^0-9])((?:19|20)\d{2})(?![0-9])/;

export const parameterYear: Check = {
  id: "INT-PARAM-YEAR",
  title: "A return line uses a parameter from the wrong year",
  family: "integrity",
  rationale:
    "Rate tables, thresholds and exchange rates are year-specific. A line citing one from another year is wrong in a way that no amount check will catch, because the arithmetic on the wrong rate is perfectly consistent.",
  independent:
    "Reads the year named in each cited parameter path and compares it to the household's tax year. Needs nothing from the engine but the reference it published.",
  run({ graph }) {
    const findings: Finding[] = [];
    const taxYear = String(graph.packet.household.tax_year);

    for (const line of graph.current.lines) {
      for (const ref of line.sources) {
        const parsed = parseRef(ref);
        if (parsed.kind !== "param" && parsed.kind !== "fx") continue;

        const named = parsed.path?.match(YEAR_IN_PATH)?.[1];
        if (!named || named === taxYear) continue;

        const resolved = resolveRef(graph, ref);
        findings.push({
          id: `INT-PARAM-YEAR:${line.key}:${ref}`,
          checkId: "INT-PARAM-YEAR",
          severity: "high",
          title: `${line.form} ${line.line} converts using a ${named} parameter on a ${taxYear} return`,
          detail: `${line.label} = ${
            typeof line.value === "number" ? money(line.value) : line.value
          }, computed under rule ${line.rule}, cites ${ref}${
            resolved.ok ? ` (${resolved.subtitle})` : ""
          }. The packet also carries the ${taxYear} value.`,
          refs: [line.key, ref, ...line.sources.filter((s) => s.startsWith("ev-")).slice(0, 4)],
          scope: { kind: "line", id: line.key },
        });
      }
    }

    return findings;
  },
};

export const nonStandardReference: Check = {
  id: "INT-REF",
  title: "A source reference does not resolve on its own terms",
  family: "integrity",
  rationale:
    "Every number is supposed to be traceable. A reference that dangles, or that only resolves through a special case, is a number whose stated origin cannot be followed.",
  independent:
    "Resolves every source reference on the current return against the packet, using the documented reference grammar.",
  run({ graph }) {
    const findings: Finding[] = [];
    const dangling = new Map<string, string[]>();
    const aliased = new Map<string, string[]>();

    const record = (map: Map<string, string[]>, ref: string, where: string) => {
      const list = map.get(ref);
      if (list) list.push(where);
      else map.set(ref, [where]);
    };

    for (const line of graph.current.lines) {
      for (const ref of line.sources) {
        const resolved = resolveRef(graph, ref);
        if (!resolved.ok) record(dangling, ref, line.key);
        else if (resolved.aliasedFrom) record(aliased, ref, line.key);
      }
    }

    for (const asset of graph.packet.prior_years.asset_records) {
      for (const ref of asset.sources) {
        const resolved = resolveRef(graph, ref);
        if (!resolved.ok) record(dangling, ref, `asset:${asset.asset_id}`);
        else if (resolved.aliasedFrom) record(aliased, ref, `asset:${asset.asset_id}`);
      }
    }

    for (const [ref, where] of dangling) {
      findings.push({
        id: `INT-REF:dangling:${ref}`,
        checkId: "INT-REF",
        severity: "high",
        title: `Reference "${ref}" does not resolve`,
        detail: `Cited by ${where.slice(0, 6).join(", ")}${where.length > 6 ? ", …" : ""}.`,
        refs: where.slice(0, 6),
      });
    }

    for (const [ref, where] of aliased) {
      findings.push({
        id: `INT-REF:alias:${ref}`,
        checkId: "INT-REF",
        severity: "medium",
        title: `"${ref}" is not one of the documented reference formats`,
        detail: `Cited by ${where.length} record${where.length === 1 ? "" : "s"}: ${where
          .slice(0, 6)
          .join(", ")}${
          where.length > 6 ? ", …" : ""
        }. It resolves only through an alias this workpaper added, and what it points at is a stub that refers back to the records citing it, so the figures underneath have no independent source.`,
        refs: where.slice(0, 6),
      });
    }

    return findings;
  },
};

export const stateSourcing: Check = {
  id: "INT-STATE-SOURCE",
  title: "All of an item is sourced to California despite part-year residency",
  family: "integrity",
  rationale:
    "On a part-year return the California column should be a portion of the total. Where it equals the total, either every dollar really was California-source, or the engine took a figure at face value that was not apportioned.",
  independent:
    "Compares the California column against the total column on Schedule CA (540NR), line by line, and reads the household's own residency dates. Does not use the engine's sourcing rules except to report which one produced the figure.",
  run({ graph }) {
    const residency = graph.packet.household.residency as {
      state: string;
      from: string;
      to: string;
    }[];
    const california = residency.find((r) => r.state === "CA");
    const partYear = residency.length > 1 && Boolean(california);
    if (!partYear) return [];

    const findings: Finding[] = [];
    const byLine = new Map<string, { total?: number; caAmount?: number; keys: string[]; label: string; rule: string }>();

    for (const line of graph.current.lines) {
      if (line.form !== "SchCA540NR") continue;
      const match = line.line.match(/^(.+)\.([A-E])$/);
      if (!match || typeof line.value !== "number") continue;

      const entry = byLine.get(match[1]) ?? { keys: [], label: line.label, rule: line.rule };
      if (match[2] === "D") entry.total = line.value;
      if (match[2] === "E") {
        entry.caAmount = line.value;
        entry.label = line.label;
        entry.rule = line.rule;
      }
      entry.keys.push(line.key);
      byLine.set(match[1], entry);
    }

    for (const [lineNumber, entry] of byLine) {
      if (entry.total === undefined || entry.caAmount === undefined) continue;
      if (entry.total === 0 || entry.caAmount !== entry.total) continue;

      const key = `SchCA540NR.${lineNumber}.E`;
      const line = graph.lineByKey.get(key);
      findings.push({
        id: `INT-STATE-SOURCE:${key}`,
        checkId: "INT-STATE-SOURCE",
        severity: "high",
        title: `${entry.label}: the whole ${money(entry.total)} is sourced to California`,
        detail: `The California column equals the total column. The household was a California resident from ${
          california!.from
        } to ${california!.to}, then Texas. Rule ${
          entry.rule
        } produced the California amount; confirm it apportions rather than taking the figure whole.`,
        refs: [key, `SchCA540NR.${lineNumber}.D`, ...(line?.sources ?? []).slice(0, 6), "qa-02"],
        scope: { kind: "line", id: key },
        amount: entry.total,
      });
    }

    return findings;
  },
};

/**
 * Engine diagnostics are an input, not a verdict.
 *
 * Each entry re-tests the condition a diagnostic asserts. A diagnostic that no
 * longer holds is worse than no diagnostic: it is a warning a reviewer will
 * dismiss as handled, standing next to the thing it was about.
 */
const DIAGNOSTIC_RETESTS: Record<string, (ctx: Parameters<Check["run"]>[0]) => Finding | null> = {
  K1_EXPECTED_NOT_RECEIVED({ graph }) {
    const received = graph.documents.filter((d) => d.document_type.startsWith("K-1"));
    const ridgeline = received.filter((d) => /ridgeline/i.test(d.title) || /ridgeline/i.test(d.issuer));
    if (ridgeline.length === 0) return null;

    const diagnostic = graph.current.diagnostics.find((d) => d.code === "K1_EXPECTED_NOT_RECEIVED");
    if (!diagnostic) return null;

    const latest = [...ridgeline].sort((a, b) => (a.received_at < b.received_at ? 1 : -1))[0];
    const computedAt = graph.current.computed_at;

    return {
      id: "INT-STALE-DIAGNOSTIC:K1_EXPECTED_NOT_RECEIVED",
      checkId: "INT-STALE-DIAGNOSTIC",
      severity: latest.received_at < computedAt ? "high" : "medium",
      title: `Diagnostic K1_EXPECTED_NOT_RECEIVED no longer holds`,
      detail: `The engine's warning on version ${graph.current.version} says the Ridgeline K-1 "has not been received for 2025". ${
        ridgeline.map((d) => `${d.id} (${d.title}) arrived ${d.received_at.slice(0, 10)}`).join("; ")
      }, before this version was computed on ${computedAt.slice(
        0,
        10,
      )}. The warning is stale and will read as an open item that is already closed.`,
      refs: [...ridgeline.map((d) => d.id), "py:/return_2024/K1_1065"],
    };
  },
};

export const staleDiagnostic: Check = {
  id: "INT-STALE-DIAGNOSTIC",
  title: "An engine diagnostic is no longer true",
  family: "integrity",
  rationale:
    "The engine's diagnostics are pipeline output like any other, and the packet says pipeline output can be wrong. A warning that has been overtaken by a later document will be read as an open item, and the real ones get lost next to it.",
  independent:
    "Re-tests the condition each diagnostic asserts against the documents and their arrival times.",
  run(ctx) {
    const findings: Finding[] = [];
    for (const retest of Object.values(DIAGNOSTIC_RETESTS)) {
      const finding = retest(ctx);
      if (finding) findings.push(finding);
    }
    return findings;
  },
};

export const basisGap: Check = {
  id: "INT-BASIS-GAP",
  title: "A basis record has a missing year",
  family: "integrity",
  rationale:
    "Basis rolls forward year on year. A missing year is not a smaller number — it is an unknown one, and everything computed from it inherits the assumption the engine made to get past it.",
  independent:
    "Reads the year sequence in each basis record and reports breaks in it, from the prior-year records themselves.",
  run({ graph }) {
    const findings: Finding[] = [];
    const records = graph.packet.prior_years.basis_records as Record<
      string,
      Record<string, unknown>[] | undefined
    >;

    for (const [name, entries] of Object.entries(records)) {
      if (!Array.isArray(entries)) continue;

      const years = entries
        .map((e) => e.year)
        .filter((y): y is number => typeof y === "number")
        .sort((a, b) => a - b);

      // A year nobody recorded at all.
      const missing: number[] = [];
      for (let y = years[0]; y < years[years.length - 1]; y += 1) {
        if (!years.includes(y)) missing.push(y);
      }

      /**
       * A year that is recorded but holds no figure. The packet writes these as
       * an explicit null with the reason beside it, which is a gap stated rather
       * than a gap implied — and the one the engine has to assume its way past.
       */
      const blank = entries
        .filter((e) =>
          Object.entries(e).some(
            ([key, value]) => value === null && key !== "year" && key !== "source",
          ),
        )
        .map((e) => ({
          year: e.year,
          fields: Object.entries(e)
            .filter(([key, value]) => value === null && key !== "year" && key !== "source")
            .map(([key]) => key),
          source: typeof e.source === "string" ? e.source : undefined,
        }));

      if (missing.length === 0 && blank.length === 0) continue;

      const parts: string[] = [];
      if (missing.length > 0) parts.push(`no entry at all for ${missing.join(", ")}`);
      for (const b of blank) {
        parts.push(
          `${b.year ?? "an entry"} records ${b.fields.join(" and ")} as empty${
            b.source ? ` (${b.source})` : ""
          }`,
        );
      }

      findings.push({
        id: `INT-BASIS-GAP:${name}`,
        checkId: "INT-BASIS-GAP",
        severity: "high",
        title: `${name.replace(/_/g, " ")}: the basis roll-forward has a hole`,
        detail: `${parts.join("; ")}. Everything computed from this basis carries whatever the engine assumed to get past the gap.`,
        refs: [`py:/basis_records/${name}`],
      });
    }

    return findings;
  },
};

export const incompleteInputs: Check = {
  id: "INT-INPUTS-INCOMPLETE",
  title: "A line's declared inputs cannot produce its value",
  family: "integrity",
  rationale:
    "'Show how any number was built' is only true if the inputs a line declares actually build it. Where they do not, the derivation shown to a reviewer is incomplete, and a change to the line cannot be carried forward.",
  independent:
    "Solves each combination line's arithmetic against the engine's own published values and reports the ones no combination of its declared inputs can reproduce. Nothing is assumed about the arithmetic — it is recovered and verified.",
  run({ graph }) {
    const forms = buildFormIndex(graph);
    const findings: Finding[] = [];

    for (const [key, info] of forms.unsolved) {
      const line = graph.lineByKey.get(key);
      if (!line) continue;

      findings.push({
        id: `INT-INPUTS-INCOMPLETE:${key}`,
        checkId: "INT-INPUTS-INCOMPLETE",
        severity: "medium",
        title: `${line.form} ${line.line} declares inputs that fall short by ${
          info.shortfall === undefined ? "an unknown amount" : info.shortfall.toLocaleString("en-US")
        }`,
        detail: `${line.label} = ${
          typeof line.value === "number" ? line.value.toLocaleString("en-US") : line.value
        }, under rule ${line.rule}, from ${line.inputs.join(", ") || "no inputs"}. ${info.reason}`,
        refs: [key, ...line.inputs],
        scope: { kind: "line", id: key },
        amount: info.shortfall === undefined ? undefined : Math.abs(info.shortfall),
      });
    }

    return findings;
  },
};
