import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, Trophy } from 'lucide-react';
import type { LoadedModule, LessonFile } from '../../lmp/types';
import { MARKED_TYPES } from '../../lmp/types';
import { componentFor } from '../../lmp/registry';
import { markBlock, visitLesson } from '../../lmp/progress';

/**
 * One lesson: its blocks one screen at a time, previous / next, a progress bar,
 * and a completion screen with the score of the marked blocks (format sheet
 * §4.2). Progress is kept in this browser only.
 */
export function LessonPlayer({ mod, lessonId, onExit }: { mod: LoadedModule; lessonId: string; onExit: () => void }) {
  const ref = mod.manifest.lessons.find(l => l.id === lessonId);
  const file: LessonFile | undefined = ref ? mod.files[ref.source] : undefined;
  const blocks = file?.blocks || [];
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, boolean | null>>({});
  const [finished, setFinished] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => { visitLesson(mod.manifest.id, lessonId); }, [mod.manifest.id, lessonId]);

  const block = blocks[index];
  const answered = useCallback((correct: boolean | null) => {
    if (!block) return;
    setResults(r => (block.id in r ? r : { ...r, [block.id]: correct }));
    markBlock(mod.manifest.id, lessonId, block.id, correct);
  }, [block, mod.manifest.id, lessonId]);

  const marked = useMemo(() => blocks.filter(b => MARKED_TYPES.has(b.type)), [blocks]);
  const right = marked.filter(b => results[b.id] === true).length;
  const isMarked = !!block && MARKED_TYPES.has(block.type);
  const canGoOn = !isMarked || (block && block.id in results);

  if (!ref || !file) return <p className="p-6 text-red-700">This lesson isn't in the module.</p>;

  const restart = () => { setResults({}); setIndex(0); setFinished(false); setRun(n => n + 1); };
  const Comp = block ? componentFor(block.type) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onExit} className="p-2 -ml-2 rounded-lg hover:bg-slate-200" aria-label="Back to the module"><ArrowLeft className="w-5 h-5" /></button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 truncate">{mod.manifest.title}</p>
          <h1 className="font-bold text-slate-900 truncate">{file.title || ref.title}</h1>
        </div>
        {!finished && blocks.length > 1 && <p className="text-xs text-slate-500 shrink-0" aria-live="polite">{index + 1} / {blocks.length}</p>}
      </div>
      {blocks.length > 1 && (
        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={blocks.length} aria-valuenow={finished ? blocks.length : index}>
          <div className="h-full bg-indigo-600 transition-all" style={{ width: `${((finished ? blocks.length : index) / blocks.length) * 100}%` }} />
        </div>
      )}

      {finished ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-6 text-center space-y-3">
          <Trophy className="w-10 h-10 mx-auto text-amber-500" />
          <p className="text-lg font-bold text-slate-900">Lesson finished</p>
          {marked.length > 0 && <p className="text-slate-700">{right} of {marked.length} right on the first try</p>}
          <div className="flex justify-center gap-2 pt-2">
            <button onClick={restart} className="px-4 py-2 rounded-xl border border-slate-300 font-medium inline-flex items-center gap-2"><RotateCcw className="w-4 h-4" />Again</button>
            <button onClick={onExit} className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold">Back to the module</button>
          </div>
        </div>
      ) : block && Comp ? (
        <>
          {block.title && !['summary', 'audio'].includes(block.type) && !block.type.startsWith('lf.') && <h2 className="font-semibold text-slate-800">{block.title}</h2>}
          <Comp key={`${run}-${block.id}`} block={block} resolve={mod.resolve} onAnswered={answered} mod={mod} lessonId={lessonId} />
          <div className="flex gap-2">
            <button onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0}
              className="px-4 py-3 rounded-xl border border-slate-300 font-medium disabled:opacity-40 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Back</button>
            <button onClick={() => (index + 1 < blocks.length ? setIndex(index + 1) : setFinished(true))} disabled={!canGoOn}
              className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-semibold disabled:bg-slate-300 inline-flex items-center justify-center gap-1">
              {index + 1 < blocks.length ? <>Next<ArrowRight className="w-4 h-4" /></> : 'Finish'}
            </button>
          </div>
          {isMarked && !canGoOn && <p className="text-xs text-slate-500 text-center">Answer to go on.</p>}
        </>
      ) : (
        <p className="text-slate-600">This lesson is empty.</p>
      )}
    </div>
  );
}
