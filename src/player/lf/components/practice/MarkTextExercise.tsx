import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SelectItem } from '../../types/practice';
import { FeedbackPanel } from './FeedbackPanel';
import { tokenize, unitFor, marksCorrect, keyPieces, markKind, MarkAnswer, MarkKind, MarkUnit, Piece } from '../../utils/markText';

type Tone = 'active' | 'right' | 'wrong' | 'missed';
const TONES: Record<Tone, { deco: string; ring: string; bg: string; tag: string }> = {
  active: { deco: 'decoration-indigo-600', ring: 'ring-indigo-600', bg: 'bg-indigo-100', tag: 'bg-indigo-600 text-white' },
  right: { deco: 'decoration-emerald-600', ring: 'ring-emerald-600', bg: 'bg-emerald-100', tag: 'bg-emerald-600 text-white' },
  wrong: { deco: 'decoration-red-600', ring: 'ring-red-600', bg: 'bg-red-100', tag: 'bg-red-600 text-white' },
  missed: { deco: 'decoration-amber-500', ring: 'ring-amber-500', bg: 'bg-amber-100', tag: 'bg-amber-500 text-white' },
};

function markClass(kind: MarkKind, tone: Tone): string {
  const t = TONES[tone];
  switch (kind) {
    case 'underline': return `underline decoration-[3px] underline-offset-4 ${t.deco}`;
    case 'strike': return `line-through decoration-[3px] ${t.deco}`;
    case 'circle': return `rounded-full ring-2 ${t.ring} [box-decoration-break:clone]`;
    case 'box': return `rounded-sm ring-2 ${t.ring} [box-decoration-break:clone]`;
    case 'highlight': return t.bg;
    default: return '';
  }
}

interface Drawn { mark: string; tone: Tone }

/** One piece of the text with its marks drawn as in the book */
function PieceView({ piece, unit, drawn, onTap }: { piece: Piece; unit: MarkUnit; drawn: Drawn[]; onTap?: () => void }) {
  const classes = drawn.map(d => markClass(markKind(d.mark), d.tone)).join(' ');
  const inner = piece.runs.map((r, i) => (r.bold ? <b key={i}>{r.text}</b> : <React.Fragment key={i}>{r.text}</React.Fragment>));
  const tags = drawn.filter(d => markKind(d.mark) === 'tag');
  const stars = drawn.filter(d => markKind(d.mark) === 'star');
  const body = (
    <>
      {tags.map(d => <span key={d.mark} className={`mr-1 inline-block rounded px-1 text-xs font-bold align-middle no-underline ${TONES[d.tone].tag}`}>{d.mark}</span>)}
      {inner}
      {stars.map(d => <span key={d.mark} aria-hidden className={d.tone === 'wrong' ? 'text-red-600' : d.tone === 'missed' ? 'text-amber-500' : d.tone === 'right' ? 'text-emerald-600' : 'text-indigo-600'}>★</span>)}
    </>
  );
  const pad = unit === 'letter' ? 'px-0.5 py-1' : unit === 'word' ? 'px-0.5 py-1' : 'py-1';
  if (!onTap) return <span className={`${pad} ${classes}`}>{body}</span>;
  return (
    <span role="button" tabIndex={0} aria-pressed={drawn.length > 0} aria-label={piece.text}
      onClick={onTap} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(); } }}
      className={`${pad} cursor-pointer select-none rounded outline-none focus-visible:bg-indigo-50 active:bg-indigo-50 ${classes}`}>
      {body}
    </span>
  );
}

function TextWithMarks({ pieces, tail, unit, drawnOf, onTap, canTap }: {
  pieces: Piece[]; tail: string; unit: MarkUnit; drawnOf: (i: number) => Drawn[]; onTap?: (i: number) => void; canTap?: (i: number) => boolean;
}) {
  return (
    <p className={`whitespace-pre-wrap text-slate-900 ${unit === 'letter' ? 'text-2xl tracking-wide' : 'text-lg leading-[2.4rem]'}`}>
      {pieces.map((p, i) => (
        <React.Fragment key={i}>
          {p.before}
          <PieceView piece={p} unit={unit} drawn={drawnOf(i)} onTap={onTap && (!canTap || canTap(i)) ? () => onTap(i) : undefined} />
        </React.Fragment>
      ))}
      {tail}
    </p>
  );
}

/** Read-only: the text with the book's marks, for the teacher's preview and editor */
export function MarkedTextView({ text, marks, answer }: { text: string; marks: string[]; answer: MarkAnswer[] }) {
  const unit = unitFor(text, answer.map(a => a.span));
  const { pieces, tail } = tokenize(text, unit);
  const keys = marks.map(mark => ({ mark, set: keyPieces(pieces, unit, mark, answer) }));
  return (
    <div className="[&_p]:text-sm [&_p]:leading-7">
      <TextWithMarks pieces={pieces} tail={tail} unit={unit}
        drawnOf={(i) => keys.filter(k => k.set.has(i)).map(k => ({ mark: k.mark, tone: 'right' as Tone }))} />
    </div>
  );
}

/**
 * "Underline this, circle that" on the phone: the text is on the screen and the
 * student taps the pieces (a sentence, a word, a letter) to mark them. Words next
 * to each other join into a phrase. With several marks a tool row picks which one.
 * Marked as one question, right only when it matches the book.
 */
export function MarkTextExercise({ item, onComplete }: { item: SelectItem; onComplete: (result: { correct: boolean }) => void }) {
  const unit = useMemo(() => unitFor(item.text, item.answer.map(a => a.span)), [item]);
  const { pieces, tail } = useMemo(() => tokenize(item.text, unit), [item, unit]);
  const [tool, setTool] = useState(item.marks[0]);
  const [marked, setMarked] = useState<Record<string, Set<number>>>({});
  const [checked, setChecked] = useState<'correct' | 'wrong' | 'compare' | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Context stays plain, unless the book's answer really is that sentence
  const onKey = useMemo(() => new Set(item.marks.flatMap(m => [...keyPieces(pieces, unit, m, item.answer)])), [item, pieces, unit]);
  const count = item.marks.reduce((n, m) => n + (marked[m]?.size || 0), 0);
  const tap = (i: number) => setMarked(all => {
    const next = new Set(all[tool] || []);
    if (next.has(i)) next.delete(i); else next.add(i);
    return { ...all, [tool]: next };
  });
  const handleCheck = () => {
    if (checked || !count) return;
    if (item.vary) { setChecked('compare'); return; }
    const correct = marksCorrect(pieces, unit, item.marks, item.answer, marked);
    setChecked(correct ? 'correct' : item.selfCheck ? 'compare' : 'wrong');
    if (correct) timerRef.current = setTimeout(() => onComplete({ correct: true }), 1500);
  };

  const keys = useMemo(() => Object.fromEntries(item.marks.map(m => [m, keyPieces(pieces, unit, m, item.answer, marked[m])])),
    [item, pieces, unit, marked]);
  const drawnOf = (i: number): Drawn[] => item.marks.flatMap((mark): Drawn[] => {
    const mine = !!marked[mark]?.has(i);
    if (!checked) return mine ? [{ mark, tone: 'active' }] : [];
    const book = keys[mark].has(i);
    // Answers vary: the student's own marks, beside the book's example
    if (item.vary) return book ? [{ mark, tone: 'right' }] : mine ? [{ mark, tone: 'active' }] : [];
    if (mine) return [{ mark, tone: book || checked === 'correct' ? 'right' : 'wrong' }];
    return book && checked !== 'correct' ? [{ mark, tone: 'missed' }] : [];
  });

  return (
    <div>
      {item.prompt && (
        <div className="px-4 pb-2">
          <p className="text-sm font-semibold text-slate-600">{item.prompt}</p>
        </div>
      )}
      {item.marks.length > 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2" role="group" aria-label="Choose your mark">
          {item.marks.map(m => (
            <button key={m} aria-pressed={tool === m} disabled={!!checked} onClick={() => setTool(m)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium capitalize ${tool === m ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-300 bg-white text-slate-700'}`}>
              {m}
            </button>
          ))}
        </div>
      )}
      <div className="px-4 pb-3">
        {!checked && !count && (
          <p className="text-xs font-medium text-indigo-700 mb-1">Tap the {unit === 'sentence' ? 'sentence' : unit === 'letter' ? 'letters' : 'words'} to mark {unit === 'sentence' ? 'it' : 'them'}. Tap again to clear.</p>
        )}
        <TextWithMarks pieces={pieces} tail={tail} unit={unit} drawnOf={drawnOf} onTap={checked ? undefined : tap}
          canTap={(i) => !pieces[i].context || onKey.has(i)} />
      </div>
      {!checked && (
        <div className="px-4 pb-3 space-y-1">
          <button onClick={handleCheck} disabled={!count}
            className={`w-full py-2.5 rounded-xl font-semibold text-white ${count ? 'bg-amber-500 active:bg-amber-600' : 'bg-slate-300'}`}>
            Check
          </button>
        </div>
      )}
      {checked && checked !== 'correct' && !item.vary && (
        <p className="px-4 pb-2 text-xs text-slate-600">
          <span className="font-semibold text-emerald-700">Green</span>: yours and the book’s · <span className="font-semibold text-amber-600">Orange</span>: the book’s, you didn’t mark it
          {checked === 'wrong' ? <> · <span className="font-semibold text-red-700">Red</span>: not in the book’s answer</> : null}
        </p>
      )}
      {checked === 'compare' && item.vary && (
        <div className="mx-4 mb-4 space-y-2">
          <p className="text-sm text-slate-600">Answers vary. <span className="font-semibold text-emerald-700">Green</span> is the book’s example.</p>
          <button onClick={() => onComplete({ correct: true })} className="w-full py-2.5 rounded-xl font-semibold text-white bg-indigo-600 active:bg-indigo-700">Next</button>
        </div>
      )}
      {checked === 'compare' && !item.vary && (
        <div className="mx-4 mb-4 rounded-xl border border-slate-200 bg-white p-3 space-y-3">
          <p className="text-sm text-slate-600">Here more than one answer can be fine. Compare yours with the book’s: do they match?</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onComplete({ correct: true })} className="py-2.5 rounded-xl font-semibold text-white bg-emerald-600 active:bg-emerald-700">Mine match</button>
            <button onClick={() => onComplete({ correct: false })} className="py-2.5 rounded-xl font-semibold text-slate-700 bg-slate-100 active:bg-slate-200">Mine are different</button>
          </div>
        </div>
      )}
      {(checked === 'correct' || checked === 'wrong') && (
        <FeedbackPanel correct={checked === 'correct'} explanation={item.explanation} explanationArabic={item.explanationArabic}
          onContinue={checked === 'wrong' ? () => onComplete({ correct: false }) : undefined} />
      )}
    </div>
  );
}
