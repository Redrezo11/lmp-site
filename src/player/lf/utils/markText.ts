/**
 * The "underline this, circle that" exercises: a text cut into the pieces a
 * student taps (sentences, words or letters) and the check against the book's
 * marks. Shared by the phone, the teacher's preview, the validator and the tests.
 *
 * THE RULE, like the book: an item is right only when the student's marks are the
 * book's marks. A word that appears twice may be marked in either place (the key
 * names words, not positions), and marking another place of a key word isn't wrong.
 */
export type MarkUnit = 'sentence' | 'word' | 'letter';

export interface Piece {
  /** What is shown, with any **bold** runs */
  runs: Array<{ text: string; bold?: boolean }>;
  text: string;
  /** Compared with the key: lower case, no punctuation */
  key: string;
  /** Not tappable, shown before the piece: spaces, "SS: ", "1. " */
  before: string;
  /** The line above lettered options (the main idea): context, not one of the choices */
  context?: boolean;
}

export interface MarkAnswer { mark: string; span: string }

export function normalizeForMarks(s: string): string {
  return s.toLowerCase().replace(/\*\*/g, '').replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}\p{M}\s'-]/gu, ' ').replace(/(^|\s)['-]+|['-]+(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The text without ** markers, and where the bold runs were */
function readBold(raw: string): { text: string; bold: Array<[number, number]> } {
  const bold: Array<[number, number]> = [];
  let text = '';
  raw.split('**').forEach((chunk, i, all) => {
    // An odd one out (no closing **) is just text
    if (i % 2 === 1 && i < all.length - 1) bold.push([text.length, text.length + chunk.length]);
    text += chunk;
  });
  return { text, bold };
}

function runsOf(text: string, start: number, bold: Array<[number, number]>): Piece['runs'] {
  const end = start + text.length;
  const runs: Piece['runs'] = [];
  let at = start;
  for (const [a, b] of bold) {
    if (b <= at || a >= end) continue;
    if (a > at) runs.push({ text: text.slice(at - start, a - start) });
    runs.push({ text: text.slice(Math.max(a, at) - start, Math.min(b, end) - start), bold: true });
    at = Math.min(b, end);
  }
  if (at < end) runs.push({ text: text.slice(at - start) });
  return runs;
}

/** A line's own label ("SS: …", "D: …"), which is not part of what is marked */
const LINE_LABEL = /^(?:[A-Za-z]{1,3}:|\d{1,2}[.)]|[a-z][.)])\s+/;
/** A label on its own ("a." "b)" "1." "iv."): it ends like a sentence but isn't one */
const OPTION_LABEL = /(?:^|\s)(?:[a-z]|\d{1,2}|[ivx]{1,4})[.)]\s*$/i;
const BARE_LABEL = /^(?:[a-z]|\d{1,2}|[ivx]{1,4})[.)]$/i;
const SENTENCE = /[^\n]+?(?:[.!?؟]+["”’')\]]*(?=\s|$)|(?=\n)|$)/g;

export function tokenize(raw: string, unit: MarkUnit): { pieces: Piece[]; tail: string } {
  const { text, bold } = readBold(raw);
  const pieces: Piece[] = [];
  let pending = '';
  let at = 0;
  const re = unit === 'sentence' ? SENTENCE : unit === 'word' ? /\S+/g : /\S/g;
  for (const m of text.matchAll(re)) {
    pending += text.slice(at, m.index);
    at = m.index + m[0].length;
    let body = m[0];
    let start = m.index;
    if (unit === 'sentence') {
      const lead = body.match(/^\s*/)![0].length + (body.trimStart().match(LINE_LABEL)?.[0].length || 0);
      pending += body.slice(0, lead);
      body = body.slice(lead);
      start += lead;
    }
    const key = normalizeForMarks(body);
    // Punctuation on its own, or a bare item label ("a." "1."), is nothing to tap
    if (!key || (unit === 'sentence' && BARE_LABEL.test(body.trim()))) { pending += body; continue; }
    pieces.push({ runs: runsOf(body, start, bold), text: body, key, before: pending });
    pending = '';
  }
  // Lettered options: an unlettered sentence among them is what they are about
  if (unit === 'sentence') {
    const lettered = pieces.filter(p => OPTION_LABEL.test(p.before));
    if (lettered.length >= 2) for (const p of pieces) if (!OPTION_LABEL.test(p.before)) p.context = true;
  }
  return { pieces, tail: pending + text.slice(at) };
}

/** Where a span sits: every [first, last] piece range that spells it */
function occurrences(pieces: Piece[], span: string, unit: MarkUnit): Array<[number, number]> {
  const join = unit === 'letter' ? '' : ' ';
  const target = unit === 'letter' ? normalizeForMarks(span).replace(/\s/g, '') : normalizeForMarks(span);
  if (!target) return [];
  const found: Array<[number, number]> = [];
  for (let i = 0; i < pieces.length; i++) {
    let joined = '';
    for (let j = i; j < pieces.length; j++) {
      joined += (j > i ? join : '') + pieces[j].key;
      if (joined === target) { found.push([i, j]); break; }
      if (joined.length >= target.length) break;
    }
  }
  return found;
}

/** Is this span in the text at all, at any grain? (the validator's question) */
export function spanInText(text: string, span: string): boolean {
  return (['word', 'sentence', 'letter'] as MarkUnit[]).some(u => occurrences(tokenize(text, u).pieces, span, u).length > 0);
}

/**
 * The size of piece to tap, from what the key marks: whole sentences when every
 * answer is one (a text of several), otherwise words; letters when an answer sits
 * inside a word (the schwa in "possible").
 */
export function unitFor(text: string, spans: string[]): MarkUnit {
  const fits = (u: MarkUnit) => spans.every(s => occurrences(tokenize(text, u).pieces, s, u).length > 0);
  if (spans.length && tokenize(text, 'sentence').pieces.length > 1 && fits('sentence')) return 'sentence';
  if (!spans.length || fits('word')) return 'word';
  return fits('letter') ? 'letter' : 'word';
}

const nonOverlapping = (ranges: Array<[number, number]>) => {
  const kept: Array<[number, number]> = [];
  for (const r of ranges) if (!kept.length || r[0] > kept[kept.length - 1][1]) kept.push(r);
  return kept;
};
const spellsOut = (r: [number, number], marked: Set<number>) => {
  for (let k = r[0]; k <= r[1]; k++) if (!marked.has(k)) return false;
  return true;
};
const spansOf = (answer: MarkAnswer[], mark: string) => answer.filter(a => a.mark === mark).map(a => a.span);

/** Right only when, for every mark, each key span is marked and nothing else is */
export function marksCorrect(pieces: Piece[], unit: MarkUnit, marks: string[], answer: MarkAnswer[], marked: Record<string, Set<number>>): boolean {
  return marks.every(mark => {
    const chosen = marked[mark] || new Set<number>();
    const spans = spansOf(answer, mark);
    const covered = new Set<number>();
    for (const span of new Set(spans.map(normalizeForMarks))) {
      const hits = nonOverlapping(occurrences(pieces, span, unit).filter(r => spellsOut(r, chosen)));
      if (hits.length < spans.filter(s => normalizeForMarks(s) === span).length) return false;
      for (const [a, b] of hits) for (let k = a; k <= b; k++) covered.add(k);
    }
    return [...chosen].every(k => covered.has(k));
  });
}

/** The pieces to show as the book's answer for one mark, using the student's own place when they chose one */
export function keyPieces(pieces: Piece[], unit: MarkUnit, mark: string, answer: MarkAnswer[], chosen: Set<number> = new Set()): Set<number> {
  const out = new Set<number>();
  for (const span of spansOf(answer, mark)) {
    const all = occurrences(pieces, span, unit);
    const free = all.filter(r => { for (let k = r[0]; k <= r[1]; k++) if (out.has(k)) return false; return true; });
    const pick = free.find(r => spellsOut(r, chosen)) || free[0] || all[0];
    if (pick) for (let k = pick[0]; k <= pick[1]; k++) out.add(k);
  }
  return out;
}

export type MarkKind = 'underline' | 'circle' | 'box' | 'highlight' | 'strike' | 'star' | 'tag';

/** How a mark looks: the book's own, or (for a written tag like "SS") its name beside the piece */
export function markKind(name: string): MarkKind {
  const n = name.toLowerCase();
  if (/underlin/.test(n)) return 'underline';
  if (/circl|ring/.test(n)) return 'circle';
  if (/cross|strike/.test(n)) return 'strike';
  if (/star/.test(n)) return 'star';
  if (/box|square/.test(n)) return 'box';
  if (/highlight/.test(n)) return 'highlight';
  return 'tag';
}
