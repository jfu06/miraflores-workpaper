# 讲稿中英对照

英文是你要**照着念**的原话，下面「**中**」开头的是意思。排练时先看中文，确认自己
知道在说什么，再只看英文念。

节奏、录前准备、发音表都在 [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md)，这里只管翻译。

**几个关键词**

| 英文 | 中文 | 说明 |
|---|---|---|
| workpaper | 工作底稿 | 会计师整理报税表的工作记录 |
| packet | 资料包 | 他们给你的那份 JSON 数据 |
| engine | 引擎 | 他们那套算报税表的系统 |
| ledger | 账本 | 只能往后记、不能回头改的记录 |
| sign-off | 签字 | 复核人签字确认 |
| finding | 发现 | 检查查出来的问题 |
| replay | 回放 | 把文件退回某一天的状态 |
| amendment | 修正申报 | 申报后再改，要走的正式流程 |

---

## 0:00 — Open on the landing screen

> Hi, I'm Joy. This is the workpaper I built for the Okafor-Lindqvist twenty
> twenty-five return.

**中** 我是 Joy。这是我为 Okafor-Lindqvist 这家人 2025 年度报税表做的工作底稿。

> A workpaper isn't a spreadsheet. It's a ledger. An immutable fact layer — your
> packet, exactly as you sent it — and an append-only event layer, everything a
> person does. Every view is folded from those two.

**中** 工作底稿不是电子表格，是一本账。下面一层是**不可变的事实**——你们给的资料包，原样载入；上面一层是**只能追加的事件**——人做过的每一件事。你看到的每一个界面，都是这两层叠出来的。

> So every number can answer two questions. Which facts is it made of. And whose
> actions have touched it.

**中** 所以任何一个数字都能回答两个问题：它由哪些事实构成；以及谁的操作动过它。

> Proving a number, sign-offs that reopen, freezing at filing, answering a notice
> two years later — those aren't four features. They're one shape.

**中** 证明一个数字、签字会自动失效、申报时冻结、两年后回答税局来信——这不是四个功能，是同一个结构。

💬 *Pause. Let the screen sit for a second before you start clicking.*

---

## 1:00 — One number, all the way down

**做：** 点 **Wages, Forms W-2, box 1**(工资)。

> Let me take one number apart. Wages. Two hundred twelve thousand four hundred.

**中** 我拆一个数字给你看。工资，212,400。

> Here's the engine's rule, in its own words. Here's the note it left — document
> ten is a second photo of the same W-2, so it's counted once.

**中** 这是引擎的规则，用的是它自己的原话。这是它留下的备注——第 10 号文件是同一张 W-2 的第二张照片，所以只算一次。

**做：** 指 **Built from**,再指那两个 `ev-` 标签。

> The trace expands down through inputs until it hits evidence. Not a dead end —
> actual evidence.

**中** 这条追溯一路往下展开，直到碰到证据为止。不是展开到一个死胡同，是真的证据。

**做：** 点 **ev-0035**。

> There's the W-2, rendered as a document, with the exact box highlighted in
> place, and everything else read from this page.

**中** W-2 出来了，按文件原样渲染，对应那一栏就地高亮，下面是这一页上读到的其他所有数值。

**做：** 把光标停在正文最后一行那句话上。

> Now read the last line. *"Employer payroll kept California as the work state
> through September thirtieth."*

**中** 现在看这一页的最后一行：*「雇主的工资系统一直把加州当作工作地，直到 9 月 30 日。」*

> Nobody extracted a value from that sentence. There's no field for it. But it is
> the whole of my second-biggest finding.

**中** 没有人从这句话里抽取出任何数值——它根本没有对应的字段。但我第二大的发现，全部出自这一句。

> That's why the panel renders the page and not just the box. An extraction-only
> view would never show you that sentence.

**中** 这就是为什么这个面板渲染的是整页，而不只是那一栏。只看抽取结果的界面，永远不会把这句话摆到你面前。

💬 *Most important beat in the video. Slow down.*

---

## 2:22 — A question becomes evidence

**做：** 筛 `gifts by cash`,点进这一行。

**做：** 点 **ev-1049** —— 那张手写收据,置信度 0.41。

> The brief asks for questions to the client that become evidence. The second
> half is the part that needed a decision.

**中** 题目要求「向客户提问，并让答案成为证据」。需要做设计决定的是后半句。

> A handwritten receipt from a parish. The page prints "dollar question-mark
> comma five hundred" — the first digit could be a one or a seven. The pipeline
> read fifteen hundred, at zero point four one confidence. So the preparer asked,
> and the client answered by phone.

**中** 一张教堂开的手写收据。页面上印的是「$?,500」——第一位可能是 1，也可能是 7。管道把它读成 1,500，置信度只有 0.41。所以报税员去问了，客户在电话里答了。

**做：** 指 **Added in review**。

> That answer has its own reference, and it resolves and opens exactly like an
> extracted value does. The resolver learned one more kind. Nothing else changed.

**中** 那个回答有自己的引用编号，解析和打开的方式跟抽取值完全一样。解析器只是多认识了一种引用，别的什么都没改。

> And look where it sits — above the pipeline's own sources, but separate from
> them. Conflating the two would hide what the engine never saw.

**中** 再看它摆在哪儿：在管道自己的来源上方，但跟它们分开。混在一起，就看不出引擎从来没见过哪一部分。

---

## 3:35 — A signature that reopens itself

**做：** 回到 **Wages, box 1**,指那两个绿色签字。

> This line is signed, preparer and reviewer. Watch what happens when I raise a
> blocking review note.

**中** 这一行已经签过字了，报税员和复核人都签了。看我提一条阻断性复核意见会怎么样。

**做：** 写一句复核意见,勾上 **blocks filing**,点 **Add**。

> Both signatures reopened. *"No number moved. The verifications or review notes
> on this item changed, so the signature no longer covers what is here."*

**中** 两个签字都失效了。*「没有任何数字变动。是这一项上的核验或复核意见发生了变化，所以这个签字已经覆盖不住现在的内容了。」*

> Nothing told the app this should happen. A sign-off stores a hash of what it
> covered — the line, its inputs all the way down, the values underneath, and the
> work standing at the time. A change nobody anticipated still reopens it.

**中** 没有人告诉程序该这么做。签字存的是它所覆盖内容的一个哈希——这一行、它一路往下的所有输入、底下的数值，以及当时已有的工作记录。**哪怕是没人预料到的变化，签字照样失效。**

**做：** 点 **withdraw**。

> Withdraw the note and they come back.

**中** 把意见撤回，签字就回来了。

**做：** 在 **Adjust** 里把数字改成 211,400,写个理由,点 **Adjust**。

> Now the half that matters. I'll change the figure itself.

**中** 现在是真正要紧的那一半：我直接改这个数字本身。

> Both reopen again — this time because the number moved, not the paperwork
> around it. The hash covers the value as adjusted, and the closure runs all the
> way down.

**中** 两个签字又失效了——而这次是因为**数字动了**，不是它周围的文书动了。哈希覆盖的是调整之后的值，而且闭包一路向下。

**做：** 在调整那一行点 **withdraw**,撤回它。

> And look at the history. Events struck through, nothing deleted. The database
> refuses updates and deletes outright. Undo is a compensating event, not an
> erasure.

**中** 再看历史记录：有事件被划掉，但没有任何东西被删除。数据库直接拒绝更新和删除。「撤销」是一条冲销事件，不是抹掉。

💬 *If the sign-offs don't flip instantly, say "give it a moment" and carry on.*

---

## 5:06 — The four kinds of number

**做：** 点 **← Overview**,再点 **Adjustments**。

> The hardest decision. The engine can't be rerun, so what is an adjusted
> number?

**中** 最难的那个决定。引擎没法重跑，那么「调整后的数字」到底是什么？

> My answer is it's one of four things, and the app says which one, next to the
> figure. Engine, as you published it. Manual, where a person set it with a
> reason. Recomputed. Or estimated.

**中** 我的答案是：它只能是四种之一，而且程序会在数字旁边标明是哪一种。**engine**——你们发布的原值；**manual**——人工设定并附理由；**recomputed**——重算得出；或者 **estimated**——估算。

> The recomputation isn't assumed. Your rule says "arithmetic combination of the
> listed input lines" — not a sum. So for every line like that I solved for the
> combination that reproduces your own published value, and checked it against
> it. A hundred twenty-eight lines, all exact, and nineteen of them subtract.

**中** 重算不是靠猜。你们的规则写的是「所列输入行的**算术组合**」——没说是求和。所以对每一条这样的行，我反解出能复现你们公布值的那个组合，再拿它去核对。128 行，全部精确，其中 19 行是**减法**。

**做：** 滚到 **Where the change stopped**。

> Five lines resist — their declared inputs can't produce their own value, which
> is a finding in itself.

**中** 有 5 行解不出来——它们声明的输入推不出它们自己的值，这本身就是一个发现。

> And propagation stops. Two barriers here, each naming the rule that stops it.
> Beyond them, thirty-seven lines — including the tax computation — are reported
> as unknown. Not estimated. Unknown.

**中** 而且**传播会停**。这里有两道屏障，每一道都写明是哪条规则把它拦住的。屏障之外的 37 行——包括税额计算本身——一律报告为「未知」。不是「估算」，是**不知道**。

---

## 6:35 — Every document, and where it went

**做：** 点 **Documents**,再点 **Unexplained 4**。

> Trace any document to everywhere it landed, or why it didn't. The second half
> mattered more.

**中** 把任意一份文件追踪到它落到的所有位置，或者说明它为什么没落到任何地方。后半句才更重要。

> Seventy-four documents. Fifty-six land on a line, eighteen don't. Until this
> index existed those eighteen couldn't be opened at all — the only way to reach
> a document was clicking a source on a line.

**中** 74 份文件，56 份落到了某一行，18 份没有。而在这个索引出现之前，这 18 份**根本打不开**——因为打开文件的唯一途径，是点某一行上的来源引用。

> Fourteen the file explains by itself. Four are explained by nothing.

**中** 其中 14 份，文件自己能解释。剩下 4 份，没有任何东西能解释。

**做：** 指 **D73** 这份工资单。

> This is a paystub. Work location changed to Austin, effective July fifteenth.
> California taxable wages of twenty-two thousand four hundred sixty-nine at the
> move.

**中** 这是一张工资单。工作地变更为奥斯汀，7 月 15 日生效。搬家时点的加州应税工资是 22,469。

> It arrived three months before your engine's last run, extracted at point nine
> nine confidence. And nothing cites it — while the return sources all two
> hundred eighteen thousand of wages to California, off box sixteen.

**中** 它比你们引擎最后一次运算早三个月就到了，抽取置信度 0.99。但**没有任何一行引用它**——与此同时，报税表把全部 218,000 的工资都按第 16 栏算成了加州来源。

> Eighty-eight thousand overstated. About fifty-seven hundred of California tax.
> And I didn't have to apportion anything to say so.

**中** 多算了 88,000，大约 5,700 的加州税。而且我**不需要自己做任何分摊**就能这么说。

---

## 7:59 — What "we checked this" means

**做：** 切到终端跑 `npm run checks`,然后点 **Open items**。

> Nineteen checks, a hundred twelve findings. The low ones are hidden — of them,
> seventy-eight are unexplained prior-year variances.

**中** 19 项检查，112 个发现。低优先级的默认折叠——其中 78 个是没有解释的上年度差异。

**做：** 在加州来源那条发现上点 **why this check**。

> Every check states what it establishes without trusting the engine, and the app
> shows you that sentence next to the finding. "We checked this" should be
> something you can inspect, not something I assert.

**中** 每一项检查都写明：**在不信任引擎的前提下**，它能确立什么。程序把这句话就放在发现旁边。「我们检查过了」应该是一件你能查验的事，而不是我说了算。

**做：** 滚到 **Addressed**。

> A finding closes two ways. Dismissed means somebody argued it away, with a
> reason and a name. Addressed means the figure was changed to what the other
> record says.

**中** 一个发现有两种关闭方式。**dismissed** 是有人把它论证掉了，附带理由和署名；**addressed** 是数字已经按另一份记录改了。

---

## 8:53 — Replay, freeze, amend

**做：** 点 **Timeline**,在 2026-03-12 那一行点 **show here**。

> The file has no present — your timeline runs to an examination letter in twenty
> twenty-eight — so the clock is a position. Here's March twelfth. Version one,
> federal AGI four hundred twenty-eight thousand, sixty-four documents.

**中** 这份卷宗没有「现在」——你们的时间线一直延伸到 2028 年的一封稽查信——所以「时钟」在这里是一个**位置**。这是 3 月 12 日：引擎第 1 版，联邦调整后总收入 428,000，64 份文件。

**做：** 在 2026-03-19 点 **show here**,然后点 **Return to live**。

> March nineteenth, version two. Live, version three, seventy-four documents.

**中** 3 月 19 日，第 2 版。回到实时，第 3 版，74 份文件。

> Documents that hadn't arrived aren't greyed out — they're not in the index. And
> replay is read-only, because recording work against a past view is writing
> history.

**中** 那天还没到的文件不是灰显——它们**根本不在索引里**。而且回放是只读的，因为在一个过去的视图上记录工作，那叫篡改历史。

**做：** 把角色切成 **Daniel Ortiz — reviewer**(报税员无权申报),然后先试着点 **Freeze and file california**。

> California is refused, and read why. A blocking review note stands against it —
> the wage split from a moment ago. The firm's own standard stops the
> transmission, not a warning someone can click past.

**中** 加州被拒绝了，看它给的理由：有一条阻断性复核意见挂在上面——就是刚才那个工资拆分。**是事务所自己的标准挡住了这次报送**，不是一句点一下就能绕过去的警告。

**做：** 再点 **Freeze and file federal**。

> Federal has nothing standing against it, so federal goes, snapshotting all six
> hundred twenty-seven lines with a hash of them.

**中** 联邦这边没有东西挡着，所以联邦报得出去，并把全部 627 行连同哈希一起快照下来。

**做：** 试着改一行,再打开修正申报。

> Now try to adjust something. Refused. Open an amendment and it's allowed — on
> top of a return that stays exactly as transmitted.

**中** 现在试着改点什么。被拒绝。打开一份修正申报，就可以改了——而且是改在一张**与报送时一字不差**的报税表之上。

---

## 10:22 — Answering a notice, two years later

**做：** 点 **After filing**。

> A letter from the IRS, dated twenty twenty-eight, examining the twenty
> twenty-five return. Two items.

**中** 一封国税局来信，2028 年发出，查的是 2025 年度那张表。两个问询项。

> The record assembles from the file. The figure as filed, the document and page
> behind each component, who verified it and how, what the client was asked and
> answered, who signed.

**中** 这份应答记录是从卷宗里自己拼出来的：申报时的数字、每个构成部分背后的文件和页码、谁核验的和怎么核验的、问过客户什么又答了什么、谁签的字。

**做：** 滚到第二个问询项下面的 **the firm's own checks on this item**。

> And this — our own checks on the item they're examining, including the one that
> says our return is wrong.

**中** 还有这个：我们自己对他们正在查的这一项做的检查——**包括那条说我们自己报错了的**。

> Gross receipts are a hundred sixty-three thousand seven hundred. Books revenue
> of a hundred fifty-one three, plus the whole twelve-four Form ten-ninety-nine-K,
> which the deposits detail says was already deposited into sales.

**中** 营业收入总额是 163,700：账面收入 151,300，加上整整 12,400 的 1099-K 表金额——而存款明细显示，这 12,400 早就已经进了销售收入。

> And it confirms twice. A hundred forty-two thousand of contractor forms plus
> ninety-three hundred from clients who issue no form is books revenue to the
> dollar. There's nothing left for that twelve-four to be.

**中** 而且能交叉印证两次：142,000 的承包商表单，加上 9,300 来自不开票客户的收入，正好等于账面收入，分毫不差。那 12,400 已经没有别的身份可以当了。

> Twelve thousand four hundred overstated. About forty-four hundred of federal
> tax. Your diagnostics don't report it.

**中** 多报了 12,400，大约 4,400 的联邦税。你们的诊断没有报出这一条。

💬 *Say this next line slowly:*

> I put that in the examiner's record on purpose. They'll find it anyway. A record
> that hides it is worth less than one that explains it.

**中** 我是**故意**把它放进给稽查员的记录里的。他们反正会查出来。一份藏着它的记录，价值低于一份解释它的记录。

**做：** 点 **Export the record**。

---

## 12:04 — What I'd defend, and what I'd do next

> Four tradeoffs I'd want you to push on.

**中** 有四个取舍，我希望你们追问我。

> One. I don't map last year's resident return onto this year's part-year form.
> Nineteen prior-year lines come back unmatched. Mapping them is a tax judgment,
> and quietly asserting it is exactly the failure this exists to prevent.

**中** 第一，我**没有**把去年的居民申报表映射到今年的部分年度表上，有 19 条上年度行显示为「未匹配」。做这个映射属于税务判断，而**不声不响地替人做判断**，正是这个系统要防的事。

> Two. I don't total the findings. One is income sourced to a state, another is a
> payment an agency hasn't posted. A sum would look like exposure and wouldn't be.

**中** 第二，我**不给发现求总和**。一条是归属到某州的收入，另一条是税局还没入账的缴款。加起来会看着像「风险敞口」，但它不是。

> Three. Estimates stay labelled estimates.

**中** 第三，估算值一直标着「估算」。

> Four. What I'd build next is the rest of the CPA records — depreciation by
> asset, books to tax, the state split. The data model already carries them;
> they're presentation. I spent the time on the spine.

**中** 第四，接下来我会补齐会计师需要的其余报表——按资产的折旧明细、账税差异、州际拆分。数据模型已经撑得住它们了，剩下的只是呈现。我把时间花在了主干上。

---

## 13:16 — How I used AI

> Last thing. I used Claude as an implementation partner. I set the constraints
> and made the judgment calls — including what this deliberately does not do —
> then reviewed what came back and corrected it.

**中** 最后一件事。我把 Claude 当作实现上的搭档。**边界是我定的，判断是我做的——包括这个系统刻意不做什么**；产出回来之后，由我审查和纠正。

> Three places it earned its keep. Solving the arithmetic of a hundred
> twenty-eight lines against your published values. Writing the check suite. And
> catching two of my own bugs — one highlight matched "zero point zero zero"
> inside "eighteen thousand four eighty," then reported the proceeds really
> printed there as missing.

**中** 有三个地方它值回票价：拿你们公布的值反解 128 行的算术关系；写那套检查；以及抓到我自己的两个 bug——其中一个是高亮把「18,480.00」里面的「0.00」当成了匹配，然后把那页上**真的印着**的销售收入报告成了「找不到」。

> Both are written up under corrections. A check that catches your own mistakes is
> the only kind worth trusting.

**中** 两个都写在发现清单的「更正」一节里。**一套能抓到你自己错误的检查，才是唯一值得信任的检查。**

> That's it. Thank you.

**中** 讲完了。谢谢。

---

## If you stumble
