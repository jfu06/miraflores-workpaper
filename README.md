# Workpaper — Okafor-Lindqvist 2025

A web-native tax workpaper built from the Miraflores packet. This is the Day 1
vertical slice: evidence tracing, end to end, through the real data.

```bash
npm install
npm run dev     # http://localhost:3000
```

The packet in `data/` is a byte-identical copy of the one delivered
(`sha256 ee01f850…`). Nothing pre-compiles or rewrites it; `PACKET_PATH` points
the app at a different one without a code change.

## The core idea

> A workpaper is not a spreadsheet. It is a ledger: an immutable **fact layer**
> (the packet), an append-only **event layer** (what people did), and a **view
> layer** folded from the two on demand. Any number answers two questions — which
> facts is it made of, and whose actions have touched it.

Someone handed the goals ("prove every number, show who checked it, show what is
still open") and no legacy would build a provenance graph with an event log over
it. They would not build a grid. This slice is the fact layer and the first view
of it; the event layer is next.

## Data model

**Fact graph** (`lib/graph/`) — read-only, indexed from the packet at startup.

Nodes are documents, pages, extracted values, return lines, assets, prior-year
records, client answers, agency records and engine parameters. Edges are
`sources` (a line's evidence), `inputs` (a line's arithmetic), and `supersedes`
(D31 replacing D30).

Two indexes carry most of the value because they are the reverse of what the
packet stores: `linesByEv` / `linesByDoc` answer *where did this document land*,
and `dependents` answers *what does this number feed*.

**`parseRef` / `resolveRef`** are the keystone. The packet addresses everything by
short string references in eleven formats (`ev-0035`, `D09`, `py:/basis_records/…`,
`asset:SAC-BLDG`, `ref:param.salt_cap`, `doc:D30#page32`, line keys…). One parser
and one resolver mean every click-through in the app is the same operation, and a
reference that does not resolve is reported rather than swallowed.

Verified against the data, not assumed:

- `scripts/check-refs.ts` — all **8,691** references the packet uses parse.
- `scripts/check-integrity.ts` — all **2,749** reference sites in the current
  return resolve, 6 of them through a documented alias (see F-001).
- `scripts/check-locate.ts` — **98.6%** of the 3,012 extracted values can be
  located on their own printed page.

## Simulated source documents

`lib/graph/document.ts` is the seam where real documents would replace simulated
ones. Everything above it addresses evidence as "value `ev-0035` on page 1 of
`D09`" — what a real document store would also be asked for — so swapping in
scanned PDFs means reimplementing `locatePage` against a text layer and real
bounding boxes, and no caller changes.

Two properties of the packet shaped it. `printed_content` is prose, not a verbatim
transcript, so 890 of 3,012 readings do not appear literally on their page.
`position` is synthetic, as the README says, so it cannot be used to place
highlights. Locating therefore runs a ladder of strategies and **reports which one
it used**, because "matched by amount" carries less assurance than "matched the
pipeline's reading verbatim", and "not located" means the amount is not printed on
the page at all — which, for the handwritten St. Brigid receipt, is the finding.

| strategy | share |
|---|---|
| verbatim reading | 70.0% |
| normalized value (mostly ISO vs US dates) | 23.6% |
| numeric amount | 4.2% |
| field label only | 0.7% |
| not located | 1.4% |

## What works now

Pick any of the 627 lines in the current return. The number panel shows the engine
rule in its own words, a trace tree that expands down `inputs` until it bottoms out
in evidence, every source reference resolved, what the line feeds, and any engine
diagnostic citing it. Clicking a source opens the document, rendered as a document,
with that field highlighted in place — and lists everything else read from the page
and where each value landed.

## Not built yet

The event layer and everything resting on it: verifications, review notes,
sign-offs that reopen on change, adjustments and tax effect, roles and masking,
the check suite, timeline replay, filing and amendment. See the plan.

## Findings

[FINDINGS.md](FINDINGS.md) — errors found so far, and how the design surfaced each.
Both current entries are ones the packet's own 13 engine diagnostics do not report.
