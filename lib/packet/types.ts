/**
 * Types for the Miraflores 2025 packet.
 *
 * Field names and shapes follow the packet's own README section definitions.
 * Anything this slice does not read yet is left as `unknown` rather than guessed,
 * so a wrong assumption fails at the type level instead of silently at runtime.
 */

export type Jurisdiction = "federal" | "california";

export type ValueType =
  | "money"
  | "date"
  | "text"
  | "integer"
  | "quantity"
  | "percent"
  | "boolean"
  | "code"
  | "ssn"
  | "ein"
  | "account_number";

export type ExtractionStatus = "extracted" | "partial" | "not_extracted";

export type Severity = "info" | "warning";

export interface PacketMeta {
  name: string;
  version: string;
  generated: string;
  client_id: string;
}

export interface Person {
  id: string;
  role: string;
  name: string;
  ssn?: string;
  dob?: string;
  relationship?: string;
  months_lived_with_you?: number;
  full_time_student?: boolean;
  ip_pin?: string;
  contact?: string;
}

export interface Household {
  filing_status: string;
  tax_year: number;
  entered_by: string;
  people: Person[];
  addresses: unknown[];
  residency: unknown[];
  bank_account_for_refund_or_payment: Record<string, string>;
  prior_year_agi_for_esignature: number;
  related_returns: unknown[];
}

export interface DocumentPage {
  page: number;
  printed_content: string;
}

export interface PacketDocument {
  id: string;
  title: string;
  document_type: string;
  issuer: string;
  belongs_to: string;
  tax_year: number;
  received_at: string;
  uploaded_by: "client" | "firm";
  file_name: string;
  page_count: number;
  pages: DocumentPage[];
  marked_corrected?: boolean;
  extraction: {
    status: ExtractionStatus;
    values: number;
    reason: string | null;
  };
}

export interface Position {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ExtractedValue {
  id: string;
  document_id: string;
  page: number;
  field: string;
  label: string;
  value: string | number | boolean;
  value_type: ValueType;
  text_as_read: string;
  position: Position;
  confidence: number;
}

export interface ReturnLine {
  key: string;
  jurisdiction: Jurisdiction;
  form: string;
  line: string;
  label: string;
  value: string | number;
  rule: string;
  inputs: string[];
  sources: string[];
  note?: string;
}

export interface Diagnostic {
  code: string;
  severity: Severity;
  message: string;
  refs: string[];
}

export interface LineChange {
  key: string;
  change: "added" | "changed" | "removed";
  old?: string | number;
  new?: string | number;
}

export interface TaxEffectRate {
  federal_per_dollar: number;
  california_per_dollar: number;
}

export interface VersionAsset {
  asset_id: string;
  description?: string;
  [k: string]: unknown;
}

export interface ReturnVersion {
  version: string;
  computed_at: string;
  trigger: string;
  documents_used: string[];
  documents_superseded: string[];
  summary: Record<Jurisdiction, Record<string, number>>;
  tax_effect_rates: Record<string, TaxEffectRate>;
  carryovers_out: Record<string, unknown>;
  assets: VersionAsset[];
  diagnostics: Diagnostic[];
  changes_from_previous: LineChange[];
  lines: ReturnLine[];
}

export interface QuestionnaireItem {
  id: string;
  question: string;
  answer: string;
  answered_by: string;
  answered_at: string;
}

export interface ClientMessage {
  id: string;
  sent_at: string;
  from: string;
  to: string;
  text: string;
}

export interface CallNote {
  id: string;
  date: string;
  participants: string[];
  notes: string[];
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  credential: string | null;
  sensitive_data_clearance: boolean;
  active_from: string;
  note?: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  event: string;
  actor: string | null;
  detail: string | null;
  refs: string[];
}

export interface PriorYearAsset {
  asset_id: string;
  description: string;
  activity: string;
  cost: number;
  land_value?: number;
  placed_in_service: string;
  method: string;
  life_years: number;
  disposed?: unknown;
  federal: Record<string, number>;
  california: Record<string, number>;
  amt_difference?: unknown;
  sources: string[];
}

export interface Packet {
  packet: PacketMeta;
  readme: Record<string, unknown>;
  household: Household;
  documents: PacketDocument[];
  extracted_values: ExtractedValue[];
  client: {
    questionnaire: QuestionnaireItem[];
    messages: ClientMessage[];
    call_notes: CallNote[];
  };
  firm: {
    name: string;
    staff: StaffMember[];
    firm_identity: Record<string, unknown>;
    client_users: { id: string; name: string; role: string }[];
    assignment_at_start: Record<string, string>;
    deadlines: { what: string; date: string }[];
    budget_hours: Record<string, number>;
    starter_standards: Record<string, unknown>;
  };
  prior_years: {
    return_2024: Record<string, unknown>;
    prior_preparer_workpaper: Record<string, unknown>;
    asset_records: PriorYearAsset[];
    basis_records: Record<string, unknown>;
    carryovers_into_2025: Record<string, unknown>;
  };
  tax_agency_records: Record<string, unknown>;
  timeline: TimelineEvent[];
  engine_reference: {
    parameters: Record<string, unknown>;
    rules: Record<string, string>;
  };
  return_versions: ReturnVersion[];
  what_if: Record<string, unknown>;
  planning_reference_2026: Record<string, unknown>;
  post_filing_rates: Record<string, unknown>;
  fx_rates: Record<string, unknown>;
}
