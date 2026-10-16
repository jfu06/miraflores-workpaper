"use client";

import { useCallback, useEffect, useState } from "react";

import type { ReviewLevel, Scope, VerificationType } from "@/lib/events/types";
import { REVIEW_LEVELS, VERIFICATION_TYPES } from "@/lib/events/types";
import { appendEvent, fetchScope, type ScopeState } from "@/lib/view/client";
import { formatValue } from "@/lib/view/format";
import { Questions } from "./Questions";
import { Chip, Section } from "./ui";

const VERIFICATION_LABEL: Record<VerificationType, string> = {
  agreed_to_source_document: "Agreed to source document",
  recalculated: "Recalculated",
  confirmed_with_client: "Confirmed with client",
  agreed_to_prior_year: "Agreed to prior year",
  agreed_to_third_party_record: "Agreed to third-party record",
};

interface Props {
  scope: Scope;
  onChanged?: () => void;
}

/**
 * The work on one item: what has been verified, what is being asked, and who has
 * signed. Every control here appends an event; nothing edits or deletes.
 */
export function WorkPanel({ scope, onChanged }: Props) {
  const [state, setState] = useState<ScopeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const next = await fetchScope(scope.kind, scope.id);
    setState(next);
  }, [scope.kind, scope.id]);

  useEffect(() => {
    let live = true;
    setState(null);
    fetchScope(scope.kind, scope.id)
      .then((s) => live && setState(s))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [scope.kind, scope.id]);

  const act = useCallback(
    async (body: Parameters<typeof appendEvent>[0]) => {
      setBusy(true);
      setError(null);
      try {
        await appendEvent(body);
        await reload();
        onChanged?.();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [reload, onChanged],
  );

  if (!state) {
    return (
      <Section title="Work">
        <p className="text-[12px] text-muted">{error ?? "Loading…"}</p>
      </Section>
    );
  }

  return (
    <>
      <Section title="Sign-off">
        <div className="space-y-1.5">
          {REVIEW_LEVELS.map((level) => (
            <SignoffRow
              key={level}
              level={level}
              state={state}
              busy={busy}
              onSign={() => act({ type: "signoff", scope, payload: { level } })}
            />
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          A sign-off records a hash of the numbers it covered
          {state.coveredFacts.lines.length > 0 &&
            ` (${state.coveredFacts.lines.length} line${
              state.coveredFacts.lines.length === 1 ? "" : "s"
            } and ${state.coveredFacts.values.length} extracted value${
              state.coveredFacts.values.length === 1 ? "" : "s"
            }, traced through every input)`}{" "}
          together with the verifications and review notes standing at the time. Anything that
          changes either reopens it.
        </p>
      </Section>

      <Section title={`Verified · ${state.verifications.length}`}>
        {state.verifications.length === 0 ? (
          <p className="mb-2 text-[12px] text-muted">Nothing verified yet.</p>
        ) : (
          <ul className="mb-2 space-y-1">
            {state.verifications.map((v) => (
              <li key={v.eventId} className="flex items-start gap-2">
                <Chip tone="accent">{VERIFICATION_LABEL[v.verificationType as VerificationType]}</Chip>
                <span className="min-w-0 flex-1">
                  <span className="text-[11px] text-muted">
                    {v.actor?.name ?? v.eventId} · {v.at.slice(0, 10)}
                  </span>
                  {v.note && <span className="block text-[12px]">{v.note}</span>}
                </span>
                <button
                  disabled={busy}
                  onClick={() =>
                    act({ type: "revert", scope, payload: { targetEventId: v.eventId } })
                  }
                  className="shrink-0 text-[10px] text-muted hover:text-bad disabled:opacity-40"
                  title="Withdraw this verification. The entry stays in the history."
                >
                  withdraw
                </button>
              </li>
            ))}
          </ul>
        )}
        <AddVerification busy={busy} onAdd={(payload) => act({ type: "verification", scope, payload })} />
      </Section>

      <Questions
        scope={scope}
        questions={state.questions}
        openCount={state.openQuestionCount}
        staff={state.staff ?? []}
        busy={busy}
        onAct={act}
      />

      <Section title={`Review notes · ${state.openBlockingCount} blocking open`}>
        {state.reviewNotes.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {state.reviewNotes.map((note) => (
              <li
                key={note.eventId}
                className={`rounded border px-2 py-1.5 ${
                  note.resolved
                    ? "border-edge bg-[#fafaf9]"
                    : note.blocking
                      ? "border-[#f3d4d2] bg-bad-soft"
                      : "border-edge"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {note.blocking && (
                    <Chip tone={note.resolved ? "quiet" : "bad"}>
                      {note.resolved ? "was blocking" : "blocks filing"}
                    </Chip>
                  )}
                  <span className="text-[10px] text-muted">
                    {note.actor?.name} · {note.at.slice(0, 10)}
                  </span>
                  <span className="ml-auto flex gap-2">
                    {!note.resolved && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          act({
                            type: "review_note_resolved",
                            scope,
                            payload: { targetEventId: note.eventId },
                          })
                        }
                        className="text-[10px] text-accent hover:underline disabled:opacity-40"
                      >
                        resolve
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() =>
                        act({ type: "revert", scope, payload: { targetEventId: note.eventId } })
                      }
                      className="text-[10px] text-muted hover:text-bad disabled:opacity-40"
                    >
                      withdraw
                    </button>
                  </span>
                </div>
                <p className="mt-0.5 text-[12px]">{note.text}</p>
                {note.resolved && (
                  <p className="mt-0.5 text-[10px] text-muted">
                    Resolved by {note.resolvedBy?.name} on {note.resolvedAt?.slice(0, 10)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <AddNote
          busy={busy}
          placeholder="Ask a question or raise a point for the preparer"
          allowBlocking
          onAdd={(payload) => act({ type: "review_note", scope, payload })}
        />
      </Section>

      {state.history.length > 0 && (
        <Section title={`History · ${state.history.length} event${state.history.length === 1 ? "" : "s"}`}>
          <ul className="space-y-0.5">
            {state.history.map((event) => {
              const withdrawn = state.revertedIds.includes(event.id);
              return (
                <li
                  key={event.id}
                  className={`flex items-baseline gap-2 text-[11px] ${
                    withdrawn ? "text-muted line-through decoration-[#c9c9c5]" : ""
                  }`}
                >
                  <span className="tnum w-6 shrink-0 text-right text-[10px] text-muted">
                    {event.seq}
                  </span>
                  <span className="shrink-0 font-mono text-[10px]">{event.type}</span>
                  <span className="min-w-0 flex-1 truncate">{describeEvent(event.payload)}</span>
                  <span className="shrink-0 text-[10px] text-muted">{event.at.slice(5, 16)}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] text-muted">
            Withdrawn entries stay on the record. The table is append-only — the database
            refuses updates and deletes.
          </p>
        </Section>
      )}
    </>
  );
}

function describeEvent(payload: unknown): string {
  const p = payload as Record<string, unknown>;
  if (typeof p?.text === "string") return p.text;
  if (typeof p?.verificationType === "string")
    return VERIFICATION_LABEL[p.verificationType as VerificationType] ?? p.verificationType;
  if (typeof p?.level === "string") return `signed at ${p.level} level`;
  if (typeof p?.reason === "string") return `withdrawn — ${p.reason}`;
  if (typeof p?.field === "string") return `revealed ${p.field}`;
  return "";
}

function SignoffRow({
  level,
  state,
  busy,
  onSign,
}: {
  level: ReviewLevel;
  state: ScopeState;
  busy: boolean;
  onSign: () => void;
}) {
  const signoff = state.signoffs.find((s) => s.level === level);
  const check = state.signoffChecks[level];

  if (signoff) {
    return (
      <div
        className={`rounded border px-2 py-1.5 ${
          signoff.valid ? "border-[#cfe2ef] bg-accent-soft" : "border-[#f0e0bd] bg-warn-soft"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Chip tone={signoff.valid ? "accent" : "warn"}>
            {signoff.valid ? "signed" : "reopened"}
          </Chip>
          <span className="text-[12px] font-medium capitalize">{level}</span>
          <span className="text-[11px] text-muted">
            {signoff.actor?.name} · {signoff.at.slice(0, 10)}
          </span>
        </div>
        {!signoff.valid && signoff.diff && <Invalidation diff={signoff.diff} />}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded border border-edge px-2 py-1.5">
      <span className="w-16 shrink-0 text-[12px] font-medium capitalize">{level}</span>
      {check?.ok ? (
        <button
          disabled={busy}
          onClick={onSign}
          className="rounded bg-accent px-2 py-0.5 text-[11px] font-medium text-white transition hover:brightness-110 disabled:opacity-40"
        >
          Sign off
        </button>
      ) : (
        <span className="text-[11px] text-muted">{check?.reason}</span>
      )}
    </div>
  );
}

function Invalidation({ diff }: { diff: NonNullable<ScopeState["signoffs"][number]["diff"]> }) {
  return (
    <div className="mt-1 border-t border-[#f0e0bd] pt-1 text-[11px] text-[#5b4300]">
      <p className="font-medium">Changed since this was signed:</p>
      <ul className="mt-0.5 space-y-0.5">
        {diff.changedLines.map((c) => (
          <li key={c.key} className="tnum">
            <span className="font-mono text-[10px]">{c.key}</span> {formatValue(c.from)} →{" "}
            {formatValue(c.to)}
          </li>
        ))}
        {diff.changedValues.map((c) => (
          <li key={c.id} className="tnum">
            <span className="font-mono text-[10px]">{c.id}</span> {formatValue(c.from)} →{" "}
            {formatValue(c.to)}
          </li>
        ))}
        {diff.changedLines.length === 0 && diff.changedValues.length === 0 && diff.workChanged && (
          <li>
            No number moved. The verifications or review notes on this item changed, so the
            signature no longer covers what is here.
          </li>
        )}
      </ul>
    </div>
  );
}

function AddVerification({
  busy,
  onAdd,
}: {
  busy: boolean;
  onAdd: (payload: Record<string, unknown>) => void;
}) {
  const [type, setType] = useState<VerificationType>(VERIFICATION_TYPES[0]);
  const [note, setNote] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={type}
        onChange={(e) => setType(e.target.value as VerificationType)}
        className="rounded border border-edge bg-surface px-1.5 py-1 text-[11px] outline-none focus:border-accent"
      >
        {VERIFICATION_TYPES.map((t) => (
          <option key={t} value={t}>
            {VERIFICATION_LABEL[t]}
          </option>
        ))}
      </select>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="How, briefly"
        className="min-w-0 flex-1 rounded border border-edge bg-surface px-2 py-1 text-[11px] outline-none placeholder:text-muted focus:border-accent"
      />
      <button
        disabled={busy}
        onClick={() => {
          onAdd({ verificationType: type, note: note.trim() || undefined });
          setNote("");
        }}
        className="rounded border border-edge px-2 py-1 text-[11px] font-medium transition hover:border-accent hover:text-accent disabled:opacity-40"
      >
        Record
      </button>
    </div>
  );
}

function AddNote({
  busy,
  placeholder,
  allowBlocking,
  onAdd,
}: {
  busy: boolean;
  placeholder: string;
  allowBlocking?: boolean;
  onAdd: (payload: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState("");
  const [blocking, setBlocking] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded border border-edge bg-surface px-2 py-1 text-[11px] outline-none placeholder:text-muted focus:border-accent"
      />
      {allowBlocking && (
        <label className="flex items-center gap-1 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={blocking}
            onChange={(e) => setBlocking(e.target.checked)}
            className="accent-[#9b2c2c]"
          />
          blocks filing
        </label>
      )}
      <button
        disabled={busy || !text.trim()}
        onClick={() => {
          onAdd({ text: text.trim(), blocking });
          setText("");
          setBlocking(false);
        }}
        className="rounded border border-edge px-2 py-1 text-[11px] font-medium transition hover:border-accent hover:text-accent disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}
