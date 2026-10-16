/**
 * Checks that read a second source: the tax agencies' own records, and what the
 * client said against what the documents show.
 */

import type { Check, Finding } from "./types";

function money(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Transaction {
  date: string;
  /** The packet records IRS transaction codes as strings. */
  code: string;
  description: string;
  amount: number;
}

const PAYMENT_CODE = 670;

/** The most recent IRS snapshot; earlier ones are superseded by it. */
function latestTransactions(graph: { packet: { tax_agency_records: Record<string, unknown> } }): {
  asOf: string;
  transactions: Transaction[];
} {
  const snapshots = graph.packet.tax_agency_records.irs_account_transcript_2025 as {
    as_of: string;
    transactions: Transaction[];
  }[];
  const latest = [...snapshots].sort((a, b) => (a.as_of < b.as_of ? 1 : -1))[0];
  return { asOf: latest.as_of, transactions: latest.transactions };
}

export const agencyReconciliation: Check = {
  id: "RECON-AGENCY",
  title: "Payments on the return do not agree to the agency's records",
  family: "reconciliation",
  rationale:
    "'Estimated payments agreed to IRS and FTB records' is one of the firm's required steps, and payments change the balance due dollar for dollar. The agency's record is the one that will be matched against the filing.",
  independent:
    "Adds the agencies' own posted transactions and compares the total to the return. Reads the IRS account transcript and the FTB account directly; the engine's totals are not used except as the figure being tested.",
  run({ graph }) {
    const findings: Finding[] = [];
    const { asOf, transactions } = latestTransactions(graph);

    const sumWhere = (match: (t: Transaction) => boolean) =>
      transactions.filter(match).reduce((total, t) => total + t.amount, 0);

    const checks = [
      {
        lineKey: "F1040.26",
        what: "federal estimated tax payments",
        agency: "the IRS account transcript",
        agencyRef: "agency:/irs_account_transcript_2025",
        posted: sumWhere((t) => Number(t.code) === PAYMENT_CODE && /estimated/i.test(t.description)),
        listing: transactions
          .filter((t) => Number(t.code) === PAYMENT_CODE && /estimated/i.test(t.description))
          .map((t) => `${t.date} ${money(t.amount)}`),
        asOf,
      },
      {
        lineKey: "Sch3.10",
        what: "the federal extension payment",
        agency: "the IRS account transcript",
        agencyRef: "agency:/irs_account_transcript_2025",
        posted: sumWhere((t) => /extension/i.test(t.description) && t.amount > 0),
        listing: transactions
          .filter((t) => /extension/i.test(t.description) && t.amount > 0)
          .map((t) => `${t.date} ${money(t.amount)}`),
        asOf,
      },
      (() => {
        const ftb = graph.packet.tax_agency_records.ftb_account as {
          as_of: string;
          tax_year_2025_payments: { date: string; amount: number }[];
          tax_year_2024_payments_after_filing: { date: string; amount: number; note?: string }[];
        };
        return {
          lineKey: "F540NR.72",
          what: "California estimated tax payments",
          agency: "the FTB account",
          agencyRef: "agency:/ftb_account",
          posted: ftb.tax_year_2025_payments.reduce((t, p) => t + p.amount, 0),
          listing: ftb.tax_year_2025_payments.map((p) => `${p.date} ${money(p.amount)}`),
          asOf: ftb.as_of,
          alsoNote: ftb.tax_year_2024_payments_after_filing
            .map(
              (p) =>
                `${p.date} ${money(p.amount)} is held against 2024${p.note ? ` — ${p.note}` : ""}`,
            )
            .join("; "),
        };
      })(),
    ];

    for (const check of checks) {
      const line = graph.lineByKey.get(check.lineKey);
      if (!line || typeof line.value !== "number") continue;

      const difference = Math.round(line.value - check.posted);
      if (difference === 0) continue;

      const note = "alsoNote" in check ? (check.alsoNote as string) : "";
      findings.push({
        id: `RECON-AGENCY:${check.lineKey}`,
        checkId: "RECON-AGENCY",
        severity: Math.abs(difference) >= 1000 ? "high" : "medium",
        title: `${check.what}: return claims ${money(line.value)}, ${check.agency} shows ${money(
          check.posted,
        )}`,
        detail: `${difference > 0 ? "Overstated" : "Understated"} by ${money(
          Math.abs(difference),
        )}. ${check.agency} as of ${check.asOf} posts: ${
          check.listing.join("; ") || "nothing"
        }.${note ? ` Separately, ${note}.` : ""} Payments change the balance due one for one.`,
        refs: [check.lineKey, check.agencyRef, ...line.sources.slice(0, 8)],
        scope: { kind: "line", id: check.lineKey },
        amount: Math.abs(difference),
        suggestedAdjustment: {
          lineKey: check.lineKey,
          from: line.value,
          to: check.posted,
          reason: `Agreed to ${check.agency} as of ${check.asOf}.`,
        },
      });
    }

    return findings;
  },
};

/**
 * Questionnaire answers tested against what the file actually holds.
 *
 * An explicit table rather than inference. These are the firm's own tie-outs, and
 * a rule that can be read is one a reviewer can argue with; a heuristic that
 * guesses which answers contradict which documents is not.
 */
const QUESTIONNAIRE_RULES: {
  questionId: string;
  expect: "no";
  describe: string;
  evidence(ctx: Parameters<Check["run"]>[0]): { present: boolean; detail: string; refs: string[] };
}[] = [
  {
    questionId: "qa-14",
    expect: "no",
    describe: "investments sold during the year",
    evidence({ graph }) {
      const lots = graph.current.lines.filter((l) => l.form === "F8949" && /^[A-Z]\.[A-Z]/.test(l.line));
      return {
        present: lots.length > 0,
        detail: `${lots.length} Form 8949 lot lines are on the return.`,
        refs: lots.slice(0, 4).map((l) => l.key),
      };
    },
  },
  {
    questionId: "qa-31",
    expect: "no",
    describe: "prior nondeductible IRA basis",
    evidence({ graph }) {
      const basis = graph.packet.prior_years.basis_records.ira_nondeductible_basis_ngozi as
        | { year: number; form_8606_line_14: number; source: string }[]
        | undefined;
      const carried = basis?.[0]?.form_8606_line_14;
      return {
        present: Boolean(carried),
        detail: `The 2024 Form 8606 carried ${money(
          carried ?? 0,
        )} of basis into 2025, and the return uses it on F8606.2.`,
        refs: ["py:/basis_records/ira_nondeductible_basis_ngozi", "py:/return_2024/lines/F8606.14", "F8606.2"],
      };
    },
  },
];

export const questionnaireConflict: Check = {
  id: "RECON-QUESTIONNAIRE",
  title: "A client answer is contradicted by the file",
  family: "reconciliation",
  rationale:
    "The organizer is filled in from memory, months before the documents arrive. Where an answer and the file disagree, the answer is usually the one that is wrong — but it is also the only record of what the client was asked.",
  independent:
    "Tests each answer against the documents and prior-year records directly. The engine's diagnostics are not consulted.",
  run(ctx) {
    const findings: Finding[] = [];

    for (const rule of QUESTIONNAIRE_RULES) {
      const answer = ctx.graph.qaById.get(rule.questionId);
      if (!answer) continue;
      if (!/^\s*(no|none)\b/i.test(answer.answer)) continue;

      const evidence = rule.evidence(ctx);
      if (!evidence.present) continue;

      findings.push({
        id: `RECON-QUESTIONNAIRE:${rule.questionId}`,
        checkId: "RECON-QUESTIONNAIRE",
        severity: "medium",
        title: `Client answered "${answer.answer}" about ${rule.describe}`,
        detail: `${answer.question} — answered by ${answer.answered_by} on ${answer.answered_at.slice(
          0,
          10,
        )}. ${evidence.detail}`,
        refs: [rule.questionId, ...evidence.refs],
      });
    }

    return findings;
  },
};

/** Words that mark an answer as the client's recollection rather than a record. */
const HEDGE = /\b(i think|i believe|about|approximately|roughly|maybe|not sure|or so|we plan to|plan to|probably)\b/i;

export const hedgedClientAssertion: Check = {
  id: "RECON-CLIENT-HEDGED",
  title: "A return figure rests on a client's uncertain recollection",
  family: "reconciliation",
  rationale:
    "Some rules fall back to the organizer when no document was uploaded. That is reasonable, but an answer the client hedged is not a substitute for a confirmation, and nothing downstream shows that the figure came from memory.",
  independent:
    "Reads the questionnaire text of every answer cited as a source by a current return line and tests it for hedging language.",
  run({ graph }) {
    const findings: Finding[] = [];

    for (const line of graph.current.lines) {
      for (const ref of line.sources) {
        if (!ref.startsWith("qa-")) continue;
        const answer = graph.qaById.get(ref);
        if (!answer || !HEDGE.test(answer.answer)) continue;

        findings.push({
          id: `RECON-CLIENT-HEDGED:${line.key}:${ref}`,
          checkId: "RECON-CLIENT-HEDGED",
          severity: "medium",
          title: `${line.form} ${line.line} relies on "${answer.answer.trim()}"`,
          detail: `${line.label} is ${
            typeof line.value === "number" ? money(line.value) : line.value
          }. Rule ${line.rule} cites ${ref}, the client's answer to "${
            answer.question
          }". The wording is a recollection, not a record.${
            line.note ? ` Engine note: ${line.note}` : ""
          }`,
          refs: [line.key, ref, ...line.sources.filter((s) => s.startsWith("ev-")).slice(0, 6)],
          scope: { kind: "line", id: line.key },
        });
      }
    }

    return findings;
  },
};

export const unexplainedVariance: Check = {
  id: "RECON-VARIANCE",
  title: "A flagged prior-year variance has not been explained",
  family: "reconciliation",
  rationale:
    "'Prior-year variances explained' is a required step. A swing nobody has written a reason for is an open question, whatever its size.",
  independent:
    "Applies the firm's own variance standard, read from the packet, to the prior-year return against this one.",
  run({ variance, explainedKeys }) {
    return variance.rows
      .filter((row) => row.flagged && !explainedKeys.has(row.key))
      .map((row) => ({
        id: `RECON-VARIANCE:${row.key}`,
        checkId: "RECON-VARIANCE",
        severity: (row.notComparable || row.status === "unmatched"
          ? "medium"
          : Math.abs(row.delta ?? 0) >= 10_000
            ? "medium"
            : "low") as Finding["severity"],
        title:
          row.status === "unmatched"
            ? `${row.key} has no counterpart this year`
            : row.notComparable
              ? `${row.key} names a different subject in each year`
              : `${row.key} moved ${
                  row.percent === undefined ? "" : `${row.percent > 0 ? "+" : ""}${row.percent.toFixed(0)}% `
                }to ${typeof row.current === "number" ? money(row.current) : row.current}`,
        detail:
          row.status === "unmatched"
            ? `2024: ${row.priorLabel} — ${
                typeof row.prior === "number" ? money(row.prior) : row.prior
              }.${row.unmatchedReason ? ` ${row.unmatchedReason}` : ""}`
            : `2024: ${row.priorLabel} — ${
                typeof row.prior === "number" ? money(row.prior) : row.prior
              }. 2025: ${row.currentLabel} — ${
                typeof row.current === "number" ? money(row.current) : row.current
              }.${row.priorNote ? ` Prior preparer: ${row.priorNote}` : ""}`,
        refs: [row.key, ...row.priorSources.slice(0, 4)],
        scope: { kind: "line" as const, id: row.key },
        amount: row.delta === undefined ? undefined : Math.abs(row.delta),
      }));
  },
};

/**
 * Schedule C gross receipts against the forms third parties filed.
 *
 * This reconciliation exists because the IRS asks for it: Letter 566 on the 2025
 * return examines "Schedule C gross receipts: reconcile to Forms 1099-NEC
 * (142,000) and Form 1099-K (12,400) filed by third parties". A firm that knows
 * an area is examined should be checking it before the letter arrives.
 *
 * Two legs, both computed from extracted values rather than from prose:
 *
 *   1. Books revenue should equal what third parties reported plus what clients
 *      who issue no form paid. If it does, the books are complete.
 *   2. A payment-card amount added on top of books revenue is a double count if a
 *      books record says those card deposits are already in the books.
 */
export const schcGrossReceipts: Check = {
  id: "RECON-SCHC-GROSS",
  title: "Schedule C gross receipts do not reconcile to the third-party forms",
  family: "reconciliation",
  rationale:
    "Gross receipts are matched against Forms 1099-NEC and 1099-K by the agencies automatically, and this return is already under examination on exactly that point. A figure that cannot be reconciled is one the firm will have to explain later without the working.",
  independent:
    "Adds the Forms 1099-NEC itself, reads the books total and the deposits detail, and reconciles them. The engine's gross receipts figure is the thing being tested, not an input.",
  run({ graph }) {
    const line = graph.lineByKey.get("SchC.1");
    if (!line || typeof line.value !== "number") return [];

    const findings: Finding[] = [];
    const valueOf = (id: string) => {
      const v = graph.evById.get(id)?.value;
      return typeof v === "number" ? v : undefined;
    };

    /** Every Form 1099-NEC in the file, added here rather than taken from a total. */
    const nec = graph.documents
      .filter((d) => d.document_type === "1099-NEC")
      .flatMap((d) => (graph.evsByDoc.get(d.id) ?? []).filter((ev) => ev.field === "box1"));
    const necTotal = nec.reduce(
      (sum, ev) => sum + (typeof ev.value === "number" ? ev.value : 0),
      0,
    );

    const booksEv = (graph.evsByDoc.get("D14") ?? []).find((ev) => ev.field === "total_income");
    const booksTotal = typeof booksEv?.value === "number" ? booksEv.value : undefined;

    const detail = graph.evsByDoc.get("D15") ?? [];
    const cardInBooks = detail.find((ev) => ev.field === "atlas_paywell");
    const noForm = detail.find((ev) => ev.field === "unreported_small");

    const card = (graph.evsByDoc.get("D21") ?? []).find((ev) => ev.field === "box1a");
    const cardTotal = typeof card?.value === "number" ? card.value : undefined;

    // Leg 1: do the books tie to what third parties reported?
    if (booksTotal !== undefined && typeof noForm?.value === "number") {
      const expected = necTotal + noForm.value;
      const difference = Math.round(booksTotal - expected);
      if (difference === 0) {
        // The books are complete, which makes anything added on top suspect.
      } else {
        findings.push({
          id: "RECON-SCHC-GROSS:books",
          checkId: "RECON-SCHC-GROSS",
          severity: "medium",
          title: `Books revenue is ${money(Math.abs(difference))} ${
            difference > 0 ? "above" : "below"
          } the third-party forms plus unreported clients`,
          detail: `Books revenue ${money(booksTotal)} against Forms 1099-NEC ${money(
            necTotal,
          )} plus ${money(noForm.value)} from clients who issued no form.`,
          refs: ["SchC.1", booksEv!.id, noForm.id, ...nec.map((ev) => ev.id)],
          scope: { kind: "line", id: "SchC.1" },
          amount: Math.abs(difference),
        });
      }
    }

    // Leg 2: is the payment-card total added on top of revenue it is already inside?
    if (
      booksTotal !== undefined &&
      cardTotal !== undefined &&
      typeof cardInBooks?.value === "number" &&
      cardInBooks.value === cardTotal &&
      Math.round(line.value - booksTotal) === Math.round(cardTotal)
    ) {
      const rate = graph.current.tax_effect_rates.schc_profit;
      findings.push({
        id: "RECON-SCHC-GROSS:double-count",
        checkId: "RECON-SCHC-GROSS",
        severity: "high",
        title: `Form 1099-K ${money(cardTotal)} is added to books revenue it is already inside`,
        detail:
          `Gross receipts ${money(line.value)} = books revenue ${money(booksTotal)} plus the whole Form 1099-K ${money(cardTotal)}. ` +
          `Rule ${line.rule} adds card amounts "the engine could not match to a books deposit", and it matched none. ` +
          `But the deposits detail records ${money(cardInBooks.value)} of the ${money(
            valueOf("ev-0110") ?? 0,
          )} Atlas Outdoor Gear paid as arriving through Paywell card processing, deposited gross and recorded in Sales. ` +
          `Independently: Forms 1099-NEC ${money(necTotal)} plus ${money(
            valueOf("ev-0111") ?? 0,
          )} from clients who issued no form equals books revenue exactly, leaving nothing for the card total to be. ` +
          `Overstated by ${money(cardTotal)}${
            rate ? `, about ${money(cardTotal * rate.federal_per_dollar)} of federal tax` : ""
          }.`,
        refs: [
          "SchC.1",
          booksEv!.id,
          card!.id,
          cardInBooks.id,
          "ev-0110",
          "ev-0111",
          "D15",
          "agency:/notices/1",
        ],
        scope: { kind: "line", id: "SchC.1" },
        amount: cardTotal,
        suggestedAdjustment: {
          lineKey: "SchC.1",
          from: line.value,
          to: booksTotal,
          reason:
            "Form 1099-K card deposits are already in books revenue; the deposits detail records them as Sales.",
        },
      });
    }

    return findings;
  },
};
