import { Languages, Type } from 'lucide-react';
import { useAssist, setAssist } from '../../hooks/useAssist';
import { LangChoice } from '../../utils/assist';

/**
 * In-exercise switch for the Arabic overlay. Rendered only on items that
 * actually have Arabic available, right where a stuck student is looking —
 * the entry picker sets the same preference up front.
 */
export function AssistToggle({ className = '' }: { className?: string }) {
  const assist = useAssist();
  return (
    <button
      onClick={() => setAssist(!assist)}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
        assist
          ? 'bg-indigo-50 border-indigo-200 text-indigo-600 active:bg-indigo-100'
          : 'bg-white border-slate-200 text-slate-500 active:bg-slate-50'
      } ${className}`}
    >
      <Languages className="w-3.5 h-3.5 shrink-0" />
      {assist ? 'Hide Arabic' : 'مساعدة بالعربية'}
    </button>
  );
}

/**
 * Step 1 of the entry flow: how the student wants to read the questions.
 *
 * This gets its own screen, ahead of the Multiple Choice / Challenge step,
 * because as a secondary control at the bottom of the mode screen students
 * simply skipped it — and the ones who most need the Arabic are the least
 * likely to go hunting for it. Deliberately neutral: two equal cards, nothing
 * pre-selected, no recommendation, so the student has to actually decide.
 */
export function LanguageChoice({ onChoose }: { onChoose: (lang: LangChoice) => void }) {
  const card = 'w-full bg-white rounded-2xl border-2 shadow-sm p-5 text-left flex items-start gap-4';
  return (
    <div className="p-5 max-w-lg mx-auto space-y-4">
      <div className="text-center mt-2">
        <p className="text-slate-600 text-sm">How would you like to read the questions?</p>
        <p className="text-slate-500 text-sm mt-1" dir="rtl" lang="ar">كيف تريد قراءة الأسئلة؟</p>
      </div>

      <button
        onClick={() => onChoose('en')}
        className={`${card} border-indigo-200 active:border-indigo-400`}
      >
        <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
          <Type className="w-6 h-6 text-indigo-600" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">English only</p>
          <p className="text-sm text-slate-500 mt-0.5">Everything stays in English.</p>
          <p className="text-sm text-slate-500 text-right mt-1" dir="rtl" lang="ar">كل الأسئلة بالإنجليزية فقط</p>
        </div>
      </button>

      <button
        onClick={() => onChoose('ar')}
        className={`${card} border-emerald-200 active:border-emerald-400`}
      >
        <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <Languages className="w-6 h-6 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">English + عربي</p>
          <p className="text-sm text-slate-500 mt-0.5">Questions also shown in Arabic. You still answer in English.</p>
          <p className="text-sm text-slate-500 text-right mt-1" dir="rtl" lang="ar">الأسئلة معروضة بالعربية أيضاً، وتجيب بالإنجليزية</p>
        </div>
      </button>

      <p className="text-center text-xs text-slate-400">You can change this at any time while you work.</p>
    </div>
  );
}
