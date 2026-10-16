/**
 * Reference parsing.
 *
 * The packet addresses everything by short string references, and the README's
 * `reference_formats` section is the full grammar. Every click-through in the
 * workpaper goes through `parseRef`, so this file is the one place that needs to
 * know the grammar; resolution against the loaded packet lives in `graph.ts`.
 *
 * `parseRef` is deliberately pure and total: an unrecognized reference comes back
 * as `kind: "unknown"` rather than throwing, because a reference the packet uses
 * but we cannot parse is itself a finding worth surfacing.
 */

export type RefKind =
  | "extracted_value"
  | "document"
  | "document_page"
  | "questionnaire"
  | "message"
  | "call_note"
  | "prior_year"
  | "agency"
  | "asset"
  | "person"
  | "param"
  | "fx"
  | "timeline"
  | "version"
  | "line"
  | "unknown";

export interface ParsedRef {
  /** The reference exactly as the packet wrote it. */
  raw: string;
  kind: RefKind;
  /** Identifier for kinds addressed by id (`ev-0001`, `D09`, `qa-14`, `tl-03`, asset ids, person ids). */
  id?: string;
  /** RFC 6901 JSON Pointer, for `py:/...` and `agency:/...`. */
  pointer?: string;
  /** Page number, for `doc:D30#page32`. */
  page?: number;
  /** Dotted path, for `ref:param.<name>` and `ref:fx.SEK.<rate>`. */
  path?: string;
}

/**
 * A line key is `<form>.<line>`, where the line part may itself contain dots
 * (`F8949.A.M6`, `SchCA540NR.12.C`, `F8938.1.max`) and either part may contain
 * hyphens (`F4562-E.total-A`).
 */
const LINE_KEY = /^[A-Za-z][A-Za-z0-9-]*\.[A-Za-z0-9][A-Za-z0-9.-]*$/;

export function parseRef(raw: string): ParsedRef {
  const ref = raw.trim();

  let m: RegExpMatchArray | null;

  if (/^ev-\d+$/.test(ref)) return { raw, kind: "extracted_value", id: ref };
  if (/^D\d+$/.test(ref)) return { raw, kind: "document", id: ref };

  if ((m = ref.match(/^doc:(D\d+)#page(\d+)$/))) {
    return { raw, kind: "document_page", id: m[1], page: Number(m[2]) };
  }

  if (/^qa-\d+$/.test(ref)) return { raw, kind: "questionnaire", id: ref };
  if (/^msg-\d+$/.test(ref)) return { raw, kind: "message", id: ref };
  if (/^call-\d+$/.test(ref)) return { raw, kind: "call_note", id: ref };

  if ((m = ref.match(/^py:(\/.*)$/))) return { raw, kind: "prior_year", pointer: m[1] };
  if ((m = ref.match(/^agency:(\/.*)$/))) return { raw, kind: "agency", pointer: m[1] };

  if ((m = ref.match(/^asset:(.+)$/))) return { raw, kind: "asset", id: m[1] };
  if ((m = ref.match(/^household:(.+)$/))) return { raw, kind: "person", id: m[1] };

  // `ref:fx.` must be tested before `ref:param.`: the README lists fx rates under
  // both `ref:fx.SEK.<rate>` and `engine_reference.parameters.fx`.
  if ((m = ref.match(/^ref:fx\.(.+)$/))) return { raw, kind: "fx", path: m[1] };
  if ((m = ref.match(/^ref:param\.(.+)$/))) return { raw, kind: "param", path: m[1] };

  if ((m = ref.match(/^timeline:(.+)$/))) return { raw, kind: "timeline", id: m[1] };

  // Timeline events reference computed versions directly as `v1` / `v2` / `v3`.
  if (/^v\d+$/.test(ref)) return { raw, kind: "version", id: ref };

  if (LINE_KEY.test(ref)) return { raw, kind: "line", id: ref };

  return { raw, kind: "unknown" };
}

/** Short human name for a reference kind, for chips and group headers. */
export const REF_KIND_LABEL: Record<RefKind, string> = {
  extracted_value: "Extracted value",
  document: "Document",
  document_page: "Document page",
  questionnaire: "Questionnaire answer",
  message: "Client message",
  call_note: "Call note",
  prior_year: "Prior year record",
  agency: "Tax agency record",
  asset: "Asset",
  person: "Household member",
  param: "Engine parameter",
  fx: "Exchange rate",
  timeline: "Timeline event",
  version: "Computed version",
  line: "Return line",
  unknown: "Unrecognized reference",
};

const ESCAPE = /~[01]/g;

/** Un-escape one RFC 6901 pointer token (`~1` is `/`, `~0` is `~`). */
function unescapeToken(token: string): string {
  return token.replace(ESCAPE, (s) => (s === "~1" ? "/" : "~"));
}

export interface PointerResult {
  ok: boolean;
  value?: unknown;
  /** The part of the pointer that resolved, for error messages. */
  resolvedThrough?: string;
  reason?: string;
}

/**
 * Resolve an RFC 6901 JSON Pointer against `root`.
 *
 * Reports the prefix that did resolve when it fails, so a stale reference in the
 * packet can be reported precisely instead of as a generic miss.
 */
export function resolvePointer(root: unknown, pointer: string): PointerResult {
  if (pointer === "") return { ok: true, value: root };
  if (!pointer.startsWith("/")) {
    return { ok: false, reason: `Pointer must start with "/": ${pointer}` };
  }

  const tokens = pointer.slice(1).split("/").map(unescapeToken);
  let current: unknown = root;
  const walked: string[] = [];

  for (const token of tokens) {
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return {
          ok: false,
          resolvedThrough: "/" + walked.join("/"),
          reason: `No index ${token} in array of ${current.length}`,
        };
      }
      current = current[index];
    } else if (current !== null && typeof current === "object") {
      const record = current as Record<string, unknown>;
      if (!(token in record)) {
        return {
          ok: false,
          resolvedThrough: "/" + walked.join("/"),
          reason: `No key "${token}"`,
        };
      }
      current = record[token];
    } else {
      return {
        ok: false,
        resolvedThrough: "/" + walked.join("/"),
        reason: `Cannot descend into ${typeof current} at "${token}"`,
      };
    }
    walked.push(token);
  }

  return { ok: true, value: current, resolvedThrough: pointer };
}

/** Resolve a dotted path (`param.fx.SEK.2025_average` style tails) against an object. */
export function resolveDotPath(root: unknown, path: string): PointerResult {
  return resolvePointer(root, "/" + path.split(".").join("/"));
}
