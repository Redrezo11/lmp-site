import type { LoadedModule, Block } from '../../lmp/types';
import type { SlidePreview } from './types/lesson';
import type { SlideRenderConfig } from './types/slideRender';
import type { CaptionLine, Exercise } from './types/exercise';
import type { StudentInteractive } from './types/exerciseTemplates';
import type { SlideAudioItem, ExerciseSlideItem } from './components/present/usePresentationPlayback';
import { toExerciseSlides } from './components/present/usePresentationPlayback';
import type { AssessmentPayload, StudentExercise } from './pages/AssessPage';
import type { ReplayPayload } from './components/present/mobile/LessonReplay';

/**
 * The bridge between the module format (format sheet §6–§11) and the props
 * LessonForge's components take. It only reshapes data: package paths become
 * URLs, clips become SlideAudioItems, the exercises block becomes the exercise
 * slides (`toExerciseSlides`, as LessonForge does). No timing, caption or
 * marking logic lives here.
 */

interface Clip {
  slideId: number;
  src: string;
  duration: number;
  narration: string;
  elementTimings: { elementId: string; showAt: number }[];
  annotationTimings: unknown[];
  captions?: CaptionLine[];
}
interface ExerciseClip { src: string; duration: number; captions?: CaptionLine[] }
interface ExerciseItem {
  id: string; number: number; images: string[]; narration: string; narrationAr?: string;
  audio?: ExerciseClip; audioAr?: ExerciseClip; interactive?: StudentInteractive;
}

/** A block by its ref ("lessonId#blockId", format sheet §6) */
export function findBlock(mod: LoadedModule, ref: string | undefined): Block | null {
  if (!ref) return null;
  const [lessonId, blockId] = ref.split('#');
  const lesson = mod.manifest.lessons.find(l => l.id === lessonId);
  const file = lesson && mod.files[lesson.source];
  return file?.blocks.find(b => b.id === blockId) || null;
}

/** The lesson that holds a block */
export function lessonOf(mod: LoadedModule, ref: string | undefined): string | null {
  if (!ref) return null;
  const lessonId = ref.split('#')[0];
  return mod.manifest.lessons.some(l => l.id === lessonId) ? lessonId : null;
}

/** The first lesson holding a block of this type */
export function lessonWithBlock(mod: LoadedModule, type: string): string | null {
  for (const l of mod.manifest.lessons) if (mod.files[l.source]?.blocks.some(b => b.type === type)) return l.id;
  return null;
}

export function clipToAudio(c: Clip, resolve: (p: string) => string): SlideAudioItem & Pick<Clip, 'elementTimings' | 'annotationTimings'> {
  return {
    slideId: c.slideId,
    url: resolve(c.src),
    duration: c.duration,
    narration: c.narration,
    ...(c.captions?.length ? { captions: c.captions } : {}),
    elementTimings: c.elementTimings || [],
    annotationTimings: c.annotationTimings || [],
  };
}

const resolveSlide = (s: SlidePreview, resolve: (p: string) => string): SlidePreview => ({
  ...s,
  ...(s.imageUrl ? { imageUrl: resolve(s.imageUrl) } : {}),
  ...(s.imageUrls?.length ? { imageUrls: s.imageUrls.map(resolve) } : {}),
});

/** lf.exercises items as LessonForge Exercises (what toExerciseSlides takes) */
export function exercisesOf(block: Block | null, resolve: (p: string) => string): Array<Exercise & { interactive?: StudentInteractive | null }> {
  const items: ExerciseItem[] = (block as any)?.items || [];
  const clip = (a?: ExerciseClip) => (a ? { url: resolve(a.src), duration: a.duration, captions: a.captions || [] } : null);
  return items.map(it => ({
    id: it.id,
    imageUrl: it.images[0] ? resolve(it.images[0]) : '',
    imageUrls: it.images.map(resolve),
    narration: it.narration || '',
    narrationAr: it.narrationAr || '',
    audio: clip(it.audio),
    audioAr: clip(it.audioAr),
    job: null,
    interactive: it.interactive || null,
  }));
}

/** Everything the presenter and the phone player need, for one lf.presentation / lf.deck / lf.exercises block */
export interface ViewerData {
  title: string;
  slides: SlidePreview[];
  slidesAr?: SlidePreview[];
  renderConfig: SlideRenderConfig;
  slideAudio?: SlideAudioItem[];
  slideAudioAr?: SlideAudioItem[];
  exercises: ExerciseSlideItem[];
  /** Per exercise slide: the exercise id when it can be done on a phone */
  phoneExerciseIds: (string | null)[];
  /** The raw exercises, for the phone player's exercise sheet */
  exerciseList: Array<Exercise & { interactive?: StudentInteractive | null }>;
  sessionRef?: string;
  /** Every picture, to warm the cache as LessonForge does */
  pictures: string[];
}

/** The `simple` theme LessonForge's exporter writes when there is none (only needed for lf.exercises alone) */
const FALLBACK_CONFIG: SlideRenderConfig = {
  theme: { titleBg: 'FFFFFF', contentBg: 'FFFFFF', titleFontColor: '1F2937', headingFontColor: '1F2937', bodyFontColor: '374151', accentColor: '4F46E5' },
  headingFont: 'Calibri', bodyFont: 'Calibri', bulletCharacter: '25BA', isHeadingItalic: false, vocabTermStyle: 'bold', lineSpacing: 1.2,
  slideTypography: {},
} as unknown as SlideRenderConfig;

export function viewerData(mod: LoadedModule, block: Block): ViewerData {
  const resolve = mod.resolve;
  const b = block as any;
  const exBlock = block.type === 'lf.exercises' ? block : findBlock(mod, b.exercisesRef);
  const exerciseList = exercisesOf(exBlock, resolve);
  const exercises = toExerciseSlides(exerciseList);
  const phoneExerciseIds = exerciseList.map(e => (e.interactive ? e.id : null));

  if (block.type === 'lf.exercises') {
    // Exercises alone (LessonForge's /exercises/:id): no lesson slides; the look of the lesson that refers to them
    const pres = mod.manifest.lessons.flatMap(l => mod.files[l.source]?.blocks || []).find((x: any) => x.exercisesRef && findBlock(mod, x.exercisesRef) === block) as any;
    return {
      title: block.title || mod.manifest.title, slides: [], renderConfig: pres?.renderConfig || FALLBACK_CONFIG,
      exercises, phoneExerciseIds, exerciseList, sessionRef: pres?.sessionRef,
      pictures: exerciseList.flatMap(e => e.imageUrls || []),
    };
  }

  const slides: SlidePreview[] = (b.slides || []).map((s: SlidePreview) => resolveSlide(s, resolve));
  const en: SlideAudioItem[] = (b.tracks?.en || []).map((c: Clip) => clipToAudio(c, resolve));
  const ar: SlideAudioItem[] = (b.tracks?.ar || []).map((c: Clip) => clipToAudio(c, resolve));
  // Arabic slides: slidesAr when present, else the same slides when there is an
  // Arabic track (decks always; format sheet §7.6 and §9)
  const slidesAr: SlidePreview[] | undefined = b.slidesAr?.length
    ? b.slidesAr.map((s: SlidePreview) => resolveSlide(s, resolve))
    : ar.length ? slides : undefined;
  return {
    title: block.title || mod.manifest.title,
    slides,
    slidesAr,
    renderConfig: b.renderConfig,
    slideAudio: en.length ? en : undefined,
    slideAudioAr: ar.length ? ar : undefined,
    exercises, phoneExerciseIds, exerciseList,
    sessionRef: b.sessionRef,
    pictures: [...slides.flatMap(s => [s.imageUrl, ...(s.imageUrls || [])]).filter((u): u is string => !!u), ...exerciseList.flatMap(e => e.imageUrls || [])],
  };
}

/** The phone player's payload (LessonForge's /replay) */
export function replayPayload(v: ViewerData): ReplayPayload {
  return {
    title: v.title, slides: v.slides, slidesAr: v.slidesAr || [], renderConfig: v.renderConfig,
    slideAudio: v.slideAudio || [], slideAudioAr: v.slideAudioAr || [], exercises: v.exerciseList,
  };
}

/** The session page's payload (LessonForge's /assessment), from an lf.student-session block */
export function assessmentPayload(mod: LoadedModule, block: Block): AssessmentPayload {
  const b = block as any;
  const slidesBlock = findBlock(mod, b.slidesRef) as any;
  const replayBlock = findBlock(mod, b.replayRef) as any;
  const exerciseList = exercisesOf(findBlock(mod, b.exercisesRef), mod.resolve);
  const exercises: StudentExercise[] = exerciseList
    .map((e, i) => (e.interactive ? { id: e.id, number: i + 1, imageUrls: e.imageUrls || [], interactive: e.interactive } : null))
    .filter((e): e is StudentExercise => !!e);
  return {
    title: block.title || mod.manifest.title,
    questions: b.quiz || [],
    slides: (slidesBlock?.slides || []).map((s: SlidePreview) => resolveSlide(s, mod.resolve)),
    slidesAr: (slidesBlock?.slidesAr || []).map((s: SlidePreview) => resolveSlide(s, mod.resolve)),
    renderConfig: slidesBlock?.renderConfig || null,
    hasReplay: !!replayBlock && (replayBlock.tracks?.en?.length || 0) > 0,
    replayMinutes: b.replayMinutes,
    practice: b.practice || null,
    exercises,
  };
}

/** The site's own address for a module's student session (format sheet §11.6) */
export function sessionUrl(moduleId: string, href = window.location.href): string {
  return `${href.split('#')[0]}#/m/${encodeURIComponent(moduleId)}/session`;
}
