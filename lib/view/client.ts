"use client";

import type { DocumentDetail, LineDetail } from "./models";

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
