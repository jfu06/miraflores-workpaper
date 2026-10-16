/**
 * Verify the recompute engine against the engine's own output.
 *
 * Two things are tested: that the recovered arithmetic reproduces every
 * combination line the engine published, and that an adjustment propagates the
 * way the dependency graph says it should, stopping where it must.
 */
import { readFileSync } from "node:fs";

import { buildGraph } from "../lib/graph/graph";
import type { Packet } from "../lib/packet/types";
import { applyForm } from "../lib/adjust/arithmetic";
import { buildFormIndex, recompute } from "../lib/adjust/recompute";
import { computeEffect, defaultCategory, requiresPartnerSignoff } from "../lib/adjust/effect";

const packet = JSON.parse(readFileSync("data/okafor_lindqvist_2025_packet.json", "utf8")) as Packet;
const graph = buildGraph(packet);
const forms = buildFormIndex(graph);

const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

console.log(`arithmetic recovered for ${forms.forms.size} lines; ${forms.unsolved.size} could not be solved\n`);

// 1. Every solved form must reproduce the engine's published value exactly.
let reproduced = 0;
const broken: string[] = [];
for (const [key, form] of forms.forms) {
  const line = graph.lineByKey.get(key)!;
  const inputs = line.inputs.map((k) => {
    const v = graph.lineByKey.get(k)?.value;
    return typeof v === "number" ? v : 0;
  });
  if (Math.abs(applyForm(form, inputs) - (line.value as number)) < 0.51) reproduced += 1;
  else broken.push(key);
}
console.log(`  ${reproduced}/${forms.forms.size} reproduce the published value exactly`);
if (broken.length > 0) console.log(`  BROKEN: ${broken.join(", ")}`);

const mixed = [...forms.forms.entries()].filter(([, f]) => !f.pureSum);
console.log(`  ${mixed.length} involve subtraction, not addition`);

console.log("\n  lines whose declared inputs cannot produce their value:");
for (const [key, info] of forms.unsolved) {
  const line = graph.lineByKey.get(key)!;
  console.log(
    `    ${key.padEnd(20)} ${money(line.value as number).padStart(10)}  inputs ${line.inputs.join(
      ", ",
    )}  short by ${info.shortfall === undefined ? "?" : money(info.shortfall)}`,
  );
}

// 2. Propagate the agency reconciliation finding: federal estimated payments
//    claimed 13,000, the IRS transcript posts 12,000.
console.log("\n" + "=".repeat(78));
console.log("adjust F1040.26 from 13,000 to 12,000 (the IRS-posted figure)");
console.log("=".repeat(78));

const result = recompute(
  graph,
  [
    {
      eventId: "test",
      lineKey: "F1040.26",
      from: 13000,
      to: 12000,
      reason: "Agreed to the IRS account transcript.",
    },
  ],
  forms,
);

for (const line of result.lines.values()) {
  const l = graph.lineByKey.get(line.key)!;
  console.log(
    `  ${line.provenance.padEnd(11)} ${line.key.padEnd(14)} ${money(line.original).padStart(10)} -> ${money(
      line.value,
    ).padStart(10)}   ${l.label.slice(0, 44)}`,
  );
}
if (result.barriers.length > 0) {
  console.log("\n  stopped at:");
  for (const b of result.barriers) console.log(`    ${b.key}: ${b.reason}`);
}
if (result.unknownBeyond.length > 0) {
  console.log(`\n  unknown beyond the barrier: ${result.unknownBeyond.join(", ")}`);
}

const line = graph.lineByKey.get("F1040.26")!;
const category = defaultCategory(line);
console.log(`\n  default category: ${category}`);
if (category) {
  const effect = computeEffect(graph, -1000, category);
  console.log(
    `  effect of -1,000: federal ${money(effect.federal)}, California ${money(
      effect.california,
    )} (${effect.basis})`,
  );
  console.log(`  partner sign-off required: ${requiresPartnerSignoff(effect)}`);
  for (const c of effect.caveats) console.log(`    caveat: ${c}`);
}
