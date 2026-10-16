/**
 * Where "now" is.
 *
 * The packet's timeline runs from the engagement letter in January 2026 to an
 * examination letter in January 2028, and the README says v3 is the current
 * return while the later events are "scripted for replay". So the file has no
 * single present: it has a position, and the workpaper has to say which one it
 * is showing.
 *
 * Two modes, and the difference is strict:
 *
 *   - **live** — no position set. Everything in the file is in view and work can
 *     be done.
 *   - **replay** — a position is set. The file is shown as it stood at that
 *     moment: the version the engine had produced, the documents that had
 *     arrived, the staff who had joined, the work that had been recorded. It is
 *     **read-only**, because recording work at a past moment would be writing
 *     history rather than replaying it.
 */

export const ASOF_COOKIE = "workpaper_asof";

export interface Clock {
  /** ISO instant the file is being shown as of; undefined in live mode. */
  asOf?: string;
  /** True when no position is set and the whole file is in view. */
  live: boolean;
}

export function parseClock(value: string | undefined): Clock {
  if (!value) return { live: true };
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return { live: true };
  return { asOf: at.toISOString(), live: false };
}

/** Whether something that happened at `at` is visible under this clock. */
export function visibleAt(clock: Clock, at: string | undefined): boolean {
  if (clock.live || !clock.asOf) return true;
  if (!at) return true;
  return at <= clock.asOf;
}
