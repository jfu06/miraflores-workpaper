# Spoken script

The lines to say out loud, with the clicks beside them. **Don't read it flat** —
it's a safety net, not a teleprompter. If you lose your place, the bold heading
tells you which screen you're on.

**1,912 words of speech — about 18 minutes** with the clicking. The timestamp on
each heading is your clock: if you're a minute ahead or behind there, adjust.
Word counts are per section so you can trade.

**Numbers:** full the first time ("twelve thousand four hundred"), rounded after
("that twelve-four"). Rounding is fine; precision you stumble over is not.

**If you need it shorter.** Drop in this order, and stop when you're under:

1. the three **✂** sections (−3:30, lands at ~14:45)
2. *Overview and areas* (−1:00) — the Summary screen is visible behind the first beat anyway
3. *Replay, freeze, amend* (−1:10) — the weakest to lose, since the brief asks for it

Below about eleven minutes you start cutting things the brief explicitly asked
to see. If no length was stated, record the full version.

**录之前（三件事）**

1. 先铺演示状态，否则冻结申报那段没东西可演：

   ```
   npm run seed -- --no-file
   ```

2. 浏览器拉到 **1600px 以上**，110% 缩放。这是为了清晰度 —— 正文 13px，
   1080p 下会发虚。（原本 1600px 时 After filing 那个 tab 会被 Evidence 栏盖住
   点不动，已经修了：tab 现在会换行，1100px 起每个都点得到。）
3. 先录两分钟废片，确认麦克风电平和字够不够清楚。

两段排练视频（都不进 git，用 Chrome 打开）：

- `walkthrough.webm` — 1 分 53 秒，只看「点哪里」，快速过一遍路线。
- `rehearsal.webm` — 19 分 22 秒，**按 115 词/分钟的语速走**：点一下，底下出现
  你要念的那句原话，橙色进度条走完才往下点。跟着念，跟得上就是对的节奏。
  字幕按意群分屏，不是一句一屏 —— 像「engine / manual / recomputed / estimated」
  那种清单会整组出现，因为它们本来就该连着念。

**Practise these once:**

| | |
|---|---|
| rec**ei**pts | *ri-SEETS* — the **p** is silent |
| Schedule | *SKED-jool* — they're a US firm |
| apportion / apportionment | *uh-POR-shun* / *uh-POR-shun-ment* |
| supersede | *soo-per-SEED* |
| Okafor-Lindqvist | *oh-KAH-for LIND-kvist* |
| Miraflores | *meera-FLOR-ess* |

---

## 0:00 — Open on the landing screen · 122 words

> Hi, I'm Joy. This is the workpaper I built for the Okafor-Lindqvist
> twenty twenty-five return.
>
> Let me start with the one idea everything came from.
>
> A workpaper isn't a spreadsheet. It's a ledger. There's an immutable fact layer
> — your packet, loaded exactly as you sent it. There's an append-only event
> layer — everything a person does. Every view you see is folded from those two.
>
> So every number on screen can answer two questions. Which facts is it made of.
> And whose actions have touched it.
>
> The brief asks for proving a number, sign-offs that reopen, freezing at filing,
> answering a notice two years later. Those aren't four features. They're one
> shape. And a grid doesn't have either half of it.

💬 *Pause. Let the screen sit for a second before you start clicking.*

---

## 1:11 — Overview and areas · 77 words

**Do:** you're on Summary. Point at the California block.

> This is what a reviewer opens the file for. The return against last year, both
> jurisdictions.
>
> Notice the warnings on California. Last year was a full-year resident return.
> This year is part-year, because they moved to Texas in July. Those two aren't
> measured the same way, so the app says so instead of quietly showing a
> percentage.

**Do:** click **Areas**.

> Areas are the firm's own — the headings they budget hours against. California
> has one blocking review note on it.

---

## 1:59 — One number, all the way down · 167 words

**Do:** click **Wages, Forms W-2, box 1**.

> Let me take one number apart. Wages. Two hundred twelve thousand four hundred.
>
> Here's the engine's rule, in the engine's own words. Here's the note it left —
> document ten is a second photo of the same W-2, so it's counted once.
>
> And here's what it's built from.

**Do:** point at **Built from**, then the `ev-` chips.

> The trace expands down through inputs until it hits evidence. Not a dead end —
> actual evidence.

**Do:** click **ev-0035**.

> There's the W-2. Rendered as a document, with the exact box highlighted in
> place. Box one, a hundred seven thousand eight hundred. Below it, everything
> else read from this page, and where each value landed.

**Do:** scroll the document panel to the last line.

> Now read the last line on this page.
>
> *"Employer payroll kept California as the work state through September
> thirtieth."*
>
> Nobody extracted a value from that sentence. There's no field for it. But it's
> the whole of my second-biggest finding, and I'll come back to it.
>
> That's why the evidence panel renders the page and not just the box. An
> extraction-only view would never show you that sentence.

💬 *Most important beat in the video. Slow down.*

---

## 3:33 — The seam, and an honest number · 87 words  ✂

**Do:** point at the `verbatim` / `not located` chips.

> One decision about the simulated documents.
>
> Your README says the position data is synthetic. Drawing boxes from it would
> put highlights in the wrong place. So I match text instead — and I show which
> way each one matched.
>
> Verbatim means it matched the pipeline's own reading, character for character.
> By amount means the reading didn't appear but the number did. Not located means
> the amount isn't printed on that page at all.
>
> Ninety-eight point four percent locate. I'd rather show you that than claim a
> hundred.

---

## 4:26 — A question becomes evidence · 134 words

**Do:** filter `gifts by cash`, click the line.

**Do:** click **ev-1049** — the handwritten receipt itself, read at 0.41.

> The brief asks for questions to the client that become evidence. The second
> half is the part that needed a decision.
>
> This is a handwritten receipt from a parish. The page prints "dollar
> question-mark comma five hundred." The first digit could be a one or a seven.
> The pipeline read fifteen hundred — at zero point four one confidence.
>
> So the preparer asked. The client answered by phone. And that answer is sitting
> right here, in the evidence.

**Do:** point at **Added in review**.

> It has its own reference, and it resolves and opens exactly like an extracted
> value does. The resolver learned one more kind. Nothing else changed.
>
> And look where it sits. Above the pipeline's own sources, but separate from
> them. Both are evidence. Conflating them would hide which part of this number's
> support the engine never saw.

---

## 5:43 — A signature that reopens itself · 157 words

**Do:** back to **Wages, box 1**. Point at the two green sign-offs.

> This line is signed. Preparer and reviewer. Watch what happens when I raise a
> blocking review note.

**Do:** type a note, tick **blocks filing**, click **Add**.

> Both signatures just reopened. And read what they say —
>
> *"No number moved. The verifications or review notes on this item changed, so
> the signature no longer covers what is here."*
>
> Nothing told the app this should happen. A sign-off stores a hash of what it
> covered — the line, its inputs all the way down, the values underneath, and the
> work standing at the time. Anything that changes any of that produces a
> different hash. A change nobody anticipated still reopens the signature,
> because the mechanism doesn't depend on anticipating it.

**Do:** click **withdraw**.

> Withdraw the note and they come back, because the hash returns to what it was.
>
> But look at the history. Two events struck through. Nothing deleted. The
> database physically refuses updates and deletes — there are triggers that abort
> them. Undo is a compensating event, not an erasure.

💬 *If the sign-offs don't flip instantly, say "give it a moment" and carry on.*

---

## 7:12 — The four kinds of number · 195 words

**Do:** **← Overview**, then **Adjustments**.

> Now the hardest decision, and the one I'd most want to be asked about.
>
> The engine can't be rerun. So what is an adjusted number?
>
> My answer is it's one of four things, and the app says which one, next to the
> figure. Engine, as you published it. Manual, where a person set it with a
> reason. Recomputed. Or estimated.
>
> The recomputation isn't assumed. Your rule is documented as "arithmetic
> combination of the listed input lines" — not a sum. So for every line like
> that, I solved for the combination that reproduces your own published value,
> and checked it against it.
>
> A hundred twenty-eight lines. All hundred twenty-eight reproduce exactly. And
> nineteen of them subtract. If I'd assumed a sum, I'd have been wrong in both
> directions.

**Do:** scroll to **Where the change stopped**.

> Five lines resist. Their declared inputs can't produce their own value — which
> is a finding in itself.
>
> And here's the part I care about. Propagation **stops**. Seven barriers, each
> naming the rule that stops it. Beyond them, eighty-one lines — including the
> tax computation — are reported as unknown.
>
> Not estimated. Unknown. Beyond a line I can't derive, the figures aren't
> approximately known. They're not known.

---

## 8:59 — Every document, and where it went · 184 words  ✂

**Do:** **Documents** tab, then **Unexplained 4**.

> The brief asks to trace any document to everywhere it landed, or why it didn't.
> That second half turned out to matter more.
>
> Seventy-four documents. Fifty-six land on a line. Eighteen don't. And until
> this index existed, those eighteen couldn't be opened at all — the only way to
> reach a document was clicking a source on a line.
>
> Fourteen the file explains by itself. Superseded, never extracted, cited by the
> prior-year records, a duplicate, evidence for a required step.
>
> Four are explained by nothing.

**Do:** point at **D73**.

> And this is the paystub I promised to come back to. Pay date July eighteenth.
> Work location changed to Austin, effective July fifteenth. California taxable
> wages of twenty-two thousand four hundred sixty-nine at the move.
>
> It arrived in March, three months before your engine's last run. Extracted at
> point nine nine confidence. And nothing cites it — while the return sources all
> two hundred eighteen thousand of wages to California, off box sixteen.
>
> Eighty-eight thousand overstated. About fifty-seven hundred of California tax.
> And I didn't have to apportion anything to say so. The document was already in
> the file.

---

## 10:41 — Two hundred ninety-five lots, without reading them · 83 words  ✂

**Do:** **Sales** tab.

> Large detail, without swamping the review.
>
> Box totals first — and all seven tie to your own total for that box, added here
> from the lots.
>
> Then forty-five lots worth a look. Twenty-eight wash sales. Thirteen whose
> basis came from a second document. Four with no basis reported at all — and
> those four are restricted stock, which is the classic way an RSU sale gets
> taxed twice.
>
> Somebody who reads only this first screen has still seen everything that could
> be wrong.

---

## 11:33 — What "we checked this" means · 125 words

**Do:** terminal, `npm run checks`. Then **Open items**.

> Nineteen checks. A hundred twelve findings.
>
> Low ones are hidden by default — seventy-eight are unexplained prior-year
> variances and they'd bury everything else.

**Do:** click **why this check** on the California sourcing finding.

> Every check states what it establishes **without trusting the engine**, and the
> app shows you that sentence next to the finding. "We checked this" should be
> something you can inspect, not something I assert.
>
> Two checks report zero, and that's also a result. One re-tests your own
> diagnostics. It's clean.

**Do:** scroll to **Addressed**.

> And a finding closes two ways. Dismissed means somebody argued it away, with a
> reason and a name. Addressed means the figure was changed to what the other
> record says. The check still reports it — your return still says what it said —
> but the required step it feeds ticks itself.

---

## 12:45 — Replay, freeze, amend · 123 words

**Do:** **Timeline**, click **show here** on 2026-03-12.

> The file doesn't have one present. Your timeline runs from an engagement letter
> to an examination letter in twenty twenty-eight. So the clock is a position.
>
> Here's the file as it stood on March twelfth. Engine version one. Federal AGI
> reads four hundred twenty-eight thousand. Sixty-four documents.

**Do:** **show here** on 2026-03-19, then **Return to live**.

> March nineteenth, version two. Live, version three, seventy-four documents.
>
> Documents that hadn't arrived aren't greyed out — they're not in the index at
> all. And replay is read-only, because recording work against a past view is
> writing history, not replaying it.

**Do:** switch the role picker to **Daniel Ortiz — reviewer** — a preparer cannot
transmit a return, so filing as Priya returns a 403 — then **Freeze and file
federal**. Try to adjust a line. Then open an amendment.

> Filing snapshots all six hundred twenty-seven lines with a hash of them.
>
> Now try to adjust something. Refused. Open an amendment — now it's allowed, on
> top of a return that stays exactly as transmitted.

---

## 13:57 — Answering a notice, two years later · 177 words

**Do:** **After filing** tab.

> A letter from the IRS. Twenty twenty-eight. Two items.
>
> The record assembles from the file. The figure as filed. The document and page
> behind each component. The field, and what was printed there. Who verified it,
> and how. What the client was asked, and answered. Who signed.

**Do:** scroll to **the firm's own checks on this item** under item two.

> And this. Our own checks on the item they're examining — including the one that
> says our return is wrong.
>
> Gross receipts are a hundred sixty-three thousand seven hundred. That's books
> revenue of a hundred fifty-one three, plus the whole twelve-four Form
> ten-ninety-nine-K — which the deposits detail says was already deposited into
> sales.
>
> And it confirms twice. A hundred forty-two thousand of contractor forms, plus
> ninety-three hundred from clients who issue no form, is books revenue to the
> dollar. There's nothing left for that twelve-four to be.
>
> Twelve thousand four hundred overstated. About forty-four hundred of federal
> tax. Your diagnostics don't report it.

💬 *Say this next line slowly:*

> I put that in the examiner's record on purpose. They'll find it anyway. A
> record that hides it is worth less than one that explains it.

**Do:** click **Export the record**.

---

## 15:35 — What I'd defend, and what I'd do next · 148 words

> Four tradeoffs I'd want you to push on.
>
> One. I don't map last year's resident return onto this year's part-year form.
> Nineteen prior-year lines come back unmatched. Mapping them is a tax judgment,
> and quietly asserting it is exactly the failure this thing exists to prevent.
>
> Two. I don't total the findings. One is gross income sourced to a state,
> another is a payment an agency hasn't posted, another is a deduction. A sum
> would look like exposure and wouldn't be.
>
> Three. Estimates stay labelled estimates. Where recomputation reaches a
> balance, it supersedes the estimate rather than sitting beside it.
>
> Four. What I'd build next is the rest of the CPA records — depreciation by
> asset, books to tax, the state split as its own view. The data model already
> carries them. They're presentation. I spent the time on the spine instead,
> because everything else hangs off it.

---

## 16:59 — How I used AI · 133 words

> Last thing, since you asked.
>
> Claude wrote most of the code, against a design I set and decisions I made.
>
> Three places it earned its keep. Solving the arithmetic of a hundred
> twenty-eight lines against your published values. Writing the check suite. And
> catching two of my own bugs.
>
> The first — a highlight that matched "zero point zero zero" inside "eighteen
> thousand four eighty," claimed that spot, and then reported the proceeds that
> really were printed there as missing. The second — document grouping that
> ignored tax year, so a twenty twenty-three and a twenty twenty-five K-1 looked
> like a contradiction.
>
> Both are written up in the findings file, under corrections. A check that
> catches your own mistakes is the only kind worth trusting.
>
> That's it. Thanks for reading all of this.

---

## If you stumble

Don't restart the recording. Stop talking, pause two seconds, and say the
sentence again from its beginning. The silence is a clean cut point — in Descript
you delete the bad take by deleting its text.

The headings above are the natural places to stop and resume. Each one starts on
a different screen, so a cut there is invisible.
