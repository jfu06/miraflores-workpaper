/**
 * View models: the shapes the UI receives.
 *
 * These exist so the client never holds the packet. The outline is small enough
 * to render server-side in one pass; line and document detail are fetched per
 * click. That split is also where Day 2's role-based masking and view logging go:
 * every sensitive value reaches the browser through `lineDetail` or
 * `documentDetail`, so masking there covers the whole surface.
 */

import type { Jurisdiction, PacketDocument, ReturnLine } from "../packet/types";
import { locatePage, segmentPage, type LocateMethod, type Segment } from "../graph/document";
import { resolveRef, type FactGraph, type ResolvedRef, type WorkpaperLookup } from "../graph/graph";
import { applyMask, isSensitive, maskValue } from "../auth/mask";
import type { ActorInfo } from "../events/derive";
import { defaultCategory } from "../adjust/effect";
import { areaForForm } from "./areas";

export interface OutlineLine {
  key: string;
  line: string;
  label: string;
  value: string | number;
  sourceCount: number;
  inputCount: number;
  hasNote: boolean;
}

export interface OutlineForm {
  form: string;
  area: string;
  lines: OutlineLine[];
}

export interface OutlineGroup {
  jurisdiction: Jurisdiction;
  forms: OutlineForm[];
}

function toOutlineLine(line: ReturnLine): OutlineLine {
  return {
    key: line.key,
    line: line.line,
    label: line.label,
    value: line.value,
    sourceCount: line.sources.length,
    inputCount: line.inputs.length,
    hasNote: Boolean(line.note),
  };
}

/**
 * Group the current return into jurisdiction → form → lines, preserving the
 * engine's own line order within each form.
 */
export function buildOutline(graph: FactGraph): OutlineGroup[] {
  const groups = new Map<Jurisdiction, Map<string, OutlineLine[]>>();

  for (const line of graph.current.lines) {
    let forms = groups.get(line.jurisdiction);
    if (!forms) {
      forms = new Map();
      groups.set(line.jurisdiction, forms);
    }
    const lines = forms.get(line.form);
    if (lines) lines.push(toOutlineLine(line));
    else forms.set(line.form, [toOutlineLine(line)]);
  }

  const order: Jurisdiction[] = ["federal", "california"];
  return order
    .filter((j) => groups.has(j))
    .map((jurisdiction) => ({
      jurisdiction,
      forms: [...groups.get(jurisdiction)!].map(([form, lines]) => ({
        form,
        area: areaForForm(form),
        lines,
      })),
    }));
}

export interface LineRef {
  key: string;
  form: string;
  line: string;
  label: string;
  value: string | number;
  /** Carried so the trace tree can show a node as expandable before fetching it. */
  inputCount: number;
  sourceCount: number;
}

export interface LineDetail {
  key: string;
  form: string;
  line: string;
  label: string;
  value: string | number;
  jurisdiction: Jurisdiction;
  area: string;
  note?: string;
  rule: string;
  /** The engine's own description of the rule, from `engine_reference.rules`. */
  ruleText?: string;
  inputs: LineRef[];
  /** Lines that take this one as an input, so a change can be traced downstream. */
  dependents: LineRef[];
  /** The evidence the engine cited when it produced this figure. */
  sources: ResolvedRef[];
  /**
   * Evidence a person attached during review — an answer from the client, a
   * record the pipeline never read. Kept apart from the engine's own sources,
   * because conflating them would hide which part of the support the engine
   * never saw.
   */
  citedSources: (ResolvedRef & { citedBy: string; citedAt: string; note?: string })[];
  /** Diagnostics from the current version that cite this line. */
  diagnostics: { code: string; severity: string; message: string }[];
  /** The rate category an adjustment here would be estimated with by default. */
  defaultCategory: string | null;
}

function toLineRef(line: ReturnLine): LineRef {
  return {
    key: line.key,
    form: line.form,
    line: line.line,
    label: line.label,
    value: line.value,
    inputCount: line.inputs.length,
    sourceCount: line.sources.length,
  };
}

export interface WorkpaperEvidence {
  citations: { ref: string; note?: string; by: string; at: string }[];
  lookup: WorkpaperLookup;
}

export function buildLineDetail(
  graph: FactGraph,
  key: string,
  workpaper?: WorkpaperEvidence,
): LineDetail | null {
  const line = graph.lineByKey.get(key);
  if (!line) return null;

  const inputs = line.inputs
    .map((k) => graph.lineByKey.get(k))
    .filter((l): l is ReturnLine => Boolean(l))
    .map(toLineRef);

  const dependents = (graph.dependents.get(key) ?? [])
    .map((k) => graph.lineByKey.get(k))
    .filter((l): l is ReturnLine => Boolean(l))
    .map(toLineRef);

  return {
    key: line.key,
    form: line.form,
    line: line.line,
    label: line.label,
    value: line.value,
    jurisdiction: line.jurisdiction,
    area: areaForForm(line.form),
    note: line.note,
    rule: line.rule,
    ruleText: graph.rules[line.rule],
    inputs,
    dependents,
    sources: line.sources.map((ref) => resolveRef(graph, ref, workpaper?.lookup)),
    citedSources: (workpaper?.citations ?? []).map((citation) => ({
      ...resolveRef(graph, citation.ref, workpaper?.lookup),
      citedBy: citation.by,
      citedAt: citation.at,
      note: citation.note,
    })),
    diagnostics: graph.current.diagnostics
      .filter((d) => d.refs.includes(key))
      .map((d) => ({ code: d.code, severity: d.severity, message: d.message })),
    defaultCategory: defaultCategory(line),
  };
}

export interface PageValue {
  evId: string;
  field: string;
  label: string;
  value: string | number | boolean;
  valueType: string;
  textAsRead: string;
  confidence: number;
  method: LocateMethod;
  /** Line keys in the current return that cite this value. */
  landedOn: string[];
  /** True when the value shown has been masked for this actor. */
  masked: boolean;
  /** True when this actor's clearance would let them reveal it. */
  revealable: boolean;
}

export interface DocumentPageView {
  page: number;
  segments: Segment[];
  values: PageValue[];
}

export interface DocumentDetail {
  id: string;
  title: string;
  documentType: string;
  issuer: string;
  belongsTo: string;
  receivedAt: string;
  uploadedBy: string;
  fileName: string;
  pageCount: number;
  markedCorrected: boolean;
  extraction: PacketDocument["extraction"];
  pages: DocumentPageView[];
  /** Pages with no extracted values at all, addressable as `doc:<id>#page<n>`. */
  pagesWithoutValues: number[];
  /** Every return line this document's values reached. */
  landedOn: LineRef[];
  /** Set when a later document supersedes this one, or this one supersedes another. */
  supersededIn: string[];
  usedIn: string[];
}

/**
 * A social security number printed on a page that the pipeline did not extract
 * would otherwise reach the browser inside the page text, with nothing to mask it.
 * Highlighted spans are masked through their extracted value; this covers the rest.
 */
const SSN_IN_TEXT = /\b\d{3}-\d{2}-\d{4}\b/g;

function maskPlainText(text: string): string {
  return text.replace(SSN_IN_TEXT, (match) => maskValue(match));
}

export function buildDocumentDetail(
  graph: FactGraph,
  id: string,
  actor: ActorInfo,
): DocumentDetail | null {
  const doc = graph.docById.get(id);
  if (!doc) return null;

  const pages: DocumentPageView[] = [];
  const pagesWithoutValues: number[] = [];

  for (const page of doc.pages) {
    const values = graph.evsByDocPage.get(`${doc.id}#${page.page}`) ?? [];
    if (values.length === 0) {
      pagesWithoutValues.push(page.page);
      pages.push({
        page: page.page,
        segments: [{ text: maskPlainText(page.printed_content) }],
        values: [],
      });
      continue;
    }

    const located = locatePage(page.printed_content, values);
    const methodById = new Map(located.map((l) => [l.evId, l.method]));
    const sensitiveEvIds = new Set(
      values.filter((ev) => isSensitive(ev.value_type, ev.field)).map((ev) => ev.id),
    );

    pages.push({
      page: page.page,
      // Masking reaches the page text, not only the value list: a highlighted
      // span holds the same digits the field does.
      segments: segmentPage(page.printed_content, located).map((segment) =>
        segment.evId && sensitiveEvIds.has(segment.evId)
          ? { ...segment, text: maskValue(segment.text) }
          : { ...segment, text: maskPlainText(segment.text) },
      ),
      values: values.map((ev) => {
        const masked = applyMask(ev.value, ev.value_type, ev.field, actor);
        return {
          evId: ev.id,
          field: ev.field,
          label: ev.label,
          value: masked.value,
          valueType: ev.value_type,
          textAsRead: masked.masked ? maskValue(ev.text_as_read) : ev.text_as_read,
          confidence: ev.confidence,
          method: methodById.get(ev.id) ?? "none",
          landedOn: graph.linesByEv.get(ev.id) ?? [],
          masked: masked.masked,
          revealable: masked.revealable,
        };
      }),
    });
  }

  const landedOn = (graph.linesByDoc.get(doc.id) ?? [])
    .map((k) => graph.lineByKey.get(k))
    .filter((l): l is ReturnLine => Boolean(l))
    .map(toLineRef);

  return {
    id: doc.id,
    title: doc.title,
    documentType: doc.document_type,
    issuer: doc.issuer,
    belongsTo: doc.belongs_to,
    receivedAt: doc.received_at,
    uploadedBy: doc.uploaded_by,
    fileName: doc.file_name,
    pageCount: doc.page_count,
    markedCorrected: Boolean(doc.marked_corrected),
    extraction: doc.extraction,
    pages,
    pagesWithoutValues,
    landedOn,
    supersededIn: graph.versions.filter((v) => v.documents_superseded.includes(doc.id)).map((v) => v.version),
    usedIn: graph.versions.filter((v) => v.documents_used.includes(doc.id)).map((v) => v.version),
  };
}
