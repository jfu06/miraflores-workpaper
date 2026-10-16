import type { FactGraph } from "../graph/graph";
import { contentHash, type CoveredFacts } from "./hash";
import {
  listForScope,
  type Scope,
  type WorkpaperEvent,
} from "./index";
import type {
  NotePayload,
  ReviewLevel,
  ReviewNotePayload,
  ReviewNoteResolvedPayload,
  RevertPayload,
  SignoffPayload,
  VerificationPayload,
} from "./types";

export interface ActorInfo {
  id: string;
  name: string;
  role: string;
  sensitiveDataClearance: boolean;
}

export interface VerificationView {
  eventId: string;
  at: string;
  actor: ActorInfo | null;
  verificationType: string;
  note?: string;
}

export interface NoteView {
  eventId: string;
  at: string;
  actor: ActorInfo | null;
  text: string;
}

export interface ReviewNoteView extends NoteView {
  blocking: boolean;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: ActorInfo | null;
}

export interface FactsDiff {
  changedLines: { key: string; from: string | number; to: string | number }[];
  changedValues: { id: string; from: string | number | boolean; to: string | number | boolean }[];
  addedLines: string[];
  removedLines: string[];
  workChanged: boolean;
}

export interface SignoffView {
  eventId: string;
  at: string;
  actor: ActorInfo | null;
  level: ReviewLevel;
  signedHash: string;
  /** False when the content has changed since signing; the sign-off has reopened. */
  valid: boolean;
  /** What moved, when the sign-off is no longer valid. */
  diff?: FactsDiff;
}

export interface DerivedScope {
  scope: Scope;
  /** Every event, reverted ones included, for the history view. */
  history: WorkpaperEvent[];
  /** Events still in force. */
  live: WorkpaperEvent[];
  revertedIds: string[];
  verifications: VerificationView[];
  notes: NoteView[];
  reviewNotes: ReviewNoteView[];
  openBlockingCount: number;
  signoffs: SignoffView[];
  /** The hash the scope would be signed with right now. */
  currentHash: string;
  coveredFacts: CoveredFacts;
  /** True while an unresolved blocking review note stands. */
  blocked: boolean;
}

function diffFacts(signed: CoveredFacts, current: CoveredFacts, workChanged: boolean): FactsDiff {
  const signedLines = new Map(signed.lines.map((l) => [l.key, l.value]));
  const currentLines = new Map(current.lines.map((l) => [l.key, l.value]));
  const signedValues = new Map(signed.values.map((v) => [v.id, v.value]));
  const currentValues = new Map(current.values.map((v) => [v.id, v.value]));

  const changedLines: FactsDiff["changedLines"] = [];
  for (const [key, from] of signedLines) {
    const to = currentLines.get(key);
    if (to !== undefined && to !== from) changedLines.push({ key, from, to });
  }

  const changedValues: FactsDiff["changedValues"] = [];
  for (const [id, from] of signedValues) {
    const to = currentValues.get(id);
    if (to !== undefined && to !== from) changedValues.push({ id, from, to });
  }

  return {
    changedLines,
    changedValues,
    addedLines: [...currentLines.keys()].filter((k) => !signedLines.has(k)),
    removedLines: [...signedLines.keys()].filter((k) => !currentLines.has(k)),
    workChanged,
  };
}

/**
 * Fold a scope's events into its current state.
 *
 * Reverting is itself an event, so the fold first collects what has been
 * withdrawn and then replays only what still stands. Both the revert and the
 * event it undid stay in `history`.
 */
export function deriveScope(
  graph: FactGraph,
  scope: Scope,
  actors: Map<string, ActorInfo>,
): DerivedScope {
  const history = listForScope(scope);

  const revertedIds = new Set<string>();
  for (const event of history) {
    if (event.type === "revert") {
      revertedIds.add((event.payload as RevertPayload).targetEventId);
      revertedIds.add(event.id);
    }
  }

  const live = history.filter((e) => !revertedIds.has(e.id));
  const actorOf = (id: string) => actors.get(id) ?? null;

  const verifications: VerificationView[] = [];
  const notes: NoteView[] = [];
  const reviewNotes: ReviewNoteView[] = [];
  const resolutions = new Map<string, WorkpaperEvent>();

  for (const event of live) {
    switch (event.type) {
      case "verification": {
        const p = event.payload as VerificationPayload;
        verifications.push({
          eventId: event.id,
          at: event.at,
          actor: actorOf(event.actorId),
          verificationType: p.verificationType,
          note: p.note,
        });
        break;
      }
      case "note": {
        const p = event.payload as NotePayload;
        notes.push({ eventId: event.id, at: event.at, actor: actorOf(event.actorId), text: p.text });
        break;
      }
      case "review_note": {
        const p = event.payload as ReviewNotePayload;
        reviewNotes.push({
          eventId: event.id,
          at: event.at,
          actor: actorOf(event.actorId),
          text: p.text,
          blocking: p.blocking,
          resolved: false,
        });
        break;
      }
      case "review_note_resolved": {
        const p = event.payload as ReviewNoteResolvedPayload;
        resolutions.set(p.targetEventId, event);
        break;
      }
      default:
        break;
    }
  }

  for (const note of reviewNotes) {
    const resolution = resolutions.get(note.eventId);
    if (resolution) {
      note.resolved = true;
      note.resolvedAt = resolution.at;
      note.resolvedBy = actorOf(resolution.actorId);
    }
  }

  const { hash: currentHash, facts, workEventIds } = contentHash(graph, scope, live);

  const signoffs: SignoffView[] = live
    .filter((e) => e.type === "signoff")
    .map((event) => {
      const p = event.payload as SignoffPayload;
      const valid = p.contentHash === currentHash;
      const workChanged =
        p.workEventIds.join(",") !== workEventIds.join(",");
      return {
        eventId: event.id,
        at: event.at,
        actor: actorOf(event.actorId),
        level: p.level,
        signedHash: p.contentHash,
        valid,
        diff: valid ? undefined : diffFacts(p.facts, facts, workChanged),
      };
    });

  const openBlockingCount = reviewNotes.filter((n) => n.blocking && !n.resolved).length;

  return {
    scope,
    history,
    live,
    revertedIds: [...revertedIds],
    verifications,
    notes,
    reviewNotes,
    openBlockingCount,
    signoffs,
    currentHash,
    coveredFacts: facts,
    blocked: openBlockingCount > 0,
  };
}

export interface SignoffCheck {
  ok: boolean;
  reason?: string;
}

/**
 * The firm's standards, enforced rather than displayed.
 *
 * From `firm.starter_standards.rules` and `review_levels`. The independence rule
 * is read as it is meant: a preparer signs their own preparation, but may not be
 * the reviewer or partner on it.
 */
export function canSignOff(
  derived: DerivedScope,
  actor: ActorInfo,
  level: ReviewLevel,
): SignoffCheck {
  if (actor.role !== level) {
    return {
      ok: false,
      reason: `${actor.name} is a ${actor.role.replace(/_/g, " ")} and cannot sign at ${level} level.`,
    };
  }

  if (level !== "preparer") {
    const prepared = derived.verifications.some((v) => v.actor?.id === actor.id);
    if (prepared) {
      return {
        ok: false,
        reason: `${actor.name} verified work on this item and may not also review or sign off on it.`,
      };
    }
  }

  const order: ReviewLevel[] = ["preparer", "reviewer", "partner"];
  const index = order.indexOf(level);
  if (index > 0) {
    const previous = order[index - 1];
    const has = derived.signoffs.some((s) => s.level === previous && s.valid);
    if (!has) {
      return { ok: false, reason: `${previous} sign-off must be in place first.` };
    }
  }

  if (derived.signoffs.some((s) => s.level === level && s.valid)) {
    return { ok: false, reason: `Already signed at ${level} level.` };
  }

  if (derived.blocked) {
    return {
      ok: false,
      reason: `${derived.openBlockingCount} open blocking review note${
        derived.openBlockingCount === 1 ? "" : "s"
      } on this item.`,
    };
  }

  return { ok: true };
}
