/**
 * Value formatting.
 *
 * Return lines hold whole dollars, except Form 8949 lots, which the README says
 * are "in cents" — read as carrying cents precision rather than being denominated
 * in cents: `F8949.A.M6` is -223.0 against a label of "proceeds 3,885.00, basis
 * 4,620.00, adjustment W 512.00", and -223 is the dollar result. Its total (212)
 * also equals `SchD.1b` (212), so the two are in the same unit. Treated as dollars
 * with decimals; flagged here because reading it the other way would be off 100x.
 */

export function formatMoney(value: number): string {
  const hasCents = !Number.isInteger(value);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** Format a return line or extracted value for display, by its own shape. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return formatMoney(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function formatConfidence(confidence: number): string {
  return confidence.toFixed(2);
}
