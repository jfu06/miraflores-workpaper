"use client";

import type { DerivedScope, SignoffCheck } from "../events/derive";
import type { ActorInfo } from "../events/derive";
import type { DocumentDetail, LineDetail } from "./models";

export interface ScopeState extends DerivedScope {
  actor: ActorInfo;
  staff: ActorInfo[];
  signoffChecks: Record<string, SignoffCheck>;
}

/**
 * Client-side fetch with a cache.
 *
 * The trace tree walks the input graph one node at a time and the same line shows
 * up under several parents (every subtotal leads back to F1040.11), so without a
 * cache expanding a deep branch would refetch the same lines repeatedly.
 */
const lineCache = new Map<string, Promise<LineDetail>>();
const docCache = new Map<string, Promise<DocumentDetail>>();

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchLine(key: string): Promise<LineDetail> {
  const cached = lineCache.get(key);
  if (cached) return cached;
  const promise = get<LineDetail>(`/api/line/${encodeURIComponent(key)}`).catch((error) => {
    lineCache.delete(key);
    throw error;
  });
  lineCache.set(key, promise);
  return promise;
}

export function fetchDocument(id: string): Promise<DocumentDetail> {
  const cached = docCache.get(id);
  if (cached) return cached;
  const promise = get<DocumentDetail>(`/api/document/${encodeURIComponent(id)}`).catch((error) => {
    docCache.delete(id);
    throw error;
  });
  docCache.set(id, promise);
  return promise;
}

/**
 * Drop cached detail. Called when the acting role changes: masking is decided on
 * the server per actor, so a response cached for one person must not be shown to
 * another.
 */
export function clearCaches(): void {
  lineCache.clear();
  docCache.clear();
}

/** Scope state is never cached: every append changes it. */
export async function fetchScope(kind: string, id: string): Promise<ScopeState> {
  return get<ScopeState>(`/api/scope?kind=${kind}&id=${encodeURIComponent(id)}`);
}

export async function appendEvent(body: {
  type: string;
  scope: { kind: string; id: string };
  payload: Record<string, unknown>;
}): Promise<void> {
  const response = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(error?.error ?? `Request failed: ${response.status}`);
  }
}

export async function revealValue(evId: string): Promise<string> {
  const response = await fetch("/api/reveal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evId }),
  });
  const body = (await response.json()) as { value?: string; error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed: ${response.status}`);
  return String(body.value);
}
