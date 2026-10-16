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
