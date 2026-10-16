# Workpaper — Okafor-Lindqvist 2025

A web-native tax workpaper built from the Miraflores packet.

```bash
npm install
npm run dev        # http://localhost:3000
npm run checks     # 18 checks, 108 findings
npm run verify     # every claim in this repo, re-run
```

The packet in `data/` is a byte-identical copy of the one delivered
(`sha256 ee01f850…`). Nothing pre-compiles or rewrites it; `PACKET_PATH` points
the app at a different one without a code change.

## What to read

| | |
|---|---|
| **[CORE-IDEA.md](CORE-IDEA.md)** | One page: the core idea and the data model |
| **[FINDINGS.md](FINDINGS.md)** | The errors found, and how the design surfaced them |
| **[VIDEO.md](VIDEO.md)** | Walkthrough outline |

Nine errors are written up, all of them things the engine's own diagnostics do
not report, and **both items the IRS is examining in the 2028 letter have
findings**. None was written by hand — the checks found them, and one of those
checks exists because the letter says to look.

The rest of this file is the detail behind the one-pager.

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

The fact layer is read-only and indexed from the packet. The event layer is the
only thing that ever changes, and it only ever grows.

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
- `scripts/check-locate.ts` — **98.4%** of the 3,012 extracted values can be
  located on their own printed page.

**Event layer** (`lib/events/`) — append-only, in SQLite via Node's built-in
`node:sqlite`, so the store adds no dependency.

Append-only is enforced by the database, not by convention: triggers abort any
UPDATE or DELETE on the events table. Undo is therefore not a delete — reverting
appends a `revert` event naming what it withdraws, and the fold ignores both. The
withdrawn entry stays on the record, which is the point when an examiner reads
this in 2028.

That one decision covers four requirements without a mechanism each: keep the
original when something is adjusted, show what changed since you last looked, undo
in bulk, and freeze at filing with amendments on top.

### Sign-offs that reopen

A sign-off stores a **hash of what it covered**: the line's value and rule, every
line it is built from transitively, the extracted values underneath, and the
verifications and review notes standing at the time. Nothing has to be told that a
change happened — if the recomputed hash differs, the signature has reopened.
A change nobody anticipated still invalidates it, because the mechanism does not
depend on anticipating it.

The covered facts are stored, not only hashed, so a reopened sign-off names the
lines and values that moved rather than only reporting that something did.

One judgment is worth stating: facts are hashed transitively, work is not. A
sign-off attests to this number and the work done on it. If a verification is
withdrawn two lines upstream but no number moves, what was signed is still true;
if a number does move, the fact half catches it.

### Prior-year comparison

The firm's own standard is read from the packet, not hard-coded: flag a change
over 10 percent **and** over 1,000, both conditions as written. The comparison is
driven by the 2024 line set — 106 key lines against this year's 627 — because
"new in 2025" would otherwise be an artifact of granularity and would bury the
signal.

Two things it refuses to do, and both matter more than what it computes:

**It does not map Form 540 to Form 540NR.** The household moved in July, so last
year's full-year California return and this year's part-year return share no line
numbers. Deciding that `CA540.17` corresponds to some line on Schedule CA (540NR)
is a tax judgment. Nineteen prior lines are reported as unmatched, with the reason
derived from the residency records, and a person explains them.

**It does not subtract across different subjects.** `R-INTEREST-PAYER` emits one
Schedule B line per interest payer, so a line key is a position, not an identity:
the household had four payers in 2024 and eight in 2025, and `SchB.1.3` names
Sacramento Valley Bank one year and Meridian Brokerage the next. Lines whose two
labels name entirely different proper nouns are marked **not comparable** and given
no percentage. Without that check the workpaper would have produced three
confident, entirely false variances (see F-004).

"Prior-year variances explained" is one of the firm's twelve required steps, so an
explanation is a recorded event with an author and a time, not a comment.

### Roles, masking and the view log

The acting role lives in a server-side cookie, not in the browser. That is what
makes the rest real: a role switcher that only hides values in the UI has still
shipped them, and anyone can read them.

`firm.starter_standards` is enforced rather than displayed. A preparer cannot also
sign as reviewer; reviewer sign-off requires preparer sign-off first; an open
blocking review note stops any sign-off; withdrawing someone else's entry is a
reviewer action.

Sensitive values are masked **for everyone** by default — in the value list and in
the rendered page text, since a highlighted span holds the same digits the field
does. Revealing one is a separate request that checks clearance and appends a
`sensitive_view` event before returning the value, so the log records actual
disclosures rather than page loads.

### Checks that do not trust the engine

Eighteen checks run against the packet. Each declares what it recomputes or
cross-reads for itself, and the app shows that sentence next to every finding, so
"we checked this" is a claim a reviewer can inspect rather than take on faith.

```bash
npm run checks     # 18 checks, 108 findings — 17 high, 57 medium, 34 low
```

They never read the event log. A finding cannot be made to disappear by doing
work around it: it is dismissed explicitly, with a reason and an author, and the
check still runs and still reports. Finding ids are stable across runs so a
dismissal recorded today still applies after the next run.

The engine's own diagnostics are treated as an input, not a verdict — one check
re-tests the condition each of them asserts. It currently reports nothing, which
is the right answer: v3 dropped the two diagnostics v1 and v2 carried, once the
late K-1s arrived.

A finding closes in one of two ways, and the difference is kept. **Dismissed**
means someone argued it away, with a reason and an author. **Addressed** means
the figure was changed to what the other record holds — the check goes on
reporting, because the engine's return still says what it said, but the item is
closed and the required step it feeds ticks itself.

Two findings converge from opposite directions and are worth the example. The
tie-out check adds the Meridian lots itself and reports the summary 250 adrift;
the unread-page check reads page 32 and finds a single lot with proceeds of
250.00. They share no code. See [FINDINGS.md](FINDINGS.md).

### Questions that become evidence

The brief asks for "questions to the client or colleagues that become evidence",
and the second half is the part that needs a design decision rather than a form.

A question is raised against the thing it is about — a line, a document, a
finding — so it travels with that item instead of living in an inbox beside it.
When the answer arrives it is recorded with **how it arrived**, because "the
client confirmed by phone" and "the client uploaded a statement" are not the same
assurance, and with **whose answer it is**, which is not always who typed it.

Then the answer gets a reference in the same grammar as everything else —
`wp:<id>` beside `ev-0035` and `qa-14` — and can be attached to the line, where
it resolves and opens like any other source. `resolveRef` learned one more kind;
nothing else changed.

Attached evidence is shown **apart from** the engine's own sources, under "added
in review". Both are evidence, but conflating them would hide which part of a
number's support the engine never saw.

The packet is full of answers that arrived this way and were never recorded as
evidence of anything: `msg-08` resolves the handwritten receipt whose first digit
is ambiguous, `msg-07` supplies the cost of the crypto lot the engine gave a zero
basis. Those are the shape this models.

### Adjusting, and the four kinds of number

The engine cannot be rerun, and the packet offers per-dollar rates instead. That
makes the central design question honest bookkeeping: every number in an adjusted
return is one of four things, and the workpaper says which beside the figure.

| | |
|---|---|
| **engine** | the figure the engine published, untouched |
| **manual** | set by a person, with a reason, over the engine's figure |
| **recomputed** | derived from the adjusted inputs by arithmetic recovered from the engine's own numbers and verified against them — exact |
| **estimated** | not derivable here; approximated from the packet's per-dollar rates, measured at this version's numbers |

The recomputation is not assumed. For each line that is pure arithmetic over other
lines, the combination that reproduces the engine's published value is **solved
for and verified against it**: 128 lines, all 128 reproducing exactly, 19 of them
by subtraction rather than addition — `R-SUM` is documented as "arithmetic
combination", not a sum, so assuming would have been wrong both ways.

Five lines resist, and they are reported rather than guessed at (see F-007).
Propagation **stops** at them: beyond a line whose arithmetic cannot be recovered
the figures are unknown, not approximately known, and nothing downstream is
restated.

Where a change does reach a balance, the recomputed figure is the answer and the
rate estimate is superseded — kept only as the measure the firm's partner
threshold was applied to. The two are never shown as though they were two
readings of the same thing.

The firm's rule that an adjustment over 1,000 of effect needs partner sign-off is
enforced by holding such an adjustment as **proposed**: it shows its effect but
does not move the return until a partner who did not propose it approves.

Findings whose right answer is a fact in another record carry the figure, so they
can be applied rather than retyped — and applied together, under one group id,
undone by one action that appends compensating events rather than deleting
anything.

### Filing, and after

**Replay.** The file has no single present: the timeline runs from an engagement
letter in January 2026 to an examination letter in January 2028. So the clock is
a position, and moving it shows the file as it stood — the version the engine had
produced, the documents that had arrived, the work that had been recorded. At
2026-03-10 the federal AGI reads 428,023 and 64 documents are in the file; at
2026-03-20, 429,820 and 66; live, 445,590 and 74. Replay is **read-only**, because
recording work against a past view would be writing history rather than replaying
it. Before the first engine run it says so rather than showing figures that did
not exist yet.

**Freeze and amend.** Filing appends a snapshot of all 627 lines with a hash of
them. After that an adjustment is refused until an amendment is opened; the filed
return stays as transmitted and the amendment sits on top. Neither needed a new
mechanism — the snapshot is an event, and "the amendment layer" is just the
adjustments that come after it.

**Answering a notice.** The 2028 Letter 566 examines two items. The record
assembles from the file: the figure as filed, the document and page behind each
component, the field and what was printed there, who verified it and how, what the
client was asked and answered, who signed — **and what the firm's own checks say,
including where they disagree with the return.** It exports as JSON and is
readable without this system, which is what self-contained has to mean two years
later.

That last part is the one worth arguing about, and the answer is that an examiner
will find the 1099-K double count whether or not the record mentions it. A record
that hides it is worth less than one that explains it.

**Rolling forward.** Carryovers arrive next year with the line they came out of,
the basis records arrive with their gaps intact, and so does everything still
open — an unanswered question does not close because the year ended.

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
| verbatim reading | 66.5% |
| normalized value (mostly ISO vs US dates) | 23.6% |
| numeric amount | 7.4% |
| field label only | 0.8% |
| not located | 1.6% |

## What works now

Pick any of the 627 lines in the current return. The number panel shows the engine
rule in its own words, a trace tree that expands down `inputs` until it bottoms out
in evidence, every source reference resolved, what the line feeds, and any engine
diagnostic citing it. Clicking a source opens the document, rendered as a document,
with that field highlighted in place — and lists everything else read from the page
and where each value landed.

Below that, the work on the line: record a verification against one of the firm's
five types, raise a question with the client or a colleague and attach the answer
as evidence, raise a review note that blocks filing, resolve or withdraw any of
them, and sign off at preparer, reviewer or partner level. Raise a blocking note on a signed
line and both signatures reopen in place, saying what changed. Withdraw the note
and they come back, because the hash returns to what it was — while all five events
stay in the history, two of them struck through.

Switch to Marcus Bell, who has no clearance, and the SSNs mask in the page itself.

With no line selected, the middle pane is the overview a reviewer opens the file
for: this return against last year for both jurisdictions, with a caveat marked
where the two years are not measured on the same basis; the state of each review
area against the firm's budget; every flagged variance, with the not-comparable
and unmatched ones called out ahead of the swings; and open items — the check
findings, the firm's twelve required steps, and the engine's diagnostics in one
list. Ten of the twelve steps are derived — from the checks, the documents in the
file, and the sign-offs on the return — so a step cannot be marked done while the
thing it asserts is untrue, and each links to what it was derived from. The two
that stay manual are a human act of review and a client act that belongs to the
filing timeline.

## Not built yet

Timeline replay, filing and the freeze, amendment, the notice record, and the
client-facing views. See the plan.

## Findings

[FINDINGS.md](FINDINGS.md) — errors found so far, and how the design surfaced each.
Both current entries are ones the packet's own 13 engine diagnostics do not report.
