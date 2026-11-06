import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Maximize2, PencilLine } from 'lucide-react';
import { SlidePreview } from '../../../types/lesson';
import { SlideRenderConfig } from '../../../types/slideRender';
import { SlideViewer } from '../../preview/SlideViewer';
import { SlideGrid } from '../SlideGrid';
import { usePresentationPlayback, SlideAudioItem, ExerciseSlideItem, Lang, Playback } from '../usePresentationPlayback';
import { MobileControlBar } from './MobileControlBar';
import { NarrationPanel } from './NarrationPanel';
import { useNarrationLines, useOrientation } from './useNarrationLines';

interface MobilePlayerProps {
  title: string;
  slides: SlidePreview[];
  slidesAr?: SlidePreview[];
  slideAudio?: SlideAudioItem[];
  slideAudioAr?: SlideAudioItem[];
  exercises?: ExerciseSlideItem[];
  renderConfig: SlideRenderConfig;
  /** The student's language choice on /assess — offered first in the picker */
  preferredLanguage?: Lang | null;
  onBack?: () => void;
  /** Exercise (0-based, in the exercise chain) has an interactive version students can do */
  canDoExercise?: (index: number) => boolean;
  /** Open the exercise sheet; playback is paused first */
  onDoExercise?: (index: number) => void;
  /** Play all: move on from a slide with no narration after this long */
  silentAdvanceMs?: number;
  /** An extra button in the top bar (e.g. Download PowerPoint) */
  headerAction?: React.ReactNode;
  /** Fired once, the first time the last lesson slide is shown (the lesson counts as watched) */
  onReachedEnd?: (language: Lang) => void;
  /** A button shown on the very last slide (e.g. "Next: Quiz and practice →") */
  endAction?: React.ReactNode;
}

function useWindowSize() {
  const get = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [s, setS] = useState(get);
  useEffect(() => {
    const on = () => setS(get());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

/** The slide with its live reveals and highlights (same timings as the projector) */
function LiveSlide({ pb, renderConfig }: { pb: Playback; renderConfig: SlideRenderConfig }) {
  if (!pb.currentSlide) return null;
  return (
    <SlideViewer
      slide={pb.currentSlide}
      renderConfig={renderConfig}
      audioRef={pb.audioRef}
      elementTimings={(pb.currentAudio as any)?.elementTimings}
      annotationTimings={(pb.currentAudio as any)?.annotationTimings}
      isAudioPlaying={pb.isAudioPlaying}
    />
  );
}

/** Swipe left/right to change slide; `rotated` = the enlarged sideways view */
function useSwipe(pb: Playback, rotated: boolean) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length !== 1) { start.current = null; return; }
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start.current) return;
      let dx = e.changedTouches[0].clientX - start.current.x;
      let dy = e.changedTouches[0].clientY - start.current.y;
      start.current = null;
      // Turned 90° clockwise: the slide's "left" is the screen's top
      if (rotated) [dx, dy] = [dy, -dx];
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 2) {
        if (dx < 0) pb.goNext(); else pb.goPrev();
      }
    },
  };
}

/**
 * The student's replay of the lesson on a phone or tablet — the teacher's
 * presenter (same playback hook: This slide, Play all, pause/resume, speed,
 * EN/AR, captions, slide grid, exercises), laid out for touch:
 *
 * - Portrait: slide on top, the narration as large readable text below it
 *   (the slide is only ~0.3× on a phone), thumb-sized controls at the bottom.
 *   Tap the slide to enlarge it sideways across the whole screen.
 * - Landscape: the slide as large as fits, captions over it, one control row.
 */
export function MobilePlayer({
  title, slides, slidesAr, slideAudio, slideAudioAr, exercises, renderConfig, preferredLanguage, onBack,
  canDoExercise, onDoExercise, silentAdvanceMs, headerAction, onReachedEnd, endAction,
}: MobilePlayerProps) {
  const pb = usePresentationPlayback({ slides, slidesAr, slideAudio, slideAudioAr, exercises, silentAdvanceMs });
  const orientation = useOrientation();
  const { w, h } = useWindowSize();
  const [enlarged, setEnlarged] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const narration = useNarrationLines(pb.audioRef, pb.currentAudio);
  const exact = !!pb.currentCaptions?.length;
  const rtl = pb.language === 'ar';
  const exerciseCount = pb.total - pb.lessonCount;
  const onExercise = pb.currentIndex >= pb.lessonCount;
  const portrait = orientation === 'portrait';
  const rotated = enlarged && portrait;
  const swipe = useSwipe(pb, rotated);

  // The lesson counts as watched once its last slide is reached (any way: Play
  // all, swiping, the slide grid) — told to the host once
  const endReportedRef = useRef(false);
  useEffect(() => {
    if (!onReachedEnd || endReportedRef.current || pb.lessonCount === 0 || pb.currentIndex !== pb.lessonCount - 1) return;
    endReportedRef.current = true;
    onReachedEnd(pb.language);
  }, [pb.currentIndex, pb.lessonCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the screen awake during Play all (a phone sleeps mid-lesson otherwise)
  useEffect(() => {
    if (!pb.isSlideshowMode || !('wakeLock' in navigator)) return;
    let lock: any = null;
    (navigator as any).wakeLock.request('screen').then((l: any) => { lock = l; }).catch(() => {});
    return () => { lock?.release?.().catch(() => {}); };
  }, [pb.isSlideshowMode]);

  if (!pb.currentSlide) return null;

  const position = onExercise
    ? `Exercise ${pb.currentIndex - pb.lessonCount + 1} of ${exerciseCount}`
    : `Slide ${pb.currentIndex + 1} of ${pb.lessonCount}`;

  const exercisesButton = exerciseCount > 0 && pb.currentIndex === pb.lessonCount - 1 && (
    <button
      onClick={(e) => { e.stopPropagation(); pb.goTo(pb.lessonCount); }}
      className="px-3 py-1.5 rounded-full bg-white text-slate-900 text-sm font-semibold active:bg-white/80"
    >
      Exercises ({exerciseCount}) →
    </button>
  );

  // On an exercise slide with an interactive version: do it on the phone.
  // The user's pause path (never a teardown); the student presses play to go on.
  const exerciseIndex = pb.currentIndex - pb.lessonCount;
  const doExercise = onExercise && onDoExercise && canDoExercise?.(exerciseIndex) && (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (pb.isSlideshowMode) pb.toggleSlideshow();
        else if (pb.isAudioPlaying) pb.toggleAudio();
        setEnlarged(false);
        onDoExercise(exerciseIndex);
      }}
      className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-sm font-semibold active:bg-emerald-600 inline-flex items-center gap-1.5"
    >
      <PencilLine className="w-4 h-4" />Do this exercise
    </button>
  );

  const endButton = endAction && pb.currentIndex === pb.total - 1 ? endAction : null;
  const slotted = (exercisesButton || doExercise || endButton) && (
    <span className="flex items-center gap-2">{exercisesButton || doExercise}{endButton}</span>
  );

  const captionOverlay = pb.captionsOn && narration.activeText && (
    <div className="absolute inset-x-0 bottom-2 flex justify-center px-3 pointer-events-none z-10">
      <span dir={rtl ? 'rtl' : 'ltr'} className="inline-block max-w-3xl text-center bg-black/80 text-white text-base leading-snug px-3 py-1.5 rounded-lg">
        {narration.activeText}
      </span>
    </div>
  );

  const overlays = (
    <>
      {pb.toast && (
        <div className="fixed top-3 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <span className="bg-black/85 text-white text-sm px-4 py-2 rounded-lg">{pb.toast}</span>
        </div>
      )}

      {pb.showLanguagePicker && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4" onClick={pb.cancelLanguagePicker}>
          <div className="w-full max-w-sm bg-slate-900 rounded-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-white font-semibold">Which language? · أي لغة؟</p>
            {(['en', 'ar'] as Lang[])
              .sort((a, b) => (a === preferredLanguage ? -1 : b === preferredLanguage ? 1 : 0))
              .map(l => (
                <button
                  key={l}
                  onClick={() => pb.selectLanguage(l)}
                  className={`w-full py-4 rounded-xl text-lg font-semibold flex items-center justify-center gap-3 ${
                    l === preferredLanguage ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white active:bg-white/20'
                  }`}
                >
                  <span className="text-2xl">{l === 'en' ? '🇬🇧' : '🇸🇦'}</span>
                  {l === 'en' ? 'English' : 'العربية'}
                </button>
              ))}
          </div>
        </div>
      )}

      {showGrid && (
        <div className="fixed inset-0 z-40">
          <SlideGrid
            slides={pb.activeSlides}
            renderConfig={renderConfig}
            currentIndex={pb.currentIndex}
            onSelect={(i) => { setShowGrid(false); pb.goTo(i); }}
            onClose={() => setShowGrid(false)}
            onPlay={(i) => { setShowGrid(false); pb.playSlideAt(i); }}
            playableSlideIds={pb.playableSlideIds}
          />
        </div>
      )}
    </>
  );

  // ── Enlarged / landscape: the slide as big as the screen allows ──
  if (enlarged || !portrait) {
    // In portrait the enlarged view is turned sideways, so its box is h × w
    const boxW = rotated ? h : w;
    const boxH = rotated ? w : h;
    const barH = 60;
    const slideW = Math.min(boxW - 8, ((boxH - barH - 8) * 16) / 9);
    return (
      <div className="fixed inset-0 bg-black overflow-hidden select-none">
        <div
          className="absolute flex flex-col"
          style={rotated
            ? { width: boxW, height: boxH, top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(90deg)' }
            : { inset: 0 }}
        >
          <div
            className="relative flex-1 min-h-0 flex items-center justify-center"
            onClick={() => enlarged && setEnlarged(false)}
            {...swipe}
          >
            <div className="relative" style={{ width: slideW }}>
              <LiveSlide pb={pb} renderConfig={renderConfig} />
              {captionOverlay}
            </div>
            {!enlarged && <div className="absolute top-2 left-2 flex items-center gap-2">
              {!enlarged && onBack && (
                <button onClick={(e) => { e.stopPropagation(); onBack(); }} aria-label="Back"
                  className="w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-black/60 text-white text-xs font-medium">{position}</span>
              {headerAction}
              {pb.hasArabic && (
                <button onClick={(e) => { e.stopPropagation(); pb.toggleLanguage(); }}
                  className="px-2.5 py-1 rounded-lg bg-black/60 text-white text-xs font-bold">{pb.language === 'ar' ? 'AR' : 'EN'}</button>
              )}
            </div>}
            {slotted && <div className="absolute top-2 right-2">{slotted}</div>}
          </div>
          <MobileControlBar pb={pb} compact onGrid={() => setShowGrid(true)} onClose={enlarged ? () => setEnlarged(false) : undefined} />
        </div>
        {overlays}
      </div>
    );
  }

  // ── Portrait: slide, readable narration, thumb controls ──
  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex flex-col select-none">
      <header className="h-12 shrink-0 flex items-center gap-2 px-2 border-b border-white/10">
        {onBack && (
          <button onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-full flex items-center justify-center active:bg-white/10">
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <p className="flex-1 min-w-0 truncate text-sm font-semibold">{title}</p>
        {headerAction}
        {pb.hasArabic && (
          <div className="flex rounded-lg bg-white/10 p-0.5 text-xs font-bold shrink-0">
            {(['en', 'ar'] as Lang[]).map(l => (
              <button
                key={l}
                onClick={() => { if (pb.language !== l) pb.toggleLanguage(); }}
                className={`px-2.5 py-1.5 rounded-md ${pb.language === l ? 'bg-white text-slate-900' : 'text-white/70'}`}
              >
                {l === 'en' ? 'EN' : 'عربي'}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="shrink-0 px-2 pt-2" {...swipe}>
        <div className="relative" onClick={() => setEnlarged(true)}>
          <LiveSlide pb={pb} renderConfig={renderConfig} />
          <span className="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center pointer-events-none">
            <Maximize2 className="w-4 h-4" />
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 py-2 px-1 min-h-[44px]">
          <span className="text-xs text-white/60">{position}</span>
          {slotted}
        </div>
      </div>

      {pb.captionsOn ? (
        <NarrationPanel lines={narration.lines} activeIndex={narration.activeIndex} rtl={rtl} exact={exact} />
      ) : (
        <div className="flex-1 min-h-0 flex items-center justify-center text-white/30 text-sm px-6 text-center">
          Captions are off — tap CC to show what the teacher says
        </div>
      )}

      <MobileControlBar pb={pb} onGrid={() => setShowGrid(true)} />
      {overlays}
    </div>
  );
}
