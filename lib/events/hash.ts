import { createHash } from "node:crypto";

import { parseRef } from "../graph/refs";
import type { FactGraph } from "../graph/graph";
import type { Scope, WorkpaperEvent } from "./types";

/**
 * What a sign-off covers.
 *
 * The brief asks for sign-offs that reopen when what was signed changes. Rather
 * than a state machine that has to be told about every kind of change, the
 * sign-off records a hash of what it covered, and anything that would alter that
 * hash reopens it automatically. A change nobody anticipated still invalidates
 * the signature, because the mechanism does not depend on anticipating it.
 *
 * Scope of the hash, and the judgment in it:
 *
 *   - **Facts, transitively.** A line's own value and rule, plus every line it is
 *     built from, all the way down, plus the extracted values underneath. Signing
 *     Form 1040 line 11 means signing the arithmetic beneath it, so a changed
 *     W-2 box reopens it.
 *
 *   - **Work, for this scope only.** The verifications and review notes on the
 *     signed line itself. Deliberately not transitive: a sign-off attests to this
 *     number and the work done on it. If a verification is withdrawn two lines
 *     upstream but no number moves, what was signed is still true. If a number
 *     does move, the fact half catches it.
 *
 * Notes that carry no assurance (plain notes, sensitive-view log entries) are
 * excluded, so commenting on a line does not reopen a partner's signature.
 */
const HASH_RELEVANT: ReadonlySet<string> = new Set([
  "verification",
  "review_note",
  "review_note_resolved",
]);

/** Deterministic JSON: object keys sorted, so the hash does not depend on insertion order. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

export interface CoveredFacts {
  lines: { key: string; value: string | number; rule: string }[];
  values: { id: string; value: string | number | boolean }[];
  /** References that do not resolve to a value, recorded by their raw text. */
  otherRefs: string[];
}

/**
 * Collect the fact closure under a scope.
 *
 * Walks `inputs` depth-first with a visited set, so the shared subtotals every
 * branch leads back to are collected once and cycles cannot loop.
 */
export function coveredFacts(graph: FactGraph, scope: Scope): CoveredFacts {
  const lines = new Map<string, { key: string; value: string | number; rule: string }>();
  const values = new Map<string, { id: string; value: string | number | boolean }>();
  const otherRefs = new Set<string>();

  const visitLine = (key: string) => {
    if (lines.has(key)) return;
    const line = graph.lineByKey.get(key);
    if (!line) return;
    lines.set(key, { key: line.key, value: line.value, rule: line.rule });

    for (const ref of line.sources) {
      const parsed = parseRef(ref);
      if (parsed.kind === "extracted_value" && parsed.id) {
        const ev = graph.evById.get(parsed.id);
        if (ev) values.set(ev.id, { id: ev.id, value: ev.value });
        else otherRefs.add(ref);
      } else {
        otherRefs.add(ref);
      }
    }

    for (const input of line.inputs) visitLine(input);
  };

  switch (scope.kind) {
    case "line":
      visitLine(scope.id);
      break;
    case "document": {
      for (const ev of graph.evsByDoc.get(scope.id) ?? []) {
        values.set(ev.id, { id: ev.id, value: ev.value });
      }
      break;
    }
    case "extracted_value": {
      const ev = graph.evById.get(scope.id);
      if (ev) values.set(ev.id, { id: ev.id, value: ev.value });
      break;
    }
    case "return": {
      for (const line of graph.current.lines) {
        lines.set(line.key, { key: line.key, value: line.value, rule: line.rule });
      }
      break;
    }
  }

  const byKey = <T extends { key?: string; id?: string }>(a: T, b: T) => {
    const x = a.key ?? a.id ?? "";
    const y = b.key ?? b.id ?? "";
    return x < y ? -1 : x > y ? 1 : 0;
  };

  return {
    lines: [...lines.values()].sort(byKey),
    values: [...values.values()].sort(byKey),
    otherRefs: [...otherRefs].sort(),
  };
}

export interface HashResult {
  hash: string;
  facts: CoveredFacts;
  /** Ids of the work events folded into the hash, in order. */
  workEventIds: string[];
}

/**
 * Hash the facts and work a sign-off on `scope` would cover.
 *
 * `events` must be the scope's own events. Reverted events and the events that
 * revert them are excluded by the caller's fold before reaching here.
 */
export function contentHash(
  graph: FactGraph,
  scope: Scope,
  liveEvents: WorkpaperEvent[],
): HashResult {
  const facts = coveredFacts(graph, scope);
  const workEventIds = liveEvents
    .filter((e) => HASH_RELEVANT.has(e.type))
    .map((e) => e.id)
    .sort();

  const hash = createHash("sha256")
    .update(canonical({ scope, facts, workEventIds }))
    .digest("hex");

  return { hash, facts, workEventIds };
}
