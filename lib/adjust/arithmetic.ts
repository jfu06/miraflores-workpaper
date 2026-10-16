/**
 * Recovering the arithmetic the engine used.
 *
 * The engine cannot be rerun. But for the lines that are pure arithmetic over
 * other lines, the engine's own published numbers are an oracle: given a line's
 * value and its declared inputs, the combination that reproduces it can be solved
 * for, verified against the published figure, and then reused to propagate a
 * change. Nothing is assumed about the arithmetic — it is derived and checked.
 *
 * `R-SUM` is documented as "arithmetic combination of the listed input lines",
 * not a sum, and 18 of the 133 combination lines turn out to subtract. Solving
 * rather than assuming is what catches that.
 *
 * A line whose declared inputs cannot reproduce its value is **not** recomputable,
 * and that is reported rather than papered over: it means the trace shown for that
 * number is incomplete.
 */

import type { ReturnLine } from "../packet/types";

/** Rules whose value is an arithmetic combination of other lines and nothing else. */
const COMBINATION_RULES = new Set(["R-SUM", "R-CARRY"]);

/** Beyond this, the sign search is not worth running; all-plus is tried first anyway. */
const MAX_SEARCH_INPUTS = 10;

const TOLERANCE = 0.51;

export interface ArithmeticForm {
  /** One coefficient per declared input, in the order the line lists them. */
  signs: number[];
  /** True when every coefficient is +1. */
  pureSum: boolean;
}

export type SolveOutcome =
  | { solved: true; form: ArithmeticForm }
  | { solved: false; reason: string; shortfall?: number };

function* signCombinations(n: number): Generator<number[]> {
  const total = 1 << n;
  for (let mask = 0; mask < total; mask += 1) {
    const signs: number[] = [];
    for (let i = 0; i < n; i += 1) signs.push(mask & (1 << i) ? -1 : 1);
    yield signs;
  }
}

/**
 * Solve a combination line's arithmetic against the engine's published values.
 *
 * Ambiguity caused by inputs that are zero is not ambiguity: their coefficient
 * cannot be observed and does not matter, so candidates are compared only on the
 * inputs that carry a value.
 */
export function solveForm(line: ReturnLine, valueOf: (key: string) => number | undefined): SolveOutcome {
  if (!COMBINATION_RULES.has(line.rule)) {
    return { solved: false, reason: `Rule ${line.rule} is not a pure combination of other lines.` };
  }
  if (line.inputs.length === 0) {
    return { solved: false, reason: "The line declares no inputs." };
  }
  if (typeof line.value !== "number") {
    return { solved: false, reason: "The line does not hold a number." };
  }

  const values = line.inputs.map(valueOf);
  if (values.some((v) => typeof v !== "number")) {
    return { solved: false, reason: "An input does not resolve to a number." };
  }
  const numbers = values as number[];

  const allPlus = numbers.reduce((a, b) => a + b, 0);
  if (Math.abs(allPlus - line.value) < TOLERANCE) {
    return { solved: true, form: { signs: numbers.map(() => 1), pureSum: true } };
  }

  if (line.inputs.length > MAX_SEARCH_INPUTS) {
    return {
      solved: false,
      reason: `${line.inputs.length} inputs do not add to the published value, and the combination cannot be searched at that width.`,
      shortfall: line.value - allPlus,
    };
  }

  const candidates: number[][] = [];
  for (const signs of signCombinations(line.inputs.length)) {
    const total = signs.reduce((sum, sign, i) => sum + sign * numbers[i], 0);
    if (Math.abs(total - line.value) < TOLERANCE) candidates.push(signs);
  }

  if (candidates.length === 0) {
    return {
      solved: false,
      reason: `The declared inputs cannot produce the published value under any combination of signs; they are short by ${(
        line.value - allPlus
      ).toLocaleString("en-US")}. The trace for this number is incomplete.`,
      shortfall: line.value - allPlus,
    };
  }

  // Collapse candidates that differ only on inputs worth nothing.
  const significant = (signs: number[]) =>
    signs.map((sign, i) => (numbers[i] === 0 ? 0 : sign)).join(",");
  const distinct = new Set(candidates.map(significant));

  if (distinct.size > 1) {
    return {
      solved: false,
      reason: "More than one combination of signs reproduces the published value.",
    };
  }

  const signs = candidates[0];
  return { solved: true, form: { signs, pureSum: signs.every((s) => s === 1) } };
}

/** Apply a solved form to a set of input values. */
export function applyForm(form: ArithmeticForm, inputs: number[]): number {
  return form.signs.reduce((sum, sign, i) => sum + sign * (inputs[i] ?? 0), 0);
}

export interface FormIndex {
  /** Lines whose arithmetic was solved and verified. */
  forms: Map<string, ArithmeticForm>;
  /** Lines that take inputs but whose arithmetic could not be recovered. */
  unsolved: Map<string, { reason: string; shortfall?: number }>;
}

/** Solve every combination line once, up front. */
export function indexForms(
  lines: ReturnLine[],
  valueOf: (key: string) => number | undefined,
): FormIndex {
  const forms = new Map<string, ArithmeticForm>();
  const unsolved = new Map<string, { reason: string; shortfall?: number }>();

  for (const line of lines) {
    if (line.inputs.length === 0) continue;
    const outcome = solveForm(line, valueOf);
    if (outcome.solved) {
      forms.set(line.key, outcome.form);
      continue;
    }
    if (COMBINATION_RULES.has(line.rule)) {
      unsolved.set(line.key, { reason: outcome.reason, shortfall: outcome.shortfall });
    }
  }

  return { forms, unsolved };
}
