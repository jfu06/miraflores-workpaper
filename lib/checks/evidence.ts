/**
 * Checks on the evidence itself: does a number appear where it claims to come
 * from, do two documents of the same thing agree, and does detail add to summary.
 */

import { locatePage } from "../graph/document";
import type { ExtractedValue, PacketDocument } from "../packet/types";
import type { Check, Finding } from "./types";

const MONEY_TYPES = new Set(["money", "integer", "quantity"]);

/** Fields a broker prints once for the whole document, split by holding period. */
const SUMMARY_FIELD = /^(st|lt|short|long)[_-]?(?:term[_-]?)?(proceeds|basis|wash)$/i;
/** A summary printed for the account as a whole, with no holding-period split. */
const TOTAL_SUMMARY_FIELD = /^[a-z]?_?summary_(proceeds|basis|wash)$/i;
/** Fields a broker prints per lot, prefixed by the lot's own identifier. */
const LOT_FIELD = /^([A-Za-z]+\d+)_(proceeds|basis|wash|term|desc|acq|sold)$/;
/** An amount printed on a page, used to tell a blank continuation page from a hole. */
const MONEY_ON_PAGE = /\d[\d,]*\.\d{2}/;

function money(value: unknown): string {
  return typeof value === "number"
    ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(value);
}

export const valueNotOnPage: Check = {
  id: "EV-NOT-ON-PAGE",
  title: "Extracted amount does not appear on its own page",
  family: "evidence",
  rationale:
    "A value the workpaper traces to a page should be findable on that page. When it is not, either the pipeline read something that is not printed, or what is printed is ambiguous enough that the reading is a guess.",
  independent:
    "Re-reads every page's printed content and tries to locate each value verbatim, by its normalized form, and by numeric comparison. Uses no pipeline output other than the value being located.",
  run({ graph }) {
    const findings: Finding[] = [];

    for (const doc of graph.documents) {
      for (const page of doc.pages) {
        const values = graph.evsByDocPage.get(`${doc.id}#${page.page}`) ?? [];
        if (values.length === 0) continue;

        for (const located of locatePage(page.printed_content, values)) {
          if (located.method !== "none") continue;
          const ev = graph.evById.get(located.evId)!;

          // A zero usually means an empty box, and an absent zero on the page is
          // not evidence of anything.
          if (!MONEY_TYPES.has(ev.value_type) || ev.value === 0) continue;

          const landedOn = graph.linesByEv.get(ev.id) ?? [];
          findings.push({
            id: `EV-NOT-ON-PAGE:${ev.id}`,
            checkId: "EV-NOT-ON-PAGE",
            severity: landedOn.length > 0 ? "high" : "low",
            title: `${ev.label || ev.field} is not printed on ${doc.id} page ${ev.page}`,
            detail: `The pipeline recorded ${money(ev.value)} with confidence ${ev.confidence.toFixed(
              2,
            )}, reading it as "${ev.text_as_read}". Neither that reading nor the amount appears in the page's printed content.${
              landedOn.length > 0 ? ` It is used on ${landedOn.join(", ")}.` : " No return line uses it."
            }`,
            refs: [ev.id, `doc:${doc.id}#page${ev.page}`, ...landedOn],
            scope: landedOn[0] ? { kind: "line", id: landedOn[0] } : undefined,
            amount: typeof ev.value === "number" ? ev.value : undefined,
          });
        }
      }
    }

    return findings;
  },
};

export const lowConfidence: Check = {
  id: "EV-LOW-CONFIDENCE",
  title: "Low-confidence reading used on the return",
  family: "evidence",
  rationale:
    "The pipeline reports its own confidence. A reading it is unsure of should not reach a return line without someone having looked at it.",
  independent:
    "Reads the confidence the pipeline recorded and the reverse index of which lines cite the value. Does not rely on the engine having flagged it.",
  run({ graph }) {
    const THRESHOLD = 0.8;
    const findings: Finding[] = [];

    for (const ev of graph.documents.flatMap((d) => graph.evsByDoc.get(d.id) ?? [])) {
      if (ev.confidence >= THRESHOLD) continue;
      const landedOn = graph.linesByEv.get(ev.id) ?? [];
      if (landedOn.length === 0) continue;

      const doc = graph.docById.get(ev.document_id);
      findings.push({
        id: `EV-LOW-CONFIDENCE:${ev.id}`,
        checkId: "EV-LOW-CONFIDENCE",
        severity: ev.confidence < 0.5 ? "high" : "medium",
        title: `${ev.label || ev.field} read with confidence ${ev.confidence.toFixed(2)}`,
        detail: `${doc?.title ?? ev.document_id} page ${ev.page}. Read as "${
          ev.text_as_read
        }" and recorded as ${money(ev.value)}. Used on ${landedOn.join(", ")}.`,
        refs: [ev.id, ev.document_id, ...landedOn],
        scope: { kind: "line", id: landedOn[0] },
        amount: typeof ev.value === "number" ? ev.value : undefined,
      });
    }

    return findings;
  },
};

function fieldMap(values: ExtractedValue[]): Map<string, string | number | boolean> {
  return new Map(values.map((ev) => [ev.field, ev.value]));
}

export const documentConflict: Check = {
  id: "DOC-CONFLICT",
  title: "Two documents of the same thing disagree",
  family: "evidence",
  rationale:
    "The same form can arrive twice: re-uploaded, re-photographed, or corrected by the issuer. Whether the copies agree decides whether there is a duplicate to ignore or a conflict to resolve.",
  independent:
    "Compares the extracted fields of every pair of documents sharing a type, issuer and owner, field by field. Does not use the engine's own matching.",
  run({ graph }) {
    const findings: Finding[] = [];
    const groups = new Map<string, PacketDocument[]>();

    for (const doc of graph.documents) {
      // Tax year belongs in the key: the 2023 and 2025 Schedule K-1 from the same
      // S corporation are not two copies of one form, and their boxes are
      // supposed to differ.
      const key = `${doc.document_type}|${doc.issuer}|${doc.belongs_to}|${doc.tax_year}`;
      const list = groups.get(key);
      if (list) list.push(doc);
      else groups.set(key, [doc]);
    }

    for (const docs of groups.values()) {
      if (docs.length < 2) continue;

      for (let i = 0; i < docs.length; i += 1) {
        for (let j = i + 1; j < docs.length; j += 1) {
          const a = docs[i];
          const b = docs[j];
          const left = fieldMap(graph.evsByDoc.get(a.id) ?? []);
          const right = fieldMap(graph.evsByDoc.get(b.id) ?? []);

          const shared = [...left.keys()].filter((f) => right.has(f));
          if (shared.length === 0) continue;

          const differing = shared.filter((f) => left.get(f) !== right.get(f));
          const superseded = graph.versions.some(
            (v) => v.documents_superseded.includes(a.id) || v.documents_superseded.includes(b.id),
          );

          if (differing.length === 0) {
            findings.push({
              id: `DOC-CONFLICT:${a.id}+${b.id}`,
              checkId: "DOC-CONFLICT",
              severity: "low",
              title: `${a.id} and ${b.id} are the same document twice`,
              detail: `All ${shared.length} shared fields agree. ${b.title}. Counting both would double the amounts, so confirm only one is used.`,
              refs: [a.id, b.id],
            });
            continue;
          }

          findings.push({
            id: `DOC-CONFLICT:${a.id}+${b.id}`,
            checkId: "DOC-CONFLICT",
            severity: superseded ? "medium" : "high",
            title: `${a.id} and ${b.id} disagree on ${differing.length} field${
              differing.length === 1 ? "" : "s"
            }`,
            detail: `${differing
              .slice(0, 6)
              .map((f) => `${f}: ${money(left.get(f))} vs ${money(right.get(f))}`)
              .join("; ")}${differing.length > 6 ? "; …" : ""}. ${
              superseded
                ? "One supersedes the other, so the difference is expected — confirm the superseded figures are no longer used."
                : "Neither supersedes the other."
            }`,
            refs: [a.id, b.id],
          });
        }
      }
    }

    return findings;
  },
};

export const supersededStillUsed: Check = {
  id: "DOC-SUPERSEDED-USED",
  title: "A superseded document still feeds the return",
  family: "evidence",
  rationale:
    "When an issuer sends a corrected form, the original stops being evidence. A line still citing it is carrying a figure the issuer has withdrawn.",
  independent:
    "Walks the current return's source references and checks each cited document against the versions' own supersession records.",
  run({ graph }) {
    const findings: Finding[] = [];
    const superseded = new Set(graph.versions.flatMap((v) => v.documents_superseded));

    for (const docId of superseded) {
      const lines = graph.linesByDoc.get(docId) ?? [];
      if (lines.length === 0) continue;
      const doc = graph.docById.get(docId);
      findings.push({
        id: `DOC-SUPERSEDED-USED:${docId}`,
        checkId: "DOC-SUPERSEDED-USED",
        severity: "high",
        title: `${docId} is superseded but still cited by ${lines.length} line${
          lines.length === 1 ? "" : "s"
        }`,
        detail: `${doc?.title ?? docId}. Cited by ${lines.slice(0, 8).join(", ")}${
          lines.length > 8 ? ", …" : ""
        }.`,
        refs: [docId, ...lines.slice(0, 8)],
        scope: lines[0] ? { kind: "line", id: lines[0] } : undefined,
      });
    }

    return findings;
  },
};

export const detailSummaryTieOut: Check = {
  id: "TIE-OUT-DETAIL",
  title: "Transaction detail does not add to the summary",
  family: "evidence",
  rationale:
    "A broker prints both a summary and the lots behind it. If the lots do not add to the summary, either a lot is missing or one has been read wrong, and the return rests on whichever the engine happened to use.",
  independent:
    "Adds the extracted lots itself and compares the total to the summary the issuer printed. The engine's own totals are not consulted.",
  run({ graph }) {
    const findings: Finding[] = [];

    for (const doc of graph.documents) {
      const values = graph.evsByDoc.get(doc.id) ?? [];
      if (values.length === 0) continue;

      const summary = new Map<string, number>();
      const totals = new Map<string, number>();
      const lots = new Map<string, Record<string, string | number | boolean>>();

      for (const ev of values) {
        const asSummary = ev.field.match(SUMMARY_FIELD);
        if (asSummary && typeof ev.value === "number") {
          const term = asSummary[1].toLowerCase().startsWith("s") ? "short" : "long";
          summary.set(`${term}_${asSummary[2].toLowerCase()}`, ev.value);
          continue;
        }
        const asTotal = ev.field.match(TOTAL_SUMMARY_FIELD);
        if (asTotal && typeof ev.value === "number") {
          totals.set(asTotal[1].toLowerCase(), ev.value);
          continue;
        }
        const asLot = ev.field.match(LOT_FIELD);
        if (asLot) {
          const lot = lots.get(asLot[1]) ?? {};
          lot[asLot[2]] = ev.value;
          lots.set(asLot[1], lot);
        }
      }

      if (lots.size === 0) continue;

      // A summary printed for the account as a whole: compare against every lot.
      for (const [field, summaryValue] of totals) {
        const total = [...lots.values()].reduce(
          (sum, lot) => sum + (typeof lot[field] === "number" ? (lot[field] as number) : 0),
          0,
        );
        const difference = Math.round((summaryValue - total) * 100) / 100;
        if (Math.abs(difference) < 0.01) continue;

        findings.push({
          id: `TIE-OUT-DETAIL:${doc.id}:${field}`,
          checkId: "TIE-OUT-DETAIL",
          severity: "high",
          title: `${doc.id} ${field}: detail is off by ${money(difference)}`,
          detail: `The issuer's summary says ${money(summaryValue)}. The ${
            lots.size
          } extracted lots add to ${money(total)}.${
            doc.extraction.status !== "extracted"
              ? ` Extraction is ${doc.extraction.status}: ${doc.extraction.reason ?? ""}`
              : ""
          }`,
          refs: [doc.id],
          amount: Math.abs(difference),
        });
      }

      if (summary.size === 0) continue;

      for (const [summaryKey, summaryValue] of summary) {
        const [term, field] = summaryKey.split("_");
        const matching = [...lots.values()].filter((lot) =>
          String(lot.term ?? "").toLowerCase().startsWith(term),
        );
        if (matching.length === 0) continue;

        const total = matching.reduce(
          (sum, lot) => sum + (typeof lot[field] === "number" ? (lot[field] as number) : 0),
          0,
        );
        const difference = Math.round((summaryValue - total) * 100) / 100;
        if (Math.abs(difference) < 0.01) continue;

        findings.push({
          id: `TIE-OUT-DETAIL:${doc.id}:${summaryKey}`,
          checkId: "TIE-OUT-DETAIL",
          severity: "high",
          title: `${doc.id} ${term}-term ${field}: detail is off by ${money(difference)}`,
          detail: `The issuer's summary says ${money(summaryValue)}. The ${
            matching.length
          } extracted ${term}-term lots add to ${money(total)}.${
            doc.extraction.status !== "extracted"
              ? ` Extraction is ${doc.extraction.status}: ${doc.extraction.reason ?? ""}`
              : ""
          }`,
          refs: [doc.id],
          amount: Math.abs(difference),
        });
      }
    }

    return findings;
  },
};

export const unreadPages: Check = {
  id: "DOC-PAGE-UNREAD",
  title: "A document page was never read",
  family: "evidence",
  rationale:
    "A page the pipeline skipped is a hole in the evidence that nothing downstream can see. Whatever is on it is absent from the return without anything looking wrong.",
  independent:
    "Reads each page's own printed content and asks whether it holds figures that no extracted value accounts for. The pipeline's status is reported but not relied on — a page it considers read can still be empty, and a page it never mentions can still hold a transaction.",
  run({ graph }) {
    const findings: Finding[] = [];

    for (const doc of graph.documents) {
      if (doc.extraction.status === "not_extracted") continue;

      /**
       * Most unread pages are genuinely blank — a 32-page consolidated 1099 runs
       * twenty pages of "no further transactions". A page is only a hole when it
       * prints amounts and nothing was taken from it.
       */
      const holes = doc.pages.filter(
        (page) =>
          (graph.evsByDocPage.get(`${doc.id}#${page.page}`) ?? []).length === 0 &&
          MONEY_ON_PAGE.test(page.printed_content),
      );
      if (holes.length === 0) continue;

      findings.push({
        id: `DOC-PAGE-UNREAD:${doc.id}`,
        checkId: "DOC-PAGE-UNREAD",
        severity: "high",
        title: `${doc.id}: page ${holes.map((h) => h.page).join(", ")} prints amounts that were never extracted`,
        detail: `${doc.title}. ${holes
          .map((h) => `Page ${h.page}: "${h.printed_content.slice(0, 160)}${h.printed_content.length > 160 ? "…" : ""}"`)
          .join(" ")}${doc.extraction.reason ? ` Pipeline reason: ${doc.extraction.reason}` : ""}`,
        refs: [doc.id, ...holes.map((h) => `doc:${doc.id}#page${h.page}`)],
      });
    }

    return findings;
  },
};
