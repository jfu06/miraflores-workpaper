# Findings

Candidate errors and data-quality problems found while building, with how the
design surfaced each one. Items marked **[not in diagnostics]** are ones the
packet's own 13 engine diagnostics do not report.

---

## F-001 — The prior depreciation schedule has no source **[not in diagnostics]**

**Surfaced by:** reference-grammar verification (`scripts/check-refs.ts`), which
parses every one of the 8,691 references the packet uses and reports any it
cannot recognize.

All six prior-year assets cite a single source reference:

```
prior_years.asset_records[].sources = ["prior_preparer_depreciation_schedule"]
```

That string matches none of the 11 reference formats the README defines. The only
nearby record is `prior_years.prior_preparer_workpaper.depreciation_schedule`,
whose value is the string:

```
"see prior_years.asset_records"
```

So the assets cite the depreciation schedule, and the depreciation schedule cites
the assets back. The reference is circular and terminates in nothing. D07, the
prior preparer's workpaper, is `not_extracted`.

**Why it matters:** every opening depreciation figure in the return rests on this.
That includes `SAC-BLDG` / `SAC-APPL` / `SAC-ROOF` — the Sacramento rental that was
sold in 2025, so accumulated depreciation drives both the gain and the
unrecaptured section 1250 recapture. A workpaper whose job is "trace any number to
its exact source" cannot trace any of it past "the prior preparer said so."

**Disposition:** treated as unverifiable-by-document. Needs a `agreed_to_prior_year`
verification at best, and realistically a client/prior-preparer request. The app
resolves the reference through an explicit alias table so it is still clickable,
but flags it as non-standard rather than silently normalizing it.

---

## F-002 — All wages sourced to California, for a household resident there 195 of 365 days **[not in diagnostics]**

**Surfaced by:** tracing `SchCA540NR.1.E` and reading its source documents in the
evidence pane, where the W-2's own printed text carries the warning.

```
SchCA540NR.1.D  Wages - total using CA law   218,400
SchCA540NR.1.E  Wages - California amount    218,400   rule R-CA-WAGES-SOURCE
```

The California-source amount equals the total. Every dollar of wages is sourced to
California. But `household.residency` records CA residency ending 2025-07-14, and
`engine_reference.parameters.ca_resident_days` is 195 of 365.

The rule is literal: `R-CA-WAGES-SOURCE — California-source wages from Form W-2
box 16.` It takes box 16 at face value. D09's printed page says why that is wrong,
in its own parenthetical:

> Employment began 06/02/2025. Employer payroll kept California as the work state
> through 09/30/2025.

So Halvorsen reported box 16 of 111,300 against box 1 of 107,800 — essentially the
full year, plus the 3,500 HSA add-back California does not exclude. Ngozi worked
remotely from Sacramento only until the 07/15 move; the rest was Texas.

Corvane is not affected: that employment ended in May, while the household was
still resident in California, so those wages are correctly California-source.

**Magnitude.** Halvorsen employment ran 06/02–12/31 (213 days), of which 06/02–07/14
(43 days) was California residency. Sourcing on that basis gives roughly 21,800
rather than the 111,300 used — about 89,000 of overstated California-source wages.
At the packet's own `ca_source_income` rate of 0.063 per dollar, that is on the
order of **5,600 of California tax**, well over the firm's 1,000 threshold for
partner sign-off on an adjustment.

**Why the design found it:** two things had to meet. The trace showed line 1.E
taking its value from box 16 through a rule that does no apportionment, and the
evidence pane renders the whole printed page rather than just the extracted box,
so the payroll-state sentence sits directly beside the number it undermines. An
extraction-only view would never show that sentence — no value was extracted from it.

**Note on what this is not:** box 16 exceeding box 1 is correct, not an error.
The 3,500 difference is exactly box 12 W, the employer HSA contribution, which
California does not exclude. Checked and dismissed before reporting.

**Disposition:** a judgment call requiring a wage apportionment, client
confirmation of the work-location dates, and partner sign-off on the adjustment.
The README's description of the `ca_source_income` rate names "a California wage
split" as its example use, which suggests this is a scenario the packet intends
to be found.

---
