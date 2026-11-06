import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Presentation, Layers, PencilLine, ClipboardCheck, FileText } from 'lucide-react';
import { loadCatalog, importedModules, Catalog, CatalogEntry } from '../lmp/load';

const KIND_ICON: Record<string, typeof Presentation> = { presentation: Presentation, deck: Layers, exercises: PencilLine, session: ClipboardCheck, lesson: FileText };
const LANG: Record<string, string> = { en: 'English', ar: 'العربية' };

/** The home page: every module on the site, plus any imported in this visit (website-spec §7.1) */
export function Catalogue() {
  const [cat, setCat] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { loadCatalog().then(setCat).catch(e => setError(e.message)); }, []);

  const imported: CatalogEntry[] = importedModules().map(m => ({
    id: m.manifest.id, title: m.manifest.title, description: m.manifest.description, language: m.manifest.language,
    languages: m.manifest.languages, tags: m.manifest.tags, path: '', lessons: m.manifest.lessons,
    thumbnail: m.manifest.thumbnail ? m.resolve(m.manifest.thumbnail) : undefined, meta: { imported: true },
  }));
  const all = [...imported, ...(cat?.modules || []).filter(m => !imported.some(i => i.id === m.id))];
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return all;
    return all.filter(m => [m.title, m.description, ...(m.tags || []), String(m.meta?.courseKey || '')].some(s => (s || '').toLowerCase().includes(t)));
  }, [all, q]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Lessons</h1>
          <p className="text-sm text-slate-600">Choose a lesson to start. Everything plays in your browser.</p>
        </div>
        <label className="relative sm:w-72">
          <span className="sr-only">Search lessons</span>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-white" />
        </label>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</p>}
      {!cat && !error && <p className="text-slate-500" role="status">Loading…</p>}
      {cat && shown.length === 0 && <p className="text-slate-600">No lessons{q ? ' match your search' : ' yet'}.</p>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(m => (
          <li key={m.id} className="rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col">
            <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
              {m.thumbnail
                ? <img src={m.thumbnail} alt="" className="w-full h-full object-cover object-top" loading="lazy" />
                : <FileText className="w-10 h-10 text-slate-300" />}
            </div>
            <div className="p-4 flex-1 flex flex-col gap-2">
              <h2 className="font-semibold text-slate-900 leading-snug">{m.title}</h2>
              {m.description && <p className="text-sm text-slate-600 line-clamp-2">{m.description}</p>}
              <div className="flex flex-wrap gap-1.5 text-xs">
                {(m.languages || [m.language]).map(l => <span key={l} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{LANG[l] || l}</span>)}
                {m.meta?.imported ? <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">imported</span> : null}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                {m.lessons.map(l => { const Icon = KIND_ICON[l.kind || 'lesson'] || FileText; return <span key={l.id} className="inline-flex items-center gap-1"><Icon className="w-3.5 h-3.5" />{l.title}</span>; })}
              </div>
              <Link to={`/m/${m.id}`} className="mt-auto text-center px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Launch</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
