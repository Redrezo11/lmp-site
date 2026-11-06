import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, ListChecks, PenLine, PlayCircle, PencilLine, CheckCircle2, ChevronLeft } from 'lucide-react';
import { ExerciseRunner, isExerciseDone } from '../components/exercises/digital/ExerciseRunner';
import { phoneReadiness, readinessShort } from '../components/exercises/digital/toPracticeItems';
import { AssistToggle } from '../components/practice/AssistToggle';
import { SlidePreview } from '../types/lesson';
import { SlideReviewOverlay } from '../components/assess/SlideReviewOverlay';
import { resolveSlideIndex } from '../utils/slideLink';
import { PracticeSession, SessionSummary } from '../components/practice/PracticeSession';
import { LanguageChoice } from '../components/practice/AssistToggle';
import { setHasAssist, LangChoice } from '../utils/assist';
import { setAssist } from '../hooks/useAssist';
import { cleanPracticeSet } from './PracticePage';
import { PracticeSet, PracticeLevel, PracticeItem } from '../types/practice';
import type { AssessmentQuestion } from '../types/lesson';
import type { StudentInteractive } from '../types/exerciseTemplates';
import type { SlideRenderConfig } from '../types/slideRender';

// 'choice' = everything tappable (default preference);
// 'typed' = challenge: quiz gap-fills are typed + the extra writing level
type QuizMode = 'choice' | 'typed';

/**
 * LMP site: what LessonForge's /assessment endpoint returned, built from the
 * module's lf.student-session block and the blocks it refers to (website-spec §9).
 */
export interface AssessmentPayload {
  title: string;
  questions: AssessmentQuestion[];
  slides: SlidePreview[];
  slidesAr: SlidePreview[];
  renderConfig: SlideRenderConfig | null;
  /** The lesson is narrated, so a student can watch it again */
  hasReplay?: boolean;
  /** Total narration length, rounded to whole minutes (at least 1) */
  replayMinutes?: number;
  practice?: PracticeSet | null;
  /** The book's exercises students can do on the phone */
  exercises?: StudentExercise[];
}

/** A phone-ready exercise as the student pages receive it */
export interface StudentExercise {
  id: string;
  /** Its number in the lesson's exercise chain */
  number: number;
  imageUrls: string[];
  interactive: StudentInteractive;
}

/** What this device remembers for the session (LessonForge's StudentProgress, kept in the site's record) */
export interface SessionMemory {
  lang?: LangChoice;
  mode?: QuizMode;
  session?: { at: string; correct: number; total: number; quizCorrect?: number; quizTotal?: number };
}

/**
 * LMP site: the host gives the payload, this device's memory, and where
 * "Watch the lesson" and "back" go. Replaces the extraction id + API fetch.
 */
export interface SessionHost {
  data: AssessmentPayload;
  readMemory: () => SessionMemory;
  updateMemory: (patch: (m: SessionMemory) => SessionMemory) => void;
  onReplay?: () => void;
  onBack?: () => void;
}

const now = () => new Date().toISOString();

/**
 * Student-facing mobile session, opened by scanning the QR from the presenter.
 *
 * The lesson's quiz and its extra practice are ONE continuous stream: the quiz
 * questions are the first level of the practice sequencer, so there is no
 * Submit button, no mid-way score and no finish line until everything is done.
 * Anonymous, client-side grading, immediate bilingual feedback.
 *
 * LMP site: always LessonForge's "student at home" storage (localStorage, `lf-`
 * keys), with the anonymous page's layout (replay card, exercise list); nothing
 * is tracked.
 */
export function AssessSession({ extractionId, host }: { extractionId: string; host: SessionHost }) {
  const data = host.data;
  const title = data.title;
  const questions = data.questions || [];
  const practice = useMemo(() => cleanPracticeSet(data.practice), [data.practice]);
  const slides = data.slides || [];
  const slidesAr = data.slidesAr || [];
  const renderConfig = slides.length > 0 ? data.renderConfig : null;
  const hasReplay = !!data.hasReplay && !!host.onReplay;
  const exercises = data.exercises || [];
  const [doing, setDoing] = useState<StudentExercise | null>(null);
  const [doneIds, setDoneIds] = useState<string[]>(() => exercises.filter(e => isExerciseDone(extractionId, e.id, true)).map(e => e.id));
  const [, setSessionDone] = useState(false);
  // Opened from an exercise slide's QR code: open that exercise straight away
  const [searchParams] = useSearchParams();
  const openedFromLinkRef = useRef(false);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<QuizMode | null>(() => host.readMemory().mode ?? null);
  const [lang, setLang] = useState<LangChoice | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const wakeLockRef = useRef<any>(null);

  const storage = localStorage;
  const sessionKey = `lf-session-${extractionId}`;

  useEffect(() => {
    const wanted = searchParams.get('exercise');
    const hit = wanted && exercises.find(e => e.id === wanted);
    if (hit && !openedFromLinkRef.current) { openedFromLinkRef.current = true; setDoing(hit); }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember the mode so a refresh doesn't re-ask
  useEffect(() => {
    if (!mode) return;
    host.updateMemory(m => ({ ...m, mode }));
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore this lesson's language answer (a refresh must not re-ask), and sync
  // the runtime store — the student may have chosen differently on another lesson
  useEffect(() => {
    const saved = host.readMemory().lang ?? null;
    if (!saved) return;
    setLang(saved);
    setAssist(saved === 'ar');
  }, [extractionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseLang = (choice: LangChoice) => {
    setLang(choice);
    setAssist(choice === 'ar');
    host.updateMemory(m => ({ ...m, lang: choice }));
  };

  // Screen wake lock while working
  useEffect(() => {
    const acquire = async () => {
      try { wakeLockRef.current = await (navigator as any).wakeLock?.request('screen'); } catch { /* unsupported */ }
    };
    acquire();
    const onVisibility = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      wakeLockRef.current?.release?.().catch(() => {});
    };
  }, []);

  // The quiz becomes the FIRST level of one continuous session
  const sessionSet = useMemo<PracticeSet | null>(() => {
    if (!questions || questions.length === 0) return null;
    const quizItems: PracticeItem[] = questions.map((q: any) => ({
      type: 'mcq',
      bloomLevel: 'quiz',
      questionText: q.questionText,
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || '',
      explanationArabic: q.explanationArabic || '',
      sourceHeading: q.sourceHeading,
      typedEligible: q.type === 'gap-fill',
      // Bilingual concept-check fields (absent on gap-fills and on older content)
      conceptCheck: q.conceptCheck === true || undefined,
      questionTextArabic: q.questionTextArabic || undefined,
      optionsArabic: Array.isArray(q.optionsArabic) && q.optionsArabic.length === (q.options?.length || 0) ? q.optionsArabic : undefined,
      example: q.example || undefined,
    }));
    const quizLevel: PracticeLevel = {
      level: 'quiz',
      label: 'Quiz',
      labelArabic: 'الاختبار',
      items: quizItems,
    };
    return {
      title,
      band: practice?.band || 'B1',
      levels: [quizLevel, ...(practice?.levels || [])],
      generatedAt: new Date().toISOString(),
    };
  }, [questions, practice, title]);

  const handleSessionComplete = (summary: SessionSummary) => {
    setSessionDone(true);
    const quiz = summary.levels.find(l => l.level === 'quiz');
    host.updateMemory(m => ({ ...m, session: {
      at: now(), correct: summary.correct, total: summary.total, quizCorrect: quiz?.correct, quizTotal: quiz?.total,
    } }));
  };

  const canReview = slides.length > 0 && !!renderConfig;
  const total = progress?.total ?? 0;
  const completed = progress?.completed ?? 0;
  const remaining = Math.max(0, total - completed);
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  const exercisesCard = (
    <div className="px-5 pt-5 max-w-lg mx-auto">
      <div className="rounded-2xl bg-white border-2 border-emerald-200 shadow-sm p-4 space-y-3">
        <p className="font-bold text-slate-800 flex items-center gap-2"><PencilLine className="w-5 h-5 text-emerald-600" />Exercises from the book ({exercises.length})</p>
        <div className="space-y-2">
          {exercises.map(e => (
            <button key={e.id} onClick={() => setDoing(e)}
              className="w-full flex items-center gap-3 p-2 rounded-xl border border-slate-200 active:bg-slate-50 text-left">
              {e.imageUrls[0] && <img src={e.imageUrls[0]} alt="" className="w-12 h-14 object-cover object-top rounded border border-slate-200 bg-white shrink-0" />}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-800">Exercise {e.number}</span>
                <span className="block text-sm text-slate-500 truncate">{e.interactive.exercise.instructions}</span>
                <span className="block text-xs text-slate-400 truncate">{readinessShort(phoneReadiness(e.interactive.exercise, e.interactive.scored))}</span>
              </span>
              {doneIds.includes(e.id)
                ? <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                : <span className="text-sm font-semibold text-emerald-700 shrink-0">Do it →</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const replayCard = (
    <div className="px-5 pt-5 max-w-lg mx-auto">
    <button
      onClick={host.onReplay}
      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border-2 border-indigo-200 active:bg-indigo-50 text-left shadow-sm"
    >
      <PlayCircle className="w-10 h-10 text-indigo-600 shrink-0" />
      <span className="min-w-0">
        <span className="block font-bold text-slate-800">Watch the lesson{data.replayMinutes ? ` (${data.replayMinutes} min)` : ''}</span>
        <span className="block text-sm text-slate-500">Watch the slides with the teacher’s voice · شاهد الدرس</span>
      </span>
    </button>
        </div>
  );

  const runner = doing && (
    <ExerciseRunner extractionId={extractionId} exercise={doing} persist onClose={() => setDoing(null)}
      onDone={(id) => setDoneIds(d => (d.includes(id) ? d : [...d, id]))} />
  );

  // A lesson without a quiz: the book's exercises and the replay only
  if (!sessionSet) {
    return (
      <div className="min-h-screen bg-slate-50 pb-10">
        <div className="bg-indigo-600 text-white px-5 py-6">
          <p className="text-xs uppercase tracking-wider text-indigo-200 mb-1">Lesson</p>
          <h1 className="text-xl font-bold leading-snug">{title}</h1>
          <p className="text-sm text-indigo-200 mt-1">This lesson has no quiz{exercises.length ? ' — do the exercises below' : ''}.</p>
        </div>
        {exercises.length > 0 && exercisesCard}
        {hasReplay && replayCard}
        {runner}
      </div>
    );
  }

  // The language step only exists where there is Arabic to offer — on
  // un-backfilled lessons the flow is unchanged
  const langStepShown = setHasAssist(sessionSet);
  // Only ask on a genuinely fresh start — never interrupt a session already in
  // progress (that student keeps the in-exercise toggle)
  const needsLang = langStepShown && lang === null && mode === null;

  const quizCount = sessionSet.levels[0]?.items.length || 0;
  const practiceCount = sessionSet.levels.slice(1).reduce((n, l) => n + l.items.length, 0);


  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-5 py-6">
        {/* LMP site: back to the module, and the Arabic help switch in the header (website-spec §9) */}
        <div className="flex items-center justify-between gap-2 mb-1">
          {host.onBack ? (
            <button onClick={host.onBack} className="-ml-1 inline-flex items-center gap-0.5 text-sm text-indigo-100 active:text-white">
              <ChevronLeft className="w-4 h-4" />Lesson practice
            </button>
          ) : <p className="text-xs uppercase tracking-wider text-indigo-200">Lesson practice</p>}
          {langStepShown && <AssistToggle className="shrink-0" />}
        </div>
        <h1 className="text-xl font-bold leading-snug">{title}</h1>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mt-1">
          <p className="text-sm text-indigo-200">
            {practiceCount > 0
              ? `${quizCount} questions + ${practiceCount} practice exercises`
              : `${quizCount} question${quizCount !== 1 ? 's' : ''}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
          {hasReplay && (
            <button
              onClick={host.onReplay}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 active:bg-white/25 text-sm font-medium shrink-0"
            >
              <PlayCircle className="w-4 h-4" /> Watch the lesson{data.replayMinutes ? ` (${data.replayMinutes} min)` : ''}
            </button>
          )}
          {canReview && (
            <button
              onClick={() => setReviewIndex(0)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 active:bg-white/25 text-sm font-medium shrink-0"
            >
              <BookOpen className="w-4 h-4" /> Lesson slides
            </button>
          )}
          </div>
        </div>
      </div>

      {/* Prominent whole-session progress — the proof that practice isn't done.
          Only reaches 100% after the very last practice exercise. */}
      {mode !== null && total > 0 && (
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-2.5">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-bold text-slate-700">
                {remaining > 0 ? `Question ${Math.min(completed + 1, total)} of ${total}` : 'Finished!'}
              </span>
              {remaining > 0 && (
                <span className="text-xs font-semibold text-indigo-600">{remaining} left · متبقّي {remaining}</span>
              )}
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Missed the class? Watch the lesson first — offered before starting */}
      {hasReplay && mode === null && replayCard}


      {/* Step 1 — language. Forced, because as a secondary control students skipped it */}
      {needsLang ? (
        <>
          <p className="text-center text-xs text-slate-400 pt-4">Step 1 of 2</p>
          <LanguageChoice onChoose={chooseLang} />
        </>
      ) : mode === null ? (
        /* Step 2 — how to answer */
        <div className="p-5 max-w-lg mx-auto space-y-4">
          {langStepShown && <p className="text-center text-xs text-slate-400 mt-2">Step 2 of 2</p>}
          <p className="text-center text-slate-600 text-sm mt-2">How would you like to answer?</p>
          <button
            onClick={() => setMode('choice')}
            className="w-full bg-white rounded-2xl border-2 border-indigo-200 active:border-indigo-400 shadow-sm p-5 text-left flex items-start gap-4"
          >
            <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              <ListChecks className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">Multiple Choice</p>
              <p className="text-sm text-slate-500 mt-0.5">Answer everything by tapping an option.</p>
              <p className="text-sm text-slate-500 text-right mt-1" dir="rtl" lang="ar">أجب عن كل الأسئلة باختيار الإجابة الصحيحة</p>
            </div>
          </button>
          <button
            onClick={() => setMode('typed')}
            className="w-full bg-white rounded-2xl border-2 border-amber-200 active:border-amber-400 shadow-sm p-5 text-left flex items-start gap-4"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <PenLine className="w-6 h-6 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">Challenge <span className="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ml-1">harder</span></p>
              <p className="text-sm text-slate-500 mt-0.5">Type the missing words yourself, plus extra writing at the end.</p>
              <p className="text-sm text-slate-500 text-right mt-1" dir="rtl" lang="ar">تحدٍّ: اكتب الكلمات بنفسك، مع أسئلة كتابة إضافية في النهاية</p>
            </div>
          </button>
          {langStepShown && (
            <button
              onClick={() => setLang(null)}
              className="w-full text-center text-xs text-slate-400 active:text-slate-600 pt-1"
            >
              ← Change language
            </button>
          )}
        </div>
      ) : (
        /* ONE continuous stream: quiz questions then practice, no Submit,
           no score until the very end */
        <div className="pt-3">
          <PracticeSession
            set={sessionSet}
            initialMode={mode === 'typed' ? 'challenge' : 'standard'}
            storageKey={sessionKey}
            storage={storage}
            skipIntros
            continuous
            canReview={canReview}
            resolveSlide={(item) => resolveSlideIndex(item.sourceHeading, slides)}
            onOpenSlide={(idx) => setReviewIndex(idx)}
            onProgress={(c, t) => setProgress({ completed: c, total: t })}
            onComplete={handleSessionComplete}
          />
        </div>
      )}

      {/* LMP site: the book's exercises sit below the stream (website-spec §9.3) */}
      {exercises.length > 0 && exercisesCard}

      {runner}

      {/* Slide review overlay (open book) */}
      {reviewIndex !== null && canReview && (
        <SlideReviewOverlay
          slides={slides}
          slidesAr={slidesAr}
          renderConfig={renderConfig}
          initialIndex={reviewIndex}
          onClose={() => setReviewIndex(null)}
        />
      )}
    </div>
  );
}
