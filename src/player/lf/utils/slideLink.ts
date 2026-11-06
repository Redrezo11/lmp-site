import { SlidePreview } from '../types/lesson';

/** Strip part labels like " (1/2)" and normalize for heading comparison */
export function normalizeHeading(h: string): string {
  return h.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim().toLowerCase();
}

/**
 * Resolve a question's sourceHeading to a slide index: exact match →
 * normalized match (case/trim/part-labels) → substring either direction →
 * null (no link shown).
 */
export function resolveSlideIndex(sourceHeading: string | undefined, slides: SlidePreview[]): number | null {
  if (!sourceHeading || slides.length === 0) return null;
  const target = sourceHeading.trim();
  let idx = slides.findIndex(s => s.heading === target);
  if (idx >= 0) return idx;
  const normTarget = normalizeHeading(target);
  idx = slides.findIndex(s => normalizeHeading(s.heading) === normTarget);
  if (idx >= 0) return idx;
  idx = slides.findIndex(s => {
    const normSlide = normalizeHeading(s.heading);
    return normSlide.includes(normTarget) || normTarget.includes(normSlide);
  });
  return idx >= 0 ? idx : null;
}
