import { useMemo, useState } from 'react';
import { X, Headphones, BookOpen, Image as ImageIcon, Check, PencilLine } from 'lucide-react';
import { PracticeSession, SessionSummary } from '../../practice/PracticeSession';
import { PracticeSet } from '../../../types/practice';
import { StudentInteractive } from '../../../types/exerciseTemplates';
import { toPracticeItems, phoneReadiness, readinessShort } from './toPracticeItems';
import { StructuredView } from './DigitalPreview';
import { useAssist } from '../../../hooks/useAssist';

export interface RunnableExercise {
  id: string;
  number: number;
  imageUrls: string[];
  interactive: StudentInteractive;
}

const doneKey = (extractionId: string, exId: string) => `exercise-done-${extractionId}-${exId}`;
// `persist`: a student at home — kept on the phone (localStorage, own keys) so
// it survives closing the tab and never mixes with a class QR run
const storeFor = (persist?: boolean) => (persist ? localStorage : sessionStorage);
const prefix = (persist?: boolean) => (persist ? 'lf-' : '');
export const isExerciseDone = (extractionId: string, exId: string, persist?: boolean) => {
  try { return storeFor(persist).getItem(prefix(persist) + doneKey(extractionId, exId)) === '1'; } catch { return false; }
};

/**
 * A student doing one of the book's exercises on the phone (full-screen sheet).
 * Marked only when the key is trusted (`scored`); otherwise it is a worksheet
 * with no answers in it. Parts that aren't phone questions yet are listed "on
 * paper". Opened from the replay (exercise slide) and the QR quiz page.
 *
 * `preview`: the teacher's card shows THIS component, embedded in a phone
 * frame — exactly what students get, nothing tracked or remembered. One
 * renderer, so a preview with nothing to do is the bug, seen before students.
 */
export function ExerciseRunner({ extractionId, exercise, onClose, onDone, preview = false, persist = false, onNext }: {
  extractionId: string; exercise: RunnableExercise; onClose: () => void;
  onDone?: (exId: string, summary?: SessionSummary) => void; preview?: boolean; persist?: boolean;
  /** Offered when this one is finished (the student's exercise list) */
  onNext?: () => void;
}) {
  const { exercise: ex, scored } = exercise.interactive;
  const assist = useAssist();
  const [showPage, setShowPage] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const { items, skipped, paper } = useMemo(() => toPracticeItems(ex), [ex]);
  const readiness = useMemo(() => phoneReadiness(ex, scored), [ex, scored]);
  // A preview never resumes an earlier try
  const [previewRun] = useState(() => Math.random().toString(36).slice(2));
  const playable = scored && items.length > 0;
  const paperItems = playable ? skipped : [];
  const set: PracticeSet = useMemo(() => ({
    title: `Exercise ${exercise.number}`, band: 'B1', generatedAt: '',
    levels: [{ level: 'apply', label: 'Exercise', labelArabic: 'التمرين', items }],
  }), [items, exercise.number]);

  // LMP site: no tracking — the done flag stays on this device, and the host hears of it
  const report = (s?: SessionSummary) => {
    if (preview) return;   // the teacher's preview is never remembered
    try { storeFor(persist).setItem(prefix(persist) + doneKey(extractionId, exercise.id), '1'); } catch { /* private mode */ }
    onDone?.(exercise.id, s);
  };

  return (
    <div className={preview ? 'relative bg-slate-50 min-h-full' : 'fixed inset-0 z-50 bg-slate-50 overflow-y-auto'} role={preview ? undefined : 'dialog'} aria-label={`Exercise ${exercise.number}`}>
      <div className="sticky top-0 z-10 bg-indigo-600 text-white px-4 py-3 flex items-center gap-3">
        <PencilLine className="w-5 h-5 shrink-0" />
        <p className="font-semibold flex-1">Exercise {exercise.number}</p>
        {preview
          ? <span className="text-[10px] uppercase tracking-wider bg-white/20 rounded px-1.5 py-0.5">Preview</span>
          : <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-white/10"><X className="w-5 h-5" /></button>}
      </div>

      <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
        <div className="space-y-1">
          <p className="font-medium text-gray-900">{ex.instructions}</p>
          {assist && ex.instructionsArabic && <p dir="rtl" className="text-gray-700">{ex.instructionsArabic}</p>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {ex.media && <span className="px-2 py-1 rounded-full bg-sky-100 text-sky-800 inline-flex items-center gap-1"><Headphones className="w-3 h-3" />Your teacher plays the {ex.media.kind} for this</span>}
          {ex.needsPassage && <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-1"><BookOpen className="w-3 h-3" />You need the reading from the book</span>}
          {exercise.imageUrls.length > 0 && (
            <button onClick={() => setShowPage(v => !v)} className="px-2 py-1 rounded-full bg-white border border-gray-200 text-gray-700 inline-flex items-center gap-1">
              <ImageIcon className="w-3 h-3" />{showPage ? 'Hide the page' : 'See the page'}
            </button>
          )}
        </div>
        {/* The reading, from the lesson: the book stays closed */}
        {ex.passage?.text && (
          <details className="rounded-xl bg-white border border-gray-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-indigo-600" />The reading{ex.passage.title ? `: ${ex.passage.title}` : ''}</summary>
            <p className="mt-2 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">{ex.passage.text}</p>
          </details>
        )}
        {showPage && (
          <div className="space-y-2">
            {exercise.imageUrls.map((u, i) => <img key={u} src={u} alt={`Page ${i + 1}`} className="w-full rounded-lg border border-gray-200 bg-white" />)}
          </div>
        )}

        {playable ? (
          <>
            <p className="text-xs text-gray-500">{readinessShort(readiness)}{paperItems.length ? ' (below)' : ''}</p>
            <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
              <PracticeSession
                set={set}
                initialMode="standard"
                storageKey={preview ? `preview-${exercise.id}-${previewRun}` : `${prefix(persist)}exercise-${extractionId}-${exercise.id}`}
                storage={preview ? undefined : storeFor(persist)}
                skipIntros
                continuous
                canReview={false}
                resolveSlide={() => null}
                onOpenSlide={() => {}}
                onComplete={(s) => { setSummary(s); report(s); }}
              />
            </div>
          </>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
            {scored
              ? 'Do this exercise in your notebook — this kind isn’t on the phone yet.'
              : 'Your teacher hasn’t checked the answers yet. Do the exercise, then compare your answers in class.'}
          </div>
        )}

        {(!playable || paperItems.length > 0) && (
          <div className="rounded-xl bg-white border border-gray-200 p-3 space-y-2">
            {playable && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">On paper / with your teacher</p>}
            <StructuredView showAnswers={false} showInstructions={false}
              ex={playable ? paper : ex} />
          </div>
        )}

        <div className="pb-8">
          {preview ? (
            summary || !playable
              ? <button onClick={onClose} className="w-full py-2 text-sm text-indigo-700 underline">Try it again</button>
              : null
          ) : summary ? (
            <div className="space-y-2">
              {onNext && (
                <button onClick={onNext} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium">
                  Next exercise →
                </button>
              )}
              <button onClick={onClose} className={`w-full py-3 rounded-xl font-medium inline-flex items-center justify-center gap-2 ${onNext ? 'bg-white border border-gray-200 text-gray-700' : 'bg-indigo-600 text-white'}`}>
                <Check className="w-5 h-5" />Done — back
              </button>
            </div>
          ) : !playable ? (
            <button onClick={() => { report(); onClose(); }} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium inline-flex items-center justify-center gap-2">
              <Check className="w-5 h-5" />I’ve done it — back
            </button>
          ) : (
            <button onClick={onClose} className="w-full py-2 text-sm text-gray-500 underline">Close — I’ll finish later</button>
          )}
        </div>
      </div>
    </div>
  );
}
