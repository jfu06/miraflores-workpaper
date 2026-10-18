# Spoken script

The lines to say out loud, with the clicks beside them. **Don't read it flat** —
it's a safety net, not a teleprompter. If you lose your place, the bold heading
tells you which screen you're on.

**1,406 words of speech — about 14 minutes** with the clicking, which is what the
rehearsal recording runs to. The timestamp on each heading is your clock.

**Numbers:** full the first time ("twelve thousand four hundred"), rounded after
("that twelve-four"). Rounding is fine; precision you stumble over is not.

**录之前（三件事）**

1. 先铺演示状态，否则冻结申报那段没东西可演：

   ```
   npm run seed -- --no-file
   ```

2. 浏览器拉到 **1600px 以上**，110% 缩放 —— 正文 13px，1080p 下会发虚。
3. 先录两分钟废片，确认麦克风电平和字够不够清楚。

排练视频 `rehearsal.webm`（不进 git，用 Chrome 打开）：**按 115 词/分钟的语速走**，
点一下，底下出现你要念的那句原话，橙色进度条走完才往下点。跟着念，跟得上就是对的
节奏。中英对照在 [VIDEO-SCRIPT.zh.md](VIDEO-SCRIPT.zh.md)。

**若还要更短**，先丢 *Every document, and where it went*（去掉 F-002 这条发现）或
*A question becomes evidence*。其余每一段都对应题目明确要求看到的东西。

**Practise these once:**

| | |
|---|---|
| rec**ei**pts | *ri-SEETS* — the **p** is silent |
| Schedule | *SKED-jool* — they're a US firm |
| apportion | *uh-POR-shun* |
| Okafor-Lindqvist | *oh-KAH-for LIND-kvist* |
| Miraflores | *meera-FLOR-ess* |

---

## 0:00 — Open on the landing screen · 94 words

> Hi, I'm Joy. This is the workpaper I built for the Okafor-Lindqvist twenty
> twenty-five return.
>
> A workpaper isn't a spreadsheet. It's a ledger. An immutable fact layer — your
> packet, exactly as you sent it — and an append-only event layer, everything a
> person does. Every view is folded from those two.
>
> So every number can answer two questions. Which facts is it made of. And whose
> actions have touched it.
>
> Proving a number, sign-offs that reopen, freezing at filing, answering a notice
> two years later — those aren't four features. They're one shape.

💬 *Pause. Let the screen sit for a second before you start clicking.*

---

## 1:00 — One number, all the way down · 137 words

**Do:** click **Wages, Forms W-2, box 1**.

> Let me take one number apart. Wages. Two hundred twelve thousand four hundred.
>
> Here's the engine's rule, in its own words. Here's the note it left — document
> ten is a second photo of the same W-2, so it's counted once.

**Do:** point at **Built from**, then the `ev-` chips.

> The trace expands down through inputs until it hits evidence. Not a dead end —
> actual evidence.

**Do:** click **ev-0035**.

> There's the W-2, rendered as a document, with the exact box highlighted in
> place, and everything else read from this page.

**Do:** point at the last line of the printed page.

> Now read the last line. *"Employer payroll kept California as the work state
> through September thirtieth."*
>
> Nobody extracted a value from that sentence. There's no field for it. But it is
> the whole of my second-biggest finding.
>
> That's why the panel renders the page and not just the box. An extraction-only
> view would never show you that sentence.

💬 *Most important beat in the video. Slow down.*

---

## 2:22 — A question becomes evidence · 118 words

**Do:** filter `gifts by cash`, click the line.

**Do:** click **ev-1049** — the handwritten receipt, read at 0.41.

> The brief asks for questions to the client that become evidence. The second
> half is the part that needed a decision.
>
> A handwritten receipt from a parish. The page prints "dollar question-mark
> comma five hundred" — the first digit could be a one or a seven. The pipeline
> read fifteen hundred, at zero point four one confidence. So the preparer asked,
> and the client answered by phone.

**Do:** point at **Added in review**.

> That answer has its own reference, and it resolves and opens exactly like an
> extracted value does. The resolver learned one more kind. Nothing else changed.
>
> And look where it sits — above the pipeline's own sources, but separate from
> them. Conflating the two would hide what the engine never saw.

---

## 3:35 — A signature that reopens itself · 155 words

**Do:** back to **Wages, box 1**. Point at the two green sign-offs.

> This line is signed, preparer and reviewer. Watch what happens when I raise a
> blocking review note.

**Do:** type a note, tick **blocks filing**, click **Add**.

> Both signatures reopened. *"No number moved. The verifications or review notes
> on this item changed, so the signature no longer covers what is here."*
>
> Nothing told the app this should happen. A sign-off stores a hash of what it
> covered — the line, its inputs all the way down, the values underneath, and the
> work standing at the time. A change nobody anticipated still reopens it.

**Do:** click **withdraw**.

> Withdraw the note and they come back.

**Do:** in **Adjust**, set the figure to 211,400 with a reason, and click
**Adjust**.

> Now the half that matters. I'll change the figure itself.
>
> Both reopen again — this time because the number moved, not the paperwork
> around it. The hash covers the value as adjusted, and the closure runs all the
> way down.

**Do:** withdraw the adjustment.

> And look at the history. Events struck through, nothing deleted. The database
> refuses updates and deletes outright. Undo is a compensating event, not an
> erasure.

💬 *If the sign-offs don't flip instantly, say "give it a moment" and carry on.*

---

## 5:06 — The four kinds of number · 148 words

**Do:** **← Overview**, then **Adjustments**.

> The hardest decision. The engine can't be rerun, so what is an adjusted
> number?
>
> My answer is it's one of four things, and the app says which one, next to the
> figure. Engine, as you published it. Manual, where a person set it with a
> reason. Recomputed. Or estimated.
>
> The recomputation isn't assumed. Your rule says "arithmetic combination of the
> listed input lines" — not a sum. So for every line like that I solved for the
> combination that reproduces your own published value, and checked it against
> it. A hundred twenty-eight lines, all exact, and nineteen of them subtract.

**Do:** scroll to **Where the change stopped**.

> Five lines resist — their declared inputs can't produce their own value, which
> is a finding in itself.
>
> And propagation stops. Two barriers here, each naming the rule that stops it.
> Beyond them, thirty-seven lines — including the tax computation — are reported
> as unknown. Not estimated. Unknown.

---

## 6:35 — Every document, and where it went · 141 words

**Do:** **Documents** tab, then **Unexplained 4**.

> Trace any document to everywhere it landed, or why it didn't. The second half
> mattered more.
>
> Seventy-four documents. Fifty-six land on a line, eighteen don't. Until this
> index existed those eighteen couldn't be opened at all — the only way to reach
> a document was clicking a source on a line.
>
> Fourteen the file explains by itself. Four are explained by nothing.

**Do:** point at **D73**.

> This is a paystub. Work location changed to Austin, effective July fifteenth.
> California taxable wages of twenty-two thousand four hundred sixty-nine at the
> move.
>
> It arrived three months before your engine's last run, extracted at point nine
> nine confidence. And nothing cites it — while the return sources all two
> hundred eighteen thousand of wages to California, off box sixteen.
>
> Eighty-eight thousand overstated. About fifty-seven hundred of California tax.
> And I didn't have to apportion anything to say so.

---

## 7:59 — What "we checked this" means · 81 words

**Do:** terminal, `npm run checks`. Then **Open items**.

> Nineteen checks, a hundred twelve findings. The low ones are hidden — of them,
> seventy-eight are unexplained prior-year variances.

**Do:** click **why this check** on the California sourcing finding.

> Every check states what it establishes without trusting the engine, and the app
> shows you that sentence next to the finding. "We checked this" should be
> something you can inspect, not something I assert.

**Do:** scroll to **Addressed**.

> A finding closes two ways. Dismissed means somebody argued it away, with a
> reason and a name. Addressed means the figure was changed to what the other
> record says.

---

## 8:53 — Replay, freeze, amend · 150 words

**Do:** **Timeline**, click **show here** on 2026-03-12.

> The file has no present — your timeline runs to an examination letter in twenty
> twenty-eight — so the clock is a position. Here's March twelfth. Version one,
> federal AGI four hundred twenty-eight thousand, sixty-four documents.

**Do:** **show here** on 2026-03-19, then **Return to live**.

> March nineteenth, version two. Live, version three, seventy-four documents.
>
> Documents that hadn't arrived aren't greyed out — they're not in the index. And
> replay is read-only, because recording work against a past view is writing
> history.

**Do:** switch the role picker to **Daniel Ortiz — reviewer** — a preparer cannot
transmit a return — then try **Freeze and file california**.

> California is refused, and read why. A blocking review note stands against it —
> the wage split from a moment ago. The firm's own standard stops the
> transmission, not a warning someone can click past.

**Do:** **Freeze and file federal**.

> Federal has nothing standing against it, so federal goes, snapshotting all six
> hundred twenty-seven lines with a hash of them.

**Do:** try to adjust a line, then open an amendment.

> Now try to adjust something. Refused. Open an amendment and it's allowed — on
> top of a return that stays exactly as transmitted.

---

## 10:22 — Answering a notice, two years later · 174 words

**Do:** **After filing** tab.

> A letter from the IRS, dated twenty twenty-eight, examining the twenty
> twenty-five return. Two items.
>
> The record assembles from the file. The figure as filed, the document and page
> behind each component, who verified it and how, what the client was asked and
> answered, who signed.

**Do:** scroll to **the firm's own checks on this item** under item two.

> And this — our own checks on the item they're examining, including the one that
> says our return is wrong.
>
> Gross receipts are a hundred sixty-three thousand seven hundred. Books revenue
> of a hundred fifty-one three, plus the whole twelve-four Form ten-ninety-nine-K,
> which the deposits detail says was already deposited into sales.
>
> And it confirms twice. A hundred forty-two thousand of contractor forms plus
> ninety-three hundred from clients who issue no form is books revenue to the
> dollar. There's nothing left for that twelve-four to be.
>
> Twelve thousand four hundred overstated. About forty-four hundred of federal
> tax. Your diagnostics don't report it.

💬 *Say this next line slowly:*

> I put that in the examiner's record on purpose. They'll find it anyway. A record
> that hides it is worth less than one that explains it.

**Do:** click **Export the record**.

---

## 12:04 — What I'd defend, and what I'd do next · 117 words

> Four tradeoffs I'd want you to push on.
>
> One. I don't map last year's resident return onto this year's part-year form.
> Nineteen prior-year lines come back unmatched. Mapping them is a tax judgment,
> and quietly asserting it is exactly the failure this exists to prevent.
>
> Two. I don't total the findings. One is income sourced to a state, another is a
> payment an agency hasn't posted. A sum would look like exposure and wouldn't be.
>
> Three. Estimates stay labelled estimates.
>
> Four. What I'd build next is the rest of the CPA records — depreciation by
> asset, books to tax, the state split. The data model already carries them;
> they're presentation. I spent the time on the spine.

---

## 13:16 — How I used AI · 91 words

> Last thing. Claude wrote most of the code, against a design I set and decisions
> I made.
>
> Three places it earned its keep. Solving the arithmetic of a hundred
> twenty-eight lines against your published values. Writing the check suite. And
> catching two of my own bugs — one highlight matched "zero point zero zero"
> inside "eighteen thousand four eighty," then reported the proceeds really
> printed there as missing.
>
> Both are written up under corrections. A check that catches your own mistakes is
> the only kind worth trusting.
>
> That's it. Thank you.

---

## If you stumble

Don't restart the recording. Stop talking, pause two seconds, and say the
sentence again from its beginning. The silence is a clean cut point — in Descript
you delete the bad take by deleting its text.

The headings above are the natural places to stop and resume. Each one starts on
a different screen, so a cut there is invisible.
