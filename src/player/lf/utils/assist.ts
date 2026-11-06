import { PracticeItem, PracticeSet } from '../types/practice';

/**
 * Does this item carry an Arabic overlay the student could switch on?
 *
 * Content generated before assisted mode shipped has none of these fields, so
 * offering the language choice on it would be an empty promise — the student
 * picks "English + عربي" and sees no Arabic anywhere.
 */
export function itemHasAssist(item: PracticeItem): boolean {
  switch (item.type) {
    case 'mcq': return !!item.questionTextArabic?.trim();
    case 'typed': return !!item.promptArabic?.trim();
    case 'match': return !!item.instructionsArabic?.trim();
    default: return false; // 'order' is English word tiles — nothing to translate
  }
}

/** True when ANY item in the session has Arabic available. */
export function setHasAssist(set: PracticeSet | null | undefined): boolean {
  return !!set?.levels?.some(l => l.items?.some(itemHasAssist));
}

export type LangChoice = 'en' | 'ar';

/**
 * Whether THIS lesson has already asked the language question.
 *
 * Kept separate from the useAssist store, which only knows the current setting:
 * `setAssist(false)` is a no-op write, so "chose English" and "never saw the
 * screen" are indistinguishable there. Storing the answer per extraction (and
 * per tab session) is also what makes the question re-appear on every new
 * lesson, which is the point — a student who breezed past it last time gets
 * asked again. Shared by /assess and /practice so the same lesson only asks once.
 */
export const langKey = (extractionId: string | undefined) => `lang-${extractionId}`;

export function readLangChoice(extractionId: string | undefined): LangChoice | null {
  try {
    const v = sessionStorage.getItem(langKey(extractionId));
    return v === 'en' || v === 'ar' ? v : null;
  } catch {
    return null; // private mode — the student is simply asked again
  }
}

export function writeLangChoice(extractionId: string | undefined, lang: LangChoice): void {
  try { sessionStorage.setItem(langKey(extractionId), lang); } catch { /* session-only */ }
}

// Grammar/skill labels a generated example sometimes tags onto its sentences —
// "Do you need some help? (noun)" — which answer a question like "which sentence
// uses help as a verb?" before the student has even read the options
const ANSWER_LABEL = /[ \t]*\((?:nouns?|verbs?|adjectives?|adverbs?|pronouns?|prepositions?|conjunctions?|articles?|subject|object|prefix|suffix|topic sentence|supporting sentence|main idea|correct|incorrect|wrong)\)/gi;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The example to show above a question, with answer-revealing labels removed.
 *
 * Returns null when stripping the labels leaves nothing but the options
 * themselves (the labels were all the example added). Bracketed text that is
 * NOT such a label — "Cons: (empty)" in a pros/cons chart — is real content and
 * is kept, and an example with no labels is shown exactly as generated.
 */
export function cleanExample(example: string | undefined, options: string[] = []): string | null {
  const raw = example?.trim();
  if (!raw) return null;
  const cleaned = raw.replace(ANSWER_LABEL, '').replace(/[ \t]+\n/g, '\n').trim();
  if (cleaned === raw) return raw;
  let rest = cleaned;
  for (const o of options) {
    const t = o.trim();
    if (t.length >= 3) rest = rest.replace(new RegExp(escapeRe(t), 'gi'), '');
  }
  return /[\p{L}\p{N}]/u.test(rest) ? cleaned : null;
}
