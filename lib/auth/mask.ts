import type { ValueType } from "../packet/types";
import type { ActorInfo } from "../events/derive";

/**
 * Protection of sensitive data.
 *
 * `firm.starter_standards.rules`: "Staff without sensitive-data clearance see
 * SSNs, bank and account numbers and IP PINs masked; every unmasked view is
 * logged."
 *
 * Read strictly, that is two rules, and they are implemented as two. Values are
 * masked for everyone by default, so no unmasked SSN is sent to a browser that
 * did not ask for it. Revealing one is a separate request that checks clearance
 * and appends a `sensitive_view` event. The log is therefore a record of actual
 * disclosures, not of page loads.
 */
const SENSITIVE_TYPES: ReadonlySet<ValueType> = new Set(["ssn", "account_number"]);

/** Fields that carry protected data regardless of how the pipeline typed them. */
const SENSITIVE_FIELDS = /ip_?pin|routing|account_number|bank_account/i;

export function isSensitive(valueType: string, field: string): boolean {
  return SENSITIVE_TYPES.has(valueType as ValueType) || SENSITIVE_FIELDS.test(field);
}

/** Mask a value, leaving the last four characters so it can still be matched by eye. */
export function maskValue(value: string | number | boolean): string {
  const text = String(value);
  const tail = text.slice(-4);
  const head = text.slice(0, -4).replace(/[^\s-]/g, "•");
  return text.length <= 4 ? "•".repeat(text.length) : `${head}${tail}`;
}

export interface MaskedValue {
  value: string | number | boolean;
  masked: boolean;
  /** True when this actor's clearance would let them reveal it. */
  revealable: boolean;
}

export function applyMask(
  value: string | number | boolean,
  valueType: string,
  field: string,
  actor: ActorInfo,
): MaskedValue {
  if (!isSensitive(valueType, field)) {
    return { value, masked: false, revealable: false };
  }
  return {
    value: maskValue(value),
    masked: true,
    revealable: actor.sensitiveDataClearance,
  };
}
