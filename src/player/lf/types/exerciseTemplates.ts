// Exercise templates — book-agnostic interaction types for digitising a scanned
// exercise so students can do it on their phones. A template describes WHAT THE
// STUDENT DOES, never which book it came from: label sets, columns, mark types,
// counts and layout are data inside the exercise. Shared by client and server.
// Design notes: documentation/qskills-exercise-notes.md (local, git-ignored).

export const FAMILIES = [
  'choice', 'multi_select', 'label_each', 'sort_into_groups', 'match', 'order',
  'gap_fill', 'select_in_text', 'rewrite', 'chart_fill', 'short_answer',
  'open_writing', 'self_check', 'class_activity',
] as const;
export type Family = typeof FAMILIES[number];

export const TEMPLATE_VERSION = 1;

/** How one part of an item is treated by the phone */
export type Grading = 'auto' | 'show' | 'none';   // auto = marked; show = model answer shown; none = free

// ── Parts: the answer shapes an item can be built from ──
// An item is one or more parts, so "T/F + correction + paragraph number" is
// three parts of one item, whatever the family.
//
// ONE PART = ONE ANSWER SLOT. When a numbered item has several answer lines or
// boxes (a./b., i./ii., two blanks to write), each line is its own part with
// the printed sub-label in `label`. A part's `answers` are ALTERNATIVES for its
// one slot — never extra required answers.

type PartBody =
  | { type: 'choice'; stem?: string; options: string[]; answer?: string; grading?: Grading }
  | { type: 'multi'; stem?: string; options: string[]; answers?: string[]; grading?: Grading }
  | { type: 'label'; text: string; answer?: string; grading?: Grading }                 // label from exercise.labels
  | { type: 'sort'; text: string; answer?: string[]; grading?: Grading }                // group(s) from exercise.groups
  | { type: 'match'; text: string; answer?: string; grading?: Grading }                 // right side from exercise.rightOptions
  | { type: 'order'; pieces: string[]; answer?: string[]; grading?: Grading }           // pieces as printed; answer = correct order
  | { type: 'gap'; text: string; answers?: string[][]; cues?: string[]; grading?: Grading } // text has {{1}}, {{2}}… blanks
  | { type: 'select'; text: string; answer?: Array<{ mark: string; span: string }>; grading?: Grading }
  | { type: 'rewrite'; prompt: string; answers?: string[]; grading?: Grading }
  | { type: 'chart'; title?: string; columns: string[]; rows: Array<{ cells: ChartCell[] }>; grading?: Grading }   // title = heading printed over the chart
  | { type: 'text'; prompt: string; answers?: string[]; grading?: Grading }
  | { type: 'writing'; prompt: string; frame?: string; minSentences?: number; grading?: Grading }
  | { type: 'self'; statement: string; grading?: Grading }
  | { type: 'info'; text: string; grading?: Grading }
  | { type: 'evidence'; kind: 'paragraph' | 'line'; answer?: number[]; grading?: Grading }  // "which paragraph?"
  | { type: 'free'; prompt: string; answer?: string; grading?: Grading };                 // a correction, a why

/** A part, plus the sub-label printed beside its answer line ("a", "b", "ii") when the item has several */
export type Part = PartBody & { label?: string };

export type PartType = Part['type'];

/** Parts the student answers by writing (one text box each on the phone) */
export const WRITE_IN_PARTS: PartType[] = ['rewrite', 'text', 'free'];

export interface ChartCell { given?: string; answers?: string[]; open?: boolean }

export interface DigitisedItem { number?: string; parts: Part[] }

/** One exercise, digitised. Everything beyond family/instructions/items is optional. */
export interface DigitisedExercise {
  family: Family;
  templateVersion: number;
  instructions: string;
  instructionsArabic?: string;
  // Family-level data
  labels?: string[];             // label_each: e.g. ["T","F"], ["TS","SS","D"], ["fact","opinion"]
  groups?: string[];             // sort_into_groups: column names
  rightOptions?: string[];       // match: the right-hand list (may include distractors)
  marks?: string[];              // select_in_text: e.g. ["underline"], ["circle","underline"]
  scale?: 'yesno' | 'tick' | 'rating';   // self_check
  // Shared add-ons, usable by any family
  passage?: { title?: string; text?: string; numbering?: 'paragraph' | 'line' | 'none' };
  passageRef?: string;           // "section:<index>" of the lesson's extraction, when it holds the text
  needsPassage?: boolean;        // the exercise needs a reading the extraction doesn't have
  media?: { kind: 'audio' | 'video'; note?: string; url?: string };
  bank?: { items: string[]; reusable?: boolean; glossary?: Record<string, string> };
  example?: { itemIndex: number };
  items: DigitisedItem[];
  rules?: { exactCount?: number; minRequired?: number; anyOrder?: boolean; choosePrompt?: boolean };
  presentation?: Record<string, string>;   // layout HINTS only (numbering, optionLayout, blankStyle, labelPosition, answerArea…)
  deviations?: string[];
  answerKey: AnswerKeyInfo;
  /** Where the answers came from, as the AI reported it */
  answersFrom?: 'page' | 'revealed' | 'key' | 'lesson' | 'none';
  /** The student writes their own ideas: the book's answers are examples, shown and never marked */
  answersVary?: boolean;
  origin?: { title?: string; location?: string };
  extra?: Record<string, unknown>;         // unknown keys the AI returned, kept rather than dropped
}

// ── Template definitions (code defaults; a DB overlay may add cues/examples later) ──

export interface TemplateDef {
  family: Family;
  title: string;
  studentDoes: string;
  recognise: string[];
  notFor: string[];
  partTypes: PartType[];          // main answer part(s) for this family
  exerciseFields?: string[];      // family-level fields it uses (labels, groups, …)
  grading: 'auto' | 'partial' | 'none';
  example: unknown;               // a short book-free example of `exercise`
  /** Added from the database overlay (teacher-promoted examples) */
  moreExamples?: unknown[];
}

/** The editable part of a template, stored in the database (ExerciseTemplate) */
export interface TemplateOverlay {
  family: Family;
  extraRecognise: string[];
  extraNotFor: string[];
  examples: Array<{ exercise: unknown; note?: string; feedbackId?: string; addedAt?: string }>;
}

const EVIDENCE_NOTE = 'Any item may add {"type":"evidence","kind":"paragraph"} or {"type":"free","prompt":"Correct it"} parts.';

export const TEMPLATES: TemplateDef[] = [
  {
    family: 'choice', title: 'Choose one answer',
    studentDoes: 'picks ONE option per question or per blank',
    recognise: ['options a/b/c under a stem', 'options in parentheses or slashes inside a sentence: (go / goes)',
      'a list drawn as checkboxes where only one is right ("check the main idea")', 'pick the dictionary sense 1/2/3'],
    notFor: ['several options can be right → multi_select',
      'True/False (or T/F/Not given, Yes/No, Fact/Opinion) for each statement → label_each — the same small label set is shared by all items'],
    partTypes: ['choice'], grading: 'auto',
    example: { family: 'choice', instructions: 'Circle the correct word.', items: [
      { parts: [{ type: 'choice', stem: 'She ___ to work by bus.', options: ['go', 'goes'], answer: 'goes', grading: 'auto' }] },
      { parts: [{ type: 'choice', stem: 'The main idea of paragraph 2 is …', options: ['a …', 'b …', 'c …'], grading: 'auto' },
                { type: 'evidence', kind: 'paragraph', grading: 'auto' }] }] },
  },
  {
    family: 'multi_select', title: 'Select all that apply',
    studentDoes: 'ticks EVERY option that applies (zero, one or many)',
    recognise: ['"Check (✓) all the …"', '"Check the FOUR reasons" (a known count)', '"check the phrases you hear"', 'prediction or preference tick lists'],
    notFor: ['only one can be right → choice', 'a can-do / self-assessment list → self_check'],
    partTypes: ['multi'], grading: 'auto',
    example: { family: 'multi_select', instructions: 'Check the statements that are true, according to the chart.', rules: { exactCount: 3 },
      items: [{ parts: [{ type: 'multi', options: ['The rate was highest in 1992.', 'The rate rose after 2010.', '…'], grading: 'auto' }] }] },
  },
  {
    family: 'label_each', title: 'Label each item',
    studentDoes: 'gives each item ONE label from a small set that all items share',
    recognise: ['True/False or True/False/Not given for each statement (often with "correct the false ones" → add a free part)',
      'write T or F / F or O / N or V / TS, SS or D before or above each item', 'mark each word /t/ /d/ /ɪd/',
      'labels written inside a paragraph above each sentence'],
    notFor: ['items go into named columns or boxes → sort_into_groups', 'each item has its own options → choice'],
    partTypes: ['label'], exerciseFields: ['labels'], grading: 'auto',
    example: { family: 'label_each', instructions: 'Write F (fact) or O (opinion) next to each sentence.', labels: ['F', 'O'],
      items: [{ parts: [{ type: 'label', text: 'The crime rate went down in 2015.', grading: 'auto' }] }] },
  },
  {
    family: 'sort_into_groups', title: 'Sort into groups',
    studentDoes: 'puts each item into one (or more) named columns or groups',
    recognise: ['a box of words plus a chart with column headings', '"Write each word in the correct column"'],
    notFor: ['one short label per item in place → label_each', 'free notes into a chart → chart_fill'],
    partTypes: ['sort'], exerciseFields: ['groups'], grading: 'auto',
    example: { family: 'sort_into_groups', instructions: 'Write the words in the correct column.', groups: ['Noun', 'Verb'],
      items: [{ parts: [{ type: 'sort', text: 'decision', grading: 'auto' }] }] },
  },
  {
    family: 'match', title: 'Match',
    studentDoes: 'pairs each item on one side with an item on the other side',
    recognise: ['two lists, write the letter or the word', 'sentence beginnings and endings', 'words and definitions',
      'statements → paragraph number (numbers can repeat)', 'pictures and words'],
    notFor: ['putting things in sequence → order'],
    partTypes: ['match'], exerciseFields: ['rightOptions'], grading: 'auto',
    example: { family: 'match', instructions: 'Match each word with its definition.', rightOptions: ['a. to keep in mind', 'b. a skill', 'c. …'],
      items: [{ parts: [{ type: 'match', text: 'remember', grading: 'auto' }] }] },
  },
  {
    family: 'order', title: 'Put in order',
    studentDoes: 'arranges words, sentences or steps in the right order',
    recognise: ['number the sentences/steps 1–5',
      'words or chunks separated by slashes to put in order to make a sentence/question — even when the student writes the result out',
      'events in a cycle or timeline'],
    notFor: ['personal ranking with no right answer → self_check',
      'the slash-separated cues are ALREADY in sentence order and the student changes or adds words (be + -ing, past forms, articles) → rewrite'],
    partTypes: ['order'], grading: 'auto',
    example: { family: 'order', instructions: 'Put the words in order to make questions.',
      items: [{ parts: [{ type: 'order', pieces: ['you', 'do', 'where', 'live'], grading: 'auto' }] }] },
  },
  {
    family: 'gap_fill', title: 'Fill the gaps',
    studentDoes: 'writes (or picks from a bank) the missing word or phrase in a blank',
    recognise: ['blank lines inside sentences', 'a word bank / box above', 'a base word under or after the blank to change (amaze → amazing)',
      'gapped notes or a gapped dialogue completed from listening',
      'several blanks in one sentence → one gap part with {{1}}, {{2}}'],
    notFor: ['a whole new sentence is written → rewrite', 'a question answered on its own line → short_answer'],
    partTypes: ['gap'], grading: 'auto',
    example: { family: 'gap_fill', instructions: 'Complete the sentences with words from the box.', bank: { items: ['career', 'research'], reusable: false },
      items: [{ parts: [{ type: 'gap', text: 'I want a {{1}} in science.', grading: 'auto' }] }] },
  },
  {
    family: 'select_in_text', title: 'Mark words in a text',
    studentDoes: 'underlines, circles or marks words, phrases or sentences inside a given text',
    recognise: ['"Underline the topic sentence"', '"Circle the verbs, then star the irregular ones" (two marks)',
      'stress / intonation / linking marks on words', '"Cross out the detail that does not belong"'],
    notFor: ['each sentence gets a label from a set → label_each'],
    partTypes: ['select'], exerciseFields: ['marks'], grading: 'auto',
    example: { family: 'select_in_text', instructions: 'Underline the topic sentence.', marks: ['underline'],
      items: [{ parts: [{ type: 'select', text: 'Laughter is good for you. It lowers stress. …', grading: 'auto' }] }] },
  },
  {
    family: 'rewrite', title: 'Rewrite a sentence',
    studentDoes: 'writes a new sentence by combining, correcting or transforming given material',
    recognise: ['combine two sentences with but/so/because', 'correct the mistakes', 'rewrite using …', 'write a sentence using the word …',
      'cues separated by slashes, in order, written out as a full sentence with the verb changed ("Sales / increase / all the time" → "Sales are increasing all the time")',
      'several labelled answer lines per item (a./b.) → one part per line, each with its label'],
    notFor: ['only one word is missing → gap_fill', 'free paragraph → open_writing',
      'all the words are given (e.g. separated by slashes) and only their order changes → order'],
    partTypes: ['rewrite'], grading: 'partial',
    example: { family: 'rewrite', instructions: 'Write two sentences with because.',
      items: [{ number: '1', parts: [
        { type: 'rewrite', label: 'a', prompt: 'I stayed home. → I was sick.', grading: 'show' },
        { type: 'rewrite', label: 'b', prompt: 'I stayed home. → I was sick.', grading: 'show' }] }] },
  },
  {
    family: 'chart_fill', title: 'Fill a chart or notes',
    studentDoes: 'fills cells of a table, T-chart, outline, web or note sheet',
    recognise: ['a T-chart (main ideas / details, pros / cons)', 'an outline with numbered blanks', 'a grid with Yes/No per person',
      'gapped notes', 'Venn diagram, mind map, timeline',
      'several charts → one item per chart, the heading printed over each chart in its "title"',
      'every answer line or box is one cell, row by row; printed text in a cell is "given"'],
    notFor: ['items sorted into named columns → sort_into_groups'],
    partTypes: ['chart'], grading: 'partial',
    example: { family: 'chart_fill', instructions: 'List the advantages and disadvantages of each kind of transport.', answersVary: true,
      items: [
        { number: '1', parts: [{ type: 'chart', title: 'Cars', columns: ['Advantages', 'Disadvantages'], rows: [
          { cells: [{ answers: ['fast'] }, { answers: ['expensive'] }] }, { cells: [{ answers: ['comfortable'] }, { open: true }] }], grading: 'show' }] },
        { number: '2', parts: [{ type: 'chart', columns: ['Main ideas', 'Details'], rows: [
          { cells: [{ given: 'Sleep helps memory' }, { answers: ['the brain stores new facts at night'] }] }], grading: 'show' }] }] },
  },
  {
    family: 'short_answer', title: 'Short answer',
    studentDoes: 'writes a short answer (a word to a sentence) to a question',
    recognise: ['wh-questions with an answer line', 'answer + "which paragraph?"', 'questions about a chart or graph',
      'several labelled answer lines per question (a./b.) → one part per line, each with its label'],
    notFor: ['several sentences or a paragraph → open_writing'],
    partTypes: ['text'], grading: 'partial',
    example: { family: 'short_answer', instructions: 'Answer the questions.',
      items: [{ parts: [{ type: 'text', prompt: 'How many kinds of jam did they offer?', grading: 'show' }, { type: 'evidence', kind: 'paragraph', grading: 'auto' }] }] },
  },
  {
    family: 'open_writing', title: 'Open writing',
    studentDoes: 'writes freely: notes, sentences or a paragraph, no single right answer',
    recognise: ['Quick Write', 'write a paragraph', 'a writing frame ("I think that … because …")', 'choose one of two questions and write'],
    notFor: ['one short answer → short_answer'],
    partTypes: ['writing'], grading: 'none',
    example: { family: 'open_writing', instructions: 'Write a few sentences about your ideal job.', rules: { choosePrompt: false },
      items: [{ parts: [{ type: 'writing', prompt: 'What job would you like and why?', minSentences: 3, grading: 'none' }] }] },
  },
  {
    family: 'self_check', title: 'Self-check',
    studentDoes: 'rates or ticks statements about themselves; nothing to mark',
    recognise: ['"I can …" lists', 'Yes/No self-assessment tables', 'peer review checklists', 'opinion scales, personal rankings'],
    notFor: ['content questions with right answers → multi_select / choice'],
    partTypes: ['self'], exerciseFields: ['scale'], grading: 'none',
    example: { family: 'self_check', instructions: 'Check the skills you can do.', scale: 'tick',
      items: [{ parts: [{ type: 'self', statement: 'I can identify the main idea.', grading: 'none' }] }] },
  },
  {
    family: 'class_activity', title: 'Class activity',
    studentDoes: 'talks, presents, role-plays or reads — done in class, shown on the phone as instructions',
    recognise: ['discuss with a partner/group', 'role-play, presentation', 'survey classmates', 'listen and repeat, read aloud', 'read the text (no task)'],
    notFor: ['anything with written answers → another family'],
    partTypes: ['info'], grading: 'none',
    example: { family: 'class_activity', instructions: 'Discuss these questions with a partner.',
      items: [{ parts: [{ type: 'info', text: 'What makes a job interesting?', grading: 'none' }] }] },
  },
];

export const TEMPLATE_BY_FAMILY: Record<Family, TemplateDef> =
  Object.fromEntries(TEMPLATES.map(t => [t.family, t])) as Record<Family, TemplateDef>;

/** The textbook extraction's exercise types → families (one taxonomy across the app) */
export const EXTRACTION_TYPE_TO_FAMILY: Record<string, Family> = {
  fill_blank: 'gap_fill', multiple_choice: 'choice', matching: 'match', true_false: 'label_each',
  ordering: 'order', error_correction: 'rewrite', transformation: 'rewrite',
  underline_circle: 'select_in_text', note_taking_chart: 'chart_fill', open_ended: 'short_answer',
};

export const isFamily = (f: unknown): f is Family => typeof f === 'string' && (FAMILIES as readonly string[]).includes(f);

export { EVIDENCE_NOTE };

/** Stored on an exercise once matching has run */
export interface AnswerKeyInfo {
  /** from-key: read from the book's answers (a key page, or the page with answers showing) — scored */
  status: 'unverified' | 'teacher-checked' | 'from-key' | 'none';
  keyPages?: string[];
  note?: string;
}

/** Students are scored only on a checked key, or one read from the book's answers */
/**
 * Is this an "answers vary" exercise? The AI's flag, or for exercises stored before
 * the flag: the instructions ask for the student's own ideas, or the AI's notes
 * say the key's answers vary.
 */
export function answersVary(ex: Pick<DigitisedExercise, 'answersVary' | 'instructions' | 'deviations' | 'answerKey'> | null | undefined): boolean {
  if (!ex) return false;
  if (ex.answersVary) return true;
  if (/\b(your|their) own (ideas?|words|answers?|opinions?|sentences?)\b/i.test(ex.instructions || '')) return true;
  return [...(ex.deviations || []), ex.answerKey?.note || ''].some(n => /answers? (will |may |can |might )?vary/i.test(n));
}

export const isKeyChecked = (ex: { answerKey?: AnswerKeyInfo } | null | undefined) =>
  ex?.answerKey?.status === 'teacher-checked' || ex?.answerKey?.status === 'from-key';

/** An exercise's interactive version as a student's phone receives it */
export interface StudentInteractive {
  family: Family;
  /** Marked right/wrong (the key is trusted); otherwise a worksheet without answers */
  scored: boolean;
  exercise: DigitisedExercise;
}

/** What the last answer-key reading did */
export interface KeyReport {
  found: boolean;
  keyKind?: 'list' | 'filled' | 'mixed';
  applied: number;          // parts that got an answer
  total: number;            // parts that can take an answer
  missing: string[];        // item numbers the answers didn't cover
  note?: string;
  reason?: string;          // when found is false
  source: 'ai' | 'paste';
  at: string;
}

export interface DigitalResult {
  status: 'matched' | 'needs_review' | 'unmatched';
  family: Family | null;
  closest?: Family | null;
  confidence: number | null;
  exercise?: DigitisedExercise;
  reason?: string;
  observed?: { studentDoes?: string; answerForm?: string; layout?: string };
  errors?: string[];
  source: 'ai' | 'paste';
  updatedAt: string;
  /** Teacher has switched "students can do this exercise" on */
  enabled?: boolean;
  /** Switching on by itself has had its one chance, or the teacher decided: Catch up leaves it alone */
  autoOnChecked?: boolean;
  /** Teacher has edited the transcription or the answers */
  edited?: boolean;
  /** The last reading of the answers pages */
  keyReport?: KeyReport;
}
