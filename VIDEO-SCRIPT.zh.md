# 讲稿中英对照

英文是你要**照着念**的原话，下面「**中**」开头的是意思。排练时先看中文，确认自己
知道在说什么，再只看英文念。

节奏、删减顺序、发音表都在 [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md)，这里只管翻译。

**几个关键词**（这些词全片反复出现，先记住中文）：

| 英文 | 中文 | 说明 |
|---|---|---|
| workpaper | 工作底稿 | 会计师整理报税表的工作记录 |
| packet | 资料包 | 他们给你的那份 JSON 数据 |
| engine | 引擎 | 他们那套算报税表的系统 |
| ledger | 账本 | 只能往后追加、不能改写的记录 |
| sign-off | 签字 | 复核人签字确认 |
| finding | 发现 | 检查查出来的问题 |
| evidence | 证据 | 支撑某个数字的原始文件 |
| provenance | 来源 | 这个数字是怎么来的 |
| replay | 回放 | 把文件退回某一天的状态 |
| amendment | 修正申报 | 申报后再改，要走的正式流程 |

---

## 0:00 — 开场（停在首页）

> Hi, I'm Joy. This is the workpaper I built for the Okafor-Lindqvist
> twenty twenty-five return.

**中** 我是 Joy。这是我为 Okafor-Lindqvist 这家人 2025 年度报税表做的工作底稿。

> Let me start with the one idea everything came from.

**中** 我先讲那个贯穿全部设计的想法。

> A workpaper isn't a spreadsheet. It's a ledger. There's an immutable fact layer
> — your packet, loaded exactly as you sent it. There's an append-only event
> layer — everything a person does. Every view you see is folded from those two.

**中** 工作底稿不是电子表格，是一本账。底下有一层**不可变的事实**——就是你们给的
资料包，原样载入，一个字没动。上面有一层**只能追加的事件**——人做过的每一件事。
你看到的每一个界面，都是这两层叠出来的。

> So every number on screen can answer two questions. Which facts is it made of.
> And whose actions have touched it.

**中** 所以屏幕上任何一个数字都能回答两个问题：它由哪些事实构成；以及谁的操作动过它。

> The brief asks for proving a number, sign-offs that reopen, freezing at filing,
> answering a notice two years later. Those aren't four features. They're one
> shape. And a grid doesn't have either half of it.

**中** 题目要求：能证明一个数字、签字会自动失效、申报时冻结、两年后能回答税局来信。
这不是四个功能，是同一个结构。而一张表格，这两层哪一层都没有。

💬 *停一下。让画面静两秒再开始点。*

---

## 1:11 — 总览与分类

**做：** 停在 Summary，指一下加州那一块。

> This is what a reviewer opens the file for. The return against last year, both
> jurisdictions.

**中** 复核的人打开文件，就是要看这个：今年的报税表和去年比，联邦和加州两边都在。

> Notice the warnings on California. Last year was a full-year resident return.
> This year is part-year, because they moved to Texas in July. Those two aren't
> measured the same way, so the app says so instead of quietly showing a
> percentage.

**中** 注意加州那边的警告标记。去年是全年居民申报表，今年是部分年度居民——他们七月
搬去了德州。这两张表口径不一样，所以程序直接说出来，而不是悄悄给你算个百分比。

**做：** 点 **Areas**。

> Areas are the firm's own — the headings they budget hours against. California
> has one blocking review note on it.

**中** 这些分类是事务所自己的——他们按这些类目分配工时。加州这一条上挂着一个会阻断
申报的复核意见。

---

## 1:59 — 把一个数字拆到底

**做：** 点 **Wages, Forms W-2, box 1**（工资）。

> Let me take one number apart. Wages. Two hundred twelve thousand four hundred.

**中** 我拆一个数字给你看。工资，212,400。

> Here's the engine's rule, in the engine's own words. Here's the note it left —
> document ten is a second photo of the same W-2, so it's counted once.

**中** 这是引擎的规则，用的是引擎自己的原话。这是它留下的备注——第 10 号文件是同一张
W-2 的第二张照片，所以只算一次。

> And here's what it's built from.

**中** 这是它由什么构成的。

**做：** 指 **Built from**，再指那两个 `ev-` 标签。

> The trace expands down through inputs until it hits evidence. Not a dead end —
> actual evidence.

**中** 这条追溯一路往下展开，直到碰到证据为止。不是展开到一个死胡同，是真的证据。

**做：** 点 **ev-0035**。

> There's the W-2. Rendered as a document, with the exact box highlighted in
> place. Box one, a hundred seven thousand eight hundred. Below it, everything
> else read from this page, and where each value landed.

**中** W-2 出来了。按文件原样渲染，对应的那一栏就地高亮。第 1 栏，107,800。下面是这
一页上读到的其他所有数值，以及每个数值最后落到了报税表的哪一行。

**做：** 把右边文件停在正文最后一行那句话上。

> Now read the last line on this page.

**中** 现在看这一页的最后一行。

> *"Employer payroll kept California as the work state through September
> thirtieth."*

**中** *「雇主的工资系统一直把加州当作工作地，直到 9 月 30 日。」*

> Nobody extracted a value from that sentence. There's no field for it. But it's
> the whole of my second-biggest finding, and I'll come back to it.

**中** 没有人从这句话里抽取出任何数值——它根本没有对应的字段。但我第二大的发现，全部
出自这一句。待会儿我会回来讲它。

> That's why the evidence panel renders the page and not just the box. An
> extraction-only view would never show you that sentence.

**中** 这就是为什么证据面板渲染的是整页，而不只是那一栏。只看抽取结果的界面，永远不会
把这句话摆到你面前。

💬 *全片最重要的一拍，慢一点。*

---

## 3:33 — 接缝，和一个诚实的数字 ✂

**做：** 指那些 `verbatim` / `not located` 小标。

> One decision about the simulated documents.

**中** 关于这些模拟文件，我做了一个决定。

> Your README says the position data is synthetic. Drawing boxes from it would
> put highlights in the wrong place. So I match text instead — and I show which
> way each one matched.

**中** 你们的 README 写明坐标数据是合成的。照它画框，高亮会落在错的位置。所以我改用
文字匹配——而且我把每一个是**怎么**匹配上的标出来。

> Verbatim means it matched the pipeline's own reading, character for character.
> By amount means the reading didn't appear but the number did. Not located means
> the amount isn't printed on that page at all.

**中** `verbatim` 是逐字对上了管道自己的读数。`by amount` 是读数没出现，但那个数字出现
了。`not located` 是这一页上根本没印这个金额。

> Ninety-eight point four percent locate. I'd rather show you that than claim a
> hundred.

**中** 定位成功率 98.4%。我宁愿把这个数字摆给你看，也不想号称 100%。

---

## 4:26 — 一个问题变成证据

**做：** 筛 `gifts by cash`，点进这一行。

**做：** 点 **ev-1049** —— 那张手写收据本身，置信度 0.41。

> The brief asks for questions to the client that become evidence. The second
> half is the part that needed a decision.

**中** 题目要求「向客户提问，并让答案成为证据」。需要做设计决定的是后半句。

> This is a handwritten receipt from a parish. The page prints "dollar
> question-mark comma five hundred." The first digit could be a one or a seven.
> The pipeline read fifteen hundred — at zero point four one confidence.

**中** 这是一张教堂开的手写收据。页面上印的是「$?,500」。第一位数字可能是 1，也可能
是 7。管道把它读成了 1,500——置信度只有 0.41。

> So the preparer asked. The client answered by phone. And that answer is sitting
> right here, in the evidence.

**中** 所以报税员去问了。客户电话里回答了。那个回答，就在这儿，在证据里。

**做：** 指 **Added in review**。

> It has its own reference, and it resolves and opens exactly like an extracted
> value does. The resolver learned one more kind. Nothing else changed.

**中** 它有自己的引用编号，解析和打开的方式跟抽取值完全一样。解析器只是多认识了一种
引用，别的什么都没改。

> And look where it sits. Above the pipeline's own sources, but separate from
> them. Both are evidence. Conflating them would hide which part of this number's
> support the engine never saw.

**中** 再看它摆在哪儿：在管道自己的来源上方，但跟它们分开。两者都是证据。混在一起，
就看不出这个数字的支撑里，有哪一部分是引擎从来没见过的。

---

## 5:43 — 会自己失效的签字

**做：** 回到 **Wages, box 1**，指那两个绿色签字。

> This line is signed. Preparer and reviewer. Watch what happens when I raise a
> blocking review note.

**中** 这一行已经签过字了，报税员和复核人都签了。看我提一条阻断性复核意见会怎么样。

**做：** 写一句复核意见，勾上 **blocks filing**，点 **Add**。

> Both signatures just reopened. And read what they say —

**中** 两个签字刚刚都失效了。看它写的是什么——

> *"No number moved. The verifications or review notes on this item changed, so
> the signature no longer covers what is here."*

**中** *「没有任何数字变动。是这一项上的核验或复核意见发生了变化，所以这个签字已经
覆盖不住现在的内容了。」*

> Nothing told the app this should happen. A sign-off stores a hash of what it
> covered — the line, its inputs all the way down, the values underneath, and the
> work standing at the time. Anything that changes any of that produces a
> different hash. A change nobody anticipated still reopens the signature,
> because the mechanism doesn't depend on anticipating it.

**中** 没有人告诉程序该这么做。签字存的是它所覆盖内容的一个哈希——这一行、它一路往下
的所有输入、底下的数值，以及当时已有的工作记录。其中任何一样变了，哈希就不一样。
**哪怕是没人预料到的变化，签字照样失效**，因为这个机制根本不依赖「预料」。

**做：** 点 **withdraw**。

> Withdraw the note and they come back, because the hash returns to what it was.

**中** 把意见撤回，签字就回来了——因为哈希回到了原来的值。

> But look at the history. Two events struck through. Nothing deleted. The
> database physically refuses updates and deletes — there are triggers that abort
> them. Undo is a compensating event, not an erasure.

**中** 但看历史记录：两条事件被划掉了，没有任何东西被删除。数据库在物理层面拒绝更新和
删除——有触发器直接中止它们。「撤销」是一条冲销事件，不是抹掉。

💬 *如果签字没立刻翻，就说一句 "give it a moment"，继续往下。*

---

## 7:12 — 四种数字

**做：** 点 **← Overview**，再点 **Adjustments**。

> Now the hardest decision, and the one I'd most want to be asked about.

**中** 接下来是最难的那个决定，也是我最希望你们追问的。

> The engine can't be rerun. So what is an adjusted number?

**中** 引擎没法重跑。那么，一个「调整后的数字」到底是什么？

> My answer is it's one of four things, and the app says which one, next to the
> figure. Engine, as you published it. Manual, where a person set it with a
> reason. Recomputed. Or estimated.

**中** 我的答案是：它只能是四种之一，而且程序会在数字旁边标明是哪一种。**engine**——
你们发布的原值；**manual**——人工设定，并附理由；**recomputed**——重算得出；
或者 **estimated**——估算。

> The recomputation isn't assumed. Your rule is documented as "arithmetic
> combination of the listed input lines" — not a sum. So for every line like
> that, I solved for the combination that reproduces your own published value,
> and checked it against it.

**中** 重算不是靠猜。你们的规则文档写的是「所列输入行的**算术组合**」——没说是求和。
所以对每一条这样的行，我反解出能复现你们自己公布值的那个组合，再拿它去跟原值核对。

> A hundred twenty-eight lines. All hundred twenty-eight reproduce exactly. And
> nineteen of them subtract. If I'd assumed a sum, I'd have been wrong in both
> directions.

**中** 一共 128 行，128 行全部精确复现。其中 19 行是**减法**。如果我当初假定是求和，
正反两个方向都会错。

**做：** 滚到 **Where the change stopped**。

> Five lines resist. Their declared inputs can't produce their own value — which
> is a finding in itself.

**中** 有 5 行解不出来：它们声明的输入推不出它们自己的值——这本身就是一个发现。

> And here's the part I care about. Propagation **stops**. Seven barriers, each
> naming the rule that stops it. Beyond them, eighty-one lines — including the
> tax computation — are reported as unknown.

**中** 下面是我最在意的部分：**传播会停**。有 7 道屏障，每一道都写明是哪条规则把它
拦住的。屏障之外的 81 行——包括税额计算本身——一律报告为「未知」。

> Not estimated. Unknown. Beyond a line I can't derive, the figures aren't
> approximately known. They're not known.

**中** 不是「估算」，是「未知」。在一条我推不出来的行之后，那些数字不是「大致知道」，
是**不知道**。

---

## 8:59 — 每一份文件，和它去了哪里 ✂

**做：** 点 **Documents**，再点 **Unexplained 4**。

> The brief asks to trace any document to everywhere it landed, or why it didn't.
> That second half turned out to matter more.

**中** 题目要求：能把任意一份文件追踪到它落到的所有位置，或者说明它为什么没落到任何
地方。结果后半句才是真正重要的那一半。

> Seventy-four documents. Fifty-six land on a line. Eighteen don't. And until
> this index existed, those eighteen couldn't be opened at all — the only way to
> reach a document was clicking a source on a line.

**中** 74 份文件，56 份落到了某一行，18 份没有。而在这个索引出现之前，这 18 份**根本
打不开**——因为打开文件的唯一途径，是点某一行上的来源引用。

> Fourteen the file explains by itself. Superseded, never extracted, cited by the
> prior-year records, a duplicate, evidence for a required step.

**中** 其中 14 份，文件自己能解释：被取代了、从未被抽取、被上年度记录引用、重复件、
或者是某个必做步骤的证据。

> Four are explained by nothing.

**中** 剩下 4 份，没有任何东西能解释。

**做：** 指 **D73**。

> And this is the paystub I promised to come back to. Pay date July eighteenth.
> Work location changed to Austin, effective July fifteenth. California taxable
> wages of twenty-two thousand four hundred sixty-nine at the move.

**中** 这就是我答应要回来讲的那张工资单。发薪日 7 月 18 日。工作地变更为奥斯汀，
7 月 15 日生效。搬家时点的加州应税工资是 22,469。

> It arrived in March, three months before your engine's last run. Extracted at
> point nine nine confidence. And nothing cites it — while the return sources all
> two hundred eighteen thousand of wages to California, off box sixteen.

**中** 它三月就到了，比你们引擎最后一次运算早三个月。抽取置信度 0.99。但**没有任何
一行引用它**——与此同时，报税表把全部 218,000 的工资都按第 16 栏算成了加州来源。

> Eighty-eight thousand overstated. About fifty-seven hundred of California tax.
> And I didn't have to apportion anything to say so. The document was already in
> the file.

**中** 多算了 88,000，大约 5,700 的加州税。而且我**不需要自己做任何分摊**就能这么说——
那份文件本来就在卷宗里。

---

## 10:41 — 295 笔交易，不用一笔笔读 ✂

**做：** 点 **Sales**。

> Large detail, without swamping the review.

**中** 大体量明细，但不把复核的人淹掉。

> Box totals first — and all seven tie to your own total for that box, added here
> from the lots.

**中** 先给各栏合计——七栏全部跟你们自己给的该栏合计对得上，而这里的数是从每一笔明细
加出来的。

> Then forty-five lots worth a look. Twenty-eight wash sales. Thirteen whose
> basis came from a second document. Four with no basis reported at all — and
> those four are restricted stock, which is the classic way an RSU sale gets
> taxed twice.

**中** 然后是 45 笔值得看一眼的。28 笔洗售；13 笔的成本基础来自第二份文件；4 笔完全
没报成本基础——而这 4 笔都是限制性股票，这正是 RSU 卖出被重复征税的典型形态。

> Somebody who reads only this first screen has still seen everything that could
> be wrong.

**中** 一个人哪怕只看这第一屏，该出问题的地方他也全看到了。

---

## 11:33 —「我们检查过了」到底是什么意思

**做：** 切到终端跑 `npm run checks`，然后点 **Open items**。

> Nineteen checks. A hundred twelve findings.

**中** 19 项检查，112 个发现。

> Low ones are hidden by default — seventy-eight are unexplained prior-year
> variances and they'd bury everything else.

**中** 低优先级的默认折叠——其中 78 个是没有解释的上年度差异，摊开会把别的全埋掉。

**做：** 在加州来源那条发现上点 **why this check**。

> Every check states what it establishes **without trusting the engine**, and the
> app shows you that sentence next to the finding. "We checked this" should be
> something you can inspect, not something I assert.

**中** 每一项检查都写明：**在不信任引擎的前提下**，它能确立什么。程序把这句话就放在
发现旁边。「我们检查过了」应该是一件你能查验的事，而不是我说了算。

> Two checks report zero, and that's also a result. One re-tests your own
> diagnostics. It's clean.

**中** 有两项检查报告 0 个发现——这同样是一个结果。其中一项是在重测你们自己的诊断，
结果是干净的。

**做：** 滚到 **Addressed**。

> And a finding closes two ways. Dismissed means somebody argued it away, with a
> reason and a name. Addressed means the figure was changed to what the other
> record says. The check still reports it — your return still says what it said —
> but the required step it feeds ticks itself.

**中** 一个发现有两种关闭方式。**dismissed** 是有人把它论证掉了，附带理由和署名。
**addressed** 是数字已经按另一份记录改了。检查仍然会报告它——因为你们的报税表上写的
还是原来那个数——但它所支撑的那个必做步骤，会自己打勾。

---

## 12:45 — 回放、冻结、修正

**做：** 点 **Timeline**，在 2026-03-12 那一行点 **show here**。

> The file doesn't have one present. Your timeline runs from an engagement letter
> to an examination letter in twenty twenty-eight. So the clock is a position.

**中** 这份卷宗没有唯一的「现在」。你们的时间线从一封业务约定书，一直延伸到 2028 年
的一封稽查信。所以「时钟」在这里是一个**位置**。

> Here's the file as it stood on March twelfth. Engine version one. Federal AGI
> reads four hundred twenty-eight thousand. Sixty-four documents.

**中** 这是 3 月 12 日那天卷宗的样子。引擎第 1 版。联邦调整后总收入显示 428,000。
64 份文件。

**做：** 在 2026-03-19 点 **show here**，然后点 **Return to live**。

> March nineteenth, version two. Live, version three, seventy-four documents.

**中** 3 月 19 日，第 2 版。回到实时，第 3 版，74 份文件。

> Documents that hadn't arrived aren't greyed out — they're not in the index at
> all. And replay is read-only, because recording work against a past view is
> writing history, not replaying it.

**中** 那天还没到的文件不是灰显——它们**根本不在索引里**。而且回放是只读的，因为在一个
过去的视图上记录工作，那叫篡改历史，不叫回放。

**做：** 把右上角角色切成 **Daniel Ortiz — reviewer**（报税员无权申报，用 Priya 会被
拒绝），再点 **Freeze and file federal**。然后试着改一行，再打开修正申报。

> Filing snapshots all six hundred twenty-seven lines with a hash of them.

**中** 申报会把全部 627 行连同它们的哈希一起快照下来。

> Now try to adjust something. Refused. Open an amendment — now it's allowed, on
> top of a return that stays exactly as transmitted.

**中** 现在试着改点什么。被拒绝。打开一份修正申报——现在可以改了，而且是改在一张
**与报送时一字不差**的报税表之上。

---

## 13:57 — 两年后回答税局来信

**做：** 点 **After filing**。

> A letter from the IRS. Twenty twenty-eight. Two items.

**中** 一封国税局来信，2028 年，两个问询项。

> *（注：屏幕上大字是 "tax year 2025"——被查的年度；2028 在下面那行小字
> `dated 2028-01-20`，是来信日期。）*

> The record assembles from the file. The figure as filed. The document and page
> behind each component. The field, and what was printed there. Who verified it,
> and how. What the client was asked, and answered. Who signed.

**中** 这份应答记录是从卷宗里自己拼出来的：申报时的数字；每个构成部分背后的文件和页码；
字段本身，以及那上面印的是什么；谁核验的、怎么核验的；问过客户什么、客户答了什么；
谁签的字。

**做：** 滚到第二个问询项下面的 **the firm's own checks on this item**。

> And this. Our own checks on the item they're examining — including the one that
> says our return is wrong.

**中** 还有这个：我们自己对他们正在查的这一项做的检查——**包括那条说我们自己报错了的**。

> Gross receipts are a hundred sixty-three thousand seven hundred. That's books
> revenue of a hundred fifty-one three, plus the whole twelve-four Form
> ten-ninety-nine-K — which the deposits detail says was already deposited into
> sales.

**中** 营业收入总额是 163,700。这等于账面收入 151,300，加上整整 12,400 的 1099-K 表
金额——而存款明细显示，这 12,400 早就已经进了销售收入里。

> And it confirms twice. A hundred forty-two thousand of contractor forms, plus
> ninety-three hundred from clients who issue no form, is books revenue to the
> dollar. There's nothing left for that twelve-four to be.

**中** 而且能交叉印证两次：142,000 的承包商表单，加上 9,300 来自不开票客户的收入，
正好等于账面收入，分毫不差。那 12,400 已经没有别的身份可以当了。

> Twelve thousand four hundred overstated. About forty-four hundred of federal
> tax. Your diagnostics don't report it.

**中** 多报了 12,400，大约 4,400 的联邦税。你们的诊断没有报出这一条。

💬 *下面这句说慢一点：*

> I put that in the examiner's record on purpose. They'll find it anyway. A
> record that hides it is worth less than one that explains it.

**中** 我是**故意**把它放进给稽查员的记录里的。他们反正会查出来。一份藏着它的记录，
价值低于一份解释它的记录。

**做：** 点 **Export the record**。

---

## 15:35 — 我会为之辩护的取舍，以及接下来会做什么

> Four tradeoffs I'd want you to push on.

**中** 有四个取舍，我希望你们追问我。

> One. I don't map last year's resident return onto this year's part-year form.
> Nineteen prior-year lines come back unmatched. Mapping them is a tax judgment,
> and quietly asserting it is exactly the failure this thing exists to prevent.

**中** 第一，我**没有**把去年的居民申报表映射到今年的部分年度表上。有 19 条上年度行
显示为「未匹配」。做这个映射属于税务判断，而**不声不响地替人做判断**，正是这个系统
存在的意义所在——它要防的就是这个。

> Two. I don't total the findings. One is gross income sourced to a state,
> another is a payment an agency hasn't posted, another is a deduction. A sum
> would look like exposure and wouldn't be.

**中** 第二，我**不给发现求总和**。一条是归属到某州的总收入，一条是税局还没入账的
缴款，另一条是扣除项。加起来会看着像「风险敞口」，但它不是。

> Three. Estimates stay labelled estimates. Where recomputation reaches a
> balance, it supersedes the estimate rather than sitting beside it.

**中** 第三，估算值一直标着「估算」。如果重算能推到某个余额，它会**取代**那个估算值，
而不是跟它并排摆着。

> Four. What I'd build next is the rest of the CPA records — depreciation by
> asset, books to tax, the state split as its own view. The data model already
> carries them. They're presentation. I spent the time on the spine instead,
> because everything else hangs off it.

**中** 第四，接下来我会补齐会计师需要的其余报表——按资产的折旧明细、账税差异、州际拆分
各自成页。数据模型已经撑得住它们了，剩下的只是呈现。我把时间花在主干上，因为别的东西
全挂在主干上。

---

## 16:59 — 我是怎么用 AI 的

> Last thing, since you asked.

**中** 最后一件事，既然你们问了。

> Claude wrote most of the code, against a design I set and decisions I made.

**中** 大部分代码是 Claude 写的，但架构是我定的，决定是我做的。

> Three places it earned its keep. Solving the arithmetic of a hundred
> twenty-eight lines against your published values. Writing the check suite. And
> catching two of my own bugs.

**中** 有三个地方它真的值回票价：拿你们公布的值反解 128 行的算术关系；写那套检查；
以及抓到我自己的两个 bug。

> The first — a highlight that matched "zero point zero zero" inside "eighteen
> thousand four eighty," claimed that spot, and then reported the proceeds that
> really were printed there as missing. The second — document grouping that
> ignored tax year, so a twenty twenty-three and a twenty twenty-five K-1 looked
> like a contradiction.

**中** 第一个：高亮把「18,480.00」里面的「0.00」当成了匹配，占住了那个位置，然后把那页
上**真的印着**的销售收入报告成了「找不到」。第二个：文件分组时没考虑税务年度，结果一张
2023 年和一张 2025 年的 K-1 看起来像是互相矛盾。

> Both are written up in the findings file, under corrections. A check that
> catches your own mistakes is the only kind worth trusting.

**中** 这两个都写在发现清单的「更正」一节里。**一套能抓到你自己错误的检查，才是唯一
值得信任的检查。**

> That's it. Thanks for reading all of this.

**中** 讲完了。谢谢你们看完这些。

---

## 念不下去的时候

别停录。闭嘴，停两秒，然后**从这句话的开头**重念一遍。那两秒静音就是干净的剪辑点——
在 Descript 里，删掉那段文字就等于删掉那条废话。

上面每个标题都是天然的断点：每一段开头都在不同的屏幕上，所以在那儿剪，看不出来。
