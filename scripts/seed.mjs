/**
 * Seed a demonstration state.
 *
 * This is a scripted session, not a database fixture: it drives the app's own
 * HTTP API, as the people it names, in the order they would actually work. So it
 * exercises the same rules a reviewer would hit — independence, the partner
 * threshold, the filing freeze — and if one of those rules changes, the seed
 * breaks loudly instead of writing a state the app would never have produced.
 *
 *   node scripts/seed.mjs                       # against localhost:3000
 *   node scripts/seed.mjs --url https://…       # against a deployed instance
 *   node scripts/seed.mjs --no-file             # stop before filing
 *
 * The event log is append-only by design, so there is no undo. The script
 * refuses to run against a file that already has work in it; to start clean,
 * delete `data/events.db*` locally, or detach and re-add the volume on a host.
 */

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = option("--url", "http://localhost:3000").replace(/\/$/, "");
const DO_FILE = !flag("--no-file");

/** Minimal cookie jar: the acting role is a server-side cookie. */
let cookie = "";

async function call(path, body, method) {
  const response = await fetch(BASE + path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const setCookie = response.headers.getSetCookie?.() ?? [];
  for (const raw of setCookie) {
    const pair = raw.split(";")[0];
    const name = pair.split("=")[0];
    const kept = cookie.split("; ").filter((c) => c && !c.startsWith(name + "="));
    cookie = [...kept, pair].join("; ");
  }

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned ${response.status}: ${text.slice(0, 120)}`);
  }
  if (!response.ok) throw new Error(`${path}: ${json.error ?? response.status}`);
  return json;
}

const event = (type, scope, payload) => call("/api/events", { type, scope, payload });
const line = (id) => ({ kind: "line", id });
const returnScope = { kind: "return", id: "2025" };

let step = 0;
const say = (text) => console.log(`  ${String(++step).padStart(2)}. ${text}`);
const actAs = async (id, name) => {
  await call("/api/actor", { actorId: id });
  console.log(`\n— as ${name} —`);
};

async function main() {
  console.log(`Seeding ${BASE}\n`);

  const existing = await call("/api/checks");
  if (existing.dismissals.length || existing.completedSteps.length) {
    throw new Error("This file already has work in it. See the note at the top of this script.");
  }
  const ledgerBefore = await call("/api/adjusted");
  if (ledgerBefore.ledger.length > 0) {
    throw new Error("This file already has adjustments. See the note at the top of this script.");
  }

  // ---------------------------------------------------------------- preparer
  await actAs("st-01", "Priya Raman, preparer");

  await event("verification", line("F1040.1a"), {
    verificationType: "agreed_to_source_document",
    note: "Agreed both Form W-2 box 1 amounts. D10 is a second image of D09 and is counted once.",
  });
  say("verified wages against both W-2s");

  const question = await event("question", line("SchA.11"), {
    to: "client",
    text: "The St Brigid receipt reads $?,500.00 and the first digit is ambiguous — 1 or 7. Can you confirm the amount, and is there a bank record?",
  });
  say("asked the client about the handwritten receipt");

  const answer = await event("answer", line("SchA.11"), {
    targetEventId: question.event.id,
    channel: "phone",
    onBehalfOf: "Ngozi Okafor",
    text: "St Brigid confirmed by phone the gift was 1,500 — matches our bank statement, check #2207 dated 12/21/2025.",
  });
  say("recorded the answer, taken by phone");

  await event("cite", line("SchA.11"), {
    ref: `wp:${answer.event.id}`,
    note: "Resolves the ambiguous first digit on D64.",
  });
  say("attached the answer to the line as evidence");

  await event("verification", line("SchA.11"), {
    verificationType: "confirmed_with_client",
    note: "Amount confirmed with the parish and agreed to the client's bank record.",
  });
  say("verified the gift, confirmed with client");

  await event("variance_explained", line("SchB.1.4"), {
    text: "Not a decrease. Sparbanken Norrland moved from line 1.4 to 1.6 when the payer count went from four to eight; 1.4 is now Austin Community Credit Union, a new account after the move.",
  });
  say("explained the Schedule B payer shift");

  // Findings whose right answer is a fact in another record, applied as one action.
  const checks = await call("/api/checks");
  const agency = checks.findings.filter((f) => f.checkId === "RECON-AGENCY").map((f) => f.id);
  const bulk = await call("/api/bulk", { action: "apply_findings", findingIds: agency });
  say(`applied ${bulk.applied} agency reconciliation findings as one action`);

  const gift = checks.findings.find((f) => f.checkId === "RECON-NONCASH-GIFT");
  if (gift) {
    await event("adjustment", line(gift.suggestedAdjustment.lineKey), {
      to: gift.suggestedAdjustment.to,
      reason: "Valued at the gross proceeds the charity reported on Form 1098-C, not the client's Kelley Blue Book estimate.",
    });
    say("corrected the donated vehicle to the Form 1098-C proceeds");
  }

  for (const key of ["F1040.1a", "SchA.11"]) {
    await event("signoff", line(key), { level: "preparer" });
  }
  say("signed off at preparer level on both lines");

  // ---------------------------------------------------------------- reviewer
  await actAs("st-02", "Daniel Ortiz, reviewer");

  await event("review_note", line("SchCA540NR.1.E"), {
    text: "Box 16 reports California for the whole year, but the household moved 07/15 and the W-2 page says payroll kept CA as the work state through 09/30. The wage split needs apportioning before this is filed.",
    blocking: true,
  });
  say("raised a blocking review note on the California wage split");

  for (const key of ["F1040.1a", "SchA.11"]) {
    await event("signoff", line(key), { level: "reviewer" });
  }
  say("signed off at reviewer level on both lines");

  // ----------------------------------------------------------------- partner
  await actAs("st-03", "Helen Strand, partner");

  const pending = (await call("/api/adjusted")).ledger.filter((e) => !e.applied);
  for (const entry of pending) {
    await event("adjustment_approved", line(entry.lineKey), { targetEventId: entry.eventId });
  }
  say(`approved ${pending.length} adjustment${pending.length === 1 ? "" : "s"} over the firm's 1,000 threshold`);

  if (!DO_FILE) {
    await report();
    console.log("\nStopped before filing (--no-file); the freeze is left to perform.");
    return;
  }

  await event("filing", returnScope, { jurisdiction: "federal" });
  say("froze and filed the federal return");

  await event("amendment_opened", returnScope, {
    reason: "Form 1099-K card deposits were counted twice in Schedule C gross receipts.",
  });
  say("opened an amendment after the 1099-K double count came to light");

  // --------------------------------------------------- the amendment itself
  await actAs("st-01", "Priya Raman, preparer");

  const schc = (await call("/api/checks")).findings.find(
    (f) => f.checkId === "RECON-SCHC-GROSS" && f.suggestedAdjustment,
  );
  if (schc) {
    await event("adjustment", line("SchC.1"), {
      to: schc.suggestedAdjustment.to,
      reason: "Card deposits are already inside books revenue; the deposits detail records them as Sales.",
    });
    say("adjusted gross receipts inside the amendment");
  }

  await actAs("st-03", "Helen Strand, partner");
  const stillPending = (await call("/api/adjusted")).ledger.filter((e) => !e.applied);
  for (const entry of stillPending) {
    await event("adjustment_approved", line(entry.lineKey), { targetEventId: entry.eventId });
  }
  say(`approved the amendment adjustment`);

  await report();
}

async function report() {
  const [checks, adjusted, clock] = await Promise.all([
    call("/api/checks"),
    call("/api/adjusted"),
    call("/api/clock"),
  ]);

  const closed = new Set([
    ...checks.dismissals.map((d) => d.findingId),
    ...checks.addressed.map((a) => a.findingId),
  ]);

  console.log("\n— where the file now stands —\n");
  console.log(`  open items        ${checks.findings.filter((f) => !closed.has(f.id)).length} of ${checks.findings.length}`);
  console.log(`  addressed         ${checks.addressed.length}`);
  console.log(`  adjustments       ${adjusted.ledger.length} (${adjusted.summary.pendingCount} awaiting a partner)`);
  for (const movement of adjusted.movements) {
    console.log(
      `  ${movement.jurisdiction.padEnd(11)} ${movement.label.padEnd(16)} ${movement.from.toLocaleString("en-US")} -> ${movement.to.toLocaleString("en-US")}`,
    );
  }
  console.log(`  filed             ${clock.filing.filedJurisdictions.join(", ") || "nothing"}`);
  console.log(`  amending          ${clock.filing.amending}`);
  console.log(`\n  ${BASE}`);
}

main().catch((error) => {
  console.error(`\nFailed at step ${step + 1}: ${error.message}`);
  process.exit(1);
});
