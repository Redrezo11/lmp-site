import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle2, Circle, RotateCcw, Presentation, Layers, PencilLine, ClipboardCheck, FileText } from 'lucide-react';
import { useModule } from './useModule';
import { readProgress, restartModule } from '../lmp/progress';

const KIND_ICON: Record<string, typeof Presentation> = { presentation: Presentation, deck: Layers, exercises: PencilLine, session: ClipboardCheck, lesson: FileText };

/** A module's front page: its lessons, what has been done, warnings, restart */
export function ModulePage() {
  const { id = '' } = useParams();
  const state = useModule(id);
  const [, refresh] = useState(0);

  if (state.status === 'loading') return <p className="p-6 text-slate-500" role="status">Loading…</p>;
  if (state.status === 'error') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-600"><ArrowLeft className="w-4 h-4" />All lessons</Link>
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
          <p className="font-semibold flex items-center gap-2"><AlertTriangle className="w-5 h-5" />This module can't be played</p>
          <ul className="mt-2 list-disc pl-6 text-sm space-y-0.5">{state.errors.map((e, i) => <li key={i}><code className="break-all">{e}</code></li>)}</ul>
        </div>
      </div>
    );
  }

  const { manifest, warnings } = state.mod;
  const progress = readProgress(manifest.id);
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-600"><ArrowLeft className="w-4 h-4" />All lessons</Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{manifest.title}</h1>
        {manifest.description && <p className="text-slate-600">{manifest.description}</p>}
      </div>
      <ul className="space-y-2">
        {manifest.lessons.map(l => {
          const Icon = KIND_ICON[l.kind || 'lesson'] || FileText;
          const p = progress[l.id];
          const Done = p?.visited ? CheckCircle2 : Circle;
          return (
            <li key={l.id}>
              <Link to={`/m/${manifest.id}/${l.id}`} className="flex items-center gap-3 rounded-2xl bg-white border border-slate-200 px-4 py-3 hover:border-indigo-300">
                <Icon className="w-5 h-5 text-indigo-600 shrink-0" />
                <span className="flex-1 font-medium text-slate-900">{l.title}</span>
                <Done className={`w-5 h-5 ${p?.visited ? 'text-emerald-600' : 'text-slate-300'}`} aria-label={p?.visited ? 'opened before' : 'not opened yet'} />
              </Link>
            </li>
          );
        })}
      </ul>
      {warnings.length > 0 && (
        <details className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <summary className="cursor-pointer font-medium">{warnings.length} note{warnings.length === 1 ? '' : 's'} about this module (it still plays)</summary>
          <ul className="mt-2 list-disc pl-6 space-y-0.5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </details>
      )}
      <button onClick={() => { if (confirm('Start this module again? Your progress on this device is cleared.')) { restartModule(manifest.id); refresh(n => n + 1); } }}
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"><RotateCcw className="w-4 h-4" />Start again</button>
    </div>
  );
}
