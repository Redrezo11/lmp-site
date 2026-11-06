/**
 * Local progress (general spec §6.5): per module, per lesson, which blocks are
 * done and how many marked blocks were right. Stays in this browser; "Restart"
 * clears it. Keys are listed in docs/specs/website-spec.md §8.
 */

export interface LessonProgress {
  visited: boolean;
  done: string[];
  correct: string[];
  /** Marked result of a LessonForge session (quiz + practice), website-spec §8 */
  score?: { correct: number; total: number };
  /** What the LessonForge session page remembers on this device (language, answer mode, finish) */
  lf?: Record<string, unknown>;
}
type ModuleProgress = Record<string, LessonProgress>;

const key = (moduleId: string) => `lf-progress-${moduleId}`;

export function readProgress(moduleId: string): ModuleProgress {
  try { return JSON.parse(localStorage.getItem(key(moduleId)) || '{}'); } catch { return {}; }
}

function write(moduleId: string, p: ModuleProgress) {
  try { localStorage.setItem(key(moduleId), JSON.stringify(p)); } catch { /* private mode: progress isn't kept */ }
}

export function markBlock(moduleId: string, lessonId: string, blockId: string, correct: boolean | null) {
  const p = readProgress(moduleId);
  const l = p[lessonId] || { visited: true, done: [], correct: [] };
  l.visited = true;
  if (!l.done.includes(blockId)) l.done.push(blockId);
  if (correct && !l.correct.includes(blockId)) l.correct.push(blockId);
  if (correct === false) l.correct = l.correct.filter(x => x !== blockId);
  p[lessonId] = l;
  write(moduleId, p);
}

export function visitLesson(moduleId: string, lessonId: string) {
  const p = readProgress(moduleId);
  p[lessonId] = { ...(p[lessonId] || { done: [], correct: [] }), visited: true };
  write(moduleId, p);
}

/** Everything this site keeps for a module (progress and the vendored player's resume keys) */
export function restartModule(moduleId: string) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i) || '';
      if (k === key(moduleId) || k.startsWith(`lf-session-${moduleId}`) || k.startsWith(`lf-exercise-${moduleId}-`) || k.startsWith(`lf-exercise-done-${moduleId}-`)) localStorage.removeItem(k);
    }
  } catch { /* nothing kept */ }
}

/** A LessonForge lesson's own record inside lf-progress-<id> (the session page's language and mode) */
export function readLfMemory<T extends Record<string, unknown>>(moduleId: string, lessonId: string): T {
  return (readProgress(moduleId)[lessonId]?.lf || {}) as T;
}

export function updateLfMemory<T extends Record<string, unknown>>(moduleId: string, lessonId: string, patch: (m: T) => T) {
  const p = readProgress(moduleId);
  const l = p[lessonId] || { visited: true, done: [], correct: [] };
  l.lf = patch((l.lf || {}) as T);
  p[lessonId] = l;
  write(moduleId, p);
}

/** A lesson's score (the session's completion screen number) and its block done */
export function setLessonScore(moduleId: string, lessonId: string, blockId: string, score: { correct: number; total: number } | null) {
  const p = readProgress(moduleId);
  const l = p[lessonId] || { visited: true, done: [], correct: [] };
  l.visited = true;
  if (!l.done.includes(blockId)) l.done.push(blockId);
  if (score) l.score = score; else delete l.score;
  p[lessonId] = l;
  write(moduleId, p);
}

/** A block finished without a mark (a presentation watched to its last slide) */
export function markDone(moduleId: string, lessonId: string, blockId: string) {
  markBlock(moduleId, lessonId, blockId, null);
}
