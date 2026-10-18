# Approach and key decisions

A workpaper is not a spreadsheet. It is a **ledger**: an immutable fact layer
(the packet, loaded as delivered), an append-only event layer (everything people
do), and views folded from the two. Every number answers two questions — which
facts is it made of, and whose actions have touched it. Prove-the-number,
sign-offs that reopen, freeze-then-amend, and answering a notice years later are
not four features; they are one shape.

**One reference grammar, one resolver.** The packet addresses everything by short
strings in eleven formats. A single parser makes every click-through the same
operation: all 8,691 references parse, all 2,749 reference sites in the current
return resolve. When client answers had to become evidence, they got a reference
in the same grammar and nothing else changed.

**Append-only, enforced by the database.** Triggers abort UPDATE and DELETE, so
undo is a compensating event and the withdrawn entry stays on the record — one
decision covering keep-the-original, show-what-changed, bulk undo and
freeze-then-amend.

**A sign-off stores a hash of what it covered** — the line, its inputs traced all
the way down, the values underneath, and the work standing at the time. Nothing
has to be told a change happened; a change nobody anticipated still reopens it.

**The engine cannot be rerun, so every number says which of four things it is:**
engine, manual, recomputed, estimated. The recomputation is not assumed — for each
line that is arithmetic over others, the combination reproducing the engine's own
published value is solved for and verified: 128 lines, all exact, 19 of them
subtracting. Five resist, and propagation **stops** there, because beyond them the
figures are unknown rather than approximately known.

A rule lives where its state lives, so every path asks the same one, and
seventeen tests assert the refusals: filing while a blocking note stands,
adjusting a filed return, withdrawing an entry that is not yours.

What it refuses to do is as deliberate: no mapping of Form 540 onto Form 540NR
after a mid-year move, and no totalling of findings that are not the same kind of
number.

Nineteen checks found 112 issues; ten are written up, **none of them reported by
the engine's own diagnostics**, and both items the IRS examines in the 2028
letter carry findings. The largest: Schedule C gross receipts carry the whole
Form 1099-K on top of books revenue that already contains it — 12,400 overstated,
about 4,402 of federal tax. The books record proving it had been in the file,
read, and cited by nothing.

The two diagrams of this shape, the ten write-ups, and the running application
are in the repository.
