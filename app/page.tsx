import { buildGraph } from "@/lib/graph/graph";
import { loadPacket } from "@/lib/packet/load";
import { getClock } from "@/lib/time/server";
import { buildOutline } from "@/lib/view/models";
import { Workpaper, type WorkpaperMeta } from "@/components/Workpaper";

/**
 * The packet is read and indexed on the server; the browser receives the outline
 * and fetches detail per click. Nothing pre-computes or rewrites the packet, so
 * pointing `PACKET_PATH` at a different one is the only change needed to load it.
 */
export default async function Page() {
  const packet = loadPacket();
  const clock = await getClock();
  const graph = buildGraph(packet, clock);
  const current = graph.current;

  const meta: WorkpaperMeta = {
    client: packet.household.people
      .filter((p) => p.role === "taxpayer" || p.role === "spouse")
      .map((p) => p.name)
      .join(" and "),
    taxYear: packet.household.tax_year,
    filingStatus: packet.household.filing_status,
    version: current.version,
    computedAt: current.computed_at,
    trigger: current.trigger,
    federalBalance: current.summary.federal.balance_due,
    californiaBalance: current.summary.california.balance_due,
    documents: graph.documents.length,
    extractedValues: graph.documents.reduce((n, d) => n + (graph.evsByDoc.get(d.id)?.length ?? 0), 0),
    lines: current.lines.length,
    warnings: current.diagnostics.filter((d) => d.severity === "warning").length,
  };

  return <Workpaper meta={meta} outline={buildOutline(graph)} clock={clock} />;
}
