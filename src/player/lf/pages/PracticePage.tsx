import { PracticeSet, PracticeLevel, PracticeItem } from '../types/practice';

/**
 * LMP site: only the two helpers AssessPage uses, copied verbatim from
 * LessonForge's src/pages/PracticePage.tsx (the standalone /practice page itself
 * talks to the server and is not part of the site).
 */

/** Defensive client-side re-filter mirroring the server sanitize predicates */
export function filterUsablePracticeItems(items: PracticeItem[]): PracticeItem[] {
  return items.filter((i: any) => {
    if (i?.type === 'match') return Array.isArray(i.pairs) && i.pairs.length >= 3;
    if (i?.type === 'mcq') return i.questionText && Array.isArray(i.options) && i.options.length >= 2 && i.correctAnswer;
    if (i?.type === 'order') return typeof i.correctSentence === 'string' && i.correctSentence.split(/\s+/).filter(Boolean).length >= 3;
    if (i?.type === 'typed') return i.prompt && Array.isArray(i.acceptableAnswers) && i.acceptableAnswers.length > 0;
    return false;
  });
}

/** Client-side cleanup of a loaded PracticeSet; null when unusable */
export function cleanPracticeSet(raw: PracticeSet | null | undefined): PracticeSet | null {
  if (!raw?.levels?.length) return null;
  const levels = raw.levels
    .map((l: PracticeLevel) => ({ ...l, items: filterUsablePracticeItems(l.items || []) }))
    .filter((l: PracticeLevel) => l.items.length > 0);
  return levels.length > 0 ? { ...raw, levels } : null;
}
