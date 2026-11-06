/**
 * Stable shuffled order for answer options.
 *
 * The generator puts the correct answer first almost every time — 514 of 523
 * live multiple-choice items (98%) had it as option A, so a student could
 * score well by always tapping A. Options are therefore shown in a shuffled
 * order, seeded by the question itself so it is stable: the same on every
 * refresh and resume, and the same for every student, which lets a teacher
 * talk about "option C" with the whole class. Grading compares the option
 * TEXT, never its position, so the reorder cannot change a score.
 */

/** FNV-1a string hash → 32-bit seed */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, well-distributed PRNG */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable permutation of 0..n-1 for this seed (Fisher–Yates) */
export function seededOrder(n: number, seed: string): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  const next = rng(hash(seed));
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Display order for a question's options: order[displayPosition] = original index */
export function optionOrder(questionText: string, options: string[]): number[] {
  return seededOrder(options.length, `${questionText}|${options.join('|')}`);
}
