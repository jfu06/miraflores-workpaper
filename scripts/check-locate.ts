/**
 * Measure the highlight locator over the whole packet.
 *
 * The claim the workpaper makes is "we show you the exact field on the source
 * page". This reports how often that is true and by which strategy, so the claim
 * can be stated with a number instead of asserted.
 */
import { readFileSync } from "node:fs";

import type { Packet } from "../lib/packet/types";
import { buildGraph } from "../lib/graph/graph";
import { locatePage, type LocateMethod } from "../lib/graph/document";

const packet = JSON.parse(
  readFileSync("data/okafor_lindqvist_2025_packet.json", "utf8"),
) as Packet;
const graph = buildGraph(packet);

const counts: Record<LocateMethod, number> = {
  text_as_read: 0,
  normalized_value: 0,
  value: 0,
  field_label: 0,
  none: 0,
};
const unlocatedByDoc = new Map<string, number>();

for (const doc of packet.documents) {
  for (const page of doc.pages) {
    const values = graph.evsByDocPage.get(`${doc.id}#${page.page}`) ?? [];
    if (values.length === 0) continue;
    for (const located of locatePage(page.printed_content, values)) {
      counts[located.method] += 1;
      if (located.method === "none") {
        unlocatedByDoc.set(doc.id, (unlocatedByDoc.get(doc.id) ?? 0) + 1);
      }
    }
  }
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

console.log(`located ${total} extracted values across ${packet.documents.length} documents\n`);
for (const method of ["text_as_read", "normalized_value", "value", "field_label", "none"] as LocateMethod[]) {
  console.log(`  ${method.padEnd(14)} ${String(counts[method]).padStart(5)}  ${pct(counts[method])}`);
}

const locatable = total - counts.none;
console.log(`\n  locatable      ${locatable} / ${total}  ${pct(locatable)}`);

if (unlocatedByDoc.size > 0) {
  console.log("\nnot locatable, by document:");
  for (const [docId, n] of [...unlocatedByDoc].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    const doc = graph.docById.get(docId)!;
    console.log(`  ${docId}  ${String(n).padStart(4)}  ${doc.document_type} — ${doc.title.slice(0, 48)}`);
  }
}
