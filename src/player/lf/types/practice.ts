// Extended Practice — Bloom's-structured extra practice types.
// Shared by client and server (like src/types/lesson.ts).

export type BloomLevel = 'quiz' | 'remember' | 'understand' | 'apply' | 'analyze' | 'challenge';
// 'quiz' = the lesson's assessment questions, merged in as the FIRST level so
//          quiz and practice are one continuous student session
// 'challenge' = Evaluate/Create typed production items, shown ONLY in challenge mode

interface PracticeItemBase {
  bloomLevel: BloomLevel;
  explanation: string;        // English feedback
  explanationArabic: string;  // MSA feedback (authored in Arabic — never translated)
  sourceHeading?: string;     // deep-link to the teaching slide (resolveSlideIndex)
}

export interface MatchItem extends PracticeItemBase {
  type: 'match';
  instructions?: string;                      // e.g. "Match each example to its rule"
  instructionsArabic?: string;                // shown instead in assist mode
  pairs: { left: string; right: string }[];   // 3-6 pairs; sides unique within the item
}

export interface McqItem extends PracticeItemBase {
  type: 'mcq';
  questionText: string;   // gap-filled default: contains _____
  options: string[];      // 3-4
  correctAnswer: string;  // matches one option verbatim
  // Converted quiz gap-fills may be answered by typing in Challenge mode
  typedEligible?: boolean;
  // ── Assisted (bilingual) overlay ──
  // English is the default and stays the answer spine: `options`/`correctAnswer`
  // are ALWAYS English and grading only ever matches them. These fields are
  // shown instead/alongside when the student opts into assist mode.
  conceptCheck?: boolean;
  questionTextArabic?: string;
  /** Same length and ORDER as `options` — optionsArabic[i] translates options[i] */
  optionsArabic?: string[];
  /** The English sentence/extract under discussion — shown in BOTH modes */
  example?: string;
}

const normalizeAnswer = (s: string) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.?!]+$/, '');

/**
 * Would these Arabic option labels give the answer away?
 *
 * An option repeated unchanged in optionsArabic renders in English (it IS
 * English material); a translated one renders in Arabic. If the correct answer
 * is the ONLY option presented differently from the rest — three Arabic
 * distractors and one English "part of speech" — a student can pick it without
 * understanding anything. Generation produced exactly this when it left a bare
 * grammar term untranslated. Needs 3+ options: a mixed pair is normal.
 * Shared by the renderer (fall back to English options) and the backfill
 * (re-queue the item, reject a leaking patch).
 */
export function optionsArabicLeaksAnswer(options: string[], optionsArabic: string[] | undefined, correctAnswer: string): boolean {
  if (!Array.isArray(options) || options.length < 3) return false;
  if (!Array.isArray(optionsArabic) || optionsArabic.length !== options.length) return false;
  const translated = options.map((o, i) => normalizeAnswer(optionsArabic[i]) !== normalizeAnswer(o));
  const ci = options.findIndex(o => normalizeAnswer(o) === normalizeAnswer(correctAnswer));
  if (ci < 0) return false;
  return translated.filter(t => t === translated[ci]).length === 1;
}

export interface OrderItem extends PracticeItemBase {
  type: 'order';
  correctSentence: string; // 4-10 words; graded target
  words?: string[];        // optional explicit tokens; default = whitespace split
}

export interface TypedItem extends PracticeItemBase {
  type: 'typed';
  prompt: string;
  promptArabic?: string; // ask in Arabic; the student still produces English
  acceptableAnswers: string[]; // >=1; [0] is the model answer shown in feedback
  /**
   * Write, then compare (the book's exercises): an exact match is marked right;
   * otherwise the book's answer is shown and the student says whether theirs is the same.
   */
  selfCheck?: boolean;
  /**
   * A book question with several answer lines (a./b.): one box per line on one
   * screen, marked as ONE question. `acceptableAnswers` then holds every line's
   * answers (for display fallbacks only).
   */
  lines?: Array<{ label: string; prompt?: string; acceptableAnswers: string[]; group?: string }>;
  /** The lines answer the same prompt in different ways — matched as a set, each answer once (within a group) */
  anyOrder?: boolean;
  /** Answers vary (own ideas): the book's answer is shown as an example, never marked */
  vary?: boolean;
}

/** "Underline this, circle that": the student taps pieces of the text (utils/markText.ts) */
export interface SelectItem extends PracticeItemBase {
  type: 'select';
  prompt: string;
  text: string;
  marks: string[];   // "underline", "circle", "cross out", or a written tag like "SS"
  answer: Array<{ mark: string; span: string }>;
  /** Any reasonable answer is fine in the book: mark, then compare with the book's */
  selfCheck?: boolean;
  /** Answers vary (own ideas): the book's marks are shown as an example, never marked */
  vary?: boolean;
}

export type PracticeItem = MatchItem | McqItem | OrderItem | TypedItem | SelectItem;

export interface PracticeLevel {
  level: BloomLevel;
  label: string;        // "Remember", "Understand", ...
  labelArabic: string;  // RTL chip label
  items: PracticeItem[];
}

export interface PracticeSet {
  title: string;
  band: 'A1-A2' | 'B1' | 'B2+';
  levels: PracticeLevel[]; // ordered remember → understand → apply → analyze → challenge
  generatedAt: string;
}
