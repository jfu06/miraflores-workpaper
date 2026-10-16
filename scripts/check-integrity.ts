/**
 * Referential integrity: resolve every reference the packet uses against the fact
 * graph and report the ones that do not land on anything.
 *
 * This is check #9 of the planned check suite, run as a script while the UI is
 * being built. A dangling source reference on a return line means a number claims
 * an origin that does not exist, which the workpaper must be able to show.
 */
import { readFileSync } from "node:fs";

import type { Packet } from "../lib/packet/types";
import { buildGraph, resolveRef } from "../lib/graph/graph";

const packet = JSON.parse(
  readFileSync("data/okafor_lindqvist_2025_packet.json", "utf8"),
) as Packet;
const graph = buildGraph(packet);

interface Site {
  ref: string;
  where: string;
}

const sites: Site[] = [];
const add = (refs: unknown, where: string) => {
  if (!Array.isArray(refs)) return;
  for (const r of refs) if (typeof r === "string") sites.push({ ref: r, where });
};

for (const line of graph.current.lines) {
  add(line.sources, `line ${line.key} sources`);
  add(line.inputs, `line ${line.key} inputs`);
}
for (const d of graph.current.diagnostics) add(d.refs, `diagnostic ${d.code}`);
for (const e of packet.timeline) add(e.refs, `timeline ${e.id}`);
for (const a of packet.prior_years.asset_records) add(a.sources, `asset ${a.asset_id} sources`);

const failures = new Map<string, { reason: string; sites: string[] }>();
let okCount = 0;
let aliasCount = 0;

for (const site of sites) {
  const resolved = resolveRef(graph, site.ref);
  if (resolved.aliasedFrom) aliasCount += 1;
  if (resolved.ok) {
    okCount += 1;
    continue;
  }
  const entry = failures.get(site.ref);
  if (entry) entry.sites.push(site.where);
  else failures.set(site.ref, { reason: resolved.reason ?? "unknown", sites: [site.where] });
}

console.log(`resolved ${okCount} of ${sites.length} reference sites (${aliasCount} via alias)\n`);

if (failures.size === 0) {
  console.log("OK: no dangling references.");
} else {
  console.log(`DANGLING: ${failures.size} distinct references do not resolve\n`);
  for (const [ref, { reason, sites: where }] of failures) {
    console.log(`  ${ref}`);
    console.log(`    reason: ${reason}`);
    console.log(`    cited by (${where.length}): ${where.slice(0, 5).join("; ")}`);
    console.log();
  }
}
