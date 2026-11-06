import { useState, useEffect, useRef } from 'react';
import { TypedItem } from '../../types/practice';
import { FeedbackPanel } from './FeedbackPanel';
import { useAssist } from '../../hooks/useAssist';
import { AssistToggle } from './AssistToggle';
import { BilingualText } from './Bilingual';
import { normalizeAnswer, linesCorrect, AnswerLine } from '../../utils/typedAnswers';

interface TypedExerciseProps {
  item: TypedItem;
  onComplete: (result: { correct: boolean }) => void;
}

/**
 * A written answer. One box (practice, quiz) — or, for a book question with
 * several answer lines (a./b.), one box per line on ONE screen, marked as one
 * question. `selfCheck`: when not exactly right, the student compares with the
 * book's answer and says whether theirs is the same.
 */
export function TypedExercise({ item, onComplete }: TypedExerciseProps) {
  const assist = useAssist();
  // One box is the one-line case of the same thing
  const lines: AnswerLine[] = item.lines?.length ? item.lines : [{ label: '', acceptableAnswers: item.acceptableAnswers }];
  const multi = lines.length > 1 || !!item.lines?.length;
  const [values, setValues] = useState<string[]>(() => lines.map(() => ''));
  const [checked, setChecked] = useState<'correct' | 'wrong' | 'compare' | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Own ideas: the book's boxes are room to write, not a quota. A box the book
  // gives no answer for (a chart's spare row) is optional.
  const filled = item.vary
    ? values.some(v => v.trim())
    : values.every((v, k) => v.trim() || (item.selfCheck && !lines[k].acceptableAnswers.length));
  // A short printed label (a, b, 1) sits beside its box; a longer one (a chart's column) above it
  const inline = (label: string) => label.length <= 3;
  const heading = (k: number) => {
    const g = lines[k].group;
    return g && (k === 0 || lines[k - 1].group !== g) ? g : null;
  };
  const handleCheck = () => {
    if (checked || !filled) return;
    const correct = multi
      ? linesCorrect(lines, values, !!item.anyOrder)
      : item.acceptableAnswers.some(a => normalizeAnswer(a) === normalizeAnswer(values[0]));
    // Answers vary: never right or wrong, always the book's example
    if (item.vary) { setChecked('compare'); return; }
    setChecked(correct ? 'correct' : item.selfCheck ? 'compare' : 'wrong');
    if (correct) {
      timerRef.current = setTimeout(() => onComplete({ correct: true }), 1500);
    }
  };

  const boxClass = `w-full px-3 py-2.5 rounded-lg border text-sm outline-none ${
    checked === 'correct' ? 'border-emerald-400 bg-emerald-50'
    : item.vary && checked ? 'border-slate-300 bg-slate-50'
    : checked === 'wrong' || checked === 'compare' ? 'border-amber-300 bg-amber-50'
    : 'border-slate-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
  }`;
  const bookAnswers = (line: AnswerLine) => (item.anyOrder ? [line.acceptableAnswers[0]] : line.acceptableAnswers);

  return (
    <div>
      <div className="mx-4 mb-2 px-2 py-1 rounded bg-amber-50 border border-amber-200 inline-block">
        <span className="text-xs font-medium text-amber-700">{item.selfCheck ? '✍ Write your answer' : '✍ Challenge — write your answer'}{multi ? `s (${lines.length})` : ''}</span>
      </div>
      <div className="px-4 pb-3">
        {/* Assist mode: the Arabic asks, English beneath. The answer is written in English either way */}
        <BilingualText arabic={assist ? item.promptArabic : null} english={item.prompt} />
        {item.promptArabic?.trim() && <AssistToggle className="mt-2" />}
      </div>
      <div className="px-4 pb-3 space-y-2">
        {lines.map((line, k) => (
          <div key={k}>
            {heading(k) && <p className={`text-sm font-bold text-slate-800 ${k ? 'pt-2' : ''}`}>{heading(k)}</p>}
            {line.prompt && <p className="text-sm text-slate-700 mb-1">{line.prompt}</p>}
            {line.label && !inline(line.label) && <p className="text-xs font-semibold text-slate-500 mb-0.5">{line.label}</p>}
            <div className="flex items-center gap-2">
              {line.label && inline(line.label) && <span className="w-6 shrink-0 text-sm font-semibold text-slate-500">{line.label}.</span>}
              <input
                type="text"
                value={values[k]}
                onChange={(e) => setValues(vs => vs.map((v, j) => (j === k ? e.target.value : v)))}
                disabled={!!checked}
                aria-label={line.label ? `Answer ${line.group ? `${line.group} ` : ''}${line.label}` : 'Your answer'}
                placeholder={line.group ? 'Write here…' : 'Type your answer...'}
                className={boxClass}
              />
            </div>
          </div>
        ))}
      </div>
      {!checked && (
        <div className="px-4 pb-3">
          <button
            onClick={handleCheck}
            disabled={!filled}
            className={`w-full py-2.5 rounded-xl font-semibold text-white ${filled ? 'bg-amber-500 active:bg-amber-600' : 'bg-slate-300'}`}
          >
            Check
          </button>
        </div>
      )}
      {checked === 'compare' && (
        <div className="mx-4 mb-4 rounded-xl border border-slate-200 bg-white p-3 space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{item.vary ? `Answers vary — the book’s example${multi ? 's' : ''}` : `The book’s answer${multi ? 's' : ''}`}</p>
            {lines.map((line, k) => (
              <div key={k}>
                {heading(k) && <p className={`text-xs font-bold text-slate-600 ${k ? 'pt-1' : ''}`}>{heading(k)}</p>}
                <div className="flex gap-2">
                  {line.label && <span className={`${inline(line.label) ? 'w-6' : ''} shrink-0 text-sm font-semibold text-slate-500`}>{line.label}{inline(line.label) ? '.' : ':'}</span>}
                  <div>{line.acceptableAnswers.length
                    ? bookAnswers(line).map((a, i) => <p key={i} className="font-semibold text-slate-800">{a}</p>)
                    : <p className="text-sm italic text-slate-400">no example in the book</p>}</div>
                </div>
              </div>
            ))}
          </div>
          {item.vary ? (
            <button onClick={() => onComplete({ correct: true })} className="w-full py-2.5 rounded-xl font-semibold text-white bg-indigo-600 active:bg-indigo-700">Next</button>
          ) : (
            <>
              <p className="text-sm text-slate-600">{multi ? 'Do yours say the same?' : 'Does yours say the same?'}</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onComplete({ correct: true })} className="py-2.5 rounded-xl font-semibold text-white bg-emerald-600 active:bg-emerald-700">{multi ? 'Mine say the same' : 'Mine says the same'}</button>
                <button onClick={() => onComplete({ correct: false })} className="py-2.5 rounded-xl font-semibold text-slate-700 bg-slate-100 active:bg-slate-200">{multi ? 'Mine are different' : 'Mine is different'}</button>
              </div>
            </>
          )}
        </div>
      )}
      {(checked === 'correct' || checked === 'wrong') && (
        <FeedbackPanel
          correct={checked === 'correct'}
          extra={checked === 'wrong' ? (
            multi
              ? <div>{lines.map((line, k) => <p key={k}>{line.group && heading(k) ? `${line.group} · ` : ''}{line.label ? `${line.label}${inline(line.label) ? '.' : ':'} ` : ''}<span className="font-semibold">{bookAnswers(line)[0] ?? '—'}</span></p>)}</div>
              : <p>Example answer: <span className="font-semibold">{item.acceptableAnswers[0]}</span></p>
          ) : undefined}
          explanation={item.explanation}
          explanationArabic={item.explanationArabic}
          onContinue={checked === 'wrong' ? () => onComplete({ correct: false }) : undefined}
        />
      )}
    </div>
  );
}
