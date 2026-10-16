/**
 * The check suite.
 *
 * The brief asks for the errors found and how the design surfaced them. Those are
 * the same question: a finding here is the output of a check, not an observation
 * someone typed into a document. Every check states what it recomputes without
 * trusting the engine, and every finding carries references that resolve through
 * the same `resolveRef` the rest of the workpaper uses, so a finding is one click
 * from the evidence that produced it.
 *
 * Checks run against the packet alone. They do not read the event log, so a
 * finding cannot be made to disappear by working around it — it is dismissed
 * explicitly, as an event, with a reason and an author.
 */

import type { Scope } from "../events/types";
import type { FactGraph } from "../graph/graph";
import type { VarianceReport } from "../view/variance";

export type Severity = "high" | "medium" | "low";

export type CheckFamily =
  | "evidence"
  | "reconciliation"
  | "completeness"
  | "integrity";

export const FAMILY_LABEL: Record<CheckFamily, string> = {
  evidence: "Evidence",
  reconciliation: "Reconciliation",
  completeness: "Completeness",
  integrity: "Integrity",
};

export interface Finding {
  /**
   * Stable across runs, so a dismissal recorded today still applies tomorrow.
   * Formed as `<checkId>:<discriminator>`, where the discriminator identifies the
   * subject rather than its position in a list.
   */
  id: string;
  checkId: string;
  severity: Severity;
  title: string;
  detail: string;
  /** References into the packet; each resolves and is clickable. */
  refs: string[];
  /** Where review work on this finding attaches, usually the affected line. */
  scope?: Scope;
  /**
   * Dollars at stake, where arriving at the figure needs arithmetic rather than
   * tax judgment. Left unset when the amount would be an opinion.
   */
  amount?: number;
}

export interface CheckContext {
  graph: FactGraph;
  variance: VarianceReport;
  /** Line keys whose prior-year variance has been explained. */
  explainedKeys: Set<string>;
}

export interface Check {
  id: string;
  title: string;
  family: CheckFamily;
  /** Why this is worth checking at all. */
  rationale: string;
  /**
   * What the check recomputes or cross-reads for itself.
   *
   * The brief asks for checks that do not trust the engine, so each one says
   * plainly what it establishes independently and from which source.
   */
  independent: string;
  run(ctx: CheckContext): Finding[];
}

export interface CheckResult {
  check: Omit<Check, "run">;
  findings: Finding[];
}
