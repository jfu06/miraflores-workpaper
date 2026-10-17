# Walkthrough outline

Target **12 minutes**; the cut points marked ✂ take it to 8 if needed. Record at
1440 wide or more — the app is a three-pane review surface and needs the width.

**Before recording:**

```bash
npm run seed -- --no-file     # the worked file, stopping short of filing
```

`--no-file` matters: the seed otherwise files and opens the amendment, and §9:30
wants the freeze to happen on camera. Have `npm run checks` output in a second
terminal.

To start over, point `EVENTS_DB_PATH` at a new file (locally: delete
`data/events.db*` **and restart the dev server** — the open handle survives the
file). The log is append-only; there is no reset, only a new book.

---

## 0:00 — The idea, before any screen

Say it plainly, over the landing screen:

> A workpaper is not a spreadsheet. It's a ledger: an immutable fact layer from
> the packet, an append-only event layer for everything people do, and views
> folded from the two. Every number answers two questions — which facts is it
> made of, and whose actions have touched it.

Then the reason: the brief asks for provenance, for sign-offs that reopen, for
freeze-then-amend, for answering a notice years later. Those aren't seven
features, they're one shape, and a grid has neither half of it.

## 0:40 — What a reviewer opens the file for

Overview tab, no line selected. This return against 2024 for both jurisdictions.

Point at the **⚠ on California AGI**: 2024 was a full-year resident Form 540,
2025 is part-year 540NR. The two aren't measured on the same basis and the app
says so instead of quietly showing a percentage.

Areas tab briefly — lines, flags, warnings, verified, against the firm's own
budget hours.

## 1:30 — The vertical slice (the thing to get right first)

Click **F1040 line 1a, wages**.

- The engine's rule in its own words
- **Built from** — expand the trace; it bottoms out in evidence, not in a dead end
- Click **ev-0035** → the W-2 opens as a document, 107,800 highlighted in place
- Everything else read from that page, and where each value landed
- Scroll the document: *"Employer payroll kept California as the work state
  through 09/30/2025"* — nobody extracted a value from that sentence, and it is
  the whole of finding F-002

> This is why the evidence pane renders the page and not just the box. An
> extraction-only view would never show that sentence.

**Technical decision to call out:** one reference grammar, one resolver. Eleven
formats, 8,691 references, all parse. Every click in the app is that one
operation.

## 3:00 — The seam, and an honest number

`lib/graph/document.ts` is the only file that knows the documents are simulated.
Everything above says "value ev-0035 on page 1 of D09" — what a real document
store would also be asked for.

Show the **method chip** on a value: verbatim / normalized / by amount / field
only / not located. 98.4% locate. ✂

> `position` in the packet is synthetic — the README says so — so drawing boxes
> from it would put highlights in the wrong place. I match text instead and show
> which strategy was used, because "matched by amount" is less assurance than
> "matched the pipeline's own reading".

## 4:00 — Questions that become evidence, and a signature that reopens

**Schedule A line 11.** The St Brigid receipt reads `$?,500.00` — first digit
ambiguous, read at 0.41 confidence.

Do it live:
1. Ask the client a question on the line
2. Record the answer — **by phone, on Ngozi's behalf**, recorded by Priya
3. **Attach as evidence** → it appears under *Added in review*, separate from the
   pipeline's own sources, with a `wp:` reference that resolves like any other

> The answer got a reference in the same grammar as `ev-0035`. `resolveRef`
> learned one more kind; nothing else changed. That's what the keystone was for.

Then on **F1040.1a**, which already carries two sign-offs: raise a **blocking
review note**. Both signatures flip to *reopened* in place —

> *No number moved. The verifications or review notes on this item changed.*

Withdraw the note. They come back, because the hash returns to what it was — and
all five events stay in the history, two struck through. **The database refuses
UPDATE and DELETE.**

## 6:00 — The four kinds of number

Adjustments tab.

> The engine can't be rerun. So every number is one of four things and the app
> says which: engine, manual, recomputed, estimated.

The decision worth the most airtime:

> `R-SUM` is documented as "arithmetic combination", not a sum. So I solved each
> line's arithmetic against the engine's own published values and verified it
> reproduces them: 128 lines, all 128 exact — and 19 of them subtract. Assuming a
> sum would have been wrong in both directions.
>
> Five lines resist. Their declared inputs can't produce their own value. Those
> are reported as a finding, and propagation **stops** there — beyond them the
> figures are unknown, not approximately known.

Show the agency finding applied: amount owed 4,220 → 5,220, **recomputed, exact**.
Note the trace tree shows the adjusted figures too — the derivation and the header
must never disagree.

Partner threshold: the California one needs partner sign-off at 3,500 effect.
Priya proposed it, so Priya can't approve it. ✂ (show the refusal, it's one click)

## 8:00 — The checks, and what "we checked this" means

`npm run checks` in the terminal: **18 checks, 108 findings**.

Open items tab. Low findings are hidden by default — 78 of the 108 are
unexplained prior-year variances and they bury everything else. Say that, then
click the count to show them and click it back.

Click **why this check** on the California sourcing finding:

> Every check states what it establishes *without trusting the engine*, and the
> app shows that sentence beside the finding. "We checked this" should be
> inspectable, not asserted.

Two checks reporting **0** is also a result — one of them re-tests the engine's
own diagnostics, and it's clean because v3 dropped two that v1 carried.

Point at the **addressed** section:

> Dismissed means someone argued it away with a reason. Addressed means the figure
> was changed to what the other record holds. The check still reports, because the
> engine's return still says what it said — but the required step ticks itself.

## 9:30 — Replay, freeze, amend

Timeline tab. **Show here** on **2026-03-12, "irs transcript pulled"**.

The banner turns amber, the header reads **engine version v1**, and the figures
move with it: federal AGI **428,023** against **64 documents** and 625 lines.
**Show here** on **2026-03-19, "return computed"** → v2, **429,820**, 66
documents. Return to live → v3, 445,590, 74.

> Moving the clock doesn't grey out later rows — documents that hadn't arrived
> aren't in the index at all. And replay is read-only, because recording work
> against a past view is writing history. (Try it; the write is refused.)

Back to live → **freeze and file federal**: 627 lines snapshotted with a hash.
Try to adjust → refused. Open an amendment for the 1099-K double count → now it
is allowed, on top of a return that stays as transmitted.

## 10:30 — Answering a notice, two years later

After filing tab. **Letter 566, dated 2028-01-20.**

Item 1 — the donated car. The deduction was corrected to the Form 1098-C
proceeds before filing, so the check that found it is marked **corrected** rather
than left looking open.

Item 2 — Schedule C gross receipts, filed at 163,700 and **amended since filing
to 151,300**, which the record says on its face. Scroll to **the firm's own checks
on this item**:

> Form 1099-K 12,400 is added to books revenue it is already inside.

Walk the arithmetic once: books 151,300 + the whole 1099-K = 163,700, while the
deposits detail says those card payments were already deposited into Sales — and
independently, 142,000 of 1099-NEC plus 9,300 from clients who issue no form is
books revenue to the dollar.

Then the decision to defend:

> The record an examiner gets includes the findings that contradict our own
> return. They'll find the 1099-K double count anyway. A record that hides it is
> worth less than one that explains it.

Click **Export the record** — JSON, readable without this system.

## 11:30 — Tradeoffs, said out loud

Four, briefly. These are the ones I'd want asked about:

1. **I don't map Form 540 to Form 540NR.** 19 prior-year lines come back
   unmatched. Mapping them is a tax judgment and quietly asserting it is exactly
   the failure mode this thing exists to prevent.
2. **I don't total the findings.** One is gross income, one is an unposted
   payment, one is a deduction. A sum would look like exposure and wouldn't be.
3. **Estimated effects stay labelled estimated**, and where recomputation reaches
   a balance it supersedes them rather than sitting beside them.
4. **What I'd build next:** the large-detail views — 282 sales, the depreciation
   schedule, books-to-tax, the state split. The data model carries them; they're
   presentation. I spent the time on the spine instead, because that's what every
   view hangs off.

## 12:00 — How I used AI

> Claude wrote most of the code, against a design I set and decisions I made.
> Three places it earned its keep: solving the arithmetic of 128 lines against
> the engine's published values, writing the check suite, and catching two of my
> own bugs — a highlight matching "0.00" inside "18,480.00" and reporting the
> proceeds that really were printed there as missing, and document grouping that
> ignored tax year and made a 2023 and a 2025 K-1 look like a contradiction.
> Both are written up in FINDINGS.md under corrections, because a check that
> catches your own mistakes is the only kind worth trusting.

---

## Things to have open

- `http://localhost:3000` at 1440+
- A terminal with `npm run checks`
- `FINDINGS.md` if they ask for the full list
