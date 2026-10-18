/**
 * The fact graph: indexes over the packet, plus `resolveRef`.
 *
 * The packet is immutable pipeline output, so everything here is derived and
 * read-only. The event layer (verifications, notes, adjustments, sign-offs) sits
 * on top of this and is append-only; nothing in this file ever mutates a fact.
 *
 * Two indexes carry most of the product value:
 *   - `linesByEv` / `linesByDoc` answer "where did this document land", which is
 *     the reverse of what the packet stores and cannot be computed per-request.
 *   - `dependents` is the reverse of `lines[].inputs`, so a change can be traced
 *     downstream as well as a number traced upstream.
 */

import type {
  CallNote,
  ClientMessage,
  ExtractedValue,
  Packet,
  PacketDocument,
  PriorYearAsset,
  QuestionnaireItem,
  ReturnLine,
  ReturnVersion,
  StaffMember,
  TimelineEvent,
  VersionAsset,
} from "../packet/types";
import type { AnswerPayload, QuestionPayload, VerificationPayload, WorkpaperEvent } from "../events/types";
import { visibleAt, type Clock } from "../time/clock";
import { parseRef, resolveDotPath, resolvePointer, type ParsedRef } from "./refs";

/**
 * References the packet uses that the README's grammar does not define.
 *
 * Kept as an explicit table rather than widened into the grammar: the alias makes
 * the reference navigable in the UI, and `aliasedFrom` on the result keeps it
 * reportable as a data-quality finding (see FINDINGS.md F-001).
 */
const REF_ALIASES: Record<string, string> = {
  prior_preparer_depreciation_schedule: "py:/prior_preparer_workpaper/depreciation_schedule",
};

export interface FactGraph {
  packet: Packet;
  /** The position this graph was built at. */
  clock: Clock;
  /** True when the clock sits before the engine had computed anything. */
  beforeFirstRun: boolean;
  /** Documents visible at that position. */
  documents: PacketDocument[];

  /** The latest computed version; the README names v3 as the current return. */
  current: ReturnVersion;
  versions: ReturnVersion[];
  versionById: Map<string, ReturnVersion>;

  docById: Map<string, PacketDocument>;
  evById: Map<string, ExtractedValue>;
  evsByDoc: Map<string, ExtractedValue[]>;
  /** Key is `${documentId}#${page}`. */
  evsByDocPage: Map<string, ExtractedValue[]>;

  lineByKey: Map<string, ReturnLine>;
  /** Line keys that cite this extracted value, in the current version. */
  linesByEv: Map<string, string[]>;
  /** Line keys that cite any extracted value from this document. */
  linesByDoc: Map<string, string[]>;
  /** Line keys that take this line as an input (reverse of `inputs`). */
  dependents: Map<string, string[]>;

  assetById: Map<string, VersionAsset | PriorYearAsset>;
  qaById: Map<string, QuestionnaireItem>;
  messageById: Map<string, ClientMessage>;
  callNoteById: Map<string, CallNote>;
  timelineById: Map<string, TimelineEvent>;
  staffById: Map<string, StaffMember>;
  personById: Map<string, { id: string; name: string; role: string }>;
  rules: Record<string, string>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function pushUnique(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key);
  if (!list) map.set(key, [value]);
  else if (!list.includes(value)) list.push(value);
}

/**
 * Build the graph as the file stood at a moment.
 *
 * In replay the engine version is the last one computed by then, and a document
 * that had not arrived is not in the index at all — along with everything read
 * from it. That is the point: a reviewer looking at March should see the file a
 * March reviewer saw, not today's file with later dates greyed out.
 */
export function buildGraph(packet: Packet, clock: Clock = { live: true }): FactGraph {
  const versions = packet.return_versions.filter((v) => visibleAt(clock, v.computed_at));

  /**
   * Before the first run the engine had produced nothing.
   *
   * The first version stands in so the file is still navigable, but that is a
   * scaffold, not the return as it was — at that moment there was no return. The
   * flag says so, and the UI says so, rather than letting figures that did not
   * exist yet be read as though they did.
   */
  const beforeFirstRun = versions.length === 0;
  const current = versions[versions.length - 1] ?? packet.return_versions[0];

  const documents = packet.documents.filter((d) => visibleAt(clock, d.received_at));
  const available = new Set(documents.map((d) => d.id));

  const versionById = new Map(versions.map((v) => [v.version, v]));
  const docById = new Map(documents.map((d) => [d.id, d]));

  const evById = new Map<string, ExtractedValue>();
  const evsByDoc = new Map<string, ExtractedValue[]>();
  const evsByDocPage = new Map<string, ExtractedValue[]>();

  for (const ev of packet.extracted_values) {
    if (!available.has(ev.document_id)) continue;
    evById.set(ev.id, ev);
    push(evsByDoc, ev.document_id, ev);
    push(evsByDocPage, `${ev.document_id}#${ev.page}`, ev);
  }

  const lineByKey = new Map<string, ReturnLine>();
  const linesByEv = new Map<string, string[]>();
  const linesByDoc = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();

  for (const line of current.lines) {
    lineByKey.set(line.key, line);

    for (const source of line.sources) {
      const parsed = parseRef(source);
      if (parsed.kind === "extracted_value" && parsed.id) {
        pushUnique(linesByEv, parsed.id, line.key);
        const ev = evById.get(parsed.id);
        if (ev) pushUnique(linesByDoc, ev.document_id, line.key);
      } else if (parsed.kind === "document" && parsed.id) {
        pushUnique(linesByDoc, parsed.id, line.key);
      } else if (parsed.kind === "document_page" && parsed.id) {
        pushUnique(linesByDoc, parsed.id, line.key);
      }
    }

    for (const input of line.inputs) pushUnique(dependents, input, line.key);
  }

  const assetById = new Map<string, VersionAsset | PriorYearAsset>();
  for (const asset of packet.prior_years.asset_records) assetById.set(asset.asset_id, asset);
  // Current-version assets win: they carry this year's depreciation and disposition.
  for (const asset of current.assets) assetById.set(asset.asset_id, asset);

  return {
    packet,
    clock,
    beforeFirstRun,
    documents,
    current,
    versions,
    versionById,
    docById,
    evById,
    evsByDoc,
    evsByDocPage,
    lineByKey,
    linesByEv,
    linesByDoc,
    dependents,
    assetById,
    qaById: new Map(packet.client.questionnaire.map((q) => [q.id, q])),
    messageById: new Map(packet.client.messages.map((m) => [m.id, m])),
    callNoteById: new Map(packet.client.call_notes.map((c) => [c.id, c])),
    timelineById: new Map(packet.timeline.map((t) => [t.id, t])),
    staffById: new Map(packet.firm.staff.map((s) => [s.id, s])),
    personById: new Map(packet.household.people.map((p) => [p.id, p])),
    rules: packet.engine_reference.rules,
  };
}

/** Where a resolved reference should navigate when clicked. */
/**
 * Which returns a line's value reaches.
 *
 * A California line is built from federal ones — Schedule CA (540NR) is a column
 * of adjustments to federal amounts — so a federal figure in doubt puts the
 * California return in doubt too, while the reverse does not hold. Walking
 * `dependents` answers that from the file rather than from an assumption about
 * which jurisdiction is downstream of which.
 *
 * Returns the line's own jurisdiction together with every jurisdiction it feeds.
 */
export function jurisdictionsReached(graph: FactGraph, lineKey: string): string[] {
  const start = graph.lineByKey.get(lineKey);
  if (!start) return [];

  const reached = new Set<string>([start.jurisdiction]);
  const seen = new Set<string>([lineKey]);
  const stack = [lineKey];

  while (stack.length > 0) {
    const key = stack.pop()!;
    for (const dependent of graph.dependents.get(key) ?? []) {
      if (seen.has(dependent)) continue;
      seen.add(dependent);
      const line = graph.lineByKey.get(dependent);
      if (line) reached.add(line.jurisdiction);
      stack.push(dependent);
    }
  }

  return [...reached].sort();
}

export type RefTarget =
  | { kind: "document"; documentId: string; page?: number; highlightEv?: string }
  | { kind: "line"; lineKey: string }
  | { kind: "record"; section: string; pointer: string };

/**
 * How `resolveRef` reaches records this workpaper produced.
 *
 * Passed in rather than held on the graph: the fact graph is built from the
 * packet and is immutable, and the event log is neither.
 */
export interface WorkpaperLookup {
  event(id: string): WorkpaperEvent | null;
  actorName(id: string): string;
}

export interface ResolvedRef {
  parsed: ParsedRef;
  ok: boolean;
  /** Short title for a chip. */
  title: string;
  /** One line of detail under the title. */
  subtitle?: string;
  target?: RefTarget;
  value?: unknown;
  /** Set when the reference was only resolvable through `REF_ALIASES`. */
  aliasedFrom?: string;
  /** Why resolution failed; present when `ok` is false. */
  reason?: string;
}

function money(value: unknown): string {
  if (typeof value !== "number") return String(value);
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Resolve one reference against the graph.
 *
 * Total by construction: an unparseable or dangling reference comes back with
 * `ok: false` and a reason, because the workpaper has to be able to show that a
 * number's stated source does not exist.
 */
export function resolveRef(
  graph: FactGraph,
  raw: string,
  lookup?: WorkpaperLookup,
): ResolvedRef {
  const alias = REF_ALIASES[raw];
  const parsed = parseRef(alias ?? raw);
  const base = { parsed: { ...parsed, raw }, aliasedFrom: alias ? raw : undefined };

  const fail = (reason: string): ResolvedRef => ({
    ...base,
    ok: false,
    title: raw,
    reason,
  });

  switch (parsed.kind) {
    case "extracted_value": {
      const ev = graph.evById.get(parsed.id!);
      if (!ev) return fail("No extracted value with this id");
      const doc = graph.docById.get(ev.document_id);
      return {
        ...base,
        ok: true,
        title: `${ev.label || ev.field}`,
        subtitle: `${ev.document_id} p${ev.page} · field ${ev.field} · ${
          ev.value_type === "money" ? money(ev.value) : String(ev.value)
        } · confidence ${ev.confidence.toFixed(2)}${doc ? ` · ${doc.title}` : ""}`,
        target: { kind: "document", documentId: ev.document_id, page: ev.page, highlightEv: ev.id },
        value: ev.value,
      };
    }

    case "document": {
      const doc = graph.docById.get(parsed.id!);
      if (!doc) return fail("No document with this id");
      return {
        ...base,
        ok: true,
        title: `${doc.id} · ${doc.title}`,
        subtitle: `${doc.document_type} · ${doc.page_count} page${doc.page_count === 1 ? "" : "s"} · ${
          doc.extraction.status
        }`,
        target: { kind: "document", documentId: doc.id },
      };
    }

    case "document_page": {
      const doc = graph.docById.get(parsed.id!);
      if (!doc) return fail("No document with this id");
      const page = doc.pages.find((p) => p.page === parsed.page);
      if (!page) return fail(`Document ${doc.id} has no page ${parsed.page}`);
      return {
        ...base,
        ok: true,
        title: `${doc.id} page ${parsed.page}`,
        subtitle: doc.title,
        target: { kind: "document", documentId: doc.id, page: parsed.page },
      };
    }

    case "line": {
      const line = graph.lineByKey.get(parsed.id!);
      if (!line) {
        return fail(
          `No line "${parsed.id}" in version ${graph.current.version}. The reference is shaped like a line key but the current return has no such line.`,
        );
      }
      return {
        ...base,
        ok: true,
        title: `${line.form} line ${line.line}`,
        subtitle: `${line.label} · ${typeof line.value === "number" ? money(line.value) : line.value}`,
        target: { kind: "line", lineKey: line.key },
        value: line.value,
      };
    }

    case "questionnaire": {
      const qa = graph.qaById.get(parsed.id!);
      if (!qa) return fail("No questionnaire item with this id");
      return {
        ...base,
        ok: true,
        title: qa.question,
        subtitle: `"${qa.answer}" — ${qa.answered_by}, ${qa.answered_at.slice(0, 10)}`,
        target: { kind: "record", section: "client.questionnaire", pointer: `/${qa.id}` },
        value: qa.answer,
      };
    }

    case "message": {
      const msg = graph.messageById.get(parsed.id!);
      if (!msg) return fail("No client message with this id");
      return {
        ...base,
        ok: true,
        title: `${msg.from} → ${msg.to}, ${msg.sent_at.slice(0, 10)}`,
        subtitle: msg.text,
        target: { kind: "record", section: "client.messages", pointer: `/${msg.id}` },
      };
    }

    case "call_note": {
      const note = graph.callNoteById.get(parsed.id!);
      if (!note) return fail("No call note with this id");
      return {
        ...base,
        ok: true,
        title: `Call, ${note.date}`,
        subtitle: note.participants.join(", "),
        target: { kind: "record", section: "client.call_notes", pointer: `/${note.id}` },
      };
    }

    case "prior_year": {
      const result = resolvePointer(graph.packet.prior_years, parsed.pointer!);
      if (!result.ok) {
        return fail(`prior_years${parsed.pointer}: ${result.reason}`);
      }
      return {
        ...base,
        ok: true,
        title: `Prior year · ${parsed.pointer}`,
        subtitle: describe(result.value),
        target: { kind: "record", section: "prior_years", pointer: parsed.pointer! },
        value: result.value,
      };
    }

    case "agency": {
      const result = resolvePointer(graph.packet.tax_agency_records, parsed.pointer!);
      if (!result.ok) return fail(`tax_agency_records${parsed.pointer}: ${result.reason}`);
      return {
        ...base,
        ok: true,
        title: `Tax agency record · ${parsed.pointer}`,
        subtitle: describe(result.value),
        target: { kind: "record", section: "tax_agency_records", pointer: parsed.pointer! },
        value: result.value,
      };
    }

    case "asset": {
      const asset = graph.assetById.get(parsed.id!);
      if (!asset) return fail("No asset with this id");
      return {
        ...base,
        ok: true,
        title: `Asset ${parsed.id}`,
        subtitle: typeof asset.description === "string" ? asset.description : undefined,
        target: { kind: "record", section: "assets", pointer: `/${parsed.id}` },
        value: asset,
      };
    }

    case "person": {
      const person = graph.personById.get(parsed.id!);
      if (!person) return fail("No household member with this id");
      return {
        ...base,
        ok: true,
        title: person.name,
        subtitle: person.role,
        target: { kind: "record", section: "household.people", pointer: `/${person.id}` },
      };
    }

    case "param": {
      const result = resolveDotPath(graph.packet.engine_reference.parameters, parsed.path!);
      if (!result.ok) return fail(`engine parameter ${parsed.path}: ${result.reason}`);
      return {
        ...base,
        ok: true,
        title: `Engine parameter · ${parsed.path}`,
        subtitle: describe(result.value),
        target: { kind: "record", section: "engine_reference.parameters", pointer: `/${parsed.path}` },
        value: result.value,
      };
    }

    case "fx": {
      const result = resolveDotPath(graph.packet.engine_reference.parameters.fx, parsed.path!);
      if (!result.ok) return fail(`exchange rate ${parsed.path}: ${result.reason}`);
      return {
        ...base,
        ok: true,
        title: `Exchange rate · ${parsed.path}`,
        subtitle: describe(result.value),
        target: { kind: "record", section: "engine_reference.parameters.fx", pointer: `/${parsed.path}` },
        value: result.value,
      };
    }

    case "timeline": {
      const event = graph.timelineById.get(parsed.id!);
      if (!event) return fail("No timeline event with this id");
      return {
        ...base,
        ok: true,
        title: event.event.replace(/_/g, " "),
        subtitle: `${event.at.slice(0, 16).replace("T", " ")}${event.detail ? ` · ${event.detail}` : ""}`,
        target: { kind: "record", section: "timeline", pointer: `/${event.id}` },
      };
    }

    case "version": {
      const version = graph.versionById.get(parsed.id!);
      if (!version) return fail("No computed version with this id");
      return {
        ...base,
        ok: true,
        title: `Return version ${version.version}`,
        subtitle: `${version.computed_at.slice(0, 10)} · ${version.trigger}`,
        target: { kind: "record", section: "return_versions", pointer: `/${version.version}` },
      };
    }

    case "workpaper_record": {
      if (!lookup) {
        return fail("This reference points at a workpaper record, which was not loaded here.");
      }
      const event = lookup.event(parsed.id!);
      if (!event) return fail("No workpaper record with this id");

      const who = lookup.actorName(event.actorId);
      const when = event.at.slice(0, 10);

      if (event.type === "answer") {
        const p = event.payload as AnswerPayload;
        const said = p.onBehalfOf ?? who;
        return {
          ...base,
          ok: true,
          title: p.text,
          subtitle: `Answered by ${said} ${
            p.channel === "portal" ? "through the portal" : `by ${p.channel}`
          }, ${when}${p.onBehalfOf ? `, recorded by ${who}` : ""}`,
          target: { kind: "record", section: "workpaper", pointer: `/${event.id}` },
          value: p.text,
        };
      }

      if (event.type === "question") {
        const p = event.payload as QuestionPayload;
        return {
          ...base,
          ok: true,
          title: p.text,
          subtitle: `Asked of ${p.to === "client" ? "the client" : lookup.actorName(p.to)} by ${who}, ${when} — not yet answered`,
          target: { kind: "record", section: "workpaper", pointer: `/${event.id}` },
        };
      }

      if (event.type === "verification") {
        const p = event.payload as VerificationPayload;
        return {
          ...base,
          ok: true,
          title: p.verificationType.replace(/_/g, " "),
          subtitle: `${p.note ? `${p.note} — ` : ""}${who}, ${when}`,
          target: { kind: "record", section: "workpaper", pointer: `/${event.id}` },
        };
      }

      return {
        ...base,
        ok: true,
        title: event.type.replace(/_/g, " "),
        subtitle: `${who}, ${when}`,
        target: { kind: "record", section: "workpaper", pointer: `/${event.id}` },
      };
    }

    default:
      return fail(
        "Reference format is not one of the 11 the packet README defines, and has no alias.",
      );
  }
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return Object.keys(value as object).join(", ");
  if (typeof value === "number") return money(value);
  return String(value);
}
