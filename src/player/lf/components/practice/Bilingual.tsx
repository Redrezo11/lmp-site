import React from 'react';

export const ARABIC_FONT = "'Noto Sans Arabic','Segoe UI',Tahoma,sans-serif";

/**
 * Render the *italic* / **bold** markdown the generator puts in questions and
 * explanations ("the word *studious* is the _____") instead of showing raw
 * asterisks. Underscores are deliberately left alone — _____ is the gap-fill
 * blank — and a lone asterisk followed by a space ("5 * 3") stays literal.
 */
export function Rich({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(m[1] !== undefined ? <strong key={key++}>{m[1]}</strong> : <em key={key++}>{m[2]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

type Size = 'question' | 'instructions';

// English-only mode — exactly how these lines have always looked
const EN_ONLY: Record<Size, string> = {
  question: 'text-slate-800 font-medium leading-relaxed whitespace-pre-line',
  instructions: 'text-sm text-slate-600',
};

// Assist mode — the Arabic is the line the student reads
const AR_PRIMARY: Record<Size, string> = {
  question: 'text-lg font-semibold text-slate-900 leading-loose',
  instructions: 'text-base font-semibold text-slate-800 leading-loose',
};

/**
 * One piece of exercise text, in either mode.
 *
 * With Arabic (assist mode on and a translation available) the ARABIC is the
 * primary line and the English drops to a small support line beneath — the
 * teacher's spec is "Arabic to ask the questions as well as the answers". The
 * first version inverted this (English large, Arabic as a faded footnote), and
 * bilingual mode read as English-only. Without Arabic it renders exactly as
 * English-only mode always has. Shared by every exercise type so they can't
 * drift apart again.
 */
export function BilingualText({ arabic, english, size = 'question' }: {
  arabic?: string | null;
  english: string;
  size?: Size;
}) {
  const ar = arabic?.trim();
  if (!ar) return <p className={EN_ONLY[size]}><Rich text={english} /></p>;
  return (
    <div>
      <p dir="rtl" lang="ar" style={{ fontFamily: ARABIC_FONT }} className={`text-right ${AR_PRIMARY[size]}`}>
        <Rich text={ar} />
      </p>
      <p dir="ltr" className="mt-1.5 text-left text-xs text-slate-500 leading-relaxed whitespace-pre-line"><Rich text={english} /></p>
    </div>
  );
}
