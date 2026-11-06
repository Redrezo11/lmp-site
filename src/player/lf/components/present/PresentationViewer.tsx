import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SlidePreview } from '../../types/lesson';
import { SlideRenderConfig } from '../../types/slideRender';
import { SlideViewer } from '../preview/SlideViewer';
import { ControlBar } from './ControlBar';
import { SlideGrid } from './SlideGrid';
import { QrOverlay } from './QrOverlay';
import { usePresentationPlayback, SlideAudioItem, ExerciseSlideItem } from './usePresentationPlayback';

export type { SlideAudioItem, ExerciseSlideItem } from './usePresentationPlayback';

interface PresentationViewerProps {
  slides: SlidePreview[];
  renderConfig: SlideRenderConfig;
  slideAudio?: SlideAudioItem[];
  slidesAr?: SlidePreview[];
  slideAudioAr?: SlideAudioItem[];
  /** External message to surface via the viewer's toast (id re-fires repeats) */
  notice?: { id: number; text: string } | null;
  /** LMP site: the student session page (format sheet §11.6). Its button and QR
   *  code take the place of LessonForge's class QR code and live counter */
  sessionUrl?: string;
  /** Play all: move past a slide with no narration after this many ms (Slide Decks).
   *  Unset = wait on it, as extraction lessons always have */
  silentAdvanceMs?: number;
  /** Caption every narrated slide, not only clips with a word-timed track (Slide Decks) */
  narrationCaptions?: boolean;
  /** Exercise explainers after the lesson: reached from the final lesson
   *  slide; "Play all" stops before them */
  exercises?: ExerciseSlideItem[];
  /** Per exercise slide: the exercise id when students can do it on their phones, else null */
  phoneExerciseIds?: (string | null)[];
}

const AUTO_HIDE_MS = 3000;

/** Fit a 16:9 slide inside the window, following resizes and rotation */
function useFitWidth(): number {
  const fit = () => Math.min(window.innerWidth, (window.innerHeight / 720) * 1280);
  const [width, setWidth] = useState(fit);
  useEffect(() => {
    const onResize = () => setWidth(fit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

/**
 * The teacher's presenter (desktop / projector). Playback lives in
 * usePresentationPlayback, shared with the student phone player; this shell
 * adds the projector layout: auto-hiding controls, click halves, keyboard,
 * fullscreen, the assessment QR and the live completion counter.
 */
export function PresentationViewer({ slides, renderConfig, slideAudio, slidesAr, slideAudioAr, notice, sessionUrl, silentAdvanceMs, narrationCaptions, exercises, phoneExerciseIds }: PresentationViewerProps) {
  const [showQr, setShowQr] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [jumpBuffer, setJumpBuffer] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const slideWidth = useFitWidth();

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!showGrid) setShowControls(false);
    }, AUTO_HIDE_MS);
  }, [showGrid]);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimerRef.current);
  }, [resetHideTimer]);

  const pb = usePresentationPlayback({
    slides, slidesAr, slideAudio, slideAudioAr, silentAdvanceMs, exercises, narrationCaptions,
    onInteraction: resetHideTimer,
  });
  const {
    currentIndex, currentSlide, activeSlides, total, lessonCount, language, showToast,
    goNext, goPrev, toggleAudio, toggleSlideshow,
  } = pb;
  const exerciseCount = total - lessonCount;
  // The current exercise slide's id when students can do it on their phones
  const phoneExId = currentIndex >= lessonCount ? (phoneExerciseIds?.[currentIndex - lessonCount] ?? null) : null;
  const goTo = useCallback((index: number) => {
    pb.goTo(index);
    setShowGrid(false);
  }, [pb.goTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Surface external notices (e.g. background job failures) via the toast
  useEffect(() => {
    if (notice?.text) showToast(notice.text);
  }, [notice, showToast]);

  // A QR code belongs to the slide it was opened on
  useEffect(() => { setShowQr(false); }, [currentIndex, language]);

  // LMP site: the Student session button sits where LessonForge shows its QR
  // code — on the last lesson slide and on exercise slides students can do on
  // their phones (format sheet §11.6)
  const sessionHere = !!sessionUrl && (currentIndex === lessonCount - 1 || !!phoneExId);
  const sessionLink = sessionUrl && (phoneExId ? `${sessionUrl}?exercise=${encodeURIComponent(phoneExId)}` : sessionUrl);

  // Fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      resetHideTimer();

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
        case 'Backspace':
          e.preventDefault();
          goPrev();
          break;
        case ' ':
          // Always play/pause the narration — in slideshow mode too, so the
          // same key that pauses also resumes (and the run continues)
          e.preventDefault();
          toggleAudio();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          toggleSlideshow();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'g':
        case 'G':
          e.preventDefault();
          setShowGrid(prev => !prev);
          break;
        case 'c':
        case 'C':
          if (pb.hasCaptions) { e.preventDefault(); pb.toggleCaptions(); }
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          pb.toggleLanguage();
          break;
        case 'Escape':
          if (showGrid) setShowGrid(false);
          break;
        case 'Enter':
          if (jumpBuffer) {
            const num = parseInt(jumpBuffer, 10);
            if (!isNaN(num) && num >= 1 && num <= total) goTo(num - 1);
            setJumpBuffer('');
          }
          break;
        default:
          if (e.key >= '0' && e.key <= '9') {
            setJumpBuffer(prev => prev + e.key);
            setTimeout(() => setJumpBuffer(''), 2000);
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, toggleFullscreen, toggleSlideshow, toggleAudio, showGrid, jumpBuffer, total, goTo, resetHideTimer, pb.hasCaptions, pb.toggleCaptions, pb.toggleLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Touch
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 2) {
      if (dx < 0) goNext(); else goPrev();
    }
  };

  // Click halves (only in manual mode, not on controls)
  const handleSlideClick = (e: React.MouseEvent) => {
    if (showGrid) return;
    if (pb.isSlideshowMode) {
      // Click during a slideshow = pause the narration (clicking again
      // resumes); the run stays armed so nothing is lost
      toggleAudio();
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width / 2) goPrev(); else goNext();
    resetHideTimer();
  };

  if (!currentSlide) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black flex items-center justify-center select-none"
      style={{ cursor: showControls ? 'default' : 'none' }}
      onMouseMove={() => resetHideTimer()}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleSlideClick}
    >
      {/* Slide content */}
      <div className="w-full h-full flex items-center justify-center">
        <div style={{ width: slideWidth }}>
          <SlideViewer
            slide={currentSlide}
            renderConfig={renderConfig}
            audioRef={pb.audioRef}
            elementTimings={(pb.currentAudio as any)?.elementTimings}
            annotationTimings={(pb.currentAudio as any)?.annotationTimings}
            isAudioPlaying={pb.isAudioPlaying}
          />
        </div>
      </div>

      {/* Student session: button, then its QR code (LMP site, format sheet §11.6) */}
      {sessionHere && !showQr && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowQr(true); resetHideTimer(); }}
          className="absolute bottom-24 right-8 z-30 px-6 py-4 bg-white text-slate-800 rounded-2xl shadow-2xl text-lg font-semibold hover:scale-105 transition-transform flex items-center gap-3"
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14h1M14 20h1M18 18h3v3" />
          </svg>
          Student session
        </button>
      )}

      {showQr && sessionLink && (
        <QrOverlay
          url={sessionLink}
          onClose={() => setShowQr(false)}
          title={phoneExId ? `Scan to do Exercise ${currentIndex - lessonCount + 1} on your phone` : 'Scan for the student session'}
        />
      )}

      {/* Final lesson slide -> the exercises (optional add-on) */}
      {exerciseCount > 0 && currentIndex === lessonCount - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goTo(lessonCount); }}
          className="absolute bottom-24 left-8 z-30 px-6 py-4 bg-white text-slate-800 rounded-2xl shadow-2xl text-lg font-semibold hover:scale-105 transition-transform"
        >
          Exercises ({exerciseCount}) →
        </button>
      )}

      {/* Which exercise this is */}
      {currentIndex >= lessonCount && (
        <div className="absolute top-6 left-6 z-30 px-3 py-1.5 bg-black/70 text-white rounded-lg text-sm font-medium">
          Exercise {currentIndex - lessonCount + 1} of {exerciseCount}
        </div>
      )}

      {/* Closed captions */}
      {pb.captionsOn && pb.captionText && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-[25] w-[92%] max-w-4xl text-center pointer-events-none transition-[bottom] duration-300 ${showControls ? 'bottom-24' : 'bottom-8'}`}
        >
          <span
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            className="inline-block bg-black/80 text-white text-lg sm:text-2xl leading-snug px-4 py-2 rounded-lg"
          >
            {pb.captionText}
          </span>
        </div>
      )}

      {/* Toast notification */}
      {pb.toast && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 bg-black/80 text-white text-sm px-4 py-2 rounded-lg backdrop-blur-sm">
          {pb.toast}
        </div>
      )}

      {/* Jump buffer */}
      {jumpBuffer && (
        <div className="absolute top-6 right-6 z-20 bg-black/70 text-white text-2xl font-mono px-4 py-2 rounded-lg">
          Go to: {jumpBuffer}_
        </div>
      )}

      {/* Control bar */}
      <ControlBar
        current={currentIndex}
        total={total}
        onPrev={() => goPrev()}
        onNext={() => goNext()}
        onFullscreen={() => toggleFullscreen()}
        onGrid={() => setShowGrid(true)}
        isFullscreen={isFullscreen}
        visible={showControls}
        hasAudio={!!pb.currentAudioUrl}
        isAudioPlaying={pb.isAudioPlaying}
        onToggleAudio={() => toggleAudio()}
        slideFinished={pb.slideFinished}
        isSlideshowMode={pb.isSlideshowMode}
        onToggleSlideshow={() => toggleSlideshow()}
        playbackRate={pb.playbackRate}
        onCyclePlaybackRate={pb.cyclePlaybackRate}
        language={language}
        hasArabic={pb.hasArabic}
        onToggleLanguage={pb.toggleLanguage}
        hasCaptions={pb.hasCaptions}
        captionsOn={pb.captionsOn}
        onToggleCaptions={pb.toggleCaptions}
      />

      {/* Language picker overlay */}
      {pb.showLanguagePicker && (
        <div className="absolute inset-0 z-40 bg-black/80 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); pb.cancelLanguagePicker(); }}>
          <div className="flex gap-6" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => pb.selectLanguage('en')}
              className="px-8 py-6 bg-white/10 hover:bg-white/20 rounded-2xl text-white text-xl font-medium transition-colors flex flex-col items-center gap-2"
            >
              <span className="text-3xl">🇬🇧</span>
              English
            </button>
            <button
              onClick={() => pb.selectLanguage('ar')}
              className="px-8 py-6 bg-white/10 hover:bg-white/20 rounded-2xl text-white text-xl font-medium transition-colors flex flex-col items-center gap-2"
            >
              <span className="text-3xl">🇸🇦</span>
              العربية
            </button>
          </div>
        </div>
      )}

      {/* Slide grid — in the current language */}
      {showGrid && (
        <SlideGrid
          slides={activeSlides}
          renderConfig={renderConfig}
          currentIndex={currentIndex}
          onSelect={goTo}
          onClose={() => setShowGrid(false)}
          onPlay={(i) => { setShowGrid(false); pb.playSlideAt(i); }}
          playableSlideIds={pb.playableSlideIds}
        />
      )}
    </div>
  );
}
