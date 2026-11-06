import { DigitisedExercise, Part, answersVary } from '../../../types/exerciseTemplates';
import { PracticeItem } from '../../../types/practice';

/**
 * A digitised exercise → the app's phone exercises (mcq / match / order / typed
 * / select). Shared by the teacher's preview and the student runner.
 *
 * THE RULE: one numbered item in the book = one screen on the phone. An item's
 * write-in parts (its answer lines a./b./…, a question plus "why", the blanks
 * of one sentence) are NEVER split across screens — they become one question
 * with one box per line, marked as one point, like the book. Grouping comes
 * from the item's structure and the printed labels, never from comparing the
 * wording of prompts.
 *
 * Parts marked "auto" are marked by the phone; "show" parts are written and
 * then compared with the book's answer; "none" and anything without an answer
 * is left for paper and listed by the structured view. When answers vary (the
 * student's own ideas) nothing is marked: the book's answer is shown as an example.
 */
const base = { bloomLevel: 'apply' as const, explanation: '', explanationArabic: '' };

export interface Adapted {
  items: PracticeItem[];
  /** item indexes with something that isn't a phone question (no fit, no key, or not marked) */
  skipped: number[];
  /** the exercise with only what is left for paper: the skipped items, each with just its unconverted parts */
  paper: DigitisedExercise;
  /** how many parts (not items) are left for paper */
  paperParts: number;
}

const BLANK = /\{\{(\d+)\}\}/g;

type WriteIn = Extract<Part, { type: 'rewrite' | 'text' | 'free' }>;

/** A part the student answers by writing, with something to compare against */
function writable(p: Part): p is WriteIn {
  const g = p.grading || 'auto';
  if (g !== 'auto' && g !== 'show') return false;
  if (p.type === 'rewrite' || p.type === 'text') return !!p.answers?.length;
  if (p.type === 'free') return !!p.answer;
  return false;
}
const answersOf = (p: WriteIn): string[] => (p.type === 'free' ? (p.answer ? [p.answer] : []) : (p.answers || []));
const promptOf = (p: WriteIn): string => p.prompt?.trim() || '';
const letter = (k: number) => String.fromCharCode(97 + k);

/**
 * All of an item's write-in parts → ONE typed question.
 * - one part: one box (as before)
 * - several parts: one box per part, labelled by the printed label (a, b…);
 *   when they all answer the same prompt (e.g. "write it two ways"), the
 *   prompt is shown once and the answers may come in any order (each once)
 */
function writeInQuestion(parts: WriteIn[], num: string, context: string): PracticeItem {
  const selfCheck = parts.some(p => (p.grading || 'auto') === 'show');
  const head = `${num}. ${context ? `${context}\n` : ''}`;
  if (parts.length === 1) {
    const p = parts[0];
    return { ...base, type: 'typed', prompt: head + promptOf(p), acceptableAnswers: answersOf(p), ...(selfCheck ? { selfCheck } : {}) };
  }
  const shared = parts.every(p => promptOf(p) === promptOf(parts[0]));
  const lines = parts.map((p, k) => ({
    label: p.label || letter(k),
    ...(shared ? {} : { prompt: promptOf(p) }),
    acceptableAnswers: answersOf(p),
  }));
  return {
    ...base, type: 'typed',
    prompt: head + (shared ? promptOf(parts[0]) : ''),
    acceptableAnswers: [...new Set(lines.flatMap(l => l.acceptableAnswers))],
    lines, ...(shared ? { anyOrder: true } : {}), ...(selfCheck ? { selfCheck } : {}),
  };
}

/** Marks from the book: tap pieces of the text. "show" = any reasonable answer, compared with the book's */
function markQuestion(p: Extract<Part, { type: 'select' }>, ex: DigitisedExercise, num: string): PracticeItem[] | null {
  if (!p.answer?.length || (p.grading === 'none')) return null;
  const marks = [...new Set([...(ex.marks || []), ...p.answer.map(a => a.mark)])];
  return [{
    ...base, type: 'select', prompt: ex.items.length > 1 ? `Item ${num}` : '', text: p.text, marks, answer: p.answer,
    ...(p.grading === 'show' ? { selfCheck: true } : {}),
  }];
}

type Chart = Extract<Part, { type: 'chart' }>;
type ChartCell = Chart['rows'][number]['cells'][number];
/** A box to fill: not printed, and either marked open or holding the book's answer */
const isOpenCell = (c: ChartCell) => !c.given && (!!c.open || !!c.answers?.length);
/** A chart with no printed cell is a list (pros / cons): boxes go under their column */
const isListChart = (p: Chart) => !p.rows.some(r => r.cells.some(c => c.given));

/**
 * A chart's boxes, in reading order, each with its heading:
 * - a list chart: by column (heading "Pros", boxes 1, 2, 3…)
 * - a chart with printed cells: by row (heading = the printed cell, box labelled by its column)
 */
export function chartLines(p: Chart): Array<{ group: string; label: string; acceptableAnswers: string[] }> {
  const out: Array<{ group: string; label: string; acceptableAnswers: string[] }> = [];
  if (isListChart(p)) {
    const width = Math.max(p.columns.length, ...p.rows.map(r => r.cells.length));
    for (let j = 0; j < width; j++) {
      let n = 0;
      for (const r of p.rows) {
        const c = r.cells[j];
        if (c && isOpenCell(c)) out.push({ group: p.columns[j] || '', label: String(++n), acceptableAnswers: c.answers || [] });
      }
    }
    return out;
  }
  for (const r of p.rows) {
    const head = r.cells.filter(c => c.given).map(c => c.given).join(' · ');
    r.cells.forEach((c, j) => {
      if (isOpenCell(c)) out.push({ group: head, label: p.columns[j] || letter(j), acceptableAnswers: c.answers || [] });
    });
  }
  return out;
}

/**
 * A chart → ONE screen with a box per cell. Marked only when every box has an exact
 * answer ("auto"); otherwise written, then compared with the book's answers. A box
 * the book leaves empty can't be marked, so its chart is compared.
 */
function chartQuestion(p: Chart, num: string): PracticeItem | null {
  const g = p.grading || 'none';
  if (g !== 'auto' && g !== 'show') return null;
  const lines = chartLines(p);
  if (!lines.some(l => l.acceptableAnswers.length)) return null;
  const selfCheck = g === 'show' || lines.some(l => !l.acceptableAnswers.length);
  return {
    ...base, type: 'typed',
    prompt: `${num}. ${p.title || 'Fill in the chart'}`,
    acceptableAnswers: [...new Set(lines.flatMap(l => l.acceptableAnswers))],
    lines, ...(isListChart(p) ? { anyOrder: true } : {}), ...(selfCheck ? { selfCheck } : {}),
  };
}

/** One non-write-in part → zero or more phone questions */
function fromPart(p: Part, ex: DigitisedExercise, num: string): PracticeItem[] | null {
  if (p.type === 'select') return markQuestion(p, ex, num);
  if (p.type === 'chart') { const q = chartQuestion(p, num); return q ? [q] : null; }
  const compare = p.type === 'gap' && p.grading === 'show';
  if ((p.grading || 'auto') !== 'auto' && !compare) return null;
  const label = `${num}. `;
  switch (p.type) {
    case 'choice':
      if (!p.answer) return null;
      return [{ ...base, type: 'mcq', questionText: label + (p.stem || ex.instructions), options: p.options, correctAnswer: p.answer }];
    case 'label':
      if (!p.answer || !ex.labels?.length) return null;
      return [{ ...base, type: 'mcq', questionText: label + p.text, options: ex.labels, correctAnswer: p.answer }];
    case 'match':
      if (!p.answer || !ex.rightOptions?.length) return null;
      return [{ ...base, type: 'mcq', questionText: label + p.text, options: ex.rightOptions, correctAnswer: p.answer }];
    case 'sort':
      // one group → choose the group; several groups is "tick all that apply" — paper for now
      if (p.answer?.length !== 1 || !ex.groups?.length) return null;
      return [{ ...base, type: 'mcq', questionText: label + p.text, options: ex.groups, correctAnswer: p.answer[0] }];
    case 'order':
      if (!p.answer?.length) return null;
      return [{ ...base, type: 'order', correctSentence: p.answer.join(' '), words: p.pieces.flatMap(w => w.split(/\s+/)).filter(Boolean) }];
    case 'gap': {
      const n = (p.text.match(BLANK) || []).length;
      if (!n || !p.answers || p.answers.length !== n || p.answers.some(a => !a?.length)) return null;
      if (n === 1) return [{ ...base, type: 'typed', prompt: label + p.text.replace(BLANK, '_____'), acceptableAnswers: p.answers[0], ...(compare ? { selfCheck: true } : {}) }];
      // Several blanks in one sentence: one screen, one box per blank, in order
      return [{
        ...base, type: 'typed',
        prompt: label + p.text.replace(BLANK, (_, d) => `[${d}]`),
        acceptableAnswers: [...new Set(p.answers.flat())],
        lines: p.answers.map((acc, k) => ({ label: String(k + 1), acceptableAnswers: acc })),
        ...(compare ? { selfCheck: true } : {}),
      }];
    }
    case 'evidence':
      if (!p.answer?.length) return null;
      return [{ ...base, type: 'typed', prompt: `${label}Which ${p.kind} number${p.answer.length > 1 ? 's' : ''}?`, acceptableAnswers: [p.answer.join(', ')] }];
    default:
      return null;
  }
}

/** Parts that are only something to read or talk about — nothing to do on paper either */
const NOTHING_TO_DO = new Set(['info']);

export function toPracticeItems(ex: DigitisedExercise): Adapted {
  // A whole match exercise becomes drag-to-match screens when every pair is unique (3–6 per
  // screen; longer lists are split evenly). Repeated answers (e.g. paragraph numbers used twice)
  // can't be dragged, so those items fall through to "choose from the list" below.
  if (ex.family === 'match') {
    const body = ex.items.filter((_, i) => ex.example?.itemIndex !== i);
    const pairs = body
      .map(it => it.parts.find(p => p.type === 'match') as Extract<Part, { type: 'match' }> | undefined)
      .filter((p): p is Extract<Part, { type: 'match' }> => !!p && !!p.answer && (p.grading || 'auto') === 'auto')
      .map(p => ({ left: p.text, right: p.answer! }));
    const unique = new Set(pairs.map(p => p.right)).size === pairs.length;
    const onlyMatch = body.every(it => it.parts.every(p => p.type === 'match' || p.type === 'info'));
    if (pairs.length >= 3 && pairs.length === body.length && unique && onlyMatch) {
      const screens = Math.ceil(pairs.length / 6);
      const size = Math.ceil(pairs.length / screens);
      const items: PracticeItem[] = [];
      for (let k = 0; k < pairs.length; k += size) {
        items.push({ ...base, type: 'match', instructions: ex.instructions, instructionsArabic: ex.instructionsArabic, pairs: pairs.slice(k, k + size) });
      }
      return { items, skipped: [], paper: { ...ex, items: [], example: undefined }, paperParts: 0 };
    }
  }
  const items: PracticeItem[] = [];
  const skipped: number[] = [];
  const paperItems: DigitisedExercise['items'] = [];
  let paperParts = 0;
  ex.items.forEach((it, i) => {
    if (ex.example?.itemIndex === i) return;          // the worked example isn't a question
    const left: Part[] = [];
    const num = it.number || String(i + 1);
    const writeIns = it.parts.filter(writable);
    // Context for the written lines when the item also has another kind of part (e.g. a choice)
    const other = it.parts.find(p => !writable(p) && p.type !== 'info') as any;
    const context = other?.stem || other?.text || '';
    let wroteIns = false;
    for (const p of it.parts) {
      if (writable(p)) {
        if (!wroteIns) { items.push(writeInQuestion(writeIns, num, writeIns.length > 1 || it.parts.length > 1 ? context : '')); wroteIns = true; }
        continue;
      }
      const made = fromPart(p, ex, num);
      if (made) items.push(...made);
      else if (!NOTHING_TO_DO.has(p.type)) left.push(p);
    }
    if (left.length) {
      skipped.push(i);
      paperParts += left.length;
      // keep the item's text for context when only a follow-up part is left (e.g. "Why?")
      const keptAll = left.length === it.parts.length;
      const done = it.parts.find(p => !left.includes(p)) as any;
      const about = done?.stem || done?.text || done?.prompt || '';
      const reminder: Part = { type: 'info', text: `Question ${it.number || i + 1} is on the phone${about ? `: “${about}”` : ''}. Then:` };
      paperItems.push({ ...it, number: it.number || String(i + 1), parts: keptAll ? it.parts : [reminder, ...left] });
    }
  });
  // Own ideas: whatever the AI called the grading, what students write or mark is never marked
  const vary = answersVary(ex);
  const final = vary ? items.map(i => (i.type === 'typed' || i.type === 'select' ? { ...i, selfCheck: true, vary: true } : i)) : items;
  return { items: final, skipped, paper: { ...ex, items: paperItems, example: undefined }, paperParts };
}

/**
 * What a student can actually do on the phone with this exercise — computed by
 * the same adapter the student's phone uses, so the numbers can't drift from
 * reality. `scored: false` (answers not checked) means a worksheet only.
 */
export interface PhoneReadiness {
  /** questions the phone marks right/wrong by itself */
  marked: number;
  /** questions the student writes, then compares with the book's answer */
  compare: number;
  /** parts left for paper / the teacher */
  paper: number;
  /** nothing to do on the phone: students see the exercise as a worksheet */
  worksheetOnly: boolean;
  /** why it is a worksheet, when it is */
  why?: 'unchecked' | 'no-phone-questions';
}

export function phoneReadiness(ex: DigitisedExercise | null | undefined, scored: boolean): PhoneReadiness {
  if (!ex) return { marked: 0, compare: 0, paper: 0, worksheetOnly: true, why: 'no-phone-questions' };
  const r = toPracticeItems(ex);
  const compare = r.items.filter(i => (i.type === 'typed' || i.type === 'select') && i.selfCheck).length;
  const marked = r.items.length - compare;
  if (!scored) return { marked: 0, compare: 0, paper: r.paperParts + r.items.length, worksheetOnly: true, why: 'unchecked' };
  if (!r.items.length) return { marked: 0, compare: 0, paper: r.paperParts, worksheetOnly: true, why: 'no-phone-questions' };
  return { marked, compare, paper: r.paperParts, worksheetOnly: false };
}

/** The readiness in a few words, for chips and buttons */
export function readinessShort(r: PhoneReadiness): string {
  if (r.worksheetOnly) return r.why === 'unchecked' ? 'worksheet only — answers not checked' : 'worksheet only — no phone questions';
  const on = r.marked + r.compare;
  return `${on} on the phone${r.paper ? ` · ${r.paper} on paper` : ''}`;
}

/** The readiness in a sentence, for the teacher's card */
export function readinessLong(r: PhoneReadiness): string {
  if (r.worksheetOnly) {
    return r.why === 'unchecked'
      ? 'Students would see a worksheet only: the answers aren’t checked yet, so nothing can be marked.'
      : 'Students would see a worksheet only: this kind of exercise has no phone questions yet.';
  }
  const bits = [
    r.marked ? `${r.marked} marked automatically` : '',
    r.compare ? `${r.compare} to do and compare with the book’s answer` : '',
    r.paper ? `${r.paper} on paper` : '',
  ].filter(Boolean);
  return `On the phone: ${bits.join(' · ')}.`;
}

/**
 * The exercise's shape in words, computed from the stored data (no AI):
 * "6 items · 2 answer lines each (a, b) · worked example: item 1". If the page
 * shows something else, the teacher sees it before students do.
 */
export function structureLine(ex: DigitisedExercise): string {
  const body = ex.items.filter((_, i) => ex.example?.itemIndex !== i);
  const bits = [`${ex.items.length} item${ex.items.length === 1 ? '' : 's'}`];
  const lineCounts = body.map(it => {
    const writes = it.parts.filter(p => p.type === 'rewrite' || p.type === 'text' || p.type === 'free').length;
    const blanks = it.parts.reduce((n, p) => n + (p.type === 'gap' ? (p.text.match(BLANK) || []).length : 0), 0);
    return writes + blanks;
  });
  const uniq = [...new Set(lineCounts)];
  if (uniq.length === 1 && uniq[0] > 1) {
    // The printed labels, or a, b… in order — the same fallback the phone screen uses
    const writes = (body[0]?.parts || []).filter(p => p.type === 'rewrite' || p.type === 'text' || p.type === 'free');
    const labels = writes.length > 1 ? writes.map((p, k) => p.label || letter(k)) : [];
    bits.push(`${uniq[0]} answer lines each${labels.length ? ` (${labels.join(', ')})` : ''}`);
  } else if (uniq.some(n => n > 1)) {
    bits.push(`${Math.min(...lineCounts)}–${Math.max(...lineCounts)} answer lines per item`);
  }
  const cells = body.reduce((n, it) => n + it.parts.reduce((m, p) => m + (p.type === 'chart' ? chartLines(p).length : 0), 0), 0);
  const charts = body.reduce((n, it) => n + it.parts.filter(p => p.type === 'chart').length, 0);
  if (cells) bits.push(`${charts > 1 ? `${charts} charts, ` : ''}${cells} box${cells === 1 ? '' : 'es'} to fill`);
  const toMark = body.reduce((n, it) => n + it.parts.reduce((m, p) => m + (p.type === 'select' ? p.answer?.length || 0 : 0), 0), 0);
  if (toMark) bits.push(`${toMark} thing${toMark === 1 ? '' : 's'} to mark`);
  if (ex.example) bits.push(`worked example: item ${ex.items[ex.example.itemIndex]?.number || ex.example.itemIndex + 1}`);
  return bits.join(' · ');
}
