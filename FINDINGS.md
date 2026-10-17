# The errors found, and how the design surfaced them

**These are check output, not a list kept by hand.** Nineteen checks run against
the packet; `npm run checks` prints what they find and the Open items tab shows
the same thing. Every claim below can be re-run.

The engine's own v3 diagnostics are an input, not a verdict — one check re-tests
the condition each asserts. **All ten write-ups below are things the engine does
not report.**

## Summary

| | Finding | Amount | What the amount is | Surfaced by |
|---|---|---|---|---|
| F-008 | Form 1099-K added to books revenue it is already inside | **12,400** | overstated gross receipts, ≈ **4,402** federal tax | `RECON-SCHC-GROSS` |
| F-009 | Donated car deducted at the client's estimate, not the charity's sale proceeds | **3,100** | overstated deduction | `RECON-NONCASH-GIFT` |
| F-002 | All wages sourced to California, contradicted by a paystub in the file | **88,831** | overstated California-source wages, ≈ **5,685** California tax | `INT-STATE-SOURCE` |
| F-010 | Four documents reach no line and nothing explains why | — | one of them is the evidence for F-002 | `DOC-UNEXPLAINED` |
| F-005 | Both estimated payment figures disagree with the agencies | **1,000** + **3,500** | overstated payments; balance moves one for one | `RECON-AGENCY` |
| F-006 | Three pages print amounts never extracted | **250** traced | one unread lot explains a tie-out difference exactly | `DOC-PAGE-UNREAD` |
| F-003 | 2025 foreign interest converted at the 2024 exchange rate | **124** | understated interest, ≈ 43 federal tax | `INT-PARAM-YEAR` |
| F-007 | Five Schedule CA lines declare inputs that cannot produce their value | — | the derivation shown is incomplete | `INT-INPUTS-INCOMPLETE` |
| F-004 | Schedule B line numbers are positions, not identities | — | would have produced 3 false variances | `RECON-VARIANCE` |
| F-001 | The prior depreciation schedule has no source | — | all opening depreciation is untraceable | `INT-REF` |

**There is deliberately no total.** One of those amounts is gross income sourced
to a state, another is a payment an agency has not posted, another is a deduction.
Adding them produces a figure that looks like exposure and is not — the same
false precision the workpaper exists to remove. The app does not total them
either.

**Both items the IRS is examining** in the 2028 Letter 566 have findings: F-008
on Schedule C gross receipts, which is the largest error in the file, and F-009
on the noncash charitable deduction. Neither was written by hand — the checks
found them, and one of those checks exists *because* the letter says to look.

## The suite

```
19 checks, 112 findings — 17 high, 61 medium, 34 low

EV-NOT-ON-PAGE             1   Extracted amount does not appear on its own page
EV-LOW-CONFIDENCE          2   Low-confidence reading used on the return
DOC-CONFLICT               2   Two documents of the same thing disagree
DOC-SUPERSEDED-USED        0   A superseded document still feeds the return
TIE-OUT-DETAIL             2   Transaction detail does not add to the summary
DOC-PAGE-UNREAD            4   A document page was never read
DOC-UNEXPLAINED            4   A document reaches no line and nothing says why
RECON-AGENCY               2   Payments do not agree to the agency's records
RECON-SCHC-GROSS           1   Gross receipts do not reconcile to third-party forms
RECON-NONCASH-GIFT         1   A noncash gift is valued above its own acknowledgment
RECON-QUESTIONNAIRE        1   A client answer is contradicted by the file
RECON-CLIENT-HEDGED        3   A figure rests on a client's uncertain recollection
RECON-VARIANCE            78   A flagged prior-year variance is unexplained
INT-PARAM-YEAR             1   A line uses a parameter from the wrong year
INT-REF                    1   A source reference does not resolve on its own terms
INT-STATE-SOURCE           2   All of an item sourced to CA despite part-year residency
INT-STALE-DIAGNOSTIC       0   An engine diagnostic is no longer true
INT-BASIS-GAP              2   A basis record has a missing year
INT-INPUTS-INCOMPLETE      5   A line's declared inputs cannot produce its value
```

Each check states what it establishes **without trusting the engine**, and the app
shows that sentence beside every finding, so "we checked this" is inspectable
rather than asserted.

Two checks reporting nothing is also a result. `DOC-SUPERSEDED-USED` is clean
because the corrected Meridian 1099 really did displace the original.
`INT-STALE-DIAGNOSTIC` is clean because v3 dropped the two diagnostics v1 and v2
carried once the late K-1s arrived. A suite that can only ever find things is not
a suite.

## How a finding closes

Two ways, and the difference is kept. **Dismissed** means someone argued it away,
with a reason and an author; the check still runs. **Addressed** means the figure
was changed to what the other record holds. Checks never read the event log, so a
finding cannot be made to disappear by working around it — but applying the exact
figure a check supplied is answering it, not working around it, and the required
step it feeds then ticks itself.

---

## F-001 — The prior depreciation schedule has no source **[not in diagnostics]**

**Check:** `INT-REF`, plus the reference-grammar verification in
`scripts/check-refs.ts`, which parses every one of the 8,691 references the packet
uses and reports any it cannot recognize.

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

## F-002 — All wages sourced to California, contradicted by a paystub already in the file **[not in diagnostics]**

**Check:** `INT-STATE-SOURCE`, which compares the California column against the
total column on Schedule CA (540NR) line by line, reads the household's own
residency dates, and looks for a payroll record that states the state-taxable
figure directly.

```
SchCA540NR.1.D  Wages - total using CA law   218,400
SchCA540NR.1.E  Wages - California amount    218,400   rule R-CA-WAGES-SOURCE
```

Every dollar of wages is sourced to California. `household.residency` ends
California on 2025-07-14, and `ca_resident_days` is 195 of 365.

The rule is literal — *"California-source wages from Form W-2 box 16"* — and
Halvorsen reported box 16 of 111,300 against box 1 of 107,800, essentially the
whole year, because, as D09's own page says, *"Employer payroll kept California
as the work state through 09/30/2025."*

### The file already contains the right figure

**D73**, a Halvorsen paystub, pay date 2025-07-18:

> Pay period 07/01/2025–07/15/2025. **Work location changed to Austin, TX
> effective 07/15/2025.** Year-to-date as of 07/15/2025: gross wages 25,969.00;
> **CA taxable wages 22,469.00.**

It arrived **2026-03-27**, three months before v3 was computed on 2026-06-23. It
was extracted — `ev-1081`, `ytd_ca_wages = 22,469`, confidence 0.99. **No line on
the return cites it.**

| | |
|---|---|
| Corvane box 16 — employment ended in May, resident throughout | 107,100 |
| Halvorsen California wages at the move, per D73 | 22,469 |
| **should be** | **129,569** |
| return reports | 218,400 |
| **overstated by** | **88,831** |

At the packet's own `ca_source_income` rate of 0.064, about **5,685 of California
tax**.

**Why the design found it, twice.** The state-sourcing check noticed that a
part-year return was sourcing an item whole. The document index then noticed that
D73 reaches nothing and nothing explains why. The two met: the check now quotes
the paystub, so the finding carries the figure rather than an apportionment this
workpaper would have had to invent.

That is the difference the document index makes. Before it, D73 could not be
opened in the application at all — a document is only reachable by clicking a
source reference on a line, and no line references this one.

**Disposition:** a judgment call on the apportionment basis, which is the
preparer's to make, so the check deliberately carries **no suggested adjustment**.
It carries the contradicting document instead.

---

## F-003 — 2025 foreign interest converted at the 2024 exchange rate **[not in diagnostics]**

**Check:** `INT-PARAM-YEAR`, which reads the year named in each cited parameter
path and compares it to the household's tax year. Found first through the
prior-year comparison, which put every Schedule B interest line under review;
opening `SchB.1.6` showed a source reference naming the wrong year outright.

```
SchB.1.6  value 1,747
  label   "Interest - Sparbanken Norrland (SEK 18,450.00 at 10.56 SEK/USD)"
  sources ["ev-0960", "ref:fx.SEK.2024_average"]
```

The source reference on a 2025 return is `fx.SEK.2024_average`. The packet carries
all three rates:

```
SEK_per_USD   2024_average 10.56   2025_average 9.86   2025_year_end 9.71
```

D36 is a Swedish year-end statement for 2025 (`Årsbesked 2025`), interest credited
12/31/2025. Converting at the 2025 average gives 1,871, not 1,747 — interest
understated by **124**, and the label states the wrong rate on the return itself.

**Why the design found it:** `resolveRef` treats an engine parameter as a
first-class reference, the same as an extracted value, so `ref:fx.SEK.2024_average`
renders as a chip beside `ev-0960` and resolves to the rate it names. The error is
visible in the evidence list without opening anything. A workpaper that only traced
to documents would have shown the SEK amount agreeing perfectly to D36 and stopped
there — the SEK figure is right; the rate applied to it is not.

**Disposition:** adjustment with a recalculation verification; small in dollars
(~43 federal at the packet's 0.348 interest rate), but it is a confidently wrong
number with its own wrong source cited on the face of the return.

This is also the clearest case for treating engine parameters as first-class
references rather than as configuration: had `fx.SEK.2024_average` been a number
compiled into the rule instead of a citation, there would have been nothing to
notice.

---

## F-004 — Schedule B line numbers are positions, not identities **[not in diagnostics]**

**Check:** `RECON-VARIANCE`, via the label comparison in the prior-year variance
engine, which marks a line not comparable when both years' labels name entirely
different proper nouns.

`R-INTEREST-PAYER` emits "one line per interest payer". The payer count went from
four to eight, so the same line key names a different institution in each year:

| key | 2024 | 2025 |
|---|---|---|
| `SchB.1.2` | Meridian Brokerage (U.S. Treasury) | Northlake Bank, N.A. |
| `SchB.1.3` | Sacramento Valley Bank | Meridian Brokerage - U.S. Treasury |
| `SchB.1.4` | Sparbanken Norrland | Austin Community Credit Union |

A year-over-year variance on these keys compares unrelated payers. Sacramento
Valley Bank did not fall from 220 to 96 — it moved from line 3 to line 5.

**Why it matters beyond this line:** a comparison keyed on line number is only
sound where the line number is a stable identity, and on enumerated lines it is
not. Flagging the amount swing without noticing this would have produced three
confident, entirely false variances, and a reviewer chasing them would have
wasted the time the workpaper is supposed to save.

**Disposition:** the variance engine compares the two years' labels and marks a
line **not comparable** when both labels name proper nouns and none of them
overlap. Those lines are reported separately rather than given a percentage, and
matching payers across years is left to a person.

---

## F-005 — Both estimated tax payment figures disagree with the agencies **[not in diagnostics]**

**Check:** `RECON-AGENCY`. Adds the agencies' own posted transactions and compares
the total to the return, reading the IRS account transcript and the FTB account
directly.

This is the largest finding in the file, and neither half is diagnosed.

### Federal: 13,000 claimed, 12,000 posted

`F1040.26` claims 13,000. The IRS account transcript as of 2026-08-03 posts four
payments of 3,000: 2025-04-15, 2025-06-16, 2025-09-15, 2026-01-15.

D67 holds confirmations for only the first three. The fourth comes from the
organizer, and `R-ESTIMATED-PAYMENTS` says so outright: *"Federal estimated
payments from payment confirmations; where none is uploaded, the client's
questionnaire answer."* The answer is `qa-41`:

> "Paid January 14, 2026 - 4,000 **I think**."

The client hedged, in writing, and the engine used the figure as fact over the
agency record that contradicts it. Overstated by 1,000.

### California: 14,000 claimed, 10,500 credited

`F540NR.72` claims 14,000, from four Web Pay confirmations of 3,500. But D68
states the designation of each payment, and the one dated 2025-09-15 is
designated **tax year 2024**. The pipeline read that correctly — `ev-1076` holds
`pay5_year = 2024`. The FTB account agrees, listing it under
`tax_year_2024_payments_after_filing` with the note "held as a 2024 credit".

`R-CA-ESTIMATED-PAYMENTS` is written by date, not by designation: *"every FTB
payment dated 2025-04-01 through 2026-01-15."* It swept in a payment its own
source data says belongs to another year. Overstated by 3,500.

**Why the design found it:** nothing about these lines looks wrong from inside
the return. The arithmetic is right, the sources resolve, the confidences are
0.99. Only a second record disagrees, which is why "Estimated payments agreed to
IRS and FTB records" is one of the firm's twelve required steps — and why that
step is derived in this workpaper from the check rather than ticked by hand.

**Disposition:** payments change the balance due one for one, so 4,500 of real
money across the two jurisdictions, before any underpayment interest. Both need
client contact and a corrected figure.

---

## F-006 — Three pages print amounts that were never extracted **[2 of 3 not in diagnostics]**

**Check:** `DOC-PAGE-UNREAD`. Reads each page's own printed content and asks
whether it holds figures that no extracted value accounts for.

| page | what is on it |
|---|---|
| D30/D31 page 32 | `M18 Ironwood REIT ... proceeds 250.00 basis 310.00` |
| D28 page 2 | the entire 1099-B summary for the Northlake account |
| D14 page 2 | `Fixed assets - equipment 38,000.00; accumulated depreciation (7,600.00), straight-line 5 years, booked by the client` |

Only the first is known to the pipeline, which reports D30 and D31 as `partial`
with the reason "Page 32 ('Additional transactions') was not read".

**The 250 is the same 250.** `TIE-OUT-DETAIL` independently reports the Meridian
summary at 71,965 against 71,715 of extracted lots — a 250 difference — and the
unread page holds a single lot with proceeds of 250.00. Two checks that share no
code arrive at the same root cause from opposite directions, which is the
strongest form of confirmation available here.

D14 page 2 is the one with consequences beyond its size: it is the client's own
book treatment of the studio equipment, 7,600 of straight-line depreciation,
against the 38,000 the return takes. That difference is the books-to-tax
reconciliation, and the page documenting it was never read.

**Note on precision.** The first version of this check flagged 22 pages on D30
alone. Twenty-one of them print "no further transactions" and are genuinely
blank, so the check now requires the page to contain an amount before calling it
a hole. A check that cries wolf on twenty-one pages gets the twenty-second
ignored.

---

## Corrections made while building

Two of these findings were wrong when first written, and the checks are what
caught them.

**Three D28 lots were reported as "not printed on the page" and were printed on
the page.** The locator matched a lot's wash-sale reading of `"0.00"` against the
tail of a neighbouring `"18,480.00"`, claimed that span, and then reported the
proceeds that really were there as missing. Short numeric readings are
everywhere on these documents, so matching now requires a number boundary. The
measured locate rate moved from an overstated 98.6% to a correct 98.4%.

**D39 and D40 were reported as disagreeing on three boxes.** They are the 2023
and 2025 Schedule K-1 from the same S corporation; their boxes are supposed to
differ. The document-grouping key now includes the tax year.

Both were caught by reading what the check reported against the underlying page,
which is the same thing the workpaper asks a reviewer to do.

## F-007 — Five Schedule CA lines declare inputs that cannot produce their value **[not in diagnostics]**

**Check:** `INT-INPUTS-INCOMPLETE`. Solves each combination line's arithmetic
against the engine's own published values and reports the ones no combination of
their declared inputs can reproduce.

| line | value | declared inputs | short by |
|---|---|---|---|
| `SchCA540NR.1.D` | 218,400 | `1.A` | 6,000 |
| `SchCA540NR.2.D` | 6,040 | `2.A` | −410 |
| `SchCA540NR.12.A` | 81,854 | `F1040.8`, `SchC.31` | −70,024 |
| `SchCA540NR.12.D` | 112,254 | `12.A` | 30,400 |
| `SchCA540NR.17.D` | −12,314 | `17.A` | −484 |

Each shortfall is exactly another column on the same line that the engine did not
declare: 1.D is short by `1.C`, the California additions (6,000); 12.D by `12.C`
(30,400); 17.D by `17.B` (484). `SchCA540NR.12.A` carries `SchC.31` and also
names `F1040.8`, which it does not use.

**Why it matters:** "show how any number was built" is only true if the inputs a
line declares actually build it. The trace shown for these five is incomplete —
a reviewer expanding `SchCA540NR.1.D` sees 212,400 under a figure of 218,400 and
nothing to explain the difference. It also bounds what can be recomputed: a
change to the California additions column cannot be carried into the total,
because the total does not declare it as an input.

**How it was found:** not by reading the data, but by building the recompute
engine. The arithmetic for every combination line is solved against the engine's
published figures rather than assumed — `R-SUM` is documented as "arithmetic
combination", and 19 of the 128 solved lines turn out to subtract, so assuming a
sum would have been wrong in both directions. These five are the residue: lines
where no combination of the declared inputs reproduces the published value.

**Disposition:** the five are excluded from recomputation and reported. An
adjustment upstream of them stops there, and the workpaper says so rather than
carrying a figure it cannot stand behind.

---

## F-008 — Form 1099-K is added to books revenue it is already inside **[not in diagnostics]**

**Check:** `RECON-SCHC-GROSS`. Adds the Forms 1099-NEC itself, reads the books
total and the deposits detail, and reconciles them.

This is the largest finding in the file, and it is the second item the IRS is
examining.

```
SchC.1  Gross receipts  163,700
        = books revenue 151,300 + the whole Form 1099-K 12,400
```

`R-SCHC-GROSS` adds card amounts "that the engine could not match to a books
deposit", and it matched none. But D15, the books transaction detail, says in its
own words:

> Atlas Outdoor Gear paid 41,200.00 in 2025, of which **12,400.00 arrived through
> Paywell Payments card processing (deposited gross** …). **Client deposits are
> recorded as Sales - client projects.**

The 1099-K reports that same 12,400. It is already inside books revenue, and was
added again.

**The arithmetic confirms it twice.** Forms 1099-NEC total 142,000; the deposits
detail records 9,300 from eleven clients who issued no form. 142,000 + 9,300 =
151,300, which is books revenue to the dollar — leaving nothing for the card
total to be other than a subset of what is already there.

Overstated by **12,400**, about **4,402 of federal tax** at the packet's own
Schedule C rate, before California.

**Why the design found it:** because the examination letter said to look. Letter
566 asks the firm to "reconcile Schedule C gross receipts to Forms 1099-NEC
(142,000) and Form 1099-K (12,400)", and a firm that knows an area is examined
should be checking it before the letter arrives — so that reconciliation is a
check. The evidence it needed was extracted and sitting in `ev-0109`; what was
missing was anything that read it. `SchC.1` cites the books total and the 1099-K
and does not cite the record that says the one contains the other.

**Disposition:** adjust to 151,300. Because this was found after filing in the
walkthrough, it goes through the amendment layer: the filed return stays as
transmitted, the amendment sits on top, and the change needs partner approval at
4,402 of effect.

---

## F-009 — The donated car is deducted at the client's estimate, not the charity's sale proceeds **[not in diagnostics]**

**Check:** `RECON-NONCASH-GIFT`. Reads the amounts extracted from each
acknowledgment a Form 8283 line cites and compares them to the deduction taken.

```
F8283.A1.vehicle   6,000   sources: qa-39, ev-1055 (the date on D66)
D66  Form 1098-C   box 4a  vehicle sold in arm's length transaction, checked
                   box 4c  gross proceeds from sale   2,900.00   (ev-1054, confidence 0.99)
```

`R-NONCASH-GIFT` takes the value "stated by the donor **or** the acknowledgment".
It took the donor's — `qa-39`, "Kelley Blue Book said **about** 6,000" — and
cited the date on the Form 1098-C while leaving the proceeds on the same document
unused. Overstated by **3,100**.

**Why the design found it:** two checks converge again, from different
directions. `RECON-CLIENT-HEDGED` had already flagged this line for resting on a
hedged recollection — the word "about" is in the answer. This check asks the
narrower question: is there an amount sitting *on a document the line already
cites* that nothing read? There was, at 0.99 confidence.

**Why it matters more than 3,100:** this is the first item Letter 566 examines —
"provide acknowledgments and valuation". The acknowledgment is the document the
IRS will ask for, and it contradicts the return.

**Disposition:** adjust to 2,900, or document the basis for a different figure.
The check carries the exact figure, so it can be applied rather than retyped.

---

## F-010 — Four documents reach no line and nothing explains why **[not in diagnostics]**

**Check:** `DOC-UNEXPLAINED`. Walks the reverse index from documents to lines,
then tries every explanation the file itself can offer.

Of 74 documents, 56 reach a line on the current return and 18 do not. Fourteen of
those eighteen are explained by the file:

| reason | count | |
|---|---|---|
| evidence for a required step | 6 | engagement letter, consents, identity documents, IP PIN |
| never extracted | 4 | agency records and the prior preparer's workpaper, reproduced as structured data |
| cited by the prior-year records | 2 | the 2024 return, the home purchase closing statement |
| superseded | 1 | the original Meridian 1099, displaced by the corrected copy |
| duplicate | 1 | the phone photo of the Halvorsen W-2 |

**Four have no explanation at all**, and each is substantive:

| | what it is | what it bears on |
|---|---|---|
| `D73` | Halvorsen paystub, 07/18/2025 | **the evidence for F-002** — states CA taxable wages of 22,469 at the move |
| `D15` | books transaction detail | **the evidence for F-008** — records the card deposits as already in Sales |
| `D13` | Form 3922, ESPP transfer | the basis on the ESPP sale, where the return used a different document |
| `D47` | HVAC invoice, 11,000 | the repair-or-improvement judgment the packet supplies a what-if for |

Two of the four are the proof of the two largest errors in the file. Both were
read by the pipeline, both have been sitting in the engagement since February and
March, and until there was an index neither could be opened.

**Why it matters as a class, not as four items:** "Prove completeness: every
document used" is one of the things the workpaper has to do, and a document that
nobody cites and nobody has explained is either a missed inclusion or an
unrecorded decision. Both deserve a sentence from a person. The check cannot tell
which; it can tell you that nobody has said.

---
