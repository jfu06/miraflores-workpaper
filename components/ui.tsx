import type { LocateMethod } from "@/lib/graph/document";

export function Chip({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "warn" | "bad" | "quiet";
  title?: string;
}) {
  const tones = {
    neutral: "bg-[#f1f1ef] text-[#4a4a47] border-[#e4e4e2]",
    accent: "bg-accent-soft text-accent border-[#cfe2ef]",
    warn: "bg-warn-soft text-warn border-[#f0e0bd]",
    bad: "bg-bad-soft text-bad border-[#f3d4d2]",
    quiet: "bg-transparent text-muted border-[#e4e4e2]",
  } as const;
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center rounded border px-1.5 py-[1px] text-[10px] leading-4 font-medium tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function PaneHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-edge bg-surface/95 px-4 py-3 backdrop-blur">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            {eyebrow}
          </div>
        )}
        <div className="truncate text-[13px] font-semibold">{title}</div>
      </div>
      {right && <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">{right}</div>}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-edge px-4 py-3 last:border-b-0">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-[12px] text-muted">{children}</p>;
}

/**
 * How a highlight was located on the source page.
 *
 * Shown to the reviewer rather than hidden: "matched by value" carries less
 * assurance than "matched the pipeline's own reading verbatim", and "not located"
 * means the amount is not printed on the page at all, which is worth knowing.
 */
export const LOCATE_METHOD: Record<LocateMethod, { label: string; note: string; tone: "accent" | "neutral" | "warn" | "bad" }> = {
  text_as_read: {
    label: "verbatim",
    note: "Matched the pipeline's own reading, character for character, on this page.",
    tone: "accent",
  },
  normalized_value: {
    label: "normalized",
    note: "The page prints this value in a different format than the pipeline recorded (commonly an ISO date against a US-format reading). Matched on the normalized value.",
    tone: "neutral",
  },
  value: {
    label: "by amount",
    note: "The pipeline's reading does not appear verbatim; matched by comparing the amount numerically.",
    tone: "neutral",
  },
  field_label: {
    label: "field only",
    note: "The amount itself is not printed in this page's text. Located the issuer's label for the field instead.",
    tone: "warn",
  },
  none: {
    label: "not located",
    note: "Neither the reading nor the value appears on this page. The value cannot be tied to a printed location.",
    tone: "bad",
  },
};
