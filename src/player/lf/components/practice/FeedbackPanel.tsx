import React from 'react';
import { Rich } from './Bilingual';

interface FeedbackPanelProps {
  correct: boolean;
  explanation?: string;
  explanationArabic?: string;
  /** Extra line above the explanations (e.g. the correct answer) */
  extra?: React.ReactNode;
  /** When provided, renders a blocking Continue button (wrong answers) */
  onContinue?: () => void;
  continueLabel?: string;
}

/** Bilingual EN + RTL-Arabic feedback panel shared by all practice exercises */
export function FeedbackPanel({ correct, explanation, explanationArabic, extra, onContinue, continueLabel = 'Continue →' }: FeedbackPanelProps) {
  return (
    <div className={`mx-4 mb-3 px-3 py-2.5 rounded-lg text-sm space-y-1.5 ${
      correct ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
    }`}>
      <p className="font-semibold">{correct ? '✓ Correct!' : '✗ Not quite'}</p>
      {extra}
      {explanation && <p><Rich text={explanation} /></p>}
      {explanationArabic && <p dir="rtl" lang="ar" className="text-right"><Rich text={explanationArabic} /></p>}
      {onContinue && (
        <button
          onClick={onContinue}
          className="w-full mt-2 py-2.5 rounded-lg font-semibold text-white bg-indigo-600 active:bg-indigo-700"
        >
          {continueLabel}
        </button>
      )}
    </div>
  );
}
