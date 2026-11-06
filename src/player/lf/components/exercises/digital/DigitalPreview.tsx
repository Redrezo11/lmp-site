import React from 'react';
import { Headphones, BookOpen } from 'lucide-react';
import { DigitisedExercise, Part } from '../../../types/exerciseTemplates';
import { MarkedTextView } from '../../practice/MarkTextExercise';

/** One part, read-only: what the student sees, with the stored answer */
function PartView({ p, ex }: { p: Part; ex: DigitisedExercise }) {
  const ans = (a: React.ReactNode) => <span className="ml-1 text-emerald-700 font-medium">→ {a}</span>;
  switch (p.type) {
    case 'choice': return <div>{p.stem && <p>{p.stem}</p>}<p className="text-gray-600">{p.options.map((o, i) => <span key={i} className={`mr-2 ${o === p.answer ? 'font-semibold text-emerald-700' : ''}`}>({o})</span>)}</p></div>;
    case 'multi': return <div>{p.stem && <p>{p.stem}</p>}<ul className="text-gray-600">{p.options.map((o, i) => <li key={i} className={p.answers?.includes(o) ? 'font-semibold text-emerald-700' : ''}>☐ {o}</li>)}</ul></div>;
    case 'label': return <p>{p.text}{p.answer && ans(p.answer)}</p>;
    case 'sort': return <p>{p.text}{p.answer?.length ? ans(p.answer.join(', ')) : null}</p>;
    case 'match': return <p>{p.text}{p.answer && ans(p.answer)}</p>;
    case 'order': return <p className="text-gray-600">{p.pieces.join(' / ')}{p.answer?.length ? ans(p.answer.join(' ')) : null}</p>;
    case 'gap': return <p>{p.text.split(/(\{\{\d+\}\})/).map((t, i) => /\{\{\d+\}\}/.test(t)
      ? <span key={i} className="inline-block min-w-[3rem] border-b border-gray-500 mx-1 text-center text-emerald-700">{p.answers?.[Number(t.replace(/\D/g, '')) - 1]?.[0] || ' '}</span>
      : <span key={i}>{t}</span>)}{p.cues?.length ? <span className="text-gray-400"> ({p.cues.join(', ')})</span> : null}</p>;
    case 'select': return <MarkedTextView text={p.text} marks={ex.marks || []} answer={p.answer || []} />;
    case 'rewrite': return <p>{p.prompt}{p.answers?.length ? ans(p.answers[0]) : null}</p>;
    case 'text': return <p>{p.prompt}{p.answers?.length ? ans(p.answers[0]) : null}</p>;
    case 'writing': return <p>{p.prompt}{p.frame && <span className="text-gray-500"> — “{p.frame}”</span>}</p>;
    case 'self': return <p>☐ {p.statement}</p>;
    case 'info': return <p>{p.text}</p>;
    case 'evidence': return <p className="text-gray-500 text-xs">Which {p.kind}? {p.answer?.length ? ans(p.answer.join(', ')) : '____'}</p>;
    case 'free': return <p className="text-gray-500 text-xs">{p.prompt} {p.answer ? ans(p.answer) : '____'}</p>;
    case 'chart': return (
      <div className="overflow-x-auto">{p.title && <p className="font-medium mb-1">{p.title}</p>}<table className="text-xs border border-gray-200">
        {p.columns.length > 0 && <thead><tr>{p.columns.map((c, i) => <th key={i} className="border border-gray-200 px-2 py-1 bg-gray-50">{c}</th>)}</tr></thead>}
        <tbody>{p.rows.map((r, i) => <tr key={i}>{r.cells.map((c, j) => <td key={j} className="border border-gray-200 px-2 py-1">{c.given || (c.answers?.[0] ? <span className="text-emerald-700">{c.answers[0]}</span> : <span className="text-gray-300">____</span>)}</td>)}</tr>)}</tbody>
      </table></div>);
  }
}

/** A copy without answers — the worked example keeps its (printed) answer */
export function withoutAnswers(ex: DigitisedExercise): DigitisedExercise {
  const c: DigitisedExercise = JSON.parse(JSON.stringify(ex));
  c.items.forEach((it, i) => {
    if (c.example?.itemIndex === i) return;
    for (const p of it.parts as any[]) {
      delete p.answer; delete p.answers;
      if (p.type === 'chart') p.rows.forEach((r: any) => r.cells.forEach((cell: any) => { delete cell.answers; }));
    }
  });
  return c;
}

/** The whole exercise, read-only — works for every family. Students see it without answers. */
export function StructuredView({ ex: given, showAnswers = true, showInstructions = true }: { ex: DigitisedExercise; showAnswers?: boolean; showInstructions?: boolean }) {
  const ex = showAnswers ? given : withoutAnswers(given);
  return (
    <div className="space-y-3 text-sm text-gray-800">
      {showInstructions && <p className="font-medium">{ex.instructions}</p>}
      {showInstructions && ex.instructionsArabic && <p dir="rtl" className="text-gray-600">{ex.instructionsArabic}</p>}
      {(ex.media || ex.needsPassage || ex.passageRef) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {ex.media && <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 flex items-center gap-1"><Headphones className="w-3 h-3" />Needs {ex.media.kind}{ex.media.note ? `: ${ex.media.note}` : ''}</span>}
          {ex.needsPassage && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1"><BookOpen className="w-3 h-3" />Needs a reading that isn't in this lesson</span>}
          {ex.passageRef && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1"><BookOpen className="w-3 h-3" />Uses the lesson's reading ({ex.passageRef})</span>}
        </div>
      )}
      {[['Labels', ex.labels], ['Groups', ex.groups], ['Right-hand list', ex.rightOptions], ['Marks', ex.marks], ['Word bank', ex.bank?.items]].map(([k, v]) =>
        (v as string[] | undefined)?.length ? <p key={k as string} className="text-xs text-gray-600"><b>{k as string}:</b> {(v as string[]).join(' · ')}</p> : null)}
      <ol className="space-y-2">
        {ex.items.map((it, i) => (
          <li key={i} className={`rounded-lg border px-3 py-2 ${ex.example?.itemIndex === i ? 'border-dashed border-gray-300 bg-gray-50' : 'border-gray-200'}`}>
            <div className="flex gap-2">
              <span className="text-xs font-bold text-gray-400 w-6 shrink-0">{it.number || i + 1}</span>
              <div className="flex-1 space-y-1">{it.parts.map((p, j) => (
                <div key={j} className="flex gap-1.5">
                  {p.label && <span className="text-xs font-semibold text-gray-500 shrink-0 pt-0.5">{p.label}.</span>}
                  <div className="flex-1"><PartView p={p} ex={ex} /></div>
                </div>
              ))}</div>
              {ex.example?.itemIndex === i && <span className="text-[10px] text-gray-500 shrink-0">example</span>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
