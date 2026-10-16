/**
 * Locating an extracted value on a simulated source page.
 *
 * This is the seam where real source documents would replace the simulated ones.
 * Everything above it addresses a location as "extracted value `ev-0035` on page 1
 * of `D09`"; only this file knows how that becomes a highlight. Swapping in real
 * PDFs means implementing `locatePage` against a text layer and real bounding
 * boxes, and nothing upstream changes.
 *
 * Two properties of the packet shape the implementation:
 *
 *   1. `printed_content` is a prose rendering of the page, not a verbatim
 *      transcript. D01 page 2 reads "Fee: fixed $4,800" while the pipeline
 *      recorded `text_as_read: "4,800.00"`. Measured over the packet, 890 of
 *      3,012 extracted values do not appear verbatim on their page, so verbatim
 *      matching alone would fail on a third of all highlights.
 *
 *   2. `position` is synthetic. The README says so explicitly, and the values do
 *      not correspond to where the text sits in `printed_content`, so drawing
 *      boxes from it would put highlights in the wrong place. It is kept on the
 *      value for the eventual real-document case but is not used to locate.
 *
 * So locating runs a ladder of strategies and reports which one it used. The UI
 * shows that method, because "we matched this by value, not verbatim text" is
 * exactly the kind of thing a reviewer should be able to see.
 */

import type { ExtractedValue } from "../packet/types";

export type LocateMethod =
  | "text_as_read"
  | "normalized_value"
  | "value"
  | "field_label"
  | "none";

export interface Located {
  evId: string;
  /** Character offsets into `printed_content`; absent when `method` is "none". */
  start?: number;
  end?: number;
  method: LocateMethod;
}

const NUMBER_TOKEN = /-?\d[\d,]*(?:\.\d+)?/g;

function normalizeNumber(text: string): number | null {
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Turn a pipeline field name into a pattern for the issuer's own label.
 *
 * `box1` becomes /Box\s*1\b/, `box12_D` becomes /Box\s*12\s*D/, and anything else
 * falls back to its words in order. Used only as a last resort before giving up.
 */
function fieldLabelPattern(field: string): RegExp | null {
  const box = field.match(/^box(\d+)(?:_([A-Za-z0-9]+))?$/i);
  if (box) {
    const suffix = box[2] ? `\\s*${box[2]}` : "\\b";
    return new RegExp(`Box\\s*${box[1]}${suffix}`, "i");
  }
  const words = field
    .split(/[_\s]+/)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return null;
  return new RegExp(words.join("[\\s\\S]{0,24}"), "i");
}

interface Span {
  start: number;
  end: number;
}

function overlaps(span: Span, taken: Span[]): boolean {
  return taken.some((t) => span.start < t.end && t.start < span.end);
}

/**
 * Locate each extracted value on one page's printed content.
 *
 * Values are placed in document order with earlier matches claiming their span,
 * so two values that read the same (several `0.00` boxes on a 1099, for instance)
 * land on different occurrences instead of stacking on the first one.
 */
export function locatePage(printed: string, values: ExtractedValue[]): Located[] {
  const taken: Span[] = [];
  const results: Located[] = [];

  // Pre-index the page's number tokens once; several values may need them.
  const numbers: { span: Span; value: number }[] = [];
  for (const match of printed.matchAll(NUMBER_TOKEN)) {
    const parsed = normalizeNumber(match[0]);
    if (parsed === null || match.index === undefined) continue;
    numbers.push({ span: { start: match.index, end: match.index + match[0].length }, value: parsed });
  }

  for (const ev of values) {
    const claim = (span: Span, method: LocateMethod): Located => {
      taken.push(span);
      return { evId: ev.id, start: span.start, end: span.end, method };
    };

    // 1. The pipeline's own reading, verbatim.
    const verbatim = ev.text_as_read?.trim();
    if (verbatim) {
      let from = 0;
      let found = -1;
      while ((found = printed.indexOf(verbatim, from)) !== -1) {
        const span = { start: found, end: found + verbatim.length };
        if (!overlaps(span, taken)) {
          results.push(claim(span, "text_as_read"));
          break;
        }
        from = found + 1;
      }
      if (results.at(-1)?.evId === ev.id) continue;
    }

    // 2. The pipeline's normalized value, verbatim. Dates are the reason this
    //    rung exists: the Brightpath 1099-B prints "acquired 2024-02-27" while the
    //    pipeline recorded `text_as_read: "02/27/2024"` against the same field, so
    //    verbatim matching on the reading alone misses every acquired/sold date on
    //    the document (506 of its 1,826 values).
    const normalized = typeof ev.value === "string" ? ev.value.trim() : "";
    if (normalized && normalized !== verbatim && normalized.length > 2) {
      let from = 0;
      let found = -1;
      while ((found = printed.indexOf(normalized, from)) !== -1) {
        const span = { start: found, end: found + normalized.length };
        if (!overlaps(span, taken)) {
          results.push(claim(span, "normalized_value"));
          break;
        }
        from = found + 1;
      }
      if (results.at(-1)?.evId === ev.id) continue;
    }

    // 3. The value, compared numerically, so "4,800.00" matches "$4,800".
    if (typeof ev.value === "number") {
      const hit = numbers.find((n) => n.value === ev.value && !overlaps(n.span, taken));
      if (hit) {
        results.push(claim(hit.span, "value"));
        continue;
      }
    }

    // 4. The issuer's label for the field, so the reviewer at least lands on the
    //    right row even when the amount itself is not printed in the prose.
    const pattern = fieldLabelPattern(ev.field);
    if (pattern) {
      const match = printed.match(pattern);
      if (match?.index !== undefined) {
        const span = { start: match.index, end: match.index + match[0].length };
        if (!overlaps(span, taken)) {
          results.push(claim(span, "field_label"));
          continue;
        }
      }
    }

    results.push({ evId: ev.id, method: "none" });
  }

  return results;
}

export interface Segment {
  text: string;
  /** The extracted value highlighted here, if any. */
  evId?: string;
  method?: LocateMethod;
}

/** Split a page into plain and highlighted segments for rendering. */
export function segmentPage(printed: string, located: Located[]): Segment[] {
  const spans = located
    .filter((l): l is Located & Span => l.start !== undefined && l.end !== undefined)
    .sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) segments.push({ text: printed.slice(cursor, span.start) });
    segments.push({
      text: printed.slice(span.start, span.end),
      evId: span.evId,
      method: span.method,
    });
    cursor = span.end;
  }
  if (cursor < printed.length) segments.push({ text: printed.slice(cursor) });

  return segments;
}
