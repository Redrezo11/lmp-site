/**
 * Marking written answers on the phone. Shared by the typed exercise and the
 * tests, so what students get and what the tests check are the same code.
 */

/** Trim, lowercase, collapse spaces, strip terminal punctuation */
export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.?!]+$/, '');
}

/**
 * One answer box. `group`: a heading over a run of boxes (a chart's column, or the
 * printed cell of its row). `acceptableAnswers` may be empty for a box the book
 * gives no example for — only on write-and-compare questions, never marked right.
 */
export interface AnswerLine { label: string; prompt?: string; acceptableAnswers: string[]; group?: string }

/**
 * Are all lines answered correctly?
 * - in order: line k must match one of line k's answers
 * - anyOrder (the lines answer one prompt in different ways): the answers are
 *   matched as a set — each line's answers can be used once, so writing the
 *   same sentence twice is not right
 */
export function linesCorrect(lines: AnswerLine[], given: string[], anyOrder = false): boolean {
  if (given.length !== lines.length) return false;
  const g = given.map(normalizeAnswer);
  const ok = (lineIdx: number, val: string) => lines[lineIdx].acceptableAnswers.some(a => normalizeAnswer(a) === val);
  if (!anyOrder) return g.every((val, k) => ok(k, val));
  // A small perfect matching: values → distinct lines
  const used = new Array(lines.length).fill(false);
  const place = (k: number): boolean => {
    if (k === g.length) return true;
    for (let j = 0; j < lines.length; j++) {
      // A pro written under Cons is not right: answers move only within their group
      if (used[j] || (lines[j].group ?? '') !== (lines[k].group ?? '') || !ok(j, g[k])) continue;
      used[j] = true;
      if (place(k + 1)) return true;
      used[j] = false;
    }
    return false;
  };
  return place(0);
}
