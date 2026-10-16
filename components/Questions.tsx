"use client";

import { useState } from "react";

import type { QuestionView } from "@/lib/events/derive";
import type { ActorInfo } from "@/lib/events/derive";
import { appendEvent } from "@/lib/view/client";
import { Chip, Section } from "./ui";

const CHANNELS = ["portal", "phone", "email", "document"] as const;

const CHANNEL_NOTE: Record<(typeof CHANNELS)[number], string> = {
  portal: "The client answered in writing through the portal.",
  phone: "Taken down by a member of the firm during a call.",
  email: "The client answered by email.",
  document: "The client supplied a document that answers it.",
};

/**
 * Questions, and what becomes of them.
 *
 * The point of this section is the last step: once an answer exists, it can be
 * attached to the line as evidence, and from then on it sits in the number's
 * support alongside the extracted values — resolvable, clickable, and carrying
 * who said it and how it arrived. A question that stays in a comment thread is
 * correspondence; one that lands in the evidence is a workpaper.
 */
export function Questions({
  scope,
  questions,
  openCount,
  staff,
  busy,
  onAct,
}: {
  scope: { kind: string; id: string };
  questions: QuestionView[];
  openCount: number;
  staff: ActorInfo[];
  busy: boolean;
  onAct: (body: Parameters<typeof appendEvent>[0]) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [to, setTo] = useState("client");

  return (
    <Section title={`Questions · ${openCount} open`}>
      {questions.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {questions.map((question) => (
            <QuestionCard key={question.eventId} question={question} scope={scope} busy={busy} onAct={onAct} />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded border border-edge bg-surface px-1.5 py-1 text-[11px] outline-none focus:border-accent"
        >
          <option value="client">the client</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about this number"
          className="min-w-0 flex-1 rounded border border-edge bg-surface px-2 py-1 text-[11px] outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          disabled={busy || !text.trim()}
          onClick={async () => {
            await onAct({ type: "question", scope, payload: { to, text: text.trim() } });
            setText("");
          }}
          className="rounded border border-edge px-2 py-1 text-[11px] font-medium transition hover:border-accent hover:text-accent disabled:opacity-40"
        >
          Ask
        </button>
      </div>
    </Section>
  );
}

function QuestionCard({
  question,
  scope,
  busy,
  onAct,
}: {
  question: QuestionView;
  scope: { kind: string; id: string };
  busy: boolean;
  onAct: (body: Parameters<typeof appendEvent>[0]) => Promise<void>;
}) {
  const [answer, setAnswer] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("portal");
  const [said, setSaid] = useState("");

  return (
    <li
      className={`rounded border px-2 py-1.5 ${
        question.answer ? "border-edge" : "border-[#cfe2ef] bg-accent-soft"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Chip tone={question.answer ? "quiet" : "accent"}>
          {question.answer ? "answered" : `waiting on ${question.toName}`}
        </Chip>
        <span className="text-[10px] text-muted">
          {question.askedBy?.name} · {question.at.slice(0, 10)}
        </span>
      </div>
      <p className="mt-0.5 text-[12px]">{question.text}</p>

      {question.answer ? (
        <div className="mt-1 border-t border-edge pt-1">
          <p className="text-[12px]">{question.answer.text}</p>
          <p className="mt-0.5 text-[10px] text-muted">
            {question.answer.said} ·{" "}
            <span title={CHANNEL_NOTE[question.answer.channel]}>{question.answer.channel}</span> ·{" "}
            {question.answer.at.slice(0, 10)}
            {question.answer.recordedBy &&
              question.answer.said !== question.answer.recordedBy.name &&
              `, recorded by ${question.answer.recordedBy.name}`}
          </p>

          <div className="mt-1 flex items-center gap-1.5">
            {question.cited ? (
              <Chip tone="accent" title="This answer is attached to the line as evidence">
                attached as evidence
              </Chip>
            ) : (
              <button
                disabled={busy}
                onClick={() =>
                  onAct({
                    type: "cite",
                    scope,
                    payload: { ref: question.answer!.ref, note: `Answer to: ${question.text}` },
                  })
                }
                className="rounded border border-edge px-1.5 py-0.5 text-[10px] font-medium transition hover:border-accent hover:text-accent disabled:opacity-40"
              >
                Attach as evidence
              </button>
            )}
            <span className="font-mono text-[9px] text-muted">{question.answer.ref}</span>
          </div>
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-[#cfe2ef] pt-1">
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Record the answer"
            className="min-w-0 flex-1 rounded border border-edge bg-surface px-1.5 py-0.5 text-[11px] outline-none focus:border-accent"
          />
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}
            title={CHANNEL_NOTE[channel]}
            className="rounded border border-edge bg-surface px-1 py-0.5 text-[10px] outline-none focus:border-accent"
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {question.to === "client" && (
            <input
              value={said}
              onChange={(e) => setSaid(e.target.value)}
              placeholder="who said it"
              className="w-24 rounded border border-edge bg-surface px-1 py-0.5 text-[10px] outline-none focus:border-accent"
            />
          )}
          <button
            disabled={busy || !answer.trim()}
            onClick={async () => {
              await onAct({
                type: "answer",
                scope,
                payload: {
                  targetEventId: question.eventId,
                  text: answer.trim(),
                  channel,
                  onBehalfOf: said.trim() || undefined,
                },
              });
              setAnswer("");
              setSaid("");
            }}
            className="rounded border border-edge px-1.5 py-0.5 text-[10px] font-medium transition hover:border-accent hover:text-accent disabled:opacity-40"
          >
            Record
          </button>
        </div>
      )}
    </li>
  );
}
