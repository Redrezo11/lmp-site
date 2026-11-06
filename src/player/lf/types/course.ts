// Course/book tagging for extractions — lets the teacher see whether material
// is already in the library before extracting or generating it again.
// Shared by client and server (same pattern as src/types/practice.ts).

export interface CourseTag {
  series: string;       // 'qskills' | 'other'
  strand?: string;      // 'RW' | 'LS'  (Q Skills only)
  level?: string;       // 'Intro' | '1'..'5'  (Q Skills only)
  otherLabel?: string;  // free-text book name when series === 'other'
  unit?: string;        // optional, free text ("3", "Unit 3", "3-4")
}

export const COURSE_SERIES = [
  { id: 'qskills', label: 'Q: Skills for Success' },
  { id: 'other', label: 'Other book' },
];

export const STRANDS = [
  { id: 'RW', label: 'Reading & Writing' },
  { id: 'LS', label: 'Listening & Speaking' },
];

export const LEVELS = ['Intro', '1', '2', '3', '4', '5'];

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Stable lowercase key for filtering/grouping. Empty when not usefully tagged. */
export function courseKey(c?: CourseTag | null): string {
  if (!c?.series) return '';
  if (c.series === 'other') {
    const s = slug(c.otherLabel || '');
    return s ? `other-${s}` : '';
  }
  if (!c.strand || !c.level) return '';
  return `qskills-${c.strand}-${c.level}`.toLowerCase();
}

/** Human label, e.g. "Q Skills RW 1 · Unit 3" */
export function courseLabel(c?: CourseTag | null): string {
  if (!c?.series) return '';
  let base = '';
  if (c.series === 'other') base = (c.otherLabel || '').trim();
  else if (c.strand && c.level) base = `Q Skills ${c.strand} ${c.level}`;
  if (!base) return '';
  const unit = (c.unit || '').trim();
  return unit ? `${base} · ${/^unit/i.test(unit) ? unit : `Unit ${unit}`}` : base;
}

/**
 * A unit as the teacher typed it, tidied for storage: "Unit 3" / "unit 3" /
 * " 3 " → "3". Anything else ("3-4", "Review") is kept as typed.
 */
export function cleanUnit(unit?: string): string | undefined {
  const t = (unit || '').trim().replace(/\s+/g, ' ');
  if (!t) return undefined;
  const m = /^unit\s*(.+)$/i.exec(t);
  return m ? m[1].trim() : t;
}

/** The book's plain name for students: "Reading & Writing 1", or the other book's name */
export function bookLabel(c?: CourseTag | null): string {
  if (!c?.series) return '';
  if (c.series === 'other') return (c.otherLabel || '').trim();
  const strand = STRANDS.find(s => s.id === c.strand)?.label;
  return strand && c.level ? `${strand} ${c.level}` : '';
}

/** Normalised unit for duplicate comparison only (display stays verbatim) */
export function normalizeUnit(unit?: string): string {
  return (unit || '').trim().toLowerCase().replace(/^unit\s*/i, '').replace(/\s+/g, '');
}

/**
 * Best-effort suggestion from the extraction's pageInfo. Only ever prefills the
 * picker — never auto-saves, since pageInfo is frequently null or wrong on
 * cropped photos (the extraction prompt forbids guessing).
 */
export function suggestCourse(pageInfo: any): CourseTag | null {
  const textbook: string = pageInfo?.textbook || '';
  const unit: string = pageInfo?.unit || '';
  if (!textbook && !unit) return null;

  const t = textbook.toLowerCase();
  const isQ = /\bq[:\s]|q\s*skills|skills for success/.test(t);
  if (!isQ) {
    return textbook ? { series: 'other', otherLabel: textbook, unit: unit || undefined } : null;
  }

  let strand: string | undefined;
  if (/reading|writing|\brw\b/.test(t)) strand = 'RW';
  else if (/listening|speaking|\bls\b/.test(t)) strand = 'LS';

  let level: string | undefined;
  if (/\bintro/.test(t)) level = 'Intro';
  else {
    const m = t.match(/\b([1-5])\b/);
    if (m) level = m[1];
  }

  return { series: 'qskills', strand, level, unit: unit || undefined };
}
