import { NextResponse } from "next/server";

import { summarizeAll } from "@/lib/events/summary";

/** Per-scope work counts, for marking the outline without loading every scope. */
export async function GET() {
  return NextResponse.json({ summaries: summarizeAll() });
}
