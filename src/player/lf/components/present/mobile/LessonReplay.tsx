import { ReactNode, useState } from 'react';
import { MobilePlayer } from './MobilePlayer';
import { toExerciseSlides, Lang, SlideAudioItem } from '../usePresentationPlayback';
import { ExerciseRunner, RunnableExercise } from '../../exercises/digital/ExerciseRunner';
import type { SessionSummary } from '../../practice/PracticeSession';
import { setAssist } from '../../../hooks/useAssist';
import type { SlidePreview } from '../../../types/lesson';
import type { SlideRenderConfig } from '../../../types/slideRender';
import type { Exercise } from '../../../types/exercise';
import type { StudentInteractive } from '../../../types/exerciseTemplates';

/**
 * LMP site: LessonForge's /replay payload, built from the module's blocks
 * instead of fetched (was `ReplayPayload` in services/api).
 */
export interface ReplayPayload {
  title: string;
  slides: SlidePreview[];
  slidesAr: SlidePreview[];
  renderConfig: SlideRenderConfig | null;
  slideAudio: SlideAudioItem[];
  slideAudioAr: SlideAudioItem[];
  exercises: Array<Exercise & { interactive?: StudentInteractive | null }>;
}

/**
 * A lesson on a phone: the slides with narration, then its exercises, with the
 * interactive ones done in a sheet over the player. Shared by the anonymous QR
 * replay (/replay/:id) and the class account's library (/student/lesson/:id).
 *
 * LMP site: `onExerciseDone` replaces the studentProgress write (the site keeps
 * its own progress record, website-spec §8).
 */
export function LessonReplay({ extractionId, data, onBack, preferredLanguage, headerAction, onReachedEnd, endAction, persist, onExerciseDone }: {
  extractionId: string;
  data: ReplayPayload;
  onBack?: () => void;
  preferredLanguage?: Lang | null;
  headerAction?: ReactNode;
  onReachedEnd?: (language: Lang) => void;
  endAction?: ReactNode;
  /** A student at home: exercise progress is kept on the phone */
  persist?: boolean;
  onExerciseDone?: (exId: string, summary?: SessionSummary) => void;
}) {
  // The exercise sheet open over the player (index in the exercise chain)
  const [doing, setDoing] = useState<number | null>(null);

  const runnable = (i: number): RunnableExercise | null => {
    const e = data.exercises[i];
    return e?.interactive ? { id: e.id, number: i + 1, imageUrls: e.imageUrls || (e.imageUrl ? [e.imageUrl] : []), interactive: e.interactive } : null;
  };
  const open = doing != null ? runnable(doing) : null;

  return (
    <>
      <MobilePlayer
        title={data.title}
        slides={data.slides}
        slidesAr={data.slidesAr.length ? data.slidesAr : undefined}
        slideAudio={data.slideAudio.length ? data.slideAudio : undefined}
        slideAudioAr={data.slideAudioAr.length ? data.slideAudioAr : undefined}
        exercises={toExerciseSlides(data.exercises)}
        renderConfig={data.renderConfig!}
        // Play all moves on from a slide with no narration (a title slide) instead of stopping
        silentAdvanceMs={5000}
        preferredLanguage={preferredLanguage}
        onBack={onBack}
        headerAction={headerAction}
        onReachedEnd={onReachedEnd}
        endAction={endAction}
        canDoExercise={(i) => !!runnable(i)}
        onDoExercise={(i) => {
          // Arabic help in the sheet follows the student's language choice
          if (preferredLanguage === 'ar') setAssist(true);
          setDoing(i);
        }}
      />
      {open && (
        <ExerciseRunner extractionId={extractionId} exercise={open} persist={persist} onClose={() => setDoing(null)}
          onDone={onExerciseDone} />
      )}
    </>
  );
}
