/**
 * The write-ups must agree with the code, and with each other.
 *
 * Every document here quotes counts. They were written at different times, and
 * one of them drifted: a write-up claimed 282 sales lots when the packet holds
 * 295, which nobody would notice by reading. This checks two things:
 *
 *   - figures the application can compute are stated correctly, and
 *   - where several documents state the same figure, they state the same one.
 *
 *   npm run check:claims
 */

const url = (() => {
  const i = process.argv.indexOf("--url");
  return (i > -1 ? process.argv[i + 1] : "http://localhost:3100").replace(/\/$/, "");
})();

const get = async (path) => {
  const res = await fetch(url + path);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
};

const [checks, documents, sales] = await Promise.all([
  get("/api/checks"),
  get("/api/documents"),
  get("/api/sales"),
]);

const findings = checks.findings ?? [];
const severity = (s) => findings.filter((f) => f.severity === s).length;
const flagged = (flag) => (sales.exceptions ?? []).filter((e) => (e.flags ?? []).includes(flag)).length;
const group = (n) => n.toLocaleString("en-US");

/**
 * What the application says, and where a document would be saying it.
 *
 * Each pattern captures the number in its context, so every place a document
 * states the figure is checked — not only the places that already state it
 * correctly. Matching on the correct value alone would be circular: a document
 * that dropped the right number would simply stop matching.
 *
 * Figures spelled out in words ("Seventy-four documents") are left to the
 * cross-document rule below; they cannot drift by a digit.
 */
const FIGURES = [
  { what: "documents in the file", value: documents.counts.total,
    patterns: [/across ([\d,]+) documents/g, /([\d,]+) documents in the file/g] },
  { what: "documents that land on a line", value: documents.counts.landed,
    patterns: [/([\d,]+) land on a line/g, /Landed ([\d,]+)/g] },
  { what: "documents reaching no line", value: documents.counts.notLanded,
    patterns: [/Reached no line ([\d,]+)/g] },
  { what: "documents explained by nothing", value: documents.counts.unexplained,
    patterns: [/Unexplained ([\d,]+)/g] },
  { what: "lines in the return", value: documents.lineCount,
    patterns: [/([\d,]+) lines in the return/g, /([\d,]+) lines frozen/g] },
  { what: "checks", value: (checks.checks ?? []).length,
    patterns: [/([\d,]+) checks\b/g] },
  { what: "findings", value: findings.length,
    patterns: [/([\d,]+) findings\b/g] },
  { what: "high findings", value: severity("high"), patterns: [/([\d,]+) high\b/g] },
  { what: "medium findings", value: severity("medium"), patterns: [/([\d,]+) medium\b/g] },
  { what: "low findings", value: severity("low"), patterns: [/([\d,]+) low\b/g] },
  { what: "sales lots", value: (sales.lots ?? []).length,
    patterns: [/([\d,]+) sales? lots/g, /([\d,]+) lots, without reading/g] },
  { what: "lots worth a look", value: (sales.exceptions ?? []).length,
    patterns: [
      /([\d,]+) lots worth a look/g,
      /the ([\d,]+) lots something is unusual about/g,
      /([\d,]+) lots worth a look/g,
    ] },
  { what: "wash sales", value: flagged("wash sale adjustment"),
    patterns: [/([\d,]+) wash sales/g] },
  { what: "lots with basis from another document", value: flagged("basis taken from another document"),
    patterns: [/([\d,]+) whose\s+basis/g, /([\d,]+) whose basis/g] },
  { what: "lots with no basis", value: flagged("no basis reported"),
    patterns: [/([\d,]+) with no basis/g] },
];

const DOCS = [
  "README.md",
  "CORE-IDEA.md",
  "FINDINGS.md",
  "SUBMISSION.md",
  "DEPLOY.md",
];

const { readFileSync, existsSync } = await import("node:fs");

/**
 * How many fail-closed tests there are. This is a figure the write-ups quote and
 * the application cannot compute, so it is counted from the suite itself —
 * adding a test and leaving the prose at the old number is exactly the drift
 * this file exists to catch.
 */
const testCount = (readFileSync("scripts/fail-closed.mjs", "utf8").match(/^await check\(/gm) ?? []).length;
const SPELLED = ["zero","one","two","three","four","five","six","seven","eight","nine","ten",
  "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty",
  "twenty-one","twenty-two","twenty-three","twenty-four","twenty-five"];
const text = new Map(DOCS.filter(existsSync).map((f) => [f, readFileSync(f, "utf8")]));

const problems = [];

const digitsOf = (n) => new Set([String(n), group(n)]);

FIGURES.push({
  what: "fail-closed tests",
  value: testCount,
  patterns: [/([\d,]+) tests assert/g],
});

/** The same figure, spelled out, as the prose prefers. */
for (const [file, body] of text) {
  const m = body.match(/\b([a-z-]+) tests assert/i);
  if (m && SPELLED.includes(m[1].toLowerCase()) && SPELLED.indexOf(m[1].toLowerCase()) !== testCount) {
    problems.push(`${file}: says "${m[1]} tests assert", but the suite has ${testCount}`);
  }
}

for (const { what, value, patterns } of FIGURES) {
  const ok = digitsOf(value);
  for (const [file, body] of text) {
    for (const pattern of patterns) {
      for (const match of body.matchAll(pattern)) {
        const stated = match[1];
        if (!ok.has(stated)) {
          problems.push(`${file}: "${match[0].trim()}" — ${what} is ${group(value)}`);
        }
      }
    }
  }
}

/**
 * Cross-document: where several write-ups quote the same figure, they must
 * quote the same one.
 *
 * A document may also state a figure it has since corrected — FINDINGS.md
 * records that the locate rate moved from an overstated 98.6% to 98.4%, and
 * both numbers belong there. So the rule is that a document which states this
 * kind of figure must state the agreed one *somewhere*, not that every number
 * it prints agrees.
 */
const SHARED = [
  { what: "references the packet uses", re: /([\d,]+) references the packet uses/g },
  { what: "reference sites in the current return", re: /([\d,]+) reference sites/g },
  { what: "locate rate", re: /(\d\d\.\d)\s*(?:%|percent)/g },
];
for (const { what, re } of SHARED) {
  const stated = new Map();
  for (const [file, body] of text) {
    const found = [...body.matchAll(re)].map((m) => m[1]);
    if (found.length > 0) stated.set(file, found);
  }
  if (stated.size < 2) continue;

  // The agreed figure is the one the most documents state.
  const tally = new Map();
  for (const found of stated.values()) {
    for (const v of new Set(found)) tally.set(v, (tally.get(v) ?? 0) + 1);
  }
  const agreed = [...tally].sort((a, b) => b[1] - a[1])[0][0];
  for (const [file, found] of stated) {
    if (!found.includes(agreed)) {
      problems.push(
        `${file}: states ${what} as ${[...new Set(found)].join(" and ")}, but ${agreed} is what the others say`,
      );
    }
  }
}

console.log(`claims checked against ${url}\n`);
for (const { what, value } of FIGURES) console.log(`  ${String(value).padStart(5)}  ${what}`);

if (problems.length > 0) {
  console.log(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log(`\nAll ${text.size} write-ups agree with the application and with each other.`);
