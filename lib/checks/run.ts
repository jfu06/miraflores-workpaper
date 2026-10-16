import type { FactGraph } from "../graph/graph";
import { buildVarianceReport } from "../view/variance";
import {
  detailSummaryTieOut,
  documentConflict,
  lowConfidence,
  supersededStillUsed,
  unreadPages,
  valueNotOnPage,
} from "./evidence";
import {
  agencyReconciliation,
  hedgedClientAssertion,
  questionnaireConflict,
  unexplainedVariance,
} from "./reconciliation";
import {
  basisGap,
  incompleteInputs,
  nonStandardReference,
  parameterYear,
  staleDiagnostic,
  stateSourcing,
} from "./integrity";
import type { Check, CheckResult, Finding, Severity } from "./types";

/**
 * The suite, in the order a reviewer would want to meet it: can the evidence be
 * trusted, does it agree with other records, is anything missing, does the file
 * hang together.
 */
export const CHECKS: Check[] = [
  valueNotOnPage,
  lowConfidence,
  documentConflict,
  supersededStillUsed,
  detailSummaryTieOut,
  unreadPages,
  agencyReconciliation,
  questionnaireConflict,
  hedgedClientAssertion,
  unexplainedVariance,
  parameterYear,
  nonStandardReference,
  stateSourcing,
  staleDiagnostic,
  basisGap,
  incompleteInputs,
];

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function runChecks(graph: FactGraph, explainedKeys: Set<string>): CheckResult[] {
  const variance = buildVarianceReport(graph);
  const ctx = { graph, variance, explainedKeys };

  return CHECKS.map((check) => {
    const { run, ...definition } = check;
    const findings = run(ctx).sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (b.amount ?? 0) - (a.amount ?? 0),
    );
    return { check: definition, findings };
  });
}

export function allFindings(results: CheckResult[]): Finding[] {
  return results
    .flatMap((r) => r.findings)
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (b.amount ?? 0) - (a.amount ?? 0),
    );
}
