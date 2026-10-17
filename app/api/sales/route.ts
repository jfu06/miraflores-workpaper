import { NextResponse } from "next/server";

import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";
import { getClock } from "@/lib/time/server";
import { buildSales } from "@/lib/view/sales";

/** Every lot, its box totals and the ones worth looking at. */
export async function GET() {
  const graph = buildGraph(loadPacket(), await getClock());
  return NextResponse.json(buildSales(graph));
}
