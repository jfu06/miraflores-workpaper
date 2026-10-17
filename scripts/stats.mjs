/**
 * The figures the write-ups quote, taken from the running application.
 *
 * Every document in this repository states counts — documents, values, checks,
 * findings, lots. They were written at different times and drifted: one of them
 * claimed 282 sales lots when the packet holds 295. This prints the numbers as
 * the code computes them now, so a claim can be checked instead of trusted.
 *
 *   npm run stats
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
const bySeverity = (s) => findings.filter((f) => f.severity === s).length;
const counts = documents.counts ?? {};
const exceptions = sales.exceptions ?? [];
const flagged = (flag) => exceptions.filter((e) => (e.flags ?? []).includes(flag)).length;

const rows = [
  ["documents", counts.total],
  ["  landed on a line", counts.landed],
  ["  reached no line", counts.notLanded],
  ["  explained by the file", (counts.notLanded ?? 0) - (counts.unexplained ?? 0)],
  ["  explained by nothing", counts.unexplained],
  ["return lines", documents.lineCount],
  ["checks", (checks.checks ?? []).length],
  ["findings", findings.length],
  ["  high / medium / low", `${bySeverity("high")} / ${bySeverity("medium")} / ${bySeverity("low")}`],
  ["sales lots", (sales.lots ?? []).length],
  ["  box totals", (sales.boxes ?? []).length],
  ["  worth a look", exceptions.length],
  ["  wash sale adjustment", flagged("wash sale adjustment")],
  ["  basis from another document", flagged("basis taken from another document")],
  ["  no basis reported", flagged("no basis reported")],
  ["  dates missing", flagged("dates missing")],
];

const width = Math.max(...rows.map(([label]) => label.length));
console.log(`figures from ${url}\n`);
for (const [label, value] of rows) console.log(`  ${label.padEnd(width)}  ${value}`);
