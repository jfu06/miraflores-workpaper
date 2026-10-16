/**
 * The event layer.
 *
 * The packet is immutable pipeline output. Everything a person does to it is an
 * event, appended and never changed. That single decision covers four separate
 * things the workpaper has to do: keep the original when something is adjusted,
 * show what changed since you last looked, undo in bulk, and freeze at filing
 * with amendments layered on top. None of them needs its own mechanism.
 *
 * Undo is therefore not a delete. Reverting appends a `revert` event naming the
 * event it undoes, and the fold ignores both. The record of the mistake survives,
 * which is the point: an examiner years later can see what was done and withdrawn.
 */

/** From `firm.starter_standards.verification_types`. */
export const VERIFICATION_TYPES = [
  "agreed_to_source_document",
  "recalculated",
  "confirmed_with_client",
  "agreed_to_prior_year",
  "agreed_to_third_party_record",
] as const;
export type VerificationType = (typeof VERIFICATION_TYPES)[number];

/** From `firm.starter_standards.review_levels`. */
export const REVIEW_LEVELS = ["preparer", "reviewer", "partner"] as const;
export type ReviewLevel = (typeof REVIEW_LEVELS)[number];

export type EventType =
  | "filing"
  | "amendment_opened"
  | "question"
  | "answer"
  | "cite"
  | "adjustment"
  | "adjustment_approved"
  | "finding_dismissed"
  | "required_step"
  | "verification"
  | "note"
  | "review_note"
  | "review_note_resolved"
  | "signoff"
  | "revert"
  | "sensitive_view"
  | "variance_explained";

export type ScopeKind =
  | "line"
  | "document"
  | "extracted_value"
  | "return"
  /** A check finding, addressed by its stable id, so a dismissal survives a rerun. */
  | "finding"
  /** One of the firm's required steps, addressed by its text. */
  | "step";

export interface Scope {
  kind: ScopeKind;
  id: string;
}

export interface VerificationPayload {
  verificationType: VerificationType;
  note?: string;
}

export interface NotePayload {
  text: string;
}

export interface ReviewNotePayload {
  text: string;
  /** A blocking note stops filing until it is resolved. */
  blocking: boolean;
}

export interface ReviewNoteResolvedPayload {
  targetEventId: string;
  text?: string;
}

export interface SignoffPayload {
  level: ReviewLevel;
  /**
   * What was signed, as a hash of the facts and work in scope at the moment of
   * signing. A sign-off whose recomputed hash no longer matches has been
   * invalidated by a later change and is shown as reopened.
   */
  contentHash: string;
  /**
   * The covered facts as they stood at signing.
   *
   * Stored, not just hashed, so an invalidated sign-off can name the lines and
   * values that moved rather than only reporting that something did. This is also
   * what answers "what changed since I last looked".
   */
  facts: import("./hash").CoveredFacts;
  workEventIds: string[];
}

export interface RevertPayload {
  targetEventId: string;
  reason?: string;
}

/**
 * "Prior-year variances explained" is one of the firm's twelve required steps, so
 * the explanation is a recorded act with an author and a time, not a comment.
 */
export interface VarianceExplainedPayload {
  text: string;
}

/**
 * The return as transmitted.
 *
 * Carries a snapshot of every line rather than a pointer to "the current
 * version", because the whole purpose is to survive everything that happens
 * afterwards — including amendments, and including an examination two years on.
 */
export interface FilingPayload {
  jurisdiction: string;
  submissionId: string;
  acceptedAt: string;
  snapshot: Record<string, number | string>;
  adjustmentEventIds: string[];
  contentHash: string;
}

export interface AmendmentPayload {
  reason: string;
}

/**
 * A question put to the client or a colleague.
 *
 * Raised against the thing it is about — a line, a document, a finding — so it
 * travels with that item rather than living in an inbox beside it.
 */
export interface QuestionPayload {
  /** "client", or a staff id. */
  to: string;
  text: string;
  /** Set when the question was raised from a check finding. */
  findingId?: string;
}

/**
 * The answer, which is evidence.
 *
 * Carries how it arrived, because "the client confirmed by phone" and "the client
 * uploaded a statement" are not the same assurance, and the difference is exactly
 * what a reviewer is judging.
 */
export interface AnswerPayload {
  targetEventId: string;
  text: string;
  /** How the answer reached the firm. */
  channel: "portal" | "phone" | "email" | "document";
  /** Who said it, when the answer was recorded by someone else on their behalf. */
  onBehalfOf?: string;
}

/**
 * Attaching a reference to a line as evidence.
 *
 * Kept separate from the engine's own sources. A number's pipeline evidence and
 * the evidence a person added during review are both evidence, but conflating
 * them would hide which part of the support the engine never saw.
 */
export interface CitePayload {
  ref: string;
  note?: string;
}

/**
 * A change to a figure, with the original kept beside it.
 *
 * The effect is computed on the server and stored, not supplied by the caller:
 * the firm's threshold for partner sign-off is stated in money, so the figure
 * that decides whether a partner is required cannot be the client's to assert.
 */
export interface AdjustmentPayload {
  from: number;
  to: number;
  reason: string;
  category: string;
  effect: {
    federal: number;
    california: number;
    basis: "rate" | "direct";
    federalRate?: number;
    californiaRate?: number;
    caveats: string[];
  };
  /** True when the firm's 1,000 threshold is crossed in either jurisdiction. */
  requiresPartner: boolean;
}

export interface AdjustmentApprovedPayload {
  targetEventId: string;
  note?: string;
}

/**
 * Dismissing a finding does not delete it.
 *
 * The check still runs and still reports; the dismissal records that someone
 * looked and decided, with a reason. A finding nobody can argue with is a finding
 * nobody read.
 */
export interface FindingDismissedPayload {
  reason: string;
}

export interface RequiredStepPayload {
  step: string;
  note?: string;
}

export interface SensitiveViewPayload {
  /** The reference whose masked value was revealed. */
  ref: string;
  field: string;
}

export type EventPayload =
  | VerificationPayload
  | NotePayload
  | ReviewNotePayload
  | ReviewNoteResolvedPayload
  | SignoffPayload
  | RevertPayload
  | SensitiveViewPayload
  | VarianceExplainedPayload
  | FindingDismissedPayload
  | RequiredStepPayload
  | AdjustmentPayload
  | AdjustmentApprovedPayload
  | QuestionPayload
  | AnswerPayload
  | CitePayload
  | FilingPayload
  | AmendmentPayload;

export interface WorkpaperEvent<P = EventPayload> {
  /** Monotonic insertion order; the authoritative sequence. */
  seq: number;
  id: string;
  at: string;
  actorId: string;
  type: EventType;
  scope: Scope;
  payload: P;
  /** Groups events applied as one bulk action, so they revert together. */
  groupId?: string;
}

export interface AppendEvent<P = EventPayload> {
  actorId: string;
  type: EventType;
  scope: Scope;
  payload: P;
  groupId?: string;
}

export function scopeKey(scope: Scope): string {
  return `${scope.kind}:${scope.id}`;
}
