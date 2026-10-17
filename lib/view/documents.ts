/**
 * The document index.
 *
 * The brief asks to trace "any document to everywhere it landed, **or why it
 * didn't**". The second half is the harder and more useful one: of the 74
 * documents in this file, 18 reach no line on the current return, and until
 * there was an index they could not be opened at all — including the books
 * transaction detail that proves the largest error in the file.
 *
 * Every reason offered here is derived from the packet or from the versions'
 * own records. Where nothing explains a document, it says so, because an
 * unexplained document in the file is the finding.
 */

import type { FactGraph } from "../graph/graph";
import type { ExtractedValue, PacketDocument } from "../packet/types";

export type NotLandedKind =
  | "superseded"
  | "not_extracted"
  | "prior_year"
  | "duplicate"
  | "engagement"
  | "unexplained";

export interface NotLanded {
  kind: NotLandedKind;
  detail: string;
  refs: string[];
}

export interface DocumentRow {
  id: string;
  title: string;
  documentType: string;
  issuer: string;
  belongsTo: string;
  taxYear: number;
  receivedAt: string;
  uploadedBy: string;
  fileName: string;
  pageCount: number;
  markedCorrected: boolean;
  extraction: PacketDocument["extraction"];
  valueCount: number;
  /** Line keys on the current return that cite a value from this document. */
  landedOn: string[];
  usedIn: string[];
  supersededIn: string[];
  /** Present only when the document reaches no line. */
  notLanded?: NotLanded;
}

/**
 * Document types that serve a required step rather than a figure.
 *
 * Tied to the firm's own required-step list, not to a guess about what matters:
 * an engagement letter is evidence that the engagement was signed, and never
 * belongs on a return line.
 */
const STEP_DOCUMENTS: Record<string, string> = {
  engagement_letter: "Engagement letter and consents signed",
  consent_7216: "Engagement letter and consents signed",
  identity_document: "Identity verified",
  irs_ip_pin_notice: "Client approval and e-file authorization",
};

function fieldMap(values: ExtractedValue[]): string {
  return JSON.stringify(
    [...values].sort((a, b) => (a.field < b.field ? -1 : 1)).map((ev) => [ev.field, ev.value]),
  );
}

export function buildDocumentIndex(graph: FactGraph): DocumentRow[] {
  /**
   * Everything the prior-year records point at, as one text blob.
   *
   * `prior_years` references documents two different ways — `line_sources` holds
   * extracted value ids, `basis_records[].source` holds document ids as plain
   * strings — so both are caught by looking for either in the serialized record
   * rather than by walking two shapes.
   */
  const priorYears = JSON.stringify(graph.packet.prior_years);

  const byFields = new Map<string, string[]>();
  for (const doc of graph.documents) {
    const values = graph.evsByDoc.get(doc.id) ?? [];
    if (values.length === 0) continue;
    const key = `${doc.document_type}|${doc.issuer}|${doc.belongs_to}|${doc.tax_year}|${fieldMap(values)}`;
    const list = byFields.get(key);
    if (list) list.push(doc.id);
    else byFields.set(key, [doc.id]);
  }

  const duplicateOf = new Map<string, string>();
  for (const ids of byFields.values()) {
    if (ids.length < 2) continue;
    // The one that arrived first is the original; the rest repeat it.
    const [first, ...rest] = [...ids].sort(
      (a, b) =>
        (graph.docById.get(a)?.received_at ?? "").localeCompare(
          graph.docById.get(b)?.received_at ?? "",
        ),
    );
    for (const id of rest) duplicateOf.set(id, first);
  }

  return graph.documents.map((doc) => {
    const values = graph.evsByDoc.get(doc.id) ?? [];
    const landedOn = graph.linesByDoc.get(doc.id) ?? [];
    const supersededIn = graph.versions
      .filter((v) => v.documents_superseded.includes(doc.id))
      .map((v) => v.version);

    const row: DocumentRow = {
      id: doc.id,
      title: doc.title,
      documentType: doc.document_type,
      issuer: doc.issuer,
      belongsTo: doc.belongs_to,
      taxYear: doc.tax_year,
      receivedAt: doc.received_at,
      uploadedBy: doc.uploaded_by,
      fileName: doc.file_name,
      pageCount: doc.page_count,
      markedCorrected: Boolean(doc.marked_corrected),
      extraction: doc.extraction,
      valueCount: values.length,
      landedOn,
      usedIn: graph.versions.filter((v) => v.documents_used.includes(doc.id)).map((v) => v.version),
      supersededIn,
    };

    if (landedOn.length > 0) return row;

    // 1. A later version displaced it.
    if (supersededIn.length > 0) {
      row.notLanded = {
        kind: "superseded",
        detail: `Displaced in ${supersededIn.join(", ")} by a corrected copy, so nothing should cite it.`,
        refs: [doc.id],
      };
      return row;
    }

    // 2. The pipeline read nothing from it, and said why.
    if (doc.extraction.status === "not_extracted") {
      row.notLanded = {
        kind: "not_extracted",
        detail: doc.extraction.reason ?? "The pipeline extracted nothing from it.",
        refs: [doc.id],
      };
      return row;
    }

    // 3. The prior-year records cite it, even though this year's lines do not.
    const citedByPriorYears =
      priorYears.includes(`"${doc.id}"`) || values.some((ev) => priorYears.includes(`"${ev.id}"`));
    if (citedByPriorYears) {
      row.notLanded = {
        kind: "prior_year",
        detail:
          "Cited by the prior-year records rather than by a line on this return — it supports what was carried forward.",
        refs: [doc.id, "py:/"],
      };
      return row;
    }

    // 4. It repeats a document already in the file.
    const original = duplicateOf.get(doc.id);
    if (original) {
      row.notLanded = {
        kind: "duplicate",
        detail: `Every extracted field matches ${original}, which arrived first. Counting both would double the amounts.`,
        refs: [doc.id, original],
      };
      return row;
    }

    // 5. It evidences a required step, not a figure.
    const step = STEP_DOCUMENTS[doc.document_type];
    if (step) {
      row.notLanded = {
        kind: "engagement",
        detail: `Evidence for the required step "${step}". It belongs to the engagement, not to a return line.`,
        refs: [doc.id],
      };
      return row;
    }

    // 6. Nothing in the file explains it.
    row.notLanded = {
      kind: "unexplained",
      detail: `${values.length} values were read from it and no line on the return cites any of them. Nothing in the file says why.`,
      refs: [doc.id],
    };
    return row;
  });
}
