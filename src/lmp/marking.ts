/**
 * Marking rules shared by the generic question blocks. Written answers are
 * normalised the way LessonForge does (format sheet §11.2): trim, lowercase,
 * collapse spaces, drop a trailing . ? or !
 */
export function normalizeAnswer(s: string): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.?!]+$/, '');
}

export const sameAnswer = (given: string, accepted: string[], caseSensitive = false) =>
  accepted.some(a => (caseSensitive ? a.trim() === given.trim() : normalizeAnswer(a) === normalizeAnswer(given)));

/** A stable shuffle (same order on every visit) for options and matching sides */
export function stableShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  const rand = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
