/**
 * Verification for `parseRef`: collect every reference string the packet actually
 * uses, and assert the parser recognizes all of them.
 *
 * This exists because "handles all 11 documented formats" is a claim about the
 * data, not about the code. Run it after any change to the reference grammar.
 */
import { readFileSync } from "node:fs";

import { parseRef, type RefKind } from "../lib/graph/refs";

interface Found {
  ref: string;
  where: string;
}

const packet = JSON.parse(readFileSync("data/okafor_lindqvist_2025_packet.json", "utf8"));

const found: Found[] = [];

function addAll(refs: unknown, where: string) {
  if (!Array.isArray(refs)) return;
  for (const r of refs) if (typeof r === "string") found.push({ ref: r, where });
}

for (const version of packet.return_versions) {
  for (const line of version.lines) {
    addAll(line.sources, `${version.version} lines[].sources`);
    addAll(line.inputs, `${version.version} lines[].inputs`);
  }
  for (const d of version.diagnostics) addAll(d.refs, `${version.version} diagnostics[].refs`);
  for (const c of version.changes_from_previous) {
    found.push({ ref: c.key, where: `${version.version} changes_from_previous[].key` });
  }
  addAll(version.documents_used, `${version.version} documents_used`);
  addAll(version.documents_superseded, `${version.version} documents_superseded`);
}

for (const event of packet.timeline) addAll(event.refs, "timeline[].refs");
for (const asset of packet.prior_years.asset_records) addAll(asset.sources, "asset_records[].sources");

const lineSources = packet.prior_years.return_2024.line_sources ?? {};
for (const [key, value] of Object.entries(lineSources)) {
  addAll(value, `prior_years.return_2024.line_sources.${key}`);
}

for (const alt of packet.what_if.alternatives ?? []) {
  for (const c of alt.changed_lines ?? []) {
    found.push({ ref: c.key, where: `what_if.${alt.id}.changed_lines[].key` });
  }
}

// Report
const byKind = new Map<RefKind, number>();
const unknown: Found[] = [];

for (const f of found) {
  const parsed = parseRef(f.ref);
  byKind.set(parsed.kind, (byKind.get(parsed.kind) ?? 0) + 1);
  if (parsed.kind === "unknown") unknown.push(f);
}

const distinct = new Set(found.map((f) => f.ref));
console.log(`references found: ${found.length} (${distinct.size} distinct)\n`);

console.log("by kind:");
for (const [kind, count] of [...byKind].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(kind).padEnd(18)} ${count}`);
}

if (unknown.length === 0) {
  console.log("\nOK: every reference in the packet parses.");
} else {
  const distinctUnknown = new Map<string, string>();
  for (const u of unknown) if (!distinctUnknown.has(u.ref)) distinctUnknown.set(u.ref, u.where);
  console.log(`\nUNPARSED: ${unknown.length} (${distinctUnknown.size} distinct)`);
  for (const [ref, where] of [...distinctUnknown].slice(0, 40)) {
    console.log(`  ${JSON.stringify(ref).padEnd(30)} from ${where}`);
  }
  process.exitCode = 1;
}
