import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X, Info, Lightbulb, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import type { Block, CaptionLine, LoadedModule } from '../../lmp/types';
import { sameAnswer, stableShuffle } from '../../lmp/marking';

/**
 * The generic (LMP core) block types, format sheet §4.1. One component each.
 * Marked blocks call onAnswered(true|false) once, on the first full attempt;
 * free blocks call onAnswered(null) when the student has seen or written them.
 */

export interface BlockProps<B = any> {
  block: B;
  resolve: (path: string) => string;
  onAnswered: (correct: boolean | null) => void;
  /** The whole module and this lesson: the LessonForge blocks (lf.*) follow refs and keep their own progress */
  mod?: LoadedModule;
  lessonId?: string;
}

// ── Shared pieces ──

const card = 'rounded-2xl bg-white border border-slate-200 p-4 sm:p-5';
const btn = 'px-4 py-2.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed';

function Feedback({ correct, text, extra }: { correct: boolean; text?: string; extra?: React.ReactNode }) {
  return (
    <div role="status" className={`mt-3 rounded-xl border p-3 text-sm ${correct ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
      <p className="font-semibold flex items-center gap-1.5">{correct ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}{correct ? 'Correct' : 'Not quite'}</p>
      {text && <p className="mt-1">{text}</p>}
      {extra}
    </div>
  );
}

/** A minimal, safe Markdown: paragraphs, #/##/### headings, - lists, **bold**, *italic*, [links](https://…) */
function MarkdownLite({ text }: { text: string }) {
  const inline = (s: string, k: number) => {
    const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:[^)]+\))/g);
    return <span key={k}>{parts.map((p, i) => {
      if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
      if (/^\*[^*]+\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
      const m = /^\[([^\]]+)\]\((https?:[^)]+)\)$/.exec(p);
      if (m) return <a key={i} href={m[2]} target="_blank" rel="noreferrer" className="text-indigo-700 underline">{m[1]}</a>;
      return p;
    })}</span>;
  };
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return <>{blocks.map((b, i) => {
    const lines = b.split('\n');
    if (lines.every(l => /^\s*[-*] /.test(l))) return <ul key={i} className="list-disc pl-6 space-y-1">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*] /, ''), j)}</li>)}</ul>;
    const h = /^(#{1,3}) (.*)$/.exec(b);
    if (h) { const Tag = (['h2', 'h3', 'h4'] as const)[h[1].length - 1]; return <Tag key={i} className="font-bold text-slate-900 mt-2">{inline(h[2], 0)}</Tag>; }
    return <p key={i}>{lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l, j)}</span>)}</p>;
  })}</>;
}

/** Only these tags survive in an html text block; everything else becomes its text */
const SAFE = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'B', 'I', 'A', 'BR', 'SPAN']);
function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const clean = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) return (n.textContent || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
    if (n.nodeType !== Node.ELEMENT_NODE) return '';
    const el = n as Element;
    const inner = [...el.childNodes].map(clean).join('');
    if (!SAFE.has(el.tagName)) return inner;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') return '<br>';
    let attrs = '';
    if (tag === 'a') { const href = el.getAttribute('href') || ''; if (/^https?:/i.test(href)) attrs = ` href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noreferrer"`; }
    const dir = el.getAttribute('dir'); if (dir === 'rtl' || dir === 'ltr') attrs += ` dir="${dir}"`;
    return `<${tag}${attrs}>${inner}</${tag}>`;
  };
  return [...doc.body.childNodes].map(clean).join('');
}

// ── Content ──

export function TextBlock({ block, onAnswered }: BlockProps) {
  useEffect(() => { onAnswered(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`${card} prose-like space-y-3 text-slate-800 leading-relaxed [&_a]:text-indigo-700 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold`}>
      {block.html ? <div dangerouslySetInnerHTML={{ __html: sanitize(block.html) }} /> : <MarkdownLite text={block.markdown || ''} />}
    </div>
  );
}

export function ImageBlock({ block, resolve, onAnswered }: BlockProps) {
  useEffect(() => { onAnswered(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <figure className={card}>
      <img src={resolve(block.src)} alt={block.alt || ''} className="w-full h-auto rounded-lg bg-slate-100" loading="lazy" />
      {block.caption && <figcaption className="mt-2 text-sm text-slate-600">{block.caption}</figcaption>}
    </figure>
  );
}

function useCaption(ref: React.RefObject<HTMLMediaElement | null>, lines: CaptionLine[] | undefined) {
  const [text, setText] = useState('');
  useEffect(() => {
    const el = ref.current;
    if (!el || !lines?.length) return;
    const tick = () => { const t = el.currentTime; setText(lines.find(l => l.start <= t && t < l.end)?.text || ''); };
    el.addEventListener('timeupdate', tick);
    el.addEventListener('seeked', tick);
    return () => { el.removeEventListener('timeupdate', tick); el.removeEventListener('seeked', tick); };
  }, [ref, lines]);
  return text;
}

export function AudioBlock({ block, resolve, onAnswered }: BlockProps) {
  const ref = useRef<HTMLAudioElement>(null);
  const caption = useCaption(ref, block.captions);
  useEffect(() => { onAnswered(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rtl = /[؀-ۿ]/.test(block.transcript || block.captions?.[0]?.text || '');
  return (
    <div className={`${card} space-y-3`}>
      {block.title && <p className="font-semibold text-slate-900">{block.title}</p>}
      <audio ref={ref} controls preload="metadata" src={resolve(block.src)} className="w-full" />
      {block.captions?.length ? (
        <p dir={rtl ? 'rtl' : 'ltr'} aria-live="polite" className="min-h-[3rem] rounded-lg bg-slate-900 text-white px-3 py-2 text-base">{caption || ' '}</p>
      ) : null}
      {block.transcript && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-indigo-700">Transcript</summary>
          <p dir={rtl ? 'rtl' : 'ltr'} className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{block.transcript}</p>
        </details>
      )}
    </div>
  );
}

export function VideoBlock({ block, resolve, onAnswered }: BlockProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const caption = useCaption(ref, block.captions);
  useEffect(() => { onAnswered(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const src = block.src ? resolve(block.src) : block.url;
  if (!src) return <div className={card}><p className="text-sm text-slate-600">This video has no source.</p></div>;
  return (
    <div className={`${card} space-y-2`}>
      <video ref={ref} controls preload="metadata" src={src} poster={block.poster ? resolve(block.poster) : undefined} className="w-full rounded-lg bg-black" />
      {block.captions?.length ? <p aria-live="polite" className="min-h-[2.5rem] rounded-lg bg-slate-900 text-white px-3 py-2">{caption || ' '}</p> : null}
    </div>
  );
}

export function InfoBlock({ block, onAnswered }: BlockProps) {
  useEffect(() => { onAnswered(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const tone = block.tone || 'info';
  const Icon = tone === 'tip' ? Lightbulb : tone === 'warning' ? AlertTriangle : Info;
  const color = tone === 'tip' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-sky-200 bg-sky-50 text-sky-900';
  return <div className={`rounded-2xl border p-4 flex gap-3 ${color}`}><Icon className="w-5 h-5 shrink-0 mt-0.5" /><p className="whitespace-pre-wrap">{block.text}</p></div>;
}

export function SummaryBlock({ block, onAnswered }: BlockProps) {
  useEffect(() => { onAnswered(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={card}>
      <p className="font-semibold text-slate-900 mb-2">{block.title || 'Summary'}</p>
      <ul className="list-disc pl-6 space-y-1 text-slate-800">{(block.points || []).map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>
    </div>
  );
}

// ── Questions ──

function useOnce(onAnswered: (c: boolean | null) => void) {
  const sent = useRef(false);
  return (c: boolean | null) => { if (!sent.current) { sent.current = true; onAnswered(c); } };
}

export function MultipleChoiceBlock({ block, onAnswered }: BlockProps) {
  const answer = useOnce(onAnswered);
  const options = useMemo(() => (block.shuffle ? stableShuffle(block.options, block.id + block.question) : block.options), [block]);
  const [pick, setPick] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const right = !!pick && block.correct.includes(pick);
  return (
    <fieldset className={card}>
      <legend className="font-semibold text-slate-900 mb-3 float-left w-full">{block.question}</legend>
      <div className="space-y-2 clear-both">
        {options.map((o: any) => (
          <label key={o.id} className={`flex items-center gap-3 rounded-xl border px-3 py-3 cursor-pointer ${checked && block.correct.includes(o.id) ? 'border-emerald-400 bg-emerald-50' : checked && pick === o.id ? 'border-amber-400 bg-amber-50' : pick === o.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
            <input type="radio" name={block.id} value={o.id} checked={pick === o.id} disabled={checked} onChange={() => setPick(o.id)} className="w-4 h-4" />
            <span>{o.text}</span>
          </label>
        ))}
      </div>
      {!checked && <button className={`${btn} mt-3 w-full`} disabled={!pick} onClick={() => { setChecked(true); answer(right); }}>Check</button>}
      {checked && <Feedback correct={right} text={(right ? block.feedback?.correct : block.feedback?.incorrect) || block.explanation} />}
    </fieldset>
  );
}

export function MultipleResponseBlock({ block, onAnswered }: BlockProps) {
  const answer = useOnce(onAnswered);
  const [picks, setPicks] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const rule = block.rule || 'all';
  const right = rule === 'any'
    ? picks.length > 0 && picks.every(p => block.correct.includes(p))
    : picks.length === block.correct.length && picks.every(p => block.correct.includes(p));
  const toggle = (id: string) => setPicks(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  return (
    <fieldset className={card}>
      <legend className="font-semibold text-slate-900 mb-1 float-left w-full">{block.question}</legend>
      <p className="text-xs text-slate-500 mb-3 clear-both">Choose {rule === 'any' ? 'one or more' : 'all that apply'}.</p>
      <div className="space-y-2">
        {block.options.map((o: any) => (
          <label key={o.id} className={`flex items-center gap-3 rounded-xl border px-3 py-3 cursor-pointer ${checked && block.correct.includes(o.id) ? 'border-emerald-400 bg-emerald-50' : checked && picks.includes(o.id) ? 'border-amber-400 bg-amber-50' : picks.includes(o.id) ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
            <input type="checkbox" checked={picks.includes(o.id)} disabled={checked} onChange={() => toggle(o.id)} className="w-4 h-4" />
            <span>{o.text}</span>
          </label>
        ))}
      </div>
      {!checked && <button className={`${btn} mt-3 w-full`} disabled={!picks.length} onClick={() => { setChecked(true); answer(right); }}>Check</button>}
      {checked && <Feedback correct={right} text={right ? block.feedback?.correct : block.feedback?.incorrect} />}
    </fieldset>
  );
}

export function TrueFalseBlock({ block, onAnswered }: BlockProps) {
  const answer = useOnce(onAnswered);
  const [pick, setPick] = useState<boolean | null>(null);
  const done = pick !== null;
  return (
    <div className={card}>
      <p className="font-semibold text-slate-900 mb-3">{block.statement}</p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="True or false">
        {[true, false].map(v => (
          <button key={String(v)} disabled={done} onClick={() => { setPick(v); answer(v === block.correct); }}
            className={`py-3 rounded-xl border font-semibold ${done && v === block.correct ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : done && v === pick ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 hover:bg-slate-50'}`}>
            {v ? 'True' : 'False'}
          </button>
        ))}
      </div>
      {done && <Feedback correct={pick === block.correct} text={pick === block.correct ? block.feedback?.correct : block.feedback?.incorrect} />}
    </div>
  );
}

export function FillBlankBlock({ block, onAnswered }: BlockProps) {
  const answer = useOnce(onAnswered);
  const parts = String(block.text).split(/(\{\{\d+\}\})/);
  const blanks = parts.filter(p => /^\{\{\d+\}\}$/.test(p)).map(p => Number(p.replace(/\D/g, '')) - 1);
  const [values, setValues] = useState<string[]>(() => blanks.map(() => ''));
  const [checked, setChecked] = useState(false);
  const ok = (k: number) => sameAnswer(values[k] || '', block.answers?.[blanks[k]] || [], !!block.caseSensitive);
  const right = blanks.every((_, k) => ok(k));
  let k = -1;
  return (
    <div className={card}>
      <p className="leading-[2.6rem] text-slate-900">
        {parts.map((p, i) => {
          if (!/^\{\{\d+\}\}$/.test(p)) return <span key={i}>{p}</span>;
          const idx = ++k;
          return (
            <input key={i} aria-label={`Blank ${idx + 1}`} value={values[idx]} disabled={checked}
              onChange={e => setValues(v => v.map((x, j) => (j === idx ? e.target.value : x)))}
              className={`mx-1 w-32 max-w-[40vw] rounded-lg border px-2 py-1 text-base ${checked ? (ok(idx) ? 'border-emerald-400 bg-emerald-50' : 'border-amber-400 bg-amber-50') : 'border-slate-300'}`} />
          );
        })}
      </p>
      {!checked && <button className={`${btn} mt-3 w-full`} disabled={values.some(v => !v.trim())} onClick={() => { setChecked(true); answer(right); }}>Check</button>}
      {checked && <Feedback correct={right} extra={right ? undefined : <p className="mt-1">Answer{blanks.length > 1 ? 's' : ''}: <b>{blanks.map(b => block.answers?.[b]?.[0]).join(' · ')}</b></p>} />}
    </div>
  );
}

export function MatchingBlock({ block, onAnswered }: BlockProps) {
  const answer = useOnce(onAnswered);
  const rights = useMemo(() => stableShuffle<string>(block.pairs.map((p: any) => String(p.right)), block.id), [block]);
  const [values, setValues] = useState<string[]>(() => block.pairs.map(() => ''));
  const [checked, setChecked] = useState(false);
  const right = block.pairs.every((p: any, i: number) => values[i] === p.right);
  return (
    <div className={`${card} space-y-2`}>
      <p className="text-sm text-slate-600">Match each item on the left with one on the right.</p>
      {block.pairs.map((p: any, i: number) => (
        <label key={i} className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="sm:w-1/2 font-medium text-slate-900">{p.left}</span>
          <select value={values[i]} disabled={checked} onChange={e => setValues(v => v.map((x, j) => (j === i ? e.target.value : x)))}
            className={`sm:w-1/2 rounded-lg border px-2 py-2 bg-white ${checked ? (values[i] === p.right ? 'border-emerald-400' : 'border-amber-400') : 'border-slate-300'}`}>
            <option value="">Choose…</option>
            {rights.map((r: string) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      ))}
      {!checked && <button className={`${btn} mt-2 w-full`} disabled={values.some(v => !v)} onClick={() => { setChecked(true); answer(right); }}>Check</button>}
      {checked && <Feedback correct={right} extra={right ? undefined : <ul className="mt-1 list-disc pl-5">{block.pairs.map((p: any, i: number) => <li key={i}>{p.left} → <b>{p.right}</b></li>)}</ul>} />}
    </div>
  );
}

export function OrderingBlock({ block, onAnswered }: BlockProps) {
  const answer = useOnce(onAnswered);
  const start = useMemo(() => {
    const s = block.shuffle === false ? [...block.items] : stableShuffle(block.items, block.id);
    // Never start already solved
    return s.join('\u0001') === block.items.join('\u0001') && s.length > 1 ? [...s.slice(1), s[0]] : s;
  }, [block]);
  const [order, setOrder] = useState<string[]>(start);
  const [checked, setChecked] = useState(false);
  const right = order.join('\u0001') === block.items.join('\u0001');
  const move = (i: number, d: number) => setOrder(o => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n; });
  return (
    <div className={card}>
      <p className="text-sm text-slate-600 mb-2">Put these in the right order.</p>
      <ol className="space-y-2">
        {order.map((it, i) => (
          <li key={it} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${checked ? (block.items[i] === it ? 'border-emerald-400 bg-emerald-50' : 'border-amber-400 bg-amber-50') : 'border-slate-200'}`}>
            <span className="w-6 text-sm font-semibold text-slate-500">{i + 1}.</span>
            <span className="flex-1">{it}</span>
            <button aria-label={`Move "${it}" up`} disabled={checked || i === 0} onClick={() => move(i, -1)} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
            <button aria-label={`Move "${it}" down`} disabled={checked || i === order.length - 1} onClick={() => move(i, 1)} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
          </li>
        ))}
      </ol>
      {!checked && <button className={`${btn} mt-3 w-full`} onClick={() => { setChecked(true); answer(right); }}>Check</button>}
      {checked && <Feedback correct={right} extra={right ? undefined : <ol className="mt-1 list-decimal pl-5">{block.items.map((x: string) => <li key={x}>{x}</li>)}</ol>} />}
    </div>
  );
}

export function ShortAnswerBlock({ block, onAnswered }: BlockProps) {
  const answer = useOnce(onAnswered);
  const mode: 'auto' | 'compare' | 'free' = block.mode || (block.answers?.length ? 'compare' : 'free');
  const [value, setValue] = useState('');
  const [state, setState] = useState<'writing' | 'right' | 'wrong' | 'compare' | 'free'>('writing');
  const check = () => {
    if (mode === 'free') { setState('free'); answer(null); return; }
    const exact = sameAnswer(value, block.answers || []);
    if (exact) { setState('right'); answer(true); return; }
    if (mode === 'auto') { setState('wrong'); answer(false); return; }
    setState('compare');
  };
  return (
    <div className={card}>
      <label className="block">
        <span className="font-semibold text-slate-900">{block.prompt}</span>
        <textarea value={value} onChange={e => setValue(e.target.value)} disabled={state !== 'writing'} rows={2}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base" placeholder="Write your answer…" />
      </label>
      {state === 'writing' && <button className={`${btn} mt-2 w-full`} disabled={!value.trim()} onClick={check}>{mode === 'free' ? 'Done' : 'Check'}</button>}
      {(state === 'right' || state === 'wrong') && <Feedback correct={state === 'right'} extra={state === 'wrong' ? <p className="mt-1">Answer: <b>{block.answers?.[0]}</b></p> : undefined} />}
      {state === 'free' && <p role="status" className="mt-3 text-sm text-slate-600">Saved for you. Nothing is marked.</p>}
      {state === 'compare' && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">The model answer</p>
          <p className="font-semibold text-slate-900">{block.answers?.[0]}</p>
          <p className="text-sm text-slate-600">Does yours say the same?</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="py-2.5 rounded-xl font-semibold text-white bg-emerald-600" onClick={() => { setState('right'); answer(true); }}>Mine says the same</button>
            <button className="py-2.5 rounded-xl font-semibold text-slate-700 bg-slate-200" onClick={() => { setState('wrong'); answer(false); }}>Mine is different</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A block this player doesn't know (format sheet §5.3) */
export function UnknownBlock({ block, onAnswered }: BlockProps<Block>) {
  useEffect(() => { onAnswered(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
      This part needs a player that understands <code className="font-mono">{block.type}</code>.
    </div>
  );
}
