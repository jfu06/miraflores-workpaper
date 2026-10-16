import { cookies } from "next/headers";

import { ASOF_COOKIE, parseClock, type Clock } from "./clock";

/**
 * The clock for this request, read on the server like the acting role.
 *
 * Both answer "whose view is this", and both have to be the server's decision:
 * a replay that the browser could opt out of would not be a replay.
 */
export async function getClock(): Promise<Clock> {
  const store = await cookies();
  return parseClock(store.get(ASOF_COOKIE)?.value);
}
