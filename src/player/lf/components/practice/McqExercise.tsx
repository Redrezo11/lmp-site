import { useState, useEffect, useRef, useMemo } from 'react';
import { McqItem, optionsArabicLeaksAnswer } from '../../types/practice';
import { FeedbackPanel } from './FeedbackPanel';
import { useAssist } from '../../hooks/useAssist';
import { AssistToggle } from './AssistToggle';
import { BilingualText, Rich, ARABIC_FONT } from './Bilingual';
import { optionOrder } from '../../utils/seededShuffle';
import { cleanExample } from '../../utils/assist';

interface McqExerciseProps {
  item: McqItem;
  onComplete: (result: { correct: boolean }) => void;
  /** Challenge mode on a converted quiz gap-fill: type the answer instead of tapping */
  typedMode?: boolean;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.?!]+$/, '');

/** "نوع الكلمة (part of speech)" already carries the English — don't print it twice */
const containsEnglish = (arabic: string, english: string) => arabic.toLowerCase().includes(english.trim().toLowerCase());

/**
 * Single MCQ with immediate feedback (ported from vocalize LexisGapFillGame):
 * one answer per question, correct → brief success dwell then auto-advance,
 * wrong → blocking Continue with bilingual explanation.
 */
export function McqExercise({ item, onComplete, typedMode }: McqExerciseProps) {
  const assist = useAssist();
  const [selected, setSelected] = useState<string | null>(null);
  const [typedValue, setTypedValue] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const answered = selected !== null;
  const isCorrect = answered && normalize(selected!) === normalize(item.correctAnswer);
  // Legacy quiz gap-fills carry no options — they can only be typed
  const useTyped = typedMode || !item.options || item.options.length < 2;

  // Options appear in a stable shuffled order — the generator puts the right
  // answer first almost every time. Position is display-only; grading uses text.
  const order = useMemo(() => optionOrder(item.questionText, item.options || []), [item]);
  // Example with any answer-revealing labels ("help? (noun)") stripped
  const example = useMemo(() => cleanExample(item.example, item.options), [item]);

  // Assist mode: the Arabic ASKS and the Arabic ANSWERS. The English options stay
  // the graded spine — every button still submits its English option — so the
  // score is identical in both modes; only what the student reads changes.
  const arabicQuestion = assist && item.questionTextArabic?.trim() ? item.questionTextArabic : null;
  // A label set that singles out the correct answer (the only English option among
  // Arabic distractors, or vice versa) would give it away — fall back to the
  // English options in that case; the Arabic question still shows
  const optionsUsable = item.optionsArabic?.length === item.options?.length
    && !optionsArabicLeaksAnswer(item.options, item.optionsArabic, item.correctAnswer);
  const arabicOptions = assist && optionsUsable ? item.optionsArabic : null;
  /** Arabic label for option i — null when there is none, or when the option IS English material */
  const arabicFor = (i: number): string | null => {
    const ar = arabicOptions?.[i]?.trim();
    return ar && ar !== item.options[i] ? ar : null;
  };
  const correctIdx = (item.options || []).findIndex(o => normalize(o) === normalize(item.correctAnswer));
  const arabicCorrect = correctIdx >= 0 ? arabicFor(correctIdx) : null;

  const handleSelect = (option: string) => {
    if (answered) return;
    setSelected(option);
    const correct = normalize(option) === normalize(item.correctAnswer);
    if (correct) {
      timerRef.current = setTimeout(() => onComplete({ correct: true }), 1500);
    }
  };

  const optionClass = (option: string): string => {
    if (!answered) return 'bg-white border-slate-200 text-slate-700 active:bg-slate-50';
    const right = option.trim().toLowerCase() === item.correctAnswer.trim().toLowerCase();
    if (right) return 'bg-emerald-50 border-emerald-400 text-emerald-800 font-medium';
    if (option === selected) return 'bg-red-50 border-red-300 text-red-800';
    return 'bg-white border-slate-200 text-slate-400 opacity-50';
  };

  return (
    <div>
      {example && (
        <div dir="ltr" className="mx-4 mb-3 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-left">
          <span className="block text-[10px] uppercase tracking-wide text-slate-400 mb-1">Example</span>
          <p className="text-slate-800 leading-relaxed whitespace-pre-line"><Rich text={example} /></p>
        </div>
      )}
      <div className="px-4 pb-3">
        <BilingualText arabic={arabicQuestion} english={item.questionText} />
        {item.questionTextArabic?.trim() && <AssistToggle className="mt-2" />}
      </div>
      {useTyped ? (
        <div className="px-4 pb-3">
          <input
            type="text"
            value={typedValue}
            onChange={(e) => setTypedValue(e.target.value)}
            disabled={answered}
            placeholder="Type the missing word(s)..."
            className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none ${
              !answered ? 'border-slate-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
              : isCorrect ? 'border-emerald-400 bg-emerald-50' : 'border-amber-300 bg-amber-50'
            }`}
          />
          {!answered && (
            <button
              onClick={() => { if (typedValue.trim()) handleSelect(typedValue); }}
              disabled={!typedValue.trim()}
              className={`w-full mt-2 py-2.5 rounded-xl font-semibold text-white ${typedValue.trim() ? 'bg-amber-500 active:bg-amber-600' : 'bg-slate-300'}`}
            >
              Check
            </button>
          )}
        </div>
      ) : (
        <div className="px-4 pb-3 space-y-2">
          {order.map((i, pos) => {
            const opt = item.options[i];
            const ar = arabicFor(i);
            const letter = String.fromCharCode(65 + pos);
            return (
              <button
                key={i}
                onClick={() => handleSelect(opt)}
                disabled={answered}
                dir={ar ? 'rtl' : 'ltr'}
                className={`w-full ${ar ? 'text-right' : 'text-left'} px-3 py-2.5 rounded-lg border text-sm transition-colors ${optionClass(opt)}`}
              >
                {ar ? (
                  <>
                    {/* Arabic is the answer the student reads; the English option is what grades */}
                    <span className="flex items-start gap-2">
                      <span dir="ltr" className="font-semibold shrink-0">{letter}.</span>
                      <span lang="ar" style={{ fontFamily: ARABIC_FONT }} className="text-base leading-relaxed"><Rich text={ar} /></span>
                    </span>
                    {!containsEnglish(ar, opt) && (
                      <span dir="ltr" className="block text-left text-xs opacity-70 mt-1"><Rich text={opt} /></span>
                    )}
                  </>
                ) : (
                  <><span className="font-semibold mr-2">{letter}.</span><Rich text={opt} /></>
                )}
              </button>
            );
          })}
        </div>
      )}
      {answered && (
        <FeedbackPanel
          correct={isCorrect}
          extra={!isCorrect ? (
            arabicCorrect ? (
              <div>
                <p dir="rtl" lang="ar" className="text-right" style={{ fontFamily: ARABIC_FONT }}>
                  الإجابة: <span className="font-semibold"><Rich text={arabicCorrect} /></span>
                </p>
                {!containsEnglish(arabicCorrect, item.correctAnswer) && (
                  <p className="text-xs opacity-80 mt-0.5">Answer: <Rich text={item.correctAnswer} /></p>
                )}
              </div>
            ) : (
              <p>Answer: <span dir="auto" className="font-semibold inline-block"><Rich text={item.correctAnswer} /></span></p>
            )
          ) : undefined}
          explanation={item.explanation}
          explanationArabic={item.explanationArabic}
          onContinue={!isCorrect ? () => onComplete({ correct: false }) : undefined}
        />
      )}
    </div>
  );
}
