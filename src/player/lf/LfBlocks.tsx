import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { BlockProps } from '../core/blocks';
import { PresentationViewer } from './components/present/PresentationViewer';
import { LessonReplay } from './components/present/mobile/LessonReplay';
import { AssessSession, SessionHost, SessionMemory } from './pages/AssessPage';
import { assessmentPayload, lessonOf, replayPayload, sessionUrl, viewerData } from './fromModule';
import { markDone, readLfMemory, setLessonScore, updateLfMemory, visitLesson } from '../../lmp/progress';

/**
 * The LessonForge blocks (profile lf/1, website-spec §5.2): thin hosts around
 * the vendored components. Each fills the screen; the LessonForge code does
 * the playing, timing, captions and marking.
 */

/** Phone layout: ≤ 768 px wide, or `?phone=1` (in the page's query or the hash route's) */
export function usePhoneLayout(): boolean {
  const forced = () => /[?&]phone=1\b/.test(window.location.search) || /[?&]phone=1\b/.test(window.location.hash);
  const query = '(max-width: 768px)';
  const get = () => forced() || window.matchMedia(query).matches;
  const [phone, setPhone] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setPhone(get());
    mq.addEventListener('change', on);
    window.addEventListener('hashchange', on);
    return () => { mq.removeEventListener('change', on); window.removeEventListener('hashchange', on); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return phone;
}

function useModuleBits({ mod, lessonId }: BlockProps) {
  const navigate = useNavigate();
  if (!mod || !lessonId) throw new Error('LessonForge blocks need the module (BlockProps.mod)');
  useEffect(() => { visitLesson(mod.manifest.id, lessonId); }, [mod.manifest.id, lessonId]);
  return { mod, lessonId, navigate, back: () => navigate(`/m/${mod.manifest.id}`) };
}

/** lf.presentation, lf.deck and lf.exercises: the projector on desktop, the phone player on phones */
export function LfViewer(props: BlockProps) {
  const { mod, lessonId, navigate, back } = useModuleBits(props);
  const phone = usePhoneLayout();
  const data = useMemo(() => viewerData(mod, props.block), [mod, props.block]);
  const moduleId = mod.manifest.id;
  const session = data.sessionRef ? sessionUrl(moduleId) : undefined;
  const sessionLesson = lessonOf(mod, data.sessionRef);

  // Warm the cache with every picture, so Play all never shows a blank frame (as LessonForge)
  useEffect(() => { for (const u of data.pictures) { const img = new Image(); img.src = u; } }, [data.pictures]);

  if (phone) {
    return (
      <LessonReplay
        extractionId={moduleId}
        data={replayPayload(data)}
        persist
        onBack={back}
        onReachedEnd={() => markDone(moduleId, lessonId, props.block.id)}
        endAction={sessionLesson ? (
          <button onClick={(e) => { e.stopPropagation(); navigate(`/m/${moduleId}/session`); }}
            className="px-3 py-1.5 rounded-full bg-indigo-500 text-white text-sm font-semibold active:bg-indigo-600">
            Student session →
          </button>
        ) : undefined}
      />
    );
  }

  return (
    <>
      <PresentationViewer
        slides={data.slides}
        slidesAr={data.slidesAr}
        renderConfig={data.renderConfig}
        slideAudio={data.slideAudio}
        slideAudioAr={data.slideAudioAr}
        exercises={data.exercises}
        phoneExerciseIds={data.phoneExerciseIds}
        sessionUrl={session}
        narrationCaptions
      />
      {/* LMP site: the way back to the module (the projector page had none) */}
      <button onClick={back} aria-label="Back to the module" title="Back to the module"
        className="fixed top-4 right-4 z-30 w-10 h-10 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
        <ArrowLeft className="w-5 h-5" />
      </button>
    </>
  );
}

/** lf.student-session: the session page, the phone layout centred at 480 px on desktop (website-spec §9) */
export function LfSession(props: BlockProps) {
  const { mod, lessonId, navigate, back } = useModuleBits(props);
  const moduleId = mod.manifest.id;
  const b = props.block as any;
  const replayLesson = lessonOf(mod, b.replayRef);
  const host: SessionHost = useMemo(() => ({
    data: assessmentPayload(mod, props.block),
    readMemory: () => readLfMemory<SessionMemory & Record<string, unknown>>(moduleId, lessonId),
    updateMemory: (patch) => {
      updateLfMemory<SessionMemory & Record<string, unknown>>(moduleId, lessonId, m => patch(m) as SessionMemory & Record<string, unknown>);
      const s = readLfMemory<SessionMemory & Record<string, unknown>>(moduleId, lessonId).session;
      if (s) setLessonScore(moduleId, lessonId, props.block.id, s.total > 0 ? { correct: s.correct, total: s.total } : null);
    },
    onReplay: replayLesson ? () => navigate(`/m/${moduleId}/${replayLesson}`) : undefined,
    onBack: back,
  }), [mod, props.block, moduleId, lessonId, replayLesson]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto bg-slate-200">
      <div className="max-w-[480px] mx-auto min-h-full bg-slate-50 shadow-sm">
        <AssessSession extractionId={moduleId} host={host} />
      </div>
    </div>
  );
}
