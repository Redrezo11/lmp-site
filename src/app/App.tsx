import { Suspense } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Upload } from 'lucide-react';
import { Catalogue } from './Catalogue';
import { ModulePage } from './ModulePage';
import { ImportPage } from './ImportPage';
import { useModule } from './useModule';
import { LessonPlayer } from '../player/core/LessonPlayer';
import { componentFor, FULL_SCREEN_TYPES } from '../lmp/registry';

/**
 * The website shell (website-spec §3): catalogue, a module's lessons, the
 * lesson player and import. Hash routes, because GitHub Pages has no fallback
 * for deep links: #/  #/m/<id>  #/m/<id>/<lesson>  #/m/<id>/session  #/import
 */
export function App() {
  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 font-bold text-slate-900"><BookOpen className="w-5 h-5 text-indigo-600" />Lessons</Link>
            <nav className="ml-auto">
              <Link to="/import" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-indigo-700 hover:bg-indigo-50"><Upload className="w-4 h-4" />Import module</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">
          <Suspense fallback={<p className="p-6 text-slate-500" role="status">Loading…</p>}>
          <Routes>
            <Route path="/" element={<Catalogue />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/m/:id" element={<ModulePage />} />
            <Route path="/m/:id/session" element={<LessonRoute session />} />
            <Route path="/m/:id/:lessonId" element={<LessonRoute />} />
            <Route path="*" element={<p className="p-6 text-slate-600">Nothing here. <Link to="/" className="text-indigo-700 underline">Back to the lessons</Link></p>} />
          </Routes>
          </Suspense>
        </main>
      </div>
    </HashRouter>
  );
}

function LessonRoute({ session = false }: { session?: boolean }) {
  const params = useParams();
  const id = params.id || '';
  const navigate = useNavigate();
  const state = useModule(id);
  if (state.status === 'loading') return <p className="p-6 text-slate-500" role="status">Loading…</p>;
  if (state.status === 'error') return <ModulePage />;
  const mod = state.mod;
  // #/m/<id>/session: the module's student session, whatever its lesson is called (format sheet §11.6)
  const lessonId = session
    ? mod.manifest.lessons.find(l => mod.files[l.source]?.blocks.some(b => b.type === 'lf.student-session'))?.id || 'session'
    : params.lessonId || '';
  const ref = mod.manifest.lessons.find(l => l.id === lessonId);
  const blocks = ref ? mod.files[ref.source]?.blocks || [] : [];
  // A LessonForge lesson (one lf.* block) fills the screen, without the lesson frame
  if (blocks.length === 1 && FULL_SCREEN_TYPES.has(blocks[0].type)) {
    const Comp = componentFor(blocks[0].type);
    return <Comp key={`${id}/${lessonId}`} block={blocks[0]} resolve={mod.resolve} onAnswered={() => {}} mod={mod} lessonId={lessonId} />;
  }
  return <LessonPlayer mod={mod} lessonId={lessonId} onExit={() => navigate(`/m/${id}`)} />;
}
