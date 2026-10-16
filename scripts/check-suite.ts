/**
 * Run the check suite against the packet and print what it finds.
 *
 * The point of running it as a script is that the findings are reproducible and
 * reviewable outside the UI — the errors reported in FINDINGS.md are this
 * output, not a separate list maintained by hand.
 */
import { readFileSync } from "node:fs";

import { buildGraph } from "../lib/graph/graph";
import type { Packet } from "../lib/packet/types";
import { allFindings, runChecks } from "../lib/checks/run";

const packet = JSON.parse(
  readFileSync("data/okafor_lindqvist_2025_packet.json", "utf8"),
) as Packet;
const graph = buildGraph(packet);
const results = runChecks(graph, new Set());

const findings = allFindings(results);
const bySeverity = { high: 0, medium: 0, low: 0 };
for (const f of findings) bySeverity[f.severity] += 1;

console.log(
  `${CHECK_COUNT(results)} checks, ${findings.length} findings — ` +
    `${bySeverity.high} high, ${bySeverity.medium} medium, ${bySeverity.low} low\n`,
);

function CHECK_COUNT(r: typeof results) {
  return r.length;
}

for (const { check, findings: group } of results) {
  console.log(`${check.id.padEnd(24)} ${String(group.length).padStart(3)}  ${check.title}`);
}

console.log("\n" + "=".repeat(78));
console.log("HIGH SEVERITY");
console.log("=".repeat(78));

for (const f of findings.filter((x) => x.severity === "high")) {
  console.log(`\n[${f.checkId}] ${f.title}`);
  console.log(`  ${f.detail}`);
  console.log(`  refs: ${f.refs.slice(0, 6).join(", ")}`);
  if (f.amount !== undefined) console.log(`  amount: ${f.amount.toLocaleString("en-US")}`);
}
