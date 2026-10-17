/**
 * Fail-closed integration tests.
 *
 * Every case here asserts a *refusal*. The bugs these cover were all the same
 * shape: a rule stated in one place and enforced in one path, so a second path
 * to the same event quietly skipped it. A test that only checks the happy path
 * cannot catch that — the happy path is exactly what still worked.
 *
 * Run against a server on a database of its own:
 *
 *   npm run test:fail-closed
 *
 * or point it at one you started yourself:
 *
 *   node scripts/fail-closed.mjs --url http://localhost:3100
 */

const url = (() => {
  const i = process.argv.indexOf("--url");
  return (i > -1 ? process.argv[i + 1] : "http://localhost:3100").replace(/\/$/, "");
})();

let cookie = "";
async function api(path, init = {}) {
  const res = await fetch(url + path, {
    ...init,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) },
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  return { status: res.status, body };
}
const post = (path, payload) => api(path, { method: "POST", body: JSON.stringify(payload) });
const be = (actorId) => post("/api/actor", { actorId });
const event = (type, scope, payload) => post("/api/events", { type, scope, payload });
const line = (id) => ({ kind: "line", id });
const scopeOf = (id) => api(`/api/scope?kind=line&id=${encodeURIComponent(id)}`);

/** Reset to a clean slate by reverting everything that still stands. */
async function reset() {
  await be("st-03"); // a partner may withdraw anyone's entry
  for (let pass = 0; pass < 6; pass += 1) {
    const { body } = await api("/api/events?limit=10000");
    const events = body.events ?? [];
    const reverted = new Set(
      events.filter((e) => e.type === "revert").map((e) => e.payload?.targetEventId),
    );
    const live = events.filter(
      (e) => e.type !== "revert" && !reverted.has(e.id) && e.type !== "sensitive_view",
    );
    if (live.length === 0) return;
    for (const e of live.reverse()) {
      await event("revert", e.scope, { targetEventId: e.id, reason: "test reset" });
    }
  }
}

let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    await reset();
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push({ name, message: String(err.message ?? err) });
    console.log(`  FAIL ${name}\n       ${String(err.message ?? err)}`);
  }
}
function refused(result, what) {
  if (result.status < 400) {
    throw new Error(`${what}: expected a refusal, got ${result.status} ${JSON.stringify(result.body).slice(0, 120)}`);
  }
}
function allowed(result, what) {
  if (result.status >= 400) {
    throw new Error(`${what}: expected to be allowed, got ${result.status} ${JSON.stringify(result.body).slice(0, 160)}`);
  }
}
function equal(actual, expected, what) {
  if (actual !== expected) throw new Error(`${what}: expected ${expected}, got ${actual}`);
}

const FED = "F1040.2b"; // taxable interest, federal, numeric
const CA = "SchCA540NR.1.E"; // California wages, a California line

console.log(`fail-closed suite against ${url}\n`);

/* ---- a sign-off covers the figure, not just the paperwork ---- */

await check("an adjustment reopens a sign-off on the line", async () => {
  await be("st-01");
  allowed(await event("signoff", line(FED), { level: "preparer" }), "sign-off");
  const before = (await scopeOf(FED)).body.signoffs[0];
  equal(before.valid, true, "sign-off before the adjustment");
  allowed(await event("adjustment", line(FED), { to: 5450, reason: "test" }), "adjustment");
  const after = (await scopeOf(FED)).body.signoffs[0];
  equal(after.valid, false, "sign-off after the adjustment");
});

await check("an adjustment reopens a sign-off downstream of it", async () => {
  await be("st-01");
  allowed(await event("signoff", line("F1040.9"), { level: "preparer" }), "sign-off on total income");
  equal((await scopeOf("F1040.9")).body.signoffs[0].valid, true, "before");
  allowed(await event("adjustment", line(FED), { to: 5450, reason: "test" }), "adjustment upstream");
  equal((await scopeOf("F1040.9")).body.signoffs[0].valid, false, "after");
});

await check("withdrawing the adjustment restores the sign-off", async () => {
  await be("st-01");
  allowed(await event("signoff", line(FED), { level: "preparer" }), "sign-off");
  const adj = await event("adjustment", line(FED), { to: 5450, reason: "test" });
  allowed(adj, "adjustment");
  equal((await scopeOf(FED)).body.signoffs[0].valid, false, "while adjusted");
  allowed(await event("revert", line(FED), { targetEventId: adj.body.event.id, reason: "test" }), "revert");
  equal((await scopeOf(FED)).body.signoffs[0].valid, true, "after withdrawing");
});

/* ---- a blocking note stops a transmission ---- */

await check("a blocking note refuses a filing of its own jurisdiction", async () => {
  await be("st-01");
  allowed(await event("review_note", line(FED), { text: "test", blocking: true }), "note");
  await be("st-02");
  refused(await event("filing", { kind: "return", id: "federal" }, { jurisdiction: "federal" }), "filing");
});

await check("a blocking note on a California line does not refuse a federal filing", async () => {
  await be("st-01");
  allowed(await event("review_note", line(CA), { text: "test", blocking: true }), "note");
  await be("st-02");
  allowed(await event("filing", { kind: "return", id: "federal" }, { jurisdiction: "federal" }), "federal filing");
});

await check("a blocking note of no jurisdiction refuses every filing", async () => {
  await be("st-01");
  allowed(
    await event("review_note", { kind: "document", id: "D09" }, { text: "test", blocking: true }),
    "note on a document",
  );
  await be("st-02");
  refused(await event("filing", { kind: "return", id: "federal" }, { jurisdiction: "federal" }), "federal filing");
  refused(
    await event("filing", { kind: "return", id: "california" }, { jurisdiction: "california" }),
    "california filing",
  );
});

await check("resolving the note lets the filing through", async () => {
  await be("st-01");
  const note = await event("review_note", line(FED), { text: "test", blocking: true });
  allowed(note, "note");
  await be("st-02");
  refused(await event("filing", { kind: "return", id: "federal" }, { jurisdiction: "federal" }), "filing while open");
  allowed(
    await event("review_note_resolved", line(FED), { targetEventId: note.body.event.id, text: "settled" }),
    "resolve",
  );
  allowed(await event("filing", { kind: "return", id: "federal" }, { jurisdiction: "federal" }), "filing once resolved");
});

await check("a preparer cannot transmit a return", async () => {
  await be("st-01");
  refused(await event("filing", { kind: "return", id: "federal" }, { jurisdiction: "federal" }), "filing as preparer");
});

await check("the same return cannot be filed twice", async () => {
  await be("st-02");
  allowed(await event("filing", { kind: "return", id: "federal" }, { jurisdiction: "federal" }), "first filing");
  refused(await event("filing", { kind: "return", id: "federal" }, { jurisdiction: "federal" }), "second filing");
});

/* ---- the freeze holds on every path that writes an adjustment ---- */

async function fileFederal() {
  await be("st-02");
  allowed(await event("filing", { kind: "return", id: "federal" }, { jurisdiction: "federal" }), "filing");
}

await check("after filing, a single adjustment is refused", async () => {
  await fileFederal();
  refused(await event("adjustment", line(FED), { to: 5450, reason: "test" }), "adjustment after filing");
});

await check("after filing, a bulk apply is refused", async () => {
  await fileFederal();
  const { body } = await api("/api/checks");
  const ids = (body.findings ?? []).filter((f) => f.suggestedAdjustment).slice(0, 2).map((f) => f.id);
  if (ids.length === 0) throw new Error("no applicable findings to test with");
  refused(await post("/api/bulk", { action: "apply_findings", findingIds: ids }), "bulk apply after filing");
});

await check("after filing, a bulk undo is refused", async () => {
  const { body } = await api("/api/checks");
  const ids = (body.findings ?? []).filter((f) => f.suggestedAdjustment).slice(0, 1).map((f) => f.id);
  if (ids.length === 0) throw new Error("no applicable findings to test with");
  await be("st-01");
  const bulk = await post("/api/bulk", { action: "apply_findings", findingIds: ids });
  allowed(bulk, "bulk apply before filing");
  await fileFederal();
  refused(await post("/api/bulk", { action: "undo_group", groupId: bulk.body.groupId }), "bulk undo after filing");
});

await check("inside an amendment, an adjustment is allowed again", async () => {
  await fileFederal();
  refused(await event("adjustment", line(FED), { to: 5450, reason: "test" }), "before the amendment");
  allowed(
    await event("amendment_opened", { kind: "return", id: "federal" }, { reason: "test" }),
    "open amendment",
  );
  allowed(await event("adjustment", line(FED), { to: 5450, reason: "test" }), "inside the amendment");
});

/* ---- withdrawing is the author's, or a reviewer's ---- */

await check("a preparer cannot bulk-undo another preparer's group", async () => {
  const { body } = await api("/api/checks");
  const ids = (body.findings ?? []).filter((f) => f.suggestedAdjustment).slice(0, 1).map((f) => f.id);
  if (ids.length === 0) throw new Error("no applicable findings to test with");
  await be("st-01");
  const bulk = await post("/api/bulk", { action: "apply_findings", findingIds: ids });
  allowed(bulk, "bulk apply");
  await be("st-04");
  refused(await post("/api/bulk", { action: "undo_group", groupId: bulk.body.groupId }), "undo as another preparer");
});

await check("a reviewer may bulk-undo another preparer's group", async () => {
  const { body } = await api("/api/checks");
  const ids = (body.findings ?? []).filter((f) => f.suggestedAdjustment).slice(0, 1).map((f) => f.id);
  if (ids.length === 0) throw new Error("no applicable findings to test with");
  await be("st-01");
  const bulk = await post("/api/bulk", { action: "apply_findings", findingIds: ids });
  allowed(bulk, "bulk apply");
  await be("st-02");
  allowed(await post("/api/bulk", { action: "undo_group", groupId: bulk.body.groupId }), "undo as reviewer");
});

await check("a preparer cannot withdraw another preparer's single entry", async () => {
  await be("st-01");
  const note = await event("note", line(FED), { text: "test" });
  allowed(note, "note");
  await be("st-04");
  refused(await event("revert", line(FED), { targetEventId: note.body.event.id, reason: "test" }), "revert");
});

/* ---- replay is read-only on every path ---- */

await check("replay refuses a single adjustment and a bulk apply alike", async () => {
  const { body } = await api("/api/checks");
  const ids = (body.findings ?? []).filter((f) => f.suggestedAdjustment).slice(0, 1).map((f) => f.id);
  await be("st-01");
  allowed(await post("/api/clock", { asOf: "2026-03-12" }), "move the clock");
  try {
    refused(await event("adjustment", line(FED), { to: 5450, reason: "test" }), "adjustment during replay");
    if (ids.length > 0) {
      refused(await post("/api/bulk", { action: "apply_findings", findingIds: ids }), "bulk during replay");
    }
  } finally {
    await post("/api/clock", { asOf: null });
  }
});

await reset();

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f.name}: ${f.message}`);
  process.exit(1);
}
