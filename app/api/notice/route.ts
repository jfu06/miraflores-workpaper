import { NextResponse } from "next/server";

import { appliedAdjustments, buildLedger } from "@/lib/adjust/ledger";
import { buildFormIndex, recompute } from "@/lib/adjust/recompute";
import { allFindings, runChecks } from "@/lib/checks/run";
import { actorIndex } from "@/lib/auth/actor";
import { deriveScope } from "@/lib/events/derive";
import { buildLookup } from "@/lib/events/lookup";
import { listAll } from "@/lib/events/store";
import { buildFilingState } from "@/lib/filing/state";
import { buildGraph, resolveRef } from "@/lib/graph/graph";
import { parseRef } from "@/lib/graph/refs";
import { loadPacket } from "@/lib/packet/load";
import { getClock } from "@/lib/time/server";

/**
 * Which lines each examined item is about.
 *
 * Reading a notice and deciding what it is asking about is a person's judgment,
 * and in a finished system this mapping would be recorded as their act. What is
 * automated is everything after it: once the lines are named, the record
 * assembles itself from the evidence, the work and the filing.
 */
const NOTICE_ITEM_LINES: Record<string, string[][]> = {
  "N-2025-L566": [
    ["SchA.12", "F8283.A1.stock", "F8283.A1.vehicle"],
    ["SchC.1"],
  ],
};

/**
 * A record that answers a notice on its own.
 *
 * Self-contained is the requirement, so this is assembled to be read away from
 * the system: every figure comes with the document it came from, the page, the
 * field, what was printed there, who verified it and how, what was asked of the
 * client and what they answered, who signed, and what the firm's own checks said
 * about it — including where they disagreed with the return.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "N-2025-L566";
  const packet = loadPacket();
  const graph = buildGraph(packet, await getClock());

  const notices = packet.tax_agency_records.notices as {
    id: string;
    agency: string;
    type: string;
    tax_year: number;
    dated: string;
    response_due?: string;
    document?: string;
    summary?: string;
    items_under_examination?: string[];
  }[];
  const notice = notices.find((n) => n.id === id);
  if (!notice) return NextResponse.json({ error: `No notice ${id}` }, { status: 404 });

  const events = listAll(10_000);
  const names = new Map([
    ...packet.firm.staff.map((s) => [s.id, s.name] as const),
    ...packet.firm.client_users.map((c) => [c.id, c.name] as const),
  ]);
  const lookup = buildLookup(packet, events);
  const actors = actorIndex(packet);

  const ledger = buildLedger(events, (n) => names.get(n) ?? n);
  const filing = buildFilingState(events, (n) => names.get(n) ?? n);
  const result = recompute(graph, appliedAdjustments(ledger), buildFormIndex(graph));
  const findings = allFindings(runChecks(graph, new Set()));

  /**
   * Findings the file has already answered.
   *
   * A record handed to an examiner has to say which of our own objections we
   * acted on. Showing a corrected finding as though it still stood would be as
   * misleading as hiding it.
   */
  const applied = appliedAdjustments(ledger);
  const addressed = new Set(
    findings
      .filter((f) =>
        f.suggestedAdjustment
          ? applied.some(
              (a) =>
                a.lineKey === f.suggestedAdjustment!.lineKey && a.to === f.suggestedAdjustment!.to,
            )
          : false,
      )
      .map((f) => f.id),
  );

  const itemLines = NOTICE_ITEM_LINES[id] ?? [];

  const items = (notice.items_under_examination ?? []).map((text, index) => {
    const keys = (itemLines[index] ?? []).filter((k) => graph.lineByKey.has(k));

    const lines = keys.map((key) => {
      const line = graph.lineByKey.get(key)!;
      const adjusted = result.lines.get(key);
      const filedValue = filing.filings[0]?.snapshot[key];
      const scope = deriveScope(graph, { kind: "line", id: key }, actors);

      /** Each source opened out: the page, the field, and what was printed there. */
      const evidence = line.sources.map((ref) => {
        const resolved = resolveRef(graph, ref, lookup);
        const parsed = parseRef(ref);
        if (parsed.kind !== "extracted_value" || !parsed.id) {
          return { ref, title: resolved.title, detail: resolved.subtitle };
        }
        const ev = graph.evById.get(parsed.id)!;
        const doc = graph.docById.get(ev.document_id);
        const page = doc?.pages.find((p) => p.page === ev.page);
        return {
          ref,
          title: resolved.title,
          detail: resolved.subtitle,
          document: { id: ev.document_id, title: doc?.title, issuer: doc?.issuer, fileName: doc?.file_name },
          page: ev.page,
          field: ev.field,
          value: ev.value,
          confidence: ev.confidence,
          printed: page?.printed_content,
        };
      });

      return {
        key,
        form: line.form,
        line: line.line,
        label: line.label,
        rule: line.rule,
        ruleText: graph.rules[line.rule],
        valueAsFiled: filedValue ?? (adjusted ? adjusted.value : line.value),
        valueNow: adjusted ? adjusted.value : line.value,
        evidence,
        /** The evidence a person attached, which the engine never saw. */
        addedInReview: scope.citations.map((c) => {
          const resolved = resolveRef(graph, c.ref, lookup);
          return { ref: c.ref, title: resolved.title, detail: resolved.subtitle, by: c.actor?.name, at: c.at, note: c.note };
        }),
        verifications: scope.verifications.map((v) => ({
          type: v.verificationType,
          by: v.actor?.name,
          at: v.at,
          note: v.note,
        })),
        questions: scope.questions.map((q) => ({
          question: q.text,
          askedOf: q.toName,
          askedBy: q.askedBy?.name,
          answer: q.answer?.text,
          answeredBy: q.answer?.said,
          channel: q.answer?.channel,
        })),
        signoffs: scope.signoffs.map((s) => ({ level: s.level, by: s.actor?.name, at: s.at, valid: s.valid })),
        adjustments: ledger
          .filter((e) => e.lineKey === key)
          .map((e) => ({ from: e.from, to: e.to, reason: e.reason, by: e.actorName, at: e.at, approvedBy: e.approvedBy })),
        /** What the firm's own checks said, including where they disagreed. */
        findings: findings
          .filter((f) => f.scope?.kind === "line" && f.scope.id === key)
          .map((f) => ({
            id: f.id,
            severity: f.severity,
            title: f.title,
            detail: f.detail,
            addressed: addressed.has(f.id),
          })),
      };
    });

    return { item: index + 1, text, lines };
  });

  return NextResponse.json({
    notice,
    noticeDocument: notice.document ? graph.docById.get(notice.document) : undefined,
    preparedAt: new Date().toISOString(),
    household: {
      people: packet.household.people.map((p) => ({ name: p.name, role: p.role })),
      filingStatus: packet.household.filing_status,
      taxYear: packet.household.tax_year,
    },
    firm: { name: packet.firm.name, ...(packet.firm.firm_identity as Record<string, unknown>) },
    filing: filing.filings.map((f) => ({
      jurisdiction: f.jurisdiction,
      submissionId: f.submissionId,
      acceptedAt: f.acceptedAt,
      filedBy: f.filedBy,
      contentHash: f.contentHash,
    })),
    efile: packet.tax_agency_records.efile,
    items,
  });
}
